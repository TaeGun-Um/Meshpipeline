// 씬 부모 클래스.
//
// 씬은 "장소"를 통째로 소유한다. 하늘·광원·재질·지오메트리·바닥 높이·시작 위치까지.
// main.js 는 장소를 모른다 — 렌더러·카메라·입력·모드 전환·스크린샷 하네스만 맡는다.
// 이 경계 덕분에 씬을 갈아끼워도 조작과 파이프라인 하네스는 손대지 않는다.
//
// ── 서브클래스가 구현하는 것 ────────────────────────────────────────────────
//   surfaceHeight(x, z)     바닥 높이. 캐릭터 물리와 카메라 하한이 매 프레임
//                           두 번 호출하므로 가벼워야 한다.
//   async createWorld(ctx)  실제 조립. { built, colliders, stats, tick } 을 돌려준다.
//                           ctx = { scene, renderer, rng, step, camera }
//
// ── 부모가 해 주는 것 ───────────────────────────────────────────────────────
//   meta 기본값 채우기와 검증 (빠진 필드를 로드 시점에 잡는다)
//   환경맵 굽기 (bakeEnvironment) — 씬마다 손으로 쓰던 20줄
//   build() 오케스트레이션과 결과 형식 보증
import * as THREE from 'three';
import { bakeTextureRepeat } from './meshkit.js';
import { resetSceneState } from './scenestate.js';

const META_DEFAULTS = {
  player: true,
  lens: { fov: 58, near: 0.1, far: 900 },
  render: { exposure: 1.0, shadows: true },
  post: null,
  spawn: [0, 0],
};

export class Scene {
  constructor(meta) {
    for (const k of ['id', 'name', 'seed']) {
      if (meta[k] === undefined) throw new Error(`씬 meta 에 '${k}' 가 없다`);
    }
    if (!meta.camera || !meta.camera.pos) {
      throw new Error(`씬 '${meta.id}': meta.camera.pos 가 없다`);
    }
    this.meta = {
      ...META_DEFAULTS,
      ...meta,
      lens: { ...META_DEFAULTS.lens, ...(meta.lens || {}) },
      render: { ...META_DEFAULTS.render, ...(meta.render || {}) },
    };
    // main.js 가 함수 참조만 넘겨받아도 동작해야 한다 (this 유실 방지)
    this.surfaceHeight = this.surfaceHeight.bind(this);
  }

  // 기본은 평지. 지형이 있는 씬만 덮어쓴다.
  surfaceHeight() {
    return 0;
  }

  // 서브클래스가 반드시 구현한다.
  async createWorld() {
    throw new Error(`씬 '${this.meta.id}': createWorld() 를 구현해야 한다`);
  }

  async build(ctx) {
    // ── 빌드 한 번의 수명을 갖는 상태를 먼저 비운다 ─────────────────────────
    //
    // 씬이 아니라 **부모가** 부른다. 씬마다 "무엇을 비워야 하나" 를 기억하게
    // 하면 새 씬이 반드시 빠뜨리고, 그 결과가 예외가 아니라 이전 씬 잔재가
    // 섞이는 **조용한 오류**다 (core/scenestate.js 머리말).
    resetSceneState();

    const world = await this.createWorld(ctx);
    if (!world || !world.built) {
      throw new Error(`씬 '${this.meta.id}': createWorld() 가 { built } 를 돌려주지 않았다`);
    }
    // 모든 씬에 공통으로 거는 마지막 패스. texture.repeat 를 UV 에 구워
    // glTF 에 KHR_texture_transform 이 붙을 여지를 없앤다. 이미 UV 를 구운
    // 씬(도시)에서는 아무 일도 하지 않는다. 자세한 사정은 meshkit 쪽 주석.
    for (const obj of Object.values(world.built)) {
      if (obj && obj.traverse) bakeTextureRepeat(obj);
    }

    return {
      built: world.built,
      colliders: world.colliders || [],
      stats: world.stats || [],
      // 씬이 신고한 개수. 감사가 "사라진 것" 을 잡는 데 쓴다 (core/audit.js).
      counts: world.counts || {},
      // 배치 검사 결과 (core/placement.js). 관통·부유를 잡는다. 안 하는 씬은 null.
      placement: world.placement || null,
      tick: world.tick || null,
    };
  }

  // ── 환경맵 ───────────────────────────────────────────────────────────────
  //
  // 발광 표면은 래스터라이저에서 **주변을 밝히지 않는다**. 그래서 하늘만 구우면
  // 네온 도시가 통째로 검게 나온다 (실제로 그렇게 나왔다). 완성된 씬 전체로
  // 구우면 PMREM 이 네온을 함께 담아서
  //   - 젖은 노면·유리가 네온 색을 반사하고 (거울 반사)
  //   - MeshStandardMaterial 의 확산 IBL 에도 네온 색이 들어온다 (간접광)
  // 광원을 하나도 늘리지 않고 얻는다. Unity 대응물은 리플렉션 프로브 + 프로브 앰비언트.
  //
  // source:'scene' 은 씬 전체, 'sky' 는 넘긴 하늘돔만 굽는다.
  // 낮 씬은 'sky' 로 충분하다 — 태양이 이미 모든 것을 밝히고 있다.
  //
  // PMREMGenerator.fromScene 은 항상 원점에서 굽는다 (위치 인자가 없다).
  bakeEnvironment(scene, renderer, { source = 'scene', sky = null, intensity = 1, far = 1000 } = {}) {
    const pmrem = new THREE.PMREMGenerator(renderer);

    if (source === 'sky') {
      if (!sky) throw new Error("bakeEnvironment: source:'sky' 인데 sky 가 없다");
      const only = new THREE.Scene();
      only.add(sky.clone());
      scene.environment = pmrem.fromScene(only, 0, 1, far).texture;
    } else {
      // 안개가 켜져 있으면 큐브맵 6면이 전부 안개색이 되어 네온이 묻힌다
      const keepFog = scene.fog;
      scene.fog = null;
      scene.environment = pmrem.fromScene(scene, 0, 1, far).texture;
      scene.fog = keepFog;
    }

    if (intensity !== 1) scene.environmentIntensity = intensity;
    pmrem.dispose();
    return scene.environment;
  }
}
