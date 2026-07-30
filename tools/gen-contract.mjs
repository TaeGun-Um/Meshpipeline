// pipeline/contract.json 에서 Unity용 C# 상수와 블렌더용 Python 상수를 생성한다.
//
// 왜 생성하는가: 규약을 각 언어에 손으로 옮겨 적으면 반드시 어긋난다. 실제로
// 좌표계 혼선이 그렇게 생겼다 — 같은 규약이 3개 언어 5개 파일에 흩어져 있었다.
// contract.json 만 고치고 이 스크립트를 돌리면 모든 소비자가 같은 값을 본다.
//
// 사용: node tools/gen-contract.mjs
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const CONTRACT = path.join(ROOT, 'pipeline', 'contract.json');
const contract = JSON.parse(fs.readFileSync(CONTRACT, 'utf8'));

// 헤더는 ASCII만 쓴다. 이 파일은 C# 컴파일러와 블렌더 파이썬 두 툴체인이
// 읽으므로, 장식용 문자로 인코딩 위험을 만들 이유가 없다.
const HEADER = [
  '// =========================================================================',
  '// AUTO-GENERATED - do not edit by hand.',
  '//   source : pipeline/contract.json',
  '//   regen  : node tools/gen-contract.mjs',
  '// =========================================================================',
];

// ── C# (Unity) ─────────────────────────────────────────────────────────────

function csharpLiteral(v) {
  if (typeof v === 'string') return `"${v}"`;
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  if (typeof v === 'number') return Number.isInteger(v) ? `${v}` : `${v}f`;
  throw new Error(`지원하지 않는 리터럴: ${typeof v}`);
}

function emitCSharp() {
  const u = contract.unityImportRules;
  const a = contract.assertions;
  const L = [];

  L.push(...HEADER, '');
  L.push('using System.Collections.Generic;', '');
  L.push('/// <summary>파이프라인 규약 상수. pipeline/contract.json 에서 생성됨.</summary>');
  L.push('public static class PipelineContract');
  L.push('{');
  L.push(`    public const int Version = ${contract.version};`, '');

  L.push('    // ── 좌표계 변환 ──');
  L.push(`    public const string GltfToUnityAxisFlip = ${csharpLiteral(contract.conversions.gltfToUnity.axisFlip)};`);
  L.push(`    public const float BlenderFbxExtraYawDegrees = ${csharpLiteral(contract.conversions.blenderFbxRoundTrip.extraYawDegrees)};`);
  L.push(`    public const string ModelFrontLocalAfterFbx = ${csharpLiteral(contract.conversions.blenderFbxRoundTrip.modelFrontLocalAfter)};`, '');

  L.push('    // ── 임포트 설정 ──');
  L.push(`    public const bool UseFileScale = ${csharpLiteral(u.useFileScale)};`);
  L.push(`    public const string CharacterAnimationType = ${csharpLiteral(u.characterAnimationType)};`);
  L.push(`    public const float ModelYawDegrees = ${csharpLiteral(u.modelYawDegrees)};`);
  L.push(`    public const string PreferredRoute = ${csharpLiteral(u.preferredRoute)};`);
  L.push(`    public static readonly string[] LoopClips = { ${u.loopClips.map(csharpLiteral).join(', ')} };`, '');

  L.push('    // ── 검사 기준값 ──');
  L.push('    public struct Tol { public float Expected; public float Tolerance;');
  L.push('        public Tol(float e, float t) { Expected = e; Tolerance = t; }');
  L.push('        public bool Ok(float v) => System.Math.Abs(v - Expected) <= Tolerance;');
  L.push('        public override string ToString() => $"{Expected}±{Tolerance}"; }', '');

  const tol = (name, o) =>
    `    public static readonly Tol ${name} = new Tol(${o.expected}f, ${o.tolerance ?? 0}f);`;

  L.push(tol('CharacterHeight', a.characterHeightMeters));
  L.push(tol('FootToRoot', a.footToRootMeters));
  L.push(tol('RootTranslation', a.rootTranslationMagnitude));
  L.push(`    public const int CharacterBoneCount = ${a.characterBoneCount.expected};`);
  L.push(`    public const int CharacterTriangles = ${a.characterTriangles.expected};`);
  L.push(`    public const int CharacterSubmeshes = ${a.characterSubmeshes.expected};`);
  L.push(`    public const string CharacterRootBone = ${csharpLiteral(a.characterRootBone.expected)};`);
  L.push(`    public const bool CharacterAvatarIsHuman = ${csharpLiteral(a.characterAvatarIsHuman.expected)};`, '');

  L.push('    public static readonly Dictionary<string, Tol> ClipSeconds = new Dictionary<string, Tol>');
  L.push('    {');
  for (const [k, v] of Object.entries(a.clipSeconds)) {
    if (k.startsWith('$')) continue;
    L.push(`        { "${k}", new Tol(${v.expected}f, ${v.tolerance}f) },`);
  }
  L.push('    };', '');

  L.push('    public static readonly Dictionary<string, Tol> WalkPoseDegrees = new Dictionary<string, Tol>');
  L.push('    {');
  for (const [k, v] of Object.entries(a.walkPoseAtQuarterCycleDegrees)) {
    if (k.startsWith('$')) continue;
    L.push(`        { "${k}", new Tol(${v.expected}f, ${v.tolerance}f) },`);
  }
  L.push('    };', '');

  L.push('    public static readonly Dictionary<string, int> StaticPieceTriangles = new Dictionary<string, int>');
  L.push('    {');
  for (const [k, v] of Object.entries(a.staticPieceTriangles)) {
    if (k.startsWith('$')) continue;
    L.push(`        { "${k}", ${v.expected} },`);
  }
  L.push('    };', '');

  L.push('    public static readonly Dictionary<string, int> VertexColorMeshes = new Dictionary<string, int>');
  L.push('    {');
  for (const [k, v] of Object.entries(a.vertexColorMeshes)) {
    if (k.startsWith('$')) continue;
    L.push(`        { "${k}", ${v.expected} },`);
  }
  L.push('    };');
  L.push('}');

  return L.join('\n') + '\n';
}

