# [TASK-06] Molduras de Recorte (Clip Frames) para Imagens

> **Divisão (decisão do dono, 2026-11-05).** O planning 20261105-1638 bloqueou a TASK-06 original (molduras + foto
> dentro do texto + Pathfinder) por tamanho: ~1.950–2.250 linhas novas, acima do teto de ~1.500 de uma sessão de dev.
> Esta task ficou só com as **molduras de recorte para imagens** (§2.1 original). O resto virou task própria:
> - foto dentro do texto (§2.2 original) → [TASK-15](15-preencher-texto-com-foto.md);
> - operações booleanas / Pathfinder (§2.3 original) → [TASK-16](16-pathfinder-operacoes-booleanas-de-formas.md).
>
> As três são independentes. O nome do arquivo ficou o original para não quebrar os links da matriz. O doc original
> inteiro, com a análise completa: `git show cbf5f41:docs/tasks/open/06-molduras-clip-frames-e-operacoes-booleanas.md`.

## Metadados e Esforço Mensurado

| Campo | Valor |
| :--- | :--- |
| **ID** | `TASK-06` |
| **Prioridade** | **Média (P2)** |
| **Esforço Mensurado** | **Médio** — **~2 dias úteis (14h–16h / 3 a 5 Story Points)**; ~850 linhas novas estimadas no planning (código + teste + E2E) |
| **Escopo** | 100% Local (`editor-web` em TypeScript / Fabric.js 7.4.0) |
| **Referência Analisada (`com.desygner.ads`)** | `extracted/assets/public/docs/create.md` (L229–L238, L871–L890: Clip Frames e Shape Masks) |

### Detalhamento do Esforço por Subtarefa
1. **Sistema de Molduras de Recorte (`clipFrames.ts` — Círculo, Pílula, Estrela, Hexágono, Selo Dentado, Arco, Coração, Cantos Arredondados Individuais) com aro que segue a forma:** ~8h.
2. **Enquadramento interno da foto na moldura (zoom/pan) e moldura regerada depois de toda troca de fonte (Substituir, ações de IA, recorte):** ~6h.
3. **Testes Unitários (Vitest), E2E e Integração na UI (`main.ts`):** ~2h.

---

## 1. Contexto e Problema Atual

Em anúncios de produtos (especialmente carrosséis, comparativos *"Antes / Depois"*, detalhes de textura/zoom da peça,
fotos secundárias no canto do criativo ou selos com foto), é muito comum colocar uma imagem dentro de uma **moldura
geométrica** (círculo com borda colorida, estrela, losango, pílula, cantos arredondados assimétricos).
Hoje, em `editor-web/src/editor.ts`:
- `Editor.startCrop()` recorta a `FabricImage` **apenas em formato retangular reto** (`cropX`, `cropY`, `width`, `height`).
- Não é possível mascarar uma imagem em círculo, estrela, coração, escudo ou pílula com aro colorido.

---

## 2. O que deve ser feito (Especificação Técnica Detalhada)

### 2.1. Molduras de Recorte para Imagens (`clipFrames.ts`)
No Fabric.js 7.4.0, todo `FabricObject` suporta a propriedade `clipPath?: FabricObject` (com `inverted?: boolean` e
coordenadas relativas ao centro do objeto quando `absolutePositioned = false`), além de `rx`/`ry` ou `Path` customizado:

1. **Biblioteca de Formas de Máscara (`ClipShapeKind`):**
   - `'none'`: Sem máscara (retangular original).
   - `'circle'`: Círculo / Elipse perfeita (`Circle`).
   - `'rounded-sm'` / `'rounded-lg'` / `'pill'`: Retângulo com cantos arredondados (`12%`, `25%`, `50%` estilo cápsula/pílula).
   - `'leaf-tr'` / `'leaf-tl'`: Cantos arredondados assimétricos (ex.: 3 cantos curvos e 1 reto, ou 2 cantos opostos
     curvos — estilo folha/gota muito usado em anúncios de cosméticos e gastronomia).
   - `'starburst-12'` / `'starburst-20'`: Selo explosão de 12 ou 20 pontas.
   - `'hexagon'` / `'diamond'` / `'shield'` / `'arch'` (Arco de vitrine: topo semicircular e base reta, clássico de
     moda/decoração) / `'heart'`.
