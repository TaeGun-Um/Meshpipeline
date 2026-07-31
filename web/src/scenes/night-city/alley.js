// 골목 — 블록을 관통하는 좁은 뒷길.
//
// ── 왜 필요한가 ────────────────────────────────────────────────────────────
// 도로가 22m 하나뿐인 도시는 **자동차의 도시**다. 걸어 다닐 이유가 없다.
// 레퍼런스(사이버펑크 카부키, GTA 상업지구 뒤편)에서 가장 기억에 남는 공간은
// 정작 폭 3~4m 짜리 골목인데, 이유가 셋이다.
//
//   1) 시야를 막는다. 탐험의 정의는 "저 모퉁이 너머가 안 보인다" 이다.
//      우리 도시는 어디에 서도 500m 앞 경계까지 보였다. 숨은 것이 없으면
//      갈 이유도 없다.
//   2) 폭 대비 높이(종횡비)가 뒤집힌다. 22m 도로에 40m 건물은 개방감이지만
//      4m 골목에 40m 건물은 협곡이다. 같은 건물이 전혀 다르게 읽힌다.
//   3) 건물의 **뒷면**을 보여준다. 정면은 꾸민 얼굴이고 뒷면은 배관·실외기·
//      비상구·쓰레기다. 뒷면이 있어야 정면이 꾸민 것으로 읽힌다.
//
// ── 골목은 '남은 공간' 이 아니다 ───────────────────────────────────────────
// 필지를 그냥 넓게 띄우면 골목이 아니라 **빈틈**이 된다. 실제로 예전에 필지
// 간격을 2.6m 로 뒀더니 블록마다 성긴 틈이 생겨 도시가 헐거워 보였고, 그래서
// 0.35~1.4m 로 좁힌 이력이 있다 (towers.js 주석).
//
// 골목은 통로로 **의도해서 파낸다**. 블록에서 띠 하나를 먼저 빼내고, 남은
// 조각을 각각 필지로 쪼갠다. 그래야 골목 양옆이 벽으로 막힌 통로가 된다.
import * as THREE from 'three';
import { MeshBuilder } from '../../core/builder.js';
import { autoBox, lathe, tubeBetween } from '../../core/profile.js';
import { upPlane, downPlane, rectCenter, rectSize } from '../../core/boxfaces.js';
import { metricBox } from '../../core/meshkit.js';
import { NEON, rgb01 } from '../../shared/neon.js';
import { neon, neonSoft } from '../../shared/masters.js';
import { CURB_HEIGHT, ALLEY_WIDTH } from './layout.js';
import { claim, TIER } from './siteplan.js';

// 골목 전용 벽의 높이.
//
// **창을 여기까지만 붙여야 한다.** 원래 창을 20~34m 까지 뿌리면서 벽은 20m 로
// 뒀더니, 20m 위의 창이 전부 허공에 떠 있었다 — 골목 위쪽에 조명 사각형이
// 둥둥 떠다니는 상태였다. 벽과 창이 같은 상수를 봐야 이 실수가 반복되지 않는다.
// 구역마다 다르다. 골목 벽은 **양옆 건물의 옆면**을 대신하는 것이므로,
// 그 구역의 건물보다 높으면 안 된다.
//
// 실제로 공업 구역에서 11m 짜리 공장 사이에 26m 벽이 솟아 있었다 —
// 골목이 아니라 담장이 치솟은 꼴이었다. 구역별 건물 높이를 봐야 한다.
const WALL_H_BY_ZONE = {
  상업: 15,   // 적층 상가 3~6층 (3.1m/층)
  주거: 26,   // 슬래브 6~14층 (2.9m/층)
  공업: 9,    // 공장동 11m — 골목 벽이 지붕 아래여야 한다
  기업: 22,
};
const WALL_H_DEFAULT = 20;

// ── 골목 안에 놓이는 것들 ──────────────────────────────────────────────────
//
// 밀도는 물건 수가 아니라 **크기의 층위**에서 온다. 큰 것(쓰레기통) · 중간
// (상자·팔레트) · 작은 것(봉투·캔) 이 섞여야 눈이 머문다. 큰 것만 늘리면
// 창고처럼 보이고 작은 것만 늘리면 지저분한 바닥처럼 보인다.

