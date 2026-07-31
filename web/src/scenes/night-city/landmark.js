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
import * as THREE from 'three';
import { MeshBuilder } from '../../core/builder.js';
import {
  SIDES, shrink, rectBox, facePlane, upPlane, downPlane, rectSize,
} from '../../core/boxfaces.js';
import { lathe, autoBox, tubeBetween } from '../../core/profile.js';
import { NEON, rgb01 } from '../../shared/neon.js';
import { neon, neonSoft } from '../../shared/masters.js';
import {
  blockCenter,
  blockRect,
  CURB_HEIGHT,
  FLOOR_HEIGHT,
  PANEL_TILE,
} from './layout.js';

// 랜드마크가 차지하는 블록. towers.js 는 이 블록을 건너뛴다.
//
// ── 격자가 6x6 이던 시절의 값을 고쳤다 ────────────────────────────────────
// (2,3)·(4,1) 은 6x6 격자에서 각각 도심 한가운데와 대각선 반대편이었다.
// 12x12 로 늘린 뒤에는 둘 다 변두리이고 서로 붙어 있다 (코어 거리 0.55·0.58).
// 위 머리말이 말하는 "도심 한가운데" 와 "대각선 반대편" 이 성립하지 않는다.
//
// 좌표 계산식(`(ix - 2.5) * PITCH`)도 같은 시절 것이라 함께 틀려 있었는데,
// 두 오류가 서로를 가려서 **결과적으로는 도심 근처에 서 있었다.** 식만
// 고치면 랜드마크가 변두리로 밀려나므로 블록도 같이 고친다.
// ── 배치 지도가 들어오면서 다시 옮겼다 ───────────────────────────────────
// 사용자 손그림대로 구역을 다시 칠했더니 (6,6) 이 **주거 구역 한복판**이
// 됐다. 기업 본사가 주택가에 홀로 서 있는 꼴이라 옮긴다.
//
// 이건 이 파일의 두 번째 이사다. 첫 번째는 격자를 6x6 -> 12x12 로 늘렸을
// 때였다. **손으로 찍은 좌표는 그 좌표가 무엇을 뜻했는지가 바뀌면 반드시
// 같이 틀린다** — 여기서 두 번 겪었으므로 그때마다 확인해야 한다.
//
// 지금 기업 구역은 ix 6~11 · iz 0~4 다 (district.PLAN).
// ── 번화가에도 랜드마크가 필요하다 (사용자 지시) ──────────────────────────
// "각 상업 지구에 랜드마크가 뭐가 있으면 좋을지 검토도 해봐 그걸 강조해야지"
//
// 지금까지 랜드마크는 기업 구역에만 둘 있었다. 그런데 이 도시에서 사람이
// 실제로 걷는 곳은 번화가고, **번화가 안에서 길을 잃는다.** 유형을 여덟으로
// 갈라도 전부 통계에서 나온 것이라 "저기가 저기다" 가 안 생긴다.
//
// 번화가는 둘로 나뉘어 있다 (market.marketSideOf).
//   안쪽 번화가  ix 1~5 · iz 4~7   명품관과 시장. 기업 쪽이 가깝다
//   북쪽 번화가  ix 8~11 · iz 5~8  유흥가·지하상가·암거래. 슬럼이 가깝다
//
// 그래서 각 번화가에 둘씩, **그 구역의 성격을 극단으로 민 것**을 하나씩 둔다.
// 랜드마크가 그 구역과 무관한 형태면 방향은 잡히지만 성격은 안 읽힌다.
//
//   백화점  명품관의 극단. 주변이 잡거빌딩인데 혼자 매끄럽고 조용하다
//   시장문  아케이드의 극단. 블록을 관통하는 큰 홀과 그 입구의 문
//   네온탑  유흥가의 극단. 몸통 전체가 간판인 110m 탑
//   중앙홀  지하상가의 극단. 지름 44m 짜리 구덩이와 유리 원뿔
//
// 자리는 성격에 맞춰 고른다 — 백화점은 기업에 가장 가까운 칸, 시장문은 그
// 반대쪽 끝, 중앙홀은 슬럼과 맞닿은 쪽 (market.weights 가 유형을 그렇게
// 뿌리므로 랜드마크도 같은 논리를 따라야 앞뒤가 맞는다).
export const LANDMARK_BLOCKS = [
  { ix: 7, iz: 1, kind: 'hq' },    // 기업 구역 안쪽
  { ix: 10, iz: 3, kind: 'twin' }, // 같은 구역 반대쪽 끝 (약 300m 떨어뜨린다)
  { ix: 5, iz: 4, kind: 'depot' }, // 안쪽 번화가 — 기업과 맞닿은 모서리
  { ix: 2, iz: 6, kind: 'gate' },  // 안쪽 번화가 — 기업에서 가장 먼 쪽
  { ix: 9, iz: 6, kind: 'neon' },  // 북쪽 번화가 한복판
  { ix: 10, iz: 8, kind: 'hall' }, // 북쪽 번화가 — 슬럼과 맞닿은 쪽
];

