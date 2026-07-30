// 나이트시티의 재질 묶음.
//
// 전부 마스터 머티리얼에서 instance() 로 뽑는다. 직접 new 하지 않는 이유:
// 값이 같으면 같은 객체가 나와야 드로우콜과 glTF 머티리얼 수가 줄고, 파라미터
// 이름 오타가 즉시 잡힌다 (core/material.js 주석 참고).
import { urbanTextures } from '../../shared/urban/index.js';
import {
  bannerTextures,
  bladeTextures,
  billboardTextures,
  portraitTextures,
} from '../../shared/glyphs.js';
import {
  TexturedSurface,
  SolidSurface,
  NeonTube,
  SoftGlow,
  Beacon,
  Headlight,
  radialFalloff,
} from '../../shared/masters.js';
import { NEON, SIGN_SCHEMES, packRGB } from '../../shared/neon.js';
import { SURFACE } from './palette.js';

// 간판 텍스처는 종류 x 배색 조합 만큼만 굽는다. 요청마다 구우면 수백 장이 된다.
//
// 시드 기준값을 종류마다 명시한다. 종류 이름에서 유도하면(예: kind.length*211)
// 이름을 바꾸는 순간 모든 간판의 글자가 달라진다 — 실제로 리팩터링 중에 그렇게
// 됐고, 저장해 둔 스크린샷과 어긋났다.
const SIGN_KINDS = [
  { kind: 'banner', seed: 9100, make: bannerTextures },
  { kind: 'blade', seed: 9300, make: bladeTextures },
  { kind: 'billboard', seed: 9500, make: billboardTextures },
  // 초대형 인물 광고판 — 타워 한 면을 20~60m 덮는다
  { kind: 'mega', seed: 9700, make: portraitTextures },
];

// 점포 정면 색온도. 순서가 곧 인덱스이고, SHOP_WASH(towers.js)와 짝을 이룬다.
export const SHOP_TINTS = [NEON.warm, NEON.cool, NEON.amber, NEON.pink];

