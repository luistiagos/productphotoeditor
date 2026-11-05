# [TASK-01] Smart Guides (Snapping Magnético), Alinhamento/Distribuição Múltipla e Zonas Seguras (Safe Zones / Sangria)

## Metadados e Esforço Mensurado

| Campo | Valor |
| :--- | :--- |
| **ID** | `TASK-01` |
| **Prioridade** | **Alta (Quick Win — P1)** |
| **Esforço Mensurado** | **Baixo** — **~1 a 2 dias úteis (12h–16h / 3 Story Points)** |
| **Escopo** | 100% Local (`editor-web` em TypeScript / Fabric.js 7.4.0) |
| **Referência Analisada (`com.desygner.ads`)** | `extracted/assets/public/docs/create.md` (§ Snapping, Alignment & Distribution, Bleed & Safe Zones) e `js_pretty/assets/LegacyBleed-QbTs3eMW.js` |

### Detalhamento do Esforço por Subtarefa
1. **Motor de Smart Guides e Snapping Magnético (`snapping.ts`):** ~5h (cálculo de bounding boxes no `object:moving`, histerese de snap de 6 px, desenho das linhas-guia no `after:render`).
2. **Alinhamento e Distribuição de Seleção Múltipla (`editor.ts` + `main.ts`):** ~4h (suporte a `ActiveSelection` no Fabric 7, 6 ações de alinhamento e 2 de distribuição espacial uniforme).
3. **Overlay de Safe Zones (Reels/Stories/TikTok) e Sangria de Impressão (`overlays.ts`):** ~3h (camada visual não exportável desenhada no `after:render`, auto-sugerida conforme a proporção do formato em `formats.ts`).
4. **Testes Unitários (Vitest) e Validação E2E no Dispositivo:** ~2h.

---

## 1. Contexto e Problema Atual

