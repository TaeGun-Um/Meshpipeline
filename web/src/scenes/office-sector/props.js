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
import { CELLS, H, W, interiorWalls, onWall, wallRuns, openingsOf } from './layout.js';

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
  const tube = (r0, r1, len, lx, ly, lz, m, tilt = 0, lay = null) => {
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
    tube(0.032, 0.032, 0.35, 0, 0.235, 0, M.trim);
    tube(0.046, 0.046, 0.13, 0, 0.13, 0, M.steelDark);
    tube(0.02, 0.02, 0.24, 0, 0.6, -0.15, M.trim, TILT);
    return;
  }

  // 식당 의자 — 관 네 다리에 옆 가로대. 겹쳐 쌓는 그 의자다.
  for (const dx of [-0.185, 0.185]) {
    for (const dz of [-0.165, 0.165]) tube(0.014, 0.014, 0.46, dx, 0.23, dz, M.trim);
    tube(0.011, 0.011, 0.33, dx, 0.13, 0, M.trim, 0, 'z');
    tube(0.014, 0.014, 0.34, dx * 0.92, 0.6, -0.175, M.trim, TILT);
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

  // 베젤과 화면. 화면은 베젤 **안쪽으로 들어간다** — 같은 평면에 두면
  // 스티커를 붙인 것으로 보인다.
  const fz = z - f * 0.03 + f * 0.15; // 몸통 앞면
  b.box(0.38, 0.34, 0.02, [x, cy, fz], M.crtDark, 0);
  b.box(0.3, 0.235, 0.012, [x, cy + 0.028, fz + f * 0.004], M.screen, 0);
  // 아래 조작부 — 버튼 넷과 전원 표시등
  for (const dx of [-0.09, -0.05, -0.01, 0.03]) {
    b.box(0.022, 0.012, 0.008, [x + dx, cy - 0.135, fz + f * 0.012], M.crt, 0);
  }
  b.box(0.014, 0.01, 0.008, [x + 0.13, cy - 0.135, fz + f * 0.012], M.led, 0);

  // ── 자판 ─────────────────────────────────────────────────────────────
  //
  // 자판은 **줄이 보여야** 자판이다. 키를 하나씩 내면 책상 34개에 2천 개가
  // 넘으므로, 줄을 세 토막으로 끊어 낸다 — 눈높이에서는 그것으로 읽힌다.
  const kz = z + f * 0.24;
  b.box(0.44, 0.016, 0.17, [x, y + 0.008, kz], M.crt, 0); // 몸체
  b.box(0.44, 0.022, 0.03, [x, y + 0.019, kz - f * 0.07], M.crt, 0); // 뒤가 높다
  for (let r = 0; r < 5; r++) {
    const rz = kz - f * (0.048 - r * 0.026);
    const ry = y + 0.021 + (4 - r) * 0.0022;
    // 좌·중·우 세 토막. 줄마다 폭이 달라야 자판처럼 어긋나 보인다.
    const segs = [
      [-0.145, 0.1],
      [-0.03, 0.1],
      [0.085, 0.09 + (r % 2) * 0.02],
    ];
    for (const [dx, sw] of segs) {
      b.box(sw, 0.008, 0.019, [x + dx, ry, rz], M.keycap, 0);
    }
  }
  b.box(0.16, 0.008, 0.019, [x - 0.02, y + 0.021, kz + f * 0.056], M.keycap, 0); // 스페이스
  b.box(0.075, 0.008, 0.07, [x + 0.16, y + 0.024, kz - f * 0.01], M.keycap, 0); // 숫자판

  // 마우스와 패드
  b.box(0.11, 0.006, 0.13, [x + 0.31, y + 0.003, kz], M.crtDark, 0);
  b.box(0.055, 0.028, 0.095, [x + 0.31, y + 0.02, kz], M.crt, 0);
}

