# [TASK-18] Retocar Recorte depois de Remover o Fundo (Pincel Apagar / Restaurar com Borda Suave)

> **Origem:** dividida da TASK-07 pelo dono em 2026-11-05 (§2.4 original "Pincel de Refinamento de Recorte"; a "07c"
> do planning). A TASK-07 ficou com mesclagem + Nitidez/Temperatura/Duotone e a
> [TASK-17](17-vinheta-borda-suave-e-desfoque-de-foco.md) com vinheta, borda suave e desfoque de foco.
> **Independente** das duas. Doc original:
> `git show cbf5f41:docs/tasks/open/07-filtros-efeitos-avancados-blend-modes-e-retoque-borda.md`.

## Metadados e Esforço Mensurado

| Campo | Valor |
| :--- | :--- |
| **ID** | `TASK-18` |
| **Prioridade** | **Média (P2)** |
| **Esforço Mensurado** | **Médio** — **~1,5 dia útil (10h–12h / 3 Story Points)**; ~630 linhas novas estimadas (código + teste + E2E) |
| **Escopo** | Local: `editor-web` (TypeScript) + `:editor` (Kotlin: mensagem nova na ponte) |
| **Referência Analisada (`com.desygner.ads`)** | `js_pretty/assets/module-create-DxNmnX1s.js` (L43530: `refineEdges`, `applyMaskDensityFeather`) — só referência de algoritmo |

### Detalhamento do Esforço por Subtarefa
1. **Motor de pincel com *feather* (`refineCutout.ts`) e modo de retoque no editor:** ~6h.
2. **Mensagem `putImage` na ponte (Kotlin + protocolo) para gravar o resultado como blob:** ~2h.
3. **Testes (vitest + Kotlin), E2E e UI:** ~2h–3h.

---

## 1. Contexto e Problema Atual

Quando o usuário executa `✨ Remover fundo` (`ai.removeBg`), às vezes sobra um pequeno pedaço de fundo entre a alça de
uma caneca ou uma ponta do produto é cortada demais. Hoje não há um pincel de **Restaurar / Apagar com borda suave
(*feather*)** para retocar esse recorte no próprio editor.

---

## 2. O que deve ser feito (Especificação Técnica Detalhada)

### 2.1. Pincel de Refinamento de Recorte (`refineEdges` — Restaurar / Apagar Fundo)
1. **Armazenamento da Imagem Original Pré-Recorte:**
   - Quando `aiRemoveBg(img)` substitui a imagem pela versão sem fundo, guardar a URL da imagem original com fundo em
     `img.set('originalSrcBeforeCutout', originalSrc)` (`CUSTOM_PROPERTIES`), só se ainda não houver (recortar de novo
     não troca o original pelo já recortado). O "🔄 Substituir" (`swapImage`) limpa a propriedade.
2. **Modo Interativo `"🖌️ Retocar Recorte"` em `imageProps()`:**
   - Visível sempre que a imagem tiver `originalSrcBeforeCutout` (ou transparência).
   - Barra de ferramentas dedicada:
     - Alternador: **➖ Apagar sobra** (`erase` — pinta alfa `0`) vs. **➕ Restaurar original** (`restore` — copia os
       pixels de `originalSrcBeforeCutout` de volta para a imagem recortada);
     - Slider **Tamanho do Pincel** (`5 px` a `120 px`);
     - Slider **Suavidade da Borda (Feather)** (`0%` a `100%` — gradiente radial no carimbo do pincel).
   - Ao tocar em **"Concluir"**, grava a imagem retocada como **blob do editor** (mensagem nova `putImage`, não
     dataURL — ver "Análise herdada"), chama `editor.replaceImage()` e grava no histórico (1 undo).

---

## 3. Arquivos a Criar / Modificar

| Arquivo | Ação | Descrição |
| :--- | :---: | :--- |
| `editor-web/src/refineCutout.ts` | **Criar** | Carimbo do pincel com *feather*; apagar (`destination-out`) e restaurar (original escalado, mascarado pelo carimbo). |
| `editor-web/src/editor.ts` | **Modificar** | Modo de retoque (mapeamento página → pixels como `startMask`), `originalSrcBeforeCutout` limpo em `swapImage`. |
| `editor-web/src/main.ts` | **Modificar** | `aiRemoveBg` grava o original; `imageProps` ganha `🖌️ Retocar recorte`; barra Apagar/Restaurar/Tamanho/Suavidade/Concluir. |
| `editor-web/src/document.ts` | **Modificar** | `'originalSrcBeforeCutout'` em `CUSTOM_PROPERTIES`. |
| `editor-web/src/protocol.ts` | **Modificar** | Tipo da mensagem `putImage {data} → {url}`. |
| `editor/src/main/kotlin/com/productphoto/editor/EditorSession.kt` | **Modificar** | Handler `putImage` (`EditorAssets.putBytes(EditorAssets.dataUrlBytes(data), "png", "edit")`). |
| `editor/src/test/kotlin/com/productphoto/editor/` | **Modificar / Criar** | Teste Kotlin do `putImage`. |
| `editor-web/test/refineCutout.test.ts` | **Criar** | Carimbo, apagar e restaurar. |
| `tools/e2e/task18.mjs` | **Criar** | E2E no aparelho (Plano de teste abaixo). |
| `editor/src/main/assets/editor/index.html` | **Regerar** | Bundle do editor. |

---

## 4. Critérios de Aceite e Verificação

- [ ] Após remover o fundo de uma foto (`✨ Remover fundo`), o botão **"🖌️ Retocar recorte"** permite tanto apagar
  rebarbas quanto restaurar partes apagadas por engano com pincel de borda suave (*feather*).
