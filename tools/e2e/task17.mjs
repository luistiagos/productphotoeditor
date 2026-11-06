// E2E TASK-17 (Vinheta, Borda suave e Desfoque de foco radial/linear na folha Filtros) no app real.
// Uso: ANDROID_SERIAL=<serial> node tools/e2e/task17.mjs <pasta-de-prints>
// Toques reais na foto, no botão Filtros e nos chips do foco; <input type=range> recebe o valor por evento (como no
// task07). Pixels lidos no elemento filtrado da foto (`img.getElement()`, o que o Fabric desenha) e na página composta
// (`editor.renderPageCanvas()`, o caminho do PNG/JPG). O check 0 diz se o backend de filtros é o WebGL: só então a
// prova vale para o SHADER (o vitest só cobre o caminho 2D).
// Com o APK da base (controle positivo) os checks da funcionalidade FALHAM: ela ainda não existe.
import { launchEditor, reporter, screencap } from './cdp.mjs';

const out = process.argv[2] ?? '.';
const p = await launchEditor();
const r = reporter('TASK-17 — vinheta, borda suave, desfoque de foco');
const BG = '#2e7d32';
const hex = (c) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
const near = (a, b, tol) => Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((v, i) => Math.abs(v - b[i]) <= tol);

// foto 400×300: xadrez de 8 px #c0c0c0/#404040, escala 1, no centro da página
await p.evaluate(`(async () => {
  await editor.newDocument('E2E 17', 1080, 1080);
  editor.setBackgroundColor('${BG}');
  const cv = document.createElement('canvas'); cv.width = 400; cv.height = 300; const x = cv.getContext('2d');
  for (let y = 0; y < 300; y += 8) for (let i = 0; i < 400; i += 8) { x.fillStyle = ((i + y) / 8) % 2 ? '#404040' : '#c0c0c0'; x.fillRect(i, y, 8, 8); }
  const img = await editor.addImage(cv.toDataURL('image/png'));
  img.set({ scaleX: 1, scaleY: 1, layerName: 'Foto' });
  img.setPositionByOrigin({ x: 540, y: 540 }, 'center', 'center');
  img.setCoords();
  editor.canvas.discardActiveObject(); editor.canvas.requestRenderAll(); editor.commit();
})()`);
await p.sleep(500);

const FOTO = `editor.canvas.getObjects().find((o) => o.layerName === 'Foto')`;
// pixels do elemento filtrado (sem filtro o elemento é o <img> original: desenha num canvas para ler)
const ELEM = `(() => { const el = ${FOTO}.getElement(); const c = document.createElement('canvas'); c.width = el.naturalWidth || el.width;
  c.height = el.naturalHeight || el.height; const x = c.getContext('2d'); x.drawImage(el, 0, 0); return x; })()`;
/** Canal R (média e variância) e alfa mínimo de um bloco do elemento. */
const blockStats = (x, y, w, h) => p.evaluate(`(() => { const d = ${ELEM}.getImageData(${x}, ${y}, ${w}, ${h}).data; let s = 0, s2 = 0, amin = 255;
  for (let i = 0; i < d.length; i += 4) { s += d[i]; s2 += d[i] * d[i]; amin = Math.min(amin, d[i + 3]); }
  const n = d.length / 4, m = s / n; return { mean: m, variance: s2 / n - m * m, amin }; })()`);
const elemPx = (x, y) => p.evaluate(`[...${ELEM}.getImageData(${x}, ${y}, 1, 1).data]`);
const elemRow = (y) => p.evaluate(`[...${ELEM}.getImageData(0, ${y}, ${FOTO}.getElement().width, 1).data]`);
const elemHash = () => p.evaluate(`(() => { const d = ${ELEM}.getImageData(0, 0, 400, 300).data; let h = 0; for (let i = 0; i < d.length; i++) h = (h * 31 + d[i]) >>> 0; return h; })()`);
/** Pixel RGBA da página composta no ponto (dx, dy) relativo ao canto da caixa da foto (px do documento). */
const pagePx = (dx, dy) => p.evaluate(`(() => { const o = ${FOTO}; o.setCoords(); const b = o.getBoundingRect(); const { canvas, scale } = editor.renderPageCanvas();
  return [...canvas.getContext('2d').getImageData(Math.round((b.left + ${dx}) * scale), Math.round((b.top + ${dy}) * scale), 1, 1).data]; })()`);
