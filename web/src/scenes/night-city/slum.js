// 슬럼 — 짓다 만 기업 개발지에 사람이 들어간 곳.
//
// ── 이 구역이 왜 여기 있는가 (docs/scenes/night-city/city.md 2기 -> 3기) ────
// 판자촌이 아니다. 사이버펑크의 슬럼은 **못 지은 것이 아니라 짓다 만 것**이다.
// (레퍼런스: 퍼시피카 — 개발이 중단된 리조트 단지에 사람들이 무단 점거해 산다.)
//
// 우리 도시의 내력에 대입하면 이렇게 나온다.
//
//   2기 호황: 땅값이 오르자 기업이 도심 주변에 대형 개발을 시작했다.
//   3기 포화: 사람이 감당 못 하게 늘면서 계획이 무너졌다. 공사가 멈췄다.
//   그 뒤:    골조만 선 채 방치됐고, 갈 곳 없는 사람들이 그 안으로 들어갔다.
//
// 그래서 기업 구역의 매끈한 유리탑과 **정확히 대비**된다. 같은 2기의 산물인데
// 하나는 완성됐고 하나는 버려졌다. 그 대비가 이 도시를 설명한다.
//
// ── 한 채가 아니라 **세 시기가 겹친 구역**이다 (실측으로 드러났다) ─────────
//
// 전에는 대지 하나에 정사각 골조 **한 채**를 세웠다. 실측: 슬럼 12블록에
// 건물 7채, 전부 같은 형태, 9칸 대지(139x138m)에도 정사각 한 덩어리.
// **대지가 커지면 상자가 커졌다** — 주거 슬래브에서 방금 고친 것과 똑같은
// 오류다 (status.md 3.16). 그리고 눈높이에는 모닥불 두어 개뿐이었다.
//
// 슬럼에는 시기가 다른 것이 나란히 서 있다. 셋으로 가른다.
//
//   골조(frame)     2기에 시작해 3기에 멈춘 것. 외벽이 없고 안이 채워졌다
//   폐빌딩(stripped) 2기에 완성됐다가 3기에 비워진 것. 벽은 있고 창이 막혔다
//   판자촌(shanty)  아무도 안 지어 준 것. 바닥에서 쌓아 올렸다. 낮고 빽빽하다
//
// 대지는 **골조 구역과 판자촌 구역**으로 갈린다. 큰 골조가 한쪽을 차지하고,
// 그 그늘에 작은 것들이 빽빽하게 붙는다. 이 대비 — 거대한 죽은 뼈대와 그
// 발치의 살아 있는 잡동사니 — 가 이 구역의 그림이다.
//
// ── 그리고 격자를 안 따른다 (그 뜻은 대지 병합이 맡는다) ───────────────────
// 원래는 15~35도 회전으로 표현했다. 사용자가 두 번 지적했다 —
// *"얘네들 삐딱하게 짓는거 의미 없고."* 화면에서는 그 뜻이 안 읽히고 그냥
// 잘못 놓인 상자로 보였다. 지금은 `parcel.js` 의 대지 병합이 "원래 구획을
// 무시하고 한 덩어리로" 를 직접 만든다.
import { autoBox, tubeBetween } from '../../core/profile.js';
import {
  rectCenter, rectSize, shrink, faceFrame, SIDES,
} from '../../core/boxfaces.js';
import { NEON, rgb01 } from '../../shared/neon.js';
import { neon, neonSoft } from '../../shared/masters.js';
import { hash2 } from '../../core/textures.js';
import { CURB_HEIGHT } from './layout.js';
import { onSceneReset } from '../../core/scenestate.js';

// 미완성 골조의 층고. 기업이 짓던 것이라 주거(2.9m)보다 높다.
const FRAME_FLOOR = 3.8;
// 판자촌 한 층. 사람이 겨우 서는 높이다 — 이 낮음이 골조와의 대비를 만든다.
const SHANTY_FLOOR = 2.3;
// 골조 구역이 대지에서 차지하는 비율. 나머지가 판자촌이다.
const FRAME_SHARE = 0.55;
// 판자촌 한 채가 차지하는 자리. 이보다 크게 잡으면 판자촌이 아니라 건물이다.
const SHANTY_PITCH = 15;

