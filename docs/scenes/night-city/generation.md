# 도시 생성 — 무엇이 무엇을 정하는가

> **새 기능을 만들기 전에 이 문서를 먼저 읽는다.**
>
> 사용자 지시로 만든 문서다: *"만들때에는 기존의 맵 생성이 어떤 식으로
> 만들어지는지, 어떤게 상수인지 이런것들을 다 조사해서 만들어야해. 지금
> 계속해서 추가로 뭘 만들면 만들어진것 위에 덮어쓰는 방식으로 만들고 있기
> 때문에, 이 점을 주의하고 전체 패턴을 파악하고"*
>
> 맞는 지적이다. 하루치 결함 대부분이 그 패턴이었다.
>
>   바닥 판이 다섯 겹     이미 깔린 판을 모르고 또 깔았다
>   데크가 벽에서 0.23m   `solid` 가 있는데 `rect` 를 썼다
>   프로그램이 대지 전체  칸 단위 결정을 6칸 대지에 그대로 적용했다
>   **점포 체계 중복 직전** `shopfront.js` 에 이미 있는 것을 다시 만들 뻔했다
>
> `pipeline.md` 는 **익스포트**(glb→fbx→유니티) 문서다. 이 문서는 **도시가
> 만들어지는 순서**를 다룬다. 헷갈리지 않도록 이름을 나눴다.

## 1. 순서 — 누가 누구를 필요로 하나

`scenes/night-city/index.js` 의 호출 순서가 곧 의존 순서다. **뒤에 오는 것은
앞의 결과를 쓸 수 있고, 앞은 뒤를 못 쓴다.**

| 단계 | 만드는 것 | 앞에서 받는 것 | 뒤에 남기는 것 |
|---|---|---|---|
| `blockList()` | 대지 목록 + 용도 | `parcel.parcels()` | `blocks[]` |
| 골목 입구 | 자리 예약 | | `siteplan` claims |
| **towers** | 건물 전부 | `blocks` | `anchors[]` `signs[]` `alleys[]` |
| vertical | 데크·계단 | `anchors` | |
| bridges | 스카이브리지 | `anchors` | |
| holo | 홀로그램 | `anchors` | |
| **streets** | 노면·인도·차선·가로등 | `blocks`, `market.marketPits()` | |
| port · parking · alleys | | | |
| **programs** | 공사장·쌈지광장·공터·번화가 광장 | `blocks`, `signs` | 건물 수 |
| landmarks | 손 배치 여섯 | | |
| **signage** | 간판 전부 | `towers.signs` | |
| streetlife · crowd | 시설물·사람 | | |

순서에서 주의할 두 가지.

- `streets` 가 `towers` **뒤**다. 그래서 지하상가 구덩이(towers 안에서 생김)를
  지면 평면이 알 수 있다. 반대로 공사장·중앙홀 구덩이는 `streets` **뒤**에
  만들어지므로 미리 계산해 넘긴다 (`streets.groundHoles`).
- 간판은 **한 곳에서 한 번에** 세운다. 생성기는 `signs.push({...})` 로
  요청만 하고 그리지 않는다. 겹침 판정을 한 곳이 다 알아야 하기 때문이다.

## 2. 단일 출처 — 여기 없는 값을 새로 만들지 않는다

| 값 | 유일한 출처 |
|---|---|
| 블록 중심·피치 | `layout.blockCenter` · `blockPitch` |
| 블록/대지 경계 | `parcel.blockRect` (병합을 안다) |
| 도로 위치·폭 | `layout.roads()` — **상수 없음.** 판 사이에 남은 공간이다 |
| 도로가 열렸나 | `parcel.roadOpen` / `roadOpenZ` |
| 좌표 → 블록 번호 | `layout.blockIndexAt` |
| 도시 반폭 | `layout.CITY_HALF` |
| 구역값(인도 폭·간판 밀도·설비·밝기) | `district.byZone()` — **빠지면 터진다** |
| 블록 판 크기 | `layout.BLOCK_SIZE` 66 (고정) |
| 연석 높이 | `layout.CURB_HEIGHT` 0.16 |
| 패널 타일 | `layout.PANEL_TILE` 7.0 |
| 공사장 구덩이 | `program.PIT_HALF` · `constructionPit` |
| 중앙홀 구덩이 | `landmark.HALL_PIT_R` |
| 대문이 먹는 폭 | `landmark.GATE_SPAN` (**제일 넓은 조각** = 처마) |
| 광장·보행 전용 범위 | `plaza.PLAZA` · `PRECINCT` |
| 점포 벽감 깊이·1층 층고 | `shopfront.ALCOVE` · `SHOP_H` |
| 사각형 뺄셈 | `boxfaces.rectMinus` · `rectsMinus` |

## 3. 계약 — 생성기가 주고받는 것

### 3.1 앵커 (towers → vertical · bridges · holo)

    { rect, solid, top, zone, faces }

`rect` 는 **필지**, `solid` 는 **실제로 채운 사각형**이다. 건물은 필지를
`shrink(0.35~1.4)` 해서 짓는다.

> **벽에 무언가를 붙일 때는 반드시 `solid`.** `rect` 를 쓰면 최대 1.4m 뜬다.
> 브릿지에서 한 번(1기 14번), 데크에서 또 한 번 이 실수를 했다.

### 3.2 간판 (생성기 → signage)

    signs.push({ kind, rect, side, y, w, h, scheme })
    signs.push({ block: true, rect, side, y, h, w })   // 자리 예약만

`kind` 는 `banner·blade·billboard·mega·strip·box·cloth`. 종횡비는
`signage.ASPECT` 가 강제하므로 **w·h 를 마음대로 못 준다** — 면보다 넓으면
폭이 아니라 높이를 줄여 맞춘다.

