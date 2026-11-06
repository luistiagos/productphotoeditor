import { describe, expect, it } from 'vitest';
import { Circle, Ellipse, Group, Line, Path, Polygon, Polyline, Rect, Triangle } from 'fabric/node';
import {
  booleanOp, booleanRegions, type BooleanOp, isBooleanShapeType, type Ring, ringsArea, ringsBounds, ringsToPathD,
  shapeRegion, shapeToPolygonRings, signedRingArea,
} from '../src/pathBoolean';

const sq = (x: number, y: number, w: number, h: number): Ring[] => [[{ x, y }, { x: x + w, y }, { x: x + w, y: y + h }, { x, y: y + h }]];
const area = (a: Ring[], b: Ring[], op: BooleanOp) => ringsArea(booleanOp(a, b, op));
/** Dentro de ±0,5% do valor da fórmula (critério do planejamento). */
const near = (got: number, want: number) => expect(Math.abs(got - want)).toBeLessThanOrEqual(Math.abs(want) * 0.005 + 1e-6);
const centered = { originX: 'center' as const, originY: 'center' as const, strokeWidth: 0 };

describe('booleanOp entre quadrados (casos degenerados)', () => {
  it('sobrepostos: as 4 operações com a área exata', () => {
    const A = sq(0, 0, 10, 10), B = sq(5, 5, 10, 10);
    expect(area(A, B, 'union')).toBeCloseTo(175, 9);
    expect(area(A, B, 'intersect')).toBeCloseTo(25, 9);
    expect(area(A, B, 'subtract')).toBeCloseTo(75, 9);
    expect(area(A, B, 'exclude')).toBeCloseTo(150, 9);
    expect(booleanOp(A, B, 'union')).toHaveLength(1);
    expect(booleanOp(A, B, 'union')[0]).toHaveLength(8);
    expect(booleanOp(A, B, 'exclude')).toHaveLength(2);
  });

  it('disjuntos: união com 2 anéis, interseção vazia', () => {
    const A = sq(0, 0, 10, 10), B = sq(20, 0, 10, 10);
    expect(booleanOp(A, B, 'union')).toHaveLength(2);
    expect(area(A, B, 'union')).toBeCloseTo(200, 9);
    expect(booleanOp(A, B, 'intersect')).toEqual([]);
    expect(area(A, B, 'subtract')).toBeCloseTo(100, 9);
    expect(area(A, B, 'exclude')).toBeCloseTo(200, 9);
  });

  it('contido: subtrair e vazado dão anel com furo; o de dentro menos o de fora é vazio', () => {
    const A = sq(0, 0, 10, 10), B = sq(2, 2, 6, 6);
    expect(area(A, B, 'union')).toBeCloseTo(100, 9);
    expect(area(A, B, 'intersect')).toBeCloseTo(36, 9);
    for (const op of ['subtract', 'exclude'] as const) {
      const r = booleanOp(A, B, op);
      expect(r).toHaveLength(2);
      expect(ringsArea(r)).toBeCloseTo(64, 9);
      // o externo e o furo têm sentidos opostos (vale para evenodd e nonzero)
      expect(Math.sign(signedRingArea(r[0]))).toBe(-Math.sign(signedRingArea(r[1])));
    }
    expect(booleanOp(B, A, 'subtract')).toEqual([]);
  });

  it('aresta comum: a união é um retângulo só (4 vértices), a interseção é vazia', () => {
    const A = sq(0, 0, 10, 10), B = sq(10, 0, 10, 10);
    const u = booleanOp(A, B, 'union');
    expect(u).toHaveLength(1);
    expect(u[0]).toHaveLength(4);
    expect(ringsArea(u)).toBeCloseTo(200, 9);
    expect(booleanOp(A, B, 'intersect')).toEqual([]);
    expect(area(A, B, 'subtract')).toBeCloseTo(100, 9);
    expect(area(A, B, 'exclude')).toBeCloseTo(200, 9);
  });

  it('aresta comum parcial (junção T) e trecho colinear', () => {
    const A = sq(0, 0, 10, 10), B = sq(10, 3, 10, 4);
    expect(area(A, B, 'union')).toBeCloseTo(140, 9);
    expect(booleanOp(A, B, 'union')).toHaveLength(1);
    const C = sq(5, 0, 10, 10); // base e topo colineares, sobrepostos em 5..10
    expect(area(A, C, 'union')).toBeCloseTo(150, 9);
    expect(area(A, C, 'intersect')).toBeCloseTo(50, 9);
    expect(area(A, C, 'exclude')).toBeCloseTo(100, 9);
  });

  it('vértice comum: 2 anéis que se tocam num ponto', () => {
    const A = sq(0, 0, 10, 10), B = sq(10, 10, 10, 10);
    expect(booleanOp(A, B, 'union')).toHaveLength(2);
    expect(area(A, B, 'union')).toBeCloseTo(200, 9);
    expect(booleanOp(A, B, 'intersect')).toEqual([]);
    expect(area(A, B, 'exclude')).toBeCloseTo(200, 9);
  });

  it('formas idênticas: união = interseção = a forma; subtrair e vazado = vazio', () => {
    const A = sq(0, 0, 10, 10);
    expect(area(A, sq(0, 0, 10, 10), 'union')).toBeCloseTo(100, 9);
    expect(area(A, sq(0, 0, 10, 10), 'intersect')).toBeCloseTo(100, 9);
    expect(booleanOp(A, sq(0, 0, 10, 10), 'subtract')).toEqual([]);
    expect(booleanOp(A, sq(0, 0, 10, 10), 'exclude')).toEqual([]);
  });

  it('anel de sentido inverso dá o mesmo resultado (nonzero)', () => {
    const A = sq(0, 0, 10, 10), B: Ring[] = [sq(5, 5, 10, 10)[0].slice().reverse()];
    expect(area(A, B, 'union')).toBeCloseTo(175, 9);
    expect(area(A, B, 'subtract')).toBeCloseTo(75, 9);
  });
});

