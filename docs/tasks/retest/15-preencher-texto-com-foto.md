# [TASK-15] Preencher Texto com Foto (Text Image Fill)

## Status (pipeline 20261106-0749 — aprovado no teste rodada 2, 2026-11-06)

**Feito:** no painel do texto, **🖼️ Foto no texto** (foto da galeria por `pickImage`) preenche as letras com um `Pattern`
em *cover* (`textImageFill.ts::coverPatternTransform`), refeito quando a caixa muda (editar, alça lateral, fonte/tamanho:
ramo novo no `refreshGradient`); **Remover foto** volta à cor sólida de antes (marca `textImageFill = { src, fallback }`);
↶ desfaz a aplicação com 1 toque; sobrevive a salvar/reabrir o rascunho; PNG, JPG, SVG (patch do `Pattern.toSVG` com
`patternTransform` em `userSpaceOnUse`) e a camada do vídeo MP4 saem com a foto. Rodada 1 reprovada só pelo script E2E
(modo base, máscara das letras com o fundo, alça arrastada para dentro); corrigido na rodada 2, código da funcionalidade igual.

**Commits** (sobre `origin/main` @ `9bb7ece`): `f8816fd` feat(editor) TASK-15 (código + bundle `index-DZlddecC.js`),
`80cde91` docs (rodada 1 reprovada), `37a6a99` feat(editor) correção do `tools/e2e/task15.mjs`, e este commit de docs.

**Aparelho:** emulador `emulator-5554` (sdk_gphone64_x86_64, API 34; único no adb). APK do fix `f7cce1a7…71af` = `sha256sum`
do `base.apk` instalado; APK da base `0a4f0086…3de9`. Ficou instalado o APK do fix.

