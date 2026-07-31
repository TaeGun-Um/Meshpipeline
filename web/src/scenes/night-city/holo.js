// 홀로그램과 디지털 조경 — 이 도시의 '기술'.
//
// ── 왜 필요한가 ────────────────────────────────────────────────────────────
// 간판을 1,500개 달아도 사이버펑크로 안 읽혔다. 이유는 개수가 아니라 **종류**다.
// 지금 간판은 전부 같은 물건이다 — 사각 발광판에 픽셀 글자, 색만 다르다.
// 그건 네온 도시지 사이버펑크가 아니다.
//
// 사이버펑크를 사이버펑크로 만드는 것은 **미래 기술이 거리에 널려 있다는
// 사실**이다. 그런데 이 도시에는 기술의 흔적이 하나도 없었다. 배관과 실외기는
// 낡음이지 미래가 아니다.
//
// ── 홀로그램이 간판과 다른 점 ──────────────────────────────────────────────
// 결정적으로 **뒤가 비친다.** 불투명하면 그냥 발광 간판이다.
// 그래서 전부 가산합성(Additive)으로 만든다 — 뒤의 건물이 비쳐 보이고,
// 겹치면 밝아지고, 어두운 배경에서는 사라진다. 그게 '투영된 빛' 이다.
//
// 그리고 **받침이 없다.** 간판은 벽에 붙거나 매달리지만 홀로그램은 허공에
// 떠 있다. 지지대가 보이면 홀로그램이 아니다.
//
// ── 무엇을 만드는가 ────────────────────────────────────────────────────────
//   1) 부유 광고판   건물 앞 허공에 뜬 큰 판. 스케일의 폭력을 만든다.
//   2) 디지털 수목   빛나는 나무. 조경인데 식물이 아니다.
//   3) 투사 기둥     바닥에서 하늘로 솟는 빛기둥. 기업 구역의 과시.
//   4) 부유 표식     가게 위에 뜬 작은 홀로. 개수로 밀도를 만든다.
//
// ── 구역이 무엇을 갖는가 (docs/city.md 시기) ───────────────────────────────
// 홀로그램은 2기(기업의 자기 홍보)와 3기(상점의 호객)의 것이다.
// **1기 흔적인 공장과 주거에는 없다.** 대비를 위해서가 아니라 그 구역이
// 그 시기의 것이 아니기 때문이다.
import * as THREE from 'three';
import { MeshBuilder } from '../../core/builder.js';
import { tubeBetween } from '../../core/profile.js';
import { upPlane, rectCenter, rectSize } from '../../core/boxfaces.js';
import { NEON, rgb01 } from '../../shared/neon.js';
import { holo, holoSoft } from '../../shared/masters.js';
import {
  // GRID·blockRect 는 더 쓰지 않는다. 대지를 도는 것이 옳고, 블록 사각형을
  // 보면 병합된 대지 안쪽 칸에서 건물 속에 물건을 놓게 된다.
  CURB_HEIGHT,
  detailAt,
  blockIndexAt,
} from './layout.js';
import { districtAt, byZone } from './district.js';
import { roadAt, spanInRoad } from './layout.js';
import { parcels } from './parcel.js';
import { LANDMARK_BLOCKS } from './landmark.js';

// 구역별 홀로그램 밀도. 0 이면 그 구역엔 하나도 없다.
// byZone 이 강제한다 (district.byZone 머리말). 0 이 **의도한 0** 인지
// 표에서 빠져 `?? 0` 이 된 것인지 코드만 보고는 구별할 수 없었다.
const RATE = byZone('홀로 광고', {
  상업: 1.0, 기업: 0.85, 주거: 0.12, 공업: 0,
  슬럼: 0,   // 광고주가 없다. 여기 사는 사람에게 팔 것이 없다
  부둣가: 0, // 광고할 상대가 없다. 사람이 안 지나간다
});

// ── 부유 광고판 ────────────────────────────────────────────────────────────
//
// 건물 앞 허공에 뜬 큰 판. **받침이 없는 것**이 요점이다.
//
// 크기가 중요하다. 간판만 해지면 그냥 간판이고, 건물 절반을 덮어야
// "압도당한다" 는 느낌이 난다 — 그게 사이버펑크의 정서다.
function floatPanel(b, x, y, z, yaw, w, h, hue, rng) {
  // 본체 — 얇은 판 둘을 겹쳐 두께를 흉내낸다. 가산합성이라 겹치면 밝아지고,
  // 그 밝기 차이가 부피감을 만든다.
  for (const d of [-0.06, 0.06]) {
    const g = new THREE.PlaneGeometry(w, h);
    g.rotateY(yaw);
    g.translate(x + Math.sin(yaw + Math.PI / 2) * d, y, z + Math.cos(yaw + Math.PI / 2) * d);
    b.add(g, holoSoft(hue));
  }

  // 주사선 — 가로줄 몇 개. 홀로그램을 홀로그램으로 만드는 단 하나의 신호다.
  // 이게 없으면 그냥 반투명한 판이다.
  const lines = Math.max(3, Math.round(h / 1.6));
  for (let i = 0; i < lines; i++) {
    const ly = y - h / 2 + (h * (i + 0.5)) / lines;
    const g = new THREE.PlaneGeometry(w * rng.range(0.7, 1.0), 0.09);
    g.rotateY(yaw);
    g.translate(x, ly, z);
    b.add(g, holo(hue));
  }

  // 테두리 — 위아래만. 사방을 두르면 액자가 되어 '투영' 이 아니라 '설치물' 이다.
  for (const s of [-1, 1]) {
    const g = new THREE.PlaneGeometry(w, 0.14);
    g.rotateY(yaw);
    g.translate(x, y + s * (h / 2), z);
    b.add(g, holo(hue));
  }
}

