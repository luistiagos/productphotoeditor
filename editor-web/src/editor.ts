import {
  ActiveSelection,
  Canvas,
  Circle,
  FabricImage,
  FabricObject,
  FabricText,
  Gradient,
  Group,
  InteractiveFabricObject,
  IText,
  Line,
  loadSVGFromString,
  loadSVGFromURL,
  Path,
  Pattern,
  PencilBrush,
  Point,
  Polygon,
  Rect,
  Shadow,
  StaticCanvas,
  Textbox,
  Triangle,
  util,
  config as fabricConfig,
  filters,
} from 'fabric';
import { createImageCroppingControls } from 'fabric/extensions';
import {
  createDocument, CUSTOM_PROPERTIES, type EditorDocument, type EditorPage, type FabricJson, fabricFontsUsed, fontsUsed, type LayerAnimation,
  MAX_PAGES, parseDocument, type VideoSettings,
} from './document';
import { type ReflowItem, smartReflowLayout } from './magicResize';
import { type CatalogRow, generateMergedPages, type LiveText, mergedPageName } from './dataMerge';
import { History } from './history';
import { fitSlot, type FitMode, type ImageRegion, rescaledGeometry, visibleRegion } from './imageGeometry';
export interface ShadowOptions {
  color?: string;
  blur?: number;
  offsetX?: number;
  offsetY?: number;
}

import { curvePath, cycleTextCase as cycleTextCaseHelper, installWarpRenderer, isEnvelopeWarp, isPathWarp, type WarpStyle } from './curve';
import { LongPress } from './longPress';
import { ensureFonts, fontUrl } from './content';
import { browserFetcher, inlineSvgResources } from './svgExport';
import { FfmpegCommandBuilder, type LayerRenderItem } from './video/FfmpegCommandBuilder';
import { VideoPreview } from './video/VideoPreview';
import { audioChannels } from './video/audioTrack';
import type { ExportVideoBundle } from './protocol';
import { renderGuideLines, type ExtraSnapTargets, type GuideLine, snapMovingTarget } from './snapping';
import {
  type GridOverlayMode, gridLines, isValidGuide, type ManualGuide, renderGridOverlay, renderManualGuides, renderOverlayGuide,
  type OverlayGuideMode,
} from './overlays';
import {
  anchoredZoom, clampPan, FIT_VIEW, isFitView, type PinchStart, pinchStep, type Pt, type StageLayout, stepFactor, touchGeometry,
  viewportMatrix, type ViewState,
} from './viewportZoom';
import { buildFabricGradient, evenStops, gradientBox, type GradientSpec, isGradientSpec } from './gradients';
import { type ConnectorSpec, connectorGeometry, dashArrayFor, type DashStyle, isConnectorSpec, isDashStyle } from './connectors';
import { collectTextLayers, countMatches, detectListStyle, findAndReplaceInText, type ListStyle, toggleListStyle } from './textTools';
import { FREEHAND_DECIMATE, FREEHAND_LAYER, isFreehandPath } from './freehandDraw';
import { encodeQr, isQrConfig, type QrConfig, qrLayout, qrSvg } from './qrcode';
import { buildTable, isTableData, type Measure, type TableData } from './table';
import { compactFilterAdjust, type DuotoneSpec, duotoneMatrix, sharpenKernel, warmthMatrix } from './imageFilters';
// também registra as classes no classRegistry (revive de rascunho, undo, páginas, clone, miniatura)
import { FocusBlur, type FocusSpec, isRegionFilter, SoftEdge, Vignette } from './focusFilters';
import { coverPatternTransform, installPatternSvg, isTextImageFill, refitTextImageFill, type TextImageFill } from './textImageFill';
import { type BooleanOp, booleanRegions, isBooleanShapeType, MIN_RESULT_AREA, ringsArea, ringsToPathD, shapeRegion } from './pathBoolean';
import { applyStroke, REFINE_FEATHER, REFINE_SIZE, type RefineMode, type RefinePoint } from './refineCutout';
import {
  applyFraming, currentFraming, framedGeometry, frameProps, type FrameSpec, frameSpecOf, installFrameRenderer, type PathClass, refreshFrame,
} from './clipFrames';

FabricObject.customProperties = [...CUSTOM_PROPERTIES];
installWarpRenderer(Textbox);
installPatternSvg(Pattern);
installFrameRenderer(FabricImage);
/** `Path` com a assinatura que o `clipFrames` usa (a do Fabric aceita mais formatos de caminho). */
const FramePath = Path as unknown as PathClass;
// alvos maiores para toque
InteractiveFabricObject.ownDefaults = {
  ...InteractiveFabricObject.ownDefaults,
  cornerSize: 18,
  touchCornerSize: 40,
  transparentCorners: false,
  cornerColor: '#ffffff',
  cornerStrokeColor: '#3b6fd8',
  borderColor: '#3b6fd8',
  cornerStyle: 'circle',
  padding: 4,
};
// sem edição inline do Fabric (2º toque): com o teclado aberto o canvas encolhe a uma miniatura; o texto se edita pelo
// toque longo ou pelo botão "Editar texto", num campo da UI
IText.ownDefaults = { ...IText.ownDefaults, editable: false };

export type ShapeKind = 'rect' | 'rounded' | 'circle' | 'triangle' | 'line' | 'star' | 'arrow' | 'badge-hex' | 'pill';
/** Formas que o "🔄 Trocar forma" aceita (origem e destino). */
export const SWAP_KINDS: ShapeKind[] = ['rect', 'rounded', 'pill', 'circle', 'triangle', 'star', 'badge-hex'];
export type CalloutKind = 'pin' | 'dimension' | 'zoom' | 'curved-arrow';
export type FilterPreset = 'none' | 'grayscale' | 'sepia' | 'vintage' | 'polaroid' | 'kodachrome' | 'invert';
/**
 * Sliders da folha Filtros. `sharpen`/`warmth`/`duotone` (TASK-07) são opcionais e relidos de `filterAdjust`;
 * `vignette`/`softEdge`/`focus` (TASK-17) são filtros próprios, relidos de `img.filters` pela classe.
 */
export interface Adjustments {
  brightness: number; contrast: number; saturation: number; blur: number;
  sharpen?: number; warmth?: number; duotone?: DuotoneSpec;
  vignette?: number; softEdge?: number; focus?: FocusSpec | null;
}
/** Formatos de raster do `toDataURL` do Fabric 7.4 (`ImageFormat`). */
export type RasterFormat = 'png' | 'jpeg' | 'webp';

const BACKGROUND_LAYER = 'background';

/** 🖌️ Retocar recorte (TASK-18) em curso. */
interface RefineState {
  img: FabricImage;
  /** Recorte em pixels (tamanho natural, sem filtros), pintado pelos traços; é a prévia (`img._element`). */
  work: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  /** Foto antes do recorte, escalada para o tamanho de `work`; null = sem "Restaurar". */
  orig: CanvasRenderingContext2D | null;
  mode: RefineMode;
  /** Diâmetro do pincel, px da página. */
  size: number;
  /** Suavidade da borda, 0..1. */
  feather: number;
  /** Pontos (cena) do traço em curso, entre o `mouse:down` e o `mouse:up`. */
  points: RefinePoint[] | null;
  /** Traços aplicados desde o início do modo. */
  strokes: number;
}

export interface RefineInfo {
  img: FabricImage;
  mode: RefineMode;
  size: number;
  feather: number;
  strokes: number;
  canRestore: boolean;
}

/** Campos internos do Fabric 7.4.0 que o gesto de 2 dedos precisa zerar (Canvas.ts / SelectableCanvas.ts). */
interface FabricGestureInternals {
  _groupSelector: unknown;
  _isCurrentlyDrawing: boolean;
  _isClick: boolean;
}

/**
 * Editor sobre um Fabric Canvas. No encaixe (zoom do usuário 100%, sem pan) o elemento tem o tamanho da página × zoom
 * (§15); com zoom/pan do usuário (TASK-13) o elemento ocupa o palco inteiro e a página anda pelo `viewportTransform`.
 */
export class Editor {
  readonly canvas: Canvas;
  private docWidth = 1080;
  private docHeight = 1080;
  /** Zoom de encaixe (página inteira na tela), recalculado a cada `fit()`. */
  private baseZoom = 1;
  /** Zoom/pan do usuário (estado de tela: fora do documento e do undo). */
  private view: ViewState = { ...FIT_VIEW };
  /** Pinça em curso (início do gesto) e se há um gesto de 2+ dedos desde que todos os dedos saíram. */
  private pinch: PinchStart | null = null;
  private gesture = false;
  private selectionBeforeGesture = true;
  /** Toque de 1 dedo curto e parado (candidato a duplo toque), medido nos listeners do palco. */
  private tapStart: { t: number; x: number; y: number } | null = null;
  private lastTouchWasTap = false;
  private lastTap: { t: number; x: number; y: number } | null = null;
  private readonly longPress: LongPress<FabricText>;
  name = 'Sem nome';
  /** Papel do brand kit aplicado ao fundo do canvas (fabric.brandBackground). */
  brandBackground: string | undefined;
  readonly history = new History<string>(60);
  private suspendHistory = 0;
  private historyTimer: number | undefined;
  private maskPaths: FabricObject[] | null = null;
  /** 🖌️ Retocar recorte em curso (TASK-18); null fora do modo. */
  private refine: RefineState | null = null;
  /**
   * "✍️ Desenhar à mão": quantos objetos havia ao começar (null fora do modo). Os traços da sessão são os Paths "Traço à
   * mão" acima desse índice — por posição, não por referência: o ↶/↷ da barra recria os objetos pelo JSON.
   */
  private freehandBase: number | null = null;
  private cropState: { img: FabricImage; controls: FabricObject['controls'] } | null = null;
  onChange: () => void = () => {};
  onSelection: (obj: FabricObject | undefined) => void = () => {};
  /** Toque longo num texto: a UI abre a edição. Chega com o dedo ainda no vidro (o foco do campo vai no soltar). */
  onEditText: (t: FabricText) => void = () => {};

  videoSettings: VideoSettings = defaultVideoSettings();
  readonly videoPreview: VideoPreview;

  guideOverlay: OverlayGuideMode = 'none';
  /** Grade de composição (TASK-13); os terços também viram alvos do snapping. */
  gridOverlay: GridOverlayMode = 'none';
  /** Guias manuais da sessão (px do documento); também viram alvos do snapping. */
  customGuides: ManualGuide[] = [];
  snappingEnabled = true;
  isExporting = false;
  private activeGuides: GuideLine[] = [];
  /** Avisado a cada mudança de zoom/pan (a pílula atualiza o rótulo). */
  onZoom: () => void = () => {};
  /**
   * Páginas do projeto (TASK-09). A ativa está no canvas: o `fabric` dela aqui só vale depois de `storeActivePage()`.
   * As inativas são cópias do JSON (o `toObject` repassa por referência as propriedades próprias dos objetos).
   */
  private pages: EditorPage[] = [{ id: 'p0', width: 1080, height: 1080, fabric: { objects: [] } }];
  private activePage = 0;
  /** Operações de página em fila: trocar/criar/apagar é assíncrono (loadFromJSON) e dois toques seguidos não podem se cruzar. */
  private pageOps: Promise<unknown> = Promise.resolve();
  /** Avisado quando muda o número de páginas, a ordem ou a ativa (a faixa de páginas). */
  onPages: () => void = () => {};

  constructor(el: HTMLCanvasElement, private readonly host: HTMLElement) {
    this.canvas = new Canvas(el, { preserveObjectStacking: true, enableRetinaScaling: true, backgroundColor: '#ffffff' });
    this.videoPreview = new VideoPreview(this.canvas, () => this.videoSettings, () => ({ width: this.docWidth, height: this.docHeight }));
    const changed = () => this.scheduleSnapshot();
    this.canvas.on('object:added', changed);
    this.canvas.on('object:removed', changed);
    // texto curvo: a largura da caixa (alças laterais) e a digitação refazem as dimensões do texto reto (§29)
    this.canvas.on('object:modified', ({ target }) => { this.refitCurve(target); this.refreshGradient(target); this.refreshFrameOf(target); changed(); });
    // moldura (TASK-06) acompanha ao vivo a alça de escala e o arraste do recorte (os controles do recorte disparam
    // `object:CROPPING`, fabric/extensions `croppingHandlers.ts`)
    this.canvas.on('object:scaling', ({ target }) => this.refreshFrameOf(target));
    (this.canvas as unknown as { on(e: string, h: (ev: { target?: FabricObject }) => void): void })
      .on('object:CROPPING', ({ target }) => this.refreshFrameOf(target));
    this.canvas.on('text:changed', ({ target }) => { this.refitCurve(target); this.refreshGradient(target); changed(); });
    this.canvas.on('selection:created', () => this.onSelection(this.canvas.getActiveObject()));
    this.canvas.on('selection:updated', () => { this.leaveCrop(); this.onSelection(this.canvas.getActiveObject()); });
    this.canvas.on('selection:cleared', () => { this.leaveCrop(); this.onSelection(undefined); });

    this.canvas.on('object:moving', ({ target }) => {
      if (!this.snappingEnabled || !target || this.isExporting) return;
      const zoom = this.canvas.getZoom();
      const threshold = 6 / (zoom || 1);
      const otherBBoxes = this.canvas.getObjects()
        .filter((o) => o !== target && o.visible && o.get('layerName') !== BACKGROUND_LAYER && o.selectable)
        .map((o) => o.getBoundingRect());
      // caixa ATUAL do alvo (o evento chega antes do setCoords do Fabric) [[task-13-zoom-pan-pinch-reguas-grade-e-simulador-preview-anuncio]]
      const snap = snapMovingTarget(target, this.docWidth, this.docHeight, otherBBoxes, threshold, this.extraSnapTargets());
      this.activeGuides = snap.guides;
      this.canvas.requestRenderAll();
    });

    const clearGuides = () => {
      if (this.activeGuides.length > 0) {
        this.activeGuides = [];
        this.canvas.requestRenderAll();
      }
    };
    this.canvas.on('mouse:up', clearGuides);
    this.canvas.on('selection:cleared', clearGuides);

    // [[task-13-zoom-pan-pinch-reguas-grade-e-simulador-preview-anuncio]]: o Fabric dispara o after:render depois do
    // `ctx.restore()` do viewportTransform (StaticCanvas.renderCanvas), com o contexto só na escala de retina; os overlays
    // são em coordenadas do documento, então entram sob `transform(vpt)`. O `renderTop()` também dispara o evento, com o
    // contexto de cima: os overlays são só do inferior.
    this.canvas.on('after:render', (opt) => {
      const ctx = opt.ctx;
      if (this.isExporting || !ctx || ctx !== this.canvas.getContext()) return;
      const zoomed = !isFitView(this.view);
      const v = this.canvas.viewportTransform;
      if (zoomed) this.maskOutsidePage(ctx, v);
      const zoom = this.canvas.getZoom();
      ctx.save();
      ctx.transform(v[0], v[1], v[2], v[3], v[4], v[5]);
      if (this.gridOverlay !== 'none') renderGridOverlay(ctx, this.gridOverlay, this.docWidth, this.docHeight, zoom);
      if (this.guideOverlay !== 'none') renderOverlayGuide(ctx, this.guideOverlay, this.docWidth, this.docHeight, zoom);
      if (this.customGuides.length > 0) renderManualGuides(ctx, this.customGuides, this.docWidth, this.docHeight, zoom);
      if (this.activeGuides.length > 0) renderGuideLines(ctx, this.activeGuides, zoom);
      ctx.restore();
      // as alças saem antes do after:render (drawControls) e a máscara de fora da página as apagaria: redesenha por cima
      if (zoomed && this.canvas.getActiveObject()) this.canvas.drawControls(ctx);
    });
    this.canvas.on('path:created', ({ path }) => {
      if (this.refine) {
        // o rastro do pincel é só visual: os carimbos saem dos pontos do traço, no `mouse:up` (que vem depois)
        void this.withoutHistory(() => this.canvas.remove(path));
      } else if (this.maskPaths) {
        path.set({ selectable: false, evented: false });
        this.maskPaths.push(path);
      } else if (this.freehandBase !== null) {
        // traço permanente: camada normal (move, redimensiona, entra no undo); o `object:added` já agendou o instantâneo,
        // que só é tirado depois do debounce, com o nome da camada
        path.set({ layerName: FREEHAND_LAYER, selectable: true, evented: true });
        path.setCoords();
        this.scheduleSnapshot();
      }
    });
    // toque longo num texto abre a edição (a inline do Fabric está desligada, ver IText.ownDefaults)
    const longPress = new LongPress<FabricText>((t) => this.onEditText(t));
    this.longPress = longPress;
    this.canvas.on('mouse:down', ({ target, viewportPoint }) => {
      if (target instanceof FabricText && !this.canvas.isDrawingMode && !this.cropState) longPress.down(target, viewportPoint.x, viewportPoint.y);
    });
    this.canvas.on('mouse:move', ({ viewportPoint }) => longPress.move(viewportPoint.x, viewportPoint.y));
    this.canvas.on('mouse:up', () => longPress.cancel());
    // retoque: os pontos do traço (cena) vêm dos eventos de ponteiro, que o Fabric dispara também em modo desenho
    this.canvas.on('mouse:down', ({ scenePoint }) => { if (this.refine) this.refine.points = [{ x: scenePoint.x, y: scenePoint.y }]; });
    this.canvas.on('mouse:move', ({ scenePoint }) => { this.refine?.points?.push({ x: scenePoint.x, y: scenePoint.y }); });
    this.canvas.on('mouse:up', () => {
      const s = this.refine;
      if (!s?.points) return;
      const points = s.points;
      s.points = null;
      this.applyRefineStroke(points);
    });
    // duplo toque fora de objetos volta ao encaixe (TASK-13); o toque é medido nos listeners do palco (installGestures)
    this.canvas.on('mouse:up', ({ target }) => {
      const tap = this.lastTouchWasTap;
      this.lastTouchWasTap = false;
      const p = this.tapStart;
      if (!tap || !p || target || this.canvas.isDrawingMode || this.cropState || isFitView(this.view)) { this.lastTap = null; return; }
      const prev = this.lastTap;
      if (prev && p.t - prev.t < 400 && Math.hypot(p.x - prev.x, p.y - prev.y) < 40) {
        this.lastTap = null;
        this.resetZoom();
      } else {
        this.lastTap = { ...p };
      }
    });
    this.installGestures();
    new ResizeObserver(() => this.fit()).observe(host);
  }

