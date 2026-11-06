# [TASK-08] Motor de Mockup 2.5D (Plano com Malha, Cilindro, Esfera), Fusão de Luz/Dobras e Estúdio de Mockup

> **Divisão (decisão do dono, 2026-11-05).** O planning 20261105-1638 bloqueou a TASK-08 original (motor 2.5D/3D
> inteiro + caixa 3D + detecção Sobel) por tamanho: ~1.550–1.700 linhas novas, acima do teto de ~1.500 de uma sessão
> de dev. Esta task ficou com o **motor 2.5D (plano com malha, cilindro, esfera), a fusão de luz e dobras e o estúdio
> de mockup** (a "08a" do planning). O resto virou task própria, as duas **dependentes desta**:
> - Caixa 3D multi-face → [TASK-19](19-mockup-caixa-3d-multi-face.md);
> - Foto própria + "🎯 Detectar superfície" (Sobel/Alpha) → [TASK-20](20-mockup-detectar-superficie-em-foto-propria.md).
>
> O nome do arquivo ficou o original para não quebrar os links da matriz. O doc original inteiro, com a análise
> completa: `git show cbf5f41:docs/tasks/open/08-mockup-25d-3d-cilindro-esfera-cubo-sobel-iluminacao.md`.

## Metadados e Esforço Mensurado

| Campo | Valor |
| :--- | :--- |
| **ID** | `TASK-08` |
| **Prioridade** | **Média-Alta (Alto Valor Diferencial — P1/P2)** |
| **Esforço Mensurado** | **Médio-Alto** — **~3 dias úteis (22h–26h / 5 a 8 Story Points)**; ~950 linhas novas estimadas no planning (código + teste + E2E) |
| **Escopo** | Local (`editor-web` em TypeScript / Canvas 2D) + templates procedurais (`tools/gen_mockups.py`) |
| **Referência Analisada (`com.desygner.ads`)** | `js_pretty/assets/module-create-DxNmnX1s.js` (L208850–L209640) — só referência de algoritmo; nenhum código nem asset copiado |

### Detalhamento do Esforço por Subtarefa
1. **Motor de Projeção 2.5D (`mockupEngine.ts`): Homografia Plana 3×3 com malha, Mapeamento Cilíndrico e Esférico:** ~10h.
2. **Modulação de Iluminação e Dobras da Superfície (`applySurfaceLighting`):** ~6h.
3. **Estúdio de Mockup no Editor (aba `📦 Mockup 3D`, alças nos 4 cantos, sliders) e templates próprios de Caneca, Pote/Garrafa, Ecobag e Camiseta:** ~6h.
4. **Testes Unitários (Vitest) e E2E no Dispositivo:** ~3h.

---

## 1. Contexto e Problema Atual

Hoje o Mockup em `feature/mockup/src/main/kotlin/com/productphoto/feature/mockup/MockupScreen.kt`:
- Possui apenas 4 templates planos (`box_front`, `card_table`, `phone_screen`, `poster_wall`) renderizados com projeção plana simples;
- **Não curva rótulos em superfícies cilíndricas** (canecas, potes de suplemento, garrafas, latas, copos térmicos) nem **esféricas**;
- **Não transfere as dobras, sombras e relevo luminoso da foto de fundo para a estampa aplicada** (fazendo uma estampa
  numa camiseta ou caneca parecer um adesivo chapado colado por cima).

> [!IMPORTANT]
> Conforme a diretriz de propriedade intelectual do projeto (`HANDOFF_APP_OFFLINE.md` L42), **não copiaremos nenhum
> código nem nenhum asset SVG/PNG de `extracted/assets/public/mockups/` do Automo**. Implementaremos nossas próprias
> funções matemáticas em TypeScript e geraremos nossos próprios templates em `tools/gen_mockups.py`.

---

## 2. O que deve ser feito (Especificação Técnica Detalhada)

### 2.1. As 3 Geometrias de Projeção (`editor-web/src/mockup/mockupEngine.ts`)

1. **Geometria 1 — Plano em Perspectiva (`shapeType: 'plane'`):**
   - Dados os 4 cantos de destino $Q = [(x_0, y_0), (x_1, y_1), (x_2, y_2), (x_3, y_3)]$ (topo-esq, topo-dir, base-dir, base-esq):
   - Resolve o sistema linear $8 \times 8$ por eliminação Gaussiana com pivoteamento parcial para encontrar a matriz de
     **Homografia Projetiva $H \in \mathbb{R}^{3 \times 3}$** que mapeia $(x, y)$ do canvas de destino de volta para
     $(u, v) \in [0, W_s] \times [0, H_s]$ da imagem da arte:
     $$u = \frac{h_{11}x + h_{12}y + h_{13}}{h_{31}x + h_{32}y + 1}, \quad v = \frac{h_{21}x + h_{22}y + h_{23}}{h_{31}x + h_{32}y + 1}$$
   - Amostra os pixels de origem com **interpolação bilinear** (`sampleBilinear(srcData, u, v)`), evitando serrilhado.
   - Suporta também subdivisão em grade $3 \times 3$ (16 pontos de controle / Coons patch) para superfícies levemente
     onduladas (tecido de camiseta ou sacola *ecobag*).

