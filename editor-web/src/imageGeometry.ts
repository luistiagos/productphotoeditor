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
