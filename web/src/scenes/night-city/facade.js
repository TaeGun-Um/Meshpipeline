// 건물 유형(archetype).
//
// ── 왜 필요한가 ────────────────────────────────────────────────────────────
// 모든 건물에 같은 창문 시트를 입히고 높이와 크라운만 바꿨더니, 도시가
// "알록달록한데 다 똑같이 생긴" 것이 됐다. 멀리서 보면 하나의 텍스처가 반복되는
// 것으로 읽히고, 전부 균일하게 반짝여서 시선이 쉴 곳도 위계도 없다.
//
// 실제 도시의 건물은 창 크기가 다른 정도가 아니라 **구조 방식 자체가 다르다.**
// 유리 커튼월은 유리가 곧 벽이고, 펀칭 콘크리트는 벽이 주인공이며 창은 구멍이다.
// 그 둘이 나란히 서 있어야 도시로 보인다.
//
// ── 다섯 유형 ──────────────────────────────────────────────────────────────
//   grid     벽에 창을 뚫은 사무소. 기본형
//   curtain  유리 커튼월. 대부분 어둡고 반사만 → 넓은 어두운 면
//   punched  펀칭 콘크리트. 작은 창 + 넓은 무지 벽면
//   slab     주거 슬래브. 촘촘한 창 + 층마다 발코니 난간
//   exo      외골격. 어두운 유리 위에 외부 구조재(수직 핀 + 사선 가새)
//
// ── 밝기 등급 ──────────────────────────────────────────────────────────────
// 유형과 별개로 건물마다 밝기 등급을 준다. 전부 밝으면 위계가 없다.
// 어두운 건물이 40% 는 있어야 밝은 건물이 눈에 들어온다.
import { SIDES, faceWidth, shrink, rectBox, facePlane } from '../../core/boxfaces.js';
import { autoBox } from '../../core/profile.js';
import {
  FLOOR_HEIGHT,
  PANEL_TILE,
} from './layout.js';

// 유형별 파사드 스킨을 세그먼트에 입힌다.
//
//   b        MeshBuilder
//   r        세그먼트 사각형
//   y, h     세그먼트 아래 높이와 높이
//   skinIdx  같은 유형 안에서 몇 번째 시트를 쓸지
export function applySkin(b, r, y, h, kind, skinIdx, mats, rng) {
  const skin = mats.skins[kind === 'exo' ? 'curtain' : kind];
  const set = skin.sets[skinIdx % skin.sets.length];
  const mat = skin.mats[skinIdx % skin.mats.length];
  const sheet = [set.grid.cols * skin.pitch, set.grid.rows * FLOOR_HEIGHT];

  for (const side of SIDES) {
    b.add(facePlane(r, y + 0.3, h - 0.6, side, sheet), mat);
  }

  if (kind === 'slab') balconies(b, r, y, h, mats);
  if (kind === 'exo') exoskeleton(b, r, y, h, mats);
}

// ── 주거 슬래브의 발코니 난간 ──────────────────────────────────────────────
//
// 층마다 얇은 수평 띠. 이게 있으면 주거 건물이 사무소와 확실히 구분된다.
// 층고 간격의 반복이 곧 "사람이 사는 집" 의 신호다.
function balconies(b, r, y, h, mats) {
  const step = FLOOR_HEIGHT;
  const out = shrink(r, -0.42);
  for (let by = y + step; by < y + h - 1; by += step) {
    // 바닥판
    b.add(rectBox(out, by, 0.12, PANEL_TILE), mats.panelMat);
    // 난간 (얇은 판)
    for (const side of SIDES) {
      b.add(facePlane(out, by + 0.12, 0.52, side, null, 0.01), mats.metalMat);
    }
  }
}

// ── 외골격 ─────────────────────────────────────────────────────────────────
//
// 구조재를 건물 **바깥**에 노출시킨 유형. 실루엣이 확 달라져서 한 도시에
// 몇 개만 있어도 단조로움이 깨진다.
// 수직 핀 + 몇 층마다 사선 가새(diagrid).
function exoskeleton(b, r, y, h, mats) {
  const FIN_PITCH = 4.6;
  const out = shrink(r, -0.35);

  for (const side of SIDES) {
    const fw = faceWidth(r, side);
    const n = Math.max(2, Math.round(fw / FIN_PITCH));
    // 수직 핀 — 면을 n 등분한 자리마다
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const fin = finRect(out, side, t);
      b.add(autoBox(fin.w, h, fin.d, [fin.x, y + h / 2, fin.z], 0.04), mats.metalMat);
    }
    // 사선 가새 — 4개 층마다 한 단. 판으로 근사한다 (진짜 사선 부재는
    // 회전 박스가 필요한데, 이 거리에서는 판의 밝은 선으로 충분히 읽힌다).
    const bandStep = FLOOR_HEIGHT * 5;
    for (let by = y + bandStep; by < y + h - 1; by += bandStep) {
      b.add(facePlane(out, by, 0.3, side, null, 0.02), mats.metalMat);
    }
  }
}

