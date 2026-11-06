# [TASK-19] Mockup: Caixa 3D Multi-Face (Rotação X/Y, Faces com Artes Próprias e Luz por Face)

> **Origem:** dividida da TASK-08 pelo dono em 2026-11-05 (Geometria 4 do §2.1 original e critério 2; a "08b" do
> planning). **Depende da [TASK-08](08-mockup-25d-3d-cilindro-esfera-cubo-sobel-iluminacao.md)**: usa o warp plano
> (`mockupEngine.ts`) e o estúdio (`mockupStudio.ts`) dela; só começa com a TASK-08 em `retest/`. Se as duas
> estiverem na mesma execução do pipeline, o planning põe a TASK-08 em `depende_de`. Doc original:
> `git show cbf5f41:docs/tasks/open/08-mockup-25d-3d-cilindro-esfera-cubo-sobel-iluminacao.md`.

## Metadados e Esforço Mensurado

| Campo | Valor |
| :--- | :--- |
| **ID** | `TASK-19` |
| **Prioridade** | **Média-Alta (P1/P2)** |
| **Esforço Mensurado** | **Baixo a Médio** — **~1 dia útil (7h–8h / 2 a 3 Story Points)**; ~450 linhas novas estimadas (código + teste + E2E) |
| **Escopo** | Local (`editor-web` em TypeScript / Canvas 2D) + template procedural (`tools/gen_mockups.py --3d`) |
| **Referência Analisada (`com.desygner.ads`)** | `js_pretty/assets/module-create-DxNmnX1s.js` (L208850–L209640) — só referência de algoritmo |

### Detalhamento do Esforço por Subtarefa
1. **Projeção da caixa (vértices, rotação, perspectiva, culling, ordem de pintura e luz por face):** ~4h.
2. **Controles no estúdio (Rotação X/Y, proporções, arte/cor por face) e fundo procedural da caixa:** ~2h.
3. **Testes Unitários (Vitest) e E2E:** ~1h–2h.

---

## 1. Contexto e Problema Atual

O mockup (mesmo depois da TASK-08) não tem **projeção de Caixa 3D multi-face**, onde o usuário gira a embalagem em
`rotX`/`rotY` e aplica artes na frente, na lateral e no topo.

---

## 2. O que deve ser feito (Especificação Técnica Detalhada)

### 2.1. Geometria 4 — Cubo / Caixa 3D Multi-Face (`shapeType: 'box3d'` — Embalagens de Produto)
- Parâmetros: `rotX` $\in [-60^\circ, 60^\circ]$ (inclinação vertical), `rotY` $\in [-80^\circ, 80^\circ]$ (giro
  horizontal), `boxRatio` `{ w, h, d }` (proporções de largura, altura e profundidade da caixa) e `fov` (distância focal).
- Define os 8 vértices 3D da caixa $[-w/2, w/2] \times [-h/2, h/2] \times [-d/2, d/2]$, aplica as matrizes de rotação
  $R_x(\text{rotX}) \cdot R_y(\text{rotY})$ e projeção em perspectiva para 2D.
- Realiza *back-face culling* (descarta faces cujo vetor normal $N_z \le 0$) e ordena as faces visíveis (`front`,
  `left`/`right`, `top`/`bottom`) de trás para frente.
- Renderiza a arte de cada face com o mesmo projetor homográfico 3×3 da TASK-08 e aplica iluminação direcional por
  face (frente $100\%$ de brilho, topo $108\%$, lateral em sombra $78\%$).
- No estúdio: sliders `Rotação X` / `Rotação Y` e escolha de arte (design atual, imagem selecionada) ou cor para frente,
  lateral e topo.

---

## 3. Arquivos a Criar / Modificar

