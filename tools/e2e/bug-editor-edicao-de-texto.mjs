// E2E do bug editor-edicao-de-texto (toque longo / "✏️ Editar texto" / folha "Editar texto") no app real.
// Uso: ANDROID_SERIAL=<serial> node tools/e2e/bug-editor-edicao-de-texto.mjs <pasta-de-prints>
// Receita T2 do doc docs/bugs/.../editor-edicao-de-texto.md (seção Planejamento → Plano de teste). Toques reais pelo CDP
// (touchStart/Move/End) e, como complemento, o toque longo pelo `adb shell input swipe`. O texto da folha recebe o valor
// por evento `input` (o teclado não é elemento da página). Cada passo roda mesmo que o anterior falhe: no APK sem o fix
// (controle positivo) o script tem que terminar com FAIL nos passos do toque longo, da folha e da edição inline.
import { execFileSync } from 'node:child_process';
import { adbShell, launchEditor, reporter, screencap } from './cdp.mjs';

const out = process.argv[2] ?? '.';
const p = await launchEditor();
const r = reporter('bug editor-edicao-de-texto — toque longo e folha "Editar texto"');

// o build sem o fix não expõe `window.editor` (só `ppEditor.editor`): o mesmo script roda nos dois APKs
await p.evaluate(`(() => { globalThis.editor ??= window.ppEditor?.editor; return Boolean(globalThis.editor); })()`);
const fullHeight = await p.evaluate('innerHeight');

const step = async (name, fn) => {
  try { await fn(); } catch (e) { r.check(`${name}: passo terminou sem erro`, false, String(e?.message ?? e)); }
};
const shot = (name) => { try { screencap(`${out}/${name}.png`); } catch (e) { console.log(`(print ${name} falhou: ${e.message})`); } };
const inputShown = () => /mInputShown=true/.test(adbShell('dumpsys input_method'));
/** Espera o teclado chegar ao estado `want` (teto ms); devolve o estado lido por último. */
const waitInput = async (want, ms = 3000) => {
  const end = Date.now() + ms;
  for (;;) {
    const now = inputShown();
    if (now === want || Date.now() > end) return now;
    await p.sleep(250);
  }
};
const theText = `editor.canvas.getObjects().find((o) => typeof o.text === 'string')`;
const text = () => p.evaluate(`${theText}?.text ?? null`);
const sheet = () => p.evaluate(`({ show: document.querySelector('#sheet').classList.contains('show'),
  title: document.querySelector('#sheet .sheet-head strong')?.textContent ?? null })`);
/** Centro do texto em CSS px (retângulo do <canvas> superior + ponto do documento pelo viewportTransform). */
const textCenter = () => p.evaluate(`(() => { const t = ${theText}; t.setCoords(); const c = t.getCenterPoint();
  const r = editor.canvas.upperCanvasEl.getBoundingClientRect(); const v = editor.canvas.viewportTransform;
  return { x: r.left + v[0] * c.x + v[2] * c.y + v[4], y: r.top + v[1] * c.x + v[3] * c.y + v[5] }; })()`);
const typeInto = (selector, value) => p.evaluate(`(() => { const e = document.querySelector(${JSON.stringify(selector)});
  e.value = ${JSON.stringify(value)}; e.dispatchEvent(new Event('input')); return e.value; })()`);
/** Tira o foco e espera o teclado fechar e a folha parar de mexer (modelo: task14). */
const blurAll = async () => {
  await p.evaluate('document.activeElement && document.activeElement.blur && document.activeElement.blur()');
  await p.waitFor(`innerHeight === ${fullHeight}`, 6000).catch(() => {});
  let last = '';
  for (let i = 0; i < 20; i++) {
    const now = await p.evaluate(`JSON.stringify(document.querySelector('#sheet .panel')?.getBoundingClientRect() ?? null) + innerHeight`);
    if (now === last) break;
    last = now;
    await p.sleep(200);
  }
};
const closeIfOpen = async () => {
  await blurAll();
  if ((await sheet()).show) { await p.tap('#sheet .sheet-head button'); await p.sleep(300); }
  await waitInput(false);
};
const longPressCdp = async () => {
  const c = await textCenter();
  await p.touch('touchStart', c.x, c.y);
  await p.sleep(900);
  await p.touch('touchEnd', c.x, c.y);
  await p.sleep(400);
};
/** Estado da folha "Editar texto" depois do toque longo. */
const editSheetState = () => p.evaluate(`(() => { const f = document.querySelector('#sheet textarea');
  return { show: document.querySelector('#sheet').classList.contains('show'), title: document.querySelector('#sheet .sheet-head strong')?.textContent ?? null,
    value: f?.value ?? null, start: f?.selectionStart ?? null, end: f?.selectionEnd ?? null, focused: Boolean(f) && document.activeElement === f }; })()`);
