import type { Canvas, FabricObject } from 'fabric';
import type { LayerAnimation, VideoSettings } from '../document';
import { layerTimeline, stateAt } from './animation';
import { AudioTrack } from './audioTrack';

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
  private audioEl: AudioTrack | null = null;
  /** URL do editor que está carregada em `audioEl`. */
  private audioKey: string | null = null;
  private audioLoading: Promise<void> | null = null;

  onTick?: (time: number, progress: number) => void;
  onEnded?: () => void;

  constructor(
    private readonly canvas: Canvas,
    private readonly getSettings: () => VideoSettings,
    /** Tamanho da página em px do documento (distâncias de deslize). */
    private readonly getPageSize: () => { width: number; height: number } = () => getSettings(),
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

    // Música: decodificada em memória (audioTrack.ts); começa quando estiver pronta, já na posição do instante atual
    if (settings.audioUrl) {
      const url = settings.audioUrl;
      void this.prepareAudio(url).then(() => {
        const el = this.audioEl;
        if (!this.isPlaying || !el || this.audioKey !== url) return;
        const now = this.getSettings();
        el.volume = VideoPreview.audioVolumeAt(now, this.currentTime);
        el.currentTime = this.audioPosition(now, this.currentTime);
        return el.play();
      }).catch((e) => console.warn('audio', e));
    } else {
      this.resetAudio();
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
    // o próximo play recaptura: a camada pode ter sido movida/editada entre um preview e outro
    this.originalStates.clear();
    if (this.audioEl) {
      this.audioEl.pause();
      this.audioEl.currentTime = this.audioPosition(this.getSettings(), 0);
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
      this.audioEl.currentTime = this.audioPosition(settings, this.currentTime);
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

  /** Calcula e aplica os efeitos de cada objeto para o instante 't' (mesma conta do export, `animation.ts`). */
  renderFrame(t: number, totalDuration: number): void {
    const page = this.getPageSize();
    for (const [obj, original] of this.originalStates.entries()) {
      const anim = (obj as unknown as { animation?: LayerAnimation }).animation;
      const tl = layerTimeline(anim, { videoDuration: totalDuration, pageWidth: page.width, pageHeight: page.height, unit: 1 });
      if (!tl) {
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
      const s = stateAt(tl, t);
      obj.set({
        left: original.left + s.dx,
        top: original.top + s.dy,
        scaleX: original.scaleX * s.scale,
        scaleY: original.scaleY * s.scale,
        opacity: s.visible ? original.opacity * s.alpha : 0,
        angle: original.angle + s.angle,
      });
    }
    this.syncAudioVolume(t, totalDuration);
    this.canvas.requestRenderAll();
  }

  /** Volume da música em t (com o fade-out de 1 s no fim, igual ao `afade` do export). */
  static audioVolumeAt(settings: VideoSettings, t: number): number {
    const v = Math.min(1, Math.max(0, settings.audioVolume ?? 0.8));
    if (!settings.audioFadeOut) return v;
    const d = Math.max(0.5, settings.duration);
    const fadeStart = Math.max(0, d - 1);
    return t <= fadeStart ? v : v * Math.max(0, (d - t) / (d - fadeStart));
  }

  private syncAudioVolume(t: number, duration: number): void {
    if (!this.audioEl) return;
    this.audioEl.volume = VideoPreview.audioVolumeAt({ ...this.getSettings(), duration }, t);
  }

  /** Posição da música para o instante t do vídeo (a trilha repete em loop, como o `-stream_loop` do export). */
  private audioPosition(settings: VideoSettings, t: number): number {
    const pos = (settings.audioStartTime ?? 0) + t;
    const d = this.audioEl?.duration;
    return d && Number.isFinite(d) && d > 0 ? pos % d : pos;
  }

  /** Baixa a trilha para um Blob em memória e prepara o elemento (idempotente por URL). */
  prepareAudio(url: string): Promise<void> {
    if (this.audioKey === url && this.audioEl) return Promise.resolve();
    if (this.audioLoading && this.loadingKey === url) return this.audioLoading;
    this.loadingKey = url;
    const job = (async () => {
      const track = new AudioTrack(url);
      await track.load();
      if (this.loadingKey !== url) { track.dispose(); return; } // trocaram de trilha no meio
      this.resetAudio();
      this.audioEl = track;
      this.audioKey = url;
    })();
    this.audioLoading = job;
    return job.finally(() => { if (this.audioLoading === job) this.audioLoading = null; });
  }
  private loadingKey: string | null = null;

  /** Para o áudio e esquece a trilha (trocar/remover a música). */
  resetAudio(): void {
    this.audioEl?.dispose();
    this.audioEl = null;
    this.audioKey = null;
  }

  /** URL do editor da trilha carregada (E2E / diagnóstico). */
  get audioSource(): string | null {
    return this.audioKey;
  }

  /** Elemento de áudio atual (E2E / diagnóstico). */
  get audio(): AudioTrack | null {
    return this.audioEl;
  }
}
