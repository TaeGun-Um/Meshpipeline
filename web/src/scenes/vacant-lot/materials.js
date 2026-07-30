// 공터의 재질 묶음.
//
// 전부 마스터 머티리얼에서 instance() 로 뽑는다 (core/material.js). 값이 같으면
// 같은 객체가 나오고, 파라미터 이름 오타가 즉시 잡힌다.
//
// 예외가 하나 있다: 잡초 재질은 `onBeforeCompile` 로 정점 셰이더에 바람 코드를
// 주입한다 (scatter.js). 그건 파라미터가 아니라 컴파일 훅이라 마스터의 슬롯으로
// 표현할 수 없고, 쓰는 곳이 한 군데뿐이라 훅 슬롯을 만드는 건 과한 일반화다.
// 그래서 그 하나만 scatter.js 에서 직접 만든다.
import * as TEX from './textures.js';
import { TexturedSurface, SolidSurface } from '../../core/material.js';

// 텍스처 세트 -> 머티리얼. 호출부 12곳이 (세트, 가로반복, 세로반복) 순서로
// 부르고 있어서 그 모양을 유지하는 얇은 어댑터다. 몸통은 마스터 호출 하나다.
export function texMaterial(set, rx, ry, extra = {}) {
  return TexturedSurface.instance({ set, repeatX: rx, repeatY: ry, ...extra });
}

// ── 공유 재질 ──────────────────────────────────────────────────────────────

export function buildMaterials() {
  const brickSet = TEX.brickTextures();
  const wallSets = [
    TEX.wallTextures(5101, [212, 205, 190]),
    TEX.wallTextures(5201, [186, 178, 168]),
    TEX.wallTextures(5301, [198, 186, 160]),
  ];
  const roofMats = [
    texMaterial(TEX.roofTextures(5401, [58, 78, 112]), 3, 3, { metalness: 0.25 }),
    texMaterial(TEX.roofTextures(5501, [58, 96, 82]), 3, 3, { metalness: 0.25 }),
    texMaterial(TEX.roofTextures(5601, [120, 66, 58]), 3, 3, { metalness: 0.2 }),
  ];

  const solid = (name, color, roughness, extra = {}) =>
    SolidSurface.instance({ color, roughness, ...extra }, name);

  return {
    brickSet,
    wallSets,
    roofMats,
    capMat: solid('Cap', 0xada99f, 0.92),
    frameMat: solid('Frame', 0xe8e6e1, 0.72),
    // 유리는 환경맵 반사가 없으면 그냥 검은 구멍으로 보인다 (씬이 PMREM 주입)
    glassMat: solid('Glass', 0x44565f, 0.09, { metalness: 0.85, envMapIntensity: 1.6 }),
    railMat: solid('Rail', 0xa8abaf, 0.55, { metalness: 0.35 }),
    shutterMat: solid('Shutter', 0x9a9d9c, 0.55, { metalness: 0.4 }),
    tankMat: solid('Tank', 0x2f6fb0, 0.55),
    concreteMat: solid('Concrete', 0xa8a49c, 0.92),
    insulatorMat: solid('Insulator', 0x4a4f52, 0.5),
    transformerMat: solid('Transformer', 0x8e9296, 0.6, { metalness: 0.3 }),
    wireMat: solid('Wire', 0x14161a, 0.85),
  };
}
