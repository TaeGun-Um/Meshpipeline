// 연동 시험 — **리깅된 외부 GLB 위에 코드로 생성한 것을 얹을 수 있나.**
//
// ── 왜 이걸 재는가 ─────────────────────────────────────────────────────────
// 캐릭터를 코드로만 만드는 데는 천장이 있다는 것을 다섯 판 돌면서 확인했다.
// 실제 사례(genex SKATE)를 열어 보니 사람은 코드가 아니라 **생성기가 만든
// 리깅 GLB**를 불러 쓰고, 모캡을 얹어 돌리고 있었다.
//
// 그러면 남는 질문은 하나다 — 그 경로에서 **코드 몫이 실제로 존재하는가.**
// 머리카락·장식처럼 규칙 있는 것을 남의 뼈대 위에 붙일 수 있으면 하이브리드가
// 성립하고, 못 붙이면 코드는 캐릭터에서 할 일이 없다.
//
// ── 무엇으로 재는가 ────────────────────────────────────────────────────────
// 남의 애셋을 가져오지 않는다. 이 저장소가 이미 내보낸 `export/character.glb`
// (본 17개 스킨드 메시)를 **외부 애셋인 셈 치고** 다시 불러들인다. 포맷과
// 구조가 같으므로 시험의 값어치는 같고, 남의 것을 쓰지 않는다.
//
// ── 주의 ───────────────────────────────────────────────────────────────────
// 이 파일은 씬을 안 바꾼다. `window.__rig()` 로 불러야만 돈다 —
// "외부 애셋 0개" 규칙을 시험 하나 때문에 조용히 깨면 안 된다.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as HAIR from './hair.js';
import { Toon, RAMP_HAIR, withOutline } from './toon.js';

const URL_DEFAULT = '/export/character.glb';

// 뼈 이름으로 찾는다. 이름 규약이 다르면 여기서 걸린다 —
// 실제로 그게 하이브리드의 첫 번째 위험이다 (meshy-biped vs Unity 휴머노이드).
function findBone(root, names) {
  let hit = null;
  root.traverse((o) => {
    if (hit || !o.isBone) return;
    if (names.some((n) => o.name.toLowerCase() === n.toLowerCase())) hit = o;
  });
  return hit;
}

function measure(root) {
  let tris = 0;
  let meshes = 0;
  let skinned = 0;
  let bones = 0;
  const mats = new Set();
  const boneNames = [];
  root.traverse((o) => {
    if (o.isBone) {
      bones++;
      boneNames.push(o.name);
    }
    if (!o.isMesh) return;
    meshes++;
    if (o.isSkinnedMesh) skinned++;
    const g = o.geometry;
    tris += (g.index ? g.index.count : g.attributes.position.count) / 3;
    for (const m of Array.isArray(o.material) ? o.material : [o.material]) mats.add(m);
  });
  const box = new THREE.Box3().setFromObject(root);
  const s = box.getSize(new THREE.Vector3());
  return {
    tris: Math.round(tris),
    meshes,
    skinned,
    bones,
    materials: mats.size,
    height: +s.y.toFixed(3),
    boneNames,
  };
}

