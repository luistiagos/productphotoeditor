# [TASK-09] Projetos Multi-Páginas (Carrossel / Catálogo), Magic Resize Multi-Formato e Transferência de Estilo de Fundo

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

