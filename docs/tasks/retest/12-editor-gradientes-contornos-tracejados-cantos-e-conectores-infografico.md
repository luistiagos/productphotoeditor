# [TASK-12] Editor de Gradientes Multi-Stop, Contornos Tracejados, Raio de Canto e Conectores de Infográfico ("Raio-X")

## Metadados e Esforço Mensurado

| Campo | Valor |
| :--- | :--- |
| **ID** | `TASK-12` |
| **Prioridade** | **Média-Alta (P1/P2)** |
| **Esforço Mensurado** | **Médio** — **~2 a 3 dias úteis (16h–22h / 5 Story Points)** |
| **Escopo** | 100% Local (`editor-web` em TypeScript / Fabric.js 7.4.0) |
| **Referência Analisada (`com.desygner.ads`)** | `extracted/assets/public/docs/create.md` (§ Gradients, shadows and strokes L239, § Gradient editor L681, § Stroke width, colour and dash L711, § Arrowheads and line caps L721, § Corner radius L731, § Swap a shape L741, § Add a line, divider or connector L152) |

### Detalhamento do Esforço por Subtarefa
1. **Editor de Gradientes Customizados (`gradients.ts` + UI para Fundo, Formas e Textos):** ~6h (gradientes lineares e radiais com 2 a 5 color stops, controle de ângulo $0^\circ\text{--}360^\circ$, presets comerciais e integração com Brand Kit).
2. **Estilos de Contorno Tracejado, Raio de Canto (`rx`/`ry`) e Swap de Forma:** ~4h (`strokeDashArray`, `strokeLineCap`, slider de arredondamento de cantos em retângulos e troca do tipo da forma mantendo estilo/posição).
3. **Linhas com Pontas de Seta e Conectores de Infográfico de Produto ("Raio-X" — `connectors.ts`):** ~6h (setas parametrizadas com início/fim configuráveis: seta, círculo, diamante, barra; mais templates de *Callout / Hotspot* com linha + bolinha + rótulo).
4. **Testes Unitários (Vitest) e Serialização no Documento:** ~2h.

---

## 1. Contexto e Problema Atual

