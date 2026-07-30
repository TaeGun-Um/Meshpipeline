// 값 노이즈(value noise)와 fbm. 텍스처와 지형·배치 밀도가 모두 여기서 나온다.
import { mulberry32 } from './rng.js';

// cells는 2의 거듭제곱. 좌표를 cells로 wrap하므로, 샘플 좌표 범위가 cells의
// 정수배가 되도록 잡으면 이음선 없이 타일링된다.
// tiledFbm 전용 내부 헬퍼 — 밖에서 쓸 일이 없다
function noiseField(seed, cells) {
  const rnd = mulberry32(seed);
  const m = cells - 1;
  const g = new Float32Array(cells * cells);
  for (let i = 0; i < g.length; i++) g[i] = rnd();

  return (x, y) => {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const xf = x - xi;
    const yf = y - yi;
    const u = xf * xf * (3 - 2 * xf);
    const v = yf * yf * (3 - 2 * yf);
    const r0 = (yi & m) * cells;
    const r1 = ((yi + 1) & m) * cells;
    const c0 = xi & m;
    const c1 = (xi + 1) & m;
    const a = g[r0 + c0];
    const b = g[r0 + c1];
    const c = g[r1 + c0];
    const d = g[r1 + c1];
    return (a + (b - a) * u) * (1 - v) + (c + (d - c) * u) * v;
  };
}

// UV(0..1)를 받아 0..1을 돌려주는, 이음선 없는 fbm
export function tiledFbm(seed, cells, octaves = 5, gain = 0.5) {
  const n = noiseField(seed, cells);
  return (u, v) => {
    let sum = 0;
    let amp = 1;
    let freq = 1;
    let norm = 0;
    for (let i = 0; i < octaves; i++) {
      sum += amp * n(u * cells * freq, v * cells * freq);
      norm += amp;
      freq *= 2;
      amp *= gain;
    }
    return sum / norm;
  };
}

// 월드 좌표용(타일링 불필요). 지형 높이·잡초 밀도에 쓴다.
export function worldFbm(seed, baseScale, octaves = 4, gain = 0.5) {
  const n = noiseField(seed, 256);
  return (x, z) => {
    let sum = 0;
    let amp = 1;
    let freq = 1 / baseScale;
    let norm = 0;
    for (let i = 0; i < octaves; i++) {
      sum += amp * n(x * freq, z * freq);
      norm += amp;
      freq *= 2;
      amp *= gain;
    }
    return sum / norm;
  };
}

export const lerp = (a, b, t) => a + (b - a) * t;
export const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
export function smoothstep(e0, e1, x) {
  const t = clamp((x - e0) / (e1 - e0), 0, 1);
  return t * t * (3 - 2 * t);
}
