// 부둣가 — 물류가 도시로 들어오는 지점.
//
// ── 왜 별도의 구역인가 ─────────────────────────────────────────────────────
// 사용자가 손으로 그린 배치도에서 부둣가는 공장과 **따로** 칠해져 있었다.
// 맞는 구분이다.
//
//   공업   만드는 곳. 건물이 주인공이고 그 안에 기계가 있다
//   부둣가 옮기는 곳. **부지가 주인공**이고 건물은 곁다리다
//
// 그래서 형태 원리가 정반대다. 공장동은 높이 11~20m 의 덩어리인데,
// 부둣가는 지면이 꽉 차 있고 높이는 컨테이너 네 단(10m)이 전부다.
// 도시에서 유일하게 **건물보다 물건이 많은** 곳이고, 하늘이 넓게 보이는 곳이다.
//
// ── 무엇을 놓는가 ──────────────────────────────────────────────────────────
// 대지 하나가 넷 중 하나가 된다. 한 가지만 반복하면 부지가 아니라 무늬다.
//
//   적치장   컨테이너를 격자로 쌓는다. 부둣가의 바닥 그 자체
//   창고     길고 낮은 한 동 + 도크 문 여러 개. 트럭이 물러서 붙는 곳
//   트럭 야드 트레일러가 열 맞춰 선 자리 + 야드 조명탑
//   야적장   철망으로 두르고 드럼통·강재·목재 더미만 있는 빈 부지
//
// 넷 다 공통으로 **철망 울타리와 게이트**를 두른다. 이것이 "여기부터 사유지,
// 그리고 아무나 못 들어간다" 를 말하고, 기업 구역의 광장 볼라드와 정확히
// 같은 일을 값싼 재료로 한다.
import * as THREE from 'three';
import { autoBox, tubeBetween } from '../../core/profile.js';
import { SIDES, shrink, rectBox, upPlane, rectCenter, rectSize } from '../../core/boxfaces.js';
import { rgb01 } from '../../shared/neon.js';
import { neon, neonSoft } from '../../shared/masters.js';
import { PANEL_TILE, CURB_HEIGHT } from './layout.js';

// 40피트 컨테이너. 실제 치수다 — 크기가 알려진 물건이라야 옆의 크레인이
// 얼마나 큰지 읽힌다 (port.js 컨테이너 야드와 같은 값을 쓴다).
const CW = 2.5;
const CH = 2.6;
const CL = 12.2;

// ── 철망 울타리 ────────────────────────────────────────────────────────────
//
// 기둥 + 가로대 + 면. 면은 반투명 판 하나로 근사한다. 이 거리에서 철망의
// 그물눈은 어차피 안 보이고, 보이는 것은 **기둥의 리듬**이다.
function fence(b, r, rng, mats, gateSide) {
  const H = 2.6;
  const c = rectCenter(r);
  const s = rectSize(r);
  for (const side of SIDES) {
    const alongX = side === 'pz' || side === 'nz';
    const len = alongX ? s.w : s.d;
    if (len < 6) continue;
    const px = side === 'px' ? r.x1 : side === 'nx' ? r.x0 : c.x;
    const pz = side === 'pz' ? r.z1 : side === 'nz' ? r.z0 : c.z;

    // 기둥 — 3.2m 간격. 게이트 자리는 비운다
    const n = Math.max(2, Math.round(len / 3.2));
    const gate = side === gateSide ? rng.int(1, Math.max(1, n - 2)) : -1;
    for (let i = 0; i <= n; i++) {
      if (i === gate || i === gate + 1) continue;
      const t = -len / 2 + len * (i / n);
      b.box(0.16, H, 0.16,
        [alongX ? c.x + t : px, CURB_HEIGHT + H / 2, alongX ? pz : c.z + t],
        mats.metalMat);
    }
    // 가로대 위아래
    for (const y of [H - 0.15, 0.5]) {
      b.box(alongX ? len : 0.08, 0.08, alongX ? 0.08 : len,
        [alongX ? c.x : px, CURB_HEIGHT + y, alongX ? pz : c.z],
        mats.metalMat);
    }
    // 게이트 — 기둥 두 개가 빠진 자리에 붉은 차단봉과 초소
    if (gate >= 0) {
      const t = -len / 2 + len * ((gate + 0.5) / n);
      const gx = alongX ? c.x + t : px;
      const gz = alongX ? pz : c.z + t;
      b.box(alongX ? 3.4 : 0.18, 0.18, alongX ? 0.18 : 3.4,
        [gx, CURB_HEIGHT + 1.1, gz], mats.hazardMat);
      b.add(autoBox(2.0, 2.6, 2.0, [gx + (alongX ? 3.0 : 0), CURB_HEIGHT + 1.3, gz + (alongX ? 0 : 3.0)], 0.06),
        mats.factoryDarkMat);
      b.sphere(0.14, [gx, CURB_HEIGHT + 2.4, gz], neon(0xff8a2a));
    }
  }
}

