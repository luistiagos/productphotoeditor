import { describe, expect, it } from 'vitest';
import { curveArc } from '../src/curve';

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
