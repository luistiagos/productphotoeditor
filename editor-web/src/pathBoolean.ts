// Pathfinder (TASK-16): operações booleanas entre formas do editor — implementação própria, TypeScript puro.
//
// 1. Cada forma vira anéis de polígono em coordenadas de PÁGINA (matriz do Fabric, curvas achatadas ≤ 0,25 px).
// 2. Arranjo planar: todas as arestas de todos os operandos são cortadas nos cruzamentos, nas junções em T e nos
//    trechos colineares sobrepostos; sub-arestas iguais (aresta comum entre duas formas) viram uma só.
// 3. Cada sub-aresta é testada dentro/fora de cada operando logo à esquerda e logo à direita do meio dela: é borda do
//    resultado quando a operação dá valores diferentes nos dois lados, orientada com o interior à esquerda.
// 4. As bordas se encadeiam em anéis. Com `fillRule: 'evenodd'` o preenchimento só depende do conjunto de arestas (não
//    de como elas se encadeiam): vértice e aresta coincidentes, formas contidas e furos não precisam de caso especial.
//
// Sem valor importado do `fabric` (só tipos): o vitest usa `fabric/node` e `instanceof` entre os dois builds não vale;
// o tipo da forma vem de `obj.type` e a matriz é aplicada aqui.
import type { FabricObject } from 'fabric';

export interface Pt { x: number; y: number }
export type Ring = Pt[];
export type BooleanOp = 'union' | 'subtract' | 'intersect' | 'exclude';
export type FillRule = 'nonzero' | 'evenodd';
/** Região preenchida de uma forma: anéis + regra de preenchimento dela. */
export interface ShapeRegion { rings: Ring[]; fillRule: FillRule }

export const BOOLEAN_OPS: BooleanOp[] = ['union', 'subtract', 'intersect', 'exclude'];
/** Erro máximo (px de página) entre a curva e o polígono que a substitui. O doc pede ≤ 0,5 px. */
export const FLATTEN_TOLERANCE = 0.25;
/** Resultado com área menor que isto (px²) conta como vazio. */
export const MIN_RESULT_AREA = 0.5;

/** `[a, b, c, d, e, f]` do Fabric: x' = a·x + c·y + e, y' = b·x + d·y + f. */
type Mat = readonly number[];
/** Mesmo valor da constante `kRect` do Fabric 7.4.0 (`constants.ts`), usada no canto arredondado do `Rect._render`. */
const K_RECT = 1 - 0.5522847498;
const SHAPE_TYPES = new Set(['rect', 'circle', 'ellipse', 'triangle', 'polygon', 'path']);
const MAX_ARC_SEGMENTS = 2048;
const MAX_BEZIER_DEPTH = 18;

const apply = (m: Mat, x: number, y: number): Pt => ({ x: m[0] * x + m[2] * y + m[4], y: m[1] * x + m[3] * y + m[5] });

/** Maior fator de escala da parte linear da matriz (maior valor singular). */
function maxScale(m: Mat): number {
  const t = m[0] * m[0] + m[1] * m[1] + m[2] * m[2] + m[3] * m[3];
  const det = m[0] * m[3] - m[1] * m[2];
  return Math.sqrt(Math.max(0, (t + Math.sqrt(Math.max(0, t * t - 4 * det * det))) / 2));
}

/** Tipo do Fabric que o Pathfinder sabe converter (polígono fechado). `polyline` é aberto: fica de fora. */
export function isBooleanShapeType(o: { type?: unknown } | undefined | null): boolean {
  return Boolean(o) && SHAPE_TYPES.has(String(o!.type).toLowerCase());
}

// ---------- achatamento ----------

function distToLine(p: Pt, a: Pt, b: Pt): number {
  const dx = b.x - a.x, dy = b.y - a.y;
  const len = Math.hypot(dx, dy);
  if (len < 1e-12) return Math.hypot(p.x - a.x, p.y - a.y);
  return Math.abs((p.x - a.x) * dy - (p.y - a.y) * dx) / len;
}

