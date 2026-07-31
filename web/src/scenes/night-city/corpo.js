// 광장형 타워 — 기업 구역의 건물.
//
// ── 이 건물이 왜 이렇게 생겼는가 (docs/city.md 2기) ────────────────────────
// 공장이 성공하자 기업이 본사를 도심에 세웠다. 이 구역은 도시에서 유일하게
// **다시 설계된 곳**이다. 나머지는 1기의 계획 위에 3·4기가 덮인 결과인데,
// 여기만 기업이 자기 땅을 갈아엎고 새로 그렸다.
//
// 그래서 다른 구역과 반대되는 원칙으로 만든다.
//
//   · 대지를 꽉 채우지 않는다. 오히려 **비운다** — 광장이 부의 표시다.
//     번화가가 한 뼘도 못 비우는 것과 정확히 대비된다.
//   · 1층에 점포가 없다. 로비 하나뿐이다. 아무나 못 들어간다.
//   · 외벽이 매끈하다. 설비가 **안에** 있다 — 다시 설계했으므로 배관을
//     밖으로 뺄 필요가 없었다. 이 매끈함이 이 도시에서 가장 비싼 것이다.
//   · 골목이 없다. 뒷길은 계획에 없던 것이고 이 구역은 계획대로 유지된다.
//
// ── 광장에 무엇이 있는가 ───────────────────────────────────────────────────
// 비운 땅을 그냥 두면 공터다. 광장이 광장이 되려면 **관리되고 있다는 신호**가
// 필요하다. 조형된 화단, 수반, 열 맞춘 조명, 보안 볼라드. 전부 사람이 손을
// 대고 있다는 표시이고, 그게 이 구역의 성격이다.
import * as THREE from 'three';
import { autoBox, lathe, tubeBetween } from '../../core/profile.js';
import {
  faceFrame,
  SIDES,
  shrink,
  rectBox,
  upPlane,
  rectCenter,
  rectSize,
} from '../../core/boxfaces.js';
import { NEON, rgb01 } from '../../shared/neon.js';
import { neon } from '../../shared/masters.js';
import { PANEL_TILE, FLOOR_HEIGHT, CURB_HEIGHT } from './layout.js';
import { applySkin, facadeRelief } from './facade.js';
import { cylinderMass } from './massing.js';


// ── 광장 ───────────────────────────────────────────────────────────────────
//
// 타워가 서고 남은 땅 전부. 이 도시에서 유일하게 **비어 있는 것이 의도인** 공간이다.
function plaza(b, lot, tower, rng, mats, pools) {
  const Y = CURB_HEIGHT;
  const c = rectCenter(lot);
  const s = rectSize(lot);

  // 포장 — 인도와 다른 마감. 여기부터 사유지라는 표시다.
  b.add(upPlane(s.w, s.d, [c.x, Y + 0.02, c.z], [4, 4]), mats.plazaMat);

  // 단 — 광장이 인도보다 한 단 높다. 이 한 단이 "들어오려면 올라와야 한다" 는
  // 신호이고, 실제 기업 사옥이 늘 쓰는 방식이다.
  b.add(rectBox(shrink(lot, 0.4), Y, 0.34, PANEL_TILE), mats.plazaStepMat);

  const tc = rectCenter(tower);
  const ts = rectSize(tower);

  // 조형 화단 — 열을 맞춘다. 번화가 화분이 제각각인 것과 대비된다.
  const beds = rng.int(2, 4);
  for (let i = 0; i < beds; i++) {
    const t = (i + 0.5) / beds - 0.5;
    const px = c.x + (s.w >= s.d ? t * s.w * 0.62 : s.w * 0.34);
    const pz = c.z + (s.w >= s.d ? s.d * 0.34 : t * s.d * 0.62);
    const bw = s.w >= s.d ? 5.5 : 2.2;
    const bd = s.w >= s.d ? 2.2 : 5.5;
    b.add(autoBox(bw, 0.55, bd, [px, Y + 0.55, pz], 0.05), mats.plazaStepMat);
    // 식재 — 낮고 가지런하다
    for (let k = 0; k < 4; k++) {
      const u = (k / 3 - 0.5);
      b.sphere(
        rng.range(0.4, 0.6),
        [px + (s.w >= s.d ? u * bw * 0.6 : 0), Y + 1.0, pz + (s.w >= s.d ? 0 : u * bd * 0.6)],
        mats.foliageMat
      );
    }
  }

  // 수반 — 물이 있다는 것 자체가 사치다. 매립지 도시에서 특히 그렇다.
  if (rng.chance(0.5)) {
    const px = c.x + rng.range(-s.w * 0.24, s.w * 0.24);
    const pz = c.z + rng.range(-s.d * 0.24, s.d * 0.24);
    const rw = rng.range(4, 7);
    b.add(autoBox(rw, 0.4, rw * 0.7, [px, Y + 0.2, pz], 0.04), mats.plazaStepMat);
    b.add(upPlane(rw - 0.5, rw * 0.7 - 0.5, [px, Y + 0.42, pz]), mats.waterMat);
    pools.push({ kind: 'floor', x: px, y: Y + 0.03, z: pz, rx: rw, rz: rw, tint: rgb01(NEON.cool, 0.2) });
  }

  // 보안 볼라드 — 광장 경계를 따라 열 맞춰. 차를 막고 사람은 통과시킨다.
  const per = Math.max(4, Math.round(s.w / 7));
  for (let i = 0; i < per; i++) {
    const t = (i + 0.5) / per - 0.5;
    for (const sg of [-1, 1]) {
      b.cylinder(0.13, 0.15, 0.9, [c.x + t * s.w * 0.9, Y + 0.45, c.z + sg * s.d * 0.46], mats.metalMat, 8);
      b.cylinder(0.13, 0.15, 0.9, [c.x + sg * s.w * 0.46, Y + 0.45, c.z + t * s.d * 0.9], mats.metalMat, 8);
    }
  }

  // 광장등 — 열 맞춘 기둥등. 가로등과 달리 사방을 비춘다.
  const lamps = rng.int(3, 6);
  for (let i = 0; i < lamps; i++) {
    const a = (i / lamps) * Math.PI * 2;
    const lx = tc.x + Math.cos(a) * (ts.w / 2 + 5);
    const lz = tc.z + Math.sin(a) * (ts.d / 2 + 5);
    b.cylinder(0.1, 0.12, 4.2, [lx, Y + 2.1, lz], mats.metalMat, 8);
    b.add(lathe([[0.05, 0], [0.34, 0.3], [0.35, 0.32]], 10, [lx, Y + 4.2, lz]), mats.metalMat);
    b.sphere(0.16, [lx, Y + 4.1, lz], neon(0xd8e8ff));
    pools.push({ kind: 'floor', x: lx, y: Y + 0.04, z: lz, rx: 4.4, rz: 4.4, tint: rgb01(0xd8e8ff, 0.34) });
  }
}

