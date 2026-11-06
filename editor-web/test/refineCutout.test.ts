import { describe, expect, it } from 'vitest';
import { FabricImage, FabricObject } from 'fabric/node';
import { CUSTOM_PROPERTIES } from '../src/document';
import {
  applyCoverage, applyStroke, featherAlpha, type RefineBox, strokeBounds, strokeCoverage, strokeStamps,
} from '../src/refineCutout';

/** Imagem RGBA `w × h` com todos os pixels iguais. */
function solid(w: number, h: number, rgba: [number, number, number, number]): Uint8ClampedArray {
  const d = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < d.length; i += 4) d.set(rgba, i);
  return d;
}
const px = (d: Uint8ClampedArray, w: number, x: number, y: number) => Array.from(d.subarray((y * w + x) * 4, (y * w + x) * 4 + 4));

/** Janela `box` de uma imagem cheia `w` de largura (o `getImageData` do editor). */
function windowOf(full: Uint8ClampedArray, w: number, box: RefineBox): Uint8ClampedArray {
  const out = new Uint8ClampedArray(box.w * box.h * 4);
  for (let y = 0; y < box.h; y++) out.set(full.subarray(((box.y + y) * w + box.x) * 4, ((box.y + y) * w + box.x + box.w) * 4), y * box.w * 4);
  return out;
}
function putWindow(full: Uint8ClampedArray, w: number, box: RefineBox, data: Uint8ClampedArray): void {
  for (let y = 0; y < box.h; y++) full.set(data.subarray(y * box.w * 4, (y + 1) * box.w * 4), ((box.y + y) * w + box.x) * 4);
}

describe('featherAlpha (carimbo com borda suave)', () => {
  it('1 no miolo, 0 a partir do raio, intermediário na faixa da suavidade', () => {
    expect(featherAlpha(0, 10, 0.5)).toBe(1);
    expect(featherAlpha(5, 10, 0.5)).toBe(1);
    const mid = featherAlpha(7.5, 10, 0.5);
    expect(mid).toBeGreaterThan(0);
    expect(mid).toBeLessThan(1);
    expect(mid).toBeCloseTo(0.5);
    expect(featherAlpha(10, 10, 0.5)).toBe(0);
    expect(featherAlpha(30, 10, 0.5)).toBe(0);
  });

  it('suavidade 0 é degrau; 100% cai desde o centro', () => {
    expect(featherAlpha(9.99, 10, 0)).toBe(1);
    expect(featherAlpha(10, 10, 0)).toBe(0);
    expect(featherAlpha(0, 10, 1)).toBe(1);
    expect(featherAlpha(2, 10, 1)).toBeLessThan(1);
  });

  it('decresce com a distância', () => {
    let prev = 1;
    for (let d = 0; d <= 10; d += 0.5) {
      const v = featherAlpha(d, 10, 0.7);
      expect(v).toBeLessThanOrEqual(prev);
      prev = v;
    }
  });
});

describe('strokeStamps (carimbos ao longo do traço)', () => {
  it('2 pontos distantes: carimbos contínuos, com o 1º e o último', () => {
    const s = strokeStamps([{ x: 0, y: 0 }, { x: 100, y: 0 }], 10);
    expect(s[0]).toEqual({ x: 0, y: 0 });
    expect(s[s.length - 1]).toEqual({ x: 100, y: 0 });
    expect(s.length).toBe(11);
    for (let i = 1; i < s.length; i++) expect(Math.hypot(s[i].x - s[i - 1].x, s[i].y - s[i - 1].y)).toBeLessThanOrEqual(10 + 1e-9);
  });

  it('o espaçamento atravessa os vértices da linha', () => {
    const s = strokeStamps([{ x: 0, y: 0 }, { x: 6, y: 0 }, { x: 6, y: 6 }], 4);
    expect(s).toEqual([{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 6, y: 2 }, { x: 6, y: 6 }]);
  });

  it('toque parado = 1 carimbo; sem pontos = nenhum', () => {
    expect(strokeStamps([{ x: 3, y: 4 }], 5)).toEqual([{ x: 3, y: 4 }]);
    expect(strokeStamps([{ x: 3, y: 4 }, { x: 3, y: 4 }], 5)).toEqual([{ x: 3, y: 4 }]);
    expect(strokeStamps([], 5)).toEqual([]);
  });
});