export function buildMaterials() {
  const T = urbanTextures(SURFACE);

  const asphaltSet = T.wetAsphalt();
  const sidewalkSet = T.sidewalk();
  const panelSet = T.concretePanel();
  const tileSet = T.tileWall();
  const shutterSet = T.shutter();

  // 창문 시트는 건물마다 돌려 쓰므로 시드 4개로 굽고 골라 쓴다.
  // 격자를 촘촘히 잡는 이유는 shared/urban/facades.js 의 windowSheet 주석 참고.
  const windowSets = [
    T.windowSheet(8100, { cols: 10, rows: 14, litRate: 0.42 }),
    T.windowSheet(8200, { cols: 9, rows: 16, litRate: 0.34 }),
    T.windowSheet(8300, { cols: 12, rows: 12, litRate: 0.5 }),
    T.windowSheet(8400, { cols: 8, rows: 18, litRate: 0.39 }),
  ];

  // ── 건물 유형별 파사드 ──────────────────────────────────────────────────
  //
  // 모든 건물에 같은 창문 시트를 입혔더니 도시가 "하나의 텍스처가 반복되는 것"
  // 으로 읽혔다. 전부 똑같이 반짝여서 시선이 쉴 곳도, 위계도 없었다.
  //
  // 실제 도시의 건물은 **구조 방식 자체가 다르다.** 유리 커튼월과 펀칭 콘크리트는
  // 창 크기가 다른 정도가 아니라 벽과 창의 관계가 반대다. 그 차이를 텍스처로 만든다.
  //   grid    벽에 창을 뚫은 사무소 — 균형 잡힌 기본형
  //   curtain 유리가 곧 벽. 대부분 어둡고 반사만 한다 → 넓은 어두운 면
  //   punched 벽이 주인공, 창은 작은 구멍 → 넓은 무지 벽면
  //   slab    주거. 창이 작고 촘촘하며 거의 다 켜져 있다
  const curtainSets = [
    T.curtainWall(8500, { floors: 16, bays: 14, floorLit: 0.1, bayLit: 0.09 }),
    T.curtainWall(8560, { floors: 20, bays: 11, floorLit: 0.06, bayLit: 0.05 }),
  ];
  const punchedSets = [
    T.punchedConcrete(8600, { cols: 7, rows: 10, litRate: 0.3 }),
    T.punchedConcrete(8660, { cols: 5, rows: 12, litRate: 0.22 }),
  ];
  // 주거 슬래브 — 창이 촘촘하고 점등률이 높다
  const slabSets = [
    T.windowSheet(8900, { cols: 16, rows: 22, litRate: 0.6 }),
    T.windowSheet(8960, { cols: 14, rows: 26, litRate: 0.54 }),
  ];

  // UV를 지오메트리에 구우므로 (meshkit.scaleUV) 세트당 머티리얼 하나면 된다.
  const surf = (set, normalScale, extra = {}) =>
    TexturedSurface.instance({ set, normalScale, ...extra });

  const matsOf = (sets, name, ns) =>
    sets.map((set, i) => TexturedSurface.instance({ set, normalScale: ns }, `${name}_${i}`));

  const windowMats = matsOf(windowSets, 'Window', 0.6);
  const curtainMats = matsOf(curtainSets, 'Curtain', 0.4);
  const punchedMats = matsOf(punchedSets, 'Punched', 0.9);
  const slabMats = matsOf(slabSets, 'Slab', 0.5);

  const signMats = {};
  for (const { kind, seed, make } of SIGN_KINDS) {
    signMats[kind] = SIGN_SCHEMES.map((scheme, i) =>
      TexturedSurface.instance(
        { set: make(seed + i * 7, scheme), normalScale: 0.5, roughness: 0.55 },
        `Sign_${kind}_${i}`
      )
    );
  }

  // 점포 정면. 같은 텍스처를 밝기 두 등급으로 쓴다 — 구역마다 거리의 밝기가
  // 달라야 대비가 생긴다 (district.js 주석 참고).
  const shopSets = SHOP_TINTS.map((tint, i) => T.shopfront(8700 + i * 20, tint));
  const shopfrontMats = shopSets.map((set, i) =>
    TexturedSurface.instance(
      { set, normalScale: 0.5, roughness: 0.55, emissiveIntensity: 0.42 },
      `Shopfront_${i}`
    )
  );
  const shopfrontBrightMats = shopSets.map((set, i) =>
    TexturedSurface.instance(
      { set, normalScale: 0.5, roughness: 0.55, emissiveIntensity: 1.0 },
      `ShopfrontBright_${i}`
    )
  );

  // 점포 실내 배경. 벽감 안쪽 벽에 붙는다 — 통짜 발광면을 대신한다.
  const interiorMats = SHOP_TINTS.map((tint, i) =>
    TexturedSurface.instance(
      { set: T.shopInterior(8800 + i * 20, tint), normalScale: 0.4, roughness: 0.5 },
      `ShopInterior_${i}`
    )
  );

  return {
    // 건물 유형별 파사드. facade.js 의 ARCHETYPES 와 키가 같아야 한다.
    skins: {
      grid: { sets: windowSets, mats: windowMats, pitch: 1.55 },
      curtain: { sets: curtainSets, mats: curtainMats, pitch: 1.5 },
      punched: { sets: punchedSets, mats: punchedMats, pitch: 2.6 },
      slab: { sets: slabSets, mats: slabMats, pitch: 1.15 },
    },
    windowSets,
    windowMats,
    signMats,
    shopfrontMats,
    shopfrontBrightMats,
    interiorMats,

    // 건물 덩치. 텍스처 반복은 metricBox 가 UV로 만든다.
    panelMat: surf(panelSet, 0.85, {}),
    tileWallMat: surf(tileSet, 0.8),
    shutterMat: surf(shutterSet, 1.1, { metalness: 0.4 }),
    asphaltMat: surf(asphaltSet, 0.85),
    sidewalkMat: surf(sidewalkSet, 0.8),

    curbMat: SolidSurface.instance({ color: packRGB(SURFACE.curb), roughness: 0.82 }, 'Curb'),
    metalMat: SolidSurface.instance(
      { color: packRGB(SURFACE.metal), roughness: 0.5, metalness: 0.55 },
      'Metal'
    ),
    ductMat: SolidSurface.instance(
      { color: packRGB(SURFACE.duct), roughness: 0.62, metalness: 0.35 },
      'Duct'
    ),
    frameMat: SolidSurface.instance({ color: packRGB(SURFACE.frame), roughness: 0.6 }, 'Frame'),
    // 녹슨 철판 — 컨테이너, 드럼통, 낡은 차양
    rustMat: SolidSurface.instance({ color: packRGB(SURFACE.rust), roughness: 0.88 }, 'Rust'),

    // ── 쇼윈도 ──────────────────────────────────────────────────────────
    // 진열장 안쪽 조명. 넓은 면이라 soft 등급.
    glowWarm: SoftGlow.instance({ color: NEON.warm }, 'ShowcaseWarm'),
    glowCool: SoftGlow.instance({ color: NEON.cool }, 'ShowcaseCool'),
    glowMagenta: SoftGlow.instance({ color: NEON.magenta }, 'ShowcaseMagenta'),
    // 진열창 유리 — 거의 검고 아주 매끈해서 거리의 네온을 반사한다.
    // 이 반사가 쇼윈도를 쇼윈도로 만든다.
    vitrineGlassMat: SolidSurface.instance(
      { color: 0x0c0d12, roughness: 0.06, metalness: 0.6, envMapIntensity: 1.8 },
      'VitrineGlass'
    ),
    // 마네킹 — 무광 밝은 회색. 실루엣만 읽히면 된다.
    mannequinMat: SolidSurface.instance({ color: 0x8e8a92, roughness: 0.82 }, 'Mannequin'),
    // 젖은 콘크리트 — 반사가 붙어야 비 온 밤처럼 보인다
    wetConcreteMat: SolidSurface.instance(
      { color: packRGB(SURFACE.concrete), roughness: 0.28, metalness: 0.1 },
      'WetConcrete'
    ),
    // 노면 페인트. 발광이 아니다 — 발광으로 만들면 차선이 네온처럼 빛나서
    // 간판과 위계가 뒤집힌다.
    paintMat: SolidSurface.instance({ color: 0xb9bcc4, roughness: 0.42 }, 'RoadPaint'),

    // ── 블록 용도(공사장·광장·빈 대지)와 가로 시설물이 쓰는 재질 ──────────
    // 가설 펜스. 공사장은 파란 함석이 국제 표준에 가깝고, 그 색 하나로
    // "여기는 공사 중" 이 읽힌다.
    hoardingMat: SolidSurface.instance({ color: 0x1d3f6b, roughness: 0.62 }, 'Hoarding'),
    // 굴착 구덩이 — 빛이 거의 안 닿는 흙
    pitMat: SolidSurface.instance({ color: 0x22201c, roughness: 0.98 }, 'Pit'),
    // 크레인·비계 — 도장된 강재. 주황이 야간에도 실루엣으로 읽힌다.
    craneMat: SolidSurface.instance({ color: 0x8a4a1c, roughness: 0.7, metalness: 0.3 }, 'Crane'),
    // 광장 포장 — 인도와 달라야 광장으로 읽힌다 (밝고 매끈)
    plazaMat: surf(sidewalkSet, 0.5, { roughness: 0.34 }),
    plazaStepMat: SolidSurface.instance({ color: 0x9a96a2, roughness: 0.6 }, 'PlazaStep'),
    // 빈 대지 — 갈라진 아스팔트
    lotMat: surf(asphaltSet, 0.7, { roughness: 0.86 }),
    // 수목. 잎을 하나하나 만들 거리가 아니라 덩어리로 처리한다.
    foliageMat: SolidSurface.instance({ color: 0x1e3524, roughness: 0.95 }, 'Foliage'),
    // 차체는 거의 검고 살짝 반사가 있어야 네온이 지붕에 얹힌다
    carBodyMat: SolidSurface.instance(
      { color: 0x14151c, roughness: 0.32, metalness: 0.55 },
      'CarBody'
    ),

    // 발광은 사용 지점에서 neon() / neonSoft() 로 부른다 — 쓰는 색만 만들어지고
    // 여러 모듈이 같은 색을 요청하면 객체가 공유된다 (shared/masters.js 주석 참고).
    carTailMat: NeonTube.instance({ color: 0xff2a3c }, 'CarTail'),
    beamMat: Headlight.instance({ map: radialFalloff(), color: 0x9fb4d8 }, 'Headlight'),

    // 항공장애등. 위상을 어긋나게 깜빡이려고 세 벌로 나눈다 — 하나로 두면
    // 도시의 모든 마스트가 동시에 깜빡여서 기계처럼 보인다.
    //
    // 세 벌이 필요하므로 같은 색이어도 **다른 객체**여야 한다. 마스터 캐시는
    // 값이 같으면 같은 객체를 돌려주므로, tint 를 아주 미세하게 달리해서
    // 의도적으로 캐시를 비켜 간다 (색차는 눈에 보이지 않는다).
    beacons: [
      Beacon.instance({ color: 0xff2a2a, tint: 0.05 }, 'Beacon_0'),
      Beacon.instance({ color: 0xff2a2a, tint: 0.051 }, 'Beacon_1'),
      Beacon.instance({ color: 0xffffff, tint: 0.05 }, 'Beacon_2'),
    ],
  };
}

