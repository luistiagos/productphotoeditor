import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { FabricObject, Rect } from 'fabric/node';
import {
  applyMergeRow, type CatalogRow, detectTemplateFields, discountLabel, generateMergedPages, type LiveText, MAX_CATALOG_ROWS,
  mergedPageName, mergeText, MIN_FONT_RATIO, parseCatalogText, parsePriceBR, shrinkTextToFit, swapPhotoJson,
} from '../src/dataMerge';
import { CUSTOM_PROPERTIES, type FabricJson } from '../src/document';

const WHATSAPP = `Tênis Corrida Pro; R$ 299,90; R$ 189,90
Camiseta Dry Fit; R$ 89,90; R$ 49,90
Meia Kit 3 Pares; R$ 39,90; R$ 19,90`;
const LONG = 'Parafusadeira e Furadeira de Impacto 20V Bivolt com Maleta';

/**
 * Texto falso com medida determinística: o `canvas` nativo do jsdom não está compilado nesta máquina, então o Fabric não
 * mede texto no vitest (a medida real se prova no E2E do aparelho). Cada caractere = 0,5 × fonte; linha = 1,16 × fonte.
 * Textbox quebra por palavra na largura e alarga para uma palavra que não cabe (como o `dynamicMinWidth` do Fabric);
 * IText/Text = uma linha por parágrafo.
 */
class FakeText implements LiveText {
  height = 0;
  constructor(public type: string, public text: string, public fontSize: number, public width = 0) { this.initDimensions(); }
  set(p: Record<string, unknown>) { Object.assign(this, p); return this; }
  initDimensions() {
    const cw = this.fontSize * 0.5, lh = this.fontSize * 1.16;
    const paras = this.text.split('\n');
    if (this.type.toLowerCase() === 'textbox') {
      const longest = Math.max(...this.text.split(/\s+/).map((w) => w.length)) * cw;
      if (longest > this.width) this.width = longest;
      let lines = 0;
      for (const para of paras) {
        let cur = 0;
        lines++;
        for (const w of para.split(' ')) {
          const add = (cur ? 1 : 0) + w.length;
          if (cur && (cur + add) * cw > this.width) { lines++; cur = w.length; } else cur += add;
        }
      }
      this.height = lines * lh;
    } else {
      this.width = Math.max(...paras.map((x) => x.length)) * cw;
      this.height = paras.length * lh;
    }
  }
}
const enliven = async (o: Record<string, unknown>) => new FakeText(String(o.type), String(o.text), Number(o.fontSize), Number(o.width));
/** JSON de texto com a caixa que o Fabric gravaria (medida pelo FakeText). */
const textJson = (type: 'Textbox' | 'IText', text: string, fontSize: number, extra: Record<string, unknown> = {}, width = 0) => {
  const t = new FakeText(type, text, fontSize, width);
  return { type, text, fontSize, width: t.width, height: t.height, fontFamily: 'sans-serif', ...extra };
};

let savedProps: string[];
beforeAll(() => { savedProps = FabricObject.customProperties; FabricObject.customProperties = [...CUSTOM_PROPERTIES]; });
afterAll(() => { FabricObject.customProperties = savedProps; });