| Arquivo | Ação | Descrição |
| :--- | :---: | :--- |
| `editor-web/src/mockup/box3d.ts` (ou em `mockupEngine.ts`) | **Criar / Modificar** | Projeção, culling, ordem e luz por face; render pelas homografias da TASK-08. |
| `editor-web/src/mockup/mockupStudio.ts` | **Modificar** | Modo Caixa 3D: rotação, proporções, arte/cor por face. |
| `editor-web/test/box3d.test.ts` | **Criar** | Faces visíveis, ordem e brilho. |
| `tools/gen_mockups.py` + `app/src/main/assets/content/mockups3d/` | **Modificar** | Fundo procedural da caixa e entrada no índice 3D. |
| `app/src/main/assets/content/SOURCES.md` | **Modificar** | Se o fundo novo entrar. |
| `tools/e2e/task19.mjs` | **Criar** | E2E no aparelho. |
| `editor/src/main/assets/editor/index.html` | **Regerar** | Bundle do editor. |

---

## 4. Critérios de Aceite e Verificação

- [ ] Usuário consegue gerar uma **Caixa 3D** interativa girando `Rotação X` e `Rotação Y` e escolhendo cores/artes
  para a frente, lateral e topo.
- [ ] Só as faces voltadas para a câmera aparecem, na ordem certa, com o brilho por face.
- [ ] O resultado pode ser inserido no design e salvo na galeria (saídas do estúdio da TASK-08).
- [ ] `npx vitest run` e `npm run build` executam com 0 erros.

---

## Análise herdada — planning 20261105-1638 da TASK-08 (antes da divisão)

**Veredito daquele planning:** bloqueado por tamanho (TASK-08 inteira); esta parte foi separada pelo dono em
2026-11-05. O próximo planning confere a análise contra a base — a TASK-08 vai ter criado `editor-web/src/mockup/` e o
estúdio antes desta — em vez de refazê-la. As decisões comuns (pasta `mockup/`, preview reduzido, saídas, índice
`mockups3d/`) estão na seção "Decisões comuns" da TASK-08.
**Complexidade estimada:** média — projeção e culling, com sinal de eixo fácil de errar.
**Reserva prevista:** `editor-web/src/mockup/mockupEngine.ts` (ou `box3d.ts` novo), `editor-web/src/mockup/mockupStudio.ts`,
`editor-web/test/box3d.test.ts` (novo), o bundle `editor/src/main/assets/editor/index.html`, `tools/gen_mockups.py` +
`content/mockups3d/` (fundo da caixa), `content/SOURCES.md` e `tools/e2e/task19.mjs` (novo).

### Tarefas
- [ ] Projeção da caixa — vitest `test/box3d.test.ts`: `rotX=rotY=0` → só `front` visível; `rotY=+30` → `front` + uma
  lateral (com o sinal conferido para o eixo y para baixo do canvas); `rotX` negativo → `top` entra; ordem de pintura
  de trás para frente; brilho por face de 100/108/78 %.
- [ ] Modo Caixa 3D no estúdio (rotação, proporções, arte/cor por face) e fundo procedural no `gen_mockups.py --3d`.
- [ ] `tools/e2e/task19.mjs` — a T2 abaixo.

### Plano de teste
- **Offline (sem slot):** `npx tsc --noEmit` e `npx vitest run test/box3d.test.ts`.
- **T2 reprodução como o usuário (E2E, no slot):** aba `📦 Mockup 3D` → "Caixa 3D" → girar Rotação X/Y e conferir as
  faces visíveis (estado exposto pelo estúdio) e os pixels do preview de cada face + print do aparelho; "Inserir no
  design" → +1 `FabricImage`.
- **Controle positivo:** no APK da base (com a TASK-08), o modo "Caixa 3D" não existe no estúdio.
- **T3 regressão direcionada:** `task08.mjs` (estúdio, cilindro, alças) e vitest inteiro.

### Sessões seguintes (sugestão daquele planning)
- dev: effort high (projeção e culling, com sinal de eixo fácil de errar).
- teste: effort medium, sem ultrathink.

---

## Planejamento (pipeline 20261106-0749, 2026-11-06)

