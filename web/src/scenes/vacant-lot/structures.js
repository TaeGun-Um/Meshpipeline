// 인공 구조물 — 담장, 주택, 전신주·전선.
import * as THREE from 'three';
import * as TEX from './textures.js';
import { texMaterial } from './materials.js';
import { LOT, groundHeight } from './terrain.js';

// ── 담장 ───────────────────────────────────────────────────────────────────

function wallSegment(mats, len, height, thick) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(len, height, thick),
    texMaterial(TEX.blockTextures(), len / 1.2, height / 1.2, { normalScale: 1.25 })
  );
  body.position.y = height / 2;
  body.castShadow = true;
  body.receiveShadow = true;
  g.add(body);

  // 담장 위 마감 캡
  const cap = new THREE.Mesh(
    new THREE.BoxGeometry(len, 0.09, thick + 0.1),
    mats.capMat
  );
  cap.position.y = height + 0.045;
  cap.castShadow = true;
  cap.receiveShadow = true;
  g.add(cap);
  return g;
}

export function createWalls(scene, mats) {
  const group = new THREE.Group();
  group.name = 'walls';
  const H = 1.42;
  const T = 0.22;

  // 북쪽
  const north = wallSegment(mats, 23, H, T);
  north.position.set(0, 0, LOT.minZ - 0.4);
  group.add(north);

  // 서쪽 / 동쪽
  const west = wallSegment(mats, 16.6, H, T);
  west.rotation.y = Math.PI / 2;
  west.position.set(LOT.minX - 0.4, 0, -0.9);
  group.add(west);

  const east = wallSegment(mats, 16.6, H, T);
  east.rotation.y = Math.PI / 2;
  east.position.set(LOT.maxX + 0.4, 0, -0.9);
  group.add(east);

  // 도로 쪽은 가운데가 트여 있다 — 공터로 드나드는 입구
  const sw = wallSegment(mats, 6.4, H, T);
  sw.position.set(-7.7, 0, LOT.maxZ);
  group.add(sw);

  const se = wallSegment(mats, 6.4, H, T);
  se.position.set(7.7, 0, LOT.maxZ);
  group.add(se);

  scene.add(group);
  return group;
}


// ── 주택 ───────────────────────────────────────────────────────────────────

function addWindow(parent, w, h, x, y, z, mats) {
  const frame = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.09), mats.frameMat);
  frame.position.set(x, y, z);
  frame.castShadow = true;
  parent.add(frame);

  const glass = new THREE.Mesh(
    new THREE.BoxGeometry(w - 0.17, h - 0.17, 0.07),
    mats.glassMat
  );
  glass.position.set(x, y, z + 0.02);
  parent.add(glass);
}

function gableRoof(width, depth, rise, mat) {
  const shape = new THREE.Shape();
  shape.moveTo(-width / 2, 0);
  shape.lineTo(width / 2, 0);
  shape.lineTo(0, rise);
  shape.closePath();

  const geo = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false });
  geo.translate(0, 0, -depth / 2);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

