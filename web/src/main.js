// 오케스트레이션 — 렌더러·카메라·입력·모드 전환. 검증 하네스는 harness.js 다.
// "어떤 장소인가" 는 전부 활성 씬이 정한다 (scenes/index.js 의 계약 참고).
import * as THREE from 'three';
import { makeRandom } from './core/rng.js';
import * as TEX from './core/textures.js';
import { activeScene } from './scenes/index.js';
import { createCharacter } from './dynamic/character.js';
import { bakeClips } from './dynamic/clips.js';
import { MODE, createInput, createPlayer, createFlyCamera } from './controls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { mountSceneMenu } from './scenemenu.js';
import { mountInteract } from './interact.js';
import { mountHarness } from './harness.js';

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
// 단계별 시간 — 콘솔 `__steps()`. 빌드가 어디서 느려졌는지는 감이 아니라
// 이 표에서 본다 ("최적화 전에 먼저 센다" — 2026-08-08 파이프라인 재실사)
const stepLog = [];
window.__steps = () => stepLog;
async function step(label, pct, fn) {
  stepEl.textContent = `BAKE: ${label}`;
  bar.style.width = `${pct}%`;
  await yieldFrame();
  const t = performance.now();
  const out = await fn();
  stepLog.push({ label, ms: Math.round(performance.now() - t) });
  return out;
}

const scene = new THREE.Scene();

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = SCENE.meta.render.shadows;
// r0.185 에서 PCFSoft 는 폐기 — three 가 경고를 찍고 PCF 로 바꿔 그린다.
// 어차피 PCF 로 그려지고 있었으므로 이름을 실제 동작에 맞춘다 (픽셀 동일 확인).
renderer.shadowMap.type = THREE.PCFShadowMap;
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

// ── 빌드 완료 신호 ─────────────────────────────────────────────────────────
//
// `__ready` 는 불리언이다. 그래서 `await window.__ready` 는 **빌드 중이어도
// 즉시 통과한다** (undefined 를 await 하면 바로 풀린다) — 실제로 20초짜리
// 도시 빌드 90% 시점에 감사를 돌려 삼각형이 117만 개 모자란 값을 읽은 적이
// 있다. 기다리려면 이 Promise 를 쓴다:  await window.__built
let __buildDone;
window.__built = new Promise((r) => (__buildDone = r));

// 빌드가 끝나야 생기는 것들의 상자. main 이 쓰고 하네스는 읽는다 (harness.js
// 머리말). 흩어진 let 로 두면 하네스에 넘길 방법이 클로저 공유뿐이라 파일을
// 못 가른다.
const rt = {
  mode: HAS_PLAYER ? MODE.PLAY : MODE.FLY,
  player: null,
  flycam: null,
  interactor: null, // 씬이 interact 를 신고하면 근접 E 토글이 붙는다 (interact.js)
  world: null, // 활성 씬이 build()에서 돌려준 것 (built · tick · stats)
  hero: null, // 캐릭터 (하네스가 포즈를 고정하려면 필요하다). player 없으면 null
  charClips: [], // 캐릭터 애니메이션 클립 (익스포트에 함께 실린다)
};
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
  rt.mode = next;
  hintEl.innerHTML = HINTS[rt.mode];
  if (rt.mode === MODE.FLY) {
    input.releaseLock();
    rt.flycam.syncFromCamera();
  } else {
    rt.player.reset();
  }
}

const harness = mountHarness({ SCENE, renderer, scene, camera, composer, draw, frame, input, built, setMode, rt });

