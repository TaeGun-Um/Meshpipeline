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
import { autoBox, tubeBetween, lathe, yawBox } from '../../core/profile.js';
import {
  faceFrame,
  SIDES,
  shrink,
  rectBox,
  rectCenter,
  rectSize,
  upPlane,
} from '../../core/boxfaces.js';
import { NEON, rgb01 } from '../../shared/neon.js';
import { neon, neonSoft } from '../../shared/masters.js';
import { hash2 } from '../../core/textures.js';
import { PANEL_TILE } from './layout.js';
import { onSceneReset } from '../../core/scenestate.js';

// 공장 한 동의 높이. 크레인이 지나갈 만큼만 높다.
const SHED_H = 11;

// 대지가 무엇을 하는 공장인가. **대지 하나는 그중 하나만 한다** —
// 모든 설비를 모든 대지에 놓았더니 공업 구역이 통째로 원통 밭이 됐다.
const FACTORY_KINDS = ['조립', '공정', '야적', '동력'];

// ── 표본 ───────────────────────────────────────────────────────────────────
// "넷으로 갈랐다" 와 "화면에 넷 다 나온다" 는 다르다. 공업은 대지가 여섯뿐이라
// 한 종류가 통째로 안 나올 수 있다.
const EMPTY = () => ({
  ...Object.fromEntries(FACTORY_KINDS.map((k) => [k, 0])),
  헛간: 0, 공정탑: 0, 탱크야드: 0, 굴뚝: 0, 사일로: 0,
  // 지붕 종류는 `ROOFS` 가 유일한 출처다 (아래). 여기 다시 적으면 결합이다
  지붕: {},
});
let TALLY = EMPTY();
export function factoryTally() {
  return { ...TALLY, 지붕: { ...TALLY.지붕 } };
}
onSceneReset('공업 표본', () => { TALLY = EMPTY(); });

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
      // 켜진 칸을 줄인다. 야간 공장은 전 라인이 도는 것이 아니라
      // 교대조가 있는 동만 켜져 있다 — 그 얼룩이 공장을 살아 있게 한다
      rng.chance(0.32) ? mats.factoryLitMat : mats.factoryDarkMat
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
  return h;
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

