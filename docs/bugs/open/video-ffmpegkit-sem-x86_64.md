# Exportar vídeo (MP4/GIF) falha no emulador x86_64: o ffmpeg-kit não tem biblioteca x86_64

- **Onde:** editor → Exportar → "🎬 Vídeo MP4" ou "🎞️ GIF Animado" (`VideoRenderer.kt::render` → `FFmpegKit.execute`).
- **Como reproduzir (emulador `pp_api34`, x86_64, 2026-11-05):** qualquer export de vídeo → toast `Erro: FFmpegKit failed to
  start on brand: google, model: sdk_gphone64_x86_64 …`; logcat: `UnsatisfiedLinkError: dlopen failed: library
  "libffmpegkit_abidetect.so" not found`.
- **Causa (provada):** `io.github.maitrungduc1410:ffmpeg-kit-full:8.1.2` só traz `jni/arm64-v8a` e `jni/armeabi-v7a`
  (`unzip -l ~/.gradle/caches/.../ffmpeg-kit-full-8.1.2.aar`). O APK debug tem `lib/x86_64` (ORT etc., `abiFilters` do
  debug em `app/build.gradle.kts`), então o emulador instala como x86_64 e o FFmpeg fica sem `.so`.
- **Tentado:** `adb install --abi arm64-v8a` (tradução ARM do emulador): o FFmpeg carregaria, mas o app cai na abertura
  (SIGSEGV nativo, `logcat -b crash`) — não serve.
- **Impacto:** só debug/emulador (o release é arm64-only). Mas o export de vídeo nunca pode ser testado no emulador.
- **Opções (decisão do dono):** usar um artefato do ffmpeg-kit com x86_64 no debug; ou testar a codificação só em
  aparelho arm64. Achado durante a TASK-04 (`docs/tasks/retest/04-…md` §5.7). Em arm64 (moto g86) o export funciona: §5.6.

## Planejamento (pipeline 20261105-1638, 2026-11-05)

**Veredito:** bloqueado — não existe artefato drop-in com x86_64 e a MESMA FFmpeg do release; cada saída troca o
binário nativo testado ou a fonte dele, e o próprio doc reserva essa escolha ao dono ("Opções (decisão do dono)").
**Complexidade:** baixa (opções A/B: 1–2 arquivos de build) a média (opção C: source set por build type no `:editor`).
**Severidade:** baixo — só o APK debug no emulador x86_64; o release é arm64-only e o export funciona no arm64
(moto g86, TASK-04 §5.6). Há contorno: o manual já põe o celular como 1ª escolha de aparelho do teste.
**Arquivos a alterar (reserva da onda):** nenhum enquanto bloqueado. Com a decisão: `gradle/libs.versions.toml`,
`editor/build.gradle.kts` (opção C também `editor/src/debug/...` e `editor/src/release/...`, ver Tarefas).

### Causa raiz (símbolos abertos)
- `editor/build.gradle.kts` — `implementation(libs.ffmpeg.kit.full)` em todas as variantes do `:editor`.
- `gradle/libs.versions.toml` — `ffmpeg-kit-full = io.github.maitrungduc1410:ffmpeg-kit-full`, `ffmpegKit = "8.1.2"`.
- `app/build.gradle.kts` — `debug { ndk { abiFilters += listOf("arm64-v8a", "x86_64") } }` (x86_64 para o ORT no
  emulador, ARQUITETURA §13.2); `release { abiFilters += listOf("arm64-v8a") }`. Com `lib/x86_64` no APK, o emulador
  instala como x86_64 e o FFmpegKit não tem `.so` para essa ABI.
- `editor/.../VideoRenderer.kt::render` — chama `FFmpegKit.execute(cmd)`, `session.returnCode`,
  `ReturnCode.isSuccess/isCancel`, `session.allLogsAsString`, `session.failStackTrace`; em exceção apaga o `workDir`
  e repropaga (o toast "FFmpegKit failed to start…" vem daí). `resolveCommand` troca `-c:v libx264` por
  `-c:v h264_mediacodec`: o substituto precisa ter esse encoder.
- `ARQUITETURA.md` §0: vídeo estava "fora do MVP"; §8: "Só arm64-v8a, para não multiplicar `.so`".

### Provas (comando literal -> resultado)
- `unzip -l ~/.gradle/caches/.../ffmpeg-kit-full-8.1.2.aar | grep jni/` -> só `jni/arm64-v8a/` e `jni/armeabi-v7a/`.
- `curl -s https://repo1.maven.org/maven2/io/github/maitrungduc1410/ffmpeg-kit-full/maven-metadata.xml` -> versões
  6.0.6, 7.1.5, 8.1.2. Baixadas 6.0.6 e 7.1.5 + `unzip -l`: também só arm64-v8a/armeabi-v7a. **Nenhuma versão do fork
  atual tem x86_64.**
- `com.arthenica:ffmpeg-kit-full` (original): `curl -o /dev/null -w %{http_code} .../com/arthenica/ffmpeg-kit-full/maven-metadata.xml`
  -> 404 (retirado do Maven Central; o índice de busca ainda lista `6.0.LTS`, mas os arquivos não existem).
