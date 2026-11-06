// E2E TASK-10 (⚡ Gerar em lote por variáveis de catálogo; exportação WebP / PDF de impressão / lote em galeria e ZIP) no app.
// Uso: ANDROID_SERIAL=<serial> node tools/e2e/task10.mjs <pasta-de-prints>   (moto: E2E_FORMAT="Post Instagram")
// Toques reais nos botões das folhas e do painel; os valores de campo (seletor, textarea, células) são escritos no DOM com o
// evento que a UI escuta. O estado é lido pelo `window.editor`; os arquivos, por adb. Na base (sem a TASK-10) o passo 2 não
// acha "⚡ Variável do lote": o script prova a ausência (sem WebP/PDF na folha Exportar, `export` webp = `invalid`) e para.
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { inflateRawSync } from 'node:zlib';
import { adbShell, launchEditor, reporter, screencap } from './cdp.mjs';

const PKG = 'com.productphoto.offline';
const out = process.argv[2] ?? '.';
const NAME = `E2E10_${Date.now().toString(36)}`;
const LONG = 'Parafusadeira e Furadeira de Impacto 20V Bivolt com Maleta';
const adbEnv = { ...process.env, MSYS_NO_PATHCONV: '1' };
const adbBin = (...args) => execFileSync('adb', args, { env: adbEnv, maxBuffer: 256 << 20 });

/** Toque estável (o mesmo do task09): espera a caixa do elemento parar de mexer antes de tocar. */
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
const r = reporter(`TASK-10 — gerar em lote, WebP, PDF de impressão, lote na galeria e ZIP (${NAME})`);
const idle = () => p.waitFor(`!document.getElementById('busy').classList.contains('show')`, 60000).catch(() => {});
const sheetOpen = (title) => p.waitFor(`document.getElementById('sheet').classList.contains('show')
  && (document.querySelector('#sheet .sheet-head strong')?.textContent ?? '').includes(${JSON.stringify(title)})`, 8000);
