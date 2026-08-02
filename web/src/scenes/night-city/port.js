// 바다 · 안벽 · 항만 — 이 도시가 존재하는 이유.
//
// ── 왜 필요한가 (docs/city.md 지리) ────────────────────────────────────────
// 이 도시는 삼면이 바다인 **곶** 위에 있다. 바깥 세계는 황폐하므로 육로는
// 쓸모가 적고, 물자는 배로 온다. 항만이 유일한 생명선이고, 그래서 기업이
// 여기 공장을 세웠고, 그래서 도시가 있다.
//
// 그런데 지금까지 도시는 **평평한 무한 평면 위에 떠 있었다.** 경계가 없으니
// 왜 이렇게 빽빽한지가 설명되지 않았다. 곶이라 못 넓히는 것이 3기의 밀도와
// 4기의 증축을 만든 원인인데, 그 원인이 화면에 없었다.
//
// ── 무엇을 만드는가 ────────────────────────────────────────────────────────
//   1) 바다      삼면을 물로 막는다. 도시가 왜 못 넓어지는지가 눈에 보인다.
//   2) 안벽      물과 땅의 경계. 방파제와 계선주.
//   3) 항만      갠트리 크레인 · 컨테이너 야드 · 부두. 무역의 실체.
//
// ── 왜 크레인이 중요한가 ───────────────────────────────────────────────────
// 갠트리 크레인은 실루엣이 도시의 무엇과도 안 닮았다. 타워는 세로, 공장동은
// 가로인데 크레인은 **ㄱ 자로 꺾여 물 위로 팔을 뻗는다.** 멀리서 그 형태가
// 보이는 순간 "저기가 항구다" 가 성립한다. 도심의 랜드마크 타워가 하는 일을
// 물가에서는 크레인이 한다.
import * as THREE from 'three';
import { MeshBuilder } from '../../core/builder.js';
import { autoBox, tubeBetween, lathe } from '../../core/profile.js';
import { upPlane } from '../../core/boxfaces.js';

import { neon, neonSoft } from '../../shared/masters.js';
import { CITY_HALF, CURB_HEIGHT, roads } from './layout.js';

// 안벽 위치.
//
// ── 항만 쪽만 넓다 (실측으로 고침) ─────────────────────────────────────────
// 처음에는 사방을 CITY_HALF + 34 로 두고 그 안에 크레인과 컨테이너 야드를
// 넣었다. 34m 로는 턱없이 부족해서 **크레인 다리가 도로 위에 서고 컨테이너가
// 교차로에 쌓였다.** 항만 시설은 배가 접안하는 안벽에 붙는 것이지 시내에
// 있는 것이 아니다.
//
// 하역에는 최소한 크레인 다리(22m) + 야드(60m) + 진입로가 필요하다.
// 그래서 항만이 있는 -X 쪽만 넓게 잡고 나머지 삼면은 좁게 둔다 — 곶이라
// 여유가 없다는 설정은 그대로다.
// 삼면 안벽의 x·z 절대값. **여기가 유일한 출처다** — 조선소 랜드마크가
// 배를 어디에 접안시킬지 이 값으로 안다 (landmark.shipyard).
export const SHORE = CITY_HALF + 34;
const PORT_SHORE = CITY_HALF + 150; // -X 쪽 (하역 부두)

