// 인파 — 거리의 사람들.
//
// ── 왜 이게 가장 큰 결함이었나 ─────────────────────────────────────────────
// 지금까지 이 도시에 **사람이 한 명도 없었다.** 그래서 아무리 잘 만들어도
// "잘 만든 빈 도시" 였고, 사이버펑크로 읽히지 않았다.
//
// 레퍼런스에서 카부키가 카부키인 이유는 골목이 좁아서가 아니라 **그 좁은
// 골목에 사람이 꽉 차 있어서**다. 밀도는 물건의 밀도가 아니라 사람의 밀도다.
// 특히 이 도시는 "황폐한 세계에서 갈 곳이 없어 몰려든 곳" 이라는 설정이라
// (docs/city.md), 사람이 미어터지지 않으면 설정 자체가 성립하지 않는다.
//
// ── 왜 값이 싼가 ───────────────────────────────────────────────────────────
// InstancedMesh 다. 지오메트리는 한 벌이고 사람 하나당 행렬 하나다.
// 3천 명을 세워도 지오메트리는 세 벌(체형 셋)뿐이다.
//
// ── 왜 정지해 있어도 되는가 ────────────────────────────────────────────────
// 걷는 애니메이션이 없어도 된다. 밤 거리의 사진을 보면 사람 대부분이
// 멈춰 있거나 흐려져 있다. 중요한 것은 움직임이 아니라 **거기 있다는 사실**과
// 실루엣이다. 자세를 여럿 섞으면 정지해 있어도 어색하지 않다.
//
// ── 형태 원칙 ──────────────────────────────────────────────────────────────
// 사람이 사람으로 읽히는 최소 조건은 **비율**이다. 머리 1 : 몸 3 : 다리 3.5.
// 이 비율만 맞으면 삼각형 60개로도 사람이고, 틀리면 500개를 써도 인형이다.
//
// 그리고 밤이라 대부분 실루엣으로만 보인다. 그래서 옷 색보다 **발광 액센트**가
// 중요하다 — 재킷 트림, 우산 테두리, 손에 든 화면. 그게 사이버펑크의 사람이다.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { NEON } from '../../shared/neon.js';
import { neon } from '../../shared/masters.js';
import {
  roads,
  SIDEWALK_W,
  BLOCK_SIZE,
  CITY_HALF,
  CURB_HEIGHT,
  onIntersection,
  detailAt,
  blockIndexAt,
} from './layout.js';
import { districtAt, byZone } from './district.js';
import { roadOpen, roadOpenZ } from './parcel.js';

// 인도 위 어디까지 사람이 서는가. 연석에서 0.6m, 건물에서 0.5m 는 비운다.
const WALK_IN = 0.6;

// 구역별 밀도 (m 당 사람 수).
//
// 이 숫자가 구역 성격의 절반이다. 번화가에 사람이 없으면 번화가가 아니고,
// 공업지구에 사람이 많으면 공장이 아니다.
// byZone 이 구역을 하나라도 빠뜨리면 터진다 (district.byZone 머리말).
// 전에는 슬럼과 부둣가가 빠진 채 `?? 0.2` 로 넘어갔고, 그래서 컨테이너
// 야드가 밤에 기업 사옥 앞(0.14)보다 붐볐다.
const DENSITY = byZone('사람 밀도', {
  상업: 0.62,  // 어깨가 부딪히는 밀도
  기업: 0.14,  // 퇴근 시간이 지났다. 경비와 늦게 나온 직원뿐
  주거: 0.26,  // 집에 가는 사람들
  공업: 0.05,  // 교대 시간이 아니면 거의 없다
  슬럼: 0.18,  // 사람이 산다. 다만 길이 아니라 골조 안이라 밖은 성기다
  부둣가: 0.02, // 도시에서 가장 비어 있다. 야간 경비와 기사 몇뿐
});

