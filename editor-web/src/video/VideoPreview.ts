import type { Canvas, FabricObject } from 'fabric';
import type { LayerAnimation, VideoSettings } from '../document';

export interface ObjectOriginalState {
  left: number;
  top: number;
  scaleX: number;
  scaleY: number;
  opacity: number;
  angle: number;
  visible: boolean;
}

/**
 * Motor de reprodução em tempo real no Canvas do Fabric.
 * Executa as animações de camada diretamente no navegador a 60 FPS com áudio sincronizado.
 */
export class VideoPreview {
  private isPlaying = false;
  private currentTime = 0;
  private startTimeMs = 0;
  private animFrameId: number | null = null;
  private originalStates = new Map<FabricObject, ObjectOriginalState>();
  private audioEl: HTMLAudioElement | null = null;

  onTick?: (time: number, progress: number) => void;
  onEnded?: () => void;

  constructor(
    private readonly canvas: Canvas,
    private readonly getSettings: () => VideoSettings,
  ) {}

  get playing(): boolean {
    return this.isPlaying;
  }

  get time(): number {
    return this.currentTime;
  }

  /** Captura o estado original de cada objeto antes da pré-visualização. */
  private captureOriginalStates(): void {
    this.originalStates.clear();
    for (const obj of this.canvas.getObjects()) {
      this.originalStates.set(obj, {
        left: obj.left ?? 0,
        top: obj.top ?? 0,
        scaleX: obj.scaleX ?? 1,
        scaleY: obj.scaleY ?? 1,
        opacity: obj.opacity ?? 1,
        angle: obj.angle ?? 0,
        visible: obj.visible ?? true,
      });
    }
  }

  /** Restaura os objetos para suas posições e estilos originais. */
  restoreOriginalStates(): void {
    for (const [obj, state] of this.originalStates.entries()) {
      obj.set({
        left: state.left,
        top: state.top,
        scaleX: state.scaleX,
        scaleY: state.scaleY,
        opacity: state.opacity,
        angle: state.angle,
        visible: state.visible,
      });
    }
    this.canvas.requestRenderAll();
  }

  play(): void {
    if (this.isPlaying) return;
    if (this.originalStates.size === 0) {
      this.captureOriginalStates();
    }

    const settings = this.getSettings();
    const duration = Math.max(0.5, settings.duration);

    if (this.currentTime >= duration) {
      this.currentTime = 0;
    }

    this.isPlaying = true;
    this.startTimeMs = performance.now() - this.currentTime * 1000;

    // Configura áudio se houver
    if (settings.audioUrl) {
      if (!this.audioEl) {
        this.audioEl = new Audio(settings.audioUrl);
      } else if (this.audioEl.src !== settings.audioUrl) {
        this.audioEl.src = settings.audioUrl;
      }
      this.audioEl.volume = settings.audioVolume ?? 1.0;
      this.audioEl.currentTime = (settings.audioStartTime ?? 0) + this.currentTime;
      this.audioEl.play().catch(() => {});
    }

    this.loop();
  }

  pause(): void {
    if (!this.isPlaying) return;
    this.isPlaying = false;
    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
    if (this.audioEl) {
      this.audioEl.pause();
    }
  }

  stop(): void {
    this.pause();
    this.currentTime = 0;
    this.restoreOriginalStates();
    if (this.audioEl) {
      this.audioEl.pause();
      this.audioEl.currentTime = 0;
    }
    this.onTick?.(0, 0);
  }

  seek(timeInSeconds: number): void {
    const settings = this.getSettings();
    const duration = Math.max(0.5, settings.duration);
    this.currentTime = Math.max(0, Math.min(timeInSeconds, duration));

    if (this.originalStates.size === 0) {
      this.captureOriginalStates();
    }

    this.renderFrame(this.currentTime, duration);

    if (this.audioEl) {
      this.audioEl.currentTime = (settings.audioStartTime ?? 0) + this.currentTime;
    }

    this.onTick?.(this.currentTime, this.currentTime / duration);
  }

