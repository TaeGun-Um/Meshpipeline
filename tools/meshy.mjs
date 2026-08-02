// 캐릭터 베이스 생성기 — 컨셉 이미지 → 3D 메시 → 자동 리깅.
//
// ── 왜 이게 있나 ───────────────────────────────────────────────────────────
// 이 저장소는 "외부 애셋 0개" 로 지어졌고 도시에서는 그게 이겼다. 그런데
// 캐릭터에서는 다섯 판을 돌려도 얼굴 조형이 안 나왔다 — 규칙이 없는 형태를
// 숫자로 적는 되먹임 고리가 그림에 안 맞기 때문이다 (scenes/model-test 4장).
//
// 실제 사례(genex SKATE)를 열어 보니 사람은 코드가 아니라 **생성기 출력**이었다.
// 매니페스트에 경로가 그대로 적혀 있었다:
//
//   nano-banana-pro (컨셉) -> meshy-6 (34만 면) -> 1만 면 리메시(triangle)
//     -> meshy-biped 자동 리깅 -> rigged-character.glb, heightMeters 1.7
//
// 이 스크립트는 그 경로를 재현한다. 나온 GLB 는 브라우저에서 `__rig()` 로
// 받아 머리카락·장식·스프링을 얹는다 (scenes/model-test/rigtest.js).
//
// ── 쓰는 법 ────────────────────────────────────────────────────────────────
//   node tools/meshy.mjs --plan "은발 트윈 땋은머리 소녀, 흰 코트"   비용만 계산
//   node tools/meshy.mjs --prompt "..."                              전체 실행
//   node tools/meshy.mjs --image concept.png                         이미지부터
//   node tools/meshy.mjs --resume <run-id>                           이어서
//
// ── 키 ─────────────────────────────────────────────────────────────────────
// **환경변수로만 읽는다.** 파일에 적지 않고, 로그에도 안 찍는다.
//   GEMINI_API_KEY   https://ai.google.dev  (컨셉 이미지)
//   MESHY_API_KEY    https://meshy.ai       (3D · 리깅)
// 한쪽만 있어도 그 단계까지는 돈다 — 이미지를 직접 그렸다면 MESHY 만 있으면 된다.
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const OUT = path.join(ROOT, 'web', 'export');
const WORK = path.join(ROOT, 'pipeline', 'meshy');

// ── 값의 단일 출처 ─────────────────────────────────────────────────────────
//
// SKATE 매니페스트에서 읽은 실제 값이다. 바꿀 일이 생기면 여기만 고친다.
const SPEC = {
  concept: {
    model: 'gemini-3-pro-image', // 나노바나나 프로
    size: '2K',
    aspect: '2:3', // 전신 캐릭터 시트
  },
  mesh: {
    ai_model: 'meshy-6',
    should_texture: true,
    texture_resolution: '2k',
    should_remesh: true,
    topology: 'triangle',
    target_polycount: 10000,
    // **a-pose 여야 한다.** 리깅이 팔다리를 못 찾으면 여기서 실패한다.
    pose_mode: 'a-pose',
  },
  rig: {
    height_meters: 1.7,
  },
};

// 공식 가격표 기준 (2026-08 확인).
//   Gemini  gemini-3-pro-image  1K/2K 장당 $0.134 · 4K $0.24
//   Meshy   image-to-3d(텍스처) 30 크레딧 · 리깅 5 크레딧
//   크레딧 단가는 **공개돼 있지 않다.** Pro $20 / 1,000 크레딧에서 나눈 값이라
//   추가 팩 단가는 다를 수 있다. 실제 청구는 응답의 consumed_credits 로 본다.
const COST = { imageUSD: 0.134, meshCredits: 30, rigCredits: 5, creditUSD: 0.02 };

// ── 뼈대 ───────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const opt = (k, d = null) => {
  const i = args.indexOf(k);
  return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : d;
};
const has = (k) => args.includes(k);

const log = (s) => console.log(s);
const die = (s) => {
  console.error(`\n실패: ${s}`);
  process.exit(1);
};

// 키를 값으로 받되 **절대 출력하지 않는다.** 있는지 없는지만 말한다.
function key(name) {
  const v = process.env[name];
  return v && v.trim() ? v.trim() : null;
}

