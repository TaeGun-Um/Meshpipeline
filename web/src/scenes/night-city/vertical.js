// 수직 동선 — 계단 · 2층 데크 · 건물 사이 브릿지.
//
// ── 왜 필요한가 ────────────────────────────────────────────────────────────
// 도시에 층이 셋 있는데 서로 **완전히 단절**돼 있었다.
//
//   지면(y=0)        걸어다니는 곳
//   고가도로(y=26)   차만 다니고 올라갈 방법이 없다
//   옥상             12종을 만들어 뒀는데 지상에서 보이지도, 갈 수도 없다
//
// 그래서 아무리 건물을 높게 세워도 **벽지가 높은 2D 맵**이었다.
// 레퍼런스에서 밀도감의 절반은 Z축에서 온다 — 외부 계단, 2층 보행데크,
// 건물 사이를 건너는 브릿지, 주차타워 램프.
//
// ── 읽히게 만드는 조건 ─────────────────────────────────────────────────────
// 나이트시티는 프리캠 전용이라 실제로 걸을 일은 없다. 그래도 **다닐 수 있는
// 것처럼 보여야** 의미가 있다. 그러려면 셋이 필요하다.
//
//   1) 디딤판이 보일 것   비스듬한 판 하나는 미끄럼틀이지 계단이 아니다.
//   2) 난간이 있을 것     난간 없는 공중 데크는 선반으로 보인다.
//   3) 양 끝이 무언가에 닿을 것
//      허공에서 시작해 허공에서 끝나는 통로는 아무리 잘 만들어도 오브젝트다.
//
// 3번이 제일 중요하고 제일 자주 틀린다. 그래서 이 파일의 배치는 전부
// **양 끝 좌표를 먼저 정하고** 그 사이를 채우는 방식으로 쓴다.
import { MeshBuilder } from '../../core/builder.js';
import { autoBox, tubeBetween } from '../../core/profile.js';
import { upPlane } from '../../core/boxfaces.js';
import { NEON, rgb01 } from '../../shared/neon.js';
import { neonSoft } from '../../shared/masters.js';
import { hash2 } from '../../core/textures.js';
import { claim, isFree, TIER } from './siteplan.js';
import { districtAt } from './district.js';
import {
  GRID,
  BLOCK_SIZE,
  STREET_WIDTH,
  CURB_HEIGHT,
  SIDEWALK_W,
  blockCenter,
  coreDistance,
  ALLEY_WIDTH,
} from './layout.js';

// 2층 데크 높이. 1층 점포(SHOP_H=3.4)와 그 위 간판대를 지나야 하므로
// 6.5m 정도가 최소다. 더 낮으면 데크가 간판을 자른다.
const DECK_Y = 6.8;
// 데크 폭. 그 구역 인도 안에 들어가야 한다 — 넘치면 차도로 나가 고가도로와
// 부딪힌다. 좁은 구역에서는 데크를 아예 놓지 않는다 (아래 MIN_WALK).
const DECK_W = 2.6;
const MIN_WALK = DECK_W + 1.2; // 이보다 인도가 좁으면 데크를 못 놓는다

