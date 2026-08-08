// 평면과 치수 — **이 층의 유일한 출처**.
//
// 값의 근거는 docs/scenes/office-sector/facility.md 에 있다. 여기 숫자를
// 고치기 전에 그 문서를 먼저 고친다 — 도시에서 상수를 코드에만 두었다가
// "왜 이 값인가" 를 아무도 못 되짚은 적이 여러 번 있다.
//
// ── 벽을 어떻게 세우나 ─────────────────────────────────────────────────────
// 벽에 구멍을 불리언으로 뚫지 않는다. **칸의 경계를 훑어 "이웃이 같은 구간"
// 으로 쪼개고**, 그 구간마다 규칙표를 보고 열지 말지를 정한다.
//
// 이게 도시의 `streetFaces` 와 같은 자리다 — 면을 먼저 구간으로 나누고,
// 그 구간에 무엇을 놓을지는 나중에 정한다.

// ── 수직 ───────────────────────────────────────────────────────────────────
export const H = {
  door: 2.1, // 문 상인방
  corridor: 2.7, // 복도 천장. 제일 낮다 — 여기가 기준선
  room: 3.0,
  plaza: 5.6, // 두 배 이상. 높이가 첫 위계다
  slab: 0.35, // 마감 천장과 구조 슬래브 사이 (덕트·배관이 지나간다)
};

// 외벽 상단 — 외곽 벽은 방 천장이 아니라 **층 전체의 최고점**까지 선다.
// 방 천장(3.0)까지만 세우면 천장 위 설비 공간의 옆구리가 뚫린다.
// 지하 1층이라 이 위가 지표(1층 슬래브)다 (facility.md 2.4).
export const EAVE = H.plaza + H.slab;

// ── 수평 ───────────────────────────────────────────────────────────────────
export const W = {
  wall: 0.2,
  corridor: 2.4,
  spur: 1.8,
  door: 0.95,
  doorWide: 1.9,
  tile: 0.6, // 천장 격자. 형광등이 여기 앉는다
  lamp: [1.2, 0.6], // 형광등 = 타일 두 칸
};

// ── 층 외곽 ────────────────────────────────────────────────────────────────
//
// 처음 48x34 에 플라자 18x14(252㎡)였다가, 홀이 쓸데없이 넓다는 지시로
// 플라자를 **절반(12.6x10 = 126㎡)** 으로 줄이고 층 전체를 그만큼 당겼다
// (2026-08-05). 방 스트립의 깊이는 그대로다 — 준 것은 홀과 그 고리뿐이다.
export const FLOOR = { x: 42.6, z: 30 };
const X = FLOOR.x / 2;
const Z = FLOOR.z / 2;

// 플라자를 가운데 두고 고리 복도가 감싼다. 방은 고리 바깥에 붙는다.
// 실내에서 길을 잃지 않으려면 복도가 직선으로 만나야 한다 (facility.md 1장).
const PX = 6.3; // 플라자 반폭
const PZ = 5.0;
const RC = W.corridor; // 고리 복도 폭
const RX = PX + RC; // 고리 바깥 x
const RZ = PZ + RC;

// ── 칸 ─────────────────────────────────────────────────────────────────────
//
// 축에 나란한 사각형. 겹치지 않아야 한다 (`checkPlan` 이 검사한다).
//   kind  벽 규칙표와 조명·소품 규칙이 이걸로 갈린다
//   h     천장 높이
// use 는 kind 안에서 다시 갈린다. 'room' 셋(사무실·창고·설비실)이 벽 규칙은
// 같은데 안에 들어가는 것이 전혀 다르기 때문이다 — 종류를 늘리는 대신
// 용도를 따로 둔다.
const cell = (id, kind, x0, z0, x1, z1, h, use = kind) => ({ id, kind, x0, z0, x1, z1, h, use });

