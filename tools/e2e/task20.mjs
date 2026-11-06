// E2E TASK-20 (📦 Mockup 3D → "📷 Usar foto própria" + "🎯 Detectar superfície").
// Uso: ANDROID_SERIAL=<serial> node tools/e2e/task20.mjs <pasta-de-prints>   (moto: E2E_FORMAT="Post Instagram")
// As fotos de teste são geradas no próprio WebView (canvas → PNG), gravadas na pasta de prints e enviadas por `adb push`
// para /sdcard/Pictures (cada uma logo antes de ser escolhida, para ser a 1ª do seletor do sistema). O seletor é tocado
// pelo uiautomator (receita de bug-editor-galeria-svg-pickimage.mjs). Os sinais são lidos de `__mockupStudio.state()`,
// das `.mockup-handle` na tela e dos pixels do <canvas.mockup-preview>. Na base (sem a TASK-20) os botões não existem: o
// script prova a ausência e para (controle positivo). As fotos são apagadas do aparelho no fim.
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { adbShell, launchEditor, reporter, screencap } from './cdp.mjs';

const out = process.argv[2] ?? '.';
mkdirSync(out, { recursive: true });
const r = reporter('TASK-20 — Mockup em foto própria com Detectar superfície');
const DIR = '/sdcard/Pictures';
const PHOTOS = { rect: 'e2e_task20_rect.png', flat: 'e2e_task20_flat.png', cut: 'e2e_task20_cutout.png' };
const pushed = [];

// ---------- verdade das fotos (a mesma geometria do desenho no canvas abaixo) ----------
const RECT = { w: 1200, h: 900, cx: 600, cy: 450, a: 320, b: 200, deg: 12 };
const rad = (RECT.deg * Math.PI) / 180;
const RECT_TRUE = [[-RECT.a, -RECT.b], [RECT.a, -RECT.b], [RECT.a, RECT.b], [-RECT.a, RECT.b]]
  .map(([u, v]) => [RECT.cx + Math.cos(rad) * u - Math.sin(rad) * v, RECT.cy + Math.sin(rad) * u + Math.cos(rad) * v]);
const FLAT = { w: 800, h: 600 };
const CUT = { w: 800, h: 600, quad: [[250, 150], [550, 150], [650, 450], [150, 450]] };

const scan = () => adbShell('content call --uri content://media/ --method scan_volume --arg external_primary');
const push = (key) => {
  execFileSync('adb', ['push', `${out}/${PHOTOS[key]}`, `${DIR}/${PHOTOS[key]}`], { env: { ...process.env, MSYS_NO_PATHCONV: '1' } });
  pushed.push(PHOTOS[key]);
  scan();
};
const pickFirstPhoto = async (p, shot) => {
  for (let i = 0; i < 20; i++) {
    await p.sleep(700);
    try { adbShell('uiautomator dump /data/local/tmp/ui.xml'); } catch { continue; }
    const xml = adbShell('cat /data/local/tmp/ui.xml');
    const m = /content-desc="(Photo taken|Foto tirada)[^"]*"[^>]*bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/.exec(xml);
    if (m) {
      screencap(shot);
      adbShell(`input tap ${(Number(m[2]) + Number(m[4])) >> 1} ${(Number(m[3]) + Number(m[5])) >> 1}`);
      return true;
    }
  }
  return false;
};
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const round = (q) => q.map(([x, y]) => [Math.round(x), Math.round(y)]);

