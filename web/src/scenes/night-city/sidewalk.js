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
import { parcels, blockRect, roadOpen, roadOpenZ } from './parcel.js';
import { coreDistance } from './layout.js';
import {
  GRID,
  CITY_HALF,
  CURB_HEIGHT,
  SIDEWALK_W,
  blockCenter,
  roads,
  onIntersection,
} from './layout.js';

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

  for (const p of parcels()) {
    {
      const R = p.rect;
      const cx = (R.x0 + R.x1) / 2;
      const cz = (R.z0 + R.z1) / 2;

      for (const [dx, dz] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) {
        const alongX = dx === 0;
        const len = alongX ? R.x1 - R.x0 : R.z1 - R.z0;
        const h = alongX ? (R.z1 - R.z0) / 2 : (R.x1 - R.x0) / 2;
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
  for (const p of parcels()) {
    {
      const R = p.rect;
      const cx = (R.x0 + R.x1) / 2;
      const cz = (R.z0 + R.z1) / 2;
      const h = (R.x1 - R.x0) / 2 + 0.7;
      const halfLen = (R.x1 - R.x0) / 2;

      for (let t = -halfLen + STEP / 2; t < halfLen; t += STEP) {
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
  // 연석에서 인도 안쪽으로. 0 이면 연석 마감선과 겹친다.
  // 격자선에서 재지 않는다 — 구간 경계에서 도로가 비대칭이라 한쪽이 어긋난다.
  const BACK = 0.75;
  const SIDE = 2.2;

  roads().forEach((rx, xi) => {
    if (Math.abs(rx.mid) > CITY_HALF) return;
    roads().forEach((rz, zi) => {
      if (Math.abs(rz.mid) > CITY_HALF) return;
      if (!roadOpen(xi, rz.mid) || !roadOpenZ(zi, rx.mid)) return;
      // 교차로의 네 귀퉁이. 각 귀퉁이에서 두 방향 횡단보도를 마주본다.
      for (const ex of [[rx.lo - SIDE, rx.lo - BACK], [rx.hi + SIDE, rx.hi + BACK]]) {
        for (const ez of [[rz.lo - SIDE, rz.lo - BACK], [rz.hi + SIDE, rz.hi + BACK]]) {
          // (a) X 방향으로 건너가는 횡단보도 앞 — 연석은 z 축에 평행
          if (claim(ex[0], ez[1], 1.6, TIER.SAFETY, 'tactile')) {
            b.add(upPlane(W, D, [ex[0], ON_WALK + 0.001, ez[1]]), mats.tactileMat);
          }
          // (b) Z 방향으로 건너가는 횡단보도 앞
          if (claim(ex[1], ez[0], 1.6, TIER.SAFETY, 'tactile')) {
            b.add(upPlane(D, W, [ex[1], ON_WALK + 0.001, ez[0]]), mats.tactileMat);
          }
        }
      }
    });
  });
}

// ── 맨홀 · 점검구 ──────────────────────────────────────────────────────────
//
// 위치가 불규칙해야 하는 것들. 텍스처에 그리면 6m 마다 격자로 늘어선다.
// 좌표를 난수로 뽑되 도로와 인도에 나눠 뿌린다.
function covers(b, rng, mats) {
  // 차도의 맨홀 — 차선 사이에 앉는다. 도로 폭이 구간마다 다르므로
  // 그 도로의 실제 반폭에 비례해 흩는다 (8m 짜리 길에 ±6.6m 로 뿌리면
  // 인도 밑으로 들어간다).
  roads().forEach((r, bi) => {
    const spread = (r.width / 2) * 0.6;
    for (let t = -GRID * 44 + 18; t < GRID * 44; t += rng.range(26, 52)) {
      if (onIntersection(t, r.mid)) continue;
      const off = rng.range(-spread, spread);
      if (roadOpenZ(bi, t)) b.cylinder(0.42, 0.42, 0.04, [t, ON_ROAD + 0.02, r.mid + off], mats.manholeMat, 10);
      if (roadOpen(bi, t)) b.cylinder(0.42, 0.42, 0.04, [r.mid + off, ON_ROAD + 0.02, t], mats.manholeMat, 10);
    }
  });

  // 인도의 점검구 — 사각형. 맨홀(원형)과 형태를 달리해야 둘 다 눈에 띈다.
  for (const p of parcels()) {
    {
      const ix = p.ix, iz = p.iz;
      const R = p.rect;
      const cx = (R.x0 + R.x1) / 2;
      const cz = (R.z0 + R.z1) / 2;
      const h = (R.x1 - R.x0) / 2;
      const n = rng.int(4, 9);
      for (let i = 0; i < n; i++) {
        // 인도 띠 안에서만 — 안쪽은 건물이다
        const side = rng.int(0, 3);
        const along = rng.range(-h + 4, h - 4);
        // 인도 폭은 구역이 정한다. 전역을 쓰면 좁은 구역(공업 3.2m)에서
        // 점검구가 차도나 건물 밑으로 나간다 (towers.streetFaces 와 같은 실수).
        const walk = districtAt(ix, iz).sidewalk ?? SIDEWALK_W;
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
  // 물은 측구(도로 가장자리)에 고인다. 도로 반폭의 55~92% 지점 — 폭이
  // 구간마다 다르므로 그 도로의 반폭을 쓴다.
  roads().forEach((r, bi) => {
    const half = r.width / 2;
    for (let t = -GRID * 44; t < GRID * 44; t += rng.range(14, 34)) {
      if (onIntersection(t, r.mid)) continue;
      const s = rng.chance(0.5) ? 1 : -1;
      const off = s * rng.range(half * 0.55, half * 0.92);
      const w = rng.range(2.4, 6.5);
      const d = rng.range(1.2, 3.0);
      if (roadOpenZ(bi, t)) b.add(upPlane(w, d, [t, ON_ROAD + 0.003, r.mid + off]), mats.puddleMat);
      if (roadOpen(bi, t)) b.add(upPlane(d, w, [r.mid + off, ON_ROAD + 0.003, t]), mats.puddleMat);
    }
  });
}

export function dressSidewalks(b, rng, mats) {
  curbLines(b, mats);
  drains(b, mats);
  tactile(b, mats);
  covers(b, rng, mats);
  puddles(b, rng, mats);
}
