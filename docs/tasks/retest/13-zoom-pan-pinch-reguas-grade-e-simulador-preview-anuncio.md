# [TASK-13] Zoom e Pan por Pinça (Multi-Touch), Grade/Guias Manuais e Simulador de Preview (Instagram / Mercado Livre)

## Status (pipeline 20261105-1638 — aprovado no teste rodada 2, 2026-11-05)

**Feito:** zoom por pinça de 2 dedos (0,5×–4× do encaixe, ancorado no centro da pinça, sem mover/deformar a camada
selecionada nem gerar passo de undo), pan com 2 dedos, pílula `🔍 NN%` (−, reset, +) no canto do palco, duplo toque
fora de objetos volta ao encaixe; exportação PNG/JPG/SVG idêntica com a tela ampliada; grade Regra dos Terços e
quadriculada 10% em "Tamanho e Guias" (só na tela, não exporta) com encaixe magnético nos terços; guias manuais com
encaixe; "👁️ Preview" com Feed, Stories/Reels 9:16 e Busca de marketplace (card 170 px). De quebra corrige o bug lateral
`docs/bugs/retest/editor-guias-e-zonas-seguras-fora-de-escala.md` (passo I: falha na base, passa no fix — o doc dele
foi movido para `retest/` na finalização da execução).

**Commits** (sobre `origin/main` @ `b35e837`): `6bf5b7f` feat(editor) TASK-13 (código + bundle), `7f61d3f` docs teste
rodada 1 reprovado (encaixe nos terços/guia manual não engatava), `cd564f0` e `bd8a6b9` fix(editor) `snapMovingTarget`
(`setCoords()` antes do `getBoundingRect()` no `object:moving`), mais este commit de docs.

**Aparelho:** Moto g86 5G (`adb-ZY32LMNN9B-6mRvcH._adb-tls-connect._tcp`), `E2E_FORMAT="Post Instagram"`. APK do fix
`f4e0549e…6e31` = `sha256sum` do `base.apk` instalado; APK da base `5f2b9877…cd6`.

