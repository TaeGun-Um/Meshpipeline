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
import { NEON, rgb255 } from '../neon.js';
import { pictAt, glyphAt, latinAt, PICT_COUNT } from '../glyphs.js';

export function shopTextures(S) {
  return {
    // ── 잡거빌딩 세입자 창 (사용자 지적으로 새로 만듦) ────────────────────
    //
    // "번화가 타입의 건물 창문도, 아무리 생각해도 창문인데, 모자이크 창문과
    //  그 위에 창문마다 간판과 똑같은 형태의 리소스가 쓰이고 있고, 이게 너무
    //  복사 붙여넣기로 여기저기 쓰이고 있음"
    //
    // 맞았다. 잡거타워 위층에 `shopfront` 텍스처를 그대로 썼다. 그 텍스처는
    // **칸마다 간판 띠 + 그 아래 모자이크**로 되어 있다 — 1층 점포에는 맞지만
    // 8층 창문에 붙이면 층마다 간판이 넉 장씩 달린 꼴이다.
    //
    // 위층은 창문이어야 한다. 그런데 사무실 창(windowSheet)도 아니다 —
    // 잡거빌딩 위층은 **세입자가 제각각 쓰는 방**이라 창마다 사정이 다르다.
    //
    //   · 블라인드를 반쯤 내린 칸        가로줄 몇 개
    //   · 실외기를 매단 칸               창 아래 작은 상자
    //   · 창을 판자로 막은 칸            불이 아예 없다
    //   · 안이 훤한 칸                   따뜻한 빛
    // 규칙적인 격자 위에 이 넷을 섞는 것이 이 유형의 문법이다.
    // ── 한 장이 한 **층**을 덮는다 (사용자 지적으로 고침) ──────────────────
    //
    // "창문 자체를 키우던지 해서. 아예 저 창문이 모델링이 번잡스러우니까"
    //
    // 이 텍스처를 쓰는 곳(bazaar 의 windowBand·upperFacade)은 **층마다 한 장**
    // 을 붙인다. 그런데 3행짜리로 구워 놨으니 한 층에 창이 세 줄로 들어갔다 —
    // 층고 3.1m 에 창 세 줄이면 한 줄이 0.8m 다. 그래서 창이 작고 잘아 보였다.
    //
    // 한 행으로 굽는다. 그러면 같은 띠 안에서 창이 **세 배 키가 커진다** —
    // 실측 0.53m -> 1.60m. 칸 수도 6에서 4로 줄여 한 칸을 넓힌다.
    //
    // 비율(512x256 = 2:1)은 쓰는 쪽이 판을 자르는 근거다 (bazaar 의
    // WIN_ASPECT). 여기를 바꾸면 거기도 같이 봐야 한다.
    tenantWindows(seed, tintHex) {
      const warm = rgb255(tintHex);
      const grain = tiledFbm(seed + 3, 20, 3);
      const COLS = 4;
      const ROWS = 1;

      return bake([512, 256], 1, 1, (u, v, o) => {
        const gn = grain(u, v);
        const up = 1 - v;
        const ci = Math.min(COLS - 1, Math.floor(u * COLS));
        const ri = Math.min(ROWS - 1, Math.floor(up * ROWS));
        const cu = u * COLS - ci;
        const cv = up * ROWS - ri;
        const sid = seed + ci * 131 + ri * 977;

        // 벽 — 어둡고 지저분하다. 창 사이가 벽이라는 것이 읽혀야 한다
        o.c[0] = S.tileWall[0] * 0.56 + gn * 14;
        o.c[1] = S.tileWall[1] * 0.54 + gn * 14;
        o.c[2] = S.tileWall[2] * 0.60 + gn * 16;
        o.r = 0.86; o.h = 0.4;
        o.e[0] = 0; o.e[1] = 0; o.e[2] = 0;

        // 층 슬래브 — 칸 아래 15%
        if (cv < 0.15) return;

        // 창 구멍 — 칸 안에서 여백을 두고
        const inU = cu > 0.14 && cu < 0.86;
        const inV = cv > 0.26 && cv < 0.92;

        // 실외기 — 창 아래 턱에 매단다. 창보다 먼저 그린다
        const hasAC = hash2(sid, 17) < 0.34;
        if (hasAC && cv > 0.15 && cv < 0.26 && cu > 0.30 && cu < 0.70) {
          const k = 74 + gn * 12;
          o.c[0] = k; o.c[1] = k; o.c[2] = k + 5;
          o.r = 0.55; o.h = 0.7;
          return;
        }
        if (!inU || !inV) return;

        // 창틀
        const fu = (cu - 0.14) / 0.72;
        const fv = (cv - 0.26) / 0.66;
        const F = 0.07;
        if (fu < F || fu > 1 - F || fv < F || fv > 1 - F) {
          const k = 96;
          o.c[0] = k; o.c[1] = k; o.c[2] = k + 6;
          o.r = 0.5; o.h = 0.72;
          return;
        }

        // 점등률. 번화가라 대부분 켜져 있어야 한다 — 처음에 꺼진 칸을 62% 로
        // 뒀더니 잡거타워가 통째로 검은 벽이 됐다. 여기는 사람이 미어터지는
        // 구역이라는 것이 이 도시의 설정이다 (docs/city.md 3기).
        const state = hash2(sid, 43);
        // 판자로 막은 칸 — 불이 없다. 이 칸이 있어야 켜진 칸이 읽힌다
        if (state < 0.10) {
          const k = 58 + Math.floor(fv * 5) * 4 + gn * 8;
          o.c[0] = k; o.c[1] = k * 0.94; o.c[2] = k * 0.86;
          o.r = 0.9; o.h = 0.3;
          return;
        }
        // 꺼진 칸 — 유리만
        if (state < 0.28) {
          o.c[0] = 16; o.c[1] = 18; o.c[2] = 26;
          o.r = 0.14; o.h = 0.85;
          return;
        }

        // 켜진 칸. 색온도를 칸마다 흔든다 — 같은 색이면 사무실이다
        const hue = hash2(sid, 71);
        const col = hue < 0.62 ? warm
          : hue < 0.82 ? rgb255(NEON.cool)
            : rgb255(hue < 0.92 ? NEON.magenta : NEON.cyan);
        // 블라인드 — 절반쯤 내린 칸
        const blind = hash2(sid, 89);
        let k = 1.0;
        if (blind < 0.3) {
          const bandsDown = 0.25 + blind;     // 어디까지 내렸나
          if (fv < bandsDown) k = 0.3;        // 가려진 부분
          else if (Math.floor(fv * 14) % 2 === 0) k = 0.78;
        }
        o.c[0] = col[0] * 0.2; o.c[1] = col[1] * 0.2; o.c[2] = col[2] * 0.2;
        o.r = 0.3; o.h = 0.8;
        o.e[0] = col[0] * k; o.e[1] = col[1] * k; o.e[2] = col[2] * k;
        // ── `{ emissive: true }` 를 빼면 o.e 는 버려진다 ────────────────────
        // 처음에 이 옵션 없이 구웠더니 세트에 map·roughnessMap·normalMap 만
        // 들어 있었다. 창을 밝게 칠하고 세기까지 올렸는데 **발광맵 자체가
        // 없어서** 잡거타워가 통째로 검은 벽이었다.
        // 텍스처를 새로 만들 때는 구운 결과의 키를 확인한다 — 칠했다고
        // 나오는 것이 아니다.
      }, { emissive: true });
    },

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
    // ── 점포 정면 ─────────────────────────────────────────────────────────
    //
    // ── 왜 다시 만들었나 (사용자 지적) ──────────────────────────────────
    // "간판 바꿨다며? 바뀐게 없는데"
    //
    // 맞는 관찰이었다. 간판(shared/glyphs.js)은 고쳤지만 **화면을 덮은 것은
    // 이것**이다. 적층 상가 파사드를 층마다 뒤덮은 알록달록한 가로 띠가
    // 여기서 나온다.
    //
    // 그리고 그 띠에는 **내용이 하나도 없었다.** 위 18%가 단색 발광 스트립
    // 하나였고, 그게 층마다 칸마다 반복됐다. 그것이 "색깔놀이" 의 정체다.
    //
    // 이제 간판과 **같은 어휘**를 쓴다 — 네온 튜브 테두리, 픽토그램,
    // 표의문자, 라틴 줄. 그리고 칸마다 색이 다르다. 전에는 텍스처 하나에
    // 색 하나여서 네 칸이 전부 같은 색이었다.
    // ── 간판 띠를 걷어냈다 (사용자 지시) ──────────────────────────────────
    //
    // "텍스쳐인지 모델인지 모자이크 창문 위에 간판 저거를 없에고,
    //  모자이크를 살리라고"
    //
    //   전            후
    //   ─────────     ─────────
    //   간판 간판     모자 모자
    //   ─────────     이크 이크
    //   모자 모자     패턴 패턴
    //   이크 이크     ─────────
    //   ─────────
    //
    // 이 텍스처는 **두 가지를 한 장에 담고 있었다** — 위 30%가 간판(픽토그램·
    // 표의문자·네온 테), 아래가 점포 유리다. 그래서 이걸 붙인 자리마다 창 위에
    // 간판이 따라 붙었다. 3D 배너를 아무리 치워도 남는 이유가 이것이었다.
    //
    // 둘을 갈랐다. **여기는 유리만 한다.** 간판이 필요한 곳은 간판을 붙인다
    // (`signMats.banner` — 원래 그 일을 하는 리소스다).
    //
    // 모자이크는 그대로다. 사용자가 좋다고 한 것이 그 무늬이고, 이제 띠가
    // 차지하던 30%까지 **모자이크가 채운다.**
    shopfront(seed, tintHex) {
      const base = rgb255(tintHex);
      const noise = tiledFbm(seed + 5, 22, 3);
      const BAYS = 4;
      const PLINTH = 0.09;   // 아래 가로대
      const CORNICE = 0.93;  // 위 가로대. 그 사이가 전부 유리다

      // 칸마다 다른 색. 기본 색조를 중심으로 이웃 네온으로 흔든다 —
      // 실제 상가는 가게마다 간판 색이 다르고, 그 불규칙이 번화가의 인상이다.
      const HUES = [NEON.warm, NEON.cool, NEON.magenta, NEON.cyan, NEON.amber, NEON.green, NEON.pink];
      const bayHue = (i) => {
        const h = hash2(seed * 13 + i * 71, 401);
        return h < 0.34 ? base : rgb255(HUES[(h * HUES.length) | 0]);
      };

      return bake(
        [512, 256],
        1,
        1,
        (u, v, o) => {
          const gn = noise(u, v);
          // v=0 이 위다 (core/textures.js 의 bake 주석). 아래에서 쌓는 레이아웃이다
          const up = 1 - v;
          const bi = Math.min(BAYS - 1, Math.floor(u * BAYS));
          const bu = u * BAYS - bi;          // 칸 안 가로 0..1
          const tint = bayHue(bi);

          // 아래 가로대
          if (up < PLINTH) {
            const k = S.frame[0] * 1.3 + gn * 10;
            o.c[0] = k; o.c[1] = k; o.c[2] = k + 4;
            o.r = 0.8; o.h = 0.5;
            return;
          }

          // 위 가로대 — 옛 차양선을 맨 위로 올린 것. 유리를 위아래로 닫는다
          if (up > CORNICE) {
            const k = S.frame[0] * 0.9;
            o.c[0] = k; o.c[1] = k; o.c[2] = k + 3;
            o.r = 0.7; o.h = 0.95;
            return;
          }

          // 세로 창틀
          if (bu < 0.045 || bu > 0.955) {
            o.c[0] = S.frame[0]; o.c[1] = S.frame[1]; o.c[2] = S.frame[2];
            o.r = 0.62; o.h = 0.92;
            return;
          }

          // 유리 — 실내 발광. 위가 밝고 아래로 어둡다 (천장 조명).
          // 0.42~0.92 로 잡았다가 되돌렸다. 점포 정면은 면적이 커서 그 밝기면
          // 블룸 임계값을 통째로 넘어 흰 상자가 된다.
          const t = (up - PLINTH) / (CORNICE - PLINTH);
          let level = 0.26 + t * 0.3;

          // 실내 물체 실루엣. fbm 을 그대로 쓰면 "유리에 낀 무언가" 가 된다.
          // 상점 안에 있는 것은 선반·상자라 실루엣이 직각이어야 한다.
          const SX = 14;
          const SY = 5;
          const sx = Math.floor(u * SX);
          const sy = Math.floor(t * SY);
          if (hash2(sx * 19 + seed, sy * 31 + seed) < 0.5 - sy * 0.09) level *= 0.16;
          if (t * SY - sy < 0.09) level *= 0.3;
          level *= 0.84 + gn * 0.32;

          o.c[0] = tint[0] * 0.12; o.c[1] = tint[1] * 0.12; o.c[2] = tint[2] * 0.12;
          o.r = 0.2; o.h = 0.2;
          o.e[0] = clamp(tint[0] * level, 0, 255);
          o.e[1] = clamp(tint[1] * level, 0, 255);
          o.e[2] = clamp(tint[2] * level, 0, 255);
        },
        { emissive: true }
      );
    },

    // ── 시장 좌판 (아케이드 전용, 사용자 지시로 새로 만듦) ─────────────────
    //
    // *"다른 번화가 건물들이랑 윈도우쪽 디자인이 아예 똑같고 (…) 똑같은
    //  리소스를 돌려쓰고 있는데, 아케이드 건물만의 리소스를 그냥 새로 만들어서 써"*
    //
    // 맞다. 아케이드 점포에 `shopfront` 를 그대로 붙였다. 그 텍스처의 문법은
    // **간판 띠 + 모자이크 유리**다 — 잡거상가의 것이고, 그래서 아케이드가
    // 옆 건물과 똑같아 보였다.
    //
    // 시장 좌판의 문법은 다르다. 유리가 없다. 대신
    //
    //   차양 줄무늬   위 22%. 천을 늘어뜨린 것이라 **세로 줄**이다
    //   품목 픽토     가운데. 무엇을 파는지 하나만 크게
    //   값 널판       그 아래 손글씨 줄 두 개
    //   좌판 물건     아래 30%. 상자·자루·병이 **실루엣**으로 늘어선다
    //
    // 유리도 격자도 없으므로 멀리서도 "저건 가게가 아니라 좌판" 으로 갈린다.
    marketStall(seed, tintHex) {
      const warm = rgb255(tintHex);
      const grain = tiledFbm(seed + 11, 26, 3);
      const CANOPY = 0.22; // 위에서부터 차양이 차지하는 비율
      const GOODS = 0.32;  // 아래에서부터 물건

      return bake([256, 256], 1, 1, (u, v, o) => {
        const gn = grain(u, v);
        const up = 1 - v;

        // 널판 바탕 — 나무다. 이 유형에는 콘크리트가 없다
        o.c[0] = 88 + gn * 26;
        o.c[1] = 68 + gn * 22;
        o.c[2] = 52 + gn * 18;
        o.r = 0.9; o.h = 0.45;
        o.e[0] = 0; o.e[1] = 0; o.e[2] = 0;

        // ── 차양 — 세로 줄무늬 천 ────────────────────────────────────────
        if (up > 1 - CANOPY) {
          const band = Math.floor(u * 9) % 2 === 0;
          const t = (up - (1 - CANOPY)) / CANOPY;
          // 아래로 갈수록 그늘진다 (천이 늘어져 있다)
          const sh = 0.55 + t * 0.45;
          if (band) {
            o.c[0] = warm[0] * 0.95 * sh; o.c[1] = warm[1] * 0.8 * sh; o.c[2] = warm[2] * 0.5 * sh;
          } else {
            o.c[0] = 232 * sh; o.c[1] = 226 * sh; o.c[2] = 208 * sh;
          }
          o.r = 0.95; o.h = 0.7;
          return;
        }

        // ── 좌판 물건 — 실루엣. 밝은 배경에 어두운 덩어리 ───────────────
        if (up < GOODS) {
          // 안쪽에서 새는 빛. 물건이 그 앞에 선다
          o.c[0] = warm[0] * 0.5; o.c[1] = warm[1] * 0.45; o.c[2] = warm[2] * 0.36;
          o.e[0] = warm[0] * 0.5; o.e[1] = warm[1] * 0.44; o.e[2] = warm[2] * 0.3;
          o.r = 0.8; o.h = 0.3;

          const N = 7;
          const gi = Math.floor(u * N);
          const gu = u * N - gi;
          const hh = 0.30 + hash2(seed + gi * 37, 3) * 0.62; // 물건 높이가 제각각
          const wsh = 0.16 + hash2(seed + gi * 91, 7) * 0.22;
          if (up < GOODS * hh && gu > wsh && gu < 1 - wsh) {
            const dark = 0.16 + hash2(seed + gi * 53, 11) * 0.14;
            o.c[0] = 40 * dark * 4; o.c[1] = 34 * dark * 4; o.c[2] = 30 * dark * 4;
            o.e[0] = 0; o.e[1] = 0; o.e[2] = 0;
            o.r = 0.92; o.h = 0.6;
          }
          return;
        }

        // ── 품목 픽토 — 가운데 하나만 크게 ──────────────────────────────
        const pu = (u - 0.24) / 0.52;
        const pv = (up - GOODS - 0.10) / (1 - CANOPY - GOODS - 0.18);
        const ink = pictAt(seed % PICT_COUNT, pu, pv, 0.16);
        if (ink) {
          const k = ink === 2 ? 1.0 : 0.55;
          o.c[0] = warm[0] * k; o.c[1] = warm[1] * k; o.c[2] = warm[2] * k;
          o.e[0] = warm[0] * k; o.e[1] = warm[1] * k; o.e[2] = warm[2] * k;
          o.r = 0.5; o.h = 0.55;
          return;
        }

        // ── 값 널판 — 손글씨 두 줄 ──────────────────────────────────────
        const ly = (up - GOODS - 0.01) / 0.09;
        if (ly > 0 && ly < 1 && u > 0.12 && u < 0.88) {
          const row = ly < 0.5 ? 0 : 1;
          if (latinAt(seed + row * 313, (u - 0.12) / 0.76, (ly * 2) % 1, 11)) {
            o.c[0] = 236; o.c[1] = 232; o.c[2] = 214;
            o.e[0] = 150; o.e[1] = 146; o.e[2] = 130;
            o.r = 0.6; o.h = 0.5;
          }
        }
      }, { emissive: true });
    },
  };
}
