# [TASK-19] Mockup: Caixa 3D Multi-Face (Rotação X/Y, Faces com Artes Próprias e Luz por Face)

> **Origem:** dividida da TASK-08 pelo dono em 2026-11-05 (Geometria 4 do §2.1 original e critério 2; a "08b" do
> planning). **Depende da [TASK-08](08-mockup-25d-3d-cilindro-esfera-cubo-sobel-iluminacao.md)**: usa o warp plano
> (`mockupEngine.ts`) e o estúdio (`mockupStudio.ts`) dela; só começa com a TASK-08 em `retest/`. Se as duas
> estiverem na mesma execução do pipeline, o planning põe a TASK-08 em `depende_de`. Doc original:
> `git show cbf5f41:docs/tasks/open/08-mockup-25d-3d-cilindro-esfera-cubo-sobel-iluminacao.md`.

## Metadados e Esforço Mensurado

| Campo | Valor |
| :--- | :--- |
| **ID** | `TASK-19` |
| **Prioridade** | **Média-Alta (P1/P2)** |
| **Esforço Mensurado** | **Baixo a Médio** — **~1 dia útil (7h–8h / 2 a 3 Story Points)**; ~450 linhas novas estimadas (código + teste + E2E) |
| **Escopo** | Local (`editor-web` em TypeScript / Canvas 2D) + template procedural (`tools/gen_mockups.py --3d`) |
| **Referência Analisada (`com.desygner.ads`)** | `js_pretty/assets/module-create-DxNmnX1s.js` (L208850–L209640) — só referência de algoritmo |

### Detalhamento do Esforço por Subtarefa
1. **Projeção da caixa (vértices, rotação, perspectiva, culling, ordem de pintura e luz por face):** ~4h.
2. **Controles no estúdio (Rotação X/Y, proporções, arte/cor por face) e fundo procedural da caixa:** ~2h.
3. **Testes Unitários (Vitest) e E2E:** ~1h–2h.

---

## 1. Contexto e Problema Atual

O mockup (mesmo depois da TASK-08) não tem **projeção de Caixa 3D multi-face**, onde o usuário gira a embalagem em
`rotX`/`rotY` e aplica artes na frente, na lateral e no topo.

---

## 2. O que deve ser feito (Especificação Técnica Detalhada)

### 2.1. Geometria 4 — Cubo / Caixa 3D Multi-Face (`shapeType: 'box3d'` — Embalagens de Produto)
- Parâmetros: `rotX` $\in [-60^\circ, 60^\circ]$ (inclinação vertical), `rotY` $\in [-80^\circ, 80^\circ]$ (giro
  horizontal), `boxRatio` `{ w, h, d }` (proporções de largura, altura e profundidade da caixa) e `fov` (distância focal).
- Define os 8 vértices 3D da caixa $[-w/2, w/2] \times [-h/2, h/2] \times [-d/2, d/2]$, aplica as matrizes de rotação
  $R_x(\text{rotX}) \cdot R_y(\text{rotY})$ e projeção em perspectiva para 2D.
- Realiza *back-face culling* (descarta faces cujo vetor normal $N_z \le 0$) e ordena as faces visíveis (`front`,
  `left`/`right`, `top`/`bottom`) de trás para frente.
- Renderiza a arte de cada face com o mesmo projetor homográfico 3×3 da TASK-08 e aplica iluminação direcional por
  face (frente $100\%$ de brilho, topo $108\%$, lateral em sombra $78\%$).
- No estúdio: sliders `Rotação X` / `Rotação Y` e escolha de arte (design atual, imagem selecionada) ou cor para frente,
  lateral e topo.

---

## 3. Arquivos a Criar / Modificar