// ── 부두는 -X 의 **+Z 절반에만** 있다 (사용자 지적) ───────────────────────
//
// *"절반으로 했다면서 이 통짜맵은 왜 남아있는거임?"*
//
// 맞다. 부둣가 **구역**은 절반으로 줄였는데 **땅**은 그대로 뒀다.
// `PORT_SHORE` 가 −X 한 변 전체(1,090m)에 걸려 있어서, 항만이 없는 쪽에도
// 133m 짜리 매립지가 그대로 남아 있었다. 거기에 야적장을 채워 넣었지만
// **채울 것이 아니라 없앨 것**이었다 — 도시가 못 넓어지는 것이 이 세계의
// 전제인데, 아무도 안 쓰는 땅이 도시 넓이의 12% 나 붙어 있으면 그 전제가
// 무너진다.
//
// 그래서 해안선을 **계단**으로 만든다. 부두가 있는 쪽만 150m 나가고
// 나머지는 삼면과 같은 34m 다. 매립은 필요한 만큼만 했다는 뜻이고,
// 그것이 이 도시가 좁은 이유와도 맞는다.
// ── 한 번 더 줄였다 (사용자 지시) ────────────────────────────────────────
// *"더줄여"*
//
// 계단으로 만들고도 부두가 535m 였는데, 크레인과 야드가 실제로 차지하는 것은
// 그중 430m 이고 남쪽 끝이 비어 있었다. **부두는 배가 대는 길이만큼만 있으면
// 된다** — 안벽 길이는 접안하는 배 수가 정하지 땅이 남았다고 늘리는 것이 아니다.
//
// 크레인을 다섯에서 넷으로 줄이고 야드를 서로 맞붙여 빈틈을 없앤 뒤, 그
// 길이에 맞춰 매립선을 올렸다.
// 크레인 넷 x 76m = 304m 에 앞뒤 여유를 더한 값에서 거꾸로 잡았다.
// 매립선을 먼저 정하고 시설을 채우면 반드시 어딘가 남는다 — **쓰는 길이가
// 먼저고 매립선이 나중이다.**
const PORT_Z0 = 200;                // 이 위(+Z)만 부두다
const westShoreAt = (z) => (z >= PORT_Z0 ? PORT_SHORE : SHORE);
// 바다 넓이. 수평선까지 가야 하므로 크게 잡는다.
const SEA = 4200;
// 수면 높이. 안벽보다 낮아야 '물가' 로 읽힌다.
const SEA_Y = -3.2;

// ── 호안 비탈 ──────────────────────────────────────────────────────────────
//
// 도시 격자 끝과 안벽 사이를 잇는 경사면. 이게 없으면 도시가 물 위에 뜬
// 판때기로 보인다.
//
// ── 지형 높낮이에 대해 (docs/districts.md 3.7) ─────────────────────────────
// 원래 목표는 도시 **안**에도 고저차를 두는 것이었다. 곶이니 중심이 높고
// 물가로 내려가는 것이 자연스럽다. 그런데 그건 지면 평면 한 장으로 도시
// 전체를 덮는 현재 구조를 바꿔야 하고, 차량·비·빛웅덩이·건물 기단이 전부
// y=0 을 가정하고 있어서 한꺼번에 손봐야 한다.
//
// 그래서 **도시 안은 평지로 두고 가장자리만 내린다.** 이건 설정과도 맞는다 —
// 1기에 바다를 메워 만든 땅이므로 매립면은 평평한 것이 정상이고, 그 평지가
// 물가에서 뚝 떨어지는 것이 매립지의 실제 단면이다.
//
// 도시 안 고저차는 별도 작업으로 남긴다 (아래 '남은 것' 주석 참고).
function embankment(b, mats) {
  const inner = CITY_HALF + 2;   // 도시 격자 끝
  const outer = SHORE - 1.5;     // 안벽 안쪽 (삼면)
  const topY = CURB_HEIGHT;      // 도시 지면
  const botY = SEA_Y + 5.0;      // 안벽 상단

  // 한 조각 — 안쪽 모서리는 도시 높이, 바깥 모서리는 안벽 높이
  const slab = (x0, x1, z0, z1, axis, outwardPositive) => {
    const g = new THREE.PlaneGeometry(x1 - x0, z1 - z0, 1, 1);
    g.rotateX(-Math.PI / 2);
    const pos = g.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const along = axis === 'x' ? pos.getX(i) : pos.getZ(i);
      pos.setY(i, (outwardPositive ? along > 0 : along < 0) ? botY : topY);
    }
    g.computeVertexNormals();
    g.translate((x0 + x1) / 2, 0, (z0 + z1) / 2);
    b.add(g, mats.quayMat);
  };

  // ── -X 쪽은 **계단**이다 ────────────────────────────────────────────────
  // 부두 구간만 PORT_SHORE 까지 나가고, 그 아래는 삼면과 같다.
  slab(-(PORT_SHORE - 1.5), -inner, PORT_Z0, SHORE, 'x', false);
  slab(-outer, -inner, -SHORE, PORT_Z0, 'x', false);
  // 계단이 꺾이는 면 — 부두 옆구리. 없으면 그 자리가 뚫려 보인다
  slab(-(PORT_SHORE - 1.5), -outer, PORT_Z0 - 1.5, PORT_Z0, 'z', false);

  slab(inner, outer, -SHORE, SHORE, 'x', true);          // +X (육지)
  slab(-outer, outer, -outer, -inner, 'z', false);       // -Z
  slab(-outer, outer, inner, outer, 'z', true);          // +Z
}

