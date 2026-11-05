// E2E TASK-04 (animação Entrada/Ênfase/Saída, música de fundo, GIF no export, pacote do vídeo) no app real.
// Uso: ANDROID_SERIAL=emulator-5554 node task04.mjs <pasta-de-prints>
// Pré: /sdcard/Music/e2e_music.wav indexado (cópia de content/audio/lofi.wav).
// A codificação FFmpeg em si roda em task04_encode.mjs (só arm64: o ffmpeg-kit 8.1.2 não tem x86_64).
import { adbShell, launchEditor, reporter, screencap, uiFind, uiTap } from './cdp.mjs';

const out = process.argv[2] ?? '.';
// um seletor de arquivos deixado aberto por uma execução anterior prende a tarefa do app
adbShell('am force-stop com.google.android.documentsui');
const p = await launchEditor();
const r = reporter('TASK-04 — animações triplas, música, GIF, pacote');
const close = (a, b, tol = 0.02) => Math.abs(a - b) <= tol;

await p.evaluate(`(async () => {
  await editor.newDocument('E2E 04', 1080, 1080);
  editor.canvas.backgroundColor = '#202a44';
  const rect = editor.addShape('rect', '#e53935'); rect.set({ left: 540, top: 500, width: 320, height: 200, layerName: 'Selo' });
  const t = editor.addText('title', 'Montserrat'); t.set({ left: 540, top: 850, text: 'OFERTA', layerName: 'Título' });
  for (const o of [rect, t]) o.setCoords();
  editor.canvas.discardActiveObject(); editor.canvas.requestRenderAll(); editor.commit();
  Object.assign(window, { __rect: rect, __t: t });
})()`);
await p.sleep(400);

// ---------- 1. sheet de animação: Entrada + Ênfase + Saída na mesma camada ----------
const rc = await p.evaluate(`editor.docToClient(540, 500)`);
await p.touch('touchStart', rc.x, rc.y); await p.sleep(60); await p.touch('touchEnd', rc.x, rc.y); await p.sleep(500);
r.check('toque seleciona o selo', await p.evaluate(`editor.active === __rect`));
await p.tap('#props button', 'Animar');
const setSel = (name, v) => p.evaluate(`(() => { const s = document.querySelector('#sheet [data-anim="${name}"] select'); s.value = ${JSON.stringify(v)}; s.dispatchEvent(new Event('change')); return s.value; })()`);
const setRange = (name, v) => p.evaluate(`(() => { const s = document.querySelector('#sheet [data-anim="${name}"] input'); s.value = ${JSON.stringify(String(v))}; s.dispatchEvent(new Event('input')); return s.value; })()`);
r.check('sheet tem os 3 seletores (Entrada, Ênfase, Saída) e a curva', await p.evaluate(
  `['in', 'emphasis', 'out', 'easing'].every((n) => document.querySelector('#sheet [data-anim="' + n + '"] select'))`));
await setSel('in', 'zoom_in');
await setSel('emphasis', 'pulse');
await setSel('out', 'fade_out');
await setSel('easing', 'linear');
await setRange('start', 0.5);
await setRange('inDuration', 1);
await setRange('outDuration', 1);
await setRange('onScreen', 4);
const anim = await p.evaluate(`editor.getAnimation(__rect)`);
r.check('camada guarda inFx=zoom_in + emphasisFx=pulse + outFx=fade_out', anim?.inFx === 'zoom_in' && anim?.emphasisFx === 'pulse'
  && anim?.outFx === 'fade_out' && anim?.fx === 'zoom_in' && close(anim.startTime, 0.5) && close(anim.duration, 4), JSON.stringify(anim));
screencap(`${out}/04-1-animacao.png`);
await p.tap('#sheet button', 'Concluir');

