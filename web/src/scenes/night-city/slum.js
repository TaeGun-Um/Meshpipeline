// 슬럼 — 짓다 만 기업 개발지에 사람이 들어간 곳.
//
// ── 이 구역이 왜 여기 있는가 (docs/city.md 2기 -> 3기) ─────────────────────
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
// ── 형태가 이렇게 나오는 이유 ──────────────────────────────────────────────
//   · 크다.        기업이 짓던 것이라 주거 슬래브보다 크고 층고도 높다.
//   · 외벽이 없다.  슬래브와 기둥만 섰다. 층마다 옆이 뻥 뚫려 있다.
//   · 안이 채워졌다. 방수포·합판·컨테이너를 제멋대로 끼워 넣었다.
//   · 전기를 훔친다. 케이블이 외벽을 타고 엉켜 내려온다.
//   · 불이 제각각이다. 정식 조명이 아니라 백열등이라 층마다 몇 칸만 켜진다.
//
// ── 그리고 격자를 안 따른다 ────────────────────────────────────────────────
// 이게 "도로 건물 직각" 을 깨는 지점이다.
//
// 다른 구역은 도로에 면을 맞춰 선다 — 계획대로 지었기 때문이다. 그런데
// 이 개발은 **기업이 여러 필지를 사 모아 한 덩어리로** 지으려던 것이라
// 원래 격자를 무시했고, 공사가 멈춘 뒤에는 아무도 정리하지 않았다.
//
// 그래서 슬럼 블록의 건물은 **비스듬히 앉는다.** 도시에서 유일하게 90도가
// 아닌 것이 여기 있고, 그 어긋남이 격자를 깬다.
import * as THREE from 'three';
import { autoBox, tubeBetween } from '../../core/profile.js';
import { rectCenter, rectSize } from '../../core/boxfaces.js';
import { NEON, rgb01 } from '../../shared/neon.js';
import { neon, neonSoft } from '../../shared/masters.js';
import { CURB_HEIGHT } from './layout.js';

// 미완성 골조의 층고. 기업이 짓던 것이라 주거(2.9m)보다 높다.
const FRAME_FLOOR = 3.8;

// ── 골조 한 채 ─────────────────────────────────────────────────────────────
//
// 기둥과 슬래브만 있는 상태. 외벽이 없어서 **옆에서 보면 층이 다 보인다.**
// 이 '뚫려 있음' 이 슬럼의 실루엣이고, 완성된 건물과 한눈에 구별되는 이유다.
function frame(b, w, d, floors, rng, mats, put) {
  const cols = Math.max(2, Math.round(w / 7));
  const rows = Math.max(2, Math.round(d / 7));
  const top = floors * FRAME_FLOOR;

  // 기둥 — 격자로 선다. 이건 기업이 그린 도면이라 규칙적이다.
  for (let i = 0; i <= cols; i++) {
    for (let j = 0; j <= rows; j++) {
      const x = -w / 2 + (w * i) / cols;
      const z = -d / 2 + (d * j) / rows;
      put(b.box.bind(b), 0.55, top, 0.55, [x, top / 2, z], mats.frameConcMat);
    }
  }

  // 슬래브 — 층마다. 가장자리가 부서진 층을 섞는다.
  for (let f = 1; f <= floors; f++) {
    const y = f * FRAME_FLOOR;
    // 공사가 위에서 멈췄으므로 위층일수록 덜 지어졌다
    const done = f < floors - 1 ? 1 : rng.range(0.45, 0.85);
    const sw = w * done;
    const sd = d * (f < floors - 1 ? 1 : rng.range(0.5, 1));
    // 덜 지어진 층은 **한쪽으로 치우친다** — 공사가 한 방향으로 진행되다
    // 멈췄기 때문이다. 전에는 `(w-sw)/2 - (w-sw)/2` 라고 써서 항상 0 이었다
    // (죽은 식). 가운데에 작은 판이 뜨니 미완성이 아니라 그냥 작은 층이었다.
    const offX = (w - sw) / 2 * (rng.chance(0.5) ? 1 : -1);
    const offZ = (d - sd) / 2 * (rng.chance(0.5) ? 1 : -1);
    put(b.box.bind(b), sw, 0.34, sd, [offX, y, offZ], mats.frameConcMat);

    // 노출 철근 — 슬래브 끝에서 삐져나온다. 미완성의 신호다.
    if (f >= floors - 1) {
      for (let k = 0; k < rng.int(3, 7); k++) {
        const rx = rng.range(-sw / 2, sw / 2);
        put(b.box.bind(b), 0.05, rng.range(0.4, 1.1), 0.05, [rx, y + 0.5, sd / 2], mats.pipeMat);
      }
    }
  }
  return top;
}

