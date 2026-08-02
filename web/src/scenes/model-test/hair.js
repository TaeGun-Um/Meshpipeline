// 머리카락.
//
// ── 여기가 코드가 이기는 자리다 ────────────────────────────────────────────
// 얼굴은 규칙이 없어서 그림으로 갔다. 머리카락은 반대다 — 땋은 머리는
// **세 가닥이 축을 돌며 교차하는 수식**이고, 손으로 만들면 제일 고통스럽지만
// 코드로는 정확하다. 길이·굵기·꼬임 간격을 숫자 하나씩으로 조절한다.
//
// 이 캐릭터에서 면적으로 제일 큰 것이 머리카락이기도 하다.
import * as THREE from 'three';
import { loft, ringsFrom, sweep, pathFrom, mirrorX } from './surface.js';
import { HEAD, headFrontZ } from './head.js';
import { paint } from './paint.js';

// 뿌리는 은백, 끝으로 갈수록 짙은 남색. 레퍼런스의 특징이 이 그라디언트다.
// sweep 의 UV 는 v 가 경로를 따라가므로 세로 한 줄이면 된다.
export function hairGradient() {
  return paint(16, 256, (g, W, H) => {
    // 캔버스 위(y=0)가 UV v=1 이다. v=0(뿌리)이 아래로 오게 그린다.
    const gr = g.createLinearGradient(0, H, 0, 0);
    // 어두워지는 구간을 끝 1/4 로 몰아야 한다. 중간부터 어두우면 은발이
    // 아니라 그냥 검은 머리로 읽힌다 — 처음 판이 그랬다.
    gr.addColorStop(0.0, '#f2f2f8'); // 뿌리
    gr.addColorStop(0.62, '#e7e8f2');
    gr.addColorStop(0.80, '#cfd3e6');
    gr.addColorStop(0.91, '#8790b4');
    gr.addColorStop(0.97, '#454e7c');
    gr.addColorStop(1.0, '#2a3155'); // 끝
    g.fillStyle = gr;
    g.fillRect(0, 0, W, H);
  });
}

// 두피를 덮는 껍질.
//
// **아래 끝이 눈썹보다 위여야 한다.** 처음에 머리 높이의 28% 부터 덮었더니
// 그 선이 눈보다 아래였고, 얼굴이 통째로 흰 껍질에 가려 가면을 쓴 것처럼
// 나왔다. 껍질은 정수리만 맡고 이마는 앞머리가, 뒤통수는 뒷머리가 맡는다.
export function hairCap() {
  const H = HEAD.top - HEAD.bot;
  const y = (t) => HEAD.bot + t * H;
  const keys = [
    [y(0.58), 0.113, 0.125, 2.4],
    [y(0.7), 0.110, 0.122, 2.3],
    [y(0.83), 0.092, 0.103, 2.2],
    [y(0.93), 0.064, 0.072, 2.1],
    [y(1.008), 0.018, 0.022, 2.0],
  ];
  return loft(ringsFrom(keys, 12), 28, {
    capBottom: false,
    // 뒤통수 쪽을 더 부풀린다 — 뒷머리 볼륨
    deform: (x, yy, z) => [x, yy, z > 0 ? z : z * 1.18],
  });
}

// 곧은 칼날. 지금은 묶음(tails)만 쓴다 — 두피를 안 따라가도 되는 것.
//   len   길이 (아래로)
//   w0/w1 뿌리/끝 반폭
//   th    두께 반값
//   bend  [앞뒤, 좌우] 끝에서의 휨
function blade(len, w0, w1, th, bend = [0, 0], n = 10) {
  const rings = [];
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    const e = t ** 1.4;
    rings.push({
      y: -len * t,
      w: Math.max(0.0015, w0 + (w1 - w0) * e),
      d: Math.max(0.0012, th * (1 - 0.55 * e)),
      k: 2.4,
      cz: bend[0] * e,
      cx: bend[1] * e,
    });
  }
  rings.reverse();
  for (const r of rings) r.y = r.y; // 위→아래 순서를 y 증가로
  return loft(rings.sort((a, b) => a.y - b.y), 12, { capTop: false });
}

