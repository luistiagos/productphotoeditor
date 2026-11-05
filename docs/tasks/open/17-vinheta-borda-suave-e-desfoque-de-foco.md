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
