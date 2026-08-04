// 빛을 정점에 굽는다.
//
// ── 왜 ─────────────────────────────────────────────────────────────────────
// 실시간 경로는 PointLight 40개다. 포워드 렌더링이라 **픽셀마다 40번** 돈다.
// 그런데 이 층은 아무것도 안 움직인다 — 광원도, 벽도, 소품도. 매 프레임 다시
// 계산할 이유가 없다.
//
// 굽는 곳은 두 군데 중 하나다: 텍스처(라이트맵) 아니면 정점. 이 저장소는
// 텍스처 예산이 하나뿐이고(220MB) UV 두 번째 채널도 없으므로 **정점**이다.
// glTF 의 COLOR_0 라 확장 없이 그대로 나가고, 블렌더·유니티도 그대로 읽는다.
//
// ── 정점 컬러의 값은 무엇인가 ──────────────────────────────────────────────
// **그 자리에 도달한 빛**이다. 알베도가 아니다. three 는 정점 컬러를 알베도에
// 곱하므로, 흰 환경광 하나(세기 π)를 두면 화면 색이 `알베도 x 구운값` 이 된다.
//
// ── 무엇을 포기했나 ────────────────────────────────────────────────────────
// 노말맵이 거의 죽는다. 구운 빛은 정점 단위라 픽셀 단위 노말을 모른다.
// 반구광을 0.08 만 남겨 완전히 사라지는 것만 막았다. 표면의 요철을 보고 싶으면
// BAKED 를 끄면 된다 — 두 경로가 **같은 lightPlan() 을 본다.**
//
// ── 근사 셋 ────────────────────────────────────────────────────────────────
// 1) 등은 점이 아니라 **아래를 보는 면**이다 (1.2x0.6 패널). 위로는 안 쏜다 —
//    그래서 천장은 직사광을 0 으로 받고, 정점 간격 때문에 생기던 얼룩이 없다.
// 2) 칸 안의 소품은 그림자를 안 만든다. 책상 밑이 밝다.
// 3) 칸 사이는 **틈의 높이**로만 막는다. 가로 위치는 트인 비율(SPILL)로 뭉갠다.
import * as THREE from 'three';
import { CELLS, byId, H, openness, seam } from './layout.js';

// 굽기를 쓸 것인가. 끄면 실시간 PointLight 40개로 돌아간다 (lights.js).
// 두 경로 다 lightPlan() 하나에서 나오므로 좌표가 어긋날 수 없다.
export const BAKED = true;

// 이웃 칸에서 빛이 새는 비율. "그 경계 중 얼마나 뚫려 있나" 의 뭉뚱그린 값이다.
//   open   벽이 아예 없다 (플라자와 고리 복도)
//   wide   1.9m 쌍짝 문 · glass 유리벽 + 문 · door 0.95m 단짝 문
const SPILL = { open: 1, wide: 0.35, glass: 0.3, door: 0.22, solid: 0 };

// 빛이 넘어갈 수 있는 **높이 구간**. 문 위로는 벽이라 못 넘어간다.
// 'open' 은 두 칸 중 낮은 천장까지 — 그 위는 소핏이 막는다. 플라자의 5.25m
// 등이 고리 복도 바닥을 못 비추는 것이 이 한 줄이다.
const APERTURE = { wide: [0, H.door], door: [0, H.door], glass: [0, 2.4] };

// 등을 반지름 SOFT 의 구로 본다. 점으로 두면 가까이서 세기가 발산해
// 정점 하나만 하얗게 튄다 — 1.2x0.6 패널이니 이쪽이 오히려 맞다.
const SOFT = 0.7;
const DECAY = 1.8;

// 등의 **배광**. 순수 램버트(=코사인 그대로)로 두면 등과 같은 높이에 있는 것이
// 빛을 하나도 못 받는다 — 천장 밑 덕트·케이블 트레이가 새카맸다. 실제 등기구는
// 반사갓과 확산판 때문에 옆으로도 퍼지므로 바닥을 깔아 준다.
//
// 위쪽(등보다 높은 곳)은 여전히 0 이다. 천장이 직사광을 안 받아야 정점 간격
// 때문에 생기는 얼룩이 안 나온다.
//
// **경사로 이어붙인다.** 바닥값을 상수로 두면 down=0 에서 0 -> 0.32 로 뚝
// 끊겨, 등과 같은 높이를 지나는 물건에 딱딱한 명암선이 생긴다. 첫 SPREAD_RAMP
// 구간에서 0 -> SPREAD 로 올라간 뒤 램버트로 이어진다 (연속).
const SPREAD = 0.32;
const SPREAD_RAMP = 0.12;
const lampLobe = (down) =>
  SPREAD * Math.min(1, down / SPREAD_RAMP) + (1 - SPREAD) * down;