// ── 로비 ───────────────────────────────────────────────────────────────────
//
// 1층 전체가 이것 하나다. 점포가 없다는 것이 이 구역의 정의다.
// 층고가 높아야 한다 — 높은 로비는 그 자체로 과시다.
function lobby(b, r, rng, mats, pools) {
  const H = FLOOR_HEIGHT * 2.4;
  const Y = CURB_HEIGHT;

  for (const side of SIDES) {
    const f = faceFrame(r, side);
    if (f.w < 6) continue;

    // 유리면 — 안이 밝다. 밤에도 로비만 켜져 있는 것이 기업 건물의 인상이다.
    const [gx, gz] = f.at(0, 0.08);
    const [gw, gd] = f.size(f.w * 0.9, 0.12);
    b.add(autoBox(gw, H * 0.8, gd, [gx, Y + H * 0.46, gz], 0.02), mats.lobbyLitMat);

    // 멀리온 — 유리면을 세로로 나눈다. 없으면 통짜 발광판이다.
    const n = Math.max(3, Math.round(f.w / 3.2));
    for (let i = 0; i <= n; i++) {
      const u = -f.w * 0.45 + f.w * 0.9 * (i / n);
      const [mx, mz] = f.at(u, 0.14);
      const [mw, md] = f.size(0.14, 0.2);
      b.box(mw, H * 0.8, md, [mx, Y + H * 0.46, mz], mats.frameMat);
    }

    // 캐노피 — 입구 위. 얇고 길게 내민다.
    const [cx2, cz2] = f.at(0, 1.6);
    const [cw, cd] = f.size(f.w * 0.6, 3.2);
    b.box(cw, 0.24, cd, [cx2, Y + H * 0.7, cz2], mats.metalMat);
    for (const su of [-0.26, 0.26]) {
      const [ax, az] = f.at(f.w * su, 0.1);
      const [bx, bz] = f.at(f.w * su, 3.0);
      b.add(tubeBetween([ax, Y + H * 0.86, az], [bx, Y + H * 0.7 + 0.12, bz], 0.05, 4), mats.metalMat);
    }
    b.add(
      upPlane(f.size(f.w * 0.55, 2.8)[0], f.size(f.w * 0.55, 2.8)[1], [cx2, Y + H * 0.7 - 0.14, cz2]),
      mats.deckUnderMat
    );
    pools.push({
      kind: 'floor', x: cx2, y: Y + 0.05, z: cz2, rx: 6.0, rz: 6.0,
      tint: rgb01(0xd8e8ff, 0.42),
    });
  }

  // 로비 슬래브 위 띠 — 기업 로고 자리. 간판이 아니라 **표식**이다.
  b.add(rectBox(shrink(r, -0.3), Y + H - 0.9, 0.9, PANEL_TILE), mats.panelMat);
  return H;
}

// ── 타워 한 채 ─────────────────────────────────────────────────────────────
//
// 몸통·로비·옥상·로고. 대지 배치와 분리해 둔 이유는 **한 대지에 여러 채**를
// 세울 수 있어야 하기 때문이다 (아래 corpoCluster).
// st 는 아래 CORP_STYLES 에서 고른 양식이다. 단동도 양식을 따라야 한다 —
// 군집이 안 서는 대지가 적지 않은데 거기만 양식이 없으면 기업 구역 안에서
// "이건 어느 기업" 이 안 읽히는 건물이 섞인다.
function oneTower(b, tower, rng, mats, height, pools, signs, st) {
  const Y = CURB_HEIGHT;
  const lobbyH = lobby(b, tower, rng, mats, pools);

  // 샤프트 — 불 켜진 창. 여기가 이번 수정의 핵심이다.
  //
  // 원래는 corpoSkinMat 단색 상자였다. "설비가 안에 있어 매끈하다" 는 의도는
  // 맞았지만, **매끈함과 검음은 다르다.** 레퍼런스의 기업 타워는 매끈하면서
  // 창이 전부 켜져 있다. 커튼월이 그 둘을 동시에 만족하는 유형이다.
  // 세장비는 여기서도 지킨다 (군집 쪽 주석 참고)
  const ts = rectSize(tower);
  const slim = Math.min(ts.w, ts.d) * rng.range(4.2, 7.0);
  const top = Math.min(Math.max(lobbyH + FLOOR_HEIGHT * 8, height), Math.max(lobbyH + FLOOR_HEIGHT * 8, slim));
  // 트윈은 단동에서 뺀다 — 한 채짜리 대지에 쌍둥이를 세우면 그건 두 채다
  let form = st.forms.find((f) => f !== 'twin') ?? 'slab';
  if (form === 'round' && Math.min(ts.w, ts.d) < 26) form = 'setback';
  let sh;
  if (form === 'slab') sh = shaftSlab(b, tower, Y + lobbyH, top, mats, st, rng);
  else if (form === 'round') sh = shaftRound(b, tower, Y + lobbyH, top, mats, st, rng);
  else sh = shaftSetback(b, tower, Y + lobbyH, top, rng, mats, st);

  const apex = crownOf(b, sh.cap, top, rng, mats, st);

  // 기업 로고 — 크고 하나뿐이다. 번화가가 간판을 겹겹이 쌓는 것과 대비된다.
  if (rng.chance(0.8)) megaBanner(signs, rng, sh.solid, Y + lobbyH, sh.safeTop, SIDES[rng.int(0, 3)]);

  return { top: apex, solid: sh.solid };
}

