// 파사드 설비 — 건물 표면에 나중에 덧붙은 것들.
//
// ── 왜 필요한가 ────────────────────────────────────────────────────────────
// 창 격자와 매싱을 다양하게 만들어도 도시가 **그냥 야간의 현대 도시**로
// 보였다. 사이버펑크로 안 읽히는 이유는 색이나 간판이 아니라 이것이다.
//
//   설계된 표면과 덧붙인 표면의 대비가 없다.
//
// 레퍼런스의 건물은 예외 없이 **개조된 건물**이다. 원래 설계에 없던 배관,
// 덕트, 실외기, 케이블 트레이, 증축 발코니가 표면을 타고 오르고, 그것들이
// 창 격자의 규칙성을 깨뜨린다. 깨끗한 유리탑은 기업 구역에만 몇 채 있고
// 나머지는 전부 뭔가가 덕지덕지 붙어 있다.
//
// 옥상에는 이미 이런 것이 있었다 (rooftop.js 의 물탱크·실외기·환기구).
// 그런데 옥상은 지상에서 안 보인다. **보이는 곳은 벽면**이다.
//
// ── 비용 원칙 ──────────────────────────────────────────────────────────────
// 벽면은 건물마다 넷이고 건물이 수백 채다. 하나에 삼각형을 많이 쓰면 예산이
// 바로 터진다. 그래서 셋을 지킨다.
//
//   1) 거리 도로에 면한 면에만 붙인다. 안 보이는 면은 만들지 않는다.
//   2) 세로로 긴 것 위주. 하나를 길게 뽑으면 층수만큼의 인상을 값싸게 준다.
//   3) **모따기를 쓰지 않는다.**
//
// 3번은 실측으로 정했다. 처음에는 덕트와 실외기를 autoBox 로 만들었는데,
// 크기가 전부 minSize(0.55m) 위라 모따기가 붙어 하나에 44삼각형이 됐다.
// 그 결과 Duct 221,984 + Metal 204,604 = **도시 전체 삼각형의 38%** 를
// 파사드 설비가 차지했다.
//
// 모따기는 모서리 하이라이트를 만들려고 쓰는 것이고, 그 값을 하는 것은 근경
// 뿐이다. 이것들은 건물 벽면에 붙어 수십~수백m 밖에서 보이므로 모따기 면이
// 화면에서 1픽셀도 안 된다. 평범한 박스(12삼각형)로 충분하다.
import { tubeBetween } from '../../core/profile.js';
import { outward, faceAnchor, faceWidth, alongZ } from '../../core/boxfaces.js';
import { NEON } from '../../shared/neon.js';
import { neonSoft } from '../../shared/masters.js';
import { FLOOR_HEIGHT } from './layout.js';

// 면 위의 국소 좌표계. shopfront.js 의 frameOf 와 같은 발상이다 —
// 면마다 부호를 손으로 쓰면 반드시 어딘가를 틀린다.
function frameOf(r, side) {
  const o = outward(side);
  const a = faceAnchor(r, side);
  const w = faceWidth(r, side);
  const az = alongZ(side);
  // u = 면을 따라가는 방향, d = 면에서 바깥으로 나오는 방향
  return {
    w,
    at(u, d) {
      return az
        ? [a.x + o.ox * d, a.z + u]
        : [a.x + u, a.z + o.oz * d];
    },
    // 면에 평행한 판의 크기 (폭 wu, 두께 wd) 를 축 정렬 크기로 바꾼다
    size(wu, wd) {
      return az ? [wd, wu] : [wu, wd];
    },
  };
}

// ── 수직 덕트 ──────────────────────────────────────────────────────────────
//
// 가장 값싸고 효과가 큰 요소. 사각 덕트 하나를 건물 높이만큼 뽑고 몇 미터마다
// 밴드를 두르면, 창 격자를 세로로 끊어 표면이 단조롭지 않게 된다.
function ductRun(b, f, u, y0, h, rng, mats) {
  const w = rng.range(0.9, 1.7);
  const d = rng.range(0.6, 1.05);
  const [x, z] = f.at(u, d / 2);
  const [sx, sz] = f.size(w, d);
  b.box(sx, h, sz, [x, y0 + h / 2, z], mats.ductMat);

  // 이음 밴드 — 이게 없으면 그냥 길쭉한 상자다
  const [bx, bz] = f.size(w * 1.16, d * 1.16);
  for (let by = y0 + rng.range(2, 5); by < y0 + h; by += rng.range(6, 11)) {
    const [px, pz] = f.at(u, d / 2);
    b.box(bx, 0.22, bz, [px, by, pz], mats.metalMat);
  }
}

