// 씬 2: 나이트시티 (사이버펑크 야간 도시).
//   web/?scene=night-city
//
// 프리 카메라 전용이다 (player:false). 걸어다니는 것이 목적이 아니라 도시를
// 훑는 것이 목적이므로 캐릭터·물리·충돌체를 만들지 않는다.
//
// ── 낮 씬(vacant-lot)과 렌더링이 다른 점 ─────────────────────────────────────
// 파이프라인 1순위 목표가 "엔진에서 브라우저와 같게 보인다" 이므로, 여기 적힌
// 셋은 그대로 엔진 쪽 숙제다.
//
//   1) 블룸 (meta.post.bloom)
//      네온은 번져야 네온이다. 렌더 순서를 지켜야 한다:
//        씬(HDR) → 블룸(HDR) → ACES 톤매핑 → sRGB
//      three 는 렌더 타깃에 그릴 때 머티리얼 톤매핑을 건너뛰고 OutputPass 에서
//      한 번만 적용하므로 EffectComposer 구성만 맞추면 이 순서가 성립한다.
//      Unity 는 기존 ACES 이미지 이펙트 **앞에** 블룸 패스를 넣어야 한다.
//
//   2) 지수 안개 (FogExp2, ρ=0.0014)
//      도시의 거리감이 전부 여기서 나온다. Unity 는 Fog Mode = Exponential Squared.
//
//   3) 씬 전체로 구운 환경맵 + 가산합성 빛 웅덩이
//      발광 표면은 래스터라이저에서 주변을 밝히지 않는다. 하늘만 구우면 도시가
//      통째로 검게 나온다. Unity 대응물은 리플렉션 프로브 + 프로브 앰비언트,
//      그리고 정점 컬러를 받는 가산합성 언릿 셰이더.
import { Scene } from '../../core/scene.js';
import { createLightPools } from '../../shared/lightpool.js';
import { createRain } from '../../shared/rain.js';
import { buildMaterials } from './materials.js';
import { createSky, createLights } from './env.js';
import { createStreets } from './streets.js';
import { createTowers } from './towers.js';
import { createSignage } from './signage.js';
import { createHighway } from './highway.js';
import { createSkyline } from './skyline.js';
import { createTraffic } from './traffic.js';
import { createAirTraffic } from './air.js';
import { GRID, blockCenter, CURB_HEIGHT, blockProgram } from './layout.js';
import { createLandmarks, LANDMARK_BLOCKS } from './landmark.js';
import { createPrograms } from './program.js';
import { createStreetLife } from './streetlife.js';

class NightCity extends Scene {
  constructor() {
    super({
      id: 'night-city',
      name: '나이트시티',
      seed: 20260801,
      player: false,
      // 큰 교차로에서 고가도로가 지나는 쪽을 본다
      camera: { pos: [26, 7.5, 150], target: [-30, 34, -40] },
      lens: { fov: 64, near: 0.4, far: 6000 },
      render: { exposure: 1.25, shadows: true },
      post: {
        // 0.5 로 두면 발광면이 전부 흰 덩어리로 뭉치고, 1.0 근처면 하나도 번지지
        // 않는다 (emissive 최대가 1.0이므로). 0.72 가 "발광면만 걸리고 형태는
        // 남는" 지점이다.
        bloom: { threshold: 0.72, strength: 0.62, radius: 0.8 },
      },
    });
  }

  // 프리캠 전용이라 물리에 쓰이지 않지만, 카메라 하한으로 쓸 수 있다.
  surfaceHeight() {
    return CURB_HEIGHT;
  }