describe('strokeBounds', () => {
  it('recorta na imagem e devolve null fora dela', () => {
    expect(strokeBounds([{ x: 2, y: 2 }], 5, 20, 10)).toEqual({ x: 0, y: 0, w: 7, h: 7 });
    expect(strokeBounds([{ x: 18, y: 9 }], 5, 20, 10)).toEqual({ x: 13, y: 4, w: 7, h: 6 });
    expect(strokeBounds([{ x: -50, y: -50 }], 5, 20, 10)).toBeNull();
  });
});

describe('apagar sobra (erase)', () => {
  const W = 40, H = 40;
  const run = (feather: number) => {
    const img = solid(W, H, [200, 100, 50, 255]);
    const out = applyStroke([{ x: 20, y: 20 }], 10, feather, 'erase', W, H, (b) => windowOf(img, W, b), null);
    expect(out).not.toBeNull();
    putWindow(img, W, out!.box, out!.data);
    return img;
  };

  it('centro α=0, borda com suavidade 0,5 intermediária, fora do raio intacto, cor mantida', () => {
    const img = run(0.5);
    expect(px(img, W, 20, 20)[3]).toBe(0);
    const edge = px(img, W, 27, 19)[3]; // centro do pixel a ~7,5 do centro do carimbo
    expect(edge).toBeGreaterThan(0);
    expect(edge).toBeLessThan(255);
    expect(px(img, W, 35, 20)).toEqual([200, 100, 50, 255]);
    expect(px(img, W, 0, 0)).toEqual([200, 100, 50, 255]);
    expect(px(img, W, 20, 20).slice(0, 3)).toEqual([200, 100, 50]);
  });

  it('suavidade 0 = degrau (só 0 ou 255)', () => {
    const img = run(0);
    for (let i = 3; i < img.length; i += 4) expect([0, 255]).toContain(img[i]);
  });

  it('carimbos sobrepostos não acumulam: a borda é a mesma com 1 ou 2 passadas no mesmo ponto', () => {
    const once = solid(W, H, [0, 0, 0, 255]);
    const covOnce = strokeCoverage({ x: 0, y: 0, w: W, h: H }, [{ x: 20, y: 20 }], 10, 0.5);
    applyCoverage(once, null, covOnce, 'erase');
    const twice = solid(W, H, [0, 0, 0, 255]);
    const covTwice = strokeCoverage({ x: 0, y: 0, w: W, h: H }, [{ x: 20, y: 20 }, { x: 20, y: 20 }], 10, 0.5);
    applyCoverage(twice, null, covTwice, 'erase');
    expect(Array.from(twice)).toEqual(Array.from(once));
  });

  it('carimbo na borda da imagem não estoura índice', () => {
    const img = solid(W, H, [10, 10, 10, 255]);
    for (const p of [{ x: 0, y: 0 }, { x: W, y: H }, { x: -3, y: 20 }, { x: W + 3, y: 5 }]) {
      const out = applyStroke([p], 8, 0.5, 'erase', W, H, (b) => windowOf(img, W, b), null);
      if (out) {
        expect(out.box.x + out.box.w).toBeLessThanOrEqual(W);
        expect(out.box.y + out.box.h).toBeLessThanOrEqual(H);
        expect(out.data.length).toBe(out.box.w * out.box.h * 4);
        putWindow(img, W, out.box, out.data);
      }
    }
    expect(px(img, W, 0, 0)[3]).toBe(0);
    expect(img.length).toBe(W * H * 4);
  });
});

