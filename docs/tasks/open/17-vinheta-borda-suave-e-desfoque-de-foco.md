# [TASK-17] Vinheta, Borda Suave e Desfoque de Foco (Bokeh Radial / Tilt-Shift)

> **Origem:** dividida da TASK-07 pelo dono em 2026-11-05 (§2.2 itens 4 e §2.3 originais; a "07b" do planning). A
> TASK-07 ficou com mesclagem + Nitidez/Temperatura/Duotone e a [TASK-18](18-retocar-recorte-pos-remocao-de-fundo.md)
> com o retoque de recorte.
> **Depende da [TASK-07](07-filtros-efeitos-avancados-blend-modes-e-retoque-borda.md)** (mesmos `imageFilters.ts`,
> `Adjustments`/`applyFilters` e folha Filtros): só começa com a TASK-07 em `retest/`. Se as duas estiverem na mesma
> execução do pipeline, o planning põe a TASK-07 em `depende_de`. Doc original:
> `git show cbf5f41:docs/tasks/open/07-filtros-efeitos-avancados-blend-modes-e-retoque-borda.md`.

## Metadados e Esforço Mensurado

| Campo | Valor |
| :--- | :--- |
| **ID** | `TASK-17` |
| **Prioridade** | **Média (P2)** |
| **Esforço Mensurado** | **Médio** — **~1,5 dia útil (10h–12h / 3 Story Points)**; ~640 linhas novas estimadas (código + teste + E2E) |
| **Escopo** | 100% Local (`editor-web` em TypeScript / filtros próprios do Fabric.js 7.4.0 com GLSL + Canvas 2D) |
| **Referência Analisada (`com.desygner.ads`)** | `js_pretty/assets/module-create-DxNmnX1s.js` (L43360–L43580: `applySpotBlur`, `vignetteStrength`, `softEdge`) — só referência de algoritmo |

### Detalhamento do Esforço por Subtarefa
1. **Vinheta e Borda Suave (filtros próprios GL + 2D):** ~3h.
2. **Desfoque de Foco radial (Spot/Bokeh) e linear (Tilt-Shift), com controle do foco:** ~6h.
3. **Registro no `classRegistry`, testes unitários, E2E e UI:** ~2h.

---

## 1. Contexto e Problema Atual

O desfoque atual da folha Filtros borra a imagem inteira uniformemente. Em fotos de produto é comum querer manter o
produto nítido e desfocar só o cenário (desfoque radial ou tilt-shift), escurecer suavemente as bordas (vinheta) ou
esfumaçar a borda da foto para fundi-la com o fundo do anúncio sem recorte (borda suave).

---

## 2. O que deve ser feito (Especificação Técnica Detalhada)

### 2.1. Vinheta (`Vignette`) e Borda Esfumaçada (`Soft Edge`)
- `Vinheta` (`-1` a `+1`): escurece (ou clareia, se negativo) suavemente as bordas da imagem segundo uma função radial
  $d^2 = \left(\frac{x - cx}{rx}\right)^2 + \left(\frac{y - cy}{ry}\right)^2$.
- `Borda Suave (Soft Edge)` (`0` a `1`): modula o canal Alpha ($\alpha$) próximo às bordas da imagem com decaimento
  suave `smoothstep`, ótimo para fundir fotos sem recorte no fundo do anúncio.

### 2.2. Desfoque de Foco (`Spot Blur` / `Tilt-Shift Bokeh`)
Mantém uma zona de foco nítida (centro `(focusX, focusY)` e raio `focusRadius` com faixa de transição `feather`) e
aplica desfoque gradual apenas fora dessa zona:
- **Modo Radial (`Spot / Bokeh`):** foco circular sobre o produto, fundo ao redor desfocado;
- **Modo Linear (`Tilt-Shift`):** faixa horizontal/diagonal em foco, topo e base desfocados.

---

## 3. Arquivos a Criar / Modificar

| Arquivo | Ação | Descrição |
| :--- | :---: | :--- |
| `editor-web/src/imageFilters.ts` (ou `focusFilters.ts` novo) | **Modificar / Criar** | 3 subclasses de `filters.BaseFilter` (Vinheta, Borda Suave, Desfoque de foco) com `getFragmentSource()` + `applyTo2d()` e `classRegistry.setClass`. |
| `editor-web/src/editor.ts` | **Modificar** | `Adjustments`/`applyFilters` com `vignette`, `softEdge`, `spotBlur`. |
| `editor-web/src/main.ts` | **Modificar** | Sliders de Vinheta e Borda Suave e controle do foco (modo, centro, raio, transição) em `showFilters()`. |
| `editor-web/test/focusFilters.test.ts` (ou no `imageFilters.test.ts`) | **Criar / Modificar** | Pixels no backend 2D e revive do rascunho. |
| `tools/e2e/task17.mjs` | **Criar** | E2E no aparelho — única prova do caminho WebGL. |
| `editor/src/main/assets/editor/index.html` | **Regerar** | Bundle do editor. |

