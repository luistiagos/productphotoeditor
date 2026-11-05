---
name: pipeline-tasks
description: >-
  Pipeline autonomo deste repo para as TASKS (docs/tasks/open) e os BUGS (docs/bugs/open): monta a lista e entrega
  ao motor `pipeline-correcao-bugs` (copia da skill do retrobatnew em .claude/skills/), que abre e gerencia as sessoes
  (planning em paralelo, ondas, dev por worktree, teste E2E no aparelho, integracao em origin/main, briefing) e gira
  as contas no limite de uso, sem operador. So roda quando o dono chama `/pipeline-tasks`. Argumentos: vazio ou
  `iniciar` (tasks + bugs) | `iniciar tasks` | `iniciar bugs` (+ `auto` para nao perguntar) | `status` |
  `reconcile` | `preflight`.
disable-model-invocation: true
---

> **Execucao so a pedido do dono.** Nunca por iniciativa propria nem agendada (`/loop`, cron): abre dezenas de
> sessoes Opus, faz push em `origin/main` e troca a conta da maquina inteira. Depois de iniciada, as etapas encadeiam
> sozinhas ate a finalizacao.

# Pipeline de tasks e bugs — entrada deste repo

Esta skill so faz o que e DESTE repo: **a lista de itens** (tasks + bugs) e a regra de **nao rodar junto com o
retrobatnew**. Todo o resto (preflight, init, start, vigia, rodizio de contas, status, reconcile, limites) e do
motor, e as regras dele valem integralmente:

- Motor (copia sincronizada, nao edite): `.claude/skills/pipeline-correcao-bugs/` — **leia o `SKILL.md` de la**
  (secoes Preflight, Iniciar passos 1–2 e 5, Vigia, Rodizio, Status, Reconcile, Limites) antes de agir.
- Manual do projeto (o que as sessoes leem): `.claude/skills/pipeline-correcao-bugs/projeto.md`.
- Por que e assim: `DESIGN.md` nesta pasta.

`H` = `python "C:\projects\sandbox\product_photo_offline\.claude\skills\pipeline-correcao-bugs\scripts\pipeline.py"`.
`L` = `python -I "C:\projects\sandbox\product_photo_offline\.claude\skills\pipeline-tasks\scripts\itens.py"`.

## Tasks e bugs no mesmo motor

Os dois tem ciclo de PASTA (`open/` -> `retest/` -> `done/`), que e o que o motor chama de "bug". Por isso todo
item vai com `"tipo": "bug"`, inclusive as tasks (slug `task-<arquivo>`); o `projeto.md` ensina as sessoes que um
doc em `docs/tasks/` e funcionalidade a implementar (commit `feat(...) (TASK-NN)`, matriz atualizada na aprovacao).
**Nunca** use `"tipo": "task"` nem ponha `tarefas` no `projeto.json`: esse e o modelo de campo `Status` do ARMSX2.

## Modo `preflight`

`H preflight`. Alem dos itens do motor, o `projeto.json` confere JDK, node, `node_modules`, `local.properties`,
aparelho no adb e o retrobatnew sem execucao aberta. VERMELHO -> pare e diga ao dono o que fazer (o `fix` de cada
item diz). "Workspace not trusted" -> o dono roda `claude` num terminal em
`C:\projects\sandbox\product_photo_offline`, aceita e sai.

## Modo `iniciar` (padrao)

1. **Outro pipeline:** `python -I "C:\projects\sandbox\product_photo_offline\.claude\skills\pipeline-tasks\scripts\outro_pipeline.py"`.
   Saida 1 = o retrobatnew tem execucao aberta: os dois vigias de cota disputariam o arquivo de credenciais da
   maquina. **Pare** e diga ao dono; nao existe "seguir assim".
2. **Execucao ativa aqui** e **avisos da arvore principal / contas:** passos 1 e 2 do `SKILL.md` do motor (`H status`,
   `H preflight`; `[AVISO]` -> AskUserQuestion com o que cada um implica). Aviso proprio deste repo: item que so
   existe na arvore principal (ex.: `docs/tasks/` ou `tools/e2e/` sem commit) fica FORA da execucao, e o E2E das
   sessoes depende de `tools/e2e/` estar em `origin/main`.
3. **Lista:** `L <todos|tasks|bugs>` (`--incluir <nome>` para um item com veredito anterior que o dono quer de volta;
   `--excluir <nome>` para tirar). Ele le os docs NA BASE e faz so exclusoes mecanicas: ausente na base, sujo na
   arvore principal, veredito anterior diferente de `corrigir`. A ultima linha e o arquivo `bugs-<AAAAMMDD-HHMM>.json`
   gravado na pasta do pipeline.
4. Mostre ao dono a lista, os excluidos com motivo e o custo (3 sessoes Opus por item, mais retomadas). Lembre que
   toda task que mexe no `editor-web/` vai para uma onda propria (bundle versionado na reserva). Pergunte se inicia,
   a menos que tenha sido chamado com `auto`.
5. `H init --bugs <arquivo>` e `H start`. Relate as sessoes abertas e como acompanhar: `claude agents` (`claude
   attach <id>`), `/pipeline-tasks status`, ondas em
   `C:\projects\sandbox\.bugfix-pipeline-product_photo_offline\runs\<execucao>-ondas.md`, `/pipeline-tasks reconcile`
   quando algo parecer parado. Avise: o aparelho do adb (ou o emulador `pp_api34`) fica ocupado nas janelas de teste.

## Modos `status` e `reconcile`

Exatamente os do `SKILL.md` do motor (`H status` + `H reconcile`; `H reconcile --fix` so no `reconcile`).

## Limites (alem dos do motor)

- Nunca editar os arquivos sincronizados da copia do motor (`SKILL.md`, `DESIGN.md`, `etapas/`, `scripts/`): o
  `preflight` acusa a divergencia. Mudanca no motor e na fonte (`C:\projects\retrobatnew\source\skills\pipeline-correcao-bugs`);
  atualizar esta copia: `python <fonte>\scripts\sync_copias.py --destino
  C:\projects\sandbox\product_photo_offline\.claude\skills\pipeline-correcao-bugs` (com `--commit` para commitar).
- O que e deste repo muda em `projeto.json`/`projeto.md` (motor) ou nesta pasta.
- Iniciar execucao aqui com o retrobatnew rodando, ou o inverso, e proibido enquanto os dois tiverem
  `rodizio_contas: true` (o de la nao confere este: avise o dono se ele for iniciar o de la com este aberto).