describe('restaurar original (restore)', () => {
  const W = 30, H = 30;

  it('no centro volta o pixel do original exato (α e cor), inclusive sobre α=0 com RGB 0', () => {
    const cut = solid(W, H, [0, 0, 0, 0]); // o recorte deixa α=0 com RGB 0 (PNG pré-multiplicado)
    const orig = solid(W, H, [12, 200, 90, 255]);
    const out = applyStroke([{ x: 15, y: 15 }], 8, 0.5, 'restore', W, H, (b) => windowOf(cut, W, b), (b) => windowOf(orig, W, b));
    putWindow(cut, W, out!.box, out!.data);
    expect(px(cut, W, 15, 15)).toEqual([12, 200, 90, 255]);
    // borda: alfa parcial com a COR do original (não preto)
    const edge = px(cut, W, 21, 14);
    expect(edge[3]).toBeGreaterThan(0);
    expect(edge[3]).toBeLessThan(255);
    expect(edge.slice(0, 3)).toEqual([12, 200, 90]);
    expect(px(cut, W, 0, 0)).toEqual([0, 0, 0, 0]);
  });

  it('sobre o sujeito opaco a borda mistura as duas cores; alfa do original transparente apaga', () => {
    const cut = solid(W, H, [255, 0, 0, 255]);
    const orig = solid(W, H, [0, 0, 255, 255]);
    const out = applyStroke([{ x: 15, y: 15 }], 8, 0.5, 'restore', W, H, (b) => windowOf(cut, W, b), (b) => windowOf(orig, W, b));
    putWindow(cut, W, out!.box, out!.data);
    expect(px(cut, W, 15, 15)).toEqual([0, 0, 255, 255]);
    const edge = px(cut, W, 21, 14);
    expect(edge[0]).toBeGreaterThan(0);
    expect(edge[2]).toBeGreaterThan(0);
    expect(edge[3]).toBe(255);

    const clear = solid(W, H, [0, 0, 0, 0]);
    const full = solid(W, H, [9, 9, 9, 255]);
    const o2 = applyStroke([{ x: 15, y: 15 }], 8, 0, 'restore', W, H, (b) => windowOf(full, W, b), (b) => windowOf(clear, W, b));
    putWindow(full, W, o2!.box, o2!.data);
    expect(px(full, W, 15, 15)[3]).toBe(0);
  });

  it('sem a original o restaurar não faz nada', () => {
    const cut = solid(W, H, [0, 0, 0, 0]);
    expect(applyStroke([{ x: 15, y: 15 }], 8, 0.5, 'restore', W, H, (b) => windowOf(cut, W, b), null)).toBeNull();
    const d = solid(2, 2, [1, 2, 3, 0]);
    applyCoverage(d, null, new Float32Array([1, 1, 1, 1]), 'restore');
    expect(Array.from(d)).toEqual(Array.from(solid(2, 2, [1, 2, 3, 0])));
  });

  it('o traço de 2 pontos restaura a faixa contínua entre eles', () => {
    const cut = solid(60, 20, [0, 0, 0, 0]);
    const orig = solid(60, 20, [50, 60, 70, 255]);
    const out = applyStroke([{ x: 5, y: 10 }, { x: 55, y: 10 }], 4, 0.3, 'restore', 60, 20,
      (b) => windowOf(cut, 60, b), (b) => windowOf(orig, 60, b));
    putWindow(cut, 60, out!.box, out!.data);
    for (let x = 5; x <= 54; x++) expect(px(cut, 60, x, 9)).toEqual([50, 60, 70, 255]);
  });
});

describe('originalSrcBeforeCutout no documento', () => {
  it('é propriedade própria e vai e volta no JSON do Fabric', async () => {
    expect(CUSTOM_PROPERTIES).toContain('originalSrcBeforeCutout');
    const saved = FabricObject.customProperties;
    FabricObject.customProperties = [...CUSTOM_PROPERTIES];
    try {
      const url = 'https://appassets.androidplatform.net/blob/img-1.png';
      const el = { width: 2, height: 2, naturalWidth: 2, naturalHeight: 2, complete: true } as unknown as HTMLImageElement;
      const img = new FabricImage(el);
      img.set('originalSrcBeforeCutout', url);
      const json = JSON.parse(JSON.stringify(img.toObject()));
      expect(json.originalSrcBeforeCutout).toBe(url);
      // o `fromObject` do Fabric termina em `new FabricImage(elementoCarregado, json)`: as opções voltam como propriedades
      const back = new FabricImage(el, json);
      expect(back.get('originalSrcBeforeCutout')).toBe(url);
      // sem a propriedade (imagem nunca recortada), o JSON não a leva
      expect('originalSrcBeforeCutout' in JSON.parse(JSON.stringify(new FabricImage(el).toObject()))).toBe(false);
    } finally {
      FabricObject.customProperties = saved;
    }
  });
});
