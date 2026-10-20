import {
  type BridgeError,
  cancel as cancelMsg,
  type ErrorCode,
  fail,
  ok,
  parseEnvelope,
  type ProgressEnvelope,
  ProtocolError,
  progress as progressMsg,
  type RequestEnvelope,
  request as requestMsg,
  type ResultEnvelope,
} from './protocol';

/** O objeto que o WebViewCompat.addWebMessageListener injeta (ARQUITETURA §15.1). */
export interface Transport {
  post(message: string): void;
  listen(onMessage: (message: string) => void): void;
}

export class BridgeRequestError extends Error {
  constructor(readonly code: ErrorCode, message: string) {
    super(message);
  }
}

export type ProgressFn = (fraction: number | null, stage: string) => void;
export type Handler = (payload: unknown, progress: ProgressFn) => Promise<unknown> | unknown;

interface Pending {
  resolve: (v: unknown) => void;
  reject: (e: unknown) => void;
  onProgress?: ProgressFn;
}

export class Bridge {
  private seq = 0;
  private readonly pending = new Map<string, Pending>();
  private readonly handlers = new Map<string, Handler>();

  constructor(private readonly transport: Transport, private readonly idPrefix = 'js') {
    transport.listen((m) => this.receive(m));
  }

  /**
   * Pede algo ao outro lado; resolve com o payload do result ou rejeita com BridgeRequestError.
   * `signal` abortado: avisa o outro lado ("cancel") e rejeita na hora com `cancelled`, sem esperar o
   * trabalho parar; o result que chegar depois é ignorado.
   */
  request<T = unknown>(type: string, payload?: unknown, onProgress?: ProgressFn, signal?: AbortSignal): Promise<T> {
    if (signal?.aborted) return Promise.reject(new BridgeRequestError('cancelled', 'cancelled'));
    const id = `${this.idPrefix}-${++this.seq}`;
    return new Promise<T>((resolve, reject) => {
      const onAbort = () => {
        if (!this.pending.delete(id)) return;
        this.transport.post(cancelMsg(id));
        reject(new BridgeRequestError('cancelled', 'cancelled'));
      };
      const done = () => signal?.removeEventListener('abort', onAbort);
      this.pending.set(id, {
        resolve: (v) => { done(); resolve(v as T); },
        reject: (e) => { done(); reject(e); },
        onProgress,
      });
      signal?.addEventListener('abort', onAbort);
      this.transport.post(requestMsg(id, type, payload));
    });
  }

  /** Registra quem atende pedidos vindos do outro lado. */
  handle(type: string, handler: Handler): void {
    this.handlers.set(type, handler);
  }

  private receive(raw: string): void {
    let env;
    try {
      env = parseEnvelope(raw);
    } catch (e) {
      if (e instanceof ProtocolError) console.warn('bridge: discarded message:', e.message);
      return;
    }
    if (env.type === 'result') {
      const res = env as ResultEnvelope;
      const p = this.pending.get(res.id);
      if (!p) return;
      this.pending.delete(res.id);
      if (res.ok) p.resolve(res.payload);
      else p.reject(new BridgeRequestError(res.error.code, res.error.message));
      return;
    }
    if (env.type === 'progress') {
      const pr = env as ProgressEnvelope;
      this.pending.get(pr.id)?.onProgress?.(pr.payload.fraction, pr.payload.stage);
      return;
    }
    // o Kotlin não cancela pedidos feitos ao JS (§26.2); um "cancel" nunca tem resposta
    if (env.type === 'cancel') return;
    const req = env as RequestEnvelope;
    const id = req.id;
    const handler = this.handlers.get(req.type);
    if (!handler) {
      this.transport.post(fail(id, 'unsupported', `no handler for ${req.type}`));
      return;
    }
    const report: ProgressFn = (f, s) => this.transport.post(progressMsg(id, f, s));
    Promise.resolve()
      .then(() => handler(req.payload, report))
      .then(
        (result) => this.transport.post(ok(id, result)),
        (e: unknown) => {
          const err = toBridgeError(e);
          this.transport.post(fail(id, err.code, err.message));
        },
      );
  }
}

function toBridgeError(e: unknown): BridgeError {
  if (e instanceof BridgeRequestError) return { code: e.code, message: e.message };
  return { code: 'internal', message: e instanceof Error ? e.message : String(e) };
}

interface InjectedObject {
  postMessage(message: string): void;
  addEventListener(type: 'message', listener: (e: { data: unknown }) => void): void;
}

/** Transporte real (objeto injetado `AppBridge`) ou null quando a página roda fora do app. */
export function injectedTransport(name = 'AppBridge'): Transport | null {
  const obj = (globalThis as unknown as Record<string, InjectedObject | undefined>)[name];
  if (!obj) return null;
  return {
    post: (m) => obj.postMessage(m),
    listen: (cb) => obj.addEventListener('message', (e) => {
      if (typeof e.data === 'string') cb(e.data);
    }),
  };
}

/** Fora do app (vite dev no navegador): todo pedido ao Kotlin responde "unsupported". */
export function offlineTransport(): Transport {
  let deliver: (m: string) => void = () => {};
  return {
    post: (m) => {
      const env = JSON.parse(m) as { id: string; type: string };
      if (env.type === 'result' || env.type === 'progress' || env.type === 'cancel') return;
      setTimeout(() => deliver(fail(env.id, 'unsupported', 'sem app nativo')), 0);
    },
    listen: (cb) => { deliver = cb; },
  };
}
