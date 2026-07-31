// 구역(district).
//
// ── 왜 필요한가 ────────────────────────────────────────────────────────────
// 건물 유형과 매싱을 늘려도 도시가 "심심한" 이유는, 어느 방향으로 가도 통계가
// 같기 때문이다. 걸어도 새로운 게 안 나오면 탐험할 이유가 없다.
//
// 탐험감은 **구역마다 성격이 다를 때** 생긴다. 여기는 밝고 시끄럽고, 저기는
// 어둡고 조용하다는 걸 몇 걸음 만에 알 수 있어야 "저쪽은 뭐지" 가 된다.
//
// ── 밝기 위계가 핵심이다 ───────────────────────────────────────────────────
// 지금까지는 도시 전체가 균일하게 어두웠다. 그러면 밝은 곳이 없는 게 아니라
// **밝음 자체가 존재하지 않는다.** 상업 구역을 눈이 부시게 밝히고 공업 구역을
// 거의 캄캄하게 두면, 같은 광원 예산으로 대비가 생긴다.
//
// ── 구역은 뭉쳐 있어야 한다 ────────────────────────────────────────────────
// 블록마다 독립적으로 뽑으면 체스판이 되어 오히려 균일해진다. 2x2 블록 단위로
// 묶어서 구역이 덩어리로 형성되게 한다.
import { hash2 } from '../../core/textures.js';
import { NEON } from '../../shared/neon.js';

