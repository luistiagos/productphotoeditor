# [BUG] Editor: não dá para editar o texto adicionado

## Status

**Corrigido e testado no pipeline 20261105-1638 (teste rodada 1, 2026-11-05) -> `retest/`.**

- **O que foi feito:** o fix de produto é o `6870bce` (já no `origin/main`; bundle regerado em `68ef4c2`/`0d616c3`):
  toque longo (500 ms) no texto abre a folha "Editar texto" com o texto todo selecionado e o teclado; botão
  "✏️ Editar texto" no painel; edição inline do Fabric desligada (`IText.ownDefaults.editable = false`); pistas (toast ao
  adicionar texto e texto-modelo "Toque e segure para editar o texto"). Esta rodada acrescentou a prova reproduzível:
  `tools/e2e/bug-editor-edicao-de-texto.mjs` (commit `2cb3f41`).
- **Aparelho:** `emulator-5554` (`sdk_gphone64_x86_64`, AVD `pp_api34`). O moto g86 (`ZY32LMNN9B`, adb-tls) estava
  `device` mas com a tela **bloqueada por PIN** (`isKeyguardShowing=true`, captura preta): o `launchEditor` não acha
  "Novo design" e não há como desbloquear sem o dono. O APK da base chegou a ser instalado nele (antes de ver o bloqueio)
  e foi trocado de volta pelo do main (`fix-2cb3f41.apk`); estado anterior em `aparelho-antes.txt`.
- **Evidência:** `C:\projects\sandbox\.bugfix-pipeline-product_photo_offline\evidencia\20261105-1708-editor-edicao-de-texto` (APKs `base-953eb0e.apk` / `fix-2cb3f41.apk`, sha256 do APK no aparelho conferido com o arquivo
  nos dois casos; `aparelho-*.txt`; logs dos builds).
  - **Controle positivo** (APK do pai do fix `953eb0e`, `base/saida.txt`, 4/16 ok, exit 1): FAIL no passo 1 (sem toast,
    sem "✏️ Editar texto"), no 2 (toque longo não abre folha; o teclado sobe pela edição inline escondida do Fabric —
    o sintoma do relato) e no 8 ("Toque duas vezes para editar o texto"). Os passos 3–7 caem em erro em cascata (sem
    folha não há o que aplicar; o "↶" da base volta ao documento vazio), não pelo sinal do passo 6 previsto no plano.
    Na base o formato se chama "Post quadrado · 1080×1080" (rodado com `E2E_FORMAT`; 1ª tentativa sem ele em
    `base-tentativa1-formato/`).
  - **T2** (APK do main, `fix/saida.txt` + prints): **23/23 PASS**, exit 0 — toast e botão; toque longo por CDP e
    por `adb shell input swipe` abrem a folha com "Título" selecionado 0..6, foco no textarea e `mInputShown=true`;
    Aplicar -> "Promo de Sexta"; "↶" -> "Título"; Cancelar e texto vazio ("Digite um texto", folha fica); dois toques
    não entram em edição inline (`mInputShown=false`); arrastar move sem abrir folha; texto-modelo novo; sem exceção JS.
    (1ª tentativa em `fix-tentativa1-uiautomator/`: o `uiautomator` devolveu "null root node" durante a animação da
    folha de formatos e o `launchEditor` desistiu; falha do driver, repetida sem mudança e passou.)
  - **T3:** `tools/e2e/task14.mjs` com o APK do main -> 50/50 (`t3-task14/saida.txt`); vitest 18 arquivos / 161
    testes e `testDebugUnitTest` 198 testes, 0 falhas, 0 erros (`build-fix.log`).
  - **T4:** logcat por PID (`base/`, `fix/`, `t3-task14/` `logcat.txt`, PIDs 8405 / 9118 / 9489): as linhas `E` do fix
    são as mesmas da base (finalizer `ai.onnxruntime.telemetry.HttpClient` "Receiver not registered",
    `variations_seed_loader` do WebView, OpenGLRenderer); nenhum `FATAL`/`AndroidRuntime`/ANR; nada novo atribuível.
