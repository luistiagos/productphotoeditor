// E2E TASK-15 (Preencher texto com foto) no app real.
// Uso: ANDROID_SERIAL=<serial> node tools/e2e/task15.mjs <pasta-de-prints>
//      E2E_MODE=base → controle positivo no APK da base: confere que o botão "🖼️ Foto no texto" e o
//      `editor.setTextImageFill` NÃO existem e para (PASS = funcionalidade ausente).
// Toques reais nos botões, no seletor de fotos do Android (uiautomator) e na alça lateral do texto; o estado é lido
// pelo `window.editor`. A foto é um JPG de listras gerado aqui (cores inequívocas no pixel) e posto na galeria.
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { adbShell, connect, launchEditor, reporter, screencap, uiTap } from './cdp.mjs';

const PKG = 'com.productphoto.offline';
const out = process.argv[2] ?? '.';
mkdirSync(out, { recursive: true });
const BASE = process.env.E2E_MODE === 'base';
const NAME = `E2E15_${Date.now().toString(36)}`;
const PHOTO = '/sdcard/Pictures/e2e_task15.jpg';
const adbEnv = { ...process.env, MSYS_NO_PATHCONV: '1' };
const adbRaw = (...args) => execFileSync('adb', args, { env: adbEnv, maxBuffer: 64 << 20 });

/** Toque estável (modelo task09): espera a caixa do elemento parar de mexer antes de tocar. */
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

let p = stableTaps(await launchEditor());
const r = reporter(`TASK-15 — preencher texto com foto${BASE ? ' (BASE: controle positivo)' : ''} (${NAME})`);

const idle = () => p.waitFor(`!document.getElementById('busy').classList.contains('show')`, 60000).catch(() => {});
const sheetOpen = (title) => p.waitFor(`document.getElementById('sheet').classList.contains('show')
  && (document.querySelector('#sheet .sheet-head strong')?.textContent ?? '').includes(${JSON.stringify(title)})`, 8000);
const sheetClosed = () => p.waitFor(`!document.getElementById('sheet').classList.contains('show')`, 8000);
const closeSheet = async () => { await p.tap('#sheet .sheet-head button'); await sheetClosed(); await p.sleep(200); };
const attempt = async (label, step, done) => {
  for (let i = 1; i <= 3; i++) {
    try { await step(); } catch (e) { console.log(`${label}: tentativa ${i} — ${e.message}`); }
    if (await p.waitFor(done, 8000).then(() => true, () => false)) return true;
    console.log(`${label}: tentativa ${i} não aplicou`);
    if (await p.evaluate(`document.getElementById('sheet').classList.contains('show')`)) await closeSheet().catch(() => {});
    await p.sleep(800);
  }
  return false;
};
const setRange = (root, label, value) => p.evaluate(`(() => {
  const l = [...document.querySelectorAll('${root} label.slider')].find((x) => x.textContent.includes(${JSON.stringify(label)}));
  const s = l.querySelector('input'); s.value = ${JSON.stringify(String(value))}; s.dispatchEvent(new Event('input'));
  s.dispatchEvent(new Event('change')); return Number(s.value); })()`);
const pickFirstPhoto = async (shot) => {
  for (let i = 0; i < 20; i++) {
    await p.sleep(700);
    try { adbShell('uiautomator dump /data/local/tmp/ui.xml'); } catch { continue; }
    const xml = adbShell('cat /data/local/tmp/ui.xml');
    const m = /content-desc="(Photo taken|Foto tirada)[^"]*"[^>]*bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/.exec(xml);
    if (m) {
      screencap(shot);
      adbShell(`input tap ${(Number(m[2]) + Number(m[4])) >> 1} ${(Number(m[3]) + Number(m[5])) >> 1}`);
      return true;
    }
  }
  return false;
};

/** O texto do teste (por conteúdo: o undo e o reabrir trocam as instâncias). */
const T = (text) => `editor.canvas.getObjects().find((o) => o.type === 'textbox' && o.text === ${JSON.stringify(text)})`;
const selectText = (text) => p.evaluate(`(() => { const t = ${T(text)}; editor.canvas.setActiveObject(t); editor.onSelection(t); return Boolean(t); })()`);
const info = (text) => p.evaluate(`(() => { const t = ${T(text)}; if (!t) return null; const f = t.fill; const isP = typeof f === 'object' && f !== null && 'patternTransform' in f;
  const src = isP ? f.source : null;
  return { w: t.width, h: t.height, fill: typeof f === 'string' ? f : null, isPattern: isP, json: t.toObject().fill?.type ?? null, mark: t.textImageFill ?? null,
    mine: Boolean(editor.textImageFillOf(t)), tr: isP ? f.patternTransform : null, repeat: isP ? f.repeat : null,
    iw: src ? (src.naturalWidth || src.width) : 0, ih: src ? (src.naturalHeight || src.height) : 0, src: src?.src ?? null }; })()`);
