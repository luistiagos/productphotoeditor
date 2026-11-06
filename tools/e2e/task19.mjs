// E2E TASK-19 (📦 Mockup 3D → Caixa 3D: Rotação X/Y, faces visíveis, cor/arte por face com a luz de cada face,
// troca de modo com os templates da TASK-08, Salvar na galeria, Inserir no design).
// Uso: ANDROID_SERIAL=<serial> node tools/e2e/task19.mjs <pasta-de-prints>   (moto: E2E_FORMAT="Post Instagram")
// Toques reais nas abas, tiles e botões. Sliders, seletores e cores recebem o valor por evento (o seletor nativo de cor
// não é elemento da página). Os sinais são o estado exposto (`__mockupStudio.state().box`: faces visíveis na ordem de
// pintura e o quad de cada uma em px do preview) e os pixels do <canvas.mockup-preview> no centro de cada face. Na base
// (sem a TASK-19) o estúdio abre sem o tile "Caixa 3D": o script prova a ausência e para (controle positivo).
import { adbShell, launchEditor, reporter, screencap } from './cdp.mjs';

const out = process.argv[2] ?? '.';
const p = await launchEditor();
const r = reporter('TASK-19 — Mockup Caixa 3D');

const SHEET_OPEN = `document.getElementById('sheet').classList.contains('show')`;
const closeSheet = async () => { await p.tap('#sheet .sheet-head button'); await p.sleep(250); };
const setRange = (label, value) => p.evaluate(`(() => {
  const l = [...document.querySelectorAll('#sheet label.slider')].find((x) => x.textContent.includes(${JSON.stringify(label)}));
  const s = l.querySelector('input'); s.value = ${JSON.stringify(String(value))}; s.dispatchEvent(new Event('input'));
  s.dispatchEvent(new Event('change')); return Number(s.value); })()`);
const setFaceColor = (slot, hex) => p.evaluate(`(() => {
  const i = document.querySelector('#sheet .mockup-face[data-slot="${slot}"] input[type=color]');
  i.value = ${JSON.stringify(hex)}; i.dispatchEvent(new Event('input')); return i.value; })()`);
const setFaceArt = (slot, v) => p.evaluate(`(() => {
  const s = document.querySelector('#sheet .mockup-face[data-slot="${slot}"] select');
  s.value = ${JSON.stringify(v)}; s.dispatchEvent(new Event('change')); return s.value; })()`);
const state = () => p.evaluate('__mockupStudio.state()');
/** Roda `act` e espera o preview renderizar de novo (o render é por requestAnimationFrame). */
const rendered = async (act) => {
  const n = (await state()).renders;
  await act();
  await p.waitFor(`__mockupStudio.state().renders > ${n}`, 8000).catch(() => {});
  await p.sleep(100);
};
const toastText = () => p.evaluate(`document.getElementById('toast').textContent`);
const listPictures = () => {
  try { return adbShell('ls /sdcard/Pictures/ProductPhoto/').split(/\s+/).filter(Boolean); } catch { return []; }
};
const sorted = (a) => [...(a ?? [])].sort();
/** Pixel RGB do preview no centro (média dos 4 cantos) de cada face visível + hash FNV-1a da região da frente. */
const faceSamples = () => p.evaluate(`(() => {
  const st = __mockupStudio.state().box;
  const c = document.querySelector('canvas.mockup-preview');
  const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
  const res = {};
  for (const [name, q] of Object.entries(st.faceQuads)) {
    const x = Math.round(q.reduce((s, v) => s + v[0], 0) / 4);
    const y = Math.round(q.reduce((s, v) => s + v[1], 0) / 4);
    const o = (y * c.width + x) * 4;
    res[name] = [d[o], d[o + 1], d[o + 2]];
  }
  const f = st.faceQuads.front;
  let h = 2166136261;
  if (f) {
    const xs = f.map((v) => v[0]), ys = f.map((v) => v[1]);
    for (let y = Math.ceil(Math.min(...ys)); y < Math.max(...ys); y++) for (let x = Math.ceil(Math.min(...xs)); x < Math.max(...xs); x++) {
      const o = (y * c.width + x) * 4; h ^= d[o] + 3 * d[o + 1] + 7 * d[o + 2]; h = Math.imul(h, 16777619);
    }
  }
  return { px: res, frontHash: (h >>> 0).toString(16), visible: st.visibleFaces };
})()`);
const inRange = (v, lo, hi) => v >= lo && v <= hi;

