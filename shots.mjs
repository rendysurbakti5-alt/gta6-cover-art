// Screenshot driver for ViceFrame: launches the local Chromium over CDP,
// serves app/ to it through the Fetch domain under a public-looking origin
// (this Chromium build will not load loopback pages), stages each ?shot=
// scene and saves Page.captureScreenshot output into screenshots/.
//
//   node shots.mjs
//
// The scenes live in app/src/shots.js; this file only drives the browser.

import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, existsSync, statSync } from 'node:fs';
import { extname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoDir = fileURLToPath(new URL('.', import.meta.url));
const appDir = join(repoDir, 'app');
const outDir = join(repoDir, 'screenshots');
const ORIGIN = 'https://coverart.local';
const CDP_PORT = 9222;

const SHOTS = [
  { name: '1-cover.jpg', query: '?shot=export', width: 1280, height: 720 },
  { name: '2-editor.jpg', query: '?shot=editor', width: 1280, height: 1280 },
  { name: '3-cover-portrait.jpg', query: '?shot=export-portrait', width: 864, height: 1080 },
  { name: '4-editor-neon.jpg', query: '?shot=editor-neon', width: 1280, height: 720 },
];

const CONTENT_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
};

// --- Chromium launch --------------------------------------------------------

// This Chromium build wants its WebGL domain policy as a line-based file:
// the all-origins policy token on its own line, newline-terminated, with the
// file's lowercase sha256 passed alongside.
const policyText = 'hatch-webgl-all-origins-v1\n';
const policyFile = '/tmp/hatch-webgl-policy.txt';
writeFileSync(policyFile, policyText);
const policySha = createHash('sha256').update(policyText).digest('hex');

const chrome = spawn('/opt/meta-chromium/chrome', [
  '--headless=new',
  '--no-sandbox',
  '--disable-gpu',
  '--hide-scrollbars',
  '--force-device-scale-factor=1',
  `--remote-debugging-port=${CDP_PORT}`,
  '--remote-debugging-address=127.0.0.1',
  '--user-data-dir=/tmp/viceframe-chrome-profile',
  `--hatch-webgl-allowed-domains-file=${policyFile}`,
  `--hatch-webgl-allowed-domains-sha256=${policySha}`,
  'about:blank',
], { stdio: ['ignore', 'ignore', 'pipe'] });
chrome.stderr.on('data', (chunk) => process.stderr.write(`[chrome] ${chunk}`));

