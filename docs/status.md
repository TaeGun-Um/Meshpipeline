# 현재 상태 — 프로젝트 전체

이 문서는 **저장소 전체**의 상태만 본다. 씬 하나하나의 작업 기록은 그 씬
문서에 있다 (`docs/scenes/<id>/status.md`).

---

## 1. 브라우저 뷰 단계 — 지금 우리가 서 있는 곳

이 프로젝트는 두 단계로 나뉜다 (`concepts.md`).

```
1단계  브라우저 뷰       코드로 씬을 짓고, 보면서 다듬는다   <- 지금 여기
2단계  엔진 인계         glb -> fbx -> 유니티, 79항목 검증
```

**브라우저 뷰 단계는 게임 엔진의 뷰포트에 대응한다.** 저장된 씬 중 하나를
띄우고, 그 안의 모델을 대화하면서 고친다. 여기서 "올바른 모습" 이 확정된 뒤에
2단계로 넘어간다. 그래서 이 단계의 도구(회귀 검증·감사·배치 검사)는 전부
**보이는 것을 숫자로 되받는** 쪽에 맞춰져 있다.

씬은 우측 상단 햄버거로 오간다 (`src/scenemenu.js`).

| # | 씬 | 상태 | 문서 |
|---|---|---|---|
| 1 | `vacant-lot` 주택가 공터 | **동결 · 파이프라인 기준 씬.** 좌표계·조명 규약을 여기서 확정했고 79항목이 통과했다. core 회귀의 첫 관문 | [scenes/vacant-lot/](scenes/vacant-lot/status.md) |
| 2 | `night-city` 나이트시티 | **동결.** 여섯 구역 양식과 랜드마크 열. 26뷰가 재현되지 않아 픽셀 회귀 대상이 아니다 — 삼각형 수로 잰다 | [scenes/night-city/](scenes/night-city/status.md) |
| 3 | `model-test` 모델 테스트 | **동결.** 서브컬처 아바타 실험 — 결론과 규칙이 [character.md](scenes/model-test/character.md) 에 있다 | [scenes/model-test/](scenes/model-test/status.md) |
| 4 | `office-sector` 오피스 섹터 | **활성 — 유일한 작업 대상.** 회사 사옥 지하 1층 — 게임 오프닝 무대. 실내 생성기·실내 전용 검사·정점 조명 굽기 | [scenes/office-sector/](scenes/office-sector/status.md) |

**앞으로의 작업은 4번에만 한다** (2026-08-03 사용자 결정). 동결 씬은 빌드
가능한 상태로 보존하고, 값어치는 학습된 데이터 — `lessons.md` 와 씬별 지식
문서 — 로 쓴다. 동결 씬의 작업 계획·백로그는 유지하지 않는다.

### 씬을 새로 추가할 때

1. `web/src/scenes/<id>/index.js` 에서 `core/scene.js` 의 `Scene` 을 상속
2. `web/src/scenes/index.js` 의 `SAVED` 에 추가 (햄버거 목록은 여기서 나온다)
3. `web/shots/views.json` 에 뷰를 등록하고 `__lock('base')` 로 기준을 잡는다
   — **`_tag` 를 씬마다 다르게 준다.** 샷 파일 이름의 접두사이고, 안 주면
   다른 씬의 같은 이름 뷰(`wide` 둘)가 같은 파일을 덮어쓴다
4. 문서는 `docs/scenes/<id>/` 아래에 둔다

**모듈 수준 상태를 새로 만들면 `onSceneReset()` 에 등록한다** (아래 2절).
안 하면 예외가 아니라 이전 씬 잔재가 조용히 섞인다.

---

## 2. 씬 상태 계약 (`core/scenestate.js`)

생성기들은 모듈 수준에 캐시와 장부를 들고 있다. 그것들은 **빌드 한 번의
수명**을 갖는다.

전에는 비우는 일이 손으로 이뤄졌다 — `night-city/index.js` 가 `resetPlan()` 과
`resetLedger()` 를, `towers.js` 가 `resetMarketTally()` 를 불렀고, **나머지
다섯 캐시는 아무도 안 비웠다.** 씬이 하나뿐이라 게으른 캐시가 우연히 굴러간
것이다.

이제 상태를 가진 모듈이 **스스로 등록**하고, `Scene.build()` 가 `createWorld()`
앞에서 한 번 훑는다.

```js
let CACHE = null;
onSceneReset('구역 캐시', () => { CACHE = null; });
```

브라우저에서 `__resets()` 로 등록 목록을 본다. 현재 **열둘**.

