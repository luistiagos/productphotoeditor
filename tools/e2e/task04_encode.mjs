// E2E TASK-04 — codificação real no FFmpegKit (só arm64: o ffmpeg-kit 8.1.2 não tem x86_64).
// Exporta MP4 e GIF pela UI, traz o arquivo gerado de volta para o BlobStore do app e confere no WebView:
// cor dos quadros em instantes-chave, áudio mixado (volume e fade-out) e quadros do GIF.
// Uso: ANDROID_SERIAL=<arm64> node task04_encode.mjs <pasta-de-prints>
import { randomUUID } from 'node:crypto';
import { adbShell, launchEditor, reporter, screencap } from './cdp.mjs';

const PKG = 'com.productphoto.offline';
const out = process.argv[2] ?? '.';
adbShell('am force-stop com.google.android.documentsui');
const p = await launchEditor('Post Instagram'); // o formato é refeito abaixo (1080×1080)
const r = reporter('TASK-04 — MP4/GIF pelo FFmpegKit');

const BG = [32, 42, 68], RED = [229, 57, 53];
const mix = (a, b, k) => a.map((v, i) => v * (1 - k) + b[i] * k);
const near = (c, e, tol = 40) => c && c.every((v, i) => Math.abs(v - e[i]) <= tol);

await p.evaluate(`(async () => {
  await editor.newDocument('E2E 04 encode', 1080, 1080);
  editor.canvas.backgroundColor = '#202a44';
  const rect = editor.addShape('rect', '#e53935'); rect.set({ left: 540, top: 500, width: 320, height: 200, layerName: 'Selo' });
  rect.setCoords();
  editor.setAnimation({ fx: 'zoom_in', startTime: 0.5, duration: 4, inFx: 'zoom_in', inDuration: 1, emphasisFx: 'pulse',
    outFx: 'fade_out', outDuration: 1, easing: 'linear' }, rect);
  const t = editor.addText('title', 'Montserrat'); t.set({ left: 540, top: 880, text: 'OFERTA' }); t.setCoords();
  editor.setAnimation({ fx: 'slide_left', startTime: 0, duration: 5, inFx: 'slide_left', inDuration: 1, emphasisFx: 'float' }, t);
  const tr = content.audioTracks.find((x) => x.id === 'upbeat');
  editor.videoSettings = { ...editor.videoSettings, duration: 5, audioUrl: contentUrl(tr.file), audioName: tr.name, audioVolume: 0.5, audioFadeOut: true };
  editor.canvas.discardActiveObject(); editor.canvas.requestRenderAll();
})()`);

/** Exporta pela UI e devolve o caminho relativo ao armazenamento ("Movies/ProductPhoto/x.mp4"). */
async function exportVia(buttonText, label) {
  adbShell('logcat -c');
  await p.tap('#tabs button', 'Vídeo');
  await p.tap('#sheet button', buttonText);
  await p.tap('#sheet button', 'Salvar na galeria');
  const t0 = Date.now();
  await p.waitFor(`document.getElementById('toast').classList.contains('show') && !document.getElementById('busy').classList.contains('show')`, 300000);
  const toast = await p.evaluate(`document.getElementById('toast').textContent`);
  const secs = ((Date.now() - t0) / 1000).toFixed(1);
  const loc = /Salvo em (.+)$/.exec(toast)?.[1];
  r.check(`${label}: FFmpegKit gerou e salvou`, Boolean(loc), `${toast} (${secs}s)`);
  if (!loc) console.log(adbShell('logcat -d -s VideoRenderer:* EditorSession:*').split('\n').slice(-30).join('\n'));
  await p.sleep(3500); // o toast some antes do próximo
  return loc;
}

