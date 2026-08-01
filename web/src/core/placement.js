// 배치 검사 — "허공에 뜬 것 · 관통" 을 숫자로 본다.
//
// ── 왜 이 파일이 있는가 ────────────────────────────────────────────────────
// 이 프로젝트에서 같은 종류의 실패를 여덟 번 냈다 (docs/status.md 2장).
// 원인은 전부 하나다 — **놓기 전에 그 자리에 무엇이 있는지 묻지 않았다.**
//
// 그런데 검증 쪽에 그걸 볼 눈이 없었다.
//
//   verify.mjs      화면이 달라졌다는 알려주지만 **무엇이** 달라졌는지는 모른다
//   __audit 예산    너무 많다는 잡지만 배치가 틀렸다는 모른다
//   __audit 하한    통째로 사라졌다는 잡지만 하나씩 어긋난 것은 모른다
//   (없음)          **허공에 뜬 것 · 관통** 은 아무것도 안 잡는다
//
// 8번(슬럼 골조가 옆 건물을 관통)이 앞의 셋을 전부 통과했다. 이 파일이 그 구멍이다.
//
// ── 왜 '신고' 가 아니라 '지오메트리' 를 읽는가 ─────────────────────────────
// 모듈이 "나는 여기 이만한 것을 놓았다" 고 신고하게 만드는 쪽이 훨씬 쉽다.
// 그런데 그 신고가 **실제로 그린 것과 어긋날 수 있다.** 8번 버그가 정확히
// 그것이었다 — 회전 후 크기를 계산해 놓고 쓰지 않았다. 신고를 믿는 검사였다면
// 검사도 같이 속아서 통과시켰을 것이다.
//
// 그래서 여기서는 **그려진 지오메트리의 경계**를 읽는다. 어긋날 여지가 없다.
// 그리는 코드를 고치면 검사 대상도 자동으로 따라온다.
//
// ── 왜 축 정렬 상자(AABB)인가 ──────────────────────────────────────────────
// 슬럼은 15~35도 비스듬히 앉는다. 회전한 것을 외접 상자로 감싸면 실물보다
// 커지므로, "외접 상자가 안 겹친다" 는 **실물도 확실히 안 겹친다** 는 뜻이다
// (거짓 통과가 없다). 반대로 외접 상자가 겹치면 실물은 겹칠 수도 아닐 수도
// 있다 — 그래서 겹침은 단정하지 않고 **겹친 양과 함께 보고**한다.
//
// 정확한 판정이 필요한 곳(주차 차량)은 인스턴스 행렬로 여덟 꼭짓점을 직접
// 옮겨 점으로 본다. 아래 scanInstanced 의 keepPoints.
import * as THREE from 'three';

import { onSceneReset } from './scenestate.js';
// ── 기록 ───────────────────────────────────────────────────────────────────
//
// 씬 빌드마다 초기화한다. siteplan.js 의 claims 와 같은 방식 — 배치에 관한
// 상태는 빌드 한 번의 수명을 갖는다.
let items = [];
let open = null;

export function resetLedger() {
  items = [];
  open = null;
}
// 빌드마다 자동으로 비운다. 씬이 기억할 일이 아니다 (core/scenestate.js)
onSceneReset('배치 원장', resetLedger);

export function ledgerOf(kind) {
  return items.filter((it) => it.kind === kind);
}

// 지금 열려 있는 기록이 있는가. MeshBuilder.add 가 매 조각마다 보는 값이라
// 함수 호출 하나로 끝나야 한다.
export function ledgerOpen() {
  return open !== null;
}

