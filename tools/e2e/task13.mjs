// E2E TASK-13 (zoom/pan por pinça, grade dos terços, guias manuais, preview do anúncio) no app real.
// Uso: ANDROID_SERIAL=<serial> node tools/e2e/task13.mjs <pasta-de-prints>
// Gestos de 2 dedos reais por CDP (Input.dispatchTouchEvent); botões e arrastos por toque. Cada passo roda num `try`
// próprio: com o APK da base (controle positivo) os passos da funcionalidade ausente reportam FAIL sem abortar o resto.
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync } from 'node:fs';
import { adbShell, launchEditor, reporter, screencap } from './cdp.mjs';

const out = process.argv[2] ?? '.';
mkdirSync(out, { recursive: true });
const p = await launchEditor();
const r = reporter('TASK-13 — zoom/pan por pinça, grade, guias manuais e preview do anúncio');
const near = (a, b, tol) => Math.abs(a - b) <= tol;
const step = async (name, fn) => {
  try { await fn(); } catch (e) { r.check(`${name}: passo executou`, false, e.message.split('\n')[0]); }
};
const shot = (name) => { try { screencap(`${out}/${name}.png`); } catch (e) { console.log(`print ${name} falhou: ${e.message}`); } };

// ---------- auxiliares ----------
const touchPts = (pts) => pts.map((q, i) => ({ x: q.x, y: q.y, radiusX: 4, radiusY: 4, force: 1, id: i + 1 }));
const touchEv = (type, pts) => p.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : touchPts(pts) });
/** Dois dedos de (a0,b0) até (a1,b1) em `steps` passos. */
const twoFinger = async (a0, b0, a1, b1, steps = 12) => {
  await touchEv('touchStart', [a0, b0]);
  for (let i = 1; i <= steps; i++) {
    const k = i / steps;
    const lerp = (u, v) => ({ x: u.x + (v.x - u.x) * k, y: u.y + (v.y - u.y) * k });
    await touchEv('touchMove', [lerp(a0, a1), lerp(b0, b1)]);
    await p.sleep(16);
  }
  await touchEv('touchEnd', []);
  await p.sleep(250);
};
const pinchAt = (c, d1, d2) => twoFinger({ x: c.x - d1 / 2, y: c.y }, { x: c.x + d1 / 2, y: c.y }, { x: c.x - d2 / 2, y: c.y }, { x: c.x + d2 / 2, y: c.y });
const view = () => p.evaluate(`(() => { const c = editor.canvas; return { z: c.getZoom(), vpt: [...c.viewportTransform], w: c.width, h: c.height,
  factor: typeof editor.zoomFactor === 'number' ? editor.zoomFactor : null,
  pill: document.querySelector('#zoom-pill .zoom-label')?.textContent ?? null }; })()`);
const stageBox = () => p.evaluate(`(() => { const b = document.getElementById('stage').getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2, w: b.width, h: b.height, top: b.top, left: b.left }; })()`);
const rectInfo = () => p.evaluate(`(() => { const o = editor.canvas.getObjects().find((x) => x.layerName === 'E2E13'); if (!o) return null;
  const b = o.getBoundingRect(); return { left: o.left, top: o.top, scaleX: o.scaleX, scaleY: o.scaleY, angle: o.angle, bl: b.left, bt: b.top, bw: b.width, bh: b.height }; })()`);
