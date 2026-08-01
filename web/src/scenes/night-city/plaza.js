// 광장 — **격자가 아니라 광장이 먼저다.**
//
// ── 왜 블록에 맞추지 않는가 (사용자 지시) ─────────────────────────────────
// "필지에 맞춰서 광장을 구성하지 말고, 적절한 크기의 광장이 들어선 다음
//  차선과 도로, 주변 건물들의 배치를 뜯어고치는 방식으로 가야지 맞을 것"
//
// 맞다. 그리고 이 코드에서는 그게 **유일하게 성립하는 방식**이다.
//
// `BLOCK_SIZE` 는 66 으로 고정이고 도로는 "판 사이에 남은 공간" 이다
// (layout.roads 머리말). 즉 **블록을 크게 만드는 수단이 아예 없다** — 피치를
// 키우면 블록이 아니라 도로가 넓어진다. 그러니 "블록에 광장을 맞춘다" 는
// 매립 차수 서사에서 나온 66 이라는 남의 숫자를 광장 치수로 받아 적는 것이다.
// 광장의 크기는 담을 것이 정해야 한다.
//
// ── 치수는 담을 것에서 역산한다 ───────────────────────────────────────────
//
//     18 ─────────── 88 ─────────── 18       (X, 합 124)
//     │                              │
//    상가         열린 광장          상가
//
//   상가 18   네 변을 두르는 얕은 상가. **이것이 광장의 벽이다**
//   안뜰 46x42 가운데. 앉는 턱으로 두른다
//   십자 팔 51/30  상가가 끊긴 자리의 폭. 그 틈으로 사람이 들어온다.
//                  남북 팔은 대문이 통째로 들어가야 하므로 폭을 대문이 정한다
//
// ── 처음에 틀렸던 것 ──────────────────────────────────────────────────────
// 처음에는 상가를 **광장 안에 섬 넷**으로 놓았다. 위에서 보니 광장이 아니라
// "네모 넷과 그 사이 틈" 이었다. 레퍼런스를 다시 보니 답이 있었다 —
// 폴로니안 몰은 상가가 **벽**이고 가운데가 통째로 비어 있다.
//
// 광장은 비어 있는 곳이 아니라 **둘러싸인 곳**이다. 그 둘을 바꿔 놓으면
// 아무리 크게 만들어도 공터로 읽힌다.
//
// ── 폭은 설계값이고 깊이는 파생값이다 ─────────────────────────────────────
// X 는 자유롭다 — 대문 축을 중심으로 좌우 대칭이면 된다. 그래서 124 는 위
// 표에서 나온 **설계 숫자**다.
// Z 는 자유롭지 않다. 남단은 대문 앞마당이 끝나는 자리, 북단은 다음 블록의
// 연석이다. 둘 다 이미 도시가 정해 둔 값이므로 **여기서 계산하지 않고 받아
// 온다.** 같은 값을 두 곳에서 계산하는 것이 이 프로젝트가 스무 번 넘게 틀린
// 그 유형이다 (docs/status.md 2.1).
//
// ── 무엇이 양보하는가 ─────────────────────────────────────────────────────
//   도로 네 토막   전부 닫힌다 (parcel.roadOpen → traffic 까지)
//   블록 (3,5)     통째로 광장 바닥
//   ix2 동쪽 14m   인도 + 필지 앞부분. 그 대지는 광장 쪽으로 물러선다
//   ix4 서쪽 7m    연석과 인도
//
// 마지막 둘이 요점이다. 광장이 블록 경계를 **넘어서** 잘라 들어가고, 잘린
// 대지는 광장에 앞면을 내준다. 블록에 맞췄다면 절대 생기지 않을 관계다.
import { BLOCK_SIZE, GRID, blockCenter, blockRect } from './layout.js';
import { LANDMARK_BLOCKS, GATE_SPAN } from './landmark.js';

// 광장 절반 폭. **이 파일에서 유일한 자유 숫자다.**
const HALF_W = 62;