// ── 파이프 랙 ──────────────────────────────────────────────────────────────
//
// 건물과 건물 사이를 잇는 배관 다발. 공업지구의 '브릿지' 다 — 사람이 아니라
// 물질이 건너간다. 이게 있어야 공장들이 하나의 설비로 읽힌다.
//
// ── 전에는 아무것도 안 이었다 ──────────────────────────────────────────────
// 머리말은 "건물과 건물 사이를 잇는다" 인데, 실제로는 **필지 하나 안에서**
// 자기 건물 위를 지나가고 끝났다 (`pipeRack(b, r, ...)` 의 r 이 그 건물의
// 사각형이었다). 잇는 대상이 없으니 그냥 건물 위에 얹힌 파이프였다.
//
// 지금은 **자리를 받아서** 놓는다. 부르는 쪽이 "여기서 저기까지" 를 정한다.
function pipeRack(b, rect, rng, mats, height) {
  const c = rectCenter(rect);
  const s = rectSize(rect);
  const alongX = s.w >= s.d;
  const len = alongX ? s.w : s.d;
  const y = height ?? rng.range(5.5, 8.5);

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

// ── 공정탑 ─────────────────────────────────────────────────────────────────
//
// 증류탑·반응기. **건물이 아니라 설비**다 — 벽이 없고 기둥과 플랫폼과 계단이
// 그대로 드러난다. 헛간이 가로로 길다면 이것은 세로로 서서, 둘이 나란히
// 있어야 공업 구역의 실루엣에 높낮이가 생긴다.
//
// 공장에서 제일 사이버펑크한 것이 이것이다 — 사람이 들어갈 수 없는 크기의
// 기계가 밖에 서 있다.
function processTower(b, x, z, rng, mats, room) {
  const rad = Math.min(rng.range(2.6, 4.2), Math.max(1.2, room * 0.34));
  const h = rng.range(20, 34);

  // 몸통 — 위로 갈수록 가늘어진다. 그래야 굴뚝과 안 헷갈린다
  b.add(lathe([
    [rad, 0], [rad, h * 0.55], [rad * 0.82, h * 0.58],
    [rad * 0.82, h * 0.94], [rad * 0.6, h], [0.1, h + rad * 0.5],
  ], 16, [x, 0, z]), mats.rustMat);

  // 플랫폼 — 3~5층. 이 반복이 "올라갈 수 있는 기계" 를 만든다
  const decks = rng.int(3, 5);
  for (let i = 1; i <= decks; i++) {
    const dy = (h * 0.92 * i) / decks;
    const dr = rad * 1.45;
    b.cylinder(dr, dr, 0.18, [x, dy, z], mats.grateMat, 16);
    // 난간
    b.cylinder(dr, dr, 0.06, [x, dy + 0.95, z], mats.pipeMat, 16);
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2;
      b.box(0.07, 1.0, 0.07, [x + Math.cos(a) * dr, dy + 0.5, z + Math.sin(a) * dr], mats.pipeMat);
    }
  }
  // 나선 계단 — 플랫폼을 잇는다. 비스듬한 것이 여기밖에 없어 눈에 든다
  const steps = Math.round(h / 0.9);
  for (let i = 0; i < steps; i++) {
    const a = (i / steps) * Math.PI * 4;
    const sr = rad * 1.3;
    b.add(yawBox(1.1, 0.1, 0.7, [x + Math.cos(a) * sr, (h * 0.92 * i) / steps, z + Math.sin(a) * sr], -a),
      mats.grateMat);
  }
  // 옆에 붙은 배관 — 탑은 늘 무언가와 이어져 있다
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + 0.5;
    b.add(tubeBetween(
      [x + Math.cos(a) * rad, h * (0.3 + i * 0.2), z + Math.sin(a) * rad],
      [x + Math.cos(a) * (rad + 3.5), 1.2, z + Math.sin(a) * (rad + 3.5)], 0.16, 6), mats.pipeMat);
  }
  b.sphere(0.2, [x, h + rad * 0.5 + 0.5, z], neon(NEON.amber));
  return h;
}

// ── 탱크 야드 ──────────────────────────────────────────────────────────────
//
// 저장 탱크 여럿 + **방유제**. 방유제(둑)가 이것을 탱크 야드로 만든다 —
// 탱크만 놓으면 그냥 통 몇 개고, 둑이 둘러야 "새면 여기 고인다" 가 읽힌다.
function tankYard(b, rect, rng, mats) {
  const c = rectCenter(rect);
  const s = rectSize(rect);
  if (s.w < 12 || s.d < 12) return 0;

  // 방유제 — 낮은 콘크리트 둑
  for (const side of SIDES) {
    const f = faceFrame(rect, side);
    const [bw, bd] = f.size(f.w, 0.7);
    const [bx, bz] = f.at(0, -0.35);
    b.box(bw, 1.5, bd, [bx, 0.75, bz], mats.wetConcreteMat);
  }
  // 바닥 — 포장. 둑 안이 다른 바닥이어야 '가둔 곳' 이다
  b.add(upPlane(s.w - 1.4, s.d - 1.4, [c.x, 0.06, c.z], [3, 3]), mats.lotMat);

  // 탱크 — 자리에 맞춰 격자로. 개수는 면적이 정한다
  const nx = Math.max(1, Math.floor((s.w - 3) / 11));
  const nz = Math.max(1, Math.floor((s.d - 3) / 11));
  const cw = (s.w - 3) / nx;
  const cd = (s.d - 3) / nz;
  let top = 1.5;
  for (let i = 0; i < nx; i++) {
    for (let j = 0; j < nz; j++) {
      const tx = c.x - (s.w - 3) / 2 + cw * (i + 0.5);
      const tz = c.z - (s.d - 3) / 2 + cd * (j + 0.5);
      const rad = Math.min(cw, cd) * rng.range(0.32, 0.42);
      const h = rad * rng.range(1.3, 2.2);
      b.cylinder(rad, rad, h, [tx, h / 2, tz], mats.rustMat, 16);
      // 지붕 — 얕은 원뿔. 평지붕으로 두면 통조림이다
      b.add(lathe([[rad * 1.03, 0], [rad * 0.5, 0.7], [0, 0.95]], 16, [tx, h, tz]), mats.metalMat);
      // 보강 링과 사다리
      for (let ry = 1.6; ry < h; ry += 2.4) {
        b.cylinder(rad * 1.02, rad * 1.02, 0.1, [tx, ry, tz], mats.metalMat, 16);
      }
      b.add(tubeBetween([tx + rad + 0.1, 0.3, tz], [tx + rad + 0.1, h + 0.4, tz], 0.05, 4), mats.pipeMat);
      // 탱크 밑동을 잇는 배관
      b.add(tubeBetween([tx, 1.1, tz - rad], [tx, 1.1, tz - rad - 2.2], 0.13, 6), mats.pipeMat);
      if (h + 1 > top) top = h + 1;
    }
  }
  return top;
}

