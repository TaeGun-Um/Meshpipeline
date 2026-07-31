// 번화가의 특수 유형 — 시장·명품관·유흥가·암거래·지하상가.
//
// ── 왜 필요한가 (사용자 지시) ──────────────────────────────────────────────
// "번화가는 시장, 명품전시관, 유흥가, 암거리시장, 지하상가 등이 있어야 할 것"
//
// 지금까지 상업 구역은 `bazaar.js` 하나였다. 적층 상가는 잘 만들어졌지만
// **32칸짜리 구역에 건물이 한 종류**라, 걸어도 같은 것만 나온다.
// 기업 구역에서 배운 것과 같다 — 파라미터를 흔들어서는 종류가 안 생긴다.
//
// ── 다섯이 서로 무엇으로 갈리는가 ──────────────────────────────────────────
// 종류를 늘릴 때 가장 흔한 실패는 "다 비슷한데 색만 다른 것" 을 다섯 개
// 만드는 것이다. 그래서 **갈리는 축을 먼저 정한다.**
//
//   유형        높이   창    간판      밝기    관계
//   적층상가    3~6층  있음  전면 도배  밝음    기준
//   시장 아케이드 1층   없음  입구만    안이 밝음 **지붕이 주인공**
//   명품 전시관 2~3층  통유리 거의 없음  차갑고 밝음 **주변과 반대**
//   유흥가      3~5층  **없음** 세로 탑  자홍    벽이 막혀 있다
//   암거래      1층    없음  없음      **어둡다** 천막이 지붕이다
//   지하상가    0층    —     입구 하나  아래서 샌다 **건물이 아니다**
//
// 높이·창·밝기가 전부 다르므로 멀리서도, 가까이서도 구별된다.
// 특히 **명품관과 암거래**가 요점이다. 둘은 정확히 반대이고, 그 둘이 한
// 구역 안에 같이 있다는 것이 이 도시의 성격이다 (docs/city.md 3기·4기).
import { autoBox, tubeBetween, lathe } from '../../core/profile.js';
import {
  faceFrame,
  SIDES,
  shrink,
  rectBox,
  upPlane,
  downPlane,
  rectCenter,
  rectSize,
} from '../../core/boxfaces.js';
import { NEON, rgb01 } from '../../shared/neon.js';
import { neon, neonSoft } from '../../shared/masters.js';
import { PANEL_TILE, CURB_HEIGHT } from './layout.js';

// 유형이 실제로 다 나오는지 세어 둔다. 종류를 늘려 놓고 확률이 낮아
// 한 번도 안 나오는 것은 만들지 않은 것과 같다 — 기업 양식에서 실제로
// 그랬다 (div 임계값 때문에 '유리' 양식이 안 나왔다).
let TALLY = {};
export function marketTally() {
  return { ...TALLY };
}
export function resetMarketTally() {
  TALLY = {};
}
const tally = (k) => { TALLY[k] = (TALLY[k] || 0) + 1; };

// ── 좌판 ───────────────────────────────────────────────────────────────────
//
// 시장과 암거래가 공유하는 최소 단위. 상판 + 다리 + 그 위에 쌓인 물건.
// 물건이 없으면 그냥 탁자다.
function stall(b, x, z, w, d, rng, mats, lit) {
  const Y = CURB_HEIGHT;
  const H = 0.86;
  b.add(autoBox(w, 0.1, d, [x, Y + H, z], 0.02), mats.plywoodMat);
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      b.box(0.08, H, 0.08, [x + sx * (w / 2 - 0.15), Y + H / 2, z + sz * (d / 2 - 0.15)], mats.metalMat);
    }
  }
  // 물건 — 상자와 봉지. 크기를 섞어야 '쌓았다' 로 읽힌다
  for (let i = 0; i < rng.int(3, 7); i++) {
    const bw = rng.range(0.2, 0.5);
    b.add(
      autoBox(bw, rng.range(0.15, 0.4), bw * rng.range(0.7, 1.3),
        [x + rng.range(-w * 0.36, w * 0.36), Y + H + 0.2, z + rng.range(-d * 0.32, d * 0.32)], 0.02),
      rng.chance(0.5) ? mats.crateMat : mats.crateAltMat
    );
  }
  // 좌판등 — 켜진 좌판만. 시장은 전부 켜져 있고 암거래는 드물다
  if (lit) {
    b.box(w * 0.7, 0.06, 0.1, [x, Y + 1.95, z], neonSoft(NEON.warm));
  }
}