// ── Python (Blender) ───────────────────────────────────────────────────────

function pyLiteral(v) {
  if (typeof v === 'string') return `'${v}'`;
  if (typeof v === 'boolean') return v ? 'True' : 'False';
  if (typeof v === 'number') return `${v}`;
  if (Array.isArray(v)) return `[${v.map(pyLiteral).join(', ')}]`;
  throw new Error(`지원하지 않는 리터럴: ${typeof v}`);
}

function emitPython() {
  const o = contract.blenderFbxOptions;
  const L = [];
  L.push(...HEADER.map((l) => l.replace(/^\/\//, '#')), '');
  L.push('"""블렌더 FBX 익스포트 규약. pipeline/contract.json 에서 생성됨."""', '');
  L.push('VERSION = ' + contract.version, '');
  L.push('# bpy.ops.export_scene.fbx 에 그대로 넘기는 옵션');
  L.push('FBX_OPTIONS = {');
  for (const [k, v] of Object.entries(o)) {
    if (k.startsWith('$')) continue;
    if (k === 'purgeCollections' || k === 'object_types') continue;
    L.push(`    ${pyLiteral(k)}: ${pyLiteral(v)},`);
  }
  L.push(`    'object_types': {${o.object_types.map(pyLiteral).join(', ')}},`);
  L.push('}', '');
  L.push('# 익스포트 전에 지워야 하는 컬렉션');
  L.push(`PURGE_COLLECTIONS = ${pyLiteral(o.purgeCollections)}`, '');
  return L.join('\n');
}

// ── 쓰기 ───────────────────────────────────────────────────────────────────

const targets = [
  ['unity/Assets/Editor/PipelineContract.g.cs', emitCSharp()],
  ['tools/contract_gen.py', emitPython()],
];

for (const [rel, content] of targets) {
  const p = path.join(ROOT, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, content, 'utf8');
  console.log(`  생성: ${rel}  (${content.split('\n').length}줄)`);
}
console.log(`contract.json v${contract.version} 에서 ${targets.length}개 파일 생성 완료`);
