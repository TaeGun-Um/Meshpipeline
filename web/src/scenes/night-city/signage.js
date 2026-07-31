// 간판 — 가로 배너 · 세로 간판 · 대형 광고판.
//
// towers.js 는 간판을 직접 만들지 않고 "여기에 이런 간판" 요청 목록만 남긴다.
// 여기서 한 번에 만드는 이유는 간판이 배색 조합당 텍스처 한 장을 공유해야 하기
// 때문이다. 요청마다 굽으면 수백 장이 된다.
//
// 세 종류 모두 같은 구조다: 발광 앞면 + 어두운 뒷판 + 벽 브래킷.
// 뒷판이 없으면 뒤에서 봤을 때 발광면이 그대로 보여 종이 조각처럼 얇아 보인다.
import * as THREE from 'three';
import { MeshBuilder } from '../../core/builder.js';
import { outward, faceAnchor, alongZ } from '../../core/boxfaces.js';
import { SIGN_SCHEMES, rgb01 } from '../../shared/neon.js';

const STANDOFF = 0.3;

// ── 간판이 늘어난다 (사용자 지적) ──────────────────────────────────────────
//
// "간판이 부자연스럽게 너무 늘어나서 붙어있는 경우도 있고"
// "사람모양 간판도 (…) 심지어 늘어난 상태로 돌려쓰기 하고 있는것으로 보임"
//
// 맞았다. 원인은 하나다. **간판 텍스처는 비율이 고정인데 판의 크기는 파사드가
// 정했다.** 배너 텍스처는 512x128(4:1)인데, 55m 짜리 병합 파사드에 높이 2m
// 배너를 걸면 27:1 이 되어 가로로 여섯 배 늘어난다. 인물 광고판(1:2)도
// 타워 면 비율에 맞추느라 얼굴이 길쭉해졌다.
//
// ── 왜 이 값을 여기 두는가 ─────────────────────────────────────────────────
// 비율은 `shared/glyphs.js` 의 캔버스 크기가 정한다. 그걸 여섯 생산자
// (bazaar·market·towers·corpo·program·landmark)가 각자 알고 지키게 하면
// 반드시 어긋난다 — 이 프로젝트에서 같은 값을 두 곳에서 계산해 스무 번 틀렸다
// (docs/status.md 2.1). 그래서 **간판을 만드는 이 파일이 혼자 안다.**
//
// 생산자는 "이 자리에 이만한 크기로" 만 말하고, 실제 폭·높이는 여기서 비율에
// 맞춰 다시 계산한다.
const ASPECT = {
  banner: 4.0,       // 512x128
  blade: 1 / 6,      // 128x768
  billboard: 1.0,    // 512x512
  mega: 0.5,         // 512x1024 — 인물
  strip: 16.0,       // 1024x64  — 긴 파사드는 이 유형이 맡는다
  box: 1.0,          // 256x256
  cloth: 0.25,       // 128x512
};

// 어느 변을 믿을 것인가. 파사드가 실제로 정해 주는 쪽이다.
//   가로로 붙는 것  띠의 **높이**가 정해져 있다 (층 사이, 처마 밑)
//   세로로 붙는 것  **길이**가 정해져 있다 (몇 개 층을 지나가나)
const DRIVEN_BY_HEIGHT = new Set(['banner', 'billboard', 'mega', 'strip', 'box']);

// 요청한 크기를 비율에 맞춘다. 늘리지 않고 **한 변을 다시 구한다.**
function fitAspect(req, faceW) {
  const a = ASPECT[req.kind];
  if (!a) throw new Error(`간판 종류 '${req.kind}' 의 비율이 ASPECT 에 없다`);
  let { w, h } = req;
  if (DRIVEN_BY_HEIGHT.has(req.kind)) {
    w = h * a;
    // 면보다 넓으면 폭이 아니라 **높이를 줄인다.** 폭만 자르면 다시 늘어난다
    if (w > faceW * 0.94) { w = faceW * 0.94; h = w / a; }
  } else {
    h = w / a;
  }
  return { w, h };
}

