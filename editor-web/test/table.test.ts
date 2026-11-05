import { describe, expect, it } from 'vitest';
import { Group, Rect } from 'fabric/node';
import {
  addColumn, addRow, buildTable, headerTextColor, isTableData, layoutTable, type Measure, normalizeTable, removeColumn, removeRow,
  setCell, type TableData, tableTemplate, TABLE_TEMPLATES,
} from '../src/table';

/** Medida falsa determinística: 0,5 × fonte por caractere (+10% em negrito). */
const fake: Measure = (text, f) => text.length * f.size * 0.5 * (f.weight >= 700 ? 1.1 : 1);
const base = (rows: string[][], style: TableData['style'] = 'grid'): TableData =>
  ({ rows, style, headerBg: '#c2185b', textColor: '#222222', borderColor: '#cccccc', fontFamily: 'Montserrat' });

describe('layoutTable', () => {
  it('largura de cada coluna = maior célula medida + 2·padding; altura = linhas × altura da linha', () => {
    const d = base([['Tamanho', 'Largura'], ['P', '50 cm'], ['GG', 'muito largo aqui']]);
    const lay = layoutTable(d, fake);
    const pad = lay.padX;
    expect(lay.colWidths[0]).toBe(Math.ceil(Math.max(64, 7 * 16 * 1.1 + 2 * pad)));
    expect(lay.colWidths[1]).toBe(Math.ceil(16 * 16 + 2 * pad));
    expect(lay.width).toBe(lay.colWidths[0] + lay.colWidths[1]);
    expect(lay.height).toBe(3 * lay.rowHeight);
  });
  it('coluna estreita fica com o mínimo de 2 × fonte', () => {
    const lay = layoutTable({ ...base([['a']]), fontSize: 40 }, fake);
    expect(lay.colWidths[0]).toBe(80);
  });
  it('zebra: só as linhas alternadas do corpo (2ª, 4ª…), nunca o cabeçalho', () => {
    const lay = layoutTable(base([['h', 'h'], ['1', 'a'], ['2', 'b'], ['3', 'c'], ['4', 'd'], ['5', 'e']], 'zebra'), fake);
    const ys = lay.rects.filter((r) => r.role === 'zebra').map((r) => r.y / lay.rowHeight);
    expect(ys).toEqual([2, 4]);
    expect(lay.rects.some((r) => r.role === 'vline')).toBe(false);
  });
  it('minimal: só horizontais (uma por divisa, inclusive topo e base), nenhuma vertical', () => {
    const lay = layoutTable(base([['a', 'b', 'c'], ['1', '2', '3'], ['4', '5', '6']], 'minimal'), fake);
    expect(lay.rects.filter((r) => r.role === 'vline')).toEqual([]);
    const h = lay.rects.filter((r) => r.role === 'hline');
    expect(h.length).toBe(4);
    for (const r of h) { expect(r.h).toBe(lay.lineWidth); expect(r.w).toBe(lay.width); }
  });
  it('grid: todas as horizontais e verticais, dentro da caixa', () => {
    const lay = layoutTable(base([['a', 'b', 'c'], ['1', '2', '3']], 'grid'), fake);
    expect(lay.rects.filter((r) => r.role === 'hline').length).toBe(3);
    expect(lay.rects.filter((r) => r.role === 'vline').length).toBe(4);
    for (const r of lay.rects) {
      expect(r.x).toBeGreaterThanOrEqual(0);
      expect(r.y).toBeGreaterThanOrEqual(0);
      expect(r.x + r.w).toBeLessThanOrEqual(lay.width);
      expect(r.y + r.h).toBeLessThanOrEqual(lay.height);
    }
  });
  it('cabeçalho destacado: fundo do cabeçalho na cor da marca e texto legível sobre ele', () => {
    const lay = layoutTable(base([['Tamanho', 'Largura'], ['P', '50']], 'header'), fake);
    const head = lay.rects.find((r) => r.role === 'header')!;
    expect(head).toMatchObject({ x: 0, y: 0, w: lay.width, h: lay.rowHeight, fill: '#c2185b' });
    expect(lay.texts.filter((t) => t.row === 0).every((t) => t.fill === '#ffffff' && t.font.weight === 700)).toBe(true);
    expect(lay.texts.filter((t) => t.row === 1).every((t) => t.fill === '#222222' && t.font.weight === 400)).toBe(true);
    expect(headerTextColor('#ffeb3b')).toBe('#111111');
  });
  it('alinhamento: esquerda no padding, direita na borda direita da coluna − padding, centro no meio', () => {
    const d = { ...base([['Item', 'Preço', 'x'], ['Camiseta', 'R$ 39,90', 'y']]), align: ['left', 'right', 'center'] as const };
    const lay = layoutTable({ ...d, align: [...d.align] }, fake);
    const t = (r: number, c: number) => lay.texts.find((x) => x.row === r && x.col === c)!;
    expect(t(1, 0).x).toBe(lay.padX);
    expect(t(1, 1).x).toBe(lay.colWidths[0] + lay.colWidths[1] - lay.padX);
    expect(t(1, 2).x).toBe(lay.colWidths[0] + lay.colWidths[1] + lay.colWidths[2] / 2);
    expect(t(1, 1).y).toBe(lay.rowHeight * 1.5);
  });
  it('célula vazia não gera texto', () => {
    expect(layoutTable(base([['', 'a']]), fake).texts.map((t) => t.text)).toEqual(['a']);
  });
});