// ── 야드 — 눈높이 ──────────────────────────────────────────────────────────
//
// 공업 구역은 눈높이가 통째로 비어 있었다. 실측상 길에서 보이는 것이
// **민짜 콘크리트 벽 두 장**뿐이었다 (docs status 3.22).
//
// 공장 부지에서 사람 키 높이에 실제로 있는 것은 건물이 아니라 **야드의
// 물건**이다 — 드럼통, 팔레트, 밸브 스테이션, 철망, 작업등.
function yard(b, rect, rng, mats, pools) {
  const c = rectCenter(rect);
  const s = rectSize(rect);
  if (s.w < 6 || s.d < 6) return;
  const len = Math.max(s.w, s.d);
  const area = s.w * s.d;
  const many = (per, div) => Math.max(1, Math.round(Math.max(len / per, area / div)));

  b.add(upPlane(s.w, s.d, [c.x, 0.05, c.z], [4, 4]), mats.lotMat);

  // 작업등 — 주황 나트륨. 이 구역에 네온은 없다
  const lamps = many(26, 1100);
  for (let i = 0; i < lamps; i++) {
    const lx = c.x + rng.range(-s.w * 0.4, s.w * 0.4);
    const lz = c.z + rng.range(-s.d * 0.4, s.d * 0.4);
    b.cylinder(0.11, 0.14, 8.0, [lx, 4.0, lz], mats.metalMat, 6);
    b.box(1.1, 0.22, 0.6, [lx, 8.1, lz], mats.metalMat);
    b.add(autoBox(0.9, 0.14, 0.5, [lx, 7.96, lz], 0.01), neonSoft(0xff9a3c));
    // 웅덩이를 크게 잡으면 야드 포장이 통째로 밝아져서, 어두워야 할 구역이
    // 화면에서 제일 밝은 바닥이 된다. 등 아래만 밝히고 나머지는 어둠에 둔다.
    pools.push({ kind: 'floor', x: lx, y: 0.22, z: lz, rx: 6.5, rz: 6.5, tint: rgb01(0xff9a3c, 0.32) });
  }

  // 드럼통 무더기
  for (let i = 0; i < many(12, 260); i++) {
    const dx = c.x + rng.range(-s.w * 0.42, s.w * 0.42);
    const dz = c.z + rng.range(-s.d * 0.42, s.d * 0.42);
    const n = rng.int(3, 8);
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2;
      const rr = k === 0 ? 0 : 0.62;
      b.cylinder(0.3, 0.3, 0.88,
        [dx + Math.cos(a) * rr, 0.44 + (k % 2 && rng.chance(0.4) ? 0.88 : 0), dz + Math.sin(a) * rr],
        rng.chance(0.4) ? mats.hazardMat : mats.rustMat, 10);
    }
  }
  // 팔레트 더미
  for (let i = 0; i < many(18, 420); i++) {
    const px = c.x + rng.range(-s.w * 0.4, s.w * 0.4);
    const pz = c.z + rng.range(-s.d * 0.4, s.d * 0.4);
    const n = rng.int(2, 5);
    for (let k = 0; k < n; k++) {
      b.box(1.2, 0.16, 1.0, [px, 0.1 + k * 0.2, pz], mats.plywoodMat);
    }
    if (rng.chance(0.5)) b.box(1.3, 1.0, 1.1, [px, 0.1 + n * 0.2 + 0.5, pz], mats.crateAltMat);
  }
  // 밸브 스테이션 — 배관이 땅으로 내려와 꺾이는 자리. 공장의 소품이다
  for (let i = 0; i < many(24, 900); i++) {
    const vx = c.x + rng.range(-s.w * 0.36, s.w * 0.36);
    const vz = c.z + rng.range(-s.d * 0.36, s.d * 0.36);
    b.box(1.6, 0.3, 1.2, [vx, 0.15, vz], mats.wetConcreteMat);
    for (const su of [-0.5, 0.5]) {
      b.cylinder(0.12, 0.12, 1.6, [vx + su, 0.8, vz], mats.pipeMat, 8);
      b.cylinder(0.34, 0.34, 0.09, [vx + su, 1.6, vz], mats.hazardMat, 10);
    }
    b.add(tubeBetween([vx - 0.5, 1.45, vz], [vx + 0.5, 1.45, vz], 0.12, 6), mats.pipeMat);
  }
  // 철망 울타리 — 야드의 경계. 공업 구역의 상징이다
  for (const side of SIDES) {
    const f = faceFrame(rect, side);
    if (f.w < 8) continue;
    const posts = Math.max(2, Math.round(f.w / 3.2));
    for (let i = 0; i <= posts; i++) {
      const [px, pz] = f.at(-f.w / 2 + (f.w * i) / posts, -0.3);
      b.box(0.09, 2.4, 0.09, [px, 1.2, pz], mats.pipeMat);
    }
    const [mx, mz] = f.at(0, -0.3);
    const [mw, md] = f.size(f.w, 0.05);
    b.box(mw, 0.06, md, [mx, 2.35, mz], mats.pipeMat);
    b.box(mw, 0.06, md, [mx, 0.35, mz], mats.pipeMat);
  }
}

