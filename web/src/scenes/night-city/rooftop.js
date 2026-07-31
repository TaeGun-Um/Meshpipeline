// 옥상 — 크라운(관冠)과 설비.
//
// ── 왜 따로 떼었나 ─────────────────────────────────────────────────────────
// 옥상은 두 가지를 동시에 책임진다.
//   1) 스카이라인 실루엣 — 멀리서 도시를 볼 때 건물을 구분하는 건 옥상 형태뿐이다.
//      전부 평지붕 + 파라펫이면 100동이 다 같은 건물로 보인다.
//   2) 항공 뷰의 밀도 — 위에서 내려다보면 화면의 절반이 옥상이다. 상자 두세 개만
//      올려두면 그 절반이 텅 빈다.
// 둘 다 towers.js 의 관심사가 아니고 코드량도 만만치 않아서 분리했다.
import { lathe } from '../../core/profile.js';
import { SIDES, shrink, rectBox, facePlane } from '../../core/boxfaces.js';
import { NEON } from '../../shared/neon.js';
import { neon } from '../../shared/masters.js';


// ── 옥상 설비 ──────────────────────────────────────────────────────────────

// 물탱크. 다리 위에 올린 원통 + 원뿔 지붕. 야간 도시 옥상의 대표 실루엣이다.
function waterTank(b, x, z, top, rng, mats) {
  const r = rng.range(1.1, 2.2);
  const h = rng.range(1.8, 3.4);
  const legH = rng.range(0.8, 2.0);

  // [반지름, 높이] 단면. 같은 높이를 두 번 넣어 모서리를 각지게 만든다.
  b.add(
    lathe(
      [
        [0, 0],
        [r, 0],
        [r, h],
        [r * 0.92, h],
        [r * 0.5, h + r * 0.45],
        [0, h + r * 0.5],
      ],
      14,
      [x, top + legH, z]
    ),
    mats.metalMat
  );
  // 다리 넷
  for (const dx of [-1, 1]) {
    for (const dz of [-1, 1]) {
      b.box(0.12, legH, 0.12, [x + dx * r * 0.66, top + legH / 2, z + dz * r * 0.66], mats.metalMat);
    }
  }
}

// 실외기 뱅크 — 같은 크기 유닛이 줄지어 선다. 규칙적인 반복이 산업 설비로 읽힌다.
// 근경에서 보이므로 모따기를 넣는다 (+32삼각형/개).
function acBank(b, x, z, top, rng, mats) {
  const n = rng.int(2, 5);
  const w = 1.0;
  const d = 0.75;
  const h = 0.85;
  const along = rng.chance(0.5);
  for (let i = 0; i < n; i++) {
    const off = (i - (n - 1) / 2) * (w + 0.22);
    // 모따기를 쓰지 않는다. 옥상 설비는 20~370m 높이에 있어 가장 가까워도
    // 수십 미터 밖이고, 모따기 면(폭 3cm)이 화면에서 1픽셀도 안 된다.
    // 여기에 모따기를 쓰면 하나에 44삼각형, 안 쓰면 12삼각형이다.
    b.box(
      along ? w : d,
      h,
      along ? d : w,
      [x + (along ? off : 0), top + h / 2, z + (along ? 0 : off)],
      mats.ductMat
    );
  }
  // 받침 프레임
  b.box(
    along ? n * (w + 0.22) : d + 0.3,
    0.1,
    along ? d + 0.3 : n * (w + 0.22),
    [x, top + 0.05, z],
    mats.metalMat
  );
}

// 배기 스택 — 높이가 제각각인 원통 묶음
function ventStack(b, x, z, top, rng, mats) {
  const n = rng.int(2, 4);
  for (let i = 0; i < n; i++) {
    const r = rng.range(0.18, 0.42);
    const h = rng.range(1.2, 3.6);
    const a = (i / n) * Math.PI * 2;
    const px = x + Math.cos(a) * 0.6;
    const pz = z + Math.sin(a) * 0.6;
    b.cylinder(r, r * 1.1, h, [px, top + h / 2, pz], mats.ductMat, 8);
    // 갓
    b.cylinder(r * 1.5, r * 1.2, 0.14, [px, top + h + 0.07, pz], mats.metalMat, 8);
  }
}

// 위성 접시 — 회전체 포물면. 기울여 세운다.
function dish(b, x, z, top, rng, mats) {
  const r = rng.range(0.7, 1.5);
  const g = lathe(
    [
      [0, 0],
      [r * 0.3, r * 0.06],
      [r * 0.7, r * 0.22],
      [r, r * 0.42],
      [r, r * 0.5],
      [r * 0.66, r * 0.28],
      [0, r * 0.08],
    ],
    16
  );
  g.rotateX(rng.range(-0.9, -0.45));
  g.rotateY(rng.range(0, Math.PI * 2));
  g.translate(x, top + r * 0.8, z);
  b.add(g, mats.metalMat);
  b.cylinder(0.09, 0.12, r * 0.8, [x, top + r * 0.4, z], mats.metalMat, 6);
}