// 구운 값을 화면 밝기로 옮기는 배율.
//
// **눈으로 맞추지 않는다.** 굽고 나면 분포가 나오므로(p995) 상위 0.5% 가 1.0
// 바로 아래에 오도록 잡는다 — 그 위는 잘려서 제일 밝은 자리의 차이가 통째로
// 사라지고, 그 아래로 남기면 8비트 정점 컬러의 계조를 버리는 셈이다.
// 아래 값들은 p995 = 0.46 을 재고 1.95 배 한 결과다.
const GAIN = 0.31;

// 한 번 튄 빛(바운스)의 대역. 칸의 **조명 밀도**에서 뽑는다 — 표에 손으로
// 적으면 power 를 고칠 때 따로 놀고, 그게 이 저장소의 1번 결함 유형이다.
const FILL_K = 0.58;
const FILL_SPREAD = 0.3; // 완전히 트인 이웃에서 넘어오는 몫
const FILL_MAX = 1.2;

// 바운스는 **바닥에서 온다.** 이 방에서 제일 밝은 면이 바닥이기 때문이다.
// 그러니 바운스를 칸마다 균일한 상수로 두면 안 된다 — 첫 판이 그랬고,
// 벽이 위아래로 똑같아 판때기처럼 보였다.
//
//   아래를 보는 면(천장·책상 밑)  바닥을 정면으로 본다      제일 많이 받는다
//   수직면(벽)                    바닥을 스치듯 본다        중간
//   위를 보는 면(바닥 자체)       어두운 천장을 본다        제일 적게 받는다
//                                 (대신 직사광을 다 받는다)
//
// 높이도 본다. 바닥에서 멀어질수록 바닥이 차지하는 입체각이 준다.
const bounce = (ny, y) => (0.25 + 0.45 - 0.45 * ny) / (1 + Math.max(y, 0) * 0.35);

// 아무 빛도 안 닿는 자리의 바닥값. 0 으로 두면 순수 검정이라 형태가 사라진다.
const FLOORLIT = 0.035;

// ── 어느 칸인가 ────────────────────────────────────────────────────────────

const EPS = 0.005;
function cellAt(x, z) {
  for (const c of CELLS) {
    if (x > c.x0 + EPS && x < c.x1 - EPS && z > c.z0 + EPS && z < c.z1 - EPS) return c;
  }
  // 경계에 정확히 앉은 정점 — 제일 가까운 칸으로 붙인다
  let best = null;
  let bd = 0.35;
  for (const c of CELLS) {
    const dx = Math.max(c.x0 - x, 0, x - c.x1);
    const dz = Math.max(c.z0 - z, 0, z - c.z1);
    const d = Math.hypot(dx, dz);
    if (d < bd) {
      bd = d;
      best = c;
    }
  }
  return best;
}

// ── 칸 사이의 통로 ─────────────────────────────────────────────────────────

function links() {
  const out = new Map();
  for (const [k, rule] of openness()) {
    const w = SPILL[rule];
    if (!w) continue;
    const [a, b] = k.split('|');
    const ca = byId[a];
    const cb = byId[b];
    const s = seam(ca, cb);
    if (!s) continue;
    const gap = APERTURE[rule] || [0, Math.min(ca.h, cb.h)];
    out.set(k, { w, axis: s.axis, at: s.at, y0: gap[0], y1: gap[1] });
  }
  return out;
}

// ── 바운스 ─────────────────────────────────────────────────────────────────

function fillByCell(plan) {
  const own = {};
  for (const c of CELLS) {
    const t = plan.byCell[c.id];
    const e = plan.emitters.find((x) => x.cell === c.id);
    const level = Math.min(FILL_MAX, FILL_K * ((t.power * t.lights) / t.area));
    own[c.id] = { level, r: e ? e.r : 1, g: e ? e.g : 1, b: e ? e.b : 1 };
  }

  // 완전히 트인 이웃에서 한 걸음. 고리 복도는 플라자와 한 부피라 그 밝기를
  // 나눠 갖는 것이 맞다 — 벽이 없으니 실제로 그렇다.
  const out = {};
  for (const c of CELLS) {
    const o = own[c.id];
    let r = o.level * o.r;
    let g = o.level * o.g;
    let b = o.level * o.b;
    for (const [k, rule] of openness()) {
      if (rule !== 'open') continue;
      const [a, n] = k.split('|');
      if (a !== c.id) continue;
      const q = own[n];
      const s = FILL_SPREAD * q.level;
      r = Math.max(r, o.level * o.r + s * q.r);
      g = Math.max(g, o.level * o.g + s * q.g);
      b = Math.max(b, o.level * o.b + s * q.b);
    }
    out[c.id] = [r, g, b];
  }
  return out;
}

