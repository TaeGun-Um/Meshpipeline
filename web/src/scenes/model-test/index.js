// 씬 3: 모델 테스트.
//   web/?scene=model-test  (아무것도 안 붙이면 여기가 뜬다)
//
// 아무것도 없는 바닥과 하늘, 그리고 한가운데 나무 상자 하나. 다음에 무엇을
// 지을지 정해지기 전의 **자리**다.
//
// ── 상자가 왜 있나 ─────────────────────────────────────────────────────────
// 텅 빈 씬은 켜도 켜졌는지 알 수 없다. 정확히 1m 짜리 상자가 하나 서 있으면
// 세 가지가 한눈에 확인된다: 씬이 실제로 빌드됐는지, 스케일이 맞는지
// (1m = 1유닛), 광원과 그림자가 도는지. 앞으로 여기 세울 것의 크기도 이
// 상자에 대고 재면 된다.
//
// ── 프리캠이다 (player:false) ──────────────────────────────────────────────
// 캐릭터·물리·충돌체를 만들지 않는다. 아직 걸어다닐 것이 없고, 모델을 돌려
// 보는 것이 목적이다. 사람 눈높이가 필요해지면 meta 에서 켜면 된다 —
// surfaceHeight() 가 이미 평지를 돌려주고 있어서 그것만으로 걷는다.
import * as THREE from 'three';
import { Scene } from '../../core/scene.js';
import { createSkyDome } from '../../shared/sky.js';
import { TexturedSurface, SolidSurface } from '../../core/material.js';
import { SKY_STOPS, woodTextures } from './textures.js';
import { createCharacter } from './character.js';

// 상자 한 변 (미터). 스케일 기준이므로 딱 떨어지는 값이어야 한다.
const CRATE = 1.0;

// 바닥 한 변. 처음에 120m 로 두고 안개로 가리려 했는데, 안개가 진해지기도
// 전에 평면 모서리가 하늘을 자르며 드러났다 (60m 지점에서 안개는 3%).
// **안개는 먼 것을 지우는 물건이지 가까운 것을 가리는 물건이 아니다** —
// 완전히 잠기는 거리까지 땅을 넓히는 것이 순서다.
const GROUND = 400;
const FOG_NEAR = 45;
const FOG_FAR = 190; // 바닥 모서리(200m)보다 앞에서 하늘색으로 다 잠긴다
const SKY_R = 500; // 하늘돔 반경 — 바닥 대각선(283m)보다 커야 한다

function createLights(scene) {
  // 흐린 날 반사광. 그림자 속이 새카맣게 죽지 않을 만큼만.
  scene.add(new THREE.HemisphereLight(0xbcc9dc, 0x6e6a62, 0.45));

  // 주광. 이 씬의 목적이 형태를 보는 것이므로 정면이 아니라 옆위에서 넣는다 —
  // 정면광은 면과 면의 경계를 지워서 상자를 납작한 사각형으로 만든다.
  //
  // 카메라가 +X+Z 에서 보므로 눈에 드는 면은 +X 와 +Z 둘이다. 광원을 −X+Z 에
  // 두면 그중 하나(+Z)만 밝고 다른 하나(+X)는 그늘이 되어 모서리가 선다.
  // 처음에 +X+Z 쪽(9,12,7)에 뒀더니 두 면 밝기가 같아 상자가 납작했고
  // 그림자도 상자 뒤로 숨었다.
  const key = new THREE.DirectionalLight(0xfff2de, 2.2);
  key.position.set(-6, 9.5, 7);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  const c = key.shadow.camera;
  c.left = -8;
  c.right = 8;
  c.top = 8;
  c.bottom = -8;
  c.near = 1;
  c.far = 40;
  key.shadow.bias = -0.0004;
  key.shadow.normalBias = 0.02;
  scene.add(key);

  // 반대편 채움. 그림자 없음 — 그림자를 두 방향에서 만들면 어느 쪽이
  // 주광인지 알 수 없게 된다.
  const fill = new THREE.DirectionalLight(0xc6d6ec, 0.35);
  fill.position.set(-10, 6, -8);
  scene.add(fill);

  return { key, fill };
}

