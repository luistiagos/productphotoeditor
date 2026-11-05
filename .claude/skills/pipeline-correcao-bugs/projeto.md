# Manual do projeto — Product Photo Offline

O que as `etapas/*.md` e o `SKILL.md` deixam para o projeto. Cada secao diz qual etapa a cita. Nunca sobrescrito
pela sincronizacao das copias. A config que o MOTOR le esta no `projeto.json` ao lado; o desenho desta instalacao
(decisoes do dono, fatos medidos) esta em `.claude/skills/pipeline-tasks/DESIGN.md`.

## Caminhos

- Arvore principal (repo): `C:\projects\sandbox\product_photo_offline` (= raiz do projeto).
- Pasta do pipeline: `C:\projects\sandbox\.bugfix-pipeline-product_photo_offline` (`state.json`, `lanes\`,
  `reports\`, `runs\`, `evidencia\`).
- Fluxo principal: `origin/main`.
- Helper: `python "C:\projects\sandbox\product_photo_offline\.claude\skills\pipeline-correcao-bugs\scripts\pipeline.py"`.
- Onde a skill mora: copia versionada em `.claude/skills/pipeline-correcao-bugs/` (fonte: retrobatnew). A entrada do
  dono e a skill local `.claude/skills/pipeline-tasks/` (monta a lista de tasks + bugs e chama este motor).
- Caminhos de arquivo no plano e nos `claim`: relativos ao repo, com `/`.

## Itens: bug OU task (todas as etapas — LEIA PRIMEIRO)

O prompt sempre diz `Bug:` e "Doc do bug", mas aqui o item pode ser de dois tipos, pela PASTA do doc:

| doc em | o item e | "corrigir" significa | commit de codigo | commit de docs |
|---|---|---|---|---|
| `docs/bugs/open/` | bug | eliminar o sintoma | `fix(<area>): <resumo> (bug: <slug>)` | `docs(bugs): ...` |
| `docs/tasks/open/` | **task** (funcionalidade nova) | implementar a especificacao do doc | `feat(<area>): <resumo> (TASK-NN)` | `docs(tasks): ...` |

Para uma **task**, leia "bug" no roteiro como "task" e "sintoma" como **"a funcionalidade pedida AUSENTE"**: o
controle positivo (T2 na base) mostra que ela nao existe; o T2 com o fix mostra que ela existe e funciona como o doc
especifica. `NN` = o numero no nome do arquivo (`05-qrcode-...md` -> `TASK-05`). O doc da task ja tem plano e
estimativa do autor: o planning CONFERE contra o codigo (abrir cada simbolo citado; o doc pode estar desatualizado) e
grava a secao `## Planejamento` do pipeline; nao apague o plano original. Task grande demais para uma sessao de dev
(> ~1.500 linhas novas ou mais de 2 modulos Gradle): veredito `bloqueado` com a proposta de divisao em tasks
menores (o dono decide), nunca uma implementacao pela metade.

Ciclo das duas: `open/` -> `retest/` (aprovado no pipeline) -> `done/` (so o dono). Com `docs/tasks/`, o indice
`docs/tasks/open/README.md` (matriz) tambem muda na aprovacao (secao Teste, Passo 8).

## Leituras obrigatorias (planning Passo 1, dev Passo 1)

- `ARQUITETURA.md` §0–§12 (decisoes, modulos Gradle, contratos de `:core:ai-api`, editor §7, conteudo §8) e as
  secoes posteriores que o doc do item citar. 3.000 linhas: leia por secao, nao inteiro.
- `HANDOFF_APP_OFFLINE.md`: so as secoes que o doc do item citar.
- Task: `docs/tasks/open/README.md` (matriz, diretriz legal: **implementacao 100% propria**, nunca copiar codigo
  do app de referencia `com.desygner.ads`; o que a analise dele da e especificacao).
- **Criterio de complexidade** (nao ha README de bugs aqui): `baixa` = 1–2 arquivos, mudanca localizada;
  `media` = um modulo, varios arquivos ou um fluxo novo de UI; `alta` = mais de um modulo (editor-web + Kotlin),
  formato de dados novo, ou ponte WebView <-> Kotlin.

## O app e o runtime (todas as etapas)

- App Android `com.productphoto.offline` (o debug usa o MESMO id). Modulos Gradle em `settings.gradle.kts`
  (`:app`, `:editor`, `:feature:*`, `:core:*`, `:ai:*`, `:data:*`). O editor e uma pagina web (TypeScript + Fabric
  7.4.0, `editor-web/`) servida pelo WebView do modulo `:editor` (ARQUITETURA §7).
- **Bundle do editor e VERSIONADO:** `npm run build` (em `editor-web/`) apaga e regera
  `editor/src/main/assets/editor/` (`index.html` + `assets/index-<hash>.js|.css`). Codigo em `editor-web/` sem o
  bundle regerado nao chega ao app.
- Build (o helper roda; a sessao nunca roda `gradlew` de assemble/test nem `npm run build` direto):
  `python <helper> build --bug <slug>` = copia `local.properties` para a lane se faltar, `npm run build` +
  `npm test` (vitest) em `editor-web/`, `gradlew :app:assembleDebug testDebugUnitTest`. APK:
  `<lane>\app\build\outputs\apk\debug\app-debug.apk` (arm64-v8a + x86_64: serve no celular e no emulador). Lock
  `ppo-build`: um build por vez entre as lanes; esperar e normal.
- Permitido direto na sessao: `npx vitest run <arquivo>`, `npx tsc --noEmit` (em `editor-web/`), `node
  tools/e2e/*.mjs`, `adb`.
- IA remota: o debug usa o `iawrapper` com a credencial de DEV do `local.properties` (custa credito). Teste que nao
  e sobre IA remota nao a chama.

## Planning

- **Exemplos de veredito:** `sem-codigo` = conteudo/asset a produzir fora do repo, publicacao na loja, conta;
  `outro-projeto` = o conserto e no backend `iawrapper` (secao abaixo); `bloqueado` = depende de decisao do dono,
  de aparelho/recurso que nao ha, ou task grande demais (secao Itens).
- **Exemplo de arquivo na reserva:** `"files": ["editor-web/src/editor.ts", "editor-web/src/main.ts"]`.
- **Arquivos que a correcao arrasta** (entram na reserva):
  - qualquer mudanca em `editor-web/` (src, `index.html`, `package.json`) -> **`editor/src/main/assets/editor/index.html`**
    (o bundle regerado; decisao do dono: isto poe toda mudanca de editor-web em ondas distintas);
  - `.ts` novo no editor -> o teste `editor-web/test/<nome>.test.ts`;
  - E2E novo -> `tools/e2e/taskNN.mjs` (task) ou `tools/e2e/bug-<slug>.mjs` (bug): e codigo, vai na reserva;
  - string nova ao usuario no Kotlin -> `res/values/strings.xml` do modulo;
  - modulo Gradle novo -> `settings.gradle.kts` e o `build.gradle.kts` de quem depende dele;
  - asset novo em `app/src/main/assets/content/` -> `app/src/main/assets/content/SOURCES.md` (origem e licenca);
  - dependencia npm -> `editor-web/package.json` e `editor-web/package-lock.json` (e a lane precisa de
    `npm ci`: diga no plano; o `node_modules` da lane e copia do da arvore principal).
- **Effort:** `high` para ponte WebView <-> Kotlin, geometria/transformacao no Fabric, exportacao de video
  (`VideoPreview.ts`, `FfmpegCommandBuilder.ts`, `VideoRenderer.kt`).
- **T2 (o usuario) no Plano de teste:** o caminho pela UI do app no aparelho: estado de partida (design novo ou
  existente, formato, camadas), cada toque (aba, botao, painel) e o SINAL objetivo (valor lido por CDP no
  `editor`/`canvas` do WebView, print do aparelho, arquivo exportado, linha de logcat). Script E2E pelo driver
  `tools/e2e/cdp.mjs` (modelos: `tools/e2e/task11.mjs`, `task12.mjs`, `task14.mjs`). So item sem caminho de usuario
  (build, teste unitario puro) dispensa a UI, com o motivo escrito.

## Bug de outro projeto (planning Passo 6, teste Passo 6)

`outro-projeto` aqui = o conserto e do backend **iawrapper** (`D:\projects\iawrapper`, Django; deploy no Railway;
NAO e repo git nesta maquina). Doc em `D:\projects\iawrapper\docs\bugs\open\AAAA-MM-DD-<slug>.md`: sintoma,
evidencia (request/resposta, horario, aparelho), o que o app espera. Nao rode nada que escreva no banco de producao;
leitura do Postgres de producao so pelo script so-leitura descrito na memoria do dono, se precisar. Registre com
`register-external`. Exemplo de `external_docs`:
`"D:\\projects\\iawrapper\\docs\\bugs\\open\\2026-11-05-<slug>.md"`.

## Dev

- Ordem quando o item toca `editor-web/`: codigo + teste vitest -> `build --bug <slug>` (background) -> `git status`
  mostra o bundle regerado em `editor/src/main/assets/editor/` (index.html modificado, `assets/index-<hash>.*`
  apagados e novos) -> **`claim` de cada caminho de `assets/` que o `git status` listar** (nomes com hash nao dao
  para prever no plano; ninguem da onda os disputa, porque o `index.html` reservado ja separou as ondas) -> commit do
  fix JUNTO com o bundle.
- O `build` ja devolve o bundle ao commitado quando o regerado so difere em espaco/fim de linha (`core.autocrlf`
  contra a saida LF do vite; medido em 2026-11-05) e nao criou arquivo novo: sem mudanca real, a lane fica limpa.
- Item que NAO toca `editor-web/` e o build mudou o bundle DE VERDADE (base com bundle velho): nao commite o bundle. Volte-o
  (`git restore --staged --worktree -- editor/src/main/assets/editor` e apague os `index-<hash>.*` novos nao
  rastreados) e anote no doc do item que a base tem bundle desatualizado.
- **Gerados:** nada versionado alem do bundle; `build/`, `.gradle/`, `.kotlin/`, `node_modules/` sao ignorados.
- **Commit:** tabela da secao Itens. Comentario no codigo cita `[[<slug>]]` so quando explica uma escolha nao obvia.

## Teste (E2E)

**Onde o teste roda: no celular que estiver no adb; sem celular, no emulador local.** Decisao do dono (2026-11-05).
Sem `deploy` no projeto: o APK e o da SUA lane, instalado no aparelho dentro do slot. Um teste por vez (o slot); o
`env-wait` nao vigia processo local aqui.

```
wt-1 (item A) --build do helper--> APK da lane --adb install (no slot)--> aparelho: com.productphoto.offline <-- teste de A
wt-2 (item B) --(espera o slot)--> ...
```

- **Escolha do aparelho (inicio do slot):** `adb devices`. 1) Moto g86 (`ZY32LMNN9B`, por cabo ou
  `adb-ZY32LMNN9B-...._adb-tls-connect._tcp`) se `device`; 2) senao, outro celular `device` (serial sem
  `emulator-`); 3) senao, `emulator-*` ja aberto; 4) senao, abra o emulador em BACKGROUND:
  `D:\DevCaches\Android\Sdk\emulator\emulator.exe -avd pp_api34 -no-snapshot-save`, espere
  `adb -s emulator-5554 shell getprop sys.boot_completed` = `1` (teto 5 min) e feche-o no fim (so o que VOCE abriu).
  Nada disponivel = `test-done --result ambiente`, nao reprovacao. Use `ANDROID_SERIAL=<serial>` em todo comando e
  anote o aparelho escolhido na evidencia.
