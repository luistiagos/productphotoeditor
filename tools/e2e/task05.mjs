// E2E TASK-05 (📱 QR Code vetorial offline — link, WhatsApp, PIX, Wi-Fi — e 📊 Tabelas de medidas/preços) no app real.
// Uso: ANDROID_SERIAL=<serial> node tools/e2e/task05.mjs <pasta-de-prints>   (cwd = raiz da lane)
// Toques reais nas abas, botões e no canvas; campos de texto, <select> e <input type=color> recebem o valor por evento (o
// teclado e o seletor nativo não são elementos da página). A "câmera" é o OpenCV no PC: tools/e2e/qr_decode.py lê o PNG
// exportado do QR e o print do aparelho (Python SEM -I: o opencv fica no site do usuário).
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { launchEditor, reporter, screencap } from './cdp.mjs';

const out = process.argv[2] ?? '.';
const p = await launchEditor();
const r = reporter('TASK-05 — QR Code vetorial offline e tabelas no canvas');
const near = (a, b, tol = 1) => Math.abs(a - b) <= tol;
const PRIMARY = '#c2185b';

/** Lê o QR de um PNG com o OpenCV; devolve { ok, text }. */
const decodeFile = (file, extra = []) => {
  try {
    const o = execFileSync('python', ['tools/e2e/qr_decode.py', ...extra, file], { encoding: 'utf8' });
    return { ok: true, text: o.split('\t').slice(1).join('\t').replace(/ \[crc (ok|ERRADO)\]\s*$/, '').trim(), raw: o.trim() };
  } catch (e) {
    return { ok: false, text: String(e.stdout ?? '').split('\t').slice(1).join('\t').trim(), raw: String(e.stdout ?? e.message) };
  }
};
/** PNG só com o objeto `expr` (os outros ficam de fora), lado 1080, gravado na pasta de prints. */
const renderOnly = async (expr, name) => {
  const data = await p.evaluate(`(() => { const t = ${expr}; return editor.renderPageCanvas(1080, (o) => o === t).canvas.toDataURL('image/png'); })()`);
  const file = `${out}/${name}`;
  writeFileSync(file, Buffer.from(data.split(',')[1], 'base64'));
  return file;
};
const typeInto = (selector, value) => p.evaluate(`(() => { const e = document.querySelector(${JSON.stringify(selector)});
  e.value = ${JSON.stringify(value)}; e.dispatchEvent(new Event('input')); return e.value; })()`);
const setSelect = (selector, value) => p.evaluate(`(() => { const s = document.querySelector(${JSON.stringify(selector)});
  s.value = ${JSON.stringify(value)}; s.dispatchEvent(new Event('change')); return s.value; })()`);
const blur = () => p.evaluate('document.activeElement && document.activeElement.blur && document.activeElement.blur()');
const closeSheet = async () => { await p.tap('#sheet .sheet-head button'); await p.sleep(200); };
const deselect = async () => { await p.evaluate('(editor.canvas.discardActiveObject(), editor.canvas.requestRenderAll())'); await p.sleep(250); };
/** Toque real no ponto (coordenadas do documento). */
const tapDoc = async (x, y) => {
  const c = await p.evaluate(`editor.docToClient(${x}, ${y})`);
  await p.touch('touchStart', c.x, c.y);
  await p.sleep(60);
  await p.touch('touchEnd', c.x, c.y);
  await p.sleep(350);
};
const qrs = `editor.canvas.getObjects().filter((o) => o.qrConfig)`;
const tables = `editor.canvas.getObjects().filter((o) => o.tableData)`;
const moveActive = (x, y) => p.evaluate(`(() => { const o = editor.active; o.setPositionByOrigin(new o.getCenterPoint().constructor(${x}, ${y}), 'center', 'center'); o.setCoords(); editor.commit(); return true; })()`);
const geo = (expr) => p.evaluate(`(() => { const o = ${expr}; o.setCoords(); const c = o.getCenterPoint(); return { cx: c.x, cy: c.y, w: o.width * o.scaleX, sx: o.scaleX, sy: o.scaleY,
  index: editor.canvas.getObjects().indexOf(o), payload: o.qrConfig?.payload ?? null }; })()`);

