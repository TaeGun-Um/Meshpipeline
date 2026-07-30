// 산포물 — 잡초. 인스턴싱 + 노이즈 기반 밀도.
import * as THREE from 'three';
import { worldFbm, lerp, clamp } from '../../core/noise.js';
import { LOT, groundHeight } from './terrain.js';

// ── 잡초 ───────────────────────────────────────────────────────────────────

function bladeGeometry() {
  const segs = 5;
  const h = 1.0;
  const halfW = 0.013; // 넓으면 옥수수잎처럼 보인다
  const pos = [];
  const uv = [];
  const idx = [];

  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    const y = t * h;
    const w = halfW * (1 - Math.pow(t, 1.35) * 0.93);
    const z = 0.17 * t * t;
    pos.push(-w, y, z, w, y, z);
    uv.push(0, t, 1, t);
  }
  for (let i = 0; i < segs; i++) {
    const a = i * 2;
    idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
  }

  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

export function createWeeds(scene, rng) {
  const density = worldFbm(7001, 4.5, 3);
  const geo = bladeGeometry();

  const mat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.86,
    metalness: 0,
    side: THREE.DoubleSide,
  });

  // 바람. 표준 재질의 정점 셰이더에 흔들림만 끼워 넣는다.
  mat.userData.shader = null;
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = { value: 0 };
    shader.vertexShader = 'uniform float uTime;\n' + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace(
      '#include <begin_vertex>',
      `
      vec3 transformed = vec3( position );
      #ifdef USE_INSTANCING
        float phase = instanceMatrix[3].x * 0.62 + instanceMatrix[3].z * 0.91;
      #else
        float phase = 0.0;
      #endif
      float bend = position.y * position.y;
      float sway = sin(uTime * 1.55 + phase) * 0.075 + sin(uTime * 3.3 + phase * 1.7) * 0.028;
      transformed.x += sway * bend;
      transformed.z += sway * 0.45 * bend;
      `
    );
    mat.userData.shader = shader;
  };

  const TARGET = 7200;
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const s = new THREE.Vector3();
  const p = new THREE.Vector3();
  const col = new THREE.Color();

  const mesh = new THREE.InstancedMesh(geo, mat, TARGET);
  mesh.receiveShadow = true; // 그림자는 받되 드리우지는 않는다 (성능)
  mesh.name = 'weeds';

  let placed = 0;
  let guard = 0;
  while (placed < TARGET && guard < TARGET * 40) {
    guard++;
    const x = rng.range(LOT.minX + 0.2, LOT.maxX - 0.2);
    const z = rng.range(LOT.minZ + 0.3, LOT.maxZ - 0.3);

    // 밀도를 노이즈로 뭉치게 — 공터 잡초는 고르게 안 난다.
    // 지수를 크게 잡아야 맨흙이 드러난 자리가 생긴다 (안 그러면 밀밭이 된다)
    const d = density(x, z);
    if (rng.next() > Math.pow(clamp(d * 1.6 - 0.42, 0, 1), 2.1)) continue;

    const y = groundHeight(x, z);
    const tall = rng.chance(0.1);
    const height = tall ? rng.range(0.6, 0.95) : rng.range(0.16, 0.44);

    e.set(rng.range(-0.16, 0.16), rng.range(0, Math.PI * 2), rng.range(-0.16, 0.16));
    q.setFromEuler(e);
    s.set(rng.range(0.8, 1.35), height, rng.range(0.8, 1.35));
    p.set(x, y - 0.02, z);
    m.compose(p, q, s);
    mesh.setMatrixAt(placed, m);

    // 마른 것과 푸른 것이 섞여 있다. 밝기를 올리면 탈색된 밀처럼 보이니 눌러둔다.
    const dry = rng.next();
    col.setRGB(
      lerp(0.12, 0.44, dry) * rng.range(0.8, 1.12),
      lerp(0.26, 0.4, dry) * rng.range(0.84, 1.1),
      lerp(0.08, 0.16, dry) * rng.range(0.8, 1.15)
    );
    mesh.setColorAt(placed, col);
    placed++;
  }

  mesh.count = placed;
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;

  scene.add(mesh);
  return { mesh, mat, count: placed };
}
