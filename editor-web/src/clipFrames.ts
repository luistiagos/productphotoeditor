// 🖼️ Molduras de recorte (TASK-06): foto dentro de uma forma (círculo, pílula, arco, estrela, coração…) com aro colorido
// que segue a forma e zoom/posição internos.
//
// Fonte da verdade = a spec nas propriedades próprias (`clipShape`, `clipScale`, `clipOffsetX/Y`, `frameStroke`,
// `frameStrokeWidth`); o `clipPath` do Fabric é regerado dela para a caixa atual sempre que as unidades locais mudam
// (Substituir, ações de IA, Recortar, lote). Guardar só o `clipPath` quebraria no upscale/troca: ele mora nas unidades
// locais da imagem, que `rescaledGeometry`/`fitSlot` mudam.
//
// Geometria: toda forma é gerada em px da página para a caixa `width·|scaleX| × height·|scaleY|`, centrada na origem, e
// TOCA os quatro lados da caixa (bbox da forma = caixa). O `Path` do Fabric põe `pathOffset` no centro da bbox — aqui 0 —,
// então o JSON puro (merge, sem Fabric) usa `left/top = 0`. O `clipPath` leva `scale = 1/|escala da imagem|`.
//
// Aro: desenhado DEPOIS do `drawObject` original (o `_drawClipPath` recortaria metade de um traço feito no `_render`),
// como traço de largura 2w recortado pela própria forma → aro interno de w px da página, dentro da caixa (cabe no cache
// e na caixa do export de vídeo). No SVG, o `<path>` do aro vai dentro do `<g clip-path>` da imagem: sai recortado igual.
// Sem import de runtime do Fabric: as classes chegam por parâmetro (o editor usa `fabric`, o vitest `fabric/node`).

import type { ImageGeometry } from './imageGeometry';

export const CLIP_SHAPE_KINDS = [
  'none', 'circle', 'rounded-sm', 'rounded-lg', 'pill', 'leaf-tr', 'leaf-tl', 'star', 'starburst-12', 'starburst-20',
  'hexagon', 'diamond', 'shield', 'arch', 'heart',
] as const;
export type ClipShapeKind = (typeof CLIP_SHAPE_KINDS)[number];

export const CLIP_SHAPE_LABELS: Record<ClipShapeKind, string> = {
  none: 'Sem moldura',
  circle: 'Círculo',
  'rounded-sm': 'Cantos suaves',
  'rounded-lg': 'Cantos redondos',
  pill: 'Pílula',
  'leaf-tr': 'Folha ↗',
  'leaf-tl': 'Folha ↖',
  star: 'Estrela',
  'starburst-12': 'Selo explosão',
  'starburst-20': 'Selo 20 pontas',
  hexagon: 'Hexágono',
  diamond: 'Losango',
  shield: 'Escudo',
  arch: 'Arco de vitrine',
  heart: 'Coração',
};

export const FRAME_ZOOM_MIN = 1;
export const FRAME_ZOOM_MAX = 3;
export const FRAME_STROKE_MAX = 40;
export const FRAME_DEFAULT_STROKE = '#ffffff';

/** Spec da moldura (sem campo `type`: o revive do Fabric transformaria o valor numa classe registrada). */
export interface FrameSpec {
  kind: Exclude<ClipShapeKind, 'none'>;
  /** Zoom interno, 1..3 (1 = a maior parte da foto que cabe na proporção da caixa). */
  scale: number;
  /** Posição interna, -1..1 da folga (−1 = borda esquerda/topo da foto, 0 = centro). */
  offsetX: number;
  offsetY: number;
  /** Cor do aro. */
  stroke: string;
  /** Espessura do aro, px da página (0 = sem aro). */
  strokeWidth: number;
}

export function isClipShapeKind(v: unknown): v is ClipShapeKind {
  return typeof v === 'string' && (CLIP_SHAPE_KINDS as readonly string[]).includes(v);
}

const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));
const finite = (v: unknown, d: number): number => (typeof v === 'number' && Number.isFinite(v) ? v : d);

interface FrameProps {
  clipShape?: unknown;
  clipScale?: unknown;
  clipOffsetX?: unknown;
  clipOffsetY?: unknown;
  frameStroke?: unknown;
  frameStrokeWidth?: unknown;
}

