/** Geometria de uma FabricImage que importa ao trocar a fonte (ARQUITETURA §20.4 item 7, §20.7). */
export interface ImageGeometry {
  width: number;
  height: number;
  scaleX: number;
  scaleY: number;
  cropX: number;
  cropY: number;
}

/**
 * Geometria depois de trocar a fonte por outra fx × fy vezes maior (tamanho natural novo / antigo): o mesmo recorte e o
 * mesmo tamanho na tela. `setSrc` do Fabric põe width/height = tamanho natural novo e mantém escala e crop, o que dobraria
 * a imagem num upscale ×2 e desfaria o recorte de uma imagem recortada.
 */
export function rescaledGeometry(g: ImageGeometry, fx: number, fy: number): ImageGeometry {
  return {
    width: g.width * fx,
    height: g.height * fy,
    scaleX: g.scaleX / fx,
    scaleY: g.scaleY / fy,
    cropX: g.cropX * fx,
    cropY: g.cropY * fy,
  };
}

export type FitMode = 'contain' | 'cover';

/**
 * Encaixe de uma imagem nova (nw × nh naturais) no espaço ocupado pela anterior (slotW × slotH na página):
 * `contain` mostra a imagem inteira dentro do espaço; `cover` preenche o espaço exato, recortando o excesso no centro.
 */
export function fitSlot(slotW: number, slotH: number, nw: number, nh: number, mode: FitMode): ImageGeometry {
  if (mode === 'contain') {
    const s = Math.min(slotW / nw, slotH / nh);
    return { width: nw, height: nh, scaleX: s, scaleY: s, cropX: 0, cropY: 0 };
  }
  const s = Math.max(slotW / nw, slotH / nh);
  const width = Math.min(nw, slotW / s);
  const height = Math.min(nh, slotH / s);
  return { width, height, scaleX: s, scaleY: s, cropX: (nw - width) / 2, cropY: (nh - height) / 2 };
}

/** Parte visível de uma imagem, normalizada 0..1 sobre o tamanho natural (x0,y0 = canto superior esquerdo). */
export type ImageRegion = { x0: number; y0: number; x1: number; y1: number };
export const FULL_REGION: ImageRegion = { x0: 0, y0: 0, x1: 1, y1: 1 };

/**
 * Região visível (recorte `cropX/cropY/width/height`) de uma imagem de tamanho natural nw × nh. Os filtros que dependem
 * da posição do pixel (vinheta, borda suave, foco) agem sobre ela, porque o Fabric filtra a imagem natural inteira e o
 * recorte só entra no desenho [[task-17-vinheta-borda-suave-e-desfoque-de-foco]].
 */
export function visibleRegion(g: Pick<ImageGeometry, 'width' | 'height' | 'cropX' | 'cropY'>, nw: number, nh: number): ImageRegion {
  if (!(nw > 0 && nh > 0)) return { ...FULL_REGION };
  const c = (v: number) => Math.min(1, Math.max(0, Number.isFinite(v) ? v : 0));
  const x0 = c((g.cropX || 0) / nw), y0 = c((g.cropY || 0) / nh);
  const x1 = c(((g.cropX || 0) + g.width) / nw), y1 = c(((g.cropY || 0) + g.height) / nh);
  return x1 > x0 && y1 > y0 ? { x0, y0, x1, y1 } : { ...FULL_REGION };
}
