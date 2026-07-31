// 적층 상가 — 상업 구역의 건물. 번화가.
//
// ── 왜 별도의 생성기인가 ───────────────────────────────────────────────────
// 지금까지 네 구역이 **같은 생성기**(포디움 + 샤프트 + 크라운)를 쓰고 인도
// 폭·창문 색·간판 밀도 같은 숫자만 달랐다. 그래서 아무리 조정해도 같은
// 건물로 보였다. 매싱 자체가 같으면 파라미터로는 구역을 못 만든다.
//
// ── 이 건물이 왜 이렇게 생겼는가 (docs/city.md 3기) ────────────────────────
// 이 도시는 기업이 공장을 돌리려고 매립지에 한 번에 설계한 계획도시다.
// 번화가는 **계획된 상업지구가 아니라 계획이 터진 자리**다.
//
// 사람이 감당할 수 없이 늘자 1층으로 모자라 상가가 위로 쌓였다. 2층, 3층까지
// 가게가 들어찼고, 각 층을 잇는 외부 복도가 건물 정면에 붙었다. 천막이
// 골목 위를 덮었고 노점이 인도로 나왔다.
//
// 그래서 형태가 이렇다.
//
//   · 낮다 (3~6층). 계획된 상업지구가 아니라 증축이므로 높이 못 올린다.
//   · 층마다 점포가 있다. 1층만 상가인 다른 구역과 결정적으로 다른 점이다.
//   · 외부 복도가 정면에 붙는다. 그게 **수직 동선이자 간판 거는 자리**다.
//   · 세트백이 없다. 대지를 꽉 채운다. 물러설 여유가 없었다.
//   · 간판이 전면을 덮는다. 층마다 가게가 있으니 층마다 간판이 있다.
//
// 결과적으로 실루엣이 "탑" 이 아니라 **벽**이다. 거리 양쪽이 빛나는 벽으로
// 닫히는 것이 번화가의 인상이고, 타워로는 절대 그 인상이 안 나온다.

import { autoBox, tubeBetween } from '../../core/profile.js';
import {
  SIDES,
  outward,
  faceWidth,
  faceAnchor,
  alongZ,
  bayRect,
  shrink,
  rectBox,
  facePlane,
  downPlane,
  rectCenter,
  rectSize,
} from '../../core/boxfaces.js';
import { NEON, rgb01 } from '../../shared/neon.js';
import { neonSoft } from '../../shared/masters.js';
import { PANEL_TILE } from './layout.js';
import { entranceBay } from './shopfront.js';
import { claim, TIER } from './siteplan.js';
import { hash2 } from '../../core/textures.js';

// 상가 한 층. 층고가 낮다 — 사무실(3.6m)이 아니라 가게라 3.1m 면 충분하고,
// 낮아야 같은 높이에 층이 더 들어가 "쌓였다" 는 인상이 난다.
const SHOP_FLOOR = 3.1;

// 외부 복도 폭. 사람 둘이 지나갈 만큼만.
const WALK_W = 1.5;

// 면 위의 국소 좌표계. shopfront/retrofit 과 같은 발상 —
// 면마다 부호를 손으로 쓰면 반드시 어딘가 틀린다.
function frameOf(r, side) {
  const o = outward(side);
  const a = faceAnchor(r, side);
  const az = alongZ(side);
  return {
    w: faceWidth(r, side),
    az,
    at: (u, d) => (az ? [a.x + o.ox * d, a.z + u] : [a.x + u, a.z + o.oz * d]),
    size: (wu, wd) => (az ? [wd, wu] : [wu, wd]),
  };
}