- **Falta para `done/`:** validação do dono no aparelho dele (moto g86): toque longo no título abre a folha com
  teclado, aplicar/desfazer, e o 2º toque não abre mais a edição inline.

**Relato (2026-10-22):** ao criar/editar um design, "Texto" adiciona a caixa, mas não se sabe como mudar o texto.
Pedido: editar com **toque longo**.

## Reprodução (moto g86 5G, build debug instalado)

1. Home → Novo design → Post Facebook → Texto → Adicionar título. O texto entra **já selecionado**.
2. Um toque sobre o texto: o Fabric entra em edição, o teclado sobe (`dumpsys input_method` → `mInputShown=true`).
3. Com `windowSoftInputMode="adjustResize"` (`app/src/main/AndroidManifest.xml:25`) o WebView encolhe; o painel de
   propriedades e a barra inferior continuam visíveis e o canvas vira uma miniatura no topo. O cursor cai no ponto do
   toque (digitar "XYZ" deu "TítXYZulo"), sem nada selecionado e sem botão de concluir.

Conclusão: a edição **existe** mas é invisível (nenhuma pista na UI; o texto-modelo do corpo diz "Toque duas vezes",
que não é o gesto real) e, quando acontece, quase não se vê o que se digita.

## Símbolos abertos

- `editor-web/src/editor.ts::Editor.addText` — cria `Textbox` com texto-modelo e seleciona (`add` → `setActiveObject`).
- `editor-web/src/editor.ts::Editor` (construtor) — só liga eventos de seleção/modificação; nenhum gesto de texto.
- `editor-web/src/main.ts::textProps` — painel de texto: fonte, cor, tamanho, curva, "✨ Reescrever"; **nenhum** "editar".
- `editor-web/src/main.ts::setText` — `t.set({text})` + `refitCurve` + `setCoords` + `commit` (já usado pela IA).
- `editor-web/src/dom.ts::openSheet` — sheet modal; scrim fecha ao clicar.
- Fabric 7.4.0 `ITextClickBehavior.mouseUpHandler` — entra em edição no `mouseup` se `this.selected` (o objeto já
  estava selecionado no `mousedown`) e não houve `transform.actionPerformed` (micro-arrasto do dedo cancela).
- Fabric `ITextBehavior.selected` — `protected`; zerado em `onDeselect`/`exitEditingImpl`.
- Fabric `ITextBehavior.exitEditing` — dispara `editing:exited`/`text:editing:exited` **mesmo fora de edição**: só
  chamar com `isEditing`.
- Fabric `Canvas._onTouchStart` — registra `touchmove` no documento (vira `mouse:move`) e `touchend` (`mouse:up`);
  `stopContextMenu` = true por padrão (o long-press do Android não abre menu no canvas).

## Hipóteses descartadas

- "Edição do Fabric quebrada no WebView": descartada no aparelho — entra em edição e o teclado abre.
- Focar o campo no disparo do timer do toque longo: o dedo ainda está no vidro, não há ativação de usuário (só
  `pointerup`/`touchend` dão), e o Chrome Android pode focar sem abrir o teclado. Foco vai para o soltar do dedo.

## O que fazer

1. `editor-web/src/longPress.ts` (novo): detector puro (timer 500 ms, tolerância 10 px, cancela em mover/soltar).
   Teste: `editor-web/test/longPress.test.ts` com timers falsos.
2. `Editor` (construtor): liga `mouse:down/move/up` ao detector; no disparo, se o alvo for `FabricText`, sai da edição
   inline, zera `selected` (senão o `mouseup` reabre a edição do Fabric e rouba o foco) e chama `onEditText`.
