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
  // 숫자 — 층 표시(B1·B2)가 생기며 넣었다 (2026-08-06). 없으면 `??` 가
  // 조용히 공백으로 떨어져 "B1" 이 "B " 로 굽힌다 — 화면에서야 알았다.
  0: ['.###.', '#...#', '#..##', '#.#.#', '##..#', '#...#', '.###.'],
  1: ['..#..', '.##..', '..#..', '..#..', '..#..', '..#..', '.###.'],
  2: ['.###.', '#...#', '....#', '...#.', '..#..', '.#...', '#####'],
  3: ['#####', '...#.', '..#..', '...#.', '....#', '#...#', '.###.'],
  4: ['...#.', '..##.', '.#.#.', '#..#.', '#####', '...#.', '...#.'],
  5: ['#####', '#....', '####.', '....#', '....#', '#...#', '.###.'],
  6: ['..##.', '.#...', '#....', '####.', '#...#', '#...#', '.###.'],
  7: ['#####', '....#', '...#.', '..#..', '.#...', '.#...', '.#...'],
  8: ['.###.', '#...#', '#...#', '.###.', '#...#', '#...#', '.###.'],
  9: ['.###.', '#...#', '#...#', '.####', '....#', '...#.', '.##..'],
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
  // 글자칸을 세로에 맞춘다 — 7행이 텍스처 높이의 0.52 를 차지하게.
  // **다만 긴 이름은 가로가 먼저 넘친다** — 'STAFF ROOM'(59칸)은 280px 로
  // 256 을 넘어 마지막 글자가 잘려 나갔다 (2026-08-07). 둘 중 작은 쪽을 쓴다.
  const px = Math.min((64 * 0.52) / 7, (256 * 0.92) / cols); // 한 칸 픽셀
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

