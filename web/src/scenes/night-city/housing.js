// 주거 단지 — 주거 구역의 건물.
//
// ── 이 건물이 왜 이렇게 생겼는가 (docs/scenes/night-city/city.md 1기) ───────
// 공장 노동자를 살게 하려고 **빨리, 똑같이** 지은 집이다. 도시가 공장을 위해
// 만들어졌으므로 주거는 목적이 아니라 필요조건이었다. 그래서 형태가 이렇다.
//
//   · 슬래브다. 탑이 아니다. 같은 평면을 옆으로 길게 반복하는 것이 가장 싸다.
//   · 편복도. 계단 하나로 한 층 전체에 접근하는 방식이 승강기 코어보다 싸다.
//     그 복도가 **건물 뒷면에 그대로 드러난다.**
//   · 창이 완벽하게 규칙적이다. 같은 집을 붙여 놓았으니 당연하다.
//   · 1층에 상가가 없다. 팔 것이 아니라 살 곳으로 지었다.
//
// ── 그런데 40년이 지났다 ───────────────────────────────────────────────────
// 이 건물의 인상은 **설계와 생활의 충돌**에서 나온다. 설계는 완벽하게
// 규칙적인데 사는 사람이 제각각이라, 그 격자 위에 불규칙이 덮인다.
//
//   빨래 · 실외기 · 화분 · 짐 · 천막 · 판자로 막은 발코니
//
// 그래서 규칙적인 격자를 **먼저** 만들고 그 위에 불규칙을 얹는다. 순서가
// 중요하다 — 처음부터 불규칙하게 만들면 그냥 지저분한 건물이지, 규칙이
// 무너진 건물로는 안 읽힌다.
//
// ── 슬래브는 대지 하나가 아니라 **단지**다 (실측으로 드러났다) ─────────────
//
// 대지 병합(#25·#43) 뒤 주거 대지가 커졌는데, 여기서는 대지 하나를 통째로
// 상자 하나로 세우고 있었다. 실측: 주거 50동, 긴변 중앙 **58.4m**, 바닥
// 중앙 **2,568m²**. 58x44 짜리 덩어리는 슬래브가 아니다. 결과가 셋이었다.
//
//   1) 옥상이 2,568m² 짜리 텅 빈 고원이 됐다 (소품 개수가 면적을 모른다)
//   2) 현관이 **동당 하나**였다. 58m x 10층이면 130세대가 문 하나를 쓴다
//   3) 편복도가 짧은 끝면에 붙었다 — 편복도는 긴 뒷면에 붙는 것이다
//
// 진짜 슬래브는 **깊이가 얕다** — 세대 하나 깊이 + 편복도 한 줄. 그래서 대지
// 하나에 얕은 동 여럿을 나란히 놓고 그 사이를 마당으로 쓴다. 판상형 단지다.
// 이렇게 하면 위 셋이 한 번에 풀리고, 눈높이에 마당이 생긴다.
import { autoBox, tubeBetween } from '../../core/profile.js';
import {
  faceFrame,
  facePlane,
  shrink,
  rectBox,
  rectCenter,
  rectSize,
} from '../../core/boxfaces.js';
import { NEON } from '../../shared/neon.js';
import { neonSoft } from '../../shared/masters.js';
import { hash2 } from '../../core/textures.js';
import { PANEL_TILE } from './layout.js';
import { entranceBay, CANOPY_D } from './shopfront.js';
import { claim, TIER } from './siteplan.js';
import { onSceneReset } from '../../core/scenestate.js';

// 주거 층고. 사무실(3.6m)보다 낮다 — 천장고를 아끼는 것이 가장 쉬운 절감이다.
//
// **주거 메가빌딩(landmark.megaBuilding)도 이 값을 쓴다.** 거기에 2.9 를 다시
// 적으면 그게 결합 오류다 — 둘은 같은 도시의 같은 시기 주거이므로 층고가
// 갈릴 이유가 없고, 갈리면 파사드 띠가 어긋난다.
export const HOME_FLOOR = 2.9;

// 세대 폭은 **동마다 다르다** (`slabStyle.unit`, 4.0~5.1m). 이 한 값이
// 파사드의 칸 수를 바꾸므로 멀리서 보면 동이 확실히 갈린다.
// 전에 여기 `UNIT_W = 4.4` 상수가 있었는데, 동별로 뽑게 바꾸면서 아무도
// 안 읽게 됐다 — 죽은 코드는 검증된 적이 없는 코드다.

// ── 동마다 조금씩 다르다 ───────────────────────────────────────────────────
//
// 사용자 지적: *"아무리 빨리, 똑같이라곤 해도 다 똑같이 생겨서 뭔가 아쉬운
// 느낌이 있네"*
//
// 맞다. **똑같이 지은 것과 40년 뒤에도 똑같은 것은 다르다.** 한날한시에 같은
// 도면으로 올렸어도 도색을 다시 한 동이 생기고, 세대를 조금 넓게 뽑은 동이
// 생기고, 발코니를 판자로 막은 집이 유난히 많은 동이 생긴다.
//
// **규칙성을 없애는 것이 아니라 규칙 위에 시간을 얹는 것이다.** 격자는 그대로
// 두고 (그게 이 건물의 정체다) 격자를 채우는 값만 동마다 흔든다.
//
// 위치 해시로 뽑는다 — 난수가 아니다. 같은 자리의 동은 늘 같은 동이어야
// 하고, 그래야 편차가 '노이즈' 가 아니라 '이 동은 이렇다' 가 된다 (규율 6).
function slabStyle(rect, mats) {
  const kx = Math.round((rect.x0 + rect.x1) / 2);
  const kz = Math.round((rect.z0 + rect.z1) / 2);
  const idx = (a, n) => Math.floor(hash2(kx * a, kz * (a + 3)) * n) % n;
  const pick = (a, list) => list[idx(a, list.length)];
  const st = {
    body: pick(7, mats.homeBodyMats),
    rail: pick(13, mats.homeRailMats),
    // 세대 폭 — 파사드 칸 수를 바꾼다. 제일 크게 읽히는 편차다
    unit: 4.0 + hash2(kx * 5, kz * 11) * 1.1,
    // 발코니를 판자로 막은 비율. 동마다 8~34% — 관리가 잘 된 동과 아닌 동
    board: 0.08 + hash2(kx * 17, kz * 23) * 0.26,
    // 옥탑 증축 — 불법이지만 흔하다. 세 동에 하나꼴
    penthouse: hash2(kx * 29, kz * 31) < 0.34,
    // 측벽 처리. 짧은 끝면은 세대가 없어 민짜인데, 그 민짜를 뭐로 쓰는지가
    // 동마다 다르다
    endWall: idx(37, 3),
  };
  // **"갈랐다" 와 "화면에 다 나온다" 는 다르다.** 해시가 고르다는 것만으로는
  // 실제 동 좌표에서 네 종이 다 뽑혔는지 모른다 — 번화가 유형에서 여섯 중
  // 둘이 한 번도 안 나온 적이 있다 (market.marketSpots 머리말).
  TALLY.body[idx(7, 4)]++;
  TALLY.rail[idx(13, 4)]++;
  TALLY.end[st.endWall]++;
  if (st.penthouse) TALLY.penthouse++;
  TALLY.n++;
  return st;
}