// ── 1) 시장 아케이드 ───────────────────────────────────────────────────────
//
// **지붕이 주인공**이다. 건물이 아니라 덮인 길이라, 양 끝이 열려 있고
// 안이 밖보다 밝다. 그 대비 하나로 "들어가 볼 곳" 이 된다.
function arcade(b, r, rng, mats, signs, pools) {
  const Y = CURB_HEIGHT;
  const c = rectCenter(r);
  const s = rectSize(r);
  const alongX = s.w >= s.d;
  const len = alongX ? s.w : s.d;
  const wid = alongX ? s.d : s.w;
  const H = 7.4;

  // 바닥 — 인도와 다른 마감. 여기부터 시장이라는 표시
  b.add(upPlane(s.w, s.d, [c.x, Y + 0.03, c.z], [4, 4]), mats.tileWallMat);

  // 양옆 벽 — 낮고 두껍다. 안쪽에 점포가 붙는다
  const T = 1.6;
  for (const sg of [-1, 1]) {
    const wr = alongX
      ? { x0: r.x0, x1: r.x1, z0: c.z + sg * (wid / 2 - T), z1: c.z + sg * (wid / 2) }
      : { x0: c.x + sg * (wid / 2 - T), x1: c.x + sg * (wid / 2), z0: r.z0, z1: r.z1 };
    const fix = {
      x0: Math.min(wr.x0, wr.x1), x1: Math.max(wr.x0, wr.x1),
      z0: Math.min(wr.z0, wr.z1), z1: Math.max(wr.z0, wr.z1),
    };
    b.add(rectBox(fix, 0, Y + H, PANEL_TILE), mats.tileWallMat);
    // 안쪽 면의 점포 띠 — 통로를 향해 빛난다
    const n = Math.max(3, Math.round(len / 5.5));
    for (let i = 0; i < n; i++) {
      const t = -len / 2 + (len / n) * (i + 0.5);
      const px = alongX ? c.x + t : c.x + sg * (wid / 2 - T - 0.1);
      const pz = alongX ? c.z + sg * (wid / 2 - T - 0.1) : c.z + t;
      b.box(alongX ? len / n - 0.5 : 0.14, 2.6, alongX ? 0.14 : len / n - 0.5,
        [px, Y + 1.9, pz],
        [mats.glowWarm, mats.glowCool, mats.glowMagenta][rng.int(0, 2)]);
    }
  }

  // 지붕 — 반투명 채광 슬릿이 번갈아. 이것이 아케이드의 정체성이다
  const bays = Math.max(4, Math.round(len / 4.0));
  for (let i = 0; i < bays; i++) {
    const t = -len / 2 + (len / bays) * (i + 0.5);
    const px = alongX ? c.x + t : c.x;
    const pz = alongX ? c.z : c.z + t;
    const slat = i % 2 === 0;
    b.add(
      autoBox(alongX ? len / bays - 0.2 : wid, 0.34, alongX ? wid : len / bays - 0.2,
        [px, Y + H, pz], 0.04),
      slat ? mats.metalMat : mats.tarpMat
    );
  }
  // 지붕 밑면 — 안이 밝아야 '들어갈 곳' 이 된다
  b.add(downPlane(alongX ? len * 0.96 : wid * 0.9, alongX ? wid * 0.9 : len * 0.96,
    [c.x, Y + H - 0.2, c.z]), mats.deckUnderMat);

  // 매달린 등 — 통로를 따라. 시장의 인상은 이 줄에서 온다
  const lamps = Math.max(3, Math.round(len / 6));
  for (let i = 0; i < lamps; i++) {
    const t = -len / 2 + (len / lamps) * (i + 0.5);
    const lx = alongX ? c.x + t : c.x;
    const lz = alongX ? c.z : c.z + t;
    b.add(tubeBetween([lx, Y + H - 0.2, lz], [lx, Y + 4.4, lz], 0.03, 4), mats.cableMat);
    b.add(lathe([[0.5, 0], [0.42, 0.3], [0.06, 0.34]], 10, [lx, Y + 4.1, lz]), mats.metalMat);
    b.sphere(0.22, [lx, Y + 4.15, lz], neon(NEON.warm));
    pools.push({ kind: 'floor', x: lx, y: Y + 0.05, z: lz, rx: 4.6, rz: 4.6, tint: rgb01(NEON.warm, 0.55) });
  }

  // 좌판 두 줄 — 통로 양옆
  const rows = Math.max(3, Math.round(len / 3.4));
  for (let i = 0; i < rows; i++) {
    const t = -len / 2 + (len / rows) * (i + 0.5);
    for (const sg of [-1, 1]) {
      const sx = alongX ? c.x + t : c.x + sg * (wid * 0.24);
      const sz = alongX ? c.z + sg * (wid * 0.24) : c.z + t;
      stall(b, sx, sz, alongX ? 2.2 : 1.3, alongX ? 1.3 : 2.2, rng, mats, true);
    }
  }

  // 입구 간판 — 양 끝에만. 아케이드는 벽이 아니라 문에 이름을 붙인다
  const side = alongX ? (rng.chance(0.5) ? 'px' : 'nx') : (rng.chance(0.5) ? 'pz' : 'nz');
  signs.push({
    kind: 'banner', rect: r, side,
    y: Y + H - 2.2, w: wid * 0.72, h: 1.9, scheme: rng.int(0, 5),
  });
  // 긴 쪽 바깥 벽 — 여기도 거리를 향한 면이다. 시장 건물의 옆구리에는
  // 늘 간판이 붙어 있고, 이게 없으면 번화가 한복판에 민짜 벽이 생긴다.
  for (const long of alongX ? ['pz', 'nz'] : ['px', 'nx']) {
    const rows = rng.int(2, 3);
    for (let i = 0; i < rows; i++) {
      signs.push({
        kind: 'banner', rect: r, side: long,
        y: Y + 2.4 + i * 1.9, w: len * rng.range(0.42, 0.7), h: 1.5,
        scheme: rng.int(0, 5),
      });
    }
  }
  tally('시장');
  return { top: Y + H + 0.4 };
}

