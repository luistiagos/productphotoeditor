import { describe, expect, it } from 'vitest';
import { averageColor, contrastRatio, formatRatio, normalizeHex, parseColor, relativeLuminance, suggestReadableColor } from '../src/contrast';
import { collectColors, dominantColors, RecentColors, RECENT_COLORS_KEY } from '../src/palette';
import { pixelHex } from '../src/eyedropper';

describe('contraste WCAG', () => {
  it('luminância relativa dos extremos', () => {
    expect(relativeLuminance('#ffffff')).toBeCloseTo(1, 6);
    expect(relativeLuminance('#000000')).toBe(0);
  });

  it('branco contra preto = 21:1; mesma cor = 1:1', () => {
    expect(contrastRatio('#ffffff', '#000000')).toBeCloseTo(21, 6);
    expect(contrastRatio('#3b6fd8', '#3b6fd8')).toBeCloseTo(1, 6);
  });

  it('cinza médio contra branco (valor de referência WCAG #777777 ≈ 4,48)', () => {
    expect(contrastRatio('#777777', '#ffffff')).toBeCloseTo(4.48, 2);
    expect(formatRatio(contrastRatio('#777777', '#ffffff'))).toBe('4.4:1');
  });

  it('amarelo claro sobre branco fica abaixo de 3:1', () => {
    expect(contrastRatio('#fff176', '#ffffff')).toBeLessThan(3);
  });

  it('parseColor e normalizeHex aceitam #rgb, rgba() e nomes', () => {
    expect(parseColor('#abc')).toEqual({ r: 0xaa, g: 0xbb, b: 0xcc, a: 1 });
    expect(parseColor('rgba(0, 0, 0, 0.5)')).toEqual({ r: 0, g: 0, b: 0, a: 0.5 });
    expect(normalizeHex('White')).toBe('#ffffff');
    expect(normalizeHex('transparent')).toBeNull();
    expect(normalizeHex('url(#x)')).toBeNull();
  });

  it('média compõe pixels transparentes sobre branco', () => {
    expect(averageColor([{ r: 0, g: 0, b: 0, a: 1 }, { r: 0, g: 0, b: 0, a: 0 }])).toEqual({ r: 128, g: 128, b: 128, a: 1 });
  });

  it('sugestão: cor da marca legível vence; sem ela, branco ou preto', () => {
    const brand = [{ color: '#ffeb3b', role: 'accent' }, { color: '#0d47a1', role: 'primary' }];
    expect(suggestReadableColor('#ffffff', brand)).toMatchObject({ color: '#0d47a1', role: 'primary' });
    expect(suggestReadableColor('#ffffff', [{ color: '#ffeb3b' }]).color).toBe('#111111');
    expect(suggestReadableColor('#101010').color).toBe('#ffffff');
    expect(suggestReadableColor('#ffffff').ratio).toBeGreaterThanOrEqual(4.5);
  });
});

describe('paleta do documento', () => {
  it('coleta fill/stroke/marca-texto/degradê e grupos, sem repetir e sem invisíveis', () => {
    const objs = [
      { fill: '#FF0000', stroke: 'rgb(0,0,255)' },
      { fill: '#ff0000', textBackgroundColor: '#fff176' },
      { visible: false, fill: '#123456' },
      { fill: { colorStops: [{ color: '#00ff00' }, { color: 'rgba(0,0,0,0)' }] } },
      { getObjects: () => [{ fill: '#abcdef' }, { fill: 'none' }] },
      { type: 'image', fill: 'rgb(0,0,0)' },
    ];
    expect(collectColors(objs, '#ffffff')).toEqual(['#ffffff', '#ff0000', '#0000ff', '#fff176', '#00ff00', '#abcdef']);
  });

  it('cores dominantes ignoram transparência e juntam tons parecidos', () => {
    const w = 4, h = 4;
    const data = new Uint8ClampedArray(w * h * 4);
    for (let i = 0; i < w * h; i++) {
      const px = i < 10 ? [200, 20, 20, 255] : i < 12 ? [205, 25, 22, 255] : i < 14 ? [20, 20, 200, 255] : [0, 255, 0, 0];
      data.set(px, i * 4);
    }
    const cs = dominantColors(data, w, h, 4);
    expect(cs).toHaveLength(2);
    expect(cs[1]).toBe('#1414c8');
    // 1 pixel azul em 16 (6 %) é mistura de borda: fica de fora com o mínimo padrão de 8 %
    const few = new Uint8ClampedArray(16 * 4);
    for (let i = 0; i < 16; i++) few.set(i === 0 ? [20, 20, 200, 255] : [200, 20, 20, 255], i * 4);
    expect(dominantColors(few, 4, 4)).toHaveLength(1);
  });

  it('recentes: mais nova primeiro, sem repetição, até 8, persistidas', () => {
    const mem: Record<string, string> = {};
    const store = { getItem: (k: string) => mem[k] ?? null, setItem: (k: string, v: string) => { mem[k] = v; } };
    const r = new RecentColors(store);
    for (let i = 0; i < 10; i++) r.add(`#00000${i}`);
    r.add('#000003');
    expect(r.colors[0]).toBe('#000003');
    expect(r.colors).toHaveLength(8);
    expect(new RecentColors(store).colors).toEqual(r.colors);
    expect(JSON.parse(mem[RECENT_COLORS_KEY])).toEqual(r.colors);
    expect(new RecentColors(null).colors).toEqual([]);
  });

  it('armazenamento corrompido não quebra', () => {
    const r = new RecentColors({ getItem: () => '{nope', setItem: () => { throw new Error('cheio'); } });
    r.add('#ff0000');
    expect(r.colors).toEqual(['#ff0000']);
  });
});

describe('conta-gotas', () => {
  it('lê o pixel e compõe a transparência sobre branco', () => {
    const img = { width: 2, height: 1, data: [255, 0, 0, 255, 0, 0, 0, 0] };
    expect(pixelHex(img, 0, 0)).toBe('#ff0000');
    expect(pixelHex(img, 1.7, 0.2)).toBe('#ffffff');
    expect(pixelHex(img, 2, 0)).toBeNull();
    expect(pixelHex(img, -1, 0)).toBeNull();
  });
});
