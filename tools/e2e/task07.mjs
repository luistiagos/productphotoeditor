// E2E TASK-07 (modo de mesclagem por camada; Nitidez, Temperatura e Duotone na folha Filtros) no app real.
// Uso: ANDROID_SERIAL=<serial> node tools/e2e/task07.mjs <pasta-de-prints>
// Toques reais nos botões; <select> e <input type=range> recebem o valor por evento (o seletor nativo do Android não é
// um elemento da página). Pixels lidos de editor.renderPageCanvas() (o mesmo caminho do export PNG/JPG).
// Com o APK da base (controle positivo) os checks da funcionalidade FALHAM: ela ainda não existe.
import { launchEditor, reporter, screencap } from './cdp.mjs';

const out = process.argv[2] ?? '.';
const p = await launchEditor();
const r = reporter('TASK-07 — mesclagem, nitidez, temperatura, duotone');
const near = (a, b, tol) => Array.isArray(a) && a.length === b.length && a.every((v, i) => Math.abs(v - b[i]) <= tol);
const hex = (c) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));

const BG = '#2e7d32', RECT = '#ff9800', SHADOW = '#1a237e', HIGHLIGHT = '#ffeb3b';

await p.evaluate(`(async () => {
  await editor.newDocument('E2E 07', 1080, 1080);
  editor.setBackgroundColor('${BG}');
  ppEditor.setBrandKit({ profile: {}, colors: { primary: '${SHADOW}', secondary: '${HIGHLIGHT}' }, fonts: {} });
  const cv = document.createElement('canvas'); cv.width = 400; cv.height = 300; const x = cv.getContext('2d');
  x.fillStyle = '#000000'; x.fillRect(0, 0, 200, 300); x.fillStyle = '#ffffff'; x.fillRect(200, 0, 200, 300);
  const img = await editor.addImage(cv.toDataURL('image/png'));
  img.set({ left: 300, top: 300, scaleX: 1, scaleY: 1, layerName: 'Foto' });
  const rect = editor.addShape('rect', '${RECT}'); rect.set({ left: 760, top: 800, width: 160, height: 120, layerName: 'Faixa' });
  for (const o of [img, rect]) o.setCoords();
  editor.canvas.discardActiveObject(); editor.canvas.requestRenderAll(); editor.commit();
  Object.assign(window, { __img: img, __rect: rect });
})()`);
await p.sleep(500);

/** Pixel RGB da página exportada no ponto (fx, fy) relativo à caixa da camada (0..1). */
const pixelOf = (layer, fx, fy) => p.evaluate(`(() => {
  const o = editor.canvas.getObjects().find((x) => x.layerName === ${JSON.stringify(layer)}); o.setCoords();
  const b = o.getBoundingRect(); const { canvas, scale } = editor.renderPageCanvas();
  const d = canvas.getContext('2d').getImageData(Math.round((b.left + b.width * ${fx}) * scale), Math.round((b.top + b.height * ${fy}) * scale), 1, 1).data;
  return [d[0], d[1], d[2]]; })()`);
/** Soma simples dos pixels da caixa da camada na página (muda quando a imagem muda). */
const hashOf = (layer) => p.evaluate(`(() => {
  const o = editor.canvas.getObjects().find((x) => x.layerName === ${JSON.stringify(layer)}); o.setCoords();
  const b = o.getBoundingRect(); const { canvas, scale } = editor.renderPageCanvas();
  const d = canvas.getContext('2d').getImageData(Math.round(b.left * scale), Math.round(b.top * scale), Math.max(1, Math.round(b.width * scale)), Math.max(1, Math.round(b.height * scale))).data;
  let h = 0; for (let i = 0; i < d.length; i++) h = (h * 31 + d[i]) >>> 0; return h; })()`);
const tapLayer = async (layer) => {
  const c = await p.evaluate(`(() => { const o = editor.canvas.getObjects().find((x) => x.layerName === ${JSON.stringify(layer)}); const k = o.getCenterPoint(); return editor.docToClient(k.x, k.y); })()`);
  await p.touch('touchStart', c.x, c.y); await p.sleep(60); await p.touch('touchEnd', c.x, c.y); await p.sleep(450);
};
const tryTap = async (selector, text) => { try { await p.tap(selector, text); return true; } catch { return false; } };
const selectInfo = (label) => p.evaluate(`(() => {
  const l = [...document.querySelectorAll('#props label')].find((x) => x.querySelector('select') && x.textContent.includes(${JSON.stringify(label)}));
  const s = l?.querySelector('select'); return s ? { value: s.value, options: [...s.options].map((o) => o.value) } : null; })()`);