- [ ] "Concluir" grava o resultado como imagem do editor (`/blob/...`), ↶ volta ao recorte anterior, e as ações de IA
  seguintes (remover fundo, melhorar resolução) funcionam na imagem retocada.
- [ ] O retoque sobrevive a salvar e reabrir o rascunho.
- [ ] `npx vitest run`, `npm run build` e os testes Kotlin do `:editor` passam sem erros.

---

## Análise herdada — planning 20261105-1638 da TASK-07 (antes da divisão)

**Veredito daquele planning:** bloqueado por tamanho (TASK-07 inteira); esta parte foi separada pelo dono em
2026-11-05. O próximo planning confere a análise contra a base (as linhas são da base `0d616c3`) em vez de refazê-la.
**Complexidade estimada:** alta — ponte WebView ↔ Kotlin (mensagem nova) além do pincel.
**Reserva prevista:** `editor-web/src/refineCutout.ts` (novo), `editor-web/src/editor.ts`, `editor-web/src/main.ts`,
`editor-web/src/document.ts`, `editor-web/src/protocol.ts`,
`editor/src/main/kotlin/com/productphoto/editor/EditorSession.kt`, teste Kotlin em
`editor/src/test/kotlin/com/productphoto/editor/`, teste vitest, `tools/e2e/task18.mjs` (novo), bundle.

### Estado atual (símbolos abertos: `arquivo::simbolo` — faz X; em erro, Y)
1. `editor-web/src/main.ts::aiRemoveBg` (L1030–1033) — pede `ai.removeBg` com `src = editor.imageSrc(img)` e troca a
   imagem por `editor.replaceImage(img, r.url)`. É o ponto para gravar `originalSrcBeforeCutout` (só se ausente).
   `editor.ts::swapImage` (L1276) troca a foto e deve LIMPAR `originalSrcBeforeCutout`; `replaceImage` (L1256)
   preserva props próprias (`setSrc` não as toca). Upscale ×2/×4 (`aiUpscale`) muda o tamanho natural, e o Kotlin
   decodifica a entrada com lado ≤ 4096 (`EditorAssets.kt` `MAX_SIDE`), então o recorte pode ser menor que o original:
   o "restaurar" escala o original para o tamanho natural ATUAL da imagem.
2. **A saída do "Retocar recorte" não pode ser dataURL:** `EditorAssets.kt::resolve` (L69–79) só aceita
   `https://appassets.androidplatform.net/blob|assets/...`; para `data:` devolve null e `decode` lança
   `BridgeException(INVALID, "imagem fora do editor")` → toda ação de IA posterior na imagem retocada (remover fundo,
   objeto, texto, upscale) falharia, e o rascunho levaria o PNG em base64 no JSON. Não há mensagem JS → Kotlin que
   grave um blob (handlers: `EditorSession.kt` L90–96, `EditorHandlers.kt` L59–144). Precisa de uma nova, ex.
   `putImage {data: dataURL} → {url}`, por `EditorAssets.putBytes(EditorAssets.dataUrlBytes(data), "png", "edit")`
   (ambos existem, `EditorAssets.kt` L41 e L102). Blobs ficam em `filesDir/editor/blobs` sem limpeza →
   `originalSrcBeforeCutout` (uma URL `/blob/…`) continua válida ao reabrir o rascunho.
3. `editor.ts::startMask/endMask` (L1321–1366) — o pincel atual (PencilBrush, traços rasterizados no fim) mapeia
   página → pixels da imagem por `invertTransform(calcTransformMatrix)` + `cropX/cropY`: o mesmo mapeamento serve ao
   pincel de retoque. Para pintar, usar o elemento ORIGINAL (`img._originalElement`), não `getElement()`, que devolve o
   elemento JÁ filtrado (`Image.ts` L227/L539); ao concluir, `replaceImage` reaplica os filtros (L1265).

### Provas
- Estimativa do planning: `refineCutout.ts`, modo no editor, barra, `putImage` Kotlin + protocolo ~380 + teste ~120 +
  E2E ~130 ≈ **~630**.

### Hipóteses descartadas (e por quê)
- "Concluir o retoque com dataURL em `replaceImage`" (como a spec original sugeria) — quebra as ações de IA seguintes
  e infla o rascunho (item 2).

### Tarefas
- [ ] `editor-web/src/refineCutout.ts` (novo) — carimbo com feather, apagar e restaurar — vitest: centro α=0 no
  apagar, borda intermediária; restaurar copia o pixel do original escalado.
- [ ] `putImage` — `protocol.ts` + handler em `EditorSession.kt` — teste Kotlin: dataURL PNG → URL `/blob/edit-…`
  que o `EditorAssets.resolve` aceita; dataURL inválido → `BridgeException(INVALID)`.
- [ ] `editor.ts` / `main.ts` / `document.ts` — `originalSrcBeforeCutout` (gravado no `aiRemoveBg`, limpo no
  `swapImage`), botão `🖌️ Retocar recorte`, barra e Concluir (1 undo).
- [ ] `tools/e2e/task18.mjs` — a T2 abaixo.

### Plano de teste
- **Offline (sem slot):** `npx tsc --noEmit`, `npx vitest run` e o teste Kotlin do `:editor`.
- **T2 reprodução como o usuário (E2E, no slot):** foto → ✨ Remover fundo → 🖌️ Retocar → Restaurar num ponto do fundo
  → Concluir → o pixel volta a α=255 com a cor original; a nova `src` é `/blob/edit-…`; Desfazer volta ao recorte;
  ✨ Melhorar resolução depois do retoque não dá "imagem fora do editor"; prints do aparelho.
