// SVG portátil (ARQUITETURA §15.1): o Fabric grava a imagem sem filtro como a URL do asset
// loader e a fonte como url(...) do @font-face. Fora do app essas URLs não existem, então
// cada uma vira dataURL.

const HREF_RE = /(xlink:href|href)="([^"]+)"/g;
const FONT_URL_RE = /url\((['"]?)([^'")]+)\1\)/g;

export type Fetcher = (url: string) => Promise<string>;

function needsInline(url: string): boolean {
  return !url.startsWith('data:') && !url.startsWith('#');
}

function unescapeXml(s: string): string {
  return s.replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
}

/** Troca toda URL externa de href e de url(...) por dataURL (cada URL é baixada uma vez). */
export async function inlineSvgResources(svg: string, fetchAsDataUrl: Fetcher): Promise<string> {
  const urls = new Set<string>();
  for (const m of svg.matchAll(HREF_RE)) if (needsInline(m[2])) urls.add(m[2]);
  for (const m of svg.matchAll(FONT_URL_RE)) if (needsInline(m[2])) urls.add(m[2]);
  const resolved = new Map<string, string>();
  await Promise.all(
    [...urls].map(async (u) => {
      resolved.set(u, await fetchAsDataUrl(unescapeXml(u)));
    }),
  );
  return svg
    .replace(HREF_RE, (whole, attr: string, url: string) => {
      const data = resolved.get(url);
      return data ? `${attr}="${data}"` : whole;
    })
    .replace(FONT_URL_RE, (whole, _q: string, url: string) => {
      const data = resolved.get(url);
      return data ? `url('${data}')` : whole;
    });
}

/** Fetcher do navegador: baixa e converte para dataURL com o tipo informado pelo servidor. */
export const browserFetcher: Fetcher = async (url) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`fetch ${url}: ${res.status}`);
  let blob = await res.blob();
  // o WebViewAssetLoader não conhece ttf/otf/woff2 e responde text/plain (ARQUITETURA §15.1)
  const ext = url.split('?')[0].split('.').pop()?.toLowerCase();
  const fontMime: Record<string, string> = { ttf: 'font/ttf', otf: 'font/otf', woff2: 'font/woff2', woff: 'font/woff' };
  if (ext && fontMime[ext]) blob = new Blob([blob], { type: fontMime[ext] });
  return await new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
};
