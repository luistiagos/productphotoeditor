// Linha do tempo de uma camada no vídeo: Entrada + Ênfase + Saída (TASK-04 §2.2).
// A mesma conta serve ao preview (VideoPreview, avaliada em JS a cada quadro) e ao export (FfmpegCommandBuilder,
// impressa como expressão do FFmpeg em `t`): os dois lados leem a mesma árvore `Expr`, então não divergem.

import type { AnimationFx, EasingCurve, EmphasisFx, EntranceFx, ExitFx, LayerAnimation } from '../document';

// ---------- mini-AST de expressão em t ----------

export type Expr =
  | number
  | 't'
  | { op: '+' | '-' | '*' | '/' | 'min' | 'max' | 'pow' | 'mod' | 'lt'; a: Expr; b: Expr }
  | { op: 'sin'; a: Expr }
  | { op: 'clip'; a: Expr; lo: number; hi: number }
  | { op: 'if'; c: Expr; a: Expr; b: Expr };

export const T: Expr = 't';
const bin = (op: '+' | '-' | '*' | '/' | 'min' | 'max' | 'pow' | 'mod' | 'lt') => (a: Expr, b: Expr): Expr => ({ op, a, b });
const rawAdd = bin('+');
const rawMul = bin('*');
export const sub = bin('-');
export const div = bin('/');
export const min = bin('min');
export const pow = bin('pow');
export const mod = bin('mod');
/** 1 se a < b, senão 0. */
export const lt = bin('lt');
export const sin = (a: Expr): Expr => ({ op: 'sin', a });
export const clip = (a: Expr, lo: number, hi: number): Expr => ({ op: 'clip', a, lo, hi });
/** c ≠ 0 ? a : b */
export const ifz = (c: Expr, a: Expr, b: Expr): Expr => ({ op: 'if', c, a, b });

/** Soma que some com zeros (a expressão impressa fica curta quando não há efeito). */
export function add(a: Expr, b: Expr): Expr {
  if (a === 0) return b;
  if (b === 0) return a;
  if (typeof a === 'number' && typeof b === 'number') return a + b;
  return rawAdd(a, b);
}
export function mul(a: Expr, b: Expr): Expr {
  if (a === 0 || b === 0) return 0;
  if (a === 1) return b;
  if (b === 1) return a;
  if (typeof a === 'number' && typeof b === 'number') return a * b;
  return rawMul(a, b);
}

export function evalExpr(e: Expr, t: number): number {
  if (typeof e === 'number') return e;
  if (e === 't') return t;
  switch (e.op) {
    case '+': return evalExpr(e.a, t) + evalExpr(e.b, t);
    case '-': return evalExpr(e.a, t) - evalExpr(e.b, t);
    case '*': return evalExpr(e.a, t) * evalExpr(e.b, t);
    case '/': return evalExpr(e.a, t) / evalExpr(e.b, t);
    case 'min': return Math.min(evalExpr(e.a, t), evalExpr(e.b, t));
    case 'max': return Math.max(evalExpr(e.a, t), evalExpr(e.b, t));
    case 'pow': return Math.pow(evalExpr(e.a, t), evalExpr(e.b, t));
    // mod do FFmpeg = fmod (sinal do dividendo); só usamos com dividendo ≥ 0
    case 'mod': return evalExpr(e.a, t) % evalExpr(e.b, t);
    case 'lt': return evalExpr(e.a, t) < evalExpr(e.b, t) ? 1 : 0;
    case 'sin': return Math.sin(evalExpr(e.a, t));
    case 'clip': return Math.min(e.hi, Math.max(e.lo, evalExpr(e.a, t)));
    case 'if': return evalExpr(e.c, t) !== 0 ? evalExpr(e.a, t) : evalExpr(e.b, t);
  }
}

export function fmtNum(n: number): string {
  const s = n.toFixed(6).replace(/\.?0+$/, '');
  return s === '-0' ? '0' : s;
}

/** Expressão do FFmpeg (libavutil/eval): funções min/max/pow/mod/lt/sin/clip/if e a variável `t`. */
export function toFfmpeg(e: Expr): string {
  if (typeof e === 'number') return fmtNum(e);
  if (e === 't') return 't';
  switch (e.op) {
    case '+': case '-': case '*': case '/':
      return `(${toFfmpeg(e.a)}${e.op}${toFfmpeg(e.b)})`;
    case 'min': case 'max': case 'pow': case 'mod': case 'lt':
      return `${e.op}(${toFfmpeg(e.a)},${toFfmpeg(e.b)})`;
    case 'sin': return `sin(${toFfmpeg(e.a)})`;
    case 'clip': return `clip(${toFfmpeg(e.a)},${fmtNum(e.lo)},${fmtNum(e.hi)})`;
    case 'if': return `if(${toFfmpeg(e.c)},${toFfmpeg(e.a)},${toFfmpeg(e.b)})`;
  }
}

