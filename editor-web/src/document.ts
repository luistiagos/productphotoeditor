// Formato do projeto do editor (rascunho, template). Envolve o JSON do Fabric com o tamanho do
// canvas e uma versão própria, para que uma mudança de formato não dependa da versão do Fabric.

export const DOC_FORMAT = 'pp-editor';
export const DOC_VERSION = 1;

export type FabricJson = { objects: unknown[]; background?: unknown; [k: string]: unknown };

export type AnimationFx =
  | 'none'
  | 'fade'
  | 'zoom_in'
  | 'zoom_out'
  | 'slide_left'
  | 'slide_right'
  | 'slide_up'
  | 'slide_down'
  | 'shake'
  | 'rotate'
  | 'float'
  | 'ken_burns'
  | 'pulse';

export type EntranceFx = 'none' | 'fade' | 'zoom_in' | 'zoom_out' | 'slide_left' | 'slide_right' | 'slide_up' | 'slide_down';
export type EmphasisFx = 'none' | 'pulse' | 'shake' | 'float' | 'rotate' | 'ken_burns';
export type ExitFx = 'none' | 'fade_out' | 'zoom_out' | 'slide_out';
export type EasingCurve = 'linear' | 'ease_out' | 'ease_in_out' | 'bounce';

/**
 * Animação da camada no vídeo. Formato antigo: só `fx` (entrada que dura `duration`, ou ênfase), camada até o fim do
 * vídeo. Formato novo (TASK-04): qualquer um de `inFx`/`emphasisFx`/`outFx` presente → a camada fica na tela de
 * `startTime` a `startTime + duration`, entra em `inDuration`, enfatiza no meio e sai nos últimos `outDuration`.
 * `fx` continua preenchido (resumo) para leitores antigos. A conta está em `video/animation.ts`.
 */
export interface LayerAnimation {
  fx: AnimationFx;
  startTime: number;
  duration: number;
  speed?: number;
  fxOut?: 'none' | 'fade';
  inFx?: EntranceFx;
  inDuration?: number;
  emphasisFx?: EmphasisFx;
  outFx?: ExitFx;
  outDuration?: number;
  easing?: EasingCurve;
}

export interface VideoSettings {
  duration: number;
  fps: number;
  width: number;
  height: number;
  audioUrl?: string;
  /** Nome mostrado na UI (trilha empacotada ou arquivo do celular). */
  audioName?: string;
  audioVolume?: number;
  audioStartTime?: number;
  /** Fade-out de 1 s no fim do vídeo. */
  audioFadeOut?: boolean;
}

export interface EditorDocument {
  format: typeof DOC_FORMAT;
  version: typeof DOC_VERSION;
  name: string;
  width: number;
  height: number;
  videoSettings?: VideoSettings;
  fabric: FabricJson;
}

export class DocumentError extends Error {}

/** Propriedades próprias que entram no toObject() de todo objeto (FabricObject.customProperties). */
export const CUSTOM_PROPERTIES = [
  'brandColor',
  'brandStroke',
  'brandFont',
  'brandLogo',
  'brandSample',
  'layerName',
  'curve',
  'warpStyle',
  'warpBend',
  'warpDistortH',
  'warpDistortV',
  'filterPreset',
  'animation',
  'locked',
  // TASK-12: degradê do usuário, estilo do tracejado, tipo de forma (troca) e linha/seta paramétrica
  'customGradient',
  'strokeDashStyle',
  'shapeKind',
  'connectorSpec',
  // TASK-05: QR Code e tabela reeditáveis (dados do formulário; sem campo `type`, que o fromObject reviveria)
  'qrConfig',
  'tableData',
] as const;

export const MAX_SIDE = 8000;

export function createDocument(
  name: string,
  width: number,
  height: number,
  fabric: FabricJson,
  videoSettings?: VideoSettings,
): EditorDocument {
  checkSize(width, height);
  return { format: DOC_FORMAT, version: DOC_VERSION, name, width, height, videoSettings, fabric };
}

function checkSize(width: unknown, height: unknown): asserts width is number {
  for (const v of [width, height]) {
    if (typeof v !== 'number' || !Number.isFinite(v) || v < 1 || v > MAX_SIDE) {
      throw new DocumentError(`invalid canvas size ${String(width)}x${String(height)}`);
    }
  }
}

function isObject(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null && !Array.isArray(x);
}

/**
 * Aceita a versão atual e a "versão 0" (JSON cru do Fabric com width/height na raiz, como um
 * canvas.toObject() salvo direto). Qualquer outra coisa lança DocumentError.
 */
export function parseDocument(input: unknown): EditorDocument {
  const data = typeof input === 'string' ? safeParse(input) : input;
  if (!isObject(data)) throw new DocumentError('document is not an object');

  if (data.format === undefined && Array.isArray(data.objects)) {
    const { width, height, name, ...fabric } = data;
    checkSize(width, height);
    return createDocument(typeof name === 'string' ? name : 'Sem nome', width, height as number, fabric as FabricJson);
  }
  if (data.format === undefined && Array.isArray(data.scenes) && data.scenes.length > 0 && isObject(data.scenes[0])) {
    const s0 = data.scenes[0] as Record<string, unknown>;
    const width = Number(s0.cWidth ?? s0.width ?? 1080);
    const height = Number(s0.cHeight ?? s0.height ?? 1080);
    checkSize(width, height);
    const fabric: FabricJson = {
      objects: Array.isArray(s0.objects) ? s0.objects : [],
      background: s0.background ?? s0.backgroundGradient,
    };
    return createDocument(typeof data.name === 'string' ? data.name : 'Template', width, height, fabric);
  }
  if (data.format !== DOC_FORMAT) throw new DocumentError(`unknown format ${String(data.format)}`);
  if (data.version !== DOC_VERSION) throw new DocumentError(`unsupported version ${String(data.version)}`);
  checkSize(data.width, data.height);
  const fabric = data.fabric;
  if (!isObject(fabric) || !Array.isArray(fabric.objects)) throw new DocumentError('missing fabric.objects');
  const videoSettings = isObject(data.videoSettings) ? (data.videoSettings as unknown as VideoSettings) : undefined;
  return createDocument(
    typeof data.name === 'string' ? data.name : 'Sem nome',
    data.width,
    data.height as number,
    fabric as FabricJson,
    videoSettings,
  );
}

function safeParse(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    throw new DocumentError('document is not JSON');
  }
}

/** Percorre todos os objetos, inclusive dentro de grupos (pré-ordem). */
export function walkObjects(objects: unknown[], visit: (o: Record<string, unknown>) => void): void {
  for (const o of objects) {
    if (!isObject(o)) continue;
    visit(o);
    if (Array.isArray(o.objects)) walkObjects(o.objects, visit);
  }
}

/** Fontes usadas pelo documento (para carregar antes do loadFromJSON e embutir no SVG). */
export function fontsUsed(doc: EditorDocument): string[] {
  const out = new Set<string>();
  walkObjects(doc.fabric.objects, (o) => {
    if (typeof o.fontFamily === 'string') out.add(o.fontFamily);
    const styles = o.styles;
    if (Array.isArray(styles)) {
      for (const s of styles) {
        const ff = isObject(s) && isObject(s.style) ? s.style.fontFamily : undefined;
        if (typeof ff === 'string') out.add(ff);
      }
    }
  });
  return [...out].sort();
}