// ── 한 동 (광장형) ─────────────────────────────────────────────────────────
//
// 대지를 꽉 채우지 않는다. **비우는 것이 요점**이다.
// 번화가가 한 뼘도 못 비우는 것과 정확히 대비된다.
//
// 다만 인셋을 0.20~0.31 로 잡았더니 58m 마당이 34m 짜리 탑이 됐다. 광장을
// 남기는 것과 탑을 가늘게 만드는 것은 다른 얘기다 — 레퍼런스의 단동 타워는
// 폭이 40~60m 다. 인셋을 줄이고 대신 광장은 대지 가장자리에서 확보한다.
export function corpoTower(b, lot, rng, mats, height, pools, signs, label) {
  const s = rectSize(lot);
  const inset = Math.min(s.w, s.d) * rng.range(0.10, 0.19);
  const tower = shrink(lot, inset);
  if (tower.x1 - tower.x0 < 8 || tower.z1 - tower.z0 < 8) return null;

  plaza(b, lot, tower, rng, mats, pools);
  const st = CORP_STYLES[rng.int(0, CORP_STYLES.length - 1)];
  // 표시를 여기서 다시 건다. 부르는 쪽이 'podium' 으로 열어 뒀으므로,
  // 안 걸면 타워가 통째로 받침 기록에 들어가 **원장에서 건물이 사라진다.**
  // 실제로 그렇게 해서 기업 건물이 0채로 신고됐다.
  if (label) b.mark('building', `${label}#0`, { zone: '기업', style: st.name });
  const t = oneTower(b, tower, rng, mats, height, pools, signs, st);
  // solid 를 넘긴다. 원통 타워는 tower 사각형 안에 내접하므로 모서리가
  // 비어 있고, rect 를 앵커로 주면 브릿지가 그 허공에 닿는다.
  return { top: t.top, towers: [{ rect: tower, solid: t.solid, top: t.top }] };
}

// ── 기업 양식 ──────────────────────────────────────────────────────────────
//
// "저건 어느 기업 건물" 이 읽혀야 한다. 같은 기업 구역이라도 단지마다 주인이
// 다르므로 **외벽·띠·크라운·타워 형태**가 한 벌로 묶여 달라진다.
//
// 겉면 수치만 바꾸는 것과 다른 점: forms 가 다르면 **실루엣**이 달라진다.
// ── 왜 다시 만들었나 (사용자 지적 2회차) ──────────────────────────────────
// "어느 세상 사람이 건축을 이렇게 하겠나." 맞는 말이었다. 레퍼런스 컨셉아트와
// 나란히 놓고 보니 차이가 넷이었고, 그중 첫째가 나머지를 전부 설명한다.
//
//   1) 레퍼런스의 기업 타워는 **창이 켜져 있다.** 수천 개의 작은 불빛이 면을
//      채운다. 그런데 이 파일은 파사드 체계(facade.js)를 **한 번도 부르지
//      않았다** — 단색 상자만 그렸다. 주거 구역은 살아 보이는데 기업 구역만
//      검은 덩어리였던 이유가 통째로 이것이다. 도시에서 제일 비싼 구역이
//      제일 죽어 보였다.
//   2) 레퍼런스의 타워는 **넓고 서로 붙어 있다.** 여기는 폭 26m 에 간격 10m,
//      즉 폭의 40%가 틈이라 벽이 아니라 젓가락 다발이 됐다.
//   3) 레퍼런스의 광고판은 **20~30층을 세로로 흐른다.** 여기는 9~15m 짜리,
//      세 층이었다.
//   4) 튀어나온 크림색 선반. 세트백 띠 shrink(-0.4) 와 두께 0.4m 스카이브리지
//      판이 그것이다. 레퍼런스에 그런 것은 없다 — **설비층은 안으로 들어간다.**
//
// ── 기업 양식 ──────────────────────────────────────────────────────────────
//
// "저건 어느 기업 건물" 이 읽혀야 한다. 단지마다 주인이 다르므로 **파사드
// 유형·설비띠·크라운·타워 형태**가 한 벌로 묶여 달라진다.
//
// face 가 이번 수정의 핵심이다. facade.js 의 유형을 그대로 쓴다 —
// 기업만 자기 파사드 체계를 따로 갖고 있을 이유가 없었다.
const CORP_STYLES = [
  // 유리 커튼월. 유리가 곧 벽이라 매끈하다 — 이 구역의 원래 의도와도 맞는다
  { name: '유리', skin: 'corpoSkinMat', band: 'metalMat', crown: 'spire', tint: 0xd8e8ff,
    face: 'curtain', sheet: 0, forms: ['slab', 'setback', 'round'] },
  // 벽이 주인공이고 창은 구멍. 벽기둥(필래스터)이 리듬을 만든다
  { name: '석재', skin: 'panelMat', band: 'frameMat', crown: 'block', tint: 0xffe3c2,
    face: 'grid', sheet: 1, forms: ['setback', 'slab', 'twin'] },
  // 어두운 유리 위로 구조재가 나온다. 레퍼런스 왼쪽 타워의 X자 가새가 이것
  { name: '외골격', skin: 'corpoSkinMat', band: 'metalMat', crown: 'mast', tint: 0x9fe8ff,
    face: 'exo', sheet: 2, forms: ['round', 'twin', 'setback'] },
];

// ── 몸통 한 채 ─────────────────────────────────────────────────────────────
//
// 껍데기 + **불 켜진 창** + 설비층. 형태 넷이 전부 이것을 부른다.
//
// 설비층은 몇 층마다 오는 창 없는 층이다. **안으로 들어간다** — 밖으로
// 내밀면 선반이 되고, 그 선반이 사용자가 지적한 "튀어나온 크림색 판" 이었다.
// 그래서 껍데기를 통짜로 그리지 않고 토막으로 끊어, 그 사이에 한 치수 작은
// 어두운 상자를 끼운다. 레퍼런스의 가로 띠가 정확히 이 구조다.
const MECH_EVERY = FLOOR_HEIGHT * 8;

function clad(b, r, y0, top, mats, st, rng) {
  const mechH = FLOOR_HEIGHT * 0.9;
  let y = y0;
  while (top - y > 0.5) {
    const segTop = Math.min(top, y + MECH_EVERY);
    const capped = segTop < top;
    const h = segTop - y - (capped ? mechH : 0);
    if (h > 1.5) {
      b.add(rectBox(r, y, h, PANEL_TILE), mats[st.skin]);
      applySkin(b, r, y, h, st.face, st.sheet, mats, rng);
      // 석재 양식만 요철이 있다. 커튼월·외골격은 applySkin 안에서 처리된다
      if (st.face === 'grid') facadeRelief(b, r, y, h, 'grid', rng, mats);
    }
    if (capped) b.add(rectBox(shrink(r, 0.5), y + Math.max(h, 0), mechH, PANEL_TILE), mats[st.band]);
    y = segTop;
  }
}

