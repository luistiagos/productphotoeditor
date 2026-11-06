// E2E TASK-08 (📦 Mockup 3D: cilindro/esfera/plano, Arco, Fusão com dobras/luz, alças, Salvar na galeria, Inserir no design).
// Uso: ANDROID_SERIAL=<serial> node tools/e2e/task08.mjs <pasta-de-prints>   (moto: E2E_FORMAT="Post Instagram")
// Toques reais nas abas, tiles e botões; a alça é arrastada com o dedo (touch → pointer events). Sliders, seletor e cor
// recebem o valor por evento (o seletor nativo não é elemento da página). Os sinais são pixels do <canvas.mockup-preview>
// contra a base pura (`__mockupStudio.basePreview()`), lidos por `getImageData`. Na base (sem a TASK-08) a aba não existe:
// o script prova a ausência e para (controle positivo).
import { adbShell, launchEditor, reporter, screencap } from './cdp.mjs';

const out = process.argv[2] ?? '.';
const p = await launchEditor();
const r = reporter('TASK-08 — Mockup 3D');

const SHEET_OPEN = `document.getElementById('sheet').classList.contains('show')`;
const closeSheet = async () => { await p.tap('#sheet .sheet-head button'); await p.sleep(250); };
const setRange = (label, value) => p.evaluate(`(() => {
  const l = [...document.querySelectorAll('#sheet label.slider')].find((x) => x.textContent.includes(${JSON.stringify(label)}));
  const s = l.querySelector('input'); s.value = ${JSON.stringify(String(value))}; s.dispatchEvent(new Event('input'));
  s.dispatchEvent(new Event('change')); return Number(s.value); })()`);
const state = () => p.evaluate('__mockupStudio.state()');
/** Roda `act` e espera o preview renderizar de novo (o render é por requestAnimationFrame). */
const rendered = async (act) => {
  const n = (await state()).renders;
  await act();
  // sem render novo o passo falha na própria verificação (não derruba o script)
  await p.waitFor(`__mockupStudio.state().renders > ${n}`, 8000).catch(() => {});
  await p.sleep(100);
};
const toastText = () => p.evaluate(`document.getElementById('toast').textContent`);
const listPictures = () => {
  try { return adbShell('ls /sdcard/Pictures/ProductPhoto/').split(/\s+/).filter(Boolean); } catch { return []; }
};

/**
 * Medidas do preview em coordenadas do quad (s, t ∈ [0,1], interpolação bilinear dos cantos): `hash` (FNV-1a dos pixels),
 * `artFrac` (fração de amostras no miolo do quad diferentes da base), `rowWidth` (px da linha central diferentes da
 * base), `bandLum` (luminância média da arte na faixa s ∈ [0,82; 0,92], a borda escura do cilindro).
 */
const measure = () => p.evaluate(`(() => {
  const st = __mockupStudio.state();
  const base = __mockupStudio.basePreview().data;
  const c = document.querySelector('canvas.mockup-preview');
  const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
  const k = c.width / st.baseWidth;
  const q = st.quad.map(([x, y]) => [x * k, y * k]);
  const at = (s, t) => [0, 1].map((i) => (1 - s) * (1 - t) * q[0][i] + s * (1 - t) * q[1][i] + s * t * q[2][i] + (1 - s) * t * q[3][i]);
  const idx = (x, y) => (Math.round(y) * c.width + Math.round(x)) * 4;
  const diff = (o) => Math.abs(d[o] - base[o]) + Math.abs(d[o + 1] - base[o + 1]) + Math.abs(d[o + 2] - base[o + 2]);
  let h = 2166136261;
  for (let i = 0; i < d.length; i++) { h ^= d[i]; h = Math.imul(h, 16777619); }
  let n = 0, hit = 0;
  for (let s = 0.3; s <= 0.7001; s += 0.05) for (let t = 0.3; t <= 0.7001; t += 0.05) { n++; if (diff(idx(...at(s, t))) > 60) hit++; }
  const yMid = Math.round(at(0.5, 0.5)[1]);
  let rowWidth = 0;
  for (let x = 0; x < c.width; x++) if (diff((yMid * c.width + x) * 4) > 60) rowWidth++;
  let lum = 0, m = 0;
  for (let s = 0.82; s <= 0.9201; s += 0.02) for (let t = 0.3; t <= 0.7001; t += 0.04) {
    const o = idx(...at(s, t));
    if (diff(o) > 30) { lum += 0.299 * d[o] + 0.587 * d[o + 1] + 0.114 * d[o + 2]; m++; }
  }
  return { hash: (h >>> 0).toString(16), artFrac: hit / n, rowWidth, bandLum: m ? lum / m : null, bandN: m };
})()`);

