import './styles.css';
import { ActiveSelection, FabricImage, FabricObject, FabricText, Group, Shadow, Textbox } from 'fabric';
import type { WarpStyle } from './curve';
import { type CopyResult, parseCopy, parseVariants, REWRITE_STYLES, type RewriteStyle, rewritePayload } from './aiText';
import { Bridge, BridgeRequestError, injectedTransport, offlineTransport } from './bridge';
import { applyBrandKit, type BrandKit, type ColorRole, parseBrandKit } from './brandkit';
import {
  contentUrl, type ContentIndex, knownFamilies, loadContentIndex, loadTemplate, registerBundledFonts, registerFont,
  type TemplateEntry,
} from './content';
import { MAX_PAGES, parseDocument, type EasingCurve, type EmphasisFx, type EntranceFx, type ExitFx, type LayerAnimation } from './document';
import { extractBackgroundStyle } from './bgStyleTransfer';
import { EASING_OPTIONS, EMPHASIS_OPTIONS, ENTRANCE_OPTIONS, EXIT_OPTIONS, legacyFx } from './video/animation';
import { button, colorInput, confirmSheet, h, openSheet, select, setBusy, setColorPaletteProvider, slider, toast, toHex } from './dom';
import { averageColor, composite, contrastRatio, formatRatio, LOW_CONTRAST, parseColor, type Rgba, suggestReadableColor } from './contrast';
import { pickColorFromCanvas } from './eyedropper';
import { collectColors, type ColorSource, dominantColors, RecentColors } from './palette';
import { type Adjustments, type CalloutKind, Editor, type FilterPreset, renderThumbnail, type ShapeKind, SWAP_KINDS } from './editor';
import { addStop, brandGradient, evenStops, GRADIENT_PRESETS, gradientCss, type GradientSpec, MAX_STOPS, removeStop, reverseStops } from './gradients';
import { CAP_OPTIONS, type CapStyle, type ConnectorShape, type ConnectorSpec, DASH_OPTIONS, type DashStyle, SHAPE_OPTIONS, swapEnds } from './connectors';
import { LIST_OPTIONS, matchSnippet } from './textTools';
import { isFreehandPath, keepAlpha, PEN_MAX, PEN_MIN, PEN_PRESETS, type PenId, penWidth, withAlpha } from './freehandDraw';
import type { FitMode } from './imageGeometry';
import { DESIGN_FORMATS, findFormat, formatSvg, GROUP_LABELS, type MediaFormat } from './formats';
import type { GridOverlayMode, OverlayGuideMode } from './overlays';
import { AD_PREVIEW_MODES, type AdPreviewMode, buildAdPreview, previewModel } from './adPreview';
import { zoomLabel } from './viewportZoom';
import { DOT_STYLES, type DotStyle, encodeQr, EYE_STYLES, type EyeStyle, type QrConfig, type QrEcc, qrSvg } from './qrcode';
import { buildPayload, QR_KINDS, type QrKind, WIFI_AUTH } from './qrPayloads';
import {
  addColumn, addRow, columnCount, normalizeTable, removeColumn, removeRow, setCell, type TableData, TABLE_STYLES, TABLE_TEMPLATES,
  tableTemplate, type TableStyle,
} from './table';
import type { AudioRef, BlobResult, ExportPayload, ExportResult, FontRef, SaveDraftPayload, TextBox } from './protocol';
import {
  type CatalogRow, detectTemplateFields, discountLabel, isTextMergeField, MAX_CATALOG_ROWS, MERGE_FIELD_LABELS, parseCatalogText,
  TEXT_MERGE_FIELDS, type TextMergeField,
} from './dataMerge';

// ---------- estado ----------

const transport = injectedTransport();
const bridge = new Bridge(transport ?? offlineTransport(), 'js');
const stage = document.getElementById('stage')!;
const editor = new Editor(document.getElementById('c') as HTMLCanvasElement, stage);
let content: ContentIndex = { version: 1, fonts: [], templates: [], stickers: [], backgrounds: [], scenes: [], audioTracks: [] };
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
  refreshContrast();
  refreshFreehandBar();
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
    // o rótulo some em tela estreita (styles.css): a barra não pode passar da largura do celular
    h('button', { type: 'button', class: 'preview', title: 'Preview do anúncio', 'aria-label': 'Preview', onclick: showAdPreview },
      '👁️', h('span', { class: 'lbl' }, ' Preview')),
    button('Exportar', showExport, 'primary'),
  );
}

// ---------- zoom do palco (TASK-13) ----------

const zoomText = h('span', {}, '🔍 100%');
const zoomPill = h('div', { id: 'zoom-pill' },
  button('−', () => editor.zoomBy(-1), 'icon zoom-out'),
  h('button', { type: 'button', class: 'zoom-label', title: 'Encaixar na tela (100%)', onclick: () => editor.resetZoom() }, zoomText),
  button('+', () => editor.zoomBy(1), 'icon zoom-in'));
stage.append(zoomPill);
editor.onZoom = () => {
  zoomText.textContent = `🔍 ${zoomLabel(editor.zoomFactor)}`;
  zoomPill.classList.toggle('active', editor.isZoomed);
};

// ---------- preview do anúncio (TASK-13) ----------

function showAdPreview(): void {
  let url: string;
  try {
    url = editor.thumbnail(1080);
  } catch (e) {
    toast(describe(e));
    return;
  }
  const model = previewModel(brandKit, editor.name);
  let mode: AdPreviewMode = 'feed';
  const chips = h('div', { class: 'chips adp-modes' });
  const holder = h('div', { class: 'ad-preview' });
  const render = (): void => {
    chips.replaceChildren(...AD_PREVIEW_MODES.map(([m, label]) =>
      button(label, () => { mode = m; render(); }, 'chip' + (m === mode ? ' primary' : ''))));
    holder.replaceChildren(buildAdPreview(mode, url, model, {
      aspect: editor.width / editor.height,
      maxW: Math.min(window.innerWidth - 32, 360),
      maxH: window.innerHeight * 0.88 - 140,
    }));
  };
  render();
  openSheet('👁️ Preview do anúncio', h('div', {}, chips, holder,
    h('p', { class: 'hint' }, 'Simulação da moldura: confira se o texto e o preço continuam legíveis e se nada importante fica coberto.')),
  { tall: true });
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
editor.onEditText = (t) => showEditText(t, true);

function renderProps(o: FabricObject | undefined): void {
  if (maskImage) return renderMaskProps();
  // o toque no canvas em modo desenho descarta a seleção: a barra do desenho fica até o "Concluir"
  if (editor.isFreehandDrawing) return renderFreehandProps();
  if (!o) { props.replaceChildren(); props.classList.remove('show'); return; }
  const rows: Node[] = [];
  const isSelection = o instanceof ActiveSelection;
  // QR Code e tabela são grupos com dados próprios: desagrupar perderia a reedição (TASK-05)
  const isQr = Boolean(editor.qrConfigOf(o));
  const isTable = Boolean(editor.tableDataOf(o));
  rows.push(h('div', { class: 'row scroll' },
    isSelection ? button('🔗 Agrupar', () => { editor.groupActive(); renderProps(editor.active); }, 'primary group-btn') : null,
    o instanceof Group && !isSelection && !isQr && !isTable
      ? button('🔓 Desagrupar', () => { editor.ungroupActive(); renderProps(editor.active); }, 'ungroup-btn') : null,
    button('Duplicar', () => void editor.duplicate()),
    button('Excluir', () => editor.remove(), 'danger'),
    button('🎬 Animar', () => showAnimationSheet(o)),
    button('✨ Sombra', () => showShadowSheet(o)),
    button('Frente', () => editor.order('front')),
    button('Avançar', () => editor.order('forward')),
    button('Recuar', () => editor.order('backward')),
    button('Fundo', () => editor.order('back')),
    isSelection ? null : button('🔒 Travar', () => {
      if (editor.toggleLock(o)) toast('Camada travada — destrave pelo painel Camadas');
    }, 'lock-btn'),
    button('Espelhar ↔', () => editor.flip('x')),
    button('Espelhar ↕', () => editor.flip('y')),
    button('Centralizar', () => editor.centerActive()),
    button('📐 Alinhar', () => showAlignSheet()),
    button('📏 Posição / Tamanho', () => showPositionSheet(o), 'geometry-btn'),
  ));
  if (o instanceof FabricText) rows.push(...textProps(o));
  else if (o instanceof FabricImage) rows.push(...imageProps(o));
  else if (editor.connectorOf(o)) rows.push(...connectorProps());
  else if (isQr) rows.push(h('div', { class: 'row scroll' }, button('✏️ Editar QR Code', () => showQrSheet(o), 'primary edit-qr')));
  else if (isTable) rows.push(h('div', { class: 'row scroll' }, button('✏️ Editar Tabela', () => showTableEditor(o), 'primary edit-table')));
  else if (isFreehandPath(o)) rows.push(...freehandProps(o));
  else {
    const grad = editor.gradientOf(o);
    rows.push(h('div', { class: 'row scroll' },
      colorInput('Preenchimento', grad ? grad.stops[0].color : String(o.fill ?? '#000000'), (v) => editor.set({ fill: v, brandColor: undefined })),
      colorInput('Contorno', String(o.stroke ?? '#000000'), (v) => editor.set({ stroke: v, brandStroke: undefined })),
      slider('Espessura', 0, 40, 1, o.strokeWidth ?? 0, (v) => editor.set({ strokeWidth: v }))));
    if (!(o instanceof Group)) rows.push(shapeStyleRow(o));
    const chips = brandColorChips((c, role) => {
      editor.set({ fill: c, brandColor: role });
      renderProps(editor.active);
    });
    if (chips) rows.push(chips);
  }
  const merge = isSelection ? null : mergeFieldRow(o);
  if (merge) rows.push(merge);
  rows.push(h('div', { class: 'row' }, slider('Opacidade', 0, 1, 0.05, o.opacity ?? 1, (v) => editor.set({ opacity: v }))));
  props.replaceChildren(...rows);
  props.classList.add('show');
}

/** "⚡ Variável do lote" (TASK-10): o texto (ou a foto) que cada linha do ⚡ Gerar em lote substitui. */
function mergeFieldRow(o: FabricObject): HTMLElement | null {
  const isText = o instanceof FabricText;
  if (!isText && !(o instanceof FabricImage)) return null;
  const fields = isText ? TEXT_MERGE_FIELDS : (['foto'] as const);
  const current = String(o.get('mergeField') ?? '');
  return h('div', { class: 'row scroll merge-row' },
    select('⚡ Variável do lote', [['', '— nenhuma —'], ...fields.map((f): [string, string] => [f, MERGE_FIELD_LABELS[f]])], current, (v) => {
      editor.set({ mergeField: v || undefined });
      renderProps(editor.active);
    }),
    current ? button('⚡ Gerar em lote', () => showMergeSheet(), 'merge-open') : null);
}

/** Inspetor numérico: X/Y da caixa, largura/altura (com proporção) e ângulo; cada mudança vira uma entrada de undo. */
function showPositionSheet(o: FabricObject): void {
  const g0 = editor.geometryOf(o)!;
  let keepRatio = true;
  const field = (label: string, name: string, value: number) => {
    const input = h('input', { type: 'number', step: '1', value: String(Math.round(value)), 'data-field': name, inputmode: 'decimal' });
    return { input, el: h('label', { class: 'select' }, h('span', {}, label), input) };
  };
  const x = field('X (px)', 'x', g0.x);
  const y = field('Y (px)', 'y', g0.y);
  const w = field('Largura (px)', 'width', g0.width);
  const ht = field('Altura (px)', 'height', g0.height);
  const a = field('Ângulo (°)', 'angle', g0.angle);
  const refresh = () => {
    const g = editor.geometryOf(o)!;
    x.input.value = String(Math.round(g.x));
    y.input.value = String(Math.round(g.y));
    w.input.value = String(Math.round(g.width));
    ht.input.value = String(Math.round(g.height));
    a.input.value = String(Math.round(g.angle));
    const r = angleSlider.querySelector('input')!;
    r.value = String(Math.round(g.angle));
    angleSlider.querySelector('.val')!.textContent = r.value;
  };
  const apply = (patch: Parameters<Editor['setExactGeometry']>[0]) => { editor.setExactGeometry(patch, o); refresh(); };
  const angleSlider = slider('Rotação', -180, 180, 1, Math.round(g0.angle), (v) => apply({ angle: v }));
  const num = (el: HTMLInputElement) => (el.value.trim() === '' ? NaN : Number(el.value.replace(',', '.')));
  const onNum = (el: HTMLInputElement, fn: (v: number) => void, positive = false) => el.addEventListener('change', () => {
    const v = num(el);
    if (!Number.isFinite(v) || (positive && v <= 0)) { refresh(); return; }
    fn(v);
  });
  onNum(x.input, (v) => apply({ x: v }));
  onNum(y.input, (v) => apply({ y: v }));
  onNum(w.input, (v) => {
    const g = editor.geometryOf(o)!;
    apply(keepRatio && g.width > 0 ? { width: v, height: (v * g.height) / g.width } : { width: v });
  }, true);
  onNum(ht.input, (v) => {
    const g = editor.geometryOf(o)!;
    apply(keepRatio && g.height > 0 ? { height: v, width: (v * g.width) / g.height } : { height: v });
  }, true);
  onNum(a.input, (v) => apply({ angle: v }));
  const ratio = h('input', { type: 'checkbox', checked: true, 'data-field': 'keepRatio' });
  ratio.addEventListener('change', () => { keepRatio = ratio.checked; });
  const chip = (d: number) => button((d > 0 ? '+' : '') + d + '°', () => apply({ angle: d }), 'chip angle-chip');
  openSheet('Posição e tamanho', h('div', { class: 'list geometry' },
    h('div', { class: 'row' }, x.el, y.el),
    h('div', { class: 'row' }, w.el, ht.el),
    h('label', { class: 'check' }, ratio, h('span', {}, '🔒 Manter proporção')),
    h('div', { class: 'row' }, a.el),
    angleSlider,
    h('div', { class: 'chips' }, ...[0, -45, -15, 15, 45, 90].map(chip))));
}

function showAlignSheet(): void {
  const isMultiple = editor.canvas.getActiveObject()?.type === 'activeSelection';
  const targetDesc = isMultiple ? 'entre os objetos selecionados' : 'em relação à página';

  const close = openSheet('Alinhamento e Distribuição', h('div', { class: 'list' },
    h('p', { class: 'hint' }, `Alinhar ${targetDesc}:`),
    h('div', { class: 'row' },
      button('⬅ Esquerda', () => { editor.align('left'); }),
      button('↔ Centro H', () => { editor.align('center-x'); }),
      button('➡ Direita', () => { editor.align('right'); }),
    ),
    h('div', { class: 'row' },
      button('⬆ Topo', () => { editor.align('top'); }),
      button('↕ Centro V', () => { editor.align('center-y'); }),
      button('⬇ Base', () => { editor.align('bottom'); }),
    ),
    h('h4', {}, 'Distribuir espaçamento:'),
    h('div', { class: 'row' },
      button('📏 Distribuir Horizontal', () => { editor.distribute('horizontal'); }),
      button('📐 Distribuir Vertical', () => { editor.distribute('vertical'); }),
    ),
    button('Fechar', () => close(), 'primary')
  ));
}

function brandColorChips(onPick: (color: string, role: ColorRole) => void): HTMLElement | null {
  const roles: ColorRole[] = ['primary', 'secondary', 'accent', 'text'];
  const available = roles.filter((r) => Boolean(brandKit.colors[r]));
  if (available.length === 0) return null;
  const labels: Record<ColorRole, string> = {
    primary: 'Primária',
    secondary: 'Secundária',
    accent: 'Destaque',
    text: 'Texto',
    background: 'Fundo',
  };
  return h('div', { class: 'row scroll' },
    h('span', { class: 'hint', style: 'font-size: 12px; margin-right: 4px;' }, 'Marca:'),
    ...available.map((r) => {
      const c = brandKit.colors[r]!;
      return button(`● ${labels[r]}`, () => onPick(c, r), 'chip');
    })
  );
}

// ---------- cores: paleta rápida, conta-gotas e contraste WCAG (TASK-03) ----------

const recentColors = new RecentColors((() => { try { return window.localStorage; } catch { return null; } })());

/** A maior imagem visível que não é o fundo: a foto do produto. */
function mainProductImage(): FabricImage | undefined {
  let best: FabricImage | undefined;
  let area = 0;
  for (const o of editor.canvas.getObjects()) {
    if (!(o instanceof FabricImage) || !o.visible || o.get('layerName') === 'background') continue;
    const r = o.getBoundingRect();
    if (r.width * r.height > area) { area = r.width * r.height; best = o; }
  }
  return best;
}

/** Até 4 cores dominantes da imagem (grade 16×16); imagem de outra origem suja o canvas → nenhuma. */
function imageColors(img: FabricImage): string[] {
  try {
    const c = document.createElement('canvas');
    c.width = 16;
    c.height = 16;
    const ctx = c.getContext('2d')!;
    ctx.drawImage(img.getElement() as CanvasImageSource, 0, 0, 16, 16);
    return dominantColors(ctx.getImageData(0, 0, 16, 16).data, 16, 16, 4);
  } catch {
    return [];
  }
}

/** "Cores neste anúncio": camadas + fundo + cores dominantes da foto do produto. */
function documentColors(): string[] {
  const out = collectColors(editor.canvas.getObjects() as unknown as ColorSource[], editor.canvas.backgroundColor);
  const img = mainProductImage();
  if (img) for (const c of imageColors(img)) if (!out.includes(c)) out.push(c);
  return out;
}

function showColorPalette(current: string, apply: (hex: string) => void): void {
  document.getElementById('palette')?.remove();
  const pick = (hex: string) => { apply(hex); recentColors.add(hex); close(); };
  const swatches = (colors: string[]) => h('div', { class: 'chips' }, ...colors.map((c) => h('button', {
    type: 'button', class: 'swatch-chip', style: `background:${c}`, title: c, 'data-color': c, onclick: () => pick(c),
  })));
  const custom = h('input', { type: 'color', value: toHex(current) });
  custom.addEventListener('change', () => pick(custom.value));
  const brand = Object.values(brandKit.colors).filter((c): c is string => Boolean(c)).map((c) => toHex(c));
  const docColors = documentColors();
  const recent = recentColors.colors;
  const root = h('div', { id: 'palette' },
    h('div', { class: 'scrim', onclick: () => close() }),
    h('div', { class: 'panel' },
      h('div', { class: 'sheet-head' }, h('strong', {}, 'Cor'), button('✕', () => close(), 'icon')),
      h('div', { class: 'row' },
        button('💧 Conta-gotas', () => void eyedrop(), 'primary eyedropper-btn'),
        h('label', { class: 'color' }, custom, h('span', {}, 'Outra cor…'))),
      ...(brand.length ? [h('h4', {}, 'Cores da marca'), swatches([...new Set(brand)])] : []),
      h('h4', {}, 'Cores neste anúncio'),
      docColors.length ? swatches(docColors) : h('p', { class: 'hint' }, 'Nenhuma cor ainda.'),
      ...(recent.length ? [h('h4', {}, 'Recentes'), h('div', { class: 'recent' }, swatches(recent))] : [])));
  const close = () => root.remove();
  const eyedrop = async () => {
    root.hidden = true;
    const hex = await pickColorFromCanvas(editor, toast);
    if (hex) { pick(hex); toast(`Cor ${hex} aplicada`); } else root.hidden = false;
  };
  document.body.append(root);
}
setColorPaletteProvider({ open: showColorPalette, used: (hex) => recentColors.add(hex) });

/**
 * Contraste do texto contra o que está atrás dele: o fundo marca-texto, ou a média de 9 pontos (3×3) da página renderizada
 * sem o próprio texto. Contorno (≥ 2 px) e sombra forte (alfa ≥ 0,6) contam como proteção de leitura.
 */
function textContrast(t: FabricText): { ratio: number; background: Rgba } | null {
  const fg = parseColor(t.fill);
  if (!fg) return null; // degradê/padrão: fora do verificador
  const box = parseColor(t.textBackgroundColor);
  let behind: Rgba | null = null;
  if (!box || box.a < 1) {
    try {
      const { canvas, scale } = editor.renderPageCanvas(512, (o) => o !== t);
      const ctx = canvas.getContext('2d')!;
      const r = t.getBoundingRect();
      const pts: Rgba[] = [];
      for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) {
        const x = Math.min(canvas.width - 1, Math.max(0, Math.floor((r.left + (r.width * (2 * i + 1)) / 6) * scale)));
        const y = Math.min(canvas.height - 1, Math.max(0, Math.floor((r.top + (r.height * (2 * j + 1)) / 6) * scale)));
        const d = ctx.getImageData(x, y, 1, 1).data;
        pts.push({ r: d[0], g: d[1], b: d[2], a: d[3] / 255 });
      }
      behind = averageColor(pts);
    } catch {
      behind = null;
    }
  }
  const bg = box ? (box.a < 1 && behind ? composite(box, behind) : box) : behind;
  if (!bg) return null;
  let ratio = contrastRatio(fg.a < 1 ? composite(fg, bg) : fg, bg);
  const stroke = parseColor(t.stroke);
  if (stroke && (t.strokeWidth ?? 0) >= 2) ratio = Math.max(ratio, contrastRatio(composite(stroke, bg), bg));
  const shadow = t.shadow instanceof Shadow ? parseColor(t.shadow.color) : null;
  if (shadow && shadow.a >= 0.6) ratio = Math.max(ratio, contrastRatio(composite(shadow, bg), bg));
  return { ratio, background: bg };
}

