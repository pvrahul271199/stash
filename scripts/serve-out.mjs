import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
};

const port = Number(process.env.PORT || 3100);
const root = join(process.cwd(), 'out');

createServer((req, res) => {
  const urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
  let filePath = join(root, urlPath);
  if (existsSync(filePath) && statSync(filePath).isDirectory()) {
    filePath = join(filePath, 'index.html');
  } else if (!existsSync(filePath) && existsSync(filePath + '.html')) {
    filePath = filePath + '.html';
  }
  if (!existsSync(filePath) || !statSync(filePath).isFile()) {
    const fallback = join(root, 'index.html');
    if (existsSync(fallback)) {
      res.writeHead(200, { 'Content-Type': MIME['.html'] });
      res.end(readFileSync(fallback));
      return;
    }
    res.writeHead(404);
    res.end('Not found');
    return;
  }
  const ext = extname(filePath);
  res.writeHead(200, {
    'Content-Type': MIME[ext] || 'application/octet-stream',
    ...(urlPath === '/sw.js' ? { 'Cache-Control': 'no-cache, no-store, must-revalidate' } : {}),
  });
  res.end(readFileSync(filePath));
}).listen(port, '0.0.0.0', () => {
  console.log(`Serving out/ on http://0.0.0.0:${port} (http://127.0.0.1:${port})`);
});
