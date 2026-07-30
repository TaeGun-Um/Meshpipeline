// 모든 재질을 로드 시점에 캔버스로 굽는다. 이미지 파일은 하나도 읽지 않는다.
// 각 텍스처는 색상 / 거칠기 / 범프 3장을 한 번의 픽셀 루프에서 같이 생성한다.
import * as THREE from 'three';
import { tiledFbm, lerp, clamp, smoothstep } from './noise.js';

let ANISO = 4;
export function setAnisotropy(n) {
  ANISO = n;
}

export const textureStats = { count: 0, pixels: 0 };

// 정수 해시 — 벽돌/블록 한 장 단위의 색 편차용
function hash2(a, b) {
  let h = (a * 374761393 + b * 668265263) | 0;
  h = ((h ^ (h >>> 13)) * 1274126177) | 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function toTexture(canvas, srgb, rx, ry) {
  const t = new THREE.CanvasTexture(canvas);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(rx, ry);
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.anisotropy = ANISO;
  t.needsUpdate = true;
  return t;
}

// 기울기 증폭. 높이차를 노말로 바꿀 때 얼마나 과장할지.
// 3.2로 두면 자갈처럼 픽셀 단위로 높이가 튀는 텍스처에서 노말이 거의 수평으로 누워
// 대부분의 픽셀이 광원 반대쪽을 향한다. 브라우저는 ACES 톤매핑이 가려주지만
// 톤매핑이 없는 엔진(Unity Built-in)에서는 표면이 새카맣게 죽는다.
const NORMAL_STRENGTH = 1.4;

function bake(size, rx, ry, fn) {
  const mk = () => {
    const c = document.createElement('canvas');
    c.width = c.height = size;
    return c;
  };
  const cc = mk();
  const cr = mk();
  const cn = mk();
  const g1 = cc.getContext('2d');
  const g2 = cr.getContext('2d');
  const g3 = cn.getContext('2d');
  const i1 = g1.createImageData(size, size);
  const i2 = g2.createImageData(size, size);
  const i3 = g3.createImageData(size, size);
  const d1 = i1.data;
  const d2 = i2.data;
  const d3 = i3.data;
  const o = { c: [0, 0, 0], r: 0.85, h: 0.5 };

  // 1차: 색·거칠기를 쓰면서 높이는 따로 모은다
  const height = new Float32Array(size * size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      fn(x / size, y / size, o);
      const i = (y * size + x) * 4;
      d1[i] = o.c[0];
      d1[i + 1] = o.c[1];
      d1[i + 2] = o.c[2];
      d1[i + 3] = 255;
      d2[i] = d2[i + 1] = d2[i + 2] = o.r * 255;
      d2[i + 3] = 255;
      height[y * size + x] = clamp(o.h, 0, 1);
    }
  }

  // 2차: 높이맵 -> 탄젠트 공간 노말맵.
  // glTF에는 범프맵이 없다. 범프로 내보내면 EXT_materials_bump(비표준 확장)가 되어
  // 블렌더도 Unity도 통째로 버린다. 노말맵은 glTF 표준이라 그대로 살아간다.
  // 인덱스를 size로 wrap해서 이음선 없는 타일링을 유지한다.
  for (let y = 0; y < size; y++) {
    const yUp = (y - 1 + size) % size;
    const yDn = (y + 1) % size;
    for (let x = 0; x < size; x++) {
      const xL = (x - 1 + size) % size;
      const xR = (x + 1) % size;
      const dx = (height[y * size + xR] - height[y * size + xL]) * NORMAL_STRENGTH;
      const dy = (height[yDn * size + x] - height[yUp * size + x]) * NORMAL_STRENGTH;
      const nx = -dx;
      const ny = dy;
      const inv = 1 / Math.sqrt(nx * nx + ny * ny + 1);
      const i = (y * size + x) * 4;
      d3[i] = (nx * inv * 0.5 + 0.5) * 255;
      d3[i + 1] = (ny * inv * 0.5 + 0.5) * 255;
      d3[i + 2] = (inv * 0.5 + 0.5) * 255;
      d3[i + 3] = 255;
    }
  }

  g1.putImageData(i1, 0, 0);
  g2.putImageData(i2, 0, 0);
  g3.putImageData(i3, 0, 0);

  textureStats.count += 3;
  textureStats.pixels += size * size * 3;

  return {
    map: toTexture(cc, true, rx, ry),
    roughnessMap: toTexture(cr, false, rx, ry),
    normalMap: toTexture(cn, false, rx, ry),
  };
}

export function setRepeat(set, rx, ry) {
  set.map.repeat.set(rx, ry);
  set.roughnessMap.repeat.set(rx, ry);
  set.normalMap.repeat.set(rx, ry);
  return set;
}

