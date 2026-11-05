# [TASK-13] Zoom e Pan por Pinça (Multi-Touch), Grade/Guias Manuais e Simulador de Preview (Instagram / Mercado Livre)

## Metadados e Esforço Mensurado

| Campo | Valor |
| :--- | :--- |
| **ID** | `TASK-13` |
| **Prioridade** | **Média (Usabilidade Mobile & Conversão — P2)** |
| **Esforço Mensurado** | **Baixo a Médio** — **~1,5 a 2 dias úteis (12h–16h / 3 Story Points)** |
| **Escopo** | 100% Local (`editor-web` em TypeScript / Fabric.js 7.4.0) |
| **Referência Analisada (`com.desygner.ads`)** | `extracted/assets/public/docs/create.md` (§ Zoom and pan L951, § Rulers, guides and grid L941, § Presenter mode L1171, § Preview before publishing L1271) |

### Detalhamento do Esforço por Subtarefa
1. **Motor de Zoom e Pan por Gesto de Pinça de 2 Dedos (`viewportZoom.ts` + integração em `editor.ts`):** ~5h (pinch-to-zoom $0.5\times$ a $4\times$ do zoom base, pan com 2 dedos, bloqueio temporário de manipulação de objeto durante o gesto de 2 dedos e botão *"Ajustar à tela"*).
2. **Grades de Composição (Regra dos Terços $3\times 3$ e Grade Métrica) + Guias Manuais (`overlays.ts` + `snapping.ts`):** ~4h.
3. **Simulador Contextual de Anúncio (`adPreview.ts` — Feed Instagram, Stories/Reels e Busca Mercado Livre/Shopee):** ~4h.
4. **Testes Unitários (Vitest):** ~2h.

---

## 1. Contexto e Problema Atual