// ── 표본 ───────────────────────────────────────────────────────────────────
//
// **"셋으로 갈랐다" 와 "화면에 셋 다 나온다" 는 다르다.** 슬럼은 대지가
// 셋뿐이라 한 종류가 통째로 안 나올 수 있다.
const EMPTY = () => ({ frame: 0, stripped: 0, shanty: 0, 공터: 0, 좌판: 0, estates: 0, 불: [] });
let TALLY = EMPTY();
export function slumTally() {
  return { ...TALLY, 불: TALLY.불.slice(0, 40) };
}
onSceneReset('슬럼 표본', () => { TALLY = EMPTY(); });

// 사각형 안에 상자 하나. 슬럼은 조각이 많아 이 한 줄이 계속 나온다.
function boxIn(b, rect, y0, h, mat) {
  const c = rectCenter(rect);
  const s = rectSize(rect);
  b.box(s.w, h, s.d, [c.x, y0 + h / 2, c.z], mat);
}

// ── 1) 골조 — 짓다 만 것 ───────────────────────────────────────────────────
//
// 기둥과 슬래브만 있는 상태. 외벽이 없어서 **옆에서 보면 층이 다 보인다.**
// 이 '뚫려 있음' 이 슬럼의 실루엣이고, 완성된 건물과 한눈에 구별되는 이유다.
function frame(b, rect, floors, rng, mats) {
  const c = rectCenter(rect);
  const s = rectSize(rect);
  const cols = Math.max(2, Math.round(s.w / 7));
  const rows = Math.max(2, Math.round(s.d / 7));
  const top = floors * FRAME_FLOOR;
  const Y = CURB_HEIGHT;

  // 기둥 — 격자로 선다. 이건 기업이 그린 도면이라 규칙적이다.
  for (let i = 0; i <= cols; i++) {
    for (let j = 0; j <= rows; j++) {
      const x = c.x - s.w / 2 + (s.w * i) / cols;
      const z = c.z - s.d / 2 + (s.d * j) / rows;
      b.box(0.55, top, 0.55, [x, Y + top / 2, z], mats.frameConcMat);
    }
  }

  // 슬래브 — 층마다. 가장자리가 부서진 층을 섞는다.
  for (let f = 1; f <= floors; f++) {
    const y = Y + f * FRAME_FLOOR;
    // 공사가 위에서 멈췄으므로 위층일수록 덜 지어졌다
    const done = f < floors - 1 ? 1 : rng.range(0.45, 0.85);
    const sw = s.w * done;
    const sd = s.d * (f < floors - 1 ? 1 : rng.range(0.5, 1));
    // 덜 지어진 층은 **한쪽으로 치우친다** — 공사가 한 방향으로 진행되다
    // 멈췄기 때문이다. 가운데에 작은 판이 뜨면 미완성이 아니라 작은 층이다.
    const offX = ((s.w - sw) / 2) * (rng.chance(0.5) ? 1 : -1);
    const offZ = ((s.d - sd) / 2) * (rng.chance(0.5) ? 1 : -1);
    b.box(sw, 0.34, sd, [c.x + offX, y, c.z + offZ], mats.frameConcMat);

    // 노출 철근 — 슬래브 끝에서 삐져나온다. 미완성의 신호다.
    if (f >= floors - 1) {
      for (let k = 0; k < rng.int(3, 7); k++) {
        const rx = c.x + rng.range(-sw / 2, sw / 2);
        b.box(0.05, rng.range(0.4, 1.1), 0.05, [rx, y + 0.5, c.z + sd / 2], mats.pipeMat);
      }
    }
  }

  // ── 사람이 채워 넣은 것 ──────────────────────────────────────────────────
  //
  // 골조의 빈 칸에 제멋대로 끼워 넣은 거처. 방수포·합판·컨테이너.
  // **칸에 딱 안 맞는 것**이 요점이다 — 맞으면 그건 설계된 것이다.
  const cw = s.w / cols;
  const cd = s.d / rows;
  for (let f = 0; f < floors; f++) {
    const y = Y + f * FRAME_FLOOR;
    for (let i = 0; i < cols; i++) {
      for (let j = 0; j < rows; j++) {
        // 아래층일수록 꽉 찬다. 위는 아직 아무도 안 올라갔다.
        if (!rng.chance(0.72 - f * 0.11)) continue;
        const cx = c.x - s.w / 2 + cw * (i + 0.5) + rng.range(-0.5, 0.5);
        const cz = c.z - s.d / 2 + cd * (j + 0.5) + rng.range(-0.5, 0.5);
        const bw = cw * rng.range(0.5, 0.92);
        const bd = cd * rng.range(0.5, 0.92);
        const bh = FRAME_FLOOR * rng.range(0.55, 0.86);

        // ── 큰 면에 합판을 쓰지 않는다 ──────────────────────────────────
        //
        // `plywoodMat`(0x7a6244, envMapIntensity 2.2) 는 이 도시에서 밝은 축이다.
        // 번화가에서는 네온 밑이라 묻히는데, **불이 없는 슬럼에서는 그것이
        // 화면에서 제일 밝은 것**이 된다. 5x3x5m 짜리 인필 상자에 쓰면 어둠
        // 속에 발광판 하나가 떠 있는 꼴이다.
        // 합판은 좌판 상판·울타리 같은 **작은 것**에만 남긴다.
        const kind = rng.next();
        if (kind < 0.4) {
          b.box(bw, bh, bd, [cx, y + bh / 2 + 0.2, cz], mats.crateMat);
        } else if (kind < 0.7) {
          // 컨테이너 — 크레인으로 올렸다. 슬럼에 컨테이너가 있는 이유는
          // 항만 도시이기 때문이다.
          b.box(Math.min(bw, 2.5), 2.6, Math.min(bd, 6.1), [cx, y + 1.5, cz], mats.crateAltMat);
        } else {
          b.box(bw, bh * 0.8, bd, [cx, y + bh * 0.4 + 0.2, cz], mats.tarpMat);
        }

        // 불 — 층마다 몇 칸만. 정식 조명이 아니라 백열등이라 따뜻하고 약하다.
        if (rng.chance(0.3)) {
          b.box(bw * 0.5, 0.35, 0.06, [cx, y + bh * 0.6, cz + bd / 2], neonSoft(NEON.warm));
        }
      }
    }
  }

  // ── 훔친 전기 ────────────────────────────────────────────────────────────
  // 케이블이 외벽을 타고 엉켜 내려온다. 배전반이 아니라 **훔친 것**이라
  // 정리되지 않았고, 그 무질서가 슬럼의 표식이다.
  for (let i = 0; i < rng.int(4, 9); i++) {
    const sx = c.x + rng.range(-s.w / 2, s.w / 2);
    const sy = Y + rng.range(top * 0.3, top * 0.95);
    const ex = sx + rng.range(-4, 4);
    const ey = Y + rng.range(1, sy * 0.6);
    b.add(tubeBetween(
      [sx, sy, c.z + s.d / 2],
      [ex, ey, c.z + s.d / 2 + rng.range(0.3, 1.6)], 0.04, 4
    ), mats.cableMat);
  }
  for (let i = 0; i < rng.int(1, 3); i++) {
    b.add(autoBox(0.7, 0.9, 0.4,
      [c.x + rng.range(-s.w / 2, s.w / 2), Y + rng.range(2, 6), c.z + s.d / 2 + 0.2], 0.02),
      mats.ductMat);
  }

  TALLY.frame++;
  return top;
}

