// 블록 용도 — 타워가 아닌 블록들.
//
// ── 왜 필요한가 ────────────────────────────────────────────────────────────
// 모든 블록에 타워를 세우면 도시가 균일해진다. 실제 도시에는 공사장·광장·주차장이
// 섞여 있고, **그 빈 곳이 있어야 타워가 높아 보인다.** 화면에 낮은 곳이 있어야
// 높은 곳이 높게 읽힌다.
//
// 지상 카메라에서는 효과가 더 크다. 사방이 벽이면 어디에 있는지 알 수 없지만,
// 공사장 펜스나 광장이 하나 있으면 그게 기준점이 된다.
import { MeshBuilder } from '../../core/builder.js';
import { autoBox, lathe } from '../../core/profile.js';
import { upPlane, downPlane } from '../../core/boxfaces.js';
import { BLOCK_SIZE, CURB_HEIGHT, PIT_INSET } from './layout.js';
import { NEON, rgb01 } from '../../shared/neon.js';
import { neon, neonSoft } from '../../shared/masters.js';

const Y = CURB_HEIGHT;

// ── 공사장 ─────────────────────────────────────────────────────────────────
//
// 구성 요소가 전부 "임시" 라는 신호를 준다: 가설 펜스, 굴착 구덩이, 타워크레인,
// 비계, 자재 더미, 투광등. 특히 **크레인**은 실루엣이 독특해서 멀리서도 공사장인
// 것을 알려 준다.
function constructionSite(b, cx, cz, rng, mats, pools) {
  const half = BLOCK_SIZE / 2 - PIT_INSET;

  // 가설 펜스 — 블록 둘레. 파란 함석판에 세로 리브.
  const FH = 2.4;
  for (const s of [-1, 1]) {
    b.box(half * 2, FH, 0.12, [cx, Y + FH / 2, cz + s * half], mats.hoardingMat);
    b.box(0.12, FH, half * 2, [cx + s * half, Y + FH / 2, cz], mats.hoardingMat);
  }

  // 굴착 구덩이 — 어두운 바닥 + 흙벽
  const pit = half - 4;
  b.add(upPlane(pit * 2, pit * 2, [cx, -3.2, cz]), mats.pitMat);
  for (const s of [-1, 1]) {
    b.box(pit * 2, 3.4, 0.4, [cx, -1.6, cz + s * pit], mats.pitMat);
    b.box(0.4, 3.4, pit * 2, [cx + s * pit, -1.6, cz], mats.pitMat);
  }

  // 기초 기둥 — 구덩이에서 솟은 콘크리트 코어
  for (let i = 0; i < rng.int(4, 8); i++) {
    const px = cx + rng.range(-pit * 0.7, pit * 0.7);
    const pz = cz + rng.range(-pit * 0.7, pit * 0.7);
    const h = rng.range(4, 14);
    b.box(rng.range(1.6, 3.0), h, rng.range(1.6, 3.0), [px, -3.2 + h / 2, pz], mats.wetConcreteMat);
  }

  // 타워크레인 — 마스트 + 지브 + 카운터지브. 격자 트러스는 얇은 박스 반복으로.
  const mastH = rng.range(48, 86);
  const mx = cx + rng.range(-8, 8);
  const mz = cz + rng.range(-8, 8);
  const MW = 1.5;
  for (const dx of [-1, 1]) {
    for (const dz of [-1, 1]) {
      b.box(0.22, mastH, 0.22, [mx + dx * MW, Y + mastH / 2, mz + dz * MW], mats.craneMat);
    }
  }
  // 가로 보강재
  for (let y = 3; y < mastH; y += 3.2) {
    b.box(MW * 2, 0.14, 0.14, [mx, Y + y, mz - MW], mats.craneMat);
    b.box(MW * 2, 0.14, 0.14, [mx, Y + y, mz + MW], mats.craneMat);
    b.box(0.14, 0.14, MW * 2, [mx - MW, Y + y, mz], mats.craneMat);
    b.box(0.14, 0.14, MW * 2, [mx + MW, Y + y, mz], mats.craneMat);
  }
  // 지브 (긴 팔) + 카운터지브
  const jib = rng.range(28, 44);
  const dir = rng.chance(0.5);
  const jx = dir ? 1 : 0;
  const jz = dir ? 0 : 1;
  b.box(
    dir ? jib : 1.2, 1.2, dir ? 1.2 : jib,
    [mx + jx * jib * 0.5, Y + mastH + 1.4, mz + jz * jib * 0.5],
    mats.craneMat
  );
  b.box(
    dir ? 12 : 1.6, 1.6, dir ? 1.6 : 12,
    [mx - jx * 6, Y + mastH + 1.4, mz - jz * 6],
    mats.craneMat
  );
  // 운전실 + 항공등
  b.add(autoBox(1.8, 1.6, 1.8, [mx, Y + mastH + 3.2, mz], 0.05), mats.craneMat);
  b.sphere(0.45, [mx, Y + mastH + 4.6, mz], mats.beacons[0]);
  // 훅 — 지브 끝에서 늘어진 줄
  const hx = mx + jx * jib * 0.8;
  const hz = mz + jz * jib * 0.8;
  b.box(0.06, mastH * 0.5, 0.06, [hx, Y + mastH * 0.75, hz], mats.craneMat);

  // 자재 더미 + 컨테이너 사무실
  for (let i = 0; i < rng.int(3, 6); i++) {
    const px = cx + rng.range(-half * 0.8, half * 0.8);
    const pz = cz + rng.range(-half * 0.8, half * 0.8);
    if (rng.chance(0.5)) {
      // 컨테이너
      b.add(autoBox(6.1, 2.6, 2.44, [px, Y + 1.3, pz], 0.04), mats.rustMat);
    } else {
      // 파이프·철근 더미
      const n = rng.int(3, 6);
      for (let k = 0; k < n; k++) {
        b.cylinder(0.16, 0.16, rng.range(4, 9), [px, Y + 0.16 + k * 0.33, pz + k * 0.06], mats.craneMat, 6);
      }
    }
  }

  // 투광등 — 공사장의 유일한 빛이자, **밤 공사장이 도시에서 가장 밝은 곳**인 이유.
  // 처음에 3개를 약하게 뒀더니 현장이 통째로 안 보였다. 실제 야간 공사장은
  // 눈이 부실 정도로 밝고, 그 대비가 주변 어둠을 더 어둡게 만든다.
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 + 0.6;
    const px = cx + Math.cos(a) * half * 0.72;
    const pz = cz + Math.sin(a) * half * 0.72;
    const h = rng.range(10, 14);
    b.cylinder(0.14, 0.2, h, [px, Y + h / 2, pz], mats.craneMat, 6);
    // 등함 — 4연등
    for (let k = 0; k < 4; k++) {
      const ox = (k - 1.5) * 0.62;
      b.add(autoBox(0.56, 0.62, 0.3, [px + ox, Y + h, pz], 0.03), mats.metalMat);
      b.add(downPlane(0.48, 0.24, [px + ox, Y + h - 0.33, pz]), neon(NEON.cool));
    }
    pools.push({
      kind: 'floor', x: px, y: Y + 0.03, z: pz, rx: 19, rz: 19,
      tint: rgb01(NEON.cool, 0.95),
    });
  }

  // 펜스 위 경광등 — 붉은 점이 현장 윤곽을 그린다
  for (let t = -half + 4; t < half; t += 9) {
    for (const s of [-1, 1]) {
      b.sphere(0.16, [cx + t, Y + FH + 0.2, cz + s * half], neon(NEON.pink), 6, 4);
      b.sphere(0.16, [cx + s * half, Y + FH + 0.2, cz + t], neon(NEON.pink), 6, 4);
    }
  }
}

