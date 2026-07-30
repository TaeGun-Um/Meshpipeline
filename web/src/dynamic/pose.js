// 포즈 계산. 실시간 재생과 클립 굽기가 이 함수 하나를 공유한다.
// 따로 구현하면 구운 클립이 브라우저에서 보던 동작과 어긋나기 때문이다.
import { BONES } from './rig.js';

const HIPS_REST_Y = BONES.find((b) => b.name === 'Hips').offset[1];

// 보행 위상 진행 속도(rad/s). 빠를수록 케이던스가 올라간다.
export function phaseRate(speed, moving) {
  return moving ? 2.1 + speed * 1.35 : 1.6;
}

export function isMoving(speed) {
  return speed > 0.2;
}

// rig의 본 회전/위치를 주어진 상태에 맞게 설정한다.
export function applyPose(rig, { phase, speed = 0, grounded = true }) {
  const B = rig.byName;
  const hips = B.get('Hips');
  const spine = B.get('Spine');
  const head = B.get('Head');
  const lUpArm = B.get('LeftUpperArm');
  const rUpArm = B.get('RightUpperArm');
  const lLoArm = B.get('LeftLowerArm');
  const rLoArm = B.get('RightLowerArm');
  const lUpLeg = B.get('LeftUpperLeg');
  const rUpLeg = B.get('RightUpperLeg');
  const lLoLeg = B.get('LeftLowerLeg');
  const rLoLeg = B.get('RightLowerLeg');

  const p = phase;
  hips.position.y = HIPS_REST_Y;

  if (!grounded) {
    // 공중: 다리 접고 팔 올림
    lUpLeg.rotation.x = -0.55;
    rUpLeg.rotation.x = 0.3;
    lLoLeg.rotation.x = -0.9;
    rLoLeg.rotation.x = -0.35;
    lUpArm.rotation.set(-1.5, 0, 0.35);
    rUpArm.rotation.set(-1.3, 0, -0.35);
    lLoArm.rotation.x = -0.5;
    rLoArm.rotation.x = -0.6;
    spine.rotation.set(0.1, 0, 0);
    hips.rotation.set(0, 0, 0);
    head.rotation.set(0, 0, 0);
    return;
  }

  if (isMoving(speed)) {
    const amp = Math.min(0.62, 0.26 + speed * 0.075);
    const s = Math.sin(p);
    const c = Math.sin(p + Math.PI);

    lUpLeg.rotation.x = s * amp;
    rUpLeg.rotation.x = c * amp;
    // 무릎은 뒤로만 접힌다
    lLoLeg.rotation.x = -Math.max(0, Math.sin(p + 2.5)) * amp * 1.5;
    rLoLeg.rotation.x = -Math.max(0, Math.sin(p + 2.5 + Math.PI)) * amp * 1.5;

    lUpArm.rotation.set(c * amp * 0.85, 0, 0.06);
    rUpArm.rotation.set(s * amp * 0.85, 0, -0.06);
    lLoArm.rotation.x = -Math.max(0, c) * amp * 0.7 - 0.12;
    rLoArm.rotation.x = -Math.max(0, s) * amp * 0.7 - 0.12;

    // 보행 진동·좌우 흔들림·전방 기울기
    hips.position.y = HIPS_REST_Y + Math.abs(s) * 0.035 - 0.015;
    hips.rotation.set(0, 0, s * 0.028);
    spine.rotation.set(Math.min(0.1, speed * 0.014), 0, 0);
    head.rotation.set(0, 0, -s * 0.03);
    return;
  }

  // 대기: 호흡만
  const b = Math.sin(p * 0.9);
  lUpLeg.rotation.x = 0.02;
  rUpLeg.rotation.x = -0.02;
  lLoLeg.rotation.x = -0.04;
  rLoLeg.rotation.x = -0.04;
  lUpArm.rotation.set(0.04 + b * 0.02, 0, 0.075);
  rUpArm.rotation.set(0.04 - b * 0.02, 0, -0.075);
  lLoArm.rotation.x = -0.16;
  rLoArm.rotation.x = -0.16;
  hips.position.y = HIPS_REST_Y + b * 0.008;
  hips.rotation.set(0, 0, 0);
  spine.rotation.set(0, 0, 0);
  head.rotation.set(0, 0, 0);
}
