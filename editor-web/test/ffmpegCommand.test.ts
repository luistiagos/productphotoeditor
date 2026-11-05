import { describe, expect, it } from 'vitest';
import { FfmpegCommandBuilder, type LayerRenderItem } from '../src/video/FfmpegCommandBuilder';

const bg: LayerRenderItem = { id: 'bg', filename: 'bg.png', x: 0, y: 0, width: 1080, height: 1080, opacity: 1, isBackground: true };

describe('FfmpegCommandBuilder', () => {
  it('fundo parado: 1 quadro, overlay no canto, silêncio AAC, H.264 yuv420p', () => {
    const r = new FfmpegCommandBuilder({ width: 1080, height: 1080, fps: 30, duration: 5 }).build([bg]);
    expect(r.command).toContain('color=c=black:s=1080x1080:d=5:r=30');
    expect(r.command).toContain(' -i bg.png ');
    expect(r.command).not.toContain('-loop 1 -framerate 30 -t 5 -i bg.png');
    expect(r.filterComplex).toContain('[1:v] format=rgba [p1]');
    expect(r.filterComplex).toContain('[0:v][p1] overlay=x=0:y=0 [comp1]');
    expect(r.command).toContain('anullsrc=channel_layout=stereo:sample_rate=44100');
    expect(r.command).toContain('-map "[comp1]"');
    expect(r.command).toContain('-c:v libx264 -pix_fmt yuv420p -r 30 -t 5');
    expect(r.command.endsWith('"output.mp4"')).toBe(true);
  });

  it('camada animada entra em loop (um quadro por instante) e é centrada pela caixa', () => {
    const layer: LayerRenderItem = { id: 'p', filename: 'layer_0.png', x: 140, y: 240, width: 800, height: 600, opacity: 1,
      animation: { fx: 'ken_burns', startTime: 0, duration: 4 } };
    const r = new FfmpegCommandBuilder({ width: 1080, height: 1080, fps: 30, duration: 4 }).build([bg, layer]);
    expect(r.command).toContain('-loop 1 -framerate 30 -t 4 -i layer_0.png');
    // escala por quadro + overlay centrado em (540, 540)
    expect(r.filterComplex).toMatch(/\[2:v\] format=rgba,scale=w='max\(2,iw\*.+\)':h='max\(2,ih\*.+\)':eval=frame \[p2\]/);
    expect(r.filterComplex).toContain("overlay=x='540-overlay_w/2':y='540-overlay_h/2':eval=frame:enable='between(t,0.00,4.00)'");
  });

  it('Entrada + Ênfase + Saída: fade in e fade out no alfa, pulso na escala, janela da camada', () => {
    const badge: LayerRenderItem = { id: 'b', filename: 'layer_1.png', x: 100, y: 300, width: 400, height: 120, opacity: 0.85,
      animation: { fx: 'zoom_in', startTime: 1, duration: 4, inFx: 'zoom_in', inDuration: 1, emphasisFx: 'pulse', outFx: 'fade_out', outDuration: 1 } };
    const r = new FfmpegCommandBuilder({ width: 1080, height: 1920, fps: 30, duration: 6 }).build([badge]);
    expect(r.filterComplex).toContain('colorchannelmixer=aa=0.85');
    expect(r.filterComplex).toContain('fade=t=in:st=1.00:d=1.00:alpha=1');
    expect(r.filterComplex).toContain('fade=t=out:st=4.00:d=1.00:alpha=1');
    expect(r.filterComplex).toContain('sin(');
    expect(r.filterComplex).toContain("enable='between(t,1.00,5.00)'");
  });

  it('giro: pad até a diagonal e rotate em graus→radianos', () => {
    const l: LayerRenderItem = { id: 'r', filename: 'layer_0.png', x: 0, y: 0, width: 200, height: 100, opacity: 1,
      animation: { fx: 'rotate', startTime: 0, duration: 5, emphasisFx: 'rotate' } };
    const r = new FfmpegCommandBuilder({ width: 1080, height: 1080, fps: 30, duration: 5 }).build([l]);
    expect(r.filterComplex).toContain("pad=w='ceil(hypot(iw,ih)/2)*2'");
    expect(r.filterComplex).toMatch(/rotate=a='.+\*PI\/180':c=none/);
  });

  it('trilha sonora: loop, início, volume, fade-out no último segundo e saída estéreo 44,1 kHz', () => {
    const r = new FfmpegCommandBuilder({ width: 1080, height: 1080, fps: 30, duration: 10,
      audio: { filename: 'audio.wav', volume: 0.8, startTime: 2.5, fadeOut: true }, outputFilename: 'promo.mp4' }).build([]);
    expect(r.command).toContain('-stream_loop -1 -ss 2.50 -t 10 -i "audio.wav"');
    expect(r.command).toContain('[1:a] volume=0.80,afade=t=out:st=9.00:d=1.00,aformat=sample_rates=44100:channel_layouts=stereo [a_out]');
    expect(r.command).toContain('-map "[a_out]" -c:a aac -b:a 192k');
    expect(r.command).toContain('"promo.mp4"');
  });

  it('trilha mono vira estéreo sem perder 3 dB (pan c1=c0)', () => {
    const r = new FfmpegCommandBuilder({ width: 1080, height: 1080, fps: 30, duration: 5, audio: { filename: 'audio.wav', volume: 0.5, channels: 1 } }).build([]);
    expect(r.command).toContain('[1:a] volume=0.50,pan=stereo|c0=c0|c1=c0,aformat=sample_rates=44100:channel_layouts=stereo [a_out]');
  });

  it('sem fade-out não há afade; volume acima de 1 é limitado', () => {
    const r = new FfmpegCommandBuilder({ width: 1080, height: 1080, fps: 30, duration: 5, audio: { filename: 'audio.mp3', volume: 3 } }).build([]);
    expect(r.command).not.toContain('afade');
    expect(r.command).not.toContain('pan=');
    expect(r.command).toContain('volume=1.00');
  });

  it('GIF: mesma composição + palettegen/paletteuse (dither bayer), loop infinito, sem áudio', () => {
    const r = new FfmpegCommandBuilder({ width: 540, height: 540, fps: 15, duration: 5, outputFilename: 'output.gif' }).buildGif([
      { ...bg, width: 540, height: 540 },
    ]);
    expect(r.filterComplex).toContain('[comp1] fps=15,split [g0][g1]');
    expect(r.filterComplex).toContain('[g0] palettegen=max_colors=256:stats_mode=diff [pal]');
    expect(r.filterComplex).toContain('[g1][pal] paletteuse=dither=bayer:bayer_scale=4:diff_mode=rectangle [gif]');
    expect(r.command).toContain('-map "[gif]" -loop 0 -t 5 "output.gif"');
    expect(r.command).not.toContain('aac');
    expect(r.command).not.toContain('libx264');
  });
});
