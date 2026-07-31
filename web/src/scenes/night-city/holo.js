// 홀로그램과 디지털 조경 — 이 도시의 '기술'.
//
// ── 왜 필요한가 ────────────────────────────────────────────────────────────
// 간판을 1,500개 달아도 사이버펑크로 안 읽혔다. 이유는 개수가 아니라 **종류**다.
// 지금 간판은 전부 같은 물건이다 — 사각 발광판에 픽셀 글자, 색만 다르다.
// 그건 네온 도시지 사이버펑크가 아니다.
//
// 사이버펑크를 사이버펑크로 만드는 것은 **미래 기술이 거리에 널려 있다는
// 사실**이다. 그런데 이 도시에는 기술의 흔적이 하나도 없었다. 배관과 실외기는
// 낡음이지 미래가 아니다.
//
// ── 홀로그램이 간판과 다른 점 ──────────────────────────────────────────────
// 결정적으로 **뒤가 비친다.** 불투명하면 그냥 발광 간판이다.
// 그래서 전부 가산합성(Additive)으로 만든다 — 뒤의 건물이 비쳐 보이고,
// 겹치면 밝아지고, 어두운 배경에서는 사라진다. 그게 '투영된 빛' 이다.
//
// 그리고 **받침이 없다.** 간판은 벽에 붙거나 매달리지만 홀로그램은 허공에
// 떠 있다. 지지대가 보이면 홀로그램이 아니다.
//
// ── 무엇을 만드는가 ────────────────────────────────────────────────────────
//   1) 부유 광고판   건물 앞 허공에 뜬 큰 판. 스케일의 폭력을 만든다.
//   2) 디지털 수목   빛나는 나무. 조경인데 식물이 아니다.
//   3) 투사 기둥     바닥에서 하늘로 솟는 빛기둥. 기업 구역의 과시.
//   4) 부유 표식     가게 위에 뜬 작은 홀로. 개수로 밀도를 만든다.
//
// ── 구역이 무엇을 갖는가 (docs/city.md 시기) ───────────────────────────────
// 홀로그램은 2기(기업의 자기 홍보)와 3기(상점의 호객)의 것이다.
// **1기 흔적인 공장과 주거에는 없다.** 대비를 위해서가 아니라 그 구역이
// 그 시기의 것이 아니기 때문이다.
import * as THREE from 'three';
import { MeshBuilder } from '../../core/builder.js';
import { tubeBetween } from '../../core/profile.js';
import { upPlane, rectCenter, rectSize } from '../../core/boxfaces.js';
import { NEON, rgb01 } from '../../shared/neon.js';
import { holo, holoSoft } from '../../shared/masters.js';
import {
  GRID,
  blockRect,
  CURB_HEIGHT,
  detailAt,
  blockIndexAt,
} from './layout.js';
import { districtAt, byZone } from './district.js';
import { roadAt } from './layout.js';

// 구역별 홀로그램 밀도. 0 이면 그 구역엔 하나도 없다.
// byZone 이 강제한다 (district.byZone 머리말). 0 이 **의도한 0** 인지
// 표에서 빠져 `?? 0` 이 된 것인지 코드만 보고는 구별할 수 없었다.
const RATE = byZone('홀로 광고', {
  상업: 1.0, 기업: 0.85, 주거: 0.12, 공업: 0,
  슬럼: 0,   // 광고주가 없다. 여기 사는 사람에게 팔 것이 없다
  부둣가: 0, // 광고할 상대가 없다. 사람이 안 지나간다
});

