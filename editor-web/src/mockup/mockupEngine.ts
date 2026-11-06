// Motor de mockup 2.5D (TASK-08): plano em perspectiva (com malha 4×4 opcional), cilindro e esfera, com a fusão de
// luz/dobras da base sobre a arte. Puro: só arrays (`Pixels`), sem DOM — o `ImageData` do navegador satisfaz o tipo e o
// vitest (ambiente node) roda tudo. Implementação própria; o app de referência serviu só de especificação.

export type Pt = [number, number];
/** Cantos na ordem topo-esq, topo-dir, base-dir, base-esq. */
export type Quad = [Pt, Pt, Pt, Pt];
/** Homografia 3×3 por linhas (`h[8]` normalizado para 1). */
export type Mat3 = number[];
export type Shape = 'plane' | 'cylinder' | 'sphere';
export const SHAPES: readonly Shape[] = ['plane', 'cylinder', 'sphere'];

/** RGBA não pré-multiplicado, 4 bytes por pixel, por linhas. */
export interface Pixels {
  data: Uint8ClampedArray;
  width: number;
  height: number;
}

export const ARC_MIN = 10;
export const ARC_MAX = 179;
export const ARC_DEFAULT = 110;
export const TILT_LIMIT = 0.5;
export const SHADING_DEFAULT = 0.65;
/** Malha: 4×4 pontos por linhas (linha j ↔ t = j/3, coluna i ↔ s = i/3) → 3×3 células. */
export const MESH_SIDE = 4;

export interface MockupParams {
  shape: Shape;
  /** px da base. */
  quad: Quad;
  /** 16 pontos em px da base (só no plano; ver `MESH_SIDE`). */
  mesh?: Pt[];
  arcDeg: number;
  tiltDepth: number;
  /** Fusão com as dobras/luz da base, 0..1. */
  shadingStrength: number;
  /** `contain` (padrão): a arte cabe no rótulo sem distorcer; `stretch`: ocupa o rótulo inteiro. */
  fit?: 'contain' | 'stretch';
}

const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);
const halfAngle = (arcDeg: number) => (clamp(arcDeg, ARC_MIN, ARC_MAX) * Math.PI) / 360;

// ---------- homografia ----------

/** Similaridade que leva os pontos para centroide 0 e distância média √2 (normalização de Hartley); null se coincidem. */
function normalizer(pts: readonly Pt[]): Mat3 | null {
  let cx = 0;
  let cy = 0;
  for (const [x, y] of pts) { cx += x; cy += y; }
  cx /= pts.length;
  cy /= pts.length;
  let d = 0;
  for (const [x, y] of pts) d += Math.hypot(x - cx, y - cy);
  d /= pts.length;
  if (!(d > 1e-12) || !Number.isFinite(d)) return null;
  const k = Math.SQRT2 / d;
  return [k, 0, -k * cx, 0, k, -k * cy, 0, 0, 1];
}

function mul3(a: Mat3, b: Mat3): Mat3 {
  const r = new Array<number>(9);
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) r[i * 3 + j] = a[i * 3] * b[j] + a[i * 3 + 1] * b[3 + j] + a[i * 3 + 2] * b[6 + j];
  }
  return r;
}

/** Inversa de 3×3; null se singular. */
export function invert3(m: Mat3): Mat3 | null {
  const [a, b, c, d, e, f, g, h, i] = m;
  const A = e * i - f * h;
  const B = -(d * i - f * g);
  const C = d * h - e * g;
  const det = a * A + b * B + c * C;
  if (!Number.isFinite(det) || Math.abs(det) < 1e-300) return null;
  const s = 1 / det;
  return [A * s, -(b * i - c * h) * s, (b * f - c * e) * s, B * s, (a * i - c * g) * s, -(a * f - c * d) * s, C * s,
    -(a * h - b * g) * s, (a * e - b * d) * s];
}

