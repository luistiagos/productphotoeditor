# [TASK-14] Listas de Benefícios (Bullets/Checklists), Localizar e Substituir no Anúncio e Desenho Vetorial à Mão Livre

## Metadados e Esforço Mensurado

| Campo | Valor |
| :--- | :--- |
| **ID** | `TASK-14` |
| **Prioridade** | **Média (Produtividade e Copywriting — P2)** |
| **Esforço Mensurado** | **Baixo** — **~1 a 1,5 dia útil (8h–12h / 2 Story Points)** |
| **Escopo** | 100% Local (`editor-web` em TypeScript / Fabric.js 7.4.0) |
| **Referência Analisada (`com.desygner.ads`)** | `extracted/assets/public/docs/create.md` (§ Bulleted and numbered lists L581, § Find and replace L631, § Freehand drawing L781) |

### Detalhamento do Esforço por Subtarefa
1. **Formatador de Listas e Checklists Comerciais (`textLists.ts` + botão em `textProps`):** ~3h (alternância inteligente entre texto normal, bullets `•`, checklist `✓`, destaques `🔥`/`⭐` e lista numerada `1. 2. 3.`).
2. **Localizar e Substituir Global no Anúncio (`findReplace.ts` + UI em `showText`):** ~3h (busca case-insensitive/sensitive em todos os `FabricText` e dentro de `Group`s, substituição individual ou em lote com 1 snapshot de Undo).
3. **Desenho Vetorial à Mão Livre / Caneta Destaca-Preço (`freehandDraw.ts`):** ~3h (modo `PencilBrush` gerando camadas `Path` editáveis para circular ofertas, fazer setas manuscritas ou assinar artes).
4. **Testes Unitários (Vitest):** ~2h.

---

## 1. Contexto e Problema Atual

