import { describe, expect, it } from 'vitest';
import { Gradient, Group, Path, Rect } from 'fabric/node';
import {
  addStop, brandGradient, buildFabricGradient, evenStops, GRADIENT_PRESETS, gradientCoords, gradientCss, type GradientSpec,
  MAX_STOPS, normalizeSpec, removeStop, reverseStops,
} from '../src/gradients';
import { capPaths, capSize, connectorGeometry, type ConnectorSpec, dashArrayFor, swapEnds } from '../src/connectors';
import { CUSTOM_PROPERTIES } from '../src/document';

const lin = (angle: number, colors = ['#000000', '#ffffff']): GradientSpec => ({ kind: 'linear', angle, stops: evenStops(colors) });

describe('gradientCoords (pixels, relativo ao canto da caixa)', () => {
  it('0° vai da borda esquerda à direita no meio da altura', () => {
    expect(gradientCoords(lin(0), 200, 100)).toEqual({ x1: 0, y1: 50, x2: 200, y2: 50 });
  });
  it('90° vai de cima para baixo', () => {
    expect(gradientCoords(lin(90), 200, 100)).toEqual({ x1: 100, y1: 0, x2: 100, y2: 100 });
  });
  it('180° inverte o 0°; 360 = 0; -90 = 270', () => {
    expect(gradientCoords(lin(180), 200, 100)).toEqual({ x1: 200, y1: 50, x2: 0, y2: 50 });
    expect(gradientCoords(lin(360), 200, 100)).toEqual(gradientCoords(lin(0), 200, 100));
    expect(gradientCoords(lin(-90), 200, 100)).toEqual({ x1: 100, y1: 100, x2: 100, y2: 0 });
  });
  it('45° num quadrado: meia-projeção (|cos|·w + |sin|·h)/2, simétrico ao centro, cobre os cantos opostos', () => {
    const c = gradientCoords(lin(45), 100, 100) as { x1: number; y1: number; x2: number; y2: number };
    const half = (Math.SQRT1_2 * 100 + Math.SQRT1_2 * 100) / 2;
    expect(c.x1).toBeCloseTo(50 - Math.SQRT1_2 * half, 2);
    expect(c.y1).toBeCloseTo(50 - Math.SQRT1_2 * half, 2);
    expect(c.x1 + c.x2).toBeCloseTo(100, 2);
    // a projeção do canto (0,0) no eixo do degradê cai no início (t = 0)
    expect(c.x1).toBeCloseTo(0, 2);
    expect(c.y2).toBeCloseTo(100, 2);
  });
  it('radial: centrado, r2 = 0,7 × maior lado', () => {
    expect(gradientCoords({ kind: 'radial', angle: 0, stops: evenStops(['#000000', '#ffffff']) }, 200, 100))
      .toEqual({ x1: 100, y1: 50, x2: 100, y2: 50, r1: 0, r2: 140 });
  });
  it('buildFabricGradient monta Gradient em pixels com as paradas ordenadas', () => {
    const g = buildFabricGradient({ kind: 'linear', angle: 90, stops: [{ offset: 1, color: '#ffffff' }, { offset: 0, color: '#000000' }] }, 10, 20);
    expect(g.type).toBe('linear');
    expect(g.gradientUnits).toBe('pixels');
    expect(g.coords).toMatchObject({ x1: 5, y1: 0, x2: 5, y2: 20 });
    expect(g.colorStops.map((s) => s.color)).toEqual(['#000000', '#ffffff']);
  });
  it('customGradient volta como objeto simples ao reviver (com `type: linear` o Fabric o transformaria em Gradient)', async () => {
    const spec = lin(45);
    const base = new Rect({ width: 10, height: 20, fill: buildFabricGradient(spec, 10, 20) }).toObject();
    const ok = await Rect.fromObject({ ...base, customGradient: spec });
    expect(ok.get('customGradient')).toEqual(spec);
    // premissa (enlivenObjectEnlivables): o formato antigo com `type` vira uma instância de Gradient e perde os dados
    const bad = await Rect.fromObject({ ...base, customGradient: { type: 'linear', angle: 45, stops: spec.stops } });
    expect(bad.get('customGradient')).toBeInstanceOf(Gradient);
  });
  it('Gradient sobrevive a toObject/fromObject num Rect (undo/rascunho)', async () => {
    const r = new Rect({ width: 10, height: 20, fill: buildFabricGradient(lin(90), 10, 20) });
    const back = await Rect.fromObject(r.toObject());
    expect((back.fill as { coords: unknown }).coords).toMatchObject({ x1: 5, y1: 0, x2: 5, y2: 20 });
  });
});

