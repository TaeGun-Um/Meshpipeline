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

      // ── 바깥은 바다이거나 폐허다 (docs/city.md 지리) ──────────────────
      // 이 도시는 삼면이 바다인 곶 위에 있다. 원경 건물을 사방에 두르면
      // 도시가 거대 도시권의 일부로 보이는데, 설정은 정반대다 —
      // **세계가 황폐해진 뒤 남은 거의 유일한 도시**다.
      //
      //   물 쪽(-X, ±Z)  아무것도 없다. 수평선뿐이다.
      //   육지 쪽(+X)    폐허. 형태는 있되 **불이 하나도 없다.**
      //
      // 도시의 불빛이 유난히 밝아 보이는 이유가 여기서 나온다. 밝기를
      // 올려서가 아니라 **주변이 완전히 어둡기 때문**이다.
      const onLand = cx > CITY_HALF * 0.35;
      if (!onLand) continue;

      const w = rng.range(ring.size[0], ring.size[1]);
      const d = rng.range(ring.size[0], ring.size[1]);
      const h = rng.range(ring.h[0], ring.h[1]);
      const rect = { x0: cx - w / 2, x1: cx + w / 2, z0: cz - d / 2, z1: cz + d / 2 };

      b.add(rectBox(rect, 0, h, PANEL_TILE), mats.ruinMat);

      // 창문 피부를 붙이지 않는다. 폐허라 불이 없다 — 실루엣만 남는다.
      // 대신 윤곽이 완전히 사라지지 않게 위쪽을 조금 깎아 부서진 티를 낸다.
      if (rng.chance(0.55)) {
        const bite = rng.range(0.1, 0.34);
        const bw = (rect.x1 - rect.x0) * rng.range(0.3, 0.6);
        const bd = (rect.z1 - rect.z0) * rng.range(0.3, 0.6);
        b.box(bw, h * bite, bd,
          [cx + rng.range(-w * 0.2, w * 0.2), h - (h * bite) / 2, cz + rng.range(-d * 0.2, d * 0.2)],
          mats.skyMat);
      }

      count++;
    }
  }

  return { group: b.build(scene), count };
}
