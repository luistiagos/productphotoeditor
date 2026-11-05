// E2E TASK-12 (degradê multi-stop, borda tracejada, cantos, trocar forma, setas/cotas/Raio-X) no app real.
// Uso: ANDROID_SERIAL=emulator-5554 node tools/e2e/task12.mjs <pasta-de-prints>
// Toques reais nos botões; <select> e <input type=range/color> recebem o valor por evento (o seletor nativo do Android
// não é um elemento da página).
import { launchEditor, reporter, screencap } from './cdp.mjs';

const out = process.argv[2] ?? '.';
const p = await launchEditor();
const r = reporter('TASK-12 — degradê, contorno, cantos, troca de forma, conectores');
const close = (a, b, tol = 0.6) => Math.abs(a - b) <= tol;

const setSelect = (label, value) => p.evaluate(`(() => {
  const l = [...document.querySelectorAll('#props label, #sheet label')].find((x) => x.querySelector('select') && x.textContent.includes(${JSON.stringify(label)}));
  const s = l.querySelector('select'); s.value = ${JSON.stringify(value)}; s.dispatchEvent(new Event('change')); return s.value; })()`);
const setRange = (root, label, value, commit = true) => p.evaluate(`(() => {
  const l = [...document.querySelectorAll('${root} label.slider')].find((x) => x.textContent.includes(${JSON.stringify(label)}));
  const s = l.querySelector('input'); s.value = ${JSON.stringify(String(value))}; s.dispatchEvent(new Event('input'));
  ${commit ? "s.dispatchEvent(new Event('change'));" : ''} return { value: Number(s.value), max: Number(s.max) }; })()`);
const setColor = (root, label, value) => p.evaluate(`(() => {
  const l = [...document.querySelectorAll('${root} label.color')].find((x) => x.textContent.includes(${JSON.stringify(label)}));
  const s = l.querySelector('input'); s.value = ${JSON.stringify(value)}; s.dispatchEvent(new Event('input')); return s.value; })()`);
const closeSheet = async () => { await p.tap('#sheet .sheet-head button'); await p.sleep(200); };
const fillInfo = `(() => { const o = editor.active; const f = o.fill; return { type: o.type, gtype: f?.type ?? null, isGrad: typeof f === 'object' && f !== null && 'colorStops' in f,
  stops: f?.colorStops?.map((s) => s.color) ?? null, coords: f?.coords ?? null, spec: o.customGradient ?? null, w: o.width, h: o.height, fill: typeof f === 'string' ? f : null }; })()`;
/** coords lineares esperadas (mesma fórmula de gradients.ts::gradientCoords). */
const linCoords = (angle, w, h) => {
  const a = (angle * Math.PI) / 180, c = Math.cos(a), s = Math.sin(a), half = (Math.abs(c) * w + Math.abs(s) * h) / 2;
  return { x1: w / 2 - c * half, y1: h / 2 - s * half, x2: w / 2 + c * half, y2: h / 2 + s * half };
};
const coordsMatch = (got, exp) => ['x1', 'y1', 'x2', 'y2'].every((k) => close(got[k], exp[k], 0.05));

await p.evaluate(`(async () => { await editor.newDocument('E2E 12', 1080, 1080); editor.canvas.requestRenderAll(); })()`);
await p.sleep(400);

// ---------- 1. degradê numa forma ----------
await p.tap('#tabs button', 'Formas');
await p.tap('#sheet button', '▬ Retângulo');
await p.sleep(300);
r.check('Formas → Retângulo cria o Rect selecionado com "🌈 Degradê", "Borda", "Cantos" e "🔄 Trocar forma"', await p.evaluate(`editor.active?.type === 'rect'
  && Boolean(document.querySelector('#props .gradient-btn')) && Boolean(document.querySelector('#props .swap-shape-btn'))
  && [...document.querySelectorAll('#props label')].some((l) => l.textContent.includes('Borda'))
  && [...document.querySelectorAll('#props label.slider')].some((l) => l.textContent.includes('Cantos'))`));
