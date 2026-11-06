# [TASK-09] Projetos Multi-Páginas (Carrossel / Catálogo), Magic Resize Multi-Formato e Transferência de Estilo de Fundo

## Status (pipeline 20261105-1638 — aprovado no teste rodada 2, 2026-11-05)

**Feito:** projeto com várias páginas (carrossel) no mesmo rascunho — faixa `◀ 📄 Página i/N ▶ ＋ Nova ⧉ Duplicar 🗑️`,
folha "Páginas" com miniaturas e reordenação, undo entre páginas, `pages?`/`activePageIndex?` opcionais no documento (rascunho
de 1 página continua idêntico, sem `pages`); "✨ Magic Resize (vários formatos)" na aba Tamanho (checkbox sobre os
formatos, reflow por papel: 9:16 empilhado na zona segura, 16:9 produto à esquerda e textos à direita, fundo `cover`);
na aba Fundo "✨ Extrair fundo da foto do produto" (degradê das cores da foto, texto recolorido por contraste) e
"🎨 Aplicar estilo deste fundo em todas as páginas" (um passo do undo); "Exportar todas as páginas (N)" em PNG/JPG;
Brand Kit aplicado em todas as páginas.

**Commits** (sobre `origin/main` @ `713a557`): `254cb99` feat(editor) TASK-09 (código + bundle `index-BxKdazMA.js`),
`b13355f` docs teste rodada 1 reprovado (o E2E `task09.mjs` quebrava na montagem: folha Fundo aberta, toque perdido no
"Aplicar"), `368ddcf` feat(editor) E2E com toque estável e espera de folha, mais este commit de docs.

**Aparelho:** emulador `pp_api34` (`emulator-5554`, Post Facebook 1080×1080) — o moto g86 estava com bloqueio seguro nas
duas rodadas. APK do fix `d6e8ed70…1b31` = `sha256sum` do `base.apk` instalado; APK da base `a7797074…0717`.