/** (c) os 4 cantos da caixa, pela inversa do patternTransform, caem dentro da foto. */
const covers = (i) => {
  if (!i?.tr) return false;
  const [a, , , d, e, f] = i.tr;
  return [[0, 0], [i.w, 0], [0, i.h], [i.w, i.h]].every(([x, y]) => {
    const u = (x - e) / a, v = (y - f) / d;
    return u >= -0.5 && u <= i.iw + 0.5 && v >= -0.5 && v <= i.ih + 0.5;
  });
};
/**
 * Pontos DENTRO das letras (alfa 255 no render só do texto, sem fundo) numa grade da caixa e a cor de cada um no render
 * da página inteira. Coordenadas do documento (o export 1× tem o mesmo tamanho).
 */
const letterPixels = (text) => p.evaluate(`(() => {
  const t = ${T(text)}; t.setCoords(); const b = t.getBoundingRect();
  const only = editor.renderPageCanvas(1080, (o) => o === t); const ox = only.canvas.getContext('2d');
  const full = editor.renderPageCanvas(1080); const fx = full.canvas.getContext('2d');
  const pts = [];
  for (let i = 1; i < 40; i++) for (let j = 1; j < 12; j++) {
    const x = Math.round(b.left + (b.width * i) / 40), y = Math.round(b.top + (b.height * j) / 12);
    const a = ox.getImageData(Math.round(x * only.scale), Math.round(y * only.scale), 1, 1).data[3];
    if (a === 255) pts.push({ x, y, c: [...fx.getImageData(Math.round(x * full.scale), Math.round(y * full.scale), 1, 1).data].slice(0, 3) });
  }
  return pts; })()`);
const hex3 = (h) => [1, 3, 5].map((k) => parseInt(h.slice(k, k + 2), 16));
const dist = (a, b) => Math.max(...a.map((v, k) => Math.abs(v - b[k])));
const distinct = (pts) => new Set(pts.map((q) => q.c.map((v) => v >> 5).join(','))).size;
/** Decodifica uma imagem (dataURL) no WebView e lê a cor nos pontos (x,y) × escala, deslocados por (dx,dy). */
const sampleImage = (dataUrl, pts, { scale = 1, dx = 0, dy = 0 } = {}) => p.evaluate(`(async () => {
  const img = new Image(); img.src = ${JSON.stringify(dataUrl)}; await img.decode();
  const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight;
  const x = c.getContext('2d'); x.drawImage(img, 0, 0);
  return { w: c.width, h: c.height, colors: ${JSON.stringify(pts.map((q) => [q.x, q.y]))}.map(([u, v]) =>
    [...x.getImageData(Math.round(u * ${scale} - ${dx}), Math.round(v * ${scale} - ${dy}), 1, 1).data].slice(0, 3)) }; })()`);

// ---------- 0. a foto de listras na galeria ----------
const jpg = await p.evaluate(`(() => { const c = document.createElement('canvas'); c.width = 1200; c.height = 800; const x = c.getContext('2d');
  ['#ff0000', '#ff9900', '#ffff00', '#00cc00', '#0000ff', '#cc00cc'].forEach((col, i) => { x.fillStyle = col; x.fillRect(i * 200, 0, 200, 800); });
  return c.toDataURL('image/jpeg', 0.95); })()`);
const local = `${out}/e2e_task15.jpg`;
writeFileSync(local, Buffer.from(jpg.split(',')[1], 'base64'));
adbRaw('push', local, PHOTO);
adbShell(`am broadcast -a android.intent.action.MEDIA_SCANNER_SCAN_FILE -d file://${PHOTO}`);

// ---------- 1. texto "VERÃO" grande, pela UI ----------
await p.tap('#tabs button', 'Texto');
await sheetOpen('Texto');
await p.tap('#sheet button', 'Adicionar título');
await sheetClosed();
await p.sleep(400);
const edit = (next) => attempt(`editar para "${next}"`, async () => {
  await p.tap('#props button', '✏️ Editar texto');
  await sheetOpen('Editar texto');
  await p.waitFor(`Boolean(document.querySelector('#sheet textarea'))`, 8000);
  await p.evaluate(`(() => { document.querySelector('#sheet textarea').value = ${JSON.stringify(next)}; return true; })()`);
  await p.tap('#sheet button', 'Aplicar');
  await sheetClosed();
  await p.sleep(600);
}, `!document.getElementById('sheet').classList.contains('show') && Boolean(${T(next)})`);
r.check('1. Texto → Adicionar título → ✏️ Editar texto: "VERÃO"', await edit('VERÃO'));
await selectText('VERÃO');
await setRange('#props', 'Tamanho', 260);
await p.sleep(300);
const solid = (await info('VERÃO')).fill;
screencap(`${out}/15-1-texto.png`);