let TALLY = { n: 0, body: [0, 0, 0, 0], rail: [0, 0, 0, 0], end: [0, 0, 0], penthouse: 0 };
export function houseTally() {
  return { ...TALLY, body: [...TALLY.body], rail: [...TALLY.rail], end: [...TALLY.end] };
}
onSceneReset('주거 동 표본', () => {
  TALLY = { n: 0, body: [0, 0, 0, 0], rail: [0, 0, 0, 0], end: [0, 0, 0], penthouse: 0 };
});

// ── 단지 치수 ──────────────────────────────────────────────────────────────
//
// 슬래브가 차지하는 띠의 깊이. 세대 깊이 + 앞뒤로 붙는 것 전부.
// **이 값 하나가 '슬래브' 와 '덩어리' 를 가른다** — 여기를 대지 깊이로 두면
// 다시 상자가 된다.
const SLAB_D = 14.0;

// ── 벽 밖으로 나가는 것들 ──────────────────────────────────────────────────
//
// 몸통을 이만큼 안으로 들여야 **붙은 것까지가 대지 안**이다. 여기에 하나라도
// 빠지면 그만큼 옆 단지를 파고든다 — 실제로 차양을 빼먹고 1.60m 씩 나가서
// 건물 세 쌍이 2.2m 겹쳤다.
//
// **값을 여기서 새로 적지 않는다.** 그리는 쪽이 쓰는 깊이를 그대로 유도한다 —
// 전에는 `BALCONY_D` 를 그리는 함수 안에 두고 여기에 1.3 을 또 적었다.
// 두 곳에 있으면 한쪽만 바뀌고, 그게 바로 이 프로젝트의 1번 실패 패턴이다.
const BALCONY_D = 1.15;            // 발코니 바닥판 깊이 (balcony)
const DECK_D = 1.4;                // 편복도 깊이 (accessDeck)
const CORE_D = 2.2;                // 계단실 몸통 깊이 (stairCore)

const FRONT_OUT = BALCONY_D + 0.15;  // + 가림판 두께와 여유
const DECK_OUT = DECK_D + 0.1;       // + 난간 기둥
// 현관은 계단실 **바깥면**에 붙으므로 차양이 그 위로 또 나간다.
// 차양 깊이는 `shopfront.CANOPY_D` 가 유일한 출처다.
const BACK_OUT = CORE_D + CANOPY_D;
// 동간 거리 최소값. 이보다 좁으면 마당이 아니라 골목이고, 아래 마당 시설이
// 들어갈 자리가 없다.
const YARD_MIN = 11;
// 동간 거리 최대값. 남는 땅을 전부 마당에 주면 단지가 성글어진다.
const YARD_MAX = 26;
// 계단실 간격. 편복도 슬래브는 계단 하나가 이만큼을 담당한다.
const CORE_PITCH = 24;