// ── 한 동 ──────────────────────────────────────────────────────────────────

// 헛간 한 동 — 지붕 셋 · 마감 셋 · 높이 편차.
//
// 어느 지붕·어느 마감인지는 **위치 해시**가 정한다. 난수로 뽑으면 같은 자리의
// 동이 매번 달라져서, 편차가 '이 동은 이렇다' 가 아니라 노이즈가 된다.
function shed(b, rect, rng, mats, faces, detail, pools) {
  const c = rectCenter(rect);
  const kx = Math.round(c.x);
  const kz = Math.round(c.z);
  const pick = (a, list) => list[Math.floor(hash2(kx * a, kz * (a + 3)) * list.length) % list.length];
  const roof = pick(7, ROOF_KEYS);
  const skin = pick(13, [mats.panelMat, mats.shutterMat, mats.alleyWallMat]);
  // 높이도 갈린다 — 0.8~1.25 는 눈으로 안 갈렸다. 창고는 낮고 주조동은 높다
  const HK = { saw: [0.85, 1.15], barrel: [0.62, 0.85], monitor: [1.15, 1.6] }[roof];
  const h = SHED_H * (HK[0] + hash2(kx * 5, kz * 11) * (HK[1] - HK[0]));
  b.add(rectBox(rect, 0, h, PANEL_TILE), skin);

  // 높은 채광창 띠 — 공장의 유일한 창. 눈높이가 아니라 지붕 밑이다.
  // 원통 볼트는 용마루가 채광이라 벽에는 안 낸다.
  for (const side of SIDES) {
    const f = faceFrame(rect, side);
    if (f.w < 5) continue;
    // **난수를 먼저 뽑고 그리기만 건너뛴다** (난수 규율 2). 원통 볼트일 때
    // `rng.chance` 를 통째로 건너뛰면 지붕 종류에 따라 소비량이 갈려서,
    // 지붕 확률을 조금만 바꿔도 도시가 통째로 다시 뽑힌다.
    const lit = rng.chance(0.4);
    if (roof !== 'barrel') {
      const [gw, gd] = f.size(f.w * 0.9, 0.14);
      const [gx, gz] = f.at(0, 0.08);
      b.add(
        autoBox(gw, 1.2, gd, [gx, h - 1.6, gz], 0.02),
        lit ? mats.factoryLitMat : mats.factoryDarkMat
      );
    }

    // 하역구 — 길에 면한 쪽에만. 안쪽 면에 트럭 문을 달면 갈 데가 없다
    if (!faces[side]) continue;
    const docks = Math.max(1, Math.round((f.w / 22) * detail));
    for (let i = 0; i < docks; i++) {
      const u = -f.w / 2 + f.w * ((i + 0.5) / docks) + rng.range(-2, 2);
      if (Math.abs(u) > f.w / 2 - 3.5) continue;
      loadingDock(b, f, u, rng, mats, pools);
    }
  }

  ROOFS[roof](b, shrink(rect, 0.6), h, rng, mats);
  TALLY.헛간++;
  TALLY.지붕[roof] = (TALLY.지붕[roof] ?? 0) + 1;
  return h;
}