// ── 야드 조명탑 ────────────────────────────────────────────────────────────
//
// 부둣가에 가로등은 없다. 대신 20m 짜리 조명탑이 부지 전체를 위에서 때린다.
// **이 구역이 밤에 밝은 이유가 이것뿐**이라 하나에 웅덩이를 크게 준다.
function mast(b, x, z, rng, mats, pools) {
  const H = rng.range(16, 24);
  b.cylinder(0.28, 0.42, H, [x, CURB_HEIGHT + H / 2, z], mats.metalMat, 8);
  b.box(3.6, 0.5, 1.2, [x, CURB_HEIGHT + H, z], mats.metalMat);
  for (let i = -1; i <= 1; i++) {
    b.box(1.0, 0.5, 0.9, [x + i * 1.3, CURB_HEIGHT + H - 0.35, z], neonSoft(0xffe9c4));
  }
  b.sphere(0.18, [x, CURB_HEIGHT + H + 0.6, z], neon(0xff2a2a));
  pools.push({
    kind: 'floor', x, y: CURB_HEIGHT + 0.05, z,
    rx: H * 1.5, rz: H * 1.5, tint: rgb01(0xffe9c4, 0.55),
  });
}

// ── 1) 컨테이너 적치장 ─────────────────────────────────────────────────────
function containerLot(b, r, rng, mats, pools) {
  const c = rectCenter(r);
  const s = rectSize(r);
  b.add(upPlane(s.w, s.d, [c.x, CURB_HEIGHT + 0.02, c.z], [5, 5]), mats.asphaltMat);

  // 통로를 남긴다. 없으면 컨테이너 한 덩어리라 야드로 안 읽힌다 —
  // 야드는 **장비가 지나갈 길이 있는** 곳이다.
  const LANE = 7.0;
  const bay = CL + 1.4;
  const rows = Math.max(1, Math.floor(s.d / bay));
  const cols = Math.max(2, Math.floor(s.w / (CW + 0.4)));
  const perLane = 6; // 여섯 줄마다 통로 하나

  for (let j = 0; j < rows; j++) {
    const z = r.z0 + bay * (j + 0.5);
    if (z > r.z1) break;
    let x = r.x0 + 1;
    for (let i = 0; i < cols; i++) {
      if (i > 0 && i % perLane === 0) x += LANE;
      if (x + CW > r.x1) break;
      if (rng.chance(0.78)) {
        const stack = rng.int(1, 4);
        for (let k = 0; k < stack; k++) {
          // 위로 갈수록 살짝 어긋나게 — 기계가 쌓아도 완벽하진 않다
          const jx = k === 0 ? 0 : rng.range(-0.12, 0.12);
          const jz = k === 0 ? 0 : rng.range(-0.3, 0.3);
          b.box(CW, CH, CL, [x + CW / 2 + jx, CURB_HEIGHT + CH * (k + 0.5), z + jz],
            rng.chance(0.5) ? mats.crateAltMat : mats.dumpsterMat);
        }
      }
      x += CW + 0.4;
    }
  }
  mast(b, c.x + s.w * rng.range(-0.3, 0.3), c.z + s.d * rng.range(-0.35, 0.35), rng, mats, pools);
  return CURB_HEIGHT + CH * 4;
}

