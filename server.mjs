import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const publicFiles = new Set(['index.html', 'style.css', 'app.mjs', 'core.mjs', 'examples.mjs']);
const server = http.createServer(async (req, res) => {
  const file = new URL(req.url, 'http://localhost').pathname.slice(1) || 'index.html';
  if (!publicFiles.has(file)) { res.writeHead(404); res.end('Not found'); return; }
  try {
    const body = await readFile(fileURLToPath(new URL(file, import.meta.url)));
    res.writeHead(200, { 'Content-Type': file.endsWith('.html') ? 'text/html; charset=utf-8' : file.endsWith('.css') ? 'text/css; charset=utf-8' : 'text/javascript; charset=utf-8' }); res.end(body);
  } catch { res.writeHead(500); res.end('Unable to read application asset'); }
});
server.listen(8086, '127.0.0.1', () => console.log('8086 Step Lab: http://127.0.0.1:8086'));
