// Catálogo de formatos (HANDOFF §46). Espelho de core/ui/.../MediaFormats.kt: mesmos ids e tamanhos — o
// MediaFormatsTest (JVM) lê este arquivo e falha se divergirem. Uma entrada por linha, nesse formato.

export type FormatGroup = 'quick' | 'profile' | 'instagram' | 'facebook' | 'linkedin' | 'youtube' | 'tiktok' | 'basic' | 'small' | 'print';
export type FormatPlatform = 'instagram' | 'facebook' | 'youtube' | 'tiktok' | 'linkedin' | 'generic' | 'print';
export type FormatLook = 'plain' | 'feed' | 'vertical_video' | 'thumbnail' | 'cover' | 'channel_banner' | 'profile' | 'page';

export interface MediaFormat {
  id: string;
  label: string;
  width: number;
  height: number;
  group: FormatGroup;
  platform: FormatPlatform;
  look: FormatLook;
  hint: string;
}

type Row = [string, string, number, number, FormatGroup, FormatPlatform, FormatLook, string];

const ROWS: Row[] = [
  ['quick_square', 'Quadrado', 512, 512, 'quick', 'generic', 'plain', 'Rápido, 1:1'],
  ['quick_portrait', 'Retrato', 512, 768, 'quick', 'generic', 'plain', 'Rápido, 2:3'],
  ['quick_landscape', 'Paisagem', 768, 512, 'quick', 'generic', 'plain', 'Rápido, 3:2'],
  ['profile', 'Foto de perfil', 800, 800, 'profile', 'generic', 'profile', 'Instagram, Facebook, X, LinkedIn, TikTok e YouTube; aparece em círculo'],
  ['ig_post', 'Post Instagram', 1080, 1350, 'instagram', 'instagram', 'feed', 'Feed, 4:5'],
  ['ig_reels', 'Reels Instagram', 1080, 1920, 'instagram', 'instagram', 'vertical_video', 'Reels e Stories, 9:16'],
  ['fb_post', 'Post Facebook', 1080, 1080, 'facebook', 'facebook', 'feed', 'Feed, 1:1'],
  ['fb_cover', 'Capa Facebook', 1640, 624, 'facebook', 'facebook', 'cover', 'Capa da página'],
  ['fb_reels', 'Reels Facebook', 1080, 1920, 'facebook', 'facebook', 'vertical_video', 'Reels e Stories, 9:16'],
  ['li_post', 'Post LinkedIn', 1200, 627, 'linkedin', 'linkedin', 'feed', 'Feed, horizontal'],
  ['li_square', 'Post LinkedIn quadrado', 1200, 1200, 'linkedin', 'linkedin', 'feed', 'Feed, 1:1'],
  ['li_portrait', 'Post LinkedIn vertical', 1080, 1350, 'linkedin', 'linkedin', 'feed', 'Feed, 4:5'],
  ['li_cover', 'Capa LinkedIn', 1584, 396, 'linkedin', 'linkedin', 'cover', 'Capa do perfil'],
  ['yt_shorts', 'Shorts YouTube', 1080, 1920, 'youtube', 'youtube', 'vertical_video', 'Vídeo curto, 9:16'],
  ['yt_thumb', 'Thumbnail YouTube', 1280, 720, 'youtube', 'youtube', 'thumbnail', 'Miniatura do vídeo, 16:9'],
  ['yt_banner', 'Capa do canal YouTube', 2560, 1440, 'youtube', 'youtube', 'channel_banner', 'Texto e logo só na faixa central'],
  ['tt_video', 'Vídeo TikTok', 1080, 1920, 'tiktok', 'tiktok', 'vertical_video', 'Vídeo do feed, 9:16'],
  ['tt_ad', 'Anúncio TikTok', 1080, 1920, 'tiktok', 'tiktok', 'vertical_video', 'Anúncio no feed, 9:16'],
  ['square', 'Quadrado', 1080, 1080, 'basic', 'generic', 'plain', '1:1'],
  ['portrait', 'Retrato', 1080, 1620, 'basic', 'generic', 'plain', '2:3'],
  ['landscape', 'Paisagem', 1620, 1080, 'basic', 'generic', 'plain', '3:2'],
  ['story', 'Story', 1080, 1920, 'basic', 'generic', 'plain', '9:16'],
  ['banner', 'Banner', 1920, 1080, 'basic', 'generic', 'plain', '16:9'],
  ['small_icon', 'Ícone', 256, 256, 'small', 'generic', 'plain', '1:1'],
  ['small_square', 'Quadrado pequeno', 500, 500, 'small', 'generic', 'plain', '1:1'],
  ['small_portrait', 'Retrato pequeno', 400, 600, 'small', 'generic', 'plain', '2:3'],
  ['small_landscape', 'Paisagem pequena', 600, 400, 'small', 'generic', 'plain', '3:2'],
  ['small_photo', 'Foto 4:3', 640, 480, 'small', 'generic', 'plain', '4:3'],
  ['small_vertical', 'Vertical pequeno', 360, 640, 'small', 'generic', 'plain', '9:16'],
  ['small_wide', 'Widescreen pequeno', 640, 360, 'small', 'generic', 'plain', '16:9'],
  ['web_rectangle', 'Anúncio de site', 300, 250, 'small', 'generic', 'plain', 'Retângulo médio de anúncio'],
  ['web_leaderboard', 'Banner de site', 728, 90, 'small', 'generic', 'plain', 'Faixa de anúncio no topo da página'],
  ['logo', 'Logo', 1000, 1000, 'print', 'print', 'plain', '1:1'],
  ['business_card', 'Cartão de visita', 1050, 600, 'print', 'print', 'page', '8,9 × 5,1 cm'],
  ['a4', 'Folheto A4', 1240, 1754, 'print', 'print', 'page', '150 dpi'],
  ['a3', 'Pôster A3', 1754, 2480, 'print', 'print', 'page', '150 dpi'],
];