2. **Borda / Aro Acoplado à Moldura (`frameStroke` e `frameStrokeWidth`):**
   - Quando uma `FabricImage` recebe uma máscara `clipShape`, permitir definir uma **Borda da Moldura** (cor + espessura `0..40 px`).
   - O `stroke` nativo do `FabricImage` desenha um retângulo ao redor da caixa inteira e não segue o `clipPath`: o aro
     tem de ser desenhado seguindo a forma (ver "Análise herdada": aro **interno**, desenhado depois do `drawObject`).
3. **Ajuste de Enquadramento Interno (Zoom & Pan dentro da Moldura):**
   - Adicionar propriedades customizadas `'clipShape'`, `'clipScale'`, `'clipOffsetX'`, `'clipOffsetY'`,
     `'frameStroke'`, `'frameStrokeWidth'` em `CUSTOM_PROPERTIES` (`document.ts`).
   - Em `imageProps()` (`main.ts`), adicionar o botão **"🖼️ Moldura (Forma)"**: abre sheet com grade visual das formas
     de recorte + controles de cor/espessura da borda e sliders de **Zoom interno** (`1.0×` a `3.0×`) e **Posição X / Y interna**.
   - O **"🔄 Substituir"** da TASK-11 (`swapImage`) já existe: ele tem de preservar integralmente a moldura, a borda,
     os filtros e a posição no anúncio (hoje preserva o objeto `clipPath`, mas não o regera para a caixa nova).

---

## 3. Arquivos a Criar / Modificar

| Arquivo | Ação | Descrição |
| :--- | :---: | :--- |
| `editor-web/src/clipFrames.ts` | **Criar** | Gerador de geometrias de `clipPath` (`circle`, `pill`, `leaf`, `arch`, `starburst`, `hexagon`, `shield`, `heart`...) e renderização do aro/borda seguindo o caminho (canvas e SVG). |
| `editor-web/src/document.ts` | **Modificar** | `'clipShape'`, `'clipScale'`, `'clipOffsetX'`, `'clipOffsetY'`, `'frameStroke'`, `'frameStrokeWidth'` em `CUSTOM_PROPERTIES`. |
| `editor-web/src/editor.ts` | **Modificar** | `setImageFrame()`, `refreshFrame()` e moldura regerada no fim de `swapImage`, `replaceImage`, `endCrop` e no `load`/`restore`. |
| `editor-web/src/main.ts` | **Modificar** | Botão **"🖼️ Moldura"** em `imageProps()` com a sheet de formas, aro, zoom e posição. |
| `editor-web/test/clipFrames.test.ts` | **Criar** | Caminhos de todas as molduras, round-trip das propriedades e moldura preservada no `swapImage`/`replaceImage`. |
| `tools/e2e/task06.mjs` | **Criar** | E2E no aparelho (Plano de teste abaixo). |
| `editor/src/main/assets/editor/index.html` | **Regerar** | Bundle do editor. |

---

## 4. Critérios de Aceite e Verificação

- [ ] Qualquer foto de produto ou cenário no canvas pode ser colocada dentro de uma moldura (`Círculo`, `Pílula`,
  `Arco de Vitrine`, `Estrela`, `Selo Explosão`, `Coração`, `Folha`), com borda colorida acompanhando o formato exato da máscara.
- [ ] O **"🔄 Substituir"** troca a imagem mantendo a moldura, a borda, o tamanho e a posição intactos; o mesmo vale
  depois de remover fundo / melhorar resolução (ações de IA que trocam a fonte).
- [ ] As molduras aparecem idênticas na exportação PNG, JPG, SVG e Vídeo MP4.
- [ ] `npx vitest run` e `npm run build` passam sem erros.

---

## Análise herdada — planning 20261105-1638 (antes da divisão)

**Veredito daquele planning:** bloqueado por tamanho (task inteira ~1.950–2.250 linhas); dividida pelo dono em
2026-11-05. Abaixo, só a parte que é desta task. O próximo planning confere esta análise contra a base (as linhas são
da base `0d616c3` e podem ter mudado) em vez de refazê-la.
**Complexidade estimada:** média/alta — formato de dados novo no documento (`clipPath` gerado + propriedades
próprias) e patch de renderização de classe do Fabric (aro da moldura); tudo em `editor-web`.
**Reserva prevista:** `editor-web/src/clipFrames.ts` (novo), `editor-web/src/editor.ts`, `editor-web/src/main.ts`,
`editor-web/src/document.ts`, `editor-web/test/clipFrames.test.ts` (novo), `tools/e2e/task06.mjs` (novo),
`editor/src/main/assets/editor/index.html` (bundle regerado).