const setSelect = (label, value) => p.evaluate(`(() => {
  const l = [...document.querySelectorAll('#props label')].find((x) => x.querySelector('select') && x.textContent.includes(${JSON.stringify(label)}));
  const s = l?.querySelector('select'); if (!s) return null; s.value = ${JSON.stringify(value)}; s.dispatchEvent(new Event('change')); return s.value; })()`);
const rangeOf = (label) => p.evaluate(`(() => {
  const l = [...document.querySelectorAll('#sheet label.slider')].find((x) => x.textContent.includes(${JSON.stringify(label)}));
  const s = l?.querySelector('input'); return s ? { value: Number(s.value), min: Number(s.min), max: Number(s.max), step: Number(s.step), shown: l.querySelector('.val')?.textContent } : null; })()`);
const setRange = (label, value) => p.evaluate(`(() => {
  const l = [...document.querySelectorAll('#sheet label.slider')].find((x) => x.textContent.includes(${JSON.stringify(label)}));
  const s = l?.querySelector('input'); if (!s) return null; s.value = ${JSON.stringify(String(value))}; s.dispatchEvent(new Event('input')); s.dispatchEvent(new Event('change')); return Number(s.value); })()`);
const closeSheet = async () => { await tryTap('#sheet .sheet-head button'); await p.sleep(200); };
const imgState = `(() => { const o = editor.canvas.getObjects().find((x) => x.layerName === 'Foto');
  return { filters: o.filters.map((f) => f.type), conv: o.filters.find((f) => f.type === 'Convolute')?.matrix ?? null, adjust: o.filterAdjust ?? null }; })()`;

// ---------- 1. Mesclagem numa forma sobre o fundo ----------
const rectNormal = await pixelOf('Faixa', 0.5, 0.5);
await tapLayer('Faixa');
r.check('toque seleciona a forma', (await p.evaluate(`editor.active?.layerName ?? null`)) === 'Faixa');
const sel = await selectInfo('Mesclagem');
r.check('painel da camada tem "Mesclagem" com os 16 modos (Normal selecionado)', sel !== null && sel.options.length === 16 && sel.value === 'source-over', JSON.stringify(sel));
await setSelect('Mesclagem', 'multiply');
await p.sleep(300);
const gco = await p.evaluate(`editor.canvas.getObjects().find((x) => x.layerName === 'Faixa').globalCompositeOperation`);
const rectMul = await pixelOf('Faixa', 0.5, 0.5);
const expMul = hex(RECT).map((c, i) => Math.round((c * hex(BG)[i]) / 255));
r.check('Multiplicar: camada grava globalCompositeOperation = multiply', gco === 'multiply', String(gco));
r.check('Multiplicar: pixel da página = laranja × verde (≠ Normal)', near(rectNormal, hex(RECT), 3) && near(rectMul, expMul, 4),
  `normal=${rectNormal} multiply=${rectMul} esperado=${expMul}`);
screencap(`${out}/07-1-multiplicar.png`);

// ---------- 2. Duotone da Marca na foto ----------
await p.evaluate('editor.canvas.discardActiveObject(), editor.canvas.requestRenderAll()');
await tapLayer('Foto');
r.check('toque seleciona a foto', (await p.evaluate(`editor.active?.layerName ?? null`)) === 'Foto');
await p.tap('#props button', 'Filtros');
await p.sleep(300);
const sheet = await p.evaluate(`({ sliders: [...document.querySelectorAll('#sheet label.slider > span:first-child')].map((s) => s.textContent),
  duo: [...document.querySelectorAll('#sheet button.duotone-chip')].map((b) => b.textContent) })`);
r.check('folha Filtros tem os sliders Nitidez e Temperatura', sheet.sliders.includes('Nitidez') && sheet.sliders.includes('Temperatura'), JSON.stringify(sheet.sliders));
r.check('folha Filtros tem os chips de Duotone (marca + 3 presets)',
  ['Sem duotone', 'Duotone da Marca', 'Cyberpunk', 'Sépia Ouro', 'Azul Profundo'].every((t) => sheet.duo.includes(t)), JSON.stringify(sheet.duo));
const sharpR = await rangeOf('Nitidez'), warmR = await rangeOf('Temperatura');
r.check('faixas: Nitidez 0..1 passo 0.05; Temperatura −1..1', sharpR?.min === 0 && sharpR?.max === 1 && sharpR?.step === 0.05 && warmR?.min === -1 && warmR?.max === 1,
  JSON.stringify({ sharpR, warmR }));