// ---------- 0. estado de partida ----------
const hasFeature = await p.evaluate(`[...document.querySelectorAll('#tabs button')].some((b) => b.textContent.includes('📱 QR Code'))
  && [...document.querySelectorAll('#tabs button')].some((b) => b.textContent.includes('📊 Tabela'))
  && typeof editor.upsertQrCode === 'function' && typeof ppEditor.setBrandKit === 'function'`);
r.check('abas "📱 QR Code" e "📊 Tabela", editor.upsertQrCode e ppEditor.setBrandKit existem (ausentes na base)', hasFeature);
if (!hasFeature) { r.done(); p.close(); process.exit(1); }
await p.evaluate(`(async () => { await editor.newDocument('E2E 05', 1080, 1080); ppEditor.setBrandKit({ profile: { website: 'www.lojateste.com.br',
  phone: '(11) 98888-7777', company: 'Loja Teste' }, colors: { primary: '${PRIMARY}' }, logoUrl: contentUrl('mockups/box_front.webp') }); })()`);
await p.sleep(400);

// ---------- 1. Link, sem rede ----------
const res0 = await p.evaluate(`performance.getEntriesByType('resource').length`);
await p.tap('#tabs button', '📱 QR Code');
const s1 = await p.evaluate(`({ kind: document.querySelector('#sheet .qr-kind.primary')?.dataset.kind, url: document.querySelector('#sheet [data-field=url]')?.value })`);
r.check('folha do QR abre no modo Link com o site do brand kit pré-preenchido', s1.kind === 'link' && s1.url === 'www.lojateste.com.br', JSON.stringify(s1));
await p.sleep(300);
r.check('prévia ao vivo na folha (SVG com o payload)', await p.evaluate(`document.querySelector('#sheet .qr-preview svg') !== null
  && document.querySelector('#sheet .qr-preview').dataset.payload === 'https://www.lojateste.com.br'`));
await p.tap('#sheet .qr-apply');
await p.waitFor(`${qrs}.length === 1`, 10000);
const q1 = await p.evaluate(`(() => { const g = ${qrs}[0]; return { kind: g.qrConfig.kind, payload: g.qrConfig.payload, active: editor.active === g,
  types: [...new Set(g.getObjects().map((o) => o.type))], layer: g.layerName }; })()`);
r.check('Inserir cria um Group selecionado com qrConfig.kind "link" e payload https://www.lojateste.com.br', q1.kind === 'link'
  && q1.payload === 'https://www.lojateste.com.br' && q1.active && q1.layer === 'QR Code', JSON.stringify(q1));
r.check('o grupo só tem Rect/Path (vetorial, nenhuma imagem)', q1.types.every((t) => t === 'rect' || t === 'path'), q1.types.join(','));
const res1 = await p.evaluate(`performance.getEntriesByType('resource').length`);
r.check('nenhuma requisição de rede durante a geração (performance resource)', res1 === res0, `${res0} → ${res1}`);
const png1 = `${out}/05-1-link.png`;
writeFileSync(png1, Buffer.from((await p.evaluate(`editor.exportRaster('png', 1, 1)`)).split(',')[1], 'base64'));
const d1 = decodeFile(png1, ['--expect', 'https://www.lojateste.com.br']);
r.check('PNG exportado do anúncio decodifica (OpenCV) para o link exato', d1.ok, d1.raw);
const svg1 = await p.evaluate(`editor.exportSvg()`);
r.check('exportar SVG: o QR sai como <path> e sem <image>', svg1.includes('<path') && !svg1.includes('<image'), `len ${svg1.length}`);
r.check('props do QR: "✏️ Editar QR Code" e sem "🔓 Desagrupar"', await p.evaluate(`(editor.canvas.setActiveObject(${qrs}[0]), editor.onSelection(${qrs}[0]),
  Boolean(document.querySelector('#props .edit-qr')) && !document.querySelector('#props .ungroup-btn'))`));
await moveActive(230, 230);
await deselect();
screencap(`${out}/05-1-link-print.png`);
const dScreen = decodeFile(`${out}/05-1-link-print.png`, ['--expect', 'https://www.lojateste.com.br']);
r.check('print do aparelho (tela) também decodifica — leitura "como câmera"', dScreen.ok, dScreen.raw);