// 위 그림이 그대로 숫자가 된다.
const ARCADE = 18; // 네 변을 두르는 상가의 깊이 — 광장의 벽
// 남북 팔은 대문이 통째로 들어갈 만큼 넓어야 한다. 문 폭을 여기 다시 적으면
// 문을 키우는 순간 상가와 겹친다 (landmark.GATE_SPAN 머리말).
const ARM_X = GATE_SPAN + 4;
const ARM_Z = 30;  // 동서 팔 (Z 로 잰다)
const COURT_X = 46; // 안뜰 — 턱으로 두르는 가운데
const COURT_Z = 42;
// 상가 네 토막이 모서리에서 만나면 서로의 차양·주랑이 겹친다. 모서리를
// 열어 두면 겹침이 사라지고, 덤으로 **모서리 출입구**가 생긴다.
const CORNER = 6;
// 상가를 광장 경계에서 이만큼 물린다. 도시의 모든 건물이 인도만큼 물러서
// 있는데(SIDEWALK_W 4.6) 광장 상가만 경계선에 붙어 있으면, 차양과 돌출
// 간판이 그대로 이웃 대지의 보행로를 덮는다 — 실제로 16m 짜리 길 하나를
// 통째로 먹었다.
const SETBACK = 4;

// ── 축은 대문이 정한다 ────────────────────────────────────────────────────
//
// 대문(landmark 'gate') 이 axis 'z' 로 서 있고 그 북쪽이 광장이다. 축 인덱스를
// 여기 3 이라고 다시 적으면 대문을 옮기는 순간 광장만 제자리에 남는다.
// **대문 목록에서 읽어 온다.**
const GATE = LANDMARK_BLOCKS.find((l) => l.kind === 'gate');
if (!GATE) throw new Error('plaza: 대문(gate) 랜드마크가 없다 — 광장의 축이 없다');

const AXIS_IX = GATE.ix;   // 남북 팔이 서는 열
const SOUTH_IZ = GATE.iz;         // 대문 블록. 그 **북쪽 연석**이 광장 남단이다
const NORTH_IZ = GATE.iz + 2;     // 광장이 앉는 칸(+1) 의 다음 칸. 그 **남쪽 연석**이 북단

// 광장이 앉는 대표 칸. 대문 바로 북쪽이다.
export const PLAZA_IX = AXIS_IX;
export const PLAZA_IZ = GATE.iz + 1;

// ── 광장 사각형 ───────────────────────────────────────────────────────────
export const PLAZA = (() => {
  const cx = blockCenter(AXIS_IX);
  // 남·북단은 **blockRect 에서 받는다.** BLOCK_SIZE/2 를 여기서 다시 더하면
  // 판 크기가 바뀔 때 광장만 따라오지 않는다 (layout.blockRect 머리말).
  const south = blockRect(AXIS_IX, SOUTH_IZ).z1; // 대문 블록의 북쪽 연석
  const north = blockRect(AXIS_IX, NORTH_IZ).z0; // 그 다음 블록의 남쪽 연석
  const r = { x0: cx - HALF_W, x1: cx + HALF_W, z0: south, z1: north };
  r.cx = cx;
  r.cz = (r.z0 + r.z1) / 2;
  r.w = r.x1 - r.x0;
  r.d = r.z1 - r.z0;
  return r;
})();

// 상가 둘 + 안뜰이 안 들어가면 그림이 성립하지 않는다. 격자를 바꾸다가
// 조용히 뭉개지는 것을 막는다 — 랜드마크 fitsBlock 과 같은 이유.
{
  const WALK_MIN = 10; // 상가 앞과 안뜰 사이에 최소 이만큼은 걸을 수 있어야 한다
  const BAND = (SETBACK + ARCADE) * 2;
  if (PLAZA.w < BAND + COURT_X + WALK_MIN * 2) {
    throw new Error(`plaza: 폭 ${PLAZA.w.toFixed(1)}m 가 좁다 — HALF_W 를 키울 것`);
  }
  if (PLAZA.d < BAND + COURT_Z + WALK_MIN * 2) {
    throw new Error(`plaza: 깊이 ${PLAZA.d.toFixed(1)}m 로는 안뜰이 안 들어간다`);
  }
  // 상가 토막이 점포 한 줄도 못 담을 만큼 짧아지면 벽이 아니라 기둥이 된다.
  if ((PLAZA.d - BAND - ARM_Z) / 2 - CORNER < 12) {
    throw new Error('plaza: 동서 상가 토막이 12m 미만 — ARM_Z 나 CORNER 를 줄일 것');
  }
  if ((PLAZA.w - ARM_X) / 2 - SETBACK < 12) {
    throw new Error('plaza: 남북 상가 토막이 12m 미만 — 대문이 광장보다 넓다');
  }
}

