// E2E TASK-18 (🖌️ Retocar recorte depois do ✨ Remover fundo: Apagar / Restaurar com borda suave) no app real.
// Uso: ANDROID_SERIAL=<serial> node tools/e2e/task18.mjs <pasta-de-prints>   (moto: E2E_FORMAT="Post Instagram")
// A foto é um cenário do APK (servido pelo asset loader: o `ai.removeBg` recusa `data:`). Os pontos de teste saem do
// recorte REAL: P_t = miolo transparente (fundo removido), P_s = miolo opaco (sujeito), com folga de um raio de pincel.
// Os traços são arrastos de dedo (CDP touch) sobre esses pontos; os sinais são pixels lidos do elemento da imagem, a
// `src` (/blob/edit-…) e a `originalSrcBeforeCutout`. Na base (sem a TASK-18) o botão não existe: o script prova a
// ausência e para (controle positivo). O rascunho de teste fica na lista (nome no fim da saída).
import { mkdirSync } from 'node:fs';
import { adbShell, connect, launchEditor, reporter, screencap, uiFind, uiTap } from './cdp.mjs';

const PKG = 'com.productphoto.offline';
const out = process.argv[2] ?? '.';
mkdirSync(out, { recursive: true });
const NAME = `E2E 18 ${Date.now().toString(36)}`;
const SCENE = 'https://appassets.androidplatform.net/assets/content/scenes/pastel_podium.webp';
const SCENE2 = 'https://appassets.androidplatform.net/assets/content/scenes/marble_counter.webp';
const BRUSH = 40; // diâmetro do pincel, px da página (o padrão da barra)
const r = reporter(`TASK-18 — Retocar recorte (${NAME})`);

let p = await launchEditor();
const idle = () => p.waitFor(`!document.getElementById('busy').classList.contains('show')`, 240000).catch(() => {});
const toastText = () => p.evaluate(`document.getElementById('toast').textContent`);
const shot = (name) => screencap(`${out}/${name}.png`);
/** Funções na página: a imagem atual, pixels do elemento e conversão px da imagem → tela. */
const installHelpers = () => p.evaluate(`(() => {
  window.__img18 = () => editor.canvas.getObjects().find((o) => o.type === 'image');
  window.__px18 = (el, W, H) => { const c = document.createElement('canvas'); c.width = W; c.height = H;
    const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(el, 0, 0, W, H); return x.getImageData(0, 0, W, H); };
  window.__size18 = (img) => { const el = img._originalElement; return { W: el.naturalWidth || el.width, H: el.naturalHeight || el.height }; };
  window.__at18 = (x, y) => { const img = __img18(); const { W, H } = __size18(img); const d = __px18(img._originalElement, W, H).data;
    const i = (Math.round(y) * W + Math.round(x)) * 4; return [d[i], d[i + 1], d[i + 2], d[i + 3]]; };
  window.__toClient18 = (x, y) => { const i = __img18(); const m = i.calcTransformMatrix();
    const lx = x - i.width / 2 - i.cropX, ly = y - i.height / 2 - i.cropY;
    return editor.docToClient(m[0] * lx + m[2] * ly + m[4], m[1] * lx + m[3] * ly + m[5]); };
  window.__state18 = () => { const i = __img18(); return i ? { src: i.getSrc(), orig: i.get('originalSrcBeforeCutout'), ...__size18(i),
    refining: editor.isRefining, info: editor.refineInfo() ? { ...editor.refineInfo(), img: undefined } : null } : null; };
  return true;
})()`);
const state = () => p.evaluate('__state18()');
const at = (pt) => p.evaluate(`__at18(${pt.x}, ${pt.y})`);
const selectImage = async () => {
  await p.evaluate(`(() => { editor.canvas.setActiveObject(__img18()); editor.canvas.requestRenderAll(); return true; })()`);
  await p.sleep(400);
};
/** Arrasto de dedo de `a` a `b` (px da imagem). */
const stroke = async (a, b) => {
  const c1 = await p.evaluate(`__toClient18(${a.x}, ${a.y})`);
  const c2 = await p.evaluate(`__toClient18(${b.x}, ${b.y})`);
  await p.drag(c1.x, c1.y, c2.x, c2.y, { steps: 14 });
  await p.sleep(400);
};