/** Sistema 8×8 aumentado (8×9) por eliminação de Gauss com pivoteamento parcial; null se (quase) singular. */
function solve8(m: number[][]): number[] | null {
  const n = 8;
  for (let col = 0; col < n; col++) {
    let piv = col;
    for (let r = col + 1; r < n; r++) if (Math.abs(m[r][col]) > Math.abs(m[piv][col])) piv = r;
    if (!(Math.abs(m[piv][col]) > 1e-9)) return null;
    if (piv !== col) [m[piv], m[col]] = [m[col], m[piv]];
    const p = m[col][col];
    for (let r = col + 1; r < n; r++) {
      const f = m[r][col] / p;
      if (f === 0) continue;
      for (let c = col; c <= n; c++) m[r][c] -= f * m[col][c];
    }
  }
  const x = new Array<number>(n);
  for (let r = n - 1; r >= 0; r--) {
    let s = m[r][n];
    for (let c = r + 1; c < n; c++) s -= m[r][c] * x[c];
    x[r] = s / m[r][r];
  }
  return x.every(Number.isFinite) ? x : null;
}

/**
 * Homografia que leva os 4 pontos `src` nos 4 `dst` (DLT 8×8 sobre pontos normalizados). null se algum dos dois
 * quadriláteros é degenerado (pontos coincidentes ou 3 colineares).
 */
export function homographyFromQuads(src: readonly Pt[], dst: readonly Pt[]): Mat3 | null {
  if (src.length !== 4 || dst.length !== 4) return null;
  const ts = normalizer(src);
  const td = normalizer(dst);
  if (!ts || !td) return null;
  const rows: number[][] = [];
  for (let i = 0; i < 4; i++) {
    const [x, y] = applyH(ts, src[i][0], src[i][1]);
    const [X, Y] = applyH(td, dst[i][0], dst[i][1]);
    rows.push([x, y, 1, 0, 0, 0, -x * X, -y * X, X]);
    rows.push([0, 0, 0, x, y, 1, -x * Y, -y * Y, Y]);
  }
  const h = solve8(rows);
  if (!h) return null;
  // 3 pontos colineares de um lado dão uma solução do sistema, mas singular (não é homografia): det relativo ≈ 0
  const hn = [...h, 1];
  const norm = Math.hypot(...hn);
  const [a, b, c, d, e, f, g, i, j] = hn;
  const det = a * (e * j - f * i) - b * (d * j - f * g) + c * (d * i - e * g);
  if (!(Math.abs(det) > 1e-9 * norm * norm * norm)) return null;
  const tdInv = invert3(td);
  if (!tdInv) return null;
  const full = mul3(tdInv, mul3(hn, ts));
  if (!(Math.abs(full[8]) > 1e-300)) return null;
  const out = full.map((v) => v / full[8]);
  return out.every(Number.isFinite) ? out : null;
}

export function applyH(m: Mat3, x: number, y: number): Pt {
  const w = m[6] * x + m[7] * y + m[8];
  return [(m[0] * x + m[1] * y + m[2]) / w, (m[3] * x + m[4] * y + m[5]) / w];
}

export function transformPoints(m: Mat3, pts: readonly Pt[]): Pt[] {
  return pts.map(([x, y]) => applyH(m, x, y));
}

const UNIT: Quad = [[0, 0], [1, 0], [1, 1], [0, 1]];

/** Os 16 pontos da malha reta: a grade 4×4 do quadrado unitário levada ao quad pela homografia; null se degenerado. */
export function meshFromQuad(quad: Quad): Pt[] | null {
  const h = homographyFromQuads(UNIT, quad);
  if (!h) return null;
  const pts: Pt[] = [];
  for (let j = 0; j < MESH_SIDE; j++) {
    for (let i = 0; i < MESH_SIDE; i++) pts.push(applyH(h, i / (MESH_SIDE - 1), j / (MESH_SIDE - 1)));
  }
  return pts;
}