// 상가가 앉는 자리 — 광장 경계에서 SETBACK 만큼 물러난 사각형.
const OUTER = {
  x0: PLAZA.x0 + SETBACK, x1: PLAZA.x1 - SETBACK,
  z0: PLAZA.z0 + SETBACK, z1: PLAZA.z1 - SETBACK,
};

// 상가 안쪽 — 열린 광장 전체.
export const INNER = {
  x0: OUTER.x0 + ARCADE, x1: OUTER.x1 - ARCADE,
  z0: OUTER.z0 + ARCADE, z1: OUTER.z1 - ARCADE,
};

// ── 십자 팔 ───────────────────────────────────────────────────────────────
//
// 남북 팔은 **대문 축 위**에 있다. 광장이 X 대칭이므로 PLAZA.cx 와 같지만,
// 같아 보이는 두 값을 각자 계산하지 않고 축에서 한 번만 만든다.
// 팔은 상가를 뚫고 **광장 밖까지** 나간다 — 그게 출입구다.
export const ARMS = {
  ns: { x0: PLAZA.cx - ARM_X / 2, x1: PLAZA.cx + ARM_X / 2, z0: PLAZA.z0, z1: PLAZA.z1 },
  ew: { x0: PLAZA.x0, x1: PLAZA.x1, z0: PLAZA.cz - ARM_Z / 2, z1: PLAZA.cz + ARM_Z / 2 },
};

// 안뜰. 수경이 여기 앉는다. 십자 교차점과 중심이 같지만 **더 넓다** —
// 팔은 지나가는 곳이고 여기는 머무는 곳이라 폭이 다를 이유가 있다.
export const CROSSING = {
  x0: PLAZA.cx - COURT_X / 2, x1: PLAZA.cx + COURT_X / 2,
  z0: PLAZA.cz - COURT_Z / 2, z1: PLAZA.cz + COURT_Z / 2,
};

// ── 상가 (광장의 벽) ──────────────────────────────────────────────────────
//
// 네 변에 두르되 십자 팔이 나가는 자리에서 끊긴다. 그래서 여덟 토막이다.
// 좌표를 따로 적지 않는다 — 변과 팔의 **뺄셈**으로 나온다.
export function arcadeBars() {
  const P = OUTER; // **광장 경계가 아니라 물러난 자리다** (SETBACK 머리말)
  const A = ARCADE;
  const out = [];
  // 남·북 — 팔이 X 로 끊는다
  for (const [z0, z1, side] of [[P.z0, P.z0 + A, 'S'], [P.z1 - A, P.z1, 'N']]) {
    out.push({ x0: P.x0, x1: ARMS.ns.x0, z0, z1, side, half: 'w' });
    out.push({ x0: ARMS.ns.x1, x1: P.x1, z0, z1, side, half: 'e' });
  }
  // 동·서 — 팔이 Z 로 끊는다. 남북 상가가 이미 먹은 만큼, 그리고 모서리
  // 틈만큼 더 안쪽에서 시작한다
  for (const [x0, x1, side] of [[P.x0, P.x0 + A, 'W'], [P.x1 - A, P.x1, 'E']]) {
    out.push({ x0, x1, z0: P.z0 + A + CORNER, z1: ARMS.ew.z0, side, half: 's' });
    out.push({ x0, x1, z0: ARMS.ew.z1, z1: P.z1 - A - CORNER, side, half: 'n' });
  }
  return out;
}

