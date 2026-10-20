import './styles.css';
import { FabricImage, FabricObject, FabricText, Textbox } from 'fabric';
import { type CopyResult, parseCopy, parseVariants, REWRITE_STYLES, type RewriteStyle, rewritePayload } from './aiText';
import { Bridge, BridgeRequestError, injectedTransport, offlineTransport } from './bridge';
import { applyBrandKit, type BrandKit, parseBrandKit } from './brandkit';
import {
  contentUrl, type ContentIndex, knownFamilies, loadContentIndex, loadTemplate, registerBundledFonts, registerFont,
  type TemplateEntry,
} from './content';
import { parseDocument } from './document';
import { button, colorInput, confirmSheet, h, openSheet, select, setBusy, slider, toast, toHex } from './dom';
import { type Adjustments, Editor, type FilterPreset, renderThumbnail, type ShapeKind } from './editor';
import type { BlobResult, ExportPayload, FontRef, SaveDraftPayload, TextBox } from './protocol';

// ---------- estado ----------

const transport = injectedTransport();
const bridge = new Bridge(transport ?? offlineTransport(), 'js');
const stage = document.getElementById('stage')!;
const editor = new Editor(document.getElementById('c') as HTMLCanvasElement, stage);
let content: ContentIndex = { version: 1, fonts: [], templates: [], stickers: [], backgrounds: [], scenes: [] };
let brandKit: BrandKit = { profile: {}, colors: {}, fonts: {} };
let draftId: string | undefined;
let dirty = false;
let saveTimer: number | undefined;
let maskImage: FabricImage | undefined;

const DEFAULT_FONT = 'Montserrat';
/** Mesmo limite do `MAX_DRAFT_NAME` (data/Drafts.kt, ARQUITETURA §30). */
const MAX_NAME = 60;

interface StartPayload {
  open?:
    | { kind: 'new'; name: string; width: number; height: number }
    | { kind: 'draft'; id: string; document: unknown }
    | { kind: 'template'; id: string }
    | { kind: 'image'; url: string; name?: string }
    | { kind: 'gallery' };
  brandKit?: unknown;
  userFonts?: FontRef[];
}

// ---------- ponte: pedidos do Kotlin ----------

bridge.handle('ping', () => 'pong');
bridge.handle('loadProject', async (p) => {
  const { document: doc, draftId: id } = p as { document: unknown; draftId?: string };
  const loaded = await editor.load(doc);
  draftId = id;
  dirty = false;
  return { objects: editor.canvas.getObjects().length, width: loaded.width, height: loaded.height, name: loaded.name };
});
bridge.handle('getDocument', () => editor.toDocument());
bridge.handle('insertImage', async (p) => {
  const { url } = p as { url: string };
  await editor.addImage(url);
  return { objects: editor.canvas.getObjects().length };
});
bridge.handle('applyBrandKit', async (p) => {
  brandKit = parseBrandKit((p as { kit: unknown }).kit);
  await applyKit(false);
  return { objects: editor.canvas.getObjects().length };
});
bridge.handle('exportImage', async (p) => {
  const { format, scale } = p as { format: 'png' | 'svg'; scale?: number };
  return { data: format === 'svg' ? await editor.exportSvg() : await editor.exportRaster('png', scale ?? 1, 1) };
});
/** O Kotlin pede para salvar antes de sair da tela. */
bridge.handle('flush', async () => {
  editor.flushPending();
  await saveDraft();
  return { draftId };
});

// ---------- erros ----------

function describe(e: unknown): string {
  if (e instanceof BridgeRequestError) {
    const m: Record<string, string> = {
      unsupported: 'Recurso indisponível nesta versão',
      unavailable: 'Nenhum provedor disponível para esta ação',
      network: 'Sem conexão',
      remote: 'O serviço respondeu com erro',
      invalid: 'Não foi possível', // entrada recusada (ex.: imagem grande demais) ou saída ruim
      cancelled: 'Cancelado',
    };
    return `${m[e.code] ?? 'Erro'}: ${e.message}`;
  }
  return e instanceof Error ? e.message : String(e);
}

/** `cancellable`: mostra "Cancelar", que aborta o `signal` (a ponte manda "cancel" ao Kotlin, §26). */
async function run<T>(label: string, fn: (progress: (f: number | null, s: string) => void, signal: AbortSignal) => Promise<T>,
  cancellable = false): Promise<T | undefined> {
  const ctl = new AbortController();
  const onCancel = cancellable ? () => ctl.abort() : undefined;
  setBusy(label, onCancel);
  try {
    return await fn((f, s) => setBusy(f === null ? `${label} — ${s}` : `${label} — ${s} ${Math.round(f * 100)}%`, onCancel), ctl.signal);
  } catch (e) {
    toast(ctl.signal.aborted ? 'Cancelado' : describe(e));
    return undefined;
  } finally {
    setBusy(null);
  }
}

// ---------- rascunho ----------

editor.onChange = () => {
  dirty = true;
  updateTopbar();
  window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(() => void saveDraft(), 4000);
};

