/* Passe a blanc : appelle drawFrame sur les 1800 temps et signale toute exception. */
const { chromium } = require('playwright');
const http = require('http'); const fs = require('fs'); const path = require('path');
const ROOT = path.resolve(__dirname, '..'), PORT = 8901;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };
(async () => {
  const srv = http.createServer((q, r) => {
    const f = path.join(ROOT, q.url === '/' ? 'index.html' : q.url.split('?')[0]);
    if (!fs.existsSync(f)) { r.writeHead(404); return r.end(); }
    r.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'text/plain' });
    fs.createReadStream(f).pipe(r);
  }).listen(PORT, '127.0.0.1');
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1920, height: 1080 } });
  await p.goto(`http://127.0.0.1:${PORT}/index.html`);
  await p.waitForFunction('window.VIZ && window.VIZ.ready === true');
  const bad = await p.evaluate(() => {
    const out = [];
    for (let i = 0; i <= 1800; i++) {
      try { window.VIZ.drawFrame(i / 60); }
      catch (e) { out.push(i + ' : ' + e.message); if (out.length > 8) break; }
    }
    return out;
  });
  console.log(bad.length ? 'ECHECS:\n' + bad.join('\n') : 'OK : 1801 images dessinees sans erreur');
  await b.close(); srv.close();
})();
