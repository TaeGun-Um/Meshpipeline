// 얼굴 텍스처.
//
// ── 이 양식에서 얼굴은 형태가 아니라 그림이다 ──────────────────────────────
// 서브컬처 아바타는 머리를 정교하게 깎아서 예뻐지는 것이 아니다. 머리는
// 오히려 단순하게 두고(정면을 눌러 평평하게), **얼굴 한 장을 앞에서 투영**한다.
// 그래서 이 파일이 이 캐릭터에서 제일 중요한 파일이다.
//
// ── 좌표 ───────────────────────────────────────────────────────────────────
// 캔버스를 "머리를 정면에서 본 그림" 으로 본다. u 는 왼쪽 0 -> 오른쪽 1,
// v 는 정수리 0 -> 턱 1. 머리 지오메트리가 같은 규칙으로 UV 를 만든다.
//
// 비율은 애니 얼굴의 관례를 따랐다 — **눈이 얼굴 한가운데보다 아래**에 있고
// (v 0.58~0.78), 눈 사이가 눈 하나 폭만큼 벌어지고, 코와 입은 아주 작다.
// 실사 비율(눈이 정확히 중앙)로 그리면 그 순간 애니가 아니게 된다.
import { paint, curve, taperStroke, ellipse } from './paint.js';

export const SKIN = '#f9e9e1';
const SKIN_SHADE = '#e6cbcb';
// 순검정에 가까운 눈매는 무섭다. 애니는 눈매도 갈색·보라 계열을 쓴다.
const LASH = '#4a3d55';
const BROW = '#9a92ad';

// 눈 — 이 캐릭터의 청보라
const IRIS_TOP = '#454c98';
const IRIS_MID = '#6068cf';
const IRIS_LOW = '#a7b1f5';
const PUPIL = '#2a2740';

