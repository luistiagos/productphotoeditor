import { describe, expect, it } from 'vitest';
import {
  type Box, classifyLayers, PRODUCT_SHARE, reflowMode, type ReflowItem, type ReflowPlacement, safeZone916, smartReflowLayout,
} from '../src/magicResize';

// Post 1080×1080 como o E2E monta: fundo, logo no topo, foto do produto no meio e dois textos centralizados (o "Adicionar
// texto" põe tudo no centro da página)
const SRC = { width: 1080, height: 1080 };
const box = (left: number, top: number, width: number, height: number): Box => ({ left, top, width, height });
const post = (): ReflowItem[] => [
  { id: 0, kind: 'other', background: true, box: box(0, 0, 1080, 1080) },
  { id: 1, kind: 'image', box: box(40, 40, 120, 120) }, // logo
  { id: 2, kind: 'image', box: box(216, 216, 648, 648) }, // produto
  { id: 3, kind: 'text', fontSize: 120, box: box(108, 470, 864, 140) }, // título
  { id: 4, kind: 'text', fontSize: 60, box: box(240, 505, 600, 70) }, // preço
];

const byId = (ps: ReflowPlacement[], id: number) => ps.find((p) => p.id === id)!;
const cx = (b: Box) => b.left + b.width / 2;
const cy = (b: Box) => b.top + b.height / 2;
const inside = (b: Box, W: number, H: number) =>
  b.left >= -1e-6 && b.top >= -1e-6 && b.left + b.width <= W + 1e-6 && b.top + b.height <= H + 1e-6;

describe('reflowMode', () => {
  it('picks the layout by the target aspect', () => {
    expect(reflowMode(SRC, { width: 1200, height: 1200 })).toBe('uniform');
    expect(reflowMode(SRC, { width: 1080, height: 1350 })).toBe('stacked');
    expect(reflowMode(SRC, { width: 1080, height: 1920 })).toBe('vertical');
    expect(reflowMode(SRC, { width: 1920, height: 1080 })).toBe('horizontal');
    expect(reflowMode(SRC, { width: 1200, height: 627 })).toBe('horizontal');
  });
});

describe('classifyLayers', () => {
  it('finds background, header, product, and splits the centered texts by font size', () => {
    const r = classifyLayers(post(), SRC);
    expect([0, 1, 2, 3, 4].map((i) => r.get(i))).toEqual(['background', 'header', 'product', 'title', 'cta']);
  });

  it('uses the position against the product when the texts are above / below it', () => {
    const items: ReflowItem[] = [
      { id: 0, kind: 'image', box: box(300, 300, 480, 480) },
      { id: 1, kind: 'text', fontSize: 40, box: box(200, 240, 680, 50) }, // acima, fonte menor
      { id: 2, kind: 'text', fontSize: 90, box: box(200, 900, 680, 100) }, // abaixo, fonte maior
      { id: 3, kind: 'other', box: box(800, 800, 200, 200) }, // selo de preço embaixo
    ];
    const r = classifyLayers(items, SRC);
    expect([0, 1, 2, 3].map((i) => r.get(i))).toEqual(['product', 'title', 'cta', 'cta']);
  });
});

