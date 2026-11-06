# E2E: `task11.mjs` não toca a 1ª foto no seletor de fotos do Moto g86 (troca de imagem falha 3 checagens)

- **Origem:** achado lateral do teste da TASK-13 (pipeline 20261105-1638, rodada 2), na T3 dos E2E vizinhos.
  **Não pertinente à TASK-13:** a mesma falha acontece com o APK da base `b35e837` (sem a TASK-13).
- **Aparelho:** Moto g86 5G (`adb-ZY32LMNN9B-..._adb-tls-connect._tcp`), seletor `com.google.android.photopicker`.
  No emulador (`pp_api34`) a TASK-05 registrou `task11` 25/25.
- **Sintoma:** `task11.mjs` 22/25 na base e no fix, com as mesmas falhas:
  `seletor de fotos do sistema abriu e a 1ª foto foi tocada` (picked = false), `a foto foi trocada` e
  `"Preencher o espaço": mesmo tamanho visual exato`. No fim, `topResumedActivity` =
  `com.google.android.photopicker/com.android.photopicker.MainActivity`: o seletor fica aberto por cima do app, e os
  E2E seguintes (`task12`, `task14`) falham ao abrir o editor ("Novo design" não apareceu) até alguém fechá-lo.
- **Onde:** `tools/e2e/task11.mjs` l.151–163: procura no `uiautomator dump` um nó com
  `content-desc="(Photo taken|Foto tirada)..."`. Hipótese **não verificada**: no photopicker do moto o rótulo das fotos
  é outro (ou a galeria do aparelho do dono não tem foto na 1ª posição com esse rótulo). Conferir com um dump do
  seletor aberto no moto.
- **Correção sugerida:** casar outros rótulos (ex.: `Photo`/`Foto`/`Imagem` + data) ou tocar o 1º item da grade pelo
  `resource-id`; quando nada casar, fechar o seletor (`KEYCODE_BACK`) antes de reportar a falha, para não travar os
  roteiros seguintes.
- **Evidência:** `C:\projects\sandbox\.bugfix-pipeline-product_photo_offline\evidencia\20261105-2200-task-13-r2\`
  `base-task11.txt`, `fix-task11.txt`, `fix-task12-tentativa1.txt`, `fix-task14-tentativa1.txt`,
  `fix-task11/apos-task11-estado.png`.

## Causa confirmada (teste da TASK-10, pipeline 20261105-1638, 2026-11-05 23:30)

- Dump do seletor aberto no Moto g86 (`uiautomator dump`): as fotos têm `content-desc="Item Foto criado em 5 de nov. de 2026 22:54"`
  (não `Photo taken`/`Foto tirada`) e `clickable="false"`. Com a regex ampliada para `Item Foto criado`, o toque **marca** a foto
  (aparece o contador `1`) e o seletor mostra `Visualizar` / `Concluir`: só volta ao app depois do toque em `Concluir`.
- Atinge também `tools/e2e/task09.mjs::pickFirstPhoto` (l.70–83, o script morre esperando a folha "Fundo" na l.146 porque o
  seletor ficou aberto) e `tools/e2e/bug-editor-galeria-svg-pickimage.mjs` (mesma regex). Mesma falha com o APK da base `2193b37`.
- Prova de que o ajuste basta: cópias temporárias com a regex ampliada + toque em `Concluir` → `task09` 26/26 (APK da TASK-10);
  em `task11` a troca de foto passa (as 7 falhas que sobram são de arrastar/inspetor, `e2e-arrastar-e-inspetor-moto-g86.md`).
- Correção sugerida: regex `(Photo taken|Foto tirada|Item Foto criado)` e, depois do toque, tocar `Concluir`/`Done` se aparecer;
  se nada casar, `KEYCODE_BACK`. Evidência: `evidencia\20261105-2330-task-10\t3\` (`task09.txt`, `_tmp_task09.mjs`,
  `_tmp_task11.mjs`, `task09-estado.png`) e `t3-base\_tmp_task09_base.txt`.

## Reincidência (teste da TASK-18, pipeline 20261106-0749, 2026-11-06 18:3x)

- Moto g86: `task11` 22/25 com o APK da base `9033756` e com o do fix (mesmas 3 checagens); `task09` travado no seletor
  na base (timeout da folha "Fundo", l.146) e no fix. Dump do seletor: `content-desc="Item Foto criado em 6 de nov. de 2026 18:21"`.
  Evidência: `evidencia\20261106-1318-task-18-retocar-recorte-pos-remocao-de-fundo\moto\r2\` (`base-task11.txt`, `fix-task11.txt`,
  `base-task09.txt`, `fix-task09.txt`).
