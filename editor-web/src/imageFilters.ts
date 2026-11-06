// Modos de mesclagem e filtros fotográficos da TASK-07, sobre filtros NATIVOS do Fabric 7.4.0 (GL + 2D):
// Nitidez = `filters.Convolute` (3×3); Temperatura e Duotone = `filters.ColorMatrix` (lineares em RGB).
// Implementação própria; a análise do app de referência foi só especificação.

/** Matriz 4×5 do `filters.ColorMatrix` (linhas R, G, B, A; a 5ª coluna é o offset em 0..1). */
export type ColorMatrix20 = [
  number, number, number, number, number,
  number, number, number, number, number,
  number, number, number, number, number,
  number, number, number, number, number,
];

/** Os 16 modos do Canvas 2D (`globalCompositeOperation`), na ordem e com os rótulos da spec (§2.1). */
export const BLEND_MODES: [GlobalCompositeOperation, string][] = [
  ['source-over', 'Normal'],
  ['multiply', 'Multiplicar (sombras)'],
  ['screen', 'Tela (luzes/brilhos)'],
  ['overlay', 'Sobrepor'],
  ['darken', 'Escurecer'],
  ['lighten', 'Clarear'],
  ['color-dodge', 'Subexposição de Cor'],
  ['color-burn', 'Superexposição de Cor'],
  ['hard-light', 'Luz Forte'],
  ['soft-light', 'Luz Suave'],
  ['difference', 'Diferença'],
  ['exclusion', 'Exclusão'],
  ['hue', 'Matiz'],
  ['saturation', 'Saturação'],
  ['color', 'Cor'],
  ['luminosity', 'Luminosidade'],
];

const BLEND_IDS = new Set<string>(BLEND_MODES.map(([id]) => id));
export function isBlendMode(v: unknown): v is GlobalCompositeOperation {
  return typeof v === 'string' && BLEND_IDS.has(v);
}

/** Nitidez s ∈ [0, 1]: K(s) = [0 −s 0; −s 1+4s −s; 0 −s 0] (soma 1: área lisa não muda; s = 0 é a identidade). */
export function sharpenKernel(s: number): number[] {
  return [0, -s, 0, -s, 1 + 4 * s, -s, 0, -s, 0];
}

/** Ganho máximo por canal da Temperatura (±15%). */
export const WARMTH_GAIN = 0.15;

/**
 * Temperatura w ∈ [−1, 1] (frio ↔ quente): ganho na diagonal, R × (1 + 0,15w) e B × (1 − 0,15w). Ganho, não offset:
 * o preto continua preto (um offset tingiria as sombras).
 */
export function warmthMatrix(w: number): ColorMatrix20 {
  return [
    1 + WARMTH_GAIN * w, 0, 0, 0, 0,
    0, 1, 0, 0, 0,
    0, 0, 1 - WARMTH_GAIN * w, 0, 0,
    0, 0, 0, 1, 0,
  ];
}

/** `#rgb` / `#rrggbb` → [r, g, b] em 0..1; `null` se não for hex. */
export function hexToRgb01(hex: string): [number, number, number] | null {
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const s = m[1].length === 3 ? m[1].split('').map((c) => c + c).join('') : m[1];
  return [0, 2, 4].map((i) => parseInt(s.slice(i, i + 2), 16) / 255) as [number, number, number];
}

/**
 * Duotone: Y = 0,299R + 0,587G + 0,114B ∈ [0, 1] e saída = lerp(sombra, destaque, Y). Linear em RGB, então cabe no
 * ColorMatrix: linha c = [(h_c − s_c)·0,299, (h_c − s_c)·0,587, (h_c − s_c)·0,114, 0, s_c]; a linha de alfa é a
 * identidade (o recorte transparente fica intacto). `null` se alguma cor não for hex.
 */
export function duotoneMatrix(shadowHex: string, highlightHex: string): ColorMatrix20 | null {
  const s = hexToRgb01(shadowHex);
  const hi = hexToRgb01(highlightHex);
  if (!s || !hi) return null;
  const row = (c: number): number[] => {
    const d = hi[c] - s[c];
    return [d * 0.299, d * 0.587, d * 0.114, 0, s[c]];
  };
  return [...row(0), ...row(1), ...row(2), 0, 0, 0, 1, 0] as ColorMatrix20;
}

/** Duotone aplicado: `id` do chip e as cores gravadas em hex (o rascunho reabre igual mesmo se o brand kit mudar). */
export interface DuotoneSpec { id: string; shadow: string; highlight: string }

/**
 * Ajustes da TASK-07 guardados na imagem (`filterAdjust`, propriedade custom): é o que a folha Filtros relê. Os filtros
 * que renderizam continuam em `img.filters` (Temperatura e Duotone são ambos `ColorMatrix` e não se distinguem por `type`).
 */
export interface FilterAdjust { sharpen?: number; warmth?: number; duotone?: DuotoneSpec }

export interface DuotonePreset { id: string; label: string; shadow: string; highlight: string }

/** Presets de cor fixa (o "Duotone da Marca" vem do brand kit: `brandDuotone`). */
export const DUOTONE_PRESETS: DuotonePreset[] = [
  { id: 'cyberpunk', label: 'Cyberpunk', shadow: '#240046', highlight: '#00f5d4' },
  { id: 'sepiaGold', label: 'Sépia Ouro', shadow: '#3e2a14', highlight: '#f4d58d' },
  { id: 'deepBlue', label: 'Azul Profundo', shadow: '#0b1d51', highlight: '#9ad1ff' },
];

export const BRAND_DUOTONE_ID = 'brand';

/** Duotone da Marca: sombra = cor primária, destaque = secundária (ou branco). `null` sem primária válida. */
export function brandDuotone(colors: { primary?: string; secondary?: string }): DuotoneSpec | null {
  const shadow = colors.primary;
  if (!shadow || !hexToRgb01(shadow)) return null;
  const highlight = colors.secondary && hexToRgb01(colors.secondary) ? colors.secondary : '#ffffff';
  return { id: BRAND_DUOTONE_ID, shadow, highlight };
}

/** Lê `filterAdjust` de um rascunho (valor desconhecido): só os campos válidos voltam. */
export function parseFilterAdjust(v: unknown): FilterAdjust {
  if (!v || typeof v !== 'object') return {};
  const o = v as Record<string, unknown>;
  const out: FilterAdjust = {};
  if (typeof o.sharpen === 'number' && Number.isFinite(o.sharpen) && o.sharpen !== 0) out.sharpen = o.sharpen;
  if (typeof o.warmth === 'number' && Number.isFinite(o.warmth) && o.warmth !== 0) out.warmth = o.warmth;
  const d = o.duotone as Record<string, unknown> | undefined;
  if (d && typeof d === 'object' && typeof d.id === 'string' && typeof d.shadow === 'string' && typeof d.highlight === 'string'
    && hexToRgb01(d.shadow) && hexToRgb01(d.highlight)) {
    out.duotone = { id: d.id, shadow: d.shadow, highlight: d.highlight };
  }
  return out;
}

/** O `filterAdjust` a gravar: sem campos zerados; `undefined` quando não sobra nada (some do JSON). */
export function compactFilterAdjust(a: FilterAdjust): FilterAdjust | undefined {
  const out = parseFilterAdjust(a);
  return Object.keys(out).length ? out : undefined;
}
