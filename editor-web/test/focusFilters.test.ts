import { describe, expect, it, vi } from 'vitest';
// `src/*` importa 'fabric' (build do navegador) e os testes usam 'fabric/node': são duas instâncias do Fabric, com dois
// classRegistry. O mock faz o `src/focusFilters.ts` estender e registrar no MESMO Fabric do teste (o caminho do app).
vi.mock('fabric', async () => await import('fabric/node'));
import { Canvas2dFilterBackend, classRegistry, util } from 'fabric/node';
import { FocusBlur, isRegionFilter, SoftEdge, Vignette } from '../src/focusFilters';
import { FULL_REGION, visibleRegion } from '../src/imageGeometry';

const W = 64, H = 48;
const LIGHT = 0xc0, DARK = 0x40;

/** Xadrez de 4 px #c0c0c0/#404040, alfa 255. */
function checker(): Uint8ClampedArray {
  const d = new Uint8ClampedArray(W * H * 4);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const v = ((x >> 2) + (y >> 2)) % 2 ? DARK : LIGHT, i = (y * W + x) * 4;
    d[i] = d[i + 1] = d[i + 2] = v; d[i + 3] = 255;
  }
  return d;
}

/** Roda o caminho 2D do filtro (o mesmo do fallback sem WebGL) e devolve os pixels. */
function run(f: { applyTo(o: never): void }, data = checker()): Uint8ClampedArray {
  const imageData = { data, width: W, height: H } as unknown as ImageData;
  f.applyTo({ imageData } as never);
  return imageData.data;
}

const px = (d: Uint8ClampedArray, x: number, y: number) => [...d.slice((y * W + x) * 4, (y * W + x) * 4 + 4)];
/** Valores do canal vermelho num bloco. */
function block(d: Uint8ClampedArray, x0: number, y0: number, w: number, h: number): number[] {
  const out: number[] = [];
  for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) out.push(d[(y * W + x) * 4]);
  return out;
}
const mean = (v: number[]) => v.reduce((a, b) => a + b, 0) / v.length;
const variance = (v: number[]) => { const m = mean(v); return mean(v.map((x) => (x - m) ** 2)); };
const blockPx = (d: Uint8ClampedArray, x0: number, y0: number, w: number, h: number) => {
  const out: number[] = [];
  for (let y = y0; y < y0 + h; y++) out.push(...d.slice((y * W + x0) * 4, (y * W + x0 + w) * 4));
  return out;
};

describe('registro (revive do rascunho)', () => {
  it('as três classes estão no classRegistry do Fabric dos testes (o mock vale)', () => {
    for (const t of ['Vignette', 'SoftEdge', 'FocusBlur']) expect(classRegistry.has(t)).toBe(true);
    expect(classRegistry.getClass('Vignette')).toBe(Vignette);
  });

  it('toObject leva a região e os parâmetros, sem campos internos; enlivenObjects devolve a mesma classe', async () => {
    const region = { x0: 0.1, y0: 0.2, x1: 0.9, y1: 0.8 };
    const fs = [
      new Vignette({ vignette: 0.8, ...region }),
      new SoftEdge({ softEdge: 0.5, ...region }),
      new FocusBlur({ mode: 'linear', blur: 0.7, focusX: 0.4, focusY: 0.6, radius: 0.1, feather: 0.3, angle: 45, ...region }),
    ];
    run(fs[2]); // passa pelo applyTo (marca `horizontal` em outros caminhos): não pode vazar para o JSON
    const json = JSON.parse(JSON.stringify(fs.map((f) => f.toObject())));
    expect(json[0]).toEqual({ type: 'Vignette', vignette: 0.8, ...region });
    expect(json[1]).toEqual({ type: 'SoftEdge', softEdge: 0.5, ...region });
    expect(json[2]).toEqual({ type: 'FocusBlur', mode: 'linear', blur: 0.7, focusX: 0.4, focusY: 0.6, radius: 0.1, feather: 0.3, angle: 45, ...region });
    expect('horizontal' in json[2]).toBe(false);
    const back = await util.enlivenObjects(json);
    expect(back[0]).toBeInstanceOf(Vignette);
    expect(back[1]).toBeInstanceOf(SoftEdge);
    expect(back[2]).toBeInstanceOf(FocusBlur);
    expect(back.map((f) => (f as { toObject(): unknown }).toObject())).toEqual(json);
    expect((back[2] as FocusBlur).spec()).toEqual({ mode: 'linear', blur: 0.7, focusX: 0.4, focusY: 0.6, radius: 0.1, feather: 0.3, angle: 45 });
    expect(back.every(isRegionFilter)).toBe(true);
  });

  it('sem opções: região inteira e neutros (o Fabric os pula no render)', () => {
    const v = new Vignette(), s = new SoftEdge(), f = new FocusBlur();
    expect([v.x0, v.y0, v.x1, v.y1]).toEqual([0, 0, 1, 1]);
    expect([v.isNeutralState(), s.isNeutralState(), f.isNeutralState()]).toEqual([true, true, true]);
    expect(f.mode).toBe('radial');
  });
});

