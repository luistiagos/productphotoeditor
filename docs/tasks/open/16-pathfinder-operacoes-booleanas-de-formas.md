# [TASK-16] Pathfinder: Operações Booleanas de Formas (Unir, Subtrair, Interseção, Vazado)

> **Origem:** dividida da TASK-06 pelo dono em 2026-11-05 (§2.3 original "Operações Booleanas de Formas"). A TASK-06
> ficou com as molduras de recorte e a [TASK-15](15-preencher-texto-com-foto.md) com a foto dentro do texto.
> **Independente** das duas: não usa nada delas. Doc original:
> `git show cbf5f41:docs/tasks/open/06-molduras-clip-frames-e-operacoes-booleanas.md`.

## Metadados e Esforço Mensurado

| Campo | Valor |
| :--- | :--- |
| **ID** | `TASK-16` |
| **Prioridade** | **Média (P2)** |
| **Esforço Mensurado** | **Médio** — **~1,5 a 2 dias úteis (10h–14h / 3 a 5 Story Points)**; ~950–1.150 linhas novas estimadas (código + teste + E2E) |
| **Escopo** | 100% Local (`editor-web` em TypeScript / Fabric.js 7.4.0), TypeScript puro sem dependência externa |
| **Referência Analisada (`com.desygner.ads`)** | `js_pretty/assets/module-create-DxNmnX1s.js` (L40344–L40430: Sweep-line Boolean Path Operations) — só referência de algoritmo; implementação 100% própria |

### Detalhamento do Esforço por Subtarefa
1. **Motor de Operações Booleanas de Formas (`pathBoolean.ts`: `union`, `subtract`, `intersect`, `exclude`):** ~8h.
2. **Integração na UI (`renderProps` com seleção múltipla), 1 undo, testes unitários e E2E:** ~3h–4h.

---

## 1. Contexto e Problema Atual

As formas do editor (`addShape()` / `makeShape`) são fixas: não é possível selecionar duas formas (ex.: um retângulo
e dois círculos nas laterais) e aplicar **Subtrair** para criar um cupom/ingresso, nem **Unir** para criar uma faixa
promocional composta ou uma etiqueta de preço.

---

## 2. O que deve ser feito (Especificação Técnica Detalhada)

### 2.1. Operações Booleanas de Formas (`pathBoolean.ts` — Pathfinder)
1. **Conversão de Primitivas para Polígonos no Espaço do Canvas:**
   - Criar função `shapeToPolygonRings(obj: FabricObject): Point[][]` que converte qualquer forma do editor (`Rect`,
     `Circle`, `Ellipse`, `Triangle`, `Polygon`, `Path`) aplicando sua matriz de transformação `obj.calcTransformMatrix()`
     em anéis de vértices 2D (amostrando curvas de Bézier/arcos com tolerância $\le 0.5\text{ px}$).
2. **4 Operações Booleanas (`BooleanOp = 'union' | 'subtract' | 'intersect' | 'exclude'`):**
   - Recorte poligonal 2D determinístico (Greiner-Hormann / Martinez-Rueda sweep-line em TypeScript puro, sem
     dependências externas):
     - **Unir (`union`):** funde $A \cup B$ em um único `Path` SVG composto (ex.: retângulo + círculo no topo = tag de preço);
     - **Subtrair Frente (`subtract`):** recorta $A \setminus B$ (ex.: retângulo menos dois semicírculos nas pontas = cupom);
     - **Interseção (`intersect`):** mantém apenas a área comum $A \cap B$;
     - **Excluir (`exclude` / `xor`):** mantém tudo exceto a sobreposição $(A \cup B) \setminus (A \cap B)$ (furos vazados).
3. **Fluxo na UI:**
   - Quando $\ge 2$ formas fechadas preenchidas estiverem selecionadas (`ActiveSelection`), exibir na barra de
     propriedades (`renderProps`) os 4 botões do **Pathfinder**: `➕ Unir`, `➖ Subtrair`, `✖️ Interseção`, `➗ Vazado (XOR)`.
   - Ao clicar, remove os objetos originais, adiciona o novo `Path` resultante herdando o `fill`/`stroke`/`brandColor`
     do objeto base e grava um só snapshot (Desfazer com 1 toque devolve as formas originais).

