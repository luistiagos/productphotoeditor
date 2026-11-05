// E2E TASK-14 (☰ Lista, 🔍 Localizar e substituir, ✍️ Desenhar à mão) no app real.
// Uso: ANDROID_SERIAL=emulator-5554 node tools/e2e/task14.mjs <pasta-de-prints>
// Toques reais nos botões e no canvas (o traço é desenhado arrastando o dedo). Campos de texto e <input type=color/range>
// recebem o valor por evento (o teclado e o seletor nativo não são elementos da página).
import { launchEditor, reporter, screencap } from './cdp.mjs';

const out = process.argv[2] ?? '.';
const p = await launchEditor();
const r = reporter('TASK-14 — listas, localizar/substituir, desenho à mão');
const near = (a, b, tol) => Math.abs(a - b) <= tol;
const fullHeight = await p.evaluate('innerHeight');

/** Valor num campo da folha (dispara `input`), tira o foco e espera o teclado fechar (o layout para de mexer). */
const typeInto = async (selector, value) => {
  await p.evaluate(`(() => { const e = document.querySelector(${JSON.stringify(selector)}); e.value = ${JSON.stringify(value)};
    e.dispatchEvent(new Event('input')); return e.value; })()`);
};
const blurAll = async () => {
  await p.evaluate('document.activeElement && document.activeElement.blur && document.activeElement.blur()');
  await p.waitFor(`innerHeight === ${fullHeight}`, 6000).catch(() => {});
  // o teclado fecha animando: espera a folha parar de mexer (mesma posição em 2 leituras seguidas)
  let last = '';
  for (let i = 0; i < 20; i++) {
    const now = await p.evaluate(`JSON.stringify(document.querySelector('#sheet .panel')?.getBoundingClientRect() ?? null) + innerHeight`);
    if (now === last) break;
    last = now;
    await p.sleep(200);
  }
};
const setColor = (root, label, value) => p.evaluate(`(() => {
  const l = [...document.querySelectorAll('${root} label.color')].find((x) => x.textContent.includes(${JSON.stringify(label)}));
  const s = l.querySelector('input'); s.value = ${JSON.stringify(value)}; s.dispatchEvent(new Event('input')); return s.value; })()`);
const setRange = (root, label, value) => p.evaluate(`(() => {
  const l = [...document.querySelectorAll('${root} label.slider')].find((x) => x.textContent.includes(${JSON.stringify(label)}));
  const s = l.querySelector('input'); s.value = ${JSON.stringify(String(value))}; s.dispatchEvent(new Event('input'));
  s.dispatchEvent(new Event('change')); return { value: Number(s.value), min: Number(s.min), max: Number(s.max) }; })()`);
const closeSheet = async () => { await p.tap('#sheet .sheet-head button'); await p.sleep(200); };
const undo = async () => { await p.sleep(400); await p.tap('#topbar button', '↶'); await p.sleep(500); }; // debounce de 250 ms do instantâneo
const clearPage = () => p.evaluate(`(() => { editor.canvas.discardActiveObject(); for (const o of editor.canvas.getObjects().filter((o) => o.layerName !== 'background')) editor.canvas.remove(o); editor.canvas.requestRenderAll(); })()`);

await p.evaluate(`(async () => { await editor.newDocument('E2E 14', 1080, 1080); editor.canvas.requestRenderAll(); })()`);
await p.sleep(400);

// ---------- 1. ☰ Lista ----------
const BENEFITS = 'Frete Grátis\nGarantia de 1 Ano\nEnvio em 24h';
await p.tap('#tabs button', 'Texto');
await p.tap('#sheet button', 'Adicionar texto');
await p.sleep(300);
await p.tap('#props button', '✏️ Editar texto');
await typeInto('#sheet textarea', BENEFITS);
await blurAll();
await p.tap('#sheet button', 'Aplicar');
await p.sleep(300);
const txt = () => p.evaluate('editor.active?.text ?? null');
r.check('texto de 3 linhas pela edição normal', (await txt()) === BENEFITS, JSON.stringify(await txt()));
r.check('painel do texto tem "☰ Lista"', await p.evaluate(`Boolean(document.querySelector('#props .list-btn'))`));
await p.tap('#props .list-btn');
r.check('folha ☰ Lista com os 6 estilos e "Sem marcador" ativo', await p.evaluate(`document.querySelectorAll('#sheet .list-style').length === 6
  && document.querySelector('#sheet .list-style.primary')?.dataset.style === 'none'`));
