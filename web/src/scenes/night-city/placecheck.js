// 나이트시티 배치 검사 — 인수인계서가 "다음에 만들면 좋은 것" 으로 남긴 것.
//
// docs/handover.md 4장이 검증의 구멍을 이렇게 적어 뒀다.
//
//   verify.mjs      화면이 달라졌다     |  무엇이 사라졌는지는 모른다
//   __audit 예산    너무 많다           |  배치가 틀렸다는 모른다
//   __audit 하한    통째로 사라졌다     |  하나씩 어긋난 것은 모른다
//   (없음)          —                   |  **허공에 뜬 것 · 관통**
//
// 그리고 검사할 것 넷을 지목했다. 그대로 만든다.
//
//   1) 차량이 연석 안에 있나          (손으로 한 번 해봤고 유효했다)
//   2) 건물끼리 겹치나                (슬럼 관통이 이걸로 잡혔을 것)
//   3) 브릿지·데크의 양 끝이 닿나
//   4) 홀로그램이 인도 폭을 넘나
//
// ── 왜 '인도 폭' 을 안 쓰고 도로를 쓰는가 ──────────────────────────────────
// 4번을 곧이곧대로 "인도 폭보다 멀리 나갔나" 로 짜면 **인도 폭을 두 곳에서
// 계산**하게 된다. 그게 간판 1,602개를 9개로 죽인 결합 오류였다
// (docs/status.md 2.1). 검사가 그 실수를 다시 저지르면 검사를 못 믿는다.
//
// 그래서 반대로 본다. 인도는 "블록 가장자리와 차도 사이" 이므로,
// **차도를 침범했나** 를 물으면 인도 폭을 몰라도 같은 것을 잡는다.
// 차도는 layout.roads() 하나로 정의된다.
import {
  ledgerOf,
  overlappingPairs,
  supportAt,
  scanInstanced,
  overlapXZ,
  overlapY,
  lowBox,
} from '../../core/placement.js';
import { roads, roadAt } from './layout.js';
import { allWalks } from './parcel.js';

// ── 차도 ───────────────────────────────────────────────────────────────────
//
// 도로 정의는 `layout.roads()` 하나에서 온다 — 블록 판 사이에 남은 공간이다.
//
// 검사가 처음에는 여기서 도로를 **따로 계산했다.** 답은 같았지만 그것
// 자체가 이 프로젝트가 아홉 번 반복한 실수(같은 값을 두 곳에서 계산)와
// 같은 모양이다. 나중에 도로 모델이 바뀌면 검사만 옛 모델을 보게 된다.
//
// 검사가 검사 대상과 **같은 출처**를 봐도 되는 이유: 여기서 보는 것은
// "도로가 어디인가" 가 아니라 "그려진 물건이 그 도로 밖으로 나갔는가" 다.
// 물건의 위치는 지오메트리에서 읽으므로 두 값의 출처가 여전히 다르다.

// 상자가 차도를 얼마나 파고들었나 (m). 0 이면 안 넘었다.
//
// 인도 위 물건에만 쓴다. 브릿지는 도로를 건너는 것이 일이므로 대상이 아니다.
//
// ── axis 를 왜 받는가 (처음에 틀렸다) ──────────────────────────────────────
// 처음에는 두 축을 다 보고 큰 쪽을 썼다. 그러자 홀로 광고판 하나가 "22m
// 침범" 으로 나왔다 — 도로 폭이 통째로 22m 이니 말이 안 되는 값이다.
//
// 원인은 **다른 것을 재고 있었다**는 것이다. 건물 정면에 붙은 광고판은
// 정면을 따라 길다. 그 긴 축이 옆 교차로 위로 조금 나가는 것은 공중에
// 뜬 판이 도로를 지나는 것일 뿐, "인도 폭을 넘었다" 와는 다른 사건이다.
//
// 우리가 잡으려는 것은 **건물 면에서 바깥으로 얼마나 나갔나** 하나뿐이다
// (7번 버그 — 홀로그램이 인도를 관통). 그래서 물건이 어느 면에 붙었는지를
// 받아 **그 축만** 본다. axis 가 없으면(독립해 선 것) 둘 다 본다.
function roadIntrusion(box, bands, axis) {
  let worst = 0;
  for (const { lo, hi } of bands) {
    if (axis !== 'z') {
      const ox = Math.min(box.x1, hi) - Math.max(box.x0, lo);
      if (ox > worst) worst = ox;
    }
    if (axis !== 'x') {
      const oz = Math.min(box.z1, hi) - Math.max(box.z0, lo);
      if (oz > worst) worst = oz;
    }
  }
  return Math.max(0, worst);
}

