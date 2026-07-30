// 하늘과 광원.
import * as THREE from 'three';
import * as TEX from '../core/textures.js';

// ── 하늘 · 빛 ──────────────────────────────────────────────────────────────

export function createSky(scene) {
  const tex = TEX.skyTexture();
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(420, 32, 24),
    // fog: false — 안개가 하늘까지 덮으면 그라디언트가 통째로 회색으로 날아간다
    new THREE.MeshBasicMaterial({ map: tex, side: THREE.BackSide, depthWrite: false, fog: false })
  );
  dome.name = 'sky';
  scene.add(dome);
  // 프리캠으로 높이 올라가면 지형 평면의 끝이 보인다. 안개로 가장자리를 지운다.
  scene.fog = new THREE.Fog(0xd2cdc0, 62, 210);
  return dome;
}

export function createLights(scene) {
  const hemi = new THREE.HemisphereLight(0x9dbbdd, 0x6b5b48, 0.42);
  scene.add(hemi);

  const sun = new THREE.DirectionalLight(0xfff0d8, 2.5);
  sun.position.set(26, 28, 20);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  const c = sun.shadow.camera;
  c.left = -36;
  c.right = 36;
  c.top = 36;
  c.bottom = -36;
  c.near = 1;
  c.far = 140;
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.022;
  scene.add(sun);

  // 반대편에서 아주 약하게 채워주는 빛 (그림자 없음)
  const fill = new THREE.DirectionalLight(0xbcd2ee, 0.28);
  fill.position.set(-18, 12, -14);
  scene.add(fill);

  return { hemi, sun, fill };
}
