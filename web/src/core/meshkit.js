// 정적/동적 메시가 같이 쓰는 지오메트리 도구.
//
// 정적 쪽은 인스턴싱을 쓰고(잡초·잡석), 동적 쪽은 스킨드 메시를 쓴다.
// 둘 다 "여러 조각을 하나의 BufferGeometry로 합친다"는 같은 문제를 풀기 때문에
// 병합 로직은 여기 모아두고, 붙는 속성만 다르게 준다.
//   - 인스턴싱: 인스턴스 행렬을 정점에 적용 + instanceColor -> COLOR_0
//   - 스키닝  : 본 rest 행렬을 정점에 적용 + skinIndex/skinWeight
import * as THREE from 'three';

// ── 프리미티브 ─────────────────────────────────────────────────────────────

// 박스. y=0을 기준으로 원하는 위치에 놓는다.
export function boxGeometry(w, h, d, offset = null) {
  const g = new THREE.BoxGeometry(w, h, d);
  if (offset) g.translate(offset[0], offset[1], offset[2]);
  return g;
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
