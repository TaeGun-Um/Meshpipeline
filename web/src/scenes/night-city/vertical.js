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

import { claim, isFree, TIER } from './siteplan.js';
import { districtAt } from './district.js';
import { SIDES } from '../../core/boxfaces.js';
import {
  CURB_HEIGHT,
  SIDEWALK_W,
  blockCenter,
  blockIndexAt,
  coreDistance,
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

// ── 2층 데크 + 계단 (앵커 기반) ────────────────────────────────────────────
//
// ── 왜 다시 만들었나 ───────────────────────────────────────────────────────
// 처음에는 데크를 블록 가장자리에 **좌표 해시로** 놓았다. 무엇과도 연결되지
// 않았고, 계단은 그 데크 끝에 붙으니 역시 아무 데도 안 닿았다.
// 브릿지와 정확히 같은 실수였다 (createBridges 머리말).
//
// 이제 **건물 정면에 붙인다.** 데크는 그 건물의 2층 출입로이고, 계단은 그
// 데크와 인도를 잇는다. 그러면 "올라갈 수 있는 곳" 이 실제로 성립한다.
//
// 특히 적층 상가(bazaar)는 층마다 점포와 외부 복도가 있는데 지상에서 올라갈
// 방법이 없었다. 데크가 그 복도로 이어지는 것이 이 구조의 요점이다.
export function createDecks(scene, rng, mats, anchors) {
  const b = new MeshBuilder('Decks');
  const pools = [];
  let decks = 0;
  let stairs = 0;

  for (const a of anchors) {
    // 2층 데크가 붙으려면 건물이 그만큼 높아야 한다
    if (a.top < DECK_Y + 3) continue;
    // 인도가 데크를 감당하는가. 공업 구역(3.2m)에는 못 놓는다.
    const cx = (a.rect.x0 + a.rect.x1) / 2;
    const cz = (a.rect.z0 + a.rect.z1) / 2;
    // blockIndexAt 을 쓴다. 예전에는 여기서 `Math.round(cx / PITCH + (GRID-1)/2)`
    // 를 썼는데 그건 **등간격일 때만** 맞는 식이다 (layout.js 머리말).
    // 다른 다섯 모듈은 진작 옮겼고 여기만 남아 있었다 — 그래서 데크가 엉뚱한
    // 구역의 인도 폭을 보고 놓일지 말지를 정했다.
    const ix = blockIndexAt(cx);
    const iz = blockIndexAt(cz);
    const D = districtAt(ix, iz);
    const walk = D.sidewalk ?? SIDEWALK_W;
    if (walk < MIN_WALK) continue;

    // 상업 구역에 몰아준다 — 적층 상가의 위층으로 올라가는 길이기 때문이다.
    // 기업 구역은 수직 이동이 건물 안에서 일어나므로 밖에 데크를 안 둔다.
    const rate = D.name === '상업' ? 0.5 : D.name === '주거' ? 0.18 : D.name === '기업' ? 0 : 0.08;
    if (!rng.chance(rate)) continue;

    // 길에 면한 면 하나를 고른다. 안 보이는 면에 놓으면 없는 것과 같다.
    const open = SIDES.filter((sd) => a.faces?.[sd]);
    if (!open.length) continue;
    const side = open[rng.int(0, open.length - 1)];

    const alongX = side === 'pz' || side === 'nz';
    const len = (alongX ? a.rect.x1 - a.rect.x0 : a.rect.z1 - a.rect.z0) * rng.range(0.6, 0.95);
    if (len < 8) continue;

    // 건물 면에서 바깥으로 DECK_W/2 만큼. 벽에 물려야 붙은 것으로 읽힌다.
    const out = DECK_W / 2 - 0.2;
    const dcx = alongX ? cx : (side === 'px' ? a.rect.x1 + out : a.rect.x0 - out);
    const dcz = alongX ? (side === 'pz' ? a.rect.z1 + out : a.rect.z0 - out) : cz;

    // ── 계단 자리를 **먼저** 정한다 ─────────────────────────────────────
    //
    // 전에는 데크를 놓고 나서 계단 자리를 물었다. 자리가 없으면 계단만
    // 건너뛰었고, 그 결과 **올라갈 수 없는 데크**가 남았다 (배치 검사:
    // 74개 중 12개). 못 올라가는 통로는 통로가 아니다.
    //
    // 게다가 데크 기둥이 TIER.VERTICAL 로 자리를 선점하므로, 데크를 먼저
    // 놓으면 **자기 기둥이 자기 계단을 막는** 경우까지 있었다.
    //
    // 그래서 순서를 뒤집는다. 양 끝을 다 시도해 보고, 어느 쪽에도 계단을
    // 못 놓으면 데크 자체를 놓지 않는다.
    const first = rng.chance(0.5) ? 1 : -1;
    const runLen = 5.4;
    let stair = null;
    for (const sgn of [first, -first]) {
      const endT = sgn * (len / 2 - 1.2);
      const sxTop = alongX ? dcx + endT : dcx;
      const szTop = alongX ? dcz : dcz + endT;
      const sxBot = alongX ? sxTop + sgn * runLen : sxTop;
      const szBot = alongX ? szTop : szTop + sgn * runLen;
      if (isFree(sxBot, szBot, 2.6, TIER.VERTICAL)) {
        stair = { sxTop, szTop, sxBot, szBot };
        break;
      }
    }
    if (!stair) continue;

    // 양 끝 좌표를 함께 남긴다. 검사가 보는 것은 "이 끝이 무언가에 닿나" 다
    // (core/placement.js supportAt).
    const half = len / 2;
    b.mark('deck', `deck#${decks}`, {
      // 건물 면에서 나간 축. 검사가 이 축만 보고 인도를 넘었는지 잰다.
      axis: alongX ? 'z' : 'x',
      ends: alongX
        ? [[dcx - half, DECK_Y, dcz], [dcx + half, DECK_Y, dcz]]
        : [[dcx, DECK_Y, dcz - half], [dcx, DECK_Y, dcz + half]],
    });
    deckRun(b, dcx, dcz, alongX, len, DECK_Y, rng, mats, pools);
    decks++;

    // 계단 — 데크 끝에서 인도로. 데크와 나란히 내려간다.
    claim(stair.sxBot, stair.szBot, 2.6, TIER.VERTICAL, 'stairLanding');
    b.mark('stair', `stair#${stairs}`, {
      ends: [[stair.sxBot, CURB_HEIGHT, stair.szBot], [stair.sxTop, DECK_Y, stair.szTop]],
    });
    stairFlight(
      b,
      [stair.sxBot, CURB_HEIGHT, stair.szBot],
      [stair.sxTop, DECK_Y, stair.szTop],
      1.6, rng, mats
    );
    stairs++;
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
  // rect(필지)가 아니라 **solid**(필지 ∩ 실제로 그려진 것)를 본다.
  // 기업 타워는 대지를 비우므로 필지 가장자리에 벽이 없고, 거기에 다리를
  // 물리면 광장 허공에 뜬다 — 배치 검사가 그렇게 뜬 끝 10곳을 찾았다.
  for (const a of anchors) {
    const rect = a.solid || a.rect;
    const cx = (rect.x0 + rect.x1) / 2;
    const cz = (rect.z0 + rect.z1) / 2;
    const k = key(cx, cz);
    if (!grid.has(k)) grid.set(k, []);
    grid.get(k).push({ ...a, rect, cx, cz });
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

        b.mark('bridge', `bridge#${count}`, { ends: [from, to] });
        bridge(b, from, to, y, rng, mats);
        used.add(id);
        count++;
      }
    }
  }

  return { group: b.build(scene), count };
}