// ── 2) 폐빌딩 — 완성됐다가 비워진 것 ───────────────────────────────────────
//
// 골조와 정반대다. **벽이 있다.** 2기에 다 지었는데 3기에 사람이 빠져나갔고,
// 남은 사람이 창을 판자로 막았다. 골조가 "안 지어진" 것이면 이것은
// "지어졌다가 버려진" 것이라, 둘이 나란히 서면 시기가 읽힌다.
//
// 실루엣은 평범한 상자다 — 그게 요점이다. 멀리서는 멀쩡한 건물처럼 보이고
// 가까이 와야 창이 다 막혀 있는 것이 보인다.
function stripped(b, rect, floors, rng, mats) {
  const c = rectCenter(rect);
  const s = rectSize(rect);
  const Y = CURB_HEIGHT;
  const FL = 3.2;
  const top = floors * FL;

  boxIn(b, rect, Y, top, mats.alleyWallMat);

  // 창 — 층마다 한 줄. **대부분 판자로 막혔다.**
  for (const side of SIDES) {
    const f = faceFrame(rect, side);
    const n = Math.max(2, Math.round(f.w / 3.6));
    for (let fl = 0; fl < floors; fl++) {
      for (let i = 0; i < n; i++) {
        const u = -f.w / 2 + (f.w / n) * (i + 0.5);
        const [wx, wz] = f.at(u, 0.06);
        const [ww, wd] = f.size((f.w / n) * 0.52, 0.12);
        // ── 창은 **구멍이 기본**이다 ────────────────────────────────────
        //
        // 처음에 판자를 62% 로 두고 `plywoodMat`(0x7a6244) 를 창 크기 그대로
        // 붙였더니, 어두운 구역에서 그 베이지 사각형이 **켜진 창처럼** 보였다.
        // 폐빌딩인데 멀쩡한 아파트로 읽힌 것이다.
        //
        // 빈 창을 먼저 두고 그 위에 **판자를 몇 장 가로로 덧대는** 순서로
        // 바꿨다. 널빤지 사이로 어둠이 보이는 것이 '막았다' 의 그림이다.
        const y = Y + fl * FL + 1.5;
        const k = hash2(Math.round(wx) * 3 + fl, Math.round(wz) * 11 + i);
        if (k < 0.09) {
          // 아직 사는 집. 아주 드물어야 이 건물이 비어 보인다
          b.box(ww, 1.3, wd, [wx, y, wz], neonSoft(NEON.warm));
        } else {
          b.box(ww, 1.3, wd, [wx, y, wz], mats.homeDarkMat);
          if (k < 0.62) {
            // 널빤지는 **벽면에 붙어야** 한다. 창보다 두껍게 내밀었더니 그
            // 베이지 널이 벽 밖으로 나와 빛을 받아, 어두운 구역에서 오히려
            // 창보다 밝은 띠가 됐다. 이 구역에서 제일 밝은 것이 널빤지면
            // 안 된다.
            for (let p = 0; p < 2; p++) {
              b.box(ww * 1.04, 0.18, wd * 1.02, [wx, y - 0.3 + 0.6 * p, wz], mats.shutterMat);
            }
          }
        }
      }
    }
    // 1층 셔터 — 상가였던 자리. 전부 내려가 있다
    const [sx, sz] = f.at(0, 0.1);
    const [sw, sd] = f.size(f.w * 0.9, 0.16);
    b.box(sw, 2.6, sd, [sx, Y + 1.3, sz], mats.shutterMat);
  }

  // 옥상 — 물탱크와 안테나. 사람이 아직 산다는 증거다
  b.add(autoBox(s.w + 0.5, 0.7, s.d + 0.5, [c.x, Y + top + 0.35, c.z], 0.05), mats.frameConcMat);
  const tanks = Math.max(1, Math.round((s.w * s.d) / 320));
  for (let i = 0; i < tanks; i++) {
    const x = c.x + rng.range(-s.w * 0.3, s.w * 0.3);
    const z = c.z + rng.range(-s.d * 0.3, s.d * 0.3);
    b.cylinder(1.0, 1.0, 1.9, [x, Y + top + 1.7, z], mats.rustMat, 10);
  }
  for (let i = 0; i < rng.int(3, 7); i++) {
    const x = c.x + rng.range(-s.w * 0.42, s.w * 0.42);
    const z = c.z + rng.range(-s.d * 0.42, s.d * 0.42);
    const h = rng.range(1.2, 2.8);
    b.box(0.05, h, 0.05, [x, Y + top + 0.7 + h / 2, z], mats.pipeMat);
  }

  TALLY.stripped++;
  return top;
}

