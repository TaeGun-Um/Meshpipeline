// 머리카락 본 체인과 스프링.
//
// ── 왜 필요한가 ────────────────────────────────────────────────────────────
// 연동 시험에서 머리카락을 머리뼈에 **통째로 강체 부착**했다. 붙기는 붙고
// 따라도 오는데, 바닥까지 오는 땋은 머리가 고개를 돌릴 때 통째로 휙 돈다.
// 실제 아바타가 살아 보이는 것의 절반이 이 지연(lag)에서 온다.
//
// ── 어떻게 ─────────────────────────────────────────────────────────────────
// 가닥 하나에 본 체인 하나를 심고, 정점을 경로 위치에 따라 두 본에 나눠 물린다.
// 매 프레임 각 본은 (1) 이전 프레임의 속도를 관성으로 이어받고 (2) 원래
// 방향으로 돌아가려 하고 (3) 중력을 받는다. VRM 스프링본과 같은 식이다.
//
// ── 왜 UV 로 스키닝하나 ────────────────────────────────────────────────────
// `sweep()` 이 만든 UV 는 v 가 **경로를 따라간다** (0 뿌리 ~ 1 끝).
// 즉 정점이 사슬의 어디쯤인지가 이미 적혀 있다. 좌표로 다시 찾으면 그 값을
// 두 곳에서 계산하는 셈이고, 굵기를 바꾸는 순간 어긋난다.
import * as THREE from 'three';

// 경로 위에 본 사슬을 만든다. 첫 본은 parent 의 로컬 좌표로 앉는다.
export function boneChain(points, parent, name = 'Hair') {
  const bones = [];
  parent.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(parent.matrixWorld).invert();
  for (let i = 0; i < points.length; i++) {
    const b = new THREE.Bone();
    b.name = `${name}_${i}`;
    if (i === 0) {
      b.position.copy(points[0]).applyMatrix4(inv);
      parent.add(b);
    } else {
      // 부모가 아직 안 돌아간 상태(rest)라 월드 차이가 곧 로컬 위치다
      b.position.copy(points[i]).sub(points[i - 1]);
      bones[i - 1].add(b);
    }
    bones.push(b);
  }
  parent.updateMatrixWorld(true);
  return bones;
}

// uv.v 를 그대로 본 인덱스로 쓴다.
export function skinByV(geo, boneCount) {
  const uv = geo.attributes.uv;
  const n = uv.count;
  const si = new Uint16Array(n * 4);
  const sw = new Float32Array(n * 4);
  for (let i = 0; i < n; i++) {
    const f = Math.min(0.99999, Math.max(0, uv.getY(i))) * (boneCount - 1);
    const i0 = Math.floor(f);
    const w = f - i0;
    si[i * 4] = i0;
    si[i * 4 + 1] = Math.min(i0 + 1, boneCount - 1);
    sw[i * 4] = 1 - w;
    sw[i * 4 + 1] = w;
  }
  geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4));
  geo.setAttribute('skinWeight', new THREE.Float32BufferAttribute(sw, 4));
  return geo;
}

// ── 스프링 ─────────────────────────────────────────────────────────────────
//
//   stiffness  원래 방향으로 돌아가려는 힘. 0 이면 축 늘어진 밧줄
//   drag       속도 감쇠. 낮으면 영원히 흔들린다
//   gravity    m/s². 땋은 머리는 무거우므로 세게
//
// 굵고 무거운 땋은 머리와 가벼운 앞머리는 값이 달라야 한다 — 같은 값을 쓰면
// 하나는 뻣뻣하고 하나는 물결친다.
// 갱신마다 새로 만들면 프레임당 수백 개가 쓰레기가 된다 — 모듈에 한 벌만 둔다
const PQ = new THREE.Quaternion();
const PQI = new THREE.Quaternion();
const DQ = new THREE.Quaternion();
const WPOS = new THREE.Vector3();
const REST = new THREE.Vector3();
const NEXT = new THREE.Vector3();
const VEL = new THREE.Vector3();
const TO = new THREE.Vector3();
const DOWN = new THREE.Vector3(0, -1, 0);

