// Paleta do documento ("Cores neste anúncio"), cores dominantes de uma foto e cores recentes — sem DOM.

import { normalizeHex, rgbToHex } from './contrast';

/** Forma mínima de um objeto do Fabric que a extração lê (duck typing: testável sem canvas). */
export interface ColorSource {
  /** Tipo da instância do Fabric (minúsculo): 'image' tem `fill` preto padrão que não é cor do anúncio. */
  type?: string;
  visible?: boolean;
  fill?: unknown;
  stroke?: unknown;
  textBackgroundColor?: unknown;
  getObjects?: () => ColorSource[];
}

function paintColors(paint: unknown): string[] {
  if (typeof paint === 'string') {
    const h = normalizeHex(paint);
    return h ? [h] : [];
  }
  const stops = (paint as { colorStops?: { color?: unknown }[] } | null)?.colorStops;
  if (Array.isArray(stops)) return stops.map((s) => normalizeHex(s.color)).filter((c): c is string => c !== null);
  return [];
}

/**
 * Cores usadas nas camadas visíveis (fill, stroke, textBackgroundColor, paradas de degradê; desce nos grupos) e no fundo,
 * em ordem de aparição, sem repetição, #rrggbb minúsculo.
 */
export function collectColors(objects: ColorSource[], background?: unknown): string[] {
  const out: string[] = [];
  const push = (cs: string[]) => { for (const c of cs) if (!out.includes(c)) out.push(c); };
  push(paintColors(background));
  const walk = (o: ColorSource) => {
    if (o.visible === false) return;
    if (o.type !== 'image') {
      push(paintColors(o.fill));
      push(paintColors(o.stroke));
    }
    push(paintColors(o.textBackgroundColor));
    if (typeof o.getObjects === 'function') for (const c of o.getObjects()) walk(c);
  };
  for (const o of objects) walk(o);
  return out;
}

/**
 * Até `k` cores dominantes de pixels RGBA: ignora alfa < 128, agrupa em caixas de 32 níveis por canal (8³ caixas), devolve a
 * média das caixas mais cheias, pulando as parecidas demais com uma já escolhida (distância < 48) e as com menos de
 * `minShare` dos pixels opacos (mistura de borda da redução).
 */
export function dominantColors(data: ArrayLike<number>, width: number, height: number, k = 4, minShare = 0.08): string[] {
  const boxes = new Map<number, { n: number; r: number; g: number; b: number }>();
  for (let i = 0; i < width * height; i++) {
    const p = i * 4;
    if (data[p + 3] < 128) continue;
    const r = data[p], g = data[p + 1], b = data[p + 2];
    const key = ((r >> 5) << 6) | ((g >> 5) << 3) | (b >> 5);
    const box = boxes.get(key) ?? { n: 0, r: 0, g: 0, b: 0 };
    box.n++; box.r += r; box.g += g; box.b += b;
    boxes.set(key, box);
  }
  let opaque = 0;
  for (const b of boxes.values()) opaque += b.n;
  const sorted = [...boxes.values()].filter((b) => b.n >= opaque * minShare).sort((a, b) => b.n - a.n).map((x) => ({ r: x.r / x.n, g: x.g / x.n, b: x.b / x.n }));
  const picked: { r: number; g: number; b: number }[] = [];
  for (const c of sorted) {
    if (picked.length >= k) break;
    if (picked.some((p) => Math.hypot(p.r - c.r, p.g - c.g, p.b - c.b) < 48)) continue;
    picked.push(c);
  }
  return picked.map((c) => rgbToHex(c.r, c.g, c.b));
}

export interface KeyValueStore { getItem(k: string): string | null; setItem(k: string, v: string): void }

export const RECENT_COLORS_KEY = 'pp_recent_colors';

/** Últimas cores usadas (mais recente primeiro, sem repetição), persistidas quando há armazenamento. */
export class RecentColors {
  private list: string[] = [];

  constructor(private readonly store: KeyValueStore | null, readonly max = 8) {
    try {
      const raw = store?.getItem(RECENT_COLORS_KEY);
      const parsed: unknown = raw ? JSON.parse(raw) : [];
      if (Array.isArray(parsed)) this.list = parsed.map(normalizeHex).filter((c): c is string => c !== null).slice(0, max);
    } catch { /* armazenamento ausente ou corrompido: começa vazio, em memória */ }
  }

  get colors(): string[] { return [...this.list]; }

  add(color: string): void {
    const c = normalizeHex(color);
    if (!c) return;
    this.list = [c, ...this.list.filter((x) => x !== c)].slice(0, this.max);
    try { this.store?.setItem(RECENT_COLORS_KEY, JSON.stringify(this.list)); } catch { /* só em memória */ }
  }
}