// ── 사람이 채워 넣은 것 ────────────────────────────────────────────────────
//
// 골조의 빈 칸에 제멋대로 끼워 넣은 거처. 방수포·합판·컨테이너.
// **칸에 딱 안 맞는 것**이 요점이다 — 맞으면 그건 설계된 것이다.
function infill(b, w, d, floors, rng, mats, put) {
  const cols = Math.max(2, Math.round(w / 7));
  const rows = Math.max(2, Math.round(d / 7));
  const cw = w / cols;
  const cd = d / rows;

  for (let f = 0; f < floors; f++) {
    const y = f * FRAME_FLOOR;
    for (let i = 0; i < cols; i++) {
      for (let j = 0; j < rows; j++) {
        // 아래층일수록 꽉 찬다. 위는 아직 아무도 안 올라갔다.
        if (!rng.chance(0.72 - f * 0.11)) continue;
        const cx = -w / 2 + cw * (i + 0.5) + rng.range(-0.5, 0.5);
        const cz = -d / 2 + cd * (j + 0.5) + rng.range(-0.5, 0.5);
        const bw = cw * rng.range(0.5, 0.92);
        const bd = cd * rng.range(0.5, 0.92);
        const bh = FRAME_FLOOR * rng.range(0.55, 0.86);

        const kind = rng.next();
        if (kind < 0.4) {
          // 합판 상자
          put(b.box.bind(b), bw, bh, bd, [cx, y + bh / 2 + 0.2, cz], mats.plywoodMat);
        } else if (kind < 0.7) {
          // 컨테이너 — 크레인으로 올렸다. 슬럼에 컨테이너가 있는 이유는
          // 항만 도시이기 때문이다.
          put(b.box.bind(b), Math.min(bw, 2.5), 2.6, Math.min(bd, 6.1), [cx, y + 1.5, cz], mats.crateAltMat);
        } else {
          // 방수포로 감싼 것 — 형태가 뭉툭하다
          put(b.box.bind(b), bw, bh * 0.8, bd, [cx, y + bh * 0.4 + 0.2, cz], mats.tarpMat);
        }

        // 불 — 층마다 몇 칸만. 정식 조명이 아니라 백열등이라 따뜻하고 약하다.
        if (rng.chance(0.3)) {
          put(b.box.bind(b), bw * 0.5, 0.35, 0.06, [cx, y + bh * 0.6, cz + bd / 2], neonSoft(NEON.warm));
        }
      }
    }
  }
}

// ── 훔친 전기 ──────────────────────────────────────────────────────────────
//
// 케이블이 외벽을 타고 엉켜 내려온다. 배전반이 아니라 **훔친 것**이라
// 정리되지 않았고, 그 무질서가 슬럼의 표식이다.
function stolenPower(b, w, d, top, rng, mats, putRaw) {
  const n = rng.int(4, 9);
  for (let i = 0; i < n; i++) {
    const sx = rng.range(-w / 2, w / 2);
    const sy = rng.range(top * 0.3, top * 0.95);
    const ex = sx + rng.range(-4, 4);
    const ey = rng.range(1, sy * 0.6);
    putRaw(tubeBetween([sx, sy, d / 2], [ex, ey, d / 2 + rng.range(0.3, 1.6)], 0.04, 4), mats.cableMat);
  }
  // 훔친 배선함 — 벽에 아무렇게나 박혀 있다
  for (let i = 0; i < rng.int(1, 3); i++) {
    const bx = rng.range(-w / 2, w / 2);
    const by = rng.range(2, 6);
    putRaw(autoBox(0.7, 0.9, 0.4, [bx, by, d / 2 + 0.2], 0.02), mats.ductMat);
  }
}