// 두피를 따라 휘어 내려오는 가닥. 앞머리·옆머리가 전부 이것이다.
//
// 처음에는 곧은 칼날을 만들어 X 축으로 회전시켰다. 곧은 판을 기울이면
// **뿌리는 두개골 안, 끝은 얼굴 앞 허공**이 되어 흰 가면을 쓴 것처럼 나왔다.
// 머리카락은 두피를 따라 붙어 내려오므로 링마다 깊이를 따로 줘야 한다.
//
//   x      좌우 위치        rootY  뿌리 높이
//   len    길이             w0/w1  뿌리/끝 반폭
//   z0     뿌리 깊이        z1     끝 깊이 (얼굴 앞으로 나온 만큼)
//   lean   끝이 옆으로 밀리는 양
function strand(x, rootY, len, w0, w1, th, z0, z1, lean = 0, n = 12) {
  const rings = [];
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    const e = t ** 1.35;
    rings.push({
      y: rootY - len * t,
      w: Math.max(0.0018, w0 + (w1 - w0) * e),
      d: Math.max(0.0014, th * (1 - 0.5 * e)),
      k: 2.5,
      cz: z0 + (z1 - z0) * Math.sin((t * Math.PI) / 2),
      cx: x + lean * e,
    });
  }
  return loft(rings.sort((a, b) => a.y - b.y), 12, { capTop: false });
}

// 두피 표면에 붙어 내려오는 가닥. 깊이를 짐작하지 않고 **머리에게 묻는다.**
//   gap  두피에서 띄우는 양 (가닥 두께의 절반보다 커야 파고들지 않는다)
//   out  끝에서 두피를 벗어나 앞으로 뜨는 양
function scalpStrand(x, rootY, len, w0, w1, th, gap, out, lean = 0, n = 16) {
  const rings = [];
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    const e = t ** 1.35;
    const y = rootY - len * t;
    const cx = x + lean * e;
    // 끝 30% 에서 급격히 뾰족해진다. 균일하게 줄이면 끝이 뭉툭한 판이고,
    // 3/4 에서 종잇조각으로 보이는 이유가 그것이었다.
    const tip = t < 0.7 ? 0 : ((t - 0.7) / 0.3) ** 1.6;
    const w = Math.max(0.0012, (w0 + (w1 - w0) * e) * (1 - 0.92 * tip));
    rings.push({
      y,
      w,
      d: Math.max(0.0010, th * (1 - 0.5 * e) * (1 - 0.75 * tip)),
      k: 2.5,
      cz: headFrontZ(y, cx) + gap + out * e,
      cx,
    });
  }
  return loft(rings.sort((a, b) => a.y - b.y), 12, { capTop: false });
}

// 앞머리 — 이마를 덮는다. 끝이 눈썹 바로 위에서 멈춰야 눈이 산다.
export function bangs() {
  const out = [];
  const root = HEAD.top - 0.012;
  // [x, 길이, 뿌리반폭, 끝깊이, 옆으로]
  // 길이를 가닥마다 흔들어야 밑단이 직선이 안 된다 — 균일하면 헬멧이다.
  // 끝이 **눈 위쪽 언저리**(y 1.46~1.48)에 닿아야 한다. 짧으면 두피 껍질의
  // 밑단이 그대로 드러나 흰 헬멧을 쓴 것처럼 보인다 — 실제로 그랬다.
  //
  // 두피를 물어보게 고치고 나니 이번엔 **너무 길어서** 눈을 덮었다. 가운데
  // 가닥은 눈썹 위(y 1.49)에서 끊고, 얼굴을 감싸는 옆가닥만 눈높이까지 내린다.
  const spec = [
    [0.020, 0.092, 0.018, 0.008],
    [-0.020, 0.101, 0.018, -0.008],
    [0.053, 0.109, 0.019, 0.015],
    [-0.053, 0.097, 0.019, -0.015],
    [0.082, 0.142, 0.017, 0.023],
    [-0.082, 0.131, 0.017, -0.023],
  ];
  for (const [x, len, w, lean] of spec) {
    // 끝을 뾰족하게(0.22) — 뭉툭하면 가닥이 아니라 판이다
    // 두피에서 띄우는 양을 12mm 에서 7mm 로. 멀면 머리에서 뜬 판때기다.
    // 두께 13mm 는 판자다. 머리카락 다발은 폭보다 훨씬 얇다.
    out.push(scalpStrand(x, root, len, w, w * 0.34, 0.0075, 0.006, 0.004, lean));
  }
  return out;
}

