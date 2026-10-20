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
