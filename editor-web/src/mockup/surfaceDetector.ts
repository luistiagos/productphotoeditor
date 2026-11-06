// Detecção automática da superfície numa foto própria (TASK-20): sugere os 4 cantos onde o design vai ser aplicado.
// Recorte com alfa → contorno dos pixels com α > 32; foto opaca → bordas por Sobel 3×3 com limiar adaptativo. Os cantos
// são os pontos extremos nas 4 diagonais. Sem nada útil → quadrilátero central (nunca NaN). Puro: só `Pixels`, sem DOM
// (o vitest roda em node). Implementação própria; o app de referência serviu só de especificação.
import { isConvexQuad, type Pixels, type Quad } from './mockupEngine';

export type DetectMethod = 'alpha' | 'sobel' | 'fallback';
export interface SurfaceDetection {
  /** px da imagem de ENTRADA, ordem TL, TR, BR, BL. */
  quad: Quad;
  method: DetectMethod;
}

/** Lado maior da imagem analisada (a entrada é reduzida por média de área). */
export const DETECT_MAX = 256;
/** α acima disto é "objeto" no recorte. */
const ALPHA_ON = 32;
/** Fração mínima de pixels transparentes E de opacos para tratar a imagem como recorte. */
const CUTOUT_MIN_FRAC = 0.01;
/** Componentes conexos menores que max(isto, 10 % do maior) são ruído (pixel isolado, poeira). */
const MIN_COMPONENT = 12;
const COMPONENT_FRAC = 0.1;
/** Moldura ignorada no Sobel (borda da foto, artefato de compressão na margem). */
const FRAME = 2;
/** Sobel: bordas em mais que esta fração das células da grade `TEXTURE_GRID`² = textura, sem superfície → fallback. */
const TEXTURE_GRID = 8;
const TEXTURE_COVERAGE = 0.75;
const AREA_MIN = 0.02;
const AREA_MAX = 0.9;

/** Quad central (20 %..80 % de cada lado): o fallback. */
export function centralQuad(w: number, h: number): Quad {
  return [[0.2 * w, 0.2 * h], [0.8 * w, 0.2 * h], [0.8 * w, 0.8 * h], [0.2 * w, 0.8 * h]];
}

/** Reduz por média de área (RGBA, sem pré-multiplicar) até o lado maior ≤ `max`; a própria entrada se já cabe. */
export function downscaleArea(px: Pixels, max: number): Pixels {
  const { data, width: w, height: h } = px;
  const k = Math.min(1, max / Math.max(w, h));
  if (k >= 1) return px;
  const tw = Math.max(1, Math.round(w * k));
  const th = Math.max(1, Math.round(h * k));
  const out = new Uint8ClampedArray(tw * th * 4);
  const sx = w / tw;
  const sy = h / th;
  for (let y = 0; y < th; y++) {
    const y0 = Math.floor(y * sy);
    const y1 = Math.max(y0 + 1, Math.min(h, Math.floor((y + 1) * sy)));
    for (let x = 0; x < tw; x++) {
      const x0 = Math.floor(x * sx);
      const x1 = Math.max(x0 + 1, Math.min(w, Math.floor((x + 1) * sx)));
      let r = 0; let g = 0; let b = 0; let a = 0;
      for (let yy = y0; yy < y1; yy++) {
        for (let xx = x0; xx < x1; xx++) {
          const o = (yy * w + xx) * 4;
          r += data[o]; g += data[o + 1]; b += data[o + 2]; a += data[o + 3];
        }
      }
      const n = (y1 - y0) * (x1 - x0);
      const o = (y * tw + x) * 4;
      out[o] = r / n; out[o + 1] = g / n; out[o + 2] = b / n; out[o + 3] = a / n;
    }
  }
  return { data: out, width: tw, height: th };
}

/** Valor no percentil `p` (0..1) de `v` (copia e ordena). */
function percentile(v: Float32Array, p: number): number {
  if (v.length === 0) return 0;
  const s = Float32Array.from(v).sort();
  return s[Math.min(s.length - 1, Math.floor(p * s.length))];
}