export const FORMATS: MediaFormat[] = ROWS.map(([id, label, width, height, group, platform, look, hint]) =>
  ({ id, label, width, height, group, platform, look, hint }));

/** Ordem das seções do seletor. */
export const GROUP_LABELS: [FormatGroup, string][] = [
  ['quick', 'Rápidos'], ['profile', 'Foto de perfil'], ['instagram', 'Instagram'], ['facebook', 'Facebook'],
  ['linkedin', 'LinkedIn'], ['youtube', 'YouTube'], ['tiktok', 'TikTok'], ['basic', 'Básicos'], ['small', 'Pequenos'],
  ['print', 'Impressão e marca'],
];

/** Painel Tamanho do editor: sem os rápidos de 512 px (que são do "Gerar imagem"). */
export const DESIGN_FORMATS = FORMATS.filter((f) => f.group !== 'quick');

const BRAND: Record<FormatPlatform, string> = {
  instagram: '#d62976', facebook: '#1877f2', youtube: '#ff0000', tiktok: '#111111', linkedin: '#0a66c2', generic: '#6b7280', print: '#3b6fd8',
};
const BADGE: Partial<Record<FormatPlatform, string>> = { instagram: 'IG', facebook: 'f', youtube: '▶', tiktok: '♪', linkedin: 'in' };

/** Formato com o tamanho dado, se for um do catálogo (para destacar o atual no painel). */
export function findFormat(width: number, height: number, list: MediaFormat[] = DESIGN_FORMATS): MediaFormat | undefined {
  return list.find((f) => f.width === width && f.height === height);
}

const n = (v: number) => Math.round(v * 10) / 10;

/** Ícone de "foto" (sol + montanha) centrado em (cx, cy), largura s. */
function picture(cx: number, cy: number, s: number, opacity: number): string {
  return `<g style="fill:var(--muted)" opacity="${opacity}"><circle cx="${n(cx + s * 0.22)}" cy="${n(cy - s * 0.2)}" r="${n(s * 0.1)}"/>`
    + `<path d="M${n(cx - s / 2)} ${n(cy + s * 0.3)}L${n(cx - s * 0.12)} ${n(cy - s * 0.12)}L${n(cx + s * 0.1)} ${n(cy + s * 0.1)}`
    + `L${n(cx + s * 0.25)} ${n(cy - s * 0.02)}L${n(cx + s / 2)} ${n(cy + s * 0.3)}Z"/></g>`;
}

/**
 * Desenho do formato em SVG (viewBox 100×100): retângulo na proporção exata e o "jeito" da rede por cima — o mesmo
 * desenho do FormatThumbnail do Compose. Só recebe dados do catálogo ou números, então o markup é seguro para innerHTML.
 */