// ── 지붕 셋 ────────────────────────────────────────────────────────────────
//
// 사용자 지적: *"건물이 다 똑같이 생겼음"*
//
// 맞다. 헛간이 전부 같은 상자에 같은 톱니였다. 공장의 형태를 결정하는 것은
// 벽이 아니라 **지붕**이다 — 그 안에서 무엇을 하느냐가 지붕으로 나온다.
//
//   톱니   조립·기계 가공. 북향 채광창으로 그림자 없는 빛
//   원통   창고·격납. 기둥 없이 넓은 공간을 덮는 가장 싼 방법
//   몬니터 주조·열처리. 지붕 가운데를 솟궈 **열과 연기를 빼는** 것이 목적이라
//          채광창이 아니라 루버가 달린다

// 원통 볼트 — 반원통을 눕힌다. 도시에서 곡면 지붕은 여기뿐이다.
function barrelVault(b, r, y, rng, mats) {
  const c = rectCenter(r);
  const s = rectSize(r);
  const alongX = s.w >= s.d;
  const span = alongX ? s.d : s.w;   // 아치가 걸치는 폭
  const len = alongX ? s.w : s.d;
  const rad = span / 2;

  const g = new THREE.CylinderGeometry(rad, rad, len, 16, 1, false, 0, Math.PI);
  if (alongX) g.rotateZ(-Math.PI / 2); else g.rotateX(Math.PI / 2);
  g.translate(c.x, y, c.z);
  b.add(g, mats.rustMat);

  // 마구리 벽 — 아치 끝을 막는다. 안 막으면 터널이다
  for (const sg of [-1, 1]) {
    const ex = alongX ? c.x + sg * len / 2 : c.x;
    const ez = alongX ? c.z : c.z + sg * len / 2;
    const g2 = new THREE.CylinderGeometry(rad * 0.99, rad * 0.99, 0.3, 16, 1, false, 0, Math.PI);
    if (alongX) g2.rotateZ(-Math.PI / 2); else g2.rotateX(Math.PI / 2);
    g2.translate(ex, y, ez);
    b.add(g2, mats.panelMat);
  }
  // 용마루 채광 — 아치 꼭대기를 따라. 이것 하나가 창고를 살아 있게 한다
  const gw = alongX ? len * 0.86 : 0.9;
  const gd = alongX ? 0.9 : len * 0.86;
  b.add(autoBox(gw, 0.3, gd, [c.x, y + rad - 0.1, c.z], 0.02),
    rng.chance(0.4) ? mats.factoryLitMat : mats.factoryDarkMat);
}

