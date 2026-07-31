// 파사드 시트 — 건물 한 면을 통째로 덮는 큰 텍스처.
//
// ── 왜 따로 두는가 ─────────────────────────────────────────────────────────
// surfaces.js 의 재질과 결정적으로 다른 점: 이것들은 **창문 격자를 담는다**.
// 창이 켜졌는지 꺼졌는지, 어느 층이 통째로 밝은지가 야간 도시의 표정 전부다.
// 그래서 시드로 층·칸 단위 난수를 뽑고 emissive 를 함께 굽는다.
//
// ── 해상도 예산 (실측) ─────────────────────────────────────────────────────
// 시트 하나가 가로 15m x 세로 50m 를 덮는다. 512 면 미터당 34x10 픽셀이고,
// 건물이 30m 앞에 있을 때의 화면 밀도(약 10px/m)보다 이미 3배 위다.
// 1024 로 두면 이 세 레시피가 굽는 시트 10장만으로 VRAM 214MB 를 먹었다 —
// 텍스처 전체 350MB 의 61% 였다. 512 로 내려 189MB 가 됐고 화면 차이는 없다.
//
// 팔레트(S)는 씬이 주입한다 — urban/index.js 의 주석 참고.
import { bake, hash2 } from '../../core/textures.js';
import { tiledFbm, lerp, clamp, smoothstep } from '../../core/noise.js';
import { NEON, rgb255 } from '../neon.js';

