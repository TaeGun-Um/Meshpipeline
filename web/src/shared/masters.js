// 파생 마스터 머티리얼 — 야간 도시 씬들이 공유한다.
//
// core/material.js 의 기본 마스터(TexturedSurface · SolidSurface · Glow ·
// Additive · Unlit)에서 파생한 것들이다. 파생은 상속이다: 기본값 일부를 바꾼
// 새 마스터를 만들고, 실제 머티리얼은 거기서 instance() 로 뽑는다.
//
//   Glow ─┬─ NeonTube    세기 1.0  — 네온관·간판 글자처럼 얇고 좁은 것
//         ├─ SoftGlow    세기 0.22 — 점포 실내·처마 밑처럼 넓은 면
//         └─ Beacon      세기 1.0  — 항공장애등 (런타임에 세기를 흔든다)
//
//   Additive ─┬─ LightPool   정점 컬러 — 웅덩이마다 색이 달라도 드로우콜 1개
//             └─ Headlight   단색     — 전조등 빛 (인스턴싱과 섞이지 않는다)
//
// ── 왜 세기를 등급으로 나누는가 ────────────────────────────────────────────
// 기준은 색이 아니라 **면적**이다. 블룸은 밝은 픽셀의 개수에 비례해 번지므로,
// 네온관처럼 얇은 것과 점포 실내처럼 넓은 것에 같은 세기를 주면 넓은 쪽이 통째로
// 흰 덩어리가 된다. 실제로 처음에 그렇게 됐다.
import { Glow, Additive, TexturedSurface, SolidSurface, Unlit } from '../core/material.js';
import { radialTexture } from '../core/textures.js';
import { NEON } from './neon.js';

// 기본 마스터도 여기서 재수출한다 — 씬이 import 를 한 곳에서 가져오면 된다.
export { TexturedSurface, SolidSurface, Glow, Additive, Unlit };

export const NeonTube = Glow.derive('NeonTube', { intensity: 1, tint: 0.06 });
export const SoftGlow = Glow.derive('SoftGlow', { intensity: 0.22, tint: 0.1 });
export const Beacon = Glow.derive('Beacon', { intensity: 1, tint: 0.05 });

// 빛 웅덩이 텍스처는 한 장이면 된다 — 수백 개 웅덩이가 같은 감쇠를 쓴다.
let radial = null;
export function radialFalloff() {
  if (!radial) radial = radialTexture(256, 2.4);
  return radial;
}

export const LightPool = Additive.derive('LightPool', { vertexColors: true, opacity: 1 });
export const Headlight = Additive.derive('Headlight', { vertexColors: false, opacity: 0.55 });

// ── 발광색 바로 쓰기 ───────────────────────────────────────────────────────
//
// 사용 지점에서 바로 부른다: neon(NEON.cyan)
//
// 미리 색마다 만들어 사전으로 넘기지 않는 이유가 둘 있다.
//   1) 쓰지 않는 색까지 만들어진다. 실제로 발광 재질 19개를 만들어 놓고 절반만
//      썼다 — 안 쓰는 머티리얼도 glTF 에는 실린다.
//   2) 캐시가 일할 여지가 없다. 중앙에서 한 번씩만 만들면 값이 같은 요청이
//      두 번 오지 않으므로 공유가 0회가 된다.
// 사용 지점에서 부르면 여러 모듈이 같은 색을 요청해도 객체는 하나다.
const NEON_NAME = Object.fromEntries(Object.entries(NEON).map(([k, v]) => [v, k]));
const nameOf = (color) => NEON_NAME[color] || `x${color.toString(16)}`;

// 얇고 좁은 발광 — 네온관, 간판 글자, 등화
export function neon(color) {
  return NeonTube.instance({ color }, `Neon_${nameOf(color)}`);
}

// 넓은 면의 발광 — 점포 실내, 처마 밑. 세기를 낮춰야 흰 덩어리가 되지 않는다.
export function neonSoft(color) {
  return SoftGlow.instance({ color }, `NeonSoft_${nameOf(color)}`);
}