---

## 3. Arquivos a Criar / Modificar

| Arquivo | Ação | Descrição |
| :--- | :---: | :--- |
| `editor-web/src/pathBoolean.ts` | **Criar** | Formas Fabric → anéis; `booleanOp(a, b, op)`; anéis → string SVG `d` com regra `evenodd`. |
| `editor-web/src/editor.ts` | **Modificar** | `applyBooleanOp(op)` sobre a seleção, 1 snapshot. |
| `editor-web/src/main.ts` | **Modificar** | Linha do Pathfinder em `renderProps` quando a seleção tem ≥ 2 formas válidas. |
| `editor-web/test/pathBoolean.test.ts` | **Criar** | `union`, `subtract`, `intersect` e `exclude` entre quadrados/círculos sobrepostos, disjuntos e contidos. |
| `tools/e2e/task16.mjs` | **Criar** | E2E no aparelho (Plano de teste abaixo). |
| `editor/src/main/assets/editor/index.html` | **Regerar** | Bundle do editor. |

---

## 4. Critérios de Aceite e Verificação

- [ ] Ao selecionar 2 formas sobrepostas e tocar em **Unir** ou **Subtrair**, o editor gera instantaneamente a forma
  vetorial combinada, e o botão **Desfazer (`↶`)** restaura as formas originais.
- [ ] **Interseção** e **Vazado** produzem a área comum e a área sem a sobreposição.
- [ ] As formas combinadas aparecem idênticas na exportação PNG, JPG, SVG e Vídeo MP4.
- [ ] `npx vitest run` e `npm run build` passam sem erros.

---

## Análise herdada — planning 20261105-1638 da TASK-06 (antes da divisão)

**Veredito daquele planning:** bloqueado por tamanho (TASK-06 inteira); esta parte (a "Parte B" daquele planning) foi
separada pelo dono em 2026-11-05. O próximo planning confere a análise contra a base (as linhas são da base `0d616c3`).
**Complexidade estimada:** média/alta — motor geométrico novo com casos degenerados; só `editor-web`.
**Reserva prevista:** `editor-web/src/pathBoolean.ts` (novo), `editor-web/src/editor.ts`, `editor-web/src/main.ts`,
`editor-web/test/pathBoolean.test.ts` (novo), `tools/e2e/task16.mjs` (novo), `editor/src/main/assets/editor/index.html`.

### Estado atual (símbolos abertos)
- `editor.ts::makeShape` (L1666) — formas do editor: `Rect` (rx/ry: rounded/pill), `Circle`, `Triangle`, `Polygon`
  (star, badge-hex), `Path` (arrow), `Line`. O Pathfinder aceita Rect/Circle/Ellipse/Triangle/Polygon/Path
  preenchidos; exclui `Line`, conector (`Group` com `connectorSpec`), traço à mão (`freehandDraw.ts::isFreehandPath`),
  texto, imagem e grupo.
- Fabric `shapes/Object/ObjectGeometry.ts::calcTransformMatrix` (L487) — sem `skipGroup` já multiplica a matriz do
  grupo (`ActiveSelection`) → coordenadas de página dos objetos selecionados. Pontos de `Polygon`/`Path` são relativos
  a `pathOffset`: subtrair antes de aplicar a matriz.
- `main.ts::renderProps` (L203) — `ActiveSelection` cai no `else` de formas (cor/contorno) e ganha `🔗 Agrupar`; é
  ali que entra a linha do Pathfinder (≥ 2 formas fechadas preenchidas).

### Provas (comando literal -> resultado)
- `wc -l editor-web/src/*.ts` → maiores módulos de task até aqui: `curve.ts` 374, `snapping.ts` 370; o motor booleano
  sozinho seria o maior módulo de task do editor.
