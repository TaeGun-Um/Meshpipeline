// 소품 — 이 층에 사람이 있었다는 증거.
//
// 껍데기만 있으면 "빈 시설" 이다. 도시에서 눈높이가 비어 있다는 지적을 네 번
// 받았고 (기업·주거·슬럼·공업), 실내는 눈높이밖에 없으니 여기서는 그게 전부다.
//
// ── 두 규칙 ────────────────────────────────────────────────────────────────
// 1. **붙는 것은 붙을 면을 물어본다.** 벽 소품은 `interiorWalls()` 가 돌려준
//    자리에만 앉는다. 좌표를 손으로 적으면 벽을 옮길 때 허공에 뜬다.
// 2. **개수는 밀도에서 나온다.** 면적·길이에서 유도한다. 고정 개수를 쓰면
//    12m 방과 3m 방이 같은 수를 받는다 (lessons.md 3.4).
import * as THREE from 'three';
import { MeshBuilder } from '../../core/builder.js';
import { hash2 } from '../../core/textures.js';
import { CELLS, H, W, byId, interiorWalls, onWall, wallRuns, openingsOf } from './layout.js';
import { ductPlan } from './duct.js';

// 축에 안 맞는 조각. MeshBuilder.box 는 축 정렬만 낸다.
function boxAt(b, w, h, d, at, mat, yaw = 0) {
  const g = new THREE.BoxGeometry(w, h, d);
  if (yaw) g.rotateY(yaw);
  g.translate(at[0], at[1], at[2]);
  b.add(g, mat);
}

// 눕힌 원기둥. 뚜껑은 안 만든다 (양 끝이 무언가에 물려 있을 때).
function tube(b, r, len, at, mat, axis = 'y', seg = 6, capped = false) {
  const g = new THREE.CylinderGeometry(r, r, len, seg, 1, !capped);
  if (axis === 'x') g.rotateZ(Math.PI / 2);
  if (axis === 'z') g.rotateX(Math.PI / 2);
  g.translate(at[0], at[1], at[2]);
  b.add(g, mat);
}

// ── 상호작용 소품의 분리 ───────────────────────────────────────────────────
//
// 병합 배치(Props)는 **배경 소품만** 한다. 크랙(파괴)·약탈 포즈처럼 게임에서
// 개별 상태를 갖는 물건은 저마다 독립 노드로 살아남아야 유니티에서 개별
// 콜라이더와 상태를 받는다 — 병합되면 어느 정점이 어느 물건인지 알 길이 없다.
//
// 이름은 결정적이다. 생성이 시드·좌표 해시에 고정되므로 같은 코드는 같은
// 번호를 낸다 — 유니티 스크립트가 이 이름(rack_07 등)으로 물건을 찾는다.
//
// 비용: 노드마다 재질 수만큼 드로우콜이 는다 (병합의 반대급부). 실측은
// scenes/office-sector/status.md 1장. 배치 원장은 그대로다 — mark 는 전역
// 원장에 쓰므로 어느 빌더에 조각을 넣든 열린 기록으로 들어간다.
// ── 잔소품 — 컵·캔·통조림·시계·쓰레기통 (챕터 0 [전] 디테일 패스) ──────────
//
// "사람이 일하다 나간 층" 의 인상은 가구가 아니라 **가구 위에 남은 것**이
// 만든다 (story.md — 챕터 0 은 튜토리얼 무대다). 전부 배경 병합이다 —
// 게임 아이템 스폰은 게임 프로젝트 몫이고 여기는 미술이다. 자리는 좌표
// 해시로 뽑는다 (난수 규율).
//
// 조각 목록 (lessons 3.13.1 — 이것에 대고 확인한다):
//   머그컵   원통 몸 + **반토러스 귀** — 귀가 없으면 연필꽂이다
//   캔/통조림 몸통 원기둥 + **라벨 띠** + 어두운 윗면 — 띠가 없으면 파이프 토막
//   접시 더미 낮은 원기둥 + 짙은 테 — 한 장씩 내면 수백 조각이라 더미로
//   벽시계   원판 + 테(토러스) + 시침·분침 — 바늘이 없으면 접시다
//   쓰레기통 위가 뚫린 원통 + 속 어둠 + 바닥 — 뚜껑 덮인 원통은 그냥 통이다

function mug(b, x, y, z, M, tint) {
  tube(b, 0.036, 0.085, [x, y + 0.043, z], tint, 'y', 8);
  const ear = new THREE.TorusGeometry(0.026, 0.008, 5, 8, Math.PI);
  ear.rotateZ(-Math.PI / 2); // 호가 +x 로 불룩 — 컵 옆구리에 귀
  ear.translate(x + 0.036, y + 0.046, z);
  b.add(ear, tint);
}

function can(b, x, y, z, r, h, M, label) {
  tube(b, r, h, [x, y + h / 2, z], M.steel, 'y', 8);
  tube(b, r + 0.0025, h * 0.55, [x, y + h / 2, z], label, 'y', 8); // 라벨 띠
  tube(b, r - 0.004, 0.005, [x, y + h + 0.002, z], M.steelDark, 'y', 8, true);
}

function plateStack(b, x, y, z, M, n = 6) {
  tube(b, 0.115, n * 0.021, [x, y + (n * 0.021) / 2, z], M.porcelain, 'y', 10);
  tube(b, 0.105, 0.006, [x, y + n * 0.021 + 0.002, z], M.rubber, 'y', 10, true); // 맨 위 오목
}

function paperPile(b, x, y, z, M, seed) {
  const n = 2 + Math.floor(hash2(seed, 3) * 3);
  for (let i = 0; i < n; i++) {
    const r = hash2(seed * 7 + i, 11);
    boxAt(b, 0.24, 0.008, 0.31, [x + (r - 0.5) * 0.04, y + 0.004 + i * 0.009, z + (r - 0.5) * 0.05], M.paper, (r - 0.5) * 0.5);
  }
}

function wallClock(b, w, u, M) {
  const put = (g, m) => wallPut(b, w, u, g, m);
  const face = new THREE.CylinderGeometry(0.15, 0.15, 0.018, 14);
  face.rotateX(Math.PI / 2);
  face.translate(0, 2.25, 0.035);
  put(face, M.porcelain);
  const rim = new THREE.TorusGeometry(0.15, 0.012, 6, 14);
  rim.translate(0, 2.25, 0.044);
  put(rim, M.rubber);
  // 시침 10시 · 분침 2시 방향 — 지진의 시각으로 어차피 멎을 시계다
  for (const [len, ang] of [[0.07, 2.6], [0.11, -1.0]]) {
    const hand = new THREE.BoxGeometry(0.014, len, 0.008);
    hand.translate(0, len / 2, 0);
    hand.rotateZ(ang);
    hand.translate(0, 2.25, 0.048);
    put(hand, M.rubber);
  }
}

// 접힌 신문 — 접은 자리로 갈린 두 면 + 헤드라인 띠 + 아래 단(段).
// 그냥 흰 판이면 종이 한 장이다. **접힌 자국과 검은 글줄**이 신문을 만든다.
function newspaper(b, x, y, z, yaw, M) {
  const put = (g, m) => {
    g.rotateY(yaw);
    g.translate(x, y, z);
    b.add(g, m);
  };
  const sheet = (w, d, ly, m) => {
    const g = new THREE.BoxGeometry(w, 0.006, d);
    g.translate(0, ly, 0);
    put(g, m);
  };
  sheet(0.3, 0.22, 0.003, M.paper); // 아래장
  sheet(0.29, 0.21, 0.009, M.paper); // 위장 — 살짝 어긋난다
  // 접힌 등마루 — 한쪽 모서리가 도톰하다
  const spine = new THREE.BoxGeometry(0.3, 0.016, 0.022);
  spine.translate(0, 0.008, -0.1);
  put(spine, M.paper);
  // 헤드라인 — 굵은 줄 하나와 잔 글줄 셋
  const ink = (w, d, lx, lz) => {
    const g = new THREE.BoxGeometry(w, 0.002, d);
    g.translate(lx, 0.013, lz);
    put(g, M.rubber);
  };
  ink(0.2, 0.026, -0.02, 0.055);
  for (let i = 0; i < 3; i++) ink(0.24, 0.008, 0, 0.01 - i * 0.022);
}

// 숟가락·포크 — 손잡이 관 + 머리. 스푼은 납작한 타원, 포크는 갈퀴 셋.
// 식탁에 **집기가 없으면 밥을 먹는 자리가 아니다**.
function cutlery(b, x, y, z, yaw, M) {
  const put = (g, m) => {
    g.rotateY(yaw);
    g.translate(x, y, z);
    b.add(g, m);
  };
  for (const [dx, fork] of [[-0.035, false], [0.035, true]]) {
    const stem = new THREE.CylinderGeometry(0.005, 0.005, 0.11, 5);
    stem.rotateX(Math.PI / 2);
    stem.translate(dx, 0.005, -0.01);
    put(stem, M.steel);
    if (fork) {
      for (const k of [-1, 0, 1]) {
        const t = new THREE.BoxGeometry(0.006, 0.004, 0.035);
        t.translate(dx + k * 0.009, 0.005, 0.062);
        put(t, M.steel);
      }
      const base = new THREE.BoxGeometry(0.026, 0.004, 0.014);
      base.translate(dx, 0.005, 0.05);
      put(base, M.steel);
    } else {
      const bowlG = new THREE.CylinderGeometry(0.016, 0.016, 0.005, 8);
      bowlG.scale(1, 1, 1.7);
      bowlG.translate(dx, 0.005, 0.062);
      put(bowlG, M.steel);
    }
  }
}

// 책 줄 — 두께·높이가 제각각인 판들. 같은 판을 반복하면 벽지다.
// 몇 권은 기울어 기대 있어야 **책장에 손이 닿는 방**으로 읽힌다.
function bookRow(b, w, u0, len, y, M, seed) {
  const PAL = [M.vend, M.vendBlue, M.crate, M.carton, M.plasticWarm, M.trim];
  let t = 0.02;
  let i = 0;
  while (t < len - 0.05) {
    const r = hash2(seed * 7 + i, Math.round(y * 100) + i * 3);
    const th = 0.022 + r * 0.03;
    if (t + th > len - 0.05) break;
    const hgt = 0.2 + r * 0.08;
    const m = PAL[Math.floor(r * PAL.length) % PAL.length];
    if (r > 0.86) {
      // 기울어 기댄 책 — 옆 책에 몸을 붙인다
      const g = new THREE.BoxGeometry(th, hgt, 0.15);
      g.rotateZ(0.22);
      g.translate(0, hgt / 2, 0);
      const [px, , pz] = wallAt(w, u0 + t + th / 2, 0.16, 0);
      g.translate(px, y, pz);
      b.add(g, m);
    } else {
      wallBox(b, w, u0 + t + th / 2, 0.16, y + hgt / 2, th, hgt, 0.15, m);
    }
    t += th + 0.004;
    i++;
  }
  return i;
}

// 연필꽂이 — 통 + 연필 몇 자루 (끝이 뾰족한 원뿔). 책상 위의 작은 말뚝들이
// "쓰던 자리" 를 만든다.
function pencilCup(b, x, y, z, M) {
  tube(b, 0.035, 0.09, [x, y + 0.045, z], M.steelDark, 'y', 8);
  const PAL = [M.warn, M.vend, M.vendBlue, M.trim];
  for (let i = 0; i < 4; i++) {
    const r = hash2(Math.round(x * 31) + i, Math.round(z * 17));
    const a = (i / 4) * Math.PI * 2;
    const lean = 0.12 + r * 0.1;
    const g = new THREE.CylinderGeometry(0.004, 0.004, 0.17, 5);
    g.rotateZ(Math.sin(a) * lean);
    g.rotateX(Math.cos(a) * lean);
    g.translate(x + Math.sin(a) * 0.012, y + 0.13, z + Math.cos(a) * 0.012);
    b.add(g, PAL[i % PAL.length]);
    const tip = new THREE.CylinderGeometry(0.0005, 0.004, 0.014, 5);
    tip.translate(x + Math.sin(a) * 0.02, y + 0.222, z + Math.cos(a) * 0.02);
    b.add(tip, M.paper);
  }
}

// 모서리가 둥근 직사각 판 — 회의 탁자 상판 (2026-08-06 사용자 스케치).
//
// 원판도 상자도 아닌 형태다: **긴 직선 변 + 둥근 네 모서리**. 가운데 띠 둘을
// 십자로 겹치고 네 귀퉁이에 사분 원기둥을 끼워 만든다 — 상자에 원기둥을
// 얹으면 모서리가 두 겹으로 튀어나온다.
function roundedSlab(b, cx, cz, W2, L2, r, y, h, mat, seg = 6) {
  b.box(W2, h, L2 - r * 2, [cx, y, cz], mat, 0); // 세로 띠
  b.box(W2 - r * 2, h, L2, [cx, y, cz], mat, 0); // 가로 띠
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      // 사분 원기둥 — thetaStart 는 +z 에서 시작해 +x 로 돈다
      const t0 = sx > 0 ? (sz > 0 ? 0 : Math.PI / 2) : sz > 0 ? -Math.PI / 2 : Math.PI;
      const g = new THREE.CylinderGeometry(r, r, h, seg, 1, false, t0, Math.PI / 2);
      g.translate(cx + sx * (W2 / 2 - r), y, cz + sz * (L2 / 2 - r));
      b.add(g, mat);
    }
  }
}

// 노트북 — 자판 몸통과 **뒤로 젖혀진 화면**. 두 판의 각도가 노트북을 만든다
// (평행하게 두면 접힌 것이고, 90도면 책이다). 90년대 후반이라 두껍고 베이지다.
//
// 조각 (lessons 3.13.1): 몸통 · 자판 칸 · 손목 받침 · 트랙포인트 · 젖혀진 화면 ·
// 화면 테 · 경첩 관.
function laptop(b, x, y, z, yaw, M) {
  const put = (g, m) => {
    g.rotateY(yaw);
    g.translate(x, y, z);
    b.add(g, m);
  };
  const bx = (w2, h2, d2, lx, ly, lz, m) => {
    const g = new THREE.BoxGeometry(w2, h2, d2);
    g.translate(lx, ly, lz);
    put(g, m);
  };
  bx(0.31, 0.026, 0.25, 0, 0.013, 0, M.crt); // 몸통
  bx(0.25, 0.006, 0.1, 0, 0.029, -0.03, M.keycap); // 자판 칸
  bx(0.09, 0.004, 0.05, 0, 0.029, 0.07, M.crt); // 손목 받침 가운데 트랙패드
  bx(0.012, 0.006, 0.012, 0, 0.032, -0.03, M.vend); // 트랙포인트
  // 경첩 관 — 몸통 뒤 모서리
  const hg = new THREE.CylinderGeometry(0.008, 0.008, 0.28, 6);
  hg.rotateZ(Math.PI / 2);
  hg.translate(0, 0.03, -0.122);
  put(hg, M.crtDark);
  // 화면 — 뒤로 100도쯤 젖혀진다
  const lid = new THREE.BoxGeometry(0.3, 0.22, 0.014);
  lid.translate(0, 0.11, 0);
  lid.rotateX(-1.75);
  lid.translate(0, 0.035, -0.125);
  put(lid, M.crt);
  const scr = new THREE.BoxGeometry(0.25, 0.17, 0.006);
  scr.translate(0, 0.11, 0.009);
  scr.rotateX(-1.75);
  scr.translate(0, 0.035, -0.125);
  put(scr, M.screen);
}

// 화이트보드 — 흰 판 + 알루미늄 테 + **마커 받침**. 받침이 없으면 그냥 흰 판이고,
// 받침 위의 마커와 지우개가 "쓰던 보드" 로 만든다.
function whiteboard(b, w, u, M) {
  const BW = 2.4;
  const BH = 1.2;
  const cy = 1.55;
  wallBox(b, w, u, 0.03, cy, BW, BH, 0.03, M.porcelain); // 판
  // 테 넷 — 판보다 살짝 나온다 (겹평면 금지)
  wallBox(b, w, u, 0.045, cy + BH / 2, BW + 0.06, 0.05, 0.05, M.trim);
  wallBox(b, w, u, 0.045, cy - BH / 2, BW + 0.06, 0.05, 0.05, M.trim);
  for (const s of [-1, 1]) wallBox(b, w, u + s * (BW / 2), 0.045, cy, 0.05, BH + 0.06, 0.05, M.trim);
  // 마커 받침 — 판 아래 턱
  wallBox(b, w, u, 0.075, cy - BH / 2 - 0.06, BW - 0.2, 0.03, 0.08, M.trim);
  wallBox(b, w, u, 0.11, cy - BH / 2 - 0.04, BW - 0.2, 0.05, 0.012, M.trim); // 앞턱
  for (const [du, mm] of [[-0.5, M.rubber], [-0.36, M.vend], [-0.24, M.vendBlue]]) {
    const [px, , pz] = wallAt(w, u + du, 0.085, 0);
    const g = new THREE.CylinderGeometry(0.011, 0.011, 0.12, 6);
    g.rotateZ(Math.PI / 2);
    if (w.axis === 'z') g.rotateY(Math.PI / 2);
    g.translate(px, cy - BH / 2 - 0.025, pz);
    b.add(g, mm);
  }
  wallBox(b, w, u + 0.5, 0.085, cy - BH / 2 - 0.015, 0.16, 0.05, 0.06, M.steelDark); // 지우개
  // 글씨 자국 — 지우고 남은 희미한 줄 (판이 완전히 희면 새 것이다)
  for (let i = 0; i < 3; i++) {
    wallBox(b, w, u - 0.4 + i * 0.35, 0.038, cy + 0.28 - i * 0.16, 0.5 + i * 0.12, 0.035, 0.004, M.bezel);
  }
}

function bin(b, x, z, M) {
  tube(b, 0.15, 0.48, [x, 0.24, z], M.steelDark, 'y', 10); // 옆면 (위 뚫림)
  tube(b, 0.136, 0.016, [x, 0.44, z], M.rubber, 'y', 10, true); // 속 어둠
  tube(b, 0.144, 0.018, [x, 0.01, z], M.steelDark, 'y', 10, true); // 바닥
}

function interactSet() {
  const group = new THREE.Group();
  group.name = 'Interactables';
  // 약탈 뒤의 열림 포즈. **씬에 안 붙는다** — 화면 비용 0. 굽기와 익스포트만
  // 태운다 (bake 는 그룹을 직접 순회하고 지오메트리는 월드 좌표라 씬 소속이
  // 필요 없다). 유니티가 닫힘/열림을 토글한다 — 1프레임 상태 교체이므로
  // 열림 상태는 열림 포즈 그대로 구워 둔다.
  const openGroup = new THREE.Group();
  openGroup.name = 'InteractablesOpen';
  // 굽기는 받되 **밝기 통계에는 안 들어간다** — 화면에 없는 포즈의 정점이
  // 칸 바닥 통계·분포(p995)에 섞이면 잣대가 씬이 아니게 된다 (bake.js).
  openGroup.userData.bakeStats = false;
  // 시작 방의 **전(지진 전) 상태** — 인트로 전용. 열림 포즈와 같은 수법으로
  // 씬 밖에 두고 굽기·익스포트만 태운다. 유니티가 인트로 동안만 켠다.
  const preGroup = new THREE.Group();
  preGroup.name = 'StartRoomPre';
  preGroup.userData.bakeStats = false;
  const counts = {};
  const builders = [];
  const openBuilders = [];
  const preBuilders = [];
  return {
    group,
    openGroup,
    preGroup,
    counts,
    get openCount() {
      return openBuilders.length;
    },
    // 전 상태 조각 — 상호작용이 아니라 인트로 무대 세트다. 원장에 안 올린다.
    spawnPre(name) {
      const nb = new MeshBuilder(name, { ledger: false });
      preBuilders.push(nb);
      return nb;
    },
    spawn(kind) {
      const n = (counts[kind] = (counts[kind] ?? 0) + 1);
      const nb = new MeshBuilder(`${kind}_${String(n).padStart(2, '0')}`);
      builders.push(nb);
      return nb;
    },
    // 약탈 가능한 물건 — 닫힘(씬에 보이는 것)과 열림(약탈 뒤 포즈) 두 벌.
    // 같은 번호를 나눠 갖는다 (rack_07 / rack_07_open). 열림 빌더는 배치
    // 원장에 안 올린다 — 열린 문짝은 "지금 씬에 있는 것" 이 아니다.
    spawnPair(kind) {
      const n = (counts[kind] = (counts[kind] ?? 0) + 1);
      const name = `${kind}_${String(n).padStart(2, '0')}`;
      const closed = new MeshBuilder(name);
      const open = new MeshBuilder(`${name}_open`, { ledger: false });
      builders.push(closed);
      openBuilders.push(open);
      return { closed, open };
    },
    build(scene) {
      for (const nb of builders) nb.build(group);
      scene.add(group);
      for (const nb of openBuilders) nb.build(openGroup);
      for (const nb of preBuilders) nb.build(preGroup);
      return group;
    },
  };
}

// ── 벽에 붙는 물건의 좌표계 ────────────────────────────────────────────────
//
// 벽마다 축이 x 냐 z 냐로 갈리면 조각마다 삼항연산자가 붙고, 하나만 틀려도
// 그 조각이 벽 속에 박힌다. **(벽을 따라 u, 방 안쪽으로 v, 위로 y)** 로 한 번
// 옮겨 두고 조각은 그 좌표로만 쓴다. 자판기 앞면 유리가 본체 속에 묻혀 있던
// 것도 이 변환을 손으로 하다 난 실수였다.
const wallAt = (w, u, v, y) =>
  w.axis === 'x' ? [u, y, w.at + w.inward * v] : [w.at + w.inward * v, y, u];
const wallSize = (w, wid, h, thick) =>
  w.axis === 'x' ? [wid, h, thick] : [thick, h, wid];
// 벽에 붙는 상자 하나. wid 는 벽을 따라, thick 은 방 안쪽으로.
const wallBox = (b, w, u, v, y, wid, h, thick, mat) => {
  const s = wallSize(w, wid, h, thick);
  b.box(s[0], s[1], s[2], wallAt(w, u, v, y), mat, 0);
};

// 경첩처럼 벽면에서 **회전해 여닫는** 조각 — 축 정렬 wallBox 로는 못 놓는다.
// 로컬 (+x = 벽을 따라, +z = 방 안쪽, 원점 = 벽 위 u0·바닥) 에서 짓고 한 번에
// 옮긴다. 축·inward 조합 둘에서 로컬 +x 가 세계에서 뒤집히는데(회전은 반사가
// 아니므로), 경첩이 반대 모서리로 가는 것뿐이라 시각적으로 무해하고 결정론은
// 유지된다.
const wallYaw = (w) =>
  w.axis === 'x' ? (w.inward > 0 ? 0 : Math.PI) : w.inward > 0 ? Math.PI / 2 : -Math.PI / 2;
const wallPut = (b, w, u0, g, m) => {
  g.rotateY(wallYaw(w));
  const [px, , pz] = wallAt(w, u0, 0, 0);
  g.translate(px, 0, pz);
  b.add(g, m);
};

// 간격 p 로 [lo, hi] 를 채운 중심들. 자리가 모자라면 빈 배열 — **하나를
// 억지로 끼워 넣지 않는다.** 1.2m 방에 2.4m 식탁을 넣으면 벽을 뚫는다.
function fit(lo, hi, p, margin = 0) {
  const a = lo + margin;
  const b = hi - margin;
  if (b - a < p * 0.9) return [];
  const n = Math.max(1, Math.floor((b - a) / p));
  const step = (b - a) / n;
  const out = [];
  for (let i = 0; i < n; i++) out.push(a + step * (i + 0.5));
  return out;
}

// ── 의자 ───────────────────────────────────────────────────────────────────
//
// 카페테리아와 사무실이 **같은 함수**를 쓴다. 처음에는 각자 상자 셋씩 쌓았고,
// 화면에서 등받이가 의자가 아니라 **칸막이**로 보였다.
//
// 의자를 의자로 만드는 것은 셋이다.
//   1. 등받이의 **기울기** — 수직이면 그냥 판이다
//   2. 좌판과 등받이 **사이의 틈** — 실제 의자는 둘이 붙어 있지 않다
//   3. **관** 다리 — 상자로 내면 각목이다. 배관에서 같은 것을 배웠다
//      (services 의 "실루엣이 그 물건을 정한다")
//
// at    바닥에 닿는 지점(다리 밑). face 는 **앉은 사람이 보는 방향**(라디안).
// 로컬 좌표는 등받이가 -z, 앉는 사람이 +z 를 본다. 다 짓고 나서 face 만큼
// 돌리고 세계 좌표로 옮긴다 — 조각마다 삼각함수를 쓰면 하나만 틀려도 어긋난다.
function chair(b, at, face, M, mat, swivel = false) {
  const [ox, oy, oz] = at;
  const put = (g, m) => {
    g.rotateY(face);
    g.translate(ox, oy, oz);
    b.add(g, m);
  };
  const slab = (w, h, d, lx, ly, lz, m, tilt = 0) => {
    const g = new THREE.BoxGeometry(w, h, d);
    if (tilt) g.rotateX(tilt);
    g.translate(lx, ly, lz);
    put(g, m);
  };
  // 관. **뚜껑을 안 만든다** — 한쪽은 바닥에 닿고 한쪽은 좌판에 가린다.
  // 6각 열린 관이 12삼각형이라, 상자(12)와 같은 값에 실루엣만 얻는다.
  // 이름을 tube 로 두면 최상단의 tube(다른 시그니처)를 가린다 — pipe 로 갈랐다.
  const pipe = (r0, r1, len, lx, ly, lz, m, tilt = 0, lay = null) => {
    const g = new THREE.CylinderGeometry(r0, r1, len, 6, 1, true);
    if (lay === 'x') g.rotateZ(Math.PI / 2);
    if (lay === 'z') g.rotateX(Math.PI / 2);
    if (tilt) g.rotateX(tilt);
    g.translate(lx, ly, lz);
    put(g, m);
  };

  const TILT = -0.2; // 등받이가 뒤로 눕는 각 (약 11도)

  // 좌판 — 얇은 판 + 그 밑의 조금 작은 틀. 이 **그늘 틈**이 판때기와 의자를
  // 가른다. 뒤로 살짝 기운다 (실제 의자가 그렇다).
  slab(0.41, 0.032, 0.38, 0, 0.462, 0, mat, 0.05);
  slab(0.37, 0.026, 0.34, 0, 0.436, 0, M.trim, 0.05);

  // 등받이 — 좌판에서 8cm 띄운다
  slab(0.38, 0.3, 0.028, 0, 0.7, -0.185, mat, TILT);

  if (swivel) {
    // 사무 의자 — 다섯 갈래 받침에 가스 기둥. 등받이는 기둥 하나로 붙는다.
    for (let i = 0; i < 5; i++) {
      const g = new THREE.CylinderGeometry(0.019, 0.012, 0.26, 5, 1, true);
      g.rotateZ(Math.PI / 2);
      g.translate(0.15, 0.05, 0);
      g.rotateY((i / 5) * Math.PI * 2);
      put(g, M.trim);
      const w = new THREE.CylinderGeometry(0.027, 0.027, 0.03, 5, 1, true);
      w.translate(0.27, 0.032, 0);
      w.rotateY((i / 5) * Math.PI * 2);
      put(w, M.rubber);
    }
    pipe(0.032, 0.032, 0.35, 0, 0.235, 0, M.trim);
    pipe(0.046, 0.046, 0.13, 0, 0.13, 0, M.steelDark);
    pipe(0.02, 0.02, 0.24, 0, 0.6, -0.15, M.trim, TILT);
    return;
  }

  // 식당 의자 — 관 네 다리에 옆 가로대. 겹쳐 쌓는 그 의자다.
  for (const dx of [-0.185, 0.185]) {
    for (const dz of [-0.165, 0.165]) pipe(0.014, 0.014, 0.46, dx, 0.23, dz, M.trim);
    pipe(0.011, 0.011, 0.33, dx, 0.13, 0, M.trim, 0, 'z');
    pipe(0.014, 0.014, 0.34, dx * 0.92, 0.6, -0.175, M.trim, TILT);
  }
}

