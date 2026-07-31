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

// ── 날씨 ───────────────────────────────────────────────────────────────────
//
// 비를 끄면 도시가 눈에 띄게 밝아진다. 빗줄기 자체가 화면의 밝은 픽셀을
// 가리기도 하지만, 그보다 **젖은 노면**을 전제로 재질을 맞춰 놨기 때문이다 —
// 거칠기를 낮춰 반사로 밝기를 벌던 표면들이 비가 없으면 그냥 어두워진다.
// 그래서 비를 끌 때는 노출도 함께 올려야 한다.
const RAIN = false;
import { buildMaterials } from './materials.js';
import { createSky, createLights } from './env.js';
import { createStreets } from './streets.js';
import { createTowers } from './towers.js';
import { createAlleys } from './alley.js';
import { createVertical, createBridges } from './vertical.js';
import { createParking } from './parking.js';
import { createPort } from './port.js';
import { createCrowd } from './crowd.js';
import { resetPlan, TIER, claim } from './siteplan.js';
import { allAlleyRects, ALLEY_WIDTH, setAlleyRateHook, coreDistance } from './layout.js';
import { districtAt } from './district.js';
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
      // 노출 1.25 -> 1.42. 골목을 넣고 나서 도시 전체가 조금 어둡게 느껴졌다.
      // 블룸은 톤매핑 전 HDR 값을 보므로 노출을 올리면 번짐도 같이 세진다 —
      // 그래서 threshold 를 함께 올려 밝은 것만 번지는 상태를 유지한다.
      render: { exposure: 1.85, shadows: true },
      post: {
        // 0.5 로 두면 발광면이 전부 흰 덩어리로 뭉치고, 1.0 근처면 하나도 번지지
        // 않는다 (emissive 최대가 1.0이므로). 0.72 가 "발광면만 걸리고 형태는
        // 남는" 지점이다.
        bloom: { threshold: 0.92, strength: 0.5, radius: 0.78 },
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

    // ── 지상 배치 계획 ────────────────────────────────────────────────────
    //
    // 지상에 물건을 놓는 모듈이 다섯인데 서로의 존재를 모른 채 각자 놓고
    // 있었다. 가로등이 골목 입구에 박히고, 계단이 점자블록 위로 내려앉고,
    // 자판기가 계단 착지점을 막았다 (siteplan.js 머리말).
    //
    // **놓는 순서 = 우선순위** 다. 아래 순서가 그대로 실제 도시계획의 순서다.
    //   진입 동선(골목 입구) -> 수직 동선(계단·기둥) -> 조명 -> 편의 시설
    resetPlan();

    // layout 이 구역별 골목 밀도를 알 수 있게 연결한다. layout 이 district 를
    // 직접 import 하면 순환 참조가 되므로 함수를 주입하는 쪽을 택했다.
    setAlleyRateHook((ix, iz) =>
      districtAt(ix, iz, coreDistance(blockCenter(ix), blockCenter(iz))).alleyRate
    );

    // 1) 골목 입구를 먼저 비워 둔다. 좌표 해시로 정해지므로 건물을 세우기
    //    전에 알 수 있다. 통로 입구가 막히면 골목 자체가 죽는다.
    for (const a of allAlleyRects()) {
      const r = a.rect;
      const clear = ALLEY_WIDTH / 2 + 2.2;
      if (a.alongX) {
        claim(r.x0, (r.z0 + r.z1) / 2, clear, TIER.ACCESS, 'alleyMouth');
        claim(r.x1, (r.z0 + r.z1) / 2, clear, TIER.ACCESS, 'alleyMouth');
      } else {
        claim((r.x0 + r.x1) / 2, r.z0, clear, TIER.ACCESS, 'alleyMouth');
        claim((r.x0 + r.x1) / 2, r.z1, clear, TIER.ACCESS, 'alleyMouth');
      }
    }

    // 2) 수직 동선을 **가로등보다 먼저** 만든다. 계단 착지점과 데크 기둥은
    //    구조물이라 못 비키므로 자리를 선점해야 한다.
    const vert = await step('2층 데크 · 계단 · 브릿지', 40, () =>
      createVertical(scene, rng, mats, allAlleyRects())
    );
    built.vertical = vert.group;

    // 3) 그 다음이 조명과 노면이다. 가로등은 위 둘이 차지한 자리를 피한다.
    const streets = await step('노면 · 인도 · 가로등 · 신호등', 46, () =>
      createStreets(scene, rng, mats, blocks)
    );
    built.streets = streets.group;

    // 바다·안벽·항만 — 이 도시가 존재하는 이유다. 삼면이 바다인 곶이라
    // 밖으로 못 넓히고, 그 사실이 3기의 밀도와 4기의 증축을 만들었다
    // (docs/city.md 지리).
    const port = await step('바다 · 안벽 · 항만', 52, () => createPort(scene, rng, mats));
    built.port = port.group;

    // 갓길 주차 — 차도가 검은 판으로 보이는 가장 큰 원인이었다.
    // 실제 도시에서 도로 양 끝 차선은 거의 항상 세워둔 차로 차 있고,
    // 보행자가 보는 것은 '도로' 가 아니라 **차의 벽**이다 (parking.js 머리말).
    const parked = await step('갓길 주차', 50, () => createParking(scene, rng, mats));
    built.parking = parked.group;

    const towers = await step('타워 · 포디움 · 세트백 · 크라운', 58, () =>
      createTowers(scene, rng, mats, blocks)
    );
    built.buildings = towers.group;

    // 건물 사이 브릿지 — **towers 다음**이어야 한다. 어떤 건물이 어디에
    // 얼마나 높이 서 있는지를 알아야 양 끝이 실제로 닿는 쌍을 고를 수 있다
    // (vertical.js createBridges 머리말 참고).
    const bridges = await step('건물 사이 브릿지', 60, () =>
      createBridges(scene, rng, mats, towers.anchors)
    );
    built.bridges = bridges.group;

    // 골목 — 블록을 관통하는 좁은 뒷길. 어느 블록에 낼지는 towers 가
    // 필지를 나누면서 함께 정한다 (골목을 먼저 빼야 통로가 된다).
    const alleys = await step('골목 · 뒷골목 설비', 60, () =>
      createAlleys(scene, rng, mats, towers.alleys)
    );
    built.alleys = alleys.group;

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

    // 인파 — 지금까지 이 도시에 사람이 한 명도 없었다. 밀도는 물건의 밀도가
    // 아니라 **사람의 밀도**다 (crowd.js 머리말). 설정상으로도 갈 곳이 없어
    // 몰려든 도시라 사람이 미어터져야 한다.
    const crowd = await step('인파', 74, () => createCrowd(scene, rng, mats));
    built.crowd = crowd.group;

    // 빛 웅덩이는 조명 흉내다. 발광 표면이 주변을 밝히지 않는 문제를 지오메트리로
    // 푼다 — shared/lightpool.js 에 이유가 길게 적혀 있다.
    const pools = await step('빛 웅덩이', 76, () =>
      createLightPools(scene, [
        ...streets.pools,
        ...towers.pools,
        ...signage.pools,
        ...programs.pools,
        ...life.pools,
        ...alleys.pools,
        ...vert.pools,
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

    const rain = RAIN ? await step('비', 95, () => createRain(scene, rng)) : null;
    if (rain) built.rain = rain.group;

    await step('환경광 굽기 (네온 반사)', 97, () =>
      this.bakeEnvironment(scene, renderer, { source: 'scene', intensity: 0.9, far: 4000 })
    );

    return {
      built,
      // 감사(core/audit.js)가 "사라진 것" 을 잡을 수 있게 개수를 넘긴다.
      // 화면을 안 보고도 회귀가 잡히는 유일한 경로다.
      counts: {
        간판: signage.count,
        건물: towers.count,
        사람: crowd.count,
        가로시설: life.count,
        골목: alleys.count,
      },
      stats: [
        `구역 ${towers.districts.join('·')}`,
        `건물 ${towers.count}동`,
        `골목 ${alleys.count}개`,
        `데크 ${vert.decks} · 계단 ${vert.stairs} · 브릿지 ${bridges.count}`,
        `최고 ${towers.tallest.toFixed(0)}m`,
        `공사장 ${programs.tally.construction} · 광장 ${programs.tally.plaza} · 공터 ${programs.tally.lot}`,
        `가로시설 ${life.count}개 · 사람 ${crowd.count}명`,
        `간판 ${signage.count}개`,
        `빛 웅덩이 ${pools.count}개`,
        `차량 ${traffic.count}대 · 주차 ${parked.count}대`,
        `원경 ${skyline.count}동 · 크레인 ${port.cranes}기`,
      ],
      tick(t) {
        traffic.tick(t);
        air.tick(t);
        rain?.tick(t, camera);
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