/** Cúbica p0..p3 (página) em segmentos: a curva fica no fecho convexo, então controle a ≤ tol da corda = erro ≤ tol. */
function flattenCubic(p0: Pt, p1: Pt, p2: Pt, p3: Pt, tol: number, out: Pt[], depth = 0): void {
  if (depth >= MAX_BEZIER_DEPTH || Math.max(distToLine(p1, p0, p3), distToLine(p2, p0, p3)) <= tol) {
    out.push(p3);
    return;
  }
  const mid = (a: Pt, b: Pt): Pt => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
  const p01 = mid(p0, p1), p12 = mid(p1, p2), p23 = mid(p2, p3);
  const p012 = mid(p01, p12), p123 = mid(p12, p23), m = mid(p012, p123);
  flattenCubic(p0, p01, p012, m, tol, out, depth + 1);
  flattenCubic(m, p123, p23, p3, tol, out, depth + 1);
}

/** Arco de elipse local (centro 0,0, raios rx/ry, ângulos em radianos) levado à página e achatado. */
function arcPoints(m: Mat, rx: number, ry: number, start: number, sweep: number, tol: number, closed: boolean): Pt[] {
  const r = Math.max(rx, ry) * maxScale(m);
  if (!(r > 0) || sweep === 0) return [];
  const step = r <= tol ? Math.PI / 2 : 2 * Math.acos(1 - tol / r);
  const n = Math.min(MAX_ARC_SEGMENTS, Math.max(closed ? 8 : 2, Math.ceil(Math.abs(sweep) / step)));
  const pts: Pt[] = [];
  const count = closed ? n : n + 1;
  for (let i = 0; i < count; i++) {
    const a = start + (sweep * i) / n;
    pts.push(apply(m, rx * Math.cos(a), ry * Math.sin(a)));
  }
  return pts;
}

/** Varredura do `ctx.arc` (spec do canvas): ≥ 2π no sentido pedido = círculo inteiro. */
function canvasArcSweep(start: number, end: number, ccw: boolean): number {
  const TAU = Math.PI * 2;
  if (!ccw && end - start >= TAU) return TAU;
  if (ccw && start - end >= TAU) return -TAU;
  const mod = (v: number) => ((v % TAU) + TAU) % TAU;
  return ccw ? -mod(start - end) : mod(end - start);
}

type Cmd = (string | number)[];

/** Comandos absolutos M/L/C/Q/Z (o `makePathSimpler` do Fabric já tirou H/V/S/T/A) → anéis em página. */
function commandsToRings(cmds: Cmd[], m: Mat, ox: number, oy: number, tol: number): Ring[] {
  const rings: Ring[] = [];
  let cur: Pt[] = [];
  let last: Pt = { x: 0, y: 0 }; // local, já sem o offset
  let start: Pt = last;
  const flush = () => { if (cur.length >= 3) rings.push(cur); cur = []; };
  const P = (x: number, y: number): Pt => ({ x: x - ox, y: y - oy });
  for (const c of cmds) {
    const k = String(c[0]).toUpperCase();
    const n = c.slice(1).map(Number);
    if (k === 'M') {
      flush();
      last = start = P(n[0], n[1]);
      cur.push(apply(m, last.x, last.y));
    } else if (k === 'L') {
      if (cur.length === 0) cur.push(apply(m, last.x, last.y)); // depois de um Z o subcaminho recomeça no início
      last = P(n[0], n[1]);
      cur.push(apply(m, last.x, last.y));
    } else if (k === 'C' || k === 'Q') {
      if (cur.length === 0) cur.push(apply(m, last.x, last.y));
      let c1: Pt, c2: Pt;
      const end = k === 'C' ? P(n[4], n[5]) : P(n[2], n[3]);
      if (k === 'C') { c1 = P(n[0], n[1]); c2 = P(n[2], n[3]); } else {
        const q = P(n[0], n[1]); // quadrática → cúbica exata
        c1 = { x: last.x + (2 / 3) * (q.x - last.x), y: last.y + (2 / 3) * (q.y - last.y) };
        c2 = { x: end.x + (2 / 3) * (q.x - end.x), y: end.y + (2 / 3) * (q.y - end.y) };
      }
      flattenCubic(apply(m, last.x, last.y), apply(m, c1.x, c1.y), apply(m, c2.x, c2.y), apply(m, end.x, end.y), tol, cur);
      last = end;
    } else if (k === 'Z') {
      flush();
      last = start;
    } else if (n.length >= 2 && n.every(Number.isFinite)) {
      // comando inesperado: vai em linha reta até o último ponto dele (defensivo)
      last = P(n[n.length - 2], n[n.length - 1]);
      cur.push(apply(m, last.x, last.y));
    }
  }
  flush();
  return rings;
}

