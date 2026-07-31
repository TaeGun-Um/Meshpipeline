// 직각 건축 도우미 — 사각형 평면 도형의 "면"을 다룬다.
//
// 건물·방·구조물은 대개 축에 정렬된 사각형이고, 거기에 붙는 것들(창문 피부, 간판,
// 셔터, 처마)은 전부 "어느 면의, 어디에, 얼마 크기로" 로 표현된다. 그 좌표 계산을
// 각 모듈이 직접 하면 부호를 틀린다 — 실제로 점포가 건물 안쪽이 아니라 골목
// 한가운데로 파고든 버그가 났다 (inner - sign*depth 를 + 로 써야 했다).
//
// 사각형은 { x0, x1, z0, z1 } 로 표현한다. y 는 따로 받는다.
// 면 이름은 법선 방향을 그대로 쓴다: 'px' = +X 를 보는 면.
import * as THREE from 'three';
import { scaleUV, metricBox } from './meshkit.js';

export const SIDES = ['px', 'nx', 'pz', 'nz'];

// 면이 바라보는 방향 (밖으로). 안쪽으로 파려면 이 부호를 **더한다**.
export function outward(side) {
  if (side === 'px') return { ox: 1, oz: 0 };
  if (side === 'nx') return { ox: -1, oz: 0 };
  if (side === 'pz') return { ox: 0, oz: 1 };
  if (side === 'nz') return { ox: 0, oz: -1 };
  throw new Error(`알 수 없는 면: ${side}`);
}

// 면이 뻗는 방향. px/nx 면은 Z축으로, pz/nz 면은 X축으로 폭을 갖는다.
export function alongZ(side) {
  return side === 'px' || side === 'nx';
}

// 면의 폭 (미터)
export function faceWidth(r, side) {
  return alongZ(side) ? r.z1 - r.z0 : r.x1 - r.x0;
}

// 면 위의 기준점 (면 중앙의 x, z)
export function faceAnchor(r, side) {
  const cx = (r.x0 + r.x1) / 2;
  const cz = (r.z0 + r.z1) / 2;
  if (side === 'px') return { x: r.x1, z: cz };
  if (side === 'nx') return { x: r.x0, z: cz };
  if (side === 'pz') return { x: cx, z: r.z1 };
  return { x: cx, z: r.z0 };
}

// 사각형을 안쪽으로 d 만큼 줄인다. 음수를 주면 늘어난다 (처마·띠).
export function shrink(r, d) {
  return { x0: r.x0 + d, x1: r.x1 - d, z0: r.z0 + d, z1: r.z1 - d };
}

export function rectCenter(r) {
  return { x: (r.x0 + r.x1) / 2, z: (r.z0 + r.z1) / 2 };
}

export function rectSize(r) {
  return { w: r.x1 - r.x0, d: r.z1 - r.z0 };
}

// 면을 n 등분한 i 번째 조각. margin 은 조각 양옆을 깎아 사이에 기둥을 남긴다.
// 폭을 좁히려면 사각형 자체를 좁힌다 — 아래 facePlane 이 사각형에서 폭을 읽으므로.
export function bayRect(r, side, i, n, margin = 0) {
  if (alongZ(side)) {
    const span = (r.z1 - r.z0) / n;
    const z0 = r.z0 + span * i + margin;
    return { x0: r.x0, x1: r.x1, z0, z1: z0 + span - margin * 2 };
  }
  const span = (r.x1 - r.x0) / n;
  const x0 = r.x0 + span * i + margin;
  return { x0, x1: x0 + span - margin * 2, z0: r.z0, z1: r.z1 };
}

// ── 평면 ───────────────────────────────────────────────────────────────────

// 사각형의 한 면에 붙는 수직 평면.
//
//   y0     평면 아래쪽 높이
//   h      높이
//   tile   [가로 미터, 세로 미터] — 주면 텍스처가 그 간격으로 반복되게 UV를 늘린다.
//          null 이면 UV 0..1 그대로 (텍스처 한 장이 면 전체를 덮는다).
//   inset  면에서 얼마나 띄울지. Z-파이팅을 피하려면 2cm 정도 내밀어야 한다.
export function facePlane(r, y0, h, side, tile = null, inset = 0.02) {
  const w = faceWidth(r, side);
  const c = rectCenter(r);
  const g = new THREE.PlaneGeometry(w, h);
  if (tile) scaleUV(g, w / tile[0], h / tile[1]);

  // 기본 평면은 +Z를 본다. Y축 회전으로 원하는 방향을 보게 한다.
  if (side === 'px') {
    g.rotateY(Math.PI / 2);
    g.translate(r.x1 + inset, y0 + h / 2, c.z);
  } else if (side === 'nx') {
    g.rotateY(-Math.PI / 2);
    g.translate(r.x0 - inset, y0 + h / 2, c.z);
  } else if (side === 'pz') {
    g.translate(c.x, y0 + h / 2, r.z1 + inset);
  } else {
    g.rotateY(Math.PI);
    g.translate(c.x, y0 + h / 2, r.z0 - inset);
  }
  return g;
}

// 아래를 보는 수평 평면 (처마 밑 조명, 천장)
export function downPlane(w, d, at) {
  const g = new THREE.PlaneGeometry(w, d);
  g.rotateX(Math.PI / 2);
  g.translate(at[0], at[1], at[2]);
  return g;
}

// 위를 보는 수평 평면 (바닥, 인도, 빛 웅덩이)
export function upPlane(w, d, at, tile = null) {
  const g = new THREE.PlaneGeometry(w, d);
  if (tile) scaleUV(g, w / tile[0], d / tile[1]);
  g.rotateX(-Math.PI / 2);
  g.translate(at[0], at[1], at[2]);
  return g;
}

// 사각형 평면 도형을 밑면으로 하고 높이 h 인 박스. 건물 덩치·띠·슬래브에 쓴다.
//
// metricBox 를 직접 부르지 않고 감싸는 이유: 호출부가 중심 좌표와 y0 + h/2 를
// 매번 손으로 계산해야 하고, 실제로 그걸 빠뜨리는 실수가 반복됐다.
export function rectBox(r, y0, h, tile = 0) {
  const c = rectCenter(r);
  const s = rectSize(r);
  return metricBox(s.w, h, s.d, [c.x, y0 + h / 2, c.z], tile);
}

// ── 면 위에 물건을 놓는 좌표계 ─────────────────────────────────────────────
//
// 면 하나를 잡고 "가로로 u, 바깥으로 d 만큼" 을 세계 좌표로 바꿔 준다.
// 축이 X 냐 Z 냐에 따라 부호와 순서가 달라지는데, 그걸 손으로 쓰면 반드시
// 어딘가 틀린다 — 이 프로젝트에서 이미 여러 번 틀렸다.
//
// corpo·factory·housing 이 **글자 하나 안 틀리고 같은 함수**를 각자 갖고
// 있었다 (코드리뷰에서 해시로 확인). 하나로 모은다.
// bazaar·retrofit·shopfront·signage 에도 같은 이름의 함수가 있지만 그쪽은
// 내용이 달라 남겨 둔다 — 이름이 같다고 같은 것이 아니다.
export function faceFrame(r, side) {
  const o = outward(side);
  const a = faceAnchor(r, side);
  const az = alongZ(side);
  return {
    w: faceWidth(r, side),
    at: (u, d) => (az ? [a.x + o.ox * d, a.z + u] : [a.x + u, a.z + o.oz * d]),
    size: (wu, wd) => (az ? [wd, wu] : [wu, wd]),
  };
}