Atualmente, em [`editor-web/src/editor.ts`](file:///c:/projects/sandbox/product_photo_offline/editor-web/src/editor.ts):
- O único recurso de posicionamento assistido é [`Editor.centerActive()`](file:///c:/projects/sandbox/product_photo_offline/editor-web/src/editor.ts#L429-L435), que centraliza o objeto ativo no meio exato do documento (`docWidth / 2`, `docHeight / 2`).
- Ao arrastar textos de preço, fotos de produto e selos de oferta pelo dedo, **não há linhas-guia magnéticas (Smart Guides)** para alinhar o topo/base/centro de um selo com o texto de preço ou com o centro da página.
- Quando o usuário seleciona ou quer organizar vários itens (ex.: 3 benefícios do produto ou múltiplos selos), não há ferramentas de **Alinhar à Esquerda/Centro/Direita/Topo/Meio/Base** nem de **Distribuir Horizontalmente/Verticalmente**.
- Ao criar criativos verticais (`1080×1920` para Reels, Stories, TikTok ou Shorts), o usuário frequentemente posiciona textos de preço ou CTAs muito no topo, na base ou na lateral direita — regiões que ficam **encobertas pela interface das redes sociais** (avatar no topo, legenda embaixo, botões de curtir/comentar/compartilhar à direita).

---

## 2. O que deve ser feito (Especificação Técnica Detalhada)

### 2.1. Motor de Smart Guides (Snapping Magnético no Canvas)
Criar o módulo [`editor-web/src/snapping.ts`](file:///c:/projects/sandbox/product_photo_offline/editor-web/src/snapping.ts) e integrá-lo ao ciclo de eventos do Fabric em [`Editor`](file:///c:/projects/sandbox/product_photo_offline/editor-web/src/editor.ts):

1. **Alvos de Snap (Candidatos):**
   - **Página (Canvas):**
     - Centro horizontal (`docWidth / 2`) e centro vertical (`docHeight / 2`);
     - Margens de segurança (5% de cada borda: `0.05 * docWidth`, `0.95 * docWidth`, `0.05 * docHeight`, `0.95 * docHeight`);
     - Bordas do documento (`0`, `docWidth`, `docHeight`).
   - **Outros Objetos Visíveis (`canvas.getObjects()`):**
     - Ignorar o próprio objeto em movimento, objetos invisíveis (`!o.visible`) e a camada de fundo (`isBackground`);
     - Para cada objeto candidato, extrair de `o.getBoundingRect()` os pontos: `left`, `centerX` (`left + width / 2`), `right` (`left + width`), `top`, `centerY` (`top + height / 2`), `bottom` (`top + height`).
2. **Cálculo durante `object:moving`:**
   - Definir limiar de atração em pixels de tela convertidos para coordenadas do documento: `const threshold = 6 / canvas.getZoom()`.
   - Testar os 3 pontos X do objeto arrastado (`left`, `centerX`, `right`) contra todos os candidatos X, e os 3 pontos Y (`top`, `centerY`, `bottom`) contra todos os candidatos Y.
   - Se `Math.abs(activePoint - targetPoint) <= threshold`, ajustar `obj.left` ou `obj.top` para cravar no `targetPoint` de menor distância e registrar a linha-guia ativa (`GuideLine { axis: 'x' | 'y', pos: number, from: number, to: number, label?: string }`).
3. **Guias de Igualdade de Espaçamento (Equal Spacing):**
   - Quando houver $\ge 3$ objetos alinhados aproximados no eixo horizontal ou vertical, detectar se o vão (`gap`) entre o objeto movido e o vizinho $A$ é igual ($\pm \text{threshold}$) ao vão entre o vizinho $A$ e o vizinho $B$.
   - Se sim, fazer snap na posição equidistante e desenhar indicadores duplos de distância entre os três objetos.
4. **Renderização Efêmera (Não polui o JSON nem a Exportação):**
   - No evento `canvas.on('after:render', (opt) => ...)`, desenhar as linhas-guia ativas direto no `opt.ctx` (`CanvasRenderingContext2D`) com cor magenta/rosa de alto contraste (`#ff2d78`, `lineWidth = 1.5`, tracejado `[4, 4]` para bordas de objetos e linha contínua para o centro do canvas).
   - Nos eventos `mouse:up` e `selection:cleared`, limpar a lista de guias ativas e chamar `canvas.requestRenderAll()`.

### 2.2. Ferramentas de Alinhamento e Distribuição (Simples e Múltipla)
Expandir [`Editor`](file:///c:/projects/sandbox/product_photo_offline/editor-web/src/editor.ts) com métodos de alinhamento e distribuição:

1. **Método `align(mode: 'left' | 'center-x' | 'right' | 'top' | 'center-y' | 'bottom')`:**
   - **Se houver apenas 1 objeto selecionado:** alinha em relação às dimensões do documento (`0`, `docWidth / 2`, `docWidth`, `0`, `docHeight / 2`, `docHeight`), respeitando o `getBoundingRect()` real (considerando rotação e escala).
   - **Se houver múltiplos objetos selecionados (`ActiveSelection`):** alinha todos os objetos participantes em relação à caixa delimitadora do grupo selecionado (`selectionBoundingRect`).
   - Ao final, chama `setCoords()` nos objetos e `this.commit()` para registrar no histórico de Undo/Redo.
2. **Método `distribute(axis: 'horizontal' | 'vertical')`:**
   - Habilitado quando houver $\ge 3$ objetos selecionados (ou quando acionado via botão "Distribuir na página" para $\ge 2$ objetos).
   - Ordena os objetos pelo centro no eixo escolhido, mantém o primeiro e o último fixos (ou usa as margens do canvas se solicitado) e calcula o espaçamento uniforme:
     $$\text{gap} = \frac{(\text{maxEdge} - \text{minEdge}) - \sum_{i=1}^{n} \text{size}_i}{n - 1}$$
   - Reposiciona cada objeto intermediário e faz `this.commit()`.
3. **Seleção Múltipla no Toque (Mobile WebView):**
   - Como no celular não há tecla `Shift`, adicionar um botão/modo **"Selecionar vários"** na barra de propriedades ou no painel de **Camadas** ([`showLayers()` em `main.ts`](file:///c:/projects/sandbox/product_photo_offline/editor-web/src/main.ts#L802-L816)) com checkboxes por camada para montar um `ActiveSelection` facilmente com o dedo.

### 2.3. Zonas Seguras (Safe Zones de Redes Sociais) e Sangria de Impressão (`bleedOverlay`)
Criar [`editor-web/src/overlays.ts`](file:///c:/projects/sandbox/product_photo_offline/editor-web/src/overlays.ts) para desenhar guias visuais não exportáveis sobre o palco:

1. **Modos de Overlay (`OverlayGuideMode`):**
   - `'none'`: desligado (padrão para formatos quadrados simples).
   - `'social-9x16'` (Reels / Stories / TikTok `1080×1920`):
     - Zona superior bloqueada: `150 px` do topo (barra de status, nome do perfil, áudio/fechar);
     - Zona inferior bloqueada: `320 px` da base (legenda do anúncio, botão "Saiba mais" / CTA nativo da plataforma);
     - Zona lateral direita bloqueada: faixa de `120 px` de largura nos `700 px` inferiores à direita (ícones de like, comentário, compartilhamento).
     - Desenha hachura semi-transparente (`rgba(0, 0, 0, 0.28)`) fora da área segura com linha pontilhada ciano (`#00e5ff`) e rótulos discretos (`"Área coberta pelo Reels/TikTok"`).
   - `'marketplace-1x1'` (Catálogo Mercado Livre / Shopee / Amazon):
     - Desenha o quadro de margem recomendada de `10%` a `15%` indicando que o produto deve preencher 85% do quadro central.
   - `'print-bleed'` (Sangria e Margem de Corte):
     - Linha de sangria (*bleed*) a `3%` da borda (vermelho tracejado) + marcas de corte (*crop marks*) nos 4 cantos + margem interna de segurança a `6%` (azul tracejado).
2. **Garantia de Não-Exportação:**
   - Como o overlay é desenhado no `after:render` verificando uma flag `editor.isExporting === false` (ou renderizado em um `<canvas class="overlay-guides">` HTML sobreposto com `pointer-events: none` dentro de `#stage`), **nunca** sai nos arquivos gerados por [`exportRaster()`](file:///c:/projects/sandbox/product_photo_offline/editor-web/src/editor.ts#L664-L668), [`exportSvg()`](file:///c:/projects/sandbox/product_photo_offline/editor-web/src/editor.ts#L685-L702) ou [`exportVideoBundle()`](file:///c:/projects/sandbox/product_photo_offline/editor-web/src/editor.ts#L708-L800).

---

## 3. Arquivos a Criar / Modificar

| Arquivo | Ação | Descrição |
| :--- | :---: | :--- |
| [`editor-web/src/snapping.ts`](file:///c:/projects/sandbox/product_photo_offline/editor-web/src/snapping.ts) | **Criar** | Algoritmo puro de cálculo de snapping (`computeSnap`) e renderizador de linhas-guia magnéticas e de espaçamento igual. |
| [`editor-web/src/overlays.ts`](file:///c:/projects/sandbox/product_photo_offline/editor-web/src/overlays.ts) | **Criar** | Renderização das zonas seguras (`social-9x16`, `marketplace-1x1`, `print-bleed`). |
| [`editor-web/src/editor.ts`](file:///c:/projects/sandbox/product_photo_offline/editor-web/src/editor.ts) | **Modificar** | Integrar `snapping.ts` nos eventos do `Canvas`, adicionar `align()`, `distribute()`, `selectMultiple()` e estado de `guideOverlay`. |
| [`editor-web/src/main.ts`](file:///c:/projects/sandbox/product_photo_offline/editor-web/src/main.ts) | **Modificar** | Adicionar botão **"📐 Alinhar"** na barra de propriedades (`renderProps`), seleção múltipla em `showLayers()` e seletor de **"Guias / Zona Segura"** na topbar ou aba `Tamanho`. |
| [`editor-web/test/snapping.test.ts`](file:///c:/projects/sandbox/product_photo_offline/editor-web/test/snapping.test.ts) | **Criar** | Testes unitários cobrindo snap no centro do canvas, snap entre bordas de 2 objetos, snap de igualdade de espaçamento entre 3 objetos e cálculos de `align`/`distribute`. |

---

## 4. Critérios de Aceite e Verificação

- [ ] Ao arrastar qualquer camada (texto, imagem, forma, selo) próximo ao centro do canvas ou alinhado à borda/centro de outra camada ($\le 6\text{ px}$), o objeto encaixa magneticamente e exibe a linha-guia rosa correspondente.
- [ ] Ao soltar o toque (`mouse:up`), todas as linhas-guia somem imediatamente.
- [ ] O painel **"📐 Alinhar"** permite alinhar 1 objeto em relação à página (6 direções) ou $\ge 2$ objetos entre si, além de distribuir objetos horizontalmente e verticalmente com Undo/Redo funcional.
- [ ] Ao escolher um formato `9:16` (Stories / Reels / TikTok) em `Tamanho`, o usuário pode ativar/desativar o overlay de **Zona Segura de Reels/Stories**, e essa máscara **não aparece** na imagem PNG/JPG/MP4 exportada.
- [ ] `npx vitest run` e `npm run build` em `editor-web/` executam com 0 erros.

