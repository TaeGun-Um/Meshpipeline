// 파이프라인 오케스트레이터.
//
// 이 프로젝트는 "브라우저에서 코드로 그린 것이 게임엔진에서 그대로 보이는가"를
// 보장하는 파이프라인이다. 단계가 여러 도구(브라우저 / 블렌더 / 유니티)에 걸쳐
// 있어서 사람이 순서를 기억하면 반드시 틀린다. 여기서 순서와 검사를 못 박는다.
//
//   1 contract    규약에서 언어별 상수 재생성 + 손으로 고친 흔적 확인
//   2 freshness   브라우저 소스가 익스포트보다 새로우면 실패 (재익스포트 누락)
//   3 inspect     GLB가 규약을 지키는지 (금지 확장 / 노말맵 / 루트 트랜스폼)
//   4 convert     블렌더로 glb -> fbx (텍스처 분리, 위젯 제거)
//   5 blender     아마추어·액션·스킨 웨이트 보존 확인
//   6 unity       씬 조립 + PipelineCheck 적합성 검사
//
// 사용:
//   node tools/pipeline.mjs           전체
//   node tools/pipeline.mjs 3 6       특정 단계만
//   BLENDER=... UNITY=... node tools/pipeline.mjs
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const ROOT = process.cwd();
const P = (...a) => path.join(ROOT, ...a);

// 머신별 실행 경로. 커밋하지 않는다 — 사람마다 다르고, 공개 저장소에 로컬
// 사용자명이 남을 이유도 없다.
//   우선순위: 환경변수  >  pipeline/local.json  >  없음(해당 단계 실패)
// 템플릿은 pipeline/local.example.json 참고.
function localPaths() {
  const f = P('pipeline', 'local.json');
  if (!fs.existsSync(f)) return {};
  try {
    // BOM을 떼야 한다. 윈도우 편집기나 PowerShell `-Encoding utf8` 이 BOM을 붙이고,
    // JSON.parse 는 선행 BOM에서 바로 실패한다.
    const text = fs.readFileSync(f, 'utf8').replace(/^﻿/, '');
    return JSON.parse(text);
  } catch (e) {
    // 이 함수는 log() 정의 전에 실행되므로 console.log 를 직접 쓴다 (TDZ 회피)
    console.log(`  [경고] pipeline/local.json 파싱 실패: ${e.message}`);
    return {};
  }
}
const local = localPaths();
const BLENDER = process.env.BLENDER || local.blender || '';
const UNITY = process.env.UNITY || local.unity || '';

const contract = JSON.parse(fs.readFileSync(P('pipeline', 'contract.json'), 'utf8'));
const clipNames = Object.keys(contract.assertions.clipSeconds).filter((k) => !k.startsWith('$'));

const only = process.argv.slice(2).filter((a) => /^\d+$/.test(a)).map(Number);
const wanted = (n) => only.length === 0 || only.includes(n);

// --accept : 브라우저에서 메시를 확정한 뒤 "이 스펙을 승인한다"를 명령 하나로 만드는 것.
// 규약의 '내용 의존' 값(삼각형·서브메시·정점컬러·노말맵 수)만 실측값으로 갱신하고,
// '불변식'(루트 원점, 키, 발바닥 정렬, 본 수, 클립 길이, 포즈 각도, 스케일)은
// 절대 건드리지 않는다 — 그쪽이 깨졌다면 승인이 아니라 버그다.
const ACCEPT = process.argv.includes('--accept');
const measured = { staticTriangles: {}, vertexColorMeshes: {}, normalTextures: {}, character: {} };

const log = (s) => console.log(s);

// 경로가 아예 없을 때와 잘못된 경로일 때를 구분해 안내한다
function missingTool(key, value) {
  return value
    ? `${value} 없음`
    : `${key} 경로 미설정 — pipeline/local.json 을 만들거나 ${key.toUpperCase()} 환경변수 지정 ` +
      '(pipeline/local.example.json 참고)';
}

const failures = [];
function assert(stage, name, ok, detail) {
  log(`  [${ok ? 'PASS' : 'FAIL'}] ${name}  ${detail ?? ''}`);
  if (!ok) failures.push(`${stage}/${name}: ${detail ?? ''}`);
}

function run(exe, args, { timeoutMs = 900000 } = {}) {
  try {
    return { code: 0, out: execFileSync(exe, args, { encoding: 'utf8', timeout: timeoutMs, maxBuffer: 64 * 1024 * 1024 }) };
  } catch (e) {
    return { code: e.status ?? 1, out: (e.stdout ?? '') + (e.stderr ?? '') };
  }
}

function readGlbJson(file) {
  const b = fs.readFileSync(file);
  if (b.readUInt32LE(0) !== 0x46546c67) throw new Error('GLB 아님');
  return JSON.parse(b.subarray(20, 20 + b.readUInt32LE(12)).toString('utf8'));
}

