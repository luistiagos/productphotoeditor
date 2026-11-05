import { describe, expect, it } from 'vitest';
import {
  curveArc,
  curveFlag,
  curvePath,
  curveRise,
  curveWave,
  cycleTextCase,
  evalEnvelopeColumn,
  evalWarpEnvelope,
  isEnvelopeWarp,
  isPathWarp,
  toTitleCase,
  WARP_STYLES,
  type WarpStyle,
} from '../src/curve';
import { CUSTOM_PROPERTIES } from '../src/document';

describe('curveArc', () => {
  it('straight below 1', () => {
    expect(curveArc(300, 0)).toBeUndefined();
    expect(curveArc(300, 0.5)).toBeUndefined();
  });

  it('arc length equals the text width, so the text fills the whole arc', () => {
    for (const amount of [10, 50, 87, 100, -40]) {
      const a = curveArc(260, amount)!;
      expect(a.radius * a.sweep).toBeCloseTo(260);
    }
  });

  it('100 is a half circle and the sagitta grows with the amount', () => {
    const half = curveArc(260, 100)!;
    expect(half.sweep).toBeCloseTo(Math.PI);
    expect(half.sagitta).toBeCloseTo(half.radius);
    expect(curveArc(260, 30)!.sagitta).toBeLessThan(curveArc(260, 87)!.sagitta);
  });

  it('positive bulges up (sweep flag 1, ends below the top), negative down', () => {
    const up = curveArc(260, 87)!;
    expect(up.d).toMatch(new RegExp(`^M -[\\d.]+ ${up.sagitta} A .* 0 0 1 [\\d.]+ ${up.sagitta}$`));
    const down = curveArc(260, -87)!;
    expect(down.d).toMatch(new RegExp(`^M -[\\d.]+ -${down.sagitta} A .* 0 0 0 [\\d.]+ -${down.sagitta}$`));
  });
});

describe('path warp curves (wave, flag, rise, curvePath)', () => {
  it('returns undefined when bend < 1', () => {
    expect(curveWave(300, 0)).toBeUndefined();
    expect(curveFlag(300, 0.5)).toBeUndefined();
    expect(curveRise(300, 0)).toBeUndefined();
    expect(curvePath('wave', 300, 0)).toBeUndefined();
    expect(curvePath('none', 300, 50)).toBeUndefined();
  });

  it('generates cubic Bézier path for curveWave', () => {
    const wave = curveWave(200, 50)!;
    expect(wave.d).toMatch(/^M -100 0 C -50 -?\d+ 50 -?\d+ 100 0$/);
    expect(wave.sagitta).toBeGreaterThan(0);
  });

  it('generates asymmetrical wave for curveFlag', () => {
    const flag = curveFlag(200, 60)!;
    expect(flag.d).toMatch(/^M -100 0 C /);
    expect(flag.sagitta).toBeGreaterThan(0);
  });

  it('generates diagonal S-curve for curveRise', () => {
    const rise = curveRise(200, 50)!;
    expect(rise.d).toMatch(/^M -100 \d+ C .* 100 -\d+$/);
    expect(rise.sagitta).toBeGreaterThan(0);
  });

  it('curvePath dispatches to all path styles', () => {
    for (const style of ['arc', 'wave', 'flag', 'rise'] as WarpStyle[]) {
      expect(isPathWarp(style)).toBe(true);
      expect(curvePath(style, 250, 50)).toBeDefined();
    }
    expect(isPathWarp('bulge')).toBe(false);
    expect(isPathWarp('none')).toBe(false);
  });
});

describe('14 warp styles catalog and classification', () => {
  it('has 15 total entries in WARP_STYLES (14 deformation styles + none)', () => {
    expect(WARP_STYLES).toHaveLength(15);
    const nonNone = WARP_STYLES.filter((s) => s.id !== 'none');
    expect(nonNone).toHaveLength(14);
  });

  it('classifies styles as path or envelope correctly', () => {
    const expectedEnvelope: WarpStyle[] = [
      'arc-upper',
      'arc-lower',
      'bulge',
      'squeeze',
      'shell-upper',
      'shell-lower',
      'fish',
      'fisheye',
      'inflate',
      'twist',
    ];
    for (const s of expectedEnvelope) {
      expect(isEnvelopeWarp(s)).toBe(true);
      expect(isPathWarp(s)).toBe(false);
    }
  });
});

