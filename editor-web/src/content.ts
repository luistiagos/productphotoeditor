// Conteúdo empacotado (ARQUITETURA §8): assets/content/index.json, servido pelo asset loader
// em ../content/ relativo a assets/editor/index.html.

export const CONTENT_BASE = new URL('../content/', document.baseURI).href;

export interface FontEntry {
  family: string;
  file: string;
  /** Faixa ou peso fixo, no formato do descritor FontFace ("400", "100 900"). */
  weight?: string;
  style?: 'normal' | 'italic';
  category?: string;
}
export interface TemplateEntry {
  id: string;
  name: string;
  category: string;
  file: string;
  thumbnail?: string;
  isRemote?: boolean;
}
export interface StickerEntry {
  id: string;
  name: string;
  category: string;
  file: string;
}
export interface BackgroundEntry {
  id: string;
  name: string;
  /** solid: colors[0]; linear/radial: gradiente; image: file */
  kind: 'solid' | 'linear' | 'radial' | 'image';
  colors?: string[];
  angle?: number;
  file?: string;
}
export interface SceneEntry {
  id: string;
  file: string;
  thumb: string;
}

export interface ContentIndex {
  version: number;
  fonts: FontEntry[];
  templates: TemplateEntry[];
  stickers: StickerEntry[];
  backgrounds: BackgroundEntry[];
  scenes: SceneEntry[];
}

export function contentUrl(file: string): string {
  if (file.startsWith('http://') || file.startsWith('https://')) return file;
  return new URL(file, CONTENT_BASE).href;
}

async function getJson<T>(file: string): Promise<T> {
  const res = await fetch(contentUrl(file));
  if (!res.ok) throw new Error(`content ${file}: ${res.status}`);
  return (await res.json()) as T;
}

export const REMOTE_TEMPLATES_CATALOG_URL = 'https://huggingface.co/datasets/luisluis123/mockups/resolve/main/templates/catalog.json';
export const REMOTE_ICONS_URL = 'https://huggingface.co/datasets/luisluis123/mockups/resolve/main/presets/icons.json';

async function fetchRemoteTemplates(): Promise<TemplateEntry[]> {
  try {
    const res = await fetch(REMOTE_TEMPLATES_CATALOG_URL);
    if (!res.ok) return [];
    const data = await res.json() as { templates?: Array<{ id: number | string; category: string; hdImage: string; thumbnail: string; canvasJson: string; remoteBaseUrl: string }> };
    if (!Array.isArray(data.templates)) return [];
    const catMap: Record<string, string> = {
      product: 'Produtos',
      poster: 'Pôsteres',
      label: 'Rótulos & Embalagens',
    };
    return data.templates.map((t) => {
      const cat = catMap[t.category] ?? t.category;
      const rawBase = t.remoteBaseUrl ?? 'https://huggingface.co/datasets/luisluis123/mockups/resolve/main/';
      const base = rawBase.replace(/\/+$/, '') + '/';
      return {
        id: `hf_${t.id}`,
        name: `${cat} #${t.id}`,
        category: cat,
        file: base + t.canvasJson.replace(/^\/+/, ''),
        thumbnail: base + t.thumbnail.replace(/^\/+/, ''),
        isRemote: true,
      };
    });
  } catch (e) {
    console.warn('Failed to fetch remote templates from Hugging Face', e);
    return [];
  }
}

async function fetchRemoteIcons(): Promise<StickerEntry[]> {
  try {
    const res = await fetch(REMOTE_ICONS_URL);
    if (!res.ok) return [];
    const data = await res.json() as Array<{ image: string; category: string; isSvg?: boolean }>;
    if (!Array.isArray(data)) return [];
    return data.map((item, idx) => {
      const catName = item.category.charAt(0).toUpperCase() + item.category.slice(1);
      return {
        id: `icon_${idx}`,
        name: `${catName} ${idx + 1}`,
        category: `Ícones (${catName})`,
        file: item.image,
      };
    });
  } catch (e) {
    console.warn('Failed to fetch remote icons', e);
    return [];
  }
}

export async function loadContentIndex(): Promise<ContentIndex> {
  const main = await getJson<Omit<ContentIndex, 'scenes'>>('index.json');
  // os cenários da foto de produto (fase 2) também servem de fundo
  const scenes = await getJson<{ scenes: SceneEntry[] }>('scenes/index.json')
    .then((s) => s.scenes.map((e) => ({ ...e, file: 'scenes/' + e.file, thumb: 'scenes/' + e.thumb })))
    .catch(() => [] as SceneEntry[]);

  const [remoteTemplates, remoteIcons] = await Promise.all([
    fetchRemoteTemplates(),
    fetchRemoteIcons(),
  ]);

  return {
    ...main,
    templates: [...main.templates, ...remoteTemplates],
    stickers: [...main.stickers, ...remoteIcons],
    scenes,
  };
}

export async function loadTemplate(entry: TemplateEntry): Promise<unknown> {
  if (entry.isRemote || entry.file.startsWith('http://') || entry.file.startsWith('https://')) {
    const res = await fetch(entry.file);
    if (!res.ok) throw new Error(`remote template ${entry.file}: ${res.status}`);
    return await res.json();
  }
  return getJson<unknown>(entry.file);
}

// ---- Fontes ----

const loaded = new Map<string, Promise<void>>();
const fontUrls = new Map<string, string>();

/** Registra a família (sem baixar ainda). */
export function registerFont(family: string, url: string, weight?: string, style?: string): void {
  fontUrls.set(family, url);
  if (loaded.has(family)) return;
  const face = new FontFace(family, `url("${url}")`, { weight: weight ?? '400', style: style ?? 'normal', display: 'block' });
  document.fonts.add(face);
  loaded.set(family, face.load().then(() => undefined, (e: unknown) => console.warn('font', family, e)));
}

export function registerBundledFonts(fonts: FontEntry[]): void {
  for (const f of fonts) registerFont(f.family, contentUrl(f.file), f.weight, f.style);
}

/** Espera as famílias pedidas (as desconhecidas são ignoradas: o navegador usa a substituta). */
export async function ensureFonts(families: Iterable<string>): Promise<void> {
  await Promise.all([...families].map((f) => loaded.get(f) ?? Promise.resolve()));
}

export function fontUrl(family: string): string | undefined {
  return fontUrls.get(family);
}

export function knownFamilies(): string[] {
  return [...fontUrls.keys()].sort((a, b) => a.localeCompare(b));
}