// ── 발코니 한 칸 ───────────────────────────────────────────────────────────
//
// 이 건물의 전부다. 세대마다 하나씩, 층마다 하나씩. 격자 자체는 완벽하게
// 규칙적이고 **안에 든 것만 제각각**이다.
function balcony(b, f, u, y, rng, mats, detail, st) {
  const D = BALCONY_D;
  const UW = st.unit;
  const [cx, cz] = f.at(u, D / 2);
  const [sw, sd] = f.size(UW * 0.86, D);

  // 바닥판
  b.box(sw, 0.16, sd, [cx, y, cz], mats.panelMat);
  // 앞 가림판 — 난간이 아니라 판이다. 싸게 짓는 방식이고, 그래서 안이 안 보인다.
  const [px, pz] = f.at(u, D);
  const [pw, pd] = f.size(UW * 0.86, 0.1);
  b.box(pw, 1.05, pd, [px, y + 0.54, pz], st.rail);

  // ── 여기부터가 생활 ──────────────────────────────────────────────────────
  // 넷 중 하나가 얹힌다. 확률이 다른 이유는 실제로 그렇기 때문이다 —
  // 실외기는 거의 모든 집에 있고, 판자로 막은 집은 드물다.
  //
  // **판자 비율만 동마다 다르다** (`slabStyle.board`). 관리가 잘 된 동과 아닌
  // 동의 차이가 이것 하나로 파사드 전체에서 읽힌다.
  const pick = rng.next();
  if (pick > 1 - st.board) {
    // 판자로 막았다 — 발코니를 방으로 쓴다. 인상이 가장 강하다.
    const [wx, wz] = f.at(u, D * 0.92);
    const [ww, wd] = f.size(UW * 0.84, 0.08);
    b.box(ww, HOME_FLOOR - 0.3, wd, [wx, y + (HOME_FLOOR - 0.3) / 2, wz], mats.shutterMat);
    if (rng.chance(0.6)) {
      b.box(ww * 0.34, 0.5, wd, [wx, y + 1.5, wz], neonSoft(NEON.warm));
    }
  } else if (pick < 0.42) {
    // 실외기 — 가장 흔하다
    const [ax, az] = f.at(u + rng.range(-1.0, 1.0), D * 0.55);
    const [aw, ad] = f.size(rng.range(0.6, 0.85), 0.55);
    b.box(aw, 0.6, ad, [ax, y + 0.38, az], mats.ductMat);
  } else if (pick < 0.66 && detail > 0.5) {
    // 빨래 — 줄과 옷가지. 근경에서만 만든다.
    const [lx, lz] = f.at(u - UW * 0.34, D * 0.8);
    const [ex, ez] = f.at(u + UW * 0.34, D * 0.8);
    b.add(tubeBetween([lx, y + 1.5, lz], [ex, y + 1.45, ez], 0.018, 4), mats.cableMat);
    const n = rng.int(2, 4);
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n - 0.5;
      const [wx, wz] = f.at(u + UW * 0.68 * t, D * 0.8);
      const [ww, wd] = f.size(rng.range(0.3, 0.5), 0.03);
      b.box(ww, rng.range(0.4, 0.75), wd, [wx, y + 1.15, wz], mats.laundryMats[rng.int(0, mats.laundryMats.length - 1)]);
    }
  } else {
    // 짐 — 상자와 잡동사니
    for (let i = 0; i < rng.int(1, 3); i++) {
      const [bx, bz] = f.at(u + rng.range(-1.2, 1.2), D * rng.range(0.35, 0.7));
      const [bw, bd] = f.size(rng.range(0.4, 0.7), rng.range(0.35, 0.5));
      b.box(bw, rng.range(0.3, 0.55), bd, [bx, y + 0.3, bz], rng.chance(0.5) ? mats.crateMat : mats.ductMat);
    }
  }

  // 창 — 발코니 안쪽. 켜진 집과 꺼진 집.
  const [gx, gz] = f.at(u, 0.06);
  const [gw, gd] = f.size(UW * 0.6, 0.08);
  if (rng.chance(0.44)) {
    b.add(autoBox(gw, 1.3, gd, [gx, y + 1.1, gz], 0.02), mats.homeLitMat);
  } else {
    b.box(gw, 1.3, gd, [gx, y + 1.1, gz], mats.homeDarkMat);
  }
}

// ── 편복도 ─────────────────────────────────────────────────────────────────
//
// 건물 뒷면에 그대로 드러난 복도. 계단 하나로 한 층 전체에 접근하는 방식이라
// 승강기 코어보다 싸다. **가난하게 지었다는 증거**이고, 동시에 이 건물의
// 수직 동선이 밖에 있다는 뜻이다.
//
// 전에는 이게 **짧은 끝면**에 붙었다. `frontSides` 를 긴 면 둘로 잡으니
// 남는 것이 끝면뿐이었기 때문이다. 편복도는 세대 전부를 지나가야 하므로
// 긴 뒷면에 붙는 것이 맞다 — 지금은 단지가 앞뒤를 직접 정해서 넘긴다.
function accessDeck(b, f, y, rng, mats) {
  const D = DECK_D;
  const [cx, cz] = f.at(0, D / 2);
  const [sw, sd] = f.size(f.w, D);
  b.box(sw, 0.16, sd, [cx, y, cz], mats.grateMat);

  // 난간 — 가로대 둘
  const [rx, rz] = f.at(0, D);
  for (const hy of [0.5, 1.0]) {
    const [bw, bd] = f.size(f.w, 0.05);
    b.box(bw, 0.05, bd, [rx, y + hy, rz], mats.pipeMat);
  }
  const posts = Math.max(2, Math.round(f.w / 2.4));
  for (let i = 0; i <= posts; i++) {
    const [ax, az] = f.at(-f.w / 2 + (f.w * i) / posts, D);
    b.box(0.05, 1.0, 0.05, [ax, y + 0.5, az], mats.pipeMat);
  }
  // 복도등 — 몇 칸 걸러 하나. 형광등이라 차갑다.
  for (let i = 0; i < Math.max(1, Math.round(f.w / 9)); i++) {
    const [lx, lz] = f.at(-f.w / 2 + f.w * ((i + 0.5) / Math.max(1, Math.round(f.w / 9))), D * 0.5);
    const [lw, ld] = f.size(0.7, 0.12);
    b.box(lw, 0.1, ld, [lx, y + HOME_FLOOR - 0.35, lz], neonSoft(0xc8d4e0));
  }
}

// ── 계단실 ─────────────────────────────────────────────────────────────────
//
// 편복도의 짝이다. 복도가 수평 동선이면 계단실은 수직 동선이고, 24m 마다
// 하나씩 서서 **그 아래가 현관**이 된다.
//
// 이게 없을 때 두 가지가 동시에 틀렸다. 130세대가 문 하나를 쓰고 있었고,
// 58m 짜리 파사드에 리듬이 없었다. 계단실 하나가 둘 다 답한다 —
// 벽에서 튀어나온 수직 덩어리라 멀리서도 슬래브가 몇 칸인지 세어진다.
function stairCore(b, f, u, top, rng, mats, floors) {
  const W = 3.4;
  const D = CORE_D;

  // 몸통 — 복도 쪽으로 튀어나온다. 편복도(1.4m)보다 깊어야 복도를 **끊는다**.
  const [cx, cz] = f.at(u, D / 2);
  const [cw, cd] = f.size(W, D);
  const rect = { x0: cx - cw / 2, x1: cx + cw / 2, z0: cz - cd / 2, z1: cz + cd / 2 };
  b.add(rectBox(rect, 0, top + 1.4, PANEL_TILE), mats.panelMat);

  // 층참 창 — 층마다 하나. 계단실은 늘 켜져 있다 (공용부라 아무도 안 끈다)
  const [gx, gz] = f.at(u, D + 0.02);
  const [gw, gd] = f.size(W * 0.34, 0.06);
  for (let fl = 0; fl < floors; fl++) {
    b.add(autoBox(gw, 1.0, gd, [gx, fl * HOME_FLOOR + 1.5, gz], 0.02), mats.homeLitMat);
  }

  // 옥탑 — 계단이 옥상으로 나가는 문. 지붕에 튀어나온 작은 상자
  const [tx, tz] = f.at(u, D / 2);
  const [tw, td] = f.size(W * 0.8, D * 0.9);
  b.box(tw, 1.1, td, [tx, top + 1.95, tz], mats.panelMat);
  if (rng.chance(0.5)) {
    const [aw, ad] = f.size(0.06, 0.06);
    const h = rng.range(1.4, 2.6);
    b.box(aw, h, ad, [tx, top + 2.5 + h / 2, tz], mats.pipeMat);
  }
  // 현관은 벽면이 아니라 **이 상자의 바깥면**에 붙어야 한다. 벽면에 붙이면
  // 계단실이 2.2m 튀어나와 있으니 문이 그 안에 파묻힌다.
  return rect;
}

