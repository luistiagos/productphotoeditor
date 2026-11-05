// E2E TASK-11 (agrupar/desagrupar, cadeado nas Camadas, inspetor numérico, substituir foto) no app real.
// Uso: node task11.mjs <pasta-de-prints>
import { adbShell, launchEditor, reporter, screencap } from './cdp.mjs';

const out = process.argv[2] ?? '.';
const p = await launchEditor();
const r = reporter('TASK-11 — swap, group, cadeado, inspetor');
const near = (a, b, tol = 1.5) => a.length === b.length && a.every((v, i) => Math.abs(v - b[i]) <= tol);

await p.evaluate(`(async () => {
  await editor.newDocument('E2E 11', 1080, 1080);
  const cv = document.createElement('canvas'); cv.width = 400; cv.height = 300; const x = cv.getContext('2d');
  x.fillStyle = '#1e88e5'; x.fillRect(0, 0, 400, 300); x.fillStyle = '#ff9800'; x.fillRect(0, 200, 400, 100);
  const img = await editor.addImage(cv.toDataURL('image/png'));
  img.set({ left: 300, top: 300, scaleX: 1, scaleY: 1, layerName: 'Foto' });
  const rect = editor.addShape('rect', '#e53935'); rect.set({ left: 300, top: 300, width: 160, height: 120, layerName: 'Fundo preço' });
  const circ = editor.addShape('circle', '#43a047'); circ.set({ left: 700, top: 300, layerName: 'Selo' });
  const t = editor.addText('title', 'Montserrat'); t.set({ left: 540, top: 700, text: 'Por R$ 99', layerName: 'Preço' });
  for (const o of [img, rect, circ, t]) o.setCoords();
  editor.canvas.discardActiveObject(); editor.canvas.requestRenderAll(); editor.commit();
  Object.assign(window, { __img: img, __rect: rect, __circ: circ, __t: t });
})()`);
await p.sleep(500);

const boxes = (names) => p.evaluate(`[${names}].map((o) => { o.setCoords(); const b = o.getBoundingRect(); return [b.left, b.top, b.width, b.height]; })`);
const tapDoc = async (x, y) => {
  const c = await p.evaluate(`editor.docToClient(${x}, ${y})`);
  await p.touch('touchStart', c.x, c.y); await p.sleep(60); await p.touch('touchEnd', c.x, c.y); await p.sleep(450);
};
const layerBtn = (layer, cls) => `#sheet .layer[data-layer="${layer}"] button.${cls}`;