let contrastSlot: { el: HTMLElement; t: FabricText } | null = null;

function contrastRow(t: FabricText): HTMLElement {
  const el = h('div', { class: 'row contrast-slot', hidden: true });
  contrastSlot = { el, t };
  refreshContrast(true);
  return el;
}

/** Atualiza o aviso de contraste do texto selecionado (a cor pelo seletor nativo não refaz o painel). */
function refreshContrast(building = false): void {
  const s = contrastSlot;
  if (!s || (!building && (!s.el.isConnected || editor.active !== s.t))) return;
  const info = textContrast(s.t);
  s.el.dataset.ratio = info ? info.ratio.toFixed(2) : '';
  if (!info || info.ratio >= LOW_CONTRAST) { s.el.hidden = true; s.el.replaceChildren(); return; }
  s.el.hidden = false;
  s.el.replaceChildren(
    h('span', { class: 'contrast-warn' }, `⚠️ Baixo contraste (${formatRatio(info.ratio)})`),
    button('Corrigir', () => fixContrast(s.t, info.background), 'chip primary contrast-fix'));
}

function fixContrast(t: FabricText, background: Rgba): void {
  const brand = Object.entries(brandKit.colors).filter(([, c]) => Boolean(c)).map(([role, c]) => ({ color: c!, role }));
  const s = suggestReadableColor(background, brand);
  editor.set({ fill: s.color, brandColor: s.role });
  recentColors.add(s.color);
  renderProps(t);
  toast(`Contraste corrigido: ${formatRatio(s.ratio)}`);
}

function showAnimationSheet(o: FabricObject): void {
  const current = editor.getAnimation(o);
  const total = editor.videoSettings.duration;
  // formato antigo (só `fx`) entra no novo: entrada ou ênfase, com a duração antiga como duração da entrada
  const isNew = Boolean(current && (current.inFx !== undefined || current.emphasisFx !== undefined || current.outFx !== undefined));
  const legacy = current?.fx ?? 'none';
  let inFx: EntranceFx = isNew ? current!.inFx ?? 'none' : (ENTRANCE_OPTIONS.some(([v]) => v === legacy) ? legacy as EntranceFx : 'none');
  let emphasisFx: EmphasisFx = isNew ? current!.emphasisFx ?? 'none' : (EMPHASIS_OPTIONS.some(([v]) => v === legacy) ? legacy as EmphasisFx : 'none');
  let outFx: ExitFx = isNew ? current!.outFx ?? 'none' : current?.fxOut === 'fade' ? 'fade_out' : 'none';
  let easing: EasingCurve = current?.easing ?? 'ease_out';
  let startTime = Math.min(current?.startTime ?? 0, Math.max(0, total - 0.5));
  let inDuration = isNew ? current!.inDuration ?? 0.8 : Math.min(3, current?.duration ?? 0.8);
  let outDuration = current?.outDuration ?? 0.8;
  let onScreen = isNew ? Math.min(current!.duration, total - startTime) : total - startTime;

  const update = () => {
    if (inFx === 'none' && emphasisFx === 'none' && outFx === 'none') {
      editor.setAnimation(undefined, o);
      return;
    }
    const anim: LayerAnimation = {
      fx: legacyFx({ inFx, emphasisFx }), startTime, duration: Math.max(0.5, Math.min(onScreen, total - startTime)),
      inFx, inDuration, emphasisFx, outFx, outDuration, easing,
    };
    editor.setAnimation(anim, o);
  };
  const tag = (el: HTMLElement, name: string) => { el.dataset.anim = name; return el; };

  const close = openSheet('🎬 Animação da Camada', h('div', { class: 'anim-sheet' },
    h('p', { class: 'hint' }, 'Combine como a camada entra, o que ela faz na tela e como sai do vídeo.'),
    h('h4', {}, '1. Entrada — como a camada surge'),
    tag(select('Entrada', ENTRANCE_OPTIONS, inFx, (v) => { inFx = v as EntranceFx; update(); }), 'in'),
    tag(slider('Duração da entrada (s)', 0.2, 3, 0.1, inDuration, (v) => { inDuration = v; update(); }), 'inDuration'),
    h('h4', {}, '2. Ênfase — enquanto está na tela'),
    tag(select('Ênfase', EMPHASIS_OPTIONS, emphasisFx, (v) => { emphasisFx = v as EmphasisFx; update(); }), 'emphasis'),
    h('h4', {}, '3. Saída — como a camada sai'),
    tag(select('Saída', EXIT_OPTIONS, outFx, (v) => { outFx = v as ExitFx; update(); }), 'out'),
    tag(slider('Duração da saída (s)', 0.2, 3, 0.1, outDuration, (v) => { outDuration = v; update(); }), 'outDuration'),
    h('h4', {}, 'Tempo'),
    tag(select('Curva (easing)', EASING_OPTIONS, easing, (v) => { easing = v as EasingCurve; update(); }), 'easing'),
    tag(slider('Aparece em (s)', 0, Math.max(0, total - 0.5), 0.1, startTime, (v) => { startTime = v; update(); }), 'start'),
    tag(slider('Tempo na tela (s)', 0.5, total, 0.1, onScreen, (v) => { onScreen = v; update(); }), 'onScreen'),
    h('div', { class: 'row' },
      button('▶ Testar animação', () => {
        editor.videoPreview.stop();
        editor.videoPreview.seek(Math.max(0, startTime - 0.2));
        editor.videoPreview.play();
      }, 'primary'),
      button('Concluir', () => { editor.videoPreview.stop(); close(); }),
    ),
  ));
}

