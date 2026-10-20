import { describe, expect, it } from 'vitest';
import { inlineSvgResources } from '../src/svgExport';

describe('inlineSvgResources', () => {
  it('inlines image hrefs and font urls once each, leaving data URLs and fragments', async () => {
    const svg = '<svg><defs><style>@font-face{font-family:\'Lobster\';src:url(\'https://appassets.androidplatform.net/assets/content/fonts/Lobster-Regular.ttf\');}</style></defs>\n'
      + '<image xlink:href="https://appassets.androidplatform.net/blob/a.png?x=1&amp;y=2"/><image xlink:href="https://appassets.androidplatform.net/blob/a.png?x=1&amp;y=2"/>\n'
      + '<image xlink:href="data:image/png;base64,AAA"/><use href="#p1"/></svg>';
    const calls: string[] = [];
    const out = await inlineSvgResources(svg, async (u) => { calls.push(u); return 'data:x;base64,' + calls.length; });
    expect(calls.sort()).toEqual([
      'https://appassets.androidplatform.net/assets/content/fonts/Lobster-Regular.ttf',
      'https://appassets.androidplatform.net/blob/a.png?x=1&y=2',
    ]);
    expect(out).not.toContain('appassets');
    expect(out).toContain('data:image/png;base64,AAA');
    expect(out).toContain('href="#p1"');
    expect(out.match(/xlink:href="data:x/g)).toHaveLength(2);
    expect(out).toMatch(/src:url\('data:x;base64,\d'\)/);
  });
});