// ── 단말기 — 브라운관과 자판 ───────────────────────────────────────────────
//
// **화면이 사람 쪽을 봐야 한다.** 예전에는 화면 판을 몸통의 **뒷면**에 붙여
// 놓아서, 책상마다 흰 상자만 하나씩 놓여 있었다. 이런 것은 감사도 배치 검사도
// 안 잡는다 — 지오메트리는 멀쩡히 다 있기 때문이다 (lessons.md 2.1 의 7번,
// "재질이 무엇을 하는지 이름으로 믿지 않는다" 와 같은 자리).
//
// 브라운관을 브라운관으로 만드는 것 넷: **뒤로 좁아지는 몸통**, 두꺼운 베젤,
// 그 안으로 들어간 화면, 받침. 자판은 **줄이 보여야** 자판이다.
//
// at 은 책상 상판 위의 기준점. dir 은 사람이 앉은 쪽(+1 이면 +z).
function terminal(b, x, y, z, dir, M) {
  const f = dir;

  // 받침 — 회전 받침 두 단
  b.box(0.28, 0.022, 0.24, [x, y + 0.011, z], M.crtDark, 0);
  b.box(0.2, 0.028, 0.18, [x, y + 0.036, z], M.crt, 0);

  // 몸통 — 앞이 크고 뒤가 작다. 두 토막으로 그 테이퍼를 낸다.
  const cy = y + 0.23;
  b.box(0.4, 0.36, 0.3, [x, cy, z - f * 0.03], M.crt, 0);
  b.box(0.3, 0.27, 0.13, [x, cy + 0.01, z - f * 0.24], M.crt, 0);
  // 통풍 슬롯 — 위쪽에 셋
  for (const dz of [-0.05, 0.01, 0.07]) {
    b.box(0.24, 0.008, 0.02, [x, cy + 0.181, z - f * (0.03 + dz)], M.crtDark, 0);
  }

  // 베젤과 화면. 처음에 화면 앞면이 베젤 앞면과 **정확히 같은 평면**(fz+0.010)
  // 이라 근접에서 z-파이팅 빗금이 났다 (#65). "안쪽으로 물린다" 고 6mm 뒤로
  // 옮겼더니 이번엔 통짜 베젤 상자 **속에** 묻혀 화면이 통째로 사라졌다 —
  // 자판기 상품과 같은 병(#64)이다. 베젤이 틀이 아니라 상자인 이상 화면은
  // **앞으로 4mm 돌출**이 맞다 (뒤끝은 베젤 안, 앞면은 베젤 밖 — 겹평면 없음).
  const fz = z - f * 0.03 + f * 0.15; // 몸통 앞면
  b.box(0.38, 0.34, 0.02, [x, cy, fz], M.crtDark, 0);
  b.box(0.3, 0.235, 0.012, [x, cy + 0.028, fz + f * 0.008], M.screen, 0);
  // 아래 조작부 — 버튼 넷과 전원 표시등. 가로 오프셋에도 f 를 곱는다 —
  // 안 곱하면 dir=-1 로 돌린 책상에서 마우스·숫자판이 반대쪽에 붙는다.
  for (const dx of [-0.09, -0.05, -0.01, 0.03]) {
    b.box(0.022, 0.012, 0.008, [x + f * dx, cy - 0.135, fz + f * 0.012], M.crt, 0);
  }
  b.box(0.014, 0.01, 0.008, [x + f * 0.13, cy - 0.135, fz + f * 0.012], M.led, 0);

  // ── 자판 ─────────────────────────────────────────────────────────────
  //
  // 자판은 줄이 아니라 **키가 보여야** 자판이다. 줄을 세 토막으로 끊어 내던
  // 판은 눈높이에서 "널판 위 막대" 로 읽혔다 (2026-08-06 지적). 키를 하나씩
  // 낸다 — 단말기당 상자 약 80개인데, 삼각형 예산 판단은 브라우저가 아니라
  // 유니티에서 한다 (memory: browser-is-a-preview).
  const kz = z + f * 0.24;
  b.box(0.44, 0.016, 0.17, [x, y + 0.008, kz], M.crt, 0); // 몸체
  b.box(0.44, 0.024, 0.028, [x, y + 0.02, kz - f * 0.071], M.crt, 0); // 뒤 능선이 높다
  // r 은 줄 번호 — 뒤(작은 r)가 높은 경사. 키 밑동은 몸체에 살짝 잠긴다.
  const key = (dx, d, w, r) =>
    b.box(w, 0.014, 0.019, [x + f * dx, y + 0.0225 - r * 0.0015, kz + f * d], M.keycap, 0);
  for (let i = 0; i < 8; i++) key(-0.175 + i * 0.042, -0.044, 0.026, -1); // 기능키 줄 — 성기게
  for (let r = 0; r < 4; r++) {
    const d = -0.018 + r * 0.024;
    for (let i = 0; i < 12; i++) key(-0.18 + i * 0.024, d, 0.02, r); // 본판 12열
    key(0.111, d, 0.03, r); // 줄 끝의 넓은 키 — 백스페이스·엔터·시프트
  }
  key(-0.045, 0.074, 0.12, 4); // 스페이스
  for (const dx of [-0.18, -0.152]) key(dx, 0.074, 0.022, 4); // 왼쪽 보조키
  for (const dx of [0.048, 0.076, 0.104]) key(dx, 0.074, 0.022, 4); // 오른쪽 보조키
  for (let r = 0; r < 4; r++)
    for (let i = 0; i < 3; i++) key(0.15 + i * 0.024, -0.018 + r * 0.024, 0.02, r); // 숫자판 4x3

  // ── 마우스 ───────────────────────────────────────────────────────────
  //
  // 상자 하나는 마우스가 아니다 (2026-08-06 지적). 밑판 위에 **눌린 반구**
  // 껍데기(단면이 곡선이면 곡선으로 — lessons.md 3.13.2), 앞에 스크롤 휠,
  // 뒤로 케이블 꼬리까지 있어야 마우스로 읽힌다.
  const mx = x + f * 0.31;
  b.box(0.11, 0.006, 0.13, [mx, y + 0.003, kz], M.crtDark, 0); // 패드
  b.box(0.05, 0.006, 0.088, [mx, y + 0.009, kz], M.crtDark, 0); // 밑판
  let g = new THREE.SphereGeometry(0.034, 12, 7, 0, Math.PI * 2, 0, Math.PI / 2);
  g.scale(0.85, 0.62, 1.45); // 눌리고 길쭉한 반구 = 손등 곡면
  g.translate(mx, y + 0.012, kz);
  b.add(g, M.crt);
  g = new THREE.CylinderGeometry(0.008, 0.008, 0.006, 10);
  g.rotateZ(Math.PI / 2); // 축을 좌우로 눕힌다 — 앞으로 구르는 휠
  g.translate(mx, y + 0.0235, kz - f * 0.028);
  b.add(g, M.crtDark);
  g = new THREE.CylinderGeometry(0.003, 0.003, 0.17, 6); // 마우스 꼬리
  g.rotateX(Math.PI / 2);
  g.rotateY(f * 0.35); // 본체 쪽으로 비스듬히
  g.translate(mx - f * 0.03, y + 0.004, kz - f * 0.14);
  b.add(g, M.rubber);
  g = new THREE.CylinderGeometry(0.003, 0.003, 0.1, 6); // 자판 선
  g.rotateX(Math.PI / 2);
  g.translate(x - f * 0.08, y + 0.004, kz - f * 0.135);
  b.add(g, M.rubber);
}

// ── 천장 설비 ──────────────────────────────────────────────────────────────
//
// 복도 천장 위에는 덕트와 케이블 트레이가 지나간다. 마감 천장에 가려 안 보이지만
// **스프링클러와 점검구는 뚫고 내려온다** — 그게 설비를 이고 사는 건물의 표식이다.
function services(b, c, M, tally, lp) {
  const long = c.z1 - c.z0 > c.x1 - c.x0;
  const lo = long ? c.z0 : c.x0;
  const hi = long ? c.z1 : c.x1;
  const mid = long ? (c.x0 + c.x1) / 2 : (c.z0 + c.z1) / 2;

  // 스프링클러 — 3.0m 격자 (실제 규정도 이 근처다).
  // **형광등 자리는 묻고 비킨다.** 안 물었더니 격자가 등판 한가운데를 뚫고
  // 내려와 발광면에 검은 꼭지가 박혀 있었다 — 놓기 전에 그 자리에 무엇이
  // 있는지 묻는다 (lessons.md 2장의 공통 원인). 등 격자와 스프링클러 격자가
  // 거의 같은 자리라 **빼면 안 되고 옆으로 민다** — 스킵으로 했더니 103개
  // 중 10개만 남았다. 실제 천장도 헤드가 등 사이에 선다.
  const lamps = lp.fixtures.filter((f) => f.cell === c.id);
  const clearLamp = (x, z) => {
    const f = lamps.find((q) => Math.abs(x - q.x) < 0.72 && Math.abs(z - q.z) < 0.42);
    if (!f) return [x, z];
    const dz = z <= f.z ? -0.55 : 0.55; // 등판 짧은 변(z) 옆으로
    const nz = f.z + dz;
    return nz > c.z0 + 0.3 && nz < c.z1 - 0.3 ? [x, nz] : [x, f.z - dz];
  };
  b.mark('service', `sprinkler:${c.id}`);
  for (const x of fit(c.x0, c.x1, 3.0, 0.5)) {
    for (const z of fit(c.z0, c.z1, 3.0, 0.5)) {
      const [sx, sz] = clearLamp(x, z);
      b.cylinder(0.012, 0.012, 0.09, [sx, c.h - 0.045, sz], M.trim, 5);
      b.sphere(0.028, [sx, c.h - 0.1, sz], M.steel, 5, 3);
      tally.sprinkler = (tally.sprinkler ?? 0) + 1;
    }
  }
  b.endMark();

  // 플라자는 마감 천장이 없다 — 배관이 그대로 보인다
  if (c.kind === 'plaza') {
    b.mark('service', `pipes:${c.id}`);
    // **배관은 원기둥이다.** 처음에 상자로 냈더니 천장에 각목이 걸린 것처럼
    // 보였다 — 실루엣이 그 물건을 정한다.
    for (const [off, r, mat] of [
      [-2.2, 0.16, M.steel],
      [-1.5, 0.1, M.steelDark],
      [1.6, 0.22, M.steel],
      [2.3, 0.09, M.steelDark],
    ]) {
      const y = c.h - 0.55;
      const len = hi - lo;
      const g = new THREE.CylinderGeometry(r, r, len, 10, 1);
      g.rotateZ(Math.PI / 2); // 기본은 세로 — 눕힌다
      if (long) g.rotateY(Math.PI / 2);
      g.translate(long ? mid + off : (lo + hi) / 2, y, long ? (lo + hi) / 2 : mid + off);
      b.add(g, mat);
      tally.pipe = (tally.pipe ?? 0) + 1;
      // 행어 — **배관마다**, 천장에서 배관 윗면까지 내려온다. 처음에 배관과
      // 딴 좌표(-1.85·1.95)에 세워 기둥이 허공을 짚고 있었다 — 연결부의
      // 좌표는 연결할 것에서 나와야 한다 (utility 의 배관 행어와 같은 방식).
      const hh = 0.55 - r + 0.04;
      for (const t of fit(lo, hi, 3.6, 1.0)) {
        const at = long ? [mid + off, c.h - hh / 2, t] : [t, c.h - hh / 2, mid + off];
        b.box(0.05, hh, 0.05, at, M.trim, 0);
      }
    }
    b.endMark();
    return;
  }

  // 복도 천장 아래로 내려온 덕트 — 낮은 천장에 굵은 관이 지나가면 뒷복도답다
  if (c.kind === 'corridor') {
    b.mark('service', `duct:${c.id}`);
    const y = c.h - 0.26;
    // 예전에는 양 끝을 0.2m 씩 물려 놓아 **덕트가 허공에서 뚝 끊겼다.**
    // 벽 두께(0.2) 안쪽까지 밀어 넣어 벽 속으로 사라지게 한다.
    const a = lo + 0.06;
    const e = hi - 0.06;
    const len = e - a;
    const ctr = (a + e) / 2;
    // 축을 따라 놓는 도우미 — long 이면 z 로, 아니면 x 로 뻗는다.
    const at = (t, yy, off) => (long ? [mid + off, yy, t] : [t, yy, mid + off]);
    const size = (alongLen, h, cross) =>
      long ? [cross, h, alongLen] : [alongLen, h, cross];

    b.box(...size(len, 0.34, 0.42), at(ctr, y, 0.55), M.steel, 1.2);

    // **이음 플랜지.** 이게 없으면 덕트가 아니라 각목이다 — 실루엣에 마디가
    // 있어야 관으로 읽힌다. 양 끝에도 반드시 하나씩 둔다.
    for (const t of [a + 0.02, ...fit(a, e, 2.4, 0.9), e - 0.02]) {
      b.box(...size(0.04, 0.4, 0.48), at(t, y, 0.55), M.steelDark, 0);
    }

    // 급기구 — 덕트 밑으로 내려온 디퓨저. 덕트가 무엇을 하는 물건인지
    // 말해 주는 유일한 조각이다.
    for (const t of fit(a, e, 4.8, 1.6)) {
      b.box(...size(0.34, 0.1, 0.34), at(t, y - 0.22, 0.55), M.steel, 0);
      b.box(...size(0.3, 0.02, 0.3), at(t, y - 0.28, 0.55), M.steelDark, 0);
      tally.diffuser = (tally.diffuser ?? 0) + 1;
    }

    // 케이블 트레이 — 같은 구간을 쓴다
    b.box(...size(len, 0.06, 0.26), at(ctr, c.h - 0.16, -0.7), M.steelDark, 0.8);
    tally.duct = (tally.duct ?? 0) + 1;
    b.endMark();
  }
}

// ── 벽 소품 ────────────────────────────────────────────────────────────────

// 문 위 유도등. 문이 있는 벽 구간에만 달린다 — 그래서 벽면이 아니라
// **문 자리**를 물어봐야 한다.
// 유도등 — **문 하나에 하나.**
//
// 처음에 `interiorWalls()` 조각마다 달았더니 문 하나에 넷이 붙었다
// (문 양옆으로 조각이 둘, 방 양쪽에서 또 둘). 조각은 "벽이 남은 자리" 지
// "문 자리" 가 아니다. 문을 세려면 문을 물어봐야 한다.
function exitSigns(b, M, tally) {
  for (const run of wallRuns()) {
    if (run.rule !== 'door' && run.rule !== 'wide') continue;
    const { gaps } = openingsOf(run);
    for (const [g0, g1] of gaps) {
      const m = (g0 + g1) / 2;
      const [x, z] = run.axis === 'x' ? [m, run.at] : [run.at, m];
      b.mark('sign', `exit:${run.from}-${run.to}`);
      b.box(run.axis === 'x' ? 0.32 : 0.14, 0.15, run.axis === 'x' ? 0.14 : 0.32, [x, H.door + 0.2, z], M.trim, 0);
      for (const d of [-1, 1]) {
        const p = run.axis === 'x' ? [x, H.door + 0.2, z + d * 0.075] : [x + d * 0.075, H.door + 0.2, z];
        b.box(run.axis === 'x' ? 0.26 : 0.02, 0.1, run.axis === 'x' ? 0.02 : 0.26, p, M.exit, 0);
      }
      b.endMark();
      tally.exit = (tally.exit ?? 0) + 1;
    }
  }
}

// ── 문 팻말 — 방 이름을 영어로 (2026-08-06 사용자 지시) ────────────────────
//
// 기관 건물은 문마다 이름표가 있다. 이게 있어야 "어느 방인지 아는 층" 이고,
// 챕터 0 의 튜토리얼에서 플레이어가 길을 잡는 단서이기도 하다 (story.md 1.1).
//
// **글자는 진짜로 읽힌다** — textures.signTextures 가 5x7 자형을 굽는다.
// 판은 문 **옆** 눈높이에 붙인다: 문 위는 유도등 자리다 (exitSigns).
// 읽는 쪽은 복도다 — 방 안에서는 자기 방 이름을 볼 이유가 없다.
const ROOM_LABEL = {
  server: 'SERVER ROOM',
  control: 'CONTROL',
  dining: 'CANTEEN',
  cafe: 'VENDING',
  kitchen: 'KITCHEN',
  wash: 'RESTROOM',
  shower: 'SHOWERS',
  lounge: 'STAFF ROOM',
  store: 'STORAGE',
  machine: 'MECHANICAL',
  office: 'OFFICE',
  start: 'OFFICE',
  stair: 'STAIRWELL',
  elev: 'ELEVATOR',
};

function roomSigns(b, M, tally) {
  const PW = 0.5; // 판 폭
  const PH2 = 0.125;
  for (const run of wallRuns()) {
    if (run.rule !== 'door' && run.rule !== 'wide' && run.rule !== 'glass') continue;
    if (!run.to) continue;
    const a = byId[run.from];
    const d = byId[run.to];
    // 방과 읽는 쪽(복도·플라자)을 가른다. 둘 다 방이거나 둘 다 복도면 건너뛴다.
    const aIsWay = a.kind === 'corridor' || a.kind === 'plaza';
    const dIsWay = d.kind === 'corridor' || d.kind === 'plaza';
    if (aIsWay === dIsWay) continue;
    const room = aIsWay ? d : a;
    const way = aIsWay ? a : d;
    const label = ROOM_LABEL[room.use];
    if (!label) continue;

    const { gaps } = openingsOf(run);
    if (!gaps.length) continue;
    const [g0, g1] = gaps[0];
    // 문 옆 벽이 남은 쪽에 붙인다 — 넓은 쪽을 고른다
    const right = run.b - g1;
    const left = g0 - run.a;
    if (Math.max(right, left) < PW + 0.2) continue;
    const u = right >= left ? g1 + 0.15 + PW / 2 : g0 - 0.15 - PW / 2;

    // 읽는 쪽으로 향하는 부호. 판의 **+Z 면**이 그쪽을 보게 돌린다 —
    // 상자 UV 는 면마다 좌우가 뒤집히므로 (BoxGeometry ±X 는 서로 거울)
    // 회전으로 맞춰야 글자가 안 뒤집힌다.
    const wayC = run.axis === 'x' ? (way.z0 + way.z1) / 2 : (way.x0 + way.x1) / 2;
    const inward = Math.sign(wayC - run.at);
    if (!inward) continue;

    b.mark('sign', `roomsign:${room.id}`);
    const g = new THREE.BoxGeometry(PW, PH2, 0.018);
    g.rotateY(run.axis === 'x' ? (inward > 0 ? 0 : Math.PI) : inward > 0 ? Math.PI / 2 : -Math.PI / 2);
    const at = run.axis === 'x'
      ? [u, 1.72, run.at + inward * (W.wall / 2 + 0.009)]
      : [run.at + inward * (W.wall / 2 + 0.009), 1.72, u];
    g.translate(at[0], at[1], at[2]);
    b.add(g, M.signOf(label));
    b.endMark();
    tally.roomSign = (tally.roomSign ?? 0) + 1;
  }
}

// 복도 벽 — 소화기함·게시판·표지. 길이에서 개수를 뽑는다.
function corridorWalls(b, c, M, tally) {
  for (const w of interiorWalls(c.id)) {
    const len = w.b - w.a;
    if (len < 1.2) continue;
    // 12m 마다 소화기, 7m 마다 게시판
    for (const t of fit(0, len, 12, 1.0).map((v) => v / len)) {
      const [x, z] = onWall(w, t, 0.11);
      b.mark('fixture', `extinguisher:${c.id}`);
      b.box(0.24, 0.62, 0.16, [x, 1.15, z], M.vend, 0);
      b.box(0.2, 0.5, 0.02, [x, 1.15, z], M.glass, 0);
      b.endMark();
      tally.extinguisher = (tally.extinguisher ?? 0) + 1;
    }
    // 쓰레기통 — 게시판 자리 사이. 복도는 사람이 지나며 버리는 곳이다
    if (len > 6) {
      const [bx, bz] = onWall(w, 0.5, 0.35);
      b.mark('furniture', `bin:${c.id}`);
      bin(b, bx, bz, M);
      tally.bin = (tally.bin ?? 0) + 1;
      b.endMark();
    }
    for (const t of fit(0, len, 7, 2.2).map((v) => v / len)) {
      const [x, z] = onWall(w, t, 0.055);
      b.mark('sign', `board:${c.id}`);
      b.box(w.axis === 'x' ? 1.1 : 0.05, 0.8, w.axis === 'x' ? 0.05 : 1.1, [x, 1.6, z], M.trim, 0);
      b.box(w.axis === 'x' ? 0.98 : 0.03, 0.68, w.axis === 'x' ? 0.03 : 0.98, [x, 1.6, z], M.paper, 0);
      b.endMark();
      tally.board = (tally.board ?? 0) + 1;
    }
  }
}

// ── 칸 종류별 ──────────────────────────────────────────────────────────────

// 긴 식탁 하나 + 둘러앉은 의자 — 식당과 카페가 나눠 쓴다
function longTable(b, x, z, M, I, tally) {
  const tb = I.spawn('table');
  tb.box(2.0, 0.06, 0.8, [x, 0.74, z], M.laminate, 0);
  for (const dx of [-0.85, 0.85]) {
    for (const dz of [-0.32, 0.32]) tb.box(0.05, 0.72, 0.05, [x + dx, 0.37, z + dz], M.trim, 0);
  }
  for (const dz of [-0.66, 0.66]) {
    for (const dx of [-0.5, 0.5]) {
      chair(I.spawn('chair'), [x + dx, 0, z + dz], dz < 0 ? 0 : Math.PI, M, M.plastic);
    }
  }
  // 식탁 위에 남은 것 — 자리마다 다르다 (좌표 해시). 트레이·접시·컵이
  // 있어야 "식사 중에 비운 자리" 로 읽힌다 (챕터 0 디테일 패스).
  const top = 0.77;
  for (const [dx, dz, k] of [[-0.5, -0.22, 0], [0.5, 0.22, 1], [-0.5, 0.22, 2]]) {
    const r = hash2(Math.round(x * 13) + k, Math.round(z * 11) + k * 3);
    if (r < 0.42) continue;
    // 트레이 — 얕은 판. 그 위에 접시·컵·집기를 올린다
    const yaw = (r - 0.5) * 0.3;
    boxAt(b, 0.42, 0.014, 0.3, [x + dx, top + 0.007, z + dz], M.trim, yaw);
    tube(b, 0.1, 0.012, [x + dx - 0.06, top + 0.02, z + dz], M.porcelain, 'y', 10, true);
    if (r > 0.66) mug(b, x + dx + 0.13, top + 0.014, z + dz + 0.02, M, M.porcelain);
    // 숟가락·포크 — 트레이 오른쪽에 나란히 (사용자 지시)
    cutlery(b, x + dx + 0.15, top + 0.014, z + dz - 0.06, yaw, M);
    tally.cutlery = (tally.cutlery ?? 0) + 1;
    tally.tray = (tally.tray ?? 0) + 1;
  }
  tally.table = (tally.table ?? 0) + 1;
}

// 식당 — 긴 식탁 줄 (음식 권역의 가운데). 배식 카운터는 주방(kitchen)이
// 식당 경계에 세운다 — 한때 식당 서쪽 벽에 있었는데 주방이 생기며 옮겼다.
function dining(b, c, M, tally, I) {
  b.mark('furniture', `tables:${c.id}`);
  for (const x of fit(c.x0, c.x1, 3.1, 1.6)) {
    for (const z of fit(c.z0, c.z1, 2.6, 1.6)) longTable(b, x, z, M, I, tally);
  }
  b.endMark();
}

