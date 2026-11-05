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

---

## Planejamento (pipeline 20261105-1638, 2026-11-05)

**Veredito:** bloqueado — a task junta dois motores independentes (molduras/foto no texto e Pathfinder booleano) e a
estimativa conferida no código (~1.950–2.250 linhas novas) passa do teto de uma sessão de dev do manual (> ~1.500
linhas); proposta de divisão em duas tasks abaixo, **o dono decide**.
**Complexidade:** alta — formato de dados novo no documento (`clipPath` gerado + propriedades próprias + `Pattern` no
`fill` do texto), patch de renderização de classe do Fabric (aro da moldura) e motor geométrico novo; tudo em
`editor-web` (um módulo), mas cada metade sozinha já é `media`/`alta`.
**Severidade:** medio — funcionalidade P2 ausente (não há como mascarar foto em forma, preencher texto com foto nem
combinar formas); nada existente quebra.
**Arquivos a alterar (reserva da onda, quando a divisão for aprovada):**
- Parte A (molduras + foto no texto): `editor-web/src/clipFrames.ts` (novo), `editor-web/src/editor.ts`,
  `editor-web/src/main.ts`, `editor-web/src/document.ts`, `editor-web/test/clipFrames.test.ts` (novo),
  `tools/e2e/task06.mjs` (novo), `editor/src/main/assets/editor/index.html` (bundle regerado).
- Parte B (Pathfinder): `editor-web/src/pathBoolean.ts` (novo), `editor-web/src/editor.ts`, `editor-web/src/main.ts`,
  `editor-web/test/pathBoolean.test.ts` (novo), `tools/e2e/task<NN>.mjs` (novo, NN da task nova),
  `editor/src/main/assets/editor/index.html`.
- As duas partes reservam `editor.ts`, `main.ts` e o `index.html` do bundle: vão em ondas distintas de qualquer jeito.

### Causa raiz (símbolos abertos: `arquivo::simbolo` — faz X; em erro, Y)

Item é task: "causa" = estado atual do código, conferido contra o plano do autor (§2/§3 acima). As linhas citadas
nas §1–§3 estão desatualizadas (o `editor.ts` cresceu com as TASK-01..14); as daqui são da base `0d616c3`.

- `editor-web/src/editor.ts::Editor.startCrop` (L1292) — só recorte retangular: troca `img.controls` por
  `createImageCroppingControls()` (cropX/cropY/width/height); `endCrop` (L1302) devolve os controles e faz `commit`.
  Nenhum `clipPath` é criado no editor (único uso: `swapImage` L1279, que só o preserva).
- `editor.ts::Editor.replaceImage` (L1256) — usado por remover fundo/objeto/texto e upscale (`main.ts` L1032–1100):
  guarda filtros e aplica `rescaledGeometry` (width×fx, scaleX/fx, crop×fx). **Não mexe em `clipPath`**: como o
  `clipPath` (não `absolutePositioned`) mora nas unidades locais do objeto, um upscale ×2 numa foto emoldurada
  deixaria a moldura com metade do tamanho na tela. A moldura tem de ser **regerada a partir de uma spec** depois de
  toda troca de fonte.
- `editor.ts::Editor.swapImage` (L1275) — é o "🔄 Substituir" da TASK-11: o "🔄 Trocar foto" do §2.1.3 **já existe**
  (`main.ts::showSwapImage` L953, botão `.swap-btn` em `imageProps` L973). Preserva o objeto `clipPath`, mas `fitSlot`
  (`imageGeometry.ts`) muda width/height/scale → mesma desproporção. Basta regerar a moldura no fim.
- `editor-web/src/document.ts::CUSTOM_PROPERTIES` (L76) → `FabricObject.customProperties` (`editor.ts` L54): o que
  entrar ali vai no `toObject()`, no snapshot e no undo. Lição da TASK-12: spec gravada no objeto **não pode ter
  campo `type`** com nome de classe do Fabric (o revive a transforma) — usar `kind`.