/** Lê a spec das propriedades próprias (objeto vivo ou JSON); `null` sem moldura. Valores fora da faixa são presos. */
export function frameSpecOf(o: object | null | undefined): FrameSpec | null {
  if (!o) return null;
  const read = (k: keyof FrameProps): unknown => {
    const getter = (o as { get?: (k: string) => unknown }).get;
    return typeof getter === 'function' ? getter.call(o, k) : (o as FrameProps)[k];
  };
  const kind = read('clipShape');
  if (!isClipShapeKind(kind) || kind === 'none') return null;
  const stroke = read('frameStroke');
  return {
    kind,
    scale: clamp(finite(read('clipScale'), 1), FRAME_ZOOM_MIN, FRAME_ZOOM_MAX),
    offsetX: clamp(finite(read('clipOffsetX'), 0), -1, 1),
    offsetY: clamp(finite(read('clipOffsetY'), 0), -1, 1),
    stroke: typeof stroke === 'string' && stroke ? stroke : FRAME_DEFAULT_STROKE,
    strokeWidth: clamp(finite(read('frameStrokeWidth'), 0), 0, FRAME_STROKE_MAX),
  };
}

/** Propriedades próprias da spec (o que vai no objeto); `null` limpa todas. */
export function frameProps(spec: FrameSpec | null): Record<keyof FrameProps, unknown> {
  return {
    clipShape: spec?.kind,
    clipScale: spec?.scale,
    clipOffsetX: spec?.offsetX,
    clipOffsetY: spec?.offsetY,
    frameStroke: spec?.stroke,
    frameStrokeWidth: spec?.strokeWidth,
  };
}

// ---------- geometria das formas ----------

export type PathCmd = ['M', number, number] | ['L', number, number] | ['C', number, number, number, number, number, number] | ['Z'];

/** Constante do arco de 90° por cúbica (erro radial < 0,03%). */
const K = 0.5522847498;

/** Retângulo com raio por canto [sup-esq, sup-dir, inf-dir, inf-esq], centrado. */
function roundedRect(W: number, H: number, radii: [number, number, number, number]): PathCmd[] {
  const m = Math.min(W, H) / 2;
  const [tl, tr, br, bl] = radii.map((r) => clamp(r, 0, m));
  const x0 = -W / 2, y0 = -H / 2, x1 = W / 2, y1 = H / 2;
  const out: PathCmd[] = [['M', x0 + tl, y0], ['L', x1 - tr, y0]];
  if (tr) out.push(['C', x1 - tr + K * tr, y0, x1, y0 + tr - K * tr, x1, y0 + tr]);
  out.push(['L', x1, y1 - br]);
  if (br) out.push(['C', x1, y1 - br + K * br, x1 - br + K * br, y1, x1 - br, y1]);
  out.push(['L', x0 + bl, y1]);
  if (bl) out.push(['C', x0 + bl - K * bl, y1, x0, y1 - bl + K * bl, x0, y1 - bl]);
  out.push(['L', x0, y0 + tl]);
  if (tl) out.push(['C', x0, y0 + tl - K * tl, x0 + tl - K * tl, y0, x0 + tl, y0]);
  out.push(['Z']);
  return out;
}

function ellipse(W: number, H: number): PathCmd[] {
  const rx = W / 2, ry = H / 2;
  return [
    ['M', 0, -ry],
    ['C', K * rx, -ry, rx, -K * ry, rx, 0],
    ['C', rx, K * ry, K * rx, ry, 0, ry],
    ['C', -K * rx, ry, -rx, K * ry, -rx, 0],
    ['C', -rx, -K * ry, -K * rx, -ry, 0, -ry],
    ['Z'],
  ];
}

/** Polígono dado em coordenadas quaisquer, esticado para a bbox ocupar a caixa inteira. */
function fitPolygon(pts: [number, number][], W: number, H: number): PathCmd[] {
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
  const sx = W / (maxX - minX || 1), sy = H / (maxY - minY || 1);
  const out: PathCmd[] = pts.map(([x, y], i) => [i ? 'L' : 'M', (x - minX) * sx - W / 2, (y - minY) * sy - H / 2]);
  out.push(['Z']);
  return out;
}

/** Estrela de `n` pontas (raio interno `inner` do externo), a primeira ponta para cima. */
function star(n: number, inner: number, W: number, H: number): PathCmd[] {
  const pts: [number, number][] = [];
  for (let i = 0; i < n * 2; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / n;
    const r = i % 2 ? inner : 1;
    pts.push([Math.cos(a) * r, Math.sin(a) * r]);
  }
  return fitPolygon(pts, W, H);
}

