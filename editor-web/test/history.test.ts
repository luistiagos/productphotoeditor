import { describe, expect, it } from 'vitest';
import { History } from '../src/history';

describe('History', () => {
  it('undo/redo walks the snapshots and a new edit drops the redo branch', () => {
    const h = new History<string>();
    h.reset('a');
    expect(h.push('a')).toBe(false);
    h.push('b');
    h.push('c');
    expect(h.undo()).toBe('b');
    expect(h.undo()).toBe('a');
    expect(h.undo()).toBeUndefined();
    expect(h.redo()).toBe('b');
    h.push('d');
    expect(h.canRedo).toBe(false);
    expect(h.undo()).toBe('b');
  });

  it('respects the limit', () => {
    const h = new History<number>(2);
    h.reset(0);
    [1, 2, 3, 4].forEach((n) => h.push(n));
    expect(h.undo()).toBe(3);
    expect(h.undo()).toBe(2);
    expect(h.canUndo).toBe(false);
  });

  it('replace swaps the current state without creating an undo step nor touching the redo branch', () => {
    const h = new History<string>();
    h.reset('a');
    h.push('b');
    h.push('c');
    h.undo(); // current b, past [a], future [c]
    h.replace('b@page2');
    expect(h.canUndo).toBe(true);
    expect(h.canRedo).toBe(true);
    expect(h.push('b@page2')).toBe(false); // igual ao atual: nada a empilhar
    expect(h.redo()).toBe('c');
    expect(h.undo()).toBe('b@page2');
    expect(h.undo()).toBe('a');
    expect(h.canUndo).toBe(false);
  });
});