// ── 자판기 옆면 그림 ───────────────────────────────────────────────────────
//
// **상자 조각으로 그림을 때우지 않는다** (2026-08-06 사용자 지시: "텍스처좀
// 다채롭게 그려라 이상하게 때우지 말고"). 옆면 광고는 인쇄물이므로 인쇄물답게
// **한 장으로 굽는다** — 조각으로 쌓으면 층마다 z-파이팅을 피해야 하고,
// 곡선(병 어깨·컵)을 못 내고, 색이 재질 팔레트에 갇힌다.
//
// 여기서 쓰는 도구는 문 팻말(signTextures)과 같다: uv 를 받아 도형 안인지
// 밖인지 판정하고 색을 칠한다. 원·타원·사다리꼴이 다 **부등식 한 줄**이다.
export function vendSideTextures(kind = 'drink', seed = 4801) {
  const grime = tiledFbm(seed, 7, 3);
  const speck = tiledFbm(seed + 1, 90, 2);
  // 팔레트 — 인쇄 잉크라 벽·강판보다 채도가 높다
  const INK = kind === 'drink'
    ? { bg: [222, 214, 198], key: [150, 34, 40], key2: [232, 196, 74], dark: [48, 40, 38] }
    : { bg: [226, 220, 206], key: [36, 74, 116], key2: [214, 138, 44], dark: [44, 40, 36] };

  return bake([256, 512], 1, 1, (u, v, o) => {
    // v 는 위가 0 이다 — 그림은 위아래를 뒤집어 생각한다
    const x = (u - 0.5) * 2; // -1 .. 1
    const y = 1 - v; // 0(아래) .. 1(위)
    const g = grime(u, v);
    const sp = speck(u, v);
    let c = INK.bg.slice();
    let rough = 0.62;
    let h = 0.5;

    const put = (col, hh = 0.52, rr = 0.5) => {
      c = col.slice();
      h = hh;
      rough = rr;
    };
    // 테두리 — 인쇄면의 가장자리 여백
    const edge = Math.min(u, 1 - u, v, 1 - v);
    if (edge < 0.035) put(INK.dark, 0.42, 0.6);
    else if (edge < 0.05) put([248, 244, 236], 0.55, 0.55);

    if (edge >= 0.05) {
      if (kind === 'drink') {
        // ── 병 하나 — 몸통(원기둥) · 어깨(곡선) · 목 · 뚜껑 · 라벨 ────────
        // 어깨는 **직선이 아니라 곡선**이다: 반지름이 y 에 따라 부드럽게 준다
        const bodyTop = 0.6;
        const neckTop = 0.8;
        const rBody = 0.34;
        const rNeck = 0.1;
        let rr2 = 0;
        if (y > 0.14 && y <= bodyTop) rr2 = rBody;
        else if (y > bodyTop && y <= neckTop) {
          const t = (y - bodyTop) / (neckTop - bodyTop);
          rr2 = lerp(rBody, rNeck, smoothstep(0, 1, t)); // 어깨의 곡선
        } else if (y > neckTop && y <= 0.88) rr2 = rNeck;
        else if (y > 0.88 && y <= 0.93) rr2 = 0.13; // 뚜껑
        if (rr2 > 0 && Math.abs(x) < rr2) {
          put(y > 0.88 ? INK.dark : INK.key, 0.62, 0.42);
          // 하이라이트 — 왼쪽 어깨에 흰 띠. 유리병으로 읽히게
          if (x < -rr2 * 0.45 && x > -rr2 * 0.78 && y < 0.78) put([246, 240, 230], 0.64, 0.35);
          // 라벨 띠 — 몸통 가운데
          if (y > 0.26 && y < 0.46) {
            put([246, 242, 232], 0.6, 0.55);
            if (y > 0.3 && y < 0.34 && Math.abs(x) < rr2 * 0.62) put(INK.key2, 0.6, 0.5);
            if (y > 0.37 && y < 0.4 && Math.abs(x) < rr2 * 0.45) put(INK.dark, 0.6, 0.5);
          }
          // 바닥 굽
          if (y < 0.18) put(INK.dark, 0.58, 0.5);
        }
        // 물방울 셋 — 시원함의 기호. 원 하나가 부등식 한 줄이다
        for (const [dx, dy, dr] of [[0.62, 0.68, 0.075], [0.72, 0.45, 0.05], [-0.68, 0.34, 0.06]]) {
          if ((x - dx) ** 2 + ((y - dy) * 2) ** 2 < dr * dr * 4) put([206, 222, 232], 0.6, 0.3);
        }
        // 아래 글줄 — 상표 자리
        if (y > 0.06 && y < 0.105 && Math.abs(x) < 0.5) put(INK.key, 0.56, 0.55);
      } else {
        // ── 봉지 하나 — 위아래가 **톱니로 접힌** 판 + 그 앞의 갑 ─────────
        const bagL = -0.62;
        const bagR = 0.34;
        if (x > bagL && x < bagR && y > 0.26 && y < 0.86) {
          put(INK.key2, 0.6, 0.5);
          // 접힌 띠 — 위아래. 톱니는 sin 으로 낸다
          const zig = Math.sin(x * 40) * 0.012;
          if (y > 0.79 + zig || y < 0.33 + zig) put(INK.dark, 0.56, 0.55);
          // 라벨 창
          if (y > 0.5 && y < 0.66 && x > bagL + 0.1 && x < bagR - 0.1) {
            put([246, 242, 232], 0.6, 0.55);
            if (y > 0.55 && y < 0.6) put(INK.key, 0.6, 0.5);
          }
          // 하이라이트 — 봉지는 비닐이라 세로로 번쩍인다
          if (x > bagL + 0.12 && x < bagL + 0.2) put([248, 226, 170], 0.62, 0.3);
        }
        // 갑 — 오른쪽 아래. 앞면과 옆면(밝기 차)으로 입체를 낸다
        if (x > 0.4 && x < 0.86 && y > 0.2 && y < 0.62) {
          put(INK.key, 0.6, 0.5);
          if (x > 0.74) put([INK.key[0] * 0.72, INK.key[1] * 0.72, INK.key[2] * 0.72], 0.58, 0.5);
          if (y > 0.42 && y < 0.52 && x < 0.72) put([246, 242, 232], 0.6, 0.55);
        }
        // 부스러기 셋 — 쏟아진 과자
        for (const [dx, dy] of [[-0.55, 0.16], [-0.36, 0.12], [-0.2, 0.17]]) {
          if (Math.abs(x - dx) < 0.045 && Math.abs(y - dy) < 0.022) put(INK.key2, 0.58, 0.55);
        }
        if (y > 0.06 && y < 0.105 && Math.abs(x) < 0.5) put(INK.key, 0.56, 0.55);
      }
    }

    // 때와 잔 반점 — 인쇄면도 몇 해 지나면 바랜다
    const wear = (g - 0.5) * 16 + (sp - 0.5) * 8;
    o.c[0] = clamp(c[0] + wear, 0, 255);
    o.c[1] = clamp(c[1] + wear, 0, 255);
    o.c[2] = clamp(c[2] + wear, 0, 255);
    o.r = clamp(rough + (g - 0.5) * 0.12, 0.05, 1);
    o.h = h;
  });
}

