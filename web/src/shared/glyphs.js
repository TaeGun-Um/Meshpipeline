// 표의문자 간판 — 폰트 없이.
//
// ── 왜 폰트를 쓰지 않는가 ──────────────────────────────────────────────────
// 외부 애셋 0개가 이 프로젝트의 전제다. 그리고 애초에 필요한 것이 "읽히는 글자"가
// 아니라 **빽빽한 표의문자 간판의 인상**이다.
//
// ── 어떻게 그렇게 보이는가 ─────────────────────────────────────────────────
// 한자·가나가 그렇게 보이는 이유는 획이 **셀 전체를 가로지르는 직선**이라는 점이다.
// 랜덤 픽셀을 뿌리면 노이즈로 보이고, 5x5 격자에서 "이 행은 가로획", "이 열은
// 세로획" 을 뽑아 통째로 채우면 田·目·王·書 같은 밀도가 나온다.
// 일부 글자에 바깥 테두리를 주면 国·回 계열이 섞인다.
import { bake, hash2 } from '../core/textures.js';
import { tiledFbm, clamp } from '../core/noise.js';
import { rgb255 } from './neon.js';

const GLYPH_N = 5;

// 글자 하나의 잉크 여부. id 가 글자 모양을 결정한다 (같은 id = 같은 글자).
function glyphInk(id, fx, fy) {
  const gx = Math.min(GLYPH_N - 1, Math.floor(fx * GLYPH_N));
  const gy = Math.min(GLYPH_N - 1, Math.floor(fy * GLYPH_N));
  const cfx = fx * GLYPH_N - gx;
  const cfy = fy * GLYPH_N - gy;

  // 최소 한 줄씩은 보장해서 빈 글자가 나오지 않게 한다
  const rowStroke = hash2(id * 131 + gy, 991) < 0.44 || gy === id % GLYPH_N;
  const colStroke = hash2(id * 577 + gx, 313) < 0.4 || gx === (id >> 3) % GLYPH_N;

  // 획 두께: 셀 중앙 40%
  if (rowStroke && cfy > 0.3 && cfy < 0.7) return 1;
  if (colStroke && cfx > 0.3 && cfx < 0.7) return 1;

  // 바깥 테두리를 가진 글자
  if (hash2(id * 97, 41) < 0.3) {
    const onEdge = gx === 0 || gx === GLYPH_N - 1 || gy === 0 || gy === GLYPH_N - 1;
    if (onEdge && cfx > 0.25 && cfx < 0.75 && cfy > 0.25 && cfy < 0.75) return 1;
  }
  return 0;
}

// ── 픽토그램 ───────────────────────────────────────────────────────────────
//
// ── 왜 필요한가 (사용자 지적) ──────────────────────────────────────────────
// "지금은 너무 갯수가 적고 색깔놀이임, 감성이 없어"
//
// 레퍼런스와 대조하니 빠진 것이 **색이 아니라 내용**이었다. 레퍼런스의 간판은
// 전부 무엇을 파는지 말하고 있다 — 라멘 그릇, 의체 옆얼굴, 칵테일잔, 잉어,
// 칩·렌치·헤드폰. 지금 간판은 추상 글리프 격자뿐이라 **무엇을 파는지 말하지
// 않는다.** 그게 "색깔놀이" 의 정체다.
//
// ── 어떻게 그리는가 ────────────────────────────────────────────────────────
// 네온은 **면이 아니라 선**이다. 채우면 스티커가 되고 선으로 그려야 튜브가
// 된다. 그래서 거리장(SDF)으로 도형까지의 거리를 구하고 그 거리가 얇은
// 띠 안일 때만 잉크를 놓는다. 이러면 굵기를 한 값으로 조절할 수 있고,
// 안쪽에 더 밝은 심(core)을 넣어 진짜 유리관처럼 보이게 할 수 있다.
const F = Math.hypot;

function sdSeg(u, v, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const t = Math.max(0, Math.min(1, ((u - ax) * dx + (v - ay) * dy) / (dx * dx + dy * dy || 1e-6)));
  return F(u - ax - dx * t, v - ay - dy * t);
}
const sdCircle = (u, v, cx, cy, r) => Math.abs(F(u - cx, v - cy) - r);

// 호 — 원까지의 거리를 구하되 각도 구간 밖이면 끝점까지의 거리로 잇는다.
// 이렇게 안 하면 호가 원 전체로 이어져 그릇이 접시가 된다.
function sdArc(u, v, cx, cy, r, a0, a1) {
  let a = Math.atan2(v - cy, u - cx);
  if (a < 0) a += Math.PI * 2;
  let s = a0;
  let e = a1;
  if (e < s) e += Math.PI * 2;
  if (a < s) a += Math.PI * 2;
  if (a >= s && a <= e) return Math.abs(F(u - cx, v - cy) - r);
  const p0 = [cx + Math.cos(s) * r, cy + Math.sin(s) * r];
  const p1 = [cx + Math.cos(e) * r, cy + Math.sin(e) * r];
  return Math.min(F(u - p0[0], v - p0[1]), F(u - p1[0], v - p1[1]));
}
const sdBox = (u, v, cx, cy, hw, hh) => {
  const dx = Math.abs(u - cx) - hw;
  const dy = Math.abs(v - cy) - hh;
  return Math.abs(Math.max(dx, dy)); // 테두리까지의 거리 (근사)
};

