// .glb 내부를 파싱해 블렌더 호환성 관점에서 검사한다.
// 사용: node tools/inspect-glb.mjs export/*.glb
import { readFile } from 'node:fs/promises';
import { basename } from 'node:path';

// 블렌더 glTF 임포터가 이해하는 확장 (4.x 기준 주요 항목)
const BLENDER_KNOWN = new Set([
  'KHR_materials_emissive_strength',
  'KHR_materials_clearcoat',
  'KHR_materials_transmission',
  'KHR_materials_volume',
  'KHR_materials_ior',
  'KHR_materials_specular',
  'KHR_materials_sheen',
  'KHR_materials_unlit',
  'KHR_materials_anisotropy',
  'KHR_texture_transform',
  'KHR_lights_punctual',
  'KHR_draco_mesh_compression',
  'KHR_mesh_quantization',
  'KHR_texture_basisu',
  // 실측 확인: Blender 5.2는 이 확장을 임포트하며 인스턴스를 실제 오브젝트로 전개한다.
  // (4.0 매뉴얼에는 "import support is work in progress"로 적혀 있어 오판했던 항목)
  'EXT_mesh_gpu_instancing',
]);

function parseGLB(buf) {
  const magic = buf.readUInt32LE(0);
  if (magic !== 0x46546c67) throw new Error('glTF 매직 불일치 — GLB가 아님');
  const version = buf.readUInt32LE(4);
  const total = buf.readUInt32LE(8);

  let off = 12;
  let json = null;
  let binLen = 0;
  while (off < total) {
    const len = buf.readUInt32LE(off);
    const type = buf.readUInt32LE(off + 4);
    const data = buf.subarray(off + 8, off + 8 + len);
    if (type === 0x4e4f534a) json = JSON.parse(data.toString('utf8'));
    else if (type === 0x004e4942) binLen = len;
    off += 8 + len + ((4 - (len % 4)) % 4);
  }
  return { version, total, json, binLen };
}

function triangles(json) {
  let tris = 0;
  for (const mesh of json.meshes || []) {
    for (const p of mesh.primitives || []) {
      const mode = p.mode ?? 4;
      if (mode !== 4) continue;
      const count =
        p.indices !== undefined
          ? json.accessors[p.indices].count
          : json.accessors[p.attributes.POSITION].count;
      tris += count / 3;
    }
  }
  return tris;
}

function attrSummary(json) {
  const seen = new Set();
  for (const mesh of json.meshes || []) {
    for (const p of mesh.primitives || []) {
      for (const k of Object.keys(p.attributes)) seen.add(k);
    }
  }
  return [...seen].sort();
}

const files = process.argv.slice(2);
if (!files.length) {
  console.error('사용: node tools/inspect-glb.mjs <파일...>');
  process.exit(1);
}

for (const f of files) {
  let buf;
  try {
    buf = await readFile(f);
  } catch {
    console.log(`\n${basename(f)}  — 읽기 실패`);
    continue;
  }

  const { version, total, json, binLen } = parseGLB(buf);
  const used = json.extensionsUsed || [];
  const required = json.extensionsRequired || [];
  const blocking = required.filter((e) => !BLENDER_KNOWN.has(e));

  const images = json.images || [];
  const imgBytes = images.reduce((a, im) => {
    const bv = json.bufferViews?.[im.bufferView];
    return a + (bv?.byteLength || 0);
  }, 0);

  // bump 확장을 쓰는 머티리얼 수
  const bumpMats = (json.materials || []).filter(
    (m) => m.extensions && m.extensions.EXT_materials_bump
  ).length;

  console.log(`\n=== ${basename(f)} ===`);
  console.log(`  glTF v${version} · ${(total / 1024).toFixed(0)} KB (BIN ${(binLen / 1024).toFixed(0)} KB)`);
  console.log(
    `  노드 ${json.nodes?.length ?? 0} · 메시 ${json.meshes?.length ?? 0} · 머티리얼 ${
      json.materials?.length ?? 0
    } · 텍스처 ${json.textures?.length ?? 0} · 이미지 ${images.length} (${(imgBytes / 1024).toFixed(0)} KB)`
  );
  console.log(`  삼각형 ${triangles(json).toLocaleString('en-US')}`);
  console.log(`  정점 속성: ${attrSummary(json).join(', ') || '(없음)'}`);
  console.log(`  extensionsUsed: ${used.length ? used.join(', ') : '(없음)'}`);
  console.log(`  extensionsRequired: ${required.length ? required.join(', ') : '(없음)'}`);
  if (bumpMats) console.log(`  ! EXT_materials_bump 사용 머티리얼 ${bumpMats}개 → 블렌더에서 범프 유실`);
  if (blocking.length) console.log(`  !! 블렌더 미지원 필수 확장: ${blocking.join(', ')} → 임포트 실패`);
  else console.log(`  → 블렌더 임포트: 차단 요소 없음`);
}