// ---------- 1. agrupar 3 objetos (seleção pelo painel Camadas) e mover juntos ----------
const before = await boxes('__rect, __circ, __t');
await p.tap('#topbar button', 'Camadas');
await p.tap('#sheet button', 'Selecionar Vários');
for (const name of ['Fundo preço', 'Selo', 'Preço']) {
  await p.evaluate(`(() => { const row = [...document.querySelectorAll('#sheet .layer')].find((l) => l.textContent.includes(${JSON.stringify(name)})); row.querySelector('input[type=checkbox]').setAttribute('data-e2e', 'cb'); })()`);
  await p.tap('[data-e2e=cb]');
}
await p.tap('#sheet button', 'Aplicar (3)');
r.check('seleção múltipla mostra "🔗 Agrupar"', await p.evaluate(`Boolean(document.querySelector('#props .group-btn'))`));
const nBefore = await p.evaluate('editor.canvas.getObjects().length');
await p.tap('#props .group-btn');
const grouped = await p.evaluate(`(() => { const a = editor.active; return { type: a?.type, n: a?.getObjects?.().length, layer: a?.layerName, total: editor.canvas.getObjects().length, ungroup: Boolean(document.querySelector('#props .ungroup-btn')) }; })()`);
r.check('Agrupar cria 1 Group com 3 filhos no lugar dos 3', grouped.type === 'group' && grouped.n === 3 && grouped.total === nBefore - 2 && grouped.layer === 'Grupo', JSON.stringify(grouped));
r.check('grupo selecionado mostra "🔓 Desagrupar"', grouped.ungroup);
// arrastar o grupo com o dedo (pela caixa do texto, que é parte do grupo)
const tc = await p.evaluate(`(() => { const b = editor.active.getBoundingRect(); return editor.docToClient(b.left + b.width / 2, b.top + b.height * 0.8); })()`);
await p.drag(tc.x, tc.y, tc.x + 40, tc.y + 25, { steps: 10 });
const zoom = await p.evaluate('editor.canvas.getZoom()');
screencap(`${out}/11-1-grupo.png`);
await p.tap('#props .ungroup-btn');
const after = await boxes('__rect, __circ, __t');
const dx = after[0][0] - before[0][0], dy = after[0][1] - before[0][1];
// tolerância = limiar do snapping magnético (TASK-01): 6 px de tela ÷ zoom
const snapTol = 6 / zoom + 2;
r.check('o grupo se moveu junto com o dedo (± snapping)', Math.abs(dx - 40 / zoom) <= snapTol && Math.abs(dy - 25 / zoom) <= snapTol, `dx=${dx.toFixed(1)} dy=${dy.toFixed(1)} esperado≈${(40 / zoom).toFixed(1)},${(25 / zoom).toFixed(1)}`);
r.check('Desagrupar devolve as 3 caixas exatas (mesmo deslocamento em todas)', after.every((b, i) => near(b, [before[i][0] + dx, before[i][1] + dy, before[i][2], before[i][3]])), JSON.stringify(after.map((b) => b.map(Math.round))));
const ung = await p.evaluate(`({ type: editor.active?.type, n: editor.active?.getObjects?.().length, total: editor.canvas.getObjects().length, groups: editor.canvas.getObjects().filter((o) => o.type === 'group').length })`);
r.check('após desagrupar: 3 objetos soltos e selecionados', ung.type === 'activeselection' && ung.n === 3 && ung.total === nBefore && ung.groups === 0, JSON.stringify(ung));
await p.evaluate('editor.flushPending()');
await p.evaluate('editor.undo()');
r.check('undo do desagrupar volta o grupo', (await p.evaluate(`editor.canvas.getObjects().filter((o) => o.type === 'group').length`)) === 1);
await p.evaluate('editor.redo()');
await p.sleep(300);
await p.evaluate(`(() => { const all = editor.canvas.getObjects(); Object.assign(window, { __rect: all.find((o) => o.layerName === 'Fundo preço'), __circ: all.find((o) => o.layerName === 'Selo'), __t: all.find((o) => o.layerName === 'Preço'), __img: all.find((o) => o.layerName === 'Foto') }); editor.canvas.discardActiveObject(); editor.canvas.requestRenderAll(); })()`);

// ---------- 2. cadeado nas Camadas: toque atravessa; sobrevive a undo/redo e a reabrir ----------
await p.tap('#topbar button', 'Camadas');
await p.tap(layerBtn('Fundo preço', 'lock'));
const lockState = await p.evaluate(`({ locked: __rect.locked, sel: __rect.selectable, ev: __rect.evented, icon: document.querySelector('#sheet .layer[data-layer="Fundo preço"] button.lock')?.textContent })`);
r.check('🔓→🔒 nas Camadas trava (não selecionável nem tocável)', lockState.locked === true && !lockState.sel && !lockState.ev && lockState.icon === '🔒', JSON.stringify(lockState));
screencap(`${out}/11-2-camadas.png`);
await p.tap('#sheet .sheet-head button');
const rc = await p.evaluate(`(() => { const c = __rect.getCenterPoint(); return [c.x, c.y]; })()`);
await tapDoc(rc[0], rc[1]);
const hit = await p.evaluate(`editor.active?.layerName ?? null`);
r.check('toque na camada travada atravessa e seleciona a foto embaixo', hit === 'Foto', String(hit));
// arrastar por cima não move a camada travada
await p.evaluate('editor.canvas.discardActiveObject(), editor.canvas.requestRenderAll()');
const rcl = await p.evaluate(`editor.docToClient(${rc[0]} + 40, ${rc[1]})`);
const rectBefore = await boxes('__rect');
await p.drag(rcl.x, rcl.y, rcl.x + 50, rcl.y + 50);
r.check('arrastar sobre a camada travada não a move', near((await boxes('__rect'))[0], rectBefore[0], 0.01));
await p.evaluate('editor.flushPending()');
await p.evaluate(`(async () => { await editor.undo(); await editor.redo(); })()`);
const afterUndo = await p.evaluate(`(() => { const o = editor.canvas.getObjects().find((x) => x.layerName === 'Fundo preço'); return { locked: o.locked, sel: o.selectable, ev: o.evented }; })()`);
r.check('trava sobrevive a undo/redo (loadFromJSON)', afterUndo.locked === true && !afterUndo.sel && !afterUndo.ev, JSON.stringify(afterUndo));
await p.evaluate(`(async () => { await editor.load(JSON.parse(JSON.stringify(editor.toDocument()))); })()`);
const afterLoad = await p.evaluate(`(() => { const o = editor.canvas.getObjects().find((x) => x.layerName === 'Fundo preço'); return { locked: o.locked, sel: o.selectable, ev: o.evented, json: JSON.stringify(editor.toDocument()).includes('"locked":true') }; })()`);
r.check('trava sobrevive a salvar/reabrir (vai no JSON)', afterLoad.locked === true && !afterLoad.sel && !afterLoad.ev && afterLoad.json, JSON.stringify(afterLoad));
await p.evaluate(`(() => { const all = editor.canvas.getObjects(); Object.assign(window, { __rect: all.find((o) => o.layerName === 'Fundo preço'), __circ: all.find((o) => o.layerName === 'Selo'), __t: all.find((o) => o.layerName === 'Preço'), __img: all.find((o) => o.layerName === 'Foto') }); })()`);
// ↑/↓ na lista e destravar
const order0 = await p.evaluate(`editor.canvas.getObjects().map((o) => o.layerName)`);
await p.tap('#topbar button', 'Camadas');
await p.tap(layerBtn('Selo', 'down'));
const order1 = await p.evaluate(`editor.canvas.getObjects().map((o) => o.layerName)`);
r.check('↓ desce a camada uma posição', order1.indexOf('Selo') === order0.indexOf('Selo') - 1, `${order0.join(',')} → ${order1.join(',')}`);
await p.tap(layerBtn('Selo', 'up'));
r.check('↑ sobe de volta', (await p.evaluate(`editor.canvas.getObjects().map((o) => o.layerName).join()`)) === order0.join());
await p.tap(layerBtn('Fundo preço', 'lock'));
await p.tap('#sheet .sheet-head button');
await tapDoc(rc[0], rc[1]);
r.check('destravado pelo painel: o toque volta a selecionar a camada', (await p.evaluate(`editor.active?.layerName`)) === 'Fundo preço');

