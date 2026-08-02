// 정적/동적 메시가 같이 쓰는 지오메트리 도구.
//
// 정적 쪽은 인스턴싱을 쓰고(잡초·잡석), 동적 쪽은 스킨드 메시를 쓴다.
// 둘 다 "여러 조각을 하나의 BufferGeometry로 합친다"는 같은 문제를 풀기 때문에
// 병합 로직은 여기 모아두고, 붙는 속성만 다르게 준다.
//   - 인스턴싱: 인스턴스 행렬을 정점에 적용 + instanceColor -> COLOR_0
//   - 스키닝  : 본 rest 행렬을 정점에 적용 + skinIndex/skinWeight
import * as THREE from 'three';

// ── 프리미티브 ─────────────────────────────────────────────────────────────

// 축 길이를 span 미터마다 한 번 자른 분할 수. span 이 0 이면 1 — 예전 동작이다.
//
// ── 왜 박스를 쪼개나 ───────────────────────────────────────────────────────
// 정점에 빛을 구우려면 **빛이 변하는 자리에 정점이 있어야** 한다. 18m 벽이
// 꼭짓점 8개면 그 사이의 밝기 변화는 담을 데가 없다. 텍스처 라이트맵을 쓰지
// 않는 이 저장소에서는 분할이 곧 라이트맵 해상도다.
const segs = (len, span) => (span > 0 ? Math.max(1, Math.round(Math.abs(len) / span)) : 1);

// 박스. y=0을 기준으로 원하는 위치에 놓는다.
// span 을 주면 각 축을 그 길이마다 쪼갠다 (정점 컬러 굽기용).
export function boxGeometry(w, h, d, offset = null, span = 0) {
  const g = new THREE.BoxGeometry(w, h, d, segs(w, span), segs(h, span), segs(d, span));
  if (offset) g.translate(offset[0], offset[1], offset[2]);
  return g;
}

// 텍스처가 미터 단위로 타일링되는 박스.
//
// BoxGeometry 의 UV는 면마다 0..1 이다. 그대로 쓰면 13m 벽에도 텍스처가 딱 한 장
// 늘어나 콘크리트가 벽지처럼 보인다. 면의 실제 크기로 UV를 늘려서 tile 미터마다
// 텍스처가 한 번 반복되게 만든다.
//
// 이걸 material 쪽 texture.repeat 으로 하면 크기가 다른 박스마다 머티리얼을
// 복제해야 하고, glTF 로 나갈 때 KHR_texture_transform 확장이 붙는다.
export function metricBox(w, h, d, offset = null, tile = 0, span = 0) {
  const sw = segs(w, span);
  const sh = segs(h, span);
  const sd = segs(d, span);
  const g = new THREE.BoxGeometry(w, h, d, sw, sh, sd);

  if (tile > 0) {
    const uv = g.attributes.uv;
    // BoxGeometry 면 순서: +X, -X, +Y, -Y, +Z, -Z.
    // UV 는 분할과 무관하게 면마다 0..1 이므로 면 전체를 같은 배율로 늘리면
    // 된다. 다만 **면당 정점 수가 분할에 따라 달라진다** — 분할이 1이면
    // (1+1)^2 = 4 라 예전 코드와 정확히 같다.
    const faces = [
      [d, h, (sd + 1) * (sh + 1)],
      [d, h, (sd + 1) * (sh + 1)],
      [w, d, (sw + 1) * (sd + 1)],
      [w, d, (sw + 1) * (sd + 1)],
      [w, h, (sw + 1) * (sh + 1)],
      [w, h, (sw + 1) * (sh + 1)],
    ];
    let i = 0;
    for (const [su, sv, n] of faces) {
      for (let k = 0; k < n; k++, i++) {
        uv.setXY(i, (uv.getX(i) * su) / tile, (uv.getY(i) * sv) / tile);
      }
    }
    uv.needsUpdate = true;
  }

  if (offset) g.translate(offset[0], offset[1], offset[2]);
  return g;
}

// UV를 지오메트리에 직접 곱한다. 텍스처 반복을 material 쪽(texture.repeat)이
// 아니라 정점에 굽는 용도.
//
// texture.repeat 은 glTF 로 나갈 때 KHR_texture_transform 확장이 된다. 표준
// 확장이지만 FBX 왕복까지 살아남는지는 임포터에 달렸고, 무엇보다 반복 수가 다른
// 조각마다 머티리얼을 복제해야 한다. UV에 구우면 조각이 몇 개든 머티리얼 하나를
// 공유하고, 확장도 필요 없다 — UV는 지오메트리라 어느 포맷에서도 그대로 간다.
export function scaleUV(geo, sx, sy) {
  const uv = geo.attributes.uv;
  if (!uv) return geo;
  for (let i = 0; i < uv.count; i++) {
    uv.setXY(i, uv.getX(i) * sx, uv.getY(i) * sy);
  }
  uv.needsUpdate = true;
  return geo;
}

