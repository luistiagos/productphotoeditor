import { describe, expect, it } from 'vitest';
import { Group, loadSVGFromString, Path, Rect } from 'fabric/node';
import {
  alignmentPositions, dataCodewords, encodeQr, inFinder, isQrConfig, logoHoleRange, penalty, type QrConfig, type QrEcc, qrLayout,
  QR_MODULE, qrSvg, QrTooLongError,
} from '../src/qrcode';
import { CUSTOM_PROPERTIES } from '../src/document';

// Matrizes geradas fora do app pelo pacote Python `qrcode` (modo byte forçado, máscara fixa, sem borda); receita no doc
// da TASK-05 (§ Correção).
interface FullCase { text: string; ecc: QrEcc; mask: number; version: number; rows: string[] }
interface HashCase { length: number; ecc: QrEcc; mask: number; version: number; sha256: string }
// caminho fora de literal: o tsconfig do projeto não liga `resolveJsonModule` (o Vite importa JSON normalmente)
const REF_PATH = './qr-reference.json';
const ref = ((await import(/* @vite-ignore */ REF_PATH)) as { default: { full: FullCase[]; hashes: HashCase[] } }).default;
const sha256 = async (s: string) => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)))]
  .map((b) => b.toString(16).padStart(2, '0')).join('');
const ALPHA = 'abcdefghijklmnopqrstuvwxyz0123456789';
const rowsOf = (m: boolean[][]) => m.map((r) => r.map((d) => (d ? '1' : '0')).join(''));

describe('encodeQr — igualdade bit a bit com a referência independente', () => {
  for (const c of ref.full) {
    it(`v${c.version} ${c.ecc} máscara ${c.mask}: ${JSON.stringify(c.text.slice(0, 32))}`, () => {
      const m = encodeQr(c.text, { ecc: c.ecc, mask: c.mask });
      expect(m.version).toBe(c.version);
      expect(m.size).toBe(c.version * 4 + 17);
      expect(rowsOf(m.modules)).toEqual(c.rows);
    });
  }
  it('cobre L/M/Q/H, as 8 máscaras, versões 1, 2, 7, 10, ≥ 20 e texto UTF-8 com acento', () => {
    expect(new Set(ref.full.map((c) => c.ecc))).toEqual(new Set(['L', 'M', 'Q', 'H']));
    expect(new Set(ref.full.map((c) => c.mask)).size).toBe(8);
    for (const v of [1, 2, 7, 10]) expect(ref.full.some((c) => c.version === v)).toBe(true);
    expect(ref.full.some((c) => c.version >= 20)).toBe(true);
    expect(ref.full.some((c) => /[^\x00-\x7f]/.test(c.text))).toBe(true);
  });
  it('as 160 combinações versão (1–40) × nível, no limite de capacidade de cada versão, têm o mesmo SHA-256', async () => {
    expect(ref.hashes.length).toBe(160);
    const bad: string[] = [];
    for (const c of ref.hashes) {
      const text = Array.from({ length: c.length }, (_, i) => ALPHA[(i * 7 + c.version) % 36]).join('');
      const m = encodeQr(text, { ecc: c.ecc, mask: c.mask });
      const h = await sha256(rowsOf(m.modules).join('\n'));
      if (m.version !== c.version || h !== c.sha256) bad.push(`${c.ecc}${c.version}→v${m.version}`);
    }
    expect(bad).toEqual([]);
  });
});

describe('encodeQr — escolha de máscara, versão e limites', () => {
  it('sem máscara pedida, usa a de menor penalidade entre as 8', () => {
    for (const text of ['https://www.lojateste.com.br', 'WIFI:T:WPA;S:Loja;P:123;;', 'x'.repeat(300)]) {
      const auto = encodeQr(text, { ecc: 'M' });
      const scores = [0, 1, 2, 3, 4, 5, 6, 7].map((k) => penalty(encodeQr(text, { ecc: 'M', mask: k }).modules));
      expect(penalty(auto.modules)).toBe(Math.min(...scores));
      expect(scores[auto.mask]).toBe(Math.min(...scores));
    }
  });
  it('minVersion força uma versão maior; o padrão de correção é M', () => {
    const m = encodeQr('abc', { minVersion: 5 });
    expect(m.version).toBe(5);
    expect(m.ecc).toBe('M');
  });
  it('texto além da versão 40 lança QrTooLongError', () => {
    const max = dataCodewords(40, 'L') - 3; // 4 bits de modo + 16 de contagem
    expect(encodeQr('a'.repeat(max), { ecc: 'L' }).version).toBe(40);
    expect(() => encodeQr('a'.repeat(max + 1), { ecc: 'L' })).toThrow(QrTooLongError);
  });
  it('alinhamento: v2 [6,18], v7 [6,22,38], v32 [6,34,60,86,112,138]', () => {
    expect(alignmentPositions(1)).toEqual([]);
    expect(alignmentPositions(2)).toEqual([6, 18]);
    expect(alignmentPositions(7)).toEqual([6, 22, 38]);
    expect(alignmentPositions(32)).toEqual([6, 34, 60, 86, 112, 138]);
  });
});

/** Subcaminhos ("M…z") de um atributo d. */
const subpaths = (d: string) => (d.match(/M/g) ?? []).length;
const attr = (el: string, name: string) => new RegExp(`${name}="([^"]*)"`).exec(el)?.[1];