// ── 3) 판자촌 — 바닥에서 쌓아 올린 것 ──────────────────────────────────────
//
// 아무도 안 지어 준 것. 골조도 벽도 없이 주운 것을 쌓았다. **낮다** —
// 2~4층이고, 층마다 어긋나게 얹혀서 위로 갈수록 비틀린다. 골조(30~40m)
// 발치에 이게 붙어 있어야 그 높이가 실감된다.
function shanty(b, rect, rng, mats) {
  const c = rectCenter(rect);
  const s = rectSize(rect);
  const Y = CURB_HEIGHT;
  const floors = 2 + Math.floor(hash2(Math.round(c.x) * 7, Math.round(c.z) * 13) * 3);
  // 합판을 뺐다 — 위 인필과 같은 이유다. 판자촌 벽은 큰 면이다
  const skins = [mats.crateMat, mats.shutterMat, mats.tarpMat, mats.alleyWallMat];

  let top = 0;
  for (let f = 0; f < floors; f++) {
    const y = Y + f * SHANTY_FLOOR;
    // 위층일수록 작아지고 어긋난다 — 아래를 다 덮을 재료가 없다
    const k = 1 - f * 0.16;
    const w = s.w * k * rng.range(0.82, 0.98);
    const d = s.d * k * rng.range(0.82, 0.98);
    const ox = rng.range(-1, 1) * s.w * 0.09 * f;
    const oz = rng.range(-1, 1) * s.d * 0.09 * f;
    const h = SHANTY_FLOOR * rng.range(0.88, 1.0);
    b.box(w, h, d, [c.x + ox, y + h / 2, c.z + oz], skins[(f + Math.round(c.x)) % skins.length]);
    // 지붕 — 골강판 한 장을 얹었다. 본채보다 넓게 삐져나온다
    b.box(w + 0.8, 0.1, d + 0.8, [c.x + ox, y + h + 0.05, c.z + oz], mats.shutterMat);
    // 창 하나. 불이 켜진 집과 아닌 집
    const lit = hash2(Math.round(c.x) * 5 + f, Math.round(c.z) * 3) < 0.55;
    b.box(Math.min(w * 0.3, 1.1), 0.7, 0.08,
      [c.x + ox, y + h * 0.55, c.z + oz + d / 2],
      lit ? neonSoft(NEON.warm) : mats.homeDarkMat);
    top = f * SHANTY_FLOOR + h;
  }

  // 사다리 — 계단이 없다. 이 하나가 "지어 준 것이 아니다" 를 말한다
  if (floors > 1) {
    const lx = c.x + s.w * 0.42;
    const lz = c.z + s.d * 0.3;
    for (const sg of [-0.18, 0.18]) {
      b.box(0.06, top, 0.06, [lx + sg, Y + top / 2, lz], mats.pipeMat);
    }
    for (let r2 = 0; r2 < Math.floor(top / 0.42); r2++) {
      b.box(0.44, 0.05, 0.05, [lx, Y + 0.42 * (r2 + 1), lz], mats.pipeMat);
    }
  }

  // 옥상 물통과 접시 — 이 높이에서 제일 잘 보이는 것이 지붕 위다
  b.cylinder(0.5, 0.5, 0.8, [c.x + s.w * 0.2, Y + top + 0.4, c.z - s.d * 0.2], mats.rustMat, 8);
  if (rng.chance(0.5)) {
    b.cylinder(0.34, 0.34, 0.06, [c.x - s.w * 0.24, Y + top + 0.3, c.z + s.d * 0.2], mats.metalMat, 8);
  }

  TALLY.shanty++;
  return top;
}

