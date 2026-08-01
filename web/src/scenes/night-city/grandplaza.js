// 광장 번화가 — 도시의 목적지.
//
// ── 무엇을 만드는가 ───────────────────────────────────────────────────────
// 시장 대문을 지나면 나오는 큰 광장. 십자 보행로가 가로지르고, 그 교차점이
// 턱으로 두른 안뜰이며, 안뜰 한가운데에 수경이 있다. 네 변을 상가가 두른다.
//
// 자리와 치수는 `plaza.js` 가 정한다. 여기는 **그 사각형 안을 채우기만** 한다.
//
// ── 왜 '광장' 이 지금까지 없었는가 ────────────────────────────────────────
// program.plaza 가 있긴 하다. 블록 하나에 조형물 하나와 벤치 몇 개다. 그건
// 광장이 아니라 **쌈지공원**이다. 도시에 목적지가 되려면 세 가지가 있어야
// 한다:
//
//   둘레   광장은 비어 있는 곳이 아니라 **둘러싸인 곳**이다. 상가가 벽이다
//   중심   눈이 멈출 곳. 수경이 그 일을 한다 — 물은 이 도시에 거의 없다
//   높이차 바닥이 끝까지 평평하면 '빈 블록' 으로 읽힌다
//
// 셋 중 '둘레' 가 제일 중요하다. 그래서 상가를 여기서 직접 짓는다 — 광장이
// 블록 경계를 넘어 앉으므로 이웃 대지에게 맡길 수가 없다.
//
// ── 조경 (사용자 지시: "조경을 점검할 수 있도록") ─────────────────────────
// 실측해 보니 번화가에 초목이 **하나도 없었다.** 있는 것은 program.plaza 의
// 화단 구체 세 개와 통로의 가로수, 그리고 holo.digitalTree — 마지막 것은
// 빛나는 선이지 식물이 아니다.
//
// 사이버펑크에서 초목은 '자연' 이 아니라 **관리되는 자산**이다. 그래서 땅에
// 심지 않고 전부 화분·플랜터에 담아 열을 맞춘다. 그 인공성이 요점이다.
import { autoBox, lathe } from '../../core/profile.js';
import { upPlane, rectSize } from '../../core/boxfaces.js';
import { CURB_HEIGHT } from './layout.js';
import {
  PLAZA, INNER, ARMS, CROSSING, arcadeBars, emptyRoadRects, precinctHits,
  PLAZA_IX, PLAZA_IZ,
} from './plaza.js';
import { allWalks } from './parcel.js';
import { districtAt } from './district.js';
import { bazaarBlock } from './bazaar.js';
import { NEON, rgb01 } from '../../shared/neon.js';
import { neon, neonSoft } from '../../shared/masters.js';

const Y = CURB_HEIGHT;

// ── 땅을 팔 수 없다 (실측으로 알아낸 것) ─────────────────────────────────
//
// 처음 설계는 안뜰을 1.8m **내려앉히는** 것이었다. 계단 네 단, 단코 조명,
// 그 아래 수반까지 다 만들었는데 화면에는 **검은 사각형**만 나왔다.
//
// 원인: `streets.roadMesh` 가 y=0 에 한 변 3000m 짜리 불투명 평면을 깐다.
// 지평선까지 틈이 없어야 해서 그렇게 만든 것이고, 그래서 **y=0 아래는 무엇을
// 만들어도 그 판에 가린다.** streets.js 가 "공사장 블록은 판을 안 깐다 —
// 구덩이가 통째로 안 보인다" 고 적어 둔 것과 같은 사고인데, 그쪽은 블록 판
// 얘기였고 지면 평면은 아무도 안 봤다.
//
// 지면 평면에 구멍을 낼 수도 있지만 그건 도시 전체가 딛고 선 판이다.
// **광장 하나 때문에 건드릴 것이 아니다.**
//
// 그래서 뒤집는다 — 파는 대신 **올린다.** 레퍼런스의 분수도 바닥에 파묻힌
// 것이 아니라 단 위에 올라와 있다. 결과도 같다: 가운데에 높이 차가 생기고,
// 앉을 자리가 생기고, 눈이 멈춘다.
const LEDGE_H = 0.5;  // 안뜰을 두르는 앉는 턱
const LEDGE_W = 1.3;
const BASIN_Y = 0.95; // 수반 테 높이 — 서서 물이 보이는 높이다

// 수경 반경. 안뜰 짧은 변의 절반을 넘으면 안뜰이 물웅덩이가 된다.
//
// 11 로 잡았더니 지름 22m 짜리 **흰 원반**이 됐다. waterMat 은 거칠기 0.04 에
// 환경맵 2.4 라 거의 거울인데, 그런 면이 하늘을 보고 이만큼 넓게 누우면
// 도시의 빛을 전부 받아 날아간다. 좁히고, 가운데를 막아 고리로 만든다.
const BASIN_R = 8.6;
const PLINTH_R = 3.4; // 가운데 대. 물이 원반이 아니라 고리로 보이게 한다