async function saveDraft(): Promise<void> {
  window.clearTimeout(saveTimer);
  if (!transport || !dirty) return;
  const payload: SaveDraftPayload = { id: draftId, name: editor.name, document: editor.toDocument(), thumbnail: editor.thumbnail() };
  try {
    const r = await bridge.request<{ id: string }>('saveDraft', payload);
    draftId = r.id;
    dirty = false;
  } catch (e) {
    toast('Rascunho não salvo: ' + describe(e));
  }
}

// ---------- brand kit / templates ----------

async function applyKit(variables: boolean): Promise<void> {
  const doc = applyBrandKit(editor.toDocument(), brandKit, { variables });
  await editor.load(doc);
  editor.commit();
}

async function openTemplate(entry: TemplateEntry): Promise<void> {
  await run('Abrindo template', async () => {
    const raw = parseDocument(await loadTemplate(entry));
    await editor.load(applyBrandKit(raw, brandKit));
    draftId = undefined;
    dirty = true;
    editor.commit();
  });
}

// ---------- barra superior ----------

const topbar = document.getElementById('topbar')!;
function updateTopbar(): void {
  topbar.replaceChildren(
    button('↶', () => void editor.undo(), 'icon' + (editor.history.canUndo ? '' : ' off')),
    button('↷', () => void editor.redo(), 'icon' + (editor.history.canRedo ? '' : ' off')),
    h('button', { class: 'title', type: 'button', title: 'Renomear', onclick: showRename }, editor.name),
    button('Camadas', showLayers),
    button('Salvar', () => void saveDraft().then(() => toast(transport ? 'Rascunho salvo' : 'Sem app nativo'))),
    button('Exportar', showExport, 'primary'),
  );
}

/** O nome não entra no desfazer: o `restore` do histórico não relê o `name`. */
function showRename(): void {
  const input = h('input', { type: 'text', class: 'name', value: editor.name, maxlength: MAX_NAME, enterkeyhint: 'done' });
  const save = (): void => void (async () => {
    const name = input.value.trim().slice(0, MAX_NAME);
    close();
    if (!name || name === editor.name) return;
    editor.name = name;
    dirty = true;
    updateTopbar();
    await saveDraft();
    if (!transport) toast('Sem app nativo');
    else if (!dirty) toast('Rascunho salvo'); // se falhou, o saveDraft já avisou
  })();
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') save(); });
  const close = openSheet('Nome do design', h('div', {}, input,
    h('div', { class: 'row' }, button('Cancelar', () => close()), button('Salvar', save, 'primary'))));
  input.focus();
  input.select();
}

// ---------- painel de propriedades ----------

const props = document.getElementById('props')!;
editor.onSelection = (o) => renderProps(o);

function renderProps(o: FabricObject | undefined): void {
  if (maskImage) return renderMaskProps();
  if (!o) { props.replaceChildren(); props.classList.remove('show'); return; }
  const rows: Node[] = [];
  rows.push(h('div', { class: 'row scroll' },
    button('Duplicar', () => void editor.duplicate()),
    button('Excluir', () => editor.remove(), 'danger'),
    button('Frente', () => editor.order('front')),
    button('Avançar', () => editor.order('forward')),
    button('Recuar', () => editor.order('backward')),
    button('Fundo', () => editor.order('back')),
    button(o.lockMovementX ? 'Destravar' : 'Travar', () => { editor.toggleLock(); renderProps(editor.active); }),
    button('Espelhar ↔', () => editor.flip('x')),
    button('Espelhar ↕', () => editor.flip('y')),
    button('Centralizar', () => editor.centerActive()),
  ));
  if (o instanceof FabricText) rows.push(...textProps(o));
  else if (o instanceof FabricImage) rows.push(...imageProps(o));
  else rows.push(h('div', { class: 'row scroll' },
    colorInput('Preenchimento', String(o.fill ?? '#000000'), (v) => editor.set({ fill: v, brandColor: undefined })),
    colorInput('Contorno', String(o.stroke ?? '#000000'), (v) => editor.set({ stroke: v, brandStroke: undefined })),
    slider('Espessura', 0, 40, 1, o.strokeWidth ?? 0, (v) => editor.set({ strokeWidth: v }))));
  rows.push(h('div', { class: 'row' }, slider('Opacidade', 0, 1, 0.05, o.opacity ?? 1, (v) => editor.set({ opacity: v }))));
  props.replaceChildren(...rows);
  props.classList.add('show');
}

