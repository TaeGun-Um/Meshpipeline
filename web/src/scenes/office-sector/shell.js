// 껍데기 — 바닥·벽·천장.
//
// ── 도시와 무엇이 다른가 ───────────────────────────────────────────────────
// 도시는 상자를 세우고 겉면에 판을 붙였다. 방은 **닫힌 부피**라 안쪽 면이
// 보이고, 벽에는 **구멍이 뚫려야** 한다.
//
// 구멍은 불리언으로 뚫지 않는다. 벽 한 줄을 "개구부를 뺀 구간들 + 개구부 위
// 상인방" 으로 **쪼개어 짓는다.** 도시의 `streetFaces` 와 같은 방식이고,
// 삼각형도 훨씬 적다 (18m 벽 하나가 상자 셋이다).
import { MeshBuilder } from '../../core/builder.js';
import { CELLS, H, W, FLOOR, EAVE, wallRuns, openingsOf } from './layout.js';
import { ductPlan } from './duct.js';

// ── 정점 간격 = 라이트맵 해상도 ────────────────────────────────────────────
//
// 조명을 정점에 굽기 때문에(bake.js) **빛이 변하는 자리에 정점이 있어야** 한다.
// 18m 벽이 꼭짓점 8개면 그 사이의 밝기 변화는 담을 데가 없다.
//
// 값이 다른 이유는 각 면이 받는 빛이 얼마나 급하게 변하느냐다.
//   벽    등 바로 아래에 빛 웅덩이가 생겨 제일 급하다
//   바닥  넓게 퍼진다
//   천장  등이 아래를 보므로 직사광이 0 이고 바운스만 받는다 — 거의 평평하다
// 암반은 안 보이므로 안 쪼갠다.
//
// `bake.BAKED` 가 꺼져 있어도 그대로 쪼갠다. 삼각형 1만 개를 헛되이 내는
// 셈이지만, 그래야 두 조명 경로가 **완전히 같은 지오메트리**를 써서 화면
// 차이가 오로지 조명 차이가 된다. A/B 는 그러라고 남긴 것이다.
const SPAN = { wall: 1.2, floor: 1.5, ceiling: 3.0 };

// 마감 천장의 두께. **소핏(upstand)이 이 값만큼 위에서 시작한다** — 한 출처로
// 둔다. 소핏 밑면을 천장 밑면(c.h)과 같은 높이에 두었더니 두 면이 같은 평면에
// 겹쳐 플라자 둘레 전체가 z-파이팅이었다 (2026-08-07 지적, 삼각형 208개).
export const CEIL_T = 0.06;

// ── 바닥과 천장 ────────────────────────────────────────────────────────────

export function buildFloors(scene, M) {
  const b = new MeshBuilder('Floors', { castShadow: false, span: SPAN.floor });
  for (const c of CELLS) {
    const w = c.x1 - c.x0;
    const d = c.z1 - c.z0;
    const cx = (c.x0 + c.x1) / 2;
    const cz = (c.z0 + c.z1) / 2;
    b.mark('floor', `floor:${c.id}`);
    // 바닥판 두께 0.2 — 아래로 내려 깐다. 위에서 보는 면만 쓴다.
    b.box(w, 0.2, d, [cx, -0.1, cz], M.floorOf(c.kind), 1.2);
    b.endMark();
  }
  return b.build(scene);
}

export function buildCeilings(scene, M) {
  const b = new MeshBuilder('Ceilings', { castShadow: false, span: SPAN.ceiling });
  for (const c of CELLS) {
    // 계단실은 천장이 없다 — 위로 뚫린 샤프트다. 샤프트 벽·꼭대기는
    // props.stairwell 이 세운다 (마감 천장을 덮었더니 "계단방 천장이 막혀
    // 있다" — 계단이 올라갈 데가 없었다).
    if (c.use === 'stair') continue;
    const w = c.x1 - c.x0;
    const d = c.z1 - c.z0;
    const cx = (c.x0 + c.x1) / 2;
    const cz = (c.z0 + c.z1) / 2;
    b.mark('ceiling', `ceil:${c.id}`);
    // 마감 천장. 위로 CEIL_T 두께 — 그 위가 설비 공간이다 (H.slab).
    b.box(w, CEIL_T, d, [cx, c.h + CEIL_T / 2, cz], M.ceilOf(c.kind), 2.4);
    b.endMark();
  }
  return b.build(scene);
}