// ---------- 3. inspetor numérico ----------
const cc = await p.evaluate(`(() => { const c = __circ.getCenterPoint(); return [c.x, c.y]; })()`);
await tapDoc(cc[0], cc[1]);
await p.tap('#props .geometry-btn');
const fullHeight = await p.evaluate('innerHeight');
const typeInto = async (field, value) => {
  await p.tap(`#sheet input[data-field="${field}"]`);
  await p.evaluate(`document.querySelector('#sheet input[data-field="${field}"]').select()`);
  await p.send('Input.insertText', { text: String(value) });
  await p.evaluate(`document.querySelector('#sheet input[data-field="${field}"]').blur()`);
  await p.waitFor(`innerHeight === ${fullHeight}`, 5000).catch(() => {}); // teclado fechou (o layout para de mexer)
  await p.sleep(300);
};
await typeInto('width', 200);
let g = await p.evaluate('editor.geometryOf(__circ)');
r.check('Largura 200 com proporção → 200×200', Math.abs(g.width - 200) < 0.5 && Math.abs(g.height - 200) < 0.5, JSON.stringify(g));
await typeInto('x', 100);
await typeInto('y', 120);
g = await p.evaluate('editor.geometryOf(__circ)');
r.check('X/Y exatos (canto da caixa em 100,120)', Math.abs(g.x - 100) < 0.5 && Math.abs(g.y - 120) < 0.5, JSON.stringify(g));
await p.tap('#sheet .angle-chip', '+45°');
g = await p.evaluate('editor.geometryOf(__circ)');
const fields = await p.evaluate(`Object.fromEntries([...document.querySelectorAll('#sheet input[data-field]')].map((i) => [i.dataset.field, i.type === 'checkbox' ? i.checked : i.value]))`);
r.check('chip +45° gira e o campo Ângulo mostra 45', Math.abs(g.angle - 45) < 0.01 && fields.angle === '45', JSON.stringify(fields));
screencap(`${out}/11-3-inspetor.png`);
await p.tap('#sheet input[data-field="keepRatio"]');
await typeInto('height', 90);
g = await p.evaluate('editor.geometryOf(__circ)');
r.check('sem proporção: só a altura muda (200×90)', Math.abs(g.width - 200) < 0.5 && Math.abs(g.height - 90) < 0.5, JSON.stringify(g));
await p.evaluate('editor.flushPending()');
await p.evaluate('editor.undo()');
const gu = await p.evaluate(`(() => { const o = editor.canvas.getObjects().find((x) => x.layerName === 'Selo'); return editor.geometryOf(o); })()`);
r.check('undo desfaz a última mudança do inspetor (altura volta a 200)', Math.abs(gu.height - 200) < 0.5 && Math.abs(gu.angle - 45) < 0.01, JSON.stringify(gu));
await p.tap('#sheet .sheet-head button');