describe('formas do Fabric → anéis de página', () => {
  it('Rect girado e escalado: vértices de página', () => {
    const r = new Rect({ ...centered, left: 200, top: 100, width: 100, height: 50, angle: 90, scaleX: 2 });
    const b = ringsBounds(shapeToPolygonRings(r))!;
    expect(b.left).toBeCloseTo(175, 6);
    expect(b.top).toBeCloseTo(0, 6);
    expect(b.width).toBeCloseTo(50, 6);
    expect(b.height).toBeCloseTo(200, 6);
  });

  it('Rect com canto arredondado: área = w·h − (4 − π)·r²', () => {
    const r = new Rect({ ...centered, left: 0, top: 0, width: 300, height: 200, rx: 40, ry: 40 });
    near(ringsArea(shapeToPolygonRings(r)), 300 * 200 - (4 - Math.PI) * 40 * 40);
  });

  it('Circle, Ellipse, Triangle e meio círculo (startAngle/endAngle)', () => {
    near(ringsArea(shapeToPolygonRings(new Circle({ ...centered, radius: 120, left: 300, top: 300 }))), Math.PI * 120 * 120);
    near(ringsArea(shapeToPolygonRings(new Circle({ ...centered, radius: 120, scaleX: 2 }))), Math.PI * 240 * 120);
    near(ringsArea(shapeToPolygonRings(new Ellipse({ ...centered, rx: 150, ry: 80 }))), Math.PI * 150 * 80);
    near(ringsArea(shapeToPolygonRings(new Triangle({ ...centered, width: 200, height: 174 }))), 200 * 174 / 2);
    near(ringsArea(shapeToPolygonRings(new Circle({ ...centered, radius: 120, startAngle: 0, endAngle: 180 }))), Math.PI * 120 * 120 / 2);
  });

  it('o erro do achatamento fica abaixo de 0,5 px (todo vértice do círculo no raio; meio das cordas a ≤ 0,5 px)', () => {
    const ring = shapeToPolygonRings(new Circle({ ...centered, radius: 400, left: 500, top: 500 }))[0];
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i], b = ring[(i + 1) % ring.length];
      expect(Math.hypot(a.x - 500, a.y - 500)).toBeCloseTo(400, 6);
      expect(400 - Math.hypot((a.x + b.x) / 2 - 500, (a.y + b.y) / 2 - 500)).toBeLessThanOrEqual(0.5);
    }
  });

  it('Polygon com pathOffset: os vértices voltam onde foram desenhados', () => {
    const pts = [{ x: 10, y: 10 }, { x: 110, y: 10 }, { x: 60, y: 90 }];
    const ring = shapeToPolygonRings(new Polygon(pts, { strokeWidth: 0 }))[0];
    ring.forEach((p, i) => { expect(p.x).toBeCloseTo(pts[i].x, 6); expect(p.y).toBeCloseTo(pts[i].y, 6); });
    const moved = shapeToPolygonRings(new Polygon(pts, { strokeWidth: 0, left: 500, top: 400, originX: 'center', originY: 'center' }))[0];
    const b = ringsBounds([moved])!;
    expect(b.left + b.width / 2).toBeCloseTo(500, 6);
    expect(b.top + b.height / 2).toBeCloseTo(400, 6);
  });

  it('Path com curvas (arco do SVG vira cúbica): área do círculo e vários subcaminhos', () => {
    const circle = new Path('M 200 100 A 100 100 0 1 1 0 100 A 100 100 0 1 1 200 100 Z', { strokeWidth: 0 });
    const rings = shapeToPolygonRings(circle);
    expect(rings).toHaveLength(1);
    near(ringsArea(rings), Math.PI * 100 * 100);
    const b = ringsBounds(rings)!;
    expect(b.left).toBeCloseTo(0, 1);
    expect(b.width).toBeCloseTo(200, 1);
    const two = new Path('M 0 0 L 10 0 L 10 10 Z M 20 0 L 30 0 Q 30 10 20 10 Z', { strokeWidth: 0 });
    expect(shapeToPolygonRings(two)).toHaveLength(2);
  });

  it('tipos aceitos: forma fechada sim; linha, polilinha, texto e grupo não', () => {
    for (const o of [new Rect(), new Circle(), new Ellipse(), new Triangle(), new Polygon([]), new Path('M 0 0 L 1 1')]) {
      expect(isBooleanShapeType(o)).toBe(true);
    }
    // texto: o Textbox não mede no jsdom (sem canvas); o filtro só olha o `type`
    const text = { type: 'textbox', calcTransformMatrix: () => [1, 0, 0, 1, 0, 0] };
    for (const o of [new Line([0, 0, 1, 1]), new Polyline([]), text, new Group([])]) {
      expect(isBooleanShapeType(o)).toBe(false);
      expect(shapeToPolygonRings(o as never)).toEqual([]);
    }
  });
});