export function facadeTextures(S) {
  return {
    // ── 창문 시트 ─────────────────────────────────────────────────────────
    //
    // 건물 정면 한 장에 층·호가 격자로 들어간 텍스처. 창마다 점등 여부와 색온도가
    // 다르다. 발광은 emissive 로만 나가고 실제 광원은 쓰지 않는다 — 창이 수만
    // 개인데 광원을 달면 엔진 포워드 렌더링이 무너진다.
    //
    // 격자를 촘촘히(140칸 이상) 잡는 이유가 색 분포에 있다. 6x8(48칸)로 굽고
    // 마젠타 확률 5% 를 줬을 때, 실제로 구운 텍스처를 세어 보니 어떤 시트는
    // 마젠타가 16.7% 였다. 켜진 창이 25개면 확률 5% 가 4개로 뭉치는 일이 흔하고,
    // 그 시트를 쓴 건물 전부가 "마젠타 건물" 이 된다.
    // tints 로 색온도 분포를 바꿀 수 있다 — **구역을 가르는 가장 큰 수단**이다.
    //
    // 인도 폭·시설물·가로등 색을 구역마다 다르게 해도 도시가 비슷해 보였다.
    // 화면의 90% 는 건물 외피이고, 그 외피가 밤에 무엇으로 읽히느냐는
    // **창문 불빛의 색과 밀도**다. 그게 모든 구역에서 같으면 나머지를 아무리
    // 다르게 해도 같은 도시로 보인다.
    windowSheet(seed, { cols = 10, rows = 14, litRate = 0.42, tints = null } = {}) {
      const grime = tiledFbm(seed + 11, 4, 4);
      const glass = tiledFbm(seed + 12, 30, 3);

      // 기본 색온도 분포. 색 창은 합쳐 5% 아래다 — shared/neon.js 의 원칙 참고.
      const TINTS = tints || [
        { c: rgb255(NEON.warm), w: 50 },
        { c: rgb255(NEON.cool), w: 32 },
        { c: rgb255(NEON.amber), w: 13 },
        { c: rgb255(NEON.cyan), w: 2.5 },
        { c: rgb255(NEON.magenta), w: 1.6 },
        { c: rgb255(NEON.green), w: 0.9 },
      ];
      const total = TINTS.reduce((a, t) => a + t.w, 0);
      const pickTint = (h) => {
        let acc = h * total;
        for (const t of TINTS) {
          acc -= t.w;
          if (acc <= 0) return t.c;
        }
        return TINTS[0].c;
      };

      // 셀 상태를 한 곳에서 정한다 — 벽 픽셀도 자기 셀의 점등 상태를 알아야 한다
      const cellState = (cx, cy) => {
        const hLit = hash2(cx * 31 + seed, cy * 17 + seed);
        const hTint = hash2(cx * 13 + seed, cy * 29 + seed);
        const hBright = hash2(cx * 7 + seed, cy * 41 + seed);
        const curtain = hBright < 0.34;
        return {
          lit: hLit < litRate,
          tint: pickTint(hTint),
          level: curtain ? 0.18 + hBright * 0.26 : 0.5 + hBright * 0.34,
        };
      };

      // 해상도 512 는 실측으로 정했다. 시트 하나가 가로 15m·세로 50m 를 덮으므로
      // 512 면 미터당 34x10 픽셀이고, 건물이 30m 앞에 있을 때 화면 밀도(약 10px/m)
      // 보다 이미 3배 위다. 1024 로 두면 파사드 시트 10장만으로 VRAM 214MB 를
      // 먹는다 — 텍스처 전체 350MB 중 61% 였다.
      const set = bake(
        512,
        1,
        1,
        (u, v, o) => {
          const cx = Math.floor(u * cols);
          const cy = Math.floor(v * rows);
          const fx = u * cols - cx;
          const fy = v * rows - cy;
          const gn = glass(u, v);
          const cell = cellState(cx, cy);

          // 창이 셀에서 차지하는 비율. 0.12~0.88 로 넓게 잡았더니 창 하나가
          // 셀을 거의 채워 벽이 안 보이고, 멀리서 보면 밝은 사각형만 남았다.
          // 벽을 넉넉히 남겨야 층·기둥의 리듬이 읽힌다.
          const inX = fx > 0.2 && fx < 0.8;
          const inY = fy > 0.26 && fy < 0.76;

          if (!inX || !inY) {
            // ── 벽면 ──
            const soil = smoothstep(0.6, 0.95, grime(u, v)) * 0.35;
            let base = lerp(S.tileWall[0] + gn * 10 - 5, 18, soil);

            // 층 사이 슬래브 — 수평 리듬을 만든다
            const slab = fy > 0.9 || fy < 0.06;
            if (slab) base *= 0.55;

            o.c[0] = base;
            o.c[1] = base - 2;
            o.c[2] = base + 4;
            o.r = 0.88;
            o.h = slab ? 0.3 : 0.6 + gn * 0.2;

            // ── 창빛 번짐 ──
            // 이 텍스처의 핵심. 발광 표면은 주변을 밝히지 않으므로 켜진 창 옆
            // 벽은 새카맣게 남고, 건물이 "검은 판에 박힌 LED 점" 으로 보인다.
            // 창에서 벽으로 새는 빛을 미리 구워 넣으면 층이 띠로 읽히고 형태가 산다.
            if (cell.lit && !slab) {
              const dx = Math.max(0, Math.max(0.2 - fx, fx - 0.8)) / 0.2;
              const dy = Math.max(0, Math.max(0.26 - fy, fy - 0.76)) / 0.26;
              const d = Math.min(1, Math.hypot(dx, dy));
              const spill = Math.pow(1 - d, 2.2) * 0.17 * cell.level;
              o.e[0] = cell.tint[0] * spill;
              o.e[1] = cell.tint[1] * spill;
              o.e[2] = cell.tint[2] * spill;
            }
            return;
          }

          // 창틀 · 창살
          const edge = fx < 0.235 || fx > 0.765 || fy < 0.29 || fy > 0.73;
          const mullion = Math.abs(fx - 0.5) < 0.016 || Math.abs(fy - 0.51) < 0.013;
          if (edge || mullion) {
            o.c[0] = S.frame[0] + gn * 8;
            o.c[1] = S.frame[1] + gn * 8;
            o.c[2] = S.frame[2] + gn * 8;
            o.r = 0.66;
            o.h = 0.9;
            // 창틀도 조금 받는다 — 없으면 발광 창이 검은 테두리로 잘려 보인다
            if (cell.lit) {
              const k = 0.22 * cell.level;
              o.e[0] = cell.tint[0] * k;
              o.e[1] = cell.tint[1] * k;
              o.e[2] = cell.tint[2] * k;
            }
            return;
          }

          // ── 유리 ──
          if (!cell.lit) {
            // 꺼진 창: 거의 검고 아주 매끈해서 반대편 네온을 반사한다
            const k = 8 + gn * 10;
            o.c[0] = k;
            o.c[1] = k + 1;
            o.c[2] = k + 5;
            o.r = 0.08 + gn * 0.06;
            o.h = 0.1;
            return;
          }

          // 창 안쪽 밝기 불균일 — 통짜로 칠하면 스티커처럼 보인다
          const e = cell.level * (0.76 + gn * 0.36);
          o.c[0] = cell.tint[0] * 0.2;
          o.c[1] = cell.tint[1] * 0.2;
          o.c[2] = cell.tint[2] * 0.2;
          o.r = 0.14;
          o.h = 0.12;
          o.e[0] = clamp(cell.tint[0] * e, 0, 255);
          o.e[1] = clamp(cell.tint[1] * e, 0, 255);
          o.e[2] = clamp(cell.tint[2] * e, 0, 255);
        },
        { emissive: true }
      );

      // 격자 정보를 붙여 둔다. 벽면의 UV 배율을 계산할 때 필요하다 —
      // 창 한 칸이 실제로 몇 미터인지 알아야 층고가 맞는다.
      set.grid = { cols, rows };
      return set;
    },

    // ── 유리 커튼월 ───────────────────────────────────────────────────────
    //
    // 창문 시트와 완전히 다른 건물 유형이다. 벽에 창을 뚫은 게 아니라 **유리가
    // 곧 벽**이라, 층마다 유리 띠와 스팬드럴(불투명 허리띠) 띠가 번갈아 나온다.
    //
    // 야간에는 대부분 어둡고 반사만 하며, 몇 개 층이 통째로 켜져 있다.
    // 이 "넓은 어두운 면"이 도시에 시선이 쉴 곳을 만든다 — 모든 건물이 창문
    // 격자로 반짝이면 화면이 균일한 잡음이 되고 위계가 사라진다.
    curtainWall(seed, { floors = 16, bays = 14, floorLit = 0.1, bayLit = 0.09 } = {}) {
      const smudge = tiledFbm(seed + 3, 6, 3);

      // 해상도 512 는 실측으로 정했다. 시트 하나가 가로 15m·세로 50m 를 덮으므로
      // 512 면 미터당 34x10 픽셀이고, 건물이 30m 앞에 있을 때 화면 밀도(약 10px/m)
      // 보다 이미 3배 위다. 1024 로 두면 파사드 시트 10장만으로 VRAM 214MB 를
      // 먹는다 — 텍스처 전체 350MB 중 61% 였다.
      const set = bake(
        512,
        1,
        1,
        (u, v, o) => {
          const fy = v * floors;
          const fi = Math.floor(fy);
          const ff = fy - fi;
          const sm = smudge(u, v);

          // 층 하부 38% 는 스팬드럴(불투명 판), 상부는 유리
          const spandrel = ff > 0.62;
          // 층 사이 슬래브 선
          const slab = ff > 0.94 || ff < 0.03;

          if (slab) {
            const k = S.panel[0] * 0.55 + sm * 8;
            o.c[0] = k;
            o.c[1] = k;
            o.c[2] = k + 4;
            o.r = 0.9;
            o.h = 0.2;
            return;
          }

          if (spandrel) {
            const k = S.panel[0] * 0.8 + sm * 10;
            o.c[0] = k;
            o.c[1] = k + 1;
            o.c[2] = k + 7;
            o.r = 0.55;
            o.h = 0.62;
            return;
          }

          // 수직 멀리언
          const bx = u * bays;
          const bi = Math.floor(bx);
          const bf = bx - bi;
          if (bf < 0.055 || bf > 0.945) {
            o.c[0] = S.frame[0];
            o.c[1] = S.frame[1];
            o.c[2] = S.frame[2] + 3;
            o.r = 0.5;
            o.h = 0.85;
            return;
          }

          // ── 유리 ──
          // 층 전체가 켜지거나(청소·야근층) 한 베이만 켜진다
          const litFloor = hash2(fi * 91 + seed, 7) < floorLit;
          const litBay = litFloor || hash2(bi * 37 + seed, fi * 53 + seed) < bayLit;

          if (!litBay) {
            // 꺼진 유리: 거의 검고 아주 매끈해 반대편 네온을 반사한다.
            // 이 반사가 커튼월 건물의 전부다.
            const k = 7 + sm * 9;
            o.c[0] = k;
            o.c[1] = k + 1;
            o.c[2] = k + 6;
            o.r = 0.05 + sm * 0.04;
            o.h = 0.1;
            return;
          }

          const warm = hash2(bi * 13 + seed, fi * 17 + seed) < 0.6;
          const tint = warm ? rgb255(NEON.warm) : rgb255(NEON.cool);
          const level = (litFloor ? 0.55 : 0.42) * (0.8 + sm * 0.4);

          o.c[0] = tint[0] * 0.18;
          o.c[1] = tint[1] * 0.18;
          o.c[2] = tint[2] * 0.18;
          o.r = 0.1;
          o.h = 0.12;
          o.e[0] = clamp(tint[0] * level, 0, 255);
          o.e[1] = clamp(tint[1] * level, 0, 255);
          o.e[2] = clamp(tint[2] * level, 0, 255);
        },
        { emissive: true }
      );
      set.grid = { cols: bays, rows: floors };
      return set;
    },

    // ── 펀칭 콘크리트 ─────────────────────────────────────────────────────
    //
    // 유리 커튼월의 반대편. 벽이 주인공이고 창은 뚫린 구멍이다.
    // 창이 작고 드물어서 **넓은 무지 벽면**이 남는다 — 이것도 시선이 쉴 곳이다.
    // 창을 깊게 파인 것처럼 보이게 위쪽에 그림자를 넣는 게 핵심이다.
    punchedConcrete(seed, { cols = 7, rows = 10, litRate = 0.3 } = {}) {
      const grain = tiledFbm(seed + 1, 30, 4);
      const stain = tiledFbm(seed + 2, 4, 4);

      // 해상도 512 는 실측으로 정했다. 시트 하나가 가로 15m·세로 50m 를 덮으므로
      // 512 면 미터당 34x10 픽셀이고, 건물이 30m 앞에 있을 때 화면 밀도(약 10px/m)
      // 보다 이미 3배 위다. 1024 로 두면 파사드 시트 10장만으로 VRAM 214MB 를
      // 먹는다 — 텍스처 전체 350MB 중 61% 였다.
      const set = bake(
        512,
        1,
        1,
        (u, v, o) => {
          const cx = Math.floor(u * cols);
          const cy = Math.floor(v * rows);
          const fx = u * cols - cx;
          const fy = v * rows - cy;
          const gn = grain(u, v);

          // 창 개구부 — 작다
          const inX = fx > 0.3 && fx < 0.7;
          const inY = fy > 0.34 && fy < 0.7;

          if (!inX || !inY) {
            const soil = smoothstep(0.62, 0.96, stain(u, v)) * 0.4;
            let base = lerp(S.concrete[0] * 0.72 + gn * 14 - 7, 18, soil);
            // 창 위쪽 인방(引枋) 그림자 — 창이 벽에 깊이 박힌 것처럼 보이게
            if (inX && fy >= 0.7 && fy < 0.78) base *= 0.45;
            o.c[0] = base;
            o.c[1] = base - 1;
            o.c[2] = base + 3;
            o.r = 0.92;
            o.h = 0.66 + gn * 0.2;
            return;
          }

          const lit = hash2(cx * 29 + seed, cy * 41 + seed) < litRate;
          if (!lit) {
            const k = 6 + gn * 7;
            o.c[0] = k;
            o.c[1] = k;
            o.c[2] = k + 4;
            o.r = 0.12;
            o.h = 0.08;
            return;
          }

          const warm = hash2(cx * 7 + seed, cy * 11 + seed) < 0.72;
          const tint = warm ? rgb255(NEON.warm) : rgb255(NEON.amber);
          const level = 0.34 + hash2(cx * 3 + seed, cy * 5 + seed) * 0.3;

          o.c[0] = tint[0] * 0.18;
          o.c[1] = tint[1] * 0.18;
          o.c[2] = tint[2] * 0.18;
          o.r = 0.2;
          o.h = 0.1;
          o.e[0] = clamp(tint[0] * level, 0, 255);
          o.e[1] = clamp(tint[1] * level, 0, 255);
          o.e[2] = clamp(tint[2] * level, 0, 255);
        },
        { emissive: true }
      );
      set.grid = { cols, rows };
      return set;
    },
  };
}