// ---------- 1. foto do APK, selecionada ----------
await p.evaluate(`(async () => {
  await editor.newDocument(${JSON.stringify(NAME)}, 1080, 1080);
  const img = await editor.addImage(${JSON.stringify(SCENE)});
  const s = 900 / Math.max(img.width, img.height);
  img.set({ scaleX: s, scaleY: s, left: 540, top: 540, originX: 'center', originY: 'center' });
  img.setCoords();
  editor.canvas.setActiveObject(img); editor.canvas.requestRenderAll(); editor.commit();
  return true;
})()`);
await installHelpers();
await p.sleep(600);
const s1 = await state();
r.check('1. foto do APK inserida e selecionada', s1?.src === SCENE, JSON.stringify(s1));

// ---------- 2. ✨ Remover fundo ----------
await p.tap('#props button', '✨ Remover fundo');
await p.sleep(500);
await idle();
await p.sleep(800);
const s2 = await state();
const toast2 = await toastText();
shot('01-recorte');
r.check('2. ✨ Remover fundo trocou a foto pelo recorte (/blob/ai-…)', /\/blob\/ai-/.test(s2.src), `${s2.src} · toast "${toast2}"`);
const hasBtn = await p.evaluate(`Boolean(document.querySelector('#props .refine-btn'))`);
const uiBtn = uiFind('🖌️ Retocar recorte');
if (!hasBtn) {
  // controle positivo (base): sem o botão e sem a propriedade
  r.check('BASE: depois do recorte, o painel NÃO tem "🖌️ Retocar recorte" e a imagem não guarda a original',
    /\/blob\/ai-/.test(s2.src) && !uiBtn && s2.orig === undefined, JSON.stringify({ src: s2.src, uiBtn, orig: s2.orig }));
  r.done();
  process.exit();
}
// o DOM decide; o uiautomator (texto do WebView com emoji) vai só no detalhe
r.check('2. o painel da imagem mostra "🖌️ Retocar recorte"', hasBtn, `uiautomator: ${JSON.stringify(uiBtn)}`);
r.check('2. originalSrcBeforeCutout = a foto antes do recorte', s2.orig === SCENE, String(s2.orig));

// ---------- 3. pontos de teste no recorte real ----------
const scale = await p.evaluate(`(() => { const m = __img18().calcTransformMatrix(); return Math.hypot(m[0], m[1]); })()`);
const R = BRUSH / 2 / scale; // raio do carimbo, px da imagem
const HALF = Math.max(6, Math.round(R * 1.5)); // meio comprimento do traço, px da imagem
const pick = await p.evaluate(`(() => {
  const img = __img18(); const { W, H } = __size18(img); const d = __px18(img._originalElement, W, H).data;
  const a = (x, y) => d[(y * W + x) * 4 + 3];
  const need = Math.ceil(${R} * 1.3), half = ${HALF};
  // a janela inteira do traço + borda do carimbo tem de ter o alfa pedido (amostra a cada 2 px)
  const all = (cx, cy, v) => { for (let y = cy - need; y <= cy + need; y += 2) for (let x = cx - half - need; x <= cx + half + need; x += 2) {
    if (x < 0 || y < 0 || x >= W || y >= H || a(x, y) !== v) return false; } return true; };
  const find = (v) => { const step = Math.max(4, Math.round(Math.min(W, H) / 40));
    for (let y = need; y < H - need; y += step) for (let x = half + need; x < W - half - need; x += step) if (all(x, y, v)) return { x, y };
    return null; };
  let transparent = 0; for (let i = 3; i < d.length; i += 4) if (d[i] === 0) transparent++;
  return { W, H, t: find(0), s: find(255), transparentPct: Math.round(100 * transparent / (W * H)) };
})()`);
r.check('3. o recorte tem miolo transparente (P_t) e miolo opaco (P_s) para o teste', Boolean(pick.t && pick.s),
  JSON.stringify({ ...pick, R: R.toFixed(1), HALF }));
const Pt = pick.t, Ps = pick.s;
const origAt = (pt) => p.evaluate(`(async () => {
  const o = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = ${JSON.stringify(SCENE)}; });
  const { W, H } = __size18(__img18()); const d = __px18(o, W, H).data; const i = (${pt.y} * W + ${pt.x}) * 4;
  return [d[i], d[i + 1], d[i + 2], d[i + 3]];
})()`);

