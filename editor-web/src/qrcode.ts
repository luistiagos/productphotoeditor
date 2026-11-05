/**
 * QR Code vetorial 100% offline (TASK-05): codificador ISO/IEC 18004 em modo byte (UTF-8), versões 1–40, correção de
 * erro L/M/Q/H com Reed-Solomon em GF(256), 8 máscaras com a penalidade das 4 regras, e o SVG estilizado que o editor
 * insere no canvas. Implementação própria; a conferência bit a bit é contra matrizes geradas fora do app
 * (`test/qr-reference.json`, receita no doc da task).
 */
import type { QrKind } from './qrPayloads';

export type QrEcc = 'L' | 'M' | 'Q' | 'H';
export const QR_ECC_LEVELS: QrEcc[] = ['L', 'M', 'Q', 'H'];

export interface QrMatrix {
  version: number;
  /** Módulos por lado (4·versão + 17). */
  size: number;
  ecc: QrEcc;
  mask: number;
  /** `modules[linha][coluna]`, true = escuro. */
  modules: boolean[][];
}

export interface EncodeOptions {
  ecc?: QrEcc;
  /** Máscara fixa 0–7; ausente = a de menor penalidade. */
  mask?: number;
  minVersion?: number;
}

export class QrTooLongError extends Error {}

