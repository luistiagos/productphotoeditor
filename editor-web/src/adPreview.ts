// Simulador de anúncio (TASK-13): o criativo dentro de um card de Feed (Instagram/Facebook), de uma tela de
// Stories/Reels e de uma grade de busca de marketplace (Mercado Livre/Shopee). Moldura própria, sem marca de terceiros.
// O modelo é puro (testável no Node); a montagem usa o `h()` de dom.ts. A imagem do criativo é o `data:` do
// `editor.thumbnail(1080)` (CSP: img-src 'self' data:).
import type { BrandKit } from './brandkit';
import { h } from './dom';

export type AdPreviewMode = 'feed' | 'stories' | 'marketplace';

export const AD_PREVIEW_MODES: [AdPreviewMode, string][] = [
  ['feed', '📱 Feed'],
  ['stories', '🎬 Stories / Reels'],
  ['marketplace', '🛒 Busca marketplace'],
];

/** Lado (px CSS) da foto do card na busca do marketplace: o tamanho em que o comprador vê o anúncio. */
export const MARKETPLACE_CARD_PX = 170;
export const DEFAULT_STORE_NAME = 'Sua Loja';

export interface FakeListing { title: string; price: string; shipping: boolean; tone: string }

export interface AdPreviewModel {
  storeName: string;
  /** Logo do brand kit (servido pelo asset loader) ou ausente: aí o avatar mostra a inicial. */
  avatarUrl?: string;
  avatarInitial: string;
  sponsored: string;
  cta: string;
  productTitle: string;
  price: string;
  shipping: string;
  cardPx: number;
  /** Os outros cards da grade de busca (concorrentes fictícios, só cinza). */
  others: FakeListing[];
}

/** Dados da moldura a partir do brand kit e do nome do design. */
export function previewModel(kit: BrandKit, designName?: string): AdPreviewModel {
  const storeName = kit.profile.company?.trim() || DEFAULT_STORE_NAME;
  const name = designName?.trim();
  return {
    storeName,
    avatarUrl: kit.logoUrl || undefined,
    avatarInitial: (storeName.match(/[\p{L}\p{N}]/u)?.[0] ?? 'S').toUpperCase(),
    sponsored: 'Patrocinado',
    cta: 'Comprar agora ›',
    productTitle: name && name !== 'Sem nome' ? name : 'Seu produto em destaque',
    price: 'R$ 99,90',
    shipping: 'Frete grátis',
    cardPx: MARKETPLACE_CARD_PX,
    others: [
      { title: 'Produto similar — modelo básico', price: 'R$ 89,90', shipping: true, tone: '#d9dde5' },
      { title: 'Kit com 2 unidades', price: 'R$ 149,00', shipping: false, tone: '#e6e1d8' },
      { title: 'Versão premium importada', price: 'R$ 212,50', shipping: true, tone: '#dce4dc' },
    ],
  };
}

/** Moldura 9:16 de Stories/Reels: largura (px CSS) que cabe em `maxW` × `maxH`. */
export function storiesFrameWidth(maxW: number, maxH: number): number {
  return Math.max(120, Math.floor(Math.min(maxW, (maxH * 9) / 16)));
}

function avatar(m: AdPreviewModel, cls: string): HTMLElement {
  return m.avatarUrl
    ? h('img', { class: cls, src: m.avatarUrl, alt: '' })
    : h('span', { class: cls + ' initial' }, m.avatarInitial);
}

function feed(m: AdPreviewModel, imageUrl: string, aspect: number): HTMLElement {
  return h('div', { class: 'adp-feed', 'data-mode': 'feed' },
    h('div', { class: 'adp-head' },
      avatar(m, 'adp-avatar'),
      h('div', { class: 'adp-who' }, h('strong', {}, m.storeName), h('small', {}, m.sponsored)),
      h('span', { class: 'adp-more' }, '•••')),
    h('img', { class: 'adp-creative', src: imageUrl, alt: 'Criativo', style: `aspect-ratio:${aspect}` }),
    h('div', { class: 'adp-cta' }, h('span', {}, m.cta)),
    h('div', { class: 'adp-actions' }, h('span', {}, '♡'), h('span', {}, '💬'), h('span', {}, '➤'), h('span', { class: 'adp-save' }, '🔖')),
    h('div', { class: 'adp-caption' }, h('strong', {}, m.storeName), ` ${m.productTitle} — ${m.price}`),
  );
}

function stories(m: AdPreviewModel, imageUrl: string, frameW: number): HTMLElement {
  return h('div', { class: 'adp-stories', 'data-mode': 'stories', style: `width:${frameW}px` },
    h('img', { class: 'adp-creative', src: imageUrl, alt: 'Criativo' }),
    h('div', { class: 'adp-st-top' },
      h('div', { class: 'adp-st-progress' }, h('span', {})),
      h('div', { class: 'adp-st-who' }, avatar(m, 'adp-avatar small'), h('strong', {}, m.storeName), h('small', {}, m.sponsored), h('span', { class: 'adp-st-x' }, '✕'))),
    h('div', { class: 'adp-st-side' }, h('span', {}, '♡'), h('span', {}, '💬'), h('span', {}, '➤'), h('span', {}, '⋯')),
    h('div', { class: 'adp-st-bottom' },
      h('div', { class: 'adp-st-cta' }, '˄ ', m.cta),
      h('div', { class: 'adp-st-reply' }, h('span', { class: 'adp-st-input' }, 'Enviar mensagem'), h('span', {}, '♡'), h('span', {}, '➤'))),
  );
}

function listing(img: HTMLElement, title: string, price: string, shipping: string | null, px: number): HTMLElement {
  return h('div', { class: 'adp-card', style: `width:${px}px` },
    img,
    h('div', { class: 'adp-card-title' }, title),
    h('div', { class: 'adp-card-price' }, price),
    shipping ? h('div', { class: 'adp-card-ship' }, shipping) : null);
}

function marketplace(m: AdPreviewModel, imageUrl: string): HTMLElement {
  const px = m.cardPx;
  const mine = listing(
    h('img', { class: 'adp-card-img adp-creative', src: imageUrl, alt: 'Criativo', style: `width:${px}px;height:${px}px` }),
    m.productTitle, m.price, m.shipping, px);
  mine.classList.add('mine');
  const others = m.others.map((o) => listing(
    h('div', { class: 'adp-card-img placeholder', style: `width:${px}px;height:${px}px;background:${o.tone}` }),
    o.title, o.price, o.shipping ? m.shipping : null, px));
  return h('div', { class: 'adp-market', 'data-mode': 'marketplace', style: `grid-template-columns:repeat(2, ${px}px)` },
    mine, ...others);
}

/**
 * Monta a simulação. `aspect` = largura/altura do documento (o card do feed respeita a proporção);
 * `maxW`/`maxH` = espaço disponível para a moldura de Stories.
 */
export function buildAdPreview(
  mode: AdPreviewMode,
  imageUrl: string,
  model: AdPreviewModel,
  opts: { aspect: number; maxW: number; maxH: number },
): HTMLElement {
  if (mode === 'stories') return stories(model, imageUrl, storiesFrameWidth(opts.maxW, opts.maxH));
  if (mode === 'marketplace') return marketplace(model, imageUrl);
  return feed(model, imageUrl, opts.aspect);
}