describe('operações de linha/coluna', () => {
  const d = { ...base([['a', 'b'], ['c', 'd']]), align: ['left' as const, 'right' as const] };
  it('+ linha / + coluna com células vazias, sem mutar a entrada', () => {
    const snapshot = JSON.stringify(d);
    expect(addRow(d).rows).toEqual([['a', 'b'], ['c', 'd'], ['', '']]);
    expect(addRow(d, 1).rows).toEqual([['a', 'b'], ['', ''], ['c', 'd']]);
    const c = addColumn(d);
    expect(c.rows).toEqual([['a', 'b', ''], ['c', 'd', '']]);
    expect(c.align).toEqual(['left', 'right', 'center']);
    expect(setCell(d, 1, 0, 'X').rows).toEqual([['a', 'b'], ['X', 'd']]);
    expect(JSON.stringify(d)).toBe(snapshot);
  });
  it('− linha / − coluna; remover a última linha ou coluna é recusado (null)', () => {
    expect(removeRow(d)!.rows).toEqual([['a', 'b']]);
    expect(removeColumn(d)!.rows).toEqual([['a'], ['c']]);
    expect(removeColumn(d)!.align).toEqual(['left']);
    expect(removeRow(base([['a', 'b']]))).toBeNull();
    expect(removeColumn(base([['a'], ['b']]))).toBeNull();
  });
  it('normalizeTable completa linhas curtas', () => {
    expect(normalizeTable(base([['a', 'b', 'c'], ['d']])).rows).toEqual([['a', 'b', 'c'], ['d', '', '']]);
  });
});

describe('templates e serialização', () => {
  it('medidas: cabeçalho Tamanho | Largura | Comprimento + P/M/G/GG, com a cor da marca no cabeçalho', () => {
    const t = tableTemplate('sizes', { primary: '#c2185b' });
    expect(t.rows[0]).toEqual(['Tamanho', 'Largura', 'Comprimento']);
    expect(t.rows.slice(1).map((r) => r[0])).toEqual(['P', 'M', 'G', 'GG']);
    expect(t.style).toBe('header');
    expect(t.headerBg).toBe('#c2185b');
  });
  it('lista de preços: 2 colunas, preço à direita; os 4 templates são TableData válidos', () => {
    const p = tableTemplate('prices');
    expect(p.align).toEqual(['left', 'right']);
    expect(p.rows.every((r) => r.length === 2)).toBe(true);
    for (const [id] of TABLE_TEMPLATES) expect(isTableData(tableTemplate(id))).toBe(true);
    expect(tableTemplate('compare').rows[0].length).toBe(3);
  });
  it('TableData sobrevive a JSON e não tem campo `type`', () => {
    const t = tableTemplate('sizes');
    expect(JSON.parse(JSON.stringify(t))).toEqual(t);
    expect('type' in t).toBe(false);
    expect(isTableData({ ...t, style: 'neon' })).toBe(false);
    expect(isTableData({ ...t, rows: [] })).toBe(false);
  });
});

describe('buildTable (Fabric real)', () => {
  // o `fabric/node` daqui não mede texto (sem o pacote `canvas`): o texto é um Rect com `text`; a medida real vai no E2E
  class StubText extends Rect {
    text: string;
    constructor(text: string, opts: Record<string, unknown>) { super({ ...opts, width: 1, height: 1 }); this.text = text; }
  }
  it('Group de Rect + textos com o tamanho do layout, cada texto na âncora do alinhamento', () => {
    const d = tableTemplate('prices');
    const g = buildTable(d, fake, { Rect, FabricText: StubText, Group } as unknown as Parameters<typeof buildTable>[2]);
    const lay = layoutTable(d, fake);
    const objs = g.getObjects();
    const texts = objs.filter((o): o is StubText => o instanceof StubText);
    expect(objs.length - texts.length).toBe(lay.rects.length);
    expect(texts.map((t) => t.text)).toEqual(lay.texts.map((t) => t.text));
    expect(texts.map((t) => t.originX)).toEqual(lay.texts.map((t) => t.align));
    expect(g.width).toBeCloseTo(lay.width, 0);
    expect(g.height).toBeCloseTo(lay.height, 0);
  });
});
