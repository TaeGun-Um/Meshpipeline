# 절차적 메시 파이프라인 — 브라우저에서 코드로 그리고, 게임엔진에서 검증한다

외부 3D 애셋을 **하나도 쓰지 않고** 코드(수식·셰이더)로만 3D 씬을 만들고,
그 결과가 게임엔진에서 **브라우저에서 본 것과 같게** 보이는지 자동으로 검증하는 프로젝트다.

저장소에는 이미지나 모델 파일이 하나도 없다. 씬은 지우지 않고 쌓는다.

| # | 씬 | 무엇 | 삼각형 | 텍스처 |
|---|---|---|---|---|
| 1 | `vacant-lot` 주택가 공터 | 낮 · 3인칭 · 기준 씬. 좌표계·조명 규약을 여기서 확정했다 | 182,428 | 63MB |
| 2 | `night-city` 나이트시티 | 사이버펑크 야간 도시 · 프리캠 · 구역·매싱·1층 점포 | 3,644,044 | 218MB |

삼각형은 씬이 들고 있는 지오메트리 총량이다 (`__audit()`). 한 프레임에 실제로
그리는 수는 그림자 패스 때문에 이보다 많다.

```bash
node web/server.mjs
# http://localhost:5173                    활성 씬 (마지막에 만든 것)
# http://localhost:5173/?scene=vacant-lot  이전 씬 다시 띄우기
```

```
브라우저 (three.js)          블렌더 (헤드리스)         유니티 (배치모드)
  수식 → 지오메트리    ─GLB─▶  glTF → FBX 변환   ─FBX─▶  임포트 → 씬 조립
  픽셀 루프 → 텍스처            아마추어·액션 보존         아바타·클립·콜라이더
  sin → 애니메이션 클립         텍스처 분리                적합성 49항목 검사
        │                            │                          │
        └──────────── pipeline/contract.json (규약) ─────────────┘
```

## 클론 직후 (부트스트랩)

생성물은 커밋하지 않는다 (손으로 쓴 소스 272KB vs 생성물 1.24GB). 그래서 클론 후
한 번은 브라우저에서 애셋을 뽑아야 파이프라인이 돌 수 있다.

```bash
cd web && npm install && cd ..     # three.js 설치
node web/server.mjs                # http://localhost:5173
```

브라우저 콘솔에서:

```js
for (const k of ['ground','road','walls','houses','poles','props','character'])
  await window.__export(k);
await window.__export('weeds', { bake: true, name: 'weeds_baked.glb' });
```

```bash
node tools/pipeline.mjs            # 블렌더 변환 + 유니티 임포트 + 검증
```

블렌더·유니티 경로는 환경변수로 지정한다 (`BLENDER=... UNITY=...`).
버전은 [docs/toolchain.md](docs/toolchain.md) 참고.

## 작업 방식 — 두 단계로 나뉜다

이 프로젝트는 파이프라인을 매번 통째로 돌리는 게 아니다. **설계 단계**와 **인계 단계**가 분리돼 있다.

### 1단계 — 브라우저에서 결과물을 다듬는다 (반복)

```bash
node web/server.mjs          # http://localhost:5173
```

코드를 고치고 브라우저에서 결과를 본다. 맘에 들 때까지 반복한다.
**이 동안 블렌더도 유니티도 쓰지 않고, 파이프라인도 돌리지 않는다.**
브라우저가 기준(reference truth)이므로 여기서 "올바른 모습"이 결정된다.

### 2단계 — 확정되면 인계한다 (한 번)

브라우저 콘솔에서 애셋을 뽑고:

```js
for (const k of ['ground','road','walls','houses','poles','props','character'])
  await window.__export(k);
await window.__export('weeds', { bake: true, name: 'weeds_baked.glb' });
```

파이프라인으로 블렌더 변환 → 유니티 임포트 → 검증을 한 번에 한다:

```bash
node tools/pipeline.mjs            # 전체 (약 19초, 검사 79건)
node tools/pipeline.mjs 3 6        # 특정 단계만
node tools/pipeline.mjs --accept   # 새 스펙을 승인 (아래 참고)
```

통과하면 종료 코드 0, 하나라도 깨지면 1이다.


## 문서

문서는 **공통**과 **씬별**로 갈라져 있다. 씬을 늘려도 공통 문서는 그대로다.

### 공통 — 씬을 가리지 않는다

