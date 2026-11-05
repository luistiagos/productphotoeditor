import type { Textbox } from 'fabric';

/**
 * Arco do texto curvo (ARQUITETURA §28 D). `amount` em -100..100 (0 = reto; 100 = meio círculo, para cima; negativo,
 * para baixo). O comprimento do arco é a largura do **texto**, não a da caixa do Textbox: o Fabric centraliza o texto no
 * caminho, e um arco mais comprido deixava as letras só no topo, acima do centro do objeto.
 */
export interface CurveArc {
  /** Caminho SVG do arco, de ponta a ponta. */
  d: string;
  radius: number;
  /** Ângulo do arco em radianos. */
  sweep: number;
  /** Flecha: distância entre a corda e o ponto mais alto (ou mais baixo) do arco. */
  sagitta: number;
}

export type WarpStyle =
  | 'none'
  | 'arc'
  | 'wave'
  | 'flag'
  | 'rise'
  | 'arc-upper'
  | 'arc-lower'
  | 'bulge'
  | 'squeeze'
  | 'shell-upper'
  | 'shell-lower'
  | 'fish'
  | 'fisheye'
  | 'inflate'
  | 'twist';

export const WARP_STYLES: { id: WarpStyle; label: string; kind: 'path' | 'envelope' }[] = [
  { id: 'none', label: 'Reto (Nenhum)', kind: 'path' },
  { id: 'arc', label: 'Arco Circular', kind: 'path' },
  { id: 'wave', label: 'Onda Senoidal', kind: 'path' },
  { id: 'flag', label: 'Bandeira Promocional', kind: 'path' },
  { id: 'rise', label: 'Subida S (Rise)', kind: 'path' },
  { id: 'arc-upper', label: 'Arco Superior (Toldo)', kind: 'envelope' },
  { id: 'arc-lower', label: 'Arco Inferior', kind: 'envelope' },
  { id: 'bulge', label: 'Estufado (Bulge)', kind: 'envelope' },
  { id: 'squeeze', label: 'Espremido (Squeeze)', kind: 'envelope' },
  { id: 'shell-upper', label: 'Concha Superior', kind: 'envelope' },
  { id: 'shell-lower', label: 'Concha Inferior', kind: 'envelope' },
  { id: 'fish', label: 'Perfil de Peixe', kind: 'envelope' },
  { id: 'fisheye', label: 'Olho de Peixe (Radial)', kind: 'envelope' },
  { id: 'inflate', label: 'Inflar 3D', kind: 'envelope' },
  { id: 'twist', label: 'Torção (Twist)', kind: 'envelope' },
];

export function isPathWarp(style?: string): boolean {
  return style === 'arc' || style === 'wave' || style === 'flag' || style === 'rise';
}

export function isEnvelopeWarp(style?: string): boolean {
  return (
    style === 'arc-upper' ||
    style === 'arc-lower' ||
    style === 'bulge' ||
    style === 'squeeze' ||
    style === 'shell-upper' ||
    style === 'shell-lower' ||
    style === 'fish' ||
    style === 'fisheye' ||
    style === 'inflate' ||
    style === 'twist'
  );
}

export function curveArc(textWidth: number, amount: number): CurveArc | undefined {
  if (Math.abs(amount) < 1) return undefined;
  const w = Math.max(textWidth, 10);
  const radius = (w * 100) / (Math.abs(amount) * Math.PI);
  const sweep = w / radius;
  const half = Math.sin(sweep / 2) * radius;
  const sagitta = radius * (1 - Math.cos(sweep / 2));
  // para cima: pontas em y = flecha, topo em 0; para baixo: pontas em -flecha, fundo em 0
  const y = amount > 0 ? sagitta : -sagitta;
  const d = `M ${-half} ${y} A ${radius} ${radius} 0 0 ${amount > 0 ? 1 : 0} ${half} ${y}`;
  return { d, radius, sweep, sagitta };
}

export function curveWave(textWidth: number, amount: number): CurveArc | undefined {
  if (Math.abs(amount) < 1) return undefined;
  const w = Math.max(textWidth, 10);
  const half = w / 2;
  const amp = (amount / 100) * (w * 0.2);
  const d = `M ${-half} 0 C ${-half * 0.5} ${-amp} ${half * 0.5} ${amp} ${half} 0`;
  const sagitta = Math.abs(amp);
  return { d, radius: w / 2, sweep: Math.PI, sagitta };
}

export function curveFlag(textWidth: number, amount: number): CurveArc | undefined {
  if (Math.abs(amount) < 1) return undefined;
  const w = Math.max(textWidth, 10);
  const half = w / 2;
  const amp = (amount / 100) * (w * 0.2);
  const d = `M ${-half} 0 C ${-half * 0.3} ${-amp * 0.7} ${half * 0.3} ${amp} ${half} ${-amp * 0.5}`;
  const sagitta = Math.abs(amp);
  return { d, radius: w / 2, sweep: Math.PI, sagitta };
}

