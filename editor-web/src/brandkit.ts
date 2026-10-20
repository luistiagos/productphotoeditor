import { type EditorDocument, walkObjects } from './document';

// Brand kit (ARQUITETURA §9 e §15.2). O mesmo formato é gravado pelo Kotlin (BrandKit.kt).

export const COLOR_ROLES = ['primary', 'secondary', 'accent', 'text', 'background'] as const;
export type ColorRole = (typeof COLOR_ROLES)[number];
export const FONT_ROLES = ['heading', 'body'] as const;
export type FontRole = (typeof FONT_ROLES)[number];
export const VARIABLES = ['company', 'slogan', 'phone', 'email', 'website', 'address'] as const;
export type Variable = (typeof VARIABLES)[number];

export interface BrandKit {
  profile: Partial<Record<Variable, string>>;
  colors: Partial<Record<ColorRole, string>>;
  fonts: Partial<Record<FontRole, string>>;
  /** URL servida pelo asset loader, ou ausente. */
  logoUrl?: string;
}

const TEXT_TYPES = new Set(['Text', 'IText', 'Textbox', 'text', 'i-text', 'textbox']);
const IMAGE_TYPES = new Set(['Image', 'image']);
const VAR_RE = /\{\{\s*([a-z]+)\s*\}\}/g;

/** Texto de exemplo para variável sem valor no perfil (ARQUITETURA §23). */
export const SAMPLE_PROFILE: Record<Variable, string> = {
  company: 'Sua empresa',
  slogan: 'Seu slogan aqui',
  phone: '(00) 0000-0000',
  email: 'contato@suaempresa.com.br',
  website: 'www.suaempresa.com.br',
  address: 'Rua Exemplo, 123 - Cidade',
};

function isVariable(x: string): x is Variable {
  return (VARIABLES as readonly string[]).includes(x);
}

/** Preenche e diz se algum exemplo entrou no lugar de um valor vazio. */
function fill(text: string, profile: BrandKit['profile']): { text: string; sampled: boolean } {
  let sampled = false;
  const out = text.replace(VAR_RE, (whole, name: string) => {
    if (!isVariable(name)) return whole;
    const value = profile[name];
    if (value && value.trim()) return value;
    sampled = true;
    return SAMPLE_PROFILE[name];
  });
  return { text: out, sampled };
}

/** Troca {{variável}} pelo valor do perfil; variável vazia vira o exemplo; desconhecida fica como está. */
export function fillVariables(text: string, profile: BrandKit['profile']): string {
  return fill(text, profile).text;
}

/** Guardado no objeto de texto quando um exemplo entrou: o texto original e o que foi gerado dele. */
interface BrandSample {
  source: string;
  text: string;
}

function isBrandSample(x: unknown): x is BrandSample {
  return typeof x === 'object' && x !== null &&
    typeof (x as BrandSample).source === 'string' && typeof (x as BrandSample).text === 'string';
}

export function hasVariables(text: string): boolean {
  VAR_RE.lastIndex = 0;
  return VAR_RE.test(text);
}

function isColorRole(x: unknown): x is ColorRole {
  return typeof x === 'string' && (COLOR_ROLES as readonly string[]).includes(x);
}
function isFontRole(x: unknown): x is FontRole {
  return typeof x === 'string' && (FONT_ROLES as readonly string[]).includes(x);
}

export interface ApplyOptions {
  /** false = só cores/fontes/logo (reaplicar o kit num design já editado não reescreve textos). */
  variables?: boolean;
}

/**
 * Aplica o kit sobre uma cópia do documento: brandColor → fill, brandStroke → stroke,
 * brandFont → fontFamily, brandLogo → src, variáveis no texto, e o fundo do canvas quando
 * fabric.brandBackground indica um papel. Papéis sem valor no kit não mudam nada.
 */
export function applyBrandKit(doc: EditorDocument, kit: BrandKit, options: ApplyOptions = {}): EditorDocument {
  const variables = options.variables ?? true;
  const out: EditorDocument = structuredClone(doc);
  walkObjects(out.fabric.objects, (o) => {
    if (isColorRole(o.brandColor) && kit.colors[o.brandColor]) o.fill = kit.colors[o.brandColor];
    if (isColorRole(o.brandStroke) && kit.colors[o.brandStroke]) o.stroke = kit.colors[o.brandStroke];
    if (typeof o.type === 'string' && TEXT_TYPES.has(o.type)) {
      if (isFontRole(o.brandFont) && kit.fonts[o.brandFont]) o.fontFamily = kit.fonts[o.brandFont];
      if (variables && typeof o.text === 'string') {
        // texto com exemplo que o usuário não editou: volta ao original com {{…}} para preencher de novo
        const sample = o.brandSample;
        const source = isBrandSample(sample) && sample.text === o.text ? sample.source : o.text;
        const filled = fill(source, kit.profile);
        if (filled.sampled) o.brandSample = { source, text: filled.text } satisfies BrandSample;
        else delete o.brandSample;
        if (filled.text !== o.text) {
          o.text = filled.text;
          // os estilos por caractere são indexados pela posição: com o texto mudado, não valem mais
          o.styles = [];
        }
      }
    }
    if (o.brandLogo === true && kit.logoUrl && typeof o.type === 'string' && IMAGE_TYPES.has(o.type)) {
      o.src = kit.logoUrl;
    }
  });
  const bg = out.fabric.brandBackground;
  if (isColorRole(bg) && kit.colors[bg]) out.fabric.background = kit.colors[bg];
  return out;
}

/** Normaliza o que veio do Kotlin (campos desconhecidos e não-string são descartados). */
export function parseBrandKit(input: unknown): BrandKit {
  const kit: BrandKit = { profile: {}, colors: {}, fonts: {} };
  if (typeof input !== 'object' || input === null) return kit;
  const src = input as Record<string, unknown>;
  const pick = <K extends string>(from: unknown, keys: readonly K[], to: Partial<Record<K, string>>) => {
    if (typeof from !== 'object' || from === null) return;
    for (const k of keys) {
      const v = (from as Record<string, unknown>)[k];
      if (typeof v === 'string' && v.length > 0) to[k] = v;
    }
  };
  pick(src.profile, VARIABLES, kit.profile);
  pick(src.colors, COLOR_ROLES, kit.colors);
  pick(src.fonts, FONT_ROLES, kit.fonts);
  if (typeof src.logoUrl === 'string' && src.logoUrl.length > 0) kit.logoUrl = src.logoUrl;
  return kit;
}
