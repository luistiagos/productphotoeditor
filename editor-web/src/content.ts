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
  return new URL(file, CONTENT_BASE).href;
}

async function getJson<T>(file: string): Promise<T> {
  const res = await fetch(contentUrl(file));
  if (!res.ok) throw new Error(`content ${file}: ${res.status}`);
  return (await res.json()) as T;
}

export async function loadContentIndex(): Promise<ContentIndex> {
  const main = await getJson<Omit<ContentIndex, 'scenes'>>('index.json');
  // os cenários da foto de produto (fase 2) também servem de fundo
  const scenes = await getJson<{ scenes: SceneEntry[] }>('scenes/index.json')
    .then((s) => s.scenes.map((e) => ({ ...e, file: 'scenes/' + e.file, thumb: 'scenes/' + e.thumb })))
    .catch(() => [] as SceneEntry[]);
  return { ...main, scenes };
}

export async function loadTemplate(entry: TemplateEntry): Promise<unknown> {
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
