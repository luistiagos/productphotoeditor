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
