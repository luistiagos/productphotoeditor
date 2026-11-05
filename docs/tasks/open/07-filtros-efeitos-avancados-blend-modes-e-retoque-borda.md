# [TASK-07] Modos de Mesclagem (16 Blend Modes), Nitidez, Temperatura e Duotone com Brand Kit

> **Divisão (decisão do dono, 2026-11-05).** O planning 20261105-1638 bloqueou a TASK-07 original (efeitos, blend,
> bokeh e retoque de recorte) por tamanho: ~1.650–1.900 linhas novas, acima do teto de ~1.500 de uma sessão de dev.
> Esta task ficou com os **modos de mesclagem e os filtros que o Fabric já tem nativos** (Nitidez, Temperatura,
> Duotone). O resto virou task própria:
> - Vinheta, Borda Suave e Desfoque de foco (radial / tilt-shift) → [TASK-17](17-vinheta-borda-suave-e-desfoque-de-foco.md)
>   (**depende desta**: mesmos `imageFilters.ts`, `applyFilters` e folha Filtros);
> - Retocar recorte depois de remover o fundo → [TASK-18](18-retocar-recorte-pos-remocao-de-fundo.md) (independente).
>
> O nome do arquivo ficou o original para não quebrar os links da matriz. O doc original inteiro, com a análise
> completa: `git show cbf5f41:docs/tasks/open/07-filtros-efeitos-avancados-blend-modes-e-retoque-borda.md`.

## Metadados e Esforço Mensurado

| Campo | Valor |
| :--- | :--- |
| **ID** | `TASK-07` |
| **Prioridade** | **Média (P2)** |
| **Esforço Mensurado** | **Baixo a Médio** — **~1 a 1,5 dia útil (8h–10h / 3 Story Points)**; ~460 linhas novas estimadas no planning (código + teste + E2E) |
| **Escopo** | 100% Local (`editor-web` em TypeScript / filtros nativos do Fabric.js 7.4.0) |
| **Referência Analisada (`com.desygner.ads`)** | `js_pretty/assets/module-create-DxNmnX1s.js` (L43300–L43600: `sharpen`, 16 blend modes) e `extracted/assets/public/docs/create.md` (L800–L870) |

### Detalhamento do Esforço por Subtarefa
1. **16 Modos de Mesclagem (`Blend Modes` / `globalCompositeOperation`) por Camada:** ~3h.
2. **Nitidez (`Convolute`), Temperatura (`ColorMatrix`) e Duotone com Brand Kit (`ColorMatrix`) + presets:** ~5h.
3. **Testes Unitários (Vitest), E2E e Integração na UI (`main.ts`):** ~1h–2h.

---

## 1. Contexto e Problema Atual

Na fotografia de produtos para e-commerce e anúncios:
1. **Falta de Nitidez (`Sharpen`) e Temperatura (`Warmth`):** fotos tiradas com celular dentro de casa costumam ficar
   levemente amareladas/frias ou sem nitidez nos rótulos. Hoje a folha **Filtros** (`main.ts::showFilters`) oferece
   apenas Brilho, Contraste, Saturação e Desfoque uniforme.
2. **Falta de Duotone e Modos de Mesclagem (`Blend Modes`):** anúncios modernos usam fundos em *Duotone* com as cores
   da marca (para que o produto colorido salte aos olhos na frente) e camadas com modo `multiply` (para sombras
   realistas), `screen` (para feixes de luz/reflexos) ou `overlay` (para texturas).

---

## 2. O que deve ser feito (Especificação Técnica Detalhada)

### 2.1. 16 Modos de Mesclagem (`Blend Modes`) para Qualquer Camada
No Fabric.js 7.4.0, todo `FabricObject` possui a propriedade `globalCompositeOperation: GlobalCompositeOperation`, que
já é usada nativamente pelo `CanvasRenderingContext2D`:

1. **Lista de Modos Disponíveis (`BLEND_MODES`):**
   - `source-over` (`Normal`), `multiply` (`Multiplicar — ideal para sombras`), `screen` (`Tela — ideal para
     luzes/brilhos`), `overlay` (`Sobrepor`), `darken` (`Escurecer`), `lighten` (`Clarear`), `color-dodge`
     (`Subexposição de Cor`), `color-burn` (`Superexposição de Cor`), `hard-light` (`Luz Forte`), `soft-light`
     (`Luz Suave`), `difference` (`Diferença`), `exclusion` (`Exclusão`), `hue` (`Matiz`), `saturation` (`Saturação`),
     `color` (`Cor`), `luminosity` (`Luminosidade`).
2. **Exposição em `renderProps()` (`main.ts`):**
   - Ao lado do slider de `Opacidade` (comum a todas as camadas selecionáveis), adicionar o seletor compacto
     **`Mesclagem`** (`select('Mesclagem', BLEND_MODES, o.globalCompositeOperation || 'source-over', ...)`).
   - `globalCompositeOperation` **não** precisa entrar em `CUSTOM_PROPERTIES`: o Fabric já o serializa (ver "Análise herdada").

### 2.2. Filtros Fotográficos Nativos (`imageFilters.ts`)
1. **Nitidez (`Sharpen` via Convolução 3×3):**
   - Slider `Nitidez` (`0` a `1`, passo `0.05`): matriz de convolução parametrizada por $s \in [0, 1]$:
     $$K(s) = \begin{bmatrix} 0 & -s & 0 \\ -s & 1 + 4s & -s \\ 0 & -s & 0 \end{bmatrix}$$
     usando `filters.Convolute` do Fabric, realçando letras de embalagens e texturas de produtos.
2. **Temperatura (`Warmth` — Frio $\leftrightarrow$ Quente):**
   - Slider `Temperatura` (`-1` a `+1`): matriz de cor (`filters.ColorMatrix`) deslocando sutilmente os canais $R$
     ($+0.15w$) e $B$ ($-0.15w$) para corrigir fotos amareladas ou dar tom aconchegante.
3. **Duotone com Brand Kit:**
   - Converte a luminância de cada pixel $Y = 0.299R + 0.587G + 0.114B \in [0, 1]$ em uma interpolação linear entre
     `shadowColor` (cor escura, ex.: `brandKit.colors.primary`) e `highlightColor` (cor clara, ex.:
     `brandKit.colors.secondary` ou `#ffffff`): $\text{RGB}_{\text{out}} = \text{lerp}(\text{shadowColor}, \text{highlightColor}, Y)$.
   - Oferecer chips de 1 toque na folha `Filtros`: **Duotone da Marca**, **Cyberpunk**, **Sépia Ouro**, **Azul Profundo**.

---

## 3. Arquivos a Criar / Modificar

| Arquivo | Ação | Descrição |
| :--- | :---: | :--- |
| `editor-web/src/imageFilters.ts` | **Criar** | `BLEND_MODES`, `sharpenKernel(s)`, `warmthMatrix(w)`, `duotoneMatrix(shadow, highlight)` e presets de duotone. |
| `editor-web/src/editor.ts` | **Modificar** | Expandir `Adjustments` e `applyFilters()` com `sharpen`, `warmth` e `duotone`. |
| `editor-web/src/main.ts` | **Modificar** | Seletor `Mesclagem` em `renderProps()`; `Nitidez`, `Temperatura` e chips de Duotone em `showFilters()`. |
| `editor-web/test/imageFilters.test.ts` | **Criar** | Kernel, matrizes e round-trip do modo de mesclagem. |
| `tools/e2e/task07.mjs` | **Criar** | E2E no aparelho (Plano de teste abaixo). |
| `editor/src/main/assets/editor/index.html` | **Regerar** | Bundle do editor. |

---

## 4. Critérios de Aceite e Verificação