- **Controle positivo:** na base `imageProps` não tem "🖌️ Retocar recorte" (L970–993): `uiFind('Retocar recorte')` → nada.
- **T3 regressão direcionada:** `task11.mjs` (substituir foto), as ações de IA na imagem (remover fundo, upscale) e
  abrir um rascunho antigo.

### Sessões seguintes (sugestão daquele planning)
- dev: effort high + ultrathink.
- teste: effort medium.

---

## Planejamento (pipeline 20261106-0749, 2026-11-06)

**Veredito:** corrigir — a análise herdada confere com a base `80b97d7`; o modo de retoque cabe no `editor-web` + uma
mensagem `putImage` no `:editor`, ~725 linhas, 1 módulo Gradle (`:editor`; `editor-web` não é Gradle).
**Complexidade:** alta — ponte WebView ↔ Kotlin (mensagem nova) + dado novo no documento (`originalSrcBeforeCutout`).
**Severidade:** medio — funcionalidade ausente com contorno (refazer o recorte ou editar fora do app); não quebra nada.
**Arquivos a alterar (reserva da onda):**
- `editor-web/src/refineCutout.ts` (novo) — funções PURAS sobre `Uint8ClampedArray` RGBA: alfa do carimbo com feather,
  pontos do traço espaçados, aplicar apagar/restaurar numa janela (bbox) do buffer.
- `editor-web/src/editor.ts` — modo de retoque (`startRefine`/traço/`endRefine`), guardas de histórico/página,
  `swapImage` limpa `originalSrcBeforeCutout`.
- `editor-web/src/main.ts` — `aiRemoveBg` grava o original; `imageProps` ganha `🖌️ Retocar recorte`; barra do modo;
  guardas como as do `maskImage`.
- `editor-web/src/document.ts` — `'originalSrcBeforeCutout'` em `CUSTOM_PROPERTIES`.
- `editor-web/src/protocol.ts` — `PutImagePayload {data}` / `PutImageResult {url}`.
- `editor-web/src/styles.css` — só se a barra precisar de classe nova (ex.: alternador ativo); senão fica intocado.
- `editor-web/test/refineCutout.test.ts` (novo).
- `editor/src/main/kotlin/com/productphoto/editor/EditorAssets.kt` — helper puro `pngFromDataUrl` (Causa raiz 5).
- `editor/src/main/kotlin/com/productphoto/editor/EditorSession.kt` — `handle("putImage")`.
- `editor/src/test/kotlin/com/productphoto/editor/EditorAssetsTest.kt` (novo).
- `tools/e2e/task18.mjs` (novo).
- `editor/src/main/assets/editor/index.html` — bundle regerado (mais os `assets/index-<hash>.*` por `claim` no dev).

### Causa raiz (símbolos abertos: `arquivo::simbolo` — faz X; em erro, Y)
Item é TASK: "sintoma" = a funcionalidade ausente. Conferência da análise herdada contra `80b97d7` (linhas atuais):
1. `editor-web/src/main.ts::imageProps` (L1049–1072) — linhas `Substituir/Filtros/Recortar/Usar como fundo` e a de IA
   (`✨ Remover fundo/objeto/texto/Vetorizar/Melhorar resolução`). **Não há** "Retocar recorte" (controle positivo).
2. `main.ts::aiRemoveBg` (L1109–1112) — `bridge.request('ai.removeBg', {src: editor.imageSrc(img)})` →
   `editor.replaceImage(img, r.url)`; em erro o `run` (L118–132) faz `toast(describe(e))` e devolve `undefined` (a imagem
   fica como estava). Ponto de gravar `originalSrcBeforeCutout = editor.imageSrc(img)` (lido ANTES do pedido) só
   `if (!img.get('originalSrcBeforeCutout'))`, antes do `replaceImage`.
3. `editor.ts::imageSrc` (L1912) = `img.getSrc(false)` → Fabric `Image.getSrc` (`node_modules/fabric/src/shapes/Image.ts`
   L442–458) lê `_originalElement`: se for **canvas** devolve `toDataURL()`; se for `<img>`, o `src`. `toObject` usa o
   mesmo `getSrc()` (Image.ts L345). Consequência: o modo NÃO pode pôr o canvas de trabalho em `_originalElement`
   (`setElement`) — qualquer `flush`/`pagehide`/autosave durante o modo gravaria PNG base64 no rascunho e a `src` deixaria
   de ser `/blob/`. Pôr o canvas só em `img._element` (`declare _element`, Image.ts L180) dá a prévia ao vivo e a
   serialização continua com a URL anterior (retoque em curso não é salvo; se o app morrer no meio, perde-se o retoque —
   aceitável). Cancelar: `img.applyFilters()` (Image.ts L530–541: sem filtros faz `_element = _originalElement`; com
   filtros refaz do original) devolve a imagem. `getOriginalSize()` (L297) lê `_element`; o canvas de trabalho tem o
   tamanho natural, então o `replaceImage` do Concluir calcula fator 1.
4. `editor.ts::replaceImage` (L1942–1956) — guarda filtros/geometria, `setSrc`, reescala, reaplica filtros, `commit()`
   (→ `scheduleSnapshot` L529–535, debounce 250 ms) = **1 passo de undo**; não toca props próprias (preserva
   `originalSrcBeforeCutout`). `swapImage` (L1961–1977) faz `img.set({...keep, brandLogo, filterPreset})` (L1970) —
   acrescentar `originalSrcBeforeCutout: undefined` ali.
