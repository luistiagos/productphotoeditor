// Zoom e pan do palco por pinça (TASK-13): matemática pura, sem DOM nem Fabric.
//
// Coordenadas de "palco" = px CSS a partir do canto superior esquerdo da área útil do #stage. O zoom efetivo é
// Z = base × factor, onde `base` é o zoom de encaixe do `fit()` (página inteira na tela) e `factor` ∈ [0,5; 4] é o do
// usuário. Com o zoom do usuário ligado, o elemento <canvas> ocupa o palco inteiro e a página é posicionada pelo
// `viewportTransform` [Z, 0, 0, Z, e, f]; `panX/panY` = deslocamento do centro da página em relação ao centro do palco.

export const MIN_FACTOR = 0.5;
export const MAX_FACTOR = 4;
/** Paradas dos botões − / + da pílula. */
export const ZOOM_STEPS = [0.5, 0.75, 1, 1.5, 2, 3, 4];
/** Quanto da página (px CSS) fica sempre visível ao arrastar: a página nunca some inteira da tela. */
export const PAN_MARGIN = 64;

export interface ViewState { factor: number; panX: number; panY: number }
export interface StageLayout {
  /** Área útil do palco (px CSS). */
  stageW: number;
  stageH: number;
  /** Tamanho da página (px do documento). */
  docW: number;
  docH: number;
  /** Zoom de encaixe do `fit()`. */
  base: number;
}
export interface Pt { x: number; y: number }
export type Mat2D = [number, number, number, number, number, number];

export const FIT_VIEW: Readonly<ViewState> = { factor: 1, panX: 0, panY: 0 };

/** Fator 1 sem pan: o editor usa o encaixe de sempre (elemento do tamanho da página). */
export function isFitView(s: ViewState): boolean {
  return s.factor === 1 && s.panX === 0 && s.panY === 0;
}

export function clampFactor(f: number): number {
  if (!Number.isFinite(f) || f <= 0) return 1;
  return Math.min(MAX_FACTOR, Math.max(MIN_FACTOR, f));
}

/** Canto superior esquerdo da página no palco. */
export function pageOffset(s: ViewState, l: StageLayout): Pt {
  const z = l.base * s.factor;
  return { x: (l.stageW - l.docW * z) / 2 + s.panX, y: (l.stageH - l.docH * z) / 2 + s.panY };
}

/** `viewportTransform` do Fabric para o elemento do tamanho do palco. */
export function viewportMatrix(s: ViewState, l: StageLayout): Mat2D {
  const z = l.base * s.factor;
  const o = pageOffset(s, l);
  return [z, 0, 0, z, o.x, o.y];
}

/** Ponto do documento sob o ponto `p` do palco. */
export function stageToDoc(s: ViewState, l: StageLayout, p: Pt): Pt {
  const z = l.base * s.factor;
  const o = pageOffset(s, l);
  return { x: (p.x - o.x) / z, y: (p.y - o.y) / z };
}

/** Estado no fator `factor` com o pan que põe o ponto do documento `d` sob o ponto `p` do palco. */
function placeDocPoint(factor: number, d: Pt, p: Pt, l: StageLayout): ViewState {
  const z = l.base * factor;
  return {
    factor,
    panX: p.x - d.x * z - (l.stageW - l.docW * z) / 2,
    panY: p.y - d.y * z - (l.stageH - l.docH * z) / 2,
  };
}

/** Muda o fator mantendo sob `anchor` (palco) o mesmo ponto do documento. */
export function anchoredZoom(s: ViewState, anchor: Pt, newFactor: number, l: StageLayout): ViewState {
  return placeDocPoint(clampFactor(newFactor), stageToDoc(s, l, anchor), anchor, l);
}

/** Distância e ponto médio de dois dedos. */
export function touchGeometry(a: Pt, b: Pt): { dist: number; mid: Pt } {
  return { dist: Math.hypot(b.x - a.x, b.y - a.y), mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 } };
}

export interface PinchStart { view: ViewState; dist: number; mid: Pt }

/**
 * Um passo da pinça, sempre a partir do início do gesto (sem acumular erro): escala `dist / start.dist` e o ponto do
 * documento que estava sob o ponto médio inicial `M0` vai para o ponto médio atual `Mt` (zoom ancorado + pan de 2 dedos).
 */
export function pinchStep(start: PinchStart, dist: number, mid: Pt, l: StageLayout): ViewState {
  const ratio = start.dist > 0 && dist > 0 ? dist / start.dist : 1;
  const factor = clampFactor(start.view.factor * ratio);
  return placeDocPoint(factor, stageToDoc(start.view, l, start.mid), mid, l);
}

/** Limita o pan: sobra sempre ao menos `min(margin, lado da página na tela)` da página dentro do palco. */
export function clampPan(s: ViewState, l: StageLayout, margin = PAN_MARGIN): ViewState {
  const z = l.base * s.factor;
  const pw = l.docW * z;
  const ph = l.docH * z;
  const o = pageOffset(s, l);
  const mx = Math.min(margin, pw, l.stageW);
  const my = Math.min(margin, ph, l.stageH);
  const ex = Math.min(l.stageW - mx, Math.max(mx - pw, o.x));
  const ey = Math.min(l.stageH - my, Math.max(my - ph, o.y));
  return { factor: s.factor, panX: s.panX + (ex - o.x), panY: s.panY + (ey - o.y) };
}

/** Próxima parada da pílula acima (`dir = 1`) ou abaixo (`dir = -1`) do fator atual. */
export function stepFactor(current: number, dir: 1 | -1): number {
  if (dir > 0) return ZOOM_STEPS.find((f) => f > current * 1.01) ?? MAX_FACTOR;
  return [...ZOOM_STEPS].reverse().find((f) => f < current * 0.99) ?? MIN_FACTOR;
}

/** Rótulo da pílula: `100%` = página encaixada na tela. */
export function zoomLabel(factor: number): string {
  return `${Math.round(factor * 100)}%`;
}
