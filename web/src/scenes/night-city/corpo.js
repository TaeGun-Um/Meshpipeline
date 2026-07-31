// 광장형 타워 — 기업 구역의 건물.
//
// ── 이 건물이 왜 이렇게 생겼는가 (docs/city.md 2기) ────────────────────────
// 공장이 성공하자 기업이 본사를 도심에 세웠다. 이 구역은 도시에서 유일하게
// **다시 설계된 곳**이다. 나머지는 1기의 계획 위에 3·4기가 덮인 결과인데,
// 여기만 기업이 자기 땅을 갈아엎고 새로 그렸다.
//
// 그래서 다른 구역과 반대되는 원칙으로 만든다.
//
//   · 대지를 꽉 채우지 않는다. 오히려 **비운다** — 광장이 부의 표시다.
//     번화가가 한 뼘도 못 비우는 것과 정확히 대비된다.
//   · 1층에 점포가 없다. 로비 하나뿐이다. 아무나 못 들어간다.
//   · 외벽이 매끈하다. 설비가 **안에** 있다 — 다시 설계했으므로 배관을
//     밖으로 뺄 필요가 없었다. 이 매끈함이 이 도시에서 가장 비싼 것이다.
//   · 골목이 없다. 뒷길은 계획에 없던 것이고 이 구역은 계획대로 유지된다.
//
// ── 광장에 무엇이 있는가 ───────────────────────────────────────────────────
// 비운 땅을 그냥 두면 공터다. 광장이 광장이 되려면 **관리되고 있다는 신호**가
// 필요하다. 조형된 화단, 수반, 열 맞춘 조명, 보안 볼라드. 전부 사람이 손을
// 대고 있다는 표시이고, 그게 이 구역의 성격이다.
import * as THREE from 'three';
import { autoBox, lathe, tubeBetween } from '../../core/profile.js';
import {
  SIDES,
  outward,
  faceWidth,
  faceAnchor,
  alongZ,
  shrink,
  rectBox,
  upPlane,
  rectCenter,
  rectSize,
} from '../../core/boxfaces.js';
import { NEON, rgb01 } from '../../shared/neon.js';
import { neon } from '../../shared/masters.js';
import { PANEL_TILE, FLOOR_HEIGHT, CURB_HEIGHT } from './layout.js';

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

