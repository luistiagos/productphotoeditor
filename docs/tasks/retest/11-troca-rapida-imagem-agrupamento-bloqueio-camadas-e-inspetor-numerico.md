# [TASK-11] Troca Rápida de Imagem (Swap), Agrupamento (Group/Ungroup), Gestão Avançada de Camadas e Inspetor Numérico

## Metadados e Esforço Mensurado

| Campo | Valor |
| :--- | :--- |
| **ID** | `TASK-11` |
| **Prioridade** | **Alta (Quick Win de Produtividade — P1)** |
| **Esforço Mensurado** | **Baixo a Médio** — **~1,5 a 2 dias úteis (12h–16h / 3 Story Points)** |
| **Escopo** | 100% Local (`editor-web` em TypeScript / Fabric.js 7.4.0) |
| **Referência Analisada (`com.desygner.ads`)** | `extracted/assets/public/docs/create.md` (§ Replace an image L791, § Group and ungroup L199, § Lock an element L209, § Layers panel L188, § Exact position and size L891) |

### Detalhamento do Esforço por Subtarefa
1. **Troca Rápida de Imagem no Lugar (`swapImage` em `editor.ts` + UI em `imageProps`):** ~3h (preservação da caixa visual, ângulo, espelhamento, máscara/clip, sombra e filtros ao trocar a foto do produto).
2. **Agrupamento e Desagrupamento Hierárquico (`groupActive` / `ungroupActive`):** ~4h (conversão entre `ActiveSelection` e `Group` do Fabric 7 mantendo transformações compostas e serialização limpa no histórico).
3. **Painel de Camadas Avançado e Bloqueio Real (`showLayers`):** ~3h (cadeado `🔒`/`🔓` na lista de camadas, objetos travados com `selectable: false` para não interceptar toque no canvas, reordenação direta e renomeação).
4. **Inspetor de Posição, Tamanho e Ângulo Exatos (`showPositionSheet`) + Testes Unitários (Vitest):** ~3h.

---

## 1. Contexto e Problema Atual