// ── 부유 광고판 ────────────────────────────────────────────────────────────
//
// 건물 앞 허공에 뜬 큰 판. **받침이 없는 것**이 요점이다.
//
// 크기가 중요하다. 간판만 해지면 그냥 간판이고, 건물 절반을 덮어야
// "압도당한다" 는 느낌이 난다 — 그게 사이버펑크의 정서다.
function floatPanel(b, x, y, z, yaw, w, h, hue, rng) {
  // 본체 — 얇은 판 둘을 겹쳐 두께를 흉내낸다. 가산합성이라 겹치면 밝아지고,
  // 그 밝기 차이가 부피감을 만든다.
  for (const d of [-0.06, 0.06]) {
    const g = new THREE.PlaneGeometry(w, h);
    g.rotateY(yaw);
    g.translate(x + Math.sin(yaw + Math.PI / 2) * d, y, z + Math.cos(yaw + Math.PI / 2) * d);
    b.add(g, holoSoft(hue));
  }

  // 주사선 — 가로줄 몇 개. 홀로그램을 홀로그램으로 만드는 단 하나의 신호다.
  // 이게 없으면 그냥 반투명한 판이다.
  const lines = Math.max(3, Math.round(h / 1.6));
  for (let i = 0; i < lines; i++) {
    const ly = y - h / 2 + (h * (i + 0.5)) / lines;
    const g = new THREE.PlaneGeometry(w * rng.range(0.7, 1.0), 0.09);
    g.rotateY(yaw);
    g.translate(x, ly, z);
    b.add(g, holo(hue));
  }

  // 테두리 — 위아래만. 사방을 두르면 액자가 되어 '투영' 이 아니라 '설치물' 이다.
  for (const s of [-1, 1]) {
    const g = new THREE.PlaneGeometry(w, 0.14);
    g.rotateY(yaw);
    g.translate(x, y + s * (h / 2), z);
    b.add(g, holo(hue));
  }
}

// ── 디지털 수목 ────────────────────────────────────────────────────────────
//
// 조경인데 식물이 아니다. 빛나는 선으로 나무 형상을 그린다.
//
// 왜 이게 조경인가: 이 도시는 바다를 메운 땅이라 흙이 없고, 황폐한 세계라
// 나무를 구할 수도 없다. 그런데 광장에는 조경이 있어야 한다 — 그래서
// **나무를 흉내낸 장치**를 세운다. 그 사실 자체가 이 세계의 설명이다.
// room 은 이 자리에서 연석까지 남은 거리다.
//
// 줄기는 인도 한가운데 서는데 **가지가 퍼진다.** 낮은 가지(짧은 나무는
// 가지 끝이 3.2m 높이에 있다)가 차도로 넘어가면 트럭이 지나갈 자리를
// 막는다 — 배치 검사가 그것을 잡았다. 머리 위로 지나가는 가지는 결함이
// 아니지만 이건 지면 높이다.
function digitalTree(b, x, z, rng, mats, pools, room = Infinity) {
  const H = rng.range(4.5, 8);
  const hue = rng.chance(0.55) ? NEON.cyan : rng.chance(0.5) ? NEON.green : NEON.violet;
  const Y = CURB_HEIGHT;

  // 기둥 — 실물 금속. 장치이므로 받침은 진짜다.
  b.cylinder(0.18, 0.24, 0.5, [x, Y + 0.25, z], mats.metalMat, 10);
  b.add(tubeBetween([x, Y + 0.4, z], [x, Y + H * 0.5, z], 0.07, 6), mats.metalMat);

  // 가지 — 위로 갈라지는 선. 홀로그램이라 뒤가 비친다.
  const branches = rng.int(4, 7);
  for (let i = 0; i < branches; i++) {
    const a = (i / branches) * Math.PI * 2 + rng.range(-0.3, 0.3);
    // 잎이 가지 끝에서 0.5m 더 나가므로 그만큼 더 뺀다.
    // rng 는 항상 소비한다 — 건너뛰면 뒤의 모든 생성이 밀린다.
    const spread = Math.min(rng.range(1.2, 2.4), Math.max(0.9, room - 0.6));
    const top = H * rng.range(0.72, 1.0);
    const mid = [x + Math.cos(a) * spread * 0.45, Y + H * 0.62, z + Math.sin(a) * spread * 0.45];
    const end = [x + Math.cos(a) * spread, Y + top, z + Math.sin(a) * spread];
    b.add(tubeBetween([x, Y + H * 0.5, z], mid, 0.05, 4), holo(hue));
    b.add(tubeBetween(mid, end, 0.035, 4), holo(hue));

    // 잎 — 가지 끝의 작은 면. 몇 개만 둔다.
    if (rng.chance(0.7)) {
      const g = new THREE.PlaneGeometry(rng.range(0.5, 1.0), rng.range(0.4, 0.8));
      g.rotateY(a);
      g.translate(end[0], end[1], end[2]);
      b.add(g, holoSoft(hue));
    }
  }

  pools.push({
    kind: 'floor', x, y: Y + 0.03, z, rx: 3.4, rz: 3.4, tint: rgb01(hue, 0.3),
  });
}

