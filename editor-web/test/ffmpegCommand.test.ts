import { describe, expect, it } from 'vitest';
import { FfmpegCommandBuilder, type LayerRenderItem } from '../src/video/FfmpegCommandBuilder';

describe('FfmpegCommandBuilder', () => {
  it('gera comando básico com fundo e sem áudio (silêncio embutido)', () => {
    const builder = new FfmpegCommandBuilder({
      width: 1080,
      height: 1080,
      fps: 30,
      duration: 5,
    });

    const layers: LayerRenderItem[] = [
      {
        id: 'bg',
        filename: 'bg.png',
        x: 0,
        y: 0,
        width: 1080,
        height: 1080,
        opacity: 1,
        isBackground: true,
      },
    ];

    const result = builder.build(layers);
    expect(result.command).toContain('color=c=black:s=1080x1080:d=5:r=30');
    expect(result.command).toContain('-i bg.png');
    expect(result.command).toContain('scale=1080:1080');
    expect(result.command).toContain('overlay=x=0:y=0:enable=\'between(t,0.00,5.00)\'');
    expect(result.command).toContain('anullsrc=channel_layout=stereo:sample_rate=44100');
    expect(result.command).toContain('-c:v libx264 -pix_fmt yuv420p');
    expect(result.command).toContain('"output.mp4"');
  });

  it('aplica efeito Ken Burns no produto', () => {
    const builder = new FfmpegCommandBuilder({
      width: 1080,
      height: 1080,
      fps: 30,
      duration: 4,
    });

    const layers: LayerRenderItem[] = [
      {
        id: 'product',
        filename: 'product.png',
        x: 140,
        y: 140,
        width: 800,
        height: 800,
        opacity: 1,
        animation: {
          fx: 'ken_burns',
          startTime: 0,
          duration: 4,
        },
      },
    ];

    const result = builder.build(layers);
    expect(result.filterComplex).toContain('overlay=x=\'540 - (w * (1 + 0.0375 * t)) / 2\'');
    expect(result.filterComplex).toContain(':y=\'540 - (h * (1 + 0.0375 * t)) / 2\'');
  });

  it('aplica animações de slide_left e fade em textos/badges com opacidade', () => {
    const builder = new FfmpegCommandBuilder({
      width: 1080,
      height: 1920,
      fps: 30,
      duration: 6,
    });

    const layers: LayerRenderItem[] = [
      {
        id: 'badge',
        filename: 'badge.png',
        x: 100,
        y: 300,
        width: 400,
        height: 120,
        opacity: 0.85,
        animation: {
          fx: 'slide_left',
          startTime: 1.0,
          duration: 2.0,
        },
      },
      {
        id: 'title',
        filename: 'title.png',
        x: 100,
        y: 500,
        width: 600,
        height: 200,
        opacity: 1.0,
        animation: {
          fx: 'fade',
          startTime: 2.0,
          duration: 3.0,
        },
      },
    ];

    const result = builder.build(layers);
    // Opacidade parcial
    expect(result.filterComplex).toContain('colorchannelmixer=aa=0.85');
    // Slide left fórmula
    expect(result.filterComplex).toContain('if(lte(t, 3.00), 100 + 980*(1 - (t-1.00)/2.00), 100)');
    // Fade in fórmula
    expect(result.filterComplex).toContain('fade=t=in:st=2.00:d=1.00:alpha=1');
  });

  it('configura trilha sonora com volume e offset', () => {
    const builder = new FfmpegCommandBuilder({
      width: 1080,
      height: 1080,
      fps: 30,
      duration: 10,
      audio: {
        filename: 'music_beat.mp3',
        volume: 0.8,
        startTime: 2.5,
      },
      outputFilename: 'promo_video.mp4',
    });

    const result = builder.build([]);
    expect(result.command).toContain('-stream_loop -1 -ss 2.50 -t 10 -i "music_beat.mp3"');
    expect(result.command).toContain('volume=0.80 [a_out]');
    expect(result.command).toContain('-map "[a_out]" -c:a aac -b:a 192k');
    expect(result.command).toContain('"promo_video.mp4"');
  });
});
