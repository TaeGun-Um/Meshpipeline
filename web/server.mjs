// 의존성 없는 정적 서버. index.html, src/, node_modules/ 를 그대로 서빙한다.
import { createServer } from 'node:http';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { extname, join, normalize, dirname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

// cwd가 아니라 이 스크립트 위치를 기준으로 삼는다.
// 최상위에서 `node web/server.mjs`로 띄워도 node_modules를 정상적으로 찾는다.
const ROOT = dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 5173);

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
});
