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
  rectCenter,
  rectSize,
} from '../../core/boxfaces.js';
import { autoBox } from '../../core/profile.js';
import {
  FLOOR_HEIGHT,
  PODIUM_FLOOR,
  blockRect,
  SIDEWALK_W,
  blockLots,
  pickHeight,
  coreDistance,
  detailAt,
  PANEL_TILE,
} from './layout.js';
import { SHOP_TINTS } from './materials.js';
import { rgb01 } from '../../shared/neon.js';
import { neon } from '../../shared/masters.js';
import { createCrown } from './rooftop.js';
import { retrofit } from './retrofit.js';
import { bazaarBlock } from './bazaar.js';
import { factoryBlock } from './factory.js';
import { housingSlab } from './housing.js';
import { corpoTower, corpoCluster } from './corpo.js';
import { slumBlock } from './slum.js';
import { applySkin, facadeRelief } from './facade.js';
import { districtAt, pickArchetypeIn } from './district.js';
import { pickMassing, footprint, cylinderMass } from './massing.js';
import { wharfBlock } from './wharf.js';
import { pickMarketKind, marketBlock, marketSideOf, resetMarketTally } from './market.js';
import { hash2 } from '../../core/textures.js';
import { LANDMARK_BLOCKS } from './landmark.js';
import { buildBay, ALCOVE, SHOP_H, showcase } from './shopfront.js';

// 창 한 칸 가로 폭 (m). 2.1 로 두면 폭 20m 건물에 창이 10개뿐이라 창 하나가
// 거대해 보인다. 레퍼런스는 같은 폭에 창이 15개 안팎이다.
const WINDOW_PITCH_X = 1.55;
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
function streetFaces(r, blk, walk = SIDEWALK_W) {
  // 블록 경계는 blockRect 하나에서 온다. 대지 병합이 들어오면 이 함수가
  // **자동으로 대지 경계**를 보게 된다 — 여기가 안 따라오면 병합한 대지의
  // 안쪽 필지가 "길에 면했다" 고 잘못 판정된다.
  // 대지 경계다. 병합한 대지에서는 **안쪽 필지가 길에 안 면하는 것이 정상**
  // 이고, 그게 연속된 벽을 만든다.
  const R = blk.rect || blockRect(blk.ix, blk.iz);
  // ── 인도 폭을 **인자로 받는다** (실측으로 고침) ─────────────────────────
  // 여유는 그 블록의 실제 인도 폭보다 **커야** 한다.
  //
  // 전에는 전역 SIDEWALK_W(4.6) 로 계산했는데, blockLots 는 구역별 인도 폭
  // (상업 6.2 · 기업 7.5) 으로 필지를 안쪽에 만든다. 두 값이 어긋나면 필지가
  // 판정선 밖으로 밀려 **모든 면이 "길에 안 면함" 이 된다.**
  //
  // 실제로 상업 구역에서 여유(4.6+1.6=6.2)와 인도 폭(6.2)이 정확히 같아져
  // 부등식이 경계에서 항상 거짓이 됐고, 그 결과 도시 전체 간판이
  // 1,602개에서 **9개**로 죽었다. 점포도 함께 사라졌는데 못 알아챘다.
  //
  // 같은 값을 두 곳에서 다른 출처로 계산하면 반드시 이런 일이 난다.
  const m = walk + 1.6;
  return {
    px: r.x1 > R.x1 - m,
    nx: r.x0 < R.x0 + m,
    pz: r.z1 > R.z1 - m,
    nz: r.z0 < R.z0 + m,
  };
}

