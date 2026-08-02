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
import { CELLS, H, W, FLOOR, wallRuns, openingsOf } from './layout.js';

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
    const w = c.x1 - c.x0;
    const d = c.z1 - c.z0;
    const cx = (c.x0 + c.x1) / 2;
    const cz = (c.z0 + c.z1) / 2;
    b.mark('ceiling', `ceil:${c.id}`);
    // 마감 천장. 위로 0.06 두께 — 그 위가 설비 공간이다 (H.slab).
    b.box(w, 0.06, d, [cx, c.h + 0.03, cz], M.ceilOf(c.kind), 2.4);
    b.endMark();
  }
  return b.build(scene);
}

// ── 벽 ─────────────────────────────────────────────────────────────────────

// 한 구간을 세운다. axis 'x' 면 x 로 뻗고 z 가 고정이다.
function slab(b, run, a, bb, y0, y1, mat, tile) {
  const len = bb - a;
  if (len < 0.02 || y1 - y0 < 0.02) return;
  const mid = (a + bb) / 2;
  const cy = (y0 + y1) / 2;
  const at = run.axis === 'x' ? [mid, cy, run.at] : [run.at, cy, mid];
  const size = run.axis === 'x' ? [len, y1 - y0, W.wall] : [W.wall, y1 - y0, len];
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

  for (const run of runs) {
    tally[run.rule]++;
    b.mark('wall', `wall:${run.from}-${run.to ?? 'out'}:${run.rule}`);

    if (run.rule === 'upstand') {
      // 소핏 — 낮은 천장 위에서 높은 천장까지만. 바닥 쪽은 트여 있다.
      slab(b, run, run.a, run.b, run.low, run.h, M.wall, 1.0);
      b.endMark();
      continue;
    }
    const wall = (a0, a1, y0, y1) => bandedSlab(b, run, a0, a1, y0, y1, M, 1.0);

    const { gaps, tooNarrow } = openingsOf(run);
    if (tooNarrow) tally.narrow.push(`${run.from}-${run.to}`);

    if (!gaps.length) {
      wall(run.a, run.b, 0, run.h);
      b.endMark();
      continue;
    }

    // 개구부를 뺀 구간들
    let cur = run.a;
    for (const [g0, g1] of gaps) {
      wall(cur, g0, 0, run.h);
      // 상인방 — 문 위에서 천장까지
      slab(b, run, g0, g1, H.door, run.h, M.wall, 1.0);
      // 문틀
      const jamb = 0.06;
      slab(b, run, g0 - jamb, g0, 0, H.door + jamb, M.trim, 0);
      slab(b, run, g1, g1 + jamb, 0, H.door + jamb, M.trim, 0);
      slab(b, run, g0, g1, H.door, H.door + jamb, M.trim, 0);
      cur = g1;
    }
    wall(cur, run.b, 0, run.h);

    // 유리벽 — 서버룸은 복도에서 안이 보여야 한다
    if (run.rule === 'glass') {
      const [g0, g1] = gaps[0];
      // 개구부 양옆의 벽을 유리로 갈아 끼우는 대신, 벽 위쪽에 창을 얹는다.
      // 벽을 통째로 유리로 하면 구조가 없어 보인다.
      const sill = 1.0;
      const head = Math.min(run.h - 0.25, 2.4);
      for (const [a0, a1] of [
        [run.a + 0.25, g0 - 0.15],
        [g1 + 0.15, run.b - 0.25],
      ]) {
        if (a1 - a0 < 0.6) continue;
        // 창 자리의 벽을 유리로 (벽은 이미 섰으므로 살짝 앞으로 겹쳐 붙인다)
        slab(b, run, a0, a1, sill, head, M.glass, 0);
        // 멀리언
        const n = Math.max(1, Math.round((a1 - a0) / 1.2));
        for (let i = 1; i < n; i++) {
          const x = a0 + ((a1 - a0) * i) / n;
          slab(b, run, x - 0.03, x + 0.03, sill, head, M.trim, 0);
        }
      }
    }
    b.endMark();
  }

  const g = b.build(scene);
  return { group: g, tally, runs: runs.length };
}

// ── 외곽 ───────────────────────────────────────────────────────────────────
//
// 층 바깥은 암반이다. 방 밖으로 나가면 허공이 보이면 안 된다 —
// 외벽 뒤에 두꺼운 상자를 둘러 시야를 막는다. 도시에서 지면 평면이
// y<0 를 통째로 가렸던 것과 같은 자리다.
export function buildRock(scene, M) {
  const b = new MeshBuilder('Rock', { castShadow: false });
  const t = 6;
  const X = FLOOR.x / 2;
  const Z = FLOOR.z / 2;
  const top = H.plaza + H.slab + 1.2;
  b.mark('rock', 'rock:shell');
  b.box(FLOOR.x + t * 2, top + 2, t, [0, top / 2 - 1, Z + t / 2], M.rock, 3);
  b.box(FLOOR.x + t * 2, top + 2, t, [0, top / 2 - 1, -Z - t / 2], M.rock, 3);
  b.box(t, top + 2, FLOOR.z, [X + t / 2, top / 2 - 1, 0], M.rock, 3);
  b.box(t, top + 2, FLOOR.z, [-X - t / 2, top / 2 - 1, 0], M.rock, 3);
  // 위 — 구조 슬래브
  b.box(FLOOR.x + t * 2, 0.8, FLOOR.z + t * 2, [0, top + 0.4, 0], M.rock, 3);
  b.endMark();
  return b.build(scene);
}
