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
import { NEON, rgb01 } from '../../shared/neon.js';
import { neon, neonSoft } from '../../shared/masters.js';
import { CITY_HALF, CURB_HEIGHT } from './layout.js';

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
const SHORE = CITY_HALF + 34;
const PORT_SHORE = CITY_HALF + 150; // -X 쪽 (하역 부두)
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

  // 네 변. 육지 쪽(+X)도 비탈을 두되 물이 아니라 폐허로 이어진다.
  const runs = [
    { nx: -1, nz: 0 }, { nx: 1, nz: 0 },
    { nx: 0, nz: -1 }, { nx: 0, nz: 1 },
  ];
  for (const r of runs) {
    const alongX = r.nz !== 0;
    // -X 쪽은 항만 부두라 넓다
    const far = r.nx < 0 ? PORT_SHORE - 1.5 : outer;
    const len = (PORT_SHORE + SHORE);
    const g = new THREE.PlaneGeometry(alongX ? len : far - inner, alongX ? outer - inner : len, 1, 1);
    g.rotateX(-Math.PI / 2);
    // 안쪽 모서리를 도시 높이로, 바깥 모서리를 안벽 높이로 기울인다
    const pos = g.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const along = alongX ? pos.getZ(i) : pos.getX(i);
      // 로컬 좌표에서 +쪽이 바깥이 되도록 부호를 맞춘다
      const outward = (alongX ? r.nz : r.nx) > 0 ? along > 0 : along < 0;
      pos.setY(i, outward ? botY : topY);
    }
    g.computeVertexNormals();
    const mid = (inner + (r.nx < 0 ? PORT_SHORE - 1.5 : outer)) / 2;
    g.translate(r.nx * mid + (alongX ? (SHORE - PORT_SHORE) / 2 : 0), 0, r.nz * ((inner + outer) / 2));
    b.add(g, mats.quayMat);
  }
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

  // 삼면 (−X, −Z, +Z). +X 는 육지로 이어진다.
  const runs = [
    { alongX: false, x: -PORT_SHORE, z: 0, len: SHORE * 2 },
    { alongX: true, x: 0, z: -SHORE, len: PORT_SHORE + SHORE },
    { alongX: true, x: 0, z: SHORE, len: PORT_SHORE + SHORE },
  ];

  for (const r of runs) {
    // 가로 방향 안벽은 -X 쪽이 더 나가 있으므로 중심을 옮긴다
    const cxOff = r.alongX ? (SHORE - PORT_SHORE) / 2 : 0;
    const [w, d] = r.alongX ? [r.len, T] : [T, r.len];
    b.box(w, H, d, [r.x + cxOff, SEA_Y + H / 2, r.z], mats.quayMat);
    // 상단 연석 — 안벽 끝이 눈에 보여야 한다
    const [cw, cd] = r.alongX ? [r.len, T + 0.6] : [T + 0.6, r.len];
    b.box(cw, 0.4, cd, [r.x + cxOff, SEA_Y + H + 0.2, r.z], mats.plazaStepMat);

    // 계선주 — 배를 묶는 쇠기둥. 일정 간격.
    const n = Math.round(r.len / 26);
    for (let i = 0; i < n; i++) {
      const t = -r.len / 2 + (r.len * (i + 0.5)) / n;
      const px = r.alongX ? t + cxOff : r.x - 1.6;
      const pz = r.alongX ? r.z - Math.sign(r.z) * 1.6 : t;
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
      const px = r.alongX ? t + cxOff : r.x + 3.2;
      const pz = r.alongX ? r.z - Math.sign(r.z) * 3.2 : t;
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

export function createPort(scene, rng, mats) {
  const b = new MeshBuilder('Port', { castShadow: false });

  sea(b, mats);
  embankment(b, mats);
  quay(b, rng, mats);

  // 항만은 한 변에 몰아 둔다. 삼면에 다 두면 도시가 항구에 포위된 꼴이고,
  // 실제로도 하역 시설은 수심과 조류 때문에 한 곳에 모인다.
  // 크레인은 **안벽에 붙는다.** 배에서 짐을 집어 올리는 기계이므로 물가에서
  // 멀어지면 아무 의미가 없다. 야드는 그 뒤 부두 안쪽이다.
  // 둘 다 도시 격자(CITY_HALF) 바깥에 있어야 도로·블록과 안 겹친다.
  const px = -PORT_SHORE + 30;
  const cranes = 5;
  for (let i = 0; i < cranes; i++) {
    const z = -CITY_HALF * 0.6 + (CITY_HALF * 1.2 * (i + 0.5)) / cranes;
    gantry(b, px, z, -1, rng, mats);
    // 야드 — 크레인과 도시 사이. 부두 폭 안에 들어가야 한다.
    containerYard(b, px + 62, z, 46, 74, rng, mats);
  }

  const group = b.build(scene);
  return { group, cranes, shore: SHORE };
}
