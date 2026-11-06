// Estúdio "📦 Mockup 3D" (TASK-08): escolhe um template (2.5D de content/mockups3d ou um dos planos de content/mockups),
// aplica o design atual ou a imagem selecionada pelo motor `mockupEngine`, com alças nos 4 cantos e sliders; insere o
// resultado no design ou salva na galeria (export 'save' da ponte, sem Kotlin novo).
import { FabricImage } from 'fabric';
import type { Bridge } from '../bridge';
import { contentUrl } from '../content';
import { button, h, openSheet, select, setBusy, slider, toast } from '../dom';
import type { Editor } from '../editor';
import type { ExportPayload, ExportResult } from '../protocol';
import {
  ARC_DEFAULT, ARC_MAX, ARC_MIN, homographyFromQuads, isConvexQuad, type MockupParams, type MockupTemplate,
  parseFlatMockupIndex, parseMockup3dIndex, type Pixels, type Pt, type Quad, renderMockup, type Shape, TILT_LIMIT,
  transformPoints,
} from './mockupEngine';

export interface MockupStudioDeps {
  editor: Editor;
  bridge: Bridge;
  /** Mensagem legível de um erro (a da ponte inclusive). */
  describe: (e: unknown) => string;
}

/** Lado máximo do preview (o render por pixel em JS é caro: a resolução cheia só ao aplicar). */
const PREVIEW_MAX = 512;
/** Lado máximo da arte lida (design ou imagem). */
const ART_MAX = 1600;
const SHAPE_LABELS: [Shape, string][] = [['plane', 'Plano'], ['cylinder', 'Cilindro'], ['sphere', 'Esfera']];

type ArtSource = 'design' | 'image';

/** Pixels de um canvas inteiro; lança `SecurityError` se o canvas estiver sujo (imagem de outra origem). */
function canvasPixels(c: HTMLCanvasElement): Pixels {
  const img = c.getContext('2d')!.getImageData(0, 0, c.width, c.height);
  return { data: img.data, width: img.width, height: img.height };
}

/** Redesenha `src` num canvas com lado maior ≤ `max` (o navegador filtra a redução melhor que o bilinear do motor). */
function scaledCanvas(src: CanvasImageSource, w: number, hgt: number, max: number): HTMLCanvasElement {
  const k = Math.min(1, max / Math.max(w, hgt));
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w * k));
  c.height = Math.max(1, Math.round(hgt * k));
  const ctx = c.getContext('2d')!;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(src, 0, 0, c.width, c.height);
  return c;
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const im = new Image();
    im.onload = () => resolve(im);
    im.onerror = () => reject(new Error(`imagem não carregou: ${url}`));
    im.src = url;
  });
}

async function fetchIndex(file: string): Promise<unknown> {
  const res = await fetch(contentUrl(file));
  if (!res.ok) throw new Error(`content ${file}: ${res.status}`);
  return res.json();
}

/** Dá um quadro ao navegador (o `setBusy` aparece antes do render pesado, que é síncrono). */
const nextFrame = () => new Promise<void>((r) => requestAnimationFrame(() => setTimeout(r, 0)));

