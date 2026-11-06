// E2E TASK-06 (🖼️ Molduras de recorte para imagens) no app real.
// Uso: ANDROID_SERIAL=<serial> node tools/e2e/task06.mjs <pasta-de-prints>
//      E2E_MODE=base → controle positivo no APK da base: confere que o botão "🖼️ Moldura" e o `editor.setImageFrame`
//      NÃO existem e para (PASS = funcionalidade ausente).
// Toques reais no canvas, nos botões e células da folha e no seletor de fotos do Android (uiautomator); a foto inicial
// entra por `editor.addImage` (só o preparo, como task11). Os sinais são lidos pelo `window.editor` e por pixel no render
// da página (`renderPageCanvas`), no PNG exportado e no SVG exportado rasterizado no próprio WebView.
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { adbShell, launchEditor, reporter, screencap } from './cdp.mjs';

const out = process.argv[2] ?? '.';
mkdirSync(out, { recursive: true });
const BASE = process.env.E2E_MODE === 'base';
const PHOTO = '/sdcard/Pictures/e2e_swap.jpg';
const adbEnv = { ...process.env, MSYS_NO_PATHCONV: '1' };
const adbRaw = (...args) => execFileSync('adb', args, { env: adbEnv, maxBuffer: 64 << 20 });

/** Toque estável (modelo task09/task15): espera a caixa do elemento parar de mexer antes de tocar. */
const stableTaps = (q) => {
  const raw = q.tap;
  const rectOf = (sel, text) => q.evaluate(`(() => {
    const e = [...document.querySelectorAll(${JSON.stringify(sel)})]
      .filter((x) => ${text === undefined ? 'true' : `x.textContent.includes(${JSON.stringify(text)})`})
      .filter((x) => x.getClientRects().length > 0)[0];
    if (!e) return null;
    e.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    const b = e.getBoundingClientRect();
    return [b.left, b.top, b.width, b.height].map((v) => Math.round(v)).join(',');
  })()`);
  q.tap = async (sel, text) => {
    await q.sleep(250);
    const end = Date.now() + 8000;
    let last = null;
    for (;;) {
      const now = await rectOf(sel, text);
      if (now !== null && now === last) break;
      if (Date.now() > end) {
        if (now !== null) break;
        throw new Error(`elemento não encontrado: ${sel}${text ? ` "${text}"` : ''}`);
      }
      last = now;
      await q.sleep(200);
    }
    await raw(sel, text);
  };
  return q;
};

const p = stableTaps(await launchEditor());
const r = reporter(`TASK-06 — molduras de recorte${BASE ? ' (BASE: controle positivo)' : ''}`);

const sheetOpen = (title) => p.waitFor(`document.getElementById('sheet').classList.contains('show')
  && (document.querySelector('#sheet .sheet-head strong')?.textContent ?? '').includes(${JSON.stringify(title)})`, 8000);
const sheetClosed = () => p.waitFor(`!document.getElementById('sheet').classList.contains('show')`, 8000);
const closeSheet = async () => { await p.tap('#sheet .sheet-head button'); await sheetClosed(); await p.sleep(200); };
const idle = () => p.waitFor(`!document.getElementById('busy').classList.contains('show')`, 60000).catch(() => {});
const setRange = (root, label, value) => p.evaluate(`(() => {
  const l = [...document.querySelectorAll('${root} label.slider')].find((x) => x.textContent.includes(${JSON.stringify(label)}));
  const s = l.querySelector('input'); s.value = ${JSON.stringify(String(value))}; s.dispatchEvent(new Event('input'));
  s.dispatchEvent(new Event('change')); return Number(s.value); })()`);
const tapDoc = async (x, y) => {
  const c = await p.evaluate(`editor.docToClient(${x}, ${y})`);
  await p.touch('touchStart', c.x, c.y); await p.sleep(60); await p.touch('touchEnd', c.x, c.y); await p.sleep(450);
};

/** A foto do teste (por camada: undo/reabrir trocam as instâncias). */
const IMG = `editor.canvas.getObjects().find((o) => o.layerName === 'Foto')`;
const info = () => p.evaluate(`(() => { const o = ${IMG}; if (!o) return null; o.setCoords(); const b = o.getBoundingRect();
  const c = o.clipPath; const f = typeof editor.frameOf === 'function' ? editor.frameOf(o) : null;
  return { src: o.getSrc().slice(0, 40), box: [b.left, b.top, b.width, b.height], kind: o.clipShape ?? null, clip: c ? c.type : null,
    clipW: c ? c.width * Math.abs(c.scaleX) * Math.abs(o.scaleX) : 0, clipH: c ? c.height * Math.abs(c.scaleY) * Math.abs(o.scaleY) : 0,
    stroke: o.frameStroke ?? null, sw: o.frameStrokeWidth ?? null, zoom: f ? f.scale : null, nat: o.getOriginalSize() }; })()`);