| 문서 | 내용 |
|---|---|
| [docs/concepts.md](docs/concepts.md) | **개념 — 가장 먼저 읽는다.** 이게 무엇을 하는 것인가, DX11 과 무엇이 같고 다른가, 무엇이 엔진으로 넘어가고 무엇이 안 넘어가는가 |
| [docs/handover.md](docs/handover.md) | **인수인계** — 이어받을 때 가장 먼저 읽는다 |
| [docs/lessons.md](docs/lessons.md) | **실패 패턴과 규칙.** 결합 대장·검증의 구멍. 씬을 만들기 전에 읽는다 |
| [docs/status.md](docs/status.md) | **현재 상태** — 브라우저 뷰 단계, 씬 목록, 씬 상태 계약, 계층 |
| [docs/architecture.md](docs/architecture.md) | **아키텍처** — 계층 구조, 의존 방향, 왜 이렇게 나눴는가 |
| [docs/modules.md](docs/modules.md) | 기능 모듈 — 텍스처·지오메트리·스켈레탈·익스포트·임포트 |
| [docs/pipeline.md](docs/pipeline.md) | **익스포트** 파이프라인 6단계, 규약(contract), 검사 항목 |
| [docs/verification.md](docs/verification.md) | **검증** — 무엇이 버그를 잡았고 무엇이 시간만 썼는가 |
| [docs/toolchain.md](docs/toolchain.md) | 언어·프레임워크·엔진 버전과 설치 상태 |
| [docs/references.md](docs/references.md) | 학습 자료와 실측 기록 |

### 씬별 — `docs/scenes/<id>/`

| 문서 | 내용 |
|---|---|
| [scenes/night-city/city.md](docs/scenes/night-city/city.md) | **도시의 내력** — 왜 이 도시가 이렇게 생겼는가. 모든 형태 결정의 근거 |
| [scenes/night-city/generation.md](docs/scenes/night-city/generation.md) | **도시 생성 — 새 기능을 만들기 전에 먼저 읽는다.** 순서·단일 출처·계약·난수 규율 |
| [scenes/night-city/districts.md](docs/scenes/night-city/districts.md) | 구역 설계 명세 (레퍼런스 분석 → 파라미터) |
| [scenes/night-city/status.md](docs/scenes/night-city/status.md) | 그 씬의 상태와 작업 기록 |

## 저장소 구조

```
pipeline/contract.json      규약의 단일 출처 — 모든 단계가 이걸 읽는다
tools/                      파이프라인 도구 (Node + 블렌더 파이썬)
web/
  src/main.js               렌더러·카메라·입력·검증 하네스. 장소는 모른다
  src/scenemenu.js          씬 전환 햄버거 (우측 상단)
  src/core/                 엔진. 씬을 하나도 모른다
    scene.js                씬 부모 클래스 — build() 가 상태 리셋까지 맡는다
    scenestate.js           씬 상태 계약 — 빌드 한 번의 수명을 갖는 것을 등록
    audit.js                예산·규약·개수 점검 (__audit)
    placement.js            배치 검사 — 관통·부유를 지오메트리에서 잰다 (__place)
  src/shared/               둘 이상의 씬이 쓰는 레시피
  src/scenes/index.js       저장된 씬 목록 — 햄버거가 여기서 나온다
  src/scenes/<씬>/          장소별 구성 (지우지 않고 쌓는다)
  src/dynamic/              리그·포즈·클립·스킨
  src/export/               GLB 익스포트
  shots/views.json          회귀 검증용 카메라 설정 — 기준 이미지의 '입력'
  shots/baseline_*.png      기준 스크린샷 (커밋하지 않는다 — __lock('base') 로 재생성)
unity/                      유니티 프로젝트 — 검증 대상
docs/                       공통 문서
docs/scenes/<씬>/           씬별 문서 (내력·구역·생성·상태)
```

### 씬을 새로 추가하는 방법

1. `web/src/scenes/<id>/index.js` 에서 `core/scene.js` 의 `Scene` 을 상속하고
   `surfaceHeight()` 와 `createWorld()` 를 구현한다
2. 그 모듈을 `export default new MyScene()` 으로 내보낸다
3. `web/src/scenes/index.js` 의 `SAVED` 배열에 추가한다 (기존 항목은 건드리지 않는다).
   우측 상단 햄버거 목록이 여기서 나온다
4. **모듈 수준 캐시나 장부를 만들면 `onSceneReset()` 에 등록한다**
   (`core/scenestate.js`). 안 하면 예외가 아니라 이전 씬 잔재가 조용히 섞인다
5. 재질은 `new THREE.Material` 로 직접 만들지 말고 마스터에서 `instance()` 로 뽑는다
   (값이 같으면 공유되고, 파라미터 이름 오타가 즉시 잡힌다)
6. 문서는 `docs/scenes/<id>/` 아래에 둔다
7. `web/shots/views.json` 에 뷰를 등록하고 브라우저에서 `await __lock('base')` 로
   기준을 잡는다. 이후 `node tools/verify.mjs <id>` 가 회귀를 잡아준다
   ([docs/verification.md](docs/verification.md))