// 캐노피 높이. 4분면 상가(대략 20~30m)보다 낮아야 상가가 광장을 둘러싼 것으로
// 읽힌다. 캐노피가 더 높으면 상가가 캐노피의 부속으로 보인다.
const CANOPY_Y = 16.5;

// 바닥 판 하나. 높이는 **한 값뿐**이다 (아래 FLOOR).
function slab(b, r, y, mat, tile) {
  const w = r.x1 - r.x0;
  const d = r.z1 - r.z0;
  if (w < 0.05 || d < 0.05) return;
  b.add(upPlane(w, d, [(r.x0 + r.x1) / 2, y, (r.z0 + r.z1) / 2], [w / tile, d / tile]), mat);
}

// ── 바닥은 한 겹이다 (사용자 지시) ────────────────────────────────────────
//
// *"바닥 통일좀 하자. 바닥 텍스쳐로 보이는게 왜 이렇게 난잡하게 다 겹쳐있어"*
// *"하나로 통일해"*
//
// 맞다. 세어 보니 광장 한 자리에 판이 **다섯 겹**이었다.
//
//   0.160  streets.blockPlates 의 인도 판 (도시가 원래 까는 것)
//   0.180  광장 전체         plazaMat
//   0.195  십자 팔           tileWallMat
//   0.205  안뜰              plazaStepMat
//   0.210  둘레 점자블록     tactileMat
//
// 4~5cm 안에 재질이 다른 판 다섯 장이 겹쳐 있으니, 비스듬히 보면 어느 것이
// 바닥인지 알 수 없고 경계마다 다른 무늬가 서로를 밀어낸다.
//
// **한 장만 깐다.** 십자와 안뜰은 마감을 바꾸는 대신 **가장자리에 빛 줄을
// 새긴다** — 줄은 판이 아니라서 겹치지 않는다.
const FLOOR = 0.06; // 도시 인도 판(0.16) 위 이만큼. 이 값 하나만 쓴다

function paving(b, mats, pools) {
  slab(b, PLAZA, Y + FLOOR, mats.plazaMat, 3.2);

  // ── 광장 밖으로 이어지는 길 (사용자 지시 3번) ──────────────────────────
  // *"광장 주변에 사람이 지나다닐 수 있을법한 부분들은 체크하고, 도로 포장 개편해"*
  //
  // 동서 팔이 좌우 블록을 지나 다음 도로까지 이어진다 (plaza.armWalkRects).
  // `streets.walkPaving` 은 이 구간을 건너뛰므로 **여기가 유일한 포장**이다 —
  // 재질도 높이도 광장과 같은 것 하나를 쓴다.
  for (const w of allWalks()) {
    if (!precinctHits(w.rect)) continue;
    slab(b, w.rect, Y + FLOOR, mats.plazaMat, 3.2);
    // 길 가장자리 두 줄 — 광장의 십자 팔과 같은 표시로 이어 준다
    const nz = (w.rect.z1 - w.rect.z0) < (w.rect.x1 - w.rect.x0);
    const cx = (w.rect.x0 + w.rect.x1) / 2;
    const cz = (w.rect.z0 + w.rect.z1) / 2;
    for (const s of [-1, 1]) {
      const [ex, ez] = nz ? [cx, cz + s * (w.rect.z1 - w.rect.z0) / 2]
        : [cx + s * (w.rect.x1 - w.rect.x0) / 2, cz];
      b.box(nz ? w.rect.x1 - w.rect.x0 : 0.22, 0.05, nz ? 0.22 : w.rect.z1 - w.rect.z0,
        [ex, Y + FLOOR + 0.01, ez], neonSoft(NEON.warm));
    }
    pools.push({
      kind: 'floor', x: cx, y: Y + FLOOR + 0.02, z: cz,
      rx: (w.rect.x1 - w.rect.x0) * 0.5, rz: (w.rect.z1 - w.rect.z0) * 0.5,
      tint: rgb01(NEON.warm, 0.22),
    });
  }

  // 십자 팔 — 가장자리 두 줄. 마감을 안 바꾸고 선만 새긴다
  const line = (x, z, w, d) =>
    b.box(w, 0.05, d, [x, Y + FLOOR + 0.01, z], neonSoft(NEON.warm));
  for (const x of [ARMS.ns.x0, ARMS.ns.x1]) {
    line(x, PLAZA.cz, 0.22, PLAZA.d - 1);
  }
  for (const z of [ARMS.ew.z0, ARMS.ew.z1]) {
    line(PLAZA.cx, z, PLAZA.w - 1, 0.22);
  }
}

