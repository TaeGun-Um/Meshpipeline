// 갓길 주차 — 연석에 붙어 세워진 차량.
//
// ── 왜 필요한가 ────────────────────────────────────────────────────────────
// 차도가 **검은 판**으로 보이는 가장 큰 이유다. 지금 도로에는 주행 차량 96대와
// 차선 페인트뿐이고, 폭 22m 의 대부분이 아무것도 없는 아스팔트다.
//
// 실제 도시에서 도로의 양 끝 차선은 거의 항상 세워둔 차로 차 있다. 그래서
// 실질 주행 폭은 좁고, 보행자가 보는 것은 "도로" 가 아니라 **차의 벽**이다.
// 이 차이가 거리의 밀도를 만든다.
//
// ── 왜 값이 싼가 ───────────────────────────────────────────────────────────
// 차량 지오메트리를 traffic.js 와 **똑같이** 만들고 InstancedMesh 로 그린다.
// 인스턴스 하나당 삼각형이 아니라 행렬 하나다. 200대를 세워도 지오메트리는
// 한 벌이다.
//
// 다만 주행 차량과 달리 전조등·빛기둥은 없다 — 세워둔 차는 불이 꺼져 있다.
// 후미등만 일부 켜 둔다 (막 세운 차, 사람이 탄 차).
//
// ── 배치 원칙 ──────────────────────────────────────────────────────────────
// 아무 데나 세우면 안 된다. 실제 주차 금지 구역이 그대로 규칙이 된다.
//
//   · 교차로 근처 (시야 확보)          -> 비운다
//   · 횡단보도 앞뒤                     -> 비운다
//   · 골목 입구                         -> 비운다 (배치 계획이 이미 안다)
//   · 버스 쉘터 앞                      -> 비운다
//   · 소화전 앞                         -> 해당 없음 (아직 소화전이 없다)
//
// 앞의 셋은 siteplan 이 이미 알고 있으므로 그대로 물어본다. 이게 배치 계획을
// 만들어 둔 값이다 — 새 모듈이 기존 규칙을 공짜로 물려받는다.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

import {
  CITY_HALF,
  roads,
  onIntersection,
  blockIndexAt,
} from './layout.js';
import { districtAt, byZone } from './district.js';
import { claim, TIER } from './siteplan.js';
import { roadOpen, roadOpenZ } from './parcel.js';

// 갓길 차선 — **연석에서 안쪽으로** 이만큼.
//
// ── 왜 도로 반폭에서 재지 않는가 (실측으로 고침) ──────────────────────────
// 전에는 `STREET_WIDTH / 2 - 1.4` 로 격자선에서 쟀다. 도로 반폭이 항상
// 11m 라고 믿은 것이다. 그런데 구간별 격자가 들어온 뒤로 도로 폭은
// 8·15·16·22·38m 로 갈라졌고, 피치 74 구간의 실제 반폭은 **4m** 였다.
//
// 그래서 차가 5.6m 씩 인도 안으로 들어가 건물 밑에 섰다. 배치 검사가
// **1,978대 중 1,137대(57%)** 를 그렇게 찾아냈다.
//
// 연석에서 재면 도로가 넓든 좁든, 구간 경계에서 비대칭이든 항상 맞는다.
const MAX_CAR_W = 2.1;
const CURB_GAP = MAX_CAR_W / 2 + 0.35;

// 이보다 좁은 길에는 세우지 않는다.
//
// 8m 짜리 1차 매립지 길에 양쪽 주차를 하면 남는 차로가 3m 뿐이라 차가 못
// 지나간다. 실제로 오래된 좁은 길이 그렇고, **거기에 차가 없다는 것 자체가**
// 그 구역의 성격이다 (docs/city.md 1기 — 마차가 다니던 시절의 길).
const MIN_ROAD_FOR_PARKING = 13;
// 교차로에서 이만큼은 비운다. 실제 도로교통법의 주정차 금지 거리와 비슷하다.
const CLEAR_INTERSECTION = 16;

// 구역별 주차 밀도. 걸어봤을 때 구역이 달라진 것을 차의 밀도로도 느끼게 한다.
//   기업   지하·전용 주차장으로 들어간다. 갓길이 비어 있다.
//   상업   가장 빽빽하다. 배달·손님 차가 늘 붙어 있다.
//   공업   대형 차량이 드문드문.
// byZone 이 강제한다 (district.byZone 머리말). 전에는 슬럼·부둣가가 빠진 채
// `?? 0.5` 라 부둣가가 주거 다음으로 빽빽했다.
const DENSITY = byZone('갓길 주차', {
  상업: 0.82, 기업: 0.22, 주거: 0.66, 공업: 0.44,
  슬럼: 0.12,   // 차를 살 형편이 아니다. 있는 것도 굴러가는지 모른다
  부둣가: 0.06, // 여기 서는 것은 승용차가 아니라 트레일러다 (야드 안에 있다)
});

// 차 크기. 세단 · 밴 · 소형. 주행 차량보다 종류를 늘린다 —
// 세워둔 차는 오래 보게 되므로 전부 같은 실루엣이면 바로 티가 난다.
const SIZES = [
  { w: 1.9, h: 1.42, d: 4.5 }, // 세단
  { w: 2.0, h: 2.05, d: 5.3 }, // 밴
  { w: 1.75, h: 1.4, d: 3.9 }, // 소형
  { w: 2.1, h: 1.6, d: 5.0 }, // SUV
];

function box(w, h, d, at) {
  const g = new THREE.BoxGeometry(w, h, d);
  g.translate(at[0], at[1], at[2]);
  return g;
}

