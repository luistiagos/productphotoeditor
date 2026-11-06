// Caixa 3D multi-face (TASK-19): a caixa girada em X/Y, projetada em perspectiva, com arte ou cor própria em cada face e
// luz fixa por face. Puro (só arrays `Pixels`, sem DOM), como o `mockupEngine` da TASK-08, cujas homografias e amostragem
// bilinear reusa. Implementação própria; o app de referência serviu só de especificação.
//
// Eixos: x para a direita, y PARA BAIXO (como o canvas), z para dentro da tela; câmera em (0, 0, −D) olhando para +z.
// Convenção que o usuário vê (travada nos testes): Rotação Y > 0 mostra a lateral DIREITA; Rotação X < 0 mostra o TOPO.
import { applyH, homographyFromQuads, type Pixels, type Pt, type Quad, sampleBilinear } from './mockupEngine';

export type FaceName = 'front' | 'back' | 'left' | 'right' | 'top' | 'bottom';
/** O que o usuário escolhe no estúdio: frente, lateral (esquerda/direita) e topo (a base usa o do topo). */
export type FaceSlot = 'front' | 'side' | 'top';
export const FACE_SLOTS: readonly FaceSlot[] = ['front', 'side', 'top'];

export interface BoxRatio { w: number; h: number; d: number }
export interface BoxParams {
  /** Graus; < 0 mostra o topo. */
  rotX: number;
  /** Graus; > 0 mostra a lateral direita. */
  rotY: number;
  boxRatio: BoxRatio;
  /** Campo de visão em graus: maior = câmera mais perto = mais perspectiva. */
  fov: number;
}
export interface Rect { x: number; y: number; w: number; h: number }

export interface BoxFace {
  name: FaceName;
  slot: FaceSlot;
  /** px do destino, cantos TL, TR, BR, BL da face vista de FORA (a arte cai em pé). */
  quad: Quad;
  /** Distância média dos 4 cantos à câmera (as faces vêm da mais funda para a mais próxima). */
  depth: number;
  /** Multiplicador de brilho da face. */
  light: number;
  /** Largura/altura da face em 3D (recorte "cover" da arte). */
  aspect: number;
}

export type BoxSource = { kind: 'color'; rgb: [number, number, number] } | { kind: 'art'; pixels: Pixels };

export const ROT_X_LIMIT = 60;
export const ROT_Y_LIMIT = 80;
export const RATIO_MIN = 0.2;
export const RATIO_MAX = 2;
export const FOV_MIN = 15;
export const FOV_MAX = 75;
export const BOX_DEFAULTS: Readonly<BoxParams> = { rotX: -20, rotY: 30, boxRatio: { w: 1, h: 1.3, d: 0.6 }, fov: 35 };

/** Luz por face (spec): frente 100 %, topo 108 %, laterais em sombra 78 %; a base (e o fundo, nunca visível) como lateral. */
export const FACE_LIGHT: Readonly<Record<FaceName, number>> = { front: 1, top: 1.08, left: 0.78, right: 0.78, bottom: 0.78, back: 0.78 };
export const FACE_SLOT: Readonly<Record<FaceName, FaceSlot>> = { front: 'front', back: 'side', left: 'side', right: 'side', top: 'top', bottom: 'top' };

type Sgn = -1 | 1;
/**
 * Cantos de cada face em sinais de (±meia-largura, ±meia-altura, ±meia-profundidade), na ordem TL, TR, BR, BL de quem
 * olha a face de fora: a lateral direita começa na aresta da frente; o topo tem a borda de baixo colada no alto da frente;
 * a base, a borda de cima colada no pé da frente. Assim (TR−TL)×(BL−TL) aponta para dentro em todas, e a área assinada
 * da projeção (y para baixo) é > 0 exatamente quando a face está voltada para a câmera.
 */
