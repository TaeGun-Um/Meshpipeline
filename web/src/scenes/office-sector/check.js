// 실내에만 있는 실패를 잡는다.
//
// 도시의 배치 검사(관통·부유·차도 침범)는 그대로 쓰되, 실내는 다른 것이
// 깨진다 — 갈 수 없는 방, 캄캄한 방, 뚫린 천장, 머리가 닿는 통로.
//
// ── 왜 이걸 먼저 만들었나 ──────────────────────────────────────────────────
// 캐릭터 씬에서 "30뷰 일치, 경고 0" 을 네 번 보고하는 동안 얼굴 한가운데가
// 파여 있었다. 계측이 못 보는 축이 있었기 때문이다 (lessons.md 3.8).
//
// 실내는 다행히 **전부 숫자로 잡힌다.** 그러면 형태를 만들기 전에 계측을
// 먼저 세우는 편이 낫다 — 이번 씬은 그 순서로 갔다.
import { CELLS, H, W, openness } from './layout.js';

export function checkInterior(lightTally) {
  const faults = [];

  // ── 캄캄한 방 ────────────────────────────────────────────────────────────
  //
  // 도시의 "간판이 통째로 죽었다" 와 같은 부류다. 빌드는 성공하고 화면도
  // 멀쩡한데 그 방만 검은 상자다. 개수를 세면 바로 잡힌다.
  for (const c of CELLS) {
    const t = lightTally.byCell[c.id];
    if (!t) faults.push(`${c.id} 에 조명 기록이 없다`);
    else if (t.lights < 1) faults.push(`${c.id} 에 광원이 없다 — 캄캄한 방`);
    else if (t.fixtures < 1) faults.push(`${c.id} 에 등이 없다 — 광원만 있고 보이는 것이 없다`);
  }

  // ── 머리가 닿나 ──────────────────────────────────────────────────────────
  //
  // 문 상인방(2.10)보다 천장이 낮으면 문이 천장을 뚫는다. 복도 2.70 이
  // 기준선이므로 여유는 0.60 뿐이고, 천장을 낮추는 순간 걸린다.
  for (const c of CELLS) {
    if (c.h < H.door + 0.25) {
      faults.push(`${c.id} 천장 ${c.h}m — 문 상인방 ${H.door}m 위로 여유가 없다`);
    }
  }

  // ── 천장 격자에 맞나 ─────────────────────────────────────────────────────
  //
  // 형광등이 0.6 격자에 앉으므로 칸 크기가 격자에서 크게 벗어나면 가장자리
  // 타일이 흉하게 잘린다. 실무에서 늘 생기는 일이라 실패는 아니고 경고다.
  const off = [];
  for (const c of CELLS) {
    const rx = (c.x1 - c.x0) % W.tile;
    const rz = (c.z1 - c.z0) % W.tile;
    const bad = Math.min(rx, W.tile - rx) > 0.08 || Math.min(rz, W.tile - rz) > 0.08;
    if (bad) off.push(c.id);
  }

  return {
    faults,
    offGrid: off,
    cells: CELLS.length,
  };
}

// ── 조도 위계를 숫자로 잰다 ────────────────────────────────────────────────
//
// "어두운 곳이 있어야 밝은 곳이 밝다" 는 facility.md 3장의 세 규칙 중 하나인데,
// 첫 판에서는 **눈으로만** 봤고 "아직 차이가 약하다" 로 status.md 에 남았다.
// 눈으로 보는 것은 판정이 아니다 — 캐릭터 씬에서 그렇게 다섯 판을 헤맸다.
//
// 조명을 정점에 구우면 밝기가 배열에 남으므로 그냥 재면 된다. 바닥을 향해
// 위를 보는 면의 평균 휘도가 "그 방이 얼마나 밝은가" 다.
// ── 무엇을 단언하나 ────────────────────────────────────────────────────────
// facility.md 가 실제로 주장하는 것만 검사한다. "제일 어두운 칸은 복도" 같은
// 것은 문서에 없고 데이터에도 안 맞았다 — 서버룸이 제일 어둡다. 그건 결함이
// 아니라 그 방의 성격이다.
//
// **못 재는 것도 적어 둔다.** 랙 표시등 같은 발광 소품은 화면에서는 보이지만
// 굽기에 안 들어간다. 서버룸의 실제 인상은 여기 숫자보다 밝다.
//
// albedo  칸별 바닥 재질의 평균 반사율. **구운 값에 이걸 곱해야 보이는 밝기**다.
//         안 넘기면 조도만 보는데, 그러면 어두운 콘크리트를 깐 플라자가
//         "제일 밝다" 로 통과하면서 화면에서는 복도가 더 밝을 수 있다.
export function checkLighting(bake, albedo = null) {
  const faults = [];
  const rows = [];
  for (const c of CELLS) {
    const s = bake.byCell[c.id];
    if (!s) {
      faults.push(`${c.id} 바닥에 구운 값이 없다 — 굽기가 그 칸을 못 찾았다`);
      continue;
    }
    if (s.mean < 0.06) faults.push(`${c.id} 조도 ${s.mean.toFixed(3)} — 캄캄하다`);
    const a = albedo ? albedo[c.id] : 1;
    rows.push({ id: c.id, kind: c.kind, lux: s.mean, albedo: a, mean: s.mean * a, min: s.min, max: s.max });
  }
  if (rows.length < CELLS.length) return { faults, rows, span: 0 };

  rows.sort((a, b) => b.mean - a.mean);
  const top = rows[0];
  const bot = rows[rows.length - 1];
  const span = top.mean / Math.max(bot.mean, 1e-6);
  const mean = (f) => {
    const v = rows.filter(f);
    return v.length ? v.reduce((s, r) => s + r.mean, 0) / v.length : 0;
  };

  // 1. 제일 밝은 곳은 플라자다. 창이 없는 지하에서 높이 다음으로 위계를
  //    만드는 것이 밝기고, 이 층의 중심은 플라자다.
  if (top.kind !== 'plaza') faults.push(`제일 밝은 칸이 ${top.id}(${top.kind}) 다 — 플라자여야 한다`);

  // 2. **닫힌 복도는 방보다 어둡다.** "복도는 지나가는 곳" 을 잴 수 있게 쓴 것.
  //    고리 복도는 플라자에 벽 없이 트여 있어 당연히 밝다 — 그건 빼고 본다.
  const open = openness();
  const roomMean = mean((r) => r.kind !== 'corridor' && r.kind !== 'plaza');
  for (const r of rows) {
    if (r.kind !== 'corridor') continue;
    if (open.get(`${r.id}|plaza`) === 'open') continue;
    if (r.mean >= roomMean) {
      faults.push(`${r.id} 가 ${r.mean.toFixed(3)} — 방 평균 ${roomMean.toFixed(3)} 보다 안 어둡다`);
    }
  }

  // 3. 차이가 3배는 나야 "밝은 곳" 이 밝게 읽힌다. 2배는 눈이 노출로 지운다.
  if (span < 3) faults.push(`밝기 폭이 ${span.toFixed(1)}배뿐 — 위계가 약하다`);

  return { faults, rows, span, top: top.id, bottom: bot.id, roomMean };
}
