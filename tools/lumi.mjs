// 밝기 위계 측정.
//
// ── 왜 필요한가 ────────────────────────────────────────────────────────────
// "밤 도시인데 인도가 제일 밝다" 는 눈으로는 보이는데 **숫자로는 아무 데도
// 안 잡혔다.** 픽셀 회귀는 "달라졌다" 만 말하고, 감사는 개수와 비율만 본다.
//
// 밝기 위계는 이 씬의 목표(레퍼런스 컨셉아트)에서 핵심이다. 레퍼런스의
// 노면은 젖은 아스팔트라 어둡고, 밝은 것은 간판·창·조명뿐이다.
//
// 그래서 두 장을 찍어 비교한다.
//   down  거의 수직으로 내려다본 화면 = 대부분 **위를 향한 면**
//   along 눈높이에서 거리를 따라 본 화면 = 대부분 **수직 면**
//
// 위를 향한 면이 수직 면보다 밝으면 위계가 뒤집힌 것이다.
//
// 사용: node tools/lumi.mjs shots/a.png shots/b.png ...
import { readFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';

function decodePNG(path) {
  const buf = readFileSync(path);
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error(`${path}: PNG 가 아니다`);
  let p = 8;
  let w = 0, h = 0, bits = 0, ctype = 0;
  const idat = [];
  while (p < buf.length) {
    const len = buf.readUInt32BE(p);
    const type = buf.toString('ascii', p + 4, p + 8);
    const data = buf.subarray(p + 8, p + 8 + len);
    if (type === 'IHDR') {
      w = data.readUInt32BE(0); h = data.readUInt32BE(4);
      bits = data[8]; ctype = data[9];
    } else if (type === 'IDAT') idat.push(data);
    else if (type === 'IEND') break;
    p += 12 + len;
  }
  if (bits !== 8 || (ctype !== 6 && ctype !== 2)) {
    throw new Error(`${path}: 8bit RGB/RGBA 만 읽는다 (bits=${bits} ctype=${ctype})`);
  }
  const ch = ctype === 6 ? 4 : 3;
  const raw = inflateSync(Buffer.concat(idat));
  const out = Buffer.alloc(w * h * ch);
  const stride = w * ch;
  let q = 0;
  for (let y = 0; y < h; y++) {
    const f = raw[q++];
    const line = raw.subarray(q, q + stride); q += stride;
    const cur = out.subarray(y * stride, (y + 1) * stride);
    const prev = y > 0 ? out.subarray((y - 1) * stride, y * stride) : null;
    for (let i = 0; i < stride; i++) {
      const a = i >= ch ? cur[i - ch] : 0;
      const b = prev ? prev[i] : 0;
      const c = prev && i >= ch ? prev[i - ch] : 0;
      let v = line[i];
      if (f === 1) v += a;
      else if (f === 2) v += b;
      else if (f === 3) v += (a + b) >> 1;
      else if (f === 4) {
        const pp = a + b - c;
        const pa = Math.abs(pp - a), pb = Math.abs(pp - b), pc = Math.abs(pp - c);
        v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      }
      cur[i] = v & 255;
    }
  }
  return { w, h, ch, px: out };
}

// 지각 밝기(Rec.709). 그리고 **분포**를 같이 본다 —
// 평균만 보면 "네온 몇 개가 밝다" 와 "바닥 전체가 밝다" 를 구별 못 한다.
export function luminance(path) {
  const { w, h, ch, px } = decodePNG(path);
  const lum = [];
  for (let i = 0; i < w * h; i++) {
    const o = i * ch;
    lum.push(0.2126 * px[o] + 0.7152 * px[o + 1] + 0.0722 * px[o + 2]);
  }
  lum.sort((a, b) => a - b);
  const at = (q) => lum[Math.min(lum.length - 1, Math.floor(lum.length * q))];
  const mean = lum.reduce((a, b) => a + b, 0) / lum.length;
  return {
    평균: +mean.toFixed(1),
    중앙: +at(0.5).toFixed(1),
    p90: +at(0.9).toFixed(1),
    p99: +at(0.99).toFixed(1),
    // 밝은 픽셀이 얼마나 되나. 네온은 소수여야 하고 바닥은 어두워야 한다
    '밝은비율(>96)': +(lum.filter((v) => v > 96).length / lum.length).toFixed(3),
  };
}

const args = process.argv.slice(2);
if (args.length) {
  for (const a of args) {
    console.log(a.padEnd(34), JSON.stringify(luminance(a)));
  }
}
