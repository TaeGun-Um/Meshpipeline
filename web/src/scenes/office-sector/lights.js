// 조명 — 이 층에서 조명은 장식이 아니라 건축이다.
//
// 기본 상태가 지진 뒤의 정전이라 하늘빛이 없다 (story.md 4장). **보이는 모든
// 밝기는 우리가 놓은 것**이고, 그래서 "어디를 밝힐지" 가 곧 "어디를 보게
// 할지" 다 (facility.md 3장).
//
// ── 짝으로 둔다 ────────────────────────────────────────────────────────────
// 발광 재질은 래스터라이저에서 주변을 밝히지 않는다 (lessons.md 3.1).
// 형광등 패널만 놓으면 방은 여전히 캄캄하다. 그래서 조각마다 둘을 낸다.
//
//   패널  보이는 것 — 발광 판 + 반사갓
//   광원  밝히는 것 — 굽거나(bake.js) 실시간 PointLight
//
// ── 계획을 먼저 낸다 ───────────────────────────────────────────────────────
// `lightPlan()` 은 **좌표와 세기만** 돌려준다. 그 하나를 패널·굽기·실시간
// 광원이 나눠 쓴다. 처음에는 등과 광원을 각자 계산했는데, 등은 4.8m 간격이고
// 광원은 `면적/60` 이라 22.8m 복도가 광원 하나를 받아 새카맸다 —
// **"짝으로 둔다" 를 스스로 어긴 것**이다 (status.md 4장 3번).
//
// ── 개수는 밀도에서 나온다 ─────────────────────────────────────────────────
// `rng.int(2,4)` 같은 고정 개수를 쓰면 18m 복도와 3m 방이 같은 수를 받는다
// (lessons.md 3.4). 둘 다 **간격**으로 뽑는다.
import * as THREE from 'three';
import { MeshBuilder } from '../../core/builder.js';
import { CELLS, W } from './layout.js';

// 칸 종류별 조명 성격. 빠지면 던진다 — 새 종류를 넣고 조명을 잊으면
// 그 방은 캄캄한 상자가 된다.
//
//   pitch  등(패널) 간격      lit  광원 간격
//   power  세기. **칸델라**다. 처음에 2.6 같은 값을 썼더니 (도시의 방향광 세기를
//          그대로 옮긴 것) 3m 아래 바닥에서 1/9 로 떨어져 방이 통째로 검었다.
//          점광원은 거리 제곱으로 죽으므로 자릿수가 다르다.
const LIT = {
  // lit 6.0 -> 5.0 (2026-08-05 플라자 축소): 12.6x10 에서 6.0 간격은 광원이
  // 2개뿐이라 홀이 카페테리아에 밝기로 밀렸다 — 위계 검사가 잡았다.
  plaza: { pitch: 3.6, lit: 5.0, lamp: 'lamp', power: 60, range: 22, warm: 0xdfe8ff },
  // **복도는 어두워야 한다.** 문서 1장에 "어두운 곳이 있어야 밝은 곳이 밝다"
  // 라고 써 놓고 첫 판에서는 복도가 플라자만큼 밝았다. 지나가는 곳이다.
  corridor: { pitch: 4.8, lit: 7.5, lamp: 'lamp', power: 7, range: 8, warm: 0xc8d6ea },
  room: { pitch: 3.2, lit: 6.0, lamp: 'lamp', power: 20, range: 13, warm: 0xe6ecf5 },
  cafeteria: { pitch: 3.0, lit: 5.5, lamp: 'lampWarm', power: 26, range: 15, warm: 0xffdcae },
  server: { pitch: 3.4, lit: 6.0, lamp: 'lampCold', power: 17, range: 12, warm: 0xa8ccff },
  // 관제실 — 서버실보다 밝고 방보다 차다. 모니터를 보는 방이다
  control: { pitch: 3.2, lit: 6.0, lamp: 'lampCold', power: 19, range: 12, warm: 0xbdd4f2 },
  // 주방 — 조리대가 밝아야 한다. 카페테리아보다 희다 (위생 조명)
  kitchen: { pitch: 2.8, lit: 5.0, lamp: 'lamp', power: 24, range: 13, warm: 0xeef2f8 },
};

const spec = (kind) => {
  const s = LIT[kind];
  if (!s) throw new Error(`조명 표에 '${kind}' 가 없다 — lights.LIT 에 추가한다`);
  return s;
};

// 간격 pitch 로 [lo, hi] 를 나눈 중심들. 최소 하나는 나온다.
function seats(lo, hi, pitch) {
  const n = Math.max(1, Math.round((hi - lo) / pitch));
  const out = [];
  for (let i = 0; i < n; i++) out.push(lo + ((hi - lo) * (i + 0.5)) / n);
  return out;
}

