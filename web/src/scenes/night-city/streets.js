// 노면 · 인도 · 차선 · 횡단보도 · 가로등 · 신호등.
//
// 지면 구성이 단순하다: 도시 전체를 덮는 젖은 아스팔트 평면 한 장 위에, 블록마다
// 인도 높이의 판을 올린다. 건물은 그 판 위에 선다. 도로를 격자 모양으로 잘라
// 만들지 않는 이유는 블록 내부가 어차피 건물과 인도로 덮이기 때문이다.
import * as THREE from 'three';
import { MeshBuilder } from '../../core/builder.js';
import { scaleUV } from '../../core/meshkit.js';
import { dressSidewalks } from './sidewalk.js';
import { claim, TIER } from './siteplan.js';
import { districtAt } from './district.js';
import { upPlane, downPlane } from '../../core/boxfaces.js';
import { NEON, rgb01 } from '../../shared/neon.js';
import { neon } from '../../shared/masters.js';
import {
  GRID,
  coreDistance,
  PIT_INSET,
  BLOCK_SIZE,
  STREET_WIDTH,
  CITY_HALF,
  CURB_HEIGHT,
  blockCenter,
  gridLines,
  onIntersection,
  blockIndexAt,
} from './layout.js';

const ASPHALT_TILE = 9.0;
const SIDEWALK_TILE = 2.6;

// 지면 평면의 한 변. 원경 스카이라인 밑까지 깔려야 지평선에 틈이 보이지 않는다.
const GROUND_EXTENT = 3000;

const LAMP_H = 9.2;
const LAMP_ARM = 2.2;
const LAMP_TINT = [0.62, 0.74, 0.95];

// ── 노면 ───────────────────────────────────────────────────────────────────

function roadMesh(mat) {
  const geo = new THREE.PlaneGeometry(GROUND_EXTENT, GROUND_EXTENT, 60, 60);
  scaleUV(geo, GROUND_EXTENT / ASPHALT_TILE, GROUND_EXTENT / ASPHALT_TILE);
  geo.rotateX(-Math.PI / 2);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = 'Road';
  mesh.receiveShadow = true;
  return mesh;
}

// ── 블록 판 (인도) ─────────────────────────────────────────────────────────

// 공사장 블록은 판을 깔지 않는다. 굴착 구덩이가 지면 아래에 있는데 그 위에
// 불투명한 판을 덮으면 구덩이가 통째로 안 보인다 (실제로 그렇게 됐다).
function blockPlates(b, mats, programs) {
  for (let ix = 0; ix < GRID; ix++) {
    for (let iz = 0; iz < GRID; iz++) {
      const cx = blockCenter(ix);
      const cz = blockCenter(iz);
      const construction = programs.get(`${ix},${iz}`) === 'construction';

      // ── 공사장도 연석은 있다 (실측으로 고침) ─────────────────────────────
      // 원래는 공사장 블록의 판을 통째로 건너뛰었다. 구덩이 위에 보도블록이
      // 덮이는 걸 막으려던 것인데, 그러면 그 블록만 **인도가 아예 없어서**
      // 도로가 건물 밑동까지 그대로 붙는다. 도시를 돌아다니면 인도가 있다
      // 없다 하는 것으로 보인다.
      //
      // 실제 공사장도 보행로와 연석은 그대로 두고 안쪽만 파낸다.
      // 그래서 가운데를 비운 **띠 네 개**로 깐다.
      if (construction) {
        const inner = BLOCK_SIZE / 2 - PIT_INSET;
        const band = BLOCK_SIZE / 2 - inner;
        const mid = inner + band / 2;
        for (const [dx, dz, w, d] of [
          [0, -mid, BLOCK_SIZE, band],
          [0, mid, BLOCK_SIZE, band],
          [-mid, 0, band, inner * 2],
          [mid, 0, band, inner * 2],
        ]) {
          b.add(
            upPlane(w, d, [cx + dx, CURB_HEIGHT, cz + dz], [SIDEWALK_TILE, SIDEWALK_TILE]),
            mats.sidewalkMat
          );
          b.box(w, CURB_HEIGHT, d, [cx + dx, CURB_HEIGHT / 2, cz + dz], mats.curbMat);
        }
        continue;
      }

      // 윗면 (보도블록) — 보이는 면이라 UV를 미터 단위로 맞춘다
      b.add(
        upPlane(BLOCK_SIZE, BLOCK_SIZE, [cx, CURB_HEIGHT, cz], [SIDEWALK_TILE, SIDEWALK_TILE]),
        mats.sidewalkMat
      );
      // 판 몸통 (차도 쪽에서 보이는 측면 = 경계석)
      b.box(BLOCK_SIZE, CURB_HEIGHT, BLOCK_SIZE, [cx, CURB_HEIGHT / 2, cz], mats.curbMat);
    }
  }
}