### Estado atual (símbolos abertos: `arquivo::simbolo` — faz X; em erro, Y)
- `editor-web/src/editor.ts::Editor.startCrop` (L1292) — só recorte retangular: troca `img.controls` por
  `createImageCroppingControls()` (cropX/cropY/width/height); `endCrop` (L1302) devolve os controles e faz `commit`.
  Nenhum `clipPath` é criado no editor (único uso: `swapImage` L1279, que só o preserva).
- `editor.ts::Editor.replaceImage` (L1256) — usado por remover fundo/objeto/texto e upscale (`main.ts` L1032–1100):
  guarda filtros e aplica `rescaledGeometry` (width×fx, scaleX/fx, crop×fx). **Não mexe em `clipPath`**: como o
  `clipPath` (não `absolutePositioned`) mora nas unidades locais do objeto, um upscale ×2 numa foto emoldurada
  deixaria a moldura com metade do tamanho na tela. A moldura tem de ser **regerada a partir de uma spec** depois de
  toda troca de fonte.
- `editor.ts::Editor.swapImage` (L1275) — é o "🔄 Substituir" da TASK-11 (`main.ts::showSwapImage` L953, botão
  `.swap-btn` em `imageProps` L973). Preserva o objeto `clipPath`, mas `fitSlot` (`imageGeometry.ts`) muda
  width/height/scale → mesma desproporção. Basta regerar a moldura no fim.
- `editor-web/src/document.ts::CUSTOM_PROPERTIES` (L76) → `FabricObject.customProperties` (`editor.ts` L54): o que
  entrar ali vai no `toObject()`, no snapshot e no undo. Lição da TASK-12: spec gravada no objeto **não pode ter
  campo `type`** com nome de classe do Fabric (o revive a transforma) — usar `kind`.
- Fabric 7.4 `shapes/Object/Object.ts::drawObject` (L823–842): `_render(ctx)` e **depois** `_drawClipPath`
  (composição destination-in) → tudo que o `_render` desenha é recortado; o aro tem de ser desenhado **depois** do
  `drawObject` original (envolver `FabricImage.prototype.drawObject`, como `curve.ts::installWarpRenderer` L352
  envolve o `_render` do Textbox) e caber no cache do objeto (`_getCacheCanvasDimensions`, L440): o mais simples é
  aro **interno** (traço de largura 2w recortado pela própria forma). Patch de classe, não de instância: o
  `renderThumbnail` (StaticCanvas, `editor.ts`) e o export de vídeo também desenham.
- Export: `FabricObjectSVGExportMixin.ts::_createBaseSVGMarkup` (L195–257) já emite `<clipPath>` → o SVG da foto
  recortada vem de graça; **o aro não** (precisa de `toSVG` estendido, ex.: `<path>` com stroke ao lado).
  `editor.ts::exportVideoBundle` rasteriza cada camada na `getBoundingRect()` + margem de 2 px → a moldura sai no MP4
  se o canvas a desenhar; um aro fora da caixa seria cortado (outro motivo para aro interno). PNG/JPG = `renderPage`
  → `toDataURL`, idem.
- `main.ts::imageProps` (L970) — botões da imagem selecionada; é onde entra o `🖼️ Moldura`.

### Provas (comando literal -> resultado)
- `grep -n "clipPath\|Pattern" editor-web/src/editor.ts editor-web/src/main.ts` → só `editor.ts:429` (comentário de
  degradê) e `editor.ts:1279` (`swapImage` preserva `clipPath`): não há moldura hoje.
- `wc -l editor-web/src/*.ts` → `editor.ts` 1719, `main.ts` 1893; maiores módulos de task até aqui: `curve.ts` 374,
  `snapping.ts` 370. `wc -l tools/e2e/*.mjs` → `task12.mjs` 227, `task14.mjs` 326.
