// 사이버펑크 색 어휘 — 씬 사이에 공유된다.
//
// ── 색을 고르는 원칙 ───────────────────────────────────────────────────────
// 사이버펑크의 색은 "네온 몇 개를 어둠에 던진다"가 아니라 **대비 구조**다.
//   - 환경광은 차갑고 어둡다 (청록·군청)
//   - 발광은 뜨겁고 채도가 높다 (마젠타·시안·호박)
//   - 그 사이 중간 밝기가 거의 없어야 네온이 네온으로 읽힌다
//
// 그리고 색의 역할을 나눠야 한다. 이 프로젝트에서 실제로 배운 것:
//   **창문은 백색·전구색, 색은 간판이 만든다.**
// 창문에 채도 높은 색을 5%만 섞어도 화면을 지배해서 도시가 크리스마스트리가 되고,
// 정작 간판의 색이 죽는다.

// 발광색 (sRGB 16진)
export const NEON = {
  cyan: 0x2ff2ff,
  magenta: 0xff2bc4,
  pink: 0xff4d78,
  blue: 0x4a6cff,
  green: 0x6bff8f,
  amber: 0xffa32b,
  violet: 0xa64dff,
  warm: 0xffd9a0, // 실내 백열등
  cool: 0xcfe4ff, // 실내 형광등
};

// 간판 배색 조합. 한 간판 안에서 바탕 / 글자 / 테두리를 이 셋으로 맞춘다.
// 바탕이 거의 검은 이유: 글자와 테두리만 빛나야 글자가 읽힌다. 바탕까지 밝으면
// 통짜 색면이 된다.
export const SIGN_SCHEMES = [
  { ground: 0x14030f, glyph: NEON.magenta, edge: NEON.cyan },
  { ground: 0x030f14, glyph: NEON.cyan, edge: NEON.magenta },
  { ground: 0x140b03, glyph: NEON.amber, edge: NEON.pink },
  { ground: 0x0a0314, glyph: NEON.violet, edge: NEON.blue },
  { ground: 0x03140a, glyph: NEON.green, edge: NEON.cyan },
  { ground: 0x14030a, glyph: NEON.pink, edge: NEON.amber },
];

// 야간 도시 표면 알베도의 출발점. 씬이 복사해서 조정한다.
//
// 값이 이 정도로 어두운 이유와, 그보다 더 내리면 안 되는 이유가 둘 다 있다.
// 처음에 panel 을 [38,40,48] 까지 내렸는데, 좁은 골목에는 달빛이 들어오지 못하고
// 발광 표면은 주변을 밝히지 못하므로 벽이 통째로 사라져 창문만 공중에 뜬
// 스티커처럼 보였다. 간접광(환경맵)이 걸릴 여지를 남겨야 한다.
export const DEFAULT_SURFACE = {
  asphalt: [40, 39, 46],
  puddle: [16, 17, 24],
  concrete: [76, 74, 84],
  panel: [70, 71, 82],
  tileWall: [84, 80, 92],
  metal: [66, 69, 78],
  rust: [78, 54, 44],
  duct: [72, 75, 82],
  curb: [86, 83, 92],
  frame: [34, 34, 40],
};

// 16진 -> [r,g,b] 0..255
export function rgb255(hex) {
  return [(hex >> 16) & 255, (hex >> 8) & 255, hex & 255];
}

// 16진 -> [r,g,b] 0..1, 계수 k 를 곱해서. 정점 컬러용.
export function rgb01(hex, k = 1) {
  return [
    (((hex >> 16) & 255) / 255) * k,
    (((hex >> 8) & 255) / 255) * k,
    ((hex & 255) / 255) * k,
  ];
}

// [r,g,b] 0..255 -> 16진. 팔레트 배열을 마스터 머티리얼의 color 로 넘길 때 쓴다.
export function packRGB(a) {
  return (Math.round(a[0]) << 16) | (Math.round(a[1]) << 8) | Math.round(a[2]);
}
