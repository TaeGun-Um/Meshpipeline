// 간판 — 가로 배너 · 세로 간판 · 대형 광고판.
//
// towers.js 는 간판을 직접 만들지 않고 "여기에 이런 간판" 요청 목록만 남긴다.
// 여기서 한 번에 만드는 이유는 간판이 배색 조합당 텍스처 한 장을 공유해야 하기
// 때문이다. 요청마다 굽으면 수백 장이 된다.
//
// 세 종류 모두 같은 구조다: 발광 앞면 + 어두운 뒷판 + 벽 브래킷.
// 뒷판이 없으면 뒤에서 봤을 때 발광면이 그대로 보여 종이 조각처럼 얇아 보인다.
import * as THREE from 'three';
import { MeshBuilder } from '../../core/builder.js';
import { outward, faceAnchor, alongZ } from '../../core/boxfaces.js';
import { SIGN_SCHEMES, rgb01 } from '../../shared/neon.js';

const STANDOFF = 0.3;

// 간판이 붙는 면의 좌표 틀
function frameOf(req) {
  const a = faceAnchor(req.rect, req.side);
  const o = outward(req.side);
  const az = alongZ(req.side);
  return {
    x: a.x,
    z: a.z,
    ox: o.ox,
    oz: o.oz,
    // 간판 폭이 뻗는 축
    widthOnZ: az,
    // 벽면과 평행한 평면의 Y 회전
    yaw: req.side === 'px' ? Math.PI / 2 : req.side === 'nx' ? -Math.PI / 2 : req.side === 'pz' ? 0 : Math.PI,
  };
}

// 벽에 평행하게 붙는 발광 판 (배너 · 광고판)
function flatSign(b, req, mats) {
  const f = frameOf(req);
  const mat = mats.signMats[req.kind][req.scheme];
  const cy = req.y + req.h / 2;

  const front = new THREE.PlaneGeometry(req.w, req.h);
  front.rotateY(f.yaw);
  front.translate(f.x + f.ox * (STANDOFF + 0.06), cy, f.z + f.oz * (STANDOFF + 0.06));
  b.add(front, mat);

  // 뒷판 (두께)
  b.box(
    f.widthOnZ ? STANDOFF : req.w,
    req.h,
    f.widthOnZ ? req.w : STANDOFF,
    [f.x + f.ox * (STANDOFF / 2), cy, f.z + f.oz * (STANDOFF / 2)],
    mats.frameMat
  );
}

// 벽에서 직각으로 튀어나오는 세로 간판. 양면 발광.
//
// 거리의 깊이를 만드는 것이 이 형태다 — 벽에 붙은 판은 정면에서만 보이지만,
// 튀어나온 간판은 측면에서도 줄줄이 보여 거리에 리듬이 생긴다.
function bladeSign(b, req, mats) {
  const f = frameOf(req);
  const mat = mats.signMats.blade[req.scheme];
  const out = req.w; // 벽에서 튀어나오는 길이 = 간판 폭
  const cx = f.x + f.ox * (out / 2 + 0.15);
  const cz = f.z + f.oz * (out / 2 + 0.15);
  const cy = req.y + req.h / 2;

  // 양면 — 벽에 수직이므로 앞면 법선이 벽 방향에서 90도 돌아간다
  for (const s of [-1, 1]) {
    const g = new THREE.PlaneGeometry(out, req.h);
    g.rotateY(f.yaw + s * (Math.PI / 2));
    g.translate(cx + (f.widthOnZ ? 0 : s * 0.07), cy, cz + (f.widthOnZ ? s * 0.07 : 0));
    b.add(g, mat);
  }

  // 심재 (두께)
  b.box(f.ox ? out : 0.12, req.h, f.oz ? out : 0.12, [cx, cy, cz], mats.frameMat);

  // 벽 브래킷 둘
  for (const t of [0.2, 0.8]) {
    b.box(
      f.ox ? 0.3 : 0.06,
      0.06,
      f.oz ? 0.3 : 0.06,
      [f.x + f.ox * 0.15, req.y + req.h * t, f.z + f.oz * 0.15],
      mats.metalMat
    );
  }
}

// 간판이 주변을 물들이는 자리. 발광 표면은 실제로 아무것도 밝히지 않으므로
// (shared/lightpool.js 주석 참고) 벽과 바닥에 가산합성 웅덩이를 직접 깔아 준다.
// 간판보다 넓게, 훨씬 어둡게 — 이게 없으면 간판만 공중에 떠 있다.
function signPools(pools, req) {
  const f = frameOf(req);
  const scheme = SIGN_SCHEMES[req.scheme];
  const blade = req.kind === 'blade';

  // 벽 얼룩
  pools.push({
    kind: 'wall',
    x: f.x + f.ox * 0.12,
    y: req.y + req.h / 2,
    z: f.z + f.oz * 0.12,
    w: req.w * (blade ? 5.0 : 2.1),
    h: req.h * (blade ? 1.3 : 2.2),
    yaw: f.yaw,
    tint: rgb01(scheme.glyph, 0.55),
  });

  // 낮은 간판만 바닥을 물들인다. 80m 위 광고판이 노면을 비추지는 않는다.
  if (req.y < 22) {
    pools.push({
      kind: 'floor',
      x: f.x + f.ox * 3.2,
      y: 0.22,
      z: f.z + f.oz * 3.2,
      rx: f.widthOnZ ? 4.6 : req.w * 1.1,
      rz: f.widthOnZ ? req.w * 1.1 : 4.6,
      tint: rgb01(scheme.glyph, 0.4),
    });
  }
}

export function createSignage(scene, signs, mats) {
  // 간판은 그림자를 받지 않는다 — 발광면에 그림자가 지면 형광등에 그늘이 진
  // 꼴이라 어색하고, 그림자맵 예산도 아깝다.
  const b = new MeshBuilder('Signage', { castShadow: false, receiveShadow: false });
  const pools = [];

  let i = 0;
  for (const req of signs) {
    // 간판마다 표시를 건다. 검사가 보는 것은 "이 간판이 건물에 붙어 있나" 다 —
    // 벽감 깊이를 빼먹어 세로 간판이 허공에 1.3m 떠 있던 적이 있다.
    b.mark('sign', `sign#${i++}`, { kind: req.kind, side: req.side });
    if (req.kind === 'blade') bladeSign(b, req, mats);
    else flatSign(b, req, mats);
    signPools(pools, req);
  }

  return { group: b.build(scene), pools, count: signs.length };
}
