// E2E TASK-09 (páginas do carrossel, ✨ Magic Resize, estilo de fundo, exportar todas as páginas) no app real.
// Uso: ANDROID_SERIAL=<serial> node tools/e2e/task09.mjs <pasta-de-prints>   (moto: E2E_FORMAT="Post Instagram")
// Toques reais nos botões da faixa de páginas e das folhas; o estado é lido pelo `window.editor`. Na base (sem a TASK-09)
// o caso 1 falha e o script para: é a prova da ausência.
import { adbShell, connect, launchEditor, reporter, screencap, uiTap } from './cdp.mjs';

const PKG = 'com.productphoto.offline';
const out = process.argv[2] ?? '.';
const NAME = `E2E09_${Date.now().toString(36)}`;
let p = await launchEditor();
const r = reporter(`TASK-09 — páginas, Magic Resize, estilo de fundo, exportar todas (${NAME})`);

const idle = () => p.waitFor(`!document.getElementById('busy').classList.contains('show')`, 30000).catch(() => {});
const closeSheet = async () => { await p.tap('#sheet .sheet-head button'); await p.sleep(200); };
const waitPages = (expr, ms = 15000) => p.waitFor(expr, ms).then(() => true, () => false);
const state = () => p.evaluate(`(() => {
  const d = editor.toDocument();
  const pages = d.pages ?? [{ id: '-', width: d.width, height: d.height, fabric: d.fabric }];
  const texts = (f) => f.objects.filter((o) => typeof o.text === 'string').map((o) => o.text);
  const bg = (f) => { const o = f.objects.find((x) => x.layerName === 'background'); return o ? { w: o.width, h: o.height, sx: o.scaleX, spec: o.customGradient ?? null, type: o.type } : null; };
  return { n: editor.getPageCount(), active: editor.getActivePageIndex(), ids: pages.map((x) => x.id), sizes: pages.map((x) => [x.width, x.height]),
    counts: pages.map((x) => x.fabric.objects.length), texts: pages.map((x) => texts(x.fabric)), bgs: pages.map((x) => bg(x.fabric)),
    images: pages.map((x) => x.fabric.objects.filter((o) => o.type === 'Image' && o.layerName !== 'background').length),
    label: document.querySelector('#pages .pg-label')?.textContent ?? null, W: editor.width, H: editor.height };
})()`);
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
/** Edita o texto pela UI: Camadas → o texto → ✏️ Editar texto → Aplicar. */
const editText = async (current, next) => {
  await p.tap('#topbar button', 'Camadas');
  await p.tap('#sheet .layer button.grow', current);
  await p.tap('#props button', '✏️ Editar texto');
  await p.evaluate(`(() => { const f = document.querySelector('#sheet textarea'); f.value = ${JSON.stringify(next)}; return true; })()`);
  await p.tap('#sheet button', 'Aplicar');
  await p.sleep(400);
};
/** Geometria da página no canvas: caixa de cada objeto (plano da cena) e papéis óbvios. */
const geometry = () => p.evaluate(`(() => {
  const W = editor.width, H = editor.height;
  const all = editor.canvas.getObjects().map((o) => { o.setCoords(); const b = o.getBoundingRect();
    return { type: o.type, bg: o.layerName === 'background', text: o.text ?? null, fs: o.fontSize ? o.fontSize * o.scaleY : 0, img: o.type === 'image',
      l: b.left, t: b.top, r: b.left + b.width, b: b.top + b.height, cx: b.left + b.width / 2, cy: b.top + b.height / 2, area: b.width * b.height }; });
  const content = all.filter((o) => !o.bg);
  const product = content.filter((o) => o.img).sort((a, b) => b.area - a.area)[0] ?? null;
  const texts = content.filter((o) => o.text !== null).sort((a, b) => b.fs - a.fs);
  const bg = all.find((o) => o.bg) ?? null;
  return { W, H, product, title: texts[0] ?? null, others: texts.slice(1), content, bg };
})()`);
const inside = (o, W, H) => o.l >= -1 && o.t >= -1 && o.r <= W + 1 && o.b <= H + 1;