// 정면이 +Z를 향하는 집 한 채
function createHouse(rng, mats) {
  const g = new THREE.Group();
  const floors = rng.int(2, 3);
  const fh = 2.85;
  const w = rng.range(7.6, 11.4);
  const d = rng.range(7.2, 9.6);
  const h = floors * fh;

  const useBrick = rng.chance(0.45);
  const wallSet = useBrick ? mats.brickSet : rng.pick(mats.wallSets);
  const bodyMat = texMaterial(wallSet, w / (useBrick ? 3.2 : 2.6), h / (useBrick ? 3.2 : 2.6));

  const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), bodyMat);
  body.position.y = h / 2;
  body.castShadow = true;
  body.receiveShadow = true;
  g.add(body);

  // 정면 창
  const cols = Math.max(2, Math.floor((w - 1.4) / 2.05));
  const step = (w - 1.8) / cols;
  const zf = d / 2 + 0.05;
  for (let f = 0; f < floors; f++) {
    const y = f * fh + fh * 0.62;
    for (let i = 0; i < cols; i++) {
      if (f === 0 && i === 0 && rng.chance(0.5)) continue; // 1층 한 칸은 현관/차고
      const x = -w / 2 + 0.9 + step * (i + 0.5);
      addWindow(g, step * 0.72, 1.42, x, y, zf, mats);
    }
  }

  // 1층 셔터(차고) 또는 대문
  if (rng.chance(0.6)) {
    const gw = rng.range(2.3, 3.0);
    const shutter = new THREE.Mesh(
      new THREE.BoxGeometry(gw, 2.15, 0.12),
      mats.shutterMat
    );
    shutter.position.set(-w / 2 + 0.9 + gw / 2, 1.08, zf);
    shutter.castShadow = true;
    g.add(shutter);
  }

  // 2층 베란다 — 바닥 슬래브 + 난간 3면
  if (floors >= 2 && rng.chance(0.7)) {
    const bw = w * rng.range(0.46, 0.7);
    const bd = 0.95;
    const bx = rng.range(-1, 1);
    const by = fh;
    const bz = d / 2 + bd / 2;

    const slab = new THREE.Mesh(new THREE.BoxGeometry(bw, 0.12, bd), mats.capMat);
    slab.position.set(bx, by, bz);
    slab.castShadow = true;
    slab.receiveShadow = true;
    g.add(slab);

    const railH = 0.92;
    const parts = [
      [bw, railH, 0.07, bx, by + railH / 2, bz + bd / 2],
      [0.07, railH, bd, bx - bw / 2, by + railH / 2, bz],
      [0.07, railH, bd, bx + bw / 2, by + railH / 2, bz],
    ];
    for (const [pw, ph, pd, px, py, pz] of parts) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(pw, ph, pd), mats.capMat);
      m.position.set(px, py, pz);
      m.castShadow = true;
      m.receiveShadow = true;
      g.add(m);
    }
  }

  if (rng.chance(0.55)) {
    // 평지붕 + 난간 + 옥상 물탱크
    const pT = 0.16;
    const pH = 0.72;
    const parapetMat = mats.capMat;
    const defs = [
      [w, pH, pT, 0, h + pH / 2, d / 2 - pT / 2],
      [w, pH, pT, 0, h + pH / 2, -d / 2 + pT / 2],
      [pT, pH, d, -w / 2 + pT / 2, h + pH / 2, 0],
      [pT, pH, d, w / 2 - pT / 2, h + pH / 2, 0],
    ];
    for (const [bw, bh, bd, px, py, pz] of defs) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, bd), parapetMat);
      m.position.set(px, py, pz);
      m.castShadow = true;
      m.receiveShadow = true;
      g.add(m);
    }

    const slab = new THREE.Mesh(new THREE.BoxGeometry(w, 0.12, d), mats.capMat);
    slab.position.y = h + 0.06;
    slab.receiveShadow = true;
    g.add(slab);

    // 파란 물탱크
    const tank = new THREE.Mesh(
      new THREE.CylinderGeometry(0.62, 0.62, 1.15, 18),
      mats.tankMat
    );
    tank.position.set(rng.range(-w / 3, w / 3), h + 0.72, rng.range(-d / 3, 0));
    tank.castShadow = true;
    g.add(tank);

    // 옥탑 계단실
    if (rng.chance(0.6)) {
      const sw2 = rng.range(1.9, 2.6);
      const box = new THREE.Mesh(
        new THREE.BoxGeometry(sw2, 2.25, sw2 * 0.85),
        bodyMat
      );
      box.position.set(rng.range(-w / 4, w / 4), h + 1.24, -d / 2 + sw2 * 0.6);
      box.castShadow = true;
      box.receiveShadow = true;
      g.add(box);

      const lid = gableRoof(sw2 + 0.3, sw2 * 0.85 + 0.3, 0.45, rng.pick(mats.roofMats));
      lid.position.set(box.position.x, h + 2.36, box.position.z);
      g.add(lid);
    }
  } else {
    // 맞배지붕
    const roof = gableRoof(w + 0.7, d + 0.7, rng.range(1.5, 2.2), rng.pick(mats.roofMats));
    roof.position.y = h;
    g.add(roof);
  }

  return g;
}