3. `main.ts::showEditText`: sheet "Editar texto" com `<textarea>` (texto todo selecionado), "Cancelar"/"Aplicar"
   via `setText`; texto vazio não é aplicado. Botão "✏️ Editar texto" em `textProps`.
4. Pistas: texto-modelo do corpo "Toque e segure para editar o texto"; toast ao adicionar texto.
5. Verificar no aparelho: toque longo abre a sheet com teclado; aplicar muda o texto; desfazer volta.

## Resultado (2026-10-22, implementado, sem commit)

- `npx vitest run` → 12 arquivos, 51 testes verdes (5 novos em `longPress.test.ts`); `npm run build` ok (tsc + vite).
- `isEditing`/`exitEditing` só existem em `IText` (o `tsc` recusou em `FabricText`): o disparo testa `instanceof IText`.
- No moto g86 (`./gradlew :app:installDebug`), via `adb shell input`:
  - `swipe 560 990 560 990 900` (toque longo no título) → sheet "Editar texto", texto todo selecionado,
    `mInputShown=true`; o soltar do dedo não fechou a sheet nem abriu a edição inline do Fabric.
  - digitar "Promo de Sexta" + Aplicar → canvas atualizado, caixa reajustada (2 linhas); Desfazer → "Título".
  - botão "✏️ Editar texto" → sheet com teclado; Cancelar → texto intacto.
  - arrastar o texto devagar (`swipe ... 900` de 213 px) → só move, não abre a edição.
- Edição inline do Fabric (2º toque) **desligada** a pedido do dono: `IText.ownDefaults.editable = false` em
  `editor.ts` (o construtor do `IText` lê `IText.ownDefaults`, vale para `Textbox`; `editable` não vai para o JSON e
  nenhum template o define). Sem ela, o zerar de `selected`/`exitEditing` no toque longo saiu. No aparelho: dois
  toques no título selecionado → `mInputShown=false`; toque longo em seguida → sheet com `mInputShown=true`.

## Planejamento (pipeline 20261105-1638, 2026-11-05)

**Veredito:** corrigir — o fix de produto JÁ ESTÁ no `origin/main` (commit `6870bce`; o bundle com ele foi regerado
depois, em `68ef4c2`/`0d616c3`); falta a prova reproduzível: o E2E `tools/e2e/bug-editor-edicao-de-texto.mjs` e a T2 no
aparelho pelo pipeline, para o doc ir a `retest/`. O dev NÃO mexe em `editor-web/` se o E2E passar.
**Complexidade:** baixa — 1 arquivo novo (script E2E), nenhuma mudança de produto prevista.
**Severidade:** medio — editar o texto é fluxo principal do editor, mas havia contorno (2º toque no texto selecionado
abria a edição inline do Fabric), só que invisível e com o canvas reduzido a miniatura.
**Arquivos a alterar (reserva da onda):**
- `tools/e2e/bug-editor-edicao-de-texto.mjs` — novo: E2E do toque longo / botão "✏️ Editar texto" / sheet (receita T2).

Se a T2 falhar no APK do main e exigir mudança em `editor-web/src/editor.ts` ou `editor-web/src/main.ts`, o dev faz
`claim` desses arquivos E de `editor/src/main/assets/editor/index.html` (o bundle; manual, seção Planning) e corrige
este doc com o novo achado. Sem mudança em `editor-web/`: se o `build` regerar o bundle de verdade, NÃO commitar o
bundle (manual, seção Dev).

### Causa raiz (símbolos abertos: `arquivo::simbolo` — faz X; em erro, Y)

Causa original (relato de 2026-10-22, acima): a edição inline do Fabric só abria no 2º toque, sem pista na UI, e com
`adjustResize` o canvas virava miniatura. O fix já aplicado, conferido símbolo a símbolo no main (`0d616c3`):