2. **Geometria 2 — Cilindro / Tubo (`shapeType: 'cylinder'` — Canecas, Frascos, Potes, Latas):**
   - Parâmetros: `arcDeg` $\in [10^\circ, 179^\circ]$ (padrão $110^\circ$), `tiltDepth` $\in [-0.5, 0.5]$ (curvatura
     elíptica do topo e da base vista em ângulo) e quadrilátero delimitador $Q$.
   - Para cada coordenada normalizada $(s, t) \in [0, 1]^2$ dentro do quadrilátero (obtida via homografia inversa):
     - Coordenada horizontal na superfície cilíndrica de meio-ângulo $\alpha = \frac{\text{arcDeg} \cdot \pi}{360}$:
       $$u_{\text{cyl}}(s) = \frac{1}{2} + \frac{\arcsin\left((2s - 1) \cdot \sin\alpha\right)}{2\alpha}$$
     - Deslocamento vertical de perspectiva nas bordas do cilindro:
       $$\Delta t(s) = \text{tiltDepth} \cdot \left(1 - \sqrt{1 - (2s - 1)^2 \sin^2\alpha}\right)$$
     - **Sombreamento especular cilíndrico automático** ($\cos\theta$ com um leve *highlight* vertical em $s \approx 0.32$
       e escurecimento nas bordas $s \to 0$ e $s \to 1$).

3. **Geometria 3 — Esfera / Domo (`shapeType: 'sphere'` — Bolas, Bonés, Embalagens Redondas):**
   - Para coordenadas normalizadas $(dx, dy) = (2s - 1, 2t - 1)$ com $r = \sqrt{dx^2 + dy^2} \le 1$:
     $$\phi = \frac{\arcsin(r \cdot \sin\alpha)}{r \cdot \alpha}, \quad (u, v) = \left(\frac{1 + dx \cdot \phi}{2}, \frac{1 + dy \cdot \phi}{2}\right)$$
     com $r = 0 \Rightarrow \phi = \sin\alpha / \alpha$ (sem NaN) e $r > 1$ transparente.

### 2.2. Fusão Realista de Iluminação e Dobras da Superfície (`applySurfaceLighting`)
1. Antes de desenhar a arte projetada, copia os pixels da imagem base do mockup na região do quadrilátero.
2. Para cada pixel onde a arte projetada possui $\alpha > 0$:
   - Luminância da base $L_{\text{base}} = (0.299 R_b + 0.587 G_b + 0.114 B_b) / 255 \in [0, 1]$;
   - Normaliza em relação à luminância média $\bar{L}$ da superfície para que áreas claras de tecido não escureçam a arte inteira;
   - Fator de modulação com intensidade `shadingStrength` $\in [0, 1]$ (padrão `0.65`):
     $$f = \text{clamp}\left(1 + \text{shadingStrength} \cdot \left(\frac{L_{\text{base}}}{\max(0.25, \bar{L})} - 1\right), \; 0.50, \; 1.35\right)$$
   - Multiplica $(R, G, B)$ da arte por $f$ e adiciona um toque sutil de reflexo especular nas altas-luzes ($L_{\text{base}} > 0.85$).

### 2.3. Estúdio de Mockup
- Aba nova **`📦 Mockup 3D`** no editor: escolhe um template (ou a base plana existente), aplica o design atual ou a
  imagem selecionada, ajusta os 4 cantos por alças arrastáveis e os sliders (Arco, Inclinação, Fusão com dobras/luz).
- Saídas: **"Inserir no design"** e **"Salvar na galeria"**.

---

## 3. Arquivos a Criar / Modificar

| Arquivo | Ação | Descrição |
| :--- | :---: | :--- |
| `editor-web/src/mockup/mockupEngine.ts` | **Criar** | Homografia 3×3 com bilinear e malha (`renderPlaneMockup`), cilindro (`renderCylinderMockup`), esfera (`renderSphereMockup`) e `applySurfaceLighting`. |
| `editor-web/src/mockup/mockupStudio.ts` | **Criar** | UI do estúdio: escolha de template, alças dos 4 cantos, sliders, preview reduzido, inserir/salvar. |
| `editor-web/src/main.ts` | **Modificar** | Aba `📦 Mockup 3D` em `tabs`. |
| `editor-web/src/styles.css` | **Modificar** | Estilo do estúdio e das alças. |
| `tools/gen_mockups.py` | **Modificar** | Entrada própria `--3d <saída>` para templates procedurais (Caneca, Pote/Frasco, Ecobag, Camiseta com dobras) sem tocar nos planos. |
| `app/src/main/assets/content/mockups3d/` | **Criar** | `index.json`, bases `*.webp`, `*_thumb.webp`, `SOURCES.md`. |
| `app/src/main/assets/content/SOURCES.md` | **Modificar** | Linha dos templates 3D. |
| `editor-web/test/mockupEngine.test.ts` | **Criar** | Homografia, cilindro, esfera, malha e `applySurfaceLighting`. |
| `tools/e2e/task08.mjs` | **Criar** | E2E no aparelho (Plano de teste abaixo). |
| `editor/src/main/assets/editor/index.html` | **Regerar** | Bundle do editor. |