async function jsonFetch(url, init, what) {
  const res = await fetch(url, init);
  const text = await res.text();
  if (!res.ok) {
    // 본문에 키가 되돌아오는 서비스는 없지만, 혹시 몰라 앞부분만 싣는다
    die(`${what} HTTP ${res.status} — ${text.slice(0, 300)}`);
  }
  try {
    return JSON.parse(text);
  } catch {
    die(`${what} 응답이 JSON 이 아니다 — ${text.slice(0, 200)}`);
  }
}

// Meshy 는 작업을 큐에 넣고 폴링한다. 상태 표시가 없으면 3분이 먹통으로 보인다.
async function poll(url, headers, what, everyMs = 4000, maxMs = 20 * 60 * 1000) {
  const t0 = Date.now();
  let last = -1;
  for (;;) {
    const j = await jsonFetch(url, { headers }, `${what} 조회`);
    const st = j.status;
    if (j.progress !== last) {
      last = j.progress;
      process.stdout.write(`\r  ${what} ${st} ${j.progress ?? 0}%   `);
    }
    if (st === 'SUCCEEDED') {
      process.stdout.write('\n');
      return j;
    }
    if (st === 'FAILED' || st === 'CANCELED') {
      process.stdout.write('\n');
      die(`${what} ${st} — ${JSON.stringify(j.task_error ?? j.error ?? {})}`);
    }
    if (Date.now() - t0 > maxMs) die(`${what} 시간 초과`);
    await new Promise((r) => setTimeout(r, everyMs));
  }
}

async function download(url, dest) {
  const res = await fetch(url);
  if (!res.ok) die(`내려받기 HTTP ${res.status} — ${dest}`);
  const buf = Buffer.from(await res.arrayBuffer());
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, buf);
  return buf.length;
}

// 실행마다 폴더 하나. 중간에 끊겨도 이어서 할 수 있어야 한다 —
// 3D 생성은 크레딧을 쓰므로 재시도가 곧 돈이다.
function runDir(id) {
  const d = path.join(WORK, id);
  fs.mkdirSync(d, { recursive: true });
  return d;
}
const readState = (d) => {
  const f = path.join(d, 'state.json');
  return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : {};
};
const writeState = (d, s) =>
  fs.writeFileSync(path.join(d, 'state.json'), JSON.stringify(s, null, 2));

// ── 1. 컨셉 이미지 ─────────────────────────────────────────────────────────
//
// image-to-3D 는 **한 장으로 입체를 추측한다.** 그래서 프롬프트에 무엇을 그릴지
// 만큼이나 "어떻게 찍을지" 를 못박아야 한다. 3/4 나 역동적 포즈를 주면 그
// 왜곡이 메시에 그대로 굳는다.
const SHOT_RULES =
  'full body character sheet, front view, straight-on, A-pose with arms slightly away from body, ' +
  'feet flat and apart, entire figure visible from head to feet with margin, ' +
  'plain flat neutral gray background, even diffuse lighting, no shadows on background, ' +
  'no props, no text, no watermark, no cropping';

async function makeConcept(dir, prompt) {
  const k = key('GEMINI_API_KEY');
  if (!k) die('GEMINI_API_KEY 가 없다. --image 로 직접 그린 이미지를 넣거나 키를 설정한다.');

  log(`\n[1] 컨셉 이미지 — ${SPEC.concept.model} ${SPEC.concept.size} ${SPEC.concept.aspect}`);
  const j = await jsonFetch(
    'https://generativelanguage.googleapis.com/v1beta/interactions',
    {
      method: 'POST',
      headers: { 'x-goog-api-key': k, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: SPEC.concept.model,
        input: [{ type: 'text', text: `${prompt}. ${SHOT_RULES}` }],
        response_format: { image_size: SPEC.concept.size, aspect_ratio: SPEC.concept.aspect },
      }),
    },
    '컨셉 이미지'
  );

  // 응답 모양이 바뀔 수 있으므로 base64 를 넓게 찾는다
  const b64 = findImageB64(j);
  if (!b64) die(`컨셉 이미지 응답에서 이미지를 못 찾았다 — 키: ${Object.keys(j).join(', ')}`);
  const file = path.join(dir, 'concept.png');
  fs.writeFileSync(file, Buffer.from(b64, 'base64'));
  log(`  저장 ${path.relative(ROOT, file)} (${(fs.statSync(file).size / 1024).toFixed(0)}KB)`);
  return file;
}

