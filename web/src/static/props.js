// 소품 — 블록/벽돌 무더기, 타이어, 드럼통, 잡석, 표지판, 관목.
import * as THREE from 'three';
import * as TEX from '../core/textures.js';
import { texMaterial } from './materials.js';
import { LOT, groundHeight } from './terrain.js';

// ── 소품 ───────────────────────────────────────────────────────────────────

export function createProps(scene, rng, mats) {
  const group = new THREE.Group();
  group.name = 'props';

  const put = (mesh, x, z, dy = 0) => {
    mesh.position.x = x;
    mesh.position.z = z;
    mesh.position.y += groundHeight(x, z) + dy;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
    return mesh;
  };

  // 시멘트 블록 무더기
  const blockGeo = new THREE.BoxGeometry(0.39, 0.19, 0.19);
  const blockMat = texMaterial(TEX.blockTextures(), 1, 1, { normalScale: 1.1 });
  {
    const bx = -6.4;
    const bz = 1.2;
    let n = 0;
    for (let layer = 0; layer < 4; layer++) {
      const per = 4 - layer;
      for (let i = 0; i < per; i++) {
        const b = new THREE.Mesh(blockGeo, blockMat);
        b.position.set(0, 0.1 + layer * 0.2, 0);
        b.rotation.y = rng.range(-0.09, 0.09);
        put(b, bx + i * 0.44 + layer * 0.2 + rng.range(-0.03, 0.03), bz + rng.range(-0.06, 0.06));
        n++;
      }
    }
    // 무너진 몇 장
    for (let i = 0; i < 5; i++) {
      const b = new THREE.Mesh(blockGeo, blockMat);
      b.position.y = 0.1;
      b.rotation.set(rng.range(-0.1, 0.1), rng.range(0, Math.PI), rng.range(-0.06, 0.06));
      put(b, bx + rng.range(-1.3, 2.6), bz + rng.range(-1.6, 1.4));
    }
  }

  // 붉은 벽돌 무더기
  {
    const brickGeo = new THREE.BoxGeometry(0.21, 0.058, 0.1);
    const brickMat = texMaterial(TEX.brickTextures(), 0.5, 0.2);
    const bx = 3.1;
    const bz = 3.6;
    for (let layer = 0; layer < 9; layer++) {
      for (let i = 0; i < 4; i++) {
        const b = new THREE.Mesh(brickGeo, brickMat);
        b.position.set(0, 0.032 + layer * 0.06, 0);
        b.rotation.y = rng.range(-0.05, 0.05) + (layer % 2 ? Math.PI / 2 : 0);
        put(b, bx + i * 0.115 + rng.range(-0.02, 0.02), bz + rng.range(-0.02, 0.02));
      }
    }
    for (let i = 0; i < 7; i++) {
      const b = new THREE.Mesh(brickGeo, brickMat);
      b.position.y = 0.03;
      b.rotation.set(0, rng.range(0, Math.PI), rng.range(-0.2, 0.2));
      put(b, bx + rng.range(-1.2, 1.4), bz + rng.range(-1.1, 1.0));
    }
  }

  // 버려진 타이어
  const tireMat = new THREE.MeshStandardMaterial({ color: 0x1d1c1b, roughness: 0.92 });
  {
    const t = new THREE.Mesh(new THREE.TorusGeometry(0.31, 0.105, 10, 22), tireMat);
    t.rotation.x = Math.PI / 2;
    t.position.y = 0.075;
    put(t, -2.4, -2.1);

    const t2 = new THREE.Mesh(new THREE.TorusGeometry(0.31, 0.105, 10, 22), tireMat);
    t2.rotation.set(Math.PI / 2 - 0.35, 0.4, 0.2);
    t2.position.y = 0.14;
    put(t2, -1.75, -1.55);
  }

  // 녹슨 드럼통 — 하나는 서 있고 하나는 누워 있다
  {
    const rustMat = texMaterial(TEX.rustTextures(), 1.6, 1);
    const drumGeo = new THREE.CylinderGeometry(0.29, 0.29, 0.88, 18);
    const d1 = new THREE.Mesh(drumGeo, rustMat);
    d1.position.y = 0.44;
    d1.rotation.y = 0.5;
    put(d1, 7.6, -1.2);

    const d2 = new THREE.Mesh(drumGeo, rustMat);
    d2.rotation.set(Math.PI / 2, 0, 0.25);
    d2.position.y = 0.29;
    put(d2, 8.5, -0.2);
  }

  // 잡석 — 인스턴싱
  {
    const geo = new THREE.BoxGeometry(1, 1, 1);
    const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95 });
    const COUNT = 300;
    const mesh = new THREE.InstancedMesh(geo, mat, COUNT);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    const s = new THREE.Vector3();
    const p = new THREE.Vector3();
    const col = new THREE.Color();

    for (let i = 0; i < COUNT; i++) {
      const x = rng.range(LOT.minX + 0.3, LOT.maxX - 0.3);
      const z = rng.range(LOT.minZ + 0.4, LOT.maxZ - 0.4);
      const sc = rng.range(0.045, 0.14);
      e.set(rng.range(0, 3), rng.range(0, 3), rng.range(0, 3));
      q.setFromEuler(e);
      s.set(sc * rng.range(0.7, 1.5), sc * rng.range(0.5, 1.0), sc * rng.range(0.7, 1.5));
      p.set(x, groundHeight(x, z) + sc * 0.22, z);
      m.compose(p, q, s);
      mesh.setMatrixAt(i, m);
      // 밝게 두면 흩어진 종이쓰레기처럼 보인다. 흙보다 살짝 밝은 정도로만.
      const g = rng.range(0.2, 0.38);
      col.setRGB(g * 1.08, g, g * 0.86);
      mesh.setColorAt(i, col);
    }
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    group.add(mesh);
  }

  // 기울어진 철제 표지판
  {
    const sign = new THREE.Group();
    const post = new THREE.Mesh(
      new THREE.CylinderGeometry(0.035, 0.035, 1.9, 8),
      mats.railMat
    );
    post.position.y = 0.95;
    post.castShadow = true;
    sign.add(post);

    const plate = new THREE.Mesh(
      new THREE.BoxGeometry(0.62, 0.42, 0.03),
      texMaterial(TEX.rustTextures(), 1, 1)
    );
    plate.position.set(0, 1.72, 0.02);
    plate.castShadow = true;
    sign.add(plate);

    sign.rotation.z = 0.075;
    sign.rotation.y = -0.35;
    sign.position.set(-9.2, groundHeight(-9.2, 5.4), 5.4);
    group.add(sign);
  }

  // 웃자란 관목 두 그루
  {
    const bushMat = new THREE.MeshStandardMaterial({
      color: 0x4d6b32,
      roughness: 0.9,
      flatShading: true,
    });
    for (const [bx, bz, r] of [
      [-8.4, -6.2, 0.95],
      [9.4, 4.2, 0.72],
      [1.2, -7.4, 0.6],
    ]) {
      const geo = new THREE.IcosahedronGeometry(r, 1);
      const pos = geo.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        const f = rng.range(0.72, 1.28);
        pos.setXYZ(i, pos.getX(i) * f, pos.getY(i) * f * 0.9, pos.getZ(i) * f);
      }
      geo.computeVertexNormals();
      const bush = new THREE.Mesh(geo, bushMat);
      bush.position.y = r * 0.62;
      put(bush, bx, bz);
    }
  }

  scene.add(group);
  return group;
}