// ---------- montagem pela UI ----------
await p.tap('#tabs button', 'Texto');
await p.tap('#sheet button', 'Adicionar título');
await p.tap('#tabs button', 'Texto');
await p.tap('#sheet button', 'Adicionar texto');
await editText('Toque e segure', 'R$ 99,90');
await p.tap('#tabs button', 'Imagem');
await p.tap('#sheet button', 'Escolher da galeria…');
const picked = await pickFirstPhoto(`${out}/09-0-seletor.png`);
await idle();
await p.waitFor(`editor.canvas.getObjects().some((o) => o.type === 'Image')`, 20000).catch(() => {});
const preset = await p.evaluate(`content.backgrounds.find((b) => b.kind === 'linear')`);
await p.tap('#tabs button', 'Fundo');
await p.tap(`#sheet .tile.swatch[title="${preset.name}"]`);
await p.sleep(500);
await p.tap('#topbar button.title');
await p.evaluate(`(() => { const i = document.querySelector('#sheet input.name'); i.value = ${JSON.stringify(NAME)}; return true; })()`);
await p.tap('#sheet button', 'Salvar');
await p.sleep(600);
let s = await state();
r.check('montagem: título, preço, foto da galeria e degradê de preset', picked && s.texts[0].includes('Título') && s.texts[0].includes('R$ 99,90')
  && s.images[0] === 1 && JSON.stringify(s.bgs[0]?.spec?.stops?.map((x) => x.color)) === JSON.stringify(preset.colors), JSON.stringify({ picked, s }));
screencap(`${out}/09-0-montado.png`);

// ---------- 1. faixa + duplicar ----------
const hasStrip = await p.evaluate(`Boolean(document.querySelector('#pages .pg-label')) && typeof editor.getPageCount === 'function'`);
r.check('1. a faixa de páginas existe e mostra "Página 1/1"', hasStrip && s.label?.includes('Página 1/1'), String(s.label));
if (!hasStrip) {
  r.check('controle: sem TASK-09 não há faixa de páginas nem editor.getPageCount', false, 'base — funcionalidade ausente');
  r.done();
  p.close();
  process.exit();
}
await p.tap('#pages .pg-dup');
await waitPages('editor.getPageCount() === 2');
s = await state();
r.check('1. ⧉ Duplicar → 2 páginas, a ativa é a 2ª, com os mesmos objetos e textos', s.n === 2 && s.active === 1 && s.counts[0] === s.counts[1]
  && JSON.stringify(s.texts[0]) === JSON.stringify(s.texts[1]) && s.label.includes('Página 2/2'), JSON.stringify(s));
screencap(`${out}/09-1-duplicada.png`);

// ---------- 2. nova em branco ----------
await p.tap('#pages .pg-add');
await waitPages('editor.getPageCount() === 3');
s = await state();
r.check('2. ＋ Nova → 3 páginas; a nova (3ª) não tem camadas, mas herda o degradê do fundo', s.n === 3 && s.active === 2 && s.counts[2] === 1
  && JSON.stringify(s.bgs[2]?.spec) === JSON.stringify(s.bgs[1]?.spec) && s.texts[2].length === 0, JSON.stringify(s));
screencap(`${out}/09-2-nova.png`);

// ---------- 3. editar na 2ª, ir e voltar; undo cruzado ----------
await p.tap('#pages .pg-prev');
await waitPages('editor.getActivePageIndex() === 1');
await editText('Título', 'Slide 2');
await p.tap('#pages .pg-prev');
await waitPages('editor.getActivePageIndex() === 0');
s = await state();
r.check('3. ◀ para a 1ª: o título dela está inalterado', s.active === 0 && s.texts[0].includes('Título') && s.texts[1].includes('Slide 2'), JSON.stringify(s.texts));
await p.tap('#pages .pg-next');
await waitPages('editor.getActivePageIndex() === 1');
s = await state();
r.check('3. ▶ de volta à 2ª: a edição está lá (no canvas)', s.active === 1
  && (await p.evaluate(`editor.canvas.getObjects().some((o) => o.text === 'Slide 2')`)), JSON.stringify(s.texts));
