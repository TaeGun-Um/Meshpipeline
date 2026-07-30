// 스크린샷 회귀 비교.
//
//   node tools/compare-shots.mjs web/shots/baseline_nc_low.png web/shots/check.png
//   node tools/compare-shots.mjs --dir web/shots --prefix baseline_nc
//
// ── 왜 SHA256 이 아니라 픽셀인가 ────────────────────────────────────────────
// 처음에는 파일 해시로 비교했는데 **거짓 불일치**가 났다. 디코드해 보니 RGBA가
// 완전히 동일한데 파일 바이트만 달랐다 — 스크린샷을 연달아 쓰는 도중에 해시를
// 뜬 쓰기 경쟁이었다.
//
// 해시는 "다르다" 만 알려주고 얼마나 다른지는 말해 주지 않는다는 문제도 있다.
// 픽셀 비교는 오탐이 없고, 실패했을 때 어디가 얼마나 다른지 바로 나온다.
//
// 의존성은 쓰지 않는다. PNG 디코드에 필요한 건 zlib 뿐이고 Node 에 들어 있다.
// canvas.toDataURL 이 내놓는 형식(8비트 RGBA, 필터 0, 비인터레이스)만 읽는다.
import { fileURLToPath } from 'node:url';
import { readFileSync, readdirSync } from 'node:fs';
import { inflateSync } from 'node:zlib';
import { join, basename, resolve } from 'node:path';

function decodePNG(path) {
  const buf = readFileSync(path);
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error(`${path}: PNG 가 아니다`);

  let off = 8;
  let w = 0;
  let h = 0;
  let bitDepth = 0;
  let colorType = 0;
  const idat = [];

  while (off < buf.length) {
    const len = buf.readUInt32BE(off);
    const type = buf.toString('ascii', off + 4, off + 8);
    const data = buf.subarray(off + 8, off + 8 + len);
    if (type === 'IHDR') {
      w = data.readUInt32BE(0);
      h = data.readUInt32BE(4);
      bitDepth = data[8];
      colorType = data[9];
      if (data[12] !== 0) throw new Error(`${path}: 인터레이스는 지원하지 않는다`);
    } else if (type === 'IDAT') {
      idat.push(data);
    } else if (type === 'IEND') break;
    off += 12 + len; // 길이4 + 타입4 + 데이터 + CRC4
  }

  if (bitDepth !== 8) throw new Error(`${path}: 8비트만 지원 (bitDepth=${bitDepth})`);
  const ch = colorType === 6 ? 4 : colorType === 2 ? 3 : 0;
  if (!ch) throw new Error(`${path}: RGB/RGBA 만 지원 (colorType=${colorType})`);

  const raw = inflateSync(Buffer.concat(idat));
  const stride = w * ch;
  const out = Buffer.alloc(h * stride);

  // PNG 스캔라인 필터 되돌리기 (필터 방식 0의 다섯 가지)
  for (let y = 0; y < h; y++) {
    const filter = raw[y * (stride + 1)];
    const src = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    const cur = out.subarray(y * stride, (y + 1) * stride);
    const prev = y > 0 ? out.subarray((y - 1) * stride, y * stride) : null;

    for (let i = 0; i < stride; i++) {
      const a = i >= ch ? cur[i - ch] : 0;
      const b = prev ? prev[i] : 0;
      const c = prev && i >= ch ? prev[i - ch] : 0;
      let v = src[i];
      if (filter === 1) v += a;
      else if (filter === 2) v += b;
      else if (filter === 3) v += (a + b) >> 1;
      else if (filter === 4) {
        const p = a + b - c;
        const pa = Math.abs(p - a);
        const pb = Math.abs(p - b);
        const pc = Math.abs(p - c);
        v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      }
      cur[i] = v & 255;
    }
  }
  return { w, h, ch, data: out };
}

export function compare(pathA, pathB, { threshold = 2 } = {}) {
  const A = decodePNG(pathA);
  const B = decodePNG(pathB);
  if (A.w !== B.w || A.h !== B.h) {
    return { same: false, reason: `크기가 다르다 ${A.w}x${A.h} vs ${B.w}x${B.h}` };
  }

  let n = 0;
  let maxDelta = 0;
  let sum = 0;
  const px = A.w * A.h;
  for (let i = 0; i < px; i++) {
    const ia = i * A.ch;
    const ib = i * B.ch;
    const d = Math.max(
      Math.abs(A.data[ia] - B.data[ib]),
      Math.abs(A.data[ia + 1] - B.data[ib + 1]),
      Math.abs(A.data[ia + 2] - B.data[ib + 2])
    );
    if (d > threshold) {
      n++;
      sum += d;
      if (d > maxDelta) maxDelta = d;
    }
  }
  return {
    same: n === 0,
    diffPixels: n,
    pct: +((100 * n) / px).toFixed(3),
    maxDelta,
    avgDelta: n ? +(sum / n).toFixed(1) : 0,
  };
}

// ── CLI ────────────────────────────────────────────────────────────────────

// 모듈로 import 될 때는 CLI 가 돌면 안 된다. 이 가드가 없으면 verify.mjs 가
// 이 파일을 import 하는 순간 verify 의 argv 로 비교를 시도한다.
const isMain = process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1]);
const args = isMain ? process.argv.slice(2) : [];
if (args.length) {
  let failed = 0;

  if (args[0] === '--dir') {
    // 디렉터리 안에서 baseline_* 과 같은 이름의 check 를 짝지어 비교
    const dir = args[1];
    const prefix = args[3] || 'baseline';
    const files = readdirSync(dir).filter((f) => f.startsWith(prefix) && f.endsWith('.png'));
    for (const f of files) {
      const chk = join(dir, f.replace(prefix, 'check'));
      try {
        const r = compare(join(dir, f), chk);
        report(f, r);
        if (!r.same) failed++;
      } catch (e) {
        console.log(`  ${f}  건너뜀 (${e.message})`);
      }
    }
  } else {
    const r = compare(args[0], args[1]);
    report(basename(args[0]), r);
    if (!r.same) failed++;
  }

  process.exit(failed ? 1 : 0);
}

function report(name, r) {
  if (r.same) {
    console.log(`  ${name}  동일`);
  } else if (r.reason) {
    console.log(`  ${name}  ${r.reason}`);
  } else {
    console.log(
      `  ${name}  다름 — ${r.diffPixels}픽셀 (${r.pct}%), 최대 ${r.maxDelta}, 평균 ${r.avgDelta}`
    );
  }
}
