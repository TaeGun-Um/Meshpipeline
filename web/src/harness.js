// 검증 하네스 — 결정론적 스크린샷 · 회귀 잠금 · 감사 · 익스포트.
//
// main.js 에서 떼어 냈다 (2026-08-08 코드리뷰): 부트·루프와 검증은 수명이
// 다르다 — 루프는 매 프레임이고 하네스는 콘솔에서 부를 때뿐이다. 한 파일에
// 두면 렌더러 배선을 고치다 검증 규약을 밟는다.
//
// **이 파일도 장소를 모른다.** 어느 씬에 어떤 진단 집계가 있는지는 씬이
// `world.debug` 로 신고하고 (scenes/index.js 의 계약), 여기는 그것을
// `window.__<이름>` 으로 노출만 한다.
//
// rt(runtime) 는 main 이 소유한 **가변 상자**다 — player·world·hero 처럼
// 빌드가 끝나야 생기는 것들을 담는다. 하네스는 읽기만 한다.
import * as THREE from 'three';
import { auditScene } from './core/audit.js';
import { triTally } from './core/placement.js';
import { sceneResetList } from './core/scenestate.js';
import { exportGLB, bakeInstances } from './export/gltf.js';
import { MODE } from './controls.js';

export function mountHarness({ SCENE, renderer, scene, camera, composer, draw, frame, input, built, setMode, rt }) {
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
    // **논리 크기를 저장한다** (getSize). domElement.width 는 드로잉버퍼 크기
    // (논리폭 x pixelRatio)라, 그걸 setSize 에 되넘기면 setSize 가 pixelRatio 를
    // 한 번 더 곱해 dpr>1 기기에서는 호출마다 캔버스가 복리로 커진다
    // (2026-08-08 코드리뷰 — dpr=1 에서만 무증상이었다).
    const keepSize = renderer.getSize(new THREE.Vector2());
    const keepW = keepSize.x;
    const keepH = keepSize.y;
    const keepPR = renderer.getPixelRatio();
    const keepPos = camera.position.clone();
    const keepQuat = camera.quaternion.clone();

    if (rt.hero) {
      rt.hero.setPose(pose);
      // yaw 는 player가 매 프레임 목표각으로 보간한다. 찍는 시점에 따라 중간값이
      // 나오므로 정착값(π — 카메라를 등지고 서는 기본 자세)으로 못박는다.
      rt.hero.root.rotation.y = pose.facing ?? Math.PI;
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
    rt.world?.tick?.(time, 0);

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
      if (rt.mode === MODE.PLAY) rt.player.update(dt);
      else rt.flycam.update(dt);
    }
    for (const c of codes) input.keys.delete(c);
    return {
      player: rt.player ? rt.player.pos.toArray().map((v) => +v.toFixed(3)) : null,
      camera: camera.position.toArray().map((v) => +v.toFixed(3)),
    };
  };
  window.__setMode = (m) => setMode(m);
  window.__world = built;

  // 파이프라인 인계용: 지정한 오브젝트를 .glb로 뽑는다.
  // bake:true 면 InstancedMesh를 실제 정점으로 구워서 내보낸다.
  //
  // 파일 이름 접두사는 views.json 의 _tag 가 정한다 — 샷 파일과 같은 규약이고
  // 출처도 같다 (__lock 의 주석 참고). 씬이 달라도 조각 이름이 겹치므로
  // (walls·props 가 공터와 오피스에 다 있다) 접두사 없이는 web/export 에서
  // 서로 덮어쓴다. vacant-lot 은 _tag 가 비어 있어 기존 이름 그대로다.
  window.__export = async (key, { bake = false, limit = Infinity, name } = {}) => {
    // 상호작용 프리뷰로 열어 둔 포즈를 전부 닫는다. 열린 채 내보내면 숨긴
    // 닫힘 노드가 GLB 에서 빠지고, 옮겨 간 열림 노드가 열림 그룹에서 빠진다.
    rt.interactor?.reset();
    let target = built[key];
    if (!target) throw new Error(`unknown object: ${key}`);
    if (bake) target = bakeInstances(target, limit);
    let file = name;
    if (!file) {
      const views = await fetch('/shots/views.json').then((r) => r.json());
      const set = views[SCENE.meta.id];
      if (!set) throw new Error(`views.json 에 '${SCENE.meta.id}' 항목이 없다 — _tag 가 없으면 익스포트 파일 이름이 다른 씬과 겹친다`);
      file = `${set._tag || ''}${key}${bake ? '_baked' : ''}.glb`;
    }
    // 캐릭터는 스킨 + 애니메이션 클립을 함께 싣는다
    const animations = key === 'character' ? rt.charClips : [];
    const t0 = performance.now();
    const r = await exportGLB(target, file, { animations });
    return { ...r, ms: +(performance.now() - t0).toFixed(0) };
  };

  // 예산·파이프라인 위험을 숫자로 점검한다. 자세한 내용은 core/audit.js 머리말.
  // 하한·비율은 씬이 meta.audit 로 신고한다 — core 는 형식만 안다.
  window.__audit = () => auditScene({ scene, renderer, stats: window.__stats, spec: SCENE.meta.audit });

  // 배치 검사 결과 전문 — 관통·부유·차도 침범이 **어디서** 났는지까지 본다
  // (core/placement.js · scenes/night-city/placecheck.js).
  // __audit() 은 몇 건인지만 알려주므로 자리를 찾을 때는 이쪽을 본다.
  window.__place = () => window.__stats?.placement ?? null;

  // 삼각형이 어느 기록(mark)에 들었나 — 병합 전 원장에서 센 값이다
  // (core/placement.js triTally). 최적화는 이 표에서 시작한다.
  window.__tris = () => triTally();

  // 빌드마다 비워지는 상태 목록 (core/scenestate.js).
  // 새 모듈에 캐시나 장부를 만들고 **등록을 잊었는지** 여기서 확인한다 —
  // 잊으면 예외가 아니라 이전 씬 잔재가 조용히 섞인다.
  window.__resets = () => sceneResetList();

  // 재질이 몇 개 만들어졌고 몇 번 공유됐나 (core/material.js).
  // `materialReport` 는 이때까지 **아무도 못 부르는 곳에** 있었다 — 진단용은
  // 호출자가 없어도 남기지만, 그건 `window.__*` 로 닿을 수 있을 때 얘기다.
  window.__mats = async () =>
    (await import('./core/material.js')).materialReport();

  // ── 회귀 검증 ────────────────────────────────────────────────────────────
  //
  // shots/views.json 에 적힌 모든 뷰를 렌더한다. 카메라 좌표를 손으로 넘기지 않는
  // 것이 핵심이다 — 예전에 좌표를 콘솔에만 두는 바람에 베이스라인 9장이 전부
  // 재현 불가능해졌다. 자세한 사정은 views.json 의 _readme 참고.
  //
  //   await __lock()          현재 씬의 모든 뷰를 shots/<이름>.png 로 렌더
  //   await __lock('base')    shots/baseline_<이름>.png 로 렌더 (기준 갱신)
  window.__lock = async (prefix = '') => {
    // 인자는 '' (일반 샷) 아니면 'base' (기준선 갱신) 둘뿐이다. 'baseline' 같은
    // 오타를 조용히 일반 샷으로 받으면 기준선을 갱신했다고 믿게 된다 (2026-08-08)
    if (prefix !== '' && prefix !== 'base') {
      throw new Error(`__lock 인자는 '' 또는 'base' 다 — '${prefix}' 는 모른다`);
    }
    // 열어 둔 포즈가 있으면 뷰가 기준선과 어긋난다 — 검증은 닫힘 상태가 기준
    rt.interactor?.reset();
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

  return {
    // 씬이 world.debug 로 신고한 진단 집계를 `__<이름>` 으로 노출한다.
    // 예전에는 main 이 night-city·model-test 경로를 직접 import 했다 —
    // "main 은 장소를 모른다" 위반이었다 (2026-08-08 코드리뷰). 이제 어느
    // 씬에 어떤 집계가 있는지는 씬만 알고, 여기는 이름만 옮겨 단다.
    exposeDebug(debug) {
      for (const [key, fn] of Object.entries(debug || {})) {
        window[`__${key}`] = fn;
      }
    },
  };
}
