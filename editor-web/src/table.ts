/**
 * Tabelas de medidas e listas de preços no canvas (TASK-05). `TableData` é o dado bruto (gravado em `tableData` no Group,
 * para reeditar); `layoutTable` calcula colunas, linhas, retângulos e textos com uma função de medida injetada (no app,
 * `FabricText` com a fonte; no teste, uma medida falsa); `buildTable` monta o Group de `Rect` + `FabricText`.
 */
import { FabricText, Group, Rect } from 'fabric';
import { parseColor, relativeLuminance, rgbToHex } from './contrast';

export type TableStyle = 'header' | 'zebra' | 'grid' | 'minimal';
export type CellAlign = 'left' | 'center' | 'right';

/** Sem campo `type` (o `fromObject` do Fabric reviveria o objeto como classe registrada). */
export interface TableData {
  /** Linha 0 = cabeçalho. Retangular (todas as linhas com o mesmo número de colunas). */
  rows: string[][];
  style: TableStyle;
  headerBg: string;
  textColor: string;
  borderColor: string;
  fontFamily: string;
  /** Alinhamento por coluna (padrão: centro). */
  align?: CellAlign[];
  /** Tamanho da fonte em px do documento (padrão 32). */
  fontSize?: number;
}

export const TABLE_STYLES: [TableStyle, string][] = [
  ['header', 'Cabeçalho Destacado'], ['zebra', 'Linhas Zebradas'], ['grid', 'Grade Completa'], ['minimal', 'Minimalista'],
];

export type TableTemplateId = 'sizes' | 'shoes' | 'prices' | 'compare';
export const TABLE_TEMPLATES: [TableTemplateId, string][] = [
  ['sizes', '👕 Tabela de Medidas'], ['shoes', '👟 Numeração de Calçados'], ['prices', '📋 Lista de Preços'], ['compare', '⚖️ Comparativo'],
];

/** Tabela pronta, com as cores/fonte da marca quando houver. */
export function tableTemplate(id: TableTemplateId, kit: { primary?: string; text?: string; font?: string } = {}): TableData {
  const base = {
    headerBg: kit.primary ?? '#222222',
    textColor: kit.text ?? '#222222',
    borderColor: '#c8c8c8',
    fontFamily: kit.font ?? 'Montserrat',
  };
  switch (id) {
    case 'sizes':
      return { ...base, style: 'header', rows: [
        ['Tamanho', 'Largura', 'Comprimento'], ['P', '50 cm', '68 cm'], ['M', '52 cm', '70 cm'], ['G', '54 cm', '72 cm'], ['GG', '56 cm', '74 cm'],
      ] };
    case 'shoes':
      return { ...base, style: 'header', rows: [
        ['Nº Brasil', 'Palmilha (cm)'], ['34', '22,5'], ['35', '23,0'], ['36', '23,5'], ['37', '24,5'], ['38', '25,0'], ['39', '25,5'],
        ['40', '26,5'], ['41', '27,0'], ['42', '27,5'], ['43', '28,5'], ['44', '29,0'],
      ] };
    case 'prices':
      return { ...base, style: 'zebra', align: ['left', 'right'], rows: [
        ['Item / Serviço', 'Preço'], ['Camiseta básica', 'R$ 39,90'], ['Camiseta estampada', 'R$ 49,90'], ['Moletom', 'R$ 119,90'],
        ['Boné', 'R$ 29,90'],
      ] };
    case 'compare':
      return { ...base, style: 'grid', align: ['left', 'center', 'center'], rows: [
        ['', 'Nosso Produto', 'Comum'], ['Material', '✓ Premium', '✗ Básico'], ['Garantia', '✓ 12 meses', '✗ 3 meses'],
        ['Frete', '✓ Grátis', '✗ Pago'],
      ] };
  }
}

export function isTableData(x: unknown): x is TableData {
  if (typeof x !== 'object' || x === null) return false;
  const d = x as Record<string, unknown>;
  return Array.isArray(d.rows) && d.rows.length > 0 && d.rows.every((r) => Array.isArray(r) && r.every((c) => typeof c === 'string'))
    && TABLE_STYLES.some(([s]) => s === d.style) && typeof d.headerBg === 'string' && typeof d.textColor === 'string'
    && typeof d.borderColor === 'string' && typeof d.fontFamily === 'string';
}

