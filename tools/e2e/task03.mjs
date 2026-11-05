// E2E TASK-03 (conta-gotas, paleta do anúncio, contraste WCAG) no app real. Uso: node task03.mjs <pasta-de-prints>
import { launchEditor, reporter, screencap } from './cdp.mjs';

const out = process.argv[2] ?? '.';
const p = await launchEditor();
const r = reporter('TASK-03 — conta-gotas, cores do anúncio e contraste');

// cenário: página branca, retângulo vermelho à esquerda, título amarelo-claro (ilegível) no topo
await p.evaluate(`(async () => {
  await editor.newDocument('E2E 03', 1080, 1080);
  const rect = editor.addShape('rect', '#e53935');
  rect.set({ left: 300, top: 650, width: 360, height: 360, scaleX: 1, scaleY: 1 }); rect.setCoords();
  const t = editor.addText('title', 'Montserrat');
  t.set({ fill: '#fff176', top: 220 }); t.setCoords();
  editor.canvas.discardActiveObject(); editor.canvas.requestRenderAll(); editor.commit();
  window.__rect = rect; window.__t = t;
})()`);
await p.sleep(400);

const clientOf = (expr) => p.evaluate(`(() => { const c = ${expr}.getCenterPoint(); return editor.docToClient(c.x, c.y); })()`);
const markPaletteBtn = (label) => p.evaluate(`(() => {
  document.querySelectorAll('[data-e2e]').forEach((e) => e.removeAttribute('data-e2e'));
  const l = [...document.querySelectorAll('label.color')].find((x) => x.getClientRects().length && x.querySelector('span:last-child')?.textContent === ${JSON.stringify(label)});
  const b = l?.querySelector('.palette-btn'); if (b) b.setAttribute('data-e2e', 'pal'); return Boolean(b);
})()`);

// 1. tocar no texto no canvas → painel do texto com aviso de contraste
let c = await clientOf('__t');
await p.touch('touchStart', c.x, c.y); await p.sleep(60); await p.touch('touchEnd', c.x, c.y); await p.sleep(500);
const warn = await p.evaluate(`(() => { const s = document.querySelector('.contrast-slot'); return s && !s.hidden ? { text: s.textContent, ratio: s.dataset.ratio } : null; })()`);
r.check('texto amarelo-claro sobre branco mostra "⚠️ Baixo contraste"', Boolean(warn?.text.includes('Baixo contraste')), JSON.stringify(warn));
screencap(`${out}/03-1-aviso-contraste.png`);

// 2. Corrigir em 1 toque
await p.tap('.contrast-fix');
await p.sleep(500);
const fixed = await p.evaluate(`({ fill: __t.fill, slotHidden: document.querySelector('.contrast-slot')?.hidden, ratio: document.querySelector('.contrast-slot')?.dataset.ratio })`);
r.check('Corrigir troca a cor e o aviso some', fixed.fill === '#111111' && fixed.slotHidden === true && Number(fixed.ratio) >= 4.5, JSON.stringify(fixed));

// 3. 🎨 ao lado de "Cor" do texto → paleta com as cores do anúncio
r.check('botão 🎨 no seletor "Cor" do texto', await markPaletteBtn('Cor'));
await p.tap('[data-e2e=pal]');
const pal = await p.evaluate(`(() => { const el = document.getElementById('palette'); return el ? { colors: [...el.querySelectorAll('.swatch-chip')].map((b) => b.dataset.color), text: el.textContent } : null; })()`);
r.check('paleta abre com "Cores neste anúncio"', Boolean(pal?.text.includes('Cores neste anúncio')));
r.check('cores do anúncio incluem fundo, retângulo e texto', ['#ffffff', '#e53935', '#111111'].every((x) => pal?.colors.includes(x)), JSON.stringify(pal?.colors));
screencap(`${out}/03-2-paleta.png`);

// 4. 💧 conta-gotas: arrastar até o retângulo, lupa acima do dedo, soltar aplica a cor do pixel
await p.tap('.eyedropper-btn');
r.check('modo conta-gotas com banner', await p.evaluate(`Boolean(document.querySelector('.eyedropper-layer .eyedropper-banner')) && document.getElementById('palette').hidden`));
c = await clientOf('__rect');
await p.touch('touchStart', c.x - 120, c.y - 200);
for (let i = 1; i <= 10; i++) { await p.touch('touchMove', c.x - 120 + (120 * i) / 10, c.y - 200 + (200 * i) / 10); await p.sleep(20); }
await p.sleep(300);
const loupe = await p.evaluate(`(() => { const h = document.querySelector('.eyedropper-holder'); const b = document.querySelector('.eyedropper-loupe').getBoundingClientRect();
  return { hidden: h.hidden, bottom: b.bottom, cx: b.left + b.width / 2, w: b.width, hex: document.querySelector('.eyedropper-layer').dataset.hex }; })()`);
