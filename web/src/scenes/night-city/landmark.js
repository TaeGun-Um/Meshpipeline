// 랜드마크.
//
// ── 왜 필요한가 ────────────────────────────────────────────────────────────
// 절차적으로 생성한 도시는 아무리 유형을 늘려도 "다 비슷하게 다른" 상태에 머문다.
// 어느 방향을 봐도 통계적으로 같은 그림이라 방향 감각이 생기지 않는다.
//
// 랜드마크는 **통계에서 빼낸 건물**이다. 난수로 뽑지 않고 손으로 배치하고
// 손으로 형태를 정한다. 하나만 있어도 도시에 "저기가 저기다" 가 생긴다.
//
// 두 개를 둔다. 하나로는 그 하나가 안 보이는 방향에서 다시 방향을 잃는다.
//   HQ    도심 한가운데. 계단식 메가타워 + 모서리 광주(光柱) + 첨탑. 420m
//   TWIN  대각선 반대편. 쌍둥이 슬래브 + 스카이브리지. 300m
import { MeshBuilder } from '../../core/builder.js';
import { SIDES, shrink, rectBox, facePlane } from '../../core/boxfaces.js';
import { lathe } from '../../core/profile.js';
import { NEON } from '../../shared/neon.js';
import { neon } from '../../shared/masters.js';
import {
  PITCH,
  FLOOR_HEIGHT,
  PANEL_TILE,
} from './layout.js';

// 랜드마크가 차지하는 블록. towers.js 는 이 블록을 건너뛴다.
export const LANDMARK_BLOCKS = [
  { ix: 2, iz: 3, kind: 'hq' },
  { ix: 4, iz: 1, kind: 'twin' },
];

// ── 본사 타워 ──────────────────────────────────────────────────────────────
//
// 넓은 기단에서 시작해 네 번 물러서며 올라가는 계단식. 아르데코 마천루의 문법이고,
// 실루엣만으로 다른 건물과 구분된다.
//
// 정체성은 **모서리 광주**가 만든다. 네 모서리에 바닥부터 꼭대기까지 끊기지 않는
// 발광 기둥을 세우면, 안개에 잠겨 형태가 안 보여도 그 네 줄이 보인다.
function hqTower(b, cx, cz, mats) {
  const H = 420;
  const stages = [
    { half: 26, top: 92 },
    { half: 21, top: 196 },
    { half: 16.5, top: 292 },
    { half: 12, top: 362 },
    { half: 8, top: H },
  ];

  let y = 0;
  const curtain = mats.skins.curtain;
  const sheet = [
    curtain.sets[0].grid.cols * curtain.pitch,
    curtain.sets[0].grid.rows * FLOOR_HEIGHT,
  ];

  for (const st of stages) {
    const r = { x0: cx - st.half, x1: cx + st.half, z0: cz - st.half, z1: cz + st.half };
    const h = st.top - y;

    b.add(rectBox(r, y, h, PANEL_TILE), mats.panelMat);
    for (const side of SIDES) {
      b.add(facePlane(r, y + 0.4, h - 0.8, side, sheet), curtain.mats[1]);
    }

    // 단 경계의 두꺼운 처마 — 계단이 눈에 보이게
    b.add(rectBox(shrink(r, -1.2), st.top - 1.6, 1.6, PANEL_TILE), mats.panelMat);
    for (const side of SIDES) {
      b.add(facePlane(shrink(r, -1.2), st.top - 1.0, 0.35, side, null, 0.04), neon(NEON.amber));
    }

    // 모서리 광주 — 이 건물의 정체성
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        b.box(
          1.1,
          h,
          1.1,
          [cx + sx * (st.half - 0.2), y + h / 2, cz + sz * (st.half - 0.2)],
          neon(NEON.cyan)
        );
      }
    }

    y = st.top;
  }

  // 첨탑 — 안테나가 아니라 건물의 연장. 링을 촘촘히 둬서 밤에 보이게.
  const spireH = 96;
  b.add(
    lathe(
      [
        [7, 0],
        [5.4, spireH * 0.3],
        [3.0, spireH * 0.62],
        [1.2, spireH * 0.88],
        [0, spireH],
      ],
      16,
      [cx, H, cz]
    ),
    mats.metalMat
  );
  for (let i = 1; i <= 7; i++) {
    const t = i / 8;
    const rr = 7 * (1 - t * 0.92) * 1.3;
    b.cylinder(rr, rr, 0.5, [cx, H + spireH * t, cz], neon(NEON.cyan), 16);
  }
  b.sphere(1.6, [cx, H + spireH + 1.6, cz], mats.beacons[0]);

  return H + spireH;
}

// ── 쌍둥이 타워 ────────────────────────────────────────────────────────────
//
// 두 동을 스카이브리지로 이은 형태. 사이의 빈 공간이 실루엣을 만든다 —
// 덩어리가 아니라 **구멍**이 정체성인 유일한 건물이다.
function twinTower(b, cx, cz, mats) {
  const H = 300;
  const halfW = 13;
  const halfD = 20;
  const gap = 19; // 두 동 사이

  const slab = mats.skins.slab;
  const sheet = [slab.sets[0].grid.cols * slab.pitch, slab.sets[0].grid.rows * FLOOR_HEIGHT];

  for (const s of [-1, 1]) {
    const x = cx + s * (gap / 2 + halfW);
    const r = { x0: x - halfW, x1: x + halfW, z0: cz - halfD, z1: cz + halfD };

    b.add(rectBox(r, 0, H, PANEL_TILE), mats.panelMat);
    for (const side of SIDES) {
      b.add(facePlane(r, 0.4, H - 0.8, side, sheet), slab.mats[0]);
    }
    // 세로 코어 띠 — 창이 없는 blank strip. 두 동을 같은 건물로 묶어 준다.
    b.box(3.2, H, halfD * 2 + 0.3, [x, H / 2, cz], mats.panelMat);

    // 옥상
    b.add(rectBox(shrink(r, -0.8), H, 2.2, PANEL_TILE), mats.panelMat);
    b.cylinder(0.3, 0.5, 34, [x, H + 19, cz], mats.metalMat, 6);
    b.sphere(0.9, [x, H + 36, cz], mats.beacons[1]);
  }

  // 스카이브리지 — 두 개. 높이를 달리해야 사다리처럼 안 보인다.
  for (const [by, bh] of [
    [H * 0.52, 7],
    [H * 0.82, 5],
  ]) {
    const r = { x0: cx - gap / 2 - 1, x1: cx + gap / 2 + 1, z0: cz - 7, z1: cz + 7 };
    b.add(rectBox(r, by, bh, PANEL_TILE), mats.panelMat);
    for (const side of SIDES) {
      b.add(facePlane(r, by + 0.6, bh - 1.2, side, sheet), slab.mats[1]);
      b.add(facePlane(r, by - 0.3, 0.3, side, null, 0.05), neon(NEON.magenta));
    }
  }

  return H + 36;
}

export function createLandmarks(scene, mats) {
  const b = new MeshBuilder('Landmarks');
  const out = [];

  for (const lm of LANDMARK_BLOCKS) {
    const cx = (lm.ix - 2.5) * PITCH;
    const cz = (lm.iz - 2.5) * PITCH;
    const apex = lm.kind === 'hq' ? hqTower(b, cx, cz, mats) : twinTower(b, cx, cz, mats);
    out.push({ kind: lm.kind, x: cx, z: cz, apex });
  }

  return { group: b.build(scene), list: out };
}