export async function rigTest(scene, { url = URL_DEFAULT, at = [-1.05, 0, 0] } = {}) {
  const t0 = performance.now();
  const gltf = await new GLTFLoader().loadAsync(url);
  const loadMs = +(performance.now() - t0).toFixed(0);

  const root = gltf.scene;
  root.name = 'RigTest';
  root.position.set(at[0], at[1], at[2]);
  scene.add(root);

  const info = measure(root);
  info.loadMs = loadMs;
  info.clips = gltf.animations.map((a) => `${a.name}:${a.duration.toFixed(3)}s`);

  // ── 코드 생성물을 남의 뼈에 붙인다 ───────────────────────────────────────
  //
  // 머리카락은 머리뼈의 **자식**이 되어야 한다. 씬에 그냥 더하면 애니메이션이
  // 도는 순간 몸만 움직이고 머리카락은 제자리에 남는다.
  const head = findBone(root, ['Head', 'mixamorigHead', 'head', 'J_Bip_C_Head']);
  info.headBone = head ? head.name : null;

  if (head) {
    // 생성기는 캐릭터가 발바닥 y=0 에 서 있다고 보고 세계 좌표로 만든다.
    // 남의 뼈에 붙이려면 **뼈의 좌표계로 옮겨 앉혀야** 한다 —
    // 이 한 줄이 하이브리드에서 매번 나오는 실제 작업이다.
    root.updateMatrixWorld(true);
    const rig = new THREE.Group();
    rig.name = 'GeneratedHair';
    const inv = new THREE.Matrix4().copy(head.matrixWorld).invert();
    // 우리 머리(HEAD.bot~top)와 이 뼈의 높이가 다르므로 축척을 맞춘다.
    const headWorldY = new THREE.Vector3().setFromMatrixPosition(head.matrixWorld).y - at[1];
    const OUR_HEAD_Y = 1.44; // 우리 머리 중심
    const k = headWorldY / OUR_HEAD_Y;
    info.scale = +k.toFixed(3);

    const mat = Toon.instance(
      { color: 0xffffff, map: HAIR.hairGradient(), steps: RAMP_HAIR, rim: 0.22 },
      'Hair'
    );
    const flat = Toon.instance({ color: 0xe4e5f0, steps: RAMP_HAIR, rim: 0.2 }, 'HairFlat');

    let added = 0;
    const put = (geos, m, t) => {
      for (const g0 of Array.isArray(geos) ? geos : [geos]) {
        const g = g0.clone();
        g.scale(k, k, k);
        g.translate(at[0], at[1], at[2]);
        g.applyMatrix4(inv);
        const mesh = new THREE.Mesh(g, m);
        mesh.castShadow = true;
        rig.add(t > 0 ? withOutline(mesh, t * k) : mesh);
        added++;
      }
    };
    put(HAIR.hairCap(), flat, 0.003);
    put(HAIR.backHair(), flat, 0.0022);
    put(HAIR.bangs(), flat, 0.0018);
    put(HAIR.braids(), mat, 0);
    put(HAIR.tails(), flat, 0.003);
    info.attached = added;

    head.add(rig);
  }

  info.total = measure(root).tris;

  // ── 진짜 시험: 뼈가 움직이면 머리카락도 따라오는가 ───────────────────────
  //
  // 붙였다는 것과 따라간다는 것은 다르다. 씬에 그냥 더해 두면 로드 직후
  // 스크린샷은 멀쩡하고 애니메이션이 도는 순간 몸만 움직인다. 그래서
  // **머리뼈를 실제로 돌려 보고 머리카락 정점이 같이 갔는지 잰다.**
  if (head && info.attached) {
    const probe = new THREE.Vector3();
    const pick = rigMesh(head);
    const before = worldPoint(pick, probe.clone());
    head.rotation.y += 0.6;
    head.updateMatrixWorld(true);
    const after = worldPoint(pick, probe.clone());
    head.rotation.y -= 0.6;
    head.updateMatrixWorld(true);
    info.followed = +before.distanceTo(after).toFixed(4);
  }

  window.__rigRoot = root;
  return info;
}

// 머리에 붙은 것 중 아무 메시 하나의 첫 정점을 세계 좌표로
function rigMesh(head) {
  let m = null;
  head.traverse((o) => {
    if (!m && o.isMesh) m = o;
  });
  return m;
}
function worldPoint(mesh, out) {
  if (!mesh) return out;
  const p = mesh.geometry.attributes.position;
  out.set(p.getX(0), p.getY(0), p.getZ(0));
  mesh.updateMatrixWorld(true);
  return out.applyMatrix4(mesh.matrixWorld);
}