const sheetClosed = () => p.waitFor(`!document.getElementById('sheet').classList.contains('show')`, 8000);
const closeSheet = async () => { await p.tap('#sheet .sheet-head button'); await sheetClosed(); await p.sleep(200); };
const attempt = async (label, step, done) => {
  for (let i = 1; i <= 3; i++) {
    try { await step(); } catch (e) { console.log(`${label}: tentativa ${i} — ${e.message}`); }
    if (await p.waitFor(done, 8000).then(() => true, () => false)) return;
    console.log(`${label}: tentativa ${i} não aplicou`);
    if (await p.evaluate(`document.getElementById('sheet').classList.contains('show')`)) await closeSheet().catch(() => {});
    await p.sleep(800);
  }
  throw new Error(`${label}: não aplicou em 3 tentativas`);
};
/** Escreve o valor de um campo como o teclado/seletor faria (value + o evento que a UI escuta). */
const setField = (sel, value, event = 'input') => p.evaluate(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); if (!e) return false;
  e.value = ${JSON.stringify(value)}; e.dispatchEvent(new Event(${JSON.stringify(event)})); return e.value === ${JSON.stringify(value)}; })()`);
const toastText = () => p.evaluate(`document.getElementById('toast').textContent`);
const pagesState = () => p.evaluate(`(() => { const d = editor.toDocument(); const pages = d.pages ?? [{ fabric: d.fabric, name: d.name }];
  return { n: editor.getPageCount(), active: editor.getActivePageIndex(), names: pages.map((x) => x.name ?? null),
    texts: pages.map((x) => x.fabric.objects.filter((o) => typeof o.text === 'string').map((o) => o.text)),
    fields: pages.map((x) => x.fabric.objects.filter((o) => typeof o.text === 'string').map((o) => o.mergeField ?? null)) }; })()`);
const liveField = (f) => p.evaluate(`(() => { const o = editor.canvas.getObjects().find((x) => x.mergeField === ${JSON.stringify(f)});
  return o ? { fs: o.fontSize, h: o.height, w: o.width, text: o.text } : null; })()`);
const listDir = (dir) => { try { return adbShell(`ls ${dir}`).split(/\s+/).filter((n) => n.startsWith(NAME)); } catch { return []; } };

// ---------- 1. nome do design (o nome dos arquivos) ----------
await attempt('renomear', async () => {
  await p.tap('#topbar button.title');
  await sheetOpen('Nome do design');
  await p.waitFor(`Boolean(document.querySelector('#sheet input.name'))`, 8000);
  await p.evaluate(`(() => { const i = document.querySelector('#sheet input.name'); i.value = ${JSON.stringify(NAME)}; return true; })()`);
  await p.tap('#sheet button', 'Salvar');
  await sheetClosed();
}, `editor.name === ${JSON.stringify(NAME)} && !document.getElementById('sheet').classList.contains('show')`);

// ---------- 2. modelo: 3 títulos marcados pelo painel + um texto com {{desconto}} ----------
const H = await p.evaluate('editor.height');
const tops = { produto: Math.round(H * 0.18), preco_de: Math.round(H * 0.45), preco_por: Math.round(H * 0.6) };
let hasMerge = true;
for (const field of ['produto', 'preco_de', 'preco_por']) {
  await p.tap('#tabs button', 'Texto');
  await sheetOpen('Texto');
  await p.tap('#sheet button', 'Adicionar título');
  await sheetClosed();
  await p.sleep(400);
  const found = await p.waitFor(`Boolean(document.querySelector('#props .merge-row select'))`, 4000).then(() => true, () => false);
  if (!found) { hasMerge = false; break; }
  await setField('#props .merge-row select', field, 'change');
  // posição do layout (não é o que se testa): um título abaixo do outro
  await p.evaluate(`(() => { editor.active.set({ top: ${tops[field]} }); editor.active.setCoords(); editor.commit(); return true; })()`);
}

if (!hasMerge) {
  // ---------- controle positivo (base sem a TASK-10) ----------
  await p.tap('#topbar button', 'Exportar');
  await sheetOpen('Exportar');
  const opts = await p.evaluate(`[...document.querySelector('#sheet select').options].map((o) => o.value)`);
  await closeSheet();
  await p.evaluate(`ppEditor.call('export', { format: 'webp', action: 'save', name: 'x', data: editor.thumbnail(32) })`);
  await p.waitFor('ppEditor.last !== null', 10000).catch(() => {});
  const last = await p.evaluate('ppEditor.last');
  const merge = await p.evaluate(`Boolean(document.querySelector('.merge-open'))`);
  r.check('2. painel do texto tem "⚡ Variável do lote"', false, 'ausente');
  r.check('controle: sem ⚡ Gerar em lote, sem WebP/PDF na folha, `export` webp recusado (invalid)',
    !merge && !opts.includes('webp') && !opts.includes('pdf') && last?.ok === false && last?.code === 'invalid', JSON.stringify({ merge, opts, last }));
  screencap(`${out}/10-base-exportar.png`);
  r.done();
  p.close();
  process.exit();
}

await p.tap('#tabs button', 'Texto');
await sheetOpen('Texto');
await p.tap('#sheet button', 'Adicionar texto');
await sheetClosed();
await attempt('texto com {{desconto}}', async () => {
  await p.tap('#props button', '✏️ Editar texto');
  await sheetOpen('Editar texto');
  await p.evaluate(`(() => { const f = document.querySelector('#sheet textarea'); f.value = 'Leve já! {{desconto}}'; return true; })()`);
  await p.tap('#sheet button', 'Aplicar');
  await sheetClosed();
  await p.sleep(600);
}, `editor.canvas.getObjects().some((o) => o.text === 'Leve já! {{desconto}}')`);
await p.evaluate(`(() => { const t = editor.canvas.getObjects().find((o) => o.text === 'Leve já! {{desconto}}'); t.set({ top: ${Math.round(H * 0.82)} });
  t.setCoords(); editor.canvas.discardActiveObject(); editor.commit(); return true; })()`);
await p.sleep(500);
const fields = await p.evaluate(`editor.canvas.getObjects().filter((o) => typeof o.text === 'string').map((o) => o.get('mergeField') ?? null)`);
r.check('2. textos marcados pelo painel: produto, preco_de, preco_por e um sem marca', JSON.stringify(fields) === JSON.stringify(['produto', 'preco_de', 'preco_por', null]),
  JSON.stringify(fields));
screencap(`${out}/10-1-modelo.png`);
const model = await liveField('produto');

// ---------- 3. ⚡ Gerar em lote: colar 4, digitar a 5ª, gerar ----------
await p.tap('#tabs button', 'Texto');
await sheetOpen('Texto');
await p.tap('#sheet button.merge-open');
await sheetOpen('Gerar em lote');
const chips = await p.evaluate(`[...document.querySelectorAll('#sheet .merge-fields .chip')].map((e) => e.dataset.field)`);
const paste = [`${LONG}; R$ 599,90; R$ 399,90`, 'Tênis Corrida Pro; R$ 299,90; R$ 189,90', 'Camiseta Dry Fit; R$ 89,90; R$ 49,90',
  'Meia Kit 3 Pares; R$ 39,90; R$ 19,90'].join('\n');
await setField('#sheet textarea.merge-input', paste);
await p.tap('#sheet button.merge-add');
for (const [f, v] of [['produto', 'Boné Aba Curva'], ['preco_de', 'R$ 59,90'], ['preco_por', 'R$ 39,90']]) {
  await setField(`#sheet input[data-row="4"][data-field="${f}"]`, v);
}
const tbl = await p.evaluate(`({ rows: document.querySelectorAll('#sheet .merge-line').length, go: document.querySelector('#sheet .merge-go').textContent,
  desc: document.querySelector('#sheet input[data-row="4"][data-field="desconto"]')?.value ?? null })`);
