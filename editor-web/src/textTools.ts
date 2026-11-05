// Listas de benefícios e localizar/substituir no anúncio (TASK-14) — funções puras, sem DOM nem Fabric.

export type ListStyle = 'none' | 'bullet' | 'check' | 'fire' | 'star' | 'numbered';

/** Marcador que cada estilo põe no começo da linha (o numerado é `1.`, `2.`…). */
export const LIST_MARKERS: Record<'bullet' | 'check' | 'fire' | 'star', string> = {
  bullet: '•', check: '✓', fire: '🔥', star: '⭐',
};

/** Opções do seletor "☰ Lista" (valor, rótulo). */
export const LIST_OPTIONS: [ListStyle, string][] = [
  ['bullet', '• Marcadores'],
  ['check', '✓ Checklist'],
  ['fire', '🔥 Destaques'],
  ['star', '⭐ Estrelas'],
  ['numbered', '1. Numerada'],
  ['none', 'Sem marcador'],
];

// Marcador no começo da linha: os nossos, variantes comuns (✔ ✅ ★) e os digitados à mão (- * – ◦ ▪, "1." "2)").
// Sempre seguido de espaço (ou fim da linha): "-10%" e "10.5 kg" não são marcadores.
const MARKER_RE = /^([ \t ]*)(•|✓|✔|✅|🔥|⭐|★|[-*–◦▪]|\d{1,3}[.)])️?(?:[ \t ]+|$)/u;

const STYLE_OF_MARKER: Record<string, ListStyle> = {
  '•': 'bullet', '✓': 'check', '✔': 'check', '✅': 'check', '🔥': 'fire', '⭐': 'star', '★': 'star',
};

type LineKind = ListStyle | 'other';

/** Separa a linha em recuo, marcador reconhecido (ou null) e corpo. */
function splitLine(line: string): { indent: string; marker: string | null; body: string } {
  const m = MARKER_RE.exec(line);
  if (!m) {
    const indent = /^[ \t ]*/.exec(line)![0];
    return { indent, marker: null, body: line.slice(indent.length) };
  }
  return { indent: m[1], marker: m[2], body: line.slice(m[0].length) };
}

function lineKind(line: string): LineKind {
  const { marker } = splitLine(line);
  if (marker === null) return 'none';
  if (/^\d/.test(marker)) return 'numbered';
  return STYLE_OF_MARKER[marker] ?? 'other';
}

function lines(text: string): string[] {
  return text.split(/\r?\n/);
}

/** Tira o marcador de lista do começo da linha (mantém o recuo). */
export function stripListPrefix(line: string): string {
  const { indent, body } = splitLine(line);
  return indent + body;
}

/**
 * Estilo de lista do texto: o estilo comum a todas as linhas não vazias, `'none'` se nenhuma tem marcador e
 * `'mixed'` se há marcadores diferentes (ou digitados à mão, como `- `).
 */
export function detectListStyle(text: string): ListStyle | 'mixed' {
  const kinds = new Set(lines(text).filter((l) => l.trim()).map(lineKind));
  if (kinds.size === 0) return 'none';
  if (kinds.size > 1) return 'mixed';
  const [k] = kinds;
  return k === 'other' ? 'mixed' : k;
}

/**
 * Aplica o estilo em cada linha não vazia, trocando qualquer marcador existente (nunca duplica). Linhas vazias ficam
 * como estão e não contam na numeração; o recuo da linha é preservado.
 */
export function formatTextList(text: string, style: ListStyle): string {
  let n = 0;
  return lines(text).map((line) => {
    if (!line.trim()) return line;
    const { indent, body } = splitLine(line);
    if (style === 'none') return indent + body;
    const marker = style === 'numbered' ? `${++n}.` : LIST_MARKERS[style];
    return `${indent}${marker} ${body}`;
  }).join('\n');
}

/** "☰ Lista": se todas as linhas já têm o estilo escolhido, volta ao texto limpo; senão aplica (substituindo outro). */
export function toggleListStyle(text: string, style: ListStyle): string {
  if (style !== 'none' && detectListStyle(text) === style) return formatTextList(text, 'none');
  return formatTextList(text, style);
}

// ---------- localizar e substituir ----------

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function matcher(find: string, matchCase: boolean): RegExp | null {
  if (!find) return null;
  return new RegExp(escapeRegExp(find), matchCase ? 'gu' : 'giu');
}

/** Quantas vezes `find` aparece em `text` (literal; sem diferenciar maiúsculas, salvo `matchCase`). */
export function countMatches(text: string, find: string, matchCase = false): number {
  const re = matcher(find, matchCase);
  return re ? (text.match(re) ?? []).length : 0;
}

/** Troca todas as ocorrências (literal: `$` em "R$ 149,90" não é padrão de substituição). */
export function findAndReplaceInText(text: string, find: string, replace: string, matchCase = false): { text: string; count: number } {
  const re = matcher(find, matchCase);
  if (!re) return { text, count: 0 };
  let count = 0;
  const out = text.replace(re, () => { count++; return replace; });
  return { text: out, count };
}

/** Trecho em volta da 1ª ocorrência, numa linha só (para a lista de resultados). */
export function matchSnippet(text: string, find: string, matchCase = false, radius = 16): string {
  const re = matcher(find, matchCase);
  const m = re?.exec(text);
  const flat = (s: string) => s.replace(/\s+/g, ' ');
  if (!m) return flat(text).slice(0, radius * 2);
  const a = Math.max(0, m.index - radius);
  const b = Math.min(text.length, m.index + m[0].length + radius);
  return `${a > 0 ? '…' : ''}${flat(text.slice(a, b))}${b < text.length ? '…' : ''}`;
}

interface MaybeText { text?: unknown; getObjects?: () => unknown[] }

/** Todos os objetos de texto, inclusive dentro de grupos (por forma, não por classe: serve ao `fabric` e ao `fabric/node`). */
export function collectTextLayers<T extends object>(objects: readonly T[]): T[] {
  const out: T[] = [];
  const walk = (list: readonly unknown[]) => {
    for (const o of list) {
      const x = o as MaybeText;
      if (typeof x.text === 'string') out.push(o as T);
      else if (typeof x.getObjects === 'function') walk(x.getObjects());
    }
  };
  walk(objects);
  return out;
}

/** Total de ocorrências e em quantas camadas de texto. */
export function summarizeMatches(layers: readonly { text: string }[], find: string, matchCase = false): { matches: number; layers: number } {
  let matches = 0;
  let count = 0;
  for (const l of layers) {
    const c = countMatches(l.text, find, matchCase);
    if (c > 0) { matches += c; count++; }
  }
  return { matches, layers: count };
}