describe('evalWarpEnvelope and evalEnvelopeColumn', () => {
  it('identity mapping when bend = 0 and no distortion', () => {
    for (const style of WARP_STYLES.map((s) => s.id)) {
      const pt = evalWarpEnvelope(style, 0.4, -0.6, 0, 0, 0);
      expect(pt.u).toBeCloseTo(0.4);
      expect(pt.v).toBeCloseTo(-0.6);
    }
  });

  it('bulge: arches outward at center (u=0)', () => {
    const top = evalWarpEnvelope('bulge', 0, -1, 50);
    const bottom = evalWarpEnvelope('bulge', 0, 1, 50);
    expect(top.v).toBeLessThan(-1); // Top moves higher (more negative)
    expect(bottom.v).toBeGreaterThan(1); // Bottom moves lower
  });

  it('squeeze: compresses inward at center (u=0)', () => {
    const top = evalWarpEnvelope('squeeze', 0, -1, 50);
    const bottom = evalWarpEnvelope('squeeze', 0, 1, 50);
    expect(top.v).toBeGreaterThan(-1); // Top moves down toward center
    expect(bottom.v).toBeLessThan(1); // Bottom moves up toward center
  });

  it('arc-upper: top arches while bottom stays flat at v=1', () => {
    const top = evalWarpEnvelope('arc-upper', 0, -1, 50);
    const bottom = evalWarpEnvelope('arc-upper', 0, 1, 50);
    expect(top.v).toBeLessThan(-1);
    expect(bottom.v).toBeCloseTo(1);
  });

  it('arc-lower: bottom arches while top stays flat at v=-1', () => {
    const top = evalWarpEnvelope('arc-lower', 0, -1, 50);
    const bottom = evalWarpEnvelope('arc-lower', 0, 1, 50);
    expect(top.v).toBeCloseTo(-1);
    expect(bottom.v).toBeGreaterThan(1);
  });

  it('twist: causes opposing displacement on left vs right', () => {
    const left = evalWarpEnvelope('twist', -0.5, 0, 50);
    const right = evalWarpEnvelope('twist', 0.5, 0, 50);
    expect(Math.sign(left.v)).not.toBe(Math.sign(right.v));
  });

  it('fish: left side expands more than right side', () => {
    const left = evalWarpEnvelope('fish', -0.3, 1, 50);
    const right = evalWarpEnvelope('fish', 0.8, 1, 50);
    expect(left.v).toBeGreaterThan(right.v);
  });

  it('evalEnvelopeColumn returns column parameters for vertical slicing', () => {
    const col = evalEnvelopeColumn('bulge', 0, 50);
    expect(col.top).toBeLessThan(-1);
    expect(col.bottom).toBeGreaterThan(1);
    expect(col.scaleX).toBeGreaterThanOrEqual(1);
  });
});

describe('typography helpers: toTitleCase and cycleTextCase', () => {
  it('toTitleCase capitalizes words and preserves short Portuguese prepositions', () => {
    expect(toTitleCase('de r$ 199,90 por r$ 99,90')).toBe('De R$ 199,90 por R$ 99,90');
    expect(toTitleCase('promoção relâmpago de verão com desconto')).toBe('Promoção Relâmpago de Verão com Desconto');
  });

  it('cycleTextCase cycles UPPERCASE -> lowercase -> Title Case -> UPPERCASE', () => {
    const title = 'Promoção Relâmpago';
    const upper = cycleTextCase(title);
    expect(upper).toBe('PROMOÇÃO RELÂMPAGO');

    const lower = cycleTextCase(upper);
    expect(lower).toBe('promoção relâmpago');

    const backToTitle = cycleTextCase(lower);
    expect(backToTitle).toBe('Promoção Relâmpago');

    const backToUpper = cycleTextCase(backToTitle);
    expect(backToUpper).toBe('PROMOÇÃO RELÂMPAGO');
  });

  it('cycleTextCase leaves numbers/punctuation unchanged', () => {
    expect(cycleTextCase('12345')).toBe('12345');
    expect(cycleTextCase('')).toBe('');
  });
});

describe('document persistence of warp properties', () => {
  it('CUSTOM_PROPERTIES includes all warp properties', () => {
    expect(CUSTOM_PROPERTIES).toContain('curve');
    expect(CUSTOM_PROPERTIES).toContain('warpStyle');
    expect(CUSTOM_PROPERTIES).toContain('warpBend');
    expect(CUSTOM_PROPERTIES).toContain('warpDistortH');
    expect(CUSTOM_PROPERTIES).toContain('warpDistortV');
  });
});