const near = (a, b, tol = 1) => a.length === b.length && a.every((v, i) => Math.abs(v - b[i]) <= tol);
const hex3 = (h) => [1, 3, 5].map((k) => parseInt(h.slice(k, k + 2), 16));
const dist = (a, b) => Math.max(...a.map((v, k) => Math.abs(v - b[k])));

/** Pontos de prova na caixa b = [left, top, w, h]: canto (fora da forma), aro (6 px para dentro do topo e da esquerda), miolo. */
const probes = (b) => ({
  corner: [b[0] + 5, b[1] + 5],
  rimTop: [b[0] + b[2] / 2, b[1] + 6],
  rimLeft: [b[0] + 6, b[1] + b[3] / 2],
  inLeft: [b[0] + b[2] * 0.3, b[1] + b[3] / 2],
  inRight: [b[0] + b[2] * 0.7, b[1] + b[3] / 2],
});
/** Cor nos pontos (coordenadas do documento × escala) de um canvas/dataURL lido no WebView. */
const sampleRender = (pts) => p.evaluate(`(() => { const { canvas, scale } = editor.renderPageCanvas();
  const x = canvas.getContext('2d'); const pts = ${JSON.stringify(pts)};
  return Object.fromEntries(Object.entries(pts).map(([k, [u, v]]) => [k, [...x.getImageData(Math.round(u * scale), Math.round(v * scale), 1, 1).data].slice(0, 3)])); })()`);
const sampleUrl = (expr, pts) => p.evaluate(`(async () => { const url = await (${expr});
  const img = new Image(); img.src = url; await img.decode();
  const c = document.createElement('canvas'); c.width = img.naturalWidth || editor.width; c.height = img.naturalHeight || editor.height;
  const x = c.getContext('2d'); x.drawImage(img, 0, 0, c.width, c.height); const s = c.width / editor.width; const pts = ${JSON.stringify(pts)};
  return Object.fromEntries(Object.entries(pts).map(([k, [u, v]]) => [k, [...x.getImageData(Math.round(u * s), Math.round(v * s), 1, 1).data].slice(0, 3)])); })()`);

const WHITE = [255, 255, 255], RED = hex3('#ff0000'), BLUE = hex3('#1e88e5'), GREEN = hex3('#43a047'), PURPLE = hex3('#8e24aa');
const TOL = 40;

// ---------- 0. preparo: fundo branco e uma foto 600×400 (metade azul, metade verde) no meio da página ----------
await p.evaluate(`(async () => {
  const cv = document.createElement('canvas'); cv.width = 600; cv.height = 400; const x = cv.getContext('2d');
  x.fillStyle = '#1e88e5'; x.fillRect(0, 0, 300, 400); x.fillStyle = '#43a047'; x.fillRect(300, 0, 300, 400);
  const img = await editor.addImage(cv.toDataURL('image/png'));
  const s = Math.min(editor.width, editor.height) * 0.7 / 600;
  img.set({ originX: 'center', originY: 'center', left: editor.width / 2, top: editor.height / 2, scaleX: s, scaleY: s, angle: 0, layerName: 'Foto' });
  img.setCoords(); editor.canvas.discardActiveObject(); editor.canvas.requestRenderAll(); editor.commit();
})()`);
await p.sleep(600);

// ---------- 1. tocar na foto → "🖼️ Moldura" ----------
const i0 = await info();
await tapDoc(i0.box[0] + i0.box[2] / 2, i0.box[1] + i0.box[3] / 2);
const selected = await p.evaluate(`editor.active?.layerName === 'Foto'`);
r.check('1. toque na foto no canvas a seleciona', selected);
screencap(`${out}/06-1-foto.png`);

if (BASE) {
  const absent = await p.evaluate(`({ btn: document.querySelector('#props .frame-btn') === null, api: typeof editor.setImageFrame === 'undefined' })`);
  r.check('BASE: o painel da imagem NÃO tem "🖼️ Moldura"', absent.btn);
  r.check('BASE: editor.setImageFrame não existe (funcionalidade ausente)', absent.api);
  r.done();
  process.exit();
}

r.check('1. o painel da imagem tem "🖼️ Moldura"', await p.evaluate(`Boolean(document.querySelector('#props .frame-btn'))`));
await p.tap('#props .frame-btn');
await sheetOpen('Moldura');
const cells = await p.evaluate(`[...document.querySelectorAll('#sheet .frame-cell')].map((c) => c.dataset.kind)`);
r.check('2. a folha mostra a grade das formas (15 células com "none")', cells.length === 15 && cells.includes('starburst-12') && cells.includes('heart'), cells.join(','));
screencap(`${out}/06-2-folha.png`);

