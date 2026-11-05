# [TASK-15] Preencher Texto com Foto (Text Image Fill)

> **Origem:** dividida da TASK-06 pelo dono em 2026-11-05 (§2.2 original "Preenchimento de Texto com Imagem"). A
> TASK-06 ficou com as molduras de recorte e a [TASK-16](16-pathfinder-operacoes-booleanas-de-formas.md) com o
> Pathfinder. **Independente** das duas: não usa nada delas. Doc original:
> `git show cbf5f41:docs/tasks/open/06-molduras-clip-frames-e-operacoes-booleanas.md`.

## Metadados e Esforço Mensurado

| Campo | Valor |
| :--- | :--- |
| **ID** | `TASK-15` |
| **Prioridade** | **Média (P2)** |
| **Esforço Mensurado** | **Baixo** — **~0,5 a 1 dia útil (4h–6h / 1 a 2 Story Points)**; ~300 linhas novas estimadas (código + teste + E2E) |
| **Escopo** | 100% Local (`editor-web` em TypeScript / Fabric.js 7.4.0) |
| **Referência Analisada (`com.desygner.ads`)** | `extracted/assets/public/docs/create.md` (L871–L890: Text Image Fill) |

### Detalhamento do Esforço por Subtarefa
1. **Preenchimento de Texto com Imagem (`Pattern` fill em `Textbox`, enquadramento *cover* refeito quando o texto muda):** ~3h.
2. **Testes Unitários (Vitest), E2E e Integração na UI (`main.ts`):** ~2h.

---

## 1. Contexto e Problema Atual

Títulos grandes preenchidos com uma foto ou textura (ex.: `"VERÃO"` com uma praia dentro das letras, `"50%"` com a
textura do produto) são comuns em anúncios. Hoje o texto do editor só aceita cor sólida ou degradê (TASK-12): não há
como preencher as letras com uma imagem.

---

## 2. O que deve ser feito (Especificação Técnica Detalhada)

### 2.1. Preenchimento de Texto com Imagem (`Text Image Fill`)
1. Em `textProps()` (`main.ts`), adicionar a opção **"🖼️ Preencher texto com foto"** e **"Remover foto"**.
2. Ao escolher uma foto (da galeria, por `pickImage`), criar um `Pattern` do Fabric
   (`new Pattern({ source: htmlImageEl, repeat: 'no-repeat', patternTransform: [...] })`) escalado automaticamente para
   cobrir `t.width × t.height` (`object-fit: cover`).
3. O enquadramento *cover* é refeito sempre que a caixa do texto muda (digitar, redimensionar, trocar fonte/tamanho).
4. Serializar o necessário para recriar o `Pattern` no `loadFromJSON` e no `exportSvg` (ver "Análise herdada": o
   Fabric já serializa o `Pattern`; a propriedade própria serve para marcar o preenchimento e refazer o *cover*).

---

## 3. Arquivos a Criar / Modificar

| Arquivo | Ação | Descrição |
| :--- | :---: | :--- |
| `editor-web/src/textImageFill.ts` | **Criar** | `coverPatternTransform(imgW, imgH, boxW, boxH)` e helpers de criar/refazer o `Pattern` do texto. |
| `editor-web/src/document.ts` | **Modificar** | `'textPatternSrc'` em `CUSTOM_PROPERTIES`. |
| `editor-web/src/editor.ts` | **Modificar** | `setTextImageFill(url \| null)` e refit do *cover* no mesmo ponto do `refreshGradient`. |
| `editor-web/src/main.ts` | **Modificar** | **"🖼️ Foto no texto"** e **"Remover foto"** em `textProps()`. |
| `editor-web/test/textImageFill.test.ts` | **Criar** | Cover cobre a caixa; round-trip do texto com padrão; refit quando a caixa muda. |
| `tools/e2e/task15.mjs` | **Criar** | E2E no aparelho (Plano de teste abaixo). |
| `editor/src/main/assets/editor/index.html` | **Regerar** | Bundle do editor. |

---

## 4. Critérios de Aceite e Verificação

- [ ] Um texto qualquer pode ser preenchido com uma foto da galeria, que cobre as letras inteiras (*cover*) e
  acompanha a caixa quando o texto é editado ou redimensionado.
- [ ] "Remover foto" volta o texto à cor sólida; ↶ desfaz a aplicação com 1 toque.
- [ ] O texto com foto sobrevive a salvar e reabrir o rascunho e aparece igual na exportação PNG, JPG, SVG e Vídeo MP4.
- [ ] `npx vitest run` e `npm run build` passam sem erros.

---

## Análise herdada — planning 20261105-1638 da TASK-06 (antes da divisão)

