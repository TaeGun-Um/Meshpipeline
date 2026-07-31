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

    // ── 골목 벽 (때 탄 콘크리트) ──────────────────────────────────────────
    //
    // 골목 벽에 도시 공용 패널 텍스처를 썼더니 **너무 깨끗했다.** 뒷골목인데
    // 정면과 같은 마감으로 보였다. 뒷면을 뒷면으로 만드는 것은 형상보다
    // 표면이다 — 배관이 지나간 자국, 물 흘러내린 줄, 밑동의 때, 낙서.
    //
    // 낙서는 글자를 그리지 않는다. 스프레이 낙서가 낙서로 읽히는 이유는
    // 내용이 아니라 **불규칙한 색 덩어리가 벽 아래쪽에 몰려 있다**는 것이다.
    // 저해상도에서 글자를 흉내내면 노이즈로만 보인다.
    alleyWall(seed = 7600) {
      const grain = tiledFbm(seed + 1, 44, 4);
      const stain = tiledFbm(seed + 2, 5, 4);
      const streak = tiledFbm(seed + 3, 2, 3);
      const tag = tiledFbm(seed + 4, 9, 3);
      const rows = 5;

      return bake(512, 1, 1, (u, v, o) => {
        // v=0 이 위다 (core/textures.js 의 실측 주석 참고).
        // 아래로 갈수록 더러워지므로 '아래쪽 정도' 를 이름 붙여 쓴다.
        const down = v;
        const gn = grain(u, v);
        const seam = (v * rows) % 1 < 0.035;

        let r = S.panel[0] * (0.86 + gn * 0.24);
        let g = S.panel[1] * (0.86 + gn * 0.24);
        let bl = S.panel[2] * (0.86 + gn * 0.24);
        let rough = 0.86 + gn * 0.1;
        let h = 0.5 + (gn - 0.5) * 0.3;

        // 패널 줄눈
        if (seam) {
          r *= 0.55; g *= 0.55; bl *= 0.55;
          h -= 0.35;
        }

        // 물 흘러내린 줄 — 세로로 길게 늘인 노이즈. 위에서 시작해 아래로 번진다.
        const runs = smoothstep(0.54, 0.9, streak(u * 0.4, v * 0.05)) * smoothstep(0.05, 0.6, down);
        r *= 1 - runs * 0.4; g *= 1 - runs * 0.38; bl *= 1 - runs * 0.3;
        rough += runs * 0.06;

        // 밑동의 때 — 바닥에서 올라온 얼룩
        const soil = smoothstep(0.55, 1.0, down) * (0.35 + stain(u, v) * 0.4);
        r *= 1 - soil * 0.45; g *= 1 - soil * 0.45; bl *= 1 - soil * 0.42;

        // 낙서 — 아래쪽 1/3 에만. 색 덩어리 둘을 다른 주파수로 겹친다.
        if (down > 0.62) {
          const t = tag(u, v);
          const near = smoothstep(0.62, 0.78, down);
          if (t > 0.72) {
            const k = smoothstep(0.72, 0.84, t) * near * 0.85;
            r = lerp(r, 196, k); g = lerp(g, 42, k); bl = lerp(bl, 120, k);
          } else if (t < 0.24) {
            const k = smoothstep(0.24, 0.12, t) * near * 0.7;
            r = lerp(r, 60, k); g = lerp(g, 200, k); bl = lerp(bl, 170, k);
          }
        }

        o.c[0] = clamp(r, 0, 255);
        o.c[1] = clamp(g, 0, 255);
        o.c[2] = clamp(bl, 0, 255);
        o.r = clamp(rough, 0, 1);
        o.h = clamp(h, 0, 1);
      });
    },

    // ── 잡물건 (금속 통·상자·컨테이너) ────────────────────────────────────
    //
    // 쓰레기통·팔레트 상자·컨테이너가 **실루엣으로만** 보인다는 지적이 계속
    // 있었다. 형태는 잡혔는데 표면이 없어서다 — 골목 벽이 같은 문제였고
    // alleyWall 텍스처로 해결했다. 잡물건도 같다.
    //
    // 세 가지가 있어야 금속 통으로 읽힌다.
    //   1) 세로 리브   원통·각통을 찍어낼 때 생기는 보강 골. 빛을 끊어 준다.
    //   2) 녹과 긁힘   아래쪽에 몰린다. 바닥에 끌고 다닌 흔적이다.
    //   3) 스텐실 표식 글자를 그리지 않는다. 저해상도에서 글자는 노이즈일 뿐이고,
    //                  **밝은 사각 블록 몇 개**만 있어도 도장 표식으로 읽힌다.
    //
    // tint 로 색을 받는다 — 쓰레기통(녹색)·상자(갈색)·컨테이너(청색)가
    // 같은 레시피를 공유하되 색만 다르다. 텍스처 장수를 아끼는 방법이다.
    metalCrate(seed = 7700, tint = [64, 82, 70]) {
      const grain = tiledFbm(seed + 1, 40, 3);
      const rust = tiledFbm(seed + 2, 7, 4);
      const scuff = tiledFbm(seed + 3, 18, 3);
      const ribs = 9;

      return bake(256, 1, 1, (u, v, o) => {
        // v = 0 이 위다 (core/textures.js 실측 주석). 아래쪽이 더 상한다.
        const down = v;
        const gn = grain(u, v);

        // 세로 리브 — 이게 없으면 매끈한 색판이다
        const rib = Math.cos(u * Math.PI * 2 * ribs);
        const shade = 1 + rib * 0.14;

        let r = tint[0] * shade * (0.86 + gn * 0.26);
        let g = tint[1] * shade * (0.86 + gn * 0.26);
        let bl = tint[2] * shade * (0.86 + gn * 0.26);
        let rough = 0.72 + gn * 0.14;

        // 테두리 보강 — 위아래 끝의 접힌 부분
        const edge = down < 0.06 || down > 0.94;
        if (edge) { r *= 1.14; g *= 1.14; bl *= 1.14; }

        // 긁힘 — 아래쪽에 몰린다. 바닥에 끌고 다닌 자국이다.
        const sc = smoothstep(0.62, 0.92, scuff(u, v)) * smoothstep(0.25, 1.0, down);
        r = lerp(r, 132, sc * 0.5);
        g = lerp(g, 128, sc * 0.5);
        bl = lerp(bl, 124, sc * 0.5);
        rough -= sc * 0.2;

        // 녹 — 아래쪽 가장자리부터
        const rs = smoothstep(0.58, 0.9, rust(u, v)) * smoothstep(0.35, 1.0, down);
        r = lerp(r, 116, rs * 0.72);
        g = lerp(g, 62, rs * 0.72);
        bl = lerp(bl, 38, rs * 0.72);
        rough += rs * 0.2;

        // 스텐실 표식 — 위쪽 1/3 에 밝은 사각 블록 셋.
        // 글자를 그리지 않는 이유는 shared/glyphs.js 의 원칙과 같다.
        if (down > 0.14 && down < 0.34) {
          const cell = Math.floor(u * 7);
          const fx = u * 7 - cell;
          const mark = (cell === 1 || cell === 3 || cell === 4) && fx > 0.2 && fx < 0.8;
          if (mark) {
            r = lerp(r, 196, 0.62); g = lerp(g, 196, 0.62); bl = lerp(bl, 190, 0.62);
          }
        }

        o.c[0] = clamp(r, 0, 255);
        o.c[1] = clamp(g, 0, 255);
        o.c[2] = clamp(bl, 0, 255);
        o.r = clamp(rough, 0, 1);
        // 리브를 높이에도 실어 노말맵이 골을 만들게 한다
        o.h = clamp(0.5 + rib * 0.3 - rs * 0.2, 0, 1);
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
