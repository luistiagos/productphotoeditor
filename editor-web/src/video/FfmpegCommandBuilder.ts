import type { LayerAnimation } from '../document';
import { isConst, layerTimeline, toFfmpeg, type Expr } from './animation';

/** Uma camada já rasterizada: PNG do tamanho da caixa (`width`×`height`), canto superior esquerdo em (x, y), px da saída. */
export interface LayerRenderItem {
  id: string;
  filename: string;
  x: number;
  y: number;
  width: number;
  height: number;
  opacity: number;
  /** Ângulo da camada (já desenhado no PNG; só informativo). */
  rotation?: number;
  animation?: LayerAnimation;
  isBackground?: boolean;
}

export interface VideoAudioConfig {
  filename: string;
  volume?: number;
  startTime?: number;
  /** Fade-out de 1 s no fim. */
  fadeOut?: boolean;
  /** Canais da trilha, se conhecidos (1 = mono). */
  channels?: number;
}

export interface FfmpegVideoConfig {
  width: number;
  height: number;
  fps: number;
  duration: number;
  audio?: VideoAudioConfig;
  outputFilename?: string;
  /** px da saída por px do documento (amplitudes fixas de tremer/flutuar). Padrão 1. */
  unit?: number;
}

export interface BuildResult {
  command: string;
  inputs: string[];
  filterComplex: string;
  outputFilename: string;
}

const f2 = (n: number) => n.toFixed(2);

/**
 * Construtor determinístico de comandos FFmpeg para animação e composição de vídeo. A linha do tempo de cada camada
 * (entrada, ênfase, saída) vem de `animation.ts`, a mesma do preview; aqui ela vira filtros:
 * alfa → `fade` in/out (linear), giro → `pad` + `rotate`, escala → `scale` com `eval=frame`, posição → `overlay`
 * centrado na caixa da camada.
 */
export class FfmpegCommandBuilder {
  constructor(private readonly config: FfmpegVideoConfig) {}

  /** MP4 (H.264 + AAC; sem música, faixa de silêncio para os players de redes sociais). */
  build(layers: LayerRenderItem[]): BuildResult {
    const { fps, duration, audio } = this.config;
    const outputFilename = this.config.outputFilename ?? 'output.mp4';
    const { inputs, filterParts, last } = this.videoGraph(layers);

    let audioStream: string;
    const audioIndex = layers.length + 1;
    if (audio?.filename) {
      const audioStart = Math.max(0, audio.startTime ?? 0);
      inputs.push(`-stream_loop -1 -ss ${f2(audioStart)} -t ${duration} -i "${audio.filename}"`);
      const vol = Math.min(1, Math.max(0, audio.volume ?? 1.0));
      const chain = [`volume=${f2(vol)}`];
      if (audio.fadeOut) {
        const fadeStart = Math.max(0, duration - 1);
        chain.push(`afade=t=out:st=${f2(fadeStart)}:d=${f2(duration - fadeStart)}`);
      }
      // mono → estéreo a pleno nos dois lados, como o preview (o aformat sozinho põe −3 dB: √½ fixo do swresample)
      if (audio.channels === 1) chain.push('pan=stereo|c0=c0|c1=c0');
      chain.push('aformat=sample_rates=44100:channel_layouts=stereo');
      filterParts.push(`[${audioIndex}:a] ${chain.join(',')} [a_out]`);
      audioStream = '-map "[a_out]" -c:a aac -b:a 192k';
    } else {
      inputs.push(`-f lavfi -i anullsrc=channel_layout=stereo:sample_rate=44100`);
      filterParts.push(`[${audioIndex}:a] atrim=0:${duration} [a_out]`);
      audioStream = '-map "[a_out]" -c:a aac -b:a 128k';
    }

    const filterComplex = filterParts.join('; ');
    const command = [
      'ffmpeg -y',
      ...inputs,
      `-filter_complex "${filterComplex}"`,
      `-map "[${last}]"`,
      audioStream,
      `-c:v libx264 -pix_fmt yuv420p -r ${fps} -t ${duration}`,
      `"${outputFilename}"`,
    ].join(' ');
    return { command, inputs, filterComplex, outputFilename };
  }