// Tabelas da norma (Tabela 9): palavras de correção por bloco e número de blocos, por nível [L, M, Q, H] e versão (1..40;
// o índice 0 não é usado).
const EC_PER_BLOCK: Record<QrEcc, number[]> = {
  L: [0, 7, 10, 15, 20, 26, 18, 20, 24, 30, 18, 20, 24, 26, 30, 22, 24, 28, 30, 28, 28, 28, 28, 30, 30, 26, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
  M: [0, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26, 30, 22, 22, 24, 24, 28, 28, 26, 26, 26, 26, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28],
  Q: [0, 13, 22, 18, 26, 18, 24, 18, 22, 20, 24, 28, 26, 24, 20, 30, 24, 28, 28, 26, 30, 28, 30, 30, 30, 30, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
  H: [0, 17, 28, 22, 16, 22, 28, 26, 26, 24, 28, 24, 28, 22, 24, 24, 30, 28, 28, 26, 28, 30, 24, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
};
const NUM_BLOCKS: Record<QrEcc, number[]> = {
  L: [0, 1, 1, 1, 1, 1, 2, 2, 2, 2, 4, 4, 4, 4, 4, 6, 6, 6, 6, 7, 8, 8, 9, 9, 10, 12, 12, 12, 13, 14, 15, 16, 17, 18, 19, 19, 20, 21, 22, 24, 25],
  M: [0, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5, 5, 8, 9, 9, 10, 10, 11, 13, 14, 16, 17, 17, 18, 20, 21, 23, 25, 26, 28, 29, 31, 33, 35, 37, 38, 40, 43, 45, 47, 49],
  Q: [0, 1, 1, 2, 2, 4, 4, 6, 6, 8, 8, 8, 10, 12, 16, 12, 17, 16, 18, 21, 20, 23, 23, 25, 27, 29, 34, 34, 35, 38, 40, 43, 45, 48, 51, 53, 56, 59, 62, 65, 68],
  H: [0, 1, 1, 2, 4, 4, 4, 5, 6, 8, 8, 11, 11, 16, 16, 18, 16, 19, 21, 25, 25, 25, 34, 30, 32, 35, 37, 40, 42, 45, 48, 51, 54, 57, 60, 63, 66, 70, 74, 77, 81],
};
/** Bits do nível no campo de formato (norma: L=01, M=00, Q=11, H=10). */
const FORMAT_ECC_BITS: Record<QrEcc, number> = { L: 1, M: 0, Q: 3, H: 2 };

// ---------- GF(256), polinômio primitivo x^8 + x^4 + x^3 + x^2 + 1 (0x11D) ----------

const EXP = new Uint8Array(512);
const LOG = new Uint8Array(256);
{
  let x = 1;
  for (let i = 0; i < 255; i++) {
    EXP[i] = x;
    LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;
  }
  for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255];
}
const gfMul = (a: number, b: number): number => (a === 0 || b === 0 ? 0 : EXP[LOG[a] + LOG[b]]);

/** Gerador Π(x − αⁱ), i = 0..grau−1; coeficientes do maior grau para o menor (o 1º é sempre 1). */
function rsGenerator(degree: number): number[] {
  let g = [1];
  for (let i = 0; i < degree; i++) {
    const n = new Array<number>(g.length + 1).fill(0);
    for (let j = 0; j < g.length; j++) {
      n[j] ^= g[j];
      n[j + 1] ^= gfMul(g[j], EXP[i]);
    }
    g = n;
  }
  return g;
}

/** Resto da divisão de data·x^grau pelo gerador = as palavras de correção. */
function rsRemainder(data: ArrayLike<number>, gen: number[]): number[] {
  const degree = gen.length - 1;
  const rem = new Array<number>(degree).fill(0);
  for (let k = 0; k < data.length; k++) {
    const factor = data[k] ^ rem[0];
    rem.shift();
    rem.push(0);
    for (let i = 0; i < degree; i++) rem[i] ^= gfMul(gen[i + 1], factor);
  }
  return rem;
}

// ---------- capacidade ----------

/** Módulos disponíveis para dados + correção (sem os padrões de função), em bits. */
function rawDataModules(v: number): number {
  let r = (16 * v + 128) * v + 64;
  if (v >= 2) {
    const align = Math.floor(v / 7) + 2;
    r -= (25 * align - 10) * align - 55;
    if (v >= 7) r -= 36;
  }
  return r;
}

/** Palavras (bytes) de dados da versão/nível. */
export function dataCodewords(version: number, ecc: QrEcc): number {
  return Math.floor(rawDataModules(version) / 8) - EC_PER_BLOCK[ecc][version] * NUM_BLOCKS[ecc][version];
}

const countBits = (v: number): number => (v < 10 ? 8 : 16);

/** Centros dos padrões de alinhamento (mesma lista nas linhas e nas colunas). */
export function alignmentPositions(v: number): number[] {
  if (v === 1) return [];
  const n = Math.floor(v / 7) + 2;
  const size = v * 4 + 17;
  const step = v === 32 ? 26 : Math.ceil((v * 4 + 4) / (n * 2 - 2)) * 2;
  const out = [6];
  for (let pos = size - 7; out.length < n; pos -= step) out.splice(1, 0, pos);
  return out;
}

// ---------- codificação ----------

function dataBytes(bytes: Uint8Array, version: number, ecc: QrEcc): number[] {
  const bits: number[] = [];
  const push = (val: number, len: number) => { for (let i = len - 1; i >= 0; i--) bits.push((val >>> i) & 1); };
  push(0b0100, 4); // modo byte
  push(bytes.length, countBits(version));
  for (const b of bytes) push(b, 8);
  const capacity = dataCodewords(version, ecc) * 8;
  push(0, Math.min(4, capacity - bits.length)); // terminador
  while (bits.length % 8) bits.push(0);
  const out: number[] = [];
  for (let i = 0; i < bits.length; i += 8) out.push(bits.slice(i, i + 8).reduce((a, b) => (a << 1) | b, 0));
  for (let pad = 0xec; out.length < capacity / 8; pad ^= 0xec ^ 0x11) out.push(pad);
  return out;
}

/** Divide em blocos, calcula a correção de cada um e intercala (dados, depois correção). */
function withErrorCorrection(data: number[], version: number, ecc: QrEcc): number[] {
  const numBlocks = NUM_BLOCKS[ecc][version];
  const ecLen = EC_PER_BLOCK[ecc][version];
  const raw = Math.floor(rawDataModules(version) / 8);
  const numShort = numBlocks - (raw % numBlocks);
  const shortLen = Math.floor(raw / numBlocks);
  const gen = rsGenerator(ecLen);
  const blocks: number[][] = [];
  const ecs: number[][] = [];
  for (let i = 0, k = 0; i < numBlocks; i++) {
    const len = shortLen - ecLen + (i < numShort ? 0 : 1);
    const d = data.slice(k, k + len);
    k += len;
    blocks.push(d);
    ecs.push(rsRemainder(d, gen));
  }
  const out: number[] = [];
  const maxLen = shortLen - ecLen + 1;
  for (let i = 0; i < maxLen; i++) for (const b of blocks) if (i < b.length) out.push(b[i]);
  for (let i = 0; i < ecLen; i++) for (const e of ecs) out.push(e[i]);
  return out;
}

const MASKS: ((x: number, y: number) => boolean)[] = [
  (x, y) => (x + y) % 2 === 0,
  (_x, y) => y % 2 === 0,
  (x) => x % 3 === 0,
  (x, y) => (x + y) % 3 === 0,
  (x, y) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0,
  (x, y) => ((x * y) % 2) + ((x * y) % 3) === 0,
  (x, y) => (((x * y) % 2) + ((x * y) % 3)) % 2 === 0,
  (x, y) => (((x + y) % 2) + ((x * y) % 3)) % 2 === 0,
];

/** Matriz com padrões de função e dados ainda sem máscara (x = coluna, y = linha). */
class Builder {
  readonly size: number;
  readonly modules: boolean[][];
  readonly isFunction: boolean[][];

  constructor(readonly version: number, readonly ecc: QrEcc) {
    this.size = version * 4 + 17;
    this.modules = Array.from({ length: this.size }, () => new Array<boolean>(this.size).fill(false));
    this.isFunction = Array.from({ length: this.size }, () => new Array<boolean>(this.size).fill(false));
    this.drawFunctionPatterns();
  }

  private setFn(x: number, y: number, dark: boolean): void {
    this.modules[y][x] = dark;
    this.isFunction[y][x] = true;
  }

  private drawFunctionPatterns(): void {
    const n = this.size;
    for (let i = 0; i < n; i++) {
      this.setFn(6, i, i % 2 === 0);
      this.setFn(i, 6, i % 2 === 0);
    }
    this.drawFinder(3, 3);
    this.drawFinder(n - 4, 3);
    this.drawFinder(3, n - 4);
    const pos = alignmentPositions(this.version);
    const last = pos.length - 1;
    for (let i = 0; i <= last; i++) {
      for (let j = 0; j <= last; j++) {
        // os três cantos dos localizadores não levam alinhamento
        if ((i === 0 && j === 0) || (i === 0 && j === last) || (i === last && j === 0)) continue;
        this.drawAlignment(pos[i], pos[j]);
      }
    }
    this.drawFormat(0); // reserva; o valor final entra com a máscara
    this.drawVersion();
  }

  /** Localizador 7×7 + separador claro (o que cair fora da matriz é ignorado). */
  private drawFinder(cx: number, cy: number): void {
    for (let dy = -4; dy <= 4; dy++) {
      for (let dx = -4; dx <= 4; dx++) {
        const x = cx + dx, y = cy + dy;
        if (x < 0 || y < 0 || x >= this.size || y >= this.size) continue;
        const d = Math.max(Math.abs(dx), Math.abs(dy));
        this.setFn(x, y, d !== 2 && d !== 4);
      }
    }
  }

  private drawAlignment(cx: number, cy: number): void {
    for (let dy = -2; dy <= 2; dy++) {
      for (let dx = -2; dx <= 2; dx++) this.setFn(cx + dx, cy + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
    }
  }

  /** 15 bits: nível + máscara, BCH(15,5) com gerador 0x537, XOR 0x5412; duas cópias + o módulo escuro fixo. */
  drawFormat(mask: number): void {
    const data = (FORMAT_ECC_BITS[this.ecc] << 3) | mask;
    let rem = data;
    for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
    const bits = ((data << 10) | rem) ^ 0x5412;
    const bit = (i: number) => ((bits >>> i) & 1) === 1;
    const n = this.size;
    for (let i = 0; i <= 5; i++) this.setFn(8, i, bit(i));
    this.setFn(8, 7, bit(6));
    this.setFn(8, 8, bit(7));
    this.setFn(7, 8, bit(8));
    for (let i = 9; i < 15; i++) this.setFn(14 - i, 8, bit(i));
    for (let i = 0; i < 8; i++) this.setFn(n - 1 - i, 8, bit(i));
    for (let i = 8; i < 15; i++) this.setFn(8, n - 15 + i, bit(i));
    this.setFn(8, n - 8, true);
  }

  /** Versão ≥ 7: 18 bits (6 da versão + BCH(18,6) com gerador 0x1F25), em dois blocos 3×6. */
  private drawVersion(): void {
    if (this.version < 7) return;
    let rem = this.version;
    for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25);
    const bits = (this.version << 12) | rem;
    for (let i = 0; i < 18; i++) {
      const dark = ((bits >>> i) & 1) === 1;
      const a = this.size - 11 + (i % 3);
      const b = Math.floor(i / 3);
      this.setFn(a, b, dark);
      this.setFn(b, a, dark);
    }
  }

  /** Zigue-zague em pares de colunas, da direita para a esquerda, pulando a coluna 6 (temporização). */
  drawCodewords(codewords: number[]): void {
    const n = this.size;
    const total = codewords.length * 8;
    let i = 0;
    for (let right = n - 1; right >= 1; right -= 2) {
      if (right === 6) right = 5;
      const upward = ((right + 1) & 2) === 0;
      for (let vert = 0; vert < n; vert++) {
        const y = upward ? n - 1 - vert : vert;
        for (let j = 0; j < 2; j++) {
          const x = right - j;
          if (this.isFunction[y][x]) continue;
          if (i < total) this.modules[y][x] = ((codewords[i >>> 3] >>> (7 - (i & 7))) & 1) === 1;
          i++;
        }
      }
    }
  }

  /** Cópia com a máscara aplicada aos módulos de dados e o formato dessa máscara. */
  masked(mask: number): boolean[][] {
    const fn = MASKS[mask];
    this.drawFormat(mask);
    return this.modules.map((row, y) => row.map((dark, x) => (this.isFunction[y][x] ? dark : dark !== fn(x, y))));
  }
}

// ---------- penalidade (norma, 7.8.3) ----------

const FINDER_LIKE = [
  [1, 0, 1, 1, 1, 0, 1, 0, 0, 0, 0],
  [0, 0, 0, 0, 1, 0, 1, 1, 1, 0, 1],
];

function linePenalty(line: boolean[]): number {
  let score = 0;
  let run = 1;
  for (let i = 1; i <= line.length; i++) {
    if (i < line.length && line[i] === line[i - 1]) { run++; continue; }
    if (run >= 5) score += 3 + (run - 5);
    run = 1;
  }
  // 1:1:3:1:1 com 4 claros de um lado; fora da matriz conta como claro (zona de silêncio)
  const pad = [0, 0, 0, 0, ...line.map((d) => (d ? 1 : 0)), 0, 0, 0, 0];
  for (let i = 0; i + 11 <= pad.length; i++) {
    for (const p of FINDER_LIKE) if (p.every((v, k) => pad[i + k] === v)) score += 40;
  }
  return score;
}

/** Penalidade da matriz pelas 4 regras: sequências, blocos 2×2, padrões tipo localizador, proporção de escuros. */
export function penalty(modules: boolean[][]): number {
  const n = modules.length;
  let score = 0;
  for (let y = 0; y < n; y++) score += linePenalty(modules[y]);
  for (let x = 0; x < n; x++) score += linePenalty(modules.map((row) => row[x]));
  let dark = 0;
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      if (modules[y][x]) dark++;
      if (y < n - 1 && x < n - 1) {
        const c = modules[y][x];
        if (modules[y][x + 1] === c && modules[y + 1][x] === c && modules[y + 1][x + 1] === c) score += 3;
      }
    }
  }
  score += Math.floor(Math.abs((dark * 100) / (n * n) - 50) / 5) * 10;
  return score;
}

