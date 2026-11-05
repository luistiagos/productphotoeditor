export type OverlayGuideMode = 'none' | 'social-9x16' | 'marketplace-1x1' | 'print-bleed';

/**
 * Desenha o overlay de zona segura ou sangria diretamente sobre o canvas no after:render.
 * Efêmero e nunca exportado.
 */
export function renderOverlayGuide(
  ctx: CanvasRenderingContext2D,
  mode: OverlayGuideMode,
  docWidth: number,
  docHeight: number,
  zoom: number
): void {
  if (mode === 'none') return;

  ctx.save();

  if (mode === 'social-9x16') {
    // Escala proporcional caso a altura seja diferente de 1920 (ex: 720x1280 ou 1080x1920)
    const scale = docHeight / 1920;
    const topBlockedH = 150 * scale;
    const bottomBlockedH = 320 * scale;
    const rightBlockedW = 120 * scale;
    const rightBlockedH = 700 * scale;

    ctx.fillStyle = 'rgba(0, 0, 0, 0.28)';
    ctx.strokeStyle = '#00e5ff';
    ctx.lineWidth = 1.5 / zoom;
    ctx.setLineDash([6 / zoom, 4 / zoom]);

    // 1. Faixa do Topo (Avatar / Perfil / Nome)
    ctx.fillRect(0, 0, docWidth, topBlockedH);
    ctx.beginPath();
    ctx.moveTo(0, topBlockedH);
    ctx.lineTo(docWidth, topBlockedH);
    ctx.stroke();

    // 2. Faixa da Base (Legenda / CTA / Comentários)
    const bottomY = docHeight - bottomBlockedH;
    ctx.fillRect(0, bottomY, docWidth, bottomBlockedH);
    ctx.beginPath();
    ctx.moveTo(0, bottomY);
    ctx.lineTo(docWidth, bottomY);
    ctx.stroke();

    // 3. Faixa Lateral Direita (Botões de Curtir / Comentar / Compartilhar)
    const rightX = docWidth - rightBlockedW;
    const rightY = docHeight - bottomBlockedH - rightBlockedH;
    ctx.fillRect(rightX, rightY, rightBlockedW, rightBlockedH);
    ctx.beginPath();
    ctx.rect(rightX, rightY, rightBlockedW, rightBlockedH);
    ctx.stroke();

    // Rótulos explicativos
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold ${Math.max(12, 14 / zoom)}px sans-serif`;
    ctx.fillText('Área coberta (Perfil / Fechar)', 20 / zoom, topBlockedH - 20 / zoom);
    ctx.fillText('Área coberta (Legenda / CTA Reels & TikTok)', 20 / zoom, bottomY + 30 / zoom);
  } else if (mode === 'marketplace-1x1') {
    // Zona recomendada de 12.5% de margem (o produto ocupa 75%-85% central)
    const marginX = docWidth * 0.125;
    const marginY = docHeight * 0.125;
    const safeW = docWidth - marginX * 2;
    const safeH = docHeight - marginY * 2;

    ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
    // Preenche as 4 margens externas
    ctx.fillRect(0, 0, docWidth, marginY); // Topo
    ctx.fillRect(0, docHeight - marginY, docWidth, marginY); // Base
    ctx.fillRect(0, marginY, marginX, safeH); // Esquerda
    ctx.fillRect(docWidth - marginX, marginY, marginX, safeH); // Direita

    ctx.strokeStyle = '#00e5ff';
    ctx.lineWidth = 1.5 / zoom;
    ctx.setLineDash([5 / zoom, 5 / zoom]);
    ctx.strokeRect(marginX, marginY, safeW, safeH);

    ctx.fillStyle = '#00e5ff';
    ctx.font = `bold ${Math.max(12, 13 / zoom)}px sans-serif`;
    ctx.fillText('Área recomendada para o produto (85% central)', marginX + 10 / zoom, marginY + 24 / zoom);
  } else if (mode === 'print-bleed') {
    // Sangria (Bleed) de 3% + Margem de segurança de 6%
    const bleedX = docWidth * 0.03;
    const bleedY = docHeight * 0.03;
    const safeX = docWidth * 0.06;
    const safeY = docHeight * 0.06;

    // Linha de Sangria (Vermelho tracejado)
    ctx.strokeStyle = '#e53935';
    ctx.lineWidth = 1.5 / zoom;
    ctx.setLineDash([6 / zoom, 4 / zoom]);
    ctx.strokeRect(bleedX, bleedY, docWidth - bleedX * 2, docHeight - bleedY * 2);

    // Linha de Margem de Segurança (Azul tracejado)
    ctx.strokeStyle = '#1e88e5';
    ctx.strokeRect(safeX, safeY, docWidth - safeX * 2, docHeight - safeY * 2);

    // Marcas de corte (Crop marks nos 4 cantos)
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 1 / zoom;
    ctx.setLineDash([]);
    const markLen = 20 / zoom;

    // Top-Left
    ctx.beginPath();
    ctx.moveTo(0, bleedY); ctx.lineTo(markLen, bleedY);
    ctx.moveTo(bleedX, 0); ctx.lineTo(bleedX, markLen);
    // Top-Right
    ctx.moveTo(docWidth, bleedY); ctx.lineTo(docWidth - markLen, bleedY);
    ctx.moveTo(docWidth - bleedX, 0); ctx.lineTo(docWidth - bleedX, markLen);
    // Bottom-Left
    ctx.moveTo(0, docHeight - bleedY); ctx.lineTo(markLen, docHeight - bleedY);
    ctx.moveTo(bleedX, docHeight); ctx.lineTo(bleedX, docHeight - markLen);
    // Bottom-Right
    ctx.moveTo(docWidth, docHeight - bleedY); ctx.lineTo(docWidth - markLen, docHeight - bleedY);
    ctx.moveTo(docWidth - bleedX, docHeight); ctx.lineTo(docWidth - bleedX, docHeight - markLen);
    ctx.stroke();

    ctx.fillStyle = '#e53935';
    ctx.font = `${Math.max(10, 11 / zoom)}px sans-serif`;
    ctx.fillText('Linha de sangria (corte)', bleedX + 6 / zoom, bleedY - 6 / zoom);
  }

  ctx.restore();
}


// ---------- grade de composição e guias manuais (TASK-13) ----------

/** Grade de composição sobre a página: estado de tela, nunca entra no documento nem na exportação. */
export type GridOverlayMode = 'none' | 'thirds' | 'grid-100';

export interface GridLine {
  axis: 'x' | 'y';
  /** Posição em px do documento. */
  pos: number;
  /** Linha principal (terços; a cada 50% na grade quadriculada). */
  major: boolean;
}

/** Guia fixa criada pelo usuário ("Tamanho e Guias"), em px do documento. */
export interface ManualGuide {
  axis: 'x' | 'y';
  pos: number;
}

const GRID_STEPS = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9];

/** Linhas da grade: terços (W/3, 2W/3, H/3, 2H/3) ou quadriculada a cada 10% com as de 50% principais. */
export function gridLines(mode: GridOverlayMode, docWidth: number, docHeight: number): GridLine[] {
  if (mode === 'thirds') {
    return [
      { axis: 'x', pos: docWidth / 3, major: true },
      { axis: 'x', pos: (docWidth * 2) / 3, major: true },
      { axis: 'y', pos: docHeight / 3, major: true },
      { axis: 'y', pos: (docHeight * 2) / 3, major: true },
    ];
  }
  if (mode === 'grid-100') {
    return [
      ...GRID_STEPS.map((f): GridLine => ({ axis: 'x', pos: docWidth * f, major: f === 0.5 })),
      ...GRID_STEPS.map((f): GridLine => ({ axis: 'y', pos: docHeight * f, major: f === 0.5 })),
    ];
  }
  return [];
}

/** Os 4 "pontos de ouro" (interseções dos terços). */
export function thirdsPoints(docWidth: number, docHeight: number): { x: number; y: number }[] {
  const xs = [docWidth / 3, (docWidth * 2) / 3];
  const ys = [docHeight / 3, (docHeight * 2) / 3];
  return xs.flatMap((x) => ys.map((y) => ({ x, y })));
}

/** Cor das linhas dos terços (o E2E lê o pixel dela). */
export const THIRDS_COLOR = '#ffb300';
/** Cor das guias manuais. */
export const MANUAL_GUIDE_COLOR = '#7c4dff';

/**
 * Desenha a grade no after:render, com o contexto já sob o `viewportTransform` (coordenadas do documento);
 * `zoom` = zoom efetivo, para a espessura e o tracejado ficarem constantes na tela.
 */
export function renderGridOverlay(
  ctx: CanvasRenderingContext2D,
  mode: GridOverlayMode,
  docWidth: number,
  docHeight: number,
  zoom: number,
): void {
  const lines = gridLines(mode, docWidth, docHeight);
  if (lines.length === 0) return;
  const z = zoom || 1;
  ctx.save();
  const stroke = (l: GridLine) => {
    ctx.beginPath();
    if (l.axis === 'x') { ctx.moveTo(l.pos, 0); ctx.lineTo(l.pos, docHeight); } else { ctx.moveTo(0, l.pos); ctx.lineTo(docWidth, l.pos); }
    ctx.stroke();
  };
  if (mode === 'thirds') {
    ctx.strokeStyle = THIRDS_COLOR;
    ctx.globalAlpha = 0.9;
    ctx.lineWidth = 1.5 / z;
    ctx.setLineDash([10 / z, 5 / z]);
    lines.forEach(stroke);
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;
    ctx.fillStyle = THIRDS_COLOR;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5 / z;
    for (const p of thirdsPoints(docWidth, docHeight)) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, 4 / z, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
  } else {
    ctx.setLineDash([]);
    for (const l of lines) {
      ctx.strokeStyle = l.major ? 'rgba(255, 179, 0, 0.8)' : 'rgba(128, 128, 128, 0.45)';
      ctx.lineWidth = (l.major ? 1.5 : 1) / z;
      stroke(l);
    }
  }
  ctx.restore();
}

/** Guias manuais (linha cheia, atravessando a página), sob o `viewportTransform`. */
export function renderManualGuides(
  ctx: CanvasRenderingContext2D,
  guides: ManualGuide[],
  docWidth: number,
  docHeight: number,
  zoom: number,
): void {
  if (guides.length === 0) return;
  const z = zoom || 1;
  ctx.save();
  ctx.strokeStyle = MANUAL_GUIDE_COLOR;
  ctx.fillStyle = MANUAL_GUIDE_COLOR;
  ctx.lineWidth = 1.5 / z;
  ctx.setLineDash([]);
  ctx.font = `${11 / z}px sans-serif`;
  for (const g of guides) {
    ctx.beginPath();
    if (g.axis === 'x') { ctx.moveTo(g.pos, 0); ctx.lineTo(g.pos, docHeight); } else { ctx.moveTo(0, g.pos); ctx.lineTo(docWidth, g.pos); }
    ctx.stroke();
    const label = `${g.axis === 'x' ? 'x' : 'y'} ${Math.round(g.pos)}`;
    if (g.axis === 'x') ctx.fillText(label, g.pos + 4 / z, 14 / z); else ctx.fillText(label, 4 / z, g.pos - 4 / z);
  }
  ctx.restore();
}

/** Guia manual válida (dentro da página, número finito). */
export function isValidGuide(g: ManualGuide, docWidth: number, docHeight: number): boolean {
  const max = g.axis === 'x' ? docWidth : docHeight;
  return (g.axis === 'x' || g.axis === 'y') && Number.isFinite(g.pos) && g.pos >= 0 && g.pos <= max;
}