const histLen = () => p.evaluate('editor.history.past.length');
const toClient = (x, y) => p.evaluate(`editor.docToClient(${x}, ${y})`);
const toDoc = (x, y) => p.evaluate(`editor.clientToDoc(${x}, ${y})`);
/** Pixels do canvas inferior (o que está na tela) nos pontos do documento dados; null fora do elemento. */
const screenPixels = (docPts) => p.evaluate(`(() => {
  const el = editor.canvas.lowerCanvasEl; const b = el.getBoundingClientRect(); const ctx = el.getContext('2d');
  return ${JSON.stringify(docPts)}.map(([x, y]) => { const c = editor.docToClient(x, y);
    const px = Math.round((c.x - b.left) * el.width / b.width), py = Math.round((c.y - b.top) * el.height / b.height);
    if (px < 0 || py < 0 || px >= el.width || py >= el.height) return null; return [...ctx.getImageData(px, py, 1, 1).data]; });
})()`);
const setSelect = (label, value) => p.evaluate(`(() => {
  const l = [...document.querySelectorAll('#sheet label.select')].find((x) => x.textContent.includes(${JSON.stringify(label)}));
  if (!l) return null; const s = l.querySelector('select'); s.value = ${JSON.stringify(value)}; s.dispatchEvent(new Event('change')); return s.value; })()`);
const closeSheet = async () => { await p.tap('#sheet .sheet-head button'); await p.sleep(250); };
// selecionar abre o painel de propriedades e o #stage encolhe: espera o fit() do ResizeObserver
const selectRect = async () => {
  await p.evaluate(`(() => { const o = editor.canvas.getObjects().find((x) => x.layerName === 'E2E13'); editor.canvas.setActiveObject(o);
    editor.onSelection(o); editor.canvas.requestRenderAll(); return Boolean(o); })()`);
  await p.sleep(400);
};
/** Arrasta o retângulo (dedo no centro dele) para a borda esquerda da caixa ficar em `targetLeft` (px do documento). */
const dragRectLeftTo = async (targetLeft) => {
  const s = await rectInfo();
  const z = (await view()).z;
  const c = await toClient(s.bl + s.bw / 2, s.bt + s.bh / 2);
  const dx = (targetLeft - s.bl) * z;
  await p.drag(c.x, c.y, c.x + dx, c.y, { steps: 14 });
  await p.sleep(450);
  return rectInfo();
};
const isColor = (px, rgb, tol) => px && px.every((v, i) => i > 2 || Math.abs(v - rgb[i]) <= tol);

// ---------- estado de partida ----------
await p.evaluate(`(async () => { await editor.newDocument('E2E 13', 1080, 1080); editor.canvas.requestRenderAll(); })()`);
await p.sleep(400);
await p.tap('#tabs button', 'Formas');
await p.tap('#sheet button', 'Retângulo');
await p.sleep(300);
await p.evaluate(`(() => { const o = editor.active; o.set({ layerName: 'E2E13' }); o.setCoords(); editor.commit(); })()`);
await p.sleep(500);
const V0 = await view();
const Z0 = V0.z;
const stage = await stageBox();
console.log(`partida: zoom ${Z0.toFixed(4)}, elemento ${V0.w}×${V0.h}, palco ${Math.round(stage.w)}×${Math.round(stage.h)}`);
r.check('partida: retângulo selecionado e encaixe 100%', (await p.evaluate('editor.active?.layerName')) === 'E2E13'
  && near(V0.vpt[4], 0, 1e-9) && near(V0.vpt[5], 0, 1e-9), JSON.stringify(V0));
shot('13-0-partida');

