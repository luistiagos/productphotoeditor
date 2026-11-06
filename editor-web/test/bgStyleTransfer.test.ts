import { describe, expect, it } from 'vitest';
import { extractBackgroundStyle, moodOf, worstContrast } from '../src/bgStyleTransfer';
import { contrastRatio, GOOD_CONTRAST, parseColor } from '../src/contrast';
import { isGradientSpec } from '../src/gradients';

const readable = (s: NonNullable<ReturnType<typeof extractBackgroundStyle>>) =>
  worstContrast(s.recommendedTextColor, [parseColor(s.primaryBgColor)!, parseColor(s.secondaryBgColor)!]);

describe('extractBackgroundStyle', () => {
  it('dark colors → mood dark and white text', () => {
    const s = extractBackgroundStyle(['#101820', '#2a2a3a'])!;
    expect(s.mood).toBe('dark');
    expect(s.recommendedTextColor).toBe('#ffffff');
    expect(s.primaryBgColor).toBe('#101820'); // já legível: a cor da foto fica como está
  });

  it('light colors → mood light and near-black text', () => {
    const s = extractBackgroundStyle(['#ffd8a8', '#ffe8cc'])!;
    expect(s.mood).toBe('light');
    expect(s.recommendedTextColor).toBe('#111111');
  });

  it('saturated colors → mood vibrant', () => {
    const s = extractBackgroundStyle(['#ff0066', '#ff9900'])!;
    expect(s.mood).toBe('vibrant');
    expect(s.recommendedTextColor).toBe('#111111');
  });

  it('near-white greys → mood minimal', () => {
    expect(extractBackgroundStyle(['#f5f5f5', '#e8e8e8'])!.mood).toBe('minimal');
    expect(moodOf([parseColor('#ffffff')!])).toBe('minimal');
  });

  it('no usable color → null', () => {
    expect(extractBackgroundStyle([])).toBeNull();
    expect(extractBackgroundStyle(['nope', '#00000000'])).toBeNull();
  });

  it('text over the whole gradient reaches 4.5:1, adjusting the stops when the photo colors are mid-tones', () => {
    for (const colors of [['#101820', '#2a2a3a'], ['#ffd8a8', '#ffe8cc'], ['#ff0066', '#ff9900'], ['#808080', '#777777'],
      ['#3b6fd8', '#ffcc00'], ['#00a86b'], ['#ffffff', '#000000']]) {
      const s = extractBackgroundStyle(colors)!;
      expect(readable(s), colors.join(',')).toBeGreaterThanOrEqual(GOOD_CONTRAST);
      for (const st of s.gradient.stops) expect(contrastRatio(s.recommendedTextColor, st.color)).toBeGreaterThanOrEqual(GOOD_CONTRAST);
    }
  });

  it('builds a two-stop linear gradient from the photo colors (a shade when there is only one)', () => {
    const s = extractBackgroundStyle(['#1a237e', '#3949ab', '#ffffff'])!;
    expect(isGradientSpec(s.gradient)).toBe(true);
    expect(s.gradient.kind).toBe('linear');
    expect(s.gradient.stops.map((x) => x.color)).toEqual([s.primaryBgColor, s.secondaryBgColor]);
    expect(s.primaryBgColor).toBe('#1a237e');
    expect(s.secondaryBgColor).toBe('#3949ab');
    const one = extractBackgroundStyle(['#1a237e'])!;
    expect(one.secondaryBgColor).not.toBe(one.primaryBgColor);
  });
});