// ── 계단 ───────────────────────────────────────────────────────────────────
//
// 디딤판을 하나씩 쌓는다. 삼각형이 아깝지만 이걸 비스듬한 판으로 대신하면
// 그 순간 계단으로 안 읽힌다 — 계단의 정체성은 기울기가 아니라 **단**이다.
//
//   a, b   시작·끝 좌표 [x, y, z]
//   width  계단 폭
function stairFlight(b, from, to, width, rng, mats) {
  const dx = to[0] - from[0];
  const dz = to[2] - from[2];
  const rise = to[1] - from[1];
  const run = Math.hypot(dx, dz);
  if (run < 0.5 || rise < 0.5) return;

  // 실제 계단의 챌판은 17~18cm 다. 그 값을 지켜야 사람 크기가 읽힌다.
  const steps = Math.max(3, Math.round(rise / 0.175));
  const ux = dx / run;
  const uz = dz / run;
  // 계단 진행 방향에 수직 (난간 위치용)
  const px = -uz;
  const pz = ux;
  const yaw = Math.atan2(dx, dz);

  for (let i = 0; i < steps; i++) {
    const t = (i + 0.5) / steps;
    const sx = from[0] + ux * run * t;
    const sz = from[2] + uz * run * t;
    const sy = from[1] + (rise * (i + 1)) / steps;
    const tread = run / steps + 0.06; // 살짝 겹쳐 틈을 없앤다
    const g = autoBox(width, 0.09, tread, null, 0.015);
    g.rotateY(yaw);
    g.translate(sx, sy - 0.045, sz);
    b.add(g, mats.grateMat);
    // 챌판 — 옆에서 봤을 때 계단이 속이 빈 사다리로 보이지 않게
    const rg = autoBox(width, rise / steps, 0.05, null, 0.01);
    rg.rotateY(yaw);
    rg.translate(sx - ux * (run / steps) * 0.5, sy - rise / steps / 2, sz - uz * (run / steps) * 0.5);
    b.add(rg, mats.metalMat);
  }

  // 난간 — 경사를 따라가는 손잡이 + 동자
  for (const s of [-1, 1]) {
    const ox = px * (width / 2) * s;
    const oz = pz * (width / 2) * s;
    b.add(
      tubeBetween(
        [from[0] + ox, from[1] + 1.0, from[2] + oz],
        [to[0] + ox, to[1] + 1.0, to[2] + oz],
        0.035, 5
      ),
      mats.pipeMat
    );
    const posts = Math.max(2, Math.round(run / 1.4));
    for (let i = 0; i <= posts; i++) {
      const t = i / posts;
      b.box(
        0.05, 1.0, 0.05,
        [from[0] + dx * t + ox, from[1] + rise * t + 0.5, from[2] + dz * t + oz],
        mats.pipeMat
      );
    }
  }
  return { yaw, steps };
}

// ── 2층 보행데크 ───────────────────────────────────────────────────────────
//
// 인도 위를 따라 달리는 통로. 아래 인도를 덮으므로 1층에 그늘과 기둥이 생기고,
// 그 자체가 "여기 올라갈 수 있다" 는 신호가 된다.
//
// 인도 폭(4.6m) 안에 들어가야 한다. 차도로 나가면 고가도로와 충돌한다.
function deckRun(b, cx, cz, dirX, len, y, rng, mats, pools) {
  const w = DECK_W;
  const alongX = dirX;
  const [sw, sd] = alongX ? [len, w] : [w, len];

  // 바닥판
  b.add(autoBox(sw, 0.22, sd, [cx, y, cz], 0.03), mats.grateMat);
  // 밑면 조명 — 아래 인도를 물들인다. 데크가 공중에 뜬 판으로 안 보이게 하는 핵심.
  b.add(upPlane(sw * 0.9, sd * 0.7, [cx, y - 0.14, cz]), mats.deckUnderMat);
  pools.push({
    kind: 'floor', x: cx, y: CURB_HEIGHT + 0.03, z: cz,
    rx: alongX ? len * 0.5 : 3.2, rz: alongX ? 3.2 : len * 0.5,
    tint: rgb01(NEON.cool, 0.22),
  });

  // 난간 — 양쪽. 이게 없으면 선반이다.
  for (const s of [-1, 1]) {
    const rx = alongX ? cx : cx + s * (w / 2);
    const rz = alongX ? cz + s * (w / 2) : cz;
    const [rw, rd] = alongX ? [len, 0.06] : [0.06, len];
    b.add(autoBox(rw, 0.06, rd, [rx, y + 1.05, rz], 0.01), mats.pipeMat);
    const posts = Math.max(2, Math.round(len / 1.8));
    for (let i = 0; i <= posts; i++) {
      const t = -len / 2 + (len * i) / posts;
      b.box(0.05, 1.0, 0.05, [alongX ? cx + t : rx, y + 0.55, alongX ? rz : cz + t], mats.pipeMat);
    }
  }

  // 기둥 — 데크를 인도에 내려 앉힌다. 3번 조건("양 끝이 무언가에 닿을 것").
  const cols = Math.max(2, Math.round(len / 9));
  for (let i = 0; i <= cols; i++) {
    const t = -len / 2 + (len * i) / cols;
    const px = alongX ? cx + t : cx;
    const pz = alongX ? cz : cz + t;
    // 기둥은 구조물이라 못 비킨다. 자리를 선점해 가로등·자판기가 피하게 한다.
    claim(px, pz, 0.9, TIER.VERTICAL, 'deckColumn');
    b.cylinder(0.16, 0.18, y - CURB_HEIGHT, [px, CURB_HEIGHT + (y - CURB_HEIGHT) / 2, pz], mats.metalMat, 8);
  }

  // 가장자리 발광 띠 — 밤에 데크의 윤곽을 그린다
  if (rng.chance(0.7)) {
    const hue = rng.chance(0.5) ? NEON.cool : NEON.amber;
    const [tw, td] = alongX ? [len, 0.08] : [0.08, len];
    const s = rng.chance(0.5) ? 1 : -1;
    b.add(
      autoBox(tw, 0.08, td, [alongX ? cx : cx + s * (w / 2), y + 0.16, alongX ? cz + s * (w / 2) : cz], 0.01),
      neonSoft(hue)
    );
  }
}

