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