// ---------- A: pinça com o 1º dedo sobre o retângulo selecionado ----------
await step('A pinça', async () => {
  const s0 = await rectInfo();
  const h0 = await histLen();
  const c = await toClient(s0.bl + s0.bw / 2, s0.bt + s0.bh / 2);
  const inset = Math.min(28, (s0.bw * Z0) / 4);
  const f1 = { x: c.x - inset, y: c.y - inset };
  // na diagonal (os pontos ficam dentro da tela): 1º dedo no retângulo, um arrasto curto (o Fabric já começa a mover),
  // depois o 2º dedo a 150 px e a pinça até 450 px (ou o que couber no palco)
  const u = { x: Math.SQRT1_2, y: Math.SQRT1_2 };
  await touchEv('touchStart', [f1]);
  await p.sleep(40);
  await touchEv('touchMove', [{ x: f1.x + 4, y: f1.y }]);
  await p.sleep(30);
  await touchEv('touchMove', [{ x: f1.x + 8, y: f1.y }]);
  await p.sleep(30);
  const a0 = { x: f1.x + 8, y: f1.y };
  const d1 = 150;
  const mid = { x: a0.x + (u.x * d1) / 2, y: a0.y + (u.y * d1) / 2 };
  const room = Math.min(mid.x - stage.left, stage.left + stage.w - mid.x, mid.y - stage.top, stage.top + stage.h - mid.y) - 10;
  // cada ponta fica a (d/2)·cos45° do centro em x e em y
  const d2 = Math.max(d1 + 90, Math.min(450, 2 * room * Math.SQRT2));
  const at = (d) => [{ x: mid.x - (u.x * d) / 2, y: mid.y - (u.y * d) / 2 }, { x: mid.x + (u.x * d) / 2, y: mid.y + (u.y * d) / 2 }];
  const docMid0 = await toDoc(mid.x, mid.y);
  await touchEv('touchStart', at(d1));
  for (let i = 1; i <= 12; i++) {
    await touchEv('touchMove', at(d1 + ((d2 - d1) * i) / 12));
    await p.sleep(16);
  }
  await touchEv('touchEnd', []);
  await p.sleep(600);
  const expected = d2 / d1;
  const v = await view();
  const docMid1 = await toDoc(mid.x, mid.y);
  const s1 = await rectInfo();
  const h1 = await histLen();
  r.check(`A: zoom ≈ ${expected.toFixed(2)}× o de encaixe (dedos ${d1} → ${Math.round(d2)} px; tol 15%)`, near(v.z / Z0, expected, expected * 0.15),
    `${(v.z / Z0).toFixed(3)}×`);
  r.check('A: o ponto do documento sob o centro da pinça fica sob ele (tol 3 px do doc)',
    near(docMid0.x, docMid1.x, 3) && near(docMid0.y, docMid1.y, 3), `${JSON.stringify(docMid0)} → ${JSON.stringify(docMid1)}`);
  r.check('A: retângulo não moveu nem deformou (left/top/scale/angle iguais)',
    s1.left === s0.left && s1.top === s0.top && s1.scaleX === s0.scaleX && s1.scaleY === s0.scaleY && s1.angle === s0.angle,
    `${JSON.stringify(s0)} → ${JSON.stringify(s1)}`);
  r.check('A: nenhum passo novo no desfazer', h1 === h0, `${h0} → ${h1}`);
  const pct = Number(/(\d+)%/.exec(v.pill ?? '')?.[1]);
  r.check(`A: pílula mostra ≈ ${Math.round(expected * 100)}%`, near(pct, expected * 100, expected * 15), String(v.pill));
  shot('13-A-pinca');
});

// ---------- B: pan com 2 dedos ----------
await step('B pan', async () => {
  const v0 = await view();
  const y = stage.y + 40;
  await twoFinger({ x: stage.x - 100, y }, { x: stage.x + 60, y }, { x: stage.x, y }, { x: stage.x + 160, y }, 10);
  await p.sleep(300);
  const v1 = await view();
  r.check('B: 2 dedos +100 px em x → viewportTransform[4] +≈100 (tol 10)', near(v1.vpt[4] - v0.vpt[4], 100, 10),
    `${v0.vpt[4].toFixed(1)} → ${v1.vpt[4].toFixed(1)}`);
  r.check('B: o pan não muda o zoom', near(v1.z, v0.z, v0.z * 0.01), `${v0.z} → ${v1.z}`);
  shot('13-B-pan');
});

// ---------- C: limites 0,5× e 4× ----------
await step('C limites', async () => {
  const d = Math.min(380, stage.w - 30);
  for (let i = 0; i < 3; i++) await pinchAt(stage, 90, d);
  const vMax = await view();
  r.check('C: pinça repetida para fora para em 4× (≤ 4·Z0 + ε e ≈ 4·Z0)', vMax.z <= 4 * Z0 + 1e-6 && near(vMax.z / Z0, 4, 0.02), `${(vMax.z / Z0).toFixed(3)}×`);
  shot('13-C-400');
  for (let i = 0; i < 3; i++) await pinchAt(stage, d, 60);
  const vMin = await view();
  r.check('C: pinça repetida para dentro para em 0,5× (≥ 0,5·Z0 − ε e ≈ 0,5·Z0)', vMin.z >= 0.5 * Z0 - 1e-6 && near(vMin.z / Z0, 0.5, 0.02), `${(vMin.z / Z0).toFixed(3)}×`);
  shot('13-C-50');
});

