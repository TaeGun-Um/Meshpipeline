// 이 시설의 재질 레시피. 굽는 방식은 core/textures.js 가 맡고, 여기는 "무엇을".
//
// ── 팔레트의 근거 ──────────────────────────────────────────────────────────
// 90년대 후반 기관 건물의 색이다 — 베이지·연회색·청록. 채도가 낮고, 때가 타
// 있고, 형광등 아래서 보는 것을 전제로 한다. 레퍼런스가 저폴리에 거친 텍스처를
// 쓰는 이유도 같다: 형태로 못 내는 나이를 표면으로 낸다.
//
// **모든 텍스처는 미터 단위로 반복한다.** 벽이 3m 든 18m 든 얼룩의 크기가
// 같아야 한다 (metricBox 가 UV 를 그렇게 굽는다).
import { bake, hash2 } from '../../core/textures.js';
import { tiledFbm, lerp, clamp, smoothstep } from '../../core/noise.js';

// ── 바닥 ───────────────────────────────────────────────────────────────────

// 비닐 타일. 30cm 격자에 얼룩덜룩한 반점, 이음매마다 때.
export function vinylTextures(seed = 4101, tint = [196, 192, 180]) {
  const fleck = tiledFbm(seed, 140, 2);
  const blot = tiledFbm(seed + 1, 5, 3);
  const grime = tiledFbm(seed + 2, 11, 4);

  // 512 에 타일 4x4 = 한 칸 128px. 반복 간격은 재질 쪽에서 준다.
  return bake(512, 1, 1, (u, v, o) => {
    const gx = Math.floor(u * 4);
    const gy = Math.floor(v * 4);
    const fu = u * 4 - gx;
    const fv = v * 4 - gy;

    // 칸마다 아주 조금씩 다른 색 — 같은 로트라도 완전히 같지는 않다
    const t = (hash2(gx, gy) - 0.5) * 10;
    const f = fleck(u, v);
    const b = blot(u, v);
    let r = tint[0] + t + (f - 0.5) * 26 + (b - 0.5) * 12;
    let g = tint[1] + t + (f - 0.5) * 24 + (b - 0.5) * 12;
    let bl = tint[2] + t + (f - 0.5) * 22 + (b - 0.5) * 10;

    let rough = 0.42 + (1 - f) * 0.14;
    let h = 0.55;

    // 이음매 — 색만 어둡게 하면 줄을 그은 것이다. 높이도 같이 내린다.
    const seam = Math.min(Math.min(fu, 1 - fu), Math.min(fv, 1 - fv));
    if (seam < 0.03) {
      const k = 1 - seam / 0.03;
      r = lerp(r, 128, k * 0.55);
      g = lerp(g, 126, k * 0.55);
      bl = lerp(bl, 120, k * 0.55);
      h -= 0.3 * k;
      rough += 0.2 * k;
    }

    // 사람이 다닌 자국 — 넓게 뭉친 때
    const gr = smoothstep(0.55, 0.9, grime(u, v)) * 0.4;
    r = lerp(r, 150, gr);
    g = lerp(g, 148, gr);
    bl = lerp(bl, 138, gr);

    o.c[0] = r;
    o.c[1] = g;
    o.c[2] = bl;
    o.r = clamp(rough, 0.25, 1);
    o.h = clamp(h, 0, 1);
  });
}