---

## 4. Critérios de Aceite e Verificação

- [ ] Usuário consegue aplicar um rótulo/anúncio em modo **Cilindro (Caneca / Pote / Garrafa)** ajustando o arco
  (`arcDeg`) e a inclinação (`tiltDepth`) em tempo real, e em modo **Plano** e **Esfera**.
- [ ] O slider **"Fusão com Dobras / Luz da Superfície"** transfere realisticamente as sombras e texturas da foto base para a arte aplicada.
- [ ] O resultado pode ser inserido no design e salvo na galeria.
- [ ] O fluxo Kotlin "Ver em mockup" continua com os 4 templates planos.
- [ ] `npx vitest run` e `npm run build` executam com 0 erros.

---

## Análise herdada — planning 20261105-1638 (antes da divisão)

**Veredito daquele planning:** bloqueado por tamanho (task inteira ~1.550–1.700 linhas); dividida pelo dono em
2026-11-05 conforme a proposta daquele planning (esta é a "08a"). O próximo planning confere a análise contra a base
(as linhas são da base `0d616c3`) em vez de refazê-la.
**Complexidade estimada:** alta — formato de dados novo (índice de templates 3D com `shape` e parâmetros),
editor-web + assets do `:app` + gerador Python, e UI nova de alças arrastáveis sobre um preview.
**Reserva prevista:** `editor-web/src/mockup/mockupEngine.ts` (novo), `editor-web/src/mockup/mockupStudio.ts` (novo),
`editor-web/src/main.ts`, `editor-web/src/styles.css`, `editor-web/test/mockupEngine.test.ts` (novo),
`editor/src/main/assets/editor/index.html` (bundle), `tools/gen_mockups.py`, `app/src/main/assets/content/mockups3d/`
(novos), `app/src/main/assets/content/SOURCES.md` e `tools/e2e/task08.mjs` (novo).

### Estado atual (símbolos abertos: `arquivo::simbolo` — faz X; em erro, Y)
- `editor-web/src/**` — **não existe nenhum motor de mockup no editor**: `grep -rni mockup editor-web/src` só acha o
  botão "Ver em mockup" (`main.ts::showExport`, ~l.1773, `toMockup` → `bridge.request('export', {action:'mockup'})`,
  que manda o PNG para o fluxo Kotlin) e URLs do catálogo remoto em `content.ts`. Não existem `editor-web/src/mockup/`
  nem `test/mockupEngine.test.ts` (criar).
- `core/imaging/.../PerspectiveMockupRenderer.kt::PerspectiveMockup.render` — o motor atual é **só plano**: homografia
  `Homography.rectToQuad(...).inverse()` (`Homography.kt::fromQuads`, DLT 8×8), amostragem bilinear, cobertura 4×4 na
  borda, sombreamento = luminância da base ÷ percentil 90 (`percentile90`) dosado por `shading`, deslocamento por
  passa-alta. Serve de **referência de algoritmo**, não de código a chamar: o editor é TS.
- `feature/mockup/.../MockupLibrary.kt::bundled` — lê `assets/content/mockups/index.json` (`MockupIndex`, `Json {
  ignoreUnknownKeys = true }`), e o `MockupScreen` renderiza **todo** template desse índice pelo motor plano.
  Consequência: **templates curvos (caneca, garrafa) NÃO podem entrar em `content/mockups/index.json`**: um campo
  `shape` seria ignorado em silêncio e a caneca sairia chapada no fluxo Kotlin. Vão num índice próprio,
  `content/mockups3d/index.json`, lido só pelo editor.
- `tools/gen_mockups.py::main` — **reescreve `index.json` e `SOURCES.md` inteiros a cada execução** (4 templates
  planos, `rng` com semente 11). O gerador dos templates 3D precisa de entrada própria (flag ou subcomando com saída em
  `app/src/main/assets/content/mockups3d`); senão regenera e sobrescreve os planos.
