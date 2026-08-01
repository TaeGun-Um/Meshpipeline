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
import { PANEL_TILE, CURB_HEIGHT, buildableSlabs } from './layout.js';
import { hash2 } from '../../core/textures.js';

// 유형이 실제로 다 나오는지 세어 둔다. 종류를 늘려 놓고 확률이 낮아
// 한 번도 안 나오는 것은 만들지 않은 것과 같다 — 기업 양식에서 실제로
// 그랬다 (div 임계값 때문에 '유리' 양식이 안 나왔다).
let TALLY = {};
let SPOTS = [];
export function marketTally() {
  return { ...TALLY };
}
// 어디에 섰는지도 남긴다. **"만들었다" 와 "화면에서 보인다" 는 다르다** —
// 개수만 세면 낮은 유형이 높은 건물에 가려 안 보이는 것을 못 잡는다.
// 실제로 사용자가 "지하상가·암시장은 어딨는지도 모르겠다" 고 했다.
export function marketSpots() {
  return SPOTS.slice();
}
export function resetMarketTally() {
  TALLY = {};
  SPOTS = [];
}
// 적층 상가(bazaar.js)도 같은 장부에 올린다. 번화가의 대부분이 그것인데
// 장부에 없으면 "번화가 건물이 전부 낮다" 같은 질문에 답할 수가 없다 —
// 실제로 #50 을 재려고 할 때 다섯 유형만 재고 정작 주류를 못 쟀다.
export function marketTallyAdd(k, r, top) {
  tally(k, r, top);
}
const tally = (k, r, top) => {
  TALLY[k] = (TALLY[k] || 0) + 1;
  if (r) {
    SPOTS.push({
      kind: k,
      x: Math.round((r.x0 + r.x1) / 2),
      z: Math.round((r.z0 + r.z1) / 2),
      w: Math.round(r.x1 - r.x0),
      d: Math.round(r.z1 - r.z0),
      top: top ? +top.toFixed(1) : 0,
    });
  }
};

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
  // 지붕 높이. 상수로 두었더니 12채가 **전부 8.0m** 였다 — 아케이드가
  // 늘어선 곳에서 지붕선이 자로 그은 듯 일직선이 됐다. 실제 아케이드는
  // 구간마다 증축 시기가 달라 높이가 들쭉날쭉하다.
  const H = 6.4 + hash2(Math.round(r.x0), Math.round(r.z0)) * 4.2;

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

  // ── 지붕 (사용자 지적으로 다시 만듦) ────────────────────────────────────
  //
  // *"1은 무슨 의도의 건축물인지 전혀 모르겠음"*
  //
  // 맞다. `metalMat` 과 `tarpMat` 을 번갈아 깔았는데 **둘 다 불투명하고 둘 다
  // 어둡다.** 그래서 위에서 보면 줄무늬 뚜껑 하나고, 안에 시장이 있다는 신호가
  // 밖으로 한 조각도 안 나갔다. "반투명 채광 슬릿" 이라고 주석에 써 놓고
  // 실제로는 안 빛나는 판을 깐 것이다 — `vitrineGlassMat` 때와 같은 착각이다
  // (docs/status.md 2.1 규칙 7: 재질을 이름으로 믿지 않는다).
  //
  // 채광창은 **아래가 밝을 때 위에서 빛난다.** 그것이 이 지붕의 전부다.
  // 뼈대(불투명)와 채광판(발광)을 번갈아 놓으면, 위에서는 빛나는 줄무늬가
  // 되고 옆에서는 처마 밑으로 새는 빛이 된다.
  const bays = Math.max(4, Math.round(len / 4.0));
  const glow = neonSoft([NEON.warm, NEON.amber][Math.round(hash2(r.x0, r.z0))]);
  for (let i = 0; i < bays; i++) {
    const t = -len / 2 + (len / bays) * (i + 0.5);
    const px = alongX ? c.x + t : c.x;
    const pz = alongX ? c.z : c.z + t;
    const rib = i % 2 === 0;
    // 뼈대는 도톰하고 채광판은 얇다. 두께 차이가 골함석 같은 결을 만든다
    b.add(
      autoBox(alongX ? len / bays - 0.2 : wid, rib ? 0.34 : 0.16,
        alongX ? wid : len / bays - 0.2,
        [px, Y + H + (rib ? 0 : 0.06), pz], 0.04),
      rib ? mats.metalMat : glow
    );
  }
  // 지붕 밑면 — 안이 밝아야 '들어갈 곳' 이 된다
  b.add(downPlane(alongX ? len * 0.96 : wid * 0.9, alongX ? wid * 0.9 : len * 0.96,
    [c.x, Y + H - 0.2, c.z]), mats.deckUnderMat);

  // ── 양 끝의 문틀 ────────────────────────────────────────────────────────
  //
  // 아케이드는 **관통하는 홀**이라 양 끝이 문이다. 그런데 그 문에 아무 표시가
  // 없어서, 밖에서 보면 그냥 벽 두 장 사이의 틈이었다. 틀을 두르고 문지방에
  // 빛줄을 깔면 "여기로 들어간다" 가 한눈에 읽힌다.
  for (const sg of [-1, 1]) {
    const ex = alongX ? c.x + sg * len / 2 : c.x;
    const ez = alongX ? c.z : c.z + sg * len / 2;
    // 인방 — 지붕 밑에 가로지른 두꺼운 보
    b.add(autoBox(alongX ? 0.9 : wid + 0.6, 1.5, alongX ? wid + 0.6 : 0.9,
      [ex, Y + H - 0.9, ez], 0.05), mats.frameConcMat);
    b.box(alongX ? 0.34 : wid - 1.2, 0.5, alongX ? wid - 1.2 : 0.34,
      [ex, Y + H - 1.7, ez], glow);
    // 문지방 — 바닥에 그은 줄. 이 한 줄이 안과 밖을 가른다
    b.box(alongX ? 0.5 : wid - 1.0, 0.06, alongX ? wid - 1.0 : 0.5,
      [ex, Y + 0.09, ez], neon(NEON.amber));
    pools.push({
      kind: 'floor', x: ex + (alongX ? sg * 3.5 : 0), y: Y + 0.05,
      z: ez + (alongX ? 0 : sg * 3.5),
      rx: alongX ? 5 : wid * 0.6, rz: alongX ? wid * 0.6 : 5,
      tint: rgb01(NEON.amber, 0.45),
    });
  }

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
  tally('시장', r, Y + H + 0.4);
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

  // 2~4층. 좌표 해시로 한 층을 더 얹는다 — `rng.int(2,3)` 만 쓰면 15채 중
  // 중앙값이 계속 11.5m 에 몰려 "명품관은 다 똑같이 생겼다" 가 된다.
  // 난수를 더 뽑지 않는 이유는 늘 같다 (status.md 2.1 규칙 6).
  const floors = rng.int(2, 3) + (hash2(Math.round(r.x0), Math.round(r.z0) + 313) > 0.55 ? 1 : 0);
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
  tally('명품관', r, Y + H + 0.9);
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
  // ── 자로 잰 듯한 줄을 깬다 (사용자 지적) ────────────────────────────
  // "측면 간판도 다 너무 일렬로 붙어있고"
  //
  // 등간격으로 쌓았더니 완벽한 수직선이 됐다. 실제 유흥가 간판은 가게마다
  // 따로 단 것이라 크기도 높이도 제각각이고, **면도 하나가 아니다.**
  // 자리(u)는 signage.layoutSigns 가 겹치지 않게 정한다.
  const stack = Math.max(2, floors);
  let sy = Y + 2.0;
  for (let i = 0; i < stack && sy < Y + H - 3; i++) {
    const sh = rng.range(2.6, 5.4);
    if (sy + sh > Y + H - 1.5) break;
    signs.push({
      kind: 'blade',
      rect: r,
      // 정면에 몰지 않는다. 모서리 가게는 두 면에 건다
      side: rng.chance(0.68) ? front : SIDES[rng.int(0, 3)],
      y: sy,
      w: rng.range(0.85, 1.35),
      h: sh,
      scheme: rng.int(0, 5),
    });
    sy += sh + rng.range(0.5, 2.2); // 간격이 제각각이어야 줄로 안 보인다
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
  tally('유흥가', r, Y + H + 2.4);
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
  b.add(upPlane(s.w, s.d, [c.x, Y + 0.03, c.z], [5, 5]), mats.alleyFloorMat);

  // ── 한 채가 아니라 **소규모 단지**다 (사용자 재지적) ─────────────────────
  //
  // *"암시장인지도 모르겠음. 내 말은 단지 안에 소규모 단지로 해서 암시장을
  //  형성하라고 했던건데"*
  //
  // 처음에는 양옆에 가림막을 세우고 천막을 덮은 **긴 통로 한 채**로 지었다.
  // 그건 시장 아케이드의 형태를 어둡게 칠한 것일 뿐이고, 그래서 무엇인지
  // 안 읽혔다. 암시장은 **설계된 건물이 아니다** — 남의 땅 틈에 판잣집이
  // 하나씩 붙어 생긴 덩어리다.
  //
  // 그러니 형태도 그렇게 만든다: 작은 칸을 **불규칙한 격자**로 앉히고 그
  // 사이를 좁은 틈으로 남긴다. 칸마다 크기·높이·재질이 다르고, 천막도
  // 칸 단위로 따로 덮인다. 통로가 아니라 **미로**가 정체다.
  const CELL = 5.2;   // 칸 하나의 기준 크기
  const LANE = 1.7;   // 칸 사이 틈. 사람 하나가 겨우 지난다
  const nx = Math.max(2, Math.floor((s.w + LANE) / (CELL + LANE)));
  const nz = Math.max(2, Math.floor((s.d + LANE) / (CELL + LANE)));
  const cw = (s.w - LANE * (nx - 1)) / nx;
  const cd = (s.d - LANE * (nz - 1)) / nz;

  for (let i = 0; i < nx; i++) {
    for (let j = 0; j < nz; j++) {
      // 난수를 **먼저 다 뽑는다.** 조건부로 건너뛰면 소비량이 갈려서 도시
      // 전체가 다시 뽑힌다 (docs/status.md 2.1 규칙 6)
      const skip = rng.chance(0.16); // 빈 자리 — 다 차 있으면 계획된 것으로 보인다
      const h = rng.range(2.4, 3.9);
      const shrinkW = rng.range(0.3, 1.1);
      const shrinkD = rng.range(0.3, 1.1);
      const sag = rng.range(-0.3, 0.2);
      const lit = rng.chance(0.22);
      const shut = rng.chance(0.34);
      const skew = rng.range(-0.5, 0.5);
      const px = r.x0 + cw / 2 + (cw + LANE) * i + skew;
      const pz = r.z0 + cd / 2 + (cd + LANE) * j + skew;
      const w2 = cw - shrinkW;
      const d2 = cd - shrinkD;
      if (skip || w2 < 2 || d2 < 2) continue;

      // 벽 — 세 면만. 한 면은 틈을 향해 열려 있어야 가게가 된다
      const open = (i + j) % 4;
      const walls = [[0, -1], [1, 0], [0, 1], [-1, 0]].filter((_, k) => k !== open);
      for (const [dx, dz] of walls) {
        const T = 0.22;
        b.add(autoBox(dx ? T : w2, h, dz ? T : d2,
          [px + dx * (w2 / 2), Y + h / 2, pz + dz * (d2 / 2)], 0.02),
        rng.chance(0.45) ? mats.rustMat : mats.plywoodMat);
      }
      // 셔터 — 닫힌 가게가 절반이다. 이 시각에 여는 곳이 따로 있다
      if (shut) {
        const [dx, dz] = [[0, -1], [1, 0], [0, 1], [-1, 0]][open];
        b.add(autoBox(dx ? 0.1 : w2 - 0.5, 2.1, dz ? 0.1 : d2 - 0.5,
          [px + dx * (w2 / 2), Y + 1.05, pz + dz * (d2 / 2)], 0.02), mats.shutterMat);
      }
      // 천막 — **칸마다 따로.** 하나로 덮으면 다시 건물이 된다
      b.add(autoBox(w2 + 0.7, 0.1, d2 + 0.7, [px, Y + h + sag, pz], 0.02), mats.tarpMat);
      b.add(tubeBetween([px + w2 / 2, Y + h + sag, pz], [px + w2 / 2, Y + 4.4, pz],
        0.02, 4), mats.cableMat);
      // 좌판 — 불이 거의 안 켜져 있다. 시장(전부 켜짐)과의 결정적 차이
      stall(b, px, pz, Math.min(1.9, w2 * 0.6), Math.min(1.9, d2 * 0.6), rng, mats, lit);
    }
  }

  // 등 하나. **딱 하나다** — 여러 개면 그냥 어두운 시장이다
  const lx = c.x + rng.range(-s.w * 0.2, s.w * 0.2);
  const lz = c.z + rng.range(-s.d * 0.2, s.d * 0.2);
  b.sphere(0.16, [lx, Y + 3.0, lz], neon(NEON.amber));
  pools.push({ kind: 'floor', x: lx, y: Y + 0.05, z: lz, rx: 5.0, rz: 5.0, tint: rgb01(NEON.amber, 0.4) });

  // ── 위에 남은 골조 (사용자 지적) ─────────────────────────────────────────
  //
  // "암시장(얘도 어딨는지도 모르겠고)"
  //
  // 지하상가와 같은 문제다. 제일 높은 곳이 4.6m 라 옆 건물에 완전히 묻혔다.
  //
  // 다만 해법은 반대여야 한다 — 암거래는 **간판을 안 다는 것**이 정체이므로
  // 탑을 세우면 그 순간 암거래가 아니다. 대신 **짓다 만 골조**를 올린다.
  // 3기에 공사가 멈춘 자리에 천막이 들어간 것이라는 설정과도 맞고
  // (slum.js 머리말과 같은 내력), 뼈대만 선 실루엣은 밤하늘에 검게 뜨므로
  // "저기 뭔가 있는데 불이 안 켜져 있다" 가 된다. 그게 정확히 이 유형이다.
  const hz = hash2(Math.round(r.x0), Math.round(r.z0) + 517);
  let apex = Y + 4.6;
  if (hz > 0.3) {
    const fl = 2 + Math.floor(hz * 4); // 2~5층
    const FH = 3.6;
    const cols = Math.max(2, Math.round(s.w / 8));
    const rows2 = Math.max(2, Math.round(s.d / 8));
    apex = Y + 4.6 + fl * FH;
    for (let i = 0; i <= cols; i++) {
      for (let j = 0; j <= rows2; j++) {
        const px = r.x0 + ((r.x1 - r.x0) * i) / cols;
        const pz = r.z0 + ((r.z1 - r.z0) * j) / rows2;
        b.box(0.45, fl * FH, 0.45, [px, Y + 4.6 + (fl * FH) / 2, pz], mats.frameConcMat);
      }
    }
    for (let k = 1; k <= fl; k++) {
      // 위층일수록 덜 지어졌다 — 공사가 위에서 멈췄다
      const done = k < fl ? 1 : 0.4 + hz * 0.4;
      b.box(s.w * done, 0.3, s.d * done,
        [c.x - (s.w * (1 - done)) / 2, Y + 4.6 + k * FH, c.z], mats.frameConcMat);
    }
  }

  // 간판은 안 단다. 광고하는 곳이 아니다.
  tally('암거래', r, apex);
  return { top: apex };
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

  // ── 입구가 어느 쪽인가 ──────────────────────────────────────────────────
  // 계단은 `-ML/2` 에서 시작해 `+ML/2` 로 내려간다. 그러니 사람이 들어오는
  // 곳은 **-쪽 끝**이고, 캐노피와 간판도 거기 붙는다.
  const ent = alongX ? 'nx' : 'nz';

  // 난간 — 구멍 둘레. 없으면 사람이 빠진다 (그리고 구멍으로 안 읽힌다)
  //
  // ── 입구까지 막고 있었다 (사용자 지적) ─────────────────────────────────
  // *"지하상가인데 왜 출입구가 막혀있는건지?"*
  //
  // `SIDES` 네 변을 다 둘렀다. 계단은 멀쩡히 내려가는데 그 앞을 난간이
  // 가로막고 있었으니, 들어갈 수 없는 지하상가였다. 난간은 **빠지지 말라고**
  // 있는 것이지 못 들어가게 하려고 있는 것이 아니다.
  for (const side of SIDES) {
    if (side === ent) continue; // 여기가 문이다
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
  // ── 간판탑 (사용자 지적) ─────────────────────────────────────────────────
  //
  // "지하상가(얘는 어딨는지도 모르겠고)"
  //
  // 당연하다. 이 유형의 제일 높은 곳이 **3.9m** 였다. 주위 적층 상가가
  // 10~20m 니까 두 블록만 떨어져도 안 보인다. 개수를 세면 20채인데
  // 화면에서는 0채인 것과 같다.
  //
  // 실제 지하상가 입구에는 **탑**이 선다. 지하가 안 보이니까 지상에
  // 표시를 세우는 것이고, 그 탑에 층별 안내가 붙는다. 형태가 기능에서
  // 바로 나오는 경우다.
  const MAST = 11 + hash2(Math.round(r.x0), Math.round(r.z0) + 71) * 11; // 11~22m
  const mx = alongX ? c.x + ML * 0.5 + 1.6 : c.x;
  const mz = alongX ? c.z : c.z + ML * 0.5 + 1.6;
  b.box(1.3, MAST, 1.3, [mx, Y + MAST / 2, mz], mats.frameMat);
  // 층별 안내판 — 아래에서 위로. 이것이 "지하가 여러 층" 을 말한다
  let my = Y + 2.4;
  let mk = 0;
  while (my + 1.5 < Y + MAST - 0.6) {
    const hh = hash2(Math.round(r.x0) + mk * 23, Math.round(r.z0) + mk * 7);
    const HUES = [NEON.cyan, NEON.amber, NEON.magenta, NEON.green];
    for (const side of [-1, 1]) {
      b.box(alongX ? 0.12 : 2.4, 1.2, alongX ? 2.4 : 0.12,
        [mx + (alongX ? side * 0.72 : 0), my + 0.6, mz + (alongX ? 0 : side * 0.72)],
        hh < 0.84 ? neonSoft(HUES[Math.floor(hh * 613) % HUES.length]) : mats.shutterMat);
    }
    my += 1.65;
    mk++;
  }
  // 꼭대기 등 — 멀리서 보이는 것은 결국 이것 하나다
  b.sphere(0.4, [mx, Y + MAST + 0.5, mz], neon(NEON.amber));
  pools.push({ kind: 'floor', x: mx, y: Y + 0.05, z: mz, rx: 5.0, rz: 5.0, tint: rgb01(NEON.amber, 0.4) });

  tally('지하상가', r, Y + MAST + 0.9);
  return { top: Y + MAST + 0.9 };
}

// ── 어느 번화가인가 (사용자 지시) ──────────────────────────────────────────
//
// "안쪽으로 있는 번화가는 명품관, 시장 등이 존재하도록 하고,
//  북쪽(어두운 건물들 밀집된 부분)을 향하는 번화가는 유흥가랑 지하상가,
//  암거래 시장 이런걸로"
// "명품관은 기업쪽에 가깝게, 암시장같은 건 기업에서 멀게"
//
// 자리가 성격을 정한다. 그래야 "저쪽으로 가면 무엇이 있다" 가 성립하고,
// 그게 탐험할 이유다.
//
// 축이 둘이다.
//   1) 어느 덩어리인가   안쪽(ix<6) 이냐 북쪽(ix>=6) 이냐
//   2) 기업에서 얼마나 먼가   돈이 어디서 오는지가 상권을 정한다.
//      기업에 붙은 쪽은 임대료가 비싸고 멀어질수록 싸진다
//
// district.PLAN 에서 기업은 ix 6~11 · iz 0~4 다.
const NORTH_FROM_IX = 6;
const CORPO = { ix0: 6, ix1: 11, iz0: 0, iz1: 4 };

export function marketSideOf(ix) {
  return ix >= NORTH_FROM_IX ? 'north' : 'inner';
}

// 기업 사각형까지의 격자 거리 (0 이면 맞닿아 있다).
export function corpoDistance(ix, iz) {
  const dx = Math.max(CORPO.ix0 - ix, 0, ix - CORPO.ix1);
  const dz = Math.max(CORPO.iz0 - iz, 0, iz - CORPO.iz1);
  return Math.hypot(dx, dz);
}

// ── 유형이 필지를 고른다 ───────────────────────────────────────────────────
//
// ── 왜 다시 만들었나 (사용자 지적) ────────────────────────────────────────
// "얘네들의 건물이 전혀 특색들이 없어서 구분이 전혀 안가는데?
//  건물의 특색은 대체 어디간건지"
//
// 실측이 답을 줬다. 다섯 유형의 **평균 폭이 전부 25~27m** 였다.
//
//   유흥가 26m · 명품관 25m · 시장 27m · 암거래 27m · 지하상가 25m
//
// 필지를 목표 32m 로 균등하게 자른 뒤 그 안을 채웠으니 당연하다.
// 유형이 바꾼 것은 **똑같은 상자 안의 내용물**뿐이었고, 그래서 멀리서 보면
// 같은 크기 덩어리가 격자로 늘어선 것이다. "형태가 갈린다" 고 했던 것은
// 내용물이 갈린 것이지 형태가 갈린 것이 아니었다.
//
// 그리고 낮은 유형(지하상가 4.1m · 암거래 4.8m)은 주변 적층 상가(10~20m)에
// 가려 **어디 있는지도 안 보였다.**
//
// 그래서 순서를 뒤집는다. **유형이 먼저 정해지고 필지가 거기 맞춰 잘린다.**
//
//   시장 아케이드  50~76m  관통하는 홀이라 길어야 한다
//   지하상가       34~48m  광장이라 넓어야 하고, 넓어야 하늘이 보인다
//   명품관         26~34m  마당을 두고 물러선다
//   적층상가       20~30m  기준
//   유흥가         13~19m  좁고 높다. 신주쿠의 그 형태
//   암거래         16~26m  판잣집 여러 칸이 들어갈 만큼. **한 채가 아니다**
//
// 암거래만 나중에 넓혔다. 10~15m 로는 칸이 한 줄밖에 안 들어가 결국 통로
// 하나가 되고, 그러면 시장 아케이드를 어둡게 칠한 것과 같아진다
// (blackMarket 머리말 — 사용자 재지적).
//
// 폭이 5배 차이 나면 멀리서도 다르다. 그리고 띠를 **조각의 긴 축을 따라**
// 늘어놓으므로 모든 유형이 긴 변으로 길이나 보행로를 마주 본다 —
// 4m 짜리도 안 가려진다.
const BAND = {
  arcade:    [50, 76],
  underpass: [34, 48],
  vitrine:   [26, 34],
  bazaar:    [20, 30],
  nightlife: [13, 19],
  black:     [16, 26],
};

// 그 자리에 무엇이 어울리나. 가중치를 주고 뽑는다.
//
// near 는 기업까지의 거리다 (0 = 맞닿음). 사용자 지시대로
// **명품관은 가까이, 암거래는 멀리** 간다.
function weights(side, near) {
  const close = Math.max(0, 1 - near / 4); // 1 = 기업 코앞, 0 = 멀다
  if (side === 'inner') {
    // ── 안쪽에는 셋이 **아예 안 나온다** (사용자 재지적) ──────────────────
    // *"지하상가 관련은 모두 북쪽 번화가로 옮기라고 말했고"*
    // *"3도 마찬가지로 북쪽 번화가로 옮기라고 했는데"*
    //
    // 위 지시를 처음 옮길 때 유흥가 0.06 · 암거래 0.04 · 지하상가 0.10 으로
    // **낮은 확률**을 줬다. "북쪽 위주" 로 읽은 것인데, 지시는 위주가 아니라
    // **어느 쪽인가**였다. 확률이 낮아도 32칸을 돌리면 결국 안쪽에 선다.
    //
    // 자리가 성격을 정한다는 것이 이 표의 요점이므로, 성격이 섞이면 표가
    // 하는 일이 없다. 0 으로 둔다.
    return {
      bazaar: 1.0,
      arcade: 0.42,
      vitrine: 0.10 + close * 0.55, // 기업에 붙을수록 명품관
      nightlife: 0,
      black: 0,
      underpass: 0,
    };
  }
  return {
    bazaar: 1.0,
    nightlife: 0.34,
    underpass: 0.26,
    black: 0.10 + (1 - close) * 0.55, // 기업에서 멀수록 암거래
    vitrine: 0.04 + close * 0.22,
    arcade: 0.12,
  };
}

function pick(rng, w, room) {
  // 가중치 0 은 **후보에서 뺀다.** 안 빼면 마지막 폴백(`ok[ok.length-1]`)이
  // 그것을 돌려줄 수 있다 — 실제로 키 순서상 마지막이 지하상가라, 안쪽 번화가에
  // 가중치를 0 으로 줘도 폴백으로 계속 서고 있었다.
  const ok = Object.keys(w).filter((k) => w[k] > 0 && BAND[k][0] <= room);
  if (!ok.length) return 'bazaar';
  let sum = 0;
  for (const k of ok) sum += w[k];
  let t = rng.range(0, sum);
  for (const k of ok) {
    t -= w[k];
    if (t <= 0) return k;
  }
  return ok[ok.length - 1];
}

// 조각 하나를 긴 축을 따라 띠로 나눈다. 각 띠가 유형 하나다.
// 번화가 골목 — 띠 사이를 벌린다.
//
// **번화가에 가장 필요하다.** 적층 상가가 붙어 서면 그 사이 틈이 곧 뒷골목이고,
// 3기의 밀도가 만든 자리라는 것이 city.md 의 설정이기도 하다.
// 벽은 안 세운다 — 양옆 띠의 건물 옆면이 이미 벽이다 (layout.splitToTarget 머리말).
const MKT_ALLEY = 0.34;
const MKT_GAP = [3.2, 4.8];

function planSlab(rng, slab, side, near, out, alleys) {
  const w = slab.x1 - slab.x0;
  const d = slab.z1 - slab.z0;
  const alongX = w >= d;
  const len = alongX ? w : d;
  const dep = alongX ? d : w;
  if (dep < 11 || len < 11) return;

  // 너무 깊으면 한 번 접는다 — 안 그러면 안쪽이 길을 못 만난다
  if (dep > 52) {
    const m = alongX ? (slab.z0 + slab.z1) / 2 : (slab.x0 + slab.x1) / 2;
    const a = alongX ? { ...slab, z1: m } : { ...slab, x1: m };
    const b = alongX ? { ...slab, z0: m } : { ...slab, x0: m };
    planSlab(rng, a, side, near, out, alleys);
    planSlab(rng, b, side, near, out, alleys);
    return;
  }

  const W = weights(side, near);
  let t = 0;
  while (len - t > 9) {
    const room = len - t;
    const kind = pick(rng, W, room);
    const [lo, hi] = BAND[kind];
    // 남은 자리가 어중간하면 그 띠가 다 먹는다 — 9m 짜리 자투리를 남기면
    // 거기 아무것도 못 선다
    const want = rng.range(lo, Math.min(hi, room));
    const take = room - want < lo * 0.8 ? room : want;
    // 앞 띠와 사이를 벌릴까 — 그 틈이 골목이다.
    // **암거래 옆은 늘 벌린다.** 틈에 낀 것처럼 보여야 암거래다.
    const gapNow = t > 0 && (kind === 'black' || rng.chance(MKT_ALLEY))
      ? rng.range(MKT_GAP[0], MKT_GAP[1]) : 0;
    const a0 = (alongX ? slab.x0 : slab.z0) + t + gapNow;
    const a1 = a0 + take - gapNow;
    if (a1 - a0 < 9) { t += take; continue; }
    if (gapNow) {
      alleys.push({
        alongX: !alongX, // 띠를 가르는 틈이라 축이 반대다
        w: gapNow,
        rect: alongX
          ? { x0: a0 - gapNow, x1: a0, z0: slab.z0, z1: slab.z1 }
          : { x0: slab.x0, x1: slab.x1, z0: a0 - gapNow, z1: a0 },
      });
    }
    out.push({
      kind: kind === 'bazaar' ? null : kind,
      rect: alongX
        ? { x0: a0, x1: a1, z0: slab.z0, z1: slab.z1 }
        : { x0: slab.x0, x1: slab.x1, z0: a0, z1: a1 },
    });
    t += take;
  }
}

// 번화가 대지 하나의 필지 계획. towers.js 가 이걸로 blockLots 를 대신한다.
export function marketPlan(rng, blk, D) {
  const side = marketSideOf(blk.ix);
  const near = corpoDistance(blk.ix, blk.iz);
  const out = [];
  const alleys = [];
  for (const slab of buildableSlabs(blk, D)) planSlab(rng, slab, side, near, out, alleys);
  return { lots: out, alleys };
}

export function marketBlock(b, kind, r, rng, mats, signs, pools) {
  if (kind === 'arcade') return arcade(b, r, rng, mats, signs, pools);
  if (kind === 'vitrine') return vitrine(b, r, rng, mats, signs, pools) || null;
  if (kind === 'nightlife') return nightlife(b, r, rng, mats, signs, pools);
  if (kind === 'black') return blackMarket(b, r, rng, mats, signs, pools);
  if (kind === 'underpass') return underpass(b, r, rng, mats, signs, pools);
  return null;
}