interface ShapeLike {
  type?: unknown; width?: number; height?: number; rx?: number; ry?: number; radius?: number;
  startAngle?: number; endAngle?: number; counterClockwise?: boolean;
  points?: Pt[]; path?: Cmd[]; pathOffset?: Pt; fillRule?: unknown;
  calcTransformMatrix(): Mat;
}

/**
 * Anéis do PREENCHIMENTO da forma em coordenadas de página (matriz completa: inclusive a da `ActiveSelection` em que
 * ela estiver). `Rect`/`Circle`/`Ellipse`/`Triangle` são centrados em (0,0) local; `Polygon`/`Path` têm os pontos
 * relativos a `pathOffset`. Tipo não suportado = `[]`.
 */
export function shapeToPolygonRings(obj: FabricObject | ShapeLike, tol = FLATTEN_TOLERANCE): Ring[] {
  const o = obj as unknown as ShapeLike;
  const type = String(o.type).toLowerCase();
  if (!SHAPE_TYPES.has(type)) return [];
  const m = o.calcTransformMatrix();
  const w = o.width ?? 0, h = o.height ?? 0;
  const ring = (pts: Pt[]): Ring[] => (pts.length >= 3 ? [pts] : []);
  switch (type) {
    case 'rect': {
      const x = -w / 2, y = -h / 2;
      const rx = o.rx ? Math.min(o.rx, w / 2) : 0;
      const ry = o.ry ? Math.min(o.ry, h / 2) : 0;
      if (rx === 0 && ry === 0) return ring([apply(m, x, y), apply(m, x + w, y), apply(m, x + w, y + h), apply(m, x, y + h)]);
      // o mesmo traçado do Rect._render do Fabric (linhas + cúbicas com kRect)
      const k = K_RECT;
      return commandsToRings([
        ['M', x + rx, y], ['L', x + w - rx, y], ['C', x + w - k * rx, y, x + w, y + k * ry, x + w, y + ry],
        ['L', x + w, y + h - ry], ['C', x + w, y + h - k * ry, x + w - k * rx, y + h, x + w - rx, y + h],
        ['L', x + rx, y + h], ['C', x + k * rx, y + h, x, y + h - k * ry, x, y + h - ry],
        ['L', x, y + ry], ['C', x, y + k * ry, x + k * rx, y, x + rx, y], ['Z'],
      ], m, 0, 0, tol);
    }
    case 'circle': {
      const r = o.radius ?? 0;
      const deg = Math.PI / 180;
      const sweep = canvasArcSweep((o.startAngle ?? 0) * deg, (o.endAngle ?? 360) * deg, Boolean(o.counterClockwise));
      const full = Math.abs(sweep) >= Math.PI * 2;
      // arco parcial: o preenchimento fecha com a corda (como o canvas)
      return ring(arcPoints(m, r, r, (o.startAngle ?? 0) * deg, sweep, tol, full));
    }
    case 'ellipse':
      return ring(arcPoints(m, o.rx ?? 0, o.ry ?? 0, 0, Math.PI * 2, tol, true));
    case 'triangle':
      return ring([apply(m, -w / 2, h / 2), apply(m, 0, -h / 2), apply(m, w / 2, h / 2)]);
    case 'polygon': {
      const off = o.pathOffset ?? { x: 0, y: 0 };
      return ring((o.points ?? []).map((p) => apply(m, p.x - off.x, p.y - off.y)));
    }
    case 'path': {
      const off = o.pathOffset ?? { x: 0, y: 0 };
      return commandsToRings(o.path ?? [], m, off.x, off.y, tol);
    }
  }
  return [];
}

