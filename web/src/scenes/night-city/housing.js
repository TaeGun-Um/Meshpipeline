// 주거 슬래브 — 주거 구역의 건물.
//
// ── 이 건물이 왜 이렇게 생겼는가 (docs/city.md 1기) ────────────────────────
// 공장 노동자를 살게 하려고 **빨리, 똑같이** 지은 집이다. 도시가 공장을 위해
// 만들어졌으므로 주거는 목적이 아니라 필요조건이었다. 그래서 형태가 이렇다.
//
//   · 슬래브다. 탑이 아니다. 같은 평면을 옆으로 길게 반복하는 것이 가장 싸다.
//   · 편복도. 계단 하나로 한 층 전체에 접근하는 방식이 승강기 코어보다 싸다.
//     그 복도가 **건물 뒷면에 그대로 드러난다.**
//   · 창이 완벽하게 규칙적이다. 같은 집을 붙여 놓았으니 당연하다.
//   · 1층에 상가가 없다. 팔 것이 아니라 살 곳으로 지었다.
//
// ── 그런데 40년이 지났다 ───────────────────────────────────────────────────
// 이 건물의 인상은 **설계와 생활의 충돌**에서 나온다. 설계는 완벽하게
// 규칙적인데 사는 사람이 제각각이라, 그 격자 위에 불규칙이 덮인다.
//
//   빨래 · 실외기 · 화분 · 짐 · 천막 · 판자로 막은 발코니
//
// 그래서 규칙적인 격자를 **먼저** 만들고 그 위에 불규칙을 얹는다. 순서가
// 중요하다 — 처음부터 불규칙하게 만들면 그냥 지저분한 건물이지, 규칙이
// 무너진 건물로는 안 읽힌다.
import { autoBox, tubeBetween } from '../../core/profile.js';
import {
  SIDES,
  outward,
  faceWidth,
  faceAnchor,
  alongZ,
  shrink,
  rectBox,
  rectCenter,
  rectSize,
} from '../../core/boxfaces.js';
import { NEON } from '../../shared/neon.js';
import { neon, neonSoft } from '../../shared/masters.js';
import { PANEL_TILE, FLOOR_HEIGHT } from './layout.js';

// 주거 층고. 사무실(3.6m)보다 낮다 — 천장고를 아끼는 것이 가장 쉬운 절감이다.
const HOME_FLOOR = 2.9;

// 한 세대 폭. 이 값이 파사드의 리듬 전체를 정한다.
const UNIT_W = 4.4;

function frameOf(r, side) {
  const o = outward(side);
  const a = faceAnchor(r, side);
  const az = alongZ(side);
  return {
    w: faceWidth(r, side),
    at: (u, d) => (az ? [a.x + o.ox * d, a.z + u] : [a.x + u, a.z + o.oz * d]),
    size: (wu, wd) => (az ? [wd, wu] : [wu, wd]),
  };
}