// 뒷머리 — 껍질이 못 덮는 뒤통수를 굵은 가닥 다섯으로 채운다.
// 로프트는 닫힌 고리라 "뒤쪽 절반만" 을 만들 수 없다. 가닥을 늘어놓는 편이
// 헤어 카드의 관례이기도 하고 실루엣도 더 산다.
export function backHair() {
  const out = [];
  // 앞머리와 같은 규율 — 깊이를 짐작하지 않고 두피에 묻는다.
  // 좌표를 손으로 적었더니 다섯 가닥이 전부 두개골 속에 들어가 있었다.
  for (const [x, len, w, out2] of [
    [0.0, 0.265, 0.054, 0.004],
    [0.055, 0.255, 0.050, 0.004],
    [-0.055, 0.255, 0.050, 0.004],
    [0.098, 0.222, 0.038, 0.002],
    [-0.098, 0.222, 0.038, 0.002],
  ]) {
    const rings = [];
    const root = HEAD.top - 0.028;
    const n = 14;
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1);
      const e = t ** 1.3;
      const y = root - len * t;
      rings.push({
        y,
        w: w * (1 - 0.3 * e),
        d: 0.026 * (1 - 0.4 * e),
        k: 2.5,
        // 뒤통수 표면에서 바깥으로 — 부호가 음수라 gap 도 음수로 더한다
        cz: headFrontZ(Math.min(y, HEAD.top - 0.01), x, true) - 0.010 - out2 * e,
        cx: x,
      });
    }
    out.push(loft(rings.sort((a, b) => a.y - b.y), 12, { capTop: false }));
  }
  return out;
}

// 옆머리 — 귀 앞에서 턱 아래까지. 얼굴 윤곽을 잡아 준다.
export function sideLocks() {
  const r = [];
  for (const [x, len, w, z0, z1, lean] of [
    [0.090, 0.245, 0.020, 0.026, 0.048, 0.014],
    [0.101, 0.165, 0.013, -0.026, -0.006, 0.014],
  ]) {
    const g = strand(x, HEAD.top - 0.055, len, w, w * 0.18, 0.010, z0, z1, lean, 14);
    r.push(g, mirrorX(g));
  }
  return r;
}

// ── 땋은 머리 ──────────────────────────────────────────────────────────────
//
// 세 가닥이 중심 경로를 돌며 내려간다. 가닥 하나의 위치는
//   P(t) + (cos θ, 0, sin θ) · r(t),    θ = 2π·turns·t + i·(2π/3)
// 갈래가 세 개라 위상이 120도씩 벌어지고, 그것만으로 교차가 생긴다.
//
// 꼬임 수(turns)가 이 형태의 전부다. 적으면 밧줄, 많으면 드릴이 된다 —
// 실제 땋은 머리는 **폭 하나당 한 번** 정도 돈다.
function braidGeometry(keys, { r0 = BRAID_R0, r1 = BRAID_R1, seg = 110 } = {}) {
  const center = pathFrom(keys, seg);
  // 길이에서 꼬임 수를 유도한다. 굵기를 바꾸면 꼬임도 따라와야 한다.
  let len = 0;
  for (let i = 1; i < center.length; i++) len += center[i].distanceTo(center[i - 1]);
  // 나누는 값을 키우면 꼬임이 성겨진다. 2.15 로 뒀더니 나선이 자기를 파고들어
  // 교차부에 지글거림(z-fighting)이 생겼다.
  const turns = Math.max(3, Math.round(len / (2.7 * (r0 + r1))));

  const parts = [];
  for (let i = 0; i < 3; i++) {
    const pts = center.map((p, j) => {
      const t = j / (center.length - 1);
      const rr = r0 + (r1 - r0) * t ** 0.85;
      const a = Math.PI * 2 * turns * t + (i * Math.PI * 2) / 3;
      return new THREE.Vector3(p.x + Math.cos(a) * rr, p.y, p.z + Math.sin(a) * rr);
    });
    parts.push(
      sweep(
        pts,
        (t) => {
          const rr = r0 + (r1 - r0) * t ** 0.85;
          return { rx: rr * 0.66, ry: rr * 0.58 };
        },
        8
      )
    );
  }
  return parts;
}

// 중심 경로. 땋은 머리와 고리가 **함께** 쓴다 — 두 곳에 적으면 굵기를
// 바꿀 때 고리만 허공에 남는다.
// 어깨 바깥으로 넘겨야 한다. 안쪽에 붙이면 정면에서 **팔이 통째로 가려**
// 인체가 안 읽힌다 — 머리카락이 아니라 망토가 된다.
const BRAID_KEYS = [
  [0.104, HEAD.bot + 0.085, -0.062],
  [0.176, 1.30, -0.048],
  [0.228, 1.10, 0.0],
  [0.240, 0.86, 0.036],
  [0.232, 0.60, 0.050],
  [0.212, 0.36, 0.040],
  [0.198, 0.17, 0.008],
  [0.202, 0.06, -0.032],
];
const BRAID_R0 = 0.044;
const BRAID_R1 = 0.017;