  // ---------- zoom e pan do usuário (TASK-13) ----------

  /** Fator do usuário sobre o encaixe (1 = página inteira na tela). */
  get zoomFactor(): number { return this.view.factor; }
  /** Zoom/pan do usuário ligado (elemento do tamanho do palco). */
  get isZoomed(): boolean { return !isFitView(this.view); }
  get viewState(): ViewState { return { ...this.view }; }

  private stageLayout(): StageLayout {
    return {
      stageW: Math.max(50, this.host.clientWidth),
      stageH: Math.max(50, this.host.clientHeight),
      docW: this.docWidth,
      docH: this.docHeight,
      base: this.baseZoom,
    };
  }

  /** clientX/Y → coordenadas do palco (área útil do #stage). */
  private clientToStage(clientX: number, clientY: number): Pt {
    const r = this.host.getBoundingClientRect();
    return { x: clientX - r.left - this.host.clientLeft, y: clientY - r.top - this.host.clientTop };
  }

  private applyView(next: ViewState): void {
    // resíduo de ponto flutuante não pode deixar o editor fora do encaixe
    const snap = (n: number) => (Math.abs(n) < 1e-6 ? 0 : n);
    this.view = { factor: Math.abs(next.factor - 1) < 1e-9 ? 1 : next.factor, panX: snap(next.panX), panY: snap(next.panY) };
    this.fit();
  }

  /** Muda o fator do usuário ancorado num ponto da tela (clientX/Y; padrão: centro do palco). */
  setZoom(factor: number, anchorClient?: { x: number; y: number }): void {
    const l = this.stageLayout();
    const a = anchorClient ? this.clientToStage(anchorClient.x, anchorClient.y) : { x: l.stageW / 2, y: l.stageH / 2 };
    this.applyView(clampPan(anchoredZoom(this.view, a, factor, l), l));
  }

  /** Próxima parada da pílula (− / +), ancorada no centro do palco. */
  zoomBy(dir: 1 | -1): void {
    this.setZoom(stepFactor(this.view.factor, dir));
  }

  /** Volta ao encaixe (100%, sem pan): o mesmo elemento e viewport de antes do zoom. */
  resetZoom(): void {
    this.applyView({ ...FIT_VIEW });
  }

  /** Arrasta a página dx/dy px de tela. */
  panBy(dx: number, dy: number): void {
    const l = this.stageLayout();
    this.applyView(clampPan({ ...this.view, panX: this.view.panX + dx, panY: this.view.panY + dy }, l));
  }

  /**
   * Pinça e pan com 2 dedos no palco, em captura (antes do Fabric). Ao entrar o 2º dedo, desfaz o que o 1º já começou
   * no Fabric (arrasto/escala do objeto, retângulo de seleção, traço do pincel, toque longo) e, até todos os dedos
   * saírem, nenhum toque chega a ele; o `touchend` final passa, para o Fabric soltar os listeners do documento.
   */
  private installGestures(): void {
    const opts: AddEventListenerOptions = { capture: true, passive: false };
    const two = (e: TouchEvent): [Pt, Pt] => [
      this.clientToStage(e.touches[0].clientX, e.touches[0].clientY),
      this.clientToStage(e.touches[1].clientX, e.touches[1].clientY),
    ];
    const begin = (e: TouchEvent) => {
      const g = touchGeometry(...two(e));
      this.pinch = { view: { ...this.view }, dist: g.dist, mid: g.mid };
    };
    this.host.addEventListener('touchstart', (e) => {
      if (e.touches.length === 1 && !this.gesture) {
        this.tapStart = { t: e.timeStamp, x: e.touches[0].clientX, y: e.touches[0].clientY };
        return;
      }
      if (e.touches.length < 2) return;
      e.preventDefault();
      e.stopPropagation();
      this.tapStart = null;
      if (!this.gesture) {
        this.gesture = true;
        this.selectionBeforeGesture = this.canvas.selection;
        this.abortFabricGesture();
        this.canvas.selection = false;
      }
      begin(e);
    }, opts);
    this.host.addEventListener('touchmove', (e) => {
      if (this.tapStart && e.touches.length === 1) {
        const t = e.touches[0];
        if (Math.hypot(t.clientX - this.tapStart.x, t.clientY - this.tapStart.y) > 12) this.tapStart = null;
      }
      if (!this.gesture) return;
      e.preventDefault();
      e.stopPropagation();
      if (e.touches.length < 2 || !this.pinch) return;
      const g = touchGeometry(...two(e));
      const l = this.stageLayout();
      this.applyView(clampPan(pinchStep(this.pinch, g.dist, g.mid, l), l));
    }, opts);
    const end = (e: TouchEvent) => {
      if (!this.gesture) {
        this.lastTouchWasTap = e.type === 'touchend' && e.touches.length === 0 && this.tapStart !== null
          && e.timeStamp - this.tapStart.t < 300;
        return;
      }
      this.lastTouchWasTap = false;
      if (e.touches.length >= 2) { begin(e); e.stopPropagation(); return; }
      this.pinch = null;
      if (e.touches.length > 0) { e.stopPropagation(); return; }
      this.gesture = false;
      this.canvas.selection = this.selectionBeforeGesture;
      this.canvas.requestRenderAll();
    };
    this.host.addEventListener('touchend', end, opts);
    this.host.addEventListener('touchcancel', end, opts);
  }

  /** Desfaz, sem `object:modified` (sem passo de undo), o que o 1º dedo começou no Fabric. */
  private abortFabricGesture(): void {
    const c = this.canvas;
    const internals = c as unknown as FabricGestureInternals;
    const t = c._currentTransform;
    if (t?.target) {
      t.target.set(t.original);
      t.target.isMoving = false;
      t.target.setCoords();
    }
    c._currentTransform = null;
    internals._groupSelector = null;
    internals._isCurrentlyDrawing = false;
    // o `mouse:up` do touchend final chega com isClick = false: não seleciona nem conta como toque
    internals._isClick = false;
    if (this.refine) this.refine.points = null; // a pinça não pinta o retoque
    c.clearContext(c.contextTop);
    this.longPress.cancel();
    this.activeGuides = [];
    c.requestRenderAll();
  }

