// 대지(parcel) — 여러 칸을 한 덩어리로 묶고 그 사이 도로를 걷어낸다.
//
// ── 왜 필요한가 (docs/city.md '이 도시가 사람에게 무엇을 하는가') ──────────
// 지금까지 블록은 곧 격자 한 칸이었고, 144칸이 **전부 사방을 도로로** 둘러싸고
// 있었다. 그 결과가 실측으로 이렇게 나왔다.
//
//   · 지면의 39.9% 가 도로다
//   · 낮은 건물은 1.6m 로 붙어 있는데 그건 전부 **블록 안**이다
//   · 블록을 넘어서는 뭉침이 하나도 없다
//
// 마천루의 압박감은 H/W 비가 아니라 **연속된 벽**에서 온다. 칸마다 사방이
// 도로면 벽이 생길 수가 없다 — 기둥이 늘어설 뿐이다.
//
// ── 내력이 이미 이걸 허락한다 ─────────────────────────────────────────────
// 새 설정을 지어낼 필요가 없다. city.md 에 이미 있다.
//
//   2기  기업은 자기 구역만 다시 설계했다. 슬럼 항목에는 아예
//        "기업이 여러 필지를 사 모아 한 덩어리로" 라고 적혀 있다.
//   3기  사람이 넘쳐 도로를 점유했고 차가 못 들어가게 됐다 → 보행 전용
//   1기  공장은 부지째로 쓴다 → 공장 단지
//
// ── 도로를 어떻게 걷어내는가 ──────────────────────────────────────────────
// `layout.roads()` 는 축마다 1차원 띠 목록이다. 띠 하나를 목록에서 빼면
// **도시를 가로지르는 그 길 전체**가 사라진다 — 병합은 국소적이어야 하므로
// 그럴 수 없다.
//
// 그래서 띠 기하는 그대로 두고 **"이 지점에서 열려 있나" 를 따로 묻는다**
// (roadOpen). 병합한 두 칸 사이 구간에서만 닫힌다. 도로를 쓰는 모듈은
// 루프에 검사 한 줄만 더하면 된다.
import { GRID, BLOCK_SIZE, blockCenter, blockIndexAt, HIGHWAY_BAND } from './layout.js';
import { districtAt } from './district.js';
import { hash2 } from '../../core/textures.js';
import { LANDMARK_BLOCKS, PROMENADE } from './landmark.js';

// 랜드마크가 선 칸은 병합하지 않는다. 손으로 지은 것이 있는 자리라
// 남의 대지에 묶이면 그 블록을 통째로 잡아먹는다.
//
// 대문 앞 보행 통로도 같다. 병합에 끌려가면 **옆 블록까지 통째로 비워지거나**
// 반대로 통로 자리에 건물이 선다 — 어느 쪽이든 손으로 정한 것이 무시된다.
const RESERVED = new Set([
  ...LANDMARK_BLOCKS.map((l) => `${l.ix},${l.iz}`),
  ...PROMENADE.keys(),
]);

// 구역별 병합 성향. 0 이면 그 구역은 칸 하나가 그대로 대지다.
//
//   기업   2기에 다시 설계된 곳. 캠퍼스로 묶는다. 가장 높다
//   상업   3기에 도로를 점유했다. 보행 전용 블록이 여기서 나온다
//   공업   부지째로 쓴다
//   주거   1기에 빨리 똑같이 지은 곳이라 격자를 지킨다. 드물게만
//   슬럼   내력을 다시 읽으니 여기가 **가장 크게 묶여야 한다.** city.md 슬럼
//          항목이 "기업이 여러 필지를 사 모아 한 덩어리로" 다. 사 모은 뒤
//          공사가 멈춘 자리이므로 원래 구획이 남아 있을 이유가 없다.
//          0(안 묶음) -> 0.42 -> 0.88. 처음에 "계획이 없는 곳에 계획적
//          병합이 있을 수 없다" 고 적었는데, 그 계획을 세운 것은 슬럼이
//          아니라 기업이었다. 내력을 잘못 읽은 것이다
//   부둣가 부지째로 쓴다. 컨테이너 적치장·트럭 야드는 도로로 잘리면
//          야드가 아니라 주차장이 된다
const MERGE = { 기업: 0.98, 상업: 0.94, 공업: 0.94, 주거: 0.86, 슬럼: 0.88, 부둣가: 0.96 };

