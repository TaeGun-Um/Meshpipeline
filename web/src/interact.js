// 근접 상호작용 프리뷰 — 닫힘/열림 포즈를 씬 안에서 확인하는 도구.
//
// 씬이 build 결과에 `interact { pairs, radius }` 를 신고하면 하네스가
// 근접 감지 · E 토글 · 화면 힌트를 단다. 이 모듈은 장소를 모른다 — 쌍의
// 노드와 라벨은 전부 씬이 준다 (scenes/index.js 계약과 같은 방향).
//
// ── 동작 ───────────────────────────────────────────────────────────────────
// 카메라가 쌍의 중심에서 radius 안에 들어오면 하단에 "[E] …" 힌트가 뜨고,
// E 가 닫힘/열림을 토글한다. 게임(유니티)에서 약탈이 할 일을 미리 보는 것이다.
//
// FLY 모드의 E(상승)와 겹치므로 **대상이 잡혀 있을 때만 E 를 가로챈다** —
// 토글하고 input.keys 에서 지워 프리캠이 못 보게 한다. 대상이 없으면 E 는
// 원래대로 상승이다.
//
// ── 왜 재부모화인가 ────────────────────────────────────────────────────────
// 열림 그룹은 씬 밖에 있다 (익스포트 전용 — office index.js 주석). 열림 노드
// 하나만 보이게 하려고 그룹째 씬에 붙이면 감사의 씬 지표(메시·드로우그룹·
// 삼각형)가 안 그리는 것까지 세게 된다. 그래서 토글된 노드만 닫힘 노드의
// 부모로 옮겨 왔다가, 닫을 때 제자리로 돌려보낸다. 지오메트리가 월드
// 좌표라 부모를 바꿔도 자리는 그대로다.
//
// **익스포트 전에는 반드시 reset() 을 부른다** (main.js __export · __lock).
// 열어 둔 채 내보내면 숨긴 닫힘 노드가 GLB 에서 빠지고(onlyVisible),
// 옮겨 간 열림 노드가 열림 그룹 익스포트에서 빠진다.

export function mountInteract({ camera, input, interact }) {
  const radius = interact.radius ?? 2.4;
  const r2 = radius * radius;

  // 쌍마다 중심을 한 번 재 둔다. 지오메트리가 월드 좌표라 bbox 가 곧 자리다.
  // 노드는 재질별 메시 여럿이므로 **전부 합친** bbox 를 쓴다 — 첫 메시만 재면
  // 재질 순서가 바뀔 때 중심이 딴 조각으로 튄다.
  const pairs = interact.pairs.map((p) => {
    let min = [Infinity, Infinity, Infinity];
    let max = [-Infinity, -Infinity, -Infinity];
    p.closed.traverse((o) => {
      if (!o.isMesh) return;
      o.geometry.computeBoundingBox();
      const bb = o.geometry.boundingBox;
      min = [Math.min(min[0], bb.min.x), Math.min(min[1], bb.min.y), Math.min(min[2], bb.min.z)];
      max = [Math.max(max[0], bb.max.x), Math.max(max[1], bb.max.y), Math.max(max[2], bb.max.z)];
    });
    return {
      ...p,
      at: [(min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2],
      opened: false,
      openParent: p.open.parent, // 돌려보낼 제자리 (씬 밖 열림 그룹)
    };
  });

  // 힌트 — index.html 의 #hint 와 같은 결로, 화면 하단 중앙.
  const prompt = document.createElement('div');
  prompt.style.cssText =
    'position:fixed;left:50%;bottom:12%;transform:translateX(-50%);' +
    'font-size:13px;letter-spacing:.02em;pointer-events:none;opacity:0;' +
    'padding:7px 14px;border-radius:3px;background:rgba(10,13,16,.6);' +
    'border:1px solid rgba(255,255,255,.15);text-shadow:0 1px 3px rgba(0,0,0,.75);' +
    'transition:opacity .15s ease;';
  document.body.appendChild(prompt);
  const key = '<b style="color:#ffd479">E</b>';

  let target = null;
  let shown = ''; // 힌트에 마지막으로 쓴 문구 — innerHTML 은 재직렬화되므로 비교용으로 못 쓴다

  function toggle(p) {
    p.opened = !p.opened;
    p.closed.visible = !p.opened;
    if (p.opened) p.closed.parent.add(p.open);
    else p.openParent.add(p.open);
  }

  addEventListener('keydown', (e) => {
    if (e.code !== 'KeyE' || !target) return;
    if (!e.repeat) toggle(target);
    // 프리캠의 상승(E)이 같이 돌지 않게 지운다. 이 삭제는 controls.js 의
    // keydown(추가)이 먼저 등록돼 있다는 순서에 기대므로, 아래 update() 의
    // 프레임 단위 삭제가 순서가 뒤집혀도 한 프레임 안에 막아 준다.
    input.keys.delete('KeyE');
  });

  function update() {
    if (target) input.keys.delete('KeyE'); // 대상이 잡힌 동안 E 는 상호작용 전용
    const c = camera.position;
    let best = null;
    let bd = r2;
    for (const p of pairs) {
      const dx = p.at[0] - c.x;
      const dy = p.at[1] - c.y;
      const dz = p.at[2] - c.z;
      const d = dx * dx + dy * dy + dz * dz;
      if (d < bd) {
        bd = d;
        best = p;
      }
    }
    const want = best ? `${key} ${best.label} ${best.opened ? '닫기' : '열기'}` : '';
    if (best !== target) {
      target = best;
      prompt.style.opacity = target ? '1' : '0';
    }
    // 대상 전환·토글로 문구가 달라졌을 때만 다시 쓴다
    if (want && shown !== want) {
      prompt.innerHTML = want;
      shown = want;
    }
  }

  // 전부 닫힘으로 되돌린다 — 익스포트·검증 직전의 결정론 보장.
  function reset() {
    for (const p of pairs) {
      if (p.opened) toggle(p);
    }
  }

  return { update, reset };
}