No editor atual ([`editor-web/src/editor.ts`](file:///c:/projects/sandbox/product_photo_offline/editor-web/src/editor.ts) e [`editor-web/src/main.ts`](file:///c:/projects/sandbox/product_photo_offline/editor-web/src/main.ts)):
1. **Sem Editor de Gradiente Customizado:** Embora [`setBackgroundGradient()`](file:///c:/projects/sandbox/product_photo_offline/editor-web/src/editor.ts#L414-L431) exista para aplicar os presets estáticos do `content.backgrounds`, o usuário **não consegue escolher as próprias cores ou o ângulo do degradê** no fundo, e **não é possível aplicar preenchimento degradê (`Gradient`) em Formas ou Textos** (ex.: texto com efeito dourado metálico ou botão CTA com degradê vibrante).
2. **Contornos apenas contínuos e retângulos com canto fixo:** Na barra de propriedades de formas ([`main.ts`](file:///c:/projects/sandbox/product_photo_offline/editor-web/src/main.ts#L214-L223)), só há cor e espessura de contorno. Faltam **bordas tracejadas/pontilhadas** (`strokeDashArray` — essenciais para cupons *"Recorte aqui"* ou selos de oferta), controle de **arredondamento de cantos (`rx`/`ry`)** para transformar qualquer retângulo num botão pílula, e botão de **trocar forma (`Swap shape`)**.
3. **Sem Setas de Infográfico ("Raio-X do Produto"):** A forma `'line'` ([`editor.ts`](file:///c:/projects/sandbox/product_photo_offline/editor-web/src/editor.ts#L346)) é apenas um traço simples sem pontas, e `'arrow'` é um `Path` bloco grosso. Em anúncios de e-commerce (Mercado Livre, Shopee, Amazon), uma das técnicas que mais converte é o **Infográfico de Benefícios ("Raio-X")**: linhas finas com uma bolinha na ponta tocando o detalhe do produto (ex.: o solado de um tênis, a câmera de um celular, o tecido de uma camisa) e um texto indicando o diferencial técnico.

---

## 2. O que deve ser feito (Especificação Técnica Detalhada)

### 2.1. Editor de Gradientes Multi-Stop (`gradients.ts`)
Criar o módulo [`editor-web/src/gradients.ts`](file:///c:/projects/sandbox/product_photo_offline/editor-web/src/gradients.ts):

1. **Modelo de Dados (`GradientSpec`):**
   ```ts
   export interface GradientStop {
     offset: number; // 0..1
     color: string;  // #rrggbb
   }
   export interface GradientSpec {
     type: 'linear' | 'radial';
     angle: number; // 0..360 graus (para linear)
     stops: GradientStop[]; // 2 a 5 paradas
   }
   ```
2. **Construção de `Gradient` para Qualquer `FabricObject` ou Fundo:**
   - Função `buildFabricGradient(spec: GradientSpec, width: number, height: number): Gradient<'linear' | 'radial'>`:
     - Calcula coordenadas em pixels (`gradientUnits: 'pixels'`) centradas em `(width / 2, height / 2)` conforme o ângulo `spec.angle` (para linear) ou raio `Math.max(width, height) * 0.7` (para radial).
   - Função `applyObjectGradient(obj: FabricObject, spec: GradientSpec | null)`:
     - Aplica o `Gradient` no `fill` do objeto (funcionando em `Rect`, `Circle`, `Polygon`, `Path` e `Textbox`/`FabricText`) e grava `customGradient: spec` no objeto (adicionado em `CUSTOM_PROPERTIES`) para permitir reabrir o editor com os valores atuais e recriar as coordenadas caso `width`/`height` mudem.
3. **UI do Editor de Gradientes (`showGradientSheet`):**
   - Acessível via botão **"🌈 Degradê"** nas propriedades de Forma, Texto e na aba **Fundo**:
     - Toggle `Linear` / `Radial`;
     - Slider de `Ângulo (0° a 360°)` + botões de direção rápida (`↓ 90°`, `→ 0°`, `↘ 45°`, `↗ 315°`) + botão `⇄ Inverter cores`;
     - Lista de paradas de cor (2 a 5 stops), permitindo trocar a cor de cada parada, adicionar parada (`+ Cor`) ou remover;
     - **Presets Comerciais Rápidos:** *Ouro Metálico* (`#BF953F -> #FCF6BA -> #B38728`), *Oferta Fogo* (`#FF416C -> #FF4B2B`), *Neon Cyber*, *Preto Luxo*, e *Degradê da Marca* (gerado automaticamente com `brandKit.colors.primary` + `brandKit.colors.accent`).

### 2.2. Contornos Tracejados, Raio de Canto e Troca de Forma
Expandir as propriedades de Formas em [`editor-web/src/main.ts`](file:///c:/projects/sandbox/product_photo_offline/editor-web/src/main.ts#L214-L223) e [`editor-web/src/editor.ts`](file:///c:/projects/sandbox/product_photo_offline/editor-web/src/editor.ts):

1. **Estilo do Contorno (`strokeDashStyle`):**
   - Seletor rápido de estilo de borda:
     - `Sólida`: `strokeDashArray: undefined`;
     - `Tracejada (Cupom)`: `strokeDashArray: [strokeWidth * 3, strokeWidth * 2]`, `strokeLineCap: 'round'`;
     - `Pontilhada`: `strokeDashArray: [strokeWidth, strokeWidth * 2]`, `strokeLineCap: 'round'`.
2. **Raio de Canto (`Corner Radius`) em Retângulos:**
   - Quando o objeto selecionado for um `Rect`, exibir o slider **"Cantos"** (`0` até `Math.min(width, height) / 2`) que atualiza `rx` e `ry` simultaneamente (permitindo criar desde cantos levemente arredondados até botões 100% pílula).
3. **Troca Rápida de Forma (`swapShape(newKind: ShapeKind)`):**
   - Botão **"🔄 Trocar forma"** que substitui a forma selecionada por outra (`rect`, `rounded`, `circle`, `triangle`, `star`, `badge-hex`, `pill`) preservando `left`, `top`, dimensões escaladas, `angle`, `fill` (sólido ou gradiente), `stroke`, `strokeWidth`, `shadow` e `opacity`.

### 2.3. Linhas com Pontas de Seta e Conectores de Infográfico ("Raio-X" — `connectors.ts`)
Criar o módulo [`editor-web/src/connectors.ts`](file:///c:/projects/sandbox/product_photo_offline/editor-web/src/connectors.ts):

1. **Gerador de Linhas e Setas Paramétricas (`createConnectorSvg` / `Path`):**
   - Suporte a estilos de ponta inicial (`startCap`) e final (`endCap`):
     - `'none'` (sem ponta), `'arrow'` (seta triangular preenchida), `'open-arrow'` (seta em V), `'dot'` (círculo/ponto de ancoragem no produto), `'diamond'` (losango), `'bar'` (barra de cota/medida `|---|` ideal para indicar altura/largura em cm do produto!).
   - Suporte a formato de linha: **Reta**, **Cotovelo (90° L-shape)** para infográficos técnicos e **Curva Suave**.
2. **Templates de Callout / "Raio-X do Produto" (`addProductCallout`):**
   - Na aba **Formas** (ou nova seção **"📌 Infográfico / Raio-X"**), oferecer 4 blocos compostos prontos para apontar benefícios do produto:
     1. **Pino Característica:** Ponto circular com anel externo + linha em cotovelo + título editável (*"Aço Inox 304"*);
     2. **Cota de Medida (`|← 25 cm →|`):** Linha com barras nas duas pontas + texto centralizado indicando dimensão do produto;
     3. **Lupa de Detalhe (Zoom Callout):** Círculo com borda destacada + linha apontando para o detalhe;
     4. **Seta Curva Promocional:** Seta curva apontando para o preço ou botão de compra.

---

## 3. Arquivos a Criar / Modificar

| Arquivo | Ação | Descrição |
| :--- | :---: | :--- |
| [`editor-web/src/gradients.ts`](file:///c:/projects/sandbox/product_photo_offline/editor-web/src/gradients.ts) | **Criar** | Motor de gradientes lineares/radiais multi-stop, presets comerciais (Ouro, Oferta, Marca) e serialização `GradientSpec`. |
| [`editor-web/src/connectors.ts`](file:///c:/projects/sandbox/product_photo_offline/editor-web/src/connectors.ts) | **Criar** | Gerador de linhas com pontas configuráveis (seta, ponto, cota de medida `|---|`, cotovelo) e callouts de infográfico. |
| [`editor-web/src/document.ts`](file:///c:/projects/sandbox/product_photo_offline/editor-web/src/document.ts) | **Modificar** | Incluir `'customGradient'` e `'connectorSpec'` em `CUSTOM_PROPERTIES`. |
| [`editor-web/src/editor.ts`](file:///c:/projects/sandbox/product_photo_offline/editor-web/src/editor.ts) | **Modificar** | Adicionar `setObjectGradient()`, `setStrokeDash()`, `setCornerRadius()`, `swapShape()` e `addCallout()`. |
| [`editor-web/src/main.ts`](file:///c:/projects/sandbox/product_photo_offline/editor-web/src/main.ts) | **Modificar** | Integrar `showGradientSheet()` em Fundo, Formas e Textos; adicionar controles de tracejado, raio de canto e seção **"📌 Infográfico / Cotas"** em `showShapes()`. |
| [`editor-web/test/gradientsAndConnectors.test.ts`](file:///c:/projects/sandbox/product_photo_offline/editor-web/test/gradientsAndConnectors.test.ts) | **Criar** | Testes unitários validando cálculo trigonométrico das coordenadas do `Gradient`, geração de `strokeDashArray` e paths SVG dos conectores/cotas. |

---

## 4. Critérios de Aceite e Verificação

- [ ] O usuário consegue aplicar degradês lineares ou radiais com cores personalizadas e controle de ângulo ($0^\circ\text{--}360^\circ$) no Fundo da página, em Formas e em Textos (incluindo preset Ouro Metálico e Degradê da Marca).
- [ ] Ao selecionar uma forma, é possível alternar a borda entre sólida, tracejada e pontilhada, ajustar o raio dos cantos (`rx`/`ry`) em retângulos e trocar o formato geométrico sem perder cor/posição.
- [ ] Na aba **Formas**, o usuário pode inserir **Setas**, **Cotas de Medida (`|← cm →|`)** e **Pinos de Infográfico ("Raio-X")** para apontar detalhes e dimensões do produto.
- [ ] `npx vitest run` e `npm run build` passam com 0 erros.


---

## 5. Registro da implementação (sessão 2026-11-05)

### 5.1. Etapa analítica — símbolos abertos
- Fabric 7.4 `FabricObject._applyPatternGradientTransform` (dist/index.mjs L6133): com `gradientUnits: 'pixels'` translada
  `(-width/2 + offsetX, -height/2 + offsetY)` → **coords do degradê são relativas ao canto superior esquerdo do objeto, em
  unidades locais (`width`/`height` sem escala)**. Escalar o objeto não exige recalcular; mudar `width/height` exige.
  Texto: `FabricText.handleFiller` (L15983) usa o mesmo referencial (só usa padrão-canvas se houver `gradientTransform`).
- `editor.ts::setBackgroundGradient(colors, kind, angle)` — monta `Gradient` em pixels sobre um `Rect` da página
  (`replaceBackgroundLayer`); linear usa meia-largura × cos / meia-altura × sin, radial r = 0,75·max. `resize()` →
  `coverPage(bg)` muda `width/height` do Rect **sem refazer as coords** (degradê de fundo fica torto após mudar o formato).
- `editor.ts::set(props)` — em Group propaga `fill`/`stroke` string para filhos não brancos; não limpa nada além do pedido.
  `main.ts::renderProps` → ramo "forma" mostra `colorInput(String(o.fill))` → com degradê viraria `[object Object]`
  (`dom.ts::toHex` devolve `#000000` para não-string).
- `brandkit.ts::applyBrandKit` sobrescreve `fill` de quem tem `brandColor` → aplicar degradê precisa zerar `brandColor`.
- `palette.ts::collectColors` já lê paradas de degradê; `main.ts::textContrast` já devolve `null` para fill não-string.
- `editor.ts::addShape` (ShapeKind: rect, rounded, circle, triangle, line, star, arrow) — tudo centrado com
  `originX/Y: 'center'`. `selectMultiple(objs)` cria `ActiveSelection`. `groupActive/ungroupActive` (TASK-11).
- `document.ts::CUSTOM_PROPERTIES` → `FabricObject.customProperties` (editor.ts L50): a lista vale para filhos de Group.
- Edição de texto: `LongPress` só dispara com `target instanceof FabricText` → texto **dentro** de Group não se edita
  sem desagrupar.

### 5.2. Hipóteses descartadas
- Conector como um único `Path`: um Path tem um só fill/stroke; seta preenchida + linha tracejada não cabem → conector =
  `Group` de `Path`s (linha só contorno; pontas preenchidas ou contornadas) com `connectorSpec` no Group, refeito por
  `setConnector(spec)` mantendo centro/ângulo/escala.
- Callout como um Group com o texto dentro: o texto deixaria de abrir a edição por toque longo → as peças entram soltas
  (conector, anel/lupa, Textbox) e ficam **selecionadas juntas** (`ActiveSelection`); o usuário pode "🔗 Agrupar".
- Recalcular degradê a cada render: desnecessário; basta no `object:modified`/`text:changed` (Textbox muda `height`) e
  no `resize` do fundo, e só quando `fill` ainda for `Gradient` (`customGradient` pode ficar órfão após cor sólida → `set`
  com `fill` string zera `customGradient`).

### 5.3. O que fazer (tasks → prova)
1. `gradients.ts`: `GradientSpec`, `gradientCoords` (linear: meia-projeção `(|cos|·w + |sin|·h)/2` centrada; radial
   `0,7·max`), `buildFabricGradient`, `applyObjectGradient`, presets (Ouro, Oferta Fogo, Neon Cyber, Preto Luxo, Marca),
   `gradientCss` → vitest (trigonometria em 0/90/45°, radial, inversão, add/remove 2..5).
2. `editor.ts`: `setObjectGradient`, `setBackgroundGradientSpec` (e `setBackgroundGradient` passa a usá-la),
   refresh de coords; `setStrokeDash` + `dashArrayFor` (recalcula ao mudar espessura), `setCornerRadius` (Rect, clamp
   `min(w,h)/2`), `swapShape` (+ kinds `badge-hex`, `pill`), `addConnector/setConnector/addCallout` → vitest + E2E.
3. `connectors.ts`: `connectorGeometry(spec)` → `{ line, caps[] }` em SVG path (reta/cotovelo/curva; pontas none,
   arrow, open-arrow, dot, ring, diamond, bar) → vitest dos paths e tangentes.
4. `main.ts`: "🌈 Degradê" (forma, texto, Fundo), estilo de contorno, "Cantos", "🔄 Trocar forma", props do conector,
   seção "📌 Infográfico / Raio-X" em Formas → E2E `tools/e2e/task12.mjs` no `pp_api34`.

### 5.4. Feito
- `gradients.ts`: `GradientSpec` (**`kind`** em vez de `type`, ver desvio abaixo), `gradientCoords`, `normalizeSpec`,
  `buildFabricGradient`, `evenStops`, `reverseStops`, `addStop`/`removeStop` (2..5), `gradientCss`, `isGradientSpec`,
  `GRADIENT_PRESETS` (Ouro Metálico, Oferta Fogo, Neon Cyber, Preto Luxo) + `brandGradient` (primária → destaque/secundária).
- `connectors.ts`: `ConnectorSpec`, `connectorGeometry` (reta/cotovelo/curva; pontas none, arrow, open-arrow, dot, ring,
  diamond, bar; a linha recua sob a seta), `capPaths`, `dashArrayFor`, `swapEnds`, opções para os `<select>`.
- `document.ts`: `customGradient`, `strokeDashStyle`, `shapeKind`, `connectorSpec` em `CUSTOM_PROPERTIES`.
- `editor.ts`: `setObjectGradient`/`gradientOf`/`refreshGradient` (no `object:modified`, `text:changed`, `set()` e
  `resize` do fundo), `setBackgroundGradientSpec`/`backgroundGradient` (e `setBackgroundGradient` dos presets passa por
  ela — radial agora 0,7·max em vez de 0,75), `set()` zera `customGradient` ao receber cor sólida e refaz o tracejado ao
  mudar a espessura; `setStrokeDash`/`dashStyleOf`, `setCornerRadius`/`maxCornerRadius`, `shapeKindOf`/`swapShape`
  (+ kinds `pill` e `badge-hex`; `makeShape` compartilhado com `addShape`), `connectorOf`/`addConnector`/`setConnector`
  (refaz o Group mantendo os pontos na página mesmo girado/escalado, sem disparar `onSelection`), `addCallout`
  (`pin`, `dimension`, `zoom`, `curved-arrow`), `buildConnector` (Group de Paths).
- `main.ts`: "🌈 Degradê" em formas, textos e Fundo ("🌈 Degradê personalizado") → `showGradientSheet` (Linear/Radial,
  ângulo + ↓/→/↘/↗, ⇄ Inverter, paradas com cor/posição/✕, + Cor, presets, ✕ Remover); linha `shapeStyleRow` (Borda
  sólida/tracejada/pontilhada, Cantos em Rect, "🔄 Trocar forma" → `showSwapShape`); painel `connectorProps` (Início,
  Fim, Linha, ⇄ Inverter pontas, Cor, Espessura, Traço); Formas ganha Pílula, Hexágono e a seção "📌 Infográfico / Raio-X"
  (Seta fina, Seta curva, Linha cotovelo, Cota de medida, Pino característica, Lupa de detalhe).
- **Desvio consciente — `GradientSpec.kind` (a spec do doc pedia `type`)**: achado do E2E. `enlivenObjectEnlivables`
  (fabric dist L1658) revive todo valor de primeiro nível com `type` registrado; `'linear'`/`'radial'` são classes
  (`Gradient`) → depois de `load`/undo o `customGradient` voltava como um `Gradient` vazio. Teste de regressão em vitest
  prova a premissa (com `type` vira `Gradient`) e a correção.
- Blocos de infográfico entram como peças soltas e selecionadas juntas (ver §5.2), não como Group.

### 5.5. Provas (2026-11-05)
- `npx tsc --noEmit` limpo; `npx vitest run` **139/139** (novo `test/gradientsAndConnectors.test.ts`, 26 casos:
  coords 0/90/180/360/-90/45°, radial, Gradient real em pixels, sobrevivência a `toObject/fromObject`, revive do
  `customGradient` com `kind` vs `type`, inverter/+Cor/remover/normalizar, presets e Marca, CSS, tracejado, paths de
  reta/seta/cota/cotovelo/curva/pino/losango, premissa do Group de Paths no Fabric real, `CUSTOM_PROPERTIES`).
- E2E no app real (emulador `pp_api34`, `tools/e2e/rebuild.sh` + `node tools/e2e/task12.mjs <pasta>`) → **40/40 PASS**:
  Formas → Retângulo; 🌈 Degradê aplica linear; Ouro Metálico; chip 0° e slider 30° com coords exatas; **pixels do render**
  (borda escura, meio claro); +Cor/✕/cor da parada/⇄; Radial; sobrevive a `load(toDocument())`; reabrir mostra 3
  paradas; ✕ Remover → 1ª cor sólida; Borda tracejada [12,8] → espessura 10 → [30,20] → pontilhada [10,20]; Cantos no
  máximo = pílula; Trocar forma Rect→Círculo→Hexágono→Pílula com mesmo centro/tamanho/ângulo/pilha, degradê, tracejado e
  sombra; undo; texto com Ouro e coords refeitas ao crescer; Fundo Neon Cyber 315° e refeito ao virar 1080×1920; Seta
  fina → Início=Ponto com o grupo girado 30° sem mover início nem ponta; Cor/Espessura/Traço; Curva; ⇄ pontas; undo;
  4 blocos Raio-X; conectores sobrevivem a reabrir e seguem editáveis; texto do pino solto; sem exceção JS.
- Regressão: `task03.mjs` **19/19** e `task11.mjs` **25/25** depois das mudanças.
- Achados do E2E que eram do teste: undo antes do debounce de 250 ms; tocar durante o redesenho de 600 ms do painel do
  conector (depois da cor); a folha de degradê aberta durante um `load` guarda o objeto antigo (o teste fecha antes).
- Não coberto por E2E: o seletor nativo de cor/`<select>` do Android (o teste dá o valor por evento `input`/`change`),
  degradê em texto com Text Warp (TASK-02; o render deformado não foi verificado) e exportação SVG/vídeo de conectores.
