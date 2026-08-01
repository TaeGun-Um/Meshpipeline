// 1층 점포.
//
// ── 무엇이 문제였나 ────────────────────────────────────────────────────────
// 지금까지 점포는 **평면 한 장에 텍스처**였다. 그래서 색만 다르고 형태는 전부
// 같았다. 깊이도, 처마도, 출입구도, 밖으로 나온 물건도 없었다.
//
// 실제 상가 1층이 제각각으로 보이는 이유는 간판 색이 아니라
//   - 가게마다 파고든 깊이가 다르고
//   - 차양이 제각각이고 (천막·철판·없음)
//   - 문턱·계단·문틀이 있고
//   - 물건이 보도로 넘쳐 나오기 때문이다.
//
// ── 구조: 진짜로 판다 ──────────────────────────────────────────────────────
// 포디움 저층 띠를 안쪽으로 들여서 **연속된 벽감(alcove)** 을 만들고, 베이 경계마다
// 기둥을 세운다. 그러면 가게마다 실제 깊이 1.3m 의 공간이 생기고, 그 안을 유형별로
// 다르게 채울 수 있다. 그림자가 지는 것만으로도 평면과는 완전히 달라 보인다.
import * as THREE from 'three';
import { pickScheme } from './signage.js';
import { outward, faceAnchor, faceWidth, facePlane, downPlane } from '../../core/boxfaces.js';
import { autoBox } from '../../core/profile.js';
import { NEON } from '../../shared/neon.js';
import { neon } from '../../shared/masters.js';

export const ALCOVE = 1.3; // 벽감 깊이 (m)
export const SHOP_H = 3.4; // 1층 층고

// 면 위의 지역 좌표계.
//   u  면을 따라 -0.5 ~ 0.5
//   d  면에서 바깥으로의 거리 (음수면 건물 안쪽)
function frameOf(sub, side) {
  const o = outward(side);
  const a = faceAnchor(sub, side);
  const w = faceWidth(sub, side);
  const alongZ = side === 'px' || side === 'nx';
  return {
    w,
    o,
    alongZ,
    side,
    at: (u, d) =>
      alongZ ? [a.x + o.ox * d, a.z + u * w] : [a.x + u * w, a.z + o.oz * d],
    // 면 폭 bw, 두께 bd 인 상자의 [x크기, z크기]
    dims: (bw, bd) => (alongZ ? [bd, bw] : [bw, bd]),
    rect: (u0, u1, d0, d1) =>
      alongZ
        ? { x0: a.x + o.ox * Math.min(d0, d1), x1: a.x + o.ox * Math.max(d0, d1),
            z0: a.z + Math.min(u0, u1) * w, z1: a.z + Math.max(u0, u1) * w }
        : { x0: a.x + Math.min(u0, u1) * w, x1: a.x + Math.max(u0, u1) * w,
            z0: a.z + o.oz * Math.min(d0, d1), z1: a.z + o.oz * Math.max(d0, d1) },
  };
}

// 벽감 양옆 마감.
//
// 기둥만으로는 베이 사이가 비어 보인다 — 각도에 따라 옆 가게가 들여다보이고
// "옆이 뚫린" 인상이 된다. 얇은 판 두 장으로 각 가게를 닫는다.
function sideReturns(b, f, y, h, mats) {
  for (const s of [-1, 1]) {
    const g = new THREE.PlaneGeometry(ALCOVE - 0.1, h);
    // 벽감 안쪽을 향하게 — 면과 수직
    g.rotateY(f.alongZ ? 0 : Math.PI / 2);
    if (s < 0) g.rotateY(Math.PI);
    const p = f.at(s * 0.47, -(ALCOVE - 0.1) / 2);
    g.translate(p[0], y + h / 2, p[1]);
    b.add(g, mats.frameMat);
  }
}