// ---------- 2. Selo explosão, depois Círculo ----------
await p.tap('#sheet .frame-cell[data-kind="starburst-12"]');
await p.sleep(300);
const i1 = await info();
r.check('3. "Selo explosão" aplica clipShape starburst-12 e um clipPath', i1.kind === 'starburst-12' && i1.clip === 'path', JSON.stringify(i1));
r.check('3. clipPath × escala = caixa da imagem (±1 px)', Math.abs(i1.clipW - i1.box[2]) <= 1 && Math.abs(i1.clipH - i1.box[3]) <= 1, `${i1.clipW.toFixed(1)}×${i1.clipH.toFixed(1)} vs ${i1.box[2].toFixed(1)}×${i1.box[3].toFixed(1)}`);
screencap(`${out}/06-3-selo.png`);
await p.tap('#sheet .frame-cell[data-kind="circle"]');
await p.sleep(300);
r.check('4. a célula ativa é o Círculo', await p.evaluate(`document.querySelector('#sheet .frame-cell.primary')?.dataset.kind === 'circle'`));

// ---------- 3. aro vermelho de 12 px e zoom 2× ----------
await p.evaluate(`(() => { const i = document.querySelector('#sheet label.color input[type=color]'); i.value = '#ff0000'; i.dispatchEvent(new Event('input')); i.dispatchEvent(new Event('change')); })()`);
await setRange('#sheet', 'Espessura', 12);
await setRange('#sheet', 'Zoom', 2);
await p.sleep(400);
const i2 = await info();
r.check('5. Círculo com aro #ff0000 de 12 px e zoom 2×', i2.kind === 'circle' && i2.stroke === '#ff0000' && i2.sw === 12 && Math.abs(i2.zoom - 2) < 0.01, JSON.stringify(i2));
r.check('5. o zoom não muda a caixa na página (±1 px)', near(i2.box, i1.box), `${JSON.stringify(i1.box)} → ${JSON.stringify(i2.box)}`);
screencap(`${out}/06-4-circulo-aro-zoom.png`);
await closeSheet();
await p.evaluate('editor.canvas.discardActiveObject(), editor.canvas.requestRenderAll()');
await p.sleep(300);
const pts = probes(i2.box);
const c2 = await sampleRender(pts);
r.check('6. render da página: canto da caixa (fora do círculo) = fundo branco', dist(c2.corner, WHITE) <= TOL, JSON.stringify(c2.corner));
r.check('6. render: 6 px para dentro da borda (topo e esquerda) = vermelho do aro', dist(c2.rimTop, RED) <= TOL && dist(c2.rimLeft, RED) <= TOL, JSON.stringify([c2.rimTop, c2.rimLeft]));
r.check('6. render: miolo mostra a foto (azul à esquerda, verde à direita)', dist(c2.inLeft, BLUE) <= TOL && dist(c2.inRight, GREEN) <= TOL, JSON.stringify([c2.inLeft, c2.inRight]));

// ---------- 4. 🔄 Substituir pela galeria: moldura, aro, zoom e caixa mantidos ----------
const jpg = await p.evaluate(`(() => { const c = document.createElement('canvas'); c.width = 900; c.height = 1200; const x = c.getContext('2d');
  x.fillStyle = '#8e24aa'; x.fillRect(0, 0, 900, 1200); return c.toDataURL('image/jpeg', 0.95); })()`);