5. `editor/.../EditorAssets.kt` — `resolve` (L69–80) só aceita `https://appassets.androidplatform.net/blob|assets/…`
   (`data:` → null → `decode` lança `BridgeException(INVALID,"imagem fora do editor")`): confirma que o Concluir precisa
   gravar blob. `putBytes(bytes, ext, prefix)` (L41) existe; nome `edit-<uuid>.png` casa com `NAME`
   (`^[a-z]+-[0-9a-f-]{36}\.[a-z0-9]{2,5}$`). `dataUrlBytes` (L102) usa `android.util.Base64`; o `:editor` roda testes JVM
   com `unitTests.isReturnDefaultValues = true` (`editor/build.gradle.kts` L20) → ali `Base64.decode` devolve **null**:
   o caminho do data URL não dá para testar em JVM com `dataUrlBytes`. Por isso: helper novo puro
   `EditorAssets.pngFromDataUrl(dataUrl): ByteArray` (companion) com `java.util.Base64.getDecoder()` (minSdk 28 ≥ 26),
   exige prefixo `data:image/png;base64,` e a assinatura PNG (`89 50 4E 47 0D 0A 1A 0A`), senão
   `BridgeException(ErrorCode.INVALID, …)` (também para base64 inválido: `IllegalArgumentException` → INVALID).
6. `EditorSession.kt` init (L91–100) — `handle("saveDraft"|"pickImage"|…|"export")`; tipo sem handler cai em
   `EditorBridge.kt` L178 → `UNSUPPORTED "no handler for …"`. `putImage` entra ali:
   `handle("putImage") { p, _ -> val name = assets.putBytes(EditorAssets.pngFromDataUrl(p.obj().str("data")), "png", "edit"); buildJsonObject { put("url", assets.blobUrl(name)) } }`
   (`obj()`/`str()` são os mesmos helpers usados em `EditorHandlers.kt` L60/L68; conferir o import no `EditorSession`).
7. `editor.ts::startMask/endMask` (L2007–2050) — `PencilBrush` + `isDrawingMode`; `path:created` (L223–233) guarda os
   traços em `maskPaths`; `endMask` mapeia página → pixels por
   `multiplyTransformMatrices([1,0,0,1,img.width/2+img.cropX,img.height/2+img.cropY], invertTransform(img.calcTransformMatrix()))`.
   `maskPaths != null` bloqueia `scheduleSnapshot` (L530), `flushPending` (L2195) e as operações de página
   (L637/653/688/719/835); `startFreehandDraw` recusa (L2059). Em `main.ts` o `maskImage` faz `renderProps` mostrar a
   barra da máscara (L262) e recusa desenho/página/lote (L904, L1198, L1271). O retoque precisa das mesmas guardas.
   `undo()/redo()` (L546–547) NÃO têm guarda hoje: com o retoque aberto o `restore` recarregaria o JSON e o estado do modo
   apontaria para um objeto morto → o retoque tem de recusar (ou cancelar antes) o undo/redo.
8. Fabric `Canvas` em modo desenho ainda dispara `mouse:down/move/up` (`node_modules/fabric/src/canvas/Canvas.ts`
   L988/L1006/L1024 `_handleEvent`): dá para coletar os `scenePoint` do traço; o `PencilBrush` serve de rastro visual
   e bloqueia seleção/arrasto.
9. `core/imaging/.../LocalSceneComposer.kt::cutout` (L56–64) — o recorte = imagem decodificada (lado ≤ 4096,
   `EditorAssets.MAX_SIDE`) com alfa da máscara; o PNG passa por `Bitmap` (pré-multiplicado) → pixels α=0 tendem a sair
   com RGB 0. Logo "restaurar" tem de copiar a COR do original, não só subir o alfa; e o original (até 8000 px no editor)
   é escalado para o tamanho natural ATUAL do recorte (cobre também o upscale ×2/×4 posterior).

### Provas (comando literal -> resultado)
- `git -C <wt-planning> log -1 --format=%H` → `80b97d7f5958758c0e19367b2b47e055bc8d5cb0` (base conferida).
- `grep -n "Retocar\|originalSrcBeforeCutout\|putImage" editor-web/src/*.ts editor/src/main/kotlin/com/productphoto/editor/*.kt`
  → nada (funcionalidade ausente).
- `grep -n "isReturnDefaultValues" editor/build.gradle.kts` → `20: testOptions { unitTests.isReturnDefaultValues = true }`.
- `grep -n "environment" editor-web/vite.config.ts` → `21: environment: 'node'` (vitest sem canvas/DOM: a lógica de
  pixels tem de ser pura sobre arrays para ter teste).
- `grep -n "_handleEvent" node_modules/fabric/src/canvas/Canvas.ts` → L988/1006/1024: eventos de ponteiro em modo desenho.
- `grep -rn "removeBg\|Remover fundo" tools/e2e/` → nada: nenhum E2E usa o remover fundo ainda; e as fotos dos E2E
  existentes são `data:` (ex.: `task11.mjs` L11–14), que o `ai.removeBg` recusa → o `task18.mjs` usa asset do APK.
- Estimativa: `refineCutout.ts` ~140, `editor.ts` ~130, `main.ts` ~90, `protocol.ts` ~10, Kotlin ~35, vitest ~130,
  teste Kotlin ~40, E2E ~150 ≈ **~725 linhas** (< 1.500; 1 módulo Gradle) → cabe numa sessão.

### Hipóteses descartadas (e por quê)
- **Concluir com dataURL no `replaceImage`** (spec original) — quebra as ações de IA seguintes (item 5) e infla o rascunho.
- **Prévia ao vivo com `img.setElement(canvas)`** — `setElement` troca `_originalElement` e `_setWidthHeight` (Image.ts
  L687–691) reseta `width/height` (perde o recorte `cropX/width`); e `getSrc`/`toObject` passariam a devolver dataURL
  (item 3).
