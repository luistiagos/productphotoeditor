import { describe, expect, it } from 'vitest';
import { FabricImage, FabricObject, Path } from 'fabric/node';
import { CUSTOM_PROPERTIES, type FabricJson } from '../src/document';
import {
  applyFraming, buildClipPath, CLIP_SHAPE_KINDS, type ClipShapeKind, clipPathCommands, clipPathJson, currentFraming,
  drawFrameRim, frameBox, framedGeometry, frameProps, frameSpecOf, framingOf, installFrameRenderer, type PathClass, refreshFrame,
} from '../src/clipFrames';
import { rescaledGeometry } from '../src/imageGeometry';
import { applyMergeRow } from '../src/dataMerge';

// mesmo registro do editor.ts
FabricObject.customProperties = [...CUSTOM_PROPERTIES];
installFrameRenderer(FabricImage);
const P = Path as unknown as PathClass;
const SHAPES = CLIP_SHAPE_KINDS.filter((k): k is Exclude<ClipShapeKind, 'none'> => k !== 'none');

/**
 * "<img> carregado" com o tamanho natural: o vitest roda sem o `canvas` nativo (mesma limitação de textImageFill/
 * refineCutout); o pixel do aro é provado pelo E2E (task06).
 */
function photo(w: number, h: number, src = ''): HTMLImageElement {
  return { src, naturalWidth: w, naturalHeight: h, width: w, height: h, complete: true } as unknown as HTMLImageElement;
}

/** Foto 400×300 a 0,5 no centro (300, 200) da página. */
function framedImage(kind: Exclude<ClipShapeKind, 'none'> = 'circle'): FabricImage {
  const img = new FabricImage(photo(400, 300), { left: 300, top: 200, originX: 'center', originY: 'center', scaleX: 0.5, scaleY: 0.5 });
  img.set(frameProps({ kind, scale: 1, offsetX: 0, offsetY: 0, stroke: '#ff0000', strokeWidth: 12 }));
  refreshFrame(img, P);
  return img;
}

/** Caixa do clipPath em px da página: bbox do caminho × escala do clipPath × escala da imagem. */
function clipBoxOnPage(img: FabricImage): { w: number; h: number; cx: number; cy: number } {
  const c = img.clipPath as Path;
  return {
    w: c.width * Math.abs(c.scaleX) * Math.abs(img.scaleX),
    h: c.height * Math.abs(c.scaleY) * Math.abs(img.scaleY),
    // centro da forma no local da imagem: left/top − pathOffset·escala (0 quando a forma está centrada)
    cx: c.left - c.pathOffset.x * c.scaleX,
    cy: c.top - c.pathOffset.y * c.scaleY,
  };
}

describe('formas da moldura', () => {
  it.each(SHAPES)('%s: bbox do Path do Fabric = caixa e centrada', (kind) => {
    for (const [W, H] of [[300, 300], [400, 250], [180, 360]]) {
      const p = new Path(clipPathCommands(kind, W, H) as never);
      expect(p.width).toBeCloseTo(W, 3);
      expect(p.height).toBeCloseTo(H, 3);
      expect(p.pathOffset.x).toBeCloseTo(0, 3);
      expect(p.pathOffset.y).toBeCloseTo(0, 3);
    }
  });

  it('círculo e pílula tocam os extremos da caixa no meio dos lados', () => {
    const c = clipPathCommands('circle', 200, 100);
    const ends = c.filter((x) => x[0] === 'C').map((x) => [x[5], x[6]]);
    expect(ends).toEqual(expect.arrayContaining([[100, 0], [0, 50], [-100, 0], [0, -50]]));
    const pill = clipPathCommands('pill', 300, 100);
    // raio = metade do lado menor: as retas de cima vão de x = −100 a 100
    expect(pill[0]).toEqual(['M', -100, -50]);
    expect(pill[1]).toEqual(['L', 100, -50]);
  });

  it('cantos: 12% / 25% / 50% do lado menor; folha com 2 cantos retos opostos', () => {
    const start = (k: Exclude<ClipShapeKind, 'none'>) => clipPathCommands(k, 400, 200)[0];
    expect(start('rounded-sm')).toEqual(['M', -200 + 24, -100]);
    expect(start('rounded-lg')).toEqual(['M', -200 + 50, -100]);
    const leaf = clipPathCommands('leaf-tr', 400, 200);
    expect(leaf.filter((c) => c[0] === 'C')).toHaveLength(2);
    expect(leaf[1]).toEqual(['L', 200, -100]); // canto superior direito reto
  });

  it('selos explosão têm 12 e 20 pontas (24 e 40 vértices)', () => {
    expect(clipPathCommands('starburst-12', 100, 100).filter((c) => c[0] !== 'Z')).toHaveLength(24);
    expect(clipPathCommands('starburst-20', 100, 100).filter((c) => c[0] !== 'Z')).toHaveLength(40);
    expect(clipPathCommands('star', 100, 100).filter((c) => c[0] !== 'Z')).toHaveLength(10);
  });
});

