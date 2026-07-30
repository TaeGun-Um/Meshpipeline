// 타워 — 포디움(저층 상가) · 몸통(세트백) · 크라운(옥상).
//
// ── 건물이 "상자" 로 보이지 않게 하는 세 가지 ───────────────────────────────
//   1) 세트백 — 위로 갈수록 발판이 줄어드는 계단형 실루엣
//   2) 층 띠  — 몇 층마다 튀어나온 슬래브가 수평 리듬을 만든다
//   3) 포디움 — 저층부가 몸통보다 넓게 튀어나와 가로 스케일을 만든다
// 이 셋이 없으면 창문 텍스처를 아무리 잘 만들어도 격자 무늬 육면체다.
//
// 간판은 직접 만들지 않고 요청 목록만 남긴다 (signage.js 가 한 번에 만든다).
// 배색 조합당 텍스처 한 장을 공유해야 하기 때문이다.
import { MeshBuilder } from '../../core/builder.js';
import {
  SIDES,
  outward,
  faceWidth,
  faceAnchor,
  bayRect,
  shrink,
  rectBox,
  facePlane,
  downPlane,
} from '../../core/boxfaces.js';
import { autoBox } from '../../core/profile.js';
import {
  FLOOR_HEIGHT,
  PODIUM_FLOOR,
  BLOCK_SIZE,
  subdivideBlock,
  pickHeight,
  coreDistance,
} from './layout.js';
import { SHOP_TINTS } from './materials.js';
import { NEON, rgb01 } from '../../shared/neon.js';
import { neon } from '../../shared/masters.js';
import { createCrown } from './rooftop.js';
import { applySkin, facadeRelief } from './facade.js';
import { districtAt, pickArchetypeIn } from './district.js';
import { pickMassing, footprint, cylinderMass } from './massing.js';
import { LANDMARK_BLOCKS } from './landmark.js';
import { buildBay, ALCOVE, SHOP_H, showcase } from './shopfront.js';

// 창 한 칸 가로 폭 (m). 2.1 로 두면 폭 20m 건물에 창이 10개뿐이라 창 하나가
// 거대해 보인다. 레퍼런스는 같은 폭에 창이 15개 안팎이다.
const WINDOW_PITCH_X = 1.55;
const PANEL_TILE = 7.0; // 콘크리트 패널 반복 간격 (m)
const BAND_EVERY = 4; // 몇 층마다 층 띠를 두를지

// 점포 색온도별 바닥 웅덩이 색. materials.SHOP_TINTS 와 순서가 같다.
const SHOP_WASH = SHOP_TINTS.map((hex) => rgb01(hex, 0.62));

// ── 포디움 ─────────────────────────────────────────────────────────────────

// 길에 면하는 면인가.
//
// ── 왜 필요한가 (예산의 핵심) ───────────────────────────────────────────────
// 블록은 BSP 로 여러 필지로 쪼개진다. 그중 블록 안쪽에 있는 필지의 면은 옆 건물과
// 1m 도 안 떨어져 있어 **어느 각도에서도 절대 보이지 않는다.** 그런데 거기에도
// 벽감·점포·차양·마네킹을 똑같이 만들고 있었다.
//
// 실측: 건물 지오메트리 958,000 삼각형 중 대부분이 1층 점포였고, 그 절반 이상이
// 보이지 않는 면이었다. 이건 LOD 가 아니라 그냥 낭비다 — 지워도 잃는 게 없다.
function streetFaces(r, blk) {
  const half = BLOCK_SIZE / 2;
  const m = 4.0; // 블록 경계에서 이 거리 안쪽이면 길에 면한 것으로 본다
  return {
    px: r.x1 > blk.cx + half - m,
    nx: r.x0 < blk.cx - half + m,
    pz: r.z1 > blk.cz + half - m,
    nz: r.z0 < blk.cz - half + m,
  };
}

