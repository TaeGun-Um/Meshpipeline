// 공장동 — 공업 구역의 건물.
//
// ── 이 건물이 왜 이렇게 생겼는가 (docs/city.md 1기) ────────────────────────
// **이 도시가 존재하는 이유**다. 기업이 항만과 공장을 세우려고 바다를 메웠고,
// 도시는 그 공장을 돌릴 사람을 살게 하려고 만들어졌다. 즉 공장이 먼저고
// 도시가 나중이다.
//
// 그래서 공장동은 도시의 다른 건물과 원리가 다르다. **사람이 보라고 지은 것이
// 아니라 기계가 들어가라고 지은 것**이다.
//
//   · 낮고 길다. 생산 라인이 직선이라 건물도 직선이다.
//   · 위로 안 올린다. 크레인과 물류가 수평으로 움직인다.
//   · 창이 거의 없다. 있어도 높은 곳의 채광창뿐이다 — 벽은 설비가 붙을 자리다.
//   · 톱니 지붕. 북향 채광창으로 그림자 없는 빛을 들이는 공장 고유의 형태다.
//   · 사일로·굴뚝·파이프 랙이 건물보다 눈에 띈다.
//   · 간판이 없다. 팔 것이 없으므로 호객할 이유가 없다.
//
// 조명도 다르다. 네온이 아니라 **주황 나트륨 작업등**이다. 이 구역에
// 홀로그램이 없는 것은 대비를 위해서가 아니라 1기의 것이기 때문이다.
//
// 결과적으로 실루엣이 도시의 나머지와 정반대다 — 세로가 아니라 **가로**로
// 길고, 빛나지 않고, 굴뚝 몇 개만 하늘을 찌른다.
import * as THREE from 'three';
import { autoBox, tubeBetween, lathe } from '../../core/profile.js';
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
import { NEON, rgb01 } from '../../shared/neon.js';
import { neon, neonSoft } from '../../shared/masters.js';
import { PANEL_TILE } from './layout.js';

// 공장 한 동의 높이. 크레인이 지나갈 만큼만 높다.
const SHED_H = 11;

// ── 톱니 지붕 ──────────────────────────────────────────────────────────────
//
// 공장을 공장으로 만드는 단 하나의 형태. 경사면과 수직 채광창이 번갈아
// 반복된다. 채광창을 북쪽으로 두면 하루 종일 그림자 없는 빛이 들어와서,
// 조명 없이도 정밀 작업이 가능했다 — 그래서 20세기 공장은 전부 이 지붕이다.
//
// 경사면을 평평한 판 하나로 만들면 그냥 기울어진 뚜껑이다. **채광창이
// 발광해야** 톱니로 읽힌다.
function sawtooth(b, r, y, rng, mats) {
  const c = rectCenter(r);
  const s = rectSize(r);
  // 긴 축을 따라 톱니를 반복한다
  const alongX = s.w >= s.d;
  const span = alongX ? s.w : s.d;
  const width = alongX ? s.d : s.w;
  const teeth = Math.max(3, Math.round(span / 9));
  const pitch = span / teeth;
  const rise = 2.6;

  for (let i = 0; i < teeth; i++) {
    const t = -span / 2 + pitch * (i + 0.5);
    const px = alongX ? c.x + t : c.x;
    const pz = alongX ? c.z : c.z + t;

    // 경사면 — 얇은 판을 기울인다
    const slope = new THREE.BoxGeometry(alongX ? pitch * 0.82 : width, 0.18, alongX ? width : pitch * 0.82);
    slope.rotateZ(alongX ? -0.42 : 0);
    slope.rotateX(alongX ? 0 : 0.42);
    slope.translate(px, y + rise * 0.5, pz);
    b.add(slope, mats.rustMat);

    // 수직 채광창 — 여기가 발광해야 톱니로 읽힌다.
    // 야간이라 안쪽 작업등이 새어 나오는 상태다.
    const gw = alongX ? pitch * 0.2 : width * 0.94;
    const gd = alongX ? width * 0.94 : pitch * 0.2;
    const gx = alongX ? px + pitch * 0.34 : px;
    const gz = alongX ? pz : pz + pitch * 0.34;
    b.add(
      autoBox(gw, rise * 0.86, gd, [gx, y + rise * 0.5, gz], 0.02),
      rng.chance(0.55) ? mats.factoryLitMat : mats.factoryDarkMat
    );
  }
}