// ── 재질이 되쏘는 밝기 ─────────────────────────────────────────────────────
//
// 구운 값은 **닿은 빛**이지 보이는 밝기가 아니다. 눈에 보이는 것은 거기에
// 알베도를 곱한 것이다.
//
// 이 구분이 실제로 걸렸다. 플라자는 빛을 제일 많이 받는데(0.70) 바닥이 어두운
// 폴리싱 콘크리트라, 밝은 비닐 타일을 깐 고리 복도(0.36)가 화면에서는 더
// 밝게 보였다. **조도만 재면 "플라자가 제일 밝다" 가 참인데 화면은 아니다** —
// 캐릭터 씬에서 "30뷰 일치" 를 네 번 보고하며 얼굴이 파여 있던 것과 같은
// 종류의 사각지대다 (lessons.md 3.8).
const albedoCache = new WeakMap();

export function meanAlbedo(mat) {
  const hit = albedoCache.get(mat);
  if (hit !== undefined) return hit;

  let v = 1;
  const img = mat.map && mat.map.image;
  if (img && img.width) {
    // 32x32 로 줄여 평균만 본다. 정확도는 충분하고 재질당 한 번뿐이다.
    const S = 32;
    const cv = document.createElement('canvas');
    cv.width = S;
    cv.height = S;
    const cx = cv.getContext('2d', { willReadFrequently: true });
    cx.drawImage(img, 0, 0, S, S);
    const d = cx.getImageData(0, 0, S, S).data;
    // 캔버스 값은 sRGB 다. 밝기를 더하려면 선형으로 되돌려야 한다 —
    // sRGB 값을 그냥 평균내면 어두운 쪽이 과대평가된다.
    const lin = (u) => {
      u /= 255;
      return u <= 0.04045 ? u / 12.92 : Math.pow((u + 0.055) / 1.055, 2.4);
    };
    let sum = 0;
    for (let i = 0; i < d.length; i += 4) {
      sum += 0.2126 * lin(d[i]) + 0.7152 * lin(d[i + 1]) + 0.0722 * lin(d[i + 2]);
    }
    v = sum / (d.length / 4);
  } else if (mat.color) {
    v = 0.2126 * mat.color.r + 0.7152 * mat.color.g + 0.0722 * mat.color.b;
  }
  albedoCache.set(mat, v);
  return v;
}

// ── 굽기 ───────────────────────────────────────────────────────────────────