// 주방 — 배식 카운터(식당 경계) · 조리 라인(레인지·후드) · 싱크 · 냉장고 ·
// 냄비 선반. 버너·냄비·싱크볼은 **원기둥**이다 (lessons.md 3.13.2).
function kitchen(b, c, M, tally, I) {
  const cx = (c.x0 + c.x1) / 2;

  // ── 배식 카운터 — 남쪽 경계(식당과 트인 곳)에 선다. 트레이 레일은 관 ──
  b.mark('furniture', `serving:${c.id}`);
  const zS = c.z0 + 0.55;
  const len = c.x1 - c.x0 - 1.6;
  b.box(len, 0.92, 0.75, [cx, 0.46, zS], M.steel, 0);
  b.box(len + 0.1, 0.05, 0.85, [cx, 0.945, zS], M.laminate, 0);
  for (const v of [-0.52, -0.44, -0.36]) {
    tube(b, 0.016, len, [cx, 0.9, zS + v], M.trim, 'x', 6);
  }
  // 위생 가림판 — 카운터 위 유리와 지지 기둥
  b.box(len - 0.4, 0.38, 0.015, [cx, 1.32, zS - 0.1], M.glass, 0);
  for (const t of fit(0, len - 0.4, 1.6, 0.2)) {
    b.box(0.03, 0.34, 0.03, [cx - (len - 0.4) / 2 + t, 1.1, zS - 0.1], M.trim, 0);
  }
  // 배식 웰 — 상판에 박힌 스테인리스 사각 구덩이 넷 (테두리 판 + 어두운 속).
  // 이게 있어야 '배식대' 지 그냥 긴 탁자가 아니다
  for (const t of fit(0, len - 1.2, 1.35, 0.5)) {
    const wx = cx - (len - 1.2) / 2 + t;
    b.box(0.9, 0.02, 0.5, [wx, 0.972, zS], M.steelDark, 0);
    b.box(0.8, 0.016, 0.4, [wx, 0.976, zS], M.rubber, 0);
  }
  // 카운터 끝 — 접시 더미 둘과 컵 줄. 배식대는 **가져갈 것이 놓여 있어야**
  // 배식대다 (챕터 0 디테일 패스).
  for (const k of [0, 1]) {
    plateStack(b, cx - len / 2 + 0.34 + k * 0.3, 0.97, zS + 0.12, M, 5 + k * 3);
    tally.plateStack = (tally.plateStack ?? 0) + 1;
  }
  for (let k = 0; k < 4; k++) {
    mug(b, cx - len / 2 + 0.3 + (k % 2) * 0.16, 0.97, zS - 0.16 - Math.floor(k / 2) * 0.14, M, M.porcelain);
  }
  b.endMark();
  tally.serving = 1;

  // ── 조리 라인 — 북쪽 외벽. 레인지 버너는 원판, 후드는 위로 관이 나간다 ──
  const wn = interiorWalls(c.id).find((q) => q.rule === 'solid' && q.b - q.a > 5);
  if (wn) {
    b.mark('furniture', `range:${c.id}`);
    const cm = (wn.a + wn.b) / 2;
    const L = Math.min(wn.b - wn.a - 0.8, 6.5);

    // ── 기기를 뗀다 (2026-08-06 사용자 지시) ────────────────────────────
    // 왼쪽부터: **가스레인지 · 오븐 · (작업대) · 싱크대**. 각 유닛은 제 몸통과
    // 옆판·굽을 갖고, 사이에 틈이 있다. 통짜 라인 하나에 얹어 두면 상판이
    // 이어져 "기기 여럿" 이 아니라 "긴 조리대 하나" 로 읽힌다.
    const rangeU = cm - 1.9;
    const ovenU = cm - 0.55;
    const prepU = cm + 0.35;

    // 가스레인지 — 몸통 + 쿡탑 + 버너 넷 + 노브 줄 + 뒤판(백가드)
    wallBox(b, wn, rangeU, 0.35, 0.44, 1.5, 0.88, 0.66, M.steel);
    wallBox(b, wn, rangeU, 0.35, 0.915, 1.54, 0.05, 0.7, M.steelDark);
    for (const s of [-1, 1]) wallBox(b, wn, rangeU + s * 0.74, 0.35, 0.44, 0.03, 0.88, 0.68, M.steel);
    wallBox(b, wn, rangeU, 0.35, 0.05, 1.4, 0.1, 0.6, M.rubber); // 굽 그림자
    wallBox(b, wn, rangeU, 0.35, 0.95, 1.44, 0.02, 0.62, M.rubber); // 쿡탑
    for (const [du, dv] of [[-0.35, 0.2], [-0.35, 0.5], [0.35, 0.2], [0.35, 0.5]]) {
      const [px, , pz] = wallAt(wn, rangeU + du, dv, 0);
      tube(b, 0.14, 0.018, [px, 0.968, pz], M.steelDark, 'y', 10, true);
      tube(b, 0.05, 0.026, [px, 0.978, pz], M.trim, 'y', 8, true); // 버너 헤드
    }
    wallBox(b, wn, rangeU, 0.16, 1.06, 1.5, 0.24, 0.06, M.steel); // 백가드
    for (const du of [-0.5, -0.25, 0.25, 0.5]) {
      const g = new THREE.CylinderGeometry(0.025, 0.025, 0.02, 8);
      g.rotateX(Math.PI / 2);
      const [kx, , kz] = wallAt(wn, rangeU + du, 0.68, 0);
      g.translate(kx, 1.06, kz);
      b.add(g, M.trim);
    }
    tally.range = 1;

    // 오븐 — **독립 스탠딩**. 문 유리창으로 속이 보이고 그 안에 선반 둘이
    // 있어야 오븐이다 (통짜 강판 상자는 그냥 캐비넷).
    {
      wallBox(b, wn, ovenU, 0.33, 0.45, 0.8, 0.9, 0.62, M.steelDark); // 몸통
      wallBox(b, wn, ovenU, 0.33, 0.915, 0.84, 0.05, 0.66, M.steel); // 천판
      wallBox(b, wn, ovenU, 0.3, 0.05, 0.74, 0.1, 0.56, M.rubber); // 굽
      wallBox(b, wn, ovenU, 0.29, 0.48, 0.7, 0.5, 0.02, M.rubber); // 속 어둠
      for (const y of [0.36, 0.6]) wallBox(b, wn, ovenU, 0.3, y, 0.64, 0.014, 0.04, M.steel); // 속 선반
      wallBox(b, wn, ovenU, 0.65, 0.48, 0.72, 0.52, 0.02, M.glass); // 문 유리
      wallBox(b, wn, ovenU, 0.655, 0.48, 0.76, 0.56, 0.02, M.trim); // 문틀 — 유리보다 크게
      const [ox, , oz] = wallAt(wn, ovenU, 0.7, 0);
      tube(b, 0.016, 0.7, [ox, 0.79, oz], M.trim, wn.axis, 6); // 가로 손잡이
      for (const s of [-1, 1]) {
        wallBox(b, wn, ovenU + s * 0.3, 0.68, 0.755, 0.03, 0.07, 0.03, M.trim); // 손잡이 다리
      }
      for (const du of [-0.24, 0.24]) {
        const g = new THREE.CylinderGeometry(0.026, 0.026, 0.02, 8);
        g.rotateX(Math.PI / 2);
        const [kx, , kz] = wallAt(wn, ovenU + du, 0.66, 0);
        g.translate(kx, 0.86, kz);
        b.add(g, M.trim);
      }
      tally.oven = 1;
    }

    // 작업대 — 오븐과 싱크 사이. 도마와 식칼꽂이가 놓인다
    wallBox(b, wn, prepU, 0.35, 0.44, 0.85, 0.88, 0.66, M.steel);
    wallBox(b, wn, prepU, 0.35, 0.915, 0.89, 0.05, 0.7, M.steelDark);
    wallBox(b, wn, prepU, 0.35, 0.05, 0.75, 0.1, 0.6, M.rubber);
    wallBox(b, wn, prepU - 0.1, 0.3, 0.955, 0.4, 0.03, 0.3, M.laminate); // 도마
    {
      // 식칼꽂이 — 기울인 블록에 칼자루 셋
      const blk = new THREE.BoxGeometry(0.14, 0.24, 0.1);
      blk.rotateX(-0.25);
      const [bx2, , bz2] = wallAt(wn, prepU + 0.3, 0.28, 0);
      blk.translate(bx2, 1.06, bz2);
      b.add(blk, M.laminate);
      for (const du of [-0.04, 0, 0.04]) {
        const h2 = new THREE.CylinderGeometry(0.007, 0.007, 0.09, 5);
        h2.rotateX(-0.25);
        const [hx2, , hz2] = wallAt(wn, prepU + 0.3 + du, 0.26, 0);
        h2.translate(hx2, 1.21, hz2);
        b.add(h2, M.rubber);
      }
    }
    // 후드 — 아래가 넓고 위로 좁아지는 **사각뿔대**다. 상자 후드는 없다 —
    // 4각 원기둥(=각뿔대)을 45도 돌려 만든다 (lessons.md 3.13.2).
    const [hx, , hz] = wallAt(wn, rangeU, 0.38, 0);
    {
      const g = new THREE.CylinderGeometry(0.62, 1.3, 0.5, 4, 1);
      g.rotateY(Math.PI / 4);
      g.scale(1, 1, 0.47); // 바닥 1.84x0.86 -> 천장 0.88x0.41
      g.translate(hx, 2.15, hz);
      b.add(g, M.steel);
      // 하단 립과 조명 띠
      wallBox(b, wn, rangeU, 0.38, 1.88, 1.9, 0.05, 0.92, M.steelDark);
      wallBox(b, wn, rangeU, 0.38, 1.905, 1.2, 0.015, 0.3, M.lamp);
    }
    tube(b, 0.16, c.h - 2.4, [hx, 2.4 + (c.h - 2.4) / 2, hz], M.steel, 'y', 10);
    // ── 싱크대 — **독립 유닛**으로 뗀다 (2026-08-06 사용자 지시) ─────────
    //
    // 예전에는 레인지·오븐·싱크가 한 상판을 나눠 쓰는 통짜 라인이었다.
    // 실제 주방은 기기마다 몸이 따로고 사이에 이음선(틈)이 있다 — 뗀 자리에
    // **몸통 옆판과 발**이 보여야 "기기 여럿" 으로 읽힌다.
    const sinkU = cm + 1.2;
    {
      const SW = 1.5;
      wallBox(b, wn, sinkU, 0.35, 0.44, SW, 0.88, 0.66, M.steelDark); // 하부장
      wallBox(b, wn, sinkU, 0.35, 0.915, SW + 0.04, 0.05, 0.7, M.steel); // 상판
      for (const s of [-1, 1]) {
        wallBox(b, wn, sinkU + s * (SW / 2 - 0.02), 0.35, 0.44, 0.03, 0.88, 0.68, M.steel); // 옆판
      }
      wallBox(b, wn, sinkU, 0.35, 0.05, SW - 0.1, 0.1, 0.6, M.rubber); // 굽 그림자
      // 볼 둘 — 상판에 박힌 원형 구덩이 (테 + 어두운 속)
      for (const du of [-0.3, 0.3]) {
        const [px, , pz] = wallAt(wn, sinkU + du, 0.35, 0);
        tube(b, 0.19, 0.03, [px, 0.94, pz], M.steelDark, 'y', 10, true);
        tube(b, 0.16, 0.02, [px, 0.945, pz], M.rubber, 'y', 10, true);
      }
      // 수전 — 기둥 위에 **반원 구즈넥(토러스 반쪽)**. 직관 두 개를 꺾어
      // 붙이면 수전이 아니라 파이프다 (lessons.md 3.13.2).
      const [fx, , fz] = wallAt(wn, sinkU, 0.14, 0);
      tube(b, 0.018, 0.34, [fx, 1.07, fz], M.trim, 'y', 6); // 기둥
      const arc = new THREE.TorusGeometry(0.12, 0.015, 6, 10, Math.PI);
      if (wn.axis === 'x') arc.rotateY(Math.PI / 2);
      arc.translate(fx, 1.24, fz + (wn.axis === 'x' ? wn.inward * 0.12 : 0));
      b.add(arc, M.trim);
      const [sx, , sz] = wallAt(wn, sinkU, 0.38, 0);
      tube(b, 0.013, 0.06, [sx, 1.21, sz], M.trim, 'y', 6); // 토출구
      // 세제통과 수세미 — 싱크 옆에 있어야 쓰던 싱크다
      const [dx2, , dz2] = wallAt(wn, sinkU + 0.6, 0.3, 0);
      tube(b, 0.035, 0.16, [dx2, 1.02, dz2], M.vendBlue, 'y', 8);
      tube(b, 0.012, 0.05, [dx2, 1.12, dz2], M.trim, 'y', 6);
      wallBox(b, wn, sinkU + 0.5, 0.3, 0.955, 0.11, 0.04, 0.08, M.warn);
      tally.sinkUnit = (tally.sinkUnit ?? 0) + 1;
    }

    // ── 상부 찬장 — 접시·컵이 든 유리문 캐비넷 (사용자 지시) ─────────────
    // 싱크 위에 매단다. 문이 유리라 **안의 그릇이 보인다** — 통짜 상자로
    // 두면 벽에 붙은 나무 덩어리다.
    {
      const CW = 1.6;
      const cy2 = 1.86;
      wallBox(b, wn, sinkU, 0.16, cy2, CW, 0.72, 0.34, M.laminate); // 몸통
      for (const s of [-1, 1]) wallBox(b, wn, sinkU + s * (CW / 2), 0.16, cy2, 0.03, 0.72, 0.34, M.trim);
      wallBox(b, wn, sinkU, 0.16, cy2 + 0.375, CW, 0.03, 0.36, M.trim); // 천판
      wallBox(b, wn, sinkU, 0.16, cy2 - 0.375, CW, 0.03, 0.36, M.trim); // 바닥판
      wallBox(b, wn, sinkU, 0.16, cy2, CW - 0.08, 0.02, 0.3, M.trim); // 가운데 선반
      // 속 — 접시 더미와 컵 줄 (선반 위·아래)
      for (const [du, up] of [[-0.45, 1], [0.1, 1], [-0.3, 0], [0.3, 0]]) {
        const [px, , pz] = wallAt(wn, sinkU + du, 0.16, 0);
        const y0 = up ? cy2 + 0.02 : cy2 - 0.355;
        if (up) plateStack(b, px, y0, pz, M, 5);
        else mug(b, px, y0, pz, M, M.porcelain);
      }
      // 유리문 두 짝 + 손잡이 — 유리는 마지막에 (투명 정렬)
      for (const s of [-1, 1]) {
        wallBox(b, wn, sinkU + s * CW / 4, 0.335, cy2, CW / 2 - 0.02, 0.68, 0.014, M.glass);
        wallBox(b, wn, sinkU + s * 0.06, 0.35, cy2, 0.02, 0.12, 0.02, M.trim);
      }
      tally.cupboard = (tally.cupboard ?? 0) + 1;
    }
    // 냄비 선반 — 벽에 띠 선반 + 원기둥 냄비들. 절반은 뚜껑(원판+꼭지),
    // 절반은 옆손잡이 관 — 같은 원통 줄이면 통조림이다.
    // **오븐~작업대 위에만** 건다: 왼쪽은 후드, 오른쪽은 상부 찬장 자리다.
    const shelfC = (ovenU + prepU) / 2;
    const shelfW = prepU + 0.42 - (ovenU - 0.4);
    wallBox(b, wn, shelfC, 0.3, 1.62, shelfW, 0.04, 0.4, M.steel);
    for (const t of fit(0, shelfW - 0.2, 0.55, 0.15)) {
      const r = 0.1 + hash2(Math.round(t * 7), 3) * 0.07;
      const hgt = 0.16 + r * 0.5;
      const [px, , pz] = wallAt(wn, shelfC - (shelfW - 0.2) / 2 + t, 0.3, 0);
      tube(b, r, hgt, [px, 1.64 + hgt / 2, pz], M.steel, 'y', 8);
      if (hash2(Math.round(t * 13), 7) > 0.5) {
        tube(b, r * 0.94, 0.015, [px, 1.64 + hgt + 0.008, pz], M.steelDark, 'y', 8, true); // 뚜껑
        tube(b, 0.02, 0.03, [px, 1.64 + hgt + 0.03, pz], M.trim, 'y', 6); // 꼭지
      } else {
        for (const s of [-1, 1]) {
          const g = new THREE.CylinderGeometry(0.012, 0.012, 0.09, 6);
          g.rotateZ(Math.PI / 2);
          g.translate(px + s * (r + 0.04), 1.64 + hgt - 0.05, pz);
          b.add(g, M.trim); // 옆손잡이
        }
      }
      tally.pot = (tally.pot ?? 0) + 1;
    }
    b.endMark();
    tally.sink = 1;

    // ── 커피머신과 음료수 디스펜서 (2026-08-06 사용자 지시) ──────────────
    //
    // 배식 라인 끝의 **음료 코너**다. 둘 다 카운터 위에 얹힌다 — 바닥에
    // 세우면 자판기가 되고, 여기는 셀프 서비스 대(臺)다.
    b.mark('furniture', `beverage:${c.id}`);
    const bevU = cm - 2.9 < wn.a + 0.5 ? wn.a + 0.9 : cm - 2.9;
    // 받침 카운터 — 기기 둘이 앉을 낮은 대
    wallBox(b, wn, bevU, 0.32, 0.44, 1.5, 0.88, 0.6, M.laminate);
    wallBox(b, wn, bevU, 0.32, 0.905, 1.54, 0.05, 0.64, M.steelDark);

    // 커피머신 — 몸통 + 원두통(투명 원통) + 추출구 둘 + 컵 받침판 + 물받이 격자
    {
      const u0 = bevU - 0.36;
      wallBox(b, wn, u0, 0.3, 1.19, 0.5, 0.52, 0.44, M.steelDark); // 몸통
      wallBox(b, wn, u0, 0.3, 1.47, 0.46, 0.04, 0.4, M.steel); // 천판
      const [hx2, , hz2] = wallAt(wn, u0, 0.3, 0);
      tube(b, 0.1, 0.22, [hx2, 1.6, hz2], M.glass, 'y', 10); // 원두통
      tube(b, 0.105, 0.03, [hx2, 1.72, hz2], M.trim, 'y', 10, true); // 뚜껑
      for (const du of [-0.09, 0.09]) {
        const [sx2, , sz2] = wallAt(wn, u0 + du, 0.5, 0);
        tube(b, 0.014, 0.09, [sx2, 1.0, sz2], M.trim, 'y', 6); // 추출구
      }
      wallBox(b, wn, u0, 0.5, 0.945, 0.34, 0.02, 0.24, M.rubber); // 물받이 속
      wallBox(b, wn, u0, 0.5, 0.935, 0.38, 0.02, 0.28, M.steel); // 물받이 판
      wallBox(b, wn, u0, 0.31, 1.05, 0.18, 0.1, 0.02, M.screen); // 표시창
      for (const du of [-0.12, 0.12]) wallBox(b, wn, u0 + du, 0.31, 1.05, 0.05, 0.05, 0.02, M.trim); // 버튼
      // 컵 줄 — 옆에 엎어 둔 종이컵
      for (let k = 0; k < 3; k++) {
        const [cx2, , cz2] = wallAt(wn, u0 + 0.32, 0.28 + k * 0.005, 0);
        tube(b, 0.032, 0.075, [cx2, 0.968 + k * 0.06, cz2], M.paper, 'y', 8);
      }
      tally.coffee = 1;
    }
    // 음료수 디스펜서 — 통(내용물이 보이는 원통) 둘 + 꼭지 + 받침. 주스가
    // 보여야 음료수 기계다 — 통짜 상자면 그냥 통이다.
    {
      const u0 = bevU + 0.38;
      wallBox(b, wn, u0, 0.3, 1.0, 0.56, 0.14, 0.42, M.steel); // 받침대
      for (const [du, mm] of [[-0.13, M.warn], [0.13, M.vend]]) {
        const [px2, , pz2] = wallAt(wn, u0 + du, 0.3, 0);
        tube(b, 0.1, 0.34, [px2, 1.24, pz2], M.glass, 'y', 10); // 투명 통
        tube(b, 0.088, 0.24, [px2, 1.19, pz2], mm, 'y', 10); // 속 음료
        tube(b, 0.105, 0.03, [px2, 1.42, pz2], M.trim, 'y', 10, true); // 뚜껑
        const [fx2, , fz2] = wallAt(wn, u0 + du, 0.52, 0);
        tube(b, 0.014, 0.07, [fx2, 1.05, fz2], M.trim, 'y', 6); // 꼭지
        wallBox(b, wn, u0 + du, 0.5, 1.11, 0.05, 0.05, 0.06, M.trim); // 레버
      }
      tally.juice = 1;
    }
    b.endMark();
  }

  // ── 냉장고 둘 — 조리 라인과 **다른 벽**. 약탈 대상이다.
  // "다른 조각(q !== wn)" 만 걸렀더니 같은 북쪽 벽의 다른 조각이 잡혀
  // 냉장고가 조리대 속에 박혔다 (#7) — 같은 벽면(at)인지로 거른다.
  const we = interiorWalls(c.id).find(
    (q) => q.rule === 'solid' && (q.axis !== wn.axis || Math.abs(q.at - wn.at) > 0.05) && q.b - q.a > 2.4
  );
  if (we) {
    b.mark('furniture', `fridge:${c.id}`);
    for (const t of [-0.8, 0.2]) {
      const u = (we.a + we.b) / 2 + t;
      const pr = I.spawnPair('fridge');
      for (const pose of ['closed', 'open']) {
        const g = pr[pose];
        // 몸통은 통짜 상자가 아니라 **판 다섯 장** — 등·옆 둘·천판·바닥 굽.
        // 통짜로 두면 문을 여는 순간 속이 없는 게 들킨다 (#1 사물함과 같은
        // 병, 2026-08-06 재지적).
        wallBox(g, we, u, 0.03, 1.0, 0.82, 2.0, 0.06, M.steel); // 등판
        for (const s of [-1, 1]) wallBox(g, we, u + s * 0.39, 0.4, 1.0, 0.04, 2.0, 0.78, M.steel);
        wallBox(g, we, u, 0.4, 1.97, 0.82, 0.06, 0.78, M.steel); // 천판
        wallBox(g, we, u, 0.4, 0.08, 0.82, 0.16, 0.78, M.steelDark); // 굽 — 컴프레서 칸
        // 속 — 선반 셋과 남은 것들. 선반이 비면 열어 볼 이유가 없다.
        for (const y of [0.55, 1.0, 1.45]) wallBox(g, we, u, 0.37, y, 0.7, 0.024, 0.6, M.paper);
        // 병은 몸통 원기둥 + 어깨 원뿔대 + 뚜껑 — 단면이 원이면 원기둥으로
        // (lessons.md 3.13.2). 캔·반찬통·컵도 제 단면대로.
        const item = (geo, mat) => wallPut(g, we, u, geo, mat);
        let q = new THREE.CylinderGeometry(0.036, 0.036, 0.2, 10);
        q.translate(-0.14, 0.662, 0.3);
        item(q, M.porcelain); // 병 몸통 (아래 선반)
        q = new THREE.CylinderGeometry(0.014, 0.034, 0.05, 10);
        q.translate(-0.14, 0.787, 0.3);
        item(q, M.porcelain); // 병 어깨
        q = new THREE.CylinderGeometry(0.015, 0.015, 0.02, 8);
        q.translate(-0.14, 0.822, 0.3);
        item(q, M.trim); // 뚜껑
        q = new THREE.CylinderGeometry(0.03, 0.03, 0.09, 10);
        q.translate(0.1, 1.057, 0.25);
        item(q, M.steelDark); // 캔 (가운데 선반)
        wallBox(g, we, u - 0.15, 0.32, 1.052, 0.16, 0.08, 0.16, M.paper); // 반찬통
        for (const dx of [0.05, 0.13]) {
          q = new THREE.CylinderGeometry(0.02, 0.026, 0.06, 9);
          q.translate(dx, 1.492, 0.35);
          item(q, M.porcelain); // 컵 둘 (위 선반) — 아래가 좁은 원뿔대
        }
      }
      // 닫힘 — 문이 몸통 앞면보다 돌출 + 세로 손잡이
      wallBox(pr.closed, we, u, 0.805, 1.0, 0.78, 1.92, 0.03, M.bezel);
      wallBox(pr.closed, we, u + 0.3, 0.84, 1.15, 0.05, 0.5, 0.04, M.trim);
      // 열림 — 경첩을 원점으로 **먼저** 옮기고 돌린다. 옮겨 둔 채 돌리면
      // 문이 경첩을 궤도로 돌아 몸통에서 떨어져 나간다 (#1 에서 잡은 규칙).
      const swing = (geo) => {
        geo.rotateY(-2.0);
        geo.translate(0, 0, 0.805);
        return geo;
      };
      let d = new THREE.BoxGeometry(0.78, 1.92, 0.03);
      d.translate(0.39, 1.0, 0);
      wallPut(pr.open, we, u - 0.39, swing(d), M.bezel); // 문판 — 경첩은 서쪽 모서리
      d = new THREE.BoxGeometry(0.05, 0.5, 0.04);
      d.translate(0.69, 1.15, 0.035);
      wallPut(pr.open, we, u - 0.39, swing(d), M.trim); // 손잡이 — 문을 따라간다
      for (const y of [0.62, 1.28]) {
        d = new THREE.BoxGeometry(0.6, 0.13, 0.05);
        d.translate(0.39, y, -0.04);
        wallPut(pr.open, we, u - 0.39, swing(d), M.paper); // 문 안쪽 바구니 둘
      }
      tally.fridge = (tally.fridge ?? 0) + 1;
    }
    b.endMark();
  }
}

// 카페테리아 — 자판기 줄과 원탁 (음식 권역의 작은 쪽, 식당과 트여 있다)
function cafe(b, c, M, tally, I) {
  // 자판기 — 제일 긴 막힌 벽에 줄지어. 게임에서도 이 방의 표식이다.
  const walls = interiorWalls(c.id)
    .filter((q) => q.rule === 'solid')
    .sort((p, q) => q.b - q.a - (p.b - p.a));
  const w = walls[0];
  if (w) {
    b.mark('furniture', `vending:${c.id}`);
    const len = w.b - w.a;
    // **빨강 = 음료, 파랑 = 스낵** (2026-08-06 사용자 지시). 색이 곧 종류라
    // 멀리서도 무엇을 파는 기계인지 읽힌다.
    const SPEC = [
      [1.0, 1.92, M.vend, 'drink'],
      [0.96, 1.84, M.vendBlue, 'snack'],
      [1.0, 1.97, M.vend, 'drink'],
      [0.96, 1.87, M.vendBlue, 'snack'],
    ];
    const seats = fit(0, len, 1.55, 1.4).slice(0, 4);
    seats.forEach((v, i) => {
      const s = SPEC[i % 4];
      vendor(I.spawn('vend'), w, w.a + v, s, i, M, s[3]);
    });
    // 벽이 좁으면 4개 미만이 나온다 — 고정 +4 로 적으면 tally 가 거짓말을 한다
    tally.vending = (tally.vending ?? 0) + seats.length;
    b.endMark();
  }

  // 원탁 — 상판도 기둥도 받침도 **원기둥**이다 (lessons.md 3.13.2).
  // 서서 마시는 카페 테이블은 사각이 아니다.
  b.mark('furniture', `cafetable:${c.id}`);
  for (const x of fit(c.x0 + 1.2, c.x1, 2.6, 1.2)) {
    for (const z of fit(c.z0, c.z1, 2.8, 1.5)) {
      const tb = I.spawn('table');
      tube(b, 0.5, 0.045, [x, 0.735, z], M.laminate, 'y', 12, true);
      tube(b, 0.05, 0.68, [x, 0.38, z], M.trim, 'y', 8);
      tube(b, 0.26, 0.035, [x, 0.02, z], M.steelDark, 'y', 10, true);
      // 마시다 둔 것 — 캔과 컵. 자판기 옆 원탁이 비어 있으면 아무도 안 쓴
      // 카페다 (챕터 0 디테일 패스)
      {
        const rr = hash2(Math.round(x * 11), Math.round(z * 17));
        const top = 0.7575;
        if (rr > 0.3) can(b, x + 0.16, top, z - 0.1, 0.033, 0.115, M, rr > 0.6 ? M.vend : M.vendBlue);
        if (rr > 0.5) mug(b, x - 0.14, top, z + 0.12, M, M.porcelain);
        if (rr > 0.75) can(b, x - 0.02, top, z - 0.22, 0.033, 0.115, M, M.vendBlue);
      }
      // 의자 셋 — 원탁을 보고 둘러앉는다
      for (const k of [0, 1, 2]) {
        const a = (k / 3) * Math.PI * 2 + 0.5;
        chair(I.spawn('chair'), [x + Math.sin(a) * 0.82, 0, z + Math.cos(a) * 0.82], a + Math.PI, M, M.plastic);
      }
      tally.table = (tally.table ?? 0) + 1;
    }
  }
  b.endMark();
}

// 사물함 하나 — 휴게실·샤워실의 약탈 소품. 문에 통풍 슬릿과 손잡이.
//
// 몸통은 통짜 상자가 아니라 **판 다섯**(등·옆 둘·천·바닥)이다 — 열면 속이
// 보여야 한다. 통짜로 두고 선반을 그 속에 넣었더니 "안에 빈 공간이 없다"
// 는 지적을 받았다 (자판기 #64 와 같은 병).
function locker(pr, w, u, M) {
  const H0 = 1.85;
  const WID = 0.45;
  const DEP = 0.5;
  for (const pose of ['closed', 'open']) {
    const bb = pr[pose];
    wallBox(bb, w, u, 0.035, H0 / 2 + 0.06, WID, H0, 0.03, M.steelDark); // 등판
    for (const s of [-1, 1]) {
      wallBox(bb, w, u + s * (WID / 2 - 0.015), 0.27, H0 / 2 + 0.06, 0.03, H0, DEP - 0.04, M.steelDark);
    }
    wallBox(bb, w, u, 0.27, H0 + 0.045, WID, 0.03, DEP - 0.04, M.steelDark); // 천판
    wallBox(bb, w, u, 0.27, 0.075, WID, 0.03, DEP - 0.04, M.steelDark); // 바닥판
    // 속 — 선반과 옷걸이 봉은 두 포즈 공통 (닫혀 있어도 실제로 있다)
    wallBox(bb, w, u, 0.27, 1.35, WID - 0.07, 0.02, DEP - 0.1, M.steel);
    wallBox(bb, w, u, 0.27, 0.45, WID - 0.07, 0.02, DEP - 0.1, M.steel);
    const [rx, , rz] = wallAt(w, u, 0.27, 0);
    tube(bb, 0.011, WID - 0.1, [rx, 1.6, rz], M.trim, w.axis, 6);
  }
  // 닫힘 — 문이 몸통 앞면(0.5)보다 살짝 돌출 (겹평면 금지)
  wallBox(pr.closed, w, u, 0.515, H0 / 2 + 0.06, 0.4, H0 - 0.1, 0.024, M.steel);
  for (const y of [1.55, 0.5]) {
    for (const dy of [0, 0.05, 0.1]) wallBox(pr.closed, w, u, 0.53, y + dy, 0.22, 0.014, 0.006, M.rubber);
  }
  wallBox(pr.closed, w, u + 0.13, 0.535, 1.05, 0.03, 0.1, 0.02, M.trim); // 손잡이
  // 열림 — 문이 **경첩(왼쪽 변)을 원점에 두고 돌아간** 뒤 제자리로 간다.
  // 순서를 반대로(이동 후 회전) 했더니 문이 몸통에서 떨어져 허공을 돌았다.
  {
    const g = new THREE.BoxGeometry(0.4, H0 - 0.1, 0.024);
    g.translate(0.2, H0 / 2 + 0.06, 0); // 경첩변을 로컬 원점에
    g.rotateY(-1.9); // 활짝 젖힘
    g.translate(0, 0, 0.5); // 몸통 앞면 평면으로
    wallPut(pr.open, w, u - 0.2, g, M.steel);
  }
}