r.check('lupa 96 px visível acima do dedo', !loupe.hidden && Math.abs(loupe.w - 96) < 8 && loupe.bottom <= c.y - 55 && Math.abs(loupe.cx - c.x) < 2, JSON.stringify({ ...loupe, finger: c }));
r.check('lupa mostra o #hex do pixel sob o dedo', loupe.hex === '#e53935', loupe.hex);
screencap(`${out}/03-3-lupa.png`);
await p.touch('touchEnd', c.x, c.y);
await p.sleep(500);
const picked = await p.evaluate(`({ fill: __t.fill, layer: Boolean(document.querySelector('.eyedropper-layer')), palette: Boolean(document.getElementById('palette')), recent: JSON.parse(localStorage.getItem('pp_recent_colors') || '[]') })`);
r.check('soltar aplica exatamente a cor amostrada no texto', picked.fill === '#e53935', picked.fill);
r.check('modo e paleta fecham; cor vai para as recentes', !picked.layer && !picked.palette && picked.recent[0] === '#e53935', JSON.stringify(picked.recent));

// 5. forma: 1 toque numa cor recente
c = await clientOf('__rect');
await p.touch('touchStart', c.x, c.y); await p.sleep(60); await p.touch('touchEnd', c.x, c.y); await p.sleep(500);
r.check('botão 🎨 no "Preenchimento" da forma', await markPaletteBtn('Preenchimento'));
await p.tap('[data-e2e=pal]');
await p.tap('#palette .recent .swatch-chip[data-color="#111111"]');
r.check('cor recente aplicada à forma com 1 toque', (await p.evaluate('__rect.fill')) === '#111111');

// 6. fundo (dentro da sheet "Fundo"): a sheet some durante a amostragem e volta depois
await p.evaluate(`editor.canvas.discardActiveObject(), editor.canvas.requestRenderAll()`);
await p.tap('#tabs button', 'Fundo');
r.check('botão 🎨 no "Cor sólida" do Fundo', await markPaletteBtn('Cor sólida'));
await p.tap('[data-e2e=pal]');
await p.tap('.eyedropper-btn');
const sheetHidden = await p.evaluate(`getComputedStyle(document.getElementById('sheet')).display`);
c = await clientOf('__rect');
await p.drag(c.x + 30, c.y + 30, c.x, c.y, { steps: 4 });
const bg = await p.evaluate(`({ bg: editor.canvas.backgroundColor, sheet: getComputedStyle(document.getElementById('sheet')).display, title: document.querySelector('#sheet strong')?.textContent })`);
r.check('sheet escondida durante o conta-gotas', sheetHidden === 'none', sheetHidden);
r.check('fundo recebe a cor da forma; sheet "Fundo" volta', bg.bg === '#111111' && bg.sheet !== 'none' && bg.title === 'Fundo', JSON.stringify(bg));
await p.tap('#sheet .sheet-head button');

// 7. foto do produto: cores dominantes entram em "Cores neste anúncio"
await p.evaluate(`(async () => {
  const cv = document.createElement('canvas'); cv.width = 200; cv.height = 200; const x = cv.getContext('2d');
  x.fillStyle = '#1e88e5'; x.fillRect(0, 0, 200, 140); x.fillStyle = '#ff9800'; x.fillRect(0, 140, 200, 60);
  window.__img = await editor.addImage(cv.toDataURL('image/png'));
  editor.canvas.setActiveObject(__t); editor.onSelection(__t);
})()`);
await p.sleep(400);
await markPaletteBtn('Cor');
await p.tap('[data-e2e=pal]');
const withPhoto = await p.evaluate(`[...document.querySelectorAll('#palette .swatch-chip')].map((b) => b.dataset.color)`);
r.check('cores dominantes da foto (azul e laranja) na paleta', withPhoto.includes('#1e88e5') && withPhoto.includes('#ff9800'), JSON.stringify(withPhoto));
r.check('sem o preto padrão do fill da imagem nem mistura de borda', !withPhoto.includes('#000000') && withPhoto.filter((x) => !['#111111', '#e53935', '#1e88e5', '#ff9800'].includes(x)).length === 0, JSON.stringify(withPhoto));
await p.tap('#palette .sheet-head button');

// 8. cancelar o conta-gotas não muda nada
const before = await p.evaluate('__t.fill');
await markPaletteBtn('Cor');
await p.tap('[data-e2e=pal]');
await p.tap('.eyedropper-btn');
await p.tap('.eyedropper-banner button');
r.check('Cancelar sai do modo sem aplicar cor e devolve a paleta', (await p.evaluate(`[__t.fill, Boolean(document.querySelector('.eyedropper-layer')), document.getElementById('palette')?.hidden]`)).join() === `${before},false,false`);
await p.tap('#palette .sheet-head button');

r.check('sem exceções JS no console', !p.logs.some((l) => l.startsWith('EXCEPTION')), p.logs.filter((l) => l.startsWith('EXCEPTION')).join(' | '));
r.done();
p.close();