// ── 디지털 수목 ────────────────────────────────────────────────────────────
//
// 조경인데 식물이 아니다. 빛나는 선으로 나무 형상을 그린다.
//
// 왜 이게 조경인가: 이 도시는 바다를 메운 땅이라 흙이 없고, 황폐한 세계라
// 나무를 구할 수도 없다. 그런데 광장에는 조경이 있어야 한다 — 그래서
// **나무를 흉내낸 장치**를 세운다. 그 사실 자체가 이 세계의 설명이다.
// room 은 이 자리에서 연석까지 남은 거리다.
//
// 줄기는 인도 한가운데 서는데 **가지가 퍼진다.** 낮은 가지(짧은 나무는
// 가지 끝이 3.2m 높이에 있다)가 차도로 넘어가면 트럭이 지나갈 자리를
// 막는다 — 배치 검사가 그것을 잡았다. 머리 위로 지나가는 가지는 결함이
// 아니지만 이건 지면 높이다.
function digitalTree(b, x, z, rng, mats, pools, room = Infinity) {
  const H = rng.range(4.5, 8);
  const hue = rng.chance(0.55) ? NEON.cyan : rng.chance(0.5) ? NEON.green : NEON.violet;
  const Y = CURB_HEIGHT;

  // 기둥 — 실물 금속. 장치이므로 받침은 진짜다.
  b.cylinder(0.18, 0.24, 0.5, [x, Y + 0.25, z], mats.metalMat, 10);
  b.add(tubeBetween([x, Y + 0.4, z], [x, Y + H * 0.5, z], 0.07, 6), mats.metalMat);

  // 가지 — 위로 갈라지는 선. 홀로그램이라 뒤가 비친다.
  const branches = rng.int(4, 7);
  for (let i = 0; i < branches; i++) {
    const a = (i / branches) * Math.PI * 2 + rng.range(-0.3, 0.3);
    // 잎이 가지 끝에서 0.5m 더 나가므로 그만큼 더 뺀다.
    // rng 는 항상 소비한다 — 건너뛰면 뒤의 모든 생성이 밀린다.
    const spread = Math.min(rng.range(1.2, 2.4), Math.max(0.9, room - 0.6));
    const top = H * rng.range(0.72, 1.0);
    const mid = [x + Math.cos(a) * spread * 0.45, Y + H * 0.62, z + Math.sin(a) * spread * 0.45];
    const end = [x + Math.cos(a) * spread, Y + top, z + Math.sin(a) * spread];
    b.add(tubeBetween([x, Y + H * 0.5, z], mid, 0.05, 4), holo(hue));
    b.add(tubeBetween(mid, end, 0.035, 4), holo(hue));

    // 잎 — 가지 끝의 작은 면. 몇 개만 둔다.
    if (rng.chance(0.7)) {
      const g = new THREE.PlaneGeometry(rng.range(0.5, 1.0), rng.range(0.4, 0.8));
      g.rotateY(a);
      g.translate(end[0], end[1], end[2]);
      b.add(g, holoSoft(hue));
    }
  }

  pools.push({
    kind: 'floor', x, y: Y + 0.03, z, rx: 3.4, rz: 3.4, tint: rgb01(hue, 0.3),
  });
}

// ── 투사 기둥 ──────────────────────────────────────────────────────────────
//
// 바닥에서 하늘로 솟는 빛기둥. 실체가 없어서 **가장 순수한 과시**다 —
// 아무 기능도 없이 에너지만 쓴다. 그래서 기업 구역의 것이다.
function beamColumn(b, x, z, rng, pools) {
  const H = rng.range(30, 90);
  const R = rng.range(1.2, 2.6);
  const hue = rng.chance(0.6) ? NEON.cool : NEON.cyan;
  const seg = 10;

  // 원통 — 위로 갈수록 옅어지게 만들 수 없으므로(단일 재질) 대신 **위로
  // 갈수록 가늘게** 한다. 원근과 합쳐져 사라지는 것처럼 보인다.
  const g = new THREE.CylinderGeometry(R * 0.25, R, H, seg, 1, true);
  g.translate(x, CURB_HEIGHT + H / 2, z);
  b.add(g, holoSoft(hue));

  // 바닥 원반 — 빛이 어디서 나오는지를 보여준다
  b.add(upPlane(R * 4, R * 4, [x, CURB_HEIGHT + 0.04, z]), holoSoft(hue));
  pools.push({ kind: 'floor', x, y: CURB_HEIGHT + 0.05, z, rx: R * 4, rz: R * 4, tint: rgb01(hue, 0.5) });
}

// ── 부유 표식 ──────────────────────────────────────────────────────────────
//
// 가게 위에 뜬 작은 홀로. 하나하나는 작지만 **개수로 밀도를 만든다.**
// 거리를 걸을 때 눈높이 위에 계속 떠 있는 것이 사이버펑크의 시야다.
function marker(b, x, y, z, rng) {
  const hue = [NEON.cyan, NEON.magenta, NEON.amber, NEON.green][rng.int(0, 3)];
  const s = rng.range(0.5, 1.1);
  const yaw = rng.range(0, Math.PI * 2);

  // 마름모 — 회전한 사각형. 원이나 사각보다 '표식' 으로 읽힌다.
  const g = new THREE.PlaneGeometry(s, s);
  g.rotateZ(Math.PI / 4);
  g.rotateY(yaw);
  g.translate(x, y, z);
  b.add(g, holo(hue));

  // 아래 짧은 선 — 무엇을 가리키는지 보여준다
  b.add(tubeBetween([x, y - s * 0.7, z], [x, y - s * 1.5, z], 0.02, 4), holo(hue));
}