export function curveRise(textWidth: number, amount: number): CurveArc | undefined {
  if (Math.abs(amount) < 1) return undefined;
  const w = Math.max(textWidth, 10);
  const half = w / 2;
  const amp = (amount / 100) * (w * 0.2);
  const d = `M ${-half} ${amp} C ${-half * 0.1} ${amp} ${half * 0.1} ${-amp} ${half} ${-amp}`;
  const sagitta = Math.abs(amp) * 2;
  return { d, radius: w / 2, sweep: Math.PI, sagitta };
}

export function curvePath(style: WarpStyle, textWidth: number, amount: number): CurveArc | undefined {
  switch (style) {
    case 'arc':
      return curveArc(textWidth, amount);
    case 'wave':
      return curveWave(textWidth, amount);
    case 'flag':
      return curveFlag(textWidth, amount);
    case 'rise':
      return curveRise(textWidth, amount);
    default:
      return undefined;
  }
}

/**
 * Avalia deformação de envelope no espaço normalizado (u, v) in [-1, 1].
 */
export function evalWarpEnvelope(
  style: WarpStyle,
  u: number,
  v: number,
  bend: number,
  distortH = 0,
  distortV = 0,
): { u: number; v: number } {
  const cu = Math.max(-1, Math.min(1, u));
  const cv = Math.max(-1, Math.min(1, v));
  const b = bend / 100;
  const dh = distortH / 100;
  const dv = distortV / 100;

  let u1 = cu * (1 - cv * dh * 0.4);
  let v1 = cv * (1 + cu * dv * 0.4);

  const arch = Math.max(0, 1 - cu * cu);

  let uOut = u1;
  let vOut = v1;

  switch (style) {
    case 'arc': {
      vOut = v1 - b * arch;
      break;
    }
    case 'wave': {
      vOut = v1 - b * Math.sin(Math.PI * cu) * 0.5;
      break;
    }
    case 'flag': {
      vOut = v1 - b * (Math.sin(Math.PI * cu) * 0.5 + 0.3 * cu);
      break;
    }
    case 'rise': {
      vOut = v1 - b * cu * 0.5;
      break;
    }
    case 'arc-upper': {
      const weightTop = Math.max(0, Math.min(1, (1 - cv) / 2));
      vOut = v1 - b * arch * weightTop;
      break;
    }
    case 'arc-lower': {
      const weightBottom = Math.max(0, Math.min(1, (cv + 1) / 2));
      vOut = v1 + b * arch * weightBottom;
      break;
    }
    case 'bulge': {
      vOut = v1 * (1 + b * arch * 0.8);
      break;
    }
    case 'squeeze': {
      vOut = v1 * (1 - b * arch * 0.6);
      break;
    }
    case 'shell-upper': {
      const weightTop = Math.max(0, Math.min(1, (1 - cv) / 2));
      vOut = v1 - b * arch * 0.7 * weightTop;
      uOut = u1 * (1 - cv * b * 0.3);
      break;
    }
    case 'shell-lower': {
      const weightBottom = Math.max(0, Math.min(1, (cv + 1) / 2));
      vOut = v1 + b * arch * 0.7 * weightBottom;
      uOut = u1 * (1 + cv * b * 0.3);
      break;
    }
    case 'fish': {
      const fishScale = 1 + b * (0.6 * arch - 0.4 * cu);
      vOut = v1 * Math.max(0.1, fishScale);
      break;
    }
    case 'fisheye': {
      const r = Math.sqrt(cu * cu + cv * cv);
      if (r > 0) {
        const factor = 1 + b * 0.6 * Math.max(0, 1 - Math.min(1, r * r));
        uOut = cu * factor;
        vOut = cv * factor;
      }
      break;
    }
    case 'inflate': {
      const archV = Math.max(0, 1 - cv * cv);
      const factor = 1 + b * arch * archV * 0.8;
      uOut = cu * factor;
      vOut = cv * factor;
      break;
    }
    case 'twist': {
      const r2 = Math.min(1, cu * cu + cv * cv);
      const theta = b * (1 - r2) * 0.6;
      const cosT = Math.cos(theta);
      const sinT = Math.sin(theta);
      uOut = cu * cosT - cv * sinT;
      vOut = cu * sinT + cv * cosT;
      break;
    }
    case 'none':
    default:
      break;
  }

  return { u: uOut, v: vOut };
}

