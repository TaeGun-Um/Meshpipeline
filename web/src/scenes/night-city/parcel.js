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
import { LANDMARK_BLOCKS } from './landmark.js';

// 랜드마크가 선 칸은 병합하지 않는다. 손으로 지은 것이 있는 자리라
// 남의 대지에 묶이면 그 블록을 통째로 잡아먹는다.
const RESERVED = new Set(LANDMARK_BLOCKS.map((l) => `${l.ix},${l.iz}`));

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
const MERGE = { 기업: 0.98, 상업: 0.94, 공업: 0.94, 주거: 0.86, 슬럼: 0.88 };

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
    list.push({ id, cells, rect: { x0, x1, z0, z1 }, district, ix: cells[0][0], iz: cells[0][1] });
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
