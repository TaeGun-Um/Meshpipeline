// 오케스트레이션 — 렌더러·카메라·입력·모드 전환·검증 하네스.
// "어떤 장소인가" 는 전부 활성 씬이 정한다 (scenes/index.js 의 계약 참고).
import * as THREE from 'three';
import { makeRandom } from './core/rng.js';
import { auditScene } from './core/audit.js';
import * as TEX from './core/textures.js';
import { activeScene } from './scenes/index.js';
import { createCharacter } from './dynamic/character.js';
import { bakeClips } from './dynamic/clips.js';
import { MODE, createInput, createPlayer, createFlyCamera } from './controls.js';
import { exportGLB, bakeInstances } from './export/gltf.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { sceneResetList } from './core/scenestate.js';
import { mountSceneMenu } from './scenemenu.js';

const SCENE = activeScene();
const SEED = SCENE.meta.seed;

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
renderer.shadowMap.enabled = SCENE.meta.render.shadows;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = SCENE.meta.render.exposure;
document.body.appendChild(renderer.domElement);

// 씬 전환 메뉴. **빌드 전에** 단다 — 25초짜리 빌드 도중에도 다른 씬으로
// 갈아탈 수 있어야 한다 (src/scenemenu.js).
mountSceneMenu(SCENE.meta.id);

// 씬 이름이 나오는 곳 셋 — 탭 제목 · 로딩 화면 · 좌측 하단 HUD.
// index.html 에 1번 씬 이름('주택가 공터')이 박혀 있어서 어느 씬을 띄워도
// 셋 다 공터라고 적혀 있었다. **씬 이름의 출처는 `meta.name` 하나다.**
document.title = SCENE.meta.name;
boot.querySelector('.title').textContent = SCENE.meta.name;
document.querySelector('#hud h1').textContent = SCENE.meta.name;

const lens = SCENE.meta.lens;
const camera = new THREE.PerspectiveCamera(lens.fov, innerWidth / innerHeight, lens.near, lens.far);
camera.position.set(...SCENE.meta.camera.pos);
// target 은 프리캠 전용 씬에서 시작 시선을 정한다. 3인칭 씬은 첫 프레임에
// 스프링암이 카메라를 덮어쓰므로 있으나 없으나 같다.
if (SCENE.meta.camera.target) camera.lookAt(...SCENE.meta.camera.target);

// ── 후처리 ─────────────────────────────────────────────────────────────────
//
// 씬이 meta.post.bloom 을 선언하면 EffectComposer 경로로 그린다.
//   씬(HDR 렌더타깃) → 블룸 → OutputPass(ACES 톤매핑 + sRGB) → 캔버스
//
// 이 순서가 중요하다. three 는 렌더 타깃에 그릴 때 머티리얼 셰이더의 톤매핑을
// 건너뛰고 OutputPass 에서 한 번만 적용한다. 그래서 블룸은 톤매핑 전 HDR 값을
// 보게 되고, 밝은 발광면만 골라 번지게 된다. 톤매핑 후에 블룸을 걸면 이미 눌린
// 값을 번지게 해서 네온이 흐릿한 회색으로 뜬다.
//
// HalfFloat + samples:4 로 타깃을 직접 만드는 이유: 기본 캔버스의 MSAA는
// 렌더 타깃에 그리는 순간 적용되지 않으므로, 타깃 쪽에 샘플 수를 줘야 계단이 안 진다.
const bloomCfg = SCENE.meta.post?.bloom || null;
let composer = null;

if (bloomCfg) {
  const target = new THREE.WebGLRenderTarget(innerWidth, innerHeight, {
    type: THREE.HalfFloatType,
    samples: 4,
  });
  composer = new EffectComposer(renderer, target);
  composer.setPixelRatio(renderer.getPixelRatio());
  composer.addPass(new RenderPass(scene, camera));
  composer.addPass(
    new UnrealBloomPass(
      new THREE.Vector2(innerWidth, innerHeight),
      bloomCfg.strength,
      bloomCfg.radius,
      bloomCfg.threshold
    )
  );
  composer.addPass(new OutputPass());
}