// ── 사람 하나 ──────────────────────────────────────────────────────────────
//
// 로컬 좌표: 발바닥 y=0, 정면 -Z, 키 1.0 (인스턴스 스케일로 실제 키를 준다).
function figure(build) {
  const parts = [];
  const box = (w, h, d, x, y, z) => {
    const g = new THREE.BoxGeometry(w, h, d);
    g.translate(x, y, z);
    return g;
  };

  // 비율 — 머리 1 : 몸 3 : 다리 3.5. 이게 사람으로 읽히는 최소 조건이다.
  const legH = 0.46;
  const torsoH = 0.36;
  const headR = 0.062;

  if (build === 'slim') {
    parts.push(box(0.09, legH, 0.11, -0.055, legH / 2, 0));
    parts.push(box(0.09, legH, 0.11, 0.055, legH / 2, 0));
    parts.push(box(0.26, torsoH, 0.15, 0, legH + torsoH / 2, 0));
    parts.push(box(0.07, 0.3, 0.08, -0.16, legH + torsoH - 0.14, 0));
    parts.push(box(0.07, 0.3, 0.08, 0.16, legH + torsoH - 0.14, 0));
  } else if (build === 'coat') {
    // 롱코트 — 다리가 가려진다. 실루엣이 확 달라서 섞으면 군중이 다양해 보인다.
    parts.push(box(0.32, 0.52, 0.2, 0, 0.26, 0));
    parts.push(box(0.28, torsoH, 0.17, 0, 0.52 + torsoH / 2, 0));
    parts.push(box(0.08, 0.32, 0.09, -0.18, 0.52 + torsoH - 0.16, 0));
    parts.push(box(0.08, 0.32, 0.09, 0.18, 0.52 + torsoH - 0.16, 0));
  } else {
    // 짐 든 사람
    parts.push(box(0.1, legH, 0.12, -0.06, legH / 2, 0));
    parts.push(box(0.1, legH, 0.12, 0.06, legH / 2, 0));
    parts.push(box(0.3, torsoH, 0.18, 0, legH + torsoH / 2, 0));
    parts.push(box(0.08, 0.26, 0.09, -0.19, legH + torsoH - 0.12, 0));
    parts.push(box(0.08, 0.26, 0.09, 0.19, legH + torsoH - 0.12, 0));
    parts.push(box(0.22, 0.2, 0.14, 0.26, legH + 0.16, 0)); // 가방
  }

  // 목 + 머리
  const top = build === 'coat' ? 0.52 + torsoH : legH + torsoH;
  parts.push(box(0.07, 0.05, 0.07, 0, top + 0.025, 0));
  const head = new THREE.SphereGeometry(headR, 6, 5);
  head.scale(1, 1.15, 0.95);
  head.translate(0, top + 0.05 + headR, 0);
  parts.push(head);

  return mergeGeometries(parts);
}

// 발광 액센트 — 재킷 트림. 밤 거리에서 사람을 사람으로 만드는 것은
// 옷 색이 아니라 이 선 하나다.
function trim() {
  const g1 = new THREE.BoxGeometry(0.3, 0.03, 0.19);
  g1.translate(0, 0.7, 0);
  const g2 = new THREE.BoxGeometry(0.03, 0.3, 0.19);
  g2.translate(-0.15, 0.66, 0);
  const g3 = new THREE.BoxGeometry(0.03, 0.3, 0.19);
  g3.translate(0.15, 0.66, 0);
  return mergeGeometries([g1, g2, g3]);
}

function districtNear(x, z) {
  const ix = blockIndexAt(x);
  const iz = blockIndexAt(z);
  return districtAt(ix, iz);
}