// preview: estados em instantes-chave (mesma conta do export)
const at = (t) => p.evaluate(`(() => { editor.videoPreview.seek(${t}); return { s: __rect.scaleX, o: __rect.opacity }; })()`);
const s0 = await at(0.3), s1 = await at(1.0), s2 = await at(1.7), s3 = await at(2.1), s4 = await at(4.0), s5 = await at(4.25);
r.check('preview: antes de aparecer, opacidade 0', s0.o === 0, JSON.stringify(s0));
r.check('preview: meio da entrada → zoom 0,6 e alfa 0,5', close(s1.s, 0.6) && close(s1.o, 0.5), JSON.stringify(s1));
r.check('preview: ênfase pulsa (1 ± 0,06)', close(s2.s, 1.06, 0.01) && close(s3.s, 0.94, 0.03) && close(s2.o, 1), JSON.stringify([s2, s3]));
r.check('preview: meio da saída → alfa ≈ 0,25..0,5, escala 1', s5.o > 0.2 && s5.o < 0.3 && close(s4.s, 1, 0.07), JSON.stringify([s4, s5]));
await p.evaluate(`editor.videoPreview.stop()`);
r.check('stop restaura a camada', await p.evaluate(`__rect.scaleX === 1 && __rect.opacity === 1`));

// ---------- 2. música de fundo: trilha empacotada, play sincronizado, volume, fade ----------
await p.tap('#tabs button', 'Vídeo');
r.check('aba Vídeo tem "🎵 Música de Fundo" com as 4 trilhas', await p.evaluate(
  `document.querySelector('#sheet .music h4')?.textContent.includes('Música de Fundo') && document.querySelectorAll('#sheet .music [data-track]').length === 4`));
await p.tap('#sheet .music [data-track="upbeat"]');
const vs1 = await p.evaluate(`({ ...editor.videoSettings, now: document.querySelector('#sheet .music-now').textContent })`);
r.check('trilha escolhida vai para videoSettings (asset do APK), volume padrão 80%', String(vs1.audioUrl).endsWith('/assets/content/audio/upbeat.wav')
  && vs1.audioVolume === 0.8 && vs1.now.includes('Batida Comercial'), JSON.stringify(vs1));
await p.tap('#sheet .video-bar button', 'Reproduzir');
await p.sleep(1800);
const au = await p.evaluate(`(() => { const a = editor.videoPreview.audio; return a && { paused: a.paused, t: a.currentTime, vol: a.volume, loop: a.loop, src: editor.videoPreview.audioSource, err: a.error?.code ?? null, preview: editor.videoPreview.time }; })()`);
r.check('▶ toca a música junto (não pausada, avançando, loop, volume 0,8)', au && !au.paused && au.t > 0.8 && au.loop && close(au.vol, 0.8) && au.err === null
  && Math.abs(au.t - au.preview) < 0.3, JSON.stringify(au));
screencap(`${out}/04-2-musica.png`);
await p.tap('#sheet .video-bar button', 'Pausar');
r.check('⏸ pausa a música', await p.evaluate(`editor.videoPreview.audio.paused`));
await p.evaluate(`(() => { const s = [...document.querySelectorAll('#sheet .music label.slider')].find((l) => l.textContent.includes('Volume')).querySelector('input'); s.value = '50'; s.dispatchEvent(new Event('input')); s.dispatchEvent(new Event('change')); })()`);
r.check('slider de volume → 50% no preview e nas configurações', await p.evaluate(`editor.videoSettings.audioVolume === 0.5 && Math.abs(editor.videoPreview.audio.volume - 0.5) < 0.01`));
await p.evaluate(`(() => { const s = [...document.querySelectorAll('#sheet .music label.slider')].find((l) => l.textContent.includes('Início')).querySelector('input'); s.value = '2'; s.dispatchEvent(new Event('input')); s.dispatchEvent(new Event('change')); })()`);
await p.tap('#sheet .music input.audio-fade');
await p.evaluate(`editor.videoPreview.seek(1)`);
const pos = await p.evaluate(`({ t: editor.videoPreview.audio.currentTime, fade: editor.videoSettings.audioFadeOut, start: editor.videoSettings.audioStartTime })`);
r.check('início da música 2 s: seek(1) põe a trilha em 3 s; fade-out ligado', close(pos.t, 3, 0.05) && pos.fade === true && pos.start === 2, JSON.stringify(pos));
const fv = await p.evaluate(`(() => { editor.videoPreview.seek(4.5); return editor.videoPreview.audio.volume; })()`);
r.check('fade-out: a 0,5 s do fim o volume cai pela metade (0,25)', close(fv, 0.25), String(fv));
await p.evaluate(`editor.videoPreview.stop()`);