async function build() {
  const t0 = performance.now();
  const rng = makeRandom(SEED);
  TEX.setAnisotropy(renderer.capabilities.getMaxAnisotropy());

  // 카메라를 넘기는 이유: 비처럼 "카메라 주위에만 존재하는" 것이 있다.
  // 도시 전체에 뿌리면 부피가 8천만 m³ 라 보이는 밀도를 채울 수 없다.
  rt.world = await SCENE.build({ scene, renderer, rng, step, camera });
  Object.assign(built, rt.world.built);
  // 씬이 신고한 진단 집계를 콘솔 이름(__shops 등)으로 노출한다 (harness.js)
  harness.exposeDebug(rt.world.debug);

  let colliderCount = 0;

  if (HAS_PLAYER) {
    await step('캐릭터 · 스켈레톤 · 클립', 99, () => {
      const c = createCharacter();
      scene.add(c.root);
      built.character = c.root;
      rt.hero = c;
      // 절차적 포즈를 키프레임으로 구워둔다 (익스포트 시 함께 내보낸다)
      rt.charClips = bakeClips(c.rig);
      const boxes = rt.world.colliders;
      colliderCount = boxes.length;
      rt.player = createPlayer(c, camera, input, {
        boxes,
        spawn: SCENE.meta.spawn,
        surfaceHeight: SCENE.surfaceHeight,
      });
      // 캐릭터 트랜스폼은 player.update 가 써 준다. 한 번 돌려 두지 않으면
      // 첫 프레임까지 원점에 서 있고, 그 사이에 찍은 스크린샷이 어긋난다.
      rt.player.update(0, { camera: false });
    });
  }

  rt.flycam = createFlyCamera(camera, input);
  rt.flycam.syncFromCamera();

  if (rt.world.interact) rt.interactor = mountInteract({ camera, input, interact: rt.world.interact });

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
    ...(rt.world.stats || []),
    `텍스처 ${TEX.textureStats.count}장`,
    ...(HAS_PLAYER ? [`충돌체 ${colliderCount}개`] : []),
    `외부 애셋 0개 · seed ${SEED}`,
  ].join(' · ');

  setMode(rt.mode);
  boot.classList.add('done');
  setTimeout(() => boot.remove(), 600);

  window.__stats = {
    scene: SCENE.meta.id,
    buildMs,
    tris,
    textures: TEX.textureStats.count,
    colliders: colliderCount,
    counts: rt.world.counts || {},
    placement: rt.world.placement || null,
  };
  window.__ready = true;
  __buildDone();
}

// ── 루프 ───────────────────────────────────────────────────────────────────
//
// THREE.Clock 은 r0.185 에서 폐기다 (콘솔 경고). 대체제 Timer 는 애드온이라
// 의존을 늘리느니 직접 잰다 — 필요한 것은 경과시간과 클램프된 dt 둘뿐이다.
const t0 = performance.now() / 1000;
let last = t0;

function frame() {
  const now = performance.now() / 1000;
  // 탭 전환 뒤 첫 프레임처럼 dt 가 튀면 물리가 터널링한다. Clock 시절과 같은 클램프.
  const dt = Math.min(now - last, 0.05);
  last = now;
  const t = now - t0;

  if (input.toggleRequested) {
    input.toggleRequested = false;
    setMode(rt.mode === MODE.PLAY ? MODE.FLY : MODE.PLAY);
  }

  if (rt.mode === MODE.PLAY) {
    const s = rt.player.update(dt);
    modeEl.innerHTML = `<b>PLAY</b> · 3인칭 &nbsp; ${s.speed.toFixed(1)} m/s${
      s.sprinting ? ' <span class="hot">달리기</span>' : ''
    }${s.grounded ? '' : ' <span class="hot">공중</span>'}`;
    lockEl.style.opacity = input.locked ? '0' : '1';
  } else {
    rt.player?.update(dt, { input: false, camera: false }); // 캐릭터는 대기 동작만
    const f = rt.flycam.update(dt);
    const alt = camera.position.y;
    modeEl.innerHTML = `<b>FLY</b> · 프리 카메라 &nbsp; 속도 ${f.speedLevel}/8 (${f.speed.toFixed(
      1
    )} m/s) &nbsp; 고도 ${alt.toFixed(0)}m`;
    lockEl.style.opacity = '0';
  }

  // 씬 갱신은 **카메라가 확정된 뒤**에 한다. 비처럼 카메라 위치를 참조하는
  // 것이 있어서, 먼저 돌리면 한 프레임 뒤처진 자리에 뿌려진다.
  rt.world?.tick?.(t, dt);
  rt.interactor?.update(); // 근접 감지도 카메라 확정 뒤

  draw();
}

// 포인터 락: PLAY는 클릭으로, FLY는 우클릭을 누르는 동안만 (언리얼과 동일)
renderer.domElement.addEventListener('mousedown', (e) => {
  if (rt.mode === MODE.PLAY) input.requestLock();
  else if (e.button === 2) input.requestLock();
});
addEventListener('mouseup', (e) => {
  if (rt.mode === MODE.FLY && e.button === 2) input.releaseLock();
});

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  composer?.setSize(innerWidth, innerHeight);
});

build()
  .then(() => renderer.setAnimationLoop(frame))
  .catch((err) => {
    console.error(err);
    stepEl.textContent = `실패: ${err.message}`;
    window.__error = String(err && err.stack ? err.stack : err);
  });