// ── 투사 조형 ──────────────────────────────────────────────────────────────
//
// ── 왜 필요한가 (사용자 지적) ──────────────────────────────────────────────
// "홀로그램들도 다양하게 늘려서 도시를 꾸미도록 하자.
//  지금은 너무 갯수가 적고 색깔놀이임, 감성이 없어"
//
// 맞았다. 지금까지 홀로그램은 넷인데 **전부 판 아니면 선**이었다.
// 광고판(판) · 수목(선) · 빛기둥(원통) · 표식(작은 판). 색만 다르다.
//
// ── 무엇이 홀로그램을 홀로그램으로 만드는가 ────────────────────────────────
// 발광하는 형상을 허공에 띄우는 것만으로는 부족하다. 그건 그냥 빛나는
// 물건이다. 셋이 있어야 "투사되고 있다" 가 성립한다.
//
//   1) 투사원   바닥에 실제 장치가 있다. 받침대와 렌즈. **실물 재질**이다
//   2) 광추     장치에서 상까지 벌어지는 옅은 원뿔. 빛이 지나는 길
//   3) 바닥 링  상 아래에 생기는 원. 장치가 켜져 있다는 표시
//
// 그리고 상 자체에는 **주사선**이 지나가야 한다 (floatPanel 이 이미 그렇게
// 한다). 이 넷이 갖춰지면 형상이 무엇이든 홀로그램으로 읽힌다.
//
// 그래서 틀(projector)을 하나 만들고 **피사체를 여섯 종** 갈아 끼운다.
// 판 네 종에서 형상 여섯 종으로 늘어나는 지점이 여기다.
function projector(b, x, z, mats, pools, top, spread, hue) {
  const Y = CURB_HEIGHT;

  // 1) 투사원 — 실물이다. 홀로그램이 어디서 나오는지 보여주는 유일한 물건
  b.cylinder(0.62, 0.78, 0.42, [x, Y + 0.21, z], mats.metalMat, 12);
  b.cylinder(0.34, 0.5, 0.26, [x, Y + 0.54, z], mats.ductMat, 12);
  b.cylinder(0.3, 0.3, 0.06, [x, Y + 0.7, z], holo(hue), 12); // 렌즈

  // 2) 광추 — 렌즈에서 위로. **상까지 닿으면 안 된다.**
  //
  // 처음엔 렌즈에서 상 높이까지 꽉 채웠다. 열린 원통은 앞벽과 뒷벽이 둘 다
  // 보이므로 가산합성으로 밝기가 두 배가 되고, 그 안에 든 피사체가 통째로
  // 씻겨 나갔다 — 홀로그램을 만들려다 **빛나는 고깔**을 만든 셈이다.
  // 광추는 "저기서 나온다" 만 말하면 되므로 아래 45% 만 그린다.
  const CH = (top - 0.7) * 0.45;
  const g = new THREE.CylinderGeometry(spread * 0.55, 0.28, CH, 14, 1, true);
  g.translate(x, Y + 0.7 + CH / 2, z);
  b.add(g, holoSoft(hue));

  // ── 3) 바닥 링 — 장치 둘레. 켜져 있다는 표시 ────────────────────────────
  //
  // 폭이 `spread * 2.4` (최대 7.2m) 였다. 인도가 6.2m 인데 바닥에 깔리는
  // 것이 그보다 넓으면 **벽을 피하면 차도를 밟고 차도를 피하면 벽에 박힌다.**
  // 실제로 그 사이에 낀 자리가 없어서 101기가 35기로 줄었다.
  //
  // 바닥에 닿는 것만 줄이면 된다 — 광추와 상은 공중이라 인도 폭과 무관하다.
  // (배치 검사도 지면 범위 `lowBox` 만 본다. 같은 기준을 여기서도 쓴다.)
  b.add(upPlane(spread * 1.4, spread * 1.4, [x, Y + 0.05, z]), holoSoft(hue));
  pools.push({
    kind: 'floor', x, y: Y + 0.06, z,
    rx: spread * 1.6, rz: spread * 1.6, tint: rgb01(hue, 0.55),
  });
}

// 상 위를 지나는 가로 띠. **이것 하나가 발광 형상과 홀로그램을 가른다.**
function scanlines(b, x, y, z, w, h, hue, n = 5) {
  for (let i = 0; i < n; i++) {
    const ly = y - h / 2 + (h * (i + 0.5)) / n;
    for (const yaw of [0, Math.PI / 2]) {
      const g = new THREE.PlaneGeometry(w, 0.07);
      g.rotateY(yaw);
      g.translate(x, ly, z);
      b.add(g, holo(hue));
    }
  }
}

// ── 피사체 여섯 종 ─────────────────────────────────────────────────────────
//
// 전부 **얇은 판과 선**으로 만든다. 부피를 채우면 홀로그램이 아니라 발광하는
// 조각이 된다 — 뒤가 비쳐야 투영이다.