// ── 열 가지 업종 ───────────────────────────────────────────────────────────
//
// 좌표계는 픽토그램 칸 안에서 0..1 이다. 각 함수는 **선까지의 거리**를 준다.
//
// 종류를 고를 때 기준은 "이 도시에 있을 법한 가게" 다. 레퍼런스의 목록이
// 그대로 답이었다 — 라멘·의체·바·호텔·전자·약국·클럽·정비·전당·국수.
const PICTS = [
  // 0 라멘 — 그릇 + 면 + 젓가락 + 김
  (u, v) => Math.min(
    sdArc(u, v, 0.5, 0.46, 0.30, 0.05, Math.PI - 0.05),
    sdSeg(u, v, 0.18, 0.46, 0.82, 0.46),
    sdSeg(u, v, 0.62, 0.16, 0.86, 0.40),
    sdSeg(u, v, 0.68, 0.14, 0.90, 0.36),
    sdArc(u, v, 0.40, 0.16, 0.07, 0.9, 3.9),
    sdArc(u, v, 0.55, 0.12, 0.07, 3.9, 0.9)
  ),
  // 1 의체 — 옆얼굴 윤곽 + 렌즈 + 접속 단자
  (u, v) => Math.min(
    sdArc(u, v, 0.46, 0.44, 0.30, 1.5, 5.1),
    sdSeg(u, v, 0.30, 0.70, 0.62, 0.72),
    sdCircle(u, v, 0.58, 0.40, 0.075),
    sdCircle(u, v, 0.58, 0.40, 0.025),
    sdSeg(u, v, 0.24, 0.30, 0.18, 0.24),
    sdSeg(u, v, 0.24, 0.42, 0.16, 0.42)
  ),
  // 2 바 — 칵테일잔 + 올리브 + 꽂이
  (u, v) => Math.min(
    sdSeg(u, v, 0.24, 0.20, 0.76, 0.20),
    sdSeg(u, v, 0.24, 0.20, 0.50, 0.54),
    sdSeg(u, v, 0.76, 0.20, 0.50, 0.54),
    sdSeg(u, v, 0.50, 0.54, 0.50, 0.78),
    sdSeg(u, v, 0.34, 0.80, 0.66, 0.80),
    sdCircle(u, v, 0.62, 0.30, 0.05)
  ),
  // 3 잉어 — 몸통 + 꼬리 + 눈 + 지느러미
  (u, v) => Math.min(
    sdArc(u, v, 0.46, 0.50, 0.26, 0.0, Math.PI),
    sdArc(u, v, 0.46, 0.50, 0.26, Math.PI, Math.PI * 2),
    sdSeg(u, v, 0.72, 0.50, 0.92, 0.32),
    sdSeg(u, v, 0.72, 0.50, 0.92, 0.68),
    sdSeg(u, v, 0.92, 0.32, 0.92, 0.68),
    sdCircle(u, v, 0.30, 0.44, 0.035)
  ),
  // 4 전자 — 칩 + 다리
  (u, v) => {
    let d = sdBox(u, v, 0.5, 0.5, 0.22, 0.22);
    for (let i = 0; i < 3; i++) {
      const t = 0.34 + i * 0.16;
      d = Math.min(d,
        sdSeg(u, v, 0.28, t, 0.16, t),
        sdSeg(u, v, 0.72, t, 0.84, t),
        sdSeg(u, v, t, 0.28, t, 0.16),
        sdSeg(u, v, t, 0.72, t, 0.84));
    }
    return d;
  },
  // 5 안구 이식 — 눈 윤곽 + 홍채 + 조준환
  (u, v) => Math.min(
    sdArc(u, v, 0.5, 0.72, 0.40, 3.6, 5.8),
    sdArc(u, v, 0.5, 0.28, 0.40, 0.5, 2.7),
    sdCircle(u, v, 0.5, 0.5, 0.13),
    sdCircle(u, v, 0.5, 0.5, 0.045),
    sdSeg(u, v, 0.5, 0.02, 0.5, 0.12),
    sdSeg(u, v, 0.5, 0.88, 0.5, 0.98)
  ),
  // 6 약국 — 캡슐 + 십자
  (u, v) => Math.min(
    sdArc(u, v, 0.34, 0.66, 0.16, Math.PI * 0.75, Math.PI * 1.75),
    sdArc(u, v, 0.58, 0.42, 0.16, Math.PI * 1.75, Math.PI * 0.75),
    sdSeg(u, v, 0.23, 0.55, 0.47, 0.31),
    sdSeg(u, v, 0.45, 0.77, 0.69, 0.53),
    sdSeg(u, v, 0.74, 0.74, 0.94, 0.74),
    sdSeg(u, v, 0.84, 0.64, 0.84, 0.84)
  ),
  // 7 클럽 — 스피커 + 음파
  (u, v) => Math.min(
    sdBox(u, v, 0.34, 0.5, 0.16, 0.28),
    sdCircle(u, v, 0.34, 0.58, 0.09),
    sdCircle(u, v, 0.34, 0.34, 0.04),
    sdArc(u, v, 0.52, 0.5, 0.18, -1.0, 1.0),
    sdArc(u, v, 0.52, 0.5, 0.30, -0.9, 0.9),
    sdArc(u, v, 0.52, 0.5, 0.42, -0.8, 0.8)
  ),
  // 8 정비 — 렌치 + 볼트
  (u, v) => Math.min(
    sdSeg(u, v, 0.26, 0.74, 0.66, 0.34),
    sdArc(u, v, 0.74, 0.26, 0.13, 2.0, 5.6),
    sdCircle(u, v, 0.26, 0.74, 0.10),
    sdCircle(u, v, 0.26, 0.74, 0.035)
  ),
  // 9 호텔 — 침대 + 지붕
  (u, v) => Math.min(
    sdSeg(u, v, 0.16, 0.62, 0.84, 0.62),
    sdSeg(u, v, 0.16, 0.62, 0.16, 0.80),
    sdSeg(u, v, 0.84, 0.62, 0.84, 0.80),
    sdSeg(u, v, 0.16, 0.50, 0.42, 0.50),
    sdArc(u, v, 0.30, 0.44, 0.09, Math.PI, Math.PI * 2),
    sdSeg(u, v, 0.14, 0.26, 0.50, 0.10),
    sdSeg(u, v, 0.50, 0.10, 0.86, 0.26)
  ),
];

