# [TASK-04] Estúdio de Vídeo Completo: Seletor de Áudio/Música, Animações Entrada/Ênfase/Saída e Exportação Rápida (GIF / WebCodecs)

## Metadados e Esforço Mensurado

| Campo | Valor |
| :--- | :--- |
| **ID** | `TASK-04` |
| **Prioridade** | **Alta (Quick Win na UI de Áudio) / Média (Animações Triplas + GIF)** |
| **Esforço Mensurado** | **Baixo a Médio** — **~2 a 3 dias úteis (16h–24h / 5 Story Points)** *(Sendo apenas **~0,5 a 1 dia / 2 SP** para o Seletor de Áudio na UI + **~1,5 a 2 dias / 3 SP** para Animações de Entrada/Ênfase/Saída e GIF)* |
| **Escopo** | Híbrido Local (`editor-web` em TypeScript + Ponte Kotlin em `:editor` para `pickAudio`) |
| **Referência Analisada (`com.desygner.ads`)** | `js_pretty/assets/editor-video-t-t1ZVt5.js`, `js_pretty/assets/bakeWorker-C0GWFHOE.js` e `extracted/assets/public/docs/create.md` |

### Detalhamento do Esforço por Subtarefa
1. **Seletor de Áudio/Música na aba `🎬 Vídeo` + Ponte `pickAudio` e Trilhas Bundled (Quick Win):** ~6h.
2. **Animações Separadas de Entrada, Ênfase e Saída + Curvas de Easing (`VideoPreview.ts` e `FfmpegCommandBuilder.ts`):** ~8h.
3. **Exportação de GIF Animado (para WhatsApp/Catálogos) e Otimização de Exportação:** ~6h.
4. **Testes Unitários (`FfmpegCommandBuilder.test.ts` / `VideoPreview.test.ts`) e Teste no Aparelho:** ~4h.

---

## 1. Contexto e Problema Atual