async function waitForDebuggerUrl() {
  for (let i = 0; i < 60; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${CDP_PORT}/json/version`);
      const info = await res.json();
      if (info.webSocketDebuggerUrl) return info.webSocketDebuggerUrl;
    } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error('Chromium debugger did not come up');
}

// --- A minimal CDP client -----------------------------------------------------

class Cdp {
  constructor(ws) {
    this.ws = ws;
    this.nextId = 1;
    this.pending = new Map();
    this.handlers = new Map();
    ws.addEventListener('message', (event) => {
      const msg = JSON.parse(event.data);
      if (msg.id !== undefined && this.pending.has(msg.id)) {
        const { resolvePromise, rejectPromise } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        if (msg.error) rejectPromise(new Error(`${msg.error.message} (${msg.error.code})`));
        else resolvePromise(msg.result);
      } else if (msg.method) {
        for (const handler of this.handlers.get(msg.method) ?? []) handler(msg.params, msg.sessionId);
      }
    });
  }

  on(method, handler) {
    if (!this.handlers.has(method)) this.handlers.set(method, []);
    this.handlers.get(method).push(handler);
  }

  send(method, params = {}, sessionId = undefined) {
    const id = this.nextId++;
    const payload = { id, method, params };
    if (sessionId) payload.sessionId = sessionId;
    return new Promise((resolvePromise, rejectPromise) => {
      this.pending.set(id, { resolvePromise, rejectPromise });
      this.ws.send(JSON.stringify(payload));
    });
  }
}

// --- Fetch interception: serve app/ from disk under the fake origin -----------

function fulfilFromDisk(cdp, sessionId, params) {
  const url = new URL(params.request.url);
  let pathname = decodeURIComponent(url.pathname);
  if (pathname.endsWith('/')) pathname += 'index.html';
  const file = resolve(join(appDir, `.${pathname}`));
  const inside = file === appDir || file.startsWith(appDir + sep);
  if (!inside || !existsSync(file) || !statSync(file).isFile()) {
    cdp.send('Fetch.fulfillRequest', {
      requestId: params.requestId,
      responseCode: 404,
      responseHeaders: [{ name: 'Content-Type', value: 'text/plain' }],
      body: Buffer.from('not found').toString('base64'),
    }, sessionId).catch(() => {});
    return;
  }
  cdp.send('Fetch.fulfillRequest', {
    requestId: params.requestId,
    responseCode: 200,
    responseHeaders: [
      { name: 'Content-Type', value: CONTENT_TYPES[extname(file).toLowerCase()] ?? 'application/octet-stream' },
      { name: 'Cache-Control', value: 'no-store' },
    ],
    body: readFileSync(file).toString('base64'),
  }, sessionId).catch(() => {});
}

// --- Main -----------------------------------------------------------------------

const wsUrl = await waitForDebuggerUrl();
const ws = new WebSocket(wsUrl);
await new Promise((resolveOpen, rejectOpen) => {
  ws.addEventListener('open', resolveOpen, { once: true });
  ws.addEventListener('error', rejectOpen, { once: true });
});
const cdp = new Cdp(ws);

const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });

cdp.on('Fetch.requestPaused', (params, sid) => fulfilFromDisk(cdp, sid, params));
cdp.on('Runtime.consoleAPICalled', (params) => {
  const text = params.args.map((a) => a.value ?? a.description ?? '').join(' ');
  console.log(`[page:${params.type}] ${text}`);
});
cdp.on('Log.entryAdded', (params) => {
  if (params.entry.level === 'error') console.log(`[page log] ${params.entry.text}`);
});

await cdp.send('Page.enable', {}, sessionId);
await cdp.send('Runtime.enable', {}, sessionId);
await cdp.send('Log.enable', {}, sessionId);
await cdp.send('Fetch.enable', { patterns: [{ urlPattern: `${ORIGIN}/*` }] }, sessionId);

async function waitForShotReady(timeoutMs = 30000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const result = await cdp.send('Runtime.evaluate', {
      expression: 'window.__shotReady === true',
      returnByValue: true,
    }, sessionId);
    if (result.result.value === true) return;
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error('scene never set window.__shotReady');
}

for (const shot of SHOTS) {
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width: shot.width,
    height: shot.height,
    deviceScaleFactor: 1,
    mobile: false,
  }, sessionId);
  await cdp.send('Page.navigate', { url: `${ORIGIN}/${shot.query}` }, sessionId);
  await waitForShotReady();
  await new Promise((r) => setTimeout(r, 350)); // let the last paint settle

  let quality = 84;
  let saved = null;
  while (quality >= 50) {
    const capture = await cdp.send('Page.captureScreenshot', {
      format: 'jpeg',
      quality,
      captureBeyondViewport: false,
    }, sessionId);
    const bytes = Buffer.from(capture.data, 'base64');
    if (bytes.length <= 262144 || quality === 50) {
      const path = join(outDir, shot.name);
      writeFileSync(path, bytes);
      saved = { path, bytes: bytes.length, quality };
      break;
    }
    quality -= 8;
  }
  console.log(`saved ${saved.path} — ${saved.bytes} bytes at jpeg quality ${saved.quality}`);
}

await cdp.send('Target.closeTarget', { targetId }).catch(() => {});
ws.close();
chrome.kill('SIGTERM');
console.log('done');