r.check('3. folha lista os 4 campos; tabela com 5 linhas (4 coladas + 1 digitada, desconto -33%); "Gerar 5 anúncios"',
  JSON.stringify(chips) === JSON.stringify(['produto', 'preco_de', 'preco_por', 'desconto']) && tbl.rows === 5 && tbl.go === 'Gerar 5 anúncios' && tbl.desc === '-33%',
  JSON.stringify({ chips, tbl }));
screencap(`${out}/10-2-folha-lote.png`);
await p.tap('#sheet button.merge-go');
await sheetClosed().catch(() => {});
await p.waitFor('editor.getPageCount() === 6', 30000).catch(() => {});
await idle();
const genToast = await toastText();
let s = await pagesState();
r.check('4. 6 páginas (modelo + 5), mostra a 1ª gerada, nome da página = produto, toast "5 anúncios gerados"', s.n === 6 && s.active === 1
  && s.names[2] === 'Tênis Corrida Pro' && genToast.includes('5 anúncios gerados'), JSON.stringify({ n: s.n, active: s.active, names: s.names, genToast }));
r.check('4. página do Tênis: textos da linha e desconto -37%', JSON.stringify(s.texts[2]) === JSON.stringify(['Tênis Corrida Pro', 'R$ 299,90', 'R$ 189,90', 'Leve já! -37%']),
  JSON.stringify(s.texts[2]));
r.check('4. modelo continua com os placeholders e as marcas', JSON.stringify(s.texts[0]) === JSON.stringify(['Título', 'Título', 'Título', 'Leve já! {{desconto}}'])
  && JSON.stringify(s.fields[0]) === JSON.stringify(['produto', 'preco_de', 'preco_por', null]), JSON.stringify({ t: s.texts[0], f: s.fields[0] }));
const live = await liveField('produto');
const atFloor = model && live && Math.abs(live.fs - model.fs * 0.65) < 0.02;
r.check('4. Parafusadeira: fonte do nome < a do modelo e ≥ 65% dela; altura ≤ a do modelo (ou no piso)', model && live && live.text === LONG
  && live.fs < model.fs && live.fs >= model.fs * 0.65 - 0.02 && (live.h <= model.h + 0.5 || atFloor), JSON.stringify({ model, live, atFloor }));
screencap(`${out}/10-3-parafusadeira.png`);
await p.tap('#pages .pg-next');
await p.waitFor('editor.getActivePageIndex() === 2', 8000).catch(() => {});
await p.sleep(500);
screencap(`${out}/10-4-tenis.png`);
// gerar é um passo do undo
await p.tap('#topbar button', '↶');
const undone = await p.waitFor('editor.getPageCount() === 1', 10000).then(() => true, () => false);
await p.tap('#topbar button', '↷');
const redone = await p.waitFor('editor.getPageCount() === 6', 10000).then(() => true, () => false);
r.check('4. ↶ desfaz a geração inteira e ↷ refaz', undone && redone, JSON.stringify({ undone, redone }));
await idle();