// ── 차양 ───────────────────────────────────────────────────────────────────
//
// 가게마다 다른 차양이 1층의 인상을 가장 크게 바꾼다. 하나의 연속된 처마 띠는
// 건물을 하나로 묶어 버리지만, 제각각인 차양은 가게를 하나하나로 쪼갠다.
function awning(b, f, y, rng, mats, tint) {
  const kind = rng.next();
  if (kind < 0.28) return; // 차양 없음

  const w = f.w * rng.range(0.72, 0.98);
  const out = rng.range(0.9, 1.7);
  const top = y + SHOP_H * rng.range(0.82, 0.95);

  if (kind < 0.62) {
    // 천막형 — 앞으로 기울어진 판. 두 조각으로 근사한다.
    const p = f.at(0, out * 0.5);
    const [dx, dz] = f.dims(w, out);
    b.add(autoBox(dx, 0.1, dz, [p[0], top - 0.18, p[1]], 0.02), mats.rustMat);
    // 앞단 늘어뜨림
    const q = f.at(0, out);
    const [ex, ez] = f.dims(w, 0.08);
    b.box(ex, 0.42, ez, [q[0], top - 0.42, q[1]], mats.rustMat);
    // 차양 밑 조명 — 가게 앞 보도를 물들인다
    b.add(downPlane(...f.dims(w * 0.8, out * 0.5), [p[0], top - 0.3, p[1]]), tint);
    return;
  }

  // 철제 캐노피 — 브래킷으로 매단 평판
  const p = f.at(0, out * 0.5);
  const [dx, dz] = f.dims(w, out);
  b.add(autoBox(dx, 0.14, dz, [p[0], top, p[1]], 0.03), mats.metalMat);
  for (const u of [-0.4, 0.4]) {
    const s = f.at(u, out * 0.5);
    const [bx, bz] = f.dims(0.07, out);
    b.box(bx, 0.07, bz, [s[0], top + 0.24, s[1]], mats.metalMat);
    const r = f.at(u, 0.06);
    b.box(0.07, 0.5, 0.07, [r[0], top + 0.4, r[1]], mats.metalMat);
  }
  b.add(downPlane(...f.dims(w * 0.86, out * 0.6), [p[0], top - 0.1, p[1]]), tint);
}

// ── 점포 유형 ──────────────────────────────────────────────────────────────

// 열린 가게 — 벽감 안쪽이 발광하고 계산대와 진열이 실루엣으로 보인다
function openShop(b, f, y, rng, mats) {
  const backD = -ALCOVE + 0.1;
  // 안쪽 발광 벽
  b.add(
    facePlane(f.rect(-0.44, 0.44, backD, backD), y + 0.1, SHOP_H - 0.9, f.side, null, 0),
    mats.interiorMats[rng.int(0, mats.interiorMats.length - 1)]
  );
  sideReturns(b, f, y, SHOP_H - 0.2, mats);
  // 계산대
  const c = f.at(rng.range(-0.2, 0.2), -0.55);
  const [cx, cz] = f.dims(f.w * 0.4, 0.5);
  b.add(autoBox(cx, 0.95, cz, [c[0], y + 0.475, c[1]], 0.03), mats.wetConcreteMat);
  // 진열 선반 — 안쪽 벽 앞
  for (let i = 0; i < 3; i++) {
    const s = f.at(0, backD + 0.22);
    const [sx, sz] = f.dims(f.w * 0.8, 0.3);
    b.box(sx, 0.05, sz, [s[0], y + 0.6 + i * 0.62, s[1]], mats.metalMat);
    for (let k = 0; k < rng.int(2, 5); k++) {
      const g = f.at(rng.range(-0.36, 0.36), backD + 0.22);
      const sz2 = rng.range(0.12, 0.24);
      b.add(autoBox(sz2, sz2, sz2, [g[0], y + 0.65 + i * 0.62 + sz2 / 2, g[1]], 0.02), mats.ductMat);
    }
  }
  // 문턱 — 발광이 바닥으로 새어나온다
  const t = f.at(0, -0.05);
  b.add(downPlane(...f.dims(f.w * 0.86, ALCOVE * 0.8), [t[0], y + 0.06, t[1]]), mats.glowWarm);
}