// ---------- arte: fundo azul forte + um título (a arte não pode sumir num mockup branco) ----------
await p.tap('#tabs button', 'Fundo');
await p.waitFor(SHEET_OPEN, 5000);
await p.evaluate(`(() => { const l = [...document.querySelectorAll('#sheet label.color')].find((x) => x.textContent.includes('Cor sólida'));
  const i = l.querySelector('input'); i.value = '#1e50c8'; i.dispatchEvent(new Event('input')); return i.value; })()`);
await closeSheet();
await p.tap('#tabs button', 'Texto');
await p.waitFor(SHEET_OPEN, 5000);
await p.tap('#sheet button', 'Adicionar título');
await p.sleep(400);
await p.evaluate('editor.canvas.discardActiveObject(), editor.canvas.requestRenderAll(), true');

// ---------- controle positivo: a aba existe? ----------
const hasTab = await p.evaluate(`[...document.querySelectorAll('#tabs button')].some((b) => b.textContent.includes('Mockup 3D'))`);
if (!hasTab) {
  r.check('aba "📦 Mockup 3D" existe', false, 'ausente (base sem a TASK-08)');
  screencap(`${out}/08-base-abas.png`);
  r.done();
  p.close();
  process.exit();
}
r.check('aba "📦 Mockup 3D" existe', true);

// ---------- 1. Caneca ----------
await p.tap('#tabs button', 'Mockup 3D');
await p.waitFor(SHEET_OPEN, 5000);
await p.waitFor(`document.querySelectorAll('#sheet .mockup-tile').length >= 5`, 10000);
const tiles = await p.evaluate(`[...document.querySelectorAll('#sheet .mockup-tile')].map((b) => b.textContent)`);
r.check('folha lista os 5 templates 2.5D e os 4 planos', ['Caneca', 'Pote / Garrafa', 'Bola', 'Ecobag', 'Camiseta', 'Pôster na parede']
  .every((n) => tiles.includes(n)) && tiles.length === 9, JSON.stringify(tiles));
await p.tap('#sheet .mockup-tile', 'Caneca');
await p.waitFor(`__mockupStudio.state().template === 'mug' && __mockupStudio.state().renders > 0`, 10000);
await p.sleep(300);
const st1 = await state();
const m1 = await measure();
r.check('1. Caneca: cilindro, arco 110, a arte aparece dentro do quad (≥ 60% das amostras do miolo diferentes da base)',
  st1.shape === 'cylinder' && st1.arcDeg === 110 && m1.artFrac >= 0.6, JSON.stringify({ shape: st1.shape, arc: st1.arcDeg, m1 }));
screencap(`${out}/08-1-caneca.png`);

// ---------- 2. Arco 110 → 170 ----------
await rendered(() => setRange('Arco', 170));
const m2 = await measure();
r.check('2. Arco 170: pixels do preview mudam e a largura útil da arte na linha central diminui',
  m2.hash !== m1.hash && m2.rowWidth < m1.rowWidth && m2.rowWidth > 0, JSON.stringify({ antes: m1.rowWidth, depois: m2.rowWidth }));
