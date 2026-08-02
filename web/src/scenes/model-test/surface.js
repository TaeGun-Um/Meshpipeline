// 형태를 만드는 도구 — 로프트와 스윕.
//
// ── 왜 상자가 아닌가 ───────────────────────────────────────────────────────
// 도시는 상자로 지었다. 사람은 안 된다. 몸통·팔다리·머리·머리카락은 전부
// "단면이 높이를 따라 변하는 관" 이고, 그것 하나만 있으면 거의 다 만든다.
//
// 그래서 여기 둘만 둔다.
//   loft(rings)        수평 단면을 높이 순으로 쌓는다 (몸통·머리·부츠·치마)
//   sweep(path, cross) 경로를 따라 단면을 밀어낸다 (머리카락 가닥·끈·테두리)
//
// 단면은 초타원(superellipse)이다 — k=2 면 타원, k 를 올리면 모서리가 살아나
// 사각에 가까워진다. 애니 캐릭터의 몸은 대개 k 2~3 사이에 있다.
import * as THREE from 'three';

// ── 단면 ───────────────────────────────────────────────────────────────────

// 초타원 위의 점. u 는 0..1 (한 바퀴).
// w 가 X 반경, d 가 Z 반경.
export function superPoint(u, w, d, k = 2) {
  const a = u * Math.PI * 2;
  const c = Math.cos(a);
  const s = Math.sin(a);
  const e = 2 / k;
  return [Math.sign(c) * Math.abs(c) ** e * w, Math.sign(s) * Math.abs(s) ** e * d];
}