// ── 층별 점포 띠 ───────────────────────────────────────────────────────────
//
// 한 층의 한 면에 가게 여러 개를 늘어놓는다. 1층만 상가인 다른 구역과 달리
// 위층에도 똑같이 들어간다 — 그게 적층 상가의 정의다.
// ── 켜진 칸과 꺼진 칸 (사용자 지적) ────────────────────────────────────────
//
// "건물 하나에, 층 하나에, 방 하나에 간판이 너무 많지 않니"
//
// 맞다. 층마다 칸마다 전부 켜져 있어서 **쉬는 자리가 하나도 없었다.**
// 간판이 빽빽하면 간판이 아니라 벽지가 된다 — 하나도 안 읽힌다.
//
// 원인은 `lit` 이 **밝은 간판 ↔ 덜 밝은 간판**만 고른 것이었다.
// shopfrontMats 도 emissiveIntensity 0.42 로 발광하므로, "꺼진" 칸이
// 아예 없었다. 실제 상가에는 늘 닫힌 가게·창고·계단실이 섞여 있다.
//
// 그래서 상태를 셋으로 나눈다.
//   켜짐   밝은 점포 정면
//   흐림   덜 밝은 점포 정면 (영업은 하는데 조명이 약하다)
//   닫힘   **셔터.** 발광하지 않는다. 이 칸이 있어야 옆 칸이 읽힌다
//
// 레퍼런스의 밀도가 그렇다 — 빽빽하되 **어두운 자리가 사이사이에** 있다.
function shopStrip(b, f, y, rng, mats, D, lit, shut, doorAt = -1) {
  const n = Math.max(2, Math.round(f.w / 4.2));
  const bw = f.w / n;

  for (let i = 0; i < n; i++) {
    const u = -f.w / 2 + bw * (i + 0.5);

    // ── 난수는 여기서 전부 뽑는다. 아래는 그리기만 한다 ──────────────────
    // 출입구 칸은 **그리지만 않을 뿐 난수는 똑같이 소비해야 한다.** 한 칸을
    // 통째로 건너뛰었더니 뒤에 오는 모든 생성이 밀려서 도시 전체가 다시
    // 뽑혔고, 픽셀 회귀 16장이 전부 "다름" 이 됐다. 문 몇 개를 더한 변경이
    // 공장 뷰를 72% 바꿀 수는 없다 — 그 숫자가 곧 신호였다.
    const closed = rng.chance(shut);
    const on = !closed && rng.chance(lit);
    const face = closed ? mats.shutterMat
      : on ? mats.shopfrontBrightMats[rng.int(0, mats.shopfrontBrightMats.length - 1)]
           : mats.shopfrontMats[rng.int(0, mats.shopfrontMats.length - 1)];
    // 닫힌 칸에는 간판도 안 단다. 여기서 걸러야 "꺼진 자리" 가 성립한다
    const blade = !closed && rng.chance(D.bladeChance * 0.8);
    const hue = blade ? D.trim[rng.int(0, D.trim.length - 1)] : 0;

    // 이 칸은 출입구다 — 위층 가게로 올라가는 계단이 여기 있다.
    // 가게로 채우면 안 된다.
    if (i === doorAt) continue;

    const [ix, iz] = f.at(u, 0.06);
    const [sw, sd] = f.size(bw * 0.88, 0.1);
    b.add(autoBox(sw, SHOP_FLOOR * 0.62, sd, [ix, y + SHOP_FLOOR * 0.46, iz], 0.02), face);

    // 가게 사이 기둥 — 이게 없으면 층 전체가 한 장의 띠로 보인다
    const [px, pz] = f.at(u - bw / 2, 0.12);
    const [pw, pd] = f.size(0.16, 0.26);
    b.box(pw, SHOP_FLOOR, pd, [px, y + SHOP_FLOOR / 2, pz], mats.frameMat);

    // 간판 — 층마다 있다. 여기가 다른 구역과 가장 크게 갈리는 지점이다.
    if (blade) {
      const [gx, gz] = f.at(u, 0.34);
      const [gw, gd] = f.size(bw * 0.8, 0.12);
      b.box(gw, 0.44, gd, [gx, y + SHOP_FLOOR - 0.42, gz], neonSoft(hue));
    }
  }
}