// 직원휴게실 — 소파·원형 탁자·자판기·사물함. 사람이 쉬는 흔적.
function lounge(b, c, M, tally, I) {
  const cx = (c.x0 + c.x1) / 2;
  const cz = (c.z0 + c.z1) / 2;

  // 소파 둘 — 등받이는 기울고 팔걸이는 **원기둥**이다 (각목 팔걸이는 벤치다)
  b.mark('furniture', `sofa:${c.id}`);
  const sofa = (x, z, yaw) => {
    const s = I.spawn('sofa');
    const put = (g, m) => {
      g.rotateY(yaw);
      g.translate(x, 0, z);
      s.add(g, m);
    };
    const box = (w2, h, d, lx, ly, lz, m, tilt = 0) => {
      const g = new THREE.BoxGeometry(w2, h, d);
      if (tilt) g.rotateX(tilt);
      g.translate(lx, ly, lz);
      put(g, m);
    };
    // **조각끼리 맞닿아야 한다** — 쿠션이 틀 위에, 등쿠션이 방석 위에,
    // 팔걸이가 받침 위에. 좌표를 따로 잡았다가 전부 공중부양했다 (#2 지적).
    box(1.9, 0.22, 0.66, 0, 0.11, 0, M.trim); // 틀 0 ~ 0.22
    box(1.9, 0.55, 0.12, 0, 0.395, -0.34, M.trim, -0.12); // 등판 — 틀에서 오른다
    for (const dx of [-0.47, 0.47]) {
      box(0.88, 0.16, 0.56, dx, 0.3, 0.03, M.plasticWarm); // 방석 — 틀 위(0.22)
      box(0.88, 0.36, 0.12, dx, 0.56, -0.3, M.plasticWarm, -0.12); // 등쿠션 — 방석 위, 등판에 기댐
    }
    for (const dx of [-0.89, 0.89]) {
      box(0.14, 0.25, 0.6, dx, 0.345, 0, M.trim); // 팔걸이 받침 — 틀에서 오른다
      const g = new THREE.CylinderGeometry(0.09, 0.09, 0.6, 8);
      g.rotateX(Math.PI / 2);
      g.translate(dx, 0.5, 0);
      put(g, M.plasticWarm); // 팔걸이 — 받침 위의 눕힌 원기둥
    }
    tally.sofa = (tally.sofa ?? 0) + 1;
  };
  sofa(cx - 0.3, cz + 0.75, Math.PI); // 마주 본다
  sofa(cx - 0.3, cz - 0.75, 0);
  // 낮은 원탁 — 소파 사이
  tube(b, 0.42, 0.04, [cx - 0.3, 0.42, cz], M.laminate, 'y', 12, true);
  tube(b, 0.04, 0.4, [cx - 0.3, 0.21, cz], M.trim, 'y', 8);
  tube(b, 0.2, 0.03, [cx - 0.3, 0.015, cz], M.steelDark, 'y', 10, true);
  // 탁자 위 — 머그 둘과 읽던 것. 휴게실은 **누가 앉아 있던 흔적**이 전부다
  mug(b, cx - 0.14, 0.44, cz + 0.1, M, M.porcelain);
  mug(b, cx - 0.5, 0.44, cz - 0.12, M, M.plasticWarm);
  paperPile(b, cx - 0.32, 0.44, cz + 0.18, M, 41);
  newspaper(b, cx - 0.06, 0.441, cz - 0.22, 0.7, M);
  // 문가 쓰레기통
  bin(b, c.x0 + 0.5, c.z1 - 0.5, M);
  tally.bin = (tally.bin ?? 0) + 1;
  b.endMark();

  // ── 간이 침대 (2026-08-06 사용자 지시) ────────────────────────────────
  //
  // 당직이 눈을 붙이는 자리. **매트리스가 프레임보다 살짝 좁고 위로 도톰**해야
  // 침대다 — 같은 크기 판 둘을 겹치면 탁자다. 베개와 접힌 담요까지.
  //
  // 자리는 **북동 구석**이다. 처음에 서쪽(c.x0 쪽)에 뒀더니 그 벽의 자판기
  // 앞을 막았다 — 놓기 전에 그 자리에 무엇이 있는지 묻지 않은 것이다
  // (같은 판에서 드럼-AHU 로 한 번 겪었다). 서쪽 벽은 자판기, 북쪽 벽
  // 서편은 사물함, 동쪽 벽은 세탁기 — 남는 곳이 북동 구석이다.
  b.mark('furniture', `bed:${c.id}`);
  for (const [bx, bz, yaw] of [[c.x1 - 1.2, c.z1 - 0.62, 0], [c.x1 - 3.2, c.z1 - 0.62, 0]]) {
    const put = (g, m) => {
      g.rotateY(yaw);
      g.translate(bx, 0, bz);
      b.add(g, m);
    };
    const bbox = (w2, h2, d2, lx, ly, lz, m) => {
      const g = new THREE.BoxGeometry(w2, h2, d2);
      g.translate(lx, ly, lz);
      put(g, m);
    };
    bbox(1.9, 0.1, 0.86, 0, 0.3, 0, M.trim); // 프레임 상판
    for (const s of [-1, 1]) {
      for (const t2 of [-1, 1]) bbox(0.07, 0.3, 0.07, s * 0.88, 0.15, t2 * 0.36, M.trim); // 다리
    }
    bbox(1.86, 0.16, 0.82, 0, 0.43, 0, M.paper); // 매트리스
    bbox(0.44, 0.11, 0.3, -0.66, 0.56, 0, M.porcelain); // 베개
    bbox(0.9, 0.09, 0.84, 0.44, 0.55, 0, M.vendBlue); // 개어 둔 담요
    tally.bed = (tally.bed ?? 0) + 1;
  }
  b.endMark();

  // ── 세탁 코너 — 세탁기·빨래바구니·세제 (사용자 지시) ──────────────────
  //
  // 세탁기는 **둥근 문**이 있어야 세탁기다: 상자에 네모 문을 달면 오븐이다.
  b.mark('furniture', `laundry:${c.id}`);
  const wl2 = interiorWalls(c.id).filter((q) => q.rule === 'solid' && q.axis === 'z').sort((p, q) => q.at - p.at)[0];
  if (wl2) {
    const lu = wl2.a + Math.min(1.2, (wl2.b - wl2.a) / 3);
    for (const du of [0, 0.72]) {
      const u = lu + du;
      wallBox(b, wl2, u, 0.33, 0.42, 0.66, 0.84, 0.62, M.steel); // 몸통
      wallBox(b, wl2, u, 0.33, 0.855, 0.7, 0.05, 0.66, M.steelDark); // 천판
      wallBox(b, wl2, u, 0.33, 0.04, 0.6, 0.08, 0.56, M.rubber); // 굽
      // 둥근 문 — 테(토러스) + 유리 + 속 어둠
      const [px, , pz] = wallAt(wl2, u, 0.62, 0);
      const ring = new THREE.TorusGeometry(0.2, 0.028, 6, 14);
      ring.rotateY(Math.PI / 2);
      ring.translate(px, 0.5, pz);
      b.add(ring, M.trim);
      const [gx, , gz] = wallAt(wl2, u, 0.6, 0);
      tube(b, 0.185, 0.02, [gx, 0.5, gz], M.glass, 'x', 12, true);
      const [dx3, , dz3] = wallAt(wl2, u, 0.5, 0);
      tube(b, 0.17, 0.14, [dx3, 0.5, dz3], M.rubber, 'x', 12);
      // 조작반 — 다이얼 하나와 버튼 줄
      wallBox(b, wl2, u, 0.34, 0.78, 0.6, 0.1, 0.02, M.trim);
      const [kx3, , kz3] = wallAt(wl2, u - 0.2, 0.36, 0);
      tube(b, 0.035, 0.02, [kx3, 0.78, kz3], M.steelDark, 'x', 8, true);
      for (const k of [0, 1, 2]) wallBox(b, wl2, u + 0.02 + k * 0.09, 0.35, 0.78, 0.05, 0.03, 0.012, M.warn);
      tally.washer = (tally.washer ?? 0) + 1;
    }
    // 세제통 둘 — 세탁기 위. 손잡이가 달린 통과 원통 병
    const [sx3, , sz3] = wallAt(wl2, lu, 0.3, 0);
    b.box(0.2, 0.26, 0.16, [sx3, 1.01, sz3], M.vendBlue, 0);
    b.box(0.1, 0.05, 0.03, [sx3, 1.16, sz3 + 0.09], M.trim, 0);
    const [s2x, , s2z] = wallAt(wl2, lu + 0.72, 0.3, 0);
    tube(b, 0.06, 0.24, [s2x, 1.0, s2z], M.warn, 'y', 8);
    tube(b, 0.03, 0.05, [s2x, 1.14, s2z], M.trim, 'y', 8);
    tally.detergent = (tally.detergent ?? 0) + 1;

    // 빨래바구니 — 위가 넓은 **원뿔대** 광주리 둘. 안에 개킨 것이 보인다
    for (const [du, mm] of [[1.65, M.crate], [2.15, M.plasticWarm]]) {
      const [bx3, , bz3] = wallAt(wl2, lu + du, 0.42, 0);
      tube(b, 0.26, 0.42, [bx3, 0.21, bz3], mm, 'y', 12);
      tube(b, 0.28, 0.04, [bx3, 0.42, bz3], mm, 'y', 12, true); // 테두리
      tube(b, 0.2, 0.06, [bx3, 0.33, bz3], M.paper, 'y', 10, true); // 담긴 빨래
      tally.basket = (tally.basket ?? 0) + 1;
    }
  }
  b.endMark();

  // 자판기 하나 — **서쪽 벽 고정** (샤워실 경계 z-벽). find 첫 번째로 뽑고
  // 주석에는 "동쪽" 이라 적어 둘 다 틀렸었다 — 벽은 순서가 아니라 방위·
  // 평면으로 고른다 (status.md 4.1 의 16).
  const walls = interiorWalls(c.id).filter((q) => q.rule === 'solid');
  const wv = walls.filter((q) => q.axis === 'z' && q.b - q.a > 1.6).sort((p, q) => p.at - q.at)[0];
  if (wv) {
    b.mark('furniture', `vending:${c.id}`);
    vendor(I.spawn('vend'), wv, (wv.a + wv.b) / 2, [1.0, 1.92, M.vend], 5, M, 'drink');
    tally.vending = (tally.vending ?? 0) + 1;
    b.endMark();
  }

  // 사물함 줄 — **북쪽 외벽 고정** (자판기와 다른 평면). `?? wv` 로 같은 벽에
  // 겹쳐 세우던 잠재 자리는 없앴다 — 벽이 없으면 사물함도 없는 게 맞다.
  const wl = walls.filter((q) => q.axis === 'x' && q.b - q.a > 2.0).sort((p, q) => q.at - p.at)[0];
  if (wl) {
    b.mark('furniture', `lockers:${c.id}`);
    for (const t of fit(0, wl.b - wl.a, 0.5, 0.4).slice(0, 6)) {
      locker(I.spawnPair('locker'), wl, wl.a + t, M);
      tally.locker = (tally.locker ?? 0) + 1;
    }
    b.endMark();
  }
}

// 샤워실 — 부스·샤워 기둥·벤치·사물함. 위생 권역의 가운데 칸이다.
function shower(b, c, M, tally, I) {
  const walls = interiorWalls(c.id).filter((q) => q.rule === 'solid');
  // 부스 — **서쪽 벽 고정** (화장실 경계 z-벽). "제일 긴 벽" 정렬은 동·서
  // z-벽 길이가 같아 배열 순서가 승자를 정하는 복권이었다 — 벽은 순서가
  // 아니라 방위·평면으로 고른다 (status.md 4.1 의 16). 서쪽이어야 하는
  // 이유: 화장실 부스가 같은 벽의 반대면에 붙어 젖은 배관이 한 벽으로
  // 모인다. (옛 주석의 "배관 코어" 는 이번에 없앤 spurN 이라 근거를 갱신)
  const zWalls = walls.filter((q) => q.axis === 'z');
  const w = (zWalls.length ? zWalls.sort((p, q) => p.at - q.at) : walls)[0];
  if (!w) return;
  b.mark('furniture', `shower:${c.id}`);
  const D = 1.0;
  const PH = 2.0;
  const len = w.b - w.a;
  const seats = fit(0, len, 1.05, 0.3);
  const edges = [seats[0] - 0.5, ...seats.map((t) => t + 0.5)];
  for (const t of edges) wallBox(b, w, w.a + t, D / 2, 0.1 + PH / 2, 0.04, PH, D, M.trim);
  for (const t of seats) {
    const u = w.a + t;
    // 샤워 기둥 — **로컬(+x 벽따라, +z 안쪽)에서 짓고 wallPut 으로 한 번에
    // 옮긴다.** 조각마다 축·inward 삼각함수를 따로 쓰다 배관·목·헤드·레버가
    // 제각각 떠 있었다 (#4 지적 — 의자·경첩과 같은 교훈).
    const put = (g, m) => wallPut(b, w, u, g, m);
    const cyl = (r0, r1, h, lx, ly, lz, m, tiltX = 0, seg = 6) => {
      const g = new THREE.CylinderGeometry(r0, r1, h, seg);
      if (tiltX) g.rotateX(tiltX);
      g.translate(lx, ly, lz);
      put(g, m);
    };
    // 기둥 꼭대기에서 **암이 아래로 꺾여** 나가고 그 끝에 헤드가 아래를
    // 본다. 목이 헤드 위로 솟아 안테나가 됐던 판을 다시 짰고, 헤드가
    // 1.7m(얼굴 높이)라 칸막이 상단에 걸려 보이던 것을 1.9m 로 올렸다
    // (2026-08-06 지적 — 샤워 헤드는 머리 위에 있어야 샤워기다).
    cyl(0.018, 0.018, 2.0, 0, 1.0, 0.09, M.trim); // 수직 배관 (꼭대기 2.0)
    cyl(0.014, 0.014, 0.26, 0, 1.94, 0.2, M.trim, 2.05); // 암 — 위에서 아래-안쪽으로
    cyl(0.02, 0.062, 0.07, 0, 1.86, 0.32, M.steel, 0.35); // 헤드 — 아래가 넓은 원뿔대
    // 살수판 — 헤드와 **같은 축**에 있어야 한다. 좌표를 눈짐작으로 두었더니
    // 원판이 원뿔대에서 3cm 벗어나 떠 있었다 (2026-08-06 재지적). 헤드
    // 밑면 중심 = 헤드 중심 - (h/2 + t/2)·축, 축 = (0, cos0.35, sin0.35).
    cyl(0.052, 0.052, 0.014, 0, 1.82, 0.306, M.steelDark, 0.35, 10);
    // 수전 몸통 + 십자 손잡이(교차 원기둥 둘)
    const body = new THREE.BoxGeometry(0.12, 0.05, 0.05);
    body.translate(0, 1.1, 0.075);
    put(body, M.steel);
    cyl(0.008, 0.008, 0.1, 0, 1.1, 0.11, M.trim, Math.PI / 2);
    {
      const g = new THREE.CylinderGeometry(0.008, 0.008, 0.1, 6);
      g.rotateZ(Math.PI / 2);
      g.translate(0, 1.1, 0.11);
      put(g, M.trim);
    }
    // 비누 선반 — 칸막이 구석의 **사분원 판** (곡면이 이 물건답다).
    // 부채꼴이 방 안쪽(+x·+z)을 보게 놓는다
    {
      const q = new THREE.CylinderGeometry(0.15, 0.15, 0.02, 6, 1, false, 0, Math.PI / 2);
      q.translate(0.33, 1.05, 0.02);
      put(q, M.paper);
      // 그 위의 비누 한 장 — 모서리를 죽인 납작한 덩어리. **선반만 있고
      // 비누가 없으면 그냥 턱이다** (챕터 0 디테일 패스)
      const soap = new THREE.CylinderGeometry(0.045, 0.038, 0.028, 8);
      soap.scale(1, 1, 0.62);
      soap.rotateY(0.4);
      soap.translate(0.38, 1.074, 0.07);
      put(soap, M.plasticWarm);
      tally.soap = (tally.soap ?? 0) + 1;
    }
    // 커튼 봉 — 부스 입구(칸막이 끝선)를 가로지르는 관
    {
      const g = new THREE.CylinderGeometry(0.013, 0.013, 0.94, 6);
      g.rotateZ(Math.PI / 2);
      g.translate(0, 1.98, D - 0.05);
      put(g, M.trim);
    }
    tally.shower = (tally.shower ?? 0) + 1;
  }
  b.endMark();

  // 벤치와 사물함 — **동쪽 벽 고정** (부스의 맞은편 z-벽). find 첫 번째로
  // 두면 부스 벽 선택을 고칠 때 이쪽이 북쪽 벽으로 밀려 사물함 셋이 하나로
  // 줄었다 — 짝이 되는 벽은 둘 다 방위로 고정해야 같이 버틴다.
  const across = walls.filter((q) => q.axis === 'z' && q !== w && q.b - q.a > 1.2).sort((p, q) => q.at - p.at)[0];
  if (across) {
    b.mark('furniture', `bench:${c.id}`);
    const cm = (across.a + across.b) / 2;
    wallBox(b, across, cm, 0.35, 0.44, Math.min(across.b - across.a - 0.4, 1.8), 0.05, 0.3, M.laminate);
    for (const s of [-0.7, 0.7]) wallBox(b, across, cm + s, 0.35, 0.21, 0.05, 0.42, 0.26, M.trim);
    for (const t of fit(0, across.b - across.a, 0.5, 0.25).slice(0, 3)) {
      const u = across.a + t;
      if (Math.abs(u - cm) < 1.1) continue; // 벤치 자리는 비운다
      locker(I.spawnPair('locker'), across, u, M);
      tally.locker = (tally.locker ?? 0) + 1;
    }
    // 벤치 위의 비누와 수건 (사용자 지시 — 샤워실에 비누를 더 둔다).
    // 부스 안 선반의 비누와 달리 여기 것은 **쓰고 나온 자리**의 것이다.
    {
      const soap = new THREE.CylinderGeometry(0.05, 0.042, 0.03, 8);
      soap.scale(1, 1, 0.62);
      const [px, , pz] = wallAt(across, cm - 0.55, 0.3, 0);
      soap.translate(px, 0.485, pz);
      b.add(soap, M.paper);
      tally.soap = (tally.soap ?? 0) + 1;
      // 개킨 수건 두 장 — 결 방향이 보이게 얇은 판 둘을 겹친다
      for (const [du, dy] of [[0.5, 0.475], [0.5, 0.505]]) {
        wallBox(b, across, cm + du, 0.3, dy, 0.34, 0.03, 0.24, M.porcelain);
      }
      // 샴푸·바디워시 — 벤치 끝의 통 둘
      for (const [du, mm] of [[-1.0, M.vendBlue], [-0.88, M.plasticWarm]]) {
        const [bx5, , bz5] = wallAt(across, cm + du, 0.3, 0);
        tube(b, 0.032, 0.17, [bx5, 0.555, bz5], mm, 'y', 8);
        tube(b, 0.012, 0.04, [bx5, 0.655, bz5], M.trim, 'y', 6);
      }
    }
    b.endMark();
  }
}

// 관제실 — 진입 사슬의 가운데. 서버실 유리를 향한 콘솔 줄과 상황판.
function control(b, c, M, tally, I) {
  // 콘솔 — 유리벽(서버실 쪽, 북쪽 z1)을 보고 앉는다. 화면은 사람 쪽(-z).
  b.mark('furniture', `console:${c.id}`);
  const zC = c.z1 - 1.35; // 콘솔 줄
  for (const x of fit(c.x0, c.x1, 2.2, 1.0)) {
    const tb = I.spawnPair('desk');
    for (const pose of ['closed', 'open']) {
      const d = tb[pose];
      d.box(1.8, 0.05, 0.85, [x, 0.73, zC], M.laminate, 0);
      d.box(0.44, 0.64, 0.7, [x - 0.6, 0.32, zC], M.laminate, 0);
      for (const dy of [0.16, 0.38, 0.56]) {
        const out = pose === 'open' && dy === 0.38 ? 0.22 : 0;
        d.box(0.38, 0.16, 0.02, [x - 0.6, dy, zC + 0.36 + out], M.trim, 0);
      }
      d.box(0.05, 0.72, 0.05, [x + 0.78, 0.36, zC - 0.3], M.trim, 0);
      d.box(0.05, 0.72, 0.05, [x + 0.78, 0.36, zC + 0.3], M.trim, 0);
    }
    // 브라운관 둘 — 화면이 남쪽(앉은 사람)을 본다
    terminal(I.spawn('crt'), x - 0.35, 0.755, zC + 0.12, -1, M);
    terminal(I.spawn('crt'), x + 0.42, 0.755, zC + 0.12, -1, M);
    // 기울인 제어반 — 두 브라운관 사이의 경사 패널 + 버튼. 직각 책상과
    // 모니터만으로는 관제 콘솔이 아니다 (lessons.md 3.13.2)
    {
      const g = new THREE.BoxGeometry(0.3, 0.018, 0.2);
      g.rotateX(-0.45);
      g.translate(x + 0.035, 0.815, zC + 0.16);
      b.add(g, M.steelDark);
      for (let k = 0; k < 4; k++) {
        const btn = new THREE.BoxGeometry(0.05, 0.012, 0.04);
        btn.rotateX(-0.45);
        btn.translate(x - 0.05 + (k % 2) * 0.17, 0.82 + (k < 2 ? 0.028 : -0.012), zC + 0.13 + (k < 2 ? 0.06 : 0));
        b.add(btn, k === 0 ? M.warn : M.trim);
      }
    }
    // 구즈넥 마이크 — 원판 받침 + 기울어 오르는 목 + 머리 (콘솔 하나 걸러)
    if (Math.round(x * 10) % 2 === 0) {
      tube(b, 0.035, 0.014, [x - 0.62, 0.762, zC - 0.18], M.steelDark, 'y', 8, true);
      const stem = new THREE.CylinderGeometry(0.006, 0.006, 0.2, 6);
      stem.rotateX(0.4);
      stem.translate(x - 0.62, 0.86, zC - 0.14);
      b.add(stem, M.trim);
      const mic = new THREE.CylinderGeometry(0.018, 0.014, 0.05, 8);
      mic.rotateX(1.2);
      mic.translate(x - 0.62, 0.96, zC - 0.1);
      b.add(mic, M.rubber);
    }
    chair(I.spawn('chair'), [x, 0, zC - 0.85], 0, M, M.plastic, true);
    // 야간 당직의 흔적 — 머그와 서류. 관제실은 사람이 붙어 있는 방이다
    const rk = hash2(Math.round(x * 19), 7);
    if (rk > 0.35) mug(b, x + 0.66, 0.755, zC - 0.22, M, rk > 0.7 ? M.porcelain : M.plasticWarm);
    if (rk > 0.55) paperPile(b, x - 0.62, 0.755, zC - 0.3, M, Math.round(x * 5));
    tally.console = (tally.console ?? 0) + 1;
  }
  b.endMark();

  // 상황판 — 남쪽 벽(기계실 경계)에 모니터 뱅크. 관제실의 표식이다.
  const w = interiorWalls(c.id).find((q) => q.rule !== 'glass' && q.b - q.a > 3.0);
  if (w) {
    b.mark('furniture', `statusboard:${c.id}`);
    const cm = (w.a + w.b) / 2;
    wallBox(b, w, cm, 0.05, 1.55, 3.4, 1.3, 0.06, M.crtDark);
    for (let r = 0; r < 2; r++) {
      for (let k = 0; k < 4; k++) {
        wallBox(b, w, cm - 1.275 + k * 0.85, 0.085, 1.86 - r * 0.62, 0.76, 0.54, 0.012, r + k === 2 ? M.exit : M.screen);
      }
    }
    b.endMark();
    tally.statusboard = 1;
  }
}

// 기계실 — 공조기·펌프·탱크·배관. 펌프 몸통과 탱크는 **원기둥**이다.
function machine(b, c, M, tally, I) {
  const cx = (c.x0 + c.x1) / 2;
  const cz = (c.z0 + c.z1) / 2;

  // 공조기(AHU) — 큰 함체. 루버·점검 뚜껑은 **방 안쪽(남면)** 을 본다 —
  // 처음에 북면(벽 쪽)에 붙여 아무도 못 보는 디테일이었다.
  b.mark('service', `ahu:${c.id}`);
  const ax = c.x0 + 2.2;
  // 벽에 붙인다 — 방 가운데 떠 있으면 자리가 애매하다 (#11)
  const az = c.z1 - 0.87;
  // 베이스 채널 + 방진 마운트(짧은 고무 원기둥 넷) — 기계는 바닥에 바로
  // 앉지 않는다
  b.box(3.0, 0.1, 1.5, [ax, 0.17, az], M.steelDark, 0);
  for (const [sx, sz] of [[-1.3, -0.55], [1.3, -0.55], [-1.3, 0.55], [1.3, 0.55]]) {
    tube(b, 0.07, 0.12, [ax + sx, 0.06, az + sz], M.rubber, 'y', 8, true);
  }
  b.box(3.0, 1.8, 1.5, [ax, 1.12, az], M.steel, 1.2);
  // 패널 리브 — 함체 남면의 세로 이음선. 민짜 상자를 패널 조립체로 만든다
  for (const dx of [-1.0, -0.33, 0.33, 1.0]) {
    b.box(0.03, 1.7, 0.02, [ax + dx, 1.12, az - 0.762], M.steelDark, 0);
  }
  for (let i = 0; i < 6; i++) {
    b.box(1.15, 0.07, 0.025, [ax - 0.67, 0.62 + i * 0.15, az - 0.765], M.steelDark, 0);
  }
  // 점검문 — 틀 + 문판 + 경첩 둘 + 손잡이 + 명판. 민짜 사각판은 문이 아니다
  b.box(0.56, 0.86, 0.02, [ax + 0.66, 1.15, az - 0.762], M.steelDark, 0); // 틀
  b.box(0.5, 0.8, 0.025, [ax + 0.66, 1.15, az - 0.768], M.trim, 0); // 문판
  for (const dy of [-0.28, 0.28]) {
    b.box(0.03, 0.1, 0.035, [ax + 0.44, 1.15 + dy, az - 0.765], M.steelDark, 0); // 경첩
  }
  b.box(0.025, 0.12, 0.04, [ax + 0.86, 1.15, az - 0.77], M.steelDark, 0); // 손잡이
  b.box(0.22, 0.09, 0.015, [ax - 0.05, 1.85, az - 0.765], M.paper, 0); // 명판
  // 흡입 팬 — 서쪽 옆면의 **원형** 하우징 (원판 + 토러스 링). 상자 옆에
  // 원이 하나 있어야 기계로 읽힌다 (lessons.md 3.13.2)
  {
    const disc = new THREE.CylinderGeometry(0.4, 0.4, 0.05, 14);
    disc.rotateZ(Math.PI / 2);
    disc.translate(ax - 1.53, 1.05, az);
    b.add(disc, M.steelDark);
    const ring = new THREE.TorusGeometry(0.4, 0.032, 6, 14);
    ring.rotateY(Math.PI / 2);
    ring.translate(ax - 1.54, 1.05, az);
    b.add(ring, M.trim);
  }
  tube(b, 0.3, c.h - 2.02, [ax + 0.8, 2.02 + (c.h - 2.02) / 2, az], M.steel, 'y', 10);
  b.endMark();
  tally.ahu = 1;

  // 펌프 두 쌍 — 눕힌 원통 몸통 + 모터 원통 + 받침. 배관의 무릎은
  // **사분 토러스 엘보**다 — 직관을 직각으로 맞대면 부러진 관이다
  // (lessons.md 3.13.2). 밸브 핸드휠도 토러스다.
  b.mark('service', `pumps:${c.id}`);
  for (const [px, pz] of [
    [cx + 1.2, cz - 1.2],
    [cx + 3.2, cz - 1.2],
  ]) {
    b.box(1.3, 0.18, 0.7, [px, 0.09, pz], M.steelDark, 0); // 기초 패드
    // 새들 받침 — 몸통·모터가 패드에 **닿아야 한다.** 원통 밑이 떠 있었다
    // (#2·3 재지적)
    for (const [dx, ww] of [[-0.45, 0.32], [0.02, 0.32], [0.42, 0.26]]) {
      b.box(ww, 0.14, 0.5, [px + dx, 0.25, pz], M.steelDark, 0);
    }
    tube(b, 0.21, 0.7, [px - 0.2, 0.5, pz], M.vendBlue, 'x', 10, true); // 펌프 몸통
    tube(b, 0.24, 0.05, [px + 0.16, 0.5, pz], M.steelDark, 'x', 10, true); // 몸통-모터 플랜지
    tube(b, 0.16, 0.45, [px + 0.42, 0.5, pz], M.steelDark, 'x', 10, true); // 모터
    // 모터 냉각핀 — 얇은 원판 넷. 민짜 원통은 모터가 아니다
    for (const dx of [0.3, 0.4, 0.5, 0.6]) {
      tube(b, 0.175, 0.014, [px + dx, 0.5, pz], M.steelDark, 'x', 10, true);
    }
    b.box(0.14, 0.1, 0.12, [px + 0.42, 0.63, pz], M.trim, 0); // 단자함
    // 토출 배관 — **천장을 뚫고 곧장 위로.** 남쪽 벽으로 눕혀 보냈더니
    // 배전반 줄과 엉켰다 (#2 재지적). 탱크 상부 배관·배전반 전선관과 같은
    // 문법이라 방이 정리된다.
    tube(b, 0.09, 0.06, [px - 0.57, 0.74, pz], M.steelDark, 'y', 8, true); // 토출 플랜지
    tube(b, 0.07, c.h - 0.77, [px - 0.55, 0.77 + (c.h - 0.77) / 2, pz], M.steel, 'y', 8);
    {
      // 밸브 — 수직관 중간. 보닛 + 수평 스템(통로 쪽) + 핸드휠 + 허브 + 스포크
      const vy = 1.5;
      tube(b, 0.055, 0.1, [px - 0.55, vy, pz], M.steel, 'y', 8, true); // 보닛
      const stem = new THREE.CylinderGeometry(0.02, 0.02, 0.16, 6);
      stem.rotateX(Math.PI / 2);
      stem.translate(px - 0.55, vy, pz + 0.12);
      b.add(stem, M.trim);
      const wz = pz + 0.21;
      const wheel = new THREE.TorusGeometry(0.085, 0.016, 6, 12);
      wheel.translate(px - 0.55, vy, wz); // 기본 XY 평면 — 통로를 본다
      b.add(wheel, M.warn);
      const hub = new THREE.CylinderGeometry(0.026, 0.026, 0.04, 8);
      hub.rotateX(Math.PI / 2);
      hub.translate(px - 0.55, vy, wz);
      b.add(hub, M.warn);
      for (const ang of [0, Math.PI / 2]) {
        const sp = new THREE.CylinderGeometry(0.011, 0.011, 0.165, 6);
        sp.rotateZ(Math.PI / 2);
        sp.rotateZ(ang); // 휠 평면(XY) 안에서 교차
        sp.translate(px - 0.55, vy, wz);
        b.add(sp, M.warn);
      }
    }
    tally.pump = (tally.pump ?? 0) + 1;
  }
  b.endMark();

  // 탱크 둘 — 수직 원통에 **반구 돔 머리**. 뚜껑이 평평하면 드럼통이다
  // (lessons.md 3.13.2). 몸통에 압력 게이지 원판이 붙는다.
  b.mark('service', `tanks:${c.id}`);
  for (const [tx, r, h] of [
    [c.x1 - 1.5, 0.55, 2.0],
    [c.x1 - 3.0, 0.4, 1.7],
  ]) {
    tube(b, r, h, [tx, h / 2 + 0.08, cz - 1.4], M.steel, 'y', 12, true);
    const dome = new THREE.SphereGeometry(r, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2);
    dome.translate(tx, h + 0.08, cz - 1.4);
    b.add(dome, M.steel);
    tube(b, r + 0.04, 0.08, [tx, 0.04, cz - 1.4], M.steelDark, 'y', 12, true);
    tube(b, 0.05, c.h - h - r - 0.08, [tx, (h + r + 0.08 + c.h) / 2, cz - 1.4], M.trim, 'y', 6); // 상부 배관
    // 게이지 — 방 쪽 몸통에 작은 원판 + 바늘
    {
      const g = new THREE.CylinderGeometry(0.06, 0.06, 0.025, 10);
      g.rotateX(Math.PI / 2);
      g.translate(tx, 1.35, cz - 1.4 + r + 0.012);
      b.add(g, M.paper);
      b.box(0.008, 0.045, 0.01, [tx, 1.36, cz - 1.4 + r + 0.028], M.vend, 0);
    }
    tally.tank = (tally.tank ?? 0) + 1;
  }
  b.endMark();

  // 정비의 흔적 — 드럼통 둘과 공구함. 기계실은 사람이 **일하러 오는** 방이라
  // 두고 간 것이 있어야 한다 (챕터 0 디테일 패스). 드럼은 몸통 원통에
  // **테두리 링 둘**이 있어야 드럼이다 — 민짜 원통은 파이프 토막이다.
  // **AHU 남쪽 바닥**에 둔다. 처음에 c.x0+1.4·cz+1.9 로 뒀더니 AHU 함체
  // (ax=c.x0+2.2, 3.0x1.5, 북벽 붙임) **속**이었다 — 놓기 전에 그 자리에
  // 무엇이 있는지 묻지 않은 것이다 (lessons 2장의 공통 원인). 배치 검사도
  // 못 잡았다: 원장 종류가 service/furniture 로 갈려 짝 검사에서 빠진다.
  b.mark('furniture', `drums:${c.id}`);
  for (const [dx, dz, mat] of [
    [c.x0 + 1.5, c.z0 + 1.3, M.vend],
    [c.x0 + 2.15, c.z0 + 1.55, M.steelDark],
  ]) {
    tube(b, 0.29, 0.88, [dx, 0.44, dz], mat, 'y', 12, true);
    for (const ry of [0.28, 0.6]) {
      const ring = new THREE.TorusGeometry(0.295, 0.022, 5, 12);
      ring.rotateX(Math.PI / 2);
      ring.translate(dx, ry, dz);
      b.add(ring, M.steelDark);
    }
    tube(b, 0.05, 0.03, [dx + 0.13, 0.895, dz], M.trim, 'y', 8, true); // 주입구 마개
    tally.drum = (tally.drum ?? 0) + 1;
  }
  // 공구함 — 몸통 + 뚜껑 띠 + 손잡이 관
  {
    const tx = c.x0 + 3.25;
    const tz = c.z0 + 1.35;
    b.box(0.52, 0.24, 0.26, [tx, 0.12, tz], M.warn, 0);
    b.box(0.54, 0.05, 0.28, [tx, 0.26, tz], M.steelDark, 0);
    tube(b, 0.014, 0.24, [tx, 0.35, tz], M.trim, 'x', 6);
    for (const s of [-1, 1]) b.box(0.02, 0.1, 0.02, [tx + s * 0.12, 0.3, tz], M.trim, 0);
    tally.toolbox = (tally.toolbox ?? 0) + 1;
  }
  b.endMark();

  // 천장 배관 — 설비실과 같은 규율 (원기둥 + 행어)
  b.mark('service', `pipes:${c.id}`);
  const len = c.x1 - c.x0 - 0.4;
  for (const [off, r, m] of [
    [-0.5, 0.1, M.steel],
    [0, 0.14, M.steelDark],
    [0.5, 0.08, M.steel],
  ]) {
    tube(b, r, len, [cx, 2.4 + off * 0.18, cz - 0.3 + off], m, 'x', 8);
    for (const t of fit(cx - len / 2, cx + len / 2, 2.6, 0.6)) {
      b.box(0.03, c.h - 2.4 - off * 0.18, 0.03, [t, (c.h + 2.4 + off * 0.18) / 2, cz - 0.3 + off], M.trim, 0);
    }
  }
  b.endMark();

  // 배전반 한 줄 — 제일 긴 막힌 벽. 옛 설비실(배전반 방)을 이 방에 합쳤으므로
  // 개수 상한 없이 벽 길이만큼 선다 (2026-08-05 병합).
  const w = interiorWalls(c.id)
    .filter((q) => q.rule === 'solid' && q.b - q.a > 3)
    .sort((p, q) => q.b - q.a - (p.b - p.a))[0];
  if (w) {
    b.mark('furniture', `plant:${c.id}`);
    for (const t of fit(0, w.b - w.a, 2.4, 1.0)) {
      const pr = I.spawnPair('panel');
      panel(pr.closed, w, w.a + t, c.h, M);
      panel(pr.open, w, w.a + t, c.h, M, 'open');
      tally.panel = (tally.panel ?? 0) + 1;
    }
    b.endMark();
  }
}

