# E2E: `task18.mjs` quebra no passo 1 com o APK da base em vez de provar a ausência do retoque

- **Origem:** achado lateral do teste da TASK-18 (pipeline 20261106-0749, rodada 1, 2026-11-06). Não impede a aprovação:
  o controle positivo foi feito com uma cópia que só troca a linha abaixo, e a T2 com o fix passou 20/20.
- **Sintoma:** com o APK da base (sem a TASK-18), `node tools/e2e/task18.mjs <pasta>` morre no passo 1 com
  `Error: JS: TypeError: editor.refineInfo is not a function` (em `window.__state18`), antes de chegar ao ramo
  `if (!hasBtn)` que deveria registrar "BASE: … NÃO tem 🖌️ Retocar recorte" e parar com 3/3.
- **Onde:** `tools/e2e/task18.mjs::installHelpers` — `__state18` chama `editor.refineInfo()` incondicionalmente; o método
  só existe com a TASK-18.
- **Correção:** `info: editor.refineInfo?.() ? { ...editor.refineInfo(), img: undefined } : null`. Com essa troca o script
  fez 3/3 na base no emulador e no Moto g86.
- **Evidência:** `C:\projects\sandbox\.bugfix-pipeline-product_photo_offline\evidencia\20261106-1318-task-18-retocar-recorte-pos-remocao-de-fundo\`
  `base-task18.txt` (a quebra), `task18-basectl.mjs` (a cópia), `base-task18-guardado.txt`, `emu2\base-task18-guardado.txt`,
  `moto\base-task18-guardado.txt` (3/3).