- `editor-web/src/longPress.ts::LongPress` — `down` arma `setTimeout(delay=500)` e guarda a origem; `move` cancela se
  `hypot > slop (10)`; `cancel` limpa timer e origem; o disparo chama `cancel()` antes de `fire(target)` (dispara uma
  vez). Sem caminho de erro (não lança).
- `editor-web/src/editor.ts` (topo, linha 70) — `IText.ownDefaults = { ...IText.ownDefaults, editable: false }`: desliga
  a edição inline de todo `IText`/`Textbox`, inclusive os recriados pelo undo (o construtor lê `ownDefaults`).
- `editor-web/src/editor.ts::Editor` (construtor, linhas 179-185) — `mouse:down` com `target instanceof FabricText`, fora
  de `isDrawingMode` e de `cropState`, chama `longPress.down(target, viewportPoint)`; `mouse:move` -> `move`;
  `mouse:up` -> `cancel`. Disparo -> `this.onEditText(t)` (campo, padrão no-op, linha 103).
- `editor-web/src/editor.ts::Editor.addText` (linha 333) — texto-modelo do corpo: "Toque e segure para editar o texto".
- `editor-web/src/main.ts` (linha 201) — `editor.onEditText = (t) => showEditText(t, true)`.
- `editor-web/src/main.ts::textProps` (linha 558) — 1º botão do painel de texto: "✏️ Editar texto" -> `showEditText(t, false)`.
- `editor-web/src/main.ts::showEditText` (linha 729) — `openSheet('Editar texto', textarea + Cancelar/Aplicar)`; `apply`:
  texto só com espaço -> `toast('Digite um texto')` e a sheet fica; texto igual -> só fecha; diferente -> `setText` e
  fecha. Vindo do toque longo, o foco (`focus()` + `select()`) espera o 1º `pointerup`/`touchend` do documento.
- `editor-web/src/main.ts::setText` — `t.set({text})`, `refitCurve`, `refreshGradient`, `setCoords`, render,
  `editor.commit()` (entra no undo).
- `editor-web/src/main.ts::showText` (linha 1152) — ao adicionar texto: `toast('Toque e segure o texto para editar')`.
- `editor-web/src/dom.ts::openSheet` — scrim com `onclick: close`; o ✕ fecha; devolve `close`.

### Provas (comando literal -> resultado)

- `git log --oneline -- editor-web/src/longPress.ts` -> `6870bce fix(editor): edita texto com toque longo ou botão, num
  campo acima do teclado`.
- `git show --stat 6870bce` -> 5 arquivos (doc, `editor.ts`, `longPress.ts`, `main.ts`, `longPress.test.ts`); o bundle
  NÃO entrou nesse commit.
- `grep -o "<string>" editor/src/main/assets/editor/assets/index-DMqPIeH-.js | wc -l` -> "Toque e segure o texto para
  editar" 1, "Toque e segure para editar o texto" 1, `editable:!1` 1, "Editar texto" 2: o fix chegou ao app.
- `npx vitest run test/longPress.test.ts` (em `editor-web/`) -> 1 arquivo, 5 testes, todos passam.
- `npx tsc --noEmit` (em `editor-web/`) -> sem erro.
- `git show 6870bce -- editor-web/src editor-web/test | git apply --check -R` -> `patch failed: editor-web/src/editor.ts:3`
  (o revert não aplica limpo no main; o controle positivo usa o pai do fix, abaixo).
- `git diff 953eb0e HEAD -- "*.kt" "*.kts" | grep "@Database\|versionCode"` -> só `versionCode = 4` (igual nos dois): sem
  mudança de schema/versão, o APK do pai do fix instala por cima com `-r -d` sem migração.
- Script python que percorre os 12 JSON de `app/src/main/assets/content/` -> 0 textos dentro de `Group`: o toque longo
  (que exige `target instanceof FabricText`) alcança todo texto de template.

### Hipóteses descartadas (e por quê)