describe('paradas', () => {
  it('inverter espelha os offsets e mantém a ordem', () => {
    const r = reverseStops(lin(0, ['#ff0000', '#00ff00', '#0000ff']));
    expect(r.stops).toEqual([{ offset: 0, color: '#0000ff' }, { offset: 0.5, color: '#00ff00' }, { offset: 1, color: '#ff0000' }]);
  });
  it('+ Cor entra no maior vão, até 5', () => {
    let s = lin(0);
    s = addStop(s);
    expect(s.stops.map((x) => x.offset)).toEqual([0, 0.5, 1]);
    for (let i = 0; i < 5; i++) s = addStop(s);
    expect(s.stops.length).toBe(MAX_STOPS);
  });
  it('remover não desce de 2', () => {
    const s = lin(0, ['#000000', '#888888', '#ffffff']);
    expect(removeStop(s, 1).stops.length).toBe(2);
    expect(removeStop(removeStop(s, 1), 0).stops.length).toBe(2);
  });
  it('normalizeSpec prende offsets e completa até 2 paradas', () => {
    const n = normalizeSpec({ kind: 'linear', angle: 400, stops: [{ offset: 1.5, color: '#123456' }] });
    expect(n.angle).toBe(40);
    expect(n.stops).toEqual([{ offset: 1, color: '#123456' }, { offset: 1, color: '#123456' }]);
  });
  it('presets: Ouro Metálico com as 3 cores da spec; Marca usa primária → destaque', () => {
    expect(GRADIENT_PRESETS[0].spec.stops.map((s) => s.color)).toEqual(['#bf953f', '#fcf6ba', '#b38728']);
    expect(brandGradient({ primary: '#111111', accent: '#eeeeee' })?.spec.stops.map((s) => s.color)).toEqual(['#111111', '#eeeeee']);
    expect(brandGradient({ primary: '#111111' })).toBeNull();
  });
  it('gradientCss converte o ângulo (0° nosso = 90deg CSS)', () => {
    expect(gradientCss(lin(0))).toBe('linear-gradient(90deg, #000000 0%, #ffffff 100%)');
    expect(gradientCss({ ...lin(0), kind: 'radial' })).toBe('radial-gradient(circle, #000000 0%, #ffffff 100%)');
  });
});

describe('tracejado', () => {
  it('tracejada 3w/2w, pontilhada w/2w, sólida sem tracejado', () => {
    expect(dashArrayFor('dashed', 4)).toEqual([12, 8]);
    expect(dashArrayFor('dotted', 4)).toEqual([4, 8]);
    expect(dashArrayFor('solid', 4)).toBeNull();
  });
});

const spec = (p: Partial<ConnectorSpec>): ConnectorSpec => ({
  x1: 0, y1: 0, x2: 100, y2: 0, shape: 'straight', startCap: 'none', endCap: 'none', color: '#000000', width: 4, dash: 'solid', ...p,
});
const nums = (d: string) => (d.match(/-?\d+(\.\d+)?/g) ?? []).map(Number);