const expected = {
  bullet: '• Frete Grátis\n• Garantia de 1 Ano\n• Envio em 24h',
  check: '✓ Frete Grátis\n✓ Garantia de 1 Ano\n✓ Envio em 24h',
  fire: '🔥 Frete Grátis\n🔥 Garantia de 1 Ano\n🔥 Envio em 24h',
  star: '⭐ Frete Grátis\n⭐ Garantia de 1 Ano\n⭐ Envio em 24h',
  numbered: '1. Frete Grátis\n2. Garantia de 1 Ano\n3. Envio em 24h',
};
for (const style of ['bullet', 'check', 'fire', 'star', 'numbered']) {
  await p.tap(`#sheet .list-style[data-style="${style}"]`);
  const t = await txt();
  const active = await p.evaluate(`document.querySelector('#sheet .list-style.primary')?.dataset.style`);
  r.check(`toque em "${style}": cada linha com um único marcador e o chip ativo`, t === expected[style] && active === style, JSON.stringify(t));
}
const lines = await p.evaluate('editor.active.textLines.length');
r.check('o Textbox continua com 3 linhas (marcador não quebra a linha)', lines === 3, String(lines));
await p.tap('#sheet .list-style[data-style="numbered"]');
r.check('tocar no estilo ativo (numerada) tira os marcadores', (await txt()) === BENEFITS, JSON.stringify(await txt()));
await p.tap('#sheet .list-style[data-style="check"]');
await closeSheet();
await p.evaluate('(editor.canvas.discardActiveObject(), editor.canvas.requestRenderAll())');
await p.sleep(300);
screencap(`${out}/14-1-checklist.png`);
// undo: a lista aplicada é uma entrada de undo
await p.evaluate(`editor.canvas.setActiveObject(editor.canvas.getObjects().find((o) => o.type === 'textbox'))`);
await p.evaluate('editor.onSelection(editor.active)');
await p.tap('#props .list-btn');
await p.tap('#sheet .list-style[data-style="fire"]');
await closeSheet();
await undo();
const afterUndo = await p.evaluate(`editor.canvas.getObjects().find((o) => o.type === 'textbox').text`);
r.check('↶ desfaz a troca de estilo (🔥 → ✓)', afterUndo === expected.check, JSON.stringify(afterUndo));
await p.evaluate(`(() => { const t = editor.canvas.getObjects().find((o) => o.type === 'textbox'); editor.canvas.setActiveObject(t); editor.applyListStyle('none', t); })()`);
await p.sleep(300);
const persistedList = await p.evaluate(`(async () => { const t = editor.canvas.getObjects().find((o) => o.type === 'textbox'); editor.applyListStyle('star', t);
  await editor.load(editor.toDocument()); return editor.canvas.getObjects().find((o) => o.type === 'textbox').text; })()`);
r.check('lista com emoji sobrevive a salvar/reabrir', persistedList === expected.star, JSON.stringify(persistedList));

