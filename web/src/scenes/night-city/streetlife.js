// 가로 시설물 — 인도에 놓이는 것들.
//
// ── 왜 필요한가 ────────────────────────────────────────────────────────────
// 건물을 아무리 다양하게 만들어도 거리에 아무것도 없으면 "잘 만든 배경 앞의
// 허허벌판" 이 된다. 카메라가 지상에 내려오는 순간 화면의 아래 절반이 텅 빈다.
//
// 스케일 기준으로도 중요하다. 자판기(높이 1.9m)나 볼라드(0.9m)처럼 크기를
// 아는 물건이 있어야 뒤의 건물이 얼마나 큰지 읽힌다. 그게 없으면 200m 타워도
// 20m 짜리처럼 보인다.
//
// ── 배치 원칙 ──────────────────────────────────────────────────────────────
// 인도를 따라 일정 간격으로 훑되, 교차로는 비운다(횡단보도·시야). 같은 물건이
// 연속으로 나오지 않게 하고, 발광하는 것(자판기·포장마차)은 바닥 웅덩이도 남긴다.
import { MeshBuilder } from '../../core/builder.js';
import { autoBox } from '../../core/profile.js';
import { downPlane } from '../../core/boxfaces.js';
import { NEON, rgb01 } from '../../shared/neon.js';
import { neon, neonSoft } from '../../shared/masters.js';
import { STREET_WIDTH, CITY_HALF, CURB_HEIGHT, gridLines, onIntersection } from './layout.js';

const SPACING = 13; // 시설물 간격 (m)
const EDGE = STREET_WIDTH / 2 + 1.6; // 인도 위, 차도 경계에서 1.6m
const Y = CURB_HEIGHT;

// ── 개별 시설물 ────────────────────────────────────────────────────────────
//
// 전부 **컨텍스트 객체 하나**를 받는다: { b, x, z, rot, rng, mats, pools }.
// rot 은 도로를 향하는 방향(라디안)이다.
//
// 인자를 나열하면 디스패치 표(KINDS)가 모든 함수에 같은 순서를 강요해서,
// rot 이나 pools 를 안 쓰는 시설물이 `void rot;` 같은 군더더기를 달게 된다.
// 실제로 그런 줄이 네 개 있었다. 객체를 넘기면 각자 필요한 것만 꺼내 쓴다.

// 자판기 — 야간 도시 인도의 상징. 발광면이 보도를 물들인다.
function vendingBank({ b, x, z, rot, rng, mats, pools }) {
  const n = rng.int(2, 4);
  const W = 1.05;
  const H = 1.9;
  const D = 0.72;
  const cos = Math.cos(rot);
  const sin = Math.sin(rot);

  for (let i = 0; i < n; i++) {
    const off = (i - (n - 1) / 2) * (W + 0.06);
    // rot 방향의 수직축으로 늘어선다
    const px = x + -sin * off;
    const pz = z + cos * off;
    // 전면 방향으로 d 만큼 나간 지점
    const front = (d, u = 0) => [px + cos * d + -sin * u, pz + sin * d + cos * u];

    // 몸통
    b.add(autoBox(W, H, D, [px, Y + H / 2, pz], 0.03), mats.frameMat);

    // ── 전면 구성 ──
    // 통짜 색판 하나만 붙였더니 "검은 상자에 색종이" 로 보였다. 자판기가
    // 자판기로 읽히려면 상품 진열창 · 상품 줄 · 취출구 · 상단 간판이 필요하다.
    const hue = rng.chance(0.55) ? NEON.cool : rng.chance(0.5) ? NEON.pink : NEON.amber;
    const fd = D / 2 + 0.02;

    // 상단 간판 띠
    const s1 = front(fd);
    b.add(autoBox(W * 0.9, 0.34, 0.05, [s1[0], Y + H - 0.22, s1[1]], 0.01), neonSoft(hue));

    // 진열창 — 안쪽이 밝고 상품이 실루엣으로 선다
    const s2 = front(fd - 0.03);
    b.add(autoBox(W * 0.82, H * 0.5, 0.04, [s2[0], Y + H * 0.6, s2[1]], 0.01), neonSoft(NEON.warm));

    // 상품 줄 — 3단 x 4열. 이 격자가 자판기의 정체성이다.
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 4; c++) {
        const u = (c - 1.5) * (W * 0.19);
        const p = front(fd + 0.01, u);
        b.box(W * 0.15, 0.18, 0.03, [p[0], Y + H * 0.44 + r * 0.24, p[1]], mats.ductMat);
      }
      // 선반 판
      const sp = front(fd + 0.005);
      b.box(W * 0.8, 0.03, 0.03, [sp[0], Y + H * 0.44 + r * 0.24 - 0.11, sp[1]], mats.metalMat);
    }

    // 취출구 — 아래쪽 어두운 홈
    const s3 = front(fd);
    b.box(W * 0.62, 0.26, 0.05, [s3[0], Y + 0.42, s3[1]], mats.frameMat);
    // 동전 투입부
    const s4 = front(fd, W * 0.34);
    b.box(0.12, 0.4, 0.05, [s4[0], Y + H * 0.5, s4[1]], mats.metalMat);
    // 받침 — 바닥에서 살짝 띄운 다리
    b.box(W * 0.94, 0.08, D * 0.9, [px, Y + 0.04, pz], mats.metalMat);
  }

  pools.push({
    kind: 'floor',
    x: x + cos * 1.1,
    y: Y + 0.02,
    z: z + sin * 1.1,
    rx: 2.6,
    rz: 2.6,
    tint: rgb01(NEON.cool, 0.34),
  });
}