describe('formas do editor combinadas (o que o applyBooleanOp faz)', () => {
  // retângulo 400×400 em [300,700]² e círculo r=120 centrado na borda esquerda (300,500): metade dele dentro
  const rect = () => new Rect({ ...centered, left: 500, top: 500, width: 400, height: 400 });
  const circ = (x = 300) => new Circle({ ...centered, left: x, top: 500, radius: 120 });
  const half = (Math.PI * 120 * 120) / 2;

  it('quadrado × círculo: as 4 operações contra a fórmula (±0,5%)', () => {
    const A = shapeRegion(rect()), B = shapeRegion(circ());
    near(ringsArea(booleanRegions([A, B], 'union')), 160000 + half);
    near(ringsArea(booleanRegions([A, B], 'intersect')), half);
    near(ringsArea(booleanRegions([A, B], 'subtract')), 160000 - half);
    near(ringsArea(booleanRegions([A, B], 'exclude')), 160000);
  });

  it('cupom: retângulo menos 2 círculos nas pontas (N formas: base − união das demais)', () => {
    const regions = [rect(), circ(300), circ(700)].map((o) => shapeRegion(o));
    near(ringsArea(booleanRegions(regions, 'subtract')), 160000 - 2 * half);
    near(ringsArea(booleanRegions(regions, 'union')), 160000 + 2 * half);
    expect(booleanRegions(regions, 'intersect')).toEqual([]); // os 2 círculos não se tocam
  });

  it('o d do resultado num Path com origem center desenha no mesmo lugar (round-trip da colocação)', () => {
    const rings = booleanRegions([shapeRegion(rect()), shapeRegion(circ())], 'subtract');
    const p = new Path(ringsToPathD(rings), { originX: 'center', originY: 'center', fillRule: 'evenodd', strokeWidth: 3 });
    const back = shapeToPolygonRings(p);
    const b0 = ringsBounds(rings)!, b1 = ringsBounds(back)!;
    for (const k of ['left', 'top', 'width', 'height'] as const) expect(b1[k]).toBeCloseTo(b0[k], 2);
    near(ringsArea(back), ringsArea(rings));
    expect(shapeRegion(p).fillRule).toBe('evenodd');
  });

  it('o resultado com furo (evenodd) serve de operando de novo: unir o miolo tapa o furo', () => {
    const ringWithHole = booleanOp(sq(0, 0, 10, 10), sq(2, 2, 6, 6), 'exclude');
    const p = new Path(ringsToPathD(ringWithHole), { originX: 'center', originY: 'center', fillRule: 'evenodd', strokeWidth: 0 });
    const back = shapeRegion(p);
    expect(ringsArea(booleanRegions([back, { rings: sq(2, 2, 6, 6), fillRule: 'nonzero' }], 'union'))).toBeCloseTo(100, 6);
    expect(ringsArea(booleanRegions([back, { rings: sq(4, 4, 2, 2), fillRule: 'nonzero' }], 'intersect'))).toBeCloseTo(0, 6);
  });

  it('formas aleatórias giradas: |A∪B| + |A∩B| = |A| + |B|, |A−B| = |A| − |A∩B|, |A⊕B| = |A∪B| − |A∩B|', () => {
    let seed = 16;
    const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
    const shape = () => {
      const k = Math.floor(rnd() * 4);
      const base = { ...centered, left: 300 + rnd() * 400, top: 300 + rnd() * 400, angle: rnd() * 360, scaleX: 0.5 + rnd() * 1.5 };
      if (k === 0) return new Rect({ ...base, width: 50 + rnd() * 300, height: 50 + rnd() * 300, rx: rnd() * 40, ry: rnd() * 40 });
      if (k === 1) return new Circle({ ...base, radius: 30 + rnd() * 200 });
      if (k === 2) return new Triangle({ ...base, width: 60 + rnd() * 300, height: 60 + rnd() * 300 });
      return new Polygon([{ x: 0, y: -100 }, { x: 30, y: -30 }, { x: 100, y: 0 }, { x: 30, y: 30 }, { x: 0, y: 100 }, { x: -30, y: 30 },
        { x: -100, y: 0 }, { x: -30, y: -30 }], { ...base });
    };
    for (let i = 0; i < 60; i++) {
      const A = shapeRegion(shape()), B = shapeRegion(shape());
      const a = ringsArea(booleanRegions([A], 'union')), b = ringsArea(booleanRegions([B], 'union'));
      const u = ringsArea(booleanRegions([A, B], 'union')), n = ringsArea(booleanRegions([A, B], 'intersect'));
      const s = ringsArea(booleanRegions([A, B], 'subtract')), x = ringsArea(booleanRegions([A, B], 'exclude'));
      const tol = (a + b) * 1e-6;
      expect(Math.abs(u + n - (a + b))).toBeLessThanOrEqual(tol);
      expect(Math.abs(s - (a - n))).toBeLessThanOrEqual(tol);
      expect(Math.abs(x - (u - n))).toBeLessThanOrEqual(tol);
    }
  });

  it('círculo tangente à borda do retângulo por fora: a união soma as áreas, a interseção é vazia', () => {
    const A = shapeRegion(rect()), B = shapeRegion(circ(700 + 120));
    const c = ringsArea(booleanRegions([B], 'union'));
    expect(ringsArea(booleanRegions([A, B], 'union'))).toBeCloseTo(160000 + c, 3);
    expect(ringsArea(booleanRegions([A, B], 'intersect'))).toBeCloseTo(0, 3);
  });

  it('ringsToPathD: um M … Z por anel, números com até 3 casas', () => {
    expect(ringsToPathD([[{ x: 0, y: 0 }, { x: 1.23456, y: 0 }, { x: 1, y: 1 }]])).toBe('M 0 0 L 1.235 0 L 1 1 Z');
    expect(ringsToPathD([])).toBe('');
  });
});