// ── 2) 명품 전시관 ─────────────────────────────────────────────────────────
//
// **이 구역의 모든 것과 반대로 만든다.** 그래야 번화가가 "다 같은 난장" 이
// 아니라 계층이 있는 곳이 된다.
//
//   간판을 안 단다      — 이름을 알 사람은 이미 안다
//   통유리다            — 안이 다 보인다. 숨길 것이 없다는 과시
//   비운다              — 진열대 하나에 물건 하나
//   도어맨 캐노피가 있다 — 아무나 들어가지 않는다
function vitrine(b, r, rng, mats, signs, pools) {
  const Y = CURB_HEIGHT;
  // ── 인셋이 캐노피 깊이를 정한다 ────────────────────────────────────────
  // 처음에 인셋 1.4~3.0 에 캐노피 깊이 5.2 를 따로 썼다. 캐노피가 필지를
  // 최대 3.8m 넘어가서 **옆 건물과 8.1m 겹쳤다** (배치 검사가 잡았다).
  // 같은 값을 두 곳에서 정하면 늘 이렇게 된다 — 하나에서 유도한다.
  const INSET = rng.range(3.4, 5.2);
  const box = shrink(r, INSET);
  const s = rectSize(box);
  const c = rectCenter(box);
  if (Math.min(s.w, s.d) < 9) return null;

  const floors = rng.int(2, 3);
  const FH = 5.2; // 층고가 높다. 높은 천장이 그 자체로 과시다
  const H = floors * FH;

  // 앞마당 — 좁지만 있다. 번화가에서 **비운 땅**은 이 유형뿐이다
  b.add(upPlane(rectSize(r).w, rectSize(r).d,
    [rectCenter(r).x, Y + 0.03, rectCenter(r).z], [3, 3]), mats.plazaMat);

  // 몸통 — 매끈한 석재. 유리가 붙을 뼈대다
  b.add(rectBox(box, 0, Y + H, PANEL_TILE), mats.panelMat);

  for (const side of SIDES) {
    const f = faceFrame(box, side);
    if (f.w < 6) continue;
    for (let fl = 0; fl < floors; fl++) {
      const y = Y + fl * FH;
      // 통유리 — 면 전체. 층 사이에 얇은 띠만 남긴다
      const [gx, gz] = f.at(0, 0.12);
      const [gw, gd] = f.size(f.w * 0.94, 0.16);
      b.add(autoBox(gw, FH * 0.82, gd, [gx, y + FH * 0.5, gz], 0.02), mats.vitrineGlassMat);
      // 진열 조명 — 유리 안쪽. 차고 밝다
      const [lx, lz] = f.at(0, -0.5);
      const [lw, ld] = f.size(f.w * 0.9, 0.3);
      b.add(autoBox(lw, 0.3, ld, [lx, y + FH * 0.88, lz], 0.02), neonSoft(0xeef4ff));
      // 진열대와 마네킹 — 1층에만. 층마다 넣으면 창고로 보인다
      if (fl === 0) {
        const n = Math.max(1, Math.round(f.w / 7));
        for (let i = 0; i < n; i++) {
          const u = -f.w * 0.4 + (f.w * 0.8 * (i + 0.5)) / n;
          const [px, pz] = f.at(u, -1.1);
          b.cylinder(0.6, 0.7, 0.5, [px, y + 0.25, pz], mats.plazaStepMat, 12);
          b.add(autoBox(0.36, 1.6, 0.24, [px, y + 1.3, pz], 0.1), mats.mannequinMat);
        }
      }
      // 층 띠
      b.add(rectBox(shrink(box, -0.18), y + FH - 0.34, 0.34, PANEL_TILE), mats.metalMat);
    }
  }

  // 파라펫 — 위가 깔끔하게 끝난다. 옥탑도 판잣집도 없다
  b.add(rectBox(shrink(box, -0.5), Y + H, 0.9, PANEL_TILE), mats.metalMat);

  // 도어맨 캐노피 — 한 면에만
  const entry = SIDES[rng.int(0, 3)];
  const f = faceFrame(box, entry);
  if (f.w >= 8) {
    const CD = INSET - 0.5; // 필지 안에 들어가는 최대 깊이
    const [cx, cz] = f.at(0, CD / 2);
    const [cw, cd] = f.size(Math.min(f.w * 0.5, 9), CD);
    b.box(cw, 0.4, cd, [cx, Y + 4.0, cz], mats.metalMat);
    b.add(downPlane(cw * 0.9, cd * 0.9, [cx, Y + 3.78, cz]), mats.deckUnderMat);
    for (const su of [-0.22, 0.22]) {
      const [ax, az] = f.at(f.w * su, 0.2);
      const [bx, bz] = f.at(f.w * su, CD * 0.92);
      b.add(tubeBetween([ax, Y + 5.4, az], [bx, Y + 4.2, bz], 0.05, 4), mats.metalMat);
    }
    // 레드카펫 대신 포장 한 겹. 색을 안 쓰는 것이 이 유형의 규칙이다
    b.add(upPlane(cw, cd, [cx, Y + 0.06, cz], [1, 2]), mats.plazaStepMat);
    pools.push({ kind: 'floor', x: cx, y: Y + 0.07, z: cz, rx: 7, rz: 7, tint: rgb01(0xeef4ff, 0.45) });
    // 볼라드 — 기업 광장과 같은 언어. 이 유형이 번화가에서 유일하게
    // 기업 구역의 어휘를 빌린다
    for (let i = -1; i <= 1; i++) {
      const [px, pz] = f.at(i * 2.6, CD * 0.86);
      b.cylinder(0.12, 0.14, 0.85, [px, Y + 0.42, pz], mats.metalMat, 8);
    }
  }

  // **간판을 안 단다.** signs 에 아무것도 넣지 않는 유일한 유형이다.
  tally('명품관');
  return { top: Y + H + 0.9 };
}

