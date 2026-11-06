// Estúdio "📦 Mockup 3D" (TASK-08): escolhe um template (2.5D de content/mockups3d ou um dos planos de content/mockups),
// aplica o design atual ou a imagem selecionada pelo motor `mockupEngine`, com alças nos 4 cantos e sliders; insere o
// resultado no design ou salva na galeria (export 'save' da ponte, sem Kotlin novo).
// Modo Caixa 3D (TASK-19): o template `box3d` troca alças e sliders da superfície pela caixa do `box3d.ts` — Rotação X/Y,
// proporções, perspectiva e arte ou cor por face (frente, lateral, topo); as saídas são as mesmas.
// Foto própria (TASK-20): "Usar foto própria" põe uma foto da galeria (`pickImage`) como base, num plano; "🎯 Detectar
// superfície" sugere os 4 cantos pelo `surfaceDetector` (alfa do recorte ou bordas Sobel) e o usuário ajusta nas alças.
import { FabricImage } from 'fabric';
import { type Bridge, BridgeRequestError } from '../bridge';
import { contentUrl } from '../content';
import { button, colorInput, h, openSheet, select, setBusy, slider, toast } from '../dom';
import type { Editor } from '../editor';
import type { BlobResult, ExportPayload, ExportResult } from '../protocol';
import {
  ARC_DEFAULT, ARC_MAX, ARC_MIN, homographyFromQuads, isConvexQuad, type MockupParams, type MockupTemplate,
  parseFlatMockupIndex, parseMockup3dIndex, type Pixels, type Pt, type Quad, renderMockup, SHADING_DEFAULT, type Shape,
  TILT_LIMIT, transformPoints,
} from './mockupEngine';
import { centralQuad, type DetectMethod, detectSurfaceQuad } from './surfaceDetector';
import {
  type BoxFace, boxFaces, type BoxParams, type BoxSource, type BoxTemplate, FACE_SLOTS, type FaceSlot, FOV_MAX, FOV_MIN,
  parseBoxTemplates, RATIO_MAX, RATIO_MIN, type Rect, rectOfQuad, renderBox, ROT_X_LIMIT, ROT_Y_LIMIT,
} from './box3d';

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
/** id do template de sessão da foto própria (não vai para índice nenhum). */
const OWN_ID = 'own';

type ArtSource = 'design' | 'image';
/** Fonte de uma face da caixa: a arte (design/imagem) ou uma cor sólida. */
type FaceArt = ArtSource | 'color';
type StudioTemplate = MockupTemplate | BoxTemplate;
const FACE_LABELS: Record<FaceSlot, string> = { front: 'Frente', side: 'Lateral', top: 'Topo' };
/** Papelão: as cores da lateral/topo quando o design não dá para ler. */
const KRAFT = '#c49c6c';
const BOX_SHADOW = 0.3;
const HINT_SURFACE = 'Arraste as alças para encaixar a arte (🎯 Detectar superfície sugere os cantos). Arco e Inclinação '
  + 'valem para Cilindro e Esfera; a fusão traz as dobras e a luz da foto para a arte.';
const HINT_BOX = 'Gire a caixa com Rotação X e Y. Cada face recebe o design, a imagem selecionada ou uma cor; a arte '
  + 'preenche a face sem deformar (ajuste Largura e Altura à proporção dela para não cortar).';

const hex2 = (v: number) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, '0');
const rgbHex = (r: number, g: number, b: number) => `#${hex2(r)}${hex2(g)}${hex2(b)}`;
function hexRgb(hex: string): [number, number, number] {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  return m ? [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)] : [255, 255, 255];
}

/** Cor média da moldura (2 % de cada borda) de uma arte, sobre branco: em geral o fundo do design. */
function edgeColor(p: Pixels): string {
  const { data, width: w, height: hh } = p;
  const m = Math.max(1, Math.round(Math.min(w, hh) * 0.02));
  const acc = [0, 0, 0];
  let n = 0;
  for (let y = 0; y < hh; y++) {
    for (let x = 0; x < w; x++) {
      if (y >= m && y < hh - m && x >= m && x < w - m) x = w - m; // miolo: pula para a borda direita
      const o = (y * w + x) * 4;
      const a = data[o + 3] / 255;
      for (let c = 0; c < 3; c++) acc[c] += data[o + c] * a + 255 * (1 - a);
      n++;
    }
  }
  return n ? rgbHex(acc[0] / n, acc[1] / n, acc[2] / n) : KRAFT;
}

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