- Estimativa: `pathBoolean.ts` 500–700 (achatamento de Rect com rx/Circle/Polygon/Path com Bézier e arcos ≤ 0,5 px +
  recorte poligonal com casos degenerados + anéis→`d`) + `editor.ts` ~60 + `main.ts` ~40 + teste ~200 + E2E ~150 ≈
  **950–1.150** (abaixo do teto de ~1.500 de uma sessão).

### Hipóteses descartadas (e por quê)
- *Dependência npm de recorte poligonal para encurtar* — o doc pede TypeScript puro sem dependência; só o dono muda
  isso (com uma lib MIT, a task cairia para ~500 linhas).

### Tarefas
- [ ] `editor-web/src/pathBoolean.ts` (novo) — `shapeToPolygonRings(obj)` (matriz de página, `pathOffset`, curvas ≤
  0,5 px), `booleanOp(a, b, op)` (`union|subtract|intersect|exclude`), `ringsToPathD` (evenodd) — vitest
  `test/pathBoolean.test.ts`: quadrados sobrepostos/disjuntos/contidos/com aresta comum, quadrado × círculo; área de
  cada resultado contra a fórmula (±0,5%) nas 4 operações.
- [ ] `editor.ts::applyBooleanOp(op)` — sobre `ActiveSelection` de ≥ 2 formas válidas, ordem = pilha (base = a mais
  de baixo; subtrair = base − demais), remove as originais, adiciona `Path` com fill/stroke/`brandColor` da base, um
  só snapshot (1 undo) — vitest: o undo devolve as N formas.
- [ ] `main.ts::renderProps` — linha do Pathfinder (`.bool-union|subtract|intersect|exclude`) só quando a seleção tem
  ≥ 2 formas válidas.
- [ ] `tools/e2e/task16.mjs` — a T2 abaixo.

### Plano de teste
- **Offline (sem slot):** `npx tsc --noEmit` e `npx vitest run` em `editor-web/`; áreas do booleano contra fórmula.
- **T2 reprodução como o usuário (E2E, no slot):** retângulo + círculo sobrepostos pelo botão de formas, seleção
  múltipla pelo painel Camadas ("Selecionar Vários", como `task11.mjs` L34–40) → `.bool-subtract` → sinal: 1 objeto
  `path` no lugar dos 2, pixel na área do círculo = fundo; ↶ → 2 objetos de volta; `.bool-union` → 1 `path` com bbox =
  união das caixas; exportar PNG e SVG; print do aparelho em cada passo.
- **Controle positivo:** APK da base: `.bool-*` não existem (`querySelector` nulo) e `editor.applyBooleanOp` é `undefined`.
- **T3 regressão direcionada:** `task11.mjs` (seleção múltipla, agrupar), `task12.mjs` (trocar forma, cantos); vitest inteiro.

### Sessões seguintes (sugestão daquele planning)
- dev: effort high, ultrathink sim — recorte poligonal com casos degenerados.
- teste: effort medium, ultrathink não.

## Planejamento (pipeline 20261106-0749, 2026-11-06)

**Veredito:** corrigir — a análise herdada confere com a base `80b97d7`; motor booleano novo em TypeScript puro +
ação na seleção múltipla, só `editor-web` (≈ 950–1.150 linhas, abaixo do teto de uma sessão).
**Complexidade:** media — um módulo (`editor-web`), vários arquivos e um fluxo novo de UI; sem Kotlin, sem ponte, sem
formato de dados novo (`fillRule` já é propriedade nativa e serializada do Fabric).
**Severidade:** medio — funcionalidade P2 ausente; há contorno (forma pronta feita fora do app e importada em SVG).
**Arquivos a alterar (reserva da onda):**
- `editor-web/src/pathBoolean.ts` — NOVO: forma Fabric → anéis em coordenadas de página; `booleanOp`; anéis → `d`
- `editor-web/src/editor.ts` — `booleanCandidates()` e `applyBooleanOp(op)` sobre a seleção
- `editor-web/src/main.ts` — linha do Pathfinder em `renderProps` quando a seleção tem ≥ 2 formas válidas
- `editor-web/test/pathBoolean.test.ts` — NOVO: vitest do motor
- `tools/e2e/task16.mjs` — NOVO: E2E no aparelho
- `editor/src/main/assets/editor/index.html` — bundle regerado (os `assets/index-<hash>.*` entram por `claim` no dev)