await p.tap('#props .gradient-btn');
let f = await p.evaluate(fillInfo);
r.check('abrir o editor aplica um degradê linear de 2 cores (90°)', f.isGrad && f.gtype === 'linear' && f.stops.length === 2 && f.spec?.angle === 90, JSON.stringify(f.stops));
await p.tap('#sheet .preset[data-preset="Ouro Metálico"]');
f = await p.evaluate(fillInfo);
r.check('preset Ouro Metálico: #bf953f → #fcf6ba → #b38728', JSON.stringify(f.stops) === JSON.stringify(['#bf953f', '#fcf6ba', '#b38728']));
await p.tap('#sheet .angle-chip', '→ 0°');
f = await p.evaluate(fillInfo);
r.check('chip → 0°: coords de borda a borda na horizontal', f.spec.angle === 0 && coordsMatch(f.coords, linCoords(0, f.w, f.h)), JSON.stringify(f.coords));
const ang = await setRange('#sheet', 'Ângulo', 30, false);
f = await p.evaluate(fillInfo);
r.check('slider Ângulo 30°: coords = meia-projeção da caixa em 30°', f.spec.angle === 30 && coordsMatch(f.coords, linCoords(30, f.w, f.h)), `${ang.value} ${JSON.stringify(f.coords)}`);
// pixels: com 0° a esquerda é ouro escuro e o meio é claro
await p.tap('#sheet .angle-chip', '→ 0°');
const px = await p.evaluate(`(() => { const o = editor.active; o.setCoords(); const b = o.getBoundingRect();
  const { canvas, scale } = editor.renderPageCanvas(1080); const x = canvas.getContext('2d');
  const at = (u, v) => [...x.getImageData(Math.round(u * scale), Math.round(v * scale), 1, 1).data].slice(0, 3);
  return { left: at(b.left + 4, b.top + b.height / 2), mid: at(b.left + b.width / 2, b.top + b.height / 2) }; })()`);
r.check('render: a borda esquerda é escura e o meio é claro (o degradê pinta de fato)', px.left[2] < 100 && px.mid[2] > 150 && px.mid[0] > px.left[0], JSON.stringify(px));
await p.tap('#sheet button', '+ Cor');
f = await p.evaluate(fillInfo);
r.check('+ Cor: 4 paradas', f.stops.length === 4 && f.spec.stops.length === 4);
await p.tap('#sheet .remove-stop');
f = await p.evaluate(fillInfo);
r.check('✕ numa parada: volta a 3', f.stops.length === 3);
await setColor('#sheet', 'Cor 1', '#ff0000');
await p.tap('#sheet .reverse-btn');
f = await p.evaluate(fillInfo);
// após ✕ na 1ª parada sobram [0,25 · 0,5 · 1]; a Cor 1 (0,25) vira vermelha e o ⇄ a leva a 0,75
r.check('cor da parada 1 trocada e ⇄ Inverter: vermelho vai de 0,25 para 0,75', f.stops[f.stops.length - 1] === '#ff0000' && f.spec.stops[2].offset === 0.75 && f.spec.stops[0].color === '#b38728', JSON.stringify(f.spec.stops));
await p.tap('#sheet .type-radial');
f = await p.evaluate(fillInfo);
r.check('Radial: Gradient radial centrado, r2 = 0,7 × maior lado', f.gtype === 'radial' && close(f.coords.x1, f.w / 2) && close(f.coords.r2, Math.max(f.w, f.h) * 0.7, 0.01), JSON.stringify(f.coords));
screencap(`${out}/12-1-degrade-forma.png`);
await p.tap('#sheet .type-linear');
await closeSheet(); // a folha aberta guarda o objeto antigo; o load troca todos os objetos
// sobrevive a salvar/reabrir e a undo
await p.evaluate(`(async () => { await editor.load(editor.toDocument()); editor.canvas.setActiveObject(editor.canvas.getObjects().find((o) => o.type === 'rect')); })()`);
f = await p.evaluate(fillInfo);
r.check('degradê + customGradient sobrevivem a load(toDocument())', f.isGrad && f.spec?.kind === 'linear' && Array.isArray(f.spec.stops) && f.stops.length === 3);
await p.evaluate(`(() => { const o = editor.active; editor.canvas.setActiveObject(o); editor.onSelection(o); })()`);
await p.sleep(200);
await p.tap('#props .gradient-btn');
r.check('reabrir o editor mostra as 3 paradas atuais', await p.evaluate(`document.querySelectorAll('#sheet .stop').length === 3`));
await p.tap('#sheet .remove-gradient');
f = await p.evaluate(fillInfo);
r.check('✕ Remover degradê → cor sólida (1ª parada), sem customGradient', !f.isGrad && typeof f.fill === 'string' && !f.spec, JSON.stringify(f));