- Fabric 7.4 `shapes/Object/Object.ts::drawObject` (L823–842): `_render(ctx)` e **depois** `_drawClipPath`
  (composição destination-in) → tudo que o `_render` desenha é recortado; o aro tem de ser desenhado **depois** do
  `drawObject` original (envolver `FabricImage.prototype.drawObject`, como `curve.ts::installWarpRenderer` L352
  envolve o `_render` do Textbox) e caber no cache do objeto (`_getCacheCanvasDimensions`, L440): o mais simples é
  aro **interno** (traço de largura 2w recortado pela própria forma). Patch de classe, não de instância: o
  `renderThumbnail` (StaticCanvas, `editor.ts`) e o export de vídeo também desenham.
- Export: `FabricObjectSVGExportMixin.ts::_createBaseSVGMarkup` (L195–257) já emite `<clipPath>` e `fill` de
  Pattern/Gradient (`isFiller`) → o SVG da foto recortada e do texto com foto vêm de graça; **o aro não** (precisa de
  `toSVG` estendido, ex.: `<path>` com stroke ao lado). `editor.ts::exportVideoBundle` rasteriza cada camada na
  `getBoundingRect()` + margem de 2 px → moldura/padrão saem no MP4 se o canvas os desenhar; um aro fora da caixa
  seria cortado (outro motivo para aro interno). PNG/JPG = `renderPage` → `toDataURL`, idem.
- Fabric `Pattern/Pattern.ts::toObject` serializa `source` (= `img.src`) e `fromObject` recarrega a imagem;
  `util/misc/objectEnlive.ts::enlivenObjectEnlivables` (L157–186) revive o `fill` com `type:'pattern'` no
  `loadFromJSON` → o `textPatternSrc` do doc é redundante para o revive; o que falta é **refazer o
  `patternTransform` (cover) quando a caixa do texto muda**, no mesmo ponto do `refreshGradient` (`editor.ts`
  L120–121, eventos `object:modified`/`text:changed`; `refreshGradient` L837).
- `main.ts::renderProps` (L203) — `ActiveSelection` cai no `else` de formas (cor/contorno) e ganha `🔗 Agrupar`; é
  ali que entra a linha do Pathfinder (≥ 2 formas fechadas preenchidas). `textProps` L543, `imageProps` L970.
- `editor.ts::makeShape` (L1666) — formas do editor: `Rect` (rx/ry: rounded/pill), `Circle`, `Triangle`, `Polygon`
  (star, badge-hex), `Path` (arrow), `Line`. O Pathfinder aceita Rect/Circle/Ellipse/Triangle/Polygon/Path
  preenchidos; exclui `Line`, conector (`Group` com `connectorSpec`), traço à mão (`freehandDraw.ts::isFreehandPath`),
  texto, imagem e grupo.
- Fabric `shapes/Object/ObjectGeometry.ts::calcTransformMatrix` (L487) — sem `skipGroup` já multiplica a matriz do
  grupo (`ActiveSelection`) → coordenadas de página dos objetos selecionados. Pontos de `Polygon`/`Path` são relativos
  a `pathOffset`: subtrair antes de aplicar a matriz.

### Provas (comando literal -> resultado)
- `grep -n "clipPath\|Pattern" editor-web/src/editor.ts editor-web/src/main.ts` → só `editor.ts:429` (comentário de
  degradê) e `editor.ts:1279` (`swapImage` preserva `clipPath`): não há moldura nem padrão hoje.
- `wc -l editor-web/src/*.ts` → `editor.ts` 1719, `main.ts` 1893; maiores módulos de task até aqui: `curve.ts` 374,
  `snapping.ts` 370, `connectors.ts` 140, `gradients.ts` 126. `wc -l tools/e2e/*.mjs` → `task12.mjs` 227,
  `task14.mjs` 326.