screencap(`${out}/08-2-arco170.png`);
await rendered(() => setRange('Arco', 110));

// ---------- 3. Fusão 0 → 1 ----------
await rendered(() => setRange('Fusão', 0));
const m3a = await measure();
await rendered(() => setRange('Fusão', 1));
const m3b = await measure();
r.check('3. Fusão 0 → 1: a luminância da arte na faixa da borda escura do cilindro cai',
  m3a.bandLum !== null && m3b.bandLum !== null && m3b.bandLum < m3a.bandLum - 3, JSON.stringify({ fusao0: m3a, fusao1: m3b }));
screencap(`${out}/08-3-fusao1.png`);

// ---------- 4. alça arrastada com o dedo ----------
const q0 = (await state()).quad[0];
const hc = await p.center('#sheet .mockup-handle[data-corner="0"]');
await rendered(() => p.drag(hc.x, hc.y, hc.x - 40, hc.y - 30, { steps: 14 }));
const st4 = await state();
const moved = Math.hypot(st4.quad[0][0] - q0[0], st4.quad[0][1] - q0[1]);
r.check('4. arrastar a alça do canto topo-esq move o canto do quad (> 20 px da base)', moved > 20,
  JSON.stringify({ antes: q0, depois: st4.quad[0], px: Math.round(moved) }));
const m4 = await measure();
screencap(`${out}/08-4-alca.png`);

// ---------- 5. Forma = Esfera ----------
await rendered(() => p.evaluate(`(() => { const s = document.querySelector('#sheet .mockup-shape select'); s.value = 'sphere';
  s.dispatchEvent(new Event('change')); return s.value; })()`));
const st5 = await state();
const m5 = await measure();
r.check('5. Forma = Esfera: o preview muda e o quad ajustado fica como estava', st5.shape === 'sphere' && m5.hash !== m4.hash
  && JSON.stringify(st5.quad) === JSON.stringify(st4.quad), JSON.stringify({ shape: st5.shape, quad: st5.quad }));
screencap(`${out}/08-5-esfera.png`);

// ---------- 7. Salvar na galeria (antes de inserir: inserir fecha a folha) ----------
const before = new Set(listPictures());
await p.tap('#sheet .mockup-save');
await p.waitFor(`!document.getElementById('busy').classList.contains('show')`, 20000);
await p.sleep(600);
const toast7 = await toastText();
const created = listPictures().filter((n) => !before.has(n) && n.startsWith('mockup_mug') && n.endsWith('.jpg'));
r.check('7. Salvar na galeria: toast com o local e um mockup_mug*.jpg novo em Pictures/ProductPhoto', toast7.startsWith('Salvo em')
  && created.length === 1, JSON.stringify({ toast: toast7, created }));

// ---------- 6. Inserir no design ----------
const n6 = await p.evaluate('editor.canvas.getObjects().length');
await p.tap('#sheet .mockup-insert');
await p.waitFor(`editor.canvas.getObjects().length === ${n6 + 1}`, 20000);
await p.sleep(500);
const last = await p.evaluate(`(() => { const os = editor.canvas.getObjects(); const o = os[os.length - 1];
  return { type: o.type, w: Math.round(o.width), h: Math.round(o.height), sheet: ${SHEET_OPEN} }; })()`);
r.check('6. Inserir no design: +1 objeto na página, do tipo imagem, na resolução da base (1200²), e a folha fecha',
  String(last.type).toLowerCase() === 'image' && last.w === 1200 && last.h === 1200 && !last.sheet, JSON.stringify(last));
screencap(`${out}/08-6-inserido.png`);

r.check('sem exceções JS no console', !p.logs.some((l) => l.startsWith('EXCEPTION')), p.logs.filter((l) => l.startsWith('EXCEPTION')).join(' | '));
console.log(`arquivo criado na galeria do aparelho (anotar na evidência): ${created.join(', ') || '(nenhum)'}`);
r.done();
p.close();