describe('shaders GLSL', () => {
  it('começam com "precision highp float" e declaram cada uniforme enviado', () => {
    for (const C of [Vignette, SoftEdge, FocusBlur]) {
      const src = new C().getFragmentSource();
      expect(src.trimStart().startsWith('precision highp float;')).toBe(true);
      for (const name of C.uniformLocations) expect(src).toMatch(new RegExp(`uniform\\s+\\w+\\s+${name};`));
      expect(src).toContain('gl_FragColor');
    }
  });
});

describe('Vignette (2D)', () => {
  it('0.8 escurece o canto e deixa o centro idêntico', () => {
    const orig = checker(), out = run(new Vignette({ vignette: 0.8 }));
    expect(mean(block(out, 0, 0, 6, 6))).toBeLessThan(0.75 * mean(block(orig, 0, 0, 6, 6)));
    expect(blockPx(out, 29, 21, 6, 6)).toEqual(blockPx(orig, 29, 21, 6, 6));
    expect(px(out, 0, 0)[3]).toBe(255);
  });

  it('−0.8 clareia o canto', () => {
    const orig = checker(), out = run(new Vignette({ vignette: -0.8 }));
    expect(mean(block(out, 0, 0, 6, 6))).toBeGreaterThan(mean(block(orig, 0, 0, 6, 6)) + 30);
  });

  it('com região, o centro escuro/claro acompanha a parte visível', () => {
    // região = metade direita: o canto esquerdo da imagem inteira fica no MEIO da borda esquerda da região
    const out = run(new Vignette({ vignette: 1, x0: 0.5, y0: 0, x1: 1, y1: 1 }));
    const orig = checker();
    expect(blockPx(out, 46, 21, 4, 6)).toEqual(blockPx(orig, 46, 21, 4, 6)); // centro da região intacto
    expect(mean(block(out, 60, 0, 4, 4))).toBeLessThan(0.75 * mean(block(orig, 60, 0, 4, 4)));
  });
});

describe('SoftEdge (2D)', () => {
  it('0.5: alfa da borda esquerda < 40 e do centro = 255; rgb intacto', () => {
    const orig = checker(), out = run(new SoftEdge({ softEdge: 0.5 }));
    expect(px(out, 0, 24)[3]).toBeLessThan(40);
    expect(px(out, 32, 24)[3]).toBe(255);
    expect(px(out, 0, 24).slice(0, 3)).toEqual(px(orig, 0, 24).slice(0, 3));
  });

  it('região x0 = 0.5: a borda passa a ser x = 32 e o que está fora some', () => {
    const out = run(new SoftEdge({ softEdge: 0.5, x0: 0.5, y0: 0, x1: 1, y1: 1 }));
    expect(px(out, 32, 24)[3]).toBeLessThan(40);
    expect(px(out, 0, 24)[3]).toBeLessThan(40);
    expect(px(out, 48, 24)[3]).toBe(255);
  });
});

