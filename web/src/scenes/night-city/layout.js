// 도시의 격자와 높이 분포.
//
// 나이트시티의 인상은 "네온"이 아니라 **수직 스케일의 격차**에서 온다. 노점이
// 붙은 3층 상가 바로 옆에 200m 메가빌딩이 서 있고, 그 사이로 고가도로가 지난다.
// 그래서 높이를 균등 난수로 뽑으면 절대 그 느낌이 나지 않는다 — 도심 코어로
// 갈수록 높아지는 가중치와, 드물게 튀는 초고층을 따로 둔다.

import { hash2 } from '../../core/textures.js';

import { onSceneReset } from '../../core/scenestate.js';
// 블록 한 변. 구간 피치가 달라져도 **판 크기는 일정하다** — 이 도시는
// 블록을 표준 규격으로 찍어 냈고, 매립 차수마다 달라진 것은 그 사이의 길이다.
export const BLOCK_SIZE = 66;

// 이름뿐인 도로 폭. **모듈 밖으로 내보내지 않는다.**
//
// ── 왜 상수를 없앴는가 (아홉 번째 결합 오류) ───────────────────────────────
// 원래 `PITCH = BLOCK_SIZE + STREET_WIDTH` 였고 셋이 한 몸이었다. 그런데
// 구간별 격자(SPANS)가 들어오면서 피치가 74·88·104·82 로 갈라졌는데
// BLOCK_SIZE 와 STREET_WIDTH 는 고정으로 남았다. 66+22=88 은 **두 번째
// 구간에서만** 맞는다.
//
// 그 결과 여섯 모듈이 "도로 반폭은 11m" 라고 믿고 물건을 놓았고,
// 피치 74 구간의 실제 도로는 8m 였다. 갓길 주차 1,137대(전체의 57%)가
// 인도와 건물 안에 서 있었다. 배치 검사기를 만들고서야 나왔다.
//
// 그래서 이제 도로는 상수가 아니라 **블록 판 사이에 남은 공간**이다.
// 아래 roads() 하나가 유일한 출처이고, 이 숫자는 바깥 경계 도로에만 쓴다
// (그쪽은 마주 볼 블록이 없어 다른 근거가 없다).
// ── 골목 스위치 (사용자 지시로 폐기) ──────────────────────────────────────
//
// **골목이 있나 없나를 판단하는 곳은 여기 하나뿐이다.** 소비자가 둘이므로
// (blockLots 가 필지를 자르고, allAlleyRects 가 입구를 비운다) 각자 판단하게
// 두면 한쪽만 꺼지는 사고가 난다 — 실제로 그렇게 됐다.
const ALLEYS_ON = false;

// 보행로 양옆 완충. 건물은 이만큼 물러나 선다.
//
// **밖으로 내보낸다.** towers.streetFaces 가 "이 면이 보행로를 마주 보나" 를
// 판정할 때 같은 값을 봐야 하기 때문이다. 처음에 여기 3.0 을 두고 판정
// 허용치는 2.0 으로 따로 뒀더니, 건물이 3m 물러난 순간 **모든 면이 '길에 안
// 면함' 이 되어** 길에 면한 면이 0.54 -> 0.36 으로, 간판이 1,142 -> 683 개로
// 죽었다. 인도 폭에서 이미 똑같이 당했던 실수다 (streetFaces 머리말).
export const WALK_CLEAR = 3.0;

const NOMINAL_STREET = 22;
export const PITCH = BLOCK_SIZE + NOMINAL_STREET; // 88 — 기본 피치

// 상세 지오메트리를 만드는 범위. 12x12 블록 = 1,056m 사방.
//
// 6 에서 12 로 늘렸다. 블록이 36 -> 144 개로 **4배**가 된다 (면적 기준 2배가
// 아니라 한 변이 2배이므로). 삼각형·빌드 시간도 대략 그만큼 늘어난다.
//
// 그래서 detailAt() 으로 중심에서 멀수록 디테일을 줄인다 — 아래 참고.
export const GRID = 12;

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

// 공사장 구덩이가 블록 가장자리에서 얼마나 안쪽인가.
//
// streets.blockPlates(인도 띠를 남긴다) 와 program.constructionSite(구덩이를
// 판다) 가 **같은 값을 봐야 한다.** 전에는 양쪽에 3 을 각자 써 두고 주석으로만
// "같아야 한다" 고 적어 뒀는데, 주석은 강제하지 않는다.
export const PIT_INSET = 3;

