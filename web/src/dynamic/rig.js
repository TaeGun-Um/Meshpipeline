// 본 계층 정의. 이름은 Unity 휴머노이드 관례를 따른다.
// 블렌더 경유 FBX로 넣을 때 Unity 아바타 매퍼가 자동으로 잡아주기 때문이다.
//
// offset은 부모 본 기준 로컬 위치(미터).
// 검산: Hips 0.92 -> Spine 1.08 -> Chest 1.28 -> UpperArm 1.44(어깨 높이)
//                                          -> Neck 1.50 -> Head 1.60
import * as THREE from 'three';

export const BONES = [
  { name: 'Hips', parent: null, offset: [0, 0.92, 0] },
  { name: 'Spine', parent: 'Hips', offset: [0, 0.16, 0] },
  { name: 'Chest', parent: 'Spine', offset: [0, 0.2, 0] },
  { name: 'Neck', parent: 'Chest', offset: [0, 0.22, 0] },
  { name: 'Head', parent: 'Neck', offset: [0, 0.1, 0] },

  { name: 'LeftUpperArm', parent: 'Chest', offset: [-0.235, 0.16, 0] },
  { name: 'LeftLowerArm', parent: 'LeftUpperArm', offset: [0, -0.3, 0] },
  { name: 'LeftHand', parent: 'LeftLowerArm', offset: [0, -0.28, 0] },

  { name: 'RightUpperArm', parent: 'Chest', offset: [0.235, 0.16, 0] },
  { name: 'RightLowerArm', parent: 'RightUpperArm', offset: [0, -0.3, 0] },
  { name: 'RightHand', parent: 'RightLowerArm', offset: [0, -0.28, 0] },

  { name: 'LeftUpperLeg', parent: 'Hips', offset: [-0.11, 0, 0] },
  { name: 'LeftLowerLeg', parent: 'LeftUpperLeg', offset: [0, -0.44, 0] },
  { name: 'LeftFoot', parent: 'LeftLowerLeg', offset: [0, -0.42, 0] },

  { name: 'RightUpperLeg', parent: 'Hips', offset: [0.11, 0, 0] },
  { name: 'RightLowerLeg', parent: 'RightUpperLeg', offset: [0, -0.44, 0] },
  { name: 'RightFoot', parent: 'RightLowerLeg', offset: [0, -0.42, 0] },
];

// 애니메이션으로 실제로 움직이는 본만 트랙을 굽는다 (클립 크기 절약)
export const ANIMATED = [
  'Hips', 'Spine', 'Head',
  'LeftUpperArm', 'LeftLowerArm', 'RightUpperArm', 'RightLowerArm',
  'LeftUpperLeg', 'LeftLowerLeg', 'RightUpperLeg', 'RightLowerLeg',
];

// 본 계층을 만들고 rest 포즈의 월드 행렬까지 계산해서 돌려준다.
// 스킨 웨이트를 붙일 때 이 행렬로 각 조각을 바인드 공간으로 옮긴다.
export function buildRig() {
  const byName = new Map();
  const bones = [];

  for (const def of BONES) {
    const b = new THREE.Bone();
    b.name = def.name;
    b.position.set(def.offset[0], def.offset[1], def.offset[2]);
    byName.set(def.name, b);
    bones.push(b);
  }

  let root = null;
  for (const def of BONES) {
    const b = byName.get(def.name);
    if (def.parent === null) root = b;
    else byName.get(def.parent).add(b);
  }

  root.updateMatrixWorld(true);

  return {
    bones,
    byName,
    root,
    index: (name) => bones.indexOf(byName.get(name)),
    // rest 포즈로 되돌린다 (클립을 구울 때 프레임마다 초기화용)
    reset() {
      for (const def of BONES) {
        const b = byName.get(def.name);
        b.position.set(def.offset[0], def.offset[1], def.offset[2]);
        b.rotation.set(0, 0, 0);
        b.scale.set(1, 1, 1);
      }
    },
  };
}