// 픽토그램 잉크. 바깥은 관, 안쪽은 더 밝은 심.
//
// 심을 넣는 이유: 균일한 굵기로 그리면 "선" 이지 "네온" 이 아니다. 실제
// 네온관은 가운데가 타서 하얗고 가장자리로 갈수록 색이 진해진다. 값 두 개로
// 그 인상이 난다.
// 굵기는 **고정값**이다. 처음에 테두리 관 굵기에서 유도했더니
// (tube*1.5/박스폭) 박스가 작을수록 선이 굵어져 그림이 덩어리로 뭉갰다.
// 선화는 박스 크기와 무관하게 같은 비율의 선이어야 한다.
const PICT_W = 0.042;

// 밖으로 내보낸다 — **점포 정면도 같은 어휘를 써야 한다.**
// 간판만 픽토그램을 갖고 점포 정면은 단색 띠면, 화면 면적의 대부분은
// 여전히 아무 말도 하지 않는다 (실제로 그랬다: 사용자가 "간판 바꿨다며?
// 바뀐게 없는데" 라고 했고, 화면을 덮은 것은 점포 정면이었다).
export const PICT_COUNT = 10;
export function pictAt(id, u, v, w = PICT_W) {
  if (u < 0 || u > 1 || v < 0 || v > 1) return 0;
  const d = PICTS[id % PICTS.length](u, v);
  if (d > w) return 0;
  return d < w * 0.40 ? 2 : 1;
}
export function glyphAt(id, fx, fy) {
  return glyphInk(id, fx, fy);
}
export function latinAt(seed, u, v, cols) {
  return latinInk(seed, u, v, cols);
}

function pictInk(id, u, v) {
  if (u < 0 || u > 1 || v < 0 || v > 1) return 0;
  const d = PICTS[id % PICTS.length](u, v);
  if (d > PICT_W) return 0;
  return d < PICT_W * 0.40 ? 2 : 1; // 2 = 심, 1 = 관
}

// ── 네온 튜브 테두리 ───────────────────────────────────────────────────────
//
// 레퍼런스의 간판은 예외 없이 **테두리가 관**이다. 그냥 밝은 띠를 두르면
// 액자이고, 두 줄로 두르면 관이 된다.
//
// ── 좌표는 UV 가 아니라 물리 단위로 (실측으로 고침) ────────────────────────
// 처음에 u·v 정규좌표로 거리를 쟀다. 그런데 세로 간판은 128x768, 즉 1:6 이라
// **가로 관이 세로 관보다 6배 굵어졌다.** 텍스처를 ASCII 로 찍어 보니
// 테두리가 간판 절반을 먹고 있었다.
//
// 그래서 짧은 변을 1 로 놓은 좌표(pu, pv)를 쓴다. 배너는 pu 0..4,
// 세로 간판은 pv 0..6, 광고판은 둘 다 0..1 이다. 이 좌표에서는 거리가
// 등방이라 관 굵기·픽토그램 모양이 비율과 무관해진다.
function frameInk(pu, pv, W, H, m, w) {
  const outer = Math.min(pu, pv, W - pu, H - pv);
  if (Math.abs(outer - m) < w) return 2;
  if (Math.abs(outer - (m + w * 3.4)) < w * 0.62) return 1;
  return 0;
}

