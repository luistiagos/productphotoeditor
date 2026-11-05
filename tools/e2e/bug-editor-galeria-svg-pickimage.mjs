// E2E do bug editor-galeria-svg-pickimage: escolher um SVG no seletor de fotos ("Imagem → Escolher da galeria…" e
// "🔄 Substituir → Escolher da galeria…") deve dar mensagem clara, não o erro cru do ImageDecoder.
// Uso: node bug-editor-galeria-svg-pickimage.mjs <pasta-de-prints>
//   E2E_EXPECT=base  → controle positivo: espera o toast técnico ("Erro: Failed to create image decoder…").
//   E2E_SVG_DIR      → pasta no aparelho (padrão /sdcard/Pictures; alternativa /sdcard/Download/ProductPhoto).
import { writeFileSync, mkdirSync } from 'node:fs';
import { adbShell, launchEditor, reporter, screencap } from './cdp.mjs';
import { execFileSync } from 'node:child_process';

const out = process.argv[2] ?? '.';
mkdirSync(out, { recursive: true });
const expectBase = process.env.E2E_EXPECT === 'base';
const dir = process.env.E2E_SVG_DIR ?? '/sdcard/Pictures';
const remote = `${dir}/e2e_bug_svg.svg`;
const r = reporter(`bug editor-galeria-svg-pickimage (${expectBase ? 'BASE: espera o erro técnico' : 'FIX'})`);

// ---------- preparo: SVG mais novo da galeria ----------
const local = `${out}/e2e_bug_svg.svg`;
writeFileSync(local, '<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300" viewBox="0 0 400 300"><rect width="400" height="300" fill="#e53935"/><circle cx="200" cy="150" r="90" fill="#fdd835"/></svg>\n');
execFileSync('adb', ['push', local, remote], { env: { ...process.env, MSYS_NO_PATHCONV: '1' } });
const scan = () => adbShell('content call --uri content://media/ --method scan_volume --arg external_primary');
scan();
const mime = adbShell(`content query --uri content://media/external/images/media --projection _display_name:mime_type --where "_display_name='e2e_bug_svg.svg'"`);
console.log(`MediaStore: ${mime}`);
r.check('SVG indexado no MediaStore como image/svg+xml', mime.includes('image/svg+xml'), mime);

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
// o toast some em 3,2 s: polling a cada 200 ms, print quando aparece
const readToast = async (p, shot) => {
  const end = Date.now() + 20000;
  while (Date.now() < end) {
    const t = await p.evaluate(`document.getElementById('toast')?.textContent ?? ''`);
    if (t) { screencap(shot); return t; }
    await p.sleep(200);
  }
  return '';
};
const judge = (label, t) => {
  console.log(`toast (${label}): ${JSON.stringify(t)}`);
  if (expectBase) r.check(`${label}: toast técnico do decoder (sintoma reproduzido)`, t.startsWith('Erro:') && t.includes('decoder'), t);
  else r.check(`${label}: toast claro "Não foi possível: SVG…" sem "decoder"`, t.startsWith('Não foi possível: SVG') && !t.includes('decoder'), t);
};

let p;
try {
  p = await launchEditor();
  const n0 = await p.evaluate('editor.canvas.getObjects().length');

  // ---------- 1. Imagem → Escolher da galeria… → SVG ----------
  await p.tap('#tabs button', 'Imagem');
  await p.tap('#sheet button', 'Escolher da galeria…');
  r.check('inserir: seletor abriu e a 1ª foto (SVG) foi tocada', await pickFirstPhoto(p, `${out}/1-seletor.png`));
  judge('inserir', await readToast(p, `${out}/1-toast.png`));
  await p.waitFor(`!document.getElementById('busy').classList.contains('show')`, 20000).catch(() => {});
  r.check('inserir: nada foi adicionado ao canvas', (await p.evaluate('editor.canvas.getObjects().length')) === n0);
  await p.sleep(3500); // toast anterior some

  // ---------- 2. Substituir foto → Escolher da galeria… → SVG ----------
  await p.evaluate(`(async () => {
    const cv = document.createElement('canvas'); cv.width = 400; cv.height = 300; const x = cv.getContext('2d');
    x.fillStyle = '#1e88e5'; x.fillRect(0, 0, 400, 300);
    const img = await editor.addImage(cv.toDataURL('image/png'));
    img.set({ left: 300, top: 300, layerName: 'Foto' }); img.setCoords(); editor.commit();
    window.__img = img;
  })()`);
  await p.sleep(500);
  const src0 = await p.evaluate('__img.getSrc()');
  await p.tap('#topbar button', 'Camadas');
  await p.tap('#sheet .layer[data-layer="Foto"] button.grow');
  await p.tap('#props .swap-btn');
  await p.tap('#sheet .swap-gallery');
  r.check('substituir: seletor abriu e a 1ª foto (SVG) foi tocada', await pickFirstPhoto(p, `${out}/2-seletor.png`));
  judge('substituir', await readToast(p, `${out}/2-toast.png`));
  await p.waitFor(`!document.getElementById('busy').classList.contains('show')`, 20000).catch(() => {});
  r.check('substituir: a foto não foi trocada', (await p.evaluate('__img.getSrc()')) === src0);

  r.check('sem exceções JS no console', !p.logs.some((l) => l.startsWith('EXCEPTION')), p.logs.filter((l) => l.startsWith('EXCEPTION')).join(' | '));
} finally {
  // ---------- limpeza ----------
  try { adbShell(`rm -f ${remote}`); scan(); } catch (e) { console.log(`limpeza falhou: ${e.message}`); }
  p?.close();
}
r.done();
