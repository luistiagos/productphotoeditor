import type { LayerAnimation } from '../document';

export interface LayerRenderItem {
  id: string;
  filename: string;
  x: number;
  y: number;
  width: number;
  height: number;
  opacity: number;
  rotation?: number;
  animation?: LayerAnimation;
  isBackground?: boolean;
}

export interface VideoAudioConfig {
  filename: string;
  volume?: number;
  startTime?: number;
}

export interface FfmpegVideoConfig {
  width: number;
  height: number;
  fps: number;
  duration: number;
  audio?: VideoAudioConfig;
  outputFilename?: string;
}

export interface BuildResult {
  command: string;
  inputs: string[];
  filterComplex: string;
  outputFilename: string;
}

/**
 * Construtor determinístico de comandos FFmpeg para animação e composição de vídeo.
 * Gera filtros matemáticos de translação, escala e rotação no tempo 't' para cada camada.
 */
export class FfmpegCommandBuilder {
  constructor(private readonly config: FfmpegVideoConfig) {}

  build(layers: LayerRenderItem[]): BuildResult {
    const { width, height, fps, duration, audio } = this.config;
    const outputFilename = this.config.outputFilename ?? 'output.mp4';

    const inputs: string[] = [];
    const filterParts: string[] = [];

    // Input 0: Canvas base de cor preta com resolução e taxa de quadros definidas
    inputs.push(`-f lavfi -i color=c=black:s=${width}x${height}:d=${duration}:r=${fps}`);

    // Inputs das imagens das camadas (1..N)
    layers.forEach((layer) => {
      inputs.push(`-i ${layer.filename}`);
    });

    let currentStream = '0:v';

    layers.forEach((layer, index) => {
      const inputIndex = index + 1;
      const rawStream = `${inputIndex}:v`;
      const processedStream = `p${inputIndex}`;
      const nextStream = `comp${inputIndex}`;

      const anim = layer.animation?.fx ?? 'none';
      const st = Math.max(0, layer.animation?.startTime ?? 0);
      const animDur = Math.max(0.2, layer.animation?.duration ?? duration);
      const speed = Math.max(0.1, layer.animation?.speed ?? 1.0);
      const effectiveDur = animDur / speed;
      const et = Math.min(duration, st + animDur);

      const w = Math.round(layer.width);
      const h = Math.round(layer.height);
      const x = Math.round(layer.x);
      const y = Math.round(layer.y);
      const centerX = Math.round(x + w / 2);
      const centerY = Math.round(y + h / 2);

      const preFilters: string[] = [];

      // 1. Escala base da camada
      preFilters.push(`scale=${w}:${h}`);

      // 2. Opacidade se não for 1.0
      if (layer.opacity < 1.0) {
        preFilters.push(`colorchannelmixer=aa=${layer.opacity.toFixed(2)}`);
      }

      // 3. Efeitos de pré-processamento (Fade, Zoom no input, Rotate)
      if (anim === 'fade') {
        const fadeDur = Math.min(1.0, effectiveDur / 2);
        preFilters.push(`fade=t=in:st=${st.toFixed(2)}:d=${fadeDur.toFixed(2)}:alpha=1`);
      } else if (anim === 'rotate') {
        preFilters.push(`rotate='if(lte(t,${(st + effectiveDur).toFixed(2)}), 2*PI*(t-${st.toFixed(2)})/${effectiveDur.toFixed(2)}, 0)':c=none`);
      }

      filterParts.push(`[${rawStream}] ${preFilters.join(',')} [${processedStream}]`);

      // 4. Expressões de posição X, Y e ativação no overlay
      let exprX = `${x}`;
      let exprY = `${y}`;

      switch (anim) {
        case 'slide_left': {
          const slideDist = Math.min(width, Math.max(200, width - x));
          exprX = `'if(lte(t, ${(st + effectiveDur).toFixed(2)}), ${x} + ${slideDist}*(1 - (t-${st.toFixed(2)})/${effectiveDur.toFixed(2)}), ${x})'`;
          break;
        }
        case 'slide_right': {
          const slideDist = Math.min(width, Math.max(200, x + w));
          exprX = `'if(lte(t, ${(st + effectiveDur).toFixed(2)}), ${x} - ${slideDist}*(1 - (t-${st.toFixed(2)})/${effectiveDur.toFixed(2)}), ${x})'`;
          break;
        }
        case 'slide_up': {
          const slideDist = Math.min(height, Math.max(200, height - y));
          exprY = `'if(lte(t, ${(st + effectiveDur).toFixed(2)}), ${y} + ${slideDist}*(1 - (t-${st.toFixed(2)})/${effectiveDur.toFixed(2)}), ${y})'`;
          break;
        }
        case 'slide_down': {
          const slideDist = Math.min(height, Math.max(200, y + h));
          exprY = `'if(lte(t, ${(st + effectiveDur).toFixed(2)}), ${y} - ${slideDist}*(1 - (t-${st.toFixed(2)})/${effectiveDur.toFixed(2)}), ${y})'`;
          break;
        }
        case 'shake': {
          exprX = `'${x} + 12*sin(20*(t-${st.toFixed(2)}))*if(lte(t,${(st + 1.2).toFixed(2)}),1,0)'`;
          break;
        }
        case 'float': {
          exprY = `'${y} + 10*sin(2*PI*(t-${st.toFixed(2)})/2.5)'`;
          break;
        }
        case 'ken_burns': {
          // Zoom suave de 1.0 para 1.15 centrado na camada
          const zoomRate = 0.15 / duration;
          exprX = `'${centerX} - (w * (1 + ${zoomRate.toFixed(4)} * t)) / 2'`;
          exprY = `'${centerY} - (h * (1 + ${zoomRate.toFixed(4)} * t)) / 2'`;
          break;
        }
        default:
          exprX = `${x}`;
          exprY = `${y}`;
          break;
      }

      const enableExpr = `:enable='between(t,${st.toFixed(2)},${et.toFixed(2)})'`;
      filterParts.push(
        `[${currentStream}][${processedStream}] overlay=x=${exprX}:y=${exprY}${enableExpr} [${nextStream}]`,
      );

      currentStream = nextStream;
    });

    // Mixagem de áudio
    let audioStream = '';
    if (audio?.filename) {
      const audioIndex = layers.length + 1;
      const audioStart = audio.startTime ?? 0;
      inputs.push(`-stream_loop -1 -ss ${audioStart.toFixed(2)} -t ${duration} -i "${audio.filename}"`);
      const vol = (audio.volume ?? 1.0).toFixed(2);
      filterParts.push(`[${audioIndex}:a] volume=${vol} [a_out]`);
      audioStream = '-map "[a_out]" -c:a aac -b:a 192k';
    } else {
      // Gera áudio silencioso compatível com MP4 para players e redes sociais
      const silenceIndex = layers.length + 1;
      inputs.push(`-f lavfi -i anullsrc=channel_layout=stereo:sample_rate=44100`);
      filterParts.push(`[${silenceIndex}:a] atrim=0:${duration} [a_out]`);
      audioStream = '-map "[a_out]" -c:a aac -b:a 128k';
    }

    const filterComplex = filterParts.join('; ');
    const fullCommand = [
      'ffmpeg -y',
      ...inputs,
      `-filter_complex "${filterComplex}"`,
      `-map "[${currentStream}]"`,
      audioStream,
      `-c:v libx264 -pix_fmt yuv420p -r ${fps} -t ${duration}`,
      `"${outputFilename}"`,
    ].join(' ');

    return {
      command: fullCommand,
      inputs,
      filterComplex,
      outputFilename,
    };
  }
}