// ---------- 2. 🔍 Localizar e substituir ----------
await clearPage();
const ids = await p.evaluate(`(() => {
  const mk = (kind, text, x, y) => { const t = editor.addText(kind, 'Montserrat'); t.set({ text, left: x, top: y }); t.setCoords(); return t; };
  const t1 = mk('title', 'Oferta de Natal\\nDe R$ 199,90', 540, 200);
  const t2 = mk('subtitle', 'NATAL', 300, 560);
  const t3 = mk('body', 'R$ 199,90 à vista', 300, 680);
  mk('body', 'Frete grátis', 540, 960);
  mk('body', 'Pix: R$ 199,90', 780, 820);
  editor.selectMultiple([t2, t3]);
  const g = editor.groupActive();
  editor.canvas.discardActiveObject(); editor.canvas.requestRenderAll();
  return { group: g?.type, objects: editor.canvas.getObjects().filter((o) => o.layerName !== 'background').length };
})()`);
r.check('cenário: 4 camadas no topo (uma é Group com 2 textos)', ids.group === 'group' && ids.objects === 4, JSON.stringify(ids));
await p.sleep(400);
const texts = () => p.evaluate(`(() => { const all = []; const walk = (l) => { for (const o of l) { if (typeof o.text === 'string') all.push(o.text); else if (o.getObjects) walk(o.getObjects()); } }; walk(editor.canvas.getObjects()); return all; })()`);
const openFind = async () => {
  await p.tap('#tabs button', 'Texto');
  await p.tap('#sheet .find-replace-btn');
  await p.sleep(300);
};
const count = () => p.evaluate(`(() => { const c = document.querySelector('#sheet .find-count'); return { matches: Number(c.dataset.matches), layers: Number(c.dataset.layers), label: c.textContent, hits: document.querySelectorAll('#sheet .find-hit').length, disabled: document.querySelector('#sheet .replace-all').disabled }; })()`);
await openFind();
r.check('Texto → "🔍 Localizar e substituir…" abre a folha com os campos', await p.evaluate(`Boolean(document.querySelector('#sheet .find-input') && document.querySelector('#sheet .replace-input') && document.querySelector('#sheet .match-case'))`));
let c = await count();
r.check('sem termo: contador pede o texto e "Substituir tudo" fica desabilitado', c.matches === 0 && c.disabled, c.label);
await typeInto('#sheet .find-input', 'R$ 199,90');
c = await count();
r.check('contador ao vivo: "R$ 199,90" → 3 ocorrências em 3 camadas (uma dentro do Group)', c.matches === 3 && c.layers === 3 && c.hits === 3 && !c.disabled, c.label);
await typeInto('#sheet .replace-input', 'R$ 149,90');
await blurAll();

await p.tap('#sheet .replace-all');
await p.sleep(300);
let t = await texts();
r.check('"Substituir tudo": as 3 camadas trocam o preço ($ literal), inclusive no Group', t.filter((x) => x.includes('R$ 149,90')).length === 3 && !t.some((x) => x.includes('199,90')), JSON.stringify(t));
c = await count();
r.check('depois de trocar, o contador zera ("Nada encontrado")', c.matches === 0 && c.label === 'Nada encontrado', c.label);
await closeSheet();
await p.evaluate('(editor.canvas.discardActiveObject(), editor.canvas.requestRenderAll())');
await p.sleep(200);
screencap(`${out}/14-2-substituido.png`);
await undo();
t = await texts();
r.check('Undo em 1 toque reverte as 3 trocas juntas', t.filter((x) => x.includes('R$ 199,90')).length === 3 && !t.some((x) => x.includes('149,90')), JSON.stringify(t));
await p.tap('#topbar button', '↷');
await p.sleep(500);
t = await texts();
r.check('↷ refaz as 3 trocas', t.filter((x) => x.includes('R$ 149,90')).length === 3, JSON.stringify(t));
// diferenciar maiúsculas e troca individual
await openFind();
await typeInto('#sheet .find-input', 'Natal');
c = await count();
r.check('"Natal" sem diferenciar maiúsculas → 2 camadas ("Natal" e "NATAL")', c.matches === 2 && c.layers === 2, c.label);
await blurAll();
await p.tap('#sheet .match-case');
c = await count();
r.check('☑ Diferenciar maiúsculas → 1 ocorrência em 1 camada', c.matches === 1 && c.layers === 1 && c.hits === 1, c.label);
await typeInto('#sheet .replace-input', 'Black Friday');
await blurAll();
await p.tap('#sheet .replace-one');
await p.sleep(300);
t = await texts();
r.check('"Trocar" só naquela camada: "Oferta de Black Friday", "NATAL" fica', t.includes('Oferta de Black Friday\nDe R$ 149,90') && t.includes('NATAL'), JSON.stringify(t));
await p.tap('#sheet .match-case');
c = await count();
r.check('desmarcar → sobra 1 ("NATAL")', c.matches === 1 && c.layers === 1, c.label);
await p.tap('#sheet .replace-all');
await p.sleep(300);
t = await texts();
r.check('"Substituir tudo" troca o "NATAL" do Group', t.filter((x) => x === 'Black Friday').length === 1 && !t.some((x) => /natal/i.test(x)), JSON.stringify(t));
// texto mais longo dentro do Group: a caixa do grupo acompanha
const groupBefore = await p.evaluate(`(() => { const g = editor.canvas.getObjects().find((o) => o.type === 'group'); const k = g.getObjects()[1]; const c = k.getCenterPoint(); return { w: g.width, h: g.height, cx: c.x, cy: c.y, kh: k.height }; })()`);
await typeInto('#sheet .find-input', 'à vista');
await typeInto('#sheet .replace-input', 'à vista no Pix ou no boleto bancário');
await blurAll();
await p.tap('#sheet .replace-all');
await p.sleep(300);
const groupAfter = await p.evaluate(`(() => { const g = editor.canvas.getObjects().find((o) => o.type === 'group'); g.setCoords(); const gb = g.getBoundingRect();
  const kids = g.getObjects().map((k) => { k.setCoords(); return k.getBoundingRect(); });
  const inside = kids.every((k) => k.left >= gb.left - 1 && k.top >= gb.top - 1 && k.left + k.width <= gb.left + gb.width + 1 && k.top + k.height <= gb.top + gb.height + 1);
  const k = g.getObjects()[1]; const c = k.getCenterPoint();
  return { w: g.width, h: g.height, inside, cx: c.x, cy: c.y, kh: k.height, text: g.getObjects().map((k) => k.text) }; })()`);