// 겹침을 몇 m 부터 보고할 것인가.
//
// 0 으로 두면 못 쓴다. 필지는 서로 0.7~2.8m 떨어져 있지만 차양·돌출 간판은
// **일부러** 필지 밖으로 나가고, 외접 상자는 비스듬한 것을 실제보다 크게
// 잡는다. 그 둘이 만나면 멀쩡한 이웃이 전부 목록에 오른다.
//
// 1.5m 는 "사람이 지나갈 틈이 사라진" 선이다. 이보다 깊이 겹치면 차양이
// 스치는 정도가 아니라 벽이 벽을 뚫은 것이다.
const OVERLAP_MIN = 1.5;

// 브릿지·계단의 끝이 건물에서 이만큼 떨어져 있어도 닿은 것으로 본다.
// 건물 외벽은 필지 안쪽에 있고 난간·설비가 그 앞에 붙으므로 0 을 요구하면
// 멀쩡한 것이 전부 걸린다.
const END_MARGIN = 2.0;

export function checkPlacement(scene) {
  const bands = roads();
  const buildings = ledgerOf('building');
  const decks = ledgerOf('deck');
  const stairs = ledgerOf('stair');
  const bridges = ledgerOf('bridge');
  const holos = ledgerOf('holo');
  const highway = ledgerOf('highway');
  const signs = ledgerOf('sign');
  const fixtures = ledgerOf('fixture');
  const alleys = ledgerOf('alley');
  // 기업 군집의 공유 기단. 'building' 과 따로 두는 이유는 그 안에 선 타워들과
  // 겹쳐 관통 경고가 뜨기 때문이다. 다만 **간판이 붙는 벽으로는 유효**하다.
  const podiums = ledgerOf('podium');

  // 주차 차량은 MeshBuilder 가 아니라 InstancedMesh 다. 행렬에서 직접 읽는다 —
  // 회전한 차를 외접 상자로 보면 연석 여유 30cm 짜리 판정이 거짓 실패를 낸다.
  scanInstanced(scene, 'ParkedBodies', 'car', { keepPoints: true });
  const cars = ledgerOf('car');

  const faults = [];
  const add = (kind, msg, detail) => faults.push({ kind, msg, detail });

  // ── 1) 건물끼리 관통 ─────────────────────────────────────────────────────
  const hits = overlappingPairs(buildings, { min: OVERLAP_MIN, cell: 90, needY: true });
  if (hits.length) {
    const w = hits[0];
    add(
      '건물 관통',
      `건물 ${hits.length}쌍이 ${OVERLAP_MIN}m 넘게 겹친다 (최대 ${w.amount.toFixed(1)}m)`,
      hits.slice(0, 12).map((h) => ({
        a: h.a.label, aZone: h.a.meta?.zone,
        b: h.b.label, bZone: h.b.meta?.zone,
        x: +h.x.toFixed(2), z: +h.z.toFixed(2),
      }))
    );
  }

  // ── 1b) 고가도로가 건물을 관통하나 ──────────────────────────────────────
  //
  // 고가도로는 **도로 위**를 지나야 한다. 전에는 표시를 안 걸어 원장에
  // 없었고, 그래서 상판이 블록 한가운데를 남북으로 관통하는데도 검사가
  // 아무 말을 안 했다 — 검사의 사각지대였다.
  //
  // 상판(y=26)은 낮은 건물 위를 지나는 것이 정상이므로 높이가 겹치는
  // 것만 본다. overlappingPairs 와 같은 판정이되 대상이 하나뿐이라
  // 직접 훑는다.
  const pierced = [];
  for (const h of highway) {
    for (const bl of buildings) {
      const ov = overlapXZ(h, bl);
      if (ov.x <= 1.0 || ov.z <= 1.0) continue;
      if (overlapY(h, bl) <= 1.0) continue;
      pierced.push({ b: bl.label, zone: bl.meta?.zone, x: +ov.x.toFixed(1), z: +ov.z.toFixed(1) });
    }
  }
  if (pierced.length) {
    pierced.sort((a, b2) => b2.x - a.x);
    add('고가도로 관통', `고가도로가 건물 ${pierced.length}동을 관통한다`, pierced.slice(0, 12));
  }

  // ── 2) 차량이 연석 안에 있나 ─────────────────────────────────────────────
  //
  // 차는 한쪽 차도에 나란히 선다. 그러므로 **네 꼭짓점 전부**가 X 축 차도 띠
  // 안이거나, 전부 Z 축 차도 띠 안이어야 한다. 한 축이라도 전부 만족하면 통과.
  //
  // 띠는 블록 판 사이의 실제 빈 공간이다 (layout.roads). 상수 22m 가 아니다 —
  // 그 차이가 이 검사의 존재 이유다.
  const outCars = [];
  for (const c of cars) {
    const pts = c.meta?.pts;
    if (!pts) continue;
    let okX = true;
    let okZ = true;
    let worst = 0;
    for (const p of pts) {
      const bx = roadAt(p[0]);
      const bz = roadAt(p[2]);
      if (!bx) okX = false;
      if (!bz) okZ = false;
      // 연석에서 얼마나 벗어났나 — 가장 가까운 띠 기준
      const over = (hit, v) =>
        hit ? 0 : Math.min(...bands.map(({ lo, hi }) => (v < lo ? lo - v : v > hi ? v - hi : 0)));
      worst = Math.max(worst, Math.min(over(bx, p[0]), over(bz, p[2])));
    }
    if (!okX && !okZ) outCars.push({ label: c.label, over: +worst.toFixed(2) });
  }
  if (outCars.length) {
    outCars.sort((a, b) => b.over - a.over);
    add(
      '차량이 연석 밖',
      `주차 ${outCars.length}대가 차도를 벗어나 인도·건물로 들어갔다 (최대 ${outCars[0].over}m)`,
      outCars.slice(0, 12)
    );
  }

  // ── 2.5) 건물이 보행로를 침범했나 ──────────────────────────────────────
  //
  // 보행로는 대지 안을 관통하는 사람 길이다 (parcel.js). blockLots 가 필지에서
  // 먼저 빼내므로 건물이 올 수 없어야 하는데, 차양·돌출 간판·군집 기단처럼
  // **필지 밖으로 나가는 것**들이 있어 실제로 침범할 수 있다.
  //
  // 길이 막히면 그 길은 없는 것과 같다. 도로 침범과 같은 급으로 잡는다.
  const onWalks = [];
  for (const w of allWalks()) {
    const r = w.rect;
    for (const bd of buildings) {
      const lb = lowBox(bd) || bd;
      const ox = Math.min(lb.x1, r.x1) - Math.max(lb.x0, r.x0);
      const oz = Math.min(lb.z1, r.z1) - Math.max(lb.z0, r.z0);
      if (ox <= 1.0 || oz <= 1.0) continue;
      // 띠의 짧은 축으로 얼마나 먹었나 — 그게 통행 폭을 줄인 양이다
      const eat = w.axis === 'x' ? ox : oz;
      if (eat < 1.5) continue;
      onWalks.push({ label: bd.label, 먹은폭: +eat.toFixed(1), 길폭: +(w.axis === 'x' ? r.x1 - r.x0 : r.z1 - r.z0).toFixed(1) });
    }
  }
  if (onWalks.length) {
    onWalks.sort((a2, b2) => b2.먹은폭 - a2.먹은폭);
    add(
      '건물이 보행로를 먹음',
      `건물 ${onWalks.length}채가 보행로를 1.5m 넘게 침범했다 (최대 ${onWalks[0].먹은폭}m)`,
      onWalks.slice(0, 12)
    );
  }

  // ── 2.7) 간판끼리 겹쳤나 ────────────────────────────────────────────────
  //
  // **이 검사가 없어서 몰랐다.** 건물 관통·브릿지 부유·보행로 침범은 잡는데
  // 간판끼리는 아무도 안 봤고, 사용자가 화면을 보고서야 나왔다.
  //
  // 원인은 간판 요청에 면 위 가로 위치가 없어서 한 면의 모든 간판이 가운데
  // 한 줄로 쌓인 것이었다 (signage.layoutSigns 머리말).
  //
  // 간판은 얇은 판이라 상자가 겹치면 그건 거의 확실히 **같은 자리에 두 장**
  // 이다. 문턱을 낮게 잡아도 거짓 양성이 잘 안 난다.
  const signHits = overlappingPairs(signs, { min: 0.25, cell: 40, needY: true });
  if (signHits.length) {
    add(
      '간판끼리 겹침',
      `간판 ${signHits.length}쌍이 겹친다 (최대 ${signHits[0].x.toFixed(1)}m)`,
      signHits.slice(0, 12)
    );
  }

  // ── 3) 양 끝이 무언가에 닿나 ─────────────────────────────────────────────
  //
  // 브릿지는 앵커 쌍에서 골라 이미 닿아야 한다. 계단은 위 끝이 데크에,
  // 아래 끝이 지면에 닿아야 한다. 여기서 걸리면 "허공에서 시작해 허공에서
  // 끝나는" 5번 버그가 되살아난 것이다.
  // ── 원장의 상자로는 부족하다 (사용자 지적으로 고침) ──────────────────────
  //
  // "가끔은 아직 공중에 덩그러니 브릿지가 떠있는 경우도 있음"
  //
  // 원장에 올라가는 상자는 그 건물이 그린 것 **전부의 바운딩 박스**다.
  // 저층이 넓고 위가 좁은 형태(잡거타워·세트백·기업 타워)에서는 그 박스가
  // 대지 전체가 되고, 꼭대기 높이의 대지 모서리도 "건물 안" 으로 통과한다.
  // 검사는 초록불인데 화면에서는 허공이다.
  //
  // 그래서 **꼭대기 근처에서는 좁힌 상자**로 다시 묻는다. 브릿지 끝이
  // 건물 윗면 3m 안쪽이면 그 높이에서 실제로 채워진 곳이어야 한다.
  // 생성기가 `cap`(꼭대기 사각형)을 신고했으면 그것을, 아니면 원장 상자를
  // 쓴다 — 신고한 것이 없으면 예전과 같이 관대하게 본다.
  const tops = buildings.map((it) => (it.meta?.cap
    ? { ...it, x0: it.meta.cap[0], z0: it.meta.cap[1], x1: it.meta.cap[2], z1: it.meta.cap[3] }
    : it));
  const floating = [];
  for (const it of bridges) {
    const ends = it.meta?.ends || [];
    for (const e of ends) {
      const near = supportAt(e[0], e[1], e[2], buildings, { margin: END_MARGIN, roof: 3 });
      if (!near) {
        floating.push({ label: it.label, at: e.map((v) => +v.toFixed(1)) });
        continue;
      }
      // 꼭대기 부근이면 좁힌 상자로 한 번 더 본다
      if (e[1] > near.y1 - 3 && !supportAt(e[0], e[1], e[2], tops, { margin: END_MARGIN, roof: 3 })) {
        floating.push({ label: it.label, at: e.map((v) => +v.toFixed(1)), why: '옥상 사각형 밖' });
      }
    }
  }
  if (floating.length) {
    add(
      '브릿지 끝이 허공',
      `브릿지 끝 ${floating.length}곳이 어떤 건물에도 안 닿는다`,
      floating.slice(0, 12)
    );
  }

  // ── 데크가 건물에 붙어 있나 ──────────────────────────────────────────────
  //
  // 데크는 건물 정면 **밖**에 있으므로 끝점이 건물 안일 수 없다. 대신
  // "데크 상자가 어떤 건물 상자와 맞닿아 있나" 를 본다. 어디에도 안 닿으면
  // 그건 길 한가운데 뜬 판이다.
  const looseDecks = [];
  for (const d of decks) {
    const grown = { x0: d.x0 - 1.5, x1: d.x1 + 1.5, z0: d.z0 - 1.5, z1: d.z1 + 1.5 };
    let touch = false;
    for (const bl of buildings) {
      const ov = overlapXZ(grown, bl);
      if (ov.x > 0 && ov.z > 0 && bl.y1 >= d.y0) { touch = true; break; }
    }
    if (!touch) looseDecks.push(d.label);
  }
  if (looseDecks.length) {
    add('데크가 안 붙음', `2층 데크 ${looseDecks.length}개가 어떤 건물에도 안 닿는다`, looseDecks.slice(0, 12));
  }

  // ── 데크에 올라갈 계단이 있나 ────────────────────────────────────────────
  //
  // status.md 1.3 — "올라갈 수 있는 곳이 실제로는 없다". 계단이 데크와 실제로
  // 만나는지를 숫자로 본다. 형태만 있고 동선이 없으면 여기서 드러난다.
  let reachable = 0;
  for (const d of decks) {
    for (const s of stairs) {
      const top = s.meta?.ends?.[1];
      if (!top) continue;
      if (top[0] >= d.x0 - 2 && top[0] <= d.x1 + 2 && top[2] >= d.z0 - 2 && top[2] <= d.z1 + 2) {
        reachable++;
        break;
      }
    }
  }
  if (decks.length && reachable < decks.length) {
    add(
      '데크에 못 올라감',
      `데크 ${decks.length}개 중 계단이 닿는 것은 ${reachable}개뿐이다`,
      { decks: decks.length, stairs: stairs.length, reachable }
    );
  }

  // ── 5) 간판이 건물에 붙어 있나 ──────────────────────────────────────────
  //
  // 간판은 벽에 붙는 물건이다. 어느 건물에도 안 닿으면 허공에 뜬 것이다.
  // 실제로 벽감 깊이(1.3m)를 빼먹어 세로 간판이 벽에서 떠 있던 적이 있다.
  //
  // 판정은 넉넉하게 한다 — 간판은 벽에서 STANDOFF(0.3m) 만큼 띄우고, 세로
  // 간판은 폭만큼 더 튀어나온다. 그래서 '겹침' 이 아니라 '가까움' 을 본다.
  //
  // ── 높이 여유를 8m 로 둔 이유 (검사가 처음에 틀렸다) ────────────────
  // 처음에는 "간판 밑면이 건물 옥상보다 1m 넘게 높으면 뜬 것" 으로 봤다.
  // 그러자 **옥상 대형 광고 8개**가 걸렸다 — 적층 상가가 지붕 위에 얹는
  // 것이라 옥상보다 1.4m 높은 게 정상이다. 평면으로는 0m 로 겹쳐 있었다.
  //
  // 옥상 간판은 받침 위에 서므로 몇 미터 뜬다. 그래서 여유를 8m 로 둔다.
  // 그보다 위면 어느 지붕에도 안 얹힌 것이다.
  const ROOF_SIGN = 8;
  // 받침도 벽이다. 처음에는 buildings 만 봐서 **기업 로비 배너 8개**를
  // "허공" 으로 잡았다 — 받침에서 0m 로 붙어 있는데 타워까지는 13~22m 였다.
  const walls = [...buildings, ...podiums];
  const floatSigns = [];
  for (const sg of signs) {
    const grown = { x0: sg.x0 - 2.5, x1: sg.x1 + 2.5, z0: sg.z0 - 2.5, z1: sg.z1 + 2.5 };
    let held = false;
    for (const bl of walls) {
      const ov = overlapXZ(grown, bl);
      if (ov.x > 0 && ov.z > 0 && bl.y1 >= sg.y0 - ROOF_SIGN) { held = true; break; }
    }
    if (!held) floatSigns.push({ label: sg.label, kind: sg.meta?.kind, y: +sg.y0.toFixed(1) });
  }
  if (floatSigns.length) {
    add('간판이 허공', `간판 ${floatSigns.length}개가 어떤 건물에도 안 붙어 있다`, floatSigns.slice(0, 12));
  }

  // ── 6) 골목 벽 높이 검사는 폐기했다 ──────────────────────────────────────
  //
  // 골목을 다시 만들면서 **벽을 안 세우게 됐다.** 이제 골목은 필지를 자른
  // 자리를 벌린 틈이고, 벽은 양옆 건물의 옆면이다 (alley.js 머리말).
  //
  // 그러니 "골목 벽이 이웃 건물보다 높나" 는 물을 수가 없다 — 벽이 곧 그
  // 건물이므로 정의상 같은 높이다. 실제로 이 검사가 벽이 사라진 뒤에도
  // meta.wallH 를 읽고 2건을 신고했다.
  //
  // **기능을 끄면 그 기능을 보는 검사도 같이 봐야 한다.** 골목을 껐을 때
  // allAlleyRects 를 안 껐던 것과 같은 종류다 (status.md 실패 16).

  // ── 4) 인도 위 물건이 차도를 침범하나 ────────────────────────────────────
  //
  // 홀로그램은 7번 버그(인도 관통)의 당사자다. 데크는 인도 폭을 넘으면
  // 아래를 지나는 차량과 겹친다.
  //
  // **지면 범위**로 본다 (placement.lowBox). 머리 위로 뻗은 우듬지·차양이
  // 차도 위를 지나는 것은 결함이 아니라 원래 그런 것이고, 길을 막고 선
  // 기둥·줄기만 결함이다. 상자 하나로 보면 이 둘이 구별되지 않는다.
  const intrude = [];
  for (const it of [...holos, ...decks, ...fixtures]) {
    const low = lowBox(it);
    if (!low) continue; // 전부 머리 위에 있다
    const over = roadIntrusion(low, bands, it.meta?.axis);
    if (over > 0.4) intrude.push({ label: it.label, zone: it.meta?.zone, over: +over.toFixed(2) });
  }
  if (intrude.length) {
    intrude.sort((a, b) => b.over - a.over);
    add(
      '차도 침범',
      `인도 위 물건 ${intrude.length}개가 차도로 나왔다 (최대 ${intrude[0].over}m)`,
      intrude.slice(0, 12)
    );
  }

  return {
    counted: {
      건물: buildings.length,
      데크: decks.length,
      계단: stairs.length,
      브릿지: bridges.length,
      홀로: holos.length,
      고가: highway.length,
      기단: podiums.length,
      간판: signs.length,
      시설물: fixtures.length,
      골목: alleys.length,
      주차: cars.length,
    },
    faults,
    ok: faults.length === 0,
  };
}