// ── 천장 설비 ──────────────────────────────────────────────────────────────
//
// 복도 천장 위에는 덕트와 케이블 트레이가 지나간다. 마감 천장에 가려 안 보이지만
// **스프링클러와 점검구는 뚫고 내려온다** — 그게 지하 시설의 표식이다.
function services(b, c, M, tally) {
  const long = c.z1 - c.z0 > c.x1 - c.x0;
  const lo = long ? c.z0 : c.x0;
  const hi = long ? c.z1 : c.x1;
  const mid = long ? (c.x0 + c.x1) / 2 : (c.z0 + c.z1) / 2;

  // 스프링클러 — 3.0m 격자 (실제 규정도 이 근처다)
  b.mark('service', `sprinkler:${c.id}`);
  for (const x of fit(c.x0, c.x1, 3.0, 0.5)) {
    for (const z of fit(c.z0, c.z1, 3.0, 0.5)) {
      b.cylinder(0.012, 0.012, 0.09, [x, c.h - 0.045, z], M.trim, 5);
      b.sphere(0.028, [x, c.h - 0.1, z], M.steel, 5, 3);
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
    }
    // 행어
    for (const t of fit(lo, hi, 3.6, 1.0)) {
      for (const off of [-1.85, 1.95]) {
        const at = long ? [mid + off, c.h - 0.28, t] : [t, c.h - 0.28, mid + off];
        b.box(0.05, 0.5, 0.05, at, M.trim, 0);
      }
    }
    b.endMark();
    return;
  }

  // 복도 천장 아래로 내려온 덕트 — 낮은 천장에 굵은 관이 지나가면 지하답다
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

function cafeteria(b, c, M, tally) {
  // 식탁 — 4인 원탁이 아니라 긴 테이블. 급식 시설은 대개 그렇다.
  b.mark('furniture', `tables:${c.id}`);
  for (const x of fit(c.x0, c.x1, 3.1, 1.6)) {
    for (const z of fit(c.z0, c.z1, 2.6, 1.6)) {
      b.box(2.0, 0.06, 0.8, [x, 0.74, z], M.laminate, 0);
      for (const dx of [-0.85, 0.85]) {
        for (const dz of [-0.32, 0.32]) b.box(0.05, 0.72, 0.05, [x + dx, 0.37, z + dz], M.trim, 0);
      }
      // 의자 — 양쪽에 둘씩. **식탁을 바라보게** 돌린다.
      // face 는 앉은 사람이 보는 방향이므로 -z 쪽 의자는 +z 를 본다.
      for (const dz of [-0.66, 0.66]) {
        for (const dx of [-0.5, 0.5]) {
          chair(b, [x + dx, 0, z + dz], dz < 0 ? 0 : Math.PI, M, M.plastic);
        }
      }
      tally.table = (tally.table ?? 0) + 1;
    }
  }
  b.endMark();

  // 자판기 — 제일 긴 벽에 줄지어. 게임에서도 카페테리아의 표식이다.
  const walls = interiorWalls(c.id).sort((p, q) => q.b - q.a - (p.b - p.a));
  const w = walls[0];
  if (w) {
    b.mark('furniture', `vending:${c.id}`);
    const len = w.b - w.a;
    const SPEC = [
      [1.0, 1.92, M.vend],
      [0.96, 1.84, M.vendBlue],
      [1.0, 1.97, M.vend],
      [0.96, 1.87, M.vendBlue],
    ];
    fit(0, len, 1.55, 1.4)
      .slice(0, 4)
      .forEach((v, i) => vendor(b, w, w.a + v, SPEC[i % 4], i, M));
    tally.vending = (tally.vending ?? 0) + 4;
    b.endMark();
  }
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
function vendor(b, w, u, spec, idx, M) {
  const [WID, HT, BODY] = spec;
  const DEP = 0.8;
  const F = DEP; // 앞면
  const box = (du, v, y, wid, h, th, m) => wallBox(b, w, u + du, v, y, wid, h, th, m);

  box(0, DEP / 2, 0.05, WID - 0.08, 0.1, DEP - 0.06, M.steelDark); // 굽
  box(0, DEP / 2, 0.1 + (HT - 0.1) / 2, WID, HT - 0.1, DEP, BODY); // 본체

  // 간판 — 위쪽 1/5. 밝은 띠가 있어야 자판기로 읽힌다
  box(0, F + 0.012, HT - 0.22, WID - 0.06, 0.34, 0.024, M.paper);
  box(0, F + 0.026, HT - 0.22, WID - 0.16, 0.14, 0.01, idx % 2 ? M.vendBlue : M.vend);

  // ── 진열창 ───────────────────────────────────────────────────────────
  const gW = WID - 0.4;
  const gY = 1.06;
  const gH = 0.86;
  box(-0.09, F + 0.006, gY, gW + 0.05, gH + 0.05, 0.012, M.rubber); // 창틀
  // 상품 — 네 단, 단마다 다섯 줄. 유리 뒤로 들어가 있다
  const PAL = [M.vend, M.vendBlue, M.plastic, M.plasticWarm, M.warn, M.crate];
  for (let s = 0; s < 4; s++) {
    const sy = gY - gH / 2 + 0.13 + s * 0.21;
    box(-0.09, F - 0.07, sy - 0.075, gW, 0.014, 0.14, M.steelDark); // 선반
    for (let k = 0; k < 5; k++) {
      const r = hash2(idx * 17 + s * 5 + k, u * 3 + s);
      if (r < 0.12) continue; // 다 팔린 줄
      const m = PAL[Math.floor(r * PAL.length) % PAL.length];
      box(-0.09 - gW / 2 + 0.06 + k * (gW - 0.12) / 4, F - 0.07, sy + 0.02,
        0.055, 0.13 + r * 0.03, 0.05, m);
    }
  }
  // 유리 — 상품 앞에. 마지막에 놓아야 투명 정렬이 맞다
  box(-0.09, F + 0.014, gY, gW, gH, 0.01, M.glass);

  // ── 선택부 ───────────────────────────────────────────────────────────
  const px = WID / 2 - 0.16;
  box(px, F + 0.012, 1.18, 0.26, 1.0, 0.024, M.steelDark); // 조작 판
  box(px, F + 0.03, 1.58, 0.2, 0.1, 0.01, M.screen); // 표시창
  for (let r = 0; r < 4; r++) {
    for (let k = 0; k < 2; k++) {
      box(px - 0.05 + k * 0.1, F + 0.03, 1.42 - r * 0.09, 0.06, 0.055, 0.014, M.trim);
    }
  }
  box(px + 0.05, F + 0.03, 1.03, 0.02, 0.075, 0.014, M.rubber); // 동전 투입구
  box(px - 0.05, F + 0.03, 1.0, 0.11, 0.026, 0.014, M.rubber); // 지폐 투입구
  box(px, F + 0.028, 0.88, 0.14, 0.06, 0.012, M.trim); // 반환구

  // ── 배출구 ───────────────────────────────────────────────────────────
  // **안으로 들어가야** 구멍으로 보인다. 같은 평면에 검은 판을 붙이면 스티커다.
  box(-0.06, F - 0.1, 0.42, WID - 0.34, 0.3, 0.16, M.rubber);
  box(-0.06, F - 0.02, 0.5, WID - 0.34, 0.2, 0.02, M.trim); // 여닫이 뚜껑
  box(-0.06, F + 0.008, 0.28, WID - 0.3, 0.14, 0.016, M.steelDark); // 발판
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
function serverRack(b, u, v, ax, face, M, seed) {
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
  // "잠긴 문" 으로 보인다.
  const dz = D_ / 2 + 0.01;
  box(0, dz, HT / 2, W_ - 0.03, HT - 0.1, 0.012, M.meshDoor);
  for (const s of [-1, 1]) box((s * (W_ - 0.05)) / 2, dz + 0.008, HT / 2, 0.035, HT - 0.1, 0.02, M.rack);
  for (const s of [-1, 1]) box(0, dz + 0.008, HT / 2 + (s * (HT - 0.1)) / 2, W_ - 0.03, 0.035, 0.02, M.rack);
  box(W_ / 2 - 0.07, dz + 0.035, HT / 2, 0.022, 0.26, 0.022, M.trim); // 손잡이
  box(W_ / 2 - 0.07, dz + 0.022, HT / 2 - 0.2, 0.05, 0.05, 0.016, M.trim); // 잠금
  // 랙 번호 — 종이(알베도 0.7)로 뒀더니 어두운 랙 위에서 흰 판때기로 튀었다
  box(-W_ / 2 + 0.13, dz + 0.02, HT - 0.13, 0.1, 0.036, 0.008, M.trim);
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
  // 드레인
  const dr = wallAt(w, u + WID / 2 - 0.1, 0.1, HT / 2);
  tube(b, 0.022, HT, dr, M.trim, 'y', 6);
}

function serverRoom(b, c, M, tally) {
  // 랙 열 — 통로 폭 1.2m 를 남긴다
  b.mark('furniture', `racks:${c.id}`);
  const along = c.x1 - c.x0 > c.z1 - c.z0;
  const ax = along ? 'x' : 'z';
  const rows = fit(along ? c.z0 : c.x0, along ? c.z1 : c.x1, 2.2, 1.4);
  let n = 0;
  rows.forEach((r, ri) => {
    // **열이 번갈아 돈다.** 실제 데이터센터의 콜드/핫 아일 배치다 — 앞면끼리
    // 마주 본 통로로 찬 바람이 들어가고, 뒷면끼리 마주 본 통로로 더운 바람이
    // 나간다. 전부 같은 방향을 보게 하면 앞 열의 배기를 뒤 열이 빨아들인다.
    const face = ri % 2 === 0 ? 1 : -1;
    for (const t of fit(along ? c.x0 : c.z0, along ? c.x1 : c.z1, 0.62, 1.6)) {
      serverRack(b, t, r, ax, face, M, ++n);
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
      crac(b, w, w.a + t, c.h, M);
      tally.crac = (tally.crac ?? 0) + 1;
    }
  }
  // 통로 위 급기 덕트 — 찬 바람이 랙 앞으로 떨어진다
  const lo = along ? c.x0 : c.z0;
  const hi = along ? c.x1 : c.z1;
  for (const r of rows) {
    const y = c.h - 0.3;
    const A = lo + 0.4;
    const B = hi - 0.4;
    const at = (t) => (along ? [t, y, r] : [r, y, t]);
    const s = (l, hh, cr) => (along ? [l, hh, cr] : [cr, hh, l]);
    b.box(...s(B - A, 0.26, 0.34), at((A + B) / 2), M.steel, 1.2);
    for (const t of fit(A, B, 2.0, 0.6)) {
      b.box(...s(0.26, 0.08, 0.26), at(t), M.steel, 0);
      b.box(...s(0.22, 0.02, 0.22), [at(t)[0], y - 0.18, at(t)[2]], M.rubber, 0);
    }
  }
  b.endMark();
}

function plaza(b, c, M, tally) {
  const cx = (c.x0 + c.x1) / 2;
  const cz = (c.z0 + c.z1) / 2;

  // 안내 기둥 — 이 층의 목적지에 방향이 적혀 있어야 한다
  b.mark('landmark', 'plaza:pylon');
  b.box(0.9, 0.12, 0.9, [cx, 0.06, cz], M.steelDark, 0);
  b.box(0.34, 3.0, 0.34, [cx, 1.5, cz], M.steel, 1.0);
  for (const [y, s] of [[2.55, 0], [2.2, 1], [1.85, 2]]) {
    for (const d of [-1, 1]) {
      b.box(1.3, 0.24, 0.04, [cx + d * 0.82, y, cz], M.paper, 0);
      b.box(0.9, 0.1, 0.02, [cx + d * 0.82, y, cz + 0.03], s % 2 ? M.exit : M.screen, 0);
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
    b.box(rot ? 0.52 : 2.0, 0.08, rot ? 2.0 : 0.52, [x, 0.44, z], M.laminate, 0);
    for (const s of [-0.8, 0.8]) {
      b.box(0.4, 0.4, 0.4, [x + (rot ? 0 : s), 0.2, z + (rot ? s : 0)], M.trim, 0);
    }
    tally.bench = (tally.bench ?? 0) + 1;
  }
  b.endMark();

  // 바닥 표시 — 트램 승강 위치. 넓은 바닥이 통째로 비면 방향이 안 읽힌다.
  b.mark('paint', 'plaza:markings');
  for (const dz of [-5.4, 5.4]) {
    b.box(11.0, 0.012, 0.14, [cx, 0.006, cz + dz], M.ledAmber, 0);
    for (const t of fit(cx - 5, cx + 5, 2.2)) {
      b.box(0.5, 0.012, 0.5, [t, 0.006, cz + dz + Math.sign(dz) * 0.5], M.paper, 0);
    }
  }
  b.endMark();
}

function office(b, c, M, tally) {
  b.mark('furniture', `desks:${c.id}`);
  for (const x of fit(c.x0, c.x1, 2.6, 1.5)) {
    for (const z of fit(c.z0, c.z1, 2.2, 1.5)) {
      b.box(1.6, 0.05, 0.75, [x, 0.73, z], M.laminate, 0);
      // **서랍장 한 쪽, 관 다리 한 쪽.** 예전에는 양옆이 0.7m 짜리 통판이라
      // 책상 밑이 검은 판때기 둘로 막혀 있었고, 그게 사무실에서 제일 먼저
      // 눈에 걸리는 덩어리였다. 실제 사무 책상은 한쪽만 막혀 있다.
      // 서랍장은 **상판과 같은 라미네이트**다. 어두운 강판으로 뒀더니 알베도가
      // 0.13 이라 책상마다 검은 구멍이 하나씩 뚫린 것처럼 보였다.
      b.box(0.44, 0.64, 0.68, [x - 0.55, 0.32, z], M.laminate, 0);
      for (const dy of [0.16, 0.38, 0.56]) {
        b.box(0.38, 0.16, 0.02, [x - 0.55, dy, z + 0.35], M.trim, 0);
        b.box(0.14, 0.02, 0.02, [x - 0.55, dy + 0.05, z + 0.37], M.steel, 0);
      }
      for (const dz of [-0.28, 0.28]) {
        b.cylinder(0.022, 0.022, 0.71, [x + 0.68, 0.355, z + dz], M.trim, 6);
      }
      // 뒷 가림판 — 얕게, 뒤로 물려서. 무릎 공간을 안 먹는다
      b.box(1.02, 0.32, 0.03, [x + 0.22, 0.52, z - 0.31], M.trim, 0);
      // 브라운관과 자판 — 90년대 후반이다. 사람은 +z 쪽에 앉는다.
      terminal(b, x, 0.755, z - 0.14, 1, M);
      // 의자 — 책상을 본다 (-z 쪽에 상판이 있으므로 face = π)
      chair(b, [x, 0, z + 0.78], Math.PI, M, M.plasticWarm, true);
      tally.desk = (tally.desk ?? 0) + 1;
    }
  }
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
function carton(b, at, size, yaw, M) {
  const [w, h, d] = size;
  const [x, y, z] = at;
  const c = Math.cos(yaw);
  const s = Math.sin(yaw);
  // 로컬 (dx,dz) -> 세계. g.rotateY 와 같은 변환이어야 한다.
  const p = (dx, dy, dz) => [x + dx * c + dz * s, y + dy, z - dx * s + dz * c];

  boxAt(b, w, h, d, p(0, h / 2, 0), M.carton, yaw);
  // 뚜껑 접힌 자리 (길이 방향) 와 그 위를 가로지르는 테이프
  boxAt(b, w * 0.99, 0.008, 0.014, p(0, h + 0.001, 0), M.cartonDark, yaw);
  boxAt(b, w * 0.26, 0.005, d * 1.004, p(0, h + 0.004, 0), M.paper, yaw);
  // 라벨 — 앞면에 붙는다
  boxAt(b, w * 0.4, h * 0.3, 0.006, p(0, h * 0.55, d / 2 + 0.003), M.paper, yaw);
}

function storage(b, c, M, tally) {
  // 선반 — 벽을 따라. 통로는 비운다
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
          // 벽 방향에 맞춰 상자의 긴 변을 돌린다
          const base = w.axis === 'x' ? 0 : Math.PI / 2;

          if (r > 0.82) {
            // 플라스틱 상자 — 테두리가 있어 골판지와 실루엣이 다르다
            const [bw, bh, bd] = [0.4, 0.26, 0.34];
            boxAt(b, bw, bh, bd, [px, y + bh / 2, pz], M.crate, base + yaw);
            boxAt(b, bw + 0.03, 0.035, bd + 0.03, [px, y + bh, pz], M.crate, base + yaw);
          } else {
            const h = 0.22 + r * 0.2;
            carton(b, [px, y, pz], [0.3 + r * 0.2, h, 0.3 + (1 - r) * 0.14], base + yaw, M);
            // 위에 하나 더 얹힌 것도 있다
            if (r > 0.6 && h < 0.3) {
              carton(b, [px, y + h + 0.005, pz], [0.26, 0.18, 0.28], base - yaw * 1.6, M);
            }
          }
        }
      }
      tally.shelf = (tally.shelf ?? 0) + 1;
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
function panel(b, w, u, h, M) {
  const WID = 0.86;
  const DEP = 0.26;
  const y0 = 0.45;
  const HT = 1.5;
  const cy = y0 + HT / 2;
  const box = (uu, v, y, wid, hh, th, m) => wallBox(b, w, uu, v, y, wid, hh, th, m);

  box(u, DEP / 2, cy, WID, HT, DEP, M.steelDark); // 함체
  box(u, DEP + 0.012, cy, WID - 0.04, HT - 0.04, 0.024, M.steel); // 문 두 짝
  box(u, DEP + 0.026, cy, 0.014, HT - 0.06, 0.01, M.steelDark); // 가운데 이음선

  // 경첩 — 왼쪽 모서리에 셋
  for (const dy of [-0.55, 0, 0.55]) {
    const at = wallAt(w, u - WID / 2 + 0.03, DEP + 0.02, cy + dy);
    tube(b, 0.018, 0.09, at, M.trim, w.axis === 'x' ? 'y' : 'y', 5, true);
  }
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

  // 계기 둘과 표시등 셋
  for (const du of [-0.06, 0.1]) {
    const at = wallAt(w, u + du, DEP + 0.04, cy + 0.16);
    tube(b, 0.05, 0.03, at, M.paper, w.axis === 'x' ? 'z' : 'x', 8, true);
    tube(b, 0.056, 0.014, at, M.trim, w.axis === 'x' ? 'z' : 'x', 8, true);
  }
  for (let i = 0; i < 3; i++) {
    box(u - 0.3 + i * 0.06, DEP + 0.034, cy + 0.16, 0.028, 0.028, 0.008, i === 1 ? M.ledAmber : M.led);
  }

  // **전선관** — 함체 위로 나가 천장으로 들어간다. 이게 있어야 배전반이다.
  for (const du of [-0.2, 0.2]) {
    const top = y0 + HT;
    const at = wallAt(w, u + du, DEP / 2, (top + h) / 2);
    tube(b, 0.032, h - top, at, M.trim, 'y', 6);
    const el = wallAt(w, u + du, DEP / 2, top + 0.02);
    tube(b, 0.045, 0.06, el, M.trim, 'y', 6, true);
  }
}

function utility(b, c, M, tally) {
  // 배전반과 배관 — 사람이 안 쓰는 방
  b.mark('furniture', `plant:${c.id}`);
  for (const w of interiorWalls(c.id)) {
    const len = w.b - w.a;
    for (const t of fit(0, len, 2.4, 1.0).map((v) => v / len)) {
      panel(b, w, w.a + len * t, c.h, M);
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

// ── 조립 ───────────────────────────────────────────────────────────────────

const BY_USE = {
  cafeteria,
  server: serverRoom,
  plaza,
  office,
  store: storage,
  util: utility,
  corridor: () => {},
};

export function createProps(scene, M) {
  const b = new MeshBuilder('Props');
  const tally = {};
  for (const c of CELLS) {
    const f = BY_USE[c.use];
    if (!f) throw new Error(`소품 표에 용도 '${c.use}' 가 없다 — props.BY_USE 에 추가한다`);
    f(b, c, M, tally);
    services(b, c, M, tally);
    if (c.kind === 'corridor') corridorWalls(b, c, M, tally);
  }
  exitSigns(b, M, tally);
  return { group: b.build(scene), tally };
}