// 지면을 뚫어야 하는 랜드마크.
//
// `streets.js` 는 이 블록의 가운데 판을 안 깐다 — 지하상가 중앙홀은 구덩이가
// 본체인데 그 위에 보도판이 덮이면 통째로 안 보인다. 공사장 블록에서 똑같은
// 일을 이미 겪었고 (streets.js 51행), 그 처리를 그대로 쓴다.
//
// **판을 안 까는 대신 지면은 랜드마크가 직접 깐다.** 안 그러면 구멍만 남는다.
export const OPEN_GROUND = new Set(
  LANDMARK_BLOCKS.filter((l) => l.kind === 'hall').map((l) => `${l.ix},${l.iz}`)
);

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

// 회전한 상자.
//
// `autoBox` 는 축 정렬 상자만 다룬다 (모따기와 평면 투영 UV가 축을 전제한다).
// 원형 구덩이의 벽처럼 **한 바퀴 돌아가며 앉는 조각**은 회전이 필요하다.
// 회전을 조각마다 손으로 삼각함수로 쓰면 반드시 어딘가 틀리므로 (이 프로젝트
// 에서 이미 두 번 틀렸다 — slum.js 머리말) 여기 하나만 둔다.
//
// ── 축이 어디로 가는지 (한 번 틀렸다) ─────────────────────────────────────
// 각도 a0 자리의 조각에 `yaw = -a0` 을 걸면
//
//   w (지역 X) -> **반지름 방향**   (cos a0, 0, sin a0)
//   d (지역 Z) -> **접선 방향**     (-sin a0, 0, cos a0)
//
// 처음에 반대로 알고 호(弧) 길이를 w 에 넣었다. 그러면 벽 조각이 폭 0.6m 짜리
// 살이 되어 **바깥으로 삐죽 뻗고 벽 사이가 전부 뚫린다** — 구덩이가 통째로
// 검은 구멍이 됐고, 안에 지은 지하 상가 세 층이 하나도 안 보였다.
// 즉 **w 는 반지름 방향 두께, d 는 호 길이**다.
function yawBox(w, h, d, at, yaw) {
  const g = new THREE.BoxGeometry(w, h, d);
  g.rotateY(yaw);
  g.translate(at[0], at[1], at[2]);
  return g;
}

