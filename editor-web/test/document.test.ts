import { describe, expect, it } from 'vitest';
import { createDocument, DocumentError, fabricFontsUsed, fontsUsed, parseDocument } from '../src/document';

const fabric = {
  version: '7.4.0',
  background: '#fff',
  objects: [
    { type: 'Textbox', text: 'Oi', fontFamily: 'Montserrat', styles: [{ start: 0, end: 1, style: { fontFamily: 'Lobster' } }] },
    { type: 'Group', objects: [{ type: 'Text', text: 'x', fontFamily: 'Oswald' }, { type: 'Rect' }] },
  ],
};

describe('document', () => {
  it('round-trips through JSON', () => {
    const doc = createDocument('Cartaz', 1080, 1350, fabric);
    expect(parseDocument(JSON.stringify(doc))).toEqual(doc);
  });

  it('migrates a bare Fabric JSON (version 0)', () => {
    const doc = parseDocument({ ...fabric, width: 800, height: 600 });
    expect(doc).toMatchObject({ format: 'pp-editor', version: 1, width: 800, height: 600, name: 'Sem nome' });
    expect(doc.fabric.objects).toHaveLength(2);
    expect(doc.fabric).not.toHaveProperty('width');
  });

  it('migrates a legacy scenes template (Videorey format)', () => {
    const legacy = {
      name: 'Template Teste',
      scenes: [
        {
          cWidth: 500,
          cHeight: 500,
          background: '#f0f0f0',
          objects: [{ type: 'image', left: 250, top: 250 }],
        },
      ],
    };
    const doc = parseDocument(legacy);
    expect(doc).toMatchObject({ format: 'pp-editor', version: 1, width: 500, height: 500, name: 'Template Teste' });
    expect(doc.fabric.objects).toHaveLength(1);
    expect(doc.fabric.background).toBe('#f0f0f0');
  });

  it('rejects invalid documents', () => {
    const good = createDocument('a', 10, 10, fabric);
    const bad: unknown[] = ['{', 42, { format: 'other' }, { ...good, version: 9 }, { ...good, width: 0 },
      { ...good, height: 99999 }, { ...good, fabric: { objects: 'x' } }, { objects: [] }];
    for (const b of bad) expect(() => parseDocument(b), JSON.stringify(b)).toThrow(DocumentError);
  });

  it('lists fonts in objects, groups and per-character styles', () => {
    expect(fontsUsed(createDocument('a', 10, 10, fabric))).toEqual(['Lobster', 'Montserrat', 'Oswald']);
  });
});

describe('document pages (TASK-09)', () => {
  const page = (id: string, w: number, h: number, text: string, font = 'Montserrat') =>
    ({ id, width: w, height: h, fabric: { objects: [{ type: 'Textbox', text, fontFamily: font }] } });
  const three = () => [page('a', 1080, 1080, 'capa'), page('b', 1080, 1920, 'story', 'Pacifico'), page('c', 1200, 1200, 'oferta')];

  it('round-trips a 3-page document through JSON', () => {
    const pages = three();
    const doc = createDocument('Carrossel', 1080, 1920, pages[1].fabric, undefined, { pages, activePageIndex: 1 });
    const back = parseDocument(JSON.stringify(doc));
    expect(back).toEqual(doc);
    expect(back.pages!.map((p) => p.id)).toEqual(['a', 'b', 'c']);
    expect(back.pages![2]).toMatchObject({ width: 1200, height: 1200 });
    expect(back.activePageIndex).toBe(1);
  });

  it('keeps a current one-page draft (no pages) identical', () => {
    const doc = createDocument('Cartaz', 1080, 1350, fabric);
    const back = parseDocument(JSON.parse(JSON.stringify(doc)));
    expect(back).toEqual(doc);
    expect(back).not.toHaveProperty('pages');
    expect(back).not.toHaveProperty('activePageIndex');
    // uma página só também sai sem `pages`
    expect(createDocument('x', 10, 10, fabric, undefined, { pages: [page('a', 10, 10, 'oi')], activePageIndex: 0 })).not.toHaveProperty('pages');
  });

  it('rejects an invalid page', () => {
    const good = createDocument('a', 10, 10, fabric);
    const bad: unknown[] = [
      { ...good, pages: 'x' },
      { ...good, pages: [page('a', 10, 10, 'oi'), { ...page('b', 10, 10, 'x'), width: 0 }] },
      { ...good, pages: [page('a', 10, 10, 'oi'), { ...page('b', 10, 10, 'x'), fabric: { objects: 'x' } }] },
      { ...good, pages: [page('a', 10, 10, 'oi'), { ...page('b', 10, 10, 'x'), id: '' }] },
      { ...good, pages: [page('a', 10, 10, 'oi'), page('a', 10, 10, 'x')] },
      { ...good, pages: [page('a', 10, 10, 'oi'), 42] },
    ];
    for (const b of bad) expect(() => parseDocument(b), JSON.stringify(b)).toThrow(DocumentError);
  });

  it('puts an out-of-range active index back to 0', () => {
    const good = createDocument('a', 1080, 1080, fabric);
    for (const i of [-1, 3, 1.5, '1', null]) {
      expect(parseDocument({ ...good, pages: three(), activePageIndex: i }).activePageIndex, String(i)).toBe(0);
    }
    expect(parseDocument({ ...good, pages: three() }).activePageIndex).toBe(0);
  });

  it('finds the fonts of inactive pages', () => {
    const pages = three();
    const doc = createDocument('c', 1080, 1080, pages[0].fabric, undefined, { pages, activePageIndex: 0 });
    expect(fontsUsed(doc)).toEqual(['Montserrat', 'Pacifico']);
    expect(fabricFontsUsed(doc.fabric)).toEqual(['Montserrat']);
  });
});