// 안뜰 — 파는 대신 **테를 두른다.**
//
// 턱은 네 변을 두르되 십자 팔이 들어오는 자리에서 끊긴다. 그 네 틈이 안뜰의
// 문이고, 끊기지 않으면 안뜰이 화단이 된다.
//
// 바닥은 **깔지 않는다.** 광장 판 한 장이 여기까지 덮고, 안뜰이라는 것은
// 턱과 그 위 빛줄이 말한다 (FLOOR 머리말).
function court(b, mats, pools) {
  // 앉는 턱 — 팔이 지나는 구간을 빼고 토막으로 놓는다
  const seg = (x0, x1, z0, z1) => {
    if (x1 - x0 < 0.4 || z1 - z0 < 0.4) return;
    b.add(autoBox(x1 - x0, LEDGE_H, z1 - z0,
      [(x0 + x1) / 2, Y + LEDGE_H / 2, (z0 + z1) / 2], 0.05), mats.frameConcMat);
    // 턱 윗면 발광선 — 밤에 이 네 줄이 안뜰의 윤곽을 그린다
    b.box(Math.max(0.1, x1 - x0 - 0.5), 0.05, Math.max(0.1, z1 - z0 - 0.5),
      [(x0 + x1) / 2, Y + LEDGE_H, (z0 + z1) / 2], neon(NEON.cool));
  };
  const C = CROSSING;
  const L = LEDGE_W;
  // 남·북 — 남북 팔이 뚫는다
  for (const [z0, z1] of [[C.z0, C.z0 + L], [C.z1 - L, C.z1]]) {
    seg(C.x0, ARMS.ns.x0, z0, z1);
    seg(ARMS.ns.x1, C.x1, z0, z1);
  }
  // 동·서 — 동서 팔이 뚫는다. 남북 턱이 이미 먹은 만큼 안쪽에서 시작한다
  for (const [x0, x1] of [[C.x0, C.x0 + L], [C.x1 - L, C.x1]]) {
    seg(x0, x1, C.z0 + L, ARMS.ew.z0);
    seg(x0, x1, ARMS.ew.z1, C.z1 - L);
  }

  pools.push({
    kind: 'floor', x: PLAZA.cx, y: Y + FLOOR + 0.02, z: PLAZA.cz,
    rx: (C.x1 - C.x0) * 0.55, rz: (C.z1 - C.z0) * 0.55, tint: rgb01(NEON.cool, 0.3),
  });
  return { rect: C };
}

// ── 수경 ──────────────────────────────────────────────────────────────────
//
// 분수를 그대로 옮기면 이 도시의 물건이 아니다. 물은 두고 **동력을 바꾼다** —
// 물줄기가 아니라 빛기둥이 솟고, 수면은 그 빛을 받는 검은 거울이다.
// (waterMat 은 색 0x0a1420, 거칠기 0.04 — 이미 그런 물이다.)
function waterFeature(b, rng, mats, pools) {
  const cx = PLAZA.cx;
  const cz = PLAZA.cz;
  const base = Y;

  // 수반 — 바닥에서 **솟은** 원통. 테는 BASIN_Y 높이이고 그 바로 밑까지
  // 물이 차 있다. 물은 테 밑까지 차 있어야 서서 보아 물로 읽힌다.
  b.add(lathe([
    [BASIN_R, base], [BASIN_R, base + BASIN_Y],
    [BASIN_R - 0.6, base + BASIN_Y], [BASIN_R - 0.6, base + 0.15],
  ], 36), mats.frameConcMat);
  b.cylinder(BASIN_R - 0.6, BASIN_R - 0.6, 0.1, [cx, base + 0.15, cz], mats.plazaStepMat, 36);
  b.cylinder(BASIN_R - 0.68, BASIN_R - 0.68, 0.02,
    [cx, base + BASIN_Y - 0.16, cz], mats.waterMat, 44);

  // 테 윗면 발광 띠 — 물 가장자리를 그린다. 이 원 하나가 "여기가 중심" 이다
  b.cylinder(BASIN_R + 0.05, BASIN_R + 0.05, 0.1, [cx, base + BASIN_Y, cz], neon(NEON.cool), 36);
  // 수반 바깥 발밑 띠 — 밤에 수반이 안 보이면 사람이 걸려 넘어진다
  b.cylinder(BASIN_R + 0.12, BASIN_R + 0.12, 0.06, [cx, base + 0.18, cz], neonSoft(NEON.violet), 36);

  // 가운데 대 — 물 위로 솟는다. 빛기둥이 여기서 시작한다
  const PY = BASIN_Y + 0.45;
  b.cylinder(PLINTH_R, PLINTH_R + 0.35, PY, [cx, base + PY / 2, cz], mats.frameConcMat, 24);
  b.cylinder(PLINTH_R + 0.05, PLINTH_R + 0.05, 0.08, [cx, base + PY, cz], neon(NEON.violet), 24);

  const floorY = base + PY; // 대 위에서 솟는 것들의 기준

  // ── 빛기둥 ────────────────────────────────────────────────────────────
  // 처음에는 원기둥 하나였다. 흰 오벨리스크로 보였다 — 분수가 아니라 비석이다.
  // 굵기가 다른 여러 겹으로 쌓으면 위로 갈수록 흐려져서 **솟는 것**이 된다.
  for (const [r0, r1, h, y0, m] of [
    [2.4, 1.9, 3.0, 0.0, neon(NEON.cool)],
    [1.7, 1.1, 6.5, 2.6, neonSoft(NEON.cool)],
    [0.9, 0.35, 9.0, 8.4, neonSoft(NEON.violet)],
  ]) {
    b.cylinder(r1, r0, h, [cx, floorY + y0 + h / 2, cz], m, 16);
  }
  // 물줄기 — 대와 테 사이 물 위에서 솟는다
  const JETS = 12;
  for (let i = 0; i < JETS; i++) {
    const a = (i / JETS) * Math.PI * 2;
    const r = (PLINTH_R + BASIN_R) / 2;
    const h = rng.range(2.0, 4.4);
    b.cylinder(0.09, 0.2, h,
      [cx + Math.cos(a) * r, base + BASIN_Y + h / 2 - 0.2, cz + Math.sin(a) * r],
      neonSoft(i % 2 ? NEON.cool : NEON.violet), 8);
  }

  // 웅덩이는 **바닥에** 눕힌다. 수면 높이에 두면 수반 테에 가려 안 보인다
  pools.push({
    kind: 'floor', x: cx, y: Y + FLOOR + 0.02, z: cz,
    rx: BASIN_R * 2.6, rz: BASIN_R * 2.6, tint: rgb01(NEON.cool, 0.45),
  });
}

