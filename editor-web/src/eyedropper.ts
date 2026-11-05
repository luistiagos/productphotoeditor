// Conta-gotas: o dedo arrasta sobre a página com uma lupa acima dele; ao soltar, devolve a cor do pixel (§TASK-03).

import { rgbToHex } from './contrast';
import { h } from './dom';
import type { Editor } from './editor';

const LOUPE = 96;
const GRID = 7;
const ABOVE = 60;

let active = false;

/** Cor do pixel (x, y) de um ImageData, composta sobre branco, como #rrggbb. */
export function pixelHex(img: { data: ArrayLike<number>; width: number; height: number }, x: number, y: number): string | null {
  if (x < 0 || y < 0 || x >= img.width || y >= img.height) return null;
  const p = (Math.floor(y) * img.width + Math.floor(x)) * 4;
  const a = img.data[p + 3] / 255;
  const mix = (v: number) => v * a + 255 * (1 - a);
  return rgbToHex(mix(img.data[p]), mix(img.data[p + 1]), mix(img.data[p + 2]));
}

/**
 * Entra no modo conta-gotas. Resolve com #rrggbb ao soltar o dedo sobre a página, ou null em "Cancelar" / página
 * ilegível (imagem de outra origem suja o canvas).
 */
export function pickColorFromCanvas(editor: Editor, onError: (msg: string) => void = () => {}): Promise<string | null> {
  if (active) return Promise.resolve(null);
  let page: ImageData;
  let scale: number;
  let source: HTMLCanvasElement;
  try {
    const r = editor.renderPageCanvas(2048);
    source = r.canvas;
    scale = r.scale;
    page = source.getContext('2d')!.getImageData(0, 0, source.width, source.height);
  } catch (e) {
    console.warn('eyedropper', e);
    onError('Não foi possível ler as cores desta página.');
    return Promise.resolve(null);
  }
  active = true;
  document.body.classList.add('eyedropping');

  return new Promise((resolve) => {
    const dpr = window.devicePixelRatio || 1;
    const loupe = h('canvas', { class: 'eyedropper-loupe', width: Math.round(LOUPE * dpr), height: Math.round(LOUPE * dpr) });
    const swatch = h('span', { class: 'dot' });
    const code = h('span', {}, '');
    const label = h('div', { class: 'eyedropper-hex' }, swatch, code);
    const holder = h('div', { class: 'eyedropper-holder', hidden: true }, loupe, label);
    const finish = (v: string | null) => {
      layer.remove();
      document.body.classList.remove('eyedropping');
      active = false;
      resolve(v);
    };
    const banner = h('div', { class: 'eyedropper-banner' },
      h('span', {}, 'Arraste o dedo sobre a imagem para capturar uma cor'),
      h('button', { type: 'button', onclick: (e: Event) => { e.stopPropagation(); finish(null); } }, 'Cancelar'));
    const layer = h('div', { class: 'eyedropper-layer', 'data-testid': 'eyedropper' }, banner, holder);
    const lctx = loupe.getContext('2d')!;

    const sampleAt = (clientX: number, clientY: number): string | null => {
      const d = editor.clientToDoc(clientX, clientY);
      return pixelHex(page, d.x * scale, d.y * scale);
    };

    const draw = (clientX: number, clientY: number) => {
      const d = editor.clientToDoc(clientX, clientY);
      const px = Math.floor(d.x * scale);
      const py = Math.floor(d.y * scale);
      const hex = pixelHex(page, px, py);
      holder.hidden = false;
      const left = Math.min(window.innerWidth - LOUPE - 4, Math.max(4, clientX - LOUPE / 2));
      const top = Math.max(4, clientY - ABOVE - LOUPE);
      holder.style.left = `${left}px`;
      holder.style.top = `${top}px`;
      const cell = loupe.width / GRID;
      lctx.imageSmoothingEnabled = false;
      lctx.fillStyle = '#9aa3b2';
      lctx.fillRect(0, 0, loupe.width, loupe.height);
      const half = (GRID - 1) / 2;
      lctx.drawImage(source, px - half, py - half, GRID, GRID, 0, 0, loupe.width, loupe.height);
      lctx.strokeStyle = 'rgba(0,0,0,0.18)';
      lctx.lineWidth = 1;
      for (let i = 1; i < GRID; i++) {
        lctx.beginPath(); lctx.moveTo(i * cell, 0); lctx.lineTo(i * cell, loupe.height); lctx.stroke();
        lctx.beginPath(); lctx.moveTo(0, i * cell); lctx.lineTo(loupe.width, i * cell); lctx.stroke();
      }
      // mira no pixel central (borda dupla: lê em qualquer cor)
      lctx.lineWidth = 3 * dpr;
      lctx.strokeStyle = '#000000';
      lctx.strokeRect(half * cell, half * cell, cell, cell);
      lctx.lineWidth = 1.5 * dpr;
      lctx.strokeStyle = '#ffffff';
      lctx.strokeRect(half * cell, half * cell, cell, cell);
      code.textContent = hex ?? 'fora da página';
      swatch.style.background = hex ?? 'transparent';
      layer.dataset.hex = hex ?? '';
    };

    let down = false;
    layer.addEventListener('pointerdown', (e) => {
      if (banner.contains(e.target as Node)) return; // a lupa tem pointer-events: none
      down = true;
      layer.setPointerCapture(e.pointerId);
      draw(e.clientX, e.clientY);
      e.preventDefault();
    });
    layer.addEventListener('pointermove', (e) => { if (down) draw(e.clientX, e.clientY); });
    layer.addEventListener('pointerup', (e) => {
      if (!down) return;
      down = false;
      const hex = sampleAt(e.clientX, e.clientY);
      if (hex) finish(hex); else holder.hidden = true; // fora da página: continua no modo
    });
    layer.addEventListener('pointercancel', () => { down = false; holder.hidden = true; });
    document.body.append(layer);
  });
}

export function isEyedropperActive(): boolean { return active; }