// ---------- 3. áudio do celular pelo seletor do sistema ----------
await p.tap('#sheet .music button.pick-audio');
await p.sleep(2500);
screencap(`${out}/04-3-seletor.png`);
// DocumentsUI abre em "Recentes" (vazio para áudio): Raízes → Áudio → Unknown → Music → arquivo
// (ele reabre na última pasta usada: toca sempre o passo mais fundo que estiver visível)
{
  let last = '';
  for (let i = 0; i < 10; i++) {
    if (uiFind('e2e_music.wav')) { await uiTap('e2e_music.wav'); break; }
    const step = ['Music', 'Unknown'].find((t) => uiFind(t)) ?? (last === 'Show roots' ? 'Audio' : 'Show roots');
    await uiTap(step, 20000);
    last = step;
    await p.sleep(1500);
  }
}
await p.waitFor(`String(editor.videoSettings.audioUrl).includes('/blob/audio-')`, 15000);
const picked = await p.evaluate(`({ url: editor.videoSettings.audioUrl, name: editor.videoSettings.audioName, now: document.querySelector('#sheet .music-now')?.textContent })`);
r.check('"📂 Escolher áudio do celular…" copia para /blob/audio-<uuid>.wav', /\/blob\/audio-[0-9a-f-]{36}\.wav$/.test(picked.url) && picked.name === 'e2e_music'
  && picked.now?.includes('e2e_music'), JSON.stringify(picked));
await p.tap('#sheet .video-bar button', 'Reproduzir');
await p.sleep(1500);
const au2 = await p.evaluate(`(() => { const a = editor.videoPreview.audio; return { paused: a.paused, t: a.currentTime, src: editor.videoPreview.audioSource, err: a.error?.code ?? null }; })()`);
r.check('o áudio do celular toca no preview', !au2.paused && au2.t > 0.5 && au2.src === picked.url && au2.err === null, JSON.stringify(au2));
await p.tap('#sheet .video-bar button', 'Pausar');

// ---------- 4. pacote do vídeo (o que vai para o FFmpeg) ----------
const b = await p.evaluate(`(async () => {
  const b = await editor.exportVideoBundle('mp4');
  const dims = {};
  for (const [k, v] of Object.entries(b.files)) { const im = new Image(); im.src = v; await im.decode(); dims[k] = [im.naturalWidth, im.naturalHeight]; }
  const rb = __rect.getBoundingRect();
  return { cmd: b.command, output: b.output, audioUrl: b.audioUrl, audioFile: b.audioFile, w: b.width, h: b.height, dims, rb: [rb.width, rb.height] };
})()`);
r.check('MP4: PNG da camada recortado na caixa (não a página inteira)', b.dims['layer_0.png'] && Math.abs(b.dims['layer_0.png'][0] - (b.rb[0] + 4)) <= 2
  && Math.abs(b.dims['layer_0.png'][1] - (b.rb[1] + 4)) <= 2 && b.dims['bg.png'][0] === 1080, JSON.stringify({ d: b.dims, rb: b.rb }));
