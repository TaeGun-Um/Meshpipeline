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
  plaza: 5.6, // 두 배 이상. 창이 없으니 높이가 유일한 위계다
  slab: 0.35, // 마감 천장과 구조 슬래브 사이 (덕트·배관이 지나간다)
};

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
export const FLOOR = { x: 48, z: 34 };
const X = FLOOR.x / 2;
const Z = FLOOR.z / 2;

// 플라자를 가운데 두고 고리 복도가 감싼다. 방은 고리 바깥에 붙는다.
// 지하에서 길을 잃지 않으려면 복도가 직선으로 만나야 한다 (facility.md 1장).
const PX = 9.0; // 플라자 반폭
const PZ = 7.0;
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

export const CELLS = [
  cell('plaza', 'plaza', -PX, -PZ, PX, PZ, H.plaza),

  // 고리 복도 넷
  cell('ringN', 'corridor', -RX, PZ, RX, RZ, H.corridor),
  cell('ringS', 'corridor', -RX, -RZ, RX, -PZ, H.corridor),
  cell('ringW', 'corridor', -RX, -PZ, -PX, PZ, H.corridor),
  cell('ringE', 'corridor', PX, -PZ, RX, PZ, H.corridor),

  // 서쪽 — 카페테리아와 창고
  cell('cafe', 'cafeteria', -X, -3.0, -RX, RZ, H.room),
  cell('storeW', 'room', -X, -RZ, -RX, -3.0, H.room, 'store'),

  // 동쪽 — 서버룸과 사무실
  cell('server', 'server', RX, -1.0, X, RZ, H.room),
  cell('officeE', 'room', RX, -RZ, X, -1.0, H.room, 'office'),

  // 북쪽 — 사무실 둘 (고리 복도에서 북쪽 지선이 갈라진다)
  cell('spurN', 'corridor', -W.spur / 2, RZ, W.spur / 2, Z, H.corridor),
  cell('officeNW', 'room', -X, RZ, -W.spur / 2, Z, H.room, 'office'),
  cell('officeNE', 'room', W.spur / 2, RZ, X, Z, H.room, 'office'),

  // 남쪽 — 트램 승강장으로 나가는 지선과 설비실
  cell('spurS', 'corridor', -W.spur / 2, -Z, W.spur / 2, -RZ, H.corridor),
  cell('utilSW', 'room', -X, -Z, -W.spur / 2, -RZ, H.room, 'util'),
  cell('utilSE', 'room', W.spur / 2, -Z, X, -RZ, H.room, 'util'),
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
  'cafeteria|cafeteria': 'open',
  'cafeteria|corridor': 'wide',
  'cafeteria|plaza': 'wide',
  'cafeteria|room': 'solid',
  'cafeteria|server': 'solid',
  'corridor|corridor': 'open',
  'corridor|plaza': 'open',
  'corridor|room': 'door',
  'corridor|server': 'glass',
  'plaza|plaza': 'open',
  'plaza|room': 'door',
  'plaza|server': 'glass',
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

// ── 경계를 훑어 구간으로 쪼갠다 ────────────────────────────────────────────

const EPS = 1e-4;
const cellAt = (x, z) =>
  CELLS.find((c) => x > c.x0 + EPS && x < c.x1 - EPS && z > c.z0 + EPS && z < c.z1 - EPS) || null;

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
    raw.push({ a, b, other, rule: other ? pairRule(c.kind, other.kind) : 'solid' });
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
  // 바닥 면적이 외곽을 채우나 — 빈 틈은 걸어 들어가면 허공이다
  const area = CELLS.reduce((s, c) => s + (c.x1 - c.x0) * (c.z1 - c.z0), 0);
  return { faults: bad, area: +area.toFixed(1), floor: FLOOR.x * FLOOR.z, cells: CELLS.length };
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