// 저층 상가. 도로에서 보이는 유일한 부분이라 여기 밀도가 도시의 인상을 만든다.
//
// 구역(district)이 밀도와 밝기를 정한다. 상업 구역은 간판이 벽을 뒤덮고 점포가
// 눈부시게 밝지만, 공업 구역은 거의 캄캄하다. **그 대비가 탐험할 이유를 만든다** —
// 어디를 가도 같은 밝기면 갈 곳이 없다.
//
// faces 는 길에 면하는 면만 true 다. 나머지 면은 벽으로 메운다.
function podium(b, r, h, rng, mats, signs, pools, D, faces) {
  // ── 벽감 ────────────────────────────────────────────────────────────────
  // 저층 띠를 ALCOVE 만큼 들여서 만든다. 그러면 가게마다 실제 깊이 1.3m 의
  // 공간이 생기고, 그 안을 유형별로 다르게 채울 수 있다.
  // 예전처럼 통짜 박스에 평면을 붙이면 아무리 텍스처를 바꿔도 형태가 똑같다.
  const inner = shrink(r, ALCOVE);
  b.add(rectBox(inner, 0, SHOP_H, PANEL_TILE), mats.tileWallMat);
  b.add(rectBox(r, SHOP_H, Math.max(0.5, h - SHOP_H), PANEL_TILE), mats.tileWallMat);
  // 벽감 천장
  b.add(rectBox(r, SHOP_H - 0.14, 0.14, PANEL_TILE), mats.frameMat);

  // 1층 점포 띠. 개구부를 실제로 뚫지 않고 발광 면으로 처리한다 — 도시 규모에서는
  // 카메라가 점포 안을 들여다볼 일이 거의 없고, 블록마다 뚫으면 지오메트리가
  // 몇 배가 된다. (골목 규모의 씬이라면 반대 판단을 해야 한다.)
  //
  // 다만 면 전체를 한 장으로 덮으면 안 된다. 30m 짜리 통짜 발광판이 되어
  // "형광 페인트 칠한 판자" 로 보인다. 베이로 쪼개고 사이에 기둥을 남긴다.
  const shopY = 0.06;
  for (const side of SIDES) {
    const fw = faceWidth(r, side);
    const bays = Math.max(2, Math.round(fw / 6.5));
    const bayW = fw / bays;
    const o = outward(side);

    // 길에 면하지 않는 면은 벽감을 통째로 메운다 (박스 하나).
    // 점포를 만들어 봐야 옆 건물에 가려 아무도 못 본다.
    if (!faces[side]) {
      const fill = { ...r };
      if (side === 'px') fill.x0 = r.x1 - ALCOVE;
      else if (side === 'nx') fill.x1 = r.x0 + ALCOVE;
      else if (side === 'pz') fill.z0 = r.z1 - ALCOVE;
      else fill.z1 = r.z0 + ALCOVE;
      b.add(rectBox(fill, 0, SHOP_H, PANEL_TILE), mats.tileWallMat);
      continue;
    }

    // 베이 경계 기둥 — 벽감을 가게 단위로 끊는다
    for (let i = 0; i <= bays; i++) {
      const pr = bayRect(r, side, Math.min(i, bays - 1), bays, 0);
      const a = faceAnchor(pr, side);
      const edge = i === bays ? 0.5 : -0.5;
      const px = o.oz ? a.x + edge * bayW : a.x - o.ox * (ALCOVE / 2);
      const pz = o.oz ? a.z - o.oz * (ALCOVE / 2) : a.z + edge * bayW;
      const [dx, dz] = o.oz ? [0.55, ALCOVE] : [ALCOVE, 0.55];
      b.add(autoBox(dx, SHOP_H, dz, [px, SHOP_H / 2, pz], 0.04), mats.tileWallMat);
    }

    for (let i = 0; i < bays; i++) {
      const sub = bayRect(r, side, i, bays, bayW * 0.06);

      // 유형별 점포 — 깊이·차양·출입구·밖으로 나온 물건이 제각각이다
      if (rng.chance(0.14)) {
        showcase(b, sub, side, shopY, SHOP_H, rng, mats);
      } else {
        buildBay(b, sub, side, shopY, rng, mats, D, signs);
      }

      // 점포가 앞 보도를 물들인다. 구역이 밝을수록 넓고 진하게.
      const kind = rng.int(0, SHOP_WASH.length - 1);
      const a = faceAnchor(sub, side);
      const gain = D.poolGain;
      pools.push({
        kind: 'floor',
        x: a.x + o.ox * 3.0,
        y: 0.21,
        z: a.z + o.oz * 3.0,
        rx: (o.ox ? 4.0 : bayW * 0.55) * (1 + (gain - 1) * 0.45),
        rz: (o.oz ? 4.0 : bayW * 0.55) * (1 + (gain - 1) * 0.45),
        tint: SHOP_WASH[kind].map((v) => Math.min(1, v * gain)),
      });

      // ── 돌출 세로 간판 ──
      // 벽에 붙은 판은 정면에서만 보이지만, 튀어나온 간판은 측면에서도 줄줄이
      // 보인다. 거리를 걸을 때 앞으로 이어지는 리듬을 만드는 것이 이것이다.
      //
      // 위쪽 끝을 차양 아래로 제한한다. 차양은 0.9~1.7m 나오는데 간판은 0.5m
      // 남짓이라, 간판이 차양 높이까지 올라가면 **차양이 간판을 관통해 자른다.**
      // 실제로 세로 간판이 가로 띠에 잘린 채 렌더됐다.
      if (rng.chance(D.bladeChance * 0.5)) {
        const top = SHOP_H * 0.76; // 차양(0.82~0.95) 밑
        const by = shopY + rng.range(0.25, 0.6);
        const bh = Math.min(rng.range(1.6, 2.4), top - by);
        if (bh > 1.0) {
          signs.push({
            kind: 'blade',
            rect: sub,
            side,
            y: by,
            w: bh / 4.2,
            h: bh,
            scheme: rng.int(0, 5),
          });
        }
      }
    }
  }

  // 처마 — 포디움 상단에서 도로로 내민다
  const canopy = shrink(r, -0.8);
  b.add(rectBox(canopy, h - 0.45, 0.3, PANEL_TILE), mats.panelMat);

  // 처마 띠. 색은 **구역 팔레트**에서 고른다 — 구역마다 거리의 색이 달라야
  // 이동했다는 게 느껴진다. 전부 시안이면 어디를 가도 같은 거리다.
  //
  // 높이가 중요하다. 예전에는 h-0.75 에 뒀는데 처마 슬래브는 h-0.45 ~ h-0.15 라
  // 띠가 슬래브 아래 허공에 16cm 떠 있었다. 항공 뷰에서 건물과 분리된 **공중의
  // 형광 와이어**로 보인 원인이다. 슬래브 옆면 안에 붙인다.
  const trim = neon(D.trim[rng.int(0, D.trim.length - 1)]);
  for (const side of SIDES) {
    b.add(facePlane(canopy, h - 0.4, 0.16, side, null, 0.02), trim);
  }

  // ── 간판 ────────────────────────────────────────────────────────────────
  // 상업 구역은 배너를 한 면에 여러 층으로 쌓는다. 2077 의 재팬타운이 그렇게
  // 보이는 이유는 간판이 많아서가 아니라 **겹쳐 쌓여 있어서**다.
  const rows = Math.max(1, Math.round(D.signDensity));
  for (const side of SIDES) {
    if (!faces[side]) continue; // 안 보이는 면에는 간판도 달지 않는다
    for (let k = 0; k < rows; k++) {
      if (rng.chance(0.28)) continue;
      const bh = rng.range(1.1, 1.8);
      signs.push({
        kind: 'banner',
        rect: r,
        side,
        y: h - 2.6 - k * (bh + 0.35),
        w: faceWidth(r, side) * rng.range(0.5, 0.86),
        h: bh,
        scheme: rng.int(0, 5),
      });
    }
  }
}

