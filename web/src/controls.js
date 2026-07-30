// 입력 · 캐릭터 물리 · 두 가지 카메라 모드.
// PLAY: 3인칭 캐릭터 조작 (포인터 락 마우스룩)
// FLY : 언리얼 에디터식 프리 카메라 (우클릭 드래그로 시선, WASD 비행, Q/E 상하, 휠로 속도)
// 씬에 의존하지 않는다 — 바닥 높이 함수는 활성 씬이 넘겨준다.
import * as THREE from 'three';

const GRAVITY = 23.0;
const WALK = 3.3;
const SPRINT = 6.4;
const ACCEL = 22.0;
const FRICTION = 14.0;
const JUMP_V = 7.4;
const RADIUS = 0.32;
const STEP = 0.45; // 이 높이까지는 걸어 올라간다

export const MODE = { PLAY: 'play', FLY: 'fly' };

const EMPTY = new Set();

export function createInput(dom) {
  const keys = new Set();
  const state = {
    keys,
    dx: 0, // 이번 프레임 누적 마우스 이동
    dy: 0,
    wheel: 0,
    rmb: false,
    locked: false,
    toggleRequested: false,
  };

  const isTextTarget = (e) => e.target && /input|textarea/i.test(e.target.tagName || '');

  addEventListener('keydown', (e) => {
    if (isTextTarget(e)) return;
    if (e.code === 'F8' || e.code === 'KeyF') {
      state.toggleRequested = true;
      e.preventDefault();
      return;
    }
    if (e.code === 'Space') e.preventDefault();
    keys.add(e.code);
  });
  addEventListener('keyup', (e) => keys.delete(e.code));
  addEventListener('blur', () => keys.clear());

  dom.addEventListener('contextmenu', (e) => e.preventDefault());

  dom.addEventListener('mousedown', (e) => {
    if (e.button === 2) state.rmb = true;
    state.pressed = e.button;
    state.mousedown = true;
  });
  addEventListener('mouseup', (e) => {
    if (e.button === 2) state.rmb = false;
  });

  addEventListener('mousemove', (e) => {
    state.dx += e.movementX || 0;
    state.dy += e.movementY || 0;
  });

  dom.addEventListener('wheel', (e) => {
    state.wheel += Math.sign(e.deltaY);
    e.preventDefault();
  }, { passive: false });

  document.addEventListener('pointerlockchange', () => {
    state.locked = document.pointerLockElement === dom;
  });

  state.requestLock = () => {
    if (document.pointerLockElement !== dom) dom.requestPointerLock?.();
  };
  state.releaseLock = () => {
    if (document.pointerLockElement === dom) document.exitPointerLock?.();
  };
  state.consumeMouse = () => {
    const d = { dx: state.dx, dy: state.dy };
    state.dx = 0;
    state.dy = 0;
    return d;
  };
  state.consumeWheel = () => {
    const w = state.wheel;
    state.wheel = 0;
    return w;
  };

  return state;
}

// 원 vs AABB(XZ) 밀어내기
function resolveCollisions(pos, boxes) {
  for (const b of boxes) {
    if (pos.y > b.max.y) continue; // 지붕 위라면 통과
    const cx = Math.max(b.min.x, Math.min(pos.x, b.max.x));
    const cz = Math.max(b.min.z, Math.min(pos.z, b.max.z));
    const dx = pos.x - cx;
    const dz = pos.z - cz;
    const d2 = dx * dx + dz * dz;

    if (d2 > RADIUS * RADIUS) continue;

    if (d2 > 1e-8) {
      const d = Math.sqrt(d2);
      const push = RADIUS - d;
      pos.x += (dx / d) * push;
      pos.z += (dz / d) * push;
    } else {
      // 박스 안에 갇힌 경우 가장 얕은 면으로 뺀다
      const l = pos.x - b.min.x;
      const r = b.max.x - pos.x;
      const n = pos.z - b.min.z;
      const f = b.max.z - pos.z;
      const m = Math.min(l, r, n, f);
      if (m === l) pos.x = b.min.x - RADIUS;
      else if (m === r) pos.x = b.max.x + RADIUS;
      else if (m === n) pos.z = b.min.z - RADIUS;
      else pos.z = b.max.z + RADIUS;
    }
  }
}

