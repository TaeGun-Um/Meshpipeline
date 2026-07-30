// 절차적 포즈를 AnimationClip으로 굽는다.
//
// 브라우저는 매 프레임 sin을 계산하면 되지만, glTF로 내보내려면 키프레임이
// 있어야 한다. pose.js의 같은 함수를 시간축으로 샘플링하므로 구운 클립은
// 실시간 동작과 정의상 일치한다.
//
// 클립 길이는 위상 속도에서 나온다: duration = 2π / phaseRate(speed)
//   walk 3.3m/s -> 6.555 rad/s -> 0.958초
//   run  6.4m/s -> 10.74 rad/s -> 0.585초
import * as THREE from 'three';
import { ANIMATED } from './rig.js';
import { applyPose, phaseRate } from './pose.js';

const FPS = 30;
const TWO_PI = Math.PI * 2;

function bake(rig, name, duration, sample) {
  const frames = Math.max(1, Math.round(duration * FPS));
  const times = new Float32Array(frames + 1);
  const quats = new Map();
  const hipsPos = new Float32Array((frames + 1) * 3);

  for (const bn of ANIMATED) quats.set(bn, new Float32Array((frames + 1) * 4));

  // f=frames 는 f=0과 같은 위상이 되도록 잡아서 루프 이음선이 없게 한다
  for (let f = 0; f <= frames; f++) {
    const u = f / frames;
    times[f] = u * duration;

    rig.reset();
    sample(u);

    for (const bn of ANIMATED) {
      const q = rig.byName.get(bn).quaternion;
      const a = quats.get(bn);
      a[f * 4] = q.x;
      a[f * 4 + 1] = q.y;
      a[f * 4 + 2] = q.z;
      a[f * 4 + 3] = q.w;
    }
    const hp = rig.byName.get('Hips').position;
    hipsPos[f * 3] = hp.x;
    hipsPos[f * 3 + 1] = hp.y;
    hipsPos[f * 3 + 2] = hp.z;
  }

  const tracks = ANIMATED.map(
    (bn) => new THREE.QuaternionKeyframeTrack(`${bn}.quaternion`, times, quats.get(bn))
  );
  tracks.push(new THREE.VectorKeyframeTrack('Hips.position', times, hipsPos));

  return new THREE.AnimationClip(name, duration, tracks);
}

export function bakeClips(rig, { walkSpeed = 3.3, runSpeed = 6.4 } = {}) {
  const clips = [
    bake(rig, 'Walk', TWO_PI / phaseRate(walkSpeed, true), (u) =>
      applyPose(rig, { phase: u * TWO_PI, speed: walkSpeed, grounded: true })
    ),
    bake(rig, 'Run', TWO_PI / phaseRate(runSpeed, true), (u) =>
      applyPose(rig, { phase: u * TWO_PI, speed: runSpeed, grounded: true })
    ),
    // 대기는 호흡항이 phase*0.9 이므로 위상을 2π/0.9 만큼 돌려야 한 주기가 된다
    bake(rig, 'Idle', TWO_PI / (phaseRate(0, false) * 0.9), (u) =>
      applyPose(rig, { phase: (u * TWO_PI) / 0.9, speed: 0, grounded: true })
    ),
    bake(rig, 'Air', 0.5, () =>
      applyPose(rig, { phase: 0, speed: 0, grounded: false })
    ),
  ];

  rig.reset(); // 실시간 재생이 rest에서 시작하도록 되돌린다
  return clips;
}