- **Rasterizar os traços do `PencilBrush` com `ctx.filter = 'blur()'` para o feather** — não é testável no vitest
  (`environment: 'node'`, sem canvas) e depende do WebView; o carimbo radial puro é determinístico e testável.
- **`putImage` re-decodificando com `decodeBytes` + `putPng`** — redimensiona acima de 4096 e recomprime à toa; basta
  validar a assinatura PNG e gravar os bytes (`putBytes`).
- **Testar o `putImage` em JVM via `dataUrlBytes`** — `android.util.Base64` vira stub que devolve null (item 5).
- **TASK-18 depender da TASK-07/17** — a TASK-07 mexe em `imageFilters`/`showFilters`; o retoque só usa o
  `applyFilters()` do Fabric. Sem `depende_de`; a sobreposição em `main.ts`/`editor.ts`/bundle já separa as ondas.

### Tarefas
- [ ] `editor-web/src/refineCutout.ts` (novo) — `featherAlpha(d, r, feather)` (1 até `r·(1−feather)`, smoothstep até 0
  em `r`); `strokeStamps(points, spacing)` (pontos a cada ~`r/4`, inclui o 1º e o último); `applyStamp(buf, w, h,
  orig|null, cx, cy, r, feather, mode)` sobre `Uint8ClampedArray` RGBA não pré-multiplicado: `erase` α←α·(1−s);
  `restore` α'=α+(α_o−α)·s, rgb'=(rgb·α·(1−s)+rgb_o·α_o·s)/α' (α'=0 → rgb do original). Janela = bbox clampado.
  — vitest `refineCutout.test.ts`: centro do apagar α=0, borda com feather 0,5 intermediária (0<α<255), fora do raio
  intocado; feather 0 = degrau; restaurar no centro = pixel do original exato (α e cor), inclusive sobre α=0 com RGB 0;
  traço de 2 pontos distantes gera carimbos contínuos; carimbo na borda da imagem não estoura índice.
- [ ] `editor-web/src/document.ts::CUSTOM_PROPERTIES` — `'originalSrcBeforeCutout'` — vitest: `toContain` + ida/volta
  `toObject`/`fromObject` de uma FabricImage com a prop (molde: `groupAndSwap.test.ts`, que já importa `fabric/node`).
- [ ] `editor-web/src/protocol.ts` — `PutImagePayload {data: string}`, `PutImageResult {url: string}`.
- [ ] `editor/.../EditorAssets.kt::pngFromDataUrl` + `EditorSession.kt` `handle("putImage")` — JVM
  `EditorAssetsTest.kt`: data URL de um PNG mínimo (bytes literais em base64) → bytes com a assinatura;
  `data:image/jpeg;…`, sem `;base64`, base64 inválido e bytes não-PNG → `BridgeException` com `ErrorCode.INVALID`.
- [ ] `editor-web/src/editor.ts` — estado `refine: {img, work: HTMLCanvasElement, orig: ImageData|null, points, mode,
  size, feather, strokes} | null`:
  - `startRefine(img, origSrc?)`: `discardActiveObject`; canvas de trabalho no tamanho natural de `img._originalElement`
    com `getContext('2d', {willReadFrequently: true})`, desenha o `_originalElement` (SEM filtros); com `origSrc`,
    `util.loadImage` e desenha ESCALADO para o mesmo tamanho → `orig` (falha ao carregar → `orig = null`, Restaurar
    desabilitado); `img._element = work`, `img.dirty = true`; `PencilBrush` translúcido (vermelho apagar / verde
    restaurar) com `width` = tamanho; `isDrawingMode = true`.
  - em `mouse:down/move/up` com `refine` ativo, acumula `scenePoint`; no `path:created` com `refine` ativo: remove o
    path (`withoutHistory`), converte os pontos pelo mesmo `toPixels` do `endMask`, raio em px da imagem = `size/2 ×`
    escala da matriz (`hypot(a, b)`), `getImageData` do bbox → `applyStamp` por carimbo → `putImageData`,
    `img.dirty = true`, render. Nada entra no histórico durante o modo.
  - guardas: `refine` junto de `maskPaths` em `scheduleSnapshot`, `flushPending`, ops de página e
    `startFreehandDraw`; `undo/redo` recusam com o modo ativo.
  - `endRefine(apply)`: desliga o desenho; sem traço ou `apply=false` → `img.applyFilters()` + render, devolve `null`;
    com traço devolve `work.toDataURL('image/png')` (quem chama faz `putImage` + `replaceImage`, que reaplica filtros
    e dá o único `commit`).
  - `swapImage`: `originalSrcBeforeCutout: undefined` no `img.set` (L1970).
  — prova: E2E (T2) + vitest das funções puras.