1. **Sem Formatação Rápida de Listas de Benefícios:** Em anúncios de produtos, listar de 3 a 5 benefícios (ex.: *"✓ Frete Grátis"*, *"✓ Garantia de 1 Ano"*, *"✓ Envio em 24h"*) é um padrão clássico de conversão. Atualmente, em [`textProps()`](file:///c:/projects/sandbox/product_photo_offline/editor-web/src/main.ts#L319-L371), o usuário precisa digitar símbolos manualmente linha por linha no teclado do celular.
2. **Sem Localizar e Substituir (`Find & Replace`):** Ao reaproveitar um template promocional com várias caixas de texto (ex.: trocar `"R$ 199,90"` por `"R$ 149,90"` ou `"Natal"` por `"Black Friday"`), o usuário precisa abrir cada caixa individualmente.
3. **Pincel do Fabric usado apenas para máscara temporária de IA:** Em [`editor-web/src/editor.ts`](file:///c:/projects/sandbox/product_photo_offline/editor-web/src/editor.ts#L884-L928), `PencilBrush` já está importado e configurado para desenhar máscaras de inpainting (`startMask`/`endMask`), mas o usuário **não pode desenhar traços livres permanentes no anúncio** (como circular um preço à mão com caneta vermelha, fazer um traço marca-texto ou adicionar uma assinatura autoral).

---

## 2. O que deve ser feito (Especificação Técnica Detalhada)

### 2.1. Listas com Marcadores, Checklists e Numeração (`textLists.ts`)
Criar helpers puros de formatação de listas para `Textbox`:

1. **Estilos de Lista Suportados (`ListStyle`):**
   - `'none'`: sem marcador (remove prefixos de lista existentes de cada linha);
   - `'bullet'`: prefixa cada linha não-vazia com `• `;
   - `'check'`: prefixa cada linha não-vazia com `✓ `;
   - `'fire'`: prefixa cada linha não-vazia com `🔥 `;
   - `'star'`: prefixa cada linha não-vazia com `⭐ `;
   - `'numbered'`: prefixa cada linha não-vazia sequencialmente com `1. `, `2. `, `3. `...
2. **Comportamento de Ciclo / Seletor (`toggleListStyle(text, style)`):**
   - Se todas as linhas já possuem o estilo escolhido, remove os prefixos voltando ao texto limpo (`'none'`).
   - Se possuem outro estilo de lista (ex.: `• `), substitui os prefixos pelo novo estilo (ex.: `✓ ` ou `1. `) sem duplicar marcadores!
   - Adicionar botão **"☰ Lista"** em [`textProps()`](file:///c:/projects/sandbox/product_photo_offline/editor-web/src/main.ts#L333-L347).

### 2.2. Localizar e Substituir Texto no Anúncio (`findReplace.ts`)
1. **Motor de Busca e Substituição (`replaceTextInCanvas(editor, findStr, replaceStr, matchCase)`):**
   - Percorre todos os objetos do canvas recursivamente (incluindo `FabricText` / `Textbox` dentro de `Group`s);
   - Conta quantas ocorrências existem e em quantas camadas;
   - Substitui todas as ocorrências, chama `editor.refitCurve(t)` em cada `Textbox` afetado e registra um único `editor.commit()` para que `Desfazer` reverta todas as trocas de uma só vez.
2. **Acesso na UI:**
   - Botão **"🔍 Localizar e substituir…"** na aba **Texto** (`showText()`), abrindo uma sheet com campo *"Localizar"*, campo *"Substituir por"*, contador em tempo real de ocorrências encontradas no anúncio e botão **"Substituir tudo"**.

### 2.3. Desenho Vetorial à Mão Livre / Caneta Marcadora (`startFreehandDraw` / `endFreehandDraw`)
Adicionar modo de desenho vetorial permanente em [`editor-web/src/editor.ts`](file:///c:/projects/sandbox/product_photo_offline/editor-web/src/editor.ts):

1. **Diferenciação em relação ao `startMask`:**
   - Quando `this.maskPaths === null` e `this.isFreehandDrawing === true`:
     - Configurar `PencilBrush(this.canvas)` com `color`, `width` e `decimate = 2.5` (suavização automática da curva Bézier do traço para não ficar tremido no toque);
     - No evento `path:created`, definir `layerName: 'Traço à mão'`, manter `selectable: true, evented: true` e agendar snapshot no histórico (`scheduleSnapshot()`).
2. **Presets de Caneta na UI (`showShapes` ou aba `Formas`):**
   - Botão **"✍️ Desenhar à mão"** que ativa a barra de desenho com:
     - **Caneta Circula-Oferta** (vermelho `#e53935`, espessura média);
     - **Marca-Texto Translúcido** (amarelo `rgba(255, 235, 59, 0.45)`, espessura larga);
     - **Caneta Fina / Assinatura** (preto/branco, espessura fina);
     - Seletor de cor, slider de espessura, botão `Desfazer traço` e botão **"Concluir"**.

---

## 3. Arquivos a Criar / Modificar

| Arquivo | Ação | Descrição |
| :--- | :---: | :--- |
| [`editor-web/src/textTools.ts`](file:///c:/projects/sandbox/product_photo_offline/editor-web/src/textTools.ts) | **Criar** | Funções puras `formatTextList()` (`bullet`, `check`, `fire`, `star`, `numbered`) e `findAndReplaceInText()`. |
| [`editor-web/src/editor.ts`](file:///c:/projects/sandbox/product_photo_offline/editor-web/src/editor.ts) | **Modificar** | Adicionar `applyListStyle()`, `findAndReplaceAll()`, `startFreehandDraw()`, `updateFreehandBrush()` e `endFreehandDraw()`. |
| [`editor-web/src/main.ts`](file:///c:/projects/sandbox/product_photo_offline/editor-web/src/main.ts) | **Modificar** | Adicionar botão **"☰ Lista"** em `textProps()`, **"🔍 Localizar e substituir"** em `showText()` e **"✍️ Desenhar à mão"** em `showShapes()`. |
| [`editor-web/test/textTools.test.ts`](file:///c:/projects/sandbox/product_photo_offline/editor-web/test/textTools.test.ts) | **Criar** | Testes unitários cobrindo conversão entre estilos de lista sem duplicar marcadores, remoção de lista e substituição global case-insensitive/sensitive. |

---

## 4. Critérios de Aceite e Verificação

- [ ] Selecionar um texto de múltiplas linhas e usar **"☰ Lista"** converte entre marcadores (`•`), checklist (`✓`), destaques (`🔥`, `⭐`), lista numerada (`1. 2. 3.`) e texto sem marcador sem duplicar prefixos.
- [ ] **"🔍 Localizar e substituir"** encontra e troca palavras ou preços em todas as camadas de texto do anúncio simultaneamente, com suporte a Undo em 1 toque.
- [ ] O modo **"✍️ Desenhar à mão"** permite desenhar traços vetoriais suavizados sobre o canvas (como circular um preço ou assinar), que ficam salvos como camadas normais movíveis e redimensionáveis.
- [ ] `npx vitest run` e `npm run build` passam com 0 erros.


---

## 5. Registro da implementação (sessão 2026-11-05)

### 5.1. Etapa analítica — símbolos abertos
- Linha de base: `npx vitest run` → **139/139** (17 arquivos); emulador `pp_api34` (API 34) no adb, `/data` com 1,3 GB livres.
- Fabric 7.4 `PencilBrush` (dist/index.mjs L13658): `decimate` padrão 0,4; `decimatePoints` usa `(distance / zoom)²` → o
  valor é em px de **tela**; pontos chegam por `getScenePoint` → **coordenadas do documento**, e `width` do pincel também
  (o `_saveAndTransform` aplica a viewport). `createPath` → `Path` com `fill: null`, `stroke = color`,
  `strokeLineCap/Join` do pincel (padrão `round`/`round`, `BaseBrush` L13269). `_finalizeAndAddPath`: `canvas.add(path)`
  (→ `object:added` → `scheduleSnapshot`) e depois `path:created`; traço vazio (toque sem mover) não cria nada.
- `Canvas._onMouseDownInDrawingMode` (L12388): **descarta a seleção** a cada toque → `selection:cleared` →
  `editor.onSelection(undefined)` → `main.ts::renderProps(undefined)` esconderia o painel. A máscara contorna com
  `if (maskImage) return renderMaskProps()` no topo de `renderProps` → o desenho precisa do mesmo desvio.
- `Canvas.renderAll` não limpa o `contextTop` em `isDrawingMode`; `renderPage`/`thumbnail` desenham num canvas à parte e
  são síncronos → o rascunho automático (4 s) não estraga um traço em andamento.
- `editor.ts::startMask/setMaskBrush/endMask` (L1245–1289): `maskPaths !== null` marca o modo máscara; `path:created`
  (L160) só trata a máscara; `scheduleSnapshot`/`flushPending` ficam mudos com `maskPaths`. `LongPress` (L169) já ignora
  toque com `isDrawingMode`.
- `editor.ts::commit()` = `requestRenderAll` + `scheduleSnapshot` (debounce 250 ms) → várias mudanças síncronas seguidas
  de **um** `commit` viram **uma** entrada de undo. `restore()` (undo/redo) faz `loadFromJSON` → todos os objetos são
  recriados (referências antigas ficam órfãs).
- `editor.ts::refitCurve(t)` só age em `Textbox` (texto curvo/deformado), sem commit; `refreshGradient(o)` refaz coords
  do degradê do usuário. `main.ts::setText` é o modelo de troca de texto: `set({text})` → `refitCurve` →
  `refreshGradient` → `setCoords` → `commit`.
- `FabricText.set` (L16280): chave de `textLayoutProperties` (inclui `text`) → `initDimensions()` + `setCoords()`.
  `FabricObject._set` (L5825): mudança num filho marca `parent.dirty` (o cache do grupo se refaz), mas a **caixa do
  Group não se recalcula** → `Group.triggerLayout()` (L9433) depois de trocar texto de filho.
- `main.ts::textProps(t)` (L537): linhas `row scroll` de botões; `showText()` (L1010): sheet `list` com botões;
  `showShapes()` (L1039): chips + seção "📌 Infográfico". `renderProps` (L200): ramo "forma" (o `else`) mostraria
  `Preenchimento` = `String(null ?? '#000000')` e "🌈 Degradê" para um `Path` de traço → precisa de ramo próprio.
- `dom.ts`: `colorInput` passa por `toHex` (perde o alfa de `rgba(...)`) → marca-texto translúcido precisa reaplicar o
  alfa ao trocar a cor. `contrast.ts::parseColor` lê `rgba()`/hex.
- Testes: vitest em `environment: 'node'` com `fabric/node` (outro build → classes diferentes de `fabric`) → a coleta de
  textos para localizar/substituir tem de ser por *duck typing* (`text` string; `getObjects()` para grupos), não
  `instanceof`.
- `document.ts::CUSTOM_PROPERTIES` já serializa `layerName` → `'Traço à mão'` sobrevive a salvar/undo.
- E2E: `tools/e2e/cdp.mjs` (`launchEditor`, `tap`, `drag` com toques reais, `evaluate`, `reporter`); modelo em `task12.mjs`.

### 5.2. Hipóteses descartadas
- "Desfazer traço" = `editor.undo()`: com o debounce de 250 ms, um traço recém-feito ainda não está no histórico e o undo
  voltaria ao instantâneo anterior (levando outro traço junto) → remover o último `Path` **desta sessão de desenho** que
  ainda está no canvas (`object:removed` registra o undo normalmente).
- Guardar os traços da sessão por referência (nem filtrando os que seguem no canvas): um ↶ da barra faz `loadFromJSON`,
  recria os objetos e a sessão "perdia" os traços (Desfazer traço desabilitado, Concluir sem selecionar) → a sessão
  guarda só `freehandBase` = nº de objetos ao começar; traços da sessão = `isFreehandPath` acima desse índice (E2E prova
  o ↶ da barra no meio do desenho).
- Propriedade nova `freehand` em `CUSTOM_PROPERTIES`: desnecessária — o doc pede `layerName: 'Traço à mão'` e não há
  renomear camada; `isFreehandPath` = `type 'path'` + esse `layerName` + sem preenchimento.
- Juntar os traços num Group ao concluir: uma assinatura de 5 traços viraria uma camada, mas um círculo isolado também
  viraria grupo → ao **Concluir**, os traços da sessão ficam **selecionados juntos** (como os blocos Raio-X da TASK-12);
  "🔗 Agrupar" fica a um toque.
- `String.replace(regex, replaceStr)`: preços têm `$` ("R$ 149,90") e `$&`/`$1` seriam padrões especiais → substituir
  com função (`() => replace`).

### 5.3. O que fazer (tasks → prova)
1. `textTools.ts` (novo): `ListStyle`, `detectListStyle`, `stripListPrefix`, `formatTextList`, `toggleListStyle`;
   `countMatches`, `findAndReplaceInText` (regex escapada, `u`, `i` opcional, substituição literal), `collectTextLayers`
   (recursivo por duck typing) → vitest `test/textTools.test.ts` (conversões sem duplicar, toggle, linhas vazias,
   numeração, `$` literal, case, texto em Group real do `fabric/node`).
2. `freehandDraw.ts` (novo): `PEN_PRESETS` (Circula-Oferta `#e53935`, Marca-texto `rgba(255,235,59,0.45)`, Caneta fina
   preta/branca), `penWidth`, `withAlpha`, `alphaOf`, `FREEHAND_LAYER`, `FREEHAND_DECIMATE = 2.5`, `isFreehandPath` →
   vitest.
3. `editor.ts`: `applyListStyle`, `listStyleOf`, `findTextMatches`, `findAndReplaceAll` (1 `commit`, `triggerLayout` nos
   grupos pais), `startFreehandDraw`/`updateFreehandBrush`/`undoFreehandStroke`/`endFreehandDraw`/`isFreehandDrawing`,
   `path:created` com `layerName`, selecionável → E2E.
4. `main.ts`: "☰ Lista" em `textProps` (sheet com os 6 estilos, ativo destacado), "🔍 Localizar e substituir…" em
   `showText` (campos, diferenciar maiúsculas, contador ao vivo, lista por camada com "Trocar", "Substituir tudo"),
   "✍️ Desenhar à mão" em `showShapes` → barra no `#props` (presets, cor, espessura, Desfazer traço, Concluir) com desvio
   em `renderProps`; abas concluem o desenho; ramo de props para traço (cor com alfa preservado, espessura) → E2E
   `tools/e2e/task14.mjs` no `pp_api34` (toques reais: arrastar o dedo desenha).

### 5.4. Feito
- `textTools.ts` (novo): `ListStyle`, `LIST_MARKERS`, `LIST_OPTIONS`, `detectListStyle` (`'mixed'` p/ marcadores
  diferentes ou digitados), `stripListPrefix`, `formatTextList` (troca qualquer marcador — nossos, ✔ ✅ ★, `- * – ◦ ▪`,
  `1.`/`2)` — sempre seguido de espaço; recuo mantido; vazias não numeram), `toggleListStyle`; `countMatches`,
  `findAndReplaceInText` (regex escapada, flag `u`, `i` opcional, substituição por função → `$` literal), `matchSnippet`,
  `collectTextLayers` (duck typing, recursivo), `summarizeMatches`.
- `freehandDraw.ts` (novo): `FREEHAND_LAYER`, `FREEHAND_DECIMATE = 2.5`, `PEN_PRESETS` (⭕ Circula-oferta `#e53935`
  1,2 %; 🖍️ Marca-texto `rgba(255, 235, 59, 0.45)` 4 %; ✒️ Caneta fina `#111111` e Fina branca 0,5 % do menor lado),
  `PEN_MIN/MAX`, `penWidth`, `alphaOf`, `withAlpha`, `keepAlpha`, `isFreehandPath`.
- `editor.ts`: `listStyleOf`, `applyListStyle` (1 commit), `setTextContent` (privado: texto + `refitCurve` +
  `refreshGradient` + `triggerLayout` dos `parent`), `textLayers`, `findTextMatches`, `findAndReplaceAll(find, replace,
  matchCase, only?)` → `{matches, layers, skipped}` com 1 commit (descarta ActiveSelection antes; camada que ficaria
  vazia não muda); desenho: `isFreehandDrawing`, `startFreehandDraw`, `updateFreehandBrush`, `freehandBrush`,
  `freehandStrokes`, `undoFreehandStroke`, `endFreehandDraw(select)`; `path:created` dá `layerName`, selecionável.
- `main.ts`: "☰ Lista" no painel do texto (folha com 6 chips, ativo destacado); "🔍 Localizar e substituir…" na aba
  Texto (Localizar, Substituir por, ☐ Diferenciar maiúsculas, contador ao vivo, lista por camada com "Trocar",
  "Substituir tudo", toast "↶ desfaz tudo"); Formas → "✍️ Desenho à mão" → barra no `#props` (4 canetas, Cor com alfa
  preservado, Espessura, "↶ Desfazer traço (n)", Concluir) com desvio no topo de `renderProps`; trocar de aba conclui o
  desenho; painel próprio do traço selecionado (Cor do traço, Espessura, ✍️ Desenhar mais). `styles.css`: campos.
- **Defeito pré-existente corrigido — `refitCurve` em texto dentro de Group**: usava `getCenterPoint()` (cena) com
  `setPositionByOrigin` (plano do pai) → todo Textbox dentro de um grupo era deslocado pelo centro do grupo ao refazer
  (achado do E2E: left 0→177, top 72→356 e o grupo inflava para 1111×860). Agora `getRelativeCenterPoint()` — idêntico
  fora de grupo. Não aparecia antes porque `refitCurves` só percorre o topo da pilha.
- Desvios conscientes do doc: módulo `freehandDraw.ts` separado (o §3 punha tudo em `editor.ts`; o cabeçalho já citava
  esse nome); "Desfazer traço" remove o último traço da sessão em vez de chamar o undo geral (§5.2); Concluir seleciona
  os traços juntos em vez de agrupar (§5.2); caneta "preto/branco" virou dois presets.

### 5.5. Provas (2026-11-05)
- `npx tsc --noEmit` limpo; `npx vitest run` **161/161** (novo `test/textTools.test.ts`, 22 casos: 5 estilos, ciclo
  bullet→check→fire→star→numbered→check→bullet sem duplicar, toggle remove, vazias/recuo/numeração, marcadores digitados
  e variantes, `-10% OFF`/`1.5 kg`/`2024.` não são marcador, CRLF, case/acentos/emoji, `$`/`$&` literais, termo vazio,
  trecho, coleta recursiva + Group real, premissa `triggerLayout`, presets/alfa, `isFreehandPath`, Path do PencilBrush
  sobrevive a `toObject/fromObject` com `layerName`, premissa do `decimate` dividido pelo zoom).
- E2E `tools/e2e/task14.mjs` → **50/50 no emulador `pp_api34`** e **50/50 no moto g86** (`E2E_FORMAT="Post Instagram"`):
  edição normal → ☰ Lista nos 5 estilos com chip ativo, 3 linhas, tocar no ativo limpa, ↶ desfaz, emoji sobrevive a
  reabrir; Localizar "R$ 199,90" → 3 em 3 camadas (uma no Group) ao vivo, Substituir tudo, contador zera, **1 toque de ↶
  reverte as 3**, ↷ refaz, case on/off, "Trocar" individual, texto que quebra linha no Group fica no mesmo centro e o
  grupo cresce só o necessário; desenho com o dedo (círculo 300×220 em 540,700 → Path vermelho 13 px), barra não some,
  marca-texto 43 px e **pixel renderizado (255,246,167)**, seletor mostra `#ffeb3b`, cor nova mantém alfa, espessura,
  caneta fina com menos segmentos que toques (74/161), Desfazer traço, **↶ da barra no meio do desenho**, Concluir
  seleciona os 2 juntos, tocar seleciona/arrastar move/alça redimensiona, painel do traço, alfa mantido no selecionado,
  sobrevive a reabrir, Camadas lista "Traço à mão", aba conclui o desenho, toque longo em texto não abre edição, sem
  exceção JS. Prints: `14-1-checklist`, `14-2-substituido`, `14-3-desenho`, `14-4-tracos-editados`.
- Regressão no emulador (com a correção do `refitCurve`): `task12` **40/40**, `task03` **19/19**, `task11` **25/25**
  (1ª rodada caiu no inspetor numérico — toque durante a animação do teclado; repetida passou).
- Achados do E2E que eram do teste: selecionar abre o `#props`, o palco encolhe e o zoom muda → recalcular o ponto antes
  de arrastar; após `blur()` esperar a folha parar de mexer (não só `innerHeight`).
- Ambiente: o `pp_api34` com 12 h ligado ficou com systemui/launcher/system em ANR e `uiautomator` sem árvore (load ~25);
  `adb reboot` não resolveu, **cold boot** (`emu kill` + `-no-snapshot-save -no-snapshot-load`) resolveu.
  `launchEditor` agora aceita `E2E_FORMAT`.
- Não coberto: seletor nativo de cor/teclado (valores por evento), traço com Text Warp/degradê, export SVG/vídeo dos
  traços, localizar em texto com estilos por caractere (`styles` não é reindexado — mesmo comportamento da edição normal).