// 포장마차형 국숫집 — 카운터가 보도를 향하고 스툴이 밖에 놓인다.
// 사람이 앉는 자리가 있으면 거리가 살아 있다고 읽힌다.
function noodleShop(b, f, y, rng, mats) {
  const backD = -ALCOVE + 0.1;
  b.add(
    facePlane(f.rect(-0.44, 0.44, backD, backD), y + 0.1, SHOP_H - 1.2, f.side, null, 0),
    mats.interiorMats[0]
  );
  sideReturns(b, f, y, SHOP_H - 0.2, mats);
  // 카운터 — 벽감 입구
  const c = f.at(0, -0.15);
  const [cx, cz] = f.dims(f.w * 0.92, 0.45);
  b.add(autoBox(cx, 1.05, cz, [c[0], y + 0.525, c[1]], 0.04), mats.metalMat);
  // 스툴 셋 — 보도 위
  const n = Math.max(2, Math.round(f.w / 1.1));
  for (let i = 0; i < n; i++) {
    const u = (i + 0.5) / n - 0.5;
    const p = f.at(u, 0.62);
    b.cylinder(0.17, 0.15, 0.72, [p[0], y + 0.36, p[1]], mats.metalMat, 8);
  }
  // 매달린 전구
  for (let i = -1; i <= 1; i++) {
    const p = f.at(i * 0.28, -0.4);
    b.sphere(0.1, [p[0], y + SHOP_H - 0.75, p[1]], neon(NEON.warm), 8, 6);
  }
  // 김 나는 냄비
  const k = f.at(rng.range(-0.3, 0.3), -0.5);
  b.cylinder(0.24, 0.26, 0.28, [k[0], y + 1.2, k[1]], mats.metalMat, 10);
}

// 노점 — 차양 밑에 상자·선반이 보도로 넘쳐 나온다
function stall(b, f, y, rng, mats) {
  const backD = -ALCOVE + 0.1;
  b.add(
    facePlane(f.rect(-0.46, 0.46, backD, backD), y + 0.1, SHOP_H - 1.0, f.side, null, 0),
    mats.interiorMats[1]
  );
  sideReturns(b, f, y, SHOP_H - 0.2, mats);
  // 진열 매대 — 벽감 밖까지
  const rows = rng.int(2, 3);
  for (let r = 0; r < rows; r++) {
    const d = -0.4 + r * 0.55;
    const p = f.at(0, d);
    const [px, pz] = f.dims(f.w * 0.88, 0.5);
    b.box(px, 0.06, pz, [p[0], y + 0.85 - r * 0.12, p[1]], mats.metalMat);
    // 상자 더미
    for (let k = 0; k < rng.int(3, 7); k++) {
      const s = rng.range(0.16, 0.3);
      const g = f.at(rng.range(-0.42, 0.42), d + rng.range(-0.12, 0.12));
      b.add(autoBox(s, s, s, [g[0], y + 0.9 - r * 0.12 + s / 2, g[1]], 0.02), mats.ductMat);
    }
  }
  // 세워 놓은 짐
  for (let k = 0; k < rng.int(1, 3); k++) {
    const g = f.at(rng.range(-0.45, 0.45), 0.9);
    b.add(autoBox(0.5, rng.range(0.7, 1.3), 0.45, [g[0], y + 0.5, g[1]], 0.03), mats.rustMat);
  }
}

