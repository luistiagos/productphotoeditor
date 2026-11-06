import { describe, expect, it } from 'vitest';
import { Rect } from 'fabric/node';
import { computeSnap, type BoundingBox, snapMovingTarget } from '../src/snapping';

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

describe('computeSnap com alvos extras (TASK-13: terços e guias manuais)', () => {
  const W = 1080;
  const H = 1080;

  it('borda esquerda a 3 px de W/3 encaixa em W/3', () => {
    const target: BoundingBox = { left: W / 3 + 3, top: 100, width: 100, height: 100 };
    const res = computeSnap(target, W, H, [], 6, { x: [W / 3, (2 * W) / 3], y: [H / 3, (2 * H) / 3] });
    expect(target.left + res.deltaX).toBeCloseTo(W / 3, 9);
    expect(res.guides.some((g) => g.axis === 'x' && g.pos === W / 3 && g.from === 0 && g.to === H)).toBe(true);
  });

  it('centro a 2 px de 2H/3 encaixa em 2H/3', () => {
    const target: BoundingBox = { left: 100, top: (2 * H) / 3 - 50 - 2, width: 80, height: 100 };
    const res = computeSnap(target, W, H, [], 6, { x: [], y: [(2 * H) / 3] });
    expect(target.top + target.height / 2 + res.deltaY).toBeCloseTo((2 * H) / 3, 9);
  });

  it('guia manual em x = 200 atrai a borda direita', () => {
    const target: BoundingBox = { left: 96, top: 400, width: 100, height: 100 };
    const res = computeSnap(target, W, H, [], 6, { x: [200], y: [] });
    expect(target.left + target.width + res.deltaX).toBe(200);
  });

  it('sem `extra` (ou com listas vazias) o resultado é o de antes', () => {
    const target: BoundingBox = { left: W / 3 + 3, top: 100, width: 100, height: 100 };
    const before = computeSnap(target, W, H, [], 6);
    expect(before.deltaX).toBe(0);
    expect(computeSnap(target, W, H, [], 6, { x: [], y: [] })).toEqual(before);
  });

  it('o centro da página continua ganhando quando está mais perto que o alvo extra', () => {
    const target: BoundingBox = { left: 489, top: 100, width: 100, height: 100 }; // centro 539, a 1 px de 540
    const res = computeSnap(target, W, H, [], 6, { x: [536], y: [] });
    expect(res.deltaX).toBe(1);
  });

  it('posição não finita é ignorada', () => {
    const target: BoundingBox = { left: 300, top: 300, width: 10, height: 10 };
    const res = computeSnap(target, W, H, [], 6, { x: [Number.NaN, Number.POSITIVE_INFINITY], y: [] });
    expect(res.deltaX).toBe(0);
  });
});

describe('snapMovingTarget (object:moving real do Fabric: caixa em cache até o setCoords)', () => {
  const W = 1080;
  const H = 1080;
  const thirds = { x: [W / 3, (2 * W) / 3], y: [H / 3, (2 * H) / 3] };
  const rect = () => {
    const r = new Rect({ left: 540, top: 540, width: 324, height: 228, originX: 'center', originY: 'center', strokeWidth: 0 });
    r.setCoords();
    return r;
  };

  it('controle: depois de set(left) sem setCoords o getBoundingRect ainda é o antigo (o que o dragHandler entrega)', () => {
    const r = rect();
    r.set('left', 525);
    expect(r.getBoundingRect().left).toBe(378);
  });

  it('borda a 3 px de W/3 com a caixa em cache desatualizada encaixa em W/3', () => {
    const r = rect();
    r.set('left', 525); // caixa real em 363, cache em 378
    const snap = snapMovingTarget(r, W, H, [], 17, thirds);
    expect(r.getBoundingRect().left).toBeCloseTo(360, 9);
    expect(snap.guides.some((g) => g.axis === 'x' && g.pos === 360)).toBe(true);
  });

  it('arrasto em 14 passos (left absoluto pelo dedo, como o dragHandler) termina encaixado em 360', () => {
    const r = rect();
    const finalLeft = 540 - (378 - 368.55); // dedo leva a borda a 368,55 (3 px de tela a 35%)
    for (let i = 1; i <= 14; i++) {
      r.set('left', 540 + ((finalLeft - 540) * i) / 14); // sem setCoords: o Fabric só chama depois do evento
      snapMovingTarget(r, W, H, [], 17, thirds);
    }
    expect(r.getBoundingRect().left).toBeCloseTo(360, 9);
  });

  it('guia manual em x = 200: arrasto termina com a borda esquerda em 200', () => {
    const r = rect();
    // 1,5 px de tela da guia (4,3 do doc): a borda direita (529) não disputa com o centro da página (540)
    const finalLeft = 540 - (378 - 204.3);
    for (let i = 1; i <= 14; i++) {
      r.set('left', 540 + ((finalLeft - 540) * i) / 14);
      snapMovingTarget(r, W, H, [], 17, { x: [200], y: [] });
    }
    expect(r.getBoundingRect().left).toBeCloseTo(200, 9);
  });
});
