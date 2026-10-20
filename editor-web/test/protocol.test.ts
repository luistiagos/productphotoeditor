import { describe, expect, it } from 'vitest';
import { cancel, fail, ok, parseEnvelope, progress, ProtocolError, request } from '../src/protocol';
import { Bridge, BridgeRequestError, type Transport } from '../src/bridge';

describe('parseEnvelope', () => {
  it('round-trips request, result and progress', () => {
    expect(parseEnvelope(request('a', 'ai.removeBg', { src: '/blob/x.png' }))).toEqual({
      v: 1, id: 'a', type: 'ai.removeBg', payload: { src: '/blob/x.png' },
    });
    expect(parseEnvelope(ok('a', { url: 'u' }))).toMatchObject({ type: 'result', ok: true, payload: { url: 'u' } });
    expect(parseEnvelope(fail('a', 'network', 'offline'))).toMatchObject({ ok: false, error: { code: 'network', message: 'offline' } });
    expect(parseEnvelope(progress('a', null, 'baixando'))).toMatchObject({ type: 'progress', payload: { fraction: null, stage: 'baixando' } });
    expect(parseEnvelope(cancel('a'))).toEqual({ v: 1, id: 'a', type: 'cancel' });
  });

  it('rejects malformed messages', () => {
    for (const raw of ['nope', '[]', '{"v":2,"id":"a","type":"x"}', '{"v":1,"type":"x"}', '{"v":1,"id":"a"}',
      '{"v":1,"id":"a","type":"result"}', '{"v":1,"id":"a","type":"result","ok":false}',
      '{"v":1,"id":"a","type":"progress","payload":{"fraction":"x","stage":"s"}}']) {
      expect(() => parseEnvelope(raw), raw).toThrow(ProtocolError);
    }
  });

  it('maps an unknown error code to internal', () => {
    const env = parseEnvelope('{"v":1,"id":"a","type":"result","ok":false,"error":{"code":"weird","message":"m"}}');
    expect(env).toMatchObject({ error: { code: 'internal' } });
  });
});

/** Dois lados ligados em memória, como Kotlin e JS. */
function pair(): [Transport, Transport] {
  const listeners: [((m: string) => void) | null, ((m: string) => void) | null] = [null, null];
  const make = (me: 0 | 1): Transport => ({
    post: (m) => queueMicrotask(() => listeners[me === 0 ? 1 : 0]?.(m)),
    listen: (cb) => { listeners[me] = cb; },
  });
  return [make(0), make(1)];
}

describe('Bridge', () => {
  it('request → handler → result, with progress', async () => {
    const [a, b] = pair();
    const js = new Bridge(a, 'js');
    const native = new Bridge(b, 'kt');
    native.handle('ai.vectorize', async (payload, report) => {
      report(0.5, 'traçando');
      return { svg: '<svg>' + (payload as { src: string }).src + '</svg>' };
    });
    const seen: [number | null, string][] = [];
    const res = await js.request<{ svg: string }>('ai.vectorize', { src: 'u' }, (f, s) => seen.push([f, s]));
    expect(res.svg).toBe('<svg>u</svg>');
    expect(seen).toEqual([[0.5, 'traçando']]);
  });

  it('typed errors cross the bridge; missing handler is unsupported', async () => {
    const [a, b] = pair();
    const js = new Bridge(a, 'js');
    const native = new Bridge(b, 'kt');
    native.handle('ai.inpaint', () => { throw new BridgeRequestError('unavailable', 'sem provedor'); });
    await expect(js.request('ai.inpaint')).rejects.toMatchObject({ code: 'unavailable', message: 'sem provedor' });
    await expect(js.request('ai.nothing')).rejects.toMatchObject({ code: 'unsupported' });
    native.handle('boom', () => { throw new Error('x'); });
    await expect(js.request('boom')).rejects.toMatchObject({ code: 'internal', message: 'x' });
  });

  it('abort sends cancel with the request id and rejects at once; the late result is ignored', async () => {
    const posted: string[] = [];
    let deliver: (m: string) => void = () => {};
    const js = new Bridge({ post: (m) => posted.push(m), listen: (cb) => { deliver = cb; } }, 'js');
    const ctl = new AbortController();
    const p = js.request('ai.upscale', { src: 'u', factor: 4 }, undefined, ctl.signal);
    ctl.abort();
    await expect(p).rejects.toMatchObject({ code: 'cancelled' });
    expect(posted.map((m) => parseEnvelope(m))).toEqual([
      { v: 1, id: 'js-1', type: 'ai.upscale', payload: { src: 'u', factor: 4 } },
      { v: 1, id: 'js-1', type: 'cancel' },
    ]);
    deliver(fail('js-1', 'cancelled', 'cancelled')); // não pode lançar nem responder
    deliver(ok('js-1', { url: 'tarde' }));
    ctl.abort(); // abortar de novo não reenvia
    expect(posted).toHaveLength(2);
    await expect(js.request('x', undefined, undefined, ctl.signal)).rejects.toMatchObject({ code: 'cancelled' });
    expect(posted).toHaveLength(2); // sinal já abortado: nem chega a pedir
  });

  it('abort after the result changes nothing; a received cancel gets no reply', async () => {
    const [a, b] = pair();
    const js = new Bridge(a, 'js');
    const native = new Bridge(b, 'kt');
    native.handle('ai.removeBg', () => ({ url: 'u' }));
    const ctl = new AbortController();
    expect(await js.request('ai.removeBg', {}, undefined, ctl.signal)).toEqual({ url: 'u' });
    ctl.abort();
    const replies: string[] = [];
    new Bridge({ post: (m) => replies.push(m), listen: (cb) => queueMicrotask(() => cb(cancel('kt-1'))) });
    await new Promise((r) => setTimeout(r, 0));
    expect(replies).toEqual([]);
  });

  it('both sides can initiate', async () => {
    const [a, b] = pair();
    const js = new Bridge(a, 'js');
    const native = new Bridge(b, 'kt');
    js.handle('loadProject', (p) => ({ loaded: (p as { name: string }).name }));
    expect(await native.request('loadProject', { name: 'Cartaz' })).toEqual({ loaded: 'Cartaz' });
  });
});