describe('FocusBlur (2D)', () => {
  it('radial: centro idêntico, canto desfocado (variância cai)', () => {
    const orig = checker(), out = run(new FocusBlur({ mode: 'radial', blur: 1, radius: 0.15, feather: 0.2 }));
    expect(blockPx(out, 29, 21, 6, 6)).toEqual(blockPx(orig, 29, 21, 6, 6));
    expect(variance(block(out, 0, 0, 6, 6))).toBeLessThan(0.4 * variance(block(orig, 0, 0, 6, 6)));
    expect(px(out, 0, 0)[3]).toBe(255);
  });

  it('linear (ângulo 0): faixa central idêntica, topo desfocado; 45° muda o resultado', () => {
    const orig = checker();
    const out = run(new FocusBlur({ mode: 'linear', blur: 1, radius: 0.1, feather: 0.2, angle: 0 }));
    expect(blockPx(out, 0, 22, W, 4)).toEqual(blockPx(orig, 0, 22, W, 4));
    expect(variance(block(out, 0, 0, W, 6))).toBeLessThan(0.4 * variance(block(orig, 0, 0, W, 6)));
    const tilted = run(new FocusBlur({ mode: 'linear', blur: 1, radius: 0.1, feather: 0.2, angle: 45 }));
    expect([...tilted]).not.toEqual([...out]);
  });

  it('o foco segue o centro pedido (focusX/Y relativos à região)', () => {
    const orig = checker();
    const out = run(new FocusBlur({ mode: 'radial', blur: 1, radius: 0.12, feather: 0.1, focusX: 0.5, focusY: 0.5, x0: 0, y0: 0, x1: 0.5, y1: 1 }));
    // centro da região (metade esquerda) = (16, 24): nítido; centro da imagem inteira (48, 24) fora do foco
    expect(blockPx(out, 14, 22, 4, 4)).toEqual(blockPx(orig, 14, 22, 4, 4));
    expect(variance(block(out, 44, 20, 8, 8))).toBeLessThan(0.4 * variance(block(orig, 44, 20, 8, 8)));
  });

  it('intensidade 0 é neutra; transparente continua transparente (sem NaN)', () => {
    expect(new FocusBlur({ blur: 0 }).isNeutralState()).toBe(true);
    const clear = new Uint8ClampedArray(W * H * 4);
    const out = run(new FocusBlur({ blur: 1, radius: 0 }), clear);
    expect(out.every((v) => v === 0)).toBe(true);
  });
});

describe('cadeia pelo backend 2D do Fabric (Canvas2dFilterBackend)', () => {
  it('foco → vinheta → borda suave pelo applyFilters do backend (o estado de pipeline real)', () => {
    // o `canvas` nativo não carrega aqui (sem binário do node-canvas): um contexto mínimo entrega e recebe os pixels
    let put: ImageData | undefined;
    const ctx = {
      drawImage: () => undefined,
      getImageData: () => ({ data: checker(), width: W, height: H }),
      putImageData: (d: ImageData) => { put = d; },
    };
    const target = { width: W, height: H, getContext: () => ctx } as unknown as HTMLCanvasElement;
    new Canvas2dFilterBackend().applyFilters([
      new FocusBlur({ blur: 1, radius: 0.15 }), new Vignette({ vignette: 0.8 }), new SoftEdge({ softEdge: 0.5 }),
    ], target, W, H, target);
    const out = put!.data as Uint8ClampedArray, orig = checker();
    expect(blockPx(out, 29, 21, 6, 6)).toEqual(blockPx(orig, 29, 21, 6, 6));
    expect(out[(24 * W) * 4 + 3]).toBeLessThan(40);
    expect(variance(block(out, 10, 10, 6, 6))).toBeLessThan(variance(block(orig, 10, 10, 6, 6)));
    expect(mean(block(out, 0, 0, 6, 6))).toBeLessThan(0.75 * mean(block(orig, 0, 0, 6, 6)));
  });
});

describe('visibleRegion', () => {
  it('normaliza o recorte; sem recorte = imagem inteira; entrada ruim = inteira', () => {
    expect(visibleRegion({ cropX: 0, cropY: 0, width: 400, height: 300 }, 400, 300)).toEqual(FULL_REGION);
    expect(visibleRegion({ cropX: 100, cropY: 30, width: 300, height: 240 }, 400, 300)).toEqual({ x0: 0.25, y0: 0.1, x1: 1, y1: 0.9 });
    expect(visibleRegion({ cropX: 0, cropY: 0, width: 0, height: 10 }, 400, 300)).toEqual(FULL_REGION);
    expect(visibleRegion({ cropX: 0, cropY: 0, width: 10, height: 10 }, 0, 0)).toEqual(FULL_REGION);
  });
});