| Arquivo | Ação | Descrição |
| :--- | :---: | :--- |
| `editor-web/src/mockup/box3d.ts` (ou em `mockupEngine.ts`) | **Criar / Modificar** | Projeção, culling, ordem e luz por face; render pelas homografias da TASK-08. |
| `editor-web/src/mockup/mockupStudio.ts` | **Modificar** | Modo Caixa 3D: rotação, proporções, arte/cor por face. |
| `editor-web/test/box3d.test.ts` | **Criar** | Faces visíveis, ordem e brilho. |
| `tools/gen_mockups.py` + `app/src/main/assets/content/mockups3d/` | **Modificar** | Fundo procedural da caixa e entrada no índice 3D. |
| `app/src/main/assets/content/SOURCES.md` | **Modificar** | Se o fundo novo entrar. |
| `tools/e2e/task19.mjs` | **Criar** | E2E no aparelho. |
| `editor/src/main/assets/editor/index.html` | **Regerar** | Bundle do editor. |

---

## 4. Critérios de Aceite e Verificação

- [ ] Usuário consegue gerar uma **Caixa 3D** interativa girando `Rotação X` e `Rotação Y` e escolhendo cores/artes
  para a frente, lateral e topo.
- [ ] Só as faces voltadas para a câmera aparecem, na ordem certa, com o brilho por face.
- [ ] O resultado pode ser inserido no design e salvo na galeria (saídas do estúdio da TASK-08).
- [ ] `npx vitest run` e `npm run build` executam com 0 erros.

---

## Análise herdada — planning 20261105-1638 da TASK-08 (antes da divisão)

**Veredito daquele planning:** bloqueado por tamanho (TASK-08 inteira); esta parte foi separada pelo dono em
2026-11-05. O próximo planning confere a análise contra a base — a TASK-08 vai ter criado `editor-web/src/mockup/` e o
estúdio antes desta — em vez de refazê-la. As decisões comuns (pasta `mockup/`, preview reduzido, saídas, índice
`mockups3d/`) estão na seção "Decisões comuns" da TASK-08.
**Complexidade estimada:** média — projeção e culling, com sinal de eixo fácil de errar.
**Reserva prevista:** `editor-web/src/mockup/mockupEngine.ts` (ou `box3d.ts` novo), `editor-web/src/mockup/mockupStudio.ts`,
`editor-web/test/box3d.test.ts` (novo), o bundle `editor/src/main/assets/editor/index.html`, `tools/gen_mockups.py` +
`content/mockups3d/` (fundo da caixa), `content/SOURCES.md` e `tools/e2e/task19.mjs` (novo).

### Tarefas
- [ ] Projeção da caixa — vitest `test/box3d.test.ts`: `rotX=rotY=0` → só `front` visível; `rotY=+30` → `front` + uma
  lateral (com o sinal conferido para o eixo y para baixo do canvas); `rotX` negativo → `top` entra; ordem de pintura
  de trás para frente; brilho por face de 100/108/78 %.
- [ ] Modo Caixa 3D no estúdio (rotação, proporções, arte/cor por face) e fundo procedural no `gen_mockups.py --3d`.
- [ ] `tools/e2e/task19.mjs` — a T2 abaixo.

### Plano de teste
- **Offline (sem slot):** `npx tsc --noEmit` e `npx vitest run test/box3d.test.ts`.
- **T2 reprodução como o usuário (E2E, no slot):** aba `📦 Mockup 3D` → "Caixa 3D" → girar Rotação X/Y e conferir as
  faces visíveis (estado exposto pelo estúdio) e os pixels do preview de cada face + print do aparelho; "Inserir no
  design" → +1 `FabricImage`.
- **Controle positivo:** no APK da base (com a TASK-08), o modo "Caixa 3D" não existe no estúdio.
- **T3 regressão direcionada:** `task08.mjs` (estúdio, cilindro, alças) e vitest inteiro.

### Sessões seguintes (sugestão daquele planning)
- dev: effort high (projeção e culling, com sinal de eixo fácil de errar).
- teste: effort medium, sem ultrathink.