// **방은 권역으로 묶는다** (2026-08-05 사용자 지시 — story.md 의 층 성격).
//   전산 권역(동)   문 -> 관제실 -> 서버실. 서버실은 관제실을 거쳐야만 들어간다.
//                   기계실이 그 아래 붙는다 (관제실과 내부 문)
//   음식 권역(서)   식당과 카페테리아가 붙어 있고 사이가 트인다
//   위생 권역(북서) 화장실 -> 샤워실 -> 휴게실이 한 줄로 직접 붙는다
//                   (사이의 지선 spurN 은 없앴다 — 아래 106행대 참고)
//   수직 동선(남)   엘리베이터 홀과 비상계단이 남쪽 지선 양옆
// 중복이던 사무실 넷·설비실 넷·창고 둘은 사무실 둘(시작 방 = 서버관리부서
// + 일반 사무)·설비실 하나(병합)·창고 하나로 줄였다 — 그 자리에 회의실·
// 휴게실·샤워실·관제실·기계실·엘리베이터·비상계단이 들어온다.
export const CELLS = [
  cell('plaza', 'plaza', -PX, -PZ, PX, PZ, H.plaza),

  // 고리 복도 넷
  cell('ringN', 'corridor', -RX, PZ, RX, RZ, H.corridor),
  cell('ringS', 'corridor', -RX, -RZ, RX, -PZ, H.corridor),
  cell('ringW', 'corridor', -RX, -PZ, -PX, PZ, H.corridor),
  cell('ringE', 'corridor', PX, -PZ, RX, PZ, H.corridor),

  // 서쪽 — 음식 권역. 둘 다 kind 'cafeteria' 라 사이가 트인다 (open)
  cell('dineW', 'cafeteria', -X, -1.8, -RX, RZ, H.room, 'dining'),
  cell('cafeW', 'cafeteria', -X, -RZ, -RX, -1.8, H.room, 'cafe'),

  // 동쪽 — 전산 권역. 진입 사슬이 형태다: 복도 --문--> 관제실 --유리+문-->
  // 서버실. 서버실의 다른 모든 경계는 막힌 벽이다 (PAIR: corridor|server solid).
  // 동쪽 스트립에 있던 기계실은 남쪽 설비실과 **하나로 합쳐** 남동 밴드로
  // 내려갔고(합계 152 -> 83㎡ 축소), 그만큼 서버실이 컸다 (2026-08-05
  // 사용자 지시 — 81 -> 156㎡). 관제실은 남동 모서리(bandS 끝)까지 내려
  // 앉는다 — 어중간히 두면 고리 복도와 1.2m 만 접해 문이 안 들어간다
  // (tooNarrow 신고가 잡았다). 남쪽으로 기계실과 내부 문이 닿는다.
  cell('serverE', 'server', RX, -5.0, X, RZ, H.room),
  cell('controlE', 'control', RX, -RZ - W.spur, X, -5.0, H.room),

  // 북서 — **주방.** 회의실과 그 앞 복도 구간을 허물어 식당에 합쳤다
  // (2026-08-05 사용자 지시). kind 'kitchen' — 식당과는 트이고(open),
  // 복도와는 직원 출입문 하나다. 배식 카운터가 식당 경계에 선다 (props).
  cell('kitchenNW', 'kitchen', -X, RZ, -12.0, Z, H.room, 'kitchen'),

  // 북쪽 — 띠 복도(주방 동쪽부터)에 방들이 매달린다. **띠 복도가 있어야
  // 한다** — 처음에 방만 쪼갰더니 고리 복도에 안 닿는 외곽 방들이 갇혔다
  // (checkReach 가 잡았다).
  // 위생 권역: 화장실 -> 샤워실 -> 휴게실이 한 줄로 **직접** 붙는다.
  // 화장실·휴게실 자리를 맞바꾸고 사이의 지선(spurN, 옛 배관 코어)을
  // 없앴다 (2026-08-05 사용자 지시 — 의미 없는 복도였다. 젖은 방 둘이
  // 붙으니 배관도 한 벽으로 모인다).
  cell('bandN', 'corridor', -12.0, RZ, X, RZ + W.spur, H.corridor),
  cell('washN', 'room', -12.0, RZ + W.spur, -7.4, Z, H.room, 'wash'),
  cell('showerN', 'room', -7.4, RZ + W.spur, -3.8, Z, H.room, 'shower'),
  cell('loungeN', 'room', -3.8, RZ + W.spur, 5.5, Z, H.room, 'lounge'),
  // officeN3 이 **시작 방**이다 (use 'start') — A 의 서버관리부서 사무실.
  // 옆의 일반 사무실과 둘로 나뉘어 있었는데 사이 벽을 허물어 하나로 합쳤다
  // (2026-08-05 사용자 지시) — 북동쪽 전체가 서버관리부서의 큰 사무실이다.
  cell('officeN3', 'room', 5.5, RZ + W.spur, X, Z, H.room, 'start'),

  // 남쪽 — 수직 동선과 지원 공간 (2026-08-05 개편).
  //   엘리베이터는 **방이 아니라 트인 베이**다 — 방 안에 엘리베이터가 있는
  //   것이 이상하다는 지시로 둘러싼 벽을 부쉈다. kind 'corridor' 라 띠 복도와
  //   벽 없이 이어지고, 남쪽 벽 중앙(홀 정면 축 x=0)에 문 두 짝이 선다.
  //   비상계단은 계단이 벽에 딱 맞붙는 폭(3.0)만 받는다. 지선(spurS)은
  //   베이에 흡수됐다 (spurN 과 같은 이유 — 의미 없는 복도).
  // 띠 복도 동쪽 끝은 관제실 문 앞에서 끝난다 (관제실이 모서리를 차지한다)
  cell('bandS', 'corridor', -X, -RZ - W.spur, RX, -RZ, H.corridor),
  // 비상계단은 엘리베이터 베이 **바로 옆**이고 입구가 베이 쪽(동쪽 벽)이다
  // (2026-08-05 스크린샷 지시 — 창고와 자리를 맞바꿨다). 계단은 베이 문으로
  // 들어와 북쪽으로 돌아 서쪽 련을 오른다 (props.stairwell 이 방 치수에서
  // 유도한다). 창고는 남서쪽으로 갔다.
  cell('storeS', 'room', -X, -Z, -5.8, -RZ - W.spur, H.room, 'store'),
  cell('stairS', 'room', -5.8, -Z, -1.0, -RZ - W.spur, H.room, 'stair'),
  cell('elevS', 'corridor', -1.0, -Z, 7.0, -RZ - W.spur, H.corridor, 'elev'),
  // 기계·전기실 — 기계실+설비실 병합 방. 전산 권역과 같은 남동 사분면이고,
  // 베이에서 옆문으로도 통한다.
  cell('utilSE', 'room', 7.0, -Z, X, -RZ - W.spur, H.room, 'machine'),
];

