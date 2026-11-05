# [TASK-07] Efeitos Visuais Avançados, 16 Blend Modes, Duotone, Desfoque Localizado (Bokeh) e Refinamento de Recorte

## Metadados e Esforço Mensurado

| Campo | Valor |
| :--- | :--- |
| **ID** | `TASK-07` |
| **Prioridade** | **Média (P2)** |
| **Esforço Mensurado** | **Médio** — **~3 a 4 dias úteis (24h–32h / 8 Story Points)** |
| **Escopo** | 100% Local (`editor-web` em TypeScript / Canvas 2D `ImageData` & Fabric Filters) |
| **Referência Analisada (`com.desygner.ads`)** | `js_pretty/assets/module-create-DxNmnX1s.js` (L43300–L43600: `applyEffectsBrushEntry`, `applySpotBlur`, `applyMaskDensityFeather`, `sharpen`, `vignetteStrength`, `softEdge`, `fX` halftone, 16 blend modes) e `extracted/assets/public/docs/create.md` (L800–L870) |

### Detalhamento do Esforço por Subtarefa
1. **16 Modos de Mesclagem (`Blend Modes` / `globalCompositeOperation`) por Camada:** ~3h.
2. **Novos Filtros Fotográficos para Produto (`Duotone` com Brand Kit, `Nitidez / Sharpen` Unsharp Mask, `Temperatura / Warmth`, `Vinheta`, `Borda Suave / Soft Edge`, `Halftone`):** ~8h.
3. **Desfoque de Profundidade / Foco (`Spot Blur` Radial Bokeh e `Tilt-Shift` Linear):** ~6h.
4. **Pincel de Refinamento de Borda Pós-Remoção de Fundo (`refineEdges` — Restaurar / Apagar com Feather suave direto no Editor):** ~8h.
5. **Testes Unitários (Vitest) e Integração na UI (`main.ts`):** ~3h.

---

## 1. Contexto e Problema Atual

