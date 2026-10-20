// Texto com IA (ARQUITETURA §18.5): montagem dos pedidos ai.rewriteText / ai.generateCopy e leitura
// das respostas. Sem Fabric, para o vitest.

export type RewriteStyle = 'rewrite' | 'shorter' | 'persuasive' | 'formal' | 'fun' | 'fix';

/** Mesma ordem e ids de TextPrompts.STYLES (Kotlin). */
export const REWRITE_STYLES: [RewriteStyle, string][] = [
  ['rewrite', 'Outras palavras'],
  ['shorter', 'Mais curto'],
  ['persuasive', 'Mais persuasivo'],
  ['formal', 'Mais formal'],
  ['fun', 'Mais descontraído'],
  ['fix', 'Corrigir'],
];

export const MAX_INPUT = 2000;

export interface RewritePayload { text: string; style: RewriteStyle; count: number }
export interface CopyResult { title: string; subtitle: string; cta: string; servedBy?: string }

export class AiTextError extends Error {}

export function rewritePayload(text: string, style: RewriteStyle, count = 3): RewritePayload {
  const t = text.trim();
  if (!t) throw new AiTextError('O texto está vazio');
  if (t.length > MAX_INPUT) throw new AiTextError(`Texto longo demais (máx. ${MAX_INPUT} caracteres)`);
  return { text: t, style, count: style === 'fix' ? 1 : count };
}

/** Variantes não vazias, sem repetição e diferentes do original (salvo "Corrigir", que pode não mudar nada). */
export function parseVariants(result: unknown, original: string, style: RewriteStyle): string[] {
  const list = (result as { variants?: unknown } | null)?.variants;
  if (!Array.isArray(list)) throw new AiTextError('Resposta sem variantes');
  const seen = new Set<string>();
  const out: string[] = [];
  for (const v of list) {
    if (typeof v !== 'string') continue;
    const s = v.trim();
    if (!s || seen.has(s) || (style !== 'fix' && s === original.trim())) continue;
    seen.add(s);
    out.push(s);
  }
  return out;
}

export function parseCopy(result: unknown): CopyResult {
  const r = (result ?? {}) as Record<string, unknown>;
  const get = (k: string) => {
    const v = r[k];
    if (typeof v !== 'string' || !v.trim()) throw new AiTextError(`Resposta sem "${k}"`);
    return v.trim();
  };
  return { title: get('title'), subtitle: get('subtitle'), cta: get('cta'), servedBy: typeof r.servedBy === 'string' ? r.servedBy : undefined };
}
