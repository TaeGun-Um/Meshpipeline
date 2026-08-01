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
import { hash2 } from '../../core/textures.js';

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
// ── 무엇이 '같은 자리' 인가 — 벽이지, 요청자의 사각형이 아니다 ───────────────
//
// (사용자 지적: "뭔가 다시 간판이 겹치기 시작한거같으니, 상세히 확인해")
//
// 이 대장은 요청의 `rect` 로 묶고 있었다. 생산자가 전부 **건물 전체**를 넘기던
// 동안은 그게 곧 벽이라 맞았다. 그런데 1층 점포를 이으면서(#56) 베이마다 자기
// 조각 사각형을 넘기게 됐고, 그 순간 **한 벽이 그룹 여럿으로 쪼개져 서로를 못
// 보게 됐다.** 세로 간판(blade)과 옥상 광고도 원래 조각 사각형을 쓰고 있었다.
// 실측 결과 겹친 쌍 271.
//
// 조각으로 나눠 그리는 일은 앞으로도 는다. 그러니 묶는 기준을 **벽면의 세계
// 좌표**로 바꾼다 — 조각을 어떻게 나누든 같은 벽이면 같은 그룹이다. 자리도
// 세계 좌표로 잡고, 마지막에 각자의 앵커 기준 u 로 되돌려 준다.
//
// 이 프로젝트에서 스무 번 나온 결합 오류의 변종이다. 값을 두 곳에서 계산한
// 것이 아니라, **하나인 것(벽)을 여럿으로 쪼개 놓고 하나인 줄 알았다.**
// ── 간판이 벽에서 실제로 차지하는 것 ───────────────────────────────────────
//
// 벽면 그룹을 고치고 나서도 92 쌍이 남았고, **전부 blade·cloth·box** 였다.
// 그럴 만했다 — 대장은 모든 간판을 벽에 붙은 납작한 판으로 보는데, 일곱 종
// 가운데 셋은 **벽에서 튀어나온 덩어리**다.
//
// 특히 blade 는 `req.w` 가 벽을 따라가는 폭이 아니라 **튀어나오는 길이**다
// (bladeSign 주석). 그래서 대장은 벽을 따라 1.5m 를 예약하면서(실제로는
// 0.28m 만 쓴다) 앞으로 뻗은 1.5m 는 아무에게도 안 알렸다. 양쪽으로 틀렸다.
//
// 그러니 종류마다 셋을 말해 준다. 그러면 판정이 세 축이 된다 —
// 가로로 겹치고, 세로로 겹치고, **깊이까지 겹쳐야** 같은 자리다.
//
//   uw       벽을 따라 차지하는 폭
//   d0..d1   벽에서 얼마나 나와 있나
//
// 이 표가 각 shape 함수와 어긋나면 다시 겹친다. 값의 출처를 주석에 적어 둔다.
function footprint(q) {
  switch (q.kind) {
    // 벽에 평행한 판 — front 가 STANDOFF+0.06, 뒷판이 0..STANDOFF.
    // 난간에 맨 것은 통째로 앞으로 밀린다 (flatSign 의 standoff)
    case 'banner': case 'billboard': case 'mega': case 'strip': {
      const off = q.standoff ?? 0;
      return { uw: q.w, d0: off, d1: off + STANDOFF + 0.12 };
    }
    // 직각으로 뻗는다. 벽 위 폭은 심재(0.12)+양면(±0.07) 뿐이다.
    // 깊이는 **팔이 시작하는 곳**부터다 — 벽이 아니다 (bladeSign 의 armFrom).
    case 'blade': {
      const off = q.standoff ?? 0.15;
      return { uw: 0.28, d0: q.armFrom ?? 0, d1: off + q.w };
    }
    // 몸통 0.1..D+0.1, 정면 D+0.14, 받침 브래킷이 D+0.2
    case 'box': {
      const D = Math.min(q.w * 0.55, 1.1);
      return { uw: q.w, d0: 0, d1: D + 0.2 };
    }
    // 봉을 벽에서 0.5m 내밀어 매단다. 매다는 팔이 벽까지 온다
    case 'cloth':
      return { uw: q.w, d0: 0, d1: 0.58 };
    default:
      throw new Error(`간판 종류 '${q.kind}' 의 발자국이 footprint 에 없다`);
  }
}

// 예약(block)이 차지하는 깊이. 신고하는 쪽이 말해 준다 — 복도 폭(WALK_W)을
// 여기에 다시 적으면 그게 곧 결합 오류다. 안 주면 벽에 붙은 것으로 본다.
const BLOCK_D1 = 0.4;

