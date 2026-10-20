import { describe, expect, it } from 'vitest';
import { rescaledGeometry } from '../src/imageGeometry';

describe('rescaledGeometry', () => {
  // imagem de 800×600 recortada em 300×200 a partir de (100, 50), mostrada com escala 1,5×0,75
  const cropped = { width: 300, height: 200, scaleX: 1.5, scaleY: 0.75, cropX: 100, cropY: 50 };

  it('upscale x2 keeps the on-screen size and doubles the crop', () => {
    const g = rescaledGeometry(cropped, 2, 2);
    expect(g.width * g.scaleX).toBeCloseTo(300 * 1.5);
    expect(g.height * g.scaleY).toBeCloseTo(200 * 0.75);
    expect(g).toMatchObject({ width: 600, height: 400, cropX: 200, cropY: 100 });
  });

  it('upscale x4 likewise', () => {
    const g = rescaledGeometry(cropped, 4, 4);
    expect(g.width * g.scaleX).toBeCloseTo(450);
    expect(g).toMatchObject({ cropX: 400, cropY: 200, width: 1200, height: 800 });
  });

  it('same-size result keeps the crop (removeBg/inpaint on a cropped image)', () => {
    expect(rescaledGeometry(cropped, 1, 1)).toEqual(cropped);
  });
});
