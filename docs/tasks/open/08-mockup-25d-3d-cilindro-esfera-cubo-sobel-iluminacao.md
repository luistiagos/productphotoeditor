# [TASK-08] Motor de Mockup 2.5D/3D (Cilindro, Esfera, Cubo 3D, Fusão de Iluminação/Dobras e Detecção Automática Sobel)

## Metadados e Esforço Mensurado

| Campo | Valor |
| :--- | :--- |
| **ID** | `TASK-08` |
| **Prioridade** | **Média-Alta (Alto Valor Diferencial — P1/P2)** |
| **Esforço Mensurado** | **Médio-Alto** — **~4 a 6 dias úteis (32h–48h / 8 a 13 Story Points)** |
| **Escopo** | Local (`editor-web` em TypeScript/Canvas 2D e/ou módulo nativo `:feature:mockup` em Kotlin) |
| **Referência Analisada (`com.desygner.ads`)** | `js_pretty/assets/module-create-DxNmnX1s.js` (L208850–L209640: funções `f$n`, `g$n`, `LAe`, `IGe`, `MGe`, `v$n`, `EGe`, `ZF`, `Ej`, `g4`, `_Ge`, `LGe`, `w$n`, `OGe`, `KE`, `k$n`, `HH`, `VH`) |

### Detalhamento do Esforço por Subtarefa
1. **Motor Matemático de Projeção 2.5D/3D (`mockupEngine.ts`): Homografia Plana 3×3 (`plane`), Mapeamento Cilíndrico (`tube`), Esférico (`sphere`) e Caixa 3D Multi-Face (`cube`):** ~14h.
2. **Modulação de Iluminação e Dobras da Superfície (`applySurfaceLighting` inspirado em `HH` L209350):** ~6h.
3. **Detector Automático de Superfície por Filtro Sobel + Alfa (`detectSurfaceQuad` inspirado em `f$n`/`LAe`/`IGe` L208880–L209115):** ~8h.
4. **Interface Interativa de Mockup no Editor (`showMockupStudio` com alças nos 4 cantos, controles de curvatura/rotação 3D e novos templates próprios de Caneca, Garrafa, Camiseta, Sacola e Caixa):** ~8h.
5. **Testes Unitários (Vitest) e Validação Visual no Dispositivo:** ~4h.

---

## 1. Contexto e Problema Atual

