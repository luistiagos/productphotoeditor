/**
 * 🖌️ Retocar recorte (TASK-18): pincel de borda suave que apaga sobras do fundo (alfa → 0) ou restaura pixels da foto
 * original (antes do "✨ Remover fundo"). Funções puras sobre RGBA não pré-multiplicado (o `ImageData` do canvas 2D):
 * o editor lê só a janela do traço, aplica e devolve com `putImageData`.
 *
 * O traço inteiro vira uma cobertura (o MÁXIMO dos carimbos em cada pixel) aplicada uma vez: carimbos sobrepostos não
 * acumulam, então a borda suave tem a mesma largura com qualquer espaçamento.
 */

export type RefineMode = 'erase' | 'restore';

export interface RefinePoint { x: number; y: number }

/** Janela (px inteiros da imagem) que o traço toca, já dentro da imagem. */
export interface RefineBox { x: number; y: number; w: number; h: number }

/** Tamanho do pincel (diâmetro, px da página) e suavidade (%) da barra. */
export const REFINE_SIZE = { min: 5, max: 120, initial: 40 } as const;
export const REFINE_FEATHER = { min: 0, max: 100, initial: 50 } as const;

const clamp01 = (v: number): number => (v <= 0 ? 0 : v >= 1 ? 1 : v);

/**
 * Força do carimbo (0..1) à distância `d` do centro, raio `r`, suavidade `feather` (0..1): 1 até `r·(1−feather)`,
 * depois cai em smoothstep até 0 em `r`. `feather = 0` é um degrau na borda.
 */
export function featherAlpha(d: number, r: number, feather: number): number {
  if (!(r > 0) || d >= r) return 0;
  const inner = r * (1 - clamp01(feather));
  if (d <= inner) return 1;
  const t = (d - inner) / (r - inner);
  return 1 - t * t * (3 - 2 * t);
}

/** Pontos dos carimbos ao longo da linha dos pontos do traço, a cada `spacing` px; inclui o primeiro e o último. */
export function strokeStamps(points: readonly RefinePoint[], spacing: number): RefinePoint[] {
  if (points.length === 0) return [];
  const step = Math.max(0.5, spacing);
  const out: RefinePoint[] = [{ x: points[0].x, y: points[0].y }];
  let carry = 0; // distância andada desde o último carimbo
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    if (len === 0) continue;
    let t = step - carry;
    while (t <= len) {
      out.push({ x: a.x + ((b.x - a.x) * t) / len, y: a.y + ((b.y - a.y) * t) / len });
      t += step;
    }
    carry = len - (t - step);
  }
  const last = points[points.length - 1];
  const tail = out[out.length - 1];
  if (tail.x !== last.x || tail.y !== last.y) out.push({ x: last.x, y: last.y });
  return out;
}

/** Janela dos carimbos de raio `r` recortada na imagem `width × height`; null se o traço cai todo fora. */
export function strokeBounds(stamps: readonly RefinePoint[], r: number, width: number, height: number): RefineBox | null {
  if (stamps.length === 0 || !(r > 0)) return null;
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const p of stamps) {
    x0 = Math.min(x0, p.x - r);
    y0 = Math.min(y0, p.y - r);
    x1 = Math.max(x1, p.x + r);
    y1 = Math.max(y1, p.y + r);
  }
  const x = Math.max(0, Math.floor(x0));
  const y = Math.max(0, Math.floor(y0));
  const xe = Math.min(width, Math.ceil(x1));
  const ye = Math.min(height, Math.ceil(y1));
  return xe > x && ye > y ? { x, y, w: xe - x, h: ye - y } : null;
}

/** Cobertura (0..1) de cada pixel da janela: o máximo dos carimbos (medido no centro do pixel). */
export function strokeCoverage(box: RefineBox, stamps: readonly RefinePoint[], r: number, feather: number): Float32Array {
  const cov = new Float32Array(box.w * box.h);
  for (const p of stamps) {
    const px0 = Math.max(box.x, Math.floor(p.x - r));
    const py0 = Math.max(box.y, Math.floor(p.y - r));
    const px1 = Math.min(box.x + box.w, Math.ceil(p.x + r));
    const py1 = Math.min(box.y + box.h, Math.ceil(p.y + r));
    for (let y = py0; y < py1; y++) {
      const dy = y + 0.5 - p.y;
      const row = (y - box.y) * box.w - box.x;
      for (let x = px0; x < px1; x++) {
        const s = featherAlpha(Math.hypot(x + 0.5 - p.x, dy), r, feather);
        if (s > cov[row + x]) cov[row + x] = s;
      }
    }
  }
  return cov;
}

/**
 * Aplica a cobertura `cov` à janela `work` (RGBA da janela, alterado no lugar). `erase`: α ← α·(1−s), cor intacta.
 * `restore`: mistura com `orig` (RGBA da MESMA janela da foto original, já no tamanho da imagem) pesada por alfa — com
 * s = 1 o pixel vira exatamente o original, inclusive onde o recorte deixou α = 0 com RGB 0.
 */
export function applyCoverage(work: Uint8ClampedArray, orig: Uint8ClampedArray | null, cov: Float32Array, mode: RefineMode): void {
  if (mode === 'restore' && !orig) return;
  for (let i = 0, k = 0; k < cov.length; k++, i += 4) {
    const s = cov[k];
    if (s <= 0) continue;
    const a = work[i + 3];
    if (mode === 'erase') {
      work[i + 3] = a * (1 - s);
      continue;
    }
    const o = orig!;
    const ao = o[i + 3];
    const na = a + (ao - a) * s;
    if (na <= 0) {
      work[i] = o[i]; work[i + 1] = o[i + 1]; work[i + 2] = o[i + 2]; work[i + 3] = 0;
      continue;
    }
    const wa = a * (1 - s);
    const wo = ao * s;
    work[i] = (work[i] * wa + o[i] * wo) / na;
    work[i + 1] = (work[i + 1] * wa + o[i + 1] * wo) / na;
    work[i + 2] = (work[i + 2] * wa + o[i + 2] * wo) / na;
    work[i + 3] = na;
  }
}

/**
 * Um traço inteiro sobre a imagem `width × height`: carimbos a cada r/4 ao longo de `points` (px da imagem), janela,
 * cobertura e mistura. `read(box)` devolve o RGBA da janela do recorte (alterado no lugar e devolvido no retorno) e
 * `readOrig(box)` o da original (só no `restore`). Devolve a janela tocada, ou null se nada mudou.
 */
export function applyStroke(
  points: readonly RefinePoint[], r: number, feather: number, mode: RefineMode, width: number, height: number,
  read: (box: RefineBox) => Uint8ClampedArray, readOrig: ((box: RefineBox) => Uint8ClampedArray) | null,
): { box: RefineBox; data: Uint8ClampedArray } | null {
  if (mode === 'restore' && !readOrig) return null;
  const stamps = strokeStamps(points, Math.max(1, r / 4));
  const box = strokeBounds(stamps, r, width, height);
  if (!box) return null;
  const data = read(box);
  applyCoverage(data, mode === 'restore' ? readOrig!(box) : null, strokeCoverage(box, stamps, r, feather), mode);
  return { box, data };
}