// 기록 하나를 연다. 이 뒤에 grow 로 들어오는 지오메트리가 전부 이 하나의
// 외접 상자로 합쳐진다. 건물 한 채가 조각 수백 개인데 우리가 알고 싶은 것은
// "그 건물이 차지한 범위" 하나이기 때문이다.
// ── 낮은 것만 따로 재는 이유 ───────────────────────────────────────────────
//
// 외접 상자 하나로는 "넓은 부분이 높이 있다" 를 표현하지 못한다. 디지털 수목은
// 줄기가 인도 한가운데 서고 우듬지가 차도 위로 뻗는데, 상자 하나로 보면
// "차도를 5m 침범" 으로 나온다. 그런데 머리 위로 뻗은 가지는 결함이 아니다 —
// 실제 가로수도 차양도 그렇게 생겼다.
//
// 그래서 **이 높이 아래에 있는 조각만으로** 평면 범위를 따로 하나 더 잰다.
// 그러면 "길을 막고 서 있나" 와 "머리 위로 지나가나" 가 갈린다. 데크는 상판이
// 6m 위라 안 걸리지만 그것을 받치는 기둥은 지면까지 내려오므로 걸린다 —
// 이것이 정확히 우리가 알고 싶은 것이다.
//
// 4.5m 는 차량이 지나갈 높이다. 이 도시에서 가장 큰 차(밴)가 2.05m 이므로
// 여유가 두 배 넘는다.
const LOW_Y = 4.5;

export function beginItem(kind, label, meta = null) {
  endItem();
  open = {
    kind, label, meta,
    x0: Infinity, y0: Infinity, z0: Infinity,
    x1: -Infinity, y1: -Infinity, z1: -Infinity,
    // 지면 근처(LOW_Y 아래) 조각만의 평면 범위
    lx0: Infinity, lz0: Infinity, lx1: -Infinity, lz1: -Infinity,
  };
}

export function growItem(geometry) {
  if (!open) return;
  geometry.computeBoundingBox();
  const bb = geometry.boundingBox;
  if (!bb || Number.isNaN(bb.min.x)) return;
  if (bb.min.x < open.x0) open.x0 = bb.min.x;
  if (bb.min.y < open.y0) open.y0 = bb.min.y;
  if (bb.min.z < open.z0) open.z0 = bb.min.z;
  if (bb.max.x > open.x1) open.x1 = bb.max.x;
  if (bb.max.y > open.y1) open.y1 = bb.max.y;
  if (bb.max.z > open.z1) open.z1 = bb.max.z;

  // 조각의 아랫면이 기준보다 아래면 지면 범위에도 넣는다
  if (bb.min.y < LOW_Y) {
    if (bb.min.x < open.lx0) open.lx0 = bb.min.x;
    if (bb.min.z < open.lz0) open.lz0 = bb.min.z;
    if (bb.max.x > open.lx1) open.lx1 = bb.max.x;
    if (bb.max.z > open.lz1) open.lz1 = bb.max.z;
  }
}

// 지면 근처 평면 범위. 그 높이에 아무것도 없으면 null (전부 머리 위에 있다).
export function lowBox(it) {
  if (!(it.lx1 > it.lx0)) return null;
  return { x0: it.lx0, x1: it.lx1, z0: it.lz0, z1: it.lz1 };
}

// 열린 기록을 닫고 **그 기록을 돌려준다.**
//
// 생성기가 방금 그린 것의 실제 경계를 곧바로 알아야 할 때가 있다. 브릿지가
// 그 경우다 — 앵커의 rect 는 '필지' 이지 '그린 것' 이 아니라서, 대지를 비우는
// 기업 타워에서는 다리가 광장 허공에 물렸다.
export function takeItem() {
  const it = open;
  endItem();
  return it && it.x1 > it.x0 ? it : null;
}

export function endItem() {
  // 조각이 하나도 안 들어온 기록은 버린다. 조건에 따라 아무것도 안 그리는
  // 생성기가 있고(대지가 작아 광장을 못 내는 기업 타워 등), 그때 빈 상자를
  // 남기면 "0,0 에 점 하나" 가 기록돼 검사가 엉뚱한 것을 잡는다.
  if (open && open.x1 > open.x0) items.push(open);
  open = null;
}