// ---------- 2. WhatsApp + estilo ----------
await p.tap('#tabs button', '📱 QR Code');
await p.tap('#sheet .qr-kind[data-kind="whatsapp"]');
r.check('modo WhatsApp com o telefone do brand kit', (await p.evaluate(`document.querySelector('#sheet [data-field=phone]')?.value`)) === '(11) 98888-7777');
await typeInto('#sheet [data-field=message]', 'Olá! Vi o anúncio');
await blur();
await setSelect('#sheet .qr-dot-style select', 'dots');
await setSelect('#sheet .qr-eye-style select', 'rounded');
await p.tap('#sheet .qr-brand-color');
await p.tap('#sheet .qr-label', 'CHAME NO WHATSAPP');
await p.sleep(300);
await p.tap('#sheet .qr-apply');
await p.waitFor(`${qrs}.length === 2`, 10000);
const WA = 'https://wa.me/5511988887777?text=Ol%C3%A1!%20Vi%20o%20an%C3%BAncio';
const q2 = await p.evaluate(`(() => { const g = editor.active; const c = g.qrConfig; return { payload: c.payload, dot: c.dotStyle, eye: c.eyeStyle, fg: c.fgColor, label: c.label,
  pathFills: g.getObjects().filter((o) => o.type === 'path').map((o) => o.fill), text: g.getObjects().find((o) => o.type === 'text')?.text ?? null }; })()`);
r.check('payload WhatsApp com a mensagem codificada', q2.payload === WA, q2.payload);
r.check('estilo Pontos + cantos arredondados, módulos na cor da marca, legenda presente', q2.dot === 'dots' && q2.eye === 'rounded' && q2.fg === PRIMARY
  && q2.pathFills.every((f) => f === PRIMARY) && q2.text === 'CHAME NO WHATSAPP', JSON.stringify(q2));
const d2 = decodeFile(await renderOnly('editor.active', '05-2-whatsapp.png'), ['--expect', WA]);
r.check('QR do WhatsApp (pontos, cantos arredondados, legenda) decodifica para o link wa.me exato', d2.ok, d2.raw);
r.check('localizar e substituir não mexe na legenda do QR', (await p.evaluate(`editor.findTextMatches('WHATSAPP').length`)) === 0);
await moveActive(850, 230);
await deselect();
screencap(`${out}/05-2-whatsapp-print.png`);

// ---------- 3. PIX ----------
await p.tap('#tabs button', '📱 QR Code');
await p.tap('#sheet .qr-kind[data-kind="pix"]');
await typeInto('#sheet [data-field=key]', '+5511988887777');
await typeInto('#sheet [data-field=name]', 'Loja Teste');
await typeInto('#sheet [data-field=city]', 'São Paulo');
await typeInto('#sheet [data-field=amount]', '19,90');
await blur();
await p.sleep(300);
await p.tap('#sheet .qr-apply');
await p.waitFor(`${qrs}.length === 3`, 10000);
const pix = await p.evaluate('editor.active.qrConfig.payload');
const d3 = decodeFile(await renderOnly('editor.active', '05-3-pix.png'), ['--pix', '--expect', pix]);
r.check('PIX: decodifica, começa com 000201, tem br.gov.bcb.pix, 540519.90, 6009SAO PAULO e o CRC confere', d3.ok && pix.startsWith('000201')
  && pix.includes('br.gov.bcb.pix') && pix.includes('540519.90') && pix.includes('6009SAO PAULO'), d3.raw);
await moveActive(230, 850);
await deselect();
const bad = pix.slice(0, -1) + (pix.endsWith('0') ? '1' : '0');
await p.tap('#tabs button', '📱 QR Code');
await p.tap('#sheet .qr-kind[data-kind="pix"]');
await setSelect('#sheet .qr-pix-mode select', 'paste');
await typeInto('#sheet [data-field=pasted]', bad);
await blur();
await p.tap('#sheet .qr-apply');
await p.sleep(400);
const badRes = await p.evaluate(`({ n: ${qrs}.length, toast: document.getElementById('toast').textContent, open: document.getElementById('sheet').classList.contains('show') })`);
r.check('PIX Copia e Cola com CRC adulterado: toast de erro, nada inserido, folha continua aberta', badRes.n === 3 && /CRC/.test(badRes.toast) && badRes.open, JSON.stringify(badRes));
await closeSheet();

