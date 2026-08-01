// 씬 회귀 검증 — shots/views.json 에 적힌 모든 뷰를 베이스라인과 비교한다.
//
// 사용:
//   node tools/verify.mjs night-city
//   node tools/verify.mjs                (모든 씬)
//
// 브라우저에서 `await __lock()` 을 먼저 돌려 shots/ 를 갱신해 둬야 한다.
// 기준을 새로 잡을 때는 `await __lock('base')`.
//
// ── 왜 파일 해시가 아니라 픽셀 비교인가 ────────────────────────────────────
// 처음에는 SHA256 으로 비교했다. 그런데 RGB 와 알파가 바이트 단위로 완전히
// 같은데도 해시가 다른 경우가 나왔다 — 스크린샷 파일이 다 쓰이기 전에 읽은
// 경합이었다. 즉 **거짓 실패**다. 거짓 실패는 거짓 통과만큼 나쁘다: 몇 번
// 반복되면 검증 결과 자체를 안 믿게 된다.
//
// 픽셀 비교는 그 자체로 "얼마나 다른가" 를 알려주므로, 경합으로 잘린 파일은
// 디코드 단계에서 바로 실패하고 진짜 회귀는 크기를 갖고 보고된다.
//
// ── 어디까지 잡히나 ────────────────────────────────────────────────────────
// 잡힌다: 결정성 파괴(난수 순서 변화), 재질 바인딩 실수, UV·축 뒤집힘,
//         그림자 기본값 변화, 지오메트리 누락.
// 못 잡는다: 카메라에 안 잡히는 곳의 회귀. 그래서 views.json 이 서로 다른
//         거리대와 구역을 덮도록 뷰를 고른다.
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { compare } from './compare-shots.mjs';
import { luminance } from './lumi.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SHOTS = join(ROOT, 'web', 'shots');

// 다름을 실패로 볼 기준. 압축·GPU 드라이버 차이로 1픽셀도 안 틀리기를
// 요구하면 실용성이 없을 것 같지만, 실제로는 같은 기기에서 항상 0 이 나왔다.
// 0 이 아니면 무언가 진짜로 바뀐 것이다.
const TOLERANCE = 0;

// ── 뷰가 아무것도 안 보고 있으면 잡는다 ────────────────────────────────────
//
// 픽셀 회귀의 맹점: **검은 화면 두 장은 완벽히 일치한다.** 도시 구조를 바꾸면
// 손으로 찍은 카메라 좌표가 건물 속으로 들어가거나 불 없는 구석을 보게
// 되는데, 그래도 "전부 일치" 가 나온다.
//
// 이 세션에서만 다섯 번 겪었다 — 대지 병합으로 corpo·deck·walk 가, 배치
// 지도로 bazaar 가, 밝기 수정으로 edge 가 그렇게 됐다. 그동안 회귀 검사는
// **검은 화면을 성실히 지키고** 있었다.
//
// 중앙값을 본다. 평균은 네온 몇 개에 끌려 올라가지만 중앙값은 "화면의 절반이
// 무엇인가" 를 말한다. 밤 씬이라 기준을 낮게 잡되, 0 에 가까우면 잡는다.
const MIN_MEDIAN = 1.5;
// 상위 1% 밝기. 건물 속이면 이것도 0 이다 — 중앙값과 **둘 다** 낮아야 실패다.
const MIN_P99 = 24;

const views = JSON.parse(readFileSync(join(SHOTS, 'views.json'), 'utf8'));
const want = process.argv[2];
const scenes = Object.keys(views).filter((k) => !k.startsWith('_') && (!want || k === want));

if (!scenes.length) {
  console.error(`알 수 없는 씬: ${want}. 있는 것: ${Object.keys(views).filter((k) => !k.startsWith('_')).join(', ')}`);
  process.exit(2);
}

let failed = 0;
let missing = 0;

for (const scene of scenes) {
  const tag = scene === 'night-city' ? 'nc_' : '';
  console.log(`\n[${scene}]`);

  for (const name of Object.keys(views[scene])) {
    if (name.startsWith('_')) continue;
    const cur = join(SHOTS, `${tag}${name}.png`);
    const base = join(SHOTS, `baseline_${tag}${name}.png`);

    // 비교 전에 **둘 다 있는지 먼저 단언한다.** 예전에 없는 파일 두 개를
    // 비교하고 "같다" 로 읽어 통과시킨 적이 있다.
    if (!existsSync(base)) { console.log(`  ${name.padEnd(8)} 기준 없음 — __lock('base') 필요`); missing++; continue; }
    if (!existsSync(cur))  { console.log(`  ${name.padEnd(8)} 현재 샷 없음 — __lock() 필요`); missing++; continue; }

    // 기준선이 아무것도 안 보고 있으면 비교 자체가 무의미하다.
    //
    // ── 중앙값만으로는 오탐한다 (두 번 걸렸다) ────────────────────────────
    // 밤 도시의 넓은 도로는 화면 절반이 검은 아스팔트라 **중앙값이 낮은 것이
    // 정상**이다. 실제로 교차로 뷰가 중앙값 1.4 로 두 번 걸렸는데, 그 화면에는
    // 횡단보도·가로등·신호등·건물이 다 있었다.
    //
    // 잡으려는 것은 "카메라가 건물 속" 이고, 그때는 **어디에도 밝은 것이
    // 없다.** 그러니 중앙값과 상위 1% 를 같이 본다.
    //   교차로  중앙 1.4 · p99 205   <- 어둡지만 볼 것이 있다
    //   골목    중앙 3.1 · p99  18   <- 원래 어두운 곳
    //   건물 속 중앙 0   · p99   0   <- 이것만 잡아야 한다
    const lum = luminance(cur);
    if (lum.중앙 < MIN_MEDIAN && lum.p99 < MIN_P99) {
      console.log(
        `  ${name.padEnd(8)} **거의 검은 화면** (중앙 ${lum.중앙}, p99 ${lum.p99}) — ` +
        `카메라가 건물 속이거나 불 없는 곳을 본다. 재조준 필요`
      );
      failed++;
      continue;
    }

    const r = compare(base, cur);
    if (r.reason) { console.log(`  ${name.padEnd(8)} ${r.reason}`); failed++; continue; }
    if (r.diffPixels <= TOLERANCE) {
      console.log(`  ${name.padEnd(8)} 일치`);
    } else {
      console.log(`  ${name.padEnd(8)} 다름 — ${r.diffPixels.toLocaleString()}픽셀 (${r.pct}%), 최대 ${r.maxDelta}, 평균 ${r.avgDelta}`);
      failed++;
    }
  }
}

console.log(
  failed === 0 && missing === 0
    ? '\n전부 일치'
    : `\n실패 ${failed}건${missing ? ` · 누락 ${missing}건` : ''}`
);
process.exit(failed || missing ? 1 : 0);
