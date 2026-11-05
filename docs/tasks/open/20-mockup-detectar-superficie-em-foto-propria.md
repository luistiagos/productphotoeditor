# [TASK-20] Mockup em Foto Própria com "🎯 Detectar Superfície" (Sobel / Alpha)

> **Origem:** dividida da TASK-08 pelo dono em 2026-11-05 (§2.3 original "Detecção Automática de Superfície por Filtro
> Sobel" e critério 4; a "08c" do planning). **Depende da
> [TASK-08](08-mockup-25d-3d-cilindro-esfera-cubo-sobel-iluminacao.md)**: usa o estúdio e as 4 alças dela; só começa
> com a TASK-08 em `retest/`. Se as duas estiverem na mesma execução do pipeline, o planning põe a TASK-08 em
> `depende_de`. Independente da [TASK-19](19-mockup-caixa-3d-multi-face.md). Doc original:
> `git show cbf5f41:docs/tasks/open/08-mockup-25d-3d-cilindro-esfera-cubo-sobel-iluminacao.md`.

## Metadados e Esforço Mensurado

| Campo | Valor |
| :--- | :--- |
| **ID** | `TASK-20` |
| **Prioridade** | **Média-Alta (P1/P2)** |
| **Esforço Mensurado** | **Baixo a Médio** — **~1 a 1,5 dia útil (8h–11h / 3 Story Points)**; ~350 linhas novas estimadas (código + teste + E2E) |
| **Escopo** | Local (`editor-web` em TypeScript / Canvas 2D), sem Kotlin |
| **Referência Analisada (`com.desygner.ads`)** | `js_pretty/assets/module-create-DxNmnX1s.js` (L208880–L209115: `f$n`/`LAe`/`IGe`) — só referência de algoritmo |

### Detalhamento do Esforço por Subtarefa
1. **Detector automático de quadrilátero (`surfaceDetector.ts`: Sobel + Alpha, cantos extremos):** ~6h.
2. **Foto própria como base no estúdio e botão "🎯 Detectar superfície" com as 4 alças:** ~2h–3h.
3. **Testes Unitários (Vitest) e E2E:** ~1h–2h.

---

## 1. Contexto e Problema Atual

O mockup (mesmo depois da TASK-08) só aplica o design sobre os templates embutidos. O cliente quer aplicar o
anúncio/rótulo sobre **uma foto própria** (ex.: foto de um quadro, cartão, caixa ou frasco na mesa), com os 4 cantos
da superfície sugeridos automaticamente.

---

## 2. O que deve ser feito (Especificação Técnica Detalhada)

### 2.1. Detecção Automática de Superfície por Filtro Sobel (`detectSurfaceQuad`)
1. Redimensiona a imagem base para no máximo $256 \times 256$ em memória.
2. Se a imagem tiver canal Alpha recortado (produto isolado), encontra o contorno dos pixels com $\alpha > 32$.
3. Se a imagem for uma foto completa (sem transparência), calcula a magnitude do gradiente de bordas **Sobel 3×3**
   ($G = \sqrt{G_x^2 + G_y^2}$), aplica limiarização adaptativa (percentil 80 das bordas na região central) e encontra
   os 4 cantos extremos nas direções diagonais $(\pm 1, \pm 1)$ para sugerir o quadrilátero inicial `warpCorners`.
4. Imagem sem bordas úteis → *fallback* (quadrilátero central), nunca NaN.
5. O usuário ajusta finamente qualquer um dos 4 cantos arrastando as alças do estúdio (TASK-08).

### 2.2. Foto própria como base
- No estúdio, "Usar foto própria" abre a galeria (`bridge.request<BlobResult>('pickImage')`, que já existe) e usa a
  foto como base do mockup; "🎯 Detectar superfície" posiciona as 4 alças.

---

## 3. Arquivos a Criar / Modificar

| Arquivo | Ação | Descrição |
| :--- | :---: | :--- |
| `editor-web/src/mockup/surfaceDetector.ts` | **Criar** | `detectSurfaceQuad(imageData)` (Sobel + Alpha, cantos TL, TR, BR, BL). |
| `editor-web/src/mockup/mockupStudio.ts` | **Modificar** | "Usar foto própria" e "🎯 Detectar superfície". |
| `editor-web/test/surfaceDetector.test.ts` | **Criar** | Imagens sintéticas (retângulo inclinado, recorte com alfa, imagem lisa). |
| `tools/e2e/task20.mjs` | **Criar** | E2E no aparelho. |
| `editor/src/main/assets/editor/index.html` | **Regerar** | Bundle do editor. |

---

## 4. Critérios de Aceite e Verificação

- [ ] Ao importar uma foto qualquer como base de mockup, o botão **"🎯 Detectar superfície"** posiciona
  automaticamente os 4 cantos sobre o objeto principal usando Sobel/Alpha, permitindo ajuste manual das 4 alças.
- [ ] Foto sem objeto destacado não quebra: as alças vão para um quadrilátero central.
- [ ] `npx vitest run` e `npm run build` executam com 0 erros.

---

## Análise herdada — planning 20261105-1638 da TASK-08 (antes da divisão)

**Veredito daquele planning:** bloqueado por tamanho (TASK-08 inteira); esta parte foi separada pelo dono em
2026-11-05. O próximo planning confere a análise contra a base — a TASK-08 vai ter criado `editor-web/src/mockup/` e o
estúdio antes desta — em vez de refazê-la. As decisões comuns estão na seção "Decisões comuns" da TASK-08.
**Complexidade estimada:** média — processamento de imagem puro, testável no vitest sem DOM.
**Reserva prevista:** `editor-web/src/mockup/surfaceDetector.ts` (novo), `editor-web/src/mockup/mockupStudio.ts`,
`editor-web/test/surfaceDetector.test.ts` (novo), o bundle `editor/src/main/assets/editor/index.html` e
`tools/e2e/task20.mjs` (novo). A foto própria entra por `bridge.request<BlobResult>('pickImage')`, que já existe (sem Kotlin).

### Tarefas
- [ ] `surfaceDetector.ts` — vitest `test/surfaceDetector.test.ts`: retângulo claro inclinado sobre fundo escuro (sem
  alfa) → 4 cantos a ≤ 3 px (na escala de 256) dos verdadeiros, na ordem TL, TR, BR, BL; recorte com alfa (forma opaca
  sobre transparente) → cantos do contorno α > 32; imagem lisa → fallback (quad central), nunca NaN.
- [ ] Estúdio — "Usar foto própria" (`pickImage`) e "🎯 Detectar superfície".
- [ ] `tools/e2e/task20.mjs` — a T2 abaixo.

### Plano de teste
- **Offline (sem slot):** `npx tsc --noEmit` e `npx vitest run test/surfaceDetector.test.ts`.
- **T2 reprodução como o usuário (E2E, no slot):** uma foto de teste enviada por `adb push` para `/sdcard/Pictures/`
  como base → "🎯 Detectar superfície" → cantos dentro de ±5 % do objeto da foto; arrastar uma alça com `drag` e
  conferir o canto movido; print do aparelho.
- **Controle positivo:** no APK da base (com a TASK-08), o estúdio não tem "Detectar superfície".
- **T3 regressão direcionada:** `task08.mjs` (estúdio e alças) e vitest inteiro.

### Sessões seguintes (sugestão daquele planning)
- dev: effort medium + ultrathink.
- teste: effort medium, sem ultrathink.