const state = () => p.evaluate(`(() => { const o = ${FOTO}; return o ? o.filters.map((f) => f.toObject()) : null; })()`);
/** Toque real no centro da foto; repete (até 3×) se o toque cair antes do canvas aceitar entrada. */
const tapPhoto = async () => {
  for (let i = 0; i < 3; i++) {
    const c = await p.evaluate(`(() => { const k = ${FOTO}.getCenterPoint(); return editor.docToClient(k.x, k.y); })()`);
    await p.touch('touchStart', c.x, c.y); await p.sleep(60); await p.touch('touchEnd', c.x, c.y); await p.sleep(450);
    if ((await p.evaluate(`editor.active?.layerName ?? null`)) === 'Foto') return;
  }
};
const tryTap = async (selector, text) => { try { await p.tap(selector, text); return true; } catch { return false; } };
/** Toque real que repete (até 3×) até `cond` (expressão na página) valer: um toque perdido não vira falso negativo. */
const tapUntil = async (selector, text, cond) => {
  for (let i = 0; i < 3; i++) {
    await tryTap(selector, text);
    await p.sleep(300);
    if (await p.evaluate(`Boolean(${cond})`)) return true;
  }
  return false;
};
const SHEET_OPEN = `document.querySelectorAll('#sheet label.slider').length > 0`;
const chipActive = (label) => `[...document.querySelectorAll('#sheet button.focus-chip.primary')].map((b) => b.textContent).join() === ${JSON.stringify(label)}`;
const rangeOf = (label) => p.evaluate(`(() => {
  const l = [...document.querySelectorAll('#sheet label.slider')].find((x) => x.querySelector('span')?.textContent === ${JSON.stringify(label)});
  const s = l?.querySelector('input'); return s ? { value: Number(s.value), min: Number(s.min), max: Number(s.max), step: Number(s.step), shown: l.querySelector('.val')?.textContent } : null; })()`);
const setRange = (label, value) => p.evaluate(`(() => {
  const l = [...document.querySelectorAll('#sheet label.slider')].find((x) => x.querySelector('span')?.textContent === ${JSON.stringify(label)});
  const s = l?.querySelector('input'); if (!s) return null; s.value = ${JSON.stringify(String(value))}; s.dispatchEvent(new Event('input')); s.dispatchEvent(new Event('change')); return Number(s.value); })()`);
const sheetInfo = () => p.evaluate(`({ sliders: [...document.querySelectorAll('#sheet label.slider > span:first-child')].map((s) => s.textContent),
  focus: [...document.querySelectorAll('#sheet button.focus-chip')].map((b) => b.textContent),
  active: [...document.querySelectorAll('#sheet button.focus-chip.primary')].map((b) => b.textContent).join() })`);
const closeSheet = async () => { await tryTap('#sheet .sheet-head button'); await p.sleep(200); };
// blocos 20×20; canto e topo a 30 px da borda (alfa da Borda suave ainda alto: a leitura do rgb não perde precisão)
const CORNER = [30, 30, 20, 20], CENTER = [190, 140, 20, 20], TOP = [190, 30, 20, 20];

// ---------- 0. backend de filtros ----------
const webgl = await p.evaluate(`typeof ppEditor.filterBackendIsWebGL === 'function' ? ppEditor.filterBackendIsWebGL() : 'ausente'`);
r.check('0. backend de filtros é o WebGL (a prova abaixo é do shader)', webgl === true, `filterBackendIsWebGL = ${webgl}`);

// ---------- 1. folha Filtros ----------
await tapPhoto();
r.check('1. toque seleciona a foto', (await p.evaluate(`editor.active?.layerName ?? null`)) === 'Foto');
await tapUntil('#props button', 'Filtros', SHEET_OPEN);
const sheet1 = await sheetInfo();
r.check('1. folha Filtros tem os sliders Vinheta e Borda suave', sheet1.sliders.includes('Vinheta') && sheet1.sliders.includes('Borda suave'), JSON.stringify(sheet1.sliders));
r.check('1. folha Filtros tem os chips Sem foco / Foco radial / Foco linear (Sem foco ativo)',
  ['Sem foco', 'Foco radial', 'Foco linear'].every((t) => sheet1.focus.includes(t)) && sheet1.active === 'Sem foco', JSON.stringify(sheet1));