// 대형 쓰레기통 — 골목의 상징. 뚜껑을 몸통과 각도를 달리 얹어 열린 것을 섞는다.
function dumpster(b, x, z, rot, rng, mats) {
  const W = rng.range(1.7, 2.1);
  const H = 1.25;
  const D = 1.1;
  const y = CURB_HEIGHT;
  const g = autoBox(W, H, D, null, 0.04);
  g.rotateY(rot);
  g.translate(x, y + H / 2, z);
  b.add(g, mats.dumpsterMat);

  // 뚜껑 — 절반은 열어 둔다. 닫힌 상자만 있으면 전부 같은 실루엣이 된다
  const open = rng.chance(0.45);
  const lid = autoBox(W * 0.98, 0.08, D * 0.96, null, 0.02);
  if (open) {
    lid.rotateX(-1.15);
    lid.rotateY(rot);
    lid.translate(x - Math.sin(rot) * 0.0, y + H + 0.42, z + Math.cos(rot) * 0.44);
  } else {
    lid.rotateY(rot);
    lid.translate(x, y + H + 0.05, z);
  }
  b.add(lid, mats.metalMat);

  // 바퀴 — 바닥에서 살짝 띄워야 무거운 물건으로 읽힌다
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const px = x + (Math.cos(rot) * sx * W * 0.4 - Math.sin(rot) * sz * D * 0.36);
      const pz = z + (Math.sin(rot) * sx * W * 0.4 + Math.cos(rot) * sz * D * 0.36);
      b.cylinder(0.11, 0.11, 0.1, [px, y + 0.11, pz], mats.metalMat, 6);
    }
  }
  // 흘러넘친 봉투
  if (open) {
    for (let i = 0; i < rng.int(2, 4); i++) {
      b.sphere(
        rng.range(0.16, 0.26),
        [x + rng.range(-W * 0.35, W * 0.35), y + H + rng.range(0.05, 0.3), z + rng.range(-0.3, 0.3)],
        mats.bagMat
      );
    }
  }
}

// 적재물 — 팔레트 위에 상자를 쌓는다. 팔레트가 있어야 '놓아둔 것' 으로 읽힌다.
function pallet(b, x, z, rot, rng, mats) {
  const y = CURB_HEIGHT;
  const W = 1.15;
  const D = 0.95;
  // 팔레트 — 각재 셋
  for (let i = 0; i < 3; i++) {
    const u = (i - 1) * (D * 0.36);
    const px = x - Math.sin(rot) * u;
    const pz = z + Math.cos(rot) * u;
    const g = autoBox(W, 0.12, 0.16, null, 0.02);
    g.rotateY(rot);
    g.translate(px, y + 0.06, pz);
    b.add(g, mats.crateMat);
  }
  // 상자 더미 — 위로 갈수록 작고 어긋나게
  let h = 0.12;
  const n = rng.int(1, 4);
  for (let i = 0; i < n; i++) {
    const cw = W * rng.range(0.55, 0.92);
    const ch = rng.range(0.32, 0.5);
    const g = autoBox(cw, ch, D * rng.range(0.6, 0.9), null, 0.02);
    g.rotateY(rot + rng.range(-0.3, 0.3));
    g.translate(x + rng.range(-0.12, 0.12), y + h + ch / 2, z + rng.range(-0.12, 0.12));
    b.add(g, rng.chance(0.3) ? mats.crateAltMat : mats.crateMat);
    h += ch;
  }
}

// 배관 다발 — 벽을 타고 오르는 수직 배관. 뒷면을 뒷면으로 만드는 가장 값싼 요소.
function standpipe(b, x, z, rot, top, rng, mats) {
  const y = CURB_HEIGHT;
  const n = rng.int(2, 4);
  for (let i = 0; i < n; i++) {
    const u = (i - (n - 1) / 2) * 0.24;
    const px = x - Math.sin(rot) * u;
    const pz = z + Math.cos(rot) * u;
    const r = rng.range(0.055, 0.1);
    const h = top * rng.range(0.5, 0.95);
    b.cylinder(r, r, h, [px, y + h / 2, pz], mats.pipeMat, 6);
    // 이음 플랜지 — 몇 미터마다. 이게 없으면 매끈한 막대라 배관으로 안 읽힌다
    for (let fy = 2.2; fy < h; fy += rng.range(2.6, 4.2)) {
      b.cylinder(r * 1.5, r * 1.5, 0.09, [px, y + fy, pz], mats.metalMat, 6);
    }
  }
}