Na fotografia de produtos para e-commerce e anúncios:
1. **Falta de Nitidez (`Sharpen`) e Temperatura (`Warmth`):** Fotos tiradas com celular dentro de casa costumam ficar levemente amareladas/frias ou sem nitidez nos rótulos. Hoje [`showFilters()` em `main.ts` (L453–L484)](file:///c:/projects/sandbox/product_photo_offline/editor-web/src/main.ts#L453-L484) oferece apenas Brilho, Contraste, Saturação e Desfoque uniforme.
2. **Falta de Duotone e Modos de Mesclagem (`Blend Modes`):** Anúncios modernos usam fundos em *Duotone* com as cores da marca (para que o produto colorido salte aos olhos na frente) e camadas com modo `multiply` (para sombras realistas), `screen` (para feixes de luz/reflexos) ou `overlay` (para texturas).
3. **Falta de Desfoque de Profundidade (*Bokeh / Tilt-Shift*):** O desfoque atual borra a imagem inteira uniformemente. Um desfoque radial (*Spot Blur*) ou linear (*Tilt-Shift*) permite manter o centro/produto nítido enquanto desfoca suavemente as bordas do cenário.
4. **Retoque de Recorte (`refineEdges`):** Quando o usuário executa `✨ Remover fundo` (`ai.removeBg`), às vezes sobra um pequeno pedaço de fundo entre a alça de uma caneca ou uma ponta do produto é cortada demais. Hoje não há um pincel de **Restaurar / Apagar máscara com borda suave (*feather*)** para retocar esse recorte no próprio editor.

---

## 2. O que deve ser feito (Especificação Técnica Detalhada)

### 2.1. 16 Modos de Mesclagem (`Blend Modes`) para Qualquer Camada
No Fabric.js 7.4.0, todo `FabricObject` possui a propriedade `globalCompositeOperation: GlobalCompositeOperation`, que já é usada nativamente pelo `CanvasRenderingContext2D`:

1. **Lista de Modos Disponíveis (`BLEND_MODES`):**
   - `source-over` (`Normal`), `multiply` (`Multiplicar — ideal para sombras`), `screen` (`Tela — ideal para luzes/brilhos`), `overlay` (`Sobrepor`), `darken` (`Escurecer`), `lighten` (`Clarear`), `color-dodge` (`Subexposição de Cor`), `color-burn` (`Superexposição de Cor`), `hard-light` (`Luz Forte`), `soft-light` (`Luz Suave`), `difference` (`Diferença`), `exclusion` (`Exclusão`), `hue` (`Matiz`), `saturation` (`Saturação`), `color` (`Cor`), `luminosity` (`Luminosidade`).
2. **Exposição em `renderProps()` (`main.ts`):**
   - Ao lado do slider de `Opacidade` (comum a todas as camadas selecionáveis), adicionar o seletor compacto **`Mesclagem`** (`select('Mesclagem', BLEND_MODES, o.globalCompositeOperation || 'source-over', ...)`).
   - Adicionar `'globalCompositeOperation'` em `CUSTOM_PROPERTIES` ([`document.ts`](file:///c:/projects/sandbox/product_photo_offline/editor-web/src/document.ts)) caso o Fabric não o exporte por padrão em todas as subclasses.

### 2.2. Filtros Avançados de Produto (`imageFilters.ts`)
Criar filtros customizados ou composições de filtros do Fabric em [`editor-web/src/imageFilters.ts`](file:///c:/projects/sandbox/product_photo_offline/editor-web/src/imageFilters.ts), baseados nas rotinas de manipulação de `ImageData` de `module-create-DxNmnX1s.js` (L43360–L43580):

1. **Nitidez (`Sharpen` via Convolução 3×3 / Unsharp Mask):**
   - Slider `Nitidez` (`0` a `1`, passo `0.05`): aplica matriz de convolução parametrizada por $s \in [0, 1]$:
     $$K(s) = \begin{bmatrix} 0 & -s & 0 \\ -s & 1 + 4s & -s \\ 0 & -s & 0 \end{bmatrix}$$
     usando `filters.Convolute` do Fabric (ou kernel rápido em `ImageData`), realçando letras de embalagens e texturas de produtos!
2. **Temperatura (`Warmth` — Frio $\leftrightarrow$ Quente) e Matiz (`HueRotation`):**
   - Slider `Temperatura` (`-1` a `+1`): ajusta matriz de cor (`filters.ColorMatrix`) deslocando sutilmente os canais $R$ ($+0.15w$) e $B$ ($-0.15w$) para corrigir fotos amareladas ou dar tom aconchegante.
3. **Duotone com Brand Kit (`DuotoneFilter`):**
   - Converte a luminância de cada pixel $Y = 0.299R + 0.587G + 0.114B \in [0, 1]$ em uma interpolação linear entre `shadowColor` (cor escura, ex.: `brandKit.colors.primary`) e `highlightColor` (cor clara, ex.: `brandKit.colors.secondary` ou `#ffffff`):
     $$\text{RGB}_{\text{out}} = \text{lerp}(\text{shadowColor}, \text{highlightColor}, Y)$$
   - Oferecer chips de 1 toque na aba `Filtros`: **Duotone da Marca**, **Cyberpunk**, **Sépia Ouro**, **Azul Profundo**.
4. **Vinheta (`Vignette`) e Borda Esfumaçada (`Soft Edge`):**
   - `Vinheta` (`-1` a `+1`): escurece (ou clareia, se negativo) suavemente as bordas da imagem segundo uma função radial $d^2 = \left(\frac{x - cx}{rx}\right)^2 + \left(\frac{y - cy}{ry}\right)^2$.
   - `Borda Suave (Soft Edge)` (`0` a `1`): modula o canal Alpha ($\alpha$) próximo às bordas da imagem com decaimento suave `smoothstep`, ótimo para fundir fotos sem recorte no fundo do anúncio.

### 2.3. Desfoque de Foco (`Spot Blur` / `Tilt-Shift Bokeh`)
Inspirado em `applySpotBlur(ctx, width, height, entry)` (`module-create-DxNmnX1s.js` L43510):
1. Permite manter uma zona de foco nítida (centro `(focusX, focusY)` e raio `focusRadius` com faixa de transição `feather`) e aplicar desfoque Gaussiano gradual apenas fora dessa zona:
   - **Modo Radial (`Spot / Bokeh`):** foco circular sobre o produto, fundo ao redor desfocado;
   - **Modo Linear (`Tilt-Shift`):** faixa horizontal/diagonal em foco, topo e base desfocados (efeito lente macro profissional).

### 2.4. Pincel de Refinamento de Recorte (`refineEdges` — Restaurar / Apagar Fundo)
Inspirado em `refineEdges` + `applyMaskDensityFeather` (`module-create-DxNmnX1s.js` L43530):
1. **Armazenamento da Imagem Original Pré-Recorte:**
   - Quando [`aiRemoveBg(img)`](file:///c:/projects/sandbox/product_photo_offline/editor-web/src/main.ts#L488-L491) substitui a imagem pela versão sem fundo (`r.url`), guardar a URL da imagem original com fundo em `img.set('originalSrcBeforeCutout', originalSrc)` (`CUSTOM_PROPERTIES`).
2. **Modo Interativo `"🖌️ Retocar Recorte"` em `imageProps()`:**
   - Visível sempre que a imagem tiver transparência ou `originalSrcBeforeCutout`.
   - Ao entrar no modo, abre barra de ferramentas dedicada:
     - Alternador: **➖ Apagar sobra** (`erase` — pinta alfa `0`) vs. **➕ Restaurar original** (`restore` — copia os pixels de `originalSrcBeforeCutout` de volta para a imagem recortada!);
     - Slider **Tamanho do Pincel** (`5 px` a `120 px`);
     - Slider **Suavidade da Borda (Feather)** (`0%` a `100%` — usa gradiente radial no carimbo do pincel para não deixar borda serrilhada dura).
   - Ao tocar em **"Concluir"**, gera um novo blob/dataURL da imagem retocada, chama [`editor.replaceImage()`](file:///c:/projects/sandbox/product_photo_offline/editor-web/src/editor.ts#L555-L568) e grava no histórico (`editor.commit()`).

---

## 3. Arquivos a Criar / Modificar

| Arquivo | Ação | Descrição |
| :--- | :---: | :--- |
| [`editor-web/src/imageFilters.ts`](file:///c:/projects/sandbox/product_photo_offline/editor-web/src/imageFilters.ts) | **Criar** | Implementação dos filtros de `Sharpen`, `Warmth`, `Duotone`, `Vignette`, `SoftEdge`, `SpotBlur` (Radial/Tilt-Shift) e constantes dos 16 `BLEND_MODES`. |
| [`editor-web/src/refineCutout.ts`](file:///c:/projects/sandbox/product_photo_offline/editor-web/src/refineCutout.ts) | **Criar** | Motor de pincel com *feather* suave para apagar sobras de fundo (`destination-out`) ou restaurar pixels da imagem original (`source-over` mascarado por `originalSrcBeforeCutout`). |
| [`editor-web/src/document.ts`](file:///c:/projects/sandbox/product_photo_offline/editor-web/src/document.ts) | **Modificar** | Adicionar `'globalCompositeOperation'`, `'originalSrcBeforeCutout'`, `'duotoneColors'`, `'spotBlur'` em `CUSTOM_PROPERTIES`. |
| [`editor-web/src/editor.ts`](file:///c:/projects/sandbox/product_photo_offline/editor-web/src/editor.ts) | **Modificar** | Expandir `Adjustments` e `applyFilters()` para incluir `sharpen`, `warmth`, `vignette`, `softEdge`, `duotone` e `spotBlur`; integrar o modo de retoque de recorte. |
| [`editor-web/src/main.ts`](file:///c:/projects/sandbox/product_photo_offline/editor-web/src/main.ts) | **Modificar** | Adicionar seletor de `Mesclagem` em `renderProps()`, expandir `showFilters()` com `Nitidez`, `Temperatura`, `Vinheta`, `Duotone` e `Desfoque Bokeh`, e adicionar botão `"🖌️ Retocar recorte"` em `imageProps()` / pós-`aiRemoveBg`. |
| [`editor-web/test/imageFilters.test.ts`](file:///c:/projects/sandbox/product_photo_offline/editor-web/test/imageFilters.test.ts) | **Criar** | Testes unitários validando a transformação de pixels do Duotone, kernel de Sharpen, máscara radial de Vinheta/SpotBlur e restauração de pixels no `refineCutout`. |

---

## 4. Critérios de Aceite e Verificação

- [ ] Qualquer camada (texto, forma, selo ou imagem) possui seletor de **Modo de Mesclagem** com os 16 modos do Canvas 2D funcionando em tempo real e na exportação.
- [ ] A janela **Filtros** possui sliders funcionais para **Nitidez**, **Temperatura**, **Vinheta** e **Borda Suave**, além de presets de **Duotone** integrados com as cores do Brand Kit.
- [ ] O efeito **Desfoque de Foco (Bokeh / Tilt-Shift)** mantém o produto central nítido e desfoca gradualmente as bordas.
- [ ] Após remover o fundo de uma foto (`✨ Remover fundo`), o botão **"🖌️ Retocar recorte"** permite tanto apagar rebarbas quanto restaurar partes apagadas por engano com pincel de borda suave (*feather*).
- [ ] `npx vitest run` e `npm run build` passam sem erros.

---

## Planejamento (pipeline 20261105-1638, 2026-11-05)

**Veredito:** bloqueado — task grande demais para uma sessão de dev (estimativa ~1.650–1.900 linhas novas com testes e
E2E, acima do teto de ~1.500 do manual), com quatro funcionalidades independentes; proposta de divisão em 3 tasks
abaixo (o dono decide). A análise cobre as três: cada task nova pode copiar a sua parte deste registro.
**Complexidade:** alta — `editor-web` + Kotlin (`:editor`): o "Retocar recorte" precisa de mensagem nova na ponte
WebView ↔ Kotlin (Causa raiz, item 7); filtros próprios precisam de shader GLSL + caminho 2D.
**Severidade:** medio — funcionalidade nova P2; a ausência tem contorno (editar a foto fora do app) e não quebra nada
existente.
**Arquivos a alterar (reserva da onda):** nenhum nesta execução (bloqueado). A reserva de cada task proposta está em
"Proposta de divisão".

### Causa raiz (símbolos abertos: `arquivo::simbolo` — faz X; em erro, Y)

O plano do autor foi conferido contra o código e contra o Fabric 7.4.0 (`editor-web/node_modules/fabric/src`). O que
confere, o que está desatualizado e o que falta:

1. `editor-web/src/main.ts::renderProps` (L203–251) — monta o painel da camada; a linha comum de `Opacidade` (L248)
   vale para todo tipo (texto, imagem, forma, grupo, **ActiveSelection**). O seletor `Mesclagem` entra nessa linha, com
   o helper `dom.ts::select(label, options: [string, string][], value, onChange)` (L59). Em ActiveSelection o
   `editor.set` grava na seleção transitória (perde-se ao desselecionar): esconder o seletor quando
   `o instanceof ActiveSelection`.
2. **`globalCompositeOperation` NÃO precisa entrar em `CUSTOM_PROPERTIES`** (`document.ts` L76): o Fabric já o serializa
   (`fabric/src/shapes/Object/Object.ts`, `toObject`, L1791) e o aplica no render (`_setupCompositeOperation`, L1484).
   Export raster (`editor.ts::renderPage` / `toCanvasElement`) e vídeo (`video/VideoPreview.ts` desenha pelo próprio
   canvas do Fabric) herdam o modo. SVG: o export já grava a imagem sem filtro (comentário de `svgExport.ts` L1–3) e o
   Fabric não emite `mix-blend-mode` — limitação existente, fora do escopo.
3. `editor-web/src/editor.ts::applyFilters(img, preset, adj)` (L1230–1249) — reconstrói `img.filters` a cada mudança a
   partir de `Adjustments {brightness, contrast, saturation, blur}` (L77), chama `img.applyFilters()` e `commit()`.
   `main.ts::showFilters` (L995–1027) relê os valores de `img.filters` por `f.type` (`'Brightness'`…): cada filtro novo
   precisa de `type` estável e de leitura de volta ali (Convolute/ColorMatrix são genéricos: distinguir por uma
   propriedade própria, ex. guardar `adjustments` no objeto, ou pela ordem fixa da lista).
   - **Nitidez** = `filters.Convolute` nativo (GL + 2D; `Convolute.ts` L67/L79/L89) com o kernel K(s) da spec (soma 1).
   - **Temperatura** e **Duotone** = `filters.ColorMatrix` nativo (GL + 2D). O Duotone é linear em RGB:
     `out_c = s_c + (h_c − s_c)·(0.299R + 0.587G + 0.114B)` → linha c da matriz =
     `[(h_c−s_c)·0.299, (h_c−s_c)·0.587, (h_c−s_c)·0.114, 0, s_c]`, cores em 0..1 (o 2D do Fabric multiplica o offset
     por 255: `ColorMatrix.ts::applyTo2d` L85–87). Nenhum shader próprio para esses três.
   - **Vinheta**, **Borda Suave** e **Desfoque de foco (radial / tilt-shift)** dependem da posição do pixel: precisam
     de filtros PRÓPRIOS (subclasse de `filters.BaseFilter`) com os DOIS caminhos — `getFragmentSource()` (GLSL; usa
     `vTexCoord` do vertex shader base, `filters/shaders/baseFilter.ts`) e `applyTo2d()`.
4. **Backend de filtro do Fabric:** `filters/FilterBackend.ts::initFilterBackend` usa WebGL quando
   `config.enableGLFiltering` (padrão `true`, `config.ts` L69) e o probe aceita; o editor não troca o backend (grep de
   `setFilterBackend` em `src/`: nada). Em omissão: um filtro próprio sem `getFragmentSource` roda o
   `identityFragmentShader` (`BaseFilter.ts` L66) — **no aparelho não faz nada, calado**. No vitest (`fabric/node`) o
   probe é `NodeGLProbe.isSupported() → false` (backend 2D): o teste unitário passaria pelo motivo errado. Logo: shader
   + 2D, e a prova do shader é o E2E no aparelho.
5. **Revive de rascunho:** `shapes/Image.ts::fromObject` (L792) revive `filters` por
   `util/misc/objectEnlive.ts::enlivenObjects` → `classRegistry.getClass(type)` (L110), que LANÇA
   `No class registered for X` (`ClassRegistry.ts` L31) → a imagem e o `loadFromJSON` do rascunho falham. Todo filtro
   próprio precisa de `classRegistry.setClass(Classe)` no carregamento do módulo (antes de qualquer `loadDocument`).
6. `editor-web/src/main.ts::aiRemoveBg` (L1030–1033) — pede `ai.removeBg` com `src = editor.imageSrc(img)` e troca a
   imagem por `editor.replaceImage(img, r.url)`. É o ponto para gravar `originalSrcBeforeCutout` (só se ausente:
   recortar de novo não deve trocar o original pelo já recortado). `editor.ts::swapImage` (L1276) troca a foto e deve
   LIMPAR `originalSrcBeforeCutout`; `replaceImage` (L1256) preserva props próprias (`setSrc` não as toca). Upscale
   ×2/×4 (`aiUpscale`) muda o tamanho natural, e o Kotlin decodifica a entrada com lado ≤ 4096 (`EditorAssets.kt`
   `MAX_SIDE`), então o recorte pode ser menor que o original: o "restaurar" escala o original para o tamanho natural
   ATUAL da imagem.
7. **A saída do "Retocar recorte" não pode ser dataURL:** `EditorAssets.kt::resolve` (L69–79) só aceita
   `https://appassets.androidplatform.net/blob|assets/...`; para `data:` devolve null e `decode` lança
   `BridgeException(INVALID, "imagem fora do editor")` → toda ação de IA posterior na imagem retocada (remover fundo,
   objeto, texto, upscale) falharia, e o rascunho levaria o PNG em base64 no JSON. Não há mensagem JS → Kotlin que grave
   um blob (handlers: `EditorSession.kt` L90–96, `EditorHandlers.kt` L59–144). Precisa de uma nova, ex.
   `putImage {data: dataURL} → {url}`, por `EditorAssets.putBytes(EditorAssets.dataUrlBytes(data), "png", "edit")`
   (ambos existem, `EditorAssets.kt` L41 e L102). Blobs ficam em `filesDir/editor/blobs` sem limpeza →
   `originalSrcBeforeCutout` (uma URL `/blob/…`) continua válida ao reabrir o rascunho.
8. `editor.ts::startMask/endMask` (L1321–1366) — o pincel atual (PencilBrush, traços rasterizados no fim) mapeia
   página → pixels da imagem por `invertTransform(calcTransformMatrix)` + `cropX/cropY`: o mesmo mapeamento serve ao
   pincel de retoque. Para pintar, usar o elemento ORIGINAL (`img._originalElement`), não `getElement()`, que devolve o
   elemento JÁ filtrado (`Image.ts` L227/L539); ao concluir, `replaceImage` reaplica os filtros (L1265).

### Provas (comando literal -> resultado)
- `grep -n "globalCompositeOperation" node_modules/fabric/src/shapes/Object/Object.ts` -> L201 (declare), L1484
  (aplica no ctx), L1791 (no `toObject`).
- `grep -n "enableGLFiltering" node_modules/fabric/src/config.ts` -> `69: enableGLFiltering = true;`.
- `grep -rn "filterBackend\|setFilterBackend" editor-web/src` -> nada (backend padrão: WebGL no WebView).
- `sed -n 8,15p node_modules/fabric/src/filters/GLProbes/NodeGLProbe.ts` -> `isSupported() { return false; }`.
- `sed -n 31,37p node_modules/fabric/src/ClassRegistry.ts` -> `throw new FabricError("No class registered for ...")`.
- `ls editor-web/node_modules | grep -E "^(canvas|jsdom)$"` -> `canvas`, `jsdom` (vitest roda o Fabric com node-canvas).
- `git show --stat 0d616c3` -> TASK-12 (5 SP) ≈ 1.200 linhas com E2E (`gradients.ts` 126, `connectors.ts` 140, teste
  168, `task12.mjs` 227, mais editor/main): base da estimativa abaixo.

### Hipóteses descartadas (e por quê)
- "Adicionar `globalCompositeOperation` em `CUSTOM_PROPERTIES`" — desnecessário (já serializado, item 2).
- "Duotone/Temperatura como filtro próprio" — são lineares em RGB: o `ColorMatrix` nativo cobre, com GL e 2D.
- "Filtros próprios só com `applyTo2d`" — no WebView rodam o shader identidade (item 4): vitest verde e app sem efeito.
- "Trocar o backend global para Canvas2D" (simplificaria os filtros próprios) — descartado: todo filtro existente
  (Desfoque inclusive) passaria a varrer `ImageData` na CPU a cada movimento de slider, em fotos de até 4096 px.
- "Concluir o retoque com dataURL em `replaceImage`" (como a spec sugere) — quebra as ações de IA seguintes e infla o
  rascunho (item 7).

### Estimativa de tamanho (motivo do bloqueio)
| Parte | Linhas novas (código + teste + E2E) |
|---|---|
| Mesclagem (`BLEND_MODES`, seletor) | ~40 + teste ~20 + E2E ~60 |
| Nitidez, Temperatura, Duotone (+ presets da marca) | ~150 + teste ~90 + E2E ~90 |
| Vinheta, Borda Suave, Desfoque de foco (3 filtros GL+2D, registro, UI de foco/raio/modo) | ~380 + teste ~150 + E2E ~110 |
| Retocar recorte (`refineCutout.ts`, modo no editor, barra, `putImage` Kotlin + protocolo) | ~380 + teste ~120 + E2E ~130 |
| **Total** | **~1.720** (faixa 1.650–1.900) |

### Proposta de divisão (o dono decide; cada uma cabe numa sessão)
- **TASK-07a — Mesclagem + Nitidez + Temperatura + Duotone** (só filtros nativos do Fabric). Complexidade média;
  reserva: `editor-web/src/imageFilters.ts` (novo: `BLEND_MODES`, `sharpenKernel(s)`, `warmthMatrix(w)`,
  `duotoneMatrix(shadow, highlight)`, presets), `editor-web/src/editor.ts` (`Adjustments`, `applyFilters`),
  `editor-web/src/main.ts` (`renderProps`, `showFilters`), `editor-web/test/imageFilters.test.ts`,
  `tools/e2e/task07.mjs`, `editor/src/main/assets/editor/index.html`. Prova: vitest (a matriz do duotone leva
  preto → sombra e branco → destaque; o kernel soma 1; `toObject` com `globalCompositeOperation: 'multiply'` volta igual)
  + E2E (camada em "Multiplicar" sobre fundo colorido → pixel da página ≠ "Normal"; Duotone → pixel claro/escuro da foto
  vira as duas cores do brand kit). Dev effort medium; teste medium.
- **TASK-07b — Vinheta + Borda Suave + Desfoque de foco (radial / tilt-shift)**: 3 subclasses de `filters.BaseFilter`
  com GLSL + `applyTo2d` + `classRegistry.setClass`, sliders e controle do foco. Complexidade média; reserva:
  `editor-web/src/imageFilters.ts` (ou `focusFilters.ts` novo), `editor.ts`, `main.ts`, teste, E2E, bundle. Depende da
  07a (mesmos arquivos). Prova: vitest no 2D (canto mais escuro que o centro; alfa da borda < 255; centro do foco igual
  ao original e canto borrado; rascunho salvo com o filtro → `loadFromJSON` revive) + E2E no aparelho lendo pixels do
  canvas (única prova do caminho WebGL). Dev effort high + ultrathink (shader); teste high.
- **TASK-07c — Retocar recorte**: `editor-web/src/refineCutout.ts` (novo), `editor.ts` (modo de retoque,
  `originalSrcBeforeCutout` limpo em `swapImage`), `main.ts` (`aiRemoveBg`, `imageProps`, barra Apagar/Restaurar/
  Tamanho/Suavidade/Concluir), `document.ts` (`originalSrcBeforeCutout` em `CUSTOM_PROPERTIES`),
  `editor-web/src/protocol.ts` (tipo do `putImage`), `editor/src/main/kotlin/com/productphoto/editor/EditorSession.kt`
  (handler `putImage`), teste Kotlin em `editor/src/test/kotlin/com/productphoto/editor/`, teste vitest, E2E, bundle.
  Complexidade alta (ponte). Prova: vitest (carimbo com feather: centro α=0 no apagar, borda intermediária; restaurar
  copia o pixel do original escalado) + E2E: foto → ✨ Remover fundo → 🖌️ Retocar → Restaurar num ponto do fundo →
  Concluir → o pixel volta a α=255 com a cor original; a nova `src` é `/blob/edit-…`; Desfazer volta ao recorte;
  ✨ Melhorar resolução depois do retoque não dá "imagem fora do editor". Dev effort high + ultrathink; teste medium.

### Tarefas
- [ ] Dono: aprovar a divisão (ou outra) e criar as tasks 07a/07b/07c em `docs/tasks/open/` (e na matriz do README);
  esta TASK-07 vira o índice das três. Nenhum código nesta execução.

### Plano de teste
- **Offline (sem slot):** por task proposta, o vitest descrito acima (`npx vitest run test/imageFilters.test.ts`;
  backend 2D do Fabric em node) e `npx tsc --noEmit`.
- **T2 reprodução como o usuário (E2E, no slot):** por task, pelo driver `tools/e2e/cdp.mjs` (`launchEditor`, foto
  inserida como em `task11.mjs` L14, `tap` nos botões do painel, `evaluate` lendo `img.filters` e pixels de
  `editor.renderPageCanvas()`), prints por `screencap`. Os sinais objetivos estão em cada task acima.
- **Controle positivo:** na base a funcionalidade está ausente: o painel da camada não tem `Mesclagem`, a folha
  `Filtros` só tem Brilho/Contraste/Saturação/Desfoque (`main.ts` L1019–1024) e `imageProps` não tem
  "🖌️ Retocar recorte" (L970–993): `uiFind('Mesclagem')`, `uiFind('Nitidez')`, `uiFind('Retocar recorte')` → nada.
- **T3 regressão direcionada:** `task11.mjs` (substituir foto mantém filtros; agrupar), `task12.mjs` (painel de forma e
  opacidade), `task03.mjs` (conta-gotas lê pixels da página) e abrir um rascunho antigo com filtros (revive).

### Sessões seguintes
- dev: — (bloqueado; nas tasks divididas: 07a medium; 07b high + ultrathink; 07c high + ultrathink).
- teste: — (nas divididas: 07a medium; 07b high, a prova do shader é só no aparelho; 07c medium).