if (BASE) {
  const absent = await p.evaluate(`({ btn: document.querySelector('#props .text-photo-btn') === null, api: typeof editor.setTextImageFill === 'undefined' })`);
  r.check('BASE: o painel do texto NÃO tem "🖼️ Foto no texto"', absent.btn);
  r.check('BASE: editor.setTextImageFill não existe (funcionalidade ausente)', absent.api);
  r.done();
  p.close();
  process.exit();
}

// ---------- 2. 🖼️ Foto no texto → galeria ----------
const applyPhoto = async (text, shot) => {
  await selectText(text);
  await p.tap('#props .text-photo-btn');
  const picked = await pickFirstPhoto(shot);
  await idle();
  await p.waitFor(`Boolean(editor.textImageFillOf(${T(text)}))`, 20000).catch(() => {});
  await p.sleep(500);
  return picked;
};
r.check('2. o painel do texto tem "🖼️ Foto no texto"', await p.evaluate(`Boolean(document.querySelector('#props .text-photo-btn'))`));
const picked = await applyPhoto('VERÃO', `${out}/15-2-seletor.png`);
let i1 = await info('VERÃO');
r.check('2a. seletor do Android → fill é Pattern (JSON type "pattern"), marca com a URL /blob/… e a cor anterior',
  picked && i1.isPattern && i1.json === 'pattern' && i1.mine && /\/blob\//.test(i1.mark?.src ?? '') && i1.mark.fallback === solid && i1.repeat === 'no-repeat',
  JSON.stringify({ picked, ...i1, solid }));
console.log(`foto escolhida: ${i1.iw}×${i1.ih} (listras do teste = 1200×800)`);
let px1 = await letterPixels('VERÃO');
const solidRgb = hex3(solid);
r.check('2b. render: pixels dentro das letras ≠ a cor sólida anterior e com várias cores (a foto)',
  px1.length >= 3 && px1.every((q) => dist(q.c, solidRgb) > 40) && distinct(px1) >= 2, JSON.stringify({ n: px1.length, distinct: distinct(px1), amostra: px1.slice(0, 4) }));
r.check('2c. cover: os 4 cantos da caixa caem dentro da foto', covers(i1), JSON.stringify({ tr: i1.tr, w: i1.w, h: i1.h, iw: i1.iw, ih: i1.ih }));
r.check('2. "Remover foto" aparece com a foto aplicada', await p.evaluate(`Boolean(document.querySelector('#props .text-photo-remove'))`));
screencap(`${out}/15-2-foto-no-texto.png`);

// ---------- 3. ↶ uma vez desfaz a aplicação ----------
await p.sleep(500); // debounce do instantâneo do histórico
await p.tap('#topbar button', '↶');
await p.sleep(900);
let iu = await info('VERÃO');
r.check('3. ↶ (1 toque) → o texto volta à cor sólida, sem a marca', iu && iu.fill === solid && !iu.isPattern && !iu.mark, JSON.stringify(iu));
screencap(`${out}/15-3-desfeito.png`);
await applyPhoto('VERÃO', `${out}/15-3-seletor.png`);
r.check('3. reaplicar pela UI', (await info('VERÃO')).mine);

// ---------- 4. editar o texto e arrastar a alça lateral: o cover acompanha ----------
const before = await info('VERÃO');
r.check('4. ✏️ Editar texto → "VERÃO 50%"', await edit('VERÃO 50%'));
await selectText('VERÃO 50%');
let i4 = await info('VERÃO 50%');
r.check('4d. texto editado: continua Pattern e o cover cobre a caixa nova', i4.mine && covers(i4), JSON.stringify({ before: [before.w, before.h, before.tr], after: [i4.w, i4.h, i4.tr] }));
const handle = await p.evaluate(`(() => { const t = editor.active; t.setCoords(); const c = t.oCoords.mr; const r = editor.canvas.upperCanvasEl.getBoundingClientRect();
  return { x: r.left + c.x, y: r.top + c.y }; })()`);