describe('parseCatalogText', () => {
  it('lista do WhatsApp com `;`: produto, De, Por e o desconto calculado', () => {
    const { rows, dropped } = parseCatalogText(WHATSAPP);
    expect(dropped).toBe(0);
    expect(rows).toEqual([
      { produto: 'Tênis Corrida Pro', preco_de: 'R$ 299,90', preco_por: 'R$ 189,90', desconto: '-37%' },
      { produto: 'Camiseta Dry Fit', preco_de: 'R$ 89,90', preco_por: 'R$ 49,90', desconto: '-44%' },
      // 20 / 39,90 = 0,501 → 50%
      { produto: 'Meia Kit 3 Pares', preco_de: 'R$ 39,90', preco_por: 'R$ 19,90', desconto: '-50%' },
    ]);
  });

  it('TSV do Excel com cabeçalho (ordem e nomes livres, com acento)', () => {
    const { rows } = parseCatalogText('Código\tProduto\tPreço Por\tDe\r\nA1\tBoné\tR$ 29,90\tR$ 39,90\r\n\r\nB2\tMochila\tR$ 99,00\t');
    expect(rows).toEqual([
      { codigo: 'A1', produto: 'Boné', preco_por: 'R$ 29,90', preco_de: 'R$ 39,90', desconto: '-25%' },
      { codigo: 'B2', produto: 'Mochila', preco_por: 'R$ 99,00' },
    ]);
  });

  it('vírgula decimal não quebra coluna; CSV só com aspas; 2 colunas = produto e Por; | também separa', () => {
    expect(parseCatalogText('Caneca 350 ml R$ 24,90').rows).toEqual([{ produto: 'Caneca 350 ml R$ 24,90' }]);
    expect(parseCatalogText('"Tênis, Pro","R$ 299,90","R$ 189,90"').rows[0])
      .toEqual({ produto: 'Tênis, Pro', preco_de: 'R$ 299,90', preco_por: 'R$ 189,90', desconto: '-37%' });
    expect(parseCatalogText('Boné; R$ 29,90').rows).toEqual([{ produto: 'Boné', preco_por: 'R$ 29,90' }]);
    expect(parseCatalogText('Boné | R$ 39,90 | R$ 29,90 | 3x de R$ 9,97 | B-01').rows[0])
      .toEqual({ produto: 'Boné', preco_de: 'R$ 39,90', preco_por: 'R$ 29,90', parcelas: '3x de R$ 9,97', codigo: 'B-01', desconto: '-25%' });
  });

  it('linhas vazias ignoradas; acima de 50, descartadas e contadas', () => {
    expect(parseCatalogText('\n  \n;;\nX; R$ 1,00\n\n').rows).toEqual([{ produto: 'X', preco_por: 'R$ 1,00' }]);
    const sixty = Array.from({ length: 60 }, (_, i) => `Item ${i + 1}; R$ 10,00; R$ 8,00`).join('\n');
    const r = parseCatalogText(sixty);
    expect(r.rows).toHaveLength(MAX_CATALOG_ROWS);
    expect(r.dropped).toBe(10);
    expect(r.rows[49].produto).toBe('Item 50');
    expect(parseCatalogText('').rows).toEqual([]);
  });

  it('desconto que veio na linha fica como o usuário digitou', () => {
    expect(parseCatalogText('produto;de;por;desconto\nX;R$ 100;R$ 70;LEVE 3').rows[0].desconto).toBe('LEVE 3');
  });
});

describe('preço e desconto', () => {
  it('parsePriceBR', () => {
    expect(parsePriceBR('R$ 1.299,90')).toBe(1299.9);
    expect(parsePriceBR('189,90')).toBe(189.9);
    expect(parsePriceBR('R$ 1.299')).toBe(1299);
    expect(parsePriceBR('12.5')).toBe(12.5);
    expect(parsePriceBR('R$ 10.')).toBe(10);
    expect(parsePriceBR('grátis')).toBeUndefined();
    expect(parsePriceBR(undefined)).toBeUndefined();
  });

  it('De R$ 100 por R$ 70 → -30%; só quando De > Por > 0', () => {
    expect(discountLabel('R$ 100', 'R$ 70')).toBe('-30%');
    expect(discountLabel('R$ 299,90', 'R$ 189,90')).toBe('-37%');
    expect(discountLabel('R$ 70', 'R$ 100')).toBeUndefined();
    expect(discountLabel('R$ 100', 'R$ 100')).toBeUndefined();
    expect(discountLabel('R$ 100', 'R$ 99,90')).toBeUndefined(); // 0,1% arredonda para 0
    expect(discountLabel('', 'R$ 10')).toBeUndefined();
  });
});

