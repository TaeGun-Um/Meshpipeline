# 파이프라인

## 언제 도는가

파이프라인은 **상시 돌지 않는다.** 작업이 두 단계로 나뉜다.

| 단계 | 하는 일 | 파이프라인 |
|---|---|---|
| **설계** | 브라우저에서 코드를 고치고 결과를 본다. 맘에 들 때까지 반복 | 안 돎 |
| **인계** | 확정된 메시를 뽑아 블렌더 → 유니티로 넘기고 확인 | **한 번 돎** |

설계 중에는 브라우저만 쓴다. 브라우저가 기준이므로 여기서 "올바른 모습"이 결정되고,
그게 결정되기 전에 하류를 검증하는 건 의미가 없다.

```bash
node tools/pipeline.mjs            # 전체 (약 19초, 검사 79건)
node tools/pipeline.mjs 3 6        # 특정 단계만
node tools/pipeline.mjs --accept   # 새 스펙 승인
BLENDER=... UNITY=... node tools/pipeline.mjs
```

종료 코드 0 = 통과, 1 = 실패. 실패 항목은 `단계/항목: 상세` 로 전부 열거된다.

## `--accept` — 스펙 승인

메시를 의도적으로 바꾸면 삼각형 수가 달라져 검사가 실패한다. 고장이 아니라
**승인 요청**이다. 손으로 규약 숫자를 옮겨 적는 건 실수가 나기 쉬워서 명령으로 만들었다.

| 종류 | 항목 | `--accept` |
|---|---|---|
| **내용 의존** | 삼각형 수, 서브메시 수, 정점컬러 메시 수, 노말맵 수 | 실측값으로 갱신 |
| **불변식** | 루트 원점, 키, 발바닥 정렬, 본 수, `rootBone`, 아바타, `useFileScale`, 클립 길이, 포즈 각도 | **손대지 않음** |

불변식이 깨졌다면 메시를 바꿔서가 아니라 파이프라인이 고장난 것이다. 승인으로 덮으면 안 된다.

실측값은 `PipelineCheck` 리포트의 `measured` 필드에서 온다 — 텍스트를 파싱하지 않고
숫자를 따로 싣는다. 갱신 후 `contract.json` 을 쓰고 상수를 자동 재생성한다.

---

## 규약 — `pipeline/contract.json`

파이프라인의 모든 불변식이 여기 있다. **값을 바꾸려면 먼저 왜 바뀌어야 하는지
실측으로 보이고, 그 다음 이 파일을 고친다.** 코드에 숫자를 직접 박지 않는다.

주요 절:

| 절 | 내용 |
|---|---|
| `spaces` | 브라우저·glTF·블렌더·유니티의 손(handedness)·up축·정면 |
| `conversions` | glTF→Unity 축 반전(`X`), 블렌더 FBX 왕복 추가 회전(`180°`) |
| `exportRules` | 루트 원점, 인스턴스 굽기, 노말맵 사용, 금지 확장, 감시 대상 소스 |
| `blenderFbxOptions` | FBX 익스포터에 그대로 넘기는 19개 옵션 |
| `unityImportRules` | `useFileScale`, 애니메이션 타입, 루프 클립, `modelYaw` |
| `assertions` | 검사 기준값 (키·본 수·삼각형·클립 길이·포즈 각도 등) |

### 생성되는 파일

```
pipeline/contract.json
   │
   ├─▶ unity/Assets/Editor/PipelineContract.g.cs    (C# 상수)
   └─▶ tools/contract_gen.py                        (블렌더 FBX 옵션)
```

`node tools/gen-contract.mjs` 로 재생성한다. 파이프라인 단계 1이 매번 자동으로 돌리므로
생성 파일이 규약과 어긋난 상태로 오래 남을 수 없다. **생성 파일은 직접 고치지 않는다.**

---

## 6단계

### 1. contract — 규약에서 언어별 상수 재생성

`gen-contract.mjs` 를 돌려 C#·파이썬 상수를 다시 만들고, 내용이 바뀌었으면 `REGEN` 으로
알린다. 실패로 막지는 않는다 — 재생성이 매번 도니 드리프트는 항상 치유되고, 실패로 두면
규약을 고칠 때마다 두 번 돌려야 한다.

### 2. freshness — 익스포트가 브라우저 소스보다 최신인지

`exportRules.exportInputs` 에 지정된 경로의 `.js` 최신 수정시각과 `web/export/*.glb` 를
비교한다. 소스가 더 새로우면 실패하고 어느 파일 때문인지 알려준다.