// ---------- 2. borda tracejada / pontilhada e cantos ----------
await setSelect('Borda', 'dashed');
let st = await p.evaluate(`(() => { const o = editor.active; return { sw: o.strokeWidth, dash: o.strokeDashArray, cap: o.strokeLineCap, stroke: o.stroke, style: o.strokeDashStyle }; })()`);
r.check('Borda Tracejada: liga contorno visível e dash = [3w, 2w], ponta redonda', st.sw > 0 && JSON.stringify(st.dash) === JSON.stringify([st.sw * 3, st.sw * 2]) && st.cap === 'round' && Boolean(st.stroke), JSON.stringify(st));
await setRange('#props', 'Espessura', 10);
st = await p.evaluate(`(() => { const o = editor.active; return { sw: o.strokeWidth, dash: o.strokeDashArray }; })()`);
r.check('mudar a espessura refaz o tracejado ([30, 20])', st.sw === 10 && JSON.stringify(st.dash) === '[30,20]', JSON.stringify(st));
await setSelect('Borda', 'dotted');
st = await p.evaluate(`editor.active.strokeDashArray`);
r.check('Borda Pontilhada: [w, 2w]', JSON.stringify(st) === '[10,20]');
const cr = await setRange('#props', 'Cantos', 100000);
st = await p.evaluate(`(() => { const o = editor.active; return { rx: o.rx, ry: o.ry, half: Math.min(o.width, o.height) / 2 }; })()`);
r.check('Cantos no máximo = pílula (rx = ry = min(w,h)/2)', close(st.rx, st.half, 1) && st.rx === st.ry && close(cr.max, st.half, 1), JSON.stringify({ ...st, max: cr.max }));
screencap(`${out}/12-2-tracejado-cantos.png`);

// ---------- 3. trocar forma ----------
await p.evaluate(`(() => { const o = editor.active; o.set({ angle: 20 }); o.setCoords(); editor.setShadow(true); })()`);
await p.tap('#props .gradient-btn');
await p.tap('#sheet .preset[data-preset="Oferta Fogo"]');
await closeSheet();
const geo = `(() => { const o = editor.active; const c = o.getCenterPoint(); return { type: o.type, kind: o.shapeKind, cx: c.x, cy: c.y, W: o.width * o.scaleX, H: o.height * o.scaleY,
  angle: o.angle, grad: o.customGradient?.stops?.map((s) => s.color) ?? null, isGrad: typeof o.fill === 'object', dash: o.strokeDashArray, shadow: Boolean(o.shadow),
  idx: editor.canvas.getObjects().indexOf(o), n: editor.canvas.getObjects().length, rx: o.rx }; })()`;
