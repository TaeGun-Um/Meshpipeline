// 인도 마감 — 보도블록 판 위에 올라가는 것들.
//
// ── 왜 필요한가 ────────────────────────────────────────────────────────────
// 인도 폭을 4.6m 확보하고 나니 이번에는 **넓고 텅 빈 회색 띠**가 됐다.
// 실제 도시의 인도가 인도로 보이는 이유는 폭이 아니라 그 위에 있는 것들이다.
//
// 눈높이에서 화면의 아래 1/3 은 거의 항상 인도다. 여기가 비면 아무리 위쪽을
// 잘 만들어도 "바닥이 안 된" 인상이 남는다.
//
// ── 무엇을 넣는가 ──────────────────────────────────────────────────────────
// 실제 인도에서 눈에 띄는 순서대로 골랐다. 전부 평평한 판이라 값이 싸다.
//
//   1) 연석 마감선   차도와 인도의 경계. 이게 없으면 두 면이 그냥 이어져 보인다.
//   2) 측구(側溝)     연석 옆 차도의 어둡고 젖은 띠. 비 오는 도시의 핵심 디테일.
//   3) 배수구        측구를 따라 일정 간격. 물이 어디로 가는지가 보인다.
//   4) 점자블록      횡단보도 앞의 노란 띠. 색이 강해서 멀리서도 읽힌다.
//   5) 맨홀·점검구   차도와 인도에 흩뿌린다. 노면이 균질하지 않게 만든다.
//
// ── 왜 지오메트리인가 (텍스처가 아니라) ────────────────────────────────────
// 이것들을 보도블록 텍스처에 그려 넣으면 타일링 때문에 **일정 간격으로 반복**
// 된다. 맨홀이 6m 마다 격자로 늘어서면 그게 더 이상하다. 위치가 불규칙해야
// 하는 것은 지오메트리로 놓는다.
import { upPlane } from '../../core/boxfaces.js';
import { claim, TIER } from './siteplan.js';
import { districtAt } from './district.js';
import { coreDistance } from './layout.js';
import {
  GRID,
  CITY_HALF,
  BLOCK_SIZE,
  STREET_WIDTH,
  CURB_HEIGHT,
  SIDEWALK_W,
  blockCenter,
  gridLines,
  onIntersection,
} from './layout.js';

const HALF_ROAD = STREET_WIDTH / 2;
// 판 위 2cm. 보도블록과 같은 높이에 두면 Z-파이팅이 난다.
const ON_WALK = CURB_HEIGHT + 0.02;
const ON_ROAD = 0.02;

// ── 연석 마감선과 측구 ─────────────────────────────────────────────────────
//
// 블록 가장자리를 따라 두 줄을 깐다. 밝은 마감선은 인도 쪽, 어두운 측구는
// 차도 쪽. 이 두 줄이 나란히 있어야 "단이 있다" 는 것이 읽힌다.
function curbLines(b, mats) {
  const EDGE = 0.5; // 마감선 폭
  const GUT = 1.1; // 측구 폭

  for (let ix = 0; ix < GRID; ix++) {
    for (let iz = 0; iz < GRID; iz++) {
      const cx = blockCenter(ix);
      const cz = blockCenter(iz);
      const h = BLOCK_SIZE / 2;

      for (const [dx, dz] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) {
        const alongX = dx === 0;
        const len = BLOCK_SIZE;
        // 인도 쪽 마감선 — 블록 경계에서 안쪽으로 EDGE/2
        const ex = cx + dx * (h - EDGE / 2);
        const ez = cz + dz * (h - EDGE / 2);
        b.add(
          upPlane(alongX ? len : EDGE, alongX ? EDGE : len, [ex, ON_WALK, ez]),
          mats.curbEdgeMat
        );
        // 차도 쪽 측구 — 블록 경계 바깥
        const gx = cx + dx * (h + GUT / 2);
        const gz = cz + dz * (h + GUT / 2);
        b.add(
          upPlane(alongX ? len : GUT, alongX ? GUT : len, [gx, ON_ROAD, gz]),
          mats.gutterMat
        );
      }
    }
  }
}

// ── 배수구 ─────────────────────────────────────────────────────────────────
//
// 측구를 따라 일정 간격으로. 이건 규칙적이어도 된다 — 실제 배수구도
// 도로 설계에 따라 등간격이다.
function drains(b, mats) {
  const STEP = 22;
  for (let ix = 0; ix < GRID; ix++) {
    for (let iz = 0; iz < GRID; iz++) {
      const cx = blockCenter(ix);
      const cz = blockCenter(iz);
      const h = BLOCK_SIZE / 2 + 0.7;

      for (let t = -BLOCK_SIZE / 2 + STEP / 2; t < BLOCK_SIZE / 2; t += STEP) {
        for (const s of [-1, 1]) {
          b.add(upPlane(1.0, 0.42, [cx + t, ON_ROAD + 0.001, cz + s * h]), mats.drainMat);
          b.add(upPlane(0.42, 1.0, [cx + s * h, ON_ROAD + 0.001, cz + t]), mats.drainMat);
        }
      }
    }
  }
}