/** Modelo: título marcado `produto`, dois preços marcados, um texto com {{desconto}} e {{company}}, foto marcada num grupo. */
function model(): FabricJson {
  return {
    background: '#ffffff',
    objects: [
      textJson('Textbox', 'Título', 155, { mergeField: 'produto', fontWeight: 700, left: 108, top: 60 }, 864),
      textJson('IText', 'R$ 0,00', 60, { mergeField: 'preco_de', linethrough: true }),
      textJson('IText', 'R$ 0,00', 90, { mergeField: 'preco_por' }),
      textJson('Textbox', 'Leve já! {{desconto}} na {{company}}', 40, { styles: [{ start: 0, end: 1, style: { fill: 'red' } }] }, 600),
      textJson('Textbox', 'Frete grátis', 30, { styles: [{ start: 0, end: 1, style: { fill: 'blue' } }] }, 400),
      {
        type: 'Group', left: 0, top: 0, width: 400, height: 300, objects: [{
          type: 'Image', src: '/blob/modelo.png', width: 800, height: 600, scaleX: 0.5, scaleY: 0.5, left: 540, top: 600,
          originX: 'center', originY: 'center', angle: 10, mergeField: 'foto', cropX: 50, cropY: 20,
        }],
      },
    ],
  };
}
const objs = (f: FabricJson) => f.objects as Record<string, unknown>[];
const groupImage = (f: FabricJson) => (objs(f)[5].objects as Record<string, unknown>[])[0];

describe('detectTemplateFields / mergeText / applyMergeRow', () => {
  it('campos marcados e {{…}} do lote, inclusive dentro de grupos; os do brand kit não', () => {
    expect(detectTemplateFields(model())).toEqual(['produto', 'preco_de', 'preco_por', 'desconto', 'foto']);
    expect(detectTemplateFields({ objects: [textJson('IText', '{{codigo}} {{tagline}}', 20)] })).toEqual(['codigo']);
    // `foto` só vale em imagem; texto marcado `foto` não conta
    expect(detectTemplateFields({ objects: [textJson('IText', 'x', 20, { mergeField: 'foto' })] })).toEqual([]);
    expect(detectTemplateFields({ objects: [] })).toEqual([]);
  });

  it('mergeText: campo do lote sem valor vira vazio; outros {{…}} ficam', () => {
    expect(mergeText('{{ produto }} por {{preco_por}} {{parcelas}}!', { produto: 'Boné', preco_por: 'R$ 9' })).toBe('Boné por R$ 9 !');
    expect(mergeText('{{company}} {{phone}}', { produto: 'x' })).toBe('{{company}} {{phone}}');
  });

  it('substitui inteiro e inline, zera styles só do que mudou, troca a foto no grupo e não muda o modelo', () => {
    const m = model();
    const before = JSON.stringify(m);
    const photo = { url: '/blob/nova.png', width: 1000, height: 1000 };
    const out = applyMergeRow(m, { produto: 'Tênis Corrida Pro', preco_de: 'R$ 299,90', preco_por: 'R$ 189,90', desconto: '-37%', photo });
    expect(JSON.stringify(m)).toBe(before);
    const o = objs(out);
    expect(o.map((x) => x.text)).toEqual(['Tênis Corrida Pro', 'R$ 299,90', 'R$ 189,90', 'Leve já! -37% na {{company}}', 'Frete grátis', undefined]);
    expect(o[0].mergeField).toBe('produto');
    expect(o[3].styles).toEqual([]);
    expect(o[4].styles).toEqual(objs(m)[4].styles);
    const img = groupImage(out);
    expect(img.src).toBe('/blob/nova.png');
    // espaço do modelo: 800×0,5 × 600×0,5 = 400 × 300; cover com a foto 1000×1000 → escala 0,4, recorte 1000×750 no centro
    expect(img.scaleX).toBeCloseTo(0.4);
    expect(img.scaleY).toBeCloseTo(0.4);
    expect(img.width).toBeCloseTo(1000);
    expect(img.height).toBeCloseTo(750);
    expect(img.cropX).toBeCloseTo(0);
    expect(img.cropY).toBeCloseTo(125);
    expect(Number(img.width) * Number(img.scaleX)).toBeCloseTo(400);
    expect(Number(img.height) * Number(img.scaleY)).toBeCloseTo(300);
    expect([img.left, img.top, img.angle, img.originX, img.mergeField]).toEqual([540, 600, 10, 'center', 'foto']);
  });

  it('linha sem foto mantém a foto do modelo; espelho preservado', () => {
    const img = groupImage(applyMergeRow(model(), { produto: 'X' }));
    expect([img.src, img.cropX]).toEqual(['/blob/modelo.png', 50]);
    const flipped = swapPhotoJson({ width: 100, height: 100, scaleX: -1, scaleY: 1 }, { url: 'u', width: 200, height: 100 });
    expect(flipped.scaleX).toBeCloseTo(-1);
    expect(Number(flipped.width) * Math.abs(Number(flipped.scaleX))).toBeCloseTo(100);
  });

  it('TASK-17: vinheta/borda/foco da foto passam a agir no recorte da foto nova; os outros filtros ficam como estavam', () => {
    const o = swapPhotoJson({
      width: 100, height: 100, scaleX: 1, scaleY: 1,
      filters: [{ type: 'Blur', blur: 0.2 }, { type: 'SoftEdge', softEdge: 0.5, x0: 0, y0: 0, x1: 1, y1: 1 },
        { type: 'FocusBlur', mode: 'radial', blur: 0.5, x0: 0.1, y0: 0.1, x1: 0.9, y1: 0.9 }],
    }, { url: 'u', width: 200, height: 100 });
    // cover num espaço quadrado: foto 200×100 recortada no centro, 100×100 a partir de x = 50
    expect([o.cropX, o.width]).toEqual([50, 100]);
    const fs = o.filters as Record<string, unknown>[];
    expect(fs[0]).toEqual({ type: 'Blur', blur: 0.2 });
    for (const f of fs.slice(1)) expect([f.x0, f.y0, f.x1, f.y1]).toEqual([0.25, 0, 0.75, 1]);
    expect(fs[1].softEdge).toBe(0.5);
    expect(fs[2].mode).toBe('radial');
  });
});