- [ ] Qualquer camada (texto, forma, selo ou imagem) possui seletor de **Modo de Mesclagem** com os 16 modos do
  Canvas 2D funcionando em tempo real e na exportação PNG/JPG/vídeo (SVG: limitação conhecida, ver análise).
- [ ] A folha **Filtros** possui sliders funcionais para **Nitidez** e **Temperatura**, além de presets de **Duotone**
  integrados com as cores do Brand Kit.
- [ ] Os novos ajustes sobrevivem a salvar e reabrir o rascunho e voltam aos sliders ao reabrir a folha.
- [ ] `npx vitest run` e `npm run build` passam sem erros.

---

## Análise herdada — planning 20261105-1638 (antes da divisão)

**Veredito daquele planning:** bloqueado por tamanho (task inteira ~1.650–1.900 linhas); dividida pelo dono em
2026-11-05 conforme a proposta daquele planning (esta é a "07a"). O próximo planning confere a análise contra a base
(as linhas são da base `0d616c3`) em vez de refazê-la.
**Complexidade estimada:** média — só filtros nativos do Fabric (GL + 2D); nenhum shader próprio.
**Reserva prevista:** `editor-web/src/imageFilters.ts` (novo), `editor-web/src/editor.ts` (`Adjustments`,
`applyFilters`), `editor-web/src/main.ts` (`renderProps`, `showFilters`), `editor-web/test/imageFilters.test.ts` (novo),
`tools/e2e/task07.mjs` (novo), `editor/src/main/assets/editor/index.html` (bundle).

### Estado atual (símbolos abertos: `arquivo::simbolo` — faz X; em erro, Y)
1. `editor-web/src/main.ts::renderProps` (L203–251) — monta o painel da camada; a linha comum de `Opacidade` (L248)
   vale para todo tipo (texto, imagem, forma, grupo, **ActiveSelection**). O seletor `Mesclagem` entra nessa linha, com
   o helper `dom.ts::select(label, options: [string, string][], value, onChange)` (L59). Em ActiveSelection o
   `editor.set` grava na seleção transitória (perde-se ao desselecionar): esconder o seletor quando
   `o instanceof ActiveSelection`.
2. **`globalCompositeOperation` NÃO precisa entrar em `CUSTOM_PROPERTIES`** (`document.ts` L76): o Fabric já o serializa
   (`fabric/src/shapes/Object/Object.ts`, `toObject`, L1791) e o aplica no render (`_setupCompositeOperation`, L1484).
   Export raster (`editor.ts::renderPage` / `toCanvasElement`) e vídeo (`video/VideoPreview.ts` desenha pelo próprio
   canvas do Fabric) herdam o modo. SVG: o export já grava a imagem sem filtro (comentário de `svgExport.ts` L1–3) e o
   Fabric não emite `mix-blend-mode` — limitação existente, fora do escopo.
3. `editor-web/src/editor.ts::applyFilters(img, preset, adj)` (L1230–1249) — reconstrói `img.filters` a cada mudança a
   partir de `Adjustments {brightness, contrast, saturation, blur}` (L77), chama `img.applyFilters()` e `commit()`.
   `main.ts::showFilters` (L995–1027) relê os valores de `img.filters` por `f.type` (`'Brightness'`…): cada filtro novo
   precisa de `type` estável e de leitura de volta ali (Convolute/ColorMatrix são genéricos: distinguir por uma
   propriedade própria, ex. guardar `adjustments` no objeto, ou pela ordem fixa da lista).
   - **Nitidez** = `filters.Convolute` nativo (GL + 2D; `Convolute.ts` L67/L79/L89) com o kernel K(s) da spec (soma 1).
   - **Temperatura** e **Duotone** = `filters.ColorMatrix` nativo (GL + 2D). O Duotone é linear em RGB:
     `out_c = s_c + (h_c − s_c)·(0.299R + 0.587G + 0.114B)` → linha c da matriz =
     `[(h_c−s_c)·0.299, (h_c−s_c)·0.587, (h_c−s_c)·0.114, 0, s_c]`, cores em 0..1 (o 2D do Fabric multiplica o offset
     por 255: `ColorMatrix.ts::applyTo2d` L85–87).
