// Magic Resize (TASK-09): reposiciona as camadas por papel quando a proporção da página muda. Puro (caixas → caixas): o
// editor mede as caixas no Fabric (`getBoundingRect`, plano da cena) e aplica a escala e o centro que saem daqui.

export interface Box { left: number; top: number; width: number; height: number }
export interface Size { width: number; height: number }
export type LayerKind = 'text' | 'image' | 'other';

export interface ReflowItem {
  id: number;
  kind: LayerKind;
  /** Caixa na página de origem (px do documento). */
  box: Box;
  /** Camada de fundo (`layerName = 'background'`): o editor a cobre na página nova. */
  background?: boolean;
  /** Altura efetiva da fonte (texto): desempata título × preço quando estão na altura do produto. */
  fontSize?: number;
}

/** fundo / cabeçalho (logo, selo no topo) / produto (maior imagem) / título (acima do produto) / preço e CTA (abaixo). */
export type LayerRole = 'background' | 'header' | 'product' | 'title' | 'cta';

export interface ReflowPlacement {
  id: number;
  role: LayerRole;
  /** Multiplica a escala atual do objeto. */
  scale: number;
  /** Caixa nova (px da página de destino). */
  box: Box;
}

/** uniform = proporção quase igual (só escala); vertical = 9:16 e afins; horizontal = banner; stacked = o meio-termo. */
export type ReflowMode = 'uniform' | 'vertical' | 'horizontal' | 'stacked';

/** Razão entre proporções abaixo da qual o reflow vira escala uniforme (o arranjo do usuário fica). */
export const UNIFORM_RATIO = 1.15;
export const VERTICAL_MAX_ASPECT = 0.8;
export const HORIZONTAL_MIN_ASPECT = 1.5;
/** Fração da faixa útil do produto no empilhamento (vertical/stacked): a outra metade fica com os textos. */
export const PRODUCT_SHARE = 0.5;
/** Divisão da parte dos textos no empilhamento, de cima para baixo — só os blocos presentes contam. */
const STACK_WEIGHTS: Record<'header' | 'title' | 'cta', number> = { header: 0.2, title: 0.4, cta: 0.4 };
/** Coluna de textos do banner: cabeçalho, título, CTA. */
const COLUMN_WEIGHTS: Record<'header' | 'title' | 'cta', number> = { header: 0.2, title: 0.45, cta: 0.35 };

export function reflowMode(src: Size, dst: Size): ReflowMode {
  const ratio = (dst.width / dst.height) / (src.width / src.height);
  if (Math.max(ratio, 1 / ratio) < UNIFORM_RATIO) return 'uniform';
  const a = dst.width / dst.height;
  if (a < VERTICAL_MAX_ASPECT) return 'vertical';
  if (a >= HORIZONTAL_MIN_ASPECT) return 'horizontal';
  return 'stacked';
}

/** Zona coberta pela interface de Reels/Stories, a mesma do overlay `social-9x16` da TASK-01 (150/320/120 a cada 1920 px). */
export function safeZone916(dst: Size): { top: number; bottom: number; right: number } {
  const s = dst.height / 1920;
  return { top: 150 * s, bottom: 320 * s, right: 120 * s };
}

const centerOf = (b: Box) => ({ x: b.left + b.width / 2, y: b.top + b.height / 2 });
const area = (b: Box) => Math.max(0, b.width) * Math.max(0, b.height);