// 옥상 난간 — 파라펫 안쪽으로 한 겹. 위에서 볼 때 옥상의 윤곽을 그린다.
function railing(b, r, top, mats) {
  const inner = shrink(r, 0.55);
  const H = 1.0;
  for (const side of SIDES) {
    // 가로대 둘
    for (const y of [top + H * 0.55, top + H]) {
      b.add(facePlane(inner, y - 0.03, 0.06, side, null, 0), mats.metalMat);
    }
  }
  // 동자기둥
  const step = 2.4;
  for (let x = inner.x0; x <= inner.x1 + 0.01; x += step) {
    for (const z of [inner.z0, inner.z1]) {
      b.box(0.06, H, 0.06, [x, top + H / 2, z], mats.metalMat);
    }
  }
  for (let z = inner.z0; z <= inner.z1 + 0.01; z += step) {
    for (const x of [inner.x0, inner.x1]) {
      b.box(0.06, H, 0.06, [x, top + H / 2, z], mats.metalMat);
    }
  }
}

// 설비를 옥상에 흩는다. 밀도가 항공 뷰의 인상을 만든다.
function clutter(b, r, top, rng, mats) {
  const inner = shrink(r, 2.2);
  const w = inner.x1 - inner.x0;
  const d = inner.z1 - inner.z0;
  if (w < 3 || d < 3) return;

  // 면적에 비례해서 개수를 정한다 — 큰 옥상이 텅 비면 바로 티가 난다
  const n = Math.min(14, Math.max(2, Math.round((w * d) / 42)));
  for (let i = 0; i < n; i++) {
    const x = rng.range(inner.x0, inner.x1);
    const z = rng.range(inner.z0, inner.z1);
    const k = rng.next();
    if (k < 0.3) waterTank(b, x, z, top, rng, mats);
    else if (k < 0.62) acBank(b, x, z, top, rng, mats);
    else if (k < 0.85) ventStack(b, x, z, top, rng, mats);
    else dish(b, x, z, top, rng, mats);
  }
}

// ── 크라운 ─────────────────────────────────────────────────────────────────

// 평지붕 + 파라펫. 가장 흔한 형태.
function parapet(b, r, top, mats) {
  const p = shrink(r, 0.3);
  for (const side of SIDES) {
    b.add(facePlane(p, top, 1.3, side, null, 0), mats.panelMat);
  }
}

// 계단식 — 줄어드는 슬래브 몇 겹. 아르데코 마천루의 관.
function stepped(b, r, top, rng, mats) {
  let cur = r;
  let y = top;
  const n = rng.int(2, 4);
  for (let i = 0; i < n; i++) {
    const h = rng.range(1.6, 4.0);
    b.add(rectBox(cur, y, h, PANEL_TILE), mats.panelMat);
    // 단 사이 발광 띠 — 밤에 계단 형상을 드러낸다
    for (const side of SIDES) {
      b.add(facePlane(cur, y + h - 0.24, 0.12, side, null, 0.04), neon(NEON.cyan));
    }
    y += h;
    cur = shrink(cur, rng.range(1.0, 2.4));
    if (cur.x1 - cur.x0 < 4 || cur.z1 - cur.z0 < 4) break;
  }
  return y;
}

// 원통 드럼 — 옥상에 얹은 원기둥. 상단에 발광 링.
function drum(b, r, top, rng, mats) {
  const rad = Math.min(r.x1 - r.x0, r.z1 - r.z0) * rng.range(0.3, 0.44);
  const h = rng.range(4, 12);
  const cx = (r.x0 + r.x1) / 2;
  const cz = (r.z0 + r.z1) / 2;
  b.cylinder(rad, rad * 1.04, h, [cx, top + h / 2, cz], mats.panelMat, 20);
  // 발광 링 둘
  for (const t of [0.55, 0.86]) {
    b.cylinder(rad * 1.03, rad * 1.03, 0.3, [cx, top + h * t, cz], neon(NEON.magenta), 20);
  }
  b.cylinder(rad * 1.12, rad, 0.5, [cx, top + h + 0.25, cz], mats.metalMat, 20);
  return top + h + 0.5;
}

// 돔 — 회전체. 드물게 써야 랜드마크가 된다.
function dome(b, r, top, mats) {
  const rad = Math.min(r.x1 - r.x0, r.z1 - r.z0) * 0.46;
  const cx = (r.x0 + r.x1) / 2;
  const cz = (r.z0 + r.z1) / 2;
  const pts = [];
  const N = 8;
  for (let i = 0; i <= N; i++) {
    const a = (i / N) * (Math.PI / 2);
    pts.push([Math.cos(a) * rad, Math.sin(a) * rad * 0.72]);
  }
  b.add(lathe(pts, 22, [cx, top, cz]), mats.panelMat);
  return top + rad * 0.72;
}