/** Copia o arquivo exportado para o BlobStore do app e devolve a URL do editor. */
function toBlob(loc, ext) {
  // stdin não atravessa o run-as: copia por /data/local/tmp (legível pelo app debug)
  const name = `vid-${randomUUID()}.${ext}`;
  adbShell(`cp "/sdcard/${loc}" /data/local/tmp/${name} && chmod 644 /data/local/tmp/${name}`);
  adbShell(`run-as ${PKG} cp /data/local/tmp/${name} files/editor/blobs/${name}`);
  adbShell(`rm /data/local/tmp/${name}`);
  const size = Number(adbShell(`run-as ${PKG} stat -c %s files/editor/blobs/${name}`));
  return { url: `https://appassets.androidplatform.net/blob/${name}`, size };
}

// ---------- MP4 ----------
const mp4 = await exportVia('Exportar Vídeo MP4', 'MP4');
if (mp4) {
  const { url, size } = toBlob(mp4, 'mp4');
  r.check('MP4 não vazio', size > 50_000, `${size} bytes`);
  // botão injetado: o play do <video> precisa de gesto (mediaPlaybackRequiresUserGesture)
  await p.evaluate(`(() => {
    const b = document.createElement('button'); b.id = 'e2e-play'; b.textContent = 'E2E play';
    b.style.cssText = 'position:fixed;left:10px;top:10px;z-index:99999;padding:20px';
    window.__frames = {}; window.__vid = null;
    b.onclick = () => {
      const v = document.createElement('video'); v.muted = true; v.playsInline = true; v.src = ${JSON.stringify(url)};
      const cv = document.createElement('canvas'); cv.width = 1080; cv.height = 1080; const cx = cv.getContext('2d', { willReadFrequently: true });
      const targets = [0.3, 1.0, 2.0, 4.0, 4.8];
      const onFrame = (now, meta) => {
        const t = meta.mediaTime;
        for (const tg of targets) {
          const prev = window.__frames[tg];
          if (Math.abs(t - tg) < 0.05 && (!prev || Math.abs(prev.t - tg) > Math.abs(t - tg))) {
            cx.drawImage(v, 0, 0, 1080, 1080);
            const px = (x, y) => [...cx.getImageData(x, y, 1, 1).data.slice(0, 3)];
            window.__frames[tg] = { t, c: px(540, 500), edge: px(680, 500), w: v.videoWidth, h: v.videoHeight };
          }
        }
        if (!v.ended) v.requestVideoFrameCallback(onFrame);
      };
      v.requestVideoFrameCallback(onFrame);
      v.onended = () => { window.__vidDone = { dur: v.duration }; };
      v.onerror = () => { window.__vidDone = { err: v.error?.message }; };
      v.play().catch((e) => { window.__vidDone = { err: String(e) }; });
      window.__vid = v;
    };
    document.body.append(b);
  })()`);
  await p.tap('#e2e-play');
  await p.waitFor('window.__vidDone', 30000);
  const vr = await p.evaluate(`({ done: window.__vidDone, f: window.__frames })`);
  const f = vr.f;
  r.check('MP4 toca até o fim (1080×1080, ~5 s)', !vr.done.err && Math.abs(vr.done.dur - 5) < 0.25 && f[2.0]?.w === 1080 && f[2.0]?.h === 1080, JSON.stringify(vr.done));
  r.check('t=0,3: selo ainda não apareceu (fundo)', near(f[0.3]?.c, BG), JSON.stringify(f[0.3]));
  r.check('t=1,0: meio da entrada → alfa 0,5 no centro, zoom 0,6 (borda ainda fundo)', near(f[1.0]?.c, mix(BG, RED, 0.5)) && near(f[1.0]?.edge, BG), JSON.stringify(f[1.0]));
  r.check('t=2,0: selo inteiro (centro e borda vermelhos)', near(f[2.0]?.c, RED) && near(f[2.0]?.edge, RED), JSON.stringify(f[2.0]));
  r.check('t=4,0: meio da saída → alfa 0,5', near(f[4.0]?.c, mix(BG, RED, 0.5)), JSON.stringify(f[4.0]));
  r.check('t=4,8: selo saiu (fundo)', near(f[4.8]?.c, BG), JSON.stringify(f[4.8]));
  await p.evaluate(`document.getElementById('e2e-play')?.remove()`);

  // áudio: decodifica o AAC do MP4 e compara com a trilha original
  const a = await p.evaluate(`(async () => {
    const ctx = new AudioContext();
    const dec = async (u) => ctx.decodeAudioData(await (await fetch(u)).arrayBuffer());
    const vid = await dec(${JSON.stringify(url)});
    const src = await dec(contentUrl('audio/upbeat.wav'));
    const rms = (b, t0, t1) => { const d = b.getChannelData(0); const i0 = Math.floor(t0 * b.sampleRate), i1 = Math.min(d.length, Math.floor(t1 * b.sampleRate));
      let s = 0; for (let i = i0; i < i1; i++) s += d[i] * d[i]; return Math.sqrt(s / Math.max(1, i1 - i0)); };
    return { dur: vid.duration, ch: vid.numberOfChannels, sr: vid.sampleRate,
      mid: rms(vid, 0.5, 3.5), srcMid: rms(src, 0.5, 3.5), tail: rms(vid, 4.8, 4.98), srcTail: rms(src, 4.8, 4.98) };
  })()`);
  const ratio = a.mid / a.srcMid;
  r.check('MP4 tem a trilha mixada (estéreo, ~5 s)', a.ch === 2 && Math.abs(a.dur - 5) < 0.3 && a.mid > 0.02, JSON.stringify(a));
  r.check('volume 50%: RMS do vídeo ≈ 0,5 × trilha', ratio > 0.38 && ratio < 0.62, ratio.toFixed(3));
  r.check('fade-out: último 0,2 s bem mais baixo que a trilha no mesmo trecho', a.tail < 0.35 * 0.5 * a.srcTail, `${a.tail.toFixed(4)} vs ${(0.5 * a.srcTail).toFixed(4)}`);
  screencap(`${out}/04e-1-mp4.png`);
}