  /** Apaga o que ficou fora da página (o fundo do Fabric pinta o elemento inteiro) e marca a borda da página. */
  private maskOutsidePage(ctx: CanvasRenderingContext2D, v: number[]): void {
    const W = this.canvas.width;
    const H = this.canvas.height;
    const x = v[4];
    const y = v[5];
    const w = this.docWidth * v[0];
    const h = this.docHeight * v[3];
    ctx.save();
    ctx.globalCompositeOperation = 'destination-out';
    ctx.beginPath();
    ctx.rect(0, 0, W, H);
    ctx.rect(x, y, w, h);
    ctx.fill('evenodd');
    ctx.restore();
    ctx.save();
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.22)';
    ctx.lineWidth = 1;
    ctx.strokeRect(x - 0.5, y - 0.5, w + 1, h + 1);
    ctx.restore();
  }

  /** Alvos extras do snapping: linhas dos terços (com a grade ligada) e guias manuais. */
  private extraSnapTargets(): ExtraSnapTargets | undefined {
    const x: number[] = [];
    const y: number[] = [];
    if (this.gridOverlay === 'thirds') {
      for (const l of gridLines('thirds', this.docWidth, this.docHeight)) (l.axis === 'x' ? x : y).push(l.pos);
    }
    for (const g of this.customGuides) (g.axis === 'x' ? x : y).push(g.pos);
    return x.length || y.length ? { x, y } : undefined;
  }

  /** Adiciona uma guia manual (px do documento); false se fora da página. */
  addCustomGuide(axis: 'x' | 'y', pos: number): boolean {
    const g: ManualGuide = { axis, pos };
    if (!isValidGuide(g, this.docWidth, this.docHeight)) return false;
    if (!this.customGuides.some((o) => o.axis === axis && Math.abs(o.pos - pos) < 0.5)) this.customGuides = [...this.customGuides, g];
    this.canvas.requestRenderAll();
    return true;
  }

  clearCustomGuides(): void {
    this.customGuides = [];
    this.canvas.requestRenderAll();
  }

  get width(): number { return this.docWidth; }
  get height(): number { return this.docHeight; }

  // ---------- animações & vídeo ----------

  getAnimation(target: FabricObject | undefined = this.canvas.getActiveObject()): LayerAnimation | undefined {
    if (!target) return undefined;
    return (target as unknown as { animation?: LayerAnimation }).animation;
  }

  setAnimation(anim: LayerAnimation | undefined, target: FabricObject | undefined = this.canvas.getActiveObject()): void {
    if (!target) return;
    (target as unknown as { animation?: LayerAnimation }).animation = anim;
    this.scheduleSnapshot();
    this.onChange();
  }

  // ---------- documento ----------

  async load(input: unknown): Promise<EditorDocument> {
    const doc = parseDocument(input);
    await ensureFonts(fontsUsed(doc));
    this.setPagesFrom(doc);
    this.docWidth = doc.width;
    this.docHeight = doc.height;
    this.name = doc.name;
    this.brandBackground = typeof doc.fabric.brandBackground === 'string' ? doc.fabric.brandBackground : undefined;
    // cada documento com as suas (a música de um não vaza para o próximo)
    this.videoPreview.stop();
    this.videoPreview.resetAudio();
    this.videoSettings = { ...defaultVideoSettings(), ...(doc.videoSettings ?? {}), width: doc.width, height: doc.height };
    await this.withoutHistory(() => this.canvas.loadFromJSON(doc.fabric));
    this.syncLocks();
    this.refitCurves();
    // documento novo: volta ao encaixe; guia manual fora da página nova sai
    this.view = { ...FIT_VIEW };
    this.customGuides = this.customGuides.filter((g) => isValidGuide(g, doc.width, doc.height));
    this.fit();
    this.history.reset(this.snapshot());
    this.canvas.requestRenderAll();
    this.onPages();
    this.onChange();
    return doc;
  }

  /** Lista de páginas do documento; a ativa é sempre `fabric/width/height` da raiz (o que o brand kit e o Kotlin mexem). */
  private setPagesFrom(doc: EditorDocument): void {
    if (doc.pages && doc.pages.length > 1) {
      this.activePage = doc.activePageIndex ?? 0;
      this.pages = doc.pages.map((p, i) => (i === this.activePage ? { ...p, width: doc.width, height: doc.height, fabric: doc.fabric } : { ...p }));
    } else {
      const id = this.pages.length === 1 ? this.pages[0].id : newPageId([]);
      this.pages = [{ id, width: doc.width, height: doc.height, fabric: doc.fabric }];
      this.activePage = 0;
    }
  }

  newDocument(name: string, width: number, height: number): Promise<EditorDocument> {
    return this.load(createDocument(name, width, height, { objects: [], background: '#ffffff' }, defaultVideoSettings()));
  }

  toDocument(): EditorDocument {
    const fabric = this.activeFabric();
    const pages = this.pages.length > 1
      ? {
        pages: this.pages.map((p, i) => (i === this.activePage ? { ...p, width: this.docWidth, height: this.docHeight, fabric } : p)),
        activePageIndex: this.activePage,
      }
      : undefined;
    return createDocument(this.name, this.docWidth, this.docHeight, fabric, { ...this.videoSettings }, pages);
  }

  /** JSON do Fabric da página no canvas, com o papel do brand kit no fundo. */
  private activeFabric(): FabricJson {
    const fabric = this.canvas.toObject() as FabricJson;
    if (this.brandBackground) fabric.brandBackground = this.brandBackground;
    return fabric;
  }

  private snapshot(): string {
    return JSON.stringify(this.toDocument());
  }

  private scheduleSnapshot(): void {
    if (this.suspendHistory > 0 || this.brushModal) return;
    window.clearTimeout(this.historyTimer);
    this.historyTimer = window.setTimeout(() => {
      if (this.history.push(this.snapshot())) this.onChange();
    }, 250);
  }

  private async withoutHistory<T>(fn: () => Promise<T> | T): Promise<T> {
    this.suspendHistory++;
    try {
      return await fn();
    } finally {
      this.suspendHistory--;
    }
  }

  // com o retoque aberto o `restore` recarregaria o JSON sob o modo (a imagem dele viraria um objeto morto) [[task-18-retocar-recorte-pos-remocao-de-fundo]]
  async undo(): Promise<void> { if (!this.refine) await this.restore(this.history.undo()); }
  async redo(): Promise<void> { if (!this.refine) await this.restore(this.history.redo()); }

  private async restore(state: string | undefined): Promise<void> {
    if (!state) return;
    const doc = parseDocument(state);
    // o instantâneo traz todas as páginas e a ativa dele: o undo de uma edição feita em outra página volta para ela
    const before = this.pages[this.activePage]?.id;
    this.setPagesFrom(doc);
    await this.withoutHistory(() => this.canvas.loadFromJSON(doc.fabric));
    this.syncLocks();
    this.refitCurves();
    this.brandBackground = typeof doc.fabric.brandBackground === 'string' ? doc.fabric.brandBackground : undefined;
    const pageChanged = this.pages[this.activePage].id !== before;
    if (pageChanged || doc.width !== this.docWidth || doc.height !== this.docHeight) {
      this.docWidth = doc.width;
      this.docHeight = doc.height;
      this.videoSettings = { ...this.videoSettings, width: doc.width, height: doc.height };
      if (pageChanged) {
        this.view = { ...FIT_VIEW };
        this.customGuides = this.customGuides.filter((g) => isValidGuide(g, doc.width, doc.height));
      }
      this.fit();
    }
    this.canvas.requestRenderAll();
    this.onPages();
    this.onChange();
  }

  /** Marca uma alteração feita fora dos eventos do Fabric (propriedades no painel). */
  commit(): void {
    this.canvas.requestRenderAll();
    this.scheduleSnapshot();
  }

  // ---------- páginas: carrossel / catálogo (TASK-09) ----------

  getPageCount(): number { return this.pages.length; }
  getActivePageIndex(): number { return this.activePage; }

  /** Id, nome e tamanho de cada página, na ordem (a faixa e o teste). */
  pageList(): { id: string; name?: string; width: number; height: number }[] {
    return this.pages.map((p, i) => ({
      id: p.id, name: p.name, width: i === this.activePage ? this.docWidth : p.width, height: i === this.activePage ? this.docHeight : p.height,
    }));
  }

  private serial<T>(fn: () => Promise<T>): Promise<T> {
    const run = this.pageOps.then(fn, fn);
    this.pageOps = run.catch(() => undefined);
    return run;
  }

  /** Grava a página do canvas na lista (antes de o canvas receber outra). */
  private storeActivePage(): void {
    this.pages[this.activePage] = {
      ...this.pages[this.activePage], width: this.docWidth, height: this.docHeight, fabric: cloneJson(this.activeFabric()),
    };
  }

  /** Põe a página `index` no canvas, fora do histórico (quem chama decide se é edição). */
  private async showPage(index: number): Promise<void> {
    const p = this.pages[index];
    this.leaveCrop();
    this.videoPreview.stop();
    this.canvas.discardActiveObject();
    this.activePage = index;
    this.docWidth = p.width;
    this.docHeight = p.height;
    this.brandBackground = typeof p.fabric.brandBackground === 'string' ? p.fabric.brandBackground : undefined;
    this.videoSettings = { ...this.videoSettings, width: p.width, height: p.height };
    await ensureFonts(fabricFontsUsed(p.fabric));
    await this.withoutHistory(() => this.canvas.loadFromJSON(p.fabric));
    this.syncLocks();
    this.refitCurves();
    this.view = { ...FIT_VIEW };
    this.customGuides = this.customGuides.filter((g) => isValidGuide(g, p.width, p.height));
    this.fit();
    this.canvas.requestRenderAll();
    this.onPages();
  }

  /** Edição de página (criar, mover, apagar, gerar): um passo do undo. */
  private pushEdit(): void {
    this.canvas.requestRenderAll();
    if (this.history.push(this.snapshot())) this.onChange();
  }

  /** Vai para a página `index`. Não é edição: o undo/redo fica como está (History.replace). Com a máscara aberta, recusa. */
  switchToPage(index: number): Promise<boolean> {
    return this.serial(async () => {
      if (!Number.isInteger(index) || index < 0 || index >= this.pages.length || this.brushModal) return false;
      if (index === this.activePage) return true;
      this.flushPending();
      this.storeActivePage();
      await this.showPage(index);
      this.history.replace(this.snapshot());
      return true;
    });
  }

  /**
   * Página nova logo depois da ativa: em branco com o mesmo fundo (cor, degradê ou imagem, refeito no tamanho dela), ou
   * a cópia da ativa (`duplicateCurrent`: o próximo slide com o mesmo cabeçalho, rodapé e fontes).
   */
  addPage(opts: { duplicateCurrent?: boolean; width?: number; height?: number } = {}): Promise<boolean> {
    return this.serial(async () => {
      if (this.pages.length >= MAX_PAGES || this.brushModal) return false;
      this.flushPending();
      this.storeActivePage();
      const cur = this.pages[this.activePage];
      const width = Math.round(opts.width ?? cur.width), height = Math.round(opts.height ?? cur.height);
      const fabric: FabricJson = opts.duplicateCurrent
        ? cloneJson(cur.fabric)
        : { ...cloneJson(cur.fabric), objects: cloneJson(cur.fabric.objects.filter(isBackgroundJson)) };
      if (width !== cur.width || height !== cur.height) {
        fabric.objects = fabric.objects.map((o) => (isBackgroundJson(o) ? fitBackgroundJson(o, width, height) : o));
      }
      this.pages.splice(this.activePage + 1, 0, { id: newPageId(this.pages), width, height, fabric });
      await this.showPage(this.activePage + 1);
      this.pushEdit();
      return true;
    });
  }

  /** Reordena: a página `from` vai para a posição `to`; a ativa continua a mesma página. */
  movePage(from: number, to: number): boolean {
    const n = this.pages.length;
    if (![from, to].every((i) => Number.isInteger(i) && i >= 0 && i < n) || from === to) return false;
    this.flushPending();
    const activeId = this.pages[this.activePage].id;
    const [p] = this.pages.splice(from, 1);
    this.pages.splice(to, 0, p);
    this.activePage = this.pages.findIndex((x) => x.id === activeId);
    this.pushEdit();
    this.onPages();
    return true;
  }

  /** Apaga a página `index` (padrão: a ativa); a última nunca. Apagar a ativa mostra a seguinte (ou a anterior). */
  deletePage(index: number = this.activePage): Promise<boolean> {
    return this.serial(async () => {
      if (this.pages.length <= 1 || !Number.isInteger(index) || index < 0 || index >= this.pages.length || this.brushModal) return false;
      this.flushPending();
      if (index === this.activePage) {
        this.pages.splice(index, 1);
        await this.showPage(Math.min(index, this.pages.length - 1));
      } else {
        this.pages.splice(index, 1);
        if (index < this.activePage) this.activePage--;
        this.onPages();
      }
      this.pushEdit();
      return true;
    });
  }

  /** Miniatura de uma página (a ativa sai do canvas; as outras, do JSON num StaticCanvas). */
  async pageThumbnail(index: number, maxSide = 160): Promise<string> {
    if (index === this.activePage) return this.thumbnail(maxSide);
    const p = this.pages[index];
    return renderThumbnail(createDocument(this.name, p.width, p.height, p.fabric), maxSide);
  }

  /**
   * ✨ Magic Resize: uma página nova (no fim) por formato, com o conteúdo da ativa reposicionado por papel
   * (`smartReflowLayout`). Um passo do undo; mostra a primeira gerada. Devolve quantas páginas criou.
   */
  magicResize(formats: { width: number; height: number; name?: string }[]): Promise<number> {
    return this.serial(async () => {
      const list = formats
        .filter((f) => f.width >= 16 && f.height >= 16 && f.width <= 8000 && f.height <= 8000)
        .slice(0, MAX_PAGES - this.pages.length);
      if (list.length === 0 || this.brushModal) return 0;
      this.flushPending();
      this.storeActivePage();
      const source = this.pages[this.activePage];
      const created: EditorPage[] = [];
      this.canvas.discardActiveObject();
      try {
        for (const f of list) {
          const W = Math.round(f.width), H = Math.round(f.height);
          // montada no canvas (fora do histórico): as caixas vêm do Fabric, com o texto medido na fonte dele
          await this.withoutHistory(() => this.canvas.loadFromJSON(source.fabric));
          this.refitCurves();
          this.reflowCanvas(source.width, source.height, W, H);
          created.push({ id: newPageId([...this.pages, ...created]), name: f.name, width: W, height: H, fabric: cloneJson(this.activeFabric()) });
        }
      } catch (e) {
        await this.showPage(this.activePage);
        throw e;
      }
      this.pages.push(...created);
      await this.showPage(this.pages.length - created.length);
      this.pushEdit();
      return created.length;
    });
  }

  /** Reposiciona os objetos do canvas de `srcW × srcH` para `W × H` (a página passa a ter `W × H`). */
  private reflowCanvas(srcW: number, srcH: number, W: number, H: number): void {
    const objs = this.canvas.getObjects();
    const items: ReflowItem[] = objs.map((o, id) => {
      o.setCoords();
      const r = o.getBoundingRect(); // plano da cena (aCoords, sem viewport)
      return {
        id,
        kind: o instanceof FabricText ? 'text' : o instanceof FabricImage && o.visible ? 'image' : 'other',
        box: { left: r.left, top: r.top, width: r.width, height: r.height },
        background: o.get('layerName') === BACKGROUND_LAYER,
        fontSize: o instanceof FabricText ? o.fontSize * Math.abs(o.scaleY) : undefined,
      };
    });
    this.docWidth = W;
    this.docHeight = H;
    for (const p of smartReflowLayout(items, { width: srcW, height: srcH }, { width: W, height: H })) {
      const o = objs[p.id];
      if (p.role === 'background') { this.coverPage(o); this.refreshGradient(o); continue; }
      o.set({ scaleX: o.scaleX * p.scale, scaleY: o.scaleY * p.scale });
      o.setCoords();
      const r = o.getBoundingRect();
      o.set({ left: o.left + p.box.left + p.box.width / 2 - (r.left + r.width / 2), top: o.top + p.box.top + p.box.height / 2 - (r.top + r.height / 2) });
      o.setCoords();
    }
  }

  /**
   * 🎨 O fundo da página ativa (cor, degradê do usuário ou imagem) em todas as outras, refeito no tamanho de cada uma (o
   * degradê é recriado pelo `customGradient`: copiar o Rect levaria as coordenadas da página de origem). Um passo do undo.
   */
  applyBackgroundToAllPages(): number {
    if (this.pages.length < 2) return 0;
    this.flushPending();
    const src = cloneJson(this.activeFabric());
    const layer = src.objects.find(isBackgroundJson);
    let n = 0;
    this.pages.forEach((p, i) => {
      if (i === this.activePage) return;
      const rest = p.fabric.objects.filter((o) => !isBackgroundJson(o));
      const objects = layer ? [fitBackgroundJson(cloneJson(layer), p.width, p.height), ...rest] : rest;
      const fabric: FabricJson = { ...p.fabric, background: src.background, objects };
      if (this.brandBackground) fabric.brandBackground = this.brandBackground;
      else delete fabric.brandBackground;
      this.pages[i] = { ...p, fabric };
      n++;
    });
    this.pushEdit();
    return n;
  }

  /**
   * Põe cada página no canvas, na ordem, e entrega o que `render` produz dela a `each` antes de passar à seguinte (um
   * arquivo por vez na memória). Volta à página de antes, sem passo no undo. O lote da TASK-10 (PNG/JPG/WebP/SVG/PDF) e o
   * "Todas as páginas" da TASK-09 passam por aqui.
   */
  exportEachPage(render: () => Promise<string>, each: (index: number, data: string) => Promise<void>): Promise<number> {
    return this.serial(async () => {
      this.flushPending();
      const back = this.activePage;
      let n = 0;
      try {
        for (let i = 0; i < this.pages.length; i++) {
          if (i !== this.activePage) {
            this.storeActivePage();
            await this.showPage(i);
          }
          await each(i, await render());
          n++;
        }
      } finally {
        if (this.activePage !== back) {
          this.storeActivePage();
          await this.showPage(back);
        }
        this.history.replace(this.snapshot());
      }
      return n;
    });
  }

  /**
   * ⚡ Gerar em lote (TASK-10): uma página por linha do catálogo, a partir da página ativa (o modelo, que fica como está),
   * inseridas logo depois dela com o nome do produto; os textos longos encolhem até caber na caixa do modelo. Um passo do
   * undo; mostra a 1ª gerada. Respeita `MAX_PAGES`: `skipped` = linhas que não couberam.
   */
  insertMergedPages(rows: CatalogRow[]): Promise<{ created: number; skipped: number }> {
    return this.serial(async () => {
      const room = Math.max(0, MAX_PAGES - this.pages.length);
      const list = rows.slice(0, room);
      if (list.length === 0 || this.brushModal) return { created: 0, skipped: rows.length };
      this.flushPending();
      this.storeActivePage();
      const source = this.pages[this.activePage];
      // o texto é medido na fonte dele: sem ela carregada, a largura sairia da fonte de reserva
      await ensureFonts(fabricFontsUsed(source.fabric));
      const fabrics = await generateMergedPages(source.fabric, list, {
        enliven: async (o) => (await util.enlivenObjects<FabricObject>([o]))[0] as unknown as LiveText,
      });
      const created: EditorPage[] = [];
      fabrics.forEach((fabric, i) => {
        created.push({ id: newPageId([...this.pages, ...created]), name: mergedPageName(list[i], i), width: source.width, height: source.height, fabric });
      });
      this.pages.splice(this.activePage + 1, 0, ...created);
      await this.showPage(this.activePage + 1);
      this.pushEdit();
      return { created: created.length, skipped: rows.length - created.length };
    });
  }

  // ---------- tela ----------

  fit(): void {
    const pad = 16;
    const w = Math.max(50, this.host.clientWidth - pad * 2);
    const h = Math.max(50, this.host.clientHeight - pad * 2);
    this.baseZoom = Math.min(w / this.docWidth, h / this.docHeight);
    if (isFitView(this.view)) {
      // encaixe: exatamente o de antes da TASK-13 (elemento = página × zoom, centrado pelo flex do #stage)
      this.host.classList.remove('zoomed');
      this.canvas.setDimensions({ width: Math.round(this.docWidth * this.baseZoom), height: Math.round(this.docHeight * this.baseZoom) });
      this.canvas.setViewportTransform([this.baseZoom, 0, 0, this.baseZoom, 0, 0]);
    } else {
      const l = this.stageLayout();
      this.view = clampPan(this.view, l);
      this.host.classList.add('zoomed');
      if (this.canvas.width !== l.stageW || this.canvas.height !== l.stageH) this.canvas.setDimensions({ width: l.stageW, height: l.stageH });
      this.canvas.setViewportTransform(viewportMatrix(this.view, l));
    }
    this.canvas.requestRenderAll();
    this.onZoom();
  }

  /** Muda o tamanho da página; scaleContent reescala e recentra os objetos. */
  resize(width: number, height: number, scaleContent: boolean): void {
    const sx = width / this.docWidth;
    const sy = height / this.docHeight;
    if (scaleContent) {
      const s = Math.min(sx, sy);
      const dx = (width - this.docWidth * s) / 2;
      const dy = (height - this.docHeight * s) / 2;
      for (const o of this.canvas.getObjects()) {
        if (o.get('layerName') === BACKGROUND_LAYER) continue;
        o.set({ left: o.left * s + dx, top: o.top * s + dy, scaleX: o.scaleX * s, scaleY: o.scaleY * s });
        o.setCoords();
      }
    }
    this.docWidth = width;
    this.docHeight = height;
    const bg = this.backgroundLayer();
    if (bg) { this.coverPage(bg); this.refreshGradient(bg); }
    this.view = { ...FIT_VIEW };
    this.customGuides = this.customGuides.filter((g) => isValidGuide(g, width, height));
    this.fit();
    this.commit();
  }

  // ---------- inserir ----------

  private center(o: FabricObject): FabricObject {
    o.set({ left: this.docWidth / 2, top: this.docHeight / 2, originX: 'center', originY: 'center' });
    return o;
  }

  private add(o: FabricObject): FabricObject {
    this.canvas.add(o);
    this.canvas.setActiveObject(o);
    this.canvas.requestRenderAll();
    return o;
  }

  addText(kind: 'title' | 'subtitle' | 'body', fontFamily: string): FabricObject {
    const size = { title: 0.09, subtitle: 0.06, body: 0.035 }[kind] * Math.min(this.docWidth, this.docHeight) * 1.6;
    const text = { title: 'Título', subtitle: 'Subtítulo', body: 'Toque e segure para editar o texto' }[kind];
    const t = new Textbox(text, {
      fontFamily,
      fontSize: Math.round(size),
      fontWeight: kind === 'title' ? 700 : 400,
      fill: '#222222',
      textAlign: 'center',
      width: this.docWidth * (kind === 'body' ? 0.7 : 0.8),
      brandFont: kind === 'body' ? 'body' : 'heading',
    });
    return this.add(this.center(t));
  }

  async addImage(url: string, opts: { fit?: number } = {}): Promise<FabricImage> {
    const img = await FabricImage.fromURL(url);
    const fit = opts.fit ?? 0.6;
    const s = Math.min((this.docWidth * fit) / img.width, (this.docHeight * fit) / img.height, 1 / Math.max(this.baseZoom, 0.001));
    img.set({ scaleX: s, scaleY: s });
    this.add(this.center(img));
    return img;
  }

  addShape(kind: ShapeKind, fill: string): FabricObject {
    return this.add(this.center(makeShape(kind, fill, Math.min(this.docWidth, this.docHeight) * 0.3)));
  }

  async addSvgFromUrl(url: string, name: string): Promise<FabricObject> {
    const { objects, options } = await loadSVGFromURL(url);
    return this.addSvgObjects(objects, options, name);
  }

  async addSvgString(svg: string, name: string, place?: FabricObject): Promise<FabricObject> {
    const { objects, options } = await loadSVGFromString(svg);
    return this.addSvgObjects(objects, options, name, place);
  }

  private addSvgObjects(objects: (FabricObject | null)[], options: Record<string, unknown>, name: string, place?: FabricObject): FabricObject {
    const items = objects.filter((o): o is FabricObject => o !== null);
    if (items.length === 0) throw new Error('SVG vazio');
    const g = util.groupSVGElements(items, options);
    g.set({ layerName: name });
    if (place) {
      // ocupa o mesmo retângulo do objeto de origem (vetorizar uma imagem)
      const r = place.getBoundingRect();
      const s = Math.min(r.width / g.width, r.height / g.height);
      g.set({ scaleX: s, scaleY: s, left: r.left + r.width / 2, top: r.top + r.height / 2, originX: 'center', originY: 'center' });
      return this.add(g);
    }
    const m = Math.min(this.docWidth, this.docHeight) * 0.35;
    const s = m / Math.max(g.width, g.height);
    g.set({ scaleX: s, scaleY: s });
    return this.add(this.center(g));
  }

  // ---------- fundo ----------

  private backgroundLayer(): FabricObject | undefined {
    return this.canvas.getObjects().find((o) => o.get('layerName') === BACKGROUND_LAYER);
  }

  private coverPage(o: FabricObject): void {
    if (o instanceof FabricImage) {
      const s = Math.max(this.docWidth / o.width, this.docHeight / o.height);
      o.set({ scaleX: s, scaleY: s });
    } else {
      o.set({ width: this.docWidth, height: this.docHeight, scaleX: 1, scaleY: 1 });
    }
    o.set({ left: this.docWidth / 2, top: this.docHeight / 2, originX: 'center', originY: 'center' });
    o.setCoords();
  }

  private replaceBackgroundLayer(o: FabricObject | undefined): void {
    const old = this.backgroundLayer();
    if (old) this.canvas.remove(old);
    if (!o) return;
    o.set({ layerName: BACKGROUND_LAYER, selectable: false, evented: false, hoverCursor: 'default' });
    this.coverPage(o);
    this.canvas.insertAt(0, o);
  }

  setBackgroundColor(color: string, brandRole?: string): void {
    this.replaceBackgroundLayer(undefined);
    this.canvas.backgroundColor = color;
    this.brandBackground = brandRole;
    this.commit();
  }

  setBackgroundGradient(colors: string[], kind: 'linear' | 'radial', angleDeg = 90): void {
    this.setBackgroundGradientSpec({ kind, angle: angleDeg, stops: evenStops(colors) });
  }

  /** Degradê do usuário na página (Rect de fundo com `customGradient`). */
  setBackgroundGradientSpec(spec: GradientSpec): void {
    const w = this.docWidth, h = this.docHeight;
    // coordenadas relativas ao canto superior esquerdo do objeto (Object._applyPatternGradientTransform)
    const rect = new Rect({ width: w, height: h, fill: buildFabricGradient(spec, w, h) as Gradient<'linear'>, customGradient: spec });
    this.replaceBackgroundLayer(rect);
    this.brandBackground = undefined;
    this.commit();
  }

  /** O degradê da camada de fundo (se o fundo atual for um). */
  backgroundGradient(): GradientSpec | undefined {
    const spec = this.backgroundLayer()?.get('customGradient');
    return isGradientSpec(spec) ? spec : undefined;
  }

  async setBackgroundImage(url: string): Promise<void> {
    const img = await FabricImage.fromURL(url);
    this.replaceBackgroundLayer(img);
    this.commit();
  }

  // ---------- seleção ----------

  get active(): FabricObject | undefined { return this.canvas.getActiveObject(); }

  remove(): void {
    for (const o of this.canvas.getActiveObjects()) this.canvas.remove(o);
    this.canvas.discardActiveObject();
    this.canvas.requestRenderAll();
  }

  async duplicate(): Promise<void> {
    const o = this.active;
    if (!o) return;
    const c = await o.clone();
    c.set({ left: o.left + 30, top: o.top + 30 });
    this.add(c);
  }

  order(where: 'front' | 'forward' | 'backward' | 'back'): void {
    const o = this.active;
    if (!o) return;
    if (where === 'front') this.canvas.bringObjectToFront(o);
    if (where === 'forward') this.canvas.bringObjectForward(o);
    if (where === 'backward') this.canvas.sendObjectBackwards(o);
    if (where === 'back') {
      this.canvas.sendObjectToBack(o);
      const bg = this.backgroundLayer();
      if (bg) this.canvas.sendObjectToBack(bg); // o fundo continua embaixo de tudo
    }
    this.commit();
  }

  /** Sobe/desce uma camada uma posição (painel Camadas); o fundo continua embaixo de tudo. */
  moveLayer(o: FabricObject, dir: 'up' | 'down'): void {
    if (dir === 'up') this.canvas.bringObjectForward(o); else this.canvas.sendObjectBackwards(o);
    const bg = this.backgroundLayer();
    if (bg) this.canvas.sendObjectToBack(bg);
    this.commit();
  }

  /**
   * Trava/destrava uma camada (padrão: a selecionada). Travada = `locked` no JSON + não selecionável nem tocável: o toque
   * atravessa até o que está embaixo; destrava-se pelo painel Camadas.
   */
  toggleLock(target: FabricObject | undefined = this.active): boolean {
    if (!target || target.get('layerName') === BACKGROUND_LAYER) return false;
    const locked = !this.isLocked(target);
    if (locked && this.canvas.getActiveObject() === target) this.canvas.discardActiveObject();
    target.set('locked', locked);
    this.applyLock(target, locked);
    this.commit();
    return locked;
  }

  isLocked(o: FabricObject): boolean {
    return o.get('locked') === true;
  }

  private applyLock(o: FabricObject, locked: boolean): void {
    o.set({
      lockMovementX: locked, lockMovementY: locked, lockScalingX: locked, lockScalingY: locked, lockRotation: locked,
      hasControls: !locked, selectable: !locked, evented: !locked,
    });
  }

  /**
   * O Fabric não serializa selectable/evented/lock*: depois de todo loadFromJSON (abrir, undo/redo) reaplica a trava das
   * camadas `locked` e o não-selecionável da camada de fundo.
   */
  private syncLocks(): void {
    for (const o of this.canvas.getObjects()) {
      if (o.get('layerName') === BACKGROUND_LAYER) o.set({ selectable: false, evented: false, hoverCursor: 'default' });
      else if (this.isLocked(o)) this.applyLock(o, true);
    }
  }

  // ---------- agrupar ----------

  /** Junta a seleção múltipla (≥ 2) num Group no lugar do objeto mais alto da pilha. */
  groupActive(): Group | undefined {
    const sel = this.canvas.getActiveObject();
    if (!(sel instanceof ActiveSelection)) return undefined;
    const all = this.canvas.getObjects();
    const objs = sel.getObjects().slice().sort((a, b) => all.indexOf(a) - all.indexOf(b));
    if (objs.length < 2) return undefined;
    const top = all.indexOf(objs[objs.length - 1]);
    this.canvas.discardActiveObject(); // devolve as coordenadas de cena aos objetos
    // sem withoutHistory (async: o commit síncrono abaixo cairia com o contador ainda alto); o debounce de 250 ms do
    // instantâneo junta remover + inserir numa só entrada de undo
    for (const o of objs) this.canvas.remove(o);
    const group = new Group(objs, { originX: 'center', originY: 'center' });
    group.set({ layerName: 'Grupo' });
    this.canvas.insertAt(top - (objs.length - 1), group);
    this.canvas.setActiveObject(group);
    this.commit();
    return group;
  }

  /** Desfaz o Group selecionado (inclusive selos SVG): os filhos voltam no mesmo lugar e ficam selecionados. */
  ungroupActive(): FabricObject[] {
    const group = this.canvas.getActiveObject();
    if (!(group instanceof Group) || group instanceof ActiveSelection) return [];
    const index = this.canvas.getObjects().indexOf(group);
    this.canvas.discardActiveObject();
    const items = group.removeAll(); // _exitGroup aplica a matriz do grupo em cada filho (coordenadas de cena)
    this.canvas.remove(group);
    this.canvas.insertAt(index, ...items);
    for (const o of items) o.setCoords();
    if (items.length > 1) this.canvas.setActiveObject(new ActiveSelection(items, { canvas: this.canvas }));
    else if (items.length === 1) this.canvas.setActiveObject(items[0]);
    this.commit();
    return items;
  }

  // ---------- inspetor numérico ----------

  /** Caixa da camada na página: X/Y = canto superior esquerdo da caixa envolvente; L/A sem rotação nem contorno. */
  geometryOf(o: FabricObject | undefined = this.active): { x: number; y: number; width: number; height: number; angle: number } | undefined {
    if (!o) return undefined;
    o.setCoords();
    const r = o.getBoundingRect();
    return { x: r.left, y: r.top, width: o.width * o.scaleX, height: o.height * o.scaleY, angle: o.angle ?? 0 };
  }

  /** Valores exatos (px do documento, graus). Tamanho e ângulo mantêm o centro; X/Y movem a caixa envolvente. */
  setExactGeometry(g: { x?: number; y?: number; width?: number; height?: number; angle?: number },
    o: FabricObject | undefined = this.active): void {
    if (!o) return;
    const center = o.getCenterPoint();
    if (g.width !== undefined && o.width > 0) o.set('scaleX', Math.max(0.001, g.width / o.width));
    if (g.height !== undefined && o.height > 0) o.set('scaleY', Math.max(0.001, g.height / o.height));
    if (g.angle !== undefined) o.set('angle', ((((g.angle + 180) % 360) + 360) % 360) - 180);
    o.setPositionByOrigin(center, 'center', 'center');
    o.setCoords();
    if (g.x !== undefined || g.y !== undefined) {
      const r = o.getBoundingRect();
      o.set({ left: o.left + (g.x !== undefined ? g.x - r.left : 0), top: o.top + (g.y !== undefined ? g.y - r.top : 0) });
      o.setCoords();
    }
    this.commit();
  }

  flip(axis: 'x' | 'y'): void {
    const o = this.active;
    if (!o) return;
    if (axis === 'x') o.set('flipX', !o.flipX); else o.set('flipY', !o.flipY);
    this.commit();
  }

  centerActive(): void {
    const o = this.active;
    if (!o) return;
    o.setPositionByOrigin(new Point(this.docWidth / 2, this.docHeight / 2), 'center', 'center');
    o.setCoords();
    this.commit();
  }

  align(mode: 'left' | 'center-x' | 'right' | 'top' | 'center-y' | 'bottom'): void {
    const active = this.canvas.getActiveObject();
    if (!active) return;

    if (active.type === 'activeSelection') {
      const selection = active as ActiveSelection;
      const objs = selection.getObjects();
      if (objs.length === 0) return;

      const groupBBox = selection.getBoundingRect();
      this.canvas.discardActiveObject();

      for (const obj of objs) {
        const b = obj.getBoundingRect();
        let deltaX = 0;
        let deltaY = 0;
        switch (mode) {
          case 'left':
            deltaX = groupBBox.left - b.left;
            break;
          case 'center-x':
            deltaX = (groupBBox.left + groupBBox.width / 2) - (b.left + b.width / 2);
            break;
          case 'right':
            deltaX = (groupBBox.left + groupBBox.width) - (b.left + b.width);
            break;
          case 'top':
            deltaY = groupBBox.top - b.top;
            break;
          case 'center-y':
            deltaY = (groupBBox.top + groupBBox.height / 2) - (b.top + b.height / 2);
            break;
          case 'bottom':
            deltaY = (groupBBox.top + groupBBox.height) - (b.top + b.height);
            break;
        }
        if (deltaX !== 0 || deltaY !== 0) {
          obj.set({
            left: obj.left + deltaX,
            top: obj.top + deltaY,
          });
          obj.setCoords();
        }
      }

      const newSelection = new ActiveSelection(objs, { canvas: this.canvas });
      this.canvas.setActiveObject(newSelection);
    } else {
      const b = active.getBoundingRect();
      let deltaX = 0;
      let deltaY = 0;
      switch (mode) {
        case 'left':
          deltaX = 0 - b.left;
          break;
        case 'center-x':
          deltaX = this.docWidth / 2 - (b.left + b.width / 2);
          break;
        case 'right':
          deltaX = this.docWidth - (b.left + b.width);
          break;
        case 'top':
          deltaY = 0 - b.top;
          break;
        case 'center-y':
          deltaY = this.docHeight / 2 - (b.top + b.height / 2);
          break;
        case 'bottom':
          deltaY = this.docHeight - (b.top + b.height);
          break;
      }
      if (deltaX !== 0 || deltaY !== 0) {
        active.set({
          left: active.left + deltaX,
          top: active.top + deltaY,
        });
        active.setCoords();
      }
    }

    this.canvas.requestRenderAll();
    this.commit();
  }

  distribute(axis: 'horizontal' | 'vertical'): void {
    const active = this.canvas.getActiveObject();
    if (!active) return;

    let isSelection = false;
    let objs: FabricObject[] = [];
    if (active.type === 'activeSelection') {
      objs = [...(active as ActiveSelection).getObjects()];
      isSelection = true;
    } else {
      objs = this.canvas.getObjects().filter((o) => o.visible && o.get('layerName') !== BACKGROUND_LAYER && o.selectable);
    }

    if (objs.length < 2) return;

    if (isSelection) {
      this.canvas.discardActiveObject();
    }

    if (axis === 'horizontal') {
      objs.sort((a, b) => (a.getBoundingRect().left + a.getBoundingRect().width / 2) - (b.getBoundingRect().left + b.getBoundingRect().width / 2));
      const firstBBox = objs[0].getBoundingRect();
      const lastBBox = objs[objs.length - 1].getBoundingRect();
      const minX = firstBBox.left;
      const maxX = lastBBox.left + lastBBox.width;
      const totalObjWidth = objs.reduce((sum, o) => sum + o.getBoundingRect().width, 0);
      const totalGap = (maxX - minX) - totalObjWidth;
      const gap = totalGap / (objs.length - 1);

      let currentLeft = minX;
      for (const obj of objs) {
        const b = obj.getBoundingRect();
        const deltaX = currentLeft - b.left;
        obj.set('left', obj.left + deltaX);
        obj.setCoords();
        currentLeft += b.width + gap;
      }
    } else {
      objs.sort((a, b) => (a.getBoundingRect().top + a.getBoundingRect().height / 2) - (b.getBoundingRect().top + b.getBoundingRect().height / 2));
      const firstBBox = objs[0].getBoundingRect();
      const lastBBox = objs[objs.length - 1].getBoundingRect();
      const minY = firstBBox.top;
      const maxY = lastBBox.top + lastBBox.height;
      const totalObjHeight = objs.reduce((sum, o) => sum + o.getBoundingRect().height, 0);
      const totalGap = (maxY - minY) - totalObjHeight;
      const gap = totalGap / (objs.length - 1);

      let currentTop = minY;
      for (const obj of objs) {
        const b = obj.getBoundingRect();
        const deltaY = currentTop - b.top;
        obj.set('top', obj.top + deltaY);
        obj.setCoords();
        currentTop += b.height + gap;
      }
    }

    if (isSelection) {
      const newSelection = new ActiveSelection(objs, { canvas: this.canvas });
      this.canvas.setActiveObject(newSelection);
    }
    this.canvas.requestRenderAll();
    this.commit();
  }

  selectMultiple(objects: FabricObject[]): void {
    if (objects.length === 0) {
      this.canvas.discardActiveObject();
      this.canvas.requestRenderAll();
      return;
    }
    if (objects.length === 1) {
      this.canvas.setActiveObject(objects[0]);
      this.canvas.requestRenderAll();
      return;
    }
    const sel = new ActiveSelection(objects, { canvas: this.canvas });
    this.canvas.setActiveObject(sel);
    this.canvas.requestRenderAll();
  }

  set(props: Record<string, unknown>): void {
    const o = this.active;
    if (!o) return;
    // cor sólida escolhida: o degradê do usuário deixa de valer (senão o refresh o traria de volta)
    if (typeof props.fill === 'string' && !('customGradient' in props)) props = { ...props, customGradient: undefined };
    // idem a foto no texto (TASK-15): a marca órfã faria o "Remover foto" voltar a uma cor velha
    if (typeof props.fill === 'string' && !('textImageFill' in props)) props = { ...props, textImageFill: undefined };
    o.set(props);
    // tracejado acompanha a espessura (TASK-12)
    const dash = o.get('strokeDashStyle');
    if (typeof props.strokeWidth === 'number' && isDashStyle(dash) && dash !== 'solid') {
      o.set({ strokeDashArray: dashArrayFor(dash, props.strokeWidth) });
    }
    if ('getObjects' in o && typeof (o as { getObjects?: () => FabricObject[] }).getObjects === 'function') {
      const items = (o as { getObjects: () => FabricObject[] }).getObjects();
      if (props.fill !== undefined) {
        for (const item of items) {
          const f = item.fill;
          if (f && typeof f === 'string') {
            const lower = f.toLowerCase().trim();
            // Preserva elementos brancos/transparentes (como textos brancos e vazados em selos)
            if (lower !== '#ffffff' && lower !== '#fff' && lower !== 'white' && lower !== 'none' && lower !== 'transparent') {
              item.set({ fill: props.fill, brandColor: props.brandColor });
            }
          }
        }
      }
      if (props.stroke !== undefined) {
        for (const item of items) {
          const s = item.stroke;
          if (s && typeof s === 'string' && s !== 'none' && s !== 'transparent') {
            item.set({ stroke: props.stroke, brandStroke: props.brandStroke });
          }
        }
      }
    }
    if (o instanceof Textbox && Object.keys(props).some((k) => Textbox.textLayoutProperties.includes(k))) this.refitCurve(o);
    this.refreshGradient(o);
    o.setCoords();
    this.commit();
  }

  // ---------- degradê, contorno, cantos, troca de forma (TASK-12) ----------

  /** O degradê do usuário no objeto (`customGradient`), se o preenchimento ainda for ele. */
  gradientOf(o: FabricObject | undefined = this.active): GradientSpec | undefined {
    const spec = o?.get('customGradient');
    return o && isGradientSpec(spec) && o.fill instanceof Gradient ? spec : undefined;
  }

  /**
   * Preenche o objeto com o degradê (`null` volta à cor sólida `fallback`, padrão: 1ª parada). Grava `customGradient` e
   * zera `brandColor` (o brand kit não pode trocar o degradê por uma cor sólida).
   */
  setObjectGradient(spec: GradientSpec | null, target: FabricObject | undefined = this.active, fallback?: string): void {
    if (!target || !canHoldGradient(target)) return;
    if (spec) {
      const box = gradientBox(target);
      target.set({
        fill: buildFabricGradient(spec, box.width, box.height), customGradient: spec, brandColor: undefined, textImageFill: undefined,
      });
    } else {
      const current = target.get('customGradient');
      const color = fallback ?? (isGradientSpec(current) ? current.stops[0]?.color : undefined) ?? '#000000';
      target.set({ fill: color, customGradient: undefined, textImageFill: undefined });
    }
    target.setCoords();
    this.commit();
  }

  // ---------- foto no texto (TASK-15) ----------

  /** A marca da foto no texto, se o preenchimento ainda for o padrão dela. */
  textImageFillOf(o: FabricObject | undefined = this.active): TextImageFill | undefined {
    const mark = o?.get('textImageFill');
    return o && isTextImageFill(mark) && o.fill instanceof Pattern ? mark : undefined;
  }

  /**
   * Preenche o texto com a foto `url` em *cover* (`null` volta à cor sólida de antes). Espera a foto carregar antes do
   * `set` (o `Pattern.toLive` sem pixels some com o texto) e faz 1 passo do undo. Erro de carga rejeita sem mexer no texto.
   */
  async setTextImageFill(url: string | null, target: FabricObject | undefined = this.active): Promise<void> {
    if (!(target instanceof FabricText)) return;
    if (url === null) {
      const mark = this.textImageFillOf(target) ?? target.get('textImageFill');
      if (!isTextImageFill(mark) && !(target.fill instanceof Pattern)) return;
      target.set({ fill: isTextImageFill(mark) ? mark.fallback : '#000000', textImageFill: undefined });
      target.setCoords();
      this.commit();
      return;
    }
    const img = await util.loadImage(url);
    const box = gradientBox(target);
    const before = this.textImageFillOf(target);
    const spec = this.gradientOf(target);
    const fallback = before?.fallback ?? (typeof target.fill === 'string' ? target.fill : spec?.stops[0]?.color) ?? '#000000';
    const fill = new Pattern({
      source: img, repeat: 'no-repeat',
      patternTransform: coverPatternTransform(img.naturalWidth || img.width, img.naturalHeight || img.height, box.width, box.height),
    });
    const mark: TextImageFill = { src: url, fallback };
    target.set({ fill, textImageFill: mark, customGradient: undefined, brandColor: undefined });
    target.setCoords();
    this.commit();
  }

  /** Refaz as coordenadas do degradê do usuário quando a caixa local do objeto muda (texto, fundo, formato). */
  refreshGradient(o: FabricObject | undefined): void {
    // foto no texto: refaz o cover na caixa nova (TASK-15)
    if (o && this.textImageFillOf(o)) { refitTextImageFill(o); return; }
    if (!o || !(o.fill instanceof Gradient)) return;
    const spec = o.get('customGradient');
    if (!isGradientSpec(spec)) return;
    const box = gradientBox(o);
    o.set('fill', buildFabricGradient(spec, box.width, box.height));
  }

  /** Borda sólida/tracejada/pontilhada; sem contorno, liga um de espessura visível. Conector: muda a linha. */
  setStrokeDash(style: DashStyle, target: FabricObject | undefined = this.active): void {
    if (!target) return;
    if (this.connectorOf(target)) { this.setConnector({ dash: style }, target); return; }
    if (target instanceof Group) return;
    const props: Record<string, unknown> = { strokeDashStyle: style === 'solid' ? undefined : style };
    let sw = target.strokeWidth ?? 0;
    if (style !== 'solid' && (!target.stroke || sw <= 0)) {
      sw = Math.max(2, Math.round(Math.min(this.docWidth, this.docHeight) * 0.004));
      props.strokeWidth = sw;
      if (!target.stroke || target.stroke === 'transparent') props.stroke = '#222222';
    }
    props.strokeDashArray = dashArrayFor(style, sw);
    props.strokeLineCap = style === 'solid' ? 'butt' : 'round';
    target.set(props);
    target.setCoords();
    this.commit();
  }

  dashStyleOf(o: FabricObject | undefined = this.active): DashStyle {
    if (!o) return 'solid';
    const c = this.connectorOf(o);
    if (c) return c.dash;
    const d = o.get('strokeDashStyle');
    return isDashStyle(d) ? d : 'solid';
  }

  /** Maior raio de canto de um Rect (pílula). */
  maxCornerRadius(o: FabricObject | undefined = this.active): number {
    return o instanceof Rect ? Math.min(o.width, o.height) / 2 : 0;
  }

  /** Raio de canto (`rx` = `ry`) do retângulo selecionado, preso em 0..min(w, h)/2. */
  setCornerRadius(r: number, target: FabricObject | undefined = this.active): void {
    if (!(target instanceof Rect) || target.get('layerName') === BACKGROUND_LAYER) return;
    const v = Math.max(0, Math.min(r, this.maxCornerRadius(target)));
    target.set({ rx: v, ry: v });
    this.commit();
  }

  /** O tipo de forma do objeto (para o "🔄 Trocar forma"), ou undefined se não for forma trocável. */
  shapeKindOf(o: FabricObject | undefined = this.active): ShapeKind | undefined {
    if (!o || o instanceof Group || o instanceof FabricText || o instanceof FabricImage || o instanceof Line) return undefined;
    if (o.get('layerName') === BACKGROUND_LAYER) return undefined;
    const k = o.get('shapeKind');
    if (typeof k === 'string' && (SWAP_KINDS as string[]).includes(k)) return k as ShapeKind;
    if (o instanceof Rect) return (o.rx ?? 0) > 0 ? 'rounded' : 'rect';
    if (o instanceof Circle) return 'circle';
    if (o instanceof Triangle) return 'triangle';
    if (o instanceof Polygon) return 'star';
    return undefined;
  }

  /**
   * Troca a forma selecionada por outra do mesmo tamanho na página, no mesmo lugar da pilha, preservando centro, ângulo,
   * espelhamento, preenchimento (sólido ou degradê), contorno (inclusive tracejado), sombra, opacidade e metadados.
   */
  swapShape(newKind: ShapeKind, target: FabricObject | undefined = this.active): FabricObject | undefined {
    if (!target || !this.shapeKindOf(target) || !SWAP_KINDS.includes(newKind)) return undefined;
    const W = target.width * target.scaleX, H = target.height * target.scaleY;
    const center = target.getCenterPoint();
    const spec = this.gradientOf(target);
    let n: FabricObject;
    if (newKind === 'rect' || newKind === 'rounded' || newKind === 'pill') {
      // retângulos no tamanho exato (escala 1): o raio do canto não se deforma
      const r = newKind === 'rect' ? 0 : newKind === 'pill' ? Math.min(W, H) / 2 : Math.min(W, H) * 0.17;
      n = new Rect({ width: W, height: H, rx: r, ry: r, fill: '#000000' });
    } else {
      n = makeShape(newKind, '#000000', Math.max(W, H));
      n.set({ scaleX: W / n.width, scaleY: H / n.height });
    }
    const copy: Record<string, unknown> = {};
    for (const k of ['angle', 'flipX', 'flipY', 'opacity', 'shadow', 'stroke', 'strokeWidth', 'strokeDashArray', 'strokeLineCap',
      'strokeDashStyle', 'brandColor', 'brandStroke', 'layerName', 'animation', 'visible']) copy[k] = target.get(k);
    n.set({ ...copy, shapeKind: newKind, originX: 'center', originY: 'center' });
    if (spec) {
      const box = gradientBox(n);
      n.set({ fill: buildFabricGradient(spec, box.width, box.height), customGradient: spec });
    } else n.set({ fill: target.fill });
    n.setPositionByOrigin(center, 'center', 'center');
    n.setCoords();
    this.replaceObject(target, n);
    this.canvas.setActiveObject(n);
    this.commit();
    return n;
  }

  /** Põe `n` no lugar de `old` na pilha (sem passar a seleção). */
  private replaceObject(old: FabricObject, n: FabricObject): void {
    const index = this.canvas.getObjects().indexOf(old);
    if (this.canvas.getActiveObject() === old) this.canvas.discardActiveObject();
    this.canvas.remove(old);
    this.canvas.insertAt(Math.max(0, index), n);
  }

  // ---------- Pathfinder: operações booleanas de formas (TASK-16) ----------

  /** Formas da seleção múltipla que o Pathfinder combina, na ordem da pilha: a 1ª (a mais de baixo) é a base. */
  booleanCandidates(sel: FabricObject | undefined = this.active): FabricObject[] {
    if (!(sel instanceof ActiveSelection)) return [];
    const all = this.canvas.getObjects();
    return sel.getObjects().filter(isBooleanCandidate).sort((a, b) => all.indexOf(a) - all.indexOf(b));
  }

  /**
   * Combina as formas da seleção (≥ 2) num só `Path` vetorial com `fillRule: 'evenodd'`: `union`, `subtract` (base −
   * as demais), `intersect` e `exclude` (vazado/XOR). O resultado é calculado ANTES de mexer no canvas: exceção ou
   * resultado vazio deixam a página intacta (vazio devolve `undefined`). O `Path` herda o estilo da base e entra no
   * lugar dela na pilha; o debounce do instantâneo junta remover + inserir num passo só do undo.
   */
  applyBooleanOp(op: BooleanOp): Path | undefined {
    const objs = this.booleanCandidates();
    if (objs.length < 2) return undefined;
    // seleção ainda ativa: o calcTransformMatrix de cada forma inclui a matriz da ActiveSelection (página)
    const rings = booleanRegions(objs.map((o) => shapeRegion(o)), op);
    if (rings.length === 0 || ringsArea(rings) < MIN_RESULT_AREA) return undefined;
    const base = objs[0];
    // sem left/top e com origem center, o Path se posiciona pelo próprio pathOffset: desenha nas coordenadas de página
    const n = new Path(ringsToPathD(rings), { originX: 'center', originY: 'center', fillRule: 'evenodd' });
    const copy: Record<string, unknown> = {};
    // a lista do swapShape, sem angle/flip (o resultado já está na página) + a mesclagem (TASK-07)
    for (const k of ['opacity', 'shadow', 'stroke', 'strokeWidth', 'strokeDashArray', 'strokeLineCap', 'strokeDashStyle', 'brandColor',
      'brandStroke', 'animation', 'visible', 'globalCompositeOperation']) copy[k] = base.get(k);
    n.set({ ...copy, layerName: 'Forma combinada' });
    const spec = this.gradientOf(base);
    if (spec) {
      const box = gradientBox(n);
      n.set({ fill: buildFabricGradient(spec, box.width, box.height), customGradient: spec });
    } else n.set({ fill: base.fill });
    n.setCoords();
    const index = this.canvas.getObjects().indexOf(base);
    this.canvas.discardActiveObject();
    for (const o of objs) this.canvas.remove(o);
    this.canvas.insertAt(Math.max(0, index), n);
    this.canvas.setActiveObject(n);
    this.commit();
    return n;
  }

  // ---------- conectores e infográfico "Raio-X" (TASK-12) ----------

  connectorOf(o: FabricObject | undefined = this.active): ConnectorSpec | undefined {
    const spec = o?.get('connectorSpec');
    return o instanceof Group && isConnectorSpec(spec) ? spec : undefined;
  }

  /** Linha/seta/cota paramétrica no centro da página (ou com os pontos deslocados por `at`, coordenadas da página). */
  addConnector(spec: ConnectorSpec, at?: { x: number; y: number }, name = 'Seta'): Group {
    const g = buildConnector(spec, at ?? { x: 0, y: 0 });
    g.set({ layerName: name });
    if (!at) this.center(g);
    g.setCoords();
    this.add(g);
    return g;
  }

  /**
   * Muda a linha (pontas, formato, cor, espessura, tracejado): refaz o Group no mesmo lugar (os pontos da linha não se
   * mexem na página), sem avisar a interface (os controles do painel continuam vivos durante o arrasto).
   */
  setConnector(patch: Partial<ConnectorSpec>, target: FabricObject | undefined = this.active): Group | undefined {
    const old = this.connectorOf(target);
    if (!old || !(target instanceof Group)) return undefined;
    const spec: ConnectorSpec = { ...old, ...patch };
    // centro dos dois grupos no espaço local (sem transformação) → onde o novo centro cai na página
    const ref = buildConnector(old, { x: 0, y: 0 }).getCenterPoint();
    const n = buildConnector(spec, { x: 0, y: 0 });
    const delta = n.getCenterPoint().subtract(ref);
    const m = util.composeMatrix({ angle: target.angle, scaleX: target.scaleX, scaleY: target.scaleY, flipX: target.flipX, flipY: target.flipY });
    const center = target.getCenterPoint().add(util.transformPoint(delta, m));
    const copy: Record<string, unknown> = {};
    for (const k of ['angle', 'scaleX', 'scaleY', 'flipX', 'flipY', 'opacity', 'shadow', 'layerName', 'animation', 'visible']) copy[k] = target.get(k);
    n.set(copy);
    n.setPositionByOrigin(center, 'center', 'center');
    n.setCoords();
    const wasActive = this.canvas.getActiveObject() === target;
    this.silently(() => {
      this.replaceObject(target, n);
      if (wasActive) this.canvas.setActiveObject(n);
    });
    this.commit();
    return n;
  }

  // ---------- QR Code e tabela (TASK-05) ----------

  qrConfigOf(o: FabricObject | undefined = this.active): QrConfig | undefined {
    const c = o?.get('qrConfig');
    return o instanceof Group && isQrConfig(c) ? c : undefined;
  }

  tableDataOf(o: FabricObject | undefined = this.active): TableData | undefined {
    const d = o?.get('tableData');
    return o instanceof Group && isTableData(d) ? d : undefined;
  }

  /**
   * Insere o QR Code (sem `existing`: centrado, 35% do menor lado da página) ou o refaz no lugar de `existing`: mesmo
   * centro, mesma largura exibida (a versão — e portanto a largura em módulos — pode mudar), mesmo ângulo, espelhamento,
   * opacidade, sombra, animação e índice na pilha, com uma só entrada de undo. Texto que não cabe → `QrTooLongError`.
   */
  async upsertQrCode(config: QrConfig, existing?: FabricObject, opts: { logoUrl?: string; font?: string } = {}): Promise<Group> {
    const g = await this.buildQrGroup(config, opts.logoUrl, opts.font ?? 'Montserrat');
    if (!existing) {
      const s = (Math.min(this.docWidth, this.docHeight) * 0.35) / g.width;
      g.set({ scaleX: s, scaleY: s });
      this.add(this.center(g));
      return g;
    }
    const sx = (existing.width * existing.scaleX) / g.width;
    this.replaceInPlace(existing, g, { scaleX: sx, scaleY: sx * (existing.scaleY / existing.scaleX) },
      () => g.setPositionByOrigin(existing.getCenterPoint(), 'center', 'center'));
    return g;
  }

  /** Group do QR: fundo + módulos + localizadores (do SVG), a legenda e o logo da marca (`brandLogo`) no buraco central. */
  private async buildQrGroup(config: QrConfig, logoUrl: string | undefined, font: string): Promise<Group> {
    const m = encodeQr(config.payload, { ecc: config.ecc });
    const label = config.label?.trim() || undefined;
    const svgOpts = { dotStyle: config.dotStyle, eyeStyle: config.eyeStyle, fg: config.fgColor, bg: config.bgColor, logoHole: config.withLogo, label };
    const { objects } = await loadSVGFromString(qrSvg(m, { ...svgOpts, labelFont: font }));
    // a legenda é refeita aqui: o FabricText do parser posiciona pelo text-anchor com a fonte ainda não medida
    const items = objects.filter((o): o is FabricObject => o !== null && !(o instanceof FabricText));
    const lay = qrLayout(m.size, svgOpts);
    if (lay.label && label) {
      await ensureFonts([font]);
      const opts = { fontFamily: font, fontWeight: 700, fill: config.bgColor, originX: 'center' as const, originY: 'center' as const,
        left: lay.width / 2, top: lay.label.y + lay.label.h / 2 };
      let t = new FabricText(label, { ...opts, fontSize: lay.label.fontSize });
      const maxW = lay.width * 0.9;
      if (t.width > maxW) t = new FabricText(label, { ...opts, fontSize: Math.max(4, (lay.label.fontSize * maxW) / t.width) });
      items.push(t);
    }
    if (config.withLogo && lay.hole && logoUrl) {
      try {
        const img = await FabricImage.fromURL(logoUrl);
        const box = lay.hole.w * 0.88;
        const s = Math.min(box / img.width, box / img.height);
        img.set({ scaleX: s, scaleY: s, originX: 'center', originY: 'center', left: lay.hole.x + lay.hole.w / 2,
          top: lay.hole.y + lay.hole.w / 2, brandLogo: true });
        items.push(img);
      } catch (e) {
        console.warn('logo do QR', e); // o buraco fica vazio; com correção H o código continua legível
      }
    }
    const g = new Group(items, { originX: 'center', originY: 'center' });
    g.set({ layerName: 'QR Code', qrConfig: structuredClone(config) });
    return g;
  }

  /**
   * Insere a tabela (sem `existing`: centrada, no máximo 80% da página) ou a refaz no lugar de `existing` com o mesmo canto
   * superior esquerdo, escala, ângulo e índice na pilha (as colunas podem mudar de largura), numa só entrada de undo.
   */
  async upsertTable(data: TableData, existing?: FabricObject): Promise<Group> {
    await ensureFonts([data.fontFamily]);
    const g = buildTable(data, measureText);
    g.set({ layerName: 'Tabela', tableData: structuredClone(data) });
    if (!existing) {
      const s = Math.min(1, (this.docWidth * 0.8) / g.width, (this.docHeight * 0.8) / g.height);
      g.set({ scaleX: s, scaleY: s });
      this.add(this.center(g));
      return g;
    }
    const corner = existing.getPointByOrigin('left', 'top');
    this.replaceInPlace(existing, g, { scaleX: existing.scaleX, scaleY: existing.scaleY },
      () => g.setPositionByOrigin(corner, 'left', 'top'));
    return g;
  }

  /** Troca `old` por `n` no mesmo índice copiando a aparência; `place` posiciona `n` já com a escala e o ângulo finais. */
  private replaceInPlace(old: FabricObject, n: FabricObject, scale: { scaleX: number; scaleY: number }, place: () => void): void {
    const copy: Record<string, unknown> = {};
    for (const k of ['angle', 'flipX', 'flipY', 'opacity', 'shadow', 'layerName', 'animation', 'visible']) copy[k] = old.get(k);
    n.set({ ...copy, ...scale });
    place();
    n.setCoords();
    const wasActive = this.canvas.getActiveObject() === old;
    this.silently(() => {
      this.replaceObject(old, n);
      if (wasActive) this.canvas.setActiveObject(n);
    });
    this.commit();
  }

  /** Executa sem chamar `onSelection` (trocas internas do objeto selecionado). */
  private silently<T>(fn: () => T): T {
    const cb = this.onSelection;
    this.onSelection = () => {};
    try { return fn(); } finally { this.onSelection = cb; }
  }

  /**
   * Blocos prontos de infográfico. As peças entram soltas (o texto continua editável por toque longo) e ficam selecionadas
   * juntas; "🔗 Agrupar" junta de vez.
   */
  addCallout(kind: CalloutKind, color: string, fontFamily: string): FabricObject[] {
    const m = Math.min(this.docWidth, this.docHeight);
    const cx = this.docWidth / 2, cy = this.docHeight / 2;
    const w = Math.max(3, Math.round(m * 0.005));
    const base = { color, width: w, dash: 'solid' as DashStyle };
    const label = (text: string, left: number, top: number, originX: 'left' | 'center', name: string) => new Textbox(text, {
      fontFamily, fontSize: Math.round(m * 0.045), fontWeight: 700, fill: '#222222', textAlign: originX, width: m * 0.4,
      left, top, originX, originY: 'center', layerName: name, brandFont: 'heading',
    });
    const items: FabricObject[] = [];
    switch (kind) {
      case 'pin': {
        // texto à direita do início; a linha vai para a esquerda e desce até o pino (anel + ponto) no produto
        const spec: ConnectorSpec = { ...base, x1: m * 0.3, y1: 0, x2: 0, y2: m * 0.2, shape: 'elbow', startCap: 'none', endCap: 'ring' };
        const at = { x: cx - m * 0.25, y: cy - m * 0.1 };
        items.push(buildConnector(spec, at).set({ layerName: 'Raio-X: pino' }));
        items.push(label('Aço Inox 304', at.x + m * 0.32, at.y, 'left', 'Raio-X: texto'));
        break;
      }
      case 'dimension': {
        const spec: ConnectorSpec = { ...base, x1: 0, y1: 0, x2: m * 0.6, y2: 0, shape: 'straight', startCap: 'bar', endCap: 'bar' };
        items.push(buildConnector(spec, { x: cx - m * 0.3, y: cy }).set({ layerName: 'Cota: linha' }));
        items.push(label('25 cm', cx, cy - m * 0.05, 'center', 'Cota: medida'));
        break;
      }
      case 'zoom': {
        const r = m * 0.13;
        const ring = new Circle({ radius: r, fill: '', stroke: color, strokeWidth: Math.max(4, Math.round(m * 0.009)),
          left: cx + m * 0.12, top: cy - m * 0.1, originX: 'center', originY: 'center', layerName: 'Lupa: círculo' });
        // a linha sai da borda do círculo (embaixo, à esquerda) e termina num ponto no detalhe
        const a = (135 * Math.PI) / 180;
        const start = { x: ring.left + Math.cos(a) * r, y: ring.top + Math.sin(a) * r };
        const spec: ConnectorSpec = { ...base, x1: 0, y1: 0, x2: -m * 0.18, y2: m * 0.18, shape: 'straight', startCap: 'none', endCap: 'dot' };
        items.push(ring, buildConnector(spec, start).set({ layerName: 'Lupa: linha' }));
        break;
      }
      case 'curved-arrow': {
        const spec: ConnectorSpec = { ...base, width: Math.max(4, Math.round(m * 0.009)), x1: 0, y1: 0, x2: m * 0.45, y2: m * 0.2,
          shape: 'curve', startCap: 'none', endCap: 'arrow', bend: 0.3 };
        items.push(buildConnector(spec, { x: cx - m * 0.22, y: cy - m * 0.1 }).set({ layerName: 'Seta curva' }));
        break;
      }
    }
    for (const o of items) { o.setCoords(); this.canvas.add(o); }
    this.selectMultiple(items);
    this.commit();
    return items;
  }

  // ---------- texto ----------

  setShadow(options: boolean | ShadowOptions | null, colorFallback = 'rgba(0,0,0,0.45)'): void {
    const o = this.active;
    if (!o) return;
    if (options === false || options === null) {
      o.set('shadow', null);
    } else if (options === true) {
      const m = Math.min(this.docWidth, this.docHeight);
      o.set('shadow', new Shadow({ color: colorFallback, blur: m * 0.012, offsetX: m * 0.006, offsetY: m * 0.006 }));
    } else {
      o.set('shadow', new Shadow({
        color: options.color ?? colorFallback,
        blur: options.blur ?? 0,
        offsetX: options.offsetX ?? 0,
        offsetY: options.offsetY ?? 0,
      }));
    }
    o.setCoords();
    this.canvas.requestRenderAll();
    this.commit();
  }

  /** Curva o texto num arco; amount em -100..100 (0 = reto). */
  setCurve(amount: number): void {
    const t = this.active;
    if (!(t instanceof Textbox)) return;
    this.setWarp('arc', amount, Number(t.get('warpDistortH') ?? 0), Number(t.get('warpDistortV') ?? 0));
  }

  /** Aplica um dos 14 estilos de deformação (Text Warp) ao texto selecionado. */
  setWarp(style: WarpStyle, bend = 50, distortH = 0, distortV = 0): void {
    const t = this.active;
    if (!(t instanceof Textbox)) return;
    t.set({
      warpStyle: style,
      warpBend: bend,
      warpDistortH: distortH,
      warpDistortV: distortV,
      curve: style === 'arc' ? bend : (style === 'none' ? 0 : Number(t.get('curve') ?? 0)),
    });
    this.refitCurve(t);
    this.canvas.requestRenderAll();
    this.commit();
  }

  /** Alterna ciclicamente a caixa do texto (MAIÚSCULAS -> minúsculas -> Título). */
  cycleTextCase(target?: FabricText): void {
    const t = (target ?? this.active) as FabricText;
    if (!(t instanceof FabricText)) return;
    const current = t.text ?? '';
    const next = cycleTextCaseHelper(current);
    if (next !== current) {
      t.set({ text: next });
      if (t instanceof Textbox) this.refitCurve(t);
      t.setCoords();
      this.canvas.requestRenderAll();
      this.commit();
    }
  }

  // ---------- listas e localizar/substituir (TASK-14) ----------

  /** Estilo de lista do texto (`'mixed'` se as linhas divergem), ou undefined se não for texto. */
  listStyleOf(target: FabricObject | undefined = this.active): ListStyle | 'mixed' | undefined {
    return target instanceof FabricText ? detectListStyle(target.text ?? '') : undefined;
  }

  /** "☰ Lista": aplica o estilo em cada linha (ou o remove, se todas já o têm); devolve o estilo resultante. */
  applyListStyle(style: ListStyle, target: FabricObject | undefined = this.active): ListStyle | 'mixed' | undefined {
    if (!(target instanceof FabricText)) return undefined;
    const next = toggleListStyle(target.text ?? '', style);
    if (next !== target.text) {
      this.setTextContent(target, next);
      this.commit();
    }
    return detectListStyle(next);
  }

  /** Troca o texto como a edição faz (curva, degradê, caixa) e refaz a caixa dos grupos que o contêm. Sem commit. */
  private setTextContent(t: FabricText, text: string): void {
    t.set({ text });
    this.refitCurve(t);
    this.refreshGradient(t);
    t.setCoords();
    // `parent` é o Group real mesmo com o texto numa ActiveSelection; o Fabric não refaz a caixa do grupo sozinho
    for (let g = t.parent; g; g = g.parent) { g.triggerLayout(); g.setCoords(); }
  }

  /** Camadas de texto do anúncio, inclusive dentro de grupos (selos, agrupados), de baixo para cima. */
  textLayers(): FabricText[] {
    // QR Code e tabela ficam de fora: o texto deles vem de `qrConfig`/`tableData` e se edita pelo "✏️ Editar…" (TASK-05)
    const objects = this.canvas.getObjects().filter((o) => !this.qrConfigOf(o) && !this.tableDataOf(o));
    return collectTextLayers(objects).filter((o): o is FabricText => o instanceof FabricText);
  }

  /** Camadas que contêm `find` e quantas vezes. */
  findTextMatches(find: string, matchCase = false): { layer: FabricText; count: number }[] {
    return this.textLayers()
      .map((layer) => ({ layer, count: countMatches(layer.text ?? '', find, matchCase) }))
      .filter((m) => m.count > 0);
  }

  /**
   * Substitui em todas as camadas de texto (ou só em `only`) com **um** instantâneo de undo. Camada que ficaria sem texto
   * (sem caixa para tocar) não é alterada e conta em `skipped`.
   */
  findAndReplaceAll(find: string, replace: string, matchCase = false, only?: FabricText[]): { matches: number; layers: number; skipped: number } {
    const result = { matches: 0, layers: 0, skipped: 0 };
    if (!find) return result;
    // a caixa de uma seleção múltipla ficaria velha com textos de outro tamanho
    if (this.canvas.getActiveObject() instanceof ActiveSelection) this.canvas.discardActiveObject();
    for (const t of only ?? this.textLayers()) {
      const r = findAndReplaceInText(t.text ?? '', find, replace, matchCase);
      if (!r.count) continue;
      if (!r.text.trim()) { result.skipped++; continue; }
      this.setTextContent(t, r.text);
      result.matches += r.count;
      result.layers++;
    }
    if (result.layers) this.commit();
    return result;
  }

  /**
   * Refaz o arco ou deformação de um texto curvo com a largura atual do texto. O Fabric roda `initDimensions` a cada mudança de
   * layout (fonte, tamanho, texto, largura) e no `loadFromJSON`. Sem commit: quem chama já registra a mudança.
   */
  refitCurve(t: FabricObject): void {
    if (!(t instanceof Textbox)) return;
    let style = (t.get('warpStyle') as WarpStyle | undefined) ?? 'none';
    let bend = Number(t.get('warpBend') ?? 0);
    const legacyCurve = Number(t.get('curve') ?? 0);

    // Retrocompatibilidade total (§2.3 / §85): se curve !== 0 e !warpStyle, tratar como arc
    if ((!t.get('warpStyle') || style === 'none') && Math.abs(legacyCurve) >= 1) {
      style = 'arc';
      bend = legacyCurve;
      t.set('warpStyle', 'arc');
      t.set('warpBend', bend);
    }

    // no plano do pai (o mesmo do setPositionByOrigin abaixo): o getCenterPoint é de cena e, com o texto num Group,
    // o deslocava pelo centro do grupo (TASK-14, localizar/substituir em selos/agrupados)
    const center = t.getRelativeCenterPoint();

    if (isPathWarp(style) && Math.abs(bend) >= 1) {
      const pathResult = curvePath(style, t.calcTextWidth(), bend);
      if (!pathResult) {
        t.set({ path: undefined });
      } else {
        t.set({
          path: new Path(pathResult.d, { visible: false, fill: '', stroke: '' }),
          pathAlign: 'center',
          pathSide: 'left',
        });
      }
      t.initDimensions();
      if (pathResult) t.set('height', pathResult.sagitta + t.getHeightOfLine(0));
    } else if (isEnvelopeWarp(style) && Math.abs(bend) >= 1) {
      t.set({ path: undefined });
      t.initDimensions();
      const factor = 1 + (Math.abs(bend) / 100) * 0.6;
      t.set('height', t.height * factor);
    } else {
      t.set({ path: undefined });
      t.initDimensions();
    }
    t.setPositionByOrigin(center, 'center', 'center');
    t.setCoords();
  }

  private refitCurves(): void {
    for (const o of this.canvas.getObjects()) this.refitCurve(o);
  }

  // ---------- imagem ----------

  activeImage(): FabricImage | undefined {
    const o = this.active;
    return o instanceof FabricImage ? o : undefined;
  }

  imageSrc(img: FabricImage): string {
    return img.getSrc(false);
  }

  applyFilters(img: FabricImage, preset: FilterPreset, adj: Adjustments): void {
    const list: FabricImage['filters'] = [];
    const p = {
      grayscale: () => new filters.Grayscale(),
      sepia: () => new filters.Sepia(),
      vintage: () => new filters.Vintage(),
      polaroid: () => new filters.Polaroid(),
      kodachrome: () => new filters.Kodachrome(),
      invert: () => new filters.Invert(),
    } as const;
    if (preset !== 'none') list.push(p[preset]());
    if (adj.brightness) list.push(new filters.Brightness({ brightness: adj.brightness }));
    if (adj.contrast) list.push(new filters.Contrast({ contrast: adj.contrast }));
    if (adj.saturation) list.push(new filters.Saturation({ saturation: adj.saturation }));
    // TASK-07, ordem fixa: temperatura → duotone → nitidez → desfoque. Convolute com `opaque: false` (o padrão): o
    // shader GL `Convolute_3_1` (opaque) do Fabric 7.4.0 não compila em GLSL ES 1.0 (`w - 1`) [[task-07-filtros-efeitos-avancados-blend-modes-e-retoque-borda]]
    if (adj.warmth) list.push(new filters.ColorMatrix({ matrix: warmthMatrix(adj.warmth) }));
    const duo = adj.duotone ? duotoneMatrix(adj.duotone.shadow, adj.duotone.highlight) : null;
    if (duo) list.push(new filters.ColorMatrix({ matrix: duo }));
    if (adj.sharpen) list.push(new filters.Convolute({ matrix: sharpenKernel(adj.sharpen), opaque: false }));
    if (adj.blur) list.push(new filters.Blur({ blur: adj.blur }));
    // TASK-17, depois do desfoque (que não deve borrar a vinheta nem espalhar o alfa da borda), sobre a parte visível.
    // O foco ligado fica na lista mesmo com intensidade 0 (neutro: o Fabric o pula no render) para a folha relê-lo.
    const region = this.filterRegion(img);
    if (adj.focus) list.push(new FocusBlur({ ...adj.focus, ...region }));
    if (adj.vignette) list.push(new Vignette({ vignette: adj.vignette, ...region }));
    if (adj.softEdge) list.push(new SoftEdge({ softEdge: adj.softEdge, ...region }));
    img.filters = list;
    img.applyFilters();
    img.set('filterPreset', preset);
    // o que a folha relê (os dois ColorMatrix não se distinguem por `type`); some do JSON quando tudo zera
    img.set('filterAdjust', compactFilterAdjust({ sharpen: adj.sharpen, warmth: adj.warmth, duotone: duo ? adj.duotone : undefined }));
    this.commit();
  }

  /** Parte visível da imagem (o recorte), 0..1 do tamanho natural: a área da vinheta, da borda suave e do foco. */
  filterRegion(img: FabricImage): ImageRegion {
    const { width, height } = img.getOriginalSize();
    return visibleRegion(img, width, height);
  }

  /** Leva o recorte atual aos filtros que dependem da região e refiltra se algum mudou (não faz `commit`). */
  private refreshFilterRegion(img: FabricImage): boolean {
    const region = this.filterRegion(img);
    let changed = false;
    for (const f of img.filters) {
      if (!isRegionFilter(f)) continue;
      if (f.x0 !== region.x0 || f.y0 !== region.y0 || f.x1 !== region.x1 || f.y1 !== region.y1) {
        Object.assign(f, region);
        changed = true;
      }
    }
    return changed;
  }

  /** Troca os pixels mantendo posição/escala (resultado das ações de IA, mesmo tamanho). */
  /**
   * Troca a fonte da imagem mantendo recorte e tamanho na tela; o fator vem da razão entre os tamanhos naturais
   * (×2/×4 no upscale, 1 nas ações de mesmo tamanho — §20.7).
   */
  async replaceImage(img: FabricImage, url: string): Promise<void> {
    const keepFilters = img.filters;
    const before = img.getOriginalSize();
    const geometry = { width: img.width, height: img.height, scaleX: img.scaleX, scaleY: img.scaleY, cropX: img.cropX, cropY: img.cropY };
    await img.setSrc(url);
    const after = img.getOriginalSize();
    if (before.width > 0 && before.height > 0) {
      img.set(rescaledGeometry(geometry, after.width / before.width, after.height / before.height));
    }
    img.filters = keepFilters;
    if (keepFilters.length) img.applyFilters();
    // a caixa na página é a mesma, as unidades locais não (upscale ×2/×4): a moldura é regerada (TASK-06)
    refreshFrame(img, FramePath);
    img.setCoords();
    this.commit();
  }

  /**
   * Troca a foto mantendo o espaço na página (caixa, centro), rotação, espelho, opacidade, sombra e filtros. `contain`
   * mostra a foto inteira (produto recortado); `cover` preenche o espaço recortando o excesso (cenário). Foto
   * emoldurada (TASK-06): preenche a moldura com o zoom/posição internos guardados — a caixa na página não muda.
   */
  async swapImage(img: FabricImage, url: string, fitMode: FitMode = 'contain', opts: { brandLogo?: boolean } = {}): Promise<void> {
    const slotW = img.width * img.scaleX;
    const slotH = img.height * img.scaleY;
    const center = img.getCenterPoint();
    const keep = { angle: img.angle, flipX: img.flipX, flipY: img.flipY, opacity: img.opacity, shadow: img.shadow, clipPath: img.clipPath };
    const keepFilters = img.filters;
    const frame = this.frameOf(img);
    await img.setSrc(url);
    const { width: nw, height: nh } = img.getOriginalSize();
    if (nw > 0 && nh > 0) {
      img.set(frame ? framedGeometry(slotW, slotH, nw, nh, frame.scale, frame.offsetX, frame.offsetY) : fitSlot(slotW, slotH, nw, nh, fitMode));
    }
    // a foto nova não é o recorte da antiga: o "➕ Restaurar original" do retoque não vale mais (TASK-18)
    img.set({ ...keep, brandLogo: opts.brandLogo ? true : undefined, filterPreset: img.get('filterPreset'), originalSrcBeforeCutout: undefined });
    img.setPositionByOrigin(center, 'center', 'center');
    img.filters = keepFilters;
    this.refreshFilterRegion(img); // `cover` recorta: vinheta/borda/foco seguem a parte visível nova
    if (keepFilters.length) img.applyFilters();
    // o clipPath guardado no `keep` está nas unidades locais da foto antiga: regerado para a caixa (TASK-06)
    refreshFrame(img, FramePath);
    img.setCoords();
    this.commit();
  }

  // ---------- 🖼️ moldura de recorte (TASK-06) ----------

  /** Moldura da imagem (ou `null`); zoom/posição relidos da geometria (o Recortar manual também os muda). */
  frameOf(img: FabricImage): FrameSpec | null {
    const spec = frameSpecOf(img);
    return spec ? { ...spec, ...currentFraming(img) } : null;
  }

  /**
   * Põe, muda ou tira (`kind: 'none'`) a moldura. Zoom/posição na mudança mexem no recorte mantendo a caixa e o centro
   * na página; a forma e o aro só regeram o `clipPath`. Um passo do undo por chamada (o `commit` agrupa os sliders).
   */
  setImageFrame(img: FabricImage, patch: Partial<Omit<FrameSpec, 'kind'>> & { kind?: FrameSpec['kind'] | 'none' }): void {
    if (patch.kind === 'none') {
      if (!frameSpecOf(img)) return;
      img.set({ ...frameProps(null), clipPath: undefined });
    } else {
      const cur = this.frameOf(img);
      const kind = patch.kind ?? cur?.kind;
      if (!kind) return;
      const next: FrameSpec = {
        stroke: '#ffffff', strokeWidth: 0, ...(cur ?? currentFraming(img)), ...patch, kind,
      };
      if (patch.scale !== undefined || patch.offsetX !== undefined || patch.offsetY !== undefined) {
        applyFraming(img, next.scale, next.offsetX, next.offsetY);
        if (this.refreshFilterRegion(img)) img.applyFilters();
      }
      // `frameSpecOf` prende os valores nas faixas (zoom 1..3, posição −1..1, aro 0..40)
      img.set(frameProps(frameSpecOf(frameProps(next))));
      refreshFrame(img, FramePath);
    }
    img.dirty = true;
    img.setCoords();
    this.commit();
  }

  /** Regera a moldura de uma imagem (ou das imagens de uma seleção/grupo) depois de escala/recorte; sem `commit`. */
  private refreshFrameOf(o: FabricObject | undefined): void {
    if (o instanceof FabricImage) refreshFrame(o, FramePath);
    else if (o instanceof Group) {
      for (const c of o.getObjects()) this.refreshFrameOf(c);
    }
  }

  startCrop(): boolean {
    const img = this.activeImage();
    if (!img || this.cropState) return false;
    this.cropState = { img, controls: img.controls };
    img.controls = createImageCroppingControls();
    img.setCoords();
    this.canvas.requestRenderAll();
    return true;
  }

  endCrop(): void {
    const s = this.cropState;
    if (!s) return;
    s.img.controls = s.controls;
    if (this.refreshFilterRegion(s.img)) s.img.applyFilters();
    // moldura: caixa nova e zoom/posição relidos do recorte (os sliders da folha seguem o que o usuário recortou)
    if (refreshFrame(s.img, FramePath)) s.img.set(frameProps(this.frameOf(s.img)));
    s.img.setCoords();
    this.cropState = null;
    this.commit();
  }

  /**
   * Conclui o recorte quando a seleção sai da imagem: o Concluir só existe no painel, que some com a seleção, e o modo
   * ficava preso (§28 D, defeito 4).
   */
  private leaveCrop(): void {
    if (this.cropState && this.canvas.getActiveObject() !== this.cropState.img) this.endCrop();
  }

  // ---------- máscara (remover objeto) ----------

  startMask(brushSize: number): void {
    this.canvas.discardActiveObject();
    this.maskPaths = [];
    const brush = new PencilBrush(this.canvas);
    brush.color = 'rgba(255, 64, 64, 0.55)';
    brush.width = brushSize;
    brush.strokeLineCap = 'round';
    this.canvas.freeDrawingBrush = brush;
    this.canvas.isDrawingMode = true;
  }

  setMaskBrush(size: number): void {
    if (this.canvas.freeDrawingBrush) this.canvas.freeDrawingBrush.width = size;
  }

  /** Encerra o modo pincel e devolve a máscara (PNG dataURL) no tamanho natural da imagem. */
  endMask(img: FabricImage | undefined): string | null {
    const paths = this.maskPaths ?? [];
    this.maskPaths = null;
    this.canvas.isDrawingMode = false;
    let out: string | null = null;
    if (img && paths.length) {
      const el = img.getElement() as HTMLImageElement | HTMLCanvasElement;
      const nw = (el as HTMLImageElement).naturalWidth || el.width;
      const nh = (el as HTMLImageElement).naturalHeight || el.height;
      const c = document.createElement('canvas');
      c.width = nw;
      c.height = nh;
      const ctx = c.getContext('2d')!;
      // canvas (página) → coordenadas locais da imagem → pixels da imagem original
      const inv = util.invertTransform(img.calcTransformMatrix());
      const toPixels = util.multiplyTransformMatrices([1, 0, 0, 1, img.width / 2 + img.cropX, img.height / 2 + img.cropY], inv);
      for (const p of paths) {
        ctx.save();
        ctx.setTransform(...(toPixels as [number, number, number, number, number, number]));
        p.set({ stroke: '#ffffff' });
        p.render(ctx);
        ctx.restore();
      }
      out = c.toDataURL('image/png');
    }
    this.withoutHistory(() => { for (const p of paths) this.canvas.remove(p); });
    this.canvas.requestRenderAll();
    return out;
  }

  // ---------- 🖌️ retocar recorte (TASK-18) ----------

  /** Máscara do "Remover objeto" ou retoque abertos: o pincel do canvas é deles (histórico, páginas e desenho esperam). */
  private get brushModal(): boolean { return this.maskPaths !== null || this.refine !== null; }

  get isRefining(): boolean { return this.refine !== null; }

  /** Estado do retoque para a barra e o E2E; undefined fora do modo. */
  refineInfo(): RefineInfo | undefined {
    const s = this.refine;
    return s ? { img: s.img, mode: s.mode, size: s.size, feather: s.feather, strokes: s.strokes, canRestore: s.orig !== null } : undefined;
  }

  /**
   * Abre o retoque na imagem: os traços pintam um canvas de trabalho no tamanho natural (o recorte SEM filtros), que só
   * entra no `_element` — a prévia ao vivo. `_originalElement` fica: `getSrc`/`toObject` (rascunho, undo, autosave)
   * continuam com a URL do recorte, e o retoque só vale no Concluir. `origSrc` = a foto antes do "✨ Remover fundo",
   * escalada para o tamanho do recorte atual (o upscale ×2/×4 muda o tamanho natural); sem ela, só o Apagar.
   */
  async startRefine(img: FabricImage, origSrc?: string): Promise<boolean> {
    if (this.brushModal || this.freehandBase !== null) return false;
    const el = img._originalElement as HTMLImageElement | HTMLCanvasElement | undefined;
    const w = (el as HTMLImageElement | undefined)?.naturalWidth || el?.width || 0;
    const h = (el as HTMLImageElement | undefined)?.naturalHeight || el?.height || 0;
    if (!el || !w || !h) return false;
    const work = document.createElement('canvas');
    work.width = w;
    work.height = h;
    const ctx = work.getContext('2d', { willReadFrequently: true });
    if (!ctx) return false;
    ctx.drawImage(el, 0, 0);
    let orig: CanvasRenderingContext2D | null = null;
    if (origSrc) {
      try {
        const o = await util.loadImage(origSrc);
        const c = document.createElement('canvas');
        c.width = w;
        c.height = h;
        orig = c.getContext('2d', { willReadFrequently: true });
        orig?.drawImage(o, 0, 0, w, h);
      } catch (e) {
        console.warn('retoque: foto original indisponível', e);
        orig = null;
      }
    }
    // a foto carregou de forma assíncrona: outra ação pode ter tomado o pincel ou tirado a imagem do canvas
    if (this.brushModal || this.freehandBase !== null || !this.canvas.getObjects().includes(img)) return false;
    // antes do estado: o `selection:cleared` conclui um recorte aberto, cujo instantâneo não pode ser barrado pelo modo
    this.canvas.discardActiveObject();
    this.refine = {
      img, work, ctx, orig, mode: 'erase', size: REFINE_SIZE.initial, feather: REFINE_FEATHER.initial / 100, points: null, strokes: 0,
    };
    this.showRefinePreview(img, work);
    const brush = new PencilBrush(this.canvas);
    brush.strokeLineCap = 'round';
    brush.strokeLineJoin = 'round';
    this.canvas.freeDrawingBrush = brush;
    this.syncRefineBrush();
    this.canvas.isDrawingMode = true;
    this.canvas.requestRenderAll();
    return true;
  }

  /** Modo (Restaurar só com a original), diâmetro do pincel (px da página) e suavidade (0..1). */
  setRefineBrush(opts: { mode?: RefineMode; size?: number; feather?: number }): void {
    const s = this.refine;
    if (!s) return;
    if (opts.mode && (opts.mode === 'erase' || s.orig)) s.mode = opts.mode;
    if (opts.size !== undefined && Number.isFinite(opts.size)) s.size = Math.min(REFINE_SIZE.max, Math.max(REFINE_SIZE.min, opts.size));
    if (opts.feather !== undefined && Number.isFinite(opts.feather)) s.feather = Math.min(1, Math.max(0, opts.feather));
    this.syncRefineBrush();
  }

  /** Rastro do traço: vermelho = apagar, verde = restaurar; a largura é o diâmetro do carimbo. */
  private syncRefineBrush(): void {
    const s = this.refine;
    const b = this.canvas.freeDrawingBrush;
    if (!s || !b) return;
    b.color = s.mode === 'erase' ? 'rgba(255, 64, 64, 0.45)' : 'rgba(40, 190, 110, 0.45)';
    b.width = s.size;
  }

  /** Um traço (pontos da cena) vira carimbos nos pixels da imagem, pelo mesmo mapeamento do `endMask`. */
  private applyRefineStroke(points: RefinePoint[]): void {
    const s = this.refine;
    if (!s || points.length === 0) return;
    const img = s.img;
    const toPixels = util.multiplyTransformMatrices([1, 0, 0, 1, img.width / 2 + img.cropX, img.height / 2 + img.cropY],
      util.invertTransform(img.calcTransformMatrix()));
    // px da imagem por px da página (média dos dois eixos: escala não uniforme ainda dá um carimbo redondo)
    const k = (Math.hypot(toPixels[0], toPixels[1]) + Math.hypot(toPixels[2], toPixels[3])) / 2;
    const px = points.map((p) => util.transformPoint(new Point(p.x, p.y), toPixels));
    const orig = s.orig;
    let data: ImageData | undefined;
    const done = applyStroke(px, (s.size / 2) * k, s.feather, s.mode, s.work.width, s.work.height,
      (b) => (data = s.ctx.getImageData(b.x, b.y, b.w, b.h)).data,
      orig ? (b) => orig.getImageData(b.x, b.y, b.w, b.h).data : null);
    if (!done || !data) return;
    s.ctx.putImageData(data, done.box.x, done.box.y);
    s.strokes++;
    img.dirty = true;
    this.canvas.requestRenderAll();
  }

  /**
   * Fecha o retoque. Com `apply` e algum traço, devolve o PNG (dataURL) do canvas de trabalho, ainda na prévia: quem
   * chama grava o blob (`putImage`) e faz o `replaceImage` — o único passo do undo — ou, se falhar, `dropRefinePreview`.
   * Sem traço, cancelado ou com a imagem fora do canvas: a imagem volta ao recorte e devolve null.
   */
  endRefine(apply: boolean): string | null {
    const s = this.refine;
    if (!s) return null;
    this.refine = null;
    this.canvas.isDrawingMode = false;
    this.canvas.clearContext(this.canvas.contextTop);
    const out = apply && s.strokes > 0 && this.canvas.getObjects().includes(s.img) ? s.work.toDataURL('image/png') : null;
    if (!out) this.dropRefinePreview(s.img);
    this.canvas.requestRenderAll();
    return out;
  }

  /** Tira a prévia do retoque: a imagem volta ao `_originalElement` com os filtros dela refeitos. */
  dropRefinePreview(img: FabricImage): void {
    // antes do applyFilters: com filtros e `_element` ≠ original sem `_filteredEl`, o Fabric filtraria PARA o canvas de trabalho
    img._element = img._originalElement;
    img.applyFilters();
    this.canvas.requestRenderAll();
  }

  private showRefinePreview(img: FabricImage, work: HTMLCanvasElement): void {
    img._element = work;
    // `_renderFill` escala a origem por `_filterScalingX/Y` (fabric Image.ts): o canvas de trabalho tem o tamanho natural
    const scaling = img as unknown as { _filterScalingX: number; _filterScalingY: number };
    scaling._filterScalingX = 1;
    scaling._filterScalingY = 1;
    img.dirty = true;
  }

  // ---------- desenho à mão livre (TASK-14) ----------

  get isFreehandDrawing(): boolean { return this.freehandBase !== null; }

  /** Liga o pincel permanente: cada traço vira um Path "Traço à mão" (camada normal, com undo). */
  startFreehandDraw(color: string, width: number): void {
    if (this.brushModal) return; // a máscara do "Remover objeto" e o retoque usam o mesmo pincel do canvas
    this.canvas.discardActiveObject();
    this.freehandBase = this.canvas.getObjects().length;
    const brush = new PencilBrush(this.canvas);
    brush.decimate = FREEHAND_DECIMATE;
    brush.strokeLineCap = 'round';
    brush.strokeLineJoin = 'round';
    this.canvas.freeDrawingBrush = brush;
    this.updateFreehandBrush({ color, width });
    this.canvas.isDrawingMode = true;
    this.canvas.requestRenderAll();
  }

  /** Cor (aceita rgba, para o marca-texto) e espessura (px do documento) dos próximos traços. */
  updateFreehandBrush(opts: { color?: string; width?: number }): void {
    const b = this.canvas.freeDrawingBrush;
    if (!b || this.freehandBase === null) return;
    if (opts.color !== undefined) b.color = opts.color;
    if (opts.width !== undefined) b.width = Math.max(1, opts.width);
  }

  freehandBrush(): { color: string; width: number } | undefined {
    const b = this.canvas.freeDrawingBrush;
    return b && this.freehandBase !== null ? { color: b.color, width: b.width } : undefined;
  }

  /** Traços desta sessão: Paths "Traço à mão" acima da pilha que existia ao começar. */
  freehandStrokes(): FabricObject[] {
    if (this.freehandBase === null) return [];
    return this.canvas.getObjects().slice(this.freehandBase).filter((o) => isFreehandPath(o));
  }

  /** "Desfazer traço": remove o último traço da sessão (o `object:removed` registra o undo). */
  undoFreehandStroke(): boolean {
    const last = this.freehandStrokes().pop();
    if (!last) return false;
    this.canvas.remove(last);
    this.canvas.requestRenderAll();
    return true;
  }

  /** "Concluir": desliga o pincel e (se `select`) deixa os traços da sessão selecionados juntos. */
  endFreehandDraw(select = true): FabricObject[] {
    if (this.freehandBase === null) return [];
    const live = this.freehandStrokes();
    this.freehandBase = null;
    this.canvas.isDrawingMode = false;
    if (select && live.length) this.selectMultiple(live);
    this.canvas.requestRenderAll();
    return live;
  }

  // ---------- exportação ----------

  /**
   * Renderiza a página inteira com viewport identidade: multiplier = escala exata sobre o tamanho do
   * documento (com o zoom da tela, o tamanho arredondado do elemento vazava para a exportação).
   */
  private renderPage(scale: number, format: RasterFormat, quality: number, bleed = 0): string {
    // sem discardActiveObject: o toDataURL já não desenha as alças, e descartar aqui tirava a seleção (e o modo de
    // recorte) a cada miniatura do rascunho automático (§29, defeito 5)
    const vpt = this.canvas.viewportTransform;
    this.canvas.viewportTransform = [1, 0, 0, 1, 0, 0];
    this.isExporting = true;
    // sangria (PDF de impressão, TASK-10): o retângulo de saída passa `bleed` da página em cada lado. A cor de fundo do
    // canvas já cobre a saída inteira; a camada de fundo (degradê/imagem) cobre só a página, então cresce no render (o
    // centro dela é o da página) e volta no finally
    const bg = bleed > 0 ? this.backgroundLayer() : undefined;
    const saved = bg ? { scaleX: bg.scaleX, scaleY: bg.scaleY } : undefined;
    try {
      if (bg) {
        const k = Math.max((this.docWidth + 2 * bleed) / this.docWidth, (this.docHeight + 2 * bleed) / this.docHeight);
        bg.set({ scaleX: bg.scaleX * k, scaleY: bg.scaleY * k });
      }
      return this.canvas.toDataURL({
        format, quality, multiplier: scale, left: -bleed, top: -bleed, width: this.docWidth + 2 * bleed, height: this.docHeight + 2 * bleed,
      });
    } finally {
      if (bg && saved) bg.set(saved);
      this.isExporting = false;
      this.canvas.setViewportTransform(vpt);
    }
  }

  /**
   * A página como `<canvas>` (sem alças, guias nem overlays), lado maior ≤ `maxSide`, para ler pixels (conta-gotas,
   * contraste). `filter` deixa objetos de fora (o próprio texto, na amostragem do fundo sob ele).
   */
  renderPageCanvas(maxSide = 2048, filter?: (o: FabricObject) => boolean): { canvas: HTMLCanvasElement; scale: number } {
    const scale = Math.min(1, maxSide / Math.max(this.docWidth, this.docHeight));
    const vpt = this.canvas.viewportTransform;
    this.canvas.viewportTransform = [1, 0, 0, 1, 0, 0];
    this.isExporting = true;
    try {
      const canvas = this.canvas.toCanvasElement(scale, {
        left: 0, top: 0, width: this.docWidth, height: this.docHeight,
        filter: filter as ((o: unknown) => boolean) | undefined,
      });
      return { canvas, scale };
    } finally {
      this.isExporting = false;
      this.canvas.setViewportTransform(vpt);
    }
  }

  /** Ponto da tela (clientX/Y) → coordenadas do documento, pelo viewport atual. */
  clientToDoc(clientX: number, clientY: number): { x: number; y: number } {
    const r = this.canvas.lowerCanvasEl.getBoundingClientRect();
    const css = new Point(clientX - r.left, clientY - r.top);
    const p = util.transformPoint(css, util.invertTransform(this.canvas.viewportTransform));
    return { x: p.x, y: p.y };
  }

  /** Documento → ponto da tela (clientX/Y). */
  docToClient(x: number, y: number): { x: number; y: number } {
    const r = this.canvas.lowerCanvasEl.getBoundingClientRect();
    const p = util.transformPoint(new Point(x, y), this.canvas.viewportTransform);
    return { x: p.x + r.left, y: p.y + r.top };
  }

  /** Raster da página em `scale` × o tamanho do documento (lado maior até 8192 px), com `bleed` px de sangria em volta. */
  async exportRaster(format: RasterFormat, scale: number, quality: number, bleed = 0): Promise<string> {
    const b = Math.max(0, bleed);
    const max = 8192 / Math.max(this.docWidth + 2 * b, this.docHeight + 2 * b);
    this.canvas.discardActiveObject();
    return this.renderPage(Math.min(scale, max), format, quality, b);
  }

  /** Miniatura pequena para rascunhos/templates. */
  thumbnail(maxSide = 360): string {
    return this.renderPage(maxSide / Math.max(this.docWidth, this.docHeight), 'jpeg', 0.8);
  }

  /** Grava já o instantâneo que estava no debounce; true se o documento mudou. */
  flushPending(): boolean {
    window.clearTimeout(this.historyTimer);
    if (this.suspendHistory > 0 || this.brushModal) return false;
    const changed = this.history.push(this.snapshot());
    if (changed) this.onChange();
    return changed;
  }

  /**
   * SVG portátil: imagens e fontes embutidas como dataURL. Viewport identidade e "elemento" do tamanho da página durante
   * o `toSVG` (como o `toCanvasElement` do Fabric faz): o fundo-gradiente do canvas usa o vpt invertido e o tamanho do
   * elemento, que mudam com o zoom/pan do usuário (TASK-13).
   */
  async exportSvg(): Promise<string> {
    this.canvas.discardActiveObject();
    this.isExporting = true;
    const vpt = this.canvas.viewportTransform;
    const elW = this.canvas.width;
    const elH = this.canvas.height;
    const restoreView = () => {
      this.canvas.width = elW;
      this.canvas.height = elH;
      this.canvas.setViewportTransform(vpt);
    };
    this.canvas.viewportTransform = [1, 0, 0, 1, 0, 0];
    this.canvas.width = this.docWidth;
    this.canvas.height = this.docHeight;
    try {
      const families = fabricFontsUsed(this.activeFabric());
      fabricConfig.clearFonts();
      const paths: Record<string, string> = {};
      for (const f of families) {
        const u = fontUrl(f);
        if (u) paths[f] = u;
      }
      fabricConfig.addFonts(paths);
      const svg = this.canvas.toSVG({
        width: String(this.docWidth),
        height: String(this.docHeight),
        viewBox: { x: 0, y: 0, width: this.docWidth, height: this.docHeight },
      });
      fabricConfig.clearFonts();
      // a tela volta antes do await (o resto é só texto)
      restoreView();
      return await inlineSvgResources(svg, browserFetcher);
    } finally {
      this.isExporting = false;
      restoreView();
    }
  }

  /**
   * Exporta as camadas rasterizadas uma a uma (PNG recortado na caixa de cada camada, com rotação, opacidade e sombra
   * já desenhadas) e monta o comando FFmpeg do MP4 ou do GIF. O tamanho da saída segue a página (lado maior ≤ 1920 no
   * MP4, largura ≤ 540 e 15 fps no GIF), sempre par (yuv420p).
   */
  async exportVideoBundle(format: 'mp4' | 'gif' = 'mp4'): Promise<ExportVideoBundle> {
    this.videoPreview.stop();
    this.canvas.discardActiveObject();
    const even = (n: number) => Math.max(2, Math.round(n / 2) * 2);
    const maxScale = format === 'gif' ? 540 / this.docWidth : 1920 / Math.max(this.docWidth, this.docHeight);
    const scale = Math.min(1, maxScale);
    const width = even(this.docWidth * scale);
    const height = even(this.docHeight * scale);
    const duration = this.videoSettings.duration ?? 5;
    const fps = format === 'gif' ? Math.min(15, this.videoSettings.fps ?? 30) : this.videoSettings.fps ?? 30;

    const files: Record<string, string> = {};
    const layers: LayerRenderItem[] = [];
    const objects = this.canvas.getObjects();
    const originalVisibilities = objects.map((o) => o.visible);
    const originalBg = this.canvas.backgroundColor;
    const originalBgImg = this.canvas.backgroundImage;
    try {
      // 1. fundo da página (cor/imagem de fundo do canvas), página inteira
      for (const o of objects) o.visible = false;
      files['bg.png'] = this.renderPage(width / this.docWidth, 'png', 1.0);
      layers.push({ id: 'bg', filename: 'bg.png', x: 0, y: 0, width, height, opacity: 1, isBackground: true });

      // 2. cada objeto sozinho, sem fundo, recortado na própria caixa (+ margem da sombra)
      this.canvas.backgroundColor = 'transparent';
      this.canvas.backgroundImage = undefined;
      for (let i = 0; i < objects.length; i++) {
        const obj = objects[i];
        if (!originalVisibilities[i]) continue;
        for (let j = 0; j < objects.length; j++) objects[j].visible = j === i;
        obj.setCoords();
        const b = obj.getBoundingRect();
        const sh = obj.shadow;
        const m = 2 + (sh ? sh.blur + Math.max(Math.abs(sh.offsetX), Math.abs(sh.offsetY)) : 0);
        const rect = { left: b.left - m, top: b.top - m, width: b.width + 2 * m, height: b.height + 2 * m };
        const filename = `layer_${i}.png`;
        files[filename] = this.renderRegion(width / this.docWidth, rect);
        layers.push({
          id: `layer_${i}`,
          filename,
          x: rect.left * (width / this.docWidth),
          y: rect.top * (height / this.docHeight),
          width: Math.round(rect.width * (width / this.docWidth)),
          height: Math.round(rect.height * (width / this.docWidth)),
          // a opacidade já está no PNG
          opacity: 1,
          rotation: obj.angle ?? 0,
          animation: (obj as unknown as { animation?: LayerAnimation }).animation,
        });
      }
    } finally {
      this.canvas.backgroundColor = originalBg;
      this.canvas.backgroundImage = originalBgImg;
      for (let i = 0; i < objects.length; i++) objects[i].visible = originalVisibilities[i];
      this.canvas.requestRenderAll();
    }

    const audioUrl = format === 'mp4' ? this.videoSettings.audioUrl : undefined;
    const audioFile = audioUrl ? `audio.${audioExtension(audioUrl)}` : undefined;
    const output = format === 'gif' ? 'output.gif' : 'output.mp4';
    const channels = audioUrl ? await audioChannels(audioUrl) : undefined;
    const builder = new FfmpegCommandBuilder({
      width,
      height,
      fps,
      duration,
      unit: width / this.docWidth,
      outputFilename: output,
      audio: audioFile
        ? {
            filename: audioFile,
            volume: this.videoSettings.audioVolume ?? 0.8,
            startTime: this.videoSettings.audioStartTime,
            fadeOut: this.videoSettings.audioFadeOut,
            channels,
          }
        : undefined,
    });
    const built = format === 'gif' ? builder.buildGif(layers) : builder.build(layers);
    return {
      name: this.name || 'video',
      command: built.command,
      ffmpegCommand: built.command,
      files,
      width,
      height,
      duration,
      fps,
      output,
      ...(audioUrl && audioFile ? { audioUrl, audioFile } : {}),
    };
  }

  /** Um retângulo da página (coordenadas do documento) como PNG, com viewport identidade (como `renderPage`). */
  private renderRegion(scale: number, r: { left: number; top: number; width: number; height: number }): string {
    const vpt = this.canvas.viewportTransform;
    this.canvas.viewportTransform = [1, 0, 0, 1, 0, 0];
    this.isExporting = true;
    try {
      return this.canvas.toDataURL({ format: 'png', multiplier: scale, left: r.left, top: r.top, width: r.width, height: r.height });
    } finally {
      this.isExporting = false;
      this.canvas.setViewportTransform(vpt);
    }
  }
}