const grew = groupAfter.kh - groupBefore.kh;
r.check('texto que quebra linha dentro do Group: fica no lugar (mesmo centro) e a caixa do grupo cresce só o que o texto cresceu',
  grew > 40 && near(groupAfter.cx, groupBefore.cx, 2) && near(groupAfter.cy, groupBefore.cy, 2) && near(groupAfter.h - groupBefore.h, grew / 2, grew / 2 + 2) && groupAfter.inside,
  JSON.stringify({ groupBefore, groupAfter }));
await closeSheet();

// ---------- 3. ✍️ Desenhar à mão ----------
await clearPage();
await p.sleep(400);
await p.tap('#tabs button', 'Formas');
r.check('Formas tem "✍️ Desenhar à mão"', await p.evaluate(`Boolean(document.querySelector('#sheet .draw-btn'))`));
await p.tap('#sheet .draw-btn');
await p.sleep(500); // a barra entra no #props: o palco encolhe e o canvas refaz o zoom
const bar = await p.evaluate(`({ drawing: editor.canvas.isDrawingMode, mode: editor.isFreehandDrawing, pens: [...document.querySelectorAll('#props .pen')].map((b) => b.dataset.pen),
  active: document.querySelector('#props .pen.primary')?.dataset.pen, brush: editor.freehandBrush(), decimate: editor.canvas.freeDrawingBrush.decimate,
  undo: document.querySelector('#props .undo-stroke')?.disabled, finish: Boolean(document.querySelector('#props .finish-draw')) })`);
r.check('barra de desenho: 4 canetas, Circula-oferta ativa (#e53935, 13 px), decimate 2,5, Desfazer desabilitado, Concluir',
  bar.drawing && bar.mode && bar.pens.join() === 'offer,highlighter,fine,fine-white' && bar.active === 'offer' && bar.brush.color === '#e53935'
  && bar.brush.width === 13 && bar.decimate === 2.5 && bar.undo === true && bar.finish, JSON.stringify(bar));

/** Pontos de tela (CSS px) para uma curva em coordenadas do documento. */
const docPts = (fn, n) => p.evaluate(`(() => { const f = ${fn}; const out = []; for (let i = 0; i <= ${n}; i++) { const [x, y] = f(i / ${n}); out.push(editor.docToClient(x, y)); } return out; })()`);
const strokeAlong = async (pts) => {
  await p.touch('touchStart', pts[0].x, pts[0].y);
  for (const q of pts.slice(1)) { await p.touch('touchMove', q.x, q.y); await p.sleep(12); }
  await p.touch('touchEnd', pts[pts.length - 1].x, pts[pts.length - 1].y);
  await p.sleep(350);
};
const paths = () => p.evaluate(`editor.canvas.getObjects().filter((o) => o.type === 'path').map((o) => { o.setCoords(); const b = o.getBoundingRect();
  return { name: o.layerName, stroke: o.stroke, sw: o.strokeWidth, fill: o.fill, sel: o.selectable, ev: o.evented, cmds: o.path.length, cx: b.left + b.width / 2, cy: b.top + b.height / 2, w: b.width, h: b.height }; })`);

