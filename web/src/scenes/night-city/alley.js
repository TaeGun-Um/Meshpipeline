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
import { byZone } from './district.js';
import { hash2 } from '../../core/textures.js';

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

  // 문 위 전구 — **철망을 씌운다.** 갓등은 산업·레트로 계열이라 이 도시의
  // 골목과 안 맞는다 (alleyLamp 머리말). 서비스 도어 위에 실제로 붙는 것도
  // 갓이 아니라 파손 방지 철망을 두른 알전구다.
  const [gx, gz] = at(0.30);
  const [mx, mz] = at(0.10);
  const gy = y + H + 0.34;
  b.add(autoBox(0.2, 0.2, 0.2, [mx, gy, mz], 0.02), mats.ductMat);
  b.sphere(0.085, [gx, gy, gz], neon(NEON.warm));
  for (let i = 0; i < 4; i++) {
    const a2 = (i / 4) * Math.PI * 2 + 0.4;
    const ox = Math.cos(a2) * 0.14;
    const oy = Math.sin(a2) * 0.14;
    b.add(tubeBetween(
      [mx + ox * sin, gy + oy, mz - ox * cos],
      [gx + ox * sin * 0.35, gy + oy * 0.35, gz - ox * cos * 0.35], 0.011, 4), mats.pipeMat);
  }
  b.cylinder(0.15, 0.15, 0.018, [gx, gy, gz], mats.pipeMat, 10);

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

    // ── 빨래를 뺐다 (사용자 지시) ────────────────────────────────────────
    // "골목 생기는곳마다 저 공중에 부자연스럽게 떠있는 네모 형광이랑
    //  빨래건조대좀 없에봐"
    //
    // 의도는 "사람이 사는 흔적" 이었는데 화면에서는 **공중에 뜬 색 사각형**
    // 이었다. 이유는 매다는 줄이 반지름 2.5cm 라 몇 미터만 떨어져도 안
    // 보이기 때문이다 — 걸린 것만 남고 거는 것이 사라진 것이다.
    //
    // 슬럼 골조와 주거 발코니에는 빨래가 그대로 있다. 거기는 **난간에
    // 붙어 있어서** 무엇에 걸렸는지가 보인다. 같은 소품이라도 매달 곳이
    // 안 보이면 놓지 않는다.
    //
    // 난수는 그대로 소비한다 — 건너뛰면 뒤의 모든 생성이 밀린다.
    if (rng.chance(0.42)) {
      const m = rng.int(2, 5);
      for (let k = 0; k < m; k++) {
        rng.range(0.35, 0.7);
        rng.range(0.5, 1.1);
        rng.int(0, mats.laundryMats.length - 1);
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

// ── 골목 조명 네 종 (사용자 지적으로 다시 만듦) ────────────────────────────
//
// "갓달린 등이라는게 사이버펑크에 어울림?"
//
// 안 어울린다. 갓등(cone shade)은 산업·레트로 계열이고, 무엇보다 **이 도시의
// 설정과 안 맞는다.** 골목은 3기에 계획이 터지면서 생긴 틈이다. 관리되는
// 통로가 아니라 새어 나온 공간인데, 단정한 갓등이 일정 간격으로 달려 있으면
// 앞뒤가 안 맞는다 (슬럼에는 이미 훔친 전기가 벽을 타고 내려온다).
//
// 그리고 진짜 문제는 종류보다 **한 종류만 반복된다**는 것이었다. 같은 등이
// 같은 높이로 줄줄이 서 있으니 골목이 정돈돼 보였다.
//
//   형광등 스트립  가로 튜브. 몇 개는 죽어 있다. 골목 조명의 기본
//   철망 알전구    뒷문 위. 알을 철망으로 감쌌다
//   보안등         사각 플러드, 차가운 색. 아래를 비춘다
//   매단 알전구    훔친 배선에 그냥 매달았다. 기구가 없다
//
// 구역이 무엇을 쓰는지는 표가 정한다 — 스칼라 확률로 섞으면 어느 골목에
// 가도 같은 것이 나온다 (holo.RATE 에서 같은 실수를 했다).
const ALLEY_LAMP = byZone('골목 조명', {
  상업: ['tube', 'tube', 'cage', 'hung'],
  주거: ['tube', 'cage', 'cage', 'hung'],
  기업: ['security', 'security', 'tube'],   // 관리되는 곳이라 보안등이다
  공업: ['security', 'cage', 'security'],
  슬럼: ['hung', 'hung', 'cage'],           // 훔친 전기. 기구가 없다
  부둣가: ['security', 'cage'],
});

// 형광등 스트립 — 벽에 가로로 붙은 튜브. 몇 개는 죽어 있어야 나머지가 산다.
function tubeLamp(b, x, z, rot, y, mats, pools, dead) {
  const cos = Math.cos(rot);
  const sin = Math.sin(rot);
  const L = 1.5;
  const ax = Math.abs(cos) > 0.5; // 벽이 Z 축을 따라 눕는가
  const [w, d] = ax ? [0.16, L] : [L, 0.16];
  // 기구 — 죽었든 살았든 이건 있다
  b.add(autoBox(w, 0.18, d, [x + cos * 0.09, y, z + sin * 0.09], 0.02), mats.ductMat);
  if (dead) return; // 나간 등. 웅덩이도 없다
  const [tw, td] = ax ? [0.07, L - 0.18] : [L - 0.18, 0.07];
  b.box(tw, 0.1, td, [x + cos * 0.2, y, z + sin * 0.2], neon(NEON.cool));
  pools.push({
    kind: 'floor', x: x + cos * 1.1, y: CURB_HEIGHT + 0.02, z: z + sin * 1.1,
    rx: ax ? 3.0 : 4.6, rz: ax ? 4.6 : 3.0, tint: rgb01(NEON.cool, 0.3),
  });
  pools.push({
    kind: 'wall', x: x + cos * 0.06, y: y - 0.9, z: z + sin * 0.06,
    w: 3.0, h: 2.2, yaw: rot, tint: rgb01(NEON.cool, 0.32),
  });
}

// 철망 씌운 알전구 — 뒷문 위에 붙는 것. 철망이 있어야 '보호구' 로 읽힌다.
function cageLamp(b, x, z, rot, y, mats, pools) {
  const cos = Math.cos(rot);
  const sin = Math.sin(rot);
  const cx = x + cos * 0.22;
  const cz = z + sin * 0.22;
  // 벽 받침
  b.add(autoBox(0.24, 0.24, 0.24, [x + cos * 0.06, y, z + sin * 0.06], 0.02), mats.ductMat);
  b.sphere(0.1, [cx, y, cz], neon(NEON.warm));
  // 철망 — 살 넷과 테 하나
  for (let i = 0; i < 4; i++) {
    const a2 = (i / 4) * Math.PI * 2 + 0.4;
    const ox = Math.cos(a2) * 0.16;
    const oy = Math.sin(a2) * 0.16;
    b.add(tubeBetween(
      [x + cos * 0.08 + ox * sin, y + oy, z + sin * 0.08 - ox * cos],
      [cx + ox * sin * 0.4, y + oy * 0.4, cz - ox * cos * 0.4], 0.012, 4), mats.pipeMat);
  }
  b.cylinder(0.17, 0.17, 0.02, [cx, y, cz], mats.pipeMat, 10);
  pools.push({
    kind: 'floor', x: x + cos * 0.9, y: CURB_HEIGHT + 0.02, z: z + sin * 0.9,
    rx: 3.0, rz: 3.0, tint: rgb01(NEON.warm, 0.3),
  });
  pools.push({
    kind: 'wall', x: x + cos * 0.06, y: y - 1.0, z: z + sin * 0.06,
    w: 2.0, h: 2.4, yaw: rot, tint: rgb01(NEON.warm, 0.3),
  });
}

// 보안등 — 사각 플러드. 아래를 비춘다. 관리되는 구역의 것이라 차갑다.
function securityLamp(b, x, z, rot, y, mats, pools) {
  const cos = Math.cos(rot);
  const sin = Math.sin(rot);
  const ax = Math.abs(cos) > 0.5;
  b.add(tubeBetween([x, y, z], [x + cos * 0.3, y + 0.1, z + sin * 0.3], 0.03, 5), mats.metalMat);
  const hx = x + cos * 0.42;
  const hz = z + sin * 0.42;
  const [w, d] = ax ? [0.34, 0.5] : [0.5, 0.34];
  b.add(autoBox(w, 0.2, d, [hx, y, hz], 0.03), mats.metalMat);
  // 발광면은 아래를 향한다
  b.add(downPlane(ax ? 0.26 : 0.42, ax ? 0.42 : 0.26, [hx, y - 0.11, hz]), neon(NEON.cool));
  pools.push({
    kind: 'floor', x: hx + cos * 0.5, y: CURB_HEIGHT + 0.02, z: hz + sin * 0.5,
    rx: 3.4, rz: 3.4, tint: rgb01(NEON.cool, 0.4),
  });
}

// 매단 알전구 — 훔친 배선. **기구가 없는 것**이 요점이다.
function hungBulb(b, x, z, rot, y, mats, pools) {
  const cos = Math.cos(rot);
  const sin = Math.sin(rot);
  const wx = x + cos * 0.05;
  const wz = z + sin * 0.05;
  // 벽을 타고 내려온 선 — 위에서 비스듬히
  b.add(tubeBetween([wx, y + 2.2, wz], [wx + cos * 0.5, y + 0.1, wz + sin * 0.5], 0.02, 4),
    mats.cableMat);
  const bx = wx + cos * 0.5;
  const bz = wz + sin * 0.5;
  b.sphere(0.11, [bx, y, bz], neon(NEON.warm));
  // 소켓 — 이게 없으면 구슬이 떠 있는 것으로 보인다
  b.cylinder(0.045, 0.055, 0.1, [bx, y + 0.13, bz], mats.ductMat, 6);
  pools.push({
    kind: 'floor', x: bx, y: CURB_HEIGHT + 0.02, z: bz,
    rx: 2.6, rz: 2.6, tint: rgb01(NEON.warm, 0.34),
  });
}

// 종류 -> 형태. 표로 두면 새 종류를 빠뜨렸을 때 터진다.
const LAMP_SHAPE = { tube: tubeLamp, cage: cageLamp, security: securityLamp, hung: hungBulb };

// 어느 등을 놓을지는 **좌표 해시**가 정한다. 난수를 쓰면 뒤의 도시가 다시
// 뽑히고, 무엇보다 같은 자리는 늘 같은 등이어야 한다.
// 높이만 난수로 뽑는다 — 옛 갓등과 소비량을 맞춘다.
function alleyLamp(b, x, z, rot, rng, mats, pools, zone) {
  const y = CURB_HEIGHT + rng.range(2.9, 3.8);
  const kinds = ALLEY_LAMP[zone] ?? ALLEY_LAMP['상업'];
  if (!kinds.length) return;
  const h = hash2(Math.round(x), Math.round(z));
  const kind = kinds[Math.floor(h * kinds.length) % kinds.length];
  const make = LAMP_SHAPE[kind];
  if (!make) throw new Error(`골목 조명 '${kind}' 의 형태가 LAMP_SHAPE 에 없다`);
  if (kind === 'tube') {
    // 다섯에 하나는 나가 있다. 죽은 등이 있어야 산 등이 읽힌다
    tubeLamp(b, x, z, rot, y, mats, pools, hash2(Math.round(z), Math.round(x)) < 0.22);
    return;
  }
  make(b, x, z, rot, y, mats, pools);
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
// ── 벽이 실제로 어디 있나 (사용자 지적으로 추가) ───────────────────────────
//
// "골목이라고 생성된 곳 보면 이상한 네모 형광이 양쪽 공중에 더덕더덕 붙어있음"
//
// `a.w` 는 **필지 사이 틈의 폭**이지 건물 사이 거리가 아니다. 골목은 필지를
// 자른 자리를 벌린 틈인데(layout.splitToTarget), 건물은 그 필지 안에서 **다시
// 물러나 선다** — 명품관은 3.4~5.2m, 슬럼은 3%, 기업 타워는 10~19%.
//
// 그래서 틈의 절반(halfW)에 창을 붙이면 실제 벽에서 최대 5m 떨어진 허공이다.
// 벽을 안 세우기로 한 순간(#42) **벽이 어디인지는 이웃 건물만 안다**가 됐는데,
// 소품은 여전히 틈 폭을 보고 있었다.
//
// 그리고 이웃이 아예 없으면 붙일 벽이 없다 — 그때는 **아무것도 그리지 않는다.**
// 오늘 골목 빨래에서 배운 것과 같다: 매달 곳이 안 보이면 놓지 않는다.
function wallDistance(a, side, solids) {
  const c = rectCenter(a.rect);
  const s = rectSize(a.rect);
  const alongX = a.alongX;
  // 골목이 뻗는 구간 (겹치는 건물만 본다)
  const lo = alongX ? a.rect.x0 : a.rect.z0;
  const hi = alongX ? a.rect.x1 : a.rect.z1;
  const mid = alongX ? c.z : c.x;
  const room = (alongX ? s.d : s.w) / 2;

  let best = Infinity;
  for (const q of solids) {
    const qlo = alongX ? q.x0 : q.z0;
    const qhi = alongX ? q.x1 : q.z1;
    if (qhi < lo + 0.5 || qlo > hi - 0.5) continue; // 골목을 따라 안 걸친다
    const nlo = alongX ? q.z0 : q.x0;
    const nhi = alongX ? q.z1 : q.x1;
    // 그 건물이 이 side 쪽에 있고, 골목 안쪽을 향한 면까지의 거리
    const face = side > 0 ? nlo : nhi;
    const d = (face - mid) * side;
    if (d < room - 0.6) continue;   // 골목 안까지 들어온 것 (다른 건물)
    if (d > room + 9) continue;     // 너무 멀다 — 이 골목의 벽이 아니다
    if (d < best) best = d;
  }
  return Number.isFinite(best) ? best : null;
}

// ── 골목 창을 뺐다 (사용자 지시) ───────────────────────────────────────────
//
// "골목이라고 생성된 곳 보면 이상한 네모 형광이 양쪽 공중에 더덕더덕 붙어있음.
//  이거 체크해서 없에"  /  "고집 그만 부리고 창문 없에면 안되냐고"
//
// 의도는 "벽이 사람이 있는 건물의 뒷면으로 읽히게" 였는데, 화면에서는 공중에
// 더덕더덕 붙은 형광 사각형이었다. 위치를 실제 벽에 맞추는 쪽으로 고쳐 봤지만
// 사용자가 그걸 원한 게 아니었다 — **없애 달라는 것이었다.**
//
// 골목 빨래와 같은 결론이다. 붙일 곳이 확실하지 않은 것은 놓지 않는다.
// 골목의 어둠은 결함이 아니라 이 구역의 성격이다. 벽등·뒷문 간판·설비는
// 벽에 확실히 붙어 있으므로 그대로 둔다.
//
// 난수는 그대로 소비한다 — 건너뛰면 뒤의 모든 생성이 밀린다.
function alleyWindows(b, a, rng, mats, wallH, halfW, solids) {
  const sz = rectSize(a.rect);
  const long = a.alongX ? sz.w : sz.d;
  void halfW; void solids; void mats; void b;

  for (const side of [-1, 1]) {
    void side;
    const cols = Math.max(2, Math.round(long / 11));
    for (let ci = 0; ci < cols; ci++) {
      rng.range(-1.6, 1.6);
      rng.range(0.55, 0.95);
      rng.range(0.7, 1.05);
      rng.chance(0.68);
      const top = Math.min(wallH - 2.5, rng.range(16, 26));
      for (let fy = 4.6; fy < top; fy += 3.6) rng.chance(0.5 * (1 - (fy - 4.6) / 46));
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

export function createAlleys(scene, rng, mats, alleys, anchors = []) {
  const b = new MeshBuilder('Alleys');
  const pools = [];
  // 벽이 어디인지는 이웃 건물만 안다 (wallDistance 머리말).
  const solids = anchors.map((x) => x.solid || x.rect);

  for (const a of alleys) {
    // 구역이 벽 높이를 정한다. 골목 벽은 양옆 건물의 옆면을 대신하는 것이라
    // 그 구역 건물보다 높으면 담장이 치솟은 꼴이 된다.
    // 벽을 안 세우므로 벽 높이도 없다. 창은 양옆 건물 면에 붙으므로
    // 그 건물 높이를 넘지 않을 만큼만 올린다 (구역별 대표 높이).
    const wallH = WALL_H_BY_ZONE[a.zone] ?? WALL_H_DEFAULT;
    // 벽 높이를 meta 에 실어 둔다. 검사가 "골목 벽이 이웃 건물보다 높나" 를
    // 본다 — 벽 높이를 고정으로 두고 구역 건물 높이를 안 봐서 담장이 공장
    // 위로 치솟은 적이 있다 (docs/status.md 4번).
    b.mark('alley', `alley:${a.rect.x0.toFixed(0)},${a.rect.z0.toFixed(0)}`, { zone: a.zone });
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
      // 벽면 위치와 벽이 바라보는 방향(골목 안쪽).
      // 창과 같은 이유로 **실제 벽까지의 거리**를 쓴다 — 배관·실외기·뒷문이
      // 틈 폭에 붙으면 벽에서 몇 미터 떨어져 뜬다 (wallDistance 머리말).
      const wallU = (wallDistance(a, side, solids) ?? halfW) * side;
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
      // 등도 벽에 붙는다. 전역 ALLEY_WIDTH 를 쓰고 있었는데, 그건 틈 폭도
      // 아니고 그냥 기본값이라 등이 벽에서 떨어져 떴다 (wallDistance 머리말).
      const wallU = (wallDistance(a, lside, solids) ?? halfW) * lside;
      const lx = a.alongX ? c.x + along : c.x + wallU;
      const lz = a.alongX ? c.z + wallU : c.z + along;
      const lrot = a.alongX
        ? (lside > 0 ? -Math.PI / 2 : Math.PI / 2)
        : (lside > 0 ? Math.PI : 0);

      // 조명은 잡동사니보다 우선한다. 어두운 구간이 생기면 그 구간은
      // 통째로 안 보이게 되므로, 쓰레기통을 밀어내는 편이 낫다.
      if (claim(lx, lz, 1.0, TIER.LIGHT, 'alleyLamp')) {
        if (rng.chance(0.24)) backDoorSign(b, lx, lz, lrot, rng, mats, pools);
        else alleyLamp(b, lx, lz, lrot, rng, mats, pools, a.zone);
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

    alleyWindows(b, a, rng, mats, wallH, halfW, solids);
    overhead(b, a, rng, mats, halfW);
  }

  return { group: b.build(scene), pools, count: alleys.length };
}
