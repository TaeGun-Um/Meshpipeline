// 몸과 의상.
//
// 전부 "단면이 높이를 따라 변하는 관" 이다 (surface.loft). 팔다리는 세로로
// 만들어 관절에서 회전시킨다 — 리그를 붙일 때 그 회전축이 그대로 본이 된다.
//
// 비율: 키 1.60, 머리 0.216 -> 7.4등신에 가깝지만 다리를 길게 잡아
// 애니 체형으로 읽히게 했다. 실사 비율로 하면 그 순간 마네킹이 된다.
import * as THREE from 'three';
import { loft, ringsFrom, mirrorX, sampleKeys, sweep, pathFrom } from './surface.js';

export const Y = {
  hip: 0.88,
  waist: 1.03,
  bust: 1.19,
  shoulder: 1.285,
  knee: 0.45,
  ankle: 0.075,
  elbow: 1.03,
  wrist: 0.80,
};

// 세로로 만든 부품을 관절에서 돌려 제자리에 놓는다.
function place(geo, at, degZ = 0, degX = 0) {
  const m = new THREE.Matrix4()
    .makeRotationZ((degZ * Math.PI) / 180)
    .premultiply(new THREE.Matrix4().makeRotationX((degX * Math.PI) / 180));
  m.setPosition(at[0], at[1], at[2]);
  return geo.applyMatrix4(m);
}

// ── 몸통 ───────────────────────────────────────────────────────────────────

// ── 인체가 상자와 다른 점 ──────────────────────────────────────────────────
//
// 로프트는 수평 단면을 쌓는다. 그대로 두면 **윗면이 평평**해서 어깨가
// 옷걸이가 된다. 사람의 어깨는 목에서 팔로 **내려간다** (승모근 -> 삼각근).
// 그래서 위쪽 링은 바깥으로 갈수록 y 를 내린다 — deform 이 y 를 바꿀 수
// 있다는 점이 여기서 값을 한다.
const SHOULDER_SLOPE = 0.62;
function shoulderFall(x, y) {
  if (y < 1.19) return y;
  const k = Math.min(1, (y - 1.19) / (Y.shoulder - 1.19));
  // 목 둘레(±0.032)는 안 내린다 — 거기가 승모근이 솟은 자리다
  return y - k * Math.max(0, Math.abs(x) - 0.032) * SHOULDER_SLOPE;
}

// 가슴 볼륨. 링을 키우면 등까지 두꺼워지므로 앞면만 민다.
function bustOut(x, y, z) {
  if (z <= 0) return [x, y, z];
  const dy = (y - 1.185) / 0.075;
  const dx = (Math.abs(x) - 0.050) / 0.058;
  const k = Math.max(0, 1 - dy * dy) * Math.max(0, 1 - dx * dx);
  return [x, y, z + 0.036 * k];
}

export function torso() {
  const keys = [
    [Y.hip - 0.06, 0.098, 0.068, 2.3],
    [Y.hip, 0.115, 0.079, 2.4],
    [0.96, 0.106, 0.073, 2.4],
    [Y.waist, 0.091, 0.063, 2.3],
    [1.11, 0.104, 0.074, 2.3],
    [Y.bust, 0.117, 0.081, 2.4],
    [1.24, 0.126, 0.077, 2.5],
    [Y.shoulder, 0.120, 0.068, 2.4],
  ];
  return loft(ringsFrom(keys, 20), 26, {
    deform: (x, y, z) => {
      const r = bustOut(x, y, z);
      return [r[0], shoulderFall(r[0], r[1]), r[2]];
    },
    capTop: false,
  });
}

// 어깨 마감 — 팔이 붙는 곳의 둥근 덩어리
export function shoulderCap() {
  const keys = [
    [1.16, 0.030, 0.031, 2.0],
    [1.205, 0.046, 0.047, 2.1],
    [1.245, 0.050, 0.050, 2.1],
    [1.272, 0.040, 0.042, 2.0],
  ];
  const g = loft(ringsFrom(keys, 8), 16);
  g.translate(0.108, 0, 0);
  return [g, mirrorX(g)];
}