describe('connectorGeometry', () => {
  it('reta sem pontas: M a L b', () => {
    const g = connectorGeometry(spec({}));
    expect(g.line).toBe('M 0 0 L 100 0');
    expect(g.caps).toEqual([]);
    expect(g.endDir).toEqual({ x: 1, y: 0 });
    expect(g.startDir).toEqual({ x: -1, y: 0 });
  });
  it('seta no fim: triângulo com a ponta no ponto final; a linha recua sob a seta', () => {
    const s = capSize(4); // 14
    const g = connectorGeometry(spec({ endCap: 'arrow' }));
    expect(g.caps).toHaveLength(1);
    expect(g.caps[0].filled).toBe(true);
    expect(g.caps[0].d).toBe(`M 100 0 L ${100 - s} ${s * 0.6} L ${100 - s} ${-s * 0.6} Z`);
    expect(g.line).toBe(`M 0 0 L ${100 - s * 0.6} 0`);
  });
  it('cota: barras perpendiculares nas duas pontas (não preenchidas)', () => {
    const g = connectorGeometry(spec({ startCap: 'bar', endCap: 'bar' }));
    expect(g.caps.map((c) => c.filled)).toEqual([false, false]);
    const [x1a, , x1b] = nums(g.caps[0].d);
    const [x2a, , x2b] = nums(g.caps[1].d);
    expect([x1a, x1b]).toEqual([0, 0]);
    expect([x2a, x2b]).toEqual([100, 100]);
  });
  it('cotovelo: horizontal a partir do início, depois vertical; direções das pontas', () => {
    const g = connectorGeometry(spec({ shape: 'elbow', x2: 100, y2: 60 }));
    expect(g.line).toBe('M 0 0 L 100 0 L 100 60');
    expect(g.startDir).toEqual({ x: -1, y: 0 });
    expect(g.endDir).toEqual({ x: 0, y: 1 });
  });
  it('cotovelo alinhado vira reta', () => {
    expect(connectorGeometry(spec({ shape: 'elbow' })).line).toBe('M 0 0 L 100 0');
  });
  it('curva: Q com controle à esquerda do sentido (acima, no canvas, para uma linha →)', () => {
    const g = connectorGeometry(spec({ shape: 'curve', bend: 0.5 }));
    expect(g.line).toBe('M 0 0 Q 50 -50 100 0');
    expect(g.endDir.x).toBeCloseTo(Math.SQRT1_2);
    expect(g.endDir.y).toBeCloseTo(Math.SQRT1_2);
  });
  it('pino (ring) = ponto preenchido + anel contornado; losango centrado', () => {
    const ring = capPaths('ring', { x: 10, y: 10 }, { x: 1, y: 0 }, 20);
    expect(ring.map((c) => c.filled)).toEqual([true, false]);
    const dia = capPaths('diamond', { x: 0, y: 0 }, { x: 1, y: 0 }, 10);
    expect(dia[0].d).toBe('M 6 0 L 0 4 L -6 0 L 0 -4 Z');
  });
  it('inverter pontas', () => {
    expect(swapEnds(spec({ startCap: 'dot', endCap: 'arrow' }))).toMatchObject({ startCap: 'arrow', endCap: 'dot' });
  });
  it('premissa do Fabric real: Paths de coordenadas absolutas ficam no lugar e o Group envolve os pontos', () => {
    const geo = connectorGeometry(spec({ x1: 300, y1: 200, x2: 500, y2: 200, startCap: 'bar', endCap: 'arrow' }));
    const parts = [new Path(geo.line, { stroke: '#000', strokeWidth: 4, fill: '' }), ...geo.caps.map((c) => new Path(c.d, { fill: '#000' }))];
    const g = new Group(parts, { originX: 'center', originY: 'center' });
    g.setCoords();
    const b = g.getBoundingRect();
    expect(b.left).toBeLessThanOrEqual(300);
    expect(b.left + b.width).toBeGreaterThanOrEqual(500);
    expect(g.getCenterPoint().y).toBeCloseTo(200, 0);
  });
  it('TASK-12 em CUSTOM_PROPERTIES', () => {
    for (const k of ['customGradient', 'strokeDashStyle', 'shapeKind', 'connectorSpec']) expect(CUSTOM_PROPERTIES).toContain(k);
  });
});