// ---------- arte: fundo azul forte + um título ----------
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

// ---------- estúdio + controle positivo: o tile "Caixa 3D" existe? ----------
await p.tap('#tabs button', 'Mockup 3D');
await p.waitFor(SHEET_OPEN, 5000);
await p.waitFor(`document.querySelectorAll('#sheet .mockup-tile').length >= 5`, 10000);
const hasBox = await p.evaluate(`document.querySelector('.mockup-studio')?.textContent.includes('Caixa 3D') ?? false`);
if (!hasBox) {
  r.check('tile "Caixa 3D" existe no estúdio 📦 Mockup 3D', false, 'ausente (base sem a TASK-19)');
  screencap(`${out}/19-base-estudio.png`);
  r.done();
  p.close();
  process.exit();
}
r.check('tile "Caixa 3D" existe no estúdio 📦 Mockup 3D', true);

await p.tap('#sheet .mockup-tile', 'Caixa 3D');
await p.waitFor(`__mockupStudio.state().template === 'box' && __mockupStudio.state().renders > 0`, 10000);
await p.sleep(300);
const st0 = await state();
const ui0 = await p.evaluate(`(() => ({
  handlesHidden: [...document.querySelectorAll('#sheet .mockup-handle')].every((e) => e.hidden),
  arcHidden: document.querySelector('#sheet .mockup-arc').hidden,
  boxShown: !document.querySelector('#sheet .mockup-box').hidden,
  faceRows: document.querySelectorAll('#sheet .mockup-face').length,
}))()`);
r.check('0. Caixa 3D: modo box3d, X −20 / Y 30, frente + lateral direita + topo; alças e Arco ocultos, 3 linhas de face',
  st0.shape === 'box3d' && st0.box?.rotX === -20 && st0.box?.rotY === 30
  && JSON.stringify(sorted(st0.box?.visibleFaces)) === '["front","right","top"]'
  && ui0.handlesHidden && ui0.arcHidden && ui0.boxShown && ui0.faceRows === 3, JSON.stringify({ box: st0.box, ui0 }));
screencap(`${out}/19-0-caixa.png`);

// ---------- 1. X = 0, Y = 0 → só a frente ----------
await rendered(() => setRange('Rotação X', 0));
await rendered(() => setRange('Rotação Y', 0));
const st1 = await state();
r.check('1. Rotação X = 0 e Y = 0 → visibleFaces = [front]', JSON.stringify(st1.box.visibleFaces) === '["front"]',
  JSON.stringify(st1.box.visibleFaces));

// ---------- 2. Y = +30 → frente + direita; Y = −30 → esquerda ----------
await rendered(() => setRange('Rotação Y', 30));
const st2a = await state();
await rendered(() => setRange('Rotação Y', -30));
const st2b = await state();
r.check('2. Rotação Y +30 → front + right; −30 → front + left',
  JSON.stringify(sorted(st2a.box.visibleFaces)) === '["front","right"]' && JSON.stringify(sorted(st2b.box.visibleFaces)) === '["front","left"]',
  JSON.stringify({ mais30: st2a.box.visibleFaces, menos30: st2b.box.visibleFaces }));

// ---------- 3. X = −25 → topo ----------
await rendered(() => setRange('Rotação Y', 0));
await rendered(() => setRange('Rotação X', -25));
const st3 = await state();
r.check('3. Rotação X −25 → contém top (e front)', st3.box.visibleFaces.includes('top') && st3.box.visibleFaces.includes('front'),
  JSON.stringify(st3.box.visibleFaces));

// ---------- 4. cores por face com a luz de cada face (X −25, Y +30) ----------
await rendered(() => setRange('Rotação Y', 30));
await rendered(() => setFaceColor('front', '#c00000'));
await rendered(() => setFaceColor('side', '#00c000'));
await rendered(() => setFaceColor('top', '#0000c0'));
const st4 = await state();
const s4 = await faceSamples();
const [fr, ri, to] = [s4.px.front, s4.px.right, s4.px.top];
r.check('4. cores: frente R ∈ [185,199] (100 %), lateral G ∈ [143,157] (78 %), topo B ∈ [200,214] (108 %), outros canais < 20',
  st4.box.faceArt.front === 'color' && st4.box.faceArt.side === 'color' && st4.box.faceArt.top === 'color'
  && !!fr && !!ri && !!to
  && inRange(fr[0], 185, 199) && fr[1] < 20 && fr[2] < 20
  && inRange(ri[1], 143, 157) && ri[0] < 20 && ri[2] < 20
  && inRange(to[2], 200, 214) && to[0] < 20 && to[1] < 20,
  JSON.stringify({ visible: s4.visible, px: s4.px, faceArt: st4.box.faceArt }));