// ── 병 라벨 ────────────────────────────────────────────────────────────────
//
// 흰 띠 + 색 띠만 감아 두면 **무엇이 든 병인지 알 수 없다** (2026-08-07 지시:
// "각자가 무엇인지 알 수 있게"). 라벨은 인쇄물이니 인쇄물답게 한 장으로 굽고,
// 글자(signTextures 의 5x7 글자판)와 그림기호를 같이 넣는다.
//
// **감기는 면이라 u 가 한 바퀴다.** 그리고 `CylinderGeometry` 의 u=0 은
// 로컬 +z 다 — 병들은 벽에서 +z 로 서 있으므로 **u=0 이 정면**이다.
// 처음에 그림을 u=0.5 에 놓았더니 정면에는 이음매만 보이고 그림은 등 뒤로
// 갔다 (2026-08-07). 이음매는 반대편(u=0.5)으로 보낸다.
// v 는 위가 0 이므로 y = 1 - v 로 뒤집어 생각한다 (자판기 옆면과 같은 규약).
// **길이는 미터로 잰다.** uv 비율(0..1)로 그렸더니 글자가 납작하게 눌렸다 —
// 라벨은 둘레 0.22m 에 높이 0.08m 라 텍스처 한 칸의 가로세로가 실물에서
// 1.4배 차이 난다. 둘레(circ)와 높이(hgt)를 받아 **월드 미터**로 그리면
// 글자도 그림도 안 찌그러지고, 병 치수를 바꿔도 따라온다.
export function bottleLabelTextures(kind = 'shampoo', circ = 0.22, hgt = 0.078, seed = 4901) {
  const grime = tiledFbm(seed, 8, 3);
  const INK = kind === 'shampoo'
    ? { key: [30, 78, 122], key2: [86, 170, 186], text: 'SHAMPOO', cap: 0.0115, sub: 'HAIR' }
    : { key: [178, 84, 44], key2: [226, 172, 92], text: 'SOAP', cap: 0.019, sub: 'HAND' };

  // 글자 한 칸을 **월드 미터**로 잡고 텍스처 픽셀로 환산한다 (가로·세로 따로)
  const glyph = (text, capH) => {
    const cell = capH / 7;
    return {
      text,
      cols: text.length * 6 - 1,
      cu: (cell / circ) * 256,
      cv: (cell / hgt) * 128,
    };
  };
  const GT = glyph(INK.text, INK.cap);
  const GS = glyph(INK.sub, INK.cap * 0.55);

  return bake([256, 128], 1, 1, (u, v, o) => {
    const uu = u < 0.5 ? u : u - 1; // -0.5 .. 0.5, **0 이 정면**
    const ux = (uu + 0.5) * 256; // 글자 배치용 픽셀 x (정면이 128)
    const wx = uu * circ; // 정면에서의 거리 (m)
    const g = grime(u, v);
    let c = [242, 238, 228]; // 라벨 종이
    let rough = 0.66;
    let h = 0.5;
    const put = (col, rr = 0.6, hh = 0.52) => { c = col.slice(); rough = rr; h = hh; };
    // 글줄 하나 — 가로는 정면 중심, 세로는 vc 를 한가운데로
    const lineAt = (G, vc) => {
      const cx = Math.floor((ux - (256 - G.cols * G.cu) / 2) / G.cu);
      const cy = Math.floor((v * 128 - (vc * 128 - 3.5 * G.cv)) / G.cv);
      return inkAt(G.text, cx, cy);
    };

    // 위아래 색 띠 — 따로 감던 조각을 여기로 들여왔다
    if (v > 0.06 && v < 0.2) put(INK.key, 0.6, 0.54);
    if (v > 0.93 && v < 0.97) put(INK.key2, 0.6, 0.54);

    // 그림기호 — 정면에 하나. 좌표가 미터라 원이 원으로 나온다
    const sx = wx;
    const sy = (0.44 - v) * hgt; // 그림 중심 v=0.44, 위가 +
    if (kind === 'shampoo') {
      // 물방울 — 아래는 원, 위는 뾰족하게 좁아진다
      const t = (sy + 0.009) / 0.024; // 0(아래) .. 1(위)
      if (t > 0 && t < 1) {
        const rr = 0.0068 * Math.sqrt(Math.max(0, 1 - t * t)) + 0.004 * (1 - t);
        if (Math.abs(sx) < rr) {
          put(INK.key2, 0.5, 0.58);
          if (sx < -rr * 0.3 && sx > -rr * 0.75) put([236, 248, 250], 0.45, 0.6); // 하이라이트
        }
      }
      // 머리카락 세 가닥 — 물방울 양옆으로 흐르는 곡선
      for (let k = 0; k < 3; k++) {
        const off = 0.0105 + k * 0.0038;
        const curve = off + Math.sin((sy + 0.012) * 105) * 0.0018;
        if (Math.abs(Math.abs(sx) - curve) < 0.001 && sy > -0.009 && sy < 0.014) {
          put(INK.key, 0.6, 0.55);
        }
      }
    } else {
      // 손 — 손바닥(타원) + 손가락 넷 + 엄지. 위로 방울 둘이 떨어진다
      let hand = (sx / 0.0088) ** 2 + ((sy + 0.004) / 0.0068) ** 2 < 1;
      for (let k = 0; k < 4; k++) {
        const fx = -0.0063 + k * 0.0042;
        const top = 0.0062 + (k === 1 || k === 2 ? 0.0018 : 0);
        if (Math.abs(sx - fx) < 0.0016 && sy > -0.002 && sy < top) hand = true;
      }
      if (Math.abs(sx + 0.0098) < 0.0033 && Math.abs(sy + 0.0016) < 0.0023) hand = true; // 엄지
      if (hand) put(INK.key, 0.6, 0.56);
      // 손 위로 떨어지는 방울 둘
      for (const [dx, dy, dr] of [[-0.002, 0.0118, 0.0023], [0.0042, 0.0168, 0.0017]]) {
        if ((sx - dx) ** 2 + (sy - dy) ** 2 < dr * dr) put(INK.key2, 0.5, 0.58);
      }
    }

    // 글자 — 색 띠 안의 작은 부제, 그림 아래의 큰 제품명
    if (lineAt(GS, 0.13)) put([246, 244, 238], 0.62, 0.58);
    if (lineAt(GT, 0.74)) put([36, 40, 48], 0.68, 0.62);

    // 이음매 — 라벨의 끝이 맞물리는 자리. **정면 반대편(u=0.5)** 에 둔다
    if (Math.abs(u - 0.5) < 0.007) put([214, 208, 196], 0.7, 0.46);

    const wear = (g - 0.5) * 12;
    o.c[0] = clamp(c[0] + wear, 0, 255);
    o.c[1] = clamp(c[1] + wear, 0, 255);
    o.c[2] = clamp(c[2] + wear, 0, 255);
    o.r = clamp(rough + (g - 0.5) * 0.1, 0.05, 1);
    o.h = h;
  });
}