function newestMtime(dir, exts) {
  let t = 0, which = '';
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      const r = newestMtime(p, exts);
      if (r.t > t) ({ t, which } = r);
    } else if (exts.some((x) => e.name.endsWith(x))) {
      const m = fs.statSync(p).mtimeMs;
      if (m > t) { t = m; which = p; }
    }
  }
  return { t, which };
}

// ── 1 contract ─────────────────────────────────────────────────────────────

function stageContract() {
  log('\n[1] contract — 규약에서 언어별 상수 재생성');
  const gen = ['unity/Assets/Editor/PipelineContract.g.cs', 'tools/contract_gen.py'];
  const before = gen.map((f) => (fs.existsSync(P(f)) ? fs.readFileSync(P(f), 'utf8') : null));

  run(process.execPath, [P('tools', 'gen-contract.mjs')]);

  // 드리프트는 매 실행의 재생성으로 항상 치유되므로 실패로 막지 않는다.
  // (실패로 두면 규약을 고칠 때마다 두 번 돌려야 한다.)
  // 보호는 "생성이 파이프라인의 일부"라는 사실에서 오고, 여기서는 변경만 알린다.
  gen.forEach((f, i) => {
    const after = fs.readFileSync(P(f), 'utf8');
    const changed = before[i] !== after;
    log(`  [${changed ? 'REGEN' : ' OK  '}] ${path.basename(f)}` +
        (changed ? '  규약 변경 또는 손수정을 재생성으로 반영' : '  규약과 일치'));
  });
  log(`  규약 v${contract.version}  axisFlip=${contract.conversions.gltfToUnity.axisFlip}  ` +
      `fbxYaw=${contract.conversions.blenderFbxRoundTrip.extraYawDegrees}`);
}

// ── 2 freshness ────────────────────────────────────────────────────────────

function stageFreshness() {
  log('\n[2] freshness — 익스포트가 브라우저 소스보다 최신인지');
  if (!fs.existsSync(P('web', 'export'))) {
    assert('freshness', 'exportDir', false, 'web/export 없음 — 브라우저에서 __export 실행 필요');
    return;
  }
  // 감시 범위는 규약이 정한다. controls.js 처럼 지오메트리를 만들지 않는 파일까지
  // 넣으면 무관한 변경마다 헛울린다.
  let src = { t: 0, which: '' };
  for (const rel of contract.exportRules.exportInputs) {
    const p = P(...rel.split('/'));
    if (!fs.existsSync(p)) continue;
    const r = fs.statSync(p).isDirectory()
      ? newestMtime(p, ['.js'])
      : { t: fs.statSync(p).mtimeMs, which: p };
    if (r.t > src.t) src = r;
  }
  const out = newestMtime(P('web', 'export'), ['.glb']);
  const stale = src.t > out.t;
  assert('freshness', 'exportsUpToDate', !stale,
    stale
      ? `소스가 더 새로움: ${path.relative(ROOT, src.which)} — 브라우저에서 __export 재실행`
      : `최신 (${Math.round((out.t - src.t) / 1000)}초 차)`);
}

// ── 3 inspect ──────────────────────────────────────────────────────────────

function stageInspect() {
  log('\n[3] inspect — GLB 규약 적합성');
  const dir = P('web', 'export');
  const forbidden = new Set(contract.exportRules.forbiddenExtensionsRequired);
  const tol = contract.assertions.rootTranslationMagnitude.tolerance;

  // 규약이 지정한 실사용 에셋만 본다 (비교 실험용 산출물은 제외)
  for (const name of contract.exportRules.exportedAssets) {
    const file = path.join(dir, `${name}.glb`);
    if (!fs.existsSync(file)) { assert('inspect', `${name}.exists`, false, '없음'); continue; }
    const j = readGlbJson(file);

    const req = j.extensionsRequired ?? [];
    const bad = req.filter((e) => forbidden.has(e));
    assert('inspect', `${name}.noForbiddenExt`, bad.length === 0,
      bad.length ? `금지 확장: ${bad.join(', ')}` : '없음');

    const t = j.nodes[j.scenes[0].nodes[0]].translation ?? [0, 0, 0];
    const mag = Math.hypot(...t);
    assert('inspect', `${name}.rootAtOrigin`, mag <= tol, `|t|=${mag.toFixed(4)}`);

    const used = j.extensionsUsed ?? [];
    assert('inspect', `${name}.noBumpExt`, !used.includes('EXT_materials_bump'),
      used.includes('EXT_materials_bump') ? '범프맵으로 나감 — 노말맵으로 바꿔야 함' : 'OK');

    const expect = contract.assertions.materialTextureSlots[name];
    if (expect) {
      const n = (j.materials ?? []).filter((m) => m.normalTexture).length;
      measured.normalTextures[name] = n;
      assert('inspect', `${name}.normalTextures`, n === expect.normalTexture,
        `${n} (기대 ${expect.normalTexture})`);
    }
  }
}

