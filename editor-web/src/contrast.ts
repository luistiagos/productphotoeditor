// Contraste WCAG 2.1 (luminância relativa e razão de contraste) — funções puras, sem DOM.

export interface Rgba { r: number; g: number; b: number; a: number }

const NAMED: Record<string, string> = {
  white: '#ffffff', black: '#000000', red: '#ff0000', green: '#008000', blue: '#0000ff', yellow: '#ffff00',
  gray: '#808080', grey: '#808080', orange: '#ffa500', transparent: '#00000000',
};

/** Cor CSS simples (#rgb, #rgba, #rrggbb, #rrggbbaa, rgb(), rgba(), nomes básicos) → componentes 0..255 / alfa 0..1. */
export function parseColor(color: unknown): Rgba | null {
  if (typeof color !== 'string') return null;
  let c = color.trim().toLowerCase();
  if (NAMED[c]) c = NAMED[c];
  let m = /^#([0-9a-f]{3,8})$/.exec(c);
  if (m) {
    let hex = m[1];
    if (hex.length === 3 || hex.length === 4) hex = [...hex].map((x) => x + x).join('');
    if (hex.length !== 6 && hex.length !== 8) return null;
    const n = (i: number) => parseInt(hex.slice(i, i + 2), 16);
    return { r: n(0), g: n(2), b: n(4), a: hex.length === 8 ? n(6) / 255 : 1 };
  }
  m = /^rgba?\(([^)]+)\)$/.exec(c);
  if (m) {
    const parts = m[1].split(/[\s,/]+/).filter(Boolean);
    if (parts.length < 3) return null;
    const ch = (s: string) => (s.endsWith('%') ? (parseFloat(s) * 255) / 100 : parseFloat(s));
    const [r, g, b] = parts.slice(0, 3).map(ch);
    const a = parts[3] === undefined ? 1 : parts[3].endsWith('%') ? parseFloat(parts[3]) / 100 : parseFloat(parts[3]);
    if ([r, g, b, a].some((v) => Number.isNaN(v))) return null;
    const clamp = (v: number, max: number) => Math.min(max, Math.max(0, v));
    return { r: Math.round(clamp(r, 255)), g: Math.round(clamp(g, 255)), b: Math.round(clamp(b, 255)), a: clamp(a, 1) };
  }
  return null;
}

export function rgbToHex(r: number, g: number, b: number): string {
  const x = (v: number) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, '0');
  return `#${x(r)}${x(g)}${x(b)}`;
}

/** #rrggbb minúsculo, ou null se não for cor opaca/semitransparente legível (transparente total → null). */
export function normalizeHex(color: unknown): string | null {
  const p = parseColor(color);
  if (!p || p.a === 0) return null;
  return rgbToHex(p.r, p.g, p.b);
}

function channel(v: number): number {
  const c = v / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

/** Luminância relativa WCAG 2.1 (0 = preto, 1 = branco). */
export function relativeLuminance(color: string | Rgba): number {
  const p = typeof color === 'string' ? parseColor(color) : color;
  if (!p) return 0;
  return 0.2126 * channel(p.r) + 0.7152 * channel(p.g) + 0.0722 * channel(p.b);
}

/** Razão de contraste (1..21). */
export function contrastRatio(a: string | Rgba, b: string | Rgba): number {
  const l1 = relativeLuminance(a);
  const l2 = relativeLuminance(b);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

/** Compõe `top` (com alfa) sobre `bottom` opaco. */
export function composite(top: Rgba, bottom: Rgba): Rgba {
  const a = top.a;
  return { r: top.r * a + bottom.r * (1 - a), g: top.g * a + bottom.g * (1 - a), b: top.b * a + bottom.b * (1 - a), a: 1 };
}

/** Média simples (sRGB) de amostras RGBA; pixels transparentes contam como `fallback` (o branco da página). */
export function averageColor(samples: Rgba[], fallback: Rgba = { r: 255, g: 255, b: 255, a: 1 }): Rgba {
  if (samples.length === 0) return fallback;
  let r = 0, g = 0, b = 0;
  for (const s of samples) {
    const c = composite(s, fallback);
    r += c.r; g += c.g; b += c.b;
  }
  const n = samples.length;
  return { r: Math.round(r / n), g: Math.round(g / n), b: Math.round(b / n), a: 1 };
}

/** Limiar do aviso: abaixo de 3:1 nem título grande se lê bem (WCAG AA texto grande). */
export const LOW_CONTRAST = 3;
/** Alvo da correção: AA de texto normal. */
export const GOOD_CONTRAST = 4.5;

export interface Suggestion { color: string; ratio: number; role?: string }

/**
 * Cor de texto mais legível sobre `background`: a cor da marca de maior contraste, se alcançar 4,5:1; senão branco
 * (#ffffff) ou quase-preto (#111111), o que contrastar mais.
 */
export function suggestReadableColor(background: string | Rgba, brand: { color: string; role?: string }[] = []): Suggestion {
  let best: Suggestion | null = null;
  for (const c of brand) {
    if (!parseColor(c.color)) continue;
    const ratio = contrastRatio(c.color, background);
    if (ratio >= GOOD_CONTRAST && (!best || ratio > best.ratio)) best = { color: normalizeHex(c.color) ?? c.color, ratio, role: c.role };
  }
  if (best) return best;
  const white = contrastRatio('#ffffff', background);
  const black = contrastRatio('#111111', background);
  return white >= black ? { color: '#ffffff', ratio: white } : { color: '#111111', ratio: black };
}

/** "2.1:1" com uma casa. */
export function formatRatio(r: number): string {
  return `${(Math.floor(r * 10) / 10).toFixed(1)}:1`;
}
