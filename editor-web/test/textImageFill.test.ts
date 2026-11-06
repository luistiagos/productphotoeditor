import { describe, expect, it } from 'vitest';
import { FabricObject, Pattern, Rect } from 'fabric/node';
import { CUSTOM_PROPERTIES } from '../src/document';
import {
  coverPatternTransform, installPatternSvg, isTextImageFill, type Mat2D, patternSourceSize, refitTextImageFill,
} from '../src/textImageFill';

// mesmo registro do editor.ts: a marca entra no toObject()
FabricObject.customProperties = [...CUSTOM_PROPERTIES];
installPatternSvg(Pattern);

/** Ponto (x,y) da caixa → coordenada na foto (inversa do patternTransform sem rotação). */
const toImage = (t: Mat2D, x: number, y: number): [number, number] => [(x - t[4]) / t[0], (y - t[5]) / t[3]];

/** Os 4 cantos da caixa caem dentro de [0,imgW]×[0,imgH]: a foto cobre a caixa inteira. */
function covers(t: Mat2D, imgW: number, imgH: number, boxW: number, boxH: number): boolean {
  const eps = 1e-6;
  return [[0, 0], [boxW, 0], [0, boxH], [boxW, boxH]].every(([x, y]) => {
    const [u, v] = toImage(t, x, y);
    return u >= -eps && u <= imgW + eps && v >= -eps && v <= imgH + eps;
  });
}

/**
 * Foto de teste: o vitest roda sem o `canvas` nativo (o jsdom não decodifica imagem nem dispara `onload`), então a fonte
 * é um "<img> carregado" com o tamanho natural. `src` vazio: o `Pattern.fromObject` → `loadImage('')` resolve na hora.
 */
function photo(w: number, h: number, src = ''): HTMLImageElement {
  return { src, naturalWidth: w, naturalHeight: h, width: w, height: h, complete: true } as unknown as HTMLImageElement;
}

/**
 * Caixa do texto com foto. O `fabric/node` daqui não mede texto (sem o pacote `canvas`, getContext → null; mesma
 * limitação do textTools.test), então a caixa é um Rect `400 × 136`: o `patternTransform`, a marca, o `toObject` e o
 * referencial centrado do SVG (`-w/2, -h/2`) são os mesmos do Textbox. O texto de verdade é provado pelo E2E (task15).
 */
function photoText(imgW = 1200, imgH = 800, src = ''): Rect {
  const img = photo(imgW, imgH, src);
  const t = new Rect({ width: 400, height: 136, fill: '#123456' });
  t.set({
    fill: new Pattern({ source: img, repeat: 'no-repeat', patternTransform: coverPatternTransform(imgW, imgH, t.width, t.height) }),
    textImageFill: { src: src || '/blob/foto', fallback: '#123456' },
  });
  return t;
}

describe('coverPatternTransform (object-fit: cover na caixa do texto)', () => {
  it('foto mais larga que a caixa: escala pela altura, centra no X e cobre os 4 cantos', () => {
    const t = coverPatternTransform(1200, 800, 400, 400);
    expect(t[0]).toBeCloseTo(0.5);
    expect(t[3]).toBeCloseTo(0.5);
    expect(t[1]).toBe(0);
    expect(t[2]).toBe(0);
    expect(t[4]).toBeCloseTo((400 - 600) / 2);
    expect(t[5]).toBeCloseTo(0);
    expect(covers(t, 1200, 800, 400, 400)).toBe(true);
  });
  it('caixa mais larga que a foto (título): escala pela largura, centra no Y', () => {
    const t = coverPatternTransform(1200, 800, 900, 150);
    expect(t[0]).toBeCloseTo(0.75);
    expect(t[4]).toBeCloseTo(0);
    expect(t[5]).toBeCloseTo((150 - 600) / 2);
    expect(covers(t, 1200, 800, 900, 150)).toBe(true);
  });
  it('caixa mais alta que a foto e foto menor que a caixa (amplia)', () => {
    const t = coverPatternTransform(100, 100, 300, 900);
    expect(t[0]).toBeCloseTo(9);
    expect(covers(t, 100, 100, 300, 900)).toBe(true);
    // centrada: sobra igual dos dois lados no X
    const [u0] = toImage(t, 0, 0);
    const [u1] = toImage(t, 300, 0);
    expect(u0).toBeCloseTo(100 - u1);
  });
  it('a escala é a mínima que cobre: um eixo encosta exatamente', () => {
    const t = coverPatternTransform(1200, 800, 900, 150);
    const [u0] = toImage(t, 0, 0);
    const [u1] = toImage(t, 900, 0);
    expect(u0).toBeCloseTo(0);
    expect(u1).toBeCloseTo(1200);
  });
});

