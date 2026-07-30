// 공용 재질. 텍스처 세트를 MeshStandardMaterial로 묶고, 정적 조각들
// (지형·구조물·소품)이 함께 쓰는 머티리얼 묶음을 만든다.
import * as THREE from 'three';
import * as TEX from '../core/textures.js';

export function texMaterial(set, rx, ry, extra = {}) {
  const map = set.map.clone();
  const roughnessMap = set.roughnessMap.clone();
  const normalMap = set.normalMap.clone();
  for (const t of [map, roughnessMap, normalMap]) {
    t.repeat.set(rx, ry);
    t.needsUpdate = true;
  }
  // normalScale은 숫자로 받아서 Vector2로 바꿔준다 (호출부를 단순하게)
  const { normalScale = 1, ...rest } = extra;
  return new THREE.MeshStandardMaterial({
    map,
    roughnessMap,
    normalMap,
    normalScale: new THREE.Vector2(normalScale, normalScale),
    metalness: 0,
    ...rest,
  });
}


// ── 공유 재질 ──────────────────────────────────────────────────────────────

export function buildMaterials(rng) {
  const brickSet = TEX.brickTextures();
  const wallSets = [
    TEX.wallTextures(5101, [212, 205, 190]),
    TEX.wallTextures(5201, [186, 178, 168]),
    TEX.wallTextures(5301, [198, 186, 160]),
  ];
  const roofMats = [
    texMaterial(TEX.roofTextures(5401, [58, 78, 112]), 3, 3, { metalness: 0.25 }),
    texMaterial(TEX.roofTextures(5501, [58, 96, 82]), 3, 3, { metalness: 0.25 }),
    texMaterial(TEX.roofTextures(5601, [120, 66, 58]), 3, 3, { metalness: 0.2 }),
  ];

  return {
    brickSet,
    wallSets,
    roofMats,
    capMat: new THREE.MeshStandardMaterial({ color: 0xada99f, roughness: 0.92 }),
    frameMat: new THREE.MeshStandardMaterial({ color: 0xe8e6e1, roughness: 0.72 }),
    // 유리는 환경맵 반사가 없으면 그냥 검은 구멍으로 보인다 (main.js에서 PMREM 주입)
    glassMat: new THREE.MeshStandardMaterial({
      color: 0x44565f,
      roughness: 0.09,
      metalness: 0.85,
      envMapIntensity: 1.6,
    }),
    railMat: new THREE.MeshStandardMaterial({ color: 0xa8abaf, roughness: 0.55, metalness: 0.35 }),
    shutterMat: new THREE.MeshStandardMaterial({ color: 0x9a9d9c, roughness: 0.55, metalness: 0.4 }),
    tankMat: new THREE.MeshStandardMaterial({ color: 0x2f6fb0, roughness: 0.55 }),
    concreteMat: new THREE.MeshStandardMaterial({ color: 0xa8a49c, roughness: 0.92 }),
    insulatorMat: new THREE.MeshStandardMaterial({ color: 0x4a4f52, roughness: 0.5 }),
    transformerMat: new THREE.MeshStandardMaterial({ color: 0x8e9296, roughness: 0.6, metalness: 0.3 }),
    wireMat: new THREE.MeshStandardMaterial({ color: 0x14161a, roughness: 0.85 }),
  };
}