// ── 바다 ───────────────────────────────────────────────────────────────────
//
// 평면 한 장이다. 파도를 만들 필요가 없다 — 밤이고, 물이 하는 일은
// **도시의 빛을 반사하는 것**뿐이다. 거칠기를 거의 0으로 두면 그게 된다.
function sea(b, mats) {
  b.add(upPlane(SEA, SEA, [0, SEA_Y, 0]), mats.seaMat);
}

// ── 안벽 ───────────────────────────────────────────────────────────────────
//
// 물과 땅의 경계. 이게 있어야 도시가 '떠 있는 판' 이 아니라 '메운 땅' 이 된다.
//
// 육지 쪽(+X)은 막지 않는다 — 곶이므로 한 방향만 뭍에 붙어 있다.
function quay(b, rng, mats) {
  const H = 5.0; // 안벽 높이 (수면에서 지면까지)
  const T = 3.0; // 두께

  // −X 는 **계단**이라 두 도막 + 꺾이는 한 도막이다. +X 는 육지로 이어진다.
  const runs = [
    // 부두 구간 (+Z 절반)
    { alongX: false, x: -PORT_SHORE, z: (PORT_Z0 + SHORE) / 2, len: SHORE - PORT_Z0 },
    // 그 아래 일반 안벽
    { alongX: false, x: -SHORE, z: (-SHORE + PORT_Z0) / 2, len: SHORE + PORT_Z0 },
    // 계단이 꺾이는 도막
    { alongX: true, x: -(PORT_SHORE + SHORE) / 2, z: PORT_Z0, len: PORT_SHORE - SHORE },
    { alongX: true, x: 0, z: -SHORE, len: SHORE * 2 },
    { alongX: true, x: (SHORE - PORT_SHORE) / 2, z: SHORE, len: PORT_SHORE + SHORE },
  ];

  for (const r of runs) {
    const [w, d] = r.alongX ? [r.len, T] : [T, r.len];
    b.box(w, H, d, [r.x, SEA_Y + H / 2, r.z], mats.quayMat);
    // 상단 연석 — 안벽 끝이 눈에 보여야 한다
    const [cw, cd] = r.alongX ? [r.len, T + 0.6] : [T + 0.6, r.len];
    b.box(cw, 0.4, cd, [r.x, SEA_Y + H + 0.2, r.z], mats.plazaStepMat);

    // 계선주 — 배를 묶는 쇠기둥. 일정 간격.
    const n = Math.round(r.len / 26);
    for (let i = 0; i < n; i++) {
      const t = -r.len / 2 + (r.len * (i + 0.5)) / n;
      const px = r.alongX ? r.x + t : r.x - 1.6;
      const pz = r.alongX ? r.z - Math.sign(r.z || 1) * 1.6 : r.z + t;
      b.add(
        lathe([[0.34, 0], [0.3, 0.6], [0.42, 0.78], [0.24, 0.86]], 8,
          [px, SEA_Y + H + 0.4, pz]),
        mats.metalMat
      );
    }

    // 안벽등 — 주황. 여기는 1기 영역이라 네온을 쓰지 않는다.
    const lamps = Math.round(r.len / 60);
    for (let i = 0; i < lamps; i++) {
      const t = -r.len / 2 + (r.len * (i + 0.5)) / lamps;
      const px = r.alongX ? r.x + t : r.x + 3.2;
      const pz = r.alongX ? r.z - Math.sign(r.z || 1) * 3.2 : r.z + t;
      b.cylinder(0.16, 0.2, 7, [px, SEA_Y + H + 3.5, pz], mats.metalMat, 8);
      b.sphere(0.28, [px, SEA_Y + H + 7.1, pz], neon(0xff9a3c));
    }
  }
}