// ── 전구 테두리 ────────────────────────────────────────────────────────────
//
// 관이 아니라 **점점이 박힌 전구**. 극장·파칭코·오래된 상가의 어휘다.
// 관과 결정적으로 다른 점은 사이가 비어 있다는 것이고, 그래서 멀리서도
// "이건 다른 종류의 간판" 으로 갈린다.
function bulbInk(pu, pv, W, H, m, w) {
  const dL = pu, dR = W - pu, dB = pv, dT = H - pv;
  const outer = Math.min(dL, dR, dB, dT);
  if (Math.abs(outer - (m + w * 1.3)) > w * 1.25) return 0;
  // 가장 가까운 변을 따라가는 좌표 — 네 변을 한 줄로 편다
  const t = outer === dL || outer === dR ? pv : pu;
  const P = w * 5.4;                        // 전구 간격
  const f = Math.abs(((t / P) % 1) - 0.5);  // 0 이 전구 한복판
  if (f > 0.27) return 0;
  return f < 0.13 ? 2 : 1;
}

// ── 라틴 문자 줄 ───────────────────────────────────────────────────────────
//
// 레퍼런스의 간판은 큰 표의문자 아래 **작은 로마자 줄**이 반드시 있다
// (KIROSHI OPTICALS · MIRAI RAMEN · BETTER BODY. BETTER LIFE.).
// 이 거리에서 글자는 안 읽히므로 폭이 제각각인 막대의 줄로 충분하다 —
// 중요한 것은 **글자 위계가 있다는 사실**이지 내용이 아니다.
function latinInk(seed, u, v, cols) {
  if (v < 0.28 || v > 0.72) return 0;
  const i = Math.floor(u * cols);
  if (i < 0 || i >= cols) return 0;
  const f = u * cols - i;
  const h = hash2(seed * 31 + i, 7);
  if (h < 0.18) return 0;              // 단어 사이 공백
  const w = 0.34 + h * 0.42;           // 글자 폭이 제각각이어야 글로 보인다
  return f > 0.12 && f < 0.12 + w ? 1 : 0;
}

// 주사선. 간판이 "화면" 으로 읽히게 만든다 — 밝기를 주기적으로 눌러서
// 발광면이 통짜 색면이 되지 않게 한다.
function scanline(v, px) {
  return ((v * px) | 0) % 3 === 0 ? 0.72 : 1.0;
}

// ── 간판 하나를 그린다 ─────────────────────────────────────────────────────
//
// 구성이 레퍼런스와 같아야 한다. 셋을 쌓는다.
//
//   1) 네온 튜브 테두리   (frameInk)
//   2) 픽토그램 + 큰 표의문자   무엇을 파는가
//   3) 작은 라틴 줄            글자 위계
//
// layout 은 그 셋을 어떻게 배치할지다. 가로 배너·세로 간판·광고판이
// 서로 다른 배치를 갖는다 — 세로 간판을 가로 간판 돌려서 만들면
// 픽토그램이 눕고 글자 순서가 어긋난다.
//
// ── 화법 (사용자 지적으로 추가) ────────────────────────────────────────────
//
// "간판도 종류를 더 늘려봐라 너무 적어서 똑같은거밖에 없어 / 똑같은거 계속
//  반복되니까 지루하고 현학적이네"
//
// 맞았다. 종류는 일곱인데 **화법이 하나**였다 — 어두운 판 + 네온 관 테두리 +
// 픽토그램 + 글자. 비율만 다르고 그리는 법이 같으니 결국 다 같은 간판이다.
//
// 배색을 늘려도 안 고쳐진다. 색이 여섯이어도 구성이 같으면 같아 보인다 —
// 실제로 이미 여섯이었고, 그런데도 "똑같은거밖에 없어" 라는 말이 나왔다.
// 늘려야 하는 것은 색이 아니라 **판을 그리는 법**이다.
//
//   tube     어두운 판에 네온 관. 지금까지의 것
//   panel    거꾸로다 — 판이 통째로 빛나고 글자가 **검다**. 아크릴 라이트박스
//   marquee  테두리가 이어진 관이 아니라 전구 점점이. 극장·파칭코
//   split    머리에 색 띠가 얹히고 몸은 어둡다. 상호 + 업종
export const SIGN_STYLES = ['tube', 'panel', 'marquee', 'split'];