// 후처리가 있으면 컴포저로, 없으면 곧바로 캔버스에 그린다.
function draw() {
  if (composer) composer.render();
  else renderer.render(scene, camera);
}

const input = createInput(renderer.domElement);

// 씬이 meta.player:false 를 선언하면 캐릭터도 3인칭 조작도 만들지 않고
// 프리 카메라 하나로만 돌아간다. 도시처럼 "걸어다니는 것"이 목적이 아닌 씬에서는
// 캐릭터가 스케일 기준으로도 쓸모가 없고, 물리·충돌체를 유지할 이유도 없다.
const HAS_PLAYER = SCENE.meta.player !== false;

let mode = HAS_PLAYER ? MODE.PLAY : MODE.FLY;
let player = null;
let flycam = null;
let world = null; // 활성 씬이 build()에서 돌려준 것 (built · tick · stats)
let hero = null; // 캐릭터 (하네스가 포즈를 고정하려면 필요하다). player 없으면 null
let charClips = []; // 캐릭터 애니메이션 클립 (익스포트에 함께 실린다)
const built = {}; // 익스포트 점검용으로 주요 오브젝트를 붙들어 둔다

const HINTS = {
  [MODE.PLAY]:
    'WASD 이동 · Shift 달리기 · Space 점프 · 마우스 시점 · 휠 거리 &nbsp;|&nbsp; <b>F</b> 프리캠',
  [MODE.FLY]: HAS_PLAYER
    ? '<b>우클릭 드래그</b> 시선 · WASD 비행 · Q/E 하강·상승 · 휠 속도 · Shift 부스트 &nbsp;|&nbsp; <b>F</b> 복귀'
    : '<b>우클릭 드래그</b> 시선 · WASD 비행 · Q/E 하강·상승 · 휠 속도 · Shift 부스트 · Ctrl 미세이동',
};