/** Anéis + regra de preenchimento da forma (o `Path` resultante usa `evenodd`; as formas do editor, `nonzero`). */
export function shapeRegion(obj: FabricObject, tol = FLATTEN_TOLERANCE): ShapeRegion {
  return { rings: shapeToPolygonRings(obj, tol), fillRule: (obj as { fillRule?: unknown }).fillRule === 'evenodd' ? 'evenodd' : 'nonzero' };
}

// ---------- operação booleana ----------

/** Número de voltas de `rings` em torno de `p` (cruzamento por semirreta horizontal). */
function windingAt(rings: Ring[], p: Pt): number {
  let w = 0;
  for (const r of rings) {
    for (let i = 0, n = r.length; i < n; i++) {
      const a = r[i], b = r[(i + 1) % n];
      const side = (b.x - a.x) * (p.y - a.y) - (p.x - a.x) * (b.y - a.y);
      if (a.y <= p.y) { if (b.y > p.y && side > 0) w++; } else if (b.y <= p.y && side < 0) w--;
    }
  }
  return w;
}

function insideRegion(reg: ShapeRegion, p: Pt): boolean {
  const w = windingAt(reg.rings, p);
  return reg.fillRule === 'evenodd' ? (w & 1) !== 0 : w !== 0;
}

function combine(op: BooleanOp, inside: boolean[]): boolean {
  switch (op) {
    case 'union': return inside.some(Boolean);
    case 'intersect': return inside.length > 0 && inside.every(Boolean);
    case 'subtract': return inside[0] === true && !inside.slice(1).some(Boolean);
    case 'exclude': return inside.filter(Boolean).length % 2 === 1;
  }
}

interface Seg { a: Pt; b: Pt; minX: number; maxX: number; minY: number; maxY: number; splits: { t: number; p: Pt }[] }

/** Vértices fundidos por distância ≤ eps (grade de hash com as 9 células vizinhas). */
class VertexPool {
  readonly pts: Pt[] = [];
  private readonly grid = new Map<string, number[]>();
  constructor(private readonly eps: number) {}
  id(p: Pt): number {
    const cx = Math.floor(p.x / this.eps), cy = Math.floor(p.y / this.eps);
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        for (const i of this.grid.get(`${cx + dx},${cy + dy}`) ?? []) {
          const q = this.pts[i];
          if (Math.abs(q.x - p.x) <= this.eps && Math.abs(q.y - p.y) <= this.eps) return i;
        }
      }
    }
    const i = this.pts.push({ x: p.x, y: p.y }) - 1;
    const key = `${cx},${cy}`;
    const cell = this.grid.get(key);
    if (cell) cell.push(i); else this.grid.set(key, [i]);
    return i;
  }
}

/** Parâmetro de `p` projetado no segmento e a distância dele ao segmento. */
function project(s: Seg, p: Pt): { t: number; d: number } {
  const dx = s.b.x - s.a.x, dy = s.b.y - s.a.y;
  const l2 = dx * dx + dy * dy;
  const t = ((p.x - s.a.x) * dx + (p.y - s.a.y) * dy) / l2;
  const cx = s.a.x + t * dx, cy = s.a.y + t * dy;
  return { t, d: Math.hypot(p.x - cx, p.y - cy) };
}

/** Corta `s` e `r` um no outro: cruzamento próprio, ponta de um sobre o outro (junção T, trecho colinear). */
function splitPair(s: Seg, r: Seg, eps: number): void {
  const ls = Math.hypot(s.b.x - s.a.x, s.b.y - s.a.y), lr = Math.hypot(r.b.x - r.a.x, r.b.y - r.a.y);
  const ts = eps / ls, tr = eps / lr;
  let touched = false;
  for (const [seg, other, tEps] of [[s, r, ts], [r, s, tr]] as const) {
    for (const p of [other.a, other.b]) {
      const { t, d } = project(seg, p);
      if (d <= eps && t > tEps && t < 1 - tEps) { seg.splits.push({ t, p }); touched = true; }
      else if (d <= eps && (t >= -tEps && t <= 1 + tEps)) touched = true; // ponta com ponta: a fusão de vértices cuida
    }
  }
  if (touched) return;
  const dx = s.b.x - s.a.x, dy = s.b.y - s.a.y, ex = r.b.x - r.a.x, ey = r.b.y - r.a.y;
  const den = dx * ey - dy * ex;
  if (Math.abs(den) <= 1e-12 * ls * lr) return; // paralelos sem contato
  const fx = r.a.x - s.a.x, fy = r.a.y - s.a.y;
  const t = (fx * ey - fy * ex) / den, u = (fx * dy - fy * dx) / den;
  if (t > ts && t < 1 - ts && u > tr && u < 1 - tr) {
    const p = { x: s.a.x + t * dx, y: s.a.y + t * dy };
    s.splits.push({ t, p });
    r.splits.push({ t: u, p });
  }
}

