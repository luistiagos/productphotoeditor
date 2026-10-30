import { describe, expect, it } from 'vitest';
import { DESIGN_FORMATS, findFormat, FORMATS, formatSvg, GROUP_LABELS } from '../src/formats';

describe('formats', () => {
  it('ids are unique and sizes positive', () => {
    expect(new Set(FORMATS.map((f) => f.id)).size).toBe(FORMATS.length);
    for (const f of FORMATS) expect(f.width > 0 && f.height > 0).toBe(true);
  });

  it('every group has a section and the design list has no quick formats', () => {
    const groups = new Set(GROUP_LABELS.map(([g]) => g));
    for (const f of FORMATS) expect(groups.has(f.group)).toBe(true);
    expect(DESIGN_FORMATS.some((f) => f.group === 'quick')).toBe(false);
    expect(DESIGN_FORMATS.map((f) => f.id)).toContain('yt_banner');
  });

  it('findFormat returns the first catalog entry with that size', () => {
    expect(findFormat(1640, 624)?.id).toBe('fb_cover');
    expect(findFormat(1080, 1920)?.id).toBe('ig_reels');
    expect(findFormat(123, 456)).toBeUndefined();
    expect(findFormat(800, 800)?.id).toBe('profile');
    expect(findFormat(728, 90)?.id).toBe('web_leaderboard');
    expect(findFormat(1584, 396)?.id).toBe('li_cover');
  });

  it('svg keeps the aspect inside the 100×100 box', () => {
    const svg = formatSvg({ width: 2560, height: 1440, platform: 'youtube', look: 'channel_banner' });
    expect(svg.startsWith('<svg')).toBe(true);
    expect(svg).toContain('width="96" height="54"');
    expect(formatSvg({ width: 1080, height: 1920, platform: 'tiktok', look: 'vertical_video' })).toContain('width="54" height="96"');
    for (const f of FORMATS) expect(formatSvg(f)).not.toContain('NaN');
  });
});