// 플라자·설비실 바닥의 폴리싱 콘크리트.
//
// lo/hi 가 이 마감의 밝기다. 기본값은 뒤쪽 슬래브·암반용으로 어둡고, **플라자
// 바닥은 밝은 쪽을 쓴다.** 처음엔 전부 기본값이었는데, 조도에 반사율을 곱해
// 재 보니 플라자가 빛을 2배 받고도 화면에서는 고리 복도보다 어두웠다 —
// 복도 비닐 타일의 반사율이 0.52 인데 이 콘크리트는 0.25 였기 때문이다.
export function concreteTextures(seed = 4201, lo = 118, hi = 158) {
  const agg = tiledFbm(seed, 90, 2);
  const stain = tiledFbm(seed + 1, 4, 4);
  return bake(512, 1, 1, (u, v, o) => {
    const a = agg(u, v);
    const s = stain(u, v);
    const m = a * 0.6 + s * 0.4;
    const base = lerp(lo, hi, m);
    o.c[0] = base + (s - 0.5) * 8;
    o.c[1] = base + (s - 0.5) * 7;
    o.c[2] = base - 2 + (s - 0.5) * 6;
    o.r = 0.5 + (1 - m) * 0.25;
    o.h = clamp(a * 0.7 + 0.15, 0, 1);
  });
}

// ── 벽 ─────────────────────────────────────────────────────────────────────

// 도장 콘크리트 블록. 줄눈이 가로로 지나간다 (블록 40x20cm).
export function blockWallTextures(seed = 4301, tint = [206, 203, 191]) {
  const grit = tiledFbm(seed, 120, 2);
  const patch = tiledFbm(seed + 1, 6, 3);
  const drip = tiledFbm(seed + 2, 3, 4);

  // 1m 안에 블록 2.5장 x 5켜 — repeat 로 맞춘다
  return bake(512, 1, 1, (u, v, o) => {
    const rows = 5;
    const cols = 2.5;
    const ry = v * rows;
    const row = Math.floor(ry);
    // 켜마다 반 장씩 어긋난다
    const rx = u * cols + (row % 2 ? 0.5 : 0);
    const col = Math.floor(rx);
    const fu = rx - col;
    const fv = ry - row;

    const t = (hash2(col, row) - 0.5) * 9;
    const g = grit(u, v);
    let r = tint[0] + t + (g - 0.5) * 14;
    let gg = tint[1] + t + (g - 0.5) * 13;
    let b = tint[2] + t + (g - 0.5) * 12;

    let h = 0.6 + (g - 0.5) * 0.2;
    let rough = 0.82;

    // 줄눈
    const jm = Math.min(Math.min(fu, 1 - fu) * (cols / rows), Math.min(fv, 1 - fv));
    if (jm < 0.055) {
      const k = 1 - jm / 0.055;
      r = lerp(r, 150, k * 0.7);
      gg = lerp(gg, 148, k * 0.7);
      b = lerp(b, 140, k * 0.7);
      h -= 0.42 * k;
      rough += 0.1 * k;
    }

    // 물 자국 — 배관을 낀 벽은 마르지 않는다
    const d = smoothstep(0.62, 0.95, drip(u, v)) * 0.35;
    r = lerp(r, 168, d);
    gg = lerp(gg, 170, d);
    b = lerp(b, 160, d);

    // 넓은 얼룩
    const pt = (patch(u, v) - 0.5) * 10;
    o.c[0] = r + pt;
    o.c[1] = gg + pt;
    o.c[2] = b + pt;
    o.r = clamp(rough, 0.4, 1);
    o.h = clamp(h, 0, 1);
  });
}

// ── 천장 ───────────────────────────────────────────────────────────────────