// ---------- 4. Logo ----------
await p.tap('#tabs button', '📱 QR Code');
await p.tap('#sheet [data-field=withLogo]');
await p.sleep(300);
await p.tap('#sheet .qr-apply');
await p.waitFor(`${qrs}.length === 4`, 15000);
const q4 = await p.evaluate(`(() => { const g = editor.active; const imgs = g.getObjects().filter((o) => o.type === 'image');
  const bg = g.getObjects()[0]; const im = imgs[0];
  return { ecc: g.qrConfig.ecc, withLogo: g.qrConfig.withLogo, n: imgs.length, brandLogo: im?.brandLogo ?? null,
    // centro do logo e centro do quadrado do QR (fundo sem legenda), em coordenadas do grupo
    dx: im ? im.getCenterPoint().x - bg.getCenterPoint().x : null, dy: im ? im.getCenterPoint().y - bg.getCenterPoint().y : null }; })()`);
r.check('"Incluir logo": 1 FabricImage com brandLogo no centro e correção H', q4.ecc === 'H' && q4.withLogo && q4.n === 1 && q4.brandLogo === true
  && near(q4.dx, 0, 1) && near(q4.dy, 0, 1), JSON.stringify(q4));
const d4 = decodeFile(await renderOnly('editor.active', '05-4-logo.png'), ['--expect', 'https://www.lojateste.com.br']);
r.check('QR com logo no centro ainda decodifica', d4.ok, d4.raw);
await moveActive(850, 850);
await deselect();
screencap(`${out}/05-4-logo-print.png`);

// ---------- 5. Re-edição sem perder posição/tamanho ----------
const waExpr = `${qrs}.find((o) => o.qrConfig.kind === 'whatsapp')`;
let wa = await geo(waExpr);
await tapDoc(wa.cx, wa.cy);
r.check('toque no QR do WhatsApp o seleciona', await p.evaluate(`editor.active === ${waExpr}`));
// arrasto real
const from = await p.evaluate(`editor.docToClient(${wa.cx}, ${wa.cy})`);
await p.drag(from.x, from.y, from.x - 60, from.y + 80, { steps: 12 });
const moved = await geo(waExpr);
r.check('arrasto real move o QR', !near(moved.cx, wa.cx, 5) || !near(moved.cy, wa.cy, 5), JSON.stringify({ wa, moved }));
await p.tap('#props .geometry-btn');
await p.evaluate(`(() => { const i = document.querySelector('#sheet [data-field=width]'); i.value = '300'; i.dispatchEvent(new Event('change')); })()`);
await p.sleep(300);
await closeSheet();
const before = await geo(waExpr);
r.check('largura exibida 300 pelo 📏 Posição / Tamanho', near(before.w, 300, 1), JSON.stringify(before));
await p.tap('#props .edit-qr');
const s5 = await p.evaluate(`({ title: document.querySelector('#sheet .sheet-head strong')?.textContent, phone: document.querySelector('#sheet [data-field=phone]')?.value,
  msg: document.querySelector('#sheet [data-field=message]')?.value, kind: document.querySelector('#sheet .qr-kind.primary')?.dataset.kind })`);
r.check('"✏️ Editar QR Code" reabre a folha com o modo, telefone e mensagem atuais', s5.title === 'Editar QR Code' && s5.kind === 'whatsapp'
  && s5.phone === '(11) 98888-7777' && s5.msg === 'Olá! Vi o anúncio', JSON.stringify(s5));
const longMsg = 'Olá! Quero o combo da promoção de sexta com entrega hoje, por favor';
await typeInto('#sheet [data-field=message]', longMsg);
await blur();
await p.sleep(300);
screencap(`${out}/05-5-editar-qr.png`);
await p.tap('#sheet .qr-apply');
await p.sleep(800);
const after = await geo(waExpr);
const WA2 = 'https://wa.me/5511988887777?text=' + encodeURIComponent(longMsg);
r.check('Aplicar: mesmo centro (±1), mesma largura exibida (±1), mesmo índice na pilha, payload novo', near(after.cx, before.cx) && near(after.cy, before.cy)
  && near(after.w, before.w) && after.index === before.index && after.payload === WA2, JSON.stringify({ before, after }));
r.check('o QR refeito continua selecionado com "✏️ Editar QR Code"', await p.evaluate(`editor.active === ${waExpr} && Boolean(document.querySelector('#props .edit-qr'))`));
const d5 = decodeFile(await renderOnly(waExpr, '05-5-reeditado.png'), ['--expect', WA2]);
r.check('o QR reeditado (versão maior) decodifica para o payload novo', d5.ok, d5.raw);
await deselect();
screencap(`${out}/05-5-reeditado-print.png`);
await p.sleep(400);
await p.tap('#topbar button', '↶');
await p.sleep(700);
const undone = await geo(waExpr);
r.check('↶ volta ao QR anterior em 1 toque', undone.payload === WA && undone.index === before.index, JSON.stringify(undone));