---

## 4. Critérios de Aceite e Verificação

- [ ] A folha **Filtros** possui sliders funcionais para **Vinheta** e **Borda Suave**.
- [ ] O **Desfoque de Foco (Bokeh / Tilt-Shift)** mantém o produto nítido na zona de foco e desfoca gradualmente fora dela.
- [ ] Os efeitos aparecem no aparelho (caminho WebGL), na exportação PNG/JPG/vídeo, e um rascunho salvo com eles reabre sem erro.
- [ ] `npx vitest run` e `npm run build` passam sem erros.

---

## Análise herdada — planning 20261105-1638 da TASK-07 (antes da divisão)

**Veredito daquele planning:** bloqueado por tamanho (TASK-07 inteira); esta parte foi separada pelo dono em
2026-11-05. O próximo planning confere a análise contra a base (as linhas são da base `0d616c3`; a TASK-07 vai mudar
`imageFilters.ts`, `applyFilters` e `showFilters` antes desta) em vez de refazê-la.
**Complexidade estimada:** média/alta — filtros próprios com shader GLSL e caminho 2D, registro para o revive.
**Reserva prevista:** `editor-web/src/imageFilters.ts` (ou `focusFilters.ts` novo), `editor-web/src/editor.ts`,
`editor-web/src/main.ts`, teste vitest, `tools/e2e/task17.mjs` (novo), `editor/src/main/assets/editor/index.html`.

### Estado atual (símbolos abertos: `arquivo::simbolo` — faz X; em erro, Y)
1. `editor-web/src/editor.ts::applyFilters(img, preset, adj)` (L1230–1249) — reconstrói `img.filters` a cada mudança a
   partir de `Adjustments` (L77), chama `img.applyFilters()` e `commit()`. `main.ts::showFilters` (L995–1027) relê os
   valores de `img.filters` por `f.type`: cada filtro novo precisa de `type` estável e de leitura de volta ali.
2. **Vinheta**, **Borda Suave** e **Desfoque de foco (radial / tilt-shift)** dependem da posição do pixel: precisam de
   filtros PRÓPRIOS (subclasse de `filters.BaseFilter`) com os DOIS caminhos — `getFragmentSource()` (GLSL; usa
   `vTexCoord` do vertex shader base, `filters/shaders/baseFilter.ts`) e `applyTo2d()`.
3. **Backend de filtro do Fabric:** `filters/FilterBackend.ts::initFilterBackend` usa WebGL quando
   `config.enableGLFiltering` (padrão `true`, `config.ts` L69) e o probe aceita; o editor não troca o backend. Em
   omissão: um filtro próprio sem `getFragmentSource` roda o `identityFragmentShader` (`BaseFilter.ts` L66) — **no
   aparelho não faz nada, calado**. No vitest (`fabric/node`) o probe é `NodeGLProbe.isSupported() → false` (backend
   2D): o teste unitário passaria pelo motivo errado. Logo: shader + 2D, e a prova do shader é o E2E no aparelho.
4. **Revive de rascunho:** `shapes/Image.ts::fromObject` (L792) revive `filters` por
   `util/misc/objectEnlive.ts::enlivenObjects` → `classRegistry.getClass(type)` (L110), que LANÇA
   `No class registered for X` (`ClassRegistry.ts` L31) → a imagem e o `loadFromJSON` do rascunho falham. Todo filtro
   próprio precisa de `classRegistry.setClass(Classe)` no carregamento do módulo (antes de qualquer `loadDocument`).

### Provas (comando literal -> resultado)
- `grep -n "enableGLFiltering" node_modules/fabric/src/config.ts` -> `69: enableGLFiltering = true;`.
- `grep -rn "filterBackend\|setFilterBackend" editor-web/src` -> nada (backend padrão: WebGL no WebView).
- `sed -n 8,15p node_modules/fabric/src/filters/GLProbes/NodeGLProbe.ts` -> `isSupported() { return false; }`.
- `sed -n 31,37p node_modules/fabric/src/ClassRegistry.ts` -> `throw new FabricError("No class registered for ...")`.
- `ls editor-web/node_modules | grep -E "^(canvas|jsdom)$"` -> `canvas`, `jsdom` (vitest roda o Fabric com node-canvas).
- Estimativa: 3 filtros GL+2D, registro e UI de foco/raio/modo ~380 + teste ~150 + E2E ~110 ≈ **~640**.