// ── 발코니 한 칸 ───────────────────────────────────────────────────────────
//
// 이 건물의 전부다. 세대마다 하나씩, 층마다 하나씩. 격자 자체는 완벽하게
// 규칙적이고 **안에 든 것만 제각각**이다.
function balcony(b, f, u, y, rng, mats, detail) {
  const D = 1.15;
  const [cx, cz] = f.at(u, D / 2);
  const [sw, sd] = f.size(UNIT_W * 0.86, D);

  // 바닥판
  b.box(sw, 0.16, sd, [cx, y, cz], mats.panelMat);
  // 앞 가림판 — 난간이 아니라 판이다. 싸게 짓는 방식이고, 그래서 안이 안 보인다.
  const [px, pz] = f.at(u, D);
  const [pw, pd] = f.size(UNIT_W * 0.86, 0.1);
  b.box(pw, 1.05, pd, [px, y + 0.54, pz], mats.balconyMat);

  // ── 여기부터가 생활 ──────────────────────────────────────────────────────
  // 넷 중 하나가 얹힌다. 확률이 다른 이유는 실제로 그렇기 때문이다 —
  // 실외기는 거의 모든 집에 있고, 판자로 막은 집은 드물다.
  const pick = rng.next();
  if (pick < 0.42) {
    // 실외기 — 가장 흔하다
    const [ax, az] = f.at(u + rng.range(-1.0, 1.0), D * 0.55);
    const [aw, ad] = f.size(rng.range(0.6, 0.85), 0.55);
    b.box(aw, 0.6, ad, [ax, y + 0.38, az], mats.ductMat);
  } else if (pick < 0.66 && detail > 0.5) {
    // 빨래 — 줄과 옷가지. 근경에서만 만든다.
    const [lx, lz] = f.at(u - UNIT_W * 0.34, D * 0.8);
    const [ex, ez] = f.at(u + UNIT_W * 0.34, D * 0.8);
    b.add(tubeBetween([lx, y + 1.5, lz], [ex, y + 1.45, ez], 0.018, 4), mats.cableMat);
    const n = rng.int(2, 4);
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n - 0.5;
      const [wx, wz] = f.at(u + UNIT_W * 0.68 * t, D * 0.8);
      const [ww, wd] = f.size(rng.range(0.3, 0.5), 0.03);
      b.box(ww, rng.range(0.4, 0.75), wd, [wx, y + 1.15, wz], mats.laundryMats[rng.int(0, mats.laundryMats.length - 1)]);
    }
  } else if (pick < 0.84) {
    // 짐 — 상자와 잡동사니
    for (let i = 0; i < rng.int(1, 3); i++) {
      const [bx, bz] = f.at(u + rng.range(-1.2, 1.2), D * rng.range(0.35, 0.7));
      const [bw, bd] = f.size(rng.range(0.4, 0.7), rng.range(0.35, 0.5));
      b.box(bw, rng.range(0.3, 0.55), bd, [bx, y + 0.3, bz], rng.chance(0.5) ? mats.crateMat : mats.ductMat);
    }
  } else {
    // 판자로 막았다 — 발코니를 방으로 쓴다. 가장 드물지만 인상이 강하다.
    const [wx, wz] = f.at(u, D * 0.92);
    const [ww, wd] = f.size(UNIT_W * 0.84, 0.08);
    b.box(ww, HOME_FLOOR - 0.3, wd, [wx, y + (HOME_FLOOR - 0.3) / 2, wz], mats.shutterMat);
    if (rng.chance(0.6)) {
      b.box(ww * 0.34, 0.5, wd, [wx, y + 1.5, wz], neonSoft(NEON.warm));
    }
  }

  // 창 — 발코니 안쪽. 켜진 집과 꺼진 집.
  const [gx, gz] = f.at(u, 0.06);
  const [gw, gd] = f.size(UNIT_W * 0.6, 0.08);
  if (rng.chance(0.44)) {
    b.add(autoBox(gw, 1.3, gd, [gx, y + 1.1, gz], 0.02), mats.homeLitMat);
  } else {
    b.box(gw, 1.3, gd, [gx, y + 1.1, gz], mats.homeDarkMat);
  }
}

// ── 편복도 ─────────────────────────────────────────────────────────────────
//
// 건물 뒷면에 그대로 드러난 복도. 계단 하나로 한 층 전체에 접근하는 방식이라
// 승강기 코어보다 싸다. **가난하게 지었다는 증거**이고, 동시에 이 건물의
// 수직 동선이 밖에 있다는 뜻이다.
function accessDeck(b, f, y, rng, mats) {
  const D = 1.4;
  const [cx, cz] = f.at(0, D / 2);
  const [sw, sd] = f.size(f.w, D);
  b.box(sw, 0.16, sd, [cx, y, cz], mats.grateMat);

  // 난간 — 가로대 둘
  const [rx, rz] = f.at(0, D);
  for (const hy of [0.5, 1.0]) {
    const [bw, bd] = f.size(f.w, 0.05);
    b.box(bw, 0.05, bd, [rx, y + hy, rz], mats.pipeMat);
  }
  const posts = Math.max(2, Math.round(f.w / 2.4));
  for (let i = 0; i <= posts; i++) {
    const [ax, az] = f.at(-f.w / 2 + (f.w * i) / posts, D);
    b.box(0.05, 1.0, 0.05, [ax, y + 0.5, az], mats.pipeMat);
  }
  // 복도등 — 몇 칸 걸러 하나. 형광등이라 차갑다.
  for (let i = 0; i < Math.max(1, Math.round(f.w / 9)); i++) {
    const [lx, lz] = f.at(-f.w / 2 + f.w * ((i + 0.5) / Math.max(1, Math.round(f.w / 9))), D * 0.5);
    const [lw, ld] = f.size(0.7, 0.12);
    b.box(lw, 0.1, ld, [lx, y + HOME_FLOOR - 0.35, lz], neonSoft(0xc8d4e0));
  }
}