/** Codifica `text` (UTF-8, modo byte) na menor versão que cabe. Texto grande demais para a versão 40 → `QrTooLongError`. */
export function encodeQr(text: string, options: EncodeOptions = {}): QrMatrix {
  const ecc = options.ecc ?? 'M';
  const bytes = new TextEncoder().encode(text);
  let version = Math.max(1, Math.min(40, Math.floor(options.minVersion ?? 1)));
  for (; version <= 40; version++) {
    if (4 + countBits(version) + bytes.length * 8 <= dataCodewords(version, ecc) * 8) break;
  }
  if (version > 40) throw new QrTooLongError('Texto grande demais para um QR Code');
  const b = new Builder(version, ecc);
  b.drawCodewords(withErrorCorrection(dataBytes(bytes, version, ecc), version, ecc));
  let mask = options.mask;
  let modules: boolean[][];
  if (mask !== undefined && Number.isInteger(mask) && mask >= 0 && mask <= 7) {
    modules = b.masked(mask);
  } else {
    let best = Infinity;
    modules = [];
    for (let m = 0; m < 8; m++) {
      const cand = b.masked(m);
      const p = penalty(cand);
      if (p < best) { best = p; mask = m; modules = cand; }
    }
  }
  return { version, size: b.size, ecc, mask: mask!, modules };
}