// 비상계단 — 골목의 수직성을 미리 암시한다. (오르는 동선 자체는 다음 단계)
function fireEscape(b, x, z, rot, top, rng, mats) {
  const y = CURB_HEIGHT;
  const levels = Math.min(5, Math.max(2, Math.floor(top / 3.6) - 1));
  const W = 2.2;
  const D = 1.05;
  const cos = Math.cos(rot);
  const sin = Math.sin(rot);
  // rot 은 벽이 바라보는 방향. 벽에서 D/2 만큼 나온 자리에 단다.
  const ox = cos * (D / 2);
  const oz = sin * (D / 2);

  for (let i = 1; i <= levels; i++) {
    const fy = y + 3.4 + (i - 1) * 3.6;
    // 발판
    const deck = autoBox(W, 0.08, D, null, 0.02);
    deck.rotateY(rot);
    deck.translate(x + ox, fy, z + oz);
    b.add(deck, mats.grateMat);
    // 난간 — 위아래 가로대 둘 + 동자. 판때기로 하면 실루엣이 뭉개진다
    for (const hy of [0.5, 1.0]) {
      const rail = autoBox(W, 0.05, 0.05, null, 0.01);
      rail.rotateY(rot);
      rail.translate(x + cos * D + -sin * 0, fy + hy, z + sin * D + cos * 0);
      b.add(rail, mats.pipeMat);
    }
    for (let k = 0; k < 4; k++) {
      const u = (k / 3 - 0.5) * W;
      b.box(0.045, 1.0, 0.045, [x + cos * D - sin * u, fy + 0.5, z + sin * D + cos * u], mats.pipeMat);
    }
    // 사다리 — 층 사이를 잇는다. 이게 있어야 올라갈 수 있는 것으로 보인다
    if (i < levels) {
      for (const su of [-0.28, 0.28]) {
        b.box(0.05, 3.6, 0.05,
          [x + cos * (D * 0.8) - sin * (W * 0.3 + su), fy + 1.8, z + sin * (D * 0.8) + cos * (W * 0.3 + su)],
          mats.pipeMat);
      }
    }
  }
}

// 실외기 무더기 — 제각각인 크기와 각도가 '증축된 건물' 을 만든다
function acCluster(b, x, z, rot, top, rng, mats) {
  const y = CURB_HEIGHT;
  const n = rng.int(3, 7);
  for (let i = 0; i < n; i++) {
    const w = rng.range(0.6, 0.95);
    const h = rng.range(0.5, 0.8);
    const fy = y + rng.range(3.6, Math.max(4.2, Math.min(top - 1, 16)));
    const u = rng.range(-1.6, 1.6);
    const px = x - Math.sin(rot) * u + Math.cos(rot) * 0.35;
    const pz = z + Math.cos(rot) * u + Math.sin(rot) * 0.35;
    const g = autoBox(w, h, 0.62, null, 0.03);
    g.rotateY(rot + rng.range(-0.06, 0.06));
    g.translate(px, fy, pz);
    b.add(g, mats.ductMat);
    // 받침 브래킷
    b.box(w * 0.9, 0.06, 0.1, [px - Math.cos(rot) * 0.3, fy - h / 2 - 0.03, pz - Math.sin(rot) * 0.3], mats.metalMat);
  }
}

// 문 위 알전구 하나. 골목 조명의 전부다 —
// 네온으로 채우면 대로와 구별이 안 되고, 골목이 어두워야 대로가 밝아 보인다.
function serviceDoor(b, x, z, rot, rng, mats, pools) {
  const y = CURB_HEIGHT;
  const cos = Math.cos(rot);
  const sin = Math.sin(rot);
  const W = 1.0;
  const H = 2.15;
  // 벽면에서 밖으로 d, 좌우로 u 인 지점
  const at = (d, u = 0) => [x + cos * d - sin * u, z + sin * d + cos * u];

  const [dx, dz] = at(0.07);
  const g = autoBox(W, H, 0.12, null, 0.02);
  g.rotateY(rot);
  g.translate(dx, y + H / 2, dz);
  b.add(g, mats.serviceDoorMat);

  // ── 문짝의 내용 ──────────────────────────────────────────────────────────
  // 통짜 상자로 뒀더니 회색 판때기로 보였다. 철문이 철문으로 읽히려면
  // 최소한 셋이 필요하다: 가로 보강대, 손잡이, 그리고 문틀.
  // 셋 다 몇 cm 짜리지만 이게 없으면 크기 감각 자체가 안 생긴다.
  for (const ry of [H * 0.34, H * 0.68]) {
    const [bx, bz] = at(0.14);
    b.box(W * 0.86, 0.07, 0.04, [bx, y + ry, bz], mats.metalMat);
  }
  // 손잡이 — 경첩 반대쪽
  const [hx, hz] = at(0.17, W * 0.33);
  b.box(0.05, 0.22, 0.05, [hx, y + 1.02, hz], mats.metalMat);
  // 문패 (작은 번호판)
  const [px, pz] = at(0.14, -W * 0.28);
  b.box(0.16, 0.1, 0.03, [px, y + 1.62, pz], mats.metalMat);

  // 문틀 — 좌우 + 상인방
  for (const su of [-1, 1]) {
    const [fx, fz] = at(0.06, su * (W / 2 + 0.04));
    b.box(0.09, H + 0.14, 0.16, [fx, y + H / 2, fz], mats.metalMat);
  }
  const [lx, lz] = at(0.06);
  b.box(W + 0.26, 0.12, 0.18, [lx, y + H + 0.1, lz], mats.metalMat);

  // 문 앞 단 — 실제 서비스 도어는 늘 한 단 올라가 있다
  const [sx2, sz2] = at(0.42);
  b.box(W + 0.3, 0.12, 0.7, [sx2, y + 0.06, sz2], mats.wetConcreteMat);

  // 갓 달린 전구 — 갓이 있어야 빛이 아래로 떨어지는 것으로 읽힌다
  const [gx, gz] = at(0.34);
  b.add(lathe([[0.02, 0], [0.22, 0.16], [0.24, 0.18]], 8, [gx, y + H + 0.46, gz]), mats.metalMat);
  b.sphere(0.075, [gx, y + H + 0.34, gz], neon(NEON.warm));

  pools.push({
    kind: 'floor', x: x + cos * 1.1, y: CURB_HEIGHT + 0.02, z: z + sin * 1.1,
    rx: 2.6, rz: 2.6, tint: rgb01(NEON.warm, 0.34),
  });
  pools.push({
    kind: 'wall', x: x + cos * 0.05, y: y + H * 0.6, z: z + sin * 0.05,
    w: 2.0, h: 2.2, yaw: rot, tint: rgb01(NEON.warm, 0.26),
  });
}