// ── 벽 ─────────────────────────────────────────────────────────────────────

// 한 구간을 세운다. axis 'x' 면 x 로 뻗고 z 가 고정이다.
// thick 는 문틀·유리처럼 벽면보다 **돌출해야 하는** 조각이 쓴다 — 벽과 같은
// 두께로 겹쳐 세우면 같은 평면이 되어 z-파이팅이 난다.
function slab(b, run, a, bb, y0, y1, mat, tile, thick = W.wall) {
  const len = bb - a;
  if (len < 0.02 || y1 - y0 < 0.02) return;
  const mid = (a + bb) / 2;
  const cy = (y0 + y1) / 2;
  const at = run.axis === 'x' ? [mid, cy, run.at] : [run.at, cy, mid];
  const size = run.axis === 'x' ? [len, y1 - y0, thick] : [thick, y1 - y0, len];
  b.box(size[0], size[1], size[2], at, mat, tile);
}

// 굽도리 — 바닥에서 1.1m 까지 색이 다른 띠.
//
// 기관 건물 벽은 거의 다 두 색이다. 실용적인 이유가 있다 (아래는 걸레받이·
// 카트·신발이 닿아 더 자주 칠한다). **위아래가 같은 색이면 복도가 관처럼
// 보인다** — 눈높이에 선이 하나 있어야 공간의 크기가 읽힌다.
const BASE = 1.1;
function bandedSlab(b, run, a, bb, y0, y1, M, tile) {
  if (y0 >= BASE || y1 <= 0.02) return slab(b, run, a, bb, y0, y1, M.wall, tile);
  slab(b, run, a, bb, y0, Math.min(y1, BASE), M.wallLow, tile);
  if (y1 > BASE) slab(b, run, a, bb, BASE, y1, M.wall, tile);
}