// ---------- 6. Tabelas ----------
await deselect();
await p.tap('#tabs button', '📊 Tabela');
await p.tap('#sheet .table-template[data-template="sizes"]');
await p.waitFor(`${tables}.length === 1`, 10000);
const t1 = await p.evaluate(`(() => { const g = editor.active; const head = g.getObjects().find((o) => o.type === 'rect' && o.fill === '${PRIMARY}');
  return { rows: g.tableData.rows, style: g.tableData.style, headFill: head?.fill ?? null, texts: g.getObjects().filter((o) => o.type === 'text').map((o) => o.text),
    edit: Boolean(document.querySelector('#props .edit-table')), ungroup: Boolean(document.querySelector('#props .ungroup-btn')) }; })()`);
r.check('1 toque em "👕 Tabela de Medidas": Tamanho | Largura | Comprimento + P/M/G/GG', JSON.stringify(t1.rows[0]) === '["Tamanho","Largura","Comprimento"]'
  && JSON.stringify(t1.rows.slice(1).map((x) => x[0])) === '["P","M","G","GG"]' && t1.texts.length === 15, JSON.stringify(t1.rows));
r.check('Cabeçalho Destacado com a cor da marca; props com "✏️ Editar Tabela" e sem "🔓 Desagrupar"', t1.style === 'header' && t1.headFill === PRIMARY
  && t1.edit && !t1.ungroup, JSON.stringify({ style: t1.style, head: t1.headFill, edit: t1.edit, ungroup: t1.ungroup }));
await deselect();
screencap(`${out}/05-6-tabela.png`);
const tExpr = `${tables}[0]`;
const tBefore = await p.evaluate(`(() => { const o = ${tExpr}; const c = o.getPointByOrigin('left', 'top'); return { x: c.x, y: c.y, sx: o.scaleX, sy: o.scaleY,
  index: editor.canvas.getObjects().indexOf(o), cx: o.getCenterPoint().x, cy: o.getCenterPoint().y }; })()`);
await tapDoc(tBefore.cx, tBefore.cy);
await p.tap('#props .edit-table');
const grid = await p.evaluate(`[...document.querySelectorAll('#sheet .table-cell')].map((i) => i.value)`);
r.check('"✏️ Editar Tabela": grade de inputs com os 15 valores atuais', grid.length === 15 && grid[0] === 'Tamanho' && grid[14] === '74 cm', JSON.stringify(grid));
await p.tap('#sheet .table-add-row');
r.check('+ Linha acrescenta 3 campos vazios', (await p.evaluate(`document.querySelectorAll('#sheet .table-cell').length`)) === 18);
await typeInto('#sheet .table-cell[data-r="5"][data-c="0"]', 'XG');
await typeInto('#sheet .table-cell[data-r="5"][data-c="1"]', '58 cm');
await typeInto('#sheet .table-cell[data-r="5"][data-c="2"]', '76 cm');
await blur();
await setSelect('#sheet .table-style select', 'zebra');
await p.sleep(200);
screencap(`${out}/05-6-editar-tabela.png`);
await p.tap('#sheet .table-apply');
await p.sleep(800);
const tAfter = await p.evaluate(`(() => { const o = ${tExpr}; const c = o.getPointByOrigin('left', 'top'); const rh = o.getObjects().filter((x) => x.type === 'rect');
  return { x: c.x, y: c.y, sx: o.scaleX, sy: o.scaleY, index: editor.canvas.getObjects().indexOf(o), rows: o.tableData.rows.length, last: o.tableData.rows[5],
    style: o.tableData.style, zebra: rh.filter((x) => x.fill !== '#ffffff' && x.height > 20).length, active: editor.active === o }; })()`);
r.check('Aplicar: 6 linhas (XG | 58 cm | 76 cm), estilo zebrado com 2 faixas alternadas', tAfter.rows === 6 && JSON.stringify(tAfter.last) === '["XG","58 cm","76 cm"]'
  && tAfter.style === 'zebra' && tAfter.zebra === 2, JSON.stringify(tAfter));