// 층고
export const FLOOR_HEIGHT = 3.6; // 오피스·주거 기준층
export const PODIUM_FLOOR = 4.6; // 저층 상가는 층고가 높다

// ── 고가도로 ───────────────────────────────────────────────────────────────
//
// 고가도로는 **도로 위**를 지난다. 당연한 말 같지만 전에는 그렇지 않았다.
//
// `HIGHWAY_X = -PITCH / 2 = -44` 였다. 등간격 격자에서는 -44 가 격자선이라
// 맞았는데, 구간별 피치가 들어오면서 -44 는 **블록 5 판(-102~-36) 안쪽**이
// 됐다. 그래서 상판·교각·기초가 도시를 남북으로 가로지르며 건물 위를
// 지나갔다. 9·11·12번과 같은 뿌리다 — 파생 상수를 안 따라갔다.
//
// 이제 상수가 아니라 **도로를 고른다.** 도로가 어디인지는 roads() 하나가
// 알고 있으므로, 격자가 또 바뀌어도 따라온다.
export const HIGHWAY_BAND = 6; // roads() 의 몇 번째 띠를 타는가 (도심 서쪽)
export const HIGHWAY_Y = 26;

export function highwayX() {
  return roads()[HIGHWAY_BAND].mid;
}

// ── 격자 좌표 ──────────────────────────────────────────────────────────────

// 블록 인덱스(0..GRID-1) -> 블록 중심 좌표
// ── 구간별로 다른 격자 (docs/city.md 1기) ──────────────────────────────────
//
// 등간격 격자 하나로 도시를 덮으면 "도로 건물 직각" 이 무한 반복된다.
// 그게 지금 도시가 사이버펑크로 안 읽히는 근본 이유였다.
//
// 내력이 이렇게 말한다: 기업이 바다를 **한 번에 메우지 않았다.** 자금과
// 필요에 따라 여러 차례 나눠 메웠고, 그때마다 측량 기준과 블록 크기가
// 달랐다. 초기 매립지는 촘촘하고(화물 마차 시대), 나중 매립지는 성기다
// (트럭 시대).
//
// 그래서 축을 따라 **구간마다 다른 피치**를 준다. 구간이 만나는 자리에서
// 격자가 어긋나고, 거기에 어정쩡한 자투리 블록이 생긴다 — 그게 요점이다.
//
// 좌표 해시로 정한다. 난수를 쓰면 격자를 바꿀 때마다 도시 전체가 밀린다.
const SPANS = [
  // [블록 수, 피치]  — 합이 GRID 가 되어야 한다
  [3, 74],   // 1차 매립 — 촘촘하다. 마차가 다니던 시절
  [3, 88],   // 2차
  [2, 104],  // 3차 — 트럭 시대. 성기다
  [4, 82],   // 4차 — 급하게 메웠다. 다시 좁아진다
];

// 블록 중심 좌표를 누적으로 미리 계산한다. 매번 더하면 부동소수 오차가 쌓인다.
const CENTERS = (() => {
  const pitches = [];
  for (const [n, p] of SPANS) for (let i = 0; i < n; i++) pitches.push(p);
  while (pitches.length < GRID) pitches.push(PITCH);
  pitches.length = GRID;

  const total = pitches.reduce((a, b) => a + b, 0);
  const out = [];
  let x = -total / 2;
  for (let i = 0; i < GRID; i++) {
    out.push(x + pitches[i] / 2);
    x += pitches[i];
  }
  return { centers: out, pitches, total };
})();

// 도시 반폭 — 구간 합에서 나온다. GRID*PITCH/2 가 아니다.
export const CITY_SPAN = CENTERS.total / 2;

// ── CITY_HALF 는 CITY_SPAN 과 같은 값이다 (결합 오류 하나 더) ──────────────
//
// 전에는 `CITY_HALF = GRID * PITCH / 2 = 528` 이었다. 구간별 격자(SPANS)가
// 들어오면서 실제 반폭은 CENTERS.total/2 = **511** 이 됐는데 이 상수만
// 안 따라갔다. 17m 차이를 열두 모듈이 "도시 끝" 으로 믿고 있었다.
//
//   crowd    -CITY_HALF+6 부터 걷게 하므로 **사람이 도시 밖 11m 를 걸었다**
//   port     매립 비탈이 CITY_HALF+2 에서 시작해 도시 끝과 17m 벌어졌다
//   streets  차선 점선을 +-528 까지 그렸다 (도로가 없는 곳까지)
//
// 이름은 열두 모듈이 쓰므로 그대로 두고 **값만 진실에 맞춘다.**
// 9·11·12·13번과 정확히 같은 뿌리다 — 파생 상수가 원본을 안 따라갔다.
export const CITY_HALF = CITY_SPAN;

