import { describe, expect, it } from 'vitest';
import { AD_PREVIEW_MODES, DEFAULT_STORE_NAME, MARKETPLACE_CARD_PX, previewModel, storiesFrameWidth } from '../src/adPreview';

const emptyKit = { profile: {}, colors: {}, fonts: {} };

describe('previewModel', () => {
  it('sem brand kit: "Sua Loja", avatar com a inicial e os textos da moldura', () => {
    const m = previewModel(emptyKit, 'Sem nome');
    expect(m.storeName).toBe(DEFAULT_STORE_NAME);
    expect(m.storeName).toBe('Sua Loja');
    expect(m.avatarUrl).toBeUndefined();
    expect(m.avatarInitial).toBe('S');
    expect(m.sponsored).toBe('Patrocinado');
    expect(m.cta).toBe('Comprar agora ›');
    expect(m.price).toBe('R$ 99,90');
    expect(m.shipping).toBe('Frete grátis');
    expect(m.cardPx).toBe(170);
    expect(MARKETPLACE_CARD_PX).toBe(170);
    expect(m.productTitle).toBe('Seu produto em destaque');
    expect(m.others.length).toBe(3); // grade de 2 colunas: o criativo + 3 cards fictícios
  });

  it('com brand kit: nome da empresa, logo e inicial dela; o nome do design vira o título', () => {
    const m = previewModel({ profile: { company: '  ótica Bella  ' }, colors: {}, fonts: {}, logoUrl: '/blob/logo' }, 'Óculos de sol');
    expect(m.storeName).toBe('ótica Bella');
    expect(m.avatarUrl).toBe('/blob/logo');
    expect(m.avatarInitial).toBe('Ó');
    expect(m.productTitle).toBe('Óculos de sol');
  });

  it('empresa em branco cai em "Sua Loja"', () => {
    expect(previewModel({ profile: { company: '   ' }, colors: {}, fonts: {} }).storeName).toBe('Sua Loja');
  });
});

describe('storiesFrameWidth', () => {
  it('moldura 9:16 que cabe no espaço', () => {
    expect(storiesFrameWidth(360, 1000)).toBe(360); // limitada pela largura
    expect(storiesFrameWidth(360, 480)).toBe(270); // limitada pela altura: 480 × 9/16
    expect(storiesFrameWidth(50, 50)).toBe(120); // piso legível
  });
});

describe('AD_PREVIEW_MODES', () => {
  it('os 3 modos da especificação', () => {
    expect(AD_PREVIEW_MODES.map(([m]) => m)).toEqual(['feed', 'stories', 'marketplace']);
  });
});
