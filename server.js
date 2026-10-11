// Bridge: RSSI-Sampler (Swift) -> Server-Sent Events für das Dashboard. Keine Abhängigkeiten.
// Start: node server.js   ->  http://localhost:8787
const http = require('http'), fs = require('fs'), path = require('path');
const { spawn, execSync } = require('child_process');

const PORT = 8787, DIR = __dirname;
const bin = path.join(DIR, 'rssi');
if (!fs.existsSync(bin) || fs.statSync(bin).mtimeMs < fs.statSync(bin + '.swift').mtimeMs) {
  console.log('Kompiliere rssi.swift ...');
  execSync(`swiftc -O "${bin}.swift" -o "${bin}"`, { stdio: 'inherit' });
}

// Verkehr zum Router erzeugen, damit die Signalstärke laufend aktualisiert wird (5 Hz, ohne Root möglich).
let gateway = '';
try { gateway = execSync("route -n get default | awk '/gateway/{print $2}'").toString().trim(); } catch {}
if (gateway) { spawn('ping', ['-i', '0.2', gateway], { stdio: 'ignore' }); console.log('Ping an Gateway', gateway); }

const clients = new Set();
let last = null;
const sampler = spawn(bin);
let buf = '';
sampler.stdout.on('data', d => {
  buf += d; let i;
  while ((i = buf.indexOf('\n')) >= 0) {
    const line = buf.slice(0, i); buf = buf.slice(i + 1);
    last = line; for (const c of clients) c.write(`data: ${line}\n\n`);
  }
});
sampler.on('exit', code => { console.error('rssi beendet', code); process.exit(1); });
process.on('exit', () => sampler.kill());
for (const s of ['SIGINT', 'SIGTERM']) process.on(s, () => process.exit(0));

const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript' };
http.createServer((req, res) => {
  const pathname = req.url.split('?')[0];
  if (pathname === '/stream') {
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
    clients.add(res); req.on('close', () => clients.delete(res)); return;
  }
  const name = pathname === '/' ? 'index.html' : path.basename(pathname);
  const file = path.join(DIR, name);
  if (!['index.html', 'core.js'].includes(name)) { res.writeHead(404).end(); return; }
  res.writeHead(200, { 'Content-Type': types[path.extname(file)] }).end(fs.readFileSync(file));
}).listen(PORT, '127.0.0.1', () => console.log(`Dashboard: http://localhost:${PORT}`));