// 좁은 문 하나 — 바·클럽. 벽 대부분이 막혀 있고 문만 빛난다.
// 이 "닫힌 느낌" 이 있어야 열린 가게가 열려 보인다.
function barDoor(b, f, y, rng, mats) {
  // 막힌 벽
  b.add(facePlane(f.rect(-0.5, 0.5, 0, 0), y, SHOP_H, f.side, null, 0.02), mats.tileWallMat);
  // 문 — 좁고 깊다
  const dw = Math.min(0.34, 1.4 / f.w);
  const du = rng.range(-0.28, 0.28);
  b.add(
    facePlane(f.rect(du - dw / 2, du + dw / 2, -0.5, -0.5), y + 0.05, SHOP_H * 0.72, f.side, null, 0),
    rng.chance(0.5) ? mats.glowMagenta : mats.glowCool
  );
  // 문틀
  for (const s of [-1, 1]) {
    const p = f.at(du + s * dw * 0.55, -0.1);
    const [jx, jz] = f.dims(0.14, 0.35);
    b.box(jx, SHOP_H * 0.76, jz, [p[0], y + SHOP_H * 0.38, p[1]], mats.frameMat);
  }
  // 문 위 상인방
  const l = f.at(du, -0.1);
  const [lx, lz] = f.dims(dw * f.w * 1.2, 0.35);
  b.box(lx, 0.22, lz, [l[0], y + SHOP_H * 0.74, l[1]], mats.frameMat);
  // 바닥 빛
  const t = f.at(du, 0.35);
  b.add(downPlane(...f.dims(dw * f.w * 1.6, 1.1), [t[0], y + 0.05, t[1]]), mats.glowMagenta);
}

// 셔터 내린 가게 — 벽감을 셔터로 막는다
function shuttered(b, f, y, rng, mats) {
  b.add(
    facePlane(f.rect(-0.47, 0.47, -0.12, -0.12), y, SHOP_H - 0.3, f.side, [2.4, 2.4], 0),
    mats.shutterMat
  );
  // 셔터 아래 틈으로 새는 빛 — 완전히 죽은 가게가 아니라는 신호
  if (rng.chance(0.3)) {
    const p = f.at(0, -0.1);
    b.add(downPlane(...f.dims(f.w * 0.8, 0.3), [p[0], y + 0.08, p[1]]), mats.glowWarm);
  }
}

// ── 진입점 ─────────────────────────────────────────────────────────────────

const TYPES = [
  { w: 2.6, fn: openShop },
  { w: 1.3, fn: noodleShop },
  { w: 1.5, fn: stall },
  { w: 1.4, fn: barDoor },
];

// 베이 하나를 채운다.
//   D  구역 정의 (밝기·간판 밀도)
export function buildBay(b, sub, side, y, rng, mats, D, signs) {
  const f = frameOf(sub, side);

  // 셔터는 구역 밝기가 정한다 — 공업 구역은 대부분 닫혀 있다
  if (!rng.chance(D.shopLit)) {
    shuttered(b, f, y, rng, mats);
    awning(b, f, y, rng, mats, mats.glowCool);
    return;
  }

  let total = 0;
  for (const t of TYPES) total += t.w;
  let acc = rng.next() * total;
  let pick = TYPES[0];
  for (const t of TYPES) {
    acc -= t.w;
    if (acc <= 0) {
      pick = t;
      break;
    }
  }
  pick.fn(b, f, y, rng, mats);

  // 차양 — 유형과 무관하게 제각각
  const tint = rng.chance(0.5) ? mats.glowCool : mats.glowWarm;
  awning(b, f, y, rng, mats, tint);

  // 가게 위 간판 — 높이와 크기가 제각각이라야 늘어선 모습이 산다
  if (rng.chance(0.72)) {
    signs.push({
      kind: 'banner',
      rect: sub,
      side,
      y: y + SHOP_H * rng.range(0.72, 0.92),
      w: f.w * rng.range(0.55, 0.92),
      h: rng.range(0.7, 1.2),
      scheme: pickScheme(rng),
    });
  }
}