export const DISTRICTS = {
  // 슬럼 — 짓다 만 기업 개발지에 사람이 들어간 곳 (2기 -> 3기).
  //
  // 판자촌이 아니다. **못 지은 것이 아니라 짓다 만 것**이고, 그래서 크고
  // 골조가 노출돼 있다. 기업 구역의 매끈한 유리탑과 같은 2기의 산물인데
  // 하나는 완성됐고 하나는 버려졌다 — 그 대비가 이 도시를 설명한다.
  slum: {
    name: '슬럼',
    // 격자를 안 따른다. 이 구역만 건물이 비스듬히 앉는다 (slum.js).
    skin: 2,
    lamp: 0xff8a4c,   // 나트륨등이 몇 개 남았다. 대부분 꺼졌다
    trim: [NEON.amber, NEON.warm],
    signDensity: 0.35,
    retrofit: 1.9,    // 가장 지저분하다
    bladeChance: 0.2,
    shopLit: 0.4,
    shopBright: 0,
    poolGain: 0.6,
    heightBias: -0.15,
    archetype: { grid: 0.4, curtain: 0, punched: 1.0, slab: 1.4, exo: 0.3 },
    // ── 도시 형태 ──────────────────────────────────────────────────────
    sidewalk: 2.6,    // 가장 좁다. 인도라기보다 건물이 물러난 자리다
    grain: 0,         // 통짜 한 덩어리 — 기업이 필지를 사 모았기 때문이다
    alleyRate: 0.8,   // 골목 천지. 계획이 없으므로 틈이 전부 길이다
    furniture: { vending: 0.5, shelter: 0.2, stall: 1.6, utility: 2.2, planter: 0, bins: 3.0, bollard: 0 },
  },

  // 상업 — 재팬타운. 이 도시에서 가장 밝고 시끄러운 곳.
  // 간판이 벽을 뒤덮고 골목까지 빛이 넘친다. 탐험의 목적지.
  market: {
    name: '상업',
    // 창문 시트 번호. 구역마다 고정이다 — 난수로 고르면 어느 구역에
    // 가도 같은 창이 섞여 나와서 도시가 통째로 비슷해 보인다.
    skin: 0,
    // 가로 시설물 가중치 (streetlife.js). 지금까지는 7종이 모든 구역에
    // 균등하게 나왔다 — 그러면 구역이 달라도 인도는 똑같다.
    // 레퍼런스에서 구역을 가르는 것은 **무엇이 있느냐보다 무엇이 없느냐**다.
    furniture: { vending: 3.0, shelter: 1.0, stall: 3.2, utility: 1.0, planter: 1.2, bins: 2.4, bollard: 1.0 },
    // 가로등 색. **가장 값싸고 효과가 큰 구역 차이다.**
    // 레퍼런스에서 공업지구의 주황 나트륨등은 네온이 하나도 없어도
    // 그곳을 그곳으로 만든다 (docs/districts.md 3.4 참고).
    lamp: 0xffe3c2,   // 따뜻한 백색 — 상점 조명이 거리를 물들인다
    // ── 도시 형태 ──────────────────────────────────────────────────────
    // 구역이 밝기와 간판만 정하면, 걸어봤을 때 **같은 도시의 다른 조명**
    // 일 뿐이다. 번화가가 번화가로 느껴지는 이유는 색이 아니라 형태다 —
    // 필지가 잘고, 인도가 넓고, 골목이 많고, 저층이 붙어 있다.
    sidewalk: 6.2,   // 인도 폭(m). 노점과 사람이 넘칠 자리가 필요하다
    grain: 3,        // 필지 분할 깊이. 클수록 잘게 쪼개진다
    alleyRate: 0.72, // 골목이 날 확률. 재팬타운은 골목 천지다
    trim: [NEON.magenta, NEON.cyan, NEON.pink, NEON.amber, NEON.violet],
    signDensity: 3.2,
    // 파사드 설비 밀도 (retrofit.js). 기업은 깨끗하고 공업·주거는 지저분하다 —
    // 이 차이가 구역을 스카이라인이 아니라 **표면**에서도 읽히게 만든다.
    retrofit: 1.5,
    bladeChance: 0.85, // 돌출 세로 간판
    shopLit: 0.94, // 점포가 켜져 있을 확률
    shopBright: 1.0, // 점포 발광 등급 (0=soft, 1=bright)
    poolGain: 2.1, // 바닥 빛 웅덩이 세기 배수
    heightBias: -0.25, // 저층 위주
    archetype: { grid: 1.0, curtain: 0.15, punched: 0.5, slab: 1.6, exo: 0 },
  },

  // 기업 — 코포 플라자. 크고 차갑고 정돈됨.
  // 간판이 적은 대신 하나하나가 거대하다. 유리와 흰빛.
  corpo: {
    name: '기업',
    // 창문 시트 번호. 구역마다 고정이다 — 난수로 고르면 어느 구역에
    // 가도 같은 창이 섞여 나와서 도시가 통째로 비슷해 보인다.
    skin: 1,
    // 기업: 포장마차 없음(노점 금지), 배전함 없음(지중화), 화분은 조형된 것으로 많이.
    furniture: { vending: 1.0, shelter: 2.2, stall: 0, utility: 0, planter: 3.4, bins: 1.2, bollard: 2.6 },
    lamp: 0xd8e8ff,   // 차가운 백색 5600K — 기업 표준 조명
    // ── 도시 형태 ──────────────────────────────────────────────────────
    // 기업 구역은 정반대다. 한 필지에 한 동, 넓은 광장식 인도,
    // 골목 없음. '뒷길이 없다' 는 것 자체가 기업 구역의 성격이다.
    sidewalk: 7.5,
    grain: 0,        // 통짜 한 동
    alleyRate: 0.10,
    trim: [NEON.cool, NEON.blue, NEON.cyan],
    signDensity: 0.5,
    // 파사드 설비 밀도 (retrofit.js). 기업은 깨끗하고 공업·주거는 지저분하다 —
    // 이 차이가 구역을 스카이라인이 아니라 **표면**에서도 읽히게 만든다.
    retrofit: 0.35,
    bladeChance: 0.12,
    shopLit: 0.7,
    shopBright: 0.55,
    poolGain: 1.15,
    heightBias: 0.55, // 초고층
    archetype: { grid: 0.8, curtain: 3.0, punched: 0.2, slab: 0.1, exo: 1.4 },
  },

  // 주거 — 메가빌딩. 창은 많이 켜져 있지만 거리는 어둡다.
  residential: {
    name: '주거',
    // 창문 시트 번호. 구역마다 고정이다 — 난수로 고르면 어느 구역에
    // 가도 같은 창이 섞여 나와서 도시가 통째로 비슷해 보인다.
    skin: 2,
    furniture: { vending: 1.2, shelter: 1.2, stall: 0.5, utility: 3.0, planter: 0.6, bins: 1.6, bollard: 0.4 },
    lamp: 0xffd28a,  // 노란빛 3000K — 오래된 가로등
    // ── 도시 형태 ──────────────────────────────────────────────────────
    sidewalk: 4.0,   // 좁다. 차가 주인인 거리
    grain: 2,
    alleyRate: 0.62, // 주거 뒷골목 — 쓰레기와 실외기의 세계
    trim: [NEON.warm, NEON.amber, NEON.green],
    signDensity: 1.0,
    // 파사드 설비 밀도 (retrofit.js). 기업은 깨끗하고 공업·주거는 지저분하다 —
    // 이 차이가 구역을 스카이라인이 아니라 **표면**에서도 읽히게 만든다.
    retrofit: 1.4,
    bladeChance: 0.3,
    shopLit: 0.72,
    shopBright: 0.3,
    poolGain: 0.9,
    heightBias: 0,
    archetype: { grid: 0.9, curtain: 0.2, punched: 0.8, slab: 3.0, exo: 0 },
  },

  // 공업 — 거의 캄캄하다. 여기가 어두워야 상업 구역이 밝아 보인다.
  industrial: {
    name: '공업',
    // 창문 시트 번호. 구역마다 고정이다 — 난수로 고르면 어느 구역에
    // 가도 같은 창이 섞여 나와서 도시가 통째로 비슷해 보인다.
    skin: 3,
    // 공업: 사람을 위한 것이 거의 없다. 배전함과 쓰레기통뿐.
    furniture: { vending: 0.4, shelter: 0.3, stall: 0, utility: 3.6, planter: 0, bins: 0.8, bollard: 0 },
    lamp: 0xff9a3c,  // 주황 나트륨등 — 공업지구의 정체성 그 자체
    // ── 도시 형태 ──────────────────────────────────────────────────────
    sidewalk: 3.2,   // 가장 좁다. 보행자를 고려하지 않은 구역
    grain: 1,        // 큰 창고 덩어리
    alleyRate: 0.45,
    trim: [NEON.amber, NEON.pink],
    signDensity: 0.28,
    // 파사드 설비 밀도 (retrofit.js). 기업은 깨끗하고 공업·주거는 지저분하다 —
    // 이 차이가 구역을 스카이라인이 아니라 **표면**에서도 읽히게 만든다.
    retrofit: 1.8,
    bladeChance: 0.1,
    shopLit: 0.3,
    shopBright: 0.2,
    poolGain: 0.45,
    heightBias: -0.4,
    archetype: { grid: 0.7, curtain: 0.1, punched: 3.0, slab: 0.5, exo: 0 },
  },
};