const vigR = await rangeOf('Vinheta'), softR = await rangeOf('Borda suave');
r.check('1. faixas: Vinheta −1..1 passo 0.05; Borda suave 0..1 passo 0.05',
  vigR?.min === -1 && vigR?.max === 1 && vigR?.step === 0.05 && softR?.min === 0 && softR?.max === 1 && softR?.step === 0.05, JSON.stringify({ vigR, softR }));
screencap(`${out}/17-1-folha.png`);

// ---------- 2. Vinheta 0.8 ----------
const corner0 = await blockStats(...CORNER), center0 = await blockStats(...CENTER), top0 = await blockStats(...TOP);
const pageCorner0 = await pagePx(40, 40);
await setRange('Vinheta', 0.8);
await p.sleep(400);
const st2 = await state();
const corner2 = await blockStats(...CORNER), center2 = await blockStats(...CENTER);
const pageCorner2 = await pagePx(40, 40);
r.check('2. img.filters tem o Vignette 0.8', Array.isArray(st2) && st2.some((f) => f.type === 'Vignette' && f.vignette === 0.8), JSON.stringify(st2));
r.check('2. canto da foto < 0,75× do de antes; centro igual (±2)', corner2.mean < 0.75 * corner0.mean && Math.abs(center2.mean - center0.mean) <= 2,
  `canto ${corner0.mean.toFixed(1)} → ${corner2.mean.toFixed(1)}; centro ${center0.mean.toFixed(1)} → ${center2.mean.toFixed(1)}`);
r.check('2. na página composta o canto também escureceu', pageCorner2[0] < pageCorner0[0] - 20, `${pageCorner0} → ${pageCorner2}`);
screencap(`${out}/17-2-vinheta.png`);

// ---------- 3. Borda suave 0.5 ----------
await setRange('Borda suave', 0.5);
await p.sleep(400);
const edge3 = await elemPx(1, 150), mid3 = await elemPx(200, 150);
const pageEdge3 = await pagePx(1, 150);
r.check('3. alfa da borda esquerda (1,150) < 40 e do centro = 255', edge3[3] < 40 && mid3[3] === 255, `borda ${edge3} centro ${mid3}`);
r.check('3. na página, a borda esquerda da foto ≈ verde do fundo (±20)', near(pageEdge3.slice(0, 3), hex(BG), 20), `${pageEdge3} vs ${hex(BG)}`);
screencap(`${out}/17-3-borda-suave.png`);

// ---------- 4. Foco radial e linear ----------
const corner3 = await blockStats(...CORNER), center3 = await blockStats(...CENTER), top3 = await blockStats(...TOP);
const row3 = await elemRow(150);
const radialTapped = await tapUntil('#sheet button.focus-chip', 'Foco radial', chipActive('Foco radial'));
await setRange('Intensidade', 0.8);
await setRange('Raio', 0.15);
await setRange('Transição', 0.1);
await p.sleep(400);
const st4 = await state();
const corner4 = await blockStats(...CORNER), center4 = await blockStats(...CENTER);
const fb4 = Array.isArray(st4) ? st4.find((f) => f.type === 'FocusBlur') : null;
r.check('4. Foco radial: img.filters tem o FocusBlur radial (0.8 / 0.15 / 0.1)', radialTapped && fb4?.mode === 'radial' && fb4.blur === 0.8 && fb4.radius === 0.15 && fb4.feather === 0.1, JSON.stringify(fb4));
r.check('4. Foco radial: variância do centro igual (±5 %), do canto < 0,4× (o xadrez some)',
  Math.abs(center4.variance - center3.variance) <= 0.05 * center3.variance && corner4.variance < 0.4 * corner3.variance,
  `centro ${center3.variance.toFixed(0)} → ${center4.variance.toFixed(0)}; canto ${corner3.variance.toFixed(0)} → ${corner4.variance.toFixed(0)}`);