function textProps(t: FabricText): Node[] {
  const families = knownFamilies();
  const m = Math.min(editor.width, editor.height);
  const chips = brandColorChips((c, role) => {
    editor.set({ fill: c, brandColor: role });
    renderProps(t);
  });
  const bgChips = brandColorChips((c) => {
    editor.set({ textBackgroundColor: c });
    renderProps(t);
  });
  const currentWarpStyle = (t.get('warpStyle') as WarpStyle | undefined) ?? (t.get('curve') ? 'arc' : 'none');

  return [
    h('div', { class: 'row scroll' },
      button('✏️ Editar texto', () => showEditText(t, false), 'primary'),
      select('Fonte', families.map((f) => [f, f]), t.fontFamily, (v) => { editor.set({ fontFamily: v, brandFont: undefined }); }),
      colorInput('Cor', String(t.fill), (v) => editor.set({ fill: v, brandColor: undefined })),
      button('N', () => editor.set({ fontWeight: Number(t.fontWeight) >= 600 || t.fontWeight === 'bold' ? 400 : 700 }), 'icon b'),
      button('I', () => editor.set({ fontStyle: t.fontStyle === 'italic' ? 'normal' : 'italic' }), 'icon i'),
      button('S̶', () => { editor.set({ linethrough: !t.linethrough }); renderProps(t); }, t.linethrough ? 'icon b primary' : 'icon b'),
      button('S̲', () => { editor.set({ underline: !t.underline }); renderProps(t); }, t.underline ? 'icon b primary' : 'icon b'),
      button('Aa', () => { editor.cycleTextCase(t); renderProps(t); }, 'icon b'),
      button('☰ Lista', () => showListSheet(t), 'list-btn'),
      button('Alinhar', () => {
        const order = ['left', 'center', 'right', 'justify'];
        editor.set({ textAlign: order[(order.indexOf(t.textAlign) + 1) % order.length] });
      }),
      button('✨ Sombra / Brilho', () => showShadowSheet(t)),
      button('🌈 Degradê', () => showGradientSheet(t), 'gradient-btn'),
    ),
    contrastRow(t),
    ...(chips ? [chips] : []),
    h('div', { class: 'row scroll' },
      colorInput('Fundo Marca-Texto', String(t.textBackgroundColor || '#fff176'), (v) => {
        editor.set({ textBackgroundColor: v });
        renderProps(t);
      }),
      button(t.textBackgroundColor ? '✕ Sem fundo' : 'Fundo', () => {
        editor.set({ textBackgroundColor: t.textBackgroundColor ? '' : '#fff176' });
        renderProps(t);
      }),
      t instanceof Textbox ? button(`🌊 Deformar (${currentWarpStyle === 'none' ? 'Reto' : currentWarpStyle})`, () => showWarpSheet(t)) : null,
    ),
    ...(bgChips ? [h('div', { class: 'row scroll' }, h('span', { class: 'hint', style: 'font-size: 12px; margin-right: 4px;' }, 'Fundo Marca:'), bgChips)] : []),
    h('div', { class: 'row scroll' },
      slider('Tamanho', 8, Math.round(m * 0.4), 1, Math.round(t.fontSize), (v) => editor.set({ fontSize: v })),
      slider('Espaçamento', -100, 800, 10, t.charSpacing ?? 0, (v) => editor.set({ charSpacing: v })),
      slider('Entrelinha', 0.6, 3, 0.05, t.lineHeight ?? 1.16, (v) => editor.set({ lineHeight: v }))),
    h('div', { class: 'row scroll' },
      colorInput('Contorno', String(t.stroke ?? '#000000'), (v) => editor.set({ stroke: v, paintFirst: 'stroke' })),
      slider('Espessura', 0, Math.round(m * 0.02), 1, t.strokeWidth ?? 0, (v) => editor.set({ strokeWidth: v, paintFirst: 'stroke' })),
      t instanceof Textbox ? slider('Curva', -100, 100, 1, Number(t.get('warpBend') ?? t.get('curve') ?? 0), (v) => editor.setCurve(v)) : null),
    h('div', { class: 'row scroll ai' }, button('✨ Reescrever', () => showRewrite(t))),
  ];
}

function showShadowSheet(o: FabricObject): void {
  const current = o.shadow instanceof Shadow ? o.shadow : null;
  let color = current?.color ?? 'rgba(0,0,0,0.45)';
  let blur = current?.blur ?? 16;
  let offsetX = current?.offsetX ?? 0;
  let offsetY = current?.offsetY ?? 8;

  let hexColor = '#000000';
  let opacity = 45;
  if (color.startsWith('#')) {
    hexColor = color;
    opacity = 100;
  } else {
    const match = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
    if (match) {
      const r = Number(match[1]).toString(16).padStart(2, '0');
      const g = Number(match[2]).toString(16).padStart(2, '0');
      const b = Number(match[3]).toString(16).padStart(2, '0');
      hexColor = `#${r}${g}${b}`;
      opacity = match[4] !== undefined ? Math.round(Number(match[4]) * 100) : 100;
    }
  }

  const apply = () => {
    const r = parseInt(hexColor.slice(1, 3), 16) || 0;
    const g = parseInt(hexColor.slice(3, 5), 16) || 0;
    const b = parseInt(hexColor.slice(5, 7), 16) || 0;
    const rgba = `rgba(${r},${g},${b},${(opacity / 100).toFixed(2)})`;
    editor.setShadow({ color: rgba, blur, offsetX, offsetY });
  };

  const close = openSheet('Sombra e Brilho (Glow)', h('div', { class: 'list' },
    h('p', { class: 'hint' }, 'Presets rápidos de sombra e iluminação:'),
    h('div', { class: 'row scroll' },
      button('🚫 Nenhuma', () => { editor.setShadow(null); close(); renderProps(o); }),
      button('☁️ Suave (Drop)', () => {
        hexColor = '#000000'; opacity = 35; blur = 16; offsetX = 0; offsetY = 8;
        apply();
      }),
      button('⬛ Dura / Retrô', () => {
        hexColor = '#000000'; opacity = 100; blur = 0; offsetX = 6; offsetY = 6;
        apply();
      }),
      button('⚡ Neon (Glow)', () => {
        hexColor = brandKit.colors.accent ?? '#ffeb3b'; opacity = 90; blur = 25; offsetX = 0; offsetY = 0;
        apply();
      }),
      button('🪐 Flutuante', () => {
        hexColor = '#000000'; opacity = 55; blur = 32; offsetX = 0; offsetY = 18;
        apply();
      }),
    ),
    h('h4', {}, 'Ajustes Manuais:'),
    h('div', { class: 'row' },
      colorInput('Cor', hexColor, (v) => { hexColor = v; apply(); }),
      slider('Opacidade %', 0, 100, 5, opacity, (v) => { opacity = v; apply(); }),
    ),
    slider('Desfoque (Blur)', 0, 100, 1, blur, (v) => { blur = v; apply(); }),
    slider('Deslocamento X', -50, 50, 1, offsetX, (v) => { offsetX = v; apply(); }),
    slider('Deslocamento Y', -50, 50, 1, offsetY, (v) => { offsetY = v; apply(); }),
    button('Concluir', () => { close(); renderProps(o); }, 'primary'),
  ));
}

function showWarpSheet(t: Textbox): void {
  let style = (t.get('warpStyle') as WarpStyle | undefined) ?? (t.get('curve') ? 'arc' : 'none');
  let bend = Number(t.get('warpBend') ?? t.get('curve') ?? 50);
  let distortH = Number(t.get('warpDistortH') ?? 0);
  let distortV = Number(t.get('warpDistortV') ?? 0);

  const warpOptions: [WarpStyle, string][] = [
    ['none', 'Reto (Sem Deformação)'],
    ['arc', 'Arco Circular (Caminho)'],
    ['wave', 'Onda Senoidal (Caminho)'],
    ['flag', 'Bandeira Promocional (Caminho)'],
    ['rise', 'Subida Diagonal S (Caminho)'],
    ['arc-upper', 'Arco Superior (Toldo/Ponte)'],
    ['arc-lower', 'Arco Inferior'],
    ['bulge', 'Estufado / Barril (Bulge)'],
    ['squeeze', 'Espremido / Ampulheta (Squeeze)'],
    ['shell-upper', 'Concha Superior (Leque Cima)'],
    ['shell-lower', 'Concha Inferior (Leque Baixo)'],
    ['fish', 'Perfil de Peixe (Fish)'],
    ['fisheye', 'Olho de Peixe (Radial)'],
    ['inflate', 'Inflar 3D'],
    ['twist', 'Torção Angular (Twist)'],
  ];

  const update = () => {
    editor.setWarp(style, bend, distortH, distortV);
  };

  const close = openSheet('Curvar e Deformar Texto (14 Estilos)', h('div', { class: 'list' },
    h('p', { class: 'hint' }, 'Escolha o estilo de deformação para faixas promocionais e títulos de impacto:'),
    select('Estilo', warpOptions, style, (v) => {
      style = v as WarpStyle;
      update();
    }),
    h('div', { class: 'row scroll' },
      button('Reto', () => { style = 'none'; update(); }),
      button('Arco', () => { style = 'arc'; update(); }),
      button('Onda', () => { style = 'wave'; update(); }),
      button('Subida S', () => { style = 'rise'; update(); }),
      button('Estufado', () => { style = 'bulge'; update(); }),
      button('Peixe', () => { style = 'fish'; update(); }),
      button('Inflar', () => { style = 'inflate'; update(); }),
    ),
    slider('Curvatura / Intensidade', -100, 100, 1, bend, (v) => { bend = v; update(); }),
    slider('Perspectiva H', -100, 100, 5, distortH, (v) => { distortH = v; update(); }),
    slider('Perspectiva V', -100, 100, 5, distortV, (v) => { distortV = v; update(); }),
    button('Concluir', () => { close(); renderProps(t); }, 'primary'),
  ));
}

// ---------- texto com IA (§18.5) ----------

function setText(t: FabricText, text: string): void {
  t.set({ text });
  editor.refitCurve(t);
  editor.refreshGradient(t);
  t.setCoords();
  editor.canvas.requestRenderAll();
  editor.commit();
}

/**
 * Edita o texto num campo nativo, acima do teclado. Vindo do toque longo (`onRelease`), o dedo ainda está no vidro: o
 * Chrome do Android só abre o teclado com foco dado num gesto, então o foco espera o soltar.
 */
function showEditText(t: FabricText, onRelease: boolean): void {
  const field = h('textarea', { rows: 3, enterkeyhint: 'enter' });
  field.value = t.text;
  const apply = () => {
    if (!field.value.trim()) { toast('Digite um texto'); return; }
    if (field.value !== t.text) setText(t, field.value);
    close();
  };
  const close = openSheet('Editar texto', h('div', {},
    field,
    h('div', { class: 'row' }, button('Cancelar', () => close()), button('Aplicar', apply, 'primary'))));
  const focus = () => { field.focus(); field.select(); };
  if (!onRelease) { focus(); return; }
  const released = () => {
    document.removeEventListener('pointerup', released);
    document.removeEventListener('touchend', released);
    focus();
  };
  document.addEventListener('pointerup', released);
  document.addEventListener('touchend', released);
}

// ---------- listas e localizar/substituir (TASK-14) ----------

/** "☰ Lista": cada linha vira um item; o estilo ativo fica destacado e tocá-lo de novo tira os marcadores. */
function showListSheet(t: FabricText): void {
  const body = h('div', { class: 'list-sheet' });
  const render = () => {
    const current = editor.listStyleOf(t) ?? 'none';
    body.dataset.style = current;
    body.replaceChildren(
      h('p', { class: 'hint' }, 'Cada linha do texto vira um item. Toque no estilo ativo para tirar os marcadores.'),
      h('div', { class: 'chips' }, ...LIST_OPTIONS.map(([style, label]) => h('button', {
        type: 'button', class: 'list-style' + (current === style ? ' primary' : ''), 'data-style': style,
        onclick: () => { editor.applyListStyle(style, t); render(); },
      }, label))));
  };
  render();
  openSheet('☰ Lista', body);
}

function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

/** Localizar em todas as camadas de texto (inclusive em grupos) e trocar em uma ou em todas, com um só undo. */
function showFindReplace(): void {
  const findInput = h('input', { type: 'text', class: 'name find-input', placeholder: 'Ex.: R$ 199,90', enterkeyhint: 'next' });
  const replaceInput = h('input', { type: 'text', class: 'name replace-input', placeholder: 'Ex.: R$ 149,90', enterkeyhint: 'done' });
  const matchCase = h('input', { type: 'checkbox', class: 'match-case' });
  const counter = h('p', { class: 'hint find-count' });
  const results = h('div', { class: 'list find-results' });
  const replaceAll = h('button', { type: 'button', class: 'primary replace-all', onclick: () => apply() }, 'Substituir tudo');
  const refresh = () => {
    const find = findInput.value;
    const hits = find ? editor.findTextMatches(find, matchCase.checked) : [];
    const total = hits.reduce((s, m) => s + m.count, 0);
    counter.dataset.matches = String(total);
    counter.dataset.layers = String(hits.length);
    counter.textContent = !find ? 'Digite o que procurar no anúncio'
      : total ? `${plural(total, 'ocorrência', 'ocorrências')} em ${plural(hits.length, 'camada', 'camadas')}` : 'Nada encontrado';
    replaceAll.disabled = total === 0;
    results.replaceChildren(...hits.map(({ layer, count }) => h('div', { class: 'layer find-hit' },
      h('span', { class: 'grow' }, `${matchSnippet(layer.text, find, matchCase.checked)} ×${count}`),
      button('Trocar', () => apply([layer]), 'replace-one'))));
  };
  const apply = (only?: FabricText[]) => {
    const r = editor.findAndReplaceAll(findInput.value, replaceInput.value, matchCase.checked, only);
    if (r.layers) toast(`${plural(r.matches, 'troca', 'trocas')} em ${plural(r.layers, 'camada', 'camadas')} — ↶ desfaz tudo`);
    if (r.skipped) toast(`${plural(r.skipped, 'camada ficaria vazia e não foi alterada', 'camadas ficariam vazias e não foram alteradas')}`);
    refresh();
    renderProps(editor.active);
  };
  findInput.addEventListener('input', refresh);
  matchCase.addEventListener('change', refresh);
  replaceInput.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !replaceAll.disabled) apply(); });
  const close = openSheet('🔍 Localizar e substituir', h('div', { class: 'find-replace' },
    h('label', { class: 'field' }, h('span', {}, 'Localizar'), findInput),
    h('label', { class: 'field' }, h('span', {}, 'Substituir por'), replaceInput),
    h('label', { class: 'check' }, matchCase, h('span', {}, 'Diferenciar maiúsculas e minúsculas')),
    counter,
    results,
    h('div', { class: 'row' }, button('Fechar', () => close()), replaceAll)), { tall: true });
  refresh();
  findInput.focus();
}

// ---------- desenho à mão livre (TASK-14) ----------

