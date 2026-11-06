// ⚡ Data Merge (TASK-10): um anúncio-modelo + uma lista de produtos → uma página por produto.
// Puro sobre o JSON do Fabric (o editor põe as páginas no documento). Só tipos do Fabric aqui: o texto é medido por um
// objeto vivo que quem chama revive (`enliven`) — no app, o `fabric` do navegador; no teste, o `fabric/node`.
import { type FabricJson, walkObjects } from './document';
import { fitSlot, visibleRegion } from './imageGeometry';
import { clipPathJson, frameSpecOf, framedGeometry } from './clipFrames';

/** Campos do lote, na ordem em que aparecem na folha e na tabela. `foto` só vale em imagem. */
export const MERGE_FIELDS = ['produto', 'preco_de', 'preco_por', 'desconto', 'parcelas', 'codigo', 'foto'] as const;
export type MergeField = (typeof MERGE_FIELDS)[number];
export type TextMergeField = Exclude<MergeField, 'foto'>;
export const TEXT_MERGE_FIELDS = MERGE_FIELDS.filter((f): f is TextMergeField => f !== 'foto');

export const MERGE_FIELD_LABELS: Record<MergeField, string> = {
  produto: 'Nome do produto',
  preco_de: 'Preço antigo (De)',
  preco_por: 'Preço oferta (Por)',
  desconto: 'Desconto (%)',
  parcelas: 'Parcelas',
  codigo: 'Código',
  foto: 'Foto do produto',
};

/** Linhas lidas de uma colagem; o resto é descartado (com aviso). */
export const MAX_CATALOG_ROWS = 50;
/** Piso do auto-ajuste: o nome nunca fica menor que 65% da fonte do modelo. */
export const MIN_FONT_RATIO = 0.65;

export interface PhotoRef { url: string; width: number; height: number }
/** Uma linha do catálogo: os textos como o usuário digitou e, se escolhida, a foto (já no BlobStore). */
export type CatalogRow = Partial<Record<TextMergeField, string>> & { photo?: PhotoRef };
export interface CatalogParse { rows: CatalogRow[]; dropped: number }

/** Texto vivo do Fabric (Textbox/IText/Text) com o mínimo que o auto-ajuste usa. */
export interface LiveText {
  type: string;
  fontSize: number;
  width: number;
  height: number;
  set(props: Record<string, unknown>): unknown;
  initDimensions(): void;
}

// sublinhado incluso (`preco_de`); o `VAR_RE` do brand kit é `[a-z]+` e não casa estes, nem estes casam os dele por
// acaso: um nome fora de MERGE_FIELDS (ex.: {{company}}) fica intacto para o kit
const FIELD_RE = /\{\{\s*([a-z_]+)\s*\}\}/g;
const TEXT_TYPES = new Set(['Text', 'IText', 'Textbox', 'text', 'i-text', 'textbox']);
const IMAGE_TYPES = new Set(['Image', 'image']);

export const isMergeField = (v: unknown): v is MergeField => typeof v === 'string' && (MERGE_FIELDS as readonly string[]).includes(v);
export const isTextMergeField = (v: unknown): v is TextMergeField => isMergeField(v) && v !== 'foto';
const isTextJson = (o: Record<string, unknown>) => typeof o.type === 'string' && TEXT_TYPES.has(o.type) && typeof o.text === 'string';
const isImageJson = (o: Record<string, unknown>) => typeof o.type === 'string' && IMAGE_TYPES.has(o.type);
const cloneJson = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;
const num = (v: unknown, d = 0): number => (typeof v === 'number' && Number.isFinite(v) ? v : d);

/** Campos que o modelo usa: camadas marcadas (`mergeField`) e `{{campo}}` dentro de textos, inclusive em grupos. */
export function detectTemplateFields(fabric: FabricJson): MergeField[] {
  const found = new Set<MergeField>();
  walkObjects(fabric.objects, (o) => {
    if (isTextJson(o)) {
      if (isTextMergeField(o.mergeField)) found.add(o.mergeField);
      for (const m of String(o.text).matchAll(FIELD_RE)) if (isTextMergeField(m[1])) found.add(m[1]);
    } else if (isImageJson(o) && o.mergeField === 'foto') {
      found.add('foto');
    }
  });
  return MERGE_FIELDS.filter((f) => found.has(f));
}