- Estimativa (calibrada na TASK-12, 5 SP: ~1.000 linhas entre módulos, teste, E2E e UI):
  Parte A ≈ `clipFrames.ts` 350–400 (15 formas, aro, `toSVG` do aro, helper do Pattern) + `editor.ts` ~150 +
  `main.ts` ~150 + teste ~150 + E2E ~220 ≈ **1.000–1.100**; Parte B ≈ `pathBoolean.ts` 500–700 (achatamento de
  Rect com rx/Circle/Polygon/Path com Bézier e arcos ≤ 0,5 px + recorte poligonal com casos degenerados + anéis→`d`)
  + `editor.ts` ~60 + `main.ts` ~40 + teste ~200 + E2E ~150 ≈ **950–1.150**. Total ≈ 1.950–2.250 > 1.500.

### Hipoteses descartadas (e por que)
- *"Trocar foto" é trabalho novo* — não: existe desde a TASK-11 (`swapImage` + `.swap-btn`); falta só regerar a
  moldura depois da troca (e do `replaceImage` das ações de IA).
- *Guardar o `clipPath` como objeto e confiar no Fabric* — quebra no upscale e na troca (as unidades locais mudam com
  `rescaledGeometry`/`fitSlot`). Fonte da verdade = spec (`clipShape` + parâmetros); `clipPath` regerado da caixa
  atual.
- *Desenhar o aro dentro do `_render`* — o `_drawClipPath` recorta depois (Object.ts L838–839): metade do traço some.
- *`textPatternSrc` para reviver o padrão* — o Fabric já serializa e revive `Pattern` pelo `fill`; a spec própria só
  serve para refazer o cover quando o texto muda.
- *Implementar tudo numa sessão só* — pela regra do manual (seção Itens), task acima do teto vira `bloqueado` com
  divisão, nunca implementação pela metade; o motor booleano sozinho seria o maior módulo de task do editor.
- *Dependência npm de recorte poligonal para encurtar a Parte B* — o doc pede TypeScript puro sem dependência; só o
  dono muda isso (se mudar, a Parte B cai para ~500 linhas e a task inteira caberia numa sessão).

### Proposta de divisão (o dono decide)
1. **TASK-06 (reduzida) — Molduras de recorte + foto dentro do texto** (§2.1 e §2.2; critérios 1, 2, 4 e 5 da §4
   restritos a moldura/texto).
2. **TASK nova (próximo número livre) — Pathfinder: operações booleanas de formas** (§2.3; critério 3 e a parte de
   "formas combinadas" do 4). Independente da A (não usa nada dela); pode ir antes ou depois.
Alternativa: autorizar uma dependência npm de recorte poligonal (licença MIT, sem rede em runtime) e manter a task
inteira. Com a decisão, o próximo planning só confere esta seção (os símbolos já estão abertos acima).

### Tarefas
Parte A:
- [ ] `editor-web/src/clipFrames.ts` (novo) — `ClipShapeKind` (none, circle, rounded-sm/lg, pill, leaf-tr/tl,
  starburst-12/20, hexagon, diamond, shield, arch, heart), `clipPathFor(kind, w, h): FabricObject` centrado na caixa
  local, `installFrameRenderer(FabricImage)` (aro interno depois do `drawObject`), SVG do aro para o `toSVG`, e
  `coverPatternTransform(imgW, imgH, boxW, boxH)` — vitest `test/clipFrames.test.ts`: cada forma dentro da caixa
  (bbox ≤ w×h), pílula/círculo tocam os extremos, o cover cobre a caixa inteira.
- [ ] `editor-web/src/document.ts::CUSTOM_PROPERTIES` — `clipShape`, `clipScale`, `clipOffsetX`, `clipOffsetY`,
  `frameStroke`, `frameStrokeWidth`, `textPatternSrc` — vitest: round-trip `toObject`/`loadFromJSON` preserva tudo.
- [ ] `editor.ts` — `setImageFrame(spec)`, `refreshFrame(img)` chamado no fim de `swapImage`, `replaceImage`,
  `endCrop` e no `load`/`restore`; zoom/pan interno pelo crop (caixa na página constante); `setTextImageFill(url|null)`
  e refit do cover junto do `refreshGradient` — vitest: a moldura sobrevive a `swapImage` e a `replaceImage` com fator
  2 mantendo a mesma caixa na página (bbox do `clipPath` × escala = caixa da imagem).