/**
 * Operação booleana entre N regiões (a ordem importa só no `subtract`: a 1ª menos as demais). Devolve anéis orientados
 * com o interior à esquerda (externos com área positiva, furos negativa), para `fillRule: 'evenodd'` ou `'nonzero'`.
 * Resultado vazio = `[]`.
 */
export function booleanRegions(regions: ShapeRegion[], op: BooleanOp): Ring[] {
  const segs: Seg[] = [];
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const reg of regions) {
    for (const ring of reg.rings) {
      for (let i = 0, n = ring.length; i < n; i++) {
        const a = ring[i], b = ring[(i + 1) % n];
        if (!Number.isFinite(a.x) || !Number.isFinite(a.y) || !Number.isFinite(b.x) || !Number.isFinite(b.y)) continue;
        minX = Math.min(minX, a.x); maxX = Math.max(maxX, a.x); minY = Math.min(minY, a.y); maxY = Math.max(maxY, a.y);
        if (a.x === b.x && a.y === b.y) continue;
        segs.push({ a, b, minX: Math.min(a.x, b.x), maxX: Math.max(a.x, b.x), minY: Math.min(a.y, b.y), maxY: Math.max(a.y, b.y), splits: [] });
      }
    }
  }
  if (segs.length === 0) return [];
  const extent = Math.max(maxX - minX, maxY - minY, Math.abs(minX), Math.abs(maxX), Math.abs(minY), Math.abs(maxY), 1);
  const eps = extent * 1e-9;
  // varredura em x: só pares cujas caixas se tocam
  const order = segs.slice().sort((p, q) => p.minX - q.minX);
  for (let i = 0; i < order.length; i++) {
    const s = order[i];
    for (let j = i + 1; j < order.length && order[j].minX <= s.maxX + eps; j++) {
      const r = order[j];
      if (r.minY > s.maxY + eps || r.maxY < s.minY - eps) continue;
      splitPair(s, r, eps);
    }
  }
  // sub-arestas com vértices fundidos; aresta repetida (comum a duas formas) fica uma só
  const pool = new VertexPool(eps);
  const edges = new Map<string, [number, number]>();
  for (const s of segs) {
    const ids = [pool.id(s.a), ...s.splits.sort((p, q) => p.t - q.t).map((x) => pool.id(x.p)), pool.id(s.b)];
    for (let i = 0; i + 1 < ids.length; i++) {
      const u = ids[i], v = ids[i + 1];
      if (u === v) continue;
      const key = u < v ? `${u}_${v}` : `${v}_${u}`;
      if (!edges.has(key)) edges.set(key, [u, v]);
    }
  }
  // classificação: dentro/fora logo à esquerda e à direita do meio de cada sub-aresta
  const P = pool.pts;
  const directed: [number, number][] = [];
  for (const [u, v] of edges.values()) {
    const a = P[u], b = P[v];
    const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy);
    const delta = Math.max(eps * 10, Math.min(len * 1e-4, 1e-3));
    const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2, nx = (-dy / len) * delta, ny = (dx / len) * delta;
    const left = combine(op, regions.map((reg) => insideRegion(reg, { x: mx + nx, y: my + ny })));
    const right = combine(op, regions.map((reg) => insideRegion(reg, { x: mx - nx, y: my - ny })));
    if (left === right) continue;
    directed.push(left ? [u, v] : [v, u]);
  }
  return chainRings(directed, P);
}