### Causa raiz (símbolos abertos: `arquivo::simbolo` — faz X; em erro, Y)
Não há defeito: a funcionalidade não existe (`applyBooleanOp`/`.bool-*` ausentes em `editor-web/src`). Onde ela entra:
- `editor.ts::makeShape` (L2413) — `rect`/`rounded`/`pill` = `Rect` (rx/ry), `circle` = `Circle`, `triangle` =
  `Triangle`, `star`/`badge-hex` = `Polygon`, `arrow` = `Path` (só M/L/Z), `line` = `Line`; marca `shapeKind`.
- `editor.ts::shapeKindOf` (L1469) — recusa `Group`, `FabricText`, `FabricImage`, `Line` e a camada de fundo
  (`BACKGROUND_LAYER`). O filtro do Pathfinder segue a mesma regra + exclui `isFreehandPath` (traço à mão é `Path`
  sem preenchimento) e objeto com `fill` vazio/transparente. Aceita também `Ellipse` e `Path` sem `shapeKind`.
- `editor.ts::groupActive` (L1110) — MODELO do `applyBooleanOp`: ordena a seleção pela pilha (`all.indexOf`),
  `discardActiveObject()` (devolve coordenadas de cena — só DEPOIS disso a `calcTransformMatrix()` de cada um é de
  página), `canvas.remove` de cada um, `insertAt` do novo, `setActiveObject`, `commit()`. Sem `withoutHistory`: os
  eventos `object:added/removed` (L170–172 → `scheduleSnapshot`, debounce 250 ms) juntam tudo numa entrada de undo.
  Em erro não há tratamento (lança no meio) — por isso o `applyBooleanOp` deve calcular o resultado ANTES de remover
  qualquer objeto: exceção ou resultado vazio não pode deixar a página sem as originais.
- `editor.ts::swapShape` (L1485) — lista de propriedades a herdar da base (`opacity`, `shadow`, `stroke`,
  `strokeWidth`, `strokeDashArray`, `strokeLineCap`, `strokeDashStyle`, `brandColor`, `brandStroke`, `animation`,
  `visible`; NÃO `angle`/`flip`: o resultado já está em coordenadas de página) e o degradê: `gradientOf(base)` →
  `buildFabricGradient(spec, gradientBox(n).width, …height)` + `customGradient`; sem degradê, `fill: base.fill`.
  Reusar o mesmo trecho (extrair helper se convier).
- `editor.ts::undo/restore` (L545–575) — o undo recarrega o instantâneo inteiro (`loadFromJSON`): devolve as N formas.
- `editor.ts::exportRaster` / `exportSvg` / `exportVideoBundle` (L2180–2290) — renderizam o canvas, o `toSVG` do
  Fabric e, no vídeo, cada objeto rasterizado sozinho: um `Path` comum sai em todos sem código novo.
- Fabric 7.4.0 `shapes/Object/Object.ts` L1141 — `fillRule === 'evenodd'` → `ctx.fill('evenodd')`;
  `FabricObjectSVGExportMixin.ts` L31/L77 — exporta `fill-rule`. Com `fillRule: 'evenodd'` o furo de `subtract`/
  `exclude` aparece no canvas, PNG/JPG, SVG e vídeo.
- Fabric `shapes/Path.ts` L95 — `this.path = makePathSimpler(...)`: comandos absolutos e só `M/L/C/Q/Z` (arcos já
  viram curvas) — o achatamento só precisa de L, C (cúbica) e Q (quadrática).