await p.tap('#pages .pg-prev');
await waitPages('editor.getActivePageIndex() === 0');
await p.tap('#topbar button', '↶');
await waitPages('editor.getActivePageIndex() === 1');
s = await state();
r.check('undo cruzado: na 1ª, ↶ volta à 2ª com a edição desfeita', s.active === 1 && !s.texts[1].includes('Slide 2') && s.texts[1].includes('Título'), JSON.stringify({ a: s.active, t: s.texts }));
await p.tap('#topbar button', '↷');
// o ↷ volta ao instantâneo seguinte, que lembra a página em que o usuário estava (a 1ª): a edição está na 2ª
await waitPages(`(editor.toDocument().pages ?? [])[1]?.fabric.objects.some((o) => o.text === 'Slide 2')`);
s = await state();
r.check('…e ↷ refaz a edição na 2ª', s.texts[1].includes('Slide 2'), JSON.stringify({ a: s.active, t: s.texts }));

// ---------- 4. reordenar: a 3ª vai para o início ----------
const before = await state();
await p.tap('#pages .pg-label');
await p.tap('#sheet .pg-tile[data-index="2"] .pg-move-first');
await p.sleep(400);
screencap(`${out}/09-4-paginas.png`);
await closeSheet();
s = await state();
const activeId = before.ids[before.active];
r.check('4. ⇤ na 3ª → a ordem dos ids mudou e a ativa continua a mesma página', JSON.stringify(s.ids) === JSON.stringify([before.ids[2], before.ids[0], before.ids[1]])
  && s.ids[s.active] === activeId, JSON.stringify({ before: before.ids, after: s.ids, active: s.active }));

// ---------- 5. excluir; desabilitado com 1 página; undo ----------
await p.tap('#pages .pg-del');
await p.tap('#sheet button', 'Excluir');
await waitPages('editor.getPageCount() === 2');
s = await state();
r.check('5. 🗑️ → 2 páginas', s.n === 2, JSON.stringify(s.ids));
await p.tap('#pages .pg-del');
await p.tap('#sheet button', 'Excluir');
await waitPages('editor.getPageCount() === 1');
s = await state();
const delDisabled = await p.evaluate(`document.querySelector('#pages .pg-del').disabled`);
r.check('5. com 1 página o 🗑️ fica desabilitado', s.n === 1 && delDisabled === true, JSON.stringify({ n: s.n, delDisabled }));
await p.tap('#topbar button', '↶');
await waitPages('editor.getPageCount() === 2');
await p.tap('#topbar button', '↶');
await waitPages('editor.getPageCount() === 3');
s = await state();
r.check('5. ↶ ↶ devolve as 3 páginas, na ordem de antes da exclusão', s.n === 3 && JSON.stringify(s.ids) === JSON.stringify([before.ids[2], before.ids[0], before.ids[1]]), JSON.stringify(s.ids));

// ---------- 6. persistência: salvar, matar o app, abrir o rascunho ----------
await p.tap('#topbar button', 'Salvar');
await p.sleep(1500);
const saved = await state();
p.close();
adbShell(`am force-stop ${PKG}`);
adbShell(`am start -n ${PKG}/com.productphoto.app.MainActivity`);
await uiTap('Rascunhos');
await new Promise((res) => setTimeout(res, 1500));
await uiTap(NAME);
p = await connect();
await p.waitFor(`document.body.dataset.ready === 'true'`, 20000);
await p.sleep(800);
s = await state();
r.check('6. reaberto pelo Rascunhos: mesmas páginas (ids, tamanhos, textos) e a mesma ativa', s.n === saved.n && JSON.stringify(s.ids) === JSON.stringify(saved.ids)
  && JSON.stringify(s.texts) === JSON.stringify(saved.texts) && s.active === saved.active && s.texts.some((t) => t.includes('Slide 2')), JSON.stringify({ saved: saved.texts, s: s.texts }));