export const byId = Object.fromEntries(CELLS.map((c) => [c.id, c]));

// ── 두 칸 사이에 무엇이 서나 ───────────────────────────────────────────────
//
// **구역별 표.** 도시에서 배운 것 — 모듈마다 자기 표를 갖고 빠진 조합을
// `??` 로 때우면 어긋난다. 여기 없는 조합은 던진다.
//
//   open   벽 없음 (복도끼리)
//   door   단짝 문
//   wide   쌍짝 문 (사람이 몰리는 곳)
//   glass  유리벽 + 문 (서버룸)
//
// **키는 알파벳 순으로 적는다.** 조회할 때 정렬해서 찾기 때문이다. 처음에
// 'corridor|cafeteria' 라고 적었더니 조회 키는 'cafeteria|corridor' 라 못
// 찾았다 — 아래 자기 검사가 그걸 로드 시점에 잡는다.
const PAIR = {
  'cafeteria|cafeteria': 'open', // 식당-카페테리아 사이가 트인다 (음식 권역)
  'cafeteria|control': 'solid',
  'cafeteria|corridor': 'wide',
  'cafeteria|kitchen': 'open', // 주방은 식당의 연장이다 — 배식대가 경계를 맡는다
  'cafeteria|plaza': 'wide',
  'cafeteria|room': 'solid',
  'cafeteria|server': 'solid',
  'control|control': 'open',
  'control|corridor': 'door', // 진입 사슬의 첫 문: 복도 -> 관제실
  'control|kitchen': 'solid',
  'control|plaza': 'solid',
  'control|room': 'door', // 관제실 <-> 기계실 내부 문
  'control|server': 'glass', // 진입 사슬의 둘째 문: 관제실 -> 서버실 (유리 + 문)
  'corridor|corridor': 'open',
  'corridor|kitchen': 'door', // 주방 직원 출입문 (띠 복도 서쪽 끝)
  'corridor|plaza': 'open',
  'corridor|room': 'door',
  // **서버실은 복도에서 못 들어간다** (2026-08-05 사용자 지시) — 문도
  // 유리도 없다. 유일한 출입은 관제실 경유다 (control|server).
  'corridor|server': 'solid',
  'kitchen|kitchen': 'open',
  'kitchen|plaza': 'solid',
  'kitchen|room': 'solid',
  'kitchen|server': 'solid',
  'plaza|plaza': 'open',
  'plaza|room': 'door',
  'plaza|server': 'solid',
  'room|room': 'solid',
  'room|server': 'solid',
  'server|server': 'open',
};