let pageSeq = 0;
/** Id de página novo, único na lista. */
function newPageId(existing: { id: string }[]): string {
  let id: string;
  do id = `p${Date.now().toString(36)}${(pageSeq++).toString(36)}`; while (existing.some((p) => p.id === id));
  return id;
}

const cloneJson = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

function isBackgroundJson(o: unknown): o is Record<string, unknown> {
  return typeof o === 'object' && o !== null && (o as Record<string, unknown>).layerName === BACKGROUND_LAYER;
}

/** O `coverPage` + `refreshGradient` no JSON da camada de fundo, para uma página `w × h` que não está no canvas. */
function fitBackgroundJson(o: Record<string, unknown>, w: number, h: number): Record<string, unknown> {
  const place = { left: w / 2, top: h / 2, originX: 'center', originY: 'center' };
  if (o.type === FabricImage.type || o.type === 'image') {
    const s = Math.max(w / Math.max(1, Number(o.width) || 1), h / Math.max(1, Number(o.height) || 1));
    return { ...o, ...place, scaleX: s, scaleY: s };
  }
  const out: Record<string, unknown> = { ...o, ...place, width: w, height: h, scaleX: 1, scaleY: 1 };
  const spec = o.customGradient;
  if (isGradientSpec(spec) && typeof o.fill === 'object' && o.fill !== null) out.fill = buildFabricGradient(spec, w, h).toObject();
  return out;
}