// ── 광장 ───────────────────────────────────────────────────────────────────
//
// 타워가 서고 남은 땅 전부. 이 도시에서 유일하게 **비어 있는 것이 의도인** 공간이다.
function plaza(b, lot, tower, rng, mats, pools) {
  const Y = CURB_HEIGHT;
  const c = rectCenter(lot);
  const s = rectSize(lot);

  // 포장 — 인도와 다른 마감. 여기부터 사유지라는 표시다.
  b.add(upPlane(s.w, s.d, [c.x, Y + 0.02, c.z], [4, 4]), mats.plazaMat);

  // 단 — 광장이 인도보다 한 단 높다. 이 한 단이 "들어오려면 올라와야 한다" 는
  // 신호이고, 실제 기업 사옥이 늘 쓰는 방식이다.
  b.add(rectBox(shrink(lot, 0.4), Y, 0.34, PANEL_TILE), mats.plazaStepMat);

  const tc = rectCenter(tower);
  const ts = rectSize(tower);

  // 조형 화단 — 열을 맞춘다. 번화가 화분이 제각각인 것과 대비된다.
  const beds = rng.int(2, 4);
  for (let i = 0; i < beds; i++) {
    const t = (i + 0.5) / beds - 0.5;
    const px = c.x + (s.w >= s.d ? t * s.w * 0.62 : s.w * 0.34);
    const pz = c.z + (s.w >= s.d ? s.d * 0.34 : t * s.d * 0.62);
    const bw = s.w >= s.d ? 5.5 : 2.2;
    const bd = s.w >= s.d ? 2.2 : 5.5;
    b.add(autoBox(bw, 0.55, bd, [px, Y + 0.55, pz], 0.05), mats.plazaStepMat);
    // 식재 — 낮고 가지런하다
    for (let k = 0; k < 4; k++) {
      const u = (k / 3 - 0.5);
      b.sphere(
        rng.range(0.4, 0.6),
        [px + (s.w >= s.d ? u * bw * 0.6 : 0), Y + 1.0, pz + (s.w >= s.d ? 0 : u * bd * 0.6)],
        mats.foliageMat
      );
    }
  }

  // 수반 — 물이 있다는 것 자체가 사치다. 매립지 도시에서 특히 그렇다.
  if (rng.chance(0.5)) {
    const px = c.x + rng.range(-s.w * 0.24, s.w * 0.24);
    const pz = c.z + rng.range(-s.d * 0.24, s.d * 0.24);
    const rw = rng.range(4, 7);
    b.add(autoBox(rw, 0.4, rw * 0.7, [px, Y + 0.2, pz], 0.04), mats.plazaStepMat);
    b.add(upPlane(rw - 0.5, rw * 0.7 - 0.5, [px, Y + 0.42, pz]), mats.waterMat);
    pools.push({ kind: 'floor', x: px, y: Y + 0.03, z: pz, rx: rw, rz: rw, tint: rgb01(NEON.cool, 0.2) });
  }

  // 보안 볼라드 — 광장 경계를 따라 열 맞춰. 차를 막고 사람은 통과시킨다.
  const per = Math.max(4, Math.round(s.w / 7));
  for (let i = 0; i < per; i++) {
    const t = (i + 0.5) / per - 0.5;
    for (const sg of [-1, 1]) {
      b.cylinder(0.13, 0.15, 0.9, [c.x + t * s.w * 0.9, Y + 0.45, c.z + sg * s.d * 0.46], mats.metalMat, 8);
      b.cylinder(0.13, 0.15, 0.9, [c.x + sg * s.w * 0.46, Y + 0.45, c.z + t * s.d * 0.9], mats.metalMat, 8);
    }
  }

  // 광장등 — 열 맞춘 기둥등. 가로등과 달리 사방을 비춘다.
  const lamps = rng.int(3, 6);
  for (let i = 0; i < lamps; i++) {
    const a = (i / lamps) * Math.PI * 2;
    const lx = tc.x + Math.cos(a) * (ts.w / 2 + 5);
    const lz = tc.z + Math.sin(a) * (ts.d / 2 + 5);
    b.cylinder(0.1, 0.12, 4.2, [lx, Y + 2.1, lz], mats.metalMat, 8);
    b.add(lathe([[0.05, 0], [0.34, 0.3], [0.35, 0.32]], 10, [lx, Y + 4.2, lz]), mats.metalMat);
    b.sphere(0.16, [lx, Y + 4.1, lz], neon(0xd8e8ff));
    pools.push({ kind: 'floor', x: lx, y: Y + 0.04, z: lz, rx: 4.4, rz: 4.4, tint: rgb01(0xd8e8ff, 0.34) });
  }
}

// ── 로비 ───────────────────────────────────────────────────────────────────
//
// 1층 전체가 이것 하나다. 점포가 없다는 것이 이 구역의 정의다.
// 층고가 높아야 한다 — 높은 로비는 그 자체로 과시다.
function lobby(b, r, rng, mats, pools) {
  const H = FLOOR_HEIGHT * 2.4;
  const Y = CURB_HEIGHT;

  for (const side of SIDES) {
    const f = frameOf(r, side);
    if (f.w < 6) continue;

    // 유리면 — 안이 밝다. 밤에도 로비만 켜져 있는 것이 기업 건물의 인상이다.
    const [gx, gz] = f.at(0, 0.08);
    const [gw, gd] = f.size(f.w * 0.9, 0.12);
    b.add(autoBox(gw, H * 0.8, gd, [gx, Y + H * 0.46, gz], 0.02), mats.lobbyLitMat);

    // 멀리온 — 유리면을 세로로 나눈다. 없으면 통짜 발광판이다.
    const n = Math.max(3, Math.round(f.w / 3.2));
    for (let i = 0; i <= n; i++) {
      const u = -f.w * 0.45 + f.w * 0.9 * (i / n);
      const [mx, mz] = f.at(u, 0.14);
      const [mw, md] = f.size(0.14, 0.2);
      b.box(mw, H * 0.8, md, [mx, Y + H * 0.46, mz], mats.frameMat);
    }

    // 캐노피 — 입구 위. 얇고 길게 내민다.
    const [cx2, cz2] = f.at(0, 1.6);
    const [cw, cd] = f.size(f.w * 0.6, 3.2);
    b.box(cw, 0.24, cd, [cx2, Y + H * 0.7, cz2], mats.metalMat);
    for (const su of [-0.26, 0.26]) {
      const [ax, az] = f.at(f.w * su, 0.1);
      const [bx, bz] = f.at(f.w * su, 3.0);
      b.add(tubeBetween([ax, Y + H * 0.86, az], [bx, Y + H * 0.7 + 0.12, bz], 0.05, 4), mats.metalMat);
    }
    b.add(
      upPlane(f.size(f.w * 0.55, 2.8)[0], f.size(f.w * 0.55, 2.8)[1], [cx2, Y + H * 0.7 - 0.14, cz2]),
      mats.deckUnderMat
    );
    pools.push({
      kind: 'floor', x: cx2, y: Y + 0.05, z: cz2, rx: 6.0, rz: 6.0,
      tint: rgb01(0xd8e8ff, 0.42),
    });
  }

  // 로비 슬래브 위 띠 — 기업 로고 자리. 간판이 아니라 **표식**이다.
  b.add(rectBox(shrink(r, -0.3), Y + H - 0.9, 0.9, PANEL_TILE), mats.panelMat);
  return H;
}

