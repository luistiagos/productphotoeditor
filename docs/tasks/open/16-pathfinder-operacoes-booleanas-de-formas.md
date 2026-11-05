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