screencap(`${out}/09-6-reaberto.png`);

// ---------- 7. ✨ Magic Resize a partir da 1ª página com a foto ----------
const src = s.images.findIndex((n, i) => n > 0 && !s.texts[i].includes('Slide 2'));
while ((await state()).active > src) { await p.tap('#pages .pg-prev'); await p.sleep(700); }
while ((await state()).active < src) { await p.tap('#pages .pg-next'); await p.sleep(700); }
const n0 = (await state()).n;
await p.tap('#tabs button', 'Tamanho');
await p.tap('#sheet .magic-resize-btn');
for (const id of ['story', 'banner', 'li_square']) await p.tap(`#sheet .magic-format[data-format="${id}"]`);
const goText = await p.evaluate(`document.querySelector('#sheet .magic-go').textContent`);
screencap(`${out}/09-7-magic-resize.png`);
await p.tap('#sheet .magic-go');
await idle();
await waitPages(`editor.getPageCount() === ${n0 + 3}`, 30000);
s = await state();
r.check('7. "Gerar 3 formatos como páginas" → +3 páginas com 1080×1920, 1920×1080 e 1200×1200', goText.includes('Gerar 3 formatos') && s.n === n0 + 3
  && JSON.stringify(s.sizes.slice(-3)) === JSON.stringify([[1080, 1920], [1920, 1080], [1200, 1200]]) && s.active === n0, JSON.stringify({ goText, sizes: s.sizes, active: s.active }));
for (let k = 0; k < 3; k++) {
  if (k > 0) { await p.tap('#pages .pg-next'); await waitPages(`editor.getActivePageIndex() === ${n0 + k}`); await p.sleep(500); }
  const g = await geometry();
  const allIn = g.content.every((o) => inside(o, g.W, g.H));
  const cover = g.bg && g.bg.l <= 1 && g.bg.t <= 1 && g.bg.r >= g.W - 1 && g.bg.b >= g.H - 1;
  r.check(`7. ${g.W}×${g.H}: nenhum objeto sai da página e o fundo a cobre`, allIn && cover, JSON.stringify({ out: g.content.filter((o) => !inside(o, g.W, g.H)), bg: g.bg }));
  if (k === 0) {
    r.check('7. 9:16: o centro da foto no terço do meio e o título acima dela', g.product && g.product.cy > g.H / 3 && g.product.cy < (2 * g.H) / 3
      && g.title && g.title.b <= g.product.t + 1, JSON.stringify({ product: g.product, title: g.title }));
  } else if (k === 1) {
    r.check('7. 16:9: o centro da foto em x < W/2 e os textos em x > W/2', g.product && g.product.cx < g.W / 2
      && [g.title, ...g.others].every((t) => t && t.cx > g.W / 2), JSON.stringify({ product: g.product, texts: [g.title, ...g.others] }));
  }
  screencap(`${out}/09-7-${g.W}x${g.H}.png`);
}

// ---------- 8. ✨ Extrair fundo da foto do produto (na página de origem) ----------
while ((await state()).active > src) { await p.tap('#pages .pg-prev'); await p.sleep(700); }
const bgBefore = (await state()).bgs[src]?.spec;
await p.tap('#tabs button', 'Fundo');
await p.tap('#sheet .bg-extract-btn');
await p.sleep(800);
s = await state();
const extracted = s.bgs[src]?.spec;
const contrast = await p.evaluate(`(() => {
  const lum = (c) => { const f = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]); };
  const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  return editor.textLayers().map((t) => {
    const { canvas, scale } = editor.renderPageCanvas(512, (o) => o !== t); const x = canvas.getContext('2d'); t.setCoords(); const b = t.getBoundingRect();
    const px = []; for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) {
      const d = x.getImageData(Math.min(canvas.width - 1, Math.max(0, Math.floor((b.left + (b.width * (2 * i + 1)) / 6) * scale))),
        Math.min(canvas.height - 1, Math.max(0, Math.floor((b.top + (b.height * (2 * j + 1)) / 6) * scale))), 1, 1).data; px.push([d[0], d[1], d[2]]); }
    const avg = [0, 1, 2].map((k) => px.reduce((s, q) => s + q[k], 0) / px.length);
    return { text: t.text, fill: t.fill, ratio: typeof t.fill === 'string' && t.fill.startsWith('#') ? ratio(hex(t.fill), avg) : null };
  });
})()`);
r.check('8. o fundo virou um degradê com cores da foto (diferentes do preset)', extracted && JSON.stringify(extracted.stops) !== JSON.stringify(bgBefore?.stops)
  && extracted.stops.every((x) => !preset.colors.includes(x.color)), JSON.stringify({ before: bgBefore, after: extracted }));