// ── 점자블록 ───────────────────────────────────────────────────────────────
//
// ── 왜 다시 만들었나 ───────────────────────────────────────────────────────
// 처음에는 블록 네 변의 양 끝에 큰 사각형으로 깔았다. 위치가 **횡단보도와
// 아무 관계가 없었고**, 계단이 그 위로 내려앉기도 했다.
//
// 점자블록의 위치는 디자인이 아니라 기능이다. 시각장애인이 발로 밟아
// **여기서 차도로 내려선다**는 것을 아는 지점이라, 반드시 횡단보도 바로
// 뒤 연석에 붙어야 하고 횡단보도와 정렬돼야 한다. 아무 데나 깔면 오히려
// 위험한 안내가 된다.
//
// 그래서 블록이 아니라 **교차로**를 기준으로 돈다. 횡단보도가 어디 있는지를
// 알고 그 앞에만 깐다.
//
// 계획 등급은 SAFETY(4) 다. 계단 착지점(VERTICAL=3)이 이미 차지한 자리에는
// 깔지 않는다 — 계단이 점자블록을 밟고 서는 일이 실제로 있었다.
function tactile(b, mats) {
  const W = 2.4;  // 폭 — 횡단보도 띠(2.6m) 와 맞춘다
  const D = 0.7;  // 깊이
  const lines = gridLines();
  // 연석에서 안쪽으로. 0 이면 연석 마감선과 겹친다.
  const back = HALF_ROAD + 0.75;

  for (const cx of lines) {
    for (const cz of lines) {
      if (Math.abs(cx) > CITY_HALF || Math.abs(cz) > CITY_HALF) continue;
      // 교차로의 네 귀퉁이. 각 귀퉁이에서 두 방향 횡단보도를 마주본다.
      for (const sx of [-1, 1]) {
        for (const sz of [-1, 1]) {
          // (a) X 방향으로 건너가는 횡단보도 앞 — 연석은 z 축에 평행
          const ax = cx + sx * (HALF_ROAD + 2.2);
          const az = cz + sz * back;
          if (claim(ax, az, 1.6, TIER.SAFETY, 'tactile')) {
            b.add(upPlane(W, D, [ax, ON_WALK + 0.001, az]), mats.tactileMat);
          }
          // (b) Z 방향으로 건너가는 횡단보도 앞
          const bx = cx + sx * back;
          const bz = cz + sz * (HALF_ROAD + 2.2);
          if (claim(bx, bz, 1.6, TIER.SAFETY, 'tactile')) {
            b.add(upPlane(D, W, [bx, ON_WALK + 0.001, bz]), mats.tactileMat);
          }
        }
      }
    }
  }
}

// ── 맨홀 · 점검구 ──────────────────────────────────────────────────────────
//
// 위치가 불규칙해야 하는 것들. 텍스처에 그리면 6m 마다 격자로 늘어선다.
// 좌표를 난수로 뽑되 도로와 인도에 나눠 뿌린다.
function covers(b, rng, mats) {
  const lines = gridLines();
  // 차도의 맨홀 — 차선 사이에 앉는다
  for (const c of lines) {
    for (let t = -GRID * 44 + 18; t < GRID * 44; t += rng.range(26, 52)) {
      if (onIntersection(t, c)) continue;
      const off = rng.range(-HALF_ROAD * 0.6, HALF_ROAD * 0.6);
      b.cylinder(0.42, 0.42, 0.04, [t, ON_ROAD + 0.02, c + off], mats.manholeMat, 10);
      b.cylinder(0.42, 0.42, 0.04, [c + off, ON_ROAD + 0.02, t], mats.manholeMat, 10);
    }
  }

  // 인도의 점검구 — 사각형. 맨홀(원형)과 형태를 달리해야 둘 다 눈에 띈다.
  for (let ix = 0; ix < GRID; ix++) {
    for (let iz = 0; iz < GRID; iz++) {
      const cx = blockCenter(ix);
      const cz = blockCenter(iz);
      const h = BLOCK_SIZE / 2;
      const n = rng.int(4, 9);
      for (let i = 0; i < n; i++) {
        // 인도 띠 안에서만 — 안쪽은 건물이다
        const side = rng.int(0, 3);
        const along = rng.range(-h + 4, h - 4);
        // 인도 폭은 구역이 정한다. 전역을 쓰면 좁은 구역(공업 3.2m)에서
        // 점검구가 차도나 건물 밑으로 나간다 (towers.streetFaces 와 같은 실수).
        const walk = districtAt(ix, iz, coreDistance(cx, cz)).sidewalk ?? SIDEWALK_W;
        const depth = rng.range(0.7, Math.max(1.0, walk - 0.9));
        const w = rng.range(0.6, 1.1);
        const d = rng.range(0.5, 0.9);
        const px = side === 0 ? cx + along : side === 1 ? cx + along : cx + (side === 2 ? -1 : 1) * (h - depth);
        const pz = side === 0 ? cz - (h - depth) : side === 1 ? cz + (h - depth) : cz + along;
        // 점검구도 계획을 따른다. 계단 밑·점자블록 위에 깔리면 안 된다.
        if (!claim(px, pz, Math.max(w, d) / 2, TIER.GROUND, 'hatch')) continue;
        b.add(upPlane(w, d, [px, ON_WALK + 0.002, pz]), mats.hatchMat);
      }
    }
  }
}

// 젖은 자국 — 측구 근처에 고인 물. 비 오는 도시라 노면이 균질하면 안 된다.
function puddles(b, rng, mats) {
  const lines = gridLines();
  for (const c of lines) {
    for (let t = -GRID * 44; t < GRID * 44; t += rng.range(14, 34)) {
      if (onIntersection(t, c)) continue;
      const s = rng.chance(0.5) ? 1 : -1;
      const off = s * rng.range(HALF_ROAD * 0.55, HALF_ROAD * 0.92);
      const w = rng.range(2.4, 6.5);
      const d = rng.range(1.2, 3.0);
      b.add(upPlane(w, d, [t, ON_ROAD + 0.003, c + off]), mats.puddleMat);
      b.add(upPlane(d, w, [c + off, ON_ROAD + 0.003, t]), mats.puddleMat);
    }
  }
}

export function dressSidewalks(b, rng, mats) {
  curbLines(b, mats);
  drains(b, mats);
  tactile(b, mats);
  covers(b, rng, mats);
  puddles(b, rng, mats);
}