// ── 쇼윈도 ─────────────────────────────────────────────────────────────────
//
// 점포 정면을 텍스처로만 처리하면 지상 카메라에서 "벽에 붙인 사진" 으로 보인다.
// 실제로 들여다볼 수 있는 진열창이 몇 개는 있어야 거리에 눈이 머문다.
//
// 벽을 파지 않고 **밖으로 튀어나온 진열장(vitrine)** 으로 만든다. 개구부를 뚫으려면
// 포디움을 기둥+상인방으로 쪼개야 하는데, 도시 전체에 그걸 하면 지오메트리가 몇
// 배가 된다. 돌출형은 실제 상가에도 흔하고 비용이 1/10 이다.
// ── 출입구 ─────────────────────────────────────────────────────────────────
//
// ── 왜 필요한가 (사용자 지적) ──────────────────────────────────────────────
// "건물 출입구가 보행자 통로나 도로쪽으로 없기도 하고"
//
// 맞다. 주거는 현관이 있고 기업은 캐노피가 있고 공업은 트럭 문이 있는데,
// **상업과 일반 포디움에는 문이 하나도 없었다.**
//
// 적층 상가에서 특히 말이 안 된다. 2~5층이 전부 가게인데 **올라갈 입구가
// 없다.** 외부 복도(walkway)는 만들어 놨으면서 거기 닿는 계단이 없었다.
// 형태가 내력과 어긋난 것이라 장식 문제가 아니다.
//
// 그리고 보행로를 뚫어 놓고 그 길에서 건물로 못 들어가면 길을 만든 의미가
// 절반만 성립한다.
//
// ── 무엇이 문을 문으로 만드는가 ────────────────────────────────────────────
// 구멍만 뚫으면 어두운 사각형이다. 셋이 있어야 한다.
//   1) 안이 밝다      — 들어갈 수 있는 곳이라는 유일한 신호
//   2) 인방과 문틀    — 벽에 뚫린 구멍이 아니라 **설치된 것**
//   3) 바닥의 빛      — 밖에서 그 자리가 특별하다는 표시
//
// upward 가 참이면 계단이 보인다 (적층 상가·잡거빌딩). 거짓이면 로비다.
//
// ── recess 를 왜 갈랐는가 ──────────────────────────────────────────────────
// 상업·포디움은 1층 띠를 ALCOVE 만큼 **이미 들여놨다.** 그 안쪽 면에 발광판을
// 붙이면 밖에서 보인다. 그런데 주거 슬래브는 벽이 통짜라, 같은 방식으로 벽
// 안쪽 2.4m 에 발광판을 두면 **벽에 가려 아무것도 안 보인다.** 상자 안에 넣은
// 램프다. 벽감이 없는 벽에는 문을 파는 대신 **벽면에 붙이고 틀을 내밀어야**
// 한다 — 실제로도 구멍을 못 뚫는 건물은 그렇게 한다.
export function entranceBay(b, sub, side, y, rng, mats, upward = false, recess = true) {
  const f = frameOf(sub, side);
  const W = Math.min(f.w * 0.72, 4.4);
  const H = SHOP_H * 0.82;
  const hw = W / f.w / 2; // 면 좌표계에서의 반폭

  // 1) 안쪽 — 벽감보다 더 깊이 판다. 깊어야 '안' 이 생긴다.
  //    벽감이 없으면(recess=false) 벽면 바로 앞에 세운다.
  const DEEP = recess ? ALCOVE + 1.1 : 0.1;
  const [ix, iz] = f.at(0, -DEEP + 0.05);
  b.add(
    autoBox(f.alongZ ? 0.12 : W, H, f.alongZ ? W : 0.12, [ix, y + H / 2, iz], 0.02),
    mats.lobbyLitMat
  );

  if (recess) {
    // 안쪽 양옆 벽 — 없으면 발광면이 공중에 뜬 판으로 보인다
    for (const sg of [-1, 1]) {
      const [sx, sz] = f.at(sg * hw, -DEEP / 2);
      b.add(
        autoBox(f.alongZ ? DEEP : 0.16, H, f.alongZ ? 0.16 : DEEP, [sx, y + H / 2, sz], 0.02),
        mats.tileWallMat
      );
    }
    // 천장
    const [cx, cz] = f.at(0, -DEEP / 2);
    b.add(
      autoBox(f.alongZ ? DEEP : W, 0.14, f.alongZ ? W : DEEP, [cx, y + H, cz], 0.02),
      mats.frameMat
    );
  } else {
    // ── 벽에 붙인 문은 **유리문**이다 ─────────────────────────────────────
    // 벽감이 있으면 발광면은 로비 안쪽 벽이라 아무것도 걸지 않는다. 그런데
    // 벽에 그냥 붙이면 그 면이 곧 문짝이라, 아무것도 안 걸면 **빛나는
    // 사각형 하나**가 된다 (첫 시도가 그랬다 — 문이 아니라 라이트박스).
    //
    // 선대(mullion)와 중간틀을 어둡게 지르면 밝은 바탕에 실루엣으로 떨어져서
    // 유리문 두 짝으로 읽힌다. 판 하나에 선 셋, 그게 전부다.
    const [mx, mz] = f.at(0, 0.02);
    b.add(
      autoBox(f.alongZ ? 0.08 : 0.09, H, f.alongZ ? 0.09 : 0.08, [mx, y + H / 2, mz], 0.02),
      mats.metalMat
    ); // 가운데 선대 — 두 짝으로 갈린다
    for (const sg of [-1, 1]) {
      const [ex, ez] = f.at(sg * hw * 0.5, 0.02);
      b.add(
        autoBox(f.alongZ ? 0.06 : 0.06, H, f.alongZ ? 0.06 : 0.06, [ex, y + H / 2, ez], 0.02),
        mats.metalMat
      );
    }
    // 중간틀 — 이 높이가 사람 키를 알려준다. 없으면 크기가 안 읽힌다
    const [tx, tz] = f.at(0, 0.02);
    b.add(
      autoBox(f.alongZ ? 0.07 : W, 0.1, f.alongZ ? W : 0.07, [tx, y + 2.25, tz], 0.02),
      mats.metalMat
    );
  }

  // 계단 — 위층 가게로 올라간다. 이것이 적층 상가의 동선이다
  if (upward && recess) {
    const steps = 5;
    for (let i = 0; i < steps; i++) {
      const t = (i + 0.5) / steps;
      const [px, pz] = f.at(0, -0.5 - t * (DEEP - 0.9));
      b.add(
        autoBox(f.alongZ ? (DEEP - 0.9) / steps : W * 0.82, 0.22,
          f.alongZ ? W * 0.82 : (DEEP - 0.9) / steps, [px, y + 0.11 + t * 1.5, pz], 0.02),
        mats.plazaStepMat
      );
    }
  }

  // 2) 문틀과 인방 — 벽에 뚫린 구멍이 아니라 설치된 것으로 보이게
  for (const sg of [-1, 1]) {
    const [px, pz] = f.at(sg * hw, 0.06);
    b.add(
      autoBox(f.alongZ ? 0.22 : 0.24, H + 0.3, f.alongZ ? 0.24 : 0.22, [px, y + (H + 0.3) / 2, pz], 0.03),
      mats.metalMat
    );
  }
  const [lx, lz] = f.at(0, 0.1);
  b.add(
    autoBox(f.alongZ ? 0.3 : W + 0.5, 0.42, f.alongZ ? W + 0.5 : 0.3, [lx, y + H + 0.2, lz], 0.03),
    mats.metalMat
  );
  // 인방 위 작은 명판 — 건물 이름 자리. 간판이 아니라 표식이다
  const [nx, nz] = f.at(0, 0.14);
  b.box(f.alongZ ? 0.06 : W * 0.5, 0.3, f.alongZ ? W * 0.5 : 0.06,
    [nx, y + H + 0.62, nz], neon(NEON.cool));

  // 작은 차양 — 비 오는 도시라 입구에는 늘 있다
  const [ax, az] = f.at(0, 0.85);
  b.add(
    autoBox(f.alongZ ? 1.7 : W + 0.9, 0.16, f.alongZ ? W + 0.9 : 1.7, [ax, y + H + 0.5, az], 0.03),
    mats.metalMat
  );
  b.add(
    downPlane(f.alongZ ? 1.5 : W * 0.9, f.alongZ ? W * 0.9 : 1.5, [ax, y + H + 0.41, az]),
    mats.deckUnderMat
  );

  // 3) 바닥의 빛 — 밖에서 그 자리가 특별하다는 표시
  const [dx, dz] = f.at(0, 1.1);
  return { x: dx, z: dz, w: W };
}