4. **Backend de filtro do Fabric:** `filters/FilterBackend.ts::initFilterBackend` usa WebGL quando
   `config.enableGLFiltering` (padrão `true`, `config.ts` L69); o editor não troca o backend. No vitest (`fabric/node`)
   o probe é `NodeGLProbe.isSupported() → false` (backend 2D). Para os filtros NATIVOS desta task isso não é problema
   (os dois caminhos existem no Fabric); a prova no WebView é o E2E.

### Provas (comando literal -> resultado)
- `grep -n "globalCompositeOperation" node_modules/fabric/src/shapes/Object/Object.ts` -> L201 (declare), L1484
  (aplica no ctx), L1791 (no `toObject`).
- `grep -n "enableGLFiltering" node_modules/fabric/src/config.ts` -> `69: enableGLFiltering = true;`.
- `grep -rn "filterBackend\|setFilterBackend" editor-web/src` -> nada (backend padrão: WebGL no WebView).
- Estimativa: Mesclagem ~40 + teste ~20 + E2E ~60; Nitidez/Temperatura/Duotone ~150 + teste ~90 + E2E ~90 ≈ **~460**.

### Hipóteses descartadas (e por quê)
- "Adicionar `globalCompositeOperation` em `CUSTOM_PROPERTIES`" — desnecessário (já serializado, item 2).
- "Duotone/Temperatura como filtro próprio" — são lineares em RGB: o `ColorMatrix` nativo cobre, com GL e 2D.

### Tarefas
- [ ] `editor-web/src/imageFilters.ts` (novo) — `BLEND_MODES`, `sharpenKernel(s)`, `warmthMatrix(w)`,
  `duotoneMatrix(shadow, highlight)`, presets — vitest: a matriz do duotone leva preto → sombra e branco → destaque; o
  kernel soma 1; `toObject` com `globalCompositeOperation: 'multiply'` volta igual.
- [ ] `editor.ts` — `Adjustments` + `applyFilters` com `sharpen`, `warmth`, `duotone` (lidos de volta pela folha).
- [ ] `main.ts` — `Mesclagem` em `renderProps` (oculto em ActiveSelection); `Nitidez`, `Temperatura` e chips de
  Duotone em `showFilters`.
- [ ] `tools/e2e/task07.mjs` — a T2 abaixo.

### Plano de teste
- **Offline (sem slot):** `npx tsc --noEmit` e `npx vitest run test/imageFilters.test.ts` (backend 2D do Fabric em node).
- **T2 reprodução como o usuário (E2E, no slot):** pelo driver `tools/e2e/cdp.mjs` (`launchEditor`, foto inserida
  como em `task11.mjs` L14, `tap` nos botões do painel, `evaluate` lendo `img.filters` e pixels de
  `editor.renderPageCanvas()`), prints por `screencap`. Sinais: camada em "Multiplicar" sobre fundo colorido → pixel da
  página ≠ "Normal"; Duotone → pixel claro/escuro da foto vira as duas cores do brand kit; Nitidez > 0 → `img.filters`
  tem o Convolute e a página muda.
- **Controle positivo:** na base o painel da camada não tem `Mesclagem` e a folha `Filtros` só tem
  Brilho/Contraste/Saturação/Desfoque (`main.ts` L1019–1024): `uiFind('Mesclagem')`, `uiFind('Nitidez')` → nada.
- **T3 regressão direcionada:** `task11.mjs` (substituir foto mantém filtros; agrupar), `task12.mjs` (painel de forma e
  opacidade), `task03.mjs` (conta-gotas lê pixels da página) e abrir um rascunho antigo com filtros (revive).

### Sessões seguintes (sugestão daquele planning)
- dev: effort medium.
- teste: effort medium.