// ── 3) 명품 백화점 ─────────────────────────────────────────────────────────
//
// 안쪽 번화가, 기업과 맞닿은 모서리. **주변과 정반대인 것**이 이 건물의 전부다.
//
// 번화가의 모든 건물은 간판으로 덮여 있고 밝고 시끄럽다. 이것은 간판이
// **하나**고, 매끄럽고, 조용하다. 그 대비가 "여기는 다른 돈이 도는 곳" 을
// 말한다 — 명품관 유형(vitrine)이 하는 일을 크기로 밀어붙인 것이다.
//
// 모서리를 깎아 8각형 실루엣으로 만든다. 번화가에 직각 아닌 것은 이것뿐이라
// 멀리서도 이것만 다르게 보인다.
function depot(b, cx, cz, mats, pools) {
  const Y = CURB_HEIGHT;
  const H = 66;
  const half = 25;
  const cut = 7; // 모서리를 깎는 길이

  // 광장 — 비워 둔 땅. 번화가에서 빈 땅은 그 자체로 과시다
  b.add(upPlane(half * 2 + 22, half * 2 + 22, [cx, Y + 0.03, cz], [4, 4]), mats.plazaMat);

  const body = { x0: cx - half, x1: cx + half, z0: cz - half, z1: cz + half };

  // 몸통 — 통유리. 저층 3개층만 밝고 위는 차갑다
  b.add(rectBox(body, Y, H, PANEL_TILE), mats.panelMat);
  const curtain = mats.skins.curtain;
  const sheet = [
    curtain.sets[0].grid.cols * curtain.pitch,
    curtain.sets[0].grid.rows * FLOOR_HEIGHT,
  ];
  for (const side of SIDES) {
    b.add(facePlane(body, Y + 16, H - 17, side, sheet), curtain.mats[1]);
    // 쇼윈도 위 차양
    b.add(facePlane(shrink(body, -3.2), Y + 15.2, 1.1, side, null, 0.04), mats.metalMat);
  }

  // ── 저층 쇼윈도 ──────────────────────────────────────────────────────────
  //
  // ── 두 번 틀린 곳이다. 둘 다 적어 둔다 ─────────────────────────────────
  //
  // 1) 발광면을 벽 **안쪽** 0.8m 에 뒀다 → 속 찬 상자 안이라 안 보였다.
  //    상자 안에 넣은 램프다. 주거 현관에서 똑같이 겪고 적어 놓고도 또 했다
  //    (shopfront.entranceBay 머리말).
  //
  // 2) 그 앞에 `vitrineGlassMat` 판을 세웠다 → **그 판이 발광면을 가렸다.**
  //    이 재질은 색 0x0c0d12 짜리 **불투명** 금속면이다. 유리 '표면' 을
  //    흉내낸 것이지 비쳐 보이는 유리가 아니다.
  //    **이름이 Glass 라고 투명한 것이 아니다** — 재질을 이름으로 믿지 않는다.
  //
  // 그래서 이 도시의 다른 점포와 같은 방식으로 간다. **보이는 면이 곧
  // 발광면**이고, 유리는 그 둘레의 어두운 테로만 암시한다.
  const SHOWCASE = 13.5;
  const bays = 7;
  for (const side of SIDES) {
    const az = side === 'px' || side === 'nx';
    const sg = side === 'px' || side === 'pz' ? 1 : -1;
    for (let i = 0; i < bays; i++) {
      const u = -half + ((half * 2) / bays) * (i + 0.5);
      const bw = (half * 2) / bays;
      const px = az ? cx + sg * half : cx + u;
      const pz = az ? cz + u : cz + sg * half;
      const oy = Y + 1.2 + SHOWCASE / 2;
      // 어두운 테 — 유리면. 발광면보다 크고 **뒤에** 있다
      b.add(
        autoBox(az ? 0.24 : bw - 0.3, SHOWCASE + 1.0, az ? bw - 0.3 : 0.24,
          [px + (az ? sg * 0.12 : 0), oy, pz + (az ? 0 : sg * 0.12)], 0.02),
        mats.vitrineGlassMat
      );
      // 매장 — 밝다. 거리에서 가장 밝은 것이 이 층이어야 한다
      b.add(
        autoBox(az ? 0.2 : bw - 1.5, SHOWCASE - 1.0, az ? bw - 1.5 : 0.2,
          [px + (az ? sg * 0.36 : 0), oy, pz + (az ? 0 : sg * 0.36)], 0.02),
        mats.lobbyLitMat
      );
      // 선대 — 칸을 끊는다. 없으면 한 장짜리 발광 띠다
      b.box(az ? 0.75 : 0.6, SHOWCASE + 1.4, az ? 0.6 : 0.75,
        [az ? px + sg * 0.4 : cx + u - bw / 2, oy, az ? cz + u - bw / 2 : pz + sg * 0.4],
        mats.metalMat);

      // ── 진열 ─────────────────────────────────────────────────────────────
      // 발광판만 두면 **빛나는 흰 사각형 다섯 장**이다. 밝기는 맞는데
      // 쇼윈도가 아니라 라이트박스로 보인다. 진열창을 진열창으로 만드는 것은
      // 밝기가 아니라 **그 앞에 선 실루엣**이다 — 밝은 바탕에 어두운 사람
      // 형상이 서면 그 순간 "안을 들여다보는" 그림이 된다.
      //
      // 크기를 사람 크기로 둔다. 처음에 키 7.6m 짜리를 세웠더니 실루엣은
      // 생겼는데 **건물이 절반 크기로 읽혔다** — 크기를 아는 물건은 옆에
      // 있는 것의 크기를 정한다. 스케일을 알려 주라고 넣은 것이 스케일을
      // 망가뜨리면 안 넣느니만 못하다.
      for (const m of [-1, 0, 1]) {
        const mu = u + m * bw * 0.26;
        const mxp = az ? px + sg * 0.62 : cx + mu;
        const mzp = az ? cz + mu : pz + sg * 0.62;
        const base = Y + 0.6;
        b.cylinder(0.12, 0.17, 1.0, [mxp, base + 0.5, mzp], mats.mannequinMat, 7);
        b.add(autoBox(0.46, 0.78, 0.3, [mxp, base + 1.42, mzp], 0.07), mats.mannequinMat);
        b.sphere(0.14, [mxp, base + 1.95, mzp], mats.mannequinMat);
      }
      // 진열 단 — 실루엣이 딛고 선 자리
      b.add(
        autoBox(az ? 1.5 : bw - 1.9, 0.5, az ? bw - 1.9 : 1.5,
          [az ? px + sg * 0.8 : cx + u, Y + 0.35, az ? cz + u : pz + sg * 0.8], 0.04),
        mats.plazaStepMat
      );
      // 층 나눔 — 쇼윈도가 2개 층이라는 표시. 한 장짜리 유리벽과 갈린다
      b.box(az ? 0.9 : bw - 0.6, 0.45, az ? bw - 0.6 : 0.9,
        [az ? px + sg * 0.45 : cx + u, Y + 8.6, az ? cz + u : pz + sg * 0.45],
        mats.metalMat);
    }
    pools.push({
      kind: 'floor',
      x: az ? cx + sg * (half + 5) : cx,
      y: Y + 0.05,
      z: az ? cz : cz + sg * (half + 5),
      rx: az ? 9 : half, rz: az ? half : 9,
      tint: rgb01(NEON.cool, 0.7),
    });
  }

  // 깎은 모서리 — 45도로 세운 벽. 판때기로 두면 두께가 없어 안 읽히므로
  // 실제로 두꺼운 덩어리를 앉힌다 (골목 벽에서 같은 실수를 한 적이 있다).
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const px = cx + sx * (half - cut / 2);
      const pz = cz + sz * (half - cut / 2);
      b.add(
        yawBox(cut * 1.6, H, cut * 1.6, [px, Y + H / 2, pz], (Math.PI / 4) * -sx * sz),
        mats.panelMat
      );
      // 모서리 광주 — 여덟 각을 밤에 읽히게
      b.add(
        yawBox(0.8, H - 2, 0.8, [px + sx * cut * 0.42, Y + H / 2, pz + sz * cut * 0.42], 0),
        neon(NEON.cool)
      );
    }
  }

  // 지붕 로고 큐브 — 간판은 이것 하나뿐이다. 그래서 거대해야 한다
  const CUBE = 17;
  b.box(CUBE, CUBE, CUBE, [cx, Y + H + CUBE / 2 + 2, cz], neonSoft(NEON.cool));
  b.add(
    autoBox(CUBE + 1.2, 1.0, CUBE + 1.2, [cx, Y + H + 1.6, cz], 0.05),
    mats.metalMat
  );
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      b.box(0.7, CUBE + 2, 0.7,
        [cx + sx * CUBE * 0.5, Y + H + CUBE / 2 + 2, cz + sz * CUBE * 0.5], mats.metalMat);
    }
  }

  // 정면 계단과 캐노피 — 들어가는 곳이 하나뿐인 것도 이 유형의 표식이다
  for (let i = 0; i < 4; i++) {
    b.box(20 - i * 1.4, 0.34, 9 - i * 1.6, [cx, Y + 0.17 + i * 0.34, cz + half + 5.5 - i * 0.8],
      mats.plazaStepMat);
  }
  b.box(24, 0.9, 8.5, [cx, Y + 7.4, cz + half + 5.0], mats.metalMat);
  b.add(downPlane(22, 7.5, [cx, Y + 6.9, cz + half + 5.0]), mats.deckUnderMat);
  for (const sx of [-1, 1]) {
    b.cylinder(0.4, 0.4, 7.0, [cx + sx * 10, Y + 3.5, cz + half + 8.4], mats.metalMat, 10);
  }

  pools.push({ kind: 'floor', x: cx, y: Y + 0.05, z: cz + half + 8, rx: 20, rz: 14,
    tint: rgb01(NEON.cool, 0.55) });
  pools.push({ kind: 'floor', x: cx, y: Y + 0.05, z: cz, rx: half + 12, rz: half + 12,
    tint: rgb01(NEON.cool, 0.22) });

  return Y + H + CUBE + 2;
}