const CORNERS: Readonly<Record<FaceName, readonly [Sgn, Sgn, Sgn][]>> = {
  front: [[-1, -1, -1], [1, -1, -1], [1, 1, -1], [-1, 1, -1]],
  back: [[1, -1, 1], [-1, -1, 1], [-1, 1, 1], [1, 1, 1]],
  left: [[-1, -1, 1], [-1, -1, -1], [-1, 1, -1], [-1, 1, 1]],
  right: [[1, -1, -1], [1, -1, 1], [1, 1, 1], [1, 1, -1]],
  top: [[-1, -1, 1], [1, -1, 1], [1, -1, -1], [-1, -1, -1]],
  bottom: [[-1, 1, -1], [1, 1, -1], [1, 1, 1], [-1, 1, 1]],
};
const FACE_NAMES = Object.keys(CORNERS) as FaceName[];

const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);
const fin = (v: unknown, d: number) => (typeof v === 'number' && Number.isFinite(v) ? v : d);

/** Parâmetros dentro das faixas (valor ausente/NaN → padrão; proporção 0 → mínima): nunca produz caixa degenerada. */
export function normalizeBox(p: { rotX?: unknown; rotY?: unknown; boxRatio?: unknown; fov?: unknown } | null | undefined): BoxParams {
  const r = (p?.boxRatio ?? {}) as Partial<Record<keyof BoxRatio, unknown>>;
  const d = BOX_DEFAULTS;
  const ratio = (k: keyof BoxRatio) => clamp(fin(r[k], d.boxRatio[k]), RATIO_MIN, RATIO_MAX);
  return {
    rotX: clamp(fin(p?.rotX, d.rotX), -ROT_X_LIMIT, ROT_X_LIMIT),
    rotY: clamp(fin(p?.rotY, d.rotY), -ROT_Y_LIMIT, ROT_Y_LIMIT),
    boxRatio: { w: ratio('w'), h: ratio('h'), d: ratio('d') },
    fov: clamp(fin(p?.fov, d.fov), FOV_MIN, FOV_MAX),
  };
}

export function rectOfQuad(q: readonly Pt[]): Rect {
  const xs = q.map((p) => p[0]);
  const ys = q.map((p) => p[1]);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
}

/** Área assinada (fórmula do laço); com y para baixo, > 0 = cantos no sentido horário da tela = face de frente. */
export function signedArea(q: readonly Pt[]): number {
  let s = 0;
  for (let i = 0; i < q.length; i++) {
    const [x0, y0] = q[i];
    const [x1, y1] = q[(i + 1) % q.length];
    s += x0 * y1 - x1 * y0;
  }
  return s / 2;
}

/**
 * As faces VISÍVEIS da caixa, já em px do retângulo `rect` (a área de encaixe do template), da mais funda para a mais
 * próxima (ordem de pintura). A caixa é normalizada para meia-diagonal 1; a câmera fica a D = 1/sen(fov/2) do centro, de
 * modo que a esfera que envolve a caixa se projeta num disco de raio fixo, encaixado no menor lado do retângulo: a caixa
 * não muda de tamanho ao girar e nenhum vértice sai do retângulo em rotação alguma. Culling pela área assinada do quad
 * projetado (exato em perspectiva; a normal girada erra faces quase de perfil). Retângulo degenerado → [].
 */
