# 툴체인

> 이 문서는 **경로·설치·갱신 방법**을 다룬다.
> 각 도구가 파이프라인에서 무슨 역할인지는 `concepts.md` 8절에 요약이 있다.
> 버전 표가 두 곳에 있으므로 **바꿀 때 둘 다 고친다** — 같은 값을 두 곳에서
> 관리하는 것이 이 프로젝트가 스무 번 넘게 틀린 그 유형이다 (status.md 2.1).

## 설치 상태 (검증 완료)

| 도구 | 버전 | 위치 | 비고 |
|---|---|---|---|
| Node.js | 24.15.0 | PATH | 오케스트레이터·서버·GLB 파서 |
| npm | 11.12.1 | PATH | |
| three.js | 0.185.0 | `web/node_modules` | 유일한 런타임 의존성 |
| Blender | 5.2.0 LTS | 포터블 압축 해제 위치 (`pipeline/local.json`) | **포터블** — 레지스트리·시작메뉴 변경 없음 |
| Unity Editor | 6000.3.11f1 (6.3 LTS) | `C:\Program Files\Unity\Hub\Editor\` | 라이선스 활성 필요 |
| Unity glTFast | 6.19.0 | `unity/Packages/manifest.json` | Unity 6.0 LTS 이상 요구 |
| Windows | 11 Pro 26200 | | PowerShell 5.1 + Git Bash |

경로는 환경변수로 덮어쓸 수 있다.

`pipeline/local.example.json` 을 `pipeline/local.json` 으로 복사해 경로를 적거나, 환경변수로 지정한다.

```bash
BLENDER=/path/to/blender UNITY=/path/to/Unity node tools/pipeline.mjs
```

## 언어별 역할

| 언어 | 어디서 | 무엇을 |
|---|---|---|
| JavaScript (ES modules) | `web/src/`, `tools/*.mjs` | 메시 생성, 익스포트, 오케스트레이션 |
| GLSL | `web/src/core/textures.js` 주입 | 잡초 바람 (정점 셰이더 삽입) |
| Python 3 (bpy) | `tools/*.py` | 블렌더 헤드리스 변환·검증 |
| C# | `unity/Assets/` | 임포트 설정, 씬 조립, 적합성 검사, 런타임 조작 |
| HLSL / CG | `unity/Assets/Shaders/` | 톤매핑, 하늘, 정점 컬러, 바람 |
| PowerShell | `tools/unity-check.ps1` | 유니티 배치 실행 래퍼 |

## 의존성이 없다는 점

브라우저 런타임 의존성은 **three.js 하나**다. 빌드 도구(webpack/vite)도 쓰지 않는다.
`web/index.html` 의 importmap이 `node_modules` 를 직접 가리킨다.

```html
<script type="importmap">
{ "imports": {
    "three": "/node_modules/three/build/three.module.js",
    "three/addons/": "/node_modules/three/examples/jsm/"
}}
</script>
```

`web/server.mjs` 는 의존성 0의 정적 서버(80줄)다. 스크린샷·GLB 업로드용 POST 엔드포인트를
겸한다. `ROOT` 를 `process.cwd()` 가 아니라 **스크립트 자기 위치**(`import.meta.url`)로
잡으므로 어느 디렉터리에서 띄워도 동작한다.

## 알려진 함정

### PowerShell 5.1

- `.ps1` 파일을 **ANSI로 읽는다**. BOM 없는 UTF-8에 한글을 쓰면 파서 에러가 난다.
  → `tools/unity-check.ps1` 은 의도적으로 ASCII만 쓴다.
- `Measure-Object -Line` 이 빈 줄을 0으로 센다. 줄 수는 `(Get-Content f).Count` 로.
- `Select-String` 과 `Get-Content` 의 줄 번호가 어긋날 수 있다 (줄바꿈 혼재).
  → 줄 번호 기반 텍스트 분할을 하지 말 것. 마커 기반으로.
- 네이티브 exe에 `2>&1` 을 쓰면 stderr가 ErrorRecord로 감싸이고 `$?` 가 false가 된다.
- GUI 앱(`Unity.exe`)은 `&` 로 실행하면 즉시 반환한다. `Start-Process -Wait -PassThru`.

### 유니티

- 배치 1회당 고정 비용 약 5.5초. 작업을 나누는 것보다 프로세스를 나누는 것이 비싸다.
- C# 파일을 건드리면 컴파일 2.0초 + 도메인 리로드 2.0초가 추가된다.
- **`UnityEngine.Object` 에 `??` / `?.` 를 쓰면 안 된다.** `GetComponent` 가 컴포넌트
  없음을 "가짜 null"(C# 참조는 살아있음)로 돌려주므로 `??` 가 통과해버리고 다음 접근에서
  `MissingComponentException` 이 난다. 오버로드된 `==` 로 명시적 검사.
- `mesh.triangles` / `mesh.colors32` 는 호출마다 배열을 새로 할당한다.
  개수만 필요하면 `GetIndexCount(submesh)` / `HasVertexAttribute()`.
- `SkinnedMeshRenderer` 는 `MeshFilter` 도 `MeshRenderer` 도 아니다. `Renderer` 를 훑어야
  머티리얼·바운딩이 0으로 나오지 않는다.
- 로그는 CRLF다. 정규식에 `\n` 만 쓰면 매칭에 실패한다.
- `OnRenderImage` 는 컴포넌트가 붙은 카메라만 거친다. **Scene 뷰에는 적용되지 않는다**
  (Game 뷰와 `Camera.Render()` 에는 적용). ACES 톤매핑이 Scene 뷰에서 안 보이는 이유.
- GUI가 열려 있으면 배치모드가 프로젝트를 열 수 없다.

### 블렌더

- Blender 4.4+/5.x에서 VSE `sequence_editor.sequences` → `strips` 로 개명.
  **빈 `bpy_prop_collection` 은 falsy**라서 `a or b` 로 고르면 안 된다 (`is not None`).
- `Action.fcurves` 제거. 슬롯 액션(`layers > strips > channelbags`)을 함께 지원해야 한다.
- glTF 임포터가 `glTF_not_exported` 컬렉션에 본 표시용 Icosphere를 만든다. 이 규약은
  glTF 익스포터만 알기 때문에 FBX로는 따라 나간다.
- ffmpeg가 내장돼 있어 별도 설치 없이 동영상 처리가 가능하다.

### glTF / FBX

- glTF에 **범프맵이 없다**. 노말맵만 표준이다.
- `EXT_mesh_gpu_instancing` 은 `extensionsRequired` 로 기록되고 `instanceColor` 를 유실한다.
  Blender 5.2는 임포트를 지원하지만(4.0 매뉴얼에는 미지원으로 적혀 있다) 개체별 색은
  살아나지 않고 오브젝트가 7,201개로 폭발한다.
- three `GLTFExporter` 는 거칠기맵을 glTF 규격대로 `metallicRoughness` 텍스처에 자동 패킹한다.
- FBX 임베드 텍스처는 유니티가 자동 추출하지 않는다.

## 미설치 / 선택 사항

| 도구 | 상태 | 쓸 곳 |
|---|---|---|
| Playwright | 미설치 | 브라우저 익스포트 헤드리스 자동화 (약 200MB) |
| URP | 미설치 | Scene 뷰까지 톤매핑 적용, Volume 기반 후처리 |

Playwright를 넣으면 파이프라인 단계 2가 "신선도 검사"에서 "자동 재익스포트"로 바뀌어
전 과정이 명령 한 번으로 완결된다.
