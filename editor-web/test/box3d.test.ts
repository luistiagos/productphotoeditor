import { describe, expect, it } from 'vitest';
import {
  BOX_DEFAULTS, type BoxFace, boxFaces, type BoxParams, type BoxSource, coverWindow, FACE_LIGHT, type FaceName, facePoint,
  type FaceSlot, normalizeBox, parseBoxTemplates, rectOfQuad, renderBox, signedArea,
} from '../src/mockup/box3d';
import { parseMockup3dIndex, type Pixels, type Pt } from '../src/mockup/mockupEngine';

// índice lido do disco (fora da raiz do Vite), como no mockupEngine.test.ts
const INDEX_3D = '../../app/src/main/assets/content/mockups3d/index.json';
const NODE_FS = 'node:fs';
const fs = (await import(/* @vite-ignore */ NODE_FS)) as { readFileSync: (p: URL, enc: 'utf8') => string };
const loadJson = (rel: string): unknown => JSON.parse(fs.readFileSync(new URL(rel, import.meta.url), 'utf8'));

const RECT = { x: 100, y: 80, w: 600, h: 500 };
const params = (rotX: number, rotY: number, extra: Partial<BoxParams> = {}): BoxParams =>
  ({ ...BOX_DEFAULTS, boxRatio: { ...BOX_DEFAULTS.boxRatio }, rotX, rotY, ...extra });
const faces = (rotX: number, rotY: number, extra: Partial<BoxParams> = {}) => boxFaces(params(rotX, rotY, extra), RECT);
const names = (rotX: number, rotY: number, extra: Partial<BoxParams> = {}) => faces(rotX, rotY, extra).map((f) => f.name);
const byName = (fs: BoxFace[], n: FaceName) => fs.find((f) => f.name === n)!;
const centroid = (f: BoxFace): Pt => [f.quad.reduce((s, p) => s + p[0], 0) / 4, f.quad.reduce((s, p) => s + p[1], 0) / 4];
const near = (a: Pt, b: Pt) => Math.hypot(a[0] - b[0], a[1] - b[1]) < 1e-6;

const solid = (w: number, h: number, rgba: [number, number, number, number]): Pixels => {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let o = 0; o < data.length; o += 4) data.set(rgba, o);
  return { data, width: w, height: h };
};
const MAGENTA: [number, number, number, number] = [255, 0, 255, 255];
const px = (p: Pixels, x: number, y: number) => {
  const o = (Math.floor(y) * p.width + Math.floor(x)) * 4;
  return [p.data[o], p.data[o + 1], p.data[o + 2], p.data[o + 3]];
};
const at = (img: Pixels, f: BoxFace, s: number, t: number) => { const [x, y] = facePoint(f, s, t)!; return px(img, x, y); };
/** Igualdade de buffers grandes (o toEqual do vitest em 2 M elementos leva segundos). */
const same = (a: Uint8ClampedArray, b: Uint8ClampedArray) => a.length === b.length && a.every((v, i) => v === b[i]);
const color = (r: number, g: number, b: number): BoxSource => ({ kind: 'color', rgb: [r, g, b] });
const allSlots = (s: BoxSource): Record<FaceSlot, BoxSource> => ({ front: s, side: s, top: s });

