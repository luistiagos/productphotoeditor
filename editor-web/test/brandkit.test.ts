import { describe, expect, it } from 'vitest';
import { applyBrandKit, type BrandKit, fillVariables, parseBrandKit } from '../src/brandkit';
import { createDocument } from '../src/document';

const kit: BrandKit = {
  profile: { company: 'Doces da Ana', phone: '(11) 99999-0000', website: '' },
  colors: { primary: '#d81b60', text: '#222222', background: '#fff8e1' },
  fonts: { heading: 'Pacifico', body: 'Lato' },
  logoUrl: 'https://appassets.androidplatform.net/blob/logo.png',
};

function template() {
  return createDocument('t', 1080, 1080, {
    background: '#ffffff',
    brandBackground: 'background',
    objects: [
      { type: 'Rect', fill: '#000', brandColor: 'primary', stroke: '#111', brandStroke: 'accent' },
      { type: 'Textbox', text: '{{company}}', fontFamily: 'Arial', brandFont: 'heading', brandColor: 'text',
        styles: [{ start: 0, end: 2, style: { fill: 'red' } }] },
      { type: 'Group', objects: [{ type: 'Text', text: 'Ligue {{ phone }} · {{website}}', brandFont: 'body' }] },
      { type: 'Image', src: '/assets/content/placeholder-logo.svg', brandLogo: true },
      { type: 'Image', src: '/blob/photo.png' },
    ],
  });
}

describe('fillVariables', () => {
  it('fills known variables, uses the sample for empty ones and keeps unknown ones', () => {
    expect(fillVariables('{{company}} — {{ phone }} — {{website}} — {{nope}}', kit.profile))
      .toBe('Doces da Ana — (11) 99999-0000 — www.suaempresa.com.br — {{nope}}');
  });
});

describe('applyBrandKit', () => {
  it('applies colors, fonts, logo, variables and background without mutating the input', () => {
    const doc = template();
    const before = JSON.stringify(doc);
    const out = applyBrandKit(doc, kit);
    expect(JSON.stringify(doc)).toBe(before);
    const [rect, title, group, logo, photo] = out.fabric.objects as Record<string, any>[];
    expect(rect.fill).toBe('#d81b60');
    expect(rect.stroke).toBe('#111'); // papel "accent" sem cor no kit: não muda
    expect(title).toMatchObject({ text: 'Doces da Ana', fontFamily: 'Pacifico', fill: '#222222', styles: [] });
    expect(group.objects[0]).toMatchObject({ text: 'Ligue (11) 99999-0000 · www.suaempresa.com.br', fontFamily: 'Lato' });
    expect(title.brandSample).toBeUndefined();
    expect(logo.src).toBe(kit.logoUrl);
    expect(photo.src).toBe('/blob/photo.png');
    expect(out.fabric.background).toBe('#fff8e1');
  });

  it('can skip variables (re-applying a kit to an edited design)', () => {
    const out = applyBrandKit(template(), kit, { variables: false });
    const title = out.fabric.objects[1] as Record<string, unknown>;
    expect(title.text).toBe('{{company}}');
    expect(title.fontFamily).toBe('Pacifico');
  });

  it('recolors conversion badges and nested SVG groups with brandColor and brandStroke (ADS-04)', () => {
    const badgeDoc = createDocument('BadgeTest', 1080, 1080, {
      background: '#ffffff',
      objects: [
        {
          type: 'Group',
          layerName: 'Garantia 30 Dias',
          brandColor: 'primary',
          objects: [
            { type: 'Path', fill: '#166534', brandColor: 'primary' },
            { type: 'Rect', fill: '#f59e0b', brandColor: 'accent' },
            { type: 'Text', text: 'GARANTIA 30 DIAS', fill: '#ffffff' },
          ],
        },
      ],
    });
    const kitWithAccent: BrandKit = {
      ...kit,
      colors: { primary: '#2563eb', accent: '#facc15' },
    };
    const out = applyBrandKit(badgeDoc, kitWithAccent);
    const badgeGroup = out.fabric.objects[0] as Record<string, any>;
    expect(badgeGroup.fill).toBe('#2563eb');
    expect(badgeGroup.objects[0].fill).toBe('#2563eb');
    expect(badgeGroup.objects[1].fill).toBe('#facc15');
    expect(badgeGroup.objects[2].fill).toBe('#ffffff'); // texto branco preservado
  });

  const empty: BrandKit = { profile: {}, colors: {}, fonts: {} };

  it('an empty kit fills variables with sample text and changes nothing else', () => {
    const doc = template();
    const out = applyBrandKit(doc, empty);
    const [rect, title, group, logo] = out.fabric.objects as Record<string, any>[];
    expect(title.text).toBe('Sua empresa');
    expect(title.brandSample).toEqual({ source: '{{company}}', text: 'Sua empresa' });
    expect(group.objects[0].text).toBe('Ligue (00) 0000-0000 · www.suaempresa.com.br');
    expect(rect).toEqual(doc.fabric.objects[0]);
    expect(logo).toEqual(doc.fabric.objects[3]);
    expect(out.fabric.background).toBe('#ffffff');
  });

  it('an empty kit leaves a document without variables equal', () => {
    const doc = createDocument('t', 100, 100, { objects: [{ type: 'Textbox', text: 'Promoção' }, { type: 'Rect', fill: '#000' }] });
    expect(applyBrandKit(doc, empty)).toEqual(doc);
  });

  it('sample text is replaced when the kit is filled later, unless the user edited it', () => {
    const sampled = applyBrandKit(template(), empty);
    const edited = structuredClone(sampled);
    (edited.fabric.objects[1] as Record<string, unknown>).text = 'Loja do Zé';

    const refilled = applyBrandKit(sampled, kit).fabric.objects as Record<string, any>[];
    expect(refilled[1].text).toBe('Doces da Ana');
    expect(refilled[1].brandSample).toBeUndefined();
    // website continua vazio no kit: segue com exemplo e guarda o original
    expect(refilled[2].objects[0].text).toBe('Ligue (11) 99999-0000 · www.suaempresa.com.br');
    expect(refilled[2].objects[0].brandSample.source).toBe('Ligue {{ phone }} · {{website}}');

    const kept = applyBrandKit(edited, kit).fabric.objects as Record<string, any>[];
    expect(kept[1].text).toBe('Loja do Zé');
    expect(kept[1].brandSample).toBeUndefined();
  });

  it('colors-only re-apply does not touch sample text', () => {
    const sampled = applyBrandKit(template(), empty);
    const out = applyBrandKit(sampled, kit, { variables: false });
    expect(out.fabric.objects[1]).toMatchObject({ text: 'Sua empresa', brandSample: { source: '{{company}}' } });
  });
});