**Veredito:** corrigir — a Caixa 3D cabe em `editor-web/` (um módulo de projeção puro + um modo novo no estúdio da
TASK-08) e um template procedural no `gen_mockups.py --3d`, sem Kotlin; prova-se pela UI no aparelho. **Só começa com a
TASK-08 em `retest/`** (`depende_de`: `task-08-mockup-25d-3d-cilindro-esfera-cubo-sobel-iluminacao`, que está nesta
execução, `planejado`, veredito corrigir).
**Complexidade:** media — um módulo (`editor-web`) com um fluxo novo de UI no estúdio; estende o índice `mockups3d/`
da TASK-08 com uma variante (`shape: 'box3d'`), não cria formato novo; zero Kotlin, zero ponte nova.
**Severidade:** medio — funcionalidade nova ausente, com contorno (template plano "Frente de caixa", `box_front`, que
só põe arte na frente).
**Arquivos a alterar (reserva da onda):**
- `editor/src/main/assets/editor/index.html` — bundle regerado pelo `build` (arrasta toda mudança de `editor-web/`)
- `editor-web/src/styles.css` — linha de controles por face (arte/cor de frente, lateral, topo) no estúdio
- `tools/gen_mockups.py` — template `box` no caminho `--3d` (criado pela TASK-08), gerado POR ÚLTIMO / rng próprio
- `app/src/main/assets/content/SOURCES.md` — só se a linha dos templates 3D da TASK-08 não cobrir a pasta inteira
- `editor-web/test/box3d.test.ts` (novo; pasta existe) e `tools/e2e/task19.mjs` (novo; pasta existe)
- **Arquivos em pasta que só a TASK-08 cria** (`editor-web/src/mockup/`, `app/src/main/assets/content/mockups3d/`): o
  `plan-done` recusa reservar caminho cuja pasta não existe na wt-planning (`pipeline.py::validate_plan`,
  `missing_dirs`). O dev faz `claim` deles ANTES da primeira edição, numa chamada:
  `python <helper> claim --bug task-19-mockup-caixa-3d-multi-face --file editor-web/src/mockup/box3d.ts
  --file editor-web/src/mockup/mockupStudio.ts --file app/src/main/assets/content/mockups3d/index.json
  --file app/src/main/assets/content/mockups3d/SOURCES.md --file app/src/main/assets/content/mockups3d/box.webp
  --file app/src/main/assets/content/mockups3d/box_thumb.webp` (e `--file editor-web/src/mockup/mockupEngine.ts` só se
  precisar exportar algo dele). **Disputa possível:** a TASK-20 (também dependente da TASK-08) toca
  `mockupStudio.ts` e o bundle; o `index.html` reservado já põe as duas em ondas distintas, e o `claim` sai 8
  (`park`) se as duas coincidirem.

### Causa raiz (símbolos abertos: `arquivo::simbolo` — faz X; em erro, Y)
Item é task: "causa" = funcionalidade ausente. A base desta task é a TASK-08, **ainda não implementada** (planejada
nesta execução): os símbolos dela abaixo vêm do plano dela (seção `## Planejamento (pipeline 20261106-0749)` do doc
da TASK-08), não de código. **O dev abre o que a TASK-08 entregou antes de escrever** (regra do dono) e corrige este
plano se divergir.
- Da base atual (`80b97d7`), abertos:
  - `editor-web/src/dom.ts` — `slider(label,min,max,step,value,onInput,onCommit?)` (l.24; `onInput` no `input`,
    `onCommit` no `change`), `select(label, [[v,rótulo]], value, onChange)` (l.59), `colorInput(label, value, onInput)`
    (l.46; `input[type=color]`, `onInput` no evento `input` → o E2E seta a cor por `value` + `dispatchEvent(new
    Event('input'))`), `button`, `toast`, `openSheet`. Bastam para os controles da caixa.
  - `tools/gen_mockups.py` — `rng = np.random.default_rng(11)` global (l.15) consumido por `noise()`; `main(out_dir)`
    (l.106) reescreve `index.json`/`SOURCES.md` inteiros; só `sys.argv[1]` (l.131). `box_front` (l.78) é o plano
    "Frente de caixa" (frente/lateral/topo pintados, arte só na frente) = o contorno atual. A TASK-08 acrescenta `--3d`
    com rng próprio. **Em erro/risco:** se o template `box` consumir o rng do `--3d` ANTES dos outros, todos os
    `mockups3d/*.webp` da TASK-08 mudam de bytes (arquivos fora da reserva): gerar `box` por último, ou com rng próprio
    / sem ruído.
  - `editor-web/vite.config.ts` — `test.environment: 'node'` (l.21): sem `ImageData`/canvas no vitest → `box3d.ts`
    puro sobre arrays (`Pixels = {data, width, height}` da TASK-08).
  - `tools/e2e/cdp.mjs` — exporta `launchEditor`, `connect` (`evaluate`, `tap`, `drag`…), `screencap`, `uiFind`,
    `uiTap`, `reporter`: basta.
  - `pipeline.py::validate_plan` (l.1872) — recusa `files` com pasta inexistente → os `claim` acima.