// ---------- exportar ----------
const exportVia = async (format, pages, action, extra) => {
  await p.tap('#topbar button', 'Exportar');
  await sheetOpen('Exportar');
  const opts = await p.evaluate(`[...document.querySelector('#sheet select').options].map((o) => o.value)`);
  await setField('#sheet select', format, 'change');
  if (pages) await setField('#sheet .export-pages select', pages, 'change');
  if (extra) await p.evaluate(extra);
  await p.tap('#sheet button', action);
  await sheetClosed().catch(() => {});
  await p.waitFor(`document.getElementById('busy').classList.contains('show')`, 5000).catch(() => {});
  await idle();
  await p.sleep(800);
  return { opts, toast: await toastText() };
};
const nPages = (await pagesState()).n;

// 5. WebP, todas, salvar na galeria
let x = await exportVia('webp', 'all', 'Salvar na galeria');
const webps = listDir('/sdcard/Pictures/ProductPhoto/').filter((n) => /_\d{8}_\d{6}_\d{2}\.webp$/.test(n)).sort();
let riff = '';
if (webps[0]) riff = adbBin('exec-out', `head -c 12 /sdcard/Pictures/ProductPhoto/${webps[0]}`).toString('latin1');
r.check(`5. formatos PNG, JPG, WebP, SVG, PDF, MP4, GIF na folha`, JSON.stringify(x.opts) === JSON.stringify(['png', 'jpg', 'webp', 'svg', 'pdf', 'mp4', 'gif']), JSON.stringify(x.opts));
r.check(`5. WebP + Todas + Salvar: toast "${nPages} anúncios salvos na galeria!" e ${nPages} arquivos <nome>_<ts>_01..${String(nPages).padStart(2, '0')}.webp (RIFF…WEBP)`,
  x.toast === `${nPages} anúncios salvos na galeria!` && webps.length === nPages && webps.every((n, i) => n.endsWith(`_${String(i + 1).padStart(2, '0')}.webp`))
  && riff.startsWith('RIFF') && riff.slice(8, 12) === 'WEBP', JSON.stringify({ toast: x.toast, webps, riff }));

// 6. PDF, marcas de corte, todas, salvar
x = await exportVia('pdf', 'all', 'Salvar na galeria', `(() => { const c = document.querySelector('#sheet .crop-marks'); c.checked = true; c.dispatchEvent(new Event('change')); return true; })()`);
const pdfs = listDir('/sdcard/Download/ProductPhoto/').filter((n) => n.endsWith('.pdf'));
let pdfInfo = null;
if (pdfs[0]) {
  const local = `${out}/10-catalogo.pdf`;
  adbBin('pull', `/sdcard/Download/ProductPhoto/${pdfs[0]}`, local);
  const txt = readFileSync(local).toString('latin1');
  const boxes = [...txt.matchAll(/\/MediaBox\s*\[\s*0\s+0\s+([\d.]+)\s+([\d.]+)\s*\]/g)].map((m) => [Number(m[1]), Number(m[2])]);
  pdfInfo = { file: pdfs[0], head: txt.slice(0, 5), pages: (txt.match(/\/Type\s*\/Page(?![s\w])/g) ?? []).length, boxes: [...new Set(boxes.map((b) => b.join('x')))] };
}
const W = await p.evaluate('editor.width'), Hh = await p.evaluate('editor.height');
r.check(`6. PDF + marcas + Todas: Download/ProductPhoto/<nome>_<ts>.pdf com %PDF, ${nPages} páginas, MediaBox ${W + 72}×${Hh + 72}`, pdfInfo?.head === '%PDF-'
  && pdfInfo.pages === nPages && pdfInfo.boxes.length === 1 && pdfInfo.boxes[0] === `${W + 72}x${Hh + 72}` && x.toast.startsWith('Salvo em Download/ProductPhoto/'),
  JSON.stringify({ pdfInfo, toast: x.toast }));