/** Troca os `{{campo}}` do lote pelo valor da linha (campo sem valor = vazio); outros `{{…}}` ficam. */
export function mergeText(text: string, row: CatalogRow): string {
  return text.replace(FIELD_RE, (whole, name: string) => (isTextMergeField(name) ? (row[name] ?? '').trim() : whole));
}

// ---------- preços ----------

/** "R$ 1.299,90" → 1299.9; "189,90" → 189.9; "1.299" → 1299; "12.5" → 12.5. Sem número → undefined. */
export function parsePriceBR(raw: string | undefined): number | undefined {
  if (!raw) return undefined;
  const m = /-?\d[\d.,]*/.exec(raw.replace(/\s+/g, ''));
  if (!m) return undefined;
  let t = m[0].replace(/[.,]$/, '');
  if (t.includes(',')) t = t.replace(/\./g, '').replace(',', '.');
  else if (/^-?\d{1,3}(\.\d{3})+$/.test(t)) t = t.replace(/\./g, '');
  const n = Number(t);
  return Number.isFinite(n) ? n : undefined;
}

/** `De R$ 100 por R$ 70` → "-30%". Só quando de > por > 0 e o desconto arredondado for ao menos 1%. */
export function discountLabel(de: string | undefined, por: string | undefined): string | undefined {
  const a = parsePriceBR(de), b = parsePriceBR(por);
  if (a === undefined || b === undefined || !(a > b && b > 0)) return undefined;
  const pct = Math.round(((a - b) / a) * 100);
  return pct >= 1 ? `-${pct}%` : undefined;
}

/** A linha com o desconto calculado, se ela não trouxe um. */
export function withDiscount(row: CatalogRow): CatalogRow {
  if (row.desconto?.trim()) return row;
  const d = discountLabel(row.preco_de, row.preco_por);
  return d ? { ...row, desconto: d } : row;
}

// ---------- parser da colagem (WhatsApp, Excel, CSV) ----------

const ALIASES: [TextMergeField, string[]][] = [
  ['produto', ['produto', 'produtos', 'nome', 'nome do produto', 'item', 'descricao', 'titulo']],
  ['preco_de', ['preco de', 'de', 'antes', 'preco antigo', 'preco normal', 'de r']],
  ['preco_por', ['preco por', 'por', 'preco', 'oferta', 'preco oferta', 'agora', 'preco promocional', 'por r']],
  ['desconto', ['desconto', 'off']],
  ['parcelas', ['parcelas', 'parcela', 'parcelamento']],
  ['codigo', ['codigo', 'cod', 'sku', 'ref', 'referencia']],
];

const normalize = (s: string): string => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  .replace(/[^a-z0-9]+/g, ' ').trim();

function headerField(cell: string): TextMergeField | undefined {
  const n = normalize(cell);
  return ALIASES.find(([, names]) => names.includes(n))?.[0];
}

/** CSV com vírgula só quando os campos vêm entre aspas ("Tênis","R$ 10,00"): a vírgula solta é o decimal do preço. */
function splitQuoted(line: string): string[] {
  const out: string[] = [];
  let cur = '', quoted = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (quoted && line[i + 1] === '"') { cur += '"'; i++; } else quoted = !quoted;
    } else if (c === ',' && !quoted) {
      out.push(cur); cur = '';
    } else cur += c;
  }
  out.push(cur);
  return out;
}

/** Separador por linha: TAB, senão `;`, senão `|`, senão CSV com aspas; sem nenhum, a linha é só o nome. */
function splitLine(line: string): string[] {
  const cells = line.includes('\t') ? line.split('\t')
    : line.includes(';') ? line.split(';')
      : line.includes('|') ? line.split('|')
        : /"\s*,|,\s*"/.test(line) ? splitQuoted(line)
          : [line];
  return cells.map((c) => c.trim().replace(/^"([\s\S]*)"$/, '$1').replace(/""/g, '"').trim());
}