// ---------- 4. 🖌️ Retocar → ➕ Restaurar original sobre P_t → Concluir ----------
const blobAi = s2.src;
if (Pt) {
  const before4 = await at(Pt);
  const edgePt = { x: Pt.x, y: Math.round(Pt.y + R * 0.8) };
  const edgeBefore = await at(edgePt);
  await p.tap('#props .refine-btn');
  await p.waitFor('editor.isRefining', 15000).catch(() => {});
  await idle();
  const bar = await p.evaluate(`({ restore: !document.querySelector('#props .refine-restore')?.disabled, size: document.querySelector('#props .refine-size input')?.value,
    feather: document.querySelector('#props .refine-feather input')?.value, done: Boolean(document.querySelector('#props .refine-done')) })`);
  r.check('4. barra do retoque: Restaurar habilitado, Tamanho 40, Suavidade 50, Concluir', bar.restore && bar.size === '40' && bar.feather === '50' && bar.done, JSON.stringify(bar));
  await p.tap('#props .refine-restore');
  const info4 = (await state()).info;
  r.check('4. modo Restaurar ativo', info4?.mode === 'restore' && info4?.canRestore === true, JSON.stringify(info4));
  await stroke({ x: Pt.x - HALF, y: Pt.y }, { x: Pt.x + HALF, y: Pt.y });
  shot('02-restaurando');
  const live = await p.evaluate(`(() => { const s = editor.refineInfo(); return { strokes: s?.strokes, srcStill: __img18().getSrc() }; })()`);
  r.check('4. o traço entrou na prévia sem trocar a src (retoque só vale no Concluir)', live.strokes === 1 && live.srcStill === blobAi, JSON.stringify(live));
  await p.tap('#props .refine-done');
  await p.sleep(400);
  await idle();
  await p.sleep(800);
  const s4 = await state();
  const after4 = await at(Pt);
  const want = await origAt(Pt);
  const edgeAfter = await at(edgePt);
  shot('03-restaurado');
  r.check('4. Concluir grava blob do editor: src = /blob/edit-<uuid>.png', /^https:\/\/appassets\.androidplatform\.net\/blob\/edit-[0-9a-f-]{36}\.png$/.test(s4.src) && !s4.refining, s4.src);
  r.check('4. P_t voltou opaco com a COR da foto original (±2)', before4[3] === 0 && after4[3] === 255 && after4.slice(0, 3).every((v, i) => Math.abs(v - want[i]) <= 2),
    JSON.stringify({ Pt, before4, after4, want }));
  r.check('4. borda suave: a 0,8 raio do traço o alfa é intermediário', edgeBefore[3] === 0 && edgeAfter[3] > 0 && edgeAfter[3] < 255, JSON.stringify({ edgePt, edgeBefore, edgeAfter }));
  r.check('4. originalSrcBeforeCutout mantida', s4.orig === SCENE, String(s4.orig));
}
const blobRestored = (await state()).src;

// ---------- 5. ➖ Apagar sobra sobre P_s → Concluir; ↶ volta ao recorte anterior ----------
if (Ps) {
  await selectImage();
  const before5 = await at(Ps);
  await p.tap('#props .refine-btn');
  await p.waitFor('editor.isRefining', 15000).catch(() => {});
  await idle();
  await p.tap('#props .refine-erase');
  await stroke({ x: Ps.x - HALF, y: Ps.y }, { x: Ps.x + HALF, y: Ps.y });
  await p.tap('#props .refine-done');
  await p.sleep(400);
  await idle();
  await p.sleep(800);
  const s5 = await state();
  const after5 = await at(Ps);
  shot('04-apagado');
  r.check('5. Apagar: P_s ficou transparente; src = outro /blob/edit-…', before5[3] === 255 && after5[3] === 0 && /\/blob\/edit-/.test(s5.src) && s5.src !== blobRestored,
    JSON.stringify({ Ps, before5, after5, src: s5.src }));
  // ↶ da barra de cima (o instantâneo do replaceImage sai depois do debounce de 250 ms)
  await p.sleep(700);
  await p.tap('#topbar button', '↶');
  await p.sleep(1500);
  await installHelpers();
  const s5u = await state();
  const undo5 = await at(Ps);
  shot('05-desfeito');
  r.check('5. ↶ (1 passo) volta ao recorte anterior: P_s opaco e a src do retoque anterior', undo5[3] === 255 && s5u.src === blobRestored,
    JSON.stringify({ undo5, src: s5u.src, blobRestored }));
}