function textProps(t: FabricText): Node[] {
  const families = knownFamilies();
  const m = Math.min(editor.width, editor.height);
  return [
    h('div', { class: 'row scroll' },
      select('Fonte', families.map((f) => [f, f]), t.fontFamily, (v) => { editor.set({ fontFamily: v, brandFont: undefined }); }),
      colorInput('Cor', String(t.fill), (v) => editor.set({ fill: v, brandColor: undefined })),
      button('N', () => editor.set({ fontWeight: Number(t.fontWeight) >= 600 || t.fontWeight === 'bold' ? 400 : 700 }), 'icon b'),
      button('I', () => editor.set({ fontStyle: t.fontStyle === 'italic' ? 'normal' : 'italic' }), 'icon i'),
      button('Alinhar', () => {
        const order = ['left', 'center', 'right', 'justify'];
        editor.set({ textAlign: order[(order.indexOf(t.textAlign) + 1) % order.length] });
      }),
      button(t.shadow ? 'Sem sombra' : 'Sombra', () => { editor.setShadow(!t.shadow); renderProps(t); })),
    h('div', { class: 'row scroll' },
      slider('Tamanho', 8, Math.round(m * 0.4), 1, Math.round(t.fontSize), (v) => editor.set({ fontSize: v })),
      slider('Espaçamento', -100, 800, 10, t.charSpacing ?? 0, (v) => editor.set({ charSpacing: v })),
      slider('Entrelinha', 0.6, 3, 0.05, t.lineHeight ?? 1.16, (v) => editor.set({ lineHeight: v }))),
    h('div', { class: 'row scroll' },
      colorInput('Contorno', String(t.stroke ?? '#000000'), (v) => editor.set({ stroke: v, paintFirst: 'stroke' })),
      slider('Espessura', 0, Math.round(m * 0.02), 1, t.strokeWidth ?? 0, (v) => editor.set({ strokeWidth: v, paintFirst: 'stroke' })),
      t instanceof Textbox ? slider('Curva', -100, 100, 1, Number(t.get('curve') ?? 0), (v) => editor.setCurve(v)) : null),
    h('div', { class: 'row scroll ai' }, button('✨ Reescrever', () => showRewrite(t))),
  ];
}

// ---------- texto com IA (§18.5) ----------

function setText(t: FabricText, text: string): void {
  t.set({ text });
  editor.refitCurve(t);
  t.setCoords();
  editor.canvas.requestRenderAll();
  editor.commit();
}

async function requestRewrite(t: FabricText, style: RewriteStyle): Promise<string[] | undefined> {
  let payload;
  try {
    payload = rewritePayload(t.text ?? '', style);
  } catch (e) {
    toast(describe(e));
    return undefined;
  }
  const r = await run('Reescrevendo', (p, sig) => bridge.request<{ variants: unknown; servedBy?: string }>('ai.rewriteText', payload, p, sig), true);
  if (!r) return undefined;
  const variants = parseVariants(r, payload.text, style);
  if (!variants.length) toast('A IA não trouxe nada diferente; tente outro estilo');
  else if (r.servedBy) toast(`Escrito por ${r.servedBy}`);
  return variants;
}

function showRewrite(t: FabricText): void {
  const results = h('div', { class: 'list' });
  const pick = (style: RewriteStyle) => void (async () => {
    results.replaceChildren(h('p', { class: 'hint' }, 'Escrevendo…'));
    const variants = await requestRewrite(t, style);
    results.replaceChildren(...(variants ?? []).map((v) =>
      h('button', { class: 'big', type: 'button', onclick: () => { setText(t, v); close(); } }, v)));
  })();
  const close = openSheet('Reescrever com IA', h('div', {},
    h('p', { class: 'hint' }, 'Escolha um estilo e toque na versão que preferir.'),
    h('div', { class: 'chips' }, ...REWRITE_STYLES.map(([id, label]) => button(label, () => pick(id)))),
    results));
}

function showGenerateCopy(): void {
  const brief = h('textarea', { rows: 4, placeholder: 'Ex.: padaria artesanal, pão de fermentação natural, promoção de sexta' });
  const close = openSheet('Gerar textos com IA', h('div', {},
    h('p', { class: 'hint' }, 'Descreva o produto ou a promoção. A IA cria título, subtítulo e chamada.'),
    brief,
    h('div', { class: 'row' }, button('Gerar', () => void (async () => {
      const text = brief.value.trim();
      if (!text) { toast('Descreva o produto ou a promoção'); return; }
      close();
      const r = await run('Escrevendo', (p, sig) => bridge.request('ai.generateCopy', { brief: text }, p, sig), true);
      if (!r) return;
      try {
        insertCopy(parseCopy(r));
      } catch (e) {
        toast(describe(e));
      }
    })(), 'primary'))));
}

function insertCopy(c: CopyResult): void {
  const heading = brandKit.fonts.heading ?? DEFAULT_FONT;
  const bodyFont = brandKit.fonts.body ?? DEFAULT_FONT;
  // empilha pela altura real (o texto quebra em linhas) e centraliza o bloco; a origem dos objetos é o centro
  const items = ([['title', heading, c.title], ['subtitle', heading, c.subtitle], ['body', bodyFont, c.cta]] as const)
    .map(([kind, font, text]) => { const o = editor.addText(kind, font); o.set({ text }); return o; });
  const gap = editor.height * 0.04;
  const total = items.reduce((s, o) => s + o.getScaledHeight(), 0) + gap * (items.length - 1);
  let y = Math.max(gap, (editor.height - total) / 2);
  for (const o of items) {
    o.set({ top: y + o.getScaledHeight() / 2 });
    o.setCoords();
    y += o.getScaledHeight() + gap;
  }
  editor.canvas.requestRenderAll();
  editor.commit();
  toast(c.servedBy ? `Textos inseridos (${c.servedBy})` : 'Textos inseridos');
}