// ── 몸통 ───────────────────────────────────────────────────────────────────

function shaft(b, r0, y0, top, rng, mats, kind, skinIdx, signs, massing, orient) {
  // 세트백 단계. 높으면 여러 번 줄인다 — 계단형 실루엣의 근원.
  const total = top - y0;
  const steps = total > 120 ? rng.int(2, 3) : total > 55 ? rng.int(1, 2) : 1;

  let r = r0;
  let y = y0;

  for (let s = 0; s < steps; s++) {
    const last = s === steps - 1;
    const segTop = last ? top : y + (top - y) * rng.range(0.42, 0.68);
    const segH = segTop - y;
    if (segH < FLOOR_HEIGHT) break;

    if (massing === 'cyl') {
      // 원통은 사각형으로 표현할 수 없어 따로 만든다
      const skin = mats.skins[kind === 'exo' ? 'curtain' : kind];
      const set = skin.sets[skinIdx % skin.sets.length];
      cylinderMass(b, r, y, segH, skin.mats[skinIdx % skin.mats.length], [
        set.grid.cols * skin.pitch,
        set.grid.rows * FLOOR_HEIGHT,
      ]);
    } else {
      // 사각형 목록으로 L·ㄷ·노치를 만든다 (massing.js 참고)
      for (const part of footprint(r, massing, orient)) {
        b.add(rectBox(part, y, segH, PANEL_TILE), mats.panelMat);
        applySkin(b, part, y, segH, kind, skinIdx, mats, rng);
        facadeRelief(b, part, y, segH, kind, rng, mats);
      }
    }

    // 층 띠 — 몇 층마다 두르는 얇은 슬래브.
    // 커튼월과 외골격에는 두르지 않는다. 유리면을 가로지르는 띠가 있으면
    // 커튼월의 특징인 "매끈한 한 장의 유리" 가 사라진다.
    if (kind !== 'curtain' && kind !== 'exo' && kind !== 'slab') {
      for (let by = y + FLOOR_HEIGHT * BAND_EVERY; by < segTop - 1; by += FLOOR_HEIGHT * BAND_EVERY) {
        b.add(rectBox(shrink(r, -0.22), by, 0.22, PANEL_TILE), mats.panelMat);
      }
    }

    // 단 경계의 처마 (세트백이 눈에 보이게)
    b.add(rectBox(shrink(r, -0.5), segTop - 0.5, 0.5, PANEL_TILE), mats.panelMat);

    // ── 간판 요청 ─────────────────────────────────────────────────────────
    //
    // 난수는 반드시 **지역 변수로 순서대로** 뽑는다. 객체 리터럴 안에서 뽑으면
    // 속성을 재배치하는 순간 난수 소비 순서가 바뀌어 도시 전체가 달라진다.
    // 실제로 리팩터링 중 h 와 y 의 순서가 바뀌어 간판 배색·크기가 전부 어긋나고,
    // 그 뒤에 그려지는 스카이라인·교통까지 연쇄로 밀렸다.

    // 대형 광고판 — 높은 층의 한 면을 차지한다. 나이트시티의 얼굴이라
    // 초고층일수록 확률을 높인다.
    const tallness = Math.min(1, (top - y0) / 180);
    if (rng.chance(0.25 + tallness * 0.45)) {
      const side = SIDES[rng.int(0, 3)];
      const bw = faceWidth(r, side) * rng.range(0.55, 0.9);
      const bh = Math.min(segH * 0.55, bw * rng.range(0.7, 1.3));
      const by = y + segH * rng.range(0.3, 0.6);
      const scheme = rng.int(0, 5);
      signs.push({ kind: 'billboard', rect: r, side, y: by, w: bw, h: bh, scheme });
    }

    // 수직 간판 — 모서리에서 길게 떨어진다
    if (rng.chance(0.3)) {
      const side = SIDES[rng.int(0, 3)];
      const bh = Math.min(segH * 0.7, rng.range(10, 26));
      const scheme = rng.int(0, 5);
      signs.push({
        kind: 'blade',
        rect: r,
        side,
        y: y + segH * 0.15,
        w: bh / 5.4,
        h: bh,
        scheme,
      });
    }

    r = shrink(r, rng.range(1.4, 3.6));
    y = segTop;
    if (r.x1 - r.x0 < 6 || r.z1 - r.z0 < 6) break;
  }

  return { rect: r, top: y };
}