// ── 4 convert ──────────────────────────────────────────────────────────────

function stageConvert() {
  log('\n[4] convert — 블렌더 glb -> fbx');
  if (!BLENDER || !fs.existsSync(BLENDER)) {
    assert('convert', 'blenderExists', false, missingTool('blender', BLENDER));
    return;
  }
  const out = P('unity', 'Assets', 'ProceduralImport', 'fbx_loose');
  const glbs = contract.exportRules.exportedAssets
    .map((n) => P('web', 'export', `${n}.glb`))
    .filter((p) => fs.existsSync(p));

  const r = run(BLENDER, ['--background', '--python', P('tools', 'glb-to-fbx.py'),
    '--', '--mode', 'loose', '--out', out, ...glbs]);
  const m = r.out.match(/FBX_JSON_BEGIN([\s\S]*?)FBX_JSON_END/);
  if (!m) { assert('convert', 'ran', false, '출력 파싱 실패'); return; }

  const recs = JSON.parse(m[1]);
  for (const rec of recs) {
    assert('convert', `${rec.src}`, !rec.error && !!rec.fbx,
      rec.error ?? `${Math.round(rec.bytes / 1024)}KB`);
  }
  // object_types 에서 ARMATURE 가 빠지면 스켈레톤이 통째로 사라진다 — 회귀 방지
  const chr = recs.find((x) => x.src === 'character.glb');
  if (chr) {
    assert('convert', 'character.armature', chr.armatures === 1, `${chr.armatures}`);
    assert('convert', 'character.actions', chr.actions === clipNames.length,
      `${chr.actions} (기대 ${clipNames.length})`);
    assert('convert', 'character.widgetPurged', (chr.purged ?? []).length > 0,
      (chr.purged ?? []).join(',') || '없음');
  }
}

// ── 5 blender verify ───────────────────────────────────────────────────────

function stageBlender() {
  log('\n[5] blender — 아마추어·액션 보존');
  if (!BLENDER || !fs.existsSync(BLENDER)) {
    assert('blender', 'blenderExists', false, missingTool('blender', BLENDER));
    return;
  }

  const r = run(BLENDER, ['--background', '--python', P('tools', 'blender-check.py'),
    '--', P('web', 'export', 'character.glb')]);
  const m = r.out.match(/RESULT_JSON_BEGIN([\s\S]*?)RESULT_JSON_END/);
  if (!m) { assert('blender', 'ran', false, '출력 파싱 실패'); return; }
  const rec = JSON.parse(m[1])[0];

  const bones = contract.assertions.characterBoneCount.expected;
  const ch = contract.assertions.characterHeightMeters;
  assert('blender', 'import', rec.import === 'ok', rec.import);
  assert('blender', 'armatures', rec.armatures === 1, `${rec.armatures}`);
  assert('blender', 'bones', rec.bones === bones, `${rec.bones} (기대 ${bones})`);
  assert('blender', 'skinnedMeshes', rec.skinned_meshes === 1, `${rec.skinned_meshes}`);
  assert('blender', 'vertexGroups', rec.vertex_groups.length === rec.bones,
    `${rec.vertex_groups.length} (본 수와 같아야 함)`);
  assert('blender', 'actions', rec.actions.length === clipNames.length,
    `${rec.actions.length} (기대 ${clipNames.length})`);
  const h = rec.size_m ? rec.size_m[2] : 0;
  assert('blender', 'heightMeters', Math.abs(h - ch.expected) <= ch.tolerance,
    `${h}m (기대 ${ch.expected}±${ch.tolerance})`);
}

// ── 6 unity ────────────────────────────────────────────────────────────────

