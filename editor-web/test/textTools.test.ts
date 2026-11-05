import { describe, expect, it } from 'vitest';
import { FabricObject, Group, Path, PencilBrush, Point, Rect } from 'fabric/node';
import {
  collectTextLayers, countMatches, detectListStyle, findAndReplaceInText, formatTextList, LIST_OPTIONS, matchSnippet,
  stripListPrefix, summarizeMatches, toggleListStyle,
} from '../src/textTools';
import {
  alphaOf, FREEHAND_DECIMATE, FREEHAND_LAYER, isFreehandPath, keepAlpha, PEN_PRESETS, penWidth, withAlpha,
} from '../src/freehandDraw';
import { CUSTOM_PROPERTIES } from '../src/document';

const BENEFITS = 'Frete Grátis\nGarantia de 1 Ano\nEnvio em 24h';

describe('listas (☰ Lista)', () => {
  it('aplica cada estilo em todas as linhas', () => {
    expect(formatTextList(BENEFITS, 'bullet')).toBe('• Frete Grátis\n• Garantia de 1 Ano\n• Envio em 24h');
    expect(formatTextList(BENEFITS, 'check')).toBe('✓ Frete Grátis\n✓ Garantia de 1 Ano\n✓ Envio em 24h');
    expect(formatTextList(BENEFITS, 'fire')).toBe('🔥 Frete Grátis\n🔥 Garantia de 1 Ano\n🔥 Envio em 24h');
    expect(formatTextList(BENEFITS, 'star')).toBe('⭐ Frete Grátis\n⭐ Garantia de 1 Ano\n⭐ Envio em 24h');
    expect(formatTextList(BENEFITS, 'numbered')).toBe('1. Frete Grátis\n2. Garantia de 1 Ano\n3. Envio em 24h');
  });

  it('converte entre estilos sem duplicar marcadores (passando por todos)', () => {
    let t = BENEFITS;
    for (const style of ['bullet', 'check', 'fire', 'star', 'numbered', 'check', 'bullet'] as const) {
      t = toggleListStyle(t, style);
      expect(detectListStyle(t)).toBe(style);
      // um marcador por linha: o corpo de cada linha é o original
      expect(formatTextList(t, 'none')).toBe(BENEFITS);
    }
  });

  it('tocar no estilo ativo tira os marcadores; "Sem marcador" também', () => {
    const bullets = toggleListStyle(BENEFITS, 'bullet');
    expect(toggleListStyle(bullets, 'bullet')).toBe(BENEFITS);
    expect(toggleListStyle(toggleListStyle(BENEFITS, 'numbered'), 'numbered')).toBe(BENEFITS);
    expect(toggleListStyle(bullets, 'none')).toBe(BENEFITS);
    expect(toggleListStyle(BENEFITS, 'none')).toBe(BENEFITS);
  });

  it('linhas vazias ficam vazias e não contam na numeração; recuo é mantido', () => {
    expect(formatTextList('A\n\nB\n  C', 'numbered')).toBe('1. A\n\n2. B\n  3. C');
    expect(formatTextList('1. A\n\n2. B\n  3. C', 'none')).toBe('A\n\nB\n  C');
    expect(detectListStyle('• A\n\n• B')).toBe('bullet');
  });

  it('reconhece marcadores digitados à mão e variantes (✔ ✅ ★ - * 2))', () => {
    expect(formatTextList('- A\n* B\n– C', 'check')).toBe('✓ A\n✓ B\n✓ C');
    expect(detectListStyle('✔ A\n✅ B')).toBe('check');
    expect(detectListStyle('★ A\n⭐️ B')).toBe('star');
    expect(formatTextList('1) A\n2) B', 'bullet')).toBe('• A\n• B');
    expect(detectListStyle('- A\n- B')).toBe('mixed');
    expect(detectListStyle('• A\n✓ B')).toBe('mixed');
    expect(detectListStyle('• A\nB')).toBe('mixed');
    // aplicar sobre lista misturada uniformiza
    expect(formatTextList('• A\n✓ B\nC', 'fire')).toBe('🔥 A\n🔥 B\n🔥 C');
  });

  it('não confunde número, preço ou desconto com marcador', () => {
    expect(stripListPrefix('-10% OFF')).toBe('-10% OFF');
    expect(stripListPrefix('1.5 kg')).toBe('1.5 kg');
    expect(stripListPrefix('2024. Ano')).toBe('2024. Ano');
    expect(detectListStyle('10.5 kg\nR$ 99')).toBe('none');
    expect(formatTextList('-10% OFF', 'bullet')).toBe('• -10% OFF');
  });

  it('texto de uma linha e texto vazio', () => {
    expect(toggleListStyle('Oferta', 'check')).toBe('✓ Oferta');
    expect(detectListStyle('')).toBe('none');
    expect(formatTextList('', 'bullet')).toBe('');
    expect(formatTextList('A\r\nB', 'bullet')).toBe('• A\n• B');
  });

  it('o seletor oferece os 6 estilos', () => {
    expect(LIST_OPTIONS.map(([s]) => s)).toEqual(['bullet', 'check', 'fire', 'star', 'numbered', 'none']);
  });
});

