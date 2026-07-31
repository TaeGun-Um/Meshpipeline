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
import { parcels, roadOpen, roadOpenZ } from './parcel.js';
import { upPlane, downPlane } from '../../core/boxfaces.js';
import { NEON, rgb01 } from '../../shared/neon.js';
import { neon } from '../../shared/masters.js';
import {
  GRID,
  PIT_INSET,
  CITY_HALF,
  CURB_HEIGHT,
  blockCenter,
  roads,
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
  // 대지 단위로 깐다. 병합한 대지는 판이 하나로 이어져야 그 안에 도로가
  // 없다는 것이 읽힌다 — 칸마다 깔면 사이에 틈이 남는다.
  for (const p of parcels()) {
    const R = p.rect;
    const cx = (R.x0 + R.x1) / 2;
    const cz = (R.z0 + R.z1) / 2;
    const bw = R.x1 - R.x0;
    const bd = R.z1 - R.z0;
    const construction = programs.get(`${p.ix},${p.iz}`) === 'construction';

    // ── 공사장도 연석은 있다 (실측으로 고침) ─────────────────────────────
    // 원래는 공사장 블록의 판을 통째로 건너뛰었다. 구덩이 위에 보도블록이
    // 덮이는 걸 막으려던 것인데, 그러면 그 블록만 **인도가 아예 없어서**
    // 도로가 건물 밑동까지 그대로 붙는다.
    if (construction) {
      const inner = bw / 2 - PIT_INSET;
      const band = PIT_INSET;
      const mid = inner + band / 2;
      for (const [dx, dz, w, d] of [
        [0, -mid, bw, band],
        [0, mid, bw, band],
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

    b.add(
      upPlane(bw, bd, [cx, CURB_HEIGHT, cz], [SIDEWALK_TILE, SIDEWALK_TILE]),
      mats.sidewalkMat
    );
    b.box(bw, CURB_HEIGHT, bd, [cx, CURB_HEIGHT / 2, cz], mats.curbMat);
  }
}

// 차선 몇 개를 그을 것인가.
//
// 도로 폭이 구간마다 다르므로 (8·15·16·22·38m) 차선 수도 따라가야 한다.
// 8m 짜리 1차 매립지 길에 편도 2차로를 그으면 차선이 인도 밑으로 들어간다.
// 한 차로를 5.6m 로 보고 나눈다 (22m 도로가 편도 2차로 = 넷이 되는 값).
function laneDividers(width) {
  const n = Math.max(2, Math.min(6, Math.round(width / 5.6)));
  const out = [];
  for (let k = 1; k < n; k++) out.push(-width / 2 + (width * k) / n);
  return out;
}

function roadPaint(b, mat) {
  const Y = 0.012; // 노면보다 살짝 위 (Z-파이팅 방지)
  const dash = 3.2;
  const gap = 3.2;
  const lineW = 0.16;
  const rs = roads();

  // 페인트는 **평면**으로 만든다. 박스로 만들면 12삼각형인데 보이는 건 윗면
  // 하나뿐이라 2삼각형이면 된다. 차선 조각이 3,400개라 6배 차이가 4만 삼각형이다.
  //
  // 기준은 격자선이 아니라 **도로의 한가운데**(r.mid)다. 구간 경계에서는
  // 도로가 격자선 기준으로 비대칭이라, 격자선을 쓰면 차선이 한쪽으로 쏠린다.
  rs.forEach((r, bi) => {
    for (const off of laneDividers(r.width)) {
      const c = r.mid + off;
      // X 방향 도로 (z = c) — 병합으로 닫힌 구간에는 도로가 없다
      for (let x = -CITY_HALF; x < CITY_HALF; x += dash + gap) {
        if (!roadOpenZ(bi, x + dash / 2)) continue;
        if (onIntersection(x + dash / 2, c)) continue;
        b.add(upPlane(dash, lineW, [x + dash / 2, Y, c]), mat);
      }
      // Z 방향 도로 (x = c)
      for (let z = -CITY_HALF; z < CITY_HALF; z += dash + gap) {
        if (!roadOpen(bi, z + dash / 2)) continue;
        if (onIntersection(c, z + dash / 2)) continue;
        b.add(upPlane(lineW, dash, [c, Y, z + dash / 2]), mat);
      }
    }
  });

  // ── 횡단보도 ────────────────────────────────────────────────────────────
  //
  // 교차로 네 변. 줄무늬는 건너가는 도로를 **가로질러** 놓이고, 위치는
  // 교차로에 붙는 쪽 연석 안쪽이다.
  //
  // 전에는 격자선에서 `STREET_WIDTH/2 + band/2 + 0.4` 만큼 바깥에 놨는데,
  // 그건 연석보다 1.7m **바깥**이라 인도 판 밑에 깔려 있었다 (판이 16cm 위에
  // 있으므로 보이지도 않았다). 차도 안쪽으로 옮긴다.
  const sw = 0.55;
  const sgap = 0.55;
  const band = 2.6;
  const inset = band / 2 + 0.4;
  rs.forEach((rx, xi) => {
    if (Math.abs(rx.mid) > CITY_HALF) return;
    rs.forEach((rz, zi) => {
      if (Math.abs(rz.mid) > CITY_HALF) return;
      // 둘 중 하나라도 그 자리에서 닫혀 있으면 교차로가 아니다
      if (!roadOpen(xi, rz.mid) || !roadOpenZ(zi, rx.mid)) return;
      // Z 방향 도로(x ∈ rx)를 가로지르는 줄무늬 — rz 의 양쪽 끝에 붙는다
      for (const z of [rz.lo + inset, rz.hi - inset]) {
        for (let x = rx.lo + sw; x < rx.hi; x += sw + sgap) {
          b.add(upPlane(sw, band, [x, Y, z]), mat);
        }
      }
      // X 방향 도로(z ∈ rz)를 가로지르는 줄무늬
      for (const x of [rx.lo + inset, rx.hi - inset]) {
        for (let z = rz.lo + sw; z < rz.hi; z += sw + sgap) {
          b.add(upPlane(band, sw, [x, Y, z]), mat);
        }
      }
    });
  });
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
  return districtAt(ix, iz);
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
  const spacing = 22;
  const BACK = 0.9; // 연석에서 인도 안쪽으로

  // 격자선이 아니라 **연석**에서 잰다. 도로가 비대칭인 구간 경계에서
  // 격자선 기준으로 놓으면 한쪽 가로등이 차도 위에 선다.
  roads().forEach((r, bi) => {
    const sides = [
      { at: r.lo - BACK, dir: 1 },  // 낮은 쪽 인도 — 팔은 도로(+) 쪽으로
      { at: r.hi + BACK, dir: -1 },
    ];
    for (let t = -CITY_HALF + spacing / 2; t < CITY_HALF; t += spacing) {
      for (const sd of sides) {
        // X 방향 도로: 등은 (t, sd.at) 에 서고 팔은 z 방향으로 뻗는다
        if (roadOpenZ(bi, t) && !onIntersection(t, sd.at)) streetLamp(b, mats, pools, t, sd.at, 0, sd.dir);
        // Z 방향 도로
        if (roadOpen(bi, t) && !onIntersection(sd.at, t)) streetLamp(b, mats, pools, sd.at, t, sd.dir, 0);
      }
    }
  });
}

// ── 신호등 ─────────────────────────────────────────────────────────────────

function trafficLights(b, mats, rng) {
  const H = 5.4;
  const BACK = 1.2; // 연석에서 인도 안쪽으로

  roads().forEach((rx, xi) => {
    if (Math.abs(rx.mid) > CITY_HALF) return;
    roads().forEach((rz, zi) => {
      if (Math.abs(rz.mid) > CITY_HALF) return;
      if (!roadOpen(xi, rz.mid) || !roadOpenZ(zi, rx.mid)) return;
      // 교차로 네 귀퉁이 — 연석 안쪽으로 물러선 자리
      for (const [x, sx] of [[rx.lo - BACK, -1], [rx.hi + BACK, 1]]) {
        for (const [z, sz] of [[rz.lo - BACK, -1], [rz.hi + BACK, 1]]) {
          b.cylinder(0.09, 0.11, H, [x, H / 2 + CURB_HEIGHT, z], mats.metalMat, 6);
          b.box(0.26, 0.72, 0.22, [x, H + CURB_HEIGHT - 0.4, z], mats.frameMat);

          // 켜진 등 하나. 교차로마다 색이 달라야 정지된 사진처럼 보이지 않는다.
          const r = rng.next();
          const lit = r < 0.55 ? neon(NEON.green) : r < 0.72 ? neon(NEON.amber) : neon(NEON.pink);
          const dy = r < 0.55 ? 0.62 : r < 0.72 ? 0.4 : 0.18;
          b.sphere(0.085, [x, H + CURB_HEIGHT - dy, z + sz * 0.12], lit);
        }
      }
    });
  });
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
