import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LongPress } from '../src/longPress';

describe('LongPress', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('fires with the target after holding still for the delay', () => {
    const fire = vi.fn();
    const lp = new LongPress<string>(fire, 500, 10);
    lp.down('text', 100, 100);
    vi.advanceTimersByTime(499);
    expect(fire).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(fire).toHaveBeenCalledWith('text');
  });

  it('finger jitter within the slop still fires', () => {
    const fire = vi.fn();
    const lp = new LongPress<string>(fire, 500, 10);
    lp.down('text', 100, 100);
    lp.move(106, 107);
    vi.advanceTimersByTime(500);
    expect(fire).toHaveBeenCalledOnce();
  });

  it('dragging beyond the slop cancels', () => {
    const fire = vi.fn();
    const lp = new LongPress<string>(fire, 500, 10);
    lp.down('text', 100, 100);
    lp.move(100, 111);
    vi.advanceTimersByTime(1000);
    expect(fire).not.toHaveBeenCalled();
  });

  it('releasing before the delay cancels, and a later move does nothing', () => {
    const fire = vi.fn();
    const lp = new LongPress<string>(fire, 500, 10);
    lp.down('text', 100, 100);
    vi.advanceTimersByTime(300);
    lp.cancel();
    lp.move(300, 300);
    vi.advanceTimersByTime(1000);
    expect(fire).not.toHaveBeenCalled();
  });

  it('a new press restarts the timer and fires only once, for the new target', () => {
    const fire = vi.fn();
    const lp = new LongPress<string>(fire, 500, 10);
    lp.down('a', 0, 0);
    vi.advanceTimersByTime(300);
    lp.down('b', 50, 50);
    vi.advanceTimersByTime(300);
    expect(fire).not.toHaveBeenCalled();
    vi.advanceTimersByTime(200);
    expect(fire).toHaveBeenCalledOnce();
    expect(fire).toHaveBeenCalledWith('b');
  });
});