export function columnCount(d: TableData): number {
  return Math.max(1, ...d.rows.map((r) => r.length));
}

/** Cópia retangular (linhas curtas completadas com vazio) e `align` do tamanho das colunas. */
export function normalizeTable(d: TableData): TableData {
  const cols = columnCount(d);
  const rows = (d.rows.length ? d.rows : [['']]).map((r) => Array.from({ length: cols }, (_, i) => r[i] ?? ''));
  const align = d.align ? Array.from({ length: cols }, (_, i) => d.align![i] ?? 'center') : undefined;
  return { ...d, rows, ...(align ? { align } : {}) };
}

/** Linha vazia em `at` (padrão: no fim). */
export function addRow(d: TableData, at = d.rows.length): TableData {
  const n = normalizeTable(d);
  const rows = n.rows.map((r) => [...r]);
  rows.splice(Math.max(0, Math.min(at, rows.length)), 0, new Array<string>(columnCount(n)).fill(''));
  return { ...n, rows };
}

/** Sem a linha `at` (padrão: a última); null se ficaria sem linhas. */
export function removeRow(d: TableData, at = d.rows.length - 1): TableData | null {
  const n = normalizeTable(d);
  if (n.rows.length <= 1 || at < 0 || at >= n.rows.length) return null;
  return { ...n, rows: n.rows.filter((_, i) => i !== at).map((r) => [...r]) };
}

/** Coluna vazia em `at` (padrão: no fim), centralizada. */
export function addColumn(d: TableData, at?: number): TableData {
  const n = normalizeTable(d);
  const i = Math.max(0, Math.min(at ?? columnCount(n), columnCount(n)));
  const rows = n.rows.map((r) => { const c = [...r]; c.splice(i, 0, ''); return c; });
  const align = n.align ? [...n.align] : undefined;
  align?.splice(i, 0, 'center');
  return { ...n, rows, ...(align ? { align } : {}) };
}

/** Sem a coluna `at` (padrão: a última); null se ficaria sem colunas. */
export function removeColumn(d: TableData, at?: number): TableData | null {
  const n = normalizeTable(d);
  const cols = columnCount(n);
  const i = at ?? cols - 1;
  if (cols <= 1 || i < 0 || i >= cols) return null;
  const rows = n.rows.map((r) => r.filter((_, k) => k !== i));
  const align = n.align?.filter((_, k) => k !== i);
  return { ...n, rows, ...(align ? { align } : {}) };
}

export function setCell(d: TableData, r: number, c: number, value: string): TableData {
  const n = normalizeTable(d);
  return { ...n, rows: n.rows.map((row, i) => (i === r ? row.map((v, k) => (k === c ? value : v)) : [...row])) };
}

// ---------- layout ----------

export interface FontSpec { family: string; size: number; weight: number }
export type Measure = (text: string, font: FontSpec) => number;

export type RectRole = 'bg' | 'header' | 'zebra' | 'hline' | 'vline';
export interface TableRect { role: RectRole; x: number; y: number; w: number; h: number; fill: string }
export interface TableText { text: string; row: number; col: number; x: number; y: number; align: CellAlign; fill: string; font: FontSpec }
export interface TableLayout {
  width: number;
  height: number;
  colWidths: number[];
  rowHeight: number;
  padX: number;
  lineWidth: number;
  rects: TableRect[];
  texts: TableText[];
}

/** `a` misturado com branco: `t` = fração de `a` (0..1). */
function tint(color: string, t: number): string {
  const c = parseColor(color) ?? { r: 34, g: 34, b: 34, a: 1 };
  const mix = (v: number) => v * t + 255 * (1 - t);
  return rgbToHex(mix(c.r), mix(c.g), mix(c.b));
}

/** Texto legível sobre o fundo do cabeçalho destacado. */
export function headerTextColor(bg: string): string {
  return relativeLuminance(bg) > 0.4 ? '#111111' : '#ffffff';
}

/**
 * Colunas = maior célula medida + 2·padding (mínimo 2 × fonte); linhas de altura única. Estilos:
 * - header: cabeçalho preenchido com `headerBg`, linhas horizontais entre as linhas e borda externa;
 * - zebra: linhas pares do corpo (2ª, 4ª…) com `headerBg` clareado, traço grosso sob o cabeçalho, sem grade;
 * - grid: grade completa (todas as horizontais e verticais);
 * - minimal: só linhas horizontais (nenhuma vertical, nem nas bordas).
 */