  private loop = (): void => {
    if (!this.isPlaying) return;

    const settings = this.getSettings();
    const duration = Math.max(0.5, settings.duration);
    const elapsed = (performance.now() - this.startTimeMs) / 1000;

    if (elapsed >= duration) {
      this.currentTime = duration;
      this.renderFrame(duration, duration);
      this.pause();
      this.onTick?.(duration, 1.0);
      this.onEnded?.();
      return;
    }

    this.currentTime = elapsed;
    this.renderFrame(elapsed, duration);
    this.onTick?.(elapsed, elapsed / duration);

    this.animFrameId = requestAnimationFrame(this.loop);
  };

  /** Calcula e aplica os efeitos de cada objeto para o instante 't'. */
  renderFrame(t: number, totalDuration: number): void {
    for (const [obj, original] of this.originalStates.entries()) {
      const anim = (obj as unknown as { animation?: LayerAnimation }).animation;
      const fx = anim?.fx ?? 'none';

      if (fx === 'none') {
        obj.set({
          left: original.left,
          top: original.top,
          scaleX: original.scaleX,
          scaleY: original.scaleY,
          opacity: original.opacity,
          angle: original.angle,
        });
        continue;
      }

      const st = Math.max(0, anim?.startTime ?? 0);
      const animDur = Math.max(0.2, anim?.duration ?? totalDuration);
      const speed = Math.max(0.1, anim?.speed ?? 1.0);
      const effectiveDur = animDur / speed;

      // Antes do startTime
      if (t < st) {
        if (fx === 'fade' || fx.startsWith('slide_') || fx === 'zoom_in') {
          obj.set({ opacity: 0 });
          continue;
        }
      }

      // Progresso da animação (0 a 1)
      const progress = Math.min(1.0, Math.max(0, (t - st) / effectiveDur));

      let left = original.left;
      let top = original.top;
      let scaleX = original.scaleX;
      let scaleY = original.scaleY;
      let opacity = original.opacity;
      let angle = original.angle;

      switch (fx) {
        case 'fade': {
          opacity = original.opacity * progress;
          break;
        }
        case 'slide_left': {
          const slideDist = 400;
          left = original.left + slideDist * (1 - progress);
          opacity = original.opacity * Math.min(1, progress * 2);
          break;
        }
        case 'slide_right': {
          const slideDist = 400;
          left = original.left - slideDist * (1 - progress);
          opacity = original.opacity * Math.min(1, progress * 2);
          break;
        }
        case 'slide_up': {
          const slideDist = 300;
          top = original.top + slideDist * (1 - progress);
          opacity = original.opacity * Math.min(1, progress * 2);
          break;
        }
        case 'slide_down': {
          const slideDist = 300;
          top = original.top - slideDist * (1 - progress);
          opacity = original.opacity * Math.min(1, progress * 2);
          break;
        }
        case 'zoom_in': {
          const scaleFactor = 0.2 + 0.8 * progress;
          scaleX = original.scaleX * scaleFactor;
          scaleY = original.scaleY * scaleFactor;
          opacity = original.opacity * progress;
          break;
        }
        case 'zoom_out': {
          const scaleFactor = 1.5 - 0.5 * progress;
          scaleX = original.scaleX * scaleFactor;
          scaleY = original.scaleY * scaleFactor;
          opacity = original.opacity * Math.min(1, progress * 3);
          break;
        }
        case 'shake': {
          if (t <= st + 1.2) {
            left = original.left + 10 * Math.sin(20 * (t - st));
          }
          break;
        }
        case 'float': {
          top = original.top + 8 * Math.sin((2 * Math.PI * (t - st)) / 2.5);
          break;
        }
        case 'rotate': {
          if (progress < 1.0) {
            angle = original.angle + 360 * progress;
          }
          break;
        }
        case 'ken_burns': {
          // Zoom contínuo suave durante o vídeo inteiro (1.0 a 1.15)
          const zoomRate = 0.15 * (t / totalDuration);
          const zoomFactor = 1.0 + zoomRate;
          scaleX = original.scaleX * zoomFactor;
          scaleY = original.scaleY * zoomFactor;
          break;
        }
      }

      obj.set({ left, top, scaleX, scaleY, opacity, angle });
    }

    this.canvas.requestRenderAll();
  }
}
