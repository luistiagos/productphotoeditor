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