// ── 캐노피 ────────────────────────────────────────────────────────────────
//
// 레퍼런스(폴로니안 몰)는 실내다. 그대로 덮으면 안이 캄캄해지고 이 씬에는
// 실내 조명 체계가 없다. 그래서 **뼈대만 덮는다** — 기둥 넷과 격자 트러스.
// 하늘이 비쳐 보이면서도 "여기는 지붕이 있던 곳" 이라는 인상이 남는다.
function canopy(b, mats, pools) {
  const m = 1.2;
  const x0 = CROSSING.x0 - m;
  const x1 = CROSSING.x1 + m;
  const z0 = CROSSING.z0 - m;
  const z1 = CROSSING.z1 + m;

  // 기둥 넷 — 안뜰 모서리 바깥. 계단을 안 밟는다
  for (const px of [x0, x1]) {
    for (const pz of [z0, z1]) {
      b.cylinder(0.55, 0.75, CANOPY_Y, [px, Y + CANOPY_Y / 2, pz], mats.frameConcMat, 10);
      b.cylinder(0.2, 0.2, CANOPY_Y - 2.4, [px, Y + (CANOPY_Y - 2.4) / 2, pz], neonSoft(NEON.violet), 6);
    }
  }

  // 테두리 보
  const beam = (x, z, w, d) => b.add(autoBox(w, 0.9, d, [x, Y + CANOPY_Y, z], 0.06), mats.metalMat);
  beam((x0 + x1) / 2, z0, x1 - x0, 0.9);
  beam((x0 + x1) / 2, z1, x1 - x0, 0.9);
  beam(x0, (z0 + z1) / 2, 0.9, z1 - z0);
  beam(x1, (z0 + z1) / 2, 0.9, z1 - z0);

  // 격자 — 양방향 얇은 보. 하늘이 새로 잘려 보이는 것이 요점이다
  const NX = 7;
  const NZ = 7;
  for (let i = 1; i < NX; i++) {
    const x = x0 + ((x1 - x0) / NX) * i;
    b.box(0.22, 0.5, z1 - z0, [x, Y + CANOPY_Y - 0.1, (z0 + z1) / 2], mats.metalMat);
  }
  for (let i = 1; i < NZ; i++) {
    const z = z0 + ((z1 - z0) / NZ) * i;
    b.box(x1 - x0, 0.5, 0.22, [(x0 + x1) / 2, Y + CANOPY_Y - 0.4, z], mats.metalMat);
  }

  // 아래를 비추는 띠 — 캐노피가 조명 기구이기도 하다.
  // 한 줄로 길게 두면 하늘에 흰 막대가 그어진다. 토막을 내면 등기구가 된다.
  const SEG = 6;
  for (const pz of [z0 + 1.6, z1 - 1.6]) {
    for (let i = 0; i < SEG; i++) {
      const t = x0 + ((x1 - x0) / SEG) * (i + 0.5);
      b.box((x1 - x0) / SEG - 1.6, 0.12, 0.3, [t, Y + CANOPY_Y - 0.75, pz], neonSoft(NEON.cool));
    }
  }
}