// ── 갠트리 크레인 ──────────────────────────────────────────────────────────
//
// 항구의 랜드마크. ㄱ 자로 꺾여 물 위로 팔을 뻗는 실루엣이 도시의 무엇과도
// 안 닮아서, 멀리서 보이는 순간 저기가 항구임을 알린다.
function gantry(b, x, z, facing, rng, mats) {
  const H = rng.range(38, 52); // 다리 높이
  const LEG = 22; // 다리 간격
  const REACH = rng.range(34, 46); // 물 쪽으로 뻗는 팔
  const BACK = 16; // 뒤쪽 균형추 팔
  const y0 = SEA_Y + 5.0;
  const s = facing; // +1 이면 +X 로 뻗는다

  // 다리 넷 — 각 다리는 A 자로 벌어진다
  for (const dz of [-LEG / 2, LEG / 2]) {
    for (const dx of [-7, 7]) {
      b.add(
        tubeBetween([x + dx * 1.4, y0, z + dz], [x + dx * 0.3, y0 + H, z + dz], 0.55, 6),
        mats.craneMat
      );
      // 주행 대차
      b.box(3.0, 1.2, 2.2, [x + dx * 1.4, y0 + 0.6, z + dz], mats.metalMat);
    }
    // 다리 사이 가새
    b.add(tubeBetween([x - 9.8, y0 + H * 0.5, z + dz], [x + 2.1, y0 + H * 0.78, z + dz], 0.22, 4), mats.craneMat);
    b.add(tubeBetween([x + 9.8, y0 + H * 0.5, z + dz], [x - 2.1, y0 + H * 0.78, z + dz], 0.22, 4), mats.craneMat);
  }

  // 상단 가로보
  b.box(16, 1.6, LEG + 2, [x, y0 + H, z], mats.craneMat);

  // 붐 — 물 쪽으로 길게. 이게 크레인의 정체성이다.
  b.box(REACH, 1.4, 3.0, [x + s * (REACH / 2 + 6), y0 + H + 1.2, z], mats.craneMat);
  // 뒤쪽 균형추 팔
  b.box(BACK, 1.4, 3.0, [x - s * (BACK / 2 + 6), y0 + H + 1.2, z], mats.craneMat);
  b.add(autoBox(6, 3.4, 4.4, [x - s * (BACK + 4), y0 + H + 1.0, z], 0.1), mats.metalMat);

  // 붐을 매다는 케이블 — 없으면 팔이 공중에 떠 보인다
  const apex = [x, y0 + H + 11, z];
  b.box(1.0, 11, 1.0, [x, y0 + H + 6, z], mats.craneMat);
  b.add(tubeBetween(apex, [x + s * (REACH + 6), y0 + H + 1.6, z], 0.12, 4), mats.cableMat);
  b.add(tubeBetween(apex, [x - s * (BACK + 4), y0 + H + 1.6, z], 0.12, 4), mats.cableMat);

  // 트롤리와 스프레더 — 실제로 컨테이너를 집는 부분
  const tx = x + s * rng.range(8, REACH);
  b.box(3.2, 1.4, 3.2, [tx, y0 + H + 0.2, z], mats.metalMat);
  const drop = rng.range(6, H * 0.7);
  for (const dz2 of [-1.2, 1.2]) {
    b.add(tubeBetween([tx, y0 + H - 0.4, z + dz2], [tx, y0 + H - drop, z + dz2], 0.06, 4), mats.cableMat);
  }
  b.box(2.6, 0.6, 6.2, [tx, y0 + H - drop, z], mats.hazardMat);

  // 운전실 — 트롤리에 매달린다
  b.add(autoBox(2.4, 2.2, 2.6, [tx - s * 2.6, y0 + H - 1.6, z], 0.08), mats.factoryDarkMat);
  b.box(1.8, 0.9, 0.1, [tx - s * 2.6, y0 + H - 1.3, z + 1.3], neonSoft(0xdce4d8));

  // 항공장애등
  b.sphere(0.3, [x, y0 + H + 11.6, z], neon(0xff2a2a));
  b.sphere(0.26, [x + s * (REACH + 6), y0 + H + 1.6, z], neon(0xff2a2a));
}