// ── 한 동 ──────────────────────────────────────────────────────────────────

export function corpoTower(b, lot, rng, mats, height, pools, signs) {
  // 대지를 꽉 채우지 않는다. **비우는 것이 요점**이다.
  // 번화가가 한 뼘도 못 비우는 것과 정확히 대비된다.
  const s = rectSize(lot);
  const inset = Math.min(s.w, s.d) * rng.range(0.2, 0.31);
  const tower = shrink(lot, inset);
  if (tower.x1 - tower.x0 < 8 || tower.z1 - tower.z0 < 8) return null;

  plaza(b, lot, tower, rng, mats, pools);

  const Y = CURB_HEIGHT;
  const lobbyH = lobby(b, tower, rng, mats, pools);

  // 샤프트 — 매끈하다. 설비가 안에 있으므로 붙일 것이 없다.
  // 이 매끈함이 이 도시에서 가장 비싼 것이다.
  const top = Math.max(lobbyH + FLOOR_HEIGHT * 6, height);
  b.add(rectBox(tower, Y + lobbyH, top - lobbyH, PANEL_TILE), mats.corpoSkinMat);

  // 층 구분선 — 유일한 표면 요철. 몇 층마다 얇은 띠.
  for (let y = Y + lobbyH + FLOOR_HEIGHT * 4; y < top - 2; y += FLOOR_HEIGHT * 4) {
    b.add(rectBox(shrink(tower, -0.14), y, 0.18, PANEL_TILE), mats.frameMat);
  }

  // 옥상 — 첨탑과 헬리패드. 물탱크나 판잣집이 아니다.
  const tc = rectCenter(tower);
  const ts = rectSize(tower);
  b.add(rectBox(shrink(tower, -0.5), top, 0.7, PANEL_TILE), mats.panelMat);
  if (rng.chance(0.55)) {
    // 헬리패드 — 여기 사람이 헬기로 온다는 뜻이다
    b.cylinder(Math.min(ts.w, ts.d) * 0.3, Math.min(ts.w, ts.d) * 0.3, 0.3, [tc.x, top + 0.9, tc.z], mats.plazaStepMat, 16);
    b.cylinder(Math.min(ts.w, ts.d) * 0.22, Math.min(ts.w, ts.d) * 0.22, 0.04, [tc.x, top + 1.07, tc.z], mats.paintMat, 16);
  }
  // 첨탑
  const mast = rng.range(10, 26);
  b.add(lathe([[0.7, 0], [0.3, mast * 0.7], [0.08, mast]], 8, [tc.x, top + 0.7, tc.z]), mats.metalMat);
  for (let i = 1; i <= 3; i++) {
    b.sphere(0.22, [tc.x, top + 0.7 + (mast * i) / 3.2, tc.z], neon(0xff2a2a));
  }

  // 기업 로고 — 크고 하나뿐이다. 번화가가 간판을 겹겹이 쌓는 것과 대비된다.
  if (rng.chance(0.7)) {
    const side = SIDES[rng.int(0, 3)];
    signs.push({
      kind: 'mega', rect: tower, side,
      y: top - rng.range(14, 30), w: Math.min(ts.w, ts.d) * 0.55, h: rng.range(8, 14),
      scheme: rng.int(0, 5),
    });
  }

  return { top: top + mast };
}