- Fabric `Circle` — tem `startAngle`/`endAngle` (padrão 0–360): tratar como círculo completo nesse caso.
- Coordenadas locais: `Rect`/`Circle`/`Ellipse`/`Triangle` centrados em (0,0) do objeto (width/height sem
  `strokeWidth`); `Polygon`/`Path` têm pontos relativos a `pathOffset` → `p − pathOffset`, depois
  `util.transformPoint(p, obj.calcTransformMatrix())`.
- `main.ts::renderProps` (L261) — `ActiveSelection` é `Group`: cai no `else` (cor/contorno) e ganha `🔗 Agrupar`
  (L272). A linha nova entra só com `isSelection && editor.booleanCandidates().length >= 2`; cada botão chama
  `editor.applyBooleanOp(op)` e `renderProps(editor.active)`.
- `main.ts::showLayers` (L2029) — "☑ Selecionar Vários" → `Aplicar (N)` → `editor.selectMultiple` (`editor.ts`
  L1337): o caminho de seleção múltipla do usuário. Desfazer: botão `↶` da barra (`main.ts` L180 → `editor.undo()`).

### Provas (comando literal -> resultado)
- `git rev-parse HEAD origin/main` → `80b97d7f…` nos dois: a worktree está na base.
- `grep -n "makeShape\|snapshot\|isFreehandPath\|connectorSpec" editor-web/src/editor.ts` → `makeShape` L2413,
  `snapshot` L525, `object:added/removed` L171–172 (as linhas da análise herdada estavam velhas; o conteúdo confere).
- `grep '"version"' editor-web/node_modules/fabric/package.json` → `7.4.0`; `grep -rn fillRule …/Object/Object.ts` → L1141.
- `wc -l editor-web/src/*.ts` → maiores: `main.ts` 2492, `editor.ts` 2466, `qrcode.ts` 540; `pathBoolean.ts`
  (~500–700) fica no porte do `qrcode.ts`.
- `ls editor-web/test` + `test/groupAndSwap.test.ts` → testes puros com `fabric/node`: `shapeToPolygonRings` é
  testável com `Rect`/`Circle`/`Polygon`/`Path` de `fabric/node`; a classe `Editor` não tem teste unitário — o 1-undo
  se prova no E2E.

### Hipóteses descartadas (e por quê)
- *Dependência npm de recorte (polygon-clipping, MIT)* — o doc pede TS puro; só o dono muda isso.
- *`clipPath`/`globalCompositeOperation` em vez de geometria* — não gera forma vetorial única nem SVG portátil
  (critério 3), e `union`/`exclude` não saem de máscara simples.
- *Mudar `CUSTOM_PROPERTIES` (`document.ts`)* — desnecessário: o resultado é `Path` comum com `fillRule` nativo;
  `brandColor` etc. já são serializados (o `swapShape` depende disso).
- *Booleano considerando o contorno (stroke)* — fora do escopo: a geometria é a do preenchimento; o contorno da base
  é só herdado pelo `Path` resultante.

### Tarefas
- [ ] `editor-web/src/pathBoolean.ts` (novo) — `shapeToPolygonRings(obj)` (matriz de página, `pathOffset`, Rect com
  rx/ry, Circle/Ellipse, Triangle, Polygon, Path L/C/Q com erro ≤ 0,5 px); `booleanOp(a, b, op)`
  (`union|subtract|intersect|exclude`, recorte poligonal próprio — Martinez-Rueda/sweep ou Greiner-Hormann com
  tratamento de vértice/aresta coincidente); `ringsToPathD(rings)` (para `fillRule:'evenodd'`); `ringsArea`. N formas
  = dobra pela pilha (`subtract` = base − união das demais) — vitest `test/pathBoolean.test.ts`: quadrados
  sobrepostos, disjuntos, contidos, com aresta comum e vértice comum; quadrado × círculo; as 4 ops com área contra a
  fórmula (±0,5%); `exclude` de contidos = anel com furo; `intersect` de disjuntos = `[]`; Rect girado/escalado e
  Polygon com `pathOffset` → vértices de página corretos.