- [ ] `main.ts::imageProps` — botão `🖼️ Moldura` (`.frame-btn`) com sheet: grade das formas, cor/espessura do aro
  (0–40), zoom 1–3×, posição X/Y; `textProps` — `🖼️ Foto no texto` (galeria via `pickImage`) e "Remover foto".
- [ ] `tools/e2e/task06.mjs` — a T2 abaixo.
Parte B:
- [ ] `editor-web/src/pathBoolean.ts` (novo) — `shapeToPolygonRings(obj)` (matriz de página, `pathOffset`, curvas ≤
  0,5 px), `booleanOp(a, b, op)` (`union|subtract|intersect|exclude`), `ringsToPathD` (evenodd) — vitest
  `test/pathBoolean.test.ts`: quadrados sobrepostos/disjuntos/contidos/com aresta comum, quadrado × círculo; área de
  cada resultado contra a fórmula (±0,5%) nas 4 operações.
- [ ] `editor.ts::applyBooleanOp(op)` — sobre `ActiveSelection` de ≥ 2 formas válidas, ordem = pilha (base = a mais
  de baixo; subtrair = base − demais), remove as originais, adiciona `Path` com fill/stroke/`brandColor` da base, um
  só snapshot (1 undo) — vitest: o undo devolve as N formas.
- [ ] `main.ts::renderProps` — linha do Pathfinder (`.bool-union|subtract|intersect|exclude`) só quando a seleção tem
  ≥ 2 formas válidas.

### Plano de teste
- **Offline (sem slot):** `npx tsc --noEmit` e `npx vitest run` em `editor-web/` (testes acima); áreas do booleano
  contra fórmula; SVG da página com moldura contém `<clipPath>` e o `<path>` do aro.
- **T2 reprodução como o usuário (E2E, no slot):** Parte A — "Novo design → Post Facebook"; foto na página (setup por
  `evaluate` `editor.addImage(dataURL)` como `task11.mjs` L14, só como preparo); tocar na foto → `#props .frame-btn`
  → forma "Selo explosão" e depois "Círculo", aro com cor e espessura 12, zoom 2× → sinal: `img.clipShape` e
  `img.clipPath` presentes; no `editor.renderPageCanvas()`, pixel no canto da caixa (fora da forma) = cor do fundo e
  pixel na borda da forma = cor do aro; `.swap-btn` → galeria (`/sdcard/Pictures/e2e_swap.jpg`) → moldura mantida e
  bbox na página igual (±1 px); texto "VERÃO" → `🖼️ Foto no texto` → `fill` é `Pattern` e pixel dentro de uma letra ≠
  cor sólida antiga; ↶ desfaz; exportar PNG e SVG (`exportImage`) com a moldura; print do aparelho em cada passo.
  Parte B — retângulo + círculo sobrepostos pelo botão de formas, seleção múltipla pelo painel Camadas ("Selecionar
  Vários", como `task11.mjs` L34–40) → `.bool-subtract` → sinal: 1 objeto `path` no lugar dos 2, pixel na área do
  círculo = fundo; ↶ → 2 objetos de volta; `.bool-union` → 1 `path` com bbox = união das caixas.
- **Controle positivo:** APK da base: `#props .frame-btn` e `.bool-*` não existem (`querySelector` nulo) e
  `editor.setImageFrame`/`editor.applyBooleanOp` são `undefined` — a funcionalidade está ausente.
- **T3 regressão direcionada:** `task11.mjs` (substituir foto, agrupar, camadas), `task12.mjs` (trocar forma, degradê
  em forma/texto — o refit do padrão divide o ponto com o `refreshGradient`), `task14.mjs` (localizar e substituir em
  texto), `task03.mjs` (conta-gotas lê o canvas com o aro); vitest inteiro.

### Sessoes seguintes
- dev: effort high, ultrathink sim — geometria/transformação no Fabric (manual) e, na Parte B, recorte poligonal com
  casos degenerados.
- teste: effort medium, ultrathink não — leitura de pixel/objeto por CDP em roteiro já modelado pelos E2E vizinhos.