describe('localizar e substituir', () => {
  it('conta e troca sem diferenciar maiúsculas por padrão', () => {
    expect(countMatches('Natal feliz. NATAL de ofertas, natal!', 'natal')).toBe(3);
    expect(findAndReplaceInText('Natal feliz. NATAL!', 'natal', 'Black Friday')).toEqual({ text: 'Black Friday feliz. Black Friday!', count: 2 });
  });

  it('diferenciando maiúsculas só troca a forma exata', () => {
    expect(countMatches('Natal NATAL natal', 'Natal', true)).toBe(1);
    expect(findAndReplaceInText('Natal NATAL natal', 'Natal', 'X', true)).toEqual({ text: 'X NATAL natal', count: 1 });
  });

  it('preço com $ e caracteres de regex são literais (sem $& / $1)', () => {
    const r = findAndReplaceInText('De R$ 199,90 por R$ 199,90', 'R$ 199,90', 'R$ 149,90');
    expect(r).toEqual({ text: 'De R$ 149,90 por R$ 149,90', count: 2 });
    expect(findAndReplaceInText('a.b (c)', '.', '$&$&').text).toBe('a$&$&b (c)');
    expect(countMatches('x+y*z [1]', '[1]')).toBe(1);
    expect(countMatches('a.b', 'a.c')).toBe(0);
  });

  it('acentos e cedilha sem diferenciar maiúsculas; emoji no termo', () => {
    expect(countMatches('PROMOÇÃO e promoção', 'Promoção')).toBe(2);
    expect(findAndReplaceInText('🔥 Oferta 🔥', '🔥', '⭐')).toEqual({ text: '⭐ Oferta ⭐', count: 2 });
  });

  it('termo vazio não encontra nem troca nada', () => {
    expect(countMatches('abc', '')).toBe(0);
    expect(findAndReplaceInText('abc', '', 'x')).toEqual({ text: 'abc', count: 0 });
  });

  it('trecho em volta da ocorrência para a lista de resultados', () => {
    expect(matchSnippet('Só hoje: de R$ 199,90 por apenas R$ 99', 'R$ 199,90', false, 5)).toBe('…: de R$ 199,90 por …');
    expect(matchSnippet('Linha 1\nNatal', 'natal')).toBe('Linha 1 Natal');
  });

  // o `fabric/node` daqui não mede texto (sem o pacote `canvas`, getContext → null): textos com a mesma forma
  it('coleta textos dentro de grupos (recursivo, por forma) e resume ocorrências por camada', () => {
    const a = { text: 'Natal: R$ 199,90' };
    const inner = { text: 'NATAL' };
    const deep = { text: 'Natal Natal' };
    const group = { getObjects: () => [new Rect({ width: 10, height: 10 }), inner, { getObjects: () => [deep] }] };
    const layers = collectTextLayers<object>([new Rect({ width: 5, height: 5 }), a, group]);
    expect(layers).toEqual([a, inner, deep]);
    expect(summarizeMatches(layers as { text: string }[], 'natal')).toEqual({ matches: 4, layers: 3 });
    expect(summarizeMatches(layers as { text: string }[], 'Natal', true)).toEqual({ matches: 3, layers: 2 });
  });

  it('a coleta atravessa um Group real do Fabric', () => {
    const fake = new Rect({ width: 4, height: 4 });
    (fake as unknown as { text: string }).text = 'Natal';
    const g = new Group([new Rect({ width: 10, height: 10 }), new Group([fake])]);
    expect(collectTextLayers<FabricObject>([g])).toEqual([fake]);
  });

  it('premissa: mudar o tamanho de um filho não refaz a caixa do Group; triggerLayout refaz', () => {
    const child = new Rect({ width: 40, height: 20 });
    const g = new Group([child]);
    expect(g.width).toBeCloseTo(40 + 1, 0); // + strokeWidth padrão 1
    child.set({ width: 400 });
    expect(g.width).toBeCloseTo(41, 0);
    g.triggerLayout();
    expect(g.width).toBeCloseTo(401, 0);
  });
});

