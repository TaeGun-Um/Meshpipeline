// 툰 셰이딩과 아웃라인.
//
// ── 왜 마스터를 새로 만드나 ────────────────────────────────────────────────
// core/material.js 의 마스터 다섯은 전부 MeshStandardMaterial(PBR) 이다.
// 서브컬처 아바타의 룩은 PBR 이 아니라 **단계진 램프 + 선**에서 나온다.
// 그래서 이 씬이 자기 마스터를 갖는다 — MasterMaterial 클래스는 core 가
// 내보내므로 씬이 파생을 만드는 것은 계층 위반이 아니다.
//
// ── 파이프라인 주의 ────────────────────────────────────────────────────────
// MeshToonMaterial 은 glTF 로 나갈 때 표준 PBR 로 **낮춰져** 나간다.
// 엔진 쪽에서는 툰 셰이더(lilToon·UTS2 등)를 다시 배정해야 한다.
// 반면 **아웃라인은 지오메트리라 그대로 나간다** — 그래서 셰이더가 아니라
// 역법선 껍질로 만든다.
import * as THREE from 'three';
import { MasterMaterial } from '../../core/material.js';

// 단계 램프. three 는 gradientMap 을 N·L 로 샘플한다.
// 값이 몇 개냐가 곧 명암 단계 수다 — 애니는 둘이 기본이고, 셋을 넘기면
// 회색이 늘어 사진처럼 보이기 시작한다.
const rampCache = new Map();
function ramp(steps) {
  const key = steps.join(',');
  if (rampCache.has(key)) return rampCache.get(key);
  const data = new Uint8Array(steps.length * 4);
  steps.forEach((v, i) => {
    const b = Math.round(v * 255);
    data[i * 4] = b;
    data[i * 4 + 1] = b;
    data[i * 4 + 2] = b;
    data[i * 4 + 3] = 255;
  });
  const t = new THREE.DataTexture(data, steps.length, 1, THREE.RGBAFormat);
  // 보간하면 단계가 뭉개져 그냥 램버트가 된다. 반드시 Nearest.
  t.minFilter = t.magFilter = THREE.NearestFilter;
  t.needsUpdate = true;
  rampCache.set(key, t);
  return t;
}

// 살결처럼 **거의 안 꺾이는** 램프. 얼굴에 명암 경계가 지나가면
// 그려 넣은 눈매가 반쪽만 어두워져 인상이 통째로 무너진다.
export const RAMP_SKIN = [0.9, 1.0];
// 옷·머리는 두 단계가 선명하게 보이는 편이 좋다.
export const RAMP_CLOTH = [0.68, 1.0];
export const RAMP_HAIR = [0.84, 1.0];

// ── 림 라이트 ──────────────────────────────────────────────────────────────
//
// 서브컬처 아바타의 룩에서 단계 램프 다음으로 큰 것이 **가장자리 빛**이다.
// 실루엣을 배경에서 떼어 놓고, 곡면이 곡면으로 읽히게 만든다. 없으면 툰
// 셰이딩이 그냥 "색을 두 단계로 칠한 플라스틱" 으로 보인다.
//
// MeshToonMaterial 에는 슬롯이 없어서 셰이더에 주입한다.
// **이건 glTF 로 안 나간다** — 엔진 쪽 툰 셰이더에서 다시 켜야 한다.
// (아웃라인을 셰이더가 아니라 지오메트리로 만든 이유가 이것과 대비된다)
function injectRim(mat, strength, color) {
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uRimK = { value: strength };
    sh.uniforms.uRimC = { value: new THREE.Color(color) };
    sh.fragmentShader = sh.fragmentShader
      .replace(
        '#include <common>',
        ['#include <common>', 'uniform float uRimK;', 'uniform vec3 uRimC;'].join('\n')
      )
      .replace(
        '#include <dithering_fragment>',
        [
          'float rimD = 1.0 - abs(dot(normalize(normal), normalize(vViewPosition)));',
          // 좁고 선명해야 한다. 넓게 퍼지면 안개 낀 것처럼 보인다
          'rimD = smoothstep(0.62, 0.98, rimD);',
          'gl_FragColor.rgb += rimD * uRimK * uRimC;',
          '#include <dithering_fragment>',
        ].join('\n')
      );
  };
  // 캐시 키를 안 바꾸면 three 가 같은 프로그램을 재사용해 주입이 무시된다
  mat.customProgramCacheKey = () => `rim${strength}_${color}`;
  return mat;
}

export const Toon = new MasterMaterial('Toon', {
  params: {
    color: 0xffffff,
    map: null,
    steps: RAMP_CLOTH,
    transparent: false,
    alphaTest: 0,
    side: null,
    emissive: 0x000000,
    rim: 0, // 0 이면 안 넣는다
    rimColor: 0xdfe6ff,
  },
  create(p) {
    const o = {
      color: new THREE.Color(p.color),
      gradientMap: ramp(p.steps),
      emissive: new THREE.Color(p.emissive),
    };
    if (p.map) o.map = p.map;
    if (p.side !== null) o.side = p.side;
    if (p.transparent) o.transparent = true;
    if (p.alphaTest) o.alphaTest = p.alphaTest;
    const m = new THREE.MeshToonMaterial(o);
    return p.rim > 0 ? injectRim(m, p.rim, p.rimColor) : m;
  },
});

// 선 재질. 빛을 받지 않아야 한다 — 아웃라인이 명암을 받으면 선이 아니라
// 테두리 띠가 된다.
const Line = new MasterMaterial('ToonLine', {
  params: { color: 0x2a2537 },
  create: (p) =>
    new THREE.MeshBasicMaterial({
      color: new THREE.Color(p.color),
      side: THREE.BackSide,
      // 뒷면만 그리므로 깊이 기록은 정상적으로 해야 겹친 부위가 맞는다
      polygonOffset: true,
      polygonOffsetFactor: 1,
      polygonOffsetUnits: 1,
    }),
});

// ── 역법선 껍질 ────────────────────────────────────────────────────────────
//
// 정점을 법선 방향으로 t 만큼 밀어낸 사본을 뒷면만 그린다. 셰이더가 아니라
// **지오메트리**라서 glTF·FBX 를 그대로 통과한다.
//
// 두께를 세계 단위로 고정하면 작은 부품(손가락·장식)에서 선이 부품보다
// 굵어진다. 그래서 부위마다 값을 받는다.
function outlineOf(geo, t = 0.006, color = 0x2a2537) {
  const g = geo.clone();
  const pos = g.attributes.position;
  const nor = g.attributes.normal;
  if (!nor) g.computeVertexNormals();
  const n = g.attributes.normal;
  for (let i = 0; i < pos.count; i++) {
    pos.setXYZ(
      i,
      pos.getX(i) + n.getX(i) * t,
      pos.getY(i) + n.getY(i) * t,
      pos.getZ(i) + n.getZ(i) * t
    );
  }
  pos.needsUpdate = true;
  g.computeVertexNormals();
  return new THREE.Mesh(g, Line.instance({ color }));
}

// 메시와 그 아웃라인을 함께 담은 그룹.
export function withOutline(mesh, t = 0.006, color = 0x2a2537) {
  const grp = new THREE.Group();
  grp.name = mesh.name ? `${mesh.name}Grp` : 'Outlined';
  grp.add(mesh);
  const o = outlineOf(mesh.geometry, t, color);
  o.name = `${mesh.name || 'mesh'}Line`;
  o.castShadow = false;
  o.receiveShadow = false;
  grp.add(o);
  return grp;
}