describe('shrinkTextToFit', () => {
  it('Textbox com o nome longo: a fonte diminui até caber na altura do modelo, ou para no piso de 65%', () => {
    const t = new FakeText('textbox', 'Título', 80, 864);
    const box = { width: t.width, height: t.height };
    t.set({ text: LONG });
    t.initDimensions();
    expect(t.height).toBeGreaterThan(box.height);
    const fs = shrinkTextToFit(t, box);
    expect(fs).toBeLessThan(80);
    expect(fs).toBeGreaterThanOrEqual(80 * MIN_FONT_RATIO - 1e-9);
    expect(t.height <= box.height + 0.5 || fs === 80 * MIN_FONT_RATIO).toBe(true);
    expect(t.width).toBe(864);
    expect(t.fontSize).toBe(fs);
  });

  it('cabe numa caixa de 2 linhas: para antes do piso, no 1º tamanho que cabe', () => {
    const t = new FakeText('textbox', 'Linha um\nLinha dois', 40, 1000);
    const box = { width: t.width, height: t.height };
    t.set({ text: 'Parafusadeira e Furadeira de Impacto 20V Bivolt com Maleta e Kit de Brocas e Bits Profissionais Completo' });
    t.initDimensions();
    expect(t.height).toBeGreaterThan(box.height);
    const fs = shrinkTextToFit(t, box);
    expect(fs).toBeGreaterThan(40 * MIN_FONT_RATIO);
    expect(fs).toBeLessThan(40);
    expect(t.height).toBeLessThanOrEqual(box.height + 0.5);
    // um passo (2%) maior não cabia
    const bigger = new FakeText('textbox', t.text, fs / 0.98, 1000);
    expect(bigger.height).toBeGreaterThan(box.height);
  });

  it('palavra que alargou o Textbox: a largura volta à do modelo a cada passo', () => {
    const t = new FakeText('textbox', 'Oi', 100, 300);
    const box = { width: t.width, height: t.height };
    t.set({ text: 'Supercalifragilistico' });
    t.initDimensions();
    expect(t.width).toBeGreaterThan(300);
    // 21 letras × 0,5 × 65 = 682 > 300: não cabe nem no piso, então para nele (sem cortar)
    expect(shrinkTextToFit(t, box)).toBeCloseTo(65);
    const ok = new FakeText('textbox', 'Oi', 100, 300);
    ok.set({ text: 'Abcdefg' }); // 7 × 50 = 350 > 300 a 100; cabe a ≤ 85,7
    ok.initDimensions();
    const fs = shrinkTextToFit(ok, { width: 300, height: box.height });
    expect(fs).toBeLessThan(86);
    expect(ok.width).toBe(300);
  });

  it('nome curto não muda; IText encolhe pela largura; nunca abaixo do piso', () => {
    const short = new FakeText('textbox', 'Título', 80, 864);
    const box = { width: short.width, height: short.height };
    short.set({ text: 'Boné' });
    expect(shrinkTextToFit(short, box)).toBe(80);
    const it1 = new FakeText('i-text', 'R$ 0,00', 90);
    const ibox = { width: it1.width, height: it1.height };
    it1.set({ text: 'R$ 12,90' });
    it1.initDimensions();
    const fs = shrinkTextToFit(it1, ibox);
    expect(fs).toBeLessThan(90);
    expect(it1.width).toBeLessThanOrEqual(ibox.width + 0.5);
    const huge = new FakeText('text', 'X', 100);
    const hbox = { width: huge.width, height: huge.height };
    huge.set({ text: 'XXXXXXXXXXXXXXXXXXXX' });
    huge.initDimensions();
    expect(shrinkTextToFit(huge, hbox)).toBeCloseTo(65);
  });
});

