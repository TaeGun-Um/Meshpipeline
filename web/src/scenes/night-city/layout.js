// 도시의 격자와 높이 분포.
//
// 나이트시티의 인상은 "네온"이 아니라 **수직 스케일의 격차**에서 온다. 노점이
// 붙은 3층 상가 바로 옆에 200m 메가빌딩이 서 있고, 그 사이로 고가도로가 지난다.
// 그래서 높이를 균등 난수로 뽑으면 절대 그 느낌이 나지 않는다 — 도심 코어로
// 갈수록 높아지는 가중치와, 드물게 튀는 초고층을 따로 둔다.

import { hash2 } from '../../core/textures.js';

// 블록 한 변 + 도로 폭 = 격자 간격
export const BLOCK_SIZE = 66;
export const STREET_WIDTH = 22;
export const PITCH = BLOCK_SIZE + STREET_WIDTH; // 88

// 상세 지오메트리를 만드는 범위. 12x12 블록 = 1,056m 사방.
//
// 6 에서 12 로 늘렸다. 블록이 36 -> 144 개로 **4배**가 된다 (면적 기준 2배가
// 아니라 한 변이 2배이므로). 삼각형·빌드 시간도 대략 그만큼 늘어난다.
//
// 그래서 detailAt() 으로 중심에서 멀수록 디테일을 줄인다 — 아래 참고.
export const GRID = 12;
export const CITY_HALF = (GRID * PITCH) / 2; // 528

export const CURB_HEIGHT = 0.16;

// 콘크리트 패널 텍스처 반복 간격(m). 건물 덩치의 UV 를 미터 단위로 맞추는 데
// 쓴다. towers 와 bazaar 가 같은 값을 봐야 두 생성기의 벽이 이어져 보인다.
export const PANEL_TILE = 7.0;

// 인도 폭. 블록 가장자리에서 이만큼은 건물이 못 들어온다.
//
// ── 왜 상수로 강제하는가 (실측으로 고침) ───────────────────────────────────
// 원래는 블록 전체(66x66)를 필지로 나누고, 필지를 0.35~1.4m 줄이는 것으로
// 끝냈다. 그러면 **인도 폭이 그 줄인 양뿐**이고 필지마다 값이 달라서, 도시를
// 걸으면 인도가 있다가 없다가 한다. 어떤 건물은 차도에 바로 붙어 서 있었다.
//
// 인도는 필지 분할의 부산물이 아니라 **먼저 확보하는 공용 공간**이다.
// 그래서 나눌 때부터 블록에서 빼놓는다.
export const SIDEWALK_W = 4.6;

// 층고
export const FLOOR_HEIGHT = 3.6; // 오피스·주거 기준층
export const PODIUM_FLOOR = 4.6; // 저층 상가는 층고가 높다

// 고가도로가 지나는 격자선 (x = 이 값 근처의 도로 위)
export const HIGHWAY_X = -PITCH / 2;
export const HIGHWAY_Y = 26;

// ── 격자 좌표 ──────────────────────────────────────────────────────────────

// 블록 인덱스(0..GRID-1) -> 블록 중심 좌표
export function blockCenter(i) {
  return (i - (GRID - 1) / 2) * PITCH;
}



// 격자선(도로 중심)까지의 거리. 도로 중심에서 0, 블록 중심에서 PITCH/2.
// JS 의 % 는 음수에 음수를 돌려주므로 한 번 더 더해서 양수로 만든다.
function gridDist(v) {
  return Math.abs(((((v + PITCH / 2) % PITCH) + PITCH) % PITCH) - PITCH / 2);
}

// 교차로 안인지 — 두 축이 모두 도로 폭 안.
export function onIntersection(x, z) {
  const half = STREET_WIDTH / 2;
  return gridDist(x) <= half && gridDist(z) <= half;
}

// 격자선 좌표 목록 (도로 중심선). 바깥 경계 도로까지 GRID+1 개.
export function gridLines() {
  const out = [];
  for (let i = 0; i <= GRID; i++) out.push(blockCenter(0) - PITCH / 2 + i * PITCH);
  return out;
}