/** Quad estritamente convexo, sem auto-interseção (as alças não podem virar o rótulo do avesso). */
export function isConvexQuad(q: readonly Pt[]): boolean {
  if (q.length !== 4 || !q.every(([x, y]) => Number.isFinite(x) && Number.isFinite(y))) return false;
  let span = 0;
  for (const [x, y] of q) for (const [u, v] of q) span = Math.max(span, Math.abs(x - u), Math.abs(y - v));
  const eps = 1e-9 * span * span;
  let sign = 0;
  for (let i = 0; i < 4; i++) {
    const [ax, ay] = q[i];
    const [bx, by] = q[(i + 1) % 4];
    const [cx, cy] = q[(i + 2) % 4];
    const cross = (bx - ax) * (cy - by) - (by - ay) * (cx - bx);
    if (Math.abs(cross) <= eps) return false;
    const s = Math.sign(cross);
    if (sign === 0) sign = s;
    else if (s !== sign) return false;
  }
  return true;
}

// ---------- amostragem ----------

/**
 * Bilinear em (u, v) px da origem (o centro do pixel i fica em i + 0,5). Vizinhos fora da imagem contam como
 * transparentes, o que suaviza a borda da arte. Escreve em `out` a cor PRÉ-multiplicada (0..255) e o alfa (0..255).
 */
export function sampleBilinear(src: Pixels, u: number, v: number, out: number[] | Float32Array): void {
  const x = u - 0.5;
  const y = v - 0.5;
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const fx = x - x0;
  const fy = y - y0;
  out[0] = 0; out[1] = 0; out[2] = 0; out[3] = 0;
  const { data, width, height } = src;
  for (let k = 0; k < 4; k++) {
    const xi = x0 + (k & 1);
    const yi = y0 + (k >> 1);
    if (xi < 0 || yi < 0 || xi >= width || yi >= height) continue;
    const w = ((k & 1) ? fx : 1 - fx) * ((k >> 1) ? fy : 1 - fy);
    if (w === 0) continue;
    const o = (yi * width + xi) * 4;
    const a = data[o + 3] * w;
    out[0] += data[o] * a / 255;
    out[1] += data[o + 1] * a / 255;
    out[2] += data[o + 2] * a / 255;
    out[3] += a;
  }
}

// ---------- geometrias ----------

/** Cilindro: coordenada de textura horizontal na tela normalizada `s` ∈ [0, 1] (arco visível `arcDeg`). */
export function uCyl(s: number, arcDeg: number): number {
  const a = halfAngle(arcDeg);
  return 0.5 + Math.asin(clamp((2 * s - 1) * Math.sin(a), -1, 1)) / (2 * a);
}

/** Cilindro: deslocamento vertical da textura pela inclinação (topo e base viram elipses vistas de cima/baixo). */
export function cylTiltDt(s: number, arcDeg: number, tiltDepth: number): number {
  const sa = Math.sin(halfAngle(arcDeg));
  const d = 2 * s - 1;
  return tiltDepth * (1 - Math.sqrt(Math.max(0, 1 - d * d * sa * sa)));
}

/** Esfera: (dx, dy) = (2s − 1, 2t − 1) → (u, v) da textura; null fora do disco (r > 1, com folga de arredondamento). */
export function sphereUV(dx: number, dy: number, arcDeg: number): Pt | null {
  const r0 = Math.hypot(dx, dy);
  if (r0 > 1 + 1e-9) return null;
  const r = Math.min(1, r0);
  const a = halfAngle(arcDeg);
  const sa = Math.sin(a);
  const phi = r < 1e-9 ? sa / a : Math.asin(clamp(r * sa, -1, 1)) / (r * a);
  return [(1 + dx * phi) / 2, (1 + dy * phi) / 2];
}

/** Sombreamento automático do cilindro: cos θ (escurece nas bordas) + brilho vertical em s ≈ 0,32. */
export function cylinderShade(s: number, arcDeg: number): number {
  const sa = Math.sin(halfAngle(arcDeg));
  const d = 2 * s - 1;
  const cos = Math.sqrt(Math.max(0, 1 - d * d * sa * sa));
  return 1 - 0.3 * (1 - cos) + 0.15 * Math.exp(-(((s - 0.32) / 0.07) ** 2));
}