describe('spec nas propriedades próprias', () => {
  it('as 6 propriedades estão em CUSTOM_PROPERTIES', () => {
    for (const k of ['clipShape', 'clipScale', 'clipOffsetX', 'clipOffsetY', 'frameStroke', 'frameStrokeWidth']) {
      expect(CUSTOM_PROPERTIES).toContain(k);
    }
  });

  it('frameSpecOf prende valores e ignora forma desconhecida/none', () => {
    expect(frameSpecOf({ clipShape: 'heart', clipScale: 9, clipOffsetX: -4, frameStrokeWidth: 99 })).toEqual({
      kind: 'heart', scale: 3, offsetX: -1, offsetY: 0, stroke: '#ffffff', strokeWidth: 40,
    });
    expect(frameSpecOf({ clipShape: 'none' })).toBeNull();
    expect(frameSpecOf({ clipShape: 'Circle' })).toBeNull();
    expect(frameSpecOf({})).toBeNull();
  });

  it('round-trip toObject → JSON → revive preserva spec e clipPath', async () => {
    const img = framedImage('starburst-12');
    img.set({ clipScale: 2, clipOffsetX: 0.5, clipOffsetY: -0.25 });
    const json = JSON.parse(JSON.stringify(img.toObject()));
    expect(json).toMatchObject({ clipShape: 'starburst-12', clipScale: 2, clipOffsetX: 0.5, clipOffsetY: -0.25, frameStroke: '#ff0000', frameStrokeWidth: 12 });
    expect(json.clipPath.type).toBe('Path');
    // o fromObject do Fabric revive o clipPath pela classe e termina em `new FabricImage(elemento, json)`
    const clip = await Path.fromObject(json.clipPath);
    const back = new FabricImage(photo(400, 300), { ...json, clipPath: clip });
    expect(frameSpecOf(back)).toEqual(frameSpecOf(img));
    const a = clipBoxOnPage(img), b = clipBoxOnPage(back);
    expect(b.w).toBeCloseTo(a.w, 6);
    expect(b.h).toBeCloseTo(a.h, 6);
    // sem moldura, o JSON não leva as propriedades
    const plain = JSON.parse(JSON.stringify(new FabricImage(photo(2, 2)).toObject()));
    expect('clipShape' in plain || 'frameStroke' in plain).toBe(false);
  });
});