// 비상계단 — 지상으로 올라가는 2련 계단. 난간은 **관**이다.
// 위쪽은 어두운 통으로 막혀 있다 — 지진 직후라 위층 개방은 파손·탈출
// 단계의 몫이다 (story.md 2장 6).
//
// **층계는 아래가 찬 덩어리다.** 처음에 얇은 판을 공중에 계단식으로 띄웠더니
// 계단이 아니라 떠 있는 블록 줄이었다 — 부어 만든 콘크리트 계단은 바닥부터
// 차오른다. 참(landing)도 기둥처럼 바닥부터 채운다.
//
// **방 치수에서 련 폭·단 수가 나온다** — 계단실은 계단이 벽에 딱 맞붙는
// 크기다. 입구는 엘리베이터 베이 쪽(동쪽 벽 문)이다 (2026-08-05 스크린샷
// 지시): 베이 문으로 들어와 -> 동쪽 련 옆 빈 바닥을 따라 북쪽으로 -> 서쪽
// 련을 남쪽으로 오름 -> 남쪽 끝 참에서 꺾여 동쪽 련이 어두운 상부 통
// 속으로 사라진다 (위층 개방은 파손·탈출 단계 몫). 북쪽 복도 문은 유예
// 공간(련이 시작되기 전)으로 열린다.
function stairwell(b, c, M, tally) {
  b.mark('furniture', `stair:${c.id}`);
  const rise = 0.17;
  const tread = 0.27;
  const N = 12;
  const w2 = (c.x1 - c.x0 - 0.3) / 2; // 두 련이 방 폭을 꽉 채운다
  const xA = c.x0 + 0.08 + w2 / 2; // 오름 련 — 서쪽
  const xB = c.x1 - 0.08 - w2 / 2; // 되오름 련 — 동쪽 (베이 문 쪽)
  const zTop = c.z1 - 0.95; // 북쪽 유예 뒤 1련 첫 단

  // 1련(서) — 북에서 남으로 오른다. 단마다 바닥까지 채운 상자
  for (let i = 0; i < N; i++) {
    const h = rise * (i + 1);
    b.box(w2, h, tread, [xA, h / 2, zTop - tread * (i + 0.5)], M.rock, 0.6);
  }
  const yL = rise * (N + 1); // 참 윗면
  const zL1 = zTop - tread * N; // 참 북쪽 끝 (1련 꼭대기와 잇닿는다)
  const LD = Math.max(1.2, zL1 - c.z0 - 0.12); // 남쪽 벽까지 채운다
  b.box(c.x1 - c.x0 - 0.16, yL, LD, [(c.x0 + c.x1) / 2, yL / 2, zL1 - LD / 2], M.rock, 0.6);
  // 2련(동) — 참 위에 얹혀 북쪽으로 되오르며 **샤프트 속으로 계속 올라간다.**
  // 정체불명의 검은 상자로 가리던 것을 걷어냈다 (#9) — 계단은 위층으로
  // 이어지는 것처럼 보여야 한다. 막힘(잔해)은 파손 단계의 몫이다.
  for (let i = 1; i <= 10; i++) {
    const h = rise * i;
    b.box(w2, h, tread, [xB, yL + h / 2, zL1 + tread * (i - 0.5)], M.rock, 0.6);
  }
  // 상부 참 조각 — 2련 꼭대기(어둠 직전)의 슬래브. 올려다보면 실루엣이 남는다
  const yU = yL + rise * 11;
  b.box(w2, 0.16, 0.9, [xB, yU - 0.08, zL1 + tread * 10.5 + 0.45], M.rock, 0.6);

  // 샤프트 — 방 천장이 없는 대신(shell.buildCeilings) 벽이 위로 계속 올라
  // 어두운 통이 된다. 꼭대기는 캡 슬래브. 스콘스 위로는 직사광이 안 가므로
  // 상부는 굽기에서 자연히 어둠에 잠긴다.
  const SH = 5.5;
  const cx2 = (c.x0 + c.x1) / 2;
  const cz2 = (c.z0 + c.z1) / 2;
  b.box(c.x1 - c.x0, SH - c.h, 0.12, [cx2, (SH + c.h) / 2, c.z0 + 0.06], M.wall, 1.0);
  b.box(c.x1 - c.x0, SH - c.h, 0.12, [cx2, (SH + c.h) / 2, c.z1 - 0.06], M.wall, 1.0);
  b.box(0.12, SH - c.h, c.z1 - c.z0 - 0.24, [c.x0 + 0.06, (SH + c.h) / 2, cz2], M.wall, 1.0);
  b.box(0.12, SH - c.h, c.z1 - c.z0 - 0.24, [c.x1 - 0.06, (SH + c.h) / 2, cz2], M.wall, 1.0);
  b.box(c.x1 - c.x0, 0.15, c.z1 - c.z0, [cx2, SH + 0.075, cz2], M.rock, 1.2);

  // 난간 — 1련 안쪽(동측)에 경사 관 + 수직 지주. 2련 것은 통 속이라 안 낸다
  const rail = (x, za, ya, zb, yb) => {
    const len = Math.hypot(zb - za, yb - ya);
    const g = new THREE.CylinderGeometry(0.021, 0.021, len, 6);
    g.rotateX(Math.atan2(zb - za, yb - ya));
    g.translate(x, (ya + yb) / 2, (za + zb) / 2);
    b.add(g, M.warn);
    for (const t of [0.12, 0.5, 0.88]) {
      const z = za + (zb - za) * t;
      const yr = ya + (yb - ya) * t;
      tube(b, 0.013, 0.86, [x, yr - 0.43, z], M.trim, 'y', 6);
    }
  };
  rail(xA + w2 / 2 + 0.05, zTop - 0.15, 1.05, zL1 + 0.15, 1.05 + rise * (N - 1));
  b.endMark();
  tally.stair = 1;
}

// 엘리베이터 홀 — 닫힌 문 두 짝과 호출반, 층 표시.
function elevatorHall(b, c, M, tally) {
  // 문은 남쪽 외벽(막힌 벽)에 낸다 — 승강로는 벽 너머(매립 쪽) 상상 속이다
  const w = interiorWalls(c.id)
    .filter((q) => q.rule === 'solid')
    .sort((p, q) => q.b - q.a - (p.b - p.a))[0];
  if (!w) return;
  b.mark('furniture', `elev:${c.id}`);
  const cm = (w.a + w.b) / 2;
  for (const s of [-1.6, 1.6]) {
    const u = cm + s;
    // 틀 — **둘레 띠 셋**이다. 처음에 통판 하나로 세웠더니 문짝이 그 속에
    // 묻혀 검은 판만 남았다 — 자판기 진열창(#64)과 같은 병.
    for (const [du, y, wid, h] of [
      [-0.62, 1.09, 0.12, 2.18],
      [0.62, 1.09, 0.12, 2.18],
      [0, 2.24, 1.36, 0.12],
    ]) {
      wallBox(b, w, u + du, 0.06, y, wid, h, 0.12, M.steelDark);
    }
    // 문 두 짝 — 틀 앞면 바로 뒤 1cm. 벽 쪽으로 깊이 물렸더니 시커먼 빈
    // 구멍으로 보였다 (#10). 가운데 틈이 보여야 문이다
    for (const d of [-1, 1]) {
      wallBox(b, w, u + d * 0.28, 0.095, 1.04, 0.54, 2.08, 0.03, M.steel);
    }
    wallBox(b, w, u, 0.113, 1.04, 0.02, 2.08, 0.02, M.rubber); // 틈
    wallBox(b, w, u, 0.095, 2.13, 1.12, 0.1, 0.03, M.steel); // 문 위 막음판
    // 문지방 — 바닥의 스테인리스 띠
    wallBox(b, w, u, 0.1, 0.012, 1.3, 0.024, 0.16, M.steelDark);
    // 층 표시 — 문 위 발광 띠 + **삼각 프리즘 화살표** (3각 원기둥 —
    // 위를 가리켜야 '올라가는 승강기' 다. lessons.md 3.13.2)
    wallBox(b, w, u, 0.065, 2.42, 0.5, 0.12, 0.03, M.screen);
    {
      const tri = new THREE.CylinderGeometry(0.05, 0.05, 0.018, 3);
      tri.rotateX(Math.PI / 2); // 축을 벽 법선으로
      tri.rotateZ(Math.PI); // 꼭짓점이 위를 본다
      const [tx2, , tz2] = wallAt(w, u - 0.42, 0.07, 0);
      tri.translate(tx2, 2.42, tz2);
      b.add(tri, M.exit);
    }
    tally.elev = (tally.elev ?? 0) + 1;
  }
  // 호출반 — 두 문 사이. 버튼은 **원형**이다 (사각 버튼 승강기는 없다)
  wallBox(b, w, cm, 0.06, 1.1, 0.14, 0.3, 0.04, M.steel);
  for (const [y, m] of [
    [1.16, M.exit],
    [1.04, M.trim],
  ]) {
    const g = new THREE.CylinderGeometry(0.024, 0.024, 0.014, 10);
    g.rotateX(Math.PI / 2);
    const [bx2, , bz2] = wallAt(w, cm, 0.088, 0);
    g.translate(bx2, y, bz2);
    b.add(g, m);
  }
  b.endMark();
}

// 자판기 하나.
//
// **색칠한 상자는 자판기가 아니다.** 사용자가 "추측 안 했으면 저게 자판기인지
// 몰랐을 것" 이라고 한 그 물건이다. 자판기를 자판기로 만드는 것 다섯:
//   1. **진열창 안의 상품 줄** — 이것 하나가 절반이다
//   2. 위쪽 **간판 패널**
//   3. 오른쪽 **선택 버튼 판**과 표시창
//   4. **동전 투입구 · 지폐 투입구 · 반환구**
//   5. 아래 **배출구** — 안으로 들어간 어두운 구멍에 여닫이 뚜껑
//
// 그리고 앞면은 **벽에서 먼 쪽**이다. 예전에는 유리를 벽 쪽(0.02)에 두어
// 본체 속에 통째로 묻어 놓았다 — wallAt/wallBox 를 만든 이유가 이것이다.
// 자판기 하나. kind 'drink' 는 음료(붉은 몸통 — 캔·페트병), 'snack' 은
// 스낵(푸른 몸통 — 봉지와 갑)이다. **두 종을 한 함수로 두되 진열만 가른다** —
// 몸통·창·선택부의 문법은 같은 물건이므로 (2026-08-06 사용자 지시).
// 스낵기의 상품은 원기둥이면 안 된다: 봉지는 위아래가 접힌 납작한 판이고,
// 갑은 상자다 — 실루엣이 그 물건을 정한다 (lessons.md 3.13.2 의 뒷면).
function vendor(b, w, u, spec, idx, M, kind = 'drink') {
  const [WID, HT, BODY] = spec;
  const DEP = 0.8;
  const F = DEP; // 앞면
  const box = (du, v, y, wid, h, th, m) => wallBox(b, w, u + du, v, y, wid, h, th, m);

  // ── 진열창의 자리 ────────────────────────────────────────────────────
  // 창은 왼쪽으로 치우친다 — 오른쪽 0.29m 는 선택부(버튼·투입구)의 기둥이다.
  const gW = WID - 0.4;
  const gC = -0.09; // 창 중심 (u 기준)
  const gY = 1.06;
  const gH = 0.86;
  const gL = gC - gW / 2;
  const gR = gC + gW / 2;

  box(0, DEP / 2, 0.05, WID - 0.08, 0.1, DEP - 0.06, M.steelDark); // 굽

  // ── 본체 — 창 둘레를 틀로 쪼개어 짓는다 ──────────────────────────────
  //
  // 처음에는 본체를 통짜 상자로 두고 상품을 그 **속에** 넣었다. 상품·선반이
  // 전부 렌더는 되는데 불투명 본체에 가려 화면에는 검은 사각형만 남았고,
  // "추측 안 했으면 자판기인지 몰랐을" 물건이 됐다 (#64). 벽에 문을 낼 때와
  // 같은 방식으로 — 불리언 없이 — 창을 뺀 네 조각 + 뒷판으로 짓는다.
  box(0, 0.1, 0.1 + (HT - 0.1) / 2, WID, HT - 0.1, 0.2, BODY); // 뒷판 (진열칸의 배경)
  box(gL / 2 - WID / 4, DEP / 2 + 0.1, 0.1 + (HT - 0.1) / 2, gL + WID / 2, HT - 0.1, DEP - 0.2, BODY); // 왼 기둥
  box(gR / 2 + WID / 4, DEP / 2 + 0.1, 0.1 + (HT - 0.1) / 2, WID / 2 - gR, HT - 0.1, DEP - 0.2, BODY); // 오른 기둥
  const yTop = gY + gH / 2;
  const yBot = gY - gH / 2;
  box(gC, DEP / 2 + 0.1, (yTop + HT) / 2, gW, HT - yTop, DEP - 0.2, BODY); // 상단 띠
  // 하단 띠 — 앞면을 0.28 뒤로 물린다. 그 요철이 배출 베이다. 예전에는 통짜
  // 본체 **속에** 배출구 상자를 넣어 그것도 안 보였다 (#64 와 같은 병).
  box(gC, 0.36, (0.1 + yBot) / 2, gW, yBot - 0.1, 0.32, BODY);

  // 간판 — 위쪽 1/5. 밝은 띠가 있어야 자판기로 읽힌다.
  // 앞면(F)과 같은 평면에 뒷면을 붙이면 z-파이팅이므로 2mm 띄운다.
  box(0, F + 0.014, HT - 0.22, WID - 0.06, 0.34, 0.024, M.paper);
  box(0, F + 0.028, HT - 0.22, WID - 0.16, 0.14, 0.01, idx % 2 ? M.vendBlue : M.vend);

  // ── 진열칸 속 — 선반과 상품. 이제 창 너머로 실제로 보인다 ────────────
  //
  // **음료는 원기둥이다** (lessons.md 3.13.2 — 사용자 지시). 상자로 냈더니
  // "이게 음료 자판기라면 안에 직육면체가 있으면 안 된다" 는 지적을 받았다.
  // 캔(낮고 통통)과 병(캔보다 크고 목이 좁아진다) 두 종을 섞는다.
  const PAL = [M.vend, M.vendBlue, M.plastic, M.plasticWarm, M.warn, M.crate];
  const drink = (du, v, yBase, r, m) => {
    // 선반 위에 서는 음료 — 벽 좌표로 옮겨 놓는다
    const put = (r0, r1, h, yc, mm, seg = 8) => {
      const g = new THREE.CylinderGeometry(r0, r1, h, seg);
      const [px, py, pz] = wallAt(w, u + du, v, yc);
      g.translate(px, py, pz);
      b.add(g, mm);
    };
    if (r < 0.6) {
      put(0.029, 0.029, 0.115, yBase + 0.0575, m); // 캔 몸통
      put(0.026, 0.029, 0.012, yBase + 0.121, M.steel); // 캔 윗테 — 은색으로 좁아진다
    } else {
      // 페트병 — 몸통·**어깨(원뿔대)**·목·뚜껑. 원기둥 두 개를 쌓으면 병이
      // 아니라 굴뚝이다 (#8 지적, lessons.md 3.13.2)
      put(0.027, 0.027, 0.125, yBase + 0.0625, m); // 몸통
      put(0.011, 0.027, 0.045, yBase + 0.1475, m); // 어깨 — 좁아지는 원뿔대
      put(0.011, 0.011, 0.028, yBase + 0.184, m); // 목
      put(0.0125, 0.0125, 0.018, yBase + 0.207, M.paper); // 뚜껑 — 색이 다르다
    }
  };
  // 스낵 — **봉지**(위아래가 접혀 도톰한 판)와 **갑**(납작한 상자). 음료기와
  // 달리 상품이 선반에 **세워져 꽂혀** 있다: 스낵 자판기는 코일에 걸어 판다.
  const snack = (du, v, yBase, r, m) => {
    if (r < 0.62) {
      // 봉지 — 몸통 판 + 위아래 접힌 띠 둘
      box(du, v, yBase + 0.085, 0.085, 0.17, 0.045, m);
      for (const dy of [0.005, 0.165]) {
        box(du, v, yBase + dy, 0.09, 0.012, 0.02, M.paper);
      }
    } else {
      // 갑 — 납작한 상자에 라벨 띠
      box(du, v, yBase + 0.075, 0.07, 0.15, 0.038, m);
      box(du, v + 0.022, yBase + 0.1, 0.055, 0.05, 0.006, M.paper);
    }
  };
  for (let s = 0; s < 4; s++) {
    const sy = yBot + 0.13 + s * 0.21;
    box(gC, 0.5, sy - 0.075, gW, 0.014, 0.5, M.steelDark); // 선반
    // 스낵기는 선반마다 **코일**이 보인다 — 나선 대신 촘촘한 링 줄로 흉내낸다
    if (kind === 'snack') {
      for (let k = 0; k < 5; k++) {
        const cu = gL + 0.06 + (k * (gW - 0.12)) / 4;
        for (let q = 0; q < 4; q++) {
          const ring = new THREE.TorusGeometry(0.026, 0.0035, 4, 8);
          ring.rotateY(w.axis === 'x' ? 0 : Math.PI / 2);
          const [px, py, pz] = wallAt(w, u + cu, 0.42 + q * 0.055, sy - 0.04);
          ring.translate(px, py, pz);
          b.add(ring, M.trim);
        }
      }
    }
    for (let k = 0; k < 5; k++) {
      const r = hash2(idx * 17 + s * 5 + k, s * 7 + k);
      if (r < 0.12) continue; // 다 팔린 줄
      const m = PAL[Math.floor(r * PAL.length) % PAL.length];
      const du = gL + 0.06 + (k * (gW - 0.12)) / 4;
      // 선반 윗면(sy-0.068)에 바닥을 붙인다 — 띄우면 유리 너머로 뜬 게 보인다
      if (kind === 'snack') snack(du, 0.5, sy - 0.068, r, m);
      else drink(du, 0.55, sy - 0.068, r, m);
    }
  }

  // 창틀 — 개구부를 덮는 판이 아니라 **둘레의 띠 넷**이다.
  // 예전에는 창 전체 크기의 검은 판을 앞에 붙여 놓아 그것부터가 가림막이었다.
  const FR = 0.03;
  box(gC, F + 0.008, yTop + FR / 2, gW + FR * 2, FR, 0.016, M.rubber);
  box(gC, F + 0.008, yBot - FR / 2, gW + FR * 2, FR, 0.016, M.rubber);
  box(gL - FR / 2, F + 0.008, gY, FR, gH, 0.016, M.rubber);
  box(gR + FR / 2, F + 0.008, gY, FR, gH, 0.016, M.rubber);
  // 유리 — 상품 앞에. 투명은 마지막에 놓아야 정렬이 맞다 (아래에서 배치)

  // ── 선택부 — 오른 기둥 위. 간판(하단 y=HT-0.39)과 안 겹치게 그 아래로 ──
  const px = WID / 2 - 0.145;
  const pTop = HT - 0.44;
  box(px, F + 0.014, pTop - 0.45, 0.24, 0.9, 0.024, M.steelDark); // 조작 판
  box(px, F + 0.032, pTop - 0.1, 0.18, 0.1, 0.01, M.screen); // 표시창
  for (let r = 0; r < 4; r++) {
    for (let k = 0; k < 2; k++) {
      box(px - 0.045 + k * 0.09, F + 0.032, pTop - 0.26 - r * 0.09, 0.055, 0.05, 0.014, M.trim);
    }
  }
  box(px + 0.045, F + 0.032, pTop - 0.64, 0.02, 0.075, 0.014, M.rubber); // 동전 투입구
  box(px - 0.045, F + 0.032, pTop - 0.67, 0.1, 0.026, 0.014, M.rubber); // 지폐 투입구
  box(px, F + 0.03, pTop - 0.79, 0.13, 0.06, 0.012, M.trim); // 반환구

  // ── 배출구 — 하단 띠가 뒤로 물러난 자리에 앉는다 ─────────────────────
  box(gC, 0.6, 0.42, gW - 0.06, 0.34, 0.16, M.rubber); // 어두운 베이 속
  box(gC, 0.7, 0.47, gW - 0.2, 0.22, 0.02, M.trim); // 여닫이 뚜껑
  box(gC, F + 0.01, 0.28, gW, 0.14, 0.016, M.steelDark); // 발판

  // 유리 — 모든 불투명 조각 뒤(=코드상 마지막)에 넣는다
  box(gC, F + 0.016, gY, gW, gH, 0.01, M.glass);
}