/** Caminho em coordenadas unitárias [0,1]² → caixa centrada. */
function unitPath(cmds: PathCmd[], W: number, H: number): PathCmd[] {
  const X = (x: number) => (x - 0.5) * W, Y = (y: number) => (y - 0.5) * H;
  return cmds.map((c): PathCmd => {
    switch (c[0]) {
      case 'M': case 'L': return [c[0], X(c[1]), Y(c[2])];
      case 'C': return ['C', X(c[1]), Y(c[2]), X(c[3]), Y(c[4]), X(c[5]), Y(c[6])];
      default: return ['Z'];
    }
  });
}

// Coração: lóbulos com tangente horizontal no topo (y=0), laterais com tangente vertical (x=0/1) e ponta embaixo; os
// pontos de controle ficam em [0,1]², então a bbox é a caixa (propriedade do fecho convexo da cúbica).
const HEART: PathCmd[] = [
  ['M', 0.5, 0.22],
  ['C', 0.5, 0.08, 0.39, 0, 0.25, 0],
  ['C', 0.25 - 0.25 * K, 0, 0, 0.3 - 0.3 * K, 0, 0.3],
  ['C', 0, 0.55, 0.3, 0.78, 0.5, 1],
  ['C', 0.7, 0.78, 1, 0.55, 1, 0.3],
  ['C', 1, 0.3 - 0.3 * K, 0.75 + 0.25 * K, 0, 0.75, 0],
  ['C', 0.61, 0, 0.5, 0.08, 0.5, 0.22],
  ['Z'],
];

const SHIELD: PathCmd[] = [
  ['M', 0, 0], ['L', 1, 0], ['L', 1, 0.45],
  ['C', 1, 0.75, 0.75, 0.9, 0.5, 1],
  ['C', 0.25, 0.9, 0, 0.75, 0, 0.45],
  ['Z'],
];

/** Arco de vitrine: base e laterais retas, topo em semicírculo (elipse achatada se a caixa for mais larga que alta·2). */
function arch(W: number, H: number): PathCmd[] {
  const rx = W / 2, ry = Math.min(W / 2, H);
  const x0 = -W / 2, y0 = -H / 2, x1 = W / 2, y1 = H / 2;
  return [
    ['M', x0, y1], ['L', x0, y0 + ry],
    ['C', x0, y0 + ry - K * ry, -K * rx, y0, 0, y0],
    ['C', K * rx, y0, x1, y0 + ry - K * ry, x1, y0 + ry],
    ['L', x1, y1], ['Z'],
  ];
}

/**
 * Contorno da forma para a caixa W × H (px da página), centrado na origem, tocando os quatro lados. `leaf-tr`: pontas
 * retas no canto superior direito e no inferior esquerdo (os outros dois curvos, 50%); `leaf-tl`: o espelho.
 */
export function clipPathCommands(kind: Exclude<ClipShapeKind, 'none'>, W: number, H: number): PathCmd[] {
  const w = Math.max(1, W), h = Math.max(1, H), m = Math.min(w, h);
  switch (kind) {
    case 'circle': return ellipse(w, h);
    case 'rounded-sm': return roundedRect(w, h, [m * 0.12, m * 0.12, m * 0.12, m * 0.12]);
    case 'rounded-lg': return roundedRect(w, h, [m * 0.25, m * 0.25, m * 0.25, m * 0.25]);
    case 'pill': return roundedRect(w, h, [m / 2, m / 2, m / 2, m / 2]);
    case 'leaf-tr': return roundedRect(w, h, [m / 2, 0, m / 2, 0]);
    case 'leaf-tl': return roundedRect(w, h, [0, m / 2, 0, m / 2]);
    case 'star': return star(5, 0.45, w, h);
    case 'starburst-12': return star(12, 0.78, w, h);
    case 'starburst-20': return star(20, 0.84, w, h);
    case 'hexagon': return fitPolygon([[0, 0.5], [0.25, 0], [0.75, 0], [1, 0.5], [0.75, 1], [0.25, 1]], w, h);
    case 'diamond': return fitPolygon([[0.5, 0], [1, 0.5], [0.5, 1], [0, 0.5]], w, h);
    case 'shield': return unitPath(SHIELD, w, h);
    case 'arch': return arch(w, h);
    case 'heart': return unitPath(HEART, w, h);
  }
}

