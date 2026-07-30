// 공유 라이브러리 배럴.
//
// ── 세 계층 ────────────────────────────────────────────────────────────────
//   core/       엔진.   "어떻게" 만드는가. 씬을 하나도 몰라야 한다.
//               난수 · 노이즈 · 텍스처 굽기 · 지오메트리 병합 · 면 계산 ·
//               마스터 머티리얼 · 메시 조립 부모 클래스 · 씬 부모 클래스
//
//   shared/     레시피.  둘 이상의 씬이 쓰는 "무엇" 을 만든다.
//               네온 팔레트 · 도시 재질 · 표의문자 간판 · 빛 웅덩이 ·
//               항로 운동 · 하늘돔 · 파생 마스터
//
//   scenes/<씬>/ 그 장소만의 구성. 배치 · 치수 · 그 장소에만 있는 재질.
//
// 판단 기준은 하나다: **둘 이상의 씬이 실제로 쓰는가.** 쓰기 시작할 때 올리고,
// 미리 올리지 않는다. 한 씬만 쓰는 것을 shared 에 두면 어느 것이 어느 장소
// 것인지 알 수 없게 된다 (공터 재질 7종이 core 에 있던 시절의 문제).
export { NEON, SIGN_SCHEMES, DEFAULT_SURFACE, rgb255, rgb01 } from './neon.js';
export { urbanTextures } from './urban/index.js';
export { bannerTextures, bladeTextures, billboardTextures } from './glyphs.js';
export { createLightPools } from './lightpool.js';
export { Lane, makeLanes } from './movers.js';
export { createSkyDome } from './sky.js';
export {
  TexturedSurface,
  SolidSurface,
  Glow,
  Additive,
  Unlit,
  NeonTube,
  SoftGlow,
  Beacon,
  LightPool,
  Headlight,
  radialFalloff,
  neon,
  neonSoft,
} from './masters.js';
