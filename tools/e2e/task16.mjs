// E2E TASK-16 (Pathfinder: Unir, Subtrair, Interseção, Vazado) no app real.
// Uso: ANDROID_SERIAL=<serial> node tools/e2e/task16.mjs <pasta-de-prints>
//      E2E_MODE=base → controle positivo no APK da base: com 2 formas selecionadas, confere que a linha do Pathfinder
//      (`#props .bool-*`) e o `editor.applyBooleanOp` NÃO existem e para (PASS = funcionalidade ausente).
// A seleção múltipla é feita pelo painel Camadas ("☑ Selecionar Vários" → Aplicar), os botões e o ↶ por toque real;
// o estado é lido pelo `window.editor` e os pixels saem do PNG/JPG/SVG/vídeo exportados.
import { mkdirSync } from 'node:fs';
import { launchEditor, reporter, screencap } from './cdp.mjs';

const out = process.argv[2] ?? '.';
mkdirSync(out, { recursive: true });
const BASE = process.env.E2E_MODE === 'base';
const RED = '#e53935', BLUE = '#1e88e5';
const RGB = { red: [229, 57, 53], white: [255, 255, 255] };
// página 1080²: retângulo 'Cupom' 600×300 em [240,840]×[390,690]; círculo 'Furo' r=90 centrado na borda esquerda (240,540)
const RECT_BOX = [240, 390, 600, 300], CIRC_BOX = [150, 450, 180, 180];
const PT = { both: [270, 540], rectOnly: [700, 540], circOnly: [190, 540] };

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
const r = reporter(`TASK-16 — Pathfinder${BASE ? ' (BASE: controle positivo)' : ''}`);
const near = (a, b, tol = 1.5) => a.length === b.length && a.every((v, i) => Math.abs(v - b[i]) <= tol);
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const isColor = (px, rgb, tol = 40) => Array.isArray(px) && dist(px, rgb) <= tol;

await p.evaluate(`(async () => {
  await editor.newDocument('E2E 16', 1080, 1080);
  const rect = editor.addShape('rect', '${RED}');
  rect.set({ left: 540, top: 540, width: 600, height: 300, layerName: 'Cupom' });
  const circ = editor.addShape('circle', '${BLUE}');
  circ.set({ left: 240, top: 540, radius: 90, scaleX: 1, scaleY: 1, layerName: 'Furo' });
  const t = editor.addText('title', 'Montserrat'); t.set({ left: 540, top: 880, text: 'R$ 9,90', layerName: 'Preço' });
  for (const o of [rect, circ, t]) o.setCoords();
  editor.canvas.discardActiveObject(); editor.canvas.requestRenderAll(); editor.commit();
})()`);
await p.sleep(700); // debounce do instantâneo (250 ms): o estado inicial vira um passo do histórico

/** Objeto pelo nome da camada (o undo troca as instâncias). */
const byName = (name) => `editor.canvas.getObjects().find((o) => o.layerName === ${JSON.stringify(name)})`;
const box = (expr) => p.evaluate(`(() => { const o = ${expr}; if (!o) return null; o.setCoords(); const b = o.getBoundingRect(); return [b.left, b.top, b.width, b.height]; })()`);
const state = () => p.evaluate(`(() => { const a = editor.active; return {
  total: editor.canvas.getObjects().length, types: editor.canvas.getObjects().map((o) => o.type + ':' + (o.layerName ?? '')),
  active: a ? { type: a.type, fill: typeof a.fill === 'string' ? a.fill : String(a.fill?.type), fillRule: a.fillRule, layer: a.layerName,
    index: editor.canvas.getObjects().indexOf(a) } : null,
  bools: ['union', 'subtract', 'intersect', 'exclude'].filter((k) => document.querySelector('#props .bool-' + k)),
}; })()`);

/** Camadas → ☑ Selecionar Vários → marca as camadas → Aplicar (N): o caminho de seleção múltipla do usuário. */
const selectLayers = async (names) => {
  await p.tap('#topbar button', 'Camadas');
  await p.tap('#sheet button', 'Selecionar Vários');
  for (const [i, name] of names.entries()) {
    await p.evaluate(`(() => { const row = [...document.querySelectorAll('#sheet .layer')].find((l) => l.textContent.includes(${JSON.stringify(name)}));
      row.querySelector('input[type=checkbox]').setAttribute('data-e2e', 'cb-${i}'); })()`);
    await p.tap(`[data-e2e=cb-${i}]`);
  }
  await p.tap('#sheet button', `Aplicar (${names.length})`);
  await p.sleep(400);
};

