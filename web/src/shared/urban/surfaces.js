// 지면·벽면 재질 — 도시 어디에나 깔리는 바탕.
//
// 여기 있는 다섯은 전부 **넓은 면적을 타일링으로 덮는** 텍스처다. 그래서
// 이음매가 없어야 하고(tiledFbm 사용), 해상도보다 미터당 반복 간격이 중요하다.
// 파사드 시트(facades.js)나 점포 텍스처(shops.js)와는 성격이 다르다 —
// 그쪽은 면 하나를 통째로 덮는 '한 장짜리' 라 타일링하지 않는다.
//
// 팔레트(S)는 씬이 주입한다 — urban/index.js 의 주석 참고.
import { bake, hash2 } from '../../core/textures.js';
import { tiledFbm, lerp, clamp, smoothstep } from '../../core/noise.js';

export function surfaceTextures(S) {
  return {
    // ── 젖은 아스팔트 ─────────────────────────────────────────────────────
    // 웅덩이가 야간 도시의 핵심 재질이다. 웅덩이는 색이 아니라 **거칠기**로
    // 만든다 — 거칠기를 0에 가깝게 떨어뜨리면 네온이 바닥에 반사돼 사이버펑크가
    // 된다. 알베도만 어둡게 칠하면 그냥 검은 얼룩이다.
    wetAsphalt(seed = 7100) {
      const agg = tiledFbm(seed + 1, 96, 2);
      const blotch = tiledFbm(seed + 2, 6, 4);
      const pond = tiledFbm(seed + 3, 3, 4);
      const crack = tiledFbm(seed + 4, 14, 3);

      return bake(1024, 1, 1, (u, v, o) => {
        const a = agg(u, v);
        const bl = blotch(u, v);

        let r = S.asphalt[0] + bl * 12;
        let g = S.asphalt[1] + bl * 11;
        let b = S.asphalt[2] + bl * 14;
        let rough = 0.86 + bl * 0.08;
        let h = a * 0.7 + bl * 0.3;

        // 골재 알갱이
        if (a > 0.8) {
          const k = (a - 0.8) / 0.2;
          r += 16 * k;
          g += 16 * k;
          b += 17 * k;
          rough -= 0.1 * k;
          h += 0.2 * k;
        }

        // 균열 — 얇고 어둡게
        const inCrack = smoothstep(0.52, 0.47, Math.abs(crack(u, v) - 0.5) * 2);
        if (inCrack > 0) {
          r = lerp(r, 12, inCrack * 0.8);
          g = lerp(g, 12, inCrack * 0.8);
          b = lerp(b, 15, inCrack * 0.8);
          h -= 0.3 * inCrack;
        }

        // 웅덩이. 임계값을 0.5 로 낮추면 온 도시가 물바다가 되어 노면 질감이 사라진다.
        const pd = smoothstep(0.62, 0.8, pond(u, v));
        if (pd > 0) {
          r = lerp(r, S.puddle[0], pd);
          g = lerp(g, S.puddle[1], pd);
          b = lerp(b, S.puddle[2], pd);
          rough = lerp(rough, 0.04, pd); // 여기서 반사가 생긴다
          h = lerp(h, 0.06, pd); // 물면은 평평하다
        }

        o.c[0] = r;
        o.c[1] = g;
        o.c[2] = b;
        o.r = clamp(rough, 0.03, 1);
        o.h = clamp(h, 0, 1);
      });
    },

    // ── 인도 (젖은 보도블록) ──────────────────────────────────────────────
    sidewalk(seed = 7200) {
      const grain = tiledFbm(seed + 1, 40, 3);
      const grime = tiledFbm(seed + 2, 5, 4);
      const pond = tiledFbm(seed + 3, 4, 3);
      const cols = 8;
      const rows = 8;

      return bake(512, 1, 1, (u, v, o) => {
        const cx = Math.floor(u * cols);
        const cy = Math.floor(v * rows);
        const fx = u * cols - cx;
        const fy = v * rows - cy;
        const gn = grain(u, v);
        const seam = fx < 0.04 || fx > 0.96 || fy < 0.04 || fy > 0.96;

        const h1 = hash2(cx * 5, cy * 11);
        let base = S.curb[0] + h1 * 10 + gn * 12 - 6;
        let rough = 0.9 - h1 * 0.06;
        let h = 0.62 + gn * 0.2;

        if (seam) {
          base *= 0.55;
          rough = 0.96;
          h = 0.18;
        }

        const soil = smoothstep(0.6, 0.95, grime(u, v)) * 0.45;
        base = lerp(base, 24, soil);

        let r = base;
        let g = base - 1;
        let b = base + 5;

        const pd = smoothstep(0.66, 0.86, pond(u, v));
        r = lerp(r, 14, pd);
        g = lerp(g, 15, pd);
        b = lerp(b, 20, pd);
        rough = lerp(rough, 0.12, pd);

        o.c[0] = r;
        o.c[1] = g;
        o.c[2] = b;
        o.r = clamp(rough, 0.05, 1);
        o.h = clamp(h, 0, 1);
      });
    },

    // ── 콘크리트 프리캐스트 패널 ──────────────────────────────────────────
    concretePanel(seed = 7300) {
      const grain = tiledFbm(seed + 1, 34, 4);
      const stain = tiledFbm(seed + 2, 4, 4);
      const streak = tiledFbm(seed + 3, 2, 3);
      const rows = 4;
      const cols = 2;

      return bake(512, 1, 1, (u, v, o) => {
        const fx = (u * cols) % 1;
        const fy = (v * rows) % 1;
        const gn = grain(u, v);

        let r = S.panel[0] + gn * 14 - 7;
        let g = S.panel[1] + gn * 14 - 7;
        let b = S.panel[2] + gn * 15 - 7;
        let rough = 0.9 + gn * 0.08;
        let h = 0.6 + gn * 0.3;

        // 패널 이음선
        if (fx < 0.018 || fx > 0.982 || fy < 0.014 || fy > 0.986) {
          r *= 0.5;
          g *= 0.5;
          b *= 0.55;
          rough = 0.96;
          h = 0.16;
        }

        // 비 자국 — 위에서 아래로 흐른 세로 줄무늬
        const runs = smoothstep(0.56, 0.92, streak(u * 0.35, v * 0.06)) * smoothstep(0.05, 0.55, v) * 0.5;
        r = lerp(r, 20, runs);
        g = lerp(g, 21, runs);
        b = lerp(b, 25, runs);

        const soil = smoothstep(0.66, 0.96, stain(u, v)) * 0.4;
        r = lerp(r, 18, soil);
        g = lerp(g, 18, soil);
        b = lerp(b, 22, soil);

        o.c[0] = r;
        o.c[1] = g;
        o.c[2] = b;
        o.r = clamp(rough, 0.4, 1);
        o.h = clamp(h, 0, 1);
      });
    },

    // ── 소형 타일 외벽 (동아시아 저층 상가 마감) ─────────────────────────
    tileWall(seed = 7400) {
      const grain = tiledFbm(seed + 1, 60, 3);
      const grime = tiledFbm(seed + 2, 5, 4);
      const cols = 24;
      const rows = 24;

      return bake(512, 1, 1, (u, v, o) => {
        const cx = Math.floor(u * cols);
        const cy = Math.floor(v * rows);
        const fx = u * cols - cx;
        const fy = v * rows - cy;
        const gn = grain(u, v);
        const grout = fx < 0.08 || fx > 0.92 || fy < 0.08 || fy > 0.92;

        const h1 = hash2(cx * 3, cy * 7);
        let r = S.tileWall[0] + h1 * 16 - 8 + gn * 8;
        let g = S.tileWall[1] + h1 * 14 - 7 + gn * 8;
        let b = S.tileWall[2] + h1 * 18 - 9 + gn * 8;
        // 타일은 유약이라 매끈하다 — 젖으면 반사가 붙는다
        let rough = 0.34 + h1 * 0.16;
        let h = 0.74;

        if (grout) {
          r *= 0.52;
          g *= 0.52;
          b *= 0.55;
          rough = 0.94;
          h = 0.22;
        }

        const soil = smoothstep(0.58, 0.94, grime(u, v)) * 0.5 * smoothstep(0, 0.5, 1 - v);
        r = lerp(r, 16, soil);
        g = lerp(g, 17, soil);
        b = lerp(b, 20, soil);
        rough = lerp(rough, 0.9, soil);

        o.c[0] = r;
        o.c[1] = g;
        o.c[2] = b;
        o.r = clamp(rough, 0.1, 1);
        o.h = clamp(h, 0, 1);
      });
    },

    // ── 골강판 셔터 (닫힌 점포) ───────────────────────────────────────────
    shutter(seed = 7500) {
      const grain = tiledFbm(seed + 1, 50, 3);
      const rust = tiledFbm(seed + 2, 8, 4);

      return bake(256, 1, 1, (u, v, o) => {
        // 가로 골
        const corr = Math.sin(v * Math.PI * 2 * 28);
        const gn = grain(u, v);
        const rs = smoothstep(0.7, 0.96, rust(u, v));
        const shade = 1 + corr * 0.3;

        let r = S.metal[0] * shade + gn * 10 - 5;
        let g = S.metal[1] * shade + gn * 10 - 5;
        let b = S.metal[2] * shade + gn * 10 - 5;
        r = lerp(r, S.rust[0], rs * 0.6);
        g = lerp(g, S.rust[1], rs * 0.6);
        b = lerp(b, S.rust[2], rs * 0.6);

        o.c[0] = r;
        o.c[1] = g;
        o.c[2] = b;
        o.r = clamp(0.48 + rs * 0.4, 0.25, 1);
        o.h = 0.5 + corr * 0.4;
      });
    },
  };
}