/** Sombreamento automático da esfera: cos do ângulo com a vista + brilho no alto à esquerda. */
export function sphereShade(dx: number, dy: number, arcDeg: number): number {
  const sa = Math.sin(halfAngle(arcDeg));
  const r = Math.min(1, Math.hypot(dx, dy));
  const cos = Math.sqrt(Math.max(0, 1 - r * r * sa * sa));
  return 1 - 0.3 * (1 - cos) + 0.15 * Math.exp(-((dx + 0.35) ** 2 + (dy + 0.4) ** 2) / 0.05);
}

const dist = (a: Pt, b: Pt) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const quadWidth = (q: Quad) => (dist(q[0], q[1]) + dist(q[3], q[2])) / 2;
const quadHeight = (q: Quad) => (dist(q[0], q[3]) + dist(q[1], q[2])) / 2;

/** Proporção (largura/altura) natural do rótulo: o quad no plano e na esfera; o arco desenrolado no cilindro. */
export function labelAspect(quad: Quad, shape: Shape, arcDeg: number): number {
  const w = quadWidth(quad);
  const h = Math.max(1e-9, quadHeight(quad));
  if (shape !== 'cylinder') return w / h;
  const a = halfAngle(arcDeg);
  return (w * (a / Math.sin(a))) / h;
}

// ---------- fusão de luz e dobras ----------

export function luminance(r: number, g: number, b: number): number {
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

/** f da fusão: luminância da base relativa à média da superfície, dosada por `strength`, em [0,50; 1,35]. */
export function lightingFactor(lBase: number, lMean: number, strength: number): number {
  return clamp(1 + clamp(strength, 0, 1) * (lBase / Math.max(0.25, lMean) - 1), 0.5, 1.35);
}

/**
 * Transfere sombras, dobras e altas-luzes da `base` para a `art` (já projetada, mesmo tamanho): cada pixel com α > 0
 * tem o RGB multiplicado por `lightingFactor` e, onde a base brilha acima da média (L > máx(0,85; 1,08·L̄)), um toque
 * de especular. L̄ = média da luminância da base sob a arte (pesada pelo α). Devolve uma cópia; α da arte intacto.
 */
export function applySurfaceLighting(art: Pixels, base: Pixels, strength: number): Pixels {
  const out = new Uint8ClampedArray(art.data);
  const s = clamp(strength, 0, 1);
  if (s === 0 || art.width !== base.width || art.height !== base.height) return { data: out, width: art.width, height: art.height };
  const a = art.data;
  const b = base.data;
  let sum = 0;
  let wsum = 0;
  for (let o = 0; o < a.length; o += 4) {
    const al = a[o + 3];
    if (al === 0) continue;
    sum += luminance(b[o], b[o + 1], b[o + 2]) * al;
    wsum += al;
  }
  if (wsum === 0) return { data: out, width: art.width, height: art.height };
  const mean = sum / wsum;
  const specFrom = Math.max(0.85, 1.08 * mean);
  for (let o = 0; o < a.length; o += 4) {
    if (a[o + 3] === 0) continue;
    const l = luminance(b[o], b[o + 1], b[o + 2]);
    const f = lightingFactor(l, mean, s);
    const spec = l > specFrom ? s * 0.35 * clamp((l - specFrom) / 0.15, 0, 1) : 0;
    for (let c = 0; c < 3; c++) {
      const v = a[o + c] * f;
      out[o + c] = v + (255 - v) * spec;
    }
  }
  return { data: out, width: art.width, height: art.height };
}

// ---------- render ----------

interface Cell {
  inv: Mat3; // px da base → (a, b) local da célula
  s0: number;
  t0: number;
  ds: number;
  dt: number;
  /** margem aceita em (a, b) além de [0, 1], para a meia-faixa de antialias da borda */
  ma: number;
  mb: number;
  wSign: number;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

function makeCell(q: Quad, s0: number, t0: number, ds: number, dt: number, extraY: number, w: number, h: number): Cell | null {
  if (!isConvexQuad(q)) return null;
  const inv = homographyFromQuads(q, UNIT);
  if (!inv) return null;
  const cx = (q[0][0] + q[1][0] + q[2][0] + q[3][0]) / 4;
  const cy = (q[0][1] + q[1][1] + q[2][1] + q[3][1]) / 4;
  const wSign = Math.sign(inv[6] * cx + inv[7] * cy + inv[8]) || 1;
  const xs = q.map((p) => p[0]);
  const ys = q.map((p) => p[1]);
  return {
    inv, s0, t0, ds, dt,
    ma: 0.5 / Math.max(1, quadWidth(q)) + 1e-9,
    mb: 0.5 / Math.max(1, quadHeight(q)) + 1e-9,
    wSign,
    x0: clamp(Math.floor(Math.min(...xs)) - 1, 0, w),
    x1: clamp(Math.ceil(Math.max(...xs)) + 1, 0, w),
    y0: clamp(Math.floor(Math.min(...ys) - extraY) - 1, 0, h),
    y1: clamp(Math.ceil(Math.max(...ys) + extraY) + 1, 0, h),
  };
}

function buildCells(p: MockupParams, w: number, h: number): Cell[] {
  const mesh = p.shape === 'plane' && p.mesh?.length === MESH_SIDE * MESH_SIDE ? p.mesh : null;
  if (!mesh) {
    const extraY = p.shape === 'cylinder'
      ? Math.abs(p.tiltDepth) * (1 - Math.cos(halfAngle(p.arcDeg))) * quadHeight(p.quad) + 1 : 0;
    const c = makeCell(p.quad, 0, 0, 1, 1, extraY, w, h);
    return c ? [c] : [];
  }
  const n = MESH_SIDE - 1;
  const cells: Cell[] = [];
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const at = (ii: number, jj: number) => mesh[jj * MESH_SIDE + ii];
      const q: Quad = [at(i, j), at(i + 1, j), at(i + 1, j + 1), at(i, j + 1)];
      const c = makeCell(q, i / n, j / n, 1 / n, 1 / n, 0, w, h);
      if (c) cells.push(c);
    }
  }
  return cells;
}