export function openMockupStudio(deps: MockupStudioDeps): void {
  const { editor, bridge, describe } = deps;
  const selected = editor.active instanceof FabricImage ? editor.active : null;

  let templates: MockupTemplate[] = [];
  let tpl: MockupTemplate | null = null;
  let shape: Shape = 'plane';
  let quad: Quad = [[0, 0], [1, 0], [1, 1], [0, 1]];
  let arcDeg = ARC_DEFAULT;
  let tiltDepth = 0;
  let strength = 0.65;
  let artSource: ArtSource = 'design';
  let artFull: Pixels | null = null;
  let artPreview: Pixels | null = null;
  let baseImage: HTMLImageElement | null = null;
  let basePreview: Pixels | null = null;
  let renders = 0;
  let raf = 0;
  let loadToken = 0;
  let closed = false;

  // ---------- elementos ----------
  const grid = h('div', { class: 'grid small mockup-templates' }, h('p', { class: 'hint' }, 'Carregando templates…'));
  const canvas = h('canvas', { class: 'mockup-preview' });
  const handles = [0, 1, 2, 3].map((i) => h('div', { class: 'mockup-handle', 'data-corner': i }));
  const stage = h('div', { class: 'mockup-stage' }, canvas, ...handles);
  stage.hidden = true;
  const shapeRow = select('Forma', SHAPE_LABELS, shape, (v) => { shape = v as Shape; schedule(); });
  const artOptions: [string, string][] = [['design', 'Design atual']];
  if (selected) artOptions.push(['image', 'Imagem selecionada']);
  const artRow = select('Arte', artOptions, artSource, (v) => { void setArt(v as ArtSource); });
  const arcRow = slider('Arco', ARC_MIN, ARC_MAX, 1, arcDeg, (v) => { arcDeg = v; schedule(); });
  const tiltRow = slider('Inclinação', -TILT_LIMIT, TILT_LIMIT, 0.01, tiltDepth, (v) => { tiltDepth = v; schedule(); });
  const fuseRow = slider('Fusão com dobras/luz', 0, 1, 0.01, strength, (v) => { strength = v; schedule(); });
  arcRow.classList.add('mockup-arc');
  tiltRow.classList.add('mockup-tilt');
  fuseRow.classList.add('mockup-fuse');
  shapeRow.classList.add('mockup-shape');
  artRow.classList.add('mockup-art');
  const insertBtn = button('Inserir no design', () => void insert(), 'primary mockup-insert');
  const saveBtn = button('Salvar na galeria', () => void save(), 'mockup-save');
  const controls = h('div', { class: 'mockup-controls' }, shapeRow, artRow, arcRow, tiltRow, fuseRow,
    h('div', { class: 'row' }, insertBtn, saveBtn));
  controls.hidden = true;
  const root = h('div', { class: 'mockup-studio' }, grid, stage, controls,
    h('p', { class: 'hint' }, 'Arraste as alças para encaixar a arte. Arco e Inclinação valem para Cilindro e Esfera; a fusão '
      + 'traz as dobras e a luz da foto para a arte.'));
  const closeSheet = openSheet('📦 Mockup 3D', root, { tall: true });
  const close = () => { closed = true; cancelAnimationFrame(raf); closeSheet(); };
  document.querySelector('#sheet .scrim')?.addEventListener('click', () => { closed = true; });
  document.querySelector('#sheet .sheet-head button')?.addEventListener('click', () => { closed = true; });

  const setRange = (row: HTMLElement, v: number) => {
    const input = row.querySelector('input')!;
    input.value = String(v);
    input.dispatchEvent(new Event('input'));
  };

  // ---------- estado exposto (só leitura, para o E2E) ----------
  const state = () => ({
    template: tpl?.id ?? null, shape, quad, arcDeg, tiltDepth, shadingStrength: strength, art: artSource,
    baseWidth: tpl?.width ?? 0, baseHeight: tpl?.height ?? 0, previewWidth: canvas.width, previewHeight: canvas.height, renders,
  });
  (window as unknown as Record<string, unknown>).__mockupStudio = {
    state,
    /** Pixels do preview sem a arte (a base reduzida), para medir a diferença. */
    basePreview: () => basePreview,
  };

  // ---------- arte ----------
  const readDesign = (): HTMLCanvasElement => editor.renderPageCanvas(ART_MAX).canvas;
  const readSelected = (): HTMLCanvasElement => {
    const img = selected!;
    const k = Math.min(1, ART_MAX / Math.max(img.width, img.height, 1));
    return img.toCanvasElement({ multiplier: k, withoutTransform: true, withoutShadow: true });
  };
  async function setArt(src: ArtSource): Promise<void> {
    try {
      const c = src === 'image' && selected ? readSelected() : readDesign();
      artFull = canvasPixels(c);
      artPreview = canvasPixels(scaledCanvas(c, c.width, c.height, PREVIEW_MAX));
      artSource = src;
    } catch (e) {
      // imagem de outra origem (catálogo remoto) suja o canvas: getImageData lança SecurityError
      console.warn('mockup arte', e);
      if (src === 'image') {
        toast('Não dá para ler os pixels desta imagem; usando o design atual');
        (artRow.querySelector('select') as HTMLSelectElement).value = 'design';
        await setArt('design');
        return;
      }
      toast('Não dá para ler os pixels do design (imagem de outra origem?)');
      artFull = null;
      artPreview = null;
    }
    schedule();
  }

  // ---------- templates ----------
  async function loadTemplates(): Promise<void> {
    const [d3, flat] = await Promise.allSettled([fetchIndex('mockups3d/index.json'), fetchIndex('mockups/index.json')]);
    templates = [
      ...(d3.status === 'fulfilled' ? parseMockup3dIndex(d3.value) : []),
      ...(flat.status === 'fulfilled' ? parseFlatMockupIndex(flat.value) : []),
    ];
    if (d3.status === 'rejected') console.warn('mockups3d', d3.reason);
    if (templates.length === 0) {
      grid.replaceChildren(h('p', { class: 'hint' }, 'Nenhum template de mockup encontrado.'));
      return;
    }
    grid.replaceChildren(...templates.map((t) => h('button', {
      class: 'tile mockup-tile', type: 'button', 'data-id': t.id, onclick: () => void choose(t),
    }, h('img', { alt: t.name, src: contentUrl(t.thumb) }), h('span', {}, t.name))));
  }

  async function choose(t: MockupTemplate): Promise<void> {
    const token = ++loadToken;
    for (const b of grid.querySelectorAll<HTMLElement>('.mockup-tile')) b.classList.toggle('primary', b.dataset.id === t.id);
    let img: HTMLImageElement;
    try {
      img = await loadImage(contentUrl(t.file));
    } catch (e) {
      toast(describe(e));
      return;
    }
    if (token !== loadToken || closed) return;
    tpl = t;
    baseImage = img;
    basePreview = canvasPixels(scaledCanvas(img, t.width, t.height, PREVIEW_MAX));
    canvas.width = basePreview.width;
    canvas.height = basePreview.height;
    quad = t.quad.map((p) => [p[0], p[1]]) as Quad;
    shape = t.shape;
    (shapeRow.querySelector('select') as HTMLSelectElement).value = shape;
    setRange(arcRow, t.arcDeg);
    setRange(tiltRow, t.tiltDepth);
    setRange(fuseRow, t.shadingStrength);
    stage.hidden = false;
    controls.hidden = false;
    placeHandles();
    schedule();
    stage.scrollIntoView({ block: 'nearest' });
  }

  // ---------- render ----------
  /** A malha do template acompanha o quad atual (homografia quad do template → quad atual); só no plano. */
  const currentMesh = (): Pt[] | undefined => {
    if (!tpl?.mesh || shape !== 'plane') return undefined;
    const m = homographyFromQuads(tpl.quad, quad);
    return m ? transformPoints(m, tpl.mesh) : undefined;
  };
  const paramsAt = (k: number): MockupParams => {
    const mesh = currentMesh();
    return {
      shape, arcDeg, tiltDepth, shadingStrength: strength,
      quad: quad.map(([x, y]) => [x * k, y * k]) as Quad,
      mesh: mesh?.map(([x, y]) => [x * k, y * k] as Pt),
    };
  };

  function schedule(): void {
    if (raf || closed) return;
    raf = requestAnimationFrame(renderPreview);
  }

  function renderPreview(): void {
    raf = 0;
    if (closed || !tpl || !basePreview) return;
    const out = artPreview ? renderMockup(basePreview, artPreview, paramsAt(basePreview.width / tpl.width)) : basePreview;
    const ctx = canvas.getContext('2d')!;
    const id = ctx.createImageData(out.width, out.height);
    id.data.set(out.data);
    ctx.putImageData(id, 0, 0);
    renders++;
    canvas.dataset.state = JSON.stringify(state());
  }

  /** Render na resolução da base → dataURL JPEG 0,92 (a base é opaca; PNG de 1200–1600² inflaria o rascunho). */
  async function renderFull(): Promise<string | null> {
    if (!tpl || !baseImage) return null;
    if (!artFull) { toast('Sem arte para aplicar'); return null; }
    const c = scaledCanvas(baseImage, tpl.width, tpl.height, Math.max(tpl.width, tpl.height));
    const base = canvasPixels(c);
    const out = renderMockup(base, artFull, paramsAt(1));
    const ctx = c.getContext('2d')!;
    const id = ctx.createImageData(out.width, out.height);
    id.data.set(out.data);
    ctx.putImageData(id, 0, 0);
    return c.toDataURL('image/jpeg', 0.92);
  }

  async function insert(): Promise<void> {
    setBusy('Gerando o mockup');
    try {
      await nextFrame();
      const url = await renderFull();
      if (!url) return;
      await editor.addImage(url, { fit: 0.8 });
      close();
      toast('Mockup inserido no design');
    } catch (e) {
      toast(describe(e));
    } finally {
      setBusy(null);
    }
  }

  async function save(): Promise<void> {
    setBusy('Salvando o mockup');
    try {
      await nextFrame();
      const data = await renderFull();
      if (!data) return;
      const name = `mockup_${tpl?.id ?? 'design'}`.replace(/[^\p{L}\p{N}_-]+/gu, '_');
      const r = await bridge.request<ExportResult>('export', { format: 'jpg', action: 'save', name, data } satisfies ExportPayload);
      toast(r.location ? `Salvo em ${r.location}` : 'Pronto');
    } catch (e) {
      toast(describe(e));
    } finally {
      setBusy(null);
    }
  }

  // ---------- alças ----------
  function placeHandles(): void {
    if (!tpl) return;
    handles.forEach((el, i) => {
      el.style.left = `${(quad[i][0] / tpl!.width) * 100}%`;
      el.style.top = `${(quad[i][1] / tpl!.height) * 100}%`;
    });
  }
  handles.forEach((el, i) => {
    let pointer: number | null = null;
    el.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      pointer = e.pointerId;
      el.setPointerCapture(e.pointerId);
      el.classList.add('dragging');
    });
    el.addEventListener('pointermove', (e) => {
      if (pointer !== e.pointerId || !tpl) return;
      e.preventDefault();
      const r = canvas.getBoundingClientRect();
      if (r.width <= 0 || r.height <= 0) return;
      const x = Math.min(tpl.width, Math.max(0, ((e.clientX - r.left) / r.width) * tpl.width));
      const y = Math.min(tpl.height, Math.max(0, ((e.clientY - r.top) / r.height) * tpl.height));
      const next = quad.map((p) => [p[0], p[1]]) as Quad;
      next[i] = [x, y];
      if (!isConvexQuad(next)) return; // não deixa o rótulo virar do avesso
      quad = next;
      placeHandles();
      schedule();
    });
    const end = (e: PointerEvent) => {
      if (pointer !== e.pointerId) return;
      pointer = null;
      el.classList.remove('dragging');
    };
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);
  });

  void setArt('design');
  void loadTemplates().catch((e: unknown) => {
    grid.replaceChildren(h('p', { class: 'hint' }, 'Templates indisponíveis'));
    toast(describe(e));
  });
}