describe('clipPath regerado = caixa da imagem', () => {
  it('na aplicação: bbox do clipPath × escala = caixa na página, centrada', () => {
    for (const kind of SHAPES) {
      const img = framedImage(kind);
      const c = clipBoxOnPage(img);
      expect(c.w).toBeCloseTo(200, 6);
      expect(c.h).toBeCloseTo(150, 6);
      expect(c.cx).toBeCloseTo(0, 6);
      expect(c.cy).toBeCloseTo(0, 6);
    }
  });

  it('sem moldura refreshFrame não mexe num clipPath que não é nosso', () => {
    const img = new FabricImage(photo(10, 10));
    const foreign = new Path('M 0 0 L 5 0 L 5 5 Z');
    img.set('clipPath', foreign);
    expect(refreshFrame(img, P)).toBe(false);
    expect(img.clipPath).toBe(foreign);
  });

  it('replaceImage com fator 2 (upscale): a moldura regerada mantém a caixa na página', () => {
    const img = framedImage('heart');
    const before = frameBox(img);
    const nat = img.getOriginalSize();
    const geometry = { width: img.width, height: img.height, scaleX: img.scaleX, scaleY: img.scaleY, cropX: img.cropX, cropY: img.cropY };
    // o que o `setSrc` faz: elemento novo 2× maior, width/height = natural novo
    img.setElement(photo(800, 600));
    img.set(rescaledGeometry(geometry, 800 / nat.width, 600 / nat.height));
    // sem regerar, o clipPath (unidades locais) ficaria com metade do tamanho na tela
    expect(clipBoxOnPage(img).w).toBeCloseTo(before.width / 2, 6);
    refreshFrame(img, P);
    const c = clipBoxOnPage(img);
    expect(frameBox(img).width).toBeCloseTo(before.width, 6);
    expect(c.w).toBeCloseTo(before.width, 6);
    expect(c.h).toBeCloseTo(before.height, 6);
    expect(frameSpecOf(img)?.kind).toBe('heart');
  });

  it('swapImage (moldura com zoom 2): caixa e centro iguais, foto nova preenche com o mesmo zoom', () => {
    const img = framedImage('circle');
    applyFraming(img, 2, 0.5, 0);
    refreshFrame(img, P);
    const box = frameBox(img), center = img.getCenterPoint();
    // o caminho do Editor.swapImage para foto emoldurada: framedGeometry com o zoom/posição relidos da geometria
    const f = currentFraming(img);
    expect(f.scale).toBeCloseTo(2, 6);
    expect(f.offsetX).toBeCloseTo(0.5, 6);
    img.setElement(photo(1000, 1500));
    img.set(framedGeometry(box.width, box.height, 1000, 1500, f.scale, f.offsetX, f.offsetY));
    img.setPositionByOrigin(center, 'center', 'center');
    refreshFrame(img, P);
    const after = frameBox(img);
    expect(after.width).toBeCloseTo(box.width, 6);
    expect(after.height).toBeCloseTo(box.height, 6);
    expect(img.getCenterPoint().x).toBeCloseTo(center.x, 6);
    expect(clipBoxOnPage(img).w).toBeCloseTo(box.width, 6);
    expect(clipBoxOnPage(img).h).toBeCloseTo(box.height, 6);
    expect(currentFraming(img).scale).toBeCloseTo(2, 6);
  });

  it('buildClipPath = clipPathJson revivido', async () => {
    const live = buildClipPath(P, 'arch', 300, 200, 0.5, 0.5) as unknown as Path;
    const revived = await Path.fromObject(clipPathJson('arch', 300, 200, 0.5, 0.5) as never);
    expect(revived.left).toBeCloseTo(live.left, 6);
    expect(revived.top).toBeCloseTo(live.top, 6);
    expect(revived.width * revived.scaleX).toBeCloseTo(live.width * live.scaleX, 6);
  });
});

describe('zoom/posição internos pelo recorte', () => {
  it('framedGeometry mantém a caixa na página em qualquer zoom e posição', () => {
    for (const zoom of [1, 1.7, 3]) {
      for (const [ox, oy] of [[0, 0], [-1, 1], [0.3, -0.6]]) {
        const g = framedGeometry(240, 180, 1200, 800, zoom, ox, oy);
        expect(g.width * g.scaleX).toBeCloseTo(240, 6);
        expect(g.height * g.scaleY).toBeCloseTo(180, 6);
        expect(g.cropX).toBeGreaterThanOrEqual(0);
        expect(g.cropX + g.width).toBeLessThanOrEqual(1200 + 1e-9);
        expect(g.cropY + g.height).toBeLessThanOrEqual(800 + 1e-9);
        const back = framingOf(g, 1200, 800);
        expect(back.scale).toBeCloseTo(zoom, 6);
        if (zoom > 1 || ox !== 0) expect(back.offsetX).toBeCloseTo(ox, 6);
      }
    }
  });

  it('zoom 1 no centro = cover (o mesmo do fitSlot cover do lote)', () => {
    expect(framedGeometry(300, 300, 1200, 600, 1, 0, 0)).toEqual({ width: 600, height: 600, scaleX: 0.5, scaleY: 0.5, cropX: 300, cropY: 0 });
  });

  it('applyFraming mantém caixa e centro da imagem', () => {
    const img = framedImage('pill');
    const box = frameBox(img), center = img.getCenterPoint();
    applyFraming(img, 2.5, -1, 1);
    expect(frameBox(img).width).toBeCloseTo(box.width, 6);
    expect(frameBox(img).height).toBeCloseTo(box.height, 6);
    expect(img.getCenterPoint().y).toBeCloseTo(center.y, 6);
    expect(img.cropX).toBeCloseTo(0, 6);
    expect(img.cropY + img.height).toBeCloseTo(300, 6);
  });
});