export function boxFaces(params: BoxParams, rect: Rect): BoxFace[] {
  const p = normalizeBox(params);
  const { w, h, d } = p.boxRatio;
  const n = Math.hypot(w, h, d);
  const half = [w / n, h / n, d / n];
  const ay = (p.rotY * Math.PI) / 180;
  const ax = (p.rotX * Math.PI) / 180;
  const cy = Math.cos(ay);
  const sy = Math.sin(ay);
  const cx = Math.cos(ax);
  const sx = Math.sin(ax);
  const halfFov = (p.fov * Math.PI) / 360;
  const D = 1 / Math.sin(halfFov);
  const discR = D * Math.tan(halfFov); // raio do disco da esfera envolvente no plano de projeção (f = D)
  const k = Math.min(rect.w, rect.h) / (2 * discR);
  const ox = rect.x + rect.w / 2;
  const oy = rect.y + rect.h / 2;
  if (!(k > 0) || !Number.isFinite(k) || !Number.isFinite(ox) || !Number.isFinite(oy)) return [];

  const faces: BoxFace[] = [];
  for (const name of FACE_NAMES) {
    let depth = 0;
    const quad = CORNERS[name].map(([a, b, c]) => {
      const x = a * half[0];
      const y = b * half[1];
      const z = c * half[2];
      // giro horizontal (eixo y), depois inclinação (eixo x) com o sinal que põe o topo à vista em rotX < 0
      const x1 = x * cy + z * sy;
      const z1 = -x * sy + z * cy;
      const y2 = y * cx + z1 * sx;
      const zc = -y * sx + z1 * cx + D; // > 0: D > 1 ≥ distância de qualquer vértice ao centro
      depth += zc / 4;
      return [ox + (k * D * x1) / zc, oy + (k * D * y2) / zc] as Pt;
    }) as Quad;
    if (!(signedArea(quad) > 1e-9 * k * k)) continue;
    const aspect = name === 'left' || name === 'right' ? d / h : name === 'top' || name === 'bottom' ? w / d : w / h;
    faces.push({ name, slot: FACE_SLOT[name], quad, depth, light: FACE_LIGHT[name], aspect });
  }
  return faces.sort((f1, f2) => f2.depth - f1.depth);
}

/** Janela [u0, v0, u1, v1] (px da arte) do recorte "cover": a arte preenche a face sem deformar, cortando o excesso. */
export function coverWindow(artW: number, artH: number, faceAspect: number): [number, number, number, number] {
  const aa = artW / artH;
  if (!(faceAspect > 0) || !Number.isFinite(aa)) return [0, 0, artW, artH];
  if (aa > faceAspect) {
    const cw = artH * faceAspect;
    const u0 = (artW - cw) / 2;
    return [u0, 0, u0 + cw, artH];
  }
  const ch = artW / faceAspect;
  const v0 = (artH - ch) / 2;
  return [0, v0, artW, v0 + ch];
}

const UNIT: Quad = [[0, 0], [1, 0], [1, 1], [0, 1]];

/** Cor média (sobre branco) de uma arte, numa grade de amostras: a face quase de perfil sem homografia usa esta cor. */
function meanColor(src: Pixels): [number, number, number] {
  if (src.width <= 0 || src.height <= 0) return [255, 255, 255];
  const s = [0, 0, 0, 0];
  const acc = [0, 0, 0];
  const N = 8;
  for (let j = 0; j < N; j++) {
    for (let i = 0; i < N; i++) {
      sampleBilinear(src, clamp(((i + 0.5) / N) * src.width, 0.5, src.width - 0.5), clamp(((j + 0.5) / N) * src.height, 0.5, src.height - 0.5), s);
      for (let c = 0; c < 3; c++) acc[c] += s[c] + 255 - s[3];
    }
  }
  return [acc[0] / (N * N), acc[1] / (N * N), acc[2] / (N * N)];
}

/** Meia-faixa de antialias (0,5 px) + dilatação (0,5 px): na aresta comum a duas faces uma delas sempre cobre 100 %. */
const COVER_OFFSET = 1;