/** Caneta atual (lembrada entre sessões de desenho): preset de origem, cor (pode ter alfa) e espessura relativa. */
let pen: { id: PenId; color: string; size: number } = { id: PEN_PRESETS[0].id, color: PEN_PRESETS[0].color, size: PEN_PRESETS[0].size };
let undoStrokeBtn: HTMLButtonElement | null = null;

const pageMin = (): number => Math.min(editor.width, editor.height);

function startFreehand(): void {
  if (maskImage) { toast('Conclua o pincel do "Remover objeto" antes'); return; }
  editor.startFreehandDraw(pen.color, penWidth(pen.size, pageMin()));
  renderFreehandProps();
  toast('Desenhe com o dedo · Concluir para mover os traços');
}

function renderFreehandProps(): void {
  const m = pageMin();
  const choose = (id: PenId) => {
    const p = PEN_PRESETS.find((x) => x.id === id)!;
    pen = { id: p.id, color: p.color, size: p.size };
    editor.updateFreehandBrush({ color: p.color, width: penWidth(p.size, m) });
    renderFreehandProps();
  };
  undoStrokeBtn = button('↶ Desfazer traço', () => { if (editor.undoFreehandStroke()) refreshFreehandBar(); }, 'undo-stroke');
  props.replaceChildren(
    h('div', { class: 'row scroll pens' }, ...PEN_PRESETS.map((p) => h('button', {
      type: 'button', class: 'pen' + (pen.id === p.id ? ' primary' : ''), 'data-pen': p.id, onclick: () => choose(p.id),
    }, p.label))),
    h('div', { class: 'row scroll' },
      // o <input type=color> só entende #rrggbb (rgba viraria preto): mostra a cor opaca, o alfa volta no keepAlpha
      colorInput('Cor', withAlpha(pen.color, 1), (v) => { pen.color = keepAlpha(pen.color, v); editor.updateFreehandBrush({ color: pen.color }); }),
      slider('Espessura', penWidth(PEN_MIN, m), penWidth(PEN_MAX, m), 1, penWidth(pen.size, m), (v) => {
        pen.size = v / m;
        editor.updateFreehandBrush({ width: v });
      })),
    h('div', { class: 'row' }, undoStrokeBtn, button('Concluir', () => finishFreehand(), 'primary finish-draw')));
  props.classList.add('show');
  refreshFreehandBar();
}

/** Contador do "Desfazer traço" (cada traço novo, desfeito ou um ↶ da barra muda a conta). */
function refreshFreehandBar(): void {
  if (!undoStrokeBtn || !editor.isFreehandDrawing) return;
  const n = editor.freehandStrokes().length;
  undoStrokeBtn.textContent = n ? `↶ Desfazer traço (${n})` : '↶ Desfazer traço';
  undoStrokeBtn.disabled = n === 0;
  undoStrokeBtn.dataset.count = String(n);
}
editor.canvas.on('path:created', () => refreshFreehandBar());

function finishFreehand(): void {
  const strokes = editor.endFreehandDraw(true); // seleciona os traços → onSelection → renderProps
  undoStrokeBtn = null;
  if (!strokes.length) { renderProps(editor.active); return; }
  toast(strokes.length > 1 ? `${strokes.length} traços selecionados — 🔗 Agrupar junta tudo` : 'Traço pronto: mova ou redimensione');
}