### Hipóteses descartadas (e por quê)
- "Filtros próprios só com `applyTo2d`" — no WebView rodam o shader identidade (item 3): vitest verde e app sem efeito.
- "Trocar o backend global para Canvas2D" (simplificaria os filtros próprios) — descartado: todo filtro existente
  (Desfoque inclusive) passaria a varrer `ImageData` na CPU a cada movimento de slider, em fotos de até 4096 px.

### Tarefas
- [ ] Filtros `Vignette`, `SoftEdge`, `FocusBlur` (radial | linear) como subclasses de `filters.BaseFilter`, com GLSL +
  `applyTo2d` e `classRegistry.setClass` — vitest no 2D: canto mais escuro que o centro (vinheta); alfa da borda < 255
  (borda suave); centro do foco igual ao original e canto borrado (foco); rascunho salvo com o filtro →
  `loadFromJSON` revive.
- [ ] `editor.ts` — `Adjustments`/`applyFilters` com os três; `main.ts::showFilters` — sliders e controle do foco
  (modo, centro, raio, transição), lidos de volta ao reabrir.
- [ ] `tools/e2e/task17.mjs` — a T2 abaixo.

### Plano de teste
- **Offline (sem slot):** `npx tsc --noEmit` e o vitest acima (backend 2D do Fabric em node).
- **T2 reprodução como o usuário (E2E, no slot):** `launchEditor`, foto inserida como em `task11.mjs` L14, folha
  Filtros → Vinheta 0,8 → pixel do canto da foto no `editor.renderPageCanvas()` mais escuro que antes e o centro igual;
  Desfoque de foco radial no centro → variância local do canto cai e a do centro não; Borda Suave → alfa da borda < 255;
  salvar e reabrir o rascunho → filtros revividos. **Esta é a única prova do caminho WebGL.**
- **Controle positivo:** na base a folha `Filtros` não tem `Vinheta` nem `Desfoque de foco` (`uiFind` → nada).
- **T3 regressão direcionada:** `task07.mjs` (filtros nativos e mesclagem), `task11.mjs` (substituir foto mantém
  filtros), `task03.mjs` (conta-gotas) e abrir um rascunho antigo com filtros (revive).

### Sessões seguintes (sugestão daquele planning)
- dev: effort high + ultrathink (shader).
- teste: effort high — a prova do shader é só no aparelho.

---

## Planejamento (pipeline 20261106-0749, 2026-11-06)

**Veredito:** corrigir — três filtros próprios do Fabric 7.4.0 (GLSL + 2D) num arquivo novo `focusFilters.ts`, ligados a
`applyFilters`/`showFilters`, só em `editor-web` (~720 linhas com teste e E2E); **depende da TASK-07** (mesma execução,
já planejada), que muda `Adjustments`, `applyFilters` e `showFilters` antes desta.
**Complexidade:** media — um módulo (`editor-web`), vários arquivos e um fluxo novo de UI (controles do foco); sem ponte
Kotlin e sem formato novo de documento (os filtros entram pelo `toObject` padrão do Fabric).
**Severidade:** medio — funcionalidade P2 ausente; nada quebrado, há contorno (não usar o efeito).
**Arquivos a alterar (reserva da onda):**
- `editor-web/src/focusFilters.ts` (novo) — classes `Vignette`, `SoftEdge`, `FocusBlur` (GLSL + `applyTo2d`), tipo
  `FocusSpec`, `classRegistry.setClass` de cada uma no carregamento do módulo.
- `editor-web/src/editor.ts` — `import './focusFilters'` (registro antes de qualquer `loadFromJSON`), `Adjustments`
  (+ `vignette?`, `softEdge?`, `focus?`), `applyFilters`, `filterRegion(img)`, reaplicar a região em `endCrop` e
  `swapImage`.
- `editor-web/src/main.ts` — `showFilters`: sliders `Vinheta`, `Borda suave`, chips do foco e sliders do foco, leitura de
  volta, "Zerar ajustes"; `testHook.filterBackendIsWebGL`.
- `editor-web/test/focusFilters.test.ts` (novo) — pixels no backend 2D, região, revive.
- `tools/e2e/task17.mjs` (novo) — T2.
- `editor/src/main/assets/editor/index.html` — bundle regerado (e os `assets/index-<hash>.*` que o `git status` listar,
  por `claim`).

### Causa raiz (simbolos abertos: `arquivo::simbolo` — faz X; em erro, Y)
Task: a "causa" é a funcionalidade ausente. A análise herdada (base `0d616c3`) confere com a base `80b97d7`; linhas
abaixo são da `80b97d7` (antes da TASK-07, que vai deslocá-las). Correções/achados novos marcados com **(novo)**.
1. `editor-web/src/editor.ts::applyFilters(img, preset, adj)` (L1916–1935) — reconstrói `img.filters` do zero (preset +
   Brightness/Contrast/Saturation/Blur se ≠ 0), `img.applyFilters()`, grava `filterPreset`, `commit()`. `Adjustments`
   (L91) = `{brightness, contrast, saturation, blur}`; a TASK-07 acrescenta `sharpen?`, `warmth?`, `duotone?` (opcionais)
   e a ordem fixa da cadeia (…, warmth, duotone, sharpen, blur). Esta task acrescenta **depois do blur**: `FocusBlur`,
   `Vignette`, `SoftEdge` (o desfoque não deve borrar o escurecimento nem espalhar o alfa da borda).
