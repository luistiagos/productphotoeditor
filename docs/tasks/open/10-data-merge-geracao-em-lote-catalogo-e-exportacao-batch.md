# [TASK-10] Data Merge (Geração de Anúncios em Lote por Variáveis de Catálogo) e Exportação Batch (Galeria / ZIP / WebP / PDF de Impressão)

## Metadados e Esforço Mensurado

| Campo | Valor |
| :--- | :--- |
| **ID** | `TASK-10` |
| **Prioridade** | **Média-Alta (Produtividade em Escala — P2)** |
| **Esforço Mensurado** | **Médio-Alto** — **~4 a 5 dias úteis (32h–40h / 8 Story Points)** |
| **Escopo** | Híbrido Local (`editor-web` em TypeScript + Exportação em lote / PDF / WebP em `:editor` Kotlin) |
| **Referência Analisada (`com.desygner.ads`)** | `js_pretty/assets/module-create-DxNmnX1s.js` (L25400–L25600: `dataMerge` / `Uwt`), `js_pretty/assets/DesignDownloader-DE2xICjs.js`, `js_pretty/assets/LegacyBleed-QbTs3eMW.js` e `extracted/assets/public/docs/create.md` |

### Detalhamento do Esforço por Subtarefa
1. **Motor de *Data Merge* e Placeholders Dinâmicos (`dataMerge.ts`: `{{produto}}`, `{{preco_de}}`, `{{preco_por}}`, `{{desconto}}`, `{{foto}}`):** ~8h.
2. **Interface de Entrada de Catálogo em Lote (Tabela Editável + Colar Texto/CSV + Seleção Múltipla de Fotos):** ~8h.
3. **Exportação de Novos Formatos (`WebP`, `PDF de Impressão` com Sangria/Marcas de Corte usando `PdfDocument` nativo do Android):** ~8h.
4. **Exportação em Lote na Ponte Kotlin (`exportBatch`: Salvar $N$ imagens na Galeria ou compartilhar pacote `.zip`):** ~6h.
5. **Testes Unitários (Vitest + JUnit em `:editor`):** ~4h.

---

## 1. Contexto e Problema Atual