// ── 3) 유흥가 ──────────────────────────────────────────────────────────────
//
// **창이 없다.** 안을 안 보여 주는 것이 이 유형의 전부다. 그래서 벽이
// 통짜이고, 그 통짜 벽에 세로 간판이 탑처럼 쌓인다.
function nightlife(b, r, rng, mats, signs, pools) {
  const Y = CURB_HEIGHT;
  const s = rectSize(r);
  const c = rectCenter(r);
  const floors = rng.int(3, 5);
  const FH = 3.9;
  const H = floors * FH;

  // 몸통 — 창이 하나도 없다. 타일 벽
  b.add(rectBox(r, 0, Y + H, PANEL_TILE), mats.tileWallMat);
  // 층 띠 — 창이 없으니 이것만이 층수를 알려 준다
  for (let fl = 1; fl < floors; fl++) {
    b.add(rectBox(shrink(r, -0.2), Y + fl * FH, 0.3, PANEL_TILE), mats.frameMat);
  }
  // 옥상 설비
  b.add(rectBox(shrink(r, -0.4), Y + H, 0.7, PANEL_TILE), mats.metalMat);
  for (let i = 0; i < rng.int(1, 3); i++) {
    b.add(autoBox(rng.range(1.4, 2.6), rng.range(1.0, 1.8), rng.range(1.4, 2.6),
      [c.x + rng.range(-s.w * 0.3, s.w * 0.3), Y + H + 1.5, c.z + rng.range(-s.d * 0.3, s.d * 0.3)], 0.06),
      mats.ductMat);
  }

  // 세로 간판 탑 — 모서리에서 지붕까지. 유흥가의 실루엣이 이것이다
  const front = SIDES[rng.int(0, 3)];
  const f = faceFrame(r, front);
  const stack = Math.max(2, floors - 1);
  for (let i = 0; i < stack; i++) {
    signs.push({
      kind: 'blade', rect: r, side: front,
      y: Y + 2.2 + i * (H - 3.4) / stack,
      w: 1.0, h: (H - 3.4) / stack - 0.5,
      scheme: rng.int(0, 5),
    });
  }
  // 정면 대형 간판 하나 더 — 이름
  signs.push({
    kind: 'billboard', rect: r, side: front,
    y: Y + H * 0.55, w: f.w * rng.range(0.4, 0.6), h: rng.range(2.6, 4.2),
    scheme: rng.int(0, 5),
  });
  // 옆면에도 건다. **간판이 이 유형의 정체성**이라 정면 하나로는 모자란다 —
  // 창이 없는 벽이므로 간판을 걸 자리는 오히려 넉넉하다.
  for (const other of SIDES) {
    if (other === front) continue;
    if (!rng.chance(0.55)) continue;
    const of2 = faceFrame(r, other);
    if (of2.w < 7) continue;
    const rows = rng.int(1, 3);
    for (let i = 0; i < rows; i++) {
      signs.push({
        kind: 'banner', rect: r, side: other,
        y: Y + 3.0 + i * 2.3, w: of2.w * rng.range(0.5, 0.82), h: 1.7,
        scheme: rng.int(0, 5),
      });
    }
  }

  // 입구 — 계단 두 단과 대기줄 난간. **줄이 선다는 것이 유흥가의 증거**다
  if (f.w >= 8) {
    const [ex, ez] = f.at(0, 0.55);
    const [ew, ed] = f.size(4.6, 1.1);
    b.box(ew, 0.36, ed, [ex, Y + 0.18, ez], mats.plazaStepMat);
    const [dx, dz] = f.at(0, 0.1);
    const [dw, dd] = f.size(3.4, 0.2);
    b.add(autoBox(dw, 3.0, dd, [dx, Y + 1.5, dz], 0.02), neonSoft(NEON.magenta));
    // 대기줄 기둥 — 벨벳 로프 대신 기둥만
    for (let i = -1; i <= 1; i += 2) {
      const [px, pz] = f.at(i * 3.0, 1.0);
      b.cylinder(0.1, 0.14, 1.0, [px, Y + 0.5, pz], mats.metalMat, 8);
      b.sphere(0.13, [px, Y + 1.05, pz], neon(NEON.magenta));
    }
    pools.push({ kind: 'floor', x: ex, y: Y + 0.06, z: ez, rx: 8, rz: 8, tint: rgb01(NEON.magenta, 0.7) });
  }
  tally('유흥가');
  return { top: Y + H + 2.4 };
}