export function blockCenter(i) {
  return CENTERS.centers[Math.max(0, Math.min(GRID - 1, i))];
}

// ── 블록이 차지한 사각형 ───────────────────────────────────────────────────
//
// **블록의 '경계' 가 필요한 곳은 전부 여기를 부른다.**
//
// 전에는 여덟 모듈이 각자 `blockCenter(i) ± BLOCK_SIZE/2` 를 썼다. 지금은
// 그 식이 맞지만, 대지 병합(여러 칸을 한 대지로)이 들어오면 **한 곳도 빠짐없이**
// 틀리게 된다. 그때 여덟 곳을 찾아 고치는 것과 여기 한 곳을 고치는 것의
// 차이다.
//
// roads() 를 단일 출처로 만들어 두었더니 격자 불일치 수정이 자동으로
// 전파됐다 (당시 일지 기록 — 일지는 폐기됨). 같은 이유로 먼저 모아 둔다.
export function blockRect(ix, iz) {
  const h = BLOCK_SIZE / 2;
  const cx = blockCenter(ix);
  const cz = blockCenter(iz);
  return { x0: cx - h, x1: cx + h, z0: cz - h, z1: cz + h };
}

// 그 블록의 피치 (도로 폭을 포함한 간격).
function blockPitch(i) {
  return CENTERS.pitches[Math.max(0, Math.min(GRID - 1, i))];
}

// ── 좌표 -> 블록 번호 ──────────────────────────────────────────────────────
//
// 전에는 여섯 모듈이 각자 `Math.round(x / PITCH + (GRID-1)/2)` 를 썼다.
// 등간격이 아니게 되는 순간 그 식이 전부 틀린다.
//
// **같은 값을 두 곳에서 계산하지 말 것** (docs/lessons.md 2.1 결합 대장).
// 여기 하나만 두고 전부 이걸 부른다.
export function blockIndexAt(v) {
  const c = CENTERS.centers;
  let best = 0;
  let bd = Infinity;
  for (let i = 0; i < c.length; i++) {
    const d = Math.abs(v - c[i]);
    if (d < bd) { bd = d; best = i; }
  }
  return best;
}

// ── 도로 ───────────────────────────────────────────────────────────────────
//
// **도로는 폭이 정해진 것이 아니라 블록 판 사이에 남은 공간이다.**
//
// 블록 i 는 폭 blockPitch(i) 짜리 칸을 갖고, 그 한가운데에 66m 판이 놓인다.
// 그래서 판 양옆에 (피치 - 66)/2 씩 여백이 남고, 이웃한 두 여백이 만나
// 도로가 된다.
//
//   74 · 74   4 + 4  =  8m   1차 매립 — 마차가 다니던 시절이라 좁다
//   88 · 88  11 + 11 = 22m   2차
//   104·104  19 + 19 = 38m   3차 — 트럭 시대
//   82 · 82   8 + 8  = 16m   4차
//   74 · 88   4 + 11 = 15m   **구간 경계. 격자선 기준으로 비대칭이다**
//
// 마지막 줄이 요점이다. 구간이 바뀌는 자리에서는 도로가 한쪽으로 치우친다.
// 그래서 "격자선에서 ±얼마" 로 물건을 놓으면 반드시 한쪽이 틀린다.
// **연석(블록 판 가장자리)에서부터 재야 한다** — 그게 lo·hi 다.
let ROADS_CACHE = null;
export function roads() {
  if (ROADS_CACHE) return ROADS_CACHE;
  const h = BLOCK_SIZE / 2;
  const out = [];

  // ── 바깥 경계 도로는 **순환로**다 (사용자 지시) ──────────────────────────
  //
  // *"맵 외곽에 있는 도로는 4차선 도로로 넓게 만들기"*
  //
  // 전에는 "마주 볼 블록이 없으니 안쪽 여백을 거울처럼 접어 쓴다" 였고, 그
  // 결과 저쪽 끝이 **8m** 였다 — 2차선도 안 된다. 그런데 이 도로는 안쪽
  // 골목이 아니라 **항만과 공장을 도는 순환로**다. 트럭이 다니는 길이 도시에서
  // 제일 좁다는 것은 앞뒤가 안 맞는다.
  //
  // 18m 로 고정한다 — 차선 3.4m x 4 = 13.6m 에 갓길과 연석 여유. 격자 안쪽은
  // 건드리지 않으므로 도시는 그대로 있고 **바깥으로만** 넓어진다
  // (안벽까지 −X 133m · 삼면 20m 가 남는다).
  const OUTER_ROAD = 18;
  const firstEdge = blockCenter(0) - h;
  out.push({ lo: firstEdge - OUTER_ROAD, hi: firstEdge });
  for (let i = 0; i + 1 < GRID; i++) {
    out.push({ lo: blockCenter(i) + h, hi: blockCenter(i + 1) - h });
  }
  const lastEdge = blockCenter(GRID - 1) + h;
  out.push({ lo: lastEdge, hi: lastEdge + OUTER_ROAD });

  for (const r of out) {
    r.mid = (r.lo + r.hi) / 2;
    r.width = r.hi - r.lo;
  }
  ROADS_CACHE = out;
  return out;
}

