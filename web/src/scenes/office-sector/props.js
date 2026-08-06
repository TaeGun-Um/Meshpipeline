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

// 머그컵 — 8각 원통에 반토러스 귀 하나로는 **입이 막힌 통**이었다
// (2026-08-06 지적). 컵을 컵으로 만드는 것: 매끈한 몸통(각을 늘린다) ·
// **테보다 낮은 속(어두운 원판)** · 굽 · 손잡이와 그 붙는 자리.
function mug(b, x, y, z, M, tint) {
  const R = 0.037;
  tube(b, R, 0.092, [x, y + 0.046, z], tint, 'y', 12); // 몸통
  tube(b, R + 0.003, 0.008, [x, y + 0.09, z], tint, 'y', 12, true); // 테 — 살짝 도톰
  tube(b, R * 0.86, 0.006, [x, y + 0.082, z], M.rubber, 'y', 12, true); // 속 — 테보다 낮다
  tube(b, R * 0.82, 0.006, [x, y + 0.005, z], tint, 'y', 12, true); // 굽
  const ear = new THREE.TorusGeometry(0.027, 0.0075, 6, 10, Math.PI);
  ear.rotateZ(-Math.PI / 2); // 호가 +x 로 불룩 — 컵 옆구리에 귀
  ear.translate(x + R - 0.004, y + 0.05, z);
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
  // ── 지면 (2026-08-06 "이것들 뭐임?") ─────────────────────────────────
  //
  // 굵은 막대 넷은 신문이 아니라 **바코드**로 보였다. 신문의 지면은
  // **제호(맨 위 굵은 띠) · 그 아래 가는 괘선 · 단(段)으로 갈린 글줄 ·
  // 사진 자리(회색 네모)** 다 — 이 배치가 신문을 신문으로 만든다.
  const ink = (w, d, lx, lz, m = M.rubber, h = 0.002) => {
    const g = new THREE.BoxGeometry(w, h, d);
    g.translate(lx, 0.013, lz);
    put(g, m);
  };
  ink(0.22, 0.02, -0.02, 0.078); // 제호
  ink(0.26, 0.003, 0, 0.062); // 제호 밑 괘선
  ink(0.26, 0.002, 0, 0.056);
  // 왼쪽 단 — 사진 자리 + 짧은 글줄
  ink(0.11, 0.05, -0.085, 0.024, M.trim, 0.003);
  for (let i = 0; i < 5; i++) ink(0.1, 0.005, -0.085, -0.012 - i * 0.011);
  // 가운데 세로 괘선
  ink(0.002, 0.13, -0.022, 0.0);
  // 오른쪽 단 — 소제목 + 글줄
  ink(0.09, 0.008, 0.05, 0.042);
  for (let i = 0; i < 8; i++) ink(0.115, 0.004, 0.052, 0.026 - i * 0.011);
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
// 연필꽂이 — 통 하나에 막대 넷을 꽂고 **끝에 흰 뿔**을 달았더니, 연필이
// 아니라 다트가 됐다 (2026-08-06 "디테일 매우 떨어짐").
//
// 연필을 연필로 만드는 것: **6각 몸통**(둥근 것은 볼펜이다) · 나무색 깎인
// 목 · 검은 심 · 끝의 지우개 테. 통은 **철망**이라 세로살이 보인다.
// 그리고 통 안에 연필만 있으면 필통이다 — 자·가위·볼펜을 섞는다.
function pencilCup(b, x, y, z, M) {
  const R = 0.038;
  tube(b, R, 0.095, [x, y + 0.048, z], M.steelDark, 'y', 12); // 통
  tube(b, R * 0.86, 0.008, [x, y + 0.088, z], M.rubber, 'y', 12, true); // 속 어둠
  tube(b, R + 0.004, 0.012, [x, y + 0.093, z], M.trim, 'y', 12, true); // 테두리
  tube(b, R * 0.9, 0.008, [x, y + 0.006, z], M.trim, 'y', 12, true); // 굽
  // 철망 세로살 — 민짜 통과 필통을 가른다
  for (let k = 0; k < 10; k++) {
    const a = (k / 10) * Math.PI * 2;
    const rb = new THREE.BoxGeometry(0.006, 0.08, 0.006);
    rb.rotateY(a);
    rb.translate(x + Math.sin(a) * (R + 0.003), y + 0.05, z + Math.cos(a) * (R + 0.003));
    b.add(rb, M.trim);
  }
  const PAL = [M.warn, M.vendBlue, M.vend, M.crate];
  for (let i = 0; i < 5; i++) {
    const r = hash2(Math.round(x * 31) + i, Math.round(z * 17));
    const a = (i / 5) * Math.PI * 2 + r;
    const lean = 0.1 + r * 0.13;
    const dx5 = Math.sin(a) * 0.014;
    const dz5 = Math.cos(a) * 0.014;
    const tilt = (g, len, yc) => {
      g.rotateZ(Math.sin(a) * lean);
      g.rotateX(Math.cos(a) * lean);
      g.translate(x + dx5 + Math.sin(a) * lean * yc, y + yc, z + dz5 + Math.cos(a) * lean * yc);
      return g;
    };
    if (i < 3) {
      // 연필 — 6각 몸통 · 깎인 목(나무) · 검은 심 · 지우개 테
      b.add(tilt(new THREE.CylinderGeometry(0.0045, 0.0045, 0.17, 6), 0.17, 0.13), PAL[i]);
      b.add(tilt(new THREE.CylinderGeometry(0.0018, 0.0045, 0.022, 6), 0.022, 0.226), M.carton);
      b.add(tilt(new THREE.CylinderGeometry(0.0006, 0.0018, 0.008, 5), 0.008, 0.241), M.rubber);
      b.add(tilt(new THREE.CylinderGeometry(0.0048, 0.0048, 0.012, 6), 0.012, 0.05), M.steel);
    } else if (i === 3) {
      // 볼펜 — 매끈한 원통 + 뚜껑 + 클립
      b.add(tilt(new THREE.CylinderGeometry(0.005, 0.005, 0.16, 8), 0.16, 0.125), M.rubber);
      b.add(tilt(new THREE.CylinderGeometry(0.0055, 0.0055, 0.04, 8), 0.04, 0.215), M.vendBlue);
      b.add(tilt(new THREE.BoxGeometry(0.004, 0.03, 0.012), 0.03, 0.212), M.trim);
    } else {
      // 자 — 납작한 판. 통 밖으로 길게 나온다
      b.add(tilt(new THREE.BoxGeometry(0.026, 0.22, 0.003), 0.22, 0.155), M.paper);
    }
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

// 쓰레기통 — 매끈한 원통 하나면 **드럼통 토막**이다 (2026-08-06 지적).
// 통을 통으로 만드는 것: 위가 넓은 몸통 · 테두리 · 테보다 낮은 속 · 굽 ·
// 세로 골 · 그리고 **비어져 나온 봉지 자락**.
function bin(b, x, z, M) {
  const g0 = new THREE.CylinderGeometry(0.165, 0.135, 0.5, 12);
  g0.translate(x, 0.25, z);
  b.add(g0, M.steelDark); // 몸통 — 위가 넓다
  const rim = new THREE.TorusGeometry(0.166, 0.016, 6, 12);
  rim.translate(x, 0.5, z);
  b.add(rim, M.trim); // 테두리
  tube(b, 0.15, 0.014, [x, 0.472, z], M.rubber, 'y', 12, true); // 속 — 테보다 낮다
  tube(b, 0.142, 0.024, [x, 0.012, z], M.trim, 'y', 12, true); // 굽
  // 가로 테 둘 — 몸통을 두른 성형 띠. 세로 막대를 세웠더니 몸통이 아래로
  // 좁아지는(0.165 -> 0.135) 것을 안 따라가 **아래쪽이 통 밖으로 삐져나와**
  // 뿔처럼 보였다 (2026-08-06 "이거 뭐임?"). 테는 몸통 반지름을 그 높이에서
  // 다시 재어 두른다 — 곡면을 따라가는 조각은 곡면에서 좌표를 받는다.
  for (const t of [0.3, 0.66]) {
    const rr = 0.135 + (0.165 - 0.135) * t; // 그 높이의 몸통 반지름
    const band = new THREE.CylinderGeometry(rr + 0.006, rr + 0.004, 0.022, 12);
    band.translate(x, 0.5 * t, z);
    b.add(band, M.trim);
  }
  // 봉지 자락 — 테 위로 접혀 넘어온 얇은 띠 셋. 쓰던 통의 표식이다.
  // 뿔처럼 튀지 않게 낮게 눕힌다
  for (let k = 0; k < 3; k++) {
    const a = 0.7 + k * 2.1;
    const fl = new THREE.BoxGeometry(0.09, 0.04, 0.01);
    fl.rotateX(1.15);
    fl.rotateY(a);
    fl.translate(x + Math.sin(a) * 0.158, 0.487, z + Math.cos(a) * 0.158);
    b.add(fl, M.paper);
  }
}

// ── 방을 채우는 물건들 (챕터 0 [전] · A 항목) ──────────────────────────────
//
// status.md 5.0 의 A: 랙만 있는 서버실, 콘솔만 있는 관제실, 문짝뿐인 엘리베이터
// 홀처럼 **"설비는 있는데 사람이 없는"** 방들을 채운다. 물건마다 조각 목록을
// 먼저 적고 그것에 대고 확인한다 (lessons 3.13.1), 단면이 원이면 원기둥으로
// 낸다 (3.13.2).

// 소화기 — 몸통 원통 · **어깨(좁아지는 원뿔대)** · 목 · 밸브와 레버 · 호스 ·
// 압력계 · 벽 브래킷. 어깨가 없으면 붉은 파이프 토막이다.
// gas 면 전산실용 가스계다 — 물·분말을 못 쓰는 방이라 크고 바닥에 선다.
function extinguisher(b, w, u, M, gas = false) {
  const R = gas ? 0.085 : 0.062;
  const H0 = gas ? 0.8 : 0.44;
  const y0 = gas ? 0.015 : 0.86; // 가스계는 바닥에 앉는다, 분말은 벽 브래킷 위
  const v = 0.11 + R; // 벽면에서 몸통 중심까지
  const put = (g, m) => wallPut(b, w, u, g, m);
  const cyl = (r0, r1, h, ly, lz, m, seg = 10) => {
    const g = new THREE.CylinderGeometry(r0, r1, h, seg);
    g.translate(0, ly, lz);
    put(g, m);
  };
  const yTop = y0 + H0;
  cyl(R, R, H0, y0 + H0 / 2, v, M.vend); // 몸통
  cyl(R * 0.42, R, 0.11, yTop + 0.055, v, M.vend); // 어깨 — 위가 좁다
  cyl(R * 0.4, R * 0.4, 0.05, yTop + 0.135, v, M.steelDark); // 목
  cyl(R + 0.004, R + 0.004, 0.02, y0 + 0.02, v, M.steelDark); // 바닥 굽테
  // 밸브 몸통과 눌러 잡는 레버 — 위로 삐죽한 손잡이가 소화기를 만든다
  {
    const body = new THREE.BoxGeometry(0.055, 0.06, 0.09);
    body.translate(0, yTop + 0.19, v);
    put(body, M.steelDark);
    const lev = new THREE.BoxGeometry(0.03, 0.014, 0.15);
    lev.rotateX(-0.16);
    lev.translate(0, yTop + 0.235, v + 0.03);
    put(lev, M.trim);
    // 압력계 — 방 쪽을 보는 작은 원판 + 바늘
    const gauge = new THREE.CylinderGeometry(0.026, 0.026, 0.014, 10);
    gauge.rotateX(Math.PI / 2);
    gauge.translate(0, yTop + 0.185, v + 0.06);
    put(gauge, M.paper);
    const nd = new THREE.BoxGeometry(0.004, 0.02, 0.006);
    nd.translate(0, yTop + 0.192, v + 0.068);
    put(nd, M.rubber);
  }
  // 호스 — 목에서 몸통 옆으로 내려와 감긴다 (반토러스)
  {
    const hose = new THREE.TorusGeometry(gas ? 0.14 : 0.1, 0.011, 5, 10, Math.PI * 1.1);
    hose.rotateY(Math.PI / 2);
    hose.rotateZ(0.5);
    hose.translate(R * 0.7, yTop - (gas ? 0.05 : 0.02), v);
    put(hose, M.rubber);
    const noz = new THREE.CylinderGeometry(0.014, 0.02, 0.09, 6);
    noz.rotateZ(0.5);
    noz.translate(R + 0.1, y0 + H0 * 0.45, v);
    put(noz, M.rubber);
  }
  // 벽 브래킷 — 몸통을 벽에 붙드는 띠. 벽에 붙은 것으로 보이게 하는 조각이다
  for (const dy of gas ? [H0 * 0.75] : [H0 * 0.25, H0 * 0.75]) {
    wallBox(b, w, u, 0.055, y0 + dy, R * 2 + 0.03, 0.05, 0.12, M.steelDark);
  }
  // 벽의 붉은 표지 — 위치를 멀리서 알리는 것
  wallBox(b, w, u, 0.012, yTop + 0.55, 0.2, 0.26, 0.014, M.vend);
  wallBox(b, w, u, 0.021, yTop + 0.55, 0.15, 0.19, 0.006, M.paper);
}

// 화분 — **위가 넓은 원뿔대** 화분 + 흙 + 잎. 원통에 초록 상자를 얹으면
// 화분이 아니라 페인트통이다. 잎은 밑동에서 퍼져 오르는 납작한 날들이다.
// 화분 — 첫 판은 **양동이에 꽂은 색종이**였다 (2026-08-06 지적: 잎이 다섯
// 갈래 창처럼 뻗고, 테두리 토러스가 손잡이로 보였다).
//
// 화분을 화분으로 만드는 것:
//   화분   위가 넓은 원뿔대 · **가로 띠(몰딩)** · 굽 · 받침 접시
//   흙     테보다 낮은 어두운 면 + 굵은 알갱이 몇
//   식물   **줄기에서 갈라지는** 잎 — 한 점에서 방사로 뻗으면 폭죽이다.
//          잎마다 길이·기울기·비틀림이 다르고, 끝이 아래로 처진다
function planter(b, x, z, M, seed) {
  const R = 0.26;
  const H0 = 0.42;
  const pot = new THREE.CylinderGeometry(R, R * 0.7, H0, 14);
  pot.translate(x, H0 / 2, z);
  b.add(pot, M.cartonDark);
  // 가로 띠 둘 — 테라코타 화분의 성형선. 없으면 매끈한 통이다
  for (const [yy, rr] of [[H0 - 0.035, R * 0.995], [H0 * 0.55, R * 0.85]]) {
    const bandR = new THREE.CylinderGeometry(rr + 0.012, rr + 0.012, 0.026, 14);
    bandR.translate(x, yy, z);
    b.add(bandR, M.carton);
  }
  tube(b, R * 0.74, 0.022, [x, 0.011, z], M.carton, 'y', 14, true); // 굽
  {
    const dish = new THREE.CylinderGeometry(R * 0.88, R * 0.8, 0.03, 14);
    dish.translate(x, 0.015, z);
    b.add(dish, M.carton); // 받침 접시
  }
  tube(b, R - 0.045, 0.05, [x, H0 - 0.045, z], M.rubber, 'y', 14, true); // 흙
  for (let k = 0; k < 5; k++) {
    const a = (k / 5) * Math.PI * 2 + 0.4;
    const rr2 = 0.06 + hash2(seed + k, 3) * 0.1;
    const st = new THREE.IcosahedronGeometry(0.022 + hash2(k, seed) * 0.012, 0);
    st.translate(x + Math.sin(a) * rr2, H0 - 0.028, z + Math.cos(a) * rr2);
    b.add(st, M.cartonDark); // 흙 알갱이
  }
  // ── 잎 — **한 장이 하나로 이어진다** ──────────────────────────────────
  //
  // 마디를 따로 만들어 회전으로 이으려던 판은 **뚝뚝 끊겼다** (2026-08-06
  // 지적). 원인은 회전의 합성이다: rotateY·rotateX·rotateZ 를 차례로 걸면
  // 큰 각에서 실제 방향이 의도와 어긋나고, 조각의 끝점이 다음 조각의
  // 시작점에서 벌어진다. 각을 아무리 맞춰도 이 틈은 안 없어진다.
  //
  // **곡선을 따라가는 물건은 정점을 직접 짠다.** 중심선을 적분해 스테이션
  // 마다 단면(마름모) 넷을 놓고 이웃 스테이션을 면으로 잇는다 — 정점을
  // 공유하므로 이음매가 원리적으로 생기지 않고, 표면도 매끈하게 흐른다.
  for (let i = 0; i < 7; i++) {
    const r = hash2(seed * 5 + i, 13);
    const a = (i / 7) * Math.PI * 2 + seed * 0.4;
    b.add(
      leafGeometry({
        len: 0.5 + r * 0.24,
        wMax: 0.085 + r * 0.035,
        lean0: 0.18 + r * 0.22, // 밑동이 수직에서 벌어진 각
        bend: 1.2 + r * 0.55, // 끝까지 더 휘는 각
        yaw: a,
        at: [x + Math.sin(a) * 0.035, H0 - 0.04, z + Math.cos(a) * 0.035],
      }),
      i % 3 === 0 ? M.crate : M.plastic
    );
  }
  // 속잎 셋 — 아직 안 펴진 짧고 곧은 것. 큰 잎만 있으면 조화(造花)다
  for (let i = 0; i < 3; i++) {
    const r = hash2(seed + i * 3, 31);
    const a = (i / 3) * Math.PI * 2 + 1.1;
    b.add(
      leafGeometry({
        len: 0.22 + r * 0.1,
        wMax: 0.038 + r * 0.014,
        lean0: 0.1 + r * 0.12,
        bend: 0.35,
        yaw: a,
        at: [x + Math.sin(a) * 0.02, H0 - 0.03, z + Math.cos(a) * 0.02],
        seg: 6,
      }),
      M.crate
    );
  }
}

// 잎 한 장 — **이어진 리본**. 중심선을 따라 마름모 단면을 훑어 만든다.
//
// 스테이션 i 의 단면 넷: +W(잎 폭 왼쪽) · +N(앞면 두께) · -W · -N.
//   T  접선  (sinθ, cosθ, 0)   — 중심선이 나아가는 쪽
//   W  폭    (0, 0, 1)         — 굽는 평면에 수직 = 잎이 퍼지는 쪽
//   N  두께  (cosθ, -sinθ, 0)  — 잎면의 법선 (가운데 잎맥이 도톰해진다)
// 이웃 스테이션의 같은 인덱스끼리 면으로 이으면 정점이 공유되어 **틈이 없다.**
// 끝에서 폭이 0 이 되므로 뾰족한 잎끝은 저절로 닫힌다.
function leafGeometry({ len, wMax, lean0, bend, yaw, at, seg = 12 }) {
  const pos = [];
  const idx = [];
  // 폭 — 밑동 0.37, t 0.43 에서 최대, 끝에서 0. 창끝이 아니라 잎이다
  const wAt = (t) => wMax * Math.sin(Math.PI * (0.12 + 0.88 * t));
  // 두께 — 밑동이 도톰하고 끝으로 갈수록 얇다
  const tAt = (t) => wMax * 0.15 * (0.45 + 0.55 * (1 - t));
  let px = 0;
  let py = 0;
  for (let i = 0; i <= seg; i++) {
    const t = i / seg;
    // t^1.6 — 밑동은 곧게 서고 끝으로 갈수록 급히 처진다 (실제 잎의 곡선)
    const th = lean0 + bend * Math.pow(t, 1.6);
    const st = Math.sin(th);
    const ct = Math.cos(th);
    const hw = wAt(t) / 2;
    const ht = tAt(t) / 2;
    // +W, +N, -W, -N 순서 — 이 차례가 바깥을 보는 감김을 만든다
    pos.push(px, py, hw);
    pos.push(px + ct * ht, py - st * ht, 0);
    pos.push(px, py, -hw);
    pos.push(px - ct * ht, py + st * ht, 0);
    if (i < seg) {
      const d = len / seg;
      px += st * d;
      py += ct * d;
    }
  }
  for (let i = 0; i < seg; i++) {
    for (let k = 0; k < 4; k++) {
      const k1 = (k + 1) % 4;
      const a0 = i * 4 + k;
      const b0 = i * 4 + k1;
      const a1 = (i + 1) * 4 + k;
      const b1 = (i + 1) * 4 + k1;
      idx.push(a0, b0, a1, b0, b1, a1);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array((pos.length / 3) * 2), 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  g.rotateY(yaw);
  g.translate(at[0], at[1], at[2]);
  return g;
}

// 바닥 케이블 트레이 — 옆 레일 둘 + **가로 발판(사다리)** + 그 속의 케이블
// 다발. 발판이 없으면 바닥에 놓인 각목이고, 다발이 없으면 빈 홈통이다.
// axis 'x' 면 x 를 따라 달리고 at 은 z 다 (벽 좌표계와 같은 규약).
function cableTray(b, axis, at, a0, a1, M, seed) {
  const W2 = 0.34;
  const HT = 0.09;
  const along = (t, off, y, w2, h, d2, m) =>
    axis === 'x' ? b.box(w2, h, d2, [t, y, at + off], m, 0) : b.box(d2, h, w2, [at + off, y, t], m, 0);
  const mid = (a0 + a1) / 2;
  const len = a1 - a0;
  for (const s of [-1, 1]) {
    along(mid, s * (W2 / 2), HT / 2, len, HT, 0.03, M.steelDark); // 옆 레일
    along(mid, s * (W2 / 2), HT - 0.008, len, 0.016, 0.05, M.steelDark); // 레일 윗턱
  }
  for (const t of fit(a0, a1, 0.26, 0.06)) along(t, 0, 0.012, 0.04, 0.024, W2, M.steelDark); // 발판
  // 케이블 다발 — 굵기·색이 다른 관 넷이 나란히 눕는다
  const CAB = [
    [0.032, -0.1, M.rubber],
    [0.026, -0.03, M.vendBlue],
    [0.022, 0.035, M.warn],
    [0.03, 0.1, M.rubber],
  ];
  for (const [r, off, m] of CAB) {
    const g = new THREE.CylinderGeometry(r, r, len - 0.04, 6);
    g.rotateZ(Math.PI / 2);
    if (axis !== 'x') g.rotateY(Math.PI / 2);
    g.translate(axis === 'x' ? mid : at + off, 0.026 + r, axis === 'x' ? at + off : mid);
    b.add(g, m);
  }
  // 이음 브래킷 — 2.5m 마다. 마디가 있어야 이어 붙인 트레이로 읽힌다
  for (const t of fit(a0, a1, 2.5, 0.5)) {
    along(t, 0, HT / 2 + 0.01, 0.05, HT + 0.03, W2 + 0.06, M.trim);
  }
  return Math.max(1, Math.round(len / 2.5));
}

// 정수기 — 몸통 · **거꾸로 얹힌 물통** · 꼭지 둘(냉·온) · 물받이 격자 · 컵통.
// 물통이 없으면 그냥 캐비닛이다 (90년대 사무실의 표식이다).
function waterCooler(b, w, u, M) {
  const put = (g, m) => wallPut(b, w, u, g, m);
  wallBox(b, w, u, 0.19, 0.48, 0.36, 0.96, 0.34, M.paper); // 몸통
  wallBox(b, w, u, 0.19, 0.03, 0.32, 0.06, 0.3, M.steelDark); // 굽
  wallBox(b, w, u, 0.19, 1.0, 0.38, 0.05, 0.36, M.trim); // 상판 턱
  // 물통 — 목이 아래로 꽂힌 원통. 위가 좁아지는 어깨가 있어야 물통이다.
  // **속의 물을 따로 낸다** — 껍데기만 유리(불투명도 0.24)로 두었더니 통이
  // 통째로 안 보이고 파란 뚜껑만 떠 있었다 (2026-08-06). 물이 든 통은
  // 물빛으로 읽힌다
  {
    const water = new THREE.CylinderGeometry(0.128, 0.128, 0.34, 12);
    water.translate(0, 1.21, 0.19);
    put(water, M.crate); // 속의 물 — 살짝 작게
    const body = new THREE.CylinderGeometry(0.14, 0.14, 0.4, 12);
    body.translate(0, 1.24, 0.19);
    put(body, M.glass); // 껍데기
    const sh = new THREE.CylinderGeometry(0.05, 0.14, 0.11, 12);
    sh.rotateZ(Math.PI); // 아래가 좁다 — 꽂히는 쪽
    sh.translate(0, 1.0, 0.19);
    put(sh, M.glass);
    const cap = new THREE.CylinderGeometry(0.14, 0.13, 0.03, 12);
    cap.translate(0, 1.45, 0.19);
    put(cap, M.vendBlue);
  }
  // 꼭지 둘 — 파랑(냉)·빨강(온). **관이 앞으로 나와 아래로 꺾이고**, 그 위에
  // 누르는 레버가 얹힌다. 관 토막에 색 상자를 붙여 두었더니 무엇을 누르는
  // 물건인지 안 읽혔다 (2026-08-06 "꼭지랑 밸브가 이상하게 생김").
  for (const [du, m] of [[-0.075, M.vendBlue], [0.075, M.vend]]) {
    const arm = new THREE.CylinderGeometry(0.011, 0.011, 0.1, 8);
    arm.rotateX(Math.PI / 2);
    arm.translate(du, 0.755, 0.4);
    put(arm, M.steelDark); // 앞으로 나온 관
    const el = new THREE.TorusGeometry(0.022, 0.011, 5, 8, Math.PI / 2);
    el.rotateY(Math.PI / 2);
    el.rotateZ(Math.PI);
    el.translate(du, 0.755, 0.45);
    put(el, M.steelDark); // 아래로 꺾이는 무릎
    const dn = new THREE.CylinderGeometry(0.009, 0.011, 0.05, 8);
    dn.translate(du, 0.71, 0.472);
    put(dn, M.steelDark); // 아래를 보는 토출구
    // 누르는 레버 — 관 위에 얹혀 뒤로 기운 판. 색이 냉·온을 가른다
    const lev = new THREE.BoxGeometry(0.055, 0.014, 0.075);
    lev.rotateX(-0.45);
    lev.translate(du, 0.805, 0.415);
    put(lev, m);
    const pin2 = new THREE.CylinderGeometry(0.007, 0.007, 0.06, 6);
    pin2.rotateZ(Math.PI / 2);
    pin2.translate(du, 0.79, 0.385);
    put(pin2, M.trim); // 레버 축
  }
  // 물받이 — 오목한 칸 + 격자 살
  wallBox(b, w, u, 0.36, 0.6, 0.24, 0.05, 0.06, M.steelDark);
  for (const du of [-0.07, 0, 0.07]) wallBox(b, w, u + du, 0.36, 0.625, 0.02, 0.008, 0.05, M.trim);
  // 종이컵통 — **벽에 건다** (몸통 옆구리에 띄워 두었더니 허공에 뜬 관이
  // 됐다, 2026-08-06). 브래킷 둘 + 관 + 아래로 삐져나온 컵 하나.
  //
  // 옆으로 밀 때는 **로컬 x 가 아니라 u 를 민다.** wallPut 의 로컬 +x 는
  // 축·inward 조합에 따라 세계에서 뒤집히므로(그 함수 머리말), 로컬 x 로
  // 밀면 wallBox 로 놓은 브래킷과 **반대쪽**으로 간다 — 실제로 관과 브래킷이
  // 정수기를 사이에 두고 갈라섰다 (2026-08-06).
  // **컵통은 뺐다** (2026-08-06 지시) — 벽에 건 관 하나가 정수기와 따로
  // 놀았다. 컵은 상판에 엎어 쌓는다 (아래).
  //
  // ── 몸통 마감 — 흰 상자에 꼭지만 달면 캐비닛이다 ────────────────────
  // 조각: 앞판 이음선 둘 · 상표 띠 · 온수 잠금 딱지 · 뒷면 방열 그릴 ·
  // 굽 발 넷 · 상판에 엎어 쌓은 종이컵.
  wallBox(b, w, u, 0.365, 0.63, 0.32, 0.008, 0.012, M.trim); // 앞판 이음선
  wallBox(b, w, u, 0.365, 0.24, 0.32, 0.008, 0.012, M.trim);
  wallBox(b, w, u, 0.368, 0.9, 0.22, 0.055, 0.008, M.vendBlue); // 상표 띠
  wallBox(b, w, u + 0.1, 0.368, 0.79, 0.065, 0.045, 0.006, M.warn); // 온수 잠금 딱지
  for (let k = 0; k < 5; k++) {
    wallBox(b, w, u, 0.022, 0.34 + k * 0.055, 0.24, 0.016, 0.014, M.rubber); // 뒷면 그릴
  }
  for (const s of [-1, 1]) {
    for (const dv of [0.07, 0.31]) {
      wallBox(b, w, u + s * 0.14, dv, 0.016, 0.055, 0.032, 0.055, M.rubber); // 발
    }
  }
  {
    // 엎어 쌓은 종이컵 줄 — 상판(1.0) 위. **굴러간 컵 하나는 뺐다**
    // (2026-08-06 지시) — 상판 밖으로 삐져나와 떠 있는 것으로 보였다
    const put3 = (g, m) => wallPut(b, w, u - 0.12, g, m);
    for (let k = 0; k < 4; k++) {
      const cp = new THREE.CylinderGeometry(0.031, 0.025, 0.02, 10);
      cp.translate(0, 1.035 + k * 0.017, 0.13);
      put3(cp, M.paper);
    }
  }
}

// 바인더 줄 — 책보다 두껍고 **등에 라벨 띠**가 있다. 그 띠가 없으면 책이다.
// 몇 권은 기울어 기대 있어야 뽑아 쓰던 선반으로 읽힌다 (bookRow 와 같은 규율).
function binderRow(b, w, u0, len, y, M, seed) {
  const PAL = [M.vendBlue, M.vend, M.crate, M.trim, M.plasticWarm];
  let t = 0.03;
  let i = 0;
  while (t < len - 0.06) {
    const r = hash2(seed * 11 + i, Math.round(y * 100) + i * 5);
    const th = 0.05 + r * 0.035;
    if (t + th > len - 0.06) break;
    const hgt = 0.29 + r * 0.03;
    const m = PAL[Math.floor(r * PAL.length) % PAL.length];
    const u = u0 + t + th / 2;
    if (r > 0.88) {
      const g = new THREE.BoxGeometry(th, hgt, 0.26);
      g.rotateZ(0.2);
      g.translate(0, hgt / 2, 0);
      const [px, , pz] = wallAt(w, u, 0.19, 0);
      g.translate(px, y, pz);
      b.add(g, m);
    } else {
      wallBox(b, w, u, 0.19, y + hgt / 2, th, hgt, 0.26, m);
      wallBox(b, w, u, 0.325, y + hgt * 0.72, th - 0.012, 0.07, 0.004, M.paper); // 등 라벨
    }
    t += th + 0.005;
    i++;
  }
  return i;
}

// ── 벽걸이 에어컨 실내기 ───────────────────────────────────────────────────
//
// 천장 밑에 붙는 가로로 긴 함체. **앞면이 둥글어야 에어컨이다** — 각진 상자는
// 배전함이다 (lessons 3.13.2). 조각: 둥근 몸통(상자 + 눕힌 반원기둥) ·
// 윗면 흡입 그릴 · 아래 토출구와 **풍향 날개**(기울인 판) · 표시창과 램프 ·
// 벽을 타고 내려가는 배관 커버.
function airCon(b, w, u, M, h) {
  const WID = 0.94;
  const HT = 0.28;
  const DEP = 0.19; // 상자 몸통 깊이 — 이 앞으로 반원이 더 나온다
  const R = HT / 2;
  const cy = h - 0.46; // 천장에서 한 뼘 내린다
  const yT = cy + R;
  const yB = cy - R;
  const put = (g, m) => wallPut(b, w, u, g, m);
  wallBox(b, w, u, DEP / 2, cy, WID, HT, DEP, M.paper); // 몸통 상자
  {
    // 앞면 — 벽을 따라 누운 반원기둥. 축을 로컬 x 로 돌리고(rotateZ) 둥근
    // 쪽이 방 안(+z)을 보게 한 번 더 돌린다(rotateX). 반원은 v = DEP 에서
    // DEP+R 까지만 차지하므로 **상자의 윗면·밑면은 가리지 않는다** —
    // 조각을 그 두 면에 놓아야 보인다 (처음에 토출구·표시창을 v<DEP 에
    // 두었다가 통째로 반원 속에 묻혔다, 2026-08-06).
    const g = new THREE.CylinderGeometry(R, R, WID, 14, 1, false, 0, Math.PI);
    g.rotateZ(-Math.PI / 2);
    g.rotateX(-Math.PI / 2);
    g.translate(0, cy, DEP);
    put(g, M.paper);
  }
  // 흡입 그릴 — **윗면**의 가로 슬롯 (사람 눈보다 위라 살짝만 보인다)
  for (let i = 0; i < 5; i++) {
    wallBox(b, w, u, 0.045 + i * 0.03, yT + 0.002, WID - 0.1, 0.008, 0.016, M.rubber);
  }
  // 토출구 — **밑면**의 어두운 홈. 아래에서 올려다보는 각이 이 물건의 정면이다
  wallBox(b, w, u, DEP / 2 + 0.01, yB - 0.014, WID - 0.14, 0.028, DEP - 0.04, M.rubber);
  {
    // 풍향 날개 — 홈 안에서 비스듬히 선 판. 바람을 아래-앞으로 보낸다
    const van = new THREE.BoxGeometry(WID - 0.17, 0.055, 0.014);
    van.rotateX(-0.9);
    van.translate(0, yB - 0.012, DEP - 0.02);
    put(van, M.trim);
  }
  // 표시창과 운전 램프 — **둥근 앞면 위**에 얹는다 (곡면에 붙은 작은 패널).
  // 반원 표면은 y 가 cy-0.1 일 때 v = DEP + sqrt(R^2 - 0.1^2) 이다
  const vs = DEP + Math.sqrt(Math.max(R * R - 0.01, 0.0001));
  wallBox(b, w, u + WID / 2 - 0.17, vs, cy - 0.1, 0.15, 0.05, 0.014, M.crtDark);
  wallBox(b, w, u + WID / 2 - 0.21, vs + 0.008, cy - 0.1, 0.022, 0.022, 0.01, M.exit);
  wallBox(b, w, u + WID / 2 - 0.135, vs + 0.008, cy - 0.1, 0.05, 0.024, 0.01, M.screen); // 온도 표시
  // ── 디테일 (2026-08-06 지적: 흰 통 하나로 보인다) ──────────────────────
  //
  // **배관 커버(벽을 타는 사각 봉)는 뺐다** — 지시. 실외기가 벽 너머라
  // 이야기는 성립했지만, 화면에서는 에어컨 옆에 세운 각목이었다.
  //
  // 대신 실내기 자체를 채운다: 앞판 이음선 · 필터를 여는 손잡이 홈 ·
  // 옆면 마감 캡 · 상표 · 벽 브래킷 · 드레인 호스.
  wallBox(b, w, u, vs - 0.01, cy + 0.055, WID - 0.06, 0.01, 0.012, M.trim); // 앞판 이음선
  wallBox(b, w, u - WID / 2 + 0.2, vs - 0.02, cy + 0.02, 0.16, 0.03, 0.012, M.trim); // 손잡이 홈
  wallBox(b, w, u - WID / 2 + 0.16, DEP + 0.03, cy - 0.09, 0.1, 0.024, 0.008, M.trim); // 상표
  // 옆면 마감 — **반원 끝을 덮는 원판**이다. 사각 판을 세웠더니 에어컨
  // 양옆에 정체불명의 네모가 붙어 있었다 (2026-08-06 "양쪽에 사각형은 뭐고").
  // 몸통과 같은 단면(반원)으로 덮어야 마감으로 읽힌다.
  for (const s of [-1, 1]) {
    const cap = new THREE.CylinderGeometry(R, R, 0.014, 14, 1, false, 0, Math.PI);
    cap.rotateZ(-Math.PI / 2);
    cap.rotateX(-Math.PI / 2);
    const [cx6, , cz6] = wallAt(w, u + s * (WID / 2 + 0.006), DEP, 0);
    cap.translate(cx6, cy, cz6);
    b.add(cap, M.paper);
    wallBox(b, w, u + s * (WID / 2 + 0.006), DEP / 2, cy, 0.012, HT, DEP, M.paper); // 상자부 옆판
  }
  for (const s of [-1, 1]) {
    wallBox(b, w, u + s * 0.3, 0.03, cy - HT / 2 - 0.03, 0.14, 0.05, 0.06, M.steelDark); // 벽 브래킷
  }
  // **드레인 호스는 뺐다** (2026-08-06 "저 회색 봉은 뭐임?") — 벽을 타고
  // 1m 내려가는 관이 에어컨과 상관없는 막대로 보였다. 배관은 벽 너머로
  // 나가는 것이 실제이므로, 몸통 밑의 짧은 접속구만 남긴다.
  {
    const [hx2, , hz2] = wallAt(w, u + WID / 2 - 0.1, 0.05, 0);
    tube(b, 0.016, 0.1, [hx2, cy - HT / 2 - 0.04, hz2], M.trim, 'y', 6);
  }
}

// ── 브라운관 텔레비전 ──────────────────────────────────────────────────────
//
// 책상 위 단말기(terminal)와 **다른 물건**이다: 자판이 없고, 대신 옆에
// **스피커 망**과 채널 손잡이가 있고, 위에 실내 안테나가 선다.
//
// **벽 좌표계로 짓는다** (+x 벽 따라, +z 방 안쪽). 세계 z 를 정면으로 삼아
// 지었더니 z-축 벽(방의 동·서 벽)에 놓는 순간 화면이 벽을 보고 돌아섰다 —
// 벽에 붙는 물건은 벽 좌표로 짓는다 (샤워 기둥에서 얻은 규칙과 같다).
// y0 은 TV 가 앉는 면(서랍장 천판)의 높이.
function crtTv(b, w, u, y0, M) {
  const W2 = 0.78;
  const H2 = 0.62;
  const put = (g, m) => wallPut(b, w, u, g, m);
  const bx = (w2, h2, d2, lx, ly, lz, m) => {
    const g = new THREE.BoxGeometry(w2, h2, d2);
    g.translate(lx, ly, lz);
    put(g, m);
  };
  const cy = y0 + H2 / 2;
  // 몸통 — 뒤로 좁아진다 (브라운관의 목). 두 토막으로 테이퍼를 낸다
  bx(W2, H2, 0.44, 0, cy, 0.24, M.crt);
  bx(W2 - 0.24, H2 - 0.2, 0.2, 0, cy, 0.05, M.crt);
  // 베젤과 화면 — 화면은 베젤보다 **앞으로** 나온다 (겹평면 금지, #65)
  const fz = 0.47;
  bx(W2 - 0.02, H2 - 0.03, 0.03, 0, cy, fz, M.crtDark);
  bx(0.6, 0.45, 0.014, -0.05, cy + 0.03, fz + 0.016, M.screen);
  // 스피커 망 — 화면 옆 세로 띠. 이것이 모니터와 TV 를 가른다
  bx(0.11, 0.4, 0.012, 0.31, cy + 0.03, fz + 0.014, M.rubber);
  for (let i = 0; i < 7; i++) {
    bx(0.09, 0.012, 0.014, 0.31, y0 + 0.22 + i * 0.055, fz + 0.018, M.crtDark);
  }
  // 채널·음량 손잡이 둘과 버튼 줄 — 화면 아래
  for (const [du, r] of [[0.24, 0.035], [0.33, 0.028]]) {
    const g = new THREE.CylinderGeometry(r, r, 0.022, 10);
    g.rotateX(Math.PI / 2);
    g.translate(du, y0 + 0.1, fz + 0.018);
    put(g, M.crtDark);
  }
  for (const du of [-0.3, -0.24, -0.18]) bx(0.04, 0.014, 0.01, du, y0 + 0.1, fz + 0.016, M.trim);
  // 실내 안테나 — V 자로 벌어진 관 둘. 90년대 TV 의 표식이다
  {
    const base = new THREE.CylinderGeometry(0.045, 0.055, 0.03, 10);
    base.translate(-0.2, y0 + H2 + 0.015, 0.16);
    put(base, M.crtDark);
    for (const s of [-1, 1]) {
      const g = new THREE.CylinderGeometry(0.006, 0.009, 0.52, 6);
      g.rotateZ(s * 0.55);
      g.rotateX(-0.2);
      g.translate(-0.2 + s * 0.13, y0 + H2 + 0.27, 0.13);
      put(g, M.trim);
    }
  }
}

// ── 서랍장 — 비품장·TV 받침이 나눠 쓴다 ────────────────────────────────────
//
// 조각: 몸통(옆판·천판·굽) · **앞으로 돌출한 서랍 앞판** · 가로 손잡이 ·
// 라벨 꽂이. 앞판이 몸통과 같은 평면이면 여닫는 물건으로 안 읽힌다.
// open 이면 서랍 하나가 빠져나오고 그 속이 보인다.
function drawerCabinet(b, w, u, M, wid, hgt, dep, n, open = -1) {
  wallBox(b, w, u, dep / 2, hgt / 2 + 0.06, wid, hgt, dep, M.laminate); // 몸통
  wallBox(b, w, u, dep / 2, 0.03, wid, 0.06, dep - 0.04, M.trim); // 굽
  wallBox(b, w, u, dep / 2, hgt + 0.075, wid + 0.03, 0.03, dep + 0.02, M.laminate); // 천판
  const dh = (hgt - 0.05) / n;
  for (let i = 0; i < n; i++) {
    const y = 0.09 + dh * (i + 0.5);
    const out = i === open ? 0.26 : 0;
    wallBox(b, w, u, dep + 0.012 + out, y, wid - 0.05, dh - 0.02, 0.024, M.trim); // 앞판
    wallBox(b, w, u, dep + 0.035 + out, y + 0.01, wid * 0.42, 0.026, 0.022, M.steel); // 손잡이
    wallBox(b, w, u - wid * 0.3, dep + 0.03 + out, y - dh * 0.28, 0.14, 0.045, 0.006, M.paper); // 라벨
    if (i === open) {
      // ── 빠진 서랍 — **앞판 바로 뒤에 매달린 상자**다 ──────────────────
      //
      // 속 조각의 깊이를 `dep*0.9 + out` 로 두었더니 상자가 앞판을 뚫고
      // 나가고 뒤로도 함체를 뚫어, 서랍이 두 겹으로 겹쳐 보였다
      // (2026-08-06 "??"). 서랍은 **앞판에서 안쪽으로 자기 깊이만큼**만
      // 차지한다 — 앞면 v = dep + out, 뒷면 v = dep + out - DD.
      const DD = dep * 0.8;
      const vc = dep + out - DD / 2; // 서랍 상자의 중심 깊이
      const dy2 = y - dh * 0.5 + 0.02; // 서랍 바닥
      wallBox(b, w, u, vc, dy2, wid - 0.07, 0.018, DD, M.steelDark); // 바닥
      for (const s of [-1, 1]) {
        wallBox(b, w, u + s * (wid / 2 - 0.045), vc, y - 0.01, 0.016, dh - 0.05, DD, M.steelDark); // 옆판
      }
      wallBox(b, w, u, dep + out - DD + 0.008, y - 0.01, wid - 0.07, dh - 0.05, 0.016, M.steelDark); // 뒷판
      // 속 내용물 — 서류철 줄. 빈 서랍은 처음부터 빈 가구다
      for (let k = 0; k < 4; k++) {
        wallBox(b, w, u - 0.2 + k * 0.13, vc, dy2 + 0.07, 0.04, 0.11, DD - 0.06,
          [M.carton, M.paper, M.crate, M.carton][k]);
      }
      wallBox(b, w, u, dep + 0.012, y, wid - 0.09, dh - 0.03, 0.01, M.rubber); // 서랍이 나간 구멍
    }
  }
}

// ── 복합기 — 복사·인쇄·스캔을 한 몸에 (사무실의 큰 기계) ───────────────────
//
// 조각: 몸통 · **위의 스캐너 뚜껑**(경첩으로 살짝 들린다) · 조작반(경사 판 +
// 버튼) · 용지함 서랍 둘(하나는 반쯤 열려 종이가 보인다) · 배출 트레이와
// 그 위에 쌓인 출력물 · 바퀴. 민짜 상자는 그냥 캐비닛이다.
function copier(b, w, u, M) {
  const WID = 0.72;
  const DEP = 0.62;
  const BH = 0.78; // 몸통 높이
  const put = (g, m) => wallPut(b, w, u, g, m);
  wallBox(b, w, u, DEP / 2, BH / 2 + 0.05, WID, BH, DEP, M.crt); // 몸통
  wallBox(b, w, u, DEP / 2, 0.025, WID - 0.06, 0.05, DEP - 0.06, M.crtDark); // 굽
  for (const s of [-1, 1]) {
    for (const dv of [0.14, DEP - 0.14]) {
      const g = new THREE.CylinderGeometry(0.035, 0.035, 0.022, 8);
      g.rotateZ(Math.PI / 2);
      g.translate(s * (WID / 2 - 0.06), 0.035, dv);
      put(g, M.rubber); // 바퀴
    }
  }
  // 배출 트레이 — 몸통 중간에 파인 홈 + 그 위에 쌓인 종이
  wallBox(b, w, u, DEP / 2 + 0.02, 0.86, WID - 0.1, 0.09, DEP - 0.06, M.crtDark);
  wallBox(b, w, u, DEP / 2 + 0.04, 0.9, WID - 0.22, 0.02, DEP - 0.24, M.paper);
  // 스캐너 상부 — 유리판 + **살짝 들린 뚜껑** (경첩은 벽 쪽 모서리)
  wallBox(b, w, u, DEP / 2, 0.95, WID, 0.06, DEP, M.crt);
  wallBox(b, w, u, DEP / 2 + 0.01, 0.985, WID - 0.14, 0.012, DEP - 0.16, M.glass);
  {
    const lid = new THREE.BoxGeometry(WID - 0.04, 0.04, DEP - 0.06);
    lid.translate(0, 0, (DEP - 0.06) / 2);
    lid.rotateX(-0.22); // 경첩(벽 쪽)을 원점에 두고 앞이 들린다
    lid.translate(0, 1.005, 0.05);
    put(lid, M.crt);
  }
  // ── 조작반 — **몸통 앞으로 튀어나온 선반**이다 ─────────────────────────
  //
  // 스캐너 상판보다 뒤(DEP-0.02)에 두었더니 판이 몸통 속으로 들어가 앉아
  // "패널이 왜 안에 있냐" 는 말을 들었다 (2026-08-06). 실물 복합기의 조작반은
  // 앞으로 **내밀어 얹혀 있고**, 그래야 서서 누른다.
  {
    const shelf2 = new THREE.BoxGeometry(WID - 0.1, 0.03, 0.2);
    shelf2.translate(0, 0.935, DEP + 0.08);
    put(shelf2, M.crt); // 내민 받침
    const pan = new THREE.BoxGeometry(WID - 0.14, 0.022, 0.19);
    pan.rotateX(-0.42);
    pan.translate(0, 0.975, DEP + 0.08);
    put(pan, M.crtDark);
    const scr = new THREE.BoxGeometry(0.2, 0.014, 0.07);
    scr.rotateX(-0.42);
    scr.translate(-0.14, 1.0, DEP + 0.055);
    put(scr, M.screen);
    for (let i = 0; i < 6; i++) {
      const btn = new THREE.BoxGeometry(0.036, 0.014, 0.03);
      btn.rotateX(-0.42);
      btn.translate(0.05 + (i % 3) * 0.055, 1.005 - Math.floor(i / 2) * 0.012, DEP + 0.045 + Math.floor(i / 3) * 0.045);
      put(btn, i === 0 ? M.exit : i === 1 ? M.vend : M.keycap);
    }
  }
  // ── 용지함 — **얕은 카세트**다 (서랍이 아니다) ─────────────────────────
  //
  // 깊이 0.2 로 빼 놓았더니 사무 책상 서랍이 달린 것처럼 보였다
  // (2026-08-06 "복합기에 왜 서랍이 달려있지"). 실물은 몸통 앞면과 거의
  // 같은 면에 있고, **손잡이 홈과 잔량 창**으로 카세트임을 말한다.
  for (const [y, sz2] of [[0.52, 1], [0.3, 1], [0.14, 0.6]]) {
    wallBox(b, w, u, DEP + 0.008, y, WID - 0.06, 0.15 * sz2, 0.018, M.crtDark); // 앞면
    wallBox(b, w, u, DEP + 0.02, y + 0.03, WID * 0.3, 0.02, 0.016, M.trim); // 손잡이 홈
    wallBox(b, w, u + WID / 2 - 0.1, DEP + 0.02, y - 0.03, 0.05, 0.03, 0.012, M.paper); // 잔량 창
  }
  // 살짝 열린 카세트 하나 — 종이 끝이 보인다 (전부 닫히면 안 쓰는 기계다)
  wallBox(b, w, u, DEP + 0.06, 0.3, WID - 0.06, 0.15, 0.018, M.crtDark);
  wallBox(b, w, u, DEP + 0.03, 0.245, WID - 0.14, 0.02, 0.12, M.paper);
}

// 벽걸이 공구판 — 타공판 + 걸린 공구들. 공구가 **저마다 다른 실루엣**이어야
// 공구판이다 (같은 막대 줄이면 울타리다): 스패너·망치·드라이버·집게·톱.
function toolWall(b, w, u, M) {
  const BW = 1.5;
  const BH = 0.9;
  const cy = 1.62;
  wallBox(b, w, u, 0.03, cy, BW, BH, 0.03, M.trim); // 타공판
  // 타공 — 격자 점. 판을 판으로만 두면 벽에 붙인 널이다
  for (let r = 0; r < 5; r++) {
    for (let k = 0; k < 9; k++) {
      wallBox(b, w, u - 0.6 + k * 0.15, 0.047, cy + 0.32 - r * 0.16, 0.016, 0.016, 0.004, M.rubber);
    }
  }
  const put = (g, m) => wallPut(b, w, u, g, m);
  // 스패너 셋 — 자루(관) + 양 끝의 열린 입(짧은 상자 둘)
  for (let i = 0; i < 3; i++) {
    const du = -0.58 + i * 0.16;
    const L = 0.34 - i * 0.05;
    const st = new THREE.CylinderGeometry(0.011, 0.011, L, 6);
    st.translate(du, cy + 0.12 - L / 2, 0.075);
    put(st, M.steel);
    for (const s of [1, -1]) {
      const jaw = new THREE.BoxGeometry(0.045, 0.05, 0.014);
      jaw.translate(du, cy + 0.12 - (s > 0 ? 0 : L), 0.075);
      put(jaw, M.steel);
    }
  }
  // 망치 — 나무 자루 + 쇠머리 + 갈라진 발톱
  {
    const hd = new THREE.CylinderGeometry(0.014, 0.016, 0.3, 6);
    hd.translate(0.02, cy - 0.06, 0.075);
    put(hd, M.laminate);
    const head = new THREE.BoxGeometry(0.11, 0.045, 0.045);
    head.translate(0.02, cy + 0.11, 0.075);
    put(head, M.steelDark);
    const claw = new THREE.BoxGeometry(0.05, 0.035, 0.03);
    claw.rotateZ(-0.4);
    claw.translate(-0.05, cy + 0.1, 0.075);
    put(claw, M.steelDark);
  }
  // 드라이버 줄 — 손잡이(굵은 관)와 축(가는 관). 굵기 차이가 드라이버다
  for (let i = 0; i < 4; i++) {
    const du = 0.16 + i * 0.075;
    const grip = new THREE.CylinderGeometry(0.017, 0.014, 0.1, 6);
    grip.translate(du, cy + 0.16, 0.072);
    put(grip, i % 2 ? M.warn : M.vend);
    const shaft = new THREE.CylinderGeometry(0.005, 0.005, 0.16 + i * 0.02, 5);
    shaft.translate(du, cy + 0.03 - i * 0.01, 0.072);
    put(shaft, M.steel);
  }
  // 집게 — 팔 둘이 X 로 벌어진다
  for (const s of [-1, 1]) {
    const arm = new THREE.CylinderGeometry(0.008, 0.012, 0.26, 5);
    arm.rotateZ(s * 0.16);
    arm.translate(0.5 + s * 0.02, cy - 0.06, 0.072);
    put(arm, M.steelDark);
  }
  wallBox(b, w, u + 0.5, 0.072, cy + 0.08, 0.03, 0.03, 0.03, M.steel); // 집게 축
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
  // 선은 안 낸다 — 관 하나로는 **책상 위에 놓인 막대**로만 보였다
  // (2026-08-06 지적 "마우스 밑에 있는 저거 없애기"). 진짜 케이블은 늘어지고
  // 꼬여야 하는데 그 값어치가 이 크기에서는 안 나온다.
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
      const ax = run.axis === 'x';
      const y0 = H.door + 0.2;
      const wide = (a2, b2) => (ax ? [a2, b2] : [b2, a2]); // 벽을 따라 / 벽을 가로질러
      b.mark('sign', `exit:${run.from}-${run.to}`);
      // 함체와 발광판 둘뿐이면 초록 판때기다. 유도등을 유도등으로 만드는 것:
      // **글자 자리(어두운 막대)** · 방향 화살표 · 천장으로 올라가는 브래킷 ·
      // 아래 테두리. 진짜 글자는 문 팻말(roomSigns)의 몫이고, 이 크기에서는
      // 실루엣만 있으면 읽힌다.
      b.box(...wide(0.34, 0.15), 0.16, [x, y0, z], M.trim, 0); // 함체
      for (const d of [-1, 1]) {
        const off = d * 0.082;
        const p = ax ? [x, y0, z + off] : [x + off, y0, z];
        b.box(...wide(0.28, 0.022), 0.11, p, M.exit, 0); // 발광판
        // 글자 자리 — 굵은 막대 넷 (E X I T)
        for (let k = 0; k < 4; k++) {
          const du = -0.09 + k * 0.06;
          const q = ax ? [x + du, y0 + 0.004, z + d * 0.095] : [x + d * 0.095, y0 + 0.004, z + du];
          b.box(...wide(0.036, 0.012), 0.055, q, M.rubber, 0);
        }
        // 방향 화살표 — 삼각 프리즘. 문 쪽을 가리킨다
        const tri = new THREE.CylinderGeometry(0.026, 0.026, 0.012, 3);
        tri.rotateX(Math.PI / 2);
        tri.rotateZ(d > 0 ? -Math.PI / 2 : Math.PI / 2);
        if (!ax) tri.rotateY(Math.PI / 2);
        tri.translate(ax ? x + 0.115 : x + d * 0.095, y0 - 0.005, ax ? z + d * 0.095 : z + 0.115);
        b.add(tri, M.rubber);
      }
      b.box(...wide(0.34, 0.17), 0.018, [x, y0 - 0.084, z], M.steelDark, 0); // 아래 테
      b.box(...wide(0.06, 0.06), 0.34, [x, y0 + 0.25, z], M.trim, 0); // 천장 브래킷
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
    // **글자는 앞면에만 있어야 한다.** 상자로 내면 여섯 면 전부에 같은
    // 텍스처가 붙어, 옆에서 보면 두께 1.8cm 에 글자가 짓눌려 들어간다
    // (2026-08-06 지적 — 스크린샷의 팻말 옆구리에 CANTEEN 이 또 있었다).
    // 판은 **평면(PlaneGeometry)** 으로 내고, 두께는 그 뒤의 틀이 맡는다.
    const yaw = run.axis === 'x' ? (inward > 0 ? 0 : Math.PI) : inward > 0 ? Math.PI / 2 : -Math.PI / 2;
    const at = run.axis === 'x'
      ? [u, 1.72, run.at + inward * (W.wall / 2 + 0.004)]
      : [run.at + inward * (W.wall / 2 + 0.004), 1.72, u];
    const back = new THREE.BoxGeometry(PW + 0.02, PH2 + 0.02, 0.016);
    back.rotateY(yaw);
    back.translate(at[0], at[1], at[2]);
    b.add(back, M.trim); // 틀 — 두께는 이쪽이 맡는다
    const face = new THREE.PlaneGeometry(PW, PH2);
    face.rotateY(yaw);
    face.translate(
      at[0] + (run.axis === 'x' ? 0 : inward * 0.009),
      at[1],
      at[2] + (run.axis === 'x' ? inward * 0.009 : 0)
    );
    b.add(face, M.signOf(label));
    b.endMark();
    tally.roomSign = (tally.roomSign ?? 0) + 1;
  }
}

// 복도 벽 — 소화기함·게시판·표지. 길이에서 개수를 뽑는다.
function corridorWalls(b, c, M, tally) {
  for (const w of interiorWalls(c.id)) {
    const len = w.b - w.a;
    if (len < 1.2) continue;
    // 9m 마다 소화기, 8m 마다 게시판.
    // **간격이 12m 였을 때 소화기함이 층 전체에 0개였다** — fit 은 여유
    // (margin*2 + pitch*0.9) 를 못 채우면 빈 배열을 돌려주는데, 이 층에서
    // 제일 긴 복도 벽이 12.6m 라 12m 격자는 한 칸도 못 앉았다. 개수를 세
    // 보고서야 알았다 (lessons 3.4 — 개수는 밀도에서 나온다).
    for (const t of fit(0, len, 9, 0.8)) {
      const u = w.a + t;
      b.mark('fixture', `extinguisher:${c.id}`);
      // 소화기함 — 붉은 상자에 유리판을 **같은 중심**으로 겹쳐 두었더니 유리가
      // 통째로 상자 속에 묻혀, 복도마다 붉은 널판만 서 있었다 (자판기 #64 와
      // 같은 병, 2026-08-06 디테일 패스에서 발견).
      //
      // 함을 함으로 만드는 것: **뒷칸(속이 어둡다)** · 둘레 틀 넷 · 그 앞의
      // 유리문 · 경첩과 걸쇠 · 이름 띠 · 그리고 **안에 보이는 소화기**.
      const CW2 = 0.34;
      const CH2 = 0.72;
      const cy2 = 1.14;
      wallBox(b, w, u, 0.055, cy2, CW2, CH2, 0.11, M.vend); // 뒷칸
      wallBox(b, w, u, 0.062, cy2, CW2 - 0.05, CH2 - 0.05, 0.1, M.rubber); // 속 어둠
      // ── 안의 소화기 — **붉은 함에 붉은 통**이라 안 보였다 ──────────────
      //
      // 유리 너머로 "붉은 화살표 하나" 로만 읽혔다 (2026-08-06 "이게 뭔지").
      // 어두운 속을 배경으로 두고 통을 **밝은 은색 머리와 흰 라벨**로 갈라
      // 실루엣이 서게 한다 — 같은 색끼리 겹치면 형태가 사라진다.
      {
        const put2 = (g, m) => wallPut(b, w, u, g, m);
        const cy3 = (r0, r1, hh, ly, m, seg = 12) => {
          const g = new THREE.CylinderGeometry(r0, r1, hh, seg);
          g.translate(0, ly, 0.068);
          put2(g, m);
        };
        cy3(0.062, 0.062, 0.4, 1.0, M.vend); // 몸통
        cy3(0.028, 0.062, 0.085, 1.243, M.vend); // 어깨
        cy3(0.022, 0.022, 0.05, 1.31, M.steel); // 목 — 은색
        cy3(0.066, 0.066, 0.018, 0.805, M.steelDark); // 바닥 굽테
        wallBox(b, w, u, 0.075, 1.355, 0.06, 0.05, 0.07, M.steel); // 밸브 머리
        wallBox(b, w, u, 0.08, 1.383, 0.035, 0.014, 0.09, M.trim); // 레버
        wallBox(b, w, u, 0.082, 1.09, 0.1, 0.13, 0.006, M.paper); // 흰 라벨
        wallBox(b, w, u, 0.086, 1.12, 0.07, 0.03, 0.004, M.vend); // 라벨 글줄
        // 호스 — 몸통 옆으로 늘어진다
        const hose2 = new THREE.TorusGeometry(0.075, 0.009, 5, 10, Math.PI * 0.9);
        hose2.rotateY(Math.PI / 2);
        hose2.rotateZ(0.4);
        hose2.translate(0.05, 1.2, 0.068);
        put2(hose2, M.rubber);
      }
      // 둘레 틀 넷 — 유리보다 앞으로 나온다 (겹평면 금지)
      for (const [du, dy, wid, hh] of [
        [0, CH2 / 2, CW2, 0.05],
        [0, -CH2 / 2, CW2, 0.05],
        [-CW2 / 2 + 0.022, 0, 0.045, CH2],
        [CW2 / 2 - 0.022, 0, 0.045, CH2],
      ]) {
        wallBox(b, w, u + du, 0.135, cy2 + dy, wid, hh, 0.05, M.vend);
      }
      wallBox(b, w, u, 0.118, cy2, CW2 - 0.07, CH2 - 0.07, 0.01, M.glass); // 유리문
      for (const dy of [0.18, -0.18]) {
        wallBox(b, w, u - CW2 / 2 + 0.02, 0.15, cy2 + dy, 0.03, 0.05, 0.03, M.steelDark); // 경첩
      }
      wallBox(b, w, u + CW2 / 2 - 0.03, 0.15, cy2, 0.025, 0.07, 0.035, M.steel); // 걸쇠
      wallBox(b, w, u, 0.14, cy2 + CH2 / 2 + 0.07, CW2, 0.09, 0.014, M.paper); // 이름 띠
      wallBox(b, w, u, 0.148, cy2 + CH2 / 2 + 0.07, CW2 - 0.1, 0.03, 0.006, M.vend);
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
    for (const t of fit(0, len, 8, 1.8)) {
      const u = w.a + t;
      b.mark('sign', `board:${c.id}`);
      // 게시판 — 틀과 흰 판 둘로는 **빈 액자**다. 코르크 판에 크기·각도가
      // 제각각인 종이가 압정으로 꽂혀 있어야 "사람이 붙이고 간" 판이 된다
      // (플라자 자립 게시판과 같은 문법).
      wallBox(b, w, u, 0.03, 1.6, 1.12, 0.82, 0.03, M.trim); // 틀
      wallBox(b, w, u, 0.05, 1.6, 1.0, 0.7, 0.02, M.cartonDark); // 코르크
      for (const dy of [0.41, -0.41]) wallBox(b, w, u, 0.055, 1.6 + dy, 1.16, 0.05, 0.05, M.trim); // 위아래 테
      for (let i = 0; i < 6; i++) {
        const r = hash2(Math.round(u * 7) + i, Math.round(w.at * 11));
        const pw = 0.18 + r * 0.13;
        const ph = 0.2 + r * 0.09;
        const du = -0.36 + (i % 3) * 0.36;
        const py = 1.74 - Math.floor(i / 3) * 0.3;
        const g = new THREE.BoxGeometry(pw, ph, 0.006);
        g.rotateZ((r - 0.5) * 0.22);
        g.translate(du, py, 0.068);
        wallPut(b, w, u, g, r > 0.78 ? M.warn : M.paper);
        // 압정 — 종이를 붙드는 것. 없으면 벽지 무늬다
        const pin = new THREE.CylinderGeometry(0.007, 0.007, 0.012, 6);
        pin.rotateX(Math.PI / 2);
        pin.translate(du, py + ph / 2 - 0.025, 0.076);
        wallPut(b, w, u, pin, r > 0.5 ? M.vend : M.exit);
      }
      b.endMark();
      tally.board = (tally.board ?? 0) + 1;
    }
  }

  // ── 긴 복도에만 (status.md 5.0 A) ─────────────────────────────────────
  //
  // 정수기·층 안내도·화분은 **띠 복도(bandN·bandS)** 처럼 긴 벽이 있는
  // 곳에만 둔다. 짧은 고리 조각마다 놓으면 층이 자판기 전시장이 된다.
  // 엘리베이터 베이는 건너뛴다 — 그 벽은 문짝 두 벌이 쓰고 있다.
  if (c.use === 'elev') return;
  const long = interiorWalls(c.id)
    .filter((q) => q.rule === 'solid' && q.b - q.a >= 6.0)
    .sort((p, q) => q.b - q.a - (p.b - p.a))[0];
  if (!long) return;
  const L = long.b - long.a;
  b.mark('furniture', `cooler:${c.id}`);
  waterCooler(b, long, long.a + L * 0.22, M);
  tally.cooler = (tally.cooler ?? 0) + 1;
  b.endMark();
  // 층 안내도 — 액자 + 도면 바탕 + **방 칸들**(색 사각 여럿) + 현재 위치 점.
  // 흰 판만 걸면 게시판과 구별이 안 된다
  b.mark('sign', `floorplan:${c.id}`);
  {
    // 층 안내도 — 색 사각 여덟만 흩어 놓았더니 "뭔지도 모르겠음" 이었다
    // (2026-08-06 지적). 안내도를 안내도로 만드는 것:
    //   **머리 띠와 제목** · 벽선으로 나뉜 방 칸들 · 방마다 이름 글줄 ·
    //   복도 띠(십자) · 현재 위치 표와 그 라벨 · 범례 줄 · 유리와 액자.
    const u = long.a + L * 0.62;
    const px8 = (du, v2, y, wid, hh, th, m) => wallBox(b, long, u + du, v2, y, wid, hh, th, m);
    px8(0, 0.02, 1.62, 1.06, 0.8, 0.03, M.trim); // 액자
    px8(0, 0.038, 1.62, 0.96, 0.7, 0.008, M.paper); // 바탕
    px8(0, 0.046, 1.92, 0.96, 0.1, 0.006, M.vendBlue); // 머리 띠
    px8(-0.12, 0.052, 1.92, 0.5, 0.035, 0.006, M.paper); // 제목 글줄
    // 복도 — 도면을 읽히게 하는 것은 방이 아니라 **복도의 십자**다
    px8(0, 0.046, 1.6, 0.86, 0.05, 0.005, M.trim);
    px8(0.02, 0.046, 1.6, 0.05, 0.44, 0.005, M.trim);
    // 방 칸 여덟 — 복도를 사이에 두고 위아래로. 칸마다 이름 글줄이 있다
    for (let i = 0; i < 8; i++) {
      const r = hash2(i * 7, 41);
      const w2 = 0.16 + r * 0.06;
      const h2 = 0.13 + (1 - r) * 0.04;
      const du = -0.36 + (i % 4) * 0.24;
      const y = i < 4 ? 1.74 : 1.44;
      px8(du, 0.046, y, w2, h2, 0.004, i === 5 ? M.plastic : M.crt);
      px8(du, 0.05, y + 0.005, w2 - 0.06, 0.014, 0.004, M.paper); // 방 이름
    }
    // 현재 위치 — 붉은 표(원 + 꼭짓점이 아래를 보는 삼각)와 라벨
    {
      const dot = new THREE.CylinderGeometry(0.025, 0.025, 0.012, 10);
      dot.rotateY(wallYaw(long));
      dot.rotateX(Math.PI / 2);
      const [dx2, , dz2] = wallAt(long, u + 0.02, 0.054, 0);
      dot.translate(dx2, 1.61, dz2);
      b.add(dot, M.vend);
      const tri = new THREE.CylinderGeometry(0.028, 0.028, 0.01, 3);
      tri.rotateY(wallYaw(long));
      tri.rotateX(Math.PI / 2);
      tri.translate(dx2, 1.655, dz2);
      b.add(tri, M.vend);
      px8(0.2, 0.05, 1.61, 0.16, 0.02, 0.004, M.vend); // "현 위치" 라벨
    }
    // 범례 — 아래쪽 짧은 줄 셋 (색 칩 + 글줄)
    for (let k = 0; k < 3; k++) {
      px8(-0.36 + k * 0.3, 0.048, 1.31, 0.03, 0.022, 0.004, [M.crt, M.plastic, M.exit][k]);
      px8(-0.29 + k * 0.3, 0.048, 1.31, 0.1, 0.014, 0.004, M.trim);
    }
    px8(0, 0.058, 1.62, 0.94, 0.68, 0.006, M.glass); // 유리
    tally.floorPlan = (tally.floorPlan ?? 0) + 1;
  }
  b.endMark();
  b.mark('furniture', `planter:${c.id}`);
  {
    const [px, , pz] = wallAt(long, long.a + L * 0.86, 0.42, 0);
    planter(b, px, pz, M, Math.round(long.at * 3) + 11);
    tally.planter = (tally.planter ?? 0) + 1;
  }
  b.endMark();
}

// ── 칸 종류별 ──────────────────────────────────────────────────────────────

// 긴 식탁 하나 + 둘러앉은 의자 — 식당과 카페가 나눠 쓴다
function longTable(b, x, z, M, I, tally) {
  const tb = I.spawn('table');
  tb.box(2.0, 0.06, 0.8, [x, 0.74, z], M.laminate, 0);
  tb.box(2.02, 0.02, 0.82, [x, 0.706, z], M.trim, 0); // 상판 밑 테두리 — 판때기와 식탁을 가른다
  // 다리 — **관**이다 (각목 다리는 식탁이 아니다). 양쪽 ㄷ 자 틀 + 세로 버팀
  for (const dx of [-0.85, 0.85]) {
    for (const dz of [-0.32, 0.32]) {
      tube(tb, 0.022, 0.7, [x + dx, 0.35, z + dz], M.trim, 'y', 6);
      tb.box(0.09, 0.02, 0.09, [x + dx, 0.01, z + dz], M.steelDark, 0); // 발
    }
    const rail = new THREE.CylinderGeometry(0.02, 0.02, 0.64, 6);
    rail.rotateX(Math.PI / 2);
    rail.translate(x + dx, 0.16, z);
    tb.add(rail, M.trim); // 다리 사이 가로대
  }
  {
    const br = new THREE.CylinderGeometry(0.018, 0.018, 1.7, 6);
    br.rotateZ(Math.PI / 2);
    br.translate(x, 0.16, z);
    tb.add(br, M.trim); // 두 다리를 잇는 세로 버팀
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

  // 에어컨 — 서쪽 외벽 위. 사람이 몰리는 방이라 냉방이 있다
  const wac = interiorWalls(c.id)
    .filter((q) => q.axis === 'z' && q.rule === 'solid' && q.b - q.a > 2.0)
    .sort((p, q) => p.at - q.at)[0];
  if (wac) {
    b.mark('service', `aircon:${c.id}`);
    airCon(b, wac, (wac.a + wac.b) / 2, M, c.h);
    tally.airCon = (tally.airCon ?? 0) + 1;
    b.endMark();
  }
}

// 주방 — 배식 카운터(식당 경계) · 조리 라인(레인지·후드) · 싱크 · 냉장고 ·
// 냄비 선반. 버너·냄비·싱크볼은 **원기둥**이다 (lessons.md 3.13.2).
function kitchen(b, c, M, tally, I) {
  const cx = (c.x0 + c.x1) / 2;

  // ── 배식 카운터 — 남쪽 경계(식당과 트인 곳)에 선다. 트레이 레일은 관 ──
  b.mark('furniture', `serving:${c.id}`);
  const zS = c.z0 + 0.55;
  // **길이를 반으로** (2026-08-06 지시) — 7.7m 짜리 배식대가 방의 남쪽 변을
  // 통째로 막아 주방이 복도처럼 보였다. 남은 절반은 케이크 전시대가 쓴다.
  const len = (c.x1 - c.x0 - 1.6) / 2;
  const svX = c.x0 + 0.8 + len / 2; // 서쪽 절반
  b.box(len, 0.92, 0.75, [svX, 0.46, zS], M.steel, 0);
  b.box(len + 0.1, 0.05, 0.85, [svX, 0.945, zS], M.laminate, 0);
  for (const v of [-0.52, -0.44, -0.36]) {
    tube(b, 0.016, len, [svX, 0.9, zS + v], M.trim, 'x', 6);
  }
  // 위생 가림판 — 카운터 위 유리와 지지 기둥
  b.box(len - 0.4, 0.38, 0.015, [svX, 1.32, zS - 0.1], M.glass, 0);
  for (const t of fit(0, len - 0.4, 1.6, 0.2)) {
    b.box(0.03, 0.34, 0.03, [svX - (len - 0.4) / 2 + t, 1.1, zS - 0.1], M.trim, 0);
  }
  // ── 배식 웰 — 셋. 하나만 뚫리면 **싱크대**로 보인다 ────────────────────
  //
  // 배식대를 절반으로 줄이면서 웰 간격(1.35)이 그대로라 한 칸밖에 안 앉았고,
  // 그 결과 "이 테이블은 뭐하는 테이블인지 분간이 안 됨" 이 됐다 (2026-08-06).
  // 배식대를 배식대로 만드는 것은 **줄지어 뚫린 웰과 그 안의 음식**이다 —
  // 빈 구덩이는 개수가 몇이든 싱크다.
  const WELL = [
    [M.plasticWarm, M.warn], // 국·반찬
    [M.paper, M.carton],
    [M.crate, M.plasticWarm],
  ];
  const wpitch = (len - 1.0) / 3;
  for (let k = 0; k < 3; k++) {
    const wx = svX - (len - 1.0) / 2 + wpitch * (k + 0.5);
    b.box(wpitch - 0.1, 0.024, 0.52, [wx, 0.972, zS], M.steelDark, 0); // 테두리
    b.box(wpitch - 0.18, 0.02, 0.44, [wx, 0.968, zS], M.rubber, 0); // 속 어둠
    // 음식 — 테보다 낮은 면 (3.13.3). 색이 칸마다 달라야 배식대다
    b.box(wpitch - 0.22, 0.03, 0.4, [wx, 0.955, zS], WELL[k][0], 0);
    b.box(wpitch - 0.36, 0.02, 0.28, [wx + 0.03, 0.966, zS - 0.03], WELL[k][1], 0); // 건더기
    // 국자 — 웰마다 하나. 손잡이가 걸쳐 있어야 배식 중인 웰이다
    const lad = new THREE.CylinderGeometry(0.008, 0.008, 0.28, 5);
    lad.rotateZ(0.85 + k * 0.1);
    lad.translate(wx + 0.22, 1.05, zS - 0.14);
    b.add(lad, M.trim);
    const cup2 = new THREE.SphereGeometry(0.045, 8, 5, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2);
    cup2.translate(wx + 0.12, 0.985, zS - 0.14);
    b.add(cup2, M.steel);
    // 칸 이름표 — 가림판 기둥에 매달린 작은 판. 배식대의 표식이다
    b.box(0.2, 0.07, 0.01, [wx, 1.14, zS - 0.115], M.paper, 0);
  }
  // 카운터 끝 — 접시 더미 둘과 컵 줄
  for (const k of [0, 1]) {
    plateStack(b, svX - len / 2 + 0.34 + k * 0.3, 0.97, zS + 0.12, M, 5 + k * 3);
    tally.plateStack = (tally.plateStack ?? 0) + 1;
  }
  for (let k = 0; k < 4; k++) {
    mug(b, svX - len / 2 + 0.3 + (k % 2) * 0.16, 0.97, zS - 0.16 - Math.floor(k / 2) * 0.14, M, M.porcelain);
  }
  b.endMark();
  tally.serving = 1;

  // ── 케이크 전시대 (2026-08-06 지시) — 배식대가 비운 동쪽 절반 ──────────
  //
  // 전시대를 전시대로 만드는 것: **유리 상자**(앞·옆이 다 보인다) · 그 안의
  // 선반 둘 · 선반마다 놓인 **자른 면이 보이는 케이크**(원기둥에서 한 조각을
  // 뺀 형태) · 조각 접시 · 위쪽 조명 띠 · 아래 서랍장.
  b.mark('furniture', `cakecase:${c.id}`);
  {
    const CL = len - 0.6;
    const kx = c.x1 - 0.8 - CL / 2;
    b.box(CL, 0.86, 0.72, [kx, 0.43, zS], M.laminate, 0); // 아래 몸통
    b.box(CL + 0.06, 0.05, 0.78, [kx, 0.88, zS], M.steelDark, 0); // 상판
    b.box(CL - 0.1, 0.06, 0.66, [kx, 0.06, zS], M.rubber, 0); // 굽
    for (const t of fit(0, CL, 0.9, 0.15)) {
      b.box(0.7, 0.5, 0.02, [kx - CL / 2 + t, 0.5, zS - 0.37], M.trim, 0); // 문판
      b.box(0.24, 0.03, 0.02, [kx - CL / 2 + t, 0.66, zS - 0.385], M.steel, 0); // 손잡이
    }
    // 유리 상자 — 기둥 넷 + 앞·옆 유리 + 천판
    const GH2 = 0.62;
    const gy = 0.905 + GH2 / 2;
    for (const s of [-1, 1]) {
      for (const t2 of [-1, 1]) {
        b.box(0.035, GH2, 0.035, [kx + s * (CL / 2 - 0.02), gy, zS + t2 * 0.34], M.steelDark, 0);
      }
      b.box(0.02, GH2 - 0.04, 0.66, [kx + s * (CL / 2 - 0.02), gy, zS], M.glass, 0); // 옆 유리
    }
    b.box(CL - 0.06, GH2 - 0.04, 0.02, [kx, gy, zS - 0.35], M.glass, 0); // 앞 유리
    b.box(CL, 0.05, 0.74, [kx, 0.905 + GH2, zS], M.steelDark, 0); // 천판
    b.box(CL - 0.3, 0.03, 0.1, [kx, 0.895 + GH2, zS - 0.2], M.lamp, 0); // 조명 띠
    // ── 선반 둘과 진열 — 케이크·**빵·도넛** (2026-08-06 지시) ───────────
    //
    // 선반이 유리라 보이지 않아 케이크가 허공에 뜬 것처럼 보였다 —
    // **앞턱(금속 띠)** 을 달아 선반이 어디 있는지 눈에 보이게 하고,
    // 진열물은 접시 밑면을 선반 윗면에 정확히 앉힌다.
    for (const [sy, kinds] of [
      [0.955, ['cake', 'bread', 'donut', 'cake']],
      [1.245, ['donut', 'cake', 'bread']],
    ]) {
      b.box(CL - 0.12, 0.02, 0.6, [kx, sy, zS], M.glass, 0);
      b.box(CL - 0.12, 0.03, 0.03, [kx, sy + 0.005, zS - 0.3], M.steelDark, 0); // 앞턱
      const top0 = sy + 0.01; // 선반 윗면 — 여기에 앉힌다
      const n = kinds.length;
      for (let k = 0; k < n; k++) {
        const px9 = kx - (CL - 0.8) / 2 + (k * (CL - 0.8)) / Math.max(1, n - 1);
        const r = hash2(k * 5, Math.round(sy * 10));
        const kind2 = kinds[k];
        const plate = new THREE.CylinderGeometry(0.155, 0.145, 0.014, 14);
        plate.translate(px9, top0 + 0.007, zS);
        b.add(plate, M.porcelain);
        const py9 = top0 + 0.014; // 접시 윗면
        if (kind2 === 'cake') {
          const eaten = 0.6 + r * 1.2; // 빠져나간 조각의 각
          const cake = new THREE.CylinderGeometry(0.14, 0.14, 0.1, 14, 1, false, eaten, Math.PI * 2 - eaten);
          cake.translate(px9, py9 + 0.05, zS);
          b.add(cake, r > 0.5 ? M.plasticWarm : M.paper);
          const top = new THREE.CylinderGeometry(0.143, 0.143, 0.014, 14, 1, false, eaten, Math.PI * 2 - eaten);
          top.translate(px9, py9 + 0.107, zS);
          b.add(top, r > 0.5 ? M.vend : M.crate);
          // 자른 면이 보이는 조각 하나 — 접시 옆에
          const sl = new THREE.CylinderGeometry(0.13, 0.13, 0.095, 12, 1, false, 0, 0.85);
          sl.rotateY(1.2 + r);
          sl.translate(px9 + 0.19, py9 + 0.047, zS + 0.13);
          b.add(sl, r > 0.5 ? M.plasticWarm : M.paper);
        } else if (kind2 === 'bread') {
          // 식빵 덩이 — 위가 **부푼 반원기둥**. 각진 상자는 벽돌이다
          const loaf = new THREE.CylinderGeometry(0.075, 0.075, 0.26, 12, 1, false, 0, Math.PI);
          loaf.rotateZ(-Math.PI / 2);
          loaf.rotateX(-Math.PI / 2);
          loaf.rotateY(Math.PI / 2);
          loaf.scale(1, 1, 0.9);
          loaf.translate(px9, py9 + 0.035, zS);
          b.add(loaf, M.carton);
          b.box(0.26, 0.07, 0.13, [px9, py9 + 0.035, zS], M.carton, 0); // 아랫동
          // 칼집 셋 — 구운 자국
          for (let q = 0; q < 3; q++) {
            const cut = new THREE.BoxGeometry(0.02, 0.02, 0.11);
            cut.rotateY(0.3);
            cut.translate(px9 - 0.07 + q * 0.07, py9 + 0.105, zS);
            b.add(cut, M.cartonDark);
          }
          // 잘라 둔 조각 둘 — 옆에 기대 세워져 있다
          for (const q of [0, 1]) {
            const sli = new THREE.BoxGeometry(0.018, 0.13, 0.12);
            sli.rotateZ(0.24 + q * 0.08);
            sli.translate(px9 + 0.16 + q * 0.03, py9 + 0.065, zS + 0.1);
            b.add(sli, M.paper);
          }
        } else {
          // 도넛 — **토러스**다. 원기둥에 구멍은 못 뚫는다 (lessons 3.13.2)
          for (let q = 0; q < 3; q++) {
            const a = q * 2.1 + r;
            const dx4 = px9 + Math.sin(a) * 0.07;
            const dz4 = zS + Math.cos(a) * 0.06;
            const dy4 = py9 + 0.028 + Math.floor(q / 2) * 0.05;
            const don = new THREE.TorusGeometry(0.052, 0.026, 6, 12);
            don.rotateX(Math.PI / 2);
            don.translate(dx4, dy4, dz4);
            b.add(don, q % 2 ? M.carton : M.cartonDark);
            // 아이싱 — 윗면에 얹힌 얇은 고리 (색이 달라야 도넛이다)
            const ic = new THREE.TorusGeometry(0.052, 0.02, 6, 12);
            ic.rotateX(Math.PI / 2);
            ic.scale(1, 0.5, 1);
            ic.translate(dx4, dy4 + 0.019, dz4);
            b.add(ic, q === 1 ? M.vend : M.plasticWarm);
          }
        }
      }
    }
    tally.cakeCase = (tally.cakeCase ?? 0) + 1;
  }
  b.endMark();

  // ── 조리 라인 — 북쪽 외벽. 레인지 버너는 원판, 후드는 위로 관이 나간다 ──
  const wn = interiorWalls(c.id).find((q) => q.rule === 'solid' && q.b - q.a > 5);
  if (wn) {
    b.mark('furniture', `range:${c.id}`);
    const cm = (wn.a + wn.b) / 2;
    const L = Math.min(wn.b - wn.a - 0.8, 6.5);

    // ── 기기를 뗀다 (2026-08-06 사용자 지시) ────────────────────────────
    // 왼쪽부터: **가스레인지 · 오븐 · 작업대 · 싱크대**. 각 유닛은 제 몸통과
    // 옆판·굽을 갖고, 사이에 틈이 있다. 통짜 라인 하나에 얹어 두면 상판이
    // 이어져 "기기 여럿" 이 아니라 "긴 조리대 하나" 로 읽힌다.
    //
    // **자리는 커서로 잡는다** — cm 에서 상수로 밀어 놓았더니 폭(1.5·0.8·
    // 0.85·1.5)의 합을 아무도 안 세어 작업대와 싱크가 30cm 겹쳐 있었다
    // (2026-08-06 지적 "죄다 겹쳐져 있고 형태를 알아보기 힘듦"). 왼쪽 끝에서
    // 폭+틈만큼 나아가며 놓으면 겹칠 수가 없고, 방이 넓어지면 라인도 늘어난다.
    // 틈 0.16 은 **벽이 비쳐 보이는 폭**이었다 — 기기 사이에 정체불명의 띠가
    // 서 있는 것으로 읽혔다 (2026-08-06 "여기 아직도 겹쳐있는거 있음").
    // 실제 업소 주방은 기기를 맞대어 놓고 틈을 **스테인리스 필러**로 막는다.
    const GAP = 0.05;
    let cur = wn.a + 0.7;
    const gaps2 = []; // 필러를 채울 자리
    const lay = (wid) => {
      const at = cur + wid / 2;
      if (cur > wn.a + 0.8) gaps2.push(cur - GAP / 2); // 앞 유닛과의 틈 중앙
      cur += wid + GAP;
      return at;
    };
    const rangeU = lay(1.5);
    const ovenU = lay(0.8);
    const prepU = lay(0.85);

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
    const sinkU = lay(1.5);
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

    // 필러 — 유닛 사이 틈을 막는 스테인리스 판. 벽이 비쳐 보이던 자리다
    for (const gu of gaps2) {
      wallBox(b, wn, gu, 0.34, 0.46, GAP + 0.03, 0.92, 0.64, M.steel);
      wallBox(b, wn, gu, 0.34, 0.925, GAP + 0.05, 0.045, 0.68, M.steelDark); // 상판 이음
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

  // ── 조리 아일랜드 — **방 한가운데** (2026-08-06 지시) ─────────────────
  //
  // 9.3 x 7.6 방인데 기기가 죄다 북쪽 벽에 붙어 가운데가 통째로 비어 있었다
  // ("공간이 넓은 거에 비해 배치가 협소하다"). 실제 급식 주방의 가운데에는
  // **양면에서 쓰는 작업 아일랜드**가 선다 — 그것이 이 방을 조리 공간으로
  // 만들고, 사람이 도는 동선(벽 라인 <-> 아일랜드 <-> 배식대)을 만든다.
  //
  // 조각: 스테인리스 상판 · 몸통 · **아래 열린 선반 둘**(냄비가 보인다) ·
  // 굽 · 도마와 대야 · 위로 매단 **냄비 걸이 봉**과 걸린 냄비들.
  b.mark('furniture', `island:${c.id}`);
  {
    const ix = (c.x0 + c.x1) / 2 - 0.4;
    const iz = (c.z0 + c.z1) / 2 - 0.2;
    const IW = 3.0;
    const ID = 1.0;
    b.box(IW + 0.08, 0.05, ID + 0.08, [ix, 0.905, iz], M.steelDark, 0); // 상판
    b.box(IW, 0.06, ID, [ix, 0.84, iz], M.steel, 0); // 상판 밑 테
    for (const s of [-1, 1]) {
      b.box(0.06, 0.78, ID, [ix + s * (IW / 2 - 0.03), 0.44, iz], M.steel, 0); // 옆판
      b.box(0.1, 0.09, 0.1, [ix + s * (IW / 2 - 0.1), 0.045, iz - ID / 2 + 0.1], M.rubber, 0); // 발
      b.box(0.1, 0.09, 0.1, [ix + s * (IW / 2 - 0.1), 0.045, iz + ID / 2 - 0.1], M.rubber, 0);
    }
    for (const y of [0.28, 0.58]) b.box(IW - 0.14, 0.03, ID - 0.1, [ix, y, iz], M.steel, 0); // 열린 선반
    // 선반 위의 냄비·대야 — 열린 선반이 비면 그냥 틀이다
    for (let k = 0; k < 4; k++) {
      const r = 0.12 + hash2(k, 9) * 0.06;
      tube(b, r, 0.15, [ix - 1.1 + k * 0.72, 0.365, iz], M.steel, 'y', 10);
      if (k % 2) tube(b, r * 0.95, 0.014, [ix - 1.1 + k * 0.72, 0.447, iz], M.steelDark, 'y', 10, true);
    }
    for (let k = 0; k < 3; k++) {
      tube(b, 0.19, 0.09, [ix - 0.9 + k * 0.9, 0.655, iz], M.steelDark, 'y', 12);
    }
    // 상판 위 — 도마 · 대야 · 칼 · 행주
    b.box(0.52, 0.035, 0.34, [ix - 0.85, 0.948, iz - 0.05], M.laminate, 0);
    {
      const bowl2 = new THREE.CylinderGeometry(0.22, 0.16, 0.14, 12);
      bowl2.translate(ix + 0.35, 1.0, iz);
      b.add(bowl2, M.steel);
      const inn = new THREE.CylinderGeometry(0.195, 0.13, 0.03, 12);
      inn.translate(ix + 0.35, 1.055, iz);
      b.add(inn, M.rubber); // 테보다 낮은 속
    }
    {
      const kn = new THREE.BoxGeometry(0.22, 0.006, 0.035);
      kn.rotateY(0.4);
      kn.translate(ix - 0.7, 0.969, iz - 0.02);
      b.add(kn, M.steel);
      const hd = new THREE.BoxGeometry(0.09, 0.016, 0.026);
      hd.rotateY(0.4);
      hd.translate(ix - 0.85, 0.973, iz - 0.08);
      b.add(hd, M.rubber);
    }
    b.box(0.24, 0.02, 0.18, [ix + 1.05, 0.94, iz + 0.2], M.vendBlue, 0); // 행주
    // ── 아일랜드 마감 (2026-08-06 "디테일 겁나 떨어짐") ──────────────────
    //
    // 상판·선반·다리만으로는 **철제 탁자**다. 작업 아일랜드를 아일랜드로
    // 만드는 것: 앞뒤 가로 버팀 · 모서리 보강 · 상판 뒤턱 · 걸이 봉과 국자 ·
    // 서랍 하나 · 도마 옆의 채소·계란판 · 저울.
    for (const dz of [-1, 1]) {
      b.box(IW - 0.14, 0.04, 0.04, [ix, 0.16, iz + dz * (ID / 2 - 0.05)], M.steel, 0); // 아래 버팀
    }
    for (const s of [-1, 1]) {
      for (const t2 of [-1, 1]) {
        const br3 = new THREE.BoxGeometry(0.14, 0.03, 0.14);
        br3.rotateY(Math.PI / 4);
        br3.translate(ix + s * (IW / 2 - 0.1), 0.8, iz + t2 * (ID / 2 - 0.1));
        b.add(br3, M.steel); // 모서리 보강
      }
    }
    b.box(IW + 0.08, 0.08, 0.04, [ix, 0.965, iz - ID / 2 - 0.02], M.steelDark, 0); // 상판 뒤턱
    // 서랍 하나 — 상판 밑 (열린 선반만 있으면 수납이 없는 탁자다)
    b.box(0.7, 0.16, 0.04, [ix + 0.9, 0.79, iz + ID / 2 + 0.01], M.steel, 0);
    b.box(0.26, 0.025, 0.03, [ix + 0.9, 0.82, iz + ID / 2 + 0.03], M.trim, 0);
    // 걸이 봉 — 상판 뒤턱에 걸린 국자·집게
    {
      const rail3 = new THREE.CylinderGeometry(0.012, 0.012, 1.0, 6);
      rail3.rotateZ(Math.PI / 2);
      rail3.translate(ix - 0.9, 1.02, iz - ID / 2 - 0.02);
      b.add(rail3, M.trim);
      for (let k = 0; k < 3; k++) {
        const hx5 = ix - 1.25 + k * 0.3;
        const hk = new THREE.TorusGeometry(0.02, 0.004, 4, 8, Math.PI * 1.3);
        hk.rotateY(Math.PI / 2);
        hk.translate(hx5, 1.008, iz - ID / 2 - 0.02);
        b.add(hk, M.trim);
        const st3 = new THREE.CylinderGeometry(0.007, 0.007, 0.2, 5);
        st3.translate(hx5, 0.9, iz - ID / 2 - 0.02);
        b.add(st3, M.trim);
        if (k === 0) {
          const sc = new THREE.SphereGeometry(0.05, 8, 5, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2);
          sc.translate(hx5, 0.81, iz - ID / 2 - 0.02);
          b.add(sc, M.steel); // 국자 머리
        }
      }
    }
    // 계란판과 채소 — 도마 옆. 조리 중이던 자리다
    b.box(0.3, 0.05, 0.2, [ix - 0.42, 0.955, iz - 0.22], M.carton, 0);
    for (let k = 0; k < 6; k++) {
      const eg = new THREE.SphereGeometry(0.026, 8, 5);
      eg.scale(1, 1.25, 1);
      eg.translate(ix - 0.52 + (k % 3) * 0.1, 0.995, iz - 0.27 + Math.floor(k / 3) * 0.09);
      b.add(eg, M.paper);
    }
    for (let k = 0; k < 3; k++) {
      const vg = new THREE.CylinderGeometry(0.038, 0.028, 0.14, 8);
      vg.rotateZ(1.4);
      vg.rotateY(k * 1.1);
      vg.translate(ix - 0.85 + k * 0.06, 0.985, iz + 0.02 + k * 0.03);
      b.add(vg, k === 1 ? M.crate : M.plasticWarm); // 채소
    }
    // 저울 — 받침 + 눈금판
    b.box(0.22, 0.06, 0.2, [ix + 0.72, 0.965, iz - 0.24], M.steelDark, 0);
    {
      const dial = new THREE.CylinderGeometry(0.075, 0.075, 0.02, 12);
      dial.rotateX(Math.PI / 2);
      dial.translate(ix + 0.72, 1.03, iz - 0.32);
      b.add(dial, M.paper);
    }
    // 냄비 걸이 — 천장에서 내려온 봉과 갈고리에 걸린 냄비들
    {
      const RY = 1.95;
      for (const s of [-1, 1]) {
        tube(b, 0.014, c.h - RY, [ix + s * 1.1, (RY + c.h) / 2, iz], M.trim, 'y', 6);
      }
      const bar = new THREE.CylinderGeometry(0.018, 0.018, 2.4, 8);
      bar.rotateZ(Math.PI / 2);
      bar.translate(ix, RY, iz);
      b.add(bar, M.trim);
      for (let k = 0; k < 5; k++) {
        const hx3 = ix - 0.96 + k * 0.48;
        const hook = new THREE.TorusGeometry(0.028, 0.005, 4, 8, Math.PI * 1.4);
        hook.rotateY(Math.PI / 2);
        hook.translate(hx3, RY - 0.028, iz);
        b.add(hook, M.trim);
        const r = 0.1 + hash2(k * 3, 21) * 0.06;
        tube(b, r, 0.16, [hx3, RY - 0.15, iz], M.steel, 'y', 10);
        // 손잡이 — 냄비 옆으로 뻗은 관. 걸린 것은 손잡이가 위를 본다
        const hn = new THREE.CylinderGeometry(0.011, 0.011, 0.16, 5);
        hn.rotateZ(Math.PI / 2);
        hn.translate(hx3 + r + 0.07, RY - 0.1, iz);
        b.add(hn, M.trim);
      }
    }
    tally.island = (tally.island ?? 0) + 1;
  }
  b.endMark();

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
        // 상단 방열 그릴 (status.md 5.0 B) — 천판 앞턱의 가로 슬롯 줄.
        // 냉장고는 열을 어디론가 버려야 하는 물건인데 그 자리가 없었다
        wallBox(g, we, u, 0.79, 1.9, 0.78, 0.12, 0.03, M.steelDark);
        for (let k = 0; k < 5; k++) {
          wallBox(g, we, u, 0.805, 1.862 + k * 0.021, 0.72, 0.009, 0.014, M.rubber);
        }
        // 방열 코일 — 굽 안쪽 어둠에 비치는 관 (뒤가 아니라 아래로 뺀 형식)
        for (const dv of [0.25, 0.45, 0.65]) {
          const [cx5, , cz5] = wallAt(we, u, dv, 0);
          tube(g, 0.014, 0.7, [cx5, 0.09, cz5], M.trim, we.axis, 5);
        }
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
    // ── 속 — 두 포즈 공통 (닫혀 있어도 실제로 있다) ────────────────────
    //
    // 선반 둘과 봉만 있으면 **빈 캐비닛**이다 (status.md 5.0 B). 사물함을
    // 사물함으로 만드는 것은 그 안의 남은 것들이다: 걸이 고리 · 걸린 옷 ·
    // 위 칸의 상자 · 바닥의 신발 한 켤레 · 문 안쪽에 붙은 쪽지.
    wallBox(bb, w, u, 0.27, 1.35, WID - 0.07, 0.02, DEP - 0.1, M.steel);
    wallBox(bb, w, u, 0.27, 0.45, WID - 0.07, 0.02, DEP - 0.1, M.steel);
    const [rx, , rz] = wallAt(w, u, 0.27, 0);
    tube(bb, 0.011, WID - 0.1, [rx, 1.6, rz], M.trim, w.axis, 6);
    const rs = hash2(Math.round(u * 13), Math.round(w.at * 7));
    // 옷걸이 둘 — 봉에 걸린 고리(반토러스) + 어깨대. 그 아래 옷이 늘어진다
    for (const [du, cm2] of [[-0.09, M.plastic], [0.05, M.plasticWarm]]) {
      const hook = new THREE.TorusGeometry(0.022, 0.004, 4, 8, Math.PI);
      hook.rotateY(Math.PI / 2);
      hook.translate(0, 1.582, 0.27);
      wallPut(bb, w, u + du, hook, M.trim);
      const bar = new THREE.CylinderGeometry(0.005, 0.005, 0.17, 5);
      bar.rotateZ(Math.PI / 2);
      bar.rotateX(0.12);
      bar.translate(0, 1.5, 0.27);
      wallPut(bb, w, u + du, bar, M.trim); // 어깨대
      // 옷 — 위가 좁고 아래가 넓은 판 (각진 상자면 널빤지다)
      const cl = new THREE.CylinderGeometry(0.085, 0.115, 0.6, 4, 1, false, 0, Math.PI * 2);
      cl.rotateY(Math.PI / 4);
      cl.scale(1, 1, 0.42);
      cl.translate(0, 1.2, 0.27);
      wallPut(bb, w, u + du, cl, cm2);
    }
    // 위 칸의 상자 — 서류나 잡동사니
    if (rs > 0.3) wallBox(bb, w, u, 0.27, 1.46, WID - 0.14, 0.19, DEP - 0.2, rs > 0.65 ? M.carton : M.crate);
    // 바닥의 신발 한 켤레 — 앞이 둥근 덩이 둘
    for (const s of [-1, 1]) {
      const sh = new THREE.CylinderGeometry(0.045, 0.05, 0.24, 6, 1, false, 0, Math.PI);
      sh.rotateZ(-Math.PI / 2);
      sh.rotateX(-Math.PI / 2);
      sh.rotateY(Math.PI / 2);
      sh.scale(1, 0.62, 1);
      sh.translate(s * 0.075, 0.12, 0.26);
      wallPut(bb, w, u, sh, M.rubber);
    }
  }
  // 닫힘 — 문이 몸통 앞면(0.5)보다 살짝 돌출 (겹평면 금지)
  wallBox(pr.closed, w, u, 0.515, H0 / 2 + 0.06, 0.4, H0 - 0.1, 0.024, M.steel);
  for (const y of [1.55, 0.5]) {
    for (const dy of [0, 0.05, 0.1]) wallBox(pr.closed, w, u, 0.53, y + dy, 0.22, 0.014, 0.006, M.rubber);
  }
  wallBox(pr.closed, w, u + 0.13, 0.535, 1.05, 0.03, 0.1, 0.02, M.trim); // 손잡이
  // 열림 — 문이 **경첩(왼쪽 변)을 원점에 두고 돌아간** 뒤 제자리로 간다.
  // 순서를 반대로(이동 후 회전) 했더니 문이 몸통에서 떨어져 허공을 돌았다.
  //
  // **젖힘 각은 자리마다 다르다** (status.md 5.0 B). 전부 같은 각으로 열면
  // 줄 지어 선 사물함이 한 손으로 연 것처럼 보인다 — 약탈은 제각각이다.
  {
    const swing = -1.35 - hash2(Math.round(u * 17), Math.round(w.at * 5)) * 0.85; // -1.35 ~ -2.2
    const g = new THREE.BoxGeometry(0.4, H0 - 0.1, 0.024);
    g.translate(0.2, H0 / 2 + 0.06, 0); // 경첩변을 로컬 원점에
    g.rotateY(swing);
    g.translate(0, 0, 0.5); // 몸통 앞면 평면으로
    wallPut(pr.open, w, u - 0.2, g, M.steel);
    // 문 안쪽 — 거울 조각과 붙여 둔 쪽지. 젖힌 문의 뒷면이 보이는 자리다
    const mir = new THREE.BoxGeometry(0.16, 0.22, 0.008);
    mir.translate(0.2, H0 / 2 + 0.36, 0);
    mir.rotateY(swing);
    mir.translate(0, 0, 0.487);
    wallPut(pr.open, w, u - 0.2, mir, M.steelDark);
    const memo = new THREE.BoxGeometry(0.1, 0.13, 0.006);
    memo.translate(0.2, H0 / 2 - 0.24, 0);
    memo.rotateY(swing);
    memo.translate(0, 0, 0.487);
    wallPut(pr.open, w, u - 0.2, memo, M.paper);
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
  // **세로로 둔다** (2026-08-06 지시) — 벽을 따라 가로로 누이면 방을 가로지르는
  // 긴 단(段)이 되고, 실제 당직실 침대는 **머리를 벽에 대고** 방 안쪽으로
  // 뻗는다. yaw = 90도로 돌리고 자리를 북쪽 벽에 머리 쪽부터 붙인다.
  b.mark('furniture', `bed:${c.id}`);
  for (const [bx, bz] of [[c.x1 - 1.0, c.z1 - 1.15], [c.x1 - 2.35, c.z1 - 1.15]]) {
    const yaw = Math.PI / 2; // 길이축을 z 로
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
    // ── 조각 목록 (3.13.1) ────────────────────────────────────────────
    // 프레임 · **관 다리 넷** · 매트리스(프레임보다 좁고 도톰) · 시트가 접힌
    // 자국 · 베개(가운데가 눌린) · 개어 둔 담요 · 머리판 · 침대 밑 신발
    bbox(0.9, 0.09, 1.9, 0, 0.3, 0, M.trim); // 프레임
    for (const s of [-1, 1]) {
      for (const t2 of [-1, 1]) {
        const leg = new THREE.CylinderGeometry(0.028, 0.028, 0.28, 6);
        leg.translate(s * 0.38, 0.14, t2 * 0.86);
        put(leg, M.trim);
        const foot = new THREE.BoxGeometry(0.09, 0.02, 0.09);
        foot.translate(s * 0.38, 0.012, t2 * 0.86);
        put(foot, M.steelDark);
      }
    }
    bbox(0.84, 0.17, 1.84, 0, 0.43, 0, M.paper); // 매트리스
    bbox(0.86, 0.03, 0.9, 0, 0.525, 0.42, M.porcelain); // 덮은 시트 (발치)
    bbox(0.86, 0.035, 0.12, 0, 0.535, -0.02, M.porcelain); // 접힌 자락
    // 베개 — 가운데가 눌려 양 끝이 도톰하다 (평판이면 방석이다)
    for (const s of [-1, 1]) bbox(0.4, 0.1, 0.3, 0, 0.565, -0.72 + s * 0.0, M.porcelain);
    bbox(0.42, 0.07, 0.28, 0, 0.55, -0.72, M.paper);
    bbox(0.8, 0.1, 0.5, 0, 0.57, 0.55, M.vendBlue); // 개어 둔 담요
    bbox(0.86, 0.34, 0.06, 0, 0.5, -0.95, M.trim); // 머리판
    // 침대 밑 신발 한 켤레 — 사람이 자던 자리의 표식
    for (const s of [-1, 1]) {
      const sh4 = new THREE.CylinderGeometry(0.045, 0.05, 0.24, 6, 1, false, 0, Math.PI);
      sh4.rotateZ(-Math.PI / 2);
      sh4.rotateX(-Math.PI / 2);
      sh4.scale(1, 0.6, 1);
      sh4.translate(s * 0.09, 0.05, 0.75);
      put(sh4, M.rubber);
    }
    tally.bed = (tally.bed ?? 0) + 1;
  }
  b.endMark();

  // ── 세탁 코너 — 세탁기·빨래바구니·세제 (사용자 지시) ──────────────────
  //
  // 세탁기는 **둥근 문**이 있어야 세탁기다: 상자에 네모 문을 달면 오븐이다.
  b.mark('furniture', `laundry:${c.id}`);
  const wl2 = interiorWalls(c.id).filter((q) => q.rule === 'solid' && q.axis === 'z').sort((p, q) => q.at - p.at)[0];
  if (wl2) {
    // **크기를 키웠다** (2026-08-06 지시) — 0.66 폭은 세탁기가 아니라
    // 서랍장이었다. 실물 업소용은 0.85 폭·0.95 높이쯤이고, 그 덩치가 있어야
    // 세탁 코너가 세탁 코너로 읽힌다.
    const WW = 0.86;
    const WH = 0.96;
    const lu = wl2.a + Math.min(1.3, (wl2.b - wl2.a) / 3);
    for (const du of [0, WW + 0.06]) {
      const u = lu + du;
      wallBox(b, wl2, u, 0.36, WH / 2 + 0.06, WW, WH, 0.68, M.steel); // 몸통
      wallBox(b, wl2, u, 0.36, WH + 0.09, WW + 0.04, 0.06, 0.72, M.steelDark); // 천판
      wallBox(b, wl2, u, 0.36, 0.05, WW - 0.08, 0.1, 0.6, M.rubber); // 굽
      for (const s of [-1, 1]) {
        wallBox(b, wl2, u + s * (WW / 2 - 0.02), 0.36, WH / 2 + 0.06, 0.03, WH, 0.7, M.steelDark); // 옆 이음선
      }
      // 둥근 문 — 테(토러스) + 유리 + 속 어둠 + **경첩과 손잡이 홈**
      const [px, , pz] = wallAt(wl2, u, 0.7, 0);
      const ring = new THREE.TorusGeometry(0.25, 0.034, 6, 16);
      ring.rotateY(Math.PI / 2);
      ring.translate(px, 0.52, pz);
      b.add(ring, M.trim);
      const [gx, , gz] = wallAt(wl2, u, 0.68, 0);
      tube(b, 0.23, 0.02, [gx, 0.52, gz], M.glass, 'x', 14, true);
      const [dx3, , dz3] = wallAt(wl2, u, 0.56, 0);
      tube(b, 0.215, 0.18, [dx3, 0.52, dz3], M.rubber, 'x', 14); // 속 어둠
      tube(b, 0.14, 0.06, [dx3, 0.52, dz3], M.paper, 'x', 12, true); // 안에 든 빨래
      for (const dy of [0.2, -0.2]) {
        wallBox(b, wl2, u - 0.28, 0.71, 0.52 + dy, 0.05, 0.06, 0.04, M.steelDark); // 경첩
      }
      wallBox(b, wl2, u + 0.27, 0.72, 0.52, 0.04, 0.12, 0.05, M.trim); // 손잡이 홈
      // 조작반 — **다이얼과 버튼 줄과 표시창**. 띠 하나면 그냥 선이다
      wallBox(b, wl2, u, 0.7, WH - 0.06, WW - 0.08, 0.16, 0.03, M.trim);
      const [kx3, , kz3] = wallAt(wl2, u - 0.26, 0.73, 0);
      tube(b, 0.048, 0.03, [kx3, WH - 0.06, kz3], M.steelDark, 'x', 10, true); // 다이얼
      tube(b, 0.012, 0.05, [kx3, WH - 0.02, kz3], M.trim, 'x', 6); // 다이얼 지시침
      wallBox(b, wl2, u + 0.06, 0.73, WH - 0.03, 0.14, 0.05, 0.012, M.screen); // 표시창
      for (const k of [0, 1, 2]) {
        wallBox(b, wl2, u + 0.16 + k * 0.07, 0.73, WH - 0.11, 0.05, 0.035, 0.014, k === 1 ? M.warn : M.keycap);
      }
      // 세제 서랍 — 위 왼쪽에 살짝 빠져 있다
      wallBox(b, wl2, u - 0.24, 0.74, WH - 0.19, 0.24, 0.07, 0.06, M.trim);
      tally.washer = (tally.washer ?? 0) + 1;
    }
    // 세제통 둘 — 세탁기 천판(1.12) 위. 손잡이가 달린 통과 원통 병
    const [sx3, , sz3] = wallAt(wl2, lu, 0.3, 0);
    b.box(0.19, 0.26, 0.16, [sx3, 1.25, sz3], M.vendBlue, 0);
    b.box(0.16, 0.05, 0.13, [sx3, 1.4, sz3], M.trim, 0); // 뚜껑
    {
      const hd2 = new THREE.TorusGeometry(0.05, 0.012, 4, 8, Math.PI);
      hd2.rotateY(Math.PI / 2);
      hd2.translate(sx3, 1.33, sz3 + 0.1);
      b.add(hd2, M.trim); // 손잡이
    }
    const [s2x, , s2z] = wallAt(wl2, lu + WW + 0.06, 0.3, 0);
    tube(b, 0.06, 0.24, [s2x, 1.24, s2z], M.warn, 'y', 10);
    tube(b, 0.028, 0.05, [s2x, 1.38, s2z], M.trim, 'y', 8);
    tube(b, 0.042, 0.03, [s2x, 1.41, s2z], M.trim, 'y', 8); // 뚜껑
    tally.detergent = (tally.detergent ?? 0) + 1;

    // 빨래바구니 — 위가 넓은 **광주리**. 민짜 원뿔대는 양동이라, 세로 살과
    // 손잡이 구멍을 낸다. 안에 개킨 것이 봉긋하게 담긴다
    for (const [du, mm] of [[WW * 2 + 0.55, M.crate], [WW * 2 + 1.05, M.plasticWarm]]) {
      const [bx3, , bz3] = wallAt(wl2, lu + du, 0.42, 0);
      tube(b, 0.26, 0.42, [bx3, 0.21, bz3], mm, 'y', 12);
      tube(b, 0.28, 0.045, [bx3, 0.42, bz3], mm, 'y', 12, true); // 테두리
      tube(b, 0.22, 0.03, [bx3, 0.03, bz3], mm, 'y', 12, true); // 굽
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * Math.PI * 2;
        const rb = new THREE.BoxGeometry(0.02, 0.36, 0.016);
        rb.rotateY(a);
        rb.translate(bx3 + Math.sin(a) * 0.255, 0.22, bz3 + Math.cos(a) * 0.255);
        b.add(rb, mm); // 세로 살
      }
      for (const s of [-1, 1]) {
        const hl = new THREE.BoxGeometry(0.12, 0.045, 0.02);
        hl.rotateY(s > 0 ? 0 : Math.PI / 2);
        hl.translate(bx3 + (s > 0 ? 0 : 0.255), 0.36, bz3 + (s > 0 ? 0.255 : 0));
        b.add(hl, M.rubber); // 손잡이 구멍
      }
      // 담긴 빨래 — 봉긋한 반구. 납작한 원판은 뚜껑이다
      const lin = new THREE.SphereGeometry(0.21, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2);
      lin.scale(1, 0.55, 1);
      lin.translate(bx3, 0.31, bz3);
      b.add(lin, M.paper);
      tally.basket = (tally.basket ?? 0) + 1;
    }
  }
  b.endMark();

  // ── 텔레비전 — **서쪽 벽 고정** (샤워실 경계 z-벽) ─────────────────────
  //
  // 여기 있던 자판기를 치우고 TV 를 놓았다 (2026-08-06 사용자 지시).
  // 자판기는 카페테리아에 둘, 그것으로 충분하다 — 휴게실은 **쉬는 방**이고
  // 그 방을 그 방으로 만드는 것은 소파가 바라보는 화면이다.
  // TV 는 **서랍장 위**에 얹힌다 (지시) — 받침 없이 바닥에 두면 TV 가 아니라
  // 버려진 상자다. 아래 칸에는 비디오와 테이프가 들어간다.
  const walls = interiorWalls(c.id).filter((q) => q.rule === 'solid');
  const wv = walls.filter((q) => q.axis === 'z' && q.b - q.a > 1.6).sort((p, q) => p.at - q.at)[0];
  if (wv) {
    b.mark('furniture', `tv:${c.id}`);
    const tu = (wv.a + wv.b) / 2;
    // 받침 서랍장 — 낮고 넓다. 서랍 둘 + 비디오가 들어가는 열린 칸
    const CW = 1.3;
    const CH = 0.56;
    const CD = 0.5;
    // **몸통은 통짜 상자가 아니라 판이다** — 한쪽을 열린 칸으로 둘 것이므로
    // 통짜로 두면 그 칸이 몸통 속에 묻힌다 (사물함·냉장고와 같은 병).
    // 판: 굽 · 밑판 · 천판 · 옆판 둘 · 등판 · 가운데 칸막이.
    const yb = 0.09; // 밑판 윗면
    const yt = 0.6; // 천판 밑면
    wallBox(b, wv, tu, CD / 2, 0.03, CW - 0.08, 0.06, CD - 0.06, M.trim); // 굽
    wallBox(b, wv, tu, CD / 2, yb - 0.015, CW, 0.03, CD, M.laminate); // 밑판
    wallBox(b, wv, tu, CD / 2, yt + 0.018, CW + 0.04, 0.035, CD + 0.02, M.laminate); // 천판
    for (const s of [-1, 1]) {
      wallBox(b, wv, tu + s * (CW / 2 - 0.015), CD / 2, (yb + yt) / 2, 0.03, yt - yb, CD, M.laminate);
    }
    wallBox(b, wv, tu, 0.025, (yb + yt) / 2, CW, yt - yb, 0.05, M.laminate); // 등판
    wallBox(b, wv, tu, CD / 2, (yb + yt) / 2, 0.03, yt - yb, CD, M.laminate); // 칸막이
    for (const s of [-1, 1]) {
      // 한쪽은 서랍 둘, 다른 쪽은 **열린 칸** (문법을 갈라야 수납장으로 읽힌다)
      const du = s * 0.33;
      if (s < 0) {
        for (const y of [0.21, 0.46]) {
          wallBox(b, wv, tu + du, CD + 0.012, y, 0.58, 0.21, 0.024, M.trim);
          wallBox(b, wv, tu + du, CD + 0.035, y, 0.24, 0.026, 0.022, M.steel); // 손잡이
        }
      } else {
        // 비디오 데크 — 몸통 + 테이프 투입구 + 표시창. 90년대의 표식이다.
        // 열린 칸 안에 앉으므로 앞면이 몸통 앞(CD)보다 살짝 들어가 있다
        wallBox(b, wv, tu + du, CD / 2 - 0.02, 0.165, 0.54, 0.12, 0.38, M.crt);
        wallBox(b, wv, tu + du - 0.06, CD - 0.08, 0.175, 0.3, 0.03, 0.02, M.crtDark); // 투입구
        wallBox(b, wv, tu + du + 0.18, CD - 0.08, 0.16, 0.12, 0.035, 0.014, M.screen); // 표시창
        // 비디오테이프 넷 — 데크 위에 세워 꽂혀 있다
        for (let i = 0; i < 4; i++) {
          wallBox(b, wv, tu + du - 0.19 + i * 0.062, CD / 2 - 0.02, 0.34, 0.055, 0.2, 0.31,
            [M.vendBlue, M.crate, M.plasticWarm, M.vend][i]);
        }
      }
    }
    // ── TV장 마감 (2026-08-06 "전체적인 디테일 떨어짐") ──────────────────
    //
    // 판으로 짠 몸통과 서랍 둘만으로는 **책장**이다. 더한 것: 굽 받침 ·
    // 문짝 손잡이 위의 열쇠 구멍 · 천판 앞 몰딩 · 뒤로 나가는 전선 · 리모컨 ·
    // 잡지 두 권 · 그리고 TV 밑에 깔린 받침 매트.
    wallBox(b, wv, tu, CD / 2, yt + 0.042, CW + 0.06, 0.018, CD + 0.04, M.trim); // 천판 몰딩
    for (const s of [-1, 1]) {
      wallBox(b, wv, tu + s * (CW / 2 - 0.06), 0.05, 0.018, 0.12, 0.036, 0.12, M.rubber); // 굽 받침
    }
    for (const y of [0.21, 0.46]) {
      wallBox(b, wv, tu - 0.33 + 0.2, CD + 0.03, y, 0.022, 0.022, 0.014, M.steelDark); // 열쇠 구멍
    }
    {
      // 전선 — 뒤에서 나와 벽 밑으로. 늘어진 고리 셋
      for (let k = 0; k < 3; k++) {
        const g = new THREE.TorusGeometry(0.03, 0.006, 4, 8);
        g.rotateX(Math.PI / 2);
        g.translate(0, 0.05 + k * 0.02, 0.06 + k * 0.02);
        wallPut(b, wv, tu + 0.5, g, M.rubber);
      }
    }
    wallBox(b, wv, tu, CD / 2, yt + 0.055, 0.9, 0.008, 0.42, M.rubber); // TV 받침 매트
    // 리모컨과 잡지 — 천판 앞쪽
    wallBox(b, wv, tu - 0.52, CD - 0.1, yt + 0.062, 0.06, 0.014, 0.17, M.crtDark);
    for (let k = 0; k < 3; k++) {
      wallBox(b, wv, tu - 0.52, CD - 0.1, yt + 0.07, 0.03, 0.006, 0.03 + k * 0.02, M.keycap);
    }
    for (const [dk, mm] of [[0, M.vend], [1, M.crate]]) {
      wallBox(b, wv, tu + 0.5, CD - 0.14, yt + 0.062 + dk * 0.012, 0.22, 0.012, 0.28, mm); // 잡지
    }
    // TV — 서랍장 천판 윗면 위. 화면은 방 안(소파 쪽)을 본다
    crtTv(b, wv, tu, 0.648, M);
    tally.tv = (tally.tv ?? 0) + 1;
    b.endMark();
  }

  // 에어컨 — 동쪽 벽 위 (TV 반대편). 사람이 쉬는 방에는 냉방이 있다
  const wac = walls.filter((q) => q.axis === 'z' && q.b - q.a > 2.0).sort((p, q) => q.at - p.at)[0];
  if (wac) {
    b.mark('service', `aircon:${c.id}`);
    airCon(b, wac, (wac.a + wac.b) / 2, M, c.h);
    tally.airCon = (tally.airCon ?? 0) + 1;
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
    // ── 비누 선반 — **칸막이와 벽이 만나는 구석**에 물린다 ─────────────
    //
    // 부채꼴을 x 0.33 에 두었더니 칸막이(±0.525)에도 벽에도 안 닿아 허공에
    // 떠 있었다 (2026-08-06 지적). 사분원의 **모서리**가 구석에 오게 각도를
    // 잡는다: 세타 -90도~0도 구간이 -x·+z 를 덮는다 (0~90도는 +x·+z 라
    // 칸막이 속으로 들어간다).
    {
      const q = new THREE.CylinderGeometry(0.16, 0.16, 0.022, 8, 1, false, -Math.PI / 2, Math.PI / 2);
      q.translate(0.505, 1.06, 0.015);
      put(q, M.paper);
      // 선반 밑 받침 — 벽에 물린 삼각 브래킷. 없으면 판이 붙어만 있다
      const br = new THREE.BoxGeometry(0.12, 0.02, 0.1);
      br.rotateZ(-0.5);
      br.translate(0.45, 1.03, 0.05);
      put(br, M.trim);
      // 비누 한 장 — 모서리를 죽인 납작한 덩어리
      const soap = new THREE.CylinderGeometry(0.05, 0.042, 0.03, 10);
      soap.scale(1, 1, 0.6);
      soap.rotateY(0.4);
      soap.translate(0.42, 1.086, 0.075);
      put(soap, M.plasticWarm);
      // 샴푸 통 — 선반 안쪽. 비누만 있으면 하루치 살림이다
      const sh2 = new THREE.CylinderGeometry(0.03, 0.034, 0.14, 9);
      sh2.translate(0.455, 1.141, 0.13);
      put(sh2, M.vendBlue);
      const cap2 = new THREE.CylinderGeometry(0.014, 0.02, 0.035, 8);
      cap2.translate(0.455, 1.228, 0.13);
      put(cap2, M.trim);
      tally.soap = (tally.soap ?? 0) + 1;
    }
    // ── 커튼 봉과 커튼 ────────────────────────────────────────────────
    //
    // 봉이 0.94 라 칸막이(간격 1.05) 사이에서 양 끝이 5cm 씩 떠 있었다
    // (2026-08-06 지적). **양쪽 칸막이에 물리는 길이**로 늘린다.
    {
      const g = new THREE.CylinderGeometry(0.014, 0.014, 1.09, 8);
      g.rotateZ(Math.PI / 2);
      g.translate(0, 1.98, D - 0.05);
      put(g, M.trim);
      // 물막이 비닐 커튼 (사용자 지시) — **반쯤 걷힌 채 주름져 있다.**
      // 평평한 판 하나면 문짝이고, 폭이 다른 세로 조각들이 조금씩 어긋나
      // 접혀야 늘어진 비닐로 읽힌다. 고리도 있어야 봉에 걸린 것이 된다.
      const CY = 1.955; // 봉 밑
      for (let k = 0; k < 7; k++) {
        const r = hash2(Math.round(u * 9) + k, 17);
        const cw = 0.085 + r * 0.05;
        const cx2 = -0.5 + k * 0.1 + r * 0.02;
        const pl = new THREE.BoxGeometry(cw, 1.5, 0.012);
        pl.rotateY((r - 0.5) * 0.9); // 주름 — 조각마다 다른 각
        pl.translate(cx2, CY - 0.75, D - 0.05 + (r - 0.5) * 0.03);
        put(pl, M.glass);
        // 고리 — 봉에 걸린 링
        const ring = new THREE.TorusGeometry(0.022, 0.005, 4, 8);
        ring.rotateY(Math.PI / 2);
        ring.translate(cx2, 1.978, D - 0.05);
        put(ring, M.trim);
      }
      // 걷어 모은 쪽 — 오른쪽 끝의 접힌 뭉치 (반쯤 열어 둔 표식)
      for (let k = 0; k < 3; k++) {
        const pl = new THREE.BoxGeometry(0.06, 1.45, 0.05);
        pl.rotateY(0.6 - k * 0.4);
        pl.translate(0.4 + k * 0.045, CY - 0.73, D - 0.06);
        put(pl, M.glass);
      }
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
    const BL = Math.min(across.b - across.a - 0.4, 1.8);
    // 널판 하나가 아니라 **살 셋과 그 사이 틈** (플라자 벤치와 같은 문법)
    for (const dv of [0.22, 0.35, 0.48]) {
      wallBox(b, across, cm, dv, 0.445, BL, 0.04, 0.1, M.laminate);
    }
    for (const s of [-0.7, 0.7]) {
      // 다리 — ㄷ 자 관틀 + 발판. 통판 다리는 칸막이다
      for (const dv of [0.2, 0.5]) {
        const [lx3, , lz3] = wallAt(across, cm + s, dv, 0);
        tube(b, 0.022, 0.42, [lx3, 0.21, lz3], M.trim, 'y', 6);
      }
      wallBox(b, across, cm + s, 0.35, 0.012, 0.09, 0.024, 0.38, M.steelDark); // 발판
      wallBox(b, across, cm + s, 0.35, 0.415, 0.05, 0.025, 0.34, M.trim); // 윗 가로대
    }
    {
      // 버팀은 **벽을 따라** 눕는다. rotateZ 만 하면 축이 항상 x 라, z-벽에
      // 붙은 벤치에서는 관이 90도 어긋나 방 한가운데 바닥에 떨어져 있었다
      // ("의자 밑에 이거 뭔지" — 2026-08-06). 벽 축을 물어서 돌린다.
      const br2 = new THREE.CylinderGeometry(0.018, 0.018, BL - 0.3, 6);
      if (across.axis === 'x') br2.rotateZ(Math.PI / 2);
      else br2.rotateX(Math.PI / 2);
      const [bx6, , bz6] = wallAt(across, cm, 0.35, 0);
      br2.translate(bx6, 0.16, bz6);
      b.add(br2, M.trim); // 두 다리를 잇는 버팀
    }
    for (const t of fit(0, across.b - across.a, 0.5, 0.25).slice(0, 3)) {
      const u = across.a + t;
      if (Math.abs(u - cm) < 1.1) continue; // 벤치 자리는 비운다
      locker(I.spawnPair('locker'), across, u, M);
      tally.locker = (tally.locker ?? 0) + 1;
    }
    // 벤치 위의 비누와 수건 (사용자 지시 — 샤워실에 비누를 더 둔다).
    // 부스 안 선반의 비누와 달리 여기 것은 **쓰고 나온 자리**의 것이다.
    {
      const soap = new THREE.CylinderGeometry(0.05, 0.042, 0.03, 10);
      soap.scale(1, 1, 0.62);
      const [px, , pz] = wallAt(across, cm - 0.2, 0.34, 0);
      soap.translate(px, 0.48, pz);
      b.add(soap, M.paper);
      tally.soap = (tally.soap ?? 0) + 1;
      // 개킨 수건 — **층이 보여야** 개킨 것이다. 얇은 판 셋을 조금씩 어긋나게
      // 쌓고, 옆에 말아 둔 것 하나(원기둥)를 둔다
      for (let k = 0; k < 3; k++) {
        wallBox(b, across, cm + 0.42 + k * 0.012, 0.33, 0.478 + k * 0.026, 0.34 - k * 0.01, 0.024, 0.24, M.porcelain);
      }
      {
        const roll = new THREE.CylinderGeometry(0.055, 0.055, 0.26, 10);
        roll.rotateZ(Math.PI / 2);
        const [rx2, , rz2] = wallAt(across, cm + 0.78, 0.33, 0);
        roll.translate(rx2, 0.52, rz2);
        b.add(roll, M.porcelain);
      }
      // 샴푸·바디워시 — **벤치 위**에 올린다. cm-1.0 은 벤치(±0.9) 밖이라
      // 허공에 떠 있었다 (2026-08-06 지적 — 놓기 전에 상판 범위를 묻는다)
      for (const [du, mm] of [[-0.72, M.vendBlue], [-0.58, M.plasticWarm]]) {
        const [bx5, , bz5] = wallAt(across, cm + du, 0.33, 0);
        tube(b, 0.034, 0.16, [bx5, 0.545, bz5], mm, 'y', 9);
        const sh3 = new THREE.CylinderGeometry(0.016, 0.034, 0.04, 9);
        sh3.translate(bx5, 0.645, bz5);
        b.add(sh3, mm); // 어깨
        tube(b, 0.014, 0.035, [bx5, 0.682, bz5], M.trim, 'y', 6); // 뚜껑
      }
    }
    b.endMark();
  }
}

// 관제실 — 진입 사슬의 가운데. 서버실 유리를 향한 콘솔 줄과 상황판.
function control(b, c, M, tally, I) {
  // **벽 목록은 한 번만 뽑는다.** `interiorWalls` 는 부를 때마다 새 객체를
  // 만들어 돌려주므로, 두 번 불러 `q !== w` 로 거르면 **항상 참**이라 같은
  // 벽이 두 번 잡힌다 — 커피 카운터가 상황판 속에 박혔다 (2026-08-06).
  // 객체 동일성 비교는 같은 배열 안에서만 뜻이 있다.
  const walls = interiorWalls(c.id);
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
  const w = walls.find((q) => q.rule !== 'glass' && q.b - q.a > 3.0);
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

  // ── 당직이 사는 방으로 만드는 것들 (status.md 5.0 A) ──────────────────
  //
  // 콘솔과 상황판은 **설비**다. 바인더·무전기·커피포트·열쇠함이 있어야
  // 사람이 교대로 앉아 있던 방이 된다. 벽은 방위로 고른다 (lessons 3.15):
  //   동쪽 z-벽   긴 벽 — 바인더 선반과 벽시계
  //   서쪽 z-벽   짧은 벽 — 열쇠함
  //   남쪽 x-벽   상황판이 안 쓰는 쪽 조각 — 커피 카운터와 무전기 충전대
  const zw = walls.filter((q) => q.axis === 'z' && q.rule === 'solid');
  const wEast = zw.sort((p, q) => q.at - p.at)[0];
  if (wEast) {
    b.mark('furniture', `binders:${c.id}`);
    const cm = (wEast.a + wEast.b) / 2;
    const sl = Math.min(wEast.b - wEast.a - 0.5, 2.4);
    // 선반 둘 — 받침 브래킷(ㄱ자) 위에 널. 널만 있으면 벽에 뜬 판이다
    for (const y of [1.02, 1.44]) {
      wallBox(b, wEast, cm, 0.17, y, sl, 0.035, 0.3, M.laminate);
      for (const s of [-1, 1]) {
        wallBox(b, wEast, cm + s * (sl / 2 - 0.12), 0.14, y - 0.09, 0.03, 0.15, 0.24, M.trim);
      }
      binderRow(b, wEast, cm - sl / 2 + 0.04, sl - 0.08, y + 0.017, M, Math.round(y * 10));
    }
    tally.binderShelf = (tally.binderShelf ?? 0) + 1;
    wallClock(b, wEast, cm + sl / 2 + 0.55, M);
    tally.clock = (tally.clock ?? 0) + 1;
    b.endMark();
  }
  const wWest = zw.sort((p, q) => p.at - q.at)[0];
  if (wWest) {
    // 열쇠함 — 얕은 강판 함 + 여닫는 문 + 원통 자물쇠 + 라벨. 안에 열쇠가
    // 걸린 것은 안 보인다 (닫힌 문이므로) — 자물쇠와 라벨이 이 물건을 만든다
    b.mark('furniture', `keybox:${c.id}`);
    const u = (wWest.a + wWest.b) / 2;
    wallBox(b, wWest, u, 0.06, 1.5, 0.46, 0.56, 0.12, M.steelDark);
    wallBox(b, wWest, u + 0.01, 0.125, 1.5, 0.42, 0.5, 0.02, M.steel); // 문판
    {
      const lock = new THREE.CylinderGeometry(0.018, 0.018, 0.02, 8);
      lock.rotateX(Math.PI / 2);
      const [lx, , lz] = wallAt(wWest, u + 0.17, 0.14, 0);
      lock.translate(lx, 1.5, lz);
      b.add(lock, M.trim);
    }
    wallBox(b, wWest, u, 0.14, 1.71, 0.3, 0.07, 0.006, M.paper); // 라벨 띠
    tally.keybox = (tally.keybox ?? 0) + 1;
    b.endMark();
  }
  // 커피 카운터 + 무전기 충전대 — 상황판과 **같은 평면(at)의 다른 조각**.
  // 문틀 건너편이라는 뜻이다. "다른 조각 + 축만 같으면" 으로 골랐더니 서버실
  // **유리벽**이 잡혀 카운터가 유리를 막아섰다 (2026-08-06) — 축은 남·북을
  // 못 가른다. 평면까지 물어야 그 벽이다 (lessons 3.15).
  const wSide = w && walls.find(
    (q) => q !== w && q.axis === w.axis && Math.abs(q.at - w.at) < 0.05 && q.b - q.a > 3.0
  );
  if (wSide) {
    b.mark('furniture', `crew:${c.id}`);
    const cm = (wSide.a + wSide.b) / 2;
    wallBox(b, wSide, cm, 0.3, 0.9, 2.0, 0.05, 0.6, M.laminate); // 상판
    wallBox(b, wSide, cm, 0.29, 0.44, 1.9, 0.85, 0.55, M.trim); // 하부장
    // 커피포트 — 받침(가열판) + 몸통 + **유리 서버(손잡이 반토러스)** + 물통
    {
      const cu = cm - 0.6;
      const put = (g, m) => wallPut(b, wSide, cu, g, m);
      wallBox(b, wSide, cu, 0.3, 1.06, 0.26, 0.28, 0.24, M.crt); // 몸통
      wallBox(b, wSide, cu, 0.3, 1.23, 0.28, 0.06, 0.26, M.crtDark); // 뚜껑
      const plate = new THREE.CylinderGeometry(0.09, 0.09, 0.014, 10);
      plate.translate(0, 0.935, 0.42);
      put(plate, M.steelDark); // 가열판
      const pot = new THREE.CylinderGeometry(0.075, 0.062, 0.15, 10);
      pot.translate(0, 1.017, 0.42);
      put(pot, M.glass); // 유리 서버
      const ear = new THREE.TorusGeometry(0.05, 0.009, 5, 8, Math.PI);
      ear.rotateZ(-Math.PI / 2);
      ear.translate(0.075, 1.02, 0.42);
      put(ear, M.crtDark); // 손잡이
      const lid2 = new THREE.CylinderGeometry(0.066, 0.066, 0.02, 10);
      lid2.translate(0, 1.1, 0.42);
      put(lid2, M.crtDark);
      mug(b, ...wallAt(wSide, cu + 0.32, 0.28, 0.925), M, M.porcelain);
      tally.coffee = (tally.coffee ?? 0) + 1;
    }
    // 무전기 충전대 — 받침 + 꽂힌 무전기 넷(몸통 + **안테나 관**) + 충전 램프.
    // 안테나가 없으면 리모컨 꽂이다
    {
      const du = cm + 0.55;
      wallBox(b, wSide, du, 0.3, 0.955, 0.62, 0.06, 0.2, M.crtDark); // 받침
      for (let i = 0; i < 4; i++) {
        const u2 = du - 0.22 + i * 0.15;
        const put = (g, m) => wallPut(b, wSide, u2, g, m);
        wallBox(b, wSide, u2, 0.3, 1.08, 0.075, 0.19, 0.055, M.rubber); // 몸통
        const ant = new THREE.CylinderGeometry(0.006, 0.008, 0.13, 5);
        ant.translate(0.022, 1.24, 0.3);
        put(ant, M.rubber);
        wallBox(b, wSide, u2, 0.33, 1.14, 0.045, 0.035, 0.006, M.screen); // 표시창
        wallBox(b, wSide, u2 - 0.024, 0.33, 0.995, 0.012, 0.012, 0.006, i < 3 ? M.exit : M.warn); // 충전 램프
      }
      tally.radioDock = (tally.radioDock ?? 0) + 1;
    }
    b.endMark();
  }

  // 에어컨 — 동쪽 벽 위, 바인더 선반(꼭대기 1.75) 위쪽. 전산 권역은 사람보다
  // 기계 때문에 냉방이 필요한 방이다
  if (wEast) {
    b.mark('service', `aircon:${c.id}`);
    airCon(b, wEast, Math.min(wEast.a + 0.8, (wEast.a + wEast.b) / 2), M, c.h);
    tally.airCon = (tally.airCon ?? 0) + 1;
    b.endMark();
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

  // ── 사람이 손을 대는 자리 (status.md 5.0 A) ───────────────────────────
  //
  // 기계실은 기계만 있으면 창고다. **작업대와 공구판**이 있어야 고치러
  // 들어오는 방이 된다. 동쪽 z-벽에 몰아 둔다 — 공조기(서)·펌프(가운데)·
  // 탱크(동남)를 비킨 자리다. 벽은 방위로 고른다 (lessons 3.15).
  const wSideE = interiorWalls(c.id)
    .filter((q) => q.axis === 'z' && q.rule === 'solid' && q.b - q.a > 2.0)
    .sort((p, q) => q.at - p.at)[0];
  if (wSideE) {
    const uB = c.z1 - 1.4; // 북쪽 끝 — 탱크(z cz-1.4)를 비킨다
    b.mark('furniture', `bench:${c.id}`);
    // 작업대 — 두꺼운 상판 + 다리 넷 + 아래 서랍칸 + **바이스**(고정 턱 +
    // 움직이는 턱 + 나사 관 + 손잡이 봉). 바이스가 없으면 그냥 탁자다
    wallBox(b, wSideE, uB, 0.36, 0.9, 1.9, 0.07, 0.66, M.laminate);
    wallBox(b, wSideE, uB, 0.36, 0.86, 1.86, 0.03, 0.62, M.steelDark); // 상판 강판
    for (const s of [-1, 1]) {
      for (const dv of [0.12, 0.6]) {
        const [lx, , lz] = wallAt(wSideE, uB + s * 0.85, dv, 0);
        b.box(0.06, 0.86, 0.06, [lx, 0.43, lz], M.trim, 0);
      }
    }
    wallBox(b, wSideE, uB - 0.55, 0.36, 0.52, 0.7, 0.56, 0.6, M.steelDark); // 서랍칸
    for (const dy of [0.34, 0.52, 0.7]) {
      wallBox(b, wSideE, uB - 0.55, 0.665, dy, 0.62, 0.14, 0.02, M.trim);
      wallBox(b, wSideE, uB - 0.55, 0.68, dy, 0.16, 0.025, 0.02, M.steel); // 손잡이
    }
    {
      const uV = uB + 0.6;
      const put = (g, m) => wallPut(b, wSideE, uV, g, m);
      wallBox(b, wSideE, uV, 0.34, 0.98, 0.16, 0.09, 0.2, M.steelDark); // 바이스 몸
      wallBox(b, wSideE, uV, 0.26, 1.05, 0.15, 0.11, 0.04, M.steel); // 고정 턱
      wallBox(b, wSideE, uV, 0.43, 1.05, 0.15, 0.11, 0.04, M.steel); // 움직이는 턱
      const scr = new THREE.CylinderGeometry(0.016, 0.016, 0.24, 6);
      scr.rotateX(Math.PI / 2);
      scr.translate(0, 1.0, 0.5);
      put(scr, M.steel); // 나사 관
      const bar = new THREE.CylinderGeometry(0.011, 0.011, 0.24, 6);
      bar.rotateZ(Math.PI / 2);
      bar.translate(0, 1.0, 0.62);
      put(bar, M.steel); // 손잡이 봉 — T 자
      tally.workbench = (tally.workbench ?? 0) + 1;
    }
    b.endMark();
    // 공구판 — 작업대 바로 위. 손이 닿는 높이여야 공구판이다
    b.mark('furniture', `tools:${c.id}`);
    toolWall(b, wSideE, uB, M);
    tally.toolWall = (tally.toolWall ?? 0) + 1;
    b.endMark();
  }

  // 배관 라벨 띠 — 천장 배관에 두른 색 띠 + **흐름 화살표(3각 프리즘)**.
  // 라벨이 없으면 회색 관 줄이고, 있으면 설비가 관리되는 건물이 된다.
  b.mark('paint', `pipelabel:${c.id}`);
  for (const [off, r, m] of [
    [-0.5, 0.1, M.vendBlue],
    [0, 0.14, M.warn],
    [0.5, 0.08, M.vend],
  ]) {
    const py = 2.4 + off * 0.18;
    const pz = cz - 0.3 + off;
    for (const t of fit(c.x0 + 0.4, c.x1 - 0.4, 3.4, 0.8)) {
      tube(b, r + 0.006, 0.16, [t, py, pz], m, 'x', 8);
      const tri = new THREE.CylinderGeometry(r * 0.55, r * 0.55, 0.05, 3);
      tri.rotateZ(Math.PI / 2); // 축을 배관 방향(x)으로
      tri.translate(t + 0.16, py + r + 0.02, pz);
      b.add(tri, m);
    }
  }
  tally.pipeLabel = (tally.pipeLabel ?? 0) + 1;
  b.endMark();

  // 경고 표지 — 문 옆. **노란 바탕 + 검은 테 + 굵은 줄** (읽히는 글자는
  // 문 팻말의 몫이고, 여기는 눈에 띄는 색이 일이다)
  const wDoor = interiorWalls(c.id).find((q) => q.axis === 'x' && q.rule === 'door' && q.b - q.a > 1.4);
  if (wDoor) {
    b.mark('sign', `warn:${c.id}`);
    const uW = wDoor.a + 0.55;
    wallBox(b, wDoor, uW, 0.02, 1.78, 0.42, 0.34, 0.02, M.rubber); // 테
    wallBox(b, wDoor, uW, 0.032, 1.78, 0.37, 0.29, 0.008, M.warn); // 바탕
    for (const dy of [0.06, -0.02, -0.09]) {
      wallBox(b, wDoor, uW, 0.04, 1.78 + dy, 0.26 - Math.abs(dy) * 1.2, 0.028, 0.004, M.rubber);
    }
    tally.warnSign = (tally.warnSign ?? 0) + 1;
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

  // ── 계단실이 계단실인 표식 (status.md 5.0 A) ──────────────────────────
  //
  // 자리는 **련이 시작되기 전의 북쪽 유예 공간**(z zTop..c.z1)뿐이다 —
  // 나머지는 계단이 벽까지 꽉 찬다. 동쪽 벽에 몰아 단다. 스콘스(y 2.3,
  // z -13.2·-11.1 — lights.js 가 같은 칸에서 뽑는다) 아래로 비킨다.
  const mid = (c.x0 + c.x1) / 2;
  const wEast = interiorWalls(c.id).find((q) => q.axis === 'z' && q.rule === 'solid' && q.at > mid);
  // 북쪽 벽은 문 자리에서 **두 조각**으로 갈린다 (서·동). 둘 다 유예 공간을
  // 마주하므로 그 둘을 쓴다 — 동쪽 z-벽은 2련이 바짝 붙어 자리가 1.5m 뿐이다.
  const north = interiorWalls(c.id)
    .filter((q) => q.axis === 'x' && q.at > (c.z0 + c.z1) / 2)
    .sort((p, q) => p.a - q.a);
  b.mark('fixture', `stairkit:${c.id}`);
  if (wEast) {
    extinguisher(b, wEast, c.z1 - 0.6, M);
    tally.extinguisher = (tally.extinguisher ?? 0) + 1;
  }
  if (north.length >= 2) {
    // 층 표시 — **글자를 굽는다** (문 팻말과 같은 signOf). 계단실에서 지금
    // 몇 층인지 아는 것이 이 방의 유일한 정보다. 판 + 테 + 그 아래 띠.
    const wS = north[north.length - 1];
    const uS = (wS.a + wS.b) / 2;
    // 판 비율은 **텍스처 비율(256x64 = 4:1)을 따른다.** 정사각으로 뒀더니
    // 글자가 세로로 늘어나 무슨 글자인지 안 읽혔다 (2026-08-06).
    const SW = 0.92;
    const SH2 = SW / 4;
    wallBox(b, wS, uS, 0.02, 1.9, SW + 0.08, SH2 + 0.08, 0.02, M.trim); // 테
    {
      // 앞면만 글씨 — 상자면 옆구리에도 B1 이 눌려 붙는다 (roomSigns 와 같은 처방)
      const g = new THREE.PlaneGeometry(SW, SH2);
      g.rotateY(wallYaw(wS));
      const [sx, , sz] = wallAt(wS, uS, 0.032, 0);
      g.translate(sx, 1.9, sz);
      b.add(g, M.signOf('B1'));
    }
    wallBox(b, wS, uS, 0.035, 1.68, SW, 0.06, 0.008, M.exit); // 아래 띠
    tally.floorMark = (tally.floorMark ?? 0) + 1;

    // 비상 배전함 — 얕은 함 + 여닫는 문 + 경고 딱지 + 천장으로 나가는 전선관.
    // 배전반과 같은 문법이지만 계단실 것은 작다 (비상등·경보 회로만 든다)
    const wP = north[0];
    const uP = (wP.a + wP.b) / 2;
    wallBox(b, wP, uP, 0.07, 1.42, 0.4, 0.56, 0.14, M.steelDark);
    wallBox(b, wP, uP + 0.01, 0.145, 1.42, 0.36, 0.5, 0.02, M.trim); // 문판
    wallBox(b, wP, uP + 0.15, 0.16, 1.42, 0.03, 0.1, 0.02, M.steel); // 손잡이
    wallBox(b, wP, uP, 0.15, 1.61, 0.2, 0.1, 0.006, M.warn); // 경고 딱지
    const [cx3, , cz3] = wallAt(wP, uP, 0.07, 0);
    tube(b, 0.022, c.h - 1.7, [cx3, 1.7 + (c.h - 1.7) / 2, cz3], M.trim, 'y', 6); // 전선관
    tally.emergPanel = (tally.emergPanel ?? 0) + 1;
  }
  b.endMark();
}

// 엘리베이터 홀 — 닫힌 문 두 짝과 호출반, 층 표시.
function elevatorHall(b, c, M, tally, I) {
  // 문은 남쪽 외벽(막힌 벽)에 낸다 — 승강로는 벽 너머(매립 쪽) 상상 속이다.
  // 벽 목록은 **한 번만** 뽑는다 — 두 번 부르면 새 객체가 나와 아래
  // `q !== w` 가 항상 참이 된다 (관제실에서 실제로 겹쳤다, 2026-08-06).
  const walls = interiorWalls(c.id);
  const w = walls.filter((q) => q.rule === 'solid').sort((p, q) => q.b - q.a - (p.b - p.a))[0];
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

  // ── 기다리는 자리 (status.md 5.0 A) ───────────────────────────────────
  //
  // 엘리베이터 앞은 **서서 기다리는 곳**이다 — 문짝만 있으면 승강로 입구지
  // 홀이 아니다. 층 안내판·벤치·재떨이·화분이 그 시간을 만든다.
  // 문이 선 벽(w)이 아니라 **옆 벽**을 골라야 문 앞이 안 막힌다.
  const side = walls.find((q) => q !== w && q.rule === 'solid' && q.b - q.a > 3.0);
  if (side) {
    // 층 안내판 — 어두운 보드 + 헤더 띠 + 층 줄 넷 (플라자 파일런과 같은 문법)
    b.mark('sign', `directory:${c.id}`);
    const du = (side.a + side.b) / 2;
    wallBox(b, side, du, 0.04, 1.62, 1.1, 0.86, 0.05, M.crtDark);
    wallBox(b, side, du, 0.07, 1.97, 1.1, 0.16, 0.02, M.vendBlue); // 헤더
    wallBox(b, side, du - 0.06, 0.085, 1.97, 0.78, 0.07, 0.008, M.paper);
    for (let i = 0; i < 4; i++) {
      const y = 1.79 - i * 0.15;
      wallBox(b, side, du - 0.34, 0.075, y, 0.12, 0.06, 0.008, M.exit); // 층 번호
      wallBox(b, side, du + 0.1, 0.075, y, 0.56, 0.045, 0.008, M.paper); // 층 이름
    }
    tally.directory = (tally.directory ?? 0) + 1;
    b.endMark();

    // 벤치 — 안내판 아래. 등받이 없는 대기용 (다리는 관이다)
    b.mark('furniture', `bench:${c.id}`);
    const nb = I.spawn('bench');
    wallBox(nb, side, du, 0.32, 0.44, 1.5, 0.07, 0.42, M.laminate);
    for (const s of [-1, 1]) {
      for (const dv of [0.18, 0.46]) {
        const [lx, , lz] = wallAt(side, du + s * 0.6, dv, 0);
        tube(nb, 0.022, 0.42, [lx, 0.21, lz], M.trim, 'y', 6);
      }
      wallBox(nb, side, du + s * 0.6, 0.32, 0.06, 0.05, 0.04, 0.34, M.trim); // 발
    }
    tally.bench = (tally.bench ?? 0) + 1;
    b.endMark();

    // 재떨이 스탠드 — 기둥 + **모래 접시(오목한 사발)** + 테두리 링.
    // 90년대 사무실 로비의 표식이다. 뚜껑 없는 원통은 그냥 쓰레기통이다
    b.mark('furniture', `ashtray:${c.id}`);
    {
      const [ax2, , az2] = wallAt(side, side.b - 0.75, 0.5, 0);
      tube(b, 0.13, 0.03, [ax2, 0.015, az2], M.steelDark, 'y', 10, true); // 받침
      tube(b, 0.045, 0.6, [ax2, 0.3, az2], M.steelDark, 'y', 8); // 기둥
      const bowl2 = new THREE.CylinderGeometry(0.13, 0.075, 0.1, 12);
      bowl2.translate(ax2, 0.65, az2);
      b.add(bowl2, M.steel); // 사발 — 위가 넓다
      const ring = new THREE.TorusGeometry(0.13, 0.012, 5, 12);
      ring.translate(ax2, 0.7, az2);
      b.add(ring, M.steel);
      tube(b, 0.115, 0.012, [ax2, 0.695, az2], M.rubber, 'y', 12, true); // 모래
      tally.ashtray = (tally.ashtray ?? 0) + 1;
    }
    b.endMark();
  }
  // 화분 둘 — 문 양 옆 바깥. 호출반(cm) 자리를 비킨다
  b.mark('furniture', `planter:${c.id}`);
  for (const s of [-1, 1]) {
    const [px, , pz] = wallAt(w, cm + s * 2.75, 0.45, 0);
    planter(b, px, pz, M, s > 0 ? 21 : 7);
    tally.planter = (tally.planter ?? 0) + 1;
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

  // ── 옆면 그림 (2026-08-06 지시) ──────────────────────────────────────
  //
  // 자판기는 **옆에서 봐도 무엇을 파는지 알아야** 한다 — 복도에서는 앞면이
  // 안 보이는 각이 더 많다. 진열창의 상품과 같은 문법으로 옆판에 큰 그림을
  // 그린다: 음료기는 **병 실루엣**, 스낵기는 **봉지와 갑**.
  // ── 옆면 광고 — **텍스처 한 장** (2026-08-06 지시) ────────────────────
  //
  // 상자 조각을 층층이 쌓아 그리던 것을 걷어냈다: 층마다 z-파이팅을 피해야
  // 했고, 병 어깨 같은 곡선을 못 냈고, 색이 재질 팔레트에 갇혔다.
  // 인쇄물은 인쇄물답게 굽는다 (textures.vendSideTextures).
  // 판은 **평면**이다 — 상자면 여섯 면에 같은 그림이 붙는다 (팻말과 같은 규칙).
  for (const s of [-1, 1]) {
    const PW2 = DEP - 0.2;
    const PH3 = HT * 0.56;
    const face = new THREE.PlaneGeometry(PW2, PH3);
    // 판의 법선은 기본 +z 다. **벽을 따라가는 축**이 x 냐 z 냐에 따라
    // 돌리는 각이 다르다 — 한쪽만 맞춰 두면 절반이 옆이 아니라 앞을 본다
    if (w.axis === 'x') face.rotateY((s * Math.PI) / 2);
    else if (s < 0) face.rotateY(Math.PI);
    const [fx3, , fz3] = wallAt(w, u, DEP / 2, 0);
    const along = w.axis === 'x' ? [1, 0] : [0, 1];
    const off = s * (WID / 2 + 0.006);
    face.translate(fx3 + along[0] * off, HT * 0.55, fz3 + along[1] * off);
    b.add(face, M.vendSideOf(kind));
    // 광고판 테 — 인쇄물이 판에 붙은 것으로 읽히게
    for (const dy of [HT * 0.55 + PH3 / 2 + 0.015, HT * 0.55 - PH3 / 2 - 0.015]) {
      wallBox(b, w, u + off, DEP / 2, dy, 0.01, 0.026, PW2 + 0.04, M.trim);
    }
  }

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
    // 젖힘 각은 랙마다 다르다 — 전부 63도면 한 사람이 한 번에 연 것이 된다
    // (status.md 5.0 B, 사물함과 같은 처방). seed 는 랙 번호라 결정적이다
    const SWING = 0.8 + hash2(seed * 3, 29) * 0.65; // 46 ~ 83도
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

  // ── 랙 말고도 있어야 하는 것들 (status.md 5.0 A) ──────────────────────
  //
  // **자리를 랙 격자에서 유도한다** — 손으로 적으면 열 간격을 바꾸는 순간
  // 전부 랙 속에 박힌다. 랙은 x 로 rows(폭 1.0), z 로 fit(…,0.62,1.6) 안에
  // 선다. 그 바깥의 두 띠가 빈 자리다:
  //   서쪽 통로  c.x0 .. rows[0]-0.5   (관제실에서 들어와 처음 걷는 곳)
  //   남쪽 띠    c.z0 .. 첫 랙          (유리벽 앞)
  //   북쪽 띠    마지막 랙 .. c.z1      (냉방기 사이)
  const xRack0 = (rows.length ? rows[0] : c.x0 + 2.4) - 0.5; // 첫 랙의 서쪽 면
  const xTray = xRack0 - 0.42; // 트레이 — 랙 바로 앞 통로
  const xCart = c.x0 + 0.9; // 카트 — 벽 쪽 (트레이를 타고 넘지 않는다)
  const zSouth = c.z0 + 0.75;
  const zNorth = c.z1 - 0.8;

  // 바닥 케이블 트레이 — 유리벽 앞을 가로지르고 서쪽 통로로 꺾어 오른다.
  // 랙 밑으로 들어가는 것이 실제지만, 보이는 것은 이 간선이다.
  b.mark('service', `tray:${c.id}`);
  cableTray(b, 'x', zSouth, c.x0 + 0.5, c.x1 - 0.5, M, 3);
  cableTray(b, 'z', xTray, zSouth + 0.5, zNorth - 1.1, M, 5);
  tally.cableTray = (tally.cableTray ?? 0) + 2;
  b.endMark();

  // 가스계 소화기 — **서쪽 벽면의 긴 조각**. 전산실은 물·분말을 못 쓴다.
  // 평면(at)만 고르고 조각은 순서에 맡겼더니, 같은 서쪽 벽이 둘로 갈려 있어
  // 짧은 북쪽 토막이 잡히고 소화기가 방 안쪽 끝에 가 붙었다 — 평면을 고른
  // 뒤 **그 안에서 다시 길이로** 고른다 (lessons 3.15 의 뒷면).
  const zSolid = interiorWalls(c.id).filter((q) => q.axis === 'z' && q.rule === 'solid');
  const westAt = zSolid.length ? Math.min(...zSolid.map((q) => q.at)) : null;
  const wWest = zSolid
    .filter((q) => Math.abs(q.at - westAt) < 0.05)
    .sort((p, q) => q.b - q.a - (p.b - p.a))[0];
  if (wWest) {
    b.mark('fixture', `gasext:${c.id}`);
    extinguisher(b, wWest, wWest.a + 0.8, M, true); // 들어오자마자 손이 닿는 자리
    tally.extinguisher = (tally.extinguisher ?? 0) + 1;
    b.endMark();
  }

  // 여분 랙 부품 상자 — 북쪽 띠(냉방기 서쪽)에 쌓아 둔 것. 창고와 같은 문법
  b.mark('furniture', `spares:${c.id}`);
  for (const [dx, dz, sz, yaw, up] of [
    [0.0, 0.0, [0.52, 0.34, 0.42], 0.12, 0],
    [0.0, 0.02, [0.46, 0.28, 0.38], -0.3, 0.34],
    [0.7, -0.06, [0.44, 0.4, 0.36], 0.5, 0],
  ]) {
    carton(b, [c.x0 + 0.85 + dx, up, zNorth + dz], sz, yaw, M);
    tally.carton = (tally.carton ?? 0) + 1;
  }
  crate(b, [c.x0 + 1.55, 0.4, zNorth - 0.06], -0.22, M);
  tally.crate = (tally.crate ?? 0) + 1;
  b.endMark();

  // 이동식 콘솔 카트 — 선반 둘 + **바퀴 넷** + 브라운관 + 자판 트레이.
  // 랙에 꽂아 쓰는 물건이라 통로에 서 있다 (바퀴가 없으면 그냥 탁자다).
  b.mark('furniture', `cart:${c.id}`);
  {
    const kx = xCart;
    const kz = (zSouth + zNorth) / 2;
    b.box(0.62, 0.03, 0.5, [kx, 0.72, kz], M.steelDark, 0); // 상판
    b.box(0.58, 0.025, 0.46, [kx, 0.38, kz], M.steelDark, 0); // 아래 선반
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        tube(b, 0.018, 0.62, [kx + sx * 0.27, 0.41, kz + sz * 0.21], M.trim, 'y', 6); // 기둥
        // 바퀴 — 굴대 + 눕힌 원판
        const g = new THREE.CylinderGeometry(0.045, 0.045, 0.028, 8);
        g.rotateZ(Math.PI / 2);
        g.translate(kx + sx * 0.27, 0.05, kz + sz * 0.21);
        b.add(g, M.rubber);
        tube(b, 0.012, 0.06, [kx + sx * 0.27, 0.08, kz + sz * 0.21], M.trim, 'y', 6); // 캐스터 목
      }
    }
    terminal(b, kx, 0.735, kz + 0.02, -1, M); // 화면이 통로(서쪽 아닌 남쪽)를 본다
    // 라벨 프린터 — 아래 선반. 몸통 + 라벨 롤(원통) + 뽑혀 나온 띠
    b.box(0.26, 0.13, 0.2, [kx - 0.12, 0.45, kz], M.paper, 0);
    b.box(0.2, 0.03, 0.06, [kx - 0.12, 0.52, kz + 0.1], M.crtDark, 0); // 출구 슬롯
    tube(b, 0.045, 0.09, [kx + 0.13, 0.44, kz - 0.05], M.paper, 'x', 10, true); // 라벨 롤
    b.box(0.13, 0.004, 0.02, [kx - 0.12, 0.393, kz + 0.16], M.paper, 0); // 뽑혀 나온 띠
    tally.cart = (tally.cart ?? 0) + 1;
    tally.printer = (tally.printer ?? 0) + 1;
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
    // 널판 하나에 정육면체 둘이면 벤치가 아니라 **받침대**다. 공공 벤치를
    // 벤치로 만드는 것: **살(slat)들과 그 사이의 틈** · 관 다리 · 가로 버팀 ·
    // 바닥 발판. 틈이 있어야 앉는 물건으로 읽힌다.
    const L2 = 2.0;
    const SLAT = 4;
    const alongX = !rot; // rot 이면 벤치가 z 로 길다
    for (let i = 0; i < SLAT; i++) {
      const off = -0.195 + i * 0.13;
      const sz = alongX ? [L2, 0.045, 0.1] : [0.1, 0.045, L2];
      nb.box(sz[0], sz[1], sz[2], [x + (alongX ? 0 : off), 0.45, z + (alongX ? off : 0)], M.laminate, 0);
    }
    for (const s of [-0.72, 0.72]) {
      const lx = x + (alongX ? s : 0);
      const lz = z + (alongX ? 0 : s);
      // 다리 — ㄷ 자 관틀 (양옆 기둥 + 위 가로대). 관이라야 각목이 아니다
      for (const d of [-0.195, 0.195]) {
        const px2 = lx + (alongX ? 0 : d);
        const pz2 = lz + (alongX ? d : 0);
        tube(nb, 0.023, 0.42, [px2, 0.21, pz2], M.trim, 'y', 6);
        nb.box(0.12, 0.025, 0.12, [px2, 0.012, pz2], M.steelDark, 0); // 발판
      }
      const rail = new THREE.CylinderGeometry(0.023, 0.023, 0.43, 6);
      rail.rotateZ(Math.PI / 2);
      if (!alongX) rail.rotateY(Math.PI / 2);
      rail.translate(lx, 0.42, lz);
      nb.add(rail, M.trim); // 다리 윗 가로대 — 살들을 받는다
    }
    // 가운데 세로 버팀 — 두 다리를 잇는다. **다리 사이(z=0)를 지나므로
    // 다리 기둥(z ±0.195)에 안 닿아 허공에 떠 있었다** (2026-08-06 지적).
    // 다리마다 아래 가로대를 하나 더 두어 버팀이 그것에 물리게 한다.
    for (const s of [-0.72, 0.72]) {
      const lr = new THREE.CylinderGeometry(0.019, 0.019, 0.43, 6);
      lr.rotateZ(Math.PI / 2);
      if (alongX) lr.rotateY(Math.PI / 2); // 다리 폭 방향(z)으로 눕는다
      lr.translate(x + (alongX ? s : 0), 0.16, z + (alongX ? 0 : s));
      nb.add(lr, M.trim);
    }
    {
      const br = new THREE.CylinderGeometry(0.018, 0.018, 1.44, 6);
      br.rotateZ(Math.PI / 2);
      if (!alongX) br.rotateY(Math.PI / 2);
      br.translate(x, 0.16, z);
      nb.add(br, M.trim);
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

  // ── 홀의 네 구석 (status.md 5.0 A) ────────────────────────────────────
  //
  // **플라자에는 벽이 없다** — 사방이 고리 복도로 트여 `interiorWalls` 가 빈
  // 배열이다 (벤치가 0개였던 그 자리). 그래서 게시판도 공중전화도 **자립**
  // 이어야 한다. 벤치(±3.4)·쓰레기통(±4.3)을 비켜 네 구석에 하나씩 둔다.
  const CORNER = [
    [-4.9, -3.5],
    [4.9, 3.5],
    [4.9, -3.5],
    [-4.9, 3.5],
  ];

  // 게시판 — 다리 둘로 선 양면 판 + 압정으로 꽂힌 종이들. 종이가 없으면
  // 빈 널이다: 크기·각도가 제각각이어야 "사람이 붙이고 간" 판이 된다
  b.mark('sign', 'plaza:noticeboard');
  {
    const [bx, bz] = [cx + CORNER[0][0], cz + CORNER[0][1]];
    // 다리 — 판 **바깥**으로 세우고 위 테까지만 올린다. 판 폭(1.44) 안쪽에
    // 두고 1.5m 까지 올렸더니 기둥이 판을 뚫고 앞으로 튀어나왔다
    // ("철심이 튀어나와 있음" — 2026-08-06 지적)
    for (const s of [-1, 1]) {
      tube(b, 0.032, 1.94, [bx + s * 0.79, 0.97, bz], M.trim, 'y', 8);
      b.box(0.3, 0.035, 0.42, [bx + s * 0.79, 0.017, bz], M.steelDark, 0); // 발
      b.box(0.11, 0.025, 0.2, [bx + s * 0.79, 0.05, bz], M.steelDark, 0); // 발 위 리브
    }
    b.box(1.5, 1.06, 0.05, [bx, 1.42, bz], M.cartonDark, 0); // 코르크 판
    for (const [yy] of [[1.98], [0.86]]) b.box(1.62, 0.07, 0.1, [bx, yy, bz], M.trim, 0); // 위·아래 테
    for (const s of [-1, 1]) b.box(0.06, 1.2, 0.09, [bx + s * 0.76, 1.42, bz], M.trim, 0); // 옆 테
    // 붙은 종이 — 양면 각각 다섯. 크기·각도가 제각각이라야 게시판이다
    for (let i = 0; i < 10; i++) {
      const r = hash2(i * 3, 29);
      const side = i < 5 ? 1 : -1;
      const k = i % 5;
      const w2 = 0.19 + r * 0.15;
      const h2 = 0.24 + r * 0.11;
      const px7 = bx - 0.5 + (k % 3) * 0.5;
      const py7 = 1.66 - Math.floor(k / 3) * 0.4;
      const g = new THREE.BoxGeometry(w2, h2, 0.005);
      g.rotateZ((r - 0.5) * 0.26);
      g.translate(px7, py7, bz + side * 0.032);
      b.add(g, r > 0.8 ? M.warn : M.paper);
      // 글줄 — 종이가 백지면 아직 안 쓴 것이다
      for (let q = 0; q < 3; q++) {
        const ln = new THREE.BoxGeometry(w2 * 0.68, 0.012, 0.003);
        ln.rotateZ((r - 0.5) * 0.26);
        ln.translate(px7, py7 + h2 * 0.22 - q * 0.045, bz + side * 0.037);
        b.add(ln, M.rubber);
      }
      const pin = new THREE.CylinderGeometry(0.008, 0.008, 0.014, 6);
      pin.rotateX(Math.PI / 2);
      pin.translate(px7, py7 + h2 / 2 - 0.028, bz + side * 0.042);
      b.add(pin, i % 3 ? M.vend : M.exit);
    }
    tally.noticeBoard = (tally.noticeBoard ?? 0) + 1;
  }
  b.endMark();

  // 공중전화 — 등판(반쪽 부스) + 본체 + **수화기와 꼬인 코드** + 동전 투입구 +
  // 전화번호부 선반. 코드가 없으면 벽에 붙인 상자다 (90년대의 표식이다)
  b.mark('furniture', 'plaza:payphone');
  {
    const [px, pz] = [cx + CORNER[1][0], cz + CORNER[1][1]];
    b.box(1.0, 2.0, 0.08, [px, 1.0, pz + 0.24], M.vendBlue, 0); // 등판
    for (const s of [-1, 1]) b.box(0.08, 2.0, 0.44, [px + s * 0.46, 1.0, pz + 0.02], M.vendBlue, 0); // 옆 날개
    b.box(1.0, 0.1, 0.5, [px, 2.05, pz + 0.03], M.vendBlue, 0); // 차양
    b.box(0.34, 0.62, 0.16, [px, 1.42, pz + 0.12], M.steelDark, 0); // 본체
    b.box(0.3, 0.2, 0.02, [px, 1.62, pz + 0.03], M.trim, 0); // 번호판 면
    for (let r = 0; r < 4; r++) {
      for (let k = 0; k < 3; k++) {
        b.box(0.05, 0.035, 0.012, [px - 0.08 + k * 0.08, 1.68 - r * 0.045, pz + 0.02], M.keycap, 0); // 버튼
      }
    }
    b.box(0.1, 0.03, 0.02, [px + 0.1, 1.75, pz + 0.02], M.crtDark, 0); // 동전 투입구
    b.box(0.12, 0.05, 0.03, [px, 1.14, pz + 0.04], M.crtDark, 0); // 반환구
    // 수화기 — 몸통 옆의 걸이에 **세로로 걸린다.** 가로로 눕혀 옆구리에
    // 붙였더니 확성기처럼 튀어나왔다 (2026-08-06) — 벽걸이 전화의 수화기는
    // 서 있다. 조각: 걸이 갈고리 · 자루(관) · 위아래 귀(원뿔대 둘) · 꼬인 코드.
    {
      const hx = px - 0.2;
      b.box(0.05, 0.04, 0.06, [hx + 0.03, 1.56, pz + 0.06], M.steelDark, 0); // 걸이
      const body = new THREE.CylinderGeometry(0.026, 0.026, 0.2, 8);
      body.translate(hx, 1.44, pz + 0.07);
      b.add(body, M.rubber); // 자루
      for (const [dy, r0, r1] of [[0.115, 0.045, 0.032], [-0.115, 0.032, 0.045]]) {
        const ear = new THREE.CylinderGeometry(r0, r1, 0.055, 8);
        ear.translate(hx, 1.44 + dy, pz + 0.07);
        b.add(ear, M.rubber); // 귀 — 위아래가 넓다
      }
      // 꼬인 코드 — **수평으로 누운 고리**가 아래로 쌓인다. 수화기 밑에서
      // 나와 본체 아래로 들어간다 (직선 관이면 막대다)
      for (let i = 0; i < 7; i++) {
        const g = new THREE.TorusGeometry(0.026, 0.006, 4, 8);
        g.rotateX(Math.PI / 2);
        g.translate(hx + i * 0.011, 1.29 - i * 0.036, pz + 0.07);
        b.add(g, M.rubber);
      }
      const tailC = new THREE.CylinderGeometry(0.006, 0.006, 0.08, 5);
      tailC.rotateZ(-0.9);
      tailC.translate(hx + 0.11, 1.06, pz + 0.07);
      b.add(tailC, M.rubber); // 본체로 들어가는 끝
    }
    b.box(0.42, 0.04, 0.24, [px, 1.02, pz + 0.14], M.trim, 0); // 선반
    b.box(0.26, 0.1, 0.19, [px + 0.04, 1.09, pz + 0.14], M.carton, 0); // 전화번호부
    tally.payphone = (tally.payphone ?? 0) + 1;
  }
  b.endMark();

  // 화분 둘 — 남은 두 구석
  b.mark('furniture', 'plaza:planter');
  for (const k of [2, 3]) {
    planter(b, cx + CORNER[k][0], cz + CORNER[k][1], M, k * 9);
    tally.planter = (tally.planter ?? 0) + 1;
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
      // ── 서랍 속 내용물 (status.md 5.0 B) ─────────────────────────────
      //
      // 빈 서랍은 "약탈당했다" 가 아니라 **처음부터 비어 있던 가구**로
      // 읽힌다. 뒤진 흔적이 남으려면 안에 뭔가 남아 있어야 한다:
      // 흐트러진 서류 · 칸막이 트레이 · 스테이플러 · 굴러다니는 연필.
      const dzc = dz(0.35 + out / 2 - 0.01);
      const dxc = dx(-0.55);
      b.box(0.11, 0.02, out - 0.07, [dxc - 0.11, dy - 0.042, dzc], M.trim, 0); // 칸막이 트레이
      b.box(0.19, 0.03, out - 0.09, [dxc + 0.06, dy - 0.036, dzc], M.paper, 0); // 서류 뭉치
      b.box(0.17, 0.02, out - 0.12, [dxc + 0.05, dy - 0.02, dzc + 0.012], M.paper, 0); // 흐트러진 한 장
      b.box(0.055, 0.028, 0.11, [dxc - 0.11, dy - 0.018, dzc], M.crtDark, 0); // 스테이플러
      {
        const pen = new THREE.CylinderGeometry(0.004, 0.004, 0.13, 5);
        pen.rotateZ(Math.PI / 2);
        pen.rotateY(0.35);
        pen.translate(dxc - 0.1, dy - 0.028, dzc - 0.05);
        b.add(pen, M.vend); // 굴러다니는 연필
      }
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

  // ── 비품 서랍장과 복합기 — **동쪽 벽** (2026-08-06 사용자 지시) ────────
  //
  // 책장(북쪽 긴 벽)·화이트보드(남쪽 복도 벽)가 이미 자리를 잡았으므로
  // 동쪽 z-벽이 비어 있다. 포드 줄 동쪽 끝에서 2.8m 떨어져 통로가 남는다.
  // 벽은 방위로 고른다 (lessons 3.15) — "제일 긴 벽" 은 북쪽이라 겹친다.
  const eastW = interiorWalls(c.id)
    .filter((q) => q.axis === 'z' && q.rule === 'solid' && q.b - q.a > 3.0)
    .sort((p, q) => q.at - p.at)[0];
  if (eastW) {
    const cm = (eastW.a + eastW.b) / 2;
    b.mark('furniture', `supply:${c.id}`);
    // 비품 서랍장 둘 — 하나는 서랍이 열려 속이 보인다 (쓰던 방이다)
    for (const [du, open] of [[-1.5, -1], [-0.72, 1]]) {
      drawerCabinet(b, eastW, cm + du, M, 0.72, 1.28, 0.46, 4, open);
      tally.supplyCab = (tally.supplyCab ?? 0) + 1;
    }
    // 서랍장 위의 잡동사니 — 복사용지 묶음과 상자. 천판 윗면(1.37)에 앉힌다
    const [sx4, , sz4] = wallAt(eastW, cm - 1.5, 0.23, 0);
    b.box(0.3, 0.11, 0.22, [sx4, 1.425, sz4], M.paper, 0);
    b.box(0.28, 0.02, 0.2, [sx4, 1.49, sz4], M.trim, 0); // 묶음 띠
    const [bx5, , bz5] = wallAt(eastW, cm - 0.72, 0.23, 0);
    carton(b, [bx5, 1.37, bz5], [0.34, 0.24, 0.28], 0.2, M);
    tally.carton = (tally.carton ?? 0) + 1;
    b.endMark();

    // 복합기 — 서랍장 옆. 사무실에서 제일 큰 기계다
    b.mark('furniture', `copier:${c.id}`);
    copier(b, eastW, cm + 0.6, M);
    tally.copier = (tally.copier ?? 0) + 1;
    // 옆에 쌓아 둔 복사용지 상자 둘
    const [px4, , pz4] = wallAt(eastW, cm + 1.45, 0.35, 0);
    carton(b, [px4, 0, pz4], [0.44, 0.3, 0.34], 0.12, M);
    carton(b, [px4, 0.3, pz4], [0.42, 0.28, 0.32], -0.25, M);
    tally.carton = (tally.carton ?? 0) + 2;
    b.endMark();

    // 에어컨 — 같은 벽 위쪽 끝. 사람이 종일 앉아 있는 방이다
    b.mark('service', `aircon:${c.id}`);
    airCon(b, eastW, Math.min(cm + 2.1, eastW.b - 0.6), M, c.h);
    tally.airCon = (tally.airCon ?? 0) + 1;
    b.endMark();
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
  // **선반은 벽 셋에만** 세운다 (2026-08-06 지시 "공간이 죄다 선반으로
  // 잠식되어 있다"). 모든 벽에 두르면 방이 선반 통이 되고, 가운데에 놓을
  // 것(작업대·팰릿)이 설 자리도, 사람이 돌 자리도 없어진다.
  // 문이 있는 벽(입구 쪽)은 비워 둔다 — 들어서면 트인 바닥이 먼저 보인다.
  const shelfWalls = interiorWalls(c.id)
    .filter((q) => q.rule === 'solid' && q.b - q.a > 1.6)
    .sort((p, q) => q.b - q.a - (p.b - p.a))
    .slice(0, 3);
  for (const w of shelfWalls) {
    const len = w.b - w.a;
    for (const t of fit(0, len, 1.05, 0.6).map((v) => v / len)) {
      const u = w.a + len * t;
      bay++;
      for (const y of LEVELS) {
        wallBox(b, w, u, 0.32, y, 0.98, 0.04, 0.58, M.steelDark);
        wallBox(b, w, u, 0.605, y - 0.03, 0.98, 0.05, 0.03, M.trim); // 앞 테두리 — 선반 널의 접힌 앞단
      }
      // 기둥 — 앞뒤로 넷. 하나짜리로 두면 선반이 벽에 떠 있는 판 줄이 된다
      for (const s of [-0.47, 0.47]) {
        for (const v of [0.06, 0.58]) {
          wallBox(b, w, u + s, v, 1.12, 0.05, 2.24, 0.05, M.steelDark);
        }
        wallBox(b, w, u + s, 0.32, 0.015, 0.06, 0.03, 0.62, M.trim); // 바닥 받침
      }
      // 뒷면 **X 자 버팀** — 조립식 선반의 표식이다. 없으면 흔들리는 판이다
      for (const d of [-1, 1]) {
        const g = new THREE.BoxGeometry(1.32, 0.03, 0.02);
        g.rotateZ(d * 1.03);
        g.translate(0, 1.12, 0.06);
        wallPut(b, w, u, g, M.trim);
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

  // ── 가운데 바닥 — 선반을 벽 셋으로 줄이며 생긴 자리 (2026-08-06 지시) ──
  //
  // 창고는 선반만 있는 방이 아니다. **바닥에 쌓아 둔 것**과 그것을 나르는
  // 도구가 있어야 물류가 도는 방으로 읽힌다:
  //   팰릿(각목 받침) 위의 상자 더미 · 손수레 · 사다리.
  b.mark('furniture', `floorstock:${c.id}`);
  {
    const fx2 = (c.x0 + c.x1) / 2 + 0.6;
    const fz2 = (c.z0 + c.z1) / 2;
    // 팰릿 — 받침목 셋 + 상판 살. 상자를 바닥에 바로 두면 창고가 아니다
    for (const dz of [-0.5, 0, 0.5]) b.box(1.2, 0.09, 0.1, [fx2, 0.045, fz2 + dz], M.laminate, 0);
    for (let k = 0; k < 6; k++) {
      b.box(0.14, 0.025, 1.2, [fx2 - 0.5 + k * 0.2, 0.1, fz2], M.laminate, 0);
    }
    // 상자 더미 — 팰릿 위. 두 단으로 어긋나게 쌓는다
    const stack = [
      [-0.28, 0.115, -0.26, [0.5, 0.36, 0.46], 0.06],
      [0.26, 0.115, -0.24, [0.46, 0.32, 0.44], -0.14],
      [-0.24, 0.115, 0.28, [0.48, 0.4, 0.42], 0.22],
      [-0.02, 0.475, -0.2, [0.44, 0.28, 0.4], 0.4],
      [0.28, 0.435, 0.3, [0.4, 0.26, 0.38], -0.3],
    ];
    for (const [dx, y, dz, sz, yaw] of stack) {
      const pr = I.spawnPair('carton');
      carton(pr.closed, [fx2 + dx, y, fz2 + dz], sz, yaw, M);
      carton(pr.open, [fx2 + dx, y, fz2 + dz], sz, yaw, M, 'open');
      tally.carton = (tally.carton ?? 0) + 1;
    }
    // 손수레 — 바닥판 + 세로 틀 둘 + 가로대 + **바퀴 둘**. 기울여 세워 둔다
    {
      const hx4 = c.x0 + 1.0;
      const hz4 = fz2 - 1.5;
      const lean = 0.28;
      const put4 = (g, m) => {
        g.rotateX(lean);
        g.translate(hx4, 0, hz4);
        b.add(g, m);
      };
      for (const s of [-1, 1]) {
        const rail = new THREE.CylinderGeometry(0.022, 0.022, 1.24, 6);
        rail.translate(s * 0.22, 0.66, 0);
        put4(rail, M.trim);
      }
      for (const y of [0.34, 0.86, 1.24]) {
        const cr = new THREE.CylinderGeometry(0.018, 0.018, 0.44, 6);
        cr.rotateZ(Math.PI / 2);
        cr.translate(0, y, 0);
        put4(cr, M.trim);
      }
      const plate = new THREE.BoxGeometry(0.46, 0.03, 0.3);
      plate.translate(0, 0.06, 0.14);
      put4(plate, M.steelDark); // 바닥판
      for (const s of [-1, 1]) {
        const wh = new THREE.CylinderGeometry(0.11, 0.11, 0.05, 10);
        wh.rotateZ(Math.PI / 2);
        wh.translate(s * 0.26, 0.11, -0.02);
        put4(wh, M.rubber);
      }
      tally.handcart = (tally.handcart ?? 0) + 1;
    }
    // 접이 사다리 — 벽에 기대 세운 것. 다리 넷 + 발판 넷
    {
      const lx4 = c.x1 - 0.7;
      const lz4 = fz2 + 1.7;
      const put5 = (g, m) => {
        g.rotateZ(0.16);
        g.translate(lx4, 0, lz4);
        b.add(g, m);
      };
      for (const s of [-1, 1]) {
        const sr = new THREE.CylinderGeometry(0.022, 0.022, 1.8, 6);
        sr.translate(0, 0.9, s * 0.17);
        put5(sr, M.trim);
      }
      for (let k = 0; k < 4; k++) {
        const st2 = new THREE.BoxGeometry(0.08, 0.02, 0.34);
        st2.translate(0, 0.28 + k * 0.42, 0);
        put5(st2, M.trim);
      }
      tally.ladder = (tally.ladder ?? 0) + 1;
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

  // 함체 — **판 다섯**(등·옆 둘·천·밑)이다. 통짜 상자로 두면 열림 포즈의
  // 차단기가 통째로 그 속에 묻힌다 — 사물함·냉장고·TV장에서 세 번 고친 것과
  // 같은 병이고, 배전반이 마지막이었다 (2026-08-06 디테일 패스).
  box(u, 0.025, cy, WID, HT, 0.05, M.steelDark); // 등판
  for (const s of [-1, 1]) box(u + s * (WID / 2 - 0.02), DEP / 2, cy, 0.04, HT, DEP, M.steelDark); // 옆판
  box(u, DEP / 2, cy + HT / 2 - 0.02, WID, 0.04, DEP, M.steelDark); // 천판
  box(u, DEP / 2, cy - HT / 2 + 0.02, WID, 0.04, DEP, M.steelDark); // 밑판

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
  // ── 속 — 문이 열려야 보이는 것 (status.md 5.0 B 의 '배전반 차단기') ────
  //
  // 어두운 판에 회색 띠 셋이면 **선반**이지 배전반이 아니다. 차단기를
  // 차단기로 만드는 것: DIN 레일 · 그 위에 **낱개로 꽂힌 모듈** · 모듈마다
  // 튀어나온 **토글 레버**(내려간 것과 올라간 것이 섞여야 "누가 만졌다") ·
  // 회로 번호 라벨 · 아래로 빠지는 전선 다발 · 중성/접지 단자대.
  box(u, 0.07, cy, WID - 0.1, HT - 0.1, 0.02, M.rubber); // 안쪽 패널 (등판 앞)
  const putP = (g, m) => wallPut(b, w, u, g, m);
  for (let i = 0; i < 3; i++) {
    const ry = cy - 0.18 - i * 0.24;
    box(u, 0.105, ry, WID - 0.28, 0.035, 0.03, M.steel); // DIN 레일
    for (let k = 0; k < 8; k++) {
      const du = -0.24 + k * 0.069;
      const r = hash2(i * 7 + k, Math.round(u * 11));
      box(u + du, 0.145, ry + 0.035, 0.058, 0.095, 0.05, M.paper); // 모듈 몸통
      // 토글 레버 — 절반쯤 내려가 있다. 각도가 섞여야 손댄 반이다
      const lev = new THREE.BoxGeometry(0.03, 0.035, 0.018);
      lev.rotateX(r > 0.45 ? 0.5 : -0.5);
      lev.translate(du, ry + 0.045, 0.182);
      putP(lev, r > 0.45 ? M.rubber : M.vend);
      if (k % 2 === 0) box(u + du, 0.175, ry - 0.02, 0.055, 0.018, 0.006, M.trim); // 회로 번호
    }
  }
  // 전선 다발 — 레일 옆을 타고 아래로 내려간다 (관 셋, 굵기가 다르다)
  for (const [du, r, m] of [[-0.3, 0.014, M.rubber], [-0.27, 0.01, M.vend], [0.3, 0.012, M.warn]]) {
    const g = new THREE.CylinderGeometry(r, r, HT - 0.34, 5);
    g.translate(du, cy - 0.1, 0.1);
    putP(g, m);
  }
  // 단자대 — 맨 아래 가로 블록 + 나사 줄
  box(u, 0.115, cy - 0.62, WID - 0.24, 0.07, 0.045, M.trim);
  for (let k = 0; k < 9; k++) {
    box(u - 0.26 + k * 0.065, 0.145, cy - 0.62, 0.03, 0.03, 0.008, M.steelDark);
  }

  // 문 두 짝 — 경첩축(양 모서리)으로 벌어진다. 왼짝이 더 열려 "누가 열었다".
  //
  // **앞면 디테일은 문의 것이다.** 루버·딱지·명판·계기·표시등·손잡이를 문짝
  // 로컬에서 지어 문과 함께 돌린다 — 처음에 문짝을 민판으로 뒀더니 열자마자
  // 앞면이 통째로 사라진 것처럼 보였다. 닫힘과 같은 조각·같은 자리이고,
  // 닫힘의 (du, v) 를 문짝 로컬로 옮기는 식은 x = du − 경첩, z = v − DEP 다.
  const lw = (WID - 0.04) / 2;
  const hingeU = (side) => -side * (WID / 2 - 0.02);
  // 젖힘 각 — 0.62 / 0.26 은 "살짝 열림" 이라 **속이 하나도 안 보였다.**
  // 차단기를 낱개로 채우고 나서야 드러난 문제다 (2026-08-06 디테일 패스):
  // 속을 만들었으면 속이 보이는 각으로 열어야 한다. 두 짝의 각이 다른 것은
  // 그대로 둔다 — 누가 급히 열어젖힌 흔적이다.
  for (const [side, swing] of [
    [1, 1.25],
    [-1, 0.6],
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
    // 카운터 길이 — 상한 3.2 에 걸려 볼이 둘뿐이었다 (status.md 5.0 A 의
    // 마지막 줄). 벽이 5.8m 인 방인데 카운터가 절반만 쓰고 볼 사이가 1.3m 로
    // 벌어져 있었다 — **벽이 주는 만큼 쓴다.** 상한을 4.2 로 올려 셋이 선다
    // (fit 0.95 간격이 층 인원에 맞는 밀도다).
    const cl = Math.min(v.b - v.a - 0.4, 4.2);
    const cm = (v.a + v.b) / 2;
    wallBox(b, v, cm, 0.3, 0.82, cl, 0.06, 0.6, M.laminate); // 상판
    wallBox(b, v, cm, 0.29, 0.41, cl - 0.2, 0.76, 0.55, M.trim); // 하부장
    // 세면볼 — **속이 파인 도기 사발**. 위가 넓은 원뿔대 하나로는 엎어 놓은
    // 접시다 (2026-08-06 지적: 물이 고일 홈이 없다). 불리언이 없으므로
    // **테보다 낮은 어두운 바닥면**으로 오목함을 낸다:
    //   바깥 사발 · 테 링 · 그보다 낮은 안쪽 경사면 · 제일 낮은 바닥 · 배수구.
    // 크기도 키웠다 (반지름 0.18 -> 0.24) — 손을 씻는 물건이다.
    for (const t of fit(0, cl, 1.05, 0.35)) {
      const u = cm - cl / 2 + t;
      const put = (g, m) => wallPut(b, v, u, g, m);
      const disc = (r, h, y, m, seg = 14) => {
        const g = new THREE.CylinderGeometry(r, r, h, seg);
        g.translate(0, y, 0.33);
        put(g, m);
      };
      const bowl = new THREE.CylinderGeometry(0.24, 0.15, 0.17, 14);
      bowl.translate(0, 0.79, 0.33);
      put(bowl, M.porcelain); // 바깥 사발 — 윗면 0.875
      const rim = new THREE.TorusGeometry(0.235, 0.018, 6, 14);
      rim.rotateX(Math.PI / 2);
      rim.translate(0, 0.873, 0.33);
      put(rim, M.porcelain); // 테
      // 속 — 테보다 3cm 낮은 경사면과 그보다 더 낮은 바닥. 눈높이에서
      // 이 단차가 "물이 고이는 홈" 으로 읽힌다
      const inner = new THREE.CylinderGeometry(0.215, 0.11, 0.06, 14);
      inner.translate(0, 0.842, 0.33);
      put(inner, M.rubber);
      disc(0.105, 0.012, 0.816, M.porcelain); // 바닥
      disc(0.032, 0.008, 0.824, M.steelDark, 10); // 배수구
      disc(0.018, 0.01, 0.827, M.rubber, 8);
      // 넘침 구멍 — 앞쪽 테 아래의 작은 홈. 세면대의 표식이다
      wallBox(b, v, u, 0.55, 0.845, 0.05, 0.022, 0.012, M.steelDark);
      // 수전 — 기둥 + 반원 구즈넥 + 토출구 + **손잡이 둘**(냉·온).
      // 손잡이가 없으면 물이 안 나오는 관이다
      const riser = new THREE.CylinderGeometry(0.017, 0.02, 0.14, 8);
      riser.translate(0, 0.925, 0.13);
      put(riser, M.trim);
      const arc = new THREE.TorusGeometry(0.085, 0.013, 6, 12, Math.PI);
      arc.rotateY(Math.PI / 2);
      arc.translate(0, 0.995, 0.215);
      put(arc, M.trim);
      const tip = new THREE.CylinderGeometry(0.011, 0.011, 0.045, 8);
      tip.translate(0, 0.975, 0.3);
      put(tip, M.trim);
      const aer = new THREE.CylinderGeometry(0.015, 0.013, 0.016, 8);
      aer.translate(0, 0.95, 0.3);
      put(aer, M.steelDark); // 토출구 망
      for (const s of [-1, 1]) {
        const kn = new THREE.CylinderGeometry(0.022, 0.028, 0.035, 8);
        kn.translate(s * 0.13, 0.9, 0.14);
        put(kn, M.trim);
        const lv = new THREE.BoxGeometry(0.075, 0.016, 0.022);
        lv.rotateY(s * 0.5);
        lv.translate(s * 0.155, 0.915, 0.14);
        put(lv, M.trim); // 레버
      }
      tally.basin = (tally.basin ?? 0) + 1;
    }
    // 거울 — 어두운 강판(알베도 0.13)으로 뒀더니 **검은 널판**이었다
    // (2026-08-06 지적). 매끈한 밝은 금속면(M.mirror)에 테를 두른다 —
    // 진짜 반사는 없지만 환경맵이 실리고 테가 "붙인 거울" 로 만든다.
    // 폭은 **핸드타올 곽 자리를 남기고** 잡는다 — cl-0.3 으로 두었더니 거울이
    // 카운터 끝까지 닿아 곽이 거울 앞에 겹쳐 섰다 (2026-08-06)
    const MW = cl - 1.1;
    wallBox(b, v, cm - 0.25, 0.035, 1.52, MW + 0.06, 0.76, 0.02, M.trim); // 테
    wallBox(b, v, cm - 0.25, 0.05, 1.52, MW, 0.7, 0.014, M.mirror);
    wallBox(b, v, cm - 0.25, 0.06, 1.15, MW, 0.03, 0.03, M.trim); // 아래 받침턱
    // 잔소품 — 카운터 끝의 비누 디스펜서(원통 몸 + 펌프 목 + 노즐)와
    // 벽에 붙은 페이퍼타월함. 세면대만 있으면 "설비" 지 사람이 쓰던 곳이
    // 아니다 (챕터 0 디테일 패스).
    {
      // 핸드워시 — 통 하나에 관 둘이면 분무기다. **어깨·목·펌프 머리·누르는
      // 대·라벨**이 있어야 손세정제 통이다 (2026-08-06 지적)
      const su = cm - cl / 2 + 0.26;
      const put = (g, m) => wallPut(b, v, su, g, m);
      const cyl2 = (r0, r1, h, y, m, seg = 10) => {
        const g = new THREE.CylinderGeometry(r0, r1, h, seg);
        g.translate(0, y, 0.22);
        put(g, m);
      };
      cyl2(0.042, 0.048, 0.16, 0.935, M.plasticWarm); // 몸통
      cyl2(0.022, 0.042, 0.045, 1.037, M.plasticWarm); // 어깨 — 좁아지는 원뿔대
      cyl2(0.014, 0.014, 0.03, 1.073, M.trim); // 목
      cyl2(0.026, 0.026, 0.022, 1.098, M.trim); // 펌프 머리 (누르는 대)
      {
        const noz = new THREE.CylinderGeometry(0.008, 0.008, 0.06, 6);
        noz.rotateX(Math.PI / 2);
        noz.translate(0, 1.096, 0.255);
        put(noz, M.trim);
        const dn = new THREE.CylinderGeometry(0.007, 0.01, 0.018, 6);
        dn.translate(0, 1.078, 0.285);
        put(dn, M.trim); // 아래를 보는 토출구
      }
      wallBox(b, v, su, 0.268, 0.935, 0.07, 0.075, 0.006, M.paper); // 라벨
      tally.soap = (tally.soap ?? 0) + 1;
      // ── 페이퍼타월함 — **오른쪽 끝으로** (2026-08-06 지시. 핸드워시와
      // 자리를 맞바꿨다: 씻고 → 닦는 순서가 왼쪽에서 오른쪽으로 흐른다).
      // 민짜 상자였던 것을 함으로: 뒷판 · 여닫는 앞뚜껑(경첩으로 살짝 기울고)
      // · 손잡이 홈 · 아래 배출구 · 삐져나온 종이 두 장 · 잠금.
      const pu = cm + cl / 2 - 0.24;
      wallBox(b, v, pu, 0.075, 1.34, 0.3, 0.4, 0.12, M.steelDark); // 뒷칸
      {
        const lid = new THREE.BoxGeometry(0.29, 0.39, 0.03);
        lid.translate(0, 0, 0.015);
        lid.rotateX(0.07); // 아래가 살짝 벌어진다
        lid.translate(0, 1.34, 0.148);
        wallPut(b, v, pu, lid, M.steel);
      }
      wallBox(b, v, pu, 0.17, 1.5, 0.16, 0.022, 0.02, M.trim); // 손잡이 홈
      wallBox(b, v, pu, 0.155, 1.15, 0.22, 0.028, 0.03, M.steelDark); // 배출구 턱
      wallBox(b, v, pu, 0.15, 1.125, 0.19, 0.05, 0.012, M.paper); // 나온 종이
      wallBox(b, v, pu + 0.03, 0.155, 1.1, 0.13, 0.045, 0.01, M.paper); // 한 장 더 (어긋나게)
      {
        const lk = new THREE.CylinderGeometry(0.012, 0.012, 0.016, 8);
        lk.rotateX(Math.PI / 2);
        const [lx2, , lz2] = wallAt(v, pu, 0.165, 0);
        lk.translate(lx2, 1.34, lz2);
        b.add(lk, M.trim); // 잠금
      }
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
  //
  // **떼어낸 것(lean)은 성한 것이 아니다** (status.md 5.0 B 의 '찌그러짐').
  // 벽에서 뜯긴 그릴은 날 몇 장이 눕고 모서리가 접힌다 — 성한 판을 옆에
  // 세워 두면 "떼어냈다" 가 아니라 "여분을 놔뒀다" 로 읽힌다.
  const bent = mode === 'lean';
  const n = Math.round((H - 0.17) / 0.078);
  for (let i = 0; i < n; i++) {
    const g = new THREE.BoxGeometry(W - 0.12, 0.055, 0.012);
    // 뜯긴 판은 날 몇 장이 제 각도를 잃는다 (아래에서 셋째·다섯째)
    g.rotateX(bent && (i === 2 || i === 4) ? (i === 2 ? 1.05 : -0.15) : 0.45);
    if (bent && i === 6) g.rotateZ(0.12);
    g.translate(0, 0.099 + i * 0.078, 0);
    put(g, M.crt);
  }
  // 귀퉁이 나사 넷 — 걸려 있던 그릴 마감 (status.md 5.2 의 '그릴 나사').
  // 뜯긴 판에서는 둘이 빠져 나사 구멍만 남는다
  const holes = bent ? [0, 3] : [];
  [
    [-W / 2 + 0.032, 0.032],
    [W / 2 - 0.032, 0.032],
    [-W / 2 + 0.032, H - 0.032],
    [W / 2 - 0.032, H - 0.032],
  ].forEach(([sx, sy], i) => {
    const miss = holes.includes(i);
    const g = new THREE.CylinderGeometry(miss ? 0.009 : 0.015, miss ? 0.009 : 0.015, miss ? 0.03 : 0.014, 6);
    g.rotateX(Math.PI / 2);
    g.translate(sx, sy, miss ? 0.0 : -0.02);
    put(g, miss ? M.rubber : M.trim); // 빠진 자리는 어두운 구멍
  });
  if (bent) {
    // 접힌 모서리 — 판 한 귀퉁이가 바깥으로 꺾였다
    const cr = new THREE.BoxGeometry(0.16, 0.1, 0.016);
    cr.rotateZ(-0.5);
    cr.rotateY(0.4);
    cr.translate(W / 2 - 0.05, H - 0.09, 0.03);
    put(cr, M.crt);
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
    // 방 채우기 2차 (2026-08-06, status.md 5.0 A) — 서버실·관제실·엘베 홀·
    // 계단실·기계실·플라자·복도. 종류마다 하한을 달면 경보가 스무 줄이 된다
    'cableTray', 'cart', 'printer', 'binderShelf', 'keybox', 'radioDock',
    'directory', 'ashtray', 'planter', 'floorMark', 'emergPanel', 'workbench',
    'toolWall', 'pipeLabel', 'warnSign', 'noticeBoard', 'payphone', 'cooler',
    'floorPlan',
    // 가전·비품 (2026-08-06 사용자 지시) — 에어컨 · 휴게실 TV · 사무실
    // 비품 서랍장 · 복합기
    'airCon', 'tv', 'supplyCab', 'copier',
    // 재실사 17건 (2026-08-06) — 케이크 전시대 · 조리 아일랜드 · 창고 바닥
    'cakeCase', 'island', 'handcart', 'ladder',
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
