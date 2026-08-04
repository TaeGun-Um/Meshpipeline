// 머리 · 목 · 귀.
//
// 캐릭터 전체가 발바닥 y=0 에 서는 좌표로 지어진다. 머리는 그중
// HEAD.bot ~ HEAD.top 을 차지하고, 얼굴 텍스처의 v 가 그 구간에 정확히 대응한다.
// 둘이 어긋나면 눈이 이마로 올라간다 — 그래서 한 곳에서 정의하고 둘 다 받는다.
import * as THREE from 'three';
import { loft, ringsFrom, sweep, pathFrom, mirrorX, sampleKeys } from './surface.js';

// 머리 구간과 얼굴 텍스처가 덮는 범위. **단일 출처**.
export const HEAD = {
  bot: 1.352, // 턱 끝
  top: 1.600, // 정수리 — 세로 0.248, 가로 0.192
  //
  // 머리가 작으면 그 순간 실사 체형이 된다. 키 1.60 에 머리 0.248 이면
  // **6.5등신** — 애니가 쓰는 비율이다. 7.4등신으로 뒀더니 마른 성인이었다.
  //
  // 처음에 0.240 x 0.154(1.56)로 잡았더니 계란처럼 길었다. 실사 두상이
  // 대략 1.45 인데 애니는 그보다 **더 둥글다** — 이마가 넓고 턱이 짧다.
  //
  // 텍스처가 덮는 가로 반폭. 머리 실제 반폭(0.085)보다 넓게 잡는다 —
  // 딱 맞추면 얼굴 그림이 실루엣 끝까지 늘어나 옆에서 보면 눈이 귀에 붙는다.
  half: 0.108,
};
const NECK_Y = 1.30;

// ── 얼굴의 뼈와 살 ─────────────────────────────────────────────────────────
//
// 3/4 로 돌려 보고 무섭다는 지적을 받았다. 원인은 텍스처가 아니라 **두상에
// 구조가 하나도 없다**는 것이었다 — 눌러 놓은 계란에 얼굴을 인쇄한 셈이다.
// 정면에서는 그림이 가려 주지만 조금만 돌리면 그림이 늘어나면서 가면이 된다.
//
// 사람 얼굴의 앞면을 만드는 것은 뼈 다섯과 그 사이의 면이다.
//
//   전두골 눈두덩(眉弓)   눈썹 자리가 앞으로 나오고 그 아래가 들어간다
//   안와(눈확)            눈알은 구멍 안에 앉는다. 눈꺼풀 위가 그늘진다
//   비골 + 연골           미간에서 코끝까지 능선. **3/4 의 성패가 여기 있다**
//   관골(광대)            얼굴에서 제일 넓은 지점. 눈높이에서 귀로 간다
//   하악(턱)              턱끝 융기가 앞으로, 하악각이 귀 아래에서 꺾인다
//
// 애니 두상은 이걸 다 죽이지만 **0 으로 만들지는 않는다.** 코가 정확히 0 이면
// 옆에서 얼굴이 벽이 되고, 그게 사람이 아닌 것으로 읽히는 첫 번째 이유다.
const F = {
  brow: 1.487, // 눈썹(눈두덩 마루)
  eye: 1.455, // 눈 중심
  cheek: 1.440, // 광대 융기
  noseTip: 1.416,
  noseBase: 1.402,
  mouth: 1.396,
  chin: 1.369,
};

// y 가 c 에서 얼마나 가까운가 (r 밖이면 0)
const near = (v, c, r) => Math.max(0, 1 - ((v - c) / r) ** 2);
// |x| 가 r 안쪽인가
const inner = (ax, r) => Math.max(0, 1 - (ax / r) ** 2);
// |x| 가 a~b 띠 안인가
const bandAt = (ax, a, b) => near(ax, (a + b) / 2, (b - a) / 2);

