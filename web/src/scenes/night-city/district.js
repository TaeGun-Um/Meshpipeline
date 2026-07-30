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
  // 상업 — 재팬타운. 이 도시에서 가장 밝고 시끄러운 곳.
  // 간판이 벽을 뒤덮고 골목까지 빛이 넘친다. 탐험의 목적지.
  market: {
    name: '상업',
    trim: [NEON.magenta, NEON.cyan, NEON.pink, NEON.amber, NEON.violet],
    signDensity: 3.2, // 포디움 간판 개수 배수
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
    trim: [NEON.cool, NEON.blue, NEON.cyan],
    signDensity: 0.5,
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
    trim: [NEON.warm, NEON.amber, NEON.green],
    signDensity: 1.0,
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
    trim: [NEON.amber, NEON.pink],
    signDensity: 0.28,
    bladeChance: 0.1,
    shopLit: 0.3,
    shopBright: 0.2,
    poolGain: 0.45,
    heightBias: -0.4,
    archetype: { grid: 0.7, curtain: 0.1, punched: 3.0, slab: 0.5, exo: 0 },
  },
};

const KEYS = ['market', 'corpo', 'residential', 'industrial'];

// 2x2 블록을 한 구역으로 묶는다. 도심 코어는 기업 구역이 되기 쉽고,
// 바깥은 공업·주거가 되기 쉽다 — 실제 도시의 지대(地代) 구조를 흉내낸다.
export function districtAt(ix, iz, core) {
  const rx = ix >> 1;
  const rz = iz >> 1;
  const h = hash2(rx * 131 + 7, rz * 197 + 3);

  const near = 1 - core;
  const w = {
    market: 1.0 + near * 0.5,
    corpo: 0.25 + near * 2.2,
    residential: 1.2 - near * 0.3,
    industrial: 1.1 - near * 0.8,
  };
  let total = 0;
  for (const k of KEYS) total += w[k];
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