// ── 한 덩어리 ──────────────────────────────────────────────────────────────
//
// ── 사선을 뺐다 (사용자 지시) ─────────────────────────────────────────────
// "얘네들 삐딱하게 짓는거 의미 없고."
//
// 원래 의도는 "기업이 여러 필지를 사 모아 원래 구획을 무시하고 지었다" 였고,
// 그걸 15~35도 회전으로 표현했다. 화면에서는 그 뜻이 안 읽히고 그냥 잘못
// 놓인 상자로 보였다 — 사용자가 두 번째로 사선을 지적한 것이다 (첫 번째는
// 사선 도로였다). 두 번 같은 지적을 받았으면 표현 방식이 틀린 것이다.
//
// **뜻은 안 버렸다.** "원래 구획을 무시하고 한 덩어리로" 는 이제 대지 병합이
// 직접 한다 (parcel.js) — 슬럼도 여러 칸을 묶어 한 대지가 되고, 그 위에
// 골조가 통째로 앉는다. 회전보다 그쪽이 뜻에 더 가깝다.
//
// 덤: 회전 때문에 골조가 대지의 72% 밖에 못 썼다. 이제 94% 를 쓴다.
export function slumBlock(b, r, rng, mats, pools) {
  const c = rectCenter(r);
  const s = rectSize(r);

  const yaw = 0;
  // 난수는 그대로 소비한다 — 건너뛰면 뒤의 모든 생성이 밀린다
  rng.chance(0.5);
  rng.range(0.26, 0.61);

  // 회전이 없으니 외접 사각형이 곧 대지다. 짧은 변에 맞춰 정사각으로 앉힌다.
  const fit = Math.min(s.w, s.d);
  const w = fit * 0.94; // 여유 6% — 인접 건물과 붙지 않게
  const d = fit * 0.94;

  // 회전 + 이동을 한 번에 거는 헬퍼. 조각마다 손으로 삼각함수를 쓰면
  // 반드시 어딘가 틀린다 (이 프로젝트에서 이미 두 번 틀렸다).
  const put = (fn, pw, ph, pd, at, mat) => {
    const g = new THREE.BoxGeometry(pw, ph, pd);
    g.rotateY(yaw);
    const rx = at[0] * Math.cos(yaw) + at[2] * Math.sin(yaw);
    const rz = -at[0] * Math.sin(yaw) + at[2] * Math.cos(yaw);
    g.translate(c.x + rx, CURB_HEIGHT + at[1], c.z + rz);
    b.add(g, mat);
  };
  const putRaw = (geo, mat) => {
    geo.rotateY(yaw);
    geo.translate(c.x, CURB_HEIGHT, c.z);
    b.add(geo, mat);
  };

  const floors = rng.int(5, 11);
  const top = frame(b, w, d, floors, rng, mats, put);
  infill(b, w, d, floors, rng, mats, put);
  stolenPower(b, w, d, top, rng, mats, putRaw);

  // 모닥불 — 지상. 슬럼에서 유일하게 움직이는 빛이고, 사람이 산다는 증거다.
  for (let i = 0; i < rng.int(1, 3); i++) {
    const fx = c.x + rng.range(-s.w * 0.3, s.w * 0.3);
    const fz = c.z + rng.range(-s.d * 0.3, s.d * 0.3);
    b.sphere(0.32, [fx, CURB_HEIGHT + 0.3, fz], neon(NEON.amber));
    pools.push({
      kind: 'floor', x: fx, y: CURB_HEIGHT + 0.03, z: fz,
      rx: 4.2, rz: 4.2, tint: rgb01(NEON.amber, 0.5),
    });
  }

  return { top, yaw };
}