  async createWorld({ scene, renderer, rng, step, camera }) {
    const built = {};

    await step('야간 하늘 · 대기', 4, () => {
      createSky(scene);
      createLights(scene);
    });

    const mats = await step('재질 · 창문 시트 · 간판 텍스처', 30, () => buildMaterials());

    const blocks = blockList();

    const streets = await step('노면 · 인도 · 가로등 · 신호등', 42, () =>
      createStreets(scene, rng, mats, blocks)
    );
    built.streets = streets.group;

    const towers = await step('타워 · 포디움 · 세트백 · 크라운', 58, () =>
      createTowers(scene, rng, mats, blocks)
    );
    built.buildings = towers.group;

    // 타워가 아닌 블록 — 공사장·광장·빈 대지.
    // 빈 곳이 있어야 타워가 높아 보인다 (program.js 주석 참고).
    const programs = await step('공사장 · 광장 · 빈 대지', 63, () =>
      createPrograms(scene, rng, mats, blocks)
    );
    built.programs = programs.group;

    // 랜드마크는 난수로 뽑지 않고 손으로 배치한다 — 통계에서 빼낸 건물이라야
    // 도시에 "저기가 저기다" 가 생긴다 (landmark.js 주석 참고).
    const landmarks = await step('랜드마크', 66, () => createLandmarks(scene, mats));
    built.landmarks = landmarks.group;

    const signage = await step('간판 · 광고판', 70, () =>
      createSignage(scene, towers.signs, mats)
    );
    built.signs = signage.group;

    // 가로 시설물 — 자판기·쉘터·포장마차·배전함·화분. 지상 카메라의 화면
    // 아래 절반을 채우고, 크기를 아는 물건이라 뒤의 건물 스케일도 읽히게 한다.
    const life = await step('가로 시설물', 73, () => createStreetLife(scene, rng, mats));
    built.streetLife = life.group;

    // 빛 웅덩이는 조명 흉내다. 발광 표면이 주변을 밝히지 않는 문제를 지오메트리로
    // 푼다 — shared/lightpool.js 에 이유가 길게 적혀 있다.
    const pools = await step('빛 웅덩이', 76, () =>
      createLightPools(scene, [
        ...streets.pools,
        ...towers.pools,
        ...signage.pools,
        ...programs.pools,
        ...life.pools,
      ])
    );
    built.lightPools = pools.group;

    built.highway = await step('고가도로', 82, () => createHighway(scene, rng, mats));

    const skyline = await step('원경 스카이라인', 88, () => createSkyline(scene, rng, mats));
    built.skyline = skyline.group;

    const traffic = await step('지상 교통', 91, () => createTraffic(scene, rng, mats));
    built.traffic = traffic.group;

    const air = await step('공중 교통', 93, () => createAirTraffic(scene, rng, mats));
    built.air = air.group;

    const rain = await step('비', 95, () => createRain(scene, rng));
    built.rain = rain.group;

    await step('환경광 굽기 (네온 반사)', 97, () =>
      this.bakeEnvironment(scene, renderer, { source: 'scene', intensity: 0.9, far: 4000 })
    );

    return {
      built,
      stats: [
        `구역 ${towers.districts.join('·')}`,
        `건물 ${towers.count}동`,
        `최고 ${towers.tallest.toFixed(0)}m`,
        `공사장 ${programs.tally.construction} · 광장 ${programs.tally.plaza} · 공터 ${programs.tally.lot}`,
        `가로시설 ${life.count}개`,
        `간판 ${signage.count}개`,
        `빛 웅덩이 ${pools.count}개`,
        `차량 ${traffic.count}대`,
        `원경 ${skyline.count}동`,
      ],
      tick(t) {
        traffic.tick(t);
        air.tick(t);
        rain.tick(t, camera);
        // 항공장애등 — 세 벌을 서로 다른 위상으로. 짧게 켜지고 길게 꺼지는
        // 실제 항공등 리듬을 pow 로 만든다.
        //
        // 세기를 emissiveIntensity 가 아니라 **emissive 색**에 실는다.
        // GLTFExporter 는 emissiveIntensity 가 1이 아니기만 하면
        // KHR_materials_emissive_strength 를 붙이는데, 애니메이션 중이면
        // 내보내는 순간의 값이 무엇이든 1이 아니라 항상 붙게 된다.
        // 색에 곱하면 화면은 같고 확장은 안 붙는다 (core/material.js 참고).
        const b = mats.beacons;
        for (let i = 0; i < b.length; i++) {
          const on = Math.pow(Math.max(0, Math.sin(t * 1.6 + (i * Math.PI * 2) / b.length)), 6);
          const k = 0.08 + on * 0.9;
          // 기준색을 한 번만 붙들어 둔다 — 매 프레임 곱하면 색이 0으로 수렴한다
          b[i].userData.baseEmissive ??= b[i].emissive.clone();
          b[i].emissive.copy(b[i].userData.baseEmissive).multiplyScalar(k);
        }
      },
    };
  }
}

function blockList() {
  const reserved = new Set(LANDMARK_BLOCKS.map((l) => `${l.ix},${l.iz}`));
  const out = [];
  for (let ix = 0; ix < GRID; ix++) {
    for (let iz = 0; iz < GRID; iz++) {
      // 랜드마크 블록은 용도 배정에서 뺀다 — 거기엔 이미 손으로 지은 게 있다
      const program = reserved.has(`${ix},${iz}`) ? 'landmark' : blockProgram(ix, iz);
      out.push({ ix, iz, program, cx: blockCenter(ix), cz: blockCenter(iz) });
    }
  }
  return out;
}

export default new NightCity();