// ── 지상 — 골목과 생활 ─────────────────────────────────────────────────────
//
// 전에는 여기에 모닥불 한둘뿐이었다. 슬럼은 **집 안이 아니라 길에서** 사는
// 곳이라, 눈높이가 비면 이 구역이 성립하지 않는다.
//
// 밝히는 것은 드럼통 불뿐이다. 가로등이 없는 것이 이 구역의 정의다 —
// 구역 표에서 슬럼은 홀로그램도 0 이다 (holo.RATE).
function slumGround(b, rect, rng, mats, pools) {
  const c = rectCenter(rect);
  const s = rectSize(rect);
  const Y = CURB_HEIGHT;
  if (s.w < 5 || s.d < 5) return;

  // ── 개수는 **길이와 면적 중 큰 쪽**이 정한다 ────────────────────────────
  //
  // 면적만 쓰면 골조와 판자촌 사이의 긴 골목(폭 8m x 길이 134m)이 1,072m² 라
  // **불 하나 좌판 하나**를 받는다. 134m 를 걸어가는 동안 불이 한 번 나온다는
  // 뜻이고, 실제로 그 골목이 통째로 새까맸다. 가늘고 긴 자리는 면적이 작다.
  const len = Math.max(s.w, s.d);
  const area = s.w * s.d;
  const many = (per, div) => Math.max(1, Math.round(Math.max(len / per, area / div)));

  // 드럼통 불 — 슬럼에서 유일하게 움직이는 빛이고, 사람이 산다는 증거다
  const fires = many(20, 700);
  for (let i = 0; i < fires; i++) {
    const fx = c.x + rng.range(-s.w * 0.36, s.w * 0.36);
    const fz = c.z + rng.range(-s.d * 0.36, s.d * 0.36);
    b.cylinder(0.42, 0.38, 0.9, [fx, Y + 0.45, fz], mats.rustMat, 10);
    b.sphere(0.3, [fx, Y + 1.0, fz], neon(NEON.amber));
    pools.push({
      kind: 'floor', x: fx, y: Y + 0.03, z: fz,
      rx: 5.0, rz: 5.0, tint: rgb01(NEON.amber, 0.55),
    });
    // **어디에 섰는지를 남긴다.** 개수만 세면 "다 만들었는데 화면에서는 못
    // 찾겠다" 를 못 푼다 — 실제로 골목 카메라를 좌표로 짐작하다가 세 번
    // 헛짚었다. 자리를 알면 거기서 찍으면 된다.
    TALLY.불.push([Math.round(fx), Math.round(fz)]);
  }

  // ── 좌판 — 암시장 (#55) ──────────────────────────────────────────────────
  //
  // 번화가에서 암시장을 뺐다. 파는 것이 떳떳하지 않으면 큰길에 있을 이유가
  // 없고, **여기가 그 자리다.** 가게가 아니라 천막과 상자다.
  const stalls = many(30, 1200);
  for (let i = 0; i < stalls; i++) {
    const sx = c.x + rng.range(-s.w * 0.4, s.w * 0.4);
    const sz = c.z + rng.range(-s.d * 0.4, s.d * 0.4);
    const w = rng.range(2.2, 3.4);
    const d = rng.range(1.6, 2.2);
    // 천막 — 네 기둥에 방수포 한 장
    for (const dx of [-1, 1]) {
      for (const dz of [-1, 1]) {
        b.box(0.07, 2.1, 0.07, [sx + dx * w / 2, Y + 1.05, sz + dz * d / 2], mats.pipeMat);
      }
    }
    b.box(w + 0.5, 0.08, d + 0.5, [sx, Y + 2.14, sz], mats.tarpMat);
    // 좌판 — 널판 위에 물건 상자
    b.box(w * 0.9, 0.1, d * 0.6, [sx, Y + 0.85, sz], mats.plywoodMat);
    for (let k = 0; k < rng.int(2, 4); k++) {
      b.box(0.4, 0.3, 0.34,
        [sx + rng.range(-w * 0.35, w * 0.35), Y + 1.05, sz + rng.range(-d * 0.2, d * 0.2)],
        rng.chance(0.5) ? mats.crateMat : mats.crateAltMat);
    }
    // 매단 전구 하나. 좌판마다 이것 하나가 얼굴이다
    b.sphere(0.13, [sx, Y + 1.95, sz], neonSoft(NEON.warm));
    pools.push({
      kind: 'floor', x: sx, y: Y + 0.03, z: sz,
      rx: 3.0, rz: 3.0, tint: rgb01(NEON.warm, 0.4),
    });
    TALLY.좌판++;
  }

  // 판자 울타리 — 골목의 경계. 이게 있어야 '빈 땅' 이 '누구의 자리' 가 된다
  const fenceN = Math.max(1, Math.round(Math.max(s.w, s.d) / 22));
  for (let i = 0; i < fenceN; i++) {
    const along = rng.chance(0.5);
    const len = rng.range(4, 9);
    const fx = c.x + rng.range(-s.w * 0.38, s.w * 0.38);
    const fz = c.z + rng.range(-s.d * 0.38, s.d * 0.38);
    b.box(along ? len : 0.12, 1.9, along ? 0.12 : len, [fx, Y + 0.95, fz], mats.shutterMat);
    // 기울어진 판 하나 — 반듯하면 울타리가 아니라 벽이다
    b.box(along ? 1.2 : 0.1, 1.6, along ? 0.1 : 1.2,
      [fx + (along ? len * 0.4 : 0.4), Y + 0.8, fz + (along ? 0.4 : len * 0.4)], mats.plywoodMat);
  }

  // 쓰레기·물통·빨래 — 사는 흔적. 밝히지 않고 실루엣으로만 둔다
  const junk = Math.max(2, many(9, 380));
  for (let i = 0; i < junk; i++) {
    const jx = c.x + rng.range(-s.w * 0.42, s.w * 0.42);
    const jz = c.z + rng.range(-s.d * 0.42, s.d * 0.42);
    const k = rng.next();
    if (k < 0.34) {
      b.box(0.9, 1.1, 0.8, [jx, Y + 0.55, jz], mats.dumpsterMat);
      if (rng.chance(0.6)) b.sphere(0.3, [jx + rng.range(-0.4, 0.4), Y + 1.25, jz], mats.bagMat);
    } else if (k < 0.62) {
      for (let m = 0; m < rng.int(2, 4); m++) {
        b.sphere(rng.range(0.2, 0.34),
          [jx + rng.range(-0.6, 0.6), Y + 0.25, jz + rng.range(-0.6, 0.6)], mats.bagMat);
      }
    } else if (k < 0.84) {
      b.cylinder(0.34, 0.34, 0.9, [jx, Y + 0.45, jz], mats.rustMat, 8);
    } else {
      b.box(1.1, 0.5, 0.9, [jx, Y + 0.25, jz], mats.crateMat);
    }
  }
}