screencap(`${out}/19-4-cores.png`);

// ---------- 5. Frente = Design atual ----------
await rendered(() => setFaceArt('front', 'design'));
const st5 = await state();
const s5 = await faceSamples();
const f5 = s5.px.front;
r.check('5. Arte da Frente = Design atual → a frente deixa de ser o vermelho sólido (pixel e hash mudam)',
  st5.box.faceArt.front === 'design' && !!f5 && !(inRange(f5[0], 185, 199) && f5[1] < 20 && f5[2] < 20) && s5.frontHash !== s4.frontHash,
  JSON.stringify({ antes: { px: fr, hash: s4.frontHash }, depois: { px: f5, hash: s5.frontHash } }));
screencap(`${out}/19-5-design-na-frente.png`);

// ---------- 5b. troca de modo: Caneca volta às alças; Caixa 3D de novo restaura o modo caixa ----------
await p.tap('#sheet .mockup-tile', 'Caneca');
await p.waitFor(`__mockupStudio.state().template === 'mug'`, 10000);
await p.sleep(300);
const ui5 = await p.evaluate(`(() => ({ shape: __mockupStudio.state().shape, box: __mockupStudio.state().box,
  handlesShown: [...document.querySelectorAll('#sheet .mockup-handle')].every((e) => !e.hidden),
  boxHidden: document.querySelector('#sheet .mockup-box').hidden, arcShown: !document.querySelector('#sheet .mockup-arc').hidden }))()`);
await p.tap('#sheet .mockup-tile', 'Caixa 3D');
await p.waitFor(`__mockupStudio.state().template === 'box'`, 10000);
await p.sleep(400);
const st5b = await state();
r.check('5b. Caneca: cilindro com alças e Arco, sem controles da caixa; de volta à Caixa 3D, modo caixa com as faces escolhidas',
  ui5.shape === 'cylinder' && ui5.box === null && ui5.handlesShown && ui5.boxHidden && ui5.arcShown
  && st5b.shape === 'box3d' && st5b.box.faceArt.front === 'design' && st5b.box.faceColor.side === '#00c000',
  JSON.stringify({ ui5, box: st5b.box && { rot: [st5b.box.rotX, st5b.box.rotY], faceArt: st5b.box.faceArt } }));

// ---------- 7. Salvar na galeria (antes de inserir: inserir fecha a folha) ----------
const before = new Set(listPictures());
await p.tap('#sheet .mockup-save');
await p.waitFor(`!document.getElementById('busy').classList.contains('show')`, 20000);
await p.sleep(600);
const toast7 = await toastText();
const created = listPictures().filter((n) => !before.has(n) && n.startsWith('mockup_box') && n.endsWith('.jpg'));
r.check('7. Salvar na galeria: toast com o local e um mockup_box*.jpg novo em Pictures/ProductPhoto', toast7.startsWith('Salvo em')
  && created.length === 1, JSON.stringify({ toast: toast7, created }));

// ---------- 6. Inserir no design ----------
const n6 = await p.evaluate('editor.canvas.getObjects().length');
await p.tap('#sheet .mockup-insert');
await p.waitFor(`editor.canvas.getObjects().length === ${n6 + 1}`, 20000).catch(() => {});
await p.sleep(500);
const last = await p.evaluate(`(() => { const os = editor.canvas.getObjects(); const o = os[os.length - 1];
  return { n: os.length, type: o.type, w: Math.round(o.width), h: Math.round(o.height), sheet: ${SHEET_OPEN} }; })()`);
r.check('6. Inserir no design: +1 objeto, do tipo imagem, na resolução da base (1200²), e a folha fecha',
  last.n === n6 + 1 && String(last.type).toLowerCase() === 'image' && last.w === 1200 && last.h === 1200 && !last.sheet,
  JSON.stringify(last));
screencap(`${out}/19-6-inserido.png`);

r.check('sem exceções JS no console', !p.logs.some((l) => l.startsWith('EXCEPTION')), p.logs.filter((l) => l.startsWith('EXCEPTION')).join(' | '));
console.log(`arquivo criado na galeria do aparelho (anotar na evidência): ${created.join(', ') || '(nenhum)'}`);
r.done();
p.close();