// ── 디테일 등급 (LOD) ──────────────────────────────────────────────────────
//
// 격자를 12x12 로 늘리면서 필요해졌다. 모든 블록을 같은 밀도로 만들면
// 삼각형이 4배가 되고 빌드도 4배로 길어진다.
//
// **거리 기반 LOD 가 아니라 도시 구조로 푼다.** 카메라가 자유롭게 날아다니므로
// 거리로 줄이면 변두리에 가까이 갔을 때 텅 빈 상자가 보인다. 대신 실제 도시가
// 그렇듯 **중심에서 멀수록 원래 성기게** 만든다 — 레퍼런스의 배드랜즈 쪽
// 외곽이 그렇고, 그게 도심의 밀도를 돋보이게도 한다.
//
//   1.0  도심   전부 만든다
//   0.22 외곽   파사드 설비·간판·점포·시설물을 크게 줄인다
//
// 반환값은 배수다. 각 모듈이 자기 밀도에 곱해 쓴다.
export function detailAt(cx, cz) {
  const d = coreDistance(cx, cz); // 0 = 중심, 1 = 바깥
  // 중심부 40% 는 그대로 두고, 그 밖에서 완만하게 떨어뜨린다.
  // 계단식으로 떨어지면 경계가 눈에 보인다.
  const t = Math.max(0, (d - 0.4) / 0.6);
  return 1 - t * t * 0.78;
}

// ── 블록 용도 ──────────────────────────────────────────────────────────────
//
// 모든 블록이 타워면 도시가 균일해진다. 실제 도시에는 공사장, 광장, 주차장,
// 비어 있는 대지가 섞여 있고 **그 빈 곳이 있어야 타워가 높아 보인다.**
//
// 난수 스트림이 아니라 좌표 해시로 정한다. 프로그램 배정이 rng 를 소비하면
// 그 뒤의 모든 건물 생성이 밀려서, 용도 비율만 바꿔도 도시 전체가 달라진다.
export function blockProgram(ix, iz) {
  const h = hash2(ix * 71 + 13, iz * 37 + 5);
  if (h < 0.06) return 'construction';
  if (h < 0.11) return 'plaza';
  if (h < 0.15) return 'lot';
  return 'towers';
}

// ── 높이 분포 ──────────────────────────────────────────────────────────────

// 도심 코어까지의 거리(0=중심, 1=바깥)
export function coreDistance(cx, cz) {
  const d = Math.hypot(cx, cz) / (CITY_HALF * Math.SQRT2);
  return Math.min(1, d);
}

// 타워 높이 하나를 뽑는다.
//
// 세 등급을 확률로 섞는다. 등급을 나누는 이유는 균등 분포가 "다 비슷하게 큰"
// 스카이라인을 만들기 때문이다. 실루엣은 격차에서 생긴다.
//   저층  8~26m    상가·잡거빌딩. 골목 스케일을 만든다
//   중층  34~90m   도시의 몸통
//   초고층 130~300m 드물게. 안개 위로 솟아야 랜드마크가 된다
export function pickHeight(rng, core) {
  // 코어에 가까울수록 초고층·중층 확률이 올라간다
  const near = 1 - core;
  const r = rng.next();

  const pTall = 0.09 + near * 0.3;
  const pMid = 0.36 + near * 0.28;

  // 초고층 상한을 380m 로 올렸다. 레퍼런스의 인상은 "높은 건물이 많다" 가 아니라
  // "안개 위로 솟은 것이 몇 개 있다" 는 쪽이다. 상한이 낮으면 전부 비슷해 보인다.
  if (r < pTall) return rng.range(140, 140 + 240 * near);
  if (r < pTall + pMid) return rng.range(38, 38 + 72 * (0.4 + near * 0.6));
  return rng.range(10, 30);
}

// ── 골목 ───────────────────────────────────────────────────────────────────
//
// 골목이 왜 필요한지와 안에 무엇을 놓는지는 alley.js 에 있다. 여기에는
// **어디에 낼 것인가** 만 둔다 — 그게 필지 분할과 같은 문제이기 때문이다.
// 폭. 22m 도로 옆에서 확실히 좁게 읽혀야 하고, 사람 둘이 지나갈 수는 있어야 한다.
// 3.0 은 통로가 아니라 틈처럼 보였고, 6.0 은 그냥 좁은 길이었다.
export const ALLEY_WIDTH = 4.4;