// 좌표 v 가 든 도로. 인도·블록 위면 null.
export function roadAt(v) {
  for (const r of roads()) {
    if (v >= r.lo && v <= r.hi) return r;
  }
  return null;
}

function inRoad(v) {
  return roadAt(v) !== null;
}

// 한 축 위의 구간 [a, b] 가 차도와 겹치나.
//
// `roadAt` 은 **점 하나**만 본다. 물건은 폭이 있으므로 중심이 인도 위여도
// 몸통이 차도로 나갈 수 있다 — 실제로 홀로그램 표식이 중심은 멀쩡한데
// 0.47m 나가 있었고, 점 검사는 그걸 통과시켰다.
// 폭이 있는 것을 놓을 때는 이쪽을 쓴다.
export function spanInRoad(a, bb) {
  const lo = Math.min(a, bb);
  const hi = Math.max(a, bb);
  for (const r of roads()) {
    if (hi > r.lo && lo < r.hi) return true;
  }
  return false;
}

// 교차로 안인지 — 두 축이 모두 도로 띠 안.
export function onIntersection(x, z) {
  return inRoad(x) && inRoad(z);
}

// 격자선 좌표 목록 (도로 중심선). 바깥 경계 도로까지 GRID+1 개.
// 도로 중심선. 블록과 블록 사이이므로 구간 피치를 따라간다.
export function gridLines() {
  const out = [blockCenter(0) - blockPitch(0) / 2];
  for (let i = 0; i < GRID; i++) out.push(blockCenter(i) + blockPitch(i) / 2);
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
  // 스위치를 **여기서도** 봐야 한다.
  //
  // 골목을 끌 때 blockLots 만 껐더니, 이 함수는 계속 67개 골목 사각형을
  // 돌려주고 있었다. index.js 가 그걸 받아 골목 입구마다 땅을 비워 뒀으므로
  // **있지도 않은 골목 67곳 앞에서 가로등·시설물이 비켜서 있었다.**
  // 화면에는 "왠지 여기만 허전한 자리" 로만 나타나서 알아채기 어렵다.
  //
  // 같은 사실(골목이 있나)을 두 곳에서 따로 판단하면 반드시 이렇게 된다.
  ALLEY_CACHE = [];
  if (!ALLEYS_ON) return ALLEY_CACHE;
  for (let ix = 0; ix < GRID; ix++) {
    for (let iz = 0; iz < GRID; iz++) {
      const a = alleyFor(ix, iz, blockRect(ix, iz), alleyRateAt(ix, iz));
      if (a) ALLEY_CACHE.push({ ...a, ix, iz });
    }
  }
  return ALLEY_CACHE;
}

