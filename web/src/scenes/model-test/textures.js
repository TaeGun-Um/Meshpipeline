// 모델 테스트 씬의 재질 레시피. 굽는 방식은 core/textures.js 가 맡고, 여기는 "무엇을"만 정한다.
//
// 지금은 나무 하나뿐이다. 놓인 것이 상자 하나뿐이기 때문이고,
// 무엇을 지을지 정해지면 그때 늘린다.
import { bake, hash2 } from '../../core/textures.js';
import { tiledFbm, lerp, clamp } from '../../core/noise.js';

// 하늘 — 아래에서 위로. 테스트 무대는 중립이어야 한다. 색이 있는 하늘은 흰 상자를
// 물들여서 "이 재질이 원래 무슨 색인가" 를 못 보게 만든다.
export const SKY_STOPS = [
  [0.0, '#c8cdd4'],
  [0.35, '#b9c2cd'],
  [0.7, '#9fb0c6'],
  [1.0, '#8ba2bf'],
];

// ── 나무 판자 ──────────────────────────────────────────────────────────────
//
// 판자 여러 장을 가로로 쌓은 궤짝 판이다. 한 장의 텍스처가 상자 여섯 면에
// 그대로 들어간다 (BoxGeometry 는 면마다 UV 가 [0,1]² 이라 이어붙일 seam 이
// 없다). 그래서 결을 u 방향으로 늘리려고 노이즈를 비등방으로 샘플해도
// 타일 이음매 걱정이 없다 — 상자 밖에서 이 재질을 쓰게 되면 그때는 다르다.
export function woodTextures(seed = 3101) {
  const ROWS = 5; // 판자 다섯 장
  const GAP = 0.045; // 판자 사이 홈 (판자 높이 대비)

  const wob = tiledFbm(seed, 20, 4); // 결의 굽이
  const pore = tiledFbm(seed + 1, 110, 2); // 잔 결
  const wear = tiledFbm(seed + 2, 5, 3); // 닳고 바랜 자국

  return bake(512, 1, 1, (u, v, o) => {
    const f = v * ROWS;
    const row = Math.floor(f);
    const t = f - row; // 판자 안에서의 세로 위치 0..1

    // 판자마다 색이 조금씩 다르다. 같으면 다섯 장이 아니라 줄 그은 한 장이다.
    const tone = (hash2(row, 11) - 0.5) * 26;
    // 결은 판자를 따라 길게 흐른다 — u 를 눌러 샘플해 가로로 늘인다.
    const w = wob(u * 0.22 + row * 0.37, t * 0.5) - 0.5;
    const line = 0.5 + 0.5 * Math.sin((t * 6.5 + w * 3.2 + row * 0.9) * Math.PI * 2);
    const p = pore(u, v) - 0.5;

    const m = clamp(line * 0.7 + p * 0.5 + 0.15, 0, 1);
    let r = lerp(104, 158, m) + tone;
    let g = lerp(72, 118, m) + tone * 0.8;
    let b = lerp(44, 76, m) + tone * 0.6;

    // 바랜 자리 — 회색으로 뜬다. 안 넣으면 갓 켠 목재처럼 붉기만 하다.
    const pale = clamp((wear(u, v) - 0.56) * 3.4, 0, 1) * 0.45;
    r = lerp(r, 150, pale);
    g = lerp(g, 141, pale);
    b = lerp(b, 124, pale);

    let rough = 0.86 - m * 0.08 + pale * 0.06;
    let h = 0.45 + (line - 0.5) * 0.18 + p * 0.3;

    // 판자 사이 홈. 색과 높이를 같이 떨어뜨려야 홈으로 보인다 —
    // 색만 어둡게 하면 검은 줄을 그은 것이다.
    const edge = Math.min(t, 1 - t);
    if (edge < GAP) {
      const k = 1 - edge / GAP;
      r = lerp(r, 42, k * 0.85);
      g = lerp(g, 28, k * 0.85);
      b = lerp(b, 18, k * 0.85);
      h -= 0.4 * k;
      rough += 0.08 * k;
    }

    o.c[0] = r;
    o.c[1] = g;
    o.c[2] = b;
    o.r = clamp(rough, 0.4, 1);
    o.h = clamp(h, 0, 1);
  });
}
