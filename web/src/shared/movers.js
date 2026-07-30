// 직선 항로를 오가는 것들 — 지상 차량과 공중 차량이 공유한다.
//
// 둘은 겉모습만 다르고 운동은 같다: 축 하나를 따라 일정 속도로 가고, 범위를
// 벗어나면 반대쪽에서 다시 들어온다. 그 감싸기(wrap) 계산과 방향각 규약을
// 각자 구현하면 부호를 틀린다 — 실제로 차가 뒤로 가는 버그가 났다.
//
// ── 방향각 규약 ────────────────────────────────────────────────────────────
// 차량 지오메트리는 **로컬 -Z 를 진행 방향**으로 만든다 (three 의 카메라·
// lookAt 규약과 같다). Lane.at() 이 돌려주는 yaw 는 그 규약을 전제로 한다.

export class Lane {
  // alongX  true 면 X축 항로, false 면 Z축 항로
  // cross   항로의 측면 위치 (alongX 면 z, 아니면 x)
  // alt     고도
  // speed   m/s. 부호가 진행 방향이다.
  // phase   t=0 에서의 진행 위치
  // span    항로 절반 길이. ±span 을 감싸며 순환한다.
  // bobAmp / bobPhase  상하 흔들림 (공중 차량)
  constructor({ alongX, cross, alt, speed, phase, span, bobAmp = 0, bobPhase = 0 }) {
    this.alongX = alongX;
    this.cross = cross;
    this.alt = alt;
    this.speed = speed;
    this.phase = phase;
    this.span = span;
    this.bobAmp = bobAmp;
    this.bobPhase = bobPhase;
    this.dir = Math.sign(speed) || 1;
  }

  at(t) {
    // 진행 거리를 [-span, span) 으로 감싼다.
    // JS 의 % 는 음수에 음수를 돌려주므로 두 번 더해 준다.
    const s2 = this.span * 2;
    let s = this.phase + t * this.speed;
    s = ((((s + this.span) % s2) + s2) % s2) - this.span;

    const y = this.alt + (this.bobAmp ? Math.sin(t * 0.35 + this.bobPhase) * this.bobAmp : 0);

    if (this.alongX) {
      // 로컬 -Z 가 진행 방향이므로 X축 항로는 Y로 90도 돌린다
      return { x: s, y, z: this.cross, yaw: this.dir > 0 ? -Math.PI / 2 : Math.PI / 2 };
    }
    return { x: this.cross, y, z: s, yaw: this.dir > 0 ? Math.PI : 0 };
  }
}

// 항로 여러 개를 난수로 만든다.
//   pick(rng, i) → Lane 생성자에 넘길 값 (span 은 여기서 채워 준다)
export function makeLanes(rng, count, span, pick) {
  const out = [];
  for (let i = 0; i < count; i++) {
    out.push(new Lane({ span, ...pick(rng, i) }));
  }
  return out;
}
