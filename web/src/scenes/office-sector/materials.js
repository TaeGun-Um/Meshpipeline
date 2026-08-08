// 이 시설의 재질 묶음. 전부 마스터에서 instance() 로 뽑는다.
//
// **구역별 표.** 바닥·천장이 칸 종류마다 다르다 — 도시에서 모듈마다 자기 표를
// 갖고 빠진 구역을 `??` 로 때웠다가 어긋난 적이 있어, 여기서는 빠지면 던진다.
//
// **정점 컬러는 여기서 한 번에 켠다.** 조명을 정점에 굽기 때문에(bake.js) 이
// 씬의 모든 재질이 color 속성을 읽어야 한다. 하나라도 빠지면 그 메시만 조명이
// 통째로 빠진 것처럼 보이는데, 화면에서는 "저기가 좀 밝네" 로만 읽힌다 —
// 굽는 쪽이 꺼진 재질을 만나면 던지도록 해 두었다.
import * as TEX from './textures.js';
import { TexturedSurface, SolidSurface, Glow } from '../../core/material.js';
import { BAKED } from './bake.js';

export function buildMaterials() {
  const VC = { vertexColors: BAKED };
  const tex = (set, rx, ry, extra = {}) =>
    TexturedSurface.instance({ set, repeatX: rx, repeatY: ry, ...VC, ...extra });
  const solid = (name, color, roughness, extra = {}) =>
    SolidSurface.instance({ color, roughness, ...VC, ...extra }, name);
  const glow = (name, p) => Glow.instance({ ...p, ...VC }, name);

  // 바닥 — 비닐 타일 세 장(복도·카페·서버실)과 콘크리트
  const vinylWarm = tex(TEX.vinylTextures(4101, [198, 192, 176]), 1, 1); // 복도·사무실
  const vinylCool = tex(TEX.vinylTextures(4111, [178, 186, 186]), 1, 1); // 카페테리아
  // 플라자 바닥 — 밝은 쪽 폴리싱 콘크리트. 여기가 이 층의 중심이라
  // 화면에서 제일 밝아야 하는데, 어두운 기본값으로는 복도에 밀렸다.
  const concrete = tex(TEX.concreteTextures(4201, 142, 186), 1, 1);
  const serverFloor = tex(TEX.vinylTextures(4121, [150, 156, 164]), 1, 1);

  const FLOOR_BY = {
    plaza: concrete,
    corridor: vinylWarm,
    room: vinylWarm,
    cafeteria: vinylCool,
    server: serverFloor,
    control: serverFloor, // 관제실 — 서버실과 같은 전산 권역의 마감
    kitchen: vinylCool, // 주방 — 식당과 같은 계열
  };

  // **노말을 세게 주면 안 된다.** 천장은 바로 아래 등을 정면으로 받는 면이라,
  // 노말이 조금만 누워도 그 빛을 통째로 놓친다.
  const ceilTile = tex(TEX.ceilingTileTextures(), 1, 1, { normalScale: 0.3 });
  // 플라자는 천장이 높아 마감 텍스를 안 쓴다 — 구조가 그대로 보인다
  const ceilDeck = tex(TEX.concreteTextures(4211), 1, 1, { normalScale: 0.4 });
  const CEIL_BY = {
    plaza: ceilDeck,
    corridor: ceilTile,
    room: ceilTile,
    cafeteria: ceilTile,
    server: ceilTile,
    control: ceilTile,
    kitchen: ceilTile,
  };

  const pick = (table, kind, what) => {
    const m = table[kind];
    if (!m) throw new Error(`${what} 표에 '${kind}' 가 없다`);
    return m;
  };

  // 문 팻말 — 라벨마다 텍스처 한 장. **빌드 한 번의 수명**이라 모듈 캐시가
  // 아니다 (buildMaterials 는 빌드마다 새로 돈다 — scenestate 등록이 필요 없는
  // 유일한 종류의 캐시다). 같은 라벨이 여러 문에 걸려도 한 장만 굽는다.
  const signCache = new Map();

  return {
    floorOf: (k) => pick(FLOOR_BY, k, '바닥'),
    ceilOf: (k) => pick(CEIL_BY, k, '천장'),
    signOf: (label) => {
      if (!signCache.has(label)) {
        // 반복 1x1 — 팻말은 면 하나를 통째로 채운다 (b.box 의 tile=0 과 짝)
        signCache.set(label, tex(TEX.signTextures(label), 1, 1));
      }
      return signCache.get(label);
    },
    // 자판기 옆면 광고 — 종류마다 한 장. 상자 조각으로 때우던 것을 인쇄물
    // 한 장으로 바꿨다 (2026-08-06 지시). signOf 와 같은 캐시 규약이다.
    vendSideOf: (kind) => {
      const key = `vend:${kind}`;
      if (!signCache.has(key)) signCache.set(key, tex(TEX.vendSideTextures(kind), 1, 1));
      return signCache.get(key);
    },
    // 병 라벨 — 흰 띠에 색 띠만 감으면 무슨 병인지 모른다. 그림기호와 글자를
    // 한 장에 굽는다. 감기는 면이라 반복은 1x1 (u 가 딱 한 바퀴).
    // 둘레·높이를 **미터로** 넘긴다 — 글자와 그림이 안 찌그러지려면
    // 텍스처가 붙는 실제 크기를 알아야 한다 (bottleLabelTextures 주석).
    // **캐시 키는 텍스처를 결정하는 모든 값을 담아야 한다.** kind 만 키로
    // 썼더니, 같은 종류를 다른 크기로 부르면 먼저 구운 글자 비율을 조용히
    // 물려받는 상태였다 (2026-08-07 코드리뷰). signOf/vendSideOf 는 인자가
    // 하나뿐이라 안 걸렸던 함정이다 — 인자가 늘면 키도 같이 늘린다.
    bottleLabelOf: (kind, circ, hgt) => {
      const key = `label:${kind}:${circ.toFixed(3)}:${hgt.toFixed(3)}`;
      if (!signCache.has(key)) {
        signCache.set(key, tex(TEX.bottleLabelTextures(kind, circ, hgt), 1, 1));
      }
      return signCache.get(key);
    },

    wall: tex(TEX.blockWallTextures(), 1, 1),
    wallLow: tex(TEX.blockWallTextures(4311, [122, 132, 130]), 1, 1), // 굽도리 띠
    rock: tex(TEX.concreteTextures(4221), 1, 1, { normalScale: 1.2 }),

    // ── 금속도를 낮춰 잡는다 ─────────────────────────────────────────────
    //
    // **구운 정점 컬러는 알베도에만 곱한다.** 금속은 알베도가 거의 없고 반사로
    // 보이는 물건이라, metalness 를 올려 두면 구운 빛이 통째로 안 실린다.
    // 실제로 덕트가 새카맣게 보여 조명을 두 번 고쳤는데(광원 높이·배광), 값을
    // 재 보니 구운 값은 0.26 으로 멀쩡했고 범인은 metalness 0.45 였다.
    //
    // 물리적으로도 이쪽이 맞다. 도장 강판·아연도금 덕트·분체도장 랙은 표면이
    // 페인트라 거의 확산면이다. 맨 금속이 아니다.
    trim: solid('Trim', 0x6f7479, 0.55, { metalness: 0.12 }),
    steel: tex(TEX.steelTextures(), 1, 1, { metalness: 0.15 }),
    // 가전 도장판 — 세탁기 몸통. 강판 색(짙은 청회색 + 녹)으로 두었더니
    // 세탁기가 아니라 고물통이었다 (2026-08-08). 밝은 상아색에 녹은 0.2
    enamel: tex(TEX.steelTextures(4521, [198, 197, 190], 0.2), 1, 1, { metalness: 0.06, roughness: 0.45 }),
    // 같은 색의 **민 재질** — 링·원판처럼 uv 가 늘어나는 조각에 쓴다.
    // 텍스처를 그대로 씌우면 얼룩이 고리를 감고 돌아 표범 무늬가 된다
    enamelPlain: solid('EnamelPlain', 0xc3c2bb, 0.5, { metalness: 0.06 }),
    steelDark: tex(TEX.steelTextures(4511, [92, 98, 104]), 1, 1, { metalness: 0.18 }),

    // 유리는 환경맵 반사가 없으면 검은 구멍이다 (씬이 PMREM 을 주입한다)
    glass: solid('Glass', 0x8fa6ad, 0.06, {
      metalness: 0.1,
      transparent: true,
      opacity: 0.24,
      envMapIntensity: 1.8,
    }),

    // ── 가구 ───────────────────────────────────────────────────────────────
    //
    // **채도를 한 단 내렸다** (2026-08-08 지시 "텍스쳐가 너무 쨍한 느낌").
    // 이 씬의 팔레트 근거는 "90년대 기관 건물 — 채도가 낮고 때가 타 있다"
    // 인데, 가구 색이 그 규칙을 혼자 벗어나 새 플라스틱처럼 보였다.
    // 방법은 **휘도 쪽으로 30~40% 당기고 한 톤 낮추기**다 (색상은 그대로).
    // 인쇄물(자판기 옆면·경고 딱지)은 예외다 — 잉크는 원래 채도가 높다.
    laminate: solid('Laminate', 0xa89d86, 0.66), // 책상·식탁 상판
    plastic: solid('Plastic', 0x4a6b73, 0.66), // 의자
    plasticWarm: solid('PlasticWarm', 0x8c6350, 0.68),
    rack: solid('Rack', 0x3a4048, 0.52, { metalness: 0.15 }),
    vend: solid('Vend', 0x8c2b30, 0.5, { metalness: 0.2 }),
    vendBlue: solid('VendBlue', 0x24486e, 0.5, { metalness: 0.2 }),
    paper: solid('Paper', 0xd8d4c6, 0.86),
    rubber: solid('Rubber', 0x1e2126, 0.9),

    // ── 알아볼 수 있게 만드는 데 필요한 것들 ───────────────────────────────
    //
    // 상자에 색만 칠하면 그 물건이 안 된다. 배전반은 **경고 딱지**가 있어야
    // 배전반이고, 서버랙은 **망문**이 있어야 서버랙이다. 그 조각들에 쓸 색.
    warn: solid('Warn', 0xb89b3f, 0.76), // 경고 딱지 — 잉크지만 바랬다
    // 서버 유닛 앞판. **랙 몸통보다 뚜렷이 밝아야 한다** — 처음에 0x40454d
    // 로 뒀더니 알베도가 0.056 이라 구운 빛(0.25)을 곱하면 사실상 검정이고,
    // 애써 나눈 U 칸이 하나도 안 보였다.
    bezel: solid('Bezel', 0x767c85, 0.55, { metalness: 0.12 }),
    // 서버랙 망문 — 구멍을 뚫는 대신 반투명으로 낸다. 뒤의 유닛과 표시등이
    // 비쳐 보여야 "잠긴 문" 으로 읽힌다. 실제 타공문은 개구율이 60~70% 라
    // 불투명도도 그만큼 낮다.
    meshDoor: solid('RackMesh', 0x1b1f25, 0.62, {
      metalness: 0.15,
      transparent: true,
      opacity: 0.4,
    }),
    // 도기 — **순백은 새것이다.** 쓰던 변기·세면볼은 약간 회색이고 덜 반짝인다
    porcelain: solid('Porcelain', 0xdedbd3, 0.4),
    // 변기 시트 — **도기와 같은 흰색으로 두면 시트가 안 보인다.** 실제로도
    // 사발은 도기, 시트는 플라스틱이라 색·광택이 다르다 (2026-08-07 지적).
    seatPad: solid('SeatPad', 0xb2b0a6, 0.5),
    // 거울 — 어두운 강판으로 뒀더니 **검은 널판**이었다 (2026-08-06 지적).
    // 진짜 반사는 없지만 매끈하고 밝은 금속면 + 환경맵이면 거울로 읽힌다.
    mirror: solid('Mirror', 0xaebfcb, 0.05, { metalness: 0.72, envMapIntensity: 2.0 }),
    // 수건 — 테리 고리 결 + 짜 넣은 띠. 띠는 **텍스처에** 있다 (조각으로
    // 얹으면 삼각형을 쓰는 짓이다). props.foldedTowel 이 uv 를 정점 좌표에서
    // 직접 짜므로 띠가 접힌 자리를 돌아 앞뒤로 이어진다.
    // 두 색을 번갈아 쌓아야 갠 층이 보인다
    towel: tex(TEX.towelTextures([240, 238, 232], [74, 118, 134], 5001), 1, 1, { normalScale: 0.8 }),
    towelWarm: tex(TEX.towelTextures([232, 224, 206], [184, 118, 88], 5011), 1, 1, { normalScale: 0.8 }),
    // 담요·베갯잇 — 반복은 **UV 에 구워** 온다 (props.CLOTH_UV). repeat 을 쓰면
    // 안 된다: bakeTextureRepeat 이 그 배율을 **병합 메시 전체의 UV** 에 곱해서,
    // 같은 메시에 있던 TV 화면·신문까지 3x3 으로 갈라졌다 (2026-08-08).
    blanket: tex(TEX.blanketTextures(), 1, 1, { normalScale: 1.0 }),
    // 베갯잇 — 가까이 보는 작은 것에만 쓴다. 넓은 면에 깔면 반복 타일이 격자로 뜬다
    sheet: tex(TEX.blanketTextures([224, 226, 224], 5411, 0.015, 0.12, 0.18), 1, 1, { normalScale: 0.22 }),
    // 빨랫감 — 벗어 던진 천이라 **잔주름이 세다**(foldK 0.9). 색도 갈라 둔다:
    // 흰 것만 쌓아 두면 개수가 안 보인다
    clothGrey: tex(TEX.blanketTextures([150, 152, 148], 5421, 0.05, 0.9, 0.7), 1, 1, { normalScale: 0.95 }),
    clothWarm: tex(TEX.blanketTextures([196, 188, 170], 5431, 0.06, 0.9, 0.7), 1, 1, { normalScale: 0.95 }),
    // 신문 지면 — 제호·괘선·단·사진이 **텍스처 안에** 있다. 조각으로 쌓으면
    // 글줄 하나가 삼각형 열둘이고 비스듬히 보면 두께가 다 드러난다
    newsprint: tex(TEX.newsprintTextures(), 1, 1),
    // 가루세제 갑 — 인쇄물이라 한 장으로 구웠다
    detergentBox: tex(TEX.detergentBoxTextures(), 1, 1),
    carton: solid('Carton', 0x9c8b72, 0.92), // 골판지
    cartonDark: solid('CartonDark', 0x7c6c55, 0.94), // 골판지 접힌 자리
    crate: solid('Crate', 0x3b5a54, 0.72), // 플라스틱 상자
    keycap: solid('Keycap', 0xcfc9b8, 0.8), // 자판
    crt: solid('Crt', 0xc9c2ad, 0.72), // 브라운관 몸통 (누런 베이지)
    crtDark: solid('CrtDark', 0x2b2e33, 0.5), // 베젤·화면 테두리
    crtVent: solid('CrtVent', 0x14161a, 0.85), // 천판 슬롯 속
    // 비디오 데크 표시창 — 아무도 안 맞춘 12:00
    vcrDisplay: tex(TEX.vcrDisplayTextures(), 1, 1, { roughness: 0.22, emissiveIntensity: 0.7 }),
    // 화면에 나오는 것 — 단색 발광판이 아니라 **방송 한 컷**이다
    tvScreen: tex(TEX.crtScreenTextures(), 1, 1, { roughness: 0.16, emissiveIntensity: 0.62 }),

    // ── 빛 ─────────────────────────────────────────────────────────────────
    //
    // **발광면은 주변을 밝히지 않는다** (lessons.md 3.1). 아래는 "보이는 것"
    // 이고, "밝히는 것" 은 lights.js 의 실제 광원이 맡는다. 짝으로 둔다.
    lamp: glow('Fluoro', { color: 0xf2f6ff, intensity: 0.95, tint: 0.5 }),
    lampWarm: glow('FluoroWarm', { color: 0xfff0d4, intensity: 0.92, tint: 0.5 }),
    lampCold: glow('FluoroCold', { color: 0xcfe4ff, intensity: 0.9, tint: 0.45 }),
    exit: glow('ExitSign', { color: 0x35ff7a, intensity: 0.85, tint: 0.2 }),
    led: glow('RackLed', { color: 0x64ffa0, intensity: 0.8, tint: 0.1 }),
    ledAmber: glow('RackLedAmber', { color: 0xffb443, intensity: 0.75, tint: 0.1 }),
    ledRed: glow('LedRed', { color: 0xff4436, intensity: 0.7, tint: 0.12 }),
    screen: glow('Screen', { color: 0x7fd4ff, intensity: 0.55, tint: 0.15 }),
  };
}
