# E2E: `task03.mjs` — a lupa do conta-gotas não aparece no arrasto por CDP (emulador `pp_api34`), 5 falhas e aborto

- **Origem:** achado lateral do teste da TASK-07 (pipeline 20261106-0749, rodada 1), na T3 dos E2E vizinhos.
  **Não pertinente à TASK-07:** as mesmas falhas, com os mesmos valores, acontecem com o APK da base `465e0c0`.
- **Aparelho:** emulador `emulator-5554` (AVD `pp_api34`), formato padrão "Post Facebook" 1080×1080.
- **Sintoma (base e fix iguais):** depois de entrar no modo conta-gotas (`.eyedropper-btn`) e arrastar com
  `touchStart`/`touchMove` (CDP `Input.dispatchTouchEvent`, `tools/e2e/task03.mjs` l.49–54):
  - `lupa 96 px visível acima do dedo` — `{"hidden":true,"bottom":0,"cx":0,"w":0}` (a `.eyedropper-holder` continua oculta);
  - `lupa mostra o #hex do pixel sob o dedo`, `soltar aplica exatamente a cor amostrada no texto` (texto fica `#111111`),
    `modo e paleta fecham; cor vai para as recentes` (recentes `["#111111","#e53935"]`), `botão 🎨 no "Preenchimento" da forma`;
  - o script aborta em `elemento não encontrado: [data-e2e=pal]`.
- **Onde olhar (hipótese NÃO verificada):** `editor-web/src/eyedropper.ts` escuta `pointerdown/pointermove/pointerup`
  (l.73, l.110–117) e mostra a lupa no `pointermove` com o dedo abaixado; ver se o toque sintético do CDP gera esses
  pointer events no WebView do emulador, ou se o modo/paleta não estava ativo no momento do arrasto. Pode ser do
  script E2E e não do app; reproduzir à mão no aparelho decide.
- **Evidência:** `C:\projects\sandbox\.bugfix-pipeline-product_photo_offline\evidencia\20261106-1005-task-07-filtros-efeitos-avancados-blend-modes-e-retoque-borda\`
  — `t3-task03\e2e.txt` (fix) e `base-task03\e2e.txt` (base), com os prints dos dois.
- **Reconfirmado** no teste da TASK-17 (pipeline 20261106-0749, rodada 1), mesmo emulador: os mesmos 5 FAIL e o aborto
  em `[data-e2e=pal]`, com os mesmos valores, no APK da base `42bc4bc` (2 rodadas) e no do fix (3 rodadas). Evidência:
  `C:\projects\sandbox\.bugfix-pipeline-product_photo_offline\evidencia\20261106-1135-task-17-vinheta-borda-suave-e-desfoque-de-foco\`
  `t3-base\task03-r*.txt` e `t3-fix\task03*.txt`.