2. `editor-web/src/main.ts::showFilters(img)` (L1074–1105) — relê os 4 sliders por `f.type` + `f.toObject()`; chips de
   preset; "Zerar ajustes" zera `adj` e reabre a folha (`showFilters(img)`); folha = `openSheet('Filtros', …)` com
   `div.chips`, `div.sliders` (rótulo de largura fixa, §31) e `div.row`. `dom.ts::slider(label,min,max,step,value,onInput)`
   (L24) dispara `onInput` no evento `input`. **Leitura de volta:** os filtros próprios têm `type` estável e serializam os
   parâmetros (abaixo), então a folha relê de `img.filters` por `type` (`'Vignette'`, `'SoftEdge'`, `'FocusBlur'`) — não
   precisa do `filterAdjust` da TASK-07 (lá ele existe porque dois `ColorMatrix` são indistinguíveis).
3. Fabric `filters/BaseFilter.ts` — `getFragmentSource()` padrão = `identityFragmentShader` (filtro sem shader no GL não
   faz nada, calado); `applyTo(options)` chama `applyToWebGL` (GL) ou `applyTo2d` (2D); `applyToWebGL` manda
   `uStepW = 1/sourceWidth`, `uStepH = 1/sourceHeight` e depois `sendUniformData`; `getUniformLocations` lê os nomes de
   `static uniformLocations`; `createProgram` troca `precision highp float` pela precisão do probe (o shader tem que
   começar com essa string exata) e **lança** `FabricError('Fragment shader compile error for <type>: …')` se não
   compilar; `toObject()` grava `type` + **as chaves de `static defaults`** (só elas: campos internos ficam de fora);
   `fromObject` = `new this(opts)`; `isNeutralState()` → `Image.applyFilters` descarta o filtro neutro.
4. Fabric `filters/Blur.ts` — modelo do desfoque em 2 passadas: `applyTo` no GL faz `options.passes++`, e duas vezes
   `_setupFrameBuffer` / `applyToWebGL` / `_swapTextures` (horizontal, depois vertical); shader `shaders/blur.ts`: 31
   amostras com peso triangular ponderadas pelo alfa, `uDelta` em coordenada de textura, laço `for (float t = …)` de
   limite constante. `applyTo2d` imita o shader sobre `imageData.data` (mutação no lugar).
5. **(novo) Orientação no GL:** `WebGLFilterBackend` (L17) `aPosition = [0,0, 0,1, 1,0, 1,1]`, vertex
   `vTexCoord = aPosition` (`shaders/baseFilter.ts`), textura enviada sem `FLIP_Y` (`createTexture`, L211–245) e
   `copyGLTo2D` (L320–341) inverte na volta → **`vTexCoord.y = 0` é o TOPO da imagem**, igual ao `y = 0` do 2D. No 2D
   usar `u = (x + 0.5)/W`, `v = (y + 0.5)/H` (centro do pixel, como no GL). Contexto GL com `premultipliedAlpha: false`
   (L78): o shader devolve alfa reto (não pré-multiplicado), como o Blur.
6. **(novo) Filtros valem sobre a imagem INTEIRA, não sobre o recorte:** `shapes/Image.ts::applyFilters` (L531–586)
   filtra o `_originalElement` inteiro (`naturalWidth × naturalHeight`); `cropX/cropY/width/height` só entram no render.
   Uma Borda suave nas bordas da imagem inteira some quando a foto está recortada (Recortar, ou `swapImage` em modo
   `cover`, `imageGeometry.ts::fitSlot` L41 põe `cropX/cropY`). **Decisão:** os três filtros recebem a região visível
   normalizada `x0, y0, x1, y1` (0..1 da imagem original) e todas as contas (centro da vinheta, distância da borda,
   centro do foco, unidade de raio) são relativas a ela. `editor.filterRegion(img)` = `{x0: cropX/W, y0: cropY/H,
   x1: (cropX+width)/W, y1: (cropY+height)/H}` com `W,H = img.getOriginalSize()`; `applyFilters` a aplica ao criar os
   filtros; `endCrop` (L1988–1995) e `swapImage` (L1960–1976, depois do `img.set(fitSlot(…))`) atualizam a região dos
   filtros próprios existentes e chamam `img.applyFilters()` antes do `commit()`. (`replaceImage`, L1941–1954, reescala a
   geometria proporcionalmente: a região normalizada não muda.) Durante o arrasto do recorte a região fica velha até o
   Concluir — aceitável.