// 1) 인물 — 광고 모델. 이 도시에서 가장 흔한 투사 대상이다.
//    사람 형상은 크기를 알려 주므로 거리의 스케일도 같이 잡아 준다.
// ── 실루엣을 어떻게 세우나 ─────────────────────────────────────────────────
// 처음엔 몸 부위를 전부 중심축에 겹쳐 놓았다. 다리 하나 · 팔 하나였고,
// 결과는 사람이 아니라 **막대가 쌓인 토템**이었다. 사람으로 읽히는 것은
// 부위의 개수가 아니라 **좌우로 벌어진 실루엣**이다 — 다리 둘이 갈라지고
// 팔이 몸통 밖에 있어야 한다.
//
// 부위를 (좌우 오프셋, 발끝 기준 높이, 폭, 길이) 로 적고, 그 목록을 통째로
// 두 방향(0도·90도)에 세운다. 어느 쪽에서 걸어와도 실루엣이 같다.
function figure(b, x, y, z, h, hue, rng) {
  const yaw = rng.range(0, Math.PI * 2);
  const u = h / 8; // 8등신
  const PARTS = [
    [0, 7.3, 1.0, 1.0],      // 머리
    [0, 5.2, 1.9, 2.6],      // 몸통
    [0, 3.6, 1.6, 1.2],      // 골반
    [-0.5, 1.8, 0.7, 3.6],   // 왼다리
    [0.5, 1.8, 0.7, 3.6],    // 오른다리
    [-1.3, 5.2, 0.55, 2.6],  // 왼팔
    [1.3, 5.2, 0.55, 2.6],   // 오른팔
  ];
  for (const a of [yaw, yaw + Math.PI / 2]) {
    // 면을 따라가는 방향. 오프셋은 이 축 위에 놓는다
    const ax = Math.cos(a);
    const az2 = Math.sin(a);
    for (const [ou, oy, w, hh] of PARTS) {
      const g = new THREE.PlaneGeometry(w * u, hh * u);
      g.rotateY(a);
      g.translate(x + ax * ou * u, y - h / 2 + oy * u, z + az2 * ou * u);
      b.add(g, holoSoft(hue));
    }
  }
  scanlines(b, x, y, z, u * 3.2, h, hue, 7);
}

// 2) 잉어 떼 — 공중을 도는 물고기. 재팬타운의 상징이고, **움직이는 것처럼
//    보이는 유일한 배치**다 (여럿을 원호 위에 흩어 놓으면 궤적이 읽힌다).
function koi(b, x, y, z, r, hue, rng) {
  const n = rng.int(3, 6);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + rng.range(-0.2, 0.2);
    const rr = r * rng.range(0.55, 1.0);
    const fx = x + Math.cos(a) * rr;
    const fz = z + Math.sin(a) * rr;
    const fy = y + rng.range(-r * 0.35, r * 0.35);
    const L = r * rng.range(0.35, 0.55);
    // 몸통 — 진행 방향(접선)을 향한다
    const g = new THREE.PlaneGeometry(L, L * 0.32);
    g.rotateY(-a);
    g.translate(fx, fy, fz);
    b.add(g, holoSoft(hue));
    // 꼬리 — 몸통보다 밝다. 갈라진 끝이 물고기라는 신호다.
    // 몸통 판은 `rotateY(-a)` 이므로 지역 X 가 (cos a, 0, sin a) 로 간다 —
    // 뒤쪽은 그 반대 방향이다 (landmark.yawBox 에서 이 축을 한 번 틀렸다).
    const bx = fx - Math.cos(a) * L * 0.55;
    const bz = fz - Math.sin(a) * L * 0.55;
    for (const s of [-1, 1]) {
      const t = new THREE.PlaneGeometry(L * 0.3, L * 0.14);
      t.rotateZ(s * 0.55);
      t.rotateY(-a);
      t.translate(bx, fy + s * L * 0.06, bz);
      b.add(t, holo(hue));
    }
  }
  // 궤도 — 도는 자리를 보여주는 옅은 원
  b.add(upPlane(r * 2, r * 2, [x, y - r * 0.5, z]), holoSoft(hue));
}

// 3) 문자탑 — 세로로 쌓은 글자 판. 읽히지 않아도 된다.
//    **세로쓰기 자체가 이 도시의 기호**다 (간판 blade 와 같은 문법).
function glyphTower(b, x, y, z, h, hue, rng) {
  const cells = Math.max(3, Math.round(h / 1.3));
  const w = h / cells * 0.9;
  for (let i = 0; i < cells; i++) {
    const ly = y - h / 2 + (h * (i + 0.5)) / cells;
    const on = rng.chance(0.82);
    for (const yaw of [0, Math.PI / 2]) {
      const g = new THREE.PlaneGeometry(w, w * 0.86);
      g.rotateY(yaw);
      g.translate(x, ly, z);
      b.add(g, on ? holo(hue) : holoSoft(hue));
    }
  }
  // 기둥 축 — 글자들을 한 줄로 묶는다
  b.add(tubeBetween([x, y - h / 2, z], [x, y + h / 2, z], 0.03, 4), holo(hue));
}

// 4) 마스코트 두상 — 큰 얼굴. 번화가에만 둔다.
//    **불쾌할 만큼 크다**는 것이 요점이다. 광고가 사람을 압도하는 도시다.
// ── 얼굴을 채우면 얼굴이 안 된다 ───────────────────────────────────────────
// 처음엔 원판을 채우고 그 위에 눈·입을 얹었다. 가산합성이라 겹친 자리가 더
// 밝아질 뿐이라, **눈이 얼굴보다 밝은 것이 아니라 얼굴이 통째로 밝은 공**이
// 됐다. 어두운 색을 못 쓰는 재질에서는 빼기가 안 되므로,
// **바탕을 비우고 윤곽만 그린다.** 그러면 눈과 입이 유일하게 채워진 것이 된다.
function mascot(b, x, y, z, r, hue) {
  for (const yaw of [0, Math.PI / 2]) {
    // 얼굴 윤곽 — 테만
    const g = new THREE.RingGeometry(r * 0.88, r, 22);
    g.rotateY(yaw);
    g.translate(x, y, z);
    b.add(g, holo(hue));
    // 눈 둘 — 채운 것은 이것과 입뿐이다
    for (const s of [-1, 1]) {
      const e = new THREE.CircleGeometry(r * 0.2, 10);
      e.rotateY(yaw);
      e.translate(
        x + (yaw === 0 ? s * r * 0.36 : 0),
        y + r * 0.2,
        z + (yaw === 0 ? 0 : s * r * 0.36)
      );
      b.add(e, holo(hue));
    }
    // 입 — 아래로 굽은 띠. 반원 링을 잘라 쓴다
    const m = new THREE.RingGeometry(r * 0.44, r * 0.56, 14, 1, Math.PI * 1.15, Math.PI * 0.7);
    m.rotateY(yaw);
    m.translate(x, y + r * 0.06, z);
    b.add(m, holo(hue));
  }
  scanlines(b, x, y, z, r * 1.7, r * 2, hue, 5);
}