// 사각형에서 띠를 빼고 남은 조각들. 관통이면 둘, 막다른 골목이면 셋이 나온다.
//
// 남은 조각이 MIN 보다 얇으면 버린다 — 폭 4m 짜리 필지에 건물을 세우면
// 판자처럼 보이고, 그 판자가 골목 벽이 되면 두께가 없어 보인다.
// 사각형에서 띠 여럿을 빼낸다. 남은 조각들을 돌려준다.
//
// 띠가 십자로 만나면 조각이 넷이 된다 — 그 교차점이 광장이 되고, 사람은
// 늘 그런 자리에 모인다.
function subtractStrips(root, strips) {
  const MIN = 12; // 이보다 얇은 조각은 건물이 못 선다. 길에 흡수시킨다
  let parts = [root];
  for (const st of strips) {
    const next = [];
    for (const r of parts) {
      // 겹치지 않으면 그대로
      if (st.x1 <= r.x0 || st.x0 >= r.x1 || st.z1 <= r.z0 || st.z0 >= r.z1) {
        next.push(r);
        continue;
      }
      const alongZ = st.x1 - st.x0 < st.z1 - st.z0; // 세로로 긴 띠 = X 를 가른다
      if (alongZ) {
        if (st.x0 - r.x0 >= MIN) next.push({ ...r, x1: st.x0 });
        if (r.x1 - st.x1 >= MIN) next.push({ ...r, x0: st.x1 });
      } else {
        if (st.z0 - r.z0 >= MIN) next.push({ ...r, z1: st.z0 });
        if (r.z1 - st.z1 >= MIN) next.push({ ...r, z0: st.z1 });
      }
    }
    parts = next;
  }
  return parts;
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
// 건물이 설 수 있는 조각들 — 인도와 보행로를 뺀 나머지.
//
// blockLots 는 이것을 균등 목표 크기로 나누지만, 구역에 따라 **다르게**
// 나누고 싶을 수 있다. 번화가가 그렇다 — 시장 아케이드는 길어야 하고
// 유흥가는 좁아야 하는데, 균등하게 자르면 전부 같은 26m 정사각이 된다.
// 그래서 재료만 내주고 자르는 방식은 부르는 쪽에 맡긴다.
export function buildableSlabs(blk, D = null) {
  const root = blk.rect || blockRect(blk.ix, blk.iz);
  const walk = D?.sidewalk ?? SIDEWALK_W;
  const buildable = {
    x0: root.x0 + walk, x1: root.x1 - walk,
    z0: root.z0 + walk, z1: root.z1 - walk,
  };
  // 보행로는 완충을 두고 파낸다. 차양·돌출 간판은 필지 밖으로 나가므로
  // 길 폭 그대로 파내면 그것들이 길을 먹는다 (WALK_CLEAR 머리말).
  const walks = (blk.walks || []).map((g) => ({
    x0: g.rect.x0 - WALK_CLEAR, x1: g.rect.x1 + WALK_CLEAR,
    z0: g.rect.z0 - WALK_CLEAR, z1: g.rect.z1 + WALK_CLEAR,
  }));
  return walks.length ? subtractStrips(buildable, walks) : [buildable];
}

// 블록 하나를 필지들과 골목으로 나눈다.
//
// D 는 구역(district.js). 인도 폭·필지 잘기·골목 밀도를 구역이 정한다.
// 순환 참조를 피하려고 **인자로 받는다** — district.js 가 layout 의 상수를
// 쓰므로 layout 이 district 를 import 하면 순환이 된다.
export function blockLots(rng, blk, D = null) {
  const grain = D?.grain;

  // 골목 밀도는 구역이 정한다. 옛 alleyRate 를 그대로 쓴다 — 뜻이 같다
  // ("이 구역에 뒷길이 얼마나 흔한가"). 다만 이제 **벽이 아니라 틈**이다.
  const ar = (D?.alleyRate ?? 0) * 0.55;

  const lots = [];
  const gaps = [];
  for (const q of buildableSlabs(blk, D)) {
    const r2 = subdivideRect(rng, q, grain, ar);
    lots.push(...r2.lots);
    gaps.push(...r2.gaps);
  }
  return { lots, alleys: gaps };
}

// ── grain 은 깊이가 아니라 목표 크기다 ─────────────────────────────────────
//
// 원래 grain 은 **분할 횟수**였다. 블록이 언제나 66m 이던 시절에는 그래도
// 됐다 — 깊이 2 면 필지가 대략 33m 라고 셈이 섰다.
//
// 대지 병합이 들어오면서 그 가정이 깨졌다. 3x3 대지는 한 변이 266m 다.
// 거기에 깊이 0(기업)을 적용하면 **266m 짜리 필지 하나**가 나온다. 실제로
// 병합을 3x3 까지 늘린 직후 건물이 316 -> 168 채로 반토막 났고, 감사의
// 비율 지표가 그걸 잡았다 (건물당 사람 24.5 > 22).
//
// 이 프로젝트 단골 결함의 또 다른 얼굴이다: **한 값이 다른 값에서 파생되는데
// 그 관계가 코드에 안 적혀 있다.** 이제 구역은 "몇 번 자를까" 가 아니라
// "필지가 몇 미터였으면 좋겠나" 를 말한다. 대지가 커지면 자동으로 더 잘린다.
//
//   0 기업 110m — corpoCluster 가 이 안에서 다시 타워를 나눈다
//   1 공업  72m — 창고·공장동은 원래 크다
//   2 주거  48m — 슬래브 한 동
//   3 상업  32m — 적층 상가. 잘아야 골목 같은 밀도가 난다
//
// 처음에 130/90/62/40 으로 잡았다가 건물이 316 -> 137 채로 무너졌다.
// 원인은 **1칸 대지**다. 1칸의 건축 가능 폭은 66 - 인도 4.6x2 = 57m 인데
// 주거 목표가 62 면 round(57/62)=1, 즉 **한 번도 안 잘린다.** 전에는 같은
// 자리에서 4 필지가 나왔다. 목표를 필지 하나 크기로만 보고 **가장 작은
// 대지에서 몇 개가 나오는지**를 안 봤다.
const LOT_TARGET = [110, 72, 48, 32];

// ── 죽은 분기를 지웠다 (코드리뷰) ─────────────────────────────────────────
// 전에는 `grain === null` 이면 난수로 분할 깊이를 정하는 길이 따로 있었다.
// 그런데 구역 여섯이 전부 grain 을 정의하고 blockLots 의 호출자는 towers.js
// 하나뿐이라 **그 길은 한 번도 지나가지 않았다.**
//
// 더 나쁜 것은 그 길이 이제 고장나 있었다는 점이다. grain 을 목표 크기로
// 바꾸면서 `LOT_TARGET[Math.min(undefined, 3)]` = undefined 가 되고,
// splitToTarget 이 NaN 으로 나눈다. **아무도 안 부르는 코드라 안 터졌을 뿐**
// 이다. 지우고, 대신 grain 이 없으면 명확히 터뜨린다.
function subdivideRect(rng, root, grain, alleyRate = 0) {
  // 난수는 그대로 소비한다 — 소비를 건너뛰면 뒤의 모든 생성이 밀린다
  rng.next();
  if (typeof grain !== 'number') {
    throw new Error('subdivideRect: 구역이 grain 을 정해야 한다 (district.js)');
  }
  return splitToTarget(rng, root, LOT_TARGET[Math.min(grain, LOT_TARGET.length - 1)], alleyRate);
}

// 이보다 작으면 더 쪼개지 않는다.
//
// 17m 로 잡았을 때 근거는 "창 10칸 폭" 이었다. 창은 그것으로 충분했지만
// **건물로는 충분하지 않았다** — 17m 짜리가 즐비하니 도시가 기둥 밭이 됐다.
// 24m 는 사무소 한 채의 최소 정면에 가깝고, 66m 블록이 최대 두 필지로만
// 갈린다는 뜻이기도 하다.
const MIN_LOT = 24;

// 목표 크기에 맞춰 자른다.
//
// **이분할로 하면 안 된다.** 재귀로 반씩 자르면 결과가 target 과 target/2
// 사이를 널뛴다 — 148m 를 목표 62 로 자르면 74 에서 멈추거나 한 번 더
// 잘려 37 이 된다. 둘 다 62 가 아니다. 처음에 그렇게 짰다가 필지 수가
// 오히려 줄어드는 걸 보고 알았다.
//
// 축마다 자를 횟수를 **먼저 세고** 한 번에 나눈다. 그러면 결과가 언제나
// target 언저리에 모인다.
// ── 골목은 벽이 아니라 틈이다 (사용자 지시로 되살림) ──────────────────────
//
// "번화가 보행로 외에도 건물과 건물 사이에 조금씩은 골목이 있으면 좋겠음"
// "기존의 골목은 이상하게 생겼잖아. 잘 수정해"
//
// 옛 골목이 이상했던 이유는 벽이 **독립 구조물**이었기 때문이다. 필지 후퇴가
// 제각각이라 건물 옆면이 들쭉날쭉했고, 그래서 두께 0.35m 짜리 판을 따로
// 세웠다 — 공터에 선 골판지가 됐다.
//
// 그때 되살릴 조건을 하나 적어 뒀다:
//   "골목 벽이 독립 구조물이 아니라 **양옆 건물의 옆면**이어야 한다."
//
// **그 조건이 지금 충족된다.** splitToTarget 은 잘린 자리를 공유하는 필지를
// 만들고, marketPlan 은 띠를 나란히 놓는다. 인접 필지의 벽면이 이미 맞춰져
// 있다 (실측: 간격 중앙값 1.5m).
//
// 그러니 벽을 세우지 않는다. **자른 자리를 조금 더 벌리기만 한다.**
// 벽은 양옆 건물이 이미 갖고 있다.
const ALLEY_GAP = [3.4, 5.2];

function splitToTarget(rng, r, target, alleyRate = 0) {
  const nx = Math.max(1, Math.round((r.x1 - r.x0) / target));
  const nz = Math.max(1, Math.round((r.z1 - r.z0) / target));
  if (nx === 1 && nz === 1) return { lots: [r], gaps: [] };

  // 경계선을 흔든다. 균등 격자로 자르면 필지가 전부 같은 크기가 되고,
  // 그러면 밀도의 인상("큰 것 옆에 작은 것")이 안 나온다.
  const cuts = (lo, hi, n) => {
    const out = [lo];
    for (let i = 1; i < n; i++) {
      const even = lo + ((hi - lo) * i) / n;
      out.push(even + ((hi - lo) / n) * rng.range(-0.18, 0.18));
    }
    out.push(hi);
    return out;
  };
  const xs = cuts(r.x0, r.x1, nx);
  const zs = cuts(r.z0, r.z1, nz);

  // 어느 자른 자리를 골목으로 벌릴까. 안쪽 경계만 후보다 —
  // 바깥 경계를 벌리면 골목이 아니라 그냥 물러선 건물이다.
  const gapAt = (n) => {
    const g = new Array(n + 1).fill(0);
    for (let i = 1; i < n; i++) if (rng.chance(alleyRate)) g[i] = rng.range(ALLEY_GAP[0], ALLEY_GAP[1]);
    return g;
  };
  const gx = gapAt(nx);
  const gz = gapAt(nz);

  const gaps = [];
  const out = [];
  for (let i = 0; i < nx; i++) {
    for (let j = 0; j < nz; j++) {
      const lot = {
        x0: xs[i] + gx[i] / 2, x1: xs[i + 1] - gx[i + 1] / 2,
        z0: zs[j] + gz[j] / 2, z1: zs[j + 1] - gz[j + 1] / 2,
      };
      // MIN_LOT 아래는 버리지 않고 옆에 붙인다. 버리면 대지에 구멍이 난다.
      if (lot.x1 - lot.x0 < MIN_LOT * 0.7 || lot.z1 - lot.z0 < MIN_LOT * 0.7) continue;
      out.push(lot);
    }
  }
  // 벌린 자리를 골목으로 신고한다. 벽은 안 세운다 — 양옆 건물이 갖고 있다.
  for (let i = 1; i < nx; i++) {
    if (gx[i] < 1) continue;
    gaps.push({ alongX: false, rect: { x0: xs[i] - gx[i] / 2, x1: xs[i] + gx[i] / 2, z0: r.z0, z1: r.z1 }, w: gx[i] });
  }
  for (let j = 1; j < nz; j++) {
    if (gz[j] < 1) continue;
    gaps.push({ alongX: true, rect: { x0: r.x0, x1: r.x1, z0: zs[j] - gz[j] / 2, z1: zs[j] + gz[j] / 2 }, w: gz[j] });
  }
  return out.length ? { lots: out, gaps } : { lots: [r], gaps: [] };
}

// 게으른 캐시라 지금까지 아무도 안 비웠고, 씬이 하나뿐이라 굴러갔다.
// 격자·구역 정의가 바뀌거나 씬이 늘면 조용히 옛 값을 돌려준다.
onSceneReset('격자 캐시', () => { ROADS_CACHE = null; ALLEY_CACHE = null; RATE_HOOK = null; });