// ── 어디에 낼 것인가 ───────────────────────────────────────────────────────
//
// 난수 스트림이 아니라 **좌표 해시**로 정한다. blockProgram 과 같은 이유다 —
// rng 를 소비하면 골목 비율만 바꿔도 그 뒤의 모든 건물 생성이 밀려서 도시
// 전체가 달라진다.
//
// 종류는 셋이다. 전부 관통시키면 격자가 두 배로 촘촘해질 뿐 위계가 안 생긴다.
//   through  블록을 가로지른다. 지름길이 되고, 반대편이 보여 들어갈 마음이 든다.
//   dead     한쪽에서 들어가 막힌다. 하역장·주차 진입로. 들어가 봐야 아는 공간.
//   none     골목 없음. 없는 블록이 있어야 있는 블록이 특별해진다.
// rate 는 구역이 정한 골목 밀도(0..1). 안 주면 예전 기본값을 쓴다.
//
// 재팬타운(0.72)과 기업 구역(0.10)이 같은 확률로 골목을 내면, 걸어봤을 때
// 두 곳이 같은 도시로 느껴진다. **뒷길이 없다는 것 자체가** 기업 구역의
// 성격이고, 골목 천지인 것이 번화가의 성격이다.
export function alleyFor(ix, iz, root, rate = 0.58) {
  const h = hash2(ix * 131 + 7, iz * 89 + 41);
  // 앞쪽 2/3 는 관통, 뒤 1/3 은 막다른 골목으로 나눈다
  const kind = h < rate * 0.6 ? 'through' : h < rate ? 'dead' : 'none';
  if (kind === 'none') return null;

  // 두 번째 해시로 방향과 위치를 정한다. 항상 한가운데를 지나면 블록이 전부
  // 대칭으로 쪼개져 또 규칙적으로 보인다.
  const g = hash2(ix * 17 + 3, iz * 53 + 29);
  const alongX = g < 0.5;
  // 0.30~0.70 — 가장자리에 너무 붙으면 한쪽 필지가 건물이 못 될 만큼 얇아진다
  const t = 0.30 + ((g * 7.13) % 1) * 0.40;

  const half = ALLEY_WIDTH / 2;
  const cx = root.x0 + (root.x1 - root.x0) * t;
  const cz = root.z0 + (root.z1 - root.z0) * t;

  if (kind === 'through') {
    const rect = alongX
      ? { x0: root.x0, x1: root.x1, z0: cz - half, z1: cz + half }
      : { x0: cx - half, x1: cx + half, z0: root.z0, z1: root.z1 };
    return { kind, alongX, rect };
  }

  // 막다른 골목 — 블록 깊이의 62~78% 만 들어간다. 어느 쪽 도로에서 들어가는지도
  // 해시로 정한다.
  const deep = 0.62 + ((g * 3.7) % 1) * 0.16;
  const fromLow = ((g * 11.3) % 1) < 0.5;
  const len = BLOCK_SIZE * deep;
  const rect = alongX
    ? {
        x0: fromLow ? root.x0 : root.x1 - len,
        x1: fromLow ? root.x0 + len : root.x1,
        z0: cz - half,
        z1: cz + half,
      }
    : {
        x0: cx - half,
        x1: cx + half,
        z0: fromLow ? root.z0 : root.z1 - len,
        z1: fromLow ? root.z0 + len : root.z1,
      };
  return { kind, alongX, rect, fromLow, len };
}

// 골목이 차지하는 자리인지. 인도 시설물이 골목 입구를 막지 않게 하는 데 쓴다.
//
// 실제로 자판기 네 대가 골목 입구를 가로막고 서 있었다. createStreetLife 는
// 인도를 13m 간격으로 훑을 뿐 골목의 존재를 모르기 때문이다. 골목은 좌표
// 해시로 정해지므로 여기서 다시 계산해도 같은 답이 나온다 — 배치 정보를
// 모듈 사이로 넘기지 않아도 된다.
// 구역별 골목 밀도를 layout 안에서 알아야 하는데 district.js 를 import 하면
// 순환이 된다. 그래서 **밀도만** 여기 복제한다 — 표 전체가 아니라 숫자 넷이다.
// district.js 의 alleyRate 를 바꾸면 여기도 바꿔야 한다.
let RATE_HOOK = null;
export function setAlleyRateHook(fn) {
  RATE_HOOK = fn;
  ALLEY_CACHE = null; // 밀도가 바뀌면 캐시를 버린다
}
function alleyRateAt(ix, iz) {
  return RATE_HOOK ? RATE_HOOK(ix, iz) : 0.58;
}

