// 비.
//
// ── 왜 카메라를 따라다니는가 ───────────────────────────────────────────────
// 도시 전체(한 변 528m, 높이 300m)에 비를 뿌리면 부피가 8천만 m³ 다. 눈에 보일
// 밀도를 채우려면 수십만 개가 필요하고, 그중 화면에 들어오는 건 극히 일부다.
//
// 그래서 카메라 주위의 작은 상자에만 뿌리고 그 상자를 카메라와 함께 옮긴다.
// 비는 어차피 개별 줄기를 구분할 수 없으므로 "어디에 있던 줄기인지" 는 의미가 없다.
// 4천 개로 화면을 채운다.
//
// ── 왜 가산합성인가 ────────────────────────────────────────────────────────
// 빗줄기는 스스로 빛나지 않는다. 도시의 빛을 굴절시켜 보이는 것이라 배경이 밝은
// 곳에서 잘 보이고 어두운 곳에서는 거의 안 보인다. 가산합성이 정확히 그렇게 된다.
// 불투명하게 그리면 검은 하늘에 흰 선이 그어져 눈보라처럼 보인다.
import * as THREE from 'three';
import { Additive } from '../core/material.js';

// 4,200개 / 폭 3.5cm / 불투명도 0.5 로 시작했더니 흰 막대가 흩어진 것처럼 보였다.
// 비는 개별 줄기가 보이면 안 된다 — 촘촘하고 흐릿해야 "비" 로 읽힌다.
const COUNT = 14000;
const BOX = { w: 120, h: 64, d: 120 }; // 카메라 주위 부피
const FALL = 46; // 낙하 속도 (m/s)
const SLANT = 0.14; // 기울기 (바람)

export function createRain(scene, rng, { count = COUNT, tint = 0x8fa2bd, opacity = 0.26 } = {}) {
  // 빗줄기 하나 = 세로로 긴 사각형. 카메라를 향하도록 빌보드하지 않는다 —
  // 수직 낙하물이라 어느 방향에서 봐도 세로선으로 보이고, 빌보드 비용이 아깝다.
  const geo = new THREE.PlaneGeometry(0.02, 1);
  geo.translate(0, -0.5, 0);

  const mat = Additive.instance({ color: tint, opacity }, 'Rain');
  const mesh = new THREE.InstancedMesh(geo, mat, count);
  mesh.name = 'Rain';
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  mesh.frustumCulled = false;
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  mesh.renderOrder = 3;

  // 줄기마다 상자 안의 고정 위치 + 길이. 위치는 카메라 기준 상대좌표다.
  const drops = [];
  for (let i = 0; i < count; i++) {
    drops.push({
      x: rng.range(-BOX.w / 2, BOX.w / 2),
      z: rng.range(-BOX.d / 2, BOX.d / 2),
      y0: rng.range(0, BOX.h),
      len: rng.range(0.45, 1.3),
      speed: FALL * rng.range(0.85, 1.25),
    });
  }

  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const pos = new THREE.Vector3();
  const scl = new THREE.Vector3();
  // 바람에 기운 각도. 모든 줄기가 같은 방향으로 기울어야 비처럼 보인다.
  q.setFromEuler(new THREE.Euler(0, 0, SLANT));

  const group = new THREE.Group();
  group.name = 'Rain';
  group.add(mesh);
  scene.add(group);

  function tick(t, camera) {
    if (!camera) return;
    // 카메라 위치를 격자에 스냅한다. 안 그러면 카메라가 움직일 때 상자가 따라
    // 미끄러지면서 모든 줄기가 같이 흘러 비가 옆으로 흐르는 것처럼 보인다.
    const cx = Math.round(camera.position.x);
    const cy = camera.position.y;
    const cz = Math.round(camera.position.z);

    for (let i = 0; i < drops.length; i++) {
      const d = drops[i];
      // 낙하를 상자 높이로 감싼다
      let y = d.y0 - t * d.speed;
      y = ((y % BOX.h) + BOX.h) % BOX.h;
      pos.set(cx + d.x, cy + y - BOX.h * 0.62, cz + d.z);
      scl.set(1, d.len, 1);
      m4.compose(pos, q, scl);
      mesh.setMatrixAt(i, m4);
    }
    mesh.instanceMatrix.needsUpdate = true;
  }

  return { group, tick, count };
}