**Veredito daquele planning:** bloqueado por tamanho (TASK-06 inteira); esta parte foi separada pelo dono em
2026-11-05. O próximo planning confere a análise contra a base (as linhas são da base `0d616c3`) em vez de refazê-la.
**Complexidade estimada:** baixa — 1 módulo novo pequeno e pontos de integração já mapeados; tudo em `editor-web`.
**Reserva prevista:** `editor-web/src/textImageFill.ts` (novo), `editor-web/src/editor.ts`, `editor-web/src/main.ts`,
`editor-web/src/document.ts`, `editor-web/test/textImageFill.test.ts` (novo), `tools/e2e/task15.mjs` (novo),
`editor/src/main/assets/editor/index.html` (bundle regerado).

### Estado atual (símbolos abertos)
- Fabric `Pattern/Pattern.ts::toObject` serializa `source` (= `img.src`) e `fromObject` recarrega a imagem;
  `util/misc/objectEnlive.ts::enlivenObjectEnlivables` (L157–186) revive o `fill` com `type:'pattern'` no
  `loadFromJSON` → o `textPatternSrc` é redundante para o revive; o que falta é **refazer o `patternTransform`
  (cover) quando a caixa do texto muda**, no mesmo ponto do `refreshGradient` (`editor.ts` L120–121, eventos
  `object:modified`/`text:changed`; `refreshGradient` L837).
- Export SVG: `FabricObjectSVGExportMixin.ts::_createBaseSVGMarkup` (L195–257) já emite `fill` de Pattern/Gradient
  (`isFiller`) → o SVG do texto com foto vem de graça. PNG/JPG e vídeo desenham pelo canvas do Fabric.
- `editor-web/src/document.ts::CUSTOM_PROPERTIES` (L76) → `FabricObject.customProperties` (`editor.ts` L54): o que
  entrar ali vai no `toObject()`, no snapshot e no undo. Lição da TASK-12: spec gravada no objeto **não pode ter
  campo `type`** com nome de classe do Fabric (o revive a transforma).
- `main.ts::textProps` (L543) — painel do texto selecionado; é onde entram os botões. `pickImage` (ponte) já devolve
  a foto da galeria como blob servido pelo editor.

### Provas (comando literal -> resultado)
- `grep -n "clipPath\|Pattern" editor-web/src/editor.ts editor-web/src/main.ts` → só `editor.ts:429` (comentário de
  degradê) e `editor.ts:1279`: não há padrão de imagem hoje.
- Estimativa: `textImageFill.ts` ~60 + `editor.ts` ~50 + `main.ts` ~40 + teste ~60 + E2E ~90 ≈ **~300**.

### Hipóteses descartadas (e por quê)
- *`textPatternSrc` para reviver o padrão* — o Fabric já serializa e revive `Pattern` pelo `fill`; a spec própria só
  serve para marcar o preenchimento e refazer o *cover* quando o texto muda.

### Tarefas
- [ ] `editor-web/src/textImageFill.ts` (novo) — `coverPatternTransform(imgW, imgH, boxW, boxH)` — vitest: o cover
  cobre a caixa inteira (escala = max das razões) e centra a imagem.
- [ ] `editor-web/src/document.ts::CUSTOM_PROPERTIES` — `textPatternSrc` — vitest: round-trip `toObject`/`loadFromJSON`
  de um texto com padrão devolve `fill` do tipo `Pattern`.
- [ ] `editor.ts` — `setTextImageFill(url | null)` e refit do cover junto do `refreshGradient` — vitest: mudar a
  largura do texto refaz o `patternTransform`.
- [ ] `main.ts::textProps` — `🖼️ Foto no texto` (galeria via `pickImage`) e "Remover foto".
- [ ] `tools/e2e/task15.mjs` — a T2 abaixo.

### Plano de teste
- **Offline (sem slot):** `npx tsc --noEmit` e `npx vitest run` em `editor-web/`.
- **T2 reprodução como o usuário (E2E, no slot):** "Novo design → Post Facebook"; texto "VERÃO" → `🖼️ Foto no texto`
  → galeria (`/sdcard/Pictures/e2e_swap.jpg`) → sinal: `fill` é `Pattern` e o pixel dentro de uma letra no
  `editor.renderPageCanvas()` ≠ a cor sólida antiga; editar o texto → o padrão continua cobrindo; ↶ desfaz; exportar
  PNG e SVG; print do aparelho em cada passo.
- **Controle positivo:** APK da base: o botão "Foto no texto" não existe e `editor.setTextImageFill` é `undefined`.
- **T3 regressão direcionada:** `task12.mjs` (degradê em texto — o refit do padrão divide o ponto com o
  `refreshGradient`), `task14.mjs` (localizar e substituir em texto), `task02` (estilos de texto) se houver E2E; vitest inteiro.

### Sessões seguintes (sugestão)
- dev: effort medium, ultrathink não.
- teste: effort medium, ultrathink não.