// ── 외부 복도 ──────────────────────────────────────────────────────────────
//
// 층마다 정면에 붙는 좁은 통로. 적층 상가의 **수직 동선이자 간판 거는 자리**다.
// 이게 있어야 위층 가게에 어떻게 가는지가 설명되고, 없으면 위층 점포가
// 그냥 벽에 붙인 그림이 된다.
function walkway(b, f, y, rng, mats) {
  const [cx, cz] = f.at(0, WALK_W / 2 + 0.1);
  const [sw, sd] = f.size(f.w, WALK_W);

  // 바닥판
  b.box(sw, 0.16, sd, [cx, y, cz], mats.grateMat);
  // 밑면 조명 — 아래층 가게를 물들인다. 없으면 판이 공중에 뜬다.
  b.add(downPlane(sw * 0.92, sd * 0.7, [cx, y - 0.1, cz]), mats.deckUnderMat);

  // 난간 — 가로대 둘 + 동자
  const [rx, rz] = f.at(0, WALK_W + 0.1);
  for (const hy of [0.5, 1.0]) {
    const [bw2, bd2] = f.size(f.w, 0.06);
    b.box(bw2, 0.06, bd2, [rx, y + hy, rz], mats.pipeMat);
  }
  const posts = Math.max(2, Math.round(f.w / 2.2));
  for (let i = 0; i <= posts; i++) {
    const u = -f.w / 2 + (f.w * i) / posts;
    const [ax, az] = f.at(u, WALK_W + 0.1);
    b.box(0.05, 1.0, 0.05, [ax, y + 0.5, az], mats.pipeMat);
  }

  // 받침 브래킷 — 복도가 매달린 것으로 읽히게
  for (const t of [-0.34, 0.34]) {
    const [sx, sz] = f.at(f.w * t, 0.05);
    const [ex, ez] = f.at(f.w * t, WALK_W);
    b.add(tubeBetween([sx, y - 1.2, sz], [ex, y - 0.08, ez], 0.05, 4), mats.metalMat);
  }
}

// ── 천막 ───────────────────────────────────────────────────────────────────
//
// 1층 위로 길게 나온 차양. 골목과 인도를 덮어 "지붕 있는 시장" 을 만든다.
// 위층 복도보다 더 나와야 아래를 실제로 덮는다.
function awning(b, f, y, rng, mats) {
  const out = rng.range(1.8, 2.8);
  const [cx, cz] = f.at(0, out / 2);
  const [sw, sd] = f.size(f.w * rng.range(0.7, 1.0), out);
  b.box(sw, 0.1, sd, [cx, y, cz], mats.rustMat);
  // 처지는 앞단 — 판때기로 두면 철판이고, 앞을 늘어뜨려야 천막이 된다
  const [ex, ez] = f.at(0, out);
  const [ew, ed] = f.size(sw, 0.08);
  b.box(ew, 0.42, ed, [ex, y - 0.2, ez], mats.shutterMat);
  // 지지 파이프
  for (const t of [-0.38, 0.38]) {
    const [ax, az] = f.at(f.w * t, 0.05);
    const [bx, bz] = f.at(f.w * t, out * 0.92);
    b.add(tubeBetween([ax, y + 1.1, az], [bx, y - 0.02, bz], 0.045, 4), mats.metalMat);
  }
}