7. **Revive:** `shapes/Image.ts::fromObject` (L792–811) revive `filters` por `enlivenObjects` →
   `ClassRegistry.ts::getClass` (L31–37) **lança** `No class registered for X` → a imagem, o `loadFromJSON` do rascunho, o
   undo/redo (`editor.ts::undo` L546 → `restore` → `loadFromJSON`), a troca de página (L555/L618/L729), o
   `clone()` (L1044) e a miniatura `renderThumbnail` (L2396–2406, `StaticCanvas.loadFromJSON`) falham. `setClass(Classe)`
   registra `Classe.type` (e o legado em minúsculas, L45–47). Basta o `focusFilters.ts` chamar `setClass` no topo e o
   `editor.ts` importá-lo (todos esses caminhos estão no `editor.ts`). Rascunho salvo com os filtros não abre num build
   anterior a esta task (sem o registro) — aceito.
8. **(novo) Dois registros de classe no vitest:** `src/*` importa `'fabric'` (`dist/index.min.mjs`) e os testes importam
   `'fabric/node'` (`dist/index.node.mjs`): são **instâncias distintas** do Fabric (prova abaixo). Um teste que registra
   pelo `src/focusFilters.ts` e revive com o `FabricImage`/`util` de `fabric/node` falha (ou, pior, um teste escrito só
   contra `fabric` passaria sem provar o caminho do app). **Decisão:** `test/focusFilters.test.ts` começa com
   `vi.mock('fabric', async () => await import('fabric/node'))`, para o `src/focusFilters.ts` estender e registrar no
   MESMO Fabric do teste, e afirma `classRegistry.has('Vignette')` (de `fabric/node`) como guarda.
9. **Exportação:** PNG/JPG/WebP (`editor.ts::exportRaster` L2180 → `renderPage` L2117 → `canvas.toDataURL`), vídeo/GIF
   (`exportVideoBundle` L2249: cada camada vira PNG por `renderPage`, L2269 em diante) e a prévia do vídeo
   (`video/VideoPreview.ts::renderFrame` L182, só mexe em posição/escala/opacidade) desenham o `_element` já filtrado:
   nenhum caminho de exportação precisa de mudança; a prova é ler o pixel da saída (T2, passo 5).
10. **Backend:** `filters/FilterBackend.ts` L17 usa WebGL se `config.enableGLFiltering` (padrão `true`, `config.ts` L69) e
    `WebGLProbe.isSupported(4096)` (`maxTextureSize ≥ 4096`); o editor não troca o backend (`grep` abaixo). `getFilterBackend`
    e `WebGLFilterBackend` são exportados no topo de `'fabric'` (`src/filters/index.ts` L1–9): o `testHook` ganha
    `filterBackendIsWebGL: () => getFilterBackend() instanceof WebGLFilterBackend` (não usar `constructor.name`: o
    bundle é minificado) — é assim que o E2E prova que rodou o shader e não o 2D.

**Especificação dos filtros** (fechada aqui para o 2D e o GL darem o mesmo resultado e o teste ter números):
- Comum: região `x0,y0,x1,y1` (defaults `0,0,1,1`); `W,H` = `1/uStepW`, `1/uStepH` no GL, `width,height` do `imageData`
  no 2D; `RW = (x1-x0)·W`, `RH = (y1-y0)·H` em px; `unit = min(RW, RH)`. Uniformes: `uRegion` (vec4) + os de cada filtro;
  os nomes de `static uniformLocations` iguais aos `uniform` do shader. Nenhuma chave chamada `type` nos defaults.
- `Vignette` (`type 'Vignette'`, defaults `{vignette: 0, x0,y0,x1,y1}`, neutro se `vignette === 0`): `c` = centro da
  região, `r = ((x1-x0)/2, (y1-y0)/2)`; `d2 = ((u-cx)/rx)² + ((v-cy)/ry)²` (a fórmula da §2.1); `k = |s|·smoothstep(0.3,
  2.0, d2)`; `s > 0`: `rgb *= 1 - k`; `s < 0`: `rgb += (1 - rgb)·k`; alfa intacto. `d2 < 0.3` → pixel idêntico.
- `SoftEdge` (`type 'SoftEdge'`, defaults `{softEdge: 0, x0,y0,x1,y1}`, neutro se 0): `e = min(u-x0, x1-u, v-y0, y1-v)`
  convertido em px (×W na horizontal, ×H na vertical) `/ (unit/2)`; `alfa *= smoothstep(0, softEdge, e)`; rgb intacto.