// ---------- D: reset pela pílula e "+" ----------
await step('D reset', async () => {
  await p.tap('#zoom-pill .zoom-label');
  await p.sleep(300);
  const v = await view();
  r.check('D: toque no rótulo % volta ao encaixe: mesmo zoom, vpt [Z0,0,0,Z0,0,0] e elemento do mesmo tamanho',
    v.z === Z0 && JSON.stringify(v.vpt) === JSON.stringify(V0.vpt) && v.w === V0.w && v.h === V0.h && v.pill?.includes('100%'),
    JSON.stringify(v));
  await p.tap('#zoom-pill .zoom-in');
  await p.sleep(300);
  const v2 = await view();
  r.check('D: "+" amplia (fator > 1)', v2.factor > 1 && v2.z > Z0, `${v2.factor} (${v2.pill})`);
  shot('13-D-mais');
});

// ---------- E: exportar ampliado ----------
await step('E exportar', async () => {
  await p.tap('#zoom-pill .zoom-label');
  await p.sleep(200);
  await p.evaluate(`(async () => { window.__e13 = { png: await editor.exportRaster('png', 1, 1), svg: await editor.exportSvg() }; return true; })()`);
  await p.tap('#zoom-pill .zoom-in');
  await p.tap('#zoom-pill .zoom-in');
  await p.sleep(300);
  const v = await view();
  r.check('E: dois "+" = 200%', v.factor === 2 && v.pill?.includes('200%'), `${v.factor} ${v.pill}`);
  shot('13-E-200');
  const cmp = await p.evaluate(`(async () => {
    const png = await editor.exportRaster('png', 1, 1); const svg = await editor.exportSvg();
    const img = new Image(); img.src = png; await img.decode();
    return { samePng: png === window.__e13.png, sameSvg: svg === window.__e13.svg, w: img.naturalWidth, h: img.naturalHeight, factor: editor.zoomFactor };
  })()`);
  r.check('E: PNG a 200% idêntico ao de 100% e com 1080×1080', cmp.samePng && cmp.w === 1080 && cmp.h === 1080, JSON.stringify(cmp));
  r.check('E: SVG a 200% idêntico ao de 100%', cmp.sameSvg, JSON.stringify(cmp));
  r.check('E: exportar não muda o zoom da tela', cmp.factor === 2, String(cmp.factor));
  // pelo caminho do usuário: Exportar → PNG → Salvar na galeria, com 200% na tela
  const name = `E2E13_${Date.now()}`;
  await p.evaluate(`(editor.name = ${JSON.stringify(name)}, true)`);
  await p.tap('#topbar button', 'Exportar');
  await p.tap('#sheet button', 'Salvar na galeria');
  await p.waitFor(`document.getElementById('toast').classList.contains('show') && !document.getElementById('busy').classList.contains('show')`, 60000);
  const toast = await p.evaluate(`document.getElementById('toast').textContent`);
  const loc = /Salvo em (.+)$/.exec(toast)?.[1];
  r.check('E: "Salvar na galeria" a 200% salvou o PNG', Boolean(loc), toast);
  if (loc) {
    const local = `${out}/13-E-export.png`;
    execFileSync('adb', ['pull', `/sdcard/${loc}`, local], { env: { ...process.env, MSYS_NO_PATHCONV: '1' } });
    const buf = readFileSync(local);
    const w = buf.readUInt32BE(16);
    const hgt = buf.readUInt32BE(20);
    r.check('E: arquivo exportado (cabeçalho PNG) com 1080×1080', buf.toString('ascii', 1, 4) === 'PNG' && w === 1080 && hgt === 1080, `${w}×${hgt}`);
    try { adbShell(`rm -f "/sdcard/${loc}"`); adbShell('content call --uri content://media/ --method scan_volume --arg external_primary'); rmSync(local); } catch (e) { console.log(`limpeza falhou: ${e.message}`); }
  }
  await p.sleep(3500); // o toast some
});