export class SpringChain {
  constructor(bones, { stiffness = 0.55, drag = 0.2, gravity = 0.35, substeps = 3 } = {}) {
    this.bones = bones;
    this.stiffness = stiffness;
    this.drag = drag;
    this.gravity = gravity;
    this.substeps = substeps;

    this.joints = [];
    for (let i = 0; i < bones.length - 1; i++) {
      const b = bones[i];
      const child = bones[i + 1];
      const len = child.position.length();
      if (len < 1e-6) continue;
      b.updateMatrixWorld(true);
      const tail = new THREE.Vector3().setFromMatrixPosition(child.matrixWorld);
      this.joints.push({
        bone: b,
        axis: child.position.clone().normalize(), // 뼈 로컬 기준 자식 방향
        rest: b.quaternion.clone(),
        len,
        prev: tail.clone(),
        curr: tail.clone(),
      });
    }
  }

  // 흔들린 것을 원위치로. 스크린샷 기준선이 흔들린 상태로 찍히면 안 된다.
  reset() {
    for (const j of this.joints) {
      j.bone.quaternion.copy(j.rest);
    }
    this.bones[0].updateMatrixWorld(true);
    for (const j of this.joints) {
      const child = j.bone.children.find((c) => c.isBone);
      if (child) {
        child.updateMatrixWorld(true);
        j.curr.setFromMatrixPosition(child.matrixWorld);
        j.prev.copy(j.curr);
      }
    }
  }

  update(dt) {
    if (!(dt > 0)) return; // dt=0 (스크린샷 하네스) 에서는 안 움직인다
    // 서브스텝. 명시적 적분이라 한 걸음이 크면 사슬이 채찍처럼 튄다 —
    // 1.4m 짜리 땋은 머리 끝이 0.95m 를 튀어나갔다. 걸음을 잘게 나누면
    // 같은 파라미터로도 발산이 사라진다. 값이 싸다 (마디 14개 x 2).
    const n = this.substeps;
    const h = Math.min(dt, 1 / 30) / n;
    for (let k = 0; k < n; k++) this.#step(h);
  }

  #step(step) {
    for (const j of this.joints) {
      const b = j.bone;
      // 부모까지의 월드 행렬을 먼저 최신화한다 (뿌리에서 끝으로 순서대로 돈다)
      b.parent.updateMatrixWorld(true);
      b.parent.getWorldQuaternion(PQ);
      PQI.copy(PQ).invert();
      WPOS.setFromMatrixPosition(b.matrixWorld);

      // 원래 방향 = 부모 회전 × 쉬는 자세 × 자식 축
      REST.copy(j.axis).applyQuaternion(j.rest).applyQuaternion(PQ).normalize();

      // 관성 + 복원 + 중력 (전부 꼬리의 월드 변위로 더한다)
      VEL.copy(j.curr).sub(j.prev).multiplyScalar(1 - this.drag);
      NEXT.copy(j.curr)
        .add(VEL)
        .addScaledVector(REST, this.stiffness * step)
        .addScaledVector(DOWN, this.gravity * step);

      // 길이 구속 — 없으면 머리카락이 늘어난다
      NEXT.sub(WPOS).normalize().multiplyScalar(j.len).add(WPOS);

      j.prev.copy(j.curr);
      j.curr.copy(NEXT);

      // 월드에서의 회전 차이를 부모 로컬로 옮겨 뼈에 넣는다.
      //   worldNew = dq * (parent * rest)   ->   local = parent⁻¹ · dq · parent · rest
      TO.copy(NEXT).sub(WPOS).normalize();
      DQ.setFromUnitVectors(REST, TO);
      b.quaternion.copy(PQI).multiply(DQ).multiply(PQ).multiply(j.rest);
      b.updateMatrixWorld(true);
    }
  }
}
