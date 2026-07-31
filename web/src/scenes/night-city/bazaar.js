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
import { marketTallyAdd } from './market.js';

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
function shopStrip(b, f, y, rng, mats, D, lit, shut, doorAt = -1, fl = 0, seed = 0) {
  const n = Math.max(2, Math.round(f.w / 4.2));
  const bw = f.w / n;

  for (let i = 0; i < n; i++) {
    const u = -f.w / 2 + bw * (i + 0.5);

    // ── 3층부터는 절반이 세입자다 (사용자 지적) ─────────────────────────
    // "창문마다 간판과 똑같은 형태의 리소스가 쓰이고 있고, 이게 너무
    //  복사 붙여넣기로 여기저기 쓰이고 있음"
    //
    // 층마다 가게라는 것이 적층 상가의 정체이긴 하지만, **모든 층의 모든
    // 칸**에 점포 텍스처(간판 띠 + 모자이크)를 붙이니 5층짜리가 간판 스무
    // 장이 됐다. 실제 잡거빌딩도 위로 갈수록 사무실과 살림집이 섞인다.
    //
    // 좌표 해시로 정한다 — 난수를 더 뽑으면 뒤의 도시가 다시 뽑힌다.
    const tenant = fl >= 2 && hash2(seed + i * 37 + fl * 211, seed + 53) < 0.5;

    // ── 난수는 여기서 전부 뽑는다. 아래는 그리기만 한다 ──────────────────
    // 출입구 칸은 **그리지만 않을 뿐 난수는 똑같이 소비해야 한다.** 한 칸을
    // 통째로 건너뛰었더니 뒤에 오는 모든 생성이 밀려서 도시 전체가 다시
    // 뽑혔고, 픽셀 회귀 16장이 전부 "다름" 이 됐다. 문 몇 개를 더한 변경이
    // 공장 뷰를 72% 바꿀 수는 없다 — 그 숫자가 곧 신호였다.
    const closed = rng.chance(shut);
    const on = !closed && rng.chance(lit);
    const face = closed ? mats.shutterMat
      : tenant ? mats.tenantWinMats[(i + fl) % mats.tenantWinMats.length]
      : on ? mats.shopfrontBrightMats[rng.int(0, mats.shopfrontBrightMats.length - 1)]
           : mats.shopfrontMats[rng.int(0, mats.shopfrontMats.length - 1)];
    // 닫힌 칸에는 간판도 안 단다. 여기서 걸러야 "꺼진 자리" 가 성립한다.
    //
    // **난수는 tenant 와 무관하게 뽑는다.** `!tenant && rng.chance(...)` 라고
    // 쓰면 단축 평가로 뽑기를 건너뛰어 뒤의 도시가 밀린다 — 이 파일에서만
    // 세 번째로 같은 함정이다 (status.md 2.1 규칙 6).
    const bladeRoll = !closed && rng.chance(D.bladeChance * 0.8);
    const hue = bladeRoll ? D.trim[rng.int(0, D.trim.length - 1)] : 0;
    const blade = bladeRoll && !tenant; // 세입자 칸에는 안 단다 — 가게가 아니다

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

// ── 상부 파사드 ────────────────────────────────────────────────────────────
//
// 적층 상가의 **위층**. 아래 3~6층과는 다르게 그린다.
//
// ── 왜 다른가 ──────────────────────────────────────────────────────────────
// 눈높이에서 보이는 1~4층은 벽감·차양·좌판까지 보이지만, 그 위는 거리에서
// 올려다보는 것이라 **띠와 불빛으로만 읽힌다.** 12층 전부에 벽감을 파면
// 안 보이는 곳에 비용을 쓰는 것이고, 실제 잡거빌딩도 위로 갈수록
// 창과 간판만 남는다.
//
// ── 난수를 안 쓴다 ─────────────────────────────────────────────────────────
// 층을 더하면 그만큼 `rng` 를 더 뽑게 되고, 그러면 **뒤에 오는 도시 전체가
// 다시 뽑힌다** (docs/status.md 2.1 규칙 6). 그래서 위층은 좌표 해시로만
// 그린다 — 같은 자리는 늘 같은 창이 켜지고, 아래층 난수 소비는 그대로다.
// 덕분에 이 변경은 **상업 구역만** 바꾼다. 기업·공업·부둣가 뷰는 픽셀 동일.
// ── 왜 창 격자로 그리면 안 되는가 ──────────────────────────────────────────
// 처음엔 층마다 균일한 칸을 늘어놓았다. 높이는 생겼는데 **주거 슬래브와
// 똑같이 보였다** — 규칙적인 창 격자는 아파트의 문법이다. 잡거빌딩은
// 층마다 다른 가게가 세들어 있어서 파사드가 층마다 어긋나야 하고, 창보다
// **가로 간판 띠**가 면을 더 많이 덮는다.
//
// 그래서 층을 두 가지로 섞는다.
//   띠  가로로 길게 한 장. 그 층을 통째로 쓰는 가게의 간판이다
//   칸  좁은 칸 여럿. 여러 가게가 나눠 쓰는 층이다
// 그리고 칸 폭을 층마다 바꾼다. 같은 폭으로 맞추면 다시 격자가 된다.
function upperFacade(b, rect, y0, n, mats, seed) {
  for (const side of SIDES) {
    const f = frameOf(rect, side);
    if (f.w < 4) continue;
    for (let fl = 0; fl < n; fl++) {
      const y = y0 + fl * SHOP_FLOOR;
      const hf = hash2(Math.round(rect.x0) * 31 + fl * 11 + seed, Math.round(rect.z0) * 17 + fl);
      // 층 슬래브 — 이 선이 없으면 벽 한 장이다
      const [lx, lz] = f.at(0, 0.1);
      const [lw, ld] = f.size(f.w, 0.18);
      b.box(lw, 0.22, ld, [lx, y + 0.11, lz], mats.frameMat);

      // 위로 갈수록 빈다. 꼭대기는 거의 어둡다 — 그 기울기가 높이를 만든다
      const onRate = 0.68 - (fl / Math.max(1, n)) * 0.38;

      if (hf < 0.26) {
        // ── 가로 간판 띠 ────────────────────────────────────────────────
        // 면을 거의 다 덮고 앞으로 조금 나온다. 이 한 장이 "가게가 통째로
        // 들어 있다" 를 말한다. **층의 4분의 1만** 이렇게 둔다 — 전에는
        // 3분의 1이었고, 나머지도 점포 텍스처라 결국 전 층이 간판이었다.
        const bw = f.w * (0.74 + hf * 0.6);
        const [bx, bz] = f.at((hf - 0.13) * (f.w - bw) * 0.8, 0.26);
        const [bdx, bdz] = f.size(bw, 0.34);
        const on = hf < onRate * 0.62;
        b.add(
          autoBox(bdx, SHOP_FLOOR * 0.58, bdz, [bx, y + SHOP_FLOOR * 0.55, bz], 0.03),
          on
            ? mats.shopfrontBrightMats[Math.floor(hf * 997) % mats.shopfrontBrightMats.length]
            : mats.shutterMat
        );
        // 띠를 두르는 테 — 붙인 물건으로 읽히게
        const [fdx, fdz] = f.size(bw + 0.3, 0.12);
        b.box(fdx, 0.16, fdz, [bx, y + SHOP_FLOOR * 0.85, bz], mats.metalMat);
        b.box(fdx, 0.16, fdz, [bx, y + SHOP_FLOOR * 0.25, bz], mats.metalMat);
        continue;
      }

      // ── 창문 층 (사용자 지적으로 고침) ─────────────────────────────────
      //
      // "번화가 건물 창문도 (…) 창문마다 간판과 똑같은 형태의 리소스가
      //  쓰이고 있고, 이게 너무 복사 붙여넣기로 여기저기 쓰이고 있음"
      //
      // 맞았다. 여기에 `shopfrontMats` 를 붙이고 있었다. 그 텍스처는 칸마다
      // **간판 띠 + 그 아래 모자이크**로 되어 있어서, 8층 잡거타워가 층마다
      // 간판 넉 장씩 달린 건물이 됐다.
      //
      // 위층은 창문이다. 그리고 사무실 창도 아니다 — 잡거빌딩 위층은
      // 세입자가 제각각 쓰는 방이라 창마다 사정이 다르다
      // (shared/urban/shops.js tenantWindows).
      //
      // 한 층을 한 장으로 붙인다. 칸을 쪼개 붙이면 텍스처 안의 창 격자와
      // 조각 경계가 어긋나 이중 격자가 된다.
      const [wx, wz] = f.at(0, 0.06);
      const [ww, wd] = f.size(f.w * 0.985, 0.1);
      b.add(
        autoBox(ww, SHOP_FLOOR * 0.9, wd, [wx, y + SHOP_FLOOR * 0.52, wz], 0.02),
        mats.tenantWinMats[Math.floor(hf * 997) % mats.tenantWinMats.length]
      );
      // 그 층의 몇 칸은 셔터를 내렸다 — 빈 사무실. 이 어두운 칸이 있어야
      // 켜진 칸이 읽힌다 (shopStrip 과 같은 논리)
      const shutCells = Math.max(2, Math.round(f.w / 4.4));
      for (let i = 0; i < shutCells; i++) {
        const hh = hash2(Math.round(rect.x0) * 71 + i * 7 + fl * 3, Math.round(rect.z0) * 13 + seed);
        if (hh > onRate * 0.42) continue;
        const cw = f.w / shutCells;
        const u = -f.w / 2 + cw * (i + 0.5);
        const [cx2, cz2] = f.at(u, 0.09);
        const [cw2, cd2] = f.size(cw * 0.78, 0.08);
        b.box(cw2, SHOP_FLOOR * 0.62, cd2, [cx2, y + SHOP_FLOOR * 0.55, cz2], mats.shutterMat);
      }
    }
  }
}

// 세로 간판 기둥 — 잡거빌딩의 정체다.
// 가게가 위로 쌓이면 **간판도 위로 쌓이고**, 그것이 한 줄로 이어져 기둥이 된다.
// 이 실루엣 하나로 "높은 상가" 가 "높은 사무실" 과 갈린다.
function signColumn(b, rect, side, y0, top, mats, seed) {
  const f = frameOf(rect, side);
  if (f.w < 6) return;
  // 폭이 있어야 멀리서 보인다. 2.4m 짜리는 40m 위에서 실 한 오라기였다.
  const W = Math.min(3.4, f.w * 0.3);
  const OUT = 1.15; // 벽에서 얼마나 나오나. 나와야 옆에서도 보인다
  const u = (hash2(Math.round(rect.x0) + seed, Math.round(rect.z0)) - 0.5) * (f.w - W - 1.2);

  // 뒷판 — 간판이 붙는 검은 판. 이게 있어야 칸칸이 끊긴 것으로 읽힌다
  const [kx, kz] = f.at(u, OUT * 0.42);
  const [kw, kd] = f.size(W + 0.24, OUT * 0.84);
  b.box(kw, top - y0, kd, [kx, (y0 + top) / 2, kz], mats.frameMat);

  let y = y0;
  let k = 0;
  const HUES = [NEON.magenta, NEON.cyan, NEON.amber, NEON.violet, NEON.pink];
  while (y + 1.6 < top) {
    const h = 1.6 + hash2(Math.round(rect.x0) + k * 17 + seed, Math.round(rect.z0) + k * 5) * 1.5;
    if (y + h > top) break;
    const hh = hash2(Math.round(rect.z0) + k * 31 + seed, Math.round(rect.x0));
    // 간판 판 — 뒷판보다 조금 더 앞에. 양면이라 어느 쪽에서 걸어와도 보인다
    for (const d of [OUT + 0.06, -0.02]) {
      const [px, pz] = f.at(u, d);
      const [pw, pd] = f.size(W, 0.1);
      b.box(pw, h * 0.86, pd, [px, y + h / 2, pz],
        hh < 0.82 ? neonSoft(HUES[Math.floor(hh * 613) % HUES.length]) : mats.shutterMat);
    }
    y += h + 0.3;
    k++;
  }
  // 기둥을 벽에 매다는 브래킷 — 서너 군데
  for (let i = 0; i <= 3; i++) {
    const by = y0 + ((top - y0) * i) / 3;
    const [bx, bz] = f.at(u, OUT * 0.5);
    const [bw, bd] = f.size(0.14, OUT);
    b.box(bw, 0.14, bd, [bx, by, bz], mats.metalMat);
  }
}

// ── 한 동 ──────────────────────────────────────────────────────────────────

export function bazaarBlock(b, r, rng, mats, D, faces, detail, signs, pools = []) {
  // 3~6층. 이 아래층이 눈높이에서 보이는 부분이다.
  const floors = rng.int(3, 6);
  const top = floors * SHOP_FLOOR;

  // 덩치. 세트백 없이 대지를 꽉 채운다. 물러설 여유가 없었다.
  b.add(rectBox(r, 0, top, PANEL_TILE), mats.tileWallMat);

  // ── 위로 무엇이 더 올라가는가 (사용자 지적) ──────────────────────────────
  //
  // "번화가 건물이 전부 낮고 똑같다 / 왜 번화가 건물도 높을 수 있음"
  //
  // 맞았다. 실측하니 번화가에서 제일 높은 것이 22m 였다. 그런데 이 도시의
  // 3기 설정은 "사람이 감당 못 하게 늘어 상가가 위로 쌓였다" 이다.
  // 위로 쌓였다면서 전부 6층에서 멈춰 있으면 내력과 형태가 어긋난다.
  //
  // 레퍼런스(신주쿠·재팬타운)의 번화가는 **낮은 것과 높은 것이 섞여** 있다.
  // 잡거빌딩은 좁은 땅에 12층까지 올라가고, 그 좁고 높은 실루엣에 간판이
  // 위까지 붙는다. 그게 사무실 타워와 갈리는 지점이다.
  //
  // 그래서 매싱을 셋으로 가른다. **좌표 해시로 정한다** — 난수를 쓰면 층이
  // 늘어난 만큼 난수를 더 뽑아 도시 전체가 다시 뽑힌다 (2.1 규칙 6).
  //
  //   통짜    낮고 넓다. 지금까지의 모습. 기준
  //   세트백  아래는 꽉 차고 위는 물러선다. 증축이 눈에 보인다
  //   잡거타워 좁은 땅에 높이 선다. 번화가의 수직 요소
  const sz = rectSize(r);
  const narrow = Math.min(sz.w, sz.d);
  const hz = hash2(Math.round(r.x0), Math.round(r.z0));
  const hz2 = hash2(Math.round(r.z0), Math.round(r.x0) + 977);

  let form = 'slab';
  // 타워는 **좁은 땅에만** 선다. 넓은 땅에 세우면 그냥 사무실 빌딩이다.
  if (narrow <= 26 && hz > 0.66) form = 'tower';
  else if (hz > 0.34) form = 'setback';

  let crown = { rect: r, top }; // 옥상 잡동사니가 앉을 자리
  const seed = Math.round(r.x0 + r.z0) & 1023;

  if (form === 'setback') {
    // 한 겹 물러선 상부. 2~5층 더.
    const back = 2.2 + hz2 * 3.4;
    const up = shrink(r, back);
    const n = 2 + Math.floor(hz2 * 4);
    const uTop = top + n * SHOP_FLOOR;
    b.add(rectBox(up, top, n * SHOP_FLOOR, PANEL_TILE), mats.tileWallMat);
    upperFacade(b, up, top + 0.2, n, mats, seed);
    // 물러선 만큼 생긴 옥상 — 아래 지붕에 난간을 두른다
    b.add(facePlane(shrink(r, 0.2), top, 0.8, 'pz', null, 0), mats.pipeMat);
    b.add(facePlane(shrink(r, 0.2), top, 0.8, 'nx', null, 0), mats.pipeMat);
    crown = { rect: up, top: uTop };
  } else if (form === 'tower') {
    // 기단 위에 좁은 축. 폭은 짧은 변의 62~76% — 좁아야 잡거빌딩이다.
    const inset = narrow * (0.12 + hz2 * 0.07);
    const shaft = shrink(r, inset);
    const n = 6 + Math.floor(hz2 * 8); // 6~13층 더 → 총 28~59m
    const uTop = top + n * SHOP_FLOOR;
    b.add(rectBox(shaft, top, n * SHOP_FLOOR, PANEL_TILE), mats.tileWallMat);
    upperFacade(b, shaft, top + 0.2, n, mats, seed);
    // 세로 간판 기둥 — 길에 면한 면에만. 이게 잡거빌딩의 정체다
    for (const side of SIDES) {
      if (!faces[side]) continue;
      signColumn(b, shaft, side, top + 1.0, uTop - 1.0, mats, seed + SIDES.indexOf(side) * 41);
    }
    // 기단 옥상 난간
    b.add(facePlane(shrink(r, 0.2), top, 0.8, 'pz', null, 0), mats.pipeMat);
    b.add(facePlane(shrink(r, 0.2), top, 0.8, 'nz', null, 0), mats.pipeMat);
    crown = { rect: shaft, top: uTop };
  }

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
      shopStrip(b, f, y, rng, mats, D, litBase * (1 - fl * 0.1), shutBase + fl * 0.11, doorAt,
        fl, Math.round(r.x0) * 4 + SIDES.indexOf(side) + Math.round(r.z0));
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

    // ── 1) 층마다 가로 간판 (사용자 지적으로 다시 씀) ──────────────────────
    //
    // 전에는 `w: f.w * 0.55~0.95` 로 요청했다. 55m 짜리 병합 파사드에 높이
    // 2m 짜리를 걸면 **가로로 여섯 배 늘어난 배너**가 된다.
    //
    // 이제 폭은 signage.js 가 비율에서 정한다 (ASPECT). 그러면 배너 하나가
    // 8m 안팎이 되므로 **긴 면은 여러 장으로 채운다** — 실제 상가도 그렇다.
    // 간판 한 장이 건물 폭만 한 경우는 없고, 가게마다 하나씩 걸린다.
    //
    // 그리고 긴 면에는 **전광판 띠**(16:1)를 섞는다. 늘어난 배너로 때우던
    // 자리를, 원래 길게 태어난 유형이 맡는다.
    let stack = top - 1.2;
    const rows = Math.max(2, Math.round(4 * detail));
    // 한 줄에 몇 장 걸리나 — 면이 길수록 많이. 8m 에 한 장꼴
    const perRow = Math.max(1, Math.min(5, Math.round(f.w / 9)));
    for (let k = 0; k < rows; k++) {
      const bh = rng.range(1.2, 2.2);
      if (stack - bh < SHOP_FLOOR * 0.8) break;
      if (rng.chance(0.22)) { stack -= bh + 0.3; continue; }
      // 이 줄은 전광판 띠인가. 긴 면에서만, 그리고 한 건물에 한두 줄만
      const ticker = f.w > 22 && rng.chance(0.3);
      if (ticker) {
        signs.push({
          kind: 'strip', rect: r, side,
          y: stack - bh / 2, w: 0, h: bh * 0.62,
          scheme: rng.int(0, 5),
        });
      } else {
        for (let m = 0; m < perRow; m++) {
          signs.push({
            kind: 'banner', rect: r, side,
            y: stack - bh / 2, w: 0, h: bh,
            scheme: rng.int(0, 5),
          });
        }
      }
      stack -= bh + rng.range(0.25, 0.7);
    }

    // 1-b) 천 배너 — 어두운 것 하나. 네온만 있으면 네온이 안 읽힌다
    if (f.w >= 10 && rng.chance(0.5 * detail)) {
      signs.push({
        kind: 'cloth', rect: r, side,
        y: SHOP_FLOOR * rng.range(1.1, 1.5),
        w: rng.range(0.9, 1.4), h: 0,
        scheme: rng.int(0, 5),
      });
    }

    // 1-c) 상자간판 — 출입구 높이. 옆에서 걸어와도 읽힌다
    if (f.w >= 12 && rng.chance(0.55 * detail)) {
      signs.push({
        kind: 'box', rect: r, side,
        y: SHOP_FLOOR * rng.range(0.95, 1.25),
        w: 0, h: rng.range(1.5, 2.3),
        scheme: rng.int(0, 5),
      });
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
    // **실제 꼭대기**에 올린다. `top`(기단 지붕)에 올리면 타워 몸통 중턱에
    // 광고판이 박힌다.
    if (rng.chance(0.4 * detail)) {
      signs.push({
        kind: 'mega', rect: crown.rect, side,
        y: crown.top + rng.range(1, 4),
        w: f.w * rng.range(0.7, 1.0),
        h: rng.range(6, 12),
        scheme: rng.int(0, 5),
      });
    }
  }

  // 옥상 잡동사니는 **실제 꼭대기**에 앉는다. 대지 사각형에 앉히면 타워
  // 옆 허공에 판잣집이 뜬다 — 기업 크라운에서 이미 한 번 낸 실수다.
  rooftopShacks(b, crown.rect, crown.top, rng, mats);
  marketTallyAdd(form === 'tower' ? '잡거타워' : form === 'setback' ? '세트백상가' : '적층상가',
    r, crown.top);
  return { top: crown.top, floors };
}