// 쇄골. 흉골절흔(가슴 한가운데 오목한 곳)에서 견봉(어깨 끝)으로 뻗는 가로 뼈다.
// 목과 가슴 사이가 매끈하면 마네킹이다 — 이 뼈 하나가 '사람' 을 만든다.
//
// 처음에 로프트로 만들려 했는데 틀렸다. **로프트는 y 로 쌓는 물건**이라
// 가로로 누운 것을 못 만든다 (링을 y 로 정렬하는 순간 순서가 뒤섞였다).
// 경로를 따라가는 뼈는 스윕이다. 도구를 고르는 것이 먼저다.
export function clavicle() {
  const path = pathFrom(
    [
      [0.008, 1.2425, 0.0555],
      [0.038, 1.2435, 0.0500],
      [0.070, 1.2395, 0.0320],
      [0.099, 1.2310, 0.0095],
    ],
    16
  );
  const g = sweep(
    path,
    (t) => ({ rx: 0.0070 * (1 - 0.4 * t) + 0.0009, ry: 0.0054 * (1 - 0.35 * t) + 0.0009 }),
    8
  );
  return [g, mirrorX(g)];
}

// ── 팔 ─────────────────────────────────────────────────────────────────────

function upperArmGeo() {
  const keys = [
    [0, 0.038, 0.038, 2.0],
    [-0.08, 0.034, 0.034, 2.0],
    [-0.18, 0.030, 0.030, 2.0],
    [-0.255, 0.027, 0.027, 2.0],
  ];
  return loft(ringsFrom(keys, 8), 14, { capTop: false });
}

function foreArmGeo() {
  const keys = [
    [0, 0.028, 0.028, 2.0],
    [-0.07, 0.025, 0.025, 2.0],
    [-0.16, 0.021, 0.021, 2.0],
    [-0.23, 0.019, 0.020, 2.0],
  ];
  return loft(ringsFrom(keys, 8), 14, { capTop: false });
}

// 손가락 하나. 끝으로 갈수록 가늘어지고 살짝 안으로 말린다.
function finger(len, r0, r1, curl, n = 8) {
  const rings = [];
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    const r = r0 + (r1 - r0) * t;
    rings.push({ y: -len * t, w: r, d: r * 1.12, k: 2.2, cz: curl * t * t });
  }
  return loft(rings.sort((a, b) => a.y - b.y), 10, { capTop: false });
}

// 손 — 손바닥 + 손가락 넷 + 엄지.
//
// 처음에는 납작한 주걱 하나였다. 전신 뷰에서도 "저기가 손이구나" 가 아니라
// "저건 뭐지" 로 읽혔다. 손가락은 다섯 개의 가는 관일 뿐이라 비싸지 않다 —
// 다섯을 더해 삼각형 1,400개, 인상은 통째로 달라진다.
function handGeo() {
  const palm = loft(
    ringsFrom(
      [
        [-0.072, 0.024, 0.011, 2.6],
        [-0.048, 0.028, 0.012, 2.7],
        [-0.014, 0.027, 0.013, 2.6],
        [0, 0.020, 0.014, 2.2],
      ],
      8
    ),
    14
  );
  const out = [palm];

  // 가운데가 제일 길다 — 넷이 같으면 갈퀴가 된다
  const spec = [
    [-0.0175, 0.036],
    [-0.0058, 0.042],
    [0.0058, 0.040],
    [0.0175, 0.032],
  ];
  for (const [x, len] of spec) {
    const g = finger(len, 0.0062, 0.0044, 0.0055);
    g.translate(x, -0.070, 0.001);
    out.push(g);
  }

  const th = finger(0.030, 0.0074, 0.0052, 0.003);
  const m = new THREE.Matrix4().makeRotationZ(1.0);
  m.setPosition(-0.024, -0.040, 0.007);
  out.push(th.applyMatrix4(m));
  return out;
}

// A 포즈 — 팔을 몸에서 15도 띄운다. T 포즈는 자료용이고 실루엣이 안 읽힌다.
const ARM_DEG = -15;

export function arms() {
  const out = { upper: [], fore: [], hand: [] };
  const sx = Math.sin((-ARM_DEG * Math.PI) / 180);
  const cx = Math.cos((-ARM_DEG * Math.PI) / 180);
  // 어깨가 경사졌으므로 팔 뿌리도 그만큼 내려와야 한다 — 안 내리면 팔이 뜬다
  const shoulderAt = [0.112, 1.238, 0];
  const elbowAt = [shoulderAt[0] + 0.255 * sx, shoulderAt[1] - 0.255 * cx, 0];
  const wristAt = [elbowAt[0] + 0.23 * sx, elbowAt[1] - 0.23 * cx, 0];

  const u = place(upperArmGeo(), shoulderAt, ARM_DEG);
  const f = place(foreArmGeo(), elbowAt, ARM_DEG);
  out.upper.push(u, mirrorX(u));
  out.fore.push(f, mirrorX(f));
  for (const part of handGeo()) {
    const h = place(part, wristAt, ARM_DEG);
    out.hand.push(h, mirrorX(h));
  }
  return out;
}