const FILTERS: [FilterPreset, string][] = [['none', 'Nenhum'], ['grayscale', 'P&B'], ['sepia', 'Sépia'], ['vintage', 'Vintage'],
  ['polaroid', 'Polaroid'], ['kodachrome', 'Kodachrome'], ['invert', 'Inverter']];

function imageProps(img: FabricImage): Node[] {
  return [
    h('div', { class: 'row scroll' },
      button('Filtros', () => showFilters(img)),
      button('Recortar', () => {
        if (editor.startCrop()) {
          props.replaceChildren(h('div', { class: 'row' }, h('span', { class: 'hint' }, 'Arraste as bordas para recortar'),
            button('Concluir', () => { editor.endCrop(); renderProps(editor.active); }, 'primary')));
        }
      }),
      button('Usar como fundo', () => void (async () => {
        const src = editor.imageSrc(img);
        editor.remove();
        await editor.setBackgroundImage(src);
      })())),
    h('div', { class: 'row scroll ai' },
      button('✨ Remover fundo', () => void aiRemoveBg(img)),
      button('✨ Remover objeto', () => startMask(img)),
      button('✨ Remover texto', () => void aiRemoveText(img)),
      button('✨ Vetorizar (SVG)', () => void aiVectorize(img)),
      button('✨ Melhorar resolução', () => aiUpscale(img))),
  ];
}

function showFilters(img: FabricImage): void {
  const adj: Adjustments = { brightness: 0, contrast: 0, saturation: 0, blur: 0 };
  let preset = (img.get('filterPreset') as FilterPreset | undefined) ?? 'none';
  for (const f of img.filters) {
    const o = f.toObject() as Record<string, number>;
    if (f.type === 'Brightness') adj.brightness = o.brightness;
    if (f.type === 'Contrast') adj.contrast = o.contrast;
    if (f.type === 'Saturation') adj.saturation = o.saturation;
    if (f.type === 'Blur') adj.blur = o.blur;
  }
  const apply = () => editor.applyFilters(img, preset, adj);
  // o preset ativo fica destacado; "Nenhum" zera só o preset, e "Zerar ajustes" só os sliders (§29)
  const chips = FILTERS.map(([id, label]) => button(label, () => {
    preset = id;
    apply();
    chips.forEach((c, i) => c.classList.toggle('primary', FILTERS[i][0] === preset));
  }, id === preset ? 'primary' : ''));
  const reset = () => {
    adj.brightness = adj.contrast = adj.saturation = adj.blur = 0;
    apply();
    showFilters(img);
  };
  openSheet('Filtros', h('div', {},
    h('div', { class: 'chips' }, ...chips),
    // rótulos de largura fixa: as quatro trilhas começam na mesma coluna (§31)
    h('div', { class: 'sliders' },
      slider('Brilho', -0.6, 0.6, 0.02, adj.brightness, (v) => { adj.brightness = v; apply(); }),
      slider('Contraste', -0.6, 0.6, 0.02, adj.contrast, (v) => { adj.contrast = v; apply(); }),
      slider('Saturação', -1, 1, 0.02, adj.saturation, (v) => { adj.saturation = v; apply(); }),
      slider('Desfoque', 0, 0.5, 0.01, adj.blur, (v) => { adj.blur = v; apply(); })),
    h('div', { class: 'row' }, button('Zerar ajustes', reset))));
}

// ---------- IA (ponte) ----------

async function aiRemoveBg(img: FabricImage): Promise<void> {
  const r = await run('Removendo fundo', (p, sig) => bridge.request<BlobResult>('ai.removeBg', { src: editor.imageSrc(img) }, p, sig), true);
  if (r) { await editor.replaceImage(img, r.url); toast(served('Fundo removido', r)); }
}

function startMask(img: FabricImage): void {
  maskImage = img;
  editor.startMask(Math.min(editor.width, editor.height) * 0.04);
  renderMaskProps();
}

function renderMaskProps(): void {
  const m = Math.min(editor.width, editor.height);
  props.replaceChildren(
    h('div', { class: 'row' }, h('span', { class: 'hint' }, 'Pinte o que deve sumir')),
    h('div', { class: 'row' },
      slider('Pincel', m * 0.01, m * 0.12, 1, m * 0.04, (v) => editor.setMaskBrush(v)),
      button('Cancelar', () => { editor.endMask(undefined); maskImage = undefined; renderProps(editor.active); }),
      button('Aplicar', () => void finishMask(), 'primary')));
  props.classList.add('show');
}