- `editor-web/src/content.ts::CONTENT_BASE`/`contentUrl` — `new URL('../content/', document.baseURI)`; o asset loader
  serve `/assets/` inteiro (`editor/.../EditorAssets.kt:25`, `AssetsPathHandler`), então o editor lê
  `contentUrl('mockups3d/index.json')` e `contentUrl('mockups/index.json')` (os 4 planos, só leitura) sem mudança
  Kotlin. `loadContentIndex` não carrega mockups hoje (fetch próprio no estúdio).
- `editor-web/index.html` (CSP) — `img-src 'self' data: blob: …`: um resultado em dataURL pode virar `FabricImage`.
- `editor-web/src/editor.ts::addImage(url, {fit})` (l.348) — `FabricImage.fromURL(url)` + escala para caber; aceita
  dataURL → "Inserir no design". `editor.ts::exportRaster('png', scale, quality)` (l.1482) → dataURL da página = a arte
  "design atual". `editor.ts::imageSrc(img)` (l.1226) → a arte "imagem selecionada".
- `editor/.../EditorSession.kt::export` (l.238) — `action: 'save'` com `format: 'png'|'jpg'` decodifica `data` por
  `EditorAssets.dataUrlBytes` e chama `host.export`: "Salvar mockup na galeria" sai **sem mudança Kotlin**. Em erro:
  `BridgeException` (INVALID/UNSUPPORTED) → o `run()` do main.ts mostra a mensagem.
- `editor-web/src/main.ts` — `tabs` (l.1114) é a lista de abas (`[rótulo, fn]`); `showImage` (l.1172) é a folha de
  imagem; `imageProps` (l.970) são os botões da imagem selecionada. `dom.ts` fornece `openSheet(title, content,
  {tall})`, `slider`, `select`, `button` e `colorInput`.
- `tools/e2e/cdp.mjs` — exporta `launchEditor`, `connect` (`evaluate`, `tap`, `touch`, `drag`, `pinch`), `screencap`,
  `uiFind`, `uiTap` e `reporter`: basta para arrastar alças (`drag`) e ler pixels do preview por `evaluate`.

### Decisões comuns às TASK-08, 19 e 20 (do planning)
- Código em `editor-web/src/mockup/`: motor e detector puros sobre `ImageData`/arrays, testáveis no vitest sem DOM, e
  `mockupStudio.ts` para a UI. O `main.ts` só ganha a entrada (aba `📦 Mockup 3D` em `tabs`).
- Preview em resolução reduzida (lado ≤ 512 px) enquanto o slider ou a alça se mexe; render na resolução da base só ao
  aplicar (JS por pixel numa base de 1600² com um quad de ~600 mil px custa dezenas a centenas de ms no aparelho).
- Saída: "Inserir no design" (`editor.addImage(dataURL, {fit})`, em JPEG 0,92 porque a base é opaca; um dataURL PNG de
  1600² infla o rascunho em MB) e "Salvar na galeria" (`bridge.request('export', {format:'png', action:'save'})`).
- Templates 3D procedurais (nunca assets do app de referência): `tools/gen_mockups.py` ganha uma entrada própria
  (`--3d <saída>`) que grava `app/src/main/assets/content/mockups3d/{index.json, *.webp, *_thumb.webp, SOURCES.md}` e
  uma linha em `app/src/main/assets/content/SOURCES.md`. Índice: `{id, name, shape: plane|cylinder|sphere|box3d, file,
  thumb, width, height, quad: [[x,y]×4], arcDeg?, tiltDepth?, shadingStrength}`.

### Provas (comando literal -> resultado)
- `grep -rni "mockup" editor-web/src --include=*.ts` → só `content.ts:73,74,89` (URLs do HF), `main.ts:1773-1804`
  (`toMockup`) e `protocol.ts:149` (`action`). Nenhum motor.
- `ls editor-web/src/mockup app/src/main/assets/content/mockups3d` → "No such file or directory" (os dois).
- `du -k app/src/main/assets/content/mockups/*.webp` → bases de 24 a 180 KB: bases 3D procedurais cabem no orçamento.

### Hipóteses descartadas (e por quê)
- **Implementar no `:feature:mockup`/`:core:imaging` (Kotlin)**: a arte (o design) vive no editor; um preview
  interativo com sliders e alças em Compose duplicaria o que o editor-web já tem. Tudo em `editor-web/`, zero Kotlin.
- **Pôr os templates curvos em `content/mockups/index.json` com um campo `shape`**: o `MockupLibrary` ignora o campo
  (`ignoreUnknownKeys`) e o `MockupScreen` os renderizaria planos. Índice separado em `mockups3d/`.
- **Rodar `gen_mockups.py` como está para acrescentar os templates**: o `main()` reescreve `index.json`/`SOURCES.md`
  dos planos; precisa de entrada própria.