// 머리 위를 가로지르는 것들 — 케이블과 빨래줄.
//
// 골목이 '위가 뚫린 통로' 가 아니라 '덮인 협곡' 으로 읽히게 만드는 요소다.
// 하늘을 조금 가리기만 해도 공간이 훨씬 좁게 느껴진다.
function overhead(b, a, rng, mats, halfW = ALLEY_WIDTH / 2) {
  const s = rectSize(a.rect);
  const c = rectCenter(a.rect);
  const long = a.alongX ? s.w : s.d;
  const n = Math.max(2, Math.floor(long / 9));

  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n;
    const along = -long / 2 + long * t;
    const y = CURB_HEIGHT + rng.range(5.5, 11);
    const px = a.alongX ? c.x + along : c.x;
    const pz = a.alongX ? c.z : c.z + along;
  
    // 케이블 — 살짝 처지게 여러 토막으로. 직선으로 이으면 팽팽한 철사로 보인다
    const sag = rng.range(0.25, 0.7);
    const seg = 5;
    const at = (u) => (a.alongX ? [px, y - (1 - (u / halfW) ** 2) * sag, pz + u]
                                : [px + u, y - (1 - (u / halfW) ** 2) * sag, pz]);
    for (let k = 0; k < seg; k++) {
      const u0 = -halfW + (2 * halfW * k) / seg;
      const u1 = -halfW + (2 * halfW * (k + 1)) / seg;
      b.add(tubeBetween(at(u0), at(u1), 0.025, 4), mats.cableMat);
    }

    // 빨래 — 사람이 사는 흔적. 몇 줄에만 넌다
    if (rng.chance(0.42)) {
      const m = rng.int(2, 5);
      for (let k = 0; k < m; k++) {
        const u = -halfW * 0.7 + (1.4 * halfW * (k + 0.5)) / m;
        const w = rng.range(0.35, 0.7);
        const h = rng.range(0.5, 1.1);
        const sag2 = (1 - (u / halfW) ** 2) * sag;
        const cl = new THREE.PlaneGeometry(w, h);
        if (a.alongX) cl.rotateY(Math.PI / 2);
        cl.translate(
          a.alongX ? px : px + u,
          y - sag2 - h / 2 - 0.03,
          a.alongX ? pz + u : pz
        );
        b.add(cl, mats.laundryMats[rng.int(0, mats.laundryMats.length - 1)]);
      }
    }
  }
}

// ── 조명 ───────────────────────────────────────────────────────────────────
//
// 처음 만들었을 때 골목이 **완전히 새카맸다**. 소품이 36,754삼각형이나 들어가
// 있는데 화면에는 하나도 안 보였다. 원인은 환경맵이다 — 씬 전체를 구워 만든
// PMREM 이 폭 4.4m 짜리 슬롯 안까지는 거의 도달하지 않는다.
//
// 그렇다고 네온으로 채우면 대로와 구별이 안 된다. 골목은 **어둡되 읽혀야**
// 한다. 그래서 조명을 성격이 다른 셋으로 쌓는다.
//
//   1) 벽등    일정 간격. 골목의 기본 밝기. 웅덩이가 바닥을 읽히게 한다.
//   2) 창 불빛 벽에 난 작은 발광 슬릿. 주변 건물 안에 사람이 있다는 신호이고,
//              위로 갈수록 성기게 두면 높이가 읽힌다.
//   3) 뒷문 간판 가끔 있는 색 있는 네온. 골목에서 유일한 채도이므로 눈이 여기 멈춘다.
//
// 잡동사니 배치와 **별도 루프**로 돈다. 같은 루프에 섞으면 확률에 밀려
// 조명이 안 걸리는 구간이 생기고, 그 구간은 통째로 안 보이게 된다.