async function finishMask(): Promise<void> {
  const img = maskImage;
  maskImage = undefined;
  const mask = editor.endMask(img);
  renderProps(undefined);
  if (!img || !mask) { toast('Nada pintado'); return; }
  const r = await run('Removendo objeto', (p, sig) => bridge.request<BlobResult>('ai.inpaint', { src: editor.imageSrc(img), mask }, p, sig), true);
  if (r) { await editor.replaceImage(img, r.url); toast(served('Objeto removido', r)); }
}

async function aiRemoveText(img: FabricImage): Promise<void> {
  const found = await run('Procurando texto', () => bridge.request<{ blocks: TextBox[] }>('ai.detectText', { src: editor.imageSrc(img) }));
  if (!found) return;
  if (found.blocks.length === 0) { toast('Nenhum texto encontrado'); return; }
  const chosen = new Set(found.blocks.map((_, i) => i));
  const close = openSheet('Remover texto', h('div', {},
    h('p', { class: 'hint' }, 'Desmarque o que deve ficar'),
    ...found.blocks.map((b, i) => {
      const cb = h('input', { type: 'checkbox', checked: true });
      cb.addEventListener('change', () => { if (cb.checked) chosen.add(i); else chosen.delete(i); });
      return h('label', { class: 'check' }, cb, h('span', {}, b.text.replace(/\s+/g, ' ').slice(0, 80)));
    }),
    h('div', { class: 'row' }, button('Remover', () => void (async () => {
      close();
      const blocks = found.blocks.filter((_, i) => chosen.has(i));
      if (!blocks.length) return;
      const r = await run('Removendo texto', (p, sig) => bridge.request<BlobResult>('ai.removeText', { src: editor.imageSrc(img), blocks }, p, sig), true);
      if (r) { await editor.replaceImage(img, r.url); toast(served('Texto removido', r)); }
    })(), 'primary'))));
}

async function aiVectorize(img: FabricImage): Promise<void> {
  let mode: 'color' | 'binary' = 'color';
  const close = openSheet('Vetorizar', h('div', {},
    h('p', { class: 'hint' }, 'Converte a imagem em formas vetoriais (bom para logos e ícones).'),
    select('Modo', [['color', 'Colorido'], ['binary', 'Preto e branco']], mode, (v) => { mode = v as typeof mode; }),
    h('div', { class: 'row' }, button('Vetorizar', () => void (async () => {
      close();
      const r = await run('Vetorizando', (p, sig) => bridge.request<{ svg: string }>('ai.vectorize', { src: editor.imageSrc(img), colorMode: mode }, p, sig), true);
      if (r) { await editor.addSvgString(r.svg, 'Vetor', img); toast('Vetor inserido sobre a imagem'); }
    })(), 'primary'))));
}

function aiUpscale(img: FabricImage): void {
  const go = (factor: 2 | 4) => {
    close();
    void (async () => {
      const r = await run('Melhorando resolução', (p, sig) => bridge.request<BlobResult>('ai.upscale', { src: editor.imageSrc(img), factor }, p, sig), true);
      if (r) { await editor.replaceImage(img, r.url); toast(served(`Resolução ${factor}× (${r.width}×${r.height})`, r)); }
    })();
  };
  const close = openSheet('Melhorar resolução', h('div', {},
    h('p', { class: 'hint' }, 'Amplia a imagem com IA no aparelho, até 1 MP de entrada (ex.: 1024×1024). Pode levar 1–2 minutos.'),
    h('div', { class: 'row' }, button('2×', () => go(2), 'primary'), button('4×', () => go(4)))));
}

function served(what: string, r: BlobResult): string {
  return r.servedBy ? `${what} (${r.servedBy})` : what;
}

// ---------- abas ----------

const tabs: [string, () => void][] = [
  ['Templates', showTemplates],
  ['Texto', showText],
  ['Imagem', showImage],
  ['Formas', showShapes],
  ['Adesivos', showStickers],
  ['Fundo', showBackgrounds],
  ['Tamanho', showSize],
  ['Marca', showBrand],
];
document.getElementById('tabs')!.replaceChildren(...tabs.map(([label, fn]) => button(label, fn)));

function showTemplates(): void {
  const tile = (t: TemplateEntry) => {
    const im = h('img', { alt: t.name });
    void loadTemplate(t).then((d) => renderThumbnail(applyBrandKit(parseDocument(d), brandKit), 240)).then((u) => { im.src = u; })
      .catch((e: unknown) => console.warn('thumb', t.id, e));
    return h('button', { class: 'tile', type: 'button', onclick: () => void (async () => {
      if (editor.canvas.getObjects().length && !(await confirmSheet('Usar template', 'Substituir o design atual pelo template?', 'Substituir'))) return;
      close();
      await openTemplate(t);
    })() }, im, h('span', {}, t.name));
  };
  const cats = [...new Set(content.templates.map((t) => t.category))];
  const close = openSheet('Templates', h('div', {}, ...cats.flatMap((c) => [h('h4', {}, c),
    h('div', { class: 'grid' }, ...content.templates.filter((x) => x.category === c).map(tile))])), { tall: true });
}