// ---------- 6. ação de IA depois do retoque: ✨ Melhorar resolução 2× (senão ✨ Remover fundo) ----------
await selectImage();
const s6a = await state();
await p.tap('#props button', '✨ Melhorar resolução');
await p.sleep(600);
await p.tap('#sheet button', '2×');
await p.sleep(800);
await idle();
await p.sleep(800);
let s6 = await state();
let toast6 = await toastText();
let ai6 = 'upscale';
let factor = 1;
if (/\/blob\/ai-/.test(s6.src) && s6.W === s6a.W * 2) factor = 2;
else {
  // upscale indisponível ou entrada grande demais no aparelho: o remover fundo também lê a src retocada
  ai6 = `removeBg (upscale: "${toast6}")`;
  await selectImage();
  await p.tap('#props button', '✨ Remover fundo');
  await p.sleep(500);
  await idle();
  await p.sleep(800);
  s6 = await state();
  toast6 = await toastText();
}
shot('06-ia-depois');
r.check('6. a ação de IA aceita a imagem retocada (sem "imagem fora do editor") e devolve /blob/ai-…',
  /\/blob\/ai-/.test(s6.src) && !/fora do editor/i.test(toast6), JSON.stringify({ ai6, src: s6.src, W: s6.W, before: s6a.W, toast6 }));
r.check('6. originalSrcBeforeCutout continua a foto de antes do 1º recorte', s6.orig === SCENE, String(s6.orig));

// ---------- 7. salvar, matar o app, reabrir o rascunho ----------
const saved = await state();
const PtNow = Pt ? { x: Math.round(Pt.x * factor), y: Math.round(Pt.y * factor) } : null;
const savedPt = PtNow ? await at(PtNow) : null;
await p.tap('#topbar button', 'Salvar');
await p.sleep(2000);
p.close();
adbShell(`am force-stop ${PKG}`);
adbShell(`am start -n ${PKG}/com.productphoto.app.MainActivity`);
await uiTap('Rascunhos');
await new Promise((res) => setTimeout(res, 1500));
await uiTap(NAME);
p = await connect();
await p.waitFor(`document.body.dataset.ready === 'true'`, 20000);
await p.sleep(1200);
await installHelpers();
const s7 = await state();
const reopenPt = PtNow ? await at(PtNow) : null;
shot('07-reaberto');
r.check('7. reaberto pelo Rascunhos: mesma src e mesma originalSrcBeforeCutout', s7?.src === saved.src && s7?.orig === SCENE, JSON.stringify({ saved: saved.src, s7: s7?.src, orig: s7?.orig }));
r.check('7. o pixel restaurado continua igual depois de reabrir', !PtNow || JSON.stringify(reopenPt) === JSON.stringify(savedPt), JSON.stringify({ PtNow, savedPt, reopenPt }));

// ---------- 8. 🔄 Substituir (Logo do brand kit) limpa a original ----------
await p.evaluate(`(() => { ppEditor.setBrandKit({ logoUrl: ${JSON.stringify(SCENE2)} }); return true; })()`);
await selectImage();
await p.tap('#props .swap-btn');
await p.sleep(500);
await p.tap('#sheet .swap-logo');
await p.sleep(600);
await idle();
await p.sleep(600);
const s8 = await state();
const btn8 = await p.evaluate(`(() => { editor.canvas.discardActiveObject(); editor.canvas.setActiveObject(__img18()); return Boolean(document.querySelector('#props .refine-btn')); })()`);
shot('08-substituida');
r.check('8. Substituir troca a foto e apaga originalSrcBeforeCutout (foto opaca: sem "Retocar recorte")', s8.src === SCENE2 && s8.orig === undefined && !btn8,
  JSON.stringify({ src: s8.src, orig: s8.orig, btn8 }));

r.check('sem exceções JS no console', !p.logs.some((l) => l.startsWith('EXCEPTION')), p.logs.filter((l) => l.startsWith('EXCEPTION')).join(' | '));
console.log(`rascunho de teste: "${NAME}" (apague pelo Rascunhos)`);
r.done();
p.close();