// ── 인스턴스 메시 훑기 ─────────────────────────────────────────────────────
//
// 주차 차량·인파·주행 차량은 MeshBuilder 를 안 쓰고 InstancedMesh 로 그린다.
// 그쪽은 **행렬이 곧 배치**이므로 행렬에서 직접 읽으면 역시 어긋날 여지가 없다.
//
// keepPoints 를 주면 여덟 꼭짓점의 월드 좌표를 함께 남긴다. 회전한 물체를
// 외접 상자로 보면 실제보다 커져서, 연석처럼 여유가 30cm 밖에 없는 판정에서는
// 멀쩡한 것을 걸러낸다. 그런 검사만 점을 쓴다.
const CORNERS = [
  [0, 0, 0], [1, 0, 0], [0, 1, 0], [1, 1, 0],
  [0, 0, 1], [1, 0, 1], [0, 1, 1], [1, 1, 1],
];

export function scanInstanced(scene, name, kind, { keepPoints = false } = {}) {
  let mesh = null;
  scene.traverse((o) => {
    if (o.isInstancedMesh && o.name === name) mesh = o;
  });
  if (!mesh) return 0;

  mesh.geometry.computeBoundingBox();
  const bb = mesh.geometry.boundingBox;
  const lo = [bb.min.x, bb.min.y, bb.min.z];
  const hi = [bb.max.x, bb.max.y, bb.max.z];

  const m = new THREE.Matrix4();
  const v = new THREE.Vector3();
  for (let i = 0; i < mesh.count; i++) {
    mesh.getMatrixAt(i, m);
    const box = { x0: Infinity, y0: Infinity, z0: Infinity, x1: -Infinity, y1: -Infinity, z1: -Infinity };
    const pts = keepPoints ? [] : null;
    for (const c of CORNERS) {
      v.set(c[0] ? hi[0] : lo[0], c[1] ? hi[1] : lo[1], c[2] ? hi[2] : lo[2]).applyMatrix4(m);
      if (v.x < box.x0) box.x0 = v.x;
      if (v.y < box.y0) box.y0 = v.y;
      if (v.z < box.z0) box.z0 = v.z;
      if (v.x > box.x1) box.x1 = v.x;
      if (v.y > box.y1) box.y1 = v.y;
      if (v.z > box.z1) box.z1 = v.z;
      if (pts) pts.push([v.x, v.y, v.z]);
    }
    items.push({ kind, label: `${name}#${i}`, meta: pts ? { pts } : null, ...box });
  }
  return mesh.count;
}

// ── 판정 ───────────────────────────────────────────────────────────────────

// 평면(XZ)에서 겹친 양. 둘 다 양수라야 실제로 겹친 것이다.
// 음수는 "떨어져 있다" 이고 그 절댓값이 간격이다.
export function overlapXZ(a, b) {
  return {
    x: Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0),
    z: Math.min(a.z1, b.z1) - Math.max(a.z0, b.z0),
  };
}

export function overlapY(a, b) {
  return Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0);
}