// ── 조경 ──────────────────────────────────────────────────────────────────
//
// 플랜터 하나 = 테 + 흙 + 나무. 땅에 심지 않는다 (머리말 참고).
function planter(b, rng, mats, x, z, w, d, tall) {
  const H = 0.62;
  b.add(autoBox(w, H, d, [x, Y + H / 2, z], 0.05), mats.frameConcMat);
  b.add(upPlane(w - 0.5, d - 0.5, [x, Y + H + 0.01, z]), mats.pitMat);
  // 테 안쪽 발광선 — 밤에 화분이 안 보이면 사람이 걸려 넘어진다
  b.box(w - 0.3, 0.05, 0.08, [x, Y + H - 0.06, z - d / 2 + 0.16], neonSoft(NEON.warm));
  b.box(w - 0.3, 0.05, 0.08, [x, Y + H - 0.06, z + d / 2 - 0.16], neonSoft(NEON.warm));

  if (tall) {
    // 가로수 — 줄기 하나에 잎 덩어리 셋
    const th = rng.range(3.4, 4.6);
    b.cylinder(0.2, 0.3, th, [x, Y + H + th / 2, z], mats.rustMat, 8);
    for (let k = 0; k < 3; k++) {
      b.sphere(rng.range(1.3, 2.0),
        [x + rng.range(-0.6, 0.6), Y + H + th + 0.4 + k * 0.85, z + rng.range(-0.6, 0.6)],
        mats.foliageMat, 8, 6);
    }
  } else {
    // 관목 — 낮게 여러 덩이. 앉은 눈높이를 채운다
    for (let k = 0; k < 4; k++) {
      b.sphere(rng.range(0.5, 0.9),
        [x + rng.range(-w / 3, w / 3), Y + H + 0.35, z + rng.range(-d / 3, d / 3)],
        mats.foliageMat, 7, 5);
    }
  }
}

// 등 하나. 화분 줄의 뼈대를 만든다.
function lamp(b, mats, pools, x, z) {
  b.cylinder(0.14, 0.18, 5.2, [x, Y + 2.6, z], mats.metalMat, 8);
  b.box(1.1, 0.16, 1.1, [x, Y + 5.3, z], neon(NEON.warm));
  pools.push({
    kind: 'floor', x, y: Y + FLOOR + 0.02, z, rx: 5.6, rz: 5.6, tint: rgb01(NEON.warm, 0.4),
  });
}

// ── 광장의 조명 ───────────────────────────────────────────────────────────
//
// **도로를 닫으면 가로등도 같이 꺼진다.** 당연한 말인데 실측하기 전까지
// 몰랐다 — streets.js 가 `roadOpen` 을 묻고 나서 가로등을 세우므로, 광장이
// 네 토막을 닫는 순간 그 자리의 가로등이 통째로 사라졌다. 그래서 광장이
// 도시에서 **제일 어두운 곳**이 됐다. 목적지가 되어야 할 곳인데.
//
// 도로가 하던 일을 광장이 넘겨받아야 한다. 상가 앞을 따라 한 줄 세운다.
function lamps(b, mats, pools) {
  const STEP = 11;
  const M = 3.0; // 상가 앞면에서 이만큼 나온 줄
  const push = (x, z) => lamp(b, mats, pools, x, z);

  for (let x = INNER.x0 + STEP / 2; x < INNER.x1; x += STEP) {
    // 남북 팔이 지나는 자리는 비운다
    if (x > ARMS.ns.x0 - 1 && x < ARMS.ns.x1 + 1) continue;
    push(x, INNER.z0 + M);
    push(x, INNER.z1 - M);
  }
  for (let z = INNER.z0 + STEP; z < INNER.z1 - STEP / 2; z += STEP) {
    if (z > ARMS.ew.z0 - 1 && z < ARMS.ew.z1 + 1) continue;
    push(INNER.x0 + M, z);
    push(INNER.x1 - M, z);
  }

  // 광장 바닥에 깔리는 은은한 빛. 개별 등만으로는 등과 등 사이가 검게 남아
  // '광장' 이 아니라 '어두운 마당' 이 된다.
  //
  // **안뜰 위는 비운다.** 빛 웅덩이도 결국 바닥에 눕힌 판이라, 하나로 크게
  // 깔면 수반과 턱 위에 판이 겹쳐 뿌옇게 뜬다.
  const wash = (x0, x1, z0, z1) => {
    if (x1 - x0 < 2 || z1 - z0 < 2) return;
    pools.push({
      kind: 'floor', x: (x0 + x1) / 2, y: Y + FLOOR + 0.02, z: (z0 + z1) / 2,
      rx: (x1 - x0) * 0.62, rz: (z1 - z0) * 0.62, tint: rgb01(NEON.warm, 0.26),
    });
  };
  wash(INNER.x0, INNER.x1, INNER.z0, CROSSING.z0);
  wash(INNER.x0, INNER.x1, CROSSING.z1, INNER.z1);
  wash(INNER.x0, CROSSING.x0, CROSSING.z0, CROSSING.z1);
  wash(CROSSING.x1, INNER.x1, CROSSING.z0, CROSSING.z1);
}

