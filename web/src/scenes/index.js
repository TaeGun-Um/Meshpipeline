// 저장된 씬 목록.
//
// 씬은 지우지 않고 쌓는다. 만들어 둔 씬은 그대로 다시 띄울 수 있어야 한다 —
// 파이프라인 회귀를 재현할 때, 리팩터링이 렌더 결과를 바꾸지 않았는지 확인할 때,
// 그리고 나중에 같은 생성기를 다른 값으로 쓸 때 참고할 때 필요하다.
//
//   web/                       활성 씬 (아래 ACTIVE)
//   web/?scene=vacant-lot      1번 씬
//   web/?scene=night-city      2번 씬
//   web/?scene=model-test      3번 씬 (활성 — 아무것도 안 붙이면 여기가 뜬다)
//
// ── 씬을 새로 추가하는 방법 ─────────────────────────────────────────────────
//   1. scenes/<id>/index.js 에서 core/scene.js 의 Scene 을 상속하고
//      surfaceHeight() 와 createWorld() 를 구현한다
//   2. 그 모듈을 default export 로 인스턴스 하나 내보낸다
//   3. 아래 SAVED 배열에 추가한다 (기존 항목은 건드리지 않는다)
//
// ── 계층 ────────────────────────────────────────────────────────────────────
//   core/       엔진. 씬을 하나도 모른다.
//   shared/     둘 이상의 씬이 쓰는 레시피.
//   scenes/<씬>/ 그 장소만의 배치·치수·고유 재질.
//   자세한 경계 기준은 shared/index.js 주석 참고.
import vacantLot from './vacant-lot/index.js';
import nightCity from './night-city/index.js';
import modelTest from './model-test/index.js';

// 만든 순서대로. 번호가 곧 만든 순서다.
export const SAVED = [
  {
    scene: vacantLot,
    made: '2026-07-30',
    note: '기준 씬. 좌표계·조명 규약을 실측으로 확정했고 파이프라인 79항목이 여기서 통과했다.',
  },
  {
    scene: nightCity,
    made: '2026-08-01',
    note: '사이버펑크 야간 도시. 프리캠 전용. 블룸·지수안개·씬 환경맵·빛 웅덩이를 도입했다.',
  },
  {
    scene: modelTest,
    made: '2026-08-02',
    note: '모델 테스트. 바닥·하늘·1m 나무 상자 하나뿐이다. 형태를 하나씩 만들어 보는 자리.',
  },
];

export const SCENES = Object.fromEntries(SAVED.map((e) => [e.scene.meta.id, e.scene]));

// ── 뷰포트 목록 ────────────────────────────────────────────────────────────
//
// 우측 상단 햄버거가 읽는 목록이다 (src/scenemenu.js). 번호는 **만든 순서**이고
// `SAVED` 의 순서가 곧 번호다 — 따로 필드를 두면 배열과 어긋난다.
//
// 전환은 `?scene=<id>` 로 **페이지를 다시 연다.** 인페이지 교체가 아니다.
// 그 이유는 요구사항이 "이전 씬 메모리를 지우고 처음 켤 때처럼 빌드" 이고,
// 그게 정확히 새로고침의 동작이기 때문이다. 지금 인페이지로 바꾸면 전환마다
// 텍스처 213MB 와 지오메트리가 GPU 에 남는다 — 씬 해제 계약(`Scene.dispose`,
// 재질 캐시 씬 스코프화)이 아직 없다. 필요해지면 그때 세운다.
export function sceneList() {
  return SAVED.map((e, i) => ({
    no: i + 1,
    id: e.scene.meta.id,
    name: e.scene.meta.name,
    made: e.made,
    note: e.note,
  }));
}

// 활성 씬 — 새로 만든 것이 기본이다.
const ACTIVE = SAVED[SAVED.length - 1].scene.meta.id;

export function activeScene() {
  const want = new URLSearchParams(location.search).get('scene');
  const scene = SCENES[want] || SCENES[ACTIVE];
  if (want && !SCENES[want]) {
    console.warn(
      `알 수 없는 씬 '${want}' — '${scene.meta.id}' 로 대체한다. ` +
        `저장된 씬: ${Object.keys(SCENES).join(', ')}`
    );
  }
  return scene;
}