// world.surfaceHeight(x, z) — 씬이 정하는 바닥 높이. 매 프레임 두 번 호출된다.
// world.boxes            — 밀어낼 AABB 목록
// world.spawn            — 시작 위치 [x, z]
export function createPlayer(character, camera, input, world) {
  const { surfaceHeight, boxes, spawn } = world;
  const pos = new THREE.Vector3(spawn[0], surfaceHeight(spawn[0], spawn[1]), spawn[1]);
  const vel = new THREE.Vector3();
  let grounded = true;
  let facing = Math.PI; // 캐릭터가 바라보는 각도

  // 스프링암 (yaw 0 = 카메라가 +Z 뒤쪽에서 캐릭터를 본다)
  const cam = { yaw: 0, pitch: 0.22, dist: 4.4 };
  const camPos = new THREE.Vector3();
  const lookAt = new THREE.Vector3();
  let initialised = false;

  const fwd = new THREE.Vector3();
  const right = new THREE.Vector3();
  const wish = new THREE.Vector3();
  const UP = new THREE.Vector3(0, 1, 0);

  // opts.input:false  → 키 입력 무시 (프리캠 중 캐릭터가 따라 움직이면 안 된다)
  // opts.camera:false → 카메라를 건드리지 않는다 (프리캠이 주인)
  function update(dt, opts = {}) {
    const accept = opts.input !== false;
    const drive = opts.camera !== false;
    const k = accept ? input.keys : EMPTY;

    // 마우스룩 (포인터 락이 잡혀 있을 때만)
    if (drive && input.locked) {
      const { dx, dy } = input.consumeMouse();
      cam.yaw -= dx * 0.0024;
      cam.pitch = THREE.MathUtils.clamp(cam.pitch + dy * 0.0021, -0.5, 1.15);
    } else if (drive) {
      input.consumeMouse();
    }
    if (drive) {
      const w = input.consumeWheel();
      if (w) cam.dist = THREE.MathUtils.clamp(cam.dist + w * 0.5, 1.8, 11);
    }

    // 카메라 yaw 기준 이동 방향
    fwd.set(-Math.sin(cam.yaw), 0, -Math.cos(cam.yaw));
    right.crossVectors(fwd, UP).normalize();

    wish.set(0, 0, 0);
    if (k.has('KeyW') || k.has('ArrowUp')) wish.add(fwd);
    if (k.has('KeyS') || k.has('ArrowDown')) wish.sub(fwd);
    if (k.has('KeyD') || k.has('ArrowRight')) wish.add(right);
    if (k.has('KeyA') || k.has('ArrowLeft')) wish.sub(right);

    const sprinting = k.has('ShiftLeft') || k.has('ShiftRight');
    const maxSpeed = sprinting ? SPRINT : WALK;

    if (wish.lengthSq() > 0) {
      wish.normalize().multiplyScalar(maxSpeed);
      vel.x += (wish.x - vel.x) * Math.min(1, ACCEL * dt);
      vel.z += (wish.z - vel.z) * Math.min(1, ACCEL * dt);
      facing = Math.atan2(wish.x, wish.z);
    } else {
      const damp = Math.min(1, FRICTION * dt);
      vel.x -= vel.x * damp;
      vel.z -= vel.z * damp;
    }

    if (grounded && k.has('Space')) {
      vel.y = JUMP_V;
      grounded = false;
    }
    vel.y -= GRAVITY * dt;

    pos.x += vel.x * dt;
    pos.z += vel.z * dt;
    resolveCollisions(pos, boxes);

    pos.y += vel.y * dt;
    const floor = surfaceHeight(pos.x, pos.z);
    if (pos.y <= floor + 0.001) {
      pos.y = floor;
      vel.y = 0;
      grounded = true;
    } else if (grounded && pos.y - floor < STEP && vel.y <= 0) {
      // 경계석 같은 낮은 단은 그냥 붙어서 올라간다
      pos.y = floor;
      vel.y = 0;
    } else {
      grounded = false;
    }

    // 캐릭터 자세
    character.root.position.copy(pos);
    let diff = facing - character.root.rotation.y;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    character.root.rotation.y += diff * Math.min(1, 14 * dt);

    const hSpeed = Math.hypot(vel.x, vel.z);
    character.update(dt, hSpeed, grounded);

    if (!drive) return { speed: hSpeed, grounded, sprinting };

    // 스프링암 카메라
    const cp = Math.cos(cam.pitch);
    camPos.set(
      pos.x + Math.sin(cam.yaw) * cp * cam.dist,
      pos.y + 1.5 + Math.sin(cam.pitch) * cam.dist,
      pos.z + Math.cos(cam.yaw) * cp * cam.dist
    );
    // 카메라가 땅을 파고들지 않게
    const camFloor = surfaceHeight(camPos.x, camPos.z) + 0.45;
    if (camPos.y < camFloor) camPos.y = camFloor;

    if (!initialised) {
      camera.position.copy(camPos);
      initialised = true;
    } else {
      camera.position.lerp(camPos, 1 - Math.exp(-16 * dt));
    }
    lookAt.set(pos.x, pos.y + 1.38, pos.z);
    camera.lookAt(lookAt);

    return { speed: hSpeed, grounded, sprinting };
  }

  return { update, pos, reset: () => { initialised = false; }, cam };
}