- Estimativa (calibrada na TASK-12, 5 SP, ~1.000 linhas): `clipFrames.ts` 300–350 (15 formas, aro, `toSVG` do aro) +
  `editor.ts` ~120 + `main.ts` ~120 + teste ~120 + E2E ~180 ≈ **~850**.

### Hipóteses descartadas (e por quê)
- *"Trocar foto" é trabalho novo* — não: existe desde a TASK-11 (`swapImage` + `.swap-btn`); falta só regerar a
  moldura depois da troca (e do `replaceImage` das ações de IA).
- *Guardar o `clipPath` como objeto e confiar no Fabric* — quebra no upscale e na troca (as unidades locais mudam com
  `rescaledGeometry`/`fitSlot`). Fonte da verdade = spec (`clipShape` + parâmetros); `clipPath` regerado da caixa atual.
- *Desenhar o aro dentro do `_render`* — o `_drawClipPath` recorta depois (Object.ts L838–839): metade do traço some.

### Tarefas
- [ ] `editor-web/src/clipFrames.ts` (novo) — `ClipShapeKind` (none, circle, rounded-sm/lg, pill, leaf-tr/tl,
  starburst-12/20, hexagon, diamond, shield, arch, heart), `clipPathFor(kind, w, h): FabricObject` centrado na caixa
  local, `installFrameRenderer(FabricImage)` (aro interno depois do `drawObject`) e SVG do aro para o `toSVG` —
  vitest `test/clipFrames.test.ts`: cada forma dentro da caixa (bbox ≤ w×h), pílula/círculo tocam os extremos.
- [ ] `editor-web/src/document.ts::CUSTOM_PROPERTIES` — `clipShape`, `clipScale`, `clipOffsetX`, `clipOffsetY`,
  `frameStroke`, `frameStrokeWidth` — vitest: round-trip `toObject`/`loadFromJSON` preserva tudo.
- [ ] `editor.ts` — `setImageFrame(spec)`, `refreshFrame(img)` chamado no fim de `swapImage`, `replaceImage`,
  `endCrop` e no `load`/`restore`; zoom/pan interno pelo crop (caixa na página constante) — vitest: a moldura
  sobrevive a `swapImage` e a `replaceImage` com fator 2 mantendo a mesma caixa na página (bbox do `clipPath` × escala
  = caixa da imagem).
- [ ] `main.ts::imageProps` — botão `🖼️ Moldura` (`.frame-btn`) com sheet: grade das formas, cor/espessura do aro
  (0–40), zoom 1–3×, posição X/Y.
- [ ] `tools/e2e/task06.mjs` — a T2 abaixo.

### Plano de teste
- **Offline (sem slot):** `npx tsc --noEmit` e `npx vitest run` em `editor-web/` (testes acima); SVG da página com
  moldura contém `<clipPath>` e o `<path>` do aro.
- **T2 reprodução como o usuário (E2E, no slot):** "Novo design → Post Facebook"; foto na página (setup por `evaluate`
  `editor.addImage(dataURL)` como `task11.mjs` L14, só como preparo); tocar na foto → `#props .frame-btn` → forma
  "Selo explosão" e depois "Círculo", aro com cor e espessura 12, zoom 2× → sinal: `img.clipShape` e `img.clipPath`
  presentes; no `editor.renderPageCanvas()`, pixel no canto da caixa (fora da forma) = cor do fundo e pixel na borda da
  forma = cor do aro; `.swap-btn` → galeria (`/sdcard/Pictures/e2e_swap.jpg`) → moldura mantida e bbox na página igual
  (±1 px); ↶ desfaz; exportar PNG e SVG (`exportImage`) com a moldura; print do aparelho em cada passo.
- **Controle positivo:** APK da base: `#props .frame-btn` não existe (`querySelector` nulo) e `editor.setImageFrame` é
  `undefined` — a funcionalidade está ausente.
- **T3 regressão direcionada:** `task11.mjs` (substituir foto, agrupar, camadas), `task12.mjs` (trocar forma, degradê),
  `task03.mjs` (conta-gotas lê o canvas com o aro); vitest inteiro.

### Sessões seguintes (sugestão daquele planning)
- dev: effort high, ultrathink sim — geometria/transformação no Fabric e patch de renderização de classe.
- teste: effort medium, ultrathink não — leitura de pixel/objeto por CDP em roteiro já modelado pelos E2E vizinhos.