export const isConst = (e: Expr): e is number => typeof e === 'number';

// ---------- modelo normalizado ----------

const ENTRANCE = new Set<string>(['fade', 'zoom_in', 'zoom_out', 'slide_left', 'slide_right', 'slide_up', 'slide_down']);
const EMPHASIS = new Set<string>(['pulse', 'shake', 'float', 'rotate', 'ken_burns']);

export interface ResolvedAnimation {
  /** Janela em que a camada aparece. */
  visibleFrom: number;
  visibleTo: number;
  inFx: EntranceFx;
  inStart: number;
  inDur: number;
  emphasisFx: EmphasisFx;
  emphasisStart: number;
  emphasisEnd: number;
  /** Só o giro legado para depois de uma volta. */
  rotateOnce: boolean;
  outFx: ExitFx;
  outDur: number;
  easing: EasingCurve;
}

/** Usa os campos novos (inFx/emphasisFx/outFx) se houver algum; senão traduz o `fx` antigo como ele se comportava no preview. */
export function resolveAnimation(anim: LayerAnimation | undefined, videoDuration: number): ResolvedAnimation | null {
  if (!anim) return null;
  const total = Math.max(0.5, videoDuration);
  const st = Math.min(total, Math.max(0, anim.startTime ?? 0));
  const speed = Math.max(0.1, anim.speed ?? 1);
  const easing: EasingCurve = anim.easing ?? 'linear';
  const isNew = anim.inFx !== undefined || anim.emphasisFx !== undefined || anim.outFx !== undefined;

  if (!isNew) {
    const fx = anim.fx ?? 'none';
    const effDur = Math.max(0.2, anim.duration ?? total) / speed;
    const outFx: ExitFx = anim.fxOut === 'fade' ? 'fade_out' : 'none';
    const outDur = outFx === 'none' ? 0 : Math.min(1, total / 4);
    if (ENTRANCE.has(fx)) {
      // legado: a entrada dura `duration/speed` e a camada fica até o fim do vídeo
      return { visibleFrom: st, visibleTo: total, inFx: fx as EntranceFx, inStart: st, inDur: effDur, emphasisFx: 'none',
        emphasisStart: total, emphasisEnd: total, rotateOnce: false, outFx, outDur, easing };
    }
    if (EMPHASIS.has(fx)) {
      // legado: a ênfase começa em startTime, mas a camada já aparece desde o início
      return { visibleFrom: 0, visibleTo: total, inFx: 'none', inStart: st, inDur: 0, emphasisFx: fx as EmphasisFx,
        emphasisStart: st, emphasisEnd: fx === 'rotate' ? st + effDur : total, rotateOnce: fx === 'rotate',
        outFx, outDur, easing };
    }
    if (outFx === 'none') return null;
    return { visibleFrom: 0, visibleTo: total, inFx: 'none', inStart: 0, inDur: 0, emphasisFx: 'none', emphasisStart: total,
      emphasisEnd: total, rotateOnce: false, outFx, outDur, easing };
  }

  const et = Math.min(total, st + Math.max(0.2, anim.duration ?? total - st));
  const span = Math.max(0.2, et - st);
  const inFx: EntranceFx = anim.inFx ?? 'none';
  const outFx: ExitFx = anim.outFx ?? 'none';
  let inDur = inFx === 'none' ? 0 : Math.max(0.1, (anim.inDuration ?? 0.8) / speed);
  let outDur = outFx === 'none' ? 0 : Math.max(0.1, (anim.outDuration ?? 0.8) / speed);
  // entrada e saída não se sobrepõem
  if (inDur + outDur > span) {
    const k = span / (inDur + outDur);
    inDur *= k;
    outDur *= k;
  }
  const emphasisFx: EmphasisFx = anim.emphasisFx ?? 'none';
  return { visibleFrom: st, visibleTo: et, inFx, inStart: st, inDur, emphasisFx, emphasisStart: st + inDur,
    emphasisEnd: et - outDur, rotateOnce: false, outFx, outDur, easing };
}