function signPainter(seed, scheme, layout, size, style = 'tube') {
  const ground = rgb255(scheme.ground);
  const glyph = rgb255(scheme.glyph);
  const edge = rgb255(scheme.edge);
  const litPlate = style === 'panel';   // 판이 빛나고 글자가 어둡다
  const bulbs = style === 'marquee';
  const banded = style === 'split';
  const grime = tiledFbm(seed + 3, 5, 3);
  const trade = (hash2(seed * 17, 3) * PICTS.length) | 0;

  // 짧은 변을 1 로 놓은 물리 좌표. 배치는 전부 이 단위로 적는다.
  const [sw, sh] = size;
  const S = Math.min(sw, sh);
  const W = sw / S;
  const H = sh / S;
  const M = layout.margin;
  const TW = layout.tube;

  // 잉크를 놓는 헬퍼. lvl 2 = 관의 심(더 밝고 희다), 1 = 관
  const put = (o, col, lvl, sl) => {
    const k = lvl === 2 ? 1.0 : 0.70;
    // 심은 흰색으로 뜬다 — 실제 네온관의 가운데가 그렇다
    const wash = lvl === 2 ? 0.42 : 0;
    o.c[0] = col[0] * 0.16; o.c[1] = col[1] * 0.16; o.c[2] = col[2] * 0.16;
    o.r = 0.3; o.h = 0.85;
    o.e[0] = (col[0] * k + 255 * wash) * sl;
    o.e[1] = (col[1] * k + 255 * wash) * sl;
    o.e[2] = (col[2] * k + 255 * wash) * sl;
  };
  // 빛나는 판 위의 글자는 **빛을 빼서** 그린다. 발광면에서 유일한 '어둠' 이다
  const cut = (o) => {
    o.c[0] = 10; o.c[1] = 10; o.c[2] = 12;
    o.r = 0.55; o.h = 0.35;
    o.e[0] = 0; o.e[1] = 0; o.e[2] = 0;
  };
  // 화법에 따라 잉크를 놓는 법이 갈린다. 여기서 한 번만 갈라 두면 아래는
  // 배치만 신경 쓰면 된다 — 화법마다 그리기 코드를 복사하면 반드시 어긋난다
  const ink = (o, col, lvl, sl) => (litPlate ? cut(o) : put(o, col, lvl, sl));

  // 상자 [x, y, w, h] 안의 지역 좌표. 밖이면 null
  const local = (pu, pv, B) => {
    const lu = (pu - B[0]) / B[2];
    const lv = (pv - B[1]) / B[3];
    return lu >= 0 && lu <= 1 && lv >= 0 && lv <= 1 ? [lu, lv] : null;
  };

  return (u, v, o) => {
    const pu = u * W;
    const pv = v * H;
    const sl = scanline(v, sh);
    const gm = grime(u, v);

    // ── 바탕 ────────────────────────────────────────────────────────────
    if (litPlate) {
      // 판이 곧 빛이다. 아크릴 라이트박스 — 뒤에서 형광등이 비친다.
      // 얼룩(gm)을 남기는 이유는 통짜 색면이 되면 종이로 보이기 때문이다.
      const k = 0.86 + gm * 0.14;
      o.c[0] = glyph[0] * 0.22; o.c[1] = glyph[1] * 0.22; o.c[2] = glyph[2] * 0.22;
      o.r = 0.36; o.h = 0.3;
      o.e[0] = glyph[0] * k * sl; o.e[1] = glyph[1] * k * sl; o.e[2] = glyph[2] * k * sl;
    } else {
      // 어둡다. 네온은 어두운 판 위에 있어야 네온이다
      o.c[0] = ground[0] + gm * 8;
      o.c[1] = ground[1] + gm * 8;
      o.c[2] = ground[2] + gm * 8;
      o.r = 0.42; o.h = 0.5;
      o.e[0] = ground[0] * 0.5 * sl;
      o.e[1] = ground[1] * 0.5 * sl;
      o.e[2] = ground[2] * 0.5 * sl;
      // 머리 띠 — 긴 변을 따라 위쪽 일부를 색으로 채운다. 상호 + 업종의 위계
      if (banded) {
        const head = W > H ? pv < H * 0.30 : pu < W * 0.26;
        if (head) {
          o.c[0] = edge[0] * 0.2; o.c[1] = edge[1] * 0.2; o.c[2] = edge[2] * 0.2;
          o.e[0] = edge[0] * 0.8 * sl; o.e[1] = edge[1] * 0.8 * sl; o.e[2] = edge[2] * 0.8 * sl;
        }
      }
    }

    // ── 1) 테두리 ───────────────────────────────────────────────────────
    if (bulbs) {
      const bi = bulbInk(pu, pv, W, H, M, TW);
      if (bi) { put(o, edge, bi, sl); return; }
    } else {
      const fi = frameInk(pu, pv, W, H, M, TW);
      // 빛나는 판에서는 테두리도 **어두운 홈**이다. 밝은 위에 밝은 것은 안 보인다
      if (fi) { litPlate ? cut(o) : put(o, edge, fi, sl); return; }
    }

    // 2) 픽토그램 — 무엇을 파는가
    if (layout.pict) {
      const L = local(pu, pv, layout.pict);
      if (L) {
        const pi = pictInk(trade + seed, L[0], L[1]);
        if (pi) ink(o, glyph, pi, sl);
        return;
      }
    }

    // 3) 라틴 줄 — 글자 위계
    for (let i = 0; i < (layout.latin || []).length; i++) {
      const B = layout.latin[i];
      const L = local(pu, pv, B);
      if (L) {
        if (latinInk(seed + 13 * (i + 1), L[0], L[1], B[4])) ink(o, edge, 1, sl);
        return;
      }
    }

    // 4) 큰 표의문자
    if (!layout.glyphBox) return;
    const G = local(pu, pv, layout.glyphBox);
    if (!G) return;
    const [gc, gr] = layout.cells;
    const cx = Math.min(gc - 1, Math.floor(G[0] * gc));
    const cy = Math.min(gr - 1, Math.floor(G[1] * gr));
    const fx = (G[0] * gc - cx - 0.08) / 0.84;
    const fy = (G[1] * gr - cy - 0.08) / 0.84;
    if (fx < 0 || fx > 1 || fy < 0 || fy > 1) return;

    const id = (hash2(cx * 7 + seed, cy * 13 + seed) * 4096) | 0;
    if (!glyphInk(id, fx, fy)) return;
    ink(o, glyph, 2, sl);
  };
}