// ── 투사 기둥 ──────────────────────────────────────────────────────────────
//
// 바닥에서 하늘로 솟는 빛기둥. 실체가 없어서 **가장 순수한 과시**다 —
// 아무 기능도 없이 에너지만 쓴다. 그래서 기업 구역의 것이다.
function beamColumn(b, x, z, rng, pools) {
  const H = rng.range(30, 90);
  const R = rng.range(1.2, 2.6);
  const hue = rng.chance(0.6) ? NEON.cool : NEON.cyan;
  const seg = 10;

  // 원통 — 위로 갈수록 옅어지게 만들 수 없으므로(단일 재질) 대신 **위로
  // 갈수록 가늘게** 한다. 원근과 합쳐져 사라지는 것처럼 보인다.
  const g = new THREE.CylinderGeometry(R * 0.25, R, H, seg, 1, true);
  g.translate(x, CURB_HEIGHT + H / 2, z);
  b.add(g, holoSoft(hue));

  // 바닥 원반 — 빛이 어디서 나오는지를 보여준다
  b.add(upPlane(R * 4, R * 4, [x, CURB_HEIGHT + 0.04, z]), holoSoft(hue));
  pools.push({ kind: 'floor', x, y: CURB_HEIGHT + 0.05, z, rx: R * 4, rz: R * 4, tint: rgb01(hue, 0.5) });
}

// ── 부유 표식 ──────────────────────────────────────────────────────────────
//
// 가게 위에 뜬 작은 홀로. 하나하나는 작지만 **개수로 밀도를 만든다.**
// 거리를 걸을 때 눈높이 위에 계속 떠 있는 것이 사이버펑크의 시야다.
function marker(b, x, y, z, rng) {
  const hue = [NEON.cyan, NEON.magenta, NEON.amber, NEON.green][rng.int(0, 3)];
  const s = rng.range(0.5, 1.1);
  const yaw = rng.range(0, Math.PI * 2);

  // 마름모 — 회전한 사각형. 원이나 사각보다 '표식' 으로 읽힌다.
  const g = new THREE.PlaneGeometry(s, s);
  g.rotateZ(Math.PI / 4);
  g.rotateY(yaw);
  g.translate(x, y, z);
  b.add(g, holo(hue));

  // 아래 짧은 선 — 무엇을 가리키는지 보여준다
  b.add(tubeBetween([x, y - s * 0.7, z], [x, y - s * 1.5, z], 0.02, 4), holo(hue));
}

function districtNear(x, z) {
  const ix = blockIndexAt(x);
  const iz = blockIndexAt(z);
  return districtAt(ix, iz);
}

// ── 조립 ───────────────────────────────────────────────────────────────────