**Evidência** (`C:\projects\sandbox\.bugfix-pipeline-product_photo_offline\evidencia\20261105-2200-task-13-r2\`;
rodada 1 no emulador em `...\evidencia\20261105-1840-task-13-...\`):
- Offline: `npx vitest run` 256/256 (24 arquivos), `npx tsc --noEmit` limpo, `build --bug` exit 0 (vitest + unidade Gradle
  sem `<failure>`), lane limpa depois do build.
- Controle positivo (`base-b35e837.apk`): `task13.mjs` 5/19 — zoom 1,000× e o 1º dedo arrasta o retângulo (undo 2 → 3),
  sem pílula, sem Preview, sem Grade/guia manual, zona segura fora de escala (`base-task13.txt`, `base/`).
- **T2** (`fix-bd8a6b9.apk`): `task13.mjs` **36/36** (`fix-task13.txt`, prints `fix/13-*`): pinça 3,000×, limites
  4,000×/0,500×, pan +100, reset, export 200% idêntico e arquivo da galeria 1080×1080, encaixe em 360,00 (terços) e
  200,00 (guia manual), preview nos 3 modos, zona segura ciano em x = 135, traço a 200% sob o dedo, teclado mantém o
  fator, sem exceção JS.
- **T3:** `task03` 19/19, `task12` 40/40, `task14` 50/50, `task11` 22/25 — as 3 falhas (seletor de fotos do sistema no
  moto) se repetem iguais com o APK da base (`base-task11.txt`): **não pertinente**, registrada em
  `docs/bugs/open/e2e-task11-seletor-de-fotos-moto-g86.md`. A 1ª tentativa de `task12`/`task14` falhou porque o seletor
  ficou aberto por cima do app (`*-tentativa1.txt`); com ele fechado, passaram.
- **T4:** logcat do PID 7440 (`fix-logcat.txt`): sem `FATAL`/`AndroidRuntime`/`ANR`/erro de console; só `INFO` do
  Chromium sobre `getImageData` (amostragem de pixel do próprio roteiro). Buffer de crash vazio.

**Falta para `done/`:** validação do dono no aparelho dele — pinça e pan com os dedos de verdade (o E2E usa toques
sintéticos por CDP), sensação de suavidade a 4× num design 1080×1920, máscara com o pincel ampliado, legibilidade do
preview; "Exportar → JPG/MP4" a 200% (o E2E cobre PNG/SVG pela API e PNG pela galeria).

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


---

## Planejamento (pipeline 20261105-1638, 2026-11-05)

**Veredito:** corrigir — a funcionalidade não existe (zoom fixo no `fit()`, sem grade nem preview) e cabe inteira em `editor-web/` (estimativa ~1.100 linhas novas, 1 módulo), testável no aparelho pelo CDP.
**Complexidade:** media — um módulo (`editor-web` + o bundle), vários arquivos e um fluxo novo de UI (folha de preview, pílula de zoom); sem Kotlin, sem ponte nova e sem formato de dados novo (grade, guias manuais e zoom são estado de tela, **não** entram no documento).
**Severidade:** medio — funcionalidade ausente (P2 de usabilidade): sem zoom não há como posicionar detalhe pequeno nem pintar máscara com precisão; o resto do editor funciona.
**Arquivos a alterar (reserva da onda):**
- `editor-web/src/viewportZoom.ts` — **novo**: matemática pura do zoom ancorado, limites e rastreador de pinça (sem DOM)
- `editor-web/src/adPreview.ts` — **novo**: modelo puro dos 3 simuladores + montagem do DOM com `h()` de `dom.ts`
- `editor-web/src/overlays.ts` — `GridOverlayMode`, `gridLines()` puro e `renderGridOverlay()`
- `editor-web/src/snapping.ts` — `computeSnap()` aceita candidatos extras (terços e guias manuais)
- `editor-web/src/editor.ts` — zoom do usuário/pan, gesto de 2 dedos, `after:render` sob o `viewportTransform` (corrige o bug lateral), máscara fora da página, `exportSvg` com viewport identidade, `gridOverlay`/`customGuides`
- `editor-web/src/main.ts` — botão "👁️ Preview" na topbar, Grade e guias manuais em `showSize()`, pílula de zoom no `#stage`
- `editor-web/src/styles.css` — pílula de zoom (`#stage` vira `position: relative`) e a folha de preview
- `editor-web/test/viewportZoom.test.ts` — novo
- `editor-web/test/adPreview.test.ts` — novo
- `editor-web/test/overlays.test.ts` — novo (`gridLines`)
- `editor-web/test/snapping.test.ts` — casos dos terços e das guias manuais
- `editor/src/main/assets/editor/index.html` — bundle regerado (arrastado por qualquer mudança em `editor-web/`)
- `tools/e2e/task13.mjs` — E2E novo (T2)

### Causa raiz (símbolos abertos: `arquivo::simbolo` — faz X; em erro, Y)

Item é task: "causa" = o que existe hoje e onde a funcionalidade entra. Linhas da base `0d616c3` (lane `wt-planning`).

- `editor-web/src/editor.ts::Editor.fit` (l.287–295) — `zoom = min(w/docWidth, h/docHeight)` com `pad = 16`;
  `setDimensions(página × zoom)` (o elemento `<canvas>` tem exatamente o tamanho da página na tela) e
  `setViewportTransform([zoom,0,0,zoom,0,0])`. Chamado por: `ResizeObserver(host)` (l.186), `load` (l.222),
  `restore` (l.273, só se o tamanho mudou) e `resize` (l.315). Não há estado de zoom do usuário: a funcionalidade
  está ausente. `this.zoom` também é usado em `addImage` (l.351, teto de escala `1/zoom`) e no `after:render`.
- `editor-web/src/editor.ts::Editor` construtor, `object:moving` (l.126–144) — `computeSnap(bbox, docW, docH,
  outros, 6 / canvas.getZoom())`: o limiar já acompanha o zoom efetivo; `getBoundingRect()` é em coordenadas de cena.
- `editor-web/src/editor.ts::Editor` construtor, `after:render` (l.156–166) — desenha `renderOverlayGuide` e
  `renderGuideLines` no `opt.ctx` em coordenadas de documento, com `this.zoom`. **Defeito existente:** o Fabric
  entrega esse `ctx` SEM o `viewportTransform` (ver abaixo) → bug lateral
  `docs/bugs/open/editor-guias-e-zonas-seguras-fora-de-escala.md`. Com pan isso fica ainda mais errado: a TASK-13
  tem de desenhar tudo sob `ctx.transform(...vpt)`; isso corrige o bug lateral junto.
- `node_modules/fabric/src/canvas/StaticCanvas.ts::renderCanvas` (l.535–571, Fabric 7.4.0) — ordem: fundo →
  `save; transform(vpt); _renderObjects; restore` → `drawControls` (se `!controlsAboveOverlay`) → clipPath →
  `_renderOverlay` → `after:render`. Controles são desenhados no MESMO contexto inferior, ANTES do `after:render`.
  A escala de retina é fixa no contexto (`canvas/DOMManagers/util.ts:20`).
- `node_modules/fabric/src/canvas/StaticCanvas.ts::_renderBackgroundOrOverlay` (l.619–668) — o `backgroundColor`
  preenche o retângulo do ELEMENTO inteiro (0..width, 0..height do canvas, antes do vpt). Se o elemento ficar maior
  que a página (zoom < 1 ou pan), o branco cobre a área fora da página e objetos fora da página aparecem: hoje quem
  recorta é a borda do elemento.
- `node_modules/fabric/src/canvas/Canvas.ts::_isMainEvent` (l.602–618) — pointer com `isPrimary === false` é
  ignorado: o 2º dedo não chega ao Fabric, mas o 1º continua dirigindo o transform corrente → pinça começada sobre
  o objeto selecionado o arrastaria. `canvas.selection = false` só desliga o retângulo de seleção, não o arrasto.
- `node_modules/fabric/src/canvas/SelectableCanvas.ts::endCurrentTransform` (l.1335–1343) — FINALIZA o transform
  (`_finalizeCurrentTransform` → `object:modified` → instantâneo no undo); não desfaz. Para abortar sem efeito é
  preciso devolver `target.set(_currentTransform.original)` + `setCoords()` e zerar `_currentTransform` (campo
  protegido no TS) sem disparar `object:modified`.
- `editor-web/src/editor.ts::renderPage` (l.1431–1443), `::renderPageCanvas` (l.1449–1463), `::renderRegion`
  (l.1626) — trocam o vpt por identidade e ligam `isExporting` (o `after:render` sai cedo): PNG/JPG, miniatura,
  conta-gotas e o pacote de vídeo já independem do zoom. Em erro: `finally` devolve o vpt.
- `editor-web/src/editor.ts::exportSvg` (l.1503–1525) — **não** troca o vpt: `toSVG` com `viewBox` explícito;
  objetos saem sem vpt, mas `StaticCanvas._setSVGBgOverlayColor` (≈ l.1178–1182) usa `invertTransform(vpt)` num
  fundo que seja gradiente/padrão → com zoom/pan o SVG sairia deslocado. Cor lisa usa `100%` (sem efeito).
- `editor-web/src/editor.ts::clientToDoc`/`docToClient` (l.1467–1479) — usam o vpt e o retângulo do
  `lowerCanvasEl`: corretos com qualquer vpt (conta-gotas e os E2E dependem deles).
- `editor-web/src/editor.ts::thumbnail(maxSide)` (l.1489) — `renderPage(maxSide/maior lado, 'jpeg', 0.8)`:
  `thumbnail(1080)` serve ao preview.
- Pincel (`freeDrawingBrush`, l.1326/1380) — largura em unidades de cena; o PencilBrush do Fabric desenha com o vpt:
  funciona ampliado.
- `editor-web/src/main.ts::updateTopbar` (l.165–173) — ↶ ↷ título Camadas Salvar Exportar: o "👁️ Preview" entra
  antes de "Exportar".
- `editor-web/src/main.ts::showSize` (l.1407–1457) — folha "Tamanho e Guias" com `select('Zona Segura', …)` e o
  checkbox de Smart Guides: lugar da Grade e das guias manuais.
- `editor-web/src/main.ts` `brandKit` (l.34, variável de módulo) — `BrandKit.profile.company`, `logoUrl`
  (`brandkit.ts` l.13–17). `editor` fica em `window.editor` (l.1819) para os E2E.
- `editor-web/src/dom.ts::openSheet(title, content, {tall})` (l.97–109) — devolve `close`.
- `editor-web/src/styles.css` `#stage` (l.61) — flex centralizado, `overflow: hidden`; `.canvas-container` com sombra.
- `editor-web/vite.config.ts` — vitest em `environment: 'node'` (sem DOM): a lógica testável tem de ser pura.
- `tools/e2e/cdp.mjs::connect().pinch(cx, cy, d1, d2)` (l.160–170) — dois dedos reais (ids 1 e 2) na horizontal;
  pan de 2 dedos se faz no script com `send('Input.dispatchTouchEvent', …)` transladando os dois pontos.

### Provas (comando literal -> resultado)
- `sed -n 530,575p node_modules/fabric/src/canvas/StaticCanvas.ts` → `ctx.restore()` (l.554) antes de
  `this.fire('after:render', { ctx })` (l.571).
- `grep -rn "ctx.scale(" node_modules/fabric/src/canvas/DOMManagers/` → `util.ts:20: ctx.scale(retinaScaling, retinaScaling)`.
- `grep -n "\"version\"" node_modules/fabric/package.json` → `7.4.0`.
- `grep -n "this\.zoom\|getZoom()\|viewportTransform" src/*.ts` → só `editor.ts` (l.128, 161, 164, 291–293, 351,
  1434–1477, 1627): nenhum outro módulo depende do tamanho do elemento.
- `git status --porcelain docs` → nenhum doc novo de outro planner sobre overlay/guias (dedup do bug lateral).

### Hipóteses descartadas (e por que)
- **Ampliar o elemento `<canvas>` (página × Z) e rolar o `#stage`** (alternativa do doc original): descartado. A 4×
  num 1080×1920 o elemento passa de 1350×2400 px CSS (× DPR ≈ 2,75 → ~24 M px por canvas, 2 canvases ≈ 200 MB) e
  cada quadro da pinça redesenharia tudo isso. O caminho é o vpt com o elemento do tamanho da área útil.
- **Trocar SEMPRE para elemento = área do `#stage`:** descartado para o fator 1. Mudaria a aparência e o retângulo do
  canvas em todos os E2E existentes sem necessidade; com `userZoom === 1` e pan 0 o `fit()` atual fica intacto.
- **`canvas.clipPath` para esconder o que sai da página:** descartado — o `clipPath` é serializado pelo
  `toObject()` (entraria no documento salvo).
- **`endCurrentTransform()` para soltar o objeto ao entrar o 2º dedo:** descartado — finaliza (gera
  `object:modified` e um passo de undo com o deslocamento do 1º dedo), não desfaz.
- **Guias manuais persistidas no documento:** fora — seria formato de dados novo (`document.ts`); nenhum critério
  de aceite pede persistência. Ficam no `Editor` durante a sessão.

### Tarefas
- [ ] `editor-web/src/viewportZoom.ts` (novo) — `MIN_FACTOR = 0.5`, `MAX_FACTOR = 4`; `clampFactor(f)`;
  `anchoredZoom(state, anchor, newFactor, base)` → `{factor, panX, panY}` mantendo sob `anchor` o mesmo ponto do
  documento; `pinchStep(start, now)` (distância e ponto médio de 2 dedos → novo estado: escala `d_t/d_0` ancorada em
  `M_t` + translação `M_t − M_0`); `clampPan(state, page, viewport)` (a página nunca sai inteira da tela: sobra ao
  menos `min(64 px, lado)` visível); `viewportMatrix(base, state, layout)` → `[Z,0,0,Z,e,f]`. — **prova:**
  `test/viewportZoom.test.ts`: ponto do documento sob a âncora invariável (tol 1e-6), limites 0,5/4, clamp do pan,
  fator 1 + pan 0 ⇒ matriz igual à do `fit()` atual.
- [ ] `editor-web/src/editor.ts::Editor` — `baseZoom` (o atual `zoom`), `userZoom`, `panX/panY`; `fit()`: com
  fator 1 e pan 0 faz exatamente o de hoje; senão elemento = área útil do host e vpt = `viewportMatrix(...)`.
  `load`/`newDocument`/`resize` zeram o zoom do usuário; `ResizeObserver` mantém o fator. Públicos: `zoomFactor`
  (get), `setZoom(f, anchorClient?)`, `zoomBy(step)`, `resetZoom()`, `panBy(dx, dy)`. `addImage` continua com o
  `baseZoom`. — **prova:** E2E passos A–D (fator 1 depois do reset ⇒ mesmo `getZoom()`, vpt e tamanho de elemento
  da base).
- [ ] `editor-web/src/editor.ts::Editor` (gesto) — listeners de toque/pointer no host em captura: ao entrar o 2º dedo,
  cancelar o `LongPress`, desfazer o transform corrente pelo `original` (sem `object:modified`), descartar o
  retângulo de seleção em curso, `canvas.selection = false` e não deixar os movimentos do 1º dedo chegarem ao Fabric
  até todos os dedos saírem; então restaurar. Cada `touchmove` de 2 dedos aplica `pinchStep` + `clampPan` e
  `requestRenderAll`. — **prova:** E2E passo A (objeto selecionado sob o 1º dedo: `left/top/scaleX/scaleY/angle`
  iguais e `history` sem passo novo) e passo B (pan).
- [ ] `editor-web/src/editor.ts` `after:render` — `ctx.save(); ctx.transform(...vpt)`; zona segura, grade, guias
  manuais e guias ativas com o zoom efetivo `canvas.getZoom()`; `restore`. Fora do fator 1: pintar a área fora da
  página (cor de fundo do `#stage`) em coordenadas de tela e redesenhar as alças do objeto ativo por cima
  (`drawControls` roda antes do `after:render`). — **prova:** E2E passos F/I (pixel da linha no lugar certo) e bug
  lateral.
- [ ] `editor-web/src/editor.ts::exportSvg` — viewport identidade em `try/finally`, como `renderPage`. — **prova:**
  E2E passo E (SVG a 200% === SVG a 100%).
- [ ] `editor-web/src/overlays.ts` — `GridOverlayMode = 'none' | 'thirds' | 'grid-100'`; `gridLines(mode, w, h)`
  puro → `{axis, pos, major}` (terços: W/3, 2W/3, H/3, 2H/3; grid-100: a cada 10%, `major` a cada 50%);
  `renderGridOverlay(ctx, mode, w, h, zoom)` (tracejado sutil + os 4 pontos de interseção dos terços). — **prova:**
  `test/overlays.test.ts`.
- [ ] `editor-web/src/snapping.ts::computeSnap` — parâmetro opcional `extra?: { x: number[]; y: number[] }`
  (retrocompatível) com candidatos de página inteira; o `Editor` passa os terços quando `gridOverlay === 'thirds'`
  e as `customGuides`. — **prova:** `test/snapping.test.ts` (alvo a 3 px de W/3 ⇒ `deltaX` leva a borda/centro a
  W/3; sem `extra` o resultado de hoje não muda).
- [ ] `editor-web/src/editor.ts` — `gridOverlay: GridOverlayMode = 'none'` e `customGuides: {axis, pos}[]`
  (estado de tela, fora do documento/undo). — **prova:** E2E passos F e H.
- [ ] `editor-web/src/adPreview.ts` (novo) — `previewModel(kit)` puro (nome = `kit.profile.company || 'Sua Loja'`,
  avatar = `logoUrl` ou inicial, "Patrocinado", "Comprar agora ›", preço `"R$ 99,90"`, "Frete grátis", card
  170×170) e `buildAdPreview(mode, imageUrl, kit)` para `'feed' | 'stories' | 'marketplace'` (Stories: moldura
  9:16 com ícones laterais e barra de resposta por cima; Marketplace: grade de 2 colunas com o criativo e cards
  fictícios). Só imagem `data:` (CSP). — **prova:** `test/adPreview.test.ts` (modelo) + E2E passo G.
- [ ] `editor-web/src/main.ts` — `button('👁️ Preview', showAdPreview)` antes de "Exportar" (`thumbnail(1080)` +
  `openSheet(..., {tall: true})` com 3 chips de modo); em `showSize()` `select('Grade', none/thirds/grid-100)` e
  "Guias manuais" (eixo + posição em px, "Adicionar", "Limpar"); pílula `#zoom-pill` fixa no canto inferior direito
  do `#stage` (`−`, rótulo `NN%` que reseta ao toque, `+`), atualizada a cada mudança de zoom. — **prova:** E2E.
- [ ] `editor-web/src/styles.css` — `#stage { position: relative }`, pílula, folha de preview (card feed, moldura
  9:16, grade marketplace). — **prova:** prints do E2E.
- [ ] `tools/e2e/task13.mjs` (novo) — o roteiro da T2 abaixo, no modelo de `task14.mjs` (`launchEditor`,
  `reporter`, `screencap`, terminar com `p.close()`).
- Ordem: código + vitest → `npx tsc --noEmit` → `build --bug <slug>` (background) → `claim` dos `assets/index-*`
  que o `git status` listar → commit `feat(editor): zoom/pan por pinça, grade dos terços e preview de anúncio (TASK-13)`
  junto com o bundle.

### Plano de teste
- **Offline (sem slot):** `npx vitest run` (todos; novos: `viewportZoom`, `overlays`, `adPreview`, casos novos de
  `snapping`) e `npx tsc --noEmit` em `editor-web/`; `build --bug` sai 0 (vitest + `:app:assembleDebug
  testDebugUnitTest`).
- **T2 reprodução como o usuário (E2E, no slot):** `node tools/e2e/task13.mjs <evidencia>` com cwd na lane.
  Estado de partida: `launchEditor()` (Novo design → Post Facebook 1080×1080; no moto `E2E_FORMAT="Post Instagram"`),
  "Formas" → retângulo (objeto selecionado). Antes de tudo guardar `Z0 = editor.canvas.getZoom()`, o vpt e o
  tamanho do `lowerCanvasEl`. Cada passo com print (`screencap`):
  - **A — pinça:** 1º dedo sobre o retângulo selecionado, `pinch(cx, cy, 150, 450)` no centro do `#stage` →
    `getZoom() ≈ 3·Z0` (tol 15%); `editor.clientToDoc(cx, cy)` antes ≈ depois (tol 3 px de documento);
    `left/top/scaleX/scaleY/angle` do retângulo idênticos; `editor.history` sem passo novo (estado de `canUndo`/
    tamanho igual); a pílula mostra ≈ 300%.
  - **B — pan com 2 dedos:** dois pontos transladados +100 px em x → `viewportTransform[4]` aumenta ≈ 100 (tol 10).
  - **C — limites:** pinça 100→900 repetida → `getZoom() ≤ 4·Z0 + ε`; pinça 600→60 repetida → `≥ 0,5·Z0 − ε`.
  - **D — reset:** toque no rótulo `%` da pílula → `getZoom() === Z0`, vpt `[Z0,0,0,Z0,0,0]`, elemento do mesmo
    tamanho de antes. Toque em `+` → fator > 1.
  - **E — exportar ampliado:** com 200% (pílula `+`), `editor.exportRaster('png', 1, 1)` e `editor.exportSvg()`
    idênticos (string) aos gerados no fator 1; PNG decodificado 1080×1080. Complemento pelo caminho do usuário:
    "Exportar → PNG" a 200%, `adb pull` do arquivo novo em `Download/ProductPhoto/` e conferir 1080×1080 no
    cabeçalho PNG (apagar o export depois).
  - **F — grade dos terços:** "Tamanho" → Grade "Regra dos terços" → `editor.gridOverlay === 'thirds'`; pixel do
    `lowerCanvasEl` na posição de tela de `docToClient(360, 200)` com a cor da grade (≠ fundo); no PNG exportado o
    mesmo ponto é a cor do fundo (grade não exporta). Arrastar o retângulo até a borda esquerda ficar a ~3 px de
    tela de x = 360 → ao soltar, `getBoundingRect().left === 360` (tol 0,5).
  - **G — preview:** topbar "👁️ Preview" → folha aberta; modo Feed: texto contém "Patrocinado", "Comprar agora" e o
    nome da loja (`Sua Loja` sem brand kit); modo Stories: moldura 9:16 com a imagem; modo Marketplace: 2 colunas,
    "R$ 99,90", "Frete grátis", imagem do criativo com 170 px CSS de lado e `src` começando com `data:image/jpeg`.
  - **H — guia manual:** "Tamanho" → guia vertical em 200 → arrastar o retângulo para perto → borda/centro em 200.
  - **I — bug lateral:** Zona Segura "Marketplace (1:1)" no fator 1 → pixel em `docToClient(135, 540)` é o ciano
    `#00e5ff` (tol de cor; tracejado: amostrar 3 pontos na linha e exigir ≥ 1).
- **Controle positivo:** APK da base (`git checkout --detach <base>` + `build`) com o mesmo `task13.mjs`: A falha
  (`getZoom()` não muda e o 1º dedo arrasta o retângulo: `left` muda), não há pílula, nem "👁️ Preview" (G falha), nem
  select "Grade" (F falha); I falha (a linha ciano está em `docToClient(405, 540)`). O script tem de reportar `fail`
  nesses passos, não abortar no primeiro (`try` por passo, `reporter` por passo).
- **T3 regressão direcionada:** `task03.mjs` (conta-gotas: `clientToDoc`/`renderPageCanvas`), `task11.mjs` (arrasto,
  inspetor, grupos), `task12.mjs`, `task14.mjs` (toque longo em texto, desenho à mão = `freeDrawingBrush` com vpt) —
  todos no fator 1, sem `fail` novo contra a base. Dentro do `task13.mjs`: com 200%, desenhar à mão um traço e
  conferir que ele nasce sob o dedo (`clientToDoc` do ponto inicial ≈ início do path, tol 6 px de documento); abrir
  "Renomear" (teclado encolhe o `#stage`) e fechar → sem exceção e fator mantido.
- **T4:** logcat do PID (`AndroidRuntime`, `FATAL`, `chromium`/console) na janela do teste sem erro novo.

### Sessões seguintes
- dev: effort high, ultrathink sim — geometria do viewport no Fabric (âncora, pan, máscara fora da página) e conflito
  de gestos com o transform interno do Fabric (campo protegido, ordem de render): raciocínio, não digitação.
- teste: effort medium, ultrathink não — o roteiro está escrito no `task13.mjs`; o cuidado é a pinça por CDP e a
  tolerância do snap (6 px de tela), já descritos aqui.

### Nota do dev (2026-11-05) — o que o código corrigiu no plano

Base do dev: `origin/main` em `b35e837` (a TASK-05 entrou depois do planejamento: as linhas citadas acima andaram ~+35
em `editor.ts`; os símbolos são os mesmos). Três pontos que o plano não tinha e que mudaram a implementação:

- `node_modules/fabric/src/canvas/SelectableCanvas.ts::renderTop` (l.436–441) **também** dispara `after:render`, com o
  contexto de CIMA (`contextTop`, retângulo de seleção / pincel). O handler antigo desenhava os overlays nele também.
  Agora o `after:render` só desenha quando `opt.ctx === canvas.getContext()` (o inferior).
- Máscara de fora da página: em vez de pintar a cor do `#stage` (o `#stage` não tem fundo próprio; é o `body`, e muda no
  tema escuro), o `after:render` APAGA o que está fora da página (`globalCompositeOperation = 'destination-out'`,
  `fill('evenodd')`) e o CSS `#stage.zoomed .canvas-container` fica transparente: aparece o fundo real do palco.
- `StaticCanvas.ts::_setSVGBgOverlayColor` (l.1171–1190): o fundo-gradiente do SVG usa, além do vpt invertido,
  `this.width/height` (o tamanho do ELEMENTO, que com zoom vira o do palco). `exportSvg` troca os dois durante o
  `toSVG` (vpt identidade e `width/height` = página), como o `toCanvasElement` do próprio Fabric faz (l.1387–1427).
- Eventos de toque do Fabric 7.4.0 (`Canvas.ts::addOrRemove` l.168–196, `_onTouchStart` l.623–668,
  `enablePointerEvents: false` em `CanvasOptions.ts` l.284): `touchstart` no `upperCanvasEl`, `touchmove`/`touchend` no
  `document` (bolha). Listener em CAPTURA no `#stage` + `stopPropagation()` corta os dois; o `touchend` final passa
  (o `_onTouchEnd` do Fabric solta os listeners do documento e o `mainTouchId`). `_isClick` (private), `_groupSelector`
  e `_isCurrentlyDrawing` (protected) são zerados por cast; `_currentTransform` é público.

## Correcao (pipeline 20261105-1638, rodada 1)

**O que mudou** (`arquivo::simbolo` — o quê / por quê):

- `editor-web/src/viewportZoom.ts` (novo) — matemática pura em coordenadas do palco: `clampFactor` ([0,5; 4]),
  `pageOffset`/`viewportMatrix` (`[Z,0,0,Z,e,f]` com `Z = base·factor`, `e = (palcoW − docW·Z)/2 + panX`),
  `stageToDoc`, `anchoredZoom` (o ponto do documento sob a âncora não anda), `touchGeometry` + `pinchStep` (sempre a
  partir do início do gesto: escala `d_t/d_0` e o ponto sob `M_0` vai para `M_t`), `clampPan` (sobra ≥ `min(64 px,
  lado)` da página no palco), `stepFactor` (paradas 50/75/100/150/200/300/400%) e `zoomLabel`.
- `editor-web/src/editor.ts::Editor`
  - `baseZoom` (o antigo `zoom`) + `view: ViewState`; `fit()`: com fator 1 e pan 0 faz exatamente o de antes
    (elemento = página × zoom, vpt `[base,0,0,base,0,0]`); senão elemento = área do `#stage` (só `setDimensions`
    quando o tamanho muda), classe `zoomed` no host, `clampPan` e vpt = `viewportMatrix`. Avisa `onZoom`.
  - Públicos: `zoomFactor`, `isZoomed`, `viewState`, `setZoom(f, anchorClient?)`, `zoomBy(±1)`, `resetZoom()`,
    `panBy(dx, dy)`, `addCustomGuide(axis, pos)`, `clearCustomGuides()`, `gridOverlay`, `customGuides`, `onZoom`.
  - `load`/`newDocument` e `resize` voltam ao encaixe; guia manual fora da página nova sai. `ResizeObserver` (teclado,
    painel de propriedades) mantém o fator. `addImage` usa `baseZoom`.
  - `installGestures` — `touchstart/move/end/cancel` em captura no `#stage` (`passive: false`). Ao entrar o 2º dedo:
    `abortFabricGesture` (devolve `target.set(_currentTransform.original)` + `setCoords`, zera `_currentTransform`,
    `_groupSelector`, `_isCurrentlyDrawing`, `_isClick`, limpa o `contextTop`, cancela o `LongPress`, apaga as guias
    ativas) — sem `object:modified`, logo sem passo de undo; `canvas.selection = false` até soltar. Cada `touchmove` de
    2 dedos: `pinchStep` + `clampPan`. Dedo que sai com 2+ restantes recomeça a base da pinça; com 1 restante, segue
    bloqueado até todos saírem.
  - Duplo toque fora de objetos (toque < 300 ms, < 12 px de arrasto, dois em < 400 ms e < 40 px; medido no palco,
    confirmado no `mouse:up` sem `target`) → `resetZoom()`.
  - `after:render` — só no contexto inferior; com zoom: `maskOutsidePage` (apaga fora da página + borda de 1 px);
    `save; transform(vpt)`; grade, zona segura, guias manuais, guias ativas com `canvas.getZoom()`; `restore`; com zoom
    redesenha as alças (`canvas.drawControls`). **Corrige o bug lateral** `editor-guias-e-zonas-seguras-fora-de-escala`.
  - `extraSnapTargets` — terços (com `gridOverlay === 'thirds'`) + guias manuais → `computeSnap(..., extra)`.
  - `exportSvg` — vpt identidade e `width/height` = página durante o `toSVG`, devolvidos antes do `await` e no
    `finally`.
- `editor-web/src/overlays.ts` — `GridOverlayMode`, `GridLine`, `ManualGuide`, `gridLines` (puro), `thirdsPoints`,
  `renderGridOverlay` (terços tracejados `#ffb300` + 4 pontos de ouro; quadriculada 10% com 50% principal),
  `renderManualGuides` (`#7c4dff`), `isValidGuide`.
- `editor-web/src/snapping.ts::computeSnap` — 6º parâmetro opcional `extra?: ExtraSnapTargets` (candidatos de página
  inteira, tipo `edge`); sem ele, resultado idêntico.
- `editor-web/src/adPreview.ts` (novo) — `previewModel(kit, nome)` (`company || 'Sua Loja'`, logo ou inicial,
  "Patrocinado", "Comprar agora ›", "R$ 99,90", "Frete grátis", card 170 px, 3 concorrentes fictícios),
  `storiesFrameWidth` (9:16 que cabe), `buildAdPreview(mode, url, model, {aspect, maxW, maxH})` para
  `feed | stories | marketplace` com o `h()` de `dom.ts`. Moldura própria (sem logotipo/marca de terceiros).
- `editor-web/src/main.ts` — `updateTopbar`: botão `.preview` "👁️ Preview" antes de "Exportar" (o rótulo " Preview"
  some com largura ≤ 480 px: com ele a barra passava da tela do celular); `showAdPreview` (`thumbnail(1080)` + folha
  alta com os 3 chips de modo); pílula `#zoom-pill` (−, `🔍 NN%` que reseta, +) sempre visível no canto inferior
  direito do `#stage`, destacada (`.active`) fora do encaixe; `showSize`: select "Grade" (Nenhuma / Regra dos terços
  (3×3) / Grade quadriculada (10%)) e "Guias manuais" (eixo, posição em px, Adicionar, Limpar, lista).
- `editor-web/src/styles.css` — `#stage { position: relative; touch-action: none }`, `#stage.zoomed .canvas-container`
  transparente, pílula, botão do preview, e a folha de preview (`.adp-*`).
- Testes: `test/viewportZoom.test.ts` (novo, 31 casos: âncora invariável tol 1e-6 em 3 estados × 4 âncoras × 5 fatores,
  limites, pan puro, clamp, fator 1 ⇒ matriz do `fit()`), `test/overlays.test.ts` (novo), `test/adPreview.test.ts`
  (novo), `test/snapping.test.ts` (+6 casos: terços, guia manual, sem `extra` = antes). `npx vitest run`: 24 arquivos,
  252 testes, 0 falha; `npx tsc --noEmit` limpo.
- `tools/e2e/task13.mjs` (novo) — roteiro da T2 (passos A–I + T3), cada passo num `try` (o controle positivo reporta
  FAIL sem abortar).

**Ajustes ao Plano de teste** (o roteiro está no `task13.mjs`):
- **A:** a pinça é na DIAGONAL e a distância final é `min(450, o que cabe no palco)` — `pinch(cx, cy, 150, 450)` na
  horizontal põe os dedos fora de uma tela de ~412 px CSS. O esperado é `d2/150` (≈ 3 no moto). O 1º dedo pousa no
  retângulo e arrasta 8 px ANTES do 2º dedo (exercita o desfazer do transform do Fabric).
- **C:** pinças 90 → 380 px (×3) e 380 → 60 px (×3), dentro da tela.
- **E:** os dois "+" da pílula dão 200% (paradas 100 → 150 → 200). A exportação pela UI é "Exportar → Salvar na
  galeria": o PNG vai para `Pictures/ProductPhoto/` (não `Download/`; `EditorExports.kt::save`), com nome único
  `E2E13_<ms>`; o script faz `adb pull`, lê o IHDR e apaga o arquivo.
- **G:** o script põe um brand kit vazio na página (`ppEditor.setBrandKit`, não grava no app) para "Sua Loja" ser
  determinístico, e depois um com empresa "Loja Teste E2E".
- **H:** a guia é conferida também pelo pixel (violeta `#7c4dff` em x = 200).
- **F/I:** amostra 8 pontos ao longo da linha tracejada e exige ≥ 1 com a cor; terços = âmbar `#ffb300`.

### Teste rodada 1 — reprovado

Aparelho: emulator-5554 (sdk_gphone64_x86_64). Base sincronizada `b35e837`; fix `6bf5b7f` (sha256 do APK no aparelho = APK da lane).
Evidencia: `C:\projects\sandbox\.bugfix-pipeline-product_photo_offline\evidencia\20261105-1840-task-13-zoom-pan-pinch-reguas-grade-e-simulador-preview-anuncio` (`base-task13.txt`, `fix-task13.txt`, prints em `base/` e `fix/`, APKs).

- Offline: `npx vitest run` 252/252, `npx tsc --noEmit` limpo, `build --bug` exit 0.
- Controle positivo (base): 5/19 — A/B/C falham (zoom 1,000x, o 1o dedo arrasta o retangulo, passo novo no undo), sem pilula, sem Preview, sem Grade/guia manual. (I na base abortou por folha aberta do passo H, nao chegou a amostrar o pixel.)
- **T2 (fix): 34/36 — FALHA pertinente no encaixe magnetico (criterio de aceite 3 e Tarefa `computeSnap(..., extra)`):**
  - F: arrastar o retangulo ate ~3 px de tela de x = 360 (W/3) com Grade "Regra dos tercos" ativa -> esperado `getBoundingRect().left` = 360 (tol 0,5); observado **373,03** (13 px do doc ~ 4,6 px de tela, dentro do limiar de 6 px de tela: o snap devia ter engatado).
  - H: guia manual vertical em 200 -> arrastar para perto -> esperado left = 200; observado **203,26**.
  - A grade e a guia aparecem na tela no lugar certo (pixels ambar/violeta conferidos), so o encaixe nao acontece. Verificar se `extraSnapTargets` chega ao `computeSnap` no `object:moving` real (toque) e se o candidato extra e comparado com a borda esquerda da caixa.
- Resto passou: pinca 3x ancorada sem mover o objeto nem gerar undo, pan, limites 0,5x/4x, reset pela pilula, exportacao a 200% identica (PNG/SVG, arquivo 1080x1080 pela galeria), Preview (Feed/Stories 9:16/Marketplace 170 px), zona segura em escala (bug lateral), traco a 200% sob o dedo, teclado mantem o fator, sem excecao JS.
- **Nao testado nesta rodada:** T3 vizinhos (`task03/11/12/14.mjs`) e T4 (logcat do PID) — interrompido por limite de uso apos a reprovacao da T2.

### Rodada 1 — reprovada: encaixe nos terços/guia manual não engatava (F: 373,03; H: 203,26); correção: `setCoords()` no `object:moving`

Causa (aberta na biblioteca): `node_modules/fabric/src/controls/drag.ts::dragHandler` faz `target.set(LEFT, ...)` e dispara
`object:moving` ali dentro; `canvas/Canvas.ts::_performTransformAction` (l.1376–1384) só chama `target.setCoords()` DEPOIS
do handler. `ObjectGeometry.ts::getBoundingRect` (l.345) usa o `aCoords` em cache → no handler do `Editor` a caixa era a
do evento anterior e o delta do snap era aplicado sobre a posição nova: o encaixe oscilava e não engatava (vale também para
o snapping da TASK-01). Correção: `editor-web/src/snapping.ts::snapMovingTarget` (novo; tipo estrutural `SnappableTarget`, sem importar o
Fabric) faz `target.setCoords()` antes de `getBoundingRect()`, chama `computeSnap` e aplica o delta; o `object:moving` do
`Editor` (construtor) passa a usá-lo.

Prova: `test/snapping.test.ts` "snapMovingTarget" com `Rect` real de `fabric/node` — controle (sem `setCoords` o
`getBoundingRect` continua o antigo) e arrasto em 14 passos com `left` absoluto (como o `dragHandler`) terminando em
360 (terços) e em 200 (guia manual). Mutação: tirando o `setCoords()` inicial, 3 casos falham; com ele, 16/16.
`npx vitest run`: 24 arquivos, 256 testes; `npx tsc --noEmit` limpo.

Achado no caminho (ajuste do Plano de teste, passos F e H do `task13.mjs`): parar o dedo a ~3 px de tela da linha
deixa a borda esquerda a 8,55 px do doc do alvo, e com o retângulo de 325 px a borda DIREITA fica a ~6,5 px do centro
da página (540) — o `computeSnap` escolhe corretamente o candidato mais próximo (o centro), então H falharia mesmo com
o snap certo. O roteiro agora para o dedo a ~1,5 px de tela (`360 + 1.5 / Z0`, `200 + 1.5 / Z0`): só o alvo do passo
fica dentro do limiar com folga.
