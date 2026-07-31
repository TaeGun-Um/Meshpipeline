// 나이트시티의 재질 묶음.
//
// 전부 마스터 머티리얼에서 instance() 로 뽑는다. 직접 new 하지 않는 이유:
// 값이 같으면 같은 객체가 나와야 드로우콜과 glTF 머티리얼 수가 줄고, 파라미터
// 이름 오타가 즉시 잡힌다 (core/material.js 주석 참고).
import * as THREE from 'three';
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
import { NEON, SIGN_SCHEMES, packRGB, rgb255 } from '../../shared/neon.js';
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
  // 골목 벽 — 물 자국·밑동 때·낙서가 들어간 별도 레시피 (urban/surfaces.js)
  const alleyWallSet = T.alleyWall();
  // 잡물건 — 한 레시피에 색만 달리해 셋. 텍스처 장수를 아끼면서
  // 쓰레기통·상자·컨테이너가 서로 다른 물건으로 보이게 한다.
  const dumpsterSet = T.metalCrate(7700, [58, 78, 66]);
  const crateSet = T.metalCrate(7740, [104, 86, 58]);
  const containerSet = T.metalCrate(7780, [52, 70, 96]);
  const tileSet = T.tileWall();
  const shutterSet = T.shutter();

  // 창문 시트는 건물마다 돌려 쓰므로 시드 4개로 굽고 골라 쓴다.
  // 격자를 촘촘히 잡는 이유는 shared/urban/facades.js 의 windowSheet 주석 참고.
  // ── 구역별 창문 시트 ──────────────────────────────────────────────────────
  //
  // 네 장을 **구역 하나씩** 배정한다. 예전에는 넷을 난수로 골라서, 어느 구역에
  // 가도 같은 창이 섞여 나왔다. 인도 폭·시설물·가로등 색을 아무리 다르게 해도
  // 도시가 비슷해 보인 진짜 이유가 이것이다 — 화면의 90% 가 건물 외피다.
  //
  // 색온도와 점등률로 구역의 성격을 만든다.
  //   상업  따뜻한 백색 + 색 창이 많다. 점등률 높음 (밤에도 사람이 있다)
  //   기업  찬 백색 거의 단일. 점등률 높고 균질 (사무실 조명이 층 단위로 켜진다)
  //   주거  노란빛 위주, 점등률 중간, 색 창 약간 (사람마다 다른 조명)
  //   공업  점등률이 가장 낮고 차갑다. 창 자체가 적다 (야간에 비어 있다)
  const W = (c, w) => ({ c: rgb255(c), w });
  const windowSets = [
    // 0 = 상업
    T.windowSheet(8100, { cols: 11, rows: 13, litRate: 0.56, tints: [
      W(NEON.warm, 44), W(NEON.amber, 26), W(NEON.cool, 14),
      W(NEON.magenta, 8), W(NEON.cyan, 5), W(NEON.green, 3),
    ] }),
    // 1 = 기업
    T.windowSheet(8200, { cols: 14, rows: 18, litRate: 0.62, tints: [
      W(NEON.cool, 78), W(NEON.warm, 20), W(NEON.cyan, 2),
    ] }),
    // 2 = 주거
    T.windowSheet(8300, { cols: 9, rows: 15, litRate: 0.40, tints: [
      W(NEON.warm, 62), W(NEON.amber, 24), W(NEON.cool, 11),
      W(NEON.magenta, 2), W(NEON.green, 1),
    ] }),
    // 3 = 공업
    T.windowSheet(8400, { cols: 7, rows: 10, litRate: 0.17, tints: [
      W(NEON.cool, 58), W(NEON.green, 24), W(NEON.amber, 18),
    ] }),
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
    // ── 인도 마감 (sidewalk.js) ──────────────────────────────────────────
    //
    // 전부 평평한 판이라 값이 싸다. 색만으로 구분되므로 서로 **명도 차이**를
    // 확실히 둔다 — 야간 도시라 색상은 네온에 다 묻히고 명도만 남는다.
    curbEdgeMat: SolidSurface.instance({ color: 0xb4b0bc, roughness: 0.66 }, 'CurbEdge'),
    // 측구는 젖어 있다. 거칠기를 낮춰야 네온이 반사돼 '물' 로 읽힌다.
    gutterMat: SolidSurface.instance({ color: 0x14161c, roughness: 0.2 }, 'Gutter'),
    drainMat: SolidSurface.instance({ color: 0x2a2c32, roughness: 0.78, metalness: 0.4 }, 'Drain'),
    // 점자블록 — 인도에서 유일하게 채도가 높은 것. 멀리서도 인도의 위치를 알린다.
    tactileMat: SolidSurface.instance({ color: 0xc9a02e, roughness: 0.72 }, 'Tactile'),
    manholeMat: SolidSurface.instance({ color: 0x33353c, roughness: 0.62, metalness: 0.45 }, 'Manhole'),
    hatchMat: SolidSurface.instance({ color: 0x6e6a74, roughness: 0.7, metalness: 0.3 }, 'Hatch'),
    // 고인 물 — 거의 거울. 젖은 노면의 인상은 색이 아니라 거칠기에서 온다.
    puddleMat: SolidSurface.instance({ color: 0x0d0f14, roughness: 0.06, envMapIntensity: 1.8 }, 'Puddle'),

    // ── 수직 동선 (vertical.js) ──────────────────────────────────────────
    //
    // 데크 밑면 조명. 공중에 뜬 판이 판으로 안 보이려면 **아래를 밝혀야** 한다 —
    // 밑면이 검으면 두께 없는 종잇장으로 읽힌다. soft 등급인 이유는 면적이
    // 넓어서다 (발광 세기는 색이 아니라 면적으로 정한다).
    deckUnderMat: SoftGlow.instance({ color: 0x8fb4d8, intensity: 0.34 }, 'DeckUnder'),
    // 브릿지 통로의 창 띠 — 안에 사람이 다니는 통로로 읽히게 한다.
    bridgeWinMat: SoftGlow.instance({ color: 0xffd7a8, intensity: 0.42 }, 'BridgeWin'),

    // 폐허 원경. 도시 바깥은 육지 쪽만 있고, 거기엔 **불이 하나도 없다.**
    // 도시가 밝아 보이는 것은 밝기를 올려서가 아니라 주변이 어둡기 때문이다.
    // 안개(FogExp2)에 묻혀 실루엣만 남도록 아주 어둡게 둔다.
    ruinMat: SolidSurface.instance({ color: 0x0e1018, roughness: 0.97 }, 'Ruin'),
    // 부서진 자리를 파낼 때 쓰는 '없는 것' 재질. 하늘색과 같아서 구멍처럼 보인다.
    skyMat: SolidSurface.instance({ color: 0x0a0e1c, roughness: 1.0 }, 'SkyCut'),

    // ── 항만 (port.js) ───────────────────────────────────────────────────
    //
    // 바다는 평면 한 장이다. 밤이라 물이 하는 일은 **도시의 빛을 반사하는 것**
    // 뿐이므로 파도가 필요 없다. 거칠기를 거의 0으로 두면 그게 된다.
    seaMat: SolidSurface.instance(
      { color: 0x050a12, roughness: 0.03, metalness: 0.2, envMapIntensity: 2.6 }, 'Sea'
    ),
    // 안벽 — 콘크리트. 물에 잠긴 아래쪽이 어두워야 하지만, 텍스처를 새로
    // 굽는 대신 어두운 단색으로 둔다. 물가라 대부분 그림자에 있다.
    quayMat: SolidSurface.instance({ color: 0x2a2c30, roughness: 0.92 }, 'Quay'),

    // ── 기업 (corpo.js) ──────────────────────────────────────────────────
    //
    // 이 구역의 외벽은 **매끈한 것이 요점**이다. 다시 설계했으므로 배관을
    // 밖으로 뺄 필요가 없었고, 그 매끈함이 이 도시에서 가장 비싼 것이다.
    // 그래서 텍스처가 아니라 단색 + 낮은 거칠기로 만든다 — 얼룩이 없어야 한다.
    corpoSkinMat: SolidSurface.instance(
      { color: 0x1a1f2a, roughness: 0.18, metalness: 0.5, envMapIntensity: 2.2 }, 'CorpoSkin'
    ),
    // 로비. 밤에도 여기만 켜져 있는 것이 기업 건물의 인상이다.
    lobbyLitMat: SoftGlow.instance({ color: 0xdce8ff, intensity: 0.52 }, 'LobbyLit'),
    // 수반. 매립지 도시에서 물이 있다는 것 자체가 사치다.
    waterMat: SolidSurface.instance(
      { color: 0x0a1420, roughness: 0.04, envMapIntensity: 2.4 }, 'PlazaWater'
    ),

    // ── 주거 (housing.js) ────────────────────────────────────────────────
    //
    // 발코니 가림판. 난간이 아니라 **판**이다 — 싸게 짓는 방식이고, 그래서
    // 안이 안 보인다. 색을 벽보다 살짝 밝게 둬야 격자가 읽힌다.
    balconyMat: SolidSurface.instance({ color: 0x6a6a72, roughness: 0.88 }, 'Balcony'),
    // 집 창. 사무실(찬 백색)이나 가게(네온)와 다른 노란빛이다 —
    // 사람이 사는 방의 조명은 늘 따뜻하다.
    homeLitMat: SoftGlow.instance({ color: 0xffcf94, intensity: 0.46 }, 'HomeLit'),
    homeDarkMat: SolidSurface.instance(
      { color: 0x14161c, roughness: 0.24, envMapIntensity: 1.7 }, 'HomeDark'
    ),

    // ── 공업 (factory.js) ────────────────────────────────────────────────
    //
    // 이 구역에 네온은 없다. 빛은 작업등(주황 나트륨)과 채광창으로 새는
    // 실내등뿐이다. 1기의 건물이라 2·3기의 조명 언어를 쓰지 않는다.
    factoryLitMat: SoftGlow.instance({ color: 0xdce4d8, intensity: 0.42 }, 'FactoryLit'),
    factoryDarkMat: SolidSurface.instance(
      { color: 0x1b1f22, roughness: 0.42, envMapIntensity: 1.6 }, 'FactoryDark'
    ),
    // 굴뚝 경고 도색. 채도가 높은 유일한 것인데 네온이 아니라 **페인트**다.
    hazardMat: SolidSurface.instance({ color: 0xc4562a, roughness: 0.86 }, 'Hazard'),

    // ── 골목 ─────────────────────────────────────────────────────────────
    //
    // 골목 재질의 원칙은 **채도를 죽이는 것**이다. 대로는 네온이 색을 다 갖고
    // 있으므로, 골목까지 알록달록하면 위계가 사라져 그냥 좁은 대로가 된다.
    // 색이 있는 것은 빨래 몇 장뿐이고 나머지는 회색·녹슨 갈색 계열이다.
    //
    // ── envMapIntensity 를 올리는 이유 (실측) ──────────────────────────────
    // 처음에는 골목 물건이 전부 새카만 실루엣이었다. 소품이 36,754삼각형이나
    // 들어갔는데 화면에는 형체만 보였다.
    //
    // 원인은 환경맵이다. 씬 전체를 구운 PMREM 은 대로의 네온에서 오는 빛인데,
    // 폭 4.4m 슬롯 안쪽까지는 거의 도달하지 않는다. 광원을 늘려 푸는 문제가
    // 아니다 — 실제 골목도 어둡고, 밝히면 대로와 위계가 뒤집힌다.
    //
    // 이 재질들은 **골목에서만 쓰인다.** 그래서 여기만 환경 반사를 올리면
    // 도시의 나머지는 그대로 두고 골목 물건만 형체가 읽히게 만들 수 있다.
    // "어두운데 보이는" 상태가 목표다.
    alleyFloorMat: surf(asphaltSet, 0.6, { roughness: 0.72, envMapIntensity: 2.0 }),
    // 단색이던 것을 텍스처로 바꿨다. 형태는 잡혀 있었는데 표면이 없어서
    // 실루엣으로만 보인다는 지적이 계속 있었다 (urban/surfaces.js metalCrate).
    dumpsterMat: surf(dumpsterSet, 0.9, { roughness: 0.84, envMapIntensity: 2.6 }),
    crateMat: surf(crateSet, 0.9, { roughness: 0.9, envMapIntensity: 2.6 }),
    crateAltMat: surf(containerSet, 0.9, { roughness: 0.86, envMapIntensity: 2.6 }),
    bagMat: SolidSurface.instance({ color: 0x1a1a1e, roughness: 0.94, envMapIntensity: 2.2 }, 'TrashBag'),
    pipeMat: SolidSurface.instance({ color: 0x55504c, roughness: 0.74, metalness: 0.35, envMapIntensity: 2.8 }, 'Pipe'),
    // 격자 발판. 실제로 구멍을 뚫으면 삼각형이 폭발하므로 어둡고 거친 면으로 흉내낸다 —
    // 비상계단은 늘 역광이라 실루엣만 보이고, 구멍은 어차피 안 읽힌다.
    grateMat: SolidSurface.instance({ color: 0x3a3a3e, roughness: 0.9, metalness: 0.3, envMapIntensity: 2.6 }, 'Grate'),
    serviceDoorMat: SolidSurface.instance({ color: 0x44484e, roughness: 0.7, metalness: 0.25, envMapIntensity: 2.4 }, 'ServiceDoor'),
    // 골목 벽면.
    //
    // 골목 양옆은 원래 건물의 옆면인데, 필지마다 후퇴 거리가 0.35~1.4m 씩
    // 달라서 벽이 들쭉날쭉했고 통로가 아니라 '상자들 사이의 틈' 으로 보였다.
    // 게다가 그 벽은 도시 공용 재질이라 골목만 밝게 조정할 수가 없었다.
    //
    // 그래서 골목 안쪽에 **전용 벽면을 따로 세운다.** 연속된 벽이 생겨 통로가
    // 되고, 재질이 골목 전용이라 환경 반사를 마음대로 올릴 수 있다.
    alleyWallMat: surf(alleyWallSet, 0.6, { roughness: 0.9, envMapIntensity: 2.4 }),

    // 창틀 — 발광 슬릿 뒤에 두면 창이 벽에 뚫린 구멍으로 읽힌다.
    // 이게 없으면 벽에 색종이를 붙인 것처럼 보였다.
    winFrameMat: SolidSurface.instance({ color: 0x0e0e12, roughness: 0.9 }, 'AlleyWinFrame'),
    cableMat: SolidSurface.instance({ color: 0x141416, roughness: 0.95 }, 'Cable'),
    // 빨래 — 골목에서 유일하게 색을 갖는 것. 양면으로 그린다(뒤에서도 보인다).
    laundryMats: [0x8a95a8, 0xa8654f, 0xd8d2c4, 0x4f6b5a, 0x9a7fa0].map((c, i) =>
      SolidSurface.instance({ color: c, roughness: 0.95, side: THREE.DoubleSide }, `Laundry_${i}`)
    ),

    // 골목 벽의 창 불빛. soft 등급이다 — 창이 수백 개라 full 로 두면
    // 블룸이 골목을 통째로 태운다 (발광 세기는 색이 아니라 면적으로 정한다).
    alleyWinWarm: SoftGlow.instance({ color: 0xffc98a, intensity: 0.5 }, 'AlleyWinWarm'),
    alleyWinCool: SoftGlow.instance({ color: 0xa8c4e8, intensity: 0.42 }, 'AlleyWinCool'),

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

