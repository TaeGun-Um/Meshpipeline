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

import { rectBox } from '../../core/boxfaces.js';
import { CITY_SPAN, FLOOR_HEIGHT } from './layout.js';

const WINDOW_PITCH_X = 2.1;
const PANEL_TILE = 9.0;

// ── 원경이 도시 안으로 들어왔다 (사용자 지적) ─────────────────────────────
//
// 원인이 둘이었고, **둘 다 원형과 사각형을 섞은 데서 나왔다.**
//
//   1) 링이 원이고 도시는 정사각이다
//      링 1 의 반경은 511+210=721 인데 `rng.range(0.82, 1.18)` 로 흔들어
//      최소 591 까지 내려간다. 그런데 도시의 **모서리**까지 거리는
//      sqrt(511²+511²) = 723 이다. 즉 대각선 방향에서는 반경 591 이
//      (418, 418) — **도시 한복판**이다. 축 방향만 보면 멀쩡해 보인다.
//
//   2) 육지 판정이 반평면이었다
//      `onLand = cx > CITY_HALF * 0.35` 는 x=179 부터 육지로 쳤다.
//      도시는 x=511 까지 있는데 그 절반 지점부터 폐허를 세운 셈이다.
//      실측: 원경의 가장 서쪽 정점이 x=196 이었다.
//
// 링을 버린다. 내력상 **육지는 +X 한 방향뿐**이므로(삼면이 바다인 곶)
// 원래부터 링일 이유가 없었다. 도시 +X 변 바깥에서 깊이만 나누어 편다.
//
// 여유는 매립 비탈(port.SHORE = CITY_HALF + 34)보다 바깥이어야 한다.
const KEEP_OUT = CITY_SPAN + 90;

// [도시 밖 깊이, 건물 수, 높이 범위, 평면 크기 범위]
const BANDS = [
  { out: 210, count: 34, h: [40, 190], size: [28, 60] },
  { out: 620, count: 44, h: [70, 300], size: [45, 95] },
  { out: 1350, count: 52, h: [110, 420], size: [70, 150] },
];

export function createSkyline(scene, rng, mats) {
  const b = new MeshBuilder('Skyline', { castShadow: false, receiveShadow: false });
  let count = 0;

  for (let ri = 0; ri < BANDS.length; ri++) {
    const band = BANDS[ri];
    const windowIdx = ri % mats.windowSets.length;
    const grid = mats.windowSets[windowIdx].grid;
    const sheetW = grid.cols * WINDOW_PITCH_X;
    const sheetH = grid.rows * FLOOR_HEIGHT;

    for (let i = 0; i < band.count; i++) {
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
      const depth = band.out * rng.range(0.82, 1.18);
      const cx = KEEP_OUT + depth;
      // 멀수록 옆으로도 벌어진다 — 목을 지나 내륙이 열리는 인상.
      // 다만 무한정 벌리면 ±Z 바다 위에 폐허가 뜬다.
      const spread = CITY_SPAN + depth * 0.35;
      const cz = rng.range(-spread, spread);

      const w = rng.range(band.size[0], band.size[1]);
      const d = rng.range(band.size[0], band.size[1]);
      const h = rng.range(band.h[0], band.h[1]);
      const rect = { x0: cx - w / 2, x1: cx + w / 2, z0: cz - d / 2, z1: cz + d / 2 };

      // 마지막 관문. 위 식이면 걸릴 일이 없지만, 이 검사가 없어서 **원경이
      // 도시 한복판에 서 있는 것을 눈으로 볼 때까지 몰랐다.** 남겨 둔다.
      if (rect.x0 < CITY_SPAN && Math.abs(cz) < CITY_SPAN + d / 2) continue;

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

  const group = b.build(scene);

  // ── 스스로 검사한다 ─────────────────────────────────────────────────────
  //
  // 이 결함은 **셋 다 통과했다** — 빌드 성공, 감사 경고 0건, 배치 검사 결함
  // 0건. 원경은 원장(b.mark)에 없으므로 배치 검사의 눈 밖이고, 픽셀 회귀는
  // "달라졌다" 만 말한다. 사용자가 화면을 보고서야 나왔다.
  //
  // 검사를 붙일 곳이 마땅치 않으면 **그리는 쪽이 스스로 확인**하는 것이
  // 다음으로 좋다. 배치 식을 또 바꾸면 여기서 바로 걸린다.
  const box = new THREE.Box3().setFromObject(group);
  if (box.min.x < CITY_SPAN) {
    throw new Error(
      `원경이 도시 안으로 들어왔다: 가장 서쪽 x=${box.min.x.toFixed(0)} < ` +
      `도시 끝 ${CITY_SPAN.toFixed(0)}. 폐허는 육지 쪽(+X) 바깥에만 선다.`
    );
  }

  return { group, count };
}
