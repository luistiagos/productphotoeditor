// Texto preenchido com foto (TASK-15). O preenchimento é um `Pattern` do Fabric com a foto (URL `/blob/…`) e um
// `patternTransform` que a enquadra em *cover* na caixa local do texto. O Fabric já serializa e revive o `Pattern` pelo
// `fill`; a marca `textImageFill` (customProperties) diz que o padrão é do usuário, guarda a cor sólida de antes
// ("Remover foto") e faz o `refreshGradient` refazer o cover quando a caixa muda.
// Sem import de runtime do Fabric: as classes chegam por parâmetro (o editor usa `fabric`, o vitest `fabric/node`).

export type Mat2D = [number, number, number, number, number, number];

/** Marca gravada no objeto. Sem campo `type` (o revive do Fabric transformaria o objeto numa classe registrada). */
export interface TextImageFill {
  /** URL da foto (a mesma do `source` do Pattern). */
  src: string;
  /** Cor sólida que volta com "Remover foto". */
  fallback: string;
}

export function isTextImageFill(v: unknown): v is TextImageFill {
  return !!v && typeof v === 'object' && typeof (v as TextImageFill).src === 'string' && typeof (v as TextImageFill).fallback === 'string'
    && !('type' in v);
}

/**
 * `object-fit: cover` da foto `imgW × imgH` na caixa `boxW × boxH`, em pixels da caixa com origem no canto superior
 * esquerdo (o referencial do `patternTransform` no texto: `Text.handleFiller` → `_applyPatternGradientTransform`).
 * Escala = a maior das razões; a foto fica centrada e o excesso sai pelos dois lados do eixo que sobra.
 */
export function coverPatternTransform(imgW: number, imgH: number, boxW: number, boxH: number): Mat2D {
  const iw = Math.max(1, imgW), ih = Math.max(1, imgH);
  const s = Math.max(boxW / iw, boxH / ih);
  return [s, 0, 0, s, (boxW - iw * s) / 2, (boxH - ih * s) / 2];
}

interface PatternLike {
  source?: unknown;
  repeat?: string;
  patternTransform?: Mat2D | number[] | null;
}

/** Tamanho natural da fonte do padrão (`<img>` carregado ou canvas); `null` se ainda não há pixels. */
export function patternSourceSize(p: PatternLike | null | undefined): { width: number; height: number } | null {
  const s = p?.source as { naturalWidth?: number; naturalHeight?: number; width?: number; height?: number } | undefined;
  if (!s) return null;
  const width = s.naturalWidth || s.width || 0, height = s.naturalHeight || s.height || 0;
  return width > 0 && height > 0 ? { width, height } : null;
}

interface FilledBox {
  width: number;
  height: number;
  fill?: unknown;
  dirty?: boolean;
}

/**
 * Refaz o cover do padrão quando a caixa do texto muda (digitar, alça lateral, fonte, tamanho). Muda o `Pattern` no
 * lugar e marca o objeto `dirty` (o cache do Fabric não vê a mudança dentro do `fill`). `false` se não há o que refazer.
 */
export function refitTextImageFill(o: FilledBox): boolean {
  const p = o.fill as PatternLike | undefined;
  const size = patternSourceSize(p);
  if (!p || !size) return false;
  p.patternTransform = coverPatternTransform(size.width, size.height, Math.max(1, o.width), Math.max(1, o.height));
  o.dirty = true;
  return true;
}

function escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&apos;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

const num = (v: number): number => Math.round(v * 10000) / 10000;

interface PatternProto extends PatternLike {
  id: number | string;
  sourceToString(): string;
  toSVG(size: { width: number; height: number }): string;
}

let patternSvgInstalled = false;

/**
 * `Pattern.toSVG` do Fabric 7.4 ignora o `patternTransform` (pattern em fração da bbox dos glifos, foto no tamanho
 * natural): o SVG mostraria outro recorte da foto. Com `patternTransform` e `no-repeat`, emite um `<pattern>` em
 * `userSpaceOnUse` cobrindo a caixa do objeto no referencial centrado do SVG (`-w/2, -h/2`, o mesmo do `<text>`) e a
 * foto com a mesma matriz do canvas. Os outros padrões seguem o `toSVG` original.
 */
export function installPatternSvg(PatternClass: { prototype: object }): void {
  if (patternSvgInstalled) return;
  patternSvgInstalled = true;
  const proto = PatternClass.prototype as PatternProto;
  const origToSVG = proto.toSVG;
  proto.toSVG = function (this: PatternProto, size: { width: number; height: number }): string {
    const t = this.patternTransform;
    const dims = patternSourceSize(this);
    if (!t || t.length !== 6 || this.repeat !== 'no-repeat' || !dims) return origToSVG.call(this, size);
    const w = Math.max(1, size.width), h = Math.max(1, size.height);
    return [
      `<pattern id="SVGID_${escapeXml(String(this.id))}" patternUnits="userSpaceOnUse" x="${num(-w / 2)}" y="${num(-h / 2)}" `
        + `width="${num(w)}" height="${num(h)}">`,
      `<image x="0" y="0" width="${dims.width}" height="${dims.height}" transform="matrix(${t.map(num).join(' ')})" `
        + `xlink:href="${escapeXml(this.sourceToString())}"></image>`,
      '</pattern>',
      '',
    ].join('\n');
  };
}