const checkEditSheet = async (label) => {
  const s = await editSheetState();
  r.check(`${label}: abre a folha "Editar texto"`, s.show && s.title === 'Editar texto', JSON.stringify(s));
  r.check(`${label}: textarea com "Título" todo selecionado (0..6)`, s.value === 'Título' && s.start === 0 && s.end === 6, JSON.stringify(s));
  r.check(`${label}: o textarea fica com o foco depois de soltar o dedo`, s.focused, JSON.stringify(s));
  const kb = await waitInput(true);
  r.check(`${label}: teclado aberto (dumpsys input_method → mInputShown=true)`, kb, `mInputShown=${kb}`);
};

await p.evaluate(`(async () => { await editor.newDocument('E2E editor-edicao-de-texto', 1080, 1080); editor.canvas.requestRenderAll(); })()`);
await p.sleep(400);

// ---------- 1. Texto → Adicionar título ----------
await step('1', async () => {
  await p.tap('#tabs button', 'Texto');
  await p.tap('#sheet button', 'Adicionar título');
  await p.sleep(300);
  const t = await p.evaluate(`({ show: document.querySelector('#toast').classList.contains('show'), msg: document.querySelector('#toast').textContent })`);
  r.check('1. toast "Toque e segure o texto para editar" ao adicionar', t.show && t.msg === 'Toque e segure o texto para editar', JSON.stringify(t));
  const a = await p.evaluate('editor.active?.text ?? null');
  r.check('1. o título entra selecionado com "Título"', a === 'Título', JSON.stringify(a));
  const btn = await p.evaluate(`[...document.querySelectorAll('#props button')].some((b) => b.textContent.includes('✏️ Editar texto'))`);
  r.check('1. painel do texto tem "✏️ Editar texto"', btn);
  shot('1-titulo-adicionado');
  await p.sleep(500); // o painel de propriedades entra: o palco encolhe e o canvas refaz o zoom
});

// ---------- 2. Toque longo (CDP) ----------
await step('2', async () => {
  await longPressCdp();
  await checkEditSheet('2. toque longo (CDP)');
  shot('2-toque-longo-folha');
  await closeIfOpen();
  r.check('2. Cancelar/✕ deixa o texto intacto', (await text()) === 'Título', JSON.stringify(await text()));
});

// ---------- 2b. Toque longo pelo gesto do sistema (adb input swipe) ----------
let sheetFromAdb = false;
await step('2b', async () => {
  await p.evaluate('editor.active?.isEditing && editor.active.exitEditing()');
  try { adbShell('uiautomator dump /data/local/tmp/ui.xml'); } catch { /* tenta ler mesmo assim */ }
  const xml = adbShell('cat /data/local/tmp/ui.xml');
  const m = /class="android\.webkit\.WebView"[^>]*bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/.exec(xml);
  if (!m) { console.log('SKIP  2b. WebView não achado no uiautomator: complemento pelo adb não rodou'); return; }
  const [wl, wt] = [Number(m[1]), Number(m[2])];
  const dpr = await p.evaluate('devicePixelRatio');
  const c = await textCenter();
  const X = Math.round(wl + c.x * dpr);
  const Y = Math.round(wt + c.y * dpr);
  console.log(`      2b. swipe ${X} ${Y} ${X} ${Y} 900 (WebView em ${wl},${wt}; dpr ${dpr})`);
  execFileSync('adb', ['shell', `input swipe ${X} ${Y} ${X} ${Y} 900`], { env: { ...process.env, MSYS_NO_PATHCONV: '1' } });
  await p.sleep(400);
  await checkEditSheet('2b. toque longo (adb input swipe)');
  sheetFromAdb = (await sheet()).title === 'Editar texto';
});

// ---------- 3. Digitar e Aplicar ----------
await step('3', async () => {
  if (!sheetFromAdb) { await closeIfOpen(); await longPressCdp(); }
  await typeInto('#sheet textarea', 'Promo de Sexta');
  await blurAll();
  await p.tap('#sheet button', 'Aplicar');
  await p.sleep(400);
  const s = await sheet();
  const t = await text();
  r.check('3. "Aplicar" fecha a folha e o canvas mostra "Promo de Sexta"', !s.show && t === 'Promo de Sexta', JSON.stringify({ s, t }));
  shot('3-aplicado');
});

// ---------- 4. Desfazer ----------
await step('4', async () => {
  await closeIfOpen();
  await p.sleep(400); // debounce do instantâneo do undo
  await p.tap('#topbar button', '↶');
  await p.sleep(500);
  const t = await text();
  r.check('4. "↶" volta o texto a "Título"', t === 'Título', JSON.stringify(t));
});

