import * as THREE from 'three';
import { makeRandom } from './core/rng.js';
import * as TEX from './core/textures.js';
import * as W from './static/index.js';
import { createCharacter } from './dynamic/character.js';
import { bakeClips } from './dynamic/clips.js';
import { MODE, createInput, createPlayer, createFlyCamera, collectColliders } from './controls.js';
import { exportGLB, bakeInstances } from './export/gltf.js';

const SEED = 20260730;

const boot = document.getElementById('boot');
const bar = boot.querySelector('.bar i');
const stepEl = boot.querySelector('.step');
const statsEl = document.querySelector('#hud .stats');
const modeEl = document.getElementById('mode');
const hintEl = document.getElementById('hint');
const lockEl = document.getElementById('lockhint');

const yieldFrame = () => new Promise((r) => setTimeout(r, 0));
async function step(label, pct, fn) {
  stepEl.textContent = `BAKE: ${label}`;
  bar.style.width = `${pct}%`;
  await yieldFrame();
  return fn();
}

const scene = new THREE.Scene();

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.06;
document.body.appendChild(renderer.domElement);

const camera = new THREE.PerspectiveCamera(58, innerWidth / innerHeight, 0.1, 900);
camera.position.set(0, 2.0, 17);

const input = createInput(renderer.domElement);

let mode = MODE.PLAY;
let player = null;
let flycam = null;
let weeds = null;
let charClips = []; // 캐릭터 애니메이션 클립 (익스포트에 함께 실린다)
const built = {}; // 익스포트 점검용으로 주요 오브젝트를 붙들어 둔다

const HINTS = {
  [MODE.PLAY]:
    'WASD 이동 · Shift 달리기 · Space 점프 · 마우스 시점 · 휠 거리 &nbsp;|&nbsp; <b>F</b> 프리캠',
  [MODE.FLY]:
    '<b>우클릭 드래그</b> 시선 · WASD 비행 · Q/E 하강·상승 · 휠 속도 · Shift 부스트 &nbsp;|&nbsp; <b>F</b> 복귀',
};

function setMode(next) {
  mode = next;
  hintEl.innerHTML = HINTS[mode];
  if (mode === MODE.FLY) {
    input.releaseLock();
    flycam.syncFromCamera();
  } else {
    player.reset();
  }
}

async function build() {
  const t0 = performance.now();
  const rng = makeRandom(SEED);
  TEX.setAnisotropy(renderer.capabilities.getMaxAnisotropy());

  await step('하늘 · 광원', 5, () => {
    const dome = W.createSky(scene);
    W.createLights(scene);
    const pmrem = new THREE.PMREMGenerator(renderer);
    const envScene = new THREE.Scene();
    envScene.add(dome.clone());
    scene.environment = pmrem.fromScene(envScene, 0, 1, 1000).texture;
    pmrem.dispose();
  });

  const mats = await step('공용 재질', 16, () => W.buildMaterials(rng));
  built.ground = await step('지형 (흙 · 자갈)', 34, () => W.createGround(scene));
  built.road = await step('도로 · 경계석', 46, () => W.createRoad(scene));
  const walls = await step('담장', 54, () => W.createWalls(scene, mats));
  const houses = await step('주택 9채', 68, () => W.createHouses(scene, rng, mats));
  built.poles = await step('전신주 · 전선', 76, () => W.createPoles(scene, mats));
  weeds = await step('잡초', 88, () => W.createWeeds(scene, rng));
  built.props = await step('소품', 94, () => W.createProps(scene, rng, mats));
  built.walls = walls;
  built.houses = houses;
  built.weeds = weeds.mesh;

  const character = await step('캐릭터 · 스켈레톤 · 클립', 99, () => {
    const c = createCharacter();
    scene.add(c.root);
    built.character = c.root;
    // 절차적 포즈를 키프레임으로 구워둔다 (익스포트 시 함께 내보낸다)
    charClips = bakeClips(c.rig);
    const boxes = collectColliders([houses, walls]);
    player = createPlayer(c, camera, input, boxes, [0, 12.6]);
    flycam = createFlyCamera(camera, input);
    return { c, boxes };
  });

  bar.style.width = '100%';
  stepEl.textContent = 'BAKE: 완료';
  await yieldFrame();

  const buildMs = performance.now() - t0;
  renderer.render(scene, camera);
  const tris = renderer.info.render.triangles;

  statsEl.innerHTML = [
    `생성 ${buildMs.toFixed(0)}ms`,
    `삼각형 ${tris.toLocaleString('ko-KR')}`,
    `잡초 ${weeds.count.toLocaleString('ko-KR')}포기`,
    `텍스처 ${TEX.textureStats.count}장`,
    `충돌체 ${character.boxes.length}개`,
    `외부 애셋 0개 · seed ${SEED}`,
  ].join(' · ');

  setMode(MODE.PLAY);
  boot.classList.add('done');
  setTimeout(() => boot.remove(), 600);

  window.__stats = { buildMs, tris, weeds: weeds.count, colliders: character.boxes.length };
  window.__ready = true;
}

// ── 루프 ───────────────────────────────────────────────────────────────────

const clock = new THREE.Clock();

