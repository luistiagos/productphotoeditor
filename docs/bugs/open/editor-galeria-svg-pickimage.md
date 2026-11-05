# Editor: escolher um SVG na galeria falha com erro técnico

- **Onde:** editor → "Imagem → Escolher da galeria…" e "🔄 Substituir → Escolher da galeria…" (ponte `pickImage`).
- **Como reproduzir (emulador `pp_api34`, 2026-11-05):** o seletor de fotos do Android lista os SVG de
  `Download/ProductPhoto/teste_fase4_*.svg` (MIME `image/svg+xml`, exportações do próprio app) como "Photo taken on …";
  tocar num deles → toast `Erro: Failed to create image decoder with message 'unimplemented'Input contained an error.`
- **Esperado:** ou o SVG entra (o editor já importa SVG por `addSvgString`), ou uma mensagem clara ("SVG não é suportado
  aqui; use Adesivos/Vetorizar").
- **Não investigado:** o lado Kotlin de `pickImage` (`EditorSession`/`EditorHandlers`) não foi aberto; a causa provável é
  o `ImageDecoder` não decodificar SVG. Achado durante o E2E da TASK-11 (`docs/tasks/retest/11-…md` §5.6).

## Planejamento (pipeline 20261105-1638, 2026-11-05)

**Veredito:** corrigir — o `pickImage` do Kotlin manda a exceção crua do `ImageDecoder` (que não decodifica SVG) como erro `internal`; tratar a falha de decodificação com mensagem clara.
**Complexidade:** baixa — 1 arquivo de produção (`EditorSession.kt`) + o teste JVM existente; sem `editor-web/` (sem bundle).
**Severidade:** baixo — só quem escolhe um SVG (ou outro arquivo indecodificável) no seletor de fotos; o resto do fluxo funciona; o defeito é a mensagem técnica.
**Arquivos a alterar (reserva da onda):**
- `editor/src/main/kotlin/com/productphoto/editor/EditorSession.kt` — `pickImage` captura a falha de decodificação; helper `isSvg` no `companion`
- `editor/src/test/kotlin/com/productphoto/editor/EditorProtocolTest.kt` — teste JVM do `isSvg` (mesmo lugar do teste de `fontExtension`)
- `tools/e2e/bug-editor-galeria-svg-pickimage.mjs` — E2E novo (T2)

### Causa raiz (símbolos abertos: `arquivo::simbolo` — faz X; em erro, Y)
- `editor-web/src/main.ts::showImage` (l.1173) e `::showSwapImage` (l.953) — "Escolher da galeria…" chama
  `run('Abrindo imagem', () => bridge.request<BlobResult>('pickImage'))`; usam só `r.url` (inserir: `editor.addImage`;
  substituir: `editor.swapImage`). Em erro, `run` (l.105) faz `toast(describe(e))` e devolve `undefined` (nada é inserido).
- `editor-web/src/main.ts::describe` (l.89) — `BridgeRequestError` → `"<rótulo do code>: <message>"`; `internal` não
  está no mapa → rótulo `Erro`. `invalid` → `Não foi possível`; `unsupported` → `Recurso indisponível nesta versão`.
- `editor/.../EditorScreen.kt::EditorScreen` (l.43/55) — `EditorHost.pickImage` abre `PickVisualMedia` com
  `ImageOnly` (= `image/*`): o seletor do sistema lista também `image/svg+xml` (os SVG exportados pelo próprio app em
  `Download/ProductPhoto/`). Não há como excluir só SVG nesse contrato (`SingleMimeType` aceita um MIME só).
- `editor/.../EditorSession.kt::pickImage` (l.181) — lê os bytes do `uri` e chama
  `EditorAssets.decodeBytes(bytes, PICK_MAX_SIDE)` SEM try; depois `assets.putPng` e devolve `{url,width,height}`.
  Em erro: nenhum catch — a exceção sobe.
- `editor/.../EditorAssets.kt::decodeBytes` (l.88) — `ImageDecoder.decodeBitmap(ImageDecoder.createSource(ByteBuffer))`.
  O `ImageDecoder` do Android não tem decodificador de SVG → lança `ImageDecoder.DecodeException` (subclasse de
  `IOException`) com a mensagem `Failed to create image decoder with message 'unimplemented'Input contained an error.`
- `editor/.../EditorBridge.kt::EditorBridge.dispatch` (l.175) — `catch (e: Throwable)` →
  `EditorProtocol.fail(req.id, BridgeException.from(e))`. `BridgeException.from` (l.111): `DecodeException` não é
  `BridgeException`/`AiError`/`IllegalArgumentException` → `else` → `ErrorCode.INTERNAL` com `e.message`.
- Resultado = exatamente o toast do sintoma: `Erro: Failed to create image decoder with message 'unimplemented'…`.

### Provas (comando literal -> resultado)
- `grep -n pickImage` (fora do bundle) → só 2 chamadores JS (`main.ts:961`, `main.ts:1176`) e 1 handler Kotlin
  (`EditorSession.kt:93` → `:181`); `EditorHandlers.kt` não participa do `pickImage`.
- `grep -n "decodeBytes"` → `EditorSession.kt:185` é o único decode no caminho do `pickImage`.
- `grep -n "enum class ErrorCode"` → códigos `unsupported|unavailable|network|remote|invalid|cancelled|internal`;
  `describe()` não mapeia `internal` → prefixo `Erro:` (bate com o toast relatado).
- Precedente de helper puro no `companion` testado em JVM: `EditorSession.fontExtension` em
  `EditorProtocolTest.kt:139-142`; `editor/build.gradle.kts:20` `unitTests.isReturnDefaultValues = true`.

### Hipóteses descartadas (e por quê)
- **Fazer o SVG entrar como vetor (`addSvgString`)** — exigiria mudar o contrato da ponte (`protocol.ts`
  `BlobResult` → variante com `svg`), `main.ts` (dois chamadores) e o bundle; e o "Substituir" troca a FONTE de um
  `FabricImage` (`swapImage` → `img.setSrc`), onde um grupo vetorial não cabe. Vira funcionalidade, não correção.
- **Servir o SVG cru como blob `.svg` para o `FabricImage` carregar** — o JS nem mudaria, mas a camada vira imagem com
  fonte SVG e as ações de IA (`EditorHandlers.kt:155` decodifica a fonte com o mesmo `decodeBytes`) cairiam no mesmo
  erro técnico; além disso depende do MIME que o `WebViewAssetLoader` dá a `.svg` (não verificado). Descartado.
- **Filtrar SVG no seletor** — `PickVisualMedia` só aceita `ImageOnly`/`SingleMimeType`; não há exclusão de um MIME.
- **Bug no JS** — o JS só repassa a mensagem do Kotlin; o defeito está no mapeamento do erro.

### Tarefas
- [ ] `EditorSession.kt::Companion.isSvg(bytes: ByteArray, mime: String?): Boolean` (novo) — `true` se `mime` for
  `image/svg+xml` (ignorando caixa/parâmetros) OU se o início do arquivo (até ~1 KB, depois de BOM UTF-8 e espaços)
  contém `<svg` (cobre `<?xml …?><svg` e `<!DOCTYPE svg`). — teste em `EditorProtocolTest.kt`: SVG simples,
  `<?xml` + `<svg`, BOM + espaços, MIME `image/svg+xml` com bytes quaisquer; negativos: PNG (`89 50 4E 47`), JPEG
  (`FF D8 FF`), MIME `null` com texto qualquer.
- [ ] `EditorSession.kt::pickImage` — envolver só o `decodeBytes` em `try { … } catch (e: java.io.IOException)`
  (`ImageDecoder.DecodeException` estende `IOException`; os bytes já foram lidos antes, então nenhum erro de leitura é
  engolido aqui) e lançar `BridgeException(ErrorCode.INVALID, …)`:
  - se `isSvg(bytes, context.contentResolver.getType(uri))` → `SVG não abre como foto. Use Adesivos, ou exporte o design em PNG/JPG`;
  - senão → `formato de imagem não suportado`.
  O toast vira `Não foi possível: SVG não abre como foto…`. Imagens decodificáveis seguem o caminho atual sem mudança
  (o catch só age na falha). Não mexer em `EditorAssets.decodeBytes` (outros chamadores: IA, BrandKit). — prova: T2.
- [ ] `tools/e2e/bug-editor-galeria-svg-pickimage.mjs` (novo, modelo `task11.mjs` passo 4) — receita na T2.

### Plano de teste
- **Offline (sem slot):** `testDebugUnitTest` do `build` (o `isSvg` em `EditorProtocolTest`). O mapeamento da
  `DecodeException` não roda em JVM (`ImageDecoder` é stub no `android.jar`): fica para a T2.
- **T2 reprodução como o usuário (E2E, no slot):** script `tools/e2e/bug-editor-galeria-svg-pickimage.mjs` (cwd na lane):
  1. Preparo: `adb push <svg de teste com width/height> /sdcard/Pictures/e2e_bug_svg.svg` e indexar com
     `adb shell content call --uri content://media/ --method scan_volume --arg external_primary` (método da TASK-11
     §5.6); sendo o arquivo mais novo, é a 1ª miniatura do seletor. Conferir o MIME `image/svg+xml` com
     `adb shell content query --uri content://media/external/images/media --projection _display_name:mime_type`
     (filtrar pelo nome). Se o MediaStore não listar SVG em `Pictures/`, usar `/sdcard/Download/ProductPhoto/`, onde
     o bug foi visto.
  2. `launchEditor()` (design novo, formato padrão) + `connect()`; guardar `n0 = editor.canvas.getObjects().length`.
  3. **Inserir:** tocar a aba `Imagem` → `Escolher da galeria…` → no seletor do sistema, tocar a 1ª miniatura
     (`content-desc` `Photo taken|Foto tirada` via `uiautomator dump`, como em `task11.mjs` l.153-160). **Sinal:**
     polling de `document.getElementById('toast').textContent` a cada 200 ms até 20 s (o toast some em 3,2 s);
     screencap do aparelho com o toast visível; `getObjects().length === n0`.
  4. **Substituir:** inserir uma foto pelo editor (`editor.addImage` de um asset do APK, como em `task11.mjs`),
     selecioná-la pela aba Camadas, `🔄 Substituir` (`#props .swap-btn`) → `Escolher da galeria…`
     (`#sheet .swap-gallery`) → 1ª miniatura (o SVG). **Sinal:** mesmo polling do toast; `getSrc()` da foto inalterado.
  5. Limpeza: `adb shell rm /sdcard/Pictures/e2e_bug_svg.svg` + `scan_volume` de novo.
  - **Com o fix:** os dois toasts começam com `Não foi possível: SVG` e NÃO contêm `decoder`; nada inserido/trocado;
    nenhum `EXCEPTION` no console (`p.logs`).
- **Controle positivo:** APK da base no mesmo script: os dois toasts são `Erro: Failed to create image decoder…`. O
  script registra o texto lido do toast (e aceita um modo que inverte o critério, ex. `E2E_EXPECT=base`) para os dois
  lados serem comparados.
- **T3 regressão direcionada:** (a) o caminho normal do `pickImage` com JPEG: `node tools/e2e/task11.mjs <pasta>`
  (o passo 4 troca por JPEG; antes, o SVG do T2 já removido e `/sdcard/Pictures/e2e_swap.jpg` indexado como 1ª foto,
  TASK-11 §5.6) — continua passando; (b) testes de unidade do `build` sem falha nova; (c) `pickFont`/`pickAudio`
  intactos no diff.

### Sessões seguintes
- dev: effort low, ultrathink não — mudança localizada num handler + helper puro com teste; o E2E segue modelo pronto.
- teste: effort medium, ultrathink não — dirigir o seletor do sistema por uiautomator e pegar um toast de 3,2 s pede cuidado, mas o sinal é direto.

## Correcao (pipeline 20261105-1638, rodada 1)

- `EditorSession.kt::Companion.isSvg(bytes, mime)` (novo) — `true` se o MIME (sem parâmetros, sem caixa) for
  `image/svg+xml`, ou se o início do arquivo (até 1 KB, depois de BOM UTF-8 e espaços) começa com `<` e contém `<svg`.
- `EditorSession.kt::pickImage` — só o `decodeBytes` fica num `try`; `java.io.IOException` (a `ImageDecoder.DecodeException`)
  vira `BridgeException(INVALID, "SVG não abre como foto. Use Adesivos, ou exporte o design em PNG/JPG")` quando
  `isSvg` (MIME via `contentResolver.getType(uri)`, em `runCatching`), senão `"formato de imagem não suportado"`.
  Toast esperado: `Não foi possível: SVG não abre como foto…`. Imagens decodificáveis: caminho inalterado.
- `EditorProtocolTest.kt::isSvg by mime and by content` — positivos (svg simples, `<?xml`+`<svg`, BOM+espaços+DOCTYPE,
  MIME com caixa/parâmetro) e negativos (PNG, JPEG, texto, vazio).
- `tools/e2e/bug-editor-galeria-svg-pickimage.mjs` (novo) — receita T2 do plano: push+scan do SVG, inserir e substituir
  pela galeria, polling do toast (print em `1-toast.png`/`2-toast.png`), nada inserido/trocado, limpeza no `finally`.
  `E2E_EXPECT=base` inverte o critério (controle positivo); `E2E_SVG_DIR=/sdcard/Download/ProductPhoto` se o
  MediaStore não indexar em `Pictures/`.
- Ajuste ao Plano de teste: nenhum.
- Build do helper: exit 0; `isSvg by mime and by content` passou em `TEST-com.productphoto.editor.EditorProtocolTest.xml`; bundle sem mudança.
