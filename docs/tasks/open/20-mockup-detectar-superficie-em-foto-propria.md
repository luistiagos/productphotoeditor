# [TASK-20] Mockup em Foto Própria com "🎯 Detectar Superfície" (Sobel / Alpha)

> **Origem:** dividida da TASK-08 pelo dono em 2026-11-05 (§2.3 original "Detecção Automática de Superfície por Filtro
> Sobel" e critério 4; a "08c" do planning). **Depende da
> [TASK-08](08-mockup-25d-3d-cilindro-esfera-cubo-sobel-iluminacao.md)**: usa o estúdio e as 4 alças dela; só começa
> com a TASK-08 em `retest/`. Se as duas estiverem na mesma execução do pipeline, o planning põe a TASK-08 em
> `depende_de`. Independente da [TASK-19](19-mockup-caixa-3d-multi-face.md). Doc original:
> `git show cbf5f41:docs/tasks/open/08-mockup-25d-3d-cilindro-esfera-cubo-sobel-iluminacao.md`.

## Metadados e Esforço Mensurado

| Campo | Valor |
| :--- | :--- |
| **ID** | `TASK-20` |
| **Prioridade** | **Média-Alta (P1/P2)** |
| **Esforço Mensurado** | **Baixo a Médio** — **~1 a 1,5 dia útil (8h–11h / 3 Story Points)**; ~350 linhas novas estimadas (código + teste + E2E) |
| **Escopo** | Local (`editor-web` em TypeScript / Canvas 2D), sem Kotlin |
| **Referência Analisada (`com.desygner.ads`)** | `js_pretty/assets/module-create-DxNmnX1s.js` (L208880–L209115: `f$n`/`LAe`/`IGe`) — só referência de algoritmo |

### Detalhamento do Esforço por Subtarefa
1. **Detector automático de quadrilátero (`surfaceDetector.ts`: Sobel + Alpha, cantos extremos):** ~6h.
2. **Foto própria como base no estúdio e botão "🎯 Detectar superfície" com as 4 alças:** ~2h–3h.
3. **Testes Unitários (Vitest) e E2E:** ~1h–2h.

---

## 1. Contexto e Problema Atual

O mockup (mesmo depois da TASK-08) só aplica o design sobre os templates embutidos. O cliente quer aplicar o
anúncio/rótulo sobre **uma foto própria** (ex.: foto de um quadro, cartão, caixa ou frasco na mesa), com os 4 cantos
da superfície sugeridos automaticamente.

---

## 2. O que deve ser feito (Especificação Técnica Detalhada)

### 2.1. Detecção Automática de Superfície por Filtro Sobel (`detectSurfaceQuad`)
1. Redimensiona a imagem base para no máximo $256 \times 256$ em memória.
2. Se a imagem tiver canal Alpha recortado (produto isolado), encontra o contorno dos pixels com $\alpha > 32$.
3. Se a imagem for uma foto completa (sem transparência), calcula a magnitude do gradiente de bordas **Sobel 3×3**
   ($G = \sqrt{G_x^2 + G_y^2}$), aplica limiarização adaptativa (percentil 80 das bordas na região central) e encontra
   os 4 cantos extremos nas direções diagonais $(\pm 1, \pm 1)$ para sugerir o quadrilátero inicial `warpCorners`.
4. Imagem sem bordas úteis → *fallback* (quadrilátero central), nunca NaN.
5. O usuário ajusta finamente qualquer um dos 4 cantos arrastando as alças do estúdio (TASK-08).

### 2.2. Foto própria como base
- No estúdio, "Usar foto própria" abre a galeria (`bridge.request<BlobResult>('pickImage')`, que já existe) e usa a
  foto como base do mockup; "🎯 Detectar superfície" posiciona as 4 alças.

---

## 3. Arquivos a Criar / Modificar

| Arquivo | Ação | Descrição |
| :--- | :---: | :--- |
| `editor-web/src/mockup/surfaceDetector.ts` | **Criar** | `detectSurfaceQuad(imageData)` (Sobel + Alpha, cantos TL, TR, BR, BL). |
| `editor-web/src/mockup/mockupStudio.ts` | **Modificar** | "Usar foto própria" e "🎯 Detectar superfície". |
| `editor-web/test/surfaceDetector.test.ts` | **Criar** | Imagens sintéticas (retângulo inclinado, recorte com alfa, imagem lisa). |
| `tools/e2e/task20.mjs` | **Criar** | E2E no aparelho. |
| `editor/src/main/assets/editor/index.html` | **Regerar** | Bundle do editor. |

---

## 4. Critérios de Aceite e Verificação

- [ ] Ao importar uma foto qualquer como base de mockup, o botão **"🎯 Detectar superfície"** posiciona
  automaticamente os 4 cantos sobre o objeto principal usando Sobel/Alpha, permitindo ajuste manual das 4 alças.
- [ ] Foto sem objeto destacado não quebra: as alças vão para um quadrilátero central.
- [ ] `npx vitest run` e `npm run build` executam com 0 erros.

---

## Análise herdada — planning 20261105-1638 da TASK-08 (antes da divisão)

**Veredito daquele planning:** bloqueado por tamanho (TASK-08 inteira); esta parte foi separada pelo dono em
2026-11-05. O próximo planning confere a análise contra a base — a TASK-08 vai ter criado `editor-web/src/mockup/` e o
estúdio antes desta — em vez de refazê-la. As decisões comuns estão na seção "Decisões comuns" da TASK-08.
**Complexidade estimada:** média — processamento de imagem puro, testável no vitest sem DOM.
**Reserva prevista:** `editor-web/src/mockup/surfaceDetector.ts` (novo), `editor-web/src/mockup/mockupStudio.ts`,
`editor-web/test/surfaceDetector.test.ts` (novo), o bundle `editor/src/main/assets/editor/index.html` e
`tools/e2e/task20.mjs` (novo). A foto própria entra por `bridge.request<BlobResult>('pickImage')`, que já existe (sem Kotlin).

### Tarefas
- [ ] `surfaceDetector.ts` — vitest `test/surfaceDetector.test.ts`: retângulo claro inclinado sobre fundo escuro (sem
  alfa) → 4 cantos a ≤ 3 px (na escala de 256) dos verdadeiros, na ordem TL, TR, BR, BL; recorte com alfa (forma opaca
  sobre transparente) → cantos do contorno α > 32; imagem lisa → fallback (quad central), nunca NaN.
- [ ] Estúdio — "Usar foto própria" (`pickImage`) e "🎯 Detectar superfície".
- [ ] `tools/e2e/task20.mjs` — a T2 abaixo.

### Plano de teste
- **Offline (sem slot):** `npx tsc --noEmit` e `npx vitest run test/surfaceDetector.test.ts`.
- **T2 reprodução como o usuário (E2E, no slot):** uma foto de teste enviada por `adb push` para `/sdcard/Pictures/`
  como base → "🎯 Detectar superfície" → cantos dentro de ±5 % do objeto da foto; arrastar uma alça com `drag` e
  conferir o canto movido; print do aparelho.
- **Controle positivo:** no APK da base (com a TASK-08), o estúdio não tem "Detectar superfície".
- **T3 regressão direcionada:** `task08.mjs` (estúdio e alças) e vitest inteiro.

### Sessões seguintes (sugestão daquele planning)
- dev: effort medium + ultrathink.
- teste: effort medium, sem ultrathink.

---

## Planejamento (pipeline 20261106-0749, 2026-11-06)

**Veredito:** corrigir — detector puro (`surfaceDetector.ts`, Sobel/Alpha sobre pixels simples, testável no vitest) +
dois botões no estúdio da TASK-08 ("Usar foto própria" por `pickImage`, que já existe, e "🎯 Detectar superfície"),
tudo em `editor-web/`, sem Kotlin. **Depende da TASK-08 desta execução** (`depende_de`): o estúdio, as alças e
`editor-web/src/mockup/` nascem lá.
**Complexidade:** media — um módulo (`editor-web`), um arquivo novo de processamento de imagem + um fluxo de UI num
arquivo que a TASK-08 cria; nenhum formato de dados novo, nenhuma ponte nova.
**Severidade:** medio — funcionalidade nova ausente, com contorno (arrastar as 4 alças à mão, depois da TASK-08).
**Arquivos a alterar (reserva da onda):**
- `editor/src/main/assets/editor/index.html` — bundle regerado pelo `build`
- `editor-web/test/surfaceDetector.test.ts` (novo) — vitest do detector
- `tools/e2e/task20.mjs` (novo) — T2 no aparelho
- `editor-web/src/styles.css` — só se o estúdio precisar de estilo para os 2 botões/aviso (contingência; o bundle já
  separa as ondas de editor-web, reservar não custa nada)
- **Em pasta que só existe depois da TASK-08** (o `plan-done` recusa reservar caminho cuja pasta não existe na
  wt-planning — `pipeline.py::validate_plan`, `missing_dirs`): o dev faz `claim` ANTES da primeira edição:
  `python <helper> claim --bug task-20-mockup-detectar-superficie-em-foto-propria
  --file editor-web/src/mockup/surfaceDetector.ts --file editor-web/src/mockup/mockupStudio.ts`.
  A TASK-19 também mexe em `mockupStudio.ts` (outra onda, pelo bundle); não há dependência entre 19 e 20.

### Causa raiz (símbolos abertos: `arquivo::simbolo` — faz X; em erro, Y)
Item é task: "causa" = funcionalidade ausente. Base conferida: `80b97d7`.
- `editor-web/src/mockup/` — **não existe** na base; é criado pela TASK-08 (`mockupEngine.ts`, `mockupStudio.ts`). O
  contrato que esta task usa vem do plano da TASK-08 (seção "Planejamento (pipeline 20261106-0749)" dela), **ainda não
  é código**: `Pixels = {data: Uint8ClampedArray, width, height}`, `Quad = [Pt,Pt,Pt,Pt]` (TL,TR,BR,BL, px da base),
  `openMockupStudio(deps)` com `openSheet('📦 Mockup 3D', …, {tall:true})`, 4 `.mockup-handle`, malha de 16 pontos que
  segue o quad por homografia, estado só de leitura em `window.__mockupStudio` (ou `canvas.mockup-preview.dataset`).
  **O dev abre o `mockupStudio.ts` e o `mockupEngine.ts` que a TASK-08 deixou na base antes de escrever** (regra do
  dono); se divergirem deste resumo, vale o código, e o doc é corrigido.
- `editor-web/src/main.ts` l.1040/1324/1441 — `bridge.request<BlobResult>('pickImage')` já é chamado em 3 lugares
  (Substituir foto, e outros dois fluxos de galeria), sempre dentro de `run(...)`.
- `editor-web/src/protocol.ts::BlobResult` (l.141) — `{url, width, height, servedBy?}`.
- `editor/.../EditorSession.kt::pickImage` (l.191) — sem host → `BridgeException(UNSUPPORTED)`; nada escolhido →
  `CANCELLED` ("nenhuma imagem escolhida"); lê os bytes, `EditorAssets.decodeBytes(bytes, PICK_MAX_SIDE=2048)`;
  `IOException` → `INVALID` (SVG ou formato não suportado); grava **PNG** (`assets.putPng`, mantém alfa) e devolve
  `{url: assets.blobUrl(name), width, height}`. **Nenhuma mudança Kotlin.**
- `editor/.../EditorAssets.kt::blobUrl` (l.30) = `"$ORIGIN/blob/$name"`, `ORIGIN = https://appassets.androidplatform.net`
  (l.82) = a mesma origem do editor → desenhar a foto num canvas **não suja** o canvas; `getImageData` funciona.
- `editor-web/src/main.ts::run` (l.118) — **não exportado**: `setBusy` + `try/catch` → `toast(describe(e))`. O estúdio é
  outro módulo: usa `setBusy`/`toast` de `dom.ts` (l.78, l.87, exportados) e `BridgeRequestError` de `bridge.ts` (l.22;
  `code === 'cancelled'` → sem toast, só fecha o busy; outros códigos → `toast('Não foi possível abrir a foto: …')`).
- `editor-web/vite.config.ts` — `test.include: ['test/**/*.test.ts']`, `environment: 'node'`: **sem `ImageData`/canvas
  no vitest** → o detector recebe `Pixels` simples (o `ImageData` do navegador satisfaz o tipo).
- `tools/e2e/bug-editor-galeria-svg-pickimage.mjs` l.13–39 e l.93 — receita já provada de foto no seletor do sistema:
  `adb push` para `/sdcard/Pictures`, `content call --uri content://media/ --method scan_volume --arg
  external_primary`, `pickFirstPhoto` (uiautomator dump, `content-desc="Photo taken|Foto tirada"`, `input tap`), e
  limpeza `rm -f` + novo scan no `finally`.

### Provas (comando literal -> resultado)
- `ls editor-web/src/mockup` → "No such file or directory" (nasce na TASK-08).
- `grep -rn "pickImage\|BlobResult" editor-web/src --include=*.ts` → `main.ts:1040,1324,1441` (`pickImage`),
  `protocol.ts:141` (`BlobResult`).
- `grep -n "fun blobUrl\|ORIGIN" editor/src/main/kotlin/com/productphoto/editor/EditorAssets.kt` → l.30
  `"$ORIGIN/blob/$name"`, l.82 `https://${WebViewAssetLoader.DEFAULT_DOMAIN}`.
- `grep -n "environment\|include" editor-web/vite.config.ts` → `include: ['test/**/*.test.ts']`, `environment: 'node'`.
- `pipeline.py status` → `task-08-mockup-25d-...` **planejado** nesta execução (20261106-0749), ainda sem onda.

### Hipóteses descartadas (e por quê)
- **Mudança Kotlin para a foto própria**: `pickImage` já devolve URL de blob da mesma origem, até 2048 px, em PNG.
- **Canvas sujo pela foto da galeria** (como no catálogo HF): o blob é servido pelo asset loader na origem do editor.
- **Alfa perdido no caminho da galeria**: `putPng` grava PNG; um PNG recortado chega com alfa → o caminho Alpha é
  alcançável pelo usuário (o JPEG chega opaco → caminho Sobel).
- **Detector sobre `ImageData`/canvas**: o vitest roda em `node`; o detector é puro sobre `Pixels` e faz o próprio
  redimensionamento (média por área), então o redimensionamento também é testado.
- **Limiar só pelo percentil 80 da região central (como diz a §2.1)**: numa foto com o miolo liso o P80 central dá ~0 e
  todo ruído vira borda (o quad vai para os cantos da imagem). Limiar = `max(P80(G central), 0,25·P99(G global), ε)` —
  mantém o percentil 80 do doc e não colapsa; imagem lisa (G ≡ 0) não passa do `ε` → fallback.
- **Hough/ajuste de retas para cantos mais exatos**: fora da especificação (cantos extremos nas diagonais); o ajuste
  fino é pelas alças.
- **Persistir a foto própria como template**: a §2.2 não pede; a foto vale para a sessão do estúdio aberta.
- **Reusar `run` do `main.ts`**: não é exportado; exportá-lo arrastaria `main.ts` para a reserva sem ganho.

### Tarefas
- [ ] `claim` dos 2 caminhos em `editor-web/src/mockup/` (comando acima) — antes de editar; abrir o `mockupStudio.ts` e
  o `mockupEngine.ts` da base (TASK-08) inteiros.
- [ ] `editor-web/src/mockup/surfaceDetector.ts` (novo, puro, sem DOM) — `detectSurfaceQuad(px: Pixels): {quad: Quad,
  method: 'alpha'|'sobel'|'fallback'}`, quad em px da ENTRADA, ordem TL,TR,BR,BL. (1) `width<3 || height<3` → fallback;
  (2) reduz por média de área para lado maior ≤ 256 (RGB e α); (3) recorte = ≥ 1 % dos pixels com α ≤ 32 **e** ≥ 1 % com
  α > 32 → pontos = pixels com α > 32; senão (4) luminância, Sobel 3×3 `G = √(Gx²+Gy²)` no interior, limiar
  `max(P80(G na caixa central [¼..¾]²), 0,25·P99(G), 1e-6)`, pontos = `G > limiar` com ≥ 2 vizinhos-ponto no 3×3 (descarta
  pixel isolado) e fora de 2 px da moldura; (5) TL = argmin(x+y), BR = argmax(x+y), TR = argmax(x−y), BL = argmin(x−y)
  (empate → primeiro na varredura), reescala para a entrada; (6) fallback se < max(16, 0,1 % dos pixels) pontos, quad não
  convexo, área < 2 % ou > 90 % da imagem, ou qualquer coordenada não finita. Fallback = `[[.2w,.2h],[.8w,.2h],
  [.8w,.8h],[.2w,.8h]]`. Teste `editor-web/test/surfaceDetector.test.ts`:
  (a) 256×256, retângulo claro (220) 140×90 girado 15° no centro sobre fundo escuro (30), α=255 → `sobel`, cada canto
  ≤ 3 px do verdadeiro, na ordem TL,TR,BR,BL; (b) o mesmo em 1024×1024 → cantos ≤ 12 px (caminho de redução, saída na
  escala da entrada); (c) trapézio opaco sobre α=0 com o MESMO RGB do fundo (Sobel não acharia nada) → `alpha`, cantos
  ≤ 2 px; (d) imagem lisa (128) → `fallback` igual ao quad central, tudo `Number.isFinite`; (e) ruído uniforme com LCG de
  semente fixa → `fallback`, sem NaN; (f) 2×2 e 1×1 → `fallback`, não lança; (g) (a) + 1 pixel claro isolado perto do
  canto da imagem → cantos ainda ≤ 3 px.
- [ ] `editor-web/src/mockup/mockupStudio.ts` — botão "Usar foto própria": `setBusy('Abrindo foto')` →
  `bridge.request<BlobResult>('pickImage')` → carrega `r.url` como base do estúdio (template de sessão `{id:'own',
  name:'Foto própria', shape:'plane', width:r.width, height:r.height, quad: fallback central}` pelo mesmo caminho de
  carga de base que a TASK-08 usa), seleciona-o; `cancelled` → silêncio; outro erro → `toast`, estúdio intacto.
  Botão "🎯 Detectar superfície" (atua sobre a base corrente, qualquer que seja): desenha a base num canvas de lado ≤ 256,
  `getImageData` → `detectSurfaceQuad` → reescala para px da base → define o quad (as alças vão para os cantos, a malha
  volta ao plano do quad novo) → re-render do preview; `toast` "Superfície detectada" ou, no `fallback`, "Nenhuma
  superfície clara: ajuste as 4 alças". Erro de canvas/imagem → `toast`, sem lançar. Expor no estado de leitura do
  estúdio (`window.__mockupStudio` ou o que a TASK-08 tiver feito) o `detect: method` da última detecção e o id da base.
  Prova: E2E abaixo (o vitest cobre o detector; a UI só pelo aparelho).
- [ ] `tools/e2e/task20.mjs` — a T2 abaixo (modelo `task14.mjs`/`task08.mjs`, `reporter`; `pickFirstPhoto` e limpeza
  copiados de `bug-editor-galeria-svg-pickimage.mjs`).
- [ ] `npx tsc --noEmit` + `npx vitest run test/surfaceDetector.test.ts` → `build --bug <slug>` (background) →
  `claim` dos `editor/src/main/assets/editor/assets/index-<hash>.*` → commit `feat(editor): ... (TASK-20)` com o bundle.

### Plano de teste
- **Offline (sem slot):** em `editor-web/`: `npx tsc --noEmit`; `npx vitest run test/surfaceDetector.test.ts` (os 7
  casos acima) e `npx vitest run` inteiro.
- **T2 reprodução como o usuário (E2E, no slot):** o script gera as fotos no próprio WebView (`evaluate`: canvas
  1200×900, fundo escuro com gradiente vertical leve, retângulo claro 640×400 girado 12° centrado em (600,450) →
  `toDataURL('image/png')`), grava os bytes na pasta de evidência e faz `adb push` para
  `/sdcard/Pictures/e2e_task20_rect.png` + `scan_volume`. Caminho: `launchEditor()` (Novo design → Post Facebook) → Texto
  → "Adicionar título" → aba `📦 Mockup 3D` → "Usar foto própria" → seletor do sistema: tocar a 1ª foto
  (`pickFirstPhoto`) → esperar a base `own` carregada (estado do estúdio: largura 1200). Sinais: (1) "🎯 Detectar
  superfície" → `detect === 'sobel'` e os 4 cantos do quad a ≤ 5 % do lado maior (≤ 60 px da base) dos 4 cantos
  verdadeiros, na ordem TL,TR,BR,BL; as `.mockup-handle` na tela batem com o quad (posição do centro de cada alça
  convertida para px da base, ≤ 3 % de erro); `screencap`; (2) `drag` da alça TL por (+80, +60) px de tela → o canto TL
  do quad move > 20 px da base e os outros 3 não mudam; (3) o preview tem pixels da arte dentro do quad (diferença
  contra a base pura acima de um limiar, como na T2 da TASK-08); (4) "Inserir no design" → `editor.canvas.getObjects()`
  +1 e o novo é `FabricImage`; (5) foto lisa: `e2e_task20_flat.png` (800×600 cinza 128, enviada só agora, para ser a
  1ª do seletor) → reabrir o estúdio → "Usar foto própria" → 1ª foto → "🎯 Detectar superfície" → `detect ===
  'fallback'`, quad = central (0,2..0,8 de cada lado, ≤ 1 px), todas as coordenadas finitas, toast do fallback;
  `screencap`; (6) nenhuma linha `EXCEPTION` em `p.logs`. Limpeza no `finally`: `rm -f` das 2 fotos + `scan_volume`
  (o aparelho é do dono). Se o seletor não mostrar a foto como 1ª (aparelho com fotos mais novas), o script falha com
  mensagem clara — não é reprovação do código; anotar e repetir.
- **Controle positivo:** no APK da base (já com a TASK-08), abrir a aba `📦 Mockup 3D`:
  `[...document.querySelectorAll('#sheet button')].some(b => /Detectar superfície|Usar foto própria/.test(b.textContent))`
  = `false`.
- **T3 regressão direcionada:** vitest inteiro (inclui `mockupEngine.test.ts` da TASK-08); E2E `task08.mjs` (templates,
  alças, sliders, inserir/salvar continuam iguais); `testDebugUnitTest` do `build` (`MockupTest`: 4 planos — esta task
  não toca índice nenhum); T4 logcat do PID sem erro novo.

### Sessões seguintes
- dev: effort high, ultrathink sim — processamento de imagem com limiar/rejeição de outlier a calibrar contra testes e
  integração num `mockupStudio.ts` que ainda não existe hoje (ler o que a TASK-08 deixou e adaptar); ~350–450 linhas.
- teste: effort medium, ultrathink não — roteiro E2E definido, com o seletor do sistema já provado em outro script;
  sinais numéricos por `evaluate`.

### Nota do dev (pipeline 20261106-0749, 2026-11-06) — plano conferido contra a base `e290d05`
Símbolos abertos antes de escrever:
- `editor-web/src/mockup/mockupStudio.ts::openMockupStudio` (TASK-08 + TASK-19) — estado em closures (`tpl`, `quad`,
  `baseImage`, `basePreview` ≤ 512 px, `shape`); `choose(t)` carrega `contentUrl(t.file)` (`content.ts::contentUrl`
  devolve URL `https://` como está → serve o blob do `pickImage` sem mudança), põe `quad = t.quad`, `placeHandles()`,
  `schedule()`; em erro de carga: `toast(describe(e))` e retorna, `tpl` intacto. Estado de leitura:
  `window.__mockupStudio.state()` (`template`, `quad`, `baseWidth`, `renders`…) e `canvas.dataset.state`.
  `setBoxMode(on)` esconde alças e controles da superfície no modo Caixa 3D (`tpl.shape === 'box3d'`).
- `mockupEngine.ts` — `Pixels`, `Quad` (TL,TR,BR,BL), `isConvexQuad`, `ARC_DEFAULT`, `SHADING_DEFAULT`: batem com o resumo
  do plano.
- `dom.ts::setBusy/toast/button/h` exportados; `bridge.ts::BridgeRequestError.code`; `protocol.ts::BlobResult`.

Correções ao plano (vale esta versão):
1. **Filtro de ponto isolado:** "≥ 2 vizinhos-ponto no 3×3" NÃO descarta o pixel claro isolado do caso (g): o Sobel de
   um pixel isolado acende os 8 vizinhos dele (G = 2·Δ nos laterais, √2·Δ nas diagonais, acima de 0,25·P99), e cada um
   tem 2+ vizinhos no anel. Troca: **componentes conexos** (8-vizinhança) dos pontos; ficam só os componentes com
   tamanho ≥ max(12, 10 % do maior). Vale para os dois caminhos (alfa e Sobel).
2. **Detectar usa o `basePreview`** (a base já reduzida a ≤ 512 px pelo navegador, lida no `choose`) em vez de redesenhar
   a base num canvas novo: o detector reduz por média de área até 256 e o resultado é reescalado por
   `tpl.width / basePreview.width` (e o análogo vertical). Sem caminho novo de `SecurityError`.
3. **"🎯 Detectar superfície" fica escondido no modo Caixa 3D** (como as alças): lá o quad não é editável pelo usuário
   (vira o retângulo de encaixe da caixa). Em qualquer outra base (template 2.5D, plano ou foto própria) atua.
4. Cantos do caminho alfa usam o canto EXTERNO do pixel extremo (TL → (x, y), BR → (x+1, y+1)…), exato para forma
   alinhada; no Sobel, o centro do pixel (a borda Sobel tem 1 px de cada lado do degrau).

## Correcao (pipeline 20261106-0749, rodada 1)

**O que mudou** (`arquivo::simbolo`):
- `editor-web/src/mockup/surfaceDetector.ts` (novo, puro, sem DOM):
  - `detectSurfaceQuad(px) → {quad, method: 'alpha'|'sobel'|'fallback'}`, quad em px da entrada, ordem TL,TR,BR,BL.
    Recorte (≥ 1 % de α ≤ 32 e ≥ 1 % de α > 32) → pontos = α > 32, canto EXTERNO do pixel extremo; senão Sobel 3×3 na
    luminância, limiar `max(P80(G central [¼..¾]²), 0,25·P99(G), 1e-6)`, fora de 2 px da moldura, centro do pixel.
    Cantos = extremos nas diagonais (TL mín x+y, TR máx x−y, BR máx x+y, BL mín x−y).
  - Rejeição de ruído (desvio do plano, ver a Nota do dev): `dropSmallComponents` (componentes conexos 8-viz. menores que
    max(12, 10 % do maior) saem) e `edgeCoverage` (Sobel com bordas em > 75 % da grade 8×8 = textura → fallback).
    **Por quê o 2º:** o ruído uniforme do caso (e) passava como `sobel` com quad de 88 % da área (abaixo do teto de 90 %).
    Medido: ruído 0,95–0,98 da grade; retângulos dos testes 0,16–0,38.
  - Fallback = `centralQuad(w,h)` (0,2..0,8): imagem < 3 px, < max(16, 0,1 %) pontos, textura, quad não convexo
    (`mockupEngine::isConvexQuad`), área fora de 2 %..90 %, coordenada não finita.
  - `downscaleArea(px, 256)`: média por área (RGBA) até o lado maior ≤ 256; devolve a própria entrada se já cabe.
- `editor-web/src/mockup/mockupStudio.ts::openMockupStudio`:
  - `📷 Usar foto própria` (`.mockup-own`, acima da grade) → `useOwnPhoto`: `setBusy('Abrindo foto')` →
    `bridge.request<BlobResult>('pickImage')`; `BridgeRequestError` `cancelled` → silêncio; outro erro →
    `toast(describe(e))`, estúdio intacto. Sucesso → template de sessão `{id:'own', shape:'plane', file: r.url,
    quad: centralQuad}` pelo mesmo `choose` dos templates (agora devolve `boolean`; em falha de carga devolve o destaque
    do tile à base anterior).
  - `🎯 Detectar superfície` (`.mockup-detect`, 1ª linha dos controles; escondido no modo Caixa 3D, como as alças) →
    `detect`: `detectSurfaceQuad(basePreview)`, reescala por `tpl.width/basePreview.width` (e vertical), põe o quad,
    `placeHandles`, re-render; toast "Superfície detectada…" ou "Nenhuma superfície clara: ajuste as 4 alças". Erro →
    toast "Não foi possível analisar a foto", sem lançar.
  - Estado de leitura: `__mockupStudio.state().detect` = método da última detecção na base atual (null após `choose`).
  - **Foto recortada (com α):** `renderFull(kind)` — base opaca (templates, JPEG da galeria) continua JPEG 0,92; base com
    transparência: `insert` → PNG (o recorte vai transparente ao design), `save` → JPEG sobre branco (sem isso o
    transparente sairia preto). `baseOpaque` calculado no `choose` (`isOpaque(basePreview)`).
  - `HINT_SURFACE` cita o 🎯.
- `editor-web/src/styles.css`: `.mockup-own-row button { flex: 1; }`.
- `editor-web/test/surfaceDetector.test.ts` (novo, 14 casos): (a)/(a′) retângulo ±15° → sobel ≤ 3 px na ordem;
  (b) 1024² → ≤ 12 px; (b′) 1200×900 → ≤ 15 px (escalas x/y separadas); (c) trapézio com alfa e RGB igual ao fundo →
  alpha ≤ 2 px; (c′) o mesmo opaco → fallback; (d) liso → fallback = quad central; (e) ruído LCG → fallback, finito;
  (f) 2×2, 1×1, 0×0, 2×50 → fallback; (g) + pixel isolado → ainda ≤ 3 px; (h) fundo em gradiente → sobel ≤ 3 px;
  (i) objeto > 90 % → fallback; `downscaleArea` (média e identidade).
  **Mutação conferida:** sem o filtro de componentes (`MIN_COMPONENT=1`, `COMPONENT_FRAC=0`) o (g) falha (TL em
  (11,5;11,5)); sem o teste de textura (`TEXTURE_COVERAGE=2`) o (e) falha.
- `tools/e2e/task20.mjs` (novo): a T2 do plano + passo 5 (recorte PNG → `alpha`, inserir mantém α = 0 no canto).

**Provas offline (lane, `editor-web/`):** `npx tsc --noEmit` → 0 erros; `npx vitest run test/surfaceDetector.test.ts` →
14/14; `npx vitest run` → 34 arquivos, 413/413.

**Ajustes ao Plano de teste (T2, `tools/e2e/task20.mjs`):**
- O script gera as 3 fotos no WebView depois do `launchEditor` e faz `adb push` de cada uma só antes de escolhê-la (a mais
  nova é a 1ª do seletor): `e2e_task20_rect.png` (1200×900), `e2e_task20_flat.png` (800×600), `e2e_task20_cutout.png`
  (900×600, trapézio vermelho sobre transparente; largura diferente da lisa para a espera do passo 5 ver a troca de base). Limpeza no `finally` (`rm -f` + `scan_volume`).
- Arte = fundo azul `#1e50c8` + título (a receita do `task08.mjs`), para a arte se destacar da foto.
- Arrasto da alça TL: (+40, +30) px CSS (o do `task08.mjs`); (+80, +60) chega perto de virar o quad.
- Passo 3 (inserir): +1 imagem 1200×900 com `getSrc()` JPEG (foto opaca). Passo 5 (novo): recorte → `detect ===
  'alpha'`, cantos ≤ 45 px do trapézio, inserir → `getSrc()` PNG e α = 0 no pixel (1,1) da imagem inserida.
- Controle positivo: na base o script acha os botões ausentes, marca FAIL "ausentes (base sem a TASK-20)" e para.
- T3: vitest inteiro, `task08.mjs` e `task19.mjs` (o `mockupStudio.ts` é dos dois; a Caixa 3D esconde o 🎯).
