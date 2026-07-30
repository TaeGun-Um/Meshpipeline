// 곡면·모따기 프리미티브.
//
// ── 왜 필요한가 ────────────────────────────────────────────────────────────
// 박스만으로 만든 씬이 "네모네모" 하게 보이는 이유는 두 가지고, 둘은 다른 문제다.
//
//   1) 모서리가 수학적으로 완벽하게 날카롭다.
//      실제 물건에 그런 모서리는 없다. 주조·압출·마모 때문에 항상 몇 mm 의
//      모따기가 있고, 그 좁은 면이 빛을 따로 받아 **모서리 하이라이트**를 만든다.
//      이 하이라이트가 없으면 아무리 텍스처를 잘 만들어도 CG 상자로 읽힌다.
//      모따기 하나로 삼각형이 12개에서 44개가 되지만, 근경 물체에서는 그만한 값을 한다.
//
//   2) 형태 자체에 회전체·곡선이 없다.
//      가로등 갓, 물탱크, 배관, 굴뚝, 난간은 전부 선반(旋盤)으로 깎거나 경로를 따라
//      밀어낸 형상이다. 박스로 흉내내면 실루엣에서 바로 티가 난다.
//
// 그래서 여기에는 모따기 박스 · 회전체 · 경로 스윕 셋을 둔다.
//
// ── 파이프라인 영향 ────────────────────────────────────────────────────────
// 없다. glTF·FBX 는 삼각형 목록이면 무엇이든 싣고, mergeParts 도 임의 지오메트리를
// 받는다. 공터 씬이 이미 토러스·압출·튜브를 써서 유니티까지 통과시켰다.
// 비용은 삼각형 수와 빌드 시간뿐이다.
import * as THREE from 'three';
import { ConvexGeometry } from 'three/addons/geometries/ConvexGeometry.js';

// ── 모따기 박스 ────────────────────────────────────────────────────────────
//
// 모따기 박스는 **정의상 24개 점의 볼록 껍질**이다. 각 꼭짓점 (±a,±b,±c) 에서
// 한 축씩 t 만큼 당긴 점 셋이 24개가 되고, 그 껍질이 곧 주면 6 + 모서리 띠 12 +
// 꼭짓점 삼각형 8 = 삼각형 44개다.
//
// 처음에는 이 44개를 손으로 만들었는데, 모서리 띠의 인접 표를 손으로 유도하다가
// 주면 둘과 띠 여섯의 감는 방향을 틀렸다 (렌더하면 그 면들이 안 보인다).
// 껍질로 만들면 위상과 감는 방향을 계산이 보장한다.
//
//   t   면이 안쪽으로 들어가는 양. 실제 모따기 면의 폭은 t·√2 다.
//   tile 텍스처가 반복되는 간격(m). 0이면 UV 0..1.
// autoBox 를 통해 쓴다 — 크기 판단 없이 직접 부르면 잔물건에 3.7배 비용이 든다
function chamferBox(w, h, d, at = null, t = 0.02, tile = 0) {
  const a = w / 2;
  const b = h / 2;
  const c = d / 2;
  // 모따기가 변의 절반을 넘으면 형상이 무너진다
  const k = Math.min(t, a * 0.49, b * 0.49, c * 0.49);

  const pts = [];
  for (const sx of [1, -1]) {
    for (const sy of [1, -1]) {
      for (const sz of [1, -1]) {
        pts.push(new THREE.Vector3(sx * (a - k), sy * b, sz * c));
        pts.push(new THREE.Vector3(sx * a, sy * (b - k), sz * c));
        pts.push(new THREE.Vector3(sx * a, sy * b, sz * (c - k)));
      }
    }
  }

  const g = new ConvexGeometry(pts);
  planarUV(g, tile);
  if (at) g.translate(at[0], at[1], at[2]);
  return g;
}

// 크기를 보고 모따기 여부를 스스로 정하는 박스.
//
// ── 왜 필요한가 ────────────────────────────────────────────────────────────
// 모따기는 삼각형이 12개에서 44개로 3.7배가 된다. 그만한 값을 하는 것은 **모따기
// 면이 화면에서 보일 때뿐**이다. 20cm 짜리 상품 상자의 2cm 모따기는 몇 미터만
// 떨어져도 1픽셀이 안 되는데 삼각형은 그대로 3.7배다.
//
// 실측: 도시 전체에 모따기 박스가 9,900개였고 그중 대부분이 상품 상자·실외기
// 같은 잔물건이었다. 건물 지오메트리의 45%가 여기 있었다.
//
// minSize 보다 작으면 그냥 박스로 만든다. 큰 물건(차체·컨테이너·기둥)만 모따기.
export function autoBox(w, h, d, at = null, t = 0.03, tile = 0, minSize = 0.55) {
  if (Math.min(w, h, d) < minSize) {
    const g = new THREE.BoxGeometry(w, h, d);
    if (at) g.translate(at[0], at[1], at[2]);
    return g;
  }
  return chamferBox(w, h, d, at, t, tile);
}