- [ ] `editor-web/src/main.ts`:
  - `aiRemoveBg`: `const before = editor.imageSrc(img)` antes do pedido; com `r`,
    `if (!img.get('originalSrcBeforeCutout')) img.set('originalSrcBeforeCutout', before)` antes do `replaceImage` (o
    `commit` dele já leva a prop no instantâneo).
  - `imageProps`: botão `🖌️ Retocar recorte` (classe `refine-btn`) quando `img.get('originalSrcBeforeCutout')` OU a
    imagem tem transparência (amostra 64×64 do `_originalElement`, alguma α<255, cache em `WeakMap` por elemento).
  - barra (como `renderMaskProps`; `renderProps` a mostra enquanto houver `refineImage`): alternador
    `➖ Apagar sobra` / `➕ Restaurar original` (Restaurar desabilitado sem original, com hint), slider `Tamanho do
    pincel` 5–120 (px da página; padrão 40), slider `Suavidade da borda` 0–100 % (padrão 50), `Cancelar`, `Concluir`
    (classes `refine-erase`, `refine-restore`, `refine-size`, `refine-feather`, `refine-cancel`, `refine-done` para o E2E).
  - Concluir: `data = editor.endRefine(true)`; com `data`:
    `run('Salvando retoque', () => bridge.request<PutImageResult>('putImage', { data }))` → `editor.replaceImage(img, r.url)`;
    sem `transport` → toast "Sem app nativo" e cancela; erro do `putImage` → `img.applyFilters()` (volta ao recorte) +
    toast do `run`.
  - guardas do `maskImage` (L904, L1198, L1271) e o undo/redo da barra passam a recusar também com o retoque aberto.
  — prova: E2E (T2).
- [ ] `tools/e2e/task18.mjs` — a T2 abaixo.

### Plano de teste
- **Offline (sem slot):** em `editor-web/`: `npx tsc --noEmit`, `npx vitest run test/refineCutout.test.ts` e
  `npx vitest run` (bateria inteira, sem `fail` novo); Kotlin `EditorAssetsTest` e o resto do `testDebugUnitTest` pelo
  `build` do helper.
- **T2 reprodução como o usuário (E2E, no slot):** `tools/e2e/task18.mjs` (molde `task11.mjs`, driver `cdp.mjs`):
  1. `launchEditor()`; `editor.newDocument('E2E 18', 1080, 1080)`; insere uma foto SERVIDA pelo asset loader (o
     `ai.removeBg` recusa `data:`):
     `editor.addImage('https://appassets.androidplatform.net/assets/content/scenes/pastel_podium.webp')` (ou outra de
     `content/scenes` / `content/mockups` cujo recorte deixe área transparente), centraliza, seleciona.
  2. Toca (CDP `tap` no `#props`) **✨ Remover fundo**; espera o fim do busy. Sinal: `src` = `/blob/ai-…`,
     `originalSrcBeforeCutout` = URL da cena; print `01-recorte.png`.
  3. Lê o recorte em pixels (canvas a partir do `_originalElement`) e escolhe P_t = pixel com α=0 (fundo removido) e
     P_s = pixel com α=255 (sujeito), longe das bordas. Sem α=0: registra e usa só o ciclo apagar→restaurar em P_s.
  4. Toca **🖌️ Retocar recorte** → **➕ Restaurar original**, tamanho 40, suavidade 50; arrasta (toque CDP com
     `docToClient`) um traço curto sobre P_t; print `02-restaurando.png`; toca **Concluir**. Sinais: `src` =
     `https://appassets.androidplatform.net/blob/edit-<uuid>.png`; pixel em P_t com α=255 e RGB = pixel do ORIGINAL
     escalado (tolerância ±2); a ~raio·0,9 do traço, 0<α<255 (feather).
  5. **➖ Apagar sobra** num traço sobre P_s → Concluir → α(P_s)=0; `editor.flushPending(); editor.undo()` → α(P_s)=255
     e `src` volta ao blob anterior (1 undo por Concluir).
  6. **✨ Melhorar resolução ×2** na imagem retocada → sem toast "imagem fora do editor"; `src` = `/blob/ai-…`, tamanho
     natural ×2. (Upscale indisponível no aparelho → usar **✨ Remover fundo** de novo, que também lê a `src`; anotar.)
  7. Salva o rascunho (`flush` → `saveDraft`) e reabre (sair do editor e reabrir pela lista de rascunhos) → `src`
     `/blob/edit-…` e `originalSrcBeforeCutout` mantidos, pixel P_t ainda α=255.
  8. **🔄 Substituir** por outra foto (caminho do `task11`) → `originalSrcBeforeCutout` ausente.
  Prints de cada passo; JSON do `reporter` com cada `check`.
- **Controle positivo:** APK da base: depois do passo 2, `document.querySelector('#props .refine-btn')` = null e
  `uiFind('Retocar recorte')` → nada; `originalSrcBeforeCutout` = undefined. Com o fix, o botão existe e os passos 4–8 passam.
- **T3 regressão direcionada:** `node tools/e2e/task11.mjs` (substituir foto, agrupar, cadeado), `task14.mjs` (desenho
  à mão livre: o pincel do canvas é compartilhado), `task09.mjs` (páginas: guardas de página); remover fundo e upscale
  já passam no T2; "✨ Remover objeto" (máscara) uma vez no E2E: pinta, Aplicar, sem erro. Vitest inteiro e
  `testDebugUnitTest` sem `fail` novo contra a base. T4: logcat do PID sem `FATAL`/erro de console novo.

### Sessões seguintes
- dev: effort high, ultrathink sim — geometria página→pixels, prévia ao vivo mexendo no `_element` do Fabric sem
  quebrar serialização/undo, guardas em vários fluxos e a mensagem nova na ponte.
- teste: effort medium, ultrathink não — E2E com receita fechada; a sutileza é escolher P_t/P_s pelo recorte real.

### Nota do dev (2026-11-06) — plano conferido contra a base `9033756`
O plano vale; as linhas andaram e quatro detalhes de implementação foram fixados (abertos no código antes de editar):
- **Linhas atuais:** `main.ts::imageProps` L1091–1114, `aiRemoveBg` L1205–1208, guardas da máscara L946 (`startFreehand`),
  L1294 (`pageOp`), L1367 (`showMergeSheet`), abas L1488; `editor.ts::path:created` L238, `scheduleSnapshot` L544,
  `undo/redo` L561–562, ops de página L652/668/703/734/850, `replaceImage` L2078, `swapImage` L2097 (`img.set` L2106),
  `startMask/endMask` L2145–2189, `flushPending` L2331.