// 조경은 **안뜰 둘레**에 선다.
//
// 처음에는 십자 팔을 따라 늘어놨는데, 팔은 사람이 지나가는 곳이라 양옆에
// 화분을 세우면 길이 좁아지기만 한다. 안뜰 둘레에 두르면 두 가지가 동시에
// 된다 — 걸어 내려가는 계단의 난간 노릇을 하고, 광장 가운데에 **테두리**가
// 생겨서 빈 바닥이 '가장자리 있는 마당' 으로 읽힌다.
//
// 팔이 들어오는 네 곳은 비운다. 거기를 막으면 안뜰이 화단에 갇힌다.
function planting(b, rng, mats, pools) {
  const M = 4.4; // 안뜰 턱 바깥에서 이만큼 떨어진 줄. 캐노피 기둥을 비켜난다
  const x0 = CROSSING.x0 - M;
  const x1 = CROSSING.x1 + M;
  const z0 = CROSSING.z0 - M;
  const z1 = CROSSING.z1 + M;

  // 남북 두 변 (X 를 따라 늘어선다) — 남북 팔이 뚫고 지나가는 가운데를 비운다
  const NX = 7;
  for (let i = 0; i < NX; i++) {
    const x = x0 + ((x1 - x0) / NX) * (i + 0.5);
    const tall = i % 2 === 1;
    const jit = rng.range(-0.3, 0.3);
    const gap = x > ARMS.ns.x0 - 1 && x < ARMS.ns.x1 + 1;
    if (gap) continue;
    for (const z of [z0, z1]) {
      planter(b, rng, mats, x + jit, z, 4.2, 2.6, tall);
      if (!tall) lamp(b, mats, pools, x + jit, z + (z === z0 ? -3.6 : 3.6));
    }
  }

  // 동서 두 변 (Z 를 따라)
  const NZ = 6;
  for (let i = 0; i < NZ; i++) {
    const z = z0 + ((z1 - z0) / NZ) * (i + 0.5);
    const tall = i % 2 === 0;
    const jit = rng.range(-0.3, 0.3);
    if (z > ARMS.ew.z0 - 1 && z < ARMS.ew.z1 + 1) continue;
    for (const x of [x0, x1]) {
      planter(b, rng, mats, x, z + jit, 2.6, 4.2, tall);
      if (!tall) lamp(b, mats, pools, x + (x === x0 ? -3.6 : 3.6), z + jit);
    }
  }

  // 열린 광장의 네 귀퉁이 — 큰 화분 하나씩. 모서리가 비면 사각형이 안 닫힌다
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      planter(b, rng, mats,
        PLAZA.cx + sx * ((INNER.x1 - INNER.x0) / 2 - 5.0),
        PLAZA.cz + sz * ((INNER.z1 - INNER.z0) / 2 - 5.0),
        6.0, 6.0, true);
    }
  }
}

// ── 지운 도로 자리의 쉼터 ─────────────────────────────────────────────────
//
// 사용자 지시: *"2번 4번같은 공간은 조그마한 휴식 공간같이 만들고"*
//
// 도로를 닫으면 그 자리에 **아무것도 안 남는다.** 포장도 차선도 가로등도 전부
// `roadOpen` 을 묻고 나서 그리기 때문이다. 그래서 상가 사이에 검은 사각형이
// 생긴다 — 광장을 넓힌 대가로 도시에 구멍을 낸 셈이다.
//
// 광장 같은 목적지가 아니라 **지나다 앉는 자리**다. 그래서 문법이 다르다:
// 가운데를 비우고, 짧은 쪽 벽에 붙여 앉을 것을 놓고, 등 하나로 끝낸다.
function restArea(b, rng, mats, pools, r) {
  const w = r.x1 - r.x0;
  const d = r.z1 - r.z0;
  const cx = (r.x0 + r.x1) / 2;
  const cz = (r.z0 + r.z1) / 2;
  const alongX = r.axis === 'x'; // 띠가 X 로 길다

  // 포장 — 차도가 아니라는 것을 바닥이 먼저 말한다.
  // 재질도 높이도 **광장과 같은 것 하나**를 쓴다 (FLOOR 머리말).
  slab(b, { x0: r.x0 + 0.5, x1: r.x1 - 0.5, z0: r.z0 + 0.5, z1: r.z1 - 0.5 },
    Y + FLOOR, mats.plazaMat, 3.2);

  // 앉을 것과 심을 것을 **긴 축을 따라** 번갈아 놓는다.
  //
  // 넓으면 양쪽 벽에 붙이고 가운데를 비운다 (여기는 지나가는 자리이기도 하다).
  // 좁으면 한 줄로 세운다 — 8m 짜리 골목에 양쪽으로 화분을 놓으면 화분끼리
  // 붙어서 길이 막힌다.
  const len = alongX ? w : d;
  const wide = (alongX ? d : w) >= 13;
  const N = Math.max(2, Math.round(len / (wide ? 13 : 9)));
  const side = wide ? (alongX ? d : w) / 2 - 2.2 : 0;
  for (let i = 0; i < N; i++) {
    const t = (alongX ? r.x0 : r.z0) + (len / N) * (i + 0.5);
    for (const s of (wide ? [-1, 1] : [0])) {
      const px = alongX ? t : cx + s * side;
      const pz = alongX ? cz + s * side : t;
      if (i % 2 === 0) {
        planter(b, rng, mats, px, pz, alongX ? 3.0 : 2.2, alongX ? 2.2 : 3.0, i % 4 === 0);
      } else {
        // 벤치 — 등받이 없는 콘크리트 덩이. 이 도시의 공공 가구는 부수기 어렵다
        const [bw, bd] = alongX ? [2.6, 0.7] : [0.7, 2.6];
        b.add(autoBox(bw, 0.44, bd, [px, Y + 0.22, pz], 0.04), mats.frameConcMat);
        b.box(bw - 0.4, 0.05, bd - 0.4, [px, Y + 0.44, pz], neonSoft(NEON.warm));
      }
    }
  }

  // 등 — 도로를 닫으면서 없앤 가로등을 대신한다. 좁은 자리는 가구가 이미
  // 가운데를 쓰므로 한쪽 끝으로 비켜 세운다
  const L = Math.max(1, Math.round(len / 22));
  const off = wide ? 0 : (alongX ? d : w) / 2 - 1.4;
  for (let i = 0; i < L; i++) {
    const t = (alongX ? r.x0 : r.z0) + (len / L) * (i + 0.5);
    lamp(b, mats, pools, alongX ? t : cx + off, alongX ? cz + off : t);
  }
  pools.push({
    kind: 'floor', x: cx, y: Y + FLOOR + 0.02, z: cz,
    rx: w * 0.5, rz: d * 0.5, tint: rgb01(NEON.warm, 0.2),
  });
}