// 반지름에 맞는 분할 수를 고른다.
//
// sphere(r, 8, 6) 은 80삼각형이다. 10cm 전구를 그렇게 만들면 화면에서 몇 픽셀인
// 물체에 80삼각형을 쓴다. 매달린 전구만 534개였고 합계 43,000삼각형이었다.
export function sphereSegments(r) {
  if (r < 0.2) return [5, 3]; // 20삼각형
  if (r < 0.6) return [8, 5]; // 64
  if (r < 1.5) return [10, 7]; // 120
  return [14, 9];
}

// ConvexGeometry 는 UV를 만들지 않는다. 삼각형마다 법선의 지배 축을 골라
// 나머지 두 축을 그대로 UV로 쓴다 (평면 투영). 축 정렬 형상에서는 이게
// 주면에 정확한 미터 단위 UV를 주고, 모따기 띠에는 살짝 늘어난 UV를 준다 —
// 띠는 폭이 몇 mm 라 눈에 띄지 않는다.
function planarUV(g, tile = 0) {
  const p = g.attributes.position;
  const n = g.attributes.normal;
  const s = tile > 0 ? 1 / tile : 1;
  const uv = new Float32Array(p.count * 2);

  for (let i = 0; i < p.count; i += 3) {
    // 삼각형의 법선(세 정점이 같다)으로 지배 축을 고른다
    const nx = Math.abs(n.getX(i));
    const ny = Math.abs(n.getY(i));
    const nz = Math.abs(n.getZ(i));
    const axis = nx >= ny && nx >= nz ? 0 : ny >= nz ? 1 : 2;
    for (let j = 0; j < 3; j++) {
      const v = i + j;
      const x = p.getX(v);
      const y = p.getY(v);
      const z = p.getZ(v);
      const [u0, v0] = axis === 0 ? [z, y] : axis === 1 ? [x, z] : [x, y];
      uv[v * 2] = u0 * s;
      uv[v * 2 + 1] = v0 * s;
    }
  }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return g;
}

// ── 회전체 ─────────────────────────────────────────────────────────────────
//
// 단면(반지름, 높이) 목록을 Y축으로 돌린다. 가로등 갓, 물탱크, 굴뚝, 난간 동자,
// 플랜지 붙은 배관처럼 "선반으로 깎은" 형상 전부가 이것이다.
//
//   profile: [[반지름, 높이], ...]  아래에서 위로
//   segments: 원주 분할. 8이면 각지고 24면 매끈하다. 근경일수록 올린다.
export function lathe(profile, segments = 16, at = null) {
  const pts = profile.map(([r, y]) => new THREE.Vector2(Math.max(1e-4, r), y));
  const g = new THREE.LatheGeometry(pts, segments);
  // LatheGeometry 는 정점을 공유해 법선이 부드럽다. 각진 단면(원통+평면)에서는
  // 이음새가 번져 보이므로, 단면에 같은 높이의 점을 두 번 넣어 각을 만든다.
  if (at) g.translate(at[0], at[1], at[2]);
  return g;
}

// ── 경로 스윕 ──────────────────────────────────────────────────────────────
//
// 점 목록을 매끄러운 곡선으로 잇고 그 위로 원형 단면을 밀어낸다.
// 반지름을 함수로 주면 굵기가 변하는 배관·케이블·손잡이를 만들 수 있다
// (three 의 TubeGeometry 는 반지름이 상수라 이 경우를 못 만든다).
//
//   points:  [[x,y,z], ...]
//   radius:  숫자 또는 (t) => 숫자   t 는 0..1
export function sweep(points, radius, { steps = 24, radial = 8, closed = false, at = null } = {}) {
  const curve = new THREE.CatmullRomCurve3(
    points.map((p) => new THREE.Vector3(p[0], p[1], p[2])),
    closed
  );
  const rf = typeof radius === 'function' ? radius : () => radius;

  const frames = curve.computeFrenetFrames(steps, closed);
  const pos = [];
  const nor = [];
  const uv = [];
  const idx = [];
  const P = new THREE.Vector3();

  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    curve.getPointAt(Math.min(1, t), P);
    const N = frames.normals[Math.min(i, steps - 1)];
    const B = frames.binormals[Math.min(i, steps - 1)];
    const r = rf(t);
    for (let j = 0; j <= radial; j++) {
      const a = (j / radial) * Math.PI * 2;
      const cx = Math.cos(a);
      const sy = Math.sin(a);
      const nx = cx * N.x + sy * B.x;
      const ny = cx * N.y + sy * B.y;
      const nz = cx * N.z + sy * B.z;
      pos.push(P.x + nx * r, P.y + ny * r, P.z + nz * r);
      nor.push(nx, ny, nz);
      uv.push(j / radial, t);
    }
  }

  const ring = radial + 1;
  for (let i = 0; i < steps; i++) {
    for (let j = 0; j < radial; j++) {
      const A = i * ring + j;
      const B2 = A + ring;
      idx.push(A, B2, A + 1, A + 1, B2, B2 + 1);
    }
  }

  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  if (at) g.translate(at[0], at[1], at[2]);
  return g;
}