- **O aparelho e compartilhado com o dono** (o app instalado e o mesmo pacote que ele usa): antes de instalar, guarde
  `adb shell dumpsys package com.productphoto.offline | findstr "versionName lastUpdateTime"` na evidencia. Instale
  com `-r` (dados ficam); nunca `pm clear` nem desinstale sem o Plano de teste exigir (e se exigir, diga no doc).
- **Controle positivo (Passo 4, sem `deploy`):** depois do `sync`, na lane: `git checkout --detach <base
  sincronizada>`; `python <helper> build --bug <slug>` (background); copie o APK para a evidencia como
  `base-<hash>.apk`; volte (`git checkout bugfix/<slug>`; se o build da base sujou o bundle, `git restore` +
  apagar os novos nao rastreados; `git status` limpo). Instale o da base e rode a T2: o sinal TEM que aparecer
  (task: a funcionalidade ausente). Depois `build` de novo (o fix) e copie como `fix-<hash>.apk`.
- **Instalar e provar o binario:** `adb install -r -d -t <apk>`; `adb shell pm path com.productphoto.offline` ->
  `adb shell sha256sum <base.apk do aparelho>` igual ao `Get-FileHash -Algorithm SHA256` do APK instalado.
- **Driver:** `node tools/e2e/<script>.mjs <pasta de prints>` com cwd na LANE (`tools/e2e/cdp.mjs`: abre o editor,
  conecta no DevTools do WebView pela porta `CDP_PORT`, padrao 9333; `evaluate`, `tap`, `screencap`, `uiFind`,
  `reporter`). Print: so `screencap` do aparelho (`adb exec-out screencap -p`), nunca da tela do PC.