// ── 4) 암거래 골목 ─────────────────────────────────────────────────────────
//
// **어두운 것이 요점**이다. 번화가에서 유일하게 빛을 피하는 곳이라,
// 밝은 것 옆에 있어야 의미가 있다 (그래서 상업 구역 안에 둔다).
//
// 천막이 지붕이고 함석이 벽이다. 슬럼의 어휘를 상업 구역이 빌려 쓴다.
function blackMarket(b, r, rng, mats, signs, pools) {
  const Y = CURB_HEIGHT;
  const c = rectCenter(r);
  const s = rectSize(r);
  const alongX = s.w >= s.d;
  const len = alongX ? s.w : s.d;
  const wid = alongX ? s.d : s.w;
  const H = 3.4; // 사람 키보다 조금 높을 뿐이다

  b.add(upPlane(s.w, s.d, [c.x, Y + 0.03, c.z], [5, 5]), mats.alleyFloorMat);

  // 양옆 가림막 — 함석과 합판을 섞는다. 규격이 없어야 임시로 읽힌다
  const panels = Math.max(4, Math.round(len / 2.6));
  for (let i = 0; i < panels; i++) {
    const t = -len / 2 + (len / panels) * (i + 0.5);
    for (const sg of [-1, 1]) {
      const h = rng.range(2.6, 4.2);
      const px = alongX ? c.x + t : c.x + sg * (wid / 2 - 0.3);
      const pz = alongX ? c.z + sg * (wid / 2 - 0.3) : c.z + t;
      b.add(
        autoBox(alongX ? len / panels - 0.15 : 0.2, h, alongX ? 0.2 : len / panels - 0.15,
          [px, Y + h / 2, pz], 0.02),
        rng.chance(0.45) ? mats.rustMat : mats.plywoodMat
      );
      // 셔터 — 닫힌 가게가 절반이다. 이 시각에 여는 곳이 따로 있다
      if (rng.chance(0.3)) {
        b.add(
          autoBox(alongX ? len / panels - 0.6 : 0.1, 2.1, alongX ? 0.1 : len / panels - 0.6,
            [px, Y + 1.05, pz], 0.02),
          mats.shutterMat
        );
      }
    }
  }

  // 천막 지붕 — 이어 붙인 조각들. 높이가 제각각이라 물이 고인다
  const tarps = Math.max(3, Math.round(len / 4.4));
  for (let i = 0; i < tarps; i++) {
    const t = -len / 2 + (len / tarps) * (i + 0.5);
    const px = alongX ? c.x + t : c.x;
    const pz = alongX ? c.z : c.z + t;
    const sag = rng.range(-0.35, 0.25);
    b.add(
      autoBox(alongX ? len / tarps + 0.3 : wid * 0.94, 0.1, alongX ? wid * 0.94 : len / tarps + 0.3,
        [px, Y + H + sag, pz], 0.02),
      mats.tarpMat
    );
    // 천막을 매다는 줄
    for (const sg of [-1, 1]) {
      const ax = alongX ? px : c.x + sg * wid * 0.46;
      const az = alongX ? c.z + sg * wid * 0.46 : pz;
      b.add(tubeBetween([ax, Y + H + sag, az], [ax, Y + 4.4, az], 0.02, 4), mats.cableMat);
    }
  }

  // 좌판 — 불이 거의 안 켜져 있다. 시장(전부 켜짐)과의 결정적 차이
  const rows = Math.max(2, Math.round(len / 4.2));
  for (let i = 0; i < rows; i++) {
    const t = -len / 2 + (len / rows) * (i + 0.5);
    const sg = rng.chance(0.5) ? 1 : -1;
    const sx = alongX ? c.x + t : c.x + sg * wid * 0.22;
    const sz = alongX ? c.z + sg * wid * 0.22 : c.z + t;
    stall(b, sx, sz, alongX ? 1.8 : 1.1, alongX ? 1.1 : 1.8, rng, mats, rng.chance(0.25));
  }

  // 등 하나. **딱 하나다** — 여러 개면 그냥 어두운 시장이다
  const lx = c.x + rng.range(-s.w * 0.2, s.w * 0.2);
  const lz = c.z + rng.range(-s.d * 0.2, s.d * 0.2);
  b.sphere(0.16, [lx, Y + 3.0, lz], neon(NEON.amber));
  pools.push({ kind: 'floor', x: lx, y: Y + 0.05, z: lz, rx: 5.0, rz: 5.0, tint: rgb01(NEON.amber, 0.4) });

  // 간판은 안 단다. 광고하는 곳이 아니다.
  tally('암거래');
  return { top: Y + 4.6 };
}

