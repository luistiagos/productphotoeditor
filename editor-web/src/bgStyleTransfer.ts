// Estilo de fundo (TASK-09): das cores dominantes de uma foto (ou de um fundo) para um degradê, o "mood" e a cor de texto
// legível. Puro: as cores chegam prontas (`palette.ts::dominantColors`), o editor aplica o degradê.
import { contrastRatio, GOOD_CONTRAST, parseColor, relativeLuminance, rgbToHex, type Rgba } from './contrast';
import { evenStops, type GradientSpec } from './gradients';

export type BackgroundMood = 'dark' | 'light' | 'vibrant' | 'minimal';
export type TextColor = '#ffffff' | '#111111';

export interface BackgroundStyle {
  primaryBgColor: string;
  secondaryBgColor: string;
  mood: BackgroundMood;
  recommendedTextColor: TextColor;
  /** Degradê linear a 45° (graus do editor: 0 = →, 90 = ↓) das duas cores. */
  gradient: GradientSpec;
}

/** Saturação HSV (0..1): pastel claro dá baixa, ao contrário da HSL. */
export function saturation(c: Rgba): number {
  const max = Math.max(c.r, c.g, c.b), min = Math.min(c.r, c.g, c.b);
  return max === 0 ? 0 : (max - min) / max;
}

/** Mistura `c` com `toward` (0 = c, 1 = toward). */
export function mix(c: Rgba, toward: Rgba, t: number): Rgba {
  return { r: c.r + (toward.r - c.r) * t, g: c.g + (toward.g - c.g) * t, b: c.b + (toward.b - c.b) * t, a: 1 };
}

const WHITE: Rgba = { r: 255, g: 255, b: 255, a: 1 };
const BLACK: Rgba = { r: 0, g: 0, b: 0, a: 1 };
const hex = (c: Rgba) => rgbToHex(c.r, c.g, c.b);

/** Clima do par de cores: saturado = vibrant; escuro = dark; quase sem cor e claro = minimal; o resto = light. */
export function moodOf(colors: Rgba[]): BackgroundMood {
  const lum = colors.reduce((s, c) => s + relativeLuminance(c), 0) / colors.length;
  const sat = Math.max(...colors.map(saturation));
  if (sat >= 0.55 && lum > 0.05 && lum < 0.6) return 'vibrant';
  // 0,179 = luminância em que branco e quase-preto contrastam igual
  if (lum < 0.179) return 'dark';
  if (sat < 0.15 && lum > 0.7) return 'minimal';
  return 'light';
}

/** Menor contraste do texto contra as paradas do degradê (o pior ponto do fundo). */
export function worstContrast(text: string, stops: Rgba[]): number {
  return Math.min(...stops.map((s) => contrastRatio(text, s)));
}

/**
 * Cores dominantes (a 1ª é a mais frequente) → estilo de fundo: degradê da 1ª para a 2ª (o `dominantColors` já as separa);
 * com uma cor só, dela para um tom dela (mais claro se escura, mais escuro se clara). O texto é o branco ou o quase-preto de melhor
 * pior-caso; as paradas escurecem (texto branco) ou clareiam (texto escuro) até ele ter 4,5:1 sobre o degradê inteiro.
 * Lista sem cor válida → `null` (a UI avisa, não aplica degradê vazio).
 */
export function extractBackgroundStyle(colors: string[]): BackgroundStyle | null {
  const parsed = colors.map((c) => parseColor(c)).filter((c): c is Rgba => c !== null && c.a > 0).map((c) => ({ ...c, a: 1 }));
  if (parsed.length === 0) return null;
  const primary = parsed[0];
  const secondary = parsed[1] ?? mix(primary, relativeLuminance(primary) < 0.179 ? WHITE : BLACK, 0.3);
  const mood = moodOf([primary, secondary]);
  const text: TextColor = worstContrast('#ffffff', [primary, secondary]) >= worstContrast('#111111', [primary, secondary]) ? '#ffffff' : '#111111';
  const target = text === '#ffffff' ? BLACK : WHITE;
  // a conta é sobre a cor já arredondada para #rrggbb (é ela que vai para o degradê)
  const readable = (c: Rgba): string => {
    let out = hex(c);
    for (let i = 1; i <= 20 && contrastRatio(text, out) < GOOD_CONTRAST; i++) out = hex(mix(c, target, i * 0.05));
    return out;
  };
  const p = readable(primary), s = readable(secondary);
  return {
    primaryBgColor: p,
    secondaryBgColor: s,
    mood,
    recommendedTextColor: text,
    gradient: { kind: 'linear', angle: 45, stops: evenStops([p, s]) },
  };
}