const g0 = await p.evaluate(geo);
await p.tap('#props .swap-shape-btn');
await p.tap('#sheet .swap-shapes button', '● Círculo');
const g1 = await p.evaluate(geo);
r.check('Trocar forma → Círculo: mesmo centro, tamanho, ângulo e posição na pilha', g1.type === 'circle' && close(g1.cx, g0.cx) && close(g1.cy, g0.cy)
  && close(g1.W, g0.W) && close(g1.H, g0.H) && g1.angle === 20 && g1.idx === g0.idx && g1.n === g0.n, JSON.stringify({ g0, g1 }));
r.check('…e preserva degradê (refeito na nova caixa), tracejado e sombra', g1.isGrad && JSON.stringify(g1.grad) === JSON.stringify(['#ff416c', '#ff4b2b'])
  && JSON.stringify(g1.dash) === JSON.stringify(g0.dash) && g1.shadow);
await p.tap('#props .swap-shape-btn');
await p.tap('#sheet .swap-shapes button', '⬢ Hexágono');
const g2 = await p.evaluate(geo);
r.check('Círculo → Hexágono (polígono) no mesmo lugar', g2.type === 'polygon' && g2.kind === 'badge-hex' && close(g2.cx, g0.cx) && close(g2.W, g0.W), JSON.stringify(g2));
await p.tap('#props .swap-shape-btn');
await p.tap('#sheet .swap-shapes button', '💊 Pílula');
const g3 = await p.evaluate(geo);
r.check('Hexágono → Pílula: Rect no tamanho exato com rx = min/2', g3.type === 'rect' && close(g3.W, g0.W) && close(g3.rx, Math.min(g0.W, g0.H) / 2, 0.5), JSON.stringify(g3));
await p.sleep(400); // instantâneo do histórico tem debounce de 250 ms
await p.evaluate('editor.undo()');
await p.sleep(300);
r.check('undo volta ao hexágono', await p.evaluate(`editor.canvas.getObjects().some((o) => o.shapeKind === 'badge-hex') && !editor.canvas.getObjects().some((o) => o.shapeKind === 'pill')`));
screencap(`${out}/12-3-trocar-forma.png`);

// ---------- 4. degradê em texto ----------
await p.evaluate(`(() => { editor.canvas.discardActiveObject(); const t = editor.addText('title', 'Montserrat'); t.set({ top: 200 }); t.setCoords(); editor.canvas.setActiveObject(t); editor.onSelection(t); })()`);
await p.sleep(300);
await p.tap('#props .gradient-btn');
await p.tap('#sheet .preset[data-preset="Ouro Metálico"]');
await closeSheet();
f = await p.evaluate(fillInfo);
r.check('Texto com degradê Ouro Metálico', f.type === 'textbox' && f.isGrad && f.stops[0] === '#bf953f');
const h0 = f.h;
await setRange('#props', 'Tamanho', 200);
f = await p.evaluate(fillInfo);
r.check('texto maior: coords refeitas na nova altura (45°)', f.h > h0 && coordsMatch(f.coords, linCoords(45, f.w, f.h)), `h ${h0}→${f.h} ${JSON.stringify(f.coords)}`);
screencap(`${out}/12-4-texto-ouro.png`);

// ---------- 5. degradê no fundo ----------
await p.evaluate('editor.canvas.discardActiveObject()');
await p.tap('#tabs button', 'Fundo');
await p.tap('#sheet .bg-gradient-btn');
await p.tap('#sheet .preset[data-preset="Neon Cyber"]');
const bgInfo = `(() => { const b = editor.canvas.getObjects().find((o) => o.layerName === 'background'); return b ? { w: b.width, h: b.height, coords: b.fill.coords, stops: b.fill.colorStops.map((s) => s.color), spec: b.customGradient } : null; })()`;
let bg = await p.evaluate(bgInfo);
r.check('Fundo → 🌈 Degradê personalizado → Neon Cyber (3 cores, 315°) na página toda', bg && bg.w === 1080 && bg.stops.length === 3 && bg.spec.angle === 315 && coordsMatch(bg.coords, linCoords(315, 1080, 1080)), JSON.stringify(bg));
await closeSheet();
screencap(`${out}/12-5-fundo-neon.png`);
await p.evaluate('editor.resize(1080, 1920, false)');
bg = await p.evaluate(bgInfo);
r.check('mudar o formato da página (1080×1920) refaz o degradê do fundo na nova caixa', bg.h === 1920 && coordsMatch(bg.coords, linCoords(315, 1080, 1920)), JSON.stringify(bg.coords));
await p.evaluate('editor.resize(1080, 1080, false)');