/** Todos os pixels com α = 255. */
function isOpaque(p: Pixels): boolean {
  for (let o = 3; o < p.data.length; o += 4) if (p.data[o] !== 255) return false;
  return true;
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

  let templates: StudioTemplate[] = [];
  let tpl: StudioTemplate | null = null;
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
  /** A base não tem pixel transparente (os templates; a foto própria em JPEG). */
  let baseOpaque = true;
  let renders = 0;
  let raf = 0;
  let loadToken = 0;
  let closed = false;
  /** Resultado da última detecção na base atual (null: nenhuma desde que a base foi escolhida). */
  let lastDetect: DetectMethod | null = null;
  // caixa 3D
  const box: BoxParams = { rotX: 0, rotY: 0, boxRatio: { w: 1, h: 1, d: 1 }, fov: 35 };
  const faceArt: Record<FaceSlot, FaceArt> = { front: 'design', side: 'color', top: 'color' };
  const faceColor: Record<FaceSlot, string> = { front: KRAFT, side: KRAFT, top: KRAFT };
  let boxColorsSet = false;
  /** Faces do último preview (px do preview), para o estado exposto. */
  let lastFaces: BoxFace[] = [];
  const isBox = () => tpl?.shape === 'box3d';

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
  const ownBtn = button('📷 Usar foto própria', () => void useOwnPhoto(), 'mockup-own');
  const detectBtn = button('🎯 Detectar superfície', () => detect(), 'mockup-detect');
  const detectRow = h('div', { class: 'row' }, detectBtn);
  // ---------- controles da caixa 3D ----------
  const boxSlider = (label: string, cls: string, min: number, max: number, step: number, set: (v: number) => void) => {
    const row = slider(label, min, max, step, min, (v) => { set(v); schedule(); });
    row.classList.add(cls);
    return row;
  };
  const rotXRow = boxSlider('Rotação X', 'mockup-rotx', -ROT_X_LIMIT, ROT_X_LIMIT, 1, (v) => { box.rotX = v; });
  const rotYRow = boxSlider('Rotação Y', 'mockup-roty', -ROT_Y_LIMIT, ROT_Y_LIMIT, 1, (v) => { box.rotY = v; });
  const boxWRow = boxSlider('Largura', 'mockup-box-w', RATIO_MIN, RATIO_MAX, 0.05, (v) => { box.boxRatio.w = v; });
  const boxHRow = boxSlider('Altura', 'mockup-box-h', RATIO_MIN, RATIO_MAX, 0.05, (v) => { box.boxRatio.h = v; });
  const boxDRow = boxSlider('Profundidade', 'mockup-box-d', RATIO_MIN, RATIO_MAX, 0.05, (v) => { box.boxRatio.d = v; });
  const fovRow = boxSlider('Perspectiva', 'mockup-fov', FOV_MIN, FOV_MAX, 1, (v) => { box.fov = v; });
  const faceOptions: [string, string][] = [['design', 'Design atual']];
  if (selected) faceOptions.push(['image', 'Imagem selecionada']);
  faceOptions.push(['color', 'Cor']);
  const faceRows = {} as Record<FaceSlot, { sel: HTMLSelectElement; color: HTMLInputElement }>;
  const faceRowEls = FACE_SLOTS.map((slot) => {
    const selRow = select(FACE_LABELS[slot], faceOptions, faceArt[slot], (v) => setFaceArt(slot, v as FaceArt));
    // escolher uma cor já passa a face para "Cor"
    const colRow = colorInput('', faceColor[slot], (v) => {
      faceColor[slot] = v;
      faceArt[slot] = 'color';
      faceRows[slot].sel.value = 'color';
      schedule();
    });
    faceRows[slot] = { sel: selRow.querySelector('select')!, color: colRow.querySelector('input')! };
    return h('div', { class: 'row mockup-face', 'data-slot': slot }, selRow, colRow);
  });
  const boxControls = h('div', { class: 'mockup-box' }, rotXRow, rotYRow, boxWRow, boxHRow, boxDRow, fovRow, ...faceRowEls);
  boxControls.hidden = true;

  const controls = h('div', { class: 'mockup-controls' }, detectRow, shapeRow, artRow, arcRow, tiltRow, fuseRow, boxControls,
    h('div', { class: 'row' }, insertBtn, saveBtn));
  controls.hidden = true;
  const hint = h('p', { class: 'hint' }, HINT_SURFACE);
  const ownRow = h('div', { class: 'row mockup-own-row' }, ownBtn);
  const root = h('div', { class: 'mockup-studio' }, ownRow, grid, stage, controls, hint);
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
    template: tpl?.id ?? null, shape: isBox() ? 'box3d' : shape, quad, arcDeg, tiltDepth, shadingStrength: strength,
    art: artSource, baseWidth: tpl?.width ?? 0, baseHeight: tpl?.height ?? 0, previewWidth: canvas.width,
    previewHeight: canvas.height, renders,
    // foto própria (TASK-20): método da última detecção na base atual ('alpha' | 'sobel' | 'fallback' | null)
    detect: lastDetect,
    // caixa 3D: parâmetros, fonte de cada face e as faces visíveis do último preview (ordem de pintura; quads em px do preview)
    box: isBox() ? {
      rotX: box.rotX, rotY: box.rotY, boxRatio: { ...box.boxRatio }, fov: box.fov, faceArt: { ...faceArt },
      faceColor: { ...faceColor },
      visibleFaces: lastFaces.map((f) => f.name),
      faceQuads: Object.fromEntries(lastFaces.map((f) => [f.name, f.quad])),
      faceLight: Object.fromEntries(lastFaces.map((f) => [f.name, f.light])),
    } : null,
  });
  (window as unknown as Record<string, unknown>).__mockupStudio = {
    state,
    /** Pixels do preview sem a arte (a base reduzida), para medir a diferença. */
    basePreview: () => basePreview,
  };

  // ---------- arte ----------
  const artCache = new Map<ArtSource, { full: Pixels; preview: Pixels }>();
  /** Pixels da arte (inteira e reduzida ao preview), lidos uma vez; lança `SecurityError` em canvas sujo. */
  const readArt = (src: ArtSource): { full: Pixels; preview: Pixels } => {
    const key: ArtSource = src === 'image' && selected ? 'image' : 'design';
    let a = artCache.get(key);
    if (!a) {
      const c = key === 'image' ? readSelected() : readDesign();
      a = { full: canvasPixels(c), preview: canvasPixels(scaledCanvas(c, c.width, c.height, PREVIEW_MAX)) };
      artCache.set(key, a);
    }
    return a;
  };
  const readDesign = (): HTMLCanvasElement => editor.renderPageCanvas(ART_MAX).canvas;
  const readSelected = (): HTMLCanvasElement => {
    const img = selected!;
    const k = Math.min(1, ART_MAX / Math.max(img.width, img.height, 1));
    return img.toCanvasElement({ multiplier: k, withoutTransform: true, withoutShadow: true });
  };
  async function setArt(src: ArtSource): Promise<void> {
    try {
      const a = readArt(src);
      artFull = a.full;
      artPreview = a.preview;
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

  /** Fonte de uma face: arte ilegível (canvas sujo) volta a face para a cor, com aviso. */
  function setFaceArt(slot: FaceSlot, v: FaceArt): void {
    if (v !== 'color') {
      try {
        readArt(v);
      } catch (e) {
        console.warn('mockup caixa arte', e);
        toast('Não dá para ler os pixels desta arte; usando a cor');
        v = 'color';
      }
    }
    faceArt[slot] = v;
    faceRows[slot].sel.value = v;
    schedule();
  }

  /** Na 1ª vez no modo caixa: lateral e topo na cor da moldura do design (em geral o fundo dele), a frente com o design. */
  function initBoxColors(): void {
    if (boxColorsSet) return;
    boxColorsSet = true;
    let edge = KRAFT;
    try {
      edge = edgeColor(readArt('design').preview);
    } catch {
      faceArt.front = 'color';
      faceRows.front.sel.value = 'color';
    }
    for (const slot of ['side', 'top'] as FaceSlot[]) {
      faceColor[slot] = edge;
      faceRows[slot].color.value = edge; // sem evento: não muda a fonte da face
    }
  }

  const boxSources = (which: 'full' | 'preview'): Record<FaceSlot, BoxSource> => {
    const out = {} as Record<FaceSlot, BoxSource>;
    for (const slot of FACE_SLOTS) {
      const a = faceArt[slot];
      let src: BoxSource = { kind: 'color', rgb: hexRgb(faceColor[slot]) };
      if (a !== 'color') {
        try {
          src = { kind: 'art', pixels: readArt(a)[which] };
        } catch (e) {
          console.warn('mockup caixa arte', e); // a face sai na cor (setFaceArt já avisou)
        }
      }
      out[slot] = src;
    }
    return out;
  };

  /** Modo caixa: troca alças e controles da superfície pelos da caixa (e vice-versa). */
  function setBoxMode(on: boolean): void {
    // o quad da caixa não é editável (vira o retângulo de encaixe): sem alças, sem detecção
    for (const el of [shapeRow, artRow, arcRow, tiltRow, fuseRow, detectRow, ...handles]) el.hidden = on;
    boxControls.hidden = !on;
    hint.textContent = on ? HINT_BOX : HINT_SURFACE;
  }

  // ---------- templates ----------
  async function loadTemplates(): Promise<void> {
    const [d3, flat] = await Promise.allSettled([fetchIndex('mockups3d/index.json'), fetchIndex('mockups/index.json')]);
    templates = [
      ...(d3.status === 'fulfilled' ? parseMockup3dIndex(d3.value) : []),
      ...(d3.status === 'fulfilled' ? parseBoxTemplates(d3.value) : []),
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

  const markTile = (id: string | undefined) => {
    for (const b of grid.querySelectorAll<HTMLElement>('.mockup-tile')) b.classList.toggle('primary', b.dataset.id === id);
  };

  /** Carrega a base de `t` (do conteúdo empacotado, ou a URL de blob da foto própria) e a põe no estúdio. */
  async function choose(t: StudioTemplate): Promise<boolean> {
    const token = ++loadToken;
    markTile(t.id);
    let img: HTMLImageElement;
    try {
      img = await loadImage(contentUrl(t.file));
    } catch (e) {
      if (token === loadToken) markTile(tpl?.id); // a base anterior continua
      toast(describe(e));
      return false;
    }
    if (token !== loadToken || closed) return false;
    tpl = t;
    baseImage = img;
    lastDetect = null;
    basePreview = canvasPixels(scaledCanvas(img, t.width, t.height, PREVIEW_MAX));
    baseOpaque = isOpaque(basePreview);
    canvas.width = basePreview.width;
    canvas.height = basePreview.height;
    quad = t.quad.map((p) => [p[0], p[1]]) as Quad;
    if (t.shape === 'box3d') {
      initBoxColors();
      setRange(rotXRow, t.rotX);
      setRange(rotYRow, t.rotY);
      setRange(boxWRow, t.boxRatio.w);
      setRange(boxHRow, t.boxRatio.h);
      setRange(boxDRow, t.boxRatio.d);
      setRange(fovRow, t.fov);
    } else {
      shape = t.shape;
      (shapeRow.querySelector('select') as HTMLSelectElement).value = shape;
      setRange(arcRow, t.arcDeg);
      setRange(tiltRow, t.tiltDepth);
      setRange(fuseRow, t.shadingStrength);
    }
    setBoxMode(t.shape === 'box3d');
    stage.hidden = false;
    controls.hidden = false;
    placeHandles();
    schedule();
    stage.scrollIntoView({ block: 'nearest' });
    return true;
  }

  // ---------- foto própria (TASK-20) ----------
  /** Galeria → base do estúdio (plano, quad central). Cancelar no seletor não avisa; outro erro → toast, estúdio intacto. */
  async function useOwnPhoto(): Promise<void> {
    setBusy('Abrindo foto');
    try {
      let r: BlobResult;
      try {
        r = await bridge.request<BlobResult>('pickImage');
      } catch (e) {
        if (!(e instanceof BridgeRequestError && e.code === 'cancelled')) toast(describe(e));
        return;
      }
      if (closed) return;
      const own: MockupTemplate = {
        id: OWN_ID, name: 'Foto própria', shape: 'plane', file: r.url, thumb: r.url, width: r.width, height: r.height,
        quad: centralQuad(r.width, r.height), arcDeg: ARC_DEFAULT, tiltDepth: 0, shadingStrength: SHADING_DEFAULT,
      };
      if (await choose(own)) toast('Foto carregada: toque em 🎯 Detectar superfície ou arraste as alças');
    } finally {
      setBusy(null);
    }
  }

  /**
   * Sugere os 4 cantos na base atual: o detector roda sobre o `basePreview` (≤ 512 px; ele reduz a 256) e o quad volta
   * para px da base. Sem superfície clara → quad central e aviso para ajustar as alças.
   */
  function detect(): void {
    if (!tpl || !basePreview || isBox()) return;
    let method: DetectMethod;
    try {
      const r = detectSurfaceQuad(basePreview);
      const kx = tpl.width / basePreview.width;
      const ky = tpl.height / basePreview.height;
      const next = r.quad.map(([x, y]) => [x * kx, y * ky]) as Quad;
      if (!isConvexQuad(next)) throw new Error('quad detectado inválido');
      quad = next;
      method = r.method;
    } catch (e) {
      console.warn('mockup detectar', e);
      toast('Não foi possível analisar a foto');
      return;
    }
    lastDetect = method;
    placeHandles();
    schedule();
    toast(method === 'fallback' ? 'Nenhuma superfície clara: ajuste as 4 alças' : 'Superfície detectada: ajuste as alças se precisar');
  }

  // ---------- render ----------
  /** A malha do template acompanha o quad atual (homografia quad do template → quad atual); só no plano. */
  const currentMesh = (): Pt[] | undefined => {
    if (!tpl || tpl.shape === 'box3d' || !tpl.mesh || shape !== 'plane') return undefined;
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

  /** A caixa sobre `base`, com a área de encaixe (o quad do template) escalada por `k`. */
  const renderBoxAt = (base: Pixels, k: number, which: 'full' | 'preview'): { out: Pixels; faces: BoxFace[] } => {
    const r = rectOfQuad(quad);
    const rect: Rect = { x: r.x * k, y: r.y * k, w: r.w * k, h: r.h * k };
    const faces = boxFaces(box, rect);
    return { out: renderBox(base, faces, boxSources(which), { shadow: BOX_SHADOW }), faces };
  };

  function renderPreview(): void {
    raf = 0;
    if (closed || !tpl || !basePreview) return;
    const k = basePreview.width / tpl.width;
    let out: Pixels;
    if (isBox()) {
      const r = renderBoxAt(basePreview, k, 'preview');
      out = r.out;
      lastFaces = r.faces;
    } else {
      out = artPreview ? renderMockup(basePreview, artPreview, paramsAt(k)) : basePreview;
    }
    const ctx = canvas.getContext('2d')!;
    const id = ctx.createImageData(out.width, out.height);
    id.data.set(out.data);
    ctx.putImageData(id, 0, 0);
    renders++;
    canvas.dataset.state = JSON.stringify(state());
  }

  /**
   * Render na resolução da base → dataURL JPEG 0,92 (base opaca; PNG de 1200–1600² inflaria o rascunho). Base com
   * transparência (foto própria recortada, TASK-20): `insert` → PNG, que leva o recorte ao design; `save` → JPEG sobre
   * branco (sem isso o transparente sai preto).
   */
  async function renderFull(kind: 'insert' | 'save'): Promise<string | null> {
    if (!tpl || !baseImage) return null;
    const boxMode = isBox();
    if (!boxMode && !artFull) { toast('Sem arte para aplicar'); return null; }
    const c = scaledCanvas(baseImage, tpl.width, tpl.height, Math.max(tpl.width, tpl.height));
    const base = canvasPixels(c);
    const out = boxMode || !artFull ? renderBoxAt(base, 1, 'full').out : renderMockup(base, artFull, paramsAt(1));
    const ctx = c.getContext('2d')!;
    const id = ctx.createImageData(out.width, out.height);
    id.data.set(out.data);
    ctx.putImageData(id, 0, 0);
    if (baseOpaque) return c.toDataURL('image/jpeg', 0.92);
    if (kind === 'insert') return c.toDataURL('image/png');
    const flat = document.createElement('canvas');
    flat.width = c.width;
    flat.height = c.height;
    const fx = flat.getContext('2d')!;
    fx.fillStyle = '#ffffff';
    fx.fillRect(0, 0, flat.width, flat.height);
    fx.drawImage(c, 0, 0);
    return flat.toDataURL('image/jpeg', 0.92);
  }

  async function insert(): Promise<void> {
    setBusy('Gerando o mockup');
    try {
      await nextFrame();
      const url = await renderFull('insert');
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
      const data = await renderFull('save');
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