// ── 조립 ───────────────────────────────────────────────────────────────────

// 초대형 인물 광고판. 타워당 최대 하나, 몸통 한 면을 세로로 길게 덮는다.
//
// 개수를 아껴야 한다. 모든 타워에 붙이면 도시가 광고판 벽이 되어 오히려 인상이
// 흐려진다. 레퍼런스에서도 화면당 두세 개뿐이고, 그래서 그것들이 눈에 박힌다.
function megaBoard(signs, rng, r, y0, top) {
  const h = Math.min((top - y0) * rng.range(0.5, 0.82), rng.range(30, 78));
  if (h < 18) return;
  const side = SIDES[rng.int(0, 3)];
  const fw = faceWidth(r, side);
  const w = Math.min(fw * 0.92, h * 0.48); // 세로로 긴 판형
  if (w < 6) return;
  const by = y0 + (top - y0 - h) * rng.range(0.15, 0.6);
  const scheme = rng.int(0, 5);
  signs.push({ kind: 'mega', rect: r, side, y: by, w, h, scheme });
}

export function createTowers(scene, rng, mats, blocks) {
  const b = new MeshBuilder('Towers');
  const signs = [];
  const pools = [];
  let count = 0;
  let tallest = 0;
  let beaconIdx = 0;
  const districts = new Set();

  // 랜드마크가 선 블록은 통째로 비운다 (landmark.js 가 채운다)
  const reserved = new Set(LANDMARK_BLOCKS.map((l) => `${l.ix},${l.iz}`));

  for (const blk of blocks) {
    // 타워가 아닌 블록(공사장·광장·빈 대지·랜드마크)은 program.js / landmark.js 담당
    if (blk.program !== 'towers') continue;
    if (reserved.has(`${blk.ix},${blk.iz}`)) continue;
    for (const rect of subdivideBlock(rng, blk.cx, blk.cz)) {
      // 필지 사이 간격. 좁아야 한다 — 레퍼런스의 밀도는 건물이 서로 맞닿아
      // 있는 데서 온다. 2.6m 씩 띄우면 블록마다 골목이 생겨 성글어 보인다.
      const r = shrink(rect, rng.range(0.35, 1.4));
      if (r.x1 - r.x0 < 6.5 || r.z1 - r.z0 < 6.5) continue;

      const core = coreDistance(blk.cx, blk.cz);
      const D = districtAt(blk.ix, blk.iz, core);
      // 구역이 높이 성향을 민다 — 기업 구역은 초고층, 상업·공업은 저층 위주.
      // 그래야 스카이라인만 보고도 어느 구역인지 안다.
      const height = pickHeight(rng, Math.max(0, Math.min(1, core - D.heightBias)));
      count++;
      if (height > tallest) tallest = height;

      const podH = Math.min(height * 0.85, PODIUM_FLOOR * rng.int(2, 3));
      const faces = streetFaces(r, blk);
      podium(b, r, podH, rng, mats, signs, pools, D, faces);

      if (height > podH + FLOOR_HEIGHT * 2) {
        const shaftRect = shrink(r, rng.range(1.2, 3.0));
        const width = Math.min(shaftRect.x1 - shaftRect.x0, shaftRect.z1 - shaftRect.z0);
        const kind = pickArchetypeIn(rng, D, height, width);
        const skinIdx = rng.int(0, 3);
        const massing = pickMassing(rng, width, width, height);
        const orient = rng.int(0, 3);
        const end = shaft(
          b, shaftRect, podH, height, rng, mats, kind, skinIdx, signs, massing, orient
        );
        // 높고 넓은 면을 가진 타워에만.
        // 커튼월은 제외한다 — 매끈한 유리면이 이 유형의 전부인데 광고판을 붙이면
        // 그게 사라지고, 결국 모든 건물이 다시 똑같아진다.
        if (height > 55 && kind !== 'curtain' && rng.chance(0.42)) {
          megaBoard(signs, rng, shaftRect, podH, height);
        }
        createCrown(b, end.rect, end.top, height, rng, mats, beaconIdx++);
      } else {
        createCrown(b, r, podH, height, rng, mats, beaconIdx++);
      }
      districts.add(D.name);
    }
  }

  return { group: b.build(scene), signs, pools, count, tallest, districts: [...districts] };
}