// 눈 하나. (cx, cy) 중심, w 가 반폭, h 가 반높이. s=+1 이면 오른쪽 눈.
//
// 위 눈꺼풀이 이 그림의 전부다. 굵기가 균일한 선으로 그리면 만화가 아니라
// 도형이 된다 — 안쪽은 가늘고 바깥 1/3 에서 제일 굵고 끝은 위로 뺀다.
function eye(g, cx, cy, w, h, s) {
  const X = (x) => cx + x * w * s;
  const Y = (y) => cy + y * h;

  // ── 눈구멍(흰자) 경로 ────────────────────────────────────────────────────
  // 처음에 바깥 눈초리를 위(-0.2)로 올렸더니 사납게 째진 눈이 됐다.
  // 이 캐릭터는 차분한 인상이라 눈매 축이 거의 수평이어야 한다.
  // 눈이 무섭다는 지적을 받고 다시 잡았다. 원인 셋 — 아래 눈꺼풀이 얕아
  // 눈이 째져 보이고, 바깥 눈초리가 치켜 있고, 눈매가 새카맸다.
  // **아래를 깊게 파면 눈이 둥글어지고 그것만으로 인상이 순해진다.**
  const lid = [
    [-1.0, 0.14],
    [-0.6, -0.7],
    [-0.05, -1.0],
    [0.58, -0.86],
    [1.0, -0.02],
  ];
  const low = [
    [1.0, -0.02],
    [0.46, 0.86],
    [-0.16, 1.02],
    [-0.7, 0.7],
    [-1.0, 0.14],
  ];
  const socket = () => {
    g.beginPath();
    curve(g, [...lid, ...low.slice(1)].map(([x, y]) => [X(x), Y(y)]), true);
  };

  socket();
  g.fillStyle = '#f7f5fb';
  g.fill();

  g.save();
  socket();
  g.clip();

  // 눈꺼풀이 흰자에 지우는 그늘. 없으면 눈알이 종이에 뜬 것처럼 보인다.
  const sh = g.createLinearGradient(0, Y(-1.0), 0, Y(0.1));
  sh.addColorStop(0, 'rgba(112,100,142,0.95)');
  sh.addColorStop(1, 'rgba(120,110,150,0)');
  g.fillStyle = sh;
  g.fillRect(X(-1.2), Y(-1.2), w * 2.6, h * 1.6);

  // ── 홍채 ─────────────────────────────────────────────────────────────────
  // **눈꺼풀에 위아래가 잘리는 크기**여야 한다. 눈구멍 안에 쏙 들어가면
  // 흰자가 넓어져 실사 눈이 되고, 그 순간 인상이 무섭다.
  const ix = X(0.0);
  const iy = Y(-0.04);
  const irx = w * 0.62;
  const iry = h * 1.14;

  const body = g.createLinearGradient(0, iy - iry, 0, iy + iry);
  body.addColorStop(0.0, IRIS_TOP);
  body.addColorStop(0.42, IRIS_MID);
  body.addColorStop(1.0, IRIS_LOW);
  g.fillStyle = body;
  ellipse(g, ix, iy, irx, iry);

  // 아래쪽에서 올라오는 빛 — 애니 눈동자의 투명감은 거의 이것이다
  const glow = g.createRadialGradient(ix, iy + iry * 0.55, 0, ix, iy + iry * 0.55, irx * 1.25);
  glow.addColorStop(0, 'rgba(205,215,255,0.95)');
  glow.addColorStop(0.55, 'rgba(150,165,240,0.35)');
  glow.addColorStop(1, 'rgba(150,165,240,0)');
  g.fillStyle = glow;
  ellipse(g, ix, iy, irx, iry);

  // 방사 결
  g.save();
  g.beginPath();
  g.ellipse(ix, iy, irx, iry, 0, 0, Math.PI * 2);
  g.clip();
  g.strokeStyle = 'rgba(40,45,110,0.07)';
  g.lineWidth = Math.max(1, w * 0.035);
  for (let i = 0; i < 22; i++) {
    const a = (i / 22) * Math.PI * 2 + 0.2;
    g.beginPath();
    g.moveTo(ix + Math.cos(a) * irx * 0.3, iy + Math.sin(a) * iry * 0.3);
    g.lineTo(ix + Math.cos(a) * irx * 0.94, iy + Math.sin(a) * iry * 0.94);
    g.stroke();
  }
  g.restore();

  // 홍채 테두리 — 어두운 링이 있어야 눈동자가 야무지게 보인다
  g.strokeStyle = 'rgba(52,58,116,0.62)';
  g.lineWidth = w * 0.058;
  g.beginPath();
  g.ellipse(ix, iy, irx, iry, 0, 0, Math.PI * 2);
  g.stroke();

  // 동공
  g.fillStyle = PUPIL;
  // 동공이 작으면 노려보는 눈이 된다. 크게.
  ellipse(g, ix, iy + iry * 0.04, irx * 0.4, iry * 0.46);

  // 동공 아래 반사
  g.fillStyle = 'rgba(190,205,255,0.55)';
  ellipse(g, ix, iy + iry * 0.55, irx * 0.4, iry * 0.16);

  // ── 하이라이트 ───────────────────────────────────────────────────────────
  g.fillStyle = '#ffffff';
  ellipse(g, X(-0.26), Y(-0.46), w * 0.24, h * 0.3, -0.3);
  g.fillStyle = 'rgba(255,255,255,0.8)';
  ellipse(g, X(0.32), Y(0.34), w * 0.11, h * 0.14);

  g.restore();

  // ── 위 눈매 ──────────────────────────────────────────────────────────────
  g.fillStyle = LASH;
  taperStroke(
    g,
    [
      [X(-1.0), Y(0.16), h * 0.04],
      [X(-0.62), Y(-0.68), h * 0.16],
      [X(-0.04), Y(-1.02), h * 0.24],
      [X(0.58), Y(-0.88), h * 0.26],
      [X(1.02), Y(-0.02), h * 0.17],
      [X(1.18), Y(-0.1), h * 0.06],
    ]
  );

  // 바깥 속눈썹 — 두 갈래. 이게 눈매의 방향을 정한다
  taperStroke(g, [
    [X(0.92), Y(-0.18), h * 0.13],
    [X(1.18), Y(-0.34), h * 0.07],
    [X(1.34), Y(-0.48), h * 0.02],
  ]);
  taperStroke(g, [
    [X(0.62), Y(-0.86), h * 0.09],
    [X(0.9), Y(-1.04), h * 0.05],
    [X(1.04), Y(-1.16), h * 0.02],
  ]);

  // 쌍꺼풀 — 눈매와 나란한 가는 선
  g.fillStyle = 'rgba(120,105,140,0.55)';
  taperStroke(g, [
    [X(-0.7), Y(-0.9), h * 0.03],
    [X(-0.02), Y(-1.24), h * 0.07],
    [X(0.7), Y(-1.06), h * 0.06],
    [X(1.0), Y(-0.56), h * 0.02],
  ]);

  // 아래 눈매 — 바깥 절반만. 다 그리면 눈이 동그래져 인형이 된다
  g.fillStyle = 'rgba(96,84,116,0.7)';
  taperStroke(g, [
    [X(-0.3), Y(1.04), h * 0.025],
    [X(0.35), Y(0.98), h * 0.065],
    [X(0.8), Y(0.6), h * 0.065],
    [X(1.0), Y(0.1), h * 0.03],
  ]);

  // 애교살 — 아래 눈꺼풀 위에 얹히는 밝은 띠. 한 줄인데 눈이 웃는다.
  g.fillStyle = 'rgba(255,246,246,0.55)';
  taperStroke(g, [
    [X(-0.55), Y(0.84), h * 0.03],
    [X(0.05), Y(0.98), h * 0.09],
    [X(0.66), Y(0.82), h * 0.07],
    [X(0.92), Y(0.42), h * 0.02],
  ]);
}