// 5) 제품 회전대 — 받침 위에 상품 하나가 떠서 돈다. 기업 구역의 것이다.
//    무엇을 파는지가 아니라 **팔고 있다는 사실**이 형태다.
function product(b, x, y, z, r, hue) {
  // 상품 — 모서리를 세운 상자. 판 셋으로 부피를 흉내낸다
  for (const [w, h, yaw] of [[r, r * 1.4, 0], [r, r * 1.4, Math.PI / 2], [r, r, 0]]) {
    const g = new THREE.PlaneGeometry(w, h);
    g.rotateY(yaw);
    if (h === r) g.rotateX(Math.PI / 2);
    g.translate(x, y, z);
    b.add(g, holoSoft(hue));
  }
  // 궤도 링 둘 — 기울여 걸면 '회전 중' 으로 읽힌다
  for (const [tilt, rr] of [[0.35, r * 1.8], [-0.55, r * 1.5]]) {
    const g = new THREE.RingGeometry(rr * 0.94, rr, 24);
    g.rotateX(Math.PI / 2 + tilt);
    g.translate(x, y, z);
    b.add(g, holo(hue));
  }
  scanlines(b, x, y, z, r * 2, r * 2.2, hue, 6);
}

// 6) 안내 — 바닥 화살표와 그 위의 방향 아이콘. 광고가 아닌 유일한 홀로그램이라
//    **공공 시설**로 읽힌다. 주거 구역에 홀로그램이 있다면 이것뿐이다.
function wayfinder(b, x, y, z, hue) {
  const Y = CURB_HEIGHT;
  // 바닥 화살표 — 삼각형 하나와 자루
  const t = new THREE.CircleGeometry(1.1, 3);
  t.rotateX(-Math.PI / 2);
  t.translate(x, Y + 0.07, z + 1.2);
  b.add(t, holo(hue));
  b.add(upPlane(0.5, 2.2, [x, Y + 0.07, z - 0.6]), holoSoft(hue));
  // 공중 아이콘 — 테두리만 있는 사각. 안이 비어야 표지로 읽힌다
  for (const yaw of [0, Math.PI / 2]) {
    const g = new THREE.RingGeometry(0.72, 0.9, 4);
    g.rotateZ(Math.PI / 4);
    g.rotateY(yaw);
    g.translate(x, y, z);
    b.add(g, holo(hue));
  }
  scanlines(b, x, y, z, 1.6, 1.8, hue, 4);
}

// 구역이 무엇을 투사하는가.
//
// **표로 둔다.** 스칼라 확률로 섞으면 어느 구역에 가도 같은 것이 나온다 —
// 홀로그램 밀도에서 이미 같은 실수를 했다 (RATE 머리말).
// 여기서 갈리는 것은 밀도가 아니라 **무엇을 파는가**다.
//   상업  사람과 얼굴과 물고기. 호객이다
//   기업  제품과 문자. 얼굴을 안 쓴다 — 기업은 사람을 안 판다
//   주거  안내판 하나. 광고주가 없다
const SUBJECTS = byZone('홀로 피사체', {
  상업: ['figure', 'koi', 'mascot', 'glyphTower', 'figure', 'mascot'],
  기업: ['product', 'glyphTower', 'figure', 'product'],
  주거: ['wayfinder'],
  공업: [],
  슬럼: [],
  부둣가: [],
});

// 피사체별 크기와 색. 상 높이(top)와 광추 폭(spread)이 유형마다 달라야
// 실루엣이 갈린다 — 같은 크기로 두면 내용물만 다른 같은 기둥이 된다.
const SUBJ = {
  figure:     { top: [4.6, 7.2], spread: [1.1, 1.7], hues: [NEON.magenta, NEON.cyan, NEON.pink] },
  koi:        { top: [5.0, 7.0], spread: [2.0, 3.0], hues: [NEON.amber, NEON.cyan, NEON.pink] },
  mascot:     { top: [4.4, 6.4], spread: [1.4, 2.2], hues: [NEON.magenta, NEON.green, NEON.amber] },
  glyphTower: { top: [5.4, 8.5], spread: [0.7, 1.1], hues: [NEON.cyan, NEON.violet, NEON.amber] },
  product:    { top: [3.8, 5.4], spread: [1.2, 1.8], hues: [NEON.cool, NEON.cyan, NEON.blue] },
  wayfinder:  { top: [3.0, 3.8], spread: [0.6, 0.9], hues: [NEON.cool, NEON.cyan] },
};