/** Traço selecionado: cor (o alfa do marca-texto é mantido) e espessura. */
function freehandProps(o: FabricObject): Node[] {
  const m = pageMin();
  return [h('div', { class: 'row scroll freehand-props' },
    colorInput('Cor do traço', withAlpha(String(o.stroke ?? '#000000'), 1), (v) => editor.set({ stroke: keepAlpha(o.stroke, v) })),
    slider('Espessura', 1, penWidth(PEN_MAX, m), 1, Math.round(o.strokeWidth ?? 1), (v) => editor.set({ strokeWidth: v })),
    button('✍️ Desenhar mais', () => startFreehand(), 'draw-more'))];
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

function showSwapImage(img: FabricImage): void {
  let mode: FitMode = 'contain';
  const close = openSheet('Substituir foto', h('div', { class: 'list' },
    h('p', { class: 'hint' }, 'A nova foto ocupa o mesmo espaço, com a mesma rotação, sombra e filtros.'),
    select('Encaixe', [['contain', 'Inteira no espaço (produto)'], ['cover', 'Preencher o espaço (cenário)']], mode,
      (v) => { mode = v as FitMode; }),
    button('Escolher da galeria…', () => void (async () => {
      close();
      const r = await run('Abrindo imagem', () => bridge.request<BlobResult>('pickImage'));
      if (r) await run('Substituindo', () => editor.swapImage(img, r.url, mode));
    })(), 'primary swap-gallery'),
    brandKit.logoUrl ? button('Logo do brand kit', () => {
      close();
      void run('Substituindo', () => editor.swapImage(img, brandKit.logoUrl!, 'contain', { brandLogo: true }));
    }, 'swap-logo') : null));
}

function imageProps(img: FabricImage): Node[] {
  return [
    h('div', { class: 'row scroll' },
      button('🔄 Substituir', () => showSwapImage(img), 'primary swap-btn'),
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

// ---------- páginas: carrossel / catálogo (TASK-09) ----------

const pageBar = document.getElementById('pages')!;

/** Toda ação de página conclui o desenho à mão; com a máscara aberta, recusa (a máscara é da página atual). */
function pageOp(fn: () => Promise<unknown>): void {
  if (editor.isFreehandDrawing) finishFreehand();
  if (maskImage) { toast('Conclua ou cancele a máscara antes'); return; }
  void fn().catch((e: unknown) => toast(describe(e)));
}

function addPageOp(duplicateCurrent: boolean): void {
  pageOp(async () => {
    if (!(await editor.addPage({ duplicateCurrent }))) toast(`Limite de ${MAX_PAGES} páginas`);
  });
}

function deletePageOp(index: number): void {
  pageOp(async () => {
    if (!(await confirmSheet('Excluir página', `Excluir a página ${index + 1}? O ↶ desfaz.`, 'Excluir'))) return;
    await editor.deletePage(index);
  });
}

function renderPageBar(): void {
  const n = editor.getPageCount();
  const i = editor.getActivePageIndex();
  pageBar.replaceChildren(
    h('button', { type: 'button', class: 'icon pg-prev', title: 'Página anterior', 'aria-label': 'Página anterior', disabled: i <= 0,
      onclick: () => pageOp(() => editor.switchToPage(i - 1)) }, '◀'),
    h('button', { type: 'button', class: 'pg-label', title: 'Ver todas as páginas', onclick: showPages }, `📄 Página ${i + 1}/${n}`),
    h('button', { type: 'button', class: 'icon pg-next', title: 'Próxima página', 'aria-label': 'Próxima página', disabled: i >= n - 1,
      onclick: () => pageOp(() => editor.switchToPage(i + 1)) }, '▶'),
    button('＋ Nova', () => addPageOp(false), 'pg-add'),
    button('⧉ Duplicar', () => addPageOp(true), 'pg-dup'),
    h('button', { type: 'button', class: 'icon pg-del', title: 'Excluir página', 'aria-label': 'Excluir página', disabled: n <= 1,
      onclick: () => deletePageOp(editor.getActivePageIndex()) }, '🗑️'),
  );
}
editor.onPages = renderPageBar;
renderPageBar();

/** Folha com as miniaturas: tocar abre a página; ◀/▶ de cada uma muda a ordem. */
function showPages(): void {
  const active = editor.getActivePageIndex();
  const list = editor.pageList();
  const move = (from: number, to: number) => {
    if (editor.movePage(from, to)) showPages();
  };
  const tiles = list.map((p, idx) => {
    const im = h('img', { alt: `Página ${idx + 1}` });
    void editor.pageThumbnail(idx, 200).then((u) => { im.src = u; }).catch((e: unknown) => console.warn('miniatura da página', idx, e));
    return h('div', { class: 'pg-tile' + (idx === active ? ' active' : ''), 'data-index': idx, 'data-id': p.id },
      h('button', { class: 'tile pg-go', type: 'button', onclick: () => { close(); pageOp(() => editor.switchToPage(idx)); } },
        im, h('span', {}, `${idx + 1}${p.name ? ` · ${p.name}` : ''}`), h('small', {}, `${p.width}×${p.height}`)),
      h('div', { class: 'row pg-move' },
        h('button', { type: 'button', class: 'icon pg-move-left', title: 'Mover para a esquerda', disabled: idx === 0, onclick: () => move(idx, idx - 1) }, '◀'),
        h('button', { type: 'button', class: 'icon pg-move-first', title: 'Mover para o início', disabled: idx === 0, onclick: () => move(idx, 0) }, '⇤'),
        h('button', { type: 'button', class: 'icon pg-move-right', title: 'Mover para a direita', disabled: idx === list.length - 1,
          onclick: () => move(idx, idx + 1) }, '▶')));
  });
  const close = openSheet(`📄 Páginas (${list.length})`, h('div', {},
    h('div', { class: 'row' }, button('＋ Nova página', () => { close(); addPageOp(false); }, 'pg-add'),
      button('⧉ Duplicar página', () => { close(); addPageOp(true); }, 'pg-dup'),
      button('⚡ Gerar em lote', () => { close(); showMergeSheet(); }, 'merge-open')),
    h('div', { class: 'grid pages-grid' }, ...tiles)), { tall: true });
}

// ---------- ⚡ gerar em lote (TASK-10) ----------

const MERGE_SHORT: Record<TextMergeField, string> = {
  produto: 'Produto', preco_de: 'De', preco_por: 'Por', desconto: 'Desc.', parcelas: 'Parcelas', codigo: 'Código',
};

/**
 * ⚡ Gerar em lote: os campos do modelo (página ativa), a lista colada (WhatsApp/Excel/CSV), a tabela editável (📷 foto
 * por linha quando o modelo tem a camada `foto`) e "Gerar N anúncios" → uma página por produto depois do modelo.
 */
function showMergeSheet(): void {
  if (editor.isFreehandDrawing) finishFreehand();
  if (maskImage) { toast('Conclua ou cancele a máscara antes'); return; }
  editor.flushPending();
  const fields = detectTemplateFields(editor.toDocument().fabric);
  if (fields.length === 0) {
    openSheet('⚡ Gerar em lote', h('div', { class: 'merge-empty' },
      h('p', {}, 'Este modelo ainda não tem variáveis do lote.'),
      h('p', { class: 'hint' }, 'Selecione um texto (ou a foto do produto) e escolha "⚡ Variável do lote" no painel: Nome do produto, '
        + 'Preço antigo (De), Preço oferta (Por)… Ou digite no texto {{produto}}, {{preco_de}}, {{preco_por}}, {{desconto}}, '
        + '{{parcelas}} ou {{codigo}}.')));
    return;
  }
  const textFields = fields.filter(isTextMergeField);
  // o desconto sai de De e Por: com {{desconto}} no modelo, as duas colunas aparecem mesmo sem camada própria
  const cols = TEXT_MERGE_FIELDS.filter((f) => textFields.includes(f)
    || ((f === 'preco_de' || f === 'preco_por') && textFields.includes('desconto')));
  const hasPhoto = fields.includes('foto');
  // a colagem é a fonte das linhas lidas (colar de novo as refaz); as do "＋ Linha" ficam
  let pasted: CatalogRow[] = [];
  const typed: CatalogRow[] = [];
  const all = () => [...pasted, ...typed];
  const area = h('textarea', {
    rows: 4, class: 'merge-input', enterkeyhint: 'enter',
    placeholder: 'Um produto por linha: nome; preço De; preço Por\nTênis Corrida Pro; R$ 299,90; R$ 189,90\nCamiseta Dry Fit; R$ 89,90; R$ 49,90',
  });
  const status = h('p', { class: 'hint merge-status' });
  const table = h('div', { class: 'merge-table-wrap' });
  const go = button('', () => void generate(), 'primary merge-go');
  const isFilled = (r: CatalogRow) => cols.some((f) => r[f]?.trim()) || Boolean(r.photo);
  const refresh = () => {
    const n = all().filter(isFilled).length;
    go.textContent = `Gerar ${plural(n, 'anúncio', 'anúncios')}`;
    go.disabled = n === 0;
    go.dataset.count = String(n);
  };
  const renderTable = () => {
    const rows = all();
    const head = h('tr', {}, h('th', {}, '#'), ...cols.map((f) => h('th', {}, MERGE_SHORT[f])), hasPhoto ? h('th', {}, 'Foto') : null,
      h('th', {}, ''));
    const body = rows.map((r, i) => {
      const cells = cols.map((f) => {
        const input = h('input', { type: 'text', class: 'merge-cell', 'data-row': i, 'data-field': f, value: r[f] ?? '', enterkeyhint: 'next' });
        input.addEventListener('input', () => {
          r[f] = input.value;
          if (f === 'preco_de' || f === 'preco_por') {
            r.desconto = discountLabel(r.preco_de, r.preco_por) ?? '';
            const d = table.querySelector<HTMLInputElement>(`input[data-row="${i}"][data-field="desconto"]`);
            if (d) d.value = r.desconto;
          }
          refresh();
        });
        return h('td', {}, input);
      });
      const photo = hasPhoto ? h('td', {}, button(r.photo ? '✓📷' : '📷', () => void (async () => {
        const b = await run('Abrindo imagem', () => bridge.request<BlobResult>('pickImage'));
        if (b) { r.photo = { url: b.url, width: b.width, height: b.height }; renderTable(); refresh(); }
      })(), r.photo ? 'icon merge-photo has-photo' : 'icon merge-photo')) : null;
      const del = h('td', {}, button('✕', () => {
        const k = pasted.indexOf(r);
        if (k >= 0) pasted.splice(k, 1); else typed.splice(typed.indexOf(r), 1);
        renderTable();
        refresh();
      }, 'icon merge-del'));
      return h('tr', { class: 'merge-line', 'data-row': i }, h('td', { class: 'num' }, String(i + 1)), ...cells, photo, del);
    });
    table.replaceChildren(h('table', { class: 'merge-table' }, h('thead', {}, head), h('tbody', {}, ...body)));
  };
  area.addEventListener('input', () => {
    const r = parseCatalogText(area.value);
    pasted = r.rows;
    status.textContent = area.value.trim()
      ? `${plural(r.rows.length, 'produto lido', 'produtos lidos')}${r.dropped ? ` — ${r.dropped} além de ${MAX_CATALOG_ROWS} ficaram de fora` : ''}`
      : '';
    renderTable();
    refresh();
  });
  const addRow = button('＋ Linha', () => {
    typed.push({});
    renderTable();
    refresh();
    table.querySelector<HTMLInputElement>(`input[data-row="${all().length - 1}"]`)?.focus();
  }, 'merge-add');
  const generate = async () => {
    const list = all().filter(isFilled);
    if (!list.length) return;
    close();
    const res = await run(`Gerando ${plural(list.length, 'anúncio', 'anúncios')}`, () => editor.insertMergedPages(list));
    if (!res) return;
    if (res.created === 0) toast(editor.getPageCount() >= MAX_PAGES ? `Limite de ${MAX_PAGES} páginas` : 'Conclua ou cancele a máscara antes');
    else toast(`${plural(res.created, 'anúncio gerado', 'anúncios gerados')}${res.skipped ? ` — ${res.skipped} fora (limite de ${MAX_PAGES} páginas)` : ''}`);
  };
  renderTable();
  refresh();
  const close = openSheet('⚡ Gerar em lote', h('div', { class: 'merge-sheet' },
    h('p', { class: 'hint' }, 'Variáveis deste modelo:'),
    h('div', { class: 'row merge-fields' }, ...fields.map((f) => h('span', { class: 'chip', 'data-field': f }, MERGE_FIELD_LABELS[f]))),
    area,
    status,
    table,
    h('div', { class: 'row' }, addRow, go),
    h('p', { class: 'hint' }, 'Cada produto vira uma página logo depois desta (o modelo fica como está). Nomes longos diminuem a fonte '
      + 'até caber, no mínimo 65% do tamanho do modelo. O desconto sai de De e Por.')), { tall: true });
}

// ---------- abas ----------

const tabs: [string, () => void][] = [
  ['Templates', showTemplates],
  ['Texto', showText],
  ['Imagem', showImage],
  ['Formas', showShapes],
  ['🏷️ Selos', showBadges],
  ['📱 QR Code', () => showQrSheet()],
  ['📊 Tabela', showTableSheet],
  ['Adesivos', showStickers],
  ['Fundo', showBackgrounds],
  ['Tamanho', showSize],
  ['Marca', showBrand],
  ['🎬 Vídeo', showVideo],
];
// trocar de aba conclui o desenho à mão (senão o objeto inserido ficaria sob o pincel, sem como tocar nele)
document.getElementById('tabs')!.replaceChildren(...tabs.map(([label, fn]) => button(label, () => {
  if (editor.isFreehandDrawing) finishFreehand();
  fn();
})));

function showTemplates(): void {
  const tile = (t: TemplateEntry) => {
    const im = h('img', { alt: t.name });
    if (t.thumbnail) {
      im.src = t.thumbnail;
    } else {
      void loadTemplate(t).then((d) => renderThumbnail(applyBrandKit(parseDocument(d), brandKit), 240)).then((u) => { im.src = u; })
        .catch((e: unknown) => console.warn('thumb', t.id, e));
    }
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
  const add = (kind: 'title' | 'subtitle' | 'body', font: string) => {
    editor.addText(kind, font);
    close();
    toast('Toque e segure o texto para editar');
  };
  const close = openSheet('Texto', h('div', { class: 'list' },
    h('button', { class: 'big title', type: 'button', style: `font-family:'${heading}'`, onclick: () => add('title', heading) }, 'Adicionar título'),
    h('button', { class: 'big subtitle', type: 'button', style: `font-family:'${heading}'`, onclick: () => add('subtitle', heading) }, 'Adicionar subtítulo'),
    h('button', { class: 'big', type: 'button', style: `font-family:'${bodyFont}'`, onclick: () => add('body', bodyFont) }, 'Adicionar texto'),
    button('✨ Gerar textos com IA', () => { close(); showGenerateCopy(); }),
    button('🔍 Localizar e substituir…', () => { close(); showFindReplace(); }, 'find-replace-btn'),
    button('⚡ Gerar em lote (catálogo)', () => { close(); showMergeSheet(); }, 'merge-open'),
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
  const font = brandKit.fonts.heading ?? DEFAULT_FONT;
  const m = Math.min(editor.width, editor.height);
  const w = Math.max(3, Math.round(m * 0.005));
  const shapes: [ShapeKind, string][] = [['rect', '▬ Retângulo'], ['rounded', '▢ Arredondado'], ['pill', '💊 Pílula'], ['circle', '● Círculo'],
    ['triangle', '▲ Triângulo'], ['star', '★ Estrela'], ['badge-hex', '⬢ Hexágono'], ['arrow', '➜ Seta'], ['line', '─ Linha']];
  const line = (shape: ConnectorShape, x2: number, y2: number, startCap: CapStyle, endCap: CapStyle): ConnectorSpec =>
    ({ x1: 0, y1: 0, x2, y2, shape, startCap, endCap, color, width: w, dash: 'solid' });
  const callout = (k: CalloutKind) => () => { editor.addCallout(k, color, font); close(); };
  const close = openSheet('Formas', h('div', {},
    h('div', { class: 'chips' }, ...shapes.map(([k, label]) => button(label, () => { editor.addShape(k, color); close(); }))),
    h('h4', {}, '📌 Infográfico / Raio-X'),
    h('div', { class: 'chips infographic' },
      button('➝ Seta fina', () => { editor.addConnector(line('straight', m * 0.45, 0, 'none', 'arrow'), undefined, 'Seta'); close(); }, 'add-arrow'),
      button('↪ Seta curva', callout('curved-arrow'), 'add-curved'),
      button('⌐ Linha cotovelo', () => { editor.addConnector(line('elbow', m * 0.35, m * 0.25, 'dot', 'arrow'), undefined, 'Linha cotovelo'); close(); }, 'add-elbow'),
      button('|↔| Cota de medida', callout('dimension'), 'add-dimension'),
      button('📍 Pino característica', callout('pin'), 'add-pin'),
      button('🔍 Lupa de detalhe', callout('zoom'), 'add-zoom')),
    h('h4', {}, '✍️ Desenho à mão'),
    h('div', { class: 'chips' },
      button('✍️ Desenhar à mão', () => { close(); startFreehand(); }, 'draw-btn'))));
}

// ---------- QR Code e tabelas (TASK-05) ----------

const QR_LABELS = ['ESCANEIE PARA COMPRAR', 'CHAME NO WHATSAPP', 'PAGUE COM PIX'];

function defaultQrFields(): Record<string, string> {
  return {
    url: brandKit.profile.website ?? '', phone: brandKit.profile.phone ?? '', message: '', pixMode: 'key', key: '',
    name: brandKit.profile.company ?? '', city: '', amount: '', pasted: '', ssid: '', password: '', auth: 'WPA',
  };
}

/** Criar (sem `existing`) ou reeditar o QR Code: modo, campos, estilo, cores, logo, legenda e prévia ao vivo. */
function showQrSheet(existing?: FabricObject): void {
  const current = existing ? editor.qrConfigOf(existing) : undefined;
  const cfg: QrConfig = current ? structuredClone(current) : {
    kind: 'link', fields: {}, payload: '', ecc: 'M', dotStyle: 'square', eyeStyle: 'square',
    fgColor: brandKit.colors.primary ?? '#111111', bgColor: '#ffffff', label: '', withLogo: false,
  };
  cfg.fields = { ...defaultQrFields(), ...cfg.fields };
  // o logo exige a correção alta (H, 30%): o buraco central tira módulos do código
  const eccOf = (): QrEcc => (cfg.withLogo && brandKit.logoUrl ? 'H' : 'M');
  const preview = h('div', { class: 'qr-preview' });
  const status = h('p', { class: 'hint qr-status' });
  let timer: number | undefined;
  const refresh = () => {
    window.clearTimeout(timer);
    timer = window.setTimeout(() => {
      try {
        const payload = buildPayload(cfg.kind, cfg.fields);
        const m = encodeQr(payload, { ecc: eccOf() });
        preview.innerHTML = qrSvg(m, { dotStyle: cfg.dotStyle, eyeStyle: cfg.eyeStyle, fg: cfg.fgColor, bg: cfg.bgColor,
          logoHole: cfg.withLogo && Boolean(brandKit.logoUrl), label: cfg.label, labelFont: brandKit.fonts.heading ?? DEFAULT_FONT });
        preview.dataset.payload = payload;
        status.textContent = `Versão ${m.version} · ${m.size}×${m.size} módulos · correção ${m.ecc}`;
      } catch (e) {
        preview.replaceChildren();
        delete preview.dataset.payload;
        status.textContent = e instanceof Error ? e.message : String(e);
      }
    }, 120);
  };
  const field = (name: string, label: string, attrs: { type?: string; placeholder?: string; multiline?: boolean; inputmode?: string } = {}) => {
    const el = attrs.multiline
      ? h('textarea', { rows: 3, 'data-field': name, placeholder: attrs.placeholder, value: cfg.fields[name] ?? '' })
      : h('input', { type: attrs.type ?? 'text', class: 'name', 'data-field': name, placeholder: attrs.placeholder, inputmode: attrs.inputmode,
        value: cfg.fields[name] ?? '' });
    el.addEventListener('input', () => { cfg.fields[name] = el.value; refresh(); });
    return h('label', { class: 'qr-field' }, h('span', { class: 'hint' }, label), el);
  };
  const fieldsBox = h('div', { class: 'list qr-fields' });
  const kinds = h('div', { class: 'chips qr-kinds' });
  const renderFields = () => {
    kinds.replaceChildren(...QR_KINDS.map(([k, label]) => h('button', {
      type: 'button', class: 'chip qr-kind' + (k === cfg.kind ? ' primary' : ''), 'data-kind': k,
      onclick: () => { cfg.kind = k as QrKind; renderFields(); },
    }, label)));
    const f: Node[] = [];
    if (cfg.kind === 'link') {
      f.push(field('url', 'Link do site, loja ou catálogo', { type: 'url', placeholder: 'https://sualoja.com.br' }));
    } else if (cfg.kind === 'whatsapp') {
      f.push(field('phone', 'WhatsApp (DDD + número)', { type: 'tel', placeholder: '(11) 99999-9999' }),
        field('message', 'Mensagem pronta (opcional)', { multiline: true, placeholder: 'Olá! Vi o anúncio e quero pedir…' }));
    } else if (cfg.kind === 'pix') {
      f.push(h('div', { class: 'qr-pix-mode' }, select('PIX', [['key', 'Chave PIX'], ['paste', 'Colar "PIX Copia e Cola"']], cfg.fields.pixMode,
        (v) => { cfg.fields.pixMode = v; renderFields(); })));
      if (cfg.fields.pixMode === 'paste') {
        f.push(field('pasted', 'Código PIX Copia e Cola', { multiline: true, placeholder: '000201…' }));
      } else {
        f.push(field('key', 'Chave (CPF/CNPJ, e-mail, telefone +55… ou aleatória)', { placeholder: '+5511999999999' }),
          field('name', 'Nome do recebedor', { placeholder: 'Loja Exemplo' }),
          field('city', 'Cidade', { placeholder: 'São Paulo' }),
          field('amount', 'Valor (opcional)', { inputmode: 'decimal', placeholder: '19,90' }));
      }
    } else {
      f.push(field('ssid', 'Nome da rede (SSID)'),
        h('div', { class: 'qr-wifi-auth' }, select('Segurança', WIFI_AUTH, cfg.fields.auth, (v) => { cfg.fields.auth = v; renderFields(); })));
      if (cfg.fields.auth !== 'nopass') f.push(field('password', 'Senha'));
    }
    fieldsBox.replaceChildren(...f);
    refresh();
  };
  const fg = colorInput('Cor do QR', cfg.fgColor, (v) => { cfg.fgColor = v; refresh(); });
  const brandFg = brandKit.colors.primary ? button('● Cor da marca', () => {
    cfg.fgColor = brandKit.colors.primary!;
    fg.querySelector('input')!.value = toHex(cfg.fgColor);
    refresh();
  }, 'chip qr-brand-color') : null;
  const logo = h('input', { type: 'checkbox', checked: cfg.withLogo, 'data-field': 'withLogo' });
  logo.addEventListener('change', () => { cfg.withLogo = logo.checked; refresh(); });
  const labelInput = h('input', { type: 'text', class: 'name', 'data-field': 'label', maxlength: 40, value: cfg.label ?? '', placeholder: 'Legenda livre' });
  labelInput.addEventListener('input', () => { cfg.label = labelInput.value; refresh(); });
  const setLabel = (v: string) => { labelInput.value = v; cfg.label = v; refresh(); };
  const apply = async () => {
    let payload: string;
    const ecc = eccOf();
    try {
      payload = buildPayload(cfg.kind, cfg.fields);
      encodeQr(payload, { ecc });
    } catch (e) {
      toast(e instanceof Error ? e.message : String(e));
      return;
    }
    const config: QrConfig = { ...cfg, fields: { ...cfg.fields }, payload, ecc, label: cfg.label?.trim() || undefined,
      withLogo: cfg.withLogo && Boolean(brandKit.logoUrl) };
    close();
    const g = await run('Gerando QR Code', () => editor.upsertQrCode(config, existing,
      { logoUrl: brandKit.logoUrl, font: brandKit.fonts.heading ?? DEFAULT_FONT }));
    if (g) renderProps(editor.active);
  };
  const close = openSheet(existing ? 'Editar QR Code' : '📱 QR Code', h('div', { class: 'list qr-sheet' },
    kinds,
    fieldsBox,
    h('h4', {}, 'Estilo'),
    h('div', { class: 'row' },
      h('div', { class: 'qr-dot-style' }, select('Pontos', DOT_STYLES, cfg.dotStyle, (v) => { cfg.dotStyle = v as DotStyle; refresh(); })),
      h('div', { class: 'qr-eye-style' }, select('Cantos', EYE_STYLES, cfg.eyeStyle, (v) => { cfg.eyeStyle = v as EyeStyle; refresh(); }))),
    h('div', { class: 'row' }, fg, colorInput('Fundo', cfg.bgColor, (v) => { cfg.bgColor = v; refresh(); }), brandFg),
    brandKit.logoUrl
      ? h('label', { class: 'check' }, logo, h('span', {}, 'Incluir logo da marca no centro'))
      : h('p', { class: 'hint' }, 'Cadastre um logo no Brand kit para colocá-lo no centro do QR.'),
    h('h4', {}, 'Legenda'),
    h('div', { class: 'chips qr-labels' }, button('Sem legenda', () => setLabel(''), 'chip'),
      ...QR_LABELS.map((l) => h('button', { type: 'button', class: 'chip qr-label', onclick: () => setLabel(l) }, l))),
    labelInput,
    preview,
    status,
    button(existing ? 'Aplicar' : 'Inserir', () => void apply(), 'primary qr-apply')), { tall: true });
  renderFields();
}

/** Templates de tabela: um toque insere (cores e fonte da marca). */
function showTableSheet(): void {
  const kit = { primary: brandKit.colors.primary, text: brandKit.colors.text, font: brandKit.fonts.body ?? DEFAULT_FONT };
  const close = openSheet('📊 Tabela', h('div', { class: 'list table-sheet' },
    h('p', { class: 'hint' }, 'Toque para inserir. Depois, "✏️ Editar Tabela" muda as células, linhas, colunas e o estilo.'),
    ...TABLE_TEMPLATES.map(([id, label]) => h('button', { type: 'button', class: 'big table-template', 'data-template': id,
      onclick: () => void (async () => {
        close();
        const g = await run('Inserindo tabela', () => editor.upsertTable(tableTemplate(id, kit)));
        if (g) renderProps(editor.active);
      })() }, label))));
}

/** Grade de campos, ± linha/coluna, estilo e cores; "Aplicar" refaz a tabela no mesmo canto e escala. */
function showTableEditor(existing: FabricObject): void {
  const cur = editor.tableDataOf(existing);
  if (!cur) return;
  let data: TableData = normalizeTable(structuredClone(cur));
  const body = h('div', { class: 'list table-sheet' });
  const op = (fn: (d: TableData) => TableData | null, refuse: string) => () => {
    const n = fn(data);
    if (!n) { toast(refuse); return; }
    data = n;
    render();
  };
  const render = (): void => {
    const grid = h('div', { class: 'table-grid', style: `grid-template-columns: repeat(${columnCount(data)}, minmax(84px, 1fr))` },
      ...data.rows.flatMap((row, r) => row.map((v, c) => {
        const input = h('input', { type: 'text', class: 'table-cell' + (r === 0 ? ' head' : ''), value: v, 'data-r': r, 'data-c': c });
        input.addEventListener('input', () => { data = setCell(data, r, c, input.value); });
        return input;
      })));
    const brand = brandKit.colors.primary ? button('🎨 Cores da marca', () => {
      data = { ...data, headerBg: brandKit.colors.primary!, textColor: brandKit.colors.text ?? data.textColor };
      render();
    }, 'chip table-brand') : null;
    body.replaceChildren(
      h('div', { class: 'table-scroll' }, grid),
      h('div', { class: 'row' },
        button('+ Linha', op((d) => addRow(d), ''), 'table-add-row'),
        button('− Linha', op((d) => removeRow(d), 'A tabela precisa de pelo menos 1 linha'), 'table-remove-row'),
        button('+ Coluna', op((d) => addColumn(d), ''), 'table-add-col'),
        button('− Coluna', op((d) => removeColumn(d), 'A tabela precisa de pelo menos 1 coluna'), 'table-remove-col')),
      h('div', { class: 'table-style' }, select('Estilo', TABLE_STYLES, data.style, (v) => { data = { ...data, style: v as TableStyle }; })),
      h('div', { class: 'row' },
        colorInput('Cabeçalho', data.headerBg, (v) => { data = { ...data, headerBg: v }; }),
        colorInput('Texto', data.textColor, (v) => { data = { ...data, textColor: v }; }),
        colorInput('Linhas', data.borderColor, (v) => { data = { ...data, borderColor: v }; }),
        brand),
      button('Aplicar', () => void (async () => {
        close();
        const g = await run('Aplicando', () => editor.upsertTable(data, existing));
        if (g) renderProps(editor.active);
      })(), 'primary table-apply'));
  };
  const close = openSheet('✏️ Editar Tabela', body, { tall: true });
  render();
}

const SHAPE_LABELS: Record<string, string> = { rect: '▬ Retângulo', rounded: '▢ Arredondado', pill: '💊 Pílula', circle: '● Círculo',
  triangle: '▲ Triângulo', star: '★ Estrela', 'badge-hex': '⬢ Hexágono' };

/** Degradê, borda (sólida/tracejada/pontilhada), cantos do retângulo e troca de forma (TASK-12). */
function shapeStyleRow(o: FabricObject): HTMLElement {
  const kind = editor.shapeKindOf(o);
  return h('div', { class: 'row scroll shape-style' },
    o.type !== 'line' ? button('🌈 Degradê', () => showGradientSheet(o), 'gradient-btn') : null,
    select('Borda', DASH_OPTIONS, editor.dashStyleOf(o), (v) => { editor.setStrokeDash(v as DashStyle); renderProps(editor.active); }),
    o.type === 'rect' ? slider('Cantos', 0, Math.round(editor.maxCornerRadius(o)), 1, Math.round((o as unknown as { rx: number }).rx ?? 0),
      (v) => editor.setCornerRadius(v)) : null,
    kind ? button('🔄 Trocar forma', () => showSwapShape(o), 'swap-shape-btn') : null);
}

function showSwapShape(o: FabricObject): void {
  const current = editor.shapeKindOf(o);
  const close = openSheet('🔄 Trocar forma', h('div', { class: 'chips swap-shapes' },
    ...SWAP_KINDS.map((k) => button(SHAPE_LABELS[k], () => {
      close();
      editor.swapShape(k, o);
      renderProps(editor.active);
    }, k === current ? 'primary' : ''))));
}

/** Pontas, formato, cor, espessura e traço da linha/seta selecionada; cada mudança refaz o Group no mesmo lugar. */
function connectorProps(): Node[] {
  const c = editor.connectorOf()!;
  const m = Math.min(editor.width, editor.height);
  let timer: number | undefined;
  // os botões do topo do painel guardam o objeto antigo: redesenha o painel depois da mudança
  const later = () => { window.clearTimeout(timer); timer = window.setTimeout(() => renderProps(editor.active), 600); };
  const now = (p: Partial<ConnectorSpec>) => { editor.setConnector(p); renderProps(editor.active); };
  return [
    h('div', { class: 'row scroll connector-props' },
      select('Início', CAP_OPTIONS, c.startCap, (v) => now({ startCap: v as CapStyle })),
      select('Fim', CAP_OPTIONS, c.endCap, (v) => now({ endCap: v as CapStyle })),
      select('Linha', SHAPE_OPTIONS, c.shape, (v) => now({ shape: v as ConnectorShape })),
      button('⇄ Inverter pontas', () => { const cur = editor.connectorOf(); if (cur) now(swapEnds(cur)); }, 'swap-ends')),
    h('div', { class: 'row scroll' },
      colorInput('Cor', c.color, (v) => { editor.setConnector({ color: v }); later(); }),
      slider('Espessura', 1, Math.max(12, Math.round(m * 0.03)), 1, c.width, (v) => editor.setConnector({ width: v }),
        () => renderProps(editor.active)),
      select('Traço', DASH_OPTIONS, c.dash, (v) => now({ dash: v as DashStyle }))),
  ];
}

/** Editor de degradê: linear/radial, ângulo, 2 a 5 paradas, presets (Ouro, Oferta, Neon, Preto, Marca). */
function showGradientSheet(target: FabricObject | 'background'): void {
  const isBg = target === 'background';
  const current = isBg ? editor.backgroundGradient() : editor.gradientOf(target);
  const base = toHex(isBg ? editor.canvas.backgroundColor : target.fill);
  let spec: GradientSpec = current ? structuredClone(current)
    : { kind: 'linear', angle: 90, stops: evenStops([base, base === '#ffffff' ? (brandKit.colors.primary ?? '#3b6fd8') : '#ffffff']) };
  const apply = () => { if (isBg) editor.setBackgroundGradientSpec(spec); else editor.setObjectGradient(spec, target); };
  const presets = [...GRADIENT_PRESETS];
  const brand = brandGradient(brandKit.colors);
  if (brand) presets.push(brand);
  const body = h('div', { class: 'gradient-sheet' });
  const preview = h('div', { class: 'gradient-preview', style: 'height:36px;border-radius:8px;margin-bottom:8px' });
  const paint = () => { preview.style.background = gradientCss(spec); };
  const change = (next: GradientSpec, rerender = true) => { spec = next; apply(); paint(); if (rerender) render(); };
  const render = () => {
    paint();
    body.replaceChildren(
      preview,
      h('div', { class: 'row scroll' },
        button('Linear', () => change({ ...spec, kind: 'linear' }), spec.kind === 'linear' ? 'primary type-linear' : 'type-linear'),
        button('Radial', () => change({ ...spec, kind: 'radial' }), spec.kind === 'radial' ? 'primary type-radial' : 'type-radial'),
        button('⇄ Inverter cores', () => change(reverseStops(spec)), 'reverse-btn')),
      spec.kind === 'linear' ? h('div', { class: 'row scroll' },
        slider('Ângulo', 0, 360, 1, spec.angle, (v) => change({ ...spec, angle: v }, false)),
        ...([['↓ 90°', 90], ['→ 0°', 0], ['↘ 45°', 45], ['↗ 315°', 315]] as const).map(([l, a]) =>
          button(l, () => change({ ...spec, angle: a }), spec.angle === a ? 'primary angle-chip' : 'angle-chip'))) : '',
      h('h4', {}, 'Cores'),
      ...spec.stops.map((st, i) => h('div', { class: 'row scroll stop', 'data-stop': i },
        colorInput(`Cor ${i + 1}`, st.color, (v) => change({ ...spec, stops: spec.stops.map((x, j) => (j === i ? { ...x, color: v } : x)) }, false)),
        slider('Posição %', 0, 100, 1, Math.round(st.offset * 100),
          (v) => change({ ...spec, stops: spec.stops.map((x, j) => (j === i ? { ...x, offset: v / 100 } : x)) }, false)),
        spec.stops.length > 2 ? button('✕', () => change(removeStop(spec, i)), 'icon remove-stop') : null)),
      spec.stops.length < MAX_STOPS ? button('+ Cor', () => change(addStop(spec)), 'add-stop') : '',
      h('h4', {}, 'Prontos'),
      h('div', { class: 'grid small' }, ...presets.map((p) => h('button', {
        class: 'tile swatch preset', type: 'button', title: p.name, 'data-preset': p.name, style: `background:${gradientCss(p.spec)}`,
        onclick: () => change(structuredClone(p.spec)),
      }))),
      isBg ? '' : button('✕ Remover degradê', () => { close(); editor.setObjectGradient(null, target); renderProps(editor.active); }, 'danger remove-gradient'),
    );
  };
  render();
  const close = openSheet('🌈 Degradê', body, { tall: true });
  if (!current) apply();
}

const BADGE_CATEGORIES = [
  'Garantia & Confiança',
  'Frete & Entrega',
  'Avaliação Social',
  'Promoção & Urgência',
] as const;

function showBadges(): void {
  let selectedCategory: string = 'Todas';
  const categories = ['Todas', ...BADGE_CATEGORIES];

  const gridContainer = h('div', {});

  const renderGrid = () => {
    const list = selectedCategory === 'Todas'
      ? content.stickers.filter((s) => (BADGE_CATEGORIES as readonly string[]).includes(s.category))
      : content.stickers.filter((s) => s.category === selectedCategory);

    gridContainer.replaceChildren(
      h('div', { class: 'grid small' },
        ...list.map((s) => h('button', {
          class: 'tile',
          type: 'button',
          style: 'padding: 8px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px;',
          onclick: () => {
            close();
            void run('Inserindo selo', async () => {
              const obj = await editor.addSvgFromUrl(contentUrl(s.file), s.name);
              toast(`Selo "${s.name}" adicionado`);
              return obj;
            });
          },
        },
        h('img', { src: contentUrl(s.file), alt: s.name, style: 'max-height: 52px; max-width: 100%; object-fit: contain;' }),
        h('span', { style: 'font-size: 11px; text-align: center; color: var(--text); line-height: 1.2;' }, s.name)
      ))
    ));
  };

  const chips = h('div', { class: 'chips', style: 'margin-bottom: 12px;' },
    ...categories.map((cat) => {
      const btn = button(cat, () => {
        selectedCategory = cat;
        for (const child of chips.children) {
          (child as HTMLElement).classList.remove('primary');
        }
        btn.classList.add('primary');
        renderGrid();
      });
      if (cat === 'Todas') btn.classList.add('primary');
      return btn;
    })
  );

  renderGrid();

  const close = openSheet('Selos & Badges de Conversão', h('div', {},
    h('p', { class: 'hint' }, 'Gatilhos visuais de alta conversão para seus anúncios. Toque para inserir e personalize cores com o Brand Kit.'),
    chips,
    gridContainer,
  ), { tall: true });
}

function showStickers(): void {
  const cats = [...new Set(content.stickers.map((s) => s.category))];
  const close = openSheet('Adesivos', h('div', {}, ...cats.flatMap((c) => [h('h4', {}, c), h('div', { class: 'grid small' },
    ...content.stickers.filter((s) => s.category === c).map((s) => h('button', { class: 'tile', type: 'button',
      onclick: () => { close(); void run('Inserindo', () => editor.addSvgFromUrl(contentUrl(s.file), s.name)); } },
    h('img', { src: contentUrl(s.file), alt: s.name }))))])), { tall: true });
}

/**
 * ✨ Degradê a partir das cores dominantes da foto do produto (TASK-09) e recolore os textos que ficaram com contraste
 * abaixo de 3:1 sobre o fundo novo. Um passo do undo (os dois `commit` caem no mesmo debounce do histórico).
 */
function extractBackgroundFromPhoto(): void {
  const img = mainProductImage();
  if (!img) { toast('Adicione a foto do produto primeiro'); return; }
  const style = extractBackgroundStyle(imageColors(img));
  if (!style) { toast('Não deu para ler as cores desta foto'); return; }
  editor.setBackgroundGradientSpec(style.gradient);
  let fixed = 0;
  for (const t of editor.textLayers()) {
    const info = textContrast(t);
    if (info && info.ratio < LOW_CONTRAST) {
      // a cor do estilo, se ela se lê sobre o que está de fato atrás do texto (pode ser a própria foto); senão a melhor
      // entre branco e quase-preto para esse fundo (≥ 4,3:1 sempre)
      const color = contrastRatio(style.recommendedTextColor, info.background) >= LOW_CONTRAST
        ? style.recommendedTextColor : suggestReadableColor(info.background).color;
      t.set({ fill: color, brandColor: undefined });
      fixed++;
    }
  }
  if (fixed) editor.commit();
  toast(fixed ? `Fundo da foto aplicado; ${plural(fixed, 'texto ajustado', 'textos ajustados')} para leitura` : 'Fundo da foto aplicado');
}

function showBackgrounds(): void {
  const pages = editor.getPageCount();
  const close = openSheet('Fundo', h('div', {},
    h('div', { class: 'row' }, colorInput('Cor sólida', toHex(editor.canvas.backgroundColor), (v) => editor.setBackgroundColor(v)),
      button('🌈 Degradê personalizado', () => { close(); showGradientSheet('background'); }, 'bg-gradient-btn')),
    h('div', { class: 'row' },
      button('✨ Extrair fundo da foto do produto', () => { close(); extractBackgroundFromPhoto(); }, 'bg-extract-btn'),
      button('🎨 Aplicar estilo deste fundo em todas as páginas', () => {
        close();
        const n = editor.applyBackgroundToAllPages();
        toast(n ? `Fundo aplicado em mais ${plural(n, 'página', 'páginas')}` : 'O projeto tem uma página só');
      }, 'bg-apply-all-btn' + (pages > 1 ? '' : ' off'))),
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

/** Desenho do formato (formats.ts: markup gerado só a partir do catálogo e de números). */
function formatThumb(f: Parameters<typeof formatSvg>[0]): HTMLElement {
  const el = h('span', { class: 'format-thumb' });
  el.innerHTML = formatSvg(f);
  return el;
}

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
  // os mesmos formatos do seletor do app (core/ui MediaFormats.kt), agrupados e desenhados
  const current = findFormat(editor.width, editor.height);
  const custom = h('span', { class: 'format-thumb' });
  const preview = () => {
    const W = Number(w.value), H = Number(hh.value);
    custom.innerHTML = W > 0 && H > 0 ? formatSvg({ width: W, height: H, platform: 'generic', look: 'plain' }) : '';
  };
  w.addEventListener('input', preview);
  hh.addEventListener('input', preview);
  preview();
  const sections = GROUP_LABELS.flatMap(([g, label]) => {
    const list = DESIGN_FORMATS.filter((f) => f.group === g);
    return list.length ? [h('h4', {}, label), h('div', { class: 'grid formats' }, ...list.map((f) =>
      h('button', { class: 'tile format' + (f === current ? ' primary' : ''), type: 'button', title: f.hint, onclick: () => apply(f.width, f.height) },
        formatThumb(f), h('span', {}, f.label), h('small', {}, `${f.width}×${f.height}`))))] : [];
  });
  const snapCheck = h('input', { type: 'checkbox', checked: editor.snappingEnabled }) as HTMLInputElement;
  snapCheck.addEventListener('change', () => { editor.snappingEnabled = snapCheck.checked; });
  // guias manuais (TASK-13): estado de tela da sessão, não entram no documento
  const guideAxis = h('select', {}, h('option', { value: 'x' }, 'Vertical (x)'), h('option', { value: 'y' }, 'Horizontal (y)'));
  const guidePos = h('input', { type: 'number', min: 0, max: 8000, value: Math.round(editor.width / 2), class: 'guide-pos' });
  guideAxis.addEventListener('change', () => {
    guidePos.value = String(Math.round((guideAxis.value === 'x' ? editor.width : editor.height) / 2));
  });
  const guideList = h('span', { class: 'hint guide-list' });
  const refreshGuides = (): void => {
    guideList.textContent = editor.customGuides.length
      ? editor.customGuides.map((g) => `${g.axis === 'x' ? 'x' : 'y'} = ${Math.round(g.pos)}`).join(' · ')
      : 'Nenhuma guia manual';
  };
  refreshGuides();

  const close = openSheet('Tamanho e Guias', h('div', {},
    h('div', { class: 'row' }, button('✨ Magic Resize (vários formatos)', () => { close(); showMagicResize(); }, 'primary magic-resize-btn')),
    h('label', { class: 'check' }, sc, h('span', {}, 'Ajustar o conteúdo ao novo tamanho')),
    h('h4', {}, 'Zonas Seguras e Alinhamento'),
    h('div', { class: 'row' },
      select('Zona Segura', [
        ['none', 'Nenhuma'],
        ['social-9x16', 'Reels / Stories (9:16)'],
        ['marketplace-1x1', 'Marketplace (1:1)'],
        ['print-bleed', 'Sangria e Corte (Impressão)'],
      ], editor.guideOverlay, (val) => {
        editor.guideOverlay = val as OverlayGuideMode;
        editor.canvas.requestRenderAll();
      })
    ),
    h('div', { class: 'row' },
      select('Grade', [
        ['none', 'Nenhuma'],
        ['thirds', 'Regra dos terços (3×3)'],
        ['grid-100', 'Grade quadriculada (10%)'],
      ], editor.gridOverlay, (val) => {
        editor.gridOverlay = val as GridOverlayMode;
        editor.canvas.requestRenderAll();
      })
    ),
    h('label', { class: 'check' }, snapCheck, h('span', {}, 'Smart Guides (Alinhamento Magnético)')),
    h('h4', {}, 'Guias manuais'),
    h('div', { class: 'row guides' },
      h('label', { class: 'select' }, h('span', {}, 'Guia'), guideAxis),
      h('label', {}, 'em ', guidePos, ' px'),
      button('Adicionar', () => {
        if (!editor.addCustomGuide(guideAxis.value as 'x' | 'y', Number(guidePos.value))) toast('A guia tem de ficar dentro da página');
        refreshGuides();
      }),
      button('Limpar', () => { editor.clearCustomGuides(); refreshGuides(); })),
    h('div', { class: 'row' }, guideList),
    ...sections,
    h('h4', {}, 'Personalizado'),
    h('div', { class: 'row' }, custom, h('label', {}, 'L ', w), h('label', {}, 'A ', hh), button('Aplicar', () => apply(Number(w.value), Number(hh.value)), 'primary'))),
  { tall: true });
}

/** ✨ Magic Resize (TASK-09): formatos do catálogo com checkbox; cada um vira uma página nova com o conteúdo reposicionado. */
function showMagicResize(): void {
  const picked = new Set<MediaFormat>();
  const go = button('', () => void generate(), 'primary magic-go');
  const refresh = () => {
    go.textContent = `Gerar ${plural(picked.size, 'formato', 'formatos')} como páginas`;
    go.disabled = picked.size === 0;
  };
  const sections = GROUP_LABELS.flatMap(([g, label]) => {
    const list = DESIGN_FORMATS.filter((f) => f.group === g);
    return list.length ? [h('h4', {}, label), h('div', { class: 'grid formats' }, ...list.map((f) => {
      const cb = h('input', { type: 'checkbox', class: 'magic-check', 'data-format': f.id });
      cb.addEventListener('change', () => { if (cb.checked) picked.add(f); else picked.delete(f); refresh(); });
      return h('label', { class: 'tile format magic-format', title: f.hint, 'data-format': f.id },
        cb, formatThumb(f), h('span', {}, f.label), h('small', {}, `${f.width}×${f.height}`));
    }))] : [];
  });
  const generate = async () => {
    const list = [...picked];
    close();
    const n = await run('Gerando formatos', () => editor.magicResize(list.map((f) => ({ width: f.width, height: f.height, name: f.label }))));
    if (n) toast(`${plural(n, 'página criada', 'páginas criadas')}: confira na faixa de páginas`);
    else if (n === 0) toast(editor.getPageCount() >= MAX_PAGES ? `Limite de ${MAX_PAGES} páginas` : 'Conclua ou cancele a máscara antes');
  };
  refresh();
  const close = openSheet('✨ Magic Resize', h('div', {},
    h('p', { class: 'hint' }, 'Marque os formatos. Cada um vira uma página nova deste projeto, com o produto e os textos reposicionados para a proporção dele.'),
    h('div', { class: 'row magic-bar' }, go),
    ...sections), { tall: true });
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

function showLayers(isMulti = false, selectedIds = new Set<FabricObject>()): void {
  const objs = [...editor.canvas.getObjects()].reverse();
  const selectableObjs = objs.filter((o) => o.selectable);
  const label = (o: FabricObject) => (o.get('layerName') as string | undefined)
    ?? (o instanceof FabricText ? `“${o.text.slice(0, 24)}”` : o instanceof FabricImage ? 'Imagem' : o.type);

  const headerControls = h('div', { class: 'row', style: 'margin-bottom: 8px;' },
    button(isMulti ? 'Modo Normal' : '☑ Selecionar Vários', () => {
      close();
      showLayers(!isMulti, new Set());
    }),
    isMulti ? button('Marcar Todos', () => {
      close();
      showLayers(true, new Set(selectableObjs));
    }) : null,
    isMulti && selectedIds.size > 0 ? button(`Aplicar (${selectedIds.size})`, () => {
      close();
      editor.selectMultiple([...selectedIds]);
      renderProps(editor.canvas.getActiveObject());
    }, 'primary') : null
  );

  const layerItems = objs.length ? objs.map((o) => {
    if (isMulti && o.selectable) {
      const isChecked = selectedIds.has(o);
      const cb = h('input', {
        type: 'checkbox',
        checked: isChecked,
        style: 'margin-right: 8px; width: 20px; height: 20px;',
      }) as HTMLInputElement;
      cb.addEventListener('change', () => {
        if (cb.checked) selectedIds.add(o);
        else selectedIds.delete(o);
        close();
        showLayers(true, selectedIds);
      });
      return h('div', { class: 'layer' },
        cb,
        h('span', { class: 'grow' }, label(o)),
        button(o.visible ? '👁' : '—', () => { o.set('visible', !o.visible); editor.commit(); close(); showLayers(true, selectedIds); }, 'icon')
      );
    }

    const isBg = o.get('layerName') === 'background';
    const locked = editor.isLocked(o);
    const reopen = () => { close(); showLayers(false); };
    return h('div', { class: 'layer' + (locked ? ' locked' : ''), 'data-layer': label(o) },
      h('button', { type: 'button', class: 'grow', onclick: () => {
        if (isBg) return;
        if (locked) { toast('Camada travada — toque em 🔒 para destravar'); return; }
        editor.canvas.setActiveObject(o);
        editor.canvas.requestRenderAll();
        renderProps(o);
        close();
      } }, label(o) + (isBg ? ' (fundo)' : '')),
      isBg ? null : button(locked ? '🔒' : '🔓', () => { editor.toggleLock(o); reopen(); }, 'icon lock'),
      isBg ? null : button('↑', () => { editor.moveLayer(o, 'up'); reopen(); }, 'icon up'),
      isBg ? null : button('↓', () => { editor.moveLayer(o, 'down'); reopen(); }, 'icon down'),
      button(o.visible ? '👁' : '—', () => { o.set('visible', !o.visible); editor.commit(); reopen(); }, 'icon eye')
    );
  }) : [h('p', { class: 'hint' }, 'Nenhum objeto')];

  const close = openSheet('Camadas', h('div', { class: 'list' },
    headerControls,
    ...layerItems
  ));
}

// ---------- vídeo ----------

function showVideo(): void {
  const duration = editor.videoSettings.duration;
  let isPlaying = editor.videoPreview.playing;

  const playBtn = button(isPlaying ? '⏸ Pausar' : '▶ Reproduzir', () => {
    if (editor.videoPreview.playing) {
      editor.videoPreview.pause();
      playBtn.textContent = '▶ Reproduzir';
    } else {
      editor.videoPreview.play();
      playBtn.textContent = '⏸ Pausar';
    }
  }, 'primary');

  const timeLabel = h('span', { class: 'time-label' }, `${editor.videoPreview.time.toFixed(1)}s / ${duration}s`);
  const timeSlider = h('input', {
    type: 'range',
    min: 0,
    max: duration,
    step: 0.1,
    value: editor.videoPreview.time,
  }) as HTMLInputElement;

  timeSlider.addEventListener('input', () => {
    const val = Number(timeSlider.value);
    editor.videoPreview.seek(val);
    timeLabel.textContent = `${val.toFixed(1)}s / ${editor.videoSettings.duration}s`;
  });

  const stopBtn = button('⏹ Parar', () => {
    editor.videoPreview.stop();
    playBtn.textContent = '▶ Reproduzir';
    timeSlider.value = '0';
    timeLabel.textContent = `0.0s / ${editor.videoSettings.duration}s`;
  });

  editor.videoPreview.onTick = (time) => {
    timeSlider.value = String(time);
    timeLabel.textContent = `${time.toFixed(1)}s / ${editor.videoSettings.duration}s`;
  };

  editor.videoPreview.onEnded = () => {
    playBtn.textContent = '▶ Reproduzir';
  };

  // Presets automáticos de animação para foto de produto
  const applyPreset = (presetType: 'showcase' | 'promo' | 'minimal') => {
    const objects = editor.canvas.getObjects();
    let productFound = false;

    for (const obj of objects) {
      if (obj instanceof FabricImage && !productFound) {
        if (presetType === 'showcase') {
          editor.setAnimation({ fx: 'ken_burns', startTime: 0, duration: editor.videoSettings.duration }, obj);
        } else if (presetType === 'promo') {
          editor.setAnimation({ fx: 'zoom_in', startTime: 0, duration: 2.0 }, obj);
        } else {
          editor.setAnimation({ fx: 'fade', startTime: 0, duration: 1.5 }, obj);
        }
        productFound = true;
      } else if (obj instanceof FabricText) {
        if (presetType === 'showcase') {
          editor.setAnimation({ fx: 'slide_left', startTime: 0.5, duration: 2.0 }, obj);
        } else if (presetType === 'promo') {
          editor.setAnimation({ fx: 'shake', startTime: 1.0, duration: 2.0 }, obj);
        } else {
          editor.setAnimation({ fx: 'fade', startTime: 0.8, duration: 1.5 }, obj);
        }
      } else {
        if (presetType === 'showcase') {
          editor.setAnimation({ fx: 'slide_up', startTime: 1.0, duration: 2.0 }, obj);
        } else if (presetType === 'promo') {
          editor.setAnimation({ fx: 'float', startTime: 0, duration: editor.videoSettings.duration }, obj);
        } else {
          editor.setAnimation({ fx: 'fade', startTime: 1.2, duration: 1.5 }, obj);
        }
      }
    }
    toast('Preset de animação aplicado!');
    editor.videoPreview.stop();
    editor.videoPreview.play();
    playBtn.textContent = '⏸ Pausar';
  };

  const close = openSheet('Vídeo do Produto', h('div', {},
    h('p', { class: 'hint' }, 'Crie um vídeo promocional animado para Reels, TikTok ou anúncios.'),
    h('div', { class: 'video-bar' },
      playBtn,
      stopBtn,
      timeSlider,
      timeLabel,
    ),
    h('h4', {}, 'Duração do Vídeo'),
    h('div', { class: 'chips' },
      button('3s', () => { editor.videoSettings.duration = 3; timeSlider.max = '3'; timeLabel.textContent = `0.0s / 3s`; editor.onChange(); }),
      button('5s', () => { editor.videoSettings.duration = 5; timeSlider.max = '5'; timeLabel.textContent = `0.0s / 5s`; editor.onChange(); }),
      button('10s', () => { editor.videoSettings.duration = 10; timeSlider.max = '10'; timeLabel.textContent = `0.0s / 10s`; editor.onChange(); }),
      button('15s', () => { editor.videoSettings.duration = 15; timeSlider.max = '15'; timeLabel.textContent = `0.0s / 15s`; editor.onChange(); }),
    ),
    musicSection(),
    h('h4', {}, 'Presets de Animação para Produtos'),
    h('div', { class: 'preset-card', onclick: () => applyPreset('showcase') },
      h('div', {},
        h('h5', {}, '🔍 Showcase Dinâmico'),
        h('p', {}, 'Zoom Ken Burns no produto e textos deslizando da esquerda.'),
      ),
      h('span', { class: 'preset-badge' }, 'Recomendado'),
    ),
    h('div', { class: 'preset-card', onclick: () => applyPreset('promo') },
      h('div', {},
        h('h5', {}, '⚡ Oferta & Desconto'),
        h('p', {}, 'Zoom no produto e selos chamando atenção (shake/float).'),
      ),
      h('span', { class: 'preset-badge' }, 'Impacto'),
    ),
    h('div', { class: 'preset-card', onclick: () => applyPreset('minimal') },
      h('div', {},
        h('h5', {}, '✨ Apresentação Minimalista'),
        h('p', {}, 'Entrada suave com fade elegante em todas as camadas.'),
      ),
      h('span', { class: 'preset-badge' }, 'Clean'),
    ),
    h('div', { class: 'row', style: 'margin-top: 16px;' },
      button('🎬 Exportar Vídeo MP4', () => {
        editor.videoPreview.stop();
        close();
        showExport('mp4');
      }, 'primary'),
      button('🎞️ GIF Animado', () => {
        editor.videoPreview.stop();
        close();
        showExport('gif');
      }),
      button('Fechar', () => {
        editor.videoPreview.stop();
        close();
      }),
    ),
  ));
}

/** "🎵 Música de Fundo": trilhas empacotadas, áudio do aparelho, volume, início e fade-out (TASK-04 §2.1). */
function musicSection(): HTMLElement {
  const root = h('div', { class: 'music' });
  const vs = () => editor.videoSettings;
  const restartIfPlaying = () => {
    if (!editor.videoPreview.playing) return;
    editor.videoPreview.pause();
    editor.videoPreview.play();
  };
  const choose = (url: string | undefined, name: string | undefined) => {
    const playing = editor.videoPreview.playing;
    if (playing) editor.videoPreview.pause();
    editor.videoPreview.resetAudio();
    editor.videoSettings = { ...vs(), audioUrl: url, audioName: name };
    if (url && vs().audioVolume === undefined) editor.videoSettings.audioVolume = 0.8;
    if (url) void editor.videoPreview.prepareAudio(url).catch((e: unknown) => toast(`Áudio: ${describe(e)}`));
    editor.onChange();
    render();
    if (playing) editor.videoPreview.play();
  };
  const render = () => {
    const cur = vs();
    const tracks = content.audioTracks ?? [];
    root.replaceChildren(
      h('h4', {}, '🎵 Música de Fundo'),
      h('p', { class: 'hint music-now' }, cur.audioUrl ? `Tocando: ${cur.audioName ?? 'áudio'}` : 'Sem música'),
      h('div', { class: 'chips' },
        ...tracks.map((t) => {
          const url = contentUrl(t.file);
          const b = button(`🎶 ${t.name}`, () => choose(url, t.name), 'chip' + (cur.audioUrl === url ? ' primary' : ''));
          b.dataset.track = t.id;
          b.title = t.mood;
          return b;
        }),
      ),
      h('div', { class: 'row' },
        button('📂 Escolher áudio do celular…', () => void (async () => {
          const a = await run('Carregando áudio', () => bridge.request<AudioRef>('pickAudio'));
          if (a) { choose(a.url, a.name); toast(`Música: ${a.name}`); }
        })(), 'pick-audio'),
        button('🔇 Sem música', () => choose(undefined, undefined), 'no-audio'),
      ),
      ...(cur.audioUrl ? [
        slider('Volume da música (%)', 0, 100, 1, Math.round((cur.audioVolume ?? 0.8) * 100), (v) => {
          editor.videoSettings.audioVolume = v / 100;
          const el = editor.videoPreview.audio;
          if (el) el.volume = v / 100;
        }, () => editor.onChange()),
        slider('Início da música (s)', 0, 60, 0.5, cur.audioStartTime ?? 0, (v) => {
          editor.videoSettings.audioStartTime = v;
        }, () => { editor.onChange(); restartIfPlaying(); }),
        h('label', { class: 'check' },
          h('input', { type: 'checkbox', checked: Boolean(cur.audioFadeOut), class: 'audio-fade',
            onchange: (e: Event) => { editor.videoSettings.audioFadeOut = (e.target as HTMLInputElement).checked; editor.onChange(); } }),
          h('span', {}, 'Suavizar final (fade-out de áudio)')),
      ] : []),
    );
  };
  render();
  return root;
}

// ---------- exportar ----------

function showExport(initial: ExportPayload['format'] = 'png'): void {
  let format: ExportPayload['format'] = initial;
  let scale = 1;
  let quality = 0.92;
  let pages: 'current' | 'all' = 'current';
  let cropMarks = true;
  let bleed = 0;
  const name = (editor.name || 'design').replace(/[^\p{L}\p{N}_-]+/gu, '_');
  const pageCount = editor.getPageCount();
  const isVideo = () => format === 'mp4' || format === 'gif';
  /** O arquivo de uma página: SVG, ou raster (no PDF, PNG com a sangria; o Kotlin monta as páginas do PDF). */
  const renderOne = (): Promise<string> => {
    if (format === 'svg') return editor.exportSvg();
    if (format === 'pdf') return editor.exportRaster('png', scale, 1, bleed);
    return editor.exportRaster(format === 'jpg' ? 'jpeg' : format === 'webp' ? 'webp' : 'png', scale, quality);
  };
  /**
   * Lote (TASK-10): uma página por mensagem com o mesmo `batch.id`; o Kotlin junta no fim (N na galeria, `.zip` ou `.pdf`).
   * O PDF vai sempre por aqui, mesmo com uma página (`count: 1`).
   */
  const goBatch = async (action: ExportPayload['action'], all: boolean) => {
    const count = all ? pageCount : 1;
    const batchId = `b${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
    const printOptions = format === 'pdf' ? { cropMarks, bleedPx: bleed, scale } : undefined;
    await run('Exportando', async (progress) => {
      let r: ExportResult = {};
      const send = async (index: number, data: string) => {
        progress(null, `${index + 1}/${count}`);
        const payload: ExportPayload = { format, action, name, data, batch: { id: batchId, index, count }, printOptions };
        r = await bridge.request<ExportResult>('export', payload);
      };
      if (all) await editor.exportEachPage(renderOne, send);
      else await send(0, await renderOne());
      const n = r.count ?? count;
      const gallery = action === 'save' && (format === 'png' || format === 'jpg' || format === 'webp') && n > 1;
      toast(gallery ? `${n} anúncios salvos na galeria!` : r.location ? `Salvo em ${r.location}` : 'Pronto');
    });
  };
  const go = (action: ExportPayload['action']) => void (async () => {
    close();
    const all = pages === 'all' && pageCount > 1 && !isVideo() && (action === 'save' || action === 'share');
    if (all || format === 'pdf') { await goBatch(action, all); return; }
    await run(format === 'mp4' ? 'Gerando vídeo MP4' : format === 'gif' ? 'Gerando GIF animado' : 'Exportando', async () => {
      const data = format === 'mp4' || format === 'gif' ? JSON.stringify(await editor.exportVideoBundle(format)) : await renderOne();
      const payload: ExportPayload = { format, action, name, data };
      const r = await bridge.request<ExportResult>('export', payload);
      toast(r.location ? `Salvo em ${r.location}` : 'Pronto');
    });
  })();
  // TASK-09/10: com 2+ páginas, "Todas as páginas" (PNG/JPG/WebP → N na galeria ou um .zip; SVG → .zip; PDF → um arquivo)
  const pagesRow = select('Páginas', [['current', 'Página atual'], ['all', `Todas as páginas (${pageCount})`]], pages, (v) => {
    pages = v as typeof pages;
    syncRows();
  });
  pagesRow.classList.add('export-pages');
  const cropCheck = h('input', { type: 'checkbox', checked: cropMarks, class: 'crop-marks' });
  cropCheck.addEventListener('change', () => { cropMarks = cropCheck.checked; });
  const bleedRow = select('Sangria', [['0', 'Sem sangria'], ['18', '18 px'], ['36', '36 px']], String(bleed), (v) => { bleed = Number(v); });
  bleedRow.classList.add('export-bleed');
  const pdfRow = h('div', { class: 'row pdf-options' }, h('label', { class: 'check' }, cropCheck, h('span', {}, '✂️ Marcas de corte')), bleedRow);
  const toMockup = () => void (async () => {
    close();
    await run('Preparando o mockup', async () => {
      const data = await editor.exportRaster('png', 1, 1);
      await bridge.request('export', { format: 'png', action: 'mockup', name, data } satisfies ExportPayload);
    });
  })();
  // a qualidade vale para JPG e WebP (§29; o PNG é sem perda)
  const qualityRow = slider('Qualidade (JPG/WebP)', 0.5, 1, 0.01, quality, (v) => { quality = v; });
  qualityRow.hidden = true;
  // o SVG é vetor: a resolução não vale para ele (§31)
  const scaleRow = select('Resolução', [['1', `1× (${editor.width}×${editor.height})`], ['2', '2×'], ['3', '3×']], '1', (v) => { scale = Number(v); });
  const printBtn = button('Imprimir', () => go('print'), 'print-btn');
  const mockupBtn = button('Ver em mockup', toMockup, 'mockup-btn');
  const syncRows = () => {
    const video = isVideo();
    const all = pages === 'all' && pageCount > 1;
    qualityRow.hidden = format !== 'jpg' && format !== 'webp';
    scaleRow.hidden = format === 'svg' || video;
    // vídeo não tem lote (cada um é um render do FFmpeg); imprimir e mockup são da página atual
    pagesRow.hidden = pageCount < 2 || video;
    pdfRow.hidden = format !== 'pdf';
    printBtn.hidden = video || format === 'pdf' || format === 'svg' || all;
    mockupBtn.hidden = video || format === 'pdf' || all;
  };
  const close = openSheet('Exportar', h('div', {},
    select('Formato', [['png', 'PNG'], ['jpg', 'JPG'], ['webp', 'WebP (leve, para lojas online)'], ['svg', 'SVG (vetor)'],
      ['pdf', '📄 PDF (impressão)'], ['mp4', '🎬 Vídeo MP4 (com animações)'], ['gif', '🎞️ GIF Animado (WhatsApp)']], format, (v) => {
      format = v as typeof format;
      syncRows();
    }),
    pagesRow,
    scaleRow,
    qualityRow,
    pdfRow,
    h('div', { class: 'row' }, button('Salvar na galeria', () => go('save'), 'primary save-btn'), button('Compartilhar', () => go('share'), 'share-btn'),
      printBtn),
    h('div', { class: 'row' }, mockupBtn)));
  syncRows();
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
  (window as unknown as Record<string, unknown>).content = content;
  (window as unknown as Record<string, unknown>).editor = editor;
  (window as unknown as Record<string, unknown>).contentUrl = contentUrl;
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
  /** Brand kit conhecido para o E2E (o mesmo formato que o Kotlin manda no `hello`/`applyBrandKit`). */
  setBrandKit: (k: unknown) => { brandKit = parseBrandKit(k); },
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