const edgeCov = (x: number, sizePx: number) => clamp(Math.min(x, 1 - x) * sizePx + 0.5, 0, 1);

/**
 * A arte projetada sobre a base: cópia da base com a arte composta dentro do rótulo (plano/malha, cilindro ou esfera),
 * sombreamento automático da forma curva e a fusão de luz/dobras (`shadingStrength`). Só o bbox do rótulo é
 * percorrido. Quad não convexo ou degenerado → cópia da base, sem lançar.
 */
export function renderMockup(base: Pixels, art: Pixels, p: MockupParams): Pixels {
  const W = base.width;
  const H = base.height;
  const out = new Uint8ClampedArray(base.data);
  const result: Pixels = { data: out, width: W, height: H };
  if (!isConvexQuad(p.quad) || art.width <= 0 || art.height <= 0) return result;
  const cells = buildCells(p, W, H);
  if (cells.length === 0) return result;

  let bx0 = W;
  let by0 = H;
  let bx1 = 0;
  let by1 = 0;
  for (const c of cells) {
    bx0 = Math.min(bx0, c.x0); by0 = Math.min(by0, c.y0); bx1 = Math.max(bx1, c.x1); by1 = Math.max(by1, c.y1);
  }
  const bw = bx1 - bx0;
  const bh = by1 - by0;
  if (bw <= 0 || bh <= 0) return result;

  const wPx = Math.max(1, quadWidth(p.quad));
  const hPx = Math.max(1, quadHeight(p.quad));
  const rPx = Math.min(wPx, hPx) / 2;
  const arc = clamp(p.arcDeg, ARC_MIN, ARC_MAX);
  const tilt = clamp(p.tiltDepth, -TILT_LIMIT, TILT_LIMIT);
  // a arte cabe no rótulo sem distorcer (contain) ou o ocupa inteiro (stretch)
  let u0 = 0;
  let us = 1;
  let v0 = 0;
  let vs = 1;
  if (p.fit !== 'stretch') {
    const la = labelAspect(p.quad, p.shape, arc);
    const aa = art.width / art.height;
    if (aa >= la) { vs = la / aa; v0 = (1 - vs) / 2; } else { us = aa / la; u0 = (1 - us) / 2; }
  }

  const layer = new Uint8ClampedArray(bw * bh * 4);
  const px = [0, 0, 0, 0];
  for (const c of cells) {
    const m = c.inv;
    for (let y = c.y0; y < c.y1; y++) {
      const fy = y + 0.5;
      for (let x = c.x0; x < c.x1; x++) {
        const fx = x + 0.5;
        const wd = m[6] * fx + m[7] * fy + m[8];
        if (wd * c.wSign <= 1e-12) continue;
        const a = (m[0] * fx + m[1] * fy + m[2]) / wd;
        if (a < -c.ma || a > 1 + c.ma) continue;
        const b = (m[3] * fx + m[4] * fy + m[5]) / wd;
        const s = c.s0 + a * c.ds;
        const t = c.t0 + b * c.dt;
        let u: number;
        let v: number;
        let cov: number;
        let shade = 1;
        if (p.shape === 'plane') {
          if (b < -c.mb || b > 1 + c.mb) continue;
          cov = edgeCov(s, wPx) * edgeCov(t, hPx);
          u = clamp(s, 0, 1);
          v = clamp(t, 0, 1);
        } else if (p.shape === 'cylinder') {
          const sc = clamp(s, 0, 1);
          const vv = t + cylTiltDt(sc, arc, tilt);
          cov = edgeCov(s, wPx) * edgeCov(vv, hPx);
          if (cov <= 0) continue;
          u = uCyl(sc, arc);
          v = clamp(vv, 0, 1);
          shade = cylinderShade(sc, arc);
        } else {
          const dx = 2 * s - 1;
          const dy = 2 * t - 1;
          const r = Math.hypot(dx, dy);
          cov = clamp((1 - r) * rPx + 0.5, 0, 1);
          if (cov <= 0) continue;
          const kr = r > 1 ? 1 / r : 1;
          const uv = sphereUV(dx * kr, dy * kr, arc)!;
          u = uv[0];
          v = uv[1];
          shade = sphereShade(dx * kr, dy * kr, arc);
        }
        if (cov <= 0) continue;
        const au = (u - u0) / us;
        const av = (v - v0) / vs;
        sampleBilinear(art, au * art.width, av * art.height, px);
        const al = px[3] * cov;
        if (al <= 0) continue;
        const o = ((y - by0) * bw + (x - bx0)) * 4;
        const k = (255 * shade) / px[3];
        layer[o] = px[0] * k;
        layer[o + 1] = px[1] * k;
        layer[o + 2] = px[2] * k;
        layer[o + 3] = al;
      }
    }
  }

  const crop = new Uint8ClampedArray(bw * bh * 4);
  for (let y = 0; y < bh; y++) crop.set(base.data.subarray(((by0 + y) * W + bx0) * 4, ((by0 + y) * W + bx1) * 4), y * bw * 4);
  const lit = applySurfaceLighting({ data: layer, width: bw, height: bh }, { data: crop, width: bw, height: bh }, p.shadingStrength).data;
  for (let y = 0; y < bh; y++) {
    for (let x = 0; x < bw; x++) {
      const l = (y * bw + x) * 4;
      const al = lit[l + 3];
      if (al === 0) continue;
      const A = al / 255;
      const o = ((by0 + y) * W + bx0 + x) * 4;
      out[o] = lit[l] * A + out[o] * (1 - A);
      out[o + 1] = lit[l + 1] * A + out[o + 1] * (1 - A);
      out[o + 2] = lit[l + 2] * A + out[o + 2] * (1 - A);
      out[o + 3] = al + out[o + 3] * (1 - A);
    }
  }
  return result;
}

