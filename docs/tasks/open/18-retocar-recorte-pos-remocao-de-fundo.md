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
