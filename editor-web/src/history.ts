/** Undo/redo por instantâneos (JSON do documento). Instantâneo igual ao atual é ignorado. */
export class History<T = string> {
  private past: T[] = [];
  private future: T[] = [];
  private current: T | undefined;

  constructor(private readonly limit = 50, private readonly equals: (a: T, b: T) => boolean = (a, b) => a === b) {}

  /** Estado inicial (zera o histórico). */
  reset(state: T): void {
    this.past = [];
    this.future = [];
    this.current = state;
  }

  /** Registra um estado novo depois de uma edição. Retorna false se nada mudou. */
  push(state: T): boolean {
    if (this.current !== undefined && this.equals(this.current, state)) return false;
    if (this.current !== undefined) {
      this.past.push(this.current);
      if (this.past.length > this.limit) this.past.shift();
    }
    this.current = state;
    this.future = [];
    return true;
  }

  undo(): T | undefined {
    const prev = this.past.pop();
    if (prev === undefined || this.current === undefined) return undefined;
    this.future.push(this.current);
    this.current = prev;
    return prev;
  }

  redo(): T | undefined {
    const next = this.future.pop();
    if (next === undefined || this.current === undefined) return undefined;
    this.past.push(this.current);
    this.current = next;
    return next;
  }

  get canUndo(): boolean {
    return this.past.length > 0;
  }

  get canRedo(): boolean {
    return this.future.length > 0;
  }
}