// 표가 스스로를 검사한다 — 키가 정렬돼 있나, 쓰이는 종류가 다 있나.
// 조용히 틀리는 것보다 로드하다 터지는 편이 낫다.
(() => {
  for (const k of Object.keys(PAIR)) {
    const parts = k.split('|');
    if (parts.join('|') !== [...parts].sort().join('|')) {
      throw new Error(`layout.PAIR 키 '${k}' 가 정렬돼 있지 않다`);
    }
  }
  const kinds = [...new Set(CELLS.map((c) => c.kind))].sort();
  for (const a of kinds) {
    for (const b of kinds) {
      const k = [a, b].sort().join('|');
      if (!PAIR[k]) throw new Error(`layout.PAIR 에 '${k}' 가 빠졌다`);
    }
  }
})();

function pairRule(a, b) {
  const k = [a, b].sort().join('|');
  const r = PAIR[k];
  if (!r) throw new Error(`벽 규칙에 '${k}' 가 없다 — layout.PAIR 에 추가한다`);
  return r;
}

// ── 칸 짝 덮어쓰기 — 특정 두 칸 사이만 규칙을 바꾼다 ───────────────────────
//
// PAIR 는 종류(kind) 단위라 "이 문만 없앤다" 를 못 한다. 출입 동선 정리는
// 여기서 한다 (2026-08-05 스크린샷 지시). 키는 **칸 id** 알파벳순.
//   식당 권역   서쪽 개구 둘(dineW-ringW·ringN)과 카페 남문, 주방 뒷문을
//               막았다 — 출입은 식당 북쪽(bandN)과 카페 동쪽(ringW·ringS)만
//   전산 권역   기계실 남쪽 복도 문과 관제실 복도끝 문을 막았다 — 기계실은
//               베이 옆문·관제실 내부문으로, 관제실은 고리 복도 끝 문으로
const CELL_OVERRIDE = {
  'bandN|kitchenNW': 'solid',
  'bandS|cafeW': 'solid',
  'bandS|controlE': 'solid',
  'bandS|utilSE': 'solid',
  'cafeW|ringS': 'solid', // 카페 출입은 서쪽 고리(ringW) 문 하나만
  'dineW|ringN': 'solid',
  'dineW|ringW': 'solid',
  'elevS|stairS': 'solid', // 계단실 출입은 북쪽 복도 문 하나만
};

// 표가 스스로를 검사한다 — 키가 정렬돼 있나, 실제 칸 id 를 가리키나
(() => {
  for (const k of Object.keys(CELL_OVERRIDE)) {
    const parts = k.split('|');
    if (parts.join('|') !== [...parts].sort().join('|')) {
      throw new Error(`layout.CELL_OVERRIDE 키 '${k}' 가 정렬돼 있지 않다`);
    }
    for (const id of parts) {
      if (!CELLS.some((c) => c.id === id)) {
        throw new Error(`layout.CELL_OVERRIDE 가 없는 칸 '${id}' 를 가리킨다 — 칸을 개명했으면 여기도 고친다`);
      }
    }
  }
})();

function ruleBetween(c, other) {
  return CELL_OVERRIDE[[c.id, other.id].sort().join('|')] ?? pairRule(c.kind, other.kind);
}

// ── 외곽 — 이웃이 없는 경계 ────────────────────────────────────────────────
//
// **지하 1층이라 전부 막힌 벽이다** (facility.md 2.4). 창은 없다 — 벽 너머는
// 매립과 공동구다. 한때 지상 사옥으로 전환해 외곽 창을 냈다가(2026-08-05)
// 무대가 지하 1층으로 확정되며 되돌렸다 — 창 내는 법은 서버룸 유리벽과
// git 히스토리에 남아 있다.
const extRule = () => 'solid';

// ── 경계를 훑어 구간으로 쪼갠다 ────────────────────────────────────────────

const EPS = 1e-4;
const cellAt = (x, z) =>
  CELLS.find((c) => x > c.x0 + EPS && x < c.x1 - EPS && z > c.z0 + EPS && z < c.z1 - EPS) || null;