// ── 4) 시장 대문과 대형 홀 ─────────────────────────────────────────────────
//
// 안쪽 번화가, 기업에서 가장 먼 쪽. **블록을 관통하는 길**이 본체다.
//
// 아케이드 유형(market.arcade)이 하는 일 — 덮인 길, 안이 밖보다 밝음 — 을
// 블록 하나 크기로 키운 것이다. 그리고 그 입구에 **문**을 세운다.
// 문은 기능이 없다. 오직 "여기부터 다른 곳" 을 선언하려고 있는 구조물이고,
// 그래서 랜드마크의 정의에 가장 가깝다.
function marketGate(b, cx, cz, mats, pools) {
  const Y = CURB_HEIGHT;
  const R = blockRect(0, 0); // 크기만 쓴다
  const s = rectSize(R);
  const LEN = s.w * 0.94;   // 관통 방향 (X)
  const WID = 26;           // 홀 폭
  const H = 17;             // 홀 높이

  // 바닥 — 홀 안은 포장이 다르다
  b.add(upPlane(LEN, WID, [cx, Y + 0.04, cz], [6, 3]), mats.tileWallMat);

  // 양옆 벽 — 안쪽에 점포가 붙는다
  const T = 5.5;
  for (const sg of [-1, 1]) {
    const wr = {
      x0: cx - LEN / 2, x1: cx + LEN / 2,
      z0: cz + sg * (WID / 2), z1: cz + sg * (WID / 2 + T),
    };
    if (wr.z0 > wr.z1) { const t = wr.z0; wr.z0 = wr.z1; wr.z1 = t; }
    b.add(rectBox(wr, Y, H, PANEL_TILE), mats.tileWallMat);
    // 점포 띠 — 안을 향해 발광. 손으로 놓으므로 간격이 정확하다
    const bays = 14;
    for (let i = 0; i < bays; i++) {
      const px = cx - LEN / 2 + (LEN / bays) * (i + 0.5);
      const pz = cz + sg * (WID / 2 - 0.12);
      b.add(
        autoBox(LEN / bays - 0.7, 3.1, 0.16, [px, Y + 2.0, pz], 0.02),
        i % 5 === 3 ? mats.shutterMat
          : mats.shopfrontBrightMats[i % mats.shopfrontBrightMats.length]
      );
      // 층 간판
      b.box(LEN / bays - 1.4, 0.9, 0.14, [px, Y + 4.5, pz],
        neonSoft([NEON.magenta, NEON.cyan, NEON.amber, NEON.pink][i % 4]));
      // 2층 — 홀이 높으니 위에도 가게가 있다
      b.add(
        autoBox(LEN / bays - 0.9, 2.6, 0.14, [px, Y + 8.2, pz], 0.02),
        i % 3 === 1 ? mats.shutterMat : mats.shopfrontMats[i % mats.shopfrontMats.length]
      );
    }
    // 2층 복도
    b.box(LEN, 0.22, 2.2, [cx, Y + 6.6, cz + sg * (WID / 2 - 1.1)], mats.grateMat);
    for (const hy of [0.55, 1.05]) {
      b.box(LEN, 0.07, 0.07, [cx, Y + 6.6 + hy, cz + sg * (WID / 2 - 2.2)], mats.pipeMat);
    }
  }

  // 지붕 — 아치를 트러스 셋으로 근사한다. 이 지붕이 아케이드의 주인공이다
  const arches = 13;
  for (let i = 0; i <= arches; i++) {
    const px = cx - LEN / 2 + (LEN / arches) * i;
    b.add(tubeBetween([px, Y + H, cz - WID / 2], [px, Y + H + 4.4, cz], 0.22, 6), mats.metalMat);
    b.add(tubeBetween([px, Y + H + 4.4, cz], [px, Y + H, cz + WID / 2], 0.22, 6), mats.metalMat);
    // 채광 지붕판
    for (const sg of [-1, 1]) {
      const g = upPlane(LEN / arches, WID / 2, [px + LEN / arches / 2, Y + H + 2.2, cz + sg * WID / 4], [1, 1]);
      b.add(g, mats.deckUnderMat);
    }
  }
  // 마룻대
  b.add(tubeBetween([cx - LEN / 2, Y + H + 4.4, cz], [cx + LEN / 2, Y + H + 4.4, cz], 0.3, 8), mats.metalMat);
  // 매달린 등롱 — 홀 안이 밖보다 밝아야 한다
  for (let i = 0; i < 22; i++) {
    const px = cx - LEN / 2 + (LEN / 22) * (i + 0.5);
    const pz = cz + (i % 3 - 1) * 6.5;
    b.add(tubeBetween([px, Y + H + 3.4, pz], [px, Y + 9.2, pz], 0.03, 4), mats.cableMat);
    b.cylinder(0.55, 0.55, 1.1, [px, Y + 8.6, pz], neon(NEON.warm), 10);
    pools.push({ kind: 'floor', x: px, y: Y + 0.06, z: pz, rx: 6.5, rz: 6.5,
      tint: rgb01(NEON.warm, 0.5) });
  }

  // ── 대문 — 양 끝에 하나씩 ────────────────────────────────────────────────
  // 26m. 홀보다 훨씬 높다. 문이 건물보다 커야 문으로 읽힌다.
  for (const sg of [-1, 1]) {
    const gx = cx + sg * (LEN / 2 + 1.5);
    const GH = 26;
    const GW = WID + 13;
    // 기둥 둘
    for (const sz of [-1, 1]) {
      b.box(3.4, GH, 4.6, [gx, Y + GH / 2, cz + sz * GW / 2], mats.frameConcMat);
      // 기둥 발광 띠 — 세로로 길게
      b.box(0.5, GH - 4, 0.5, [gx + sg * 2.0, Y + GH / 2, cz + sz * (GW / 2 - 2.5)],
        neon(NEON.amber));
    }
    // 상인방 — 두껍다
    b.box(5.2, 5.4, GW + 4.6, [gx, Y + GH - 2.7, cz], mats.frameConcMat);
    // 현판 — 문 하나에 하나. 이 도시에서 가장 큰 단일 간판
    b.box(0.5, 4.0, GW - 2, [gx + sg * 2.7, Y + GH - 2.9, cz], neonSoft(NEON.magenta));
    // 처마 — 앞으로 길게 나온다
    b.add(autoBox(7.0, 0.7, GW + 8, [gx + sg * 3.0, Y + GH + 0.6, cz], 0.05), mats.rustMat);
    b.add(downPlane(6.0, GW + 6, [gx + sg * 3.0, Y + GH + 0.2, cz]), mats.deckUnderMat);
    // 매달린 등롱 줄 — 문 아래를 지나는 사람에게 닿는 높이
    for (let i = 0; i < 9; i++) {
      const pz = cz - GW / 2 + (GW / 9) * (i + 0.5);
      b.add(tubeBetween([gx, Y + GH - 5.4, pz], [gx, Y + 6.2, pz], 0.03, 4), mats.cableMat);
      b.cylinder(0.62, 0.62, 1.3, [gx, Y + 5.5, pz], neon(NEON.amber), 10);
    }
    pools.push({ kind: 'floor', x: gx, y: Y + 0.05, z: cz, rx: 12, rz: GW / 2 + 4,
      tint: rgb01(NEON.amber, 0.6) });
  }

  return Y + 26 + 1.5;
}

