import { describe, expect, it } from 'vitest';
import {
  applyH, applySurfaceLighting, cylinderShade, cylTiltDt, homographyFromQuads, isConvexQuad, labelAspect, lightingFactor,
  meshFromQuad, parseFlatMockupIndex, parseMockup3dIndex, type Pixels, type Pt, type Quad, renderMockup, sampleBilinear,
  sphereUV, transformPoints, uCyl,
} from '../src/mockup/mockupEngine';

// os índices ficam fora da raiz do Vite (o import() não os resolve): lidos do disco. `node:fs` por nome em variável
// porque o tsconfig não carrega @types/node (`types: []`).
const INDEX_3D = '../../app/src/main/assets/content/mockups3d/index.json';
const INDEX_FLAT = '../../app/src/main/assets/content/mockups/index.json';
const NODE_FS = 'node:fs';
const fs = (await import(/* @vite-ignore */ NODE_FS)) as { readFileSync: (p: URL, enc: 'utf8') => string };
const loadJson = async (rel: string): Promise<unknown> => JSON.parse(fs.readFileSync(new URL(rel, import.meta.url), 'utf8'));

const solid = (w: number, h: number, rgba: [number, number, number, number]): Pixels => {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let o = 0; o < data.length; o += 4) data.set(rgba, o);
  return { data, width: w, height: h };
};
const px = (p: Pixels, x: number, y: number) => [...p.data.subarray((y * p.width + x) * 4, (y * p.width + x) * 4 + 4)];
const lum = (p: Pixels, x: number, y: number) => { const [r, g, b] = px(p, x, y); return 0.299 * r + 0.587 * g + 0.114 * b; };
/** Arte de teste: vermelho opaco com uma faixa vertical azul no meio (para medir onde a arte caiu). */
const redArt = (w = 64, h = 64): Pixels => solid(w, h, [220, 30, 30, 255]);

const RECT: Quad = [[0, 0], [400, 0], [400, 300], [0, 300]];
const QUAD: Quad = [[110, 80], [690, 130], [640, 520], [70, 470]];

describe('homografia', () => {
  it('leva os 4 cantos do retângulo nos 4 cantos do quad (erro < 1e-6) e o centro no cruzamento das diagonais', () => {
    const h = homographyFromQuads(RECT, QUAD)!;
    expect(h).not.toBeNull();
    for (let i = 0; i < 4; i++) {
      const [x, y] = applyH(h, RECT[i][0], RECT[i][1]);
      expect(Math.abs(x - QUAD[i][0])).toBeLessThan(1e-6);
      expect(Math.abs(y - QUAD[i][1])).toBeLessThan(1e-6);
    }
    // a homografia preserva retas: o centro do retângulo vai no cruzamento das diagonais do quad
    const [cx, cy] = applyH(h, 200, 150);
    const [[x0, y0], , [x2, y2]] = QUAD;
    const [, [x1, y1], , [x3, y3]] = QUAD;
    const d = (x0 - x2) * (y1 - y3) - (y0 - y2) * (x1 - x3);
    const ix = ((x0 * y2 - y0 * x2) * (x1 - x3) - (x0 - x2) * (x1 * y3 - y1 * x3)) / d;
    const iy = ((x0 * y2 - y0 * x2) * (y1 - y3) - (y0 - y2) * (x1 * y3 - y1 * x3)) / d;
    expect(Math.abs(cx - ix)).toBeLessThan(1e-6);
    expect(Math.abs(cy - iy)).toBeLessThan(1e-6);
  });

  it('a inversa (quad → retângulo) desfaz a direta', () => {
    const inv = homographyFromQuads(QUAD, RECT)!;
    const [x, y] = applyH(inv, ...applyH(homographyFromQuads(RECT, QUAD)!, 123, 77));
    expect(x).toBeCloseTo(123, 6);
    expect(y).toBeCloseTo(77, 6);
  });

  it('quad degenerado → null, sem lançar', () => {
    expect(homographyFromQuads(RECT, [[5, 5], [5, 5], [5, 5], [5, 5]])).toBeNull();
    expect(homographyFromQuads(RECT, [[0, 0], [100, 0], [200, 0], [50, 80]])).toBeNull(); // 3 colineares
    expect(isConvexQuad([[0, 0], [100, 0], [0, 100], [100, 100]])).toBe(false); // gravata-borboleta
    expect(isConvexQuad(QUAD)).toBe(true);
  });
});