> **왜 필요한가**: 브라우저 코드를 고친 뒤 재익스포트를 잊는 것이 가장 흔한 실수다.
> 그러면 하류 전체가 낡은 애셋을 검증하며 "통과"라고 보고한다.

감시 대상에 `controls.js` 는 없다 — 입력·물리는 지오메트리를 만들지 않으므로 넣으면
무관한 변경마다 헛울린다.

### 3. inspect — GLB가 규약을 지키는지

`exportRules.exportedAssets` 의 8개 애셋에 대해 GLB 바이너리를 직접 파싱한다.

| 검사 | 왜 |
|---|---|
| `noForbiddenExt` | `EXT_mesh_gpu_instancing` 이 `extensionsRequired` 에 있으면 임포터 지원이 갈리고 개체별 색이 유실된다 |
| `rootAtOrigin` | 브라우저 런타임 좌표가 박히면 임포트 측에서 공중에 뜬다 (실측 y=1.1479) |
| `noBumpExt` | `EXT_materials_bump` 는 비표준이라 블렌더·유니티가 통째로 버린다 |
| `normalTextures` | 텍스처가 있는 조각은 노말맵 개수가 기대와 같아야 한다 |

### 4. convert — 블렌더로 glb → fbx

`glb-to-fbx.py` 가 `contract_gen.py` 의 `FBX_OPTIONS` 를 그대로 `bpy.ops.export_scene.fbx` 에
넘긴다. 옵션을 스크립트에 직접 적지 않는 것이 요점이다.

변환 전에 `glTF_not_exported` 컬렉션을 지운다 — 블렌더 glTF 임포터가 본 표시용
Icosphere를 여기 넣는데, 이 규약은 glTF 익스포터만 알기 때문에 FBX로는 그대로 따라
나가서 유니티에 정체불명 메시(80삼각형)로 들어온다.

캐릭터는 추가로 검사한다: `armatures == 1`, `actions == 4`, `widgetPurged`.
`object_types` 에서 `ARMATURE` 가 빠지면 스켈레톤이 통째로 사라지므로 회귀 방지용이다.

### 5. blender — 아마추어·액션 보존

`blender-check.py` 로 GLB를 블렌더에 임포트해 확인한다.

- 아마추어 1개, 본 17개, 스킨드 메시 1개
- 정점 그룹 수 == 본 수 (스킨 웨이트가 살아있는지)
- 액션 4개
- 키 1.791m (기대 1.775 ± 0.06)

> 블렌더 glTF 임포터는 `glTF_not_exported` 컬렉션에 Icosphere를 만든다. 집계에서
> 제외하지 않으면 정점 456 → 498, 바운딩 1.78m → 5.32m 로 왜곡된다.

### 6. unity — 씬 조립 + 적합성 검사 49항목

`BuildScene.All` 로 씬을 조립하고 `PipelineCheck.Run` 으로 검사한다.
결과는 `unity/Reports/pipeline-check.json` 에도 남는다.

**static (16항목)** — 조각별 삼각형 수, 루트 원점, 정점 컬러 메시 존재

**character (10항목)** — 스킨드 여부, 본 17개, `rootBone == Hips`, 삼각형 228,
서브메시 6, 키 1.775m, 발바닥-루트 ≤ 0.02m, 아바타 휴머노이드·유효, `useFileScale`

**animation (12항목)** — 클립 4개의 길이와 루프 플래그, 그리고 손계산 포즈 비교

**scene (11항목)** — 조각 8개 존재, 캡슐 정렬, `modelYaw` 주입, Animator 배선

---

## 씬별 유니티 조립 — 오피스 섹터

vacant-lot 은 `BuildScene.cs`, 오피스는 `BuildOfficeScene.cs` 다. 방식이 다른
이유는 하나 — **오피스는 조명이 정점 컬러에 구워져 있다.** 그래서 유니티
광원을 만들지 않고 전 불투명 메시를 `Custom/BakedVertexColor`(텍스처 x
정점색, 언릿)로 갈아 끼운다. 발광·유리는 재질 이름으로 보존한다.

```
브라우저에서:  for (const k of ['rock','floors','walls','ceilings','props','fixtures'])
                 await __export(k);
복사:          web/export/*.glb -> unity/Assets/ProceduralImport/office/
유니티:        Unity.exe -batchmode -quit -projectPath unity
                 -executeMethod BuildOfficeScene.Full
결과:          Assets/Scenes/OfficeSector.unity · Reports/office_scene.png
```