describe('⚡ lote: swapPhotoJson regera a moldura', () => {
  it('foto emoldurada recebe clipPath com bbox = nova caixa local', async () => {
    const model = framedImage('hexagon');
    const o = { ...JSON.parse(JSON.stringify(model.toObject())), mergeField: 'foto' };
    const fabric: FabricJson = { objects: [o] };
    const out = applyMergeRow(fabric, { photo: { url: 'blob:x', width: 900, height: 1600 } } as never);
    const r = out.objects[0] as Record<string, number> & { clipPath: Record<string, unknown> };
    expect(r.width * r.scaleX).toBeCloseTo(200, 6);
    expect(r.height * r.scaleY).toBeCloseTo(150, 6);
    const clip = await Path.fromObject(r.clipPath as never);
    expect(clip.width * clip.scaleX).toBeCloseTo(r.width, 4);
    expect(clip.height * clip.scaleY).toBeCloseTo(r.height, 4);
    expect(clip.left).toBeCloseTo(0, 6);
    expect(r.clipShape as unknown).toBe('hexagon');
    // o modelo não muda
    expect((fabric.objects[0] as Record<string, unknown>).width).toBe(400);
  });
});

describe('aro', () => {
  it('canvas: clip pela forma e traço 2w em px da página, depois do drawObject', () => {
    const img = framedImage('circle');
    const calls: string[] = [];
    let lineWidth = 0, strokeStyle = '';
    const scales: number[][] = [];
    const ctx = new Proxy({}, {
      get: (_t, k: string) => {
        if (k === 'scale') return (x: number, y: number) => { scales.push([x, y]); calls.push('scale'); };
        return (..._a: unknown[]) => { calls.push(k); };
      },
      set: (_t, k: string, v) => { if (k === 'lineWidth') lineWidth = v; if (k === 'strokeStyle') strokeStyle = v; return true; },
    }) as unknown as CanvasRenderingContext2D;
    drawFrameRim(img as never, ctx);
    expect(calls.indexOf('clip')).toBeGreaterThan(calls.indexOf('beginPath'));
    expect(calls.indexOf('stroke')).toBeGreaterThan(calls.indexOf('clip'));
    expect(lineWidth).toBe(24);
    expect(strokeStyle).toBe('#ff0000');
    // escala da imagem 0,5 × escala do clipPath 2 = 1 px da página por unidade
    expect(scales.at(-1)![0]).toBeCloseTo(1, 6);
    // sem espessura, nada é desenhado
    calls.length = 0;
    img.set('frameStrokeWidth', 0);
    drawFrameRim(img as never, ctx);
    expect(calls).toEqual([]);
  });

  it('SVG: <clipPath> do Fabric e o <path> do aro com a cor e 2w dentro do <g> da imagem', () => {
    const img = framedImage('starburst-12');
    const svg = img.toSVG();
    expect(svg).toContain('<clipPath');
    const rim = svg.match(/<path d="[^"]+" fill="none" stroke="#ff0000" stroke-width="24"/);
    expect(rim).not.toBeNull();
    // o aro fica antes do </g> que fecha o grupo com clip-path
    expect(svg.indexOf('stroke="#ff0000"')).toBeLessThan(svg.lastIndexOf('</g>'));
    expect(svg).toMatch(/clip-path="url\(#CLIPPATH_/);
    // sem aro: só o recorte
    img.set('frameStrokeWidth', 0);
    expect(img.toSVG()).not.toContain('stroke="#ff0000"');
  });
});
