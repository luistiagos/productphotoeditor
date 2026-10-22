/**
 * Toque longo: dispara se o dedo fica parado `delay` ms sobre o alvo. Mover mais que `slop` px (em pixels de tela) ou
 * soltar antes cancela — assim arrastar um objeto nunca vira toque longo.
 */
export class LongPress<T> {
  private timer: ReturnType<typeof setTimeout> | undefined;
  private origin: { x: number; y: number } | undefined;

  constructor(private readonly fire: (target: T) => void, private readonly delay = 500, private readonly slop = 10) {}

  down(target: T, x: number, y: number): void {
    this.cancel();
    this.origin = { x, y };
    this.timer = setTimeout(() => { this.cancel(); this.fire(target); }, this.delay);
  }

  move(x: number, y: number): void {
    if (this.origin && Math.hypot(x - this.origin.x, y - this.origin.y) > this.slop) this.cancel();
  }

  cancel(): void {
    clearTimeout(this.timer);
    this.timer = undefined;
    this.origin = undefined;
  }
}