// ── 수건 ───────────────────────────────────────────────────────────────────
//
// 짜 넣은 줄무늬를 **얇은 상자**로 얹고 있었다 (2026-08-07 지시: "저 초록색
// 띠는 텍스쳐로 해야지"). 인쇄·직조 무늬는 조각이 아니라 표면이다 —
// 자판기 옆면·병 라벨에서 이미 정한 규칙이 여기도 그대로 간다 (3.13.6).
//
// 덤으로 **테리 고리 결**이 생긴다. 흰 상자에 흰 재질이면 아무리 굴려도
// 플라스틱인데, 결이 있으면 그 자체로 천이다.
export function towelTextures(tint = [240, 238, 232], stripe = [38, 96, 114], seed = 5001) {
  const pile = tiledFbm(seed, 52, 2); // 고리 결 — 성글고 도톰하다
  const weave = tiledFbm(seed + 1, 150, 1); // 바탕 실
  return bake(256, 1, 1, (u, v, o) => {
    const p = pile(u, v);
    const w = weave(u, v);
    let c = tint.slice();
    let rough = 0.88;
    // 짜 넣은 줄무늬 둘 — **u** 를 따라 자른다. 상자 윗면에서 u 는 길이
    // 방향이므로 이러면 줄이 **폭을 가로지르는** 띠가 된다 (실물이 그렇다).
    // v 로 잘랐더니 길이 방향으로 길게 흐르는 선이었다.
    for (const s of [0.77, 0.845]) {
      if (Math.abs(u - s) < 0.016) {
        c = stripe.slice();
        rough = 0.8;
      }
    }
    const n = (p - 0.5) * 18 + (w - 0.5) * 12;
    o.c[0] = clamp(c[0] + n, 0, 255);
    o.c[1] = clamp(c[1] + n, 0, 255);
    o.c[2] = clamp(c[2] + n, 0, 255);
    o.r = clamp(rough + (p - 0.5) * 0.08, 0.3, 1);
    // 고리 결은 높이로 낸다 — 노말이 이 결을 잡아 주면 천으로 보인다
    o.h = clamp(0.5 + (p - 0.5) * 0.9 + (w - 0.5) * 0.3, 0, 1);
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
