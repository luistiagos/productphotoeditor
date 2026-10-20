import { describe, expect, it } from 'vitest';
import { createDocument, DocumentError, fontsUsed, parseDocument } from '../src/document';

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