screencap(`${out}/17-4a-foco-radial.png`);
const linearTapped = await tapUntil('#sheet button.focus-chip', 'Foco linear', chipActive('Foco linear'));
const angR = await rangeOf('Ângulo');
await setRange('Ângulo', 0);
await p.sleep(400);
const row4 = await elemRow(150), top4 = await blockStats(...TOP);
r.check('4. Foco linear: chip ativo e slider Ângulo −90..90 (só no linear)', linearTapped && (await sheetInfo()).active === 'Foco linear' && angR?.min === -90 && angR?.max === 90, JSON.stringify(angR));
r.check('4. Foco linear 0°: linha central (y = 150) igual (±2), topo com variância < 0,4×',
  near(row4, row3, 2) && top4.variance < 0.4 * top3.variance, `topo ${top3.variance.toFixed(0)} → ${top4.variance.toFixed(0)}; antes do foco ${top0.variance.toFixed(0)}`);
const hash0deg = await elemHash();
await setRange('Ângulo', 45);
await p.sleep(400);
r.check('4. Ângulo 45 muda o resultado', (await elemHash()) !== hash0deg);
screencap(`${out}/17-4b-foco-linear.png`);
await closeSheet();

// ---------- 5. Exportação ----------
const decode = (dataUrlExpr, pts) => p.evaluate(`(async () => { const url = ${dataUrlExpr}; const im = new Image(); im.src = url; await im.decode();
  const c = document.createElement('canvas'); c.width = im.naturalWidth; c.height = im.naturalHeight; const x = c.getContext('2d'); x.drawImage(im, 0, 0);
  return ${JSON.stringify(pts)}.map(([px, py, w, h]) => { const d = x.getImageData(px, py, w, h).data; let s = 0, a = 255;
    for (let i = 0; i < d.length; i += 4) { s += d[i]; a = Math.min(a, d[i + 3]); } return { r: s / (d.length / 4), amin: a }; }); })()`);
const box = await p.evaluate(`(() => { const o = ${FOTO}; o.setCoords(); const b = o.getBoundingRect(); return [b.left, b.top]; })()`);
const at = (x, y, w = 1, h = 1) => [Math.round(box[0] + x), Math.round(box[1] + y), w, h];
const pts = [at(1, 150), at(200, 150), at(60, 60, 10, 10)];
const pagePts = await p.evaluate(`(() => { const { canvas, scale } = editor.renderPageCanvas(); const x = canvas.getContext('2d');
  return ${JSON.stringify(pts)}.map(([px, py, w, h]) => { const d = x.getImageData(Math.round(px * scale), Math.round(py * scale), w, h).data; let s = 0;
    for (let i = 0; i < d.length; i += 4) s += d[i]; return s / (d.length / 4); }); })()`);
const png = await decode(`await editor.exportRaster('png', 1, 1)`, pts);
const jpg = await decode(`await editor.exportRaster('jpeg', 1, 0.9)`, pts);
r.check('5. PNG: borda da foto = fundo (vermelho do verde), centro e bloco iguais à página (±3)',
  Math.abs(png[0].r - hex(BG)[0]) <= 20 && png.every((v, i) => Math.abs(v.r - pagePts[i]) <= 3), `png ${JSON.stringify(png)} página ${pagePts}`);
r.check('5. JPG: mesmos pontos ≈ página (±12)', jpg.every((v, i) => Math.abs(v.r - pagePts[i]) <= 12), `jpg ${JSON.stringify(jpg)}`);
// vídeo: cada camada vira um PNG recortado na própria caixa + 2 px (escala 1 num doc 1080): pixel (x, y) da foto = (x + 2, y + 2)
const elemMid = await elemPx(200, 150), elemBlock = await blockStats(60, 60, 10, 10);
const video = await p.evaluate(`(async () => { const b = await editor.exportVideoBundle('mp4'); const i = editor.canvas.getObjects().indexOf(${FOTO});
  const url = b.files['layer_' + i + '.png']; if (!url) return { error: Object.keys(b.files) };
  const im = new Image(); im.src = url; await im.decode(); const c = document.createElement('canvas'); c.width = im.naturalWidth; c.height = im.naturalHeight;
  const x = c.getContext('2d'); x.drawImage(im, 0, 0); const px = (a, b) => [...x.getImageData(a, b, 1, 1).data];
  const d = x.getImageData(62, 62, 10, 10).data; let s = 0; for (let k = 0; k < d.length; k += 4) s += d[k];
  return { size: [c.width, c.height], edge: px(3, 152), center: px(202, 152), block: s / 100 }; })()`);