export function layoutTable(data: TableData, measure: Measure): TableLayout {
  const d = normalizeTable(data);
  const size = d.fontSize ?? 32;
  const padX = Math.round(size * 0.6);
  const padY = Math.round(size * 0.45);
  const lw = Math.max(1, Math.round(size * 0.06));
  const rowHeight = Math.round(size * 1.25) + 2 * padY;
  const cols = columnCount(d);
  const fontOf = (r: number): FontSpec => ({ family: d.fontFamily, size, weight: r === 0 ? 700 : 400 });
  const colWidths = Array.from({ length: cols }, (_, c) =>
    Math.ceil(Math.max(size * 2, ...d.rows.map((row, r) => measure(row[c] ?? '', fontOf(r)) + 2 * padX))));
  const width = colWidths.reduce((a, b) => a + b, 0);
  const height = rowHeight * d.rows.length;
  const colX = colWidths.map((_, i) => colWidths.slice(0, i).reduce((a, b) => a + b, 0));
  const rects: TableRect[] = [{ role: 'bg', x: 0, y: 0, w: width, h: height, fill: '#ffffff' }];
  const hline = (y: number, h = lw, fill = d.borderColor) => rects.push({ role: 'hline', x: 0, y: Math.min(Math.max(0, y - h / 2), height - h), w: width, h, fill });
  const vline = (x: number) => rects.push({ role: 'vline', x: Math.min(Math.max(0, x - lw / 2), width - lw), y: 0, w: lw, h: height, fill: d.borderColor });
  const R = d.rows.length;
  if (d.style === 'header') {
    rects.push({ role: 'header', x: 0, y: 0, w: width, h: rowHeight, fill: d.headerBg });
    for (let r = 0; r <= R; r++) hline(r * rowHeight);
    vline(0);
    vline(width);
  } else if (d.style === 'zebra') {
    for (let r = 2; r < R; r += 2) rects.push({ role: 'zebra', x: 0, y: r * rowHeight, w: width, h: rowHeight, fill: tint(d.headerBg, 0.14) });
    if (R > 1) hline(rowHeight, lw * 2, d.headerBg);
  } else if (d.style === 'grid') {
    for (let r = 0; r <= R; r++) hline(r * rowHeight);
    for (let c = 0; c <= cols; c++) vline(c === cols ? width : colX[c]);
  } else {
    for (let r = 0; r <= R; r++) hline(r * rowHeight);
  }
  const texts: TableText[] = [];
  d.rows.forEach((row, r) => row.forEach((text, c) => {
    if (!text) return;
    const align: CellAlign = d.align?.[c] ?? 'center';
    const x = align === 'left' ? colX[c] + padX : align === 'right' ? colX[c] + colWidths[c] - padX : colX[c] + colWidths[c] / 2;
    const fill = r === 0 && d.style === 'header' ? headerTextColor(d.headerBg) : d.textColor;
    texts.push({ text, row: r, col: c, x, y: r * rowHeight + rowHeight / 2, align, fill, font: fontOf(r) });
  }));
  return { width, height, colWidths, rowHeight, padX, lineWidth: lw, rects, texts };
}

/** As classes do Fabric (o teste passa as de `fabric/node`; o pacote `fabric` em Node não tem `document`). */
export interface FabricKit { Rect: typeof Rect; FabricText: typeof FabricText; Group: typeof Group }

/** Group de `Rect` (fundo, cabeçalho, zebra, linhas) + `FabricText` alinhados, na origem (0,0) da tabela. */
export function buildTable(data: TableData, measure: Measure, F: FabricKit = { Rect, FabricText, Group }): Group {
  const lay = layoutTable(data, measure);
  const objects = [
    ...lay.rects.map((r) => new F.Rect({ left: r.x, top: r.y, width: r.w, height: r.h, fill: r.fill, strokeWidth: 0, originX: 'left', originY: 'top' })),
    ...lay.texts.map((t) => new F.FabricText(t.text, {
      left: t.x, top: t.y, originX: t.align, originY: 'center', fill: t.fill,
      fontFamily: t.font.family, fontSize: t.font.size, fontWeight: t.font.weight,
    })),
  ];
  return new F.Group(objects, { originX: 'center', originY: 'center' });
}