// ── 2) 창고 ────────────────────────────────────────────────────────────────
//
// 길고 낮은 한 동. **도크 문이 정체성**이다 — 트럭이 물러서 붙는 자리라
// 문이 바닥이 아니라 트럭 짐칸 높이(1.2m)에 있다.
function warehouse(b, r, rng, mats, pools) {
  const yard = shrink(r, 3);
  const s = rectSize(yard);
  if (Math.min(s.w, s.d) < 12) return containerLot(b, r, rng, mats, pools);
  const c = rectCenter(yard);

  b.add(upPlane(rectSize(r).w, rectSize(r).d, [rectCenter(r).x, CURB_HEIGHT + 0.02, rectCenter(r).z], [5, 5]),
    mats.asphaltMat);

  // 동은 짧은 쪽으로 붙이고 긴 쪽에 마당(트럭이 도는 자리)을 남긴다
  const alongX = s.w >= s.d;
  const depth = Math.min(alongX ? s.d : s.w, 34) * 0.72;
  const body = alongX
    ? { x0: yard.x0, x1: yard.x1, z0: yard.z0, z1: yard.z0 + depth }
    : { x0: yard.x0, x1: yard.x0 + depth, z0: yard.z0, z1: yard.z1 };

  const H = rng.range(11, 16);
  b.add(rectBox(body, CURB_HEIGHT, H, PANEL_TILE), mats.panelMat);
  // 처마와 골강판 리브 — 창고 벽은 늘 세로 골이 있다
  const bs = rectSize(body);
  const bc = rectCenter(body);
  const ribs = Math.max(4, Math.round((alongX ? bs.w : bs.d) / 3.0));
  for (let i = 1; i < ribs; i++) {
    const t = (i / ribs - 0.5) * (alongX ? bs.w : bs.d);
    for (const sg of [-1, 1]) {
      b.box(alongX ? 0.16 : 0.2, H, alongX ? 0.2 : 0.16,
        [alongX ? bc.x + t : bc.x + sg * (bs.w / 2 + 0.1),
         CURB_HEIGHT + H / 2,
         alongX ? bc.z + sg * (bs.d / 2 + 0.1) : bc.z + t],
        mats.metalMat);
    }
  }
  b.add(rectBox(shrink(body, -0.7), CURB_HEIGHT + H, 0.5, PANEL_TILE), mats.metalMat);

  // 도크 문 — 마당을 바라보는 면에. 1.2m 단 위에 셔터.
  const dockZ = alongX ? body.z1 : body.x1;
  const n = Math.max(3, Math.round((alongX ? bs.w : bs.d) / 9));
  for (let i = 0; i < n; i++) {
    const t = (-(n - 1) / 2 + i) * ((alongX ? bs.w : bs.d) / n);
    const dx = alongX ? bc.x + t : dockZ + 0.3;
    const dz = alongX ? dockZ + 0.3 : bc.z + t;
    // 단
    b.box(alongX ? 5.0 : 1.6, 1.2, alongX ? 1.6 : 5.0,
      [alongX ? dx : dx - 0.4, CURB_HEIGHT + 0.6, alongX ? dz - 0.4 : dz], mats.quayMat);
    // 셔터
    b.box(alongX ? 4.2 : 0.16, 4.4, alongX ? 0.16 : 4.2,
      [dx, CURB_HEIGHT + 3.4, dz], mats.shutterMat);
    // 문 위 작업등
    b.box(alongX ? 1.2 : 0.3, 0.22, alongX ? 0.3 : 1.2,
      [dx, CURB_HEIGHT + 5.9, dz], neonSoft(0xffc98a));
    pools.push({
      kind: 'floor', x: alongX ? dx : dx + 3, y: CURB_HEIGHT + 0.04, z: alongX ? dz + 3 : dz,
      rx: 5, rz: 5, tint: rgb01(0xffc98a, 0.4),
    });
  }

  mast(b, alongX ? c.x : c.x + s.w * 0.3, alongX ? c.z + s.d * 0.3 : c.z, rng, mats, pools);
  return CURB_HEIGHT + H;
}

// ── 3) 트럭 야드 ───────────────────────────────────────────────────────────
//
// 배송 체계가 눈에 보이는 곳. 트레일러가 열 맞춰 선다.
function truckYard(b, r, rng, mats, pools) {
  const c = rectCenter(r);
  const s = rectSize(r);
  b.add(upPlane(s.w, s.d, [c.x, CURB_HEIGHT + 0.02, c.z], [5, 5]), mats.asphaltMat);

  // 트레일러 — 길이 13.6m, 폭 2.6m. 컨테이너와 같은 물건을 싣는다
  const TL = 13.6;
  const TW = 2.6;
  const cols = Math.max(2, Math.floor(s.w / (TW + 1.6)));
  const rows = Math.max(1, Math.floor(s.d / (TL + 6)));
  for (let i = 0; i < cols; i++) {
    for (let j = 0; j < rows; j++) {
      if (!rng.chance(0.62)) continue;
      const x = r.x0 + (TW + 1.6) * (i + 0.6);
      const z = r.z0 + (TL + 6) * (j + 0.5);
      // 짐칸
      b.add(autoBox(TW, 2.9, TL, [x, CURB_HEIGHT + 2.6, z], 0.06),
        rng.chance(0.4) ? mats.crateAltMat : mats.panelMat);
      // 랜딩기어와 바퀴 — 없으면 상자가 공중에 뜬다
      b.box(TW * 0.8, 1.15, 0.4, [x, CURB_HEIGHT + 0.6, z - TL * 0.36], mats.metalMat);
      for (const w of [-0.3, 0.3]) {
        b.cylinder(0.5, 0.5, 0.3, [x + w * TW, CURB_HEIGHT + 0.5, z + TL * 0.34], mats.metalMat, 8);
      }
      // 절반쯤은 트랙터가 붙어 있다
      if (rng.chance(0.45)) {
        b.add(autoBox(TW, 2.6, 5.2, [x, CURB_HEIGHT + 1.7, z + TL / 2 + 2.8], 0.1), mats.factoryDarkMat);
        b.box(TW * 0.9, 0.5, 0.1, [x, CURB_HEIGHT + 2.4, z + TL / 2 + 5.3], neonSoft(0xffd9a0));
      }
    }
  }
  mast(b, c.x + s.w * 0.34, c.z, rng, mats, pools);
  mast(b, c.x - s.w * 0.34, c.z, rng, mats, pools);
  return CURB_HEIGHT + 3.6;
}