// ── 타워 형태 넷 ───────────────────────────────────────────────────────────
//
// 전에는 형태가 **하나뿐**이었다 (rectBox 한 개). 단지를 만들어도 같은 상자가
// 여러 개 늘어설 뿐이라 "단동을 밀어 붙인 덩어리" 로 보였다. 형태가 갈려야
// 단지가 단지로 읽힌다.

// ── 형태가 돌려주는 것 셋 ──────────────────────────────────────────────────
//
// 이 프로젝트의 단골 결함이 "같은 값을 두 곳에서 따로 계산" 이다. 타워도 딱
// 그 자리에 있었다 — **그린 것**과 **그렸다고 신고한 것**이 달랐다.
//
//   cap      크라운이 얹힐 사각형.
//            전에는 언제나 밑단 rect 로 그렸다. 세트백은 위로 갈수록 좁아지는데
//            크라운만 밑단 폭이라 옥상이 공중에 넓게 뜬 선반이 됐다.
//   solid    **전 높이에 걸쳐 확실히 차 있는** 사각형. 브릿지·계단이 여기에 붙는다.
//            원통은 사각형에 내접하므로 네 모서리가 비어 있다. 그런데 앵커로는
//            rect 를 그대로 넘겼고, 그래서 브릿지 끝이 모서리 허공에 닿았다.
//   safeTop  그 solid 에 아직 벽이 있는 가장 높은 지점. 세로 광고판이 여기를
//            넘으면 좁아진 상단 바깥에 붙어 허공에 뜬다.
//
// 셋 다 실제로 배치 검사에 걸린 것이다 — 짐작이 아니라 측정으로 나왔다.

// 판형 — 넓고 얇다. 세로 핀이 없으면 그냥 판때기로 보인다.
//
// 핀은 **표면에서 살짝 나온 리브**다. 전에는 타워를 관통하는 전체 깊이 상자를
// 4.5m 마다 꽂았는데, 그건 리브가 아니라 건물을 썰어 놓은 것이다.
function shaftSlab(b, r, y0, top, mats, st, rng) {
  clad(b, r, y0, top, mats, st, rng);
  const s = rectSize(r);
  const c = rectCenter(r);
  const alongX = s.w >= s.d;
  const span = alongX ? s.w : s.d;
  const n = Math.max(3, Math.round(span / 6.0));
  for (let i = 1; i < n; i++) {
    const t = (i / n - 0.5) * span;
    for (const sg of [-1, 1]) {
      const px = alongX ? c.x + t : c.x + sg * (s.w / 2 + 0.25);
      const pz = alongX ? c.z + sg * (s.d / 2 + 0.25) : c.z + t;
      b.box(alongX ? 0.55 : 0.5, top - y0, alongX ? 0.5 : 0.55,
        [px, (y0 + top) / 2, pz], mats[st.band]);
    }
  }
  return { cap: r, solid: r, safeTop: top };
}

// 세트백 — 여러 단으로 물러나며 올라간다. 아르데코 마천루의 문법.
function shaftSetback(b, r, y0, top, rng, mats, st) {
  const steps = rng.int(2, 4);
  let cur = r;
  let y = y0;
  let safeTop = top;
  for (let i = 0; i < steps; i++) {
    const h = (top - y0) * (i === steps - 1 ? 1 : rng.range(0.28, 0.42));
    const yy = Math.min(top, y + h);
    clad(b, cur, y, yy, mats, st, rng);
    y = yy;
    if (y >= top) break;
    const cs = rectSize(cur);
    const next = shrink(cur, Math.min(cs.w, cs.d) * rng.range(0.07, 0.13));
    const ns = rectSize(next);
    // 16m 아래로는 안 줄인다. 8m 로 두었더니 단이 거듭되며 꼭대기가 바늘이
    // 됐다 — 세트백은 **덩어리를 깎는 것**이지 뾰족하게 만드는 것이 아니다.
    if (ns.w < 16 || ns.d < 16) {
      // 더 못 줄인다. 남은 높이는 지금 단으로 마저 올린다 —
      // 안 그러면 top 에 못 닿아 크라운이 허공에 뜬다
      clad(b, cur, y, top, mats, st, rng);
      safeTop = top;
      break;
    }
    if (i === 0) safeTop = yy; // 첫 단이 끝나는 곳까지가 밑단 폭의 벽이다
    cur = next;
  }
  return { cap: cur, solid: r, safeTop };
}

// 원통 — 층 띠가 없으면 파이프로 보인다.
//
// cylinderMass 가 파사드 시트를 둘레에 감아 준다. 사각형이 아니라 applySkin 을
// 못 쓰는 유일한 형태다.
function shaftRound(b, r, y0, top, mats, st, rng) {
  const c = rectCenter(r);
  const s = rectSize(r);
  const rad = Math.min(s.w, s.d) / 2;
  const skin = mats.skins[st.face === 'exo' ? 'curtain' : st.face];
  const set = skin.sets[st.sheet % skin.sets.length];
  const mat = skin.mats[st.sheet % skin.mats.length];
  const cyl = cylinderMass(b, r, y0, top - y0, mat, [
    set.grid.cols * skin.pitch,
    set.grid.rows * FLOOR_HEIGHT,
  ]);
  // cylinderMass 는 옆면을 열어 둔 채로 뚜껑 기하만 돌려준다. 안 붙이면
  // 위에서 봤을 때 속이 뚫린 관이다.
  b.add(cyl.cap, mats[st.band]);
  for (let y = y0 + MECH_EVERY; y < top - 3; y += MECH_EVERY) {
    b.cylinder(rad * 1.035, rad * 1.035, FLOOR_HEIGHT * 0.9, [c.x, y, c.z], mats[st.band], 16);
  }
  // 원통에 **내접하는 정사각형**. 반지름 r 원에 내접하는 정사각형의 반변은
  // r/√2 다. 이 안쪽만이 어느 방향에서 봐도 벽이 있는 영역이므로, 크라운도
  // 앵커도 이것을 쓴다 — rect 를 그대로 넘겨서 브릿지가 모서리 허공에 닿았다.
  const q = rad * 0.707;
  const sq = { x0: c.x - q, x1: c.x + q, z0: c.z - q, z1: c.z + q };
  return { cap: sq, solid: sq, safeTop: top };
}