function paintFace(out: Uint8ClampedArray, W: number, H: number, f: BoxFace, src: BoxSource | undefined): void {
  const q = f.quad;
  if (!q.every(([x, y]) => Number.isFinite(x) && Number.isFinite(y))) return;
  // arestas como retas a·x + b·y + c = distância em px, > 0 para dentro (quad com área assinada > 0)
  const eq: number[] = [];
  for (let i = 0; i < 4; i++) {
    const [x0, y0] = q[i];
    const [x1, y1] = q[(i + 1) % 4];
    const len = Math.hypot(x1 - x0, y1 - y0);
    if (!(len > 1e-9)) return;
    const a = -(y1 - y0) / len;
    const b = (x1 - x0) / len;
    eq.push(a, b, -(a * x0 + b * y0));
  }
  const xs = q.map((p) => p[0]);
  const ys = q.map((p) => p[1]);
  const bx0 = clamp(Math.floor(Math.min(...xs)) - 1, 0, W);
  const bx1 = clamp(Math.ceil(Math.max(...xs)) + 1, 0, W);
  const by0 = clamp(Math.floor(Math.min(...ys)) - 1, 0, H);
  const by1 = clamp(Math.ceil(Math.max(...ys)) + 1, 0, H);

  const art = src?.kind === 'art' && src.pixels.width > 0 && src.pixels.height > 0 ? src.pixels : null;
  const inv = art ? homographyFromQuads(q, UNIT) : null;
  let flat: [number, number, number] = src?.kind === 'color' ? src.rgb : [255, 255, 255];
  if (art && !inv) flat = meanColor(art);
  let wSign = 1;
  let win: [number, number, number, number] = [0, 0, 1, 1];
  if (art && inv) {
    const mx = xs.reduce((s, v) => s + v, 0) / 4;
    const my = ys.reduce((s, v) => s + v, 0) / 4;
    wSign = Math.sign(inv[6] * mx + inv[7] * my + inv[8]) || 1;
    win = coverWindow(art.width, art.height, f.aspect);
  }
  const L = f.light;
  const s = [0, 0, 0, 0];
  for (let y = by0; y < by1; y++) {
    const py = y + 0.5;
    for (let x = bx0; x < bx1; x++) {
      const px = x + 0.5;
      let dmin = Infinity;
      for (let e = 0; e < 12; e += 3) dmin = Math.min(dmin, eq[e] * px + eq[e + 1] * py + eq[e + 2]);
      const cov = clamp(dmin + COVER_OFFSET, 0, 1);
      if (cov <= 0) continue;
      let r = flat[0];
      let g = flat[1];
      let b = flat[2];
      if (art && inv) {
        const wd = inv[6] * px + inv[7] * py + inv[8];
        if (wd * wSign <= 1e-12) continue; // além do horizonte do plano da face (só na franja de 1 px de uma face de perfil)
        const fa = clamp((inv[0] * px + inv[1] * py + inv[2]) / wd, 0, 1);
        const fb = clamp((inv[3] * px + inv[4] * py + inv[5]) / wd, 0, 1);
        // u, v presos meio pixel para dentro: o bilinear do motor trata vizinho fora da arte como transparente
        const u = clamp(win[0] + fa * (win[2] - win[0]), 0.5, art.width - 0.5);
        const v = clamp(win[1] + fb * (win[3] - win[1]), 0.5, art.height - 0.5);
        sampleBilinear(art, u, v, s);
        const white = 255 - s[3]; // arte transparente: o papelão da caixa é branco
        r = s[0] + white;
        g = s[1] + white;
        b = s[2] + white;
      }
      const o = (y * W + x) * 4;
      const k = 1 - cov;
      out[o] = r * L * cov + out[o] * k;
      out[o + 1] = g * L * cov + out[o + 1] * k;
      out[o + 2] = b * L * cov + out[o + 2] * k;
      out[o + 3] = 255 * cov + out[o + 3] * k;
    }
  }
}

/** Sombra de contato: elipse suave sob a silhueta (acompanha a rotação; o fundo do template não tem sombra pintada). */
function paintShadow(out: Uint8ClampedArray, W: number, H: number, faces: readonly BoxFace[], strength: number): void {
  let minX = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const f of faces) for (const [x, y] of f.quad) { minX = Math.min(minX, x); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y); }
  const sw = maxX - minX;
  if (!(sw > 0) || !Number.isFinite(sw) || !Number.isFinite(maxY)) return;
  const cx = (minX + maxX) / 2;
  const cy = maxY - 0.03 * sw;
  const rx = 0.62 * sw;
  const ry = 0.1 * sw;
  const x0 = clamp(Math.floor(cx - 2 * rx), 0, W);
  const x1 = clamp(Math.ceil(cx + 2 * rx), 0, W);
  const y0 = clamp(Math.floor(cy - 2 * ry), 0, H);
  const y1 = clamp(Math.ceil(cy + 2 * ry), 0, H);
  for (let y = y0; y < y1; y++) {
    const dy = (y + 0.5 - cy) / ry;
    for (let x = x0; x < x1; x++) {
      const dx = (x + 0.5 - cx) / rx;
      const f = 1 - strength * Math.exp(-2 * (dx * dx + dy * dy));
      const o = (y * W + x) * 4;
      out[o] *= f;
      out[o + 1] *= f;
      out[o + 2] *= f;
    }
  }
}