---

## Planejamento (pipeline 20261106-0749, 2026-11-06)

> **ATENÇÃO — registro errado no pipeline (erro da sessão de planning, 2026-11-06).** O `plan-done` foi chamado com o
> `reports/task-06-...-plan.json` ainda da execução 20261105-1638 (veredito `bloqueado`, task antiga não dividida):
> a escrita do JSON novo falhou e o helper registrou o antigo. Estado no `state.json`: `documentado` (bloqueado). O
> plano válido é ESTE (`corrigir`), e o JSON em `reports/` já foi regravado com ele. Para a TASK-06 entrar numa onda, o
> dono precisa recolocá-la na próxima execução (`/pipeline-tasks`); o planning dela pode reaproveitar esta seção.

**Veredito:** corrigir — a funcionalidade (moldura de recorte com aro, zoom/pan interno e moldura preservada nas trocas
de fonte) é implementável só em `editor-web`, ~900 linhas, dentro do teto de uma sessão de dev.
**Complexidade:** alta — formato de dados novo no documento (6 propriedades próprias + `clipPath` gerado) e patch de
renderização de classe do Fabric; um módulo só (`editor-web`), sem ponte Kotlin.
**Severidade:** medio — funcionalidade nova P2; sem ela o usuário ainda recorta em retângulo (contorno).
**Arquivos a alterar (reserva da onda):**
- `editor-web/src/clipFrames.ts` (novo) — formas (`ClipShapeKind`), `clipPathFor`, versão JSON pura, aro interno
  (canvas + SVG).
- `editor-web/src/document.ts` — 6 propriedades em `CUSTOM_PROPERTIES`.
- `editor-web/src/editor.ts` — `setImageFrame`, `refreshFrame`, chamado em `replaceImage`/`swapImage`/`endCrop`;
  `installFrameRenderer(FabricImage)` no topo (ao lado de `installWarpRenderer`, L69); aro no `exportSvg`.
- `editor-web/src/dataMerge.ts` — `swapPhotoJson` regera o `clipPath` JSON da imagem emoldurada (achado novo, abaixo).
- `editor-web/src/main.ts` — botão `🖼️ Moldura` (`.frame-btn`) em `imageProps` + sheet.
- `editor-web/src/styles.css` — grade das formas na sheet (se precisar de estilo novo).
- `editor-web/test/clipFrames.test.ts` (novo) — geometria, round-trip, trocas de fonte, merge.
- `tools/e2e/task06.mjs` (novo) — a T2.
- `editor/src/main/assets/editor/index.html` — bundle regerado (os `assets/index-<hash>.*` por `claim` no dev).

### Causa raiz (simbolos abertos: `arquivo::simbolo` — faz X; em erro, Y)
Conferência da "Análise herdada" contra a base `80b97d7` (as linhas mudaram; o comportamento, não):
- `editor-web/src/editor.ts::Editor.replaceImage` (agora L1942) — guarda filtros, `setSrc`, aplica `rescaledGeometry`
  (fator = razão dos tamanhos naturais), `setCoords`, `commit`. Não toca `clipPath`. Sem try: erro do `setSrc` propaga
  ao chamador (`main.ts` L1111/1138/1158/1179). Confirmado: moldura ficaria com tamanho errado no upscale.
- `editor.ts::Editor.swapImage` (L1961) — guarda `clipPath` no `keep` (L1965) e o reaplica, mas `fitSlot` muda
  width/height/scale → `clipPath` (unidades locais) desproporcional. Chamadores: `main.ts::showSwapImage` L1041
  (galeria) e L1045 (logo do brand kit). Erro do `setSrc` propaga.
- `editor.ts::Editor.startCrop`/`endCrop` (L1978/L1988) — só troca controles; o recorte muda width/height locais →
  moldura regerada no `endCrop` (mínimo exigido; idealmente também durante o arraste do recorte).