Atualmente, nossa funcionalidade de Mockup em [`feature/mockup/src/main/kotlin/com/productphoto/feature/mockup/MockupScreen.kt`](file:///c:/projects/sandbox/product_photo_offline/feature/mockup/src/main/kotlin/com/productphoto/feature/mockup/MockupScreen.kt):
- Possui apenas 4 templates planos (`box_front`, `card_table`, `phone_screen`, `poster_wall`) renderizados com projeção plana simples;
- **Não curva rótulos em superfícies cilíndricas** (canecas, potes de suplemento, garrafas, latas, copos térmicos) nem **esféricas**;
- **Não possui projeção de Caixa 3D multi-face** (onde o usuário rotaciona a embalagem em `rotX`/`rotY` e aplica artes na frente, lateral e topo);
- **Não transfere as dobras, sombras e relevo luminoso da foto de fundo para a estampa aplicada** (fazendo uma estampa numa camiseta ou caneca parecer um adesivo chapado colado por cima);
- **Não permite aplicar o design em uma foto própria do usuário** detectando automaticamente os 4 cantos da superfície (ex.: o cliente tira foto da própria embalagem/quadro/camiseta e encaixa o rótulo).

Na análise de `module-create-DxNmnX1s.js` (L208850–L209640) do `com.desygner.ads`, descobrimos que todo esse motor 2.5D/3D roda em **puro Canvas 2D / ImageData**, sem depender de GPU remota nem de bibliotecas 3D pesadas!

> [!IMPORTANT]
> Conforme a diretriz de propriedade intelectual do projeto ([`HANDOFF_APP_OFFLINE.md`](file:///c:/projects/sandbox/product_photo_offline/HANDOFF_APP_OFFLINE.md) L42), **não copiaremos nenhum código nem nenhum asset SVG/PNG de `extracted/assets/public/mockups/` do Automo**. Implementaremos nossas próprias funções matemáticas limpas em TypeScript e geraremos nossos próprios templates em `tools/gen_mockups.py`.

---

## 2. O que deve ser feito (Especificação Técnica Detalhada)

### 2.1. As 4 Geometrias de Projeção (`editor-web/src/mockup/mockupEngine.ts`)

1. **Geometria 1 — Plano em Perspectiva (`shapeType: 'plane'`):**
   - Dados os 4 cantos de destino $Q = [(x_0, y_0), (x_1, y_1), (x_2, y_2), (x_3, y_3)]$ (topo-esq, topo-dir, base-dir, base-esq):
   - Resolve o sistema linear $8 \times 8$ por eliminação Gaussiana com pivoteamento parcial para encontrar a matriz de **Homografia Projetiva $H \in \mathbb{R}^{3 \times 3}$** que mapeia $(x, y)$ do canvas de destino de volta para $(u, v) \in [0, W_s] \times [0, H_s]$ da imagem da arte:
     $$u = \frac{h_{11}x + h_{12}y + h_{13}}{h_{31}x + h_{32}y + 1}, \quad v = \frac{h_{21}x + h_{22}y + h_{23}}{h_{31}x + h_{32}y + 1}$$
   - Amostra os pixels de origem com **interpolação bilinear** (`sampleBilinear(srcData, u, v)`), evitando serrilhado.
   - Suporta também subdivisão em grade $3 \times 3$ (16 pontos de controle Bézier/ Coons patch) para superfícies levemente onduladas (como tecido de camiseta ou sacola *ecobag*).

2. **Geometria 2 — Cilindro / Tubo (`shapeType: 'cylinder'` — Canecas, Frascos, Potes, Latas):**
   - Parâmetros: `arcDeg` $\in [10^\circ, 179^\circ]$ (padrão $110^\circ$), `tiltDepth` $\in [-0.5, 0.5]$ (curvatura elíptica do topo e da base vista em ângulo) e quadrilátero delimitador $Q$.
   - Para cada coordenada normalizada $(s, t) \in [0, 1]^2$ dentro do quadrilátero (obtida via homografia inversa):
     - A coordenada horizontal na superfície cilíndrica de meio-ângulo $\alpha = \frac{\text{arcDeg} \cdot \pi}{360}$ é:
       $$u_{\text{cyl}}(s) = \frac{1}{2} + \frac{\arcsin\left((2s - 1) \cdot \sin\alpha\right)}{2\alpha}$$
       *(Isso comprime gradualmente o rótulo nas bordas esquerda e direita, simulando a curvatura 3D do cilindro!)*
     - O deslocamento vertical de perspectiva nas bordas do cilindro é:
       $$\Delta t(s) = \text{tiltDepth} \cdot \left(1 - \sqrt{1 - (2s - 1)^2 \sin^2\alpha}\right)$$
     - Além disso, aplica um **sombreamento especular cilíndrico automático** ($\cos\theta$ com um leve *highlight* vertical em $s \approx 0.32$ e escurecimento nas bordas $s \to 0$ e $s \to 1$), dando volume realista a qualquer lata ou caneca!

3. **Geometria 3 — Esfera / Domo (`shapeType: 'sphere'` — Bolas, Bonés, Embalagens Redondas):**
   - Para coordenadas normalizadas $(dx, dy) = (2s - 1, 2t - 1)$ com $r = \sqrt{dx^2 + dy^2} \le 1$:
     $$\phi = \frac{\arcsin(r \cdot \sin\alpha)}{r \cdot \alpha}, \quad (u, v) = \left(\frac{1 + dx \cdot \phi}{2}, \frac{1 + dy \cdot \phi}{2}\right)$$

4. **Geometria 4 — Cubo / Caixa 3D Multi-Face (`shapeType: 'box3d'` — Embalagens de Produto):**
   - Parâmetros: `rotX` $\in [-60^\circ, 60^\circ]$ (inclinação vertical), `rotY` $\in [-80^\circ, 80^\circ]$ (giro horizontal), `boxRatio` `{ w, h, d }` (proporções de largura, altura e profundidade da caixa) e `fov` (distância focal).
   - Define os 8 vértices 3D da caixa $[-w/2, w/2] \times [-h/2, h/2] \times [-d/2, d/2]$, aplica as matrizes de rotação $R_x(\text{rotX}) \cdot R_y(\text{rotY})$ e projeção em perspectiva para 2D.
   - Realiza *back-face culling* (descarta faces cujo vetor normal $N_z \le 0$) e ordena as faces visíveis (`front`, `left`/`right`, `top`/`bottom`).
   - Renderiza a arte correspondente de cada face usando o mesmo projetor homográfico 3×3 e aplica iluminação direcional por face (frente $100\%$ de brilho, topo $108\%$, lateral em sombra $78\%$).

### 2.2. Fusão Realista de Iluminação e Dobras da Superfície (`applySurfaceLighting`)
Para fazer com que a estampa aplicada em uma camiseta, ecobag, caneca ou caixa herde as **dobras reais, rugas do tecido e sombras da foto base** (sem precisar de IA remota):
1. Antes de desenhar a arte projetada, copia os pixels da imagem base do mockup na região do quadrilátero.
2. Para cada pixel onde a arte projetada possui $\alpha > 0$:
   - Calcula a luminância da base $L_{\text{base}} = (0.299 R_b + 0.587 G_b + 0.114 B_b) / 255 \in [0, 1]$;
   - Normaliza em relação à luminância média $\bar{L}$ da superfície do mockup para que áreas claras de tecido não escureçam a arte inteira;
   - Calcula o fator de modulação com intensidade `shadingStrength` $\in [0, 1]$ (padrão `0.65`):
     $$f = \text{clamp}\left(1 + \text{shadingStrength} \cdot \left(\frac{L_{\text{base}}}{\max(0.25, \bar{L})} - 1\right), \; 0.50, \; 1.35\right)$$
   - Multiplica os canais $(R, G, B)$ da arte projetada por $f$ e adiciona um toque sutil de reflexo especular nas altas-luzes ($L_{\text{base}} > 0.85$).

### 2.3. Detecção Automática de Superfície por Filtro Sobel (`detectSurfaceQuad`)
Quando o usuário quiser aplicar seu anúncio/rótulo sobre **uma foto própria** (ex.: foto de um quadro, cartão, caixa ou frasco na mesa):
1. Redimensiona a imagem base para no máximo $256 \times 256$ em memória.
2. Se a imagem tiver canal Alpha recortado (produto isolado), encontra o contorno dos pixels com $\alpha > 32$.
3. Se a imagem for uma foto completa (sem transparência), calcula a magnitude do gradiente de bordas **Sobel 3×3** ($G = \sqrt{G_x^2 + G_y^2}$), aplica limiarização adaptativa (percentil 80 das bordas na região central) e encontra os 4 cantos extremos nas direções diagonais $(\pm 1, \pm 1)$ para sugerir automaticamente o quadrilátero inicial `warpCorners`!
4. O usuário pode então ajustar finamente qualquer um dos 4 cantos arrastando as alças na tela.

---

## 3. Arquivos a Criar / Modificar

| Arquivo | Ação | Descrição |
| :--- | :---: | :--- |
| [`editor-web/src/mockup/mockupEngine.ts`](file:///c:/projects/sandbox/product_photo_offline/editor-web/src/mockup/mockupEngine.ts) | **Criar** | Motor completo 2.5D/3D: homografia 3×3 com interpolação bilinear (`renderPlaneMockup`), cilindro (`renderCylinderMockup`), esfera (`renderSphereMockup`), caixa 3D multi-face (`renderBox3dMockup`) e fusão de iluminação/dobras (`applySurfaceLighting`). |
| [`editor-web/src/mockup/surfaceDetector.ts`](file:///c:/projects/sandbox/product_photo_offline/editor-web/src/mockup/surfaceDetector.ts) | **Criar** | Detector automático de quadrilátero de superfície via Sobel + Alpha (`detectSurfaceQuad`). |
| [`editor-web/src/main.ts`](file:///c:/projects/sandbox/product_photo_offline/editor-web/src/main.ts) | **Modificar** | Adicionar ferramenta **"📦 Mockup 3D / Rótulo"** (permitindo transformar o design atual ou uma imagem selecionada em Mockup Cilíndrico, Plano em Perspectiva, Esférico ou Caixa 3D com preview interativo). |
| [`tools/gen_mockups.py`](file:///c:/projects/sandbox/product_photo_offline/tools/gen_mockups.py) | **Modificar** | Adicionar geração de novos templates procedurais próprios (Caneca Cilíndrica, Pote/Frasco Cilíndrico, Sacola Ecobag, Camiseta com mapa de dobras e Caixa 3D). |
| [`editor-web/test/mockupEngine.test.ts`](file:///c:/projects/sandbox/product_photo_offline/editor-web/test/mockupEngine.test.ts) | **Criar** | Testes unitários validando a solução da matriz homográfica $3 \times 3$, o mapeamento cilíndrico (`u_cyl(0.5) === 0.5`), projeção de faces visíveis do cubo 3D, modulação luminosa `applySurfaceLighting` e detecção Sobel em imagem sintética. |

---

## 4. Critérios de Aceite e Verificação

- [ ] Usuário consegue aplicar um rótulo/anúncio em modo **Cilindro (Caneca / Pote / Garrafa)** ajustando o arco (`arcDeg`) e a inclinação (`tiltDepth`) em tempo real.
- [ ] Usuário consegue gerar uma **Caixa 3D** interativa girando `Rotação X` e `Rotação Y` e escolhendo cores/artes para a frente, lateral e topo.
- [ ] O slider **"Fusão com Dobras / Luz da Superfície"** transfere realisticamente as sombras e texturas da foto base para a arte aplicada.
- [ ] Ao importar uma foto qualquer como base de mockup, o botão **"🎯 Detectar superfície"** posiciona automaticamente os 4 cantos sobre o objeto principal usando Sobel/Alpha, permitindo ajuste manual das 4 alças.
- [ ] `npx vitest run` e `npm run build` executam com 0 erros.


---

## Planejamento (pipeline 20261105-1638, 2026-11-05)

**Veredito:** bloqueado — a task passa do teto de uma sessão de dev do manual (`projeto.md`, seção Itens: "> ~1.500
linhas novas → bloqueado com a proposta de divisão; o dono decide"). Estimativa enxuta abaixo: **~1.550–1.700 linhas
novas**, e o próprio doc estima 32–48 h (2–3× as tasks já entregues; a TASK-12 inteira foi ~800 linhas). Proposta de
divisão em 3 tasks na seção "Proposta de divisão"; nada foi implementado.
**Complexidade:** alta — formato de dados novo (índice de templates 3D com `shape` e parâmetros), editor-web + assets
do `:app` + gerador Python, e UI nova de alças arrastáveis sobre um preview.
**Severidade:** medio — funcionalidade nova ausente; nada que existe hoje quebra (o mockup plano do `:feature:mockup`
continua funcionando).
**Arquivos a alterar (reserva da onda):** nenhum nesta execução (bloqueado). A reserva de cada task proposta está na
divisão abaixo.

### Causa raiz (simbolos abertos: `arquivo::simbolo` — faz X; em erro, Y)

Item task: não há causa raiz, há o estado atual conferido contra o doc (o §1 do doc está correto).

- `editor-web/src/**` — **não existe nenhum motor de mockup no editor**: `grep -rni mockup editor-web/src` só acha o
  botão "Ver em mockup" (`main.ts::showExport`, ~l.1773, `toMockup` → `bridge.request('export', {action:'mockup'})`,
  que manda o PNG para o fluxo Kotlin) e URLs do catálogo remoto em `content.ts`. Não existem `editor-web/src/mockup/`
  nem `test/mockupEngine.test.ts` (criar).
- `core/imaging/.../PerspectiveMockupRenderer.kt::PerspectiveMockup.render` — o motor atual é **só plano**: homografia
  `Homography.rectToQuad(...).inverse()` (`Homography.kt::fromQuads`, DLT 8×8), amostragem bilinear, cobertura 4×4 na
  borda, sombreamento = luminância da base ÷ percentil 90 (`percentile90`) dosado por `shading`, deslocamento por
  passa-alta. Serve de **referência de algoritmo** (homografia, sombreamento), não de código a chamar: o editor é TS.
- `feature/mockup/.../MockupLibrary.kt::bundled` — lê `assets/content/mockups/index.json` (`MockupIndex`, `Json {
  ignoreUnknownKeys = true }`), e o `MockupScreen` renderiza **todo** template desse índice pelo motor plano.
  Consequência de desenho: **templates curvos (caneca, garrafa) NÃO podem entrar em `content/mockups/index.json`**:
  um campo `shape` seria ignorado em silêncio e a caneca sairia chapada no fluxo Kotlin. Vão num índice próprio,
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
  imagem; `imageProps` (l.970) são os botões da imagem selecionada. Ponto de entrada da ferramenta: aba nova
  `📦 Mockup 3D` (e, se quiser, um botão em `imageProps` para a "imagem selecionada"). `dom.ts` fornece
  `openSheet(title, content, {tall})`, `slider(label, min, max, step, value, onInput)`, `select`, `button` e
  `colorInput`.
- `tools/e2e/cdp.mjs` — exporta `launchEditor`, `connect` (`evaluate`, `tap`, `touch`, `drag`, `pinch`), `screencap`,
  `uiFind`, `uiTap` e `reporter`: basta para arrastar alças (`drag`) e ler pixels do preview por `evaluate`.

### Provas (comando literal -> resultado)
- `grep -rni "mockup" editor-web/src --include=*.ts` → só `content.ts:73,74,89` (URLs do HF), `main.ts:1773-1804`
  (`toMockup`) e `protocol.ts:149` (`action`). Nenhum motor.
- `ls editor-web/src/mockup app/src/main/assets/content/mockups3d` → "No such file or directory" (os dois).
- `wc -l editor-web/src/gradients.ts editor-web/src/connectors.ts editor-web/test/gradientsAndConnectors.test.ts
  tools/e2e/task12.mjs` → 126 + 140 + 168 + 227 (para calibrar o tamanho de uma task que coube numa sessão).
- `du -k app/src/main/assets/content/mockups/*.webp` → bases de 24 a 180 KB: 5 bases 3D procedurais cabem no
  orçamento da §8.

### Hipoteses descartadas (e por que)
- **Implementar no `:feature:mockup`/`:core:imaging` (Kotlin)**: o doc deixa aberto ("e/ou"). Descartado: a arte (o
  design) vive no editor; um preview interativo com sliders e alças em Compose duplicaria o que o editor-web já tem
  (`openSheet`/`slider`, toques reais testáveis por CDP) e somaria módulos Gradle. Tudo em `editor-web/`, zero Kotlin.
- **Pôr os templates curvos em `content/mockups/index.json` com um campo `shape`**: o `MockupLibrary` ignora o campo
  (`ignoreUnknownKeys`) e o `MockupScreen` os renderizaria planos. Índice separado em `mockups3d/`.
- **Rodar `gen_mockups.py` como está para acrescentar os templates**: o `main()` reescreve `index.json`/`SOURCES.md` dos
  planos; precisa de entrada própria.
- **Fórmula da esfera do doc invertida?** Conferida: com `φ(r) = asin(r·sinα)/(r·α)`, o deslocamento de textura é
  `r·φ = asin(r·sinα)/α`. No centro vale ≈ `r·sinα/α < r` (arte ampliada no centro) e em `r = 1` vale 1 (borda na
  borda, comprimida). Está correta; só falta tratar `r = 0` → `φ = sinα/α`. A do cilindro também está:
  `u_cyl(0)=0`, `u_cyl(0.5)=0.5`, `u_cyl(1)=1`.
- **Implementar só os critérios 1 e 3 agora e deixar o resto**: o manual proíbe "implementação pela metade". Daí a
  divisão formal em tasks, que o dono decide.

### Tarefas
Nenhuma nesta execução (bloqueado). As tarefas estão por task proposta, abaixo.

### Proposta de divisão (o dono decide; cada uma cabe numa sessão de dev)

Decisões comuns às três (valem para quem planejar cada uma):
- Código em `editor-web/src/mockup/`: motor e detector puros sobre `ImageData`/arrays, testáveis no vitest sem DOM, e
  `editor-web/src/mockup/mockupStudio.ts` para a UI. O `main.ts` só ganha a entrada (aba `📦 Mockup 3D` em `tabs`).
- Preview em resolução reduzida (lado ≤ 512 px) enquanto o slider ou a alça se mexe; render na resolução da base só ao
  aplicar (JS por pixel numa base de 1600² com um quad de ~600 mil px custa dezenas a centenas de ms no aparelho).
- Saída: "Inserir no design" (`editor.addImage(dataURL, {fit})`, em JPEG 0,92 porque a base é opaca; um dataURL PNG de
  1600² infla o rascunho em MB) e "Salvar na galeria" (`bridge.request('export', {format:'png', action:'save'})`).
- Templates 3D procedurais (nunca assets do app de referência): `tools/gen_mockups.py` ganha uma entrada própria
  (`--3d <saída>`) que grava `app/src/main/assets/content/mockups3d/{index.json, *.webp, *_thumb.webp, SOURCES.md}` e
  uma linha em `app/src/main/assets/content/SOURCES.md`. Índice: `{id, name, shape: plane|cylinder|sphere|box3d, file,
  thumb, width, height, quad: [[x,y]×4], arcDeg?, tiltDepth?, shadingStrength}`.

**TASK-08a — Motor 2.5D (plano com malha, cilindro, esfera) + fusão de luz e dobras + estúdio** (critérios 1 e 3, e a
esfera do §2.1). ~950 linhas.
- Reserva: `editor-web/src/mockup/mockupEngine.ts` (novo), `editor-web/src/mockup/mockupStudio.ts` (novo),
  `editor-web/src/main.ts`, `editor-web/src/styles.css`, `editor-web/test/mockupEngine.test.ts` (novo),
  `editor/src/main/assets/editor/index.html` (bundle), `tools/gen_mockups.py`, `app/src/main/assets/content/mockups3d/`
  (novos: caneca, pote, ecobag, camiseta com dobras), `app/src/main/assets/content/SOURCES.md` e `tools/e2e/task08.mjs`
  (novo).
- Provas (vitest): a homografia leva os 4 cantos do retângulo nos 4 cantos do quad (erro < 1e-6) e o centro no ponto
  esperado; `uCyl(0)=0`, `uCyl(0.5)=0.5`, `uCyl(1)=1`, monotônica, com derivada maior na borda que no centro; na
  esfera, `r=0` sem NaN, `r=1` → borda e `r>1` → transparente; `applySurfaceLighting` com base de luminância uniforme
  deixa a arte inalterada, uma base com faixa escura escurece a arte na faixa, e `f` fica em [0,50; 1,35]; a malha 3×3
  com pontos retos dá o mesmo resultado do plano.
- Effort sugerido: dev `high` + ultrathink (geometria + UI de alças); teste `medium`.

**TASK-08b — Caixa 3D multi-face** (critério 2). ~450 linhas. **Depende da 08a** (usa o warp plano e o estúdio).
- Reserva: `editor-web/src/mockup/mockupEngine.ts` (ou um `box3d.ts` novo), `editor-web/src/mockup/mockupStudio.ts`,
  `editor-web/test/box3d.test.ts` (novo), o bundle `editor/src/main/assets/editor/index.html`, `tools/gen_mockups.py` +
  `content/mockups3d/` (fundo da caixa), `content/SOURCES.md` e `tools/e2e/task08b.mjs`.
- Provas (vitest): `rotX=rotY=0` → só `front` visível; `rotY=+30` → `front` + uma lateral (com o sinal conferido para
  o eixo y para baixo do canvas); `rotX` negativo → `top` entra; ordem de pintura de trás para frente; brilho por face
  de 100/108/78 %.
- Effort sugerido: dev `high` (projeção e culling, com sinal de eixo fácil de errar); teste `medium`.

**TASK-08c — Foto própria + "🎯 Detectar superfície" (Sobel/Alpha) com 4 alças** (critério 4). ~350 linhas.
**Depende da 08a** (estúdio e alças).
- Reserva: `editor-web/src/mockup/surfaceDetector.ts` (novo), `editor-web/src/mockup/mockupStudio.ts`,
  `editor-web/test/surfaceDetector.test.ts` (novo), o bundle `editor/src/main/assets/editor/index.html` e
  `tools/e2e/task08c.mjs`. A foto própria entra por `bridge.request<BlobResult>('pickImage')`, que já existe (sem
  Kotlin).
- Provas (vitest): retângulo claro inclinado sobre fundo escuro (sem alfa) → 4 cantos a ≤ 3 px (na escala de 256) dos
  verdadeiros, na ordem TL, TR, BR, BL; recorte com alfa (forma opaca sobre transparente) → cantos do contorno α > 32;
  imagem lisa → fallback (quad central), nunca NaN.
- Effort sugerido: dev `medium` + ultrathink; teste `medium`.

### Plano de teste
(Para quando as tasks forem criadas; o planning de cada uma confere e copia a sua parte.)
- **Offline (sem slot):** `npx tsc --noEmit` e `npx vitest run test/mockupEngine.test.ts` (e os das 08b/08c) em
  `editor-web/`; `python tools/gen_mockups.py --3d <tmp>` gera um índice válido (quad convexo dentro da base, `shape`
  conhecido) e **não** toca `content/mockups/`.
- **T2 reprodução como o usuário (E2E, no slot):** `launchEditor()` (Novo design → Post Facebook), adicionar um título
  (Texto → Adicionar título) para a arte não ficar vazia → tocar a aba `📦 Mockup 3D` → escolher "Caneca" → sinal: o
  canvas do preview tem pixels da arte dentro do quad (via `evaluate` e `getImageData` no preview); mover o slider
  "Arco" de 110 para 170 → o hash dos pixels do preview muda e a largura útil da arte na linha central diminui nas
  bordas; mover "Fusão com dobras/luz" de 0 para 1 → a luminância média da arte dentro da faixa de dobra cai; "Inserir
  no design" → a página ganha 1 `FabricImage` (contagem de objetos +1), com `screencap` do aparelho. 08b: girar
  Rotação X/Y e conferir as faces visíveis (estado exposto) + print. 08c: uma imagem da galeria como base → "🎯
  Detectar superfície" → cantos dentro de ±5 % do objeto da foto de teste enviada por `adb push` para
  `/sdcard/Pictures/`; arrastar uma alça com `drag` e conferir o canto movido.
- **Controle positivo:** no APK da base, a aba `📦 Mockup 3D` não existe:
  `[...document.querySelectorAll('#tabs button')].some(b => b.textContent.includes('Mockup 3D'))` = `false`.
- **T3 regressão direcionada:** vitest inteiro; E2E `task12.mjs` e `task14.mjs` (abas e folhas vizinhas em `main.ts`);
  o fluxo Kotlin "Ver em mockup" e Home → Mockup continuam listando só os 4 planos (`MockupTest` no
  `testDebugUnitTest` do `build`, e a grade do `MockupScreen` com 4 itens embutidos).

### Sessoes seguintes
- dev: não se aplica nesta execução (bloqueado). Para as tasks propostas: 08a `high` + ultrathink, 08b `high`, 08c
  `medium` + ultrathink (motivos acima).
- teste: `medium`, sem ultrathink, nas três (os sinais são objetivos, por CDP; classificar a falha não é sutil).

**O que destrava:** o dono aprovar (ou ajustar) a divisão 08a/08b/08c e criar as tasks em `docs/tasks/open/` (08b e
08c com `depende_de` 08a); depois cada uma entra no pipeline normalmente. Alternativa do dono: autorizar
explicitamente a TASK-08 inteira numa sessão só, acima do teto.