/** Pixels da página exportada (`exportRaster`) nos pontos dados, lidos no próprio WebView. */
const rasterPx = (fmt, pts) => p.evaluate(`(async () => {
  const url = await editor.exportRaster('${fmt}', 1, 0.92);
  const img = new Image(); img.src = url; await img.decode();
  const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight;
  const x = c.getContext('2d'); x.drawImage(img, 0, 0);
  const s = c.width / editor.width;
  return ${JSON.stringify(pts)}.map(([u, v]) => [...x.getImageData(Math.round(u * s), Math.round(v * s), 1, 1).data]);
})()`);
const undo = async () => { await p.sleep(500); await p.tap('#topbar button', '↶'); await p.sleep(900); };
const pts = [PT.both, PT.rectOnly, PT.circOnly];

const before = { rect: await box(byName('Cupom')), circ: await box(byName('Furo')), total: (await state()).total };
r.check('0. página: Cupom 600×300 e Furo r=90 nas caixas do roteiro', near(before.rect, RECT_BOX) && near(before.circ, CIRC_BOX),
  JSON.stringify(before));

// ---------- 1. forma + texto: a linha do Pathfinder NÃO aparece ----------
await selectLayers(['Cupom', 'Preço']);
const s1 = await state();
r.check('1. Cupom + Preço (forma + texto): seleção múltipla sem a linha do Pathfinder',
  s1.active?.type === 'activeselection' && s1.bools.length === 0 && await p.evaluate(`Boolean(document.querySelector('#props .group-btn'))`), JSON.stringify(s1));
screencap(`${out}/16-1-forma-e-texto.png`);

// ---------- 2. duas formas: os 4 botões ----------
await selectLayers(['Cupom', 'Furo']);
if (BASE) {
  const absent = await p.evaluate(`({ sel: editor.active?.type, row: document.querySelector('#props .bool-subtract') === null, api: typeof editor.applyBooleanOp === 'undefined' })`);
  screencap(`${out}/16-base-duas-formas.png`);
  r.check('BASE: 2 formas selecionadas', absent.sel === 'activeselection', JSON.stringify(absent));
  r.check('BASE: #props .bool-subtract não existe', absent.row);
  r.check('BASE: editor.applyBooleanOp não existe (funcionalidade ausente)', absent.api);
  r.done();
  p.close();
  process.exit();
}
const s2 = await state();
r.check('2. Cupom + Furo: os 4 botões (.bool-union|subtract|intersect|exclude)', s2.bools.length === 4, JSON.stringify(s2.bools));
screencap(`${out}/16-2-pathfinder.png`);

// ---------- 3. ➖ Subtrair ----------
await p.tap('#props .bool-subtract');
await p.sleep(300);
const s3 = await state();
r.check('3. ➖ Subtrair: 1 path no lugar dos 2 (total −1), fill do Cupom, evenodd, no lugar da base na pilha',
  s3.total === before.total - 1 && s3.active?.type === 'path' && s3.active.fill === RED && s3.active.fillRule === 'evenodd'
  && s3.active.layer === 'Forma combinada' && s3.active.index === 0 && !s3.types.some((t) => /Furo|Cupom/.test(t)), JSON.stringify(s3));
r.check('3. bbox do resultado = a do Cupom (o furo está na borda)', near(await box('editor.active'), RECT_BOX), JSON.stringify(await box('editor.active')));
const px3 = await rasterPx('png', pts);
r.check('3. PNG: no círculo ∩ retângulo = fundo branco; só retângulo = vermelho; só círculo = branco',
  isColor(px3[0], RGB.white, 8) && isColor(px3[1], RGB.red, 8) && isColor(px3[2], RGB.white, 8), JSON.stringify(px3));
screencap(`${out}/16-3-subtrair.png`);

// ---------- 4. ↶ devolve as 2 formas ----------
await undo();
const s4 = await state();
const after4 = { rect: await box(byName('Cupom')), circ: await box(byName('Furo')) };
r.check('4. ↶ (1 toque): rect + circle de volta com as caixas de antes (±1,5 px)',
  s4.total === before.total && s4.types.includes('rect:Cupom') && s4.types.includes('circle:Furo') && !s4.types.some((t) => t.startsWith('path'))
  && near(after4.rect, before.rect) && near(after4.circ, before.circ), JSON.stringify({ s4, after4 }));
screencap(`${out}/16-4-desfeito.png`);

// ---------- 5. ➕ Unir, ✖️ Interseção, ➗ Vazado ----------
const runOp = async (op, shot) => {
  await selectLayers(['Cupom', 'Furo']);
  await p.tap(`#props .bool-${op}`);
  await p.sleep(300);
  const s = await state();
  const b = await box('editor.active');
  const px = await rasterPx('png', pts);
  screencap(`${out}/${shot}`);
  return { s, b, px };
};
const u = await runOp('union', '16-5-unir.png');
r.check('5a. ➕ Unir: 1 path, bbox = união das caixas [150,390]–[840,690] (±1,5 px)',
  u.s.active?.type === 'path' && u.s.total === before.total - 1 && near(u.b, [150, 390, 690, 300]), JSON.stringify({ s: u.s.active, b: u.b }));
