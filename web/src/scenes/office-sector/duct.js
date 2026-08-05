// 탈출 덕트 — 장식이 아니라 **길**이다.
//
// 스토리의 오프닝 동선이 이 덕트를 지난다 (story.md 2장): 시작 방(서버관리
// 부서 사무실, officeN3)의 **벽에 뚫린 환기구**를 열고 -> 수평 덕트를 기어 ->
// 화장실(washN) 벽으로 나온다. 레퍼런스는 하프라이프의 환기 덕트다 — 허리
// 아래 벽 개구, 떼어낸 루버 그릴이 옆에 기대어 있고, 어두운 정사각 단면을
// **수평으로** 기어간다. 오르내리는 샤프트는 없다 — 처음에 천장 점검구로
// 올라가는 설계를 했다가 이 원칙으로 재설계했다 (2026-08-05 사용자 결정).
//
// ── 어디를 지나나 — 북측 공동구 ────────────────────────────────────────────
// 지하 1층의 북쪽 외벽 바깥, 벽과 매립 사이의 **공동구(설비 트렌치)** 를
// 지난다 (facility.md 2.4·2.5). 시작 방과 화장실이 둘 다 북쪽 외벽에 붙어
// 있어 포트(벽 개구) 둘을 한 직선 간선이 잇는다. 공동구는 방에서 안 보인다 —
// 보이는 것은 벽의 그릴과, 그릴 너머의 어둠뿐이다.
//
// ── 왜 계획이 따로 있나 ────────────────────────────────────────────────────
// lightPlan 과 같은 자리다. 이 계획 하나를 셋이 나눠 쓴다:
//   shell.buildWalls   포트 자리의 벽을 쪼개어 개구를 뚫는다
//   shell.buildRock    공동구를 남기고 암반을 두른다
//   props.escapeDuct   몸통·슬리브·그릴 커버를 짓는다
//   index -> checkDuct 길이 실제로 이어지는지 잰다
// 각자 좌표를 계산하면 어긋난다 (lessons.md 2.1 결합 대장).
import { CELLS, FLOOR } from './layout.js';

// ── 치수 — facility.md 2.5 가 근거다 ───────────────────────────────────────
export const DUCT = {
  clear: 1.0, // 안치수 (기어갈 단면). 검사 하한은 0.70. 0.78 로 시작했다가
  // 답답해서 키웠다 (2026-08-05 사용자 지시) — 대형 공조 주덕트 급이다
  t: 0.04, // 강판 두께
  sill: 0.12, // 포트 개구 아랫변 = 덕트 안바닥 — 바닥 바로 위라 숙이면
  // 그대로 기어든다 (0.45 였다가 내렸다 — 2026-08-05 사용자 지시).
  // 0 이 아닌 이유: 실물 덕트도 굽도리 높이의 턱 위에 앉고, 공동구 쪽
  // 받침·바닥 강판 두께가 이 밑에 있다
  portW: 0.9, // 포트 개구 폭
  trench: 1.3, // 공동구 폭 — 북쪽 외벽 바깥의 빈 띠 (buildRock 이 남긴다)
};