// ---------- GIF ----------
const gif = await exportVia('GIF Animado', 'GIF');
if (gif) {
  const { url, size } = toBlob(gif, 'gif');
  const g = await p.evaluate(`(async () => {
    const data = await (await fetch(${JSON.stringify(url)})).arrayBuffer();
    const d = new ImageDecoder({ data, type: 'image/gif' });
    await d.tracks.ready; await d.completed;
    const tr = d.tracks.selectedTrack;
    const cv = document.createElement('canvas'); cv.width = 540; cv.height = 540; const cx = cv.getContext('2d', { willReadFrequently: true });
    const at = async (t) => { const { image } = await d.decode({ frameIndex: Math.min(tr.frameCount - 1, Math.round(t * 15)) });
      cx.drawImage(image, 0, 0); const w = image.displayWidth, h = image.displayHeight; image.close();
      return { w, h, c: [...cx.getImageData(270, 250, 1, 1).data.slice(0, 3)] }; };
    return { frames: tr.frameCount, rep: tr.repetitionCount === Infinity ? 'inf' : tr.repetitionCount, f03: await at(0.3), f20: await at(2.0), f48: await at(4.8) };
  })()`);
  r.check('GIF 540×540 com ~75 quadros (15 fps × 5 s), em loop', g.f20.w === 540 && g.f20.h === 540 && Math.abs(g.frames - 75) <= 2 && g.rep === 'inf',
    JSON.stringify({ frames: g.frames, rep: g.rep, size }));
  r.check('GIF anima: fundo em 0,3 s, selo em 2,0 s, fundo em 4,8 s', near(g.f03.c, BG, 45) && near(g.f20.c, RED, 45) && near(g.f48.c, BG, 45),
    JSON.stringify([g.f03.c, g.f20.c, g.f48.c]));
  screencap(`${out}/04e-2-gif.png`);
}

r.done();
p.close();