describe('cilindro e esfera', () => {
  it('uCyl(0)=0, uCyl(0,5)=0,5, uCyl(1)=1, monotônica, derivada maior na borda que no centro', () => {
    for (const arc of [10, 110, 179]) {
      expect(uCyl(0, arc)).toBeCloseTo(0, 9);
      expect(uCyl(0.5, arc)).toBeCloseTo(0.5, 9);
      expect(uCyl(1, arc)).toBeCloseTo(1, 9);
      let last = -1;
      for (let s = 0; s <= 1.0000001; s += 0.01) {
        const u = uCyl(s, arc);
        expect(u).toBeGreaterThan(last);
        last = u;
      }
      const der = (s: number) => (uCyl(s + 1e-4, arc) - uCyl(s - 1e-4, arc)) / 2e-4;
      expect(der(0.02)).toBeGreaterThan(der(0.5));
    }
    // mais arco = mais compressão na borda
    const der = (s: number, arc: number) => (uCyl(s + 1e-4, arc) - uCyl(s - 1e-4, arc)) / 2e-4;
    expect(der(0.05, 170)).toBeGreaterThan(der(0.05, 110));
  });

  it('inclinação: zero no centro, máxima nas bordas e com o sinal de tiltDepth', () => {
    expect(cylTiltDt(0.5, 110, 0.3)).toBeCloseTo(0, 12);
    expect(cylTiltDt(0, 110, 0.3)).toBeCloseTo(0.3 * (1 - Math.cos((55 * Math.PI) / 180)), 9);
    expect(cylTiltDt(1, 110, -0.3)).toBeLessThan(0);
  });

  it('esfera: r=0 sem NaN (φ = sen α/α), r=1 cai na borda da textura, r>1 transparente', () => {
    const c = sphereUV(0, 0, 110)!;
    expect(c).toEqual([0.5, 0.5]);
    const e = sphereUV(1, 0, 110)!;
    expect(e[0]).toBeCloseTo(1, 9);
    expect(e[1]).toBeCloseTo(0.5, 9);
    const diag = sphereUV(Math.SQRT1_2, -Math.SQRT1_2, 140)!;
    expect(Math.hypot(diag[0] - 0.5, diag[1] - 0.5)).toBeCloseTo(0.5, 9);
    expect(sphereUV(0.8, 0.8, 110)).toBeNull();
    // perto do centro, sem salto
    const tiny = sphereUV(1e-12, 0, 110)!;
    expect(Number.isFinite(tiny[0])).toBe(true);
  });

  it('sombreamento automático do cilindro escurece as bordas e brilha perto de s = 0,32', () => {
    expect(cylinderShade(0, 110)).toBeLessThan(cylinderShade(0.5, 110));
    expect(cylinderShade(0.32, 110)).toBeGreaterThan(cylinderShade(0.5, 110));
  });

  it('proporção do rótulo: o cilindro desenrola o arco', () => {
    expect(labelAspect(RECT, 'plane', 110)).toBeCloseTo(400 / 300, 9);
    const a = (55 * Math.PI) / 180;
    expect(labelAspect(RECT, 'cylinder', 110)).toBeCloseTo((400 * a / Math.sin(a)) / 300, 9);
  });
});

describe('sampleBilinear', () => {
  it('no centro do pixel devolve o pixel; entre dois, a média; fora, transparente', () => {
    const img: Pixels = { data: new Uint8ClampedArray([0, 0, 0, 255, 200, 100, 50, 255]), width: 2, height: 1 };
    const out = [0, 0, 0, 0];
    sampleBilinear(img, 1.5, 0.5, out);
    expect(out.map(Math.round)).toEqual([200, 100, 50, 255]);
    sampleBilinear(img, 1, 0.5, out);
    expect(out.map(Math.round)).toEqual([100, 50, 25, 255]);
    sampleBilinear(img, -3, 0.5, out);
    expect(out[3]).toBe(0);
  });
});