// 언리얼 에디터식 프리 카메라
export function createFlyCamera(camera, input) {
  const speeds = [0.6, 1.2, 2.5, 5, 9, 16, 28, 48]; // UE의 카메라 속도 단계 느낌
  let level = 3;
  let yaw = 0;
  let pitch = 0;
  const dir = new THREE.Vector3();
  const fwd = new THREE.Vector3();
  const right = new THREE.Vector3();
  const UP = new THREE.Vector3(0, 1, 0);
  const move = new THREE.Vector3();

  function syncFromCamera() {
    camera.getWorldDirection(dir);
    pitch = Math.asin(THREE.MathUtils.clamp(dir.y, -1, 1));
    yaw = Math.atan2(-dir.x, -dir.z);
  }

  function update(dt) {
    // 우클릭을 누르고 있는 동안만 시선이 돈다 (언리얼과 동일)
    if (input.rmb && input.locked) {
      const { dx, dy } = input.consumeMouse();
      yaw -= dx * 0.0026;
      pitch = THREE.MathUtils.clamp(pitch - dy * 0.0026, -1.5, 1.5);
    } else {
      input.consumeMouse();
    }

    const w = input.consumeWheel();
    if (w) level = THREE.MathUtils.clamp(level - w, 0, speeds.length - 1);

    const cp = Math.cos(pitch);
    fwd.set(-Math.sin(yaw) * cp, Math.sin(pitch), -Math.cos(yaw) * cp).normalize();
    right.crossVectors(fwd, UP).normalize();

    const k = input.keys;
    move.set(0, 0, 0);
    if (k.has('KeyW') || k.has('ArrowUp')) move.add(fwd);
    if (k.has('KeyS') || k.has('ArrowDown')) move.sub(fwd);
    if (k.has('KeyD') || k.has('ArrowRight')) move.add(right);
    if (k.has('KeyA') || k.has('ArrowLeft')) move.sub(right);
    if (k.has('KeyE')) move.y += 1;
    if (k.has('KeyQ')) move.y -= 1;

    let sp = speeds[level];
    if (k.has('ShiftLeft') || k.has('ShiftRight')) sp *= 4;
    if (k.has('ControlLeft')) sp *= 0.25;

    if (move.lengthSq() > 0) {
      move.normalize().multiplyScalar(sp * dt);
      camera.position.add(move);
    }

    camera.quaternion.setFromEuler(new THREE.Euler(pitch, yaw, 0, 'YXZ'));
    return { speedLevel: level + 1, speed: sp };
  }

  return { update, syncFromCamera };
}

// 충돌 박스 수집: 집과 담장만. 전선/전신주는 AABB가 과하게 커서 제외한다.
export function collectColliders(groups) {
  const boxes = [];
  for (const g of groups) {
    if (!g) continue;
    for (const child of g.children) {
      const b = new THREE.Box3().setFromObject(child);
      if (Number.isFinite(b.min.x) && b.max.x - b.min.x < 60) boxes.push(b);
    }
  }
  return boxes;
}