function layoutSigns(reqs) {
  const groups = new Map();
  for (const q of reqs) {
    const az = alongZ(q.side);
    const a = faceAnchor(q.rect, q.side);
    q._c = az ? a.z : a.x;                                   // 면 위 위치의 세계 좌표
    q._fw = az ? q.rect.z1 - q.rect.z0 : q.rect.x1 - q.rect.x0;
    const key = `${q.side}|${(az ? a.x : a.z).toFixed(1)}`;   // 벽면 자체
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(q);
  }

  const out = [];
  for (const [, list] of groups) {
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
      placed.push({
        c: q._c, uw: Math.max(q.w, q._fw), h: q.h, cy: q.y + q.h / 2,
        d0: 0, d1: q.depth ?? BLOCK_D1, blk: true,
      });
    }

    // **자리를 잡기 전에 비율부터 맞춘다.** 늘어난 크기로 자리를 잡으면
    // 그 자리에 늘어난 판이 놓일 뿐이다.
    for (const q of drawn) { const f = fitAspect(q, q._fw); q.w = f.w; q.h = f.h; }

    // 큰 것부터 자리를 잡는다. 작은 것이 먼저 좋은 자리를 차지하면
    // 큰 것이 갈 데가 없어져 통째로 버려진다.
    drawn.sort((p, q2) => q2.w * q2.h - p.w * p.h);

    for (const q of drawn) {
      const w = Math.min(q.w, q._fw * 0.94);
      // 벽 위에서 차지하는 폭은 w 와 다를 수 있다 (세로 간판). 자리는 이걸로 잡는다
      const fp = footprint({ ...q, w });
      const half = Math.max(0, (q._fw - fp.uw) / 2);
      // 후보 자리 — 요청한 u 가 있으면 거기부터, 없으면 가운데부터 좌우로
      const cands = [q.u ?? 0];
      for (let k = 1; k <= 6 && half > 0.2; k++) {
        const t = (k / 6) * half;
        cands.push(t, -t);
      }
      const cy = q.y + q.h / 2;
      let ok = null;
      for (const cd of cands) {
        const u = Math.max(-half, Math.min(half, cd));
        const c = q._c + u;   // 자리 판정은 **세계 좌표**로 한다
        // 여유는 상대에 따라 다르다.
        //   간판끼리   0.35m — 두 장이 붙어 보이면 둘 다 안 읽힌다
        //   예약 상대  0.05m — 난간은 벽에 붙어 있고 간판은 0.36m 나와 있어
        //              스치듯 지나가도 관통이 아니다. 여기에 같은 여유를
        //              쓰면 층 사이 빈 띠가 통째로 사라진다 (실제로 간판이
        //              1,127장에서 498장으로 줄었다).
        const hit = placed.some((p) => {
          const gap = p.blk ? 0.05 : 0.35;
          if (Math.abs(p.c - c) >= (p.uw + fp.uw) / 2 + gap) return false;
          if (Math.abs(p.cy - cy) >= (p.h + q.h) / 2 + gap) return false;
          // 깊이까지 겹쳐야 같은 자리다. 여기에 여유를 주면 안 된다 — 세로
          // 간판을 복도 **앞**에 매다는 회피가 통째로 무의미해진다.
          return Math.min(p.d1, fp.d1) > Math.max(p.d0, fp.d0);
        });
        if (!hit) { ok = u; break; }
      }
      // 자리가 없으면 **버린다.** 겹쳐 놓느니 없는 것이 낫다 —
      // 겹친 간판은 둘 다 안 읽힌다.
      if (ok === null) continue;
      placed.push({ c: q._c + ok, uw: fp.uw, h: q.h, cy, d0: fp.d0, d1: fp.d1 });
      out.push({ ...q, u: ok, w });
    }
  }
  return out;
}

