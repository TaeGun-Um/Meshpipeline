// 하늘돔 — 두 씬이 같은 구조를 쓴다.
//
// 그라디언트 텍스처를 안쪽에서 보는 구(BackSide)다. 하늘 셰이더를 따로 쓰지 않는
// 이유: 텍스처 한 장이면 되고, 그 텍스처가 PMREM 환경맵의 재료로도 그대로 쓰인다.
//
// ── fog:false 가 중요하다 ──────────────────────────────────────────────────
// MeshBasicMaterial 은 fog 가 기본으로 켜져 있다. 켜 두면 안개가 하늘돔까지 덮어
// 하늘이 통짜 회색이 된다. 이 프로젝트에서 실제로 겪은 첫 렌더링 버그다.
import * as THREE from 'three';
import { gradientTexture } from '../core/textures.js';
import { Unlit } from '../core/material.js';

// stops           [[0..1 위치, '#rrggbb'], ...]  아래(0)에서 위(1)
// radius          돔 반경. 씬에서 가장 먼 것보다 커야 한다.
// gradientHeight  그라디언트 텍스처 세로 픽셀 수. 야간 도시는 색이 여섯 단이라
//                 512가 필요하지만, 낮 씬은 256으로 충분하다 (기준 스크린샷이
//                 256으로 찍혀 있어서 바꾸면 회귀 검사가 깨진다).
export function createSkyDome(
  scene,
  stops,
  { radius = 400, segments = 32, rings = 20, gradientHeight = 512 } = {}
) {
  const tex = gradientTexture(stops, gradientHeight);
  const geo = new THREE.SphereGeometry(radius, segments, rings);
  const mat = Unlit.instance(
    {
      map: tex,
      side: THREE.BackSide,
      fog: false,
      // 모든 것을 감싸는 돔이라 깊이를 쓸 필요가 없다
      depthWrite: false,
    },
    'SkyDome'
  );
  const dome = new THREE.Mesh(geo, mat);
  dome.name = 'SkyDome';
  scene.add(dome);
  return dome;
}