let ALLEY_CACHE = null;
export function allAlleyRects() {
  if (ALLEY_CACHE) return ALLEY_CACHE;
  ALLEY_CACHE = [];
  const h = BLOCK_SIZE / 2;
  for (let ix = 0; ix < GRID; ix++) {
    for (let iz = 0; iz < GRID; iz++) {
      const cx = blockCenter(ix);
      const cz = blockCenter(iz);
      const a = alleyFor(ix, iz, { x0: cx - h, x1: cx + h, z0: cz - h, z1: cz + h }, alleyRateAt(ix, iz));
      if (a) ALLEY_CACHE.push({ ...a, ix, iz });
    }
  }
  return ALLEY_CACHE;
}

// margin 은 입구 양옆의 여유. 물건이 골목 모서리에 딱 붙어 서면
// 골목으로 들어가는 길이 좁아 보인다.
export function inAlley(x, z, margin = 2.4) {
  for (const { rect: r } of allAlleyRects()) {
    if (x > r.x0 - margin && x < r.x1 + margin && z > r.z0 - margin && z < r.z1 + margin) return true;
  }
  return false;
}

// 사각형에서 띠를 빼고 남은 조각들. 관통이면 둘, 막다른 골목이면 셋이 나온다.
//
// 남은 조각이 MIN 보다 얇으면 버린다 — 폭 4m 짜리 필지에 건물을 세우면
// 판자처럼 보이고, 그 판자가 골목 벽이 되면 두께가 없어 보인다.
export function subtractAlley(root, a) {
  const MIN = 9;
  const out = [];
  const push = (r) => {
    if (r.x1 - r.x0 >= MIN && r.z1 - r.z0 >= MIN) out.push(r);
  };

  if (a.alongX) {
    push({ ...root, z1: a.rect.z0 });
    push({ ...root, z0: a.rect.z1 });
    // 막다른 골목의 끝쪽 — 골목이 안 닿는 남은 폭
    if (a.kind === 'dead') {
      if (a.rect.x0 > root.x0) push({ x0: root.x0, x1: a.rect.x0, z0: a.rect.z0, z1: a.rect.z1 });
      if (a.rect.x1 < root.x1) push({ x0: a.rect.x1, x1: root.x1, z0: a.rect.z0, z1: a.rect.z1 });
    }
  } else {
    push({ ...root, x1: a.rect.x0 });
    push({ ...root, x0: a.rect.x1 });
    if (a.kind === 'dead') {
      if (a.rect.z0 > root.z0) push({ x0: a.rect.x0, x1: a.rect.x1, z0: root.z0, z1: a.rect.z0 });
      if (a.rect.z1 < root.z1) push({ x0: a.rect.x0, x1: a.rect.x1, z0: a.rect.z1, z1: root.z1 });
    }
  }
  return out;
}


// 블록을 타워 몇 개로 쪼갤지, 각 타워의 사각형 범위를 돌려준다.
//
// 블록을 통째로 한 타워로 쓰면 66m 짜리 뚱뚱한 상자만 늘어선다. 실제 도시처럼
// 큰 덩어리 하나 + 작은 것 몇 개로 쪼개야 정면에 깊이가 생긴다.
export function subdivideBlock(rng, cx, cz) {
  const half = BLOCK_SIZE / 2;
  return subdivideRect(rng, { x0: cx - half, x1: cx + half, z0: cz - half, z1: cz + half });
}

