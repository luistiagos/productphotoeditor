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