// groups  MeshBuilder 가 낸 Group 들. 전부 정점 컬러를 받는다.
// plan    lightPlan()
export function bakeVertexLight(groups, plan) {
  const link = links();
  const fill = fillByCell(plan);
  const dark = [FLOORLIT, FLOORLIT, FLOORLIT];
  const em = plan.emitters;

  // 칸별 바닥 밝기 — 위계를 **숫자로** 재기 위한 것. 이 씬이 계측을 형태보다
  // 먼저 세운 이유가 여기 있다 (status.md 2장).
  const acc = {};
  for (const c of CELLS) acc[c.id] = { sum: 0, n: 0, min: Infinity, max: 0 };

  let verts = 0;
  let meshes = 0;
  let clipped = 0;
  // 전체 밝기 분포. **레벨을 눈으로 맞추면 안 된다** — 상위 0.5% 가 1.0 에
  // 닿기 직전이 되도록 GAIN 을 잡고, 화면 밝기는 환경광 세기로 따로 올린다.
  // 구운 값이 1 에서 잘리면 제일 밝은 자리의 차이가 통째로 사라진다.
  const hist = new Uint32Array(101);

  for (const root of groups) {
    root.traverse((o) => {
      if (!o.isMesh) return;
      for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
        if (!m.vertexColors) {
          throw new Error(`굽기: '${m.name}' 에 vertexColors 가 꺼져 있다 — materials.js 에서 켠다`);
        }
      }
      const geo = o.geometry;
      const pos = geo.attributes.position;
      const nor = geo.attributes.normal;
      if (!nor) throw new Error(`굽기: ${o.name} 에 normal 이 없다`);
      const col = new Float32Array(pos.count * 3);

      for (let i = 0; i < pos.count; i++) {
        const px = pos.getX(i);
        const py = pos.getY(i);
        const pz = pos.getZ(i);
        const nx = nor.getX(i);
        const ny = nor.getY(i);
        const nz = nor.getZ(i);

        // **법선 쪽으로 나가서** 칸을 묻는다. 벽 한 장의 양면은 서로 다른
        // 방에 속한다 — 그냥 좌표로 물으면 플라자 쪽 면이 복도 밝기를 받는다.
        const c = cellAt(px + nx * 0.25, pz + nz * 0.25);
        const f = c ? fill[c.id] : dark;
        const bo = bounce(ny, py);
        let r = f[0] * bo + FLOORLIT;
        let g = f[1] * bo + FLOORLIT;
        let b = f[2] * bo + FLOORLIT;

        if (c) {
          for (let e = 0; e < em.length; e++) {
            const L = em[e];
            let w = 1;
            if (L.cell !== c.id) {
              const lk = link.get(`${c.id}|${L.cell}`);
              if (!lk) continue;
              w = lk.w;
              // 두 칸을 가르는 면을 **어느 높이로** 넘는가
              const p0 = lk.axis === 'x' ? px : pz;
              const p1 = lk.axis === 'x' ? L.x : L.z;
              const t = (lk.at - p0) / (p1 - p0 || 1e-6);
              if (t < 0 || t > 1) continue;
              const yc = py + t * (L.y - py);
              if (yc < lk.y0 || yc > lk.y1) continue;
            }

            const dx = L.x - px;
            const dy = L.y - py;
            const dz = L.z - pz;
            const d2 = dx * dx + dy * dy + dz * dz;
            if (d2 > L.range * L.range) continue;
            const d = Math.sqrt(d2) || 1e-4;

            // 받는 쪽의 코사인 — 면의 법선과 **면에서 등을 향하는** 방향
            const nl = (nx * dx + ny * dy + nz * dz) / d;
            if (nl <= 0) continue;
            // 쏘는 쪽의 코사인 — 등의 법선(0,-1,0)과 **등에서 면을 향하는**
            // 방향 (-d)/|d| 의 내적이라 결국 +dy/d 다. 부호를 뒤집어 적었더니
            // 바닥이 직사광을 0 으로 받고 천장만 받았다 (칸별 min=max 가 잡아냈다).
            const down = dy / d;
            if (down <= 0) continue;

            const att = Math.pow(SOFT / Math.max(d, SOFT), DECAY);
            const k = L.power * att * nl * lampLobe(down) * w * GAIN;
            r += L.r * k;
            g += L.g * k;
            b += L.b * k;
          }
        }

        // 1을 넘기면 glTF COLOR_0 의 관례를 벗어난다. 전체 밝기는 환경광
        // 세기로 잡고 여기서는 자른다.
        if (r > 1 || g > 1 || b > 1) clipped++;
        r = r > 1 ? 1 : r;
        g = g > 1 ? 1 : g;
        b = b > 1 ? 1 : b;
        col[i * 3] = r;
        col[i * 3 + 1] = g;
        col[i * 3 + 2] = b;

        const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
        hist[Math.min(100, Math.round(lum * 100))]++;

        // 바닥을 향해 위를 보는 면만 칸 통계에 넣는다 — "이 방이 밝은가" 는
        // 서 있는 사람이 보는 바닥의 밝기다.
        if (c && ny > 0.7 && py < 0.25) {
          const a = acc[c.id];
          a.sum += lum;
          a.n++;
          if (lum < a.min) a.min = lum;
          if (lum > a.max) a.max = lum;
        }
      }

      geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
      verts += pos.count;
      meshes++;
    });
  }

  const byCell = {};
  for (const c of CELLS) {
    const a = acc[c.id];
    byCell[c.id] = a.n
      ? { mean: a.sum / a.n, min: a.min, max: a.max, samples: a.n, kind: c.kind }
      : null;
  }

  const pct = (q) => {
    let want = verts * q;
    for (let i = 0; i <= 100; i++) {
      want -= hist[i];
      if (want <= 0) return i / 100;
    }
    return 1;
  };
  return {
    verts,
    meshes,
    byCell,
    clipped,
    p50: pct(0.5),
    p95: pct(0.95),
    p995: pct(0.995),
  };
}