// ── 브릿지 ─────────────────────────────────────────────────────────────────
//
// 두 지점을 잇는 통로. 길이에 따라 성격이 다르다.
//   골목(4.4m)  짧다. 배관 몇 개와 발판이면 충분하고, 개수로 승부한다.
//   도로(22m)   길다. 트러스와 지붕이 없으면 종잇장처럼 휜다.
function bridge(b, from, to, y, rng, mats) {
  const dx = to[0] - from[0];
  const dz = to[2] - from[2];
  const len = Math.hypot(dx, dz);
  const alongX = Math.abs(dx) > Math.abs(dz);
  const cx = (from[0] + to[0]) / 2;
  const cz = (from[2] + to[2]) / 2;
  const w = len > 10 ? rng.range(2.6, 4.0) : rng.range(1.4, 2.2);

  const [sw, sd] = alongX ? [len, w] : [w, len];
  b.add(autoBox(sw, 0.3, sd, [cx, y, cz], 0.04), mats.grateMat);

  // 난간 (짧은 것) 또는 벽+지붕 (긴 것).
  // 긴 다리에 난간만 두면 실루엣이 가늘어 공중에 뜬 선으로 보인다.
  if (len > 10) {
    for (const s of [-1, 1]) {
      const rx = alongX ? cx : cx + s * (w / 2);
      const rz = alongX ? cz + s * (w / 2) : cz;
      const [rw, rd] = alongX ? [len, 0.14] : [0.14, len];
      b.add(autoBox(rw, 2.1, rd, [rx, y + 1.2, rz], 0.02), mats.panelMat);
      // 벽에 난 창 띠 — 안에 사람이 다니는 통로로 읽히게
      b.add(autoBox(rw * 0.94, 0.7, rd, [rx, y + 1.5, rz], 0.01), mats.bridgeWinMat);
    }
    const [rw, rd] = alongX ? [len, w] : [w, len];
    b.add(autoBox(rw, 0.22, rd, [cx, y + 2.4, cz], 0.03), mats.metalMat);
    // 아래를 받치는 트러스 — 22m 를 아무것도 없이 건너면 떠 보인다
    const n = 4;
    for (let i = 0; i < n; i++) {
      const t0 = -len / 2 + (len * i) / n;
      const t1 = -len / 2 + (len * (i + 1)) / n;
      const A = alongX ? [cx + t0, y - 0.2, cz] : [cx, y - 0.2, cz + t0];
      const B = alongX ? [cx + t1, y - 1.1, cz] : [cx, y - 1.1, cz + t1];
      b.add(tubeBetween(A, B, 0.09, 4), mats.metalMat);
      b.add(tubeBetween([B[0], B[1], B[2]], alongX ? [cx + t1, y - 0.2, cz] : [cx, y - 0.2, cz + t1], 0.09, 4), mats.metalMat);
    }
  } else {
    for (const s of [-1, 1]) {
      const rx = alongX ? cx : cx + s * (w / 2);
      const rz = alongX ? cz + s * (w / 2) : cz;
      const [rw, rd] = alongX ? [len, 0.06] : [0.06, len];
      b.add(autoBox(rw, 0.06, rd, [rx, y + 1.05, rz], 0.01), mats.pipeMat);
      for (let i = 0; i <= 3; i++) {
        const t = -len / 2 + (len * i) / 3;
        b.box(0.05, 1.0, 0.05, [alongX ? cx + t : rx, y + 0.55, alongX ? rz : cz + t], mats.pipeMat);
      }
    }
  }

  // 밑면 표시등 — 아래에서 올려다볼 때 다리의 존재를 알린다
  if (rng.chance(0.6)) {
    b.add(upPlane(sw * 0.7, sd * 0.6, [cx, y - 0.2, cz]), mats.deckUnderMat);
  }
}