// ---------- 6. setas e conectores ----------
await p.evaluate(`(() => { for (const o of editor.canvas.getObjects().filter((o) => o.layerName !== 'background')) editor.canvas.remove(o); editor.canvas.discardActiveObject(); })()`);
await p.tap('#tabs button', 'Formas');
await p.tap('#sheet .add-arrow');
const conn = `(() => { const g = editor.active; const s = g.connectorSpec; const kids = g.getObjects();
  const scene = (child, pt) => { const m = child.calcTransformMatrix(); const x = pt[0] - child.pathOffset.x, y = pt[1] - child.pathOffset.y; return [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]]; };
  const line = kids[0]; const first = line.path[0]; const capTip = s.endCap === 'arrow' ? kids[kids.length - 1].path[0] : null;
  return { type: g.type, spec: s, n: kids.length, start: scene(line, [first[1], first[2]]), tip: capTip ? scene(kids[kids.length - 1], [capTip[1], capTip[2]]) : null,
    stroke: line.stroke, sw: line.strokeWidth, dash: line.strokeDashArray, layer: g.layerName, inputs: Boolean(document.querySelector('#props .connector-props')) }; })()`;
const c0 = await p.evaluate(conn);
r.check('➝ Seta fina: Group com connectorSpec (fim = seta), linha + ponta, painel de conector', c0.type === 'group' && c0.spec.endCap === 'arrow' && c0.n === 2 && c0.inputs, JSON.stringify({ ...c0, spec: undefined }));
await p.evaluate(`(() => { editor.active.set({ angle: 30 }); editor.active.setCoords(); })()`);
const c0r = await p.evaluate(conn);
await setSelect('Início', 'dot');
const c1 = await p.evaluate(conn);
const samePt = (a, b) => close(a[0], b[0], 0.5) && close(a[1], b[1], 0.5);
r.check('Início = Ponto (com o grupo girado 30°): 3 peças, e a linha não sai do lugar (início e ponta da seta fixos na página)',
  c1.spec.startCap === 'dot' && c1.n === 3 && samePt(c1.start, c0r.start) && samePt(c1.tip, c0r.tip), JSON.stringify({ before: [c0r.start, c0r.tip], after: [c1.start, c1.tip] }));
await setColor('#props', 'Cor', '#00aa00');
await setRange('#props .connector-props ~ .row', 'Espessura', 8);
await setSelect('Traço', 'dashed');
await p.sleep(700); // o painel se redesenha 600 ms depois da cor (fim do arrasto no seletor)
const c2 = await p.evaluate(conn);
r.check('Cor, Espessura e Traço: linha verde, 8 px, tracejada [24,16]', c2.stroke === '#00aa00' && c2.sw === 8 && JSON.stringify(c2.dash) === '[24,16]' && c2.spec.color === '#00aa00', JSON.stringify({ stroke: c2.stroke, sw: c2.sw, dash: c2.dash }));
await setSelect('Linha', 'curve');
const c3 = await p.evaluate(conn);
r.check('Linha = Curva: path quadrático', c3.spec.shape === 'curve' && (await p.evaluate(`editor.active.getObjects()[0].path.some((s) => s[0] === 'Q')`)));
await p.tap('#props .swap-ends');
const c4 = await p.evaluate(conn);
r.check('⇄ Inverter pontas: início = seta, fim = ponto', c4.spec.startCap === 'arrow' && c4.spec.endCap === 'dot', JSON.stringify(c4.spec));
r.check('o conector continua com ângulo 30° e o nome da camada', (await p.evaluate('editor.active.angle')) === 30 && c4.layer === 'Seta');
await p.sleep(400);
await p.evaluate('editor.undo()');
await p.sleep(300);
const und = await p.evaluate(`(() => { const g = editor.canvas.getObjects().find((o) => o.connectorSpec); return g ? g.connectorSpec : editor.canvas.getObjects().map((o) => o.type); })()`);
r.check('undo desfaz a inversão das pontas', und.startCap === 'dot' && und.endCap === 'arrow', JSON.stringify(und));
screencap(`${out}/12-6-conector.png`);