function showText(): void {
  const heading = brandKit.fonts.heading ?? DEFAULT_FONT;
  const bodyFont = brandKit.fonts.body ?? DEFAULT_FONT;
  const close = openSheet('Texto', h('div', { class: 'list' },
    h('button', { class: 'big title', type: 'button', style: `font-family:'${heading}'`, onclick: () => { editor.addText('title', heading); close(); } }, 'Adicionar título'),
    h('button', { class: 'big subtitle', type: 'button', style: `font-family:'${heading}'`, onclick: () => { editor.addText('subtitle', heading); close(); } }, 'Adicionar subtítulo'),
    h('button', { class: 'big', type: 'button', style: `font-family:'${bodyFont}'`, onclick: () => { editor.addText('body', bodyFont); close(); } }, 'Adicionar texto'),
    button('✨ Gerar textos com IA', () => { close(); showGenerateCopy(); }),
    button('Carregar fonte do aparelho…', () => void (async () => {
      const f = await run('Carregando fonte', () => bridge.request<FontRef>('pickFont'));
      if (f) { registerFont(f.family, f.url); toast(`Fonte ${f.family} adicionada`); }
    })())));
}

function showImage(): void {
  const close = openSheet('Imagem', h('div', { class: 'list' },
    button('Escolher da galeria…', () => void (async () => {
      close();
      const r = await run('Abrindo imagem', () => bridge.request<BlobResult>('pickImage'));
      if (r) await editor.addImage(r.url);
    })(), 'primary'),
    brandKit.logoUrl ? button('Inserir logo do brand kit', () => { close(); void editor.addImage(brandKit.logoUrl!, { fit: 0.3 }); }) : null));
}

function showShapes(): void {
  const color = brandKit.colors.primary ?? '#3b6fd8';
  const shapes: [ShapeKind, string][] = [['rect', '▬ Retângulo'], ['rounded', '▢ Arredondado'], ['circle', '● Círculo'],
    ['triangle', '▲ Triângulo'], ['star', '★ Estrela'], ['arrow', '➜ Seta'], ['line', '─ Linha']];
  const close = openSheet('Formas', h('div', { class: 'chips' },
    ...shapes.map(([k, label]) => button(label, () => { editor.addShape(k, color); close(); }))));
}

function showStickers(): void {
  const cats = [...new Set(content.stickers.map((s) => s.category))];
  const close = openSheet('Adesivos', h('div', {}, ...cats.flatMap((c) => [h('h4', {}, c), h('div', { class: 'grid small' },
    ...content.stickers.filter((s) => s.category === c).map((s) => h('button', { class: 'tile', type: 'button',
      onclick: () => { close(); void run('Inserindo', () => editor.addSvgFromUrl(contentUrl(s.file), s.name)); } },
    h('img', { src: contentUrl(s.file), alt: s.name }))))])), { tall: true });
}

function showBackgrounds(): void {
  const close = openSheet('Fundo', h('div', {},
    h('div', { class: 'row' }, colorInput('Cor sólida', toHex(editor.canvas.backgroundColor), (v) => editor.setBackgroundColor(v))),
    h('h4', {}, 'Cores e degradês'),
    h('div', { class: 'grid small' }, ...content.backgrounds.filter((b) => b.kind !== 'image').map((b) => h('button', {
      class: 'tile swatch', type: 'button', style: `background:${cssOf(b)}`, title: b.name,
      onclick: () => {
        if (b.kind === 'solid') editor.setBackgroundColor(b.colors![0]);
        else editor.setBackgroundGradient(b.colors!, b.kind as 'linear' | 'radial', b.angle);
      },
    }))),
    h('h4', {}, 'Imagens'),
    h('div', { class: 'grid small' }, ...[...content.backgrounds.filter((b) => b.kind === 'image').map((b) => [b.file!, b.file!] as const),
      ...content.scenes.map((s) => [s.file, s.thumb] as const)].map(([file, thumb]) => h('button', { class: 'tile', type: 'button',
      onclick: () => { close(); void run('Aplicando fundo', () => editor.setBackgroundImage(contentUrl(file))); } },
    h('img', { src: contentUrl(thumb) })))),
    ...(Object.keys(brandKit.colors).length ? [h('h4', {}, 'Cores da marca'), h('div', { class: 'grid small' },
      ...Object.entries(brandKit.colors).map(([role, c]) => h('button', { class: 'tile swatch', type: 'button', style: `background:${c}`,
        onclick: () => editor.setBackgroundColor(c!, role) })))] : [])), { tall: true });
}

function cssOf(b: { kind: string; colors?: string[]; angle?: number }): string {
  const c = b.colors ?? ['#fff'];
  if (b.kind === 'solid') return c[0];
  if (b.kind === 'radial') return `radial-gradient(${c.join(',')})`;
  return `linear-gradient(${(b.angle ?? 90) + 90}deg, ${c.join(',')})`;
}

