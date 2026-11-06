import { describe, expect, it } from 'vitest';
import { isConvexQuad, type Pixels, type Pt, type Quad } from '../src/mockup/mockupEngine';
import { centralQuad, detectSurfaceQuad, downscaleArea } from '../src/mockup/surfaceDetector';

type Rgba = [number, number, number, number];

function image(w: number, h: number, at: (x: number, y: number) => Rgba): Pixels {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) data.set(at(x + 0.5, y + 0.5), (y * w + x) * 4);
  }
  return { data, width: w, height: h };
}

/** Retângulo de meia-largura `a` e meia-altura `b` girado `deg` graus em torno de (cx, cy): cantos TL, TR, BR, BL. */
function rotatedRect(cx: number, cy: number, a: number, b: number, deg: number) {
  const t = (deg * Math.PI) / 180;
  const c = Math.cos(t);
  const s = Math.sin(t);
  const corners = ([[-a, -b], [a, -b], [a, b], [-a, b]] as Pt[]).map(([u, v]) => [cx + c * u - s * v, cy + s * u + c * v] as Pt);
  const inside = (x: number, y: number) => {
    const dx = x - cx;
    const dy = y - cy;
    return Math.abs(c * dx + s * dy) <= a && Math.abs(-s * dx + c * dy) <= b;
  };
  return { corners: corners as Quad, inside };
}

/** Ponto dentro do polígono convexo (cantos em ordem horária na tela). */
const insideConvex = (q: readonly Pt[], x: number, y: number) => q.every(([ax, ay], i) => {
  const [bx, by] = q[(i + 1) % q.length];
  return (bx - ax) * (y - ay) - (by - ay) * (x - ax) >= 0;
});

const LIGHT: Rgba = [220, 220, 220, 255];
const DARK: Rgba = [30, 30, 30, 255];

function expectCorners(got: Quad, want: Quad, tol: number): void {
  for (let i = 0; i < 4; i++) {
    const d = Math.hypot(got[i][0] - want[i][0], got[i][1] - want[i][1]);
    expect(d, `canto ${i}: ${got[i]} × ${want[i]}`).toBeLessThanOrEqual(tol);
  }
}

const allFinite = (q: Quad) => q.every(([x, y]) => Number.isFinite(x) && Number.isFinite(y));