// 몬니터 지붕 — 평지붕 가운데를 솟궈 열을 뺀다. 루버가 달린다.
function monitorRoof(b, r, y, rng, mats) {
  const c = rectCenter(r);
  const s = rectSize(r);
  const alongX = s.w >= s.d;
  const len = alongX ? s.w : s.d;
  const wide = alongX ? s.d : s.w;

  // 평지붕 파라펫
  b.add(rectBox(shrink(r, -0.3), y, 0.9, PANEL_TILE), mats.rustMat);
  // 솟은 몬니터
  const mw = alongX ? len * 0.82 : wide * 0.3;
  const md = alongX ? wide * 0.3 : len * 0.82;
  b.box(mw, 2.8, md, [c.x, y + 1.4, c.z], mats.panelMat);
  // 루버 — 옆면에 가로살. 채광창이 아니라 **배기구**다
  for (const side of SIDES) {
    const f = faceFrame({ x0: c.x - mw / 2, x1: c.x + mw / 2, z0: c.z - md / 2, z1: c.z + md / 2 }, side);
    if (f.w < 2) continue;
    for (let i = 0; i < 5; i++) {
      const [lx, lz] = f.at(0, 0.12);
      const [lw, ld] = f.size(f.w * 0.94, 0.14);
      b.box(lw, 0.22, ld, [lx, y + 0.5 + i * 0.5, lz], mats.metalMat);
    }
  }
  // 배기 팬 몇 개
  for (let i = 0; i < Math.max(2, Math.round(len / 16)); i++) {
    const t = (i + 0.5) / Math.max(2, Math.round(len / 16)) - 0.5;
    const fx = c.x + (alongX ? t * len * 0.8 : wide * 0.3);
    const fz = c.z + (alongX ? wide * 0.3 : t * len * 0.8);
    b.cylinder(0.8, 0.8, 0.5, [fx, y + 1.15, fz], mats.ductMat, 10);
    b.cylinder(0.95, 0.95, 0.12, [fx, y + 1.45, fz], mats.metalMat, 10);
  }
}

const ROOFS = { saw: sawtooth, barrel: barrelVault, monitor: monitorRoof };
// **목록을 다시 적지 않는다.** 전에는 여기와 표본(EMPTY)에 키를 또 적어서,
// 지붕을 하나 더하면 `ROOFS` 에만 들어가고 뽑히지도 세지지도 않을 수 있었다.
const ROOF_KEYS = Object.keys(ROOFS);