// círculo em volta de um "preço" (centro 540,700; raios 150 × 110)
const circle = await docPts('(t) => [540 + 150 * Math.cos(2 * Math.PI * t), 700 + 110 * Math.sin(2 * Math.PI * t)]', 48);
await strokeAlong(circle);
let ps = await paths();
const c1 = ps[0];
r.check('o dedo desenha: 1 Path "Traço à mão" vermelho, 13 px, sem preenchimento, selecionável',
  ps.length === 1 && c1.name === 'Traço à mão' && c1.stroke === '#e53935' && c1.sw === 13 && c1.fill === null && c1.sel && c1.ev, JSON.stringify(ps));
r.check('o traço segue o dedo: caixa ≈ 300 × 220 (+ espessura) centrada em (540, 700)',
  near(c1.cx, 540, 12) && near(c1.cy, 700, 12) && near(c1.w, 313, 20) && near(c1.h, 233, 20), JSON.stringify(c1));
r.check('a barra continua aberta depois do toque no canvas e conta 1 traço', await p.evaluate(`document.querySelector('#props .undo-stroke')?.dataset.count === '1' && !document.querySelector('#props .undo-stroke').disabled`));

// marca-texto: traço horizontal largo e translúcido
await p.tap('#props .pen[data-pen="highlighter"]');
const hl = await p.evaluate('editor.freehandBrush()');
r.check('Marca-texto: rgba(255, 235, 59, 0.45) e 43 px', hl.color === 'rgba(255, 235, 59, 0.45)' && hl.width === 43, JSON.stringify(hl));
const swatch = await p.evaluate(`[...document.querySelectorAll('#props label.color input')][0].value`);
r.check('o seletor de cor mostra o amarelo (não preto) para a cor com alfa', swatch === '#ffeb3b', swatch);
await strokeAlong(await docPts('(t) => [260 + 560 * t, 300]', 30));
ps = await paths();
const px = await p.evaluate(`(() => { const { canvas, scale } = editor.renderPageCanvas(1080); const x = canvas.getContext('2d');
  return [...x.getImageData(Math.round(540 * scale), Math.round(300 * scale), 1, 1).data].slice(0, 3); })()`);
r.check('render do marca-texto sobre o branco: amarelo claro translúcido (≈ 255, 246, 167)', near(px[0], 255, 6) && near(px[1], 246, 8) && near(px[2], 167, 14), JSON.stringify(px));
await setColor('#props', 'Cor', '#00ff00');
r.check('trocar a cor no seletor mantém o alfa do marca-texto', (await p.evaluate('editor.freehandBrush().color')) === 'rgba(0, 255, 0, 0.45)', await p.evaluate('editor.freehandBrush().color'));
const range = await setRange('#props', 'Espessura', 30);
r.check('slider Espessura muda o pincel (30 px)', (await p.evaluate('editor.freehandBrush().width')) === 30, JSON.stringify(range));

// caneta fina: "assinatura" com passos curtos → o decimate descarta pontos
await p.tap('#props .pen[data-pen="fine"]');
const sig = await docPts('(t) => [300 + 480 * t, 900 + 40 * Math.sin(t * 6 * Math.PI)]', 160);
await strokeAlong(sig);
ps = await paths();
const fine = ps[2];
r.check('Caneta fina: 3º traço preto 5 px; o decimate deixa menos segmentos que toques', ps.length === 3 && fine.stroke === '#111111' && fine.sw === 5 && fine.cmds < sig.length, `${fine?.cmds} cmds / ${sig.length} toques`);
await p.evaluate('(editor.canvas.requestRenderAll())');
screencap(`${out}/14-3-desenho.png`);
await p.tap('#props .undo-stroke');
ps = await paths();
r.check('"Desfazer traço" tira só o último (a assinatura) e o contador vai a 2', ps.length === 2 && ps.every((x) => x.sw !== 5)
  && (await p.evaluate(`document.querySelector('#props .undo-stroke').dataset.count`)) === '2', JSON.stringify(ps.map((x) => x.sw)));
