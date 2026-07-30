// 공중 교통.
//
// 형상은 거의 중요하지 않다. 이 거리에서 보이는 것은 앞뒤 등화(燈火)뿐이라
// 동체는 실루엣만 있으면 되고, 나머지는 발광 점 몇 개가 다 한다.
// 멀리 있는 것이 느리게 지나가면 거리가 읽힌다 — 스케일과 생명을 동시에 준다.
//
// 지상 교통과 달리 대수가 적어서(26대) 인스턴싱하지 않고 Mesh 를 복제한다.
// Mesh.clone 은 지오메트리·머티리얼을 공유하므로 비용이 거의 없다.
import * as THREE from 'three';
import { MeshBuilder } from '../../core/builder.js';
import { Lane } from '../../shared/movers.js';
import { NEON } from '../../shared/neon.js';
import { neon } from '../../shared/masters.js';
import { CITY_HALF } from './layout.js';

const COUNT = 26;
const SPAN = CITY_HALF + 700; // 항로 절반 길이. 밖에서 들어와 밖으로 나간다.

// 차량 하나. 진행 방향은 로컬 -Z (shared/movers.js 의 규약).
function vehiclePrototype(mats) {
  const b = new MeshBuilder('AirVehicle', { castShadow: false, receiveShadow: false });
  b.box(2.0, 0.62, 5.2, [0, 0, 0], mats.frameMat); // 동체
  b.box(4.6, 0.16, 1.1, [0, -0.05, 0.4], mats.frameMat); // 날개 겸 등화 지지대
  b.box(1.1, 0.2, 0.2, [0, 0.02, -2.6], neon(NEON.cool)); // 전조등
  b.box(1.5, 0.22, 0.2, [0, 0.05, 2.6], neon(NEON.pink)); // 후미등
  b.box(0.3, 0.2, 0.3, [-2.3, -0.05, 0.4], neon(NEON.green)); // 좌 항법등
  b.box(0.3, 0.2, 0.3, [2.3, -0.05, 0.4], neon(NEON.amber)); // 우 항법등

  const group = b.build();
  const mesh = group.children[0];
  // 작고 빠르게 움직여 프러스텀 컬링 판정이 어긋나기 쉽다
  mesh.frustumCulled = false;
  return mesh;
}

export function createAirTraffic(scene, rng, mats) {
  const group = new THREE.Group();
  group.name = 'AirTraffic';

  const proto = vehiclePrototype(mats);
  const fleet = [];

  for (let i = 0; i < COUNT; i++) {
    const mesh = i === 0 ? proto : proto.clone();

    // 난수 소비 순서를 고정한다. 시드가 같아도 순서가 다르면 다른 배치가 된다
    // (traffic.js 의 같은 주석 참고).
    const alongX = rng.chance(0.5); // 한 축만 쓰면 줄지어 가는 게 티난다
    const cross = rng.range(-CITY_HALF - 120, CITY_HALF + 120); // 도로 격자와 무관하게
    const alt = rng.range(38, 210);
    const speed = rng.range(16, 46) * (rng.chance(0.5) ? 1 : -1);
    const phase = rng.range(-SPAN, SPAN);
    const bobPhase = rng.range(0, Math.PI * 2);
    const scale = rng.range(0.8, 2.4); // 고도가 높을수록 큰 기체

    mesh.scale.setScalar(scale);
    fleet.push({
      mesh,
      lane: new Lane({ alongX, cross, alt, speed, phase, span: SPAN, bobAmp: 1.4, bobPhase }),
    });
    group.add(mesh);
  }

  scene.add(group);

  function tick(t) {
    for (const f of fleet) {
      const p = f.lane.at(t);
      f.mesh.position.set(p.x, p.y, p.z);
      f.mesh.rotation.set(0, p.yaw, 0);
    }
  }

  tick(0);
  return { group, tick, count: COUNT };
}