/** Papel de cada camada na página de origem. */
export function classifyLayers(items: ReflowItem[], src: Size): Map<number, LayerRole> {
  const roles = new Map<number, LayerRole>();
  let product: ReflowItem | undefined;
  for (const it of items) {
    if (it.background) { roles.set(it.id, 'background'); continue; }
    if (it.kind === 'image' && area(it.box) > 0 && (!product || area(it.box) > area(product.box))) product = it;
  }
  if (product) roles.set(product.id, 'product');
  const productY = product ? centerOf(product.box).y : src.height / 2;
  const tol = 0.05 * src.height;
  const ambiguousTexts: ReflowItem[] = [];
  for (const it of items) {
    if (roles.has(it.id)) continue;
    const b = it.box;
    if (it.kind !== 'text' && b.top < 0.25 * src.height && b.top + b.height <= 0.5 * src.height) { roles.set(it.id, 'header'); continue; }
    const y = centerOf(b).y;
    if (y < productY - tol) roles.set(it.id, 'title');
    else if (y > productY + tol) roles.set(it.id, 'cta');
    else if (it.kind === 'text') ambiguousTexts.push(it);
    else roles.set(it.id, 'cta');
  }
  // texto na altura do produto (o "Adicionar texto" centraliza tudo): o de fonte maior é o título, se ainda não há um
  const hasTitleText = items.some((it) => it.kind === 'text' && roles.get(it.id) === 'title');
  ambiguousTexts.sort((a, b) => (b.fontSize ?? b.box.height) - (a.fontSize ?? a.box.height));
  ambiguousTexts.forEach((it, i) => roles.set(it.id, i === 0 && !hasTitleText ? 'title' : 'cta'));
  return roles;
}

function union(boxes: Box[]): Box {
  const l = Math.min(...boxes.map((b) => b.left));
  const t = Math.min(...boxes.map((b) => b.top));
  const r = Math.max(...boxes.map((b) => b.left + b.width));
  const btm = Math.max(...boxes.map((b) => b.top + b.height));
  return { left: l, top: t, width: r - l, height: btm - t };
}

/** Escala que cabe `b` em `zone` (contain), presa em `cap`. */
function fitScale(b: Box, zone: Box, cap: number): number {
  const sw = b.width > 0 ? zone.width / b.width : Infinity;
  const sh = b.height > 0 ? zone.height / b.height : Infinity;
  const s = Math.min(sw, sh, cap);
  return Number.isFinite(s) && s > 0 ? s : 1;
}

/** Posiciona um bloco (membros com o arranjo interno mantido) centrado na zona. */
function placeBlock(members: ReflowItem[], role: LayerRole, zone: Box, cap: number, out: ReflowPlacement[]): void {
  if (members.length === 0) return;
  const u = union(members.map((m) => m.box));
  const s = fitScale(u, zone, cap);
  const nu = { left: zone.left + (zone.width - u.width * s) / 2, top: zone.top + (zone.height - u.height * s) / 2 };
  for (const m of members) {
    out.push({
      id: m.id, role, scale: s,
      box: { left: nu.left + (m.box.left - u.left) * s, top: nu.top + (m.box.top - u.top) * s, width: m.box.width * s, height: m.box.height * s },
    });
  }
}

/** Divide `[start, start + length]` entre os blocos presentes, pelos pesos. */
function split<K extends string>(keys: K[], weights: Record<K, number>, start: number, length: number): Map<K, [number, number]> {
  const total = keys.reduce((s, k) => s + weights[k], 0) || 1;
  const out = new Map<K, [number, number]>();
  let at = start;
  for (const k of keys) {
    const len = (length * weights[k]) / total;
    out.set(k, [at, len]);
    at += len;
  }
  return out;
}

/** Garante a caixa dentro da página (reduz se não couber, desloca se sair). */
function clampToPage(p: ReflowPlacement, dst: Size): void {
  const f = Math.min(1, p.box.width > 0 ? dst.width / p.box.width : 1, p.box.height > 0 ? dst.height / p.box.height : 1);
  if (f < 1) {
    const c = centerOf(p.box);
    p.scale *= f;
    p.box = { left: c.x - (p.box.width * f) / 2, top: c.y - (p.box.height * f) / 2, width: p.box.width * f, height: p.box.height * f };
  }
  p.box.left = Math.min(Math.max(p.box.left, 0), dst.width - p.box.width);
  p.box.top = Math.min(Math.max(p.box.top, 0), dst.height - p.box.height);
}