// ↶ da barra durante o desenho: o traço some e a sessão continua contando certo (objetos recriados pelo JSON)
await undo();
const afterBarUndo = await p.evaluate(`({ paths: editor.canvas.getObjects().filter((o) => o.type === 'path').length, count: document.querySelector('#props .undo-stroke')?.dataset.count, drawing: editor.canvas.isDrawingMode })`);
r.check('↶ da barra durante o desenho volta o "Desfazer traço" (assinatura de volta) e o contador acompanha (3)', afterBarUndo.paths === 3 && afterBarUndo.count === '3' && afterBarUndo.drawing, JSON.stringify(afterBarUndo));
await p.tap('#props .undo-stroke');
await p.tap('#props .finish-draw');
await p.sleep(300);
const fin = await p.evaluate(`(() => { const a = editor.active; return { drawing: editor.canvas.isDrawingMode, mode: editor.isFreehandDrawing, type: a?.type, n: a?.type === 'activeselection' ? a.getObjects().length : a ? 1 : 0,
  group: Boolean(document.querySelector('#props .group-btn')) }; })()`);
r.check('Concluir: sai do modo desenho e os 2 traços ficam selecionados juntos (🔗 Agrupar à mão)', !fin.drawing && !fin.mode && fin.type === 'activeselection' && fin.n === 2 && fin.group, JSON.stringify(fin));

// camadas normais: tocar seleciona, arrastar move, a alça redimensiona
await p.evaluate('(editor.canvas.discardActiveObject(), editor.canvas.requestRenderAll())');
await p.sleep(200);
const ctr = await p.evaluate('editor.docToClient(540, 700)');
await p.touch('touchStart', ctr.x, ctr.y); await p.sleep(60); await p.touch('touchEnd', ctr.x, ctr.y); await p.sleep(400);
const selected = await p.evaluate(`({ name: editor.active?.layerName, stroke: editor.active?.stroke, props: Boolean(document.querySelector('#props .freehand-props')),
  labels: [...document.querySelectorAll('#props .freehand-props label')].map((l) => l.textContent) })`);
r.check('tocar no círculo seleciona o traço; painel próprio (Cor do traço, Espessura), sem "Preenchimento"',
  selected.name === 'Traço à mão' && selected.stroke === '#e53935' && selected.props && selected.labels.some((l) => l.includes('Cor do traço'))
  && !(await p.evaluate(`[...document.querySelectorAll('#props label')].some((l) => l.textContent.includes('Preenchimento'))`)), JSON.stringify(selected));
// selecionar abre o painel: o palco encolhe e o zoom muda → o ponto de toque se recalcula depois
await p.sleep(300);
const before = await p.evaluate('(() => { const c = editor.active.getCenterPoint(); const s = editor.docToClient(c.x, c.y); return { x: c.x, y: c.y, sx: s.x, sy: s.y, zoom: editor.canvas.getZoom() }; })()');
await p.drag(before.sx, before.sy, before.sx + 60, before.sy - 40, { steps: 14 });
const moved = await p.evaluate('(() => { const c = editor.active.getCenterPoint(); return { x: c.x, y: c.y }; })()');
const tol = 8 / before.zoom;
r.check('arrastar move o traço (≈ 60, −40 px de tela)', near(moved.x - before.x, 60 / before.zoom, tol) && near(moved.y - before.y, -40 / before.zoom, tol),
  JSON.stringify({ before, moved }));