// 트윈 — 두 축을 갈라 세우고 위에서 다시 묶는다.
// 사용자 지시로 **기업 전용**이다. 주거·일반 타워에서는 뺐다 (massing.js).
function shaftTwin(b, r, y0, top, rng, mats, st) {
  const s = rectSize(r);
  const c = rectCenter(r);
  const alongX = s.w >= s.d;
  const slot = (alongX ? s.w : s.d) * 0.4;
  let lead = r;
  for (const sgn of [-1, 1]) {
    const a = alongX ? c.x + sgn * (s.w / 2 - slot) : r.x0;
    const bx = alongX ? c.x + sgn * (s.w / 2) : r.x1;
    const az = alongX ? r.z0 : c.z + sgn * (s.d / 2 - slot);
    const bz = alongX ? r.z1 : c.z + sgn * (s.d / 2);
    const fix = {
      x0: Math.min(a, bx), x1: Math.max(a, bx),
      z0: Math.min(az, bz), z1: Math.max(az, bz),
    };
    clad(b, fix, y0, top, mats, st, rng);
    if (sgn > 0) lead = fix;
  }
  // 두 동을 잇는 공중 슬래브 — 트윈의 정체성. 두께가 있어야 다리로 읽힌다
  const gapH = y0 + (top - y0) * rng.range(0.55, 0.75);
  b.add(rectBox(shrink(r, 0.6), gapH, FLOOR_HEIGHT * 2.2, PANEL_TILE), mats[st.skin]);
  b.add(rectBox(shrink(r, 1.4), gapH + 0.8, FLOOR_HEIGHT * 1.3, PANEL_TILE), mats.bridgeWinMat);
  // 가운데는 슬래브 높이에서만 차 있다. 붙일 것은 **한쪽 동**에 붙여야 한다
  return { cap: lead, solid: lead, safeTop: top };
}

// ── 크라운 ─────────────────────────────────────────────────────────────────
//
// 레퍼런스의 옥상에 **빈 것이 하나도 없다.** 설비 옥탑, 냉각탑, 안테나 숲,
// 접시, 항공장애등이 얹혀 있다. 전에는 첨탑 하나뿐이라 연필 끝처럼 보였다.
//
// 양식별로 끝이 다른 것은 그대로 둔다 — 실루엣의 끝이라 멀리서도 구별된다.
function crownOf(b, r, top, rng, mats, st) {
  const c = rectCenter(r);
  const s = rectSize(r);
  const min = Math.min(s.w, s.d);

  // 파라펫 — 옥상 난간. 이게 있어야 지붕이 '뚜껑' 이 아니라 '옥상' 이 된다
  b.add(rectBox(shrink(r, -0.4), top, 1.1, PANEL_TILE), mats[st.band]);

  // 설비 옥탑 — 엘리베이터 기계실. 어느 고층 건물에나 있다
  const penH = rng.range(4.5, 9.0);
  const pen = shrink(r, min * rng.range(0.16, 0.26));
  b.add(rectBox(pen, top + 1.1, penH, PANEL_TILE), mats[st.band]);
  let deck = top + 1.1 + penH;

  // 냉각탑 — 옥탑 위에 둘셋. 원통에 뚜껑
  const cools = rng.int(2, 4);
  const ps = rectSize(pen);
  const pc = rectCenter(pen);
  for (let i = 0; i < cools; i++) {
    const t = (i + 0.5) / cools - 0.5;
    const rad = Math.min(2.4, ps.w * 0.14);
    b.cylinder(rad, rad, rng.range(2.2, 3.6),
      [pc.x + t * ps.w * 0.62, deck + 1.6, pc.z + rng.range(-0.2, 0.2) * ps.d], mats.ductMat, 10);
  }

  // 안테나 숲 — 하나가 아니라 여럿, 길이가 제각각. 이것이 레퍼런스의 인상이다
  const masts = rng.int(3, 6);
  for (let i = 0; i < masts; i++) {
    const a = (i / masts) * Math.PI * 2 + rng.range(0, 0.6);
    const rr = min * rng.range(0.12, 0.3);
    const mx = c.x + Math.cos(a) * rr;
    const mz = c.z + Math.sin(a) * rr;
    const mh = rng.range(4, 13);
    b.cylinder(0.09, 0.13, mh, [mx, deck + mh / 2, mz], mats.metalMat, 6);
    if (rng.chance(0.4)) b.sphere(0.16, [mx, deck + mh, mz], neon(0xff2a2a));
  }

  if (st.crown === 'spire') {
    const mast = rng.range(16, 38);
    b.add(lathe([[0.9, 0], [0.34, mast * 0.7], [0.08, mast]], 8, [c.x, deck, c.z]), mats.metalMat);
    for (let i = 1; i <= 4; i++) b.sphere(0.24, [c.x, deck + (mast * i) / 4.2, c.z], neon(0xff2a2a));
    return deck + mast;
  }
  if (st.crown === 'block') {
    // 헬리패드 — 여기 사람이 헬기로 온다는 뜻이다. 옥탑 옆에 따로 앉힌다
    const rad = min * 0.24;
    b.cylinder(rad, rad, 0.35, [c.x, deck + 0.2, c.z], mats.plazaStepMat, 16);
    b.cylinder(rad * 0.68, rad * 0.68, 0.06, [c.x, deck + 0.42, c.z], mats.paintMat, 16);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      b.sphere(0.13, [c.x + Math.cos(a) * rad, deck + 0.5, c.z + Math.sin(a) * rad], neon(0xff2a2a));
    }
    return deck + 0.6;
  }
  // 통신탑 — 뼈대가 밖으로 나온 양식이라 크라운도 구조물이다
  const H = rng.range(20, 34);
  for (const sgn of [-1, 1]) {
    b.add(tubeBetween([c.x + sgn * s.w * 0.18, deck, c.z], [c.x, deck + H, c.z], 0.18, 5), mats.metalMat);
    b.add(tubeBetween([c.x, deck, c.z + sgn * s.d * 0.18], [c.x, deck + H, c.z], 0.18, 5), mats.metalMat);
  }
  // 접시 안테나 — 통신 기업의 표식
  for (let i = 0; i < rng.int(2, 4); i++) {
    const a = (i / 3) * Math.PI * 2;
    b.add(lathe([[0, 0], [1.5, 0.5], [1.6, 0.62]], 10,
      [c.x + Math.cos(a) * min * 0.22, deck + rng.range(2, 8), c.z + Math.sin(a) * min * 0.22]),
      mats.metalMat);
  }
  for (let i = 1; i <= 4; i++) b.sphere(0.26, [c.x, deck + (H * i) / 4.2, c.z], neon(0xff2a2a));
  return deck + H;
}