r.check('8. os textos têm contraste ≥ 3 sobre o fundo novo', contrast.length >= 2 && contrast.every((c) => c.ratio !== null && c.ratio >= 3), JSON.stringify(contrast));
screencap(`${out}/09-8-fundo-da-foto.png`);

// ---------- 9. 🎨 aplicar em todas; um ↶ desfaz tudo ----------
const bgsBefore = (await state()).bgs;
await p.tap('#tabs button', 'Fundo');
await p.tap('#sheet .bg-apply-all-btn');
await p.sleep(600);
s = await state();
const same = s.bgs.every((b) => b && JSON.stringify(b.spec) === JSON.stringify(extracted));
const sized = s.bgs.every((b, i) => b && b.w === s.sizes[i][0] && b.h === s.sizes[i][1]);
r.check('9. todas as páginas (também as de outro tamanho) com o mesmo degradê e o fundo no tamanho dela', same && sized, JSON.stringify({ sizes: s.sizes, bgs: s.bgs }));
await p.tap('#topbar button', '↶');
await p.sleep(800);
s = await state();
r.check('9. um ↶ desfaz a aplicação em todas de uma vez (o fundo da página de origem continua o extraído)',
  JSON.stringify(s.bgs) === JSON.stringify(bgsBefore), JSON.stringify({ before: bgsBefore, after: s.bgs }));
await p.tap('#topbar button', '↷');
await p.sleep(800);

// ---------- 10. exportar todas ----------
const nExp = (await state()).n;
const activeBefore = (await state()).active;
await p.tap('#topbar button', 'Exportar');
const allLabel = await p.evaluate(`document.querySelector('#sheet .export-all-btn')?.textContent ?? null`);
await p.tap('#sheet .export-all-btn');
await idle();
await p.sleep(1500);
const files = adbShell(`content query --uri content://media/external/images/media --projection _display_name --where "_display_name LIKE '${NAME}_p%'"`);
const names = [...files.matchAll(/_display_name=([^\s,]+)/g)].map((m) => m[1]);
s = await state();
r.check(`10. "Exportar todas as páginas (${nExp})" grava ${nExp} PNG ${NAME}_p1..p${nExp}_*.png na galeria`, allLabel?.includes(`(${nExp})`)
  && names.length === nExp && Array.from({ length: nExp }, (_, i) => names.some((n) => n.startsWith(`${NAME}_p${i + 1}_`) && n.endsWith('.png'))).every(Boolean),
  JSON.stringify({ allLabel, names }));
r.check('10. depois de exportar, a página ativa é a mesma de antes', s.active === activeBefore, `${activeBefore} → ${s.active}`);
try {
  adbShell(`content delete --uri content://media/external/images/media --where "_display_name LIKE '${NAME}_p%'"`);
  console.log('exports de teste apagados');
} catch (e) { console.log(`limpeza falhou: ${e.message}`); }

r.check('sem exceções JS no console', !p.logs.some((l) => l.startsWith('EXCEPTION')), p.logs.filter((l) => l.startsWith('EXCEPTION')).join(' | '));
console.log(`rascunho de teste: "${NAME}" (apague pelo Rascunhos)`);
r.done();
p.close();