// ── 대지 모양 ──────────────────────────────────────────────────────────────
//
// 처음에는 2x2 가 최대였다. 실측해 보니 **대지 96개 중 58개가 1칸**이었다 —
// 60%가 병합이 안 됐다는 뜻이고, 그래서 도로가 여전히 지면의 33.2%를 먹고
// 건물이 "띄엄띄엄 협소하게" 서 있었다. 사용자 지적 그대로다.
//
// 도로 **폭**을 줄이는 방법도 있지만 그건 안 한다. 폭은 SPANS 가 만든 것이고
// 거기엔 내력이 있다 (1차 74m — 마차 / 3차 104m — 트럭). 폭을 건드리면
// 도시의 나이테가 지워진다. 대신 **띠를 더 많이 닫는다.**
//
// [폭, 깊이, 임계] — 큰 것부터 시도한다. 작은 것을 먼저 잡으면 3x3 이 될
// 자리가 2x1 로 먼저 잘려 나간다. 임계는 rate 에 곱해지는 누적 분위수라
// 큰 모양일수록 좁은 구간을 갖는다.
const SHAPES = [
  [3, 3, 0.34], [3, 2, 0.50], [2, 3, 0.64],
  [2, 2, 0.80], [3, 1, 0.86], [1, 3, 0.92],
  [2, 1, 0.96], [1, 2, 1.00],
];

// ── 사람이 지나는 길 ───────────────────────────────────────────────────────
//
// ── 내가 만든 결함 (사용자 지적) ──────────────────────────────────────────
// "건물이 단지로 형성 되도 사람이 지나다닐 공간은 있어야지."
//
// 맞다. 병합은 도로를 39.9% -> 26.1% 로 줄였는데, **도로가 하던 일이
// 둘이었다** — 차를 통과시키는 것과 사람을 통과시키는 것. 차만 없애야
// 했는데 둘 다 없앴다. 266m 대지는 관통 불가능한 벽이 됐고, 그건 원래
// 격자보다 사람에게 나쁘다.
//
// **증거는 이미 숫자에 있었다.** '길에 면한 면' 이 0.51 -> 0.35 로 떨어졌다.
// 건물 면의 65%가 아무것도 안 마주 본다는 뜻이다. 그런데 나는 그걸 보고
// "병합으로 자연히 내려간다" 며 하한만 낮췄다 — **증상을 보고 경보를 껐다.**
//
// ── 왜 도로 띠를 다시 여는가 ──────────────────────────────────────────────
// 새 기하를 만들지 않는다. 도로 띠는 이미 거기 있고 병합이 그것을 닫았을
// 뿐이다. 닫은 띠의 일부를 **사람 길로** 다시 연다.
//
// 그러면 공짜로 따라오는 것이 있다: 자리가 원래 도로라 **양끝이 주변 도로에
// 자동으로 닿는다.** 관통이 보장된다 — 막다른 광장이 될 수가 없다.
// (골목이 실패한 이유가 정확히 그 반대였다. 자리를 새로 만들었더니 벽을
//  따로 세워야 했고, 그 벽이 공터에 선 골판지가 됐다.)
//
// 폭은 도로 폭과 무관하게 구역이 정한다. 차도가 아니므로 차선 수와
// 관계가 없고, 사람이 몇 줄로 지나가느냐가 정한다.
const WALK_W = {
  상업: 16,   // 유동인구가 관통한다. 좌판이 양옆에 서고도 두 줄이 지나간다
  기업: 12,   // 광장에서 이어지는 열주 길
  주거: 10,   // 동 사이 마당
  공업: 9,    // 작업자 통로
  슬럼: 8,    // 계획이 없으므로 좁다
  부둣가: 0,  // **없다.** 여기는 사람이 걸어 다니는 곳이 아니다 (트럭이 다닌다)
};

let CACHE = null;