// ── 5) 네온 탑 ─────────────────────────────────────────────────────────────
//
// 북쪽 번화가 한복판. 유흥가 유형(market.nightlife)의 극단이다.
//
// 유흥가 건물은 **벽이 막혀 있고 세로 간판이 붙는다** — 안을 안 보여주는
// 것이 그 장사의 방식이라 창이 없다. 그것을 110m 로 올리면, 창 없는 몸통
// 전체가 간판이 되는 탑이 나온다. 도시에서 유일하게 **건물이 곧 광고**다.
function neonTower(b, cx, cz, mats, pools) {
  const Y = CURB_HEIGHT;
  const H = 110;
  const half = 11; // 좁다. 좁아야 높이가 읽힌다

  const body = { x0: cx - half, x1: cx + half, z0: cz - half, z1: cz + half };
  b.add(rectBox(body, Y, H, PANEL_TILE), mats.tileWallMat);

  // 가로 간판 띠 — 3.4m 마다. 위로 갈수록 색이 식는다
  const HUES = [NEON.magenta, NEON.pink, NEON.violet, NEON.cyan, NEON.amber];
  const bands = Math.floor((H - 14) / 3.4);
  for (let i = 0; i < bands; i++) {
    const y = Y + 12 + i * 3.4;
    for (const side of SIDES) {
      b.add(facePlane(shrink(body, -0.5), y, 2.5, side, null, 0),
        i % 7 === 5 ? mats.shutterMat : neonSoft(HUES[i % HUES.length]));
      b.add(facePlane(shrink(body, -0.9), y - 0.45, 0.45, side, null, 0.03), mats.metalMat);
    }
  }

  // 네 모서리의 세로 간판 기둥 — 꼭대기까지 끊기지 않는다
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      b.box(2.4, H - 8, 2.4, [cx + sx * (half + 0.6), Y + (H - 8) / 2 + 4, cz + sz * (half + 0.6)],
        mats.frameConcMat);
      for (let i = 0; i < 26; i++) {
        const y = Y + 8 + i * 3.7;
        if (y > Y + H - 6) break;
        // 색인은 반드시 양수로 만든다. `(i + sx + sz)` 는 sx=sz=-1 일 때
        // 음수가 되고, 자바스크립트의 % 는 음수를 그대로 돌려주므로
        // HUES[-2] === undefined 가 된다 — 빌드가 통째로 죽었다.
        const hi = (i + (sx > 0 ? 1 : 0) + (sz > 0 ? 2 : 0)) % HUES.length;
        b.box(2.9, 2.6, 2.9, [cx + sx * (half + 0.9), y, cz + sz * (half + 0.9)],
          i % 5 === 2 ? mats.shutterMat : neon(HUES[hi]));
      }
    }
  }

  // 관(冠) — 꼭대기. 링 셋과 방사형 날. 이 실루엣이 멀리서 보이는 전부다
  for (let i = 0; i < 3; i++) {
    const rr = 16 - i * 4;
    b.cylinder(rr, rr, 1.2, [cx, Y + H + 4 + i * 6, cz], neon(NEON.magenta), 24);
  }
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const ex = cx + Math.cos(a) * 20;
    const ez = cz + Math.sin(a) * 20;
    b.add(tubeBetween([cx, Y + H + 10, cz], [ex, Y + H + 20, ez], 0.28, 5), neon(NEON.cyan));
  }
  b.cylinder(1.1, 1.1, 26, [cx, Y + H + 29, cz], mats.metalMat, 8);
  b.sphere(1.4, [cx, Y + H + 43, cz], mats.beacons[0]);

  // 1층 — 넓은 캐노피와 대기줄 난간. 줄이 선다는 것이 유흥가의 증거다
  b.add(autoBox(half * 2 + 14, 1.0, half * 2 + 14, [cx, Y + 7.6, cz], 0.05), mats.metalMat);
  b.add(downPlane(half * 2 + 11, half * 2 + 11, [cx, Y + 7.0, cz]), mats.deckUnderMat);
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      b.cylinder(0.42, 0.42, 7.2, [cx + sx * (half + 5), Y + 3.6, cz + sz * (half + 5)],
        mats.metalMat, 10);
    }
  }
  for (let i = 0; i < 8; i++) {
    const pz = cz - half + (half * 2 / 8) * i;
    b.cylinder(0.09, 0.11, 1.0, [cx + half + 6.5, Y + 0.5, pz], mats.metalMat, 8);
    b.box(0.06, 0.06, half * 2 / 8, [cx + half + 6.5, Y + 0.95, pz + half / 8], mats.pipeMat);
  }
  // 입구 — 좁고 깊고 밝다
  b.add(autoBox(5.4, 5.2, 0.3, [cx, Y + 2.6, cz - half - 0.1], 0.03), mats.lobbyLitMat);
  for (const sx of [-1, 1]) {
    b.box(0.7, 5.6, 1.4, [cx + sx * 2.9, Y + 2.8, cz - half - 0.4], mats.metalMat);
  }

  pools.push({ kind: 'floor', x: cx, y: Y + 0.05, z: cz, rx: half + 16, rz: half + 16,
    tint: rgb01(NEON.magenta, 0.75) });
  pools.push({ kind: 'floor', x: cx, y: Y + 0.06, z: cz - half - 5, rx: 9, rz: 8,
    tint: rgb01(NEON.cool, 0.5) });

  return Y + H + 44;
}