export function createParking(scene, rng, mats) {
  const group = new THREE.Group();
  group.name = 'Parking';

  // traffic.js 와 같은 로컬 좌표계: 진행 방향 -Z, 바닥 y=0, 단위 크기.
  const bodyGeo = mergeGeometries([
    box(1, 1, 1, [0, 0.5, 0]),
    box(0.82, 0.42, 0.44, [0, 1.0, -0.05]),
  ]);
  const tail = mergeGeometries([
    box(0.22, 0.1, 0.06, [-0.32, 0.46, 0.5]),
    box(0.22, 0.1, 0.06, [0.32, 0.46, 0.5]),
  ]);

  const spots = [];
  const rs = roads();

  // 도로를 따라 훑으며 자리를 잡는다. 간격은 차 길이 + 앞뒤 여유.
  const scan = (alongX) => {
    rs.forEach((r, bi) => {
      // 좁은 길에는 갓길 주차가 없다
      if (r.width < MIN_ROAD_FOR_PARKING) return;
      // 양쪽 연석에서 안쪽으로
      const lanes = [r.lo + CURB_GAP, r.hi - CURB_GAP];

      for (let t = -CITY_HALF + 10; t < CITY_HALF - 10; ) {
        const size = SIZES[rng.int(0, SIZES.length - 1)];
        const step = size.d + rng.range(0.9, 2.6);

        for (let li = 0; li < 2; li++) {
          const s = li === 0 ? -1 : 1;
          const lane = lanes[li];
          const x = alongX ? t : lane;
          const z = alongX ? lane : t;

          // 병합으로 도로가 없어진 구간에는 세울 자리 자체가 없다
          if (!(alongX ? roadOpenZ(bi, t) : roadOpen(bi, t))) continue;
          // 교차로 근처는 비운다
          if (onIntersection(alongX ? t : lane, alongX ? lane : t)) continue;
          // t 는 도로를 따라간 위치이고 교차 도로는 rs 다.
          // 가장 가까운 교차로까지의 거리가 기준보다 짧으면 비운다.
          let nearCross = Infinity;
          for (const cr of rs) nearCross = Math.min(nearCross, Math.abs(t - cr.mid));
          if (nearCross < CLEAR_INTERSECTION) continue;

          // 구역이 정한 밀도
          const ix = blockIndexAt(x);
          const iz = blockIndexAt(z);
          const D = districtAt(ix, iz);
          if (!rng.chance(DENSITY[D.name] ?? 0.5)) continue;

          // 배치 계획에 묻는다. 골목 입구·계단 착지점 앞에는 못 세운다.
          // 새 모듈이 기존 규칙을 공짜로 물려받는 지점이다.
          if (!claim(x, z, size.d / 2, TIER.AMENITY, 'parkedCar')) continue;

          spots.push({
            x, z, size,
            // ── 차머리 방향 ────────────────────────────────────────────
            // 차의 로컬 진행 방향은 **-Z** 이고 스케일의 d 가 Z축 길이다
            // (traffic.js 와 같은 규약). Y축 회전 θ 는 (0,0,-1) 을
            // (-sinθ, 0, -cosθ) 로 보낸다.
            //
            //   도로가 X 를 따라 뻗으면  -> θ = ∓π/2 (차 길이가 X 에 눕는다)
            //   도로가 Z 를 따라 뻗으면  -> θ = 0 또는 π
            //
            // 처음에 이 둘을 **반대로** 썼다. 그 결과 차가 도로를 가로질러
            // 서서 인도까지 밀고 들어갔다. 길이 4.5~5.3m 가 폭 방향으로
            // 놓였으니 연석(11m)을 넘는 게 당연했다.
            //
            // 양쪽 갓길은 서로 반대 방향을 본다 — 실제로 그렇다.
            yaw: alongX ? (s > 0 ? -Math.PI / 2 : Math.PI / 2) : (s > 0 ? 0 : Math.PI),
            // 연석과 완전히 나란하지는 않다 — 사람이 세운 차는 늘 조금 비뚤다
            skew: rng.range(-0.045, 0.045),
            lit: rng.chance(0.12), // 후미등이 켜진 차 (막 세웠거나 사람이 탄 차)
          });
        }
        t += step;
      }
    });
  };
  scan(true);
  scan(false);

  const bodies = new THREE.InstancedMesh(bodyGeo, mats.carBodyMat, spots.length);
  bodies.name = 'ParkedBodies';
  bodies.castShadow = true;
  bodies.receiveShadow = true;

  const litCount = spots.filter((s) => s.lit).length;
  const tails = new THREE.InstancedMesh(tail, mats.carTailMat, Math.max(1, litCount));
  tails.name = 'ParkedTaillights';

  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  let li = 0;

  spots.forEach((sp, i) => {
    e.set(0, sp.yaw + sp.skew, 0);
    q.setFromEuler(e);
    m.compose(
      new THREE.Vector3(sp.x, 0, sp.z),
      q,
      new THREE.Vector3(sp.size.w, sp.size.h, sp.size.d)
    );
    bodies.setMatrixAt(i, m);
    if (sp.lit && li < tails.count) tails.setMatrixAt(li++, m);
  });
  // 남는 인스턴스는 원점에 0 크기로 숨긴다 (count 를 줄이면 행렬이 어긋난다)
  for (let k = li; k < tails.count; k++) {
    m.compose(new THREE.Vector3(0, -50, 0), q, new THREE.Vector3(0.0001, 0.0001, 0.0001));
    tails.setMatrixAt(k, m);
  }
  bodies.instanceMatrix.needsUpdate = true;
  tails.instanceMatrix.needsUpdate = true;

  group.add(bodies, tails);
  scene.add(group);
  return { group, count: spots.length };
}
