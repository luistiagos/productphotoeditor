// Driver E2E do editor no app real (emulador/aparelho) pelo DevTools do WebView (CDP).
// Uso: import { connect } from './cdp.mjs'; const p = await connect(); await p.tap('#tabs button:nth-child(2)'); ...
// Requer: app debug aberto no editor; ANDROID_SERIAL apontando para o aparelho; Node ≥ 22 (WebSocket global).
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';

const PKG = 'com.productphoto.offline';
const PORT = Number(process.env.CDP_PORT ?? 9333);

function adb(...args) {
  return execFileSync('adb', args, { encoding: 'utf8', env: { ...process.env, MSYS_NO_PATHCONV: '1' } }).trim();
}

export function adbShell(cmd) { return adb('shell', cmd); }

/** Print do aparelho (o que o usuário vê, com a barra do sistema). */
export function screencap(file) {
  const buf = execFileSync('adb', ['exec-out', 'screencap', '-p'], { env: { ...process.env, MSYS_NO_PATHCONV: '1' }, maxBuffer: 64 << 20 });
  writeFileSync(file, buf);
  return file;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Bounds [x1,y1,x2,y2] (px do aparelho) do 1º nó do uiautomator com esse texto, ou null. */
export function uiFind(text) {
  try { adb('shell', 'uiautomator dump /data/local/tmp/ui.xml'); } catch { return null; }
  const xml = adb('shell', 'cat /data/local/tmp/ui.xml');
  const esc = text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`(?:text|content-desc)="${esc}"[^>]*bounds="\\[(\\d+),(\\d+)\\]\\[(\\d+),(\\d+)\\]"`);
  const m = re.exec(xml);
  return m ? m.slice(1).map(Number) : null;
}

export async function uiTap(text, timeoutMs = 15000) {
  const end = Date.now() + timeoutMs;
  for (;;) {
    const b = uiFind(text);
    if (b) { adb('shell', `input tap ${(b[0] + b[2]) >> 1} ${(b[1] + b[3]) >> 1}`); return; }
    if (Date.now() > end) throw new Error(`"${text}" não apareceu na tela`);
    await sleep(700);
  }
}

/** Reabre o app do zero e entra no editor por "Novo design" → formato (padrão "Post Facebook", 1080×1080). */
export async function launchEditor(format = process.env.E2E_FORMAT ?? 'Post Facebook') {
  adb('shell', `am force-stop ${PKG}`);
  adb('shell', `am start -n ${PKG}/com.productphoto.app.MainActivity`);
  // o 1º toque às vezes cai antes da tela inicial aceitar entrada: repete até aparecer a lista de formatos
  for (let i = 0; i < 5; i++) {
    await uiTap('Novo design');
    await sleep(1200);
    if (uiFind(format)) break;
  }
  await uiTap(format);
  const p = await connect();
  await p.waitFor(`document.body.dataset.ready === 'true'`, 20000);
  return p;
}