// ---------- SVG estilizado ----------

export type DotStyle = 'square' | 'rounded' | 'dots';
export type EyeStyle = 'square' | 'rounded';
export const DOT_STYLES: [DotStyle, string][] = [['square', 'Quadrado'], ['rounded', 'Arredondado'], ['dots', 'Pontos']];
export const EYE_STYLES: [EyeStyle, string][] = [['square', 'Quadrado'], ['rounded', 'Arredondado']];

/** Unidades do SVG por módulo (números inteiros na maioria dos caminhos). */
export const QR_MODULE = 10;
/**
 * Raio dos cantos arredondados dos localizadores, em módulos (anel 7×7, furo 5×5, centro 3×3). O detector do OpenCV
 * (`tools/e2e/qr_decode.py`) acha o localizador pelos vértices: com raio externo 2 ou 1,5 não lê; varredura de 4 payloads
 * × 3 estilos de ponto × M/H × 5 variações (original, desfoque, 0,6×, 2×, 3×) lida pelo detector clássico: raio 1 → 80/120,
 * 0,5/0,25/0,25 → 105/120, cantos quadrados → 114/120 [[task-05-qrcode-vetorial-offline-e-tabelas-no-canvas]].
 */
export const EYE_ROUND = { outer: 0.5, hole: 0.25, center: 0.25 };
/**
 * Lado do buraco central do logo em fração do LADO da matriz (≈ 5% dos módulos, não 22% da área): com correção H
 * (30%) o código continua legível; medido no planejamento com OpenCV (versão 8, estilo pontos).
 */