// ── 컨테이너 야드 ──────────────────────────────────────────────────────────
//
// 쌓인 컨테이너. 항만의 바닥을 채우는 것이고, 크기가 알려진 물건이라
// 크레인이 얼마나 큰지도 여기서 읽힌다.
function containerYard(b, cx, cz, w, d, rng, mats) {
  const CW = 2.5;
  const CH = 2.6;
  const CL = 12.2; // 40피트
  const cols = Math.max(2, Math.floor(w / (CW + 0.5)));
  const rows = Math.max(1, Math.floor(d / (CL + 1.5)));

  for (let i = 0; i < cols; i++) {
    for (let j = 0; j < rows; j++) {
      // 빈 자리를 섞는다 — 꽉 채우면 벽돌 벽이지 야드가 아니다
      if (!rng.chance(0.72)) continue;
      const stack = rng.int(1, 4);
      const x = cx - w / 2 + (CW + 0.5) * (i + 0.5);
      const z = cz - d / 2 + (CL + 1.5) * (j + 0.5);
      for (let k = 0; k < stack; k++) {
        // 위로 갈수록 살짝 어긋나게 — 기계가 쌓아도 완벽하진 않다
        const jx = k === 0 ? 0 : rng.range(-0.12, 0.12);
        const jz = k === 0 ? 0 : rng.range(-0.3, 0.3);
        b.box(CW, CH, CL, [x + jx, CURB_HEIGHT + CH * (k + 0.5), z + jz],
          rng.chance(0.5) ? mats.crateAltMat : mats.dumpsterMat);
      }
    }
  }
}

// ── 조립 ───────────────────────────────────────────────────────────────────