function setMode(next) {
  // 플레이어가 없는 씬은 프리캠 외의 모드가 없다
  if (!HAS_PLAYER) next = MODE.FLY;
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

  // 카메라를 넘기는 이유: 비처럼 "카메라 주위에만 존재하는" 것이 있다.
  // 도시 전체에 뿌리면 부피가 8천만 m³ 라 보이는 밀도를 채울 수 없다.
  world = await SCENE.build({ scene, renderer, rng, step, camera });
  Object.assign(built, world.built);

  let colliderCount = 0;

  if (HAS_PLAYER) {
    await step('캐릭터 · 스켈레톤 · 클립', 99, () => {
      const c = createCharacter();
      scene.add(c.root);
      built.character = c.root;
      hero = c;
      // 절차적 포즈를 키프레임으로 구워둔다 (익스포트 시 함께 내보낸다)
      charClips = bakeClips(c.rig);
      const boxes = world.colliders;
      colliderCount = boxes.length;
      player = createPlayer(c, camera, input, {
        boxes,
        spawn: SCENE.meta.spawn,
        surfaceHeight: SCENE.surfaceHeight,
      });
      // 캐릭터 트랜스폼은 player.update 가 써 준다. 한 번 돌려 두지 않으면
      // 첫 프레임까지 원점에 서 있고, 그 사이에 찍은 스크린샷이 어긋난다.
      player.update(0, { camera: false });
    });
  }

  flycam = createFlyCamera(camera, input);
  flycam.syncFromCamera();

  bar.style.width = '100%';
  stepEl.textContent = 'BAKE: 완료';
  await yieldFrame();

  const buildMs = performance.now() - t0;
  // 삼각형 수는 후처리 없이 센다. 컴포저를 거치면 전체화면 사각형이 섞여 들어온다.
  renderer.render(scene, camera);
  const tris = renderer.info.render.triangles;

  // 씬 이름은 바로 위 h1 에 있다 — 여기 또 적으면 두 줄에 같은 이름이 겹친다
  statsEl.innerHTML = [
    `생성 ${buildMs.toFixed(0)}ms`,
    `삼각형 ${tris.toLocaleString('ko-KR')}`,
    ...(world.stats || []),
    `텍스처 ${TEX.textureStats.count}장`,
    ...(HAS_PLAYER ? [`충돌체 ${colliderCount}개`] : []),
    `외부 애셋 0개 · seed ${SEED}`,
  ].join(' · ');

  setMode(mode);
  boot.classList.add('done');
  setTimeout(() => boot.remove(), 600);

  window.__stats = {
    scene: SCENE.meta.id,
    buildMs,
    tris,
    textures: TEX.textureStats.count,
    colliders: colliderCount,
    counts: world.counts || {},
    placement: world.placement || null,
  };
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

  if (mode === MODE.PLAY) {
    const s = player.update(dt);
    modeEl.innerHTML = `<b>PLAY</b> · 3인칭 &nbsp; ${s.speed.toFixed(1)} m/s${
      s.sprinting ? ' <span class="hot">달리기</span>' : ''
    }${s.grounded ? '' : ' <span class="hot">공중</span>'}`;
    lockEl.style.opacity = input.locked ? '0' : '1';
  } else {
    player?.update(dt, { input: false, camera: false }); // 캐릭터는 대기 동작만
    const f = flycam.update(dt);
    const alt = camera.position.y;
    modeEl.innerHTML = `<b>FLY</b> · 프리 카메라 &nbsp; 속도 ${f.speedLevel}/8 (${f.speed.toFixed(
      1
    )} m/s) &nbsp; 고도 ${alt.toFixed(0)}m`;
    lockEl.style.opacity = '0';
  }

  // 씬 갱신은 **카메라가 확정된 뒤**에 한다. 비처럼 카메라 위치를 참조하는
  // 것이 있어서, 먼저 돌리면 한 프레임 뒤처진 자리에 뿌려진다.
  world?.tick?.(t, dt);

  draw();
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
  composer?.setSize(innerWidth, innerHeight);
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
  pose = {}, // { phase, speed, grounded, facing } — 캐릭터 포즈·방향 고정
} = {}) => {
  const keepW = renderer.domElement.width;
  const keepH = renderer.domElement.height;
  const keepPR = renderer.getPixelRatio();
  const keepPos = camera.position.clone();
  const keepQuat = camera.quaternion.clone();

  if (hero) {
    hero.setPose(pose);
    // yaw 는 player가 매 프레임 목표각으로 보간한다. 찍는 시점에 따라 중간값이
    // 나오므로 정착값(π — 카메라를 등지고 서는 기본 자세)으로 못박는다.
    hero.root.rotation.y = pose.facing ?? Math.PI;
  }

  renderer.setPixelRatio(1);
  renderer.setSize(w, h, false);
  // 후처리 타깃도 같은 크기로 맞춘다. 안 하면 블룸이 화면 크기 기준으로 남아
  // 스크린샷마다 번짐 반경이 달라진다.
  if (composer) {
    composer.setPixelRatio(1);
    composer.setSize(w, h);
  }
  camera.aspect = w / h;
  if (pos) camera.position.set(pos[0], pos[1], pos[2]);
  if (target) camera.lookAt(target[0], target[1], target[2]);
  camera.updateProjectionMatrix();

  // 애니메이션을 고정 시각으로 되돌린다 — 스크린샷이 결정론적이어야 한다.
  // **카메라를 옮긴 뒤에** 해야 한다. 비는 카메라 주위에만 존재하므로 먼저
  // 돌리면 이전 카메라 자리에 뿌려져 화면에 하나도 안 잡힌다.
  world?.tick?.(time, 0);

  draw();

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
  if (composer) {
    composer.setPixelRatio(keepPR);
    composer.setSize(keepW, keepH);
  }
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
    player: player ? player.pos.toArray().map((v) => +v.toFixed(3)) : null,
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

// ── 회귀 검증 ──────────────────────────────────────────────────────────────
//
// shots/views.json 에 적힌 모든 뷰를 렌더한다. 카메라 좌표를 손으로 넘기지 않는
// 것이 핵심이다 — 예전에 좌표를 콘솔에만 두는 바람에 베이스라인 9장이 전부
// 재현 불가능해졌다. 자세한 사정은 views.json 의 _readme 참고.
//
//   await __lock()          현재 씬의 모든 뷰를 shots/<이름>.png 로 렌더
//   await __lock('base')    shots/baseline_<이름>.png 로 렌더 (기준 갱신)
// 예산·파이프라인 위험을 숫자로 점검한다. 자세한 내용은 core/audit.js 머리말.
window.__audit = () => auditScene({ scene, renderer, stats: window.__stats });

// 배치 검사 결과 전문 — 관통·부유·차도 침범이 **어디서** 났는지까지 본다
// (core/placement.js · scenes/night-city/placecheck.js).
// __audit() 은 몇 건인지만 알려주므로 자리를 찾을 때는 이쪽을 본다.
window.__place = () => window.__stats?.placement ?? null;

// 빌드마다 비워지는 상태 목록 (core/scenestate.js).
// 새 모듈에 캐시나 장부를 만들고 **등록을 잊었는지** 여기서 확인한다 —
// 잊으면 예외가 아니라 이전 씬 잔재가 조용히 섞인다.
window.__resets = () => sceneResetList();

// 1층 점포 유형 분포. 가중치가 낮은 유형이 한 번도 안 나오는 것을 잡는다
// (scenes/night-city/shopfront.js).
window.__shops = async () =>
  (await import('./scenes/night-city/shopfront.js')).shopTally();

// 주거 동별 편차 분포. 네 종을 갈라 놓고 실제로는 둘만 나오는 것을 잡는다
// (scenes/night-city/housing.js slabStyle).
window.__houses = async () =>
  (await import('./scenes/night-city/housing.js')).houseTally();

// 슬럼 세 유형 분포. 대지가 셋뿐이라 한 종류가 통째로 안 나올 수 있다
// (scenes/night-city/slum.js).
window.__slum = async () =>
  (await import('./scenes/night-city/slum.js')).slumTally();

// 공업 대지 유형 넷과 지붕 셋의 분포 (scenes/night-city/factory.js).
window.__factory = async () =>
  (await import('./scenes/night-city/factory.js')).factoryTally();

// 재질이 몇 개 만들어졌고 몇 번 공유됐나 (core/material.js).
// `materialReport` 는 이때까지 **아무도 못 부르는 곳에** 있었다 — 진단용은
// 호출자가 없어도 남기지만, 그건 `window.__*` 로 닿을 수 있을 때 얘기다.
window.__mats = async () =>
  (await import('./core/material.js')).materialReport();

window.__lock = async (prefix = '') => {
  const views = await fetch('/shots/views.json').then((r) => r.json());
  const set = views[SCENE.meta.id];
  if (!set) throw new Error(`views.json 에 '${SCENE.meta.id}' 항목이 없다`);

  // 접두사는 views.json 이 정한다 (`_tag`). 여기와 tools/verify.mjs 두 곳에
  // 씬 이름을 각각 적어 두면 어긋난다 — 실제로 씬이 셋이 되자 공터의 `wide` 와
  // 무대의 `wide` 가 같은 파일 이름을 쓰게 됐다.
  const tag = set._tag || '';
  const done = [];
  for (const [name, cfg] of Object.entries(set)) {
    if (name.startsWith('_')) continue;
    const file = `${prefix === 'base' ? 'baseline_' : ''}${tag}${name}`;
    // pose 를 함께 넘긴다. 캐릭터가 있는 씬은 대기 동작이 매 프레임 돌기
    // 때문에, 포즈를 못박지 않으면 같은 씬을 두 번 찍어도 픽셀이 달라진다
    // (실측: 공터 wide 에서 258픽셀). 회귀 검증이 성립하려면 화면에 영향을
    // 주는 상태가 전부 views.json 에 적혀 있어야 한다.
    await window.__shot({
      name: file, pos: cfg.pos, target: cfg.target, time: cfg.time ?? 0, pose: cfg.pose ?? {},
    });
    done.push(file);
  }
  return done;
};

build()
  .then(() => renderer.setAnimationLoop(frame))
  .catch((err) => {
    console.error(err);
    stepEl.textContent = `실패: ${err.message}`;
    window.__error = String(err && err.stack ? err.stack : err);
  });