// ── 파사드 배치 대장 (사용자 지적) ─────────────────────────────────────────
//
// "측면 간판도 다 너무 일렬로 붙어있고, 간판이랑 겹치기도 하고"
//
// 원인 하나가 셋을 다 설명했다. **간판 요청에 면 위 가로 위치가 없었다.**
// frameOf 가 faceAnchor(면의 중심)만 썼으므로 한 면의 모든 간판이 가운데
// 한 줄로 쌓였고, y 가 가까우면 그대로 겹쳤다.
//
// 지면에는 siteplan.js 가 있다 — 놓기 전에 "그 자리에 뭐가 있나" 를 묻는다.
// **파사드에는 그게 없었다.** 그래서 같은 일을 면에서 한다.
//
// 요청은 side·y·w·h 만 준다. 가로 위치는 **여기서 정한다** — 생산자
// (bazaar·market·towers·corpo·program·streetlife) 가 여섯이라 각자 정하게
// 하면 서로를 모른 채 같은 자리를 고른다. 그게 지금 상태다.
function layoutSigns(reqs) {
  // 같은 건물의 같은 면끼리 묶는다
  const groups = new Map();
  for (const q of reqs) {
    const r = q.rect;
    const key = `${r.x0.toFixed(1)},${r.z0.toFixed(1)},${r.x1.toFixed(1)},${r.z1.toFixed(1)}|${q.side}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(q);
  }

  const out = [];
  for (const [, list] of groups) {
    const r = list[0].rect;
    const az = alongZ(list[0].side);
    const fw = az ? r.z1 - r.z0 : r.x1 - r.x0;
    const placed = [];

    // ── 간판만 아는 대장은 반쪽이다 (사용자 지적) ────────────────────────
    //
    // "번화가 건물 타입의 경우 난간과 간판과 세로간판, 그리고 창문같은게
    //  겹쳐져 있는 경우도 있음"
    //
    // 맞았다. 이 대장은 **간판끼리만** 겹침을 봤다. 외부 복도와 난간, 층
    // 슬래브는 파사드에서 자리를 차지하는데 대장에 없으니 서로를 모른다.
    // 지면에서 겪은 것과 똑같은 문제다 — siteplan 이 생기기 전 인도가 그랬다.
    //
    // 그래서 **자리만 차지하고 그려지지는 않는 항목**을 같은 대장에 넣는다
    // (`block: true`). 생산자가 "여기는 이미 내 난간이 지나간다" 고 신고하면
    // 간판이 그 자리를 피한다.
    //
    // 예약은 **맨 먼저** 처리한다. 크기 순으로 섞으면 큰 간판이 난간 자리를
    // 먼저 차지해 버린다 — 예약은 협상 대상이 아니다.
    const drawn = [];
    for (const q of list) {
      if (!q.block) { drawn.push(q); continue; }
      placed.push({ u: 0, w: Math.max(q.w, fw), h: q.h, cy: q.y + q.h / 2, blk: true });
    }

    // **자리를 잡기 전에 비율부터 맞춘다.** 늘어난 크기로 자리를 잡으면
    // 그 자리에 늘어난 판이 놓일 뿐이다.
    for (const q of drawn) { const f = fitAspect(q, fw); q.w = f.w; q.h = f.h; }

    // 큰 것부터 자리를 잡는다. 작은 것이 먼저 좋은 자리를 차지하면
    // 큰 것이 갈 데가 없어져 통째로 버려진다.
    drawn.sort((p, q2) => q2.w * q2.h - p.w * p.h);

    for (const q of drawn) {
      const w = Math.min(q.w, fw * 0.94);
      const half = (fw - w) / 2;
      // 후보 자리 — 요청한 u 가 있으면 거기부터, 없으면 가운데부터 좌우로
      const cands = [q.u ?? 0];
      for (let k = 1; k <= 6 && half > 0.2; k++) {
        const t = (k / 6) * half;
        cands.push(t, -t);
      }
      let ok = null;
      for (const c of cands) {
        const u = Math.max(-half, Math.min(half, c));
        // 여유는 상대에 따라 다르다.
        //   간판끼리   0.35m — 두 장이 붙어 보이면 둘 다 안 읽힌다
        //   예약 상대  0.05m — 난간은 벽에 붙어 있고 간판은 0.36m 나와 있어
        //              스치듯 지나가도 관통이 아니다. 여기에 같은 여유를
        //              쓰면 층 사이 빈 띠가 통째로 사라진다 (실제로 간판이
        //              1,127장에서 498장으로 줄었다).
        const hit = placed.some((p) => {
          const gap = p.blk ? 0.05 : 0.35;
          return Math.abs(p.u - u) < (p.w + w) / 2 + gap &&
            Math.abs(p.cy - (q.y + q.h / 2)) < (p.h + q.h) / 2 + gap;
        });
        if (!hit) { ok = u; break; }
      }
      // 자리가 없으면 **버린다.** 겹쳐 놓느니 없는 것이 낫다 —
      // 겹친 간판은 둘 다 안 읽힌다.
      if (ok === null) continue;
      placed.push({ u: ok, w, h: q.h, cy: q.y + q.h / 2 });
      out.push({ ...q, u: ok, w });
    }
  }
  return out;
}

// 간판이 붙는 면의 좌표 틀
function frameOf(req) {
  const a = faceAnchor(req.rect, req.side);
  const o = outward(req.side);
  const az = alongZ(req.side);
  // 면 위 가로 위치. layoutSigns 가 정해 준다.
  const u = req.u || 0;
  return {
    x: a.x + (az ? 0 : u),
    z: a.z + (az ? u : 0),
    ox: o.ox,
    oz: o.oz,
    // 간판 폭이 뻗는 축
    widthOnZ: az,
    // 벽면과 평행한 평면의 Y 회전
    yaw: req.side === 'px' ? Math.PI / 2 : req.side === 'nx' ? -Math.PI / 2 : req.side === 'pz' ? 0 : Math.PI,
  };
}

// 벽에 평행하게 붙는 발광 판 (배너 · 광고판)
function flatSign(b, req, mats) {
  const f = frameOf(req);
  const mat = mats.signMats[req.kind][req.scheme];
  const cy = req.y + req.h / 2;

  const front = new THREE.PlaneGeometry(req.w, req.h);
  front.rotateY(f.yaw);
  front.translate(f.x + f.ox * (STANDOFF + 0.06), cy, f.z + f.oz * (STANDOFF + 0.06));
  b.add(front, mat);

  // 뒷판 (두께)
  b.box(
    f.widthOnZ ? STANDOFF : req.w,
    req.h,
    f.widthOnZ ? req.w : STANDOFF,
    [f.x + f.ox * (STANDOFF / 2), cy, f.z + f.oz * (STANDOFF / 2)],
    mats.frameMat
  );
}

// 벽에서 직각으로 튀어나오는 세로 간판. 양면 발광.
//
// 거리의 깊이를 만드는 것이 이 형태다 — 벽에 붙은 판은 정면에서만 보이지만,
// 튀어나온 간판은 측면에서도 줄줄이 보여 거리에 리듬이 생긴다.
function bladeSign(b, req, mats) {
  const f = frameOf(req);
  const mat = mats.signMats.blade[req.scheme];
  const out = req.w; // 벽에서 튀어나오는 길이 = 간판 폭
  // ── 벽에서 얼마나 떨어져 매다는가 ──────────────────────────────────────
  // 기본은 벽에 붙인다. 그런데 적층 상가는 층마다 외부 복도가 1.5m 나와
  // 있어서, 벽에 붙인 세로 간판이 **복도와 난간을 관통한다** (사용자 지적).
  // 그런 건물은 생산자가 복도 폭만큼 밀어서 요청한다.
  const off = req.standoff ?? 0.15;
  const cx = f.x + f.ox * (out / 2 + off);
  const cz = f.z + f.oz * (out / 2 + off);
  const cy = req.y + req.h / 2;

  // 양면 — 벽에 수직이므로 앞면 법선이 벽 방향에서 90도 돌아간다
  for (const s of [-1, 1]) {
    const g = new THREE.PlaneGeometry(out, req.h);
    g.rotateY(f.yaw + s * (Math.PI / 2));
    g.translate(cx + (f.widthOnZ ? 0 : s * 0.07), cy, cz + (f.widthOnZ ? s * 0.07 : 0));
    b.add(g, mat);
  }

  // 심재 (두께)
  b.box(f.ox ? out : 0.12, req.h, f.oz ? out : 0.12, [cx, cy, cz], mats.frameMat);

  // 벽 브래킷 둘 — 벽에서 간판까지 실제로 이어져야 한다.
  // 떨어뜨려 매단 간판을 짧은 브래킷으로 두면 **간판이 허공에 뜬다.**
  for (const t of [0.2, 0.8]) {
    b.box(
      f.ox ? off : 0.06,
      0.06,
      f.oz ? off : 0.06,
      [f.x + f.ox * (off / 2), req.y + req.h * t, f.z + f.oz * (off / 2)],
      mats.metalMat
    );
  }
}

// ── 상자간판 ───────────────────────────────────────────────────────────────
//
// 벽에서 튀어나온 입방체. **세 면(정면·좌·우)에 같은 얼굴**이 붙는다.
// 벽에 붙은 판은 정면에서만 읽히고 세로 간판은 옆에서만 읽히는데, 이건 둘 다
// 된다 — 그래서 모퉁이와 출입구 위에 어울린다.
function boxSign(b, req, mats) {
  const f = frameOf(req);
  const mat = mats.signMats.box[req.scheme];
  const D = Math.min(req.w * 0.55, 1.1); // 튀어나오는 깊이
  const cy = req.y + req.h / 2;
  const cx = f.x + f.ox * (D / 2 + 0.1);
  const cz = f.z + f.oz * (D / 2 + 0.1);

  // 몸통 — 어두운 상자. 발광면이 여기 붙는다
  b.box(f.widthOnZ ? D : req.w, req.h, f.widthOnZ ? req.w : D, [cx, cy, cz], mats.frameMat);

  // 정면
  const front = new THREE.PlaneGeometry(req.w, req.h);
  front.rotateY(f.yaw);
  front.translate(f.x + f.ox * (D + 0.14), cy, f.z + f.oz * (D + 0.14));
  b.add(front, mat);

  // 양 옆 — 깊이만큼. 옆에서 걸어오는 사람이 읽는 면이다
  for (const s of [-1, 1]) {
    const g = new THREE.PlaneGeometry(D, req.h);
    g.rotateY(f.yaw + s * (Math.PI / 2));
    g.translate(
      cx + (f.widthOnZ ? 0 : s * (req.w / 2 + 0.04)),
      cy,
      cz + (f.widthOnZ ? s * (req.w / 2 + 0.04) : 0)
    );
    b.add(g, mat);
  }

  // 받침 브래킷 — 무거운 것이 매달렸다는 표시
  for (const t of [0.12, 0.88]) {
    b.box(
      f.ox ? D + 0.2 : 0.08, 0.09, f.oz ? D + 0.2 : 0.08,
      [f.x + f.ox * (D / 2), req.y + req.h * t, f.z + f.oz * (D / 2)],
      mats.metalMat
    );
  }
}

// ── 천 배너 ────────────────────────────────────────────────────────────────
//
// 봉에 매달린 세로 천. 이 도시에서 **스스로 빛나지 않는 유일한 간판**이다 —
// 뒤에서 비추는 것이라 어둡고, 그래서 네온 사이에서 오히려 눈에 띈다.
// 아래가 갈라져 있어 천이라는 것이 읽힌다.
function clothSign(b, req, mats) {
  const f = frameOf(req);
  const mat = mats.signMats.cloth[req.scheme];
  const cy = req.y + req.h / 2;
  const d = 0.5; // 벽에서 떨어진 거리 — 천이라 벽에 붙지 않는다

  const g = new THREE.PlaneGeometry(req.w, req.h);
  g.rotateY(f.yaw);
  g.translate(f.x + f.ox * d, cy, f.z + f.oz * d);
  b.add(g, mat);
  // 뒷면 — 천은 양면이다
  const g2 = new THREE.PlaneGeometry(req.w, req.h);
  g2.rotateY(f.yaw + Math.PI);
  g2.translate(f.x + f.ox * (d - 0.03), cy, f.z + f.oz * (d - 0.03));
  b.add(g2, mat);

  // 위 봉 — 벽에서 내밀어 천을 건다
  b.box(
    f.widthOnZ ? 0.07 : req.w + 0.5, 0.07, f.widthOnZ ? req.w + 0.5 : 0.07,
    [f.x + f.ox * d, req.y + req.h, f.z + f.oz * d], mats.metalMat
  );
  for (const s of [-1, 1]) {
    b.box(
      f.ox ? d : 0.06, 0.06, f.oz ? d : 0.06,
      [f.x + f.ox * (d / 2), req.y + req.h, f.z + f.oz * (d / 2)],
      mats.metalMat
    );
    void s;
  }
  // 아래 추 — 천이 흔들리지 않게 다는 것. 없으면 판때기다
  b.box(
    f.widthOnZ ? 0.06 : req.w * 0.9, 0.1, f.widthOnZ ? req.w * 0.9 : 0.06,
    [f.x + f.ox * d, req.y, f.z + f.oz * d], mats.metalMat
  );
}

// 간판이 주변을 물들이는 자리. 발광 표면은 실제로 아무것도 밝히지 않으므로
// (shared/lightpool.js 주석 참고) 벽과 바닥에 가산합성 웅덩이를 직접 깔아 준다.
// 간판보다 넓게, 훨씬 어둡게 — 이게 없으면 간판만 공중에 떠 있다.
function signPools(pools, req) {
  const f = frameOf(req);
  const scheme = SIGN_SCHEMES[req.scheme];
  const blade = req.kind === 'blade';

  // 벽 얼룩
  pools.push({
    kind: 'wall',
    x: f.x + f.ox * 0.12,
    y: req.y + req.h / 2,
    z: f.z + f.oz * 0.12,
    w: req.w * (blade ? 5.0 : 2.1),
    h: req.h * (blade ? 1.3 : 2.2),
    yaw: f.yaw,
    tint: rgb01(scheme.glyph, 0.55),
  });

  // 낮은 간판만 바닥을 물들인다. 80m 위 광고판이 노면을 비추지는 않는다.
  if (req.y < 22) {
    pools.push({
      kind: 'floor',
      x: f.x + f.ox * 3.2,
      y: 0.22,
      z: f.z + f.oz * 3.2,
      rx: f.widthOnZ ? 4.6 : req.w * 1.1,
      rz: f.widthOnZ ? req.w * 1.1 : 4.6,
      tint: rgb01(scheme.glyph, 0.4),
    });
  }
}

const SHAPES = {
  banner: flatSign,
  billboard: flatSign,
  mega: flatSign,
  strip: flatSign,
  blade: bladeSign,
  box: boxSign,
  cloth: clothSign,
};

export function createSignage(scene, signs, mats) {
  // 간판은 그림자를 받지 않는다 — 발광면에 그림자가 지면 형광등에 그늘이 진
  // 꼴이라 어색하고, 그림자맵 예산도 아깝다.
  const b = new MeshBuilder('Signage', { castShadow: false, receiveShadow: false });
  const pools = [];

  // **놓기 전에 자리를 정리한다.** 이 한 줄이 없어서 간판이 겹쳤다.
  const laid = layoutSigns(signs);

  let i = 0;
  for (const req of laid) {
    // 간판마다 표시를 건다. 검사가 보는 것은 "이 간판이 건물에 붙어 있나" 다 —
    // 벽감 깊이를 빼먹어 세로 간판이 허공에 1.3m 떠 있던 적이 있다.
    b.mark('sign', `sign#${i++}`, { kind: req.kind, side: req.side });
    // 종류 -> 형태. 표로 두면 새 종류를 더할 때 **빠뜨리면 터진다** —
    // `else flatSign` 로 두면 새 종류가 조용히 납작한 판이 된다.
    const make = SHAPES[req.kind];
    if (!make) throw new Error(`간판 종류 '${req.kind}' 의 형태가 SHAPES 에 없다`);
    make(b, req, mats);
    signPools(pools, req);
  }

  return { group: b.build(scene), pools, count: laid.length, dropped: signs.length - laid.length };
}