- `FocusBlur` (`type 'FocusBlur'`, defaults `{mode: 'radial', blur: 0, focusX: 0.5, focusY: 0.5, radius: 0.25,
  feather: 0.2, angle: 0, x0,y0,x1,y1}`, neutro se `blur === 0`): foco em `F = (x0 + focusX·(x1-x0), y0 + focusY·(y1-y0))`;
  `P = ((u-Fx)·W, (v-Fy)·H)` px; radial `dist = |P|/unit`; linear `n = (-sin a, cos a)` (`a` em graus → rad; `0` = faixa
  horizontal), `dist = |P·n|/unit`; máscara `m = smoothstep(radius, radius + feather, dist)`. Duas passadas (como o
  Blur): horizontal e vertical, 31 amostras de peso triangular ponderadas pelo alfa (o esquema do `shaders/blur.ts`,
  **sem** o deslocamento aleatório), com deslocamento máximo `m(u,v)·blur·0.12·unit` px no eixo da passada (`uDelta`
  em coordenada de textura = px·uStep). `m = 0` → as 31 amostras caem no próprio pixel → **zona de foco idêntica ao
  original**. Uniforme `uMode` (0 radial, 1 linear) num programa só (`getCacheKey` = `type`). O 2D faz as mesmas duas
  passadas sobre cópias de `imageData.data`.
- UI (`showFilters`, em `div.sliders`/`div.chips` existentes, sem CSS novo): `Vinheta` (−1…1, passo 0.05) e `Borda suave`
  (0…1, 0.05) sempre; linha de chips `Sem foco` / `Foco radial` / `Foco linear` (ativo com `primary`, troca reabre a
  folha); com foco ligado: `Intensidade` (0…1, 0.05), `Centro X` e `Centro Y` (0…1, 0.01), `Raio` (0…0.8, 0.01),
  `Transição` (0.02…0.6, 0.01) e, só no linear, `Ângulo` (−90…90, 5). Ligar o foco usa `{blur: 0.5, 0.5, 0.5, radius
  0.25, feather 0.2, angle 0}`. "Zerar ajustes" zera também vinheta, borda e desliga o foco.

### Provas (comando literal -> resultado)
- `grep -n "Adjustments\|applyFilters\|filterPreset\|renderPageCanvas" editor-web/src/editor.ts` -> `91: export interface
  Adjustments {…blur}`, `1916: applyFilters(`, `1933: img.set('filterPreset'…`, `2147: renderPageCanvas(`.
- `grep -n "function showFilters" -A40 editor-web/src/main.ts` -> L1074–1105 (leitura por `f.type`, 4 sliders, reset).
- `cat editor-web/vite.config.ts` -> `test: { include: ['test/**/*.test.ts'], environment: 'node' }`, sem alias de
  `fabric`; `grep -rln "from '../src/editor'" editor-web/test` -> nada (nenhum teste importa o `editor.ts`).
- `node %JOB%/tmp/reg.mjs file:///…/editor-web` (importa `dist/index.min.mjs` e `dist/index.node.mjs`, registra uma
  subclasse de `BaseFilter` no primeiro) -> `browser load: ok`, `same registry: false`, `browser has true node has false`,
  `node getFilterBackend type: Canvas2dFilterBackend` (item 8; e o vitest roda o caminho 2D).
- `grep -n "premultipliedAlpha\|getContext" node_modules/fabric/src/filters/WebGLFilterBackend.ts` -> `78: premultipliedAlpha: false`.
- `sed -n 315,345p …/WebGLFilterBackend.ts` -> `ctx.translate(0, targetCanvas.height); ctx.scale(1, -1)` (item 5).
- `sed -n 526,590p node_modules/fabric/src/shapes/Image.ts` -> filtra `_originalElement` com `naturalWidth/Height` (item 6).
- `grep -n "fitSlot\|cropX" editor-web/src/imageGeometry.ts` -> `41: … cropX: (nw - width) / 2, cropY: (nh - height) / 2` (cover recorta).
- `grep -n "exportVideoBundle" -A25 editor-web/src/editor.ts` -> `2269: files['bg.png'] = this.renderPage(…)` e camadas por `renderPage` (item 9).
- `grep -n "getFilterBackend\|WebGLFilterBackend" node_modules/fabric/src/filters/index.ts` -> L4 e L9 (exportados);
  `grep -n "isSupported" -A3 …/GLProbes/WebGLProbe.ts` -> `maxTextureSize >= textureSize` (item 10).
- `sed -n 20,47p node_modules/fabric/src/ClassRegistry.ts` -> `getClass` lança `No class registered for …`; `setClass`
  registra `type` e `type.toLowerCase()` (item 7).