- **Fórmula da esfera do doc invertida?** Conferida: com `φ(r) = asin(r·sinα)/(r·α)`, o deslocamento de textura é
  `r·φ = asin(r·sinα)/α`; está correta; só falta tratar `r = 0` → `φ = sinα/α`. A do cilindro também:
  `u_cyl(0)=0`, `u_cyl(0.5)=0.5`, `u_cyl(1)=1`.

### Tarefas
- [ ] `mockupEngine.ts` — homografia + bilinear + malha 3×3, cilindro, esfera, `applySurfaceLighting` — vitest
  `test/mockupEngine.test.ts`: a homografia leva os 4 cantos do retângulo nos 4 cantos do quad (erro < 1e-6) e o
  centro no ponto esperado; `uCyl(0)=0`, `uCyl(0.5)=0.5`, `uCyl(1)=1`, monotônica, com derivada maior na borda que no
  centro; na esfera, `r=0` sem NaN, `r=1` → borda e `r>1` → transparente; `applySurfaceLighting` com base de
  luminância uniforme deixa a arte inalterada, uma base com faixa escura escurece a arte na faixa, e `f` fica em
  [0,50; 1,35]; a malha 3×3 com pontos retos dá o mesmo resultado do plano.
- [ ] `mockupStudio.ts` + aba em `main.ts` + `styles.css` — templates, alças, sliders, inserir/salvar.
- [ ] `tools/gen_mockups.py --3d` + `content/mockups3d/` + `content/SOURCES.md` — `python tools/gen_mockups.py --3d
  <tmp>` gera um índice válido (quad convexo dentro da base, `shape` conhecido) e **não** toca `content/mockups/`.
- [ ] `tools/e2e/task08.mjs` — a T2 abaixo.

### Plano de teste
- **Offline (sem slot):** `npx tsc --noEmit` e `npx vitest run test/mockupEngine.test.ts` em `editor-web/`; o gerador
  `--3d` como acima.
- **T2 reprodução como o usuário (E2E, no slot):** `launchEditor()` (Novo design → Post Facebook), adicionar um título
  (Texto → Adicionar título) para a arte não ficar vazia → tocar a aba `📦 Mockup 3D` → escolher "Caneca" → sinal: o
  canvas do preview tem pixels da arte dentro do quad (via `evaluate` e `getImageData`); mover o slider "Arco" de 110
  para 170 → o hash dos pixels do preview muda e a largura útil da arte na linha central diminui nas bordas; mover
  "Fusão com dobras/luz" de 0 para 1 → a luminância média da arte dentro da faixa de dobra cai; arrastar uma alça com
  `drag` → o canto do quad se move; "Inserir no design" → a página ganha 1 `FabricImage` (contagem de objetos +1), com
  `screencap` do aparelho.
- **Controle positivo:** no APK da base, a aba `📦 Mockup 3D` não existe:
  `[...document.querySelectorAll('#tabs button')].some(b => b.textContent.includes('Mockup 3D'))` = `false`.
- **T3 regressão direcionada:** vitest inteiro; E2E `task12.mjs` e `task14.mjs` (abas e folhas vizinhas em `main.ts`);
  o fluxo Kotlin "Ver em mockup" e Home → Mockup continuam listando só os 4 planos (`MockupTest` no
  `testDebugUnitTest` do `build`, e a grade do `MockupScreen` com 4 itens embutidos).

### Sessões seguintes (sugestão daquele planning)
- dev: effort high + ultrathink (geometria + UI de alças).
- teste: effort medium, sem ultrathink.

---

## Planejamento (pipeline 20261106-0749, 2026-11-06)

**Veredito:** corrigir — o estúdio de mockup 2.5D (plano com malha, cilindro, esfera, fusão de luz/dobras) cabe todo em
`editor-web/` + templates procedurais do `tools/gen_mockups.py`, sem Kotlin, e prova-se pela UI no aparelho.
**Complexidade:** alta — formato de dados novo (`content/mockups3d/index.json` com `shape`/parâmetros), editor-web +
assets do `:app` + gerador Python, UI nova de alças arrastáveis sobre um preview.
**Severidade:** medio — funcionalidade nova ausente, com contorno (o mockup plano do fluxo Kotlin "Ver em mockup").
**Arquivos a alterar (reserva da onda):**
- `editor-web/src/main.ts` — aba `📦 Mockup 3D` no fim do array `tabs` (l.1376) chamando `openMockupStudio(...)`
- `editor-web/src/styles.css` — estúdio, preview e alças
- `editor/src/main/assets/editor/index.html` — bundle regerado pelo `build`
- `tools/gen_mockups.py` — entrada `--3d <saída>` (os planos ficam intactos)
- `app/src/main/assets/content/SOURCES.md` — linha dos templates 3D
- `editor-web/test/mockupEngine.test.ts` (novo) e `tools/e2e/task08.mjs` (novo) — pastas existentes
- **Arquivos em pasta NOVA — o `plan-done` recusa reservar caminho cuja pasta não existe (`pipeline.py` l.1872): o dev
  faz `claim` deles ANTES da primeira edição**, numa chamada só:
  `python <helper> claim --bug task-08-mockup-25d-3d-cilindro-esfera-cubo-sobel-iluminacao
  --file editor-web/src/mockup/mockupEngine.ts --file editor-web/src/mockup/mockupStudio.ts
  --file app/src/main/assets/content/mockups3d/index.json --file app/src/main/assets/content/mockups3d/SOURCES.md`
  e um `--file app/src/main/assets/content/mockups3d/<id>.webp` / `<id>_thumb.webp` por template gerado (`mug`, `jar`,
  `ball`, `ecobag`, `tshirt`). Ninguém da execução disputa essas pastas: TASK-19 e TASK-20 tocam `editor-web/src/mockup/`
  mas dependem desta.