describe('applySurfaceLighting', () => {
  const art = solid(8, 8, [180, 120, 60, 255]);

  it('base de luminância uniforme não altera a arte (cinza médio e branco)', () => {
    for (const g of [128, 250]) {
      const r = applySurfaceLighting(art, solid(8, 8, [g, g, g, 255]), 1);
      expect([...r.data]).toEqual([...art.data]);
    }
  });

  it('uma faixa escura na base escurece a arte só na faixa', () => {
    const base = solid(8, 8, [200, 200, 200, 255]);
    for (let y = 0; y < 8; y++) for (let x = 3; x < 5; x++) base.data.set([60, 60, 60, 255], (y * 8 + x) * 4);
    const r = applySurfaceLighting(art, base, 1);
    expect(lum(r, 3, 4)).toBeLessThan(lum(art, 3, 4) * 0.8);
    // fora da faixa a arte quase não muda (fica um pouco mais clara: a média caiu com a faixa)
    expect(Math.abs(lum(r, 0, 4) - lum(art, 0, 4))).toBeLessThan(lum(art, 0, 4) * 0.25);
    expect(lum(r, 0, 4)).toBeGreaterThan(lum(r, 3, 4));
  });

  it('o fator fica em [0,50; 1,35] e strength 0 é identidade', () => {
    for (const l of [0, 0.01, 0.2, 0.5, 0.9, 1]) {
      for (const m of [0, 0.1, 0.5, 1]) {
        for (const s of [0, 0.3, 0.65, 1]) {
          const f = lightingFactor(l, m, s);
          expect(f).toBeGreaterThanOrEqual(0.5);
          expect(f).toBeLessThanOrEqual(1.35);
        }
      }
    }
    expect(lightingFactor(0, 0.5, 1)).toBe(0.5);
    expect(lightingFactor(1, 0.25, 1)).toBe(1.35);
    const dark = solid(8, 8, [0, 0, 0, 255]);
    expect([...applySurfaceLighting(art, dark, 0).data]).toEqual([...art.data]);
  });

  it('pixels sem arte (α = 0) ficam intactos', () => {
    const empty = solid(4, 4, [10, 20, 30, 0]);
    const r = applySurfaceLighting(empty, solid(4, 4, [0, 0, 0, 255]), 1);
    expect([...r.data]).toEqual([...empty.data]);
  });
});

