# [TASK-03] Conta-Gotas (Eyedropper no Canvas), Paleta do Documento e Verificador de Contraste WCAG

## Metadados e Esforço Mensurado

| Campo | Valor |
| :--- | :--- |
| **ID** | `TASK-03` |
| **Prioridade** | **Alta (Quick Win — P1)** |
| **Esforço Mensurado** | **Baixo** — **~1 dia útil (6h–8h / 2 Story Points)** |
| **Escopo** | 100% Local (`editor-web` em TypeScript / Canvas 2D) |
| **Referência Analisada (`com.desygner.ads`)** | `extracted/assets/public/docs/create.md` (L651–L680: Eyedropper, Document Colors, Recent Colors) e `extracted/assets/public/docs/brand.md` (L159–L169: Contrast Checker WCAG) |

### Detalhamento do Esforço por Subtarefa
1. **Ferramenta de Conta-Gotas Interativo (`eyedropper.ts`) com Lupa de Precisão para Toque:** ~3h.
2. **Extrator de Paleta *"Cores neste anúncio"* + Histórico de Cores Recentes:** ~2h.
3. **Verificador de Contraste WCAG 2.1 (Luminância Relativa e Alerta de Legibilidade em Textos/Selos):** ~2h.
4. **Testes Unitários (Vitest) e Ajustes de UI em `dom.ts` / `main.ts`:** ~1h.

---

## 1. Contexto e Problema Atual