export function createHouses(scene, rng, mats) {
  const group = new THREE.Group();
  group.name = 'houses';

  const plots = [
    [-14.5, -17.5, 0],
    [-2.0, -18.5, 0],
    [11.0, -17.0, 0],
    [-20.5, -2.5, Math.PI / 2],
    [-21.0, 6.5, Math.PI / 2],
    [20.5, -3.5, -Math.PI / 2],
    [21.0, 5.5, -Math.PI / 2],
    [-9.0, 31.0, Math.PI],
    [9.0, 32.0, Math.PI],
  ];

  for (const [x, z, ry] of plots) {
    const house = createHouse(rng, mats);
    house.position.set(x, groundHeight(x, z) - 0.12, z);
    house.rotation.y = ry;
    group.add(house);
  }

  scene.add(group);
  return group;
}


// ── 전신주 · 전선 ──────────────────────────────────────────────────────────

function wire(a, b, sag, mat) {
  const pts = [];
  const n = 10;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const p = new THREE.Vector3().lerpVectors(a, b, t);
    p.y -= sag * 4 * t * (1 - t);
    pts.push(p);
  }
  const curve = new THREE.CatmullRomCurve3(pts);
  const geo = new THREE.TubeGeometry(curve, 28, 0.022, 5, false);
  return new THREE.Mesh(geo, mat);
}

export function createPoles(scene, mats) {
  const group = new THREE.Group();
  group.name = 'poles';

  const spots = [
    [12.6, 7.55],
    [-13.4, 7.55],
    [37.0, 7.55],
  ];
  const tops = [];

  for (const [x, z] of spots) {
    const y0 = groundHeight(x, z);
    const H = 9.4;

    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.13, 0.19, H, 12),
      mats.concreteMat
    );
    pole.position.set(x, y0 + H / 2, z);
    pole.castShadow = true;
    pole.receiveShadow = true;
    group.add(pole);

    for (const [ay, aw] of [
      [H - 0.7, 2.1],
      [H - 1.65, 1.7],
    ]) {
      const arm = new THREE.Mesh(new THREE.BoxGeometry(aw, 0.11, 0.13), mats.concreteMat);
      arm.position.set(x, y0 + ay, z);
      arm.castShadow = true;
      group.add(arm);

      for (const s of [-1, 1]) {
        const ins = new THREE.Mesh(
          new THREE.CylinderGeometry(0.055, 0.075, 0.16, 8),
          mats.insulatorMat
        );
        ins.position.set(x + s * (aw / 2 - 0.12), y0 + ay + 0.13, z);
        group.add(ins);
      }
    }

    // 변압기
    const tr = new THREE.Mesh(
      new THREE.CylinderGeometry(0.34, 0.34, 0.9, 14),
      mats.transformerMat
    );
    tr.position.set(x + 0.42, y0 + H - 3.1, z);
    tr.castShadow = true;
    group.add(tr);

    tops.push(new THREE.Vector3(x, y0 + H - 0.57, z));
  }

  // 전신주 사이 전선
  for (let i = 0; i < tops.length - 1; i++) {
    for (const [dz, dy] of [
      [-0.88, 0],
      [0.88, 0],
      [-0.7, -0.95],
      [0.7, -0.95],
    ]) {
      const a = tops[i].clone();
      const b = tops[i + 1].clone();
      a.z += dz;
      b.z += dz;
      a.y += dy;
      b.y += dy;
      group.add(wire(a, b, 0.45, mats.wireMat));
    }
  }

  // 집으로 들어가는 인입선
  group.add(
    wire(tops[1].clone().add(new THREE.Vector3(0, -1.4, 0)), new THREE.Vector3(-18.5, 7.4, 4.0), 0.5, mats.wireMat)
  );
  group.add(
    wire(tops[0].clone().add(new THREE.Vector3(0, -1.4, 0)), new THREE.Vector3(17.5, 7.1, -1.5), 0.5, mats.wireMat)
  );

  scene.add(group);
  return group;
}