// ── 계획 ───────────────────────────────────────────────────────────────────
//
// 좌표는 전부 칸에서 유도한다. 포트 둘은 시작 방(use 'start')과 화장실
// (use 'wash')의 **북쪽 외벽**에 앉는다 — 두 방 다 z1 이 층 외곽(Z)이어야
// 한다 (아니면 던진다 — 평면이 바뀌면 여기부터 다시 정한다).
export function ductPlan() {
  const Z = FLOOR.z / 2;
  const start = CELLS.find((c) => c.use === 'start');
  const wash = CELLS.find((c) => c.use === 'wash');
  if (!start || !wash) throw new Error('덕트: use start/wash 칸이 없다 — layout.CELLS 를 본다');
  for (const c of [start, wash]) {
    if (Math.abs(c.z1 - Z) > 1e-4) {
      throw new Error(`덕트: ${c.id} 가 북쪽 외곽에 안 붙어 있다 — 포트를 낼 벽이 없다`);
    }
  }

  const ports = [
    // 시작 방 포트 — 서쪽 벽에서 1m. 화장실과 제일 가까운 쪽이다.
    // lean: 떼어낸 그릴이 기대어 서는 쪽 (+1 동, -1 서) — 그 방의 가구를
    // 비킨 방향이다 (화장실은 동쪽에 부스가 있다).
    { x: start.x0 + 1.0, z: Z, cell: start.id, lean: 1 },
    // 화장실 포트 — 부스 열이 동쪽에서 뻗어와 그릴 오른쪽을 가렸다
    // (2026-08-05 재지적) — 서쪽(트인 쪽)으로 붙인다. 모서리 여유 0.3 은
    // checkDuct 가 지킨다.
    { x: wash.x0 + 1.1, z: Z, cell: wash.id, lean: 1 },
  ];

  const y0 = DUCT.sill - DUCT.t; // 바깥 바닥
  return {
    ...DUCT,
    outer: DUCT.clear + DUCT.t * 2,
    y0,
    floorY: DUCT.sill, // 안바닥 — 포트 아랫변과 같은 높이 (수평으로 기어든다)
    headY: DUCT.sill + DUCT.clear, // 포트 윗변 = 덕트 안천장
    topY: y0 + DUCT.t * 2 + DUCT.clear,
    // 공동구 안의 간선 — 벽 바깥면(Z + 0.1)에서 0.04 띄워 시작한다
    vz0: Z + 0.14, // 몸통 남쪽 바깥면
    vz1: Z + 0.14 + DUCT.clear + DUCT.t * 2, // 몸통 북쪽 바깥면
    runs: [
      // 서쪽 끝은 화장실 포트 너머 0.6 캡, 동쪽 끝은 시작 방 포트 너머 0.6 캡
      { axis: 'x', a: ports[1].x - 0.6, b: ports[0].x + 0.6 },
    ],
    ports,
    startCell: start.id,
    washCell: wash.id,
  };
}

// ── 검사 — 길이 실제로 이어지는가 ──────────────────────────────────────────
//
// checkReach 와 같은 부류다. 덕트가 서 있어도 (a) 단면이 좁거나 (b) 포트가
// 간선 밖이거나 (c) 몸통이 공동구를 벗어나 벽이나 암반을 뚫으면 길이 아니다.
// 화면으로는 "그릴이 있네" 로만 보이므로 숫자로 잰다.
export function checkDuct(p) {
  const faults = [];
  const Z = FLOOR.z / 2;

  if (p.clear < 0.7) faults.push(`덕트 단면 ${p.clear}m — 0.7m 는 되어야 기어간다`);

  // 몸통이 공동구 안에 있는가 — 남쪽으로 벽(Z+0.1), 북쪽으로 암반(Z+trench)
  if (p.vz0 < Z + 0.1 - 0.001) faults.push(`덕트 몸통(${p.vz0.toFixed(2)})이 외벽을 뚫는다`);
  if (p.vz1 > Z + p.trench + 0.001) faults.push(`덕트 몸통(${p.vz1.toFixed(2)})이 암반을 뚫는다`);

  // 포트가 간선 위에 있는가, 제 방 벽 안에 있는가
  for (const d of p.ports) {
    const on = p.runs.some((r) => d.x > r.a + p.portW / 2 && d.x < r.b - p.portW / 2);
    if (!on) faults.push(`${d.cell} 포트가 덕트 간선 밖이다`);
    const c = CELLS.find((q) => q.id === d.cell);
    if (d.x - p.portW / 2 < c.x0 + 0.3 || d.x + p.portW / 2 > c.x1 - 0.3) {
      faults.push(`${d.cell} 포트가 방 모서리에 너무 붙었다`);
    }
  }

  // **길이 성립하는가** — 시작 방과 화장실 양쪽에 포트가 있어야 스토리의
  // 동선이 존재한다. (간선이 하나라 연결성은 "같은 간선 위" 로 충분하다 —
  // 간선이 여럿이 되면 여기에 BFS 를 세운다.)
  for (const id of [p.startCell, p.washCell]) {
    if (!p.ports.some((d) => d.cell === id)) faults.push(`${id} 에 덕트 출입구가 없다 — 탈출 루트가 끊겼다`);
  }

  return { faults, ports: p.ports.length, runs: p.runs.length };
}
