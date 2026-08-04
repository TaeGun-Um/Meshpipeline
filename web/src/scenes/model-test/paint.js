// 캔버스 2D 로 **그리는** 텍스처.
//
// core/textures.js 의 `bake()` 는 픽셀 루프다 — 노이즈·격자·그라디언트처럼
// 좌표의 함수로 정의되는 것에 맞는다. 얼굴은 그런 것이 아니다. 눈매 한 줄이
// 베지어 곡선이고, 그 곡선의 굵기가 안쪽에서 바깥쪽으로 변한다.
//
// 그래서 여기서는 캔버스의 경로 API 를 직접 쓴다. 이 씬만 쓰므로 core 로
// 올리지 않는다 — 다른 씬이 필요해지면 그때 옮긴다.
import * as THREE from 'three';

// draw(g, w, h) 로 그리고 텍스처를 돌려준다.
// alpha:true 면 투명 배경 (덧그리는 층에 쓴다).
export function paint(w, h, draw, { alpha = false, srgb = true } = {}) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d');
  if (!alpha) {
    g.fillStyle = '#000';
    g.fillRect(0, 0, w, h);
  }
  draw(g, w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.anisotropy = 8;
  // 얼굴은 한 장을 한 번만 쓴다. 반복하면 눈이 네 개가 된다.
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  t.needsUpdate = true;
  return t;
}

// ── 경로 도우미 ────────────────────────────────────────────────────────────

// 점 목록을 지나는 부드러운 곡선 (Catmull-Rom 을 베지어로 근사).
// 눈매·눈썹처럼 "몇 개의 통과점" 으로 형태를 말하는 편이 쉬운 것에 쓴다.
// move:false 면 **현재 경로에 이어 붙인다.** 이게 없어서 굵기가 변하는 선의
// 되돌아오는 변이 새 서브패스가 됐고, 눈매가 나비넥타이 모양으로 자기를
// 가로질렀다 — 화면에서는 눈을 관통하는 가시로 보였다.
export function curve(g, pts, close = false, move = true) {
  if (pts.length < 2) return;
  if (move) g.moveTo(pts[0][0], pts[0][1]);
  else g.lineTo(pts[0][0], pts[0][1]);
  const n = pts.length;
  for (let i = 0; i < n - 1; i++) {
    const p0 = pts[i > 0 ? i - 1 : 0];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2 < n ? i + 2 : n - 1];
    g.bezierCurveTo(
      p1[0] + (p2[0] - p0[0]) / 6,
      p1[1] + (p2[1] - p0[1]) / 6,
      p2[0] - (p3[0] - p1[0]) / 6,
      p2[1] - (p3[1] - p1[1]) / 6,
      p2[0],
      p2[1]
    );
  }
  if (close) g.closePath();
}

// 굵기가 변하는 선. 위쪽 가장자리와 아래쪽 가장자리를 각각 곡선으로 그려
// 채운다 — lineWidth 는 균일해서 눈매를 못 그린다.
//
//   pts   [x, y, 굵기] 목록
export function taperStroke(g, pts) {
  const up = [];
  const dn = [];
  for (let i = 0; i < pts.length; i++) {
    const [x, y, t] = pts[i];
    const a = pts[Math.max(0, i - 1)];
    const b = pts[Math.min(pts.length - 1, i + 1)];
    let dx = b[0] - a[0];
    let dy = b[1] - a[1];
    const L = Math.hypot(dx, dy) || 1;
    // 법선 방향으로 절반씩
    const nx = (-dy / L) * t * 0.5;
    const ny = (dx / L) * t * 0.5;
    up.push([x + nx, y + ny]);
    dn.push([x - nx, y - ny]);
  }
  g.beginPath();
  curve(g, up, false, true);
  curve(g, dn.reverse(), false, false);
  g.closePath();
  g.fill();
}

// 타원 채우기 (회전 포함)
export function ellipse(g, x, y, rx, ry, rot = 0) {
  g.beginPath();
  g.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2);
  g.fill();
}