function projectedFigure(b, x, z, kind, rng, mats, pools) {
  const S = SUBJ[kind];
  if (!S) throw new Error(`홀로 피사체 '${kind}' 의 규격이 없다`);
  const top = rng.range(S.top[0], S.top[1]);
  const spread = rng.range(S.spread[0], S.spread[1]);
  const hue = S.hues[rng.int(0, S.hues.length - 1)];
  projector(b, x, z, mats, pools, top, spread, hue);

  const y = CURB_HEIGHT + top;
  if (kind === 'figure') figure(b, x, y, z, top * 0.72, hue, rng);
  else if (kind === 'koi') koi(b, x, y, z, spread, hue, rng);
  else if (kind === 'mascot') mascot(b, x, y, z, spread * 0.9, hue);
  else if (kind === 'glyphTower') glyphTower(b, x, y, z, top * 0.62, hue, rng);
  else if (kind === 'product') product(b, x, y, z, spread * 0.62, hue);
  else wayfinder(b, x, y, z, hue);
  FIGS.push({ kind, x: Math.round(x), z: Math.round(z), top: +top.toFixed(1) });
  return spread;
}

// 어디에 무엇이 섰는지. **"만들었다" 와 "화면에서 보인다" 는 다르다** —
// 개수만 세면 여섯 종 중 둘이 한 번도 안 나오는 것을 못 잡는다
// (번화가 유형에서 실제로 그랬다, market.marketSpots 머리말).
let FIGS = [];
export function holoSpots() {
  return FIGS.slice();
}

function districtNear(x, z) {
  const ix = blockIndexAt(x);
  const iz = blockIndexAt(z);
  return districtAt(ix, iz);
}

// ── 조립 ───────────────────────────────────────────────────────────────────

