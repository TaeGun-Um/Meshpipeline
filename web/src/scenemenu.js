// 씬 메뉴 — 우측 상단 햄버거. 저장된 씬 사이를 오간다.
//
// ── 무엇을 하는 물건인가 ───────────────────────────────────────────────────
//
// 이 프로젝트의 브라우저 단계는 **뷰포트**다. 게임 엔진에서 씬 파일을 골라
// 뷰포트에 띄우고 그 안의 모델을 다듬는 것과 같은 자리이고, 여기서 "올바른
// 모습" 이 결정된 뒤에 엔진으로 넘어간다 (docs/concepts.md 의 두 단계).
//
// 그래서 씬 목록은 파일 탐색기가 아니라 **뷰포트 전환기**다. 고르면 그 씬이
// 처음 켠 것처럼 통째로 다시 지어진다.
//
// ── 왜 새로고침인가 ────────────────────────────────────────────────────────
//
// 인페이지로 교체하려면 씬 하나를 통째로 반납하는 계약이 필요하다.
//
//   · 지오메트리·재질·텍스처 dispose 워커
//   · `MasterMaterial.cache` 를 씬 스코프로 (지금은 모듈 스코프라 옛 씬 재질
//     160개가 계속 살아 있다)
//   · 모듈 상태 리셋 (core/scenestate.js 로 이번에 세웠다 — 셋 중 하나는 됐다)
//
// 그 셋이 없는 상태로 인페이지 교체를 하면 전환마다 텍스처 213MB 와 삼각형
// 295만이 GPU 에 남는다. 그리고 요구사항 자체가 "이전 메모리를 지우고 처음
// 켤 때처럼 빌드" 라, **새로고침이 그 동작을 공짜로 정확하게** 한다.
//
// 나중에 전환이 잦아지거나 상태를 이어가고 싶어지면 위 계약을 세우고 이
// 파일의 `go()` 만 바꾸면 된다. 목록·UI 는 그대로 쓴다.
import { sceneList } from './scenes/index.js';

const CSS = `
/* 버튼과 목록을 **오른쪽 끝에 맞춘다.** 안 맞추면 버튼이 목록 폭만큼
   왼쪽으로 밀린다 — 실측으로 우측에서 455px 떨어져 있었다. */
#scenemenu{position:fixed;top:12px;right:12px;z-index:50;font:13px/1.5 system-ui,sans-serif;
  display:flex;flex-direction:column;align-items:flex-end}
#scenemenu button.bar{width:38px;height:38px;border:0;border-radius:9px;cursor:pointer;
  background:rgba(16,18,26,.82);color:#cdd3e2;display:grid;place-items:center;gap:4px;
  backdrop-filter:blur(6px);box-shadow:0 2px 12px rgba(0,0,0,.45)}
#scenemenu button.bar:hover{background:rgba(30,34,48,.92);color:#fff}
#scenemenu button.bar i{display:block;width:17px;height:2px;background:currentColor;border-radius:2px}
/* 설명이 길어 안 접히면 목록이 화면 절반을 먹는다 (실측 481px) */
#scenemenu ul{display:none;list-style:none;margin:8px 0 0;padding:6px;width:290px;
  background:rgba(16,18,26,.95);border-radius:11px;backdrop-filter:blur(8px);
  box-shadow:0 6px 26px rgba(0,0,0,.55)}
#scenemenu.open ul{display:block}
#scenemenu li>a{display:flex;gap:9px;align-items:baseline;padding:8px 9px;border-radius:7px;
  color:#c6ccdb;text-decoration:none}
#scenemenu li>a:hover{background:rgba(255,255,255,.07);color:#fff}
#scenemenu li>a.on{background:rgba(96,150,255,.16);color:#fff}
#scenemenu .no{color:#7f8aa3;font-variant-numeric:tabular-nums;min-width:14px}
#scenemenu .nm{font-weight:600}
#scenemenu .note{display:block;color:#79839a;font-size:11px;margin-top:2px;line-height:1.35}
#scenemenu .hd{color:#69738c;font-size:11px;padding:4px 9px 6px;letter-spacing:.04em}
`;

export function mountSceneMenu(activeId) {
  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.appendChild(style);

  const root = document.createElement('nav');
  root.id = 'scenemenu';

  const btn = document.createElement('button');
  btn.className = 'bar';
  btn.title = '씬 전환';
  btn.setAttribute('aria-label', '씬 전환');
  btn.innerHTML = '<i></i><i></i><i></i>';

  const ul = document.createElement('ul');
  const hd = document.createElement('li');
  hd.className = 'hd';
  hd.textContent = '뷰포트 — 저장된 씬';
  ul.appendChild(hd);

  for (const s of sceneList()) {
    const li = document.createElement('li');
    const a = document.createElement('a');
    // 같은 씬을 눌러도 다시 짓는다. "처음부터 다시" 가 이 메뉴의 유일한 동작이다
    a.href = `?scene=${encodeURIComponent(s.id)}`;
    if (s.id === activeId) a.className = 'on';
    a.innerHTML =
      `<span class="no">${s.no}</span>` +
      `<span><span class="nm">${s.name}</span>` +
      `<span class="note">${s.note}</span></span>`;
    li.appendChild(a);
    ul.appendChild(li);
  }

  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    root.classList.toggle('open');
  });
  // 바깥을 누르면 닫는다. 프리캠이 우클릭 드래그를 쓰므로 열린 채로 두면
  // 시선 조작 중에 메뉴가 화면을 가린다.
  document.addEventListener('click', () => root.classList.remove('open'));
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') root.classList.remove('open');
  });

  root.append(btn, ul);
  document.body.appendChild(root);
  return root;
}