// ---------- índice de templates ----------

export interface MockupTemplate {
  id: string;
  name: string;
  shape: Shape;
  /** Caminho relativo a `assets/content/` (`mockups3d/mug.webp`). */
  file: string;
  thumb: string;
  width: number;
  height: number;
  quad: Quad;
  mesh?: Pt[];
  arcDeg: number;
  tiltDepth: number;
  shadingStrength: number;
}

const isPt = (p: unknown): p is Pt => Array.isArray(p) && p.length === 2 && p.every((n) => typeof n === 'number' && Number.isFinite(n));
const toQuad = (q: unknown): Quad | null => (Array.isArray(q) && q.length === 4 && q.every(isPt)
  ? (q.map((p) => [p[0], p[1]]) as Quad) : null);
const num = (v: unknown, d: number) => (typeof v === 'number' && Number.isFinite(v) ? v : d);

/**
 * `content/mockups3d/index.json` (`{version, mockups:[{id,name,shape,file,thumb,width,height,quad,mesh?,arcDeg?,
 * tiltDepth?,shadingStrength?}]}`). Entrada inválida (forma desconhecida — `box3d` é da TASK-19 —, quad não convexo,
 * malha sem 16 pontos) fica de fora em silêncio; o resto vale.
 */
export function parseMockup3dIndex(raw: unknown, folder = 'mockups3d'): MockupTemplate[] {
  const list = (raw as { mockups?: unknown } | null)?.mockups;
  if (!Array.isArray(list)) return [];
  const out: MockupTemplate[] = [];
  for (const e of list as Record<string, unknown>[]) {
    if (!e || typeof e !== 'object') continue;
    const shape = e.shape as Shape;
    const quad = toQuad(e.quad);
    const width = num(e.width, 0);
    const height = num(e.height, 0);
    if (!SHAPES.includes(shape) || !quad || !isConvexQuad(quad) || width <= 0 || height <= 0) continue;
    if (typeof e.id !== 'string' || typeof e.file !== 'string') continue;
    let mesh: Pt[] | undefined;
    if (e.mesh !== undefined) {
      if (!Array.isArray(e.mesh) || e.mesh.length !== MESH_SIDE * MESH_SIDE || !e.mesh.every(isPt)) continue;
      mesh = (e.mesh as Pt[]).map((p) => [p[0], p[1]] as Pt);
    }
    out.push({
      id: e.id, name: typeof e.name === 'string' ? e.name : e.id, shape,
      file: `${folder}/${e.file}`, thumb: `${folder}/${typeof e.thumb === 'string' ? e.thumb : e.file}`,
      width, height, quad, mesh,
      arcDeg: clamp(num(e.arcDeg, ARC_DEFAULT), ARC_MIN, ARC_MAX),
      tiltDepth: clamp(num(e.tiltDepth, 0), -TILT_LIMIT, TILT_LIMIT),
      shadingStrength: clamp(num(e.shadingStrength, SHADING_DEFAULT), 0, 1),
    });
  }
  return out;
}

/** Os templates planos do fluxo Kotlin (`content/mockups/index.json`, só leitura) como `plane`, com o quad do 1º slot. */
export function parseFlatMockupIndex(raw: unknown, folder = 'mockups'): MockupTemplate[] {
  const list = (raw as { mockups?: unknown } | null)?.mockups;
  if (!Array.isArray(list)) return [];
  const conv = list.map((e) => {
    const slot = Array.isArray((e as { slots?: unknown })?.slots) ? (e as { slots: { quad?: unknown }[] }).slots[0] : undefined;
    return { ...(e as object), shape: 'plane', quad: slot?.quad, mesh: undefined, id: `plano_${(e as { id?: unknown })?.id}` };
  });
  return parseMockup3dIndex({ mockups: conv }, folder);
}