export function createHolo(scene, rng, mats, anchors) {
  // 홀로그램은 그림자를 주지도 받지도 않는다. 빛이므로 당연하다 —
  // 그림자를 지면 그 순간 물체가 된다.
  const b = new MeshBuilder('Holo', { castShadow: false, receiveShadow: false });
  FIGS = [];
  const pools = [];
  let panels = 0;
  let trees = 0;
  let beams = 0;
  let markers = 0;
  let figures = 0;

  for (const a of anchors) {
    const rate = RATE[a.zone] ?? 0;
    if (rate <= 0) continue;
    const c = rectCenter(a.rect);
    const s = rectSize(a.rect);
    const det = detailAt(c.x, c.z);

    for (const side of ['px', 'nx', 'pz', 'nz']) {
      if (!a.faces?.[side]) continue;
      const alongX = side === 'pz' || side === 'nz';
      const fw = alongX ? s.w : s.d;
      if (fw < 8) continue;

      const outSign = side === 'px' || side === 'pz' ? 1 : -1;
      const yaw = alongX ? (outSign > 0 ? 0 : Math.PI) : (outSign > 0 ? Math.PI / 2 : -Math.PI / 2);

      // 1) 부유 광고판 — 건물 앞에 크게. 이게 스케일의 폭력이다.
      if (rng.chance(0.34 * rate * det) && a.top > 14) {
        const w = fw * rng.range(0.6, 1.1);
        const h = Math.min(a.top * 0.55, rng.range(8, 22));
        // ── 얼마나 앞에 뜨는가 ────────────────────────────────────────
        // 전에는 4~9m 로 뒀는데 인도가 3.2~7.5m 다. 그래서 홀로그램이
        // 인도를 넘어 차도로 나가거나, 판이 커서 아래로 내려오면 인도를
        // 관통하고 사람이 그 안에 서 있었다.
        //
        // 인도 폭 안에서만 띄우고, 아래 끝이 **간판대 위**(6m)에 있게 한다.
        // 사람 눈높이로 내려오면 홀로그램이 아니라 장애물이다.
        const D2 = districtNear(c.x, c.z);
        const dist = Math.min(rng.range(2.5, 6), (D2.sidewalk ?? 4.6) - 1.2);
        const px = alongX ? c.x : (outSign > 0 ? a.rect.x1 + dist : a.rect.x0 - dist);
        const pz = alongX ? (outSign > 0 ? a.rect.z1 + dist : a.rect.z0 - dist) : c.z;
        // 아래 끝이 6m 위 — 사람과 간판대를 비켜간다
        const minY = CURB_HEIGHT + 6 + h / 2;
        const py = Math.max(minY, CURB_HEIGHT + rng.range(a.top * 0.4, Math.max(a.top * 0.45, a.top - h * 0.6)));
        if (py + h / 2 > a.top + 8) continue; // 건물보다 너무 위로 뜨지 않는다
        const hue = [NEON.magenta, NEON.cyan, NEON.violet, NEON.amber][rng.int(0, 3)];
        // axis 는 "건물 면에서 어느 쪽으로 나갔나" 다. 검사가 그 축만 본다 —
        // 정면을 따라 긴 판이 옆 교차로 위로 나가는 것은 다른 사건이다
        // (placecheck.js roadIntrusion).
        b.mark('holo', `holoPanel#${panels}`, { zone: a.zone, axis: alongX ? 'z' : 'x' });
        floatPanel(b, px, py, pz, yaw, w, h, hue, rng);
        panels++;
      }

      // 2) 부유 표식 — 점포 위. 개수로 밀도를 만든다.
      const n = Math.max(1, Math.round((fw / 9) * rate * det));
      // 표식도 광고판과 같이 **인도 폭 안에서만** 띄운다.
      //
      // 광고판(위)에는 이 상한이 있었는데 표식에는 없었다. 그래서 인도가 좁은
      // 구역에서 표식이 차도로 나갔다 — 7번 버그(홀로그램이 인도를 관통)와
      // 같은 종류이고, 배치 검사가 잡았다.
      const walk = districtNear(c.x, c.z).sidewalk ?? 4.6;
      for (let i = 0; i < n; i++) {
        if (!rng.chance(0.6)) continue;
        const u = -fw / 2 + fw * ((i + 0.5) / n) + rng.range(-1.5, 1.5);
        // rng 는 항상 소비한다 — 건너뛰면 뒤의 모든 생성이 밀린다
        // 여유 1.2 -> 2.6. 필지는 인도 안쪽에서 다시 0.35~1.4m 물러나 서고
        // (towers 의 shrink), 표식 자체도 폭이 있다. 그 둘을 안 빼서 1개가
        // 차도로 0.53m 나갔다 — status.md 규칙 3 "여유는 기준보다 명확히
        // 커야 한다" 를 또 어겼다.
        const dist = Math.min(rng.range(1.8, 3.6), Math.max(0.8, walk - 2.6));
        const mx = alongX ? c.x + u : (outSign > 0 ? a.rect.x1 + dist : a.rect.x0 - dist);
        const mz = alongX ? (outSign > 0 ? a.rect.z1 + dist : a.rect.z0 - dist) : c.z + u;
        b.mark('holo', `holoMarker#${markers}`, { zone: a.zone, axis: alongX ? 'z' : 'x' });
        // 차도 위에 뜨면 물러난다. 인도 폭으로 계산하면 대지 병합 뒤로는
        // 필지 가장자리와 도로 사이 거리가 일정하지 않아 어긋난다 —
        // **도로가 어디인지는 roads() 가 안다.**
        //
        // 그런데 점 하나로 물으면 부족하다. 표식은 한 변 최대 1.1m 짜리
        // 마름모라 반쪽이 0.78m 뻗는다 — 중심이 인도 위여도 몸통이 차도로
        // 나간다. 실제로 그렇게 0.47m 나갔고 점 검사는 통과시켰다.
        // **폭이 있는 것은 폭으로 묻는다** (layout.spanInRoad).
        const MR = 0.85; // 표식 반폭 상한 (s 1.1 을 45도 돌린 것) + 여유
        if (spanInRoad(mx - MR, mx + MR) || spanInRoad(mz - MR, mz + MR)) continue;
        marker(b, mx, CURB_HEIGHT + rng.range(4.5, 7.5), mz, rng);
        markers++;
      }
    }
  }

  // 앞의 표시를 닫는다. 안 닫으면 아래 수목·기둥이 **마지막 표식의 기록으로
  // 빨려 들어가서**, 도시 전체를 감싸는 상자 하나가 되어 검사가 헛것을 잡는다
  // (실제로 "홀로 하나가 차도를 22m 침범" 으로 나왔다).
  b.endMark();

  // ── 3) 디지털 수목 · 투사 조형 · 투사 기둥 ────────────────────────────────
  //
  // ── 블록이 아니라 **대지**를 돈다 (사용자 지적으로 고침) ─────────────────
  // 사용자가 "이렇게 겹쳐져 있는 홀로그램도 있고" 라며 투사기가 건물 벽에
  // 박힌 사진을 보냈다.
  //
  // 원인은 이 루프가 `layout.blockRect(ix, iz)` 를 썼다는 것이다. 대지 병합
  // 이후로 여러 칸이 한 대지가 되고, **병합된 대지의 안쪽 칸은 블록 전체가
  // 건물 속**이다. 그 블록의 "가장자리에서 인도 폭만큼 안쪽" 은 인도가 아니라
  // 남의 건물 한복판이다.
  //
  // `parcel.blockRect` 를 단일 출처로 만들면서 여덟 모듈을 고쳤는데
  // (status.md 2.1 결합 대장) 여기는 `layout` 쪽 블록 사각형을 봤다.
  // **같은 이름의 함수가 두 곳에 있으면 반드시 한쪽이 틀린 것을 본다.**
  //
  // 그리고 대지 사각형만으로는 부족하다. 대지 안에서 건물은 다시 물러나
  // 서므로, 실제로 벽이 어디인지는 `anchors` 만 안다. 둘 다 본다.
  const solids = anchors.map((a) => a.solid || a.rect);
  const reserved = new Set(LANDMARK_BLOCKS.map((l) => `${l.ix},${l.iz}`));
  // (x, z) 가 어떤 건물 안이거나 r 만큼도 못 떨어져 있나
  const hitsBuilding = (x, z, r) => {
    for (const q of solids) {
      if (x > q.x0 - r && x < q.x1 + r && z > q.z0 - r && z < q.z1 + r) return true;
    }
    return false;
  };

  for (const p of parcels()) {
    const R = p.rect;
    const cx = (R.x0 + R.x1) / 2;
    const cz = (R.z0 + R.z1) / 2;
    const D = districtAt(p.ix, p.iz);
    const rate = RATE[D.name] ?? 0;
    if (rate <= 0) continue;
    if (reserved.has(`${p.ix},${p.iz}`)) continue; // 랜드마크가 통째로 쓰는 자리
    const det = detailAt(cx, cz);
    // 병합한 대지는 정사각이 아니다. 축마다 반폭을 따로 쓴다 —
    // `half` 하나로 두면 긴 축에서는 안쪽으로, 짧은 축에서는 밖으로 어긋난다.
    const hx = (R.x1 - R.x0) / 2;
    const hz = (R.z1 - R.z0) / 2;
    const walk = (D.sidewalk ?? 4.6);

    // ── 개수는 **대지 면적에 비례**한다 ──────────────────────────────────
    // 블록마다 세던 것을 대지마다 세도록 바꿨더니 개수가 3분의 1이 됐다.
    // 거절된 것이 아니라 **반복 횟수가 준 것**이다 — 3x3 으로 병합된 대지는
    // 예전에 아홉 번 돌던 자리인데 이제 한 번 돈다.
    // 밀도를 유지하려면 칸 수를 곱해야 한다. (숫자를 바꾸기 전에 왜 줄었는지
    // 부터 봐야 한다 — 확률을 올렸으면 원인은 그대로 남았을 것이다.)
    const cells = Math.max(1, p.cells?.length || 1);

    // 수목 — 인도 위. 기업 구역은 광장에 열 맞춰, 상업은 제각각.
    const treeN = Math.round((D.name === '기업' ? 4 : 2) * det * cells);
    for (let i = 0; i < treeN; i++) {
      if (!rng.chance(rate * 0.7)) continue;
      const edge = rng.int(0, 3);
      const along = edge < 2 ? rng.range(-hx + 8, hx - 8) : rng.range(-hz + 8, hz - 8);
      // 인도 안쪽으로 더 물린다 (0.35~0.7 → 0.45~0.75). 연석에 붙여 심으면
      // 가지가 차도로 넘어간다.
      const inset = walk * rng.range(0.45, 0.75);
      const depth = (edge < 2 ? hz : hx) - inset;
      const tx = edge < 2 ? cx + along : cx + (edge === 2 ? -depth : depth);
      const tz = edge < 2 ? cz + (edge === 0 ? -depth : depth) : cz + along;
      if (hitsBuilding(tx, tz, 1.2)) continue;
      b.mark('holo', `holoTree#${trees}`, { zone: D.name, axis: edge < 2 ? 'z' : 'x' });
      digitalTree(b, tx, tz, rng, mats, pools, inset);
      trees++;
    }

    // ── 투사 조형 — 이 구역이 무엇을 투사하나 ──────────────────────────
    // 수목과 같은 자리 논리(인도 위, 연석에서 물러남)를 쓰되 **광추가
    // 벌어지므로 여유를 더 준다.** 차도로 넘어가면 배치 검사가 잡는다.
    const subj = SUBJECTS[D.name];
    const figN = subj.length ? Math.round((D.name === '주거' ? 1 : 3) * det * cells) : 0;
    for (let i = 0; i < figN; i++) {
      // rng 는 조건과 무관하게 같은 개수를 뽑는다 — 건너뛰어도 뒤가 안 밀리게
      const roll = rng.chance(rate * 0.55);
      const edge = rng.int(0, 3);
      const along = edge < 2 ? rng.range(-hx + 10, hx - 10) : rng.range(-hz + 10, hz - 10);
      const kind = subj[rng.int(0, Math.max(0, subj.length - 1))];
      const inset = walk * rng.range(0.5, 0.8);
      if (!roll) continue;
      const depth = (edge < 2 ? hz : hx) - inset;
      const fx2 = edge < 2 ? cx + along : cx + (edge === 2 ? -depth : depth);
      const fz2 = edge < 2 ? cz + (edge === 0 ? -depth : depth) : cz + along;
      // 차도를 안 밟는지, 벽에 안 박히는지 먼저 묻는다. 점이 아니라
      // **폭으로** 묻되 (layout.spanInRoad), 그 폭은 **바닥에 닿는 것**의
      // 폭이다 — 바닥 링 반폭이다. 공중의 광추를 기준으로 재면 인도에
      // 들어갈 수 있는 자리가 없어진다.
      const rr = SUBJ[kind].spread[1] * 0.7 + 0.4;
      if (spanInRoad(fx2 - rr, fx2 + rr) || spanInRoad(fz2 - rr, fz2 + rr)) continue;
      // ── 벽 여유는 **바닥의 투사기** 기준이다 ──────────────────────────
      // 처음에 광추 반경(rr, 2.4~3.6m)으로 물었더니 101기가 21기로 줄고
      // 잉어·안내는 아예 사라졌다. 상은 4~7m 위에 떠 있으므로 파사드와
      // 겹쳐도 그림으로는 자연스럽고, 사용자가 지적한 것은 **받침대가 벽에
      // 박힌 것**이다. 여유는 막으려는 것의 크기로 잡는다 (받침 반지름 0.8).
      if (hitsBuilding(fx2, fz2, 1.3)) continue;
      b.mark('holo', `holoFigure#${figures}`, { zone: D.name, axis: edge < 2 ? 'z' : 'x' });
      projectedFigure(b, fx2, fz2, kind, rng, mats, pools);
      figures++;
    }

    // 투사 기둥 — 기업 구역만. 아무 기능도 없이 에너지만 쓰는 과시다.
    if (D.name === '기업' && rng.chance(0.35 * det)) {
      // 기둥은 대지 한가운데에 독립해 선다 — 붙은 면이 없으므로 axis 가 없고,
      // 검사는 두 축을 다 본다.
      const bx = cx + rng.range(-12, 12);
      const bz = cz + rng.range(-12, 12);
      // 빛기둥은 바닥 원반이 반지름 R*2(최대 10.4m)까지 퍼진다. 기둥 좌표만
      // 보면 원반이 차도를 덮는다 — 실제로 3.31m 나갔다. 원반으로 묻는다.
      if (spanInRoad(bx - 5.2, bx + 5.2) || spanInRoad(bz - 5.2, bz + 5.2)) continue;
      if (hitsBuilding(bx, bz, 2.0)) continue;
      b.mark('holo', `holoBeam#${beams}`, { zone: D.name });
      beamColumn(b, bx, bz, rng, pools);
      beams++;
    }
  }

  return { group: b.build(scene), pools, count: panels + trees + beams + markers + figures,
           panels, trees, beams, markers, figures };
}