**Evidência** (`C:\projects\sandbox\.bugfix-pipeline-product_photo_offline\evidencia\20261106-1045-task-15-preencher-texto-com-foto-r2\`):
- Offline: `npx tsc --noEmit` limpo; `npx vitest run` 29 arquivos / 319 testes; `build` do helper base e fix EXIT 0, lane limpa.
- Controle positivo (APK base): `E2E_MODE=base node tools/e2e/task15.mjs` **3/3** — botão "Foto no texto" ausente e
  `editor.setTextImageFill` indefinido (`t2-base.txt`, `base/`).
- T2 (APK fix): `node tools/e2e/task15.mjs` **25/25** (`t2-fix.txt`, prints em `fix/`): máscara 161 de 429 pontos da grade
  (só letras), foto nas letras com 7 cores, cover, ↶, texto editado, alça para fora (971,6 → 1063,0, `patternTransform`
  refeito), Remover foto, rascunho reaberto (mesmo `patternTransform`, pixels iguais), PNG, JPG, SVG (90/95), MP4 camada (90/95).
- T3: `task12` 40/40, `task14` 50/50, `task09` 26/26 (`t3-*.txt`); Kotlin `testDebugUnitTest` 211 testes, 0 falhas.
- T4: `logcat-janela.txt` sem `FATAL`/`ANR` nem erro de console do WebView; só `Seed missing signature` e
  `Uncaught exception thrown by finalizer`, iguais na base (rodada 1) → ambiente.

**Falta para `done/`:** validação do dono no celular dele (foto real da galeria em título grande; exportar MP4 de verdade
pelo FFmpeg, que o teste conferiu só pela camada `layer_N.png` do pacote). Sobras no emulador: rascunhos `E2E15_*` e
`/sdcard/Pictures/e2e_task15.jpg`.

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
  (`isFiller`) → o SVG do texto com foto vem de graça.
  > **Corrigido (dev, pipeline 20261106-0749):** não vem de graça — `Pattern.toSVG` ignora o `patternTransform`; ver
  > Planejamento, Causa raiz item 3, e o `installPatternSvg` da Correção. PNG/JPG e vídeo desenham pelo canvas do Fabric.
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

---

## Planejamento (pipeline 20261106-0749, 2026-11-06)

**Veredito:** corrigir — implementável só em `editor-web` (+ bundle); a análise herdada confere com a base `80b97d7`,
com UMA correção: o SVG do Fabric **não** sai "de graça" (ver Causa raiz, item 3).
**Complexidade:** media — um módulo (`editor-web`), vários arquivos (novo `textImageFill.ts` + `editor.ts`, `main.ts`,
`document.ts`) e um fluxo novo de UI; nada de Kotlin, ponte ou formato de dados novo (o `fill` Pattern é JSON do Fabric).
**Severidade:** medio — funcionalidade nova P2; sem ela o usuário não tem foto dentro do texto, mas nada quebra.
**Arquivos a alterar (reserva da onda):**
- `editor-web/src/textImageFill.ts` — NOVO: `coverPatternTransform`, criar/refazer o `Pattern` do texto, `toSVG` do Pattern que respeita `patternTransform`
- `editor-web/src/editor.ts` — `setTextImageFill(url|null)`, `textImageFillOf`, refit no `refreshGradient`, limpar a marca no `set`/`setObjectGradient`, instalar o `toSVG`
- `editor-web/src/main.ts` — botões "🖼️ Foto no texto" / "Remover foto" em `textProps`
- `editor-web/src/document.ts` — `'textImageFill'` em `CUSTOM_PROPERTIES`
- `editor-web/test/textImageFill.test.ts` — NOVO
- `tools/e2e/task15.mjs` — NOVO (T2)
- `editor/src/main/assets/editor/index.html` — bundle regerado (mais os `assets/index-<hash>.*` que o `git status` listar, por `claim`)

### Causa raiz (símbolos abertos: `arquivo::simbolo` — faz X; em erro, Y)
"Causa" = por que a funcionalidade não existe e onde ela se encaixa. Caminhos `fabric/src/...` = `editor-web/node_modules/fabric/src/...` (7.4.0).
1. **Render no canvas (funciona com `patternTransform`).**
   - `fabric/src/shapes/Text/Text.ts::handleFiller` (L1295–1320) — com `patternTransform` presente, translada para
     `(-width/2, -height/2)` e usa `_applyPatternGradientTransformText` (L1267–1293): desenha o Pattern num canvas
     `(width+strokeWidth) × (height+strokeWidth)` chamando `Object.ts::_applyPatternGradientTransform` (L1081–1102:
     `ctx.transform(1,0,0,1,-w/2+offsetX,-h/2+offsetY)` e depois `t`). Logo o `patternTransform` é em **pixels da caixa
     local do texto, origem no canto superior esquerdo** — o mesmo referencial do `gradientBox` (`gradients.ts::gradientBox`
     L124, `max(1, w/h)`). Detalhe: com contorno, o canvas auxiliar tem `+strokeWidth` e o padrão fica deslocado
     `strokeWidth/2`; as letras ficam dentro da caixa, então o *cover* continua cobrindo as letras.
   - `fabric/src/Pattern/Pattern.ts::toLive` (L126) — devolve `null` se a imagem ainda não carregou
     (`!complete || naturalWidth===0`): o texto some até o load → `setTextImageFill` deve **esperar o load**
     (`util.loadImage(url)`, exportado por `fabric/src/util/index.ts` L86; `util` já é importado em `editor.ts`) antes
     do `set`, e só então `commit()`. Em erro de load (`loadImage` rejeita), não mexer no texto e deixar o `run` mostrar o erro.
   - Envelope warp (`curve.ts::renderWarpedEnvelope` L299–345) chama o `_render` original num offscreen `w×h`: o
     preenchimento passa por `handleFiller` igual. Texto em caminho (`refitCurve` L1857–1899 põe `path`): também.
2. **Serialização / undo / rascunho (já funciona).**
   - `Pattern.ts::toObject` (L147–160) grava `type:'pattern'`, `source` = `img.src` (URL `/blob/…`, não dataURL),
     `repeat`, `offsetX/Y`, `patternTransform`; `Pattern.fromObject` (L192–212) recarrega com `loadImage` (assíncrono).
   - `fabric/src/util/misc/objectEnlive.ts::enlivenObjectEnlivables` (L157–186) revive todo valor com `type` registrado
     (o `fill` Pattern) no `loadFromJSON` → undo (`editor.ts::undo` L546 → `restore` → `loadFromJSON` aguardado) e
     reabrir rascunho (L477, `withoutHistory(loadFromJSON)`) trazem o Pattern de volta com o mesmo `patternTransform`.
   - Blob da galeria: `EditorSession.kt::pickImage` (L191) grava em `filesDir/editor/blobs` (`EditorAssets.kt` L20);
     nenhum código apaga `blobDir` (grep de `delete` no `:editor`/`:app` só acha exportações, vídeo e lote) → a URL
     do padrão continua válida ao reabrir. Mesma origem do asset loader → canvas não fica "tainted" no PNG.
   - `document.ts::CUSTOM_PROPERTIES` (L97–121) → `FabricObject.customProperties` (`editor.ts` L68): a marca própria
     entra no `toObject`/snapshot. Regra da TASK-12/05: **sem campo `type`** no objeto gravado.
3. **SVG — NÃO sai certo de graça (correção da análise herdada).**
   - `FabricObjectSVGExportMixin.ts::_createBaseSVGMarkup` (L195–257) emite `fill.toSVG(this)` quando `isFiller(fill)`.
   - `Pattern.ts::toSVG` (L167–188) **ignora `patternTransform`**: gera `<pattern>` com `patternUnits` padrão
     (objectBoundingBox: x/y/width/height em fração da *bbox dos glifos*, não da caixa) e a `<image>` no tamanho
     NATURAL da foto. Com o *cover* (escala ≠ 1, centrado) o SVG mostraria outro recorte da foto.
   - O texto no SVG vive no referencial centrado do objeto: `TextSVGExportMixin.ts::_getSVGLeftTopOffsets` (L60–66)
     `textLeft=-width/2, textTop=-height/2`.
   - → Correção: `textImageFill.ts::installPatternSvg(Pattern)` (instalado em `editor.ts` ao lado de
     `installWarpRenderer(Textbox)` L69, mesmo padrão de patch de protótipo já usado em `curve.ts::installWarpRenderer`
     L352): quando `this.patternTransform` existe e `repeat==='no-repeat'`, emitir
     `<pattern id="SVGID_<id>" patternUnits="userSpaceOnUse" x="<-w/2>" y="<-h/2>" width="<w>" height="<h>"><image
     x="0" y="0" width="<naturalW>" height="<naturalH>" transform="matrix(a b c d e f)" xlink:href="<src>"/></pattern>`
     (escapeXml no href; `w/h` = `width/height` do objeto passado ao `toSVG`); senão, o `toSVG` original.
     `svgExport.ts::inlineSvgResources` (L19–38) já troca o `xlink:href` por dataURL na exportação.
4. **PNG/JPG/vídeo** desenham pelo canvas do Fabric: `editor.ts::renderPageCanvas` (L2147), `exportVideoBundle`
   (L2249–2300: cada camada sozinha por `renderRegion`) → cobertos pelo item 1.
5. **Pontos de integração (refit do *cover*).**
   - `editor.ts::refreshGradient` (L1420–1426) — hoje retorna se `!(o.fill instanceof Gradient)`. É chamado em TODO
     ponto em que a caixa muda: `object:modified`/`text:changed` (L174–175, **depois** do `refitCurve`), `set` (L1388,
     depois do `refitCurve` quando muda layout), `setTextContent` (L1812: localizar/substituir, lista), `main.ts` L798,
     fundo (L763/L895). → acrescentar ali o ramo do padrão (`o.fill instanceof Pattern && textImageFillOf(o)` →
     `refitTextImageFill(o)`), sem criar call-sites novos.
   - `editor.ts::set` (L1352–1357) zera `customGradient` quando chega `fill` string → zerar também `textImageFill`
     (senão a marca fica órfã). `setObjectGradient` (L1405–1417) → zerar `textImageFill`; `setTextImageFill` → zerar
     `customGradient` e `brandColor` (o brand kit em `set` L1367–1373 só troca `fill` string, então o Pattern sobrevive).
   - `main.ts::textProps` (L622–676) — 1ª linha `.row.scroll` tem `🌈 Degradê` (`gradient-btn`): os botões novos
     entram ao lado. `colorInput('Cor', String(t.fill), …)` (L639) mostraria `[object Object]` com Pattern (mesmo caso
     do degradê hoje): passar `'#000000'` quando `fill` não for string.
   - `main.ts::showSwapImage` (L1032–1047) é o modelo de uso: `bridge.request<BlobResult>('pickImage')` dentro de
     `run('Abrindo imagem', …)`; `BlobResult` (`protocol.ts` L141) = `{url,width,height}`.
   - `main.ts::textContrast` (L506–508) já devolve `null` com `fill` não-string ("degradê/padrão: fora do verificador").

### Provas (comando literal -> resultado)
- `grep -rn "patternTransform" node_modules/fabric/src --include=*.ts | grep -v spec` (em `editor-web/`) → só
  `StaticCanvas.ts:646`, `Pattern.ts:68/157/197/208`, `Object.ts:987/1090`, `Text.ts` (handleFiller): **nenhum uso
  em `toSVG`** → o SVG precisa do patch do item 3.
- `grep -n '"version"' node_modules/fabric/package.json` → `7.4.0`.
- `grep -n "refreshGradient" src/editor.ts src/main.ts` → 9 ocorrências (L174, 175, 763, 895, 1388, 1420, 1812,
  2370 comentário, main L798): o ramo do padrão dentro de `refreshGradient` cobre todas.
- `grep -rn "pickImage" tools/e2e/*.mjs` → nenhum E2E chama a ponte direto; o seletor real é dirigido por
  `pickFirstPhoto` (`task09.mjs` L70–83: `uiautomator dump` + toque na 1ª "Photo taken/Foto tirada").
- `ls node_modules | grep -E "^canvas$|jsdom"` → `canvas` e `jsdom` presentes: vitest com `fabric/node` carrega
  imagem por dataURL (modelo: `test/gradientsAndConnectors.test.ts` L54–56, round-trip `Rect.fromObject(r.toObject())`).

### Hipóteses descartadas (e por que)
- *"O SVG do texto com foto vem de graça"* (análise herdada) — falso: `Pattern.toSVG` não usa `patternTransform`
  nem a caixa do texto (item 3).
- *Fonte do Pattern = canvas já recortado em cover (sem `patternTransform`)* — o `toObject` gravaria `toDataURL()`
  (`Pattern.ts::sourceToString` L119–125) no rascunho e em cada snapshot de undo (MB por passo); a URL `/blob/…` com
  `patternTransform` fica pequena.
- *Subclasse `TextPhotoPattern` registrada no `classRegistry`* — `toObject` grava `type:'pattern'` fixo e o revive
  cairia no `Pattern` base; o patch do `toSVG` (só ativo com `patternTransform`) é menor e não muda o JSON.
- *Marca só com a URL (`textPatternSrc`)* — "Remover foto" precisa da cor sólida de antes; gravar
  `textImageFill = { src, fallback }` (sem `type`). A marca não é usada para reviver (o Fabric revive o `fill`).
- *Refit em listeners novos* — `refreshGradient` já está em todos os pontos em que a caixa muda (Provas).

### Tarefas
- [ ] `editor-web/src/textImageFill.ts` (novo) — `coverPatternTransform(imgW, imgH, boxW, boxH)`:
  `s = max(boxW/imgW, boxH/imgH)`, `[s,0,0,s,(boxW-imgW*s)/2,(boxH-imgH*s)/2]`; `isTextImageFill(v)`;
  `refitTextImageFill(o)` (lê `naturalWidth/Height` do `source`, refaz `patternTransform` com `gradientBox(o)`);
  `installPatternSvg(PatternClass)` — vitest: cover cobre a caixa (4 cantos da caixa caem dentro da imagem
  transformada) e centra; caixa mais larga/mais alta que a foto; `toSVG` com `patternTransform` contém
  `patternUnits="userSpaceOnUse"`, `x="-w/2"` e `matrix(...)`; sem `patternTransform` = saída original.
- [ ] `editor-web/src/document.ts::CUSTOM_PROPERTIES` — `'textImageFill'` — vitest: `Textbox` com `fill` Pattern
  (dataURL) + marca → `Textbox.fromObject(JSON.parse(JSON.stringify(t.toObject())))` devolve `fill instanceof Pattern`,
  mesmo `patternTransform` e a marca.
- [ ] `editor-web/src/editor.ts` — `textImageFillOf(o)`; `async setTextImageFill(url|null, target)` (carrega a imagem,
  `new Pattern({source, repeat:'no-repeat', patternTransform: cover})`, grava marca, zera `customGradient`/`brandColor`,
  1 `commit()`; `null` → `fill = fallback`, marca `undefined`); ramo do padrão em `refreshGradient`; `set` com `fill`
  string e `setObjectGradient` zeram `textImageFill`; `installPatternSvg(Pattern)` ao lado de `installWarpRenderer` —
  vitest (em `textImageFill.test.ts`, com `refitTextImageFill` puro): mudar `width` do Textbox e refazer muda o
  `patternTransform` e continua cobrindo.
- [ ] `editor-web/src/main.ts::textProps` — `🖼️ Foto no texto` (classe `text-photo-btn`; `pickImage` via `run`, depois
  `editor.setTextImageFill(r.url)` e `renderProps(t)`) e `Remover foto` (classe `text-photo-remove`, só com a marca);
  `colorInput` 'Cor' com `'#000000'` quando `fill` não for string — prova: T2.
- [ ] `tools/e2e/task15.mjs` (novo, modelo `task12.mjs`/`task09.mjs` com `pickFirstPhoto`) — a T2 abaixo.
- [ ] Doc: ao implementar, anotar na "Análise herdada" que o "Export SVG ... vem de graça" foi corrigido pelo item 3.

### Plano de teste
- **Offline (sem slot):** em `editor-web/`: `npx tsc --noEmit`; `npx vitest run test/textImageFill.test.ts` e
  `npx vitest run` inteiro (sem `fail` novo); o `build` do helper (bundle + vitest + Kotlin) sai 0.
- **T2 reprodução como o usuário (E2E, no slot):** pré-condição: uma foto na galeria (o script faz `adb push` de um
  JPG gerado — ex.: listras coloridas 1200×800, para o pixel ser inequívoco — para `/sdcard/Pictures/e2e_task15.jpg`
  + `am broadcast -a android.intent.action.MEDIA_SCANNER_SCAN_FILE -d file:///sdcard/Pictures/e2e_task15.jpg`, para ser a
  1ª do seletor). `launchEditor('Post Facebook')` → aba **Texto** → "Adicionar título" → editar para `VERÃO` (tamanho
  grande) → no painel, **🖼️ Foto no texto** → seletor: `pickFirstPhoto` → sinais:
  (a) `editor.active.fill` é `Pattern` (`toObject().fill.type==='pattern'`), `textImageFill.src` = a URL `/blob/…`;
  (b) `editor.renderPageCanvas(1080,(o)=>o===t)`: pixels em 3+ pontos dentro das letras ≠ a cor sólida anterior e
  com variação de cor (a foto, não cor única); (c) cobertura: os 4 cantos da caixa mapeados pela inversa do
  `patternTransform` caem dentro de `[0,imgW]×[0,imgH]`; (d) **editar o texto** pela UI para `VERÃO 50%` e **arrastar
  a alça lateral** do Textbox → `patternTransform` mudou e (c) continua valendo; (e) **↶** uma vez logo após aplicar
  → `fill` volta à cor sólida (1 toque desfaz a aplicação); reaplicar; (f) **Remover foto** → `fill` string = cor
  anterior, `textImageFill` ausente; reaplicar; (g) renomear, salvar e **reabrir o rascunho** (Meus designs) → `fill`
  Pattern de novo, mesmo `patternTransform`, pixel (b) igual; (h) **exportar PNG e JPG** (Salvar na galeria) →
  arquivo em `/sdcard/Pictures/ProductPhoto/`, `adb pull`, pixel dentro da letra ≠ cor sólida; (i) **SVG**:
  `await editor.exportSvg()` (o mesmo que o botão chama, `main.ts` L2316) contém `<pattern … patternUnits="userSpaceOnUse"`,
  `matrix(`, `href="data:image/` e o texto com `fill: url(#SVGID_…)`; (j) **MP4**: exportar vídeo curto (ou
  `editor.exportVideoBundle('mp4')` como complemento) → o PNG da camada do texto tem pixel da foto. Print do
  aparelho (`screencap`) em cada passo.
- **Controle positivo:** APK da base sincronizada: no painel do texto não existe o botão "Foto no texto"
  (`document.querySelector('#props .text-photo-btn') === null`) e `typeof editor.setTextImageFill === 'undefined'` →
  o script em modo BASE confere isso e para (a funcionalidade está ausente).
- **T3 regressão direcionada:** `node tools/e2e/task12.mjs` (degradê em texto/forma/fundo: divide o
  `refreshGradient` e o `set` que agora zera a marca), `task14.mjs` (localizar/substituir: `setTextContent` →
  refresh), `task09.mjs` (galeria + rascunho + páginas); vitest inteiro (`gradientsAndConnectors`, `textTools`,
  `svgExport`, `document`). Logcat do PID sem erro de console do WebView (`Pattern`/`toSVG`).

### Sessões seguintes
- dev: effort high, ultrathink não — transformação de padrão no Fabric e SVG em referencial próprio (manual: `high`
  para geometria no Fabric), mas as fórmulas, os pontos de integração e o patch estão especificados acima.
- teste: effort medium, ultrathink não — E2E no molde do `task12`/`task09`; o único passo sutil é o seletor de fotos
  (já resolvido por `pickFirstPhoto`).

---

## Correção (pipeline 20261106-0749, rodada 1)

**O que mudou (`arquivo::simbolo`):**
- `editor-web/src/textImageFill.ts` (novo) — `coverPatternTransform(imgW, imgH, boxW, boxH)` (escala = max das razões,
  centrada); `isTextImageFill` (marca `{ src, fallback }`, recusa objeto com `type`); `patternSourceSize` (natural do
  `<img>` ou tamanho do canvas; `null` sem pixels); `refitTextImageFill(o)` (refaz o `patternTransform` na caixa atual
  e marca `dirty`, porque o cache do Fabric não vê a mudança dentro do `fill`); `installPatternSvg(PatternClass)` (patch
  do `Pattern.prototype.toSVG`: com `patternTransform` + `no-repeat` emite `<pattern patternUnits="userSpaceOnUse"
  x=-w/2 y=-h/2 width=w height=h>` com a `<image>` no tamanho natural e `transform="matrix(...)"`; senão, o original).
  Sem import de runtime do Fabric (as classes chegam por parâmetro), como `curve.ts::installWarpRenderer`.
- `editor-web/src/document.ts::CUSTOM_PROPERTIES` — `'textImageFill'`.
- `editor-web/src/editor.ts` — import de `Pattern`; `installPatternSvg(Pattern)` ao lado de `installWarpRenderer`;
  `textImageFillOf(o)` (marca válida E `fill instanceof Pattern`); `async setTextImageFill(url | null, target)`:
  `util.loadImage(url)` ANTES do `set` (erro de carga rejeita sem tocar no texto; o `run` do main mostra o toast),
  `new Pattern({ source, repeat: 'no-repeat', patternTransform: cover })`, marca com `fallback` = cor sólida atual (ou
  a da marca anterior, ou a 1ª parada do degradê), zera `customGradient`/`brandColor`, 1 `commit()` (= 1 passo do undo);
  `null` → `fill = fallback`, marca `undefined`. `refreshGradient` — ramo novo no topo: texto com a marca →
  `refitTextImageFill` (cobre todos os call-sites já existentes: `object:modified`, `text:changed`, `set`,
  `setTextContent`...). `set` com `fill` string zera `textImageFill` (como já zerava `customGradient`);
  `setObjectGradient` zera `textImageFill` nos dois ramos.
- `editor-web/src/main.ts::textProps` — `🖼️ Foto no texto` (`text-photo-btn`, `primary` quando aplicada) →
  `pickTextPhoto(t)` (`pickImage` por `run`, depois `editor.setTextImageFill(r.url, t)` por `run`, `renderProps`); `Remover
  foto` (`text-photo-remove`, só com a marca). `colorInput('Cor')` recebe `'#000000'` quando o `fill` não é string
  (antes mostraria `[object Object]` com degradê/foto).
- `editor-web/test/textImageFill.test.ts` (novo, 10 testes) — cover em 3 proporções (4 cantos dentro da foto, centrado,
  escala mínima); marca sem `type`; refit ao mudar a caixa; round-trip `toObject → JSON → fromObject` (Pattern, mesmo
  `patternTransform`, `no-repeat`, marca); `toSVG` com o patch (userSpaceOnUse, `x=-w/2`, `matrix(...)`, tamanho
  natural, `fill: url(#SVGID_…)`) e sem `patternTransform` (saída original do Fabric).
- `tools/e2e/task15.mjs` (novo) — a T2 do Plano de teste, passos 1–9 (= sinais a–j) e modo `E2E_MODE=base`.

**Ajustes ao Plano de teste / ao planejamento (o código desmentiu duas premissas):**
- O vitest daqui NÃO tem o `canvas` nativo (`node_modules/canvas/build/Release` não existe; `util.createCanvasElement()
  .getContext('2d')` → `null` e o `util.loadImage(dataURL)` do `fabric/node` nunca resolve — medido com `node -e`, saiu
  `timeout`). Por isso o teste usa um "`<img>` carregado" falso (`{src, naturalWidth, naturalHeight, complete}`) e
  `src` vazio no round-trip (`loadImage('')` resolve na hora), e a caixa é um `Rect` 400×136 em vez de `Textbox` (o
  `Textbox` não mede texto sem canvas: `_setTextStyles` → `null.textBaseline`; mesma limitação anotada no
  `textTools.test.ts`). O `patternTransform`, a marca, o JSON e o referencial centrado do SVG são os mesmos; o texto
  de verdade e os pixels ficam com o E2E.
- T2 — uso do script: `ANDROID_SERIAL=<serial> node tools/e2e/task15.mjs <pasta>` (fix) e o mesmo com
  `E2E_MODE=base` no APK da base (PASS = botão ausente e `setTextImageFill` indefinido). O script gera o JPG de listras
  (1200×800, 6 cores) no próprio WebView, faz `adb push` para `/sdcard/Pictures/e2e_task15.jpg` + broadcast do media
  scanner e escolhe a 1ª foto do seletor (`pickFirstPhoto`); imprime o tamanho da foto escolhida. Reabrir o rascunho é
  por **Rascunhos** (como o `task09`), não "Meus designs". (j) MP4: confere o `layer_<i>.png` do pacote do FFmpeg
  (`exportVideoBundle('mp4')`, o mesmo que o botão manda ao Kotlin); o pacote não lista as camadas, então o offset é a
  caixa do texto − margem 2 (fórmula do `exportVideoBundle`). (i) SVG: além das strings, desenha o SVG num `<img>` do
  WebView e compara os pixels das letras com o editor (≥ 80% iguais, tolerância 60).
- Resultado offline: `npx tsc --noEmit` limpo; `npx vitest run test/textImageFill.test.ts` 10/10; `npx vitest run`
  29 arquivos / 319 testes passando.

---

### Teste rodada 1 — reprovado

**Data:** 2026-11-06 · **Aparelho:** `emulator-5554` (sdk_gphone64_x86_64, API 34; único no adb) · **Base:** `9bb7ece`
· **Fix:** `f8816fd` (APK com sha256 conferido no aparelho) · **Evidência:**
`C:\projects\sandbox\.bugfix-pipeline-product_photo_offline\evidencia\20261106-1027-task-15-preencher-texto-com-foto\`

**Motivo da reprovação: o script da T2 (`tools/e2e/task15.mjs`, entregável desta task) está errado em 3 pontos.** A
funcionalidade em si passou em tudo que testei no aparelho (abaixo), mas o script é a prova que fica no repositório e
que o dono roda no retest: hoje ele dá **FAIL** com a funcionalidade certa, dá **PASS** num critério que não exercitou,
e o modo base quebra.

| # | Teste | Esperado | Observado | Causa (aberta e medida) |
|---|---|---|---|---|
| 1 | `E2E_MODE=base node tools/e2e/task15.mjs` (APK da base) | os 2 checks BASE e PASS | aborta: `TypeError: editor.textImageFillOf is not a function` em `task15.mjs:159` (`const solid = (await info('VERÃO')).fill`) | `info()` chama `editor.textImageFillOf` ANTES do `if (BASE)`. Na base a função não existe → o modo base nunca chega aos checks. (`t2-base.txt`) |
| 2 | 9j MP4 (fix) | PASS | **FAIL** `iguais 98 de 429` | `letterPixels` filtra "dentro das letras" por alfa 255 no `editor.renderPageCanvas(1080, o => o === t)`, mas o `renderPageCanvas` desenha o `backgroundColor` do canvas (`#ffffff`) mesmo com o filtro: alfa é 255 em todo ponto (medido: canto `[255,255,255,255]`, entre linhas idem → `diag/alpha-check.txt`). Os 429 pontos = a grade inteira 39×11. Os pontos de fundo são brancos no editor e transparentes (→ preto) no `layer_0.png`, e falham. O `layer_0.png` está CERTO (`diag/diag-layer.png` × `diag/diag-only.png`). O mesmo defeito enfraquece 2b ("todo ponto ≠ cor sólida" passa pelo fundo branco), 6g/7h/8i (comparam a grade inteira, fundo incluído). |
| 3 | 4d alça lateral (fix) | largura muda e o cover é refeito | **PASS falso**: `w0 = 971.6183`, `w = 971.6182861…`, `tr` igual a menos de ruído de float | O drag vai para DENTRO (−120 px), mas o `Textbox` não fica mais estreito que a palavra mais longa ("VERÃO" a 260 px ≈ 960 px): a largura não muda. O check `i4.w !== w0` passa pela diferença de arredondamento (o JSON do undo/rascunho guarda 4 casas). Refeito por mim: drag para FORA (+25 px de tela) → `971.6 → 1045.4`, `patternTransform` refeito, cover ainda cobre (`diag/drag2-check.txt`). |

**O que o dev precisa corrigir (só `tools/e2e/task15.mjs`):**
1. Modo base: ler `fill` sem `editor.textImageFillOf` antes do `if (BASE)` (ex.: `solid` direto de `t.fill`, ou `info()`
   tolerante: `typeof editor.textImageFillOf === 'function' && …`).
2. `letterPixels`: máscara das letras sem fundo. Ex.: tirar o fundo no render só do texto (salvar
   `editor.canvas.backgroundColor`, pôr `'transparent'`, renderizar, restaurar) ou comparar com o render da cor sólida.
   Conferir que `n` < grade inteira (os 429 pontos da grade não podem passar todos). 9j depois disso deve passar: medido com máscara
   pelos pixels opacos do `layer_0.png` → 313/329 iguais ao editor (95%, o resto é borda), 0 na cor sólida, 8 cores
   (`diag/mp4-check.txt`).
3. 4d: arrastar a alça para FORA (o texto não encolhe abaixo da palavra mais longa) e exigir `|w − w0| > 20`; posição da
   alça por `editor.docToClient` (o que usei) e não `oCoords` + `upperCanvasEl`.

**Resultados desta rodada:**
- Offline: `npx tsc --noEmit` limpo; `npx vitest run` 29 arquivos / 319 testes OK; `build` do helper (base e fix) EXIT 0,
  lane limpa depois do build do fix (bundle commitado = fonte).
- Controle positivo (APK base `9bb7ece`): painel do texto SEM "🖼️ Foto no texto" (Degradê presente) e
  `typeof editor.setTextImageFill === 'undefined'` — conferido por CDP depois do crash do script (`t2-base.txt`,
  `base/15-base-painel.png`).
- T2 (APK fix): `t2-fix.txt` 23/24 — 2a, 2b, 2c, 3 (↶ 1 toque), 4 (texto editado), 5f (Remover foto), 6g (reaberto
  pelo Rascunhos, mesmo `patternTransform`), 7h PNG e JPG, 8i SVG (424/429 iguais desenhado no WebView) PASS; 9j FAIL
  (defeito 2); 4d alça PASS falso (defeito 3). Refeitos por mim com script próprio: 4d (drag para fora) PASS e 9j (máscara
  certa) PASS → a funcionalidade atende os critérios no aparelho.
- T3: `task12` 40/40, `task14` 50/50, `task09` 26/26; Kotlin `testDebugUnitTest` 211 testes, 0 falhas.
- T4: `logcat-janela.txt` sem `FATAL`/`ANR`; `Seed missing signature` (WebView) e `Uncaught exception thrown by
  finalizer` aparecem igual na janela da base (PID 12864) → ambiente, não o fix.
- Sobras no emulador: rascunho de teste `E2E15_mw50fdpn` e a foto `/sdcard/Pictures/e2e_task15.jpg` (o script não apaga).

### Rodada 1 — reprovada: o script da T2 (`tools/e2e/task15.mjs`) errava em 3 pontos; correção: só o script (vai para a rodada 2)

Motivo (seção "Teste rodada 1 — reprovado"): (1) modo base abortava (`info()` chamava `editor.textImageFillOf` antes do
`if (BASE)`); (2) `letterPixels` usava o render só do texto, mas o `renderPageCanvas` pinta o `backgroundColor` do
canvas mesmo com o filtro → alfa 255 na grade inteira (429/429), o fundo branco entrava como "letra" e o 9j falhava
(o `layer_N.png` é transparente fora das letras); (3) 4d arrastava a alça para DENTRO, o Textbox não encolhe abaixo da
palavra mais longa e o `!==` passava por ruído de float. O código da funcionalidade não mudou.

Correção em `tools/e2e/task15.mjs`:
- `info()` — `mine: typeof editor.textImageFillOf === 'function' && …` (o modo base chega aos 2 checks BASE).
- `letterPixels` — desliga `editor.canvas.backgroundColor`/`backgroundImage` (try/finally restaura) só no render da
  máscara; o render de cor continua o da página inteira. Check novo em 2b: os pontos da máscara são ≥ 20 e < 80% da
  grade (`GRID` = 39×11) — a grade inteira não pode passar. 2b, 6g, 7h, 8i e 9j passam a comparar só pixels de letra.
- 4d — alça `mr` pelo meio de `aCoords.tr`/`aCoords.br` e `editor.docToClient` (não mais `oCoords` + `upperCanvasEl`),
  arrasto de +30 px de tela para FORA; exige `|w − w0| > 20`, algum termo do `patternTransform` mudando > 0,5 e o cover
  cobrindo.
- Offline: `node --check tools/e2e/task15.mjs` OK. Não rodei no aparelho: o dev não usa o slot de teste (etapas/dev.md);
  a rodada 2 do teste roda os dois modos (`E2E_MODE=base` no APK da base e o fix).