Ao usar um template de anúncio pronto ou duplicar um anúncio vencedor para outro produto:
1. **Falta de botão "Substituir Imagem" para o usuário:** Em [`editor-web/src/editor.ts`](file:///c:/projects/sandbox/product_photo_offline/editor-web/src/editor.ts#L840-L853), existe o método `replaceImage(img, url)`, mas ele é usado **apenas internamente pelas rotinas de IA** (remover fundo, upscale, inpaint) assumindo a mesma proporção original. Na barra [`imageProps()`](file:///c:/projects/sandbox/product_photo_offline/editor-web/src/main.ts#L594-L616), o usuário não tem como tocar numa foto de um template e escolher **"🔄 Substituir foto"** da galeria mantendo o tamanho visual na tela, rotação, sombra e filtros.
2. **Sem Agrupar / Desagrupar (`Group` / `Ungroup`):** Quando o usuário monta um bloco de preço (ex.: retângulo de fundo + texto *"De R$ 199"* + texto *"Por R$ 99"* + selo de desconto), ele não consegue agrupar esses itens em um único objeto (`Group`) para movê-los ou redimensioná-los juntos sem perder o layout relativo. Tampouco consegue desagrupar um selo SVG complexo importado por [`addSvgFromUrl()`](file:///c:/projects/sandbox/product_photo_offline/editor-web/src/editor.ts#L353-L379) para editar uma parte interna.
3. **Limitação no Bloqueio de Camadas (`toggleLock`):** Em [`Editor.toggleLock()`](file:///c:/projects/sandbox/product_photo_offline/editor-web/src/editor.ts#L471-L478), travar um objeto apenas desativa `lockMovementX/Y`, mas o objeto **continua selecionável no toque** (`selectable: true`), roubando o clique de objetos que estão próximos ou abaixo dele. Além disso, [`showLayers()`](file:///c:/projects/sandbox/product_photo_offline/editor-web/src/main.ts#L983-L1042) mostra apenas o ícone de visibilidade (`👁`), sem botão de cadeado (`🔒`) nem botões de subir/descer camada.
4. **Sem Inspetor Numérico (`X, Y, L, A, °`):** Não há onde digitar valores exatos de largura/altura em pixels ou ângulo exato (ex.: `0°`, `45°`, `-15°`) para uma camada.

---

## 2. O que deve ser feito (Especificação Técnica Detalhada)

### 2.1. Troca Rápida de Imagem (`swapImage`)
Adicionar em [`editor-web/src/editor.ts`](file:///c:/projects/sandbox/product_photo_offline/editor-web/src/editor.ts) o método `swapImage(img: FabricImage, newUrl: string, fitMode: 'contain' | 'cover' = 'contain')`:

1. **Preservação do Slot Visual:**
   - Antes de trocar o `src`, capturar a caixa ocupada na página (`targetWidth = img.getScaledWidth()`, `targetHeight = img.getScaledHeight()`), o ponto central (`center = img.getCenterPoint()`), `angle`, `flipX`, `flipY`, `opacity`, `shadow`, `filters` e `clipPath`.
   - Carregar a nova imagem via `await img.setSrc(newUrl)` e zerar recortes antigos (`cropX: 0, cropY: 0, width: naturalWidth, height: naturalHeight`).
   - Se `fitMode === 'contain'` (ideal para fotos de produtos recortados): calcular `scale = Math.min(targetWidth / after.width, targetHeight / after.height)` e aplicar `scaleX = scaleY = scale`.
   - Se `fitMode === 'cover'` (ideal para fotos de cenário retangulares): calcular `scale = Math.max(targetWidth / after.width, targetHeight / after.height)` e ajustar `cropX`, `cropY`, `width` e `height` para preencher exatamente a mesma área (`targetWidth × targetHeight`) sem distorcer.
   - Restaurar `img.setPositionByOrigin(center, 'center', 'center')`, reaplicar `filters` e chamar `commit()`.
2. **UI em `imageProps()` (`main.ts`):**
   - Adicionar como primeiro botão de [`imageProps()`](file:///c:/projects/sandbox/product_photo_offline/editor-web/src/main.ts#L594-L608): **"🔄 Substituir"**, abrindo opções para escolher foto da galeria (`bridge.request('pickImage')`) ou inserir o logo do Brand Kit no lugar da imagem atual.

### 2.2. Agrupamento e Desagrupamento (`groupActive` / `ungroupActive`)
Implementar em [`editor-web/src/editor.ts`](file:///c:/projects/sandbox/product_photo_offline/editor-web/src/editor.ts):

1. **Agrupar Seleção Múltipla (`groupActive(): Group | undefined`):**
   - Quando `this.canvas.getActiveObject()` for uma `ActiveSelection` com $\ge 2$ objetos:
     - Obter os objetos na ordem de empilhamento do canvas (`objs`);
     - Descartar a `ActiveSelection` para restaurar as coordenadas absolutas no canvas;
     - Remover individualmente cada `obj` do canvas e instanciar `const group = new Group(objs, { originX: 'center', originY: 'center' })`;
     - Definir `layerName: 'Grupo'` (ou concatenar resumo), adicionar `group` ao canvas na posição de z-index do objeto mais alto, selecioná-lo e chamar `commit()`.
2. **Desagrupar (`ungroupActive(): FabricObject[]`):**
   - Quando o objeto ativo for instância de `Group`:
     - Extrair os filhos com `const items = group.removeAll()` (no Fabric 7, `removeAll()` já recalcula e aplica a matriz de transformação do grupo para coordenadas de cena em cada filho);
     - Remover `group` do canvas, inserir `items` de volta no mesmo índice z-index, criar uma `ActiveSelection(items, { canvas: this.canvas })` e chamar `commit()`.
3. **Botões na Barra de Propriedades (`renderProps`):**
   - Quando `o.type === 'activeSelection'`, exibir em destaque o botão **"🔗 Agrupar"**.
   - Quando `o instanceof Group`, exibir o botão **"🔓 Desagrupar"**.

### 2.3. Bloqueio Real no Canvas e Painel de Camadas Completo
1. **Aprimorar `toggleLock(target?: FabricObject)`:**
   - Além de `lockMovementX/Y`, `lockScalingX/Y`, `lockRotation` e `hasControls: !locked`, gravar a propriedade customizada `locked: boolean` (incluída em `CUSTOM_PROPERTIES` em [`document.ts`](file:///c:/projects/sandbox/product_photo_offline/editor-web/src/document.ts)).
   - Quando `locked === true`, se o usuário clicar fora ou travar pelo painel de camadas, definir `selectable: false, evented: false` para que toques no canvas **atravessem** a camada travada sem selecioná-la acidentalmente.
   - No `load()` e `restore()` de [`editor.ts`](file:///c:/projects/sandbox/product_photo_offline/editor-web/src/editor.ts), sincronizar `selectable: !o.get('locked')` e `evented: !o.get('locked')`.
2. **Evoluir `showLayers()` em [`main.ts`](file:///c:/projects/sandbox/product_photo_offline/editor-web/src/main.ts#L983-L1042):**
   - Para cada camada (exceto o `BACKGROUND_LAYER`):
     - Botão de cadeado `🔒` / `🔓` que alterna `editor.toggleLock(o)` mesmo quando o objeto está `selectable: false`;
     - Botões compactos `↑` (`bringObjectForward`) e `↓` (`sendObjectBackwards`) para reordenar camadas diretamente na lista;
     - Botão de visibilidade `👁` / `—`.

### 2.4. Inspetor de Posição, Tamanho e Ângulo Exatos (`showPositionSheet`)
Adicionar botão **"📏 Posição / Tamanho"** na barra de propriedades (`renderProps`) abrindo uma sheet com campos numéricos:
- **Posição:** `X (px)` e `Y (px)` (coordenadas do centro ou topo-esquerdo);
- **Dimensões:** `Largura (px)` e `Altura (px)` com checkbox `🔒 Manter proporção` (altera `scaleX` e `scaleY` proporcionalmente);
- **Rotação:** Slider + input numérico `Ângulo (°)` de `-180°` a `180°` com chips rápidos (`0°`, `-45°`, `-15°`, `+15°`, `+45°`, `90°`).

---

## 3. Arquivos a Criar / Modificar

| Arquivo | Ação | Descrição |
| :--- | :---: | :--- |
| [`editor-web/src/document.ts`](file:///c:/projects/sandbox/product_photo_offline/editor-web/src/document.ts) | **Modificar** | Adicionar `'locked'` em `CUSTOM_PROPERTIES`. |
| [`editor-web/src/editor.ts`](file:///c:/projects/sandbox/product_photo_offline/editor-web/src/editor.ts) | **Modificar** | Implementar `swapImage()`, `groupActive()`, `ungroupActive()`, `setExactGeometry()` e aprimorar `toggleLock(target)` com suporte a `locked` não-selecionável. |
| [`editor-web/src/main.ts`](file:///c:/projects/sandbox/product_photo_offline/editor-web/src/main.ts) | **Modificar** | Adicionar botões **"🔄 Substituir"** em `imageProps()`, **"🔗 Agrupar" / "🔓 Desagrupar"** e **"📏 Posição"** em `renderProps()`, e controles de cadeado/ordem em `showLayers()`. |
| [`editor-web/test/groupAndSwap.test.ts`](file:///c:/projects/sandbox/product_photo_offline/editor-web/test/groupAndSwap.test.ts) | **Criar** | Testes unitários validando cálculo de escala `contain`/`cover` no `swapImage`, ciclo `groupActive` $\leftrightarrow$ `ungroupActive` preservando coordenadas, e persistência do estado `locked`. |

---

## 4. Critérios de Aceite e Verificação

- [x] Selecionar uma imagem e tocar em **"🔄 Substituir"** permite escolher outra foto mantendo a posição, rotação, sombra, filtros e tamanho visual da imagem anterior.
- [x] Selecionar 2 ou mais objetos permite tocar em **"🔗 Agrupar"**, transformando-os em um único `Group` que se move e redimensiona junto; tocar em **"🔓 Desagrupar"** devolve os objetos individuais nas posições exatas.
- [x] Travar uma camada no painel **"Camadas"** (`🔒`) impede que ela seja selecionada ou arrastada por engano no canvas, e permite destravá-la a qualquer momento pelo painel **"Camadas"**.
- [x] O painel **"📏 Posição / Tamanho"** permite definir largura, altura, coordenadas $(X, Y)$ e ângulo de rotação exatos com suporte a Undo/Redo.
- [x] `npx vitest run` e `npm run build` passam com 0 erros.


---

## 5. Registro da implementação (sessão 2026-11-05)

### 5.1. Etapa analítica — símbolos abertos
- `editor.ts::toggleLock()` — usa `lockMovementX` como estado; não mexe em `selectable/evented`.
- Fabric 7.4 `FabricObject.toObject` (dist/index.mjs L6573) serializa só a lista fixa + `customProperties`:
  **`selectable`, `evented`, `lockMovement*`, `hasControls` não vão para o JSON**. Consequências hoje: (a) "Travar" some ao
  salvar/reabrir e a cada undo/redo (`restore` → `loadFromJSON`); (b) a camada de fundo (`replaceBackgroundLayer` põe
  `selectable:false`) volta a ser selecionável depois de undo/reabrir. → `locked` em `CUSTOM_PROPERTIES` +
  `Editor.syncLocks()` depois de todo `loadFromJSON` (`load`, `restore`), que também reaplica o não-selecionável do fundo.
- Fabric `Group`: construtor → `groupInit` → `enterGroup(obj, false)` + layout inicial `fit-content` (filhos entram em
  coordenadas de cena e o grupo se posiciona na caixa deles). `removeAll()` → `remove(...)` → `_exitGroup(obj, undefined)`
  aplica `group.calcTransformMatrix() × obj` (L9364) → filhos voltam em coordenadas de cena. `ActiveSelection extends
  Group`: testar `instanceof ActiveSelection` antes de `instanceof Group`. Os objetos de uma `ActiveSelection` ficam
  relativos a ela: `discardActiveObject()` antes de removê-los do canvas.
- `FabricImage.setSrc` → `setElement` → `_setWidthHeight()` põe `width/height` = tamanho natural novo e **mantém
  `cropX/cropY` e escala** (já documentado em `imageGeometry.ts::rescaledGeometry`). O swap precisa zerar o crop.
- `editor.ts::replaceImage` (IA) mantém crop/escala por razão de tamanhos — não serve para trocar por outra foto.
- `main.ts::showImage` → `bridge.request<BlobResult>('pickImage')` (Kotlin `EditorScreen` → `PickVisualMedia`);
  logo do kit em `brandKit.logoUrl`; `brandkit.ts::applyBrandKit` troca `src` de quem tem `brandLogo === true` → o swap
  precisa limpar `brandLogo` (foto da galeria) ou pôr `true` (logo do kit).
- `main.ts::showLayers` usa `o.selectable` para rotular "(fundo)" → com o cadeado tirando `selectable`, o fundo passa a ser
  reconhecido por `layerName === 'background'`.

### 5.2. Hipóteses descartadas
- Guardar a trava só em `lockMovementX` (como hoje): descartada pelo achado da serialização.
- Largura/altura do inspetor por `getScaledWidth()`: inclui o contorno (`_getTransformedDimensions`), e definir
  `scaleX = W / width` não fecharia com o valor mostrado → usa `width × scaleX`.

### 5.3. O que fazer (tasks → prova)
1. `imageGeometry.ts::fitSlot(slotW, slotH, nw, nh, mode)` (contain/cover com crop centrado) + `Editor.swapImage` → teste
   unitário + E2E (galeria do emulador pelo seletor do sistema).
2. `Editor.groupActive/ungroupActive` → E2E: agrupa 3, move, desagrupa e confere as caixas.
3. `locked` + `toggleLock(target)` + `syncLocks` → E2E: travar pelas Camadas, toque no canvas atravessa, sobrevive a
   undo e a reabrir rascunho.
4. `Editor.geometryOf/setExactGeometry` + sheet "📏 Posição / Tamanho" → E2E com undo.

### 5.4. Feito
- `imageGeometry.ts::fitSlot`; `document.ts` `'locked'`; `editor.ts`: `swapImage(img, url, fitMode, {brandLogo})`,
  `groupActive`, `ungroupActive`, `moveLayer`, `toggleLock(target)`/`isLocked`/`applyLock`/`syncLocks` (chamado depois de
  `loadFromJSON` em `load` e `restore`), `geometryOf`, `setExactGeometry`.
- `main.ts`: "🔗 Agrupar" (seleção múltipla) / "🔓 Desagrupar" (Group, inclusive selo SVG) no topo da barra; "🔒 Travar"
  (some da seleção + toast); "📏 Posição / Tamanho" (`showPositionSheet`: X/Y, L/A com 🔒 proporção, ângulo, slider e
  chips 0/±15/±45/90); "🔄 Substituir" em `imageProps` (`showSwapImage`: Encaixe inteira/preencher, galeria, logo do
  kit); Camadas com 🔒/🔓, ↑, ↓ e 👁 por linha (fundo reconhecido por `layerName`).
- Desvio consciente: `groupActive/ungroupActive` não usam `withoutHistory` (é `async`; sem `await` o contador só volta
  num microtask e o `commit()` síncrono seguinte seria ignorado → sem entrada de undo). O debounce de 250 ms junta
  remover+inserir numa entrada só.

### 5.5. Provas (2026-11-05)
- `tsc` limpo; vitest **93/93** (novo `test/groupAndSwap.test.ts`: `fitSlot` contain/cover/largura; premissa do Fabric
  real (`fabric/node`): `new Group` com filhos em cena + mover o grupo + `removeAll()` devolve as caixas deslocadas e
  `group === undefined`; `locked` em `CUSTOM_PROPERTIES`).
- E2E no app real (emulador `pp_api34`): `node tools/e2e/task11.mjs <pasta>` → **25/25 PASS**: seleção de 3 pelas
  Camadas → Agrupar (1 Group "Grupo", 3 filhos); arrasto com o dedo move o grupo (desvio ≤ limiar do snapping da
  TASK-01); Desagrupar devolve as 3 caixas exatas com o mesmo deslocamento; undo volta o grupo; 🔒 nas Camadas →
  `selectable/evented=false`, toque atravessa e seleciona a foto embaixo, arrasto não move; trava sobrevive a undo/redo e a
  `load(toDocument())`; ↓/↑ reordenam; destravar volta a selecionar; inspetor: Largura 200 → 200×200, X/Y 100,120 exatos,
  chip +45°, sem proporção só a altura, undo desfaz a última; Substituir → seletor de fotos do Android → foto JPEG trocada
  com mesmo centro/rotação/opacidade/sombra/filtro e, em "Preencher", mesmo tamanho exato com `cropX = 240`.
- Achados do E2E (do teste, não do código): o arrasto do grupo diverge até 6 px de tela por causa do snapping;
  o toque num chip logo depois de digitar caía durante o fechamento do teclado (o teste espera `innerHeight` voltar).

### 5.6. Achado fora do escopo
- No seletor de fotos do Android aparecem os SVG de `Download/ProductPhoto/teste_fase4_*.svg`; escolher um deles em
  "Escolher da galeria…" (inserir ou substituir) termina no toast `Erro: Failed to create image decoder with message
  'unimplemented'Input contained an error.` (lado Kotlin do `pickImage`; não aberto nesta sessão). Registrado em
  `docs/bugs/open/editor-galeria-svg-pickimage.md`.
- Ambiente do E2E: `/sdcard/Pictures/e2e_swap.jpg` (cópia de `test_mug.jpg`) indexado por
  `content call --uri content://media/ --method scan_volume --arg external_primary`, para a 1ª foto do seletor ser JPEG.