// ── 옥상 ───────────────────────────────────────────────────────────────────
//
// 물탱크와 안테나 숲. 세대마다 접시를 따로 달았기 때문에 지저분하다 —
// 한 번에 설계했으면 하나로 충분했을 것이다. 여기도 설계와 생활의 충돌이다.
//
// **개수는 면적에서 나온다.** 전에는 물탱크 2~4개 · 안테나 6~14개로 고정이라,
// 2,568m² 옥상에 안테나 열 개가 놓였다 — 250m² 당 하나꼴이라 텅 비어 보였다.
// 어제 기업 쇼케이스를 `min(3, …)` 으로 고정했다가 똑같이 틀렸다.
// **개수를 쓰고 싶으면 먼저 밀도를 쓴다.**
function roofClutter(b, r, top, rng, mats, st) {
  const c = rectCenter(r);
  const s = rectSize(r);
  const area = s.w * s.d;

  // 옥탑 증축 — 불법이지만 흔하다. 세 동에 하나꼴로 있고, **있는 동과 없는
  // 동의 실루엣이 갈린다.** 옥상은 멀리서 스카이라인으로 읽히는 면이다.
  if (st.penthouse) {
    const pw = Math.min(s.w * 0.42, 13), pd = Math.min(s.d * 0.62, 7.5);
    const px = c.x + (s.w >= s.d ? s.w * 0.18 : 0);
    const pz = c.z + (s.w >= s.d ? 0 : s.d * 0.18);
    const ph = 2.6;
    b.box(pw, ph, pd, [px, top + ph / 2, pz], st.body);
    // 지붕은 골강판이다 — 본채와 다른 재료라는 것이 곧 나중에 얹은 증거다
    b.box(pw + 0.6, 0.12, pd + 0.6, [px, top + ph + 0.06, pz], mats.shutterMat);
    // 창 하나. 사람이 산다
    const gw = Math.min(pw * 0.3, 2.2);
    b.box(s.w >= s.d ? gw : 0.08, 1.0, s.w >= s.d ? 0.08 : gw,
      [px + (s.w >= s.d ? 0 : pd / 2), top + 1.5, pz + (s.w >= s.d ? pd / 2 : 0)],
      rng.chance(0.6) ? mats.homeLitMat : mats.homeDarkMat);
  }

  // 물탱크 — 약 340m² 당 하나. 슬래브 하나(약 730m²)에 둘.
  const tanks = Math.max(1, Math.min(8, Math.round(area / 340)));
  for (let i = 0; i < tanks; i++) {
    const x = c.x + rng.range(-s.w * 0.36, s.w * 0.36);
    const z = c.z + rng.range(-s.d * 0.3, s.d * 0.3);
    const h = rng.range(1.6, 2.4);
    b.cylinder(1.1, 1.1, h, [x, top + h / 2 + 0.6, z], mats.rustMat, 10);
    for (const su of [-0.7, 0.7]) {
      b.box(0.12, 0.6, 0.12, [x + su, top + 0.3, z], mats.metalMat);
      b.box(0.12, 0.6, 0.12, [x, top + 0.3, z + su], mats.metalMat);
    }
  }
  // 안테나 숲 — 세대 수만큼 있는 것이 요점이다. 약 70m² 당 하나.
  const n = Math.max(4, Math.min(40, Math.round(area / 70)));
  for (let i = 0; i < n; i++) {
    const x = c.x + rng.range(-s.w * 0.44, s.w * 0.44);
    const z = c.z + rng.range(-s.d * 0.38, s.d * 0.38);
    const h = rng.range(1.2, 2.6);
    b.box(0.05, h, 0.05, [x, top + h / 2, z], mats.pipeMat);
    if (rng.chance(0.5)) b.cylinder(0.34, 0.34, 0.07, [x, top + h, z], mats.metalMat, 8);
  }
  // 옥상 빨래줄 — 긴 축을 가로지른다. 슬래브가 길수록 여러 줄.
  const lines = Math.max(1, Math.round(s.w / 26));
  for (let i = 0; i < lines; i++) {
    if (!rng.chance(0.7)) continue;
    const x = c.x - s.w * 0.3 + (s.w * 0.6 * (i + 0.5)) / lines;
    b.add(tubeBetween(
      [x, top + 1.5, c.z - s.d * 0.32],
      [x, top + 1.4, c.z + s.d * 0.32], 0.02, 4
    ), mats.cableMat);
  }
  // 난간
  b.add(rectBox(shrink(r, 0.15), top, 0.9, PANEL_TILE), mats.pipeMat);
}