// ── 판정 ──────────────────────────────────────────────────────────────────

export function inPlaza(x, z) {
  return x >= PLAZA.x0 && x <= PLAZA.x1 && z >= PLAZA.z0 && z <= PLAZA.z1;
}

// 폭이 있는 것을 놓을 때. `inPlaza` 는 점 하나만 본다 (layout.spanInRoad 와 같은 이유).
export function plazaHits(rect) {
  return rect.x1 > PLAZA.x0 && rect.x0 < PLAZA.x1 && rect.z1 > PLAZA.z0 && rect.z0 < PLAZA.z1;
}

// 사각형에서 광장과 겹친 부분을 **잘라 낸다.** 잘려서 남은 것이 없으면 null.
//
// 광장이 블록 경계를 넘어 들어가므로 이웃 대지는 앞부분을 잃는다. 그 대지가
// 건물을 어디까지 지을 수 있는지는 여기 하나가 답한다.
export function clipToPlaza(rect) {
  if (!plazaHits(rect)) return rect;
  // 한 축으로만 물러설 수 있다. 광장이 더 깊이 파고든 축을 남기고 그쪽을 자른다.
  const cutW = Math.min(rect.x1, PLAZA.x1) - Math.max(rect.x0, PLAZA.x0);
  const cutD = Math.min(rect.z1, PLAZA.z1) - Math.max(rect.z0, PLAZA.z0);
  const r = { ...rect };
  if (cutW < cutD) {
    // X 로 얕게 물렸다 — X 를 자른다
    if (rect.x0 < PLAZA.x0) r.x1 = Math.min(r.x1, PLAZA.x0);
    else r.x0 = Math.max(r.x0, PLAZA.x1);
  } else {
    if (rect.z0 < PLAZA.z0) r.z1 = Math.min(r.z1, PLAZA.z0);
    else r.z0 = Math.max(r.z0, PLAZA.z1);
  }
  if (r.x1 - r.x0 < 6 || r.z1 - r.z0 < 6) return null;
  return r;
}

// ── 광장이 건드리는 칸 ────────────────────────────────────────────────────
//
// 대지 병합이 광장을 가로질러 묶으면 손으로 정한 것이 무시된다 (parcel.RESERVED
// 가 랜드마크·통로에 대해 하는 일과 같다). 넓이가 실제로 겹치는 칸만 센다 —
// 연석에 스치기만 한 칸까지 잡으면 멀쩡한 블록이 병합에서 빠진다.
let CELLS = null;
export function plazaCells() {
  if (CELLS) return CELLS;
  CELLS = [];
  for (let iz = 0; iz < GRID; iz++) {
    for (let ix = 0; ix < GRID; ix++) {
      const r = blockRect(ix, iz);
      const w = Math.min(r.x1, PLAZA.x1) - Math.max(r.x0, PLAZA.x0);
      const d = Math.min(r.z1, PLAZA.z1) - Math.max(r.z0, PLAZA.z0);
      if (w > 1 && d > 1) CELLS.push([ix, iz, (w * d) / (BLOCK_SIZE * BLOCK_SIZE)]);
    }
  }
  return CELLS;
}

// 광장이 **판을 통째로** 먹은 칸. 여기는 건물이 아니라 광장을 짓는다.
export function isPlazaBlock(ix, iz) {
  const c = plazaCells().find((e) => e[0] === ix && e[1] === iz);
  return !!c && c[2] > 0.9;
}

// 진단용.
export function plazaTally() {
  return {
    크기: `${PLAZA.w.toFixed(0)} x ${PLAZA.d.toFixed(0)}`,
    중심: `${PLAZA.cx.toFixed(0)}, ${PLAZA.cz.toFixed(0)}`,
    축: `대문 ix${AXIS_IX}`,
    닿은칸: plazaCells().map(([ix, iz, f]) => `${ix},${iz}(${(f * 100).toFixed(0)}%)`).join(' '),
  };
}