// ── 옥상 ───────────────────────────────────────────────────────────────────
//
// 타워의 크라운(첨탑·헬리패드)과는 완전히 다르다. 적층 상가의 옥상은
// **또 하나의 증축 층**이다 — 판잣집, 물탱크, 빨래, 실외기 더미.
function rooftopShacks(b, r, top, rng, mats) {
  const c = rectCenter(r);
  const s = rectSize(r);
  const n = rng.int(2, 5);
  for (let i = 0; i < n; i++) {
    const w = rng.range(2.4, 4.6);
    const d = rng.range(2.0, 3.8);
    const h = rng.range(2.2, 3.0);
    const x = c.x + rng.range(-s.w * 0.3, s.w * 0.3);
    const z = c.z + rng.range(-s.d * 0.3, s.d * 0.3);
    b.box(w, h, d, [x, top + h / 2, z], rng.chance(0.5) ? mats.shutterMat : mats.panelMat);
    // 판잣집 창 — 사람이 산다는 신호
    if (rng.chance(0.7)) {
      b.box(w * 0.3, 0.5, 0.06, [x, top + h * 0.62, z + d / 2], neonSoft(NEON.warm));
    }
  }
  // 물탱크
  for (let i = 0; i < rng.int(1, 3); i++) {
    b.cylinder(
      rng.range(0.8, 1.3), rng.range(0.8, 1.3), rng.range(1.4, 2.2),
      [c.x + rng.range(-s.w * 0.34, s.w * 0.34), top + 1.0, c.z + rng.range(-s.d * 0.34, s.d * 0.34)],
      mats.rustMat, 10
    );
  }
  // 난간
  b.add(facePlane(shrink(r, 0.2), top, 0.9, 'pz', null, 0), mats.pipeMat);
  b.add(facePlane(shrink(r, 0.2), top, 0.9, 'nz', null, 0), mats.pipeMat);
  b.add(facePlane(shrink(r, 0.2), top, 0.9, 'px', null, 0), mats.pipeMat);
  b.add(facePlane(shrink(r, 0.2), top, 0.9, 'nx', null, 0), mats.pipeMat);
}

// ── 한 동 ──────────────────────────────────────────────────────────────────