// ---------- 7. blocos de infográfico ----------
await p.evaluate(`(() => { for (const o of editor.canvas.getObjects().filter((o) => o.layerName !== 'background')) editor.canvas.remove(o); editor.canvas.discardActiveObject(); })()`);
const sel = `(() => { const a = editor.active; const objs = a?.type === 'activeselection' ? a.getObjects() : [a]; return objs.map((o) => ({ type: o.type, spec: o.connectorSpec ?? null, text: o.text ?? null })); })()`;
const addBlock = async (cls) => { await p.evaluate('editor.canvas.discardActiveObject()'); await p.tap('#tabs button', 'Formas'); await p.tap(`#sheet .${cls}`); await p.sleep(250); return p.evaluate(sel); };
const pin = await addBlock('add-pin');
r.check('📍 Pino: linha em cotovelo com pino (anel+ponto) + texto "Aço Inox 304", selecionados juntos', pin.length === 2 && pin[0].spec?.shape === 'elbow' && pin[0].spec.endCap === 'ring' && pin[1].text === 'Aço Inox 304', JSON.stringify(pin));
const dim = await addBlock('add-dimension');
r.check('|↔| Cota: barras nas duas pontas + "25 cm"', dim.length === 2 && dim[0].spec?.startCap === 'bar' && dim[0].spec.endCap === 'bar' && dim[1].text === '25 cm');
const zoom = await addBlock('add-zoom');
r.check('🔍 Lupa: círculo vazado + linha terminando em ponto', zoom.length === 2 && zoom[0].type === 'circle' && zoom[1].spec?.endCap === 'dot');
const curved = await addBlock('add-curved');
r.check('↪ Seta curva: curva com seta no fim', curved.length === 1 && curved[0].spec?.shape === 'curve' && curved[0].spec.endCap === 'arrow');
await p.evaluate('(editor.canvas.discardActiveObject(), editor.canvas.requestRenderAll())');
await p.sleep(300);
screencap(`${out}/12-7-raio-x.png`);
const persisted = await p.evaluate(`(async () => { const before = editor.canvas.getObjects().filter((o) => o.connectorSpec).length; await editor.load(editor.toDocument());
  const after = editor.canvas.getObjects().filter((o) => o.connectorSpec); editor.canvas.setActiveObject(after[0]);
  return { before, after: after.length, editable: Boolean(editor.connectorOf(after[0])) }; })()`);
r.check('conectores sobrevivem a salvar/reabrir e continuam editáveis', persisted.before === 4 && persisted.after === 4 && persisted.editable, JSON.stringify(persisted));
// o texto do pino segue editável por toque longo (peças soltas)
r.check('texto do bloco é Textbox solto (editável por toque longo)', await p.evaluate(`editor.canvas.getObjects().some((o) => o.type === 'textbox' && o.text === 'Aço Inox 304' && !o.group)`));

r.check('sem exceções JS no console', !p.logs.some((l) => l.startsWith('EXCEPTION')), p.logs.filter((l) => l.startsWith('EXCEPTION')).join(' | '));
r.done();
p.close();
