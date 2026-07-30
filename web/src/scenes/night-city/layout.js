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

// 상세 지오메트리를 만드는 범위. 6x6 블록.
export const GRID = 6;
export const CITY_HALF = (GRID * PITCH) / 2; // 264

export const CURB_HEIGHT = 0.16;

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

// 블록을 타워 몇 개로 쪼갤지, 각 타워의 사각형 범위를 돌려준다.
//
// 블록을 통째로 한 타워로 쓰면 66m 짜리 뚱뚱한 상자만 늘어선다. 실제 도시처럼
// 큰 덩어리 하나 + 작은 것 몇 개로 쪼개야 정면에 깊이가 생긴다.
export function subdivideBlock(rng, cx, cz) {
  const half = BLOCK_SIZE / 2;
  const root = { x0: cx - half, x1: cx + half, z0: cz - half, z1: cz + half };

  const mode = rng.next();
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