export function createHolo(scene, rng, mats, anchors) {
  // 홀로그램은 그림자를 주지도 받지도 않는다. 빛이므로 당연하다 —
  // 그림자를 지면 그 순간 물체가 된다.
  const b = new MeshBuilder('Holo', { castShadow: false, receiveShadow: false });
  const pools = [];
  let panels = 0;
  let trees = 0;
  let beams = 0;
  let markers = 0;

  for (const a of anchors) {
    const rate = RATE[a.zone] ?? 0;
    if (rate <= 0) continue;
    const c = rectCenter(a.rect);
    const s = rectSize(a.rect);
    const det = detailAt(c.x, c.z);

    for (const side of ['px', 'nx', 'pz', 'nz']) {
      if (!a.faces?.[side]) continue;
      const alongX = side === 'pz' || side === 'nz';
      const fw = alongX ? s.w : s.d;
      if (fw < 8) continue;

      const outSign = side === 'px' || side === 'pz' ? 1 : -1;
      const yaw = alongX ? (outSign > 0 ? 0 : Math.PI) : (outSign > 0 ? Math.PI / 2 : -Math.PI / 2);

      // 1) 부유 광고판 — 건물 앞에 크게. 이게 스케일의 폭력이다.
      if (rng.chance(0.34 * rate * det) && a.top > 14) {
        const w = fw * rng.range(0.6, 1.1);
        const h = Math.min(a.top * 0.55, rng.range(8, 22));
        // ── 얼마나 앞에 뜨는가 ────────────────────────────────────────
        // 전에는 4~9m 로 뒀는데 인도가 3.2~7.5m 다. 그래서 홀로그램이
        // 인도를 넘어 차도로 나가거나, 판이 커서 아래로 내려오면 인도를
        // 관통하고 사람이 그 안에 서 있었다.
        //
        // 인도 폭 안에서만 띄우고, 아래 끝이 **간판대 위**(6m)에 있게 한다.
        // 사람 눈높이로 내려오면 홀로그램이 아니라 장애물이다.
        const D2 = districtNear(c.x, c.z);
        const dist = Math.min(rng.range(2.5, 6), (D2.sidewalk ?? 4.6) - 1.2);
        const px = alongX ? c.x : (outSign > 0 ? a.rect.x1 + dist : a.rect.x0 - dist);
        const pz = alongX ? (outSign > 0 ? a.rect.z1 + dist : a.rect.z0 - dist) : c.z;
        // 아래 끝이 6m 위 — 사람과 간판대를 비켜간다
        const minY = CURB_HEIGHT + 6 + h / 2;
        const py = Math.max(minY, CURB_HEIGHT + rng.range(a.top * 0.4, Math.max(a.top * 0.45, a.top - h * 0.6)));
        if (py + h / 2 > a.top + 8) continue; // 건물보다 너무 위로 뜨지 않는다
        const hue = [NEON.magenta, NEON.cyan, NEON.violet, NEON.amber][rng.int(0, 3)];
        // axis 는 "건물 면에서 어느 쪽으로 나갔나" 다. 검사가 그 축만 본다 —
        // 정면을 따라 긴 판이 옆 교차로 위로 나가는 것은 다른 사건이다
        // (placecheck.js roadIntrusion).
        b.mark('holo', `holoPanel#${panels}`, { zone: a.zone, axis: alongX ? 'z' : 'x' });
        floatPanel(b, px, py, pz, yaw, w, h, hue, rng);
        panels++;
      }

      // 2) 부유 표식 — 점포 위. 개수로 밀도를 만든다.
      const n = Math.max(1, Math.round((fw / 9) * rate * det));
      // 표식도 광고판과 같이 **인도 폭 안에서만** 띄운다.
      //
      // 광고판(위)에는 이 상한이 있었는데 표식에는 없었다. 그래서 인도가 좁은
      // 구역에서 표식이 차도로 나갔다 — 7번 버그(홀로그램이 인도를 관통)와
      // 같은 종류이고, 배치 검사가 잡았다.
      const walk = districtNear(c.x, c.z).sidewalk ?? 4.6;
      for (let i = 0; i < n; i++) {
        if (!rng.chance(0.6)) continue;
        const u = -fw / 2 + fw * ((i + 0.5) / n) + rng.range(-1.5, 1.5);
        // rng 는 항상 소비한다 — 건너뛰면 뒤의 모든 생성이 밀린다
        const dist = Math.min(rng.range(2.2, 4.5), Math.max(1.0, walk - 1.2));
        const mx = alongX ? c.x + u : (outSign > 0 ? a.rect.x1 + dist : a.rect.x0 - dist);
        const mz = alongX ? (outSign > 0 ? a.rect.z1 + dist : a.rect.z0 - dist) : c.z + u;
        b.mark('holo', `holoMarker#${markers}`, { zone: a.zone, axis: alongX ? 'z' : 'x' });
        // 차도 위에 뜨면 물러난다. 인도 폭으로 계산하면 대지 병합 뒤로는
        // 필지 가장자리와 도로 사이 거리가 일정하지 않아 어긋난다 —
        // **도로가 어디인지는 roads() 가 안다.**
        if (roadAt(mx) || roadAt(mz)) continue;
        marker(b, mx, CURB_HEIGHT + rng.range(4.5, 7.5), mz, rng);
        markers++;
      }
    }
  }

  // 앞의 표시를 닫는다. 안 닫으면 아래 수목·기둥이 **마지막 표식의 기록으로
  // 빨려 들어가서**, 도시 전체를 감싸는 상자 하나가 되어 검사가 헛것을 잡는다
  // (실제로 "홀로 하나가 차도를 22m 침범" 으로 나왔다).
  b.endMark();

  // 3) 디지털 수목 · 투사 기둥 — 블록 단위. 광장과 번화가에 선다.
  for (let ix = 0; ix < GRID; ix++) {
    for (let iz = 0; iz < GRID; iz++) {
      const R = blockRect(ix, iz);
      const cx = (R.x0 + R.x1) / 2;
      const cz = (R.z0 + R.z1) / 2;
      const D = districtAt(ix, iz);
      const rate = RATE[D.name] ?? 0;
      if (rate <= 0) continue;
      const det = detailAt(cx, cz);
      const half = (R.x1 - R.x0) / 2;
      const walk = (D.sidewalk ?? 4.6);

      // 수목 — 인도 위. 기업 구역은 광장에 열 맞춰, 상업은 제각각.
      const treeN = D.name === '기업' ? Math.round(4 * det) : Math.round(2 * det);
      for (let i = 0; i < treeN; i++) {
        if (!rng.chance(rate * 0.7)) continue;
        const edge = rng.int(0, 3);
        const along = rng.range(-half + 8, half - 8);
        // 인도 안쪽으로 더 물린다 (0.35~0.7 → 0.45~0.75). 연석에 붙여 심으면
        // 가지가 차도로 넘어간다.
        const inset = walk * rng.range(0.45, 0.75);
        const depth = half - inset;
        const tx = edge < 2 ? cx + along : cx + (edge === 2 ? -depth : depth);
        const tz = edge < 2 ? cz + (edge === 0 ? -depth : depth) : cz + along;
        b.mark('holo', `holoTree#${trees}`, { zone: D.name, axis: edge < 2 ? 'z' : 'x' });
        digitalTree(b, tx, tz, rng, mats, pools, inset);
        trees++;
      }

      // 투사 기둥 — 기업 구역만. 아무 기능도 없이 에너지만 쓰는 과시다.
      if (D.name === '기업' && rng.chance(0.35 * det)) {
        // 기둥은 블록 한가운데에 독립해 선다 — 붙은 면이 없으므로 axis 가 없고,
        // 검사는 두 축을 다 본다.
        b.mark('holo', `holoBeam#${beams}`, { zone: D.name });
        beamColumn(b, cx + rng.range(-12, 12), cz + rng.range(-12, 12), rng, pools);
        beams++;
      }
    }
  }

  return { group: b.build(scene), pools, count: panels + trees + beams + markers,
           panels, trees, beams, markers };
}
