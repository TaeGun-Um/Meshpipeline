// 야간 도시 재질 레시피 — 씬 사이에 공유된다.
//
// ── 팩토리인 이유 ──────────────────────────────────────────────────────────
// 레시피는 공유되지만 **알베도 팔레트는 씬이 정한다**. 골목과 도시가 같은
// 젖은 아스팔트를 쓰면서도 색은 다를 수 있어야 한다.
//
//   const T = urbanTextures(MY_SURFACE);
//   const asphalt = T.wetAsphalt();
//
// 굽는 방식은 core/textures.js 가 맡고, 여기는 "무엇을" 만 정한다.
//
// ── 셋으로 나눈 기준 ───────────────────────────────────────────────────────
// 한 파일 719줄이었을 때 "젖은 아스팔트 고치러 들어갔다가 커튼월 코드를
// 스크롤로 지나가는" 일이 반복됐다. 세 묶음은 성격이 실제로 다르다:
//
//   surfaces  넓은 면을 타일링으로 덮는다. 이음매가 없어야 한다.
//   facades   건물 한 면을 한 장이 덮는다. 창문 격자와 발광을 담는다.
//   shops     눈높이에서 읽힌다. 상품·선반 같은 '내용'이 있어야 한다.
//
// 합쳐서 하나의 평평한 객체로 돌려주므로 쓰는 쪽 코드는 그대로다.
import { DEFAULT_SURFACE } from '../neon.js';
import { surfaceTextures } from './surfaces.js';
import { facadeTextures } from './facades.js';
import { shopTextures } from './shops.js';

export function urbanTextures(surface = DEFAULT_SURFACE) {
  return {
    ...surfaceTextures(surface),
    ...facadeTextures(surface),
    ...shopTextures(surface),
  };
}
