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
