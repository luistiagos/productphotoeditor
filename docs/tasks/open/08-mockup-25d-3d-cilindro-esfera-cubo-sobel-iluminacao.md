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

