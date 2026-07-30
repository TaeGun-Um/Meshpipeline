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

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SHOTS = join(ROOT, 'web', 'shots');

// 다름을 실패로 볼 기준. 압축·GPU 드라이버 차이로 1픽셀도 안 틀리기를
// 요구하면 실용성이 없을 것 같지만, 실제로는 같은 기기에서 항상 0 이 나왔다.
// 0 이 아니면 무언가 진짜로 바뀐 것이다.
const TOLERANCE = 0;

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
