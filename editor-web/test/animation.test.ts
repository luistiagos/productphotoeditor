import { describe, expect, it } from 'vitest';
import type { LayerAnimation } from '../src/document';
import { alphaAt, evalExpr, layerTimeline, resolveAnimation, stateAt, toFfmpeg, type Expr } from '../src/video/animation';

/** Avalia a expressão do FFmpeg impressa (o subconjunto que `toFfmpeg` emite) com a semântica do libavutil/eval. */
function evalFfmpeg(src: string, t: number): number {
  const fns = {
    min: Math.min, max: Math.max, pow: Math.pow, sin: Math.sin,
    mod: (a: number, b: number) => a % b,
    lt: (a: number, b: number) => (a < b ? 1 : 0),
    clip: (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x)),
    if: (c: number, a: number, b: number) => (c !== 0 ? a : b),
  };
  const js = src.replace(/\bif\(/g, 'iff(');
  // eslint-disable-next-line @typescript-eslint/no-implied-eval
  const f = new Function('t', 'min', 'max', 'pow', 'sin', 'mod', 'lt', 'clip', 'iff', `return ${js};`);
  return f(t, fns.min, fns.max, fns.pow, fns.sin, fns.mod, fns.lt, fns.clip, fns.if) as number;
}

const ctx = { videoDuration: 6, pageWidth: 1080, pageHeight: 1080, unit: 1 };
const times = Array.from({ length: 61 }, (_, i) => i * 0.1);

function sameEverywhere(e: Expr): void {
  const printed = toFfmpeg(e);
  for (const t of times) expect(evalFfmpeg(printed, t)).toBeCloseTo(evalExpr(e, t), 3);
}

describe('animation — expressão impressa ≡ conta do preview', () => {
  const combos: LayerAnimation[] = [
    { fx: 'zoom_in', startTime: 0.5, duration: 5, inFx: 'zoom_in', inDuration: 1, emphasisFx: 'pulse', outFx: 'fade_out', outDuration: 1, easing: 'ease_out' },
    { fx: 'slide_left', startTime: 0, duration: 6, inFx: 'slide_left', inDuration: 1.2, emphasisFx: 'float', outFx: 'slide_out', easing: 'ease_in_out' },
    { fx: 'shake', startTime: 1, duration: 4, emphasisFx: 'shake', outFx: 'zoom_out', easing: 'bounce' },
    { fx: 'rotate', startTime: 0, duration: 6, emphasisFx: 'rotate' },
    { fx: 'ken_burns', startTime: 0, duration: 6 },
    { fx: 'rotate', startTime: 1, duration: 2 },
  ];
  for (const a of combos) {
    it(`${a.inFx ?? '-'} + ${a.emphasisFx ?? a.fx} + ${a.outFx ?? '-'} (${a.easing ?? 'linear'})`, () => {
      const tl = layerTimeline(a, ctx)!;
      for (const e of [tl.dx, tl.dy, tl.scale, tl.angle]) sameEverywhere(e);
    });
  }
});

describe('animation — composição Entrada + Ênfase + Saída', () => {
  const a: LayerAnimation = { fx: 'zoom_in', startTime: 1, duration: 4, inFx: 'zoom_in', inDuration: 1, emphasisFx: 'pulse',
    outFx: 'fade_out', outDuration: 1, easing: 'linear' };
  const tl = layerTimeline(a, ctx)!;

  it('fica na tela só de startTime a startTime + duration', () => {
    expect(stateAt(tl, 0.9).visible).toBe(false);
    expect(stateAt(tl, 1).visible).toBe(true);
    expect(stateAt(tl, 5).visible).toBe(true);
    expect(stateAt(tl, 5.1).visible).toBe(false);
  });
  it('entrada: zoom de 0,2 a 1 e alfa de 0 a 1 no primeiro segundo', () => {
    expect(stateAt(tl, 1).scale).toBeCloseTo(0.2, 3);
    expect(stateAt(tl, 1.5).scale).toBeCloseTo(0.6, 3);
    expect(stateAt(tl, 1.5).alpha).toBeCloseTo(0.5, 3);
    expect(stateAt(tl, 2).alpha).toBeCloseTo(1, 3);
  });
  it('ênfase: pulso 1 + 0,06·sin(2πu/0,8) entre o fim da entrada e o início da saída', () => {
    expect(stateAt(tl, 2 + 0.2).scale).toBeCloseTo(1.06, 3); // u = 0,2 → sin(π/2)
    expect(stateAt(tl, 2 + 0.6).scale).toBeCloseTo(0.94, 3);
    expect(stateAt(tl, 4.5).scale).toBeCloseTo(1, 3); // saída: pulso desligado
  });
  it('saída: alfa 1 → 0 no último segundo', () => {
    expect(stateAt(tl, 4).alpha).toBeCloseTo(1, 3);
    expect(stateAt(tl, 4.5).alpha).toBeCloseTo(0.5, 3);
    expect(stateAt(tl, 5).alpha).toBeCloseTo(0, 3);
  });
  it('easing ease_out adianta o movimento (não o alfa)', () => {
    const eased = layerTimeline({ ...a, easing: 'ease_out' }, ctx)!;
    expect(stateAt(eased, 1.5).scale).toBeCloseTo(0.2 + 0.8 * (1 - 0.5 ** 3), 3);
    expect(stateAt(eased, 1.5).alpha).toBeCloseTo(0.5, 3);
  });
  it('entrada + saída maiores que o tempo na tela encolhem na proporção', () => {
    const r = resolveAnimation({ ...a, duration: 1, inDuration: 1, outDuration: 1 }, 6)!;
    expect(r.inDur + r.outDur).toBeCloseTo(1, 5);
  });
});

describe('animation — formato antigo (só fx) continua igual ao preview antigo', () => {
  it('fade de 2 s a partir de 2 s; camada até o fim do vídeo', () => {
    const tl = layerTimeline({ fx: 'fade', startTime: 2, duration: 2 }, ctx)!;
    expect(stateAt(tl, 1).visible).toBe(false);
    expect(alphaAt(tl.alpha, 3)).toBeCloseTo(0.5, 3);
    expect(stateAt(tl, 6).visible).toBe(true);
  });
  it('ken burns 1 → 1,15 no vídeo inteiro', () => {
    const tl = layerTimeline({ fx: 'ken_burns', startTime: 0, duration: 4 }, { ...ctx, videoDuration: 4 })!;
    expect(stateAt(tl, 2).scale).toBeCloseTo(1.075, 3);
  });
  it('ênfase antiga aparece desde o início e começa em startTime', () => {
    const tl = layerTimeline({ fx: 'float', startTime: 1, duration: 6 }, ctx)!;
    expect(stateAt(tl, 0).visible).toBe(true);
    expect(stateAt(tl, 0.5).dy).toBeCloseTo(0, 6);
    expect(Math.abs(stateAt(tl, 1.6).dy)).toBeGreaterThan(5);
  });
  it('zoom_in com speed 2 dura metade', () => {
    const r = resolveAnimation({ fx: 'zoom_in', startTime: 0, duration: 2, speed: 2 }, 6)!;
    expect(r.inDur).toBeCloseTo(1, 5);
  });
  it('sem animação → null', () => {
    expect(layerTimeline(undefined, ctx)).toBeNull();
    expect(layerTimeline({ fx: 'none', startTime: 0, duration: 3 }, ctx)).toBeNull();
  });
});