function faceStructure(x, y, z) {
  if (z <= 0) return z;
  const ax = Math.abs(x);

  // 코 — 미간에서 코끝까지 올라갔다가 콧방울 아래로 급히 죽는다.
  // 폭이 좁고(±14mm) 돌출이 작아도(11mm) 3/4 실루엣이 완전히 달라진다.
  let nose = 0;
  if (y > F.noseBase - 0.004 && y < F.brow + 0.006) {
    const up =
      y > F.noseTip
        ? (F.brow + 0.006 - y) / (F.brow + 0.006 - F.noseTip)
        : (y - (F.noseBase - 0.004)) / (F.noseTip - (F.noseBase - 0.004));
    // 11.5mm 로는 옆에서 안 보였다. 애니 코가 작다고 0 에 가까우면
    // 옆얼굴이 벽이 되고, 그게 '사람이 아니다' 로 읽히는 첫 신호다.
    nose = 0.0175 * Math.max(0, up) ** 0.6 * inner(ax, 0.017);
  }

  return (
    z +
    nose +
    0.0042 * near(y, F.brow, 0.017) * inner(ax, 0.060) - // 눈두덩
    0.0032 * near(y, F.eye + 0.004, 0.020) * bandAt(ax, 0.016, 0.058) + // 눈확
    0.0038 * near(y, F.cheek, 0.028) * bandAt(ax, 0.038, 0.078) + // 광대
    0.0060 * near(y, F.chin, 0.021) * inner(ax, 0.032) - // 턱끝 융기
    0.0030 * near(y, F.mouth + 0.014, 0.012) * inner(ax, 0.034) + // 입술 아래 고랑
    0.0026 * near(y, F.mouth + 0.006, 0.016) * inner(ax, 0.026) // 인중~윗입술
  );
}

// ── 정면 평면성 ────────────────────────────────────────────────────────────
//
// **이걸 비율로 곱하고 있었다. 그게 얼굴이 기괴했던 진짜 원인이다.**
//
//   z *= 1 - 0.34 * (1 - |x|/0.074)^2      <- 틀렸다
//
// 이 식은 **중앙을 제일 세게 누른다.** 눈높이에서 계산해 보면
// 코 자리 0.0815, 광대 0.0926 — 얼굴 한가운데가 광대보다 **11mm 뒤**에 있다.
// 이마에서 턱까지 가운데가 골짜기로 파인 얼굴이고, 그 위에 코를 17mm 얹어도
// 여전히 광대보다 안쪽이다. 코가 있는 게 아니라 계곡에 둔덕이 있는 것이었다.
//
// 올바른 뜻은 "눌러서 얕게" 가 아니라 **"단면을 각지게"** 다.
// 초타원의 지수 k 를 올리면 중앙이 평평해지고 광대에서 꺾여 옆면으로 넘어간다 —
// 두께는 유지한 채 앞면만 판판해진다. 그게 정면 평면성의 정확한 정의다.
//
//   k=2.4 (원래 두상)   중앙 1.000 · 광대 0.906 · 관자 0.766   부드러운 타원
//   k=5.5 (얼굴 앞면)   중앙 1.000 · 광대 0.994 · 관자 0.961   판판한 앞면
const FACE_K = 5.5; // 앞면 단면의 각짐
const FACE_DEPTH = 0.86; // 앞면을 원래 깊이의 몇 배로 둘지

function flattenFront(x, y, z) {
  if (z > 0) {
    const t = (y - HEAD.bot) / (HEAD.top - HEAD.bot);
    // 얼굴 구간에서만 앞면을 각지게 한다. 정수리·턱끝은 원래 두상 그대로.
    const fy = Math.max(0, 1 - ((t - 0.40) / 0.50) ** 2);
    if (fy > 0) {
      const r = sampleKeys(HEAD_KEYS, y);
      const u = Math.min(0.999, Math.abs(x) / r.w);
      const kf = r.k + (FACE_K - r.k) * fy;
      const zFlat = r.d * FACE_DEPTH * (1 - u ** kf) ** (1 / kf);
      z += (zFlat - z) * fy;
    }
    z = faceStructure(x, y, z);
  } else {
    // 뒤통수는 오히려 조금 키운다. 애니 두상은 뒤가 크다
    const t = (y - HEAD.bot) / (HEAD.top - HEAD.bot);
    z *= 1 + 0.1 * Math.max(0, 1 - ((t - 0.6) / 0.5) ** 2);
  }
  return [x, y, z];
}

