// 의존성 없는 정적 서버. index.html, src/, node_modules/ 를 그대로 서빙한다.
import { createServer } from 'node:http';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { extname, join, normalize, dirname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

// cwd가 아니라 이 스크립트 위치를 기준으로 삼는다.
// 최상위에서 `node web/server.mjs`로 띄워도 node_modules를 정상적으로 찾는다.
const ROOT = dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 5173);

// ── 클론 직후에 걸리는 벽 ──────────────────────────────────────────────────
//
// `node_modules/` 는 커밋하지 않는다 (web/.gitignore). index.html 의 임포트맵이
// `/node_modules/three/build/three.module.js` 를 가리키므로, 새로 클론한 기계에서
// `npm install` 을 안 하면 그 파일이 404 가 되고 **모듈 로드가 통째로 실패한다.**
//
// 그때 브라우저에 나오는 것은 흰 화면 하나뿐이었다. 원인이 화면에 없으면
// 없는 것이나 마찬가지다 — 서버가 시작할 때 세어 보고, 요청이 와도 말해 준다.
const THREE_PATH = join(ROOT, 'node_modules', 'three', 'build', 'three.module.js');
const hasThree = () => existsSync(THREE_PATH);

const SETUP_HTML = `<!doctype html><meta charset="utf-8">
<title>의존성이 없다</title>
<style>
 body{background:#12151a;color:#e6e6e6;font:15px/1.7 system-ui,sans-serif;margin:0;
      display:flex;align-items:center;justify-content:center;min-height:100vh}
 main{max-width:640px;padding:2rem}
 h1{font-size:20px;font-weight:500;margin:0 0 1rem}
 code{background:#1e242c;padding:.15em .4em;border-radius:4px}
 pre{background:#1e242c;padding:1rem;border-radius:6px;overflow-x:auto}
 p{color:#a8b0ba}
</style>
<main>
<h1>three.js 가 없다 — 아직 설치를 안 했다</h1>
<p>이 저장소는 <code>node_modules/</code> 를 커밋하지 않는다.
   클론한 뒤 한 번은 설치해야 씬이 뜬다.</p>
<pre>cd web
npm install</pre>
<p>설치 후 서버를 다시 띄우고 새로고침하면 된다.
   자세한 부트스트랩 순서는 <code>README.md</code> 의 "클론 직후" 절에 있다.</p>
</main>`;

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
};

createServer(async (req, res) => {
  let urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
  if (urlPath === '/' || urlPath === '') urlPath = '/index.html';

  // 의존성이 없으면 흰 화면 대신 이유를 준다. 매 요청마다 확인하는 이유는
  // 서버를 띄워 둔 채로 npm install 을 하는 경우가 많기 때문이다 —
  // 설치가 끝나면 새로고침만으로 정상 동작한다.
  if (urlPath === '/index.html' && !hasThree()) {
    res.writeHead(503, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
    res.end(SETUP_HTML);
    return;
  }

  // 익스포트 하네스: 페이지가 만든 .glb(base64)를 받아 파일로 떨어뜨린다.
  if (req.method === 'POST' && urlPath === '/export') {
    const chunks = [];
    for await (const c of req) chunks.push(c);
    const b64 = Buffer.concat(chunks).toString('utf8');
    const raw = new URL(req.url, 'http://x').searchParams.get('name') || 'out.glb';
    const name = raw.replace(/[^a-z0-9_.-]/gi, '');
    await mkdir(join(ROOT, 'export'), { recursive: true });
    const file = join(ROOT, 'export', name);
    await writeFile(file, Buffer.from(b64, 'base64'));
    res.writeHead(200, { 'content-type': 'text/plain' });
    res.end(file);
    console.log(`export -> ${file}`);
    return;
  }

  // 스크린샷 하네스: 페이지가 프레임버퍼를 읽어 여기로 올리면 파일로 떨어진다.
  if (req.method === 'POST' && urlPath === '/shot') {
    const chunks = [];
    for await (const c of req) chunks.push(c);
    const dataUrl = Buffer.concat(chunks).toString('utf8');
    const name = (new URL(req.url, 'http://x').searchParams.get('name') || 'latest')
      .replace(/[^a-z0-9_-]/gi, '');
    const b64 = dataUrl.slice(dataUrl.indexOf(',') + 1);
    await mkdir(join(ROOT, 'shots'), { recursive: true });
    const file = join(ROOT, 'shots', `${name}.png`);
    await writeFile(file, Buffer.from(b64, 'base64'));
    res.writeHead(200, { 'content-type': 'text/plain' });
    res.end(file);
    console.log(`shot -> ${file}`);
    return;
  }

  const target = join(ROOT, normalize(urlPath));
  if (target !== ROOT && !target.startsWith(ROOT + sep)) {
    res.writeHead(403, { 'content-type': 'text/plain' });
    res.end('403');
    return;
  }

  try {
    const body = await readFile(target);
    res.writeHead(200, {
      'content-type': TYPES[extname(target)] || 'application/octet-stream',
      'cache-control': 'no-store',
    });
    res.end(body);
  } catch {
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    res.end(`404 ${urlPath}`);
  }
}).listen(PORT, () => {
  console.log(`http://localhost:${PORT}`);
  if (!hasThree()) {
    console.log('');
    console.log('  ! three.js 가 없다 — 씬이 안 뜬다.');
    console.log('    이 저장소는 node_modules/ 를 커밋하지 않는다.');
    console.log('');
    console.log('      cd web && npm install');
    console.log('');
  }
});