- Da TASK-08 (plano, a conferir no código dela): `mockupEngine.ts::homographyFromQuads(src, dst)` (quad degenerado →
  `null`), `applyH`, `sampleBilinear`, `renderMockup(base, art, tpl, opts)` com `shape: 'plane'` e cobertura de borda;
  `mockupStudio.ts::openMockupStudio(deps)` com grade de templates de `contentUrl('mockups3d/index.json')`, `select`
  "Forma", `select` "Arte" (Design atual por `editor.renderPageCanvas` / Imagem selecionada, com queda para design atual
  em canvas sujo), `canvas.mockup-preview` ≤ 512 px, 4 `.mockup-handle`, saídas "Inserir no design" (JPEG 0,92 →
  `editor.addImage`) e "Salvar na galeria" (`bridge.request('export', {format:'jpg', action:'save', …})`), estado
  exposto em `canvas.mockup-preview.dataset` ou `window.__mockupStudio`. Índice `{version:1, mockups:[{id, name, shape,
  file, thumb, width, height, quad, mesh?, arcDeg?, tiltDepth?, shadingStrength}]}`.

**Desenho (decisões deste planning):**
- `box3d.ts` puro: `boxFaces(params) → Face[]` com `params = {rotX, rotY, boxRatio:{w,h,d}, fov}` e `Face = {name:
  'front'|'back'|'left'|'right'|'top'|'bottom', quad: [Pt×4] (TL,TR,BR,BL vistos de fora), depth, light}` — só as
  visíveis, ordenadas de trás para frente (maior profundidade média primeiro); `fitFaces(faces, rect)` escala/translada
  o bbox dos 8 vértices projetados para caber no retângulo do template (a caixa nunca sai do quadro);
  `renderBox(base, faces, sources, opts) → Pixels` pinta cada face pela homografia da TASK-08 (fonte = arte com
  recorte "cover" no aspecto da face, ou cor sólida) e multiplica RGB pelo `light` da face.
- **Convenção de sinais (a que o usuário vê, fixada nos testes):** `rotY > 0` → aparece a lateral **direita**;
  `rotX < 0` → aparece o **topo** (como na análise herdada); `rotX > 0` → base (`bottom`). Eixos: x direita, y PARA
  BAIXO (canvas), z para dentro da tela.
- **Culling pela área assinada do quad PROJETADO** (> 0 = visível), não por `N_z` da normal girada: com perspectiva, o
  teste por `N_z` erra faces quase de perfil; a área assinada é o teste exato. Ordem de pintura por profundidade
  média; numa caixa convexa as faces visíveis não se sobrepõem, então a ordem só importa para a fresta (abaixo).
- Luz por face (spec): frente 1,00; topo 1,08; laterais 0,78. **Decisão deste planning** (a spec não diz): `bottom` =
  0,78 e usa a arte/cor do slot "topo"; `left`/`right` usam o slot "lateral". `back` nunca fica visível nas faixas
  `rotX ∈ [−60, 60]`, `rotY ∈ [−80, 80]` (conferido no protótipo).
- As faces da caixa **não** passam por `applySurfaceLighting` (a base é o fundo, não a superfície): o brilho é só o
  `light` da face → valores exatos, testáveis.
- **Fresta entre faces:** faces vizinhas pintadas uma a uma com cobertura de borda deixam um fio do fundo na aresta
  comum. Pintar cada face com a máscara dilatada ~0,5–1 px (ou sem antialias na aresta compartilhada).
