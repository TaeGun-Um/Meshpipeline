// 고가도로.
//
// 도시 위를 가로지르는 이 구조물이 하는 일은 교통이 아니라 **화면 분할**이다.
// 초고층 사이에 수평선을 하나 그으면 카메라가 어디에 있든 스케일 기준이 생기고,
// 아래를 지날 때는 천장이 되고 위에서 볼 때는 도시를 자르는 띠가 된다.
// 이게 없으면 상자들이 늘어서 있는 조감도처럼 보인다.
import * as THREE from 'three';
import { MeshBuilder } from '../../core/builder.js';
import { NEON } from '../../shared/neon.js';
import { neon } from '../../shared/masters.js';
import {
  CITY_HALF,
  HIGHWAY_X,
  HIGHWAY_Y,
  PITCH,
  PANEL_TILE,
} from './layout.js';

const DECK_W = 17; // 편도 2차로 x 2
const DECK_T = 1.1; // 상판 두께
const RAIL_H = 1.15;

// 고가도로 끝은 안개 속으로 사라져야 한다. 도시 경계에서 끊으면 잘린 단면이
// 그대로 보여 무대 세트처럼 된다.
const Z0 = -CITY_HALF - 420;
const Z1 = CITY_HALF + 420;

export function createHighway(scene, rng, mats) {
  const b = new MeshBuilder('Highway');
  const len = Z1 - Z0;
  const cz = (Z0 + Z1) / 2;
  const x = HIGHWAY_X;
  const y = HIGHWAY_Y;

  // ── 상판 ────────────────────────────────────────────────────────────────
  b.box(DECK_W, DECK_T, len, [x, y, cz], mats.panelMat, PANEL_TILE);

  // 상판 아래 종방향 거더 둘 — 밑에서 올려다볼 때 두께가 보인다
  for (const s of [-1, 1]) {
    b.box(
      1.5,
      1.7,
      len,
      [x + s * DECK_W * 0.28, y - DECK_T / 2 - 0.85, cz],
      mats.panelMat,
      PANEL_TILE
    );
  }

  // ── 방음벽 · 가드레일 ───────────────────────────────────────────────────
  for (const s of [-1, 1]) {
    const rx = x + s * (DECK_W / 2 - 0.25);
    b.box(0.4, RAIL_H, len, [rx, y + DECK_T / 2 + RAIL_H / 2, cz], mats.panelMat, PANEL_TILE);
    // 레일 상단 발광 띠 — 고가도로 선형을 밤에 드러내는 요소
    const strip = new THREE.PlaneGeometry(len, 0.16);
    strip.rotateY(s > 0 ? Math.PI / 2 : -Math.PI / 2);
    strip.translate(rx + s * 0.22, y + DECK_T / 2 + RAIL_H - 0.12, cz);
    b.add(strip, neon(NEON.amber));
  }

  // ── 교각 ────────────────────────────────────────────────────────────────
  // 격자 간격의 절반마다. 도로 위에만 세운다.
  const spacing = PITCH / 2;
  for (let z = Z0 + spacing / 2; z < Z1; z += spacing) {
    b.cylinder(1.5, 1.9, y - DECK_T / 2, [x, (y - DECK_T / 2) / 2, z], mats.wetConcreteMat, 12);
    // 캡빔 (기둥 머리에서 좌우로 벌어진다)
    b.box(
      DECK_W * 0.72,
      1.2,
      2.4,
      [x, y - DECK_T / 2 - 0.6, z],
      mats.wetConcreteMat,
      PANEL_TILE
    );
    b.box(4.4, 0.5, 4.4, [x, 0.25, z], mats.wetConcreteMat);

    // 교각 하부 경고등 — 아래를 지날 때 보이는 유일한 색
    if (rng.chance(0.5)) {
      b.sphere(0.28, [x + rng.range(-1.6, 1.6), y - DECK_T / 2 - 1.6, z], neon(NEON.pink));
    }
  }

  return b.build(scene);
}