describe('marca textImageFill', () => {
  it('entra no CUSTOM_PROPERTIES e não tem `type` (o revive do Fabric a transformaria)', () => {
    expect(CUSTOM_PROPERTIES).toContain('textImageFill');
    expect(isTextImageFill({ src: '/blob/1', fallback: '#000' })).toBe(true);
    expect(isTextImageFill({ type: 'pattern', src: '/blob/1', fallback: '#000' })).toBe(false);
    expect(isTextImageFill(undefined)).toBe(false);
  });
});

describe('texto com foto: refit, round-trip e SVG', () => {
  it('mudar a largura do Textbox e refazer muda o patternTransform e continua cobrindo', async () => {
    const t = photoText();
    const before = [...((t.fill as Pattern).patternTransform as number[])];
    t.set({ width: 900, height: 150 }); // alça lateral + texto editado ("VERÃO 50%")
    expect(refitTextImageFill(t)).toBe(true);
    const after = (t.fill as Pattern).patternTransform as Mat2D;
    expect(after).not.toEqual(before);
    expect(covers(after, 1200, 800, t.width, t.height)).toBe(true);
    expect(t.dirty).toBe(true);
  });
  it('sem foto carregada não há o que refazer', () => {
    expect(refitTextImageFill({ width: 10, height: 10, fill: '#000' })).toBe(false);
    expect(patternSourceSize({ source: { naturalWidth: 0, naturalHeight: 0, width: 0, height: 0 } })).toBeNull();
  });
  it('toObject → JSON → fromObject devolve Pattern com o mesmo patternTransform e a marca (undo/rascunho)', async () => {
    const t = photoText();
    const json = JSON.parse(JSON.stringify(t.toObject()));
    expect(json.fill.type).toBe('pattern');
    expect(json.fill.patternTransform).toHaveLength(6);
    expect(json.textImageFill).toEqual({ src: '/blob/foto', fallback: '#123456' });
    const back = await Rect.fromObject(json);
    expect(back.fill).toBeInstanceOf(Pattern);
    const p = back.fill as Pattern;
    expect(p.patternTransform).toEqual((t.fill as Pattern).patternTransform);
    expect(p.repeat).toBe('no-repeat');
    expect(back.get('textImageFill')).toEqual({ src: '/blob/foto', fallback: '#123456' });
  });
  it('toSVG: pattern em userSpaceOnUse na caixa centrada, foto com a matriz do cover e o texto referencia o padrão', async () => {
    const t = photoText(1200, 800, 'data:image/png;base64,AAA');
    const p = t.fill as Pattern;
    const svg = t.toSVG();
    const tr = p.patternTransform as Mat2D;
    expect(svg).toContain(`<pattern id="SVGID_${p.id}" patternUnits="userSpaceOnUse" x="${-t.width / 2}" y="${Math.round((-t.height / 2) * 10000) / 10000}"`);
    expect(svg).toContain(`transform="matrix(${tr.map((v) => Math.round(v * 10000) / 10000).join(' ')})"`);
    expect(svg).toContain('width="1200" height="800"');
    expect(svg).toContain('xlink:href="data:image/png');
    expect(svg).toContain(`fill: url(#SVGID_${p.id})`);
  });
  it('toSVG sem patternTransform (padrão que não é foto no texto) mantém a saída original do Fabric', async () => {
    const p = new Pattern({ source: photo(30, 20, 'data:image/png;base64,AAA'), repeat: 'repeat' });
    const svg = p.toSVG({ width: 60, height: 40 });
    expect(svg).not.toContain('userSpaceOnUse');
    expect(svg).toContain(`<pattern id="SVGID_${p.id}" x="0" y="0" width="0.5" height="0.5">`);
  });
});