// ── 파사드 요철 ────────────────────────────────────────────────────────────
//
// 창 사이가 완전히 평평하면 아무리 텍스처를 잘 만들어도 "무늬를 입힌 판" 이다.
// 실제 건물 벽에는 튀어나온 것이 늘 붙어 있고, 그 그림자가 벽에 깊이를 준다.
//
// 유형마다 붙는 것이 다르다 — 이 차이가 유형을 더 확실히 갈라 준다.
//   slab    실외기. 주거 건물 벽의 상징이다. 층마다 불규칙하게.
//   grid    수직 필래스터(벽기둥). 사무소 파사드의 리듬.
//   punched 창 아래 에어컨 슬리브 + 배수관
export function facadeRelief(b, r, y, h, kind, rng, mats) {
  if (kind === 'curtain' || kind === 'exo') return; // 이 둘은 매끈해야 한다

  if (kind === 'slab') {
    // 실외기 — 층·호 격자에 불규칙하게. 다 붙이면 규칙적이라 오히려 가짜다.
    for (const side of SIDES) {
      const fw = faceWidth(r, side);
      const cols = Math.max(2, Math.floor(fw / 3.2));
      const rows = Math.floor(h / FLOOR_HEIGHT);
      for (let cy = 1; cy < rows; cy++) {
        for (let cx = 0; cx < cols; cx++) {
          if (!rng.chance(0.24)) continue;
          const t = (cx + 0.5) / cols;
          const p = facePoint(r, side, t, 0.28);
          b.add(
            autoBox(p.w, 0.62, p.d, [p.x, y + cy * FLOOR_HEIGHT + 0.9, p.z], 0.03),
            mats.ductMat
          );
        }
      }
    }
    return;
  }

  if (kind === 'grid') {
    // 수직 필래스터 — 벽에서 살짝 나온 기둥. 층 띠와 교차해 격자를 만든다.
    const PITCH = 7.5;
    for (const side of SIDES) {
      const fw = faceWidth(r, side);
      const n = Math.max(1, Math.round(fw / PITCH));
      for (let i = 1; i < n; i++) {
        const p = facePoint(r, side, i / n, 0.22, 0.7);
        b.add(autoBox(p.w, h - 0.6, p.d, [p.x, y + h / 2, p.z], 0.03), mats.panelMat);
      }
    }
    return;
  }

  // punched — 배수관 두 줄. 모서리 근처에 세로로.
  for (const side of ['px', 'nz']) {
    const p = facePoint(r, side, rng.range(0.12, 0.88), 0.16, 0.34);
    b.cylinder(0.14, 0.14, h - 0.4, [p.x, y + h / 2, p.z], mats.ductMat, 8);
  }
}

// side 면 위 t(0..1) 위치에서 depth 만큼 튀어나온 지점과 단면 크기
function facePoint(r, side, t, depth, width = 0.9) {
  if (side === 'px' || side === 'nx') {
    const sx = side === 'px' ? 1 : -1;
    const x = (side === 'px' ? r.x1 : r.x0) + sx * (depth / 2);
    return { x, z: r.z0 + (r.z1 - r.z0) * t, w: depth, d: width };
  }
  const sz = side === 'pz' ? 1 : -1;
  const z = (side === 'pz' ? r.z1 : r.z0) + sz * (depth / 2);
  return { x: r.x0 + (r.x1 - r.x0) * t, z, w: width, d: depth };
}

// side 면 위 t(0..1) 위치의 수직 핀 단면
function finRect(r, side, t) {
  const W = 0.5;
  const D = 0.9; // 면에서 튀어나오는 깊이
  if (side === 'px' || side === 'nx') {
    return { x: side === 'px' ? r.x1 : r.x0, z: r.z0 + (r.z1 - r.z0) * t, w: D, d: W };
  }
  return { x: r.x0 + (r.x1 - r.x0) * t, z: side === 'pz' ? r.z1 : r.z0, w: W, d: D };
}