// ── 배치 ───────────────────────────────────────────────────────────────────

export function createVertical(scene, rng, mats, alleys) {
  const b = new MeshBuilder('Vertical');
  const pools = [];
  let decks = 0;
  let stairs = 0;

  // 2) 2층 데크 + 계단 — 블록 가장자리 인도 위.
  //    좌표 해시로 정한다. 모든 블록에 두르면 도시가 통째로 2층이 되어
  //    1층이 오히려 지하처럼 보인다.
  for (let ix = 0; ix < GRID; ix++) {
    for (let iz = 0; iz < GRID; iz++) {
      const h = hash2(ix * 197 + 11, iz * 61 + 7);
      if (h > 0.42) continue; // 42% 블록만
      // 인도가 데크를 감당하는가. 공업 구역(3.2m)에는 못 놓는다.
      const walk = districtAt(ix, iz, coreDistance(blockCenter(ix), blockCenter(iz))).sidewalk ?? SIDEWALK_W;
      if (walk < MIN_WALK) continue;
      const cx = blockCenter(ix);
      const cz = blockCenter(iz);
      const half = BLOCK_SIZE / 2;
      // 네 변 중 하나 또는 둘
      const sides = h < 0.18 ? 2 : 1;
      for (let s = 0; s < sides; s++) {
        const g = hash2(ix * 31 + s * 7, iz * 89 + 3);
        const dir = Math.floor(g * 4); // 0..3
        const alongX = dir < 2;
        const sign = dir % 2 === 0 ? -1 : 1;
        // 인도 띠의 한가운데
        const off = half - SIDEWALK_W / 2;
        const len = BLOCK_SIZE * rng.range(0.5, 0.86);
        const dcx = alongX ? cx + rng.range(-6, 6) : cx + sign * off;
        const dcz = alongX ? cz + sign * off : cz + rng.range(-6, 6);
        deckRun(b, dcx, dcz, alongX, len, DECK_Y, rng, mats, pools);
        decks++;

        // 계단 — 데크 끝에서 인도로 내려온다. 반드시 붙어야 한다.
        const endT = (rng.chance(0.5) ? 1 : -1) * (len / 2 - 1.0);
        const sxTop = alongX ? dcx + endT : dcx;
        const szTop = alongX ? dcz : dcz + endT;
        // 데크와 나란한 방향으로 내려간다 (인도 폭 안에 계단이 들어가야 하므로)
        const runLen = 5.4;
        const dirSign = endT > 0 ? 1 : -1;
        const sxBot = alongX ? sxTop + dirSign * runLen : sxTop;
        const szBot = alongX ? szTop : szTop + dirSign * runLen;
        // 계단 착지점 — 사람이 내려서는 자리다. 반드시 비어 있어야 한다.
        // 실제로 자판기가 착지점을 막고 서 있었다.
        if (isFree(sxBot, szBot, 2.6, TIER.VERTICAL)) {
          claim(sxBot, szBot, 2.6, TIER.VERTICAL, 'stairLanding');
          stairFlight(
            b,
            [sxBot, CURB_HEIGHT, szBot],
            [sxTop, DECK_Y, szTop],
            1.6, rng, mats
          );
          stairs++;
        }
      }
    }
  }

  return { group: b.build(scene), pools, decks, stairs };
}


