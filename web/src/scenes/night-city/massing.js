// 매싱 — 건물의 평면 형태.
//
// ── 왜 필요한가 ────────────────────────────────────────────────────────────
// 파사드 유형을 다섯으로 늘려도 **평면이 전부 직사각형**이면 위에서 볼 때 여전히
// 상자 배열이다. 표면만 다른 상자들이다.
//
// 실제 도시의 평면은 대지 모양·일조권·코어 배치 때문에 L자·ㄷ자가 흔하고,
// 큰 대지에는 가운데를 파낸 노치나 원통이 선다. 그 윤곽 차이가 항공 뷰의 전부다.
//
// ── 구현 방식: 사각형 목록 ─────────────────────────────────────────────────
// 형태를 하나의 다각형으로 다루면 파사드를 붙이는 코드가 복잡해진다.
// **겹치는 사각형 몇 개**로 표현하면 기존 rectBox/facePlane 을 그대로 쓸 수 있다.
// 겹친 부분의 안쪽 면은 덩치에 파묻혀 보이지 않는다 — 삼각형이 조금 낭비되지만
// 코드가 단순해지는 값을 한다.
//
// 사각형을 **맞붙이지 않고 겹치는** 것이 중요하다. 정확히 맞대면 두 면이 같은
// 자리에 놓여 Z-파이팅이 난다.
import * as THREE from 'three';
import { scaleUV } from '../../core/meshkit.js';
import { rectCenter, rectSize } from '../../core/boxfaces.js';


// 형태를 고른다. 작은 대지에 ㄷ자를 세우면 팔이 너무 얇아지므로 크기로 거른다.
export function pickMassing(rng, w, d, height) {
  const small = Math.min(w, d);
  const r = rng.next();

  if (small > 30 && height > 70 && r < 0.08) return 'cyl';
  if (small > 26 && r < 0.2) return 'notch';
  if (small > 22 && r < 0.36) return 'U';
  if (small > 18 && r < 0.58) return 'L';
  return 'box';
}

// 사각형을 중심 기준으로 뒤집는다. L·ㄷ 자의 방향을 4가지로 돌리는 데 쓴다.
function mirror(rects, r, flipX, flipZ) {
  const cx = (r.x0 + r.x1) / 2;
  const cz = (r.z0 + r.z1) / 2;
  return rects.map((q) => {
    const x0 = flipX ? 2 * cx - q.x1 : q.x0;
    const x1 = flipX ? 2 * cx - q.x0 : q.x1;
    const z0 = flipZ ? 2 * cz - q.z1 : q.z0;
    const z1 = flipZ ? 2 * cz - q.z0 : q.z1;
    return { x0, x1, z0, z1 };
  });
}

// 형태 -> 사각형 목록. orient 는 0..3 (네 방향).
export function footprint(r, kind, orient = 0) {
  const w = r.x1 - r.x0;
  const d = r.z1 - r.z0;
  const OVERLAP = 0.4; // 겹침 — Z-파이팅 방지

  let rects;
  switch (kind) {
    case 'L': {
      const t = 0.56;
      rects = [
        { x0: r.x0, x1: r.x1, z0: r.z0, z1: r.z0 + d * t },
        { x0: r.x0, x1: r.x0 + w * t, z0: r.z0, z1: r.z1 },
      ];
      break;
    }
    case 'U': {
      const t = 0.34;
      rects = [
        { x0: r.x0, x1: r.x1, z0: r.z0, z1: r.z0 + d * t + OVERLAP },
        { x0: r.x0, x1: r.x0 + w * t, z0: r.z0, z1: r.z1 },
        { x0: r.x1 - w * t, x1: r.x1, z0: r.z0, z1: r.z1 },
      ];
      break;
    }
    case 'notch': {
      // 가운데를 세로로 파낸 슬롯. 두 동이 붙어 선 것처럼 보인다.
      const g = 0.16;
      rects = [
        { x0: r.x0, x1: r.x0 + w * (0.5 - g / 2), z0: r.z0, z1: r.z1 },
        { x0: r.x0 + w * (0.5 + g / 2), x1: r.x1, z0: r.z0, z1: r.z1 },
      ];
      break;
    }
    default:
      return [r];
  }
  return mirror(rects, r, (orient & 1) !== 0, (orient & 2) !== 0);
}


// ── 원통 ───────────────────────────────────────────────────────────────────
//
// 사각형으로 표현할 수 없는 유일한 형태라 따로 만든다.
// CylinderGeometry 의 UV는 u가 둘레, v가 높이라서 파사드 시트를 그대로 감을 수 있다.
export function cylinderMass(b, r, y, h, mat, sheet, segments = 28) {
  const c = rectCenter(r);
  const s = rectSize(r);
  const rad = Math.min(s.w, s.d) / 2;

  const geo = new THREE.CylinderGeometry(rad, rad, h, segments, 1, true);
  // 둘레를 미터로 환산해 시트 반복 수를 정한다
  scaleUV(geo, (2 * Math.PI * rad) / sheet[0], h / sheet[1]);
  geo.translate(c.x, y + h / 2, c.z);
  b.add(geo, mat);

  // 옥상 슬래브 (뚜껑). 원통을 열어 뒀으므로 위를 막아야 한다.
  const cap = new THREE.CylinderGeometry(rad * 1.02, rad * 1.02, 0.6, segments, 1);
  cap.translate(c.x, y + h + 0.3, c.z);
  return { cap, rad, center: c };
}