- Alternativas com x86_64 no Maven Central (AAR baixado, `unzip -l`, `grep -a` no `libavcodec.so` x86_64, `javap`):

  | artefato | ABIs | FFmpeg | `h264_mediacodec` | pacote Java | licença |
  |---|---|---|---|---|---|
  | `io.github.maitrungduc1410:ffmpeg-kit-full:8.1.2` (atual) | arm64, armv7 | n8.1.2 (Lavc62.28.102) | sim | `com.arthenica.ffmpegkit` | LGPL-3.0 |
  | `com.antonkarpenko:ffmpeg-kit-full:2.2.3` (fork do plugin Flutter `sk3llo/ffmpeg_kit_flutter_android`) | arm64, armv7, x86, x86_64 | **n8.1.2** (Lavc62.28.102) | sim | **`com.antonkarpenko.ffmpegkit`** (não é drop-in: `javap com.arthenica.ffmpegkit.FFmpegKit` -> class not found) | LGPL 3.0 |
  | `com.moizhassan.ffmpeg:ffmpeg-kit-16kb:6.1.1` | arm64, armv7, x86, x86_64 | **n6.0** (Lavc60.3.100) | sim | `com.arthenica.ffmpegkit` (drop-in: `execute(String)`, `getReturnCode`, `getAllLogsAsString`, `getFailStackTrace` presentes) | LGPL-3 |
- Tamanho arm64 (soma dos `.so`): atual 29.479.488 B; antonkarpenko 27.982.888 B (o release filtra as outras ABIs).

### Hipóteses descartadas (e por quê)
- `adb install --abi arm64-v8a` no emulador (tradução ARM): o app cai na abertura (SIGSEGV nativo) — no doc original.
- Tirar x86_64 do debug: o emulador perderia o ORT (motivo do x86_64, §13.2) — pior que o bug.
- Outra versão do `maitrungduc1410`: nenhuma tem x86_64 (prova acima).
- `com.arthenica` original 6.0-2: removido do Maven Central (404).
- Trocar só a `.so` x86_64 (copiar de outro AAR para `jniLibs/x86_64`): a `libffmpegkit.so` de outro build casa com
  as classes Java daquele build (JNI), não com as do maitrungduc; mistura não suportada.

### Decisão pedida ao dono (o que destrava)
- **A — debug com `moizhassan` 6.1.1, release mantém `maitrungduc1410` 8.1.2** (`debugImplementation` /
  `releaseImplementation` no `:editor`; mesmo pacote Java, sem mexer em código). Custo: o debug (inclusive no
  celular) roda FFmpeg 6.0, não a 8.1.2 do release: um export que passa no debug não prova o release.
- **B — trocar tudo para `antonkarpenko` 2.2.3** (mesma FFmpeg 8.1.2, x86_64 incluído): troca `import
  com.arthenica.ffmpegkit.*` por `com.antonkarpenko.ffmpegkit.*` no `VideoRenderer.kt` e a coordenada no catálogo.
  Custo: o binário de produção passa a vir de um mantenedor diferente (fork de plugin Flutter); exige reteste do
  export no arm64.
- **C — debug com `antonkarpenko`, release com `maitrungduc1410`** (mesma FFmpeg nos dois): exige isolar os imports
  por source set (`editor/src/debug/` e `src/release/` com um adaptador de 1 função). Custo: dois binários e dois
  arquivos para manter.
- **D — não corrigir**: export de vídeo só se testa em arm64 (o manual já põe o celular em 1º). Fechar o bug como
  "não corrigir".
- Recomendação do planning: **D** se o celular continuar disponível ao teste; senão **B** (uma só FFmpeg, mesma
  versão, emulador e celular testam o mesmo binário que vai ao release).

### Tarefas (só depois da decisão)
- [ ] Opção A: `gradle/libs.versions.toml` (nova lib `ffmpeg-kit-x86-debug`) + `editor/build.gradle.kts`
  (`debugImplementation`/`releaseImplementation`) — prova: T2 no emulador + `unzip -l app-debug.apk | grep x86_64/libffmpegkit`.
- [ ] Opção B: `gradle/libs.versions.toml` + `editor/.../VideoRenderer.kt` (imports) — prova: T2 no emulador E no moto g86.
- [ ] Opção C: catálogo + `editor/build.gradle.kts` + adaptador em `editor/src/debug/kotlin/...` e
  `editor/src/release/kotlin/...` + `VideoRenderer.kt` usando o adaptador — prova: T2 no emulador e `assembleRelease`.

### Plano de teste
- **Offline (sem slot):** `unzip -l app/build/outputs/apk/debug/app-debug.apk | grep -E "lib/x86_64/libffmpegkit(_abidetect)?\.so"`
  — hoje vazio; com o fix, as duas `.so` presentes. `testDebugUnitTest` (`VideoRendererTest`) verde.
- **T2 reprodução como o usuário (E2E, no slot, EMULADOR `pp_api34` x86_64 — o bug só existe nele):** design novo
  com 1 texto e 1 imagem com animação de entrada → aba Exportar → "🎬 Vídeo MP4" → esperar o fim. Sinal do sintoma:
  toast `Erro: FFmpegKit failed to start on brand: google, model: sdk_gphone64_x86_64` e, no logcat do PID,
  `UnsatisfiedLinkError … libffmpegkit_abidetect.so`. Sinal do fix: logcat `VideoRenderer: FFmpeg finalizado com
  código: 0` e o MP4 salvo (arquivo com `ffprobe`/tamanho > 0). Repetir com "🎞️ GIF Animado". Script:
  `tools/e2e/bug-video-ffmpegkit-sem-x86_64.mjs` (modelo: o E2E de export da TASK-04).
- **Controle positivo:** APK da base no emulador → o toast/UnsatisfiedLinkError acima aparece em todo export de vídeo.
- **T3 regressão direcionada:** o mesmo export MP4 e GIF no moto g86 (arm64) com o APK do fix (opções A e C mudam o
  binário do debug no celular; B muda o do release) e `assembleRelease` (opção C).

### Sessões seguintes
- dev: effort medium, ultrathink não — troca de dependência/imports conforme a opção escolhida; o raciocínio já está aqui.
- teste: effort medium, ultrathink não — reprodução objetiva (toast/logcat), mas exige emulador E celular.