// ── 기단 저층부 ────────────────────────────────────────────────────────────
//
// ── 사용자 지적 ───────────────────────────────────────────────────────────
// "어느 세계의 어느 나라가 1층 로비를 이렇게 해서 위에 건물들을 기둥마냥
//  세우냐고.. 무슨양식인데.."
//
// 맞는 말이었다. 그때 기단은 이랬다.
//   · 민짜 상자 하나 (창이 없다)
//   · 얇은 띠 하나
//   · 네 면에 깊이 0.3m 짜리 발광 띠 넷 — 로비가 아니라 **줄무늬**다
//
// 즉 사람 눈높이에 문도, 기둥도, 처마도, 창도 없었다. 밑은 새하얀 광장 단이라
// 탁자 상판으로 읽히고, 그 위에 타워가 얹혀 있으니 정확히 "탁자 위의 기둥" 이다.
//
// 저층부가 저층부이려면 **그 자체가 건물**이어야 한다. 다섯을 넣는다.
//
//   1) 필로티 열주   1층을 안으로 물리고 기둥열이 위를 받는다. 기둥이 실제로
//                    무언가를 떠받치면 "기둥마냥" 이 뒤집힌다 — 위가 얹힌 게
//                    아니라 아래가 받치는 것이 된다
//   2) 물린 유리면   기둥 뒤로 로비 유리. 깊이가 있어야 실내로 읽힌다
//   3) 기단 본체     2층 위로는 **창이 있는** 벽. clad 를 그대로 쓴다
//   4) 주 출입구     한 면에 캐노피와 넓은 문. 어디로 들어가는지 보여야 한다
//   5) 옥상 파라펫   기단 지붕이 난간을 갖는다. 그래야 '지붕' 이지 '뚜껑' 이 아니다
function podiumBuilding(b, r, podH, rng, mats, st, pools, entrySide) {
  const Y = CURB_HEIGHT;
  const GROUND = FLOOR_HEIGHT * 2.2; // 로비 층고. 높아야 과시가 된다
  const RECESS = 2.2;                // 유리면이 기둥 뒤로 물러난 깊이

  // 1) 물린 1층 — 유리 상자. 기둥은 이 바깥에 선다
  const core = shrink(r, RECESS);
  b.add(rectBox(core, 0, Y + GROUND, PANEL_TILE), mats[st.skin]);
  for (const side of SIDES) {
    const f = faceFrame(core, side);
    if (f.w < 6) continue;
    // 2) 로비 유리 — 면 전체. 전에는 폭의 80%짜리 띠 하나였다.
    //
    // **밝은 로비는 출입구 쪽 한 면뿐이다.** 처음에 네 면을 다 밝히니
    // 250m 짜리 새하얀 벽이 됐다 — 로비가 아니라 조명 상자다. 나머지 면은
    // 어두운 유리로 둔다. 실제로도 밤에 불이 켜진 곳은 로비 한 곳이고,
    // 그 대비가 "여기가 입구" 를 말해 준다.
    const lit = side === entrySide;
    const [gx, gz] = f.at(0, 0.1);
    const [gw, gd] = f.size(f.w * 0.98, 0.16);
    b.add(
      autoBox(gw, GROUND * 0.82, gd, [gx, Y + GROUND * 0.47, gz], 0.02),
      lit ? mats.lobbyLitMat : mats.vitrineGlassMat
    );
    // 멀리온 — 없으면 통짜 발광판이다
    const n = Math.max(4, Math.round(f.w / 3.4));
    for (let i = 0; i <= n; i++) {
      const u = -f.w * 0.49 + f.w * 0.98 * (i / n);
      const [mx, mz] = f.at(u, 0.2);
      const [mw, md] = f.size(0.16, 0.26);
      b.box(mw, GROUND * 0.82, md, [mx, Y + GROUND * 0.47, mz], mats.frameMat);
    }
  }

  // 1) 필로티 열주 — 기단 모서리 선 위. 위를 실제로 받는다
  const cs = rectSize(r);
  const cc = rectCenter(r);
  const COL = 1.0;
  for (const side of SIDES) {
    const f = faceFrame(r, side);
    if (f.w < 6) continue;
    const n = Math.max(2, Math.round(f.w / 8.5));
    for (let i = 0; i <= n; i++) {
      const u = -f.w / 2 + f.w * (i / n);
      const [px, pz] = f.at(u, -COL / 2);
      b.box(COL, Y + GROUND, COL, [px, (Y + GROUND) / 2, pz], mats[st.band]);
    }
  }

  // 3) 기단 본체 — 1층 위로. **창이 있다.** clad 가 설비층까지 넣어 준다
  const bodyTop = Y + podH;
  if (bodyTop > Y + GROUND + FLOOR_HEIGHT) {
    clad(b, r, Y + GROUND, bodyTop, mats, st, rng);
  }

  // 5) 옥상 파라펫 + 처마. 기단 지붕이 난간을 가져야 '지붕' 이다
  b.add(rectBox(shrink(r, -0.8), bodyTop - 0.9, 0.9, PANEL_TILE), mats[st.band]);
  b.add(rectBox(shrink(r, 0.6), bodyTop, 1.3, PANEL_TILE), mats[st.band]);

  // 4) 주 출입구 — 한 면에만. 캐노피가 있어야 "여기가 입구" 가 읽힌다
  const f = faceFrame(r, entrySide);
  if (f.w >= 10) {
    const [cx, cz] = f.at(0, 3.4);
    const [cw, cd] = f.size(Math.min(f.w * 0.42, 22), 7.0);
    b.box(cw, 0.7, cd, [cx, Y + GROUND * 0.72, cz], mats[st.band]);
    b.add(upPlane(cw * 0.94, cd * 0.94, [cx, Y + GROUND * 0.72 - 0.38, cz]), mats.deckUnderMat);
    // 캐노피를 매다는 인장재
    for (const su of [-0.3, 0.3]) {
      const [ax, az] = f.at(f.w * su, 0.2);
      const [bx2, bz2] = f.at(f.w * su, 6.4);
      b.add(tubeBetween([ax, Y + GROUND * 0.98, az], [bx2, Y + GROUND * 0.72 + 0.35, bz2], 0.06, 4), mats.metalMat);
    }
    pools.push({ kind: 'floor', x: cx, y: Y + 0.06, z: cz, rx: 9, rz: 9, tint: rgb01(0xd8e8ff, 0.5) });
  }
  // 열주 밑 그림자를 밝힌다. 안 그러면 1층이 검은 띠가 된다
  pools.push({
    kind: 'floor', x: cc.x, y: Y + 0.04, z: cc.z,
    rx: cs.w * 0.52, rz: cs.d * 0.52, tint: rgb01(st.tint, 0.22),
  });
}