// 눈썹 하나가 인상의 절반이다.
//
// 처음에 **안쪽 끝을 바깥보다 낮게** 그렸다 (안쪽 +0.35h, 바깥 +0.10h).
// 그게 정확히 '찌푸린 눈썹' 의 정의다 — 눈은 그대로인데 얼굴이 화나 보였다.
// 안쪽을 올리고 바깥을 내리면 같은 눈으로 인상이 순해진다.
function brow(g, cx, cy, w, h, s) {
  const X = (x) => cx + x * w * s;
  g.fillStyle = BROW;
  taperStroke(g, [
    [X(-1.0), cy + h * 0.02, h * 0.24],
    [X(-0.38), cy - h * 0.32, h * 0.4],
    [X(0.32), cy - h * 0.34, h * 0.34],
    [X(1.02), cy + h * 0.34, h * 0.1],
  ]);
}

export function faceTexture(size = 1024) {
  return paint(size, size, (g, W, H) => {
    const X = (u) => u * W;
    const Y = (v) => v * H;

    // 살결 바탕. 텍스처가 머리 옆·뒤까지 늘어나 붙으므로 가장자리도
    // 살색이어야 한다 — 그래야 늘어난 것이 안 보인다.
    g.fillStyle = SKIN;
    g.fillRect(0, 0, W, H);

    // 턱 아래로 갈수록 살짝 어둡게 (그림자를 그려 넣는다)
    const dn = g.createLinearGradient(0, Y(0.78), 0, Y(1.0));
    dn.addColorStop(0, 'rgba(214,180,182,0)');
    dn.addColorStop(1, 'rgba(203,166,172,0.55)');
    g.fillStyle = dn;
    g.fillRect(0, Y(0.76), W, Y(0.24));

    // 앞머리가 이마에 지우는 그림자.
    //
    // **이게 없으면 이마가 무한히 넓어 보인다.** 실제로 이 양식에서 얼굴
    // 텍스처에 반드시 들어가는 것이고, 지오메트리 그림자로는 절대 이 모양이
    // 안 나온다 (앞머리 가닥 하나하나가 그림자를 드리우면 지저분해진다).
    // 밑단을 물결지게 해서 가닥 끝을 흉내낸다.
    (() => {
      const base = 0.455;
      g.save();
      g.beginPath();
      g.moveTo(0, 0);
      g.lineTo(W, 0);
      g.lineTo(W, Y(base));
      for (let i = 20; i >= 0; i--) {
        const u = i / 20;
        // 물결이 얕으면 그냥 가로줄이다 — 가닥 끝이 들쭉날쭉해야 그림자로 읽힌다
        const wob = Math.sin(u * Math.PI * 6.5 + 0.7) * 0.038 + Math.sin(u * Math.PI * 2.3) * 0.026;
        g.lineTo(X(u), Y(base + wob));
      }
      g.closePath();
      g.clip();
      const sh = g.createLinearGradient(0, Y(base - 0.30), 0, Y(base + 0.02));
      sh.addColorStop(0, 'rgba(186,164,182,0.16)');
      sh.addColorStop(0.55, 'rgba(178,154,178,0.30)');
      sh.addColorStop(1, 'rgba(170,144,174,0.42)');
      g.fillStyle = sh;
      g.fillRect(0, 0, W, Y(base + 0.06));
      g.restore();
    })();

    // 관자놀이 그늘
    for (const s of [-1, 1]) {
      const cx = X(0.5 + s * 0.46);
      const sh = g.createLinearGradient(cx, 0, X(0.5 + s * 0.3), 0);
      sh.addColorStop(0, 'rgba(200,164,170,0.6)');
      sh.addColorStop(1, 'rgba(200,164,170,0)');
      g.fillStyle = sh;
      g.fillRect(Math.min(cx, X(0.5 + s * 0.3)), Y(0.4), W * 0.18, H * 0.5);
    }

    // 눈 높이 하나에서 코·입·홍조가 전부 따라 나온다. 따로 적으면
    // 눈을 올릴 때 코만 제자리에 남는다.
    const EYE_V = 0.585;
    const LOW = 1 - EYE_V; // 눈에서 턱까지
    const NOSE_V = EYE_V + LOW * 0.4;
    const MOUTH_V = EYE_V + LOW * 0.57;

    // 눈 크기가 이 양식의 전부에 가깝다. 처음에 반폭 0.118 로 잡았더니
    // 실사 비율이 되어 애니로 안 읽혔다. 눈 하나가 머리 폭의 1/3 은 돼야 한다.
    const EYE_U = 0.170; // 중심에서 눈까지
    const EW = W * 0.148; // 눈 반폭
    const EH = H * 0.098; // 눈 반높이

    // 볼 홍조 — 눈 바로 아래 바깥쪽
    for (const s of [-1, 1]) {
      const bx = X(0.5 + s * (EYE_U + 0.055));
      const by = Y(EYE_V + 0.075);
      const bl = g.createRadialGradient(bx, by, 0, bx, by, W * 0.1);
      bl.addColorStop(0, 'rgba(243,155,158,0.4)');
      bl.addColorStop(1, 'rgba(240,150,158,0)');
      g.fillStyle = bl;
      g.fillRect(bx - W * 0.1, by - W * 0.1, W * 0.2, W * 0.2);
    }

    // 코 — 점 하나에 가까운 그림자. 크게 그리면 즉시 실사가 된다
    const nx = X(0.5);
    const ny = Y(NOSE_V);
    const ns = g.createRadialGradient(nx, ny, 0, nx, ny, W * 0.022);
    ns.addColorStop(0, 'rgba(203,158,159,0.7)');
    ns.addColorStop(1, 'rgba(198,150,152,0)');
    g.fillStyle = ns;
    g.fillRect(nx - W * 0.03, ny - W * 0.03, W * 0.06, W * 0.06);

    // 입 — 작게, 살짝 웃는 정도
    g.fillStyle = '#bb7480';
    taperStroke(g, [
      [X(0.464), Y(MOUTH_V + 0.002), H * 0.005],
      [X(0.5), Y(MOUTH_V + 0.009), H * 0.010],
      [X(0.536), Y(MOUTH_V + 0.002), H * 0.005],
    ]);
    g.fillStyle = 'rgba(196,120,132,0.5)';
    taperStroke(g, [
      [X(0.487), Y(MOUTH_V + 0.014), H * 0.005],
      [X(0.513), Y(MOUTH_V + 0.014), H * 0.005],
    ]);

    // 아랫입술 아래 그늘. 점 하나지만 이게 없으면 입이 종이에 찍힌 도장이다.
    (() => {
      const lx = X(0.5);
      const ly = Y(MOUTH_V + 0.026);
      const gr = g.createRadialGradient(lx, ly, 0, lx, ly, W * 0.028);
      gr.addColorStop(0, 'rgba(205,160,162,0.5)');
      gr.addColorStop(1, 'rgba(205,160,162,0)');
      g.fillStyle = gr;
      g.fillRect(lx - W * 0.04, ly - W * 0.04, W * 0.08, W * 0.08);
    })();

    for (const s of [-1, 1]) {
      // 눈꺼풀 위 끝이 EYE_V - EH 라 그 자리에 그리면 눈매에 먹힌다
      brow(g, X(0.5 + s * (EYE_U + 0.014)), Y(EYE_V - 0.116), EW * 0.9, EH * 0.42, s);
      eye(g, X(0.5 + s * EYE_U), Y(EYE_V), EW, EH, s);
    }
  });
}