// ── 어느 판을 쓸 것인가 ────────────────────────────────────────────────────
//
// 배색은 요청이 고르고(`req.scheme`), **화법은 자리가 고른다.**
//
// 화법까지 난수로 뽑으면 소비량이 늘어 도시 전체가 다시 뽑힌다 (2.1 규칙 6).
// 좌표 해시로 정하면 그 자리의 간판은 늘 같은 화법이고, 옆 간판과는 갈린다 —
// 한 벽에 라이트박스와 네온관이 섞이는 것이 실제 거리의 모습이기도 하다.
//
// 색인 규칙은 materials.js 가 배열을 편 순서와 **짝**이다: 화법 * 배색수 + 배색.
function signMat(mats, req, f) {
  const arr = mats.signMats[req.kind];
  const { styles, schemes } = mats.signVariants[req.kind];
  // 요청은 배색을 0..5 로 고른다. 종류에 따라 굽는 배색이 그보다 적으므로
  // 여기서 접는다 — 요청 쪽에서 접게 하면 여섯 생산자가 각자 알아야 한다.
  const col = req.scheme % schemes;
  if (styles <= 1) return arr[col];
  const h = hash2(Math.round(f.x * 2) + req.kind.length * 17, Math.round(f.z * 2) + Math.round(req.y));
  return arr[Math.min(styles - 1, Math.floor(h * styles)) * schemes + col];
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
//
// ── 벽에만 붙는 것이 아니다 (사용자 지적으로 넓힘) ─────────────────────────
//
// 창을 키우고 나니 파사드에 가로 간판이 갈 자리가 없어졌다 — 한 층은 복도
// (1.15m)와 유리(2.4m)로 이미 꽉 찬다. 그래서 간판이 734장으로 주저앉아
// 감사 하한을 깼다 (건물당 2.52 < 3.5).
//
// 자리를 억지로 만들면 다시 유리를 덮는다. 실제 잡거빌딩은 이럴 때 간판을
// **복도 난간에 맨다.** 유리를 안 가리고, 아래에서 올려다보면 층마다 색이
// 쌓여 보인다 — 이 구역의 인상을 만드는 것이 바로 그 모습이다.
//
// 그러니 벽에서 얼마나 나와 붙는지를 생산자가 말할 수 있게 한다.
function flatSign(b, req, mats) {
  const f = frameOf(req);
  const mat = signMat(mats, req, f);
  const cy = req.y + req.h / 2;
  const off = req.standoff ?? 0;

  const front = new THREE.PlaneGeometry(req.w, req.h);
  front.rotateY(f.yaw);
  front.translate(f.x + f.ox * (off + STANDOFF + 0.06), cy, f.z + f.oz * (off + STANDOFF + 0.06));
  b.add(front, mat);

  // 뒷판 (두께)
  b.box(
    f.widthOnZ ? STANDOFF : req.w,
    req.h,
    f.widthOnZ ? req.w : STANDOFF,
    [f.x + f.ox * (off + STANDOFF / 2), cy, f.z + f.oz * (off + STANDOFF / 2)],
    mats.frameMat
  );
}

// 벽에서 직각으로 튀어나오는 세로 간판. 양면 발광.
//
// 거리의 깊이를 만드는 것이 이 형태다 — 벽에 붙은 판은 정면에서만 보이지만,
// 튀어나온 간판은 측면에서도 줄줄이 보여 거리에 리듬이 생긴다.
function bladeSign(b, req, mats) {
  const f = frameOf(req);
  const mat = signMat(mats, req, f);
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

  // ── 브래킷은 어디서 시작하나 (사용자 지적으로 고침) ──────────────────────
  //
  // "뭔가 다시 간판이 겹치기 시작한거같으니, 상세히 확인해"
  //
  // 팔을 **언제나 벽에서** 뽑고 있었다. 벽에 붙인 간판이라면 맞지만, 외부
  // 복도 앞에 2.3m 내밀어 매단 간판은 그 팔이 **복도·난간·가로 간판을 통째로
  // 가로지른다.** 검사에서 216 쌍이 여기서 나왔다 — 전부 blade 짝이었다.
  //
  // 실제로도 이런 간판은 벽이 아니라 **난간·기둥에 문다.** 그러니 팔이
  // 시작하는 깊이를 생산자가 말한다. 여기서 복도 폭을 다시 적으면 그게
  // 결합 오류다 (bazaar 의 WALK_W 가 유일한 출처다).
  const arm0 = Math.min(req.armFrom ?? 0, off);
  const armL = Math.max(0.06, off - arm0);
  for (const t of [0.2, 0.8]) {
    b.box(
      f.ox ? armL : 0.06,
      0.06,
      f.oz ? armL : 0.06,
      [f.x + f.ox * (arm0 + armL / 2), req.y + req.h * t, f.z + f.oz * (arm0 + armL / 2)],
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
  const mat = signMat(mats, req, f);
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
  const mat = signMat(mats, req, f);
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
  // 봉을 벽에 매다는 팔. 봉 하나에 하나면 충분하다 —
  // (좌우로 돌리려던 흔적이 남아 두 번 같은 자리에 그리고 있었다)
  b.box(
    f.ox ? d : 0.06, 0.06, f.oz ? d : 0.06,
    [f.x + f.ox * (d / 2), req.y + req.h, f.z + f.oz * (d / 2)],
    mats.metalMat
  );
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