export function showcase(b, sub, side, y, h, rng, mats) {
  const o = outward(side);
  const D = 0.75; // 튀어나오는 깊이
  const w = faceWidth(sub, side) * 0.86;
  const a = faceAnchor(sub, side);
  const cx = a.x + o.ox * (D / 2);
  const cz = a.z + o.oz * (D / 2);
  const H = h * 0.78;
  const cy = y + H / 2;

  const alongZ = side === 'px' || side === 'nx';
  const boxW = alongZ ? D : w;
  const boxD = alongZ ? w : D;

  // 뒷벽 — 발광. 진열장 안의 조명.
  const warm = rng.chance(0.5);
  b.add(
    facePlane({ x0: cx - boxW / 2, x1: cx + boxW / 2, z0: cz - boxD / 2, z1: cz + boxD / 2 },
      y + 0.1, H - 0.2, side, null, -D + 0.06),
    warm ? mats.glowWarm : mats.glowCool
  );

  // 틀 — 위·아래·양옆 얇은 판
  b.box(boxW, 0.12, boxD, [cx, y + H, cz], mats.frameMat);
  b.box(boxW, 0.12, boxD, [cx, y, cz], mats.frameMat);
  for (const s of [-1, 1]) {
    b.box(
      alongZ ? D : 0.1,
      H,
      alongZ ? 0.1 : D,
      [cx + (alongZ ? 0 : s * w / 2), cy, cz + (alongZ ? s * w / 2 : 0)],
      mats.frameMat
    );
  }

  // 유리 — 어둡고 매끈해서 거리의 네온을 반사한다
  b.add(facePlane({ x0: cx - boxW / 2, x1: cx + boxW / 2, z0: cz - boxD / 2, z1: cz + boxD / 2 },
    y + 0.12, H - 0.24, side, null, 0.02), mats.vitrineGlassMat);

  // 진열물 — 마네킹이거나 상품 더미
  const n = Math.max(1, Math.round(w / 1.5));
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n - 0.5;
    const px = cx + (alongZ ? 0 : t * w * 0.82);
    const pz = cz + (alongZ ? t * w * 0.82 : 0);

    if (rng.chance(0.55)) {
      // 마네킹 — 받침 + 몸통 + 머리. 실루엣만 있으면 사람으로 읽힌다.
      b.cylinder(0.22, 0.26, 0.08, [px, y + 0.2, pz], mats.metalMat, 8);
      b.cylinder(0.16, 0.13, H * 0.52, [px, y + 0.24 + H * 0.26, pz], mats.mannequinMat, 8);
      b.sphere(0.13, [px, y + 0.3 + H * 0.58, pz], mats.mannequinMat, 8, 6);
    } else {
      // 진열대 + 상품 상자
      b.box(0.5, 0.06, 0.5, [px, y + 0.55, pz], mats.metalMat);
      for (let k = 0; k < rng.int(2, 4); k++) {
        const s = rng.range(0.14, 0.26);
        b.add(
          autoBox(s, s, s, [px + rng.range(-0.15, 0.15), y + 0.58 + s / 2, pz + rng.range(-0.15, 0.15)], 0.02),
          mats.ductMat
        );
      }
    }
  }

  // 상단 조명 띠 — 진열장 안쪽을 위에서 비추는 것처럼. soft 등급(넓은 면).
  b.add(
    downPlane(alongZ ? D * 0.6 : w * 0.9, alongZ ? w * 0.9 : D * 0.6, [cx, y + H - 0.14, cz]),
    mats.glowCool
  );
}