const local = `${out}/e2e_swap.jpg`;
writeFileSync(local, Buffer.from(jpg.split(',')[1], 'base64'));
adbRaw('push', local, PHOTO);
adbShell(`am broadcast -a android.intent.action.MEDIA_SCANNER_SCAN_FILE -d file://${PHOTO}`);
await tapDoc(i2.box[0] + i2.box[2] / 2, i2.box[1] + i2.box[3] / 2);
await p.tap('#props .swap-btn');
await sheetOpen('Substituir');
r.check('7. Substituir numa foto emoldurada não oferece "Encaixe" (preenche a moldura)', await p.evaluate(`document.querySelector('#sheet select') === null`));
await p.tap('#sheet .swap-gallery');
let picked = false;
for (let i = 0; i < 20 && !picked; i++) {
  await p.sleep(700);
  try { adbShell('uiautomator dump /data/local/tmp/ui.xml'); } catch { continue; }
  const xml = adbShell('cat /data/local/tmp/ui.xml');
  const m = /content-desc="(Photo taken|Foto tirada)[^"]*"[^>]*bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/.exec(xml);
  if (m) {
    screencap(`${out}/06-5-seletor.png`);
    adbShell(`input tap ${(Number(m[2]) + Number(m[4])) >> 1} ${(Number(m[3]) + Number(m[5])) >> 1}`);
    picked = true;
  }
}
r.check('7. seletor de fotos do sistema abriu e a 1ª foto foi tocada', picked);
await p.waitFor(`(${IMG})?.getOriginalSize().width === 900`, 20000).catch(() => {});
await idle();
await p.sleep(500);
const i3 = await info();
r.check('8. a foto foi trocada pela da galeria (900×1200)', i3.nat.width === 900 && i3.nat.height === 1200, JSON.stringify(i3.nat));
r.check('8. moldura, aro e zoom mantidos', i3.kind === 'circle' && i3.stroke === '#ff0000' && i3.sw === 12 && Math.abs(i3.zoom - 2) < 0.01, JSON.stringify(i3));
r.check('8. caixa na página igual (±1 px)', near(i3.box, i2.box), `${JSON.stringify(i2.box)} → ${JSON.stringify(i3.box)}`);
r.check('8. clipPath regerado: × escala = caixa (±1 px)', Math.abs(i3.clipW - i3.box[2]) <= 1 && Math.abs(i3.clipH - i3.box[3]) <= 1, `${i3.clipW.toFixed(1)}×${i3.clipH.toFixed(1)}`);
await p.evaluate('editor.canvas.discardActiveObject(), editor.canvas.requestRenderAll()');
const c3 = await sampleRender(pts);
r.check('8. render: aro vermelho, miolo roxo da foto nova, canto branco', dist(c3.rimTop, RED) <= TOL && dist(c3.inLeft, PURPLE) <= TOL && dist(c3.corner, WHITE) <= TOL, JSON.stringify(c3));
screencap(`${out}/06-6-substituida.png`);

// ---------- 5. ↶ desfaz a troca: foto anterior com a moldura ----------
await p.evaluate('editor.flushPending()');
await p.tap('#topbar button', '↶');
await p.waitFor(`(${IMG})?.getOriginalSize().width === 600`, 10000).catch(() => {});
await p.sleep(400);
const i4 = await info();
r.check('9. ↶ volta a foto anterior com a moldura, o aro e a mesma caixa', i4.nat.width === 600 && i4.kind === 'circle' && i4.sw === 12 && near(i4.box, i2.box)
  && Math.abs(i4.clipW - i4.box[2]) <= 1, JSON.stringify(i4));
screencap(`${out}/06-7-desfeito.png`);

// ---------- 6. exportações PNG e SVG com a moldura ----------
const png = await sampleUrl(`editor.exportRaster('png', 1, 1)`, pts);
r.check('10. PNG exportado: canto branco, aro vermelho, miolo azul/verde', dist(png.corner, WHITE) <= TOL && dist(png.rimTop, RED) <= TOL && dist(png.rimLeft, RED) <= TOL
  && dist(png.inLeft, BLUE) <= TOL && dist(png.inRight, GREEN) <= TOL, JSON.stringify(png));
const svg = await p.evaluate(`editor.exportSvg()`);
writeFileSync(`${out}/06-export.svg`, svg);
r.check('11. SVG exportado contém o <clipPath> da moldura e o <path> do aro (#ff0000, 24 = 2×12)', /<clipPath/.test(svg) && /<path d="[^"]+" fill="none" stroke="#ff0000" stroke-width="24"/.test(svg), `${svg.length} chars`);
const svgPx = await sampleUrl(`'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(${JSON.stringify(svg)})`, pts).catch((e) => ({ error: String(e) }));
r.check('11. SVG rasterizado no WebView: canto branco/transparente, aro vermelho, miolo da foto', !svgPx.error && dist(svgPx.rimTop, RED) <= TOL && dist(svgPx.inLeft, BLUE) <= TOL
  && (dist(svgPx.corner, WHITE) <= TOL || dist(svgPx.corner, [0, 0, 0]) <= TOL), JSON.stringify(svgPx));

// ---------- 7. tirar a moldura ----------
await tapDoc(i4.box[0] + i4.box[2] / 2, i4.box[1] + i4.box[3] / 2);
await p.tap('#props .frame-btn');
await sheetOpen('Moldura');
await p.tap('#sheet .frame-cell[data-kind="none"]');
await p.sleep(300);
const i5 = await info();
r.check('12. "Sem moldura" tira clipPath e propriedades (caixa igual)', i5.kind === null && i5.clip === null && i5.sw === null && near(i5.box, i4.box), JSON.stringify(i5));
await closeSheet();
screencap(`${out}/06-8-sem-moldura.png`);

r.check('sem exceções JS no console', !p.logs.some((l) => l.startsWith('EXCEPTION')), p.logs.filter((l) => l.startsWith('EXCEPTION')).join(' | '));
r.done();
process.exit();