// ── 병합 ───────────────────────────────────────────────────────────────────

// 여러 지오메트리를 하나로 합친다. 각 조각은 미리 최종 위치로 변환돼 있어야 한다.
// materials 배열이 함께 오면 머티리얼별로 그룹(서브메시)을 만든다.
// extra: 정점당 추가로 붙일 속성 {name, itemSize, valueFor(partIndex)} 목록
export function mergeParts(parts, { extras = [] } = {}) {
  // 머티리얼별로 묶어야 그룹이 연속 구간이 된다
  const mats = [];
  for (const p of parts) {
    if (!mats.includes(p.material)) mats.push(p.material);
  }
  const ordered = [];
  for (let m = 0; m < mats.length; m++) {
    for (const p of parts) if (p.material === mats[m]) ordered.push({ ...p, group: m });
  }

  let vTotal = 0;
  let iTotal = 0;
  for (const p of ordered) {
    vTotal += p.geometry.attributes.position.count;
    iTotal += p.geometry.index
      ? p.geometry.index.count
      : p.geometry.attributes.position.count;
  }

  const pos = new Float32Array(vTotal * 3);
  const nor = new Float32Array(vTotal * 3);
  const uv = new Float32Array(vTotal * 2);
  const idx = new Uint32Array(iTotal);
  const extraArrays = extras.map(
    (e) => new Float32Array(vTotal * e.itemSize)
  );

  const groups = [];
  let vo = 0;
  let io = 0;
  let curGroup = -1;
  let groupStart = 0;

  ordered.forEach((p, partIndex) => {
    if (p.group !== curGroup) {
      if (curGroup >= 0) groups.push({ start: groupStart, count: io - groupStart, material: curGroup });
      curGroup = p.group;
      groupStart = io;
    }

    const g = p.geometry;
    const gp = g.attributes.position;
    const gn = g.attributes.normal;
    const gu = g.attributes.uv;
    const n = gp.count;

    pos.set(gp.array.subarray(0, n * 3), vo * 3);
    if (gn) nor.set(gn.array.subarray(0, n * 3), vo * 3);
    if (gu) uv.set(gu.array.subarray(0, n * 2), vo * 2);

    extras.forEach((e, ei) => {
      const val = e.valueFor(p, partIndex);
      const size = e.itemSize;
      for (let i = 0; i < n; i++) {
        for (let c = 0; c < size; c++) extraArrays[ei][(vo + i) * size + c] = val[c];
      }
    });

    if (g.index) {
      for (let i = 0; i < g.index.count; i++) idx[io + i] = g.index.getX(i) + vo;
      io += g.index.count;
    } else {
      for (let i = 0; i < n; i++) idx[io + i] = vo + i;
      io += n;
    }
    vo += n;
  });
  groups.push({ start: groupStart, count: io - groupStart, material: curGroup });

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  extras.forEach((e, ei) => {
    geo.setAttribute(e.name, new THREE.BufferAttribute(extraArrays[ei], e.itemSize));
  });
  geo.setIndex(new THREE.BufferAttribute(idx, 1));
  for (const g of groups) geo.addGroup(g.start, g.count, g.material);
  geo.computeBoundingSphere();

  return { geometry: geo, materials: mats };
}

// 같은 재질의 지오메트리 몇 개를 하나로 잇는다 (머티리얼 그룹 없음).
//
// mergeParts 와 다른 점: 그룹을 만들지 않는다. InstancedMesh 는 단일 머티리얼만
// 받으므로 부위를 합칠 때 그룹이 있으면 안 된다. 지상 교통의 차체·캐빈처럼
// "한 재질인데 조각이 여럿" 인 경우에 쓴다.
export function mergeGeometries(geos) {
  let vTotal = 0;
  let iTotal = 0;
  for (const g of geos) {
    vTotal += g.attributes.position.count;
    iTotal += g.index ? g.index.count : g.attributes.position.count;
  }
  const pos = new Float32Array(vTotal * 3);
  const nor = new Float32Array(vTotal * 3);
  const uv = new Float32Array(vTotal * 2);
  const idx = new Uint32Array(iTotal);
  let vo = 0;
  let io = 0;

  for (const g of geos) {
    const n = g.attributes.position.count;
    pos.set(g.attributes.position.array.subarray(0, n * 3), vo * 3);
    if (g.attributes.normal) nor.set(g.attributes.normal.array.subarray(0, n * 3), vo * 3);
    if (g.attributes.uv) uv.set(g.attributes.uv.array.subarray(0, n * 2), vo * 2);
    if (g.index) {
      for (let i = 0; i < g.index.count; i++) idx[io + i] = g.index.getX(i) + vo;
      io += g.index.count;
    } else {
      for (let i = 0; i < n; i++) idx[io + i] = vo + i;
      io += n;
    }
    vo += n;
  }

  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  out.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  out.setIndex(new THREE.BufferAttribute(idx, 1));
  out.computeBoundingSphere();
  return out;
}