export const LOGO_HOLE_FRACTION = 0.22;

export interface QrSvgOptions {
  dotStyle?: DotStyle;
  eyeStyle?: EyeStyle;
  fg?: string;
  bg?: string;
  /** Margem clara em módulos (padrão 2). */
  quietZone?: number;
  logoHole?: boolean;
  /** Texto da faixa inferior (moldura com legenda). */
  label?: string;
  labelFont?: string;
}

export interface QrLayout {
  /** Tamanho total do SVG em unidades (inclui margem e faixa da legenda). */
  width: number;
  height: number;
  /** Lado da área do QR (matriz + margem), em unidades. */
  side: number;
  /** Buraco do logo, em módulos da matriz (início inclusivo, fim exclusivo) e em unidades do SVG. */
  hole?: { start: number; end: number; x: number; y: number; w: number };
  label?: { y: number; h: number; fontSize: number };
}

/** Faixa de módulos do buraco central: ~22% do lado, com a mesma paridade do lado (fica exatamente centrado). */
export function logoHoleRange(size: number): { start: number; end: number } {
  let n = Math.ceil(size * LOGO_HOLE_FRACTION);
  if ((size - n) % 2 !== 0) n++;
  const start = (size - n) / 2;
  return { start, end: start + n };
}

export function qrLayout(size: number, opts: Pick<QrSvgOptions, 'quietZone' | 'logoHole' | 'label'> = {}): QrLayout {
  const U = QR_MODULE;
  const q = opts.quietZone ?? 2;
  const side = (size + 2 * q) * U;
  const out: QrLayout = { width: side, height: side, side };
  if (opts.logoHole) {
    const r = logoHoleRange(size);
    out.hole = { ...r, x: (r.start + q) * U, y: (r.start + q) * U, w: (r.end - r.start) * U };
  }
  const label = opts.label?.trim();
  if (label) {
    const band = Math.max(3, Math.round((size + 2 * q) * 0.16)) * U;
    out.label = { y: side, h: band, fontSize: Math.round(band * 0.42) };
    out.height = side + band;
  }
  return out;
}