describe('faces visíveis e convenção de sinais', () => {
  it('rotX = rotY = 0 → só a frente (em várias proporções e perspectivas)', () => {
    for (const fov of [15, 35, 75]) {
      for (const boxRatio of [{ w: 1, h: 1, d: 1 }, BOX_DEFAULTS.boxRatio, { w: 2, h: 0.2, d: 2 }]) {
        expect(names(0, 0, { fov, boxRatio })).toEqual(['front']);
      }
    }
  });

  it('Rotação Y = +30 → frente + lateral DIREITA, à direita da frente na tela; −30 → esquerda, à esquerda', () => {
    const r = faces(0, 30);
    expect(r.map((f) => f.name).sort()).toEqual(['front', 'right']);
    expect(centroid(byName(r, 'right'))[0]).toBeGreaterThan(centroid(byName(r, 'front'))[0]);
    const l = faces(0, -30);
    expect(l.map((f) => f.name).sort()).toEqual(['front', 'left']);
    expect(centroid(byName(l, 'left'))[0]).toBeLessThan(centroid(byName(l, 'front'))[0]);
  });

  it('Rotação X = −25 → o TOPO entra, acima da frente; +25 → a base, abaixo', () => {
    const t = faces(-25, 0);
    expect(t.map((f) => f.name).sort()).toEqual(['front', 'top']);
    expect(centroid(byName(t, 'top'))[1]).toBeLessThan(centroid(byName(t, 'front'))[1]);
    const b = faces(25, 0);
    expect(b.map((f) => f.name).sort()).toEqual(['bottom', 'front']);
    expect(centroid(byName(b, 'bottom'))[1]).toBeGreaterThan(centroid(byName(b, 'front'))[1]);
  });

  it('X = −25, Y = +30 → frente, lateral direita e topo, com o brilho 100/78/108 %', () => {
    const f = faces(-25, 30);
    expect(f.map((x) => x.name).sort()).toEqual(['front', 'right', 'top']);
    expect(byName(f, 'front').light).toBe(1);
    expect(byName(f, 'right').light).toBe(0.78);
    expect(byName(f, 'top').light).toBe(1.08);
    expect(FACE_LIGHT.bottom).toBe(0.78);
    expect(f.map((x) => x.slot).sort()).toEqual(['front', 'side', 'top']);
  });

  it('numa grade das faixas: o fundo nunca aparece, 1–3 faces, área > 0, ordem de trás para frente, tudo no disco do retângulo', () => {
    const ratios = [{ w: 1, h: 1, d: 1 }, BOX_DEFAULTS.boxRatio, { w: 2, h: 0.2, d: 2 }, { w: 0.2, h: 2, d: 0.2 }, { w: 0.2, h: 0.2, d: 2 }];
    const cx = RECT.x + RECT.w / 2;
    const cy = RECT.y + RECT.h / 2;
    const rMax = Math.min(RECT.w, RECT.h) / 2;
    let n = 0;
    for (let rotX = -60; rotX <= 60; rotX += 10) {
      for (let rotY = -80; rotY <= 80; rotY += 10) {
        for (const boxRatio of ratios) {
          for (const fov of [15, 35, 75]) {
            const fs = faces(rotX, rotY, { boxRatio, fov });
            n++;
            expect(fs.length).toBeGreaterThanOrEqual(1);
            expect(fs.length).toBeLessThanOrEqual(3);
            expect(fs.some((f) => f.name === 'back')).toBe(false);
            for (let i = 0; i < fs.length; i++) {
              expect(signedArea(fs[i].quad)).toBeGreaterThan(0);
              if (i > 0) expect(fs[i].depth).toBeLessThanOrEqual(fs[i - 1].depth);
              for (const [x, y] of fs[i].quad) {
                expect(Math.hypot(x - cx, y - cy)).toBeLessThanOrEqual(rMax + 1e-6);
                expect(x).toBeGreaterThanOrEqual(RECT.x - 1e-6);
                expect(x).toBeLessThanOrEqual(RECT.x + RECT.w + 1e-6);
                expect(y).toBeGreaterThanOrEqual(RECT.y - 1e-6);
                expect(y).toBeLessThanOrEqual(RECT.y + RECT.h + 1e-6);
              }
            }
          }
        }
      }
    }
    expect(n).toBe(13 * 17 * 5 * 3);
  });

  it('escala fixa ao girar: a aresta frente/lateral de um cubo muda de altura só pela perspectiva (< 15 % de 0° a 40°)', () => {
    // com o encaixe pelo bbox das faces a caixa encolheria ~30 % ao mostrar a lateral; com o disco da esfera, não
    const a = byName(faces(0, 0, { boxRatio: { w: 1, h: 1, d: 1 } }), 'front');
    const b = byName(faces(0, 40, { boxRatio: { w: 1, h: 1, d: 1 } }), 'front');
    const hA = a.quad[2][1] - a.quad[1][1];
    const hB = b.quad[2][1] - b.quad[1][1];
    expect(Math.abs(hB / hA - 1)).toBeLessThan(0.15);
  });

  it('arestas comuns coincidem e orientam a arte: lateral começa na aresta da frente; topo/base colados na frente', () => {
    const f = faces(-25, 30);
    const fr = byName(f, 'front');
    const ri = byName(f, 'right');
    const to = byName(f, 'top');
    expect(near(ri.quad[0], fr.quad[1]) && near(ri.quad[3], fr.quad[2])).toBe(true);
    expect(near(to.quad[3], fr.quad[0]) && near(to.quad[2], fr.quad[1])).toBe(true);
    const g = faces(25, -30);
    const fr2 = byName(g, 'front');
    const le = byName(g, 'left');
    const bo = byName(g, 'bottom');
    expect(near(le.quad[1], fr2.quad[0]) && near(le.quad[2], fr2.quad[3])).toBe(true);
    expect(near(bo.quad[0], fr2.quad[3]) && near(bo.quad[1], fr2.quad[2])).toBe(true);
  });
});