describe('desenho à mão livre', () => {
  it('presets: Circula-oferta vermelho, Marca-texto amarelo translúcido largo, caneta fina', () => {
    const byId = Object.fromEntries(PEN_PRESETS.map((p) => [p.id, p]));
    expect(byId.offer.color).toBe('#e53935');
    expect(byId.highlighter.color).toBe('rgba(255, 235, 59, 0.45)');
    expect(alphaOf(byId.highlighter.color)).toBeCloseTo(0.45);
    expect(byId.highlighter.size).toBeGreaterThan(byId.offer.size);
    expect(byId.offer.size).toBeGreaterThan(byId.fine.size);
    expect(penWidth(byId.offer.size, 1080)).toBe(13);
    expect(penWidth(0.0001, 1080)).toBe(1);
  });

  it('a cor escolhida no seletor (#rrggbb) herda o alfa da atual', () => {
    expect(withAlpha('#ff0000', 0.45)).toBe('rgba(255, 0, 0, 0.45)');
    expect(withAlpha('rgba(1, 2, 3, 0.5)', 1)).toBe('#010203');
    expect(keepAlpha('rgba(255, 235, 59, 0.45)', '#00ff00')).toBe('rgba(0, 255, 0, 0.45)');
    expect(keepAlpha('#e53935', '#00ff00')).toBe('#00ff00');
    expect(keepAlpha(null, '#123456')).toBe('#123456');
  });

  it('isFreehandPath: só Path sem preenchimento com a camada "Traço à mão"', () => {
    const stroke = new Path('M 0 0 Q 10 10 20 0', { fill: null as unknown as string, stroke: '#e53935', strokeWidth: 8 });
    stroke.set({ layerName: FREEHAND_LAYER });
    expect(isFreehandPath(stroke)).toBe(true);
    const shape = new Path('M 0 0 L 10 0 L 5 8 Z', { fill: '#000' });
    shape.set({ layerName: FREEHAND_LAYER });
    expect(isFreehandPath(shape)).toBe(false);
    expect(isFreehandPath(new Path('M 0 0 L 1 1', { fill: null as unknown as string }))).toBe(false);
    expect(isFreehandPath(new Rect({ width: 2, height: 2 }))).toBe(false);
    expect(isFreehandPath(undefined)).toBe(false);
  });

  it('premissa: o Path do PencilBrush sobrevive a toObject/fromObject com layerName (undo/rascunho)', async () => {
    const saved = FabricObject.customProperties;
    FabricObject.customProperties = [...CUSTOM_PROPERTIES];
    try {
      const brush = new PencilBrush({ getZoom: () => 1 } as never);
      brush.color = 'rgba(255, 235, 59, 0.45)';
      brush.width = 43;
      const path = brush.createPath(brush.convertPointsToSVGPath([new Point(10, 10), new Point(60, 40), new Point(120, 20)]));
      path.set({ layerName: FREEHAND_LAYER });
      const back = await Path.fromObject(path.toObject());
      expect(back.get('layerName')).toBe(FREEHAND_LAYER);
      expect(back.stroke).toBe('rgba(255, 235, 59, 0.45)');
      expect(back.strokeWidth).toBe(43);
      expect(back.strokeLineCap).toBe('round');
      expect(isFreehandPath(back)).toBe(true);
    } finally {
      FabricObject.customProperties = saved;
    }
  });

  it('premissa: decimate é em px de tela (dividido pelo zoom) — com zoom 0,35 descarta pontos a < 7 px do documento', () => {
    const brush = new PencilBrush({ getZoom: () => 0.35 } as never);
    const pts = [0, 2, 4, 6, 8, 10, 30, 40, 41].map((x) => new Point(x, 0));
    const kept = brush.decimatePoints(pts, FREEHAND_DECIMATE).map((p) => p.x);
    // 2,5 / 0,35 ≈ 7,1 px: de 0 pula para 8, depois 30; o último sempre fica (o penúltimo o laço do Fabric não avalia)
    expect(kept).toEqual([0, 8, 30, 41]);
  });
});