// 저층 상가. 도로에서 보이는 유일한 부분이라 여기 밀도가 도시의 인상을 만든다.
//
// 구역(district)이 밀도와 밝기를 정한다. 상업 구역은 간판이 벽을 뒤덮고 점포가
// 눈부시게 밝지만, 공업 구역은 거의 캄캄하다. **그 대비가 탐험할 이유를 만든다** —
// 어디를 가도 같은 밝기면 갈 곳이 없다.
//
// faces 는 길에 면하는 면만 true 다. 나머지 면은 벽으로 메운다.
function podium(b, r, h, rng, mats, signs, pools, D, faces, detail = 1) {
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
    // 칸 폭을 디테일로 넓힌다. 외곽 건물은 점포가 크고 성기다 — 실제로도
    // 도심에서 멀어질수록 작은 가게가 줄고 큰 매장 하나가 된다.
    // 1층 점포는 건물에서 가장 비싼 부분이라(벽감·차양·진열·간판) 여기가
    // 삼각형 예산의 최대 지렛대다.
    const bays = Math.max(1, Math.round(fw / (6.5 + (1 - detail) * 9)));
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
          // 벽감 안쪽 벽에 붙인다.
          //
          // 원래 `sub`(필지 바깥면) 을 그대로 넘겼는데, 점포는 ALCOVE(1.3m)
          // 만큼 안으로 파여 있다. 베이 **가운데**에는 그 자리에 아무것도
          // 없어서 간판이 허공에 1.3m 떠 있었다 (기둥은 베이 경계에만 있다).
          // 벽감 깊이만큼 밀어 넣으면 실제 벽에 닿는다.
          const mount = shrink(sub, 0);
          const o2 = outward(side);
          if (o2.ox) { mount.x0 -= o2.ox * ALCOVE; mount.x1 -= o2.ox * ALCOVE; }
          else { mount.z0 -= o2.oz * ALCOVE; mount.z1 -= o2.oz * ALCOVE; }
          signs.push({
            kind: 'blade',
            rect: mount,
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

  // ── 처마 윗면 ────────────────────────────────────────────────────────────
  // 윗면에 아무것도 없어서, 위에서 내려다보면 **모서리만 빛나는 검은 판**으로
  // 보였다. 지상에서만 보인다고 가정하고 만들었는데 프리캠은 위에서도 본다.
  //
  // 난간 턱 하나와 설비 몇 개면 충분하다 — 이 높이(10~15m)에서 내려다볼 때
  // 필요한 건 디테일이 아니라 '평평하지 않다' 는 사실이다.
  const lip = shrink(canopy, 0.12);
  for (const side of SIDES) {
    b.add(facePlane(lip, h - 0.15, 0.45, side, null, 0.0), mats.metalMat);
  }
  const cs = rectSize(canopy);
  const cc = rectCenter(canopy);
  const units = rng.int(2, 5);
  for (let i = 0; i < units; i++) {
    const ux = cc.x + rng.range(-cs.w * 0.36, cs.w * 0.36);
    const uz = cc.z + rng.range(-cs.d * 0.36, cs.d * 0.36);
    if (rng.chance(0.6)) {
      b.add(autoBox(rng.range(1.0, 1.8), 0.7, rng.range(0.8, 1.4), [ux, h + 0.2, uz], 0.04), mats.ductMat);
    } else {
      b.cylinder(0.36, 0.36, 0.9, [ux, h + 0.3, uz], mats.rustMat, 8);
    }
  }

  // ── 간판 ────────────────────────────────────────────────────────────────
  // 상업 구역은 배너를 한 면에 여러 층으로 쌓는다. 2077 의 재팬타운이 그렇게
  // 보이는 이유는 간판이 많아서가 아니라 **겹쳐 쌓여 있어서**다.
  const rows = Math.max(1, Math.round(D.signDensity * detail));
  for (const side of SIDES) {
    if (!faces[side]) continue; // 안 보이는 면에는 간판도 달지 않는다
    // 쌓인 높이를 **누적**해서 내려온다.
    //
    // 원래는 `k * (bh + 0.35)` 로 자리를 잡았는데, 여기서 bh 는 그 회차에
    // 새로 뽑은 높이다. 즉 아래 칸의 위치를 정할 때 **위 칸의 실제 높이를
    // 쓰지 않는다.** 위 칸이 크고(1.8) 아래 칸이 작으면(1.1) 간격이 0 이
    // 되거나 음수가 되어 두 배너가 겹친다.
    let stack = h - 2.6;
    for (let k = 0; k < rows; k++) {
      const bh = rng.range(1.1, 1.8);
      if (rng.chance(0.28)) { stack -= bh + 0.35; continue; }
      signs.push({
        kind: 'banner',
        rect: r,
        side,
        y: stack - bh / 2,
        w: faceWidth(r, side) * rng.range(0.5, 0.86),
        h: bh,
        scheme: rng.int(0, 5),
      });
      stack -= bh + 0.35;
    }
  }
}

// ── 몸통 ───────────────────────────────────────────────────────────────────

function shaft(b, r0, y0, top, rng, mats, kind, skinIdx, signs, massing, orient, faces, density) {
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
        // 나중에 덧붙은 설비 — 배관·덕트·증축 발코니·케이블.
        // 창 격자의 규칙성을 깨는 것이 목적이다 (retrofit.js 머리말 참고).
        // 커튼월은 제외한다 — 매끈한 유리면이 그 유형의 전부다.
        if (kind !== 'curtain') retrofit(b, part, y, segH, faces, rng, mats, density);
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
  const alleys = [];
  // ── 앵커 ─────────────────────────────────────────────────────────────────
  // 건물마다 { 사각형, 옥상 높이 } 를 기록한다.
  //
  // 브릿지·데크가 **허공에서 시작해 허공에서 끝나는** 문제의 원인이 이것이
  // 없었기 때문이다. siteplan 은 지면 2D 만 관리해서 공중에는 대응물이 없었고,
  // 그래서 vertical 이 좌표 해시로 뽑은 임의 높이에 다리를 놓았다.
  // 이제 vertical 은 이 목록에서 **양 끝이 실제로 닿는 쌍**만 고른다.
  const anchors = [];

  // ── 앵커의 solid — 필지와 그려진 것의 **교집합** ─────────────────────────
  //
  // rect 만으로는 부족하다. 기업 타워는 대지를 비우므로(광장) 필지
  // 가장자리에 벽이 없고, 거기에 다리를 물리면 허공에 뜬다.
  //
  // 그렇다고 그려진 경계만 쓰면 반대로 틀린다. 일반 타워는 포디움이 몸통보다
  // 넓어서, 그려진 상자를 쓰면 40m 높이의 다리가 **지상 포디움 자리**에
  // 물린다.
  //
  // 교집합이 둘 다 맞는다 — "필지 안이면서 실제로 그린 곳".
  //   기업   필지 ∩ 타워   = 타워   (좁아진다)
  //   일반   몸통 ∩ 전체   = 몸통   (넓어지지 않는다)
  //   슬럼   필지 ∩ 골조   = 골조
  const solidOf = (rect, drawn) => {
    if (!drawn) return rect;
    const out = {
      x0: Math.max(rect.x0, drawn.x0), x1: Math.min(rect.x1, drawn.x1),
      z0: Math.max(rect.z0, drawn.z0), z1: Math.min(rect.z1, drawn.z1),
    };
    // 교집합이 비면(있을 수 없지만) 필지로 되돌린다
    return out.x1 > out.x0 && out.z1 > out.z0 ? out : rect;
  };

  let count = 0;
  let tallest = 0;
  let beaconIdx = 0;
  let lotIdx = 0;
  // 번화가 유형 집계를 비운다. 씬을 다시 지으면 누적되면 안 된다.
  resetMarketTally();
  // streetFaces 건강 지표 — 이 함수가 간판 1,602->9 사고를 냈다.
  // 면한 면의 **비율**을 세면 붕괴가 절대 개수보다 먼저 드러난다.
  let faceOpen = 0;
  let faceAll = 0;
  const districts = new Set();

  // 랜드마크가 선 블록은 통째로 비운다 (landmark.js 가 채운다)
  const reserved = new Set(LANDMARK_BLOCKS.map((l) => `${l.ix},${l.iz}`));

  for (const blk of blocks) {
    // 타워가 아닌 블록(공사장·광장·빈 대지·랜드마크)은 program.js / landmark.js 담당
    if (blk.program !== 'towers') continue;
    if (reserved.has(`${blk.ix},${blk.iz}`)) continue;
    // 구역을 **블록 단위로** 먼저 구한다. 인도 폭·필지 잘기·골목 밀도를
    // 구역이 정하므로 필지를 나누기 전에 알아야 한다.
    const blkCore = coreDistance(blk.cx, blk.cz);
    const BD = districtAt(blk.ix, blk.iz);
    // 외곽 블록은 원래 성기다 (layout.detailAt 주석 참고).
    // 거리 기반으로 '줄이는' 것이 아니라 도시 구조로 그렇게 만든다.
    const detail = detailAt(blk.cx, blk.cz);

    const { lots, alleys: blkAlleys } = blockLots(rng, blk, BD);
    // 구역 이름을 붙여 넘긴다. 골목 벽 높이가 구역별 건물 높이를 따라야 하는데
    // layout 은 순환 참조 때문에 district 를 직접 못 본다 (alley.js 참고).
    for (const a of blkAlleys) a.zone = BD.name;
    alleys.push(...blkAlleys);

    for (const rect of lots) {
      // 필지 사이 간격. 좁아야 한다 — 레퍼런스의 밀도는 건물이 서로 맞닿아
      // 있는 데서 온다. 2.6m 씩 띄우면 블록마다 골목이 생겨 성글어 보인다.
      const r = shrink(rect, rng.range(0.35, 1.4));
      if (r.x1 - r.x0 < 6.5 || r.z1 - r.z0 < 6.5) continue;

      // ── 배치 검사용 표시 ──────────────────────────────────────────────
      // 여기부터 다음 필지까지 그리는 것이 이 건물 한 채다. 검사는 이
      // 덩어리의 **실제 경계**를 보고 옆 건물과의 관통을 잡는다
      // (core/placement.js). 앵커의 rect 는 '필지' 이지 '그린 것' 이 아니므로
      // 관통 판정에 못 쓴다 — 슬럼은 필지 안에서 비스듬히 앉고, 차양·돌출
      // 간판은 필지 밖으로 나간다.
      b.mark('building', `bld:${blk.ix},${blk.iz}#${lotIdx++}`, { zone: BD.name, ix: blk.ix, iz: blk.iz });

      const core = blkCore;
      const D = BD;
      // 구역이 높이 성향을 민다 — 기업 구역은 초고층, 상업·공업은 저층 위주.
      // 그래야 스카이라인만 보고도 어느 구역인지 안다.
      const height = pickHeight(rng, Math.max(0, Math.min(1, core - D.heightBias)));
      // 필지 하나 = 건물 한 채. **여기서 한 번만 센다.**
      //
      // 전에는 여기서 한 번 세고 구역별 생성기 다섯 갈래에서 또 한 번씩 세서
      // 값이 정확히 두 배였다 (실제 439동을 875동으로 신고했다). 배치 검사가
      // 지오메트리에서 직접 센 439 와 어긋나서 드러났다 (core/placement.js).
      count++;
      if (height > tallest) tallest = height;

      const faces = streetFaces(r, blk, BD.sidewalk);
      faceAll += 4;
      for (const sd of SIDES) if (faces[sd]) faceOpen++;

      // ── 상업 구역은 생성기가 다르다 ──────────────────────────────────
      // 번화가는 계획된 상업지구가 아니라 **계획이 터진 자리**다 (docs/city.md
      // 3기). 그래서 타워가 아니라 낮고 빽빽한 적층 상가여야 한다.
      // 파라미터로는 이 차이를 못 만든다 — 매싱 자체가 다르다.
      // 슬럼 — 2기에 시작해 3기에 멈춘 개발지. 격자를 안 따르고 비스듬히
      // 앉는다. 도시에서 유일하게 90도가 아닌 것이 여기 있다 (slum.js).
      if (D.name === '슬럼') {
        rng.int(2, 3); // 난수 소비를 맞춘다
        const sl = slumBlock(b, r, rng, mats, pools);
        if (sl.top > tallest) tallest = sl.top;
        anchors.push({ rect: r, solid: solidOf(r, b.takeMark()), top: sl.top, zone: D.name, faces });
        districts.add(D.name);
        continue;
      }

      // 기업 구역 — 2기. 도시에서 유일하게 **다시 설계된 곳**이다.
      // 대지를 꽉 채우지 않고 비운다 — 광장이 부의 표시다 (corpo.js 머리말).
      if (D.name === '기업') {
        rng.int(2, 3); // 난수 소비를 맞춘다
        // ── 군집을 먼저 시도한다 ────────────────────────────────────────
        // 대지마다 타워 하나면 벽이 아니라 열주(列柱)가 된다. 여러 채를
        // 좁은 간격으로 세워야 협곡이 생긴다 (corpo.js corpoCluster 머리말).
        // 대지가 작아 군집이 안 되면 단동 광장형으로 떨어진다.
        const label = `corpo:${blk.ix},${blk.iz}`;
        // 공유 기단·광장은 건물이 아니라 받침이다. 'building' 으로 두면
        // 그 안에 선 타워들과 겹쳐 관통 경고가 뜬다.
        b.mark('podium', label);
        const ct = corpoCluster(b, r, rng, mats, height, pools, signs, label)
                || corpoTower(b, r, rng, mats, height, pools, signs, label);
        if (ct) {
          for (const t of ct.towers) {
            count++;
            // solid 는 corpo.js 가 **실제로 채운** 사각형이다. rect 를 그대로
            // 쓰면 원통 타워의 빈 모서리·트윈의 빈 가운데에 브릿지가 닿는다.
            anchors.push({ rect: t.rect, solid: t.solid || t.rect, top: t.top, zone: D.name, faces });
          }
          if (ct.top > tallest) tallest = ct.top;
          districts.add(D.name);
          continue;
        }
        // 둘 다 안 되면 공통 타워로 떨어진다
      }

      // 주거 구역 — 1기. 공장 노동자를 위해 빨리, 똑같이 지은 집.
      // 완벽하게 규칙적인 발코니 격자 위에 40년치 생활이 덮인 건물이다
      // (housing.js 머리말). 탑이 아니라 슬래브다.
      if (D.name === '주거') {
        rng.int(2, 3); // 난수 소비를 맞춘다
        const hs = housingSlab(b, r, rng, mats, faces, detail, pools);
        if (hs.top > tallest) tallest = hs.top;
        anchors.push({ rect: r, solid: solidOf(r, b.takeMark()), top: hs.top, zone: D.name, faces });
        districts.add(D.name);
        continue;
      }

      // 공업 구역 — 1기. 이 도시가 존재하는 이유이고, 형태 원리가 정반대다.
      // 사람이 보라고 지은 것이 아니라 기계가 들어가라고 지은 건물이라
      // 낮고 길고 가로로 뻗는다 (factory.js 머리말).
      if (D.name === '공업') {
        rng.int(2, 3); // 난수 소비를 맞춘다
        const fb = factoryBlock(b, r, rng, mats, faces, detail, pools);
        if (fb.top > tallest) tallest = fb.top;
        anchors.push({ rect: r, solid: solidOf(r, b.takeMark()), top: fb.top, zone: D.name, faces });
        districts.add(D.name);
        continue;
      }

      // 부둣가 — 1기. **건물이 아니라 부지가 주인공**이다 (wharf.js 머리말).
      // 공업이 만드는 곳이라면 여기는 옮기는 곳이라, 형태 원리가 정반대다.
      if (D.name === '부둣가') {
        rng.int(2, 3); // 난수 소비를 맞춘다
        const wf = wharfBlock(b, r, rng, mats, pools);
        if (wf.top > tallest) tallest = wf.top;
        anchors.push({ rect: r, solid: solidOf(r, b.takeMark()), top: wf.top, zone: D.name, faces });
        districts.add(D.name);
        continue;
      }

      if (D.name === '상업') {
        // 난수 소비를 맞춘다 — 건너뛰면 뒤의 모든 생성이 밀린다
        rng.int(2, 3);
        // ── 번화가는 한 종류가 아니다 (사용자 지시) ──────────────────────
        // "번화가는 시장, 명품전시관, 유흥가, 암거리시장, 지하상가 등이
        //  있어야 할 것"
        //
        // 적층 상가(bazaar)가 기준이고, 필지 일부가 특수 유형이 된다.
        // **좌표 해시로 정한다** — 난수를 쓰면 확률 하나만 바꿔도 도시
        // 전체가 밀린다 (blockProgram·alleyFor 와 같은 이유).
        // 필지 **중심 좌표**로 해싱한다. lotIdx 를 쓰면 그건 블록을 가로지르는
        // 전역 카운터라, 주거나 공업을 건드리는 순간 번화가 유형이 통째로
        // 밀린다 — "좌표 해시" 가 되려면 좌표를 써야 한다.
        // 어느 번화가인가가 무엇이 서는지를 정한다 (market.marketSideOf).
        // 안쪽은 시장·명품관, 북쪽(기업·슬럼에 접한 띠)은 유흥가·지하상가·암거래.
        const mc = rectCenter(r);
        const mk = pickMarketKind(
          hash2(Math.round(mc.x), Math.round(mc.z)),
          rectSize(r),
          marketSideOf(blk.ix)
        );
        const mb = mk ? marketBlock(b, mk, r, rng, mats, signs, pools) : null;
        const bz = mb || bazaarBlock(b, r, rng, mats, D, faces, detail, signs);
        if (bz.top > tallest) tallest = bz.top;
        anchors.push({ rect: r, solid: solidOf(r, b.takeMark()), top: bz.top, zone: D.name, faces });
        districts.add(D.name);
        continue;
      }

      const podH = Math.min(height * 0.85, PODIUM_FLOOR * rng.int(2, 3));
      podium(b, r, podH, rng, mats, signs, pools, D, faces, detail);

      if (height > podH + FLOOR_HEIGHT * 2) {
        const shaftRect = shrink(r, rng.range(1.2, 3.0));
        const width = Math.min(shaftRect.x1 - shaftRect.x0, shaftRect.z1 - shaftRect.z0);
        const kind = pickArchetypeIn(rng, D, height, width);
        // 구역이 정한다. 난수는 그대로 소비해서 뒤의 생성이 밀리지 않게 한다.
        rng.int(0, 3);
        const skinIdx = D.skin;
        const massing = pickMassing(rng, width, width, height);
        const orient = rng.int(0, 3);
        const end = shaft(
          b, shaftRect, podH, height, rng, mats, kind, skinIdx, signs, massing, orient,
          faces, D.retrofit * detail
        );
        // 높고 넓은 면을 가진 타워에만.
        // 커튼월은 제외한다 — 매끈한 유리면이 이 유형의 전부인데 광고판을 붙이면
        // 그게 사라지고, 결국 모든 건물이 다시 똑같아진다.
        if (height > 55 && kind !== 'curtain' && rng.chance(0.42)) {
          megaBoard(signs, rng, shaftRect, podH, height);
        }
        createCrown(b, end.rect, end.top, height, rng, mats, beaconIdx++);
        anchors.push({ rect: shaftRect, solid: solidOf(shaftRect, b.takeMark()), top: height, zone: D.name, faces });
      } else {
        createCrown(b, r, podH, height, rng, mats, beaconIdx++);
        anchors.push({ rect: r, solid: solidOf(r, b.takeMark()), top: podH, zone: D.name, faces });
      }
      districts.add(D.name);
    }
  }

  return {
    group: b.build(scene), signs, pools, alleys, anchors, count, tallest,
    districts: [...districts], faceOpen, faceAll,
  };
}