// ---------- easing ----------

export function ease(p: Expr, curve: EasingCurve): Expr {
  switch (curve) {
    case 'ease_out': // 1 - (1-p)^3
      return sub(1, pow(sub(1, p), 3));
    case 'ease_in_out': // p<0.5 ? 4p³ : 1 - (2-2p)³/2
      return ifz(lt(p, 0.5), mul(4, pow(p, 3)), sub(1, div(pow(sub(2, mul(2, p)), 3), 2)));
    case 'bounce': { // "back out": passa um pouco do ponto e volta (efeito mola)
      const c1 = 1.70158, c3 = c1 + 1, q = sub(p, 1);
      return add(add(1, mul(c3, pow(q, 3))), mul(c1, pow(q, 2)));
    }
    default:
      return p;
  }
}

// ---------- estado da camada em t ----------

/** Rampa de alfa linear: 'in' sobe 0→1 em [start, start+dur]; 'out' desce 1→0. Vira o filtro `fade` no FFmpeg. */
export interface AlphaRamp { kind: 'in' | 'out'; start: number; dur: number }

export interface LayerTimeline {
  visibleFrom: number;
  visibleTo: number;
  /** Deslocamento do centro (px da saída). */
  dx: Expr;
  dy: Expr;
  /** Multiplicador da escala, em torno do centro. */
  scale: Expr;
  /** Giro somado ao ângulo da camada, em graus (horário). */
  angle: Expr;
  alpha: AlphaRamp[];
}

export interface TimelineContext {
  videoDuration: number;
  /** Tamanho da página na unidade das posições (doc px no preview, px da saída no export). */
  pageWidth: number;
  pageHeight: number;
  /** px da página por px do documento (amplitudes fixas de tremer/flutuar). */
  unit: number;
}

const progress = (start: number, dur: number): Expr => (dur <= 0 ? 1 : clip(div(sub(T, start), dur), 0, 1));

export function layerTimeline(anim: LayerAnimation | undefined, ctx: TimelineContext): LayerTimeline | null {
  const r = resolveAnimation(anim, ctx.videoDuration);
  if (!r) return null;
  let dx: Expr = 0, dy: Expr = 0, scale: Expr = 1, angle: Expr = 0;
  const alpha: AlphaRamp[] = [];
  const slideX = 0.37 * ctx.pageWidth, slideY = 0.28 * ctx.pageHeight;

  // entrada
  if (r.inFx !== 'none') {
    const pl = progress(r.inStart, r.inDur);
    const p = ease(pl, r.easing);
    const rest = sub(1, p);
    switch (r.inFx) {
      case 'fade': alpha.push({ kind: 'in', start: r.inStart, dur: r.inDur }); break;
      case 'zoom_in': scale = mul(scale, add(0.2, mul(0.8, p))); alpha.push({ kind: 'in', start: r.inStart, dur: r.inDur }); break;
      case 'zoom_out': scale = mul(scale, sub(1.5, mul(0.5, p))); alpha.push({ kind: 'in', start: r.inStart, dur: r.inDur / 3 }); break;
      case 'slide_left': dx = add(dx, mul(slideX, rest)); alpha.push({ kind: 'in', start: r.inStart, dur: r.inDur / 2 }); break;
      case 'slide_right': dx = sub(dx, mul(slideX, rest)); alpha.push({ kind: 'in', start: r.inStart, dur: r.inDur / 2 }); break;
      case 'slide_up': dy = add(dy, mul(slideY, rest)); alpha.push({ kind: 'in', start: r.inStart, dur: r.inDur / 2 }); break;
      case 'slide_down': dy = sub(dy, mul(slideY, rest)); alpha.push({ kind: 'in', start: r.inStart, dur: r.inDur / 2 }); break;
    }
  }

  // ênfase: u = t - início, ligada só dentro da janela
  if (r.emphasisFx !== 'none' && r.emphasisEnd > r.emphasisStart) {
    const u = sub(T, r.emphasisStart);
    const on = mul(sub(1, lt(T, r.emphasisStart)), lt(T, r.emphasisEnd + 1e-3));
    const span = Math.max(0.2, r.emphasisEnd - r.emphasisStart);
    switch (r.emphasisFx) {
      case 'pulse': scale = mul(scale, add(1, mul(on, mul(0.06, sin(mul(2 * Math.PI / 0.8, u)))))); break;
      case 'float': dy = add(dy, mul(on, mul(8 * ctx.unit, sin(mul(2 * Math.PI / 2.5, u))))); break;
      // rajadas de 0,6 s a cada 2 s
      case 'shake': dx = add(dx, mul(on, mul(lt(mod(u, 2), 0.6), mul(10 * ctx.unit, sin(mul(20, u)))))); break;
      case 'rotate':
        angle = r.rotateOnce
          ? mul(sub(1, lt(T, r.emphasisStart)), mul(360, clip(div(u, span), 0, 1)))
          : mul(on, mul(120, u)); // uma volta a cada 3 s
        break;
      case 'ken_burns': scale = mul(scale, add(1, mul(0.15, clip(div(u, span), 0, 1)))); break;
    }
  }

  // saída
  if (r.outFx !== 'none') {
    const outStart = r.visibleTo - r.outDur;
    const ql = progress(outStart, r.outDur);
    const q = ease(ql, r.easing);
    switch (r.outFx) {
      case 'fade_out': alpha.push({ kind: 'out', start: outStart, dur: r.outDur }); break;
      case 'zoom_out': scale = mul(scale, sub(1, mul(0.8, q))); alpha.push({ kind: 'out', start: outStart, dur: r.outDur }); break;
      case 'slide_out': dx = sub(dx, mul(slideX, q)); alpha.push({ kind: 'out', start: outStart + r.outDur / 2, dur: r.outDur / 2 }); break;
    }
  }

  return { visibleFrom: r.visibleFrom, visibleTo: r.visibleTo, dx, dy, scale, angle, alpha };
}

