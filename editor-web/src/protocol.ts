// Protocolo da ponte Kotlin ↔ JS (ARQUITETURA §7 e §15.2). Os dois lados podem pedir; toda
// requisição recebe exatamente um "result" com o mesmo id; "progress" é opcional e só vai do
// lado que executa para o que pediu. "cancel" (mesmo id do pedido, sem resposta) só vai do que pediu
// para o que executa; o pedido termina com o result "cancelled" (ARQUITETURA §26).

export const PROTOCOL_VERSION = 1;

export type ErrorCode =
  | 'unsupported' // capability desligada ou ainda não implementada
  | 'unavailable' // nenhum provedor da cadeia está disponível
  | 'network'
  | 'remote'
  | 'invalid' // entrada ou saída inválida
  | 'cancelled'
  | 'internal';

export interface BridgeError {
  code: ErrorCode;
  message: string;
}

export interface RequestEnvelope {
  v: number;
  id: string;
  type: string;
  payload?: unknown;
}

export type ResultEnvelope =
  | { v: number; id: string; type: 'result'; ok: true; payload?: unknown }
  | { v: number; id: string; type: 'result'; ok: false; error: BridgeError };

export interface ProgressEnvelope {
  v: number;
  id: string;
  type: 'progress';
  payload: { fraction: number | null; stage: string };
}

/** Quem pediu desistiu do pedido `id` (o id é o do pedido); não tem resposta (ARQUITETURA §26.2). */
export interface CancelEnvelope {
  v: number;
  id: string;
  type: 'cancel';
}

export type Envelope = RequestEnvelope | ResultEnvelope | ProgressEnvelope | CancelEnvelope;

const ERROR_CODES: ReadonlySet<string> = new Set<ErrorCode>([
  'unsupported', 'unavailable', 'network', 'remote', 'invalid', 'cancelled', 'internal',
]);

export class ProtocolError extends Error {}

function isObject(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null && !Array.isArray(x);
}

/** Valida uma mensagem recebida. Lança ProtocolError em vez de aceitar algo malformado. */
export function parseEnvelope(raw: string): Envelope {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    throw new ProtocolError('not JSON');
  }
  if (!isObject(data)) throw new ProtocolError('not an object');
  if (data.v !== PROTOCOL_VERSION) throw new ProtocolError(`unsupported version ${String(data.v)}`);
  if (typeof data.id !== 'string' || data.id.length === 0) throw new ProtocolError('missing id');
  if (typeof data.type !== 'string' || data.type.length === 0) throw new ProtocolError('missing type');

  if (data.type === 'result') {
    if (data.ok === true) return { v: PROTOCOL_VERSION, id: data.id, type: 'result', ok: true, payload: data.payload };
    if (data.ok === false) {
      const err = data.error;
      if (!isObject(err) || typeof err.code !== 'string' || typeof err.message !== 'string') {
        throw new ProtocolError('result without error');
      }
      const code = (ERROR_CODES.has(err.code) ? err.code : 'internal') as ErrorCode;
      return { v: PROTOCOL_VERSION, id: data.id, type: 'result', ok: false, error: { code, message: err.message } };
    }
    throw new ProtocolError('result without ok');
  }
  if (data.type === 'progress') {
    const p = data.payload;
    if (!isObject(p) || typeof p.stage !== 'string' || !(p.fraction === null || typeof p.fraction === 'number')) {
      throw new ProtocolError('bad progress');
    }
    return { v: PROTOCOL_VERSION, id: data.id, type: 'progress', payload: { fraction: p.fraction, stage: p.stage } };
  }
  if (data.type === 'cancel') return { v: PROTOCOL_VERSION, id: data.id, type: 'cancel' };
  return { v: PROTOCOL_VERSION, id: data.id, type: data.type, payload: data.payload };
}

export function request(id: string, type: string, payload?: unknown): string {
  return JSON.stringify({ v: PROTOCOL_VERSION, id, type, payload });
}

export function ok(id: string, payload?: unknown): string {
  return JSON.stringify({ v: PROTOCOL_VERSION, id, type: 'result', ok: true, payload });
}

export function fail(id: string, code: ErrorCode, message: string): string {
  return JSON.stringify({ v: PROTOCOL_VERSION, id, type: 'result', ok: false, error: { code, message } });
}

export function progress(id: string, fraction: number | null, stage: string): string {
  return JSON.stringify({ v: PROTOCOL_VERSION, id, type: 'progress', payload: { fraction, stage } });
}

export function cancel(id: string): string {
  return JSON.stringify({ v: PROTOCOL_VERSION, id, type: 'cancel' });
}

// ---- Tipos dos payloads (os nomes batem com EditorProtocol.kt) ----

/** JS → Kotlin */
export interface ImageRef {
  /** URL servida pelo asset loader (/blob/… ou /assets/…). */
  src: string;
}
export interface InpaintPayload extends ImageRef {
  /** PNG em dataURL do tamanho natural da imagem; alfa > 0 = área a preencher. */
  mask: string;
}
export interface TextBox {
  text: string;
  /** Caixas das linhas, em pixels da imagem: [x0, y0, x1, y1]. */
  lines: [number, number, number, number][];
  box: [number, number, number, number];
}
export interface RemoveTextPayload extends ImageRef {
  blocks: TextBox[];
}
export interface VectorizePayload extends ImageRef {
  colorMode: 'color' | 'binary';
  colorPrecision?: number;
  layerDifference?: number;
  filterSpeckle?: number;
}
export interface BlobResult {
  url: string;
  width: number;
  height: number;
  servedBy?: string;
}
export interface ExportPayload {
  format: 'png' | 'jpg' | 'svg';
  action: 'save' | 'share' | 'print' | 'mockup';
  name: string;
  /** dataURL (png/jpg) ou o texto do SVG. */
  data: string;
}
export interface SaveDraftPayload {
  id?: string;
  name: string;
  document: unknown;
  /** Miniatura em dataURL (webp/jpeg). */
  thumbnail: string;
}
export interface FontRef {
  family: string;
  url: string;
}