### Causa raiz (símbolos abertos: `arquivo::simbolo` — faz X; em erro, Y)
Item é task: "causa" = funcionalidade ausente. Conferência da análise herdada (base `0d616c3`) contra a base atual
(`80b97d7`, depois das TASK-09/10/13): as linhas mudaram, o resto vale.
- `editor-web/src/**` — continua sem motor de mockup. `main.ts::showExport` (agora l.2304) → `toMockup` (l.2364):
  `editor.exportRaster('png',1,1)` + `bridge.request('export', {format:'png', action:'mockup', name, data})`. Não muda.
- `main.ts::tabs` (l.1376) — `[string, () => void][]`, 12 abas; o `replaceChildren` de `#tabs` (l.1391) envolve cada
  `fn` com `if (editor.isFreehandDrawing) finishFreehand()`. A aba nova entra no fim; `#tabs` tem `overflow-x: auto`
  (styles.css l.85) e o `center` do `cdp.mjs` faz `scrollIntoView`, então a aba fora da tela é tocável pelo E2E.
- `editor.ts::renderPageCanvas(maxSide=2048, filter?)` (l.2147) — `{canvas, scale}` da página com vpt identidade
  (`try/finally` restaura o vpt; em erro propaga). **Fonte da arte "design atual"** (evita o round-trip dataURL de
  `exportRaster`); `eyedropper.ts::pickColorFromCanvas` (l.25–40) já usa assim, com `try/catch` + mensagem.
- `editor.ts::exportRaster(format, scale, quality, bleed=0)` (l.2180) — dataURL; `discardActiveObject` antes.
- `editor.ts::addImage(url, {fit})` (l.931) — `FabricImage.fromURL(url)`, escala para caber (`fit` padrão 0,6),
  centraliza, `this.add` (histórico). Aceita dataURL (CSP `img-src 'self' data: blob: …`, `editor-web/index.html` l.6).
- `editor.ts::active` (l.1033) — objeto ativo; "imagem selecionada" = `editor.active instanceof FabricImage`, pixels por
  `drawImage(img.getElement())` num canvas. **Em erro:** imagem de outra origem (catálogo HF; nenhum `crossOrigin` no
  código) suja o canvas e `getImageData` lança `SecurityError` — `main.ts::imageColors` (l.449) já trata com
  `try/catch`; o estúdio deve cair para "design atual" com `toast`, nunca quebrar.
- `dom.ts` — `openSheet(title, content, {tall})` devolve `close` (l.97); `slider(label,min,max,step,value,onInput,
  onCommit?)` (l.24: `onInput` no `input`, `onCommit` no `change`); `select(label, [[v,rótulo]], value, onChange)`;
  `button(label, fn, cls)`; `toast`.
- `editor/.../EditorSession.kt::export` (l.259) — sem `batch` e formato ≠ pdf/mp4/gif: `EditorAssets.dataUrlBytes(data)`
  (l.102; não-base64 → `BridgeException(INVALID)`) → `host.export(format, action, name, bytes)` → `{location?}`. Então
  "Salvar na galeria" = `bridge.request('export', {format:'jpg'|'png', action:'save', name, data})`, **sem Kotlin**. O
  lote da TASK-10 só entra com `batch` ou pdf.
- `content.ts::CONTENT_BASE`/`contentUrl` (l.4, l.62) — `new URL('../content/', document.baseURI)` → `/assets/content/`;
  `EditorAssets.kt` l.25 serve `/assets/` inteiro (`AssetsPathHandler`): `contentUrl('mockups3d/index.json')` e
  `contentUrl('mockups/index.json')` funcionam sem Kotlin, mesma origem (canvas não suja).
- `feature/mockup/.../MockupLibrary.kt` — `parseMockupIndex` com `Json { ignoreUnknownKeys = true }` (l.50); `bundled`
  lê só `mockups/index.json` (l.191); nenhum `assets.list` da pasta. `MockupTest` (l.15) exige **exatamente 4**
  entradas nesse índice → templates curvos **não** entram lá (índice próprio confirmado).