// 배치는 [x, y, 폭, 높이] — **짧은 변을 1 로 놓은 물리 좌표**다.
// 그래야 픽토그램이 안 눕고 관 굵기가 비율과 무관해진다.

// 가로 배너 (점포 위, 처마 밑). pu 0..4 · pv 0..1
// 픽토그램 왼쪽 정사각, 큰 글자 넉 자, 아래 라틴 줄.
export function bannerTextures(seed, scheme, style) {
  const size = [512, 128];
  return bake(size, 1, 1, signPainter(seed, scheme, {
    margin: 0.06, tube: 0.020,
    pict: [0.13, 0.13, 0.74, 0.74],
    glyphBox: [1.02, 0.06, 2.86, 0.58],
    cells: [4, 1],
    latin: [[1.02, 0.68, 2.86, 0.22, 15]],
  }, size, style), { emissive: true });
}

// 세로 간판 (벽에서 직각으로 돌출). pu 0..1 · pv 0..6
// 위 픽토그램, 가운데 문자 스택, 아래 라틴 — 레퍼런스의 세로 간판 문법.
export function bladeTextures(seed, scheme, style) {
  const size = [128, 768];
  return bake(size, 1, 1, signPainter(seed, scheme, {
    margin: 0.06, tube: 0.020,
    pict: [0.14, 0.16, 0.72, 0.72],
    glyphBox: [0.06, 1.05, 0.88, 4.30],
    cells: [1, 4],
    latin: [[0.10, 5.48, 0.80, 0.38, 6]],
  }, size, style), { emissive: true });
}

// 대형 광고판 (타워 벽면). pu 0..1 · pv 0..1
// 글자를 크게 잡고 라틴 두 줄로 위계를 만든다.
export function billboardTextures(seed, scheme, style) {
  const size = [512, 512];
  return bake(size, 1, 1, signPainter(seed, scheme, {
    margin: 0.045, tube: 0.013,
    pict: [0.60, 0.08, 0.32, 0.32],
    glyphBox: [0.08, 0.08, 0.46, 0.36],
    cells: [2, 2],
    latin: [
      [0.08, 0.52, 0.84, 0.13, 15],
      [0.08, 0.70, 0.58, 0.08, 21],
    ],
  }, size, style), { emissive: true });
}

// ── 새 유형 셋 (사용자 지적) ───────────────────────────────────────────────
//
// "간판 종류가 너무 부족한거같은데. 다양하게 늘렸으면 좋겠고, 크기랑 모양도
//  너무 돌려쓰지말고 새로운 간판 타입을 만들어서 썼으면 좋겠음"
//
// 맞았다. 지금까지 넷(배너·세로·광고판·인물)뿐이었고, 화면에 보이는 다양함은
// 배색 여섯 가지가 만든 것이었다. **같은 판을 색만 바꿔 돌려쓴 것**이다.
//
// 새 유형은 비율부터 다르게 잡는다. 비율이 같으면 결국 같은 판이다.
//
//   전광판 띠  16:1  아주 길다. **긴 파사드용으로 태어난 유형**이라
//                    늘어나지 않는다. 지금까지는 배너를 늘려서 이 자리를 때웠다
//   상자간판    1:1  두께가 있다. 정면과 양 옆에 같은 얼굴이 붙는다
//   천 배너     1:4  세로로 긴 천. 위에 봉이 지나가고 아래가 갈라진다