export function createCrowd(scene, rng, mats) {
  const group = new THREE.Group();
  group.name = 'Crowd';

  const geos = [figure('slim'), figure('coat'), figure('bag')];
  const trimGeo = trim();

  // 자리를 먼저 전부 뽑고 나중에 인스턴스로 굽는다.
  const spots = [];
  const half = BLOCK_SIZE / 2; // 블록 안 흩뿌림 반경 (경계가 아니라 크기)

  // 인도 양쪽을 훑는다. 인도 폭 안에서 앞뒤로도 흩어뜨려야 줄로 안 보인다.
  //
  // 기준은 격자선이 아니라 **연석**(도로 띠의 lo·hi)이다. 도로 폭이 구간마다
  // 다르고 구간 경계에서는 비대칭이라, 격자선에서 재면 좁은 구간의 사람이
  // 차도 한가운데 선다.
  roads().forEach((r, bi) => {
    for (let t = -CITY_HALF + 6; t < CITY_HALF - 6; t += rng.range(1.1, 3.4)) {
      for (const [curb, s] of [[r.lo, -1], [r.hi, 1]]) {
        for (const axis of [0, 1]) {
          // 병합으로 도로가 없어진 구간에는 인도도 없다 (대지 속이다)
          if (!(axis === 0 ? roadOpenZ(bi, t) : roadOpen(bi, t))) continue;
          // ── 인도 폭은 **구역이 정한다** ────────────────────────────────
          // 전역 SIDEWALK_W(4.6) 를 쓰면 공업 구역(3.2m)에서 사람이 차도에
          // 서고, 기업 구역(7.5m)에서는 인도 절반이 빈다.
          //
          // 같은 실수로 도시 전체 간판이 죽은 적이 있다 (towers.streetFaces).
          // 구역별 값이 있는 상수는 **반드시 구역에서 받아온다.**
          const probe = axis === 0 ? [t, curb + s * 1] : [curb + s * 1, t];
          const D = districtNear(probe[0], probe[1]);
          const walk = D.sidewalk ?? SIDEWALK_W;
          const depth = rng.range(WALK_IN, Math.max(WALK_IN + 0.3, walk - 0.5));
          const off = curb + s * depth; // 연석에서 인도 안쪽으로
          const x = axis === 0 ? t : off;
          const z = axis === 0 ? off : t;
          if (onIntersection(x, z)) continue;
          const dens = (DENSITY[D.name] ?? 0.2) * detailAt(x, z);
          if (!rng.chance(dens)) continue;

          spots.push({
            x, z,
            // 키 1.55~1.9m. 어린이·큰 사람이 섞여야 군중으로 보인다.
            h: rng.range(1.55, 1.9),
            build: rng.int(0, 2),
            // 도로를 등지거나 마주 보거나. 완전 무작위면 어색하다 —
            // 실제로 사람은 길을 따라 서거나 가게를 본다.
            yaw: rng.chance(0.62)
              ? (Math.abs(x - t) < 0.01 ? (s > 0 ? 0 : Math.PI) : (s > 0 ? -Math.PI / 2 : Math.PI / 2))
                + rng.range(-0.5, 0.5)
              : rng.range(0, Math.PI * 2),
            lit: rng.chance(0.22),
            hue: rng.chance(0.4) ? NEON.cyan : rng.chance(0.5) ? NEON.magenta : NEON.amber,
          });
        }
      }
    }
  });

  // 체형별로 인스턴스 메시를 나눈다 (지오메트리가 다르므로).
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const v = new THREE.Vector3();

  for (let b = 0; b < geos.length; b++) {
    const list = spots.filter((s) => s.build === b);
    if (!list.length) continue;
    const mesh = new THREE.InstancedMesh(geos[b], mats.personMat, list.length);
    mesh.name = `People_${b}`;
    mesh.castShadow = true;
    list.forEach((sp, i) => {
      e.set(0, sp.yaw, 0);
      q.setFromEuler(e);
      m.compose(v.set(sp.x, CURB_HEIGHT, sp.z), q, new THREE.Vector3(sp.h, sp.h, sp.h));
      mesh.setMatrixAt(i, m);
    });
    mesh.instanceMatrix.needsUpdate = true;
    group.add(mesh);
  }

  // 발광 트림 — 색깔별로 나눈다. 22% 만 켠다. 전부 켜면 크리스마스 트리다.
  const hues = [NEON.cyan, NEON.magenta, NEON.amber];
  for (const hue of hues) {
    const list = spots.filter((s) => s.lit && s.hue === hue);
    if (!list.length) continue;
    const mesh = new THREE.InstancedMesh(trimGeo, neon(hue), list.length);
    mesh.name = 'PeopleTrim';
    list.forEach((sp, i) => {
      e.set(0, sp.yaw, 0);
      q.setFromEuler(e);
      m.compose(v.set(sp.x, CURB_HEIGHT, sp.z), q, new THREE.Vector3(sp.h, sp.h, sp.h));
      mesh.setMatrixAt(i, m);
    });
    mesh.instanceMatrix.needsUpdate = true;
    group.add(mesh);
  }

  scene.add(group);
  return { group, count: spots.length };
}