// 흡음 텍스 타일. 60cm 격자, 미세 타공, 물 샌 자국.
export function ceilingTileTextures(seed = 4401) {
  const perf = tiledFbm(seed, 200, 1);
  const grain = tiledFbm(seed + 1, 40, 3);
  const water = tiledFbm(seed + 2, 3.5, 4);

  // 512 에 타일 4x4 = 2.4m 사방을 덮는다 (타일 0.6m)
  return bake(512, 1, 1, (u, v, o) => {
    const gx = Math.floor(u * 4);
    const gy = Math.floor(v * 4);
    const fu = u * 4 - gx;
    const fv = v * 4 - gy;

    const p = perf(u, v);
    const g = grain(u, v);
    let base = 220 + (g - 0.5) * 14;
    // 타공 — 점이 아니라 임계값으로 판다. 실제 텍스는 구멍이 불규칙하다
    if (p > 0.72) base -= 22 * ((p - 0.72) / 0.28);

    let r = base;
    let gg = base - 1;
    let b = base - 5;

    // **높이는 거의 안 준다.** 타공은 지름 1~2mm 짜리 구멍이다. 여기에
    // 0.3 짜리 높이차를 주면 픽셀마다 노말이 눕고, 바로 아래 형광등을 두고도
    // 천장이 새카맣게 죽는다 — 실제로 첫 판이 그랬다 (core/textures.js 머리말).
    let h = 0.55 + (p > 0.72 ? -0.05 : 0);

    // T바 격자 — 타일 사이의 금속 레일
    const bar = Math.min(Math.min(fu, 1 - fu), Math.min(fv, 1 - fv));
    if (bar < 0.035) {
      const k = 1 - bar / 0.035;
      r = lerp(r, 178, k);
      gg = lerp(gg, 180, k);
      b = lerp(b, 184, k);
      h = lerp(h, 0.72, k); // T바가 타일보다 살짝 높다. 그 이상은 필요 없다
    }

    // 물 샌 자국 — 이게 있어야 관리 안 된 건물로 읽힌다
    const w = smoothstep(0.68, 0.92, water(u, v));
    r = lerp(r, 186, w * 0.75);
    gg = lerp(gg, 172, w * 0.8);
    b = lerp(b, 140, w * 0.85);

    o.c[0] = r;
    o.c[1] = gg;
    o.c[2] = b;
    o.r = clamp(0.9 - (bar < 0.035 ? 0.35 : 0), 0.3, 1);
    o.h = clamp(h, 0, 1);
  });
}