- "Falta implementar o fix": descartada — `6870bce` está no `origin/main` e o bundle versionado contém as strings e o
  `editable:!1` (provas acima). O doc só ficou em `open/` porque nunca passou por teste.
- "Reverter o fix na lane para o controle positivo": o `git apply -R` falha em `editor.ts` (commits posteriores). Usar o
  build do pai `953eb0e` (mesmo `versionCode`, sem mudança de banco).
- "Texto agrupado fica sem edição": nenhum template agrupa texto; grupo feito pelo usuário é caso de borda que já não
  tinha edição inline antes — fora do escopo, não aberto como bug.

### Tarefas

- [x] `tools/e2e/bug-editor-edicao-de-texto.mjs` (novo; modelo `tools/e2e/task14.mjs`, driver `tools/e2e/cdp.mjs`) — roda
  a receita T2 abaixo e sai 1 se algum `check` falhar — prova: o script verde com o APK do main e com FAIL nos checks do
  toque longo/sheet com o APK do pai `953eb0e`.
- [x] Este doc — seção `## Resultado (pipeline)` com o commit do script e o que a T2 mostrou.

### Plano de teste

- **Offline (sem slot):** `npx vitest run test/longPress.test.ts` (5 verdes) e `npx tsc --noEmit` em `editor-web/`;
  `node --check tools/e2e/bug-editor-edicao-de-texto.mjs`.
- **T2 reprodução como o usuário (E2E, no slot):** `node tools/e2e/bug-editor-edicao-de-texto.mjs <pasta>` com cwd na
  lane. `launchEditor()` (Home -> Novo design -> Post Facebook) e, como o usuário fez:
  1. Aba "Texto" (`#tabs button` "Texto") -> "Adicionar título". SINAL: `#toast` visível com "Toque e segure o texto
     para editar"; `editor.active.text === 'Título'`; `#props` tem o botão "✏️ Editar texto". Print.
  2. **Toque longo** no título: centro do objeto em CSS px = retângulo do `<canvas>` superior do Fabric +
     `getCenterPoint()` transformado por `editor.canvas.viewportTransform`; `p.touch('touchStart')`, ~900 ms parado,
     `p.touch('touchEnd')`. SINAL: `#sheet.show` com título "Editar texto"; `#sheet textarea` com valor "Título",
     `selectionStart === 0` e `selectionEnd === 6`; `document.activeElement` é o textarea depois do soltar;
     `adb shell dumpsys input_method` contém `mInputShown=true`. Print (teclado aberto, sheet acima dele).
     Complemento (gesto do sistema, não substitui): repetir com `adb shell input swipe X Y X Y 900` em px do aparelho
     (CSS px × `devicePixelRatio` + deslocamento do WebView na tela), mesmo sinal.
  3. Valor "Promo de Sexta" no textarea (evento `input`, como o `typeInto` do task14) -> "Aplicar". SINAL: sheet
     fechada, `editor.active.text === 'Promo de Sexta'`. Print do canvas.
  4. "↶" (esperar 400 ms do debounce antes, como o `undo` do task14). SINAL: o texto volta a "Título".
  5. Botão "✏️ Editar texto" -> "Cancelar". SINAL: texto intacto, sheet fechada. De novo o botão, textarea com "   " ->
     "Aplicar": `#toast` "Digite um texto", sheet continua aberta, texto intacto.
  6. Dois toques no título já selecionado. SINAL: `editor.active.isEditing === false`, nenhuma sheet,
     `mInputShown=false` (edição inline do Fabric desligada).
  7. Arrastar o título ~200 px devagar (`p.drag`, sem pausa antes de mover). SINAL: `left`/`top` mudou e NENHUMA sheet
     abriu.
  8. "Texto" -> "Adicionar texto". SINAL: `editor.active.text === 'Toque e segure para editar o texto'`.
  Evidência: saída do script, prints, logcat do PID.