// ── 5) 지하상가 진입구 ─────────────────────────────────────────────────────
//
// **건물이 아니다.** 지면에 뚫린 구멍과 그 위 캐노피뿐이고, 나머지는 광장이다.
// 도시에 이런 자리가 있어야 "여기 밑에도 도시가 있다" 가 성립한다 — 지금
// 이 도시는 지면과 공중만 있다 (과제 #26 '사람이 사는 고도' 의 아래쪽 짝).
function underpass(b, r, rng, mats, signs, pools) {
  const Y = CURB_HEIGHT;
  const c = rectCenter(r);
  const s = rectSize(r);

  // 광장 포장 — 이 필지는 대부분 빈 땅이다
  b.add(upPlane(s.w, s.d, [c.x, Y + 0.03, c.z], [4, 4]), mats.plazaMat);

  const alongX = s.w >= s.d;
  const MW = Math.min(alongX ? s.d : s.w, 9) * 0.66; // 계단 폭
  const ML = Math.min(alongX ? s.w : s.d, 16) * 0.6; // 계단 길이
  const DEPTH = 5.2;

  // 구멍 — 어두운 상자를 지면 아래로. 이것이 '아래' 를 만든다
  const pit = alongX
    ? { x0: c.x - ML / 2, x1: c.x + ML / 2, z0: c.z - MW / 2, z1: c.z + MW / 2 }
    : { x0: c.x - MW / 2, x1: c.x + MW / 2, z0: c.z - ML / 2, z1: c.z + ML / 2 };
  b.add(rectBox(pit, -DEPTH, DEPTH + 0.1, PANEL_TILE), mats.pitMat);

  // 계단 — 한 단씩. 아래로 갈수록 어두워지지만 **끝에서 빛이 샌다**
  const steps = 16;
  for (let i = 0; i < steps; i++) {
    const t = (i + 0.5) / steps;
    const y = Y - DEPTH * t;
    const along = (t - 0.5) * ML;
    const px = alongX ? c.x + along : c.x;
    const pz = alongX ? c.z : c.z + along;
    b.box(alongX ? ML / steps : MW, 0.3, alongX ? MW : ML / steps,
      [px, y, pz], mats.plazaStepMat);
  }
  // 아래에서 새는 빛 — 이 유형의 전부다. 없으면 그냥 구덩이다
  const endX = alongX ? c.x + ML / 2 : c.x;
  const endZ = alongX ? c.z : c.z + ML / 2;
  b.add(
    autoBox(alongX ? 0.3 : MW * 0.9, 3.0, alongX ? MW * 0.9 : 0.3,
      [endX, Y - DEPTH + 1.6, endZ], 0.02),
    neonSoft(NEON.cool)
  );
  pools.push({
    kind: 'floor', x: (c.x + endX) / 2, y: Y + 0.06, z: (c.z + endZ) / 2,
    rx: 8, rz: 8, tint: rgb01(NEON.cool, 0.5),
  });

  // 난간 — 구멍 둘레. 없으면 사람이 빠진다 (그리고 구멍으로 안 읽힌다)
  for (const side of SIDES) {
    const f = faceFrame(pit, side);
    if (f.w < 2) continue;
    const n = Math.max(2, Math.round(f.w / 1.6));
    for (let i = 0; i <= n; i++) {
      const u = -f.w / 2 + f.w * (i / n);
      const [px, pz] = f.at(u, 0.12);
      b.cylinder(0.05, 0.05, 1.1, [px, Y + 0.55, pz], mats.metalMat, 6);
    }
    const [hx, hz] = f.at(0, 0.12);
    const [hw, hd] = f.size(f.w, 0.08);
    b.box(hw, 0.08, hd, [hx, Y + 1.1, hz], mats.metalMat);
  }

  // 캐노피 — 입구 위. 비 오는 도시라 계단 입구에는 반드시 있다
  const cw = alongX ? ML * 0.5 : MW + 2.4;
  const cd = alongX ? MW + 2.4 : ML * 0.5;
  const ccx = alongX ? c.x - ML * 0.25 : c.x;
  const ccz = alongX ? c.z : c.z - ML * 0.25;
  b.box(cw, 0.34, cd, [ccx, Y + 3.6, ccz], mats.metalMat);
  b.add(downPlane(cw * 0.9, cd * 0.9, [ccx, Y + 3.42, ccz]), mats.deckUnderMat);
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      b.cylinder(0.09, 0.11, 3.6,
        [ccx + sx * cw * 0.42, Y + 1.8, ccz + sz * cd * 0.42], mats.metalMat, 8);
    }
  }

  // 입구 간판 — 지하상가는 이름을 크게 건다. 안 보이는 곳이라 그래야 한다.
  // 그리고 **아래에 무엇이 있는지 목록**이 붙는다. 안 보이는 가게를
  // 알리는 방법이 그것뿐이라, 실제 지하상가 입구는 늘 간판투성이다.
  const ent = alongX ? 'nx' : 'nz';
  signs.push({
    kind: 'banner', rect: pit, side: ent,
    y: Y + 3.9, w: (alongX ? cd : cw) * 0.8, h: 1.5, scheme: rng.int(0, 5),
  });
  for (let i = 0; i < rng.int(2, 4); i++) {
    signs.push({
      kind: 'banner', rect: pit, side: ent,
      y: Y + 1.5 + i * 0.85, w: (alongX ? cd : cw) * rng.range(0.4, 0.7), h: 0.72,
      scheme: rng.int(0, 5),
    });
  }

  // 광장 가장자리 시설 — 빈 땅이 공터로 안 보이게
  for (let i = 0; i < rng.int(2, 5); i++) {
    const px = c.x + rng.range(-s.w * 0.42, s.w * 0.42);
    const pz = c.z + rng.range(-s.d * 0.42, s.d * 0.42);
    // 구멍 위에는 안 놓는다
    if (px > pit.x0 - 2 && px < pit.x1 + 2 && pz > pit.z0 - 2 && pz < pit.z1 + 2) continue;
    b.cylinder(0.1, 0.12, 4.0, [px, Y + 2.0, pz], mats.metalMat, 8);
    b.sphere(0.16, [px, Y + 4.0, pz], neon(NEON.cool));
    pools.push({ kind: 'floor', x: px, y: Y + 0.05, z: pz, rx: 4.2, rz: 4.2, tint: rgb01(NEON.cool, 0.3) });
  }
  tally('지하상가');
  return { top: Y + 3.9 };
}

