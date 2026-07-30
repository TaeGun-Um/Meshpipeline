// 점포 텍스처 — 1층 눈높이에 놓이는 것들.
//
// 카메라가 지상에 있을 때 화면의 절반이 이 두 장이다. 그래서 파사드 시트보다
// 훨씬 가까이서 읽히고, 상품·선반·간판 같은 '내용'이 있어야 한다.
//
// shopInterior 는 원래 통짜 발광면이었는데 "하얀 판때기" 로 보였다.
// 천장 조명 띠 / 선반과 상품 / 어두운 기단 이 셋을 넣자 비로소 가게가 됐다.
//
// 팔레트(S)는 씬이 주입한다 — urban/index.js 의 주석 참고.
import { bake, hash2 } from '../../core/textures.js';
import { tiledFbm, clamp } from '../../core/noise.js';
import { rgb255 } from '../neon.js';

export function shopTextures(S) {
  return {
    // ── 점포 실내 배경 ────────────────────────────────────────────────────
    //
    // 벽감 안쪽 벽에 붙는다. 여기를 통짜 발광면으로 두면 **거대한 백지**가 되어
    // 가게가 아니라 흰 판때기로 보인다. 실제로 그렇게 나왔다.
    //
    // 실내가 실내로 읽히려면 세 가지가 있어야 한다.
    //   1) 천장 조명 띠 — 가장 밝은 곳이 위에 있어야 "안에서 켠 불" 이다
    //   2) 선반과 상품 — 규칙적인 가로줄 + 그 위의 색색 블록
    //   3) 어두운 바닥 기단 — 밑이 어두워야 깊이가 생긴다
    // 통짜 면과 달리 밝기가 위에서 아래로 떨어지는 것이 핵심이다.
    shopInterior(seed, tintHex) {
      const tint = rgb255(tintHex);
      const grain = tiledFbm(seed + 7, 24, 3);
      const SHELVES = 4;
      const COLS = 18;

      return bake(
        [512, 256],
        1,
        1,
        (u, v, o) => {
          const up = 1 - v; // v=0 이 위 (core/textures.js bake 주석)
          const gn = grain(u, v);

          let level;
          let col = tint;

          if (up > 0.86) {
            // 천장 조명 띠 — 가장 밝다
            level = 1.0;
          } else if (up < 0.12) {
            // 바닥 기단
            level = 0.06;
          } else {
            // 선반 구간
            const t = (up - 0.12) / 0.74;
            const si = Math.floor(t * SHELVES);
            const sf = t * SHELVES - si;

            // 선반 판 — 얇은 어두운 가로줄
            if (sf < 0.1) {
              level = 0.1;
            } else {
              // 상품 — 칸마다 색과 높이가 다르다
              const ci = Math.floor(u * COLS);
              const cf = u * COLS - ci;
              const h = 0.25 + hash2(ci * 13 + seed, si * 29 + seed) * 0.5;
              const filled = sf < 0.1 + h && cf > 0.12 && cf < 0.88;
              if (filled) {
                // 상품 블록. 색을 조금씩 흔들어 진열대처럼 보이게.
                const k = hash2(ci * 7 + seed, si * 11 + seed);
                col = [
                  tint[0] * (0.45 + k * 0.5),
                  tint[1] * (0.4 + (1 - k) * 0.55),
                  tint[2] * (0.5 + k * 0.4),
                ];
                level = 0.38 + k * 0.3;
              } else {
                // 선반 뒤 벽 — 위로 갈수록 밝다 (천장 조명이 비추므로)
                level = 0.2 + t * 0.4;
              }
            }
          }

          level *= 0.88 + gn * 0.24;

          o.c[0] = col[0] * 0.14;
          o.c[1] = col[1] * 0.14;
          o.c[2] = col[2] * 0.14;
          o.r = 0.45;
          o.h = 0.5;
          o.e[0] = clamp(col[0] * level, 0, 255);
          o.e[1] = clamp(col[1] * level, 0, 255);
          o.e[2] = clamp(col[2] * level, 0, 255);
        },
        { emissive: true }
      );
    },

    // ── 점포 정면 ─────────────────────────────────────────────────────────
    //
    // 1층 점포를 단색 발광 평면 하나로 처리하면 "형광 페인트 칠한 판자" 가 된다.
    // 두 씬에서 두 번 그렇게 나왔다. 통짜 색면이 문제이므로 구조를 텍스처에 넣는다:
    //   아래쪽 기단(어두움) · 세로 창틀 · 유리 안쪽 진열대 실루엣 · 위쪽 간판 띠
    shopfront(seed, tintHex) {
      const tint = rgb255(tintHex);
      const noise = tiledFbm(seed + 5, 22, 3);
      const BAYS = 4;
      const PLINTH = 0.14;
      const HEADER = 0.82;

      return bake(
        [512, 256],
        1,
        1,
        (u, v, o) => {
          const gn = noise(u, v);
          // v=0 이 위다 (core/textures.js 의 bake 주석 참고). 아래에서부터 쌓는
          // 레이아웃이라 뒤집어 쓴다.
          const up = 1 - v;

          if (up < PLINTH) {
            const k = S.frame[0] * 1.3 + gn * 10;
            o.c[0] = k;
            o.c[1] = k;
            o.c[2] = k + 4;
            o.r = 0.8;
            o.h = 0.5;
            return;
          }

          if (up > HEADER) {
            // 간판 띠
            o.c[0] = tint[0] * 0.14;
            o.c[1] = tint[1] * 0.14;
            o.c[2] = tint[2] * 0.14;
            o.r = 0.5;
            o.h = 0.75;
            const k = 0.5 + gn * 0.2;
            o.e[0] = tint[0] * k;
            o.e[1] = tint[1] * k;
            o.e[2] = tint[2] * k;
            return;
          }

          // 세로 창틀
          const fb = u * BAYS - Math.floor(u * BAYS);
          if (fb < 0.045 || fb > 0.955) {
            o.c[0] = S.frame[0];
            o.c[1] = S.frame[1];
            o.c[2] = S.frame[2];
            o.r = 0.62;
            o.h = 0.92;
            return;
          }

          // 유리 — 실내 발광. 위가 밝고 아래로 어둡다 (천장 조명).
          // 0.42~0.92 로 잡았다가 되돌렸다. 점포 정면은 면적이 커서 그 밝기면
          // 블룸 임계값을 통째로 넘어 흰 상자가 된다.
          const t = (up - PLINTH) / (HEADER - PLINTH);
          let level = 0.26 + t * 0.3;

          // 실내 물체 실루엣.
          // fbm 을 그대로 쓰면 유기적 얼룩이 되어 "유리에 낀 무언가" 로 보인다.
          // 상점 안에 있는 것은 선반·상자라 실루엣이 직각이어야 한다.
          const SX = 14;
          const SY = 5;
          const sx = Math.floor(u * SX);
          const sy = Math.floor(t * SY);
          // 아래 칸일수록 물건이 많다 (선반은 바닥부터 찬다)
          if (hash2(sx * 19 + seed, sy * 31 + seed) < 0.5 - sy * 0.09) level *= 0.16;
          // 선반 자체 (가로 띠)
          if (t * SY - sy < 0.09) level *= 0.3;

          level *= 0.84 + gn * 0.32;

          o.c[0] = tint[0] * 0.12;
          o.c[1] = tint[1] * 0.12;
          o.c[2] = tint[2] * 0.12;
          o.r = 0.2;
          o.h = 0.2;
          o.e[0] = clamp(tint[0] * level, 0, 255);
          o.e[1] = clamp(tint[1] * level, 0, 255);
          o.e[2] = clamp(tint[2] * level, 0, 255);
        },
        { emissive: true }
      );
    },
  };
}