**Evidência** (`C:\projects\sandbox\.bugfix-pipeline-product_photo_offline\evidencia\20261105-2230-task-09-multi-paginas-carrossel-magic-resize-e-bg-style-transfer-r2\`;
rodada 1 em `...\evidencia\20261105-2202-task-09-...\`):
- Offline: `npx tsc --noEmit` 0 erros; `npx vitest run` 279/279 (26 arquivos); `build --bug` exit 0 (vitest 279/279,
  `testDebugUnitTest` 199 sem falha); lane limpa depois do build; diff só em arquivos reservados.
- Controle positivo (`base-713a557.apk`): `task09.mjs` para em `state()` com `editor.getPageCount is not a function`
  (`base/e2e.txt`); sonda `base/controle-positivo.txt`: sem faixa `#pages`, sem `pages` no documento, Tamanho sem
  ✨ Magic Resize, Fundo sem os dois botões, Exportar sem "todas as páginas".
- **T2** (`fix-368ddcf.apk`): `task09.mjs` versionado **26/26** sem nenhuma repetição de passo (`fix/e2e.txt`, prints
  `fix/09-*`): duplicar, nova com o fundo herdado, editar/ir/voltar, undo cruzado, reordenar, excluir (desabilitado com
  1) + ↶↶, reabrir pelo Rascunhos após `force-stop`, Magic Resize 1080×1920 / 1920×1080 / 1200×1200 (dentro da página,
  fundo cobre, geometria 9:16 e 16:9), extrair da foto (contraste 3,17 e 3,22), aplicar em todas + um ↶, exportar 6 PNG
  (apagados no fim) e volta à página ativa; sem exceção JS.
- **T3:** `task12` 40/40, `task14` 50/50, `task03` 19/19, `task11` 25/25 (1ª execução parou após 16 PASS num
  `typeInto` do próprio task11 — campo do inspetor sumiu com o teclado mexendo o layout; repetida passou inteira:
  `t3-task11/` e `t3-task11-rerun/`); rascunho antigo `E2E13_1793915014648` (de antes do fix) abre sem
  `pages`/`activePageIndex`, "📄 Página 1/1", Tamanho mantém "Ajustar o conteúdo" (`t3-rascunho-antigo/`).
- **T4:** logcat da janela do T2 (`fix/logcat-janela.txt`): só `Receiver not registered` (finalizer) e WebView `Seed
  missing signature`, iguais nas execuções da base; nenhum `FATAL`/ANR/exceção JS.

**Falta para `done/`:** validação do dono no aparelho dele (o moto não pôde ser usado: bloqueio seguro). O moto ficou com o
APK da base `713a557` (instalado na rodada 1, antes de ver o bloqueio). Rascunhos de teste no emulador: `E2E09_*` e
"Post Facebook" das tentativas.

## Metadados e Esforço Mensurado

| Campo | Valor |
| :--- | :--- |
| **ID** | `TASK-09` |
| **Prioridade** | **Média-Alta (Produtividade — P2)** |
| **Esforço Mensurado** | **Médio-Alto** — **~4 a 5 dias úteis (32h–40h / 8 Story Points)** |
| **Escopo** | Local (`editor-web` em TypeScript + ajuste na exportação de múltiplas páginas em `:editor`) |
| **Referência Analisada (`com.desygner.ads`)** | `extracted/assets/public/docs/create.md` (L269–L279, L981–L990: Multi-page Strip, Carousel Assembly, Magic Resize) e `js_pretty/assets/module-create-DxNmnX1s.js` (L272825–L272880: `bgStyleTransfer`, L318880–L318910: `magicResize`) |

### Detalhamento do Esforço por Subtarefa
1. **Evolução de `EditorDocument` (`document.ts`) para Suportar Múltiplas Páginas (`pages?: EditorPage[]`) com Retrocompatibilidade 100%:** ~6h.
2. **Faixa de Páginas (`pageStrip` no `editor.ts` e `main.ts`: Adicionar, Duplicar, Reordenar, Excluir, Transição Rápida):** ~8h.
3. **Magic Resize Multi-Formato (`magicResize.ts`: Selecionar múltiplos formatos com checkbox e reescalar/reposicionar de forma inteligente para novas páginas ou rascunhos):** ~10h.
4. **Transferência de Estilo de Fundo (`bgStyleTransfer.ts`: Extrair paleta/gradiente/mood de uma página/imagem e aplicar às demais):** ~6h.
5. **Testes Unitários (Vitest) e Exportação de Todas as Páginas:** ~4h.

---

## 1. Contexto e Problema Atual

1. **Documento de Página Única:**
   - Hoje [`EditorDocument` em `document.ts` (L41–L49)](file:///c:/projects/sandbox/product_photo_offline/editor-web/src/document.ts#L41-L49) guarda apenas um único `fabric: FabricJson`.
   - Para criar um **Carrossel de Instagram/TikTok (ex.: 5 slides: 1. Capa de Impacto, 2. Benefícios, 3. Tabela de Medidas, 4. Depoimento/Avaliação, 5. Oferta + CTA)** ou um **Encarte/Catálogo de 4 páginas**, o usuário é obrigado a criar 5 rascunhos separados, sem conseguir copiar elementos entre páginas ou visualizar a sequência lado a lado.
2. **Redimensionamento 1-a-1 Simples:**
   - Hoje [`showSize()` em `main.ts` (L749–L782)](file:///c:/projects/sandbox/product_photo_offline/editor-web/src/main.ts#L749-L782) altera o tamanho do documento atual para apenas 1 formato por vez, fazendo um escalonamento uniforme simples ([`Editor.resize()`](file:///c:/projects/sandbox/product_photo_offline/editor-web/src/editor.ts)).
   - Quando se muda de `1080×1080` (Post Quadrado) para `1080×1920` (Story Vertical) ou `1200×628` (Banner Horizontal), um escalonamento simples deixa enormes sobras vazias em cima/embaixo ou nas laterais, sem redistribuir inteligentemente o título, a foto do produto e o preço/CTA.
3. **Falta de Consistência Visual de Fundo entre Páginas (`bgStyleTransfer`):**
   - Ao criar uma nova página no carrossel ou redimensionar para outro formato, o lojista precisa replicar manualmente o estilo de fundo (gradiente, paleta e contraste de texto) da primeira página.

---

## 2. O que deve ser feito (Especificação Técnica Detalhada)

### 2.1. Suporte a Múltiplas Páginas em `EditorDocument` (`document.ts` e `editor.ts`)

1. **Modelo de Dados Retrocompatível (`document.ts`):**
   ```ts
   export interface EditorPage {
     id: string;
     name?: string;
     width: number;
     height: number;
     fabric: FabricJson;
     thumbnail?: string;
   }

   export interface EditorDocument {
     format: typeof DOC_FORMAT;
     version: typeof DOC_VERSION;
     name: string;
     width: number;
     height: number;
     videoSettings?: VideoSettings;
     /** Mantido sincronizado com a página ativa (ou página 0) para 100% de compatibilidade com código legado! */
     fabric: FabricJson;
     /** Lista opcional de páginas (quando o projeto possui >= 1 páginas em modo carrossel/catálogo). */
     pages?: EditorPage[];
     activePageIndex?: number;
   }
   ```
   - `parseDocument()` continua lendo qualquer documento v1 existente sem alterações; se `pages` não existir, inicializa `pages = [{ id: 'p0', width: doc.width, height: doc.height, fabric: doc.fabric }]`.
2. **Gerenciamento de Páginas no `Editor` (`editor.ts`):**
   - Métodos:
     - `getPageCount(): number` e `getActivePageIndex(): number`;
     - `switchToPage(index: number): Promise<void>`: salva o `toCanvasJson()` da página atual no array `pages[currentIndex]`, carrega `pages[index]` no canvas e atualiza o tamanho caso a página tenha dimensão diferente;
     - `addPage(opts?: { duplicateCurrent?: boolean; width?: number; height?: number }): Promise<void>`: cria nova página em branco (herdando o fundo da atual) ou duplica a página ativa (ideal para criar o próximo slide do carrossel mantendo cabeçalho/rodapé e fontes!);
     - `movePage(fromIndex: number, toIndex: number): void` e `deletePage(index: number): Promise<void>`.
3. **Faixa de Páginas (`pageStrip`) na UI (`main.ts`):**
   - Exibir um indicador compacto no topo/base do palco: `📄 Página 1/3 ▾` (ou tira horizontal de miniaturas das páginas com botões `+ Nova página`, `⧉ Duplicar página`, `◀ / ▶` e `🗑️ Excluir página`).

### 2.2. Magic Resize Multi-Formato com Layout Inteligente (`magicResize.ts`)
Inspirado em `magicResize` (`module-create-DxNmnX1s.js` L318880):

1. **Reflow Heurístico por Papel Semântico das Camadas (`smartReflowLayout`):**
   - Quando a razão de aspecto muda significativamente (ex.: de Quadrado $1:1$ para Vertical $9:16$ ou Horizontal $16:9$), em vez de apenas encolher tudo no meio da tela:
     - Classifica as camadas da página original em 4 grupos funcionais:
       1. **Fundo (`isBackground`):** expande em modo `cover` para preencher 100% do novo `targetW × targetH`;
       2. **Cabeçalho / Logo / Selos de Topo (`top < 0.25 * H`):** ancora proporcionalmente na zona segura superior do novo formato;
       3. **Elemento Principal / Produto (`FabricImage` central de maior área):** posiciona em destaque ocupando ~45%–55% da área útil central (ou à esquerda em banners horizontais `16:9` onde $W/H \ge 1.5$!);
       4. **Textos de Oferta / Preço / CTA:** em formato vertical ($9:16$), empilha título no terço superior e preço/CTA no terço inferior (respeitando a *Safe Zone* de Reels/Stories da `TASK-01`); em formato horizontal ($16:9$), posiciona a coluna de textos à direita do produto!
2. **Seleção Múltipla na Aba `Tamanho` (`showSize` em `main.ts`):**
   - Adicionar aba/modo **"✨ Magic Resize (Vários Formatos)"** dentro de `showSize()`:
     - Lista os formatos mais usados com **checkboxes** (ex.: `☑ Post Instagram (1080×1080)`, `☑ Story / Reels (1080×1920)`, `☑ Mercado Livre (1200×1200)`, `☑ Banner Facebook (1200×630)`);
     - Botão **"Gerar N formatos como páginas"** $\to$ cria automaticamente uma página adaptada para cada formato marcado dentro do projeto atual, permitindo revisar todas na tira de páginas e exportar tudo de uma vez!

### 2.3. Transferência de Estilo de Fundo (`bgStyleTransfer.ts`)
Inspirado em `bgStyleTransfer` (`Ibt` em `module-create-DxNmnX1s.js` L272825–L272880):
1. **Extração Local de Estilo (`extractBackgroundStyle`):**
   - Analisa a página ativa ou uma imagem de referência e extrai:
     - `primaryBgColor`, `secondaryBgColor` (para gradiente linear/radial), `mood: 'dark' | 'light' | 'vibrant' | 'minimal'` e `recommendedTextColor` (`#ffffff` se o fundo for escuro, `#111111` se for claro).
2. **Aplicação Rápida (`applyBackgroundStyleToPages`):**
   - Na aba `Fundo` (`showBackgrounds`), adicionar o botão **"🎨 Aplicar estilo deste fundo em todas as páginas"** e **"✨ Extrair fundo da foto do produto"** (cria um degradê suave e harmônico a partir das cores dominantes da foto do produto e ajusta o contraste dos textos).

---

## 3. Arquivos a Criar / Modificar

| Arquivo | Ação | Descrição |
| :--- | :---: | :--- |
| [`editor-web/src/magicResize.ts`](file:///c:/projects/sandbox/product_photo_offline/editor-web/src/magicResize.ts) | **Criar** | Algoritmo de reflow inteligente de camadas (`smartReflowLayout`) para adaptação entre proporções $1:1 \leftrightarrow 9:16 \leftrightarrow 16:9$ e gerador multi-formato. |
| [`editor-web/src/bgStyleTransfer.ts`](file:///c:/projects/sandbox/product_photo_offline/editor-web/src/bgStyleTransfer.ts) | **Criar** | Extrator de paleta, gradiente e `mood` (`dark`/`light`/`vibrant`) a partir de uma página ou imagem do produto e aplicador entre páginas. |
| [`editor-web/src/document.ts`](file:///c:/projects/sandbox/product_photo_offline/editor-web/src/document.ts) | **Modificar** | Adicionar `EditorPage`, `pages?: EditorPage[]` e `activePageIndex?: number` em `EditorDocument` com retrocompatibilidade. |
| [`editor-web/src/editor.ts`](file:///c:/projects/sandbox/product_photo_offline/editor-web/src/editor.ts) | **Modificar** | Adicionar métodos de gestão multi-página (`switchToPage`, `addPage`, `duplicatePage`, `deletePage`, `movePage`, `exportAllPagesRaster`). |
| [`editor-web/src/main.ts`](file:///c:/projects/sandbox/product_photo_offline/editor-web/src/main.ts) | **Modificar** | Adicionar barra/sheet de **Páginas (Carrossel)**, modo **✨ Magic Resize** em `showSize()`, botão de transferência de estilo em `showBackgrounds()` e opção *"Exportar todas as páginas"* em `showExport()`. |
| [`editor-web/test/magicResize.test.ts`](file:///c:/projects/sandbox/product_photo_offline/editor-web/test/magicResize.test.ts) | **Criar** | Testes unitários validando a adaptação de coordenadas de $1080\times1080$ para $1080\times1920$ e $1920\times1080$, gestão de `pages[]` em `document.ts` e `bgStyleTransfer`. |

---

## 4. Critérios de Aceite e Verificação

- [ ] O usuário consegue criar um carrossel com múltiplas páginas (adicionar página em branco, duplicar página atual, alternar entre páginas, reordenar e excluir), e tudo é salvo no mesmo rascunho.
- [ ] Na aba **Tamanho**, o modo **✨ Magic Resize** permite marcar 3 formatos diferentes de uma vez e gera as 3 versões adaptadas com reposicionamento inteligente do produto e dos textos.
- [ ] Na aba **Fundo**, o botão **"✨ Extrair fundo da foto do produto"** cria um gradiente harmônico com a embalagem do produto e permite replicar o estilo para todas as páginas do carrossel.
- [ ] `npx vitest run` e `npm run build` executam com 0 erros.


---

## Planejamento (pipeline 20261105-1638, 2026-11-05)

**Veredito:** corrigir — tudo cabe em `editor-web/` (TS + bundle). O Kotlin grava o documento como JSON opaco e já exporta
um arquivo por pedido com nome único, então nenhum módulo Gradle muda (só o bundle versionado em `:editor`).
**Complexidade:** alta — formato de dados novo (`pages[]` no documento `pp-editor`), histórico (undo) entre páginas e
geometria no Fabric (reflow); um módulo só, sem mudança na ponte.
**Severidade:** medio — funcionalidade nova (P2). Hoje dá para contornar com um rascunho por slide e o "Tamanho" 1-a-1.
**Tamanho estimado:** ~1.400 linhas novas (src ~850, testes ~300, E2E ~250), abaixo do teto de ~1.500 do manual. Se a
implementação passar muito disso, a ordem de corte é: 1) páginas + salvar/exportar todas, 2) Magic Resize, 3) estilo
de fundo. Entregar um bloco pela metade não vale: o que não couber fica para uma task nova, escrito no doc.

**Arquivos a alterar (reserva da onda):**
- `editor-web/src/document.ts` — `EditorPage`, `pages?`, `activePageIndex?` (continua `DOC_VERSION = 1`); `parseDocument`
  valida/normaliza `pages`; `fontsUsed` passa por todas as páginas.
- `editor-web/src/history.ts` — `replace(state)`: troca o estado atual sem empilhar (trocar de página não é edição).
- `editor-web/src/editor.ts` — páginas (`getPageCount`, `getActivePageIndex`, `switchToPage`, `addPage`, `movePage`,
  `deletePage`, miniaturas), `load`/`toDocument`/`restore` com páginas, `magicResize(formats)`, aplicar o fundo em todas
  as páginas, `exportAllPagesRaster`.
- `editor-web/src/magicResize.ts` — **novo**: `smartReflowLayout` puro (caixas → novas posições/escalas).
- `editor-web/src/bgStyleTransfer.ts` — **novo**: `extractBackgroundStyle` puro (cores dominantes → degradê, mood, cor de texto).
- `editor-web/src/main.ts` — faixa de páginas, modo ✨ Magic Resize no `showSize`, botões no `showBackgrounds`,
  "Exportar todas as páginas" no `showExport`.
- `editor-web/src/brandkit.ts` — `applyBrandKit` aplica o kit em todas as páginas, não só em `fabric`.
- `editor-web/index.html` — container da faixa de páginas (`<div id="pages">`), se ela não for criada pelo JS.
- `editor-web/src/styles.css` — estilos da faixa e das miniaturas.
- `editor-web/test/document.test.ts`, `editor-web/test/history.test.ts`, `editor-web/test/brandkit.test.ts` — casos novos.
- `editor-web/test/magicResize.test.ts`, `editor-web/test/bgStyleTransfer.test.ts` — **novos**.
- `tools/e2e/task09.mjs` — **novo**: E2E da T2.
- `editor/src/main/assets/editor/index.html` — bundle regerado (os `assets/index-<hash>.*` entram por `claim` no dev).

### Causa raiz (símbolos abertos: `arquivo::simbolo` — faz X; em erro, Y)

Como é task, a "causa" aqui é por que a funcionalidade não existe e onde ela entra.

- `editor-web/src/document.ts::EditorDocument` (L63–71) — só `name/width/height/videoSettings/fabric`, sem páginas.
  `createDocument` (L100) monta o objeto com esses campos e **descarta qualquer outro**. Se o dev não o mudar, `pages`
  some no `toDocument`.
- `document.ts::parseDocument` (L127–160) — aceita v0 (Fabric cru), o formato antigo `scenes` e a v1; em erro lança
  `DocumentError`, e com `version !== 1` também lança. **Por isso `pages` entra como campo opcional da v1, não como v2**:
  um app antigo abre um rascunho de várias páginas mostrando só a página ativa, em vez de recusar o arquivo.
  O `parseDocument` re-chama `createDocument`, então `pages` precisa ser lido e repassado aqui também.
- `document.ts::fontsUsed` (L180) — passa só por `doc.fabric.objects`. Quem chama: `Editor.load` (antes do
  `loadFromJSON`) e `Editor.exportSvg` (L1507). Com páginas, a fonte de uma página não ativa não carrega. Solução: incluir
  `pages[*].fabric`, ou chamar `ensureFonts` no `switchToPage`.
- `editor-web/src/editor.ts::Editor.load` (L208–227) — `parseDocument` → `ensureFonts` → define tamanho e nome →
  `videoSettings` com `width/height` do doc → `loadFromJSON(doc.fabric)` fora do histórico → `syncLocks`/`refitCurves`/
  `fit` → `history.reset(snapshot)` → `onChange`. Quem chama: `main.ts::start()` (rascunho), `bridge 'loadProject'`
  (L60), `applyKit` (L147, sobre `toDocument()` + `applyBrandKit`), `openTemplate`, `newDocument`.
- `editor.ts::Editor.toDocument` (L233–237) — `canvas.toObject()` + `brandBackground` → `createDocument(...)`. É o que vai
  para o `saveDraft`, para o `getDocument` da ponte e para **todo instantâneo do histórico** (`snapshot`, L239).
- `editor.ts::Editor.restore` (L263–278) — undo/redo: `parseDocument(state)` → `loadFromJSON(doc.fabric)`; o tamanho só
  muda se for diferente. Não toca em nome nem em vídeo. Com páginas, precisa restaurar o `pages[]` inteiro e o índice ativo.
- `history.ts::History` — `push` ignora estado igual ao atual (comparação de string); também há `reset`, `undo` e `redo`.
  Não há como trocar o estado atual sem empilhar, então o `replace` é novo.
- `editor.ts::Editor.resize` (L298–318) — com `scaleContent`, escala uniforme `min(sx,sy)` e centraliza; pula a camada
  `layerName === 'background'`, depois faz `coverPage` + `refreshGradient` do fundo, `fit` e `commit`. É a base do Magic
  Resize: chamar com `scaleContent=false` e depois posicionar pelo reflow.
- `editor.ts::backgroundLayer/coverPage/replaceBackgroundLayer/setBackgroundColor/setBackgroundGradientSpec/
  setBackgroundImage/backgroundGradient` (L391–447) — o fundo é `canvas.backgroundColor` **ou** uma camada
  `layerName='background'` (Rect com `customGradient`, ou imagem) no índice 0. `setBackgroundGradientSpec` gera o degradê
  com as coordenadas do tamanho da página atual (`buildFabricGradient(spec, w, h)`). Por isso, para aplicar o fundo em
  páginas de outro tamanho, o certo é recriá-lo a partir do `customGradient` em cada página, nunca copiar o objeto Rect.
- `editor.ts::exportRaster` (L1482) / `renderPage` (L1431) / `thumbnail` (L1489) — rasterizam **o canvas atual**. Para
  "todas as páginas" é preciso, para cada página, trocar a página no canvas, rasterizar e depois voltar à página de antes.
- `editor.ts::renderThumbnail` (L1651) — renderiza `doc.fabric` num `StaticCanvas` fora do editor. Serve para as
  miniaturas da faixa sem trocar de página (custo: um `loadFromJSON` por página).
- `main.ts::saveDraft` (L131–143) — manda `{id, name, document: editor.toDocument(), thumbnail: editor.thumbnail()}`.
  Um rascunho com páginas sai daqui sem mudar nada, desde que o `toDocument` leve `pages`.
- `editor/src/main/kotlin/com/productphoto/editor/EditorSession.kt::saveDraft` (L173–179) → `data/.../Drafts.kt::
  FileDraftRepository.save` (L63) → `header()` (L91) — o Kotlin só lê `format == 'pp-editor'` e `width/height` em
  1..8000, e grava `document.toString()` inteiro. Em erro, lança e o JS mostra "Rascunho não salvo". **`pages` passa sem
  mudança no Kotlin**, desde que `width/height` da raiz sejam os da página ativa.
- `EditorSession.kt::export` (L238) → `exportName` (L324: `base_yyyyMMdd_HHmmss`) → `EditorScreen.kt` (L74) →
  `EditorExports.save` (L23: MediaStore, `Pictures/<ALBUM>`). Cada pedido `export` grava um arquivo. Com
  `name = "<nome>_p1"`, `"<nome>_p2"`…, os nomes saem distintos no mesmo segundo. **Exportar todas é um laço no JS, e o
  Kotlin não muda.** Compartilhar e imprimir continuam com uma página só (cada pedido abre o próprio diálogo).
- `main.ts::showSize` (L1407–1456) — `apply(W,H)` → `editor.resize(W,H,scale)`. Lista os formatos de
  `formats.ts::DESIGN_FORMATS` agrupados por `GROUP_LABELS`. O modo Magic Resize reaproveita esse catálogo com checkbox.
  **O catálogo não tem "Mercado Livre 1200×1200" nem "Banner Facebook 1200×630"** (os exemplos do §2.2). Os equivalentes
  são `li_square` 1200×1200, `li_post` 1200×627, `fb_post` 1080×1080, `ig_reels`/`story` 1080×1920 e `banner` 1920×1080.
  Usar o catálogo; não inventar formato.
- `main.ts::showBackgrounds` (L1371–1391) — cor sólida, degradê personalizado, presets, imagens e cores da marca. Os
  botões novos entram aqui.
- `main.ts::mainProductImage` (L358) — a maior `FabricImage` visível que não é fundo (já usada pela paleta).
  `imageColors` (L370) — até 4 cores dominantes por `palette.ts::dominantColors` numa grade 16×16; com imagem de outra
  origem (canvas sujo) devolve `[]`, porque o `catch` engole o erro. Ou seja: "Extrair fundo da foto" sem cor precisa de
  toast, não de degradê vazio.
- `contrast.ts::relativeLuminance/contrastRatio/suggestReadableColor/LOW_CONTRAST` e `gradients.ts::evenStops/
  GradientSpec` — já existem e dão `mood` e `recommendedTextColor` sem código novo de cor.
- `main.ts::showExport` (L1751–1807) — formato, escala, salvar/compartilhar/imprimir e mockup. "Exportar todas as
  páginas" só faz sentido com PNG/JPG e "Salvar na galeria".
- `brandkit.ts::applyBrandKit` (L89–118) — copia o doc e anda só em `out.fabric.objects`. Com páginas, o kit chegaria só
  à ativa (e o `load` seguinte sobrescreveria a ativa com `fabric`, o que é o certo).
- Leitores de `doc.fabric` no Kotlin: só os testes instrumentados (`EditorExportInstrumentedTest.kt:78`,
  `EditorBridgeInstrumentedTest.kt:154/194`, via `getDocument`). Com `fabric` = página ativa, eles continuam valendo.

**O desenho que sai disso (o dev confere ao abrir):**
1. O `Editor` guarda `pages: EditorPage[]` e `activePage`. O canvas é sempre a página ativa. `toDocument()` grava
   `pages[active] = {id, width, height, fabric: canvas.toObject()}`, e `fabric/width/height` da raiz são os da página
   ativa (o Kotlin e os leitores antigos continuam funcionando). **Um documento de uma página só sai sem `pages`**, para
   que o rascunho antigo fique idêntico no round-trip e os testes atuais não mudem.
2. `load(doc)`: se `pages` existir, a página ativa vem de `doc.fabric/width/height` (é o que `applyKit` e o
   `loadProject` mandam), e as outras de `pages[i]`. `activePageIndex` fora da faixa → 0.
3. `switchToPage(i)`: `flushPending` → grava a atual em `pages[active]` → `ensureFonts` da página nova →
   `loadFromJSON(pages[i].fabric)` sem histórico → tamanho e `videoSettings.width/height` → `syncLocks`/`refitCurves`/`fit`
   → `history.replace(snapshot)`, sem empilhar. O undo de uma edição feita em outra página volta para aquela página
   (`restore` lê `activePageIndex` do instantâneo).
4. `addPage`, `movePage` e `deletePage` são edições: empilham no histórico e chamam `onChange` (o rascunho salva sozinho
   em 4 s). `deletePage` não apaga a última página.
5. Magic Resize: para cada formato marcado, duplica a página ativa como página nova, chama `resize(W,H,false)` e aplica
   `smartReflowLayout` sobre as caixas dos objetos (papel: fundo / topo `top < 0.25·H` / produto = maior imagem / textos).
   O reflow é puro (números → números), para o vitest provar. A caixa vem do Fabric (`getBoundingRect`): **o dev confere
   na fonte do fabric 7.4.0 em que plano ela volta** (cena × viewport) antes de usar. O posicionamento é por
   `setPositionByOrigin`/centro, como o `refitCurve` já faz.
6. Estilo de fundo: `extractBackgroundStyle(colors)` → `{primaryBgColor, secondaryBgColor, mood, recommendedTextColor}`.
   "Extrair da foto" = `imageColors(mainProductImage())` → degradê linear `GradientSpec`, mais o ajuste dos textos cujo
   contraste com o fundo novo fique `< LOW_CONTRAST`. "Aplicar em todas" = ler o fundo da ativa (cor, `customGradient` ou
   imagem `src`) e recriá-lo em cada página, no tamanho dela, numa entrada só do histórico.

### Provas (comando literal -> resultado)

- `wc -l editor-web/src/*.ts` → `editor.ts` 1.719, `main.ts` 1.893, `document.ts` 193 (base `0d616c3`).
- `grep -rn "toDocument()\|\.fabric\b\|parseDocument(" editor-web/src` → leitores de `fabric`: `brandkit.ts:92/115`,
  `editor.ts:214/219/266/269/1507/1657`, `main.ts:65/134/147/154/1138`. Todos leem a página única, e é isso que os
  itens 1–2 do desenho preservam.
- `grep -rn "editor.load\|getDocument\|\"fabric\"" app/src editor/src --include=*.kt` → só os testes instrumentados leem
  `fabric`; nenhum código de produção Kotlin olha dentro do documento além de `Drafts.header`.
- `sed -n 91,99p data/src/main/kotlin/com/productphoto/data/Drafts.kt` → `header` exige só `format`, `width` e `height`.
- `formats.ts` (L20–57) → não há 1200×1200 "Mercado Livre" nem 1200×630; há `li_square`, `li_post`, `story` e `banner`.

### Hipóteses descartadas (e por quê)

- **`DOC_VERSION = 2` para páginas:** o `parseDocument` de um app antigo recusaria o rascunho inteiro
  (`unsupported version`). Com campo opcional na v1, o app antigo abre a página ativa.
- **Mexer no Kotlin para "exportar todas" (ZIP/lote):** `export` já grava um arquivo por pedido com nome único, e o lote
  em ZIP é escopo da TASK-10 (`EditorExports.kt`). Aqui o Kotlin não muda. A linha "+ ajuste na exportação de múltiplas
  páginas em `:editor`" dos metadados não se confirma.
- **Um canvas Fabric por página:** multiplica a memória (imagens decodificadas) no WebView do celular. Fica um canvas só,
  com as páginas inativas guardadas como JSON.
- **Copiar o objeto de fundo (Rect) entre páginas:** as coordenadas do degradê são do tamanho da página de origem
  (`buildFabricGradient(spec, w, h)`), então numa página de outro tamanho o degradê sai torto. Recriar pelo `customGradient`.
- **Trocar de página empilhando no histórico:** o "↶" passaria a só alternar páginas. Daí o `History.replace`.
- **Testar o reflow com Fabric no vitest:** `fabric/node` precisa de `canvas` nativo (ARQUITETURA §15.3). Por isso o
  reflow e a extração de estilo são funções puras sobre números e cores, e o comportamento no canvas é provado pelo E2E.

### Tarefas

- [ ] `document.ts::EditorPage/EditorDocument/createDocument/parseDocument/fontsUsed` — `pages?` e `activePageIndex?`
  opcionais; validar cada página (tamanho por `checkSize`, `fabric.objects` array); doc de 1 página sai sem `pages` —
  vitest `document.test.ts`: round-trip com 3 páginas; doc v1 sem `pages` inalterado; página inválida → `DocumentError`;
  índice fora da faixa → 0; `fontsUsed` acha a fonte de uma página inativa.
- [ ] `history.ts::History.replace` — vitest `history.test.ts`: `replace` não cria undo e não mexe em `past`/`future`.
- [ ] `editor.ts`, páginas (`getPageCount`, `getActivePageIndex`, `switchToPage`, `addPage({duplicateCurrent, width,
  height})`, `movePage`, `deletePage`, `load`/`toDocument`/`restore`) — E2E `task09.mjs` (casos 1–6 da T2 e o undo cruzado).
- [ ] `magicResize.ts::smartReflowLayout` (+ classificação das camadas) — vitest `magicResize.test.ts`: 1080² → 1080×1920
  (produto centralizado com ~45–55% da área útil, título no terço de cima, preço/CTA no de baixo, dentro da zona segura
  9:16 da TASK-01); 1080² → 1920×1080 (produto à esquerda, textos à direita); o fundo vira `cover`; nada sai da página.
- [ ] `editor.ts::magicResize(formats)` + `main.ts::showSize` (modo ✨ com checkbox sobre o `DESIGN_FORMATS`, botão "Gerar
  N formatos como páginas") — E2E caso 7.
- [ ] `bgStyleTransfer.ts::extractBackgroundStyle` — vitest `bgStyleTransfer.test.ts`: cores escuras → `mood: 'dark'` e
  texto `#ffffff`; claras → `light` e `#111111`; saturadas → `vibrant`; lista vazia → `null`; contraste texto/fundo ≥ 4,5.
- [ ] `editor.ts`, aplicar o fundo em todas, + `main.ts::showBackgrounds` ("🎨 Aplicar estilo deste fundo em todas as
  páginas", "✨ Extrair fundo da foto do produto"; sem foto ou sem cor → toast) — E2E casos 8–9.
- [ ] `editor.ts::exportAllPagesRaster` + `main.ts::showExport` ("Exportar todas as páginas (N)", só PNG/JPG + Salvar;
  volta à página de antes) — E2E caso 10.
- [ ] `brandkit.ts::applyBrandKit` também em `pages[*].fabric` — vitest `brandkit.test.ts`.
- [ ] `main.ts`, faixa de páginas (`📄 Página i/N`, miniaturas, `+ Nova`, `⧉ Duplicar`, `◀ ▶`, `🗑️`) + `styles.css`
  (+ `index.html` se precisar) — E2E casos 1–5.
- [ ] Leitura para o teste pelo `window.editor` (já exposto): `getPageCount()`, `getActivePageIndex()`,
  `toDocument().pages`. Nenhum atalho que pule a UI.
- [ ] `npx tsc --noEmit` + `npx vitest run` em `editor-web/`; `build --bug <slug>` em background; commit do código junto
  com o bundle, `feat(editor): ... (TASK-09)`.

### Plano de teste

- **Offline (sem slot):** `npx tsc --noEmit`; `npx vitest run` (os casos novos acima, mais os 161 atuais sem regressão:
  `document`, `history` e `brandkit` intocados nos casos de uma página); o `build` do helper (vitest + `testDebugUnitTest`).
  O `parseDocument` de um rascunho atual (v1 sem `pages`) tem que sair idêntico (`toEqual`).
- **T2 reprodução como o usuário (E2E, no slot):** `tools/e2e/task09.mjs`, com cwd na lane:
  `ANDROID_SERIAL=<serial> node tools/e2e/task09.mjs <evidencia>`. Partida: `launchEditor()` → "Novo design → Post
  Facebook" (1080×1080; no moto, `E2E_FORMAT="Post Instagram"`, 1080×1350, e as contas de geometria usam
  `editor.width/height`). Montagem pela UI: aba **Texto** → um título e um texto de preço; aba **Imagem** → Galeria → 1º
  item (`/sdcard/Pictures/e2e_swap.jpg`; o tester confere que ele existe e que não há SVG recente na galeria, ver
  `docs/bugs/open/editor-galeria-svg-pickimage.md`); aba **Fundo** → um degradê de preset. Sinais lidos por CDP em
  `editor`, prints por `screencap`:
  1. A faixa mostra `Página 1/1`. Toque em `⧉ Duplicar` → `editor.getPageCount() === 2`, `getActivePageIndex() === 1`, e a
     página 2 tem os mesmos objetos (mesma contagem e mesmos textos).
  2. Toque em `+ Nova` → 3 páginas; a página nova não tem camadas, mas herda o fundo (mesmo `customGradient`).
  3. Editar o texto na página 2; `◀` para a 1 → o texto da 1 está inalterado; `▶` de volta → a edição está lá.
  4. Reordenar: mover a página 3 para a 1ª posição → a ordem dos `id` em `toDocument().pages` mudou e a ativa continua
     sendo a mesma página.
  5. `🗑️` numa página → N−1 páginas; com 1 página, o botão fica desabilitado.
  6. Persistência: "Salvar" (ou esperar 4 s) → `am force-stop` → abrir o app → **Rascunhos** → tocar no rascunho →
     `toDocument().pages.length` igual ao de antes e o texto da página 2 igual. É o critério "tudo é salvo no mesmo
     rascunho".
  7. Aba **Tamanho** → ✨ Magic Resize → marcar 3 formatos (Story 1080×1920, Banner 1920×1080, Post LinkedIn quadrado
     1200×1200) → "Gerar 3 formatos como páginas" → +3 páginas com esses tamanhos. Em 9:16, o centro da foto fica no terço
     do meio e o título acima dela; em 16:9, o centro da foto fica em `x < W/2` e os textos em `x > W/2`; nenhum objeto sai
     da página (bbox dentro de `[0,W]×[0,H]`); o fundo cobre a página. Um print de cada.
  8. Aba **Fundo** → "✨ Extrair fundo da foto do produto" → a camada de fundo tem `customGradient` com cores tiradas da
     foto (diferentes do preset), e os textos têm contraste ≥ 3 sobre o fundo novo.
  9. "🎨 Aplicar estilo deste fundo em todas as páginas" → todas as páginas, inclusive as de outro tamanho, com o mesmo
     `customGradient` e a camada de fundo no tamanho da própria página. Um "↶" desfaz tudo de uma vez.
  10. **Exportar** → PNG → "Exportar todas as páginas (N)" → "Salvar na galeria" → N arquivos `<nome>_p1..pN_*.png` novos
     em `Pictures/<álbum do app>` (`adb shell content query --uri content://media/external/images/media --projection
     _display_name`, filtrado pelo nome, ou `ls` da pasta); depois a página ativa é a mesma de antes. Apagar os exports de
     teste no fim.
  Undo cruzado: editar na página 2, ir para a 1, "↶" → volta à página 2 com a edição desfeita.
- **Controle positivo:** APK da base (`build` com `git checkout --detach <base>`), com o mesmo começo: não há faixa de
  páginas, `editor.getPageCount` é `undefined`, a aba Tamanho não tem ✨ Magic Resize e a aba Fundo não tem os dois botões.
  O script tem que falhar já no caso 1, e isso conta como prova da ausência.
- **T3 regressão direcionada:** `tools/e2e/task12.mjs` (degradê de fundo, `customGradient`, formas), `task11.mjs`
  (camadas, agrupar, cadeado, inspetor; usa o histórico e o `restore`), `task14.mjs` (localizar/substituir e desenho; usa
  `textLayers` e o histórico) e `task03.mjs` (paleta/conta-gotas; usa `mainProductImage`/`imageColors`). Mais: abrir um
  rascunho **antigo** (de uma página, salvo antes do fix) e conferir que ele abre igual e sem `pages`, e que o "Tamanho"
  normal (1 formato, "Ajustar o conteúdo") segue igual. Vídeo (`task04.mjs`) só se o dev mexer em `videoSettings` além de
  `width/height`.
- **T4:** logcat do PID sem erro novo de `chromium` nem `Uncaught` durante a troca de páginas e o Magic Resize.

### Nota do dev (2026-11-05, antes da 1ª edição)

Conferido na base `713a557` (o `main` andou desde o planejamento; as linhas citadas acima mudaram):
- `wc -l` → `editor.ts` 2.099, `main.ts` 2.177. `Editor.load` L448, `toDocument` L476, `snapshot` L482, `restore` L506,
  `resize` L552, fundo L647–704, `renderPage` L1790, `exportRaster` L1841, `thumbnail` L1848, `flushPending` L1853,
  `exportSvg` L1866 (usa `fontsUsed(this.toDocument())`), `renderThumbnail` L2028. `main.ts`: `saveDraft` L139, `applyKit`
  L154, `mainProductImage` L416, `imageColors` L428, `textContrast` L485 (renderiza a página sem o texto e tira a média de
  9 pontos; em erro devolve `null`), `showBackgrounds` L1620, `showSize` L1656, `showExport` L2033, `start` L2092.
- **Plano da caixa no fabric 7.4.0** (`node_modules/fabric/src/shapes/Object/ObjectGeometry.ts`): `getBoundingRect()` =
  `makeBoundingBoxFromPoints(getCoords())`, e `getCoords()` são os `aCoords` (`calcACoords`: centro relativo + ângulo +
  `_getTransformedDimensions`), **sem viewport** → plano da cena (px do documento). Os `aCoords` ficam em cache: o reflow
  chama `setCoords()` antes de ler e depois de mudar escala/posição.
- `loadFromJSON` (Fabric) não muda o JSON de entrada; mesmo assim as páginas inativas guardam uma cópia
  (`JSON.parse(JSON.stringify(canvas.toObject()))`), porque o `toObject` repassa por referência as propriedades próprias
  (`customGradient`, `connectorSpec`...).
- `enlivenObjectEnlivables` revive qualquer valor com `type` registrado (o `fill` de degradê): dá para recriar o fundo de
  outra página só no JSON, com `buildFabricGradient(spec, w, h).toObject()`.
- `ensureFonts` só espera as fontes já registradas; `load` passa a esperar as fontes de todas as páginas (`fontsUsed`), e o
  `exportSvg` embute só as da página ativa (`fabricFontsUsed`).

Decisões que o plano deixou abertas:
- **Reflow por blocos:** os objetos viram 4 blocos (cabeçalho = topo `< 0,25·H` que não é texto grande; título = acima do
  produto; preço/CTA = abaixo; produto = maior imagem). Cada bloco escala por inteiro e mantém o arranjo interno. Texto na
  altura do produto (o `addText` centraliza tudo) desempata pelo tamanho da fonte: o maior vai para o título, o resto para
  o CTA. 9:16 (W/H < 0,8): faixa útil entre a zona segura da TASK-01 (topo 150, base 320 a cada 1920 px) e a margem;
  30% de cima para cabeçalho/título, 50% para o produto, 20% para o CTA (a "área útil" de 45–55% é a ALTURA da faixa, no
  vertical, e a LARGURA, no horizontal). W/H ≥ 1,5: produto na metade esquerda, textos empilhados na direita. Entre os
  dois, o mesmo empilhamento do vertical sem a zona segura. Proporção quase igual à de origem (razão < 1,15): escala
  uniforme, como o "Tamanho" com "Ajustar o conteúdo".
- **Miniaturas** não entram no documento (o `thumbnail?` da especificação ficaria velho a cada edição e engordaria o
  rascunho): a faixa as renderiza com `renderThumbnail` ao abrir a folha de páginas.
- **Faixa de páginas**: `<div id="pages">` entre o palco e o painel de propriedades (`◀`, `📄 Página i/N`, `▶`, `＋ Nova`,
  `⧉ Duplicar`, `🗑️`); o rótulo abre a folha "Páginas" (miniaturas; tocar vai à página; `◀`/`▶` em cada uma reordena).
- **Trocar de página não chama `onChange`** (não suja o rascunho nem salva): só a faixa se atualiza (`onPages`).
- **Estilo de fundo:** `extractBackgroundStyle` escolhe a cor de texto (`#ffffff`/`#111111`) pelo menor contraste entre as
  duas paradas e **escurece/clareia as paradas** até 4,5:1 com ela; "Extrair da foto" troca o fundo da página ativa e
  recolore os textos com contraste `< LOW_CONTRAST` (medido por `textContrast`).

### Sessões seguintes

- dev: effort high, ultrathink sim — modelo de dados com retrocompatibilidade, histórico entre páginas e geometria no
  Fabric (reflow por papel), com muitos caminhos (load/restore/applyKit/troca de página) que precisam concordar.
- teste: effort medium, ultrathink não — o roteiro E2E é longo, mas os sinais são objetivos (contagens, tamanhos, bbox,
  arquivos). O cuidado é com o aparelho compartilhado e com apagar os exports.

## Correcao (pipeline 20261105-1638, rodada 1)

Tamanho: ~1.450 linhas novas (src ~880, testes ~290, E2E 283), dentro do teto. Nenhum bloco cortado; Kotlin intocado.

**O que mudou (`arquivo::simbolo`):**
- `document.ts::EditorPage/DocumentPages/MAX_PAGES` (novos); `EditorDocument.pages?/activePageIndex?` (v1, campo opcional);
  `createDocument(…, pages?)` só grava `pages` com 2+ páginas (rascunho de 1 página fica idêntico); `parsePages`
  valida cada página (`checkSize`, `id` não vazio e único, `fabric.objects` array → senão `DocumentError`) e devolve o
  índice ativo fora da faixa como 0; `fontsUsed` passa por todas as páginas e o novo `fabricFontsUsed(fabric)` por uma.
- `history.ts::History.replace` — troca o estado atual sem empilhar nem mexer em `past`/`future`.
- `editor.ts::Editor` — estado `pages`/`activePage` + `onPages`; `load`/`restore` por `setPagesFrom` (a ativa é a raiz do
  documento; o `restore` volta à página do instantâneo, com o encaixe da tela); `toDocument` com `pages` (a ativa sai do
  canvas); `getPageCount`, `getActivePageIndex`, `pageList`, `switchToPage` (sem passo no undo: `History.replace`),
  `addPage({duplicateCurrent,width,height})` (em branco herda só a camada de fundo e a cor; noutro tamanho o fundo é
  refeito por `fitBackgroundJson`), `movePage`, `deletePage` (nunca a última), `pageThumbnail`, `magicResize(formats)`
  (+ `reflowCanvas`: mede `getBoundingRect` depois de `setCoords`, escala e recentra cada objeto), `applyBackgroundToAllPages`
  (recria o degradê pelo `customGradient` no tamanho de cada página, um passo do undo), `exportAllPagesRaster` (uma
  página por vez, volta à de antes). As operações assíncronas de página passam por uma fila (`serial`): dois toques
  seguidos não se cruzam. `exportSvg` embute só as fontes da página ativa. Com a máscara aberta, as operações recusam.
- `magicResize.ts` (novo) — `reflowMode`, `safeZone916`, `classifyLayers`, `smartReflowLayout` (blocos por papel; ver a
  nota do dev acima; o produto fica com 50% da faixa útil no vertical, `PRODUCT_SHARE`).
- `bgStyleTransfer.ts` (novo) — `extractBackgroundStyle` (degradê 45° da 1ª para a 2ª cor dominante, `mood`, texto
  `#ffffff`/`#111111` e paradas ajustadas até 4,5:1), `moodOf`, `saturation`, `mix`, `worstContrast`.
- `brandkit.ts::applyBrandKit` — aplica em `fabric` e em cada `pages[i].fabric` (a ativa, que é o mesmo objeto nos dois,
  passa uma vez só: `applyToFabric`).
- `main.ts` — faixa `#pages` (`renderPageBar`: `◀`, `📄 Página i/N`, `▶`, `＋ Nova`, `⧉ Duplicar`, `🗑️` com confirmação e
  desabilitado com 1 página); folha `showPages` (miniaturas; tocar abre; `◀`, `⇤ início`, `▶` reordenam); `showSize`
  ganha "✨ Magic Resize (vários formatos)" → `showMagicResize` (checkbox sobre `DESIGN_FORMATS`, botão "Gerar N formatos
  como páginas"); `showBackgrounds` ganha "✨ Extrair fundo da foto do produto" (`extractBackgroundFromPhoto`: sem foto ou
  sem cor → toast; recolore texto com contraste `< 3` pela cor do estilo ou, se ela não se lê sobre o que está atrás do
  texto, por `suggestReadableColor`) e "🎨 Aplicar estilo deste fundo em todas as páginas"; `showExport` ganha
  "Exportar todas as páginas (N)" (só PNG/JPG com 2+ páginas; nomes `<nome>_p1..pN`).
- `index.html` (`<nav id="pages">`), `styles.css` (faixa, miniaturas, checkbox do Magic Resize).
- Testes: `document.test.ts` (+5), `history.test.ts` (+1), `brandkit.test.ts` (+1), `magicResize.test.ts` (9),
  `bgStyleTransfer.test.ts` (7). E2E `tools/e2e/task09.mjs` (casos 1–10 + undo cruzado).

**Provas offline (comando → resultado):**
- `npx tsc --noEmit` → 0 erros; `npx vitest run` → 26 arquivos, 279 testes ok.
- Mutação: `textLeft = m` e `PRODUCT_SHARE → 0,3` em `magicResize.ts`, laço de legibilidade desligado em
  `bgStyleTransfer.ts` → 3 testes falham; código restaurado → 16/16.
- Smoke do `Editor` real (Fabric 7.4.0) no Chrome headless da máquina, servido por `npx vite` (não é o app nem o build;
  script descartável na pasta do job): 22/22 — duplicar, nova com o fundo, editar/ir/voltar, undo cruzado, reordenar,
  apagar + undo, `load(toDocument())`, Magic Resize (9:16 produto no terço do meio e título acima; 16:9 produto à
  esquerda e textos à direita; tudo dentro; fundo cobre; um undo desfaz), extrair da foto, aplicar em todas (degradê
  refeito: 1080×1920 → coords `(-210,210)–(1290,1710)`), exportar todas na ordem e volta à página, sem exceção JS.

**Ajustes ao Plano de teste:**
- No E2E, o tipo da instância no Fabric 7 é minúsculo (`o.type === 'image'`); no JSON é `'Image'` (o script usa cada um
  no seu lugar).
- Caso 4 pela folha "📄 Páginas" (toque no rótulo da faixa) → `⇤` na 3ª miniatura. Caso 5 tem confirmação ("Excluir").
- O `↷` depois do undo cruzado volta ao instantâneo que lembra a página onde o usuário estava (a 1ª), com a edição de
  volta na 2ª: o E2E confere a edição em `pages[1]`, não a página ativa.
- O script deixa o rascunho `E2E09_<id>` (apagar pelo Rascunhos) e apaga os PNG exportados no fim.

### Teste rodada 1 — reprovado

**Motivo:** o E2E entregue `tools/e2e/task09.mjs` (a prova T2 declarada no Plano de teste) **não roda**: quebra
sempre na montagem, antes do caso 1, com o APK do fix e com o da base. A funcionalidade em si foi aprovada em tudo o que
o script confere (26/26, com uma cópia do script corrigida só no harness — ver abaixo), mas o artefato de prova
versionado fica quebrado para o dono e para os próximos testes; o testador não corrige código.

**Falha (esperado x observado), APK do fix `254cb99` no emulador `pp_api34`:**
1. `task09.mjs:76–79`: depois do toque no degradê (`#sheet .tile.swatch`), a folha "Fundo" **continua aberta** (comportamento
   do app, igual na base: `showBackgrounds` não fecha a folha). O toque seguinte em `#topbar button.title` só fecha a folha
   (toque no fundo escuro), a folha "Renomear" não abre e a L79 quebra:
   `JS: TypeError: Cannot set properties of null (setting 'value')`. Reproduzido 2x no fix e 1x na base (determinístico).
   Esperado: a montagem segue para o caso 1. Correção sugerida: `await closeSheet()` depois do toque no degradê.
2. Corrigido só o item 1, a montagem quebrou em `task09.mjs:70` (`elemento não encontrado: #sheet button "Escolher da
   galeria…"`) 2x seguidas: o estado na hora era a folha "Editar texto" ainda aberta — o toque em "Aplicar" de `editText`
   (L46) caiu enquanto a folha ainda entrava (animação) e não pegou. Corrigido no harness com 400 ms antes de cada toque +
   repetição até 5 s quando o elemento não existe, o script passou inteiro. Correção sugerida: esperar a folha assentar
   antes de tocar (ex.: `waitFor` do botão visível e estável) em `editText` e nas trocas de folha.

**O que passou (evidência em `C:\projects\sandbox\.bugfix-pipeline-product_photo_offline\evidencia\20261105-2202-task-09-multi-paginas-carrossel-magic-resize-e-bg-style-transfer\`):**
- Offline: `npx tsc --noEmit` 0 erros; `npx vitest run` 26 arquivos / 279 testes ok; diff só em arquivos reservados.
- Build do helper (fix): vitest 279/279, `testDebugUnitTest` 199 testes, 0 falhas; APK com o bundle `index-BxKdazMA.js`;
  sha256 no aparelho = APK da lane (`d6e8ed70…1b31`, `hash-fix.txt`).
- Controle positivo (APK da base `713a557`, sha256 `a7797074…0717`): `base-emu/controle-positivo.txt` —
  `editor.getPageCount` undefined, sem `#pages`, `toDocument()` sem `pages`, Tamanho sem ✨ Magic Resize, Fundo sem
  "Extrair fundo da foto"/"todas as páginas", Exportar sem "todas as páginas". Funcionalidade ausente: confirmado.
- T2 com o harness corrigido (`task09-patched.mjs`; diff contra o versionado: import absoluto do `cdp.mjs`, `closeSheet()`
  depois do degradê, `tap` com 400 ms + repetição; **nenhuma asserção mudou**): `fix-patched3/e2e.txt` **26/26 ok** — casos
  1–10, undo cruzado, persistência pelo Rascunhos, Magic Resize (9:16, 16:9, 1200²), extrair da foto (contraste 3,17 e
  3,22), aplicar em todas + um ↶, exportar 6 PNG (apagados no fim). Prints no mesmo diretório.
- T3: `task12` 40/40, `task11` 25/25, `task14` 50/50, `task03` 19/19 (`t3-fix-*`); rascunho antigo `E2E13_1793915014648`
  (salvo antes do fix) abre sem `pages`/`activePageIndex`, "📄 Página 1/1", Tamanho mantém "Ajustar o conteúdo"
  (`t3-rascunho-antigo/`).
- T4: logcat da janela (`fix-patched3/logcat-janela.txt`): só `Receiver not registered` (finalizer) e WebView `Seed missing
  signature`, que aparecem igual nas execuções com o APK da base (PID 4901). Nenhum `FATAL`/ANR/exceção JS.

**Ambiente:** o moto g86 (`ZY32LMNN9B`) estava com bloqueio seguro (`isKeyguardShowing=true`, bouncer) e o
`launchEditor` não achou "Novo design"; o teste rodou no emulador `pp_api34` (aberto e fechado por esta sessão). O moto
ficou com o APK da base `713a557` instalado (antes: 0.4.0 de 2026-11-05 21:36:16). Galeria do emulador e do moto:
`/sdcard/Pictures/e2e_swap.jpg` regravado a partir de `docs/fase2_amostras/entrada/mug.jpg`.

**Para o dev (rodada 2):** corrigir só o `tools/e2e/task09.mjs` (itens 1 e 2) e rodá-lo no aparelho/emulador até passar
de ponta a ponta; o código da funcionalidade não precisa mudar. Rascunhos de teste deixados no emulador: `E2E09_mw4a5i6r`
e 3× "Post Facebook" das tentativas quebradas.

### Rodada 1 — reprovada: o E2E `tools/e2e/task09.mjs` quebrava na montagem; correção: só o script (código intacto)

Causa de cada item do relatório, aberta no código:
1. `main.ts::showBackgrounds` não fecha a folha ao tocar num degradê de preset (só os botões que abrem outra folha
   chamam `close()`): o toque seguinte do script caía no fundo escuro (`#sheet .scrim`, `onclick: close`). Correção:
   `closeSheet()` depois do preset; `closeSheet` agora espera a folha sumir (`#sheet` sem `.show`).
2. A folha não tem animação em CSS (`styles.css` §`#sheet`: só `display`). O que move o "Aplicar" é o teclado:
   `main.ts::showEditText(t, false)` dá `field.focus()`, o WebView encolhe e a folha (presa embaixo) sobe depois de o
   `tap` do driver já ter medido o centro. Correção no script:
   - `stableTaps(p)` envolve o `tap` do driver (inclusive depois do `connect()` do caso 6): espera o elemento existir,
     visível, e a caixa dele ficar igual em duas leituras seguidas (200 ms), até 8 s; só então toca;
   - `sheetOpen(título)`/`sheetClosed()` em cada troca de folha (Texto, Imagem, Fundo, Nome do design, Camadas, Editar
     texto, Páginas, Excluir página, Tamanho, Magic Resize, Exportar);
   - `attempt(rótulo, passo, feito)`: editar texto e renomear são refeitos INTEIROS (até 3 vezes) até o resultado valer,
     porque um toque perdido no fundo escuro fecha a folha sem aplicar;
   - Magic Resize: cada formato é tocado só enquanto o checkbox não está marcado (um toque a mais desmarcaria).
3. Achado ao reler: a espera pela foto (`o.type === 'Image'`) nunca casava (na instância do Fabric 7 é `'image'`) e
   gastava os 20 s do timeout em toda execução. Corrigido.

Nenhuma asserção mudou. Prova offline do fluxo do script (não substitui o aparelho): o próprio `task09.mjs` rodado no
Chrome headless da máquina (`npx vite` da lane), com um `cdp.mjs` falso de mesma API (adb, galeria e Rascunhos simulados;
pasta do job, não versionado) → 25/26; a única falha é o caso 10 (exportar), que depende da ponte do Kotlin. Com o 1º
toque em "Aplicar" forçado no fundo escuro: `editar "Toque e segure": tentativa 1 não aplicou` e a montagem segue até o fim.
Não rodei no aparelho/emulador: o `dev.md` deixa o ambiente E2E para o slot de teste.
