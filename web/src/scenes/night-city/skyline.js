// 원경 스카이라인.
//
// 상세 격자는 한 변 528m 다. 그 밖을 비워 두면 도시가 무대 세트처럼 뚝 끊기고,
// 조금만 고도를 올려도 경계가 그대로 보인다. 그래서 밖으로 세 겹의 실루엣 링을
// 두른다 — 멀어질수록 크고, 성기고, 안개에 잠긴다.
//
// 원경은 형상이 아니라 **실루엣과 발광 밀도**만 기여한다. 그래서
//   - 세트백·처마·간판 없음. 상자 + 도심을 향한 두 면의 창문 피부
//   - 그림자를 만들지도 받지도 않는다 (그림자맵은 상세 격자에 다 써야 한다)
import * as THREE from 'three';
import { MeshBuilder } from '../../core/builder.js';
import { scaleUV } from '../../core/meshkit.js';
import { rectBox } from '../../core/boxfaces.js';
import { CITY_HALF, FLOOR_HEIGHT } from './layout.js';

const WINDOW_PITCH_X = 2.1;
const PANEL_TILE = 9.0;

// [링 반경, 건물 수, 높이 범위, 평면 크기 범위]
const RINGS = [
  { radius: CITY_HALF + 210, count: 34, h: [40, 190], size: [28, 60] },
  { radius: CITY_HALF + 620, count: 44, h: [70, 300], size: [45, 95] },
  { radius: CITY_HALF + 1350, count: 52, h: [110, 420], size: [70, 150] },
];

export function createSkyline(scene, rng, mats) {
  const b = new MeshBuilder('Skyline', { castShadow: false, receiveShadow: false });
  let count = 0;

  for (let ri = 0; ri < RINGS.length; ri++) {
    const ring = RINGS[ri];
    const windowIdx = ri % mats.windowSets.length;
    const grid = mats.windowSets[windowIdx].grid;
    const sheetW = grid.cols * WINDOW_PITCH_X;
    const sheetH = grid.rows * FLOOR_HEIGHT;

    for (let i = 0; i < ring.count; i++) {
      // 각도를 균등 분할하고 흔들어야 링처럼 보이지 않는다
      const a = (i / ring.count) * Math.PI * 2 + rng.range(-0.055, 0.055);
      const rad = ring.radius * rng.range(0.82, 1.18);
      const cx = Math.cos(a) * rad;
      const cz = Math.sin(a) * rad;

      const w = rng.range(ring.size[0], ring.size[1]);
      const d = rng.range(ring.size[0], ring.size[1]);
      const h = rng.range(ring.h[0], ring.h[1]);
      const rect = { x0: cx - w / 2, x1: cx + w / 2, z0: cz - d / 2, z1: cz + d / 2 };

      b.add(rectBox(rect, 0, h, PANEL_TILE), mats.panelMat);

      // 도심을 향한 두 면에만 창문 피부. 카메라는 항상 링 안쪽에 있으므로
      // 어느 면이 도심을 향하는지는 중심 좌표의 부호로 정해진다.
      for (const side of [cx > 0 ? 'nx' : 'px', cz > 0 ? 'nz' : 'pz']) {
        const onX = side === 'nx' || side === 'px';
        const width = onX ? d : w;
        const g = new THREE.PlaneGeometry(width, h - 2);
        scaleUV(g, width / sheetW, (h - 2) / sheetH);
        if (side === 'px') {
          g.rotateY(Math.PI / 2);
          g.translate(cx + w / 2 + 0.05, h / 2, cz);
        } else if (side === 'nx') {
          g.rotateY(-Math.PI / 2);
          g.translate(cx - w / 2 - 0.05, h / 2, cz);
        } else if (side === 'pz') {
          g.translate(cx, h / 2, cz + d / 2 + 0.05);
        } else {
          g.rotateY(Math.PI);
          g.translate(cx, h / 2, cz - d / 2 - 0.05);
        }
        b.add(g, mats.windowMats[windowIdx]);
      }

      // 초고층에는 항공장애등만
      if (h > 240) {
        b.sphere(1.4, [cx, h + 1.4, cz], mats.beacons[i % mats.beacons.length], 6, 5);
      }
      count++;
    }
  }

  return { group: b.build(scene), count };
}