describe('generateMergedPages', () => {
  it('modelo + 5 linhas → 5 páginas com textos e descontos certos; nome longo encolhido; modelo intacto', async () => {
    const m = model();
    const before = JSON.stringify(m);
    const rows: CatalogRow[] = [
      { produto: LONG, preco_de: 'R$ 599,90', preco_por: 'R$ 399,90' },
      ...parseCatalogText(WHATSAPP).rows,
      { produto: 'Boné Aba Curva', preco_de: 'R$ 59,90', preco_por: 'R$ 39,90' },
    ];
    const pages = await generateMergedPages(m, rows, { enliven });
    expect(JSON.stringify(m)).toBe(before);
    expect(pages).toHaveLength(5);
    const texts = pages.map((p) => objs(p).map((o) => o.text));
    expect(texts.map((t) => t[0])).toEqual([LONG, 'Tênis Corrida Pro', 'Camiseta Dry Fit', 'Meia Kit 3 Pares', 'Boné Aba Curva']);
    // desconto calculado também para as linhas digitadas sem ele
    expect(texts.map((t) => t[3])).toEqual(['Leve já! -33% na {{company}}', 'Leve já! -37% na {{company}}', 'Leve já! -44% na {{company}}',
      'Leve já! -50% na {{company}}', 'Leve já! -33% na {{company}}']);
    const fsLong = Number(objs(pages[0])[0].fontSize);
    expect(fsLong).toBeLessThan(155);
    expect(fsLong).toBeGreaterThanOrEqual(155 * MIN_FONT_RATIO - 0.01);
    // texto que não mudou fica com a fonte do modelo
    expect(objs(pages[0])[4].fontSize).toBe(30);
    // sem `enliven`, nada é medido
    const raw = await generateMergedPages(m, rows.slice(0, 1));
    expect(objs(raw[0])[0].fontSize).toBe(155);
  });

  it('nome da página: o produto (até 40) ou Item N', () => {
    expect(mergedPageName({ produto: `  ${LONG}  ` }, 0)).toBe(LONG.slice(0, 40));
    expect(mergedPageName({}, 2)).toBe('Item 3');
  });
});

describe('mergeField no documento', () => {
  it('toObject() de um objeto marcado mantém o campo (rascunho e undo)', () => {
    expect(CUSTOM_PROPERTIES).toContain('mergeField');
    const r = new Rect({ width: 100, height: 40 });
    r.set('mergeField', 'preco_por');
    expect((r.toObject() as unknown as Record<string, unknown>).mergeField).toBe('preco_por');
  });
});
