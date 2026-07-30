// 지형과 도로.
// 높이 함수는 잡초·소품 배치의 기준이라 단일 출처로 여기 둔다.
import * as THREE from 'three';
import { worldFbm, smoothstep } from '../../core/noise.js';
import * as TEX from './textures.js';
import { texMaterial } from './materials.js';


// 공터 경계 (미터)
export const LOT = { minX: -11, maxX: 11, minZ: -9, maxZ: 7 };

const hNoiseA = worldFbm(9001, 15, 4);
const hNoiseB = worldFbm(9002, 3.4, 3);

// 지면 높이. 소품·잡초를 땅에 정확히 앉히려면 모두 이 함수를 써야 한다.
export function groundHeight(x, z) {
  const flat = 1 - smoothstep(5.0, 8.2, z); // 도로 쪽은 평평하게
  const base = (hNoiseA(x, z) - 0.5) * 0.42 + (hNoiseB(x, z) - 0.5) * 0.13;
  const mound = 0.5 * Math.exp(-((x - 5.6) ** 2 + (z + 3.4) ** 2) / 7.0);
  return base * flat + mound * flat;
}

// 캐릭터가 실제로 밟는 높이. 도로 슬래브와 경계석은 지형 위에 얹혀 있으므로
// 지형 높이만 쓰면 아스팔트에 10cm 잠긴 채 걷게 된다.
export function surfaceHeight(x, z) {
  if (Math.abs(z - 7.05) < 0.16 || Math.abs(z - 17.35) < 0.16) return 0.22; // 경계석
  if (z > 7.1 && z < 17.3) return 0.1; // 아스팔트
  return groundHeight(x, z);
}


// ── 지면 · 도로 ────────────────────────────────────────────────────────────

export function createGround(scene) {
  const size = 120;
  const segs = 220;
  const geo = new THREE.PlaneGeometry(size, size, segs, segs);
  geo.rotateX(-Math.PI / 2);

  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    pos.setY(i, groundHeight(x, z));
  }
  geo.computeVertexNormals();

  // 흙은 자갈 디테일이 픽셀 단위로 높이가 튀어서 노말이 거의 수평으로 눕는다.
  // 세게 주면 대부분의 픽셀이 태양 반대쪽을 향해 바닥이 새카맣게 죽는다.
  // (브라우저는 ACES 톤매핑이 들어올려 가려주지만 Unity/블렌더에서는 그대로 드러남)
  const mat = texMaterial(TEX.dirtTextures(), 14, 14, { normalScale: 0.9 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true;
  mesh.name = 'ground';
  scene.add(mesh);
  return mesh;
}

export function createRoad(scene) {
  const group = new THREE.Group();
  group.name = 'road';

  const road = new THREE.Mesh(
    new THREE.BoxGeometry(120, 0.16, 10.2),
    texMaterial(TEX.asphaltTextures(), 16, 1.6)
  );
  road.position.set(0, 0.02, 12.2);
  road.receiveShadow = true;
  group.add(road);

  // 도로 양쪽 경계석
  const curbMat = texMaterial(TEX.blockTextures(), 40, 1, { normalScale: 1.1 });
  for (const cz of [7.05, 17.35]) {
    const curb = new THREE.Mesh(new THREE.BoxGeometry(120, 0.24, 0.3), curbMat);
    curb.position.set(0, 0.1, cz);
    curb.castShadow = true;
    curb.receiveShadow = true;
    group.add(curb);
  }

  scene.add(group);
  return group;
}