export function bazaarBlock(b, r, rng, mats, D, faces, detail, signs, pools = []) {
  // 3~6층. 낮은 것이 요점이다 — 계획된 상업지구가 아니라 증축이라 높이 못 올린다.
  const floors = rng.int(3, 6);
  const top = floors * SHOP_FLOOR;

  // 덩치. 세트백 없이 대지를 꽉 채운다. 물러설 여유가 없었다.
  b.add(rectBox(r, 0, top, PANEL_TILE), mats.tileWallMat);

  const litBase = D.shopLit ?? 0.9;
  // 1층에서 닫힌 칸 비율. 위층은 여기에 층당 0.11 씩 더한다.
  // 번화가라도 1층의 4분의 1 가까이는 셔터가 내려가 있어야 나머지가 읽힌다.
  const shutBase = 0.22;

  for (const side of SIDES) {
    if (!faces[side]) continue; // 안 보이는 면은 만들지 않는다
    const f = frameOf(r, side);
    if (f.w < 4) continue;

    for (let fl = 0; fl < floors; fl++) {
      const y = fl * SHOP_FLOOR;
      // 위층일수록 점등률이 떨어지고 닫힌 칸이 는다.
      // **1층은 거의 다 열려 있고 위로 갈수록 비어 간다** — 실제 잡거빌딩이
      // 그렇고, 그 기울기가 있어야 파사드에 위아래 위계가 생긴다.
      // 전에는 층마다 균일해서 5층짜리가 같은 띠 다섯 장이었다.
      // ── 1층 한 칸은 출입구 (사용자 지적) ──────────────────────────
      // 2~5층이 전부 가게인데 **올라갈 입구가 없었다.** 외부 복도는 만들어
      // 놓고 거기 닿는 계단이 없었으니 형태가 내력과 어긋나 있었다.
      //
      // 자리는 **좌표 해시로** 정한다. rng 를 쓰면 여기서 한 번 더 뽑는 순간
      // 뒤에 오는 모든 생성이 밀려서 도시 전체가 다시 뽑힌다 — 문 몇 개를
      // 더하려다 픽셀 회귀 16장이 전부 "다름" 이 됐다 (실제로 그랬다).
      // 구조적 결정은 난수가 아니라 좌표에서 나와야 한다는 이 프로젝트의
      // 규칙이 바로 이 경우를 위한 것이다.
      const nBay = Math.max(2, Math.round(f.w / 4.2));
      const doorAt = fl === 0 && f.w >= 9
        ? Math.floor(nBay * (0.2 + 0.6 * hash2(Math.round(r.x0) * 4 + SIDES.indexOf(side), Math.round(r.z0))))
        : -1;
      shopStrip(b, f, y, rng, mats, D, litBase * (1 - fl * 0.1), shutBase + fl * 0.11, doorAt);
      if (doorAt >= 0) {
        const sub = bayRect(r, side, doorAt, nBay, 0);
        const e = entranceBay(b, sub, side, y, rng, mats, true);
        // 진입 동선은 우선순위가 높다 — 자판기·가로등이 문을 막으면 안 된다
        claim(e.x, e.z, e.w * 0.7 + 1.2, TIER.ACCESS, 'shopEntrance');
        pools.push({ kind: 'floor', x: e.x, y: 0.06, z: e.z, rx: 5.5, rz: 5.5, tint: rgb01(NEON.cool, 0.5) });
      }

      // 2층부터 외부 복도. 1층은 인도가 그 역할을 한다.
      if (fl >= 1) walkway(b, f, y, rng, mats);
    }

    // 1층 위 천막 — 인도를 덮는다
    if (rng.chance(0.72 * detail)) awning(b, f, SHOP_FLOOR - 0.3, rng, mats);

    // ── 간판이 벽을 덮는다 ──────────────────────────────────────────────
    //
    // 적층 상가의 정면은 **간판이 벽면적의 절반 이상**을 차지한다. 층마다
    // 가게가 있으니 층마다 간판이 있고, 그것들이 겹쳐 쌓인다.
    // 레퍼런스의 재팬타운이 그렇게 보이는 이유는 간판이 많아서가 아니라
    // **겹쳐 쌓여 있어서**다.
    //
    // 예전에 여기서 blade 하나만 요청했더니 도시 전체 간판이 9개였다.
    // 구역별 생성기가 공통 podium() 을 우회하면서 간판 경로가 통째로
    // 끊긴 것을 못 봤다 (docs/status.md 1.1).

    // 1) 층마다 가로 배너 — 겹쳐 쌓이는 것이 요점
    let stack = top - 1.2;
    const rows = Math.max(2, Math.round(4 * detail));
    for (let k = 0; k < rows; k++) {
      const bh = rng.range(1.2, 2.2);
      if (stack - bh < SHOP_FLOOR * 0.8) break;
      if (rng.chance(0.22)) { stack -= bh + 0.3; continue; }
      signs.push({
        kind: 'banner', rect: r, side,
        y: stack - bh / 2,
        w: f.w * rng.range(0.55, 0.95),
        h: bh,
        scheme: rng.int(0, 5),
      });
      stack -= bh + rng.range(0.25, 0.7);
    }

    // 2) 돌출 세로 간판 여럿 — 거리를 걸을 때 앞으로 이어지는 리듬
    const blades = Math.max(1, Math.round((f.w / 7) * detail));
    for (let k = 0; k < blades; k++) {
      if (!rng.chance(0.72)) continue;
      const bh = rng.range(3, Math.min(7, top - SHOP_FLOOR * 1.3));
      if (bh < 2) continue;
      const sub = bayRect(r, side, k, Math.max(1, blades), 0);
      signs.push({
        kind: 'blade', rect: sub, side,
        y: SHOP_FLOOR * rng.range(1.0, 1.6),
        w: bh / 4.6, h: bh,
        scheme: rng.int(0, 5),
      });
    }

    // 3) 옥상 대형 광고 — 벽보다 크다. 이게 스케일의 폭력을 만든다.
    if (rng.chance(0.4 * detail)) {
      signs.push({
        kind: 'mega', rect: r, side,
        y: top + rng.range(1, 4),
        w: f.w * rng.range(0.7, 1.0),
        h: rng.range(6, 12),
        scheme: rng.int(0, 5),
      });
    }
  }

  rooftopShacks(b, r, top, rng, mats);
  return { top, floors };
}