function frame() {
  const dt = Math.min(clock.getDelta(), 0.05);
  const t = clock.getElapsedTime();

  if (input.toggleRequested) {
    input.toggleRequested = false;
    setMode(mode === MODE.PLAY ? MODE.FLY : MODE.PLAY);
  }

  if (weeds?.mat.userData.shader) {
    weeds.mat.userData.shader.uniforms.uTime.value = t;
  }

  if (mode === MODE.PLAY) {
    const s = player.update(dt);
    modeEl.innerHTML = `<b>PLAY</b> · 3인칭 &nbsp; ${s.speed.toFixed(1)} m/s${
      s.sprinting ? ' <span class="hot">달리기</span>' : ''
    }${s.grounded ? '' : ' <span class="hot">공중</span>'}`;
    lockEl.style.opacity = input.locked ? '0' : '1';
  } else {
    player.update(dt, { input: false, camera: false }); // 캐릭터는 대기 동작만
    const f = flycam.update(dt);
    modeEl.innerHTML = `<b>FLY</b> · 프리 카메라 &nbsp; 속도 ${f.speedLevel}/8 (${f.speed.toFixed(1)} m/s)`;
    lockEl.style.opacity = '0';
  }

  renderer.render(scene, camera);
}

// 포인터 락: PLAY는 클릭으로, FLY는 우클릭을 누르는 동안만 (언리얼과 동일)
renderer.domElement.addEventListener('mousedown', (e) => {
  if (mode === MODE.PLAY) input.requestLock();
  else if (e.button === 2) input.requestLock();
});
addEventListener('mouseup', (e) => {
  if (mode === MODE.FLY && e.button === 2) input.releaseLock();
});

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

// ── 결정론적 스크린샷 하네스 ───────────────────────────────────────────────

window.__renderOnce = frame;
window.__three = { scene, camera, renderer };

window.__shot = async ({
  name = 'latest',
  w = 1280,
  h = 720,
  pos = null,
  target = null,
  time = 0,
} = {}) => {
  const keepW = renderer.domElement.width;
  const keepH = renderer.domElement.height;
  const keepPR = renderer.getPixelRatio();
  const keepPos = camera.position.clone();
  const keepQuat = camera.quaternion.clone();

  if (weeds?.mat.userData.shader) weeds.mat.userData.shader.uniforms.uTime.value = time;

  renderer.setPixelRatio(1);
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  if (pos) camera.position.set(pos[0], pos[1], pos[2]);
  if (target) camera.lookAt(target[0], target[1], target[2]);
  camera.updateProjectionMatrix();
  renderer.render(scene, camera);

  const gl = renderer.getContext();
  const px = new Uint8Array(w * h * 4);
  gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, px);

  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  const ctx = cv.getContext('2d');
  const img = ctx.createImageData(w, h);
  for (let y = 0; y < h; y++) {
    const src = (h - 1 - y) * w * 4;
    img.data.set(px.subarray(src, src + w * 4), y * w * 4);
  }
  ctx.putImageData(img, 0, 0);

  const res = await fetch(`/shot?name=${encodeURIComponent(name)}`, {
    method: 'POST',
    headers: { 'content-type': 'text/plain' },
    body: cv.toDataURL('image/png'),
  });
  const file = await res.text();

  renderer.setPixelRatio(keepPR);
  renderer.setSize(keepW, keepH, false);
  camera.aspect = keepW / keepH;
  camera.position.copy(keepPos);
  camera.quaternion.copy(keepQuat);
  camera.updateProjectionMatrix();

  return file;
};

// 조작 검증용 — 입력을 코드로 밀어넣고 몇 프레임 시뮬레이션한다
window.__sim = (codes, frames = 60, dt = 1 / 60) => {
  for (const c of codes) input.keys.add(c);
  for (let i = 0; i < frames; i++) {
    if (mode === MODE.PLAY) player.update(dt);
    else flycam.update(dt);
  }
  for (const c of codes) input.keys.delete(c);
  return {
    player: player.pos.toArray().map((v) => +v.toFixed(3)),
    camera: camera.position.toArray().map((v) => +v.toFixed(3)),
  };
};
window.__setMode = (m) => setMode(m);
window.__world = built;

// 블렌더 연결 점검용: 지정한 오브젝트를 .glb로 뽑는다.
// bake:true 면 InstancedMesh를 실제 정점으로 구워서 내보낸다.
window.__export = async (key, { bake = false, limit = Infinity, name } = {}) => {
  let target = built[key];
  if (!target) throw new Error(`unknown object: ${key}`);
  if (bake) target = bakeInstances(target, limit);
  const file = name || `${key}${bake ? '_baked' : ''}.glb`;
  // 캐릭터는 스킨 + 애니메이션 클립을 함께 싣는다
  const animations = key === 'character' ? charClips : [];
  const t0 = performance.now();
  const r = await exportGLB(target, file, { animations });
  return { ...r, ms: +(performance.now() - t0).toFixed(0) };
};

build()
  .then(() => renderer.setAnimationLoop(frame))
  .catch((err) => {
    console.error(err);
    stepEl.textContent = `실패: ${err.message}`;
    window.__error = String(err && err.stack ? err.stack : err);
  });