r.check('5a. Unir: os 3 pontos vermelhos (cor da base)', u.px.every((q) => isColor(q, RGB.red, 8)), JSON.stringify(u.px));
await undo();
const i = await runOp('intersect', '16-5-intersecao.png');
r.check('5b. ✖️ Interseção: 1 path com bbox = meia-lua dentro do retângulo [240,450]–[330,630] (±1,5 px)',
  i.s.active?.type === 'path' && near(i.b, [240, 450, 90, 180]), JSON.stringify({ s: i.s.active, b: i.b }));
r.check('5b. Interseção: só a sobreposição fica vermelha',
  isColor(i.px[0], RGB.red, 8) && isColor(i.px[1], RGB.white, 8) && isColor(i.px[2], RGB.white, 8), JSON.stringify(i.px));
await undo();
const x = await runOp('exclude', '16-5-vazado.png');
r.check('5c. ➗ Vazado: 1 path evenodd; pixel na sobreposição = fundo, fora dela = vermelho',
  x.s.active?.type === 'path' && x.s.active.fillRule === 'evenodd'
  && isColor(x.px[0], RGB.white, 8) && isColor(x.px[1], RGB.red, 8) && isColor(x.px[2], RGB.red, 8), JSON.stringify({ s: x.s.active, px: x.px }));
await undo();
const s5 = await state();
r.check('5. depois dos ↶: as 2 formas originais de volta', s5.types.includes('rect:Cupom') && s5.types.includes('circle:Furo') && s5.total === before.total,
  JSON.stringify(s5.types));

// ---------- 6. exportações com o resultado do Subtrair ----------
await selectLayers(['Cupom', 'Furo']);
await p.tap('#props .bool-subtract');
await p.sleep(600);
const png = await rasterPx('png', pts), jpg = await rasterPx('jpeg', pts);
r.check('6a. PNG: furo = fundo, retângulo = vermelho', isColor(png[0], RGB.white, 8) && isColor(png[1], RGB.red, 8), JSON.stringify(png));
r.check('6b. JPG: furo = fundo, retângulo = vermelho (±40 da compressão)', isColor(jpg[0], RGB.white) && isColor(jpg[1], RGB.red), JSON.stringify(jpg));
const svg = await p.evaluate(`(async () => {
  const s = await editor.exportSvg();
  const img = new Image(); img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(s))); await img.decode();
  const c = document.createElement('canvas'); c.width = editor.width; c.height = editor.height;
  const x = c.getContext('2d'); x.fillStyle = '#ffffff'; x.fillRect(0, 0, c.width, c.height); x.drawImage(img, 0, 0, c.width, c.height);
  return { path: /<path[^>]*/.test(s), evenodd: /fill-rule:\\s*evenodd|fill-rule="evenodd"/.test(s),
    px: ${JSON.stringify(pts)}.map(([u, v]) => [...x.getImageData(u, v, 1, 1).data]) };
})()`);
r.check('6c. SVG: <path> com fill-rule evenodd', svg.path && svg.evenodd, JSON.stringify({ path: svg.path, evenodd: svg.evenodd }));
r.check('6c. SVG desenhado no WebView: furo = fundo, retângulo = vermelho', isColor(svg.px[0], RGB.white, 8) && isColor(svg.px[1], RGB.red, 8), JSON.stringify(svg.px));
// vídeo: `layer_<i>.png` é o objeto i sozinho, recortado na caixa dele (+ margem 2, sem sombra), sem o fundo
const vid = await p.evaluate(`(async () => {
  const o = editor.canvas.getObjects().find((q) => q.layerName === 'Forma combinada'); const idx = editor.canvas.getObjects().indexOf(o);
  o.setCoords(); const bb = o.getBoundingRect();
  const b = await editor.exportVideoBundle('mp4'); const unit = b.width / editor.width; const file = b.files['layer_' + idx + '.png'];
  if (!file) return { idx, file: false };
  const img = new Image(); img.src = file; await img.decode();
  const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight;
  const x = c.getContext('2d'); x.drawImage(img, 0, 0);
  const at = ([u, v]) => [...x.getImageData(Math.round((u - bb.left + 2) * unit), Math.round((v - bb.top + 2) * unit), 1, 1).data];
  return { idx, file: true, unit, hole: at(${JSON.stringify(PT.both)}), solid: at(${JSON.stringify(PT.rectOnly)}), output: b.output };
})()`);
r.check('6d. MP4: o PNG da camada do path tem alpha 0 no furo e vermelho opaco no retângulo',
  vid.file && vid.hole[3] === 0 && vid.solid[3] === 255 && isColor(vid.solid, RGB.red, 8), JSON.stringify(vid));
screencap(`${out}/16-6-exportado.png`);

r.check('sem exceções JS no console', !p.logs.some((l) => l.startsWith('EXCEPTION')), p.logs.filter((l) => l.startsWith('EXCEPTION')).join(' | '));
r.done();
p.close();