- Estimativa: `focusFilters.ts` ~280 (3 classes, 3 shaders, 3 loops 2D) + `editor.ts` ~45 + `main.ts` ~75 + vitest ~150 +
  E2E ~170 ≈ **~720** (< 1.500, um módulo).

### Hipoteses descartadas (e por que)
- "Filtros próprios só com `applyTo2d`" — no WebView rodam o shader identidade (item 3): vitest verde, app sem efeito.
- "Trocar o backend global para Canvas2D" — todo filtro existente (Desfoque inclusive) passaria a varrer `ImageData` na
  CPU a cada movimento de slider, em fotos de até 4096 px.
- "Parâmetros relativos à imagem inteira (sem região)" — a Borda suave fica fora da área visível de foto recortada ou
  trocada em `cover`, e a vinheta/foco ficam fora do centro (item 6).
- "Ler os sliders novos de volta por uma prop custom (como o `filterAdjust` da TASK-07)" — desnecessário: `type` próprio
  estável e parâmetros nos `defaults` já vão e voltam pelo `toObject`/`fromObject`.
- "Desfoque de foco como `mix(original, Blur nativo, máscara)`" — o pipeline do Fabric encadeia um resultado por passada;
  combinar o original com a saída de outro filtro exigiria textura extra e um terceiro passe; o desfoque separável de
  raio variável pela máscara faz o mesmo em 2 passadas e deixa o centro exato.
- "Deslocamento aleatório (dither) do shader do Blur" — torna GL ≠ 2D e os números do E2E instáveis; sem ele há algum
  bandeamento no desfoque forte (aceitável; o dev pode reavaliar só se o print mostrar faixas evidentes).
- "Tocar na foto para escolher o centro do foco" — conflita com seleção/arrasto/pressão longa do canvas; sliders de
  centro bastam nesta task.
- "Registrar as classes no teste importando de `'fabric'`" — registro diferente do `fabric/node` (item 8).
- "Alias `fabric → fabric/node` no `vite.config.ts`" — mudaria todos os testes e arrastaria um arquivo a mais para a
  reserva; o `vi.mock` no arquivo de teste é local.

### Tarefas
- [ ] `editor-web/src/focusFilters.ts` (novo) — `Vignette`, `SoftEdge`, `FocusBlur` (`extends filters.BaseFilter<…>`,
  `static type`, `static defaults`, `static uniformLocations`, `getFragmentSource`, `sendUniformData`, `applyTo2d`,
  `isNeutralState`; `FocusBlur.applyTo` em 2 passadas como `Blur.applyTo`), `export type FocusSpec`, e
  `classRegistry.setClass(...)` das três — **vitest** `test/focusFilters.test.ts` (com `vi.mock('fabric', …)`, item 8),
  no `applyTo2d` sobre um `{data, width, height}` 64×48 (xadrez de 4 px `#c0c0c0/#404040`, alfa 255):
  vinheta 0.8 → média do canto 6×6 < 0,75× da original e centro 6×6 idêntico; −0.8 → canto mais claro;
  borda 0.5 → alfa do pixel (0, 24) < 40 e do centro = 255; região `x0 = 0.5` → alfa de (32, 24) < 40 e de (0, 24)
  < 40 também (fora da região); foco radial `blur 1, radius 0.15` → centro 6×6 idêntico e variância do canto < 0,4× da
  original; linear `angle 0` → linha central idêntica e variância do topo cai; `toObject()` não tem `x0` faltando nem
  `horizontal`; `util.enlivenObjects([f.toObject()])` (de `fabric/node`) volta instância da mesma classe com os mesmos
  parâmetros; para cada nome em `uniformLocations`, o shader contém `uniform … <nome>` e começa com `precision highp float`.
- [ ] `editor-web/src/editor.ts` — `import` do `focusFilters`; `Adjustments` + `vignette?: number`, `softEdge?: number`,
  `focus?: FocusSpec | null`; `applyFilters` empurra `FocusBlur`, `Vignette`, `SoftEdge` (nessa ordem, depois do blur)
  quando ≠ 0/ligado, com `filterRegion(img)`; `filterRegion(img)` e um `refreshFilterRegion(img)` (atualiza `x0..y1` dos
  filtros próprios e `img.applyFilters()`) chamado em `endCrop` e `swapImage` — prova: `npx tsc --noEmit` + T2 passo 6.
- [ ] `editor-web/src/main.ts::showFilters` — sliders, chips e sliders do foco (UI acima), leitura de volta por `f.type`,
  "Zerar ajustes"; `testHook.filterBackendIsWebGL` — prova: T2.
- [ ] `tools/e2e/task17.mjs` (novo) — a T2 abaixo (modelo `task11.mjs`; `launchEditor`, `reporter`, `screencap`, `tap`).