const w0 = i4.w, tr0 = JSON.stringify(i4.tr);
await p.drag(handle.x, handle.y, handle.x - 120, handle.y, { steps: 14 });
await p.sleep(500);
i4 = await info('VERÃO 50%');
r.check('4d. alça lateral arrastada: largura mudou, patternTransform refeito e ainda cobre', i4.w !== w0 && JSON.stringify(i4.tr) !== tr0 && covers(i4) && i4.mine,
  JSON.stringify({ w0, w: i4.w, h: i4.h, tr0, tr: i4.tr }));
screencap(`${out}/15-4-editado-redimensionado.png`);

// ---------- 5. Remover foto ----------
await selectText('VERÃO 50%');
await p.tap('#props .text-photo-remove');
await idle();
await p.sleep(400);
const i5 = await info('VERÃO 50%');
r.check('5f. "Remover foto" → fill = a cor sólida anterior, sem a marca', i5.fill === solid && !i5.mark && !i5.isPattern, JSON.stringify(i5));
r.check('5f. o botão "Remover foto" some', await p.evaluate(`document.querySelector('#props .text-photo-remove') === null`));
screencap(`${out}/15-5-removida.png`);
await applyPhoto('VERÃO 50%', `${out}/15-5-seletor.png`);
const applied = await info('VERÃO 50%');
const pxApplied = await letterPixels('VERÃO 50%');
r.check('5. reaplicada', applied.mine && pxApplied.length >= 3);

// ---------- 6. renomear, salvar, matar o app e reabrir o rascunho ----------
r.check('6. renomear o design', await attempt('renomear', async () => {
  await p.tap('#topbar button.title');
  await sheetOpen('Nome do design');
  await p.waitFor(`Boolean(document.querySelector('#sheet input.name'))`, 8000);
  await p.evaluate(`(() => { document.querySelector('#sheet input.name').value = ${JSON.stringify(NAME)}; return true; })()`);
  await p.tap('#sheet button', 'Salvar');
  await sheetClosed();
}, `editor.name === ${JSON.stringify(NAME)} && !document.getElementById('sheet').classList.contains('show')`));
await p.tap('#topbar button', 'Salvar');
await p.sleep(1500);
p.close();
adbShell(`am force-stop ${PKG}`);
adbShell(`am start -n ${PKG}/com.productphoto.app.MainActivity`);
await uiTap('Rascunhos');
await new Promise((res) => setTimeout(res, 1500));
await uiTap(NAME);
p = stableTaps(await connect());
await p.waitFor(`document.body.dataset.ready === 'true'`, 20000);
await p.waitFor(`Boolean(${T('VERÃO 50%')}) && editor.textImageFillOf(${T('VERÃO 50%')}) && ${T('VERÃO 50%')}.fill.source.complete`, 15000).catch(() => {});
await p.sleep(800);
const i6 = await info('VERÃO 50%');
const px6 = await letterPixels('VERÃO 50%');
const samePx = (a, b, tol) => a.length === b.length && a.length > 0 && a.every((q, k) => q.x === b[k].x && q.y === b[k].y && dist(q.c, b[k].c) <= tol);
r.check('6g. reaberto pelo Rascunhos: fill Pattern de novo, mesmo patternTransform e a marca', i6?.mine && JSON.stringify(i6.tr) === JSON.stringify(applied.tr)
  && i6.mark?.src === applied.mark.src, JSON.stringify({ applied: applied.tr, reopened: i6?.tr }));
r.check('6g. pixels das letras iguais aos de antes de salvar', samePx(px6, pxApplied, 6), JSON.stringify({ n: [pxApplied.length, px6.length], a: pxApplied.slice(0, 3), b: px6.slice(0, 3) }));
screencap(`${out}/15-6-reaberto.png`);