// ── 인스턴싱 굽기 (정적 메시용) ────────────────────────────────────────────

// InstancedMesh를 실제 정점으로 굽는다.
// glTF로 내보낼 때 EXT_mesh_gpu_instancing은 개체별 색(instanceColor)을 잃고
// 임포터 지원도 갈리므로, 익스포트 시점에 굽는 편이 안전하다.
export function bakeInstances(inst, limit = Infinity) {
  const src = inst.geometry;
  const srcPos = src.attributes.position;
  const srcNor = src.attributes.normal;
  const srcUv = src.attributes.uv;
  const srcIdx = src.index;

  const vCount = srcPos.count;
  const iCount = srcIdx ? srcIdx.count : 0;
  const n = Math.min(inst.count, limit);

  const pos = new Float32Array(vCount * n * 3);
  const nor = new Float32Array(vCount * n * 3);
  const uv = srcUv ? new Float32Array(vCount * n * 2) : null;
  const col = new Float32Array(vCount * n * 3);
  const idx = new Uint32Array(iCount * n);

  const m = new THREE.Matrix4();
  const nm = new THREE.Matrix3();
  const v = new THREE.Vector3();
  const c = new THREE.Color();

  for (let k = 0; k < n; k++) {
    inst.getMatrixAt(k, m);
    nm.getNormalMatrix(m);
    if (inst.instanceColor) inst.getColorAt(k, c);
    else c.setRGB(1, 1, 1);

    const vo = k * vCount;
    for (let i = 0; i < vCount; i++) {
      v.fromBufferAttribute(srcPos, i).applyMatrix4(m);
      pos[(vo + i) * 3] = v.x;
      pos[(vo + i) * 3 + 1] = v.y;
      pos[(vo + i) * 3 + 2] = v.z;

      v.fromBufferAttribute(srcNor, i).applyMatrix3(nm).normalize();
      nor[(vo + i) * 3] = v.x;
      nor[(vo + i) * 3 + 1] = v.y;
      nor[(vo + i) * 3 + 2] = v.z;

      if (uv) {
        uv[(vo + i) * 2] = srcUv.getX(i);
        uv[(vo + i) * 2 + 1] = srcUv.getY(i);
      }

      col[(vo + i) * 3] = c.r;
      col[(vo + i) * 3 + 1] = c.g;
      col[(vo + i) * 3 + 2] = c.b;
    }

    const io = k * iCount;
    for (let i = 0; i < iCount; i++) idx[io + i] = srcIdx.getX(i) + vo;
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  if (uv) geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.setIndex(new THREE.BufferAttribute(idx, 1));
  geo.computeBoundingSphere();

  // 원본 머티리얼을 물려받는다 (잡초는 DoubleSide/0.86, 잡석은 FrontSide/0.95)
  const mat = inst.material.clone();
  mat.vertexColors = true;
  if (mat.color) mat.color.setRGB(1, 1, 1);

  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = `${inst.name || 'instanced'}_baked_${n}`;
  return mesh;
}

// 하위의 모든 InstancedMesh를 구운 Mesh로 임시 교체한다.
// 반환값을 호출하면 원상복구된다 (씬은 계속 인스턴싱으로 돌아야 하므로).
export function bakeInstancedDescendants(root) {
  const targets = [];
  root.traverse((o) => {
    if (o.isInstancedMesh) targets.push(o);
  });
  if (targets.length === 0) return null;

  const created = [];
  for (const inst of targets) {
    const baked = bakeInstances(inst);
    baked.position.copy(inst.position);
    baked.quaternion.copy(inst.quaternion);
    baked.scale.copy(inst.scale);
    baked.castShadow = inst.castShadow;
    baked.receiveShadow = inst.receiveShadow;
    inst.parent.add(baked);
    inst.visible = false; // onlyVisible:true 이므로 익스포트에서 제외된다
    created.push({ inst, baked });
  }

  return () => {
    for (const { inst, baked } of created) {
      baked.parent.remove(baked);
      baked.geometry.dispose();
      baked.material.dispose();
      inst.visible = true;
    }
  };
}

// ── 텍스처 반복을 UV로 굽기 ─────────────────────────────────────────────────
//
// `texture.repeat` 은 브라우저에서는 완벽하게 동작하지만, glTF 로 내보내면
// **KHR_texture_transform** 확장이 된다. 그 확장을 못 읽는 임포터는 변환을
// 통째로 무시하므로, 14번 반복돼야 할 벽돌이 엔진에서는 딱 한 장 늘어난 채로
// 나온다. 브라우저와 엔진이 같아 보여야 한다는 것이 이 파이프라인의 1순위라
// 그냥 두면 안 된다.
//
// 셰이더가 하는 계산은 `uv * repeat + offset` 이다. offset 이 0 이면 UV 에 미리
// 곱해 두고 repeat 을 1 로 되돌리는 것으로 **완전히 동일한 결과**가 나온다.
// 밉맵·비등방 필터링도 UV의 미분이 같으므로 그대로다.
//
// 도시 씬은 처음부터 scaleUV/metricBox 로 UV를 구워서 이 문제가 없었지만,
// 공터 씬은 22개 재질이 repeat 을 쓰고 있었고 8개 오브젝트 중 5개가 실제로
// 확장을 내보내고 있었다. 규칙으로 지키게 하는 대신 여기서 구조적으로 막는다.
//
// ── 안전 조건 ──────────────────────────────────────────────────────────────
// 아래 넷 중 하나라도 어긋나면 UV 하나로는 표현할 수 없으므로 예외를 던진다.
// 조용히 건너뛰면 "확장이 없어졌다" 고 믿는 채로 화면만 깨진다.
//
//   1. offset 이 0 이어야 한다        — 아니면 UV 평행이동까지 필요
//   2. rotation 이 0 이어야 한다      — 아니면 UV 회전까지 필요
//   3. 한 재질 안의 맵들이 같은 반복  — 아니면 UV 채널이 둘 필요
//   4. 공유 지오메트리가 한 배율만    — 아니면 지오메트리를 복제해야 한다
const REPEAT_MAPS = ['map', 'roughnessMap', 'normalMap', 'emissiveMap', 'alphaMap', 'aoMap'];

export function bakeTextureRepeat(root) {
  const need = new Map(); // geometry.uuid -> { geo, sx, sy }
  const textures = new Set();

  root.traverse((o) => {
    if (!o.isMesh) return;
    for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
      if (!m) continue;

      // 이 재질이 요구하는 배율을 모은다
      let sx = null;
      let sy = null;
      for (const k of REPEAT_MAPS) {
        const t = m[k];
        if (!t) continue;
        if (t.offset.x !== 0 || t.offset.y !== 0) {
          throw new Error(`bakeTextureRepeat: ${m.name || '이름없음'}.${k} 에 offset 이 있다 — UV로 구울 수 없다`);
        }
        if (t.rotation !== 0) {
          throw new Error(`bakeTextureRepeat: ${m.name || '이름없음'}.${k} 에 rotation 이 있다 — UV로 구울 수 없다`);
        }
        if (sx !== null && (t.repeat.x !== sx || t.repeat.y !== sy)) {
          throw new Error(`bakeTextureRepeat: ${m.name || '이름없음'} 의 맵마다 반복이 다르다`);
        }
        sx = t.repeat.x;
        sy = t.repeat.y;
        textures.add(t);
      }
      if (sx === null || (sx === 1 && sy === 1)) continue;

      const prev = need.get(o.geometry.uuid);
      if (prev && (prev.sx !== sx || prev.sy !== sy)) {
        throw new Error(
          `bakeTextureRepeat: 지오메트리 하나가 배율 ${prev.sx},${prev.sy} 와 ${sx},${sy} 를 동시에 요구한다`
        );
      }
      need.set(o.geometry.uuid, { geo: o.geometry, sx, sy });
    }
  });

  // 지오메트리 단위로 한 번씩만 곱한다 (318개 메시가 32개 지오메트리를 공유한다)
  for (const { geo, sx, sy } of need.values()) scaleUV(geo, sx, sy);

  // UV 에 실렸으니 텍스처 쪽 반복은 되돌린다. 순서가 중요하다 — 먼저 되돌리면
  // 위 루프가 배율 1을 읽어 아무것도 안 곱한다.
  let reset = 0;
  for (const t of textures) {
    if (t.repeat.x === 1 && t.repeat.y === 1) continue;
    t.repeat.set(1, 1);
    t.needsUpdate = true;
    reset++;
  }
  return { geometries: need.size, textures: reset };
}