// 서버 랙 하나. 600 x 1000 x 2000, 앞면이 +face 쪽을 본다.
//
// **랙은 통짜 검은 상자가 아니다.** 예전 판이 그랬고, 표시등만 공중에 떠
// 있었다. 서버 랙을 서버 랙으로 만드는 것 넷:
//   1. **U 단위로 쌓인 유닛** — 칸이 나뉘어 보여야 한다. 빈 칸과 블랭크 패널도
//   2. **잠기는 망문** — 앞을 덮되 뒤가 비쳐 보인다
//   3. 프레임 기둥과 굽
//   4. 랙 번호
//
// ax 는 랙이 늘어선 축('x' 면 랙이 x 로 줄지어 서고 앞면은 z 를 본다).
function serverRack(b, u, v, ax, face, M, seed, pose = 'closed') {
  const W_ = 0.6;
  const D_ = 1.0;
  const HT = 2.0;
  // 로컬 (a: 랙 폭 방향, p: 앞뒤, y) -> 세계
  const at = (a, p, y) => (ax === 'x' ? [u + a, y, v + face * p] : [v + face * p, y, u + a]);
  const sz = (wa, h, dp) => (ax === 'x' ? [wa, h, dp] : [dp, h, wa]);
  const box = (a, p, y, wa, h, dp, m) => {
    const s = sz(wa, h, dp);
    b.box(s[0], s[1], s[2], at(a, p, y), m, 0);
  };

  box(0, 0, 0.04, W_, 0.08, D_, M.rack); // 굽
  box(0, 0, HT - 0.03, W_, 0.06, D_, M.rack); // 천판
  box(0, -D_ / 2 + 0.02, HT / 2, W_, HT, 0.04, M.rack); // 뒷판
  for (const s of [-1, 1]) {
    box((s * (W_ - 0.03)) / 2, 0, HT / 2, 0.03, HT, D_, M.rack); // 옆판
  }
  // 앞 기둥 넷 — 유닛이 물리는 자리
  for (const s of [-1, 1]) {
    for (const p of [D_ / 2 - 0.04, -D_ / 2 + 0.08]) {
      box((s * (W_ - 0.09)) / 2, p, HT / 2, 0.045, HT - 0.14, 0.045, M.rack);
    }
  }

  // ── 유닛 ─────────────────────────────────────────────────────────────
  //
  // 1U = 0.05 로 잡고 위에서부터 채운다. 크기가 제각각이어야 랙으로 읽힌다.
  let y = HT - 0.14;
  let i = 0;
  const front = D_ / 2 - 0.06;
  while (y > 0.16) {
    const r = hash2(seed * 13 + i, Math.round(u * 31) + i * 7);
    const uH = (r < 0.55 ? 1 : r < 0.82 ? 2 : 4) * 0.05;
    if (y - uH < 0.16) break;
    const cy = y - uH / 2;
    if (r > 0.9) {
      // 빈 칸 — 꽉 찬 랙은 오히려 가짜로 보인다
      y -= uH;
      i++;
      continue;
    }
    const blank = r > 0.72;
    box(0, front, cy, W_ - 0.12, uH - 0.008, 0.04, blank ? M.rack : M.bezel);
    if (!blank) {
      // 통풍구 — 앞판 가운데의 어두운 띠
      box(-0.02, front + 0.022, cy, W_ * 0.46, uH * 0.5, 0.008, M.rubber);
      // 표시등. **망문(불투명도 0.4) 너머로 보여야 하고, 랙을 비스듬히 보면
      // 가장자리가 옆 랙에 가린다.** 그래서 가운데 쪽으로 모으고 셋을 둔다.
      for (let k = 0; k < 3; k++) {
        box(-W_ / 2 + 0.11 + k * 0.045, front + 0.026, cy + uH * 0.1, 0.032, 0.015, 0.01,
          (i + k) % 4 === 0 ? M.ledAmber : M.led);
      }
      // 활동 표시 — 가로로 긴 띠. 멀리서도 이것이 제일 먼저 읽힌다
      if (uH > 0.06) box(W_ / 2 - 0.14, front + 0.026, cy + uH * 0.12, 0.13, 0.012, 0.01, M.led);
      // 드라이브 베이 — 오른쪽에 얇은 가로선
      if (uH > 0.06) box(W_ / 2 - 0.14, front + 0.022, cy - uH * 0.2, 0.16, 0.014, 0.008, M.rack);
    }
    y -= uH;
    i++;
  }

  // ── 망문 ─────────────────────────────────────────────────────────────
  //
  // 반투명이라 뒤의 유닛과 표시등이 비친다. 테두리·손잡이·잠금이 있어야
  // "잠긴 문" 으로 보인다. pose 'open' 이면 경첩축으로 열려 있다 — 약탈 뒤.
  const dz = D_ / 2 + 0.01;
  if (pose === 'closed') {
    box(0, dz, HT / 2, W_ - 0.03, HT - 0.1, 0.012, M.meshDoor);
    for (const s of [-1, 1]) box((s * (W_ - 0.05)) / 2, dz + 0.008, HT / 2, 0.035, HT - 0.1, 0.02, M.rack);
    for (const s of [-1, 1]) box(0, dz + 0.008, HT / 2 + (s * (HT - 0.1)) / 2, W_ - 0.03, 0.035, 0.02, M.rack);
    box(W_ / 2 - 0.07, dz + 0.035, HT / 2, 0.022, 0.26, 0.022, M.trim); // 손잡이
    box(W_ / 2 - 0.07, dz + 0.022, HT / 2 - 0.2, 0.05, 0.05, 0.016, M.trim); // 잠금
    // 랙 번호 — 종이(알베도 0.7)로 뒀더니 어두운 랙 위에서 흰 판때기로 튀었다
    box(-W_ / 2 + 0.13, dz + 0.02, HT - 0.13, 0.1, 0.036, 0.008, M.trim);
  } else {
    // 문짝 조립체 전체(망판·테두리·손잡이·잠금)를 로컬에서 짓고 — 경첩변이
    // 원점 — 스윙 각으로 돌린 뒤 경첩 자리에 앉힌다. 프레임에 남는 것은 없다.
    const SWING = 1.1; // 63도 — 확실히 "열려 있다"
    const rackYaw = ax === 'x' ? (face > 0 ? 0 : Math.PI) : face > 0 ? Math.PI / 2 : -Math.PI / 2;
    const dw = W_ - 0.03;
    const doorPut = (g, m) => {
      g.rotateY(-SWING); // 로컬 +x(문 폭) -> +z(앞) 으로 연다
      g.translate(-W_ / 2 + 0.015, 0, dz); // 경첩 자리 (랙 로컬)
      g.rotateY(rackYaw);
      const [cx0, , cz0] = ax === 'x' ? [u, 0, v] : [v, 0, u];
      g.translate(cx0, 0, cz0);
      b.add(g, m);
    };
    const dg = new THREE.BoxGeometry(dw, HT - 0.1, 0.012);
    dg.translate(dw / 2, HT / 2, 0);
    doorPut(dg, M.meshDoor);
    for (const e of [0.035 / 2, dw - 0.035 / 2]) {
      const fg = new THREE.BoxGeometry(0.035, HT - 0.1, 0.02);
      fg.translate(e, HT / 2, 0.008);
      doorPut(fg, M.rack);
    }
    for (const s of [-1, 1]) {
      const hg = new THREE.BoxGeometry(dw, 0.035, 0.02);
      hg.translate(dw / 2, HT / 2 + (s * (HT - 0.1)) / 2, 0.008);
      doorPut(hg, M.rack);
    }
    const hd = new THREE.BoxGeometry(0.022, 0.26, 0.022);
    hd.translate(dw - 0.055, HT / 2, 0.02);
    doorPut(hd, M.trim); // 손잡이
    const lk = new THREE.BoxGeometry(0.05, 0.05, 0.016);
    lk.translate(dw - 0.055, HT / 2 - 0.2, 0.012);
    doorPut(lk, M.trim); // 잠금
    // 랙 번호 — 문 앞면에 붙어 있으니 문과 함께 돈다. 프레임 자리에 남기면
    // 문이 없어진 자리에 판이 떠 있게 된다.
    const num = new THREE.BoxGeometry(0.1, 0.036, 0.008);
    num.translate(0.115, HT - 0.13, 0.014);
    doorPut(num, M.trim);
  }
}

// 항온항습기(CRAC). **서버실에는 냉방이 있어야 한다.**
function crac(b, w, u, h, M) {
  const WID = 1.0;
  const DEP = 0.75;
  const HT = 2.1;
  const box = (uu, v, y, wid, hh, th, m) => wallBox(b, w, uu, v, y, wid, hh, th, m);

  box(u, DEP / 2, HT / 2, WID, HT, DEP, M.steelDark);
  box(u, DEP + 0.01, HT / 2, WID - 0.06, HT - 0.06, 0.02, M.steel);
  // 흡입 그릴 — 아래 2/3 를 채운 가로 루버. 이게 냉방기의 얼굴이다
  for (let i = 0; i < 16; i++) {
    box(u, DEP + 0.032, 0.28 + i * 0.075, WID - 0.2, 0.05, 0.014, M.rubber);
    box(u, DEP + 0.04, 0.3 + i * 0.075, WID - 0.2, 0.022, 0.01, M.steel);
  }
  // 위쪽 조작반
  box(u, DEP + 0.03, HT - 0.22, 0.42, 0.24, 0.01, M.trim);
  box(u - 0.06, DEP + 0.038, HT - 0.18, 0.2, 0.1, 0.008, M.screen);
  for (let i = 0; i < 3; i++) {
    box(u + 0.13, DEP + 0.038, HT - 0.28 + i * 0.05, 0.03, 0.03, 0.008, i ? M.led : M.ledAmber);
  }
  // 냉매 배관 두 줄 — 천장으로 나간다
  for (const du of [-0.3, 0.3]) {
    const at = wallAt(w, u + du, DEP - 0.12, (HT + h) / 2);
    tube(b, 0.045, h - HT, at, M.steel, 'y', 8);
  }
  // 드레인 — 함체 **밖** 앞모서리를 타고 내려간다. 처음에 v=0.1 (함체 속)
  // 에 넣어 아예 안 보였다.
  const dr = wallAt(w, u + WID / 2 + 0.045, DEP - 0.1, HT / 2);
  tube(b, 0.022, HT, dr, M.trim, 'y', 6);
}

function serverRoom(b, c, M, tally, I) {
  // 랙 열 — 통로 폭 1.2m 를 남긴다. 랙은 약탈(망문)·파괴 대상이라 저마다 노드다.
  //
  // **열은 세로(z)로 달리고, 전 랙이 한 방향(서쪽)을 본다** (2026-08-05
  // 사용자 지시 — 가로 열·콜드/핫 교대 배치를 뒤집었다). 관제실 유리(남쪽)
  // 에서 보면 통로들이 세로로 늘어서고, 통로마다 한쪽 벽은 앞면(표시등),
  // 반대쪽은 뒷면이 된다.
  b.mark('furniture', `racks:${c.id}`);
  const ax = 'z';
  const face = -1; // 전부 서쪽(관제실 문에서 들어와 처음 보는 쪽)을 본다
  const rows = fit(c.x0, c.x1, 2.2, 1.4); // 열이 x 방향으로 늘어선다
  let n = 0;
  rows.forEach((r) => {
    for (const t of fit(c.z0, c.z1, 0.62, 1.6)) {
      const pr = I.spawnPair('rack');
      const seed = ++n; // 두 포즈가 같은 시드 — 유닛 구성이 같아야 같은 랙이다
      serverRack(pr.closed, t, r, ax, face, M, seed);
      serverRack(pr.open, t, r, ax, face, M, seed, 'open');
      tally.rack = (tally.rack ?? 0) + 1;
    }
  });
  b.endMark();

  // ── 냉방 ─────────────────────────────────────────────────────────────
  b.mark('service', `crac:${c.id}`);
  const walls = interiorWalls(c.id).sort((p, q) => q.b - q.a - (p.b - p.a));
  const w = walls[0];
  if (w) {
    const len = w.b - w.a;
    for (const t of fit(0, len, 4.5, 1.2).slice(0, 2)) {
      crac(I.spawn('crac'), w, w.a + t, c.h, M);
      tally.crac = (tally.crac ?? 0) + 1;
    }
  }
  // 급기 덕트 — **통로 위**에 놓는다. 처음에는 랙 열 좌표(r)에 그대로 놓아서
  // 덕트가 통로가 아니라 랙 꼭대기를 달리고 있었다 — 주석("통로 위")과
  // 코드가 달랐다. 단방향 배치라 통로는 이웃한 열 사이마다 하나다.
  for (let i = 0; i + 1 < rows.length; i++) {
    const r = (rows[i] + rows[i + 1]) / 2;
    const y = c.h - 0.3;
    const A = c.z0 + 0.4;
    const B = c.z1 - 0.4;
    b.box(0.34, 0.26, B - A, [r, y, (A + B) / 2], M.steel, 1.2);
    for (const t of fit(A, B, 2.0, 0.6)) {
      b.box(0.26, 0.08, 0.26, [r, y, t], M.steel, 0);
      b.box(0.22, 0.02, 0.22, [r, y - 0.18, t], M.rubber, 0);
    }
  }
  b.endMark();
}

function plaza(b, c, M, tally, I) {
  const cx = (c.x0 + c.x1) / 2;
  const cz = (c.z0 + c.z1) / 2;

  // 안내판 — 기둥에 얹힌 양면 디렉토리 보드. 색띠만 매단 첫 판은 "뭔지
  // 감도 안 온다" 는 지적을 받았다 (#3) — 안내판을 안내판으로 만드는 것:
  // **어두운 보드 + 헤더 띠 + 글줄 + 방향 화살표(삼각 프리즘)**.
  b.mark('landmark', 'plaza:pylon');
  const py = I.spawn('pylon');
  py.box(0.8, 0.1, 0.8, [cx, 0.05, cz], M.steelDark, 0);
  py.box(0.16, 2.5, 0.16, [cx, 1.35, cz], M.steel, 1.0);
  for (const d of [-1, 1]) {
    const z = cz + d * 0.09;
    py.box(1.5, 1.05, 0.05, [cx, 1.9, z], M.crtDark, 0); // 보드
    py.box(1.5, 0.2, 0.024, [cx, 2.35, z + d * 0.02], M.vend, 0); // 헤더 띠
    py.box(1.1, 0.09, 0.012, [cx - 0.08, 2.35, z + d * 0.04], M.paper, 0); // 헤더 글줄
    for (let i = 0; i < 4; i++) {
      const y = 2.1 - i * 0.17;
      // 글줄 — 긴 줄 + 짧은 줄 (표 형태로 읽힌다)
      py.box(0.62, 0.055, 0.012, [cx - 0.1, y, z + d * 0.032], M.paper, 0);
      py.box(0.22, 0.055, 0.012, [cx + 0.42, y, z + d * 0.032], M.paper, 0);
      // 방향 화살표 — 삼각 프리즘. 줄마다 좌우로 번갈아 가리킨다
      const tri = new THREE.CylinderGeometry(0.05, 0.05, 0.016, 3);
      tri.rotateX(Math.PI / 2);
      tri.rotateZ((i % 2 ? -1 : 1) * (Math.PI / 2)); // 꼭짓점이 좌/우
      tri.translate(cx - 0.6, y, z + d * 0.034);
      py.add(tri, M.exit);
    }
  }
  b.endMark();
  tally.pylon = 1;

  // 벤치 — **플라자에는 등질 벽이 없다.**
  //
  // `interiorWalls('plaza')` 는 빈 배열을 돌려준다. 사방이 고리 복도로
  // 트여 있어 바닥 높이에 벽이 하나도 없기 때문이다. 처음에 벽을 물어보고
  // 놓았더니 벤치가 0개였고, 개수를 안 셌으면 못 봤을 것이다.
  // 트인 공간의 벤치는 자립이다 — 기둥을 둘러 앉힌다.
  b.mark('furniture', 'plaza:bench');
  for (const [dx, dz, rot] of [
    [-3.4, 0, 1],
    [3.4, 0, 1],
    [0, -3.4, 0],
    [0, 3.4, 0],
  ]) {
    const x = cx + dx;
    const z = cz + dz;
    const nb = I.spawn('bench');
    nb.box(rot ? 0.52 : 2.0, 0.08, rot ? 2.0 : 0.52, [x, 0.44, z], M.laminate, 0);
    for (const s of [-0.8, 0.8]) {
      nb.box(0.4, 0.4, 0.4, [x + (rot ? 0 : s), 0.2, z + (rot ? s : 0)], M.trim, 0);
    }
    tally.bench = (tally.bench ?? 0) + 1;
  }
  b.endMark();

  // 바닥 표시 — 승강 구역 표시선. 넓은 바닥이 통째로 비면 방향이 안 읽힌다.
  // (지상 전환으로 로비 안내선으로 재해석 예정 — status.md 5.2)
  b.mark('paint', 'plaza:markings');
  for (const dz of [-5.4, 5.4]) {
    b.box(11.0, 0.012, 0.14, [cx, 0.006, cz + dz], M.ledAmber, 0);
    for (const t of fit(cx - 5, cx + 5, 2.2)) {
      b.box(0.5, 0.012, 0.5, [t, 0.006, cz + dz + Math.sign(dz) * 0.5], M.paper, 0);
    }
  }
  b.endMark();

  // 쓰레기통 — 벤치 옆. 사람이 지나는 자리에는 버릴 곳이 있다
  b.mark('furniture', 'plaza:bin');
  for (const [dx, dz] of [[-4.3, 1.2], [4.3, -1.2]]) {
    bin(b, cx + dx, cz + dz, M);
    tally.bin = (tally.bin ?? 0) + 1;
  }
  b.endMark();
}

// 사무 책상 하나. pose 'open' 이면 가운데 서랍이 빠져나와 있다 — 약탈 뒤.
//
// dir 은 **사람이 앉는 쪽**이다 (+1 이면 +z). 포드는 등을 맞댄 책상 넷이라
// 절반이 뒤집혀야 하는데, 조각마다 부호를 손으로 적으면 하나는 반드시
// 틀린다 — 오프셋을 dx()·dz() 로 한 번 뒤집고 조각은 그것만 쓴다
// (샤워 기둥·경첩에서 배운 것과 같은 규칙).
function deskUnit(b, x, z, M, pose = 'closed', dir = 1) {
  const dx = (v) => x + dir * v;
  const dz = (v) => z + dir * v;
  b.box(1.6, 0.05, 0.75, [x, 0.73, z], M.laminate, 0);
  // **서랍장 한 쪽, 관 다리 한 쪽.** 예전에는 양옆이 0.7m 짜리 통판이라
  // 책상 밑이 검은 판때기 둘로 막혀 있었고, 그게 사무실에서 제일 먼저
  // 눈에 걸리는 덩어리였다. 실제 사무 책상은 한쪽만 막혀 있다.
  // 서랍장은 **상판과 같은 라미네이트**다. 어두운 강판으로 뒀더니 알베도가
  // 0.13 이라 책상마다 검은 구멍이 하나씩 뚫린 것처럼 보였다.
  b.box(0.44, 0.64, 0.68, [dx(-0.55), 0.32, z], M.laminate, 0);
  for (const dy of [0.16, 0.38, 0.56]) {
    const out = pose === 'open' && dy === 0.38 ? 0.24 : 0; // 가운데 서랍이 빠져 있다
    b.box(0.38, 0.16, 0.02, [dx(-0.55), dy, dz(0.35 + out)], M.trim, 0);
    b.box(0.14, 0.02, 0.02, [dx(-0.55), dy + 0.05, dz(0.37 + out)], M.steel, 0);
    if (out) {
      // 빠져나온 서랍 몸통 — 옆판 둘 · 바닥 · 어두운 속 · 빈 구멍
      for (const s of [-1, 1]) {
        b.box(0.02, 0.13, out - 0.02, [dx(-0.55) + s * 0.18, dy - 0.005, dz(0.35 + out / 2 - 0.01)], M.trim, 0);
      }
      b.box(0.36, 0.014, out - 0.02, [dx(-0.55), dy - 0.065, dz(0.35 + out / 2 - 0.01)], M.trim, 0);
      b.box(0.33, 0.006, out - 0.05, [dx(-0.55), dy - 0.055, dz(0.35 + out / 2 - 0.01)], M.rubber, 0);
      b.box(0.36, 0.15, 0.01, [dx(-0.55), dy, dz(0.345)], M.rubber, 0); // 서랍이 나간 구멍
    }
  }
  for (const dzv of [-0.28, 0.28]) {
    b.cylinder(0.022, 0.022, 0.71, [dx(0.68), 0.355, z + dzv], M.trim, 6);
  }
  // 뒷 가림판 — 얕게, 뒤로 물려서. 무릎 공간을 안 먹는다
  b.box(1.02, 0.32, 0.03, [dx(0.22), 0.52, dz(-0.31)], M.trim, 0);
}

// ── 큐비클 포드 — 책상 넷이 한 칸막이를 나눠 쓴다 (2026-08-06 사용자 스케치)
//
// 스케치가 말하는 것: **가운데 등판(spine) 하나를 등지고 책상 넷이 마주 본다.**
// 세로 칸막이 셋(양 끝과 가운데)이 좌우를 가르고, 의자는 포드 **바깥**에 있다.
// 책상마다 ㄴ 자를 두르던 첫 판은 칸막이가 책상 수만큼 늘어 복도가 좁았다 —
// 실제 사무실은 넷이 한 벌을 나눠 쓴다.
//
//   POD.w   포드 폭 (세로 칸막이 셋의 간격 x2)
//   deskDX  포드 중심에서 책상 중심까지 (좌우)
//   deskDZ  등판에서 책상 중심까지 — 상판 뒤 모서리가 등판에 거의 닿는다
const POD = { w: 3.6, deskDX: 0.9, deskDZ: 0.475, half: 1.15 };

// 포드 중심 x. 간격 5.5 는 **포드 폭 3.6 + 회의 탁자가 설 여유**다 —
// 3.9 로 촘촘히 넣으면 포드가 하나 더 들어가는 대신 방 끝이 꽉 차서
// 회의 탁자가 설 자리가 없어진다 (사용자가 둘 다 요청했다).
const deskPods = (c) => fit(c.x0, c.x1, 5.5, 1.2);

// 회의 코너와 맞닿은 **서쪽 포드는 가까운 열을 내준다** (2026-08-06 사용자
// 지시 — 평면에 X 로 표시). 6인 원탁이 앉으려면 폭이 필요하고, 그 폭은
// 서쪽 벽과 포드 사이 2.25m 로는 안 나온다. 그 포드는 2인 반쪽이 된다.
const halfPodX = (c) => {
  const pods = deskPods(c);
  return pods.length > 1 ? Math.min(...pods) : null;
};

// 책상 자리 — [x, z, dir]. 사무실과 시작 방의 전/후가 **같은 좌표**를 쓴다.
function deskSeats(c) {
  const out = [];
  const pz = (c.z0 + c.z1) / 2;
  const half = halfPodX(c);
  for (const px of deskPods(c)) {
    for (const sx of px === half ? [1] : [-1, 1]) {
      for (const dir of [1, -1]) out.push([px + sx * POD.deskDX, pz + dir * POD.deskDZ, dir]);
    }
  }
  return out;
}

// 파티션 칸막이 하나 — 책상을 ㄴ 자로 감싼다 (2026-08-06 사용자 지시).
//
// **책상 줄만 늘어놓으면 교실이다.** 90년대 후반 사무실은 큐비클이고, 그
// 인상은 천 패널과 알루미늄 테가 만든다. 파티션을 파티션으로 만드는 조각 넷
// (lessons 3.13.1 — 이것에 대고 확인한다):
//
//   1. **천 패널** — 무광. 판때기가 아니라 천이어야 사무 가구다
//   2. **알루미늄 테** — 상단 레일과 세로 기둥. 이게 없으면 그냥 벽이다
//   3. **바닥 발** — 패널이 바닥에 직접 안 닿는다. 그 틈으로 바닥이 이어진다
//   4. **모서리 기둥** — 두 패널이 만나는 자리. 없으면 판 둘이 스친 것이다
//
// 포드 하나의 칸막이 — **등판 하나 + 세로 칸막이 셋**.
// half 면 오른쪽 절반만 짓는다 (서쪽 열을 회의 코너에 내준 2인 포드).
const PART_H = 1.35;
function podPartition(b, px, pz, M, half = false) {
  const T = 0.05; // 패널 두께
  const y0 = 0.09; // 바닥 발 높이 — 패널은 여기서 시작한다
  const cy = y0 + (PART_H - y0) / 2;
  const panel = (w2, d2, cx2, cz2) => {
    b.box(w2, PART_H - y0, d2, [cx2, cy, cz2], M.plastic, 0); // 천
    b.box(w2 + 0.02, 0.045, d2 + 0.02, [cx2, PART_H, cz2], M.trim, 0); // 상단 레일
  };
  // 등판 — 포드를 가로지른다. 책상 넷이 이것을 등지고 앉는다
  const ks = half ? [0, 1] : [-1, 0, 1];
  panel(half ? POD.w / 2 : POD.w, T, half ? px + POD.w / 4 : px, pz);
  // 세로 칸막이 — 양 끝과 가운데. 좌우 자리를 가른다
  for (const k of ks) {
    const sx = px + k * (POD.w / 2);
    panel(T, POD.half * 2, sx, pz);
    // 기둥 — 세로 칸막이의 양 끝. 이게 없으면 판이 허공에서 끝난다
    for (const s of [-1, 1]) {
      b.box(0.06, PART_H + 0.02, 0.06, [sx, (PART_H + 0.02) / 2, pz + s * POD.half], M.trim, 0);
      b.box(0.14, y0, 0.1, [sx, y0 / 2, pz + s * (POD.half - 0.12)], M.steelDark, 0); // 발
    }
    // 등판과 만나는 자리의 기둥 — 십자 교차를 하나로 묶는다
    b.box(0.075, PART_H + 0.03, 0.075, [sx, (PART_H + 0.03) / 2, pz], M.trim, 0);
  }
}