export function buildWalls(scene, M) {
  const b = new MeshBuilder('Walls', { span: SPAN.wall });
  const runs = wallRuns();
  const tally = { solid: 0, door: 0, wide: 0, glass: 0, upstand: 0, narrow: [] };
  // 덕트 포트 — 북쪽 외벽에 뚫리는 기어드는 개구 (duct.js 가 자리를 정한다)
  const ports = ductPlan().ports;
  const { sill: portSill, portW } = ductPlan();
  const portHead = ductPlan().headY;

  for (const run of runs) {
    tally[run.rule]++;
    b.mark('wall', `wall:${run.from}-${run.to ?? 'out'}:${run.rule}`);

    if (run.rule === 'upstand') {
      // 소핏 — 낮은 천장 위에서 높은 천장까지만. 바닥 쪽은 트여 있다.
      // **낮은 쪽 천장판의 윗면부터** 세운다. run.low(= 천장 밑면)에서
      // 시작하면 소핏 밑면과 천장 밑면이 같은 평면이 되어 z-파이팅이 난다 —
      // 두 면이 서로 마주보지 않고 **같은 쪽을 본다**(둘 다 -y)는 게 핵심이다.
      // 천장판 윗면(+y)과 소핏 밑면(-y)은 등지므로 컬링이 하나를 지운다.
      slab(b, run, run.a, run.b, run.low + CEIL_T, run.h, M.wall, 1.0);
      b.endMark();
      continue;
    }
    // 외곽 벽(이웃 없음)은 방 천장이 아니라 **상단(EAVE)까지** 세운다 — 천장
    // 위 설비 공간의 옆구리가 공동구로 뚫리면 안 된다 (layout.EAVE 주석).
    const top = run.to === null ? EAVE : run.h;
    const wall = (a0, a1, y0, y1) => bandedSlab(b, run, a0, a1, y0, y1, M, 1.0);

    const { gaps, tooNarrow } = openingsOf(run);
    if (tooNarrow) tally.narrow.push(`${run.from}-${run.to}`);

    // 벽에 뚫리는 사각 개구들 — 유리벽 창과 덕트 포트. 벽을 세우기 **전에**
    // 계산한다: 개구도 문처럼 벽을 쪼개어 뚫어야 하기 때문이다. 예전에는 선
    // 벽 위에 유리를 겹쳐 붙였는데, 유리 뒤에 벽이 그대로 남아 창 너머가 안
    // 보였다 — 서버룸은 복도에서 안이 보여야 한다 (facility.md 0장).
    // 각 개구는 [a0, a1, y0, y1] — 높이가 서로 다르다 (유리창은 허리~머리,
    // 덕트 포트는 바닥 근처 — 기어 들어가는 구멍이다).
    const sill = 1.0;
    const head = Math.min(run.h - 0.25, 2.4);
    const wins = [];
    const glassWins = [];
    if (run.rule === 'glass' && gaps.length) {
      // 창 계산은 문이 하나라는 전제 위에 있다 — 문이 둘이면 창이 둘째 문과
      // 겹친다. 조용히 겹치게 두지 말고 터뜨린다 (lessons 2.1 규칙 4 의 태도).
      if (gaps.length > 1) {
        throw new Error(`유리벽 ${run.from}-${run.to} 에 문이 ${gaps.length}개 — 창 배치가 gaps[0] 만 안다. wins 계산을 다중 문으로 확장해야 한다`);
      }
      const [g0, g1] = gaps[0];
      for (const [a0, a1] of [
        [run.a + 0.25, g0 - 0.15],
        [g1 + 0.15, run.b - 0.25],
      ]) {
        if (a1 - a0 >= 0.6) {
          wins.push([a0, a1, sill, head]);
          glassWins.push([a0, a1]);
        }
      }
    }
    // 덕트 포트 — 이 구간이 포트를 낼 외곽 벽인가 (duct.js 가 자리를 정한다)
    if (run.to === null && run.axis === 'x') {
      for (const p of ports) {
        if (run.from !== p.cell || Math.abs(run.at - p.z) > 0.01) continue;
        wins.push([p.x - portW / 2, p.x + portW / 2, portSill, portHead]);
      }
    }
    wins.sort((p, q) => p[0] - q[0]);

    // 개구를 뺀 벽 — 문과 같은 방식으로 쪼갠다:
    // 개구 좌우 구간 + 개구 아래 허리벽 + 개구 위 상인방. 개구가 없으면 통짜다.
    const wallCut = (a0, a1) => {
      let at = a0;
      for (const [w0, w1, y0, y1] of wins) {
        if (w1 <= a0 || w0 >= a1) continue;
        wall(at, w0, 0, top);
        wall(w0, w1, 0, y0);
        wall(w0, w1, y1, top);
        at = w1;
      }
      wall(at, a1, 0, top);
    };

    // 개구부를 뺀 구간들. 문이 없어도 여기서 끝내면 안 된다 — 아래 유리
    // 끼우기가 남아 있다 (한때 문 없는 구간을 continue 로 빠져나가 창이
    // 유리 없는 맨구멍이 된 적이 있다 — status.md 4.1 의 13).
    let cur = run.a;
    for (const [g0, g1] of gaps) {
      wallCut(cur, g0);
      // 상인방 — 문 위에서 천장까지
      slab(b, run, g0, g1, H.door, top, M.wall, 1.0);
      // 문틀 — 개구부 **안쪽**을 딛고 벽면보다 1.5cm 씩 돌출한다.
      //
      // 처음에는 벽 절단면·상인방과 같은 평면에 같은 두께로 세웠고, 그
      // 겹평면이 문마다 z-파이팅 얼룩을 냈다 — 화면 네 곳의 지직거림을
      // 픽셀 디프 + 레이캐스트로 재 보니 전부 이 하나로 수렴했다 (문틀↔벽
      // 간격 0.0000). 브라운관 #65 와 같은 결론이다: **겹평면 없음, 틀은
      // 돌출**. 틀이 개구부를 4cm 씩 먹는 것은 실제 문틀도 그렇다.
      const jamb = 0.06;
      const JT = W.wall + 0.03; // 틀 두께 — 벽에서 양쪽 1.5cm 돌출
      slab(b, run, g0 - 0.02, g0 + jamb - 0.02, 0, H.door - 0.01, M.trim, 0, JT);
      slab(b, run, g1 - jamb + 0.02, g1 + 0.02, 0, H.door - 0.01, M.trim, 0, JT);
      slab(b, run, g0 - 0.02, g1 + 0.02, H.door - 0.055, H.door + 0.005, M.trim, 0, JT);
      cur = g1;
    }
    wallCut(cur, run.b);

    // 유리벽 — **뚫린** 창 자리에 유리를 끼우고 멀리언을 세운다.
    // 유리는 벽과 같은 두께다 — 이제 뒤에 벽이 없으니 겹평면이 아니다
    // (겹쳐 붙이던 시절에는 1cm 돌출로 z-파이팅을 피했었다).
    // 멀리언은 유리 위에 겹치므로 1cm 돌출시킨다 — 문틀과 같은 처방.
    // 덕트 포트 개구는 여기 안 온다 — 슬리브·그릴은 props.escapeDuct 몫이다.
    for (const [a0, a1] of glassWins) {
      slab(b, run, a0, a1, sill, head, M.glass, 0);
      const n = Math.max(1, Math.round((a1 - a0) / 1.2));
      for (let i = 1; i < n; i++) {
        const x = a0 + ((a1 - a0) * i) / n;
        // 위아래로 1.2cm 씩 물린다 — 유리와 **같은 높이**로 끝내면 멀리언의
        // 위·아래 면이 유리의 그것과 같은 평면이 되어 z-파이팅이 난다.
        // 실물 멀리언도 유리 모서리를 물고 있다 (2026-08-07)
        slab(b, run, x - 0.03, x + 0.03, sill - 0.012, head + 0.012, M.trim, 0, W.wall + 0.02);
      }
    }
    b.endMark();
  }

  const g = b.build(scene);
  return { group: g, tally, runs: runs.length };
}