const POSITIONAL: TextMergeField[] = ['produto', 'preco_de', 'preco_por', 'parcelas', 'codigo'];

/**
 * Lista colada → linhas do catálogo. Cabeçalho (1ª linha só com nomes de campo conhecidos, sem números) mapeia por nome;
 * sem ele, posicional `produto; preco_de; preco_por; parcelas; codigo` (2 colunas = `produto; preco_por`). Linhas vazias
 * são ignoradas; acima de 50, descartadas (`dropped`). O desconto é calculado quando a linha não traz um.
 */
export function parseCatalogText(raw: string): CatalogParse {
  const lines = raw.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0 && !/^[\t;|,"\s]*$/.test(l));
  if (lines.length === 0) return { rows: [], dropped: 0 };
  let columns: (TextMergeField | undefined)[] | null = null;
  const first = splitLine(lines[0]);
  const mapped = first.map(headerField);
  if (mapped.some(Boolean) && !first.some((c) => /\d/.test(c))) {
    columns = mapped;
    lines.shift();
  }
  const rows: CatalogRow[] = [];
  let dropped = 0;
  for (const line of lines) {
    const cells = splitLine(line);
    const cols = columns ?? (cells.length === 2 ? ['produto', 'preco_por'] as TextMergeField[] : POSITIONAL);
    const row: CatalogRow = {};
    cells.forEach((c, i) => {
      const f = cols[i];
      if (f && c) row[f] = c;
    });
    if (Object.keys(row).length === 0) continue;
    if (rows.length >= MAX_CATALOG_ROWS) { dropped++; continue; }
    rows.push(withDiscount(row));
  }
  return { rows, dropped };
}

// ---------- uma página por linha ----------

/** Textos do JSON na ordem do `walkObjects` (o clone tem a mesma árvore, então o índice casa modelo e cópia). */
function textObjects(fabric: FabricJson): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = [];
  walkObjects(fabric.objects, (o) => { if (isTextJson(o)) out.push(o); });
  return out;
}

/**
 * Foto nova no espaço da camada (`fitSlot` `cover`: preenche e recorta o centro). A caixa na página fica exatamente a do
 * espaço (largura natural recortada × escala = largura do espaço), então posição, origem, ângulo, espelho, máscara,
 * sombra e filtros ficam como estavam. Muda e devolve `o`.
 */
export function swapPhotoJson(o: Record<string, unknown>, photo: PhotoRef): Record<string, unknown> {
  const sx = num(o.scaleX, 1), sy = num(o.scaleY, 1);
  const slotW = num(o.width) * Math.abs(sx), slotH = num(o.height) * Math.abs(sy);
  if (!(slotW > 0 && slotH > 0 && photo.width > 0 && photo.height > 0)) return o;
  // foto emoldurada: o zoom/posição internos da moldura valem para a foto nova (zoom 1 no centro = o mesmo cover)
  const frame = frameSpecOf(o);
  const g = frame
    ? framedGeometry(slotW, slotH, photo.width, photo.height, frame.scale, frame.offsetX, frame.offsetY)
    : fitSlot(slotW, slotH, photo.width, photo.height, 'cover');
  o.src = photo.url;
  // a foto do produto não é o recorte da foto do modelo: sem "➕ Restaurar original" dela (TASK-18)
  delete o.originalSrcBeforeCutout;
  o.width = g.width;
  o.height = g.height;
  o.cropX = g.cropX;
  o.cropY = g.cropY;
  o.scaleX = g.scaleX * Math.sign(sx || 1);
  o.scaleY = g.scaleY * Math.sign(sy || 1);
  // a caixa na página é a mesma, mas as unidades locais mudaram: o clipPath da moldura é regerado (TASK-06)
  if (frame) o.clipPath = clipPathJson(frame.kind, slotW, slotH, g.scaleX, g.scaleY);
  // vinheta, borda suave e foco agem na parte visível: seguem o recorte da foto nova [[task-17-vinheta-borda-suave-e-desfoque-de-foco]]
  if (Array.isArray(o.filters)) {
    const region = visibleRegion(g, photo.width, photo.height);
    for (const f of o.filters) if (f && typeof f === 'object' && 'x0' in f) Object.assign(f, region);
  }
  return o;
}