export function defaultVideoSettings(): VideoSettings {
  return { duration: 5, fps: 30, width: 1080, height: 1080 };
}

/** Extensão do arquivo de áudio pela URL (o FFmpeg detecta pelo conteúdo; a extensão só ajuda). */
export function audioExtension(url: string): string {
  const m = /\.([a-z0-9]{2,5})(?:[?#].*)?$/i.exec(url);
  const ext = m?.[1]?.toLowerCase();
  return ext && ['mp3', 'm4a', 'aac', 'ogg', 'oga', 'opus', 'wav', 'flac', 'webm', 'mp4', '3gp', 'amr'].includes(ext) ? ext : 'mp3';
}

/** Renderiza um documento numa miniatura, fora do editor (galeria de templates). */
export async function renderThumbnail(input: unknown, maxSide: number): Promise<string> {
  const doc = parseDocument(input);
  await ensureFonts(fontsUsed(doc));
  const s = maxSide / Math.max(doc.width, doc.height);
  const el = document.createElement('canvas');
  const sc = new StaticCanvas(el, { width: Math.round(doc.width * s), height: Math.round(doc.height * s), enableRetinaScaling: false });
  await sc.loadFromJSON(doc.fabric);
  sc.setViewportTransform([s, 0, 0, s, 0, 0]);
  sc.renderAll();
  const url = sc.toDataURL({ format: 'jpeg', quality: 0.8, multiplier: 1 });
  await sc.dispose();
  return url;
}

/** Uma forma de tamanho-base `m` (sem posição). */
/** Largura do texto como o Fabric o desenha (a tabela mede as células com a mesma fonte que vai usar). */
const measureText: Measure = (text, f) => (text ? new FabricText(text, { fontFamily: f.family, fontSize: f.size, fontWeight: f.weight }).width : 0);

function makeShape(kind: ShapeKind, fill: string, m: number): FabricObject {
  let o: FabricObject;
  switch (kind) {
    case 'rect': o = new Rect({ width: m, height: m * 0.7, fill }); break;
    case 'rounded': o = new Rect({ width: m, height: m * 0.7, rx: m * 0.12, ry: m * 0.12, fill }); break;
    case 'pill': o = new Rect({ width: m, height: m * 0.4, rx: m * 0.2, ry: m * 0.2, fill }); break;
    case 'circle': o = new Circle({ radius: m / 2, fill }); break;
    case 'triangle': o = new Triangle({ width: m, height: m * 0.87, fill }); break;
    case 'line': o = new Line([0, 0, m * 1.5, 0], { stroke: fill, strokeWidth: Math.max(4, m * 0.03), strokeLineCap: 'round' }); break;
    case 'star': o = new Polygon(starPoints(5, m / 2, m / 4.4), { fill }); break;
    case 'badge-hex': o = new Polygon(hexPoints(m / 2), { fill }); break;
    case 'arrow': o = new Path(arrowPath(m * 1.4, m * 0.5), { fill }); break;
  }
  if (SWAP_KINDS.includes(kind)) o.set({ shapeKind: kind });
  return o;
}

/** Hexágono com lados de cima e de baixo retos (selo). */
function hexPoints(r: number): { x: number; y: number }[] {
  return Array.from({ length: 6 }, (_, i) => ({ x: r * Math.cos((Math.PI / 3) * i), y: r * Math.sin((Math.PI / 3) * i) }));
}

/** Objetos cujo `fill` aceita degradê (formas e textos; não imagem, grupo, linha). */
function canHoldGradient(o: FabricObject): boolean {
  return !(o instanceof FabricImage || o instanceof Group || o instanceof Line);
}

/**
 * Forma fechada e preenchida que o Pathfinder aceita (TASK-16): Rect, Circle, Ellipse, Triangle, Polygon ou Path,
 * visível, fora da camada de fundo, com preenchimento. Linha, conector/QR/tabela (Group), texto, imagem e traço à mão
 * (Path sem preenchimento) ficam de fora.
 */
function isBooleanCandidate(o: FabricObject): boolean {
  if (!isBooleanShapeType(o) || o instanceof Group || o.visible === false) return false;
  if (o.get('layerName') === BACKGROUND_LAYER || isFreehandPath(o)) return false;
  const f = o.fill;
  if (f === null || f === undefined || f === '') return false;
  return !(typeof f === 'string' && ['transparent', 'none'].includes(f.trim().toLowerCase()));
}

/** Group de Paths de um conector, com os pontos deslocados por `at` (coordenadas da página). */
export function buildConnector(spec: ConnectorSpec, at: { x: number; y: number }): Group {
  const shifted: ConnectorSpec = { ...spec, x1: spec.x1 + at.x, y1: spec.y1 + at.y, x2: spec.x2 + at.x, y2: spec.y2 + at.y };
  const geo = connectorGeometry(shifted);
  const stroke = { stroke: spec.color, strokeWidth: spec.width, strokeLineCap: 'round' as const, strokeLineJoin: 'round' as const, fill: '' };
  const line = new Path(geo.line, { ...stroke, strokeDashArray: dashArrayFor(spec.dash, spec.width) });
  const caps = geo.caps.map((c) => new Path(c.d, c.filled ? { fill: spec.color, strokeWidth: 0 } : stroke));
  const g = new Group([line, ...caps], { originX: 'center', originY: 'center' });
  g.set({ connectorSpec: spec });
  return g;
}

function starPoints(n: number, outer: number, inner: number): { x: number; y: number }[] {
  const pts = [];
  for (let i = 0; i < n * 2; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = (Math.PI * i) / n - Math.PI / 2;
    pts.push({ x: r * Math.cos(a), y: r * Math.sin(a) });
  }
  return pts;
}

function arrowPath(len: number, h: number): string {
  const shaft = h * 0.36, head = len * 0.32;
  return `M 0 ${-shaft / 2} L ${len - head} ${-shaft / 2} L ${len - head} ${-h / 2} L ${len} 0 L ${len - head} ${h / 2} `
    + `L ${len - head} ${shaft / 2} L 0 ${shaft / 2} Z`;
}