contract·pipeline.mjs 는 아직 vacant-lot 목록을 하드코딩한다 — 씬별 목록화가
남은 일이다 (#68).

## 좌표계 — 확정된 사실

이 프로젝트에서 가장 많이 깨졌던 부분이다. 전부 실측으로 확정했다.

### glTF → Unity: X가 반전되고 Z는 보존된다

```
브라우저 집 (x=-14.5, z=-17.5)  →  유니티 (x=+14.5, z=-17.5)
```

축 하나만 반전 + 좌표계 손 변경이 상쇄되므로 **형상이 거울로 뒤집히는 게 아니다.**
씬 전체가 Y축 180° 돌아 보이는 건 정상이며 고칠 대상이 아니다.

**따라오는 결과**: 지오메트리만 반전되므로 **광원·카메라 방향의 X도 같이 반전**해야 한다.
안 하면 태양이 반대편에서 비춘다. `BuildScene.FlipImportAxis()` 가 규약을 읽어 처리한다.

실측 근거: 잘못된 값 `Euler(46, -140, 0)` vs 올바른 값 `Euler(40.48, 127.57, 0)`.

### 블렌더 FBX 왕복: Y축 180° 추가 회전

glTF Y-up 임포트(Y-up→Z-up 회전) + FBX 익스포트(`axis_forward='-Z'`)가 겹쳐 모델이
180° 돌아간다. 결과적으로 **모델의 시각적 정면이 로컬 `-Z`** 가 된다.

원본 GLB는 정상이다 (발끝 z 범위 `-0.080 ~ +0.170`, 발끝 `+Z`).

보정은 `modelYaw = 180` 으로 하고, `BuildScene`(에디터 포즈)과 `PlayerController`(런타임)가
**같은 식**을 쓴다. 전에는 두 곳에서 독립적으로 180°를 적용해서 Scene 뷰와 Play의 방향이
반대였다.

> **자동 판정을 시도했다가 버렸다.** `sharedMesh.vertices` 는 바인드 포즈 적용 전의 원본
> 정점이라, 회전이 바인드 행렬에 들어가 있으면 정점 좌표만 봐서는 알 수 없다.
> 스킨드 메시에는 애초에 맞지 않는 측정 방법이었다.

### 스케일: 미터 통일, FBX만 헤더 경유

브라우저·glTF·유니티 모두 미터. 블렌더 FBX는 단위 스케일 0.01을 파일 헤더에 적고,
유니티가 `useFileScale=true` 로 정규화한다. `false` 로 끄면 센티미터 값이 그대로 들어와
**100배**가 된다 (실측: 1.775 → 177.48).

### 왼손 좌표계에서의 벡터 연산

브라우저(three.js, 오른손)의 공식을 유니티(왼손)에 그대로 옮기면 안 된다.

```
-Z를 바라볼 때 오른쪽 방향:
  Cross(fwd, up) = Cross((0,0,-1),(0,1,0)) = (+1,0,0)   ← 왼쪽  (three.js에서는 맞음)
  Cross(up, fwd) = Cross((0,1,0),(0,0,-1)) = (-1,0,0)   ← 오른쪽 (유니티 정답)
```

마우스 입력도 부호가 반대다. yaw는 손 변경 때문이고, pitch는 유니티 `Mouse Y` 가
위로 밀 때 양수(브라우저 `movementY` 는 아래로 양수)인 것과 카메라 높이가
`sin(pitch)` 에 비례하는 것이 겹친 결과다.

---

## 두 임포트 경로 비교

| | GLB (glTFast) | **FBX (블렌더 경유)** |
|---|---|---|
| 알베도 | ✅ | ✅ |
| 거칠기 | ✅ | ❌ (Standard에 언패킹 안 됨) |
| 노말 | ✅ | ✅ |
| 정점 컬러 | ✅ | ✅ |
| 스킨·본 17개 | ✅ | ✅ |
| 애니메이션 클립 | ✅ | ✅ |
| **Avatar (휴머노이드)** | ❌ | ✅ |
| 스케일 | 1× | 파일 헤더 경유 |

**정적 조각은 GLB, 캐릭터는 FBX**를 쓴다. glTFast는 아바타를 만들지 않으므로
Mecanim 리타게팅이 필요한 캐릭터만 블렌더를 경유한다. 규약의
`unityImportRules.preferredRoute` 가 이 결정을 기록한다.