// 헬리패드 — 원형 패드 + 둘레 유도등. 위에서 볼 때 눈에 띈다.
function helipad(b, r, top, mats) {
  const rad = Math.min(r.x1 - r.x0, r.z1 - r.z0) * 0.34;
  const cx = (r.x0 + r.x1) / 2;
  const cz = (r.z0 + r.z1) / 2;
  b.cylinder(rad, rad, 0.3, [cx, top + 0.15, cz], mats.wetConcreteMat, 24);
  b.cylinder(rad * 0.82, rad * 0.82, 0.32, [cx, top + 0.17, cz], mats.paintMat, 24);
  b.cylinder(rad * 0.72, rad * 0.72, 0.34, [cx, top + 0.18, cz], mats.wetConcreteMat, 24);
  // H 표시
  for (const dx of [-1, 1]) {
    b.box(rad * 0.12, 0.06, rad * 0.72, [cx + dx * rad * 0.24, top + 0.34, cz], mats.paintMat);
  }
  b.box(rad * 0.6, 0.06, rad * 0.14, [cx, top + 0.34, cz], mats.paintMat);
  // 둘레 유도등
  const n = 12;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    b.sphere(0.16, [cx + Math.cos(a) * rad, top + 0.38, cz + Math.sin(a) * rad], neon(NEON.amber), 6, 4);
  }
  return top + 0.4;
}

// 첨탑 — 가늘어지는 마스트 + 링. 초고층 랜드마크용.
function spire(b, r, top, height, rng, mats) {
  const cx = (r.x0 + r.x1) / 2;
  const cz = (r.z0 + r.z1) / 2;
  const h = rng.range(20, Math.max(26, height * 0.3));
  const base = Math.min(r.x1 - r.x0, r.z1 - r.z0) * 0.16;
  b.add(
    lathe(
      [
        [base, 0],
        [base * 0.72, h * 0.35],
        [base * 0.34, h * 0.7],
        [base * 0.12, h * 0.92],
        [0, h],
      ],
      12,
      [cx, top, cz]
    ),
    mats.metalMat
  );
  // 발광 링 — 첨탑을 밤에 보이게 한다
  for (const t of [0.2, 0.45, 0.72]) {
    const rr = base * (1 - t * 0.8) * 1.25;
    b.cylinder(rr, rr, 0.22, [cx, top + h * t, cz], neon(NEON.cyan), 12);
  }
  return top + h;
}

// ── 진입점 ─────────────────────────────────────────────────────────────────

// 크라운 종류를 고르고, 설비를 얹고, 항공장애등을 단다.
export function createCrown(b, r, top, height, rng, mats, beaconIdx) {
  const w = Math.min(r.x1 - r.x0, r.z1 - r.z0);
  const k = rng.next();
  let apex = top;

  // 형태는 높이·크기가 허락하는 것 중에서 고른다 — 3층 상가에 첨탑이 서면 우습다
  if (height > 150 && w > 14 && k < 0.22) {
    parapet(b, r, top, mats);
    apex = spire(b, r, top + 1.3, height, rng, mats);
  } else if (height > 90 && w > 16 && k < 0.36) {
    apex = drum(b, r, top, rng, mats);
  } else if (height > 70 && w > 20 && k < 0.44) {
    apex = dome(b, r, top, mats);
  } else if (height > 45 && w > 22 && k < 0.56) {
    parapet(b, r, top, mats);
    apex = helipad(b, r, top, mats);
    clutter(b, shrink(r, w * 0.2), top, rng, mats);
  } else if (k < 0.74) {
    apex = stepped(b, r, top, rng, mats);
  } else {
    parapet(b, r, top, mats);
    if (w > 12) railing(b, r, top, mats);
    clutter(b, r, top, rng, mats);
    apex = top + 1.3;
  }

  // 계단식·드럼·돔에도 설비를 조금 얹는다 (옥상이 비면 항공 뷰가 심심하다)
  if (k >= 0.22 && k < 0.74 && w > 14) clutter(b, r, top, rng, mats);

  // 안테나 마스트 + 항공장애등. 높은 건물에만.
  if (height > 60) {
    const mastH = rng.range(8, height > 160 ? 42 : 18);
    const cx = (r.x0 + r.x1) / 2;
    const cz = (r.z0 + r.z1) / 2;
    b.cylinder(0.16, 0.34, mastH, [cx, apex + mastH / 2, cz], mats.metalMat, 6);
    b.sphere(0.5, [cx, apex + mastH + 0.5, cz], mats.beacons[beaconIdx % mats.beacons.length]);
  }
}