- `editor.ts::Editor.restore` (L549), `load` (L465), `showPage` (L618), `magicResize` (L714/L729) e `renderThumbnail`
  (L2395) — todos fazem `loadFromJSON`; o `clipPath` é serializado pelo Fabric e volta coerente com a geometria salva,
  então não precisam regerar, **desde que o aro seja patch de classe** (o `renderThumbnail` usa `StaticCanvas` novo).
  `reflowCanvas` (magic resize, L761–767) só multiplica `scaleX/scaleY` e move: o `clipPath` local acompanha.
- **Achado novo (TASK-10, posterior à análise herdada):** `editor-web/src/dataMerge.ts::swapPhotoJson` (L197) — chamado
  por `applyMergeRow` (L228) ← `generateMergedPages` (L273). Troca a foto da camada `mergeField: 'foto'` direto no JSON
  com `fitSlot(..., 'cover')`, mudando `width`/`height`/`cropX`/`cropY`/`scale` e mantendo o `clipPath` JSON antigo →
  mesma desproporção nos anúncios do lote. Correção: com `o.clipShape`, regerar `o.clipPath` com o JSON de
  `clipPathFor(spec, g.width, g.height)` (`clipFrames.ts` expõe uma versão pura/JSON, sem canvas). Entrada inválida:
  devolve `o` intacto (mantém).
- `editor-web/src/document.ts::CUSTOM_PROPERTIES` (L97–122) → `FabricObject.customProperties` (`editor.ts` L68).
  Lição da TASK-12/05 confirmada no comentário de L117: spec sem campo `type` (usar `kind`).
- Fabric 7.4.0 `shapes/Object/Object.ts::drawObject` (L823–842): `_render(ctx)` (L838) e depois `_drawClipPath`
  (L839) → aro no `_render` seria recortado pela metade; aro vai **depois** do `drawObject` original, interno (traço 2w
  recortado pela forma), para caber no cache e na caixa do export de vídeo.
- `editor.ts::exportSvg` (L2206) usa `this.canvas.toSVG` (L2229) → `<clipPath>` sai de graça; o aro precisa do
  `toSVG` do `FabricImage` estendido (patch de classe).
- `main.ts::imageProps` (L1049) — linha `row scroll` com Substituir/Filtros/Recortar/Usar como fundo: o `🖼️ Moldura`
  entra nela.

### Provas (comando literal -> resultado)
- `grep -n "clipPath" src/*.ts` (em `editor-web/`) → só `editor.ts:1965` (`swapImage` preserva): nenhuma moldura hoje.
- `wc -l src/*.ts` → `editor.ts` 2466, `main.ts` 2492 (cresceram desde `0d616c3`); maiores módulos de task: `qrcode.ts`
  540, `snapping.ts` 416, `curve.ts` 374.
- `grep -n "applyMergeRow\|swapPhotoJson" src/*.ts test/*.ts` → `dataMerge.ts:197/217/228/273`,
  `test/dataMerge.test.ts:4–5,162,184,186`: caminho de troca de foto que a análise herdada não tinha.
- `grep -n '"version"' node_modules/fabric/package.json` → `7.4.0`; `sed -n 820,845p .../Object.ts` → ordem
  `_render` → `_drawClipPath` confirmada.
- Estimativa: análise herdada ~850 + `dataMerge` (~15) + teste do merge (~30) ≈ **~900 linhas** (< 1.500).

### Hipoteses descartadas (e por que)
- As da "Análise herdada" continuam valendo (trocar foto não é trabalho novo; `clipPath` como fonte da verdade quebra no
  upscale/troca; aro dentro do `_render` é recortado).
- *Regerar a moldura em todo `loadFromJSON`* (`load`/`restore`, como a análise herdada listava) — desnecessário: o
  `clipPath` salvo já é coerente com a geometria salva; só regeram as operações que mudam as unidades locais (replace,
  swap, crop, merge).
- *Magic resize precisa regerar* — não: `reflowCanvas` só escala (`scaleX/Y`) e move.

### Tarefas
- [ ] `editor-web/src/clipFrames.ts` (novo) — `ClipShapeKind` (15 + `none`), spec `{kind, scale, offsetX, offsetY,
  stroke, strokeWidth}` lida das props próprias, `clipPathFor(kind, w, h)` (FabricObject centrado) e a versão JSON pura,
  `installFrameRenderer(FabricImage)` (envolve `drawObject`, aro interno) e SVG do aro — vitest
  `test/clipFrames.test.ts`: bbox de cada forma ≤ w×h e centrada; círculo/pílula tocam os extremos; SVG da imagem
  emoldurada tem `<clipPath>` e o `<path>` do aro com `stroke` = cor.
