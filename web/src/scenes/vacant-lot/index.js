// 씬 1: 한국 주택가 공터 (낮).
//   web/?scene=vacant-lot
//
// 프로젝트의 첫 씬이자 좌표계·조명 규약을 실측으로 확정한 **기준 씬**이다.
// 지금은 활성 씬이 아니지만 보존한다 — 파이프라인 회귀를 재현할 때 쓰고,
// 리팩터링이 렌더 결과를 바꾸지 않았는지 픽셀 단위로 검사하는 기준이 된다.
//   web/shots/baseline_wide.png
import { Scene } from '../../core/scene.js';
import { collectColliders } from '../../controls.js';
import { surfaceHeight, createGround, createRoad } from './terrain.js';
import { buildMaterials } from './materials.js';
import { createSky, createLights } from './env.js';
import { createWalls, createHouses, createPoles } from './structures.js';
import { createWeeds } from './scatter.js';
import { createProps } from './props.js';

export { LOT, groundHeight } from './terrain.js';

class VacantLot extends Scene {
  constructor() {
    super({
      id: 'vacant-lot',
      name: '주택가 공터',
      seed: 20260730,
      spawn: [0, 12.6],
      camera: { pos: [0, 2.0, 17] },
      lens: { fov: 58, near: 0.1, far: 900 },
      render: { exposure: 1.06, shadows: true },
    });
  }

  surfaceHeight(x, z) {
    return surfaceHeight(x, z);
  }

  async createWorld({ scene, renderer, rng, step }) {
    const built = {};

    const dome = await step('하늘 · 광원', 5, () => {
      const d = createSky(scene);
      createLights(scene);
      return d;
    });

    // 낮 씬은 하늘돔만으로 충분하다 — 태양이 이미 모든 것을 밝히고 있다.
    // (야간 씬은 씬 전체를 구워야 한다. core/scene.js 주석 참고.)
    this.bakeEnvironment(scene, renderer, { source: 'sky', sky: dome, far: 1000 });

    const mats = await step('공용 재질', 16, () => buildMaterials(rng));
    built.ground = await step('지형 (흙 · 자갈)', 34, () => createGround(scene));
    built.road = await step('도로 · 경계석', 46, () => createRoad(scene));
    built.walls = await step('담장', 54, () => createWalls(scene, mats));
    built.houses = await step('주택 9채', 68, () => createHouses(scene, rng, mats));
    built.poles = await step('전신주 · 전선', 76, () => createPoles(scene, mats));
    const weeds = await step('잡초', 88, () => createWeeds(scene, rng));
    built.props = await step('소품', 94, () => createProps(scene, rng, mats));
    built.weeds = weeds.mesh;

    return {
      built,
      // 집과 담장만. 전선·전신주는 AABB가 과하게 커서 제외한다.
      colliders: collectColliders([built.houses, built.walls]),
      stats: [`잡초 ${weeds.count.toLocaleString('ko-KR')}포기`],
      tick(t) {
        // 잡초 바람. 정점 셰이더에 주입한 uniform 을 갱신한다.
        if (weeds.mat.userData.shader) weeds.mat.userData.shader.uniforms.uTime.value = t;
      },
    };
  }
}

export default new VacantLot();