// ---------- 7. exportar PNG e JPG (Salvar na galeria) ----------
const exportTo = async (format) => {
  await p.evaluate('editor.canvas.discardActiveObject()');
  await p.tap('#topbar button', 'Exportar');
  await sheetOpen('Exportar');
  await p.evaluate(`(() => { const l = [...document.querySelectorAll('#sheet label')].find((x) => x.querySelector('select') && x.textContent.includes('Formato'));
    const s = l.querySelector('select'); s.value = ${JSON.stringify(format)}; s.dispatchEvent(new Event('change')); return s.value; })()`);
  await p.tap('#sheet button', 'Salvar na galeria');
  await sheetClosed().catch(() => {});
  await p.waitFor(`document.getElementById('busy').classList.contains('show')`, 5000).catch(() => {});
  await idle();
  await p.sleep(1500);
  const rows = adbShell(`content query --uri content://media/external/images/media --projection _display_name:_data --where "_display_name LIKE '${NAME}%.${format}'"`);
  const m = /_data=(\S+)/.exec(rows);
  if (!m) return { file: null, rows };
  const buf = adbRaw('exec-out', 'cat', m[1]);
  writeFileSync(`${out}/15-7-export.${format}`, buf);
  return { file: m[1], dataUrl: `data:image/${format === 'jpg' ? 'jpeg' : 'png'};base64,${buf.toString('base64')}` };
};
for (const [format, tol] of [['png', 12], ['jpg', 48]]) {
  const e = await exportTo(format);
  if (!e.file) { r.check(`7h. ${format.toUpperCase()} gravado na galeria`, false, e.rows); continue; }
  const s = await sampleImage(e.dataUrl, px6);
  const ok = s.w === 1080 && s.colors.every((c, k) => dist(c, solidRgb) > 40 && dist(c, px6[k].c) <= tol);
  r.check(`7h. ${format.toUpperCase()} (${e.file}): pixels das letras = os do editor (a foto), ≠ cor sólida`, ok,
    JSON.stringify({ w: s.w, h: s.h, amostra: s.colors.slice(0, 3), editor: px6.slice(0, 3).map((q) => q.c) }));
}
try {
  adbShell(`content delete --uri content://media/external/images/media --where "_display_name LIKE '${NAME}%'"`);
  console.log('exports de teste apagados');
} catch (e) { console.log(`limpeza falhou: ${e.message}`); }

// ---------- 8. SVG (o que o botão chama) ----------
const svg = await p.evaluate('editor.exportSvg()');
writeFileSync(`${out}/15-8-export.svg`, svg);
const pat = /<pattern id="(SVGID_[^"]+)" patternUnits="userSpaceOnUse"[^>]*>\s*<image [^>]*transform="matrix\([^)]+\)"[^>]*xlink:href="data:image\//.exec(svg);
r.check('8i. SVG: <pattern> em userSpaceOnUse com a foto inline (dataURL) e matrix(...) do cover', Boolean(pat));
r.check('8i. SVG: o texto usa fill: url(#SVGID_…) do padrão', Boolean(pat) && svg.includes(`fill: url(#${pat[1]})`));
const svgPx = await sampleImage(`data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`, px6);
const svgOk = svgPx.colors.filter((c, k) => dist(c, px6[k].c) <= 60).length;
r.check('8i. SVG desenhado no WebView: ≥ 80% dos pixels das letras iguais ao editor (mesmo recorte da foto)', svgOk >= 0.8 * px6.length,
  JSON.stringify({ iguais: svgOk, de: px6.length, amostra: svgPx.colors.slice(0, 3), editor: px6.slice(0, 3).map((q) => q.c) }));

// ---------- 9. vídeo: a camada do texto no pacote do FFmpeg ----------
// o pacote não traz a lista de camadas: `layer_<i>.png` é o objeto i recortado na caixa dele (+ margem 2, sem sombra)
const vid = await p.evaluate(`(async () => { const t = ${T('VERÃO 50%')}; const idx = editor.canvas.getObjects().indexOf(t);
  t.setCoords(); const bb = t.getBoundingRect(); const sh = t.shadow; const m = 2 + (sh ? sh.blur + Math.max(Math.abs(sh.offsetX), Math.abs(sh.offsetY)) : 0);
  const b = await editor.exportVideoBundle('mp4'); const unit = b.width / editor.width;
  return { idx, unit, file: b.files['layer_' + idx + '.png'] ?? null, dx: (bb.left - m) * unit, dy: (bb.top - m) * unit, output: b.output }; })()`);
if (vid.file) {
  const s = await sampleImage(vid.file, px6, { scale: vid.unit, dx: vid.dx, dy: vid.dy });
  const close = s.colors.filter((c, k) => dist(c, solidRgb) > 40 && dist(c, px6[k].c) <= 24).length;
  r.check('9j. MP4: o PNG da camada do texto (layer_N.png do pacote do FFmpeg) tem a foto nas letras', close >= 0.8 * px6.length,
    JSON.stringify({ idx: vid.idx, unit: vid.unit, dx: vid.dx, dy: vid.dy, output: vid.output, iguais: close, de: px6.length }));
} else r.check('9j. MP4: pacote do vídeo tem a camada do texto', false, JSON.stringify({ idx: vid.idx }));
screencap(`${out}/15-9-final.png`);

r.check('sem exceções JS no console', !p.logs.some((l) => l.startsWith('EXCEPTION')), p.logs.filter((l) => l.startsWith('EXCEPTION')).join(' | '));
console.log(`rascunho de teste: "${NAME}" (apague pelo Rascunhos)`);
r.done();
p.close();