### Plano de teste
- **Offline (sem slot):** em `editor-web/`: `npx tsc --noEmit`; `npx vitest run test/focusFilters.test.ts`; `npx vitest run`
  inteiro sem falha nova; o `build` do helper (bundle + `testDebugUnitTest`).
- **T2 reproducao como o usuario (E2E, no slot):** `node tools/e2e/task17.mjs <pasta>` com o APK da lane, no aparelho
  escolhido pelo manual (moto g86 de preferência: a prova é do caminho WebGL). Estado: `launchEditor()` →
  `editor.newDocument('E2E 17', 1080, 1080)`; `editor.setBackgroundColor('#2e7d32')`; foto 400×300 gerada num canvas
  (xadrez de 8 px `#c0c0c0`/`#404040`) por `editor.addImage`, `scaleX/scaleY = 1`, no centro da página (como
  `task11.mjs` L10–20). Medidas: no `img.getElement()` (canvas filtrado, `getImageData`) e no `editor.renderPageCanvas()`
  (página composta). Canto = bloco 20×20 a 10 px do canto da foto; centro = bloco 20×20 no centro.
  0. `ppEditor.filterBackendIsWebGL()` === `true` (registrar o valor; `false` = o teste não provou o shader — anotar o
     aparelho e repetir no moto).
  1. Tocar na foto (`tapDoc`, como `task11.mjs` L25–28) → botão `Filtros` (tap real) → a folha tem `Vinheta`,
     `Borda suave` e os chips `Sem foco`/`Foco radial`/`Foco linear`; print.
  2. `Vinheta` = 0.8 (valor + evento `input`): `img.filters` tem `type 'Vignette'`; média do canto < 0,75× da de antes;
     centro igual (±2 por canal); o pixel correspondente no `renderPageCanvas` também mais escuro; print.
  3. `Borda suave` = 0.5: alfa do pixel (1, 150) do elemento < 40 e do centro = 255; no `renderPageCanvas`, o pixel na
     borda esquerda da foto ≈ verde do fundo (tolerância ~20); print.
  4. Chip `Foco radial` → `Intensidade` 0.8, `Raio` 0.15, `Transição` 0.1: variância do centro igual (±5 %), do canto
     < 0,4× da original (o xadrez some); print. Chip `Foco linear` → `Ângulo` 0: linha central (y = 150) igual, bloco do
     topo com variância < 0,4×; `Ângulo` 45 muda o resultado (hash ≠); print.
  5. **Exportação:** `editor.exportRaster('png', 1, 1)` e `('jpeg', 1, 0.9)` → decodificar o dataURL num `<img>`/canvas:
     canto da foto mais escuro que o centro (vinheta) na saída; `editor.exportVideoBundle('mp4')` → o PNG da camada da
     foto tem o canto mais escuro e a borda com alfa < 40 (não codifica: o bundle sai antes do FFmpeg).
  6. **Recorte:** `editor.startCrop()`, `img.set({cropX: 100, width: 300})`, `editor.endCrop()` → alfa da nova borda
     esquerda visível (x = 101 do elemento) < 40 (região reaplicada).
  7. **Persistência:** `editor.load(editor.toDocument())` (o caminho de reabrir rascunho) sem exceção → `img.filters`
     com `Vignette`, `SoftEdge`, `FocusBlur` e os mesmos parâmetros; pixels do elemento iguais aos do passo 6 (±2);
     reabrir `Filtros` mostra `0.80`, `0.50` e o chip do foco destacado; `await editor.undo()` sem exceção (undo revive).
- **Controle positivo:** com o APK da base, a folha `Filtros` não tem `Vinheta`, `Borda suave` nem os chips do foco, e
  `ppEditor.filterBackendIsWebGL` não existe — o script reporta os checks 1–7 como falha (funcionalidade ausente).
- **T3 regressao direcionada:** `task07.mjs` (da TASK-07: nativos, mesclagem, `filterAdjust` — a cadeia de
  `applyFilters` mudou de novo), `task11.mjs` (substituir foto mantém filtros; agora `swapImage` reaplica a região),
  `task03.mjs` (conta-gotas lê `renderPageCanvas`), `task10.mjs` (lote clona camadas com filtros → revive),
  `task09.mjs` (troca de página = `loadFromJSON`); vitest inteiro; T4: logcat do PID sem `Fragment shader compile
  error`, `No class registered`, `FabricError` nem erro de WebGL do `chromium`.

### Sessoes seguintes
- dev: effort high, ultrathink sim — três shaders GLSL ES 1.0 com espelho exato em 2D, desfoque em 2 passadas no
  pipeline do Fabric, região do recorte e a armadilha dos dois registros no vitest.
- teste: effort high, ultrathink nao — medidas de pixel no aparelho e a distinção GL × 2D (`filterBackendIsWebGL`)
  decidem se a prova vale; o resto segue o molde de `task11`.