// ── 사일로 ─────────────────────────────────────────────────────────────────
//
// 원통이 이 구역의 유일한 곡면이다. 도시 전체가 직각인데 여기만 둥글어서
// 멀리서도 공업지구가 어디인지 알 수 있다.
// room 은 이 자리에서 필지 경계까지의 거리다. **몸통이 아니라 딸린 것까지**
// 그 안에 들어가야 한다 — 사다리가 r+0.12 만큼 더 나간다.
function silo(b, x, z, rng, mats, room = Infinity) {
  const r = Math.min(rng.range(2.2, 3.6), Math.max(0.9, room - 0.4));
  const h = rng.range(9, 17);
  b.cylinder(r, r, h, [x, h / 2, z], mats.rustMat, 14);
  // 원뿔 지붕
  b.add(lathe([[r * 1.04, 0], [r * 0.6, 1.1], [0.1, 1.9]], 14, [x, h, z]), mats.metalMat);
  // 보강 링 — 없으면 그냥 기둥이다
  for (let ry = 2.2; ry < h; ry += rng.range(2.6, 3.8)) {
    b.cylinder(r * 1.05, r * 1.05, 0.14, [x, ry, z], mats.metalMat, 14);
  }
  // 외부 사다리
  for (const su of [-0.16, 0.16]) {
    b.add(tubeBetween([x + r + 0.12, 0.4, z + su], [x + r + 0.12, h - 0.4, z + su], 0.05, 4), mats.pipeMat);
  }
  // 꼭대기 항공장애등
  b.sphere(0.18, [x, h + 2.0, z], neon(NEON.amber));
}

// ── 굴뚝 ───────────────────────────────────────────────────────────────────
//
// 이 구역에서 유일하게 하늘을 찌르는 것. 도심의 타워가 하는 일을
// 여기서는 굴뚝이 한다.
// ── room 을 왜 받는가 (배치 검사가 잡았다) ────────────────────────────────
// 굴뚝 몸통은 반경 2m 도 안 되는데 **지지 케이블이 h*0.42 만큼 퍼진다.**
// 높이가 42m 까지 가므로 케이블 끝이 중심에서 **17.6m** 나간다.
//
// 굴뚝은 필지 중심에서 ±30% 지점에 서므로, 그 케이블이 옆 필지 건물을
// 통째로 관통했다. 공업 구역 건물 관통 3쌍의 주범이다.
function stack(b, x, z, rng, mats, room = Infinity) {
  const h = rng.range(22, 42);
  const r0 = rng.range(1.3, 2.0);
  b.add(lathe([[r0, 0], [r0 * 0.78, h * 0.6], [r0 * 0.66, h], [r0 * 0.58, h]], 12, [x, 0, z]), mats.rustMat);
  // 경고 도색 띠 — 굴뚝의 정체성
  for (let i = 0; i < 3; i++) {
    const by = h * (0.62 + i * 0.11);
    b.cylinder(r0 * 0.72, r0 * 0.72, 1.1, [x, by, z], mats.hazardMat, 12);
  }
  // 지지 케이블 셋 — 필지를 벗어나지 않는 범위에서만 펼친다.
  // 자리가 없으면 아예 안 단다. 케이블 없는 굴뚝이 남의 건물을 뚫는 것보다 낫다.
  const guy = Math.min(h * 0.42, room - 0.6);
  if (guy > 3) {
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2;
      b.add(
        tubeBetween([x, h * 0.82, z], [x + Math.cos(a) * guy, 0, z + Math.sin(a) * guy], 0.05, 4),
        mats.cableMat
      );
    }
  }
  b.sphere(0.2, [x, h + 0.4, z], neon(NEON.amber));
}

// ── 하역구 ─────────────────────────────────────────────────────────────────
//
// 공장의 '출입구' 다. 사람 문이 아니라 **트럭 문**이다 — 그래서 크고,
// 바닥에서 1.1m 올라간 하역 단이 붙는다. 트럭 짐칸 높이다.
function loadingDock(b, f, u, rng, mats, pools) {
  const W = rng.range(3.4, 4.6);
  const H = 4.2;
  const [dx, dz] = f.at(u, 0.1);
  const [sw, sd] = f.size(W, 0.2);

  // 롤 셔터
  b.box(sw, H, sd, [dx, H / 2 + 1.1, dz], mats.shutterMat);
  // 문틀
  const [fw, fd] = f.size(W + 0.5, 0.3);
  b.box(fw, 0.35, fd, [dx, H + 1.28, dz], mats.metalMat);

  // 하역 단 — 이게 있어야 트럭용 문으로 읽힌다
  const [px, pz] = f.at(u, 1.6);
  const [pw, pd] = f.size(W + 1.2, 3.2);
  b.box(pw, 1.1, pd, [px, 0.55, pz], mats.wetConcreteMat);
  // 완충 고무
  for (const su of [-0.5, 0.5]) {
    const [bx, bz] = f.at(u + W * su, 0.24);
    const [bw, bd] = f.size(0.3, 0.18);
    b.box(bw, 0.5, bd, [bx, 1.5, bz], mats.bagMat);
  }

  // 작업등 — 주황 나트륨. 이 구역에 네온은 없다.
  const [lx, lz] = f.at(u, 0.5);
  b.box(0.9, 0.18, 0.4, [lx, H + 1.9, lz], mats.metalMat);
  b.add(
    autoBox(f.size(0.8, 0.12)[0], 0.14, f.size(0.8, 0.12)[1], [lx, H + 1.78, lz], 0.01),
    neonSoft(0xff9a3c)
  );
  pools.push({
    kind: 'floor', x: f.at(u, 3.2)[0], y: 0.03, z: f.at(u, 3.2)[1],
    rx: 5.0, rz: 5.0, tint: rgb01(0xff9a3c, 0.44),
  });
}