function restAreas(b, rng, mats, pools) {
  let n = 0;
  for (const r of emptyRoadRects()) {
    b.mark('fixture', `plaza:rest${n}`, {});
    restArea(b, rng, mats, pools, r);
    n++;
  }
  return n;
}

// ── 상가 (광장의 벽) ──────────────────────────────────────────────────────
//
// 토막의 긴 두 면은 늘 열린 곳을 마주 본다 — 안쪽은 광장, 바깥쪽은 도시다.
// 짧은 끝면은 토막의 진짜 끝일 때만 열려 있다 (splitBar 머리말).
//
// 안쪽 면에 **주랑(柱廊)** 을 덧댄다. 상가가 그냥 벽이면 광장이 상자 안이
// 되는데, 기둥이 한 줄 서면 그 사이가 그늘이 되고 깊이가 생긴다. 레퍼런스의
// 몰이 실내인데도 답답하지 않은 이유가 이 층이다.
function colonnade(b, mats, pools, r, inward) {
  const H = 5.4;
  const D = 3.0; // 기둥 줄이 광장 쪽으로 나온 깊이
  const along = inward === 'z' ? 'x' : 'z';
  // 양 끝을 물린다. 끝까지 세우면 옆 토막의 주랑과 모서리에서 겹친다.
  const END = 1.8;
  const a0 = (along === 'x' ? r.x0 : r.z0) + END;
  const a1 = (along === 'x' ? r.x1 : r.z1) - END;
  // 광장을 향한 면의 좌표
  const face = inward === 'z'
    ? (r.z0 < PLAZA.cz ? r.z1 : r.z0)
    : (r.x0 < PLAZA.cx ? r.x1 : r.x0);
  const dir = inward === 'z' ? (r.z0 < PLAZA.cz ? 1 : -1) : (r.x0 < PLAZA.cx ? 1 : -1);

  const N = Math.max(3, Math.round((a1 - a0) / 6.0));
  for (let i = 0; i <= N; i++) {
    const t = a0 + ((a1 - a0) / N) * i;
    const px = along === 'x' ? t : face + dir * D;
    const pz = along === 'x' ? face + dir * D : t;
    b.cylinder(0.34, 0.4, H, [px, Y + H / 2, pz], mats.frameConcMat, 8);
  }
  // 기둥 위 보 — 줄이 하나로 읽히게 묶는다
  const bw = along === 'x' ? a1 - a0 : 0.7;
  const bd = along === 'x' ? 0.7 : a1 - a0;
  const cx = along === 'x' ? (a0 + a1) / 2 : face + dir * D;
  const cz = along === 'x' ? face + dir * D : (a0 + a1) / 2;
  b.add(autoBox(bw, 0.8, bd, [cx, Y + H + 0.4, cz], 0.05), mats.frameConcMat);
  // 보 아래 발광 띠 — 상가 앞을 밝힌다. 광장에서 이 선이 벽을 그린다
  b.box(along === 'x' ? bw - 1.5 : 0.16, 0.12, along === 'x' ? 0.16 : bd - 1.5,
    [cx, Y + H - 0.25, cz], neon(NEON.warm));
  pools.push({
    kind: 'floor', x: (cx + (along === 'x' ? cx : face)) / 2, y: Y + FLOOR + 0.02,
    z: (cz + (along === 'x' ? face : cz)) / 2,
    rx: along === 'x' ? (a1 - a0) * 0.5 : 7, rz: along === 'x' ? 7 : (a1 - a0) * 0.5,
    tint: rgb01(NEON.warm, 0.3),
  });
}