// 앞에서 평행 투영한 UV.
//
// 평행 투영은 z 를 안 본다. 그래서 **옆면과 뒤통수도 같은 u 를 받아** 눈이
// 귀 뒤까지 늘어붙는다 — 3/4 에서 얼굴이 가면으로 보이던 두 번째 이유다.
//
// 앞을 향한 면만 그림을 받고, 옆으로 돌아가는 면은 u 를 텍스처 가장자리
// (민 살색)로 밀어 버린다. 실무의 얼굴 UV 언랩을 흉내내는 가장 싼 방법이다.
function projectFaceUV(geo) {
  const p = geo.attributes.position;
  const uv = [];
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    const y = p.getY(i);
    const z = p.getZ(i);
    const v = (y - HEAD.bot) / (HEAD.top - HEAD.bot);
    const front = Math.min(1, Math.max(0, z / 0.045)) ** 1.6;
    const uFace = 0.5 + x / (2 * HEAD.half);
    const uEdge = x >= 0 ? 0.985 : 0.015;
    uv.push(uEdge + (uFace - uEdge) * front, v);
  }
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
}

// 두상 실루엣. 머리 지오메트리와 headFrontZ 가 **같은 표를 본다** —
// 머리카락이 두피를 따라가려면 두피가 어디 있는지 물어볼 수 있어야 한다.
const HEAD_KEYS = (() => {
  const H = HEAD.top - HEAD.bot;
  const y = (t) => HEAD.bot + t * H;
  // [y, 반폭, 반깊이, 각짐]
  return [
    [y(0.0), 0.023, 0.026, 2.0],
    // 아래턱은 **각이 진다.** 하악각(귀 아래 모서리)이 없으면 얼굴이
    // 달걀이고, 그래서 옆에서 볼이 목으로 그냥 흘러내렸다.
    [y(0.08), 0.050, 0.063, 2.6],
    [y(0.18), 0.067, 0.082, 2.9],
    [y(0.3), 0.082, 0.095, 2.8],
    [y(0.44), 0.096, 0.106, 2.4],
    [y(0.62), 0.096, 0.106, 2.3],
    [y(0.8), 0.082, 0.092, 2.2],
    [y(0.93), 0.052, 0.059, 2.1],
    [y(1.0), 0.015, 0.018, 2.0],
  ];
})();

const HEAD_RINGS = ringsFrom(HEAD_KEYS, 64);

// 주어진 높이에서 **얼굴 앞면이 어디까지 나와 있는가.**
//
// 머리카락이 두피에 붙으려면 이 값이 필요하다. 앞머리를 사인 곡선으로
// 짐작하게 뒀더니 위쪽 절반이 통째로 두개골 속에 묻혔고, 끝만 이마 밖으로
// 삐죽 나와 흰 헬멧 밑에 나뭇조각이 붙은 꼴이 됐다.
// back:true 면 뒤통수 표면(음수). 뒷머리가 두피를 따라가려면 이쪽도 필요하다 —
// 앞만 만들어 뒀더니 뒷머리 가닥이 전부 두개골 **속**에 들어가 뒤통수가
// 맨살로 드러났고, 어두워서 구멍처럼 보였다.
export function headFrontZ(y, x = 0, back = false) {
  if (y <= HEAD_RINGS[0].y) return 0;
  let i = 0;
  while (i < HEAD_RINGS.length - 2 && HEAD_RINGS[i + 1].y < y) i++;
  const A = HEAD_RINGS[i];
  const B = HEAD_RINGS[i + 1];
  const t = B.y === A.y ? 0 : (y - A.y) / (B.y - A.y);
  const w = A.w + (B.w - A.w) * t;
  const d = A.d + (B.d - A.d) * t;
  // 그 높이의 단면 위에서 x 에 해당하는 z (초타원을 z 에 대해 푼다)
  const k = A.k + (B.k - A.k) * t;
  const r = Math.min(1, Math.abs(x) / w);
  const z = d * (1 - r ** k) ** (1 / k);
  return flattenFront(x, y, back ? -z : z)[2];
}