/** `d` do SVG. */
export function pathD(cmds: PathCmd[]): string {
  const n = (v: number) => String(Math.round(v * 1000) / 1000);
  return cmds.map((c) => c[0] + (c.length > 1 ? ' ' + (c.slice(1) as number[]).map(n).join(' ') : '')).join(' ');
}

/**
 * JSON do `clipPath` (classe `Path`) para uma imagem com caixa `boxW × boxH` na página e escala `sx`/`sy`: o mesmo que o
 * editor monta com o `Path` vivo, para quem mexe direto no JSON (⚡ lote). `left/top = 0` vale porque a bbox da forma é
 * a caixa (o `pathOffset` que o Fabric recalcula no revive é 0).
 */
export function clipPathJson(kind: Exclude<ClipShapeKind, 'none'>, boxW: number, boxH: number, sx: number, sy: number): Record<string, unknown> {
  return {
    type: 'Path',
    originX: 'center',
    originY: 'center',
    left: 0,
    top: 0,
    scaleX: 1 / (Math.abs(sx) || 1),
    scaleY: 1 / (Math.abs(sy) || 1),
    fill: '#000000',
    stroke: null,
    strokeWidth: 0,
    path: clipPathCommands(kind, boxW, boxH),
  };
}

// ---------- enquadramento interno (zoom/posição pelo recorte) ----------

/**
 * Recorte que mostra a foto `nw × nh` na caixa `boxW × boxH` da página com zoom e posição: a região máxima com a proporção
 * da caixa (cover da foto inteira) dividida pelo zoom, deslocada pela folga. A caixa na página não muda
 * (`width·scale = boxW`). Escalas positivas (o espelho fica com quem chama).
 */
export function framedGeometry(boxW: number, boxH: number, nw: number, nh: number, zoom: number, offsetX: number, offsetY: number): ImageGeometry {
  const s = Math.max(boxW / nw, boxH / nh) * clamp(finite(zoom, 1), FRAME_ZOOM_MIN, FRAME_ZOOM_MAX);
  const width = Math.min(nw, boxW / s), height = Math.min(nh, boxH / s);
  const ox = clamp(finite(offsetX, 0), -1, 1), oy = clamp(finite(offsetY, 0), -1, 1);
  return { width, height, scaleX: s, scaleY: s, cropX: ((nw - width) * (ox + 1)) / 2, cropY: ((nh - height) * (oy + 1)) / 2 };
}

/** Inversa do `framedGeometry`: zoom e posição que a geometria atual (recorte manual, troca) representa. */
export function framingOf(g: ImageGeometry, nw: number, nh: number): { scale: number; offsetX: number; offsetY: number } {
  if (!(nw > 0 && nh > 0 && g.width > 0 && g.height > 0)) return { scale: 1, offsetX: 0, offsetY: 0 };
  const zoom = 1 / Math.max(g.width / nw, g.height / nh);
  const off = (crop: number, span: number) => (span > 1e-6 ? clamp((2 * (crop || 0)) / span - 1, -1, 1) : 0);
  return {
    scale: clamp(zoom, FRAME_ZOOM_MIN, FRAME_ZOOM_MAX),
    offsetX: off(g.cropX, nw - g.width),
    offsetY: off(g.cropY, nh - g.height),
  };
}

// ---------- objetos vivos (classes por parâmetro) ----------

interface PointLike { x: number; y: number }

/** O que o módulo usa de um `Path` do Fabric. */
export interface ClipPathLike {
  scaleX: number;
  scaleY: number;
  pathOffset: PointLike;
  path: (string | number)[][];
  set(props: Record<string, unknown>): unknown;
  transform(ctx: CanvasRenderingContext2D): void;
  _renderPathCommands(ctx: CanvasRenderingContext2D): void;
  calcOwnMatrix(): number[];
}

export type PathClass = new (path: PathCmd[], options: Record<string, unknown>) => ClipPathLike;

/** O que o módulo usa de uma `FabricImage`. */
export interface FramedImageLike {
  width: number;
  height: number;
  scaleX: number;
  scaleY: number;
  cropX: number;
  cropY: number;
  clipPath?: unknown;
  dirty?: boolean;
  get(k: string): unknown;
  set(k: string | Record<string, unknown>, v?: unknown): unknown;
  getOriginalSize(): { width: number; height: number };
  getCenterPoint(): PointLike;
  setPositionByOrigin(p: PointLike, x: 'center', y: 'center'): void;
}