// ── 차선 · 횡단보도 ────────────────────────────────────────────────────────

// 도로 페인트는 발광이 아니다. 발광으로 만들면 차선이 네온처럼 빛나서 간판과
// 위계가 뒤집힌다. 밝은 알베도 + 낮은 거칠기로 "젖은 노면 위의 페인트".
function roadPaint(b, mat) {
  const Y = 0.012; // 노면보다 살짝 위 (Z-파이팅 방지)
  const dash = 3.2;
  const gap = 3.2;
  const lineW = 0.16;
  const lines = gridLines();
  const laneOffsets = [-5.6, 0, 5.6]; // 22m 도로: 편도 2차로 + 중앙

  // 페인트는 **평면**으로 만든다. 박스로 만들면 12삼각형인데 보이는 건 윗면
  // 하나뿐이라 2삼각형이면 된다. 차선 조각이 3,400개라 6배 차이가 4만 삼각형이다.
  for (const c of lines) {
    for (const off of laneOffsets) {
      // X 방향 도로 (z = c + off)
      for (let x = -CITY_HALF; x < CITY_HALF; x += dash + gap) {
        if (onIntersection(x + dash / 2, c)) continue;
        b.add(upPlane(dash, lineW, [x + dash / 2, Y, c + off]), mat);
      }
      // Z 방향 도로 (x = c + off)
      for (let z = -CITY_HALF; z < CITY_HALF; z += dash + gap) {
        if (onIntersection(c, z + dash / 2)) continue;
        b.add(upPlane(lineW, dash, [c + off, Y, z + dash / 2]), mat);
      }
    }
  }

  // 횡단보도 — 교차로 네 변에 줄무늬
  const sw = 0.55;
  const sgap = 0.55;
  const band = 2.6;
  const outset = STREET_WIDTH / 2 + band / 2 + 0.4;
  for (const cx of lines) {
    for (const cz of lines) {
      if (Math.abs(cx) > CITY_HALF || Math.abs(cz) > CITY_HALF) continue;
      for (const s of [-1, 1]) {
        for (let t = -STREET_WIDTH / 2 + sw; t < STREET_WIDTH / 2; t += sw + sgap) {
          b.add(upPlane(sw, band, [cx + t, Y, cz + s * outset]), mat);
          b.add(upPlane(band, sw, [cx + s * outset, Y, cz + t]), mat);
        }
      }
    }
  }
}

// ── 가로등 ─────────────────────────────────────────────────────────────────

// 가로등은 도시의 리듬을 만든다. 발광 머리만 있으면 공중에 뜬 점으로 보이므로
// 기둥·팔·갓을 다 만든다. 실제 광원은 달지 않는다 — 150개면 어느 엔진도 못 버틴다.
// 대신 빛 웅덩이 목록에 자리를 남긴다 (shared/lightpool.js).
// (x, z) 가 속한 구역. 가로등은 도로 위에 있어 두 블록 사이인데, 인도 쪽
// 블록의 성격을 따른다 — 실제로 가로등은 그 블록의 관리 주체가 세운다.
function districtNear(x, z) {
  const ix = blockIndexAt(x);
  const iz = blockIndexAt(z);
  const cx = blockCenter(Math.max(0, Math.min(GRID - 1, ix)));
  const cz = blockCenter(Math.max(0, Math.min(GRID - 1, iz)));
  return districtAt(
    Math.max(0, Math.min(GRID - 1, ix)),
    Math.max(0, Math.min(GRID - 1, iz)),
    coreDistance(cx, cz)
  );
}