r.check('tabela refeita no mesmo canto (±1), mesma escala e mesmo índice, ainda selecionada', near(tAfter.x, tBefore.x) && near(tAfter.y, tBefore.y)
  && near(tAfter.sx, tBefore.sx, 1e-6) && near(tAfter.sy, tBefore.sy, 1e-6) && tAfter.index === tBefore.index && tAfter.active, JSON.stringify({ tBefore, tAfter }));
await deselect();
await p.tap('#tabs button', '📊 Tabela');
await p.tap('#sheet .table-template[data-template="prices"]');
await p.waitFor(`${tables}.length === 2`, 10000);
const pr = await p.evaluate(`(() => { const g = editor.active; const bg = g.getObjects()[0]; const right = bg.left + bg.width;
  const prices = g.getObjects().filter((o) => o.type === 'text' && o.originX === 'right');
  const items = g.getObjects().filter((o) => o.type === 'text' && o.originX === 'left');
  return { right, pad: Math.round(32 * 0.6), lefts: prices.map((o) => o.left), texts: prices.map((o) => o.text), itemLefts: items.map((o) => o.left), bgLeft: bg.left }; })()`);
r.check('📋 Lista de Preços: a coluna de preço termina na borda direita − padding; itens começam na esquerda + padding', pr.texts.length === 5
  && pr.lefts.every((x) => near(x, pr.right - pr.pad, 0.5)) && pr.itemLefts.every((x) => near(x, pr.bgLeft + pr.pad, 0.5)), JSON.stringify(pr));
await deselect();
screencap(`${out}/05-6-lista-precos.png`);

// ---------- 7. Persistência e regressão de grupos comuns ----------
const persisted = await p.evaluate(`(async () => { await editor.load(editor.toDocument());
  return { qrs: ${qrs}.map((o) => o.qrConfig.kind), tables: ${tables}.map((o) => o.tableData.rows.length),
    logo: ${qrs}.find((o) => o.qrConfig.withLogo)?.getObjects().filter((x) => x.type === 'image' && x.brandLogo).length ?? 0 }; })()`);
r.check('salvar/reabrir: os 4 QR e as 2 tabelas voltam com qrConfig/tableData (e o logo do QR)', JSON.stringify(persisted.qrs.sort()) === '["link","link","pix","whatsapp"]'
  && JSON.stringify(persisted.tables) === '[6,5]' && persisted.logo === 1, JSON.stringify(persisted));
const pix2 = await geo(`${qrs}.find((o) => o.qrConfig.kind === 'pix')`);
await tapDoc(pix2.cx, pix2.cy);
r.check('depois de reabrir, tocar num QR mostra "✏️ Editar QR Code"', await p.evaluate(`Boolean(editor.active?.qrConfig) && Boolean(document.querySelector('#props .edit-qr'))`));
await deselect();
const tb2 = await geo(`${tables}[1]`);
await tapDoc(tb2.cx, tb2.cy);
r.check('depois de reabrir, tocar numa tabela mostra "✏️ Editar Tabela"', await p.evaluate(`Boolean(editor.active?.tableData) && Boolean(document.querySelector('#props .edit-table'))`));
await deselect();
// um Group comum (2 formas agrupadas) continua com "🔓 Desagrupar" e o ramo genérico de cores
await p.evaluate(`(async () => { await editor.newDocument('E2E 05b', 1080, 1080); editor.addShape('rect', '#3366ff'); editor.active.set({ left: 400, top: 540 });
  editor.addShape('circle', '#ff3366'); editor.active.set({ left: 700, top: 540 }); editor.selectMultiple(editor.canvas.getObjects()); editor.groupActive();
  editor.onSelection(editor.active); })()`);
await p.sleep(300);
r.check('Group comum: "🔓 Desagrupar" e "Preenchimento" no painel, sem "✏️ Editar…"', await p.evaluate(`Boolean(document.querySelector('#props .ungroup-btn'))
  && [...document.querySelectorAll('#props label.color')].some((l) => l.textContent.includes('Preenchimento'))
  && !document.querySelector('#props .edit-qr') && !document.querySelector('#props .edit-table')`));

r.check('sem exceções JS no console', !p.logs.some((l) => l.startsWith('EXCEPTION')), p.logs.filter((l) => l.startsWith('EXCEPTION')).join(' | '));
r.done();
p.close();