export function evalEnvelopeColumn(
  style: WarpStyle,
  u: number,
  bend: number,
  distortH = 0,
  distortV = 0,
): { top: number; bottom: number; xOffset: number; scaleX: number } {
  const topPoint = evalWarpEnvelope(style, u, -1, bend, distortH, distortV);
  const bottomPoint = evalWarpEnvelope(style, u, 1, bend, distortH, distortV);
  const centerPoint = evalWarpEnvelope(style, u, 0, bend, distortH, distortV);

  return {
    top: topPoint.v,
    bottom: bottomPoint.v,
    xOffset: centerPoint.u - u,
    scaleX: 1,
  };
}

const PORTUGUESE_STOPWORDS = new Set([
  'de', 'da', 'do', 'dos', 'das',
  'por', 'com', 'em', 'e', 'a', 'o', 'os', 'as',
  'um', 'uma', 'uns', 'umas', 'para', 'na', 'no', 'nas', 'nos'
]);

export function toTitleCase(text: string): string {
  if (!text) return text;
  let wordIndex = 0;
  return text.replace(/[^\s\p{P}]+/gu, (word, offset, fullString) => {
    const lower = word.toLocaleLowerCase('pt-BR');
    const isFirstInLine = offset === 0 || /[\n\r]\s*$/.test(fullString.slice(0, offset));
    const shouldKeepLower = !isFirstInLine && wordIndex > 0 && PORTUGUESE_STOPWORDS.has(lower);
    wordIndex++;
    if (shouldKeepLower) {
      return lower;
    }
    return word.charAt(0).toLocaleUpperCase('pt-BR') + word.slice(1).toLocaleLowerCase('pt-BR');
  });
}

export function cycleTextCase(text: string): string {
  if (!text) return text;
  const upper = text.toLocaleUpperCase('pt-BR');
  const lower = text.toLocaleLowerCase('pt-BR');
  const title = toTitleCase(text);

  if (upper === lower) return text;

  if (text === upper) {
    return lower;
  }
  if (text === lower) {
    return title;
  }
  return upper;
}

let offscreenCanvas: HTMLCanvasElement | null = null;

export function renderWarpedEnvelope(
  textbox: Textbox,
  ctx: CanvasRenderingContext2D,
  style: WarpStyle,
  bend: number,
  distortH: number,
  distortV: number,
  origRender: (this: Textbox, ctx: CanvasRenderingContext2D) => void,
): void {
  const w = Math.ceil(textbox.width);
  const h = Math.ceil(textbox.height);
  if (w <= 0 || h <= 0) return;

  if (typeof document !== 'undefined') {
    if (!offscreenCanvas) {
      offscreenCanvas = document.createElement('canvas');
    }
    offscreenCanvas.width = Math.max(1, w);
    offscreenCanvas.height = Math.max(1, h);
    const offCtx = offscreenCanvas.getContext('2d');
    if (!offCtx) return;

    offCtx.clearRect(0, 0, w, h);
    offCtx.save();
    offCtx.translate(w / 2, h / 2);
    origRender.call(textbox, offCtx);
    offCtx.restore();

    const slices = 64;
    const sliceW = w / slices;

    ctx.save();
    for (let i = 0; i < slices; i++) {
      const sx = i * sliceW;
      const u = (sx + sliceW / 2) / (w / 2) - 1;

      const bounds = evalEnvelopeColumn(style, u, bend, distortH, distortV);
      const topY = (h / 2) * bounds.top;
      const bottomY = (h / 2) * bounds.bottom;
      const destH = Math.max(0.1, bottomY - topY);
      const destX = -w / 2 + sx + bounds.xOffset * (w / 2);
      const destW = sliceW * bounds.scaleX + 0.5;

      ctx.drawImage(offscreenCanvas, sx, 0, sliceW, h, destX, topY, destW, destH);
    }
    ctx.restore();
  } else {
    origRender.call(textbox, ctx);
  }
}

let warpRendererInstalled = false;

export function installWarpRenderer(TextboxClass: typeof Textbox): void {
  if (warpRendererInstalled) return;
  warpRendererInstalled = true;

  const origRender = TextboxClass.prototype._render;
  TextboxClass.prototype._render = function (this: Textbox, ctx: CanvasRenderingContext2D) {
    const style = this.get('warpStyle') as WarpStyle | undefined;
    const bend = Number(this.get('warpBend') ?? 0);
    if (style && isEnvelopeWarp(style) && Math.abs(bend) >= 1) {
      renderWarpedEnvelope(
        this,
        ctx,
        style,
        bend,
        Number(this.get('warpDistortH') ?? 0),
        Number(this.get('warpDistortV') ?? 0),
        origRender,
      );
      return;
    }
    origRender.call(this, ctx);
  };
}