// ── 다리 ───────────────────────────────────────────────────────────────────

// 다리 실루엣. 종아리 배와 무릎을 넣는다 — 위에서 아래로 균일하게 가늘어지는
// 원뿔은 다리가 아니라 죽마다.
//
// **이 표는 다리와 스타킹이 함께 본다.** 스타킹이 자기 표를 따로 들고 있었더니
// 무릎을 앞으로 민 순간 무릎만 스타킹을 뚫고 나왔다.
const LEG_KEYS = [
  [Y.ankle, 0.025, 0.029, 2.0],
  [Y.ankle + 0.05, 0.028, 0.032, 2.0],
  [Y.ankle + 0.16, 0.040, 0.043, 2.0], // 종아리 배
  [Y.knee - 0.07, 0.041, 0.043, 2.0],
  [Y.knee, 0.042, 0.046, 2.1],
  [Y.knee + 0.10, 0.049, 0.052, 2.0],
  [Y.hip - 0.10, 0.058, 0.062, 2.1],
  [Y.hip - 0.02, 0.063, 0.068, 2.2],
];

// 무릎은 앞으로 나온다. 링을 키우면 오금까지 두꺼워지므로 앞만 민다.
const kneeOut = (x, y, z) => {
  const d = (y - Y.knee) / 0.055;
  const k = Math.max(0, 1 - d * d);
  return [x, y, z > 0 ? z + 0.007 * k : z];
};

export function legGeo() {
  return loft(ringsFrom(LEG_KEYS, 18), 18, { capTop: false, deform: kneeOut });
}

export function legs() {
  const g = legGeo();
  g.translate(0.058, 0, 0);
  return [g, mirrorX(g)];
}

// 허벅지까지 오는 스타킹. **다리와 같은 표에서 뽑고 두께만 더한다.**
const SOCK_T = 0.0016;
export function stocking(topY) {
  const y0 = Y.ankle - 0.006;
  const n = 18;
  const rings = [];
  for (let i = 0; i < n; i++) {
    const y = y0 + ((topY - y0) * i) / (n - 1);
    const r = sampleKeys(LEG_KEYS, y);
    rings.push({ y, w: r.w + SOCK_T, d: r.d + SOCK_T, k: r.k });
  }
  const g = loft(rings, 18, { capTop: false, capBottom: false, deform: kneeOut });
  g.translate(0.058, 0, 0);
  return g;
}

export function boots() {
  const keys = [
    [0.0, 0.035, 0.076, 2.8],
    [0.018, 0.038, 0.081, 3.0],
    [0.045, 0.037, 0.063, 2.6],
    [0.080, 0.034, 0.045, 2.3],
    [0.132, 0.033, 0.039, 2.1],
  ];
  // 발은 앞으로 길다. 발가락 쪽(+Z)만 늘이고 뒤꿈치는 그대로 둔다 —
  // 통째로 늘이면 뒤꿈치가 종아리 뒤로 튀어나온다.
  const g = loft(ringsFrom(keys, 12), 18, {
    deform: (x, y, z) => [x, y, (z > 0 ? z * 1.35 : z * 0.9) + 0.022],
  });
  g.translate(0.058, 0, 0);
  return [g, mirrorX(g)];
}

// ── 의상 ───────────────────────────────────────────────────────────────────

// 상의 — 몸통을 감싸는 껍질. 아래를 허리에서 끊는다.
export function bodice() {
  const keys = [
    [Y.waist - 0.06, 0.100, 0.070, 2.3],
    [Y.waist, 0.096, 0.068, 2.3],
    [1.11, 0.109, 0.078, 2.3],
    [Y.bust, 0.122, 0.086, 2.4],
    [1.24, 0.131, 0.082, 2.5],
    [Y.shoulder + 0.005, 0.124, 0.072, 2.4],
  ];
  return loft(ringsFrom(keys, 14), 26, {
    deform: (x, y, z) => {
      const r = bustOut(x, y, z > 0 ? z + 0.004 : z);
      return [r[0], shoulderFall(r[0], r[1]), r[2]];
    },
    capTop: false,
    capBottom: false,
  });
}

// 세운 깃 — 목 뒤가 높고 앞이 열린다
export function collar() {
  const keys = [
    [Y.shoulder - 0.01, 0.055, 0.050, 2.2],
    [Y.shoulder + 0.03, 0.046, 0.043, 2.1],
    [Y.shoulder + 0.062, 0.044, 0.042, 2.1],
  ];
  return loft(ringsFrom(keys, 6), 20, {
    capTop: false,
    capBottom: false,
    deform: (x, y, z) => [x, y, z > 0.02 ? z * 0.86 : z],
  });
}