// 블록 하나를 필지들과 골목으로 나눈다.
//
// 골목을 **먼저** 빼내는 것이 핵심이다. 필지를 나눈 뒤 사이를 벌리면 골목이
// 아니라 빈틈이 된다 (alley.js 머리말 참고). 띠를 먼저 파내고 남은 조각을
// 각각 쪼개야 골목 양옆이 벽으로 막힌 통로가 된다.
// D 는 구역(district.js). 인도 폭·필지 잘기·골목 밀도를 구역이 정한다.
//
// 순환 참조를 피하려고 **인자로 받는다**. district.js 가 layout 의 상수를
// 쓰므로 layout 이 district 를 import 하면 순환이 된다. 구역은 좌표 해시라
// 부르는 쪽에서 구해 넘기면 그만이다.
export function blockLots(rng, blk, D = null) {
  const half = BLOCK_SIZE / 2;
  const root = { x0: blk.cx - half, x1: blk.cx + half, z0: blk.cz - half, z1: blk.cz + half };
  const walk = D?.sidewalk ?? SIDEWALK_W;

  // 골목은 **블록 전체**를 기준으로 정한다. 인도를 뺀 안쪽만 보면 골목이
  // 도로까지 닿지 않아 입구가 없는 골목이 된다.
  const a = alleyFor(blk.ix, blk.iz, root, D?.alleyRate);

  // 건물이 설 수 있는 범위 — 인도를 먼저 빼놓는다
  const buildable = {
    x0: root.x0 + walk, x1: root.x1 - walk,
    z0: root.z0 + walk, z1: root.z1 - walk,
  };

  const grain = D?.grain;
  if (!a) return { lots: subdivideRect(rng, buildable, grain), alleys: [] };

  const parts = subtractAlley(buildable, a);
  // 골목이 너무 잘게 잘라 남은 조각이 없으면 골목을 포기한다
  if (!parts.length) return { lots: subdivideRect(rng, buildable, grain), alleys: [] };

  return { lots: parts.flatMap((p) => subdivideRect(rng, p, grain)), alleys: [a] };
}

// grain: 분할 깊이를 구역이 강제한다 (null 이면 예전처럼 난수로 정한다).
//   0 통짜 한 동 (기업)   1 큰 덩어리 (공업)
//   2 보통 (주거)         3 잘게 (번화가)
function subdivideRect(rng, root, grain = null) {
  const mode = rng.next();
  if (grain !== null) {
    // 난수는 그대로 소비한다 — 소비를 건너뛰면 뒤의 모든 생성이 밀린다
    if (grain <= 0) return [root];
    return split(rng, root, grain);
  }
  // 통짜 한 동 (메가빌딩). 레퍼런스의 주인공은 폭 60~100m 짜리 거대 덩어리다.
  // 이 확률을 0.1 까지 낮췄더니 도시가 잘게 쪼개져 "빌딩 숲" 이 아니라
  // "기둥 밭" 처럼 보였다.
  if (mode < 0.26) return [root];

  // 재귀 이분할(BSP). 한 번에 4등분하는 것보다 필지 크기가 다양해진다.
  //
  // 밀도는 "작은 건물이 많다" 가 아니라 **큰 것 옆에 작은 것이 붙어 있다** 는
  // 데서 온다. 균등 분할은 다 비슷한 크기를 만들어 그 인상이 안 나온다.
  const depth = mode < 0.6 ? 1 : mode < 0.87 ? 2 : 3;
  return split(rng, root, depth);
}

// 이보다 작으면 더 쪼개지 않는다. 17m 는 창 10칸 폭이다 —
// 이보다 좁으면 정면에 창이 대여섯 개밖에 안 들어가 건물이 장난감처럼 보인다.
const MIN_LOT = 17;

function split(rng, r, depth) {
  const w = r.x1 - r.x0;
  const d = r.z1 - r.z0;
  if (depth <= 0 || (w < MIN_LOT * 2 && d < MIN_LOT * 2)) return [r];

  // 긴 쪽을 자른다. 그래야 가늘고 긴 필지가 안 생긴다.
  const cutX = w >= d;
  const span = cutX ? w : d;
  if (span < MIN_LOT * 2) return [r];

  // 정확히 반이 아니라 치우쳐 자른다 — 크기 차이가 밀도의 인상을 만든다
  const t = rng.range(0.32, 0.68);
  const m = (cutX ? r.x0 : r.z0) + span * t;
  const a = cutX ? { ...r, x1: m } : { ...r, z1: m };
  const b = cutX ? { ...r, x0: m } : { ...r, z0: m };

  // 한쪽만 더 쪼개는 경우를 섞으면 큰 덩어리와 잔 필지가 이웃한다
  const da = rng.chance(0.78) ? depth - 1 : 0;
  const db = rng.chance(0.78) ? depth - 1 : 0;
  return [...split(rng, a, da), ...split(rng, b, db)];
}