// ── 외곽 ───────────────────────────────────────────────────────────────────
//
// **지하 1층이다** (facility.md 2.4). 층 바깥은 매립·암반이고, 방 밖으로
// 나가면 허공이 보이면 안 된다 — 외벽 뒤에 두꺼운 상자를 둘러 시야를 막는다.
// 위는 지표(1층 슬래브)다.
//
// 북쪽만 다르다: 외벽과 암반 사이에 **공동구(설비 트렌치)** 폭 trench 를
// 남긴다 — 탈출 덕트가 그 안을 수평으로 달린다 (duct.js). 공동구는 어떤
// 방에서도 안 보인다 — 벽·암반·지표 슬래브가 여섯 면을 다 막는다.
export function buildRock(scene, M) {
  const b = new MeshBuilder('Rock', { castShadow: false });
  const t = 6;
  const X = FLOOR.x / 2;
  const Z = FLOOR.z / 2;
  const NV = ductPlan().trench; // 북쪽 공동구 폭
  const top = H.plaza + H.slab + 1.2;
  b.mark('rock', 'rock:shell');
  // 북 — 공동구 너머로 물러선다
  b.box(FLOOR.x + t * 2, top + 2, t, [0, top / 2 - 1, Z + NV + t / 2], M.rock, 3);
  // 남
  b.box(FLOOR.x + t * 2, top + 2, t, [0, top / 2 - 1, -Z - t / 2], M.rock, 3);
  // 동·서 — 북쪽으로 공동구 끝까지 늘여 막는다
  b.box(t, top + 2, FLOOR.z + NV, [X + t / 2, top / 2 - 1, NV / 2], M.rock, 3);
  b.box(t, top + 2, FLOOR.z + NV, [-X - t / 2, top / 2 - 1, NV / 2], M.rock, 3);
  // 위 — 지표(1층) 슬래브. 공동구 위까지 덮는다
  b.box(FLOOR.x + t * 2, 0.8, FLOOR.z + NV + t * 2, [0, top + 0.4, NV / 2], M.rock, 3);
  // 공동구 바닥 — 덕트 받침이 여기 선다
  b.box(FLOOR.x, 0.2, NV, [0, -0.1, Z + NV / 2], M.rock, 3);
  b.endMark();
  return b.build(scene);
}
