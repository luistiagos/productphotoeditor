import { describe, expect, it } from 'vitest';
import { FabricImage, FabricObject, filters, Rect } from 'fabric/node';
import {
  BLEND_MODES, brandDuotone, compactFilterAdjust, duotoneMatrix, DUOTONE_PRESETS, hexToRgb01, isBlendMode, parseFilterAdjust,
  sharpenKernel, warmthMatrix,
} from '../src/imageFilters';
import { CUSTOM_PROPERTIES } from '../src/document';

/** Aplica um filtro pelo caminho 2D do Fabric (o mesmo do fallback sem WebGL) em pixels RGBA. */
function run2d(filter: { applyTo2d(o: never): void }, px: number[], width = px.length / 4, height = 1): number[] {
  const imageData = { data: new Uint8ClampedArray(px), width, height, colorSpace: 'srgb' } as unknown as ImageData;
  const ctx = { createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4), width: w, height: h }) };
  const state = { imageData, ctx } as unknown as { imageData: ImageData };
  filter.applyTo2d(state as never);
  return [...state.imageData.data];
}

const near = (a: number[], b: number[], tol = 1) => a.length === b.length && a.every((v, i) => Math.abs(v - b[i]) <= tol);

describe('BLEND_MODES', () => {
  it('são os 16 modos do Canvas 2D, distintos, com Normal primeiro', () => {
    expect(BLEND_MODES).toHaveLength(16);
    expect(new Set(BLEND_MODES.map(([id]) => id)).size).toBe(16);
    expect(BLEND_MODES[0]).toEqual(['source-over', 'Normal']);
    for (const id of ['multiply', 'screen', 'overlay', 'darken', 'lighten', 'color-dodge', 'color-burn', 'hard-light', 'soft-light',
      'difference', 'exclusion', 'hue', 'saturation', 'color', 'luminosity']) expect(isBlendMode(id)).toBe(true);
    expect(isBlendMode('destination-out')).toBe(false);
    expect(isBlendMode(undefined)).toBe(false);
  });

  it('globalCompositeOperation volta igual no toObject → fromObject (sem CUSTOM_PROPERTIES)', async () => {
    expect((CUSTOM_PROPERTIES as readonly string[]).includes('globalCompositeOperation')).toBe(false);
    const r = new Rect({ width: 10, height: 10, fill: '#ff9800', globalCompositeOperation: 'multiply' });
    const json = JSON.parse(JSON.stringify(r.toObject()));
    expect(json.globalCompositeOperation).toBe('multiply');
    const back = await Rect.fromObject(json);
    expect(back.globalCompositeOperation).toBe('multiply');
  });
});

describe('sharpenKernel (Nitidez)', () => {
  it('soma 1 para todo s e s = 0 é a identidade', () => {
    for (const s of [0, 0.05, 0.6, 1]) expect(sharpenKernel(s).reduce((a, b) => a + b, 0)).toBeCloseTo(1);
    expect(sharpenKernel(0).map((v) => v + 0)).toEqual([0, 0, 0, 0, 1, 0, 0, 0, 0]);
    expect(sharpenKernel(0.6)[4]).toBeCloseTo(3.4);
  });

  it('no Convolute 2D: área lisa não muda e a borda claro/escuro fica mais forte', () => {
    const f = new filters.Convolute({ matrix: sharpenKernel(0.5), opaque: false });
    // 3×3 cinza uniforme: o pixel do centro continua o mesmo
    const flat = Array.from({ length: 9 }, () => [100, 100, 100, 255]).flat();
    expect(run2d(f, flat, 3, 3).slice(16, 20)).toEqual([100, 100, 100, 255]);
    // linha 5×1 com degrau 50 | 200: o lado escuro escurece, o claro clareia
    const step = [50, 50, 50, 200, 200].flatMap((v) => [v, v, v, 255]);
    const out = run2d(f, step, 5, 1);
    expect(out[2 * 4]).toBeLessThan(50);
    expect(out[3 * 4]).toBeGreaterThan(200);
  });
});

describe('warmthMatrix (Temperatura)', () => {
  it('w = 0 é a identidade', () => {
    expect(warmthMatrix(0)).toEqual([1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0]);
  });

  it('w > 0 esquenta (R sobe, B desce), w < 0 esfria, e o preto continua preto', () => {
    const warm = run2d(new filters.ColorMatrix({ matrix: warmthMatrix(1) }), [128, 128, 128, 255, 0, 0, 0, 255]);
    expect(warm[0]).toBeGreaterThan(128);
    expect(warm[1]).toBe(128);
    expect(warm[2]).toBeLessThan(128);
    expect(warm.slice(4)).toEqual([0, 0, 0, 255]);
    const cold = run2d(new filters.ColorMatrix({ matrix: warmthMatrix(-1) }), [128, 128, 128, 255]);
    expect(cold[0]).toBeLessThan(128);
    expect(cold[2]).toBeGreaterThan(128);
  });
});

