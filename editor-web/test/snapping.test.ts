import { describe, expect, it } from 'vitest';
import { computeSnap, type BoundingBox } from '../src/snapping';

describe('computeSnap', () => {
  const docWidth = 1080;
  const docHeight = 1080;

  it('faz snap no centro horizontal e vertical do canvas quando próximo', () => {
    // Alvo de 200x200 próximo ao centro do canvas (540, 540)
    // Se o centro do objeto for 538 (left = 438), a distância para 540 é 2px (<= 6px threshold)
    const target: BoundingBox = { left: 438, top: 437, width: 200, height: 200 };
    const res = computeSnap(target, docWidth, docHeight, [], 6);

    expect(res.deltaX).toBe(2); // 438 + 2 = 440 (centro 540)
    expect(res.deltaY).toBe(3); // 437 + 3 = 440 (centro 540)
    expect(res.guides.length).toBe(2);
    expect(res.guides.find((g) => g.axis === 'x')?.pos).toBe(540);
    expect(res.guides.find((g) => g.axis === 'y')?.pos).toBe(540);
  });

  it('não faz snap quando a distância é maior que o threshold', () => {
    const target: BoundingBox = { left: 400, top: 400, width: 200, height: 200 };
    // Centro do alvo é 500, centro do canvas é 540. Distância 40px > 6px
    const res = computeSnap(target, docWidth, docHeight, [], 6);

    expect(res.deltaX).toBe(0);
    expect(res.deltaY).toBe(0);
    expect(res.guides.length).toBe(0);
  });

  it('faz snap com a borda esquerda de outro objeto', () => {
    const other: BoundingBox = { left: 100, top: 200, width: 150, height: 150 };
    // Alvo arrastado para left = 103 (diff = 3 <= 6)
    const target: BoundingBox = { left: 103, top: 600, width: 100, height: 100 };
    const res = computeSnap(target, docWidth, docHeight, [other], 6);

    expect(res.deltaX).toBe(-3); // atrai para 100
    const guideX = res.guides.find((g) => g.axis === 'x');
    expect(guideX).toBeDefined();
    expect(guideX?.pos).toBe(100);
  });

  it('faz snap com o centro de outro objeto', () => {
    const other: BoundingBox = { left: 200, top: 100, width: 200, height: 100 }; // centroX = 300
    // Alvo tem largura 100, posicionado em left = 248 -> centroX = 298. Distância = 2px
    const target: BoundingBox = { left: 248, top: 500, width: 100, height: 100 };
    const res = computeSnap(target, docWidth, docHeight, [other], 6);

    expect(res.deltaX).toBe(2); // centro vai para 300
    const guideX = res.guides.find((g) => g.axis === 'x');
    expect(guideX?.pos).toBe(300);
  });

  it('faz snap nas margens de segurança de 5%', () => {
    const margin5 = docWidth * 0.05; // 54px
    const target: BoundingBox = { left: 52, top: 300, width: 100, height: 100 }; // diff = 2px
    const res = computeSnap(target, docWidth, docHeight, [], 6);

    expect(res.deltaX).toBe(2);
    expect(res.guides.some((g) => g.pos === margin5)).toBe(true);
  });

  it('detecta espaçamento igual (equal spacing) entre três objetos horizontais', () => {
    // Objeto 1: left 100, width 100 (right: 200)
    // Objeto 2: left 300, width 100 (gap entre 1 e 2 = 100px)
    // Objeto 3 (target): width 100, posicionado em left 498 (gap esperado = 100px -> ideal left = 500)
    const obj1: BoundingBox = { left: 100, top: 200, width: 100, height: 100 };
    const obj2: BoundingBox = { left: 300, top: 200, width: 100, height: 100 };
    const target: BoundingBox = { left: 498, top: 200, width: 100, height: 100 };

    const res = computeSnap(target, docWidth, docHeight, [obj1, obj2], 6);
    expect(res.deltaX).toBe(2); // atrai para 500
    const spacingGuide = res.guides.find((g) => g.type === 'spacing');
    expect(spacingGuide).toBeDefined();
    expect(spacingGuide?.label).toBe('100px');
  });
});