r.check('5. vídeo: PNG da camada da foto = elemento filtrado (borda alfa < 40, centro opaco igual, bloco vinhetado igual ±4)',
  !video.error && video.edge[3] < 40 && near(video.center, elemMid, 2) && Math.abs(video.block - elemBlock.mean) <= 4,
  `${JSON.stringify(video)} elemento centro ${elemMid} bloco ${elemBlock.mean.toFixed(1)}`);

// ---------- 6. Recorte: a borda acompanha a parte visível ----------
await p.evaluate(`(() => { const o = ${FOTO}; editor.canvas.setActiveObject(o); editor.startCrop(); o.set({ cropX: 100, width: 300 }); o.setCoords(); editor.endCrop(); })()`);
await p.sleep(400);
const st6 = await state();
const newEdge = await elemPx(101, 150), oldEdge = await elemPx(1, 150), mid6 = await elemPx(250, 150);
r.check('6. depois do recorte (cropX 100): região dos filtros x0 = 0.25', Array.isArray(st6) && st6.filter((f) => 'x0' in f).length === 3 && st6.filter((f) => 'x0' in f).every((f) => f.x0 === 0.25),
  JSON.stringify(st6?.filter((f) => 'x0' in f).map((f) => [f.type, f.x0])));
r.check('6. alfa da nova borda visível (101,150) < 40; centro visível opaco', newEdge[3] < 40 && mid6[3] === 255, `nova borda ${newEdge} antiga ${oldEdge} centro ${mid6}`);
screencap(`${out}/17-6-recorte.png`);

// ---------- 7. Persistência (reabrir rascunho) e undo ----------
const saved7 = await state();
const hash7 = await elemHash();
let loadErr = null;
try { await p.evaluate(`(async () => { const d = JSON.parse(JSON.stringify(editor.toDocument())); await editor.load(d); })()`); } catch (e) { loadErr = String(e); }
await p.sleep(800);
const st7 = await state();
r.check('7. rascunho reabre sem exceção e com Vignette, SoftEdge e FocusBlur iguais', !loadErr && JSON.stringify(st7) === JSON.stringify(saved7)
  && ['Vignette', 'SoftEdge', 'FocusBlur'].every((t) => st7.some((f) => f.type === t)), loadErr ?? JSON.stringify(st7));
r.check('7. pixels da foto reaberta iguais aos de antes', (await elemHash()) === hash7);
await tapPhoto();
await tapUntil('#props button', 'Filtros', SHEET_OPEN);
const vig7 = await rangeOf('Vinheta'), soft7 = await rangeOf('Borda suave'), ang7 = await rangeOf('Ângulo'), sheet7 = await sheetInfo();
r.check('7. folha reaberta mostra Vinheta 0.80, Borda suave 0.50, "Foco linear" destacado e Ângulo 45',
  vig7?.shown === '0.80' && soft7?.shown === '0.50' && sheet7.active === 'Foco linear' && ang7?.value === 45, JSON.stringify({ vig7, soft7, ang7, active: sheet7.active }));
screencap(`${out}/17-7-reaberto.png`);
await closeSheet();
let undoErr = null;
try { await p.evaluate(`editor.undo()`); } catch (e) { undoErr = String(e); }
await p.sleep(500);
const st7u = await state();
r.check('7. undo sem exceção e a foto continua com os filtros próprios', !undoErr && Array.isArray(st7u) && st7u.some((f) => f.type === 'FocusBlur'), undoErr ?? JSON.stringify(st7u?.map((f) => f.type)));

r.check('sem exceções JS no console', !p.logs.some((l) => l.startsWith('EXCEPTION')), p.logs.filter((l) => l.startsWith('EXCEPTION')).join(' | '));
r.done();
p.close();
