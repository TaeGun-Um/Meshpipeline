// 지상 교통.
//
// 도시를 도시로 만드는 마지막 조각. 정지된 건물은 아무리 잘 만들어도 모형이고,
// 위에서 내려다볼 때 도로를 따라 흐르는 흰빛·붉은빛 줄기가 있어야 살아 있는
// 도시로 읽힌다.
//
// ── 왜 InstancedMesh 4개인가 ────────────────────────────────────────────────
// 차 한 대는 재질이 넷이다: 차체(어두움) · 전조등(차가운 발광) · 후미등(붉은 발광)
// · 전조등이 노면에 만드는 빛(가산합성). 재질이 섞인 메시는 인스턴싱할 수 없으므로
// 부위별로 InstancedMesh 를 하나씩 두고 **같은 인스턴스 행렬을 넷 다에 쓴다**.
// 차 96대가 드로우콜 4개로 끝난다. Object3D 96개로 만들면 190 콜이 된다.
//
// 운동은 shared/movers.js 의 Lane 이 맡는다 (공중 교통과 공유).
import * as THREE from 'three';
import { mergeGeometries } from '../../core/meshkit.js';
import { Lane } from '../../shared/movers.js';
import { NEON } from '../../shared/neon.js';
import { neon } from '../../shared/masters.js';
import { CITY_HALF, gridLines } from './layout.js';

const COUNT = 96;
const ROAD_Y = 0.02;
const SPAN = CITY_HALF + 60;

// 차선 중심 오프셋. 22m 도로에 편도 2차로. 부호가 진행 방향을 정한다 —
// 마주 오는 차선이 저절로 생긴다.
const LANES = [-8.0, -3.0, 3.0, 8.0];

// 차종 [길이, 폭, 높이]. 크기가 섞여야 줄지어 가는 게 티나지 않는다.
const KINDS = [
  [4.4, 1.9, 1.35], // 승용
  [5.6, 2.1, 2.0], // 밴
  [9.0, 2.5, 2.9], // 트럭
];

export function createTraffic(scene, rng, mats) {
  const group = new THREE.Group();
  group.name = 'Traffic';

  // 부위별 지오메트리. 차 로컬 좌표: 진행 방향 -Z, 바닥 y=0, 단위 크기.
  // 실제 크기는 인스턴스 행렬의 스케일로 준다.
  const body = box(1, 1, 1, [0, 0.5, 0]);
  const cabin = box(0.82, 0.42, 0.44, [0, 1.0, -0.05]); // 없으면 위에서 볼 때 벽돌이다
  const bodyGeo = mergeGeometries([body, cabin]);

  // 전조등·후미등은 좌우 두 개로 나눈다. 긴 막대 하나로 두면 밤에 차가
  // "떠 있는 흰 막대" 로 보인다 (처음에 그랬다).
  const head = mergeGeometries([
    box(0.2, 0.12, 0.06, [-0.3, 0.42, -0.5]),
    box(0.2, 0.12, 0.06, [0.3, 0.42, -0.5]),
  ]);
  const tail = mergeGeometries([
    box(0.22, 0.1, 0.06, [-0.32, 0.46, 0.5]),
    box(0.22, 0.1, 0.06, [0.32, 0.46, 0.5]),
  ]);

  // 전조등이 노면에 만드는 빛. 차 앞으로 길게 눕힌 사각형.
  const beam = new THREE.PlaneGeometry(2.6, 9);
  beam.rotateX(-Math.PI / 2);
  beam.translate(0, -0.48, -5.2);

  const meshes = [
    instanced(bodyGeo, mats.carBodyMat, 'CarBodies'),
    instanced(head, neon(NEON.cool), 'CarHeadlights'),
    instanced(tail, mats.carTailMat, 'CarTaillights'),
    instanced(beam, mats.beamMat, 'CarBeams'),
  ];
  for (const m of meshes) group.add(m);

  const lines = gridLines();
  const cars = [];
  for (let i = 0; i < COUNT; i++) {
    // 난수를 뽑는 **순서**를 바꾸면 배치가 통째로 달라진다. 시드가 같아도
    // 소비 순서가 다르면 다른 도시가 된다. 리팩터링 중에 이 순서를 바꿔서
    // 스크린샷 회귀 검사가 26% 차이로 실패한 적이 있다. 순서를 고정한다.
    const alongX = rng.chance(0.5);
    const line = lines[rng.int(0, lines.length - 1)];
    const lane = LANES[rng.int(0, LANES.length - 1)];
    const kind = KINDS[rng.chance(0.68) ? 0 : rng.chance(0.6) ? 1 : 2];
    const speed = rng.range(9, 21);
    const phase = rng.range(-CITY_HALF, CITY_HALF);

    cars.push({
      lane: new Lane({
        alongX,
        cross: line + lane,
        alt: ROAD_Y,
        // 차선 부호가 진행 방향 — 마주 오는 차선이 저절로 생긴다
        speed: speed * (lane < 0 ? 1 : -1),
        phase,
        span: SPAN,
      }),
      size: [kind[1], kind[2], kind[0]], // 스케일: 폭, 높이, 길이
    });
  }

  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const pos = new THREE.Vector3();
  const scl = new THREE.Vector3();
  const UP = new THREE.Vector3(0, 1, 0);

  function tick(t) {
    for (let i = 0; i < cars.length; i++) {
      const c = cars[i];
      const p = c.lane.at(t);
      pos.set(p.x, p.y, p.z);
      q.setFromAxisAngle(UP, p.yaw);
      scl.set(c.size[0], c.size[1], c.size[2]);
      m4.compose(pos, q, scl);
      for (const m of meshes) m.setMatrixAt(i, m4);
    }
    for (const m of meshes) m.instanceMatrix.needsUpdate = true;
  }

  tick(0);
  scene.add(group);
  return { group, tick, count: COUNT };

  function instanced(geo, mat, name) {
    const m = new THREE.InstancedMesh(geo, mat, COUNT);
    m.name = name;
    m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    // 인스턴스가 매 프레임 움직이므로 정적 바운딩으로는 컬링이 어긋난다
    m.frustumCulled = false;
    m.castShadow = false;
    m.receiveShadow = false;
    return m;
  }
}

function box(w, h, d, at) {
  const g = new THREE.BoxGeometry(w, h, d);
  g.translate(at[0], at[1], at[2]);
  return g;
}