describe('renderMockup', () => {
  const base = solid(800, 600, [90, 140, 90, 255]);
  const center = (q: Quad): Pt => [(q[0][0] + q[1][0] + q[2][0] + q[3][0]) / 4, (q[0][1] + q[1][1] + q[2][1] + q[3][1]) / 4];

  it('plano: a arte aparece dentro do quad e a base fica intacta fora dele', () => {
    const r = renderMockup(base, redArt(), { shape: 'plane', quad: QUAD, arcDeg: 110, tiltDepth: 0, shadingStrength: 0, fit: 'stretch' });
    const [cx, cy] = center(QUAD).map(Math.round);
    expect(px(r, cx, cy)).toEqual([220, 30, 30, 255]);
    expect(px(r, 5, 5)).toEqual([90, 140, 90, 255]);
    expect(px(r, 780, 590)).toEqual([90, 140, 90, 255]);
    // a base de entrada não é alterada
    expect(px(base, cx, cy)).toEqual([90, 140, 90, 255]);
  });

  it('malha 3×3 com os 16 pontos retos dá o mesmo resultado do plano (pixel a pixel, ±1)', () => {
    const art = redArt(64, 48);
    for (let i = 0; i < art.data.length; i += 4) { const k = i / 4; art.data[i + 2] = (k * 7) % 256; art.data[i + 1] = (k * 3) % 256; }
    const p = { shape: 'plane' as const, quad: QUAD, arcDeg: 110, tiltDepth: 0, shadingStrength: 0 };
    const flat = renderMockup(base, art, p);
    const meshed = renderMockup(base, art, { ...p, mesh: meshFromQuad(QUAD)! });
    let maxDiff = 0;
    for (let i = 0; i < flat.data.length; i++) maxDiff = Math.max(maxDiff, Math.abs(flat.data[i] - meshed.data[i]));
    expect(maxDiff).toBeLessThanOrEqual(1);
  });

  it('malha deslocada move a arte (dobra de tecido)', () => {
    const mesh = meshFromQuad(RECT.map(([x, y]) => [x + 200, y + 150]) as Quad)!;
    const p = { shape: 'plane' as const, quad: RECT.map(([x, y]) => [x + 200, y + 150]) as Quad, arcDeg: 110, tiltDepth: 0, shadingStrength: 0 };
    const art = solid(40, 30, [0, 0, 0, 255]);
    for (let y = 0; y < 30; y++) for (let x = 20; x < 40; x++) art.data.set([255, 255, 255, 255], (y * 40 + x) * 4);
    const a = renderMockup(base, art, { ...p, mesh, fit: 'stretch' });
    const bent = mesh.map(([x, y], i) => ((i % 4 === 1 || i % 4 === 2) ? [x + 40, y] : [x, y]) as Pt);
    const b = renderMockup(base, art, { ...p, mesh: bent, fit: 'stretch' });
    // a divisa preto/branco (s = 0,5 → x = 400) anda para a direita com as colunas do meio da malha
    expect(px(a, 410, 300)[0]).toBe(255);
    expect(px(b, 410, 300)[0]).toBe(0);
  });

  it('cilindro: a arte encolhe nas bordas quando o arco aumenta, e a forma muda o resultado', () => {
    const art = redArt(64, 64);
    const q: Quad = [[200, 100], [600, 100], [600, 500], [200, 500]];
    const p = { quad: q, tiltDepth: 0, shadingStrength: 0 };
    const width = (r: Pixels) => { let n = 0; for (let x = 0; x < 800; x++) if (px(r, x, 300)[0] > 150) n++; return n; };
    const c110 = renderMockup(base, art, { ...p, shape: 'cylinder', arcDeg: 110 });
    const c170 = renderMockup(base, art, { ...p, shape: 'cylinder', arcDeg: 170 });
    expect(width(c110)).toBeGreaterThan(0);
    expect(width(c170)).toBeLessThan(width(c110));
    const sph = renderMockup(base, art, { ...p, shape: 'sphere', arcDeg: 110 });
    expect(px(sph, 205, 105)).toEqual([90, 140, 90, 255]); // canto do quad: fora do disco
    expect(px(sph, 400, 300)[0]).toBeGreaterThan(150);
  });

  it('cilindro com inclinação curva a base do rótulo (sobe nas bordas)', () => {
    const q: Quad = [[200, 100], [600, 100], [600, 500], [200, 500]];
    const r = renderMockup(base, redArt(), { shape: 'cylinder', quad: q, arcDeg: 120, tiltDepth: 0.4, shadingStrength: 0, fit: 'stretch' });
    const bottom = (x: number) => { let y = 599; while (y > 0 && px(r, x, y)[0] < 150) y--; return y; };
    expect(bottom(400)).toBeGreaterThan(bottom(215) + 20);
  });

  it('fusão: a faixa escura da base escurece a arte projetada', () => {
    const b = solid(800, 600, [210, 210, 210, 255]);
    for (let y = 0; y < 600; y++) for (let x = 380; x < 420; x++) b.data.set([70, 70, 70, 255], (y * 800 + x) * 4);
    const p = { shape: 'plane' as const, quad: [[200, 100], [600, 100], [600, 500], [200, 500]] as Quad, arcDeg: 110, tiltDepth: 0, fit: 'stretch' as const };
    const off = renderMockup(b, redArt(), { ...p, shadingStrength: 0 });
    const on = renderMockup(b, redArt(), { ...p, shadingStrength: 1 });
    expect(lum(on, 400, 300)).toBeLessThan(lum(off, 400, 300) * 0.8);
  });

  it('quad degenerado ou não convexo devolve a base, sem lançar', () => {
    for (const quad of [[[5, 5], [5, 5], [5, 5], [5, 5]], [[0, 0], [100, 0], [0, 100], [100, 100]]] as Quad[]) {
      const r = renderMockup(base, redArt(), { shape: 'cylinder', quad, arcDeg: 110, tiltDepth: 0, shadingStrength: 1 });
      expect([...r.data.subarray(0, 4000)]).toEqual([...base.data.subarray(0, 4000)]);
    }
  });

  it('a malha segue o quad quando um canto é arrastado (homografia quad antigo → novo)', () => {
    const moved: Quad = [[QUAD[0][0] - 30, QUAD[0][1] - 20], QUAD[1], QUAD[2], QUAD[3]];
    const m = transformPoints(homographyFromQuads(QUAD, moved)!, meshFromQuad(QUAD)!);
    expect(m[0][0]).toBeCloseTo(moved[0][0], 6);
    expect(m[15][0]).toBeCloseTo(moved[2][0], 6);
  });
});

