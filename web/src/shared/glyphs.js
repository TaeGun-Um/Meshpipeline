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

// 주사선. 간판이 "화면" 으로 읽히게 만든다 — 밝기를 주기적으로 눌러서
// 발광면이 통짜 색면이 되지 않게 한다.
function scanline(v, px) {
  return ((v * px) | 0) % 3 === 0 ? 0.72 : 1.0;
}

// 발광 간판의 픽셀 함수. 세 종류 간판이 이걸 공유한다.
//   glyphs  [열, 행] 글자 격자
//   margin  테두리 여백 (0..0.5)
//   px      세로 픽셀 수 (주사선 간격 계산용)
function signPainter(seed, scheme, glyphs, margin, px) {
  const ground = rgb255(scheme.ground);
  const glyph = rgb255(scheme.glyph);
  const edge = rgb255(scheme.edge);
  const grime = tiledFbm(seed + 3, 5, 3);
  const [gc, gr] = glyphs;

  return (u, v, o) => {
    const sl = scanline(v, px);
    const gm = grime(u, v);

    // 테두리 발광 띠
    const half = margin * 0.5;
    if (u < half || u > 1 - half || v < half || v > 1 - half) {
      o.c[0] = edge[0] * 0.12;
      o.c[1] = edge[1] * 0.12;
      o.c[2] = edge[2] * 0.12;
      o.r = 0.35;
      o.h = 0.7;
      o.e[0] = edge[0] * sl;
      o.e[1] = edge[1] * sl;
      o.e[2] = edge[2] * sl;
      return;
    }

    // 바탕
    o.c[0] = ground[0] + gm * 8;
    o.c[1] = ground[1] + gm * 8;
    o.c[2] = ground[2] + gm * 8;
    o.r = 0.42;
    o.h = 0.5;
    o.e[0] = ground[0] * 0.55 * sl;
    o.e[1] = ground[1] * 0.55 * sl;
    o.e[2] = ground[2] * 0.55 * sl;

    // 글자 영역
    const iu = (u - margin) / (1 - margin * 2);
    const iv = (v - margin) / (1 - margin * 2);
    if (iu < 0 || iu > 1 || iv < 0 || iv > 1) return;

    const cx = Math.min(gc - 1, Math.floor(iu * gc));
    const cy = Math.min(gr - 1, Math.floor(iv * gr));
    // 자간 — 글자 사이에 여백을 둔다
    const fx = (iu * gc - cx - 0.1) / 0.8;
    const fy = (iv * gr - cy - 0.1) / 0.8;
    if (fx < 0 || fx > 1 || fy < 0 || fy > 1) return;

    const id = (hash2(cx * 7 + seed, cy * 13 + seed) * 4096) | 0;
    if (!glyphInk(id, fx, fy)) return;

    o.c[0] = glyph[0] * 0.16;
    o.c[1] = glyph[1] * 0.16;
    o.c[2] = glyph[2] * 0.16;
    o.r = 0.3;
    o.h = 0.85;
    o.e[0] = glyph[0] * sl;
    o.e[1] = glyph[1] * sl;
    o.e[2] = glyph[2] * sl;
  };
}

// 텍스처 비율을 형상에 맞추는 것이 중요하다. 정방형으로 굽고 UV로 늘리면
// 글자가 찌그러진다.

// 가로 배너 (점포 위, 처마 밑)
export function bannerTextures(seed, scheme) {
  return bake([512, 128], 1, 1, signPainter(seed, scheme, [5, 1], 0.1, 128), {
    emissive: true,
  });
}

// 세로 간판 (벽에서 직각으로 돌출). 골목·거리의 깊이를 만드는 형태.
export function bladeTextures(seed, scheme) {
  return bake([128, 768], 1, 1, signPainter(seed, scheme, [1, 6], 0.12, 768), {
    emissive: true,
  });
}

// 대형 광고판 (타워 벽면). 글자를 크게 잡고 여백을 넓혀 "광고" 로 보이게.
export function billboardTextures(seed, scheme) {
  return bake([512, 512], 1, 1, signPainter(seed, scheme, [3, 3], 0.07, 512), {
    emissive: true,
  });
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