// ── 광장 ───────────────────────────────────────────────────────────────────
//
// 도시에 숨 쉴 곳. 열린 바닥 + 낮은 요소만 둔다 — 광장의 본질은 **비어 있음** 이라
// 여기에 높은 것을 세우면 광장이 아니라 그냥 또 다른 블록이 된다.
function plaza(b, cx, cz, rng, mats, pools) {
  const half = BLOCK_SIZE / 2 - 2;

  // 포장 — 인도와 다른 재질로 깔아야 광장으로 읽힌다
  b.add(upPlane(half * 2, half * 2, [cx, Y + 0.02, cz], [3.2, 3.2]), mats.plazaMat);

  // 중앙 조형물 — 회전체. 광장의 초점.
  const H = rng.range(7, 13);
  b.add(
    lathe(
      [[2.6, 0], [2.2, 0.5], [0.9, 1.2], [0.7, H * 0.55], [1.5, H * 0.78], [0.35, H]],
      18,
      [cx, Y, cz]
    ),
    mats.metalMat
  );
  // 조형물을 감는 발광 링
  for (let i = 1; i <= 4; i++) {
    const t = i / 5;
    b.cylinder(1.0 - t * 0.5, 1.0 - t * 0.5, 0.16, [cx, Y + H * t, cz], neon(NEON.cyan), 16);
  }
  pools.push({
    kind: 'floor', x: cx, y: Y + 0.04, z: cz, rx: 9, rz: 9,
    tint: rgb01(NEON.cyan, 0.4),
  });

  // 계단식 단 — 조형물 둘레
  for (let i = 0; i < 3; i++) {
    const r = 5.5 + i * 1.6;
    b.cylinder(r, r, 0.22, [cx, Y + 0.11 - i * 0.22, cz], mats.plazaStepMat, 20);
  }

  // 화단 + 벤치 — 둘레를 따라
  const N = 8;
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2 + 0.4;
    const r = half * 0.72;
    const px = cx + Math.cos(a) * r;
    const pz = cz + Math.sin(a) * r;
    if (i % 2 === 0) {
      b.box(3.4, 0.5, 1.4, [px, Y + 0.25, pz], mats.plazaStepMat);
      for (let k = 0; k < 3; k++) {
        b.sphere(
          rng.range(0.5, 0.85),
          [px + rng.range(-1.2, 1.2), Y + 0.9, pz + rng.range(-0.4, 0.4)],
          mats.foliageMat, 8, 6
        );
      }
    } else {
      // 벤치
      b.box(2.2, 0.1, 0.5, [px, Y + 0.44, pz], mats.metalMat);
      for (const s of [-0.9, 0.9]) {
        b.box(0.1, 0.44, 0.4, [px + s, Y + 0.22, pz], mats.metalMat);
      }
    }
  }

  // 대형 전광판 — 광장 한쪽. 높이 제한을 지키되 눈에 띄게.
  const sx = cx + (rng.chance(0.5) ? -1 : 1) * half * 0.8;
  const sz = cz + (rng.chance(0.5) ? -1 : 1) * half * 0.8;
  const SW = 9;
  const SH = 5.5;
  b.box(0.5, 4, 0.5, [sx, Y + 2, sz], mats.metalMat);
  b.add(
    autoBox(SW, SH, 0.4, [sx, Y + 4 + SH / 2, sz], 0.06),
    mats.signMats.billboard[rng.int(0, 5)]
  );
}