- **`_filterScalingX/Y`:** `Image._renderFill` (fabric `Image.ts` L634–660) escala a origem por `_filterScalingX/Y`; ao pôr o
  canvas de trabalho em `_element` o modo zera os dois para 1. No Cancelar/erro, `_element = _originalElement` ANTES do
  `applyFilters()` (fabric `Image.ts` L531–592: com filtros e `_element !== _originalElement` sem `_filteredEl`, o filtro
  escreveria no canvas de trabalho).
- **Pontos do traço:** `mouse:down/move/up` em modo desenho chegam com `scenePoint` (`Canvas.ts` L978–1024 →
  `_handleEvent` L945, `getEventPoints`). O `path:created` (PencilBrush L275–300) sai ANTES do `mouse:up` e não sai num
  toque parado (`isEmptySVGPath`): o modo remove o path no `path:created` e aplica os carimbos no `mouse:up` (toque
  parado = 1 carimbo). Pinça (`abortFabricGesture`) zera os pontos pendentes.
- **Guardas a mais:** `undo/redo` do `Editor` não fazem nada com o retoque aberto (o `restore` recarregaria o JSON sob o
  modo); as abas (L1488) recusam com toast, como a máscara já faz nas páginas/lote.
- **Teste do `CUSTOM_PROPERTIES`:** vai em `test/refineCutout.test.ts` (reservado), não em `document.test.ts`.

## Correcao (pipeline 20261106-0749, rodada 1)

**O que mudou (`arquivo::simbolo`) e por quê**
- `editor-web/src/refineCutout.ts` (novo) — funções puras sobre RGBA não pré-multiplicado: `featherAlpha` (1 até
  `r·(1−feather)`, smoothstep até 0 em `r`), `strokeStamps` (carimbos a cada `r/4` ao longo do traço, com o 1º e o
  último), `strokeBounds` (janela recortada na imagem), `strokeCoverage` (MÁXIMO dos carimbos por pixel: sobreposição não
  acumula, a borda suave tem a mesma largura com qualquer espaçamento), `applyCoverage` (`erase` α←α·(1−s); `restore`
  mistura pesada por alfa com a original — s=1 dá o pixel original exato, inclusive sobre α=0 com RGB 0) e `applyStroke`
  (o traço inteiro numa janela só). `REFINE_SIZE` 5–120 (padrão 40, px da página), `REFINE_FEATHER` 0–100 % (padrão 50).
- `editor-web/src/editor.ts` — estado `refine` (`RefineState`): `startRefine(img, origSrc?)` desenha o
  `_originalElement` (sem filtros) num canvas de trabalho no tamanho natural e o põe SÓ em `img._element` (prévia ao vivo;
  `_filterScalingX/Y = 1`); a original (`origSrc`) é carregada e escalada para o tamanho atual do recorte (sem ela, só
  Apagar). Pontos do traço pelos `mouse:down/move/up` (`scenePoint`) e carimbos no `mouse:up` pelo mesmo mapeamento
  página→pixels do `endMask`; o path do `PencilBrush` (rastro vermelho/verde) é removido no `path:created`; a pinça zera o
  traço. `setRefineBrush`, `refineInfo`, `endRefine(apply)` (PNG do canvas de trabalho ou volta ao recorte) e
  `dropRefinePreview` (`_element = _originalElement` antes do `applyFilters`). Guardas: `brushModal` (máscara OU retoque)
  em `scheduleSnapshot`, `flushPending`, `switchToPage/addPage/deletePage/magicResize/insertMergedPages`,
  `startFreehandDraw`; `undo/redo` não fazem nada com o retoque aberto. `swapImage` apaga `originalSrcBeforeCutout`.
- `editor-web/src/main.ts` — `aiRemoveBg` lê a `src` antes do pedido e grava `originalSrcBeforeCutout` só se ausente,
  antes do `replaceImage` (o instantâneo já leva a propriedade), e refaz o painel (o botão aparece logo). `imageProps`
  ganha `🖌️ Retocar recorte` (`.refine-btn`) quando há original ou transparência (`hasTransparency`: amostra 64×64 do
  `_originalElement`, cache por elemento). Barra `renderRefineProps`: `➖ Apagar sobra` (`.refine-erase`) /
  `➕ Restaurar original` (`.refine-restore`, desabilitado sem original), sliders `Tamanho do pincel` (`.refine-size`) e
  `Suavidade da borda` (`.refine-feather`), `Cancelar` (`.refine-cancel`), `Concluir` (`.refine-done`). `finishRefine`:
  `putImage` → `replaceImage` (1 passo do undo); erro → volta ao recorte. `refineBusy()` recusa ↶/↷, Camadas, Exportar
  (o exportar de todas as páginas recarrega o canvas), abas, páginas, lote e desenho à mão com o retoque aberto.
- `editor-web/src/document.ts::CUSTOM_PROPERTIES` — `'originalSrcBeforeCutout'`.
- `editor-web/src/protocol.ts` — `PutImagePayload {data}` / `PutImageResult {url}`.
- `editor-web/src/dataMerge.ts::swapPhotoJson` (reserva pedida com `claim` nesta rodada) — o ⚡ Gerar em lote troca a foto
  no JSON sem passar pelo `swapImage`: apaga `originalSrcBeforeCutout` (senão o Restaurar da página gerada pintaria a foto
  do modelo). Teste em `test/dataMerge.test.ts`.
