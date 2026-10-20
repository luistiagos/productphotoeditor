import {
  Canvas,
  Circle,
  FabricImage,
  FabricObject,
  Gradient,
  InteractiveFabricObject,
  Line,
  loadSVGFromString,
  loadSVGFromURL,
  Path,
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
import { createDocument, CUSTOM_PROPERTIES, type EditorDocument, fontsUsed, parseDocument } from './document';
import { History } from './history';
import { rescaledGeometry } from './imageGeometry';
import { curveArc } from './curve';
import { ensureFonts, fontUrl } from './content';
import { browserFetcher, inlineSvgResources } from './svgExport';

FabricObject.customProperties = [...CUSTOM_PROPERTIES];
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

export type ShapeKind = 'rect' | 'rounded' | 'circle' | 'triangle' | 'line' | 'star' | 'arrow';
export type FilterPreset = 'none' | 'grayscale' | 'sepia' | 'vintage' | 'polaroid' | 'kodachrome' | 'invert';
export interface Adjustments { brightness: number; contrast: number; saturation: number; blur: number }

const BACKGROUND_LAYER = 'background';

/** Editor sobre um Fabric Canvas cujo elemento tem o tamanho da página × zoom (§15). */
export class Editor {
  readonly canvas: Canvas;
  private docWidth = 1080;
  private docHeight = 1080;
  private zoom = 1;
  name = 'Sem nome';
  /** Papel do brand kit aplicado ao fundo do canvas (fabric.brandBackground). */
  brandBackground: string | undefined;
  readonly history = new History<string>(60);
  private suspendHistory = 0;
  private historyTimer: number | undefined;
  private maskPaths: FabricObject[] | null = null;
  private cropState: { img: FabricImage; controls: FabricObject['controls'] } | null = null;
  onChange: () => void = () => {};
  onSelection: (obj: FabricObject | undefined) => void = () => {};

  constructor(el: HTMLCanvasElement, private readonly host: HTMLElement) {
    this.canvas = new Canvas(el, { preserveObjectStacking: true, enableRetinaScaling: true, backgroundColor: '#ffffff' });
    const changed = () => this.scheduleSnapshot();
    this.canvas.on('object:added', changed);
    this.canvas.on('object:removed', changed);
    // texto curvo: a largura da caixa (alças laterais) e a digitação refazem as dimensões do texto reto (§29)
    this.canvas.on('object:modified', ({ target }) => { this.refitCurve(target); changed(); });
    this.canvas.on('text:changed', ({ target }) => { this.refitCurve(target); changed(); });
    this.canvas.on('selection:created', () => this.onSelection(this.canvas.getActiveObject()));
    this.canvas.on('selection:updated', () => { this.leaveCrop(); this.onSelection(this.canvas.getActiveObject()); });
    this.canvas.on('selection:cleared', () => { this.leaveCrop(); this.onSelection(undefined); });
    this.canvas.on('path:created', ({ path }) => {
      if (this.maskPaths) {
        path.set({ selectable: false, evented: false });
        this.maskPaths.push(path);
      }
    });
    new ResizeObserver(() => this.fit()).observe(host);
  }

  get width(): number { return this.docWidth; }
  get height(): number { return this.docHeight; }

  // ---------- documento ----------

  async load(input: unknown): Promise<EditorDocument> {
    const doc = parseDocument(input);
    await ensureFonts(fontsUsed(doc));
    this.docWidth = doc.width;
    this.docHeight = doc.height;
    this.name = doc.name;
    this.brandBackground = typeof doc.fabric.brandBackground === 'string' ? doc.fabric.brandBackground : undefined;
    await this.withoutHistory(() => this.canvas.loadFromJSON(doc.fabric));
    this.refitCurves();
    this.fit();
    this.history.reset(this.snapshot());
    this.canvas.requestRenderAll();
    this.onChange();
    return doc;
  }

  newDocument(name: string, width: number, height: number): Promise<EditorDocument> {
    return this.load(createDocument(name, width, height, { objects: [], background: '#ffffff' }));
  }

  toDocument(): EditorDocument {
    const fabric = this.canvas.toObject() as EditorDocument['fabric'];
    if (this.brandBackground) fabric.brandBackground = this.brandBackground;
    return createDocument(this.name, this.docWidth, this.docHeight, fabric);
  }

  private snapshot(): string {
    return JSON.stringify(this.toDocument());
  }

  private scheduleSnapshot(): void {
    if (this.suspendHistory > 0 || this.maskPaths) return;
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

  async undo(): Promise<void> { await this.restore(this.history.undo()); }
  async redo(): Promise<void> { await this.restore(this.history.redo()); }

  private async restore(state: string | undefined): Promise<void> {
    if (!state) return;
    const doc = parseDocument(state);
    await this.withoutHistory(() => this.canvas.loadFromJSON(doc.fabric));
    this.refitCurves();
    this.brandBackground = typeof doc.fabric.brandBackground === 'string' ? doc.fabric.brandBackground : undefined;
    if (doc.width !== this.docWidth || doc.height !== this.docHeight) {
      this.docWidth = doc.width;
      this.docHeight = doc.height;
      this.fit();
    }
    this.canvas.requestRenderAll();
    this.onChange();
  }

  /** Marca uma alteração feita fora dos eventos do Fabric (propriedades no painel). */
  commit(): void {
    this.canvas.requestRenderAll();
    this.scheduleSnapshot();
  }

  // ---------- tela ----------

  fit(): void {
    const pad = 16;
    const w = Math.max(50, this.host.clientWidth - pad * 2);
    const h = Math.max(50, this.host.clientHeight - pad * 2);
    this.zoom = Math.min(w / this.docWidth, h / this.docHeight);
    this.canvas.setDimensions({ width: Math.round(this.docWidth * this.zoom), height: Math.round(this.docHeight * this.zoom) });
    this.canvas.setViewportTransform([this.zoom, 0, 0, this.zoom, 0, 0]);
    this.canvas.requestRenderAll();
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
    if (bg) this.coverPage(bg);
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
    const text = { title: 'Título', subtitle: 'Subtítulo', body: 'Toque duas vezes para editar o texto' }[kind];
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
    const s = Math.min((this.docWidth * fit) / img.width, (this.docHeight * fit) / img.height, 1 / Math.max(this.zoom, 0.001));
    img.set({ scaleX: s, scaleY: s });
    this.add(this.center(img));
    return img;
  }

  addShape(kind: ShapeKind, fill: string): FabricObject {
    const m = Math.min(this.docWidth, this.docHeight) * 0.3;
    let o: FabricObject;
    switch (kind) {
      case 'rect': o = new Rect({ width: m, height: m * 0.7, fill }); break;
      case 'rounded': o = new Rect({ width: m, height: m * 0.7, rx: m * 0.12, ry: m * 0.12, fill }); break;
      case 'circle': o = new Circle({ radius: m / 2, fill }); break;
      case 'triangle': o = new Triangle({ width: m, height: m * 0.87, fill }); break;
      case 'line': o = new Line([0, 0, m * 1.5, 0], { stroke: fill, strokeWidth: Math.max(4, m * 0.03), strokeLineCap: 'round' }); break;
      case 'star': o = new Polygon(starPoints(5, m / 2, m / 4.4), { fill }); break;
      case 'arrow': o = new Path(arrowPath(m * 1.4, m * 0.5), { fill }); break;
    }
    return this.add(this.center(o));
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
    const w = this.docWidth, h = this.docHeight;
    const a = (angleDeg * Math.PI) / 180;
    const coords = kind === 'linear'
      ? { x1: w / 2 - (Math.cos(a) * w) / 2, y1: h / 2 - (Math.sin(a) * h) / 2, x2: w / 2 + (Math.cos(a) * w) / 2, y2: h / 2 + (Math.sin(a) * h) / 2 }
      : { x1: w / 2, y1: h / 2, x2: w / 2, y2: h / 2, r1: 0, r2: Math.max(w, h) * 0.75 };
    const grad = new Gradient({
      type: kind,
      gradientUnits: 'pixels',
      coords,
      colorStops: colors.map((color, i) => ({ offset: colors.length === 1 ? 0 : i / (colors.length - 1), color })),
    });
    // coordenadas relativas ao canto superior esquerdo do objeto (Object._applyPatternGradientTransform)
    const rect = new Rect({ width: w, height: h, fill: grad as Gradient<'linear'> });
    this.replaceBackgroundLayer(rect);
    this.brandBackground = undefined;
    this.commit();
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

  toggleLock(): boolean {
    const o = this.active;
    if (!o) return false;
    const locked = !o.lockMovementX;
    o.set({ lockMovementX: locked, lockMovementY: locked, lockScalingX: locked, lockScalingY: locked, lockRotation: locked, hasControls: !locked });
    this.commit();
    return locked;
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

  set(props: Record<string, unknown>): void {
    const o = this.active;
    if (!o) return;
    o.set(props);
    if (o instanceof Textbox && Object.keys(props).some((k) => Textbox.textLayoutProperties.includes(k))) this.refitCurve(o);
    o.setCoords();
    this.commit();
  }

  // ---------- texto ----------

  setShadow(on: boolean, color = 'rgba(0,0,0,0.45)'): void {
    const o = this.active;
    if (!o) return;
    const m = Math.min(this.docWidth, this.docHeight);
    o.set('shadow', on ? new Shadow({ color, blur: m * 0.012, offsetX: m * 0.006, offsetY: m * 0.006 }) : null);
    this.commit();
  }

  /** Curva o texto num arco; amount em -100..100 (0 = reto). */
  setCurve(amount: number): void {
    const t = this.active;
    if (!(t instanceof Textbox)) return;
    this.curveText(t, amount);
    this.commit();
  }

  /**
   * Refaz o arco de um texto curvo com a largura atual do texto. O Fabric roda `initDimensions` a cada mudança de
   * layout (fonte, tamanho, texto, largura) e no `loadFromJSON`, o que devolve a altura do texto reto e deixa o arco com
   * o comprimento antigo (§29). Sem commit: quem chama já registra a mudança.
   */
  refitCurve(t: FabricObject): void {
    const amount = Number(t.get('curve') ?? 0);
    if (t instanceof Textbox && Math.abs(amount) >= 1) this.curveText(t, amount);
  }

  private refitCurves(): void {
    for (const o of this.canvas.getObjects()) this.refitCurve(o);
  }

  private curveText(t: Textbox, amount: number): void {
    // arco medido pelo texto, não pela caixa (§28 D)
    const arc = curveArc(t.calcTextWidth(), amount);
    const center = t.getCenterPoint();
    if (!arc) {
      t.set({ path: undefined });
    } else {
      t.set({ path: new Path(arc.d, { visible: false, fill: '', stroke: '' }), pathAlign: 'center', pathSide: 'left' });
    }
    t.set('curve', amount);
    t.initDimensions();
    // o Textbox mantém a altura do texto reto: a caixa passa a cobrir a flecha do arco, com o mesmo centro
    if (arc) t.set('height', arc.sagitta + t.getHeightOfLine(0));
    t.setPositionByOrigin(center, 'center', 'center');
    t.setCoords();
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
    if (adj.blur) list.push(new filters.Blur({ blur: adj.blur }));
    img.filters = list;
    img.applyFilters();
    img.set('filterPreset', preset);
    this.commit();
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
    img.setCoords();
    this.commit();
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

  // ---------- exportação ----------

  /**
   * Renderiza a página inteira com viewport identidade: multiplier = escala exata sobre o tamanho do
   * documento (com o zoom da tela, o tamanho arredondado do elemento vazava para a exportação).
   */
  private renderPage(scale: number, format: 'png' | 'jpeg', quality: number): string {
    // sem discardActiveObject: o toDataURL já não desenha as alças, e descartar aqui tirava a seleção (e o modo de
    // recorte) a cada miniatura do rascunho automático (§29, defeito 5)
    const vpt = this.canvas.viewportTransform;
    this.canvas.viewportTransform = [1, 0, 0, 1, 0, 0];
    try {
      return this.canvas.toDataURL({ format, quality, multiplier: scale, left: 0, top: 0, width: this.docWidth, height: this.docHeight });
    } finally {
      this.canvas.setViewportTransform(vpt);
    }
  }

  /** Raster da página em `scale` × o tamanho do documento (lado maior até 8192 px). */
  async exportRaster(format: 'png' | 'jpeg', scale: number, quality: number): Promise<string> {
    const max = 8192 / Math.max(this.docWidth, this.docHeight);
    this.canvas.discardActiveObject();
    return this.renderPage(Math.min(scale, max), format, quality);
  }

  /** Miniatura pequena para rascunhos/templates. */
  thumbnail(maxSide = 360): string {
    return this.renderPage(maxSide / Math.max(this.docWidth, this.docHeight), 'jpeg', 0.8);
  }

  /** Grava já o instantâneo que estava no debounce; true se o documento mudou. */
  flushPending(): boolean {
    window.clearTimeout(this.historyTimer);
    if (this.suspendHistory > 0 || this.maskPaths) return false;
    const changed = this.history.push(this.snapshot());
    if (changed) this.onChange();
    return changed;
  }

  /** SVG portátil: imagens e fontes embutidas como dataURL. */
  async exportSvg(): Promise<string> {
    this.canvas.discardActiveObject();
    const families = fontsUsed(this.toDocument());
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
    return inlineSvgResources(svg, browserFetcher);
  }
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