// 버스 쉘터 — 지붕 + 벤치 + 광고 패널
function shelter({ b, x, z, rot, rng, mats, pools }) {
  const W = 4.2;
  const D = 1.5;
  const H = 2.5;
  const cos = Math.cos(rot);
  const sin = Math.sin(rot);
  const put = (u, v) => [x + cos * v + -sin * u, 0, z + sin * v + cos * u];

  // 기둥 넷
  for (const u of [-W / 2 + 0.1, W / 2 - 0.1]) {
    for (const v of [-D / 2 + 0.1, D / 2 - 0.1]) {
      const p = put(u, v);
      b.box(0.1, H, 0.1, [p[0], Y + H / 2, p[2]], mats.metalMat);
    }
  }
  // 지붕
  const c = put(0, 0);
  b.add(autoBox(W, 0.16, D, [c[0], Y + H, c[2]], 0.03), mats.metalMat);
  // soft 등급. 3.8x1.2m 면에 full 을 쓰면 블룸이 화면을 통째로 태운다 —
  // 발광 세기는 색이 아니라 **면적**으로 정한다는 규칙이 여기에도 적용된다.
  b.add(downPlane(W - 0.4, D - 0.3, [c[0], Y + H - 0.1, c[2]]), neonSoft(NEON.cool));
  // 뒷벽 (도로 반대쪽)
  const back = put(0, -D / 2);
  b.box(W, H - 0.4, 0.08, [back[0], Y + (H - 0.4) / 2, back[2]], mats.frameMat);
  // 광고 패널
  const ad = put(W / 2 - 0.6, -D / 2 + 0.1);
  b.add(
    autoBox(1.1, 1.7, 0.1, [ad[0], Y + 1.15, ad[2]], 0.02),
    mats.signMats.billboard[rng.int(0, 5)]
  );
  // 벤치
  const bench = put(0, -D / 2 + 0.45);
  b.box(W - 0.8, 0.08, 0.4, [bench[0], Y + 0.45, bench[2]], mats.metalMat);

  pools.push({
    kind: 'floor', x: c[0], y: Y + 0.02, z: c[2], rx: 3.2, rz: 3.2,
    tint: rgb01(NEON.cool, 0.3),
  });
}

// 포장마차 — 천막 + 조리대 + 매달린 전구. 거리에 사람 냄새를 낸다.
function foodStall({ b, x, z, rot, rng, mats, pools }) {
  const W = 2.8;
  const D = 1.8;
  const H = 2.2;
  const cos = Math.cos(rot);
  const sin = Math.sin(rot);
  const put = (u, v) => [x + cos * v + -sin * u, z + sin * v + cos * u];

  const c = put(0, 0);
  // 조리대
  b.add(autoBox(W, 1.0, D * 0.6, [c[0], Y + 0.5, c[1]], 0.03), mats.metalMat);
  // 기둥 + 천막
  for (const u of [-W / 2, W / 2]) {
    for (const v of [-D / 2, D / 2]) {
      const p = put(u, v);
      b.box(0.07, H, 0.07, [p[0], Y + H / 2, p[1]], mats.metalMat);
    }
  }
  const awn = put(0, 0.25);
  b.add(autoBox(W + 0.5, 0.12, D + 0.4, [awn[0], Y + H, awn[1]], 0.03), mats.rustMat);
  // 매달린 전구 — 이 하나가 포장마차를 포장마차로 만든다
  for (let i = -1; i <= 1; i++) {
    const p = put(i * 0.9, 0.1);
    b.sphere(0.11, [p[0], Y + H - 0.35, p[1]], neon(NEON.warm), 8, 6);
  }
  // 김이 나는 냄비
  b.cylinder(0.28, 0.3, 0.3, [c[0], Y + 1.15, c[1]], mats.metalMat, 10);

  pools.push({
    kind: 'floor', x: c[0], y: Y + 0.02, z: c[1], rx: 3.4, rz: 3.4,
    tint: rgb01(NEON.warm, 0.44),
  });
}

