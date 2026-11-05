import { describe, expect, it } from 'vitest';
import { gridLines, isValidGuide, thirdsPoints } from '../src/overlays';

describe('gridLines', () => {
  it("'thirds': W/3, 2W/3, H/3 e 2H/3, todas principais", () => {
    const l = gridLines('thirds', 1080, 1920);
    expect(l.filter((g) => g.axis === 'x').map((g) => g.pos)).toEqual([360, 720]);
    expect(l.filter((g) => g.axis === 'y').map((g) => g.pos)).toEqual([640, 1280]);
    expect(l.every((g) => g.major)).toBe(true);
  });

  it("'grid-100': a cada 10% nos dois eixos, só a de 50% é principal", () => {
    const l = gridLines('grid-100', 1000, 500);
    const xs = l.filter((g) => g.axis === 'x');
    const ys = l.filter((g) => g.axis === 'y');
    expect(xs.map((g) => Math.round(g.pos))).toEqual([100, 200, 300, 400, 500, 600, 700, 800, 900]);
    expect(ys.map((g) => Math.round(g.pos))).toEqual([50, 100, 150, 200, 250, 300, 350, 400, 450]);
    expect(xs.filter((g) => g.major).map((g) => g.pos)).toEqual([500]);
    expect(ys.filter((g) => g.major).map((g) => g.pos)).toEqual([250]);
  });

  it("'none' não desenha nada", () => {
    expect(gridLines('none', 1080, 1080)).toEqual([]);
  });
});

describe('thirdsPoints', () => {
  it('os 4 pontos de ouro', () => {
    expect(thirdsPoints(900, 600)).toEqual([{ x: 300, y: 200 }, { x: 300, y: 400 }, { x: 600, y: 200 }, { x: 600, y: 400 }]);
  });
});

describe('isValidGuide', () => {
  it('só dentro da página e com número finito', () => {
    expect(isValidGuide({ axis: 'x', pos: 200 }, 1080, 1920)).toBe(true);
    expect(isValidGuide({ axis: 'y', pos: 1920 }, 1080, 1920)).toBe(true);
    expect(isValidGuide({ axis: 'x', pos: 1081 }, 1080, 1920)).toBe(false);
    expect(isValidGuide({ axis: 'y', pos: -1 }, 1080, 1920)).toBe(false);
    expect(isValidGuide({ axis: 'x', pos: Number.NaN }, 1080, 1920)).toBe(false);
  });
});