r.check('MP4: áudio do blob no pacote + volume 0,5 + afade no último segundo', b.audioUrl === picked.url && b.audioFile === 'audio.wav'
  && b.cmd.includes('-i "audio.wav"') && b.cmd.includes('volume=0.50,afade=t=out:st=4.00:d=1.00') && b.cmd.includes('-ss 2.00'), b.cmd.slice(-420));
r.check('MP4: zoom+pulso (scale eval=frame) e fade in/out na camada', b.cmd.includes('fade=t=in:st=0.50:d=1.00:alpha=1')
  && b.cmd.includes('fade=t=out:st=3.50:d=1.00:alpha=1') && /scale=w='max\(2,iw\*.*sin\(/.test(b.cmd) && b.output === 'output.mp4');
const g = await p.evaluate(`(async () => { const b = await editor.exportVideoBundle('gif'); return { cmd: b.command, w: b.width, h: b.height, fps: b.fps, out: b.output, audio: b.audioUrl ?? null }; })()`);
r.check('GIF: 540×540, 15 fps, palettegen/paletteuse bayer, sem áudio', g.w === 540 && g.h === 540 && g.fps === 15 && g.out === 'output.gif'
  && g.cmd.includes('palettegen') && g.cmd.includes('paletteuse=dither=bayer') && g.audio === null && !g.cmd.includes('aac'), JSON.stringify({ ...g, cmd: undefined }));

// ---------- 5. GIF Animado no export ----------
await p.evaluate(`document.querySelector('#sheet .scrim')?.click()`);
await p.tap('#topbar button', 'Exportar');
const opts = await p.evaluate(`[...document.querySelectorAll('#sheet select option')].map((o) => o.value + '=' + o.textContent)`);
r.check('Exportar oferece "GIF Animado (WhatsApp)"', opts.some((o) => o.startsWith('gif=') && o.includes('GIF Animado')), opts.join(' | '));
await p.evaluate(`(() => { const s = document.querySelector('#sheet select'); s.value = 'gif'; s.dispatchEvent(new Event('change')); })()`);
const vis = await p.evaluate(`(() => { const b = [...document.querySelectorAll('#sheet button')]; const v = (t) => b.find((x) => x.textContent === t)?.hidden; return { print: v('Imprimir'), mockup: v('Ver em mockup'), save: v('Salvar na galeria') }; })()`);
r.check('com GIF: sem Imprimir/Mockup, com Salvar', vis.print === true && vis.mockup === true && vis.save === false, JSON.stringify(vis));
screencap(`${out}/04-4-export-gif.png`);
await p.evaluate(`document.querySelector('#sheet .scrim')?.click()`);

// ---------- 6. persistência: o documento guarda animação e música ----------
const reload = await p.evaluate(`(async () => { const d = editor.toDocument(); await editor.load(d); const o = editor.canvas.getObjects().find((x) => x.layerName === 'Selo');
  return { a: editor.getAnimation(o), v: editor.videoSettings }; })()`);
r.check('salvar/reabrir mantém Entrada/Ênfase/Saída e a música', reload.a?.emphasisFx === 'pulse' && reload.a?.outFx === 'fade_out'
  && reload.v.audioUrl === picked.url && reload.v.audioFadeOut === true && reload.v.audioVolume === 0.5, JSON.stringify(reload));
const fresh = await p.evaluate(`(async () => { await editor.newDocument('outro', 1080, 1920); return { a: editor.videoSettings.audioUrl ?? null, w: editor.videoSettings.width, h: editor.videoSettings.height }; })()`);
r.check('documento novo não herda a música do anterior', fresh.a === null && fresh.w === 1080 && fresh.h === 1920, JSON.stringify(fresh));
const story = await p.evaluate(`(async () => { const b = await editor.exportVideoBundle('mp4'); return [b.width, b.height]; })()`);
r.check('Story 1080×1920 exporta 1080×1920 (antes saía 1080×1080)', story[0] === 1080 && story[1] === 1920, JSON.stringify(story));

r.done();
p.close();