// 배전함 — 낙서가 있는 회색 상자. 인도에 늘 있는 것.
function utilityBox({ b, x, z, rot, rng, mats }) {
  const W = rng.range(0.8, 1.4);
  const H = rng.range(1.1, 1.5);
  b.add(autoBox(W, H, 0.55, [x, Y + H / 2, z], 0.03), mats.ductMat);
  b.box(W * 0.9, 0.06, 0.58, [x, Y + H * 0.62, z], mats.metalMat);
}

// 화분 + 가느다란 가로수
function planter({ b, x, z, rot, rng, mats }) {
  const R = 0.62;
  b.cylinder(R, R * 1.08, 0.55, [x, Y + 0.275, z], mats.wetConcreteMat, 12);
  const h = rng.range(3.2, 5.0);
  b.cylinder(0.09, 0.14, h, [x, Y + 0.55 + h / 2, z], mats.rustMat, 6);
  // 수관 — 잎을 하나하나 만들 거리가 아니라 덩어리로
  for (let i = 0; i < 3; i++) {
    b.sphere(
      rng.range(0.5, 0.9),
      [x + rng.range(-0.4, 0.4), Y + 0.55 + h + rng.range(-0.3, 0.5), z + rng.range(-0.4, 0.4)],
      mats.foliageMat,
      8,
      6
    );
  }
}

// 쓰레기통 · 볼라드 — 작지만 인도의 리듬을 만든다
function bins({ b, x, z, rot, rng, mats }) {
  const n = rng.int(1, 3);
  const cos = Math.cos(rot);
  const sin = Math.sin(rot);
  for (let i = 0; i < n; i++) {
    const off = (i - (n - 1) / 2) * 0.8;
    b.cylinder(0.3, 0.26, 0.95, [x + -sin * off, Y + 0.475, z + cos * off], mats.ductMat, 10);
  }
}

function bollards({ b, x, z, rot, rng, mats }) {
  const cos = Math.cos(rot);
  const sin = Math.sin(rot);
  for (let i = -2; i <= 2; i++) {
    const off = i * 1.6;
    const px = x + -sin * off;
    const pz = z + cos * off;
    b.cylinder(0.09, 0.11, 0.85, [px, Y + 0.425, pz], mats.metalMat, 8);
    b.sphere(0.1, [px, Y + 0.86, pz], neon(NEON.amber), 6, 4);
  }
}

// ── 배치 ───────────────────────────────────────────────────────────────────

const KINDS = [
  { w: 2.4, fn: vendingBank, lit: true },
  { w: 1.0, fn: shelter, lit: true },
  { w: 1.0, fn: foodStall, lit: true },
  { w: 2.6, fn: utilityBox, lit: false },
  { w: 2.2, fn: planter, lit: false },
  { w: 2.0, fn: bins, lit: false },
  { w: 1.4, fn: bollards, lit: false },
];
const TOTAL_W = KINDS.reduce((a, k) => a + k.w, 0);

function pickKind(rng, last) {
  // 같은 것이 연달아 나오면 절차적으로 찍은 티가 난다
  for (let tries = 0; tries < 6; tries++) {
    let acc = rng.next() * TOTAL_W;
    for (const k of KINDS) {
      acc -= k.w;
      if (acc <= 0) {
        if (k !== last) return k;
        break;
      }
    }
  }
  return KINDS[0];
}

export function createStreetLife(scene, rng, mats) {
  const b = new MeshBuilder('StreetLife', { receiveShadow: false });
  const pools = [];
  const lines = gridLines();
  let count = 0;
  let last = null;

  for (const c of lines) {
    for (let t = -CITY_HALF + SPACING; t < CITY_HALF; t += SPACING) {
      // X축 도로 (z = c). 양쪽 인도, 도로 중심을 향한다.
      if (!onIntersection(t, c)) {
        for (const s of [-1, 1]) {
          if (!rng.chance(0.72)) continue;
          const k = pickKind(rng, last);
          last = k;
          // 인도 위 물건은 도로를 향한다: s=+1 이면 -Z 를 본다
          k.fn({ b, x: t, z: c + s * EDGE, rot: s > 0 ? -Math.PI / 2 : Math.PI / 2, rng, mats, pools });
          count++;
        }
      }
      // Z축 도로 (x = c)
      if (!onIntersection(c, t)) {
        for (const s of [-1, 1]) {
          if (!rng.chance(0.72)) continue;
          const k = pickKind(rng, last);
          last = k;
          k.fn({ b, x: c + s * EDGE, z: t, rot: s > 0 ? Math.PI : 0, rng, mats, pools });
          count++;
        }
      }
    }
  }

  return { group: b.build(scene), pools, count };
}