// ── 빈 대지 (주차장) ───────────────────────────────────────────────────────
function emptyLot(b, cx, cz, rng, mats) {
  const half = BLOCK_SIZE / 2 - 3;
  b.add(upPlane(half * 2, half * 2, [cx, Y + 0.02, cz], [6, 6]), mats.lotMat);

  // 철망 펜스 — 기둥만 세우고 면은 반투명 판 하나로 근사
  for (const s of [-1, 1]) {
    for (let t = -half; t <= half; t += 3.2) {
      b.cylinder(0.06, 0.06, 2.1, [cx + t, Y + 1.05, cz + s * half], mats.craneMat, 5);
      b.cylinder(0.06, 0.06, 2.1, [cx + s * half, Y + 1.05, cz + t], mats.craneMat, 5);
    }
  }

  // 버려진 것들
  for (let i = 0; i < rng.int(4, 9); i++) {
    const px = cx + rng.range(-half * 0.85, half * 0.85);
    const pz = cz + rng.range(-half * 0.85, half * 0.85);
    if (rng.chance(0.4)) {
      b.add(autoBox(6.1, 2.6, 2.44, [px, Y + 1.3, pz], 0.04), mats.rustMat);
    } else {
      b.add(
        autoBox(rng.range(1.2, 2.4), rng.range(0.8, 1.8), rng.range(1.2, 2.2),
        [px, Y + 0.6, pz], 0.04),
        mats.ductMat
      );
    }
  }
  // 한 귀퉁이의 드럼통 불 — 이 하나가 "사람이 있다" 를 만든다
  const fx = cx + rng.range(-half * 0.6, half * 0.6);
  const fz = cz + rng.range(-half * 0.6, half * 0.6);
  b.cylinder(0.45, 0.45, 0.9, [fx, Y + 0.45, fz], mats.rustMat, 10);
  b.add(upPlane(0.8, 0.8, [fx, Y + 0.92, fz]), neonSoft(NEON.amber));
}

// ── 진입점 ─────────────────────────────────────────────────────────────────

export function createPrograms(scene, rng, mats, blocks) {
  const b = new MeshBuilder('BlockPrograms');
  const pools = [];
  const tally = { construction: 0, plaza: 0, lot: 0 };

  for (const blk of blocks) {
    if (blk.program === 'construction') {
      constructionSite(b, blk.cx, blk.cz, rng, mats, pools);
      tally.construction++;
    } else if (blk.program === 'plaza') {
      plaza(b, blk.cx, blk.cz, rng, mats, pools);
      tally.plaza++;
    } else if (blk.program === 'lot') {
      emptyLot(b, blk.cx, blk.cz, rng, mats);
      tally.lot++;
    }
  }

  return { group: b.build(scene), pools, tally };
}