// 어느 칸인가 — 상호작용 프리뷰가 **벽 너머 물건**을 잡지 않게 쓴다
// (화장실에서 주방 냉장고가 잡혔다 — 2026-08-06). 경계에 앉은 점은 null 이다.
export const cellIdAt = (x, z) => cellAt(x, z)?.id ?? null;

// 한 변을 이웃이 바뀌는 지점마다 자른다.
//   side  'n'(+z) 's'(-z) 'e'(+x) 'w'(-x)
// 돌려주는 것: [{ a, b, other, rule }]  — a..b 는 그 변의 축 위 구간
function edgeSpans(c, side) {
  const along = side === 'n' || side === 's' ? 'x' : 'z';
  const lo = along === 'x' ? c.x0 : c.z0;
  const hi = along === 'x' ? c.x1 : c.z1;
  // 바깥쪽으로 살짝 나간 자리에서 이웃을 묻는다
  const off = side === 'n' ? [0, +0.01] : side === 's' ? [0, -0.01] : side === 'e' ? [+0.01, 0] : [-0.01, 0];
  const fixed = side === 'n' ? c.z1 : side === 's' ? c.z0 : side === 'e' ? c.x1 : c.x0;

  // 자를 지점 — 다른 칸들의 경계값 중 이 구간 안에 드는 것
  const cuts = new Set([lo, hi]);
  for (const o of CELLS) {
    for (const v of along === 'x' ? [o.x0, o.x1] : [o.z0, o.z1]) {
      if (v > lo + EPS && v < hi - EPS) cuts.add(v);
    }
  }
  const ks = [...cuts].sort((p, q) => p - q);

  const raw = [];
  for (let i = 0; i < ks.length - 1; i++) {
    const a = ks[i];
    const b = ks[i + 1];
    if (b - a < 0.05) continue;
    const m = (a + b) / 2;
    const px = along === 'x' ? m : fixed;
    const pz = along === 'x' ? fixed : m;
    const other = cellAt(px + off[0], pz + off[1]);
    raw.push({ a, b, other, rule: other ? ruleBetween(c, other) : extRule(c) });
  }

  // **이웃이 같으면 합친다.** 자를 지점을 모든 칸의 경계에서 모으므로,
  // 마주보지도 않는 칸 때문에 한 벽이 셋으로 쪼개진다. 안 합치면 18m 벽 하나에
  // 문이 세 개 서고, 벽 개수도 실제의 두 배가 된다.
  const out = [];
  for (const s of raw) {
    const p = out[out.length - 1];
    if (p && p.other === s.other && p.rule === s.rule && Math.abs(p.b - s.a) < EPS) p.b = s.b;
    else out.push({ ...s });
  }
  return out;
}

// 이 층의 모든 벽 구간. 한 경계를 두 번 짓지 않도록 id 순서로 한 쪽만 낸다.
//
//   axis   'x' 면 x 를 따라 뻗는 벽 (z 고정)
//   at     고정 좌표
//   a, b   뻗는 범위
//   rule   open|door|wide|glass|solid
//   h      두 칸 중 **높은 쪽** 천장까지 세운다 — 낮은 쪽만큼만 세우면
//          플라자에서 복도 지붕 위로 뻥 뚫린 구멍이 보인다
export function wallRuns() {
  const out = [];
  const order = Object.fromEntries(CELLS.map((c, i) => [c.id, i]));
  for (const c of CELLS) {
    for (const side of ['n', 's', 'e', 'w']) {
      const axis = side === 'n' || side === 's' ? 'x' : 'z';
      const at = side === 'n' ? c.z1 : side === 's' ? c.z0 : side === 'e' ? c.x1 : c.x0;
      for (const s of edgeSpans(c, side)) {
        // 같은 경계를 이웃 쪽에서도 만난다 — 한 번만 짓는다
        if (s.other && order[s.other.id] < order[c.id]) continue;
        const hi = Math.max(c.h, s.other ? s.other.h : c.h);
        const low = Math.min(c.h, s.other ? s.other.h : c.h);

        // 트인 경계라도 **천장 높이가 다르면 그 차이만큼 벽이 선다.**
        // 플라자(5.6)를 고리 복도(2.7)가 감싸므로 그 사이에 2.9m 짜리 수직면이
        // 생긴다 — 실제 건물의 소핏(soffit) 이고, 안 세우면 복도 천장 위
        // 설비 공간이 플라자에서 그대로 들여다보인다.
        if (s.rule === 'open') {
          if (hi - low > 0.05) {
            out.push({ axis, at, a: s.a, b: s.b, rule: 'upstand', h: hi, low, from: c.id, to: s.other.id });
          }
          continue;
        }
        out.push({ axis, at, a: s.a, b: s.b, rule: s.rule, h: hi, low, from: c.id, to: s.other ? s.other.id : null });
      }
    }
  }
  return out;
}