function streetLamp(b, mats, pools, x, z, dirX, dirZ) {
  // 계획에 자리를 요청한다. 골목 입구나 계단 착지점이 이미 차지했으면 건너뛴다.
  // 실제로 가로등 기둥이 골목 입구 한가운데 박혀 있었다 (siteplan.js 머리말).
  if (!claim(x, z, 1.1, TIER.LIGHT, 'lamp')) return;
  const D = districtNear(x, z);
  const hx = x + dirX * LAMP_ARM;
  const hz = z + dirZ * LAMP_ARM;
  const top = LAMP_H + CURB_HEIGHT;

  // 등 아래 빛 웅덩이. 도로 방향으로 길게 늘여야 빛이 도로를 따라 흐른다.
  pools.push({
    kind: 'floor',
    x: hx,
    y: 0.03,
    z: hz,
    rx: dirX ? 5.5 : 8.5,
    rz: dirZ ? 5.5 : 8.5,
    tint: rgb01(D.lamp, 0.5),
  });

  b.cylinder(0.13, 0.17, LAMP_H, [x, LAMP_H / 2 + CURB_HEIGHT, z], mats.metalMat);
  // 팔 (도로 쪽으로)
  b.box(
    dirX ? LAMP_ARM : 0.11,
    0.11,
    dirZ ? LAMP_ARM : 0.11,
    [x + dirX * LAMP_ARM * 0.5, top - 0.15, z + dirZ * LAMP_ARM * 0.5],
    mats.metalMat
  );
  // 갓
  b.box(dirX ? 0.9 : 0.34, 0.16, dirZ ? 0.9 : 0.34, [hx, top - 0.24, hz], mats.metalMat);
  // 발광면 (아래를 향한다)
  b.add(
    downPlane(dirX ? 0.78 : 0.26, dirZ ? 0.78 : 0.26, [hx, top - 0.33, hz]),
    neon(D.lamp)
  );
}

function streetLamps(b, mats, pools) {
  const lines = gridLines();
  const spacing = 22;
  const edge = STREET_WIDTH / 2 + 0.9; // 인도 위 0.9m

  for (const c of lines) {
    for (let t = -CITY_HALF + spacing / 2; t < CITY_HALF; t += spacing) {
      if (!onIntersection(t, c)) {
        for (const s of [-1, 1]) streetLamp(b, mats, pools, t, c + s * edge, 0, -s);
      }
      if (!onIntersection(c, t)) {
        for (const s of [-1, 1]) streetLamp(b, mats, pools, c + s * edge, t, -s, 0);
      }
    }
  }
}

// ── 신호등 ─────────────────────────────────────────────────────────────────

function trafficLights(b, mats, rng) {
  const lines = gridLines();
  const H = 5.4;
  const off = STREET_WIDTH / 2 + 1.2;

  for (const cx of lines) {
    for (const cz of lines) {
      if (Math.abs(cx) > CITY_HALF || Math.abs(cz) > CITY_HALF) continue;
      for (const sx of [-1, 1]) {
        for (const sz of [-1, 1]) {
          const x = cx + sx * off;
          const z = cz + sz * off;
          b.cylinder(0.09, 0.11, H, [x, H / 2 + CURB_HEIGHT, z], mats.metalMat, 6);
          b.box(0.26, 0.72, 0.22, [x, H + CURB_HEIGHT - 0.4, z], mats.frameMat);

          // 켜진 등 하나. 교차로마다 색이 달라야 정지된 사진처럼 보이지 않는다.
          const r = rng.next();
          const lit = r < 0.55 ? neon(NEON.green) : r < 0.72 ? neon(NEON.amber) : neon(NEON.pink);
          const dy = r < 0.55 ? 0.62 : r < 0.72 ? 0.4 : 0.18;
          b.sphere(0.085, [x, H + CURB_HEIGHT - dy, z + sz * 0.12], lit);
        }
      }
    }
  }
}

// ── 조립 ───────────────────────────────────────────────────────────────────

export function createStreets(scene, rng, mats, blocks) {
  const group = new THREE.Group();
  group.name = 'Streets';
  group.add(roadMesh(mats.asphaltMat));

  const programs = new Map(blocks.map((b) => [`${b.ix},${b.iz}`, b.program]));
  const plates = new MeshBuilder('Sidewalks', { castShadow: false });
  blockPlates(plates, mats, programs);
  group.add(plates.build());

  // 차선 페인트는 그림자를 받지 않는다. 노면에서 4mm 뜬 얇은 판이라 그림자를
  // 받게 하면 노면과 밝기가 어긋나 차선만 따로 어두워진다 (실제로 그렇게 됐다).
  const paint = new MeshBuilder('RoadPaint', { castShadow: false, receiveShadow: false });
  roadPaint(paint, mats.paintMat);
  // 인도 마감 — 연석선·측구·배수구·점자블록·맨홀·물웅덩이.
  // 인도 폭을 4.6m 확보하고 나니 이번엔 넓고 텅 빈 회색 띠가 됐다 (sidewalk.js).
  // 차선 페인트와 같은 빌더에 넣는다 — 전부 노면에서 몇 mm 뜬 얇은 판이라
  // 그림자 설정이 같아야 한다.
  dressSidewalks(paint, rng, mats);
  group.add(paint.build());

  const pools = [];
  const fixtures = new MeshBuilder('StreetFixtures', { receiveShadow: false });
  streetLamps(fixtures, mats, pools);
  trafficLights(fixtures, mats, rng);
  group.add(fixtures.build());

  scene.add(group);
  return { group, pools };
}