const brandTapped = await tryTap('#sheet button', 'Duotone da Marca');
await p.sleep(400);
const dark = await pixelOf('Foto', 0.25, 0.5), light = await pixelOf('Foto', 0.75, 0.5);
const st2 = await p.evaluate(imgState);
r.check('Duotone da Marca: metade preta → primária, metade branca → secundária', brandTapped && near(dark, hex(SHADOW), 8) && near(light, hex(HIGHLIGHT), 8),
  `escuro=${dark} claro=${light} filtros=${JSON.stringify(st2.filters)}`);
r.check('Duotone: img.filters tem o ColorMatrix e o chip fica destacado', st2.filters.includes('ColorMatrix')
  && (await p.evaluate(`[...document.querySelectorAll('#sheet button.duotone-chip.primary')].map((b) => b.textContent).join()`)) === 'Duotone da Marca');
screencap(`${out}/07-2-duotone.png`);

// ---------- 3. Nitidez e Temperatura ----------
const hashBefore = await hashOf('Foto');
await setRange('Nitidez', 0.6);
await setRange('Temperatura', 0.8);
await p.sleep(400);
const st3 = await p.evaluate(imgState);
const hashAfter = await hashOf('Foto');
r.check('Nitidez 0.6: img.filters tem Convolute com centro ≈ 3.4', Array.isArray(st3.conv) && Math.abs(st3.conv[4] - 3.4) < 0.01, JSON.stringify(st3));
r.check('Temperatura + Nitidez mudam a página', hashBefore !== hashAfter, `${hashBefore} → ${hashAfter}`);
const a3 = st3.adjust;
r.check('filterAdjust = { sharpen 0.6, warmth 0.8, duotone brand com as cores do kit }', a3 && Math.abs(a3.sharpen - 0.6) < 1e-9 && Math.abs(a3.warmth - 0.8) < 1e-9
  && a3.duotone?.id === 'brand' && a3.duotone.shadow === SHADOW && a3.duotone.highlight === HIGHLIGHT, JSON.stringify(a3));
screencap(`${out}/07-3-nitidez-temperatura.png`);
await closeSheet();

// ---------- 4. Persistência: salvar e reabrir o rascunho ----------
const hashSaved = await hashOf('Foto');
await p.evaluate(`(async () => { const d = JSON.parse(JSON.stringify(editor.toDocument())); await editor.load(d); })()`);
await p.sleep(800);
const gco4 = await p.evaluate(`editor.canvas.getObjects().find((x) => x.layerName === 'Faixa')?.globalCompositeOperation ?? null`);
const rect4 = await pixelOf('Faixa', 0.5, 0.5);
r.check('reaberto: forma continua em Multiplicar, mesmo pixel', gco4 === 'multiply' && near(rect4, rectMul, 2), `${gco4} ${rect4} vs ${rectMul}`);
const st4 = await p.evaluate(imgState);
r.check('reaberto: filtros e filterAdjust da foto voltaram', JSON.stringify(st4.adjust) === JSON.stringify(a3) && st4.filters.includes('Convolute'), JSON.stringify(st4));
r.check('reaberto: página da foto igual à de antes de salvar', (await hashOf('Foto')) === hashSaved);
await tapLayer('Foto');
await p.tap('#props button', 'Filtros');
await p.sleep(300);
const sharp4 = await rangeOf('Nitidez'), warm4 = await rangeOf('Temperatura');
const chip4 = await p.evaluate(`[...document.querySelectorAll('#sheet button.duotone-chip.primary')].map((b) => b.textContent).join()`);
r.check('reaberto: folha mostra Nitidez 0.60, Temperatura 0.80 e "Duotone da Marca" destacado',
  sharp4?.value === 0.6 && sharp4.shown === '0.60' && warm4?.value === 0.8 && warm4.shown === '0.80' && chip4 === 'Duotone da Marca', JSON.stringify({ sharp4, warm4, chip4 }));
screencap(`${out}/07-4-reaberto.png`);

// ---------- 5. Zerar ajustes limpa os novos ajustes ----------
await tryTap('#sheet button', 'Zerar ajustes');
await p.sleep(300);
const st5 = await p.evaluate(imgState);
r.check('Zerar ajustes remove nitidez/temperatura/duotone', st5.adjust === null && !st5.filters.includes('Convolute') && !st5.filters.includes('ColorMatrix'), JSON.stringify(st5));
await closeSheet();

r.check('sem exceções JS no console', !p.logs.some((l) => l.startsWith('EXCEPTION')), p.logs.filter((l) => l.startsWith('EXCEPTION')).join(' | '));
r.done();
p.close();