// ── 칸과 칸 사이가 얼마나 트였나 ───────────────────────────────────────────
//
// `wallRuns()` 는 **벽**을 낸다 — 트인 경계('open')는 아예 안 나오고, 높이가
// 다르면 'upstand' 로 바뀐다. "빛이 새는가 / 걸어갈 수 있는가" 를 물으려면
// 가공 전의 규칙이 필요하다.
//
// 도달 검사와 빛 굽기가 **각자 훑으면 어긋난다** — 이 저장소에서 제일 자주
// 난 결함이다 (lessons.md 2.1 결합 대장). 표를 하나로 둔다.
const OPEN_RANK = { solid: 0, door: 1, glass: 2, wide: 3, open: 4 };

export function openness() {
  const m = new Map();
  const put = (a, b, rule) => {
    for (const k of [`${a}|${b}`, `${b}|${a}`]) {
      const prev = m.get(k);
      if (prev === undefined || OPEN_RANK[rule] > OPEN_RANK[prev]) m.set(k, rule);
    }
  };
  for (const c of CELLS) {
    for (const side of ['n', 's', 'e', 'w']) {
      for (const s of edgeSpans(c, side)) if (s.other) put(c.id, s.other.id, s.rule);
    }
  }
  return m;
}

// 두 칸을 가르는 면. 맞닿은 사각형 둘은 x 든 z 든 값 하나를 공유한다.
// 빛이 그 면의 **어느 높이로** 넘어가는지 따질 때 쓴다.
export function seam(a, b) {
  if (Math.abs(a.x1 - b.x0) < EPS) return { axis: 'x', at: a.x1 };
  if (Math.abs(a.x0 - b.x1) < EPS) return { axis: 'x', at: a.x0 };
  if (Math.abs(a.z1 - b.z0) < EPS) return { axis: 'z', at: a.z1 };
  if (Math.abs(a.z0 - b.z1) < EPS) return { axis: 'z', at: a.z0 };
  return null;
}

// ── 평면이 성립하나 ────────────────────────────────────────────────────────
//
// 칸이 겹치거나 층 밖으로 나가면 벽 계산이 통째로 틀어진다. 형태를 보기 전에
// 숫자로 먼저 잡는다 (facility.md 5장).
export function checkPlan() {
  const bad = [];
  for (let i = 0; i < CELLS.length; i++) {
    const a = CELLS[i];
    if (a.x0 < -X - EPS || a.x1 > X + EPS || a.z0 < -Z - EPS || a.z1 > Z + EPS) {
      bad.push(`${a.id} 가 층 밖으로 나간다`);
    }
    if (a.x1 - a.x0 < 0.5 || a.z1 - a.z0 < 0.5) bad.push(`${a.id} 가 너무 작다`);
    for (let j = i + 1; j < CELLS.length; j++) {
      const b = CELLS[j];
      const ox = Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0);
      const oz = Math.min(a.z1, b.z1) - Math.max(a.z0, b.z0);
      if (ox > 0.05 && oz > 0.05) bad.push(`${a.id} 와 ${b.id} 가 ${ox.toFixed(2)}x${oz.toFixed(2)} 겹친다`);
    }
  }
  // 바닥 면적이 외곽을 채우나 — 빈 틈은 걸어 들어가면 허공이다.
  // 계산만 하고 안 물었더니 검사가 아니라 통계였다 (2026-08-08 코드리뷰) —
  // 겹침은 위에서 잡으므로, 합이 모자라면 그만큼이 어느 칸에도 안 속한 구멍이다
  const area = CELLS.reduce((s, c) => s + (c.x1 - c.x0) * (c.z1 - c.z0), 0);
  const floor = FLOOR.x * FLOOR.z;
  if (Math.abs(area - floor) > 0.5) {
    bad.push(`칸 합계 ${area.toFixed(1)}㎡ 가 외곽 ${floor}㎡ 와 다르다 — 평면에 구멍이 있다`);
  }
  return { faults: bad, area: +area.toFixed(1), floor, cells: CELLS.length };
}

