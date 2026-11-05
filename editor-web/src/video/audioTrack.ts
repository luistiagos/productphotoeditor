// Trilha de fundo do preview por Web Audio. O <audio> não serve no WebView do app: o asset loader não atende Range
// (sem seek) e `blob:` é recusado ("Media load rejected by URL safety check"). Decodificada em memória, a trilha
// toca em loop com seek exato e volume por GainNode.

export class AudioTrack {
  private ctx: AudioContext | null = null;
  private buffer: AudioBuffer | null = null;
  private gain: GainNode | null = null;
  private source: AudioBufferSourceNode | null = null;
  private offset = 0;
  private startedAt = 0;
  private vol = 1;
  paused = true;
  readonly loop = true;
  error: string | null = null;

  constructor(readonly url: string) {}

  async load(): Promise<void> {
    const res = await fetch(this.url);
    if (!res.ok) throw new Error(`áudio ${res.status}`);
    const data = await res.arrayBuffer();
    this.ctx = new AudioContext();
    try {
      this.buffer = await this.ctx.decodeAudioData(data);
    } catch (e) {
      this.error = String(e);
      throw new Error('áudio ilegível');
    }
    this.gain = this.ctx.createGain();
    this.gain.gain.value = this.vol;
    this.gain.connect(this.ctx.destination);
  }

  get duration(): number {
    return this.buffer?.duration ?? NaN;
  }

  get volume(): number {
    return this.vol;
  }
  set volume(v: number) {
    this.vol = Math.min(1, Math.max(0, v));
    if (this.gain) this.gain.gain.value = this.vol;
  }

  /** Posição na trilha (s), já dentro do loop. */
  get currentTime(): number {
    const d = this.duration;
    const raw = this.paused || !this.ctx ? this.offset : this.offset + (this.ctx.currentTime - this.startedAt);
    return d > 0 ? raw % d : raw;
  }
  set currentTime(t: number) {
    const d = this.duration;
    this.offset = d > 0 ? ((t % d) + d) % d : Math.max(0, t);
    if (!this.paused) {
      this.stopSource();
      this.startSource();
    }
  }

  async play(): Promise<void> {
    if (!this.ctx || !this.buffer) return;
    if (this.ctx.state === 'suspended') await this.ctx.resume();
    if (!this.paused) return;
    this.paused = false;
    this.startSource();
  }

  pause(): void {
    if (this.paused) return;
    this.offset = this.currentTime;
    this.paused = true;
    this.stopSource();
  }

  dispose(): void {
    this.pause();
    void this.ctx?.close();
    this.ctx = null;
    this.buffer = null;
  }

  private startSource(): void {
    if (!this.ctx || !this.buffer || !this.gain) return;
    const src = this.ctx.createBufferSource();
    src.buffer = this.buffer;
    src.loop = true;
    src.connect(this.gain);
    this.startedAt = this.ctx.currentTime;
    src.start(0, this.offset);
    this.source = src;
  }

  private stopSource(): void {
    try { this.source?.stop(); } catch { /* já parado */ }
    this.source?.disconnect();
    this.source = null;
  }
}

/** Número de canais de uma trilha (decodifica em memória); undefined se não der para ler. */
export async function audioChannels(url: string): Promise<number | undefined> {
  try {
    const data = await (await fetch(url)).arrayBuffer();
    const ctx = new OfflineAudioContext(1, 1, 44100);
    return (await ctx.decodeAudioData(data)).numberOfChannels;
  } catch {
    return undefined;
  }
}