  /** GIF animado em loop (sem áudio), paleta própria do vídeo (`palettegen` + `paletteuse` com dither bayer). */
  buildGif(layers: LayerRenderItem[]): BuildResult {
    const { fps, duration } = this.config;
    const outputFilename = this.config.outputFilename ?? 'output.gif';
    const { inputs, filterParts, last } = this.videoGraph(layers);
    filterParts.push(`[${last}] fps=${fps},split [g0][g1]`);
    filterParts.push(`[g0] palettegen=max_colors=256:stats_mode=diff [pal]`);
    filterParts.push(`[g1][pal] paletteuse=dither=bayer:bayer_scale=4:diff_mode=rectangle [gif]`);
    const filterComplex = filterParts.join('; ');
    const command = [
      'ffmpeg -y',
      ...inputs,
      `-filter_complex "${filterComplex}"`,
      `-map "[gif]"`,
      `-loop 0 -t ${duration}`,
      `"${outputFilename}"`,
    ].join(' ');
    return { command, inputs, filterComplex, outputFilename };
  }

  private videoGraph(layers: LayerRenderItem[]): { inputs: string[]; filterParts: string[]; last: string } {
    const { width, height, fps, duration } = this.config;
    const unit = this.config.unit ?? 1;
    const inputs: string[] = [`-f lavfi -i color=c=black:s=${width}x${height}:d=${duration}:r=${fps}`];
    const filterParts: string[] = [];
    let current = '0:v';

    layers.forEach((layer, index) => {
      const i = index + 1;
      const tl = layerTimeline(layer.animation, { videoDuration: duration, pageWidth: width, pageHeight: height, unit });
      const animated = Boolean(tl && (tl.alpha.length > 0 || !isConst(tl.scale) || !isConst(tl.angle)));
      // imagem parada entra como 1 quadro (o overlay repete o último); animada precisa de um quadro por instante
      inputs.push(animated ? `-loop 1 -framerate ${fps} -t ${duration} -i ${layer.filename}` : `-i ${layer.filename}`);

      const w = Math.round(layer.width);
      const h = Math.round(layer.height);
      const pre: string[] = ['format=rgba'];
      if (layer.opacity < 1) pre.push(`colorchannelmixer=aa=${f2(layer.opacity)}`);
      if (tl) {
        for (const r of tl.alpha) {
          if (r.dur > 0) pre.push(`fade=t=${r.kind}:st=${f2(Math.max(0, r.start))}:d=${f2(r.dur)}:alpha=1`);
        }
        if (!isConst(tl.angle)) {
          // a caixa cresce até a diagonal para o giro não cortar os cantos; o centro continua o mesmo
          pre.push(`pad=w='ceil(hypot(iw,ih)/2)*2':h='ceil(hypot(iw,ih)/2)*2':x='(ow-iw)/2':y='(oh-ih)/2':color=black@0`);
          pre.push(`rotate=a='${toFfmpeg(tl.angle)}*PI/180':c=none`);
        }
        if (!isConst(tl.scale)) {
          const s = toFfmpeg(tl.scale);
          pre.push(`scale=w='max(2,iw*${s})':h='max(2,ih*${s})':eval=frame`);
        }
      }
      const p = `p${i}`;
      filterParts.push(`[${i}:v] ${pre.join(',')} [${p}]`);

      const next = `comp${i}`;
      if (!tl) {
        filterParts.push(`[${current}][${p}] overlay=x=${Math.round(layer.x)}:y=${Math.round(layer.y)} [${next}]`);
      } else {
        const cx = layer.x + w / 2;
        const cy = layer.y + h / 2;
        const pos = (c: number, d: Expr, size: string) => `'${toFfmpeg(d === 0 ? c : { op: '+', a: c, b: d })}-${size}/2'`;
        const enable = `between(t,${f2(tl.visibleFrom)},${f2(tl.visibleTo)})`;
        filterParts.push(
          `[${current}][${p}] overlay=x=${pos(cx, tl.dx, 'overlay_w')}:y=${pos(cy, tl.dy, 'overlay_h')}:eval=frame:enable='${enable}' [${next}]`,
        );
      }
      current = next;
    });

    return { inputs, filterParts, last: current };
  }
}
