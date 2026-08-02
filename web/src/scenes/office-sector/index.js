// 씬 4: GATE Cascade Research Facility · Office Sector · Level 1.
//   web/?scene=office-sector
//
// 지하 500m 연구시설의 사무 구역 첫 층. 레퍼런스는 게임 Abiotic Factor 이고,
// **그 게임의 평면도를 베끼지 않는다** — 섹터의 성격과 구성 요소를 참고하고
// 배치는 우리 규칙으로 뽑는다 (docs/scenes/office-sector/facility.md).
//
// ── 앞선 씬들과 무엇이 다른가 ──────────────────────────────────────────────
// 도시(씬 2)는 전부 **외부**였다. 여기는 안이다. 그 차이가 셋을 바꾼다.
//
//   1) 천장이 있다. 방은 닫힌 부피고 여섯 면이 다 보인다
//   2) 벽에 **구멍을 뚫어야** 한다. 판을 붙이기만 하던 것과 다르다
//   3) 하늘도 태양도 없다. **조명이 곧 건축**이고, 광원 개수가 곧 비용이다
//
// 그래서 이 씬은 형태보다 **계측을 먼저** 세웠다. 평면이 겹치는지, 모든 방에
// 갈 수 있는지, 모든 방이 밝은지 — 캐릭터 씬에서 계측 없이 다섯 판을 헤맨
// 것의 반작용이다 (model-test/character.md 0장).
import * as THREE from 'three';
import { Scene } from '../../core/scene.js';
import { buildMaterials } from './materials.js';
import { buildFloors, buildCeilings, buildWalls, buildRock } from './shell.js';
import { lightPlan, createFixtures, createRealLights, createAmbient } from './lights.js';
import { createProps } from './props.js';
import { checkPlan, checkReach, CELLS, H, FLOOR } from './layout.js';
import { checkInterior, checkLighting } from './check.js';
import { BAKED, bakeVertexLight, meanAlbedo } from './bake.js';

class OfficeSector extends Scene {
  constructor() {
    super({
      id: 'office-sector',
      name: '오피스 섹터',
      seed: 20260803,
      player: false,
      // 플라자 한가운데서 카페테리아 쪽을 본다. 천장 5.6m 가 화면에 들어온다.
      camera: { pos: [3.2, 1.7, 4.5], target: [-14, 1.6, 1.0] },
      lens: { fov: 62, near: 0.05, far: 400 },
      render: { exposure: 1.05, shadows: false },
    });
  }

  surfaceHeight() {
    return 0;
  }

  async createWorld({ scene, renderer, step }) {
    const built = {};

    // 형태를 짓기 전에 평면부터 검사한다. 칸이 겹치면 벽 계산이 통째로
    // 틀어지는데, 그건 화면을 봐서는 "좀 이상하다" 로만 보인다.
    const plan = checkPlan();
    if (plan.faults.length) throw new Error(`평면 결함:\n  ${plan.faults.join('\n  ')}`);

    const M = await step('재질', 18, () => buildMaterials());

    // 지하다. 안개로 복도 끝을 지운다 — 창이 없어 원경이 없으므로 옅게.
    // 실내는 원경이 없다. 안개는 복도 끝을 삼킬 정도면 충분하고,
    // 세게 주면 8m 앞 벽까지 뿌예져 공간이 좁아 보인다.
    scene.fog = new THREE.FogExp2(0x0b0d12, 0.012);
    scene.background = new THREE.Color(0x05060a);

    // 등과 광원의 자리. **여기 하나에서 패널·굽기·실시간 광원이 다 나온다.**
    const lp = lightPlan();

    built.rock = await step('암반', 28, () => buildRock(scene, M));
    built.floors = await step('바닥', 40, () => buildFloors(scene, M));
    const walls = await step('벽 · 문 · 유리', 56, () => buildWalls(scene, M));
    built.walls = walls.group;
    built.ceilings = await step('천장', 66, () => buildCeilings(scene, M));
    const props = await step('소품 · 가구 · 설비', 76, () => createProps(scene, M));
    built.props = props.group;
    built.fixtures = await step('등', 82, () => createFixtures(scene, M, lp));

    // ── 조명 ─────────────────────────────────────────────────────────────
    //
    // 이 층은 아무것도 안 움직인다. 광원 40개를 매 프레임 픽셀마다 도는 대신
    // 한 번 구워 정점에 넣는다 (bake.js). 굽고 나면 밝기가 배열로 남으므로
    // **조도 위계를 눈이 아니라 숫자로** 잴 수 있다.
    let bake = null;
    let lights = 0;
    if (BAKED) {
      bake = await step('빛 굽기', 90, () =>
        bakeVertexLight(
          [built.rock, built.floors, built.walls, built.ceilings, built.props, built.fixtures],
          lp
        )
      );
    } else {
      lights = createRealLights(scene, lp);
    }
    createAmbient(scene, BAKED);

    // 발광면이 주변을 밝히지 않으므로 **씬 전체를 구워** 환경맵으로 되먹인다.
    // 도시에서 네온에 쓴 것과 같은 수법이다 (core/scene.js 주석).
    await step('환경맵', 95, () =>
      this.bakeEnvironment(scene, renderer, { source: 'scene', intensity: 0.9, far: 90 })
    );

    const reach = checkReach();
    const interior = checkInterior(lp);
    // 바닥 재질의 반사율까지 넘긴다 — 조도만 재면 어두운 바닥을 깐 방이
    // "밝다" 로 통과한다 (bake.meanAlbedo 주석).
    const albedo = {};
    for (const c of CELLS) albedo[c.id] = meanAlbedo(M.floorOf(c.kind));
    const lum = bake ? checkLighting(bake, albedo) : { faults: [], rows: [], span: 0 };

    const fixtures = lp.fixtures.length;
    return {
      built,
      stats: [
        `칸 ${plan.cells} · 벽 ${walls.runs}구간`,
        `문 ${walls.tally.door + walls.tally.wide + walls.tally.glass}`,
        bake
          ? `등 ${fixtures} · 구운 광원 ${lp.emitters.length} · 밝기폭 ${lum.span.toFixed(1)}배`
          : `등 ${fixtures} · 실시간 광원 ${lights}`,
        `소품 ${Object.values(props.tally).reduce((s, v) => s + v, 0)}`,
      ],
      counts: {
        cells: plan.cells,
        doors: walls.tally.door,
        lights: lp.emitters.length,
        ...props.tally,
      },
      placement: {
        faults: [
          ...plan.faults.map((m) => ({ msg: m })),
          ...reach.unreachable.map((id) => ({ msg: `${id} 로 갈 수 없다 — 문이 없다` })),
          ...walls.tally.narrow.map((m) => ({ msg: `${m} 구간이 좁아 문을 못 냈다` })),
          ...interior.faults.map((m) => ({ msg: m })),
          ...lum.faults.map((m) => ({ msg: m })),
        ],
      },
    };
  }
}

export { H, FLOOR };
export default new OfficeSector();