const SIZES: [string, number, number][] = [
  ['Post quadrado', 1080, 1080], ['Post retrato 4:5', 1080, 1350], ['Story / Reels', 1080, 1920],
  ['Capa Facebook', 1640, 624], ['Banner 16:9', 1920, 1080], ['Miniatura YouTube', 1280, 720],
  ['Logo', 1000, 1000], ['Cartão de visita', 1050, 600], ['Folheto A4 (150 dpi)', 1240, 1754], ['Pôster A3 (150 dpi)', 1754, 2480],
];

function showSize(): void {
  let scale = true;
  const w = h('input', { type: 'number', min: 16, max: 8000, value: editor.width });
  const hh = h('input', { type: 'number', min: 16, max: 8000, value: editor.height });
  const sc = h('input', { type: 'checkbox', checked: true });
  sc.addEventListener('change', () => { scale = sc.checked; });
  const apply = (W: number, H: number) => {
    if (!(W >= 16 && H >= 16 && W <= 8000 && H <= 8000)) { toast('Tamanho entre 16 e 8000 px'); return; }
    editor.resize(Math.round(W), Math.round(H), scale);
    close();
  };
  const close = openSheet('Tamanho', h('div', {},
    h('div', { class: 'chips' }, ...SIZES.map(([n, W, H]) => button(`${n} · ${W}×${H}`, () => apply(W, H)))),
    h('div', { class: 'row' }, h('label', {}, 'L ', w), h('label', {}, 'A ', hh), button('Aplicar', () => apply(Number(w.value), Number(hh.value)), 'primary')),
    h('label', { class: 'check' }, sc, h('span', {}, 'Ajustar o conteúdo ao novo tamanho'))));
}

function showBrand(): void {
  const kit = brandKit;
  const has = Object.keys(kit.colors).length + Object.keys(kit.fonts).length + Object.keys(kit.profile).length > 0 || !!kit.logoUrl;
  const close = openSheet('Brand kit', h('div', { class: 'list' },
    has ? h('div', { class: 'chips' }, ...Object.entries(kit.colors).map(([r, c]) => h('span', { class: 'dot', style: `background:${c}`, title: r }))) : null,
    has ? null : h('p', { class: 'hint' }, 'Configure cores, fontes, logo e dados da empresa em Brand kit, na tela inicial.'),
    button('Aplicar cores e fontes ao design', () => { close(); void run('Aplicando', () => applyKit(false)); }, 'primary'),
    button('Preencher dados da empresa ({{…}})', () => { close(); void run('Aplicando', () => applyKit(true)); }),
    kit.profile.company ? button(`Inserir "${kit.profile.company}"`, () => { close(); editor.addText('title', kit.fonts.heading ?? DEFAULT_FONT).set({ text: kit.profile.company, fill: kit.colors.primary ?? '#222' }); editor.commit(); }) : null,
    kit.logoUrl ? button('Inserir logo', () => { close(); void editor.addImage(kit.logoUrl!, { fit: 0.3 }); }) : null,
    button('Recarregar do app', () => void (async () => {
      const k = await run('Carregando', () => bridge.request('getBrandKit'));
      if (k !== undefined) { brandKit = parseBrandKit(k); close(); showBrand(); }
    })())));
}

// ---------- camadas ----------

function showLayers(): void {
  const objs = [...editor.canvas.getObjects()].reverse();
  const label = (o: FabricObject) => (o.get('layerName') as string | undefined)
    ?? (o instanceof FabricText ? `“${o.text.slice(0, 24)}”` : o instanceof FabricImage ? 'Imagem' : o.type);
  const close = openSheet('Camadas', h('div', { class: 'list' }, ...(objs.length ? objs.map((o) => h('div', { class: 'layer' },
    h('button', { type: 'button', class: 'grow', onclick: () => {
      if (!o.selectable) return;
      editor.canvas.setActiveObject(o);
      editor.canvas.requestRenderAll();
      renderProps(o);
      close();
    } }, label(o) + (o.selectable ? '' : ' (fundo)')),
    button(o.visible ? '👁' : '—', () => { o.set('visible', !o.visible); editor.commit(); close(); showLayers(); }, 'icon')))
    : [h('p', { class: 'hint' }, 'Nenhum objeto')])));
}

// ---------- exportar ----------