describe('qrSvg', () => {
  const m = encodeQr('https://wa.me/5511988887777?text=Ol%C3%A1', { ecc: 'H' });
  const dark = (skip: (r: number, c: number) => boolean) => {
    let n = 0;
    for (let r = 0; r < m.size; r++) for (let c = 0; c < m.size; c++) if (m.modules[r][c] && !inFinder(r, c, m.size) && !skip(r, c)) n++;
    return n;
  };

  it('viewBox = (lado + 2·margem) módulos; um subcaminho por módulo escuro fora dos localizadores; 3×3 nos cantos', () => {
    for (const dotStyle of ['square', 'rounded', 'dots'] as const) {
      const svg = qrSvg(m, { dotStyle, quietZone: 2 });
      const side = (m.size + 4) * QR_MODULE;
      expect(attr(svg, 'viewBox')).toBe(`0 0 ${side} ${side}`);
      const paths = [...svg.matchAll(/<path d="([^"]*)"/g)].map((x) => x[1]);
      expect(paths.length).toBe(2);
      expect(subpaths(paths[0])).toBe(dark(() => false));
      expect(subpaths(paths[1])).toBe(9); // 3 localizadores × (anel, furo, centro)
      expect(svg).not.toMatch(/clipPath|<defs|<use|<image/);
    }
  });

  it('cantos arredondados usam arcos; os quadrados não', () => {
    const eyes = (style: 'square' | 'rounded') => [...qrSvg(m, { eyeStyle: style }).matchAll(/<path d="([^"]*)"/g)][1][1];
    expect(eyes('square')).not.toMatch(/a/);
    expect(eyes('rounded')).toMatch(/a/);
  });

  it('buraco do logo: ~22% do lado, centrado, sem nenhum módulo dentro', () => {
    const { start, end } = logoHoleRange(m.size);
    expect(end - start).toBeGreaterThanOrEqual(Math.ceil(m.size * 0.22));
    expect(start).toBe(m.size - end); // centrado
    const svg = qrSvg(m, { logoHole: true, quietZone: 2 });
    const d = /<path d="([^"]*)"/.exec(svg)![1];
    const inHole = (r: number, c: number) => r >= start && r < end && c >= start && c < end;
    expect(subpaths(d)).toBe(dark(inHole));
    const lo = (start + 2) * QR_MODULE, hi = (end + 2) * QR_MODULE;
    for (const mm of d.matchAll(/M([\d.]+) ([\d.]+)/g)) {
      const x = Number(mm[1]), y = Number(mm[2]);
      expect(x >= lo && x < hi && y >= lo && y < hi).toBe(false);
    }
  });

  it('legenda: faixa abaixo do QR (viewBox mais alto) com <rect> + <text> escapado', () => {
    const svg = qrSvg(m, { label: 'PAGUE <COM> PIX & cia', fg: '#c2185b', bg: '#ffffff' });
    const lay = qrLayout(m.size, { label: 'x' });
    expect(lay.height).toBeGreaterThan(lay.width);
    expect(attr(svg, 'viewBox')).toBe(`0 0 ${lay.width} ${lay.height}`);
    expect(svg).toContain('>PAGUE &lt;COM&gt; PIX &amp; cia</text>');
    expect(svg).toContain(`<rect x="0" y="${lay.side}" width="${lay.width}" height="${lay.label!.h}" fill="#c2185b" stroke-width="0"/>`);
    expect(qrSvg(m, { label: '   ' })).not.toContain('<text');
  });

  it('o parser SVG do Fabric devolve Rect + 2 Path (vira Group) com as cores pedidas', async () => {
    const { objects } = await loadSVGFromString(qrSvg(m, { fg: '#c2185b', bg: '#fafafa', dotStyle: 'dots' }));
    const items = objects.filter((o) => o !== null);
    expect(items.map((o) => o!.constructor)).toEqual([Rect, Path, Path]);
    expect(items[0]!.fill).toBe('#fafafa');
    expect(items[1]!.fill).toBe('#c2185b');
    const g = new Group(items as Rect[]);
    expect(g.width).toBeCloseTo((m.size + 4) * QR_MODULE, 0);
  });
});

describe('qrConfig no documento', () => {
  const cfg: QrConfig = {
    kind: 'whatsapp', fields: { phone: '(11) 98888-7777', message: 'Olá' }, payload: 'https://wa.me/5511988887777?text=Ol%C3%A1',
    ecc: 'M', dotStyle: 'dots', eyeStyle: 'rounded', fgColor: '#c2185b', bgColor: '#ffffff', label: 'CHAME NO WHATSAPP', withLogo: false,
  };
  it('isQrConfig aceita o formato e recusa o resto', () => {
    expect(isQrConfig(cfg)).toBe(true);
    expect(isQrConfig({ ...cfg, kind: 'sms' })).toBe(false);
    expect(isQrConfig(null)).toBe(false);
    expect('type' in cfg).toBe(false);
  });
  it('qrConfig e tableData estão em CUSTOM_PROPERTIES e sobrevivem a toObject → Group.fromObject', async () => {
    expect(CUSTOM_PROPERTIES).toContain('qrConfig');
    expect(CUSTOM_PROPERTIES).toContain('tableData');
    const g = new Group([new Rect({ width: 10, height: 10 }), new Rect({ width: 5, height: 5, left: 20 })]);
    const table = { rows: [['a', 'b']], style: 'grid', headerBg: '#000000', textColor: '#111111', borderColor: '#cccccc', fontFamily: 'Montserrat' };
    g.set({ qrConfig: cfg, tableData: table });
    const obj = g.toObject([...CUSTOM_PROPERTIES] as never[]);
    const back = await Group.fromObject(JSON.parse(JSON.stringify(obj)));
    expect(back.get('qrConfig')).toEqual(cfg);
    expect(back.get('tableData')).toEqual(table);
  });
});
