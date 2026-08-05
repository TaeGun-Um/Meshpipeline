// 씬 4: 회사 사옥의 사무 층 — 게임 오프닝의 무대.
//   web/?scene=office-sector
//
// 지진 직후, 플레이어가 깨어나 탈출하는 층이다 (docs/scenes/office-sector/
// story.md). 지하 연구시설로 시작했다가 2026-08-05 스토리 확정으로 지상
// 사옥으로 전환했다 — 외벽·창문 등 전환의 형태 작업은 status.md 5.2 에 있다.
// 레퍼런스의 평면도를 베끼지 않는 원칙은 그대로다 (facility.md).
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
import { ductPlan, checkDuct } from './duct.js';
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

    // 실내라 원경이 없다. 안개는 복도 끝을 삼킬 정도면 충분하고,
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
    // lp 를 넘긴다 — 스프링클러가 형광등 자리를 물어보고 비킨다 (props.services)
    const props = await step('소품 · 가구 · 설비', 76, () => createProps(scene, M, lp));
    built.props = props.group;
    // 상호작용 소품 — 물건마다 독립 노드 (props.js interactSet 머리말).
    // 익스포트 조각으로도 따로 나간다 — 유니티가 개별 콜라이더·상태를 단다.
    built.interactables = props.interactables;
    // 약탈 뒤의 열림 포즈. **씬에는 안 붙는다** (화면 비용 0) — 빛 굽기와
    // 익스포트만 태운다. 유니티가 닫힘/열림 노드를 1프레임에 토글한다.
    built.interactables_open = props.open;
    // 시작 방의 전(지진 전) 상태 — 인트로 전용, 같은 수법으로 씬 밖.
    built.startroom_pre = props.pre;
    built.fixtures = await step('등', 82, () => createFixtures(scene, M, lp));

    // ── 조명 ─────────────────────────────────────────────────────────────
    //
    // 이 층은 아무것도 안 움직인다. 광원 40개를 매 프레임 픽셀마다 도는 대신
    // 한 번 구워 정점에 넣는다 (bake.js). 굽고 나면 밝기가 배열로 남으므로
    // **조도 위계를 눈이 아니라 숫자로** 잴 수 있다.
    let bake = null;
    let lights = 0;
    if (BAKED) {
      // interactables_open 은 씬 밖 그룹이지만 같이 굽는다 — bake 는 그룹을
      // 직접 순회하고 지오메트리가 월드 좌표라 씬 소속이 필요 없다. 열림
      // 상태는 열림 포즈 그대로 구워야 상자 속까지 맞는 빛이 든다.
      bake = await step('빛 굽기', 90, () =>
        bakeVertexLight(
          [built.rock, built.floors, built.walls, built.ceilings, built.props,
           built.interactables, built.interactables_open, built.startroom_pre,
           built.fixtures],
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
    // 탈출 루트 — 덕트가 서 있는 것과 길이 이어지는 것은 다르다 (duct.js)
    const duct = checkDuct(ductPlan());
    // 바닥 재질의 반사율까지 넘긴다 — 조도만 재면 어두운 바닥을 깐 방이
    // "밝다" 로 통과한다 (bake.meanAlbedo 주석).
    const albedo = {};
    for (const c of CELLS) albedo[c.id] = meanAlbedo(M.floorOf(c.kind));
    const lum = bake ? checkLighting(bake, albedo) : { faults: [], rows: [], span: 0 };

    const fixtures = lp.fixtures.length;

    // ── 근접 상호작용 프리뷰 (하네스 interact.js) ────────────────────────
    // 닫힘/열림 노드를 이름으로 짝짓는다. 라벨에 없는 종류가 생기면 던진다 —
    // 기본값으로 때우면 힌트에 'undefined' 가 뜬 채 굴러간다.
    const KIND_LABEL = {
      rack: '서버 랙',
      panel: '배전반',
      carton: '골판지 상자',
      crate: '플라스틱 상자',
      desk: '책상 서랍',
      vent: '덕트 점검구',
      locker: '사물함',
      fridge: '냉장고',
    };
    const labelOf = (name) => {
      const l = KIND_LABEL[name.split('_')[0]];
      if (!l) throw new Error(`상호작용 라벨에 '${name}' 의 종류가 없다 — KIND_LABEL 에 추가한다`);
      return `${l} ${name}`;
    };
    const openByName = new Map(props.open.children.map((o) => [o.name, o]));
    const interact = {
      radius: 2.4,
      pairs: props.interactables.children
        .filter((o) => openByName.has(`${o.name}_open`))
        .map((o) => ({
          closed: o,
          open: openByName.get(`${o.name}_open`),
          label: labelOf(o.name),
        })),
    };

    return {
      built,
      interact,
      stats: [
        `칸 ${plan.cells} · 벽 ${walls.runs}구간`,
        `문 ${walls.tally.door + walls.tally.wide + walls.tally.glass} · 덕트 포트 ${duct.ports}`,
        bake
          ? `등 ${fixtures} · 구운 광원 ${lp.emitters.length} · 밝기폭 ${lum.span.toFixed(1)}배`
          : `등 ${fixtures} · 실시간 광원 ${lights}`,
        `소품 ${Object.values(props.tally).reduce((s, v) => s + v, 0)} (개별 노드 ${props.interactCount} · 열림 포즈 ${props.openCount})`,
      ],
      counts: {
        cells: plan.cells,
        doors: walls.tally.door,
        lights: lp.emitters.length,
        interactables: props.interactCount,
        lootPoses: props.openCount,
        ...props.tally,
      },
      placement: {
        faults: [
          ...plan.faults.map((m) => ({ msg: m })),
          ...reach.unreachable.map((id) => ({ msg: `${id} 로 갈 수 없다 — 문이 없다` })),
          ...walls.tally.narrow.map((m) => ({ msg: `${m} 구간이 좁아 문을 못 냈다` })),
          ...interior.faults.map((m) => ({ msg: m })),
          ...duct.faults.map((m) => ({ msg: m })),
          ...lum.faults.map((m) => ({ msg: m })),
        ],
      },
    };
  }
}

export { H, FLOOR };
export default new OfficeSector();