- [ ] `editor.ts::booleanCandidates()` + `applyBooleanOp(op)` — filtro (regra do `shapeKindOf` + fill não vazio + não
  freehand); calcula ANTES de mexer no canvas; resultado vazio → `undefined` sem alterar nada (a UI dá toast "As formas
  não se sobrepõem"); senão remove as originais, `insertAt` no índice da base, `Path` com `fillRule:'evenodd'`,
  propriedades da base (lista do `swapShape`) e degradê refeito, `layerName` 'Forma combinada', `setActiveObject`,
  `commit()` (1 undo) — prova: E2E (o undo devolve N objetos com os mesmos `type` e caixas).
- [ ] `main.ts::renderProps` — linha `.row.scroll.pathfinder` com `➕ Unir`, `➖ Subtrair`, `✖️ Interseção`,
  `➗ Vazado` (classes `bool-union|bool-subtract|bool-intersect|bool-exclude`) só com `isSelection` e ≥ 2 candidatas
  — prova: E2E (aparece com 2 formas; não aparece com forma + texto).
- [ ] `tools/e2e/task16.mjs` — a T2 abaixo.

### Plano de teste
- **Offline (sem slot):** em `editor-web/`: `npx tsc --noEmit`; `npx vitest run test/pathBoolean.test.ts` e
  `npx vitest run` inteiro.
- **T2 reprodução como o usuário (E2E, no slot):** `tools/e2e/task16.mjs` no molde do `task11.mjs`: design novo
  1080×1080 (`editor.newDocument`); retângulo 'Cupom' (`addShape('rect', '#e53935')`, 600×300 no centro), círculo
  'Furo' (`addShape('circle')`, raio ~90, centro na borda esquerda do retângulo) e texto 'Preço'. Na UI:
  1) Camadas → "☑ Selecionar Vários" → Cupom + Preço → Aplicar (2) → SINAL: `#props .bool-subtract` AUSENTE.
  2) Selecionar Vários → Cupom + Furo → Aplicar (2) → SINAL: os 4 `.bool-*` presentes; print.
  3) toque `.bool-subtract` → SINAL: 1 `path` no lugar dos 2 (total −1), `fill` `#e53935`, `fillRule` `evenodd`;
  pixel do PNG exportado num ponto dentro do círculo e do retângulo = fundo branco, num ponto só do retângulo =
  vermelho; print. 4) `↶` → SINAL: `rect` + `circle` de volta com as caixas de antes (±1,5 px); print.
  5) mesma seleção → `.bool-union` → 1 `path` com bbox = união das caixas (±1,5 px); ↶; `.bool-intersect` → bbox
  dentro da interseção das caixas; ↶; `.bool-exclude` → pixel na sobreposição = fundo, fora dela = vermelho.
  6) com o resultado do `subtract`: `editor.exportRaster('png'|'jpeg', 1, 0.92)` → pixel no furo = fundo;
  `editor.exportSvg()` → `<path` com `fill-rule: evenodd`; `editor.exportVideoBundle('mp4')` → há a camada do `path` e
  o PNG dela tem alpha 0 no ponto do furo. Print do aparelho em cada passo.
- **Controle positivo:** APK da base com 2 formas selecionadas: `document.querySelector('#props .bool-subtract')`
  nulo e `typeof editor.applyBooleanOp === 'undefined'` (funcionalidade ausente).
- **T3 regressão direcionada:** `tools/e2e/task11.mjs` (seleção múltipla, agrupar/desagrupar, mesma barra),
  `tools/e2e/task12.mjs` (trocar forma, degradê, contorno); `npx vitest run` inteiro e testes de unidade do `build`.

### Sessões seguintes
- dev: effort high, ultrathink sim — recorte poligonal com casos degenerados (vértice/aresta coincidentes, contidos,
  furos) e geometria/transformação no Fabric (manual: geometria no Fabric = high).
- teste: effort medium, ultrathink não — E2E roteirizado; os sinais são numéricos (contagem, bbox, pixel).