// ---------- F: grade dos terços ----------
await step('F grade', async () => {
  await p.tap('#zoom-pill .zoom-label');
  await p.sleep(200);
  await p.tap('#tabs button', 'Tamanho');
  const set = await setSelect('Grade', 'thirds');
  await closeSheet();
  const mode = await p.evaluate('editor.gridOverlay ?? null');
  r.check('F: "Tamanho" → Grade "Regra dos terços" liga editor.gridOverlay', set === 'thirds' && mode === 'thirds', `${set} ${mode}`);
  await p.evaluate('(editor.canvas.discardActiveObject(), editor.canvas.requestRenderAll(), true)');
  await p.sleep(300);
  const line = await screenPixels([150, 165, 180, 195, 210, 225, 240, 255].map((y) => [360, y]));
  const hit = line.some((px) => px && px[0] > 200 && px[2] < 120 && px[1] < 225);
  r.check('F: linha dos terços em x = W/3 na tela (cor da grade, ≠ fundo)', hit, JSON.stringify(line));
  const exported = await p.evaluate(`(async () => { const img = new Image(); img.src = await editor.exportRaster('png', 1, 1); await img.decode();
    const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight; const x = c.getContext('2d'); x.drawImage(img, 0, 0);
    return [150, 180, 210, 240].map((y) => [...x.getImageData(360, y, 1, 1).data]); })()`);
  r.check('F: a grade não sai no PNG exportado (fundo branco no mesmo ponto)', exported.every((px) => isColor(px, [255, 255, 255], 3)), JSON.stringify(exported));
  shot('13-F-tercos');
  await selectRect();
  const s = await dragRectLeftTo(360 + 3 / Z0);
  r.check('F: arrastar a ~3 px de tela de x = 360 → borda esquerda encaixa em 360 (tol 0,5)', near(s.bl, 360, 0.5), `left ${s.bl.toFixed(2)}`);
  shot('13-F-snap');
  // ampliado (200%) a linha continua no lugar certo
  await p.tap('#zoom-pill .zoom-in');
  await p.tap('#zoom-pill .zoom-in');
  await p.sleep(300);
  await p.evaluate('(editor.canvas.discardActiveObject(), editor.canvas.requestRenderAll(), true)');
  await p.sleep(250);
  const c540 = await screenPixels([500, 515, 530, 545, 560, 575, 590, 605].map((y) => [720, y]));
  r.check('F: a 200% a linha 2W/3 continua sob x = 720 do documento', c540.some((px) => px && px[0] > 200 && px[2] < 120 && px[1] < 225), JSON.stringify(c540));
  shot('13-F-tercos-200');
  await p.tap('#zoom-pill .zoom-label');
  await p.sleep(200);
});

