import { describe, expect, it } from 'vitest';
import {
  anchoredZoom, clampFactor, clampPan, FIT_VIEW, isFitView, MAX_FACTOR, MIN_FACTOR, pageOffset, PAN_MARGIN, pinchStep,
  type StageLayout, stageToDoc, stepFactor, touchGeometry, viewportMatrix, type ViewState, zoomLabel,
} from '../src/viewportZoom';

// palco de celular (px CSS) e Post 1080×1080, com o mesmo encaixe do Editor.fit() (pad 16)
const stageW = 412;
const stageH = 560;
const base = Math.min((stageW - 32) / 1080, (stageH - 32) / 1080);
const L: StageLayout = { stageW, stageH, docW: 1080, docH: 1080, base };

describe('viewportMatrix', () => {
  it('fator 1 sem pan = a página do fit(): zoom de encaixe, centrada no palco', () => {
    const [a, b, c, d, e, f] = viewportMatrix(FIT_VIEW, L);
    expect([a, b, c, d]).toEqual([base, 0, 0, base]);
    // o fit() centra (flex) um elemento de página × zoom: o canto da página fica em (palco − página)/2
    expect(e).toBeCloseTo((stageW - 1080 * base) / 2, 9);
    expect(f).toBeCloseTo((stageH - 1080 * base) / 2, 9);
    expect(isFitView(FIT_VIEW)).toBe(true);
  });

  it('o pan desloca a página em px de tela', () => {
    const m0 = viewportMatrix({ factor: 2, panX: 0, panY: 0 }, L);
    const m1 = viewportMatrix({ factor: 2, panX: 100, panY: -40 }, L);
    expect(m1[4] - m0[4]).toBeCloseTo(100, 9);
    expect(m1[5] - m0[5]).toBeCloseTo(-40, 9);
    expect(m1[0]).toBeCloseTo(2 * base, 12);
  });
});

describe('anchoredZoom', () => {
  const anchors = [{ x: 0, y: 0 }, { x: 37, y: 411 }, { x: stageW / 2, y: stageH / 2 }, { x: 400, y: 20 }];
  const starts: ViewState[] = [FIT_VIEW, { factor: 1.7, panX: 33, panY: -12 }, { factor: 0.6, panX: -5, panY: 80 }];
  for (const s of starts) {
    for (const a of anchors) {
      it(`ponto do documento sob a âncora (${a.x},${a.y}) não muda (início ${s.factor}×)`, () => {
        const before = stageToDoc(s, L, a);
        for (const f of [0.5, 0.8, 1, 2.5, 4]) {
          const next = anchoredZoom(s, a, f, L);
          const after = stageToDoc(next, L, a);
          expect(after.x).toBeCloseTo(before.x, 6);
          expect(after.y).toBeCloseTo(before.y, 6);
          expect(next.factor).toBe(f);
        }
      });
    }
  }

  it('fator fora de [0,5; 4] é limitado', () => {
    expect(anchoredZoom(FIT_VIEW, { x: 10, y: 10 }, 9, L).factor).toBe(MAX_FACTOR);
    expect(anchoredZoom(FIT_VIEW, { x: 10, y: 10 }, 0.1, L).factor).toBe(MIN_FACTOR);
  });
});

describe('clampFactor', () => {
  it('limites 0,5 e 4; NaN/0/negativo voltam a 1', () => {
    expect(clampFactor(0.49)).toBe(0.5);
    expect(clampFactor(4.01)).toBe(4);
    expect(clampFactor(2)).toBe(2);
    expect(clampFactor(Number.NaN)).toBe(1);
    expect(clampFactor(0)).toBe(1);
    expect(clampFactor(-3)).toBe(1);
  });
});

