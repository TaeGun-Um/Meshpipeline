// 야간 도시의 대기와 광원.
//
// ── 광원 예산 ──────────────────────────────────────────────────────────────
// 창문이 수만 개인 도시를 점광원으로 만들 방법은 없고, 엔진 포워드 렌더링은
// 오브젝트당 픽셀 광원이 4개다. 게다가 지오메트리를 큰 메시 몇 개로 병합했으므로
// "오브젝트당 4개" 가 사실상 "씬 전체에 4개" 가 된다.
//
// 그래서 이 씬의 빛은 세 갈래뿐이다.
//   1) 발광 표면 (창문·간판·광고판)     — 물체 자신이 보이게
//   2) 씬 전체로 구운 환경맵            — 그 발광이 다른 표면을 물들이게
//   3) 빛 웅덩이 (가산합성 지오메트리)  — 발광이 바닥·벽을 밝히는 것처럼
// 실제 광원은 방향광 1(달) + 반구광 1, 끝이다.
import * as THREE from 'three';
import { createSkyDome } from '../../shared/sky.js';
import { SKY_STOPS, FOG_COLOR, FOG_DENSITY } from './palette.js';
import { CITY_HALF } from './layout.js';

export function createSky(scene) {
  // 원경 스카이라인(최대 2.4km)보다 커야 한다
  return createSkyDome(scene, SKY_STOPS, { radius: 3600, segments: 40, rings: 24 });
}

export function createLights(scene) {
  scene.fog = new THREE.FogExp2(FOG_COLOR, FOG_DENSITY);

  // 환경광. 위는 청록(하늘 광해), 아래는 자주(네온이 젖은 노면에 반사) —
  // 위아래 색이 달라야 상자 덩어리에 입체가 생긴다.
    // 노출만 올리면 발광면만 타고 그림자 쪽은 그대로 검다. 도시를 밝히려면
  // 환경광을 같이 올려야 '전체적으로 밝아진' 것으로 읽힌다.
  const hemi = new THREE.HemisphereLight(0x4a6ea8, 0x4a2a52, 1.15);
  hemi.name = 'Ambient';
  scene.add(hemi);

  // 달빛. 도시에서 유일한 그림자원.
  // 그림자 카메라가 도시 전체를 덮어야 하므로 범위가 크고, 그만큼 해상도당
  // 실효 정밀도가 떨어진다. 4096 을 써도 픽셀당 13cm 수준이다.
  const moon = new THREE.DirectionalLight(0xa9c2f2, 0.85);
  moon.name = 'Moon';
  moon.position.set(-260, 400, 200);
  moon.castShadow = true;
  moon.shadow.mapSize.set(4096, 4096);
  const s = moon.shadow.camera;
  const r = CITY_HALF * 1.15;
  s.left = -r;
  s.right = r;
  s.top = r;
  s.bottom = -r;
  s.near = 1;
  s.far = 1200;
  moon.shadow.bias = -0.0012;
  moon.shadow.normalBias = 0.06;
  scene.add(moon);

  return { hemi, moon };
}