- **Evidencia:** `C:\projects\sandbox\.bugfix-pipeline-product_photo_offline\evidencia\<AAAAMMDD-HHMM>-<slug>\`:
  prints, saida do script E2E, logcat do SEU PID (`adb shell pidof com.productphoto.offline`; nunca `logcat -c`),
  os APKs e o aparelho usado.
- **Teto:** `e2e.teto_slot_min` = 60. Todo comando em background dentro do slot tem teto proprio (boot do emulador
  5 min; script E2E 10 min).

| Nivel | O que | Criterio |
|---|---|---|
| T2 | **o usuario de novo**: o mesmo caminho do controle positivo, pela UI do app no aparelho, com o APK do fix (script `tools/e2e/taskNN.mjs` / `bug-<slug>.mjs`) | sintoma AUSENTE (task: funcionalidade PRESENTE e conforme o doc) |
| T3 | regressao: vitest e testes de unidade do `build` (`editor-web` + `**/build/test-results/testDebugUnitTest/*.xml`) e os E2E vizinhos de `tools/e2e/` cujos arquivos o fix tocou | sem `fail` novo contra a base |
| T4 | `adb logcat` do seu PID (`AndroidRuntime`, `FATAL`, `ANR`, `chromium`/console do WebView) na janela do teste | sem erro novo atribuivel ao fix |

**Aprovado (Passo 8.1), por tipo:**
- bug: `git mv docs/bugs/open/<doc> docs/bugs/retest/` e `## Status` no topo (abaixo).
- task: `git mv docs/tasks/open/<doc> docs/tasks/retest/`, `## Status` no topo, e
  `python tools/e2e/mark_retest.py NN` com cwd na lane (atualiza a matriz `docs/tasks/open/README.md`); commite os
  tres juntos: `docs(tasks): TASK-NN implementada e testada -> retest`.
- `## Status` (nao ha README de retest aqui): o que foi feito, commits, aparelho, evidencia de cada T (caminho), o
  que falta para `done/` (validacao do dono no aparelho dele).

## Finalizacao

- Dedup: os docs novos da execucao em `docs/bugs/open` E `docs/tasks/open` (`git log -- docs/bugs/open docs/tasks/open`).
- `final-sync-main`: codigo deixado sem commit por outras sessoes so e publicado se o `build` sair 0 numa lane.
- `final-deploy`: projeto sem deploy (sai 0 sem fazer nada).
- Briefing em `C:\projects\sandbox\.bugfix-pipeline-product_photo_offline\runs\<execucao>-briefing.md`; o link de
  cada doc e relativo a essa pasta: `../../product_photo_offline/docs/bugs/retest/<doc>.md` ou
  `../../product_photo_offline/docs/tasks/retest/<doc>.md`.

## Maestro (SKILL.md)

- Entrada do dono: `/pipeline-tasks` (lista tasks + bugs). Este `SKILL.md` copiado continua valido para `status`,
  `reconcile` e `preflight`.
- Trust: o dono roda `claude` num terminal em `C:\projects\sandbox\product_photo_offline`, aceita e sai.
- Commits locais na arvore principal: publicar antes e `git -C C:\projects\sandbox\product_photo_offline push origin
  main`, que nao mexe na arvore de trabalho.
- Rodizio de contas: ligado (`"rodizio_contas": true`), contas da maquina (as mesmas do retrobatnew). **Nunca rodar
  junto com o pipeline do retrobatnew** (o preflight daqui recusa; o de la nao confere este).
