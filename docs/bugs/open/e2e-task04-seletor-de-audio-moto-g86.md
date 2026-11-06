# E2E: `task04.mjs` para no seletor de áudio do sistema no Moto g86 ("Show roots" não aparece)

- **Origem:** achado lateral do teste da TASK-10 (pipeline 20261105-1638, rodada 1), na T3. **Não pertinente à TASK-10:** a mesma
  parada acontece com o APK da base `2193b37`.
- **Aparelho:** Moto g86 5G (`adb-ZY32LMNN9B-6mRvcH._adb-tls-connect._tcp`), sistema em português.
- **Sintoma:** 15 checks passam (animação, preview, trilhas do APK, volume, início, fade-out); ao escolher música do aparelho o
  script lança `Error: "Show roots" não apareceu na tela` e deixa `com.google.android.documentsui/...picker.PickActivity` aberto.
- **Causa provável (não verificada além disto):** `uiFind('Show roots')` procura o rótulo em inglês do DocumentsUI (em português
  é outro) e a pré-condição do script, `/sdcard/Music/e2e_music.wav`, não existe no aparelho (`adb shell ls /sdcard/Music/` vazio).
- **Correção sugerida:** rótulo em inglês ou português (ou `resource-id`), conferir/pushar a pré-condição no início e fechar o
  seletor (`BACK`) ao falhar.
- **Evidência:** `C:\projects\sandbox\.bugfix-pipeline-product_photo_offline\evidencia\20261105-2330-task-10\t3\task04.txt` (fix) e
  `t3-base\task04.txt` (base).