- `tools/gen_mockups.py::main(out_dir)` (l.106) — grava `index.json`/`SOURCES.md` inteiros; `rng` global semente 11
  (l.15) consumido por `noise()`. O caminho `--3d` usa **rng próprio** (`np.random.default_rng(<outra semente>)`) e não
  chama `main`: não altera a saída nem a sequência aleatória dos planos. Sem flag, comportamento atual idêntico.
- `core/imaging/.../PerspectiveMockupRenderer.kt::PerspectiveMockup.render` (l.28) — referência de algoritmo (bilinear,
  cobertura de borda, sombreamento por luminância/percentil 90). Não é chamado.
- `editor-web/vite.config.ts` — `test.environment: 'node'`: **não há `ImageData` nem canvas no vitest**. O motor opera
  sobre `{data: Uint8ClampedArray, width, height}` simples (o `ImageData` do navegador satisfaz o tipo).

### Provas (comando literal -> resultado)
- `grep -rni "mockup" editor-web/src --include=*.ts` → só `content.ts:73,74,89` e `main.ts:2364–2401` (`toMockup`).
- `ls editor-web/src/mockup app/src/main/assets/content/mockups3d` → "No such file or directory" (os dois).
- `MockupTest.kt` l.15 → `assertEquals(4, index.mockups.size)`.
- `grep -rn "crossOrigin" editor-web/src` → nada.
- `python -c "import numpy, PIL; print(numpy.__version__, PIL.__version__)"` → `2.5.2 12.2.0`.

### Hipóteses descartadas (e por quê)
- As da análise herdada continuam valendo (Kotlin descartado; `shape` em `mockups/index.json` descartado — agora também
  pelo `assertEquals(4, …)` do `MockupTest`; rodar `gen_mockups.py` como está descartado; fórmulas conferidas).
- **Arte do "design atual" por `exportRaster` + decodificar o dataURL**: funciona, mas `renderPageCanvas` já dá o canvas
  sem codificar/decodificar PNG.
- **Malha por Coons patch bicúbico**: mais código e sem teste simples. Usar **4×4 pontos → 9 células, cada uma com sua
  homografia** (piecewise-projetiva): com os 16 pontos sobre a homografia do plano, cada célula reproduz a global → o
  critério "malha reta = plano" sai exato. Ao arrastar um canto, os 16 pontos seguem pela homografia quad-antigo→novo.
- **Arquivos do motor soltos em `editor-web/src/`** (convenção atual): as TASK-19/20, aprovadas pelo dono, citam
  `editor-web/src/mockup/`; mantida a subpasta (custo: o `claim`).

### Tarefas
- [ ] `claim` dos arquivos em pasta nova (comando acima) — antes de editar.
- [ ] `editor-web/src/mockup/mockupEngine.ts` (novo, puro, sem DOM) — `Pixels = {data: Uint8ClampedArray, width,
  height}`, `Quad = [Pt,Pt,Pt,Pt]` (TL,TR,BR,BL); `homographyFromQuads(src, dst)` (DLT 8×8, Gauss com pivoteamento; quad
  degenerado → `null`), `applyH`; `sampleBilinear`; `uCyl(s, arcDeg)`, `cylTiltDt(s, arcDeg, tiltDepth)`,
  `sphereUV(dx, dy, arcDeg)` (`r=0` → `sinα/α`; `r>1` → `null`); `renderMockup(base, art, tpl, opts) → Pixels` com
  `shape: 'plane'|'cylinder'|'sphere'`, `mesh?` (16 pts), `arcDeg`, `tiltDepth`, `shadingStrength`, só no bbox do quad,
  cobertura de borda; `applySurfaceLighting` (fórmula da §2.2, clamp [0,50; 1,35], L̄ = média da luminância da base sob
  a máscara, especular se `L_base > 0,85`); sombreamento cilíndrico automático. Teste
  `editor-web/test/mockupEngine.test.ts`: homografia nos 4 cantos (erro < 1e-6) e centro; `uCyl` 0/0,5/1, monotônica,
  derivada maior na borda; esfera `r=0` sem NaN, `r=1` borda, `r>1` transparente; luz uniforme não altera a arte; faixa
  escura escurece; `f ∈ [0,50; 1,35]`; malha reta ≡ plano pixel a pixel; quad degenerado não lança.