function build() {
  const owner = new Array(GRID * GRID).fill(-1); // 칸 -> 대지 번호
  const list = [];
  const at = (ix, iz) => owner[iz * GRID + ix];
  const free = (ix, iz) => !RESERVED.has(`${ix},${iz}`);
  // 고가도로가 타는 띠는 못 지운다. 지우면 그 자리에 대지가 생기고
  // 고가도로가 다시 건물 위를 지난다 — 방금 고친 결함이 되살아난다.
  // 띠 k 는 칸 k-1 과 k 사이이므로, 그 두 칸을 X 방향으로 못 묶는다.
  const acrossHighway = (ax, bx) => Math.max(ax, bx) === HIGHWAY_BAND && Math.min(ax, bx) === HIGHWAY_BAND - 1;
  const same = (ax, az, bx, bz) =>
    bx < GRID && bz < GRID && at(bx, bz) < 0 && free(bx, bz) &&
    !acrossHighway(ax, bx) &&
    districtAt(ax, az) === districtAt(bx, bz);

  const claim = (cells, district) => {
    const id = list.length;
    for (const [ix, iz] of cells) owner[iz * GRID + ix] = id;
    const h = BLOCK_SIZE / 2;
    let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
    for (const [ix, iz] of cells) {
      x0 = Math.min(x0, blockCenter(ix) - h);
      x1 = Math.max(x1, blockCenter(ix) + h);
      z0 = Math.min(z0, blockCenter(iz) - h);
      z1 = Math.max(z1, blockCenter(iz) + h);
    }
    const p = { id, cells, rect: { x0, x1, z0, z1 }, district, ix: cells[0][0], iz: cells[0][1] };
    p.walks = walksFor(p);
    list.push(p);
  };

  // 이 대지 안에서 어느 띠를 사람 길로 열까.
  //
  // **최소 하나**다. 하나도 없으면 그 대지는 벽이고, 그게 지금 문제다.
  // 3칸 이상으로 뻗은 축에서는 가운데를 고른다 — 십자로 만나면 그 교차점이
  // 자연히 광장이 되고, 사람은 늘 그런 자리에 모인다.
  const walksFor = (p) => {
    const w = WALK_W[p.district.name] ?? 10;
    if (w <= 0 || p.cells.length < 2) return [];
    const xs = p.cells.map((c) => c[0]);
    const zs = p.cells.map((c) => c[1]);
    const ix0 = Math.min(...xs), ix1 = Math.max(...xs);
    const iz0 = Math.min(...zs), iz1 = Math.max(...zs);
    const out = [];
    // 띠 k 는 칸 k-1 과 k 사이다. 대지 안쪽 띠만 후보다.
    const mid = (a, b2) => a + Math.floor((b2 - a + 1) / 2);
    if (ix1 > ix0) out.push({ axis: 'x', band: mid(ix0, ix1), w });
    if (iz1 > iz0) out.push({ axis: 'z', band: mid(iz0, iz1), w });
    // 둘 다 없을 수는 없다 (cells >= 2 이므로 한 축은 반드시 뻗어 있다)
    for (const g of out) {
      const c = blockCenter(g.band - 1) + BLOCK_SIZE / 2;
      const c2 = blockCenter(g.band) - BLOCK_SIZE / 2;
      const m = (c + c2) / 2;
      g.rect = g.axis === 'x'
        ? { x0: m - w / 2, x1: m + w / 2, z0: p.rect.z0, z1: p.rect.z1 }
        : { x0: p.rect.x0, x1: p.rect.x1, z0: m - w / 2, z1: m + w / 2 };
    }
    return out;
  };

  // 왼쪽 위부터 훑으며 아직 안 묶인 칸을 씨앗으로 삼는다.
  // 좌표 해시로 정한다 — 난수를 쓰면 병합 비율만 바꿔도 도시 전체가 밀린다
  // (blockProgram·alleyFor 와 같은 이유).
  for (let iz = 0; iz < GRID; iz++) {
    for (let ix = 0; ix < GRID; ix++) {
      if (at(ix, iz) >= 0) continue;
      const D = districtAt(ix, iz);
      const rate = free(ix, iz) ? (MERGE[D.name] ?? 0) : 0;
      const h = hash2(ix * 53 + 11, iz * 97 + 7);

      // SHAPES 를 큰 것부터 훑는다. h 는 고정이므로 `h < rate*t` 를 처음
      // 만족하는 모양이 이 칸에 허락된 최대치이고, 그게 지형상 안 되면
      // 다음(더 작은) 모양으로 자연히 물러난다.
      let done = false;
      for (const [w, d] of SHAPES.filter(([, , t]) => h < rate * t)) {
        // 고가도로가 타는 띠는 못 지운다. same() 의 acrossHighway 는 **맞닿은
        // 두 칸**만 보므로 3칸짜리에는 구멍이 있다 — 씨앗이 HIGHWAY_BAND-2 면
        // 세 번째 칸이 띠를 건너뛰어 넘어가고, 고가도로가 다시 건물 위를
        // 지난다. 여기서 폭 전체를 본다.
        if (ix < HIGHWAY_BAND && ix + w - 1 >= HIGHWAY_BAND) continue;
        const cells = [];
        let ok = true;
        for (let dz = 0; dz < d && ok; dz++) {
          for (let dx = 0; dx < w && ok; dx++) {
            if (dx === 0 && dz === 0) { cells.push([ix, iz]); continue; }
            if (!same(ix, iz, ix + dx, iz + dz)) ok = false;
            else cells.push([ix + dx, iz + dz]);
          }
        }
        if (!ok) continue;
        claim(cells, D);
        done = true;
        break;
      }
      if (!done) claim([[ix, iz]], D);
    }
  }
  return { owner, list };
}