function createGround(scene) {
  const geo = new THREE.PlaneGeometry(GROUND, GROUND);
  geo.rotateX(-Math.PI / 2);
  // 바닥은 중립 회색이다. 무늬를 넣으면 그 무늬가 위에 올린 것의
  // 재질을 판단하는 기준을 흔든다.
  const mat = SolidSurface.instance({ color: 0x8d8f92, roughness: 0.95 }, 'TestFloor');
  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true;
  mesh.name = 'ground';
  scene.add(mesh);
  return mesh;
}

function createCrate(scene) {
  const group = new THREE.Group();
  group.name = 'crate';

  const mat = TexturedSurface.instance({ set: woodTextures(), repeatX: 1, repeatY: 1 });
  const box = new THREE.Mesh(new THREE.BoxGeometry(CRATE, CRATE, CRATE), mat);
  // 바닥에 **앉힌다.** 중심을 원점에 두면 절반이 지면 아래로 들어가고,
  // 지면 평면은 그 아래를 통째로 가린다.
  // 캐릭터가 원점에 서므로 상자는 옆으로 비킨다. 여전히 1m 자다.
  box.position.set(0.95, CRATE / 2, -0.15);
  box.castShadow = true;
  box.receiveShadow = true;
  box.name = 'crateBox';
  group.add(box);

  scene.add(group);
  return group;
}

class ModelTest extends Scene {
  constructor() {
    super({
      id: 'model-test',
      name: '모델 테스트',
      seed: 20260802,
      player: false,
      // 상자가 화면 한가운데 오도록 잡은 값이다. 상자 중심(y=0.5)을 본다.
      camera: { pos: [2.1, 1.5, 2.9], target: [0, 0.5, 0] },
      lens: { fov: 50, near: 0.05, far: 900 },
      render: { exposure: 1.0, shadows: true },
    });
  }

  // 평지. Scene 의 기본과 같지만 명시해 둔다 — 지형이 생기면 여기부터 고친다.
  surfaceHeight() {
    return 0;
  }

  async createWorld({ scene, renderer, step }) {
    const built = {};

    const dome = await step('하늘 · 광원', 20, () => {
      const d = createSkyDome(scene, SKY_STOPS, {
        radius: SKY_R,
        segments: 32,
        rings: 24,
        gradientHeight: 256,
      });
      // 바닥 평면의 끝을 지운다. 색은 하늘 맨 아래 단(#c8cdd4)에 맞춘다 —
      // 어긋나면 지평선에 색이 다른 띠가 생긴다.
      scene.fog = new THREE.Fog(0xc4ccd6, FOG_NEAR, FOG_FAR);
      createLights(scene);
      return d;
    });

    // 낮 씬이라 하늘돔만 구우면 된다 — 발광 표면이 하나도 없다.
    // (야간 씬은 씬 전체를 구워야 한다. core/scene.js 주석 참고.)
    this.bakeEnvironment(scene, renderer, { source: 'sky', sky: dome, far: SKY_R * 2 });

    built.ground = await step('바닥', 40, () => createGround(scene));
    built.crate = await step('나무 상자', 55, () => createCrate(scene));
    built.character = await step('캐릭터', 92, () => createCharacter(scene));

    let tri = 0;
    built.character.traverse((o) => {
      if (o.isMesh) tri += (o.geometry.index ? o.geometry.index.count : 0) / 3;
    });

    const springs = built.character.userData.springs || [];

    return {
      built,
      stats: [
        `캐릭터 삼각형 ${Math.round(tri).toLocaleString('ko-KR')}`,
        `머리카락 스프링 ${springs.length}줄`,
      ],
      counts: { crate: 1 },
      // dt=0 (스크린샷 하네스) 에서는 스프링이 안 움직인다 — 기준선이
      // 흔들린 상태로 찍히면 회귀 검증이 매번 다르게 나온다.
      tick(t, dt) {
        for (const s of springs) s.update(dt);
      },
    };
  }
}

export default new ModelTest();