// ── 어느 번화가인가 (사용자 지시) ──────────────────────────────────────────
//
// "안쪽으로 있는 번화가는 명품관, 시장 등이 존재하도록 하고,
//  북쪽(어두운 건물들 밀집된 부분)을 향하는 번화가는 유흥가랑 지하상가,
//  암거래 시장 이런걸로"
//
// 무작위 해시로 다섯을 흩뿌리는 것보다 **자리가 성격을 정하는** 쪽이 맞다.
// 그래야 "저쪽으로 가면 무엇이 있다" 가 성립하고, 그게 탐험할 이유다.
//
// 배치도(district.PLAN)에서 상업은 두 덩어리다.
//
//   북쪽 (ix 9~11, iz 5~8)  기업과 슬럼 사이에 낀 띠. 어두운 것들에 접한다
//   안쪽 (ix 1~5,  iz 4~7)  주거와 공업에 둘러싸인 큰 덩어리
//
// 내력으로도 맞는다 (docs/city.md). 슬럼은 기업이 사 모았다가 버린 자리이고,
// 그 경계에 붙은 상권이 밝고 합법적일 이유가 없다. 반대로 주거에 둘러싸인
// 안쪽은 사람이 매일 장을 보는 곳이다.
//
//   안쪽 → 시장 아케이드 · 명품 전시관     (사는 곳)
//   북쪽 → 유흥가 · 지하상가 · 암거래      (밤에 오는 곳)
//
// 그림 위 = +X 이므로 '북쪽' 은 ix 가 큰 쪽이다 (district.PLAN 머리말).
const NORTH_FROM_IX = 6;