// 전광판 띠 — 흐르는 문자열. 픽토그램 없이 글자만 길게 간다.
// 실제로도 이런 띠에는 그림이 안 들어간다 — 한 줄로 흐르는 글자가 전부다.
export function stripTextures(seed, scheme, style) {
  const size = [1024, 64];
  return bake(size, 1, 1, signPainter(seed, scheme, {
    margin: 0.09, tube: 0.028,
    // 물리 좌표에서 pu 0..16 · pv 0..1
    glyphBox: [0.55, 0.14, 6.4, 0.72],
    cells: [8, 1],
    latin: [[7.4, 0.22, 8.1, 0.30, 44]],
  }, size, style), { emissive: true });
}

// 상자간판 — 벽에서 튀어나온 입방체. 텍스처는 정사각이고 **세 면에 같은 것**이
// 붙는다. 옆에서 걸어와도 읽히는 것이 이 유형의 값어치다.
export function boxTextures(seed, scheme, style) {
  const size = [256, 256];
  return bake(size, 1, 1, signPainter(seed, scheme, {
    margin: 0.08, tube: 0.026,
    pict: [0.20, 0.10, 0.60, 0.44],
    glyphBox: [0.10, 0.60, 0.80, 0.30],
    cells: [2, 1],
  }, size, style), { emissive: true });
}

// 천 배너 — 세로로 긴 천. 봉에 매달려 있어 아래가 흔들린다.
// 발광이 약하다 — 천은 스스로 빛나지 않고 뒤에서 비추는 것이라, 이 하나만
// 어둡게 두면 네온 사이에서 오히려 눈에 띈다.
export function clothTextures(seed, scheme, style) {
  const size = [128, 512];
  return bake(size, 1, 1, signPainter(seed, scheme, {
    margin: 0.10, tube: 0.016,
    glyphBox: [0.12, 0.30, 0.76, 2.90],
    cells: [1, 3],
    latin: [[0.14, 3.36, 0.72, 0.30, 5]],
  }, size, style), { emissive: true });
}

// ── 초대형 인물 광고판 ─────────────────────────────────────────────────────
//
// 나이트시티의 얼굴이다. 타워 한 면을 20~60m 세로로 덮는 인물 광고.
// 이게 없으면 아무리 네온을 깔아도 "네온 켜진 도시" 지 "나이트시티" 가 아니다.
//
// ── 얼굴을 절차적으로 그리는 법 ────────────────────────────────────────────
// 사실적인 초상은 불가능하고 필요하지도 않다. 실제 게임의 광고판도 하프톤으로
// 뭉개진 2색 이미지다. 필요한 건 **머리·머리카락·어깨의 실루엣과 눈의 위치**뿐이고,
// 그 넷만 맞으면 사람 얼굴로 읽힌다.
//
// 타원 몇 개를 겹쳐 마스크를 만들고, 하프톤 점무늬로 밝기를 끊고, 주사선을 얹는다.
// 하프톤이 중요하다 — 매끈한 그라디언트로 두면 얼굴의 어색함이 그대로 보이지만,
// 점으로 끊으면 "인쇄된 광고" 로 읽혀서 오히려 설득력이 생긴다.
function ellipse(u, v, cx, cy, rx, ry) {
  const dx = (u - cx) / rx;
  const dy = (v - cy) / ry;
  return dx * dx + dy * dy; // <1 이면 안쪽
}

