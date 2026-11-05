# Editor: zonas seguras e linhas-guia do snapping desenhadas fora de escala (sem o zoom da tela)

- **Origem:** achado lateral do pipeline em task-13-zoom-pan-pinch-reguas-grade-e-simulador-preview-anuncio
  (execução 20261105-1638). Achado lendo o código; **não foi visto no aparelho** (a TASK-01 não tem E2E de pixel).
- **Onde:** `editor-web/src/editor.ts`, construtor do `Editor`, handler `after:render` (l.156–166): chama
  `renderOverlayGuide(ctx, guideOverlay, docWidth, docHeight, this.zoom)` e `renderGuideLines(ctx, activeGuides,
  this.zoom)` direto no `opt.ctx`. As duas funções (`overlays.ts`, `snapping.ts`) desenham em **coordenadas do
  documento** (ex.: retângulo em `docWidth * 0.125`) e dividem a espessura da linha por `zoom`, ou seja, supõem o
  contexto já escalado pelo `viewportTransform`.
- **Causa (aberta na biblioteca):** Fabric 7.4.0, `node_modules/fabric/src/canvas/StaticCanvas.ts::renderCanvas`
  (l.535–571): o `viewportTransform` é aplicado entre `ctx.save()`/`ctx.restore()` só para `_renderObjects`; o evento
  `after:render` dispara depois do `restore`, com o contexto apenas na escala de retina
  (`canvas/DOMManagers/util.ts:20`, `ctx.scale(retinaScaling, retinaScaling)`). Coordenada de documento = pixel CSS.
- **Sintoma previsto (Post 1080×1080 num celular, zoom de encaixe ≈ 0,33, canvas ≈ 358 px CSS):**
  - "Tamanho → Zona Segura → Marketplace (1:1)": o tracejado deveria ficar a 12,5% de cada borda (≈ 45 px CSS);
    sai a 135 px CSS, com lado de 810 px — direita e base fora do canvas; o sombreado cobre quase a página toda.
  - "Reels / Stories (9:16)" num 1080×1920: faixas 3× mais altas que a área coberta real.
  - Smart Guides: a guia do centro (x = 540) é desenhada em x = 540 px CSS, fora do canvas de ≈ 358 px — o objeto
    encaixa mas a linha não aparece.
- **Como reproduzir (receita para o teste):** editor → Post Facebook → "Tamanho" → Zona Segura "Marketplace (1:1)";
  print (`adb exec-out screencap -p`) e ler por CDP o pixel do `editor.canvas.lowerCanvasEl` na posição de tela de
  `editor.docToClient(135, 540)` (deveria ser a linha ciano `#00e5ff`; hoje a linha está em `docToClient(405, 540)`).
- **Esperado:** desenhar os overlays e as guias com `ctx.save(); ctx.transform(...canvas.viewportTransform)` antes e
  `ctx.restore()` depois, passando o zoom efetivo (`canvas.getZoom()`).
- **Relação:** a TASK-13 (`docs/tasks/open/13-zoom-pan-pinch-reguas-grade-e-simulador-preview-anuncio.md`, seção
  "Planejamento (pipeline 20261105-1638)") precisa dessa mesma correção para a grade e o zoom/pan, e a inclui na sua
  reserva (`editor.ts`). Se a TASK-13 for aprovada, este bug fica resolvido por ela: o teste deve então só
  confirmar com a receita acima e mover para `retest/` citando o commit da task.
