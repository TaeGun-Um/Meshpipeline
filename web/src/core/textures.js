// 텍스처 굽는 엔진. 이미지 파일은 하나도 읽지 않는다.
//
// 이 파일에는 "어떻게 굽는가"만 있다. "무엇을 굽는가"(흙·벽돌·젖은 아스팔트 같은
// 재질 레시피)는 씬이 소유한다 — scenes/<씬>/textures.js 참고.
// 레시피를 여기 두면 씬을 늘릴 때마다 공용 모듈이 부풀고, 어느 재질이 어느 장소
// 것인지 알 수 없게 된다.
import * as THREE from 'three';
import { clamp } from './noise.js';
import { onSceneReset } from './scenestate.js';

let ANISO = 4;
export function setAnisotropy(n) {
  ANISO = n;
}

export const textureStats = { count: 0 }; // main.js 하네스가 읽는다 (pixels 는 아무도 안 읽어 걷어냈다)

// 정수 해시 — 벽돌 한 장, 창문 한 칸처럼 이산 단위의 색 편차용
export function hash2(a, b) {
  let h = (a * 374761393 + b * 668265263) | 0;
  h = ((h ^ (h >>> 13)) * 1274126177) | 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

// bake / radialTexture 내부 전용
function toTexture(canvas, srgb, rx, ry) {
  const t = new THREE.CanvasTexture(canvas);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(rx, ry);
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.anisotropy = ANISO;
  t.needsUpdate = true;
  return t;
}

// ── 같은 그림은 한 번만 굽는다 ─────────────────────────────────────────────
//
// 실측(2026-08-08)에서 픽셀이 완전히 같은 텍스처가 4장(4.2MB) 나왔다 —
// 비닐 바닥 세 장의 노말맵(높이가 씨드와 무관한 격자 이음매뿐이라 같다),
// 블록벽 두 장의 거칠기맵, 발광 화면의 map/emissiveMap. 레시피마다 고치는
// 대신 여기서 구조적으로 막는다: **내용 해시가 같으면 같은 THREE.Texture 를
// 돌려준다.** 키에 크기·색공간·repeat 이 들어가므로 뜻이 다른 텍스처가
// 섞일 일은 없다. glTF 익스포터도 같은 객체면 이미지를 한 장만 쓴다.
const contentCache = new Map();
onSceneReset('텍스처 내용 캐시', () => contentCache.clear());

// 32비트 둘을 병렬로 굴린다 — 하나(FNV-1a)면 수백 장 규모에서 생일 충돌이
// 이론상 남고, 충돌은 "조용히 엉뚱한 그림" 이라 던질 기회도 없다.
// **4바이트 워드로 돈다** — 바이트 루프는 씬 전체 픽셀(수십 MB)에 1초를
// 썼다 (2026-08-08 __steps 실측 — 재질 단계의 대부분). ImageData 버퍼는
// 픽셀당 4바이트라 워드로 나눠떨어지고, 같은 바이트열이면 해시도 같다.
function hashPixels(d) {
  const w = new Uint32Array(d.buffer, d.byteOffset, d.byteLength >> 2);
  let a = 0x811c9dc5;
  let b = 0x9e3779b9;
  for (let i = 0; i < w.length; i++) {
    const v = w[i];
    a = Math.imul(a ^ v, 0x01000193);
    b = (b + (v & 0xffff) + Math.imul(v >>> 16, 31) + (b << 6) + (b >>> 2)) | 0;
  }
  return (a >>> 0).toString(36) + '.' + (b >>> 0).toString(36);
}

// 기울기 증폭. 높이차를 노말로 바꿀 때 얼마나 과장할지.
// 3.2로 두면 자갈처럼 픽셀 단위로 높이가 튀는 텍스처에서 노말이 거의 수평으로 누워
// 대부분의 픽셀이 광원 반대쪽을 향한다. 브라우저는 ACES 톤매핑이 가려주지만
// 톤매핑이 없는 엔진(Unity Built-in)에서는 표면이 새카맣게 죽는다.
const NORMAL_STRENGTH = 1.4;

// 픽셀 루프 한 번으로 색상·거칠기·노말을 함께 만든다.
//
//   size         정수 하나(정방형) 또는 [폭, 높이]
//   fn(u, v, o)  — o 에 써서 출력한다
//     o.c  [r,g,b]  0..255 색상 (sRGB)
//     o.r  0..1     거칠기
//     o.h  0..1     높이 (2차 패스에서 노말맵으로 변환)
//     o.e  [r,g,b]  0..255 발광 — opts.emissive 를 켰을 때만 읽는다
//
// ── v 축 방향 (실측으로 확인) ───────────────────────────────────────────────
//   **v = 0 이 물체의 위쪽이다.**
// v 는 캔버스의 행 인덱스(0 = 이미지 맨 위)이고, CanvasTexture 의 flipY=true 가
// 이미지를 뒤집어 UV v=0 이 이미지 아래를 가리키게 만든다. 두 번 뒤집혀서
// 결과적으로 **작은 v 가 위**가 된다.
//
// 이걸 반대로 알고 점포 정면(어두운 기단이 위로) 과 인물 광고판(입이 눈 위로)을
// 거꾸로 그린 적이 있다. 위아래가 다른 텍스처를 만들 때는 `const up = 1 - v;`
// 처럼 이름을 붙여 쓰는 편이 헷갈리지 않는다.
//
// 비정방형을 지원하는 이유: 세로 간판(1:6)이나 가로 배너(2:1)를 정방형으로 굽고
// UV로 늘리면 글자가 찌그러진다. 텍스처 비율을 형상에 맞추면 그럴 일이 없다.
//
// opts.emissive 를 켜면 emissiveMap 을 추가로 굽는다. 기본은 끔 — 켜면 텍스처가
// 장당 3장에서 4장으로 늘어나고, 발광이 없는 씬에서는 낭비다.
export function bake(size, rx, ry, fn, opts = {}) {
  const [sw, sh] = Array.isArray(size) ? size : [size, size];
  const emissive = !!opts.emissive;
  const mk = () => {
    const c = document.createElement('canvas');
    c.width = sw;
    c.height = sh;
    return c;
  };
  const cc = mk();
  const cr = mk();
  const cn = mk();
  const ce = emissive ? mk() : null;
  const g1 = cc.getContext('2d');
  const g2 = cr.getContext('2d');
  const g3 = cn.getContext('2d');
  const g4 = emissive ? ce.getContext('2d') : null;
  const i1 = g1.createImageData(sw, sh);
  const i2 = g2.createImageData(sw, sh);
  const i3 = g3.createImageData(sw, sh);
  const i4 = emissive ? g4.createImageData(sw, sh) : null;
  const d1 = i1.data;
  const d2 = i2.data;
  const d3 = i3.data;
  const d4 = emissive ? i4.data : null;
  const o = { c: [0, 0, 0], r: 0.85, h: 0.5, e: [0, 0, 0] };

  // 1차: 색·거칠기(·발광)를 쓰면서 높이는 따로 모은다
  const height = new Float32Array(sw * sh);
  for (let y = 0; y < sh; y++) {
    for (let x = 0; x < sw; x++) {
      if (emissive) o.e[0] = o.e[1] = o.e[2] = 0;
      fn(x / sw, y / sh, o);
      const i = (y * sw + x) * 4;
      d1[i] = o.c[0];
      d1[i + 1] = o.c[1];
      d1[i + 2] = o.c[2];
      d1[i + 3] = 255;
      d2[i] = d2[i + 1] = d2[i + 2] = o.r * 255;
      d2[i + 3] = 255;
      if (emissive) {
        d4[i] = o.e[0];
        d4[i + 1] = o.e[1];
        d4[i + 2] = o.e[2];
        d4[i + 3] = 255;
      }
      height[y * sw + x] = clamp(o.h, 0, 1);
    }
  }

  // 2차: 높이맵 -> 탄젠트 공간 노말맵.
  // glTF에는 범프맵이 없다. 범프로 내보내면 EXT_materials_bump(비표준 확장)가 되어
  // 블렌더도 Unity도 통째로 버린다. 노말맵은 glTF 표준이라 그대로 살아간다.
  // 인덱스를 폭·높이로 각각 wrap해서 이음선 없는 타일링을 유지한다.
  for (let y = 0; y < sh; y++) {
    const yUp = (y - 1 + sh) % sh;
    const yDn = (y + 1) % sh;
    for (let x = 0; x < sw; x++) {
      const xL = (x - 1 + sw) % sw;
      const xR = (x + 1) % sw;
      const dx = (height[y * sw + xR] - height[y * sw + xL]) * NORMAL_STRENGTH;
      const dy = (height[yDn * sw + x] - height[yUp * sw + x]) * NORMAL_STRENGTH;
      const nx = -dx;
      const ny = dy;
      const inv = 1 / Math.sqrt(nx * nx + ny * ny + 1);
      const i = (y * sw + x) * 4;
      d3[i] = (nx * inv * 0.5 + 0.5) * 255;
      d3[i + 1] = (ny * inv * 0.5 + 0.5) * 255;
      d3[i + 2] = (inv * 0.5 + 0.5) * 255;
      d3[i + 3] = 255;
    }
  }

  g1.putImageData(i1, 0, 0);
  g2.putImageData(i2, 0, 0);
  g3.putImageData(i3, 0, 0);
  if (emissive) g4.putImageData(i4, 0, 0);

  // 내용이 같으면 캐시의 텍스처를 그대로 쓴다 (파일 머리의 contentCache 참고).
  // 새로 만든 것만 센다 — 공유된 장은 GPU 에 한 번만 오른다.
  const share = (cv, d, srgb) => {
    const key = `${sw}x${sh}:${rx},${ry}:${srgb ? 's' : 'l'}:${hashPixels(d)}`;
    let t = contentCache.get(key);
    if (!t) {
      t = toTexture(cv, srgb, rx, ry);
      contentCache.set(key, t);
      textureStats.count += 1;
    }
    return t;
  };
  const set = {
    map: share(cc, d1, true),
    roughnessMap: share(cr, d2, false),
    normalMap: share(cn, d3, false),
  };
  if (emissive) set.emissiveMap = share(ce, d4, true);
  return set;
}

// 방사형 감쇠 한 장. 중심이 흰색이고 바깥으로 검게 사라진다.
//
// 쓰임: 가로등·간판 아래 "빛 웅덩이". 광원을 못 늘리는 상황에서 표면이 밝아
// 보이게 만드는 가장 값싼 방법이고, 실제로 동적 조명 이전의 게임들이 쓴 방법이다.
// 가산합성으로 바닥에 깔면 젖은 노면에 빛이 고인 것처럼 보인다.
//
// power 가 클수록 중심에 몰린다. 1.0 은 원뿔처럼 딱딱하고, 2~3 이 빛답다.
export function radialTexture(size = 256, power = 2.4) {
  const cv = document.createElement('canvas');
  cv.width = cv.height = size;
  const ctx = cv.getContext('2d');
  const img = ctx.createImageData(size, size);
  const d = img.data;
  const c = (size - 1) / 2;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = (x - c) / c;
      const dy = (y - c) / c;
      const r = Math.min(1, Math.sqrt(dx * dx + dy * dy));
      const v = Math.pow(1 - r, power) * 255;
      const i = (y * size + x) * 4;
      d[i] = d[i + 1] = d[i + 2] = v;
      d[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);

  const t = new THREE.CanvasTexture(cv);
  // 타일링하면 안 된다 — 가장자리가 이어지면 웅덩이가 격자로 반복된다
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = ANISO;
  t.needsUpdate = true;
  textureStats.count += 1;
  return t;
}

// 수직 그라디언트 한 장. 하늘돔 배경에 쓴다.
// stops: [[0..1 위치, '#rrggbb'], ...]
export function gradientTexture(stops, height = 256) {
  const w = 16;
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = height;
  const ctx = cv.getContext('2d');
  const grad = ctx.createLinearGradient(0, 0, 0, height);
  for (const [at, color] of stops) grad.addColorStop(at, color);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, height);

  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = THREE.ClampToEdgeWrapping;
  t.wrapT = THREE.ClampToEdgeWrapping;
  textureStats.count += 1;
  return t;
}