const br = await p.evaluate(`(() => { const o = editor.active; o.setCoords(); const r = editor.canvas.upperCanvasEl.getBoundingClientRect(); return { x: r.left + o.oCoords.br.x, y: r.top + o.oCoords.br.y, s: o.scaleX }; })()`);
await p.drag(br.x, br.y, br.x + 50, br.y + 36, { steps: 12 });
const scaled = await p.evaluate('editor.active.scaleX');
r.check('a alça do canto redimensiona o traço', scaled > br.s * 1.1, `${br.s} → ${scaled}`);
await setRange('#props', 'Espessura', 24);
r.check('Espessura no painel do traço selecionado (24)', (await p.evaluate('editor.active.strokeWidth')) === 24);
// o marca-texto selecionado mantém o alfa ao trocar a cor
await p.evaluate(`(() => { const o = editor.canvas.getObjects().find((o) => o.type === 'path' && String(o.stroke).startsWith('rgba')); editor.canvas.setActiveObject(o); editor.onSelection(o); })()`);
await p.sleep(200);
await setColor('#props', 'Cor do traço', '#ff00ff');
r.check('trocar a cor do marca-texto selecionado mantém o alfa', (await p.evaluate('editor.active.stroke')) === 'rgba(255, 0, 255, 0.45)', await p.evaluate('editor.active.stroke'));
await p.evaluate('(editor.canvas.discardActiveObject(), editor.canvas.requestRenderAll())');
await p.sleep(300);
screencap(`${out}/14-4-tracos-editados.png`);

// persistem e aparecem nas Camadas
const persisted = await p.evaluate(`(async () => { await editor.load(editor.toDocument()); return editor.canvas.getObjects().filter((o) => o.type === 'path').map((o) => ({ name: o.layerName, stroke: o.stroke, sw: o.strokeWidth, sel: o.selectable })); })()`);
r.check('traços sobrevivem a salvar/reabrir (nome, cor com alfa, espessura, selecionáveis)', persisted.length === 2 && persisted.every((x) => x.name === 'Traço à mão' && x.sel)
  && persisted.some((x) => x.stroke === 'rgba(255, 0, 255, 0.45)') && persisted.some((x) => x.sw === 24), JSON.stringify(persisted));
await p.tap('#topbar button', 'Camadas');
r.check('painel Camadas lista 2 × "Traço à mão"', (await p.evaluate(`document.querySelectorAll('#sheet [data-layer="Traço à mão"]').length`)) === 2);
await closeSheet();

// trocar de aba conclui o desenho
await p.tap('#tabs button', 'Formas');
await p.tap('#sheet .draw-btn');
await p.sleep(500);
await strokeAlong(await docPts('(t) => [200 + 200 * t, 150 + 60 * t]', 20));
await p.tap('#tabs button', 'Texto');
const tabEnd = await p.evaluate(`({ drawing: editor.canvas.isDrawingMode, mode: editor.isFreehandDrawing, sheet: document.querySelector('#sheet .sheet-head strong')?.textContent, paths: editor.canvas.getObjects().filter((o) => o.type === 'path').length, active: editor.active?.layerName })`);
r.check('tocar noutra aba conclui o desenho (traço novo fica, selecionado; abre a folha Texto)', !tabEnd.drawing && !tabEnd.mode && tabEnd.sheet === 'Texto' && tabEnd.paths === 3 && tabEnd.active === 'Traço à mão', JSON.stringify(tabEnd));
await closeSheet();
// o toque longo num texto não abre a edição em modo desenho (o pincel ganha)
await p.evaluate(`(() => { const t = editor.addText('title', 'Montserrat'); t.set({ text: 'Toque longo', left: 540, top: 540 }); t.setCoords(); editor.canvas.discardActiveObject(); })()`);
await p.tap('#tabs button', 'Formas');
await p.tap('#sheet .draw-btn');
await p.sleep(500);
const tc = await p.evaluate('editor.docToClient(540, 540)');
await p.drag(tc.x, tc.y, tc.x + 3, tc.y + 2, { steps: 4, holdMs: 900 });
const lp = await p.evaluate(`({ sheet: document.querySelector('#sheet.show .sheet-head strong')?.textContent ?? null, drawing: editor.canvas.isDrawingMode })`);
r.check('em modo desenho, segurar o dedo sobre um texto não abre "Editar texto"', lp.sheet !== 'Editar texto' && lp.drawing, JSON.stringify(lp));
await p.tap('#props .finish-draw');

r.check('sem exceções JS no console', !p.logs.some((l) => l.startsWith('EXCEPTION')), p.logs.filter((l) => l.startsWith('EXCEPTION')).join(' | '));
r.done();
p.close();
