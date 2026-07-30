# 절차적 메시 파이프라인 — 브라우저에서 코드로 그리고, 게임엔진에서 검증한다

외부 3D 애셋을 **하나도 쓰지 않고** 코드(수식·셰이더)로만 3D 씬을 만들고,
그 결과가 게임엔진에서 **브라우저에서 본 것과 같게** 보이는지 자동으로 검증하는 프로젝트다.

주제 씬은 한국 주택가의 공터다. 흙·잡초·담장·주택·전신주·전선·소품·캐릭터가 모두
런타임에 계산되며, 저장소에는 이미지나 모델 파일이 하나도 없다.

```
브라우저 (three.js)          블렌더 (헤드리스)         유니티 (배치모드)
  수식 → 지오메트리    ─GLB─▶  glTF → FBX 변환   ─FBX─▶  임포트 → 씬 조립
  픽셀 루프 → 텍스처            아마추어·액션 보존         아바타·클립·콜라이더
  sin → 애니메이션 클립         텍스처 분리                적합성 49항목 검사
        │                            │                          │
        └──────────── pipeline/contract.json (규약) ─────────────┘
```

## 이 프로젝트가 실제로 푸는 문제

"코드로 3D를 만들 수 있다"는 쉽다. 어려운 건 **그게 게임엔진에 들어갔을 때도
같은 모습인가**다. 실제로 다음이 전부 조용히 깨졌고, 지금은 전부 자동 검사로 막혀 있다.

| 깨졌던 것 | 증상 | 원인 |
|---|---|---|
| 좌표계 | 그림자가 반대편에서 떨어짐 | glTF(우손)→Unity(왼손) 변환에서 X가 반전되는데 광원은 안 뒤집음 |
| 메시 정면 | 캐릭터가 등을 보이며 걸음 | 블렌더 FBX 왕복에서 Y축 180° 회전 |
| 스케일 | 캐릭터 키 1.775m → 177.48유닛 | `useFileScale=false` 로 cm 단위 헤더를 무시 |
| 스켈레톤 | 본이 통째로 사라질 뻔함 | FBX `object_types` 에 `ARMATURE` 누락 |
| 텍스처 | 집이 전부 하얗게 | FBX 임베드 텍스처를 유니티가 자동 추출하지 않음 |
| 표면 요철 | 담장 줄눈·벽돌이 평평 | glTF에 범프맵이 없어 비표준 확장으로 나가고 버려짐 |
| 개체별 색 | 잡석 300개가 흰색 | `EXT_mesh_gpu_instancing` 이 `instanceColor` 를 유실 |
| 배치 | 캐릭터가 공중에 뜸 | 브라우저 런타임 좌표가 glTF 루트에 박힘 |
| 조명 | 흙바닥이 새카맣게 | 노말맵이 과해 대부분의 픽셀이 광원 반대를 향함 |

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

### 메시를 바꿨으면 — `--accept`

메시를 의도적으로 바꾸면 삼각형 수 같은 값이 달라져 검사가 실패한다.
그건 고장이 아니라 **"새 스펙을 승인하라"는 체크포인트**다.

`--accept` 는 규약의 **내용 의존 값**(삼각형·서브메시·정점컬러·노말맵 수)만
실측값으로 갱신하고 상수를 재생성한다.

**불변식은 절대 건드리지 않는다** — 루트 원점, 캐릭터 키, 발바닥 정렬, 본 수,
클립 길이, 포즈 각도, 스케일. 이쪽이 깨졌다면 승인할 일이 아니라 버그다.

## 문서

| 문서 | 내용 |
|---|---|
| [docs/architecture.md](docs/architecture.md) | **아키텍처** — 계층 구조, 의존 방향, 왜 이렇게 나눴는가 |
| [docs/pipeline.md](docs/pipeline.md) | 파이프라인 6단계, 규약(contract), 검사 항목 |
| [docs/modules.md](docs/modules.md) | 기능 모듈 — 텍스처·지오메트리·스켈레탈·익스포트·임포트 |
| [docs/toolchain.md](docs/toolchain.md) | 언어·프레임워크·엔진 버전과 설치 상태 |
| [docs/references.md](docs/references.md) | 학습 자료와 실측 기록 |

## 저장소 구조

```
pipeline/contract.json      규약의 단일 출처 — 모든 단계가 이걸 읽는다
tools/                      파이프라인 도구 (Node + 블렌더 파이썬)
web/                        브라우저 — 기준 구현
unity/                      유니티 프로젝트 — 검증 대상
docs/                       문서
```
