// Utilitários de DOM mínimos (sem framework).

type Attrs = Record<string, string | number | boolean | ((e: Event) => void) | undefined>;
type Child = Node | string | null | undefined | false;

export function h<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Attrs = {}, ...children: Child[]): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === false) continue;
    if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v as EventListener);
    else if (k === 'class') el.className = String(v);
    else if (k === 'value' && 'value' in el) (el as HTMLInputElement).value = String(v);
    else if (k === 'checked' && 'checked' in el) (el as HTMLInputElement).checked = Boolean(v);
    else el.setAttribute(k, v === true ? '' : String(v));
  }
  for (const c of children) if (c !== null && c !== undefined && c !== false) el.append(c);
  return el;
}

export function button(label: string, onClick: () => void, cls = ''): HTMLButtonElement {
  return h('button', { class: cls, type: 'button', onclick: () => onClick() }, label);
}

export function slider(label: string, min: number, max: number, step: number, value: number, onInput: (v: number) => void,
  onCommit?: (v: number) => void): HTMLElement {
  const out = h('span', { class: 'val' }, fmt(value));
  const input = h('input', { type: 'range', min, max, step, value });
  input.addEventListener('input', () => { out.textContent = fmt(Number(input.value)); onInput(Number(input.value)); });
  if (onCommit) input.addEventListener('change', () => onCommit(Number(input.value)));
  return h('label', { class: 'slider' }, h('span', {}, label), input, out);
}

function fmt(v: number): string {
  return Number.isInteger(v) ? String(v) : v.toFixed(2);
}

export function colorInput(label: string, value: string, onInput: (v: string) => void): HTMLElement {
  const input = h('input', { type: 'color', value: toHex(value) });
  input.addEventListener('input', () => onInput(input.value));
  return h('label', { class: 'color' }, input, h('span', {}, label));
}

export function select(label: string, options: [string, string][], value: string, onChange: (v: string) => void): HTMLElement {
  const sel = h('select', {}, ...options.map(([v, t]) => h('option', { value: v, selected: v === value }, t)));
  sel.value = value;
  sel.addEventListener('change', () => onChange(sel.value));
  return h('label', { class: 'select' }, h('span', {}, label), sel);
}

/** Cor CSS qualquer → #rrggbb (o <input type=color> só aceita esse formato). */
export function toHex(color: string | unknown): string {
  if (typeof color !== 'string') return '#000000';
  if (/^#[0-9a-f]{6}$/i.test(color)) return color;
  const ctx = document.createElement('canvas').getContext('2d')!;
  ctx.fillStyle = '#000000';
  ctx.fillStyle = color;
  const v = ctx.fillStyle;
  return /^#[0-9a-f]{6}$/i.test(v) ? v : '#000000';
}

let toastTimer: number | undefined;
export function toast(message: string): void {
  const el = document.getElementById('toast')!;
  el.textContent = message;
  el.classList.add('show');
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => el.classList.remove('show'), 3200);
}

/** `onCancel` mostra o botão "Cancelar" (só para ações que a ponte sabe cancelar). */
export function setBusy(message: string | null, onCancel?: () => void): void {
  const el = document.getElementById('busy')!;
  el.classList.toggle('show', message !== null);
  el.querySelector('.msg')!.textContent = message ?? '';
  const cancel = el.querySelector<HTMLButtonElement>('.cancel')!;
  cancel.hidden = message === null || !onCancel;
  cancel.onclick = onCancel ?? null;
}

/** Painel inferior modal; devolve a função que fecha. */
export function openSheet(title: string, content: Node, opts: { tall?: boolean } = {}): () => void {
  const root = document.getElementById('sheet')!;
  root.replaceChildren();
  const close = () => { root.classList.remove('show'); root.replaceChildren(); };
  root.append(
    h('div', { class: 'scrim', onclick: close }),
    h('div', { class: 'panel' + (opts.tall ? ' tall' : '') },
      h('div', { class: 'sheet-head' }, h('strong', {}, title), button('✕', close, 'icon')),
      h('div', { class: 'sheet-body' }, content)),
  );
  root.classList.add('show');
  return close;
}

export function confirmSheet(title: string, message: string, okLabel: string): Promise<boolean> {
  return new Promise((resolve) => {
    let done = false;
    const finish = (v: boolean) => { if (!done) { done = true; close(); resolve(v); } };
    const close = openSheet(title, h('div', { class: 'confirm' }, h('p', {}, message),
      h('div', { class: 'row' }, button('Cancelar', () => finish(false)), button(okLabel, () => finish(true), 'primary'))));
    document.querySelector('#sheet .scrim')!.addEventListener('click', () => finish(false));
  });
}