// ── 마른 흙바닥: 자갈, 밝게 마른 얼룩, 삭은 잔풀 자리 ────────────────────────
export function dirtTextures() {
  const coarse = tiledFbm(1001, 4, 5);
  const patch = tiledFbm(1002, 2, 3);
  const grit = tiledFbm(1003, 64, 2);
  const fine = tiledFbm(1004, 32, 3);

  return bake(512, 7, 7, (u, v, o) => {
    const t = coarse(u, v);
    const p = patch(u, v);
    const f = fine(u, v);
    const m = clamp(t * 0.72 + f * 0.36, 0, 1);

    let r = lerp(68, 150, m);
    let g = lerp(54, 128, m);
    let b = lerp(40, 99, m);

    const pale = smoothstep(0.58, 0.88, p) * 0.55;
    r = lerp(r, 178, pale);
    g = lerp(g, 162, pale);
    b = lerp(b, 133, pale);

    const dry = smoothstep(0.6, 0.92, 1 - p) * smoothstep(0.38, 0.72, f) * 0.5;
    r = lerp(r, 122, dry);
    g = lerp(g, 114, dry);
    b = lerp(b, 74, dry);

    const gr = grit(u, v);
    let h = m * 0.6 + f * 0.4;
    let rough = 0.97 - m * 0.1;
    // 자갈은 아주 절제해서. 밝게 키우면 흙이 아니라 눈밭처럼 보인다.
    if (gr > 0.82) {
      const k = (gr - 0.82) / 0.18;
      r += 26 * k;
      g += 24 * k;
      b += 21 * k;
      h += 0.3 * k;
      rough -= 0.1 * k;
    } else if (gr < 0.24) {
      const k = (0.24 - gr) / 0.24;
      r -= 30 * k;
      g -= 26 * k;
      b -= 22 * k;
      h -= 0.24 * k;
    }

    o.c[0] = r;
    o.c[1] = g;
    o.c[2] = b;
    o.r = clamp(rough, 0.5, 1);
    o.h = clamp(h, 0, 1);
  });
}

// ── 아스팔트 ───────────────────────────────────────────────────────────────
export function asphaltTextures() {
  const agg = tiledFbm(2001, 96, 2);
  const blotch = tiledFbm(2002, 6, 4);

  return bake(512, 10, 3, (u, v, o) => {
    const a = agg(u, v);
    const bl = blotch(u, v);
    const base = 62 + bl * 26;
    let r = base;
    let g = base + 1;
    let b = base + 4;
    let rough = 0.84 + bl * 0.1;

    if (a > 0.8) {
      const k = (a - 0.8) / 0.2;
      r += 30 * k;
      g += 29 * k;
      b += 28 * k;
      rough -= 0.14 * k;
    } else if (a < 0.2) {
      const k = (0.2 - a) / 0.2;
      r -= 14 * k;
      g -= 14 * k;
      b -= 13 * k;
    }

    o.c[0] = r;
    o.c[1] = g;
    o.c[2] = b;
    o.r = clamp(rough, 0.45, 1);
    o.h = a * 0.7 + bl * 0.3;
  });
}

// ── 붉은 벽돌 ──────────────────────────────────────────────────────────────
export function brickTextures() {
  const grain = tiledFbm(3001, 48, 3);
  const stain = tiledFbm(3002, 4, 3);
  const rows = 16;
  const cols = 8;

  return bake(512, 2, 2, (u, v, o) => {
    const ry = v * rows;
    const ri = Math.floor(ry);
    const fy = ry - ri;
    const off = ri % 2 ? 0.5 : 0;
    const rx = u * cols + off;
    const ci = Math.floor(rx);
    const fx = rx - ci;

    const gn = grain(u, v);
    const st = stain(u, v);

    if (fx < 0.045 || fx > 0.955 || fy < 0.1 || fy > 0.9) {
      const m = 152 + gn * 30 - st * 24;
      o.c[0] = m;
      o.c[1] = m - 3;
      o.c[2] = m - 10;
      o.r = 0.96;
      o.h = 0.22 + gn * 0.12;
      return;
    }

    const h1 = hash2(ci, ri);
    let r = 136 + h1 * 46 + gn * 22 - 11;
    let g = 66 + h1 * 28 + gn * 14 - 7;
    let b = 54 + h1 * 20 + gn * 12 - 6;

    const dark = smoothstep(0.62, 0.96, st) * 0.42;
    r = lerp(r, 82, dark);
    g = lerp(g, 56, dark);
    b = lerp(b, 48, dark);

    o.c[0] = r;
    o.c[1] = g;
    o.c[2] = b;
    o.r = clamp(0.88 - h1 * 0.08, 0.5, 1);
    o.h = clamp(0.72 + gn * 0.22, 0, 1);
  });
}