// ── 한 동 ──────────────────────────────────────────────────────────────────
//
// 앞뒤를 **단지가 정해서 넘긴다.** 판상형 단지는 전 동이 같은 방향을 본다 —
// 한쪽에서 보면 발코니만, 반대쪽에서 보면 복도만 보인다. 동마다 따로 뽑으면
// 그 인상이 사라지고 그냥 섞인 건물 여럿이 된다.
function slabBody(b, r, front, back, floors, rng, mats, detail, pools, slim = false) {
  const top = floors * HOME_FLOOR;
  const st = slabStyle(r, mats);
  // 몸통 색이 동마다 다르다 — 도색을 다시 한 동, 타일을 붙인 동, 손 안 댄 동
  b.add(rectBox(r, 0, top, PANEL_TILE), st.body);

  // 앞면 — 발코니 격자. 이 건물의 전부다.
  const ff = faceFrame(r, front);
  const units = Math.max(2, Math.floor(ff.w / st.unit));
  const uw = ff.w / units;
  for (let fl = 0; fl < floors; fl++) {
    for (let i = 0; i < units; i++) {
      balcony(b, ff, -ff.w / 2 + uw * (i + 0.5), fl * HOME_FLOOR, rng, mats, detail, st);
    }
  }

  // 뒷면 — 편복도. 층마다 한 줄.
  const bf = faceFrame(r, back);
  for (let fl = 0; fl < floors; fl++) accessDeck(b, bf, fl * HOME_FLOOR, rng, mats);

  // 짧은 끝면 — 세대가 없어 민짜다. 그 민짜를 **뭐로 쓰는지가 동마다 다르다.**
  endWall(b, r, front, back, top, floors, st, mats);

  // ── 계단실과 현관 ────────────────────────────────────────────────────────
  // 복도 쪽에 24m 간격. 그 아래가 현관이다.
  const cores = Math.max(1, Math.round(bf.w / CORE_PITCH));
  for (let i = 0; i < cores; i++) {
    const u = -bf.w / 2 + (bf.w / cores) * (i + 0.5);
    // 얕은 대지는 계단실을 뺀다 — 튀어나올 자리가 없다. 현관은 벽면에 붙는다.
    const HALF = 1.7;
    const [ex0, ez0] = bf.at(u, 0);
    const crect = slim
      ? (back === 'px' || back === 'nx'
        ? { ...r, z0: ez0 - HALF, z1: ez0 + HALF }
        : { ...r, x0: ex0 - HALF, x1: ex0 + HALF })
      : stairCore(b, bf, u, top, rng, mats, floors);

    // 현관 — 도시 전체가 쓰는 entranceBay. recess=false 인 이유는 주거
    // 슬래브에 1층 벽감이 없기 때문이다 (shopfront.entranceBay 머리말).
    const e = entranceBay(b, crect, back, 0, rng, mats, false, false);
    // 진입 동선 — 가로등·자판기가 현관 앞을 막으면 안 된다
    claim(e.x, e.z, e.w * 0.7 + 1.2, TIER.ACCESS, 'homeEntrance');
    pools.push({
      kind: 'floor', x: e.x, y: 0.21, z: e.z,
      rx: 3.4, rz: 3.4, tint: [0.32, 0.36, 0.42],
    });
  }

  roofClutter(b, r, top, rng, mats, st);
  return top;
}

// ── 측벽 ───────────────────────────────────────────────────────────────────
//
// 슬래브의 짧은 끝면. 세대가 없어 창도 발코니도 없는 **민짜 벽**이고, 높이가
// 30~40m 나 되므로 도시에서 제일 큰 빈 면이다. 지금까지 여기가 진짜로 비어
// 있어서, 단지를 옆에서 보면 잿빛 판이 늘어선 것으로 보였다.
//
// 실제로는 그 벽을 다들 뭔가에 쓴다. 셋으로 갈랐다 — 어느 것인지는 위치
// 해시가 정한다 (`slabStyle.endWall`).
function endWall(b, r, front, back, top, floors, st, mats) {
  const ends = (front === 'pz' || front === 'nz') ? ['px', 'nx'] : ['pz', 'nz'];
  for (const side of ends) {
    const f = faceFrame(r, side);
    if (f.w < 4) continue;

    if (st.endWall === 0) {
      // 0) 배관 — 오수관과 우수관이 벽을 타고 내려온다. 층마다 이음쇠.
      for (const t of [-0.26, 0.3]) {
        const [px, pz] = f.at(f.w * t, 0.18);
        b.cylinder(0.16, 0.16, top, [px, top / 2, pz], mats.pipeMat, 6);
        for (let fl = 1; fl < floors; fl++) {
          const [jw, jd] = f.size(0.42, 0.42);
          b.box(jw, 0.24, jd, [px, fl * HOME_FLOOR, pz], mats.metalMat);
        }
      }
      // 벽걸이 실외기 몇 줄 — 세대가 없는 벽이라 여기로 뽑았다
      for (let fl = 2; fl < floors; fl += 3) {
        const [ax, az] = f.at(f.w * 0.06, 0.42);
        const [aw, ad] = f.size(0.8, 0.62);
        b.box(aw, 0.66, ad, [ax, fl * HOME_FLOOR + 1.2, az], mats.ductMat);
      }
    } else if (st.endWall === 1) {
      // 1) 외부 비상계단 — 지그재그로 오르는 철제 계단. 실루엣이 가장 강하다.
      const D = 1.5;
      for (let fl = 1; fl <= floors; fl++) {
        const y = fl * HOME_FLOOR;
        const [lx, lz] = f.at(0, D / 2);
        const [lw, ld] = f.size(Math.min(f.w * 0.72, 5.0), D);
        b.box(lw, 0.12, ld, [lx, y, lz], mats.grateMat);       // 참
        const [rx, rz] = f.at(0, D);
        const [rw, rd] = f.size(Math.min(f.w * 0.72, 5.0), 0.05);
        b.box(rw, 0.05, rd, [rx, y + 0.95, rz], mats.pipeMat); // 난간
      }
      for (const sg of [-1, 1]) {
        const [cx2, cz2] = f.at(sg * Math.min(f.w * 0.34, 2.4), D);
        b.cylinder(0.07, 0.07, top, [cx2, top / 2, cz2], mats.pipeMat, 6);
      }
    } else {
      // 2) 도장 — 벽 하나를 통째로 칠했다. 관리사무소가 동 번호를 크게 쓰는
      //    자리이기도 하다. 여기서는 색 면 + 위아래 띠로만 암시한다.
      b.add(facePlane(r, top * 0.16, top * 0.62, side, null, 0.06), st.rail);
      for (const y of [top * 0.16, top * 0.78]) {
        b.add(facePlane(shrink(r, -0.1), y, 0.4, side, null, 0.08), mats.frameMat);
      }
      // 환기 그릴 — 칠한 벽에도 이건 남는다
      for (let fl = 1; fl < floors; fl += 2) {
        const [gx, gz] = f.at(f.w * 0.3, 0.16);
        const [gw, gd] = f.size(0.7, 0.12);
        b.box(gw, 0.5, gd, [gx, fl * HOME_FLOOR + 1.6, gz], mats.grateMat);
      }
    }
  }
}