export async function connect({ timeoutMs = 20000 } = {}) {
  const t0 = Date.now();
  let target;
  while (!target) {
    const pid = adb('shell', `pidof ${PKG}`).split(/\s+/)[0];
    if (pid) {
      try {
        adb('forward', `tcp:${PORT}`, `localabstract:webview_devtools_remote_${pid}`);
        const list = await (await fetch(`http://127.0.0.1:${PORT}/json`)).json();
        target = list.find((t) => t.type === 'page' && String(t.url).includes('/assets/editor/'));
      } catch { /* socket ainda não existe */ }
    }
    if (!target) {
      if (Date.now() - t0 > timeoutMs) throw new Error('editor não encontrado no DevTools (app aberto no editor?)');
      await sleep(500);
    }
  }
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  let id = 0;
  const pending = new Map();
  const logs = [];
  ws.onmessage = (m) => {
    const msg = JSON.parse(m.data);
    if (msg.id && pending.has(msg.id)) {
      const { res, rej } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) rej(new Error(msg.error.message)); else res(msg.result);
    } else if (msg.method === 'Runtime.consoleAPICalled') {
      logs.push(msg.params.args.map((a) => a.value ?? a.description).join(' '));
    } else if (msg.method === 'Runtime.exceptionThrown') {
      logs.push('EXCEPTION ' + (msg.params.exceptionDetails.exception?.description ?? msg.params.exceptionDetails.text));
    }
  };
  const send = (method, params = {}) => new Promise((res, rej) => {
    const i = ++id;
    pending.set(i, { res, rej });
    ws.send(JSON.stringify({ id: i, method, params }));
  });
  await send('Runtime.enable');

  /** Avalia uma expressão (pode ser async) e devolve o valor em JSON. */
  const evaluate = async (expr) => {
    const r = await send('Runtime.evaluate', { expression: `(async () => (${expr}))()`, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) throw new Error('JS: ' + (r.exceptionDetails.exception?.description ?? r.exceptionDetails.text));
    return r.result.value;
  };

  const waitFor = async (expr, ms = 10000) => {
    const end = Date.now() + ms;
    for (;;) {
      try { if (await evaluate(`Boolean(${expr})`)) return; } catch { /* página ainda carregando */ }
      if (Date.now() > end) throw new Error('timeout esperando ' + expr);
      await sleep(150);
    }
  };

  /** Centro (CSS px) do 1º elemento que casa com o seletor e, se dado, contém o texto. */
  const center = async (selector, text) => {
    const r = await evaluate(`(() => {
      const els = [...document.querySelectorAll(${JSON.stringify(selector)})]
        .filter((e) => ${text === undefined ? 'true' : `e.textContent.includes(${JSON.stringify(text)})`})
        .filter((e) => e.getClientRects().length > 0);
      const e = els[0];
      if (!e) return null;
      e.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      const b = e.getBoundingClientRect();
      return { x: b.left + b.width / 2, y: b.top + b.height / 2 };
    })()`);
    if (!r) throw new Error(`elemento não encontrado: ${selector}${text ? ` "${text}"` : ''}`);
    return r;
  };

  const touch = async (type, x, y) => send('Input.dispatchTouchEvent', {
    type, touchPoints: type === 'touchEnd' ? [] : [{ x, y, radiusX: 4, radiusY: 4, force: 1, id: 1 }],
  });

  /** Toque real (touchStart/End) no centro do elemento. */
  const tap = async (selector, text) => {
    const { x, y } = await center(selector, text);
    await touch('touchStart', x, y);
    await sleep(60);
    await touch('touchEnd', x, y);
    await sleep(250);
  };

  /** Arrasta o dedo de (x1,y1) a (x2,y2) em `steps` passos, com pausa opcional antes de soltar. */
  const drag = async (x1, y1, x2, y2, { steps = 12, holdMs = 0 } = {}) => {
    await touch('touchStart', x1, y1);
    for (let i = 1; i <= steps; i++) {
      await touch('touchMove', x1 + ((x2 - x1) * i) / steps, y1 + ((y2 - y1) * i) / steps);
      await sleep(16);
    }
    if (holdMs) await sleep(holdMs);
    await touch('touchEnd', x2, y2);
    await sleep(250);
  };

  /** Pinça de dois dedos (centro cx,cy; distância d1 → d2). */
  const pinch = async (cx, cy, d1, d2, { steps = 12 } = {}) => {
    const pts = (d) => [{ x: cx - d / 2, y: cy, id: 1 }, { x: cx + d / 2, y: cy, id: 2 }];
    await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: pts(d1) });
    for (let i = 1; i <= steps; i++) {
      await send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: pts(d1 + ((d2 - d1) * i) / steps) });
      await sleep(16);
    }
    await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await sleep(250);
  };

  const close = () => ws.close();
  return { send, evaluate, waitFor, center, touch, tap, drag, pinch, logs, close, sleep };
}

/** Relatório simples: check(nome, condição, detalhe) e resumo no fim (exit 1 se falhou). */
export function reporter(title) {
  const results = [];
  console.log(`# ${title}`);
  return {
    check(name, ok, detail = '') {
      results.push({ name, ok });
      console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  — ${detail}` : ''}`);
    },
    done() {
      const failed = results.filter((r) => !r.ok).length;
      console.log(`\n${results.length - failed}/${results.length} ok`);
      if (failed) process.exitCode = 1;
    },
  };
}