// ---------- 4. substituir foto pela galeria (seletor do sistema) ----------
await p.evaluate(`(() => { window.__img = editor.canvas.getObjects().find((o) => o.layerName === 'Foto'); __img.set({ angle: 15, opacity: 0.9 }); __img.setCoords(); editor.commit(); })()`);
// sombra/filtro pelo próprio editor (mesmo caminho da UI): seleciona a foto e aplica
await p.tap('#topbar button', 'Camadas');
await p.tap('#sheet .layer[data-layer="Foto"] button.grow');
await p.evaluate(`(() => { editor.setShadow({ color: 'rgba(0,0,0,0.6)', blur: 12, offsetX: 6, offsetY: 6 }); editor.applyFilters(__img, 'grayscale', { brightness: 0, contrast: 0, saturation: 0, blur: 0 }); })()`);
const pre = await p.evaluate(`(() => { const c = __img.getCenterPoint(); return { src: __img.getSrc().slice(0, 30), cx: c.x, cy: c.y, w: __img.width * __img.scaleX, h: __img.height * __img.scaleY, angle: __img.angle, opacity: __img.opacity, shadow: __img.shadow?.blur, filters: __img.filters.length }; })()`);
await p.tap('#props .swap-btn');
await p.evaluate(`(() => { const s = document.querySelector('#sheet select'); s.value = 'cover'; s.dispatchEvent(new Event('change')); })()`);
await p.tap('#sheet .swap-gallery');
// seletor de fotos do Android: toca a 1ª foto
let picked = false;
for (let i = 0; i < 20 && !picked; i++) {
  await p.sleep(700);
  try { adbShell('uiautomator dump /data/local/tmp/ui.xml'); } catch { continue; }
  const xml = adbShell('cat /data/local/tmp/ui.xml');
  const m = /content-desc="(Photo taken|Foto tirada)[^"]*"[^>]*bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/.exec(xml);
  if (m) {
    screencap(`${out}/11-4-seletor.png`);
    adbShell(`input tap ${(Number(m[2]) + Number(m[4])) >> 1} ${(Number(m[3]) + Number(m[5])) >> 1}`);
    picked = true;
  }
}
r.check('seletor de fotos do sistema abriu e a 1ª foto foi tocada', picked);
await p.waitFor(`!__img.getSrc().startsWith('data:image/png;base64,iVBOR') || false`, 20000).catch(() => {});
await p.waitFor(`!document.getElementById('busy').classList.contains('show')`, 20000).catch(() => {});
await p.sleep(500);
const post = await p.evaluate(`(() => { const c = __img.getCenterPoint(); return { src: __img.getSrc().slice(0, 30), cx: c.x, cy: c.y, w: __img.width * __img.scaleX, h: __img.height * __img.scaleY, angle: __img.angle, opacity: __img.opacity, shadow: __img.shadow?.blur, filters: __img.filters.length, cropY: __img.cropY, cropX: __img.cropX }; })()`);
r.check('a foto foi trocada', post.src !== pre.src, `${pre.src} → ${post.src}`);
r.check('mesmo centro, rotação, opacidade, sombra e filtros', Math.abs(post.cx - pre.cx) < 0.5 && Math.abs(post.cy - pre.cy) < 0.5 && post.angle === pre.angle && post.opacity === pre.opacity && post.shadow === pre.shadow && post.filters === pre.filters, JSON.stringify({ pre, post }));
r.check('"Preencher o espaço": mesmo tamanho visual exato, excesso recortado', Math.abs(post.w - pre.w) < 0.5 && Math.abs(post.h - pre.h) < 0.5 && (post.cropX > 0 || post.cropY > 0), JSON.stringify(post));
screencap(`${out}/11-5-trocada.png`);

r.check('sem exceções JS no console', !p.logs.some((l) => l.startsWith('EXCEPTION')), p.logs.filter((l) => l.startsWith('EXCEPTION')).join(' | '));
r.done();
p.close();
