/**
 * Linhas, setas e cotas paramétricas (TASK-12). Geometria pura em SVG path: o editor monta um Group de Paths (a linha só
 * com contorno; cada ponta preenchida ou contornada) e grava o `ConnectorSpec` no Group para refazê-lo.
 */

export type CapStyle = 'none' | 'arrow' | 'open-arrow' | 'dot' | 'ring' | 'diamond' | 'bar';
export type ConnectorShape = 'straight' | 'elbow' | 'curve';
export type DashStyle = 'solid' | 'dashed' | 'dotted';

export interface ConnectorSpec {
  /** Pontos em coordenadas locais (o Group guarda posição, escala e rotação). */
  x1: number; y1: number; x2: number; y2: number;
  shape: ConnectorShape;
  startCap: CapStyle;
  endCap: CapStyle;
  color: string;
  width: number;
  dash: DashStyle;
  /** Curva: deslocamento do ponto de controle, em frações do comprimento, à esquerda do sentido início → fim. */
  bend?: number;
}

export const CAP_OPTIONS: [CapStyle, string][] = [
  ['none', 'Nenhuma'], ['arrow', '▶ Seta'], ['open-arrow', '> Seta aberta'], ['dot', '● Ponto'], ['ring', '◉ Pino'],
  ['diamond', '◆ Losango'], ['bar', '| Barra (cota)'],
];
export const SHAPE_OPTIONS: [ConnectorShape, string][] = [['straight', 'Reta'], ['elbow', 'Cotovelo'], ['curve', 'Curva']];
export const DASH_OPTIONS: [DashStyle, string][] = [['solid', 'Sólida'], ['dashed', 'Tracejada (cupom)'], ['dotted', 'Pontilhada']];

/** Traço/espaço do contorno: tracejado 3w/2w, pontilhado w/2w (com ponta redonda); sólido = sem tracejado. */
export function dashArrayFor(style: DashStyle, strokeWidth: number): number[] | null {
  const w = Math.max(1, strokeWidth);
  if (style === 'dashed') return [w * 3, w * 2];
  if (style === 'dotted') return [w, w * 2];
  return null;
}

export function isDashStyle(v: unknown): v is DashStyle {
  return v === 'solid' || v === 'dashed' || v === 'dotted';
}

export function isConnectorSpec(v: unknown): v is ConnectorSpec {
  if (!v || typeof v !== 'object') return false;
  const s = v as ConnectorSpec;
  return ['x1', 'y1', 'x2', 'y2', 'width'].every((k) => typeof (s as unknown as Record<string, unknown>)[k] === 'number')
    && typeof s.color === 'string' && typeof s.shape === 'string';
}

interface Vec { x: number; y: number }
export interface ConnectorCap { d: string; filled: boolean }
export interface ConnectorGeometry {
  line: string;
  caps: ConnectorCap[];
  /** Direção unitária (para fora) em cada ponta. */
  startDir: Vec;
  endDir: Vec;
}

const r2 = (v: number) => Math.round(v * 100) / 100;
const pt = (p: Vec) => `${r2(p.x)} ${r2(p.y)}`;
const add = (a: Vec, b: Vec, k = 1): Vec => ({ x: a.x + b.x * k, y: a.y + b.y * k });
function unit(v: Vec): Vec {
  const l = Math.hypot(v.x, v.y);
  return l < 1e-9 ? { x: 1, y: 0 } : { x: v.x / l || 0, y: v.y / l || 0 }; // sem -0
}

/** Tamanho das pontas para uma espessura de linha. */
export function capSize(width: number): number {
  return Math.max(10, width * 3.5);
}

/** Recuo da linha sob a ponta (a seta preenchida cobre a ponta; sem o recuo a linha grossa vazaria pela ponta). */
function capInset(cap: CapStyle, s: number): number {
  return cap === 'arrow' ? s * 0.6 : 0;
}

function circlePath(c: Vec, r: number): string {
  return `M ${r2(c.x - r)} ${r2(c.y)} A ${r2(r)} ${r2(r)} 0 1 0 ${r2(c.x + r)} ${r2(c.y)} A ${r2(r)} ${r2(r)} 0 1 0 ${r2(c.x - r)} ${r2(c.y)} Z`;
}