let p;
try {
  p = await launchEditor();
  const SHEET_OPEN = `document.getElementById('sheet').classList.contains('show')`;
  const state = () => p.evaluate('__mockupStudio.state()');
  const toastText = () => p.evaluate(`document.getElementById('toast').textContent`);
  const closeSheet = async () => { await p.tap('#sheet .sheet-head button'); await p.sleep(250); };
  const rendered = async (act) => {
    const n = (await state()).renders;
    await act();
    await p.waitFor(`__mockupStudio.state().renders > ${n}`, 8000).catch(() => {});
    await p.sleep(100);
  };
  /** Toca "Usar foto própria", escolhe a 1ª foto do seletor e espera a base `own` com a largura dada. */
  const useOwnPhoto = async (width, shot) => {
    await p.tap('#sheet .mockup-own');
    const picked = await pickFirstPhoto(p, shot);
    await p.waitFor(`__mockupStudio.state().template === 'own' && __mockupStudio.state().baseWidth === ${width}
      && __mockupStudio.state().renders > 0`, 20000).catch(() => {});
    await p.sleep(300);
    const st = await state();
    return { picked, st };
  };
  /** Clica em Detectar e devolve o estado + o toast logo depois. */
  const detect = async () => {
    await rendered(() => p.tap('#sheet .mockup-detect'));
    return { st: await state(), toast: await toastText() };
  };
  /** Centro de cada alça convertido para px da base (pela caixa do canvas do preview). */
  const handlesInBase = () => p.evaluate(`(() => {
    const st = __mockupStudio.state();
    const c = document.querySelector('canvas.mockup-preview').getBoundingClientRect();
    return [...document.querySelectorAll('#sheet .mockup-handle')].map((el) => {
      const b = el.getBoundingClientRect();
      return [((b.left + b.width / 2 - c.left) / c.width) * st.baseWidth, ((b.top + b.height / 2 - c.top) / c.height) * st.baseHeight];
    });
  })()`);
  /** Fração das amostras do miolo do quad (s, t ∈ [0,3; 0,7]) em que o preview difere da base pura (a arte está lá). */
  const artFrac = () => p.evaluate(`(() => {
    const st = __mockupStudio.state();
    const base = __mockupStudio.basePreview().data;
    const c = document.querySelector('canvas.mockup-preview');
    const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    const k = c.width / st.baseWidth;
    const q = st.quad.map(([x, y]) => [x * k, y * k]);
    const at = (s, t) => [0, 1].map((i) => (1 - s) * (1 - t) * q[0][i] + s * (1 - t) * q[1][i] + s * t * q[2][i] + (1 - s) * t * q[3][i]);
    let n = 0, hit = 0;
    for (let s = 0.3; s <= 0.7001; s += 0.05) for (let t = 0.3; t <= 0.7001; t += 0.05) {
      const [x, y] = at(s, t); const o = (Math.round(y) * c.width + Math.round(x)) * 4; n++;
      if (Math.abs(d[o] - base[o]) + Math.abs(d[o + 1] - base[o + 1]) + Math.abs(d[o + 2] - base[o + 2]) > 60) hit++;
    }
    return hit / n;
  })()`);

  // ---------- fotos de teste, geradas no WebView ----------
  const imgs = await p.evaluate(`(() => {
    const mk = (w, h, draw) => { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'));
      return c.toDataURL('image/png').split(',')[1]; };
    const rect = mk(${RECT.w}, ${RECT.h}, (x) => {
      const g = x.createLinearGradient(0, 0, 0, ${RECT.h}); g.addColorStop(0, '#14141c'); g.addColorStop(1, '#373746');
      x.fillStyle = g; x.fillRect(0, 0, ${RECT.w}, ${RECT.h});
      x.translate(${RECT.cx}, ${RECT.cy}); x.rotate(${rad}); x.fillStyle = '#dcdcdc';
      x.fillRect(${-RECT.a}, ${-RECT.b}, ${2 * RECT.a}, ${2 * RECT.b});
    });
    const flat = mk(${FLAT.w}, ${FLAT.h}, (x) => { x.fillStyle = '#808080'; x.fillRect(0, 0, ${FLAT.w}, ${FLAT.h}); });
    const cut = mk(${CUT.w}, ${CUT.h}, (x) => {
      const q = ${JSON.stringify(CUT.quad)}; x.fillStyle = '#c0392b'; x.beginPath(); x.moveTo(...q[0]);
      for (const pt of q.slice(1)) x.lineTo(...pt); x.closePath(); x.fill();
    });
    return { rect, flat, cut };
  })()`);
  for (const k of Object.keys(PHOTOS)) writeFileSync(`${out}/${PHOTOS[k]}`, Buffer.from(imgs[k], 'base64'));

  // ---------- arte: fundo azul forte + título (como no task08: a arte tem que se destacar da foto) ----------
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

  // ---------- estúdio; controle positivo: os botões existem? ----------
  await p.tap('#tabs button', 'Mockup 3D');
  await p.waitFor(SHEET_OPEN, 5000);
  await p.sleep(500);
  const has = await p.evaluate(`[...document.querySelectorAll('#sheet button')].some((b) => /Detectar superfície|Usar foto própria/.test(b.textContent))`);
  if (!has) {
    r.check('estúdio tem "Usar foto própria" / "Detectar superfície"', false, 'ausentes (base sem a TASK-20)');
    screencap(`${out}/20-base-estudio.png`);
  } else {
    r.check('estúdio tem "Usar foto própria" / "Detectar superfície"', true);
    screencap(`${out}/20-0-estudio.png`);

    // ---------- 1. foto com um retângulo claro girado 12° → Detectar ----------
    push('rect');
    const o1 = await useOwnPhoto(RECT.w, `${out}/20-1-seletor.png`);
    r.check('1a. seletor abriu, a 1ª foto foi tocada e virou a base "own" 1200×900 (quad central)', o1.picked
      && o1.st.template === 'own' && o1.st.baseWidth === RECT.w && o1.st.baseHeight === RECT.h && o1.st.detect === null,
    JSON.stringify({ picked: o1.picked, template: o1.st.template, w: o1.st.baseWidth, h: o1.st.baseHeight, quad: round(o1.st.quad) }));
    const d1 = await detect();
    const err1 = d1.st.quad.map((q, i) => dist(q, RECT_TRUE[i]));
    const tol1 = 0.05 * Math.max(RECT.w, RECT.h);
    r.check('1b. Detectar: método sobel e os 4 cantos a ≤ 5 % do lado maior (60 px) dos verdadeiros, na ordem TL,TR,BR,BL',
      d1.st.detect === 'sobel' && err1.every((e) => e <= tol1),
      JSON.stringify({ detect: d1.st.detect, quad: round(d1.st.quad), verdade: round(RECT_TRUE), erro: err1.map(Math.round) }));
    r.check('1c. toast "Superfície detectada"', d1.toast.startsWith('Superfície detectada'), d1.toast);
    const hb = await handlesInBase();
    const herr = hb.map((h, i) => dist(h, d1.st.quad[i]));
    r.check('1d. as 4 alças na tela estão nos cantos do quad (≤ 3 % do lado maior)', hb.length === 4
      && herr.every((e) => e <= 0.03 * Math.max(RECT.w, RECT.h)), JSON.stringify({ alcas: round(hb), erro: herr.map(Math.round) }));
    const f1 = await artFrac();
    r.check('1e. o preview mostra a arte dentro do quad detectado (≥ 60 % das amostras do miolo diferentes da base)', f1 >= 0.6,
      `artFrac=${f1.toFixed(2)}`);
    screencap(`${out}/20-1-detectado.png`);

    // ---------- 2. ajuste fino: arrastar a alça TL ----------
    const q0 = d1.st.quad;
    const hc = await p.center('#sheet .mockup-handle[data-corner="0"]');
    await rendered(() => p.drag(hc.x, hc.y, hc.x + 40, hc.y + 30, { steps: 14 }));
    const st2 = await state();
    const moved = dist(st2.quad[0], q0[0]);
    const others = [1, 2, 3].every((i) => st2.quad[i][0] === q0[i][0] && st2.quad[i][1] === q0[i][1]);
    r.check('2. arrastar a alça TL move só o canto TL (> 20 px da base); os outros 3 ficam', moved > 20 && others,
      JSON.stringify({ antes: round(q0), depois: round(st2.quad), px: Math.round(moved) }));
    screencap(`${out}/20-2-alca.png`);

    // ---------- 3. Inserir no design ----------
    const n3 = await p.evaluate('editor.canvas.getObjects().length');
    await p.tap('#sheet .mockup-insert');
    await p.waitFor(`editor.canvas.getObjects().length === ${n3 + 1}`, 30000).catch(() => {});
    await p.sleep(500);
    const last3 = await p.evaluate(`(() => { const os = editor.canvas.getObjects(); const o = os[os.length - 1];
      return { n: os.length, type: o.type, w: Math.round(o.width), h: Math.round(o.height), jpeg: String(o.getSrc()).startsWith('data:image/jpeg'),
        sheet: ${SHEET_OPEN} }; })()`);
    r.check('3. Inserir no design: +1 imagem na resolução da foto (1200×900, JPEG: foto opaca) e a folha fecha',
      last3.n === n3 + 1 && String(last3.type).toLowerCase() === 'image' && last3.w === RECT.w && last3.h === RECT.h
      && last3.jpeg && !last3.sheet, JSON.stringify(last3));
    screencap(`${out}/20-3-inserido.png`);

    // ---------- 4. foto lisa → fallback central ----------
    await p.evaluate('editor.canvas.discardActiveObject(), editor.canvas.requestRenderAll(), true');
    await p.sleep(300);
    await p.tap('#tabs button', 'Mockup 3D');
    await p.waitFor(SHEET_OPEN, 5000);
    await p.sleep(400);
    push('flat');
    const o4 = await useOwnPhoto(FLAT.w, `${out}/20-4-seletor.png`);
    r.check('4a. foto lisa 800×600 virou a base "own"', o4.picked && o4.st.template === 'own' && o4.st.baseWidth === FLAT.w,
      JSON.stringify({ picked: o4.picked, template: o4.st.template, w: o4.st.baseWidth }));
    const d4 = await detect();
    const central = [[0.2, 0.2], [0.8, 0.2], [0.8, 0.8], [0.2, 0.8]].map(([u, v]) => [u * FLAT.w, v * FLAT.h]);
    const err4 = d4.st.quad.map((q, i) => dist(q, central[i]));
    r.check('4b. Detectar na foto lisa: fallback, quad central (≤ 1 px), coordenadas finitas, toast de ajuste manual',
      d4.st.detect === 'fallback' && err4.every((e) => e <= 1) && d4.st.quad.flat().every(Number.isFinite)
      && d4.toast.startsWith('Nenhuma superfície clara'), JSON.stringify({ detect: d4.st.detect, quad: round(d4.st.quad), toast: d4.toast }));
    screencap(`${out}/20-4-fallback.png`);

    // ---------- 5. recorte PNG com alfa → alpha; inserir mantém a transparência ----------
    push('cut');
    const o5 = await useOwnPhoto(CUT.w, `${out}/20-5-seletor.png`);
    r.check('5a. recorte 800×600 (trapézio opaco sobre transparente) virou a base "own"', o5.picked && o5.st.template === 'own'
      && o5.st.baseWidth === CUT.w, JSON.stringify({ picked: o5.picked, template: o5.st.template, w: o5.st.baseWidth }));
    const d5 = await detect();
    const err5 = d5.st.quad.map((q, i) => dist(q, CUT.quad[i]));
    r.check('5b. Detectar no recorte: método alpha e cantos a ≤ 5 % do lado maior (40 px) do trapézio',
      d5.st.detect === 'alpha' && err5.every((e) => e <= 0.05 * CUT.w),
      JSON.stringify({ detect: d5.st.detect, quad: round(d5.st.quad), erro: err5.map(Math.round) }));
    screencap(`${out}/20-5-recorte.png`);
    const n5 = await p.evaluate('editor.canvas.getObjects().length');
    await p.tap('#sheet .mockup-insert');
    await p.waitFor(`editor.canvas.getObjects().length === ${n5 + 1}`, 30000).catch(() => {});
    await p.sleep(500);
    const last5 = await p.evaluate(`(() => { const os = editor.canvas.getObjects(); const o = os[os.length - 1];
      const c = document.createElement('canvas'); c.width = 4; c.height = 4; const x = c.getContext('2d');
      x.drawImage(o.getElement(), 0, 0); const a = x.getImageData(1, 1, 1, 1).data[3];
      return { n: os.length, w: Math.round(o.width), png: String(o.getSrc()).startsWith('data:image/png'), cornerAlpha: a }; })()`);
    r.check('5c. Inserir o recorte: PNG e o canto da foto continua transparente (α = 0), não preto',
      last5.n === n5 + 1 && last5.png && last5.cornerAlpha === 0, JSON.stringify(last5));
    screencap(`${out}/20-5-inserido.png`);
  }

  r.check('sem exceções JS no console', !p.logs.some((l) => l.startsWith('EXCEPTION')), p.logs.filter((l) => l.startsWith('EXCEPTION')).join(' | '));
} catch (e) {
  r.check('script terminou sem erro', false, e.message);
  try { screencap(`${out}/20-erro.png`); } catch { /* sem aparelho */ }
} finally {
  // ---------- limpeza: o aparelho é do dono ----------
  try {
    for (const f of pushed) adbShell(`rm -f ${DIR}/${f}`);
    if (pushed.length) scan();
  } catch (e) { console.log(`limpeza falhou: ${e.message}`); }
  p?.close();
}
r.done();
