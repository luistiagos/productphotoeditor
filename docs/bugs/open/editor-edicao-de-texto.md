# [BUG] Editor: não dá para editar o texto adicionado

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

- [ ] `tools/e2e/bug-editor-edicao-de-texto.mjs` (novo; modelo `tools/e2e/task14.mjs`, driver `tools/e2e/cdp.mjs`) — roda
  a receita T2 abaixo e sai 1 se algum `check` falhar — prova: o script verde com o APK do main e com FAIL nos checks do
  toque longo/sheet com o APK do pai `953eb0e`.
- [ ] Este doc — seção `## Resultado (pipeline)` com o commit do script e o que a T2 mostrou.

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