// 갓 달린 벽등 — 골목 조명의 기본. 브래킷이 있어야 벽에 매단 것으로 읽힌다.
function wallLamp(b, x, z, rot, rng, mats, pools) {
  const y = CURB_HEIGHT + rng.range(2.9, 3.8);
  const cos = Math.cos(rot);
  const sin = Math.sin(rot);
  // 벽에서 뻗어나온 팔
  b.add(tubeBetween([x, y, z], [x + cos * 0.42, y + 0.06, z + sin * 0.42], 0.028, 5), mats.pipeMat);
  // 갓
  const shade = lathe(
    [[0.02, 0.16], [0.26, 0.0], [0.27, -0.02]], 10,
    [x + cos * 0.44, y, z + sin * 0.44]
  );
  b.add(shade, mats.metalMat);
  b.sphere(0.085, [x + cos * 0.44, y - 0.08, z + sin * 0.44], neon(NEON.warm));

  // 바닥 웅덩이. 골목이 좁아 rz 를 길게 늘여 빛이 통로를 따라 번지게 한다.
  pools.push({
    kind: 'floor',
    x: x + cos * 1.0, y: CURB_HEIGHT + 0.02, z: z + sin * 1.0,
    rx: 3.6, rz: 3.6,
    tint: rgb01(NEON.warm, 0.34),
  });
  // 벽에 걸리는 빛 — 바닥만 밝으면 벽이 허공에 떠 보인다
  pools.push({
    kind: 'wall', x: x + cos * 0.06, y: y - 1.1, z: z + sin * 0.06,
    w: 2.4, h: 2.6, yaw: rot, tint: rgb01(NEON.warm, 0.34),
  });
}

// 뒷문 간판 — 골목에서 유일하게 색을 갖는 것.
// 작아야 한다. 대로 간판만 해지면 여기가 대로가 된다.
function backDoorSign(b, x, z, rot, rng, mats, pools) {
  const y = CURB_HEIGHT + rng.range(2.6, 3.4);
  const cos = Math.cos(rot);
  const sin = Math.sin(rot);
  const hue = rng.chance(0.4) ? NEON.pink : rng.chance(0.5) ? NEON.cool : NEON.amber;
  const W = rng.range(0.5, 0.8);
  const H = rng.range(0.8, 1.5);

  const g = autoBox(0.08, H, W, null, 0.01);
  g.rotateY(rot);
  g.translate(x + cos * 0.14, y, z + sin * 0.14);
  b.add(g, neonSoft(hue));
  // 매단 팔
  b.add(tubeBetween([x, y + H / 2, z], [x + cos * 0.16, y + H / 2, z + sin * 0.16], 0.022, 4), mats.metalMat);

  pools.push({
    kind: 'floor', x: x + cos * 0.9, y: CURB_HEIGHT + 0.02, z: z + sin * 0.9,
    rx: 2.8, rz: 2.8, tint: rgb01(hue, 0.42),
  });
}