describe('índices de templates', () => {
  it('parseMockup3dIndex descarta forma desconhecida, quad inválido e malha incompleta', () => {
    const ok = { id: 'a', name: 'A', shape: 'cylinder', file: 'a.webp', thumb: 'a_t.webp', width: 100, height: 100, quad: [[10, 10], [90, 10], [90, 90], [10, 90]], arcDeg: 400 };
    const list = parseMockup3dIndex({ mockups: [ok, { ...ok, id: 'b', shape: 'box3d' }, { ...ok, id: 'c', quad: [[0, 0]] },
      { ...ok, id: 'd', shape: 'plane', mesh: [[1, 2]] }] });
    expect(list.map((t) => t.id)).toEqual(['a']);
    expect(list[0].file).toBe('mockups3d/a.webp');
    expect(list[0].arcDeg).toBe(179);
    expect(list[0].shadingStrength).toBe(0.65);
  });

  it('o índice gerado (content/mockups3d) é válido: formas conhecidas, quads convexos dentro da base, malha de 16 pontos', async () => {
    const raw = await loadJson(INDEX_3D) as { mockups: { shape?: unknown }[] };
    const list = parseMockup3dIndex(raw);
    // a Caixa 3D (`box3d`, TASK-19) é lida pelo `parseBoxTemplates` do box3d.ts (box3d.test.ts); as demais entram todas
    expect(list.length).toBe(raw.mockups.filter((e) => e.shape !== 'box3d').length);
    expect(raw.mockups.length - list.length).toBe(1);
    expect(list.map((t) => t.id).sort()).toEqual(['ball', 'ecobag', 'jar', 'mug', 'tshirt']);
    expect(new Set(list.map((t) => t.shape))).toEqual(new Set(['plane', 'cylinder', 'sphere']));
    for (const t of list) {
      expect(t.width).toBeLessThanOrEqual(1600);
      expect(t.height).toBeLessThanOrEqual(1600);
      for (const [x, y] of [...t.quad, ...(t.mesh ?? [])]) {
        expect(x).toBeGreaterThanOrEqual(0);
        expect(x).toBeLessThanOrEqual(t.width);
        expect(y).toBeGreaterThanOrEqual(0);
        expect(y).toBeLessThanOrEqual(t.height);
      }
    }
    expect(list.filter((t) => t.mesh).map((t) => t.id).sort()).toEqual(['ecobag', 'tshirt']);
  });

  it('os 4 planos do fluxo Kotlin entram como plano, com o quad do 1º slot', async () => {
    const list = parseFlatMockupIndex(await loadJson(INDEX_FLAT));
    expect(list.length).toBe(4);
    expect(list.every((t) => t.shape === 'plane' && t.file.startsWith('mockups/') && t.id.startsWith('plano_'))).toBe(true);
  });
});