// ── 시멘트 블록 담장 ───────────────────────────────────────────────────────
export function blockTextures() {
  const grain = tiledFbm(4001, 44, 3);
  const stain = tiledFbm(4002, 3, 4);
  const rows = 6;
  const cols = 3;

  return bake(512, 1, 1, (u, v, o) => {
    const ry = v * rows;
    const ri = Math.floor(ry);
    const fy = ry - ri;
    const off = ri % 2 ? 0.5 : 0;
    const rx = u * cols + off;
    const ci = Math.floor(rx);
    const fx = rx - ci;

    const gn = grain(u, v);
    const st = stain(u, v);

    if (fx < 0.028 || fx > 0.972 || fy < 0.055 || fy > 0.945) {
      const m = 112 + gn * 22 - st * 20;
      o.c[0] = m;
      o.c[1] = m;
      o.c[2] = m - 4;
      o.r = 0.97;
      o.h = 0.2 + gn * 0.1;
      return;
    }

    const h1 = hash2(ci * 7, ri * 13);
    let base = 128 + h1 * 20 + gn * 24 - 12;
    // 아래쪽으로 갈수록 물때가 올라온 느낌
    const damp = smoothstep(0.4, 1.0, v) * 0.4 + smoothstep(0.5, 0.95, st) * 0.32;
    base = lerp(base, 86, damp);

    o.c[0] = base;
    o.c[1] = base + 1;
    o.c[2] = base - 5;
    o.r = clamp(0.95 - h1 * 0.05, 0.6, 1);
    o.h = clamp(0.66 + gn * 0.24, 0, 1);
  });
}

// ── 도장 외벽 ──────────────────────────────────────────────────────────────
export function wallTextures(seed, rgb) {
  const grain = tiledFbm(seed, 28, 4);
  const grime = tiledFbm(seed + 1, 5, 4);

  return bake(256, 3, 3, (u, v, o) => {
    const gn = grain(u, v);
    const gm = grime(u, v);
    const k = (gn - 0.5) * 26;
    const soil = smoothstep(0.62, 0.95, gm) * 0.3;

    o.c[0] = lerp(rgb[0] + k, rgb[0] * 0.62, soil);
    o.c[1] = lerp(rgb[1] + k, rgb[1] * 0.62, soil);
    o.c[2] = lerp(rgb[2] + k, rgb[2] * 0.6, soil);
    o.r = clamp(0.82 + gn * 0.14, 0.5, 1);
    o.h = 0.4 + gn * 0.5;
  });
}

// ── 칼라강판 지붕 ──────────────────────────────────────────────────────────
export function roofTextures(seed, rgb) {
  const grain = tiledFbm(seed, 36, 3);
  const rust = tiledFbm(seed + 1, 6, 4);

  return bake(256, 4, 4, (u, v, o) => {
    const corr = Math.sin(v * Math.PI * 2 * 16);
    const shade = 1 + corr * 0.12;
    const gn = grain(u, v);
    const rs = smoothstep(0.68, 0.95, rust(u, v));

    let r = rgb[0] * shade + gn * 16 - 8;
    let g = rgb[1] * shade + gn * 16 - 8;
    let b = rgb[2] * shade + gn * 16 - 8;
    r = lerp(r, 122, rs * 0.5);
    g = lerp(g, 74, rs * 0.5);
    b = lerp(b, 46, rs * 0.5);

    o.c[0] = r;
    o.c[1] = g;
    o.c[2] = b;
    o.r = clamp(0.52 + rs * 0.4 + gn * 0.1, 0.3, 1);
    o.h = 0.5 + corr * 0.35;
  });
}

// ── 녹슨 철판 (드럼통, 표지판) ─────────────────────────────────────────────
export function rustTextures() {
  const grain = tiledFbm(6001, 40, 4);
  const blot = tiledFbm(6002, 7, 4);

  return bake(256, 2, 2, (u, v, o) => {
    const gn = grain(u, v);
    const bl = blot(u, v);
    const rs = smoothstep(0.35, 0.85, bl);
    let r = lerp(96, 148, gn);
    let g = lerp(92, 138, gn);
    let b = lerp(88, 130, gn);
    r = lerp(r, 128 + gn * 40, rs);
    g = lerp(g, 66 + gn * 26, rs);
    b = lerp(b, 38 + gn * 16, rs);

    o.c[0] = r;
    o.c[1] = g;
    o.c[2] = b;
    o.r = clamp(0.45 + rs * 0.45, 0.3, 1);
    o.h = 0.4 + gn * 0.3 + rs * 0.25;
  });
}

// ── 하늘 그라디언트 (구면 배경용) ──────────────────────────────────────────
export function skyTexture() {
  const size = 256;
  const cv = document.createElement('canvas');
  cv.width = 16;
  cv.height = size;
  const ctx = cv.getContext('2d');
  const grad = ctx.createLinearGradient(0, 0, 0, size);
  grad.addColorStop(0.0, '#3f76b8');
  grad.addColorStop(0.42, '#84a9d2');
  grad.addColorStop(0.62, '#c3cfd6');
  grad.addColorStop(0.78, '#dcd2c0');
  grad.addColorStop(1.0, '#c9b8a2');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 16, size);

  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = THREE.ClampToEdgeWrapping;
  t.wrapT = THREE.ClampToEdgeWrapping;
  textureStats.count += 1;
  textureStats.pixels += 16 * size;
  return t;
}