// ── 로프트 ─────────────────────────────────────────────────────────────────
//
// rings  [{ y, w, d, k?, cx?, cz? }] — 아래에서 위로. y 는 반드시 증가.
// seg    한 바퀴를 몇 등분할지
// opt.deform(x, y, z, u, i) -> [x,y,z]   단면을 쌓은 뒤 한 번 더 주무른다.
//        얼굴 앞면을 눌러 평평하게 만드는 것 같은 일이 여기서 일어난다.
// opt.capTop / capBottom  뚜껑을 덮을지 (기본 덮음)
export function loft(rings, seg = 24, opt = {}) {
  const { deform = null, capTop = true, capBottom = true } = opt;
  const R = rings.length;
  const pos = [];
  const uv = [];
  const idx = [];

  const at = (i, u) => {
    const r = rings[i];
    let [x, z] = superPoint(u, r.w, r.d, r.k ?? 2);
    x += r.cx ?? 0;
    z += r.cz ?? 0;
    let y = r.y;
    if (deform) [x, y, z] = deform(x, y, z, u, i);
    return [x, y, z];
  };

  // 옆면
  for (let i = 0; i < R; i++) {
    for (let j = 0; j <= seg; j++) {
      const u = j / seg;
      const [x, y, z] = at(i, u % 1);
      pos.push(x, y, z);
      uv.push(u, i / (R - 1));
    }
  }
  const row = seg + 1;
  for (let i = 0; i < R - 1; i++) {
    for (let j = 0; j < seg; j++) {
      const a = i * row + j;
      const b = a + 1;
      const c = a + row;
      const d = c + 1;
      idx.push(a, c, b, b, c, d);
    }
  }

  // 뚜껑 — 링 중심으로 부채꼴
  const cap = (i, up) => {
    const r = rings[i];
    const base = pos.length / 3;
    let cy = r.y;
    let cx = r.cx ?? 0;
    let cz = r.cz ?? 0;
    if (deform) [cx, cy, cz] = deform(cx, cy, cz, 0, i);
    pos.push(cx, cy, cz);
    uv.push(0.5, 0.5);
    for (let j = 0; j <= seg; j++) {
      const [x, y, z] = at(i, (j / seg) % 1);
      pos.push(x, y, z);
      uv.push(0.5 + Math.cos((j / seg) * Math.PI * 2) * 0.5, 0.5 + Math.sin((j / seg) * Math.PI * 2) * 0.5);
    }
    for (let j = 0; j < seg; j++) {
      const a = base + 1 + j;
      const b = base + 1 + j + 1;
      if (up) idx.push(base, a, b);
      else idx.push(base, b, a);
    }
  };
  if (capBottom) cap(0, false);
  if (capTop) cap(R - 1, true);

  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

// 링을 몇 개의 조종점에서 부드럽게 뽑아낸다.
//
//   keys  [[y, w, d, k?], ...]  — 몇 개만 적는다
//   n     실제로 만들 링 수
//
// 손으로 링 20개를 적으면 값 하나 고칠 때마다 이웃을 같이 고쳐야 한다.
// 조종점 다섯이면 실루엣을 그 다섯으로 말할 수 있다.
export function ringsFrom(keys, n) {
  // **반드시 y 오름차순으로 정렬한다.** 구간을 찾는 while 문이 오름차순을
  // 전제하는데, 팔·다리는 관절에서 아래로 내려가며 적는 편이 자연스러워
  // 내림차순으로 들어온다. 정렬을 안 하면 마지막 구간으로 외삽해서
  // 폭이 폭주한다 — 실제로 팔이 2m 짜리 널빤지가 되어 바닥까지 뻗었다.
  keys = [...keys].sort((a, b) => a[0] - b[0]);
  const out = [];
  const y0 = keys[0][0];
  const y1 = keys[keys.length - 1][0];
  for (let i = 0; i < n; i++) {
    const y = y0 + ((y1 - y0) * i) / (n - 1);
    // y 가 든 구간을 찾아 3차 에르미트로 보간 (기울기는 이웃 차분)
    let s = 0;
    while (s < keys.length - 2 && keys[s + 1][0] < y) s++;
    const A = keys[s];
    const B = keys[s + 1];
    const t = B[0] === A[0] ? 0 : (y - A[0]) / (B[0] - A[0]);
    const P = keys[Math.max(0, s - 1)];
    const Q = keys[Math.min(keys.length - 1, s + 2)];
    const h = (a, b, p, q) => {
      const m0 = (b - p) * 0.5;
      const m1 = (q - a) * 0.5;
      const t2 = t * t;
      const t3 = t2 * t;
      return (
        (2 * t3 - 3 * t2 + 1) * a + (t3 - 2 * t2 + t) * m0 + (-2 * t3 + 3 * t2) * b + (t3 - t2) * m1
      );
    };
    out.push({
      y,
      w: Math.max(1e-4, h(A[1], B[1], P[1], Q[1])),
      d: Math.max(1e-4, h(A[2], B[2], P[2], Q[2])),
      k: h(A[3] ?? 2, B[3] ?? 2, P[3] ?? 2, Q[3] ?? 2),
    });
  }
  return out;
}

// 조종점 표에서 임의 높이의 단면을 뽑는다.
//
// 껍질(스타킹·상의)은 **속에 든 것과 같은 곡선**이어야 한다. 각자 자기 표를
// 들고 있으면 한쪽만 고쳤을 때 무릎이 스타킹을 뚫고 나온다 — 실제로 났다.
export function sampleKeys(keys, y) {
  const k = [...keys].sort((a, b) => a[0] - b[0]);
  if (y <= k[0][0]) return { w: k[0][1], d: k[0][2], k: k[0][3] ?? 2 };
  const last = k[k.length - 1];
  if (y >= last[0]) return { w: last[1], d: last[2], k: last[3] ?? 2 };
  let i = 0;
  while (i < k.length - 2 && k[i + 1][0] < y) i++;
  const A = k[i];
  const B = k[i + 1];
  const t = (y - A[0]) / (B[0] - A[0]);
  return {
    w: A[1] + (B[1] - A[1]) * t,
    d: A[2] + (B[2] - A[2]) * t,
    k: (A[3] ?? 2) + ((B[3] ?? 2) - (A[3] ?? 2)) * t,
  };
}

// ── 경로 스윕ㅤ─────────────────────────────────────────────────────────────
//
// path   THREE.Vector3 목록
// cross(t) -> { rx, ry, rot }   경로 위치 t(0..1) 에서의 단면
// seg    단면 분할 수
//
// 프레임은 평행 이동(parallel transport)으로 만든다. Frenet 프레임은 곡률이
// 0 인 구간에서 법선이 튀어 머리카락이 꼬인다.
export function sweep(path, cross, seg = 8, closeEnds = true) {
  const N = path.length;
  const tangents = [];
  for (let i = 0; i < N; i++) {
    const a = path[Math.max(0, i - 1)];
    const b = path[Math.min(N - 1, i + 1)];
    tangents.push(b.clone().sub(a).normalize());
  }

  // 시작 법선 — 접선과 가장 안 나란한 축에서 뽑는다
  let up = new THREE.Vector3(0, 0, 1);
  if (Math.abs(tangents[0].dot(up)) > 0.9) up = new THREE.Vector3(1, 0, 0);
  let nrm = up.clone().sub(tangents[0].clone().multiplyScalar(up.dot(tangents[0]))).normalize();

  const pos = [];
  const uv = [];
  const idx = [];
  const q = new THREE.Quaternion();

  for (let i = 0; i < N; i++) {
    if (i > 0) {
      q.setFromUnitVectors(tangents[i - 1], tangents[i]);
      nrm.applyQuaternion(q).normalize();
    }
    const bin = new THREE.Vector3().crossVectors(tangents[i], nrm).normalize();
    const t = i / (N - 1);
    const c = cross(t);
    const rot = c.rot ?? 0;
    for (let j = 0; j <= seg; j++) {
      const a = (j / seg) * Math.PI * 2 + rot;
      const x = Math.cos(a) * (c.rx ?? 0.02);
      const y = Math.sin(a) * (c.ry ?? c.rx ?? 0.02);
      pos.push(
        path[i].x + nrm.x * x + bin.x * y,
        path[i].y + nrm.y * x + bin.y * y,
        path[i].z + nrm.z * x + bin.z * y
      );
      uv.push(j / seg, t);
    }
  }
  const row = seg + 1;
  for (let i = 0; i < N - 1; i++) {
    for (let j = 0; j < seg; j++) {
      const a = i * row + j;
      const b = a + 1;
      const c = a + row;
      const d = c + 1;
      idx.push(a, c, b, b, c, d);
    }
  }

  if (closeEnds) {
    for (const [ri, up2] of [
      [0, false],
      [N - 1, true],
    ]) {
      const base = pos.length / 3;
      pos.push(path[ri].x, path[ri].y, path[ri].z);
      uv.push(0.5, 0.5);
      for (let j = 0; j <= seg; j++) {
        const s = (ri * row + j) * 3;
        pos.push(pos[s], pos[s + 1], pos[s + 2]);
        uv.push(0.5, 0.5);
      }
      for (let j = 0; j < seg; j++) {
        const a = base + 1 + j;
        const b = a + 1;
        if (up2) idx.push(base, a, b);
        else idx.push(base, b, a);
      }
    }
  }

  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

// 조종점 몇 개를 지나는 부드러운 경로 (Catmull-Rom).
export function pathFrom(keys, n) {
  const c = new THREE.CatmullRomCurve3(keys.map((k) => new THREE.Vector3(...k)));
  return c.getPoints(n - 1);
}

// X 로 뒤집은 사본. 감는 방향이 뒤집히므로 인덱스도 뒤집는다.
export function mirrorX(geo) {
  const g = geo.clone();
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) p.setX(i, -p.getX(i));
  const ix = g.index.array;
  for (let i = 0; i < ix.length; i += 3) {
    const t = ix[i + 1];
    ix[i + 1] = ix[i + 2];
    ix[i + 2] = t;
  }
  g.index.needsUpdate = true;
  p.needsUpdate = true;
  g.computeVertexNormals();
  return g;
}