/** Encadeia as arestas orientadas em anéis; em cada vértice segue a curva mais à esquerda (o anel fica simples). */
function chainRings(directed: [number, number][], P: Pt[]): Ring[] {
  const out = new Map<number, number[]>();
  directed.forEach(([u], i) => { const l = out.get(u); if (l) l.push(i); else out.set(u, [i]); });
  const used = new Array<boolean>(directed.length).fill(false);
  const rings: Ring[] = [];
  const TAU = Math.PI * 2;
  for (let e0 = 0; e0 < directed.length; e0++) {
    if (used[e0]) continue;
    const startV = directed[e0][0];
    const ids: number[] = [startV];
    let e = e0;
    for (let guard = 0; guard <= directed.length; guard++) {
      used[e] = true;
      const [u, v] = directed[e];
      if (v === startV) break;
      ids.push(v);
      const cand = (out.get(v) ?? []).filter((i) => !used[i]);
      if (cand.length === 0) break; // não deveria acontecer (graus equilibrados); fecha o anel assim mesmo
      const back = Math.atan2(P[u].y - P[v].y, P[u].x - P[v].x);
      let best = cand[0], bestCw = Infinity;
      for (const i of cand) {
        const w = directed[i][1];
        let cw = (back - Math.atan2(P[w].y - P[v].y, P[w].x - P[v].x)) % TAU;
        if (cw <= 1e-12) cw += TAU;
        if (cw < bestCw) { bestCw = cw; best = i; }
      }
      e = best;
    }
    const ring = simplifyRing(ids.map((i) => P[i]));
    if (ring.length >= 3) rings.push(ring);
  }
  return rings;
}

/** Tira vértices colineares (pontos de corte que sobraram no meio de uma reta). */
function simplifyRing(r: Pt[]): Pt[] {
  let pts = r;
  for (let changed = true; changed && pts.length > 3;) {
    changed = false;
    const keep: Pt[] = [];
    for (let i = 0, n = pts.length; i < n; i++) {
      const a = keep.length ? keep[keep.length - 1] : pts[(i - 1 + n) % n], p = pts[i], b = pts[(i + 1) % n];
      const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy);
      const dot = (p.x - a.x) * dx + (p.y - a.y) * dy;
      if (len > 0 && Math.abs((p.x - a.x) * dy - (p.y - a.y) * dx) / len <= 1e-7 * Math.max(1, len) && dot > 0 && dot < len * len) {
        changed = true;
        continue;
      }
      keep.push(p);
    }
    pts = keep;
  }
  return pts;
}

/** Par de formas: `subtract` = a − b. */
export function booleanOp(a: ShapeRegion | Ring[], b: ShapeRegion | Ring[], op: BooleanOp): Ring[] {
  const reg = (x: ShapeRegion | Ring[]): ShapeRegion => (Array.isArray(x) ? { rings: x, fillRule: 'nonzero' } : x);
  return booleanRegions([reg(a), reg(b)], op);
}

// ---------- saída ----------

/** Área com sinal (positiva no sentido da esquerda: x→y). */
export function signedRingArea(r: Ring): number {
  let s = 0;
  for (let i = 0, n = r.length; i < n; i++) { const a = r[i], b = r[(i + 1) % n]; s += a.x * b.y - b.x * a.y; }
  return s / 2;
}

/** Área de anéis orientados como os que `booleanRegions` devolve (furos descontam). */
export function ringsArea(rings: Ring[]): number {
  return Math.abs(rings.reduce((s, r) => s + signedRingArea(r), 0));
}

/** Caixa envolvente dos anéis (página). */
export function ringsBounds(rings: Ring[]): { left: number; top: number; width: number; height: number } | undefined {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const r of rings) for (const p of r) { minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x); minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y); }
  return minX === Infinity ? undefined : { left: minX, top: minY, width: maxX - minX, height: maxY - minY };
}

const num = (v: number) => String(Math.round(v * 1000) / 1000);

/** Anéis → `d` de SVG (`M … L … Z` por anel), para um `Path` com `fillRule: 'evenodd'`. */
export function ringsToPathD(rings: Ring[]): string {
  return rings
    .filter((r) => r.length >= 3)
    .map((r) => `M ${num(r[0].x)} ${num(r[0].y)} ` + r.slice(1).map((p) => `L ${num(p.x)} ${num(p.y)}`).join(' ') + ' Z')
    .join(' ');
}