Ao inspecionar nosso código atual de vídeo em [`editor-web/src/editor.ts`](file:///c:/projects/sandbox/product_photo_offline/editor-web/src/editor.ts#L787-L799) e [`editor-web/src/video/FfmpegCommandBuilder.ts`](file:///c:/projects/sandbox/product_photo_offline/editor-web/src/video/FfmpegCommandBuilder.ts#L156-L171), constatamos que:
1. **A infraestrutura de áudio já está 80% pronta no backend JS/FFmpeg, mas invisível na UI:**
   - `VideoSettings` em [`document.ts`](file:///c:/projects/sandbox/product_photo_offline/editor-web/src/document.ts#L31-L39) já define `audioUrl?: string`, `audioVolume?: number` e `audioStartTime?: number`.
   - [`FfmpegCommandBuilder.build()`](file:///c:/projects/sandbox/product_photo_offline/editor-web/src/video/FfmpegCommandBuilder.ts#L158-L164) já gera `-stream_loop -1 -ss ${audioStart} -t ${duration} -i "${audio.filename}"` e `[a] volume=${vol} [a_out]`.
   - Porém, em [`showVideo()` (`main.ts` L820–L953)](file:///c:/projects/sandbox/product_photo_offline/editor-web/src/main.ts#L820-L953), **não há nenhum controle na interface** para escolher uma música de fundo, ajustar o volume ou ouvir o áudio durante o preview!
2. **Animação única por camada:**
   - Hoje cada camada só aceita 1 efeito `fx` em [`LayerAnimation`](file:///c:/projects/sandbox/product_photo_offline/editor-web/src/document.ts#L23-L29). Se o usuário escolhe `zoom_in` para um selo *"50% OFF"*, ele não pode fazer esse mesmo selo pulsar (`float` / `shake`) no meio do vídeo e sair com `fade_out` no final.
3. **Falta de opção GIF Animado:**
   - Lojistas que enviam ofertas pelo WhatsApp muitas vezes preferem um **GIF curto em loop automático** (ou MP4 leve com fade de áudio no final).

---

## 2. O que deve ser feito (Especificação Técnica Detalhada)

### 2.1. Seletor de Trilha Sonora e Preview de Áudio na Aba `🎬 Vídeo` (Quick Win)
1. **Trilhas Musicais Royalty-Free Empacotadas + Áudio do Aparelho:**
   - Incluir 4 a 5 loops curtos e leves (`.mp3` / `.ogg` de 64–96 kbps, ~80 KB cada, 100% livres de direitos / gerados sinteticamente) no pacote de conteúdo (`content.json` $\to$ `audioTracks: [{ id, name, mood, file }]`):
     - *Batida Comercial Upbeat* (Varejo / Moda);
     - *Eletrônico Dinâmico* (Tech / Oferta Relâmpago);
     - *Lo-Fi Elegante* (Cosméticos / Joias / Decoração);
     - *Impacto Promocional* (Varejo / Supermercado).
   - Adicionar na ponte Kotlin↔JS ([`protocol.ts`](file:///c:/projects/sandbox/product_photo_offline/editor-web/src/protocol.ts) e `EditorHandlers.kt`) a requisição `pickAudio` (`ActivityResultContracts.GetContent()` com `audio/*`), servindo o arquivo selecionado via `/blob/<uuid>.mp3` exatamente como já fazemos em `pickImage` e `pickFont`.
2. **Sincronização no `VideoPreview.ts`:**
   - Instanciar um `HTMLAudioElement` dentro de [`VideoPreview`](file:///c:/projects/sandbox/product_photo_offline/editor-web/src/video/VideoPreview.ts).
   - Quando `videoSettings.audioUrl` estiver definido:
     - Em `play()`: posicionar `audio.currentTime = videoSettings.audioStartTime + this.time`, aplicar `audio.volume = videoSettings.audioVolume ?? 1.0`, `audio.loop = true` e chamar `void audio.play()`.
     - Em `pause()` / `stop()`: pausar o `HTMLAudioElement`.
     - Em `seek(t)`: sincronizar `audio.currentTime`.
3. **Controles na Sheet `showVideo()` ([`main.ts`](file:///c:/projects/sandbox/product_photo_offline/editor-web/src/main.ts#L904-L952)):**
   - Nova seção **"🎵 Música de Fundo"**:
     - Chips com as trilhas empacotadas + botão **"📂 Escolher áudio do celular…"** + botão **"🔇 Sem música"**;
     - Slider **"Volume da música"** (`0%` a `100%`, padrão `80%`);
     - Slider **"Início da música (s)"** (`0s` a `60s`) para escolher o refrão/melhor trecho;
     - Checkbox **"Suavizar final (Fade-out de áudio)"** (adiciona filtro `afade=t=out:st=${duration - 1}:d=1` no [`FfmpegCommandBuilder.ts`](file:///c:/projects/sandbox/product_photo_offline/editor-web/src/video/FfmpegCommandBuilder.ts#L163)).

### 2.2. Animações de Entrada, Ênfase e Saída por Camada
Inspirado na estrutura de timeline do `editor-video-t-t1ZVt5.js` do Automo, evoluir [`LayerAnimation` em `document.ts`](file:///c:/projects/sandbox/product_photo_offline/editor-web/src/document.ts#L23-L29) mantendo total retrocompatibilidade:

```ts
export type EntranceFx = 'none' | 'fade' | 'zoom_in' | 'zoom_out' | 'slide_left' | 'slide_right' | 'slide_up' | 'slide_down';
export type EmphasisFx = 'none' | 'pulse' | 'shake' | 'float' | 'rotate' | 'ken_burns';
export type ExitFx = 'none' | 'fade_out' | 'zoom_out' | 'slide_out';
export type EasingCurve = 'linear' | 'ease_out' | 'ease_in_out' | 'bounce';

export interface LayerAnimation {
  /** Mantido por retrocompatibilidade; equivale à animação principal/entrada. */
  fx: AnimationFx;
  startTime: number;
  duration: number;
  speed?: number;
  /** Novos campos opcionais para composição tripla: */
  inFx?: EntranceFx;
  inDuration?: number;
  emphasisFx?: EmphasisFx;
  outFx?: ExitFx;
  outDuration?: number;
  easing?: EasingCurve;
}
```

1. **No `VideoPreview.ts` (Canvas 2D em Tempo Real):**
   - Calcular o progresso normalizado $p_{\text{in}} \in [0, 1]$ nos primeiros `inDuration` segundos (aplicando função de `easing`, ex.: `easeOutCubic(t) = 1 - Math.pow(1 - t, 3)`), a modulação contínua de `emphasisFx` durante o tempo ativo (incluindo o novo efeito `'pulse'` que oscila a escala em $1 + 0.06 \cdot \sin(2\pi \cdot t / 0.8)$ — perfeito para botões *"COMPRE AGORA"* e preços), e o $p_{\text{out}} \in [0, 1]$ nos últimos `outDuration` segundos antes de `startTime + duration`.
2. **No `FfmpegCommandBuilder.ts` (Exportação Determinística):**
   - Combinar na expressão de `overlay` e `fade` do FFmpeg a rampa de entrada (`st` até `st + inDuration`), a senóide de ênfase (`float`, `shake`, `pulse`) e o fade/deslize de saída (`et - outDuration` até `et`).
3. **Na UI (`showAnimationProps` em [`main.ts` L246–L288](file:///c:/projects/sandbox/product_photo_offline/editor-web/src/main.ts#L246-L288)):**
   - Organizar a sheet **"🎬 Animação da Camada"** em 3 abas ou seletores claros:
     - **Entrada** (*Como a camada surge*: `Nenhuma`, `Fade In`, `Deslizar`, `Zoom In`);
     - **Ênfase** (*Enquanto está na tela*: `Nenhuma`, `Pulsar Oferta`, `Flutuar`, `Chacoalhar (Shake)`, `Ken Burns`);
     - **Saída** (*Como a camada sai*: `Nenhuma`, `Fade Out`, `Deslizar para fora`).

### 2.3. Exportação em GIF Animado (e Fast Export)
1. **Suporte a Formato `'gif'` em [`ExportPayload` (`protocol.ts`)](file:///c:/projects/sandbox/product_photo_offline/editor-web/src/protocol.ts#L147-L153):**
   - Adicionar `'gif'` na união `format: 'png' | 'jpg' | 'svg' | 'mp4' | 'gif'`.
2. **Geração via FFmpeg (`FfmpegCommandBuilder.buildGif`):**
   - Quando o formato escolhido em [`showExport()`](file:///c:/projects/sandbox/product_photo_offline/editor-web/src/main.ts#L957) for `GIF Animado (WhatsApp)` (ex.: `15 fps`, largura máx. `540 px` ou `720 px`), usar o filtro `palettegen` + `paletteuse=dither=bayer` no comando FFmpeg para gerar um GIF otimizado e cristalino a partir das mesmas camadas animadas!

---

## 3. Arquivos a Criar / Modificar

| Arquivo | Ação | Descrição |
| :--- | :---: | :--- |
| [`editor-web/src/document.ts`](file:///c:/projects/sandbox/product_photo_offline/editor-web/src/document.ts) | **Modificar** | Estender `LayerAnimation` com `inFx`, `inDuration`, `emphasisFx`, `outFx`, `outDuration`, `easing` e adicionar `'pulse'` em `AnimationFx`. |
| [`editor-web/src/protocol.ts`](file:///c:/projects/sandbox/product_photo_offline/editor-web/src/protocol.ts) | **Modificar** | Adicionar `AudioRef` (retorno de `pickAudio`) e formato `'gif'` em `ExportPayload`. |
| [`editor-web/src/video/VideoPreview.ts`](file:///c:/projects/sandbox/product_photo_offline/editor-web/src/video/VideoPreview.ts) | **Modificar** | Sincronizar `HTMLAudioElement` no play/pause/seek/stop e calcular animações combinadas (Entrada + Ênfase + Saída + Easing). |
| [`editor-web/src/video/FfmpegCommandBuilder.ts`](file:///c:/projects/sandbox/product_photo_offline/editor-web/src/video/FfmpegCommandBuilder.ts) | **Modificar** | Suportar `afade` de saída no áudio, combinação de expressões Entrada/Ênfase/Saída, efeito `pulse` e modo de saída `.gif` com `palettegen`/`paletteuse`. |
| [`editor-web/src/main.ts`](file:///c:/projects/sandbox/product_photo_offline/editor-web/src/main.ts) | **Modificar** | Adicionar seção **"🎵 Música de Fundo"** em `showVideo()`, atualizar `showAnimationProps()` com Entrada/Ênfase/Saída e incluir opção `GIF Animado` em `showExport()`. |
| [`editor/src/main/kotlin/com/productphoto/editor/EditorHandlers.kt`](file:///c:/projects/sandbox/product_photo_offline/editor/src/main/kotlin/com/productphoto/editor/EditorHandlers.kt) | **Modificar** | Tratar o comando `pickAudio` da ponte abrindo o seletor de áudio do sistema e registrando o blob local; aceitar extensão `.gif` na exportação de vídeo/animação. |
| [`editor-web/test/FfmpegCommandBuilder.test.ts`](file:///c:/projects/sandbox/product_photo_offline/editor-web/test/FfmpegCommandBuilder.test.ts) | **Modificar / Criar** | Testes unitários validando a geração dos filtros de áudio (`volume`, `afade`), combinação `inFx` + `emphasisFx` + `outFx` e geração de comando GIF. |

---

## 4. Critérios de Aceite e Verificação

- [x] Na aba `🎬 Vídeo`, o usuário consegue selecionar uma trilha musical empacotada ou um arquivo `.mp3`/`.m4a` do celular, ouvir a música sincronizada ao tocar em **▶ Reproduzir** e ajustar o volume. *(E2E emulador; arquivo testado: `.wav`)*
- [x] Ao exportar o vídeo `.mp4`, a trilha de áudio selecionada está mixada no arquivo final com o volume configurado e fade-out suave no último segundo. *(moto g86, `task04_encode.mjs`)*
- [x] Uma mesma camada (ex.: selo de preço) pode ter simultaneamente uma animação de **Entrada** (`Zoom In`), uma de **Ênfase** (`Pulsar` ou `Flutuar`) e uma de **Saída** (`Fade Out`).
- [x] A tela de exportação oferece a opção **GIF Animado** pronta para compartilhamento rápido no WhatsApp. *(GIF gerado e conferido no moto g86)*
- [x] `npx vitest run` e `./gradlew :editor:testDebugUnitTest` passam sem erros.


---

## 5. Registro da implementação (sessão 2026-11-05)

### 5.1. Etapa analítica — símbolos abertos
- `editor.ts::exportVideoBundle()` — esconde todos os objetos e chama `renderPage` (página **inteira**) para cada
  camada → `layer_i.png` tem o tamanho do documento; o `LayerRenderItem` recebe `x/y = left/top` (no Fabric 7 a origem é
  o **centro**) e `width/height` da caixa do objeto; o builder faz `scale=w:h` + `overlay=x:y`. Resultado: a página
  inteira espremida na caixa do objeto, deslocada meia caixa. **O MP4 de hoje sai errado** (a ser confirmado no E2E).
  Também não manda `audioUrl` no bundle (o retorno não tem o campo) → o áudio nunca chega ao Kotlin.
- `FfmpegCommandBuilder.build()` — imagens entram como `-i layer.png` **sem `-loop 1`** → 1 quadro só; `fade` e
  `rotate` por quadro não animam (só o overlay com `eval=frame` reposiciona o último quadro repetido). `enable=between(t,st,et)`
  com `et = st + duration` esconde a camada depois da animação — o preview **não** esconde (diverge: preset "promo" põe
  `zoom_in` de 2 s no produto e no MP4 o produto sumiria aos 2 s). Áudio: `-stream_loop -1 -ss -t -i "audio.mp3"` +
  `volume`; sem áudio gera `anullsrc`.
- `VideoPreview` — já tem `audioEl` (play/pause/stop/seek posicionam `currentTime`), mas sem `loop` e sem fade.
  `renderFrame` tem a matemática própria (distâncias de slide fixas 400/300 px do doc), independente do builder.
- `VideoRenderer.kt::render` — grava `files` (dataURL) no cacheDir, áudio **só se `audioUrl` for `data:`** (como
  `audio.mp3`), troca `libx264`→`h264_mediacodec`, troca nomes por caminhos absolutos e roda `FFmpegKit.execute`.
  Em erro: `BridgeException(INTERNAL)` com log completo no logcat (`VideoRenderer`), e apaga o workDir.
- `EditorSession.kt::export` — MP4: `VideoRenderer(context).render` → `host.exportVideo` (Movies/ProductPhoto) ou bytes.
  `ExportFormat` = png/jpg/svg/mp4 (`of()` rejeita outro). `EditorExports.save`: Pictures para png/jpg.
- `EditorSession.kt::pickFont` + `EditorScreen` (`OpenDocument`, `Waiter`/`CompletableDeferred`) — padrão a copiar para
  `pickAudio`. `EditorAssets.putBytes(bytes, ext, prefix)` grava `prefix-<uuid>.ext` no blobDir (NAME aceita);
  `EditorAssets.read(url)` lê blob **ou** `/assets/…` → o Kotlin resolve a URL do áudio sem passar bytes pela ponte.
- WebView: `mediaPlaybackRequiresUserGesture = true` → `audio.play()` só dentro do toque em ▶ (é o caso).
- Conteúdo: `app/src/main/assets/content/index.json` é **reescrito inteiro** por `tools/gen_content.py` → as trilhas vão
  num índice separado `content/audio/index.json` (como `scenes/index.json`), carregado com `catch → []`.
- ffmpeg-kit = `io.github.maitrungduc1410:ffmpeg-kit-full:8.1.2` (FFmpeg recente: `scale` com `eval=frame` e `t`,
  overlay com `overlay_w/h` por quadro). Sem ffmpeg no PC (download bloqueado) → comandos validados no FFmpegKit do app.

### 5.2. Hipóteses descartadas
- Animar por quadro no JS e mandar a sequência de PNGs pela ponte: 15 s × 30 fps × ~150 KB = ~70 MB de base64 numa
  mensagem; descartada (o doc pede FFmpeg determinístico e a ponte não aguenta).
- Manter `layer_i.png` da página inteira e só corrigir o `scale`: overlay de página inteira torna zoom/pulso centrados
  caros (escala por quadro de 1080² por camada). → PNG recortado na `getBoundingRect()` da camada (rotação já embutida).
- Alfa com easing no FFmpeg: só `geq` faria (por pixel, lento). → alfa usa progresso **linear** (filtros `fade`) e o
  easing vale para movimento/escala, igual no preview e no export.
- Trilhas em `index.json` principal: seriam apagadas pelo `gen_content.py`.
- MP3/OGG empacotados: não há encoder no PC → WAV mono 22 kHz 16 bit gerado por `tools/gen_audio.py` (stdlib), ~350 KB.

### 5.3. O que fazer (tasks → prova)
1. `video/animation.ts` — modelo normalizado (`resolveAnimation`: legado `fx` → entrada/ênfase; novo `inFx/emphasisFx/outFx`)
   e mini-AST de expressão (`Expr`) avaliável em JS **e** impressa como expressão FFmpeg → preview e export usam a mesma
   conta. Prova: vitest (avaliar a expressão impressa ≡ avaliar no JS; legado ≡ comportamento antigo de entrada).
2. `VideoPreview.renderFrame` usa `layerStateAt`; áudio com `loop`, volume e fade-out. Prova: vitest + E2E (áudio toca).
3. `FfmpegCommandBuilder` — `-loop 1 -framerate -t`, PNG recortado (x/y = canto), `fade` in/out, `scale eval=frame`,
   overlay centrado com `dx/dy`, `rotate` com `pad`, `afade` de saída, `buildGif` (palettegen/paletteuse). Prova: vitest
   do comando + E2E exportando MP4/GIF e conferindo os quadros no WebView (`<video>` / `ImageDecoder`) e o áudio
   (`decodeAudioData`: RMS > 0, fade no fim).
4. `editor.ts::exportVideoBundle(format)` — recorte por `getBoundingRect`, `audioUrl/audioName`, `output`.
5. Kotlin: `pickAudio` (OpenDocument `audio/*` → `putBytes`), `VideoRenderer` lê áudio por `EditorAssets.read`, saída
   `.gif`, `ExportFormat.GIF` (Pictures, image/gif). Prova: E2E (seletor do sistema) + `:editor:testDebugUnitTest`.
6. UI: seção "🎵 Música de Fundo" em `showVideo`; Entrada/Ênfase/Saída em `showAnimationSheet`; "GIF Animado" em
   `showExport`. Prova: E2E por toque real.

### 5.4. Feito
- `video/animation.ts` (novo): `Expr` + `evalExpr`/`toFfmpeg`, `resolveAnimation` (legado → entrada/ênfase como o preview
  antigo; novo → janela `[startTime, startTime+duration]`), `ease` (linear, ease_out, ease_in_out, bounce = "back out"),
  `layerTimeline` (dx/dy/escala/giro em `Expr` + rampas de alfa lineares), `stateAt`, opções da UI, `legacyFx`.
- `document.ts`: `'pulse'`, `EntranceFx/EmphasisFx/ExitFx/EasingCurve`, campos novos de `LayerAnimation`;
  `VideoSettings.audioName/audioFadeOut`.
- `VideoPreview`: `renderFrame` pela linha do tempo; `stop()` limpa os estados capturados (antes, o play seguinte
  restaurava posições velhas de antes de uma edição); música por **Web Audio** (`video/audioTrack.ts`): loop, seek exato,
  volume, fade-out do último segundo (`audioVolumeAt`), `prepareAudio`/`resetAudio`/`audioSource`.
- `FfmpegCommandBuilder`: entradas animadas com `-loop 1 -framerate -t`; `format=rgba` → `fade` in/out → `pad`+`rotate`
  (giro) → `scale … eval=frame` (zoom/pulso/ken burns) → `overlay` centrado com `eval=frame` e `enable`; áudio
  `volume`,`afade`,`aformat` 44,1 kHz estéreo; `buildGif` (`fps`, `palettegen stats_mode=diff`, `paletteuse` bayer, `-loop 0`).
- `editor.ts::exportVideoBundle(format)`: PNG por camada recortado em `getBoundingRect()` + margem da sombra (opacidade já
  no PNG); tamanho da saída pela página (par; GIF ≤ 540 px, 15 fps); `audioUrl`/`audioFile`/`output` no pacote;
  `defaultVideoSettings()` e `load()` zera as configurações por documento (largura/altura = página).
- `protocol.ts`: `'gif'`, `ExportVideoBundle` completo, `AudioRef`. `content.ts`: `audioTracks` de `audio/index.json`.
- `main.ts`: "🎬 Animação da Camada" com Entrada/Ênfase/Saída, durações, curva, "Aparece em", "Tempo na tela";
  "🎵 Música de Fundo" (4 chips, "📂 Escolher áudio do celular…", "🔇 Sem música", volume %, início, fade-out);
  "🎞️ GIF Animado" no Vídeo e no Exportar (esconde Imprimir/Mockup para vídeo).
- Kotlin: `pickAudio` (`EditorHost.pickAudio` padrão null, `OpenDocument(audio/*)`, limite 40 MB, `putBytes(…,"audio")`,
  `audioExtension(nome, mime)`); `ExportFormat.GIF` (Pictures, `image/gif`); `VideoRenderer(context, assets)` lê o áudio
  por `EditorAssets.read` (blob ou asset), valida nomes, `resolveCommand` puro (testável).
- `tools/gen_audio.py` → `content/audio/{upbeat,eletronico,lofi,impacto}.wav` (~1,3 MB) + `index.json`; `SOURCES.md`.
- Desvios conscientes: trilhas em WAV (sem encoder no PC); alfa sempre linear (easing só no movimento); `rotate`
  legado continua "uma volta e para", o novo gira contínuo (1 volta/3 s); `shake` virou rajadas de 0,6 s a cada 2 s.

### 5.5. Provas (2026-11-05)
- `npx tsc --noEmit` limpo; vitest **113/113** (novo `test/animation.test.ts`: para 6 composições a expressão FFmpeg
  impressa, avaliada com a semântica do libavutil, ≡ `evalExpr` em 61 instantes; janela/entrada/pulso/saída/easing;
  legado fade/ken burns/float/speed. `test/ffmpegCommand.test.ts` reescrito: o antigo fixava as strings do pipeline
  quebrado). `./gradlew :editor:testDebugUnitTest` **15/15** (novo `VideoRendererTest`: `resolveCommand` não confunde
  `layer_1` com `layer_10`, GIF, `audioExtension`).
- E2E emulador `pp_api34`: `ANDROID_SERIAL=emulator-5554 node tools/e2e/task04.mjs <pasta>` → **26/26 PASS** (pré:
  `/sdcard/Music/e2e_music.wav` = cópia de `lofi.wav`, indexado com `content call … scan_volume`): toque seleciona →
  sheet com 3 seletores grava zoom_in+pulse+fade_out; preview em t=0,3/1,0/1,7/2,1/4,0/4,25 (alfa 0; zoom 0,6/alfa 0,5;
  1,06/0,94; alfa 0,5/0,25); trilha empacotada toca no ▶ (posição da música a < 0,3 s do preview), pausa, volume 50%,
  início 2 s (seek(1) → 3,0 s), fade-out (0,25 a 0,5 s do fim); seletor do sistema → `/blob/audio-<uuid>.wav` toca;
  pacote MP4 com PNG 325×205 (= caixa 321×201 + margem), `-i "audio.wav"`, `volume=0.50,afade=t=out:st=4.00:d=1.00`,
  `-ss 2.00`, fades e `scale eval=frame`; pacote GIF 540×540/15 fps/paleta/sem áudio; Exportar com "GIF Animado"
  (sem Imprimir/Mockup); reabrir mantém animação e música; documento novo sem música; Story sai 1080×1920.
- Achados do E2E corrigidos no código: `<audio>` não aceita seek (o asset loader não atende Range) e `blob:` é recusado
  pelo WebView ("Media load rejected by URL safety check") → Web Audio. DocumentsUI abre em "Recentes" vazio e depois
  lembra a última pasta → o teste navega pelo passo mais fundo visível.

### 5.6. Codificação real (moto g86, arm64 — 2026-11-05, autorizado pelo dono)
- `ANDROID_SERIAL=<moto> node tools/e2e/task04_encode.mjs <pasta>` → **14/14 PASS**. Exporta pela UI ("🎬 Exportar Vídeo
  MP4" / "🎞️ GIF Animado" → Salvar), copia o arquivo de volta para o BlobStore (`/data/local/tmp` + `run-as cp`; stdin
  não atravessa o `run-as`) e confere no WebView:
  - MP4 salvo em ~2,5 s, 273 KB, 1080×1080, 5,00 s (`avc1` + `mp4a`, conferido também pelas caixas do arquivo);
    quadros por `requestVideoFrameCallback`: t=0,27 fundo `[31,42,69]`; t=0,97 centro `[131,58,61]` (alfa 0,5) e borda
    ainda fundo (zoom 0,6); t=2,03 centro e borda vermelhos; t=3,97 `[146,59,61]` (fade-out a meio); t=4,77 fundo.
  - Áudio (`decodeAudioData` do MP4): estéreo, 5 s; RMS 0,5–3,5 s = **0,501 ×** a trilha original (volume 50%);
    últimos 0,2 s: 0,0048 contra 0,032 sem fade.
  - GIF salvo em ~1,2 s (Pictures), 540×540, 75 quadros, `repetitionCount = Infinity`; fundo/selo/fundo em 0,3/2,0/4,8 s.
- Achado corrigido pelo E2E: trilha **mono** saía −3 dB (0,354 em vez de 0,5): o `aformat` para estéreo usa √½ fixo no
  swresample e `center_mix_level` não vale sem par estéreo na origem. → `audioChannels(url)` (`audioTrack.ts`, decodifica
  no export) + `channels` no `VideoAudioConfig` → `pan=stereo|c0=c0|c1=c0` para mono (teste unitário novo).
- Arquivos de teste apagados do moto depois (`E2E_04_encode_*` em Movies/Pictures e `vid-*` no BlobStore).
- Regressão no emulador depois da correção: `task04.mjs` **26/26**; vitest **114/114**.

### 5.7. Fora do escopo
- O emulador x86_64 não consegue codificar vídeo (`docs/bugs/done/video-ffmpegkit-sem-x86_64.md`, não corrigir): a prova de MP4/GIF
  exige aparelho arm64.
- Antes desta task o MP4 saía errado (página inteira espremida na caixa, imagens sem `-loop 1`, Story 1080×1080,
  opacidade aplicada duas vezes, áudio nunca enviado) — corrigido aqui.