// ── 브릿지 (앵커 기반) ─────────────────────────────────────────────────────
//
// ── 왜 다시 만들었나 ───────────────────────────────────────────────────────
// 처음에는 좌표 해시로 도로와 골목을 골라 임의 높이(13~21m)에 다리를 놓았다.
// 그 자리에 건물이 있는지, 그 높이에 닿을 면이 있는지 **확인하지 않았다.**
// 그래서 다리가 허공에서 시작해 허공에서 끝났다.
//
// 이 파일 머리말에 "양 끝이 무언가에 닿을 것. 3번이 제일 중요하고 제일 자주
// 틀린다" 고 써 놓고 정확히 그걸 틀렸다.
//
// 이제 towers 가 만든 **앵커 목록**(건물 사각형 + 옥상 높이)에서 조건을 만족하는
// 쌍만 고른다.
//
//   1) 두 건물이 마주 본다 (한 축으로 겹치고 다른 축으로 떨어져 있다)
//   2) 사이 거리가 다닐 만하다 (골목 4m ~ 도로 30m)
//   3) 다리 높이가 **양쪽 옥상보다 낮다** — 벽이 있어야 붙는다
//
// 셋을 다 만족하는 쌍이 없으면 그 자리에는 다리를 놓지 않는다. 다리가 적은
// 것이 허공에 뜬 다리보다 낫다.
export function createBridges(scene, rng, mats, anchors) {
  const b = new MeshBuilder('Bridges');
  let count = 0;

  // 앵커를 격자 칸으로 나눠 담는다. 500개를 전수 비교하면 O(n²) 이라 느리다.
  const CELL = 110;
  const grid = new Map();
  const key = (x, z) => `${Math.floor(x / CELL)},${Math.floor(z / CELL)}`;
  for (const a of anchors) {
    const cx = (a.rect.x0 + a.rect.x1) / 2;
    const cz = (a.rect.z0 + a.rect.z1) / 2;
    const k = key(cx, cz);
    if (!grid.has(k)) grid.set(k, []);
    grid.get(k).push({ ...a, cx, cz });
  }

  const used = new Set();
  for (const [, cell] of grid) {
    for (const A of cell) {
      // 이웃 칸까지 훑는다
      const cand = [];
      for (let dx = -1; dx <= 1; dx++) {
        for (let dz = -1; dz <= 1; dz++) {
          const n = grid.get(`${Math.floor(A.cx / CELL) + dx},${Math.floor(A.cz / CELL) + dz}`);
          if (n) cand.push(...n);
        }
      }

      for (const B of cand) {
        if (A === B) continue;
        const id = A.cx < B.cx || (A.cx === B.cx && A.cz < B.cz)
          ? `${A.cx},${A.cz}|${B.cx},${B.cz}` : `${B.cx},${B.cz}|${A.cx},${A.cz}`;
        if (used.has(id)) continue;

        // 1) 마주 보는가 — 한 축으로 겹치고 다른 축으로 떨어져 있다
        const ovX = Math.min(A.rect.x1, B.rect.x1) - Math.max(A.rect.x0, B.rect.x0);
        const ovZ = Math.min(A.rect.z1, B.rect.z1) - Math.max(A.rect.z0, B.rect.z0);
        let gap, alongX;
        if (ovX > 6 && ovZ < 0) { gap = -ovZ; alongX = false; }
        else if (ovZ > 6 && ovX < 0) { gap = -ovX; alongX = true; }
        else continue;

        // 2) 다닐 만한 거리인가
        if (gap < 4 || gap > 30) continue;

        // 3) 양쪽 옥상보다 낮은 높이가 있는가.
        //    두 건물 중 **낮은 쪽**을 기준으로 그보다 아래에 놓는다.
        const lowTop = Math.min(A.top, B.top);
        if (lowTop < 9) continue; // 너무 낮은 건물끼리는 다리를 놓지 않는다
        if (!rng.chance(gap < 8 ? 0.30 : 0.12)) continue;

        const y = CURB_HEIGHT + rng.range(6.5, Math.max(7, lowTop - 3));
        // 겹치는 구간의 한가운데를 지난다
        const mid = alongX
          ? (Math.max(A.rect.z0, B.rect.z0) + Math.min(A.rect.z1, B.rect.z1)) / 2
          : (Math.max(A.rect.x0, B.rect.x0) + Math.min(A.rect.x1, B.rect.x1)) / 2;
        // 양 끝을 건물 면에 **물린다** (0.4m 파고든다)
        const from = alongX
          ? [Math.min(A.rect.x1, B.rect.x1) - 0.4, y, mid]
          : [mid, y, Math.min(A.rect.z1, B.rect.z1) - 0.4];
        const to = alongX
          ? [Math.max(A.rect.x0, B.rect.x0) + 0.4, y, mid]
          : [mid, y, Math.max(A.rect.z0, B.rect.z0) + 0.4];

        bridge(b, from, to, y, rng, mats);
        used.add(id);
        count++;
      }
    }
  }

  return { group: b.build(scene), count };
}