Ao montar um anúncio a partir da foto de um produto (ex.: um pote de suplemento vermelho e dourado, ou um tênis azul-marinho), o anunciante quer que os textos de oferta, formas e selos usem **exatamente os tons da embalagem do produto**.
Atualmente, em [`editor-web/src/dom.ts`](file:///c:/projects/sandbox/product_photo_offline/editor-web/src/dom.ts#L37-L41) e [`editor-web/src/main.ts`](file:///c:/projects/sandbox/product_photo_offline/editor-web/src/main.ts):
- O seletor de cor [`colorInput()`](file:///c:/projects/sandbox/product_photo_offline/editor-web/src/dom.ts#L37-L41) abre apenas o `<input type="color">` nativo do WebView Android, que **não possui conta-gotas para amostrar pixels do canvas**.
- Também não há uma listagem automática das **cores que já estão sendo usadas no anúncio atual** (o que força o usuário a adivinhar o código hexadecimal para repetir a mesma cor do título no contorno de uma forma).
- Por fim, usuários leigos frequentemente colocam texto amarelo claro sobre fundo branco ou texto escuro sobre fundo escuro, prejudicando a leitura do preço no anúncio.

---

## 2. O que deve ser feito (Especificação Técnica Detalhada)

### 2.1. Conta-Gotas no Canvas com Lupa de Toque (`eyedropper.ts`)
Criar o módulo [`editor-web/src/eyedropper.ts`](file:///c:/projects/sandbox/product_photo_offline/editor-web/src/eyedropper.ts):

1. **Captura do Buffer do Canvas:**
   - Ao ativar o modo Conta-Gotas (`pickColorFromCanvas(editor): Promise<string | null>`), renderizar o estado atual do canvas (incluindo fundo, imagens e camadas visíveis, sem alças de seleção) em um `<canvas>` offscreen de tamanho `docWidth × docHeight` (via `editor.canvas.toCanvasElement(1)`).
   - Ocultar temporariamente a sheet aberta (se houver) e exibir um banner superior: *"Arraste o dedo sobre a imagem para capturar uma cor"* + botão *"Cancelar"*.
2. **Lupa Ampliadora (Magnifier Loupe):**
   - Enquanto o dedo desliza sobre o palco (`pointerdown` / `pointermove`), posicionar uma lupa circular flutuante (`96×96 px`) `60 px` **acima** da ponta do dedo (para que o próprio dedo não tampe o pixel amostrado!).
   - A lupa desenha uma grade ampliada $7 \times 7$ pixels ao redor da coordenada $(x, y)$ do documento, com uma mira central destacando o pixel exato e exibindo o código `#RRGGBB` + amostra da cor na borda da lupa.
3. **Confirmação no `pointerup`:**
   - Ao soltar o dedo, lê os bytes `[R, G, B, A]` via `offscreenCtx.getImageData(x, y, 1, 1).data`, converte para hexadecimal `#rrggbb`, encerra o modo conta-gotas, adiciona a cor às `recentColors` e aplica imediatamente à propriedade alvo (preenchimento, contorno, fundo ou sombra).

### 2.2. Paleta *"Cores neste anúncio"* e Cores Recentes
Expandir o componente de seleção de cor para além do `<input type="color">` simples:

1. **Extração de Cores do Documento (`extractDocumentColors(editor)`):**
   - Percorre `editor.canvas.getObjects()` + `editor.canvas.backgroundColor`:
     - Coleta `fill`, `stroke`, `textBackgroundColor` e paradas de gradiente (`colorStops`) de todas as camadas visíveis;
     - Normaliza para `#rrggbb` minúsculo via [`toHex()`](file:///c:/projects/sandbox/product_photo_offline/editor-web/src/dom.ts#L51-L59) e remove duplicatas.
   - Opcionalmente, se houver uma `FabricImage` principal (produto), extrai até 4 cores dominantes da imagem por quantização simples em grade $16 \times 16$ (ignorando pixels transparentes `alpha < 128`).
2. **Histórico de Cores Recentes (`recentColors`):**
   - Mantém até 8 cores usadas recentemente na sessão (persistidas em `localStorage` sob chave `pp_recent_colors` com fallback em memória).
3. **Integração na UI (`colorPickerSheet` ou Popover Rápido):**
   - Ao lado de cada [`colorInput()`](file:///c:/projects/sandbox/product_photo_offline/editor-web/src/dom.ts#L37-L41) (ou ao tocar num botão `💧` acoplado ao `colorInput`), permitir:
     - Tocar em **💧 Conta-gotas** para amostrar do canvas;
     - Escolher com 1 toque entre **Cores da Marca (Brand Kit)**, **Cores neste anúncio** e **Cores recentes**, ou abrir o seletor livre `<input type="color">`.

### 2.3. Verificador de Contraste e Legibilidade WCAG 2.1 (`contrast.ts`)
Criar funções puras de acessibilidade e leitura visual para anúncios:

1. **Cálculo de Luminância Relativa ($L$) e Razão de Contraste ($CR$):**
   - Para cada canal $c \in \{R, G, B\}$ normalizado em $[0, 1]$:
     $$c_{\text{lin}} = \begin{cases} \frac{c}{12.92} & \text{se } c \le 0.04045 \\ \left(\frac{c + 0.055}{1.055}\right)^{2.4} & \text{se } c > 0.04045 \end{cases}$$
   - Luminância relativa:
     $$L = 0.2126 \cdot R_{\text{lin}} + 0.7152 \cdot G_{\text{lin}} + 0.0722 \cdot B_{\text{lin}}$$
   - Razão de contraste entre a cor do texto ($L_1$) e a cor efetiva de fundo sob a caixa do texto ($L_2$):
     $$CR = \frac{\max(L_1, L_2) + 0.05}{\min(L_1, L_2) + 0.05}$$
2. **Amostragem Inteligente do Fundo sob o Texto:**
   - Se o `Textbox` possuir `textBackgroundColor` definido, comparar `fill` contra `textBackgroundColor`.
   - Caso contrário, amostrar a cor média de 9 pontos (grade $3 \times 3$) da região do canvas imediatamente **abaixo** do `Textbox` (ocultando temporariamente o próprio `Textbox` ou lendo o objeto/fundo subjacente).
   - Se o texto tiver contorno forte (`strokeWidth >= 2`) ou sombra escura forte, considerar a cor do contorno/sombra na proteção de leitura.
3. **Indicador Visual e Correção em 1 Toque em `textProps()`:**
   - Quando $CR < 3.0$ (contraste ruim mesmo para texto grande de título), exibir um chip de aviso amarelo/laranja discreto em `textProps()`:
     - `⚠️ Baixo contraste (2.1:1) — Corrigir`
   - Ao tocar em **"Corrigir"**, sugere/aplica automaticamente a cor de maior contraste da paleta do Brand Kit (ou alterna o texto para branco `#ffffff` / preto `#111111` ou adiciona um fundo marca-texto de alto contraste).

---

## 3. Arquivos a Criar / Modificar

| Arquivo | Ação | Descrição |
| :--- | :---: | :--- |
| [`editor-web/src/eyedropper.ts`](file:///c:/projects/sandbox/product_photo_offline/editor-web/src/eyedropper.ts) | **Criar** | Ferramenta interativa de Conta-Gotas com lupa no canvas, extrator de cores do documento/produto (`extractDocumentColors`) e cálculo de contraste WCAG (`contrastRatio`, `suggestReadableColor`). |
| [`editor-web/src/dom.ts`](file:///c:/projects/sandbox/product_photo_offline/editor-web/src/dom.ts) | **Modificar** | Adicionar botão de conta-gotas `💧` opcional ao componente `colorInput()` e helper de chips de cores do documento. |
| [`editor-web/src/main.ts`](file:///c:/projects/sandbox/product_photo_offline/editor-web/src/main.ts) | **Modificar** | Integrar o Conta-Gotas e a linha de "Cores neste anúncio" nos seletores de cor de Texto, Forma, Selo e Fundo; exibir o alerta/botão de contraste WCAG em `textProps()`. |
| [`editor-web/src/styles.css`](file:///c:/projects/sandbox/product_photo_offline/editor-web/src/styles.css) | **Modificar** | Estilos da lupa flutuante (`.eyedropper-loupe`), banner de instrução e badge de contraste WCAG (`.contrast-warn`). |
| [`editor-web/test/eyedropper.test.ts`](file:///c:/projects/sandbox/product_photo_offline/editor-web/test/eyedropper.test.ts) | **Criar** | Testes unitários cobrindo `relativeLuminance`, `contrastRatio` (ex.: branco vs. preto = `21:1`, cinza médio vs. branco), `suggestReadableColor` e deduplicação de `extractDocumentColors`. |

---

## 4. Critérios de Aceite e Verificação

- [x] Tocar no ícone **💧 Conta-gotas** em qualquer seletor de cor (texto, contorno, forma, selo ou fundo) permite arrastar o dedo sobre o canvas com uma lupa ampliada visível acima do dedo e, ao soltar, aplica exatamente a cor do pixel amostrado.
- [x] A seção **"Cores neste anúncio"** exibe as cores presentes nas camadas atuais e na foto do produto para reutilização com 1 toque.
- [x] Ao colocar um texto claro sobre fundo claro (razão de contraste $< 3.0$), o painel de propriedades do texto exibe o aviso `⚠️ Baixo contraste` e o botão de correção resolve a legibilidade em 1 toque.
- [x] `npx vitest run` e `npm run build` passam com 0 erros.


---

## 5. Registro da implementação (sessão 2026-11-05)

### 5.1. Etapa analítica — símbolos abertos
- `dom.ts::colorInput(label, value, onInput)` — só `<input type=color>`; quem chama aplica a cor no `onInput`. Usado em
  `main.ts::renderProps` (forma: Preenchimento/Contorno), `textProps` (Cor, Fundo Marca-Texto, Contorno),
  `showBackgrounds` (Cor sólida) e `showShadowSheet`. Mudar o comportamento dentro de `colorInput` cobre todos.
- `dom.ts::openSheet` substitui o conteúdo de `#sheet` → abrir a paleta como sheet destruiria a sheet de onde veio (Sombra,
  Fundo). Decisão: paleta é um popover próprio (`#palette`, z-index acima de `#sheet`), e o conta-gotas só **esconde**
  `#sheet`/`#palette` enquanto amostra.
- `Editor.renderPage` (privado): viewport identidade + `isExporting = true` (sem overlays/guias) + `toDataURL`.
  Fabric 7.4 `StaticCanvas.toCanvasElement(multiplier, {left, top, width, height, filter})` (dist/index.mjs L2792) desenha
  com o viewport atual deslocado por `left/top` e aceita `filter(obj)`; `Canvas.toCanvasElement` (L12764) tira o contexto
  do upper canvas (sem alças). O `renderCanvas` dispara `after:render`, por isso o `isExporting` é obrigatório.
  → novo `Editor.renderPageCanvas(maxSide, filter?)` com a mesma receita, devolvendo o `<canvas>`.
- `Editor.zoom` é privado; o mapeamento toque → documento usa `canvas.viewportTransform` invertido (`util.invertTransform`)
  sobre a posição CSS no `lowerCanvasEl` — continua certo quando a TASK-13 mudar o viewport (pan/zoom).
- `main.ts::editor.onChange` dispara a cada instantâneo do histórico (debounce 250 ms) → ponto para atualizar o chip de
  contraste ao vivo (a cor pelo `<input type=color>` não chama `renderProps`).
- `EditorSession.kt` L111: `domStorageEnabled = true` → `localStorage` existe no WebView; mesmo assim acesso em `try`.
- `main.ts::brandColorChips` — papéis `primary/secondary/accent/text` do `brandKit.colors`.

### 5.2. Hipóteses descartadas
- Paleta dentro de `openSheet`: descartada (apaga a sheet de origem, ver acima).
- Amostrar o `lowerCanvasEl` direto: descartada — tem alças, guias, overlays de zona segura e retina; o conta-gotas pegaria a
  cor da alça azul.
- Média dos 9 pontos em espaço linear: a especificação pede média simples; feita em sRGB (diferença irrelevante para o
  limiar 3:1).

### 5.3. O que foi feito (tasks → prova)
1. `contrast.ts` (puro): `parseColor`, `relativeLuminance`, `contrastRatio`, `averageColor`, `suggestReadableColor`
   → `test/contrast.test.ts`.
2. `palette.ts` (puro): `collectColors` (fill/stroke/textBackgroundColor/colorStops, recursivo em grupos, ignora invisíveis),
   `dominantColors(rgba, w, h, k)`, `RecentColors` (8, `pp_recent_colors`) → `test/palette.test.ts`.
3. `eyedropper.ts` (DOM): `pickColorFromCanvas(editor)` — camada sobre `#stage`, banner + Cancelar, lupa 96 px 60 px acima
   do dedo com grade 7×7 e `#rrggbb`; aplica no `pointerup`.
4. `dom.ts::colorInput` ganha o botão 🎨 (abre o popover registrado por `setColorPaletteProvider`); `main.ts` registra a
   paleta (💧 Conta-gotas, Marca, Neste anúncio, Recentes, Outra cor) e o chip `⚠️ Baixo contraste (x:1) — Corrigir` em
   `textProps`.
5. E2E no emulador `pp_api34` pelo app real (ver §5.4).

### 5.4. Provas (2026-11-05)
- `npx tsc --noEmit` limpo; `npx vitest run` → 14 arquivos, 88 testes (novo `test/contrast.test.ts`: luminância, 21:1,
  `#777777` vs branco ≈ 4,48, sugestão marca/preto/branco, `collectColors` com grupo/degradê/invisível/imagem,
  `dominantColors` com transparência e mínimo de 8 %, `RecentColors` persistida/corrompida, `pixelHex`).
- `npm run build` + `:app:assembleDebug` + `adb install -r` no emulador `pp_api34` (`tools/e2e/rebuild.sh`).
- E2E no app real: `node tools/e2e/task03.mjs <pasta>` (driver `tools/e2e/cdp.mjs`: DevTools do WebView, toques reais
  `Input.dispatchTouchEvent`, abre o app por "Novo design → Post Facebook") → **19/19 PASS**: aviso `⚠️ Baixo contraste
  (1.1:1)` no título `#fff176` sobre branco; "Corrigir" → `#111111` (18,9:1) e o aviso some; 🎨 no "Cor" abre a paleta com
  fundo/retângulo/texto; 💧 arrasta até o retângulo, lupa de 96 px com o fundo 60 px acima do dedo mostrando `#e53935`,
  soltar aplica `#e53935` e grava nas recentes; 1 toque numa recente pinta a forma; no "Fundo" a sheet fica `display:none`
  durante a amostragem e volta depois com o fundo trocado; foto azul/laranja entra como `#1e88e5`/`#ff9800`; Cancelar não
  muda nada; nenhuma exceção JS.
- Achado no E2E e corrigido: a 1ª rodada listava `#000000` (fill padrão `rgb(0,0,0)` de toda `FabricImage`) e `#bf9340`
  (mistura de borda da redução 16×16) → `collectColors` ignora fill/stroke de `type === 'image'`; `dominantColors` exige
  8 % dos pixels opacos.
- Ambiente: o emulador estava com 434 MB livres (INSTALL_FAILED_INSUFFICIENT_STORAGE); revertidas as atualizações da Play
  Store de Maps, YouTube, YT Music, Fotos, Docs, Gmail e Agenda (`pm uninstall-system-updates`) → 1,7 GB livres.
  WebView/Chrome/GMS intactos.
