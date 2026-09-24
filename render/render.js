/* Rendu deterministe : Playwright dessine chaque image a un temps exact,
   OfflineAudioContext rend la bande son en WAV. Aucune capture temps reel. */
const { chromium } = require('playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const PORT = 8899;
const FPS = 60;
const DUR = 30.0;
const TOTAL = Math.round(FPS * DUR);

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };

function serve() {
  return new Promise(res => {
    const srv = http.createServer((req, rep) => {
      const u = decodeURIComponent(req.url.split('?')[0]);
      const f = path.join(ROOT, u === '/' ? 'index.html' : u);
      if (!f.startsWith(ROOT) || !fs.existsSync(f)) { rep.writeHead(404); return rep.end('nope'); }
      rep.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' });
      fs.createReadStream(f).pipe(rep);
    });
    srv.listen(PORT, '127.0.0.1', () => res(srv));
  });
}

(async () => {
  const only = process.argv.includes('--audio-only');
  const limit = (() => { const i = process.argv.indexOf('--frames'); return i > 0 ? parseInt(process.argv[i + 1], 10) : TOTAL; })();
  const srv = await serve();
  const browser = await chromium.launch({ args: ['--force-color-profile=srgb', '--disable-lcd-text', '--autoplay-policy=no-user-gesture-required'] });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  page.on('console', m => { if (m.type() === 'error') console.log('[page]', m.text()); });
  await page.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: 'load' });
  await page.waitForFunction('window.VIZ && window.VIZ.ready === true', null, { timeout: 20000 });
  await page.evaluate(() => { document.getElementById('overlay').remove(); document.body.style.background = '#000'; });

  // ---- audio ----
  console.log('rendu audio (OfflineAudioContext 48 kHz)…');
  const t0 = Date.now();
  const b64 = await page.evaluate(async () => {
    const buf = await window.MUSIC.renderOffline(48000);
    const wav = window.MUSIC.wavFromBuffer(buf);
    let bin = '', CH = 0x8000;
    for (let i = 0; i < wav.length; i += CH) bin += String.fromCharCode.apply(null, wav.subarray(i, i + CH));
    return btoa(bin);
  });
  const wav = Buffer.from(b64, 'base64');
  fs.writeFileSync(path.join(ROOT, 'out', 'audio.wav'), wav);
  console.log(`audio.wav : ${(wav.length / 1e6).toFixed(2)} Mo en ${((Date.now() - t0) / 1000).toFixed(1)} s`);

  if (!only) {
    const dir = path.join(ROOT, 'frames');
    fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true });
    const start = Date.now();
    for (let i = 0; i < limit; i++) {
      await page.evaluate(t => window.VIZ.drawFrame(t), i / FPS);
      await page.screenshot({ path: path.join(dir, String(i).padStart(5, '0') + '.png'), type: 'png', animations: 'disabled' });
      if (i % 120 === 0 || i === limit - 1) {
        const el = (Date.now() - start) / 1000;
        console.log(`image ${i + 1}/${limit}  ${el.toFixed(0)} s  (${((i + 1) / el).toFixed(1)} img/s)`);
      }
    }
  }
  await browser.close(); srv.close();
  console.log('termine');
})().catch(e => { console.error(e); process.exit(1); });