// 벽에 난 창 불빛.
//
// 골목 벽은 건물의 뒷면이라 정면 같은 창 격자가 없다. 대신 환기창·비상구
// 창처럼 **띄엄띄엄한 작은 빛**을 둔다. 이게 있으면 벽이 단순한 판이 아니라
// 사람이 있는 건물의 뒷면으로 읽히고, 위로 갈수록 성기게 두면 높이도 읽힌다.
function alleyWindows(b, a, rng, mats, wallH, halfW) {
  const c = rectCenter(a.rect);
  const sz = rectSize(a.rect);
  const long = a.alongX ? sz.w : sz.d;

  for (const side of [-1, 1]) {
    const rot = a.alongX
      ? (side > 0 ? -Math.PI / 2 : Math.PI / 2)
      : (side > 0 ? Math.PI : 0);
    const cos = Math.cos(rot);
    const sin = Math.sin(rot);

    // ── 왜 세로 열로 묶는가 ────────────────────────────────────────────────
    // 처음에는 위치·크기를 매번 새로 뽑아 벽에 흩뿌렸다. 그랬더니 창이
    // 아니라 **벽에 뿌린 색종이**로 보였다. 실제 건물의 창은 층과 열을
    // 따르고, 같은 열의 창은 크기가 같다. 그 규칙성이 있어야 창으로 읽히고,
    // 불이 켜지고 꺼지는 **패턴**만 불규칙해야 한다.
    const cols = Math.max(2, Math.round(long / 11));
    for (let ci = 0; ci < cols; ci++) {
      // 열 위치를 살짝 흔든다 — 정확히 등간격이면 이번엔 격자무늬가 된다
      const t = ((ci + 0.5) / cols) * long + rng.range(-1.6, 1.6);
      if (t < 2 || t > long - 2) continue;
      const along = -long / 2 + t;
      const wx = (a.alongX ? c.x + along : c.x + halfW * side) + cos * 0.05;
      const wz = (a.alongX ? c.z + halfW * side : c.z + along) + sin * 0.05;

      // 열마다 창 크기가 정해진다 (같은 건물의 같은 열이므로)
      const w = rng.range(0.55, 0.95);
      const h = rng.range(0.7, 1.05);
      const warm = rng.chance(0.68);
      // 벽 안에서만. 벽보다 높은 창은 붙을 데가 없어 허공에 뜬다.
      const top = Math.min(wallH - 2.5, rng.range(16, 26));

      for (let fy = 4.6; fy < top; fy += 3.6) {
        // 위로 갈수록 켜진 창이 준다
        if (!rng.chance(0.5 * (1 - (fy - 4.6) / 46))) continue;
        const wy = CURB_HEIGHT + fy;
        // 틀을 먼저, 발광면을 그 앞에. 틀이 없으면 창이 벽에 뚫린 구멍으로
        // 안 읽히고 그냥 붙인 색면이 된다.
        const fr = autoBox(0.05, h + 0.14, w + 0.14, null, 0.01);
        fr.rotateY(rot);
        fr.translate(wx, wy, wz);
        b.add(fr, mats.winFrameMat);

        const g = autoBox(0.06, h, w, null, 0.01);
        g.rotateY(rot);
        g.translate(wx + cos * 0.02, wy, wz + sin * 0.02);
        b.add(g, warm ? mats.alleyWinWarm : mats.alleyWinCool);
      }
    }
  }
}

// ── 입구 ───────────────────────────────────────────────────────────────────
//
// 골목이 대로와 만나는 자리가 아무 처리 없이 뚫려 있었다. 그러면 골목이
// "건물 사이가 비어 있는 곳" 으로 보이지 "들어가는 곳" 으로 안 보인다.
//
// 실제 골목 입구에는 셋 중 하나 이상이 있다.
//   · 상인방(위를 가로지르는 보) — 문틀 구실을 해서 '들어간다' 는 신호가 된다
//   · 간판 — 골목 안에 뭔가 있다는 표시
//   · 볼라드 — 차는 막고 사람은 통과. 보행 공간이라는 표시
function alleyMouth(b, x, z, dir, rng, mats, pools) {
  // dir 은 골목 안쪽을 향하는 단위 방향 [dx, dz]
  const [dx, dz] = dir;
  // 골목을 가로지르는 방향
  const px = -dz;
  const pz = dx;
  const half = ALLEY_WIDTH / 2;
  const y = CURB_HEIGHT;

  // 상인방 — 입구 위를 가로지르는 보
  const LY = 4.6;
  b.add(
    autoBox(
      Math.abs(px) > 0.5 ? ALLEY_WIDTH + 1.2 : 0.7,
      0.8,
      Math.abs(pz) > 0.5 ? ALLEY_WIDTH + 1.2 : 0.7,
      [x, y + LY, z],
      0.05
    ),
    mats.frameMat
  );
  // 상인방 아래 조명 띠 — 입구를 눈에 띄게 한다
  b.add(
    downPlane(
      Math.abs(px) > 0.5 ? ALLEY_WIDTH : 0.5,
      Math.abs(pz) > 0.5 ? ALLEY_WIDTH : 0.5,
      [x, y + LY - 0.42, z]
    ),
    neonSoft(NEON.cool)
  );
  pools.push({
    kind: 'floor', x: x + dx * 1.2, y: y + 0.02, z: z + dz * 1.2,
    rx: 3.6, rz: 3.6, tint: rgb01(NEON.cool, 0.3),
  });

  // 입구 간판 — 상인방에 매단 작은 세로 간판
  if (rng.chance(0.62)) {
    const hue = rng.chance(0.5) ? NEON.pink : NEON.amber;
    const su = (half - 0.5) * (rng.chance(0.5) ? 1 : -1);
    b.add(
      autoBox(0.12, 1.5, 0.7, [x + px * su - dx * 0.2, y + LY - 1.3, z + pz * su - dz * 0.2], 0.02),
      neonSoft(hue)
    );
  }

  // 볼라드 — 양옆에 둘. 차는 못 들어가고 사람은 들어가는 곳이라는 표시.
  for (const su of [-1, 1]) {
    const bx = x + px * su * (half - 0.35) + dx * 0.6;
    const bz = z + pz * su * (half - 0.35) + dz * 0.6;
    b.cylinder(0.11, 0.13, 0.95, [bx, y + 0.475, bz], mats.metalMat, 8);
    b.sphere(0.12, [bx, y + 0.96, bz], neon(NEON.amber));
  }
}

