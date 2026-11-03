import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { brotliCompressSync, gzipSync, constants } from 'node:zlib';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT || 3000);
const types = { '.html':'text/html; charset=utf-8', '.js':'text/javascript', '.json':'application/json', '.css':'text/css', '.glb':'model/gltf-binary', '.jpg':'image/jpeg', '.webp':'image/webp', '.png':'image/png' };
// Text assets compress well (three.module.js shrinks ~75%); GLB and images are already compressed.
const compressible = new Set(['.html','.js','.json','.css']);
const cache = new Map();
const server = http.createServer(async (req,res) => {
  try {
    const pathname = decodeURIComponent(new URL(req.url,'http://localhost').pathname);
    const file = path.resolve(root,'.' + (pathname.endsWith('/') ? pathname + 'index.html' : pathname));
    if (!file.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
    const info = await stat(file);
    const ext = path.extname(file);
    const etag = `"${info.size.toString(36)}-${info.mtimeMs.toString(36)}"`;
    const headers = { 'Content-Type':types[ext] || 'application/octet-stream', 'ETag':etag, 'Vary':'Accept-Encoding',
      // Code revalidates cheaply via ETag; heavy binary assets are cached outright.
      'Cache-Control': compressible.has(ext) ? 'no-cache' : 'public, max-age=86400' };
    if (req.headers['if-none-match'] === etag) { res.writeHead(304,headers).end(); return; }
    let data = await readFile(file);
    const accept = String(req.headers['accept-encoding'] || '');
    if (compressible.has(ext) && data.length > 1024) {
      const encoding = /\bbr\b/.test(accept) ? 'br' : /\bgzip\b/.test(accept) ? 'gzip' : '';
      if (encoding) {
        const key = file + etag + encoding;
        if (!cache.has(key)) cache.set(key, encoding === 'br' ? brotliCompressSync(data,{params:{[constants.BROTLI_PARAM_QUALITY]:9}}) : gzipSync(data,{level:9}));
        data = cache.get(key); headers['Content-Encoding'] = encoding;
      }
    }
    headers['Content-Length'] = data.length;
    res.writeHead(200, headers).end(req.method === 'HEAD' ? undefined : data);
  } catch { res.writeHead(404).end('Not found'); }
});
server.on('error', error => { console.error(`Não foi possível iniciar a prévia na porta ${port}: ${error.code}`); process.exitCode = 1; });
server.listen(port,'127.0.0.1', () => console.log(`Local: http://127.0.0.1:${port}`));