describe('duotoneMatrix', () => {
  it('preto → cor da sombra, branco → cor do destaque, alfa intacto', () => {
    const m = duotoneMatrix('#1a237e', '#ffeb3b')!;
    expect(m).toHaveLength(20);
    const out = run2d(new filters.ColorMatrix({ matrix: m }), [0, 0, 0, 255, 255, 255, 255, 128]);
    expect(near(out.slice(0, 4), [0x1a, 0x23, 0x7e, 255])).toBe(true);
    expect(near(out.slice(4, 8), [0xff, 0xeb, 0x3b, 128])).toBe(true);
  });

  it('cinza médio fica no meio do caminho pela luminância', () => {
    const out = run2d(new filters.ColorMatrix({ matrix: duotoneMatrix('#000000', '#ffffff')! }), [255, 0, 0, 255]);
    // Y do vermelho puro = 0,299
    expect(near(out.slice(0, 3), [76, 76, 76])).toBe(true);
  });

  it('cor inválida → null; hex curto aceito', () => {
    expect(duotoneMatrix('red', '#fff')).toBeNull();
    expect(hexToRgb01('#fff')).toEqual([1, 1, 1]);
    expect(duotoneMatrix('#000', '#fff')).not.toBeNull();
  });

  it('presets e Duotone da Marca', () => {
    expect(DUOTONE_PRESETS.map((d) => d.label)).toEqual(['Cyberpunk', 'Sépia Ouro', 'Azul Profundo']);
    for (const d of DUOTONE_PRESETS) expect(duotoneMatrix(d.shadow, d.highlight)).not.toBeNull();
    expect(brandDuotone({ primary: '#1a237e', secondary: '#ffeb3b' })).toEqual({ id: 'brand', shadow: '#1a237e', highlight: '#ffeb3b' });
    expect(brandDuotone({ primary: '#1a237e' })).toEqual({ id: 'brand', shadow: '#1a237e', highlight: '#ffffff' });
    expect(brandDuotone({})).toBeNull();
  });
});

describe('filterAdjust (o que a folha Filtros relê)', () => {
  it('compacta zeros e some quando não sobra nada; parse ignora lixo', () => {
    expect(compactFilterAdjust({ sharpen: 0, warmth: 0 })).toBeUndefined();
    expect(compactFilterAdjust({ sharpen: 0.6, warmth: 0 })).toEqual({ sharpen: 0.6 });
    expect(parseFilterAdjust({ sharpen: 'x', warmth: 0.8, duotone: { id: 'brand', shadow: 'nope', highlight: '#fff' } })).toEqual({ warmth: 0.8 });
    expect(parseFilterAdjust(null)).toEqual({});
  });

  it('imagem com filterAdjust + ColorMatrix + Convolute sobrevive ao toObject → fromObject', async () => {
    const saved = FabricObject.customProperties;
    FabricObject.customProperties = [...CUSTOM_PROPERTIES];
    try {
      const el = { width: 2, height: 2, naturalWidth: 2, naturalHeight: 2, complete: true } as unknown as HTMLImageElement;
      const img = new FabricImage(el);
      const fa = { sharpen: 0.6, warmth: 0.8, duotone: { id: 'brand', shadow: '#1a237e', highlight: '#ffeb3b' } };
      img.filters = [
        new filters.ColorMatrix({ matrix: warmthMatrix(0.8) }),
        new filters.ColorMatrix({ matrix: duotoneMatrix(fa.duotone.shadow, fa.duotone.highlight)! }),
        new filters.Convolute({ matrix: sharpenKernel(0.6), opaque: false }),
      ];
      img.set('filterAdjust', fa);
      const json = JSON.parse(JSON.stringify(img.toObject()));
      expect(json.filterAdjust).toEqual(fa);
      expect(json.filters.map((f: { type: string }) => f.type)).toEqual(['ColorMatrix', 'ColorMatrix', 'Convolute']);
      // revive dos filtros nativos pelo classRegistry (o caminho do loadFromJSON)
      const revived = await Promise.all(json.filters.map((f: { type: string }) =>
        (f.type === 'Convolute' ? filters.Convolute : filters.ColorMatrix).fromObject(f as never)));
      expect(revived[2].matrix[4]).toBeCloseTo(3.4);
      expect(revived[2].opaque).toBe(false);
      expect(revived[0].matrix[0]).toBeCloseTo(1.12);
      expect(parseFilterAdjust(json.filterAdjust)).toEqual(fa);
    } finally {
      FabricObject.customProperties = saved;
    }
  });
});
