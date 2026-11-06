# [TASK-07] Modos de Mesclagem (16 Blend Modes), Nitidez, Temperatura e Duotone com Brand Kit

## Status (pipeline 20261106-0749 — aprovado no teste rodada 1, 2026-11-06)

**Feito:** seletor **Mesclagem** com os 16 modos do Canvas 2D na linha da Opacidade de qualquer camada (oculto na seleção
múltipla); folha **Filtros** com **Nitidez** (0–1), **Temperatura** (−1–1) e chips de **Duotone** (`Sem duotone`, `Duotone da
Marca` pelo brand kit, Cyberpunk, Sépia Ouro, Azul Profundo), relidos de `filterAdjust` ao reabrir; `Zerar ajustes` zera os novos.
Filtros nativos do Fabric (`ColorMatrix`, `Convolute` com `opaque: false`). **Fora deste item:** SVG não exporta o modo de
mesclagem (limitação conhecida); vinheta/borda suave/bokeh = TASK-17; retoque de recorte = TASK-18.

**Commits** (sobre `origin/main` @ `465e0c0`): `9d90fda` feat(editor) TASK-07 (código + bundle `index-DSfrd14t.js`) e este
commit de docs.

**Aparelho:** emulador `emulator-5554` (AVD `pp_api34`; nenhum celular no adb). APK do fix `0a4f0086…3de9` = `sha256sum` do
`base.apk` instalado; APK da base `fb026ff8…04d3`. Ficou instalado o APK do fix.

