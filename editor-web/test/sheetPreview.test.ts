import { afterEach, describe, expect, it, vi } from 'vitest';
import { openSheet } from '../src/dom';

class FakeClassList {
  private readonly set = new Set<string>();
  add(...tokens: string[]) { for (const t of tokens) this.set.add(t); }
  remove(...tokens: string[]) { for (const t of tokens) this.set.delete(t); }
  toggle(token: string, force?: boolean) {
    const on = force === undefined ? !this.set.has(token) : force;
    if (on) this.set.add(token);
    else this.set.delete(token);
    return on;
  }
  contains(token: string) { return this.set.has(token); }
}

class FakeElement {
  children: FakeElement[] = [];
  classList = new FakeClassList();
  style: Record<string, string> = {};
  textContent: string | null = null;
  value = '';
  checked = false;
  private attrs = new Map<string, string>();
  private listeners = new Map<string, ((e: unknown) => void)[]>();
  rect = { top: 0, bottom: 0, left: 0, right: 0, width: 0, height: 0 };

  constructor(readonly tagName: string) {}

  set className(v: string) {
    this.classList = new FakeClassList();
    for (const part of v.split(/\s+/).filter(Boolean)) this.classList.add(part);
  }
  setAttribute(k: string, v: string) {
    this.attrs.set(k, v);
    if (k === 'class') this.className = v;
  }
  addEventListener(type: string, fn: (e: unknown) => void) {
    const list = this.listeners.get(type) ?? [];
    list.push(fn);
    this.listeners.set(type, list);
  }
  removeEventListener(type: string, fn: (e: unknown) => void) {
    const list = this.listeners.get(type);
    if (!list) return;
    this.listeners.set(type, list.filter((f) => f !== fn));
  }
  dispatch(type: string) {
    for (const fn of this.listeners.get(type) ?? []) fn({});
  }
  append(...nodes: (FakeElement | string)[]) {
    for (const n of nodes) {
      if (typeof n === 'string') this.textContent = (this.textContent ?? '') + n;
      else this.children.push(n);
    }
  }
  replaceChildren(...nodes: (FakeElement | string)[]) {
    this.children = [];
    this.textContent = null;
    this.append(...nodes);
  }
  getBoundingClientRect() {
    if (this.classList.contains('panel')) return { top: 400, bottom: 850, left: 0, right: 400, width: 400, height: 450 };
    return this.rect;
  }
}

function installFakeDom() {
  const sheet = new FakeElement('div');
  const stage = new FakeElement('main');
  stage.rect = { top: 56, bottom: 694, left: 0, right: 400, width: 400, height: 638 };
  const rafQueue: FrameRequestCallback[] = [];
  const winListeners = new Map<string, (() => void)[]>();

  vi.stubGlobal('document', {
    createElement: (tag: string) => new FakeElement(tag),
    getElementById: (id: string) => (id === 'sheet' ? sheet : id === 'stage' ? stage : null),
  });
  vi.stubGlobal('window', {
    addEventListener: (t: string, fn: () => void) => {
      const list = winListeners.get(t) ?? [];
      list.push(fn);
      winListeners.set(t, list);
    },
    removeEventListener: (t: string, fn: () => void) => {
      winListeners.set(t, (winListeners.get(t) ?? []).filter((f) => f !== fn));
    },
  });
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
    rafQueue.push(cb);
    return rafQueue.length;
  });
  vi.stubGlobal('cancelAnimationFrame', vi.fn());
  vi.stubGlobal('ResizeObserver', undefined);

  return {
    sheet,
    stage,
    flushRaf: () => { while (rafQueue.length) rafQueue.shift()!(0); },
    winListeners,
  };
}

describe('folha de edição e animação sem blur/escurecimento', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('CSS do scrim nunca aplica backdrop-filter blur e é transparente no modo preview e paleta', async () => {
    const fsMod = 'node:' + 'fs/promises';
    const { readFile } = (await import(/* @vite-ignore */ fsMod)) as { readFile: (u: URL, enc: 'utf8') => Promise<string> };
    const css = await readFile(new URL('../src/styles.css', import.meta.url), 'utf8');
    const sheetScrim = css.match(/#sheet\s+\.scrim\s*\{[^}]*\}/)?.[0] ?? '';
    const previewScrim = css.match(/#sheet\.preview\s+\.scrim\s*\{[^}]*\}/)?.[0] ?? '';
    const paletteScrim = css.match(/#palette\s+\.scrim\s*\{[^}]*\}/)?.[0] ?? '';

    expect(sheetScrim.length).toBeGreaterThan(0);
    expect(sheetScrim).not.toContain('backdrop-filter');
    expect(sheetScrim).not.toContain('blur(');
    expect(previewScrim).toContain('background: transparent');
    expect(paletteScrim).toContain('background: transparent');
  });

  it('openSheet com preview marca #sheet.preview, enquadra #stage acima do painel e limpa ao fechar', () => {
    const { sheet, stage, flushRaf, winListeners } = installFakeDom();
    const onClose = vi.fn();

    const close = openSheet('🎬 Animação da Camada', new FakeElement('div') as unknown as Node, { preview: true, onClose });
    expect(sheet.classList.contains('show')).toBe(true);
    expect(sheet.classList.contains('preview')).toBe(true);

    flushRaf();
    // stage bottom (694) - panel top (400) = 294px de sobreposição removidos da base de #stage
    expect(stage.style.marginBottom).toBe('294px');
    expect(winListeners.get('resize')?.length).toBe(1);

    close();
    expect(sheet.classList.contains('show')).toBe(false);
    expect(sheet.classList.contains('preview')).toBe(false);
    expect(stage.style.marginBottom).toBe('');
    expect(winListeners.get('resize')?.length).toBe(0);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('reabrir openSheet limpa o layout anterior e folha normal mantém .preview desligado', () => {
    const { sheet, stage, flushRaf } = installFakeDom();

    openSheet('Editar texto', new FakeElement('div') as unknown as Node, { preview: true });
    flushRaf();
    expect(stage.style.marginBottom).toBe('294px');

    const closeNormal = openSheet('Exportar', new FakeElement('div') as unknown as Node);
    expect(sheet.classList.contains('preview')).toBe(false);
    expect(stage.style.marginBottom).toBe('');
    closeNormal();
  });
});