// 면 위의 국소 좌표계
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

// ── 파이프 랙 ──────────────────────────────────────────────────────────────
//
// 건물과 건물 사이를 잇는 배관 다발. 공업지구의 '브릿지' 다 — 사람이 아니라
// 물질이 건너간다. 이게 있어야 공장들이 하나의 설비로 읽힌다.
function pipeRack(b, r, rng, mats) {
  const c = rectCenter(r);
  const s = rectSize(r);
  const alongX = s.w >= s.d;
  const len = (alongX ? s.w : s.d) * 0.9;
  const y = rng.range(5.5, 8.5);

  // 지지 가구
  const bents = Math.max(2, Math.round(len / 11));
  for (let i = 0; i <= bents; i++) {
    const t = -len / 2 + (len * i) / bents;
    const px = alongX ? c.x + t : c.x;
    const pz = alongX ? c.z : c.z + t;
    for (const su of [-0.9, 0.9]) {
      b.box(0.24, y, 0.24, [px + (alongX ? 0 : su), y / 2, pz + (alongX ? su : 0)], mats.metalMat);
    }
    b.box(alongX ? 0.24 : 2.2, 0.22, alongX ? 2.2 : 0.24, [px, y, pz], mats.metalMat);
  }
  // 배관 넷 — 굵기가 달라야 배관 다발로 보인다
  for (let i = 0; i < 4; i++) {
    const off = -0.75 + i * 0.5;
    const rad = [0.22, 0.14, 0.28, 0.11][i];
    const A = alongX ? [c.x - len / 2, y + rad + 0.12, c.z + off] : [c.x + off, y + rad + 0.12, c.z - len / 2];
    const B = alongX ? [c.x + len / 2, y + rad + 0.12, c.z + off] : [c.x + off, y + rad + 0.12, c.z + len / 2];
    b.add(tubeBetween(A, B, rad, 6), i === 2 ? mats.rustMat : mats.pipeMat);
  }
}

// ── 한 동 ──────────────────────────────────────────────────────────────────

export function factoryBlock(b, r, rng, mats, faces, detail, pools) {
  const s = rectSize(r);
  const c = rectCenter(r);

  // 덩치 — 낮고 길다. 세트백 없음.
  const h = SHED_H * rng.range(0.8, 1.25);
  b.add(rectBox(r, 0, h, PANEL_TILE), mats.panelMat);

  // 높은 채광창 띠 — 공장의 유일한 창. 눈높이가 아니라 지붕 밑이다.
  for (const side of SIDES) {
    if (!faces[side]) continue;
    const f = frameOf(r, side);
    if (f.w < 5) continue;
    const [gw, gd] = f.size(f.w * 0.9, 0.14);
    const [gx, gz] = f.at(0, 0.08);
    b.add(
      autoBox(gw, 1.2, gd, [gx, h - 1.6, gz], 0.02),
      rng.chance(0.4) ? mats.factoryLitMat : mats.factoryDarkMat
    );

    // 하역구 — 도로에 면한 곳에만
    const docks = Math.max(1, Math.round((f.w / 22) * detail));
    for (let i = 0; i < docks; i++) {
      const u = -f.w / 2 + f.w * ((i + 0.5) / docks) + rng.range(-2, 2);
      if (Math.abs(u) > f.w / 2 - 3.5) continue;
      loadingDock(b, f, u, rng, mats, pools);
    }
  }

  sawtooth(b, shrink(r, 0.6), h, rng, mats);

  // 사일로·굴뚝 — 건물보다 눈에 띈다.
  //
  // 자리마다 **필지 경계까지 남은 거리**를 함께 넘긴다. 이걸 안 넘겼더니
  // 굴뚝 지지 케이블(최대 17.6m)이 옆 필지 건물을 관통했다 (배치 검사).
  const room = (px, pz) => Math.min(px - r.x0, r.x1 - px, pz - r.z0, r.z1 - pz);

  const silos = rng.int(0, 3);
  for (let i = 0; i < silos; i++) {
    const sx = c.x + rng.range(-s.w * 0.32, s.w * 0.32);
    const sz = c.z + rng.range(-s.d * 0.32, s.d * 0.32);
    silo(b, sx, sz, rng, mats, room(sx, sz));
  }
  if (rng.chance(0.45)) {
    const kx = c.x + rng.range(-s.w * 0.3, s.w * 0.3);
    const kz = c.z + rng.range(-s.d * 0.3, s.d * 0.3);
    stack(b, kx, kz, rng, mats, room(kx, kz));
  }
  if (rng.chance(0.6 * detail)) pipeRack(b, r, rng, mats);

  return { top: h };
}