**Evidência** (`C:\projects\sandbox\.bugfix-pipeline-product_photo_offline\evidencia\20261106-1005-task-07-filtros-efeitos-avancados-blend-modes-e-retoque-borda\`):
- Offline: diff só em arquivos reservados; `npx tsc --noEmit` 0; `npx vitest run` 309/309 (28 arquivos); `build --bug` exit 0
  na base e no fix (`build-base.log`, `build-fix.log`; vitest 309/309, 40 XMLs `testDebugUnitTest` sem `<failure`).
- Controle positivo (`base-465e0c0.apk`, `base/e2e.txt`): `task07.mjs` 5/19 — sem `Mesclagem` (painel `null`), folha só com
  Brilho/Contraste/Saturação/Desfoque, sem chips de Duotone, pixel da forma inalterado.
- **T2** (`fix-9d90fda.apk`, `fix/e2e.txt`, prints `fix/07-*.png`): `task07.mjs` **19/19** — 16 modos; Multiplicar dá
  `46,74,0` (esperado `46,75,0`); Duotone da Marca leva preto → `26,35,126` (#1a237e) e branco → `255,235,59` (#ffeb3b);
  Convolute centro 3.4; `filterAdjust` gravado; reabrir o rascunho mantém modo, filtros, pixels e a folha (0.60 / 0.80 /
  chip destacado); `Zerar ajustes` limpa; sem exceção JS.
- **T3:** `task12` 40/40, `task10` 13/13 (fix). `task11`: 23/25 na 1ª rodada do fix (o toque no chip `+45°` não pegou:
  ângulo 0, e o `undo` depende dele), **25/25 nas 2 rodadas seguintes** (`t3-task11-r2`, `t3-task11-r3`) e 25/25 na base —
  intermitência de toque, fora do código tocado. `task03`: mesmas 5 falhas + aborto na base e no fix (`base-task03`,
  `t3-task03`) → não pertinente, registrado em `docs/bugs/open/e2e-task03-lupa-conta-gotas-emulador.md`.
- **T4** (`logcat-janela.txt`, `logcat-t2-pid9712.txt`): sem `AndroidRuntime`/`FATAL`/ANR do app nem erro de shader/WebGL;
  só `Seed missing signature` do WebView e o fetch remoto offline (iguais na base).
- Ambiente: um diálogo "System UI isn't responding" do emulador e o `null root node` intermitente do `uiautomator` exigiram
  repetir a abertura do editor (`base/launch-fail.png`, `fix/launch-fail.png`); não é do app.

**Falta para `done/`:** validação do dono no aparelho dele (Moto g86): mesclagem num anúncio real, duotone numa foto
recortada (alfa preservado no GL) e export PNG/JPG/MP4 com o modo aplicado.

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

---

## Planejamento (pipeline 20261106-0749, 2026-11-06)

**Veredito:** corrigir — a "07a" (mesclagem + Nitidez/Temperatura/Duotone) cabe numa sessão (~400 linhas com teste e
E2E), só em `editor-web`, com filtros nativos do Fabric 7.4.0 (GL + 2D); a análise herdada confere com a base `80b97d7`,
com três correções de detalhe (itens 3, 6 e Temperatura nas hipóteses descartadas).
**Complexidade:** media — um módulo (`editor-web`), vários arquivos e um fluxo novo de UI (seletor + folha); sem ponte
Kotlin, sem formato de dados novo (só uma propriedade custom a mais).
**Severidade:** medio — funcionalidade P2 ausente; nada quebrado, há contorno (não usar o efeito).
**Arquivos a alterar (reserva da onda):**
- `editor-web/src/imageFilters.ts` (novo) — `BLEND_MODES`, `sharpenKernel`, `warmthMatrix`, `duotoneMatrix`, `DUOTONE_PRESETS`.
- `editor-web/src/editor.ts` — `Adjustments` (+ `sharpen`, `warmth`, `duotone`) e `applyFilters`.
- `editor-web/src/main.ts` — `Mesclagem` em `renderProps`; `Nitidez`, `Temperatura`, chips de Duotone e leitura de volta em `showFilters`.
- `editor-web/src/document.ts` — `CUSTOM_PROPERTIES` + `'filterAdjust'` (ver Causa raiz, item 3).
- `editor-web/test/imageFilters.test.ts` (novo) — kernel, matrizes, pixels no backend 2D e round-trip.
- `tools/e2e/task07.mjs` (novo) — T2.
- `editor/src/main/assets/editor/index.html` — bundle regerado (e os `assets/index-<hash>.*` que o `git status` listar, por `claim`).

### Causa raiz (simbolos abertos: `arquivo::simbolo` — faz X; em erro, Y)
Task: a "causa" é a funcionalidade ausente. Linhas da base `80b97d7` (as do planning anterior eram da `0d616c3`).
1. `editor-web/src/main.ts::renderProps` (L261–316) — painel da camada; a linha comum `Opacidade` (L313) vale para
   texto, imagem, forma, conector, QR, tabela, grupo e `ActiveSelection` (`isSelection`, L267). `Mesclagem` entra nessa
   linha: `isSelection ? null : select('Mesclagem', BLEND_MODES, o.globalCompositeOperation || 'source-over', (v) => editor.set({ globalCompositeOperation: v }))`.
   Oculto em `ActiveSelection` (o `set` iria para a seleção transitória). `dom.ts::select(label, options: [string,string][], value, onChange)`
   (L59) — dispara no `change`.
2. `editor-web/src/editor.ts::set(props)` (L1353–1390) — `o.set(props)` no ativo; só mexe em filhos de grupo para
   `fill`/`stroke`; termina em `setCoords()` + `commit()` (`commit`, L576: `requestRenderAll` + snapshot do undo). Serve
   sem mudança para `globalCompositeOperation`. Em grupo (QR, tabela, agrupado) o modo vale para o grupo inteiro.
3. `editor-web/src/editor.ts::applyFilters(img, preset, adj)` (L1916–1935) — reconstrói `img.filters` do zero a cada
   chamada (preset + Brightness/Contrast/Saturation/Blur se ≠ 0), `img.applyFilters()`, grava `filterPreset`, `commit()`.
   `main.ts::showFilters` (L1074–1104) relê os 4 sliders por `f.type` em `img.filters`.
   **Correção da análise herdada:** ler Nitidez/Temperatura/Duotone de volta "pela ordem da lista" ou pela forma da
   matriz é frágil (Temperatura e Duotone são ambos `type: 'ColorMatrix'`; o chip de Duotone ativo e as cores usadas
   não se recuperam da matriz). Decisão do plano: **uma propriedade custom `filterAdjust`** =
   `{ sharpen?: number; warmth?: number; duotone?: { id: string; shadow: string; highlight: string } }`, gravada por
   `applyFilters` (ou `undefined` se tudo zero/ausente) e incluída em `CUSTOM_PROPERTIES` (`document.ts` L97–122) — o
   mesmo padrão de `filterPreset` (L109). `img.filters` continua sendo o que renderiza; `filterAdjust` é o que a folha
   relê. As cores do duotone ficam gravadas em hex (o rascunho reabre igual mesmo se o brand kit mudar).
   `swapImage` (L1960–1975) e `replaceImage` (L1941–1954) mantêm `img.filters`; `setSrc` não apaga props custom → o
   `filterAdjust` sobrevive à troca de foto sem mudança ali.
4. `editor-web/src/document.ts::CUSTOM_PROPERTIES` (L97) + `editor.ts` L68 `FabricObject.customProperties = [...CUSTOM_PROPERTIES]`
   — é por aí que `toObject` inclui as props custom no rascunho.
5. Fabric `shapes/Object/Object.ts` — `globalCompositeOperation` é declarado (L201), aplicado no ctx no render
   (`_setupCompositeOperation`, L1484) e serializado no `toObject` (L1791); default `'source-over'`
   (`defaultValues.ts` L82). Não entra em `CUSTOM_PROPERTIES` (confirmado). `editor.ts::renderPageCanvas` (L2147) usa
   `canvas.toCanvasElement` → o export raster herda o modo (fundo da página incluso); SVG não (limitação já descrita).
6. Fabric `filters/Convolute.ts` — `getCacheKey()` = `Convolute_<lado>_<opaque?1:0>`; `toObject` grava `opaque` e
   `matrix` (revive nativo pelo `classRegistry`). **Achado novo:** o shader GL `Convolute_3_1` (usado com
   `opaque: true`) tem `uStepW * (w - 1)` (float − int: erro de compilação em GLSL ES 1.0), e a semântica de `opaque` é
   invertida entre 2D e GL. **Usar `opaque: false` (o padrão)**: no GL cai no `Convolute_3_0`, que compila e preserva o
   alfa da fonte; no 2D o alfa também é convoluído (kernel soma 1 → interior igual; só a borda do recorte ganha leve
   halo — aceitável, e o 2D só roda no vitest/fallback).
7. Fabric `filters/ColorMatrix.ts` — 2D: `out = r·m0 + g·m1 + b·m2 + m4·255` (offset em 0..1); GL: mesma conta
   (`color *= uColorMatrix` + `uConstants` com `m4/m9/m14/m19`). `toObject` grava `matrix` → revive nativo. Linha de
   alfa `[0,0,0,1,0]`: o alfa (recorte transparente) fica intacto.
8. Brand kit: `main.ts` L47 `let brandKit` (atualizado por `bridge.handle('applyBrandKit')` L84 e, no E2E, por
   `ppEditor.setBrandKit` L2468, usado em `task05.mjs`/`task13.mjs`); cores em `brandKit.colors.{primary,secondary,…}`
   (`brandkit.ts` L14). `editor.ts` não conhece o brand kit → `main.ts` resolve as cores e passa
   `{id, shadow, highlight}` em `adj.duotone`.

### Provas (comando literal -> resultado)
- `grep -n "renderProps\|showFilters\|Opacidade" editor-web/src/main.ts` -> `261: function renderProps`, `313: … slider('Opacidade'`, `1074: function showFilters`.
- `grep -n "Adjustments\|applyFilters" editor-web/src/editor.ts` -> `91: export interface Adjustments { brightness; contrast; saturation; blur }`, `1916: applyFilters(`.
- `grep -rn "applyFilters\|Adjustments\|\.filters" editor-web/src --include=*.ts | grep -v "^src/editor.ts"` -> só `main.ts`
  L18/L1075/L1077/L1084: nenhum outro consumidor de `img.filters` (svgExport, dataMerge, magicResize não tocam).
- `grep -n "globalCompositeOperation" node_modules/fabric/src/shapes/Object/Object.ts node_modules/fabric/src/shapes/Object/defaultValues.ts`
  -> L201, L1484, L1791; default L82 `'source-over'`.
- `sed -n 1,40p node_modules/fabric/src/filters/shaders/convolute.ts` -> `Convolute_3_1` com `(w - 1)`; `Convolute_3_0`
  com `(w - 1.0)` e `gl_FragColor.a = alpha`.
- `grep -n "enableGLFiltering\|textureSize" node_modules/fabric/src/config.ts` -> `69: enableGLFiltering = true`,
  `80: textureSize = 4096` (backend WebGL no WebView, como hoje para o Blur).
- E2E de `<select>`: precedente `tools/e2e/task12.mjs` L3/L13–14 (valor + `dispatchEvent(new Event('change'))`, porque o
  seletor nativo do Android fica fora do WebView).
- Estimativa: `imageFilters.ts` ~80 + `editor.ts` ~25 + `main.ts` ~50 + `document.ts` 2 + vitest ~90 + E2E ~150 ≈ **~400**.

### Hipoteses descartadas (e por que)
- "`globalCompositeOperation` em `CUSTOM_PROPERTIES`" — já serializado pelo Fabric (item 5).
- "Ler os novos sliders de volta de `img.filters` pela ordem/forma da matriz" — dois `ColorMatrix` indistinguíveis por
  `type`, e o chip ativo do duotone não se recupera (item 3) → `filterAdjust`.
- "Subclasses próprias registradas (`type: 'Sharpen'`, `'Warmth'`, `'Duotone'`)" — dariam `type` estável, mas um
  rascunho salvo assim não abre em build sem o registro (`enlivenObjects` falha por `type` desconhecido) e exige ordem de
  import antes de todo `load`; filtros nativos + `filterAdjust` não têm esse risco. (A TASK-17 precisará de subclasses
  GLSL próprias de qualquer jeito; isso é dela.)
- "Convolute com `opaque: true` para preservar o alfa" — quebra no GL (item 6).
- "Temperatura por offset (`m4 = +0.15w`, `m14 = −0.15w`)" — tinge os pretos; usar ganho na diagonal
  (`m0 = 1 + 0.15w`, `m12 = 1 − 0.15w`): preto continua preto. (A spec diz "deslocar os canais"; ganho é a leitura que
  não estraga as sombras.)

### Tarefas
- [ ] `editor-web/src/imageFilters.ts` (novo) — `BLEND_MODES: [GlobalCompositeOperation, string][]` (16, rótulos da §2.1);
  `sharpenKernel(s)` = `[0,-s,0,-s,1+4s,-s,0,-s,0]`; `warmthMatrix(w)` (ganho R/B, 20 números); `duotoneMatrix(shadowHex,
  highlightHex)` (linha c = `[(h_c−s_c)·0.299, (h_c−s_c)·0.587, (h_c−s_c)·0.114, 0, s_c]`, cores em 0..1, linha de alfa
  identidade); `DUOTONE_PRESETS` (`brand` resolvido pelo brand kit: sombra `primary`, destaque `secondary ?? '#ffffff'`;
  `cyberpunk`, `sepiaGold`, `deepBlue` com hex fixos) — **vitest** `test/imageFilters.test.ts`: kernel soma 1 e s=0 é
  identidade; `duotoneMatrix` leva preto → sombra e branco → destaque (`new filters.ColorMatrix({matrix}).applyTo2d`
  num `ImageData` 2×1, ou pela conta); `warmthMatrix(0)` identidade, `w=1` aumenta R e baixa B num cinza; 16 modos
  distintos; round-trip: `Rect({globalCompositeOperation:'multiply'}).toObject()` → `Rect.fromObject` volta `'multiply'`;
  imagem com `filterAdjust` + Convolute + ColorMatrix → `toObject`/`FabricImage.fromObject` mantém os 3.
- [ ] `editor-web/src/editor.ts::Adjustments`/`applyFilters` — campos **opcionais** `sharpen?`, `warmth?`, `duotone?`
  (o literal de `main.ts` L1075 continua compilando); ordem fixa da cadeia: preset, brilho, contraste, saturação,
  `ColorMatrix(warmthMatrix)`, `ColorMatrix(duotoneMatrix)`, `Convolute({matrix: sharpenKernel, opaque: false})`, blur;
  grava `filterAdjust` (ou `undefined`) — prova: vitest acima + `npx tsc --noEmit`.
- [ ] `editor-web/src/document.ts::CUSTOM_PROPERTIES` — `'filterAdjust'` (comentário TASK-07) — prova: round-trip do vitest.
- [ ] `editor-web/src/main.ts::renderProps` — `select('Mesclagem', …)` ao lado de `Opacidade`, oculto em `ActiveSelection`.
- [ ] `editor-web/src/main.ts::showFilters` — lê `filterAdjust`; sliders `Nitidez` (0–1, passo 0.05) e `Temperatura`
  (−1–1, passo 0.05); linha de chips de Duotone (`Sem duotone` + `Duotone da Marca` só com `brandKit.colors.primary` +
  `Cyberpunk`, `Sépia Ouro`, `Azul Profundo`), chip ativo destacado como os presets; `Zerar ajustes` zera também
  nitidez/temperatura/duotone.
- [ ] `tools/e2e/task07.mjs` (novo) — a T2 abaixo (modelo: `task11.mjs`/`task12.mjs`).

### Plano de teste
- **Offline (sem slot):** em `editor-web/`: `npx tsc --noEmit`; `npx vitest run test/imageFilters.test.ts` (backend 2D do
  Fabric no node); `npx vitest run` inteiro sem falha nova; o `build` do helper (bundle + `testDebugUnitTest`).
- **T2 reproducao como o usuario (E2E, no slot):** `node tools/e2e/task07.mjs <pasta>` com o APK da lane.
  Estado: `launchEditor()` → `editor.newDocument('E2E 07', 1080, 1080)`; `editor.setBackgroundColor('#2e7d32')`;
  `ppEditor.setBrandKit({profile:{}, colors:{primary:'#1a237e', secondary:'#ffeb3b'}, fonts:{}})`; foto gerada num
  canvas (metade preta, metade branca, 400×300, como `task11.mjs` L12–15) por `editor.addImage`; um retângulo `#ff9800`
  (`editor.addShape('rect', …)`) sobre o fundo, fora da foto.
  1. **Mesclagem:** toque no retângulo (`tapDoc`, como `task11.mjs`) → painel → `<select>` `Mesclagem` existe com 16
     opções; valor `multiply` por `change` (precedente `task12.mjs`); sinal: `editor.active.globalCompositeOperation === 'multiply'`
     e o pixel de `editor.renderPageCanvas()` no centro do retângulo ≠ `#ff9800` (≈ produto com o verde: `(255·46, 152·125, 0·50)/255` ≈ `#2e4a00`); print.
  2. **Filtros:** toque na foto → botão `Filtros` (tap real) → a folha tem `Nitidez`, `Temperatura` e os chips de Duotone;
     tap no chip `Duotone da Marca`; sinal: `img.filters` tem um `ColorMatrix` e, no `renderPageCanvas`, o pixel da metade
     preta ≈ `#1a237e` e o da branca ≈ `#ffeb3b` (tolerância ~8 por canal); print.
  3. Slider `Nitidez` = 0.6 e `Temperatura` = 0.8 (valor + evento `input`): `img.filters` tem `Convolute` com
     `matrix[4] ≈ 3.4`; a página muda (pixel/hash ≠ antes); `filterAdjust` = `{sharpen:0.6, warmth:0.8, duotone:{id:'brand',…}}`.
  4. **Persistência:** `editor.toDocument()` → `editor.load(doc)` (o caminho de reabrir rascunho) → retângulo ainda
     `multiply`, pixel igual ao passo 1; reabrir `Filtros` na foto mostra `0.60`/`0.80` e `Duotone da Marca` destacado.
- **Controle positivo:** com o APK da base, o painel do retângulo não tem `select` `Mesclagem` e a folha `Filtros` só tem
  Brilho/Contraste/Saturação/Desfoque e os presets (`main.ts` L1094–1104) — o script reporta esses checks como falha
  (funcionalidade ausente).
- **T3 regressao direcionada:** `task11.mjs` (substituir foto mantém filtros — agora também `filterAdjust`; agrupar),
  `task12.mjs` (painel de forma, linha de Opacidade), `task03.mjs` (conta-gotas lê pixels da página), `task10.mjs`
  (lote clona camadas com filtros); vitest inteiro; T4: logcat do PID sem erro de shader/WebGL do `chromium`.

### Sessoes seguintes
- dev: effort medium, ultrathink sim — mudança localizada em filtros nativos, mas com decisões finas já descritas
  (`opaque: false`, `filterAdjust`, ordem da cadeia, campos opcionais em `Adjustments`) que precisam ser seguidas.
- teste: effort medium, ultrathink nao — E2E nos moldes de `task11`/`task12`; pixels com tolerância.

### Conferência do dev (pipeline 20261106-0749, 2026-11-06, antes da 1ª edição)
Símbolos reabertos na base `465e0c0` e o plano confere: `editor.ts::applyFilters` (L1916), `Adjustments` (L91),
`set` (L1353), `renderPageCanvas` (L2147), `load`/`toDocument` (L465/L507); `main.ts::renderProps` (L261, Opacidade
L313), `showFilters` (L1074), `brandKit` (L47), `FILTERS` (L1029); `dom.ts::select`/`slider`; `document.ts::CUSTOM_PROPERTIES` (L97).
Fabric conferido: `Convolute_3_0` usa `(w - 1.0)` e preserva o alfa da fonte; `ColorMatrix` padrão `colorsOnly: true`
(2D não mexe no alfa) e no GL `color *= uColorMatrix` com a coluna de alfa `m15..m18` → linha de alfa identidade
preserva o recorte; o backend GL usa `premultipliedAlpha: false` (offset do duotone em pixel alfa 0 continua invisível,
igual ao `Brightness` de hoje). `TMatColorMatrix` não é exportado no topo do pacote → `imageFilters.ts` declara a sua
tupla de 20 (estruturalmente igual). Nada no plano a corrigir.

## Correcao (pipeline 20261106-0749, rodada 1)

O que mudou (`arquivo::simbolo`) e por quê — segue o Planejamento sem desvio:
- `editor-web/src/imageFilters.ts` (novo) — `BLEND_MODES` (16, rótulos da §2.1) + `isBlendMode`; `sharpenKernel(s)`
  (soma 1); `warmthMatrix(w)` (ganho R `1+0.15w` / B `1−0.15w`, preto continua preto); `hexToRgb01`;
  `duotoneMatrix(sombra, destaque)` (linha c = `(h_c−s_c)·[0.299, 0.587, 0.114]`, offset `s_c`, linha de alfa identidade;
  `null` se a cor não for hex); `DUOTONE_PRESETS` (Cyberpunk `#240046→#00f5d4`, Sépia Ouro `#3e2a14→#f4d58d`, Azul
  Profundo `#0b1d51→#9ad1ff`); `brandDuotone(colors)` (primária → secundária ou `#ffffff`); `FilterAdjust`,
  `parseFilterAdjust` (defensivo para rascunho) e `compactFilterAdjust` (zeros somem; nada → `undefined`).
- `editor-web/src/editor.ts::Adjustments` — `sharpen?`, `warmth?`, `duotone?` opcionais. `::applyFilters` — cadeia fixa
  preset → brilho → contraste → saturação → `ColorMatrix(warmthMatrix)` → `ColorMatrix(duotoneMatrix)` →
  `Convolute({ opaque: false })` → blur; grava `filterAdjust` (o duotone só entra se a matriz for válida).
- `editor-web/src/document.ts::CUSTOM_PROPERTIES` — `'filterAdjust'`.
- `editor-web/src/main.ts::renderProps` — `select('Mesclagem', BLEND_MODES, …)` na linha da Opacidade, oculto em
  `ActiveSelection`; valor fora da lista (ex.: `destination-out` vindo de outro lugar) mostra Normal.
- `editor-web/src/main.ts::showFilters` — relê `filterAdjust`; sliders `Nitidez` (0–1, 0.05) e `Temperatura` (−1–1, 0.05);
  linha `Duotone:` com chips `.duotone-chip` (`Sem duotone`, `Duotone da Marca` só com primária no kit, 3 presets), chip
  ativo com `.primary`; `Zerar ajustes` zera também nitidez, temperatura e duotone.
- `editor-web/test/imageFilters.test.ts` (novo, 12 testes) — kernel e matrizes pelo `applyTo2d` real do Fabric (preto →
  sombra, branco → destaque, alfa intacto; borda mais forte com a nitidez; temperatura), 16 modos, round-trip de
  `globalCompositeOperation` (`Rect.toObject/fromObject`) e de imagem com `filterAdjust` + 2 `ColorMatrix` + `Convolute`.
- `tools/e2e/task07.mjs` (novo) — a T2 do Plano de teste (passos 1–4) + passo 5: `Zerar ajustes` remove os novos filtros e
  o `filterAdjust`. Chips do duotone achados por `button.duotone-chip`.

Provas offline (em `editor-web/`): `npx tsc --noEmit` → 0; `npx vitest run test/imageFilters.test.ts` → 12/12;
`npx vitest run` → 28 arquivos, 309 testes, 0 falhas; `node --check tools/e2e/task07.mjs` → ok.

Ajustes ao Plano de teste: nenhum além do passo 5 acima. O E2E não depende de `uiFind`: no APK da base os checks de
`Mesclagem`, sliders e chips falham (controle positivo) sem abortar o script.

Build do helper (`build --bug task-07-…`): exit 0 (`npm run build` + vitest + `:app:assembleDebug testDebugUnitTest`,
BUILD SUCCESSFUL em 5m03s). Bundle regerado: `index.html` + `assets/index-DSfrd14t.js` (novo; `index-CK5tbOIb.js`
removido, ambos por `claim`); `index--MpGjl2x.css` só mudou em fim de linha e foi devolvido ao commitado.