// ── 6) 지하상가 중앙홀 ─────────────────────────────────────────────────────
//
// 북쪽 번화가, 슬럼과 맞닿은 쪽. 지하상가 유형(market.underpass)의 극단이다.
//
// 이 도시에는 **지면과 공중만** 있다 (과제 #26 의 아래쪽 짝). 진입구 하나로는
// "밑에 뭔가 있다" 까지밖에 안 되고, 지름 44m 짜리 구덩이를 뚫어 벽면 3개
// 층에 상가를 붙이면 **아래에 도시가 한 겹 더 있다** 가 된다.
//
// 랜드마크로서의 정체는 가운데 유리 원뿔이다. 낮에는 채광창이고 밤에는
// 아래에서 새어 나오는 빛이 통째로 서 있는 원뿔이 된다 — 도시에서 유일하게
// **아래에서 위로 빛나는** 것이다.
function undergroundHall(b, cx, cz, mats, pools) {
  const Y = CURB_HEIGHT;
  const R = 22;      // 구덩이 반지름
  const DEPTH = 13;  // 깊이
  const FL = 4.0;    // 지하 층고

  // ── 광장이 곧 이 블록의 지면이다 ────────────────────────────────────────
  //
  // `streets.js` 는 이 블록 가운데에 보도판을 **안 깐다** (OPEN_GROUND).
  // 안 그러면 구덩이 위에 불투명한 판이 덮여 통째로 안 보인다 — 공사장
  // 구덩이에서 이미 겪은 일이고, 그래서 그 구조를 그대로 빌린다.
  //
  // 대신 여기가 지면을 책임진다. 사각 블록에서 원형 구덩이를 뺀 모양이라
  // 둘로 나눠 깐다.
  //   1) 사각 고리   바깥 66m, 안쪽 44m
  //   2) 방사 조각   안쪽 44m 사각에서 반지름 22m 원을 뺀 나머지
  const HALF_B = 33;
  const INNER = 22;
  for (const [dx, dz, w, d] of [
    [0, -(HALF_B + INNER) / 2, HALF_B * 2, HALF_B - INNER],
    [0, (HALF_B + INNER) / 2, HALF_B * 2, HALF_B - INNER],
    [-(HALF_B + INNER) / 2, 0, HALF_B - INNER, INNER * 2],
    [(HALF_B + INNER) / 2, 0, HALF_B - INNER, INNER * 2],
  ]) {
    b.add(upPlane(w, d, [cx + dx, Y + 0.04, cz + dz], [4, 4]), mats.plazaMat);
  }
  const seg = 28;
  for (let i = 0; i < seg; i++) {
    const a0 = (i / seg) * Math.PI * 2;
    const mid = R + 4.9; // 22 -> 31.6. 사각 모서리(31.1)를 막 덮는다
    const px = cx + Math.cos(a0) * mid;
    const pz = cz + Math.sin(a0) * mid;
    b.add(yawBox(10.4, 0.12, (2 * Math.PI * mid) / seg + 0.6, [px, Y + 0.04, pz], -a0),
      mats.plazaMat);
  }

  // 구덩이 벽 — 원기둥. 벽면에 지하 상가 세 층이 붙는다
  for (let i = 0; i < seg; i++) {
    const a0 = (i / seg) * Math.PI * 2;
    const px = cx + Math.cos(a0) * R;
    const pz = cz + Math.sin(a0) * R;
    const w = (2 * Math.PI * R) / seg + 0.4;
    b.add(yawBox(0.6, DEPTH, w, [px, Y - DEPTH / 2, pz], -a0),
      mats.tileWallMat);
    // 층마다 점포 띠 — 아래에서 빛이 샌다
    for (let f = 0; f < 3; f++) {
      const y = Y - DEPTH + 0.8 + f * FL;
      const lit = (i + f) % 4 !== 2;
      b.add(
        yawBox(0.22, 2.5, w - 0.9, [px - Math.cos(a0) * 0.45, y + 1.25, pz - Math.sin(a0) * 0.45], -a0),
        lit ? mats.shopfrontBrightMats[(i + f) % mats.shopfrontBrightMats.length] : mats.shutterMat
      );
      // 난간
      b.add(yawBox(0.1, 0.1, w, [px - Math.cos(a0) * 3.2, y + 3.4, pz - Math.sin(a0) * 3.2], -a0), mats.pipeMat);
    }
    // 회랑 바닥 — 층마다 도넛
    for (let f = 1; f < 3; f++) {
      const y = Y - DEPTH + 0.8 + f * FL;
      b.add(yawBox(3.6, 0.24, w, [px - Math.cos(a0) * 1.8, y, pz - Math.sin(a0) * 1.8], -a0), mats.grateMat);
    }
  }
  // 바닥
  b.add(upPlane(R * 1.7, R * 1.7, [cx, Y - DEPTH + 0.1, cz], [4, 4]), mats.wetConcreteMat);

  // 유리 원뿔 — 구덩이 한가운데에서 솟는다. 이 랜드마크의 얼굴
  const CONE = 27;
  // ── 원뿔은 빛나야 한다 ───────────────────────────────────────────────────
  // 처음에 `vitrineGlassMat` 로 만들었더니 **검은 천막**이 됐다. 이 재질은
  // 불투명한 어두운 금속면이라, 아래에서 빛이 새어 나오는 채광창이 될 수가
  // 없다 (백화점 쇼윈도에서 같은 착각을 이미 한 번 했다).
  //
  // 이 도시에서 유일하게 **아래에서 위로** 빛나는 것이라는 설정이 곧
  // 재질을 정한다 — 발광면이어야 한다. 유리 느낌은 갈빗대가 만든다.
  b.add(lathe([[9.5, 0], [8.2, CONE * 0.34], [5.6, CONE * 0.66], [2.4, CONE * 0.9], [0, CONE]],
    20, [cx, Y - DEPTH + 0.2, cz]), neonSoft(NEON.cool));
  // 갈빗대 — 유리만 두면 덩어리다. 살이 있어야 구조물로 읽힌다
  for (let i = 0; i < 10; i++) {
    const a0 = (i / 10) * Math.PI * 2;
    b.add(tubeBetween(
      [cx + Math.cos(a0) * 9.5, Y - DEPTH + 0.2, cz + Math.sin(a0) * 9.5],
      [cx, Y - DEPTH + CONE, cz], 0.16, 5), mats.metalMat);
  }
  b.sphere(1.0, [cx, Y - DEPTH + CONE + 1.0, cz], neon(NEON.cool));

  // 계단 넷 — 사방에서 내려간다. 진입구가 여럿인 것이 '중앙홀' 의 조건이다
  for (let q = 0; q < 4; q++) {
    const a0 = (q / 4) * Math.PI * 2 + Math.PI / 4;
    const ux = Math.cos(a0);
    const uz = Math.sin(a0);
    const steps = 18;
    for (let i = 0; i < steps; i++) {
      const t = i / steps;
      const d = R + 7 - t * 13;
      b.add(yawBox(13 / steps + 0.2, 0.3, 7.0,
        [cx + ux * d, Y - 0.2 - t * (DEPTH - 0.6), cz + uz * d], -a0),
        mats.plazaStepMat);
    }
    // 계단 옆 난간과 등
    for (const sg of [-1, 1]) {
      const ox = -uz * sg * 3.8;
      const oz = ux * sg * 3.8;
      b.add(tubeBetween(
        [cx + ux * (R + 7) + ox, Y + 1.0, cz + uz * (R + 7) + oz],
        [cx + ux * (R - 6) + ox, Y - DEPTH + 1.6, cz + uz * (R - 6) + oz], 0.07, 5), mats.pipeMat);
    }
    // 입구 캐노피와 간판 — 지상에서 이것만 보인다
    const ex = cx + ux * (R + 9);
    const ez = cz + uz * (R + 9);
    b.add(yawBox(4.2, 0.7, 11, [ex, Y + 5.2, ez], -a0), mats.metalMat);
    b.add(yawBox(0.3, 1.5, 9.5, [ex, Y + 6.4, ez], -a0), neonSoft(NEON.cyan));
    for (const sg of [-1, 1]) {
      b.cylinder(0.28, 0.28, 5.0, [ex - uz * sg * 5.0, Y + 2.5, ez + ux * sg * 5.0],
        mats.metalMat, 8);
    }
    pools.push({ kind: 'floor', x: ex, y: Y + 0.05, z: ez, rx: 9, rz: 9,
      tint: rgb01(NEON.cyan, 0.55) });
  }

  // 가장자리 기둥등 — 구덩이 둘레를 표시한다. 밤에 이 링이 자리를 알린다
  for (let i = 0; i < 16; i++) {
    const a0 = (i / 16) * Math.PI * 2;
    const px = cx + Math.cos(a0) * (R + 2.6);
    const pz = cz + Math.sin(a0) * (R + 2.6);
    b.cylinder(0.14, 0.16, 4.2, [px, Y + 2.1, pz], mats.metalMat, 8);
    b.sphere(0.32, [px, Y + 4.3, pz], neon(NEON.cool));
  }

  pools.push({ kind: 'floor', x: cx, y: Y - DEPTH + 0.15, z: cz, rx: R, rz: R,
    tint: rgb01(NEON.cool, 0.8) });

  return Y - DEPTH + CONE + 2;
}

