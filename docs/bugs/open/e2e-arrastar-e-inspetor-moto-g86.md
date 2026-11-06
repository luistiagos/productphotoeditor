# E2E: arrastar pelo `input swipe` não move o objeto no Moto g86 (`task11` 7 falhas, `task14` 1 falha)

- **Origem:** achado lateral do teste da TASK-10 (pipeline 20261105-1638, rodada 1), na T3 dos E2E vizinhos.
  **Não pertinente à TASK-10:** as mesmas falhas, com os mesmos números, acontecem com o APK da base `2193b37`.
- **Aparelho:** Moto g86 5G (`adb-ZY32LMNN9B-6mRvcH._adb-tls-connect._tcp`), `E2E_FORMAT="Post Instagram"` (1080×1350).
- **Sintoma (base e fix iguais):**
  - `task11.mjs` 18/25 (com o seletor de fotos ajustado, ver `e2e-task11-seletor-de-fotos-moto-g86.md`): `o grupo se moveu junto
    com o dedo` (`dx=0.0 dy=18.1 esperado≈474.7,296.7`), `Desagrupar devolve as 3 caixas exatas`, e os 5 checks do inspetor
    numérico (`Largura 200`, `X/Y exatos`, `chip +45°`, `sem proporção`, `undo`) leem o objeto `{x:537.5,y:137.5,w:324,h:381}`
    — o inspetor parece estar agindo sobre outro objeto (seleção diferente da esperada depois do arrasto falho). Hipótese **não
    verificada**.
  - `task14.mjs` 49/50: `arrastar move o traço (≈ 60, −40 px de tela)` — o traço foi para `(722,331)` a partir de `(539,698)`,
    com `zoom 0.0806` (o deslocamento esperado em px de tela vira outro em unidades do documento).
- **Onde olhar:** os passos de arrastar de `tools/e2e/task11.mjs` e `tools/e2e/task14.mjs` (conversão tela ↔ documento com o
  zoom do moto; duração do `input swipe`).
- **Evidência:** `C:\projects\sandbox\.bugfix-pipeline-product_photo_offline\evidencia\20261105-2330-task-10\` — `t3\_tmp_task11.txt`,
  `t3\task14.txt` (fix) e `t3-base\_tmp_task11.txt`, `t3-base\task14.txt` (base).