/**
 * Reflow de `src` para `dst`. Cada bloco (cabeçalho, título, produto, CTA) escala por inteiro e vai para a sua zona:
 * - vertical (W/H < 0,8): faixa útil entre a zona segura de Reels/Stories e a margem; de cima para baixo cabeçalho e
 *   título, produto (metade da faixa, no meio), preço/CTA. Produto e CTA ficam fora da faixa lateral direita.
 * - horizontal (W/H ≥ 1,5): produto na metade esquerda; cabeçalho, título e CTA empilhados na direita.
 * - stacked: o empilhamento do vertical, sem a zona segura.
 * - uniform: escala `min(sx, sy)` e centraliza (o "Ajustar o conteúdo" do Tamanho).
 * Texto não cresce mais que a raiz da razão das áreas; o produto preenche a zona. Nenhuma caixa sai da página.
 */
export function smartReflowLayout(items: ReflowItem[], src: Size, dst: Size): ReflowPlacement[] {
  const roles = classifyLayers(items, src);
  const mode = reflowMode(src, dst);
  const out: ReflowPlacement[] = [];
  const W = dst.width, H = dst.height;
  for (const it of items) {
    if (roles.get(it.id) !== 'background') continue;
    const s = Math.max(it.box.width > 0 ? W / it.box.width : 1, it.box.height > 0 ? H / it.box.height : 1);
    out.push({ id: it.id, role: 'background', scale: s, box: { left: 0, top: 0, width: W, height: H } });
  }
  const content = items.filter((it) => roles.get(it.id) !== 'background');
  if (mode === 'uniform') {
    const s = Math.min(W / src.width, H / src.height);
    const dx = (W - src.width * s) / 2, dy = (H - src.height * s) / 2;
    for (const it of content) {
      out.push({ id: it.id, role: roles.get(it.id)!, scale: s,
        box: { left: it.box.left * s + dx, top: it.box.top * s + dy, width: it.box.width * s, height: it.box.height * s } });
    }
  } else {
    const blocks = { header: [] as ReflowItem[], title: [] as ReflowItem[], product: [] as ReflowItem[], cta: [] as ReflowItem[] };
    for (const it of content) blocks[roles.get(it.id) as keyof typeof blocks].push(it);
    const textCap = Math.sqrt((W * H) / (src.width * src.height));
    const m = 0.05 * Math.min(W, H);
    if (mode === 'horizontal') {
      const hasProduct = blocks.product.length > 0;
      const colTop = m, colH = H - 2 * m;
      const textLeft = hasProduct ? W / 2 + m / 2 : m;
      if (hasProduct) placeBlock(blocks.product, 'product', { left: m, top: colTop, width: W / 2 - 1.5 * m, height: colH }, Infinity, out);
      const keys = (['header', 'title', 'cta'] as const).filter((k) => blocks[k].length > 0);
      const zones = split([...keys], COLUMN_WEIGHTS, colTop, colH);
      for (const k of keys) {
        const [top, len] = zones.get(k)!;
        placeBlock(blocks[k], k, { left: textLeft, top, width: W - m - textLeft, height: len }, textCap, out);
      }
    } else {
      const sz = mode === 'vertical' ? safeZone916(dst) : { top: 0, bottom: 0, right: 0 };
      const y0 = sz.top + m, bandH = H - sz.bottom - m - y0;
      const keys = (['header', 'title', 'product', 'cta'] as const).filter((k) => blocks[k].length > 0);
      const texts = keys.filter((k): k is 'header' | 'title' | 'cta' => k !== 'product');
      const productLen = blocks.product.length === 0 ? 0 : texts.length === 0 ? bandH : bandH * PRODUCT_SHARE;
      const textLens = split(texts, STACK_WEIGHTS, 0, bandH - productLen);
      const zones = new Map<string, [number, number]>();
      let at = y0;
      for (const k of keys) {
        const len = k === 'product' ? productLen : textLens.get(k)![1];
        zones.set(k, [at, len]);
        at += len;
      }
      for (const k of keys) {
        const [top, len] = zones.get(k)!;
        // produto e CTA descem até a faixa lateral direita da interface: margem simétrica para continuar centrado
        const side = k === 'product' || k === 'cta' ? m + sz.right : m;
        placeBlock(blocks[k], k, { left: side, top, width: W - 2 * side, height: len }, k === 'product' ? Infinity : textCap, out);
      }
    }
  }
  for (const p of out) if (p.role !== 'background') clampToPage(p, dst);
  return out;
}