// 종류 -> 생성기. 표로 두면 **빠뜨린 종류가 즉시 터진다.**
// 전에는 `kind === 'hq' ? hqTower : twinTower` 라 세 번째 종류를 더하는 순간
// 조용히 쌍둥이 타워가 섰을 것이다 — `??` 로 값을 때우지 않는다는 규칙
// (status.md 2.1 규칙 4) 과 같은 종류의 함정이다.
const BUILDERS = {
  hq: hqTower,
  twin: twinTower,
  depot,
  gate: marketGate,
  neon: neonTower,
  hall: undergroundHall,
};

export function createLandmarks(scene, mats) {
  const b = new MeshBuilder('Landmarks');
  const out = [];
  const pools = [];

  for (const lm of LANDMARK_BLOCKS) {
    // ── 블록 중심은 blockCenter 가 유일한 출처다 ──────────────────────────
    // 전에는 `(ix - 2.5) * PITCH` 였다. GRID 가 6 이던 시절의 식이고
    // ((6-1)/2 = 2.5), 격자가 12x12 에 구간별 피치로 바뀐 뒤로는 완전히
    // 틀린 좌표를 준다.
    //
    // towers.js 는 LANDMARK_BLOCKS 의 블록을 **비워 두는데** 랜드마크는
    // 엉뚱한 자리에 섰다. 즉 그 블록에는 구멍이 뚫리고, 420m 짜리 본사
    // 타워는 이미 건물이 선 다른 블록 위에 겹쳐 있었다.
    const cx = blockCenter(lm.ix);
    const cz = blockCenter(lm.iz);
    const make = BUILDERS[lm.kind];
    if (!make) throw new Error(`랜드마크 종류 '${lm.kind}' 의 생성기가 없다`);
    b.mark('building', `landmark:${lm.kind}`, { zone: '랜드마크' });
    const apex = make(b, cx, cz, mats, pools);
    out.push({ kind: lm.kind, x: cx, z: cz, apex });
  }
  b.endMark();

  return { group: b.build(scene), list: out, pools };
}