// ---------- G: preview do anúncio ----------
await step('G preview', async () => {
  // brand kit vazio (só na página; o salvo no app não muda): o nome da loja tem de ser "Sua Loja"
  await p.evaluate(`(ppEditor.setBrandKit({ profile: {}, colors: {}, fonts: {} }), true)`);
  await p.tap('#topbar button', 'Preview');
  await p.sleep(400);
  const feed = await p.evaluate(`(() => { const s = document.querySelector('#sheet'); return { open: s.classList.contains('show'), text: s.textContent,
    img: document.querySelector('#sheet .adp-feed img.adp-creative')?.getAttribute('src')?.slice(0, 15) ?? null }; })()`);
  r.check('G: "👁️ Preview" abre a folha no modo Feed', feed.open && feed.img === 'data:image/jpeg', String(feed.img));
  r.check('G: Feed com "Patrocinado", "Comprar agora" e o nome da loja (Sua Loja sem brand kit)',
    ['Patrocinado', 'Comprar agora', 'Sua Loja'].every((t) => feed.text.includes(t)), feed.text.slice(0, 160));
  shot('13-G-feed');
  await p.tap('#sheet .adp-modes button', 'Stories');
  await p.sleep(300);
  const st = await p.evaluate(`(() => { const f = document.querySelector('#sheet .adp-stories'); if (!f) return null; const b = f.getBoundingClientRect();
    return { ratio: b.width / b.height, img: f.querySelector('img.adp-creative')?.getAttribute('src')?.slice(0, 15) ?? null, side: Boolean(f.querySelector('.adp-st-side')), reply: Boolean(f.querySelector('.adp-st-reply')) }; })()`);
  r.check('G: Stories em moldura 9:16 com a imagem, ícones laterais e barra de resposta',
    st && near(st.ratio, 9 / 16, 0.02) && st.img === 'data:image/jpeg' && st.side && st.reply, JSON.stringify(st));
  shot('13-G-stories');
  await p.tap('#sheet .adp-modes button', 'marketplace');
  await p.sleep(300);
  const mk = await p.evaluate(`(() => { const g = document.querySelector('#sheet .adp-market'); if (!g) return null; const img = g.querySelector('.adp-card.mine img');
    const b = img.getBoundingClientRect(); return { cols: getComputedStyle(g).gridTemplateColumns.split(' ').length, text: g.textContent, w: b.width, h: b.height,
      src: img.getAttribute('src').slice(0, 15), cards: g.querySelectorAll('.adp-card').length }; })()`);
  r.check('G: Marketplace em 2 colunas com "R$ 99,90" e "Frete grátis"', mk && mk.cols === 2 && mk.text.includes('R$ 99,90') && mk.text.includes('Frete grátis'), JSON.stringify(mk && { cols: mk.cols, cards: mk.cards }));
  r.check('G: o criativo no card tem 170 px CSS de lado e src data:image/jpeg', mk && near(mk.w, 170, 0.5) && near(mk.h, 170, 0.5) && mk.src === 'data:image/jpeg', JSON.stringify(mk && { w: mk.w, h: mk.h, src: mk.src }));
  shot('13-G-marketplace');
  await closeSheet();
  await p.evaluate(`(ppEditor.setBrandKit({ profile: { company: 'Loja Teste E2E' }, colors: {}, fonts: {} }), true)`);
  await p.tap('#topbar button', 'Preview');
  await p.sleep(300);
  const named = await p.evaluate(`document.querySelector('#sheet .adp-feed')?.textContent ?? ''`);
  r.check('G: com brand kit o Feed mostra o nome da empresa', named.includes('Loja Teste E2E') && !named.includes('Sua Loja'), named.slice(0, 80));
  await closeSheet();
});

// ---------- H: guia manual ----------
await step('H guia manual', async () => {
  await p.tap('#tabs button', 'Tamanho');
  await setSelect('Grade', 'none');
  const ok = await p.evaluate(`(() => { const i = document.querySelector('#sheet input.guide-pos'); if (!i) return false; i.value = '200'; i.dispatchEvent(new Event('input')); return true; })()`);
  if (!ok) throw new Error('campo da guia manual não existe');
  await p.evaluate('document.activeElement && document.activeElement.blur && document.activeElement.blur()');
  await p.tap('#sheet .row.guides button', 'Adicionar');
  const listed = await p.evaluate(`document.querySelector('#sheet .guide-list')?.textContent ?? ''`);
  await closeSheet();
  const guides = await p.evaluate('JSON.stringify(editor.customGuides ?? null)');
  r.check('H: "Tamanho" → guia vertical em 200 px', guides === JSON.stringify([{ axis: 'x', pos: 200 }]) && listed.includes('200'), `${guides} | ${listed}`);
  await p.evaluate('(editor.canvas.discardActiveObject(), editor.canvas.requestRenderAll(), true)');
  await p.sleep(250);
  const px = await screenPixels([60, 80, 100, 120].map((y) => [200, y + 800]));
  r.check('H: a guia aparece na tela em x = 200 (violeta)', px.some((c) => isColor(c, [124, 77, 255], 60)), JSON.stringify(px));
  await selectRect();
  const s = await dragRectLeftTo(200 + 3 / Z0);
  r.check('H: arrastar para perto → borda esquerda encaixa em 200 (tol 0,5)', near(s.bl, 200, 0.5), `left ${s.bl.toFixed(2)}`);
  shot('13-H-guia');
  await p.evaluate('(editor.clearCustomGuides(), true)');
});