describe('parseBrandKit', () => {
  it('keeps only known string fields', () => {
    expect(parseBrandKit({ profile: { company: 'X', evil: 'y', phone: 3 }, colors: { primary: '#fff', foo: '#000' },
      fonts: { heading: 'A' }, logoUrl: '' })).toEqual({ profile: { company: 'X' }, colors: { primary: '#fff' }, fonts: { heading: 'A' } });
    expect(parseBrandKit(null)).toEqual({ profile: {}, colors: {}, fonts: {} });
  });
});

describe('applyBrandKit with pages (TASK-09)', () => {
  it('applies the kit to every page, not only to the active one, and fills each object once', () => {
    const t = template();
    const p2 = structuredClone(t.fabric);
    const p3 = { brandBackground: 'primary', objects: [{ type: 'Textbox', text: 'Fale com {{company}}', brandColor: 'primary', brandFont: 'body' }] };
    // como o Editor.toDocument: a página ativa é o MESMO objeto em `fabric` e em `pages[i]`
    const doc = createDocument('c', 1080, 1080, t.fabric, undefined, {
      pages: [{ id: 'a', width: 1080, height: 1080, fabric: t.fabric }, { id: 'b', width: 1080, height: 1920, fabric: p2 },
        { id: 'c', width: 1200, height: 628, fabric: p3 }],
      activePageIndex: 0,
    });
    const out = applyBrandKit(doc, kit);
    const titleOf = (f: { objects: unknown[] }) => (f.objects[1] as Record<string, unknown>);
    expect(titleOf(out.fabric)).toMatchObject({ text: 'Doces da Ana', fontFamily: 'Pacifico', fill: '#222222' });
    expect(titleOf(out.pages![1].fabric)).toMatchObject({ text: 'Doces da Ana', fontFamily: 'Pacifico', fill: '#222222' });
    expect(out.pages![2].fabric.objects[0]).toMatchObject({ text: 'Fale com Doces da Ana', fill: '#d81b60', fontFamily: 'Lato' });
    expect(out.pages![2].fabric.background).toBe('#d81b60');
    expect(out.pages![1].fabric.background).toBe('#fff8e1');
    // a ativa continua sendo uma só (o load lê `fabric`), com o texto preenchido uma vez
    expect(out.pages![0].fabric).toBe(out.fabric);
    expect(out.pages![0].width).toBe(1080);
  });
});
