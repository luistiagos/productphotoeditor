# [TASK-06] Molduras de Recorte (Clip Frames), Imagem dentro de Texto/Forma e Operações Booleanas (Pathfinder)

## Metadados e Esforço Mensurado

| Campo | Valor |
| :--- | :--- |
| **ID** | `TASK-06` |
| **Prioridade** | **Média (P2)** |
| **Esforço Mensurado** | **Médio** — **~3 a 4 dias úteis (24h–32h / 5 a 8 Story Points)** *(~1,5–2 dias para Clip Frames/Máscaras de Forma e Texto + ~1,5–2 dias para Operações Booleanas Pathfinder)* |
| **Escopo** | 100% Local (`editor-web` em TypeScript / Fabric.js 7.4.0) |
| **Referência Analisada (`com.desygner.ads`)** | `extracted/assets/public/docs/create.md` (L229–L238, L871–L890: Clip Frames, Shape Masks & Text Image Fill) e `js_pretty/assets/module-create-DxNmnX1s.js` (L40344–L40430: Sweep-line Boolean Path Operations) |

### Detalhamento do Esforço por Subtarefa
1. **Sistema de Molduras de Recorte (`clipFrames.ts` — Círculo, Pílula, Estrela, Hexágono, Selo Dentado, Polaroid, Cantos Arredondados Individuais):** ~8h.
2. **Modo de Edição Interna da Foto na Moldura (Pan/Zoom dentro do `clipPath` e Botão *"Trocar Foto"* em 1 Toque):** ~6h.
3. **Preenchimento de Texto com Imagem (`Pattern` fill em `Textbox`):** ~3h.
4. **Motor de Operações Booleanas de Formas (`pathBoolean.ts`: `union`, `subtract`, `intersect`, `exclude`):** ~8h.
5. **Testes Unitários (Vitest) e Integração na UI (`main.ts`):** ~3h.

---

## 1. Contexto e Problema Atual