// ---------- I: bug lateral (zona segura em escala) ----------
await step('I zona segura', async () => {
  await p.tap('#tabs button', 'Tamanho');
  await setSelect('Zona Segura', 'marketplace-1x1');
  await closeSheet();
  await p.evaluate(`(() => { const o = editor.canvas.getObjects().find((x) => x.layerName === 'E2E13'); o.set({ left: 540, top: 540, originX: 'center', originY: 'center' });
    o.setCoords(); editor.canvas.discardActiveObject(); editor.canvas.requestRenderAll(); return true; })()`);
  await p.sleep(300);
  const px = await screenPixels([500, 510, 520, 530, 540, 550, 560, 570].map((y) => [135, y]));
  r.check('I: tracejado ciano #00e5ff da zona Marketplace em x = 135 do documento (12,5%)', px.some((c) => isColor(c, [0, 229, 255], 50)), JSON.stringify(px));
  shot('13-I-zona-marketplace');
  await p.tap('#tabs button', 'Tamanho');
  await setSelect('Zona Segura', 'none');
  await closeSheet();
});

// ---------- T3 dentro do roteiro: desenho à mão a 200% e teclado ----------
await step('T3 desenho a 200%', async () => {
  await p.tap('#zoom-pill .zoom-in');
  await p.tap('#zoom-pill .zoom-in');
  await p.sleep(300);
  await p.tap('#tabs button', 'Formas');
  await p.tap('#sheet .draw-btn');
  await p.sleep(400);
  const x1 = stage.x - 80;
  const y1 = stage.top + 60;
  const start = await toDoc(x1, y1);
  await p.drag(x1, y1, x1 + 120, y1, { steps: 14 });
  await p.sleep(400);
  const path = await p.evaluate(`(() => { const ps = editor.freehandStrokes(); const o = ps[ps.length - 1]; if (!o) return null; const b = o.getBoundingRect();
    return { left: b.left, top: b.top, h: b.height, sw: o.strokeWidth }; })()`);
  const tol = 6 + (path?.sw ?? 0);
  r.check('T3: a 200% o traço nasce sob o dedo (tol 6 px do doc + espessura)',
    path && near(path.left, start.x, tol) && near(path.top + path.h / 2, start.y, tol), `${JSON.stringify(start)} ${JSON.stringify(path)}`);
  shot('13-T3-traco-200');
  await p.tap('button.finish-draw');
  await p.sleep(300);
});

await step('T3 teclado', async () => {
  const before = (await view()).factor;
  await p.tap('#topbar button.title');
  await p.sleep(1500); // teclado abre e o #stage encolhe
  shot('13-T3-teclado');
  await p.evaluate('document.activeElement && document.activeElement.blur && document.activeElement.blur()');
  await p.tap('#sheet button', 'Cancelar');
  await p.sleep(1200);
  const after = await view();
  r.check('T3: abrir/fechar "Renomear" (teclado) mantém o fator de zoom', after.factor === before, `${before} → ${after.factor}`);
});

const errors = p.logs.filter((l) => l.startsWith('EXCEPTION'));
r.check('sem exceção JS na página durante o roteiro', errors.length === 0, errors.slice(0, 3).join(' | '));
await p.evaluate('(editor.resetZoom && editor.resetZoom(), true)').catch(() => {});
r.done();
p.close();