Um lojista de supermercado, farmácia, loja de roupas, autopeças ou vendedor de Shopee/Mercado Livre raramente faz anúncio de 1 único produto isolado: ele tem **10, 20 ou 50 produtos em oferta na semana** e quer usar **o mesmo layout padrão da loja** trocando apenas a foto do produto, o nome, o preço antigo (*"De"* ) e o preço promocional (*"Por"*).
Atualmente, no nosso projeto:
- Já temos um embrião de substituição de variáveis `{{company}}`, `{{tagline}}`, `{{phone}}`, etc. em [`editor-web/src/brandkit.ts`](file:///c:/projects/sandbox/product_photo_offline/editor-web/src/brandkit.ts) (`applyBrandKit`), mas ele só preenche os dados fixos da empresa em 1 página.
- Não existe um fluxo de **Data Merge (Preenchimento em Lote de Catálogo)** onde o usuário informa uma lista de produtos e gera automaticamente $N$ páginas/anúncios prontos.
- Além disso, [`ExportPayload` em `protocol.ts` (L147–L153)](file:///c:/projects/sandbox/product_photo_offline/editor-web/src/protocol.ts#L147-L153) só exporta 1 arquivo por vez em `png`, `jpg`, `svg` ou `mp4` — faltam:
  - **Exportação em Lote** (salvar todas as páginas/variações de uma vez na galeria ou em um arquivo `.zip`);
  - **Formato `WebP`** (exigido por muitas plataformas de e-commerce por ter 30%–50% menos peso com transparência);
  - **Formato `PDF de Impressão`** (com opção de marcas de corte e sangria para gráficas rápidas imprimirem etiquetas, tags, cartões e encartes).

---

## 2. O que deve ser feito (Especificação Técnica Detalhada)

### 2.1. Motor de *Data Merge* para Catálogo de Ofertas (`editor-web/src/dataMerge.ts`)
Inspirado na rotina `dataMerge` (`Uwt` em `module-create-DxNmnX1s.js` L25400–L25600):

1. **Detecção Automática de Variáveis no Design Atual (`detectTemplateFields(doc)`):**
   - Varre todos os objetos da página modelo procurando:
     - **Placeholders de Texto `{{campo}}`:** ex.: `{{produto}}`, `{{preco_de}}`, `{{preco_por}}`, `{{desconto}}`, `{{parcelas}}`, `{{codigo}}`.
     - **Heurística Automática (Mesmo sem `{{...}}` digitado!):** se o usuário ainda não colocou chaves `{{...}}` no template, oferece um botão **"Marcar camada como variável"** em `renderProps()` (`Nome do Produto`, `Preço Antigo (De)`, `Preço Oferta (Por)`, `Foto Principal do Produto`), gravando `mergeField: 'produto' | 'preco_de' | 'preco_por' | 'foto'` no objeto!
2. **Parser de Dados (Tabela Interativa + CSV / TSV Colado do WhatsApp ou Excel):**
   - `parseCatalogText(raw: string): CatalogRow[]`:
     - Aceita tanto CSV/TSV padrão quanto listas rápidas coladas do WhatsApp no formato brasileiro:
       ```text
       Tênis Corrida Pro; R$ 299,90; R$ 189,90
       Camiseta Dry Fit; R$ 89,90; R$ 49,90
       Meia Kit 3 Pares; R$ 39,90; R$ 19,90
       ```
     - Calcula automaticamente o campo `{{desconto}}` (ex.: `"-37%"`) quando `preco_de` e `preco_por` numéricos estão presentes!
3. **Geração das Variações com Auto-Fit de Texto (`generateMergedPages`):**
   - Para cada linha $i \in \{1 \dots N\}$ da tabela de produtos:
     - Clona o JSON da página-base;
     - Substitui os textos `{{campo}}` e objetos com `mergeField`;
     - **Auto-Fit de Fonte (`shrinkTextToFit`):** se o nome de um produto for muito longo (ex.: *"Parafusadeira e Furadeira de Impacto 20V Bivolt com Maleta"*), reduz automaticamente o `fontSize` (até um limite mínimo de $65\%$ do original) para que o texto não invada a foto do produto nem estoure a caixa!
     - Se a linha possuir `fotoUrl` associada, substitui a imagem da camada marcada como `mergeField === 'foto'` preservando sua escala/máscara (`rescaledGeometry`).
   - Adiciona todas as variações geradas como páginas do documento (integrando-se à tira de páginas da `TASK-09` para que o lojista possa revisar/ajustar individualmente qualquer item antes de exportar).

### 2.2. Novos Formatos de Exportação (`WebP`, `PDF de Impressão` e `Batch / ZIP`)

1. **Suporte a `webp` e `pdf` em [`protocol.ts`](file:///c:/projects/sandbox/product_photo_offline/editor-web/src/protocol.ts#L147-L153):**
   ```ts
   export interface ExportPayload {
     format: 'png' | 'jpg' | 'webp' | 'svg' | 'pdf' | 'mp4' | 'gif';
     action: 'save' | 'share' | 'print' | 'mockup';
     name: string;
     data: string;
     /** Para exportação em lote (carrossel ou data merge) ou PDF multi-páginas: */
     pages?: { name: string; data: string; width: number; height: number }[];
     /** Opções de impressão para PDF: */
     printOptions?: { cropMarks?: boolean; bleedPx?: number };
   }
   ```
2. **Exportação `WebP` (Client-Side + Kotlin):**
   - No WebView Android (Chromium), `canvas.toDataURL('image/webp', quality)` é suportado nativamente com compressão excelente e suporte a canal Alpha transparente.
   - Em `EditorExports.kt`, aceitar o MIME `image/webp` e extensão `.webp` ao salvar no `MediaStore` / compartilhar.
3. **Exportação `PDF de Impressão` (Multi-Página + Marcas de Corte e Sangria):**
   - Em `EditorExports.kt`, usar a API nativa do Android `android.graphics.pdf.PdfDocument` (zero dependências externas de terceiros!):
     - Para cada página em `payload.pages` (ou a página única em `payload.data`), cria uma `PdfDocument.Page` na resolução exata;
     - Se `printOptions.cropMarks === true`, adiciona margem externa de `36 pt` e desenha as 4 marcas de corte (*crop marks*) nos cantos com `Canvas.drawLine` nativo antes de desenhar o bitmap da página;
     - Grava o `.pdf` final no `MediaStore.Downloads` ou abre o seletor de compartilhamento/impressão.
4. **Exportação em Lote (`Salvar Todas na Galeria` ou `Compartilhar ZIP`):**
   - Quando o projeto tiver múltiplas páginas (via Carrossel ou Data Merge), `showExport()` exibe:
     - Seletor: `Página atual` vs. `Todas as páginas (N arquivos)`;
     - Ao exportar todas em `PNG` / `JPG` / `WebP` com ação `save`, o Kotlin salva sequencialmente `Nome_01.png`, `Nome_02.png`... na Galeria e mostra toast `"N anúncios salvos na galeria!"`.
     - Com ação `share` (ou formato `.zip`), empacota via `java.util.zip.ZipOutputStream` nativo e compartilha o arquivo `.zip` ou múltiplos `ClipData` no Intent do Android.

---

## 3. Arquivos a Criar / Modificar

| Arquivo | Ação | Descrição |
| :--- | :---: | :--- |
| [`editor-web/src/dataMerge.ts`](file:///c:/projects/sandbox/product_photo_offline/editor-web/src/dataMerge.ts) | **Criar** | Detector de variáveis `{{...}}` / `mergeField`, parser de catálogo CSV/TSV/WhatsApp (`parseCatalogText`), cálculo automático de `{{desconto}}`, gerador de variações em lote e `shrinkTextToFit`. |
| [`editor-web/src/protocol.ts`](file:///c:/projects/sandbox/product_photo_offline/editor-web/src/protocol.ts) | **Modificar** | Expandir `ExportPayload` com formatos `'webp'` e `'pdf'`, array opcional `pages[]` e `printOptions`. |
| [`editor-web/src/document.ts`](file:///c:/projects/sandbox/product_photo_offline/editor-web/src/document.ts) | **Modificar** | Adicionar `'mergeField'` em `CUSTOM_PROPERTIES`. |
| [`editor-web/src/editor.ts`](file:///c:/projects/sandbox/product_photo_offline/editor-web/src/editor.ts) | **Modificar** | Suportar `'webp'` em `renderPage()` / `exportRaster()` e método `exportPagesRaster()` com progresso. |
| [`editor-web/src/main.ts`](file:///c:/projects/sandbox/product_photo_offline/editor-web/src/main.ts) | **Modificar** | Adicionar botão **"⚡ Gerar em Lote (Catálogo)"**, seletor de vínculo `mergeField` em `renderProps()` e opções `WebP`, `PDF (Impressão)` e `Todas as páginas` em `showExport()`. |
| [`editor/src/main/kotlin/com/productphoto/editor/EditorExports.kt`](file:///c:/projects/sandbox/product_photo_offline/editor/src/main/kotlin/com/productphoto/editor/EditorExports.kt) | **Modificar** | Suportar salvamento/compartilhamento de `webp`, geração de `pdf` via `PdfDocument` (com marcas de corte opcionais) e salvamento em lote (`pages[]` / `.zip`). |
| [`editor-web/test/dataMerge.test.ts`](file:///c:/projects/sandbox/product_photo_offline/editor-web/test/dataMerge.test.ts) | **Criar** | Testes unitários validando `parseCatalogText`, cálculo automático de porcentagem de desconto (`De R$ 100 por R$ 70` $\to$ `-30%`), substituição de variáveis e `shrinkTextToFit`. |

---

## 4. Critérios de Aceite e Verificação

- [ ] O usuário consegue marcar um texto como `{{produto}}`, outro como `{{preco_de}}` e outro como `{{preco_por}}` (ou usar um template pronto), colar ou digitar uma lista de 5 produtos com preços e gerar os 5 anúncios de uma só vez.
- [ ] Nomes de produtos grandes têm o tamanho da fonte reduzido automaticamente (`shrinkTextToFit`) para não quebrar o layout do anúncio.
- [ ] Na tela **Exportar**, é possível exportar em **PNG, JPG, WebP, SVG, PDF (com marcas de corte opcionais), MP4 e GIF**, tanto da página atual quanto de **todas as páginas em lote**.
- [ ] `npx vitest run`, `npm run build` e `./gradlew :editor:testDebugUnitTest` executam com 0 erros.

---

## Planejamento (pipeline 20261105-1638, 2026-11-05)

**Veredito:** corrigir — dá para implementar neste repo (editor-web + `:editor`), mas SÓ depois da TASK-09 desta execução: o Data Merge grava as variações como páginas e a exportação em lote percorre páginas, e hoje o documento tem UMA página (`depende_de: task-09-multi-paginas-carrossel-magic-resize-e-bg-style-transfer`).
**Complexidade:** alta — mais de um módulo (editor-web + Kotlin `:editor`), protocolo da ponte WebView <-> Kotlin alterado (`ExportPayload`) e formatos de exportação novos (WebP/PDF/ZIP).
**Severidade:** medio — funcionalidade nova ausente; o lojista contorna montando cada anúncio à mão e exportando um a um.
**Arquivos a alterar (reserva da onda):**
- `editor-web/src/dataMerge.ts` — NOVO: `detectTemplateFields`, `parseCatalogText`, `parsePriceBR`/`discountLabel`, `applyMergeRow` (JSON), `swapPhotoJson`, `shrinkTextToFit`, `generateMergedPages`.
- `editor-web/test/dataMerge.test.ts` — NOVO: vitest do acima (texto medido com `fabric/node`, que já roda nos testes: `node-canvas` instalado).
- `editor-web/src/protocol.ts` — `ExportPayload.format` + `'webp' | 'pdf'`; `batch?`, `printOptions?` (desenho abaixo).
- `editor-web/src/document.ts` — `'mergeField'` em `CUSTOM_PROPERTIES`.
- `editor-web/src/editor.ts` — `renderPage`/`exportRaster` aceitam `'webp'`; render com sangria; percorrer páginas para o lote (reusar o que a TASK-09 entregar); inserir N páginas geradas num passo de histórico.
- `editor-web/src/main.ts` — seletor "Variável do lote" em `renderProps`; folha "⚡ Gerar em lote"; `showExport` com WebP, PDF (marcas de corte/sangria), "Página atual / Todas as páginas".
- `editor-web/src/styles.css` — tabela/textarea da folha do lote.
- `editor/src/main/assets/editor/index.html` — bundle regerado (arrasto de toda mudança em editor-web; os `assets/index-<hash>.*` o dev dá `claim` depois do build).
- `editor/src/main/kotlin/com/productphoto/editor/EditorSession.kt` — `ExportFormat` + `WEBP`, `PDF`, `ZIP`; `EditorSession.export` trata `batch`/`printOptions` e o PDF; `EditorHost` ganha métodos com default (não quebra o fake de `EditorBridgeInstrumentedTest`).
- `editor/src/main/kotlin/com/productphoto/editor/EditorExports.kt` — WebP na galeria; PDF via `android.graphics.pdf.PdfDocument`; salvar N na galeria; ZIP em `cacheDir/exports` + `ACTION_SEND`.
- `editor/src/main/kotlin/com/productphoto/editor/EditorScreen.kt` — o host real implementa os métodos novos do `EditorHost`.
- `editor/src/main/kotlin/com/productphoto/editor/BatchExport.kt` — NOVO, Kotlin PURO (testável na JVM): nomes `Nome_01.ext`, staging do lote, `zip(files)`, geometria de impressão `PrintLayout` (página, retângulo da imagem, 8 linhas de marca de corte).
- `editor/src/test/kotlin/com/productphoto/editor/BatchExportTest.kt` — NOVO: JUnit do `BatchExport.kt`.
- `editor/src/test/kotlin/com/productphoto/editor/EditorProtocolTest.kt` — `ExportFormat.of("webp"|"pdf"|"zip")` e MIME.
- `tools/e2e/task10.mjs` — NOVO: E2E da T2.

Sem `strings.xml`: o toast é da página web (`toast(...)` em `showExport`) e as mensagens de `BridgeException` no Kotlin já são literais em português no módulo. Sem dependência nova (npm ou Gradle): `PdfDocument` e `java.util.zip` são da plataforma (minSdk 28, `editor/build.gradle.kts:12`).

### Causa raiz (símbolos abertos: `arquivo::simbolo` — faz X; em erro, Y)

Item = task: a "causa" é o que falta no código hoje, conferido contra o doc (que está em parte desatualizado — ver "Correções ao plano original" no fim desta lista).

- `editor-web/src/document.ts::EditorDocument` — UM `fabric: FabricJson` por documento; não há `pages`. `parseDocument` rejeita formato/versão desconhecidos com `DocumentError`. **Não há onde pôr N variações** sem a TASK-09 (que introduz `EditorPage`/`pages[]`/`activePageIndex`, §2.1 do doc dela).
- `editor-web/src/document.ts::CUSTOM_PROPERTIES` — o que entra no `toObject()`; sem `mergeField`, a marcação se perde no rascunho e no undo.
- `editor-web/src/document.ts::walkObjects` — pré-ordem, entra em grupos (`o.objects`): serve para achar campos dentro de grupos.
- `editor-web/src/brandkit.ts::applyBrandKit` / `fill` / `VAR_RE = /\{\{\s*([a-z]+)\s*\}\}/g` — preenche `{{company}}` etc. sobre `structuredClone(doc)`; variável desconhecida fica intacta; quando o texto muda, zera `o.styles` (estilos por caractere indexados por posição). **`[a-z]+` não casa `{{preco_de}}` (sublinhado)**: os campos do lote não colidem com as variáveis do kit, e o merge deve deixar `{{company}}` etc. intactos para o kit. O merge copia a regra de zerar `styles`.
- `editor-web/src/protocol.ts::ExportPayload` (L147) — `format: 'png'|'jpg'|'svg'|'mp4'|'gif'`, `action`, `name`, `data` (um arquivo). Só tipo: nenhum parser JS valida o payload de export.
- `editor-web/src/editor.ts::Editor.renderPage` (L1431, privado) — `canvas.toDataURL({format:'png'|'jpeg', quality, multiplier, left:0, top:0, width:docWidth, height:docHeight})` com viewport identidade; o `finally` restaura o viewport e `isExporting`. O `ImageFormat` do Fabric 7.4 é `'jpeg'|'png'|'webp'`: WebP é só passar `'webp'`. Sangria = `left:-b, top:-b, width:docWidth+2b, height:docHeight+2b`.
- `editor-web/src/editor.ts::Editor.exportRaster` (L1482) — limita o lado a 8192 px, `discardActiveObject`, chama `renderPage`. Sem lote.
- `editor-web/src/editor.ts::renderThumbnail` (L1651) — renderiza um documento FORA do editor num `StaticCanvas` (carrega fontes antes). Alternativa para renderizar páginas sem trocar a página ativa, se a TASK-09 não entregar isso.
- `editor-web/src/editor.ts::Editor.swapImage` (L1275) — troca a foto no objeto VIVO preservando caixa e centro (`fitSlot`), ângulo, espelho, opacidade, sombra, clipPath e filtros. O merge trabalha no JSON: usar `fitSlot` direto (sem `setSrc`), com `width/height` da `BlobResult` do `pickImage`.
- `editor-web/src/imageGeometry.ts::fitSlot(slotW, slotH, nw, nh, mode)` — puro; `cover` preenche e recorta o centro (`cropX/cropY`); já testado em `test/groupAndSwap.test.ts`.
- `editor-web/src/main.ts::showExport` (L1751) — `select` de formato (png/jpg/svg/mp4/gif), escala (escondida para svg e vídeo), qualidade (só jpg), botões Salvar/Compartilhar/Imprimir/Mockup; `go(action)` monta o `ExportPayload` e chama `bridge.request('export', payload)`; o erro sobe para `run(...)`, que mostra o toast. Uma página só.
- `editor-web/src/main.ts::renderProps` (L203) — painel do objeto selecionado (linha de botões + painéis por tipo): é onde entra o seletor "Variável do lote".
- `editor-web/src/main.ts::tabs` (L1114) e `showText` (L1150) — abas inferiores; a folha Texto já tem botões extras ("✨ Gerar textos com IA", "🔍 Localizar e substituir…"). Entrada do lote: botão na folha `showText` **e/ou** na folha de Páginas da TASK-09 (o dev escolhe pelo que a TASK-09 entregou e registra).
- `editor/src/main/kotlin/com/productphoto/editor/EditorSession.kt::ExportFormat` (L53) — enum `PNG, JPG, SVG, MP4, GIF` com `ext`/`mime`; `of(s)` lança `BridgeException(INVALID, "format $s")` para desconhecido: **hoje `webp`/`pdf` chegam e falham com `invalid`** (controle positivo de protocolo).
- `editor/src/main/kotlin/com/productphoto/editor/EditorSession.kt::EditorSession.export` (L238) — valida `action`; MP4/GIF vão ao `VideoRenderer` (com `finally` apagando a pasta do vídeo); SVG = texto; o resto = `EditorAssets.dataUrlBytes(data)` (aceita qualquer `data:*;base64`, então WebP decodifica sem mudança); chama `host.export(...)` e devolve `{location?}`. PRINT/MOCKUP recusam SVG com `UNSUPPORTED`.
- `editor/src/main/kotlin/com/productphoto/editor/EditorSession.kt::EditorHost` (L44) — `export(format, action, name, bytes)` obrigatório; `exportVideo` com default `null`. Método novo com default não quebra o fake de `EditorBridgeInstrumentedTest.kt:103`.
- `editor/src/main/kotlin/com/productphoto/editor/EditorSession.kt::exportName` (L324) — saneia e acrescenta `_yyyyMMdd_HHmmss`; nomes do lote = `exportName(name)` + `_01`, `_02`…
- `editor/src/main/kotlin/com/productphoto/editor/EditorExports.kt::save` (L23) — MediaStore (Q+) com `IS_PENDING`; em erro apaga o item e relança; `isImage` = PNG/JPG/GIF -> Pictures, senão Downloads. **WebP precisa entrar em `isImage`**; PDF/ZIP caem em Downloads (correto).
- `editor/src/main/kotlin/com/productphoto/editor/EditorExports.kt::share` (L102) — grava em `cacheDir/exports/` (apaga o que havia: só a mais recente fica), `FileProvider` `${packageName}.editor.files`, `ACTION_SEND`. `editor/src/main/res/xml/editor_file_paths.xml` já expõe `cache-path exports/`: ZIP/PDF compartilham pelo mesmo caminho, sem mexer no XML.
- `editor/src/main/kotlin/com/productphoto/editor/EditorExports.kt::print` — `PrintHelper.printBitmap` (só bitmap). PDF não entra no "Imprimir" (fica salvar/compartilhar; a gráfica imprime o arquivo).
- `editor/src/main/kotlin/com/productphoto/editor/EditorScreen.kt` (L55–L88) — o host real: SAVE -> `EditorExports.save`, SHARE -> `share`, PRINT -> `print`, MOCKUP -> `onMockup`; `pickImage` = `PickVisualMedia(ImageOnly)` (uma foto).
- `editor/src/main/kotlin/com/productphoto/editor/EditorSession.kt::pickImage` (L181) — copia para o BlobStore como PNG (lado ≤ 2048) e devolve `{url, width, height}`: é o que o merge precisa por linha.
- `editor/build.gradle.kts:20` — `unitTests.isReturnDefaultValues = true`: `PdfDocument`/`Bitmap` não rodam na JVM (os stubs devolvem default) -> a lógica testável vai para `BatchExport.kt` puro; o desenho no `PdfDocument` só se prova no aparelho (T2).
- ARQUITETURA §7: a ponte é `addWebMessageListener` com JSON; "imagens trafegam como URL do asset loader, não como base64 grande". Por isso o lote vai **uma página por mensagem** (abaixo), não `pages[]` com N dataURLs numa mensagem só.

**Correções ao plano original (§3 do doc):** a tabela cita só `EditorExports.kt` no Kotlin, mas o `ExportFormat` e o despacho do `export` estão em `EditorSession.kt` e o host em `EditorScreen.kt`; o teste Kotlin cabe num `BatchExportTest.kt` novo + `EditorProtocolTest.kt` (não há teste de `EditorExports`). `rescaledGeometry` (citado no §2.1.3) é para trocar a MESMA imagem processada; para foto nova num espaço o certo é `fitSlot` (o que o `swapImage` usa).

### Desenho decidido (o dev segue; se a TASK-09 mergeada desmentir algo, corrige ESTA seção)

0. **Base = TASK-09 mergeada.** Antes de editar, abrir no código mergeado: `EditorPage`/`pages`/`activePageIndex` (`document.ts`), `getPageCount`, `getActivePageIndex`, `switchToPage`, `addPage` e o que houver de "exportar todas as páginas" (`exportAllPagesRaster`, opção em `showExport`). **Reusar e estender; não duplicar.** Se a TASK-09 tiver "todas as páginas" como N `export` seguidos, o protocolo `batch` abaixo substitui isso (um caminho só).
1. **Campos:** `MERGE_FIELDS = ['produto','preco_de','preco_por','desconto','parcelas','codigo','foto']`, regex própria `/\{\{\s*([a-z_]+)\s*\}\}/g`; campo desconhecido (inclusive os do brand kit) fica intacto. `mergeField` num texto = o texto INTEIRO vira o valor; `{{campo}}` dentro do texto = troca inline. `mergeField: 'foto'` só em imagem. `detectTemplateFields(fabric)` devolve os campos achados (marcados + `{{…}}`), inclusive dentro de grupos (`walkObjects`).
2. **Parser `parseCatalogText(raw)`** -> `CatalogRow[]` (`Partial<Record<campo, string>>`), no máximo 50 linhas (o resto é descartado com aviso). Separador por linha: TAB, senão `;`, senão `|` — **vírgula não separa** (é o decimal de "R$ 189,90"; CSV com vírgula só com campos entre aspas). Cabeçalho: se a 1ª linha tem nomes de campo conhecidos (`produto`, `preco_de`/`de`, `preco_por`/`por`, `parcelas`, `codigo`), mapeia por nome; senão, posicional `produto; preco_de; preco_por; parcelas; codigo`; com 2 colunas = `produto; preco_por`. Linhas vazias ignoradas. `parsePriceBR('R$ 1.299,90') = 1299.9`; `desconto` = `-${round((de-por)/de*100)}%` só quando `de > por > 0` e a linha não trouxe `desconto`. Os preços vão ao anúncio como o usuário digitou.
3. **Gerar:** a folha "⚡ Gerar em lote" mostra os campos detectados (sem nenhum: explica como marcar e não gera), uma `textarea` para colar e a tabela editável das linhas lidas, com um botão 📷 por linha quando o modelo tem `foto` (usa o `pickImage` existente; **seleção múltipla de fotos fica fora deste item**, ver hipóteses). "Gerar N anúncios" -> para cada linha: `structuredClone` da página ativa, `applyMergeRow`, `swapPhotoJson` (`fitSlot` `cover`, preserva o centro conforme `originX/originY`, zera `cropX/cropY` antes), `shrinkTextToFit`; as N páginas entram DEPOIS da página-modelo (que fica como está), com o nome do produto, num passo de histórico; ao fim vai para a 1ª gerada e toast "N anúncios gerados".
4. **`shrinkTextToFit(t, box, minRatio = 0.65)`** num `FabricText` vivo (no lote: `Textbox.fromObject`/`util.enlivenObjects` do JSON e `toObject()` de volta): caixa = largura × altura do objeto do MODELO (com o placeholder). Textbox: largura fixa, reduz `fontSize` em passos de ~2% até `height <= box.height` ou o piso (65%); IText/Text: até `width <= box.width`. No piso, para (não corta texto). Retorna o `fontSize` final.
5. **Formatos:** `webp` (o slider de qualidade, hoje só-JPG, passa a valer para WebP também) e `pdf` em `showExport`. PDF: "Marcas de corte" (checkbox) e "Sangria" (0 ou ~36 px do documento) — `printOptions`. O raster de cada página do PDF é PNG na escala escolhida, com a sangria renderizada pelo `renderPage` com retângulo expandido. "Imprimir" escondido para pdf e vídeo; para webp, aceitar (o `BitmapFactory` decodifica WebP) ou esconder — decidir e testar. PRINT com PDF no Kotlin: `UNSUPPORTED`.
6. **Lote — protocolo (uma página por mensagem):** `ExportPayload` ganha `batch?: { id: string; index: number; count: number }` e `printOptions?: { cropMarks?: boolean; bleedPx?: number }`. O JS manda `count` pedidos `export` com o mesmo `batch.id`, em sequência (espera cada `result`), progresso "Exportando i/N" no `run`. Kotlin (`BatchExport.kt`): `index < count-1` -> grava os bytes em `cacheDir/batch/<id>/<index>.<ext>` e responde `{staged: index}`; um `id` novo apaga lotes velhos; no último, finaliza e apaga a pasta em `finally`:
   - SAVE png/jpg/webp -> N arquivos `exportName(name)_01.ext`… em Pictures/ProductPhoto; `location` = "Pictures/ProductPhoto (N arquivos)"; o JS mostra "N anúncios salvos na galeria!".
   - SAVE pdf -> UM `.pdf` de N páginas em Download/ProductPhoto.
   - SHARE png/jpg/webp/svg -> UM `.zip` (`ZipOutputStream`, entradas `Nome_01.ext`…) em `cacheDir/exports/` + `ACTION_SEND` `application/zip`; SHARE pdf -> o `.pdf`.
   - SAVE svg em lote -> `.zip` em Download/ProductPhoto.
   - **MP4/GIF não têm lote** (cada vídeo é um render FFmpeg com `videoSettings`): "Todas as páginas" fica escondido para eles. MOCKUP/PRINT não têm lote.
   - PDF de página única = lote com `count: 1` (o mesmo caminho).
7. **PDF (`EditorExports`)**: `PdfDocument`; por página `PageInfo.Builder(pageW, pageH, i+1)` em pt, com **1 px do documento = 1 pt** (registrar; a gráfica escala para o tamanho físico); com marcas de corte, margem de 36 pt em volta, imagem (com sangria) centrada, 8 linhas de marca (2 por canto, 18 pt, a 6 pt do corte, fora da arte, `Paint` preto 0,5 pt) — coordenadas de `PrintLayout` (puro, testado). Decodificar cada página só na hora (`BitmapFactory`) e `recycle()` depois, para não segurar N bitmaps.

### Provas (comando literal -> resultado)

- `grep -n "type ImageFormat" C:/projects/sandbox/product_photo_offline/editor-web/node_modules/fabric/dist/src/typedefs.d.ts` -> `36:export type ImageFormat = 'jpeg' | 'png' | 'webp';`
- `grep -n "minSdk" editor/build.gradle.kts ../app/build.gradle.kts` -> `minSdk = 28` nos dois (`PdfDocument` é API 19).
- `grep -n "unitTests" editor/build.gradle.kts` -> `20: testOptions { unitTests.isReturnDefaultValues = true }` (Android stubado na JVM).
- `ls editor-web/node_modules | grep -i "^canvas\|jsdom"` -> `canvas`, `jsdom`; `grep -ln "from 'fabric'" test/*.ts` + os que usam `fabric/node` (`textTools.test.ts`, `groupAndSwap.test.ts`) -> Fabric roda no vitest (environment `node`).
- `grep -n 'handle("' editor/src/main/kotlin/com/productphoto/editor/*.kt` -> handlers: `hello, getBrandKit, saveDraft, pickImage, pickFont, pickAudio, export` + `ai.*`; nenhum de lote/ZIP/PDF.
- `grep -n "file_paths\|cache-path" -r editor/src/main/res` -> `editor_file_paths.xml:3: <cache-path name="exports" path="exports/" />`.
- `git status --porcelain docs` na worktree de planning (2026-11-05) -> a TASK-09 ainda sem planejamento gravado; nenhum doc novo sobre lote/WebP/PDF (sem duplicata).

### Hipóteses descartadas (e por quê)

- **Fazer a TASK-10 sem a TASK-09 (gerar N rascunhos separados, ou exportar o lote direto da folha, sem páginas)** — descartado: o doc pede as variações como páginas revisáveis "integrando-se à tira de páginas da TASK-09", e a exportação em lote é "quando o projeto tiver múltiplas páginas". Desviar disso é decisão do dono. Daí o `depende_de`.
- **`pages[]` com N dataURLs num único `export` (como o §2.2.1)** — descartado: 50 páginas PNG de 1080² são dezenas de MB numa string JSON (copiada no JS, na ponte e no Kotlin); a ARQUITETURA §7 manda não trafegar base64 grande. Uma página por mensagem, com staging no `cacheDir`, segura o pico em uma página.
- **`VAR_RE` do brand kit para os campos do lote** — descartado: `[a-z]+` não casa `preco_de`; e reusar o `fill` trocaria `{{company}}` por exemplo/vazio. Regex própria, campo desconhecido intacto.
- **`rescaledGeometry` para a foto da linha** — descartado: serve para trocar a mesma imagem processada (mesma proporção); foto nova num espaço = `fitSlot`.
- **Testar o `PdfDocument` no `testDebugUnitTest`** — descartado: stubs da JVM; a geometria vai para `PrintLayout` puro e o PDF real se prova no aparelho (`%PDF`, N `/Type /Page`).
- **Lote de MP4/GIF** — fora: N renders FFmpeg; não é o caso de uso (anúncio estático de catálogo). O "tanto da página atual quanto de todas as páginas" do §4 vale para os formatos estáticos.
- **Seleção múltipla de fotos** — fora deste item: não está nos critérios §4 e exige `PickMultipleVisualMedia`, handler novo e E2E do seletor do sistema em modo múltiplo. Foto por linha com o `pickImage` existente. Registrar como pendência no doc ao fechar.
- **Task grande demais (bloqueado)?** — estimativa ~1.300–1.500 linhas novas (dataMerge ~300 + teste ~220, UI ~280, editor ~60, Kotlin ~250 + teste ~100, E2E ~250), um módulo Gradle (`:editor`) + editor-web: no limite do manual, não acima. **Se a TASK-09 não passar nesta execução**, proposta de divisão para o dono: **10a** = WebP + PDF de impressão (página única; independe da TASK-09) e **10b** = Data Merge + exportação em lote (depende da TASK-09).

### Tarefas

- [ ] `editor-web/src/document.ts::CUSTOM_PROPERTIES` — `+ 'mergeField'` — vitest: `toObject()` de um Textbox com `mergeField` mantém o campo.
- [ ] `editor-web/src/dataMerge.ts::parseCatalogText` / `parsePriceBR` / `discountLabel` — `dataMerge.test.ts`: as 3 linhas do §2.1.2 (`;`) -> 3 linhas com `produto`/`preco_de`/`preco_por` e `desconto` `-37%`/`-44%`/`-51%`; TSV com cabeçalho; `De R$ 100 por R$ 70` -> `-30%`; "R$ 1.299,90" -> 1299.9; vírgula decimal não quebra coluna; linha vazia ignorada; 60 linhas -> 50.
- [ ] `editor-web/src/dataMerge.ts::detectTemplateFields` / `applyMergeRow` / `swapPhotoJson` — teste: `{{produto}}` inline e `mergeField` inteiro substituídos; `{{company}}` intacto; `styles` zerado só quando o texto mudou; campos dentro de Group; foto: `src`, `width/height` da foto nova e escala `cover` = espaço do modelo, centro preservado; o JSON de entrada não muda (clone).
- [ ] `editor-web/src/dataMerge.ts::shrinkTextToFit` — teste com `Textbox` de `fabric/node`: o nome longo do §2.1.3 reduz `fontSize` e cabe na altura do modelo; nome curto não muda; nunca abaixo de 65%.
- [ ] `editor-web/src/dataMerge.ts::generateMergedPages` — teste: modelo + 5 linhas -> 5 `FabricJson` com textos e descontos certos; modelo intacto.
- [ ] `editor-web/src/protocol.ts::ExportPayload` — `'webp'|'pdf'`, `batch?`, `printOptions?` — `npx tsc --noEmit`.
- [ ] `editor-web/src/editor.ts` — `'webp'` em `renderPage`/`exportRaster`; sangria; render de cada página sem perder a ativa; inserir as páginas geradas (1 undo) — E2E T2 (lido por CDP) + `tsc`.
- [ ] `editor-web/src/main.ts::renderProps` (seletor Variável), folha "⚡ Gerar em lote", `showExport` (WebP, PDF + marcas/sangria, Página atual/Todas, progresso i/N, Imprimir escondido onde não vale) — E2E T2.
- [ ] `editor/.../BatchExport.kt` — `batchNames`, staging (`stage(id, index, count, bytes)`, último, limpeza), `zip(files, out)`, `PrintLayout.of(wPx, hPx, bleedPx, cropMarks)` — `BatchExportTest.kt`: nomes `_01.._05`; ZIP relido com `ZipInputStream` tem 5 entradas com os bytes certos; layout sem marcas = página do tamanho da imagem; com marcas = +72 pt por eixo e 8 linhas fora do retângulo de corte; lote com `id` novo apaga o velho.
- [ ] `editor/.../EditorSession.kt::ExportFormat` + `export` (batch/printOptions/PDF; PRINT+PDF recusado) — `EditorProtocolTest.kt`: `of("webp")`/`of("pdf")`/`of("zip")` e MIME `image/webp`, `application/pdf`, `application/zip`.
- [ ] `editor/.../EditorExports.kt` (WebP em `isImage`, PDF, salvar N, ZIP) + `EditorScreen.kt` (host) — T2 no aparelho (arquivos lidos por adb).
- [ ] `tools/e2e/task10.mjs` — a T2 abaixo.
- [ ] Doc: atualizar a tabela do §3 com os arquivos reais e o que ficou fora (seleção múltipla de fotos; lote de vídeo).

### Plano de teste

- **Offline (sem slot):** `npx tsc --noEmit` e `npx vitest run` em `editor-web/` (inclui `test/dataMerge.test.ts`); `BatchExportTest`/`EditorProtocolTest` no `testDebugUnitTest` do `build` do helper. Provam parser, desconto, substituição, auto-fit, foto, nomes, ZIP e geometria das marcas de corte.
- **T2 reprodução como o usuário (E2E, no slot) — `tools/e2e/task10.mjs`:**
  1. `launchEditor()` (no moto: `E2E_FORMAT="Post Instagram"`) -> design novo.
  2. Aba **Texto** -> "Adicionar título" 3× (`uiTap`/`tap`); para cada texto: tocar no canvas para selecionar e, no painel, **"Variável do lote"** -> Nome do produto / Preço antigo (De) / Preço oferta (Por); um 4º texto com `Leve já! {{desconto}}` (edição de texto pela UI ou `setText`). Sinal (CDP): `editor.canvas.getObjects().map(o => o.get('mergeField'))` = `['produto','preco_de','preco_por',undefined]`.
  3. Abrir **⚡ Gerar em lote**: os 4 campos listados; colar (valor na `textarea` + evento `input`) 4 linhas `;`: `Parafusadeira e Furadeira de Impacto 20V Bivolt com Maleta; R$ 599,90; R$ 399,90` + as 3 do §2.1.2, e digitar uma 5ª na tabela; a tabela mostra 5 linhas; tocar **Gerar 5 anúncios**.
  4. Sinais (CDP): `getPageCount()` = 6 (modelo + 5); cada página gerada tem os textos da linha e o desconto calculado (`-37%` na do Tênis); na da Parafusadeira, o `fontSize` do nome é < o do modelo e >= 65% dele, e o `height` do Textbox <= o do modelo (ou está no piso); a página-modelo continua com os placeholders. `screencap` da 1ª gerada e da Parafusadeira.
  5. **Exportar** -> **WebP**, **Todas as páginas**, **Salvar na galeria** -> toast "N anúncios salvos na galeria!" (N = páginas exportadas; o dev decide e registra se o modelo entra). Sinal: `adb shell ls -l /sdcard/Pictures/ProductPhoto/` lista os N `<nome>_<ts>_01.webp`…; `adb exec-out cat <um> | head -c 12` = `RIFF....WEBP`.
  6. **Exportar** -> **PDF (impressão)**, **Marcas de corte** ligado, **Todas as páginas**, **Salvar** -> `/sdcard/Download/ProductPhoto/<nome>_<ts>.pdf`; `adb pull` e no PC: começa com `%PDF`, N ocorrências de `/Type /Page` (não `/Pages`), MediaBox = lado + 72 pt; render no PC (se houver `pdftoppm`/PyMuPDF) mostra as marcas nos cantos.
  7. **Exportar** -> **PNG**, **Todas as páginas**, **Compartilhar** -> aparece o seletor do Android (`uiFind`); `adb shell run-as com.productphoto.offline ls cache/exports` tem 1 `.zip`; `adb exec-out run-as com.productphoto.offline cat cache/exports/<zip>` -> no PC o `zipfile` lê N entradas `.png` com cabeçalho PNG. Fechar com `input keyevent BACK`.
  8. **Exportar** -> **WebP**, **Página atual**, Salvar -> 1 `.webp` (caminho de página única).
  9. Limpeza: apagar só os arquivos com o `<ts>` do teste em `Pictures/ProductPhoto` e `Download/ProductPhoto` (o aparelho é do dono); `am force-stop com.google.android.documentsui` se algum seletor ficou aberto.
- **Controle positivo:** APK da base (já com a TASK-09): a receita falha nos passos 2/3 — o painel não tem "Variável do lote" e não existe "⚡ Gerar em lote" (`uiFind('Gerar em lote')` vazio); na folha Exportar, `[...document.querySelectorAll('select option')].map(o => o.value)` sem `webp`/`pdf`. Complemento de protocolo: `ppEditor.call('export', {format:'webp', action:'save', name:'x', data:<png dataURL>})` -> `ppEditor.last` = `{ok:false, code:'invalid'}` (`ExportFormat.of` lança `format webp`).
- **T3 regressão direcionada:** vitest completo + testes de unidade do `build` (`EditorProtocolTest`, `TextPromptsTest`, `VideoRendererTest`); E2E vizinhos dos arquivos tocados (`main.ts`/`editor.ts`/`EditorSession.kt`): `task11.mjs` (troca de foto/camadas/inspetor — `renderProps`), `task14.mjs` (texto/localizar), `task12.mjs` (painel de forma), o E2E da TASK-09 (páginas) se existir e `task04.mjs` (GIF/MP4 pela folha Exportar mexida; o encode `task04_encode.mjs` só no moto/arm64). PNG/JPG/SVG de página única, "Ver em mockup" e "Imprimir" PNG continuam (passo 8 + Imprimir abre o diálogo do sistema; `BACK`).
- **T4:** logcat do PID sem `AndroidRuntime`/`FATAL`/`OutOfMemoryError` durante os exports em lote; console do WebView sem erro.

### Sessões seguintes

- dev: effort high, ultrathink sim — ponte WebView <-> Kotlin com protocolo novo (staging do lote), `PdfDocument` com geometria de impressão, medição de texto no Fabric e integração com o modelo de páginas da TASK-09, que ainda vai ser mergeado (ler e adaptar o plano).
- teste: effort medium, ultrathink não — receita longa mas objetiva (sinais por CDP e arquivos por adb); o cuidado é limpar os exports no aparelho do dono.