export function marketSideOf(ix) {
  return ix >= NORTH_FROM_IX ? 'north' : 'inner';
}

// ── 어느 유형이 되나 ───────────────────────────────────────────────────────
//
// 좌표 해시로 정한다. 난수를 쓰면 확률 하나만 바꿔도 도시 전체가 밀린다
// (blockProgram·alleyFor 와 같은 이유).
//
// 유형마다 **필요한 크기가 다르다.** 지하상가는 계단이 들어갈 길이가
// 필요하고 아케이드는 통로가 되려면 길어야 한다. 안 맞으면 적층 상가로
// 떨어진다 — 억지로 넣으면 그 유형이 그 유형으로 안 읽힌다.
//
// ── 비율 (실측으로 고침) ───────────────────────────────────────────────────
// 처음에 합계 49% 로 잡았더니 특수 유형이 67채가 되면서 **간판이 702 ->
// 362 개로 반토막**났다 (감사의 비율 지표가 잡았다: 건물당 간판 1.36 < 2.1).
//
// 당연했다. 번화가의 정의가 "간판이 전면을 덮는다" 인데, 명품관과 암거래는
// 설계상 간판이 0 이다. 그 둘이 늘면 구역의 정체성이 사라진다.
// **기준 유형(적층 상가)이 다수여야 한다** — 특수 유형은 양념이지 밥이 아니다.
export function pickMarketKind(h, s, side) {
  const small = Math.min(s.w, s.d);
  const large = Math.max(s.w, s.d);

  if (side === 'inner') {
    // 명품관 비중을 줄였다. 15채까지 늘었더니 **간판이 148개 모자랐다** —
    // 이 유형만 설계상 간판이 0 이라, 한 채 늘 때마다 적층 상가 열 개
    // 분량의 간판이 사라진다. 희소해야 '명품' 이기도 하다.
    if (h < 0.20 && large > 26 && small > 12) return 'arcade';
    if (h < 0.28 && small > 16) return 'vitrine';
    return null;
  }
  // north — 밤에 오는 곳
  //
  // 지하상가를 **맨 앞에 둔다.** 뒤에 두었더니 크기 조건(large>24 · small>16)에
  // 걸려 도시 전체에 **1채**밖에 안 섰다. 앞의 유형들이 먼저 큰 필지를
  // 가져가 버리기 때문이다. 조건도 함께 낮춘다 — 계단이 들어갈 정도면 된다.
  //
  // 종류를 만들어 놓고 확률·크기 조건 때문에 안 나오면 만들지 않은 것과
  // 같다. 기업 양식에서 이미 한 번 그랬다 (div 임계값 때문에 '유리' 가
  // 안 나왔다). 그래서 marketTally() 로 매번 센다.
  // 2채까지 떨어진 적이 있다. 크기 관문은 **상류 난수 소비가 바뀌면 같이
  // 흔들린다** — 필지 크기가 splitToTarget 의 난수에서 나오기 때문이다.
  // 그래서 관문을 넉넉히 두고 띠를 넓게 잡는다.
  if (h < 0.17 && large > 18 && small > 12) return 'underpass';
  if (h < 0.26 && small > 13) return 'nightlife';
  if (h < 0.42 && large > 20) return 'black';
  return null; // 적층 상가 (bazaar.js)
}

export function marketBlock(b, kind, r, rng, mats, signs, pools) {
  if (kind === 'arcade') return arcade(b, r, rng, mats, signs, pools);
  if (kind === 'vitrine') return vitrine(b, r, rng, mats, signs, pools) || null;
  if (kind === 'nightlife') return nightlife(b, r, rng, mats, signs, pools);
  if (kind === 'black') return blackMarket(b, r, rng, mats, signs, pools);
  if (kind === 'underpass') return underpass(b, r, rng, mats, signs, pools);
  return null;
}