// 땋은 머리를 묶는 고리. 레퍼런스에 두 쪽마다 여러 개 달려 있고,
// 이게 있어야 "땋았다" 가 아니라 "손질했다" 로 보인다.
//
// 고리는 땋은 머리의 중심 경로 위에 앉아야 한다 — 좌표를 따로 적으면
// 굵기를 바꿀 때마다 고리가 허공에 뜬다. 그래서 같은 keys 에서 뽑는다.
// 고리는 **본에 물려야 한다.** 정적 지오메트리로 두면 땋은 머리가 흔들릴 때
// 고리만 원래 자리에 남아 허공에 뜬다 (실제로 그랬다).
// 그래서 지오메트리가 아니라 "어느 t 에 어떤 고리" 를 돌려주고, 붙이는 쪽이
// 그 t 의 본에 매단다.
export function braidRingsAt() {
  const out = [];
  for (const t of [0.06, 0.36, 0.68, 0.94]) {
    const rr = BRAID_R0 + (BRAID_R1 - BRAID_R0) * t ** 0.85;
    // 다발의 바깥 반지름은 중심거리 rr 에 가닥 반지름(약 0.66rr)을 더한 값이다.
    const g = new THREE.TorusGeometry(rr * 1.78, rr * 0.15, 6, 20);
    g.rotateX(Math.PI / 2);
    out.push({ geo: g, t });
  }
  return out;
}

// 트윈 땋은 머리 한 쪽. 귀 뒤에서 묶어 바깥으로 부풀었다가 바닥까지.
export function braids() {
  const right = braidGeometry(BRAID_KEYS);
  return [...right, ...right.map(mirrorX)];
}

// 스프링용 — 가닥 셋과 **본이 앉을 중심 자리**를 같이 돌려준다.
// 본 자리를 따로 적으면 땋은 머리를 옮길 때 본만 제자리에 남는다.
export function braidRig(boneCount = 11) {
  const center = pathFrom(BRAID_KEYS, 110);
  const bonePts = [];
  for (let i = 0; i < boneCount; i++) {
    bonePts.push(center[Math.round((i / (boneCount - 1)) * (center.length - 1))].clone());
  }
  return { parts: braidGeometry(BRAID_KEYS), bonePts };
}

// 땋기 시작하기 전의 묶음 — 머리끈 위쪽의 부푼 부분
export function tails() {
  const g = blade(0.16, 0.056, 0.044, 0.048, [0, 0.02], 10);
  const m = new THREE.Matrix4().makeRotationZ(-0.28);
  m.setPosition(0.082, HEAD.bot + 0.185, -0.062);
  g.applyMatrix4(m);
  return [g, mirrorX(g)];
}

// 안테나 한 가닥. 이거 하나로 인상이 부드러워진다.
export function ahoge() {
  const path = pathFrom(
    [
      [0.004, HEAD.top - 0.012, 0.01],
      [0.012, HEAD.top + 0.035, -0.01],
      [-0.006, HEAD.top + 0.062, -0.045],
      [-0.034, HEAD.top + 0.05, -0.062],
    ],
    18
  );
  return sweep(path, (t) => ({ rx: 0.0085 * (1 - t) ** 0.8 + 0.0007 }), 7);
}

// 뿔처럼 선 장식 가닥 — 레퍼런스의 실루엣에서 제일 먼저 눈에 띄는 것
export function horns() {
  const path = pathFrom(
    [
      [0.052, HEAD.top - 0.034, -0.034],
      [0.071, HEAD.top + 0.034, -0.057],
      [0.081, HEAD.top + 0.094, -0.092],
      [0.071, HEAD.top + 0.130, -0.134],
    ],
    16
  );
  // 가늘면 곤충 더듬이로 보인다. 뿔은 뿌리가 굵고 단면이 둥글어야 한다.
  const g = sweep(path, (t) => ({ rx: 0.026 * (1 - t) ** 0.8 + 0.0012, ry: 0.021 * (1 - t) ** 0.75 + 0.0012 }), 10);
  return [g, mirrorX(g)];
}