- [ ] `editor-web/src/mockup/mockupStudio.ts` (novo) — `openMockupStudio(deps)` com `openSheet('📦 Mockup 3D', …,
  {tall:true})`: grade de templates (`fetch(contentUrl('mockups3d/index.json'))` + os 4 planos de `mockups/index.json`
  como `shape:'plane'` com `slots[0].quad`), `select` "Forma" (Plano/Cilindro/Esfera, padrão = o do template), `select`
  "Arte" (Design atual / Imagem selecionada — esta só com `FabricImage` ativa), `<canvas class="mockup-preview">` ≤ 512 px
  de lado, 4 `.mockup-handle` (pointer events, `touch-action: none` para a folha não rolar; coordenadas convertidas para
  px da base), sliders "Arco" (10–179, 110), "Inclinação" (−0,5–0,5, do template), "Fusão com dobras/luz" (0–1, 0,65),
  preview em `requestAnimationFrame`; "Inserir no design" (render na resolução da base → JPEG 0,92 →
  `editor.addImage(url, {fit:0.8})`, fecha a folha) e "Salvar na galeria" (`bridge.request('export', {format:'jpg',
  action:'save', name:'mockup_'+nome, data})`, `toast` com `location`). Erro de fetch/imagem/canvas sujo → `toast`, sem
  lançar. Para o E2E: estado corrente (quad em px da base, shape, parâmetros) só de leitura em
  `canvas.mockup-preview.dataset` (JSON) ou `window.__mockupStudio`.
- [ ] `editor-web/src/main.ts` — `['📦 Mockup 3D', () => openMockupStudio({ editor, bridge })]` no fim de `tabs`;
  `styles.css` — `.mockup-studio`, `.mockup-preview`, `.mockup-handle`.
- [ ] `tools/gen_mockups.py --3d <saída>` — `mug` (Caneca, cilindro, arco 110, tilt 0,12), `jar` (Pote/Garrafa, cilindro
  140), `ball` (Bola, esfera), `ecobag` e `tshirt` (plano com `mesh` e faixas de dobra escuras conhecidas), bases ≤ 1600
  px, quads convexos dentro da base, `index.json` no formato `{version:1, mockups:[{id,name,shape,file,thumb,width,
  height,quad,mesh?,arcDeg?,tiltDepth?,shadingStrength}]}`, `SOURCES.md` da pasta; linha em `content/SOURCES.md`. Prova:
  `python tools/gen_mockups.py --3d <tmp>` duas vezes → mesmo `index.json`; `git status app/src/main/assets/content/
  mockups` limpo depois de gerar em `mockups3d`.
- [ ] `tools/e2e/task08.mjs` — a T2 abaixo (modelo `task14.mjs`, `reporter`).
- [ ] `build --bug <slug>` (background) → `claim` dos `editor/src/main/assets/editor/assets/index-<hash>.*` → commit
  `feat(editor): ... (TASK-08)` junto com o bundle.

### Plano de teste
- **Offline (sem slot):** em `editor-web/`: `npx tsc --noEmit`; `npx vitest run test/mockupEngine.test.ts` e `npx vitest
  run` inteiro; o gerador `--3d` em pasta temporária (índice válido, determinístico, `content/mockups/` intocado).
- **T2 reprodução como o usuário (E2E, no slot):** `launchEditor()` (Novo design → Post Facebook) → aba Texto →
  "Adicionar título" (arte não vazia) → tocar a aba `📦 Mockup 3D` → tile "Caneca". Sinais (via `evaluate` no
  `canvas.mockup-preview`, `getImageData`): (1) há pixels da arte dentro do quad (diferença contra a base pura acima de
  um limiar); (2) "Arco" 110→170 → hash dos pixels muda e a largura útil da arte na linha central diminui; (3) "Fusão
  com dobras/luz" 0→1 → luminância média da arte na faixa da borda do cilindro cai; (4) `drag` de uma `.mockup-handle`
  → o canto do quad exposto pelo estúdio se move (> 20 px da base); (5) "Forma" = Esfera → hash muda e os cantos do quad
  voltam à base; (6) "Inserir no design" → `editor.canvas.getObjects().length` +1 e o novo é `FabricImage`; (7) "Salvar
  na galeria" → `toast` com local (o aparelho é do dono: anotar na evidência o arquivo `mockup_*` criado);
  `screencap` do estúdio e da página.
- **Controle positivo:** no APK da base a aba não existe:
  `[...document.querySelectorAll('#tabs button')].some(b => b.textContent.includes('Mockup 3D'))` = `false`.
- **T3 regressão direcionada:** vitest inteiro e `testDebugUnitTest` do `build` (`MockupTest`: 4 planos;
  `PerspectiveMockupTest`); E2E `task12.mjs`, `task14.mjs` e `task10.mjs` (abas/folhas vizinhas e a folha Exportar com
  "Ver em mockup"); manual: Exportar → "Ver em mockup" abre o `MockupScreen` com os 4 planos.

### Sessões seguintes
- dev: effort high, ultrathink sim — geometria (homografia, cilindro, esfera, malha) + UI de alças com pointer events
  sobre preview escalado; ~1.100–1.250 linhas novas (abaixo do teto de ~1.500).
- teste: effort medium, ultrathink não — roteiro E2E definido; sinais numéricos por `evaluate`.