// ── 한 대지 ────────────────────────────────────────────────────────────────
//
// 대지를 **골조 구역과 판자촌 구역**으로 가른다. 큰 골조가 한쪽을 차지하고
// 그 그늘에 작은 것들이 빽빽하게 붙는다.
//
// 몇 채가 들어가는지는 **대지 크기가 정한다** — 난수가 아니다. 그래야 같은
// 크기 대지가 늘 같은 구성이 되고, 편차가 '노이즈' 가 아니라 '이 자리는
// 이렇다' 가 된다 (난수 규율 1).
export function slumBlock(b, r, rng, mats, pools) {
  const s = rectSize(r);
  const alongX = s.w >= s.d;
  const span = alongX ? s.w : s.d;

  // 난수 소비를 옛 형태와 맞춘다 — 이 둘은 회전을 뽑던 자리다
  rng.chance(0.5);
  rng.range(0.26, 0.61);

  const lo = alongX ? r.x0 : r.z0;
  const cut = lo + span * FRAME_SHARE;
  const cutAt = (a, bb) => (alongX
    ? { x0: a, x1: bb, z0: r.z0, z1: r.z1 }
    : { x0: r.x0, x1: r.x1, z0: a, z1: bb });

  const frameZone = cutAt(lo, cut);
  const shantyZone = cutAt(cut, lo + span);

  let top = 0;

  // ── 골조 구역 ────────────────────────────────────────────────────────────
  // 폭이 넉넉하면 두 채. 한 채로 두면 대지가 커질수록 상자만 커진다.
  {
    const z = shrink(frameZone, 2.5);
    const zs = rectSize(z);
    const n = Math.max(1, Math.min(2, Math.floor(Math.max(zs.w, zs.d) / 46)));
    const wide = zs.w >= zs.d;
    const step = (wide ? zs.w : zs.d) / n;
    for (let i = 0; i < n; i++) {
      const a = (wide ? z.x0 : z.z0) + step * i;
      const cell = shrink(wide
        ? { x0: a, x1: a + step, z0: z.z0, z1: z.z1 }
        : { x0: z.x0, x1: z.x1, z0: a, z1: a + step }, 2.0);
      const cs = rectSize(cell);
      if (cs.w < 12 || cs.d < 12) continue;
      const t = frame(b, cell, rng.int(5, 11), rng, mats);
      if (t > top) top = t;
    }
  }

  // ── 판자촌 구역 ──────────────────────────────────────────────────────────
  //
  // 자리 격자로 잘라 한 칸씩 채운다. **비는 칸이 있어야 골목이 생긴다** —
  // 다 채우면 그냥 커다란 덩어리 하나다.
  {
    const z = shrink(shantyZone, 2.0);
    const zs = rectSize(z);
    const nx = Math.max(1, Math.round(zs.w / SHANTY_PITCH));
    const nz = Math.max(1, Math.round(zs.d / SHANTY_PITCH));
    const cw = zs.w / nx;
    const cd = zs.d / nz;
    for (let i = 0; i < nx; i++) {
      for (let j = 0; j < nz; j++) {
        const full = {
          x0: z.x0 + cw * i, x1: z.x0 + cw * (i + 1),
          z0: z.z0 + cd * j, z1: z.z0 + cd * (j + 1),
        };
        // 판자촌은 칸에서 크게 물러난다 — 그 물러난 틈이 골목이다.
        // 폐빌딩은 **건물**이라 칸을 거의 다 쓴다. 처음에 둘 다 물러나게
        // 해 놓고 "폭 11m 이상" 을 조건으로 걸었더니, 물러난 칸이 10.2m 라
        // **폐빌딩이 한 번도 안 나왔다** (`__slum()` 이 stripped 0 으로 잡았다).
        //
        // 판자촌은 **네 변을 따로 물린다.** 사방을 같은 값으로 물리면 자리
        // 격자가 그대로 드러나서, 항공에서 보면 판자촌이 아니라 컨테이너
        // 야드처럼 줄 맞춰 선다. 아무도 줄을 맞춰 주지 않은 것이 판자촌이다.
        const jit = (a2, lo2, hi2) => lo2 + hash2(Math.round(full.x0) * a2 + j,
          Math.round(full.z0) * (a2 + 5) + i) * (hi2 - lo2);
        const cell = {
          x0: full.x0 + cw * jit(3, 0.06, 0.26), x1: full.x1 - cw * jit(9, 0.06, 0.26),
          z0: full.z0 + cd * jit(15, 0.06, 0.26), z1: full.z1 - cd * jit(21, 0.06, 0.26),
        };
        const wide = shrink(full, 0.8);
        const cc = rectCenter(cell);
        const cs = rectSize(cell);
        const ws = rectSize(wide);
        if (cs.w < 4 || cs.d < 4) continue;
        const k = hash2(Math.round(cc.x) * 17, Math.round(cc.z) * 23);
        if (k < 0.22) {
          // 빈 칸 — 마당이자 골목. 여기에 생활이 들어간다
          TALLY.공터++;
          slumGround(b, cell, rng, mats, pools);
        } else if (k < 0.44 && ws.w > 8 && ws.d > 8) {
          // 폐빌딩 — 벽이 있는 것. 자리가 넉넉할 때만
          const t = stripped(b, wide, rng.int(4, 8), rng, mats);
          if (t > top) top = t;
        } else {
          const t = shanty(b, cell, rng, mats);
          if (t > top) top = t;
        }
      }
    }
  }

  // 두 구역 사이 틈 — 골조 그늘의 길. 여기가 이 구역의 눈높이다
  slumGround(b, alongX
    ? { x0: cut - 4, x1: cut + 4, z0: r.z0 + 3, z1: r.z1 - 3 }
    : { x0: r.x0 + 3, x1: r.x1 - 3, z0: cut - 4, z1: cut + 4 },
    rng, mats, pools);

  TALLY.estates++;
  return { top, yaw: 0 };
}