// ── 세로 대형 광고판 ───────────────────────────────────────────────────────
//
// 레퍼런스의 얼굴이다. DATA INC, KIROSHI — 20~30층을 세로로 흐른다.
// 전에는 9~15m 짜리, 즉 세 층이었다. 크기가 이 도시의 위압감을 만드는데
// 그걸 명함만 하게 달아 놨던 셈이다.
function megaBanner(signs, rng, rect, y0, bodyTop, side) {
  const s = rectSize(rect);
  const room = bodyTop - y0 - 12;
  if (room < 26) return;
  const h = Math.min(room, rng.range(42, 96));
  signs.push({
    kind: 'mega',
    rect,
    side,
    y: bodyTop - 8 - h,
    w: Math.min(s.w, s.d) * rng.range(0.3, 0.46),
    h,
    scheme: rng.int(0, 5),
  });
}

// ── 단지 ───────────────────────────────────────────────────────────────────
//
// ── 왜 다시 만들었나 (사용자 지적) ────────────────────────────────────────
// 처음 군집은 마당을 격자로 나눠 **똑같은 타워를 하나씩 꽂았다.** 그래서
// 단지가 아니라 "단동을 밀어 붙인 덩어리" 로 보였다. 크기만 다른 같은
// 건물이라 서로 아무 관계가 없었기 때문이다.
//
// 단지가 단지이려면 건물들이 **서로를 알아야** 한다. 넷을 넣는다.
//
//   1) 공유 기단     여러 타워가 한 저층부에서 솟는다. 따로 선 게 아니다
//   2) 형태 차이     판형·세트백·원통·트윈. 실루엣이 갈려야 덩어리가 안 된다
//   3) 안뜰         칸 하나를 비운다. 꽉 채우면 그냥 벽 덩어리다
//   4) 스카이브리지  타워끼리 잇는다. "한 회사" 라는 증거
//
// 그리고 단지마다 **기업 양식**을 하나 고른다 (CORP_STYLES).
export function corpoCluster(b, lot, rng, mats, height, pools, signs, label) {
  const s = rectSize(lot);
  const inset = Math.min(s.w, s.d) * rng.range(0.05, 0.10);
  let yard = shrink(lot, inset);
  let ys = rectSize(yard);

  // 앞마당 — 대지가 넉넉할 때만. 좁은 대지에서 앞마당까지 빼면 탑이 판자가 된다.
  const front = SIDES[rng.int(0, 3)];
  if (Math.min(ys.w, ys.d) > 46) {
    const court = Math.min(s.w, s.d) * rng.range(0.06, 0.12);
    if (front === 'px') yard = { ...yard, x1: yard.x1 - court };
    else if (front === 'nx') yard = { ...yard, x0: yard.x0 + court };
    else if (front === 'pz') yard = { ...yard, z1: yard.z1 - court };
    else yard = { ...yard, z0: yard.z0 + court };
    ys = rectSize(yard);
  }
  if (Math.min(ys.w, ys.d) < 26) return null;

  plaza(b, lot, yard, rng, mats, pools);

  const st = CORP_STYLES[rng.int(0, CORP_STYLES.length - 1)];
  const Y = CURB_HEIGHT;

  // ── 1) 공유 기단 ────────────────────────────────────────────────────────
  // 타워들이 여기서 솟는다. 이것 하나로 "따로 선 건물들" 이 "한 단지" 가 된다.
  const podH = FLOOR_HEIGHT * rng.int(3, 5);
  podiumBuilding(b, yard, podH, rng, mats, st, pools, front);
  pools.push({
    kind: 'floor', x: (yard.x0 + yard.x1) / 2, y: Y + 0.05, z: (yard.z0 + yard.z1) / 2,
    rx: ys.w * 0.6, rz: ys.d * 0.6, tint: rgb01(st.tint, 0.3),
  });

  // ── 2) 칸 나누기 ────────────────────────────────────────────────────────
  //
  // 레퍼런스의 타워는 폭이 30~60m 다. 여기는 26m 칸에 간격 8~13m 였으니
  // **폭의 40%가 틈**이었고, 그래서 벽이 아니라 젓가락 다발로 보였다.
  //
  // 이제 한 채의 최소 폭을 정해 두고 거기서 칸 수를 역산한다. 안 들어가면
  // 군집을 포기하고 단동으로 떨어진다 — 66m 대지에 작은 타워 넷을 억지로
  // 밀어 넣는 것보다 **큰 것 하나**가 레퍼런스에 가깝다.
  const MIN_TOWER = 30;
  const gap = rng.range(3.5, 7.0);
  const div = (v) => Math.max(1, Math.min(3, Math.floor((v + gap) / (MIN_TOWER + gap))));
  const cols = div(ys.w);
  const rows = div(ys.d);
  if (cols * rows < 2) return null;
  const cw = (ys.w - gap * (cols - 1)) / cols;
  const cd = (ys.d - gap * (rows - 1)) / rows;
  if (Math.min(cw, cd) < 16) return null;

  const total = cols * rows;
  // ── 3) 안뜰 ─────────────────────────────────────────────────────────────
  // 칸이 넷 이상이면 하나를 비운다. 꽉 채우면 그냥 벽 덩어리다.
  const court = total >= 4 ? rng.int(0, total - 1) : -1;

  // 기업 구역은 내력상 초고층이다 (city.md 2기). 군집의 바닥을 보장한다 —
  // 격차는 구역 **사이**에서 만들지 기업 구역 **안**에서 만드는 것이 아니다.
  const base = Math.max(height, 128);
  let hero = rng.int(0, total - 1);
  if (hero === court) hero = (hero + 1) % total;

  const out = [];
  let tallest = 0;
  let idx = 0;

  for (let cxi = 0; cxi < cols; cxi++) {
    for (let czi = 0; czi < rows; czi++) {
      const x0 = yard.x0 + cxi * (cw + gap);
      const z0 = yard.z0 + czi * (cd + gap);
      const t = { x0, x1: x0 + cw, z0, z1: z0 + cd };
      const me = idx++;

      if (me === court) {
        // 안뜰 — 기단 위 유리 지붕. 밑에서 빛이 샌다.
        //
        // **표시를 따로 연다.** 안 열면 직전 타워의 기록에 안뜰이 딸려
        // 들어가서 그 타워 상자가 안뜰까지 늘어나고, 배치 검사가
        // "건물 8쌍이 최대 18m 겹친다" 로 잡는다. 실제로 그랬다.
        b.mark('podium', label + ':court');
        b.add(
          upPlane(cw * 0.9, cd * 0.9, [(t.x0 + t.x1) / 2, Y + podH + 0.3, (t.z0 + t.z1) / 2]),
          mats.vitrineGlassMat
        );
        pools.push({
          kind: 'floor', x: (t.x0 + t.x1) / 2, y: Y + podH + 0.35, z: (t.z0 + t.z1) / 2,
          rx: cw * 0.5, rz: cd * 0.5, tint: rgb01(st.tint, 0.5),
        });
        continue;
      }

      // ── 세장비 ────────────────────────────────────────────────────────
      // 높이를 폭과 무관하게 뽑았더니 20m 폭에 170m 짜리, 즉 세장비 8.5 인
      // 바늘이 섰다. 레퍼런스의 마천루는 4~7 사이다 — 그보다 가늘면 탑이
      // 아니라 안테나로 보이고, 무엇보다 **덩어리감**이 사라진다.
      // 압박감은 높이가 아니라 **가까이 있는 큰 덩어리**에서 온다.
      const want = me === hero ? base * rng.range(1.0, 1.35) : base * rng.range(0.68, 1.0);
      const h = Math.min(want, Math.min(cw, cd) * rng.range(4.2, 7.0));
      const top = Y + podH + h;
      b.mark('building', label + '#' + me, { zone: '기업', style: st.name });

      // 원통은 좁은 칸에서 파이프가 된다 (반지름이 짧은 변의 절반이므로).
      // 26m 아래면 다른 형태로 넘긴다.
      let form = st.forms[rng.int(0, st.forms.length - 1)];
      if (form === 'round' && Math.min(cw, cd) < 26) form = 'setback';
      // 형태는 **마지막 단**을 돌려준다. 크라운이 밑단 폭으로 그려지면
      // 세트백 타워 옥상이 공중에 넓게 뜬 선반이 된다.
      let sh;
      if (form === 'slab') sh = shaftSlab(b, t, Y + podH, top, mats, st, rng);
      else if (form === 'setback') sh = shaftSetback(b, t, Y + podH, top, rng, mats, st);
      else if (form === 'round') sh = shaftRound(b, t, Y + podH, top, mats, st, rng);
      else sh = shaftTwin(b, t, Y + podH, top, rng, mats, st);

      const apex = crownOf(b, sh.cap, top, rng, mats, st);
      // 세로 광고판 — 벽이 확실히 있는 사각형과 높이에만 (sh.solid/safeTop)
      if (rng.chance(0.5)) megaBanner(signs, rng, sh.solid, Y + podH, sh.safeTop, SIDES[rng.int(0, 3)]);
      out.push({ rect: t, solid: sh.solid, top: apex, body: top, gx: cxi, gz: czi });
      if (apex > tallest) tallest = apex;
    }
  }
  if (!out.length) return null;

  // ── 4) 스카이브리지 ─────────────────────────────────────────────────────
  //
  // "따로 선 건물" 과 "한 회사" 를 가르는 것이 이것이다.
  //
  // 두 가지를 고쳤다.
  //   · 전에는 out[k] 와 out[k+1] 을 이었다. 그 둘은 열이 바뀌는 자리에서
  //     **대각선**이 되어, 축에 안 맞는 판이 허공을 가로질렀다. 이제 격자에서
  //     맞닿은 쌍만 잇는다.
  //   · 두께가 0.4m 였다. 그건 다리가 아니라 판자다. 사람이 지나는 통로면
  //     층고가 있어야 한다 — 바닥·유리·지붕 세 겹으로 만든다.
  const deck = Y + podH;
  let bi = 0;
  for (let k = 0; k < out.length; k++) {
    for (let j = k + 1; j < out.length; j++) {
      const A = out[k];
      const B2 = out[j];
      if (Math.abs(A.gx - B2.gx) + Math.abs(A.gz - B2.gz) !== 1) continue; // 맞닿은 쌍만
      if (!rng.chance(0.55)) continue;
      const y = deck + (Math.min(A.body, B2.body) - deck) * rng.range(0.5, 0.78);
      // 브릿지는 **차 있는 사각형**의 중심을 잇는다. 원통 타워에서 rect
      // 중심을 쓰면 방향은 맞아도 끝이 모서리 쪽으로 밀려 허공에 닿는다.
      const ac = rectCenter(A.solid);
      const bc = rectCenter(B2.solid);
      const alongX = A.gx !== B2.gx;
      const len = alongX ? Math.abs(bc.x - ac.x) : Math.abs(bc.z - ac.z);
      if (len < 6) continue;
      const w = rng.range(4.5, 7.0);
      const H = FLOOR_HEIGHT * 2.0;
      const mx = (ac.x + bc.x) / 2;
      const mz = (ac.z + bc.z) / 2;
      b.mark('bridge', `${label}:sky${bi++}`, { ends: [[ac.x, y, ac.z], [bc.x, y, bc.z]] });
      // 바닥판 — 밑에서 올려다보면 이것만 보인다
      b.add(autoBox(alongX ? len : w, 0.8, alongX ? w : len, [mx, y, mz], 0.05), mats[st.band]);
      // 통로 — 안에 사람이 다닌다. 유리는 안쪽으로 물려 프레임이 남게
      b.add(autoBox(alongX ? len : w * 0.92, H, alongX ? w * 0.92 : len,
        [mx, y + 0.4 + H / 2, mz], 0.03), mats.bridgeWinMat);
      // 지붕
      b.add(autoBox(alongX ? len : w, 0.5, alongX ? w : len,
        [mx, y + 0.4 + H + 0.25, mz], 0.05), mats[st.band]);
    }
  }

  // 로고 — 가장 높은 타워에. 기업은 간판을 겹겹이 쌓지 않고 **크게** 단다.
  const lead = out.reduce((p, c) => (c.top > p.top ? c : p), out[0]);
  megaBanner(signs, rng, lead.solid, deck, lead.body, SIDES[rng.int(0, 3)]);

  return { top: tallest, towers: out };
}