// ── 옥상 ───────────────────────────────────────────────────────────────────
//
// 물탱크와 안테나 숲. 세대마다 접시를 따로 달았기 때문에 지저분하다 —
// 한 번에 설계했으면 하나로 충분했을 것이다. 여기도 설계와 생활의 충돌이다.
function roofClutter(b, r, top, rng, mats) {
  const c = rectCenter(r);
  const s = rectSize(r);
  // 물탱크
  for (let i = 0; i < rng.int(2, 4); i++) {
    const x = c.x + rng.range(-s.w * 0.34, s.w * 0.34);
    const z = c.z + rng.range(-s.d * 0.34, s.d * 0.34);
    const h = rng.range(1.6, 2.4);
    b.cylinder(1.1, 1.1, h, [x, top + h / 2 + 0.6, z], mats.rustMat, 10);
    for (const su of [-0.7, 0.7]) {
      b.box(0.12, 0.6, 0.12, [x + su, top + 0.3, z], mats.metalMat);
      b.box(0.12, 0.6, 0.12, [x, top + 0.3, z + su], mats.metalMat);
    }
  }
  // 안테나 숲 — 세대 수만큼 있는 것이 요점이다
  const n = rng.int(6, 14);
  for (let i = 0; i < n; i++) {
    const x = c.x + rng.range(-s.w * 0.42, s.w * 0.42);
    const z = c.z + rng.range(-s.d * 0.42, s.d * 0.42);
    const h = rng.range(1.2, 2.6);
    b.box(0.05, h, 0.05, [x, top + h / 2, z], mats.pipeMat);
    if (rng.chance(0.5)) b.cylinder(0.34, 0.34, 0.07, [x, top + h, z], mats.metalMat, 8);
  }
  // 옥상 빨래줄
  if (rng.chance(0.7)) {
    const z0 = c.z - s.d * 0.3;
    const z1 = c.z + s.d * 0.3;
    b.add(tubeBetween([c.x, top + 1.5, z0], [c.x, top + 1.4, z1], 0.02, 4), mats.cableMat);
  }
  // 난간
  b.add(rectBox(shrink(r, 0.15), top, 0.9, PANEL_TILE), mats.pipeMat);
}

// ── 한 동 ──────────────────────────────────────────────────────────────────

export function housingSlab(b, r, rng, mats, faces, detail, pools) {
  // 6~14층. 탑이 아니라 슬래브다.
  const floors = rng.int(6, 14);
  const top = floors * HOME_FLOOR;

  b.add(rectBox(r, 0, top, PANEL_TILE), mats.panelMat);

  // 어느 면이 앞(발코니)이고 어느 면이 뒤(편복도)인가.
  // 긴 면이 앞이다 — 세대를 옆으로 늘어놓으니 당연히 그렇게 된다.
  const s = rectSize(r);
  const frontSides = s.w >= s.d ? ['pz', 'nz'] : ['px', 'nx'];
  let backUsed = false;

  for (const side of SIDES) {
    if (!faces[side]) continue;
    const f = frameOf(r, side);
    if (f.w < 6) continue;

    const isFront = frontSides.includes(side);
    const units = Math.max(2, Math.floor(f.w / UNIT_W));
    const uw = f.w / units;

    for (let fl = 0; fl < floors; fl++) {
      const y = fl * HOME_FLOOR;

      if (isFront) {
        // 앞면 — 발코니 격자. 이 건물의 전부다.
        for (let i = 0; i < units; i++) {
          balcony(b, { ...f, at: f.at, size: f.size }, -f.w / 2 + uw * (i + 0.5), y, rng, mats, detail);
        }
      } else if (!backUsed) {
        // 뒷면 — 편복도. 한 면에만 붙인다 (실제로도 한쪽이다).
        accessDeck(b, f, y, rng, mats);
      }
    }
    if (!isFront) backUsed = true;
  }

  // 1층 출입구 — 상가가 아니라 **현관**이다. 이 구역과 상업 구역의 결정적 차이.
  for (const side of SIDES) {
    if (!faces[side]) continue;
    const f = frameOf(r, side);
    if (f.w < 6) continue;
    const [dx, dz] = f.at(rng.range(-f.w * 0.3, f.w * 0.3), 0.1);
    const [dw, dd] = f.size(2.6, 0.2);
    b.box(dw, 2.6, dd, [dx, 1.3, dz], mats.frameMat);
    const [lw, ld] = f.size(2.2, 0.1);
    b.box(lw, 0.4, ld, [dx, 2.75, dz], neonSoft(0xc8d4e0));
    pools.push({
      kind: 'floor', x: f.at(0, 1.6)[0], y: 0.21, z: f.at(0, 1.6)[1],
      rx: 3.0, rz: 3.0, tint: [0.32, 0.36, 0.42],
    });
    break; // 현관은 한 면에 하나
  }

  roofClutter(b, r, top, rng, mats);
  return { top, floors };
}