- `editor/.../EditorAssets.kt::pngFromDataUrl` — `data:image/png;base64,` + `java.util.Base64` + assinatura PNG; o resto
  → `BridgeException(INVALID)`. `EditorSession.kt` — `handle("putImage")` grava os bytes como estão (`putBytes(…, "png",
  "edit")`) e devolve `{url: /blob/edit-<uuid>.png}` (casa com `EditorAssets.NAME`, logo o `resolve` das ações de IA aceita).
- Bundle regerado em `editor/src/main/assets/editor/`.

**Provas offline (rodadas nesta sessão)**
- `npx tsc --noEmit` → sem erro; `node --check tools/e2e/task18.mjs` → ok (o E2E roda no slot de teste).
- `npx vitest run test/refineCutout.test.ts` → 16/16; `npx vitest run` → 35 arquivos, 430 testes, 0 falha.
- `build --bug` do helper → exit 0 (`npm run build` + vitest 430/430 + `:app:assembleDebug testDebugUnitTest`: 41 suítes JVM, 0 falha; `EditorAssetsTest` 2/2). Bundle novo `assets/index-eo1AX5-l.js` (contém `putImage`, `refine-btn`, `originalSrcBeforeCutout`); o CSS só mudou em fim de linha e foi devolvido.

**Ajustes ao Plano de teste**
- T2 passo 4: a borda suave é medida a **0,8·raio** do traço (não 0,9): o toque CDP tem ±0,5 px CSS ≈ ±1,6 px da imagem,
  e a 0,9 a faixa encosta no raio (α arredonda para 0).
- T2 passo 8: o 🔄 Substituir usa o caminho `Logo do brand kit` da mesma folha (`ppEditor.setBrandKit({logoUrl: cena 2})` →
  `.swap-btn` → `.swap-logo`), sem depender de foto na galeria; o `.swap-gallery` continua coberto pelo `task11.mjs`.
- T2 passo 6: sem upscale no aparelho (ou entrada > 1 MP), o script cai no ✨ Remover fundo e anota o toast do upscale.
- O `EditorAssetsTest` não prova o `resolve` da URL `/blob/edit-…` (o `Uri.parse` é stub na JVM): a prova é o passo 6 da T2
  (a ação de IA lê a `src` retocada).
- T3: somar `task10.mjs` (o lote passa pelo `swapPhotoJson`) aos vizinhos `task11/task14/task09`.

### Teste rodada 1 — interrompida por ambiente (2026-11-06)
Evidência: `C:\projects\sandbox\.bugfix-pipeline-product_photo_offline\evidencia\20261106-1318-task-18-retocar-recorte-pos-remocao-de-fundo\`
(aparelho `emulator-5554`, `sdk_gphone64_x86_64`, já aberto antes da sessão; nenhum celular no adb).
- **Offline:** diff `9033756...e8b9b3e` só toca arquivos reservados e cobre as Tarefas; `npx tsc --noEmit` 0;
  `npx vitest run test/refineCutout.test.ts` 16/16; `npx vitest run` 35 arquivos / 430 testes, 0 falha.
- **T3 (JVM, `build` do helper):** base 211 testes / 0 falha; fix 213 / 0 falha (a diferença é o `EditorAssetsTest` 2/2) —
  `junit-base.txt` / `junit-fix.txt`.
- **Controle positivo (APK base `9033756`, sha256 conferido no aparelho):** depois do ✨ Remover fundo, sem
  `#props .refine-btn` e sem `originalSrcBeforeCutout` — `base-task18-guardado.txt` (3/3).
- **Defeito do `tools/e2e/task18.mjs` (o dev precisa corrigir):** o ramo da base NÃO prova a ausência, quebra antes —
  `__state18` chama `editor.refineInfo()`, que não existe na base: `TypeError: editor.refineInfo is not a function` no
  passo 1 (`base-task18.txt`). O controle acima rodou com uma cópia que só troca para `editor.refineInfo?.()`
  (`task18-basectl.mjs` na evidência; `diff --strip-trailing-cr` = essa linha e o import). Correção: a mesma troca no
  `installHelpers` do script.
- **T2 com o fix NÃO rodou:** `adb install -r -d -t fix-e8b9b3e.apk` → `INSTALL_FAILED_INSUFFICIENT_STORAGE` (emulador
  com ~669 MB livres para um APK de ~300 MB; `pm trim-caches 4G` não liberou; o grosso é dado do app —
  `files/models/qwen3-0.6b-int4` 336 MB — que não se apaga). O emulador ficou com o APK da BASE `9033756`.
  Fechado como `ambiente`; a próxima rodada refaz tudo desde o Passo 1 (de preferência no Moto g86 ou com espaço no
  emulador).
- **Retomada no slot (mesma rodada, 2026-11-06):** `sync` → base continua `9033756`, código igual (o APK do fix na
  evidência é idêntico ao da lane, `cmp`). O `emulator-5554` (único aparelho) tinha 953 MB livres e mesmo assim
  `INSTALL_FAILED_INSUFFICIENT_STORAGE`, também com `sys_storage_threshold_max_bytes` baixado a 100 MB só durante o
  `adb install` (chave apagada em seguida: `settings get` → `null`). A troca precisa do APK antigo e do novo juntos
  (~300 MB cada + libs nativas `Stored`); depois da tentativa o livre caiu a 384 MB. Sem apagar dado do app ou
  desinstalar (proibido pelo manual), não cabe. **Para destravar:** o Moto g86 no adb, ou o dono liberar ≥ ~1 GB no
  `pp_api34`. O emulador segue com o APK da BASE.