No editor atual ([`editor-web/src/editor.ts`](file:///c:/projects/sandbox/product_photo_offline/editor-web/src/editor.ts#L268-L276)):
1. **Canvas travado em zoom fixo (`fit()`):** O método [`Editor.fit()`](file:///c:/projects/sandbox/product_photo_offline/editor-web/src/editor.ts#L268-L276) encaixa a página inteira na tela do celular (`this.zoom = Math.min(w / this.docWidth, h / this.docHeight)`), sem permitir que o usuário **amplie o canvas com movimento de pinça (2 dedos)** para posicionar um detalhe pequeno, ler letras miúdas ou usar o pincel de máscara com precisão.
2. **Sem Grade de Composição (Regra dos Terços / Grid):** Em fotografia de produto e design publicitário, a **Regra dos Terços ($3 \times 3$)** e a grade modular são essenciais para equilibrar o peso visual entre o produto e a chamada de oferta.
3. **Sem Preview Contextual de Publicação:** Antes de exportar o anúncio, o lojista não consegue testar se o texto de preço continuará legível quando reduzido a um card de $180 \times 180\text{ px}$ na página de busca do **Mercado Livre / Shopee**, ou como o criativo ficará emoldurado pelo cabeçalho e barra de curtidas do **Feed do Instagram**.

---

## 2. O que deve ser feito (Especificação Técnica Detalhada)

### 2.1. Zoom e Pan Interativo por Pinça (`viewportZoom.ts`)
Criar o controlador [`editor-web/src/viewportZoom.ts`](file:///c:/projects/sandbox/product_photo_offline/editor-web/src/viewportZoom.ts) e integrá-lo ao `Editor`:

1. **Modelo de Viewport Transform no Fabric:**
   - Manter `baseZoom` (calculado por `fit()`) e `userZoomFactor` no intervalo $[0.5, 4.0]$ (zoom efetivo $Z = \text{baseZoom} \times \text{userZoomFactor}$), além do deslocamento de pan $(panX, panY)$.
   - Ao aplicar `userZoomFactor > 1`, manter o elemento `<canvas>` do tamanho da área útil de `#stage` (ou expandir com `viewportTransform: [Z, 0, 0, Z, panX, panY]`) garantindo que [`renderPage()`](file:///c:/projects/sandbox/product_photo_offline/editor-web/src/editor.ts#L936-L948) continue restaurando `[1, 0, 0, 1, 0, 0]` na exportação (o que já faz nas linhas 939–946).
2. **Gesto de Pinça e Pan com 2 Dedos no `#stage`:**
   - Quando `touchstart` detectar `e.touches.length === 2`:
     - Pausar temporariamente a transformação do objeto ativo no Fabric (`canvas.selection = false` durante o gesto multi-touch) para não redimensionar/mover a peça por engano;
     - Calcular a distância inicial $d_0 = \hypot(\Delta x, \Delta y)$ e o ponto médio $M_0 = ((x_1+x_2)/2, (y_1+y_2)/2)$ entre os 2 dedos;
     - No `touchmove` com 2 dedos, atualizar `userZoomFactor` proporcionalmente a $d_t / d_0$ ancorado em $M_t$, e somar o deslocamento $M_t - M_0$ ao $(panX, panY)$.
   - Duplo toque fora de objetos (ou toque na pílula `100%`) reseta suavemente para `resetZoom()` (`userZoomFactor = 1, panX = 0, panY = 0`).
3. **Pílula Flutuante de Zoom:**
   - Exibir no canto inferior direito do `#stage` um controle discreto `🔍 100%` (visível quando `userZoomFactor !== 1` ou ativável na barra superior) com botões `−`, `100%` (reset) e `+`.

### 2.2. Grade de Composição (Regra dos Terços / Grid) e Guias Manuais
Expandir [`editor-web/src/overlays.ts`](file:///c:/projects/sandbox/product_photo_offline/editor-web/src/overlays.ts) e [`editor-web/src/snapping.ts`](file:///c:/projects/sandbox/product_photo_offline/editor-web/src/snapping.ts):

1. **Grades Visuais (`GridOverlayMode`: `'none' | 'thirds' | 'grid-100'`):**
   - `'thirds'` (**Regra dos Terços $3 \times 3$**): desenha 2 linhas verticais ($W/3, 2W/3$) e 2 horizontais ($H/3, 2H/3$) tracejadas sutis, destacando os 4 "pontos de ouro" de interseção fotográfica.
   - `'grid-100'` (**Grade Quadriculada**): subdivisão a cada $10\%$ da largura/altura com linhas principais a cada $50\%$.
2. **Integração no Snapping Magnético (`snapping.ts`):**
   - Quando a grade `'thirds'` estiver ativa, incluir $W/3, 2W/3$ e $H/3, 2H/3$ como candidatos magnéticos no `computeSnap()` para encaixar o produto ou o selo nos pontos focais da Regra dos Terços.
   - Suporte a `customGuides: { axis: 'x' | 'y'; pos: number }[]` no `Editor` para que o usuário possa adicionar guias fixas na coordenada desejada.

### 2.3. Simulador Contextual de Anúncio (`adPreview.ts`)
Criar o módulo [`editor-web/src/adPreview.ts`](file:///c:/projects/sandbox/product_photo_offline/editor-web/src/adPreview.ts) acionado por um botão **"👁️ Preview"** na barra superior (ao lado de Exportar):

1. **Renderização Instantânea do Criativo:**
   - Gera uma imagem rápida da página via `editor.thumbnail(1080)` sem alças nem guias.
2. **3 Modos de Simulação Realista na Sheet:**
   - **📱 Feed do Instagram / Facebook:** Exibe o criativo dentro de um card com avatar da marca (`brandKit.logoUrl`), nome da loja (`brandKit.profile.company || 'Sua Loja'`), tag *"Patrocinado"*, faixa de CTA *"Comprar agora ›"* e ícones de curtir/comentar/compartilhar.
   - **🎬 Stories / Reels (Tela Cheia Vertical):** Exibe o criativo com a sobreposição real dos ícones laterais e da barra de resposta/legenda inferior para validar se nenhum texto importante ficou tampado.
   - **🛒 Busca de Marketplace (Mercado Livre / Shopee):** Exibe o anúncio em tamanho reduzido ($170 \times 170\text{ px}$) dentro de uma grade de 2 colunas com título fictício, preço `"R$ 99,90"` e selo `"Frete grátis"`, permitindo testar imediatamente se a foto e os selos se destacam em miniatura no celular do comprador!

---

## 3. Arquivos a Criar / Modificar

| Arquivo | Ação | Descrição |
| :--- | :---: | :--- |
| [`editor-web/src/viewportZoom.ts`](file:///c:/projects/sandbox/product_photo_offline/editor-web/src/viewportZoom.ts) | **Criar** | Matemática pura de zoom ancorado num ponto (`pinchZoomMatrix`), limites de pan (`clampPan`) e detector de pinça multi-touch. |
| [`editor-web/src/adPreview.ts`](file:///c:/projects/sandbox/product_photo_offline/editor-web/src/adPreview.ts) | **Criar** | Componente de simulação de Feed Instagram, Stories/Reels e Grade de Busca de Marketplace. |
| [`editor-web/src/overlays.ts`](file:///c:/projects/sandbox/product_photo_offline/editor-web/src/overlays.ts) | **Modificar** | Adicionar renderização da grade Regra dos Terços (`'thirds'`) e grade métrica (`'grid-100'`). |
| [`editor-web/src/snapping.ts`](file:///c:/projects/sandbox/product_photo_offline/editor-web/src/snapping.ts) | **Modificar** | Suportar linhas da Regra dos Terços e guias manuais como alvos magnéticos em `computeSnap()`. |
| [`editor-web/src/editor.ts`](file:///c:/projects/sandbox/product_photo_offline/editor-web/src/editor.ts) | **Modificar** | Integrar `viewportZoom.ts`, expor `setZoom()`, `resetZoom()` e `gridOverlay`. |
| [`editor-web/src/main.ts`](file:///c:/projects/sandbox/product_photo_offline/editor-web/src/main.ts) | **Modificar** | Adicionar botão **"👁️ Preview"** na topbar, seletor de Grade em `showSize()` e pílula de controle de zoom no `#stage`. |
| [`editor-web/test/viewportZoom.test.ts`](file:///c:/projects/sandbox/product_photo_offline/editor-web/test/viewportZoom.test.ts) | **Criar** | Testes unitários validando cálculo de zoom ancorado no centro da pinça, limites $[0.5\times, 4\times]$, clamp de pan e snapping na Regra dos Terços. |

---

## 4. Critérios de Aceite e Verificação

- [ ] O gesto de pinça com 2 dedos no palco amplia e move o canvas suavemente (de $50\%$ a $400\%$) sem mover nem deformar acidentalmente a camada selecionada, e o botão `100%` restaura o encaixe na tela.
- [ ] Mesmo com o canvas ampliado ($200\%+$), exportar para PNG/JPG/SVG/MP4 gera o arquivo no tamanho exato do documento sem cortar nem deslocar a arte.
- [ ] O usuário pode ativar a **Grade Regra dos Terços ($3\times 3$)** em `Tamanho e Guias`, e os objetos encaixam magneticamente nas linhas dos terços.
- [ ] Tocar em **"👁️ Preview"** permite visualizar o anúncio simulado no **Feed do Instagram**, nos **Reels/Stories** e na **Busca do Mercado Livre/Shopee**.
- [ ] `npx vitest run` e `npm run build` passam com 0 erros.