- [ ] `editor-web/src/document.ts::CUSTOM_PROPERTIES` — `clipShape`, `clipScale`, `clipOffsetX`, `clipOffsetY`,
  `frameStroke`, `frameStrokeWidth` — vitest: round-trip `toObject`/`loadFromJSON`.
- [ ] `editor-web/src/editor.ts` — `setImageFrame(img, spec)` (aplica + `commit`), `refreshFrame(img)` no fim de
  `replaceImage`, `swapImage` (em vez de reaplicar o `clipPath` velho do `keep`) e `endCrop`; zoom/pan interno pelo crop
  mantendo a caixa na página; `installFrameRenderer(FabricImage)` junto do `installWarpRenderer` — vitest: após
  `replaceImage` com fator 2 e `swapImage` (contain e cover), bbox do `clipPath` × escala = caixa da imagem (±0,5 px)
  e `clipShape`/aro preservados; undo volta à forma anterior.
- [ ] `editor-web/src/dataMerge.ts::swapPhotoJson` — regera `o.clipPath` quando `o.clipShape` existe — vitest (em
  `clipFrames.test.ts`): `applyMergeRow` numa foto emoldurada gera `clipPath` com bbox = novo width×height.
- [ ] `editor-web/src/main.ts::imageProps` — `🖼️ Moldura` (`.frame-btn`) → sheet com grade das formas (célula com
  `data-kind`), cor e espessura do aro (0–40), zoom 1–3×, posição X/Y — prova na T2.
- [ ] `tools/e2e/task06.mjs` (novo) — a T2 abaixo, no modelo de `task11.mjs`/`task12.mjs`.

### Plano de teste
- **Offline (sem slot):** em `editor-web/`: `npx tsc --noEmit`; `npx vitest run` inteiro (inclui `clipFrames.test.ts`
  e o `dataMerge.test.ts` existente sem regressão); `build` do helper (bundle + testes Kotlin).
- **T2 reproducao como o usuario (E2E, no slot):** app aberto → "Novo design" → "Post Facebook"; foto na página (preparo
  por `evaluate` `editor.addImage(dataURL)` como `task11.mjs` L14 — só o preparo); tocar na foto no canvas → `#props
  .frame-btn` → célula "Selo explosão" (`starburst-12`) e depois "Círculo"; cor do aro vermelha e espessura 12; zoom
  2×. **Sinal:** `img.clipShape === 'circle'` e `img.clipPath` presente; em `editor.renderPageCanvas()`, pixel no canto
  da caixa da imagem (fora do círculo) = cor do fundo da página e pixel ~6 px para dentro da borda do círculo = vermelho
  do aro. Depois `.swap-btn` → "Escolher da galeria…" (`/sdcard/Pictures/e2e_swap.jpg` por `adb push` + media scan, como
  na TASK-11) → `clipShape` mantido, bbox da imagem na página igual (±1 px) e bbox do `clipPath` × escala = caixa; ↶
  desfaz voltando a foto anterior com a moldura; exportar PNG (mesmo teste de pixel) e SVG (contém `<clipPath` e o
  `stroke` do aro). `screencap` do aparelho em cada passo.
- **Controle positivo:** APK da base: com a foto selecionada, `document.querySelector('#props .frame-btn')` é `null` e
  `typeof editor.setImageFrame === 'undefined'` — funcionalidade ausente.
- **T3 regressao direcionada:** `node tools/e2e/task11.mjs` (substituir foto, agrupar, camadas), `task12.mjs` (formas,
  degradê), `task10.mjs` (lote com foto: `swapPhotoJson` mudou), `task03.mjs` (conta-gotas lê o canvas); vitest inteiro
  e testes Kotlin do `build`.

### Sessoes seguintes
- dev: effort high, ultrathink sim — geometria de 15 formas, patch de renderização de classe do Fabric (canvas + SVG) e
  quatro caminhos de troca de fonte que têm de regerar a moldura.
- teste: effort medium, ultrathink nao — leitura de objeto/pixel por CDP em roteiro já modelado por `task11`/`task12`.