// ── 마당 ───────────────────────────────────────────────────────────────────
//
// 동과 동 사이. 여기가 비어 있으면 눈높이에 아무것도 없다 — 어제 기업
// 기단에서 고친 것과 같은 문제이고, 주거는 그것보다 심했다. 실측상 주거
// 구역 눈높이 화면이 거의 새까맸다.
//
// 다만 여기는 상업이 아니라서 **불이 적어야** 한다. 구역 설명이 그렇다:
// "창은 많이 켜져 있지만 거리는 어둡다". 그래서 밝히는 것은 마당등 하나뿐이고
// 나머지는 그 빛에 드러나는 실루엣이다.
function estateYard(b, rect, alongX, rng, mats, pools) {
  const c = rectCenter(rect);
  const s = rectSize(rect);
  const len = alongX ? s.w : s.d;   // 마당이 길게 뻗는 방향
  const wid = alongX ? s.d : s.w;
  if (len < 8 || wid < 5) return;

  // 좌표 도우미 — 마당 축(t, -0.5~0.5)과 폭 방향(v, -0.5~0.5)
  const at = (t, v) => (alongX
    ? [c.x + t * len, c.z + v * wid]
    : [c.x + v * wid, c.z + t * len]);

  // 포장 — 단지 안은 도로가 아니라 주차장 겸 마당이다.
  // y 는 0 보다 위여야 한다. 지면 평면이 3000m 짜리라 아래로 파면 안 보인다.
  b.box(alongX ? len : wid, 0.06, alongX ? wid : len, [c.x, 0.05, c.z], mats.lotMat);

  // ── 마당등 ───────────────────────────────────────────────────────────────
  // 이 하나가 마당을 보이게 만든다. 노란빛 3000K — 구역 가로등과 같은 색.
  // 마당 폭을 가로지르는 자리 배치. 한 줄에 몰면 서로 뚫는다.
  //   -0.44 전봇대 · -0.28 집하장 · -0.16 자전거 · -0.06 평상
  //    0.06 마당등(통행로) ·  0.34 주차
  const lamps = Math.max(1, Math.round(len / 22));
  for (let i = 0; i < lamps; i++) {
    const [lx, lz] = at((i + 0.5) / lamps - 0.5, 0.06);
    b.cylinder(0.07, 0.09, 4.2, [lx, 2.1, lz], mats.pipeMat, 6);
    b.box(0.5, 0.16, 0.5, [lx, 4.3, lz], neonSoft(0xffd28a));
    claim(lx, lz, 1.0, TIER.ACCESS, 'yardLamp');
    pools.push({ kind: 'floor', x: lx, y: 0.22, z: lz, rx: 6.5, rz: 6.5, tint: [0.42, 0.34, 0.2] });
  }

  // ── 전봇대와 변압기 ──────────────────────────────────────────────────────
  // 1기 인프라. 땅에 묻을 돈이 없어 전선을 공중에 걸었고, 그게 40년째 있다.
  // 동과 동을 잇는 케이블이 마당 위를 지나가는 것이 이 구역의 천장이다.
  const poleN = Math.max(2, Math.round(len / 30));
  const poles = [];
  for (let i = 0; i <= poleN; i++) {
    const [px, pz] = at(i / poleN - 0.5, -0.44);
    const h = rng.range(7.5, 9.0);
    b.cylinder(0.13, 0.17, h, [px, h / 2, pz], mats.pipeMat, 6);
    // 완철 — 가로로 뻗은 팔. 이게 있어야 전봇대로 읽힌다
    const arm = 1.5;
    b.box(alongX ? 0.09 : arm, 0.09, alongX ? arm : 0.09, [px, h - 0.5, pz], mats.metalMat);
    poles.push([px, h - 0.5, pz]);
    claim(px, pz, 0.8, TIER.ACCESS, 'utilityPole');
    // 변압기 — 두 대 걸러 하나. 원통을 기둥에 매단다
    if (i % 2 === 1) {
      b.cylinder(0.36, 0.36, 1.1, [px + 0.42, h - 1.9, pz], mats.rustMat, 8);
    }
  }
  for (let i = 1; i < poles.length; i++) {
    const a = poles[i - 1], d = poles[i];
    // 세 가닥. 처지는 것은 중간점을 낮춰 흉내낸다
    for (const off of [-0.5, 0, 0.5]) {
      const sag = 0.5;
      const m = [(a[0] + d[0]) / 2, (a[1] + d[1]) / 2 - sag, (a[2] + d[2]) / 2];
      const oa = alongX ? [a[0], a[1], a[2] + off] : [a[0] + off, a[1], a[2]];
      const od = alongX ? [d[0], d[1], d[2] + off] : [d[0] + off, d[1], d[2]];
      const om = alongX ? [m[0], m[1], m[2] + off] : [m[0] + off, m[1], m[2]];
      b.add(tubeBetween(oa, om, 0.022, 3), mats.cableMat);
      b.add(tubeBetween(om, od, 0.022, 3), mats.cableMat);
    }
  }

  // ── 주차 ─────────────────────────────────────────────────────────────────
  //
  // 마당의 대부분은 주차장이다. 차를 위해 지은 단지가 아니라 **차가 나중에
  // 들어와 마당을 먹은** 것이고, 그래서 놀이터가 아니라 주차장으로 보인다.
  //
  // 이게 없으면 마당이 그냥 빈 아스팔트다 — 눈높이에서 제일 먼저 읽히는 것이
  // 여백이 되어 버린다.
  if (wid > 9) {
    const STALL = 2.6;
    const stalls = Math.floor(len / STALL);
    for (let i = 0; i < stalls; i++) {
      // 마당 한쪽 가장자리. 반대쪽은 통행로로 비워 둔다
      const [px, pz] = at((i + 0.5) / stalls - 0.5, 0.34);
      if (!rng.chance(0.62)) continue;                 // 빈 자리가 섞여야 주차장이다
      const L = rng.range(4.0, 4.7), W = rng.range(1.7, 1.9);
      const cw = alongX ? W : L;
      const cd = alongX ? L : W;
      b.box(cw, 0.62, cd, [px, 0.46, pz], mats.carBodyMat);
      // 지붕 — 차체보다 좁아야 승용차로 읽힌다
      b.box(cw * 0.86, 0.44, cd * 0.5, [px, 1.0, pz], mats.carBodyMat);
      // 주차선
      for (const sg of [-1, 1]) {
        const [lx, lz] = at(((i + 0.5 + sg * 0.5) / stalls) - 0.5, 0.34);
        b.box(alongX ? 0.1 : L, 0.02, alongX ? L : 0.1, [lx, 0.09, lz], mats.paintMat);
      }
    }
  }

  // ── 쓰레기 집하장 ────────────────────────────────────────────────────────
  // 지붕 얹은 낮은 칸에 통 서넛. 늘 넘친다.
  // 개수는 마당 길이가 정한다 — 40m 마다 하나. 하나로 못 박으면 20m 마당과
  // 90m 마당이 같은 대우를 받는다 (옥상에서 이미 겪은 것과 같은 오류다).
  const yards = Math.max(1, Math.round(len / 40));
  for (let k = 0; k < yards; k++) {
    const t0 = (k + 0.5) / yards - 0.5;
    const [gx, gz] = at(t0 + rng.range(-0.06, 0.06), -0.28);
    const W = 4.6, D = 2.4;
    const gw = alongX ? W : D, gd = alongX ? D : W;
    // 뒷벽과 옆벽 — 벽이 있어야 '집하장' 이고, 없으면 통 몇 개다
    b.box(gw, 1.9, 0.12, [gx, 0.95, gz - gd / 2], mats.alleyWallMat);
    b.box(0.12, 1.9, gd, [gx - gw / 2, 0.95, gz], mats.alleyWallMat);
    b.box(gw, 0.12, gd, [gx, 2.0, gz], mats.grateMat);
    const bins = 3 + (rng.chance(0.5) ? 1 : 0);
    for (let i = 0; i < bins; i++) {
      const t = (i + 0.5) / bins - 0.5;
      const bx = gx + (alongX ? t * W * 0.82 : 0);
      const bz = gz + (alongX ? 0 : t * W * 0.82);
      b.box(0.9, 1.1, 0.8, [bx, 0.55, bz], mats.dumpsterMat);
      if (rng.chance(0.5)) b.sphere(0.3, [bx + rng.range(-0.4, 0.4), 1.25, bz], mats.bagMat);
    }
    claim(gx, gz, 3.2, TIER.ACCESS, 'wasteYard');
  }

  // ── 자전거·스쿠터 거치대 ─────────────────────────────────────────────────
  for (let k = 0; k < yards; k++) {
    const [rx, rz] = at((k + 0.5) / yards - 0.5 + rng.range(0.06, 0.16), -0.16);
    const n = rng.int(4, 7);
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n - 0.5;
      const px = rx + (alongX ? t * 4.4 : 0);
      const pz = rz + (alongX ? 0 : t * 4.4);
      // 거치 고리
      b.box(alongX ? 0.05 : 0.5, 0.7, alongX ? 0.5 : 0.05, [px, 0.35, pz], mats.pipeMat);
      // 세워 둔 것 — 절반쯤은 비어 있다
      if (!rng.chance(0.6)) continue;
      b.box(alongX ? 0.22 : 1.5, 0.95, alongX ? 1.5 : 0.22, [px, 0.6, pz], mats.metalMat);
    }
    claim(rx, rz, 2.8, TIER.ACCESS, 'bikeRack');
  }

  // ── 평상 ─────────────────────────────────────────────────────────────────
  // 콘크리트 벤치. 사람이 마당을 쓴다는 유일한 증거다.
  for (let i = 0; i < yards * 2; i++) {
    const [sx, sz] = at((i + 0.5) / (yards * 2) - 0.5, -0.06 + (i % 2) * 0.06);
    b.box(alongX ? 2.0 : 0.6, 0.12, alongX ? 0.6 : 2.0, [sx, 0.44, sz], mats.plazaStepMat);
    for (const sg of [-1, 1]) {
      const lx = sx + (alongX ? sg * 0.8 : 0);
      const lz = sz + (alongX ? 0 : sg * 0.8);
      b.box(0.16, 0.38, 0.16, [lx, 0.19, lz], mats.plazaStepMat);
    }
  }
}