export function alphaAt(ramps: AlphaRamp[], t: number): number {
  let a = 1;
  for (const r of ramps) {
    const p = r.dur <= 0 ? 1 : Math.min(1, Math.max(0, (t - r.start) / r.dur));
    a *= r.kind === 'in' ? p : 1 - p;
  }
  return a;
}

export interface LayerState { dx: number; dy: number; scale: number; angle: number; alpha: number; visible: boolean }

export function stateAt(tl: LayerTimeline, t: number): LayerState {
  // a ponta final conta como dentro (o último quadro ainda mostra a camada, como o `between` do FFmpeg)
  const visible = t >= tl.visibleFrom - 1e-6 && t <= tl.visibleTo + 1e-6;
  return {
    dx: evalExpr(tl.dx, t),
    dy: evalExpr(tl.dy, t),
    scale: evalExpr(tl.scale, t),
    angle: evalExpr(tl.angle, t),
    alpha: alphaAt(tl.alpha, t),
    visible,
  };
}

/** Tipos usados na UI (rótulos das opções). */
export const ENTRANCE_OPTIONS: [EntranceFx, string][] = [
  ['none', 'Nenhuma'], ['fade', '✨ Fade In'], ['zoom_in', '🔎 Zoom In'], ['zoom_out', '🔍 Zoom Out'],
  ['slide_left', '⬅️ Deslizar da direita'], ['slide_right', '➡️ Deslizar da esquerda'],
  ['slide_up', '⬆️ Deslizar de baixo'], ['slide_down', '⬇️ Deslizar de cima'],
];
export const EMPHASIS_OPTIONS: [EmphasisFx, string][] = [
  ['none', 'Nenhuma'], ['pulse', '💓 Pulsar oferta'], ['float', '🎈 Flutuar'], ['shake', '⚡ Chacoalhar (shake)'],
  ['rotate', '🔄 Girar'], ['ken_burns', '🔍 Ken Burns'],
];
export const EXIT_OPTIONS: [ExitFx, string][] = [
  ['none', 'Nenhuma'], ['fade_out', '🌫️ Fade Out'], ['zoom_out', '🔍 Zoom Out'], ['slide_out', '⬅️ Deslizar para fora'],
];
export const EASING_OPTIONS: [EasingCurve, string][] = [
  ['linear', 'Linear'], ['ease_out', 'Suave (ease-out)'], ['ease_in_out', 'Suave nas pontas'], ['bounce', 'Mola (bounce)'],
];

/** O `fx` legado que melhor resume a composição (mantém leitores antigos e o rótulo da camada). */
export function legacyFx(a: Pick<LayerAnimation, 'inFx' | 'emphasisFx'>): AnimationFx {
  if (a.inFx && a.inFx !== 'none') return a.inFx;
  if (a.emphasisFx && a.emphasisFx !== 'none') return a.emphasisFx;
  return 'none';
}