// ---------- 5. Botão "✏️ Editar texto": Cancelar e texto vazio ----------
await step('5', async () => {
  // o undo recria os objetos: seleciona o título com um toque, como o usuário
  const c = await textCenter();
  await p.touch('touchStart', c.x, c.y); await p.sleep(60); await p.touch('touchEnd', c.x, c.y); await p.sleep(600);
  await p.evaluate('editor.active?.isEditing && editor.active.exitEditing()');
  await p.tap('#props button', '✏️ Editar texto');
  await p.sleep(300);
  let s = await sheet();
  r.check('5. "✏️ Editar texto" abre a folha "Editar texto"', s.show && s.title === 'Editar texto', JSON.stringify(s));
  await blurAll();
  await p.tap('#sheet button', 'Cancelar');
  await p.sleep(300);
  s = await sheet();
  r.check('5. "Cancelar" fecha a folha com o texto intacto', !s.show && (await text()) === 'Título', JSON.stringify({ s, t: await text() }));
  await p.tap('#props button', '✏️ Editar texto');
  await p.sleep(300);
  await typeInto('#sheet textarea', '   ');
  await blurAll();
  await p.tap('#sheet button', 'Aplicar');
  await p.sleep(300);
  s = await sheet();
  const toast = await p.evaluate(`({ show: document.querySelector('#toast').classList.contains('show'), msg: document.querySelector('#toast').textContent })`);
  r.check('5. texto só com espaços: toast "Digite um texto", folha continua aberta, texto intacto',
    toast.show && toast.msg === 'Digite um texto' && s.show && s.title === 'Editar texto' && (await text()) === 'Título', JSON.stringify({ toast, s, t: await text() }));
  await closeIfOpen();
});

// ---------- 6. Dois toques no título selecionado (edição inline do Fabric) ----------
await step('6', async () => {
  await closeIfOpen();
  await p.evaluate(`(() => { const t = ${theText}; editor.canvas.setActiveObject(t); editor.onSelection(t); editor.canvas.requestRenderAll(); })()`);
  await p.sleep(500);
  for (let i = 0; i < 2; i++) {
    const c = await textCenter();
    await p.touch('touchStart', c.x, c.y); await p.sleep(60); await p.touch('touchEnd', c.x, c.y); await p.sleep(350);
  }
  await p.sleep(800);
  const st = await p.evaluate(`({ editing: ${theText}.isEditing === true, sheet: document.querySelector('#sheet').classList.contains('show') })`);
  const kb = inputShown();
  r.check('6. dois toques: o Fabric NÃO entra em edição inline', !st.editing, JSON.stringify(st));
  r.check('6. dois toques: nenhuma folha abre e o teclado fica fechado (mInputShown=false)', !st.sheet && !kb, JSON.stringify({ ...st, mInputShown: kb }));
  shot('6-dois-toques');
  await p.evaluate(`(() => { const t = ${theText}; if (t.isEditing) t.exitEditing(); editor.canvas.requestRenderAll(); })()`);
  await closeIfOpen();
});

// ---------- 7. Arrastar devagar só move ----------
await step('7', async () => {
  const before = await p.evaluate(`(() => { const t = ${theText}; return { left: t.left, top: t.top }; })()`);
  const c = await textCenter();
  await p.drag(c.x, c.y, c.x + 200, c.y, { steps: 30 });
  await p.sleep(900); // passa do tempo do toque longo: se o arrasto não cancelasse, a folha abriria agora
  const after = await p.evaluate(`(() => { const t = ${theText}; return { left: t.left, top: t.top }; })()`);
  const s = await sheet();
  r.check('7. arrastar o título move a caixa', after.left !== before.left || after.top !== before.top, JSON.stringify({ before, after }));
  r.check('7. arrastar não abre a folha "Editar texto"', !s.show, JSON.stringify(s));
  await closeIfOpen();
});

// ---------- 8. Texto-modelo do corpo ----------
await step('8', async () => {
  await p.tap('#tabs button', 'Texto');
  await p.tap('#sheet button', 'Adicionar texto');
  await p.sleep(300);
  const a = await p.evaluate('editor.active?.text ?? null');
  r.check('8. "Adicionar texto" usa o texto-modelo "Toque e segure para editar o texto"', a === 'Toque e segure para editar o texto', JSON.stringify(a));
  shot('8-corpo');
});

r.check('sem exceções JS no console', !p.logs.some((l) => l.startsWith('EXCEPTION')), p.logs.filter((l) => l.startsWith('EXCEPTION')).join(' | '));
r.done();
p.close();
