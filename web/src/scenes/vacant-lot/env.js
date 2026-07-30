// 하늘과 광원.
//
// 광원 구성이 야간 도시와 정반대다. 낮은 태양 하나가 전부를 밝히고 나머지는
// 보조지만, 밤 도시는 환경광이 거의 없고 발광 표면이 대부분을 만든다.
// 그 차이가 씬마다 광원 모듈이 따로 있는 이유다.
import * as THREE from 'three';
import { createSkyDome } from '../../shared/sky.js';
import { SKY_STOPS } from './textures.js';

export function createSky(scene) {
  const dome = createSkyDome(scene, SKY_STOPS, {
    radius: 420,
    segments: 32,
    rings: 24,
    gradientHeight: 256,
  });
  // 프리캠으로 높이 올라가면 지형 평면의 끝이 보인다. 안개로 가장자리를 지운다.
  scene.fog = new THREE.Fog(0xd2cdc0, 62, 210);
  return dome;
}

export function createLights(scene) {
  // 광원 세기는 실측으로 맞춘 값이다. three 의 물리 단위(2.5)를 그대로 Unity에
  // 넣으면 +77 과다 노출, π로 나누면 −55.7 과소 노출이 났다.
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