> 아직 **없는 것**: 지오메트리·재질·텍스처 반납(`dispose`)과 재질 캐시의 씬
> 스코프화. 그래서 씬 전환은 인페이지 교체가 아니라 **새로고침**이다
> (`src/scenemenu.js` 머리말에 이유가 있다). 전환이 잦아지면 그때 세운다.

---

## 3. 계층 — "공통" 의 실제 상태

| 층 | 기준 | 실제 |
|---|---|---|
| `core/` | 씬을 모르는 순수 도구 | 기준대로다. 오피스 섹터도 core 만 쓴다 |
| `shared/` | 둘 이상의 씬이 실제로 쓰는 것 | 대부분 나이트시티 전용이다 (`neon` `masters` `glyphs` `urban/*` 등). 진짜 공통은 `sky` `rain` 정도 |
| `scenes/<id>/` | 그 장소만의 배치·치수·재질 | — |

동결 뒤로는 이 상태로 굳는다 — `shared/` 는 사실상 동결 씬의 영역이고,
**오피스에서 필요한 것은 core 로 올리거나 씬 안에 둔다.** shared 재배치는
안 한다 (옮겨 봐야 소비자가 동결 씬뿐이다).

---

## 4. 열려 있는 것

씬별 작업 목록은 씬 문서에 있다. 여기는 저장소 전체에 걸린 것만.

씬 작업은 오피스 섹터에만 한다 — 그 목록은
[scenes/office-sector/status.md](scenes/office-sector/status.md) 5장에 있다.

| | |
|---|---|
| 필요해지면 | 인페이지 씬 전환 — `Scene.dispose()` + 재질 캐시 씬 스코프화 (2절). 지금은 씬 전환이 페이지 리로드라 필요 없다 |
| 낮은 순위 | 동결 씬(나이트시티)의 단축평가 뒤 난수 8곳 · `SIDES[rng.int(0, 3)]` 다수 (`lessons.md` 2.1) — 동결이라 안 고친다. 오피스에서 같은 패턴을 만들지 않는 것으로 갚는다 |

나이트시티 26뷰 재현 불가는 그 씬의 **동결 상태 그대로 두는 알려진 한계**다
([scenes/night-city/status.md](scenes/night-city/status.md)) — core 회귀는
삼각형 수로 잰다.

---

## 5. 문서 지도

### 공통 — 씬을 가리지 않는다

| 문서 | 무엇 |
|---|---|
| `concepts.md` | **가장 먼저 읽는다.** 이 프로젝트가 무엇을 하는가, 무엇이 엔진으로 넘어가는가 |
| `handover.md` | **인수인계** — 이어받을 때 먼저 읽는다 |
| `lessons.md` | **실패 패턴과 규칙.** 결합 대장·검증의 구멍. 씬을 만들기 전에 읽는다 |
| `architecture.md` | 계층 구조, 의존 방향 |
| `modules.md` | 기능 모듈 — 텍스처·지오메트리·스켈레탈·익스포트 |
| `pipeline.md` | **익스포트** 6단계 (glb→fbx→유니티). 씬 생성 쪽이 아니다 |
| `game-project.md` | **게임 프로젝트 계획** — 파이프라인과 게임의 분리, 납품물 계약, 단계 계획 |
| `verification.md` | 무엇이 버그를 잡았고 무엇이 시간만 썼는가 |
| `toolchain.md` · `references.md` | 버전 · 학습 자료와 실측 기록 |
| `status.md` | 이 문서 |

### 씬별 — `docs/scenes/<id>/`

활성 씬 문서 둘이 위, 동결 씬의 지식 문서가 아래다.

| 문서 | 무엇 |
|---|---|
| `office-sector/story.md` | **게임 스토리** — 이 씬이 게임에서 하는 일과 모델링 목표. 형태 근거의 최상위 |
| `office-sector/facility.md` | **시설의 내력** — 치수·조명·검사 규칙. **형태를 건드리기 전에 읽는다** |
| `office-sector/status.md` | **생성기의 구조** — 어디를 고치면 무엇이 바뀌나 · 걸린 것 · 열려 있는 것 |
| `vacant-lot/status.md` | 동결 · 파이프라인 기준 씬 — 부트스트랩과 규약 실측의 출처 |
| `night-city/status.md` | 동결 요약 — 실측 · 지식의 위치 · 알려진 한계 |
| `night-city/city.md` | 도시의 내력과 지리 — 형태 결정 근거 (지식) |
| `night-city/generation.md` | 생성 순서·단일 출처·계약·난수 규율 (지식 — 오피스 생성기도 같은 규율을 쓴다) |
| `night-city/districts.md` | 구역별 파라미터 명세 (지식) |
| `model-test/status.md` | 동결 요약 |
| `model-test/character.md` | **캐릭터를 코드로 만든다는 것** — 유기형이 필요해지면 여기부터 |