describe('detectSurfaceQuad', () => {
  it('(a) retângulo claro girado 15° sobre fundo escuro (sem alfa): Sobel, cantos a ≤ 3 px na ordem TL, TR, BR, BL', () => {
    const r = rotatedRect(128, 128, 70, 45, 15);
    const det = detectSurfaceQuad(image(256, 256, (x, y) => (r.inside(x, y) ? LIGHT : DARK)));
    expect(det.method).toBe('sobel');
    expectCorners(det.quad, r.corners, 3);
    expect(isConvexQuad(det.quad)).toBe(true);
  });

  it('(a′) o mesmo girado −15°: a ordem dos cantos continua TL, TR, BR, BL', () => {
    const r = rotatedRect(128, 128, 70, 45, -15);
    const det = detectSurfaceQuad(image(256, 256, (x, y) => (r.inside(x, y) ? LIGHT : DARK)));
    expect(det.method).toBe('sobel');
    expectCorners(det.quad, r.corners, 3);
  });

  it('(b) o mesmo em 1024×1024: reduz a 256 e devolve os cantos na escala da entrada (≤ 12 px)', () => {
    const r = rotatedRect(512, 512, 280, 180, 15);
    const det = detectSurfaceQuad(image(1024, 1024, (x, y) => (r.inside(x, y) ? LIGHT : DARK)));
    expect(det.method).toBe('sobel');
    expectCorners(det.quad, r.corners, 12);
  });

  it('(b′) entrada não quadrada (1200×900): a escala horizontal e a vertical voltam certas', () => {
    const r = rotatedRect(600, 450, 320, 200, 12);
    const det = detectSurfaceQuad(image(1200, 900, (x, y) => (r.inside(x, y) ? LIGHT : DARK)));
    expect(det.method).toBe('sobel');
    expectCorners(det.quad, r.corners, 15);
  });

  it('(c) recorte com alfa: trapézio opaco sobre α = 0 com o MESMO RGB do fundo → alpha, cantos ≤ 2 px', () => {
    const trap: Quad = [[60, 40], [140, 40], [170, 120], [30, 120]];
    const det = detectSurfaceQuad(image(200, 160, (x, y) => [100, 100, 100, insideConvex(trap, x, y) ? 255 : 0]));
    expect(det.method).toBe('alpha');
    expectCorners(det.quad, trap, 2);
  });

  it('(c′) o mesmo RGB opaco sem recorte não acha nada (prova que o caminho do alfa é que achou)', () => {
    const det = detectSurfaceQuad(image(200, 160, () => [100, 100, 100, 255]));
    expect(det.method).toBe('fallback');
  });

  it('(d) imagem lisa: fallback igual ao quad central, tudo finito', () => {
    const det = detectSurfaceQuad(image(300, 200, () => [128, 128, 128, 255]));
    expect(det.method).toBe('fallback');
    expect(det.quad).toEqual(centralQuad(300, 200));
    expect(allFinite(det.quad)).toBe(true);
  });

  it('(e) ruído uniforme (LCG de semente fixa): fallback, sem NaN', () => {
    let seed = 12345;
    const rnd = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed >>> 24; };
    const det = detectSurfaceQuad(image(256, 256, () => [rnd(), rnd(), rnd(), 255]));
    expect(det.method).toBe('fallback');
    expect(allFinite(det.quad)).toBe(true);
  });

  it('(f) imagens minúsculas (2×2, 1×1, 0×0): fallback, não lança', () => {
    for (const [w, h] of [[2, 2], [1, 1], [0, 0], [2, 50]]) {
      const det = detectSurfaceQuad(image(w, h, () => [255, 0, 0, 255]));
      expect(det.method).toBe('fallback');
      expect(allFinite(det.quad)).toBe(true);
    }
  });

  it('(g) (a) + um pixel claro isolado perto do canto da imagem: o ruído é descartado, cantos ainda ≤ 3 px', () => {
    const r = rotatedRect(128, 128, 70, 45, 15);
    const det = detectSurfaceQuad(image(256, 256, (x, y) => {
      if (Math.floor(x) === 12 && Math.floor(y) === 12) return [255, 255, 255, 255];
      return r.inside(x, y) ? LIGHT : DARK;
    }));
    expect(det.method).toBe('sobel');
    expectCorners(det.quad, r.corners, 3);
  });

  it('(h) fundo com gradiente vertical leve (como a foto do E2E): o gradiente não vira borda', () => {
    const r = rotatedRect(128, 96, 68, 42, 12);
    const det = detectSurfaceQuad(image(256, 192, (x, y) => {
      if (r.inside(x, y)) return LIGHT;
      const v = 25 + (40 * y) / 192;
      return [v, v, v + 10, 255];
    }));
    expect(det.method).toBe('sobel');
    expectCorners(det.quad, r.corners, 3);
  });

  it('(i) objeto que ocupa a imagem quase toda (> 90 % da área): fallback', () => {
    const det = detectSurfaceQuad(image(100, 100, (x, y) => (x > 3 && x < 97 && y > 3 && y < 97 ? LIGHT : DARK)));
    expect(det.method).toBe('fallback');
  });
});

describe('downscaleArea', () => {
  it('reduz por média de área até o lado maior ≤ max e preserva a média', () => {
    const src = image(512, 256, (x) => (x < 256 ? [0, 0, 0, 255] : [200, 100, 50, 0]));
    const out = downscaleArea(src, 256);
    expect([out.width, out.height]).toEqual([256, 128]);
    expect([...out.data.subarray(0, 4)]).toEqual([0, 0, 0, 255]);
    const o = (10 * 256 + 200) * 4;
    expect([...out.data.subarray(o, o + 4)]).toEqual([200, 100, 50, 0]);
  });

  it('não mexe na imagem que já cabe', () => {
    const src = image(100, 80, () => [1, 2, 3, 4]);
    expect(downscaleArea(src, 256)).toBe(src);
  });
});