describe('renderBox', () => {
  const base = () => solid(800, 660, MAGENTA);

  it('faces cinza #808080: frente ≈ 128, topo ≈ 138 (108 %), lateral ≈ 100 (78 %) no centro de cada face', () => {
    const f = faces(-25, 30);
    const img = renderBox(base(), f, allSlots(color(128, 128, 128)));
    const c = (n: FaceName) => at(img, byName(f, n), 0.5, 0.5);
    for (const [n, v] of [['front', 128], ['top', 138], ['right', 100]] as [FaceName, number][]) {
      const [r, g, b, a] = c(n);
      expect(Math.abs(r - v)).toBeLessThanOrEqual(2);
      expect(Math.abs(g - v)).toBeLessThanOrEqual(2);
      expect(Math.abs(b - v)).toBeLessThanOrEqual(2);
      expect(a).toBe(255);
    }
  });

  it('cor por slot: frente vermelha, lateral verde, topo azul, cada uma com o seu brilho', () => {
    const f = faces(-25, 30);
    const img = renderBox(base(), f, { front: color(192, 0, 0), side: color(0, 192, 0), top: color(0, 0, 192) });
    expect(at(img, byName(f, 'front'), 0.5, 0.5).slice(0, 3)).toEqual([192, 0, 0]);
    expect(at(img, byName(f, 'right'), 0.5, 0.5).slice(0, 3)).toEqual([0, 150, 0]);
    expect(at(img, byName(f, 'top'), 0.5, 0.5).slice(0, 3)).toEqual([0, 0, 207]);
  });

  it('sem fresta: ao longo das arestas comuns (±1 px) nenhum pixel deixa vazar o fundo magenta; fora da silhueta, magenta', () => {
    for (const [rx, ry] of [[-25, 30], [-40, -55], [30, 70], [-30, 15]]) {
      const f = faces(rx, ry);
      const img = renderBox(base(), f, allSlots(color(128, 128, 128)));
      const fr = byName(f, 'front');
      const edges: [Pt, Pt][] = [];
      const side = f.find((x) => x.name === 'right' || x.name === 'left');
      const cap = f.find((x) => x.name === 'top' || x.name === 'bottom');
      if (side) edges.push(side.name === 'right' ? [fr.quad[1], fr.quad[2]] : [fr.quad[0], fr.quad[3]]);
      if (cap) edges.push(cap.name === 'top' ? [fr.quad[0], fr.quad[1]] : [fr.quad[3], fr.quad[2]]);
      // aresta lateral/tampa: TL–TR da lateral com o topo, BR–BL com a base (nas duas laterais)
      if (side && cap) edges.push(cap.name === 'top' ? [side.quad[0], side.quad[1]] : [side.quad[2], side.quad[3]]);
      expect(edges.length).toBe(3);
      for (const [p, q] of edges) {
        for (let t = 0.1; t <= 0.9001; t += 0.02) {
          const x = p[0] + (q[0] - p[0]) * t;
          const y = p[1] + (q[1] - p[1]) * t;
          for (const [dx, dy] of [[-1, 0], [0, 0], [1, 0], [0, -1], [0, 1]]) {
            // magenta tem G = 0; as faces cinza, G ≥ 99: qualquer mistura com o fundo derruba o G
            expect(px(img, x + dx, y + dy)[1]).toBeGreaterThanOrEqual(95);
          }
        }
      }
      // controle: o detector enxerga o fundo (3 px acima do canto mais alto da silhueta)
      const top = f.flatMap((x) => x.quad).reduce((m, v) => (v[1] < m[1] ? v : m));
      expect(px(img, top[0], top[1] - 3)).toEqual(MAGENTA);
    }
  });

  it('a arte cai em pé: na frente, metade de cima vermelha e de baixo azul; na lateral, a borda colada na frente é a esquerda da arte', () => {
    const art = solid(100, 100, [0, 0, 255, 255]);
    for (let y = 0; y < 50; y++) for (let x = 0; x < 100; x++) art.data.set([255, 0, 0, 255], (y * 100 + x) * 4);
    const artLR = solid(100, 100, [0, 0, 255, 255]);
    for (let y = 0; y < 100; y++) for (let x = 0; x < 50; x++) artLR.data.set([255, 0, 0, 255], (y * 100 + x) * 4);
    const f = faces(-20, 35, { boxRatio: { w: 1, h: 1, d: 1 } });
    const img = renderBox(base(), f, { front: { kind: 'art', pixels: art }, side: { kind: 'art', pixels: artLR }, top: color(9, 9, 9) });
    const fr = byName(f, 'front');
    const ri = byName(f, 'right');
    expect(at(img, fr, 0.5, 0.25).slice(0, 3)).toEqual([255, 0, 0]);
    expect(at(img, fr, 0.5, 0.75).slice(0, 3)).toEqual([0, 0, 255]);
    expect(at(img, ri, 0.2, 0.5).slice(0, 3)).toEqual([199, 0, 0]); // 255 × 0,78
    expect(at(img, ri, 0.8, 0.5).slice(0, 3)).toEqual([0, 0, 199]);
  });

  it('recorte "cover": arte 2:1 numa frente quadrada perde as bordas laterais (sem deformar)', () => {
    expect(coverWindow(200, 100, 1)).toEqual([50, 0, 150, 100]);
    expect(coverWindow(100, 200, 1)).toEqual([0, 50, 100, 150]);
    expect(coverWindow(100, 100, 0)).toEqual([0, 0, 100, 100]);
    const art = solid(200, 100, [0, 200, 0, 255]);
    for (let y = 0; y < 100; y++) for (let x = 50; x < 150; x++) art.data.set([200, 0, 0, 255], (y * 200 + x) * 4);
    const f = faces(0, 0, { boxRatio: { w: 1, h: 1, d: 1 } });
    const img = renderBox(base(), f, { front: { kind: 'art', pixels: art } });
    for (const s of [0.1, 0.5, 0.9]) expect(at(img, f[0], s, 0.5).slice(0, 3)).toEqual([200, 0, 0]);
  });

  it('arte transparente fica sobre branco (o papelão), não sobre o fundo', () => {
    const f = faces(0, 0);
    const img = renderBox(base(), f, { front: { kind: 'art', pixels: solid(10, 10, [0, 0, 0, 0]) } });
    expect(at(img, f[0], 0.5, 0.5)).toEqual([255, 255, 255, 255]);
  });

  it('sombra de contato: escurece logo abaixo da silhueta; com shadow 0, fora das faces nada muda', () => {
    const f = faces(-20, 30);
    const bottomY = Math.max(...f.flatMap((x) => x.quad.map((p) => p[1])));
    const xs = f.flatMap((x) => x.quad.map((p) => p[0]));
    const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
    const gray = () => solid(800, 660, [200, 200, 200, 255]);
    const no = renderBox(gray(), f, allSlots(color(128, 128, 128)));
    expect(px(no, cx, bottomY + 4)).toEqual([200, 200, 200, 255]);
    const yes = renderBox(gray(), f, allSlots(color(128, 128, 128)), { shadow: 0.4 });
    expect(px(yes, cx, bottomY + 4)[0]).toBeLessThan(170);
    expect(px(yes, 5, 5)).toEqual([200, 200, 200, 255]);
  });

  it('degenerados não lançam: retângulo vazio → nenhuma face; NaN e proporção 0 → presos; face colapsada é pulada', () => {
    expect(boxFaces(params(-20, 30), { x: 10, y: 10, w: 0, h: 50 })).toEqual([]);
    expect(boxFaces(params(-20, 30), { x: NaN, y: 10, w: 50, h: 50 })).toEqual([]);
    const nan = boxFaces({ rotX: NaN, rotY: NaN, fov: NaN, boxRatio: { w: NaN, h: 0, d: -3 } }, RECT);
    expect(nan.length).toBeGreaterThan(0);
    expect(nan.every((f) => f.quad.every(([x, y]) => Number.isFinite(x) && Number.isFinite(y)))).toBe(true);
    const b = base();
    expect(same(renderBox(b, [], allSlots(color(1, 2, 3))).data, b.data)).toBe(true);
    const flat: BoxFace = { name: 'front', slot: 'front', quad: [[50, 50], [50, 50], [50, 50], [50, 50]], depth: 1, light: 1, aspect: 1 };
    expect(same(renderBox(b, [flat], { front: { kind: 'art', pixels: solid(4, 4, [9, 9, 9, 255]) } }).data, b.data)).toBe(true);
    expect(() => renderBox(b, faces(-20, 30), {})).not.toThrow();
  });

  it('normalizeBox prende nas faixas da spec', () => {
    expect(normalizeBox({ rotX: 100, rotY: -200, fov: 5, boxRatio: { w: 9, h: 0, d: 'x' } }))
      .toEqual({ rotX: 60, rotY: -80, fov: 15, boxRatio: { w: 2, h: 0.2, d: BOX_DEFAULTS.boxRatio.d } });
    expect(normalizeBox(null)).toEqual(BOX_DEFAULTS);
  });
});