const num = (v: number): string => String(Math.round(v * 100) / 100);

/** Retângulo (de cantos arredondados quando r > 0) como subcaminho; `ccw` inverte o sentido (vira furo no nonzero). */
function rectPath(x: number, y: number, w: number, h: number, r: number, ccw = false): string {
  if (r <= 0) {
    return ccw ? `M${num(x)} ${num(y)}v${num(h)}h${num(w)}v${num(-h)}z` : `M${num(x)} ${num(y)}h${num(w)}v${num(h)}h${num(-w)}z`;
  }
  const a = (dx: number, dy: number, sweep: number) => `a${num(r)} ${num(r)} 0 0 ${sweep} ${num(dx)} ${num(dy)}`;
  if (ccw) {
    return `M${num(x + r)} ${num(y)}${a(-r, r, 0)}v${num(h - 2 * r)}${a(r, r, 0)}h${num(w - 2 * r)}${a(r, -r, 0)}v${num(-(h - 2 * r))}${a(-r, -r, 0)}z`;
  }
  return `M${num(x + r)} ${num(y)}h${num(w - 2 * r)}${a(r, r, 1)}v${num(h - 2 * r)}${a(-r, r, 1)}h${num(-(w - 2 * r))}${a(-r, -r, 1)}v${num(-(h - 2 * r))}${a(r, -r, 1)}z`;
}

function dotPath(x: number, y: number, style: DotStyle): string {
  const U = QR_MODULE;
  if (style === 'dots') {
    const r = U * 0.45;
    const cx = x + U / 2, cy = y + U / 2;
    return `M${num(cx - r)} ${num(cy)}a${num(r)} ${num(r)} 0 1 0 ${num(2 * r)} 0a${num(r)} ${num(r)} 0 1 0 ${num(-2 * r)} 0z`;
  }
  return rectPath(x, y, U, U, style === 'rounded' ? U * 0.3 : 0);
}

/** Módulo dentro de um dos três localizadores 7×7 (desenhados à parte, no estilo dos cantos). */
export function inFinder(r: number, c: number, size: number): boolean {
  return (r < 7 && c < 7) || (r < 7 && c >= size - 7) || (r >= size - 7 && c < 7);
}

function escapeXml(s: string): string {
  return s.replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[ch]!);
}

/**
 * SVG do QR: `<rect>` de fundo + um `<path>` com os módulos de dados (um subcaminho por módulo escuro, fora dos
 * localizadores e do buraco do logo) + um `<path>` com os 3 localizadores + faixa da legenda (`<rect>` + `<text>`). Sem
 * `defs`/`clipPath`/`use`: o parser do Fabric ignora o que fica dentro deles.
 */