describe('pinchStep', () => {
  const g0 = touchGeometry({ x: 131, y: 280 }, { x: 281, y: 280 }); // 150 px, centro (206, 280)

  it('afastar os dedos de 150 para 450 px triplica o fator, ancorado no ponto médio', () => {
    const start = { view: { ...FIT_VIEW }, dist: g0.dist, mid: g0.mid };
    const docUnder = stageToDoc(FIT_VIEW, L, g0.mid);
    const g1 = touchGeometry({ x: -19, y: 280 }, { x: 431, y: 280 });
    const v = pinchStep(start, g1.dist, g1.mid, L);
    expect(v.factor).toBeCloseTo(3, 9);
    const after = stageToDoc(v, L, g1.mid);
    expect(after.x).toBeCloseTo(docUnder.x, 6);
    expect(after.y).toBeCloseTo(docUnder.y, 6);
  });

  it('mesma distância e ponto médio transladado = pan puro de M_t − M_0', () => {
    const s: ViewState = { factor: 2, panX: 10, panY: 20 };
    const start = { view: s, dist: g0.dist, mid: g0.mid };
    const v = pinchStep(start, g0.dist, { x: g0.mid.x + 100, y: g0.mid.y - 30 }, L);
    expect(v.factor).toBe(2);
    expect(v.panX).toBeCloseTo(110, 9);
    expect(v.panY).toBeCloseTo(-10, 9);
  });

  it('pinça repetida nunca passa de 4× nem de 0,5×', () => {
    let s: ViewState = { ...FIT_VIEW };
    for (let i = 0; i < 5; i++) s = pinchStep({ view: s, dist: 100, mid: g0.mid }, 900, g0.mid, L);
    expect(s.factor).toBe(MAX_FACTOR);
    for (let i = 0; i < 5; i++) s = pinchStep({ view: s, dist: 600, mid: g0.mid }, 60, g0.mid, L);
    expect(s.factor).toBe(MIN_FACTOR);
  });

  it('distância inicial 0 não divide por zero', () => {
    const v = pinchStep({ view: { ...FIT_VIEW }, dist: 0, mid: g0.mid }, 100, g0.mid, L);
    expect(v.factor).toBe(1);
  });
});

describe('clampPan', () => {
  it('a página nunca sai inteira: sobra PAN_MARGIN px dela no palco', () => {
    const far = clampPan({ factor: 2, panX: 99999, panY: -99999 }, L);
    const o = pageOffset(far, L);
    const pw = 1080 * base * 2;
    expect(o.x).toBeCloseTo(stageW - PAN_MARGIN, 9); // borda esquerda da página a 64 px da direita do palco
    expect(o.y + pw).toBeCloseTo(PAN_MARGIN, 9); // borda de baixo a 64 px do topo
  });

  it('pan dentro do limite não muda', () => {
    const s: ViewState = { factor: 2, panX: 50, panY: -30 };
    expect(clampPan(s, L)).toEqual(s);
  });

  it('página menor que a margem: o limite é o lado da página', () => {
    const tiny: StageLayout = { ...L, docW: 40, docH: 40, base: 1 };
    const s = clampPan({ factor: 0.5, panX: 5000, panY: 0 }, tiny);
    const o = pageOffset(s, tiny);
    expect(o.x).toBeCloseTo(stageW - 20, 9); // os 20 px da página inteiros dentro
  });
});

describe('stepFactor / zoomLabel', () => {
  it('paradas da pílula', () => {
    expect(stepFactor(1, 1)).toBe(1.5);
    expect(stepFactor(1.5, 1)).toBe(2);
    expect(stepFactor(1, -1)).toBe(0.75);
    expect(stepFactor(2.4, 1)).toBe(3);
    expect(stepFactor(2.4, -1)).toBe(2);
    expect(stepFactor(4, 1)).toBe(4);
    expect(stepFactor(0.5, -1)).toBe(0.5);
  });

  it('rótulo em %', () => {
    expect(zoomLabel(1)).toBe('100%');
    expect(zoomLabel(2.996)).toBe('300%');
    expect(zoomLabel(0.5)).toBe('50%');
  });
});