describe('template da caixa', () => {
  it('parseBoxTemplates pega só as entradas box3d válidas e prende os parâmetros', () => {
    const box = { id: 'b', name: 'B', shape: 'box3d', file: 'b.webp', thumb: 'b_t.webp', width: 100, height: 80,
      quad: [[10, 10], [90, 10], [90, 70], [10, 70]], rotX: -99, rotY: 10, boxRatio: { w: 1, h: 1, d: 1 }, fov: 40 };
    const list = parseBoxTemplates({ mockups: [
      { ...box, id: 'cil', shape: 'cylinder' }, box, { ...box, id: 'semquad', quad: [[1, 1]] },
      { ...box, id: 'vazio', quad: [[5, 5], [5, 5], [5, 5], [5, 5]] }, { ...box, id: 'semw', width: 0 },
    ] });
    expect(list.map((t) => t.id)).toEqual(['b']);
    expect(list[0]).toMatchObject({ shape: 'box3d', file: 'mockups3d/b.webp', thumb: 'mockups3d/b_t.webp', rotX: -60, rotY: 10, fov: 40 });
    expect(rectOfQuad(list[0].quad)).toEqual({ x: 10, y: 10, w: 80, h: 60 });
    expect(parseBoxTemplates(null)).toEqual([]);
  });

  it('o índice gerado tem a Caixa 3D (fora do parse da TASK-08) com a área de encaixe dentro da base', () => {
    const raw = loadJson(INDEX_3D);
    const boxes = parseBoxTemplates(raw);
    expect(boxes.map((t) => [t.id, t.name])).toEqual([['box', 'Caixa 3D']]);
    expect(parseMockup3dIndex(raw).some((t) => t.id === 'box')).toBe(false);
    const t = boxes[0];
    const r = rectOfQuad(t.quad);
    expect(r.x).toBeGreaterThanOrEqual(0);
    expect(r.y).toBeGreaterThanOrEqual(0);
    expect(r.x + r.w).toBeLessThanOrEqual(t.width);
    expect(r.y + r.h).toBeLessThanOrEqual(t.height);
    expect(t).toMatchObject({ rotX: -20, rotY: 30, boxRatio: { w: 1, h: 1.3, d: 0.6 }, fov: 35 });
    expect(boxFaces(t, r).map((f) => f.name).sort()).toEqual(['front', 'right', 'top']);
  });
});