function office(b, c, M, tally, I) {
  // 책상(서랍 약탈)·브라운관(파괴)·의자(파괴)는 서로 다른 상호작용이므로
  // 각각 노드다 — 책상을 부숴도 브라운관은 남는다.
  b.mark('furniture', `desks:${c.id}`);
  const pz0 = (c.z0 + c.z1) / 2;
  const halfX = halfPodX(c);
  for (const px of deskPods(c)) {
    podPartition(b, px, pz0, M, px === halfX);
    tally.partition = (tally.partition ?? 0) + 1;
  }
  for (const [x, z, dir] of deskSeats(c)) {
    const dx = (v) => x + dir * v;
    const dz = (v) => z + dir * v;
    const pr = I.spawnPair('desk');
    deskUnit(pr.closed, x, z, M, 'closed', dir);
    deskUnit(pr.open, x, z, M, 'open', dir);
    // 브라운관과 자판 — 90년대 후반이다. 화면은 앉은 쪽(dir)을 본다.
    terminal(I.spawn('crt'), x, 0.755, dz(-0.14), dir, M);
    // 의자 — 책상을 본다 (앉은 쪽에서 책상 쪽으로 돌린다)
    chair(I.spawn('chair'), [x, 0, dz(0.78)], dir > 0 ? Math.PI : 0, M, M.plasticWarm, true);
    // 책상 위 잔소품 — 자리마다 다르다. 전부 있으면 전시장이고 전부 없으면
    // 아무도 안 쓰던 층이다. 마우스·자판을 피한 자리에 놓는다.
    const rc2 = hash2(Math.round(x * 17), Math.round(z * 13));
    if (rc2 > 0.4) mug(b, dx(0.55), 0.755, dz(0.05), M, rc2 > 0.72 ? M.porcelain : M.plasticWarm);
    if (hash2(Math.round(x * 7), Math.round(z * 23)) > 0.45) paperPile(b, dx(-0.33), 0.755, dz(0.12), M, Math.round(x * 3 + z * 5));
    // 필기도구와 신문 — 자리마다 다르게 (사용자 지시)
    if (rc2 > 0.5) pencilCup(b, dx(0.68), 0.755, dz(-0.18), M);
    if (rc2 < 0.32) newspaper(b, dx(0.2), 0.756, dz(0.2), (rc2 - 0.15) * 4, M);
    tally.desk = (tally.desk ?? 0) + 1;
  }
  b.endMark();

  // ── 책장과 회의 탁자 (2026-08-06 사용자 지시) ─────────────────────────
  //
  // 사무실은 책상만 있으면 **자료가 없는 방**이다. 벽 하나를 책장으로 채우고,
  // 남는 구석에 회의 탁자를 둔다 — 사람이 모여 이야기하던 흔적.
  const shelfWall = interiorWalls(c.id)
    .filter((q) => q.rule === 'solid' && q.b - q.a > 2.2)
    .sort((p, q) => q.b - q.a - (p.b - p.a))[0];
  if (shelfWall) {
    b.mark('furniture', `bookcase:${c.id}`);
    const sw = shelfWall;
    const LV = [0.35, 0.72, 1.09, 1.46];
    for (const t of fit(0, sw.b - sw.a, 1.1, 0.5).slice(0, 4)) {
      const u = sw.a + t;
      // 몸통 — 옆판 둘·등판·천판. 통짜 상자로 두면 책이 벽에 박힌 것이 된다
      for (const s of [-1, 1]) wallBox(b, sw, u + s * 0.52, 0.19, 0.92, 0.04, 1.84, 0.34, M.laminate);
      wallBox(b, sw, u, 0.04, 0.92, 1.0, 1.84, 0.03, M.laminate); // 등판
      wallBox(b, sw, u, 0.19, 1.83, 1.08, 0.04, 0.36, M.laminate); // 천판
      wallBox(b, sw, u, 0.19, 0.03, 1.08, 0.06, 0.36, M.trim); // 굽
      for (const y of LV) {
        wallBox(b, sw, u, 0.19, y, 1.0, 0.03, 0.32, M.laminate); // 선반
        bookRow(b, sw, u - 0.5, 1.0, y + 0.015, M, Math.round(u * 13) + Math.round(y * 7));
      }
      // 맨 위 칸에는 서류철 대신 접힌 신문 — 사무실의 잡동사니
      const [nx, , nz] = wallAt(sw, u - 0.28, 0.19, 0);
      newspaper(b, nx, 1.845, nz, 0.2, M);
      tally.bookcase = (tally.bookcase ?? 0) + 1;
    }
    b.endMark();
  }

  // ── 회의 코너 — 포드 줄 **서쪽**의 빈 자리 (2026-08-06 사용자 지시) ────
  //
  // 사용자가 평면에서 이 구역을 짚었다: 서쪽 벽과 첫 포드 사이가 비어 있었다.
  // 첫 판은 **긴 탁자를 좁은 띠에 세로로** 끼워 넣었는데, 폭 2.25m 라 의자가
  // 벽과 칸막이에 끼었다. 지시대로 다시 지었다 —
  //   · 서쪽 포드가 가까운 열을 내주어 폭이 4.4m 로 넓어졌다 (halfPodX)
  //   · 탁자는 **6인 원탁**. 좁은 띠가 아니라 트인 구역이 됐으니 방향이 없는
  //     형태가 맞다 — 여섯이 둘러앉는 자리에 모서리는 필요 없다
  //   · **화이트보드는 북쪽(복도 쪽) 벽**으로 옮겼다. 원탁에서 고개만 돌리면
  //     보이고, 긴 벽이라 판이 벽을 다 먹지 않는다
  {
    const halfX = halfPodX(c);
    const pods = deskPods(c);
    // 반쪽 포드는 칸막이가 **중심(px)** 에서 시작한다 — 온전한 포드였다면
    // px - POD.w/2 다. 회의 코너의 동쪽 끝은 그 칸막이 자리에서 잰다.
    const podEdge = halfX !== null ? halfX : (pods.length ? Math.min(...pods) - POD.w / 2 : c.x1);
    const xa = c.x0 + 0.4;
    const xb = podEdge - 0.35;
    const mx = (xa + xb) / 2;
    const mz = (c.z0 + c.z1) / 2;
    if (xb - xa > 3.0) {
      b.mark('furniture', `meeting:${c.id}`);
      // ── 6인 회의 탁자 — **모서리가 둥근 직사각** (사용자 스케치) ───────
      //
      // 원탁에서 이 형태로 바꿨다. 긴 변에 둘씩·양 끝에 하나씩 = 여섯이고,
      // 긴 직선 변이 있어야 노트북과 서류가 나란히 놓인다 (원탁은 가장자리가
      // 늘 비스듬해서 자리가 어긋난다).
      //
      // 탁자를 탁자로 만드는 것: 둥근 상판 · **옆 몰딩**(없으면 판때기) ·
      // 외기둥 둘(다리 넷은 긴 변에 앉은 사람 무릎에 걸린다) · 바닥 받침.
      const TW = 1.4; // 폭 (x)
      const TL = 2.6; // 길이 (z)
      const RR = 0.35; // 모서리 반지름
      const mt = I.spawn('table');
      roundedSlab(mt, mx, mz, TW, TL, RR, 0.735, 0.05, M.laminate, 7); // 상판
      roundedSlab(mt, mx, mz, TW + 0.024, TL + 0.024, RR + 0.012, 0.7, 0.032, M.trim, 7); // 옆 몰딩
      for (const sz of [-1, 1]) {
        const pz2 = mz + sz * (TL / 2 - 0.62);
        tube(mt, 0.1, 0.62, [mx, 0.38, pz2], M.trim, 'y', 10); // 외기둥
        tube(mt, 0.17, 0.05, [mx, 0.65, pz2], M.trim, 'y', 10, true); // 상부 플랜지
        mt.box(0.62, 0.05, 0.34, [mx, 0.03, pz2], M.steelDark, 0); // 바닥 받침
        mt.box(0.44, 0.04, 0.24, [mx, 0.07, pz2], M.steelDark, 0); // 굽 단
      }
      // 의자 여섯 — 긴 변에 둘씩, 양 끝에 하나씩. 앉은 사람은 탁자를 본다
      const seatsAt = [];
      for (const sx of [-1, 1]) {
        for (const dz of [-0.62, 0.62]) {
          seatsAt.push([mx + sx * (TW / 2 + 0.42), mz + dz, sx > 0 ? -Math.PI / 2 : Math.PI / 2]);
        }
      }
      for (const sz of [-1, 1]) {
        seatsAt.push([mx, mz + sz * (TL / 2 + 0.42), sz > 0 ? Math.PI : 0]);
      }
      for (const [sx2, sz2, face] of seatsAt) {
        chair(I.spawn('chair'), [sx2, 0, sz2], face, M, M.plastic);
      }
      // 탁자 위 — 자리마다 다른 것이 놓인다 (여섯 자리를 다 채우면 전시장이다).
      // 앉은 자리 안쪽으로 당겨 놓는다: 화면·서류는 그 사람 앞이다.
      laptop(b, mx - 0.34, 0.765, mz - 0.62, Math.PI / 2, M);
      laptop(b, mx + 0.34, 0.765, mz + 0.62, -Math.PI / 2, M);
      paperPile(b, mx + 0.36, 0.765, mz - 0.6, M, 71);
      mug(b, mx + 0.2, 0.765, mz - 0.34, M, M.porcelain);
      mug(b, mx - 0.28, 0.765, mz + 0.3, M, M.plasticWarm);
      newspaper(b, mx - 0.06, 0.766, mz + 1.02, 0.15, M);
      pencilCup(b, mx + 0.12, 0.765, mz + 0.02, M);
      b.endMark();
      tally.meeting = (tally.meeting ?? 0) + 1;

      // 화이트보드 — **북쪽(복도 쪽) 벽**. 원탁 정면이고, 문에서 먼 조각을 고른다
      const ww = interiorWalls(c.id)
        .filter((q) => q.axis === 'x' && q.b - q.a > 2.8)
        .sort((p, q) => p.at - q.at)[0];
      if (ww) {
        b.mark('sign', `whiteboard:${c.id}`);
        whiteboard(b, ww, Math.min(Math.max(mx, ww.a + 1.4), ww.b - 1.4), M);
        b.endMark();
        tally.whiteboard = (tally.whiteboard ?? 0) + 1;
      }
    }
  }

  // 벽시계 하나와 문가 쓰레기통 — 사무실의 기본 장비
  b.mark('furniture', `clutter:${c.id}`);
  const cw = interiorWalls(c.id).filter((q) => q.rule === 'solid').sort((p, q) => q.b - q.a - (p.b - p.a))[0];
  if (cw) {
    wallClock(b, cw, (cw.a + cw.b) / 2, M);
    tally.clock = (tally.clock ?? 0) + 1;
  }
  bin(b, c.x0 + 0.45, c.z0 + 0.45, M);
  tally.bin = (tally.bin ?? 0) + 1;
  b.endMark();
}

// 골판지 상자 하나.
//
// **흰 상자는 상자가 아니다.** 예전에는 선반마다 같은 크기의 흰 육면체가
// 같은 높이에 하나씩 놓여 있었다. 골판지를 골판지로 만드는 것은 셋이다.
//   1. 크라프트 색 — 흰색이 아니다
//   2. 뚜껑 **접힌 자리**와 그 위를 가로지르는 **테이프**
//   3. 앞면의 **라벨**
// 여기에 크기·각도·개수가 제각각이어야 창고로 보인다.
function carton(b, at, size, yaw, M, pose = 'closed') {
  const [w, h, d] = size;
  const [x, y, z] = at;
  const c = Math.cos(yaw);
  const s = Math.sin(yaw);
  // 로컬 (dx,dz) -> 세계. g.rotateY 와 같은 변환이어야 한다.
  const p = (dx, dy, dz) => [x + dx * c + dz * s, y + dy, z - dx * s + dz * c];

  boxAt(b, w, h, d, p(0, h / 2, 0), M.carton, yaw);
  // 라벨 — 앞면에 붙는다 (두 포즈 공통)
  boxAt(b, w * 0.4, h * 0.3, 0.006, p(0, h * 0.55, d / 2 + 0.003), M.paper, yaw);

  if (pose === 'closed') {
    // 뚜껑 접힌 자리 (길이 방향) 와 그 위를 가로지르는 테이프
    boxAt(b, w * 0.99, 0.008, 0.014, p(0, h + 0.001, 0), M.cartonDark, yaw);
    boxAt(b, w * 0.26, 0.005, d * 1.004, p(0, h + 0.004, 0), M.paper, yaw);
    return;
  }

  // ── 열림 — 약탈 뒤 ────────────────────────────────────────────────────
  // 속의 어두운 바닥이 "비었다" 를 말하고, 젖혀진 네 짝이 "열렸다" 를 말한다.
  boxAt(b, w - 0.02, 0.006, d - 0.02, p(0, h - 0.05, 0), M.cartonDark, yaw);
  // 로컬에서 짓고 상자의 yaw 로 한 번에 옮긴다 (p 와 같은 변환).
  const put = (g, m) => {
    g.rotateY(yaw);
    g.translate(x, y, z);
    b.add(g, m);
  };
  const F = 1.22; // 수직에서 바깥으로 20도 젖힘
  for (const sgn of [1, -1]) {
    // 긴 변의 두 짝 (±z 테두리에 경첩)
    const fd = (d / 2) * 0.96;
    const gz = new THREE.BoxGeometry(w * 0.98, 0.008, fd);
    gz.translate(0, 0, (sgn * fd) / 2); // 경첩변을 원점에
    gz.rotateX(-sgn * F);
    gz.translate(0, h, (sgn * d) / 2);
    put(gz, M.carton);
    // 짧은 변의 두 짝 (±x 테두리에 경첩)
    const fw = (w / 2) * 0.96;
    const gx = new THREE.BoxGeometry(fw, 0.008, d * 0.98);
    gx.translate((sgn * fw) / 2, 0, 0);
    gx.rotateZ(sgn * F);
    gx.translate((sgn * w) / 2, h, 0);
    put(gx, M.carton);
  }
}

// 플라스틱 상자 하나. pose 'open' 이면 뚜껑이 비스듬히 걸쳐지고 속이 비어
// 보인다 — 선반 위라 뚜껑을 옆에 내려놓을 자리가 없다.
function crate(b, at, yaw, M, pose = 'closed') {
  const [x, y, z] = at; // y 는 상자 바닥 (선반 면)
  const [bw, bh, bd] = [0.4, 0.26, 0.34];
  boxAt(b, bw, bh, bd, [x, y + bh / 2, z], M.crate, yaw);
  if (pose === 'closed') {
    boxAt(b, bw + 0.03, 0.035, bd + 0.03, [x, y + bh, z], M.crate, yaw);
    return;
  }
  // 속 — 어두운 바닥
  boxAt(b, bw - 0.06, 0.01, bd - 0.06, [x, y + bh - 0.06, z], M.rubber, yaw);
  // 뚜껑 — 테두리에 비스듬히 걸쳐 있다
  const g = new THREE.BoxGeometry(bw + 0.03, 0.035, bd + 0.03);
  g.rotateX(-0.55);
  g.translate(0, bh + 0.05, -0.07);
  g.rotateY(yaw);
  g.translate(x, y, z);
  b.add(g, M.crate);
}

function storage(b, c, M, tally, I) {
  // 선반 — 벽을 따라. 통로는 비운다. 선반 틀은 배경이고 **상자가 약탈
  // 대상**이다 — 뚜껑 열림 포즈를 받을 것은 상자다.
  b.mark('furniture', `shelf:${c.id}`);
  const LEVELS = [0.4, 0.95, 1.5, 2.05];
  let bay = 0;
  for (const w of interiorWalls(c.id)) {
    const len = w.b - w.a;
    for (const t of fit(0, len, 1.05, 0.6).map((v) => v / len)) {
      const u = w.a + len * t;
      bay++;
      for (const y of LEVELS) wallBox(b, w, u, 0.32, y, 0.98, 0.04, 0.58, M.steelDark);
      for (const s of [-0.47, 0.47]) {
        wallBox(b, w, u + s, 0.32, 1.12, 0.05, 2.24, 0.05, M.steelDark);
      }

      // ── 무엇이 얹히나 ─────────────────────────────────────────────────
      //
      // 층마다 따로 뽑는다. **좌표 해시**를 쓴다 — 난수를 쓰면 선반 하나를
      // 더하거나 빼는 순간 뒤의 모든 상자가 다시 뽑힌다 (lessons.md 2.1 의 6).
      for (let L = 0; L < LEVELS.length; L++) {
        const y = LEVELS[L] + 0.02;
        const r0 = hash2(bay * 7 + L, Math.round(w.at * 13));
        if (r0 < 0.18) continue; // 빈 칸 — 창고가 꽉 차 있으면 창고가 아니다
        // 한 칸 걸러 **통조림 줄** — 비상 식량 창고의 표식이다. 상자만
        // 쌓여 있으면 이삿짐이고, 캔이 보여야 "먹을 것이 있는 방" 이다
        // (챕터 0 디테일 패스 — 크래프팅 재료의 시각적 근거이기도 하다).
        if (r0 > 0.44 && r0 < 0.62) {
          const rows = 2;
          for (let q = 0; q < rows; q++) {
            for (let k = 0; k < 5; k++) {
              const rr = hash2(bay * 13 + L * 3 + k, q * 7 + 5);
              if (rr < 0.15) continue; // 빠진 자리
              const [px, , pz] = wallAt(w, u - 0.34 + k * 0.17, 0.22 + q * 0.2, 0);
              can(b, px, y, pz, 0.038, 0.105, M, rr > 0.5 ? M.vend : M.warn);
              tally.canned = (tally.canned ?? 0) + 1;
            }
          }
          continue;
        }
        const n = r0 < 0.55 ? 1 : 2;
        for (let i = 0; i < n; i++) {
          const r = hash2(bay * 31 + L * 5 + i, Math.round(w.at * 7) + i);
          const off = n === 1 ? (r - 0.5) * 0.3 : (i - 0.5) * 0.44;
          const yaw = (hash2(bay + i * 3, L * 11) - 0.5) * 0.34;
          const uu = u + off;
          // **[x, y, z] 다.** 처음에 `const [px, pz] = ...` 로 받아서 pz 에
          // y(=0) 가 들어갔고, 상자 백여 개가 z=0 즉 옆방 카페테리아 한가운데
          // 공중에 떠 있었다. 같은 파일의 onWall 은 [x, z] 를 돌려주므로
          // 규약이 둘이다 — 헷갈리면 통째로 받아 쓴다.
          const [px, , pz] = wallAt(w, uu, 0.32 + (r - 0.5) * 0.06, 0);
          // 벽 방향에 맞춰 상자의 긴 변을 돌리고, **라벨(로컬 +z)이 방
          // 안쪽을 보게** 한다. inward 를 안 보면 절반이 벽을 보고 붙는다.
          const base =
            w.axis === 'x' ? (w.inward > 0 ? 0 : Math.PI) : (w.inward > 0 ? Math.PI / 2 : -Math.PI / 2);

          if (r > 0.82) {
            // 플라스틱 상자 — 테두리가 있어 골판지와 실루엣이 다르다
            const pr = I.spawnPair('crate');
            crate(pr.closed, [px, y, pz], base + yaw, M);
            crate(pr.open, [px, y, pz], base + yaw, M, 'open');
          } else {
            const h = 0.22 + r * 0.2;
            const size = [0.3 + r * 0.2, h, 0.3 + (1 - r) * 0.14];
            const pr = I.spawnPair('carton');
            carton(pr.closed, [px, y, pz], size, base + yaw, M);
            carton(pr.open, [px, y, pz], size, base + yaw, M, 'open');
            // 위에 하나 더 얹힌 것도 있다 — 따로 약탈되므로 따로 노드다
            if (r > 0.6 && h < 0.3) {
              const pr2 = I.spawnPair('carton');
              carton(pr2.closed, [px, y + h + 0.005, pz], [0.26, 0.18, 0.28], base - yaw * 1.6, M);
              carton(pr2.open, [px, y + h + 0.005, pz], [0.26, 0.18, 0.28], base - yaw * 1.6, M, 'open');
            }
          }
        }
      }
      tally.shelf = (tally.shelf ?? 0) + 1;
    }
  }
  b.endMark();

  // ── 청소 코너 (2026-08-06 사용자 지시) ────────────────────────────────
  //
  // 청소도구함(양문 캐비넷) · 밀대 · **바퀴 달린 물통** · 락스. 창고는
  // 물건을 쌓아 두는 곳이자 **건물을 관리하는 도구가 사는 곳**이다.
  b.mark('furniture', `cleaning:${c.id}`);
  const cw2 = interiorWalls(c.id)
    .filter((q) => q.rule === 'solid' && q.b - q.a > 1.4)
    .sort((p, q) => q.b - q.a - (p.b - p.a))[0];
  if (cw2) {
    // 양문 캐비넷 — 몸통 판 다섯 + 선반 + 문 두 짝(손잡이 마주 봄).
    // 통짜 상자에 선을 그으면 문이 아니다 (#1 사물함과 같은 규칙).
    const cu = cw2.a + 0.9;
    const CH = 1.95;
    const CWd = 1.0;
    wallBox(b, cw2, cu, 0.035, CH / 2 + 0.05, CWd, CH, 0.03, M.steelDark); // 등판
    for (const s of [-1, 1]) wallBox(b, cw2, cu + s * (CWd / 2 - 0.015), 0.28, CH / 2 + 0.05, 0.03, CH, 0.5, M.steelDark);
    wallBox(b, cw2, cu, 0.28, CH + 0.035, CWd, 0.03, 0.5, M.steelDark); // 천판
    wallBox(b, cw2, cu, 0.28, 0.06, CWd, 0.03, 0.5, M.steelDark); // 바닥판
    for (const y of [0.75, 1.35]) wallBox(b, cw2, cu, 0.28, y, CWd - 0.06, 0.02, 0.46, M.steel); // 선반
    // 속 — 락스병 줄과 걸레 뭉치
    for (let k = 0; k < 3; k++) {
      const [px, , pz] = wallAt(cw2, cu - 0.3 + k * 0.22, 0.28, 0);
      tube(b, 0.045, 0.24, [px, 0.89, pz], k === 1 ? M.warn : M.paper, 'y', 8);
      tube(b, 0.02, 0.05, [px, 1.03, pz], M.trim, 'y', 6);
    }
    wallBox(b, cw2, cu + 0.2, 0.28, 1.44, 0.34, 0.16, 0.3, M.plasticWarm); // 걸레 뭉치
    // 문 두 짝 — 몸통 앞면(0.53)보다 돌출. 손잡이는 가운데서 마주 본다
    for (const s of [-1, 1]) {
      wallBox(b, cw2, cu + s * CWd / 4, 0.545, CH / 2 + 0.05, CWd / 2 - 0.02, CH - 0.08, 0.024, M.steel);
      wallBox(b, cw2, cu + s * 0.07, 0.565, 1.0, 0.025, 0.16, 0.025, M.trim);
      // 통풍 루버 — 젖은 것을 넣는 함이라 반드시 있다
      for (let i = 0; i < 3; i++) {
        wallBox(b, cw2, cu + s * CWd / 4, 0.56, 1.72 - i * 0.06, CWd / 2 - 0.16, 0.016, 0.008, M.rubber);
      }
    }
    tally.cleanCab = 1;

    // 밀대 — 자루(긴 관)와 대걸레 머리. 캐비넷 옆에 기대 세운다
    {
      const [bx4, , bz4] = wallAt(cw2, cu + 0.78, 0.22, 0);
      const g = new THREE.CylinderGeometry(0.016, 0.016, 1.5, 6);
      g.rotateX(0.12);
      g.translate(bx4, 0.78, bz4);
      b.add(g, M.trim);
      const head = new THREE.CylinderGeometry(0.09, 0.07, 0.22, 8);
      head.translate(bx4 + 0.04, 0.11, bz4 + 0.09);
      b.add(head, M.paper);
      tally.mop = (tally.mop ?? 0) + 1;
    }
    // 바퀴 달린 물통 — 통 + 짜개(윗틀) + **바퀴 넷**. 바퀴가 없으면 그냥 통이다
    {
      const [wx, , wz] = wallAt(cw2, cu + 1.25, 0.5, 0);
      tube(b, 0.24, 0.42, [wx, 0.29, wz], M.vendBlue, 'y', 10);
      tube(b, 0.25, 0.04, [wx, 0.5, wz], M.trim, 'y', 10, true); // 테두리
      tube(b, 0.19, 0.05, [wx, 0.45, wz], M.rubber, 'y', 10, true); // 물
      // 짜개 — 통 위에 얹힌 사다리꼴 틀
      const wr = new THREE.CylinderGeometry(0.1, 0.2, 0.26, 4, 1, true);
      wr.rotateY(Math.PI / 4);
      wr.translate(wx, 0.63, wz + 0.02);
      b.add(wr, M.plasticWarm);
      for (const [sx4, sz4] of [[-0.16, -0.16], [0.16, -0.16], [-0.16, 0.16], [0.16, 0.16]]) {
        const wh = new THREE.CylinderGeometry(0.05, 0.05, 0.03, 8);
        wh.rotateZ(Math.PI / 2);
        wh.translate(wx + sx4, 0.05, wz + sz4);
        b.add(wh, M.rubber);
      }
      tally.bucket = (tally.bucket ?? 0) + 1;
    }
  }
  b.endMark();
}

// 배전반 하나.
//
// **이게 이 방의 정체다.** 예전에는 벽에 검은 판때기가 붙어 있을 뿐이라
// 방이 무슨 방인지 알 수 없었다. 배전반을 배전반으로 만드는 것 넷:
//   1. **여닫는 문** — 세로 이음선 · 경첩 · 손잡이 · 잠금
//   2. **통풍 루버** — 열이 나는 물건이라 반드시 있다
//   3. **경고 딱지** — 노란 바탕. 멀리서도 이것 하나로 읽힌다
//   4. **위로 나가는 전선관** — 벽에 붙은 상자와 배전반을 가르는 결정적 조각
function panel(b, w, u, h, M, pose = 'closed') {
  const WID = 0.86;
  const DEP = 0.26;
  const y0 = 0.45;
  const HT = 1.5;
  const cy = y0 + HT / 2;
  const box = (uu, v, y, wid, hh, th, m) => wallBox(b, w, uu, v, y, wid, hh, th, m);

  box(u, DEP / 2, cy, WID, HT, DEP, M.steelDark); // 함체

  // 경첩 — 왼쪽 모서리에 셋 (몸통 쪽 반절이라 두 포즈가 같다)
  for (const dy of [-0.55, 0, 0.55]) {
    const at = wallAt(w, u - WID / 2 + 0.03, DEP + 0.02, cy + dy);
    tube(b, 0.018, 0.09, at, M.trim, 'y', 5, true);
  }

  // **전선관** — 함체 위로 나가 천장으로 들어간다. 이게 있어야 배전반이다.
  for (const du of [-0.2, 0.2]) {
    const top = y0 + HT;
    const at = wallAt(w, u + du, DEP / 2, (top + h) / 2);
    tube(b, 0.032, h - top, at, M.trim, 'y', 6);
    const el = wallAt(w, u + du, DEP / 2, top + 0.02);
    tube(b, 0.045, 0.06, el, M.trim, 'y', 6, true);
  }

  if (pose === 'closed') {
    box(u, DEP + 0.012, cy, WID - 0.04, HT - 0.04, 0.024, M.steel); // 문 두 짝
    box(u, DEP + 0.026, cy, 0.014, HT - 0.06, 0.01, M.steelDark); // 가운데 이음선
    // 손잡이와 잠금 — 오른쪽
    box(u + WID / 2 - 0.09, DEP + 0.055, cy, 0.028, 0.34, 0.028, M.trim);
    box(u + WID / 2 - 0.09, DEP + 0.03, cy + 0.24, 0.05, 0.05, 0.02, M.trim);
    // 통풍 루버 — 위쪽에 다섯 줄
    for (let i = 0; i < 5; i++) {
      box(u - 0.16, DEP + 0.028, cy + 0.56 - i * 0.045, 0.4, 0.018, 0.012, M.rubber);
    }
    // 경고 딱지 — 노란 바탕에 검은 심볼
    box(u + 0.22, DEP + 0.028, cy + 0.5, 0.17, 0.17, 0.008, M.warn);
    box(u + 0.22, DEP + 0.034, cy + 0.5, 0.075, 0.09, 0.006, M.rubber);
    // 명판
    box(u - 0.24, DEP + 0.028, cy - 0.58, 0.26, 0.07, 0.006, M.paper);
    // 계기 둘과 표시등 셋 — 문 앞면에. 열림에서는 문짝 로컬로 옮겨 함께 돈다
    for (const du of [-0.06, 0.1]) {
      const at = wallAt(w, u + du, DEP + 0.04, cy + 0.16);
      tube(b, 0.05, 0.03, at, M.paper, w.axis === 'x' ? 'z' : 'x', 8, true);
      tube(b, 0.056, 0.014, at, M.trim, w.axis === 'x' ? 'z' : 'x', 8, true);
    }
    for (let i = 0; i < 3; i++) {
      box(u - 0.3 + i * 0.06, DEP + 0.034, cy + 0.16, 0.028, 0.028, 0.008, i === 1 ? M.ledAmber : M.led);
    }
    return;
  }

  // ── 열림 — 약탈 뒤. "살짝 열려 있다" 가 상태 표식이다 ──────────────────
  // 속: 어두운 안쪽 패널과 차단기 줄 셋 (문이 열려야 보이는 것)
  box(u, DEP - 0.06, cy, WID - 0.1, HT - 0.1, 0.02, M.rubber);
  for (let i = 0; i < 3; i++) {
    box(u, DEP - 0.035, cy - 0.18 - i * 0.24, WID - 0.34, 0.11, 0.02, M.steelDark);
  }

  // 문 두 짝 — 경첩축(양 모서리)으로 벌어진다. 왼짝이 더 열려 "누가 열었다".
  //
  // **앞면 디테일은 문의 것이다.** 루버·딱지·명판·계기·표시등·손잡이를 문짝
  // 로컬에서 지어 문과 함께 돌린다 — 처음에 문짝을 민판으로 뒀더니 열자마자
  // 앞면이 통째로 사라진 것처럼 보였다. 닫힘과 같은 조각·같은 자리이고,
  // 닫힘의 (du, v) 를 문짝 로컬로 옮기는 식은 x = du − 경첩, z = v − DEP 다.
  const lw = (WID - 0.04) / 2;
  const hingeU = (side) => -side * (WID / 2 - 0.02);
  for (const [side, swing] of [
    [1, 0.62],
    [-1, 0.26],
  ]) {
    const parts = [];
    const pbox = (lx, ly, lz, wid, hh, th, m) => {
      const g = new THREE.BoxGeometry(wid, hh, th);
      g.translate(lx, ly, lz);
      parts.push([g, m]);
    };
    const gauge = (lx) => {
      // 계기 — 닫힘의 tube 쌍과 같은 조각. 축이 문짝 로컬 +z(앞) 다.
      for (const [r, len, m] of [[0.05, 0.03, M.paper], [0.056, 0.014, M.trim]]) {
        const g = new THREE.CylinderGeometry(r, r, len, 8);
        g.rotateX(Math.PI / 2);
        g.translate(lx, cy + 0.16, 0.04);
        parts.push([g, m]);
      }
    };
    const L = (du) => du - hingeU(side); // 닫힘의 du -> 문짝 로컬 x

    pbox((side * lw) / 2, cy, 0.012, lw, HT - 0.04, 0.024, M.steel); // 판
    if (side === 1) {
      // 왼짝: 루버 · 명판 · 표시등 셋 · 계기 하나
      // (루버는 닫힘에서 이음선을 살짝 넘는다 — 문짝 폭에 맞춰 0.34 로 줄인다)
      for (let i = 0; i < 5; i++) pbox(L(-0.17), cy + 0.56 - i * 0.045, 0.028, 0.34, 0.018, 0.012, M.rubber);
      pbox(L(-0.24), cy - 0.58, 0.028, 0.26, 0.07, 0.006, M.paper);
      for (let i = 0; i < 3; i++) {
        pbox(L(-0.3 + i * 0.06), cy + 0.16, 0.034, 0.028, 0.028, 0.008, i === 1 ? M.ledAmber : M.led);
      }
      gauge(L(-0.06));
    } else {
      // 오른짝: 딱지 · 계기 하나 · 손잡이 · 잠금
      pbox(L(0.22), cy + 0.5, 0.028, 0.17, 0.17, 0.008, M.warn);
      pbox(L(0.22), cy + 0.5, 0.034, 0.075, 0.09, 0.006, M.rubber);
      pbox(L(WID / 2 - 0.09), cy, 0.055, 0.028, 0.34, 0.028, M.trim);
      pbox(L(WID / 2 - 0.09), cy + 0.24, 0.03, 0.05, 0.05, 0.02, M.trim);
      gauge(L(0.1));
    }

    for (const [g, m] of parts) {
      g.rotateY(-side * swing); // 바깥(방 안쪽)으로 연다
      g.translate(hingeU(side), 0, DEP);
      wallPut(b, w, u, g, m);
    }
  }
}

