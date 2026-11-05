import { describe, expect, it } from 'vitest';
import { Group, Rect } from 'fabric/node';
import { fitSlot } from '../src/imageGeometry';
import { CUSTOM_PROPERTIES } from '../src/document';

describe('fitSlot (trocar foto no mesmo espaço)', () => {
  it('contain: foto inteira dentro do espaço, sem recorte', () => {
    // espaço 400×300; foto nova 1000×1000 → escala 0,3 → 300×300 visível
    expect(fitSlot(400, 300, 1000, 1000, 'contain')).toEqual({ width: 1000, height: 1000, scaleX: 0.3, scaleY: 0.3, cropX: 0, cropY: 0 });
  });

  it('cover: preenche exatamente o espaço e recorta o excesso no centro', () => {
    const g = fitSlot(400, 300, 1000, 1000, 'cover');
    expect(g.scaleX).toBeCloseTo(0.4);
    expect(g.width * g.scaleX).toBeCloseTo(400);
    expect(g.height * g.scaleY).toBeCloseTo(300);
    expect(g.cropX).toBeCloseTo(0);
    expect(g.cropY).toBeCloseTo((1000 - 750) / 2);
  });

  it('cover com foto mais larga recorta nas laterais', () => {
    const g = fitSlot(300, 300, 1200, 600, 'cover');
    expect(g.width * g.scaleX).toBeCloseTo(300);
    expect(g.height * g.scaleY).toBeCloseTo(300);
    expect(g.cropX).toBeCloseTo(300);
    expect(g.cropY).toBeCloseTo(0);
  });
});

describe('Fabric Group (premissas do agrupar/desagrupar)', () => {
  const box = (o: Rect) => { o.setCoords(); const r = o.getBoundingRect(); return [r.left, r.top, r.width, r.height].map(Math.round); };

  it('new Group recebe filhos em coordenadas de cena; removeAll devolve as mesmas caixas', () => {
    const a = new Rect({ left: 100, top: 100, width: 50, height: 40, originX: 'center', originY: 'center' });
    const b = new Rect({ left: 300, top: 220, width: 80, height: 60, angle: 30, originX: 'center', originY: 'center' });
    const before = [box(a), box(b)];
    const g = new Group([a, b], { originX: 'center', originY: 'center' });
    const gb = g.getBoundingRect();
    expect(Math.round(gb.left)).toBe(before[0][0]);
    // mover o grupo move os dois juntos
    g.set({ left: g.left + 10, top: g.top - 5 });
    g.setCoords();
    const items = g.removeAll() as Rect[];
    expect(items.map(box)).toEqual(before.map(([l, t, w, h]) => [l + 10, t - 5, w, h]));
    expect(items.every((o) => o.group === undefined)).toBe(true);
  });

  it('a trava é propriedade customizada (sai no JSON)', () => {
    expect(CUSTOM_PROPERTIES).toContain('locked');
  });
});