// 페플럼 — 허리에서 퍼지는 짧은 겉치마
export function peplum() {
  const keys = [
    [0.735, 0.164, 0.126, 2.6],
    [0.80, 0.149, 0.113, 2.5],
    [0.87, 0.129, 0.096, 2.4],
    [0.95, 0.110, 0.078, 2.3],
    [Y.waist, 0.098, 0.070, 2.3],
  ];
  // 매끈한 원뿔은 천이 아니라 램프 갓이다. 각도에 따라 반지름을 물결지게
  // 해서 주름을 만든다. 아래로 갈수록 깊어져야 천이 늘어진 것으로 읽힌다.
  const y0 = keys[0][0];
  const y1 = keys[keys.length - 1][0];
  return loft(ringsFrom(keys, 20), 48, {
    capTop: false,
    capBottom: false,
    deform: (x, y, z, u) => {
      const drop = Math.max(0, (y1 - y) / (y1 - y0));
      const k = 1 + Math.cos(u * Math.PI * 2 * 9) * 0.045 * drop ** 1.3;
      return [x * k, y, z * k];
    },
  });
}

// 속바지 — 페플럼 아래로 보이는 부분
export function shorts() {
  const keys = [
    [0.755, 0.110, 0.076, 2.3],
    [0.82, 0.115, 0.080, 2.4],
    [Y.hip, 0.117, 0.081, 2.4],
    [0.95, 0.108, 0.075, 2.4],
  ];
  return loft(ringsFrom(keys, 8), 24, { capTop: false });
}

// 어깨 장식판
export function pauldrons() {
  const keys = [
    [1.212, 0.057, 0.055, 2.4],
    [1.242, 0.069, 0.065, 2.5],
    [1.262, 0.062, 0.058, 2.4],
    [1.274, 0.040, 0.040, 2.2],
  ];
  const g = loft(ringsFrom(keys, 8), 18);
  g.translate(0.108, 0, 0);
  return [g, mirrorX(g)];
}

// ── 장식 ───────────────────────────────────────────────────────────────────
//
// 레퍼런스의 밀도는 형태가 아니라 **작은 것의 개수**에서 온다. 판 하나,
// 버클 하나가 각각 삼각형 200개도 안 되는데 눈은 그 개수를 센다.

// 납작한 판 — 흉장·어깨판·부츠 덮개에 쓴다
export function plate(y, h, r, d, x = 0, z = 0, k = 2.6) {
  const keys = [
    [y, r * 0.86, d * 0.86, k],
    [y + h * 0.35, r, d, k],
    [y + h, r * 0.7, d * 0.7, k],
  ];
  const g = loft(ringsFrom(keys, 5), 20);
  if (x || z) g.translate(x, 0, z);
  return g;
}

// 가슴 브로치 — 마름모 하나. 시선이 가장 먼저 닿는 자리다
export function brooch() {
  const y = Y.bust + 0.055;
  const rings = [];
  const n = 9;
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    const s = Math.sin(t * Math.PI);
    rings.push({ y: y - 0.026 + 0.052 * t, w: 0.0025 + 0.021 * s, d: 0.004 + 0.007 * s, k: 2.0 });
  }
  const g = loft(rings, 4);
  g.translate(0, 0, 0.086);
  return g;
}

// 허리 버클
export function buckle() {
  const g = plate(Y.waist - 0.018, 0.036, 0.026, 0.014, 0, 0.062, 2.8);
  return g;
}

// 부츠 발등 덮개와 발목 끈
export function bootTrim() {
  const a = plate(0.085, 0.03, 0.034, 0.039, 0.058, 0.014, 2.4);
  const b = plate(0.024, 0.018, 0.039, 0.058, 0.058, 0.016, 2.8);
  return [a, mirrorX(a), b, mirrorX(b)];
}

// 소매 커프스 · 허벅지 밴드 같은 띠
export function band(y, h, r, x = 0) {
  const keys = [
    [y, r, r * 1.05, 2.2],
    [y + h * 0.5, r * 1.06, r * 1.11, 2.2],
    [y + h, r, r * 1.05, 2.2],
  ];
  const g = loft(ringsFrom(keys, 4), 18, { capTop: false, capBottom: false });
  if (x) g.translate(x, 0, 0);
  return g;
}
