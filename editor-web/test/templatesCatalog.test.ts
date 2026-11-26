import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { applyBrandKit, COLOR_ROLES, FONT_ROLES, type BrandKit } from '../src/brandkit';
import { fontsUsed, parseDocument, walkObjects } from '../src/document';

const CONTENT_DIR = resolve(__dirname, '../../app/src/main/assets/content');

interface RawIndex {
  fonts: Array<{ family: string }>;
  templates: Array<{ id: string; name: string; category: string; file: string }>;
}

const sampleKit: BrandKit = {
  profile: { company: 'Ateliê Luz', slogan: 'Qualidade diária', phone: '(11) 98888-0000', website: 'atelieluz.com.br' },
  colors: { primary: '#d81b60', secondary: '#8e24aa', accent: '#f59e0b', text: '#1f2937', background: '#fffaf0' },
  fonts: { heading: 'Playfair Display', body: 'Inter' },
};

describe('offline templates catalog', () => {
  const index = JSON.parse(readFileSync(resolve(CONTENT_DIR, 'index.json'), 'utf8')) as RawIndex;
  const knownFonts = new Set(index.fonts.map((f) => f.family));

  it('provides at least 120 offline templates with unique IDs and valid categories', () => {
    expect(index.templates.length).toBeGreaterThanOrEqual(120);
    const ids = index.templates.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const originalId of [
      'promo-quadrado', 'lancamento-story', 'cardapio-a4', 'evento-retrato',
      'logo-circulo', 'cartao-visita', 'frase-retrato', 'aviso-banner',
    ]) {
      expect(ids).toContain(originalId);
    }
  });

  it('parses every template JSON, validates fonts & brand roles, and applies BrandKit cleanly', () => {
    const colorRoles = new Set<string>(COLOR_ROLES);
    const fontRoles = new Set<string>(FONT_ROLES);
    for (const entry of index.templates) {
      const raw = JSON.parse(readFileSync(resolve(CONTENT_DIR, entry.file), 'utf8'));
      const doc = parseDocument(raw);
      expect(doc.width, entry.id).toBeGreaterThan(0);
      expect(doc.height, entry.id).toBeGreaterThan(0);
      expect(doc.fabric.objects.length, entry.id).toBeGreaterThanOrEqual(3);
      for (const fam of fontsUsed(doc)) {
        expect(knownFonts.has(fam), `${entry.id} uses unknown font ${fam}`).toBe(true);
      }
      walkObjects(doc.fabric.objects, (o) => {
        if (o.brandColor !== undefined) expect(colorRoles.has(String(o.brandColor)), entry.id).toBe(true);
        if (o.brandStroke !== undefined) expect(colorRoles.has(String(o.brandStroke)), entry.id).toBe(true);
        if (o.brandFont !== undefined) expect(fontRoles.has(String(o.brandFont)), entry.id).toBe(true);
      });
      const applied = applyBrandKit(doc, sampleKit);
      expect(applied.fabric.objects.length).toBe(doc.fabric.objects.length);
    }
  });
});
