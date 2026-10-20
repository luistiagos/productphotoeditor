import { describe, expect, it, vi } from 'vitest';
import { VideoPreview } from '../src/video/VideoPreview';
import type { Canvas } from 'fabric';

describe('VideoPreview', () => {
  function createMockCanvas(objects: any[] = []): Canvas {
    return {
      getObjects: () => objects,
      requestRenderAll: vi.fn(),
    } as unknown as Canvas;
  }

  it('captura e restaura o estado original dos objetos', () => {
    const obj: any = {
      left: 100,
      top: 200,
      scaleX: 1,
      scaleY: 1,
      opacity: 1,
      angle: 0,
      visible: true,
      set: vi.fn((props: any) => {
        Object.assign(obj, props);
      }),
    };

    const canvas = createMockCanvas([obj]);
    const preview = new VideoPreview(canvas, () => ({
      duration: 5,
      fps: 30,
      width: 1080,
      height: 1080,
    }));

    // Simula renderFrame modificando o objeto
    preview.seek(2.5);

    // Restaura
    preview.restoreOriginalStates();
    expect(obj.left).toBe(100);
    expect(obj.top).toBe(200);
    expect(obj.scaleX).toBe(1);
    expect(obj.scaleY).toBe(1);
  });

  it('calcula interpolação do Ken Burns no meio do vídeo', () => {
    const obj: any = {
      left: 100,
      top: 100,
      scaleX: 1.0,
      scaleY: 1.0,
      opacity: 1.0,
      angle: 0,
      visible: true,
      animation: {
        fx: 'ken_burns',
        startTime: 0,
        duration: 4,
      },
      set: vi.fn((props: any) => {
        Object.assign(obj, props);
      }),
    };

    const canvas = createMockCanvas([obj]);
    const preview = new VideoPreview(canvas, () => ({
      duration: 4,
      fps: 30,
      width: 1080,
      height: 1080,
    }));

    // No tempo t = 2s (metade de 4s), zoomRate deve ser 0.15 * 0.5 = 0.075 -> scale = 1.075
    preview.seek(2);
    expect(obj.scaleX).toBeCloseTo(1.075, 2);
    expect(obj.scaleY).toBeCloseTo(1.075, 2);
  });

  it('aplica opacidade zero para elemento com fade antes do startTime', () => {
    const obj: any = {
      left: 50,
      top: 50,
      scaleX: 1.0,
      scaleY: 1.0,
      opacity: 1.0,
      angle: 0,
      visible: true,
      animation: {
        fx: 'fade',
        startTime: 2.0,
        duration: 2.0,
      },
      set: vi.fn((props: any) => {
        Object.assign(obj, props);
      }),
    };

    const canvas = createMockCanvas([obj]);
    const preview = new VideoPreview(canvas, () => ({
      duration: 5,
      fps: 30,
      width: 1080,
      height: 1080,
    }));

    // Em t = 1.0s (antes de startTime 2.0s), objeto deve estar transparente
    preview.seek(1.0);
    expect(obj.opacity).toBe(0);

    // Em t = 3.0s (meio do fade 2.0 -> 4.0), opacidade deve ser 0.5
    preview.seek(3.0);
    expect(obj.opacity).toBeCloseTo(0.5, 2);
  });
});