function findImageB64(o, depth = 0) {
  if (!o || depth > 6) return null;
  if (typeof o === 'string') return o.length > 4096 && /^[A-Za-z0-9+/=]+$/.test(o) ? o : null;
  if (Array.isArray(o)) {
    for (const v of o) {
      const r = findImageB64(v, depth + 1);
      if (r) return r;
    }
    return null;
  }
  if (typeof o !== 'object') return null;
  for (const k of ['data', 'b64_json', 'image_bytes', 'bytesBase64Encoded']) {
    if (typeof o[k] === 'string' && o[k].length > 4096) return o[k];
  }
  for (const v of Object.values(o)) {
    const r = findImageB64(v, depth + 1);
    if (r) return r;
  }
  return null;
}

// ── 2. 이미지 → 3D ─────────────────────────────────────────────────────────

const MESHY = 'https://api.meshy.ai/openapi/v1';

async function makeMesh(dir, imageFile, state) {
  const k = key('MESHY_API_KEY');
  if (!k) die('MESHY_API_KEY 가 없다.');
  const H = { Authorization: `Bearer ${k}`, 'Content-Type': 'application/json' };

  if (!state.meshTask) {
    // 공개 URL 이 없으므로 data URI 로 보낸다
    const b = fs.readFileSync(imageFile);
    const uri = `data:image/png;base64,${b.toString('base64')}`;
    log(`\n[2] 이미지 → 3D — ${SPEC.mesh.ai_model} · ${SPEC.mesh.target_polycount} 면 · ${SPEC.mesh.pose_mode}`);
    const j = await jsonFetch(
      `${MESHY}/image-to-3d`,
      { method: 'POST', headers: H, body: JSON.stringify({ image_url: uri, ...SPEC.mesh }) },
      'image-to-3d 생성'
    );
    state.meshTask = j.result;
    writeState(dir, state);
    log(`  작업 ${state.meshTask}`);
  } else {
    log(`\n[2] 이미지 → 3D — 이어서 (${state.meshTask})`);
  }

  const done = await poll(`${MESHY}/image-to-3d/${state.meshTask}`, H, 'image-to-3d');
  state.meshCredits = done.consumed_credits ?? null;
  state.meshGlb = done.model_urls?.glb ?? null;
  writeState(dir, state);
  if (!state.meshGlb) die('image-to-3d 결과에 glb 가 없다');

  const raw = path.join(dir, 'mesh.glb');
  const n = await download(state.meshGlb, raw);
  log(`  저장 ${path.relative(ROOT, raw)} (${(n / 1024 / 1024).toFixed(2)}MB · ${state.meshCredits ?? '?'} 크레딧)`);
  return raw;
}

// ── 3. 자동 리깅 ───────────────────────────────────────────────────────────
//
// 제약이 문서에 명시돼 있다 — GLB 만 · **텍스처 있는 이족 휴머노이드**만 ·
// **얼굴이 +Z 를 봐야** 하고 · input_task_id 경로는 30만 면 이하.
// 앞 단계에서 1만 면으로 리메시했으므로 면 수는 문제가 안 된다.
async function makeRig(dir, state) {
  const k = key('MESHY_API_KEY');
  const H = { Authorization: `Bearer ${k}`, 'Content-Type': 'application/json' };

  if (!state.rigTask) {
    log(`\n[3] 자동 리깅 — 키 ${SPEC.rig.height_meters}m`);
    const j = await jsonFetch(
      `${MESHY}/rigging`,
      {
        method: 'POST',
        headers: H,
        body: JSON.stringify({ input_task_id: state.meshTask, ...SPEC.rig }),
      },
      '리깅 생성'
    );
    state.rigTask = j.result;
    writeState(dir, state);
    log(`  작업 ${state.rigTask}`);
  } else {
    log(`\n[3] 자동 리깅 — 이어서 (${state.rigTask})`);
  }

  const done = await poll(`${MESHY}/rigging/${state.rigTask}`, H, '리깅');
  state.rigCredits = done.consumed_credits ?? null;
  const url = done.rigged_character_glb_url ?? done.result?.rigged_character_glb_url;
  if (!url) die(`리깅 결과에 glb 가 없다 — 키: ${Object.keys(done).join(', ')}`);

  // 브라우저가 바로 집어갈 수 있는 자리에 떨군다 (web/export 는 gitignore)
  const dest = path.join(OUT, `${path.basename(dir)}.glb`);
  const n = await download(url, dest);
  state.rigged = dest;
  writeState(dir, state);
  log(`  저장 ${path.relative(ROOT, dest)} (${(n / 1024 / 1024).toFixed(2)}MB · ${state.rigCredits ?? '?'} 크레딧)`);
  return dest;
}