- **Controle positivo:** o `main` sincronizado JÁ TEM o fix, então a base não mostra o sintoma. Em vez dela, na lane:
  `git checkout --detach 953eb0e` (pai do `6870bce`), `build --bug editor-edicao-de-texto` (background), copiar o APK
  como `base-953eb0e.apk`, voltar à branch (restaurar o bundle e apagar `index-<hash>.*` novos se o build sujou),
  instalar com `adb install -r -d -t`. O mesmo script TEM que dar FAIL nos passos 1 (sem toast, sem botão), 2 (toque
  longo não abre sheet), 6 (`isEditing === true` e `mInputShown=true`: a edição inline escondida do relato) e 8 (texto
  "Toque duas vezes..."). Depois reinstalar o APK do fix.
- **T3 regressão direcionada:** `tools/e2e/task14.mjs` (usa "✏️ Editar texto" + `#sheet textarea` + "Aplicar") com o
  APK do fix; vitest completo e testes de unidade do `build` sem `fail` novo; logcat do PID sem
  `FATAL`/`AndroidRuntime`/exceção de console do WebView na janela do teste.

### Sessões seguintes

- dev: effort medium, ultrathink não — escrever um script E2E sobre um driver pronto, sem mudar produto; a parte que
  pede cuidado (coordenada do objeto no canvas -> CSS px) é mecânica.
- teste: effort medium, ultrathink não — rodar o script em dois APKs (pai do fix e main) e conferir sinais objetivos; o
  único desvio é o controle positivo pelo `953eb0e` em vez da base.

## Correcao (pipeline 20261105-1638, rodada 1)

Sem mudança de produto (o fix `6870bce` já está no main, como o Planejamento previu). O que esta rodada acrescenta:

- `tools/e2e/bug-editor-edicao-de-texto.mjs` (novo) — roda a receita T2 do Plano de teste, passos 1–8 e o complemento
  2b (toque longo por `adb shell input swipe`, em px do aparelho = bounds do `android.webkit.WebView` no uiautomator +
  CSS px × `devicePixelRatio`; se o WebView não aparecer no dump, imprime `SKIP` e o passo 3 reabre a folha pelo CDP).
  Cada passo roda num `try` próprio: no APK sem o fix o script termina (com FAIL) em vez de parar no 1º elemento ausente.
  Sai 1 se algum `check` falhar.
- Ajustes ao Plano de teste (descobertos ao abrir o código do `953eb0e`):
  - o pai do fix NÃO expõe `window.editor` (só `window.ppEditor.editor`; o `window.editor` entrou em `68ef4c2`) nem
    `Editor.docToClient`: o script faz `globalThis.editor ??= ppEditor.editor` e calcula o centro do texto pelo
    `upperCanvasEl.getBoundingClientRect()` + `viewportTransform`, então roda igual nos dois APKs.
  - o texto é localizado como o 1º objeto com `text` (documento novo por `editor.newDocument`, como o task14), não por
    `editor.active`, porque o undo recria os objetos e tira a seleção; o passo 5 reseleciona com um toque real.
- Provas offline: `node --check tools/e2e/bug-editor-edicao-de-texto.mjs` -> ok; `npx vitest run test/longPress.test.ts`
  -> 5/5; `npx tsc --noEmit` -> sem erro. `build --bug editor-edicao-de-texto` -> exit 0 (vitest + `:app:assembleDebug
  testDebugUnitTest`, BUILD SUCCESSFUL); o bundle `editor/src/main/assets/editor/` ficou igual ao commitado (lane limpa).

## Teste rodada 1 — aprovado (pipeline 20261105-1638)

Ver `## Status` no topo. Resumo: controle positivo pelo APK de `953eb0e` com FAIL nos passos 1, 2 e 8; T2 23/23 com o
APK do main; T3 task14 50/50, vitest 161/161, unit 198/0; T4 sem erro novo. Aparelho: emulador (o moto estava
bloqueado por PIN).
