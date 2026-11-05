import { Gradient } from 'fabric';

/** Degradê do usuário (TASK-12): gravado em `customGradient` no objeto para reabrir o editor e refazer as coordenadas. */
export interface GradientStop {
  offset: number; // 0..1
  color: string; // #rrggbb
}
export interface GradientSpec {
  /** `kind`, não `type`: o Fabric reviveria um objeto com `type: 'linear'` como Gradient (enlivenObjectEnlivables). */
  kind: 'linear' | 'radial';
  /** Graus, só no linear: 0 = →, 90 = ↓ (y do canvas para baixo). */
  angle: number;
  stops: GradientStop[];
}

export const MIN_STOPS = 2;
export const MAX_STOPS = 5;

export type GradientCoords =
  | { x1: number; y1: number; x2: number; y2: number }
  | { x1: number; y1: number; x2: number; y2: number; r1: number; r2: number };

const round = (v: number) => Math.round(v * 1000) / 1000 || 0; // sem -0

/**
 * Coordenadas em pixels relativas ao canto superior esquerdo de uma caixa `width × height` (o referencial do Fabric para
 * `gradientUnits: 'pixels'`). Linear: segmento centrado na caixa, na direção do ângulo, com a meia-projeção da caixa nessa
 * direção (o degradê vai de borda a borda em qualquer ângulo). Radial: círculo centrado, raio 0,7 × o maior lado.
 */
export function gradientCoords(spec: GradientSpec, width: number, height: number): GradientCoords {
  const cx = width / 2, cy = height / 2;
  if (spec.kind === 'radial') return { x1: cx, y1: cy, x2: cx, y2: cy, r1: 0, r2: round(Math.max(width, height) * 0.7) };
  const a = (normalizeAngle(spec.angle) * Math.PI) / 180;
  const cos = Math.cos(a), sin = Math.sin(a);
  const half = (Math.abs(cos) * width + Math.abs(sin) * height) / 2;
  return { x1: round(cx - cos * half), y1: round(cy - sin * half), x2: round(cx + cos * half), y2: round(cy + sin * half) };
}

export function normalizeAngle(a: number): number {
  const n = ((Math.round(a) % 360) + 360) % 360;
  return n;
}

/** Paradas ordenadas, offsets presos em 0..1, entre 2 e 5. */
export function normalizeSpec(spec: GradientSpec): GradientSpec {
  const stops = spec.stops
    .slice(0, MAX_STOPS)
    .map((s) => ({ offset: Math.min(1, Math.max(0, s.offset)), color: s.color }))
    .sort((a, b) => a.offset - b.offset);
  while (stops.length < MIN_STOPS) stops.push({ offset: 1, color: stops[stops.length - 1]?.color ?? '#000000' });
  return { kind: spec.kind, angle: normalizeAngle(spec.angle), stops };
}

export function buildFabricGradient(spec: GradientSpec, width: number, height: number): Gradient<'linear'> | Gradient<'radial'> {
  const s = normalizeSpec(spec);
  return new Gradient({
    type: s.kind,
    gradientUnits: 'pixels',
    coords: gradientCoords(s, width, height),
    colorStops: s.stops.map((st) => ({ offset: st.offset, color: st.color })),
  }) as Gradient<'linear'> | Gradient<'radial'>;
}

/** Paradas igualmente espaçadas a partir de uma lista de cores. */
export function evenStops(colors: string[]): GradientStop[] {
  return colors.map((color, i) => ({ offset: colors.length === 1 ? 0 : round(i / (colors.length - 1)), color }));
}

/** ⇄ Inverter: as cores trocam de ponta (offset espelhado). */
export function reverseStops(spec: GradientSpec): GradientSpec {
  return { ...spec, stops: spec.stops.map((s) => ({ offset: round(1 - s.offset), color: s.color })).sort((a, b) => a.offset - b.offset) };
}

/** + Cor: nova parada no meio do maior vão, com a cor da parada da esquerda. No máximo 5. */
export function addStop(spec: GradientSpec): GradientSpec {
  const stops = normalizeSpec(spec).stops;
  if (stops.length >= MAX_STOPS) return { ...spec, stops };
  let gap = 0, at = 0;
  for (let i = 0; i < stops.length - 1; i++) {
    const g = stops[i + 1].offset - stops[i].offset;
    if (g > gap) { gap = g; at = i; }
  }
  const s = { offset: round(stops[at].offset + gap / 2), color: stops[at].color };
  return { ...spec, stops: [...stops.slice(0, at + 1), s, ...stops.slice(at + 1)] };
}

/** Remove a parada `index` (no mínimo 2 ficam). */
export function removeStop(spec: GradientSpec, index: number): GradientSpec {
  if (spec.stops.length <= MIN_STOPS) return spec;
  return { ...spec, stops: spec.stops.filter((_, i) => i !== index) };
}

/** Prévia no CSS (o 0° do CSS aponta para cima; o nosso, para a direita). */
export function gradientCss(spec: GradientSpec): string {
  const s = normalizeSpec(spec);
  const stops = s.stops.map((st) => `${st.color} ${Math.round(st.offset * 100)}%`).join(', ');
  return s.kind === 'radial' ? `radial-gradient(circle, ${stops})` : `linear-gradient(${(s.angle + 90) % 360}deg, ${stops})`;
}

export function isGradientSpec(v: unknown): v is GradientSpec {
  if (!v || typeof v !== 'object') return false;
  const s = v as GradientSpec;
  return (s.kind === 'linear' || s.kind === 'radial') && typeof s.angle === 'number' && Array.isArray(s.stops)
    && s.stops.every((st) => typeof st?.offset === 'number' && typeof st?.color === 'string');
}

export interface GradientPreset { name: string; spec: GradientSpec }

export const GRADIENT_PRESETS: GradientPreset[] = [
  { name: 'Ouro Metálico', spec: { kind: 'linear', angle: 45, stops: evenStops(['#bf953f', '#fcf6ba', '#b38728']) } },
  { name: 'Oferta Fogo', spec: { kind: 'linear', angle: 0, stops: evenStops(['#ff416c', '#ff4b2b']) } },
  { name: 'Neon Cyber', spec: { kind: 'linear', angle: 315, stops: evenStops(['#00f5ff', '#7b2ff7', '#ff00c8']) } },
  { name: 'Preto Luxo', spec: { kind: 'linear', angle: 90, stops: evenStops(['#0f0f0f', '#434343', '#0f0f0f']) } },
];

/** Degradê da Marca: primária → destaque (ou secundária). `null` se o kit não tiver duas cores. */
export function brandGradient(colors: { primary?: string; secondary?: string; accent?: string }): GradientPreset | null {
  const a = colors.primary, b = colors.accent ?? colors.secondary;
  if (!a || !b) return null;
  return { name: 'Degradê da Marca', spec: { kind: 'linear', angle: 45, stops: evenStops([a, b]) } };
}

/** Caixa local usada pelo degradê de um objeto (Line não tem preenchimento). */
export function gradientBox(o: { width: number; height: number }): { width: number; height: number } {
  return { width: Math.max(1, o.width), height: Math.max(1, o.height) };
}
