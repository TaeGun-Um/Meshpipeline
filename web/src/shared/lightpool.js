// 빛 웅덩이 — 바닥·벽에 깔리는 가산합성 광원 흉내.
//
// ── 왜 이게 필요한가 ────────────────────────────────────────────────────────
// 야간 씬의 빛은 대부분 emissive 표면이다. 그런데 발광 표면은 래스터라이저에서
// **주변을 밝히지 않는다**. 그래서 간판은 빛나는데 그 아래 노면은 새카맣다.
// 실제로 첫 렌더에서 도로가 완전히 검게 나왔다.
//
// 광원을 늘려서 해결할 수 없다. 가로등만 150개고, Unity Built-in 포워드
// 렌더링은 오브젝트당 픽셀 광원이 4개다. 게다가 지오메트리를 큰 메시 몇 개로
// 병합했으므로 "오브젝트당 4개" 가 사실상 "씬 전체에 4개" 가 된다.
//
// 그래서 빛을 계산하지 않고 **그린다**. 방사형 감쇠 텍스처를 가산합성으로 깔면
// 젖은 노면에 빛이 고인 것처럼 보인다. 동적 조명 이전 게임들이 쓴 방법이고,
// 어느 엔진으로 가져가도 "가산합성 언릿 셰이더" 하나면 된다.
//
// ── 왜 정점 컬러인가 ────────────────────────────────────────────────────────
// 웅덩이마다 색이 다르다 (가로등은 차가운 흰색, 간판 아래는 그 간판 색).
// 머티리얼 색으로 구분하면 색 수만큼 드로우콜이 생긴다. 색을 정점에 실으면
// 수백 개가 머티리얼 하나 · 드로우콜 하나로 끝난다.
import { MeshBuilder } from '../core/builder.js';
import { upPlane } from '../core/boxfaces.js';
import * as THREE from 'three';
import { LightPool, radialFalloff } from './masters.js';

// 웅덩이 하나의 서술자
//   { kind: 'floor', x, y, z, rx, rz, tint }        바닥에 눕힌 타원
//   { kind: 'wall',  x, y, z, w, h, yaw, tint }     벽에 붙인 사각형
//
// tint 는 [r,g,b] 0..1. 가산합성이므로 이 값이 곧 밝기다.
export function createLightPools(scene, pools, { name = 'LightPools' } = {}) {
  const mat = LightPool.instance({ map: radialFalloff() });

  const b = new MeshBuilder(name, {
    castShadow: false,
    receiveShadow: false,
    // 가산합성 면은 불투명 지오메트리 뒤에 그려야 한다
    renderOrder: 2,
    attributes: [{ name: 'color', itemSize: 3, from: 'tint' }],
  });

  for (const p of pools) {
    if (p.kind === 'wall') {
      const g = new THREE.PlaneGeometry(p.w, p.h);
      g.rotateY(p.yaw);
      g.translate(p.x, p.y, p.z);
      b.add(g, mat, { tint: p.tint });
    } else {
      b.add(upPlane(p.rx * 2, p.rz * 2, [p.x, p.y, p.z]), mat, { tint: p.tint });
    }
  }

  const group = b.build(scene);
  return { group, count: b.count };
}