- Template `box` no `--3d`: fundo de estúdio (parede + chão, sombra suave), entrada `{id:'box', name:'Caixa 3D',
  shape:'box3d', …, quad: <retângulo onde a caixa cabe>, rotX:-20, rotY:30, boxRatio:{w:1,h:1.3,d:0.6}, fov:35}`
  (reaproveita `quad` como área de encaixe; no modo caixa as `.mockup-handle` ficam ocultas).
- Estúdio, modo Caixa 3D: sliders "Rotação X" (−60…60), "Rotação Y" (−80…80), "Largura"/"Altura"/"Profundidade"
  (0,2…2), "Distância focal" (15…75°); por slot (Frente, Lateral, Topo): `select` Arte (Design atual / Imagem
  selecionada / Cor) + `colorInput`. Estado exposto ao E2E acrescido de `visibleFaces` (nomes na ordem de pintura) e
  `faceQuads` (quad de cada face visível em px do preview).

### Provas (comando literal -> resultado)
- `grep -n "def \|rng" tools/gen_mockups.py` → `rng = np.random.default_rng(11)` (l.15),
  `box_front` (l.78), `main` (l.106), `sys.argv[1]` (l.131); `--3d` não existe ainda (é da TASK-08).
- `ls editor-web/src/mockup app/src/main/assets/content/mockups3d` → não existem (criados pela TASK-08).
- `pipeline.py status` → `task-08-…` = `planejado` nesta execução (alta); TASK-19 e TASK-20 em planning.
- Protótipo de projeção (`$CLAUDE_JOB_DIR/tmp/box.py`: cubo, perspectiva D=6, culling por área assinada no espaço y
  para baixo) → `(0,0)` só `front`; `(0,±30)` `front` + uma lateral; `(±25,0)` `front` + `top`/`bottom`; `(−60,80)` e
  `(60,−80)` duas faces, `back` nunca. **Com as fórmulas ingênuas `R_x·R_y` o protótipo deu `rotY=+30 → left` e
  `rotX=+25 → top`, o OPOSTO da convenção acima nos dois eixos**: o sinal do ângulo tem de ser escolhido e travado pelo
  teste, não deduzido da fórmula.

### Hipóteses descartadas (e por quê)
- **Culling por `N_z ≤ 0` (como a spec escreve)**: exato só em projeção ortográfica; com `fov` largo e face quase de
  perfil decide errado. Área assinada do quad projetado é exata e mais simples.
- **Template de caixa como foto/base pintada (como `box_front`)**: a caixa tem de girar; as faces são desenhadas pelo
  motor, a base é só fundo.
- **`applySurfaceLighting` nas faces**: modularia a arte pela luminância do fundo, que não é a superfície da caixa.
- **Esticar a arte no quad da face**: o Post Facebook (~1,91:1) numa frente 1:1,3 sairia deformado; recorte "cover"
  custa só um quad de origem menor na homografia.
- **Juntar com a TASK-08 ou com a TASK-20**: o dono dividiu; dependência formal pela `depende_de`.

### Tarefas
- [ ] `claim` dos arquivos em pasta nova (comando acima), depois de abrir `mockupEngine.ts`/`mockupStudio.ts` da TASK-08.
- [ ] `editor-web/src/mockup/box3d.ts` (novo, puro) — `boxFaces`, `fitFaces`, `renderBox` (desenho acima) — vitest
  `editor-web/test/box3d.test.ts`: `rotX=rotY=0` → `['front']`; `rotY=+30` → `front`+`right` (e `−30` → `left`);
  `rotX=−25` → contém `top` (e `+25` → `bottom`); `back` ausente numa grade de `rotX`/`rotY` nas faixas; ordem de
  pintura com profundidade decrescente; `light` 1,00/1,08/0,78; `fitFaces` mantém todos os vértices dentro do
  retângulo; `renderBox` com faces cinza `#808080` → pixel no centróide da frente ≈128, do topo ≈138, da lateral ≈100
  (±2); sem fresta: na aresta comum frente/lateral, nenhum pixel com a cor pura do fundo (fundo magenta); `boxRatio`
  degenerado ou quad degenerado não lança.