export function headGeometry() {
  const g = loft(HEAD_RINGS, 30, { deform: flattenFront });
  projectFaceUV(g);
  return g;
}

// 귀.
//
// 앞판에서는 원뿔 하나를 옆으로 뻗어 놨는데, 3/4 에서 **살점 하나**로 보였다.
// 귀는 뻗어 나온 뿔이 아니라 **머리 옆면에 선 납작한 판**이다 —
//   귓바퀴(helix)가 테두리를 돌고, 가운데가 오목하고(concha), 아래에 귓불.
// 위쪽만 뾰족하게 빼면 그대로 요정 귀가 된다.
//
// 위치도 뼈가 정한다. 귀는 **광대활 뒤, 눈높이에서 코끝 높이 사이**에 있고,
// 위 끝이 눈썹 언저리, 아래 끝이 코끝 언저리다.
function earGeometry() {
  const rings = [];
  // [높이, 두께 반값, 앞뒤 반값, 바깥으로 얼마나]
  const key = [
    [F.noseTip - 0.004, 0.0038, 0.0085, 0.0], // 귓불
    [F.noseTip + 0.014, 0.0050, 0.0150, 0.004],
    [F.eye - 0.002, 0.0058, 0.0195, 0.009],
    [F.eye + 0.020, 0.0054, 0.0190, 0.014],
    [F.brow + 0.002, 0.0040, 0.0140, 0.019],
    [F.brow + 0.020, 0.0022, 0.0070, 0.024],
    [F.brow + 0.034, 0.0009, 0.0022, 0.027], // 뾰족한 끝
  ];
  for (let i = 0; i < key.length; i++) {
    const [y, w, d, out] = key[i];
    rings.push({ y, w, d, k: 2.3, cx: out, cz: -0.020 - d * 0.15 });
  }
  const g = loft(rings, 14);
  // 머리 옆면에 붙인다. 귀는 앞을 보지 않고 **살짝 뒤로 열려** 있다.
  g.rotateY(-0.32);
  g.translate(0.081, 0, 0);

  // 오목한 안쪽(concha) 을 눌러 넣는다 — 평평한 판은 귀로 안 읽힌다
  const pos = g.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const px = pos.getX(i);
    const py = pos.getY(i);
    const pz = pos.getZ(i);
    const k = near(py, F.eye + 0.004, 0.020) * near(pz, -0.024, 0.014);
    if (k > 0) pos.setX(i, px - 0.0055 * k);
  }
  pos.needsUpdate = true;
  g.computeVertexNormals();
  return g;
}

export function earGeometries() {
  const r = earGeometry();
  return [r, mirrorX(r)];
}

export function neckGeometry() {
  // 굵기가 거의 안 변해야 한다. 아래에서 벌어지면 목이 아니라 화병이다 —
  // 어깨로 이어지는 사다리꼴은 몸통이 맡는다.
  // 목은 원기둥이 아니다. 아래가 승모근으로 벌어져 어깨에 앉고, 턱 밑에서
  // 다시 살짝 넓어진다. 균일한 관으로 두면 머리가 막대에 꽂힌 것처럼 보인다.
  const keys = [
    [NECK_Y - 0.055, 0.062, 0.055, 2.2],
    [NECK_Y - 0.02, 0.044, 0.041, 2.1],
    [NECK_Y + 0.02, 0.035, 0.034, 2.0],
    [NECK_Y + 0.05, 0.034, 0.034, 2.0],
    [HEAD.bot + 0.012, 0.038, 0.040, 2.0],
  ];
  // 목은 수직이 아니라 **앞으로 10도쯤 기울어** 있다. 수직으로 세우면
  // 머리가 어깨 뒤에 얹혀 로봇처럼 보인다 (경추 전만).
  return loft(ringsFrom(keys, 12), 18, {
    capTop: false,
    capBottom: false,
    deform: (x, y, z) => [x, y, z + (y - (NECK_Y - 0.055)) * 0.17],
  });
}
