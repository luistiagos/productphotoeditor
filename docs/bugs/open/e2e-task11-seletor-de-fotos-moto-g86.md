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