// 배관 다발 — 덕트보다 가늘고 여러 줄. 원통이라 실루엣이 다르다.
function pipeRun(b, f, u, y0, h, rng, mats) {
  const n = rng.int(2, 4);
  for (let i = 0; i < n; i++) {
    const r = rng.range(0.07, 0.14);
    const uu = u + (i - (n - 1) / 2) * 0.34;
    const [x, z] = f.at(uu, r + 0.06);
    const hh = h * rng.range(0.55, 1.0);
    b.cylinder(r, r, hh, [x, y0 + hh / 2, z], mats.pipeMat, 6);
  }
}

// ── 증축 발코니 ────────────────────────────────────────────────────────────
//
// 원래 설계에 없던 것을 매달아 놓은 트레이. 위에 실외기·물탱크·잡동사니가
// 얹히고, 난간 대신 골강판이 둘러진다. 주거 구역의 인상을 만드는 요소다.
//
// 층마다 붙이지 않고 **몇 층 걸러 한 번**, 그리고 좌우 위치도 어긋나게 둔다.
// 규칙적으로 붙이면 그냥 설계된 발코니가 되어 버린다.
function utilityLedge(b, f, u, y, rng, mats) {
  const w = rng.range(2.2, 4.0);
  const d = rng.range(0.9, 1.5);
  const [x, z] = f.at(u, d / 2);

  // 바닥판
  const [fx, fz] = f.size(w, d);
  b.box(fx, 0.14, fz, [x, y, z], mats.grateMat);
  // 앞면 가림판 (골강판)
  const [gx, gz] = f.size(w, 0.08);
  const [px, pz] = f.at(u, d);
  b.box(gx, 0.85, gz, [px, y + 0.42, pz], mats.shutterMat);
  // 받침 브래킷 — 매달린 것으로 읽히게
  for (const su of [-0.42, 0.42]) {
    const [ax, az] = f.at(u + su * w, 0.05);
    const [bx2, bz2] = f.at(u + su * w, d * 0.9);
    b.add(tubeBetween([ax, y - 0.9, az], [bx2, y - 0.05, bz2], 0.05, 4), mats.metalMat);
  }

  // 위에 얹히는 것 — 실외기 아니면 물탱크
  const items = rng.int(1, 3);
  for (let i = 0; i < items; i++) {
    const iu = u + rng.range(-w * 0.32, w * 0.32);
    const [ix, iz] = f.at(iu, d * 0.5);
    if (rng.chance(0.62)) {
      const [ax, az] = f.size(rng.range(0.6, 0.9), 0.6);
      b.box(ax, 0.62, az, [ix, y + 0.38, iz], mats.ductMat);
    } else {
      b.cylinder(0.34, 0.34, 0.8, [ix, y + 0.47, iz], mats.rustMat, 8);
    }
  }
}

// ── 케이블 트레이 ──────────────────────────────────────────────────────────
//
// 벽을 비스듬히 가로지르는 선. 수직·수평만 있는 표면에 **사선**이 하나
// 들어가면 인상이 크게 달라진다.
function cableDrop(b, f, u, y0, h, rng, mats) {
  const segs = rng.int(2, 4);
  let cy = y0 + h;
  let cu = u;
  for (let i = 0; i < segs; i++) {
    const ny = cy - h / segs;
    const nu = cu + rng.range(-2.2, 2.2);
    const [ax, az] = f.at(cu, 0.14);
    const [bx, bz] = f.at(nu, 0.14);
    b.add(tubeBetween([ax, cy, az], [bx, ny, bz], 0.035, 4), mats.cableMat);
    cy = ny;
    cu = nu;
  }
}

