# 절차적 메시 파이프라인 — 브라우저에서 코드로 그리고, 게임엔진에서 검증한다

외부 3D 애셋을 **하나도 쓰지 않고** 코드(수식·셰이더)로만 3D 씬을 만들고,
그 결과가 게임엔진에서 **브라우저에서 본 것과 같게** 보이는지 자동으로 검증하는 프로젝트다.

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