Em anúncios de produtos (especialmente carrosséis, comparativos *"Antes / Depois"*, detalhes de textura/zoom da peça, fotos secundárias no canto do criativo ou selos com foto), é muito comum colocar uma imagem dentro de uma **moldura geométrica** (círculo com borda colorida, estrela, losango, pílula, cantos arredondados assimétricos ou tela de celular).
Atualmente, em [`editor-web/src/editor.ts`](file:///c:/projects/sandbox/product_photo_offline/editor-web/src/editor.ts):
- [`Editor.startCrop()`](file:///c:/projects/sandbox/product_photo_offline/editor-web/src/editor.ts#L570-L587) recorta a `FabricImage` **apenas em formato retangular reto** (`cropX`, `cropY`, `width`, `height`).
- Não é possível mascarar uma imagem em círculo, estrela, coração, escudo ou pílula com aro colorido, nem preencher um texto grande (ex.: `"VERÃO"` ou `"50%"`) com uma imagem/textura.
- Além disso, as 7 formas de [`addShape()`](file:///c:/projects/sandbox/product_photo_offline/editor-web/src/editor.ts) são fixas: não é possível selecionar duas formas (ex.: um retângulo e dois círculos nas laterais) e aplicar **Subtrair (`Difference`)** para criar um cupom/ingresso pontilhado ou **Unir (`Union`)** para criar uma faixa promocional composta.

---

## 2. O que deve ser feito (Especificação Técnica Detalhada)

### 2.1. Molduras de Recorte para Imagens (`clipFrames.ts`)
No Fabric.js 7.4.0, todo `FabricObject` suporta a propriedade `clipPath?: FabricObject` (com `inverted?: boolean` e coordenadas relativas ao centro do objeto quando `absolutePositioned = false`), além de `rx`/`ry` ou `Path` customizado:

1. **Biblioteca de Formas de Máscara (`ClipShapeKind`):**
   - `'none'`: Sem máscara (retangular original).
   - `'circle'`: Círculo / Elipse perfeita (`Circle`).
   - `'rounded-sm'` / `'rounded-lg'` / `'pill'`: Retângulo com cantos arredondados (`12%`, `25%`, `50%` estilo cápsula/pílula).
   - `'leaf-tr'` / `'leaf-tl'`: Cantos arredondados assimétricos (ex.: 3 cantos curvos e 1 reto, ou 2 cantos opostos curvos — estilo folha/gota muito usado em anúncios de cosméticos e gastronomia).
   - `'starburst-12'` / `'starburst-20'`: Selo explosão de 12 ou 20 pontas.
   - `'hexagon'` / `'diamond'` / `'shield'` / `'arch'` (Arco de vitrine: topo semicircular e base reta, clássico de moda/decoração) / `'heart'`.
2. **Borda / Aro Acoplado à Moldura (`frameStroke` e `frameStrokeWidth`):**
   - Quando uma `FabricImage` recebe uma máscara `clipShape`, permitir definir uma **Borda da Moldura** (cor + espessura `0..40 px`).
   - Como o `stroke` nativo do `FabricImage` desenha um retângulo ao redor da caixa inteira e não segue o `clipPath`, sobrescrever ou anexar um hook no `_render` (ou renderizar o `Path` do `clipPath` com `ctx.stroke()` logo após desenhar a imagem recortada), garantindo que o aro siga perfeitamente a estrela, o círculo, o arco ou a pílula!
3. **Ajuste de Enquadramento Interno (Zoom & Pan dentro da Moldura) e *"Trocar Imagem"*:**
   - Adicionar propriedades customizadas `'clipShape'`, `'clipScale'`, `'clipOffsetX'`, `'clipOffsetY'`, `'frameStroke'`, `'frameStrokeWidth'` em `CUSTOM_PROPERTIES` ([`document.ts`](file:///c:/projects/sandbox/product_photo_offline/editor-web/src/document.ts)).
   - Em [`imageProps()` (`main.ts`)](file:///c:/projects/sandbox/product_photo_offline/editor-web/src/main.ts#L429-L451), adicionar:
     - Botão **"🖼️ Moldura (Forma)"**: abre sheet com grade visual das formas de recorte + controles de cor/espessura da borda e sliders de **Zoom interno** (`1.0×` a `3.0×`) e **Posição X / Y interna**;
     - Botão **"🔄 Trocar imagem"**: abre `pickImage` e chama [`editor.replaceImage()`](file:///c:/projects/sandbox/product_photo_offline/editor-web/src/editor.ts#L555-L568) preservando integralmente o `clipPath`, a borda, os filtros e a posição no anúncio!

### 2.2. Preenchimento de Texto com Imagem (`Text Image Fill`)
1. Em [`textProps()` (`main.ts`)](file:///c:/projects/sandbox/product_photo_offline/editor-web/src/main.ts#L290-L320), adicionar a opção **"🖼️ Preencher texto com foto"**.
2. Ao escolher uma foto (da galeria ou das texturas/fundos empacotados), criar um `Pattern` do Fabric (`new Pattern({ source: htmlImageEl, repeat: 'no-repeat', patternTransform: [...] })`) escalado automaticamente para cobrir `t.width × t.height` (`object-fit: cover`).
3. Serializar a URL da imagem em `textPatternSrc` (`CUSTOM_PROPERTIES`) para recriar o `Pattern` no `loadFromJSON` e no `exportSvg`.

### 2.3. Operações Booleanas de Formas (`pathBoolean.ts` — Pathfinder)
Inspirado no algoritmo de *sweep-line* encontrado em `module-create-DxNmnX1s.js` (L40344–L40430: `union`, `intersection`, `xor`, `difference`):

1. **Conversão de Primitivas para Polígonos/Beziers no Espaço do Canvas:**
   - Criar função `shapeToPolygonRings(obj: FabricObject): Point[][]` que converte qualquer forma do editor (`Rect`, `Circle`, `Triangle`, `Polygon`, `Path`) aplicando sua matriz de transformação `obj.calcTransformMatrix()` em anéis de vértices 2D (amostrando curvas de Bézier/arcos com tolerância $\le 0.5\text{ px}$).
2. **4 Operações Booleanas (`BooleanOp = 'union' | 'subtract' | 'intersect' | 'exclude'`):**
   - Implementar recorte poligonal 2D determinístico (algoritmo de Greiner-Hormann / Martinez-Rueda sweep-line em TypeScript puro, sem dependências externas):
     - **Unir (`union`):** funde $A \cup B$ em um único `Path` SVG composto (ex.: retângulo + círculo no topo = tag de preço ou vitrine);
     - **Subtrair Frente (`subtract`):** recorta $A \setminus B$ (ex.: retângulo menos dois semicírculos nas pontas = ticket de cupom promocional);
     - **Interseção (`intersect`):** mantém apenas a área comum $A \cap B$;
     - **Excluir (`exclude` / `xor`):** mantém tudo exceto a sobreposição $(A \cup B) \setminus (A \cap B)$ (cria furos vazados).
3. **Fluxo na UI:**
   - Quando $\ge 2$ formas/caminhos estiverem selecionados (`ActiveSelection`), exibir na barra de propriedades (`renderProps`) os 4 botões do **Pathfinder**:
     - `➕ Unir`, `➖ Subtrair`, `✖️ Interseção`, `➗ Vazado (XOR)`.
   - Ao clicar, remove os objetos originais, adiciona o novo `Path` resultante herdando o `fill`/`stroke`/`brandColor` do objeto base e chama `editor.commit()` (permitindo Desfazer com 1 toque).

---

## 3. Arquivos a Criar / Modificar

| Arquivo | Ação | Descrição |
| :--- | :---: | :--- |
| [`editor-web/src/clipFrames.ts`](file:///c:/projects/sandbox/product_photo_offline/editor-web/src/clipFrames.ts) | **Criar** | Gerador de geometrias de `clipPath` (`circle`, `pill`, `leaf`, `arch`, `starburst`, `hexagon`, `shield`, `heart`), renderização do aro/borda seguindo o caminho e helper de `Pattern` para texto. |
| [`editor-web/src/pathBoolean.ts`](file:///c:/projects/sandbox/product_photo_offline/editor-web/src/pathBoolean.ts) | **Criar** | Motor de operações booleanas 2D (`union`, `subtract`, `intersect`, `exclude`) convertendo objetos Fabric em anéis e gerando string SVG `d` com regra `evenodd`/`nonzero`. |
| [`editor-web/src/document.ts`](file:///c:/projects/sandbox/product_photo_offline/editor-web/src/document.ts) | **Modificar** | Adicionar `'clipShape'`, `'clipScale'`, `'clipOffsetX'`, `'clipOffsetY'`, `'frameStroke'`, `'frameStrokeWidth'`, `'textPatternSrc'` em `CUSTOM_PROPERTIES`. |
| [`editor-web/src/editor.ts`](file:///c:/projects/sandbox/product_photo_offline/editor-web/src/editor.ts) | **Modificar** | Adicionar `setImageFrame()`, `setTextImageFill()`, `applyBooleanOp(op)` e restaurar molduras/padrões no `loadDocument()`. |
| [`editor-web/src/main.ts`](file:///c:/projects/sandbox/product_photo_offline/editor-web/src/main.ts) | **Modificar** | Adicionar **"🖼️ Moldura"** e **"🔄 Trocar foto"** em `imageProps()`, **"🖼️ Foto no texto"** em `textProps()` e barra de **Operações Booleanas** quando múltiplas formas estiverem selecionadas. |
| [`editor-web/test/clipFrames.test.ts`](file:///c:/projects/sandbox/product_photo_offline/editor-web/test/clipFrames.test.ts) | **Criar** | Testes unitários validando a geração dos caminhos SVG de todas as molduras e preservação no `replaceImage`. |
| [`editor-web/test/pathBoolean.test.ts`](file:///c:/projects/sandbox/product_photo_offline/editor-web/test/pathBoolean.test.ts) | **Criar** | Testes unitários cobrindo `union`, `subtract`, `intersect` e `exclude` entre quadrados/círculos sobrepostos e disjuntos. |

---

## 4. Critérios de Aceite e Verificação

- [ ] Qualquer foto de produto ou cenário no canvas pode ser colocada dentro de uma moldura (`Círculo`, `Pílula`, `Arco de Vitrine`, `Estrela`, `Selo Explosão`, `Coração`, `Folha`), com borda colorida acompanhando o formato exato da máscara.
- [ ] O botão **"🔄 Trocar foto"** substitui a imagem mantendo a moldura, a borda, o tamanho e a posição intactos.
- [ ] Ao selecionar 2 formas sobrepostas e tocar em **Unir** ou **Subtrair**, o editor gera instantaneamente a forma vetorial combinada, e o botão **Desfazer (`↶`)** restaura as duas formas originais.
- [ ] As molduras e formas combinadas aparecem idênticas na exportação PNG, JPG, SVG e Vídeo MP4.
- [ ] `npx vitest run` e `npm run build` passam sem erros.