/**
 * Uma cópia do modelo com a linha aplicada: texto marcado (`mergeField`) vira o valor inteiro; `{{campo}}` dentro do texto
 * é trocado no lugar; a imagem marcada `foto` recebe a foto da linha. Texto mudado perde os estilos por caractere
 * (indexados pela posição, como no brand kit). O modelo não muda.
 */
export function applyMergeRow(fabric: FabricJson, row: CatalogRow): FabricJson {
  const out = cloneJson(fabric);
  walkObjects(out.objects, (o) => {
    if (isTextJson(o)) {
      const text = String(o.text);
      const next = isTextMergeField(o.mergeField) ? (row[o.mergeField] ?? '').trim() : mergeText(text, row);
      if (next !== text) {
        o.text = next;
        o.styles = [];
      }
    } else if (isImageJson(o) && o.mergeField === 'foto' && row.photo) {
      swapPhotoJson(o, row.photo);
    }
  });
  return out;
}

const isWrapping = (t: LiveText) => t.type.toLowerCase() === 'textbox';

/**
 * Reduz a fonte até o texto caber na caixa do modelo: Textbox (largura fixa, quebra linha) até a altura caber; IText/Text
 * (uma linha por parágrafo) até a largura caber. Passos de 2%, nunca abaixo de `minRatio` da fonte original — no piso,
 * para (o texto não é cortado). Devolve o `fontSize` final (o original se já cabia).
 */
export function shrinkTextToFit(t: LiveText, box: { width: number; height: number }, minRatio = MIN_FONT_RATIO): number {
  const wraps = isWrapping(t);
  const orig = t.fontSize;
  const min = orig * minRatio;
  const eps = 0.5;
  const apply = (fs: number) => {
    // o Textbox alarga sozinho para uma palavra que não cabe e não volta: a largura é a do modelo a cada passo
    t.set(wraps ? { fontSize: fs, width: box.width } : { fontSize: fs });
    t.initDimensions();
  };
  const fits = () => (wraps ? t.height <= box.height + eps && t.width <= box.width + eps : t.width <= box.width + eps);
  let fs = orig;
  if (wraps) apply(fs);
  while (!fits() && fs > min) {
    fs = Math.max(min, fs * 0.98);
    apply(fs);
  }
  return fs;
}

/**
 * Uma página (JSON do Fabric) por linha, a partir do modelo. Com `enliven`, cada texto que mudou é revivido e encolhido
 * para a caixa do mesmo texto no modelo (`shrinkTextToFit`); só o `fontSize` volta para o JSON.
 */
export async function generateMergedPages(model: FabricJson, rows: CatalogRow[], opts: {
  enliven?: (o: Record<string, unknown>) => Promise<LiveText>;
  minRatio?: number;
} = {}): Promise<FabricJson[]> {
  const modelTexts = textObjects(model);
  const out: FabricJson[] = [];
  for (const raw of rows) {
    const row = withDiscount(raw);
    const page = applyMergeRow(model, row);
    if (opts.enliven) {
      const texts = textObjects(page);
      for (let i = 0; i < texts.length; i++) {
        const before = modelTexts[i], after = texts[i];
        if (!before || after.text === before.text || !after.text) continue;
        const box = { width: num(before.width), height: num(before.height) };
        if (!(box.width > 0 && box.height > 0)) continue;
        const live = await opts.enliven(after);
        const fs = shrinkTextToFit(live, box, opts.minRatio ?? MIN_FONT_RATIO);
        if (fs !== num(after.fontSize)) after.fontSize = Math.round(fs * 100) / 100;
      }
    }
    out.push(page);
  }
  return out;
}

/** Nome da página gerada: o produto (até 40 caracteres) ou "Item N". */
export function mergedPageName(row: CatalogRow, index: number): string {
  const n = row.produto?.replace(/\s+/g, ' ').trim();
  return n ? n.slice(0, 40) : `Item ${index + 1}`;
}