/** Sobel 3×3 da luminância (0..255); a moldura de 1 px fica 0. */
export function sobelMagnitude(px: Pixels): Float32Array {
  const { data, width: w, height: h } = px;
  const lum = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) lum[i] = 0.299 * data[i * 4] + 0.587 * data[i * 4 + 1] + 0.114 * data[i * 4 + 2];
  const g = new Float32Array(w * h);
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const tl = lum[i - w - 1]; const t = lum[i - w]; const tr = lum[i - w + 1];
      const l = lum[i - 1]; const r = lum[i + 1];
      const bl = lum[i + w - 1]; const b = lum[i + w]; const br = lum[i + w + 1];
      const gx = (tr + 2 * r + br) - (tl + 2 * l + bl);
      const gy = (bl + 2 * b + br) - (tl + 2 * t + tr);
      g[i] = Math.sqrt(gx * gx + gy * gy);
    }
  }
  return g;
}

/** Tira os componentes conexos (8-vizinhança) pequenos da máscara; devolve quantos pontos ficaram. */
function dropSmallComponents(mask: Uint8Array, w: number, h: number): number {
  const label = new Int32Array(w * h);
  const sizes: number[] = [0];
  const stack = new Int32Array(w * h);
  for (let s = 0; s < w * h; s++) {
    if (!mask[s] || label[s]) continue;
    const id = sizes.length;
    let top = 0;
    let n = 0;
    stack[top++] = s;
    label[s] = id;
    while (top > 0) {
      const i = stack[--top];
      n++;
      const x = i % w;
      const y = (i - x) / w;
      for (let dy = -1; dy <= 1; dy++) {
        const yy = y + dy;
        if (yy < 0 || yy >= h) continue;
        for (let dx = -1; dx <= 1; dx++) {
          const xx = x + dx;
          if (xx < 0 || xx >= w) continue;
          const j = yy * w + xx;
          if (mask[j] && !label[j]) { label[j] = id; stack[top++] = j; }
        }
      }
    }
    sizes.push(n);
  }
  let largest = 0;
  for (const s of sizes) if (s > largest) largest = s; // sem spread: ruído pode dar dezenas de milhares de componentes
  const keep = Math.max(MIN_COMPONENT, COMPONENT_FRAC * largest);
  let kept = 0;
  for (let i = 0; i < w * h; i++) {
    if (!mask[i]) continue;
    if (sizes[label[i]] >= keep) kept++;
    else mask[i] = 0;
  }
  return kept;
}

/**
 * Fração das células de uma grade `TEXTURE_GRID`² com bordas (≥ 2 % dos pixels da célula). O contorno de um objeto
 * passa por poucas células (medido: retângulos de teste 0,16–0,38); ruído uniforme ocupa quase todas (0,95–0,98).
 */
function edgeCoverage(mask: Uint8Array, w: number, h: number): number {
  const g = TEXTURE_GRID;
  const count = new Int32Array(g * g);
  for (let y = 0; y < h; y++) {
    const cy = Math.min(g - 1, Math.floor((y * g) / h));
    for (let x = 0; x < w; x++) if (mask[y * w + x]) count[cy * g + Math.min(g - 1, Math.floor((x * g) / w))]++;
  }
  const need = Math.max(1, 0.02 * (w / g) * (h / g));
  let busy = 0;
  for (const c of count) if (c >= need) busy++;
  return busy / (g * g);
}

const quadArea = (q: Quad) => Math.abs(q.reduce((acc, [x, y], i) => {
  const [u, v] = q[(i + 1) % 4];
  return acc + x * v - u * y;
}, 0)) / 2;

/**
 * Os 4 cantos da superfície principal de `px`, em px da entrada (ordem TL, TR, BR, BL). Recorte (≥ 1 % de pixels com
 * α ≤ 32 e ≥ 1 % com α > 32) → pontos = pixels com α > 32; senão Sobel na luminância, limiar = máx(P80 de G na caixa
 * central [¼..¾]², 0,25·P99 de G na imagem, ε), fora de 2 px da moldura. Pontos de componentes conexos pequenos são
 * ruído. Cantos = extremos nas diagonais: TL = mín(x+y), BR = máx(x+y), TR = máx(x−y), BL = mín(x−y) (empate → o 1º na
 * varredura). Fallback (quad central): imagem < 3 px, poucos pontos, bordas (Sobel) em > 75 % da grade 8×8 (textura),
 * quad não convexo, área fora de 2 %..90 %, NaN.
 */