/**
 * Cópia da `base` com a caixa: sombra de contato (`shadow`, 0..1; padrão 0) e cada face visível pintada na ordem dada
 * (de trás para a frente), com a arte da face (recorte "cover" pela homografia da TASK-08, sobre branco) ou a cor
 * sólida, multiplicada pelo `light` da face — sem a fusão de luz da base (a base é fundo, não a superfície da caixa).
 * Sem faces, fonte ausente ou quad degenerado: não lança (a face sem fonte sai branca; a degenerada é pulada).
 */
export function renderBox(base: Pixels, faces: readonly BoxFace[], sources: Partial<Record<FaceSlot, BoxSource>>,
  opts: { shadow?: number } = {}): Pixels {
  const W = base.width;
  const H = base.height;
  const out = new Uint8ClampedArray(base.data);
  const result: Pixels = { data: out, width: W, height: H };
  if (faces.length === 0 || W <= 0 || H <= 0) return result;
  const shadow = clamp(fin(opts.shadow, 0), 0, 1);
  if (shadow > 0) paintShadow(out, W, H, faces, shadow);
  for (const f of faces) paintFace(out, W, H, f, sources[f.slot]);
  return result;
}

/** O ponto (s, t) ∈ [0,1]² da face (s ao longo de TL→TR, t ao longo de TL→BL), em px do destino. */
export function facePoint(f: BoxFace, s: number, t: number): Pt | null {
  const m = homographyFromQuads(UNIT, f.quad);
  return m ? applyH(m, s, t) : null;
}

// ---------- template ----------

export interface BoxTemplate {
  id: string;
  name: string;
  shape: 'box3d';
  /** Caminho relativo a `assets/content/` (`mockups3d/box.webp`). */
  file: string;
  thumb: string;
  width: number;
  height: number;
  /** Área de encaixe da caixa (o retângulo que a envolve), px da base. */
  quad: Quad;
  rotX: number;
  rotY: number;
  boxRatio: BoxRatio;
  fov: number;
}

const isPt = (p: unknown): p is Pt => Array.isArray(p) && p.length === 2 && p.every((v) => typeof v === 'number' && Number.isFinite(v));

/**
 * As entradas `shape: 'box3d'` de `content/mockups3d/index.json` (o `parseMockup3dIndex` da TASK-08 as descarta).
 * Entrada sem id/arquivo, sem tamanho ou com área de encaixe vazia fica de fora; parâmetros fora da faixa são presos.
 */
export function parseBoxTemplates(raw: unknown, folder = 'mockups3d'): BoxTemplate[] {
  const list = (raw as { mockups?: unknown } | null)?.mockups;
  if (!Array.isArray(list)) return [];
  const out: BoxTemplate[] = [];
  for (const e of list as Record<string, unknown>[]) {
    if (!e || typeof e !== 'object' || e.shape !== 'box3d') continue;
    if (typeof e.id !== 'string' || typeof e.file !== 'string') continue;
    const width = fin(e.width, 0);
    const height = fin(e.height, 0);
    if (width <= 0 || height <= 0 || !Array.isArray(e.quad) || e.quad.length !== 4 || !e.quad.every(isPt)) continue;
    const quad = (e.quad as Pt[]).map((p) => [p[0], p[1]] as Pt) as Quad;
    const r = rectOfQuad(quad);
    if (!(r.w > 0 && r.h > 0)) continue;
    const p = normalizeBox(e);
    out.push({
      id: e.id, name: typeof e.name === 'string' ? e.name : e.id, shape: 'box3d',
      file: `${folder}/${e.file}`, thumb: `${folder}/${typeof e.thumb === 'string' ? e.thumb : e.file}`,
      width, height, quad, ...p,
    });
  }
  return out;
}