function showExport(): void {
  let format: ExportPayload['format'] = 'png';
  let scale = 1;
  let quality = 0.92;
  const name = (editor.name || 'design').replace(/[^\p{L}\p{N}_-]+/gu, '_');
  const go = (action: ExportPayload['action']) => void (async () => {
    close();
    await run('Exportando', async () => {
      const data = format === 'svg' ? await editor.exportSvg() : await editor.exportRaster(format === 'png' ? 'png' : 'jpeg', scale, quality);
      const payload: ExportPayload = { format, action, name, data };
      const r = await bridge.request<{ location?: string }>('export', payload);
      toast(r.location ? `Salvo em ${r.location}` : 'Pronto');
    });
  })();
  const toMockup = () => void (async () => {
    close();
    await run('Preparando o mockup', async () => {
      const data = await editor.exportRaster('png', 1, 1);
      await bridge.request('export', { format: 'png', action: 'mockup', name, data } satisfies ExportPayload);
    });
  })();
  // a qualidade só vale para JPG (§29)
  const qualityRow = slider('Qualidade JPG', 0.5, 1, 0.01, quality, (v) => { quality = v; });
  qualityRow.hidden = true;
  // o SVG é vetor: a resolução não vale para ele (§31)
  const scaleRow = select('Resolução', [['1', `1× (${editor.width}×${editor.height})`], ['2', '2×'], ['3', '3×']], '1', (v) => { scale = Number(v); });
  const close = openSheet('Exportar', h('div', {},
    select('Formato', [['png', 'PNG'], ['jpg', 'JPG'], ['svg', 'SVG (vetor)']], format, (v) => {
      format = v as typeof format;
      qualityRow.hidden = format !== 'jpg';
      scaleRow.hidden = format === 'svg';
    }),
    scaleRow,
    qualityRow,
    h('div', { class: 'row' }, button('Salvar na galeria', () => go('save'), 'primary'), button('Compartilhar', () => go('share')),
      button('Imprimir', () => go('print'))),
    h('div', { class: 'row' }, button('Ver em mockup', toMockup))));
}

// ---------- início ----------

async function start(): Promise<void> {
  updateTopbar();
  try {
    content = await loadContentIndex();
    registerBundledFonts(content.fonts);
  } catch (e) {
    console.warn('content', e);
  }
  let startPayload: StartPayload = {};
  try {
    startPayload = await bridge.request<StartPayload>('hello', { protocol: 1, editor: '0.4.0' });
  } catch (e) {
    if (transport) toast(describe(e));
  }
  brandKit = parseBrandKit(startPayload.brandKit);
  for (const f of startPayload.userFonts ?? []) registerFont(f.family, f.url);
  const open = startPayload.open;
  // abrir um rascunho ou uma página em branco não é alteração: o load marca dirty, e sem isto um rascunho vazio
  // ("Sem nome") era gravado 4 s depois, ou o aberto regravado sem mudança (§28 D)
  const untouched = (): void => { dirty = false; window.clearTimeout(saveTimer); };
  if (open?.kind === 'draft') {
    await editor.load(open.document);
    draftId = open.id;
    untouched();
  } else if (open?.kind === 'template') {
    const t = content.templates.find((x) => x.id === open.id);
    if (t) await openTemplate(t); else { await editor.newDocument('Sem nome', 1080, 1080); untouched(); }
  } else if (open?.kind === 'image') {
    await editor.newDocument(open.name ?? 'Foto de produto', 1080, 1080);
    const img = await editor.addImage(open.url, { fit: 1 });
    // a página assume a proporção da imagem
    editor.resize(Math.round(img.width), Math.round(img.height), false);
    img.set({ scaleX: 1, scaleY: 1, left: img.width / 2, top: img.height / 2 });
    img.setCoords();
    editor.commit();
  } else if (open?.kind === 'new') {
    await editor.newDocument(open.name, open.width, open.height);
    untouched();
  } else if (open?.kind === 'gallery') {
    await editor.newDocument('Sem nome', 1080, 1080);
    untouched();
    showTemplates();
  } else {
    await editor.newDocument('Sem nome', 1080, 1080);
    untouched();
    if (!transport) showTemplates();
  }
  updateTopbar();
  document.body.dataset.ready = 'true';
}

window.addEventListener('pagehide', () => void saveDraft());

// Gancho para o teste instrumentado (EditorBridgeInstrumentedTest) acionar as ações como a interface faz.
const testHook: Record<string, unknown> = {
  editor,
  last: null,
  /** Faz um pedido ao Kotlin e guarda o resultado em ppEditor.last ({ok, payload} ou {ok:false, code}). */
  call: (type: string, payload?: unknown) => {
    testHook.last = null;
    return bridge.request(type, payload).then(
      (r) => { testHook.last = { ok: true, payload: r }; },
      (e: unknown) => { testHook.last = { ok: false, code: e instanceof BridgeRequestError ? e.code : 'internal' }; },
    );
  },
  removeBgOfFirstImage: () => {
    const img = editor.canvas.getObjects().find((o): o is FabricImage => o instanceof FabricImage);
    return img ? aiRemoveBg(img) : Promise.reject(new Error('sem imagem'));
  },
  lastVariants: null,
  /** Como tocar "✨ Reescrever" no 1º texto, escolher o estilo e a 1ª variante. */
  rewriteFirstText: async (style: RewriteStyle) => {
    const t = editor.canvas.getObjects().find((o): o is FabricText => o instanceof FabricText);
    if (!t) throw new Error('sem texto');
    const v = await requestRewrite(t, style);
    testHook.lastVariants = v ?? null;
    if (v?.length) setText(t, v[0]);
  },
};
(window as unknown as Record<string, unknown>).ppEditor = testHook;
void start();