// 같은 종류끼리 겹친 쌍을 찾는다.
//
// 전수 비교는 O(n²) 이다. 건물 875동이면 38만 번이라 견딜 만하지만, 차량
// 2,506대·사람 5,328명까지 같은 코드로 보게 될 것이므로 균등 격자로 나눈다
// (vertical.createBridges 가 앵커를 나눌 때 쓴 것과 같은 방식).
//
// min 은 이만큼 넘게 겹쳐야 보고한다는 뜻이다. 0 으로 두면 부동소수 오차와
// "일부러 맞붙인 것"까지 전부 걸려서 목록이 쓸모없어진다.
//
// ── plate: 얇은 판은 이 판정으로 **절대 안 걸린다** (사용자 지적으로 발견) ──
//
// "뭔가 다시 간판이 겹치기 시작한거같으니, 상세히 확인해"
//
// 실측하니 겹친 쌍이 271 이었는데 검사는 0 을 보고하고 있었다. 원인은 검사
// 대상이 아니라 **이 함수의 기본 판정**이다.
//
//   if (ov.x <= min || ov.z <= min) continue;      <- x 와 z 를 **둘 다** 요구
//
// 이 요구는 건물에는 맞다. 건물은 두 축이 다 크다. 그런데 간판은 두께
// 0.14~0.3m 짜리 **판때기**다. 같은 벽에 붙은 두 장은 벽 법선 축 겹침이
// 두께를 넘을 수가 없으므로, min 을 0.25 로 두는 순간 **구조적으로 통과**한다.
// 문턱을 낮추는 문제가 아니다 — 낮추면 이번에는 벽 하나에 스치는 것이 전부
// 걸린다. 애초에 재는 축이 틀렸다.
//
// 판에서 의미 있는 겹침은 **판이 놓인 평면 안**에서 잰 것이다. 그래서 세 축
// 겹침 중 **가장 작은 것(= 두께 축)을 버리고** 나머지 둘로 판정한다.
//
//   같은 벽 두 장   x 0.35 · y 1.70 · z 0.14  ->  0.35, 1.70  걸린다 (맞다)
//   모퉁이에서 만남 x 0.14 · y 3.00 · z 0.12  ->  0.14, 3.00  안 걸린다 (맞다)
//
// 이 프로젝트에서 스무 번 나온 결합 오류와 같은 뿌리다: 건물용으로 쓴 헬퍼를
// 판에 그대로 붙이고, **그 판정이 판에서 무엇을 뜻하는지 안 물었다.**
const CONTACT = 0.02; // 실제로 만나기는 하나 — 부동소수 여유
export function overlappingPairs(list, { min = 0.3, cell = 90, needY = true, plate = false } = {}) {
  const grid = new Map();
  const keyOf = (x, z) => `${Math.floor(x / cell)},${Math.floor(z / cell)}`;
  for (const it of list) {
    // 큰 것은 여러 칸에 걸친다. 중심 칸만 담으면 옆 칸의 이웃을 놓친다.
    for (let gx = Math.floor(it.x0 / cell); gx <= Math.floor(it.x1 / cell); gx++) {
      for (let gz = Math.floor(it.z0 / cell); gz <= Math.floor(it.z1 / cell); gz++) {
        const k = `${gx},${gz}`;
        if (!grid.has(k)) grid.set(k, []);
        grid.get(k).push(it);
      }
    }
  }

  const seen = new Set();
  const out = [];
  for (const [, cellItems] of grid) {
    for (let i = 0; i < cellItems.length; i++) {
      for (let j = i + 1; j < cellItems.length; j++) {
        const a = cellItems[i];
        const bIt = cellItems[j];
        // 여러 칸에 걸친 쌍은 칸마다 다시 만난다
        const id = a.label < bIt.label ? `${a.label}|${bIt.label}` : `${bIt.label}|${a.label}`;
        if (seen.has(id)) continue;
        seen.add(id);

        const ov = overlapXZ(a, bIt);
        if (plate) {
          // 판은 세 축이 **다** 만나야 한다. 그 다음 두께 축을 버리고 잰다.
          const oy = overlapY(a, bIt);
          if (ov.x <= CONTACT || ov.z <= CONTACT || oy <= CONTACT) continue;
          const s = [ov.x, ov.z, oy].sort((p, q) => q - p);
          if (s[1] <= min) continue;
          out.push({ a, b: bIt, x: ov.x, y: oy, z: ov.z, amount: s[1] });
          continue;
        }
        if (ov.x <= min || ov.z <= min) continue;
        if (needY) {
          const oy = overlapY(a, bIt);
          if (oy <= min) continue;
        }
        out.push({ a, b: bIt, x: ov.x, z: ov.z, amount: Math.min(ov.x, ov.z) });
      }
    }
  }
  // 심한 것부터
  out.sort((p, q) => q.amount - p.amount);
  return out;
}

// 점이 어떤 상자 안(또는 margin 이내)에 들어가 있나. 브릿지·데크의 끝이
// 무언가에 닿는지를 보는 데 쓴다.
export function supportAt(x, y, z, list, { margin = 1.2, roof = 2.5 } = {}) {
  for (const it of list) {
    if (x < it.x0 - margin || x > it.x1 + margin) continue;
    if (z < it.z0 - margin || z > it.z1 + margin) continue;
    // 옥상보다 위면 닿은 것이 아니다. roof 는 난간·크라운만큼의 여유.
    if (y > it.y1 + roof) continue;
    return it;
  }
  return null;
}

function fmt(n) {
  return Math.round(n * 100) / 100;
}

export { fmt as roundCm };
