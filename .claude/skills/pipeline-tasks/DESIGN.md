# pipeline-tasks — registro de desenho

Pedido do dono (2026-11-05): adaptar a skill `pipeline-correcao-bugs` do retrobatnew para rodar aqui sobre as
**tasks** (e tambem os bugs), com o agente autonomo gerenciando sessoes e contas, sem operador.

## 1. Fatos verificados (comando -> resultado)

Fonte da skill: `C:\projects\retrobatnew\source\skills\pipeline-correcao-bugs` (junction em
`C:\projects\retrobatnew\.claude\skills\`). Ultimo commit da pasta: `8f5c4cb` (2026-11-05 02:55); `git status
--short -- skills/pipeline-correcao-bugs/` na fonte: limpo.

- **A skill ja e motor generico + copias** (DESIGN da fonte, secao 22): `scripts/pipeline.py` (5.702 linhas),
  `etapas/*.md`, `SKILL.md`, `DESIGN.md`, `sim_pipeline.py`, `git_pipeline.py` sao IDENTICOS em todo repo
  (`pipeline.SYNCED`); so `projeto.json` (o que o motor le) e `projeto.md` (manual que as sessoes leem) sao
  do projeto. Copias: PS2Companion, ARMSX2-forkv2, Downloader-XBOX360, Lemuroid (`sync_copias.py::DESTINOS`).
- `scripts/sync_copias.py --destino <pasta>` sincroniza uma copia fora da lista `DESTINOS`; destino sem
  `projeto.json` e pulado. -> instalar aqui = criar `projeto.json`/`projeto.md` e rodar o sync com `--destino`,
  sem tocar a fonte.
- `pipeline.py::configure` — SRC = `git rev-parse --show-toplevel` da pasta da skill; PIPE padrao =
  `<pai do repo>/.bugfix-pipeline-<nome do repo>` = `C:\projects\sandbox\.bugfix-pipeline-product_photo_offline`
  (fora do repo, como o `guard_wt` exige). `tarefas` ausente -> `TAREFAS=None`.
- `pipeline.py::stage_path`/`retest_path` — qualquer doc com `/open/` no caminho vai para `<mesma raiz>/retest/`
  na aprovacao. NAO amarra `docs/bugs`: `docs/tasks/open/X.md` -> `docs/tasks/retest/X.md`.
- `pipeline.py::cmd_init` — so valida `tipo` (`bug`|`task`); `task` exige `tarefas`. Doc em qualquer pasta.
- Modelo "task" do motor (`item_kind == "task"`, ~20 pontos: `task_status`, `normalize_task_status`,
  `task_commits`, C4 do `final_report`) = o do ARMSX2: task em pasta PLANA, estado num CAMPO `- **Status:**`,
  todo commit `TASK-NNNN: ...`. **Nao e o modelo daqui.**
- `pipeline.py::cmd_enqueue_test` — todo arquivo alterado fora de `docs/` tem de estar em `plan.files` ou
  `claims`, comparacao por caminho EXATO (`fk` = minusculo). Diretorio nao vale.
- `pipeline.py::provision_wt` — `entradas_ignoradas` so copia DIRETORIO (`src.is_dir()`); arquivo nao.
- `pipeline.py::rotation_owner` = `RODIZIO`; arquivo de credenciais e guarda de contas sao da MAQUINA. Dois
  projetos com `rodizio_contas: true` rodando juntos: dois vigias sem lock comum, e o que termina devolve o
  `/login` no meio do outro (DESIGN fonte 22.3). Nao ha coordenacao de maquina no motor.
- `pipeline.py::stage_prompt` — a sessao recebe `Bug: <slug>` e `Doc do bug: <caminho>`; o resto vem do
  `etapas/<etapa>.md` + `projeto.md`. Um item `docs/tasks/...` com `tipo` bug chega como "bug": o
  `projeto.md` tem de dizer que ali "corrigir" = implementar a especificacao.
- `pipeline.py:4235` — commit de doc: `commit_docs` se o caminho comeca com `docs/bugs/`, senao
  `commit_docs_outros` (padrao `docs`).

Este repo (`C:\projects\sandbox\product_photo_offline`):

- `git rev-parse --abbrev-ref @{u}` -> `origin/main`; `git log origin/main..HEAD` vazio; remoto `origin`
  (github luistiagos/productphotoeditor). Checkout principal (`--git-common-dir` = `.git`).
- `.claude/` nao existe e nao e ignorado -> a skill pode ser versionada em `.claude/skills/`.
- Tasks: `docs/tasks/{open,retest,done}/NN-slug.md` + indice `docs/tasks/open/README.md` (matriz com status).
  `tools/e2e/mark_retest.py NN` atualiza o indice (status e links open/ -> retest/). Ciclo de PASTA, igual bug.
- **`git ls-files docs/tasks` -> vazio**: as tasks NAO estao no git. `git ls-files docs/bugs` -> so
  `docs/bugs/open/editor-edicao-de-texto.md` (os outros 2 bugs sao `??`). Arvore com as implementacoes das
  tasks em retest (01-04, 11, 12, 14) NAO commitadas (`M editor-web/src/*`, `?? editor-web/src/snapping.ts`...).
  O pipeline parte de `origin/main`: **hoje nao veria nenhuma task**.
- Build: `editor-web/` (TS + Fabric 7.4.0; `npm run build` = `tsc --noEmit && vite build`; `npm test` = vitest)
  escreve o bundle em `editor/src/main/assets/editor/` (`emptyOutDir`, nomes com HASH: `index-<hash>.js/.css`),
  que e VERSIONADO (`editor/build.gradle.kts::checkEditorWeb` so confere que `index.html` existe).
  App: `gradlew :app:assembleDebug` (JAVA_HOME `D:\DevCaches\jdk-17`). `local.properties` (sdk.dir, rust.home,
  credencial/URL do iawrapper de dev) e `editor-web/node_modules` (108 MB) sao gitignored.
- E2E existente: `tools/e2e/cdp.mjs` (driver do WebView por DevTools/CDP via adb: `launchEditor`, `tap`,
  `evaluate`, `screencap`, `uiFind`, `reporter`), `tools/e2e/taskNN.mjs` (E2E por task), `tools/e2e/rebuild.sh`
  (bundle + APK + `adb install`, `ANDROID_SERIAL` padrao `emulator-5554`). Pacote `com.productphoto.offline`.
- `adb devices` (2026-11-05): `adb-ZY32LMNN9B-6mRvcH._adb-tls-connect._tcp` (Moto g86, wireless) e `emulator-5554`.

## 2. Hipoteses descartadas

- **Usar o `tipo: task` do motor:** exige campo `Status` e commit `TASK-NNNN:` (modelo ARMSX2); as tasks daqui
  mudam de pasta. Os itens daqui vao todos com `tipo: bug` (no motor, "bug" = doc com ciclo open -> retest).
- **Ensinar o motor um "task por pasta"** (`tarefas.ciclo: pasta`): ~20 pontos + testes da simulacao, na fonte
  compartilhada com 4 repos. Desnecessario: o ciclo de pasta ja e o do bug. (Opcao oferecida; dono escolheu outra.)
- **Mudar o `SKILL.md` da fonte para aceitar pastas de itens extras:** o dono escolheu NAO tocar a fonte.
- **Parar de versionar o bundle do editor-web:** o dono escolheu serializar pela reserva.
- **`reserva_livre` para o bundle:** exige `merge=union`; bundle minificado de uma linha nao funde.
- **Reservar a pasta do bundle:** a reserva compara caminho exato; pasta nao vale.

## 3. Decisoes do dono (2026-11-05)

1. **Bundle versionado, serializado pela reserva:** toda task/bug que altera `editor-web/` poe
   `editor/src/main/assets/editor/index.html` (nome fixo; muda a cada build porque cita o hash) em `files`.
   Duas dessas nunca ficam disjuntas -> nunca na mesma onda. Os arquivos com hash novo/apagados entram por
   `claim` depois do build (ninguem mais da onda os disputa).
2. **Rodizio de contas LIGADO aqui** (`rodizio_contas: true`), com a regra: **nunca rodar este pipeline e o do
   retrobatnew ao mesmo tempo**. Nao ha trava no motor; o `preflight` daqui recusa se o retrobatnew tem
   execucao aberta (item do `projeto.json`). O lado do retrobatnew nao confere este (sem tocar a fonte).
3. **Skill local separada** `pipeline-tasks` (este diretorio): monta a lista (tasks + bugs) e delega
   preflight/init/start/status/reconcile ao motor copiado em `.claude/skills/pipeline-correcao-bugs/`. A fonte
   nao e tocada; a copia se atualiza com `sync_copias.py --destino` (abaixo).
4. **Aparelho do E2E:** o celular que estiver no adb (Moto g86 primeiro; cabo ou wireless); sem celular, o
   emulador local.

## 4. O que fazer (tasks, cada uma com a prova)

1. **`projeto.json` + `projeto.md`** em `.claude/skills/pipeline-correcao-bugs/` (build: copia
   `local.properties` se faltar, `npm run build` + `npm test` no editor-web, `gradlew :app:assembleDebug`;
   lock `ppo-build`; `entradas_ignoradas: editor-web/node_modules`; `rodizio_contas: true`; preflight: JDK,
   node, adb com aparelho, node_modules, local.properties, retrobatnew sem execucao aberta).
2. **Copia do motor:** `python <fonte>\scripts\sync_copias.py --destino <esta copia>` (sem `--commit`).
   Prova: `--check --destino` -> `[OK] igual a fonte`.
3. **`pipeline-tasks/SKILL.md` + `scripts/itens.py`** (lista tasks/bugs abertos NA BASE, exclusoes mecanicas,
   grava `bugs-<AAAAMMDD-HHMM>.json`) + `scripts/outro_pipeline.py` (sai 1 se o retrobatnew tem execucao aberta).
   Prova: `itens.py` roda contra `origin/main` (hoje: 1 bug, 0 tasks — o pre-requisito abaixo).
4. **Medir o build** do `projeto.json` numa worktree descartavel (tempo -> `timeout_h`).
5. **`H preflight --skip-spawn`** -> VERDE ou so os vermelhos que dependem do dono.

## 5. Feito (2026-11-05)

- Task 1: `.claude/skills/pipeline-correcao-bugs/projeto.json` e `projeto.md` (secoes Itens bug/task, Leituras,
  App, Planning com o bundle na reserva, outro projeto = iawrapper, Dev com o `claim` do bundle, Teste no aparelho
  do adb com fallback `pp_api34`, Finalizacao, Maestro).
- Task 2: `python C:\projects\retrobatnew\source\skills\pipeline-correcao-bugs\scripts\sync_copias.py --destino
  <copia>` -> `[SYNC] 9 arquivo(s)`; `--check --destino <copia>` -> `[OK] igual a fonte`.
- Task 3: `SKILL.md`, `scripts/itens.py`, `scripts/outro_pipeline.py`.
  - `python -I scripts/outro_pipeline.py` -> `[LIVRE] ... execucao 20261105-0239 fechada`, saida 0.
  - `python -I scripts/itens.py todos --saida <scratch>` -> 1 item (`editor-edicao-de-texto`), 9 fora por
    "ausente na base origin/main" (as 7 tasks abertas e 2 bugs): confirma o pre-requisito abaixo.
- Task 5: `H preflight --skip-spawn` -> todos os itens do `projeto.json` `[OK]` e a copia igual a fonte; VERMELHO
  so por `[FALHA] trust aceito no repositorio` (do dono). Avisos: 94 arquivos nao commitados; conta `luistiago`
  INVALIDA (token revogado: `accounts add --label luistiago` no PowerShell do dono); efeito da conta na maquina.
- Task 4 (build medido numa worktree descartavel de `origin/main`, node_modules copiado, como uma lane): o `cmd`
  do `projeto.json` saiu 0 em **799 s** (~13 min a frio; inclui 2m36s do `vtracer` em Rust em
  `ai/vtracer/rust`), vitest `12 files / 51 tests passed`, `app-debug.apk` de 297 MB. `timeout_h: 1` fica.
- Achado do build: a lane ficava SUJA depois de todo build (`M index.html`, `M assets/index-*.js|.css` com o
  MESMO hash): `git diff --ignore-cr-at-eol` -> 1 linha so de espaco (`<div id="toast">`); o resto e o
  `core.autocrlf=true` contra a saida LF do vite. Sem conserto, o `enqueue-test` recusaria ate item so de Kotlin.
  Conserto no `cmd`: depois do `npm test`, `git diff -w --quiet` + nenhum arquivo novo nao rastreado ->
  `git checkout -- editor/src/main/assets/editor`. Prova: rodado na worktree de medicao -> `status: []`.
  (Alternativa que o dono pode preferir: `.gitattributes` com `editor/src/main/assets/editor/** -text`.)
- Achado: **`tools/e2e/` nao esta no git** (`git ls-files tools/e2e` vazio) -> driver CDP e `mark_retest.py` nao
  existem nas lanes. Entra nos pre-requisitos.

Pre-requisitos do dono antes da 1a execucao (alem dos abaixo): versionar `tools/e2e/`.

Pre-requisitos do dono antes da 1a execucao: commitar e publicar `docs/tasks/` (e o codigo das tasks em
retest) em `origin/main`; commitar a skill; aceitar o trust do repo (`claude` no terminal na arvore principal);
`H preflight` completo (com spawn); contas do rodizio ja cadastradas na maquina (sao as do retrobatnew).