/** `Path` vivo do `clipPath` (o mesmo do `clipPathJson`, com `left/top` exatos pelo `pathOffset` calculado pelo Fabric). */
export function buildClipPath(P: PathClass, kind: Exclude<ClipShapeKind, 'none'>, boxW: number, boxH: number, sx: number, sy: number): ClipPathLike {
  const { path, type: _t, ...opts } = clipPathJson(kind, boxW, boxH, sx, sy);
  const p = new P(path as PathCmd[], opts);
  p.set({ left: p.pathOffset.x * p.scaleX, top: p.pathOffset.y * p.scaleY });
  return p;
}

/** Caixa da imagem na página (px), pela escala própria. */
export function frameBox(img: Pick<FramedImageLike, 'width' | 'height' | 'scaleX' | 'scaleY'>): { width: number; height: number } {
  return { width: img.width * Math.abs(img.scaleX || 1), height: img.height * Math.abs(img.scaleY || 1) };
}

/**
 * Regera o `clipPath` da imagem emoldurada para a caixa atual (depois de qualquer mudança das unidades locais).
 * `false` (e nada muda) se a imagem não tem moldura: um `clipPath` que não é nosso (SVG importado) fica como está.
 */
export function refreshFrame(img: FramedImageLike, P: PathClass): boolean {
  const spec = frameSpecOf(img);
  if (!spec) return false;
  const box = frameBox(img);
  img.set('clipPath', buildClipPath(P, spec.kind, box.width, box.height, img.scaleX, img.scaleY));
  img.dirty = true;
  return true;
}

/** Aplica zoom/posição internos mudando o recorte; a caixa e o centro na página ficam. Não regera o `clipPath`. */
export function applyFraming(img: FramedImageLike, zoom: number, offsetX: number, offsetY: number): void {
  const { width: nw, height: nh } = img.getOriginalSize();
  if (!(nw > 0 && nh > 0)) return;
  const box = frameBox(img);
  const center = img.getCenterPoint();
  const g = framedGeometry(box.width, box.height, nw, nh, zoom, offsetX, offsetY);
  img.set({ ...g, scaleX: g.scaleX * Math.sign(img.scaleX || 1), scaleY: g.scaleY * Math.sign(img.scaleY || 1) });
  img.setPositionByOrigin(center, 'center', 'center');
}

/** Zoom/posição que a geometria atual da imagem representa. */
export function currentFraming(img: FramedImageLike): { scale: number; offsetX: number; offsetY: number } {
  const { width: nw, height: nh } = img.getOriginalSize();
  return framingOf({ width: img.width, height: img.height, scaleX: img.scaleX, scaleY: img.scaleY, cropX: img.cropX, cropY: img.cropY }, nw, nh);
}

// ---------- aro (canvas + SVG) ----------

interface RimHost extends FramedImageLike {
  getObjectScaling(): PointLike;
}

function rimOf(img: RimHost): { spec: FrameSpec; clip: ClipPathLike; tx: number; ty: number } | null {
  const spec = frameSpecOf(img);
  const clip = img.clipPath as ClipPathLike | undefined;
  if (!spec || spec.strokeWidth <= 0 || !clip || typeof clip._renderPathCommands !== 'function') return null;
  const s = img.getObjectScaling();
  // px da página por unidade do caminho (escala total da imagem × escala do clipPath)
  const tx = Math.abs(clip.scaleX) * s.x, ty = Math.abs(clip.scaleY) * s.y;
  return tx > 0 && ty > 0 ? { spec, clip, tx, ty } : null;
}

/** Desenha o aro interno no contexto em unidades locais da imagem (o do `drawObject`). */
export function drawFrameRim(img: RimHost, ctx: CanvasRenderingContext2D): void {
  const r = rimOf(img);
  if (!r) return;
  ctx.save();
  r.clip.transform(ctx);
  r.clip._renderPathCommands(ctx);
  ctx.clip();
  // o caminho já está no contexto: a escala muda só a espessura → `strokeWidth` em px da página
  ctx.scale(1 / r.tx, 1 / r.ty);
  ctx.setLineDash([]);
  ctx.lineJoin = 'round';
  ctx.lineWidth = r.spec.strokeWidth * 2;
  ctx.strokeStyle = r.spec.stroke;
  ctx.stroke();
  ctx.restore();
}

function escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&apos;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * `<path>` do aro no referencial local da imagem (o do `_toSVG`), dentro de um `<g scale(1/escala)>` para a espessura
 * sair em px da página; vazio sem aro. O recorte pela forma vem do `clip-path` do `<g>` da imagem.
 */
export function frameRimSvg(img: RimHost): string {
  const r = rimOf(img);
  if (!r) return '';
  // ponto do caminho → local da imagem (matriz própria do clipPath, menos o pathOffset) → px da página
  const [a, b, c, d, e, f] = r.clip.calcOwnMatrix();
  const po = r.clip.pathOffset;
  const sx = r.tx / Math.abs(r.clip.scaleX), sy = r.ty / Math.abs(r.clip.scaleY);
  const map = (x: number, y: number): [number, number] => {
    const px = x - po.x, py = y - po.y;
    return [(a * px + c * py + e) * sx, (b * px + d * py + f) * sy];
  };
  const cmds: PathCmd[] = [];
  for (const cmd of r.clip.path) {
    const k = cmd[0];
    const v = cmd.slice(1) as number[];
    if (k === 'M' || k === 'L') cmds.push([k, ...map(v[0], v[1])]);
    else if (k === 'C') cmds.push(['C', ...map(v[0], v[1]), ...map(v[2], v[3]), ...map(v[4], v[5])]);
    else if (k === 'Q') {
      // quadrática → cúbica (o Fabric gera Q em alguns caminhos simplificados)
      const p0 = cmds.length ? lastPoint(cmds) : [0, 0];
      const q = map(v[0], v[1]), p = map(v[2], v[3]);
      cmds.push(['C', p0[0] + (2 / 3) * (q[0] - p0[0]), p0[1] + (2 / 3) * (q[1] - p0[1]),
        p[0] + (2 / 3) * (q[0] - p[0]), p[1] + (2 / 3) * (q[1] - p[1]), p[0], p[1]]);
    } else if (k === 'Z' || k === 'z') cmds.push(['Z']);
  }
  const n = (v: number) => Math.round(v * 10000) / 10000;
  return `\t<g transform="scale(${n(1 / sx)} ${n(1 / sy)})"><path d="${pathD(cmds)}" fill="none" stroke="${escapeXml(r.spec.stroke)}" `
    + `stroke-width="${n(r.spec.strokeWidth * 2)}" stroke-linejoin="round" /></g>\n`;
}

function lastPoint(cmds: PathCmd[]): [number, number] {
  for (let i = cmds.length - 1; i >= 0; i--) {
    const c = cmds[i];
    if (c[0] === 'C') return [c[5], c[6]];
    if (c[0] === 'M' || c[0] === 'L') return [c[1], c[2]];
  }
  return [0, 0];
}

interface ImageProto {
  drawObject(ctx: CanvasRenderingContext2D, forClipping: boolean | undefined, context: unknown): void;
  _toSVG(reviver?: unknown): string[];
}

let rendererInstalled = false;

/**
 * Patch de classe (não de instância): o canvas do editor, a miniatura (`StaticCanvas`), o PNG/JPG e o vídeo desenham o
 * aro; o `toSVG` o emite. `frameStroke`/`frameStrokeWidth` entram nas `cacheProperties` (mudar o aro suja o cache).
 */
export function installFrameRenderer(ImageClass: { prototype: object; cacheProperties: string[] }): void {
  if (rendererInstalled) return;
  rendererInstalled = true;
  ImageClass.cacheProperties = [...ImageClass.cacheProperties, 'frameStroke', 'frameStrokeWidth', 'clipShape'];
  const proto = ImageClass.prototype as ImageProto;
  const origDraw = proto.drawObject;
  proto.drawObject = function (this: RimHost & ImageProto, ctx, forClipping, context) {
    origDraw.call(this, ctx, forClipping, context);
    if (!forClipping && this.clipPath) drawFrameRim(this, ctx);
  };
  const origSvg = proto._toSVG;
  proto._toSVG = function (this: RimHost & ImageProto, reviver?: unknown) {
    const out = origSvg.call(this, reviver);
    const rim = out.length && this.clipPath ? frameRimSvg(this) : '';
    return rim ? [...out, rim] : out;
  };
}