/** A ponta em `p`, apontando para `u` (unitário, para fora da linha). */
export function capPaths(cap: CapStyle, p: Vec, u: Vec, s: number): ConnectorCap[] {
  const n = { x: -u.y, y: u.x };
  switch (cap) {
    case 'none': return [];
    case 'arrow': {
      const b = add(p, u, -s);
      return [{ d: `M ${pt(p)} L ${pt(add(b, n, s * 0.6))} L ${pt(add(b, n, -s * 0.6))} Z`, filled: true }];
    }
    case 'open-arrow': {
      const b = add(p, u, -s);
      return [{ d: `M ${pt(add(b, n, s * 0.6))} L ${pt(p)} L ${pt(add(b, n, -s * 0.6))}`, filled: false }];
    }
    case 'dot': return [{ d: circlePath(p, s * 0.5), filled: true }];
    case 'ring': return [{ d: circlePath(p, s * 0.4), filled: true }, { d: circlePath(p, s * 0.85), filled: false }];
    case 'diamond':
      return [{ d: `M ${pt(add(p, u, s * 0.6))} L ${pt(add(p, n, s * 0.4))} L ${pt(add(p, u, -s * 0.6))} L ${pt(add(p, n, -s * 0.4))} Z`, filled: true }];
    case 'bar': return [{ d: `M ${pt(add(p, n, s * 0.7))} L ${pt(add(p, n, -s * 0.7))}`, filled: false }];
  }
}

export function connectorGeometry(spec: ConnectorSpec): ConnectorGeometry {
  const a: Vec = { x: spec.x1, y: spec.y1 };
  const b: Vec = { x: spec.x2, y: spec.y2 };
  const s = capSize(spec.width);
  let startDir: Vec, endDir: Vec, line: string;
  const shape = spec.shape === 'elbow' && (Math.abs(a.x - b.x) < 1e-6 || Math.abs(a.y - b.y) < 1e-6) ? 'straight' : spec.shape;
  if (shape === 'elbow') {
    // horizontal a partir do início, depois vertical até o fim
    const corner = { x: b.x, y: a.y };
    startDir = unit({ x: a.x - corner.x, y: 0 });
    endDir = unit({ x: 0, y: b.y - corner.y });
    const a2 = add(a, startDir, -capInset(spec.startCap, s));
    const b2 = add(b, endDir, -capInset(spec.endCap, s));
    line = `M ${pt(a2)} L ${pt(corner)} L ${pt(b2)}`;
  } else if (shape === 'curve') {
    const d = { x: b.x - a.x, y: b.y - a.y };
    const len = Math.hypot(d.x, d.y);
    const bend = spec.bend ?? 0.35;
    // "à esquerda" no canvas (y para baixo): normal (d.y, -d.x)
    const c = add({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, unit({ x: d.y, y: -d.x }), bend * len);
    startDir = unit({ x: a.x - c.x, y: a.y - c.y });
    endDir = unit({ x: b.x - c.x, y: b.y - c.y });
    const a2 = add(a, startDir, -capInset(spec.startCap, s));
    const b2 = add(b, endDir, -capInset(spec.endCap, s));
    line = `M ${pt(a2)} Q ${pt(c)} ${pt(b2)}`;
  } else {
    endDir = unit({ x: b.x - a.x, y: b.y - a.y });
    startDir = { x: -endDir.x || 0, y: -endDir.y || 0 };
    const a2 = add(a, startDir, -capInset(spec.startCap, s));
    const b2 = add(b, endDir, -capInset(spec.endCap, s));
    line = `M ${pt(a2)} L ${pt(b2)}`;
  }
  return { line, caps: [...capPaths(spec.startCap, a, startDir, s), ...capPaths(spec.endCap, b, endDir, s)], startDir, endDir };
}

/** Troca as pontas de lado (⇄). */
export function swapEnds(spec: ConnectorSpec): ConnectorSpec {
  return { ...spec, startCap: spec.endCap, endCap: spec.startCap };
}
