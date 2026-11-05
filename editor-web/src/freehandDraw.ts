// Desenho à mão livre (TASK-14): presets de caneta e cor com transparência — funções puras.
import { parseColor, rgbToHex } from './contrast';

/** Nome de camada dos traços (o painel Camadas e `isFreehandPath` usam). */
export const FREEHAND_LAYER = 'Traço à mão';
/** Distância mínima (px de tela) entre pontos do traço: o Fabric descarta os mais próximos e o traço não treme. */
export const FREEHAND_DECIMATE = 2.5;

export type PenId = 'offer' | 'highlighter' | 'fine' | 'fine-white';
export interface PenPreset {
  id: PenId;
  label: string;
  color: string;
  /** Espessura como fração do menor lado da página. */
  size: number;
}

export const PEN_PRESETS: PenPreset[] = [
  { id: 'offer', label: '⭕ Circula-oferta', color: '#e53935', size: 0.012 },
  { id: 'highlighter', label: '🖍️ Marca-texto', color: 'rgba(255, 235, 59, 0.45)', size: 0.04 },
  { id: 'fine', label: '✒️ Caneta fina', color: '#111111', size: 0.005 },
  { id: 'fine-white', label: '✒️ Fina branca', color: '#ffffff', size: 0.005 },
];

/** Espessura limites do slider, como fração do menor lado da página. */
export const PEN_MIN = 0.002;
export const PEN_MAX = 0.08;

export function penWidth(size: number, pageMin: number): number {
  return Math.max(1, Math.round(size * pageMin));
}

/** Alfa (0..1) da cor; 1 se não for legível. */
export function alphaOf(color: unknown): number {
  return parseColor(color)?.a ?? 1;
}

/** A cor `color` com o alfa dado (`rgba(...)`), ou `#rrggbb` se opaca. */
export function withAlpha(color: string, alpha: number): string {
  const c = parseColor(color);
  if (!c) return color;
  if (alpha >= 1) return rgbToHex(c.r, c.g, c.b);
  const a = Math.round(Math.max(0, alpha) * 1000) / 1000;
  return `rgba(${c.r}, ${c.g}, ${c.b}, ${a})`;
}

/** O seletor nativo só dá #rrggbb: a nova cor herda o alfa da atual (o marca-texto continua translúcido). */
export function keepAlpha(current: unknown, picked: string): string {
  return withAlpha(picked, alphaOf(current));
}

interface MaybePath { type?: unknown; fill?: unknown; layerName?: unknown; get?: (k: string) => unknown }

/** Traço feito pelo "✍️ Desenhar à mão": Path sem preenchimento com a camada "Traço à mão". */
export function isFreehandPath(o: MaybePath | undefined | null): boolean {
  if (!o) return false;
  const name = typeof o.get === 'function' ? o.get('layerName') : o.layerName;
  return String(o.type).toLowerCase() === 'path' && name === FREEHAND_LAYER && (o.fill === null || o.fill === '' || o.fill === undefined);
}