- [ ] `editor-web/src/mockup/mockupStudio.ts` — modo Caixa 3D (shape `box3d` do template ou opção "Caixa 3D" em
  "Forma"), controles acima, handles ocultas, preview pelo mesmo `requestAnimationFrame`, saídas da TASK-08 sem
  mudança; estado `visibleFaces`/`faceQuads`/parâmetros no mesmo canal de leitura do E2E. `styles.css` — linha de
  slot por face.
- [ ] `tools/gen_mockups.py --3d` — template `box` (fundo de estúdio), POR ÚLTIMO ou rng próprio; `index.json` e
  `SOURCES.md` de `mockups3d/` com a entrada; prova: `python tools/gen_mockups.py --3d app/src/main/assets/content/mockups3d`
  → `git status` lista só `box.webp`, `box_thumb.webp`, `index.json`, `SOURCES.md` (os `.webp` da TASK-08 intactos);
  rodar duas vezes → mesmo `index.json`.
- [ ] `tools/e2e/task19.mjs` — a T2 abaixo (modelo `task08.mjs`/`task14.mjs`, `reporter`).
- [ ] `build --bug task-19-mockup-caixa-3d-multi-face` (background) → `claim` dos
  `editor/src/main/assets/editor/assets/index-<hash>.*` → commit `feat(editor): mockup de caixa 3D multi-face com
  rotacao, arte por face e luz por face (TASK-19)` junto com o bundle.

### Plano de teste
- **Offline (sem slot):** em `editor-web/`: `npx tsc --noEmit`; `npx vitest run test/box3d.test.ts` e `npx vitest run`
  inteiro (inclui `mockupEngine.test.ts` da TASK-08); o gerador como na tarefa (só os 4 arquivos do `box` mudam).
- **T2 reprodução como o usuário (E2E, no slot):** `launchEditor()` (Novo design → Post Facebook) → Texto →
  "Adicionar título" → aba `📦 Mockup 3D` → tile "Caixa 3D". Sinais pelo estado exposto e `getImageData` do
  `canvas.mockup-preview`: (1) Rotação X = 0 e Y = 0 → `visibleFaces` = `['front']`; (2) Rotação Y → +30 →
  `visibleFaces` contém `front` e `right`; −30 → `left`; (3) Rotação X → −25 → contém `top`; (4) cor Frente `#c00000`,
  Lateral `#00c000`, Topo `#0000c0` (via `input[type=color]` + evento `input`) com X=−25, Y=+30 → no centróide de cada
  `faceQuads`: frente R ∈ [185,199] (100 %), lateral G ∈ [143,157] (78 %), topo B ∈ [200,214] (108 %), canais restantes
  < 20; (5) Arte da Frente = "Design atual" → o pixel/hash da frente deixa de ser o vermelho sólido; (6) "Inserir no
  design" → `editor.canvas.getObjects().length` +1 e o novo é `FabricImage`; (7) "Salvar na galeria" → `toast` com
  local (anotar o `mockup_*` criado: o aparelho é do dono); `screencap` do estúdio em (4) e da página em (6).
- **Controle positivo:** no APK da base sincronizada (já com a TASK-08): o estúdio abre, mas não há modo Caixa 3D —
  nenhum tile "Caixa 3D" e nenhuma opção `box3d` em "Forma"
  (`document.querySelector('.mockup-studio')?.textContent.includes('Caixa 3D')` = `false`).
- **T3 regressão direcionada:** vitest inteiro; E2E `task08.mjs` (estúdio, cilindro, esfera, alças, inserir/salvar —
  o modo caixa não pode quebrar os outros nem as handles); `testDebugUnitTest` do `build` (`MockupTest`: 4 planos em
  `mockups/index.json`, intocado).

### Sessões seguintes
- dev: effort high, ultrathink sim — geometria com sinal de eixo fácil de errar (provado no protótipo), perspectiva,
  culling e fresta, mais encaixe num estúdio que só existirá depois da TASK-08; ~600–700 linhas novas.
- teste: effort medium, ultrathink não — roteiro E2E com sinais numéricos definidos.
