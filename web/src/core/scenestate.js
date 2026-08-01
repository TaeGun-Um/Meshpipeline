// 씬 상태 계약 — **빌드 한 번의 수명을 갖는 것**은 전부 여기 등록한다.
//
// ── 왜 이 파일이 있는가 ────────────────────────────────────────────────────
//
// 생성기들은 모듈 수준에 상태를 들고 있다. 배치 원장(placement.items), 지면
// 계획(siteplan.claims), 격자 캐시(layout.ROADS_CACHE), 시장 집계(market.TALLY)
// 처럼 **한 번의 빌드 동안만 유효한** 것들이다.
//
// 이걸 비우는 일이 지금까지 손으로 이뤄졌다.
//
//   night-city/index.js   resetPlan() · resetLedger()
//   night-city/towers.js  resetMarketTally()
//   나머지 열두 개        아무도 안 비운다 (게으른 캐시라 우연히 굴러갔다)
//
// 씬이 둘일 때는 굴러갔다. **셋이 되는 순간 깨진다** — 새 씬이 `resetPlan()`
// 을 안 부르면 이전 씬의 자리 예약이 남고, 그것도 예외가 아니라 **조용히**
// 섞인다. 터지지 않는 오류가 이 프로젝트에서 제일 오래 살아남았다
// (docs/status.md 2장이 전부 그 종류다).
//
// ── 그래서 뒤집는다 ────────────────────────────────────────────────────────
//
// 씬이 "나는 이것들을 비운다" 고 기억하는 대신, **상태를 가진 모듈이 스스로
// 등록**한다. `core/scene.js` 의 build() 가 createWorld() 앞에서 한 번 훑는다.
// 새 씬을 만드는 사람은 아무것도 안 해도 되고, 새 상태를 만드는 사람은
// 자기 파일에서 한 줄만 적으면 된다.
//
//   let CACHE = null;
//   onSceneReset('구역 캐시', () => { CACHE = null; });
//
// 등록은 **모듈을 import 하는 시점**에 일어난다. scenes/index.js 가 모든 씬을
// 정적으로 import 하므로 어떤 씬을 띄우든 목록은 같다 — 안 쓰는 모듈의 리셋이
// 한 번 더 도는 것은 비용이 없다.

const resets = [];

// label 은 진단용이다. `__resets()` 로 "무엇이 등록돼 있나" 를 보려면 필요하고,
// 등록을 빠뜨렸을 때 목록을 눈으로 훑어 찾는 것이 유일한 방법이기도 하다.
export function onSceneReset(label, fn) {
  if (typeof fn !== 'function') throw new Error(`onSceneReset('${label}'): 함수가 아니다`);
  resets.push({ label, fn });
  return fn;
}

// 빌드 시작마다 한 번. core/scene.js 가 부른다 — 씬이 직접 부르지 않는다.
export function resetSceneState() {
  for (const r of resets) r.fn();
  return resets.length;
}

// 진단용. 새 모듈에 상태를 만들고 등록을 잊었는지 여기서 확인한다.
export function sceneResetList() {
  return resets.map((r) => r.label);
}