// 7. PNG, todas, compartilhar → seletor do Android com o .zip
x = await exportVia('png', 'all', 'Compartilhar');
let chooser = false;
for (let i = 0; i < 12 && !chooser; i++) {
  await p.sleep(500);
  chooser = /Chooser|intentresolver|ResolverActivity/i.test(adbShell('dumpsys window | grep -E "mCurrentFocus|mFocusedApp"'));
}
screencap(`${out}/10-5-compartilhar.png`);
let zipInfo = null;
try {
  const zips = adbShell(`run-as ${PKG} ls cache/exports`).split(/\s+/).filter((n) => n.endsWith('.zip'));
  if (zips.length === 1) {
    const buf = adbBin('exec-out', 'run-as', PKG, 'cat', `cache/exports/${zips[0]}`);
    writeFileSync(`${out}/10-lote.zip`, buf);
    zipInfo = { file: zips[0], entries: readZip(buf) };
  } else zipInfo = { zips };
} catch (e) { zipInfo = { error: e.message }; }
adbShell('input keyevent BACK');
await p.sleep(800);
r.check(`7. PNG + Todas + Compartilhar: seletor do Android e 1 .zip em cache/exports com ${nPages} PNG`, chooser && zipInfo?.entries?.length === nPages
  && zipInfo.entries.every((e, i) => e.name.endsWith(`_${String(i + 1).padStart(2, '0')}.png`) && e.png), JSON.stringify({ chooser, zipInfo }));

// 8. WebP, página atual, salvar → 1 arquivo sem sufixo de lote
const before8 = listDir('/sdcard/Pictures/ProductPhoto/');
await p.sleep(1100); // o nome leva o segundo: não colide com o lote do passo 5
x = await exportVia('webp', 'current', 'Salvar na galeria');
const new8 = listDir('/sdcard/Pictures/ProductPhoto/').filter((n) => !before8.includes(n));
r.check('8. WebP + Página atual + Salvar: 1 arquivo <nome>_<ts>.webp', new8.length === 1 && /_\d{8}_\d{6}\.webp$/.test(new8[0]) && x.toast.startsWith('Salvo em Pictures/ProductPhoto/'),
  JSON.stringify({ new8, toast: x.toast }));

r.check('sem exceções JS no console', !p.logs.some((l) => l.startsWith('EXCEPTION')), p.logs.filter((l) => l.startsWith('EXCEPTION')).join(' | '));

// ---------- 9. limpeza (o aparelho é do dono): só os arquivos deste teste ----------
try {
  adbShell(`content delete --uri content://media/external/images/media --where "_display_name LIKE '${NAME}_%'"`);
  adbShell(`content delete --uri content://media/external/downloads --where "_display_name LIKE '${NAME}_%'"`);
  console.log(`exports de teste apagados; sobraram: ${JSON.stringify([...listDir('/sdcard/Pictures/ProductPhoto/'), ...listDir('/sdcard/Download/ProductPhoto/')])}`);
} catch (e) { console.log(`limpeza falhou: ${e.message}`); }
console.log(`rascunho de teste: "${NAME}" (apague pelo Rascunhos)`);
r.done();
p.close();

/** Entradas do ZIP pelo diretório central; cada uma inflada para conferir a assinatura PNG. */
function readZip(buf) {
  let eocd = -1;
  for (let i = buf.length - 22; i >= 0; i--) if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  if (eocd < 0) return [];
  const n = buf.readUInt16LE(eocd + 10);
  let off = buf.readUInt32LE(eocd + 16);
  const entries = [];
  for (let k = 0; k < n; k++) {
    const method = buf.readUInt16LE(off + 10), csize = buf.readUInt32LE(off + 20);
    const nlen = buf.readUInt16LE(off + 28), xlen = buf.readUInt16LE(off + 30), clen = buf.readUInt16LE(off + 32);
    const local = buf.readUInt32LE(off + 42);
    const name = buf.subarray(off + 46, off + 46 + nlen).toString('utf8');
    const start = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28);
    const raw = buf.subarray(start, start + csize);
    const data = method === 8 ? inflateRawSync(raw) : raw;
    entries.push({ name, size: data.length, png: data.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) });
    off += 46 + nlen + xlen + clen;
  }
  return entries;
}