// ── 한 대지 ────────────────────────────────────────────────────────────────
//
// ── 전에는 대지 하나 = 헛간 하나였다 (실측) ────────────────────────────────
// 공업 14블록에 건물 14채, 전부 65x65 정사각 헛간, 3칸 대지(86x63)도 한 덩어리.
// **대지가 커지면 상자가 커졌다** — 주거·슬럼에서 두 번 고친 그 오류다.
// 그리고 눈높이에는 민짜 콘크리트 벽 두 장뿐이었다.
//
// 공장 부지는 건물 하나가 아니라 **동과 설비와 야드가 섞인 구역**이다.
// 대지를 셋으로 가른다.
//
//   동 구역 (45%)   톱니 헛간 1~2동. 조립·창고
//   공정 야드 (55%) 공정탑·탱크 야드·사일로·굴뚝. **건물이 아니라 설비**다
//   그 사이         파이프 랙이 둘을 잇고, 야드에 사람 키 높이의 물건이 있다
//
// 파이프 랙이 **실제로 무언가를 잇는** 것이 이 항목의 요점이다 (#37).
export function factoryBlock(b, r, rng, mats, faces, detail, pools) {
  const s = rectSize(r);
  const alongX = s.w >= s.d;
  const span = alongX ? s.w : s.d;
  const lo = alongX ? r.x0 : r.z0;
  const cut = lo + span * 0.45;
  const at = (a, bb) => (alongX
    ? { x0: a, x1: bb, z0: r.z0, z1: r.z1 }
    : { x0: r.x0, x1: r.x1, z0: a, z1: bb });

  const shedZone = at(lo, cut);
  const procZone = at(cut, lo + span);

  // ── 동 구역 ──────────────────────────────────────────────────────────────
  let top = 0;
  {
    const z = shrink(shedZone, 1.6);
    const zs = rectSize(z);
    const n = Math.max(1, Math.min(2, Math.floor(Math.max(zs.w, zs.d) / 52)));
    const wide = zs.w >= zs.d;
    const step = (wide ? zs.w : zs.d) / n;
    for (let i = 0; i < n; i++) {
      const a = (wide ? z.x0 : z.z0) + step * i;
      const cell = shrink(wide
        ? { x0: a, x1: a + step, z0: z.z0, z1: z.z1 }
        : { x0: z.x0, x1: z.x1, z0: a, z1: a + step }, 2.0);
      const cs = rectSize(cell);
      if (cs.w < 10 || cs.d < 10) continue;
      const t = shed(b, cell, rng, mats, faces, detail, pools);
      if (t > top) top = t;
    }
  }

  // ── 설비 구역 — **대지마다 무엇을 하는 공장인지가 다르다** ───────────────
  //
  // 사용자 지적: *"원통이 너무 많음"*
  //
  // 맞다. 대지마다 공정탑 1~3 + 사일로 0~3 + 탱크 야드까지 다 놓았더니
  // 공업 구역이 통째로 원통 밭이 됐다. 종류를 늘린 것이 아니라 **모든 것을
  // 모든 대지에 놓은 것**이 문제였다.
  //
  // 공장은 부지마다 하는 일이 다르고, 그 일이 설비를 정한다. 넷으로 가른다 —
  // 대지 하나는 **그중 하나만** 한다.
  //
  //   조립  헛간 2~3동. 설비가 거의 없다. 원통 0~1
  //   공정  공정탑 1~2 + 파이프. 여기만 탑이 선다
  //   야적  탱크 야드 + 낮은 창고. 여기만 탱크가 선다
  //   동력  큰 상자 + 굴뚝 둘셋 + 냉각탑. 여기만 굴뚝이 여럿이다
  //
  // 자리마다 **필지 경계까지 남은 거리**를 함께 넘긴다. 이걸 안 넘겼더니
  // 굴뚝 지지 케이블(최대 17.6m)이 옆 필지 건물을 관통했다 (배치 검사).
  const room = (px, pz) => Math.min(px - r.x0, r.x1 - px, pz - r.z0, r.z1 - pz);
  const rc = rectCenter(r);
  const kind = FACTORY_KINDS[
    Math.floor(hash2(Math.round(rc.x) * 19, Math.round(rc.z) * 23) * FACTORY_KINDS.length)
    % FACTORY_KINDS.length];
  TALLY[kind]++;
  {
    const z = shrink(procZone, 2.2);
    const zc = rectCenter(z);
    const zs = rectSize(z);

    // 야드 바닥과 눈높이 물건이 **먼저**다. 설비는 그 위에 선다
    yard(b, z, rng, mats, pools);

    if (kind === '야적') {
      const tw = alongX ? zs.w * 0.62 : zs.w;
      const td = alongX ? zs.d : zs.d * 0.62;
      const ty = tankYard(b, {
        x0: zc.x - tw / 2, x1: zc.x + tw / 2,
        z0: zc.z - td / 2, z1: zc.z + td / 2,
      }, rng, mats);
      if (ty > top) top = ty;
      TALLY.탱크야드++;
    } else if (kind === '공정') {
      // 공정탑 — 이 구역의 세로 요소. **여기만** 선다
      const towers = zs.w * zs.d > 2200 ? 2 : 1;
      for (let i = 0; i < towers; i++) {
        const t2 = towers === 1 ? 0 : (i - 0.5);
        const tx = zc.x + (alongX ? t2 * zs.w * 0.44 : 0) + rng.range(-3, 3);
        const tz = zc.z + (alongX ? 0 : t2 * zs.d * 0.44) + rng.range(-3, 3);
        const t = processTower(b, tx, tz, rng, mats, room(tx, tz));
        if (t > top) top = t;
        TALLY.공정탑++;
      }
    } else if (kind === '동력') {
      // 굴뚝 둘셋이 나란히. 이 대지의 얼굴이다
      const n = rng.int(2, 3);
      for (let i = 0; i < n; i++) {
        const t2 = (i + 0.5) / n - 0.5;
        const kx2 = zc.x + (alongX ? t2 * zs.w * 0.6 : rng.range(-4, 4));
        const kz2 = zc.z + (alongX ? rng.range(-4, 4) : t2 * zs.d * 0.6);
        const st = stack(b, kx2, kz2, rng, mats, room(kx2, kz2));
        if (st > top) top = st;
        TALLY.굴뚝++;
      }
      // 냉각탑 — 굵고 낮다. 굴뚝과 나란히 있어야 발전소로 읽힌다
      for (let i = 0; i < 2; i++) {
        const cx2 = zc.x + (alongX ? (i - 0.5) * zs.w * 0.34 : zs.w * 0.26);
        const cz2 = zc.z + (alongX ? zs.d * 0.26 : (i - 0.5) * zs.d * 0.34);
        const cr = Math.min(5.0, Math.max(2.0, room(cx2, cz2) - 1));
        b.add(lathe([
          [cr, 0], [cr * 0.72, 7], [cr * 0.66, 11], [cr * 0.78, 15],
        ], 16, [cx2, 0, cz2]), mats.wetConcreteMat);
        if (15 > top) top = 15;
      }
    } else {
      // 조립 — 설비가 거의 없다. 사일로 하나만 서기도 한다
      if (rng.chance(0.45)) {
        const sx = zc.x + rng.range(-zs.w * 0.3, zs.w * 0.3);
        const sz = zc.z + rng.range(-zs.d * 0.3, zs.d * 0.3);
        silo(b, sx, sz, rng, mats, room(sx, sz));
        TALLY.사일로++;
      }
      // 대신 야적 컨테이너 — 조립 부지는 부품이 쌓인다
      for (let i = 0; i < rng.int(3, 7); i++) {
        const cx2 = zc.x + rng.range(-zs.w * 0.4, zs.w * 0.4);
        const cz2 = zc.z + rng.range(-zs.d * 0.4, zs.d * 0.4);
        const stack2 = rng.int(1, 3);
        for (let k = 0; k < stack2; k++) {
          b.box(alongX ? 6.0 : 2.4, 2.6, alongX ? 2.4 : 6.0,
            [cx2, 1.3 + k * 2.62, cz2], k % 2 ? mats.crateAltMat : mats.crateMat);
        }
      }
    }
  }

  // ── 파이프 랙 — **두 구역을 잇는다** ─────────────────────────────────────
  //
  // 동 구역에서 공정 야드로 건너간다. 이 하나가 "여러 동이 아니라 하나의
  // 설비" 라고 말한다. 전에는 자기 건물 위만 지나가서 아무것도 안 이었다.
  const RW = 3.0;
  const cross = alongX ? r.z0 + s.d * 0.5 : r.x0 + s.w * 0.5;
  pipeRack(b, alongX
    ? { x0: r.x0 + 3, x1: r.x1 - 3, z0: cross - RW / 2, z1: cross + RW / 2 }
    : { x0: cross - RW / 2, x1: cross + RW / 2, z0: r.z0 + 3, z1: r.z1 - 3 },
    rng, mats, top > 22 ? 9.5 : 7.0);

  return { top };
}