// 세로 간판 — 층을 여러 개 지나는 긴 띠. 대형 광고판(megaBoard)보다 작고 흔하다.
function bladeStrip(b, f, u, y0, h, rng, mats) {
  const hue = rng.chance(0.36) ? NEON.pink : rng.chance(0.5) ? NEON.cool : NEON.amber;
  const w = rng.range(0.7, 1.3);
  const len = h * rng.range(0.25, 0.5);
  const [x, z] = f.at(u, 0.34);
  const [sx, sz] = f.size(w, 0.14);
  b.box(sx, len, sz, [x, y0 + h * 0.55, z], neonSoft(hue));
  // 매단 팔
  for (const t of [0.2, 0.8]) {
    const [ax, az] = f.at(u, 0.02);
    const [bx, bz] = f.at(u, 0.3);
    const ay = y0 + h * 0.55 - len / 2 + len * t;
    b.add(tubeBetween([ax, ay, az], [bx, ay, bz], 0.03, 4), mats.metalMat);
  }
  return { hue };
}

// ── 조립 ───────────────────────────────────────────────────────────────────
//
// density 는 구역이 정한다. 기업 구역은 깨끗하고(0.25) 공업·주거는 지저분하다(1.0).
// 이 차이가 구역을 스카이라인이 아니라 **표면**에서도 읽히게 만든다.
export function retrofit(b, r, y0, h, faces, rng, mats, density = 1) {
  if (h < FLOOR_HEIGHT * 3) return;

  for (const side of ['px', 'nx', 'pz', 'nz']) {
    // 도로에 면한 곳만. 안 보이는 면에 설비를 붙이는 것은 순수한 낭비다.
    if (!faces[side]) continue;

    const f = frameOf(r, side);
    if (f.w < 5) continue;

    // 면 하나에 붙는 개수. 폭에 비례시켜야 넓은 면이 허전해지지 않는다.
    //
    // 처음에 f.w/9 로 뒀더니 도시 전체에서 삼각형이 38k 밖에 안 늘었고,
    // 거리에서는 파사드가 여전히 창 격자로만 보였다. 6 으로 내려 밀도를 올린다.
    const n = Math.max(1, Math.round((f.w / 6) * density));
    for (let i = 0; i < n; i++) {
      // 균등 배치 후 흔든다 — 정확히 등간격이면 이것도 격자가 된다
      const u = (-f.w / 2) + f.w * ((i + 0.5) / n) + rng.range(-f.w * 0.12, f.w * 0.12);
      if (Math.abs(u) > f.w / 2 - 0.8) continue;

      // ── 무엇을 얼마나 (실측으로 조정) ──────────────────────────────────
      // 처음에는 배관·케이블 비중을 높게 뒀는데, 타워를 보는 거리(수십~수백m)
      // 에서 지름 10cm 짜리 배관은 1픽셀도 안 된다. 그 거리에서 읽히는 것은
      // **실루엣을 깨는 것** — 벽 밖으로 튀어나온 것뿐이다.
      //
      // 그래서 돌출 요소(덕트·증축 발코니·세로 간판)에 비중을 몰고, 배관과
      // 케이블은 근경에서만 값을 하는 양념으로 줄였다.
      const pick = rng.next();
      if (pick < 0.34) {
        ductRun(b, f, u, y0, h * rng.range(0.5, 0.96), rng, mats);
      } else if (pick < 0.44) {
        pipeRun(b, f, u, y0, h, rng, mats);
      } else if (pick < 0.52) {
        cableDrop(b, f, u, y0, h, rng, mats);
      } else if (pick < 0.86) {
        // ── 증축 발코니 개수 상한 (실측으로 넣음) ─────────────────────────
        // 원래는 건물 꼭대기까지 무한정 쌓았다. 그래서 100m 타워 한 면의
        // 한 열에만 발코니가 10개씩 붙었고, 발코니 하나가 약 90삼각형이라
        // 도시 전체에서 Metal+Duct 가 **92만 삼각형**이 됐다. 건물 전체의 60%다.
        //
        // 발코니는 실루엣을 깨는 것이 목적이지 개수로 승부하는 것이 아니다.
        // 서너 개면 "덧붙였다" 는 인상은 그대로고 비용은 1/3 이다.
        const step = FLOOR_HEIGHT * rng.int(2, 4);
        const cap = Math.max(1, Math.round(rng.int(2, 4) * density));
        let made = 0;
        for (let ly = y0 + FLOOR_HEIGHT * 2; ly < y0 + h - 2 && made < cap; ly += step) {
          if (!rng.chance(0.78)) continue;
          utilityLedge(b, f, u, ly, rng, mats);
          made++;
        }
      } else {
        bladeStrip(b, f, u, y0, h, rng, mats);
      }
    }
  }
}