// ── 계획 ───────────────────────────────────────────────────────────────────
//
// 이 층의 모든 등과 광원의 자리. 지오메트리도 THREE 객체도 안 만든다.
export function lightPlan() {
  const fixtures = [];
  const emitters = [];
  const byCell = {};

  for (const c of CELLS) {
    const s = spec(c.kind);

    // 계단실 — 천장이 없다(위로 뚫린 샤프트, shell.buildCeilings). 천장등을
    // 달면 허공에 뜨므로 **동쪽 벽의 스콘스 둘**로 간다. 등과 광원이 같은
    // 좌표에서 나오는 규칙은 그대로다.
    if (c.use === 'stair') {
      const col = new THREE.Color(s.warm);
      let n = 0;
      for (const z of seats(c.z0 + 0.8, c.z1 - 0.8, 2.6)) {
        fixtures.push({ x: c.x1 - 0.14, y: 2.3, z, lamp: 'sconce', cell: c.id });
        emitters.push({
          x: c.x1 - 0.3, y: 2.3, z, cell: c.id,
          power: 10, range: 7, hex: s.warm, r: col.r, g: col.g, b: col.b,
        });
        n++;
      }
      byCell[c.id] = { fixtures: n, lights: n, power: 10, area: (c.x1 - c.x0) * (c.z1 - c.z0) };
      continue;
    }

    const xs = seats(c.x0 + 0.6, c.x1 - 0.6, s.pitch);
    const zs = seats(c.z0 + 0.6, c.z1 - 0.6, s.pitch);
    const y = c.h - 0.04;
    for (const x of xs) for (const z of zs) fixtures.push({ x, y, z, lamp: s.lamp, cell: c.id });

    // 광원 색은 **선형**으로 들고 다닌다. 굽는 쪽이 정점 컬러에 그대로 쓰고,
    // 정점 컬러는 three 에서 작업 색공간(선형)으로 해석되기 때문이다.
    // THREE.Color(0x...) 가 sRGB→선형 변환을 해 준다.
    const col = new THREE.Color(s.warm);
    let n = 0;
    for (const x of seats(c.x0 + 1.2, c.x1 - 1.2, s.lit)) {
      for (const z of seats(c.z0 + 1.2, c.z1 - 1.2, s.lit)) {
        emitters.push({
          x,
          // **등판 바로 밑이다.** 실시간 광원이던 시절에는 등 지오메트리 속에
          // 광원이 박히는 것을 피하려고 0.35m 내려 달았는데, 굽기로 바꾸고 나니
          // 그 0.35m 가 **천장 밑 설비를 통째로 그늘에 넣었다** — 덕트·케이블
          // 트레이·스프링클러가 전부 등보다 위라 직사광을 0 으로 받았다.
          // 등은 아래를 보는 면이므로 그 면의 높이에 있어야 맞다.
          y: c.h - 0.08,
          z,
          cell: c.id,
          power: s.power,
          range: s.range,
          hex: s.warm,
          r: col.r,
          g: col.g,
          b: col.b,
        });
        n++;
      }
    }

    byCell[c.id] = {
      fixtures: xs.length * zs.length,
      lights: n,
      power: s.power,
      area: (c.x1 - c.x0) * (c.z1 - c.z0),
    };
  }

  return { fixtures, emitters, byCell };
}

// ── 보이는 것 ──────────────────────────────────────────────────────────────

export function createFixtures(scene, M, plan) {
  const b = new MeshBuilder('Fixtures', { castShadow: false });
  let cur = null;
  for (const f of plan.fixtures) {
    if (f.cell !== cur) {
      if (cur) b.endMark();
      b.mark('fixture', `lamp:${f.cell}`);
      cur = f.cell;
    }
    if (f.lamp === 'sconce') {
      // 계단실 벽 등 — 브래킷 + 서쪽을 보는 발광판 (동쪽 벽 전용)
      b.box(0.09, 0.24, 0.14, [f.x, f.y, f.z], M.steel, 0);
      b.box(0.02, 0.2, 0.11, [f.x - 0.055, f.y, f.z], M.lamp, 0);
      continue;
    }
    // 반사갓 — 등만 있으면 천장에 사각형을 그려 넣은 것으로 보인다
    b.box(W.lamp[0] + 0.1, 0.07, W.lamp[1] + 0.1, [f.x, f.y + 0.03, f.z], M.steel, 0);
    b.box(W.lamp[0], 0.02, W.lamp[1], [f.x, f.y - 0.02, f.z], M[f.lamp], 0);
  }
  if (cur) b.endMark();
  return b.build(scene);
}

// ── 밝히는 것 (실시간 경로) ────────────────────────────────────────────────
//
// 굽기를 끄면 이쪽이 돈다. 40개가 포워드 렌더링으로 픽셀마다 도는 비용이
// 정확히 굽기를 만든 이유다 — A/B 로 비교하려고 남겨 둔다 (bake.BAKED).
export function createRealLights(scene, plan) {
  for (const e of plan.emitters) {
    const L = new THREE.PointLight(e.hex, e.power, e.range, 1.8);
    L.position.set(e.x, e.y, e.z);
    // **그림자는 안 켠다.** 광원 하나당 큐브맵 여섯 장이라 스무 개면
    // 프레임당 120번 렌더다.
    scene.add(L);
  }
  return plan.emitters.length;
}

// ── 바탕 ───────────────────────────────────────────────────────────────────
//
// baked 면 정점 컬러가 조도를 통째로 들고 있으므로 흰 환경광 하나로 그것을
// 화면에 올린다. 반구광은 **거의 0 으로 낮춰** 남긴다 — 노말맵이 완전히
// 죽는 것을 막는 최소한이고, 세게 주면 구운 위계가 균일하게 씻긴다.
//
// **세게 주면 안 된다.** 어두운 실내의 인상은 "빛이 닿는 곳과 안 닿는 곳" 의
// 차이에서 나온다.
export function createAmbient(scene, baked) {
  if (baked) {
    // 3.14 는 three 의 램버트 BRDF 가 1/π 를 곱하는 것을 되돌린다 —
    // 이 값이어야 화면 색이 구운 값 x 알베도 와 같아진다.
    scene.add(new THREE.AmbientLight(0xffffff, Math.PI));
    scene.add(new THREE.HemisphereLight(0x8ea0ba, 0x2e2b26, 0.08));
    return;
  }
  // 바닥 반사를 흉내내는 최소한의 환경광. 없으면 천장을 향한 면 말고는
  // 전부 새카맣다 — 도시의 반구광과 같은 자리다.
  scene.add(new THREE.HemisphereLight(0x8ea0ba, 0x2e2b26, 0.26));
}