// ── 문이 실제로 이어지나 ───────────────────────────────────────────────────
//
// 실내에만 있는 실패다. 벽으로 완전히 막힌 방이 하나라도 있으면 그 방은
// 존재하지 않는 것과 같다. 도시의 "간판이 죽었다" 와 같은 부류 —
// 빌드는 성공하고 화면도 멀쩡한데 걸어갈 수가 없다.
export function checkReach(startId = 'plaza') {
  const link = new Map(CELLS.map((c) => [c.id, new Set()]));
  // 'solid' 만 못 지나간다. 소핏(높이차)은 바닥에서 트여 있으므로 통행 가능한데,
  // openness() 는 가공 전 규칙을 주므로 그 자리가 'open' 으로 온다.
  for (const [k, rule] of openness()) {
    if (rule === 'solid') continue;
    const [a, b] = k.split('|');
    link.get(a).add(b);
  }
  const seen = new Set([startId]);
  const q = [startId];
  while (q.length) for (const n of link.get(q.pop())) if (!seen.has(n)) (seen.add(n), q.push(n));
  return {
    reached: seen.size,
    total: CELLS.length,
    unreachable: CELLS.filter((c) => !seen.has(c.id)).map((c) => c.id),
  };
}

// ── 개구부 ─────────────────────────────────────────────────────────────────
//
// 벽 구간 하나에 뚫릴 문. [a, b] 는 벽이 뻗는 축 위의 구간이다.
// **좁은 구간에는 문을 못 낸다** — 그냥 막으면 그 방이 갇히므로 세어 신고한다.
const GAPS = { door: W.door, wide: W.doorWide, glass: W.door };

export function openingsOf(run) {
  const width = GAPS[run.rule];
  if (!width) return { gaps: [], tooNarrow: false };
  const span = run.b - run.a;
  // 문틀 양옆으로 최소 0.25m 는 벽이 남아야 한다
  if (span < width + 0.5) return { gaps: [], tooNarrow: true };
  const m = (run.a + run.b) / 2;
  return { gaps: [[m - width / 2, m + width / 2]], tooNarrow: false };
}


// ── 붙일 자리 ──────────────────────────────────────────────────────────────
//
// **소품은 붙을 면을 물어봐야 한다.** 좌표를 손으로 적으면 벽을 옮기는 순간
// 소화기가 허공에 뜬다 — 이 저장소에서 같은 종류의 결함이 네 번 났다
// (model-test/character.md 5.1).
//
// 돌려주는 것: 이 칸 **안쪽에서 본** 벽면들. 문 자리는 이미 빠져 있다.
//   axis     'x' 면 x 로 뻗는 면
//   at       벽면의 고정 좌표 (벽 두께의 안쪽 표면)
//   a, b     뻗는 범위
//   inward   방 안쪽을 향하는 부호 (+1 / -1). 소품을 이만큼 밀어 넣는다
//   h        그 자리의 천장 높이
export function interiorWalls(cellId) {
  const c = byId[cellId];
  const cx = (c.x0 + c.x1) / 2;
  const cz = (c.z0 + c.z1) / 2;
  const out = [];
  for (const run of wallRuns()) {
    if (run.from !== cellId && run.to !== cellId) continue;
    if (run.rule === 'upstand') continue;
    const inward = run.axis === 'x' ? Math.sign(cz - run.at) : Math.sign(cx - run.at);
    if (!inward) continue;
    const face = run.at + (inward * W.wall) / 2;
    const { gaps } = openingsOf(run);
    // 문 자리를 뺀 조각들. 문틀 옆 0.2m 도 비워 둔다.
    let cur = run.a;
    const pieces = [];
    for (const [g0, g1] of gaps) {
      pieces.push([cur, g0 - 0.2]);
      cur = g1 + 0.2;
    }
    pieces.push([cur, run.b]);
    for (const [a, b] of pieces) {
      if (b - a < 0.6) continue;
      out.push({ axis: run.axis, at: face, a, b, inward, h: c.h, rule: run.rule });
    }
  }
  return out;
}

// 벽면 위의 점을 세계 좌표로. d 는 벽에서 방 안쪽으로 띄우는 거리.
export function onWall(w, t, d) {
  const u = w.a + (w.b - w.a) * t;
  return w.axis === 'x' ? [u, w.at + w.inward * d] : [w.at + w.inward * d, u];
}