// ── 문 팻말 ────────────────────────────────────────────────────────────────
//
// 방 이름은 **읽혀야 한다.** 도시의 `shared/glyphs.js` 는 "글자처럼 보이는
// 막대" 라 멀리서 보는 간판에는 맞지만, 문 옆 30cm 팻말은 사람이 실제로 읽는
// 물건이다. 그래서 5x7 비트맵 자형을 직접 둔다 — 기관 표지판의 산세리프와
// 같은 골격이고, 자형 하나가 문자열 일곱 줄이라 표로 읽힌다.
//
// 텍스처 한 장은 256x64 (팻말 0.5 x 0.125m). 라벨마다 한 번 굽고 재질 쪽에서
// 캐시한다 (materials.signOf — 빌드 한 번의 수명).
const FONT = {
  A: ['.###.', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  B: ['####.', '#...#', '#...#', '####.', '#...#', '#...#', '####.'],
  C: ['.###.', '#...#', '#....', '#....', '#....', '#...#', '.###.'],
  D: ['####.', '#...#', '#...#', '#...#', '#...#', '#...#', '####.'],
  E: ['#####', '#....', '#....', '####.', '#....', '#....', '#####'],
  F: ['#####', '#....', '#....', '####.', '#....', '#....', '#....'],
  G: ['.###.', '#...#', '#....', '#.###', '#...#', '#...#', '.###.'],
  H: ['#...#', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  I: ['#####', '..#..', '..#..', '..#..', '..#..', '..#..', '#####'],
  J: ['..###', '...#.', '...#.', '...#.', '...#.', '#..#.', '.##..'],
  K: ['#...#', '#..#.', '#.#..', '##...', '#.#..', '#..#.', '#...#'],
  L: ['#....', '#....', '#....', '#....', '#....', '#....', '#####'],
  M: ['#...#', '##.##', '#.#.#', '#...#', '#...#', '#...#', '#...#'],
  N: ['#...#', '##..#', '#.#.#', '#..##', '#...#', '#...#', '#...#'],
  O: ['.###.', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  P: ['####.', '#...#', '#...#', '####.', '#....', '#....', '#....'],
  Q: ['.###.', '#...#', '#...#', '#...#', '#.#.#', '#..#.', '.##.#'],
  R: ['####.', '#...#', '#...#', '####.', '#.#..', '#..#.', '#...#'],
  S: ['.####', '#....', '#....', '.###.', '....#', '....#', '####.'],
  T: ['#####', '..#..', '..#..', '..#..', '..#..', '..#..', '..#..'],
  U: ['#...#', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  V: ['#...#', '#...#', '#...#', '#...#', '#...#', '.#.#.', '..#..'],
  W: ['#...#', '#...#', '#...#', '#.#.#', '#.#.#', '##.##', '#...#'],
  X: ['#...#', '#...#', '.#.#.', '..#..', '.#.#.', '#...#', '#...#'],
  Y: ['#...#', '#...#', '.#.#.', '..#..', '..#..', '..#..', '..#..'],
  Z: ['#####', '....#', '...#.', '..#..', '.#...', '#....', '#####'],
  ' ': ['.....', '.....', '.....', '.....', '.....', '.....', '.....'],
};

// label 이 글자칸(5+1)의 배수로 놓인다. 잉크면 true.
function inkAt(label, cx, cy) {
  if (cy < 0 || cy > 6) return false;
  const ci = Math.floor(cx / 6);
  const col = cx - ci * 6;
  if (col > 4 || ci < 0 || ci >= label.length) return false;
  const g = FONT[label[ci]] ?? FONT[' '];
  return g[cy][col] === '#';
}

export function signTextures(label, tint = [38, 44, 56]) {
  const text = label.toUpperCase();
  const cols = text.length * 6 - 1; // 마지막 자간은 빼고 센다
  const grime = tiledFbm(4701, 9, 3);
  // 글자칸을 세로에 맞춘다 — 7행이 텍스처 높이의 0.52 를 차지하게
  const px = 64 * 0.52 / 7; // 한 칸 픽셀
  const w = cols * px;
  return bake([256, 64], 1, 1, (u, v, o) => {
    const x = u * 256;
    const y = v * 64;
    const g = grime(u, v);
    let r = tint[0] + (g - 0.5) * 14;
    let gg = tint[1] + (g - 0.5) * 14;
    let b = tint[2] + (g - 0.5) * 14;
    let rough = 0.5;
    let h = 0.5;

    // 테두리 — 판의 가장자리 홈
    const edge = Math.min(x, y, 256 - x, 64 - y);
    if (edge < 3) h = 0.3;

    // 글자 — 가운데 정렬. v 는 위가 0 이므로 행 인덱스가 그대로다.
    const cx = Math.floor((x - (256 - w) / 2) / px);
    const cy = Math.floor((y - (64 - 7 * px) / 2) / px);
    if (inkAt(text, cx, cy)) {
      r = 232;
      gg = 236;
      b = 238;
      rough = 0.66;
      h = 0.72; // 실크 인쇄가 살짝 도드라진다
    }
    o.c[0] = r;
    o.c[1] = gg;
    o.c[2] = b;
    o.r = rough;
    o.h = h;
  });
}

// ── 설비 ───────────────────────────────────────────────────────────────────

// 도장 강판 — 문·로커·덕트
export function steelTextures(seed = 4501, tint = [138, 146, 150]) {
  const scr = tiledFbm(seed, 160, 2);
  const wear = tiledFbm(seed + 1, 7, 3);
  return bake(256, 1, 1, (u, v, o) => {
    const s = scr(u, v);
    const w = smoothstep(0.6, 0.95, wear(u, v));
    let r = tint[0] + (s - 0.5) * 12;
    let g = tint[1] + (s - 0.5) * 12;
    let b = tint[2] + (s - 0.5) * 12;
    // 벗겨진 자리에 녹
    r = lerp(r, 124, w * 0.5);
    g = lerp(g, 96, w * 0.5);
    b = lerp(b, 74, w * 0.5);
    o.c[0] = r;
    o.c[1] = g;
    o.c[2] = b;
    o.r = clamp(0.42 + w * 0.35 + (s - 0.5) * 0.1, 0.2, 1);
    o.h = clamp(0.5 + (s - 0.5) * 0.4, 0, 1);
  });
}
