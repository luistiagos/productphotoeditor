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