function stageUnity() {
  log('\n[6] unity — 씬 조립 + 적합성 검사');
  if (!UNITY || !fs.existsSync(UNITY)) {
    assert('unity', 'unityExists', false, missingTool('unity', UNITY));
    return;
  }

  const proj = P('unity');
  const logFile = path.join(process.env.TEMP ?? '/tmp', 'pipeline-unity.log');

  for (const method of ['BuildScene.All', 'PipelineCheck.Run']) {
    const r = run(UNITY, ['-batchmode', '-quit', '-projectPath', proj,
      '-executeMethod', method, '-logFile', logFile]);
    const text = fs.existsSync(logFile) ? fs.readFileSync(logFile, 'utf8') : '';

    const cs = [...text.matchAll(/error CS\d+: .*/g)].map((x) => x[0]);
    if (cs.length) { assert('unity', `${method}.compile`, false, cs[0]); return; }

    if (method === 'PipelineCheck.Run') {
      // 유니티 로그는 CRLF다. \n 만 쓰면 매칭에 실패한다.
      const m = text.match(/PIPELINE_JSON_BEGIN\r?\n([\s\S]*?)\r?\nPIPELINE_JSON_END/);
      if (!m) { assert('unity', 'reportParsed', false, 'PIPELINE_JSON 없음'); return; }
      const rep = JSON.parse(m[1]);
      log(`  유니티 검사 ${rep.total - rep.failed}/${rep.total} 통과`);

      // --accept 용 실측값 수집. 이름에서 어느 규약 항목인지 알아낸다.
      for (const c of rep.checks) {
        if (c.measured === null || c.measured === undefined) continue;
        let mm;
        if ((mm = c.name.match(/^(.+)\.triangles$/)) && c.stage === 'static')
          measured.staticTriangles[mm[1]] = c.measured;
        else if ((mm = c.name.match(/^(.+)\.vertexColorMeshes$/)))
          measured.vertexColorMeshes[mm[1]] = c.measured;
        else if (c.stage === 'character' && (c.name === 'triangles' || c.name === 'submeshes'))
          measured.character[c.name] = c.measured;
      }

      for (const c of rep.checks.filter((x) => !x.pass)) {
        failures.push(`unity/${c.stage}.${c.name}: ${c.detail}`);
        log(`  [FAIL] ${c.stage}/${c.name}  ${c.detail}`);
      }
      if (rep.failed === 0) log('  [PASS] 유니티 전체 통과');
    } else {
      assert('unity', `${method}.exit`, r.code === 0, `exit=${r.code}`);
    }
  }
}

// ── 실행 ───────────────────────────────────────────────────────────────────

const t0 = Date.now();
for (const [n, fn] of [[1, stageContract], [2, stageFreshness], [3, stageInspect],
                       [4, stageConvert], [5, stageBlender], [6, stageUnity]]) {
  if (!wanted(n)) continue;
  try { fn(); } catch (e) {
    failures.push(`stage${n}: ${e.message}`);
    log(`  [FAIL] 단계 ${n} 예외: ${e.message}`);
  }
}

// ── --accept : 내용 의존 값을 실측값으로 승인 ──────────────────────────────

function acceptMeasured() {
  log('\n[accept] 규약의 내용 의존 값을 실측값으로 갱신');
  const a = contract.assertions;
  const changes = [];

  const put = (label, obj, key, value, field = 'expected') => {
    if (value === undefined || obj?.[key] === undefined) return;
    const old = obj[key][field];
    if (old === value) return;
    obj[key][field] = value;
    changes.push(`${label}: ${old} -> ${value}`);
  };

  for (const [k, v] of Object.entries(measured.staticTriangles))
    put(`staticPieceTriangles.${k}`, a.staticPieceTriangles, k, v);
  for (const [k, v] of Object.entries(measured.vertexColorMeshes))
    put(`vertexColorMeshes.${k}`, a.vertexColorMeshes, k, v);
  for (const [k, v] of Object.entries(measured.normalTextures)) {
    const slot = a.materialTextureSlots[k];
    if (slot && slot.normalTexture !== v) {
      changes.push(`materialTextureSlots.${k}.normalTexture: ${slot.normalTexture} -> ${v}`);
      slot.normalTexture = v;
    }
  }
  if (measured.character.triangles !== undefined &&
      a.characterTriangles.expected !== measured.character.triangles) {
    changes.push(`characterTriangles: ${a.characterTriangles.expected} -> ${measured.character.triangles}`);
    a.characterTriangles.expected = measured.character.triangles;
  }
  if (measured.character.submeshes !== undefined &&
      a.characterSubmeshes.expected !== measured.character.submeshes) {
    changes.push(`characterSubmeshes: ${a.characterSubmeshes.expected} -> ${measured.character.submeshes}`);
    a.characterSubmeshes.expected = measured.character.submeshes;
  }

  if (changes.length === 0) { log('  변경 없음 — 규약이 이미 실측과 일치'); return; }

  fs.writeFileSync(P('pipeline', 'contract.json'), JSON.stringify(contract, null, 2) + '\n', 'utf8');
  run(process.execPath, [P('tools', 'gen-contract.mjs')]);
  for (const c of changes) log(`  ${c}`);
  log(`  contract.json 갱신 + 상수 재생성 (${changes.length}건)`);
  log('  불변식(루트·키·발바닥·본 수·클립 길이·포즈)은 손대지 않았습니다');
}

if (ACCEPT) acceptMeasured();

const secs = ((Date.now() - t0) / 1000).toFixed(1);
log('\n' + '='.repeat(72));
if (failures.length === 0) {
  log(`파이프라인 통과  (${secs}초)`);
  process.exit(0);
}
log(`파이프라인 실패 — ${failures.length}건  (${secs}초)`);
for (const f of failures) log(`  - ${f}`);
process.exit(1);
