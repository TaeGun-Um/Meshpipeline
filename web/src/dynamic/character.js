// 스킨드 메시 캐릭터.
//
// 이전 버전은 관절마다 Group을 두고 박스를 매단 "강체 계층"이었다. 겉모습은
// 같지만 엔진 입장에서는 오브젝트 19개일 뿐이고, 스켈레탈 애니메이션도
// 아바타 리타게팅도 쓸 수 없다.
//
// 부위가 전부 강체 박스라 리지드 스키닝으로 충분하다 — 정점마다 본 하나에
// 웨이트 1.0. 결과는 이전과 픽셀 단위로 같으면서 형식만 스킨드 메시가 된다.
// (관절 근처 웨이트를 섞으면 부드럽게 접히게 확장할 수 있다)
import * as THREE from 'three';
import { buildRig } from './rig.js';
import { applyPose, phaseRate, isMoving } from './pose.js';
import { mergeParts, boxGeometry } from '../core/meshkit.js';

const SKIN = 0xc4906b;
const SHIRT = 0x33527f;
const PANTS = 0x3b3b44;
const SHOE = 0x1a1a1d;
const HAIR = 0x221914;
const EYE = 0x1b1b22;

function mat(color, roughness) {
  const m = new THREE.MeshStandardMaterial({ color, roughness, metalness: 0 });
  return m;
}

// [본 이름, 머티리얼 키, 폭, 높이, 깊이, 본 로컬 오프셋]
// 오프셋은 부모 본이 아니라 "붙는 본" 기준이다.
const PARTS = [
  ['Hips', 'pants', 0.34, 0.14, 0.21, [0, 0.02, 0]],
  ['Chest', 'shirt', 0.4, 0.52, 0.23, [0, -0.08, 0]],

  ['Head', 'skin', 0.23, 0.26, 0.22, [0, 0, 0]],
  ['Head', 'hair', 0.245, 0.12, 0.235, [0, 0.1, 0]],
  ['Head', 'hair', 0.245, 0.16, 0.06, [0, 0, -0.09]],
  ['Head', 'eye', 0.035, 0.045, 0.02, [-0.058, 0.01, 0.112]],
  ['Head', 'eye', 0.035, 0.045, 0.02, [0.058, 0.01, 0.112]],

  ['LeftUpperArm', 'shirt', 0.1, 0.3, 0.11, [0, -0.15, 0]],
  ['LeftLowerArm', 'skin', 0.088, 0.28, 0.095, [0, -0.14, 0]],
  ['LeftHand', 'skin', 0.1, 0.1, 0.1, [0, -0.03, 0]],
  ['RightUpperArm', 'shirt', 0.1, 0.3, 0.11, [0, -0.15, 0]],
  ['RightLowerArm', 'skin', 0.088, 0.28, 0.095, [0, -0.14, 0]],
  ['RightHand', 'skin', 0.1, 0.1, 0.1, [0, -0.03, 0]],

  ['LeftUpperLeg', 'pants', 0.135, 0.44, 0.145, [0, -0.22, 0]],
  ['LeftLowerLeg', 'pants', 0.115, 0.42, 0.125, [0, -0.21, 0]],
  ['LeftFoot', 'shoe', 0.13, 0.085, 0.25, [0, -0.04, 0.045]],
  ['RightUpperLeg', 'pants', 0.135, 0.44, 0.145, [0, -0.22, 0]],
  ['RightLowerLeg', 'pants', 0.115, 0.42, 0.125, [0, -0.21, 0]],
  ['RightFoot', 'shoe', 0.13, 0.085, 0.25, [0, -0.04, 0.045]],
];

export function createCharacter() {
  const rig = buildRig();

  const materials = {
    skin: mat(SKIN, 0.72),
    shirt: mat(SHIRT, 0.78),
    pants: mat(PANTS, 0.78),
    shoe: mat(SHOE, 0.62),
    hair: mat(HAIR, 0.85),
    eye: mat(EYE, 0.4),
  };
  Object.entries(materials).forEach(([k, m]) => (m.name = k));

  // 각 조각을 본 로컬 -> 바인드 공간(rest 포즈 월드)으로 옮긴다.
  // rig.root.updateMatrixWorld()가 이미 호출된 상태라 matrixWorld가 rest 포즈다.
  const parts = PARTS.map(([boneName, matKey, w, h, d, off]) => {
    const bone = rig.byName.get(boneName);
    const geo = boxGeometry(w, h, d, off);
    geo.applyMatrix4(bone.matrixWorld);
    geo.computeVertexNormals();
    return { geometry: geo, material: materials[matKey], boneIndex: rig.index(boneName) };
  });

  const { geometry, materials: matList } = mergeParts(parts, {
    extras: [
      {
        name: 'skinIndex',
        itemSize: 4,
        valueFor: (p) => [p.boneIndex, 0, 0, 0],
      },
      {
        name: 'skinWeight',
        itemSize: 4,
        valueFor: () => [1, 0, 0, 0], // 리지드: 본 하나에 전부
      },
    ],
  });

  const root = new THREE.Group();
  root.name = 'Character';
  root.add(rig.root);

  const mesh = new THREE.SkinnedMesh(geometry, matList);
  mesh.name = 'CharacterMesh';
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.frustumCulled = false; // 본으로 움직이면 정적 바운딩이 어긋난다
  root.add(mesh);

  const skeleton = new THREE.Skeleton(rig.bones);
  mesh.bind(skeleton);

  const state = { phase: 0 };

  function update(dt, speed, grounded) {
    const moving = isMoving(speed);
    state.phase += dt * phaseRate(speed, moving);
    applyPose(rig, { phase: state.phase, speed, grounded });
  }

  return {
    root,
    mesh,
    rig,
    skeleton,
    materials,
    update,
    eyeHeight: 1.62,
    get phase() {
      return state.phase;
    },
  };
}