// 상가 토막 하나를 **점포 단위로 자른다.**
//
// 한 토막을 통짜로 지으면 46m 짜리 벽 하나가 서고, 그건 상가가 아니라 옹벽
// 이다. 잘라서 각자 짓게 하면 bazaarBlock 이 토막마다 다른 층수·형태를 뽑아
// 지붕선이 오르내린다 — 레퍼런스의 몰도 한 덩어리가 아니라 여러 채다.
//
// 덤으로 감사 지표가 맞는다. 통짜로 두면 '건물 1채에 간판 40개' 가 되어
// "관계가 깨졌다" 경보가 뜬다. 그건 경보가 틀린 게 아니라 **정말로 한 채에
// 40개를 단 것**이었다.
function splitBar(r) {
  const sz = rectSize(r);
  const alongX = sz.w >= sz.d;
  const len = alongX ? sz.w : sz.d;
  const n = Math.max(1, Math.round(len / 19));
  const GAP = 1.2; // 점포 사이 틈. 지붕선이 끊겨 보이려면 이 틈이 있어야 한다
  const out = [];
  for (let i = 0; i < n; i++) {
    const t0 = (alongX ? r.x0 : r.z0) + (len / n) * i + (i ? GAP / 2 : 0);
    const t1 = (alongX ? r.x0 : r.z0) + (len / n) * (i + 1) - (i < n - 1 ? GAP / 2 : 0);
    // ── 끝면은 길에 면하지 않는다 ────────────────────────────────────────
    //
    // 처음에는 네 면을 다 참으로 줬다. 그랬더니 이웃한 두 점포가 **서로를
    // 향해** 돌출 간판을 달아 2.4m 씩 부딪혔다. 틈을 넓혀 봤자 소용없다 —
    // 간판이 틈만큼 더 나올 뿐이다.
    //
    // 사이에 낀 면은 원래 아무것도 안 마주 본다. towers.streetFaces 가
    // 블록 안쪽 필지에 대해 하는 판정과 같은 것이고, 그래서 같은 모양의
    // 객체로 넘긴다.
    const ends = { lo: i === 0, hi: i === n - 1 };
    out.push(alongX
      ? { x0: t0, x1: t1, z0: r.z0, z1: r.z1,
          faces: { nx: ends.lo, px: ends.hi, nz: true, pz: true } }
      : { x0: r.x0, x1: r.x1, z0: t0, z1: t1,
          faces: { nz: ends.lo, pz: ends.hi, nx: true, px: true } });
  }
  return out;
}

function arcadeShops(b, rng, mats, signs, pools) {
  const D = districtAt(PLAZA_IX, PLAZA_IZ);
  let i = 0;
  let built = 0;
  for (const bar of arcadeBars()) {
    const inward = bar.side === 'S' || bar.side === 'N' ? 'z' : 'x';
    const whole = { x0: bar.x0, x1: bar.x1, z0: bar.z0, z1: bar.z1 };
    for (const r of splitBar(whole)) {
      const sz = rectSize(r);
      i++;
      if (sz.w < 8 || sz.d < 8) continue;
      b.mark('building', `plaza:arc${i}`, { zone: D.name, ix: PLAZA_IX, iz: PLAZA_IZ });
      // detail 1.0 — 도시의 목적지다. 여기서 아끼면 아낀 것이 그대로 보인다
      bazaarBlock(b, r, rng, mats, D, r.faces, 1.0, signs, pools);
      built++;
    }
    // 주랑은 **토막 전체**에 한 줄로 두른다. 점포마다 따로 세우면 기둥 간격이
    // 어긋나서 줄로 안 읽힌다 — 주랑은 상가의 것이 아니라 광장의 것이다.
    b.mark('fixture', `plaza:col${bar.side}${bar.half}`, {});
    colonnade(b, mats, pools, whole, inward);
  }
  return built;
}

// ── 진입점 ────────────────────────────────────────────────────────────────
export function grandPlaza(b, rng, mats, signs, pools) {
  paving(b, mats, pools);
  const inner = court(b, mats, pools);
  waterFeature(b, rng, mats, pools);
  canopy(b, mats, pools);
  planting(b, rng, mats, pools);
  lamps(b, mats, pools);
  // **여기서 한 번만 센다.** 광장 상가는 towers 밖에서 지어지므로, 감사의
  // '건물' 수에 안 들어가면 간판만 늘어난 꼴이 되어 "건물당 간판" 경보가
  // 뜬다. 실제로 5.25 로 떠서 발견했다 — 지표가 틀린 게 아니라 세는 곳이
  // 빠져 있었다 (towers.js 의 count++ 머리말과 같은 사고).
  const buildings = arcadeShops(b, rng, mats, signs, pools);
  // 광장 밖에서 도로를 지운 자리. 광장 다음에 와야 한다 — 광장이 이미 깐
  // 자리를 빼고 남은 것만 채우기 때문이다 (plaza.emptyRoadRects).
  const rests = restAreas(b, rng, mats, pools);
  return { rect: PLAZA, court: inner.rect, buildings, rests };
}