describe('smartReflowLayout', () => {
  it('1080² → 1080×1920: product centered in the middle with ~half of the useful band, title on top, price at the bottom', () => {
    const W = 1080, H = 1920;
    const out = smartReflowLayout(post(), SRC, { width: W, height: H });
    const sz = safeZone916({ width: W, height: H });
    const m = 0.05 * W;
    const band = H - sz.top - sz.bottom - 2 * m;
    const product = byId(out, 2).box, title = byId(out, 3).box, price = byId(out, 4).box, logo = byId(out, 1).box;
    expect(cy(product)).toBeGreaterThan(H / 3);
    expect(cy(product)).toBeLessThan((2 * H) / 3);
    expect(cx(product)).toBeCloseTo(W / 2, 6);
    expect(product.height / band).toBeGreaterThanOrEqual(0.45);
    expect(product.height / band).toBeLessThanOrEqual(PRODUCT_SHARE + 0.05);
    expect(cy(title)).toBeLessThan(H / 3);
    expect(title.top + title.height).toBeLessThanOrEqual(product.top + 1e-6);
    expect(logo.top + logo.height).toBeLessThanOrEqual(title.top + 1e-6);
    expect(cy(price)).toBeGreaterThan((2 * H) / 3);
    expect(price.top).toBeGreaterThanOrEqual(product.top + product.height - 1e-6);
    for (const p of out.filter((x) => x.role !== 'background')) {
      expect(inside(p.box, W, H), `#${p.id}`).toBe(true);
      // fora das áreas cobertas pela interface de Reels/Stories (TASK-01)
      expect(p.box.top).toBeGreaterThanOrEqual(sz.top - 1e-6);
      expect(p.box.top + p.box.height).toBeLessThanOrEqual(H - sz.bottom + 1e-6);
    }
    for (const id of [2, 4]) expect(byId(out, id).box.left + byId(out, id).box.width).toBeLessThanOrEqual(W - sz.right + 1e-6);
  });

  it('1080² → 1920×1080: product on the left half, texts on the right half', () => {
    const W = 1920, H = 1080;
    const out = smartReflowLayout(post(), SRC, { width: W, height: H });
    const product = byId(out, 2).box;
    expect(cx(product)).toBeLessThan(W / 2);
    expect(product.left + product.width).toBeLessThanOrEqual(W / 2);
    expect(product.width / (W - 2 * 0.05 * H)).toBeGreaterThanOrEqual(0.45);
    for (const id of [1, 3, 4]) {
      const b = byId(out, id).box;
      expect(b.left, `#${id}`).toBeGreaterThanOrEqual(W / 2);
      expect(cx(b), `#${id}`).toBeGreaterThan(W / 2);
    }
    // ordem de cima para baixo: logo, título, preço
    expect(cy(byId(out, 1).box)).toBeLessThan(cy(byId(out, 3).box));
    expect(cy(byId(out, 3).box)).toBeLessThan(cy(byId(out, 4).box));
    for (const p of out) expect(inside(p.box, W, H), `#${p.id}`).toBe(true);
  });

  it('turns the background into a cover of the new page', () => {
    const bg = byId(smartReflowLayout(post(), SRC, { width: 1080, height: 1920 }), 0);
    expect(bg.role).toBe('background');
    expect(bg.box).toEqual({ left: 0, top: 0, width: 1080, height: 1920 });
    expect(bg.scale).toBeCloseTo(1920 / 1080, 6);
  });

  it('only scales (keeps the arrangement) when the aspect barely changes', () => {
    const out = smartReflowLayout(post(), SRC, { width: 1200, height: 1200 });
    const s = 1200 / 1080;
    for (const p of out.filter((x) => x.role !== 'background')) {
      const src = post().find((i) => i.id === p.id)!.box;
      expect(p.scale).toBeCloseTo(s, 6);
      expect(p.box.left).toBeCloseTo(src.left * s, 6);
      expect(p.box.top).toBeCloseTo(src.top * s, 6);
    }
  });

  it('keeps everything inside the page, even what started outside or is huge', () => {
    const items: ReflowItem[] = [
      ...post(),
      { id: 5, kind: 'other', box: box(-300, 900, 500, 400) }, // meio fora da página
      { id: 6, kind: 'text', fontSize: 300, box: box(-100, 980, 1400, 500) }, // maior que a página
    ];
    for (const dst of [{ width: 1080, height: 1920 }, { width: 1920, height: 1080 }, { width: 1200, height: 1200 }, { width: 1080, height: 1350 }]) {
      for (const p of smartReflowLayout(items, SRC, dst)) expect(inside(p.box, dst.width, dst.height), `${dst.width}x${dst.height} #${p.id}`).toBe(true);
    }
  });

  it('works without a product photo (texts only)', () => {
    const items = post().filter((i) => i.kind !== 'image');
    const out = smartReflowLayout(items, SRC, { width: 1080, height: 1920 });
    expect(cy(byId(out, 3).box)).toBeLessThan(cy(byId(out, 4).box));
    for (const p of out) expect(inside(p.box, 1080, 1920)).toBe(true);
  });
});
