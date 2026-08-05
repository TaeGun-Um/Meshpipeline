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

  // 바닥 — 비닐 타일 두 색과 콘크리트
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

  return {
    floorOf: (k) => pick(FLOOR_BY, k, '바닥'),
    ceilOf: (k) => pick(CEIL_BY, k, '천장'),

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
    steelDark: tex(TEX.steelTextures(4511, [92, 98, 104]), 1, 1, { metalness: 0.18 }),

    // 유리는 환경맵 반사가 없으면 검은 구멍이다 (씬이 PMREM 을 주입한다)
    glass: solid('Glass', 0x8fa6ad, 0.06, {
      metalness: 0.1,
      transparent: true,
      opacity: 0.24,
      envMapIntensity: 1.8,
    }),

    // ── 가구 ───────────────────────────────────────────────────────────────
    laminate: solid('Laminate', 0xb8ab90, 0.6), // 책상·식탁 상판
    plastic: solid('Plastic', 0x3f6d7a, 0.62), // 의자
    plasticWarm: solid('PlasticWarm', 0xa8623f, 0.62),
    rack: solid('Rack', 0x3a4048, 0.52, { metalness: 0.15 }),
    vend: solid('Vend', 0x8c2b30, 0.5, { metalness: 0.2 }),
    vendBlue: solid('VendBlue', 0x24486e, 0.5, { metalness: 0.2 }),
    paper: solid('Paper', 0xd8d4c6, 0.86),
    rubber: solid('Rubber', 0x1e2126, 0.9),

    // ── 알아볼 수 있게 만드는 데 필요한 것들 ───────────────────────────────
    //
    // 상자에 색만 칠하면 그 물건이 안 된다. 배전반은 **경고 딱지**가 있어야
    // 배전반이고, 서버랙은 **망문**이 있어야 서버랙이다. 그 조각들에 쓸 색.
    warn: solid('Warn', 0xc9a227, 0.72), // 경고 딱지
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
    porcelain: solid('Porcelain', 0xeceae4, 0.32), // 변기·세면볼 — 도기 흰색
    carton: solid('Carton', 0xa8906a, 0.9), // 골판지
    cartonDark: solid('CartonDark', 0x826d4e, 0.92), // 골판지 접힌 자리
    crate: solid('Crate', 0x2f5d54, 0.68), // 플라스틱 상자
    keycap: solid('Keycap', 0xcfc9b8, 0.8), // 자판
    crt: solid('Crt', 0xc9c2ad, 0.72), // 브라운관 몸통 (누런 베이지)
    crtDark: solid('CrtDark', 0x2b2e33, 0.5), // 베젤·화면 테두리

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
    screen: glow('Screen', { color: 0x7fd4ff, intensity: 0.55, tint: 0.15 }),
  };
}