export function portraitTextures(seed, scheme) {
  const glyph = rgb255(scheme.glyph);
  const edge = rgb255(scheme.edge);
  const ground = rgb255(scheme.ground);
  const grain = tiledFbm(seed + 9, 26, 3);
  const H = 1024;
  const W = 512;

  // 개체마다 얼굴 비율을 조금씩 바꿔 같은 사람이 반복되지 않게 한다
  const faceY = 0.64 + (hash2(seed, 11) - 0.5) * 0.04;
  const faceR = 0.24 + (hash2(seed, 23) - 0.5) * 0.05;
  const hairSpread = 1.16 + hash2(seed, 37) * 0.22;

  return bake(
    [W, H],
    1,
    1,
    (u, v, o) => {
      const gn = grain(u, v);
      const sl = scanline(v, H);
      // v=0 이 위다 (core/textures.js 의 bake 주석). 아래에서 쌓는 레이아웃이라 뒤집는다.
      const up = 1 - v;

      // 테두리 프레임
      const m = 0.035;
      if (u < m || u > 1 - m || up < m * 0.5 || up > 1 - m * 0.5) {
        o.c[0] = edge[0] * 0.12;
        o.c[1] = edge[1] * 0.12;
        o.c[2] = edge[2] * 0.12;
        o.r = 0.4;
        o.h = 0.8;
        o.e[0] = edge[0] * sl;
        o.e[1] = edge[1] * sl;
        o.e[2] = edge[2] * sl;
        return;
      }

      // 아래 12% 는 글자 띠 (상품명)
      if (up < 0.12) {
        const t = up / 0.12;
        const inRow = t > 0.25 && t < 0.75;
        let ink = 0;
        if (inRow) {
          const cols = 4;
          const cu = (u - 0.1) / 0.8;
          if (cu > 0 && cu < 1) {
            const ci = Math.min(cols - 1, Math.floor(cu * cols));
            const fx = (cu * cols - ci - 0.12) / 0.76;
            const fy = (t - 0.25) / 0.5;
            if (fx > 0 && fx < 1) {
              const id = (hash2(ci * 5 + seed, 71) * 4096) | 0;
              ink = glyphInk(id, fx, fy);
            }
          }
        }
        const c = ink ? glyph : ground;
        const k = ink ? 1 : 0.35;
        o.c[0] = c[0] * 0.15;
        o.c[1] = c[1] * 0.15;
        o.c[2] = c[2] * 0.15;
        o.r = 0.4;
        o.h = 0.5;
        o.e[0] = c[0] * k * sl;
        o.e[1] = c[1] * k * sl;
        o.e[2] = c[2] * k * sl;
        return;
      }

      // ── 인물 마스크 ──
      // 세로로 긴 판이라 위쪽 좌표를 얼굴 영역(0.12~1.0)으로 다시 정규화한다
      const fv = (up - 0.12) / 0.88;

      const head = ellipse(u, fv, 0.5, faceY, faceR, faceR * 1.15);
      const hair = ellipse(u, fv, 0.5, faceY + faceR * 0.2, faceR * hairSpread, faceR * 1.4);
      // 어깨 — 아래쪽에서 넓게 퍼지는 타원
      const body = ellipse(u, fv, 0.5, faceY - faceR * 1.75, faceR * 2.2, faceR * 1.5);

      let level = 0;
      let tint = ground;

      if (head < 1) {
        // 얼굴: 가장자리로 갈수록 어두워지는 명암 (구면 음영 흉내)
        tint = glyph;
        level = 0.98 - Math.sqrt(head) * 0.34;
        // 눈썹 — 눈 위 어두운 띠. 이게 있으면 얼굴이 훨씬 사람처럼 읽힌다.
        const by = faceY + faceR * 0.3;
        for (const s of [-1, 1]) {
          if (ellipse(u, fv, 0.5 + s * faceR * 0.38, by, faceR * 0.3, faceR * 0.05) < 1) {
            level *= 0.45;
          }
        }
        // 눈 — 가로로 긴 타원 둘. 새카맣게 두면 마스크처럼 보여서 0.3 으로 남긴다.
        const ey = faceY + faceR * 0.12;
        for (const s of [-1, 1]) {
          if (ellipse(u, fv, 0.5 + s * faceR * 0.38, ey, faceR * 0.26, faceR * 0.1) < 1) {
            level *= 0.3;
          }
        }
        // 코 그림자 — 세로로 가는 띠
        if (ellipse(u, fv, 0.5, faceY - faceR * 0.2, faceR * 0.09, faceR * 0.3) < 1) {
          level *= 0.82;
        }
        // 입
        if (ellipse(u, fv, 0.5, faceY - faceR * 0.58, faceR * 0.3, faceR * 0.08) < 1) {
          level *= 0.5;
        }
      } else if (hair < 1) {
        // 머리카락: 얼굴보다 어둡고 채도가 다른 색
        tint = edge;
        level = 0.62 - Math.sqrt(hair) * 0.3;
        // 머리카락 결 — 세로 줄무늬
        level *= 0.7 + 0.3 * Math.abs(Math.sin(u * Math.PI * 46 + fv * 6));
      } else if (body < 1) {
        tint = edge;
        level = 0.34 - Math.sqrt(body) * 0.14;
      } else {
        // 배경: 위쪽이 밝은 그라디언트
        tint = ground;
        level = 0.25 + fv * 0.5;
      }

      // ── 하프톤 ──
      // 점 격자에서 각 점의 반지름을 밝기로 정한다. 밝을수록 점이 커진다.
      const DOT = 96; // 세로 점 개수
      const du = u * DOT * (W / H) * 2;
      const dv = fv * DOT;
      const cellU = du - Math.floor(du) - 0.5;
      const cellV = dv - Math.floor(dv) - 0.5;
      const dist = Math.hypot(cellU, cellV) * 2;
      const radius = Math.sqrt(clamp(level, 0, 1)) * 1.15;
      const dot = dist < radius ? 1 : 0;

      const e = dot * clamp(level, 0, 1) * (0.85 + gn * 0.3) * sl;
      o.c[0] = tint[0] * 0.12;
      o.c[1] = tint[1] * 0.12;
      o.c[2] = tint[2] * 0.12;
      o.r = 0.42;
      o.h = 0.5;
      o.e[0] = clamp(tint[0] * e, 0, 255);
      o.e[1] = clamp(tint[1] * e, 0, 255);
      o.e[2] = clamp(tint[2] * e, 0, 255);
    },
    { emissive: true }
  );
}
