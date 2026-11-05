export interface GuideLine {
  axis: 'x' | 'y';
  pos: number;
  from: number;
  to: number;
  type?: 'center' | 'edge' | 'spacing';
  label?: string;
}

export interface BoundingBox {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface SnapResult {
  deltaX: number;
  deltaY: number;
  guides: GuideLine[];
}

/**
 * Calcula o ajuste de posição magnética (snap) e as linhas-guia a serem desenhadas.
 */
export function computeSnap(
  target: BoundingBox,
  docWidth: number,
  docHeight: number,
  otherObjects: BoundingBox[],
  threshold: number = 6
): SnapResult {
  let bestDeltaX = 0;
  let minDiffX = threshold + 1e-4;
  let bestLineX: GuideLine | null = null;

  let bestDeltaY = 0;
  let minDiffY = threshold + 1e-4;
  let bestLineY: GuideLine | null = null;

  const targetLeft = target.left;
  const targetCenterX = target.left + target.width / 2;
  const targetRight = target.left + target.width;

  const targetTop = target.top;
  const targetCenterY = target.top + target.height / 2;
  const targetBottom = target.top + target.height;

  // 1. Candidatos no Eixo X
  interface CandidateX {
    pos: number;
    type: 'center' | 'edge';
    from: number;
    to: number;
  }

  const candidatesX: CandidateX[] = [
    // Centro do canvas
    { pos: docWidth / 2, type: 'center', from: 0, to: docHeight },
    // Bordas do canvas
    { pos: 0, type: 'edge', from: 0, to: docHeight },
    { pos: docWidth, type: 'edge', from: 0, to: docHeight },
    // Margens de 5%
    { pos: docWidth * 0.05, type: 'edge', from: 0, to: docHeight },
    { pos: docWidth * 0.95, type: 'edge', from: 0, to: docHeight },
  ];

  // Adiciona candidatos de outros objetos
  for (const obj of otherObjects) {
    const objCenterX = obj.left + obj.width / 2;
    const fromY = Math.min(targetTop, obj.top);
    const toY = Math.max(targetBottom, obj.top + obj.height);

    candidatesX.push(
      { pos: obj.left, type: 'edge', from: fromY, to: toY },
      { pos: objCenterX, type: 'center', from: fromY, to: toY },
      { pos: obj.left + obj.width, type: 'edge', from: fromY, to: toY }
    );
  }

  // Compara pontos X do alvo contra candidatos
  const testPointsX: Array<{ val: number; offset: number; name: 'left' | 'center' | 'right' }> = [
    { val: targetLeft, offset: 0, name: 'left' },
    { val: targetCenterX, offset: target.width / 2, name: 'center' },
    { val: targetRight, offset: target.width, name: 'right' },
  ];

  for (const cand of candidatesX) {
    for (const pt of testPointsX) {
      const diff = Math.abs(pt.val - cand.pos);
      if (diff <= threshold && diff < minDiffX) {
        minDiffX = diff;
        bestDeltaX = cand.pos - pt.val;
        bestLineX = {
          axis: 'x',
          pos: cand.pos,
          from: cand.from,
          to: cand.to,
          type: cand.type,
        };
      }
    }
  }

  // 2. Candidatos no Eixo Y
  interface CandidateY {
    pos: number;
    type: 'center' | 'edge';
    from: number;
    to: number;
  }

  const candidatesY: CandidateY[] = [
    // Centro do canvas
    { pos: docHeight / 2, type: 'center', from: 0, to: docWidth },
    // Bordas do canvas
    { pos: 0, type: 'edge', from: 0, to: docWidth },
    { pos: docHeight, type: 'edge', from: 0, to: docWidth },
    // Margens de 5%
    { pos: docHeight * 0.05, type: 'edge', from: 0, to: docWidth },
    { pos: docHeight * 0.95, type: 'edge', from: 0, to: docWidth },
  ];

  for (const obj of otherObjects) {
    const objCenterY = obj.top + obj.height / 2;
    const fromX = Math.min(targetLeft, obj.left);
    const toX = Math.max(targetRight, obj.left + obj.width);

    candidatesY.push(
      { pos: obj.top, type: 'edge', from: fromX, to: toX },
      { pos: objCenterY, type: 'center', from: fromX, to: toX },
      { pos: obj.top + obj.height, type: 'edge', from: fromX, to: toX }
    );
  }

  const testPointsY: Array<{ val: number; offset: number; name: 'top' | 'center' | 'bottom' }> = [
    { val: targetTop, offset: 0, name: 'top' },
    { val: targetCenterY, offset: target.height / 2, name: 'center' },
    { val: targetBottom, offset: target.height, name: 'bottom' },
  ];

  for (const cand of candidatesY) {
    for (const pt of testPointsY) {
      const diff = Math.abs(pt.val - cand.pos);
      if (diff <= threshold && diff < minDiffY) {
        minDiffY = diff;
        bestDeltaY = cand.pos - pt.val;
        bestLineY = {
          axis: 'y',
          pos: cand.pos,
          from: cand.from,
          to: cand.to,
          type: cand.type,
        };
      }
    }
  }

  const guides: GuideLine[] = [];
  if (bestLineX) guides.push(bestLineX);
  if (bestLineY) guides.push(bestLineY);

  // 3. Guias de Igualdade de Espaçamento (Equal Spacing)
  // Se houver pelo menos 2 outros objetos, verificamos vãos equidistantes
  if (otherObjects.length >= 2) {
    const spacingGuides = computeEqualSpacing(target, bestDeltaX, bestDeltaY, otherObjects, threshold);
    if (spacingGuides.deltaX !== undefined) {
      bestDeltaX = spacingGuides.deltaX;
    }
    if (spacingGuides.deltaY !== undefined) {
      bestDeltaY = spacingGuides.deltaY;
    }
    guides.push(...spacingGuides.guides);
  }

  return {
    deltaX: bestDeltaX,
    deltaY: bestDeltaY,
    guides,
  };
}

/**
 * Detecta espaçamento equidistante entre objetos ordenados horizontalmente ou verticalmente.
 */
function computeEqualSpacing(
  target: BoundingBox,
  currentDeltaX: number,
  currentDeltaY: number,
  otherObjects: BoundingBox[],
  threshold: number
): { deltaX?: number; deltaY?: number; guides: GuideLine[] } {
  const guides: GuideLine[] = [];
  let adjustedDeltaX: number | undefined;
  let adjustedDeltaY: number | undefined;

  // Análise no eixo X: objetos com sobreposição vertical
  const horizNeighbors = otherObjects.filter((o) => {
    const overlapY = Math.max(0, Math.min(target.top + target.height, o.top + o.height) - Math.max(target.top, o.top));
    return overlapY > 0 || Math.abs((target.top + target.height / 2) - (o.top + o.height / 2)) < Math.max(target.height, o.height);
  });

  if (horizNeighbors.length >= 2) {
    // Ordena vizinhos pelo eixo X
    const sorted = [...horizNeighbors].sort((a, b) => a.left - b.left);
    for (let i = 0; i < sorted.length - 1; i++) {
      const a = sorted[i];
      const b = sorted[i + 1];
      const gapAB = b.left - (a.left + a.width);
      if (gapAB > 0) {
        // Se o target pode estar entre A e B com gap igual
        const targetW = target.width;
        // Posição ideal se o target estiver entre a e b
        const idealBetweenX = a.left + a.width + (b.left - (a.left + a.width) - targetW) / 2;
        const diffBetween = Math.abs((target.left + currentDeltaX) - idealBetweenX);
        if (diffBetween <= threshold) {
          adjustedDeltaX = idealBetweenX - target.left;
          guides.push({
            axis: 'x',
            pos: idealBetweenX,
            from: target.top,
            to: target.top + target.height,
            type: 'spacing',
            label: `${Math.round(gapAB)}px`,
          });
        }

        // Se o target estiver à direita de b mantendo o mesmo gapAB
        const idealRightX = b.left + b.width + gapAB;
        const diffRight = Math.abs((target.left + currentDeltaX) - idealRightX);
        if (diffRight <= threshold) {
          adjustedDeltaX = idealRightX - target.left;
          guides.push({
            axis: 'x',
            pos: idealRightX,
            from: target.top,
            to: target.top + target.height,
            type: 'spacing',
            label: `${Math.round(gapAB)}px`,
          });
        }

        // Se o target estiver à esquerda de a mantendo o mesmo gapAB
        const idealLeftX = a.left - gapAB - targetW;
        const diffLeft = Math.abs((target.left + currentDeltaX) - idealLeftX);
        if (diffLeft <= threshold) {
          adjustedDeltaX = idealLeftX - target.left;
          guides.push({
            axis: 'x',
            pos: idealLeftX,
            from: target.top,
            to: target.top + target.height,
            type: 'spacing',
            label: `${Math.round(gapAB)}px`,
          });
        }
      }
    }
  }

  // Análise no eixo Y: objetos com sobreposição horizontal
  const vertNeighbors = otherObjects.filter((o) => {
    const overlapX = Math.max(0, Math.min(target.left + target.width, o.left + o.width) - Math.max(target.left, o.left));
    return overlapX > 0 || Math.abs((target.left + target.width / 2) - (o.left + o.width / 2)) < Math.max(target.width, o.width);
  });

  if (vertNeighbors.length >= 2) {
    const sorted = [...vertNeighbors].sort((a, b) => a.top - b.top);
    for (let i = 0; i < sorted.length - 1; i++) {
      const a = sorted[i];
      const b = sorted[i + 1];
      const gapAB = b.top - (a.top + a.height);
      if (gapAB > 0) {
        const targetH = target.height;
        const idealBetweenY = a.top + a.height + (b.top - (a.top + a.height) - targetH) / 2;
        const diffBetween = Math.abs((target.top + currentDeltaY) - idealBetweenY);
        if (diffBetween <= threshold) {
          adjustedDeltaY = idealBetweenY - target.top;
          guides.push({
            axis: 'y',
            pos: idealBetweenY,
            from: target.left,
            to: target.left + target.width,
            type: 'spacing',
            label: `${Math.round(gapAB)}px`,
          });
        }

        const idealBottomY = b.top + b.height + gapAB;
        const diffBottom = Math.abs((target.top + currentDeltaY) - idealBottomY);
        if (diffBottom <= threshold) {
          adjustedDeltaY = idealBottomY - target.top;
          guides.push({
            axis: 'y',
            pos: idealBottomY,
            from: target.left,
            to: target.left + target.width,
            type: 'spacing',
            label: `${Math.round(gapAB)}px`,
          });
        }

        const idealTopY = a.top - gapAB - targetH;
        const diffTop = Math.abs((target.top + currentDeltaY) - idealTopY);
        if (diffTop <= threshold) {
          adjustedDeltaY = idealTopY - target.top;
          guides.push({
            axis: 'y',
            pos: idealTopY,
            from: target.left,
            to: target.left + target.width,
            type: 'spacing',
            label: `${Math.round(gapAB)}px`,
          });
        }
      }
    }
  }

  return { deltaX: adjustedDeltaX, deltaY: adjustedDeltaY, guides };
}

/**
 * Desenha as linhas-guia magnéticas no contexto 2D do Fabric canvas (efêmero, não exportável).
 */
export function renderGuideLines(
  ctx: CanvasRenderingContext2D,
  guides: GuideLine[],
  zoom: number
): void {
  if (!guides || guides.length === 0) return;

  ctx.save();
  ctx.strokeStyle = '#ff2d78';
  ctx.fillStyle = '#ff2d78';
  ctx.lineWidth = 1.5 / zoom;
  ctx.font = `${Math.max(10, 11 / zoom)}px sans-serif`;

  for (const g of guides) {
    ctx.beginPath();
    if (g.type === 'center') {
      ctx.setLineDash([]);
    } else if (g.type === 'spacing') {
      ctx.strokeStyle = '#00e5ff';
      ctx.fillStyle = '#00e5ff';
      ctx.setLineDash([2 / zoom, 2 / zoom]);
    } else {
      ctx.setLineDash([4 / zoom, 4 / zoom]);
    }

    if (g.axis === 'x') {
      ctx.moveTo(g.pos, g.from);
      ctx.lineTo(g.pos, g.to);
    } else {
      ctx.moveTo(g.from, g.pos);
      ctx.lineTo(g.to, g.pos);
    }
    ctx.stroke();

    if (g.label) {
      if (g.axis === 'x') {
        ctx.fillText(g.label, g.pos + 4 / zoom, (g.from + g.to) / 2);
      } else {
        ctx.fillText(g.label, (g.from + g.to) / 2, g.pos - 4 / zoom);
      }
    }
  }

  ctx.restore();
}