export function detectSurfaceQuad(px: Pixels): SurfaceDetection {
  const W = px.width;
  const H = px.height;
  const fallback = (): SurfaceDetection => ({ quad: centralQuad(W, H), method: 'fallback' });
  if (!(W >= 3 && H >= 3) || !Number.isInteger(W) || !Number.isInteger(H) || px.data.length < W * H * 4) return fallback();

  const small = downscaleArea(px, DETECT_MAX);
  const { data, width: w, height: h } = small;
  const n = w * h;
  if (w < 3 || h < 3) return fallback();

  let clear = 0;
  for (let i = 0; i < n; i++) if (data[i * 4 + 3] <= ALPHA_ON) clear++;
  const cutout = clear >= CUTOUT_MIN_FRAC * n && n - clear >= CUTOUT_MIN_FRAC * n;

  const mask = new Uint8Array(n);
  if (cutout) {
    for (let i = 0; i < n; i++) if (data[i * 4 + 3] > ALPHA_ON) mask[i] = 1;
  } else {
    const g = sobelMagnitude(small);
    const cx0 = Math.floor(w / 4);
    const cx1 = Math.ceil((3 * w) / 4);
    const cy0 = Math.floor(h / 4);
    const cy1 = Math.ceil((3 * h) / 4);
    const central = new Float32Array((cx1 - cx0) * (cy1 - cy0));
    let k = 0;
    for (let y = cy0; y < cy1; y++) for (let x = cx0; x < cx1; x++) central[k++] = g[y * w + x];
    const thr = Math.max(percentile(central, 0.8), 0.25 * percentile(g, 0.99), 1e-6);
    for (let y = FRAME; y < h - FRAME; y++) {
      for (let x = FRAME; x < w - FRAME; x++) if (g[y * w + x] > thr) mask[y * w + x] = 1;
    }
  }

  const kept = dropSmallComponents(mask, w, h);
  if (kept < Math.max(16, 0.001 * n)) return fallback();
  // bordas espalhadas pela foto inteira = textura (ruído, tecido, madeira), não o contorno de uma superfície
  if (!cutout && edgeCoverage(mask, w, h) > TEXTURE_COVERAGE) return fallback();

  // extremos nas diagonais (índices na varredura)
  let tl = -1; let tr = -1; let br = -1; let bl = -1;
  let sTl = Infinity; let sTr = -Infinity; let sBr = -Infinity; let sBl = Infinity;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!mask[y * w + x]) continue;
      const sum = x + y;
      const dif = x - y;
      if (sum < sTl) { sTl = sum; tl = y * w + x; }
      if (sum > sBr) { sBr = sum; br = y * w + x; }
      if (dif > sTr) { sTr = dif; tr = y * w + x; }
      if (dif < sBl) { sBl = dif; bl = y * w + x; }
    }
  }
  // alfa: o canto externo do pixel extremo (exato em forma alinhada); Sobel: o centro (a borda tem 1 px de cada lado)
  const kx = W / w;
  const ky = H / h;
  const at = (i: number, ox: number, oy: number): [number, number] => {
    const x = i % w;
    const y = (i - x) / w;
    return [Math.min(W, Math.max(0, (x + ox) * kx)), Math.min(H, Math.max(0, (y + oy) * ky))];
  };
  const quad: Quad = cutout
    ? [at(tl, 0, 0), at(tr, 1, 0), at(br, 1, 1), at(bl, 0, 1)]
    : [at(tl, 0.5, 0.5), at(tr, 0.5, 0.5), at(br, 0.5, 0.5), at(bl, 0.5, 0.5)];

  if (!quad.every(([x, y]) => Number.isFinite(x) && Number.isFinite(y)) || !isConvexQuad(quad)) return fallback();
  const frac = quadArea(quad) / (W * H);
  if (!(frac >= AREA_MIN && frac <= AREA_MAX)) return fallback();
  return { quad, method: cutout ? 'alpha' : 'sobel' };
}