// ── 4) 야적장 ──────────────────────────────────────────────────────────────
//
// 건물이 하나도 없는 부지. 도시에 이런 곳이 있어야 부둣가가 "빈 땅이 많은
// 곳" 으로 읽힌다 — 전부 꽉 차 있으면 그냥 또 다른 밀집 구역이다.
function openYard(b, r, rng, mats, pools) {
  const c = rectCenter(r);
  const s = rectSize(r);
  b.add(upPlane(s.w, s.d, [c.x, CURB_HEIGHT + 0.02, c.z], [5, 5]), mats.asphaltMat);

  const piles = rng.int(3, 7);
  for (let i = 0; i < piles; i++) {
    const px = c.x + rng.range(-s.w * 0.36, s.w * 0.36);
    const pz = c.z + rng.range(-s.d * 0.36, s.d * 0.36);
    const pick = rng.next();
    if (pick < 0.34) {
      // 드럼통 무리
      for (let k = 0; k < rng.int(6, 16); k++) {
        b.cylinder(0.32, 0.32, 0.9,
          [px + rng.range(-2.4, 2.4), CURB_HEIGHT + 0.45, pz + rng.range(-2.4, 2.4)],
          rng.chance(0.4) ? mats.rustMat : mats.hazardMat, 8);
      }
    } else if (pick < 0.7) {
      // 강재 더미 — 길게 눕힌 관 다발
      const n = rng.int(3, 6);
      for (let k = 0; k < n; k++) {
        b.add(tubeBetween([px - 5, CURB_HEIGHT + 0.4 + k * 0.1, pz + k * 0.75],
                          [px + 5, CURB_HEIGHT + 0.4 + k * 0.1, pz + k * 0.75], 0.34, 6), mats.rustMat);
      }
    } else {
      // 목재·자재 더미 — 방수포를 덮었다
      b.add(autoBox(rng.range(4, 8), rng.range(1.4, 2.6), rng.range(3, 6),
        [px, CURB_HEIGHT + 1.1, pz], 0.1), mats.tarpMat);
    }
  }
  mast(b, c.x + s.w * 0.3, c.z + s.d * 0.28, rng, mats, pools);
  return CURB_HEIGHT + 2.6;
}

// ── 한 대지 ────────────────────────────────────────────────────────────────
export function wharfBlock(b, r, rng, mats, pools) {
  const s = rectSize(r);
  // 울타리를 안쪽으로 물린다. 대지 경계에 딱 세우면 인도 위에 선다.
  const lot = shrink(r, 1.6);
  if (Math.min(rectSize(lot).w, rectSize(lot).d) < 10) {
    b.add(upPlane(s.w, s.d, [rectCenter(r).x, CURB_HEIGHT + 0.02, rectCenter(r).z], [5, 5]), mats.asphaltMat);
    return { top: CURB_HEIGHT };
  }

  const pick = rng.next();
  let top;
  if (pick < 0.34) top = containerLot(b, lot, rng, mats, pools);
  else if (pick < 0.62) top = warehouse(b, lot, rng, mats, pools);
  else if (pick < 0.84) top = truckYard(b, lot, rng, mats, pools);
  else top = openYard(b, lot, rng, mats, pools);

  fence(b, lot, rng, mats, SIDES[rng.int(0, 3)]);
  return { top };
}