function utility(b, c, M, tally, I) {
  // 배전반과 배관 — 사람이 안 쓰는 방. 배전반은 약탈(여닫는 문) 대상이다.
  b.mark('furniture', `plant:${c.id}`);
  for (const w of interiorWalls(c.id)) {
    const len = w.b - w.a;
    for (const t of fit(0, len, 2.4, 1.0).map((v) => v / len)) {
      const pr = I.spawnPair('panel');
      panel(pr.closed, w, w.a + len * t, c.h, M);
      panel(pr.open, w, w.a + len * t, c.h, M, 'open');
      tally.panel = (tally.panel ?? 0) + 1;
    }
  }
  // 천장 배관 — **원기둥이다.** 상자로 내면 각목이다 (services 의 같은 대목)
  const cz = (c.z0 + c.z1) / 2;
  const cx = (c.x0 + c.x1) / 2;
  const len = c.x1 - c.x0 - 0.4;
  for (const [off, r, m] of [
    [-0.55, 0.09, M.steel],
    [0, 0.13, M.steelDark],
    [0.55, 0.07, M.steel],
  ]) {
    tube(b, r, len, [cx, 2.34 + off * 0.2, cz + off], m, 'x', 8);
    // 행어 — 천장에 매달려 있어야 뜬 것으로 안 보인다
    for (const t of fit(cx - len / 2, cx + len / 2, 2.6, 0.6)) {
      b.box(0.03, c.h - 2.34 - off * 0.2, 0.03, [t, (c.h + 2.34 + off * 0.2) / 2, cz + off], M.trim, 0);
    }
  }
  b.endMark();
}

// 화장실 — 덕트 탈출 스토리의 경유 방 (story.md 2장의 5).
//
// 프로토타입 수준이다 — 형태 단계라 조각은 상자다 (lessons 3.13.1: 그러라고
// 나눈 단계다). 화장실을 화장실로 만드는 것 넷은 적어 둔다. 디테일 단계에서
// 이 목록에 대고 확인한다: **부스 칸막이와 문**, **변기**, **세면 카운터와
// 세면볼**, **거울**.
function washroom(b, c, M, tally) {
  const walls = interiorWalls(c.id).sort((p, q) => q.b - q.a - (p.b - p.a));
  if (!walls.length) return;

  // ── 부스 — **동쪽 벽 고정.** "제일 긴 벽" 으로 골랐더니 같은 길이의
  // 서쪽 벽이 순서 우연으로 먼저 잡혀, 부스 문판이 북서쪽 덕트 그릴을
  // 통째로 가렸다 (냉장고 #7 과 같은 병 — 벽은 순서가 아니라 자리로
  // 고른다). 덕트 포트는 북서, 부스는 동쪽 — 서로 비킨다.
  const zWalls = walls.filter((q) => q.axis === 'z' && q.rule === 'solid');
  const w = (zWalls.length ? zWalls.sort((p, q) => q.at - p.at) : walls)[0];
  b.mark('furniture', `booth:${c.id}`);
  const D = 1.5; // 부스 깊이
  const PH = 1.9; // 칸막이 높이
  const len = w.b - w.a;
  const seats = fit(0, len, 1.0, 0.35);
  // 옆 칸막이 — 부스 사이와 양 끝
  const edges = [seats[0] - 0.5, ...seats.map((t) => t + 0.5)];
  for (const t of edges) {
    wallBox(b, w, w.a + t, D / 2, 0.15 + PH / 2, 0.04, PH, D, M.trim);
  }
  for (const t of seats) {
    const u = w.a + t;
    // 문판 — 개구를 거의 채운다 (0.62 로 뒀더니 칸이 듬성듬성 뚫려 보였다 — #5)
    wallBox(b, w, u, D - 0.02, 0.15 + PH / 2, 0.94, PH, 0.04, M.laminate);
    // 변기 — 도기다: 타원 사발(스케일한 원기둥) + 시트 링(납작 토러스) +
    // 물탱크·뚜껑·버튼. 흰 상자 둘은 변기가 아니다 (#5).
    const put = (g, m) => wallPut(b, w, u, g, m);
    const tank = new THREE.BoxGeometry(0.42, 0.5, 0.16);
    tank.translate(0, 0.62, 0.11);
    put(tank, M.porcelain);
    const lid = new THREE.BoxGeometry(0.44, 0.045, 0.18);
    lid.translate(0, 0.89, 0.11);
    put(lid, M.porcelain);
    const btn = new THREE.CylinderGeometry(0.024, 0.024, 0.02, 8);
    btn.translate(0.1, 0.92, 0.11);
    put(btn, M.trim);
    const neckB = new THREE.BoxGeometry(0.2, 0.28, 0.22);
    neckB.translate(0, 0.26, 0.24);
    put(neckB, M.porcelain);
    const bowl = new THREE.CylinderGeometry(0.16, 0.105, 0.36, 10);
    bowl.scale(1, 1, 1.3);
    bowl.translate(0, 0.2, 0.42);
    put(bowl, M.porcelain);
    const seat = new THREE.TorusGeometry(0.15, 0.026, 6, 12);
    seat.rotateX(Math.PI / 2);
    seat.scale(1, 1, 1.3);
    seat.translate(0, 0.4, 0.42);
    put(seat, M.porcelain);
    tally.booth = (tally.booth ?? 0) + 1;
  }
  b.endMark();

  // ── 세면 카운터 — 부스 반대쪽에서 제일 긴 벽 조각 ─────────────────────
  const across = walls.find((q) => q !== w && q.axis === w.axis && q.b - q.a > 1.4) ?? walls.find((q) => q !== w && q.b - q.a > 1.4);
  if (across) {
    b.mark('furniture', `basin:${c.id}`);
    const v = across;
    const cl = Math.min(v.b - v.a - 0.4, 3.2);
    const cm = (v.a + v.b) / 2;
    wallBox(b, v, cm, 0.3, 0.82, cl, 0.06, 0.6, M.laminate); // 상판
    wallBox(b, v, cm, 0.29, 0.41, cl - 0.2, 0.76, 0.55, M.trim); // 하부장
    // 세면볼 — **도기 사발**(위가 넓은 원뿔대) + 테 링 + 구즈넥 수전.
    // 납작한 흰 상자는 세면대가 아니다 (#6).
    for (const t of fit(0, cl, 0.9, 0.3)) {
      const u = cm - cl / 2 + t;
      const put = (g, m) => wallPut(b, v, u, g, m);
      const bowl = new THREE.CylinderGeometry(0.18, 0.115, 0.14, 10);
      bowl.translate(0, 0.795, 0.32);
      put(bowl, M.porcelain);
      const rim = new THREE.TorusGeometry(0.175, 0.014, 6, 12);
      rim.rotateX(Math.PI / 2);
      rim.translate(0, 0.868, 0.32);
      put(rim, M.porcelain);
      // 수전 — 기둥 + 반원 구즈넥 + 토출구 (주방과 같은 문법)
      const riser = new THREE.CylinderGeometry(0.013, 0.013, 0.2, 6);
      riser.translate(0, 0.95, 0.12);
      put(riser, M.trim);
      const arc = new THREE.TorusGeometry(0.075, 0.011, 6, 10, Math.PI);
      arc.rotateY(Math.PI / 2);
      arc.translate(0, 1.05, 0.195);
      put(arc, M.trim);
      const tip = new THREE.CylinderGeometry(0.009, 0.009, 0.04, 6);
      tip.translate(0, 1.03, 0.27);
      put(tip, M.trim);
      tally.basin = (tally.basin ?? 0) + 1;
    }
    // 거울 — 카운터 위 띠. 진짜 반사는 없다 — 매끈한 어두운 판으로 읽힌다
    // (M.screen 은 발광이라 거울이 형광판이 된다 — 재질을 이름으로 믿지 않는다)
    wallBox(b, v, cm, 0.04, 1.5, cl - 0.3, 0.7, 0.03, M.steelDark);
    // 잔소품 — 카운터 끝의 비누 디스펜서(원통 몸 + 펌프 목 + 노즐)와
    // 벽에 붙은 페이퍼타월함. 세면대만 있으면 "설비" 지 사람이 쓰던 곳이
    // 아니다 (챕터 0 디테일 패스).
    {
      const su = cm + cl / 2 - 0.22;
      const put = (g, m) => wallPut(b, v, su, g, m);
      const body = new THREE.CylinderGeometry(0.035, 0.04, 0.14, 8);
      body.translate(0, 0.92, 0.2);
      put(body, M.plasticWarm);
      const neck = new THREE.CylinderGeometry(0.009, 0.009, 0.05, 6);
      neck.translate(0, 1.0, 0.2);
      put(neck, M.trim);
      const noz = new THREE.CylinderGeometry(0.007, 0.007, 0.05, 6);
      noz.rotateX(Math.PI / 2);
      noz.translate(0, 1.02, 0.235);
      put(noz, M.trim);
      tally.soap = (tally.soap ?? 0) + 1;
      // 페이퍼타월함 — 거울 옆 벽. 아래로 종이 끝이 나와 있다
      wallBox(b, v, cm - cl / 2 + 0.18, 0.09, 1.32, 0.28, 0.34, 0.14, M.steel);
      wallBox(b, v, cm - cl / 2 + 0.18, 0.1, 1.13, 0.2, 0.05, 0.02, M.paper);
    }
    b.endMark();
  }
}

// 시작 사무실 방 — A 가 깨어나는 곳 (story.md 2장, use 'start' 인 칸 하나).
//
// 씬의 기본 상태는 **지진 직후(후)** 다: 책상·상호작용은 그대로 서고, 천장
// 타일과 등 파편이 떨어지고 서류가 흩어지고, **띠 복도로 나가는 유일한 문이
// 잔해로 막힌다** — 덕트 탈출 퍼즐의 게이트다. checkReach 는 문 규칙만
// 보므로 이 방을 갇힌 방으로 치지 않는다 — 실제 차단은 게임 콜라이더의 몫.
//
// **전(인트로) 상태는 씬 밖**이다 (startroom_pre — 약탈 열림 포즈와 같은
// 수법): 같은 책상 격자(deskSeats — 한 출처)가 흐트러짐 없이 서고, 문짝이
// 닫혀 있다. 문은 **불투명**이다 — 인트로 중 문 너머로 "후" 상태인 복도가
// 보이면 안 된다 (status.md 5.2). 조명의 전/후(정상/정전)는 파손 단계에서
// 층 전체와 함께 간다.
function startOffice(b, c, M, tally, I) {
  office(b, c, M, tally, I); // 책상·브라운관·의자 — 후에도 그대로 선다

  // 이 방의 유일한 출입구 — 띠 복도 쪽 door 런
  const run = wallRuns().find((r) => (r.from === c.id || r.to === c.id) && r.rule === 'door');
  const { gaps } = openingsOf(run);
  const [g0, g1] = gaps[0];
  const gm = (g0 + g1) / 2;
  const cz = (c.z0 + c.z1) / 2;
  const cx = (c.x0 + c.x1) / 2;
  const inward = run.axis === 'x' ? Math.sign(cz - run.at) : Math.sign(cx - run.at);
  // 문 자리의 로컬 (u, v) -> 세계. v 는 벽 중심에서 방 안쪽으로.
  const at = (u, v, y) => (run.axis === 'x' ? [u, y, run.at + inward * v] : [run.at + inward * v, y, u]);

  // ── 후 — 잔해와 파손 흔적 ─────────────────────────────────────────────
  // 병합 props 가 아니라 **개별 노드 하나(rubble_01)** 다. 유니티 인트로가
  // 전 상태를 켜는 동안 이걸 꺼야 한다 — 병합에 넣으면 정갈한 방 한가운데
  // 잔해가 남는다. (나중에 "잔해 치우기" 상호작용이 될 수도 있는 자리다.)
  const db = I.spawn('rubble');
  b.mark('furniture', `start:${c.id}`);
  // 문을 막은 잔해 더미 — 상자를 쌓으면 낙석이 아니라 짐짝이다 (#13).
  // **저폴리 암석(이코사헤드론)** 을 비균등 스케일·회전으로 우그려 쌓는다
  // (lessons.md 3.13.2 — 기하 형태를 아끼지 않는다).
  // 문 폭을 가득 채우고 방 안쪽으로 흘러내린 더미 — 몇 덩이만 세우면
  // 낙석이 아니라 조형물이다 (#5 재지적: 더 풍부하게).
  //   [u(문 축), y, v(방 안쪽), 반지름, 회전, 눌림]
  const rocks = [
    // 1층 — 문턱을 가득 채우는 큰 덩이들
    [gm - 0.42, 0.22, 0.3, 0.34, 0.7, 1.05],
    [gm - 0.02, 0.26, 0.32, 0.38, 0.4, 1.2],
    [gm + 0.4, 0.2, 0.28, 0.32, 1.2, 0.85],
    [gm - 0.25, 0.24, 0.68, 0.3, 1.9, 0.8],
    [gm + 0.22, 0.22, 0.72, 0.28, 2.4, 1.1],
    [gm - 0.02, 0.2, 1.05, 0.24, 0.9, 0.75],
    // 2층 — 틈에 얹힌 중간 덩이들
    [gm - 0.3, 0.62, 0.34, 0.26, 0.9, 1.15],
    [gm + 0.08, 0.68, 0.38, 0.3, 2.1, 0.9],
    [gm + 0.38, 0.58, 0.3, 0.22, 1.6, 0.75],
    [gm - 0.06, 0.6, 0.75, 0.22, 2.9, 0.95],
    // 3층 — 꼭대기, 상인방 가까이
    [gm - 0.2, 1.02, 0.3, 0.24, 2.8, 1.05],
    [gm + 0.16, 1.12, 0.28, 0.22, 0.5, 0.95],
    [gm - 0.02, 1.42, 0.26, 0.2, 1.3, 0.8],
  ];
  let ri = 0;
  for (const [u, y, v, r, spin, squash] of rocks) {
    const g = new THREE.IcosahedronGeometry(r, 0);
    g.scale(1.25, squash, 0.95); // 비균등 — 구형이면 바위가 아니라 공이다
    g.rotateY(spin);
    g.rotateX(hash2(ri, 5) * 0.9);
    const p = at(u, v, y);
    g.translate(p[0], p[1], p[2]);
    db.add(g, M.rock);
    ri++;
  }
  // 잔 부스러기 — 더미 발치에서 방 안쪽으로 흩어진 알갱이들
  for (let i = 0; i < 12; i++) {
    const r = 0.05 + hash2(i * 7, 11) * 0.09;
    const g = new THREE.IcosahedronGeometry(r, 0);
    g.scale(1.2, 0.75, 1.0);
    g.rotateY(hash2(i, 3) * 3);
    const spread = 0.5 + hash2(i * 5, 19) * 1.1; // 문에서 방 안쪽으로
    const p = at(gm - 0.9 + hash2(i * 3, 7) * 1.8, spread, r * 0.6);
    g.translate(p[0], p[1], p[2]);
    db.add(g, M.rock);
  }
  // 기울어 걸친 슬래브 조각 둘 — 더미를 "무너져 내린 것" 으로 만든다
  for (const [du, tilt, len] of [[-0.34, 1.05, 1.5], [0.3, 1.25, 1.2]]) {
    const g = new THREE.BoxGeometry(0.7, 0.07, len);
    g.translate(0, 0, len / 2);
    g.rotateX(-tilt);
    if (run.axis === 'z') g.rotateY(Math.PI / 2);
    const p = at(gm + du, 0.1, 0.06);
    g.translate(p[0], p[1], p[2]);
    db.add(g, M.rock);
  }
  tally.rubble = (tally.rubble ?? 0) + 1;

  // 떨어진 천장 타일과 등 파편 — A 를 맞힌 그것들. 통로 가운데에 흩는다.
  const aisleZ = (c.z0 + c.z1) / 2;
  for (let i = 0; i < 4; i++) {
    const r = hash2(i * 7 + 3, Math.round(c.x0 * 13) + i);
    const x = c.x0 + 1.2 + r * (c.x1 - c.x0 - 2.4);
    const z = aisleZ + (hash2(i * 11, i * 5 + 1) - 0.5) * 1.6;
    boxAt(db, 0.58, 0.018, 0.58, [x, 0.01, z], M.ceilOf('room'), r * 2.6);
    tally.tileFallen = (tally.tileFallen ?? 0) + 1;
  }
  // 등 반사갓 파편 — 깨어나는 자리 옆
  boxAt(db, 1.1, 0.05, 0.55, [c.x0 + 2.0, 0.03, aisleZ + 0.4], M.steel, 0.35);
  // 흩어진 서류
  for (let i = 0; i < 9; i++) {
    const r1 = hash2(i * 3 + 1, i + 17);
    const r2 = hash2(i * 5 + 2, i + 29);
    const x = c.x0 + 0.8 + r1 * (c.x1 - c.x0 - 1.6);
    const z = c.z0 + 0.8 + r2 * (c.z1 - c.z0 - 1.6);
    boxAt(db, 0.21, 0.004, 0.3, [x, 0.004, z], M.paper, r1 * 3.1);
  }
  b.endMark();

  // ── 전 — 인트로 전용 (씬 밖) ──────────────────────────────────────────
  // 방 자체(책상·의자·브라운관)는 전/후가 **같으므로 복제하지 않는다** —
  // 복제하면 씬의 상호작용 노드와 같은 자리에 겹친다. 전 상태에서 달라지는
  // 것은 둘뿐이다: 잔해가 없고(rubble_01 을 끈다), **문짝이 닫혀 있다**.
  // 그래서 pre 조각은 닫힌 문짝 하나다. 문은 불투명이다 — 인트로 중 문
  // 너머로 "후" 상태인 복도가 보이면 안 된다 (status.md 5.2).
  const pre = I.spawnPre('startroom_pre');
  const dw = g1 - g0;
  const leaf = at(gm, 0, H.door / 2 - 0.01);
  boxAt(pre, run.axis === 'x' ? dw - 0.04 : 0.05, H.door - 0.06, run.axis === 'x' ? 0.05 : dw - 0.04, leaf, M.laminate, 0);
  // 손잡이
  const hnd = at(gm + dw / 2 - 0.12, 0.05, 1.02);
  boxAt(pre, 0.04, 0.04, 0.16, hnd, M.trim, 0);
}

// ── 조립 ───────────────────────────────────────────────────────────────────

const BY_USE = {
  dining,
  cafe,
  kitchen,
  server: serverRoom,
  control,
  machine,
  lounge,
  shower,
  stair: stairwell,
  elev: elevatorHall,
  plaza,
  office,
  store: storage,
  util: utility,
  wash: washroom,
  start: startOffice,
  corridor: () => {},
};

// ── 탈출 덕트 — 계획(duct.js)대로 몸통·포트 틀·그릴을 짓는다 ───────────────
//
// 몸통은 북쪽 공동구 안의 **수평** 사각 덕트다 (오르내림 없음 — 2026-08-05
// 사용자 결정). 상자 하나가 아니라 판 넷(바닥·천장·옆판 둘)이다 — 안을
// 기어가며 보는 길이므로, 통상자로 내면 백페이스 컬링으로 속이 안 보인다.
// 방에서 보이는 것은 벽의 그릴뿐이고, 커버는 약탈 소품과 같은 상호작용
// 짝이다: 닫힘 = 벽의 루버 그릴, 열림 = 옆에 기대어 놓은 그릴 + 뻥 뚫린
// 개구 (레퍼런스: 하프라이프의 벽 환기구).
function escapeDuct(b, M, tally, I) {
  const p = ductPlan();
  const t = p.t;

  b.mark('service', 'escduct');
  for (const r of p.runs) {
    const zc = (p.vz0 + p.vz1) / 2;
    const midY = (p.floorY + p.headY) / 2;
    // 판은 미터 UV(tile 1)다 — 0 으로 뒀더니 텍스처가 관 길이만큼 늘어나
    // 내부가 줄무늬 스트레치로 보였다 (#14)
    const box = (x0, x1, y, h, z0, z1, m) => {
      if (x1 - x0 < 0.01) return;
      b.box(x1 - x0, h, z1 - z0, [(x0 + x1) / 2, y, (z0 + z1) / 2], m, 1.0);
    };

    // 바닥·천장 — 통짜
    box(r.a, r.b, p.y0 + t / 2, t, p.vz0, p.vz1, M.steel);
    box(r.a, r.b, p.topY - t / 2, t, p.vz0, p.vz1, M.steel);
    // 북쪽 옆판 — 통짜. 바닥과 천장 **사이**만 (모서리 겹침 없음)
    box(r.a, r.b, midY, p.clear, p.vz1 - t, p.vz1, M.steel);
    // 남쪽 옆판 — 포트 자리를 비켜 쪼갠다 (벽 개구와 같은 폭)
    let cur = r.a;
    for (const d of [...p.ports].sort((q, w) => q.x - w.x)) {
      box(cur, d.x - p.portW / 2, midY, p.clear, p.vz0, p.vz0 + t, M.steel);
      cur = d.x + p.portW / 2;
    }
    box(cur, r.b, midY, p.clear, p.vz0, p.vz0 + t, M.steel);
    // 끝 캡 — 안쪽 치수로 막는다 (판들과 겹치지 않게)
    box(r.a, r.a + t, midY, p.clear, p.vz0 + t, p.vz1 - t, M.steelDark);
    box(r.b - t, r.b, midY, p.clear, p.vz0 + t, p.vz1 - t, M.steelDark);
    // 이음 플랜지 — 1.5m 마다 안쪽으로 도드라진 띠 넷. 끝없는 민짜 통이
    // 아니라 **덕트 마디**로 읽히게 한다 (#14). 포트 개구는 비킨다
    for (const u of fit(r.a + 0.4, r.b - 0.4, 1.5, 0.2)) {
      if (p.ports.some((d) => Math.abs(d.x - u) < p.portW / 2 + 0.12)) continue;
      box(u - 0.02, u + 0.02, p.floorY + 0.017, 0.035, p.vz0 + t, p.vz1 - t, M.steelDark);
      box(u - 0.02, u + 0.02, p.headY - 0.017, 0.035, p.vz0 + t, p.vz1 - t, M.steelDark);
      box(u - 0.02, u + 0.02, midY, p.clear - 0.08, p.vz0 + t, p.vz0 + t + 0.035, M.steelDark);
      box(u - 0.02, u + 0.02, midY, p.clear - 0.08, p.vz1 - t - 0.035, p.vz1 - t, M.steelDark);
    }
    // 받침 다리 — 공동구 바닥(buildRock, 윗면 y=0)에 선다
    for (const u of fit(r.a, r.b, 1.6, 0.3)) {
      for (const s of [p.vz0 + 0.08, p.vz1 - 0.08]) {
        b.box(0.05, p.y0, 0.05, [u, p.y0 / 2, s], M.trim, 0);
      }
    }
  }

  // 포트 틀 — 벽 개구 둘레를 문틀처럼 두른다: 개구 안쪽을 딛고 벽면보다
  // 1.5cm 돌출 (겹평면 없음 — 문틀·브라운관의 교훈 그대로).
  const JT = 0.23; // 벽 0.2 + 양쪽 1.5cm
  for (const d of p.ports) {
    const w2 = p.portW / 2;
    for (const [x0, x1, y0, y1] of [
      [d.x - w2 - 0.02, d.x - w2 + 0.04, p.sill - 0.02, p.headY + 0.02], // 좌
      [d.x + w2 - 0.04, d.x + w2 + 0.02, p.sill - 0.02, p.headY + 0.02], // 우
      [d.x - w2 + 0.04, d.x + w2 - 0.04, p.headY - 0.04, p.headY + 0.02], // 상
      [d.x - w2 + 0.04, d.x + w2 - 0.04, p.sill - 0.02, p.sill + 0.04], // 하 (문턱)
    ]) {
      b.box(x1 - x0, y1 - y0, JT, [(x0 + x1) / 2, (y0 + y1) / 2, d.z], M.trim, 0);
    }
  }
  b.endMark();

  // ── 그릴 커버 — 상호작용 짝. 판 크기는 개구에서 나온다 ────────────────
  const GW = p.portW + 0.1; // 개구 둘레를 0.05 씩 덮는다
  const GH = p.clear + 0.12;
  for (const d of p.ports) {
    const pr = I.spawnPair('vent');
    // 닫힘 — 벽 개구 위에 붙은 그릴 (방 쪽 벽면에서 2mm 띄운다)
    ventCover(pr.closed, [d.x, p.sill - 0.06, d.z - 0.1 - 0.016], 'wall', M, GW, GH);
    // 열림 — 떼어낸 그릴이 개구 옆 벽에 기대어 있다 (레퍼런스 그대로).
    // 어느 옆인지는 계획이 정한다 (d.lean — 그 방 가구를 비킨 쪽).
    // 기운 판의 윗변이 벽을 파고들지 않게, 판 높이만큼 z 를 물린다
    ventCover(pr.open, [d.x + d.lean * (p.portW / 2 + 0.55), 0.02, d.z - 0.11 - GH * 0.29], 'lean', M, GW, GH);
    tally.vent = (tally.vent ?? 0) + 1;
  }
}

// 루버 그릴 한 장 — 수직으로 세워 짓고(원점 = 아랫변 중앙, 정면 -z),
// mode 'wall' 이면 그대로 벽에 붙고 'lean' 이면 벽에 기대어 선다.
// W x H 는 호출자가 개구에서 유도한다 (escapeDuct).
function ventCover(b, at, mode, M, W, H) {
  const [x, y, z] = at;
  const put = (g, m) => {
    if (mode === 'lean') g.rotateX(0.28); // 윗변이 벽(+z) 쪽으로 기운다
    g.translate(x, y, z);
    b.add(g, m);
  };
  // 색은 어두운 강판이 아니라 **밝은 도장**이다 — 어두운 알베도를 주면
  // 통짜 검은 판이 된다 (천장 그릴 시절에 실제로 그랬다). 레퍼런스의
  // 그릴도 밝은 도장이다.
  // 테 — 네 변
  for (const [dx, dy, w, h] of [
    [0, 0.03, W, 0.06],
    [0, H - 0.03, W, 0.06],
    [-(W / 2 - 0.03), H / 2, 0.06, H - 0.12],
    [W / 2 - 0.03, H / 2, 0.06, H - 0.12],
  ]) {
    const g = new THREE.BoxGeometry(w, h, 0.028);
    g.translate(dx, dy, 0);
    put(g, M.crt);
  }
  // 루버 — 비스듬한 날들, 날 사이 틈으로 뒤의 어둠이 보인다.
  // 이게 있어야 환기구로 읽힌다 (레퍼런스의 그릴). 날을 얇게 두고 틈을
  // 넓힌다 — 틈이 좁으면 통짜 판으로 보인다 (천장 그릴 시절의 교훈).
  const n = Math.round((H - 0.17) / 0.078);
  for (let i = 0; i < n; i++) {
    const g = new THREE.BoxGeometry(W - 0.12, 0.055, 0.012);
    g.rotateX(0.45);
    g.translate(0, 0.099 + i * 0.078, 0);
    put(g, M.crt);
  }
  // 귀퉁이 나사 넷 — 걸려 있던 그릴 마감 (status.md 5.2 의 '그릴 나사')
  for (const [sx, sy] of [
    [-W / 2 + 0.032, 0.032],
    [W / 2 - 0.032, 0.032],
    [-W / 2 + 0.032, H - 0.032],
    [W / 2 - 0.032, H - 0.032],
  ]) {
    const g = new THREE.CylinderGeometry(0.015, 0.015, 0.014, 6);
    g.rotateX(Math.PI / 2);
    g.translate(sx, sy, -0.02);
    put(g, M.trim);
  }
}

export function createProps(scene, M, lp) {
  const b = new MeshBuilder('Props'); // 배경 — 병합 배치
  const I = interactSet(); // 상호작용 — 물건마다 독립 노드
  const tally = {};
  for (const c of CELLS) {
    const f = BY_USE[c.use];
    if (!f) throw new Error(`소품 표에 용도 '${c.use}' 가 없다 — props.BY_USE 에 추가한다`);
    f(b, c, M, tally, I);
    services(b, c, M, tally, lp);
    if (c.kind === 'corridor') corridorWalls(b, c, M, tally);
  }
  escapeDuct(b, M, tally, I);
  exitSigns(b, M, tally);
  roomSigns(b, M, tally);
  // 잔소품은 종류마다 하한을 달면 경보가 여섯 줄이 된다 — **한 계통이므로
  // 하나로 신고한다.** 클러터 생성이 통째로 죽으면 이 합이 0 이 된다
  // (audit.EXPECT.clutter). 종류별 수는 tally 에 그대로 남는다.
  tally.clutter = [
    'tray', 'plateStack', 'canned', 'soap', 'clock', 'bin', 'drum', 'toolbox',
    'cutlery', 'bookcase', 'meeting', 'bed', 'washer', 'basket', 'detergent',
    'cleanCab', 'mop', 'bucket', 'coffee', 'juice', 'cupboard', 'oven', 'sinkUnit',
    'roomSign', 'whiteboard', 'partition',
  ].reduce((s, k) => s + (tally[k] ?? 0), 0);
  const interactables = Object.values(I.counts).reduce((s, v) => s + v, 0);
  return {
    group: b.build(scene),
    interactables: I.build(scene),
    open: I.openGroup, // 씬에 안 붙는다 — 굽기·익스포트 전용
    pre: I.preGroup, // 시작 방의 전(지진 전) 상태 — 역시 씬 밖
    openCount: I.openCount,
    interactCount: interactables,
    interactKinds: I.counts,
    tally,
  };
}