// ── 앞마당 — 격자 바깥과 안벽 사이 ─────────────────────────────────────────
//
// 사용자 지적: *"외곽 부분의 아무것도 없는 회색 바닥도 점검"*
//
// 맞다. 격자 바깥 도로와 안벽 사이에 −X 는 133m, 삼면은 20m 가 남는데
// **아무것도 없는 회색 판**이었다. 위에서 내려다보면 도시가 빈 접시에 담긴
// 것처럼 보인다.
//
// 여기는 1기에 바다를 메우고 남은 땅이다. 도시가 못 넓어졌으니 개발되지
// 않았고, 그래서 **쓰다 만 야적장**이 되는 것이 이 땅의 내력에 맞는다 —
// 철망으로 구획만 해 놓고 폐컨테이너와 자재가 쌓인 채 방치된 곳.
function apron(b, rng, mats, roadLo, roadHi, portZ0) {
  const Y = CURB_HEIGHT;

  // 철망 한 줄
  const fence = (x0, z0, x1, z1) => {
    const len = Math.hypot(x1 - x0, z1 - z0);
    const n = Math.max(2, Math.round(len / 3.4));
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      b.box(0.09, 2.4, 0.09, [x0 + (x1 - x0) * t, Y + 1.2, z0 + (z1 - z0) * t], mats.pipeMat);
    }
    const alongX = Math.abs(x1 - x0) > Math.abs(z1 - z0);
    for (const hy of [0.4, 2.35]) {
      b.box(alongX ? len : 0.06, 0.06, alongX ? 0.06 : len,
        [(x0 + x1) / 2, Y + hy, (z0 + z1) / 2], mats.pipeMat);
    }
  };

  // 한 구획을 채운다 — 폐컨테이너·자재 더미·빈 트레일러·나트륨등
  const lot = (cx, cz, w, d) => {
    if (w < 8 || d < 8) return;
    // 네 변을 다 두른다. 두 변만 두르면 구획이 아니라 줄이다
    fence(cx - w / 2, cz - d / 2, cx + w / 2, cz - d / 2);
    fence(cx - w / 2, cz + d / 2, cx + w / 2, cz + d / 2);
    fence(cx - w / 2, cz - d / 2, cx - w / 2, cz + d / 2);
    fence(cx + w / 2, cz - d / 2, cx + w / 2, cz + d / 2);
    // 포장 — 지면 평면 그대로 두면 회색 판이다. 구획 안이 다른 바닥이어야
    // '누구의 자리' 로 읽힌다
    b.add(upPlane(w - 1, d - 1, [cx, Y + 0.04, cz], [6, 6]), mats.lotMat);
    const area = w * d;
    // **밀도가 문제였다.** area/900 이면 32,000m² 짜리 구획에 물건이 서른
    // 남짓이라, 눈높이에서는 여전히 빈 벌판이었다. 앞마당은 133 x 1,090m —
    // 도시 블록 서른 개 넓이다. 개수를 세지 말고 밀도를 쓴다.
    const n = Math.max(3, Math.round(area / 240));
    for (let i = 0; i < n; i++) {
      const px = cx + rng.range(-w * 0.38, w * 0.38);
      const pz = cz + rng.range(-d * 0.38, d * 0.38);
      const k = rng.next();
      if (k < 0.34) {
        // 폐컨테이너 — 문이 열린 채 쌓였다
        for (let s = 0; s < rng.int(1, 3); s++) {
          b.box(2.5, 2.6, 12.2, [px, Y + 1.3 + s * 2.62, pz],
            rng.chance(0.5) ? mats.crateAltMat : mats.rustMat);
        }
      } else if (k < 0.6) {
        // 강재·파이프 더미 — 눕힌 원통 몇
        for (let s = 0; s < rng.int(3, 6); s++) {
          b.cylinder(0.34, 0.34, 9.0, [px + s * 0.72, Y + 0.34, pz], mats.rustMat, 8);
        }
      } else if (k < 0.82) {
        // 빈 트레일러 — 다리를 내리고 세워 둔 것
        b.box(2.5, 1.1, 12.0, [px, Y + 1.5, pz], mats.metalMat);
        for (const su of [-5, 5]) b.box(0.2, 1.0, 0.2, [px, Y + 0.5, pz + su], mats.pipeMat);
      } else {
        // 자재 팔레트 더미
        for (let s = 0; s < rng.int(2, 5); s++) {
          b.box(2.4, 0.2, 1.8, [px, Y + 0.1 + s * 0.24, pz], mats.plywoodMat);
        }
      }
    }
    // 나트륨등 — 구획 길이마다. 하나만 두면 130m 짜리 구획이 통째로 어둡다
    const lamps = Math.max(2, Math.round(Math.max(w, d) / 46));
    for (let i = 0; i < lamps; i++) {
      const t = (i + 0.5) / lamps - 0.5;
      const lx = cx + (w >= d ? t * w * 0.9 : w * 0.36);
      const lz = cz + (w >= d ? d * 0.36 : t * d * 0.9);
      b.cylinder(0.12, 0.15, 8.0, [lx, Y + 4.0, lz], mats.metalMat, 6);
      b.sphere(0.3, [lx, Y + 8.1, lz], neon(0xff9a3c));
    }
  };

  // ── 부두 안쪽 여백 — 야적장 ─────────────────────────────────────────────
  //
  // 이제 133m 짜리 매립지는 **부두 구간에만** 있다 (해안선을 계단으로
  // 만들었다 — `westShoreAt` 머리말). 컨테이너 야드와 순환로 사이에 남는
  // 띠에만 구획을 둔다. 항만이 없는 쪽에는 애초에 땅이 없다.
  {
    const x0 = -PORT_SHORE + 96;   // 크레인·야드 뒤
    const x1 = roadLo - 4;
    const cx = (x0 + x1) / 2;
    const w = x1 - x0;
    const z0 = portZ0 + 24;
    const z1 = portZ0 + 20 + 76 * 4 - 4;   // 크레인 넷이 쓰는 길이
    const n = Math.max(1, Math.round((z1 - z0) / 130));
    for (let i = 0; i < n; i++) {
      const d = (z1 - z0) / n;
      lot(cx, z0 + d * (i + 0.5), w * 0.8, d * 0.78);
    }
  }

  // ── 남은 띠 — 네 면 ─────────────────────────────────────────────────────
  //
  // 20m 밖에 안 되니 야적장은 못 들어간다. **방호 난간과 잡초와 등**만
  // 둔다 — 여기는 쓰는 땅이 아니라 물가에 남은 자투리다.
  // −X 도 부두 아래쪽은 이제 이쪽이다.
  const edges = [
    { alongX: true, fixed: -SHORE + 10, from: roadLo, to: roadHi },
    { alongX: true, fixed: SHORE - 10, from: roadLo, to: roadHi },
    { alongX: false, fixed: roadHi + 10, from: -SHORE + 10, to: SHORE - 10 },
    { alongX: false, fixed: roadLo - 10, from: -SHORE + 10, to: portZ0 },
  ];
  for (const e of edges) {
    const len = e.to - e.from;
    const n = Math.round(len / 34);
    for (let i = 0; i < n; i++) {
      const t = e.from + (len * (i + 0.5)) / n;
      const px = e.alongX ? t : e.fixed;
      const pz = e.alongX ? e.fixed : t;
      // 방호 난간 — 도로와 물 사이를 막는다
      b.box(e.alongX ? 26 : 0.16, 0.7, e.alongX ? 0.16 : 26, [px, Y + 0.55, pz], mats.metalMat);
      for (const sg of [-1, 1]) {
        const qx = px + (e.alongX ? sg * 12 : 0);
        const qz = pz + (e.alongX ? 0 : sg * 12);
        b.box(0.2, 0.9, 0.2, [qx, Y + 0.45, qz], mats.metalMat);
      }
      // 잡초 — 아무도 안 쓰는 땅의 신호다
      if (rng.chance(0.7)) {
        for (let k = 0; k < rng.int(2, 5); k++) {
          const gx = px + rng.range(-12, 12) * (e.alongX ? 1 : 0.3);
          const gz = pz + rng.range(-12, 12) * (e.alongX ? 0.3 : 1);
          b.box(rng.range(0.5, 1.4), rng.range(0.3, 0.8), rng.range(0.5, 1.4),
            [gx, Y + 0.3, gz], mats.foliageMat);
        }
      }
      // 등 — 두 칸 걸러 하나
      if (i % 2 === 0) {
        b.cylinder(0.11, 0.14, 7.0, [px, Y + 3.5, pz], mats.metalMat, 6);
        b.sphere(0.26, [px, Y + 7.1, pz], neon(0xff9a3c));
      }
    }
  }
}