// ── 조립 ───────────────────────────────────────────────────────────────────

export function createAlleys(scene, rng, mats, alleys) {
  const b = new MeshBuilder('Alleys');
  const pools = [];

  for (const a of alleys) {
    // 구역이 벽 높이를 정한다. 골목 벽은 양옆 건물의 옆면을 대신하는 것이라
    // 그 구역 건물보다 높으면 담장이 치솟은 꼴이 된다.
    const wallH = WALL_H_BY_ZONE[a.zone] ?? WALL_H_DEFAULT;
    // 벽 높이를 meta 에 실어 둔다. 검사가 "골목 벽이 이웃 건물보다 높나" 를
    // 본다 — 벽 높이를 고정으로 두고 구역 건물 높이를 안 봐서 담장이 공장
    // 위로 치솟은 적이 있다 (docs/status.md 4번).
    b.mark('alley', `alley:${a.rect.x0.toFixed(0)},${a.rect.z0.toFixed(0)}`, { zone: a.zone, wallH });
    const r = a.rect;
    const c = rectCenter(r);
    const s = rectSize(r);
    const long = a.alongX ? s.w : s.d;
    // 틈마다 폭이 다르다 (3.4~5.2m). 전역 ALLEY_WIDTH 를 쓰면 소품이
    // 벽에 파묻히거나 공중에 뜬다 — 벽이 이제 **건물 옆면**이라 정확해야 한다.
    const halfW = (a.w ?? ALLEY_WIDTH) / 2;

    // 바닥 — 인도가 아니라 젖은 아스팔트. 골목은 포장이 다르다.
    // blockPlates 가 깐 보도판 위에 2cm 올려 덮는다 (Z-파이팅 방지).
    b.add(
      upPlane(s.w, s.d, [c.x, CURB_HEIGHT + 0.02, c.z], [6, 6]),
      mats.alleyFloorMat
    );

    // 막다른 끝의 막음벽 — 여기가 없으면 골목이 그냥 뚫린 틈이 된다
    // 양옆 벽면 — 골목 전용. 필지 후퇴 거리가 제각각이라 원래 건물 옆면은
    // 들쭉날쭉했다. 연속된 벽을 세워야 '통로' 로 읽힌다 (materials.js 주석 참고).
    // 실제 건물면보다 안쪽에 서므로 Z-파이팅은 나지 않는다.
    // 평면이 아니라 **두께 있는 박스**다. 평면으로 뒀더니 입구에서 종잇장
    // 단면이 그대로 보였다 — 벽이 벽이 아니라 세워둔 판때기로 읽혔다.
    //
    // 길이도 양끝을 물려서 대로로 튀어나오지 않게 한다. 튀어나오면 인도
    // 한복판에 벽이 서 있는 꼴이 된다.
    // ── 벽을 세우지 않는다 (사용자 지시로 다시 만듦) ────────────────────
    //
    // 옛 골목은 여기서 두께 0.35m · 높이 최대 26m 짜리 **독립 벽 박스**를
    // 두 장 세웠다. 필지 후퇴가 제각각이라 건물 옆면이 들쭉날쭉했고, 그걸
    // 못 쓰니 가짜 벽을 세운 것이다. 가까이서 보면 공터에 선 골판지였고,
    // 사용자가 "괴상하다" 며 없애라고 했다.
    //
    // 이제 골목은 **필지를 자른 자리를 벌린 틈**이다 (layout.splitToTarget).
    // 양옆 필지가 경계선을 공유하므로 그 건물들의 옆면이 이미 벽이다.
    // 그래서 여기서는 **아무 벽도 그리지 않는다** — 소품만 붙인다.
    //
    // 그게 원래 골목에서 좋았던 부분이기도 하다. 쓰레기통·비상계단·배관·
    // 실외기·뒷문·빨래는 그대로 살아 있고, 사고였던 것은 벽뿐이었다.

    // 양쪽 벽에 붙는 것들. 골목을 따라가며 번갈아 놓는다.
    //
    // 간격을 고정하면 인도 시설물처럼 리듬이 규칙적으로 읽힌다. 골목은
    // 정돈되지 않은 공간이라 간격 자체가 들쭉날쭉해야 한다.
    let t = rng.range(2, 5);
    let side = rng.chance(0.5) ? 1 : -1;
    while (t < long - 2) {
      const along = -long / 2 + t;
      // 벽면 위치와 벽이 바라보는 방향(골목 안쪽)
      const wallU = (halfW) * side;
      const x = a.alongX ? c.x + along : c.x + wallU;
      const z = a.alongX ? c.z + wallU : c.z + along;
      // 벽에서 골목 안쪽을 보는 각
      const rot = a.alongX
        ? (side > 0 ? -Math.PI / 2 : Math.PI / 2)
        : (side > 0 ? Math.PI : 0);

      // 벽면 위의 점에서 골목 안쪽으로 d 만큼 민 자리.
      // 이걸 안 하면 물건의 절반이 벽에 파묻힌다 — 바닥에 놓는 물건은
      // 자기 깊이의 절반만큼, 벽에 붙는 설비(배관·실외기·문)는 0 이다.
      const inward = (d) => [x + Math.cos(rot) * d, z + Math.sin(rot) * d];

      // 골목 안도 계획 대상이다. 입구(ACCESS)와 서로(AMENITY)를 피한다.
      // 전에는 쓰레기통과 비상계단이 같은 자리에 겹치고, 입구를 막고 섰다.
      if (!claim(x, z, 1.5, TIER.AMENITY, 'alleyProp')) {
        t += rng.range(2.0, 3.5);
        if (rng.chance(0.62)) side = -side;
        continue;
      }

      const pick = rng.next();
      if (pick < 0.24) {
        const [px2, pz2] = inward(0.62);
        dumpster(b, px2, pz2, rot, rng, mats);
        t += rng.range(3.2, 5.5);
      } else if (pick < 0.44) {
        const [px2, pz2] = inward(0.55);
        pallet(b, px2, pz2, rot, rng, mats);
        t += rng.range(2.4, 4.2);
      } else if (pick < 0.60) {
        serviceDoor(b, x, z, rot, rng, mats, pools);
        t += rng.range(4, 7);
      } else if (pick < 0.74) {
        const [px2, pz2] = inward(0.12);
        standpipe(b, px2, pz2, rot, rng.range(12, 26), rng, mats);
        t += rng.range(3, 6);
      } else if (pick < 0.88) {
        acCluster(b, x, z, rot, rng.range(14, 30), rng, mats);
        t += rng.range(4, 8);
      } else {
        fireEscape(b, x, z, rot, rng.range(14, 24), rng, mats);
        t += rng.range(6, 10);
      }
      // 같은 쪽에 몰리지 않게 자주 바꾼다
      if (rng.chance(0.62)) side = -side;
    }

    // 조명은 잡동사니와 **별도 루프**다. 같은 루프에 섞으면 확률에 밀려
    // 조명이 하나도 안 걸리는 구간이 생기고, 그 구간은 통째로 안 보인다.
    let lt = rng.range(3, 7);
    let lside = rng.chance(0.5) ? 1 : -1;
    while (lt < long - 2) {
      const along = -long / 2 + lt;
      const wallU = (ALLEY_WIDTH / 2) * lside;
      const lx = a.alongX ? c.x + along : c.x + wallU;
      const lz = a.alongX ? c.z + wallU : c.z + along;
      const lrot = a.alongX
        ? (lside > 0 ? -Math.PI / 2 : Math.PI / 2)
        : (lside > 0 ? Math.PI : 0);

      // 조명은 잡동사니보다 우선한다. 어두운 구간이 생기면 그 구간은
      // 통째로 안 보이게 되므로, 쓰레기통을 밀어내는 편이 낫다.
      if (claim(lx, lz, 1.0, TIER.LIGHT, 'alleyLamp')) {
        if (rng.chance(0.24)) backDoorSign(b, lx, lz, lrot, rng, mats, pools);
        else wallLamp(b, lx, lz, lrot, rng, mats, pools);
      }

      lt += rng.range(6.5, 10.5);
      lside = -lside;
    }

    // 입구 — 관통은 양쪽, 막다른 골목은 들어가는 쪽 하나
    const mouths = [];
    if (a.alongX) {
      if (a.kind === 'through' || a.fromLow) mouths.push([r.x0, c.z, [1, 0]]);
      if (a.kind === 'through' || !a.fromLow) mouths.push([r.x1, c.z, [-1, 0]]);
    } else {
      if (a.kind === 'through' || a.fromLow) mouths.push([c.x, r.z0, [0, 1]]);
      if (a.kind === 'through' || !a.fromLow) mouths.push([c.x, r.z1, [0, -1]]);
    }
    for (const [mx, mz, dir] of mouths) {
      alleyMouth(b, mx + dir[0] * 0.9, mz + dir[1] * 0.9, dir, rng, mats, pools);
    }

    alleyWindows(b, a, rng, mats, wallH, halfW);
    overhead(b, a, rng, mats, halfW);
  }

  return { group: b.build(scene), pools, count: alleys.length };
}