// ── 한 단지 ────────────────────────────────────────────────────────────────
//
// 대지 하나에 얕은 동 여럿을 나란히 놓는다. 몇 동이 들어가는지는 **대지
// 깊이가 정한다** — 난수가 아니다. 난수로 뽑으면 같은 크기 대지가 어떤 데는
// 두 동, 어떤 데는 한 동이 되어 단지 규칙이 안 읽힌다 (난수 규율 6).
export function housingEstate(b, r, rng, mats, faces, detail, pools) {
  const s = rectSize(r);
  const c = rectCenter(r);
  // 동은 긴 축을 따라 눕고, 여러 동은 짧은 축으로 쌓인다.
  const alongX = s.w >= s.d;
  const span = alongX ? s.d : s.w;   // 쌓이는 방향의 길이

  // 대지가 슬래브 하나보다 얕을 수 있다 (제일 얕은 주거 대지가 6.5m 다).
  // **여기서 안 자르면 슬래브가 대지 밖으로 나간다** — 처음에 이 한 줄이
  // 없어서 건물 15쌍이 최대 6.6m 씩 겹쳤다. 넘친 만큼이 그대로 옆 건물이다.
  const depth = Math.min(SLAB_D, span);
  const rows = Math.max(1, Math.min(3,
    Math.floor((span + YARD_MIN) / (depth + YARD_MIN))));
  // 남는 땅은 동간에 고루 준다. 한 동뿐이면 전부 마당이다.
  // rows>=2 는 span >= 2*depth + YARD_MIN 을 뜻하므로 여기서 위로 잘릴 일은
  // 없다 — 아래로만 잘린다. 그래서 used 는 늘 span 이하다.
  const yard = rows > 1
    ? Math.max(YARD_MIN, Math.min(YARD_MAX, (span - rows * depth) / (rows - 1)))
    : 0;
  const used = rows * depth + (rows - 1) * yard;

  // 남으면 **길 쪽에 붙인다.** 가운데 두면 길과 건물 사이에 빈 땅이 생겨
  // 대지 병합 전보다 성글어진다.
  const lowSide = alongX ? 'nz' : 'nx';
  const start = Math.max(0, faces[lowSide] ? 0 : span - used);

  // 발코니 방향 — 단지 전체가 하나로 간다. 위치에서 뽑는다(난수 아님).
  const flip = hash2(Math.round(c.x) * 13, Math.round(c.z) * 7) < 0.5;
  const front = alongX ? (flip ? 'nz' : 'pz') : (flip ? 'nx' : 'px');
  const back = alongX ? (flip ? 'pz' : 'nz') : (flip ? 'px' : 'nx');

  // 층수. 단지마다 다르고 **단지 안에서도 동마다 다르다.**
  //
  // 전에는 `base ± 1` 이라 어느 단지를 봐도 지붕선이 한 줄이었다. 실제로는
  // 같은 단지 안에서도 대지가 기울면 층수를 맞추고, 나중에 증축한 동은 더
  // 올라간다. ±3 으로 벌리면 옆에서 봤을 때 지붕선이 계단처럼 끊긴다.
  const base = rng.int(6, 14);

  // ── 붙는 것은 벽 밖으로 나간다 ───────────────────────────────────────────
  //
  // 발코니는 1.25m, 계단실은 2.2m 튀어나온다. 그러니 **몸통을 그만큼 안으로
  // 들여야** 붙은 것까지가 대지 안이다. 안 들이면 계단실이 인도로 나가고,
  // 그건 배치 검사가 아니라 눈으로 먼저 보인다.
  // 몸통이 너무 얇아지면 슬래브가 아니라 칸막이가 된다. 그런 대지는 계단실을
  // 빼고(`slim`) 편복도만 남긴다 — 그래도 **들이는 것은 그대로 한다.**
  // 안 들이면 편복도와 발코니가 대지 밖으로 나가 옆 단지와 겹친다.
  const slim = depth < FRONT_OUT + BACK_OUT + 5;
  // slim 이면 계단실이 없다. 그래도 편복도와 **현관 차양**은 나오므로 둘 중
  // 깊은 쪽만큼은 들여야 한다.
  const backOut = slim ? Math.max(DECK_OUT, CANOPY_D) + 0.1 : BACK_OUT;
  const inset = (band) => {
    // 정말 얕은 대지는 들일 수가 없다. 이때만 예전처럼 통짜로 둔다.
    if (depth - FRONT_OUT - backOut < 3) return band;
    const lowIsFront = front === 'nz' || front === 'nx';
    const d0 = lowIsFront ? FRONT_OUT : backOut;
    const d1 = lowIsFront ? backOut : FRONT_OUT;
    return alongX
      ? { ...band, z0: band.z0 + d0, z1: band.z1 - d1 }
      : { ...band, x0: band.x0 + d0, x1: band.x1 - d1 };
  };

  const slabs = [];
  let top = 0;
  const lo = alongX ? r.z0 : r.x0;
  for (let i = 0; i < rows; i++) {
    const a = lo + start + i * (depth + yard);
    const band = alongX
      ? { x0: r.x0, x1: r.x1, z0: a, z1: a + depth }
      : { x0: a, x1: a + depth, z0: r.z0, z1: r.z1 };
    const floors = Math.max(4, base + rng.int(-3, 3));
    const t = slabBody(b, inset(band), front, back, floors, rng, mats, detail, pools, slim);
    // 앵커는 **띠 전체**다. 몸통만 주면 브릿지가 발코니 격자에 물린다.
    slabs.push({ rect: band, top: t, floors });
    if (t > top) top = t;
  }

  // ── 마당 ─────────────────────────────────────────────────────────────────
  // 동 사이, 그리고 한 동뿐일 때 남은 땅.
  for (let i = 0; i < rows - 1; i++) {
    const a = lo + start + i * (depth + yard) + depth;
    estateYard(b, alongX
      ? { x0: r.x0, x1: r.x1, z0: a, z1: a + yard }
      : { x0: a, x1: a + yard, z0: r.z0, z1: r.z1 },
      alongX, rng, mats, pools);
  }
  if (rows === 1 && span - used > 8) {
    const a = start > 0 ? lo : lo + depth;
    const w = span - used;
    estateYard(b, alongX
      ? { x0: r.x0, x1: r.x1, z0: a, z1: a + w }
      : { x0: a, x1: a + w, z0: r.z0, z1: r.z1 },
      alongX, rng, mats, pools);
  }

  return { top, slabs };
}