const KEYS = ['market', 'corpo', 'residential', 'industrial', 'slum'];

// 2x2 블록을 한 구역으로 묶는다. 도심 코어는 기업 구역이 되기 쉽고,
// 바깥은 공업·주거가 되기 쉽다 — 실제 도시의 지대(地代) 구조를 흉내낸다.
// 블록 하나의 구역. 좌표 해시라 언제 불러도 같은 답이 나온다 —
// 그래서 layout(필지 분할) 과 towers(외관) 가 각자 불러도 어긋나지 않는다.
export function districtAt(ix, iz, core) {
  // ── 구역이 덩어리로 뭉치는 단위 ──────────────────────────────────────────
  // 3x3 블록을 한 덩어리로 본다. 예전에는 2x2 였는데, 격자를 12x12 로 늘리고
  // 나니 구역이 잘게 흩어져서 "여기가 어느 구역인지" 가 안 읽혔다.
  // 구역은 **동네**여야 한다 — 한 블록짜리 구역은 그냥 다른 건물일 뿐이다.
  // ── 구역이 뭉치는 단위 ──────────────────────────────────────────────────
  // 3 -> 4 블록. 3 으로는 구역이 듬성듬성 흩어져 "여기가 어느 동네인지" 가
  // 안 읽혔다. 구역은 **동네**여야 한다.
  const rx = Math.floor(ix / 4);
  const rz = Math.floor(iz / 4);
  const h = hash2(rx * 131 + 7, rz * 197 + 3);

  // ── 어디에 무엇이 오는가 (docs/city.md) ──────────────────────────────────
  // 도시의 내력이 그대로 배치 규칙이 된다.
  //
  //   기업(2기)  본사는 도심에 섰다. 중심에 강하게 몰린다.
  //   상업(3기)  계획이 터진 자리. 도심에 붙어서 그 **바로 바깥 고리**에 난다.
  //              사람이 몰리는 곳 옆이라야 장사가 되기 때문이다.
  //   공업(1기)  물가에 있다. 가장 바깥.
  //   주거(1기)  공장과 도심 사이를 채운다. 도시에서 가장 넓다.
  //
  // near 는 중심에 가까울수록 1 에 가깝다.
  const near = 1 - core;
  // ring 은 도심 바로 바깥(core 0.35 부근)에서 최대가 된다 — 번화가의 자리.
  const ring = Math.exp(-((core - 0.34) ** 2) / 0.035);

  // 가중치는 실측으로 맞췄다. 첫 시도에서 주거가 57% 를 먹어 도시의 절반 이상이
  // 같은 건물이 됐다 — 노동자 도시라 현실적이긴 해도 걸어 다닐 재미가 없다.
  // 주거를 낮추고 상업·공업을 올려 아래 비율을 목표로 한다.
  //   주거 40% · 상업 22% · 공업 22% · 기업 16%
  // 슬럼은 **기업 구역 바로 바깥**에 난다. 2기에 기업이 도심 주변 땅을
  // 사서 개발을 시작한 자리이기 때문이다. 그래서 상업(3기)과 겹치는 고리에
  // 함께 있고, 둘이 섞여 있는 것이 정상이다.
  //
  // 공업은 12% 로 줄였다. 항만 하나에 공장 35블록(24%)은 과했고,
  // 그 자리가 슬럼이 들어갈 곳이다.
  const slumRing = Math.exp(-((core - 0.42) ** 2) / 0.03);
  const w = {
    corpo: Math.max(0, near - 0.52) * 7.5,
    market: ring * 3.8,   // 슬럼에 밀려 10% 까지 떨어졌던 것을 되돌린다
    // 슬럼 1.0 (전 2.6). 24% 는 과했다 — 도시 넷 중 하나가 미완성 골조면
    // 슬럼가가 아니라 유령도시다. 슬럼은 도시의 **예외**여야 눈에 띈다.
    slum: slumRing * 1.0,
    residential: 0.85 - Math.abs(core - 0.5) * 0.45,
    industrial: Math.max(0, core - 0.62) * 5.0,
  };

  let total = 0;
  for (const k of KEYS) total += w[k];
  if (total <= 0) return DISTRICTS.residential;
  let acc = h * total;
  for (const k of KEYS) {
    acc -= w[k];
    if (acc <= 0) return DISTRICTS[k];
  }
  return DISTRICTS.residential;
}

// 구역이 정한 가중치로 건물 유형을 고른다 (facade.pickArchetype 을 대체).
export function pickArchetypeIn(rng, district, height, width) {
  const w = { ...district.archetype };
  // 외골격은 넓고 높은 것에만 — 구역 가중치와 무관한 물리적 조건
  if (!(height > 110 && width > 20)) w.exo = 0;

  let total = 0;
  for (const k of Object.keys(w)) total += w[k];
  let acc = rng.next() * total;
  for (const k of Object.keys(w)) {
    acc -= w[k];
    if (acc <= 0) return k;
  }
  return 'grid';
}
