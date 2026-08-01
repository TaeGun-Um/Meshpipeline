# 학습 자료와 실측 기록

## 출발점 — 이 프로젝트가 시작된 계기

X(트위터)에 올라온 "Opus 5로 제로 베이스에서 렌더링되는 프로그램 만들기" 영상들을
검증하는 것에서 시작했다. 네 개를 실물 확인했다.

| 프로젝트 | 저장소 / 배포 | 규모 |
|---|---|---|
| **IRONSIGHT** (브라우저 FPS) | [gillworks/ironsight](https://github.com/gillworks/ironsight) · [배포](https://ironsight-tan.vercel.app) | 서브에이전트 203개, 출력 16.9M 토큰, 약 $6,300, 55시간, TS 101,526줄 |
| **SNOWFLOW** (워터벤딩 시뮬) | [Noniv/snowflow_demo](https://github.com/Noniv/snowflow_demo) · [배포](https://snowflow-lilac.vercel.app/) | 약 9시간, 400만 토큰, WebGPU + WGSL |
| **THE LONG SILENCE** | [achimala/TheLongSilence](https://github.com/achimala/TheLongSilence) · [배포](https://longsilence.anshu.dev) | 24시간 마라톤, WebGL2 + GLSL |
| 마인크래프트 클론 | (리트윗 계정, 원작자 링크 없음) | 미검증 |

**핵심 관찰**: 세 프로젝트 모두 "외부 애셋 0개"가 자랑 포인트였다. IRONSIGHT의 README는
*"모든 텍스처, 메시, 사운드, 폰트는 로드 시점에 절차적으로 생성된다"* 고 명시한다.
의존성도 `three` + `rapier3d` 뿐이고 GLTF/FBX/OBJ 로더가 아예 없다.

그리고 진짜 공들인 부분은 셰이더가 아니라 **검증 장치**였다.

- 결정론적 스크린샷 하네스 (렌더 정지 + RNG 리시드 → 머신 간 동일 프레임)
- Boundary CI (레인 침범 import, `Math.random()`, 렌더 코드 밖 셰이더 생성을 빌드 실패로)
- **블라인드 A/B 크리틱 루프** — 자기 프레임과 실제 게임 참조 프레임을 어느 쪽인지 모르게
  나란히 놓고 채점. 지표는 `delta = score(ours) − score(reference)`

이 프로젝트의 스크린샷 하네스, 시드 고정, `pipeline/contract.json` 기반 자동 검사는
모두 그 관찰에서 나왔다.

## 공식 문서

### Claude Code
- [`/goal`](https://code.claude.com/docs/en/goal) — 조건 충족까지 턴을 이어가는 자율 루프
- [서브에이전트](https://code.claude.com/docs/en/sub-agents) — 결과만 보고, 낮은 토큰
- [에이전트 팀](https://code.claude.com/docs/en/agent-teams) — 팀원끼리 직접 대화, 실험적
- [명령어 목록](https://code.claude.com/docs/en/commands)

### glTF
- [EXT_mesh_gpu_instancing 규격](https://github.com/KhronosGroup/glTF/blob/main/extensions/2.0/Vendor/EXT_mesh_gpu_instancing/README.md)
- [EXT_mesh_gpu_instancing: used vs required?](https://github.com/KhronosGroup/glTF/issues/2402)

### Blender
- [glTF 2.0 애드온 매뉴얼](https://docs.blender.org/manual/en/4.0/addons/import_export/scene_gltf2.html)
- [glTF-Blender-IO-EXT-mesh-gpu-instancing](https://github.com/takahirox/glTF-Blender-IO-EXT-mesh-gpu-instancing)

### Unity glTFast
- [Changelog](https://github.com/atteneder/glTFast/blob/main/CHANGELOG.md)
- [Avatar Support (Issue #391)](https://github.com/atteneder/glTFast/issues/391) — **미지원, 공개 요청 상태**
- [SkinnedMeshRenderer rootBone (Issue #301)](https://github.com/atteneder/glTFast/issues/301)

### Blender MCP (참고 — 이 프로젝트에서는 미사용)
- [BlenderMCP (ahujasid)](https://mcpservers.org/servers/ahujasid/blender-mcp)
- [실사용 평가](https://www.mindstudio.ai/blog/claude-blender-mcp-real-world-performance)

---

## 실측 기록

모든 규약 값의 근거다. 추측이나 관례가 아니다.

### 좌표계

| 측정 | 값 |
|---|---|
| 브라우저 집 좌표 | `x=-14.5, z=-17.5` |
| 유니티 임포트 후 | `x=+14.5, z=-17.5` → **X 반전, Z 보존** |
| 태양 각도 (잘못) | `Euler(46, -140, 0)` — 눈대중 |
| 태양 각도 (정답) | `Euler(40.48, 127.57, 0)` — X 반전 반영 |
| 원본 GLB 발끝 z 범위 | `-0.080 ~ +0.170` → 발끝 `+Z` (정상) |
| FBX 왕복 후 모델 정면 | 로컬 `-Z` → `modelYaw = 180` |

### 스케일

| 설정 | 캐릭터 키 |
|---|---|
| `useFileScale = true` | **1.775 유닛** ✅ |
| `useFileScale = false` | 177.48 유닛 (100배) ❌ |
| 브라우저 | 1.782m |
| 블렌더 | 1.791m |

### 애니메이션 — 끝단 검증

Walk 클립 위상 π/2. 브라우저 수식으로 손계산한 값과 유니티 `SampleAnimation` 비교.

| 본 | 기대 | Unity (FBX) | 오차 | Unity (GLB) | 오차 |
|---|---|---|---|---|---|
| LeftUpperArm | −24.72° | −24.76° | **−0.04°** | −24.61° | +0.11° |
| LeftUpperLeg | +29.08° | +28.90° | −0.18° | +28.95° | −0.13° |
| RightUpperLeg | −29.08° | −28.85° | +0.23° | −28.95° | +0.13° |

체인: `pose.js` sin → 30fps 키프레임 → GLB → 블렌더 → FBX → 유니티. **최대 오차 0.23°.**

### 조명 정합 (브라우저 vs 유니티, 동일 카메라 픽셀 비교)

ACES 톤매핑 이식 + 색공간 Linear + 광원값 실측 조정 후:

| 영역 | 브라우저 | 유니티 | 차이 |
|---|---|---|---|
| 하늘 상단 | 163,189,211 | 173,193,211 | +10,+4,0 |
| 도로 | 67,75,91 | 74,77,85 | +7,+2,−6 |
| 공터 흙 | 109,99,86 | 115,96,76 | +6,−3,−10 |
| 벽돌 | 162,145,143 | 133,127,124 | −29,−18,−19 |
| 캐릭터 셔츠 | 75,84,101 | 58,73,104 | −17,−11,+3 |

**평균 오차 10.4 / 255 (4.1%).** 시작 시점은 −87 ~ +127이었다.

광원 값 결정 과정 (격자 탐색 20조합 8초):
- three 원본 2.5 그대로 → **+77 과노출**
- three의 1/π 정규화 적용 (0.796) → **−55.7 과소노출**
- 실측 최적 → `sun 1.00 / ambient 1.10` (오차 10.8)

즉 **유니티의 광원 단위는 three와 1:1도 π배도 아니다.**

### 바람 (정적 메시 애니메이션)

`_WindTime` 을 고정해 4프레임 렌더 후 픽셀 차이:

| 영역 | t=0→0.35 | t=0→0.70 | t=0→1.05 |
|---|---|---|---|
| 공터 (잡초) | 4.75/255 | 6.12/255 | 6.95/255 |
| **도로 (대조군)** | **0.00** | **0.00** | **0.00** |

대조군이 0.00인 것이 핵심 — "전체가 흔들린 것"이 아니라 잡초만 움직인다는 증명이다.

### 성능

| 항목 | 개선 전 | 개선 후 |
|---|---|---|
| 유니티 배치 1회 | 11.1초 | 9.3초 |
| 내 코드 구간 | 2,184ms | 781ms |
| `ImportCheck` | 1,367ms | `All()` 에서 분리 |
| 파이프라인 전체 (6단계) | — | **19초** |

유니티 배치 고정 비용 분해: 에셋 리프레시 4.41s + 스크립트 컴파일 2.04s +
도메인 리로드 2.55s + 라이선싱 1.61s = 약 8.9초 (전체의 80%).

### 브라우저 씬 규모

| 항목 | 값 |
|---|---|
| 삼각형 | 182,428 |
| 잡초 | 7,200포기 (인스턴싱, 드로우콜 1) |
| 텍스처 | 73장 (63MB, 픽셀 루프로 로드 시점 생성) |
| 충돌체 | 14 (집 9 + 담장 5) |
| 생성 시간 | 약 0.5초 |
| **외부 애셋** | **0개** |

---

## 겪은 함정 목록

파이프라인이 지금 자동으로 막고 있는 것들. 전부 실제로 한 번씩 당했다.

1. FBX `object_types` 에 `ARMATURE` 누락 → 스켈레톤 통째로 소멸
2. FBX 임베드 텍스처 → 유니티가 자동 추출 안 함, 전부 유실
3. `useFileScale=false` → 100배
4. glTF 루트에 런타임 좌표 박힘 → 공중에 뜸 (y=1.1479)
5. `EXT_mesh_gpu_instancing` → 개체별 색 유실 (잡석 300개 흰색)
6. `EXT_materials_bump` → 블렌더·유니티가 통째로 버림 (요철 소멸)
7. `NORMAL_STRENGTH` 3.2 → 흙바닥이 새카맣게 (ACES가 브라우저에서만 가려줌)
8. `MeshBasicMaterial` 의 `fog` 기본값 → 안개가 하늘 돔을 덮어 회색으로
9. Linear 색공간에서 `GammaToLinearSpace()` 중복 호출 → 이중 선형화
10. 잡초 그림자 캐스팅 → 72,000 삼각형이 흙바닥을 덮음
11. `UnityEngine.Object` 에 `??` → `MissingComponentException`
12. 왼손 좌표계에서 `Cross(fwd, up)` → A/D 반대
13. 유니티 `Mouse Y` 부호 → 마우스 상하 반대
14. 블렌더 `glTF_not_exported` Icosphere → 정체불명 메시 80삼각형
15. 빈 `bpy_prop_collection` 이 falsy → `a or b` 가 `None` 으로 떨어짐
16. PowerShell 5.1이 `.ps1` 을 ANSI로 읽음 → 한글 파서 에러
17. 유니티 로그 CRLF → `\n` 정규식 매칭 실패
18. `mesh.triangles` 반복 호출 → 수십만 int 배열 반복 할당
19. GLB 헤더 삼각형 수 ≠ 엔진 삼각형 수 (공유 메시 중복 제거)
20. `sharedMesh.vertices` 로 정면 판정 → 바인드 포즈 미반영이라 무의미