export function qrSvg(m: QrMatrix, opts: QrSvgOptions = {}): string {
  const U = QR_MODULE;
  const q = opts.quietZone ?? 2;
  const fg = opts.fg ?? '#111111';
  const bg = opts.bg ?? '#ffffff';
  const dotStyle = opts.dotStyle ?? 'square';
  const lay = qrLayout(m.size, opts);
  const hole = lay.hole;
  const inHole = (r: number, c: number) => !!hole && r >= hole.start && r < hole.end && c >= hole.start && c < hole.end;
  const dots: string[] = [];
  for (let r = 0; r < m.size; r++) {
    for (let c = 0; c < m.size; c++) {
      if (!m.modules[r][c] || inFinder(r, c, m.size) || inHole(r, c)) continue;
      dots.push(dotPath((c + q) * U, (r + q) * U, dotStyle));
    }
  }
  const rounded = opts.eyeStyle === 'rounded';
  const eyes: string[] = [];
  for (const [r, c] of [[0, 0], [0, m.size - 7], [m.size - 7, 0]]) {
    const x = (c + q) * U, y = (r + q) * U;
    eyes.push(rectPath(x, y, 7 * U, 7 * U, rounded ? EYE_ROUND.outer * U : 0));
    eyes.push(rectPath(x + U, y + U, 5 * U, 5 * U, rounded ? EYE_ROUND.hole * U : 0, true));
    eyes.push(rectPath(x + 2 * U, y + 2 * U, 3 * U, 3 * U, rounded ? EYE_ROUND.center * U : 0));
  }
  const parts = [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${lay.width} ${lay.height}" width="${lay.width}" height="${lay.height}">`,
    `<rect x="0" y="0" width="${lay.width}" height="${lay.height}" fill="${escapeXml(bg)}" stroke-width="0"/>`,
  ];
  if (dots.length) parts.push(`<path d="${dots.join('')}" fill="${escapeXml(fg)}" stroke-width="0"/>`);
  parts.push(`<path d="${eyes.join('')}" fill="${escapeXml(fg)}" stroke-width="0"/>`);
  if (lay.label) {
    const font = escapeXml(opts.labelFont ?? 'Montserrat');
    parts.push(`<rect x="0" y="${lay.label.y}" width="${lay.width}" height="${lay.label.h}" fill="${escapeXml(fg)}" stroke-width="0"/>`);
    parts.push(`<text x="${num(lay.width / 2)}" y="${num(lay.label.y + lay.label.h / 2 + lay.label.fontSize * 0.35)}" text-anchor="middle" `
      + `font-family="${font}" font-weight="700" font-size="${lay.label.fontSize}" fill="${escapeXml(bg)}">${escapeXml(opts.label!.trim())}</text>`);
  }
  parts.push('</svg>');
  return parts.join('');
}

// ---------- metadados no objeto do canvas ----------

/**
 * O que o grupo do QR guarda em `qrConfig` (CUSTOM_PROPERTIES) para ser reeditado. Sem campo `type`: o `fromObject` do
 * Fabric reviveria o objeto como classe registrada (achado da TASK-12).
 */
export interface QrConfig {
  kind: QrKind;
  /** Campos do formulário do modo (url, phone, message, key, name, city, amount, pasted, ssid, password, auth, pixMode). */
  fields: Record<string, string>;
  /** Texto codificado. */
  payload: string;
  ecc: QrEcc;
  dotStyle: DotStyle;
  eyeStyle: EyeStyle;
  fgColor: string;
  bgColor: string;
  label?: string;
  withLogo: boolean;
}

export function isQrConfig(x: unknown): x is QrConfig {
  if (typeof x !== 'object' || x === null) return false;
  const c = x as Record<string, unknown>;
  return ['link', 'whatsapp', 'pix', 'wifi'].includes(c.kind as string) && typeof c.payload === 'string'
    && typeof c.fields === 'object' && c.fields !== null && QR_ECC_LEVELS.includes(c.ecc as QrEcc)
    && typeof c.fgColor === 'string' && typeof c.bgColor === 'string';
}