export function formatSvg(f: Pick<MediaFormat, 'width' | 'height' | 'platform' | 'look'>): string {
  const aspect = f.width / f.height;
  const w = aspect >= 1 ? 96 : 96 * aspect;
  const h = aspect >= 1 ? 96 / aspect : 96;
  const x = (100 - w) / 2, y = (100 - h) / 2, cx = 50, cy = 50, u = Math.min(w, h);
  const brand = BRAND[f.platform];
  const rx = n(u * 0.06);
  const parts: string[] = [];
  const bg = f.look === 'page' ? 'fill="#fff"' : `fill="${brand}" fill-opacity="0.16"`;
  parts.push(`<rect x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(h)}" rx="${rx}" style="fill:var(--chip)"/>`);
  parts.push(`<rect x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(h)}" rx="${rx}" ${bg}/>`);
  switch (f.look) {
    case 'plain': parts.push(picture(cx, cy, u * 0.5, 0.55)); break;
    case 'feed': {
      parts.push(picture(cx, y + h * 0.42, u * 0.45, 0.55));
      const bar = h * 0.16;
      parts.push(`<rect x="${n(x)}" y="${n(y + h - bar)}" width="${n(w)}" height="${n(bar)}" style="fill:var(--surface)"/>`);
      for (let i = 0; i < 3; i++) parts.push(`<circle cx="${n(x + bar * (0.6 + i * 0.75))}" cy="${n(y + h - bar / 2)}" r="${n(bar * 0.22)}" style="fill:var(--muted)"/>`);
      break;
    }
    case 'vertical_video': {
      parts.push(picture(cx, y + h * 0.38, u * 0.5, 0.45));
      const d = w * 0.075;
      for (let i = 0; i < 4; i++) parts.push(`<circle cx="${n(x + w - d * 2)}" cy="${n(y + h * (0.48 + i * 0.1))}" r="${n(d)}" fill="#fff" fill-opacity="0.9"/>`);
      parts.push(`<rect x="${n(x + w * 0.08)}" y="${n(y + h * 0.84)}" width="${n(w * 0.6)}" height="${n(h * 0.025)}" rx="1" style="fill:var(--muted)"/>`);
      parts.push(`<rect x="${n(x + w * 0.08)}" y="${n(y + h * 0.9)}" width="${n(w * 0.4)}" height="${n(h * 0.025)}" rx="1" style="fill:var(--muted)" opacity="0.7"/>`);
      break;
    }
    case 'thumbnail': {
      const bw = u * 0.42, bh = bw * 0.7, t = bh * 0.28;
      parts.push(`<rect x="${n(cx - bw / 2)}" y="${n(cy - bh / 2)}" width="${n(bw)}" height="${n(bh)}" rx="${n(bh * 0.25)}" fill="${brand}"/>`);
      parts.push(`<path d="M${n(cx - t * 0.7)} ${n(cy - t)}L${n(cx + t)} ${n(cy)}L${n(cx - t * 0.7)} ${n(cy + t)}Z" fill="#fff"/>`);
      parts.push(`<rect x="${n(x + w * 0.8)}" y="${n(y + h * 0.83)}" width="${n(w * 0.15)}" height="${n(h * 0.11)}" rx="1" fill="#000" fill-opacity="0.75"/>`);
      break;
    }
    case 'cover': {
      parts.push(picture(x + w * 0.6, cy, u * 0.5, 0.45));
      const r = h * 0.3, pcx = x + w * 0.06 + r, pcy = y + h - r * 0.8;
      parts.push(`<circle cx="${n(pcx)}" cy="${n(pcy)}" r="${n(r)}" fill="#fff"/><circle cx="${n(pcx)}" cy="${n(pcy)}" r="${n(r * 0.8)}" fill="${brand}"/>`);
      break;
    }
    case 'channel_banner': {
      // faixa segura do YouTube: 1546×423 de 2560×1440
      const sw = w * 1546 / 2560, sh = h * 423 / 1440;
      parts.push(`<rect x="${n(cx - sw / 2)}" y="${n(cy - sh / 2)}" width="${n(sw)}" height="${n(sh)}" style="fill:var(--surface)" stroke="${brand}" stroke-width="1" stroke-dasharray="3 2"/>`);
      parts.push(`<rect x="${n(cx - sw * 0.3)}" y="${n(cy - sh * 0.1)}" width="${n(sw * 0.6)}" height="${n(sh * 0.2)}" rx="${n(sh * 0.1)}" style="fill:var(--muted)"/>`);
      break;
    }
    case 'profile': {
      const r = u * 0.46;
      parts.push(`<circle cx="${cx}" cy="${cy}" r="${n(r)}" style="fill:var(--surface)" stroke="${brand}" stroke-width="1.5"/>`);
      parts.push(`<circle cx="${cx}" cy="${n(cy - r * 0.22)}" r="${n(r * 0.32)}" style="fill:var(--muted)"/>`);
      parts.push(`<path d="M${n(cx - r * 0.6)} ${n(cy + r * 0.75)}A${n(r * 0.6)} ${n(r * 0.55)} 0 0 1 ${n(cx + r * 0.6)} ${n(cy + r * 0.75)}Z" style="fill:var(--muted)"/>`);
      break;
    }
    case 'page': {
      const fold = u * 0.22;
      parts.push(`<path d="M${n(x + w - fold)} ${n(y)}L${n(x + w)} ${n(y + fold)}L${n(x + w - fold)} ${n(y + fold)}Z" fill="#d9dde5"/>`);
      for (let i = 0; i < 4; i++) {
        const lw = i === 0 ? w * 0.5 : w * (0.7 - i * 0.08);
        parts.push(`<rect x="${n(x + w * 0.12)}" y="${n(y + h * (0.3 + i * 0.13))}" width="${n(lw)}" height="${n(u * 0.05)}" fill="#b8bec9"/>`);
      }
      break;
    }
  }
  parts.push(`<rect x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(h)}" rx="${rx}" fill="none" stroke="${brand}" stroke-opacity="0.6" stroke-width="1"/>`);
  const badge = BADGE[f.platform];
  if (badge) {
    const b = Math.min(Math.max(u * 0.24, 12), 20);
    parts.push(`<rect x="${n(x + 3)}" y="${n(y + 3)}" width="${n(b)}" height="${n(b)}" rx="${n(b * 0.25)}" fill="${brand}"/>`
      + `<text x="${n(x + 3 + b / 2)}" y="${n(y + 3 + b / 2)}" fill="#fff" font-size="${n(b * 0.55)}" font-weight="700" `
      + `text-anchor="middle" dominant-baseline="central" font-family="sans-serif">${badge}</text>`);
  }
  return `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${parts.join('')}</svg>`;
}