// ── 비용 ───────────────────────────────────────────────────────────────────

function plan(prompt) {
  const cr = COST.meshCredits + COST.rigCredits;
  log(`\n계획 — "${prompt}"\n`);
  log(`  [1] 컨셉 이미지  ${SPEC.concept.model} ${SPEC.concept.size}   $${COST.imageUSD.toFixed(3)}`);
  log(`  [2] 이미지→3D    ${SPEC.mesh.ai_model} 텍스처 포함           ${COST.meshCredits} 크레딧`);
  log(`  [3] 자동 리깅    ${SPEC.rig.height_meters}m                        ${COST.rigCredits} 크레딧`);
  log(`  ─────────────────────────────────────────────`);
  log(`  1회      $${COST.imageUSD.toFixed(2)} + ${cr} 크레딧  ≈ $${(COST.imageUSD + cr * COST.creditUSD).toFixed(2)}`);
  log(`  무료등급 매달 100 크레딧 = ${Math.floor(100 / cr)}회`);
  log(`  Pro $20  매달 1,000 크레딧 = ${Math.floor(1000 / cr)}회`);
  log(`\n  크레딧 단가는 공개돼 있지 않다. 위 환산은 Pro 플랜에서 나눈 값이고,`);
  log(`  실제 청구는 응답의 consumed_credits 로 확인한다.`);
  log(`\n  키:  GEMINI_API_KEY ${key('GEMINI_API_KEY') ? '있음' : '없음'} · MESHY_API_KEY ${key('MESHY_API_KEY') ? '있음' : '없음'}`);
}

// ── 진입 ───────────────────────────────────────────────────────────────────

async function main() {
  const prompt = opt('--prompt') || opt('--plan');
  if (has('--plan')) return plan(prompt || '(프롬프트 없음)');

  const resume = opt('--resume');
  const id = resume || `run-${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}`;
  const dir = runDir(id);
  const state = readState(dir);
  if (!resume) writeState(dir, { ...state, prompt: prompt ?? null, spec: SPEC });

  log(`실행 ${id}`);

  let image = opt('--image') || state.image;
  if (!image) {
    if (!prompt) die('--prompt 또는 --image 가 필요하다. 비용만 보려면 --plan.');
    image = await makeConcept(dir, prompt);
    state.image = image;
    writeState(dir, state);
  } else {
    if (!fs.existsSync(image)) die(`이미지가 없다: ${image}`);
    log(`\n[1] 컨셉 이미지 — 건너뜀 (${path.relative(ROOT, image)})`);
  }

  await makeMesh(dir, image, state);
  const glb = await makeRig(dir, state);

  const cr = (state.meshCredits ?? 0) + (state.rigCredits ?? 0);
  log(`\n완료 — 크레딧 ${cr} 소모`);
  log(`\n브라우저에서:`);
  log(`  await __rig({ url: '/export/${path.basename(glb)}' })`);
  log(`\n나오는 것: 본 개수·이름·머리뼈를 찾았는지·자동 축척·머리카락이 따라오는지.`);
  log(`뼈 이름이 안 맞으면 scenes/model-test/rigtest.js 의 findBone 목록에 한 줄 더한다.`);
}

main().catch((e) => die(e && e.stack ? e.stack : String(e)));