function data() {
  if (!CACHE) CACHE = build();
  return CACHE;
}

export function parcels() {
  return data().list;
}

// 이 칸이 속한 대지.
export function parcelAt(ix, iz) {
  const d = data();
  const cx = Math.max(0, Math.min(GRID - 1, ix));
  const cz = Math.max(0, Math.min(GRID - 1, iz));
  return d.list[d.owner[cz * GRID + cx]];
}

// ── 블록 경계 ──────────────────────────────────────────────────────────────
//
// **블록의 '경계' 가 필요한 곳은 전부 여기를 부른다.**
//
// 먼저 layout.blockRect 로 여덟 모듈을 모아 두었다 (순수 리팩터링, 픽셀
// 동일 확인). 그 덕에 병합은 여기 한 줄만 바꾸면 전부 따라온다 —
// 특히 towers.streetFaces 가 자동으로 **대지 경계**를 보게 된다.
export function blockRect(ix, iz) {
  return parcelAt(ix, iz).rect;
}

// ── 도로가 이 지점에서 열려 있나 ───────────────────────────────────────────
//
// band 는 layout.roads() 의 인덱스다. 띠 k 는 칸 k-1 과 칸 k 사이에 있다.
// t 는 그 도로를 따라간 위치(다른 축의 좌표).
//
// 두 칸이 같은 대지면 그 구간의 도로는 없다.
export function roadOpen(band, t) {
  const d = data();
  // 바깥 경계 도로는 항상 열려 있다
  if (band <= 0 || band >= GRID) return true;
  const j = blockIndexAt(t);
  const a = d.owner[j * GRID + (band - 1)];
  const b = d.owner[j * GRID + band];
  return a !== b;
}

// 같은 판정을 축 반대로. 도로가 X 를 따라 뻗을 때 쓴다.
export function roadOpenZ(band, t) {
  const d = data();
  if (band <= 0 || band >= GRID) return true;
  const i = blockIndexAt(t);
  const a = d.owner[(band - 1) * GRID + i];
  const b = d.owner[band * GRID + i];
  return a !== b;
}

// 이 대지의 보행로 띠들. blockLots 가 필지에서 빼내고, streets 가 포장하고,
// crowd 가 사람을 몰아넣는다.
export function walksOf(ix, iz) {
  return parcelAt(ix, iz).walks || [];
}

// 모든 보행로 사각형. 도로·인파·검사가 전역으로 훑을 때 쓴다.
let WALK_CACHE = null;
export function allWalks() {
  if (WALK_CACHE) return WALK_CACHE;
  WALK_CACHE = [];
  for (const p of parcels()) {
    for (const g of p.walks || []) WALK_CACHE.push({ ...g, district: p.district });
  }
  return WALK_CACHE;
}

// 이 지점이 보행로 위인가.
export function onWalk(x, z) {
  for (const g of allWalks()) {
    const r = g.rect;
    if (x >= r.x0 && x <= r.x1 && z >= r.z0 && z <= r.z1) return g;
  }
  return null;
}

// 진단용 — 병합이 얼마나 됐나.
export function parcelTally() {
  const t = {};
  for (const p of parcels()) {
    t[p.cells.length + '칸'] = (t[p.cells.length + '칸'] || 0) + 1;
  }
  const list = parcels();
  const single = t['1칸'] || 0;
  return {
    대지수: list.length,
    ...t,
    // 이 비율 하나가 "격자로 보이나 단지로 보이나" 를 가른다
    '1칸비율': +(single / list.length).toFixed(2),
  };
}