### 3.3 빛 웅덩이 (생성기 → lightpool)

    pools.push({ kind:'floor', x, y, z, rx, rz, tint })
    pools.push({ kind:'wall',  x, y, z, w, h, yaw, tint })

가산합성이라 **tint 가 곧 밝기**다. 바닥 웅덩이는 눕힌 판이므로 **그 아래
있는 것을 덮는다** — 구덩이·계단 위에 깔지 않는다.

### 3.4 자리 예약 (siteplan)

    claim(x, z, r, TIER.X, label)   // 잡으면 true
    isFree(x, z, r, TIER.X)

`TIER` 는 작을수록 우선.
`INFRA 1 · ACCESS 2 · VERTICAL 3 · SAFETY 4 · LIGHT 5 · AMENITY 6 · GROUND 7`.
문 앞·골목 입구는 **먼저** 잡는다.

### 3.5 배치 원장 (모든 생성기 → placecheck)

    b.mark('building'|'deck'|'stair'|'bridge'|'holo'|'sign'|'fixture'|'alley'|'podium',
           label, meta)

표시한 뒤에 그린 것이 그 항목의 몸이다. **표시를 안 걸면 검사에서 사라진다.**

## 4. 난수 규율 — 어기면 도시 전체가 다시 뽑힌다

1. **구조적 결정은 좌표 해시(`hash2`)로.** 난수로 뽑으면 소비량이 갈린다.
2. **조건부로 건너뛸 때는 난수를 먼저 뽑고 그리기만 건너뛴다.**
3. 난수 호출 **횟수**가 같으면 범위는 바꿔도 된다.

어기면 픽셀 회귀 20뷰가 전부 "다름" 이 되어 아무것도 못 잡는다.

## 5. 1층 점포 — **이미 있는 체계다. 새로 만들지 않는다**

`shopfront.js` 가 이 도시의 점포 체계다.

    ALCOVE 1.3   벽감 깊이
    SHOP_H 3.4   1층 층고
    frameOf(sub, side)   면 위 좌표계 — at(u,d) · rect(u0,u1,d0,d1) · dims(w,d)
    buildBay(b, sub, side, y, rng, mats, D, signs)

    TYPES = [ openShop 2.6 · noodleShop 1.3 · stall 1.5 · barDoor 1.4 ]
    보조: shuttered · awning · sideReturns · entranceBay · showcase

`noodleShop` 은 이미 카운터·스툴·매달린 전구·김 나는 냄비를 만든다.

**소비자**: `bazaar.shopStrip` → `buildBay`. 시장 대문과 아케이드는 자기
점포 띠를 따로 만든다. **기업·주거·공업·슬럼은 안 쓴다.**

### 알려진 한계 — 다음 작업은 여기를 늘리는 것이다

| | |
|---|---|
| 깊이 | `ALCOVE 1.3` 은 벽감이지 실내가 아니다. "들어간다" 가 안 읽힌다 |
| 구역차 | `TYPES` 가 **전역 목록**이다. 슬럼과 번화가가 같은 점포를 쓴다 |
| 기업 | `buildBay` 를 안 쓴다. 1층이 검은 필로티다 (실측: 눈높이에 아무것도 없다) |
| 종류 | 편의점·리퍼닥·드롭포인트·자판기 군집이 없다 |

## 6. 새 기능을 붙일 때 — 점검 목록

1. **같은 일을 하는 것이 이미 있나?** (5절이 그 사례다)
2. 내가 쓰려는 값의 **단일 출처**가 2절에 있나? 없으면 어디에 둘 것인가?
3. 내 것이 **덮는 것**이 있나? 특히 가로로 누운 큰 판 — 지면 평면·대지 판·
   포장·빛 웅덩이
4. 파이프라인 **순서**상 내가 필요한 것이 이미 만들어져 있나?
5. 난수 소비량이 조건에 따라 갈리지 않나?
6. `b.mark` 를 걸었나? 안 걸면 배치 검사가 못 본다
7. 내가 파사드에 놓는 것이 **자리를 차지하나?** 그렇다면 파사드 대장에
   `block: true` 로 신고했나 (3절 '자리 예약'). 신고 안 한 것은 없는 것이라,
   간판이 그 위에 걸린다 — 복도에서 한 번, 창에서 또 한 번 겪었다
8. **검사를 새로 넣었으면 일부러 한 번 틀리게 만들어 빨간불을 본다.**
   간판 겹침 검사는 넣은 날부터 0 만 보고했고, 그게 "깨끗해서" 가 아니라
   **판정이 걸릴 수 없는 모양이어서**였다 (status.md 2.4)
9. **판에 텍스처를 붙일 때 판의 비율이 텍스처의 비율인가?** `autoBox` 는
   6번째 인자가 타일이고 (5번째는 모따기다), 안 주면 UV 가 판 크기에
   맞춰져 **그림이 늘어난다.** 넓은 면은 한 장으로 덮지 말고 텍스처 비율로
   잘라 잇는다 — 조각 경계가 곧 창 사이 벽이 되게
10. **텍스처의 행·열 수는 "한 장이 무엇을 덮는가" 와 맞아야 한다.**
    `tenantWindows` 는 3행짜리인데 쓰는 쪽은 층마다 한 장을 붙였다.
    한 층에 창이 세 줄로 들어가 창이 잘아 보였다 (status.md 3.11)
11. **텍스처 한 장이 두 가지를 담고 있지 않은지 본다.** `shopfront` 는
    간판 띠와 점포 유리를 한 장에 그리고 있었다. 그러면 **붙이는 곳을 아무리
    골라도 그림 안에 든 것이 따라온다** — "창 위의 간판" 을 지우려고 3D
    배너를 다 치웠는데 그대로였던 이유가 이것이다. 한 장은 한 가지만 한다