export function createPort(scene, rng, mats) {
  const b = new MeshBuilder('Port', { castShadow: false });

  sea(b, mats);
  embankment(b, mats);
  quay(b, rng, mats);

  // ── 항만을 +Z 쪽으로 몰았다 (사용자 지시) ────────────────────────────────
  //
  // *"부둣가는 2번과 같은 위치에 두기"* — 안벽의 **+Z 절반**이다.
  //
  // 전에는 크레인 다섯이 −317~+317 에 고루 서서 안벽 전체를 덮었다. 그런데
  // 부둣가·공업 구역은 지금 −X 의 **+Z 코너**에 몰려 있다 (district.PLAN).
  // 하역 시설이 그 반대쪽까지 뻗어 있으면 **하역한 짐이 갈 데가 없다** —
  // 크레인 뒤가 주거·번화가였다.
  //
  // 크레인은 **안벽에 붙는다.** 배에서 짐을 집어 올리는 기계이므로 물가에서
  // 멀어지면 아무 의미가 없다. 야드는 그 뒤 부두 안쪽이다.
  const px = -PORT_SHORE + 30;
  const cranes = 4;
  // 야드 깊이(74m)에 맞춰 크레인 간격을 잡는다. 간격이 야드보다 넓으면
  // 그 사이가 빈 땅이 되고, 그 빈 땅이 곧 사용자가 두 번 지적한 것이다.
  const YD = 76;
  const Z0 = PORT_Z0 + 20;
  for (let i = 0; i < cranes; i++) {
    b.mark('crane', `crane#${i}`);
    const z = Z0 + YD * (i + 0.5);
    gantry(b, px, z, -1, rng, mats);
    // 야드 — 크레인과 도시 사이. 부두 폭 안에 들어가야 한다.
    containerYard(b, px + 62, z, 46, YD - 2, rng, mats);
  }

  // 남은 앞마당을 채운다. 여기가 비어 있으면 도시가 빈 접시에 담긴 꼴이다
  b.mark('fixture', 'apron');
  const R = roads();
  apron(b, rng, mats, R[0].lo, R[R.length - 1].hi, Z0);
  b.endMark();

  const group = b.build(scene);
  return { group, cranes, shore: SHORE };
}
