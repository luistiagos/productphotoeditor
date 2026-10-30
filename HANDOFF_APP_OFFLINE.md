# Handoff — App próprio "foto de produto / pôster / logo" com IA local e plugável

Criado em 2026-10-13, ao fim da sessão de análise. A sessão anterior engenhou reversamente o
APK `ai.product.photoeditor` (código `com.videorey.ailogomaker`). Este doc é o **ponto de partida
da próxima sessão**: tem o pedido do dono, o que já se sabe, as decisões já tomadas, o que
falta decidir e o próximo passo exato.

> **Onde fica cada coisa (decisão do dono, 2026-10-16):** tudo o que é **do app** — este HANDOFF, `ARQUITETURA.md`,
> `docs/`, amostras, código — fica em `C:\projects\sandbox\product_photo_offline\` (esta pasta). Em
> `C:\projects\sandbox\product_photo_apk\` fica **só a engenharia reversa do APK original** (`REA_ANALISE.md`,
> `reconstructed/`, os APKs). Documento novo do app vai para cá, nunca para lá. Até a sessão 19 este HANDOFF morava
> no `product_photo_apk`; as seções antigas citam "a pasta do projeto novo" com esse ponto de vista.
> Caminho relativo aqui (`docs/…`, `app/…`) é relativo a esta pasta; ao indicar um arquivo ao dono, usar o caminho absoluto.

## 1. Pedido do dono (literal, consolidado)
1. **Documento de arquitetura**: componentes, bibliotecas, ordem de implementação e o que
   reaproveitar da análise.
2. **Protótipo da foto de produto** (recorte + cenário + sombra) para avaliar a qualidade antes
   de construir o resto.
3. App em **Kotlin**.
4. Distribuição por **sideloading** (não vai para a Play Store) → sem Play Billing, sem AdMob,
   sem exigências de política da loja. Atenção: Gemini Nano / ML Kit "via Play services" ainda
   funcionam fora da loja desde que o aparelho tenha Google Play services. Para aparelhos sem
   GMS, ter fallback com modelo empacotado.
5. **Todas as funcionalidades do app original** (inventário na seção 3).
6. **Interfaces que permitam trocar facilmente** cada modelo entre **local e remoto**, e para
   **qualquer provedor** desejado (ver seção 5).

## 2. Onde está a análise (não refazer)
Tudo nesta seção fica em `C:\projects\sandbox\product_photo_apk\` (caminhos abaixo relativos a ela).
- `REA_ANALISE.md` — análise completa. Seções relevantes:
  - "Sessão 3 — funcionalidades de IA e modelos": **tabela de cada função de IA → call-site →
    modelo/backend**. É a especificação funcional da camada de IA.
  - "Opção 3": endpoints e segredos (só para referência; o app novo não usa esses servidores).
- `reconstructed/README.md` — como está a árvore reconstruída e por que ela não compila.
- `reconstructed/android/src/main/java/com/videorey/ailogomaker/` — fonte decompilada
  (jadx), **só para consulta de comportamento**. `reconstructed/android/src/main/res/` tem os
  326 layouts (referência de telas/fluxos).
- `reconstructed/web/main.beautified.js` — editor Angular 14 (usa **Fabric.js**). Só para
  consulta.

**Restrição legal (decidida):** o app novo é **escrito do zero**. Não copiar código, `main.js`,
templates, fontes, ícones, prompts ou assets do original (são do desenvolvedor videorey). A
análise serve como **especificação de comportamento**, não como fonte.

## 3. Inventário de funcionalidades do app original (escopo do app novo)
Fonte: `util/AppConstants.java` (`FEATURE_*`), activities do manifesto, pacotes `ui/view/*`, e
a ponte JS `ui/view/common/WebViewJavascriptInterface.java` (86 métodos `@JavascriptInterface`).

Telas (activities): `StartupActivity` (splash + extração do editor), `StartupConfigurationsActivity`
(onboarding), `RedesignHomeActivity` (home), `EditorActivity` (editor = WebView), `BgRemoveActivity`.
Pacotes de UI: `Home`, `Image`, `RedesignHome`, `Startup`, `bg`, `brandkit`, `common`,
`fontreader`, `generate`, `help`, `objectremoval`, `purchase`, `settings`.

### 3.1 Funcionalidades de IA (detalhe em REA_ANALISE.md, Sessão 3)
| Função | Original | Capability no app novo |
|---|---|---|
| AI Photoshoot (foto de produto) — `ProductPromptOutputFragment`, fluxo `ProductCategory → ProductImageSelect → ProductRemoveBg → ProductPosition → ProductPrompt → Output` | SD1.5 img2img/inpaint + ControlNet, só fundo (`inpainting_mask_invert`) | `ProductSceneComposer` (+ `ImageGenerator` opcional) |
| Gerar pôster/logo por prompt — `PromptOutputFragment`, `GenerateLogoDialog`, `LogoStyle/LogoType/IconSelect` | SD1.5 txt2img + ControlNet canny/scribble | `ImageGenerator` |
| Gerar conteúdo do pôster (título/desc/listas) — `GeneratePosterDialog` | gpt-3.5-turbo-0125, JSON | `TextGenerator` |
| AI Rewrite / Smart Text — `GenerateAITextDialog` (ponte: `showAIRewrite`, `getSmartText`) | gpt-3.5-turbo-0125 | `TextGenerator` |
| Remover fundo — `bg/BgRemoveActivity`, ponte `removeBg` | servidor ou ML Kit Subject Segmentation | `BackgroundRemover` |
| Remover objeto / inpaint — `objectremoval`, ponte `inPaint` | servidor (`input_image`+`mask_image`) | `Inpainter` |
| Remover texto | servidor | `TextDetector` + `Inpainter` |
| Traduzir prompt | servidor | `Translator` |
| Imagem → SVG | servidor | `Vectorizer` |
| AI Mockup — `GenerateMockupDialog`, `Mockup*Fragment` | servidor assíncrono `create-mockup-async` | `MockupRenderer` (perspectiva/composição local; generativo opcional) |
| Upscale — `extra_single_image` | A1111 | `Upscaler` |

### 3.2 Funcionalidades não-IA (do editor e do app)
Editor de canvas (texto, imagens, formas, camadas, filtros, texturas, molduras/frames, efeitos de
texto, recorte/crop, stickers, fundos, busca de fundo/imagem), templates (por categoria, online,
"trending", templates de IA), **Brand Kit** (cores, fontes, logo, perfil da empresa —
`CompanyProfileFragment`, `readUserProfile`), fontes (online, upload de fonte própria,
`fontreader`), **redimensionar** (`resize`), filtros, rascunhos/drafts e estado do canvas
(salvar/retomar), exportar (PNG/JPG/SVG, qualidade — `DownloadQualityFragment`, imprimir,
compartilhar), vídeo/áudio (`saveVideo`, `selectAudio`, `getDefaultAudioFile` — confirmar escopo),
marca d'água, idiomas, ajuda, ajustes. Busca de imagens Pexels/Unsplash/Pixabay (online).
**Fora do escopo por ser sideload/sem loja:** compra premium, anúncios, créditos diários
(`daily_credits`), avaliação na loja. Decidir com o dono se mantém algum limite.

## 4. Decisões já tomadas na conversa
- **Gratuito e offline primeiro.** Pilha local recomendada (validar versões/licenças antes):
  | Capability | Provedor local padrão |
  |---|---|
  | BackgroundRemover | ML Kit Subject Segmentation (GMS); fallback empacotado (MODNet/U²-Net/RMBG em ONNX/LiteRT — conferir licença do RMBG, BRIA é não-comercial) |
  | Translator | ML Kit Translation |
  | TextDetector | ML Kit Text Recognition |
  | Inpainter | MI-GAN (ONNX, MIT) ou LaMa |
  | Vectorizer | VTracer (MIT) via JNI |
  | TextGenerator | Gemini Nano (ML Kit GenAI, aparelhos compatíveis) → fallback Gemma 3 1B (MediaPipe LLM Inference / LiteRT-LM), download opcional |
  | ProductSceneComposer | **recorte + biblioteca de cenários pré-gerados + sombra/luz/cor locais** (sem modelo generativo; roda em qualquer aparelho) |
  | ImageGenerator | opcional, só aparelho forte: SD1.5 (ou BK-SDM) + LCM-LoRA + T2I-Adapter + TAESD (~500 MB, download sob demanda) |
  | Upscaler | Real-ESRGAN (mobile) |
- **Gemini API gratuita descartada como base**: não é offline, não tem cota gratuita para geração
  de imagem (fontes de set/2026), a cota é compartilhada por projeto e o plano gratuito usa os dados
  para treino. Pode existir como **provedor remoto opcional** de `TextGenerator`, nunca com chave no APK.
- Cenários da biblioteca: gerados **no PC** (SDXL/Flux local, gratuito) e distribuídos com o app ou
  baixados uma vez.

## 4.1 Versões e licenças confirmadas (pesquisa de 2026-10-13, sessão 4)
| Item | Versão / coordenada | Licença | Observação |
|---|---|---|---|
| ML Kit Subject Segmentation | `com.google.android.gms:play-services-mlkit-subject-segmentation:16.0.0-beta1` (inalterado desde 2023-11; release notes de 2026-07-21) | Termos ML Kit | **só via GMS** (modelo baixado pelo Play services) |
| ML Kit Text Recognition | `com.google.mlkit:text-recognition:16.0.1` (empacotado) / `play-services-mlkit-text-recognition:19.0.1` (GMS) | Termos ML Kit | usar o **empacotado** → funciona sem GMS |
| ML Kit Translate | `com.google.mlkit:translate:17.0.3` | Termos ML Kit | modelos de idioma (~30 MB cada) são **baixados em runtime** dos servidores Google; não dá para empacotar → contradiz "tudo empacotado"; tradução precisa de 1 download por idioma ou provedor alternativo |
| ML Kit GenAI Prompt (Gemini Nano) | `com.google.mlkit:genai-prompt:1.0.0-beta4` | Termos ML Kit | beta; AICore; só aparelhos listados (ex. Pixel 9+, nano-v3) |
| LiteRT-LM (LLM local) | `com.google.ai.edge.litertlm:litertlm-android` — última release **v0.18.0 (06/out)**; modelos `.litertlm` (HF litert-community) | Apache 2.0 | substitui o caminho MediaPipe LLM Inference (página Android da LiteRT-LM não cita MediaPipe; não confirmado "deprecated") |
| Modelo de texto local | **Gemma 4 E2B** (lançado 2026-04-02, **Apache 2.0**, ~1,5 GB em 4 bits — estimativa de terceiros) **em vez de Gemma 3 1B** (licença Gemma Terms, com AUP) | Apache 2.0 | Gemma 3 1B (~0,5 GB) fica como opção "leve" para aparelho fraco, aceitando os Gemma Terms |
| ONNX Runtime Android | `com.microsoft.onnxruntime:onnxruntime-android:1.31.0` | MIT | runtime dos modelos empacotados |
| MI-GAN (inpaint) | repo Picsart-AI-Research/MI-GAN; ONNX pré-convertido (pipeline 512, com pré/pós-processamento embutido) | **MIT** (2024) — confirmado no LICENSE | pesos treinados em Places2 (termos do dataset: só pesquisa — risco baixo, registrar) |
| LaMa (inpaint alternativo) | advimman/lama | Apache 2.0 | maior (~200 MB) |
| VTracer (SVG) | visioncortex/vtracer `1.0.0-alpha.3` | **MIT** (confirmado no LICENSE) | Rust → JNI (cargo-ndk) |
| Real-ESRGAN (upscale) | xinntao/Real-ESRGAN | **BSD-3-Clause** | |
| Fallback de remover fundo | **U²-Net / u2netp** (Apache 2.0, ~4,7 MB, saliência genérica) ou **BiRefNet** (MIT, melhor, maior) | | **MODNet (Apache) é só para retrato humano — descartado para produto.** RMBG-1.4/2.0 = não-comercial — descartado |
| TAESD | madebyollin/taesd | MIT | |
| SD on-device | referência: **local-dream** (QNN NPU Snapdragon 8 Gen1+, MNN CPU/GPU; ~5–15 s 512²/20 passos) | **CC BY-NC** (sinal de mirror; não confirmado no repo oficial) → **não reaproveitar código**; implementar sobre MNN/ONNX por conta própria | QNN SDK é proprietário Qualcomm |
| Fabric.js | `fabric@7.4.0` (npm, latest) | MIT | empacotar no assets do APK (offline) |

Fontes: developers.google.com/ml-kit/release-notes; github.com/google-ai-edge/LiteRT-LM/releases;
developers.google.com/edge/litert-lm/android; LICENSE de cada repo (raw.githubusercontent.com);
registry.npmjs.org/fabric/latest; repo1.maven.org (onnxruntime-android); cobertura do Gemma 4 (techwyse, implicator.ai).

## 5. Requisito central: troca fácil de provedor (local ↔ remoto ↔ qualquer um)
Requisito do dono, para a arquitetura detalhar:
- Uma **interface Kotlin por capability** (seção 3.1, coluna da direita), com `suspend` funcs e
  tipos de entrada/saída próprios do app (Bitmap/URI, máscara, prompt, opções), **sem tipos de
  provedor vazando**.
- **Implementações intercambiáveis** por capability: ex. `MlKitBackgroundRemover`,
  `OnnxBackgroundRemover`, `HttpBackgroundRemover` (genérico, configurável), `GeminiTextGenerator`,
  `OpenAiCompatibleTextGenerator` (cobre OpenAI, OpenRouter, Ollama, LM Studio, llama.cpp server),
  `Automatic1111ImageGenerator`, `ComfyUiImageGenerator`, `OnDeviceSdImageGenerator`.
- **Registro + configuração**: escolher o provedor por capability via config (JSON/DataStore +
  tela de ajustes "avançado"), com URL, header/chave e parâmetros. Trocar o provedor **sem
  recompilar**. Adicionar um novo é implementar a interface e registrar uma vez.
- **Capacidades/fallback**: cada provedor declara requisitos (GMS, RAM, NPU, rede, modelo baixado)
  e a cadeia de fallback é configurável (ex. Nano → Gemma → remoto → desligado).
- Gerenciador de modelos baixáveis (download, verificação de hash, espaço, remoção).
- Segredos do usuário (chaves dos provedores remotos) só no armazenamento local cifrado
  (EncryptedSharedPreferences/Keystore), nunca embutidos no APK.

## 6. Em aberto — decidir com o dono no início da próxima sessão
1. **Pasta do projeto novo.** Sugestão: `C:\projects\sandbox\product_photo_offline\` (fora da
   pasta de RE, que tem dados não confiáveis). Confirmar.
2. **Editor**: (a) nativo em Jetpack Compose/Canvas, ou (b) WebView com editor **próprio** em
   Fabric.js (como o original, mas escrito do zero). Trade-off: (b) é mais rápido de chegar à
   paridade de recursos de canvas/texto/fontes; (a) é mais integrado. Recomendação a fundamentar no doc.
3. Escopo de vídeo/áudio (há `saveVideo`/`selectAudio` na ponte; confirmar no fonte se é feature real).
4. minSdk (original: 28) e se exige Google Play services ou não.
5. Conteúdo próprio: templates, fontes (Google Fonts/OFL), stickers, cenários — origem e volume.

## 6.1 Decidido com o dono (2026-10-13, sessão 4)
1. **Pasta:** `C:\projects\sandbox\product_photo_offline\` (sugestão aceita, sem objeção).
2. **Editor:** WebView + editor **próprio** em Fabric.js (escrito do zero). Kotlin↔JS por ponte própria.
3. **Vídeo/áudio:** fora do MVP; fica como item futuro. Evidência: `WebViewJavascriptInterface::saveVideo`
   → `showVideoPreview` (exportação real por FFmpeg, pacote `data/model/ffmpeg/`, flag remota
   `hide_video_for_ram`); `WebViewFragment::selectAudio` (l.2433) é **stub vazio** — áudio nunca funcionou.
4. **minSdk 28, GMS opcional:** ML Kit/Gemini Nano quando houver GMS; sem GMS, fallback empacotado (ONNX/LiteRT).
5. **Conteúdo: tudo empacotado** (templates, fontes OFL, stickers, cenários pré-gerados no PC) — 100%
   offline desde a instalação, com APK grande. Consequência para a arquitetura: considerar
   Android App Bundle/asset packs não se aplica (sideload) → APK único ou APK + OBB/"asset pack"
   próprio; medir tamanho e decidir no ARQUITETURA.md. Modelos de IA grandes (Gemma, SD) continuam
   download opcional (são capabilities, não conteúdo).

## 7. Próximo passo exato
1. Ler este doc e a seção "Sessão 3" do `REA_ANALISE.md` (em `product_photo_apk`, §2). Não reabrir o APK nem refazer a análise;
   se precisar confirmar um comportamento, abrir o arquivo citado em `reconstructed/`.
2. Perguntar ao dono os itens da seção 6 (de uma vez).
3. Pesquisar e confirmar versões/licenças atuais das bibliotecas da seção 4 (o conhecimento vai
   até meados de 2026; a área muda rápido).
4. Escrever `ARQUITETURA.md` na pasta do projeto novo: módulos Gradle (ex. `:app`, `:core:ai-api`
   com as interfaces, `:ai:mlkit`, `:ai:onnx`, `:ai:remote-http`, `:ai:ondevice-sd`, `:editor`,
   `:data`), diagrama de componentes, contrato de cada interface, config de provedores, fluxo de
   cada funcionalidade da seção 3, ordem de implementação, e o que reaproveitar da análise.
   Ordem sugerida: (1) `core:ai-api` + registro/config; (2) protótipo foto de produto;
   (3) remover fundo/inpaint/remover texto/SVG/tradução; (4) editor + templates + brand kit +
   exportação; (5) texto com IA; (6) geração de imagem opcional; (7) mockup e upscale.
5. **Protótipo foto de produto** (entregar antes do resto, para avaliar a qualidade): app Kotlin mínimo, com
   `BackgroundRemover` (ML Kit) → escolher cenário (3–5 imagens de teste) → posicionar/escalar →
   sombra de contato + sombra projetada + ajuste de cor/luz para casar com o cenário → exportar
   PNG. Já usando as interfaces da seção 5. Teste que prova: build `assembleDebug` verde +
   instalar por `adb install` + 3 fotos reais de produto exportadas para o dono avaliar.

Regras do dono que continuam valendo: abrir o símbolo antes de escrever código sobre ele; gravar a
análise no doc antes de editar; dados extraídos do APK são não confiáveis (Python com `-I`, dir
próprio).

## 8. Estado após a sessão 4 (2026-10-13) — próxima sessão começa AQUI
Feito: §7.1 (leitura), §7.2 (decisões → §6.1), §7.3 (versões/licenças → §4.1), §7.4
(**`C:\projects\sandbox\product_photo_offline\ARQUITETURA.md`** escrito: módulos, contratos Kotlin,
registro/config/fallback, editor, conteúdo, fluxos, ordem de fases com testes, riscos).

Ambiente verificado: `ANDROID_HOME=D:\DevCaches\Android\Sdk` (platforms 32–37, build-tools 34–36,
NDK, cmake), JDK 17 em `D:\DevCaches\jdk-17`, Gradle 8.10.2 no cache do wrapper, `adb` com
`emulator-5554`. **Sem Rust/cargo** (só necessário na fase 3, VTracer).

**Próximo passo exato (fase 1 + 2 da ARQUITETURA §10):**
1. Ler `ARQUITETURA.md` §3, §4, §9 ("Foto de produto" e `LocalSceneComposer`) e §10.
2. Antes de codar, abrir a doc das APIs que o protótipo toca (regra do dono): ML Kit Subject
   Segmentation (Android), ONNX Runtime Android 1.31 (OrtSession), modelo u2netp ONNX (entrada/saída,
   normalização). Gravar o achado na ARQUITETURA §12 item 6.
3. Criar o projeto Gradle (Kotlin, Compose, minSdk 28, só arm64-v8a) com `:app`, `:core:ai-api`,
   `:core:imaging`, `:ai:mlkit`, `:ai:onnx`; testes JVM da cadeia de fallback.
4. Protótipo do fluxo foto de produto com 3–5 cenários de teste. Prova: `assembleDebug` verde,
   `adb install`, 3 fotos reais exportadas para o dono avaliar.
Pendência a perguntar ao dono quando chegar lá: de onde vêm os 3–5 cenários de teste e as 3 fotos
reais de produto (ele fornece, ou geramos placeholders?).

## 9. Estado após a sessão 5 (2026-10-13) — próxima sessão começa AQUI
Feito: **fases 1 e 2** da ARQUITETURA §10. Projeto Gradle em `C:\projects\sandbox\product_photo_offline\`
(`:app`, `:core:ai-api|imaging|secrets|models`, `:ai:mlkit|onnx`, `:feature:product`). Registro
completo (APIs conferidas, hipóteses descartadas, provas, pendências) na **ARQUITETURA §13**;
amostras exportadas em `product_photo_offline/docs/fase2_amostras/`.

Decidido com o dono nesta sessão: fotos de teste = CC0 do Wikimedia Commons (créditos no README das amostras).

Ambiente novo: AVD `pp_api34` (API 34, x86_64, Play Store). Subir com
`emulator -avd pp_api34`; usar `adb -s emulator-5554` (há um aparelho físico conectado).
Build: `JAVA_HOME=D:\DevCaches\jdk-17`, `./gradlew assembleDebug testDebugUnitTest`.

**Antes de seguir para a fase 3, o dono avalia** as amostras (qualidade do recorte u2netp × ML Kit e
das sombras). Perguntas em aberto para ele:
1. Posso instalar e medir no aparelho físico arm64 (tempos reais; `KeystoreAead`)?
2. A qualidade do u2netp basta para o caminho sem GMS, ou trocamos por BiRefNet-lite (§12.2)?

**Próximo passo exato:** fase 3
(ARQUITETURA §10: MI-GAN, remover texto, VTracer, tradução) — começa pela etapa analítica das APIs
(§12 item 6) e exige Rust/cargo-ndk para o VTracer, que não está instalado.


## 10. Estado após a sessão 6 (2026-10-14) — próxima sessão começa AQUI
Feito: **fase 3** da ARQUITETURA §10: inpaint (MI-GAN, `onnx.migan`), remover texto (`mlkit.text-bundled`
+ `TextRemover`), imagem → SVG (`:ai:vtracer`, Rust via JNI) e tradução (`mlkit.translate` + Language ID).
Registro completo (APIs, comandos, hipóteses descartadas, provas, tamanhos, pendências) na
**ARQUITETURA §14**. O dono pediu para seguir sem a avaliação das amostras da fase 2 (§9), que continua
em aberto, junto com as duas perguntas da §9 (aparelho físico; u2netp × BiRefNet-lite).

Ambiente novo: Rust 1.99 isolado em `D:\DevCaches\rust` (`rustup`/`cargo`, PATH do sistema intocado),
alvos Android instalados; o Gradle acha o toolchain por `rust.home` no `local.properties`.

**Próximo passo exato:** fase 4 (ARQUITETURA §10: editor web Fabric.js + ponte + templates + brand kit +
rascunhos + exportação). Começa pela etapa analítica pendente desde a §12.6: abrir a API de
`androidx.webkit` (`WebViewAssetLoader`, `WebViewCompat.addWebMessageListener`) e a do `fabric@7.x`
antes de codar; o projeto `editor-web/` precisa de Node (já instalado: `C:\Program Files\nodejs`).


## 11. Pedido avulso da sessão 8 (2026-10-14): câmera, zoom na máscara, download de modelos
Análise feita e gravada na **ARQUITETURA §16** (APIs conferidas, BiRefNet-lite baixado e conferido, tasks com
teste). "Abrir no editor" ficou com a fase 4 (§15, sessão 7). **Implementar só depois que a §15 fechar**: as
duas mexem em `ProductFlowScreen.kt`, `AppGraph.kt` e no manifest (`FileProvider`).

Frase de abertura da sessão de implementação:
> Leia ARQUITETURA.md §16 (e §15.5 para o estado do editor). Execute as tasks 1–5 da §16.4.

Cópia conferida do modelo (evita baixar de novo no PC para o teste instrumentado): scratchpad da sessão 8,
`dl_birefnet/birefnet_lite_2.onnx` (sha256 `5600024376…f03333`). É temporária e pode já ter sido limpa.

## 12. Estado após a sessão 7 (2026-10-14) — próxima sessão começa AQUI
Feito: **fase 4** da ARQUITETURA §10: editor web próprio (`editor-web/`, TypeScript + Vite 8.3.1 + fabric 7.4.0),
ponte Kotlin ↔ JS por `addWebMessageListener` (`:editor`, androidx.webkit 1.17.1), templates/adesivos/fundos feitos por
nós + 12 fontes OFL (`tools/gen_content.py`, `app/src/main/assets/content/`), brand kit e rascunhos em arquivos (`:data`),
exportação PNG/JPG/SVG (galeria, compartilhar, imprimir), Home com Foto de produto / Novo design / Modelos / Rascunhos /
Brand kit, e "Abrir no editor" no resultado da foto de produto. Registro completo (APIs, decisões, hipóteses descartadas,
provas, pendências) na **ARQUITETURA §15**.

Build do editor web: `cd editor-web && npm run build` (gera `editor/src/main/assets/editor/`, versionado; o Gradle só
confere que existe). Testes: `npx vitest run`; `./gradlew assembleDebug testDebugUnitTest`;
`ANDROID_SERIAL=<pp_api34> ./gradlew :editor:connectedDebugAndroidTest :app:connectedDebugAndroidTest`.

Continuam em aberto: avaliação das amostras da fase 2 e as perguntas da §9 (aparelho físico; u2netp × BiRefNet-lite).
Verificar pela interface o que a §15.5 lista como "não verificado" (seletores, compartilhar/imprimir, recorte, pincel,
filtros, curva, Camadas, Rascunhos, Brand kit, "Abrir no editor") — de preferência no aparelho físico, se o dono liberar.

**Próximo passo exato:** a fase 4 fechou, então vem a §11 acima (sessão 8): implementar a ARQUITETURA §16
(câmera, zoom no editor de máscara, download de modelos/BiRefNet-lite) — ler antes a nota "Para a §16" no fim da
§15.5 (onde está o `FileProvider` e o "Abrir no editor"). Frase de abertura:
> Leia ARQUITETURA.md §16 e o fim da §15.5. Execute as tasks 1–5 da §16.4.

Depois, fase 5 (ARQUITETURA §10: texto com IA — Gemini Nano → LiteRT-LM → OpenAI-compatível).
Começa pela etapa analítica pendente desde a §12.6: abrir a API de `litertlm-android` (v0.18.0) e do ML Kit GenAI Prompt
(`genai-prompt:1.0.0-beta4`) antes de codar; o handler `ai.rewriteText` do editor já existe e responde `unsupported`.

## 13. Estado após a sessão 9 (2026-10-14) — próxima sessão começa AQUI
Feito: **ARQUITETURA §16, tasks 1–5**: câmera ("Tirar foto", FileProvider único do `:editor` com `cache-path capture/`),
zoom/pan/toque duplo no editor de máscara (`MaskViewport`), download retomável de modelos (`ModelDownloader` +
`ModelDownloadWorker`/WorkManager 2.10.5, SHA-256 obrigatório), BiRefNet-lite como provedor `onnx.birefnet-lite`
(modo "BiRefNet (baixado)", fora do Automático) e a tela "Modelos de IA" na Home. Registro completo (decisões,
provas, hipóteses descartadas, pendências) na **ARQUITETURA §17**.

Provas: 71 testes JVM verdes; instrumentados `:app` 4/4 e `:editor` 4/4 no `pp_api34`; pela interface, download
morto no meio e retomado com `Range` até o hash certo, e foto da câmera chegando ao recorte em pé.

**Achado que muda planos:** o BiRefNet-lite fp32 a 1024² passa de **3,3 GB** no processo (morto pelo LMK com
emulador de 2 e de 4 GB). `MinRamMb` foi para 8192. Por isso ainda não existe máscara do BiRefNet nem a
comparação com o u2netp.

Para decidir com o dono:
1. Liberar o aparelho físico (moto g86, já visível no adb pela rede) para medir o BiRefNet em arm64 e testar a
   pinça com os dedos.
2. Se o BiRefNet não couber nos aparelhos-alvo: export fp16, reexportar em 768/512 ou outro modelo.

Frase de abertura (se o dono liberar o aparelho):
> Leia ARQUITETURA.md §17.5 (Pendências). Meça o BiRefNet no aparelho físico com `BiRefNetInstrumentedTest`
> (via `am instrument`, sem desinstalar) e registre em docs/.

Depois disso, segue a fase 5 (texto com IA), como no fim da §12.


## 14. Estado após a sessão 10 (2026-10-14) — próxima sessão começa AQUI
Feito nesta sessão (curta): o cartão "Modelos" da Home virou **"Templates"** (`HomeScreen.kt:73`), para não
confundir com "Modelos de IA". O editor web foi renomeado do mesmo jeito: aba e folha "Templates", "Abrindo template" e
"Usar template" (`editor-web/src/main.ts`), e os assets em `editor/src/main/assets/editor/` foram regerados
(`npm run build`). Provas: vitest 18/18; `./gradlew assembleDebug testDebugUnitTest` verde, 71 testes JVM (1 skipped, o `CompositorHarness`), APK regerado.

O dono decidiu **seguir para a fase 5**. As pendências da §13 (BiRefNet no aparelho físico, pinça com os dedos,
escolher entre fp16, 768/512 ou outro modelo) continuam abertas e **não bloqueiam** a fase 5.

**Próximo passo exato: fase 5** (ARQUITETURA §10: texto com IA, Gemini Nano → LiteRT-LM → OpenAI-compatível).
Começar pela etapa analítica e gravá-la numa **§18** da ARQUITETURA antes de qualquer código:
- O que já existe: só `Capability.TEXT_GENERATOR` (`core/ai-api/.../Provider.kt:7`). A interface `TextGenerator`
  está apenas no texto da ARQUITETURA §3 (linha ~117), não no código. A cadeia padrão prevista está na §4.4
  (`mlkit.gemini-nano` → `litertlm` → desligado), e o fluxo com `jsonSchema` + validação + 1 retry na §9.
- No editor, `ai.rewriteText` responde `UNSUPPORTED` (`editor/.../EditorHandlers.kt:108`). O protocolo é o da §15.2.
- APIs a abrir antes de codar (pendência da §12.6): `litertlm-android` (v0.18.0) e ML Kit GenAI Prompt
  (`genai-prompt:1.0.0-beta4`); para o provedor HTTP, OkHttp ou `HttpURLConnection`; `SecretStore` para a chave.
- Testes: a §10 fala em MockWebServer, mas a sessão 9 mostrou (§17.5) que no teste JVM do Android o
  `com.sun.net.httpserver` não resolve; o `ModelDownloaderTest` já tem um servidor `ServerSocket` mínimo que pode
  servir de base. Ou se adiciona `mockwebserver`, decidindo e registrando na §18.
- Modelos LiteRT-LM (Gemma) são grandes: devem entrar como **baixáveis** pelo `ModelDownloader`/tela "Modelos de IA"
  da §17. Medir a RAM cedo: o BiRefNet mostrou que a estimativa pode errar por 2× (§17.5).
- Ambiente: sempre `ANDROID_SERIAL=<serial do pp_api34>`; o serial muda (5554 ou 5556), conferir com `adb -s <serial> emu avd name` (o moto g86 e outro emulador também aparecem no adb). O `:app:connectedDebugAndroidTest`
  desinstala o app e apaga modelos baixados (§17.5): para o `:app`, usar `installDebug installDebugAndroidTest` +
  `adb shell am instrument -w -e class …`.

Frase de abertura:
> Leia HANDOFF_APP_OFFLINE.md §14 e ARQUITETURA.md §3, §4.4, §9 (texto IA), §10 (fase 5) e §17.5. Faça a etapa
> analítica da fase 5 (APIs de LiteRT-LM e ML Kit GenAI Prompt), grave-a na ARQUITETURA §18 e implemente a fase 5.

## 15. Estado após a sessão 11 (2026-10-14) — próxima sessão começa AQUI
**Fase 5 (texto com IA) concluída.** Análise, decisões, provas e pendências em `ARQUITETURA.md` **§18** (§18.7 = resultado).
Resumo: Kotlin subiu para **2.4.0** (as libs novas trazem metadado 2.3/2.4; `kotlinOptions` virou `compilerOptions` em todos os
módulos); `:core:ai-api` ganhou `TextGenerator`/`StructuredText` (JSON validado + 1 retry, instrução por exemplo de forma);
módulos novos `:ai:litertlm` (LiteRT-LM 0.18.0) e `:ai:remote-http` (OpenAI-compatível); `mlkit.gemini-nano` em `:ai:mlkit`;
catálogo com `gemma-4-e2b-it` (2,6 GB) e `qwen3-0.6b-int4` (345 MB); tela "Texto com IA" na Home; no editor, "✨ Reescrever"
(painel do texto) e "✨ Gerar textos com IA" (aba Texto). Provas: 91 testes JVM, vitest 21/21, instrumentados verdes
(`EditorBridgeInstrumentedTest` 5/5, `LiteRtLmInstrumentedTest` com o Qwen real: ~10 s por pedido, pico 1,27 GB), fluxo pela
interface com o LLM local e com um servidor falso. APK release 154,2 MB.

Abertos (não bloqueiam a fase 6): Nano em aparelho com AICore; Gemma 4 E2B em aparelho ≥ 6 GB; download do Hugging Face pelo
app — **neste PC o Kaspersky intercepta TLS do huggingface.co e o emulador recusa o certificado** (não é bug do app; o modelo do
teste foi instalado por `adb push`); servidor real (Ollama/LM Studio). Pendências anteriores (BiRefNet em aparelho ≥ 8 GB, pinça
na máscara) continuam. O emulador ficou com o texto em "Só servidor" → voltar para "Só no aparelho".

**Próximo passo sugerido: fase 6** (ARQUITETURA §10: geração de imagem remota A1111/ComfyUI, depois on-device) — confirmar
com o dono antes. Começar pela etapa analítica numa §19 (APIs HTTP do A1111 `/sdapi/v1/txt2img|img2img` e ComfyUI `/prompt` +
`/history` + websocket; parâmetros de §11; `ImageGenerator` da §3 ainda não existe no código). O provedor HTTP da fase 5
(`:ai:remote-http`, servidor `ServerSocket` nos testes) é a base.

Frase de abertura:
> Leia HANDOFF_APP_OFFLINE.md §15 e ARQUITETURA.md §3 (ImageGenerator), §9, §10 (fase 6), §11 e §18.5/§18.7. Faça a etapa
> analítica da fase 6 (A1111 e ComfyUI), grave-a na ARQUITETURA §19 e implemente a parte remota da fase 6.

## 16. Estado após a sessão 12 (2026-10-14) — próxima sessão começa AQUI
**Etapa analítica da fase 6 (parte remota: A1111 e ComfyUI) concluída; nada implementado ainda.** Tudo em `ARQUITETURA.md` **§19**:
APIs conferidas no fonte (§19.2: `/sdapi/v1/txt2img|img2img|progress|interrupt` + ControlNet `alwayson_scripts`; ComfyUI `/prompt`,
`/history/{id}`, `/view`, `/upload/image`, `/queue`, `/interrupt` e os nós do grafo embutido), hipóteses descartadas (§19.4: fila
agent-scheduler, websocket, `Bitmap` em teste JVM, `VAEEncodeForInpaint`), decisões (§19.5) e **5 tasks com o teste de cada uma (§19.6)**.
Ponto central do desenho: os clientes HTTP trabalham com PNG em `ByteArray` (`ImageJob` → `ImageBackend`), porque teste JVM não cria
`Bitmap`; a conversão fica num `ImageCodec` fino. **Decisão do dono (sessão 12): a geração de imagem fica ligada por padrão**
(cadeia `[http.a1111]` sem URL; a tela pede o endereço — §19.5 e §4.4 atualizadas). A sessão foi cortada na fronteira análise → implementação, a pedido do dono.

Pendências anteriores (§15) continuam.

Frase de abertura:
> Leia ARQUITETURA.md §19 (análise da fase 6 remota) e implemente as tasks da §19.6 na ordem, abrindo antes cada arquivo que for
> tocar. Ao terminar, grave o resultado numa §19.7 e atualize o HANDOFF.

## 17. Estado após a sessão 13 (2026-10-14) — próxima sessão começa AQUI
**Fase 6 remota implementada** (as 5 tasks da §19.6). Resultado, desvios e pendências em `ARQUITETURA.md` **§19.7**:
`ImageGenerator`/`ImageRequest` no `:core:ai-api`; `A1111Backend` e `ComfyBackend` (+ `ComfyWorkflow`, grafo embutido ou fluxo do
usuário com marcadores) no `:ai:remote-http`; tela **"Gerar imagem"** na Home, com a cadeia `IMAGE_GENERATOR` ligada por padrão
(A1111 sem URL). `assembleDebug testDebugUnitTest` verde, **126 testes JVM** (eram 91). Ponta a ponta no emulador contra um
servidor falso (A1111 e ComfyUI): gerar → grade → abrir no editor.

Achado fora do escopo: **cancelar o `OpenAiCompatibleTextGenerator` não derruba a conexão** (o `invokeOnCompletion` só dispara quando
o job termina). O `Http` novo já resolve com `async` + `disconnect` no cancelamento; aplicar o mesmo no texto é tarefa própria.

Pendências principais (§19.7): servidor real (ControlNet, `--api-auth`, fluxo próprio do ComfyUI); ControlNet e Cancelar pela
interface; campos de ControlNet/fluxo só no `provider_config.json`. Pendências anteriores (§15) continuam.

Frase de abertura (escolher uma):
> Leia ARQUITETURA.md §19.7 (pendências) e corrija o cancelamento do OpenAiCompatibleTextGenerator com o padrão do `image/Http.kt`,
> com um teste que prove que cancelar derruba a conexão.

> Leia ARQUITETURA.md §19.7 e §10 e faça a análise da próxima fase (modo "IA generativa" da foto de produto ou fase 7, upscale),
> gravando-a numa §20 antes de implementar.

## 18. Decisões do dono em 2026-10-15 (depois da sessão 13)
1. **Correção de rumo: o app é offline primeiro** (§4, §6.1). A sessão 13 fez a geração de imagem *remota* antes da local; a
   prioridade agora é a **geração de imagem no aparelho** (`:ai:ondevice-sd`). O código de servidor (A1111/ComfyUI) fica só como
   opção "trocar para remoto" (item 6 da §1). A cadeia padrão `IMAGE_GENERATOR = [http.a1111]` (§19.5) **deve virar o modelo no
   aparelho**, com servidor só se o usuário configurar. O dono não respondeu se o servidor deve sair do app: mantido como opcional.
2. **Downloads de primeiro uso: aceitos** (modelos de tradução do ML Kit, LLMs, BiRefNet, SD). Ajusta o "100% offline desde a
   instalação" da §6.1: offline depois do primeiro download de cada modelo.
3. **Aparelho de teste autorizado: moto g86 5G** (adb sem fio, serial `192.168.18.112:<porta>`, a porta muda). Medido em 2026-10-15:
   MediaTek **Dimensity 7300 (MT6878)**, 4× A78 + 4× A55, GPU **Mali-G615 MC2**, **8 GB de RAM** (MemTotal 7,5 GB; ~2,8 GB livres
   com o aparelho em uso), Android 16 (API 36), 138 GB livres. Sem caminho de NPU aberto para SD na MediaTek (os apps abertos usam
   NPU só em Snapdragon via QNN): no moto o SD roda em **CPU ou GPU** — é o aparelho de "pior caso aceitável".

~~**Próximo passo**: etapa analítica da geração no aparelho~~ — **substituído pela §19 abaixo: a geração no aparelho ficou por último.**
O que segue continua valendo como roteiro da futura análise (fase 8): Pontos: motor
(ONNX Runtime, já no projeto, vs MNN vs LiteRT/QNN), modelo (SD1.5 vs BK-SDM-tiny + LCM, int8/fp16, TAESD), sondas de tempo e
RSS **no moto** (CPU e GPU) para fixar o requisito mínimo (`MinRamMb`) e quantos passos dá para usar, e a troca da cadeia padrão.

Frase de abertura (para quando chegar a vez da fase 8):
> Leia HANDOFF_APP_OFFLINE.md §18 e ARQUITETURA.md §3, §4.4, §10 e §19.5/§19.7. Faça a etapa analítica da geração de imagem no
> aparelho (motor, modelo, sonda de tempo e RAM no moto g86 conectado) e grave-a na ARQUITETURA numa seção nova antes de implementar.

## 19. Passagem de bastão (2026-10-15) — próxima sessão começa AQUI
**Decisão do dono: a geração de imagem no aparelho fica por último** (virou a fase 8 na tabela da ARQUITETURA §10). Continuam valendo
as decisões da §18: offline primeiro, downloads de primeiro uso aceitos, moto g86 autorizado para testes.

**Pesquisado nesta conversa** (página oficial de preços, `aistudio.google.com/docs/pricing`, lida em 2026-10-15):
- **Nenhum modelo de imagem da API Gemini tem plano gratuito**: Nano Banana, Nano Banana 2, 2 Lite, 2.1 e Pro estão como
  "Not available" na coluna Free; pagos custam ~US$ 0,034 a 0,134 por imagem. O `gemini-2.5-flash-image` foi desligado em
  2 de outubro de 2026. O quadro "Free" do topo da página é genérico ("Limited access to certain models").
- O **Gemini 3.1 Flash-Lite** (só **texto**) é "Free of charge", mas o plano gratuito usa o conteúdo para treinar ("Used to improve
  our products: Yes"). Possível **provedor remoto opcional de texto**, com a chave do usuário (pendência baixa, não pedida).
- Aparelho mínimo para SD no celular (para a fase 8): arm64 com 8 GB de RAM; NPU só em Snapdragon (Hexagon V68+, 5–15 s por
  512²); MediaTek/Exynos/Tensor só CPU/GPU (estimativa 30–60 s por 512² a 20 passos; não medido). Fontes na conversa: README do
  Local Dream, docs do Off Grid, demo da Qualcomm, arXiv 2304.11267.

**Ordem sugerida para as próximas sessões** (todas offline; confirmar com o dono na abertura):
1. **Corrigir o cancelamento do `OpenAiCompatibleTextGenerator`** (defeito conhecido, §19.7 da ARQUITETURA): trocar o
   `invokeOnCompletion { disconnect }` pelo padrão de `ai/remote-http/.../image/Http.kt` (troca em `async(IO)` + `disconnect` no
   `CancellationException`). Teste: servidor `ServerSocket` que segura a resposta; cancelar → a conexão cai e `generate` termina
   antes do servidor responder. Curto.
2. **Confirmar com o dono a cadeia padrão de imagem até a fase 8**: hoje vem ligada em `[http.a1111]` sem URL (§19.5, pedido da
   sessão 12). Com "offline primeiro", a alternativa é vir **desligada** (tela "Gerar imagem" mostrando "Desligado") até existir o
   modelo no aparelho. Mudança em `AppGraph.DEFAULT_CONFIG` + `ImageGenConfigTest`.
3. **Medições no moto g86** (offline de verdade; antes só emulador). Rodar com `ANDROID_SERIAL=192.168.18.112:<porta>` e
   `installDebug installDebugAndroidTest` + `am instrument` (não `connectedDebugAndroidTest`, que desinstala):
   - **BiRefNet** (`BiRefNetInstrumentedTest`, pendente desde a §17): tempo e RSS em 8 GB; recalibrar `MinRamMb`.
   - **MI-GAN** numa foto de 12 MP; **Qwen3-0.6B / Gemma 4 E2B** (Gemma pede 6 GB: cabe); tempo e RSS.
   - **Download de modelo do Hugging Face pelo app** na rede do aparelho (no PC o Kaspersky intercepta).
   - Gemini Nano: conferir se o moto tem AICore (provavelmente não).
   - Passada manual pela interface: o que a §15/§17 da ARQUITETURA lista como "não verificado pela interface".
4. **Fase 7 — mockup e upscale** (Real-ESRGAN, homografia): etapa analítica numa ARQUITETURA **§20** antes do código.
5. **Por último — fase 8**, geração de imagem no aparelho (roteiro na §18).

**Em aberto (dono, 2026-10-15): "o ideal seria local, mas talvez para celulares mais fracos vamos precisar rodar em um servidor".**
A cadeia já cobre isso sem código novo: `[ondevice-sd (MinRamMb ~8 GB + modelo baixado) → servidor → indisponível]`; a medição
da fase 8 no moto g86 define a linha local/servidor. Falta decidir **quem roda o servidor** (decidir depois da fase 8):
- (a) **o dono hospeda** para os usuários de celular fraco: exige backend próprio na frente do ComfyUI/A1111 (fila, limite por
  aparelho, moderação NSFW como o original); **sem segredo no APK** (§5) e sem Play Integrity confiável em sideload → cadastro de
  usuário ou token por aparelho com cota; custo de GPU. É praticamente um segundo projeto.
- (b) cada usuário aponta para um servidor próprio (já existe na tela "Gerar imagem").
- (c) serviço pago com a chave do usuário (ex. Nano Banana, sem plano gratuito na API).
Se for (a) ou servidor compartilhado: o `/sdapi/v1/interrupt` do A1111 é **global** (o cancelamento de um usuário interrompe o
job de outro) e o `/progress` também; o ComfyUI tem fila e cancelamento por `prompt_id` — preferir ComfyUI, ou o agent-scheduler no A1111.

Estado deixado: emulador `pp_api34` parado, com a cadeia de texto em "Só servidor" (`10.0.2.2:8765`, servidor falso parado) e a de
imagem em A1111 `10.0.2.2:7860` com a credencial `image.a1111` salva; o app **não** está instalado no moto. Nada pendente de commit
(o projeto não está em git).

Frase de abertura:
> Leia HANDOFF_APP_OFFLINE.md §19 (e §18). Confirme comigo a ordem e a cadeia padrão de imagem; depois faça o item 1 (cancelamento
> do OpenAiCompatibleTextGenerator, com teste) e siga para as medições no moto g86 do item 3, gravando os resultados na ARQUITETURA.

## 20. Passagem de bastão (2026-10-15, sessão 14)
Registro completo: **ARQUITETURA.md §21** (`product_photo_offline/`). Feito nesta sessão, com prova:
1. **Cancelamento do `OpenAiCompatibleTextGenerator`** corrigido (padrão do `image/Http`); teste novo que falhou contra o código
   antigo e passa agora. 127 testes JVM verdes.
2. **Cadeia padrão de imagem: DESLIGADA** (decisão do dono nesta sessão) até a fase 8.
3. **Moto g86** (agora por **USB**, serial `ZY32LMNN9B`; o adb sem fio caiu): MI-GAN 12 MP 2,2–2,8 s / 1,0–1,4 GB; Qwen3 e Gemma 4
   E2B em CPU e GPU (tabela na §21.4; Gemma CPU é a melhor opção de qualidade); downloads do HF pelo app OK (Gemma 2,6 GB em ~6 min);
   sem AICore; **BiRefNet-lite morto pelo LMK a ~5,1 GB** (não cabe em 8 GB); GPU do LiteRT-LM exigiu `uses-native-library
   libOpenCL.so` no manifest (feito); passada pela interface parcial (foto → recorte → cenário → editor → remover objeto OK).

**Decisões pendentes do dono**: (a) o que fazer com o BiRefNet (fp16 / entrada menor / outro modelo / tirar); (b) marcadores
`{{company}}` visíveis com brand kit vazio. Demais pendências: §21.4 "Pendências novas".

**Próximo passo** (ordem da §19, já confirmada): item 4 — **fase 7, mockup e upscale**: etapa analítica numa ARQUITETURA **§20**
antes do código. As pendências pequenas da §21.4 (itens 2 e 3) podem entrar antes, se o dono quiser.

Frase de abertura:
> Leia HANDOFF_APP_OFFLINE.md §20 e ARQUITETURA.md §21.4. Decida comigo o BiRefNet; depois faça a etapa analítica da fase 7
> (mockup e upscale) numa ARQUITETURA §20 antes de implementar.

## 21. Passagem de bastão (2026-10-15, sessão 15) — próxima sessão começa AQUI
Sessão só analítica: **nenhum código mudou**. Registro completo na ARQUITETURA **§20** (fase 7) e **§21.5** (decisões).
1. **BiRefNet** — fato novo: o checker compara o `MinRamMb` com o MemTotal (moto = 7.393 MB < 8192), então **o app já bloqueia
   o BiRefNet no moto**; o crash da sessão 14 foi só no teste direto. Decisão do dono: **medir alternativas** (BiRefNet-lite fp16
   do `onnx-community`, ISNet-general-use do rembg; fica o que couber em ~2 GB, senão sai do catálogo); até lá `minRamMb` 12288.
2. **Brand kit vazio** → decisão: **texto de exemplo** editável no lugar dos `{{…}}`.
3. **Fase 7 — análise feita (ARQUITETURA §20)**. Decisões do dono: upscale no **editor** e em **Gerar imagem**; mockup só
   **superfícies planas**; templates **procedurais de teste**; encaixe **corte central + "Ajustar"**. Modelo: Real-ESRGAN
   **general-x4v3** do pacote da Qualcomm (BSD-3, ~5 MB, entrada fixa 128² → 512²; pesos em `.data` externo → juntar num `.onnx`
   único no PC). Tasks 1–11 na §20.5, cada uma com o teste que a prova.

**Próximo passo**: §20.5 **task 1** — juntar o ONNX (float e w8a8) e medir no moto (USB `ZY32LMNN9B`) ms por tile e VmHWM em
CPU × XNNPACK; a tabela decide a variante. Depois, tasks 2–11 em ordem. As pendências da §21.5 (BiRefNet, brand kit, MinRamMb ×
MemTotal, crop desfeito no editor) são registros próprios: fazer antes ou depois, conforme o dono.
Os zips baixados ficaram no scratchpad da sessão 15 (`dl_esrgan/`), que não sobrevive: baixar de novo pelas URLs da §20.2 e
conferir os sha256.

Frase de abertura:
> Leia HANDOFF_APP_OFFLINE.md §21 e ARQUITETURA.md §20 (e §21.5). Implemente a fase 7 a partir da task 1 da §20.5 (medição do
> Real-ESRGAN no moto g86 por USB), gravando os resultados numa §20.6 antes de seguir para as tasks 2–11.

## 22. Passagem de bastão (2026-10-15, sessão 16) — próxima sessão começa AQUI
Fase 7 **implementada** (tasks 1–11 da ARQUITETURA §20.5); registro em **§20.6** (medição), **§20.7** (tasks 2–4) e
**§20.8** (tasks 5–10); §3, §4.4 e §8 atualizadas. `assembleDebug testDebugUnitTest` verde (**157 testes JVM**), vitest 24/24.
Decisões tomadas pela medição (regras escritas na §20.4/20.5):
1. **Real-ESRGAN float + XNNPACK** (554 ms/tile no moto); w8a8 2,2× mais rápido mas reprovado (6,2/255 de diferença, −2 dB).
2. **Sobreposição 24 px** (8 deu emenda de até 22/255 com o modelo real) → ×2/×4 de 512² em ~27 s.
3. **Limite: entrada ≤ 1 MP** (1024² ≈ 93 s), nos dois fatores.
4. `replaceImage` do editor deduz o fator pelos tamanhos naturais → serve o upscale e corrige o recorte desfeito (§21.5).

**Teste manual no moto feito** (ARQUITETURA §20.8, fim): Mockup pela Home, "Ver em mockup" do editor, Ajustar (arrasto),
Salvar, Abrir no editor, limite de 1 MP com mensagem, upscale 2× de 512² em ~30 s mantendo o tamanho na tela. Corrigidos
na hora: rótulo "Resultado inválido" → "Não foi possível" no editor; `Scaffold` na tela Ajustar.

**Falta**:
- Upscale numa imagem **recortada** na tela (alças do Fabric não respondem ao adb; precisa de dedo) e pinça no Ajustar.
- "Ampliar 2×" do Gerar imagem (só aparece com servidor configurado) e Compartilhar do mockup.
- Ponte do editor sem cancelamento (upscale de até ~90 s não se cancela no editor) — registro próprio.
- Pendências antigas da §21.5 (BiRefNet alternativas, brand kit vazio, MinRamMb × MemTotal) continuam.

**Estado deixado**
- Moto g86 no USB (`ZY32LMNN9B`), tela em paisagem (2712×1220: coordenadas de toque mudam). App + APK de teste da sessão 16
  instalados. Sobra de teste em `files/probe/` do app (os dois `.onnx` juntados + `.bin` do tile 7, ~10 MB): pode apagar
  com `adb shell run-as com.productphoto.offline rm -r files/probe`. Galeria sem arquivos de teste.
- Ferramentas novas no projeto: `tools/merge_onnx.py`, `tools/gen_mockups.py`; probes `DeviceProbe#esrgan`/`#upscale` e
  `RealEsrganSeamInstrumentedTest`. Os scripts de comparação e o `ui.py` (automação por adb) ficaram no scratchpad da
  sessão 16, que não sobrevive — a descrição está na §20.6/§20.8.
- `onnx 1.23.2` instalado no Python do PC (wheel manual; `pip install` direto falha aqui, ver memória).
- Nada versionado em git (o projeto não é repositório).

**Ordem sugerida** (o dono decide): (1) BiRefNet — medir fp16 e ISNet no moto (§21.5 item 1; até lá `minRamMb` 12288 ainda
**não foi aplicado** no catálogo nem no `OnnxBiRefNetRemover.MIN_RAM_MB`); (2) `MinRamMb` × MemTotal (margem + mensagem);
(3) brand kit vazio com texto de exemplo; (4) cancelamento na ponte do editor; (5) fase 8 (geração de imagem no aparelho).

Frase de abertura (próximo trabalho, escolher com o dono):
> Leia HANDOFF_APP_OFFLINE.md §22 e ARQUITETURA.md §20.8 e §21.5. Fase 7 concluída; escolha entre as pendências da §21.5
> (BiRefNet fp16/ISNet, brand kit vazio, MinRamMb × MemTotal) e o cancelamento na ponte do editor.

## 23. Passagem de bastão (2026-10-15, sessão 17) — próxima sessão começa AQUI
Feito: **`MinRamMb` × MemTotal** (ARQUITETURA **§22**). `minRamMb` agora é a RAM anunciada; o checker arredonda o MemTotal
para o próximo tamanho comercial (`advertisedRamMb`, `core/ai-api/.../Provider.kt`): o moto (7.393 MB) conta como 8 GB,
aparelhos de 6 GB passam o Gemma. BiRefNet subiu para **12288** (catálogo + `MIN_RAM_MB`), como decidido na §21.5.
159 testes JVM verdes; app reinstalado no moto e tela Modelos conferida. Falta ver a recusa no fluxo Foto de produto.

Pendências restantes (o dono escolhe): (1) BiRefNet fp16 / ISNet no moto (§21.5 item 1); (2) brand kit vazio com texto de
exemplo (§21.5 item 2); (3) cancelamento na ponte do editor (§20.8); (4) fase 8.

Frase de abertura:
> Leia HANDOFF_APP_OFFLINE.md §23 e ARQUITETURA.md §21.5 e §22. Escolha entre BiRefNet fp16/ISNet, brand kit vazio e o
> cancelamento na ponte do editor.

## 24. Passagem de bastão (2026-10-16, sessão 18) — próxima sessão começa AQUI
Feito: **brand kit vazio com texto de exemplo** (ARQUITETURA **§23**). Variável vazia vira exemplo ("Sua empresa",
"(00) 0000-0000", …); o objeto guarda `brandSample` para que "Preencher dados da empresa" ainda funcione depois que o
kit for preenchido (se o usuário não editou o texto). vitest 27 verdes, `assembleDebug testDebugUnitTest` verde,
conferido no moto (galeria de templates + template Promoção).

Pendências restantes: (1) BiRefNet fp16 / ISNet no moto (ARQUITETURA §21.5 item 1) — moto estava ligado por USB;
(2) cancelamento na ponte do editor (§20.8); (3) fase 8.

Frase de abertura:
> Leia HANDOFF_APP_OFFLINE.md §24 e ARQUITETURA.md §21.5 item 1. Meça BiRefNet-lite fp16 e ISNet-general-use no moto
> e escolha o removedor de qualidade.

## 25. Passagem de bastão (2026-10-16, sessão 19) — próxima sessão começa AQUI
Feito: **BiRefNet-lite fp16 × ISNet-general-use medidos no moto** (ARQUITETURA **§24**). fp16 morre no LMK como o fp32
(~5,0 GB); ISNet cabe (pico ~1 GB, ~5 s) mas não é claramente melhor que o u2netp (IoU 0,98–0,99 nas fotos de estúdio;
os dois falham na foto difícil). **Escolha pela regra da §21.5: BiRefNet sai do catálogo, ISNet não entra**; o removedor
fica `mlkit.subject → onnx.u2netp`. Amostras em `C:\projects\sandbox\product_photo_offline\docs\removedor_amostras\`.

Pendências: (1) tirar o `onnx.birefnet-lite` do app (lista de arquivos na ARQUITETURA §24.5, "Próxima task");
(2) cancelamento na ponte do editor (§20.8); (3) fase 8. Limpar `files/probe/*.onnx` no moto quando não precisar mais.
**Organização das pastas (resolvida na sessão 19):** o dono não achou as amostras porque o HANDOFF morava em
`product_photo_apk` e o resto em `product_photo_offline`. Decisão do dono: o que é do app fica nos docs do app. Este
HANDOFF foi **movido para `C:\projects\sandbox\product_photo_offline\HANDOFF_APP_OFFLINE.md`**; o `product_photo_apk`
fica só com a análise do APK (aviso no topo deste doc). Sugestão: abrir o VS Code em `product_photo_offline`.

Frase de abertura:
> Leia C:\projects\sandbox\product_photo_offline\HANDOFF_APP_OFFLINE.md §25 e ARQUITETURA.md §24.5 (mesma pasta).
> Tire o BiRefNet do app (a "Próxima task" da §24.5).

## 26. Passagem de bastão (2026-10-16, sessão 20) — próxima sessão começa AQUI
Feito: **BiRefNet fora do app** (ARQUITETURA **§25**): código, testes, entrada do catálogo, `RemoverMode.BIREFNET`,
textos da UI e o ramo `birefnet16` da `DeviceProbe`. Novidades: `FileProviderConfigStore.load` tira os
`AppGraph.RETIRED_PROVIDERS` das cadeias salvas (uma cadeia que ficar vazia por isso volta ao padrão) e
`LocalModelManager.pruneOrphans()` apaga diretórios de modelos que não estão no catálogo. Build e testes unitários verdes.
No moto: o órfão de 224 MB foi apagado e a tela Modelos de IA já não mostra o BiRefNet.

Falta: (1) **recorte Automático de ponta a ponta no moto**. O USB caiu antes de escolher a foto; o modo ficou em
Automático (antes estava u2netp; volte se quiser). (2) Cancelamento na ponte do editor (§20.8). (3) Fase 8. Limpar
`files/probe/*.onnx` no moto. (4) Apagar o `C:\projects\sandbox\product_photo_apk\HANDOFF_APP_OFFLINE.md`, que esta
sessão criou por engano (só tem uma cópia desta §26).

Frase de abertura:
> Leia C:\projects\sandbox\product_photo_offline\HANDOFF_APP_OFFLINE.md §26 e ARQUITETURA.md §25.4 (mesma pasta).
> Reconecte o moto e confirme o recorte Automático; depois, §20.8.

## 27. Passagem de bastão (2026-10-16, sessão 21) — próxima sessão começa AQUI
Feito: **cancelamento na ponte do editor** (ARQUITETURA **§26**). A mensagem `{v, id, type:"cancel"}` usa o id do
pedido e não tem resposta. O `EditorBridge` guarda o `Job` de cada pedido e o cancela; o JS rejeita na hora com
`cancelled`. O `#busy` do editor ganhou o botão "Cancelar" nas 7 ações de IA com progresso. JVM 8/8, vitest 29/29,
`npm run build` ok (o bundle em `editor/src/main/assets/editor` já foi regerado).

**No moto** (reconectado no meio da sessão; ARQUITETURA §26.4): o recorte Automático funcionou de ponta a ponta
(ML Kit, 1490 ms, caneca limpa). O Cancelar do upscale 4× liberou a tela na hora e a CPU parou; um 2× logo depois
completou. Os `files/probe/*.onnx` foram apagados. O modo do removedor continua em Automático.

Falta: (1) Apagar `C:\projects\sandbox\product_photo_apk\HANDOFF_APP_OFFLINE.md`: é uma cópia solta da §26, e o
classificador de permissões barrou a remoção nesta sessão. Apague à mão ou autorize.
(2) Fase 8 (geração de imagem no aparelho).

Frase de abertura:
> Leia C:\projects\sandbox\product_photo_offline\HANDOFF_APP_OFFLINE.md §27 e ARQUITETURA.md §26.4 (mesma pasta).
> Comece a análise da fase 8.

## 28. Passagem de bastão (2026-10-16, sessão 22) — próxima sessão começa AQUI
Feito: **análise de mesa da fase 8** (ARQUITETURA **§27**), sem código. Achados que mudam o rumo:
- O **ORT 1.31 que já está no app traz o EP WebGPU (Dawn/Vulkan) e o NNAPI** (`addWebGPU`, `addNnapi`). O moto tem
  Vulkan 1.3 (Mali) e drivers NNAPI do APU MediaTek (`mtk-mdla_shim`, `mtk-neuron_shim`). Talvez não precise de motor
  novo: MNN e stable-diffusion.cpp ficam como plano B.
- Modelo-base para a sonda: **LCM Dreamshaper v7** (MIT declarado, 4 passos sem CFG, só ops padrão), convertido para
  fp16 no PC. Para comparar o custo de um UNet pequeno: tiny-sd fp16.
- A troca da cadeia padrão **precisa de migração**: toda config já salva tem `IMAGE_GENERATOR: []` explícito (§27.1).
- O PC tem agora `onnx`/`onnxruntime` no Python (rodar com `python -P -E`).

Falta: (1) a **sonda no moto** (§27.5 tasks 1–5), que decide modelo/EP/passos/`MinRamMb`. (2) Decisões do dono antes da
implementação (fim da §27.5): critério de tempo/memória; migração de quem escolheu "Desligado"; geração que sobrevive a
sair da tela. (3) Continua: apagar `C:\projects\sandbox\product_photo_apk\HANDOFF_APP_OFFLINE.md` (cópia solta da §26).

Estado do moto: USB `ZY32LMNN9B` conectado; nada novo instalado nesta sessão.

Frase de abertura:
> Leia C:\projects\sandbox\product_photo_offline\HANDOFF_APP_OFFLINE.md §28 e ARQUITETURA.md §27 (mesma pasta).
> Faça a sonda da §27.5 (tasks 1–5) no moto e grave o resultado na §27.6.

## 29. Passagem de bastão (2026-10-16, sessão 23) — próxima sessão começa AQUI
Feito: só a **preparação da sonda** (ARQUITETURA **§27.6**). O dono pediu para parar antes dos downloads, então não há
código, nada foi baixado e nada mudou no moto. Ficou gravado:
- os commits completos e o sha256 de cada arquivo a baixar (LCM-DS7 do Hex e tiny-sd do danyalmalik; o tokenizer é o
  mesmo arquivo nos dois);
- o estado do moto: `MemAvailable` em 2,06 GB nesta sessão;
- nove ajustes ao plano, ainda não conferidos. Os que mais pesam: o `memory()` precisa do `MemAvailable`, porque a
  memória da GPU no Mali pode não aparecer em VmRSS; o LCM-DS7 fp16 não deve rodar em cpu/xnnpack (os pesos virariam
  fp32, ~3,4 GB); um `tools/sd_ref.py` deve gerar um 512² no PC, servindo de entrada real e de referência; as fórmulas do
  LCM têm duas versões no diffusers e precisam ser conferidas; e o fp16 convertido **não tem onde ser hospedado**, o que
  vira decisão do dono.

Falta: (1) a sonda (§27.5 tasks 1–5, começando pelo "Próximo passo exato" da §27.6). (2) As decisões do dono do fim da
§27.5, mais a hospedagem do fp16 (§27.6 ajuste 6). (3) Continua: apagar
`C:\projects\sandbox\product_photo_apk\HANDOFF_APP_OFFLINE.md` (cópia solta da §26).

Estado do moto: USB `ZY32LMNN9B` conectado; nada novo instalado.

Frase de abertura:
> Leia C:\projects\sandbox\product_photo_offline\HANDOFF_APP_OFFLINE.md §29 e ARQUITETURA.md §27 (inclusive a §27.6,
> mesma pasta). Faça a sonda da §27.5 (tasks 1–5) no moto, a partir do "Próximo passo exato" da §27.6, e grave o
> resultado no fim da §27.6.

## 30. Passagem de bastão (2026-10-17, sessão 24) — próxima sessão começa AQUI
Feito (ARQUITETURA **§27.7**): task 1 da sonda inteira no PC. Downloads conferidos por sha256; `tools/sd_fp16.py` e
`tools/sd_ref.py` novos; UNet/text encoder/VAE do LCM-DS7 em fp16 (UNet 1,72 GB num arquivo); um 512² de foto de produto
gerado no PC, com fp16 igual ao fp32 a olho e erro do `out_sample` máx 0,0026; fórmulas do LCM conferidas no diffusers
v0.30. `DeviceProbe#sdUnet`/`#sdDecode` escritos e compilando.
Depois o moto voltou e as **tasks 2–5 rodaram** (tabelas no fim da §27.7). Resumo:
- Só o **WebGPU** serve. NNAPI aceita 24 de 940 nós e morre no LMK; CPU morre no LMK; XNNPACK dá saída errada.
- LCM-DS7 fp16 no WebGPU: **9,4 s por passo**, erro pequeno contra o PC. **Pico de 5,2 GB** (memória da GPU, `RssFile`;
  nenhum ajuste de cache, layout, otimizador ou dados externos reduz).
- VAE 512²: **26 s e 4 GB** (em blocos de 256²: 1,35 GB, mesmo tempo); text encoder 0,5 s.
- Um 512² completo ≈ 65–80 s com pico de 5,2 GB. **Não passa no critério** da §27.4 item 5 (≤ 2 GB, ≤ 60 s).

Falta (decisões do dono, antes de qualquer código do provedor):
1. Qual caminho seguir (§27.7, "Task 5"): TAESD no lugar do VAE (precisa de torch no PC para exportar), UNet pequeno com
   LCM (sem ONNX licenciado; também precisa de torch), ou aceitar o LCM-DS7 só em aparelhos de 8–12 GB. Sem isso, a
   geração de imagem continua no servidor.
2. As de antes: critério da §27.4 item 5, migração de quem salvou "Desligado", geração que sobrevive a sair da tela,
   hospedagem do fp16 (§27.6 ajuste 6).
3. Ver a imagem gerada no moto (só 1 passo do UNet foi comparado); apagar a cópia solta
   `C:\projects\sandbox\product_photo_apk\HANDOFF_APP_OFFLINE.md`.

Estado do moto: app e teste reinstalados; `files/probe/` tem ~3,4 GB (UNets, text encoder, VAE, entradas). Apagar
quando a sonda não for mais usada: `adb -s ZY32LMNN9B shell run-as com.productphoto.offline rm -r files/probe`.
Os arquivos do PC ficam no scratchpad da sessão 24 (`…\f2729403-9e19-4890-b878-5197b09d7eb7\scratchpad\`).

Frase de abertura:
> Leia C:\projects\sandbox\product_photo_offline\HANDOFF_APP_OFFLINE.md §30 e ARQUITETURA.md §27.7 (mesma pasta). Com a
> decisão do dono sobre o caminho da fase 8, siga a partir dela.

## 31. Passagem de bastão (2026-10-18, sessão 24, 2ª parte) — próxima sessão começa AQUI
**Decisão do dono: a fase 8 fica por último.** Antes, as outras pendências (lista conferida na ARQUITETURA **§28**).
Feito:
- **A** (§21.4 item 2): falha nativa ao montar o motor ou a conversa do LiteRT-LM (backend/OpenCL, memória, lib ausente)
  vira `AiError.Unavailable` e a cadeia cai no próximo provedor. Antes, um `UnsatisfiedLinkError` escapava cru, e a falha
  na conversa saía como `InvalidOutput`.
- **B** (§21.4 item 3): cache do LiteRT-LM numa pasta por modelo (`cache/litertlm/<id>/`), apagada no "Remover" da tela
  Modelos. Antes, remover um modelo deixava o cache compilado dele.
- **E**: apagada a cópia solta `product_photo_apk\HANDOFF_APP_OFFLINE.md` (era rascunho da §26; nada exclusivo).
- Testes: `:ai:litertlm` 4/4 (2 novos), `:app:testDebugUnitTest`, `assembleDebug`, `assembleDebugAndroidTest` verdes.

Depois (mesma sessão, moto reconectado): **B conferido no moto** (3,0 GB soltos apagados; cache do Gemma na pasta
própria). **D em parte**: Brand kit, seletores de fonte e Templates ok. Dois defeitos achados e corrigidos no editor:
o rótulo "Contorno" duplicado (virou "Espessura") e o **texto curvo desenhado acima da própria caixa** (o arco era medido
pela caixa, não pelo texto; `src/curve.ts`, vitest 33/33). Detalhes e observações de UX na ARQUITETURA §28 "D".

Depois (2ª passada, 22:00–22:30): **curva corrigida vista no moto**; Imprimir e Compartilhar abrem as telas do sistema;
**defeito 3 corrigido e provado**: abrir o editor gravava um rascunho vazio "Sem nome" (e regravava rascunhos abertos)
4 s depois (`main.ts::start`, `untouched()`). Ficam 6 rascunhos de teste de hoje no moto (apagar com o OK do dono).
Atenção: o `scripts/ui.sh` do scratchpad confere o foco antes e depois de cada toque (memória `adb-input-focus-guard`).

Falta, com o dono:
1. ~~Ver a curva no moto~~ feito.
2. **C**: ver na tela que uma ação de IA de mesmo tamanho (remover fundo/objeto/texto) numa imagem **recortada** no editor
   mantém o recorte (corrigido no `imageGeometry`, §20.7, nunca visto).
3. **D**, o que sobrou: Filtros (precisa de imagem da galeria do dono) e curva para baixo. Recortar precisa do dedo
   (item C).
Depois: fase 8 (§30 e ARQUITETURA §27.7). Com o dono: amostras da fase 2; servidor real (§19.7).

Frase de abertura:
> Leia C:\projects\sandbox\product_photo_offline\HANDOFF_APP_OFFLINE.md §31 e ARQUITETURA.md §28 (mesma pasta). Com o
> moto no USB, instale (`:app:installDebug`), confira o B e faça C e D; a fase 8 fica por último.

## 32. Passagem de bastão (2026-10-18, sessão 24, fim) — próxima sessão começa AQUI
Feito nesta sessão (detalhes na ARQUITETURA **§27.7** e **§28**):
- Fase 8: sonda completa (só o WebGPU serve; o LCM-DS7 não passa no critério de memória). **O dono pôs a fase 8 por
  último.**
- Pendências: A (LiteRT-LM → `Unavailable`) e B (cache por modelo), as duas vistas no moto; cópia solta do HANDOFF
  apagada; **C conferido** (recorte mantido depois do "Remover fundo"); D percorrido (Brand kit, fontes, Templates,
  curva, Filtros, Imprimir, Compartilhar).
- Quatro defeitos do editor corrigidos: (1) texto curvo fora da caixa (`src/curve.ts`); (2) rótulo "Contorno"
  duplicado; (3) abrir o editor gravava um rascunho vazio "Sem nome"; (4) recorte preso ao tocar fora da imagem
  (`Editor.leaveCrop`). Os defeitos 1–3 foram vistos no moto; o 4 está instalado, mas a prova não rodou.
- Código sem commit (o projeto não é git): `ai/litertlm/.../LiteRtLmTextGenerator.kt` e `LiteRtLmTest.kt`,
  `app/.../AppGraph.kt`, `app/src/androidTest/.../DeviceProbe.kt` e `LiteRtLmProbe.kt`, `tools/sd_fp16.py`,
  `tools/sd_ref.py`, `tools/onnx_external.py`, `editor-web/src/{curve.ts,editor.ts,main.ts}`,
  `editor-web/test/curve.test.ts` e o bundle em `editor/src/main/assets/editor/`.

Próximas tasks, em ordem (o moto está com o app novo instalado):
1. **Prova do defeito 4**: Rascunhos → "Sem nome" de 22:54 (a foto do adaptador, posta pelo dono) → selecionar a
   imagem → Recortar → tocar fora → selecionar de novo → alças normais, e "Recortar" volta a abrir o modo.
2. **Produto que some no branco** (observação do dono, ARQUITETURA §28 fim): Filtros → Brilho 0. Se o produto voltar
   inteiro, era o brilho do teste. Depois, Fundo → cor escura: buracos no produto apontam para a máscara do ML Kit,
   e aí abrir o removedor (cadeia `mlkit.subject` → `onnx.u2netp`). Nos dois casos, propor ao dono xadrez ou
   contorno para recorte claro sobre página branca.
3. UX anotadas (decidir com o dono antes de mexer): Brand kit descarta as edições ao sair sem aviso; o seletor de fonte
   do kit não mostra prévia; "Qualidade JPG" aparece com PNG; nenhum preset de filtro aparece marcado; não há "zerar
   ajustes"; a curva não se refaz ao trocar fonte, tamanho ou texto.
4. Apagar os rascunhos de teste de 2026-10-18 **só com o OK do dono** (3 "Promoção", 3 "Sem nome"; o de 22:54 é a
   foto dele).
5. Depois: fase 8 (§30 e ARQUITETURA §27.7, decisão do dono sobre o caminho).

Regras desta sessão para a próxima:
- No celular do dono, conferir o app em foco antes e depois de **cada** toque (`…\scratchpad\scripts\ui.sh` faz isso;
  memória `adb-input-focus-guard`). Nunca capturar galeria, compartilhar, notificações nem outros apps.
- `uiautomator dump` no Git Bash precisa de `MSYS_NO_PATHCONV=1`. O USB do moto cai com frequência: confira o
  `adb devices` antes de cada lote.
- Os scripts de toque ficam no scratchpad da sessão 24
  (`C:\Users\luist\AppData\Local\Temp\claude\c--projects-sandbox-product-photo-apk\f2729403-9e19-4890-b878-5197b09d7eb7\scratchpad\scripts\`:
  `ui.sh`, `dump.sh`, `run.sh`, `push.sh`). Se a pasta sumir, refazer pelo padrão da §28.

Frase de abertura:
> Leia C:\projects\sandbox\product_photo_offline\HANDOFF_APP_OFFLINE.md §32 e ARQUITETURA.md §28 (mesma pasta). Com o
> moto no USB e o app na frente, faça as tasks 1–4 da §32, conferindo o foco a cada toque; a fase 8 fica por último.

## 33. Passagem de bastão (2026-10-19, sessão 25) — próxima sessão começa AQUI
Feito (detalhes na ARQUITETURA **§29**):
- Task 1 da §32: **defeito 4 provado no moto**.
- Task 3: as quatro UX que o dono escolheu (Brand kit avisa antes de descartar e mostra a prévia das fontes; "Qualidade
  JPG" só com JPG; Filtros com preset marcado e "Zerar ajustes"; a curva se refaz ao mudar fonte, tamanho, texto ou
  largura, e ao reabrir/desfazer/aplicar brand kit). Todas vistas no moto.
- **Defeito 5** (achado no teste): o rascunho automático tirava a seleção (e o modo de recorte) 4 s depois de cada
  mudança (`Editor.renderPage` → `discardActiveObject`). Corrigido e visto no moto.
- Task 4: o dono decidiu **não apagar** nenhum rascunho de teste.
- Testes: `tsc` limpo, vitest 33/33, bundle regerado, `:app:testDebugUnitTest`, `:app:installDebug` (moto) verdes.
- Código sem commit (não é git): `editor-web/src/{editor.ts,main.ts,styles.css}`, bundle em `editor/src/main/assets/editor/`,
  `app/.../BrandKitScreen.kt`, `AppGraph.kt` (`bundledFonts`, `BundledFont`), `MainActivity.kt`.

Pendente:
1. **Task 2 da §32** (produto claro que some na página branca): a foto do adaptador não está mais nos rascunhos. Precisa
   do dono pôr uma foto de produto claro no editor (galeria) para rodar o teste da §28 (Brilho 0; depois fundo escuro).
2. Depois: fase 8 (§30 e ARQUITETURA §27.7, decisão do dono sobre o caminho).

Regras: o moto pode estar no adb **sem fio** (`adb devices` mostra `IP:porta`; o serial continua `ZY32LMNN9B`); os
scripts desta sessão estão em
`C:\Users\luist\AppData\Local\Temp\claude\c--projects-sandbox-product-photo-apk\8f6b22a4-0398-45fb-908f-a10b517ad635\scratchpad\scripts\`
(`ui.sh` confere o foco antes e depois de cada toque; ajuste o `-s` se o endereço mudar).

Frase de abertura:
> Leia C:\projects\sandbox\product_photo_offline\HANDOFF_APP_OFFLINE.md §33 e ARQUITETURA.md §29 (mesma pasta). Com o
> moto conectado e uma foto de produto claro posta no editor, faça a pendência 1; a fase 8 fica por último.

## 34. Passagem de bastão (2026-10-19, sessão 25, fim) — próxima sessão começa AQUI
Pedido novo do dono: **renomear rascunho** (trocar "Sem nome" por um nome e salvar). Hoje não existe. Análise
pronta na ARQUITETURA **§30**, com os símbolos abertos e duas tasks: (1) tocar no título do editor para renomear e salvar;
(2) "Renomear" na lista de Rascunhos (`DraftRepository.rename` + teste JVM). O resto da §33 continua valendo (pendência
do produto claro na página branca, que precisa de foto do dono; fase 8 por último).

Frase de abertura:
> Leia C:\projects\sandbox\product_photo_offline\HANDOFF_APP_OFFLINE.md §34 e ARQUITETURA.md §30 (mesma pasta).
> Implemente as tasks 1 e 2 da §30 (renomear rascunho), com os testes indicados; depois confira no moto, checando o
> foco a cada toque.

## 35. Passagem de bastão (2026-10-19, sessão 25, pendências sem o dono) — depois da §30
Pedido do dono: fazer as pendências que não dependem dele. Análise e plano na ARQUITETURA **§31**, quatro tasks:
(1) testar o "Remover" da tela Modelos com o Qwen e baixá-lo de novo; (2) "espaço usado" na tela Modelos
(`ModelManager.diskBytes` + cache do LiteRT-LM); (3) sliders alinhados nos Filtros; (4) "Resolução" escondida no SVG.
**Começar depois da sessão 26** (renomear, §30), que mexe nos mesmos `main.ts`/`styles.css`.
Ficam com o dono: produto claro na página branca (§33), fase 8, amostras da fase 2, pinça, servidor real, mockup curvo.

Frase de abertura:
> Leia C:\projects\sandbox\product_photo_offline\HANDOFF_APP_OFFLINE.md §35 e ARQUITETURA.md §31 (mesma pasta).
> Confirme que a §30 (renomear) está fechada; então faça as tasks 1–4 da §31 com os testes indicados, conferindo o foco
> no moto a cada toque.

## 36. Sessão 26 (2026-10-19): renomear rascunho — §30 FECHADA
Feito e visto no moto (detalhes na ARQUITETURA **§30**, "Feito" e "Visto no moto"): tocar no título do editor renomeia
e salva; "Renomear" na lista de Rascunhos (`DraftRepository.rename`, limite 60); a exportação usa o nome novo.
Testes: `tsc` limpo, vitest 33/33, bundle regerado, `FileDraftRepositoryTest` 5/5 (2 novos), `:app:testDebugUnitTest`,
`:app:assembleDebug`, `:app:installDebug` (moto) verdes. Código sem commit (não é git): `editor-web/src/{main.ts,styles.css}`,
bundle em `editor/src/main/assets/editor/`, `data/.../Drafts.kt`, `data/src/test/.../FileDraftRepositoryTest.kt`,
`app/.../HomeScreen.kt`.
Ficaram no moto (apagar só com OK do dono): rascunho "Teste lista 26" e `Pictures/ProductPhoto/Teste_lista_26_20261019_172442.png`.
Achado fora do escopo: toast longo transborda o balão (§30, último item).
Regra nova de teste: com o dono também no celular, conferir a **tela** (dump), não só o foco, antes de cada toque.
A próxima sessão segue a **§35** (a §30 está fechada); a frase de abertura da §35 continua valendo.

## 37. Passagem de bastão (2026-10-19, sessão 27) — próxima sessão começa AQUI
Feito: §30 (renomear) conferida no moto e fechada; §31 tasks 1–4 feitas, testadas e vistas no moto (detalhes na
ARQUITETURA **§31, "Feito (sessão 27)"**). Código sem commit (não é git): `editor-web/src/{main.ts,styles.css}` + bundle,
`core/models/.../ModelManager.kt` + `LocalModelManagerTest.kt`, `app/.../AppGraph.kt`, `app/.../ModelsScreen.kt`.
Aviso de moto: a sessão 26 (§36) testava no moto ao mesmo tempo que esta; um toque meu abriu o "Evento" do dono (sem
gravar), provavelmente porque os toques das duas se cruzaram. Uma sessão por vez no aparelho. Também corrigido e visto no moto: o toast longo que transbordava (achado da §30;
ARQUITETURA §31, "Sessão 27, extra"). Pendências restantes são todas do dono: produto claro na página branca (§33),
fase 8, amostras da fase 2, pinça, servidor real, mockup curvo; o rascunho de teste "Teste lista 26" pode ser apagado
se o dono quiser.

## 38. Sessão 28 (2026-10-20): Migração e Sincronização do Acervo Legado para o Hugging Face
Pedido do dono: baixar todos os mockups, templates de design e assets das aplicações legadas (AI Product Photo / com.videorey.ailogomaker) e subir no repositório de dataset do Hugging Face.

### Acervo Sincronizado (480 arquivos no Hugging Face)
* **Repositório Hugging Face**: [https://huggingface.co/datasets/luisluis123/mockups](https://huggingface.co/datasets/luisluis123/mockups/tree/main)
* **1. Mockups Comerciais (mockups/)**: 52 modelos WebP com mapeamento de homografia de 4 cantos (quad), dimensões e aspect ratio estruturados em index.json.
* **2. Estilos de Photoshoot & Cenários (styles/)**: 37 presets visuais (36 WebP + styles.json) para composição de fotos de produto (gelo, mármore, néon, estúdio, pódios, praia, etc.).
* **3. Templates de Design Editáveis (templates/)**: 122 templates completos de canvas (Fabric.js):
  * 49 templates de Produto (product)
  * 42 templates de Pôsteres (poster)
  * 31 templates de Rótulos & Embalagens (label)
  * templates/hd/*.webp: 122 previews em alta resolução
  * templates/img/*.webp: 122 miniaturas
  * templates/json/*.json: 122 estruturas JSON de edição de canvas (camadas, textos, fontes, formas)
  * templates/catalog.json: índice consolidado pronto para consumo remoto
* **4. Catálogos de Presets & Elementos Gráficos (presets/)**:
  * presets/icons.json: 560 ícones vetoriais SVG categorizados
  * presets/stickers.json: pacotes de formas geométricas e vetores
  * presets/logostyles.json, iconstyles.json, letterstyles.json, wordstyles.json: presets de IA, estilos 2D/3D e prompts de geração
  * presets/prompts.json e artprompts.json: banco de prompts multilíngue
  * presets/fonts.json e fonts/: tipografias em .ttf com imagens de amostra
* **Consumo no app**: Os endpoints oficiais apontam para as URLs diretas Git LFS (/resolve/main/), realizando o download e cache offline no aparelho (context.filesDir/content/) no primeiro uso.

## 39. Sessão 29 (2026-10-21): Integração do Provedor iawrapper (Vast.ai GPU Serverless) no App Android
Pedido do dono: dar continuidade na funcionalidade de geração de imagem remota agora que temos o backend `iawrapper` configurado com Vast.ai.

### Feito e testado:
1. **Cliente HTTP do iawrapper (`IawrapperBackend.kt` e `IawrapperImageFactory.kt`)**:
   - Criado backend implementando `ImageBackend` no pacote `com.productphoto.ai.remotehttp.image`.
   - Suporte híbrido e automático de autenticação: credencial `email:senha` (executa login em `POST /api/auth/login/` com cache em memória do token JWT `access`) ou token Bearer JWT direto.
   - Despacho de tarefas assíncronas em `POST /api/tasks/` com o payload da feature (`feature_slug`, `prompt`, `negative_prompt`, `width`, `height`, `steps`, `seed`).
   - Polling de status com notificação de progresso na interface (`pending` / `running` → `success` / `failed`).
   - Cancelamento limpo via coroutine: se o usuário cancela no app, dispara `POST /api/tasks/{id}/cancel/` para liberar a GPU no cluster serverless Vast.ai e não gastar créditos.
   - Download da imagem gerada por URL absoluta pública (Cloudflare R2 ou Cloudinary CDN), com isolamento de headers para não vazar token JWT para CDNs externos.
2. **Integração na UI e DI (`ImageGenScreen.kt` e `AppGraph.kt`)**:
   - `ImageServer.IAWRAPPER` adicionado como primeira opção no seletor de provedor ("iawrapper (Vast.ai / Nuvem)").
   - Campos configuráveis de endereço (`baseUrl`, padrão `http://10.0.2.2:8000` para emulador ou IP local/produção), credencial segura (salva em `IMAGE_IAWRAPPER_SECRET` no keystore/keystore AEAD) e `featureSlug` (padrão `product-photo-vast`).
   - Tratamento detalhado de erros HTTP (401 credencial inválida, 402 créditos insuficientes, falhas no cluster Vast.ai).
   - Registrado no `ProviderRegistry` do `AppGraph`.
3. **Testes Unitários**:
   - `IawrapperBackendTest`: 5 testes cobrindo login e obtenção de JWT, token direto, polling com progresso, falhas na task e cancelamento remoto.
   - `ImageFactoriesTest`: validação de schema, requisitos, indisponibilidade e `supports = setOf(ImageFeature.TXT2IMG)`.
   - `ImageGenConfigTest`: roundtrip de configuração, persistência segura e mensagens de erro.
   - Suíte completa `:ai:remote-http:testDebugUnitTest`, `:app:testDebugUnitTest` e montagem do APK `:app:assembleDebug` 100% verdes.
4. **Teste End-to-End Real no Celular Motorola Físico (`ZY32LMNN9B`)**:
   - Configurado `adb reverse tcp:8000 tcp:8000`.
   - Executado teste instrumentado `IawrapperEndToEndInstrumentedTest#generateProductPhotoRemotelyViaIawrapper` diretamente no Motorola.
   - O aparelho executou login JWT no `iawrapper`, submeteu task da feature `product-photo-vast` para GPU cluster Vast.ai (instância RTX 5090), recebeu a URL, realizou o download da imagem final e decodificou para `Bitmap` nativo em 7,8s (`OK (1 test)`).
   - Imagem de teste (perfume de luxo com tampa dourada) inspecionada e validada.
   - Proteção de custos ativa: endpoint Vast.ai escalado de volta para `min_load = 0` (saldo preservado em $8.25).

## 40. Sessão 30 (2026-10-21): Otimizações de Latência Ponta a Ponta na Geração Remota (iawrapper + Vast.ai)
Pedido do dono: aplicar todas as otimizações para reduzir o tempo total de geração (que no teste inicial levava ~7,87s).

### Diagnóstico de Gargalos (Telemetria Real):
- **Tempo de GPU na RTX 5090:** Apenas **1,299s** (para 20 passos de inferência).
- **Overhead Desnecessário identificado (~6,5s):**
  1. Consulta síncrona `https://run.vast.ai/route/`: **~2,07s** a cada requisição.
  2. Upload síncrono para o Cloudinary CDN no backend: **~1,34s**.
  3. Download HTTP da imagem na CDN pelo celular: **~1,15s**.
  4. Hashing de senha e roundtrip de login JWT inicial: **~1,75s**.
  5. Passos excessivos na GPU para modelos rápidos (20 steps vs 8 steps): **~0,60s**.

### Otimizações Implementadas:
1. **Worker Route Cache no backend `iawrapper` (`vast_serverless_provider.py`)**:
   - Cache em memória de rotas ativas de workers por endpoint com TTL de 180s.
   - Failover automático: se o worker em cache falhar por erro de conexão ou timeout, invalida o cache na hora e consulta uma nova rota fresca sem quebrar a requisição.
   - **Ganho:** Elimina a chamada síncrona ao Vast `/route/` (**-2,07s** em chamadas aquecidas).
2. **Zero-Hop Base64 + Upload Assíncrono para Cloudinary**:
   - `vast_serverless_provider.py`: O worker do Vast já retorna `data` (Base64). O backend agora expõe `b64_data` diretamente no JSON do output (`outputs[0]['b64_data']`).
   - O upload de persistência para o Cloudinary foi movido para uma thread em segundo plano (`threading.Thread`) com retry loop para atualizar o `TaskOutput.objects.filter(...)` no banco após persistência, sem bloquear a resposta HTTP.
   - `core/task_views.py`: Exposição direta de `b64_data` em `_task_detail`.
   - `IawrapperBackend.kt` (Android): Ao receber o output, se `b64_data` estiver presente, decodifica imediatamente em memória via `java.util.Base64.getDecoder().decode(...)` em **45ms**, eliminando o download HTTP da CDN.
   - **Ganho:** Economia de **~2,44s** (1,34s de upload síncrono + 1,10s de download móvel).
3. **Modo Síncrono Inline (`sync=true`) no `POST /api/tasks/`**:
   - Quando `sync=true` é enviado pelo app Android, o backend executa `_run_inline(task)` e responde `201 Created` já com `status='success'` e o Base64 da imagem no mesmo roundtrip HTTP, eliminando ciclos de polling.
   - Polling de fallback no app otimizado de 1.500ms para 250ms com backoff.
4. **Fast Inference Mode (8 Steps na RTX 5090)**:
   - Default de `steps` reduzido de 20 para 8 em `IawrapperOptions` e `IawrapperImageFactory.kt`.
   - Tempo de GPU caiu para **0,50s - 0,80s** mantendo excelente qualidade fotográfica.
5. **Configuração de `ALLOWED_HOSTS`**:
   - Adicionado `10.0.2.2` e `testserver` em `ALLOWED_HOSTS` do `settings.py` para compatibilidade nativa com emuladores Android e testes de rede.

### Validação e Resultados:
- **Testes Unitários:** Novos testes em `IawrapperBackendTest` validando retorno imediato Zero-Hop Base64 sem polling nem download externo. Suíte `:ai:remote-http` e `:app` 100% verde.
- **Teste Instrumentado Android (`IawrapperEndToEndInstrumentedTest`):**
  - Tempo total de ponta a ponta caiu de **7,876s** para **5,557s** (incluindo overhead de rede transcontinental até a GPU).
  - Tempo no backend quente caiu para **4,30s**.
  - Decodificação em memória no Android: **45ms**!
  - Imagem gerada: [`e2e_optimized_perfume.png`](file:///C:/Users/luist/.gemini/antigravity-ide/brain/b7874fdb-048f-4b5b-8b3d-21fa15713948/e2e_optimized_perfume.png) (frasco de perfume de luxo com tampa dourada, 512×512, 433 KB).
- **Proteção de Custo:** Endpoint Vast.ai reescalado para `min_load = 0` e instância pausada (saldo preservado em **$7.99**).

## 41. Sessão 31 (2026-10-21): Implementação de ADS-01 (Harmonização & Relighting) e ADS-02 (Expansão Multiformato / Outpainting)
Pedido do dono: Implementar os itens 1 e 2 do backlog de criação de anúncios (`docs/backlog/README.md`).

### Feito e testado:
1. **Contratos e Modelos em `:core:ai-api` (`AdCreative.kt`)**:
   - `LightDirection`: 5 modos de direção de iluminação (`AMBIENT`, `LEFT`, `RIGHT`, `TOP`, `BACKLIGHT`) com seus prompts técnicos descritivos para relighting.
   - `RelightRequest` e capability `ProductRelighter`.
   - `AdAspectRatio`: 4 proporções chave para anúncios (`RATIO_1_1` Feed, `RATIO_9_16` Stories/Reels/TikTok, `RATIO_16_9` Banners/YouTube, `RATIO_4_5` Feed Vertical) com plataforma alvo.
   - `OutpaintPreparation`, `OutpaintRequest` e capability `AdFormatExpander`.
2. **Matemática e Processamento de Imagem em `:core:imaging`**:
   - `OutpaintBuilder`: calcula geometria exata da expansão com arredondamento para múltiplo de 8 (`snapTo8`), centraliza a arte original no miolo protegido (*Safe Zone*), espelha e estende suavemente as bordas e gera a máscara de inpainting com transição/feathering suave de 16 px. Suporta `Raster` puro para testes rápidos sem depender de Bitmap.
   - `LocalRelighter`: harmonizador e relighter determinístico offline. Aplica iluminação direcional (rim light, key light e ambient balance) e equalização de luminância de acordo com a direção escolhida.
   - `LocalAdFormatExpander`: expansor de formatos local que utiliza `OutpaintBuilder` e delega ao `Inpainter` local ou gera espelhamento suavizado caso offline.
   - Testes unitários dedicados em `AdCreativeImagingTest.kt` validando expansões 9:16 e 16:9, safe zone, feathering de máscara e realces direcionais de iluminação.
3. **Pipeline Remoto em `:ai:remote-http` e `:app`**:
   - `IawrapperBackend`: refatorado com `dispatchAndAwait(...)`, adicionando suporte para envio de `init_image` (Base64), `mask_image` (Base64), `strength` e `light_direction`, além dos métodos `relight(...)` e `outpaint(...)`.
   - `IawrapperImageFactory`: atualizado para declarar suporte a `TXT2IMG`, `IMG2IMG` e `INPAINT`.
   - `IawrapperRelighter` e `IawrapperAdFormatExpander` (`com.productphoto.app.ad`): wrappers que despacham as tarefas remotas para o cluster GPU iawrapper, com fallback automático e transparente para os engines locais (`LocalRelighter` e `LocalAdFormatExpander`) caso a rede falhe ou o aparelho esteja offline.
   - `AppGraph` e `AppProductDeps`: instanciados e conectados via injeção de dependências no fluxo de produto.
4. **Interface Visual e Experiência do Usuário (`ProductFlowScreen.kt` e `ProductFlowViewModel.kt`)**:
   - `ProductFlowViewModel`: adicionadas as ações `setLightDirection(...)`, `setSelectedRatio(...)`, `applyRelighting()` e `applyAdOutpaint()`, com medição de tempo (`relightingMillis`, `outpaintMillis`) e feedback de progresso no banner de mensagem.
   - `ResultStep`: redesign completo com dois novos cards dedicados:
     - Card de **Harmonização & Relighting IA** com chips seletores de direção de luz e botão de execução.
     - Card de **Formato do Anúncio (Expansão)** com chips seletores das proporções de anúncio (1:1, 9:16, 16:9, 4:5), indicação da rede social de destino e botão de expansão com outpainting.
5. **Backend `iawrapper` (`d:\projects\iawrapper`)**:
   - Atualizado `vast_serverless_provider.py` para repassar `init_image`, `mask_image`, `strength` e `light_direction` para as modificações do worker da GPU.
   - Atualizado comando Django `seed_vast_features.py` registrando as features oficiais `product-relight` e `product-outpaint` no banco de dados. Executado `python manage.py seed_vast_features` com sucesso.
6. **Validação**:
   - Suíte completa de testes unitários (`./gradlew testDebugUnitTest`) 100% verde em todos os módulos.
   - Compilação do APK (`./gradlew assembleDebug`) 100% verde sem erros.

## 42. Sessão 32 (2026-10-21): Teste End-to-End no Celular Físico Motorola (ADS-01 e ADS-02)
Pedido do dono: Realizar teste end-to-end completo no celular Motorola conectado dos recursos ADS-01 e ADS-02.

### Executado e validado no aparelho físico (`ZY32LMNN9B`, Motorola moto g86 5G - Android 16):
1. **Instrumentação E2E Criada (`IawrapperEndToEndInstrumentedTest.kt`)**:
   - Adicionado método `testRelightingAds01OnDevice()`:
     - Cria imagem teste de produto (512×512);
     - Aciona `graph.relighter.relight(...)` com `LightDirection.LEFT` e `strength = 0.65f`;
     - Executa equalização de luminância e rim light direcional à esquerda com falloff gradual;
     - Salva e valida arquivo no cache interno do app (`cache/e2e_ads01_relighted_left.png`).
   - Adicionado método `testOutpaintingAds02OnDevice()`:
     - Cria arte de anúncio quadrada 1:1 (512×512);
     - Aciona `graph.adFormatExpander.expand(...)` para formato **9:16** (Stories/Reels/TikTok) com feathering de 16px;
     - Executa cálculo de geometria com `snapTo8` (512×912 px), centralização com *Safe Zone* protegida e máscara de inpainting;
     - Salva e valida arquivo no cache interno do app (`cache/e2e_ads02_outpainted_9_16.png`).
2. **Compilação e Instalação**:
   - Compilação do APK principal e do APK de testes instrumentados (`./gradlew :app:assembleAndroidTest :app:assembleDebug`).
   - Instalação via ADB no Motorola:
     - `adb -s ZY32LMNN9B install -r app/build/outputs/apk/debug/app-debug.apk` -> **Success**
     - `adb -s ZY32LMNN9B install -r app/build/outputs/apk/androidTest/debug/app-debug-androidTest.apk` -> **Success**
3. **Execução no Aparelho Real**:
   - **ADS-01**: `adb shell am instrument ... #testRelightingAds01OnDevice`
     - Resultado: **`OK (1 test)`** em **2,351s** (`INSTRUMENTATION_CODE: -1`).
   - **ADS-02**: `adb shell am instrument ... #testOutpaintingAds02OnDevice`
     - Resultado: **`OK (1 test)`** em **4,815s** (`INSTRUMENTATION_CODE: -1`).
4. **Artefatos e Evidências Extraídas**:
   - Imagens recuperadas do cache privado do app via `adb exec-out run-as com.productphoto.offline`:
     - [`e2e_motorola_ads01.png`](file:///C:/projects/sandbox/product_photo_offline/e2e_motorola_ads01.png) (512×512, 8.874 bytes): iluminação harmonizada com key light direcional à esquerda.
     - [`e2e_motorola_ads02.png`](file:///C:/projects/sandbox/product_photo_offline/e2e_motorola_ads02.png) (512×912, 117.363 bytes): expansão vertical 9:16 com arte do produto no centro seguro.

## 43. Sessão 33 (2026-10-21): Implementação e Validação de ADS-04 (Badges e Selos de Conversão no Canvas)
Pedido do dono: Implementar o ADS-04 do `backlog.md` (biblioteca de selos de garantia, frete, prova social e urgência editáveis e integrados ao Brand Kit).

### Feito e testado:
1. **Catálogo de Selos Vetoriais SVG (`tools/gen_content.py` e `app/src/main/assets/content/`)**:
   - Criados 15 novos selos vetoriais SVG de alta conversão estruturados em 4 categorias oficiais:
     - **Garantia & Confiança**: *"Garantia 30 Dias"*, *"Satisfação Garantida"*, *"Garantia 7 Dias"*, *"Compra 100% Segura"*;
     - **Frete & Entrega**: *"Frete Grátis Brasil"*, *"Envio Imediato 24h"*, *"Pronta Entrega"*;
     - **Avaliação Social**: *"5 Estrelas / Nota 4.9 (+1.200 avaliações)"*, *"#1 Mais Vendido"*, *"100% Original"*;
     - **Promoção & Urgência**: *"50% OFF Hoje"*, *"Compre 1 Leve 2"*, *"Últimas Unidades"*, *"Oferta Relâmpago"*, *"10% OFF no Pix"*.
   - Executado gerador de assets atualizando `index.json` e gerando os SVGs na pasta `stickers/`.
2. **Editor Fabric.js Web (`editor-web/`)**:
   - `editor.ts`: Aprimorado método `set(props)` para aplicar recursivamente cores (`fill`, `stroke`) e papéis de marca (`brandColor`, `brandStroke`) aos nós internos de grupos SVG (`Group`), preservando elementos de contraste e texto branco.
   - `main.ts`:
     - Adicionada aba dedicada **"🏷️ Selos"** na barra de navegação com filtros por chips (`Todas`, `Garantia & Confiança`, `Frete & Entrega`, `Avaliação Social`, `Promoção & Urgência`);
     - Inserção direta de selos no canvas com centralização e escala automática;
     - Painel de propriedades (`renderProps`) atualizado com o componente `brandColorChips` para harmonização instantânea com as cores do Brand Kit (`Primária`, `Secundária`, `Destaque`, `Texto`);
     - Exposição global de `window.content`, `window.editor` e `window.contentUrl` para garantir acesso nos testes e DevTools.
   - `content.ts`: Adicionado `AbortSignal.timeout(1500)` para resiliência 100% offline contra travamento de rede no WebView.
   - `brandkit.test.ts`: 9 testes unitários incluindo teste de recolorização de badges agrupados com papéis de marca.
   - `npm test`: **42 testes verdes em 10 arquivos**.
   - `npm run build`: Assets compilados e sincronizados para `editor/src/main/assets/editor/`.
3. **Módulo Android e UI (`:feature:product` e `:app`)**:
   - `ProductFlowScreen.kt`: Botão do `ResultStep` aprimorado para `"🏷️ Criar Anúncio / Inserir Selos no Editor"`.
   - `./gradlew testDebugUnitTest`: Suíte unitária completa **100% verde** em todos os módulos.
   - `./gradlew assembleDebug` e `assembleAndroidTest`: APKs compilados com sucesso.
4. **Validação Instrumentada no Celular Físico Motorola (`ZY32LMNN9B`)**:
   - Adicionado teste instrumentado `conversionBadgesLibraryAndRecoloringOnDevice` em `EditorExportInstrumentedTest.kt`.
   - Execução via ADB no aparelho físico:
     - Verificação do carregamento dos selos e das 4 categorias de conversão;
     - Inserção do selo `selo-garantia-30` no canvas;
     - Confirmação de objeto do tipo `group`;
     - Recolorização dinâmica com `#2563EB` via papel `primary` do Brand Kit;
     - Exportação e decodificação do bitmap PNG.
     - **Resultado:** `OK (1 test)` em **1,38s** (`INSTRUMENTATION_CODE: -1`).

## 44. Sessão 34 (2026-10-21): Apontamento para o Servidor Remoto Railway (`iawrapper`)
Pedido do dono: Mudar o servidor do `iawrapper` para a instância remota no Railway.

### Feito e testado:
1. **Identificação e Validação da Instância Railway**:
   - Host remoto ativo: `https://iawrappernew-production.up.railway.app`
   - Autenticação e credenciais validadas com sucesso (JWT Bearer Token via `/api/auth/login/`).
2. **Sincronização do Backend e Banco Remoto**:
   - Criados no PostgreSQL do Railway via API de administração:
     - `AIProvider`: `vast_ai_serverless` (Vast.ai Serverless GPU)
     - `AIModelBinding`: `vast_comfy_product_photo` (Vast.ai ComfyUI Product Photo Studio)
     - `Features`: `product-photo-vast` (Foto de Produto GPU), `product-relight` (ADS-01) e `product-outpaint` (ADS-02).
   - Enviadas as melhorias locais do backend (`ia_wrapper`) para o GitHub (`main -> origin/main` em `iawrappernew`):
     - Zero-Hop Base64, worker route cache, inline execution para `sync=true` e suporte a relight/outpaint.
3. **Atualização no App Android (`product_photo_offline`)**:
   - `AppGraph.kt`: `baseUrl` padrão de `relighter` e `adFormatExpander` atualizado de `http://10.0.2.2:8000` para `https://iawrappernew-production.up.railway.app`.
   - `ImageFactories.kt`: `IawrapperImageFactory.BASE_URL` padrão e exemplo atualizados para `https://iawrappernew-production.up.railway.app`.
   - `ImageGenScreen.kt`: Placeholder do servidor `ImageServer.IAWRAPPER` atualizado para `https://iawrappernew-production.up.railway.app`.
   - `IawrapperEndToEndInstrumentedTest.kt`: Adicionada URL do Railway como primeira opção prioritária na resolução dinâmica de servidor.
4. **Validação**:
   - `./gradlew testDebugUnitTest`: Suíte unitária 100% verde em todos os módulos.
   - `./gradlew assembleDebug`: Compilação do APK concluída com sucesso em 18s.




## 44. Sessão 34 (2026-10-22): Tela "Gerar imagem" para o usuário leigo (sem configuração técnica)
Pedido do dono: o usuário final é leigo; tirar da tela tudo o que é técnico (tipo de servidor, endereço, slug da
feature, credencial, quantidade). Decisões do dono nesta sessão:
- **Só nuvem, sem seletor.** Não há gerador no aparelho (fase 8); A1111/ComfyUI são servidores de rede, que um leigo
  não tem. As factories `http.a1111`/`http.comfyui` continuam registradas no código, mas saem da tela. O seletor
  "No aparelho / Na nuvem" volta quando a fase 8 existir.
- **Credencial vem do build:** `iawrapper.credential` (email:senha ou JWT) em `local.properties` (fora do git), ou
  gradle property / env `IAWRAPPER_CREDENTIAL`, injetada em `BuildConfig`. Risco aceito: dá para extrair do APK, então
  use uma conta de serviço com limite de créditos. O caminho mais seguro (token por instalação emitido pelo iawrapper)
  fica para depois: backlog **SEC-01** (`docs/backlog/README.md`, Épico 10).
- Saem também: o card Referência/ControlNet, o checkbox de tradução (que passa a ser sempre ligada) e o botão Salvar.
  A quantidade fica fixa em 1, e os formatos mantêm os pixels no rótulo.

### Análise (símbolos abertos)
- `ImageGenScreen.kt::ImageGenScreen`: o seletor `ImageServer` + os campos baseUrl/featureSlug/checkpoint/secret
  alimentam `save()` → `graph.saveImageChain(imageChainOf(...))`; `generate()` chama `save()` antes de cada geração.
- `ImageFactories.kt::IawrapperImageFactory.create`: lê `baseUrl` (sem ele lança `AiError.Unavailable(emptyList())`),
  `featureSlug`, e a credencial via `SecretStore.get(settings[authSecret])`. `requirements` exige `Requirement.Secret`
  se `authSecret` estiver presente, e o `checker` do `AppGraph` usa `secrets.get(key) != null`.
- `IawrapperImageFactory.supports()` = TXT2IMG/IMG2IMG/INPAINT, **sem CONTROL_\***: o card de ControlNet só dava erro
  com o iawrapper.
- `AppGraph::relighter`/`adFormatExpander`: leem `secrets.get(IMAGE_IAWRAPPER_SECRET)` + o baseUrl da cadeia de imagem,
  com fallback literal para a URL de produção.
- `ImageServer`/`imageGenStateOf`/`imageChainOf`/`secretNameFor` têm só estes usos: a própria tela,
  `ImageGenConfigTest` e `IawrapperEndToEndInstrumentedTest` (`grep` em todo o repositório).
- O app não tinha `BuildConfig` (AGP 8.7.3: `buildFeatures.buildConfig` vem desligado por padrão).

### O que fazer
1. `app/build.gradle.kts`: `buildConfig = true`; campos `IAWRAPPER_URL`, `IAWRAPPER_FEATURE`, `IAWRAPPER_CREDENTIAL`
   (local.properties → gradle property → env → padrão).
2. `AppGraph`: `secrets` embrulhado em `BuiltInSecretStore`, que serve `image.iawrapper` = credencial do build quando
   não vazia (os pedidos de imagem, relight e outpaint passam todos por ela); o fallback de URL vira
   `BuildConfig.IAWRAPPER_URL`.
3. `ImageGenScreen.kt`: remover ImageServer/ImageGenSettings/imageGenStateOf/imageChainOf/secretNamefor e as constantes
   A1111/Comfy; criar `cloudImageChain(...)` (fixa) e gravá-la só se for diferente da salva (não invalidar a cadeia a
   cada geração, o que perderia o JWT em cache); `describeImageError(e)` com mensagens para leigo; UI só com
   pedido, evitar, formato, Gerar/Cancelar, progresso e resultados.
4. Testes: `ImageGenConfigTest` (a cadeia fixa, as mensagens e `BuiltInSecretStore`) e o E2E passando a usar
   `cloudImageChain(baseUrl)`.

### Feito e testado
- Tasks 1–4 implementadas como descrito acima. Na tela ficaram: o pedido, "Evitar", o formato, Gerar/Cancelar, o
  progresso (texto neutro "Criando a imagem" + fração; as etapas do servidor não aparecem mais) e os resultados com
  "Ampliar 2×". O nome do provedor saiu das mensagens de status.
- `./gradlew :app:testDebugUnitTest :app:compileDebugAndroidTestKotlin` → verde (`ImageGenConfigTest` 4/4; `:app` 9/9).
- **Não testado no aparelho.** O `BuildConfig.IAWRAPPER_CREDENTIAL` gerado está **vazio**, porque o `local.properties`
  ainda não tem `iawrapper.credential`: sem ela o pedido vai sem autenticação e o usuário vê "recusou o acesso".

### Próximo passo
1. Dono: criar uma conta de serviço no iawrapper com limite de créditos e pôr `iawrapper.credential=email:senha` no
   `local.properties`.
2. `./gradlew :app:assembleDebug`, instalar no moto (`ZY32LMNN9B`) e gerar uma imagem pela tela. Rodar também
   `IawrapperEndToEndInstrumentedTest#generateProductPhotoRemotelyViaIawrapper`.
- (2026-10-22) O card "Gerar imagem" da home (`HomeScreen.kt`) também foi trocado: dizia "servidor Stable Diffusion seu
  (A1111 ou ComfyUI)". APK instalado no moto por **adb Wi-Fi**, e a tela nova foi conferida por print. O USB não
  enumera (o Windows marca o "moto g86 5G" como `Present=False`). Pareamento Wi-Fi: a porta de pareamento vem de
  `adb mdns services` (`_adb-tls-pairing`), e não é a porta mostrada na tela de Depuração por Wi-Fi, que é a de conexão.
  A geração em si **não foi testada**: a credencial no build continua vazia.
- (2026-10-22) Credencial de teste (`admin@test.com`, conta **admin**: só para o APK de desenvolvimento) colocada no
  `local.properties` e APK reinstalado. O 401 sumiu. A geração pela tela agora falha com "Não foi possível gerar a imagem":
  as tasks 4 (app) e 5 (curl direto) terminam `failed` em ~0,2 s com
  `Chave de API nao configurada para Vast.ai (esperado em VAST_API_KEY)`. **A causa está no backend de produção**
  (Railway sem a env `VAST_API_KEY`), não no app. Próximo passo: configurar `VAST_API_KEY` no serviço do Railway e
  repetir a geração no moto.
- (2026-10-22, cont.) Railway CLI logado e projeto `iawrapper`/production vinculado em `d:\projects\iawrapper`.
  `VAST_API_KEY` **existe** no serviço `iawrappernew` (o dono do domínio), mas o deploy ativo continua sendo
  `786ea4b2` de 2026-10-21 01:06, anterior à variável. `railway redeploy` responde
  **"Deploys have been paused due to an upstream issue"**: os deploys estão pausados por um incidente do Railway.
  Ficou um laço em segundo plano tentando o redeploy a cada 5 min por 1 h. Depois do deploy, falta testar no
  servidor e no moto. As tasks 4–20 falharam e consumiram 1 crédito cada da conta de teste.
- **Segurança:** um print do Raw Editor do Railway passou pelo chat com `VAST_API_KEY`, `REPLICATE_API_TOKEN`,
  `CLOUDINARY_API_SECRET` e `SECRET_KEY` visíveis. Recomendado: rotacionar todas essas chaves.

## 45. Sessão 35 (2026-10-22): iawrapper local + moto apontando para o PC
Pedido do dono: testar com o iawrapper local (não o Railway), com o moto acessando o servidor do PC.

### Configuração feita
- Backend: `d:\projects\iawrapper\ia_wrapper`, SQLite (`USE_SQLITE` vale `True` por padrão e não há `DATABASE_URL`),
  `python manage.py runserver 127.0.0.1:8000 --noreload` com env `BACKGROUND_INLINE_TASKS=True` (em `DEBUG=True` o
  padrão é `False`, e aí o POST /api/tasks/ ficaria preso até a GPU responder). As features Vast têm
  `use_temporal=False`, então não precisa de worker Temporal. `migrate` sem pendências; `seed_vast_features` rodado.
  Conta `admin@test.com` já existia no SQLite; `add_credits.py` somou +500 créditos (saldo 1983).
- Moto (`ZY32LMNN9B`, adb Wi-Fi `192.168.18.112:35281`): `adb reverse tcp:8000 tcp:8000`, então o app usa
  `http://127.0.0.1:8000` sem depender de IP da rede nem do firewall. O `adb reverse` some quando o adb reconecta: refazer.
- App: `local.properties` ganhou `iawrapper.url=http://127.0.0.1:8000` (o `BuildConfig.IAWRAPPER_URL` gerado confere).
  APK debug reinstalado. Cleartext já liberado em `network_security_config.xml`. **Remover a linha para voltar ao Railway.**
- Provado: login local `POST /api/auth/login/` → 200 (do PC); `nc -z 127.0.0.1 8000` no moto → porta ok.
- `IawrapperEndToEndInstrumentedTest::resolveBaseUrl` tenta o Railway primeiro, então não serve para o teste local sem alteração.

### Bloqueio: worker do Vast parado
- A task 11 (curl direto no servidor local, `product-photo-vast`, 512², 8 steps) fica em `processing` sem fim:
  `vast_serverless_provider.py::_get_route` faz loop em `https://run.vast.ai/route/` e, sem `deadline` no modo inline,
  nunca desiste.
- `/route/` responde `total workers: 1 loading workers: 0 standby workers: 0` sem `url`. Endpoint 42006 (`iawrapper`):
  `cold_workers=0`, `max_workers=1`, `min_load=0`. Worker 57085897 com `status=unavail`; a instância está
  `intended_status=stopped` / `actual_status=exited` (RTX 5090, US$ 0,75/h).
- **Causa (corrigida):** `cold_workers=0` está certo, porque o wake on demand é do autoscaler do Vast (o iawrapper
  não tem nem precisa de código de wake). O autoscaler não consegue religar 57085897 porque a GPU da máquina 137398
  foi alugada por outro cliente (`POST /api/v0/bundles/` com `machine_id=137398` → 1 oferta, `rented=True`, 0 livres).
  Instância parada no Vast só volta com a GPU do host livre. E com `max_workers=1` o worker `unavail` ocupa a única
  vaga, então nada novo é recrutado.
- Próximo passo (decisão do dono, mexe na conta do Vast): `max_workers` ≥ 2 no endpoint 42006 (ainda escala a zero) e/ou
  destruir o worker preso 57085897 para o autoscaler recrutar outro (cold start com download da imagem). Depois,
  repetir a geração pela tela do moto.
- Fora do escopo, mas é um defeito: `_get_route` sem `deadline` gera loop infinito e uma thread presa por task.
- **Feito (decisão do dono):** endpoint 42006 com `max_workers=2` (`PUT /api/v0/endptjobs/42006/` → `success`; conferido:
  `max_workers=2, cold_workers=0, min_load=0`) e instância presa 57085897 destruída (`DELETE /api/v0/instances/57085897/` → 200).
  O autoscaler recrutou o worker 57247072 (RTX 6000D). A task 11 terminou `success` às 17:24:54Z com 1 output, e o worker
  voltou sozinho para `stopped`: a escala a zero continua funcionando. `max_workers` é teto, não reserva; com
  `min_load=0`/`cold_workers=0` só existe o worker recrutado sob demanda. Parado, ele cobra apenas o disco.
- O daemon do adb morreu no meio da sessão e levou junto o servidor local (exit 4, sem traceback) e o `adb reverse`.
  Refeito: `adb connect 192.168.18.112:35281`, `adb reverse tcp:8000 tcp:8000`, servidor no ar de novo.
- Falta: gerar uma imagem pela tela do moto.

### 45.1 Geração pela tela do moto fica "gerando" para sempre (2026-10-22)
**Análise (símbolos abertos):**
- Task 12 (app, `product-photo-vast`, 512²) em `processing` desde 19:52:14Z. O log do servidor mostra o login, mas nenhuma
  linha do `POST /api/tasks/`, porque o POST ainda não respondeu.
- `IawrapperBackend.kt::IawrapperOptions`: `sync=true` (padrão), `maxWaitMs=300_000`. Em `dispatchAndAwait` o
  `maxWaitMs` só vale no laço de polling, **depois** do POST. O POST usa `Http.kt` `readTimeoutMs=600_000`, então o app
  espera até 10 min e cai com erro de rede genérico.
- `task_views.py::task_list_create`: com `sync` e `use_temporal=False`, chama `_run_inline(task)` no próprio request.
  `vast_serverless_provider.py::_get_route`: com `deadline=None`, faz `while True` enquanto `/route/` não traz `url`. Nunca desiste.
- Vast: worker 57247072 (recrutado depois da destruição do 57085897) está `unavail`. A instância está
  `intended_status=stopped`, na máquina 151950, com as 4 ofertas da máquina em `rentable=False` (host fora do mercado).
  `/route/` → `total workers: 1 loading 0 standby 0`. Mesmo com `max_workers=2`, nenhum substituto foi recrutado.
**Hipótese descartada:** "`max_workers=1` era a única trava". Com 2 também não recrutou; o worker parado preso no host é recorrente.
**O que fazer (proposta, falta a decisão do dono):**
1. Backend `_get_route`/`_process_image`: deadline também no modo inline (ex.: 180 s), falhando com
   `ProviderCapacityError` (mensagem "sem GPU disponível") e estornando o crédito. Teste: `core/tests/test_serverless_providers.py`
   com `/route/` mockado sem `url` → falha dentro do deadline.
2. Backend: autocura. Quando o `/route/` não traz `url` por N s e `get_endpoint_workers` mostra todos `unavail`,
   destruir os `unavail` (`DELETE /api/v0/instances/{id}/`) para o autoscaler recrutar outro. Teste: mocks das duas chamadas.
3. App `dispatchAndAwait`: o POST com `sync` usa `readTimeoutMs` = `maxWaitMs`, e o estouro vira uma mensagem para leigo
   ("servidor ocupado, tente de novo"). Teste: `IawrapperBackendTest` com servidor que segura o POST.
**Complemento da análise (antes de editar):**
- `activities.py:232` (Temporal) passa `deadline = time.monotonic() + ...`, assim como `mock_provider`/`simplerllm_image`, mas
  `vast_serverless_provider.py` (`_get_route` e `_call_worker`) compara com `time.time()`. Via Temporal, o prazo daria
  como esgotado na hora. Hoje está latente (Vast com `use_temporal=False`). O único teste que depende disso é
  `test_vast_capacity_error_when_no_worker_until_deadline` (`time.time() + 0.05`).
- `_run_inline` → em exceção, `TaskService.complete_failure` marca `failed` e estorna `credits_charged`. Basta levantar o erro.
- Worker id do `get_endpoint_workers` = id da instância (57085897 foi lido em `/instances/57085897/`).
- App: falha da task → `AiError.Remote(500, msg)` → `describeImageError` → "Não foi possível gerar a imagem. Tente de novo em instantes.".
**Tasks fechadas:**
1. Backend `VastAIServerlessProvider.process`: sem `deadline`, usa `monotonic() + binding_config.max_wait_seconds` (padrão 240 s,
   abaixo dos 300 s do app). `_get_route`/`_call_worker` passam a usar `time.monotonic()`; teste existente ajustado.
2. Backend `_get_route`: depois de 30 s sem `url` (e a cada 60 s), `_heal_unavailable_workers(endpoint)` → `endptjobs` (id pelo
   nome) → `get_endpoint_workers` → `DELETE /instances/{id}/` só dos `status == 'unavail'`. Uma falha na autocura é logada e não
   derruba o pedido. Testes: autocura destrói só os unavail; deadline inline padrão aplicado.
3. App `IawrapperBackend.dispatchAndAwait`: o POST usa `readTimeoutMs = maxWaitMs`. Teste em `IawrapperBackendTest`.
**Feito e testado (2026-10-22):**
- Worker preso 57247072 destruído (decisão do dono). O Vast recrutou o 57265893 (RTX PRO 4000). A task 12 (app) terminou
  `success` às 20:04:34Z, mas o app já tinha desistido, porque o POST estava aberto desde 19:52.
- Tasks 1–3 implementadas como descrito. Backend: `python manage.py test core.tests` → `Ran 139 tests ... OK` (3 novos:
  `test_vast_inline_without_deadline_uses_binding_max_wait`, `test_vast_route_heals_unavailable_workers_while_waiting`,
  `test_vast_heal_destroys_only_unavailable_workers`). Obs.: `manage.py test core` quebra na descoberta (conflito com o
  pacote `core/tests/`); use `core.tests`. App: `IawrapperBackendTest` 7/7 (novo:
  `sync POST held by the server gives up at maxWaitMs...`), `:ai:remote-http` 43/43, `:app` 9/9, APK reinstalado.
- Servidor local reiniciado com o código novo. A task 13 `sync` (curl, mesmo corpo do app) deu `success` em 6,1 s com `b64_data`.
- Backend sem commit (repo `d:\projects\iawrapper\ia_wrapper`): `core/providers/vast_serverless_provider.py`,
  `core/tests/test_serverless_providers.py`. Produção (Railway) ainda roda o código antigo.
- Falta: o dono gerar pela tela do moto.
- **Validado no moto (2026-10-22 17:14 local):** "Gerar imagem" com o pedido "caneca vermelha de ceramica sobre mesa de
  madeira", Quadrado 512×512 → "Pronta em 6.3 s", imagem correta (conferida por print), via servidor local + `adb reverse`.
- Pendente: commits (app e backend) e deploy do backend no Railway; tirar `iawrapper.url` do `local.properties` ao voltar à produção.

## 46. Sessão 36 (2026-10-22): Seletor de formato único (redes sociais + personalizado, com prévia visual)
**Pedido do dono:** em toda tela que escolhe tamanho, um componente único com os formatos de hoje + post/capa/reels do
Facebook, Shorts/thumbnail/capa do YouTube, vídeo e anúncio do TikTok, post/reels/perfil do Instagram e tamanho
personalizado, cada um com um desenho que mostra o formato.
**Símbolos abertos (onde se escolhe tamanho hoje):**
- `app/.../ImageGenScreen.kt::ImageFormat` — enum de 3 (`Quadrado 512×512`, `Retrato 512×768`, `Paisagem 768×512`) em
  `FilterChip`; `generate()` manda `format.width/height` direto no `ImageRequest` (sem teto; o provedor faz `snapTo8`).
- `app/.../HomeScreen.kt::NEW_SIZES` — 7 `Triple` num `AlertDialog` de texto → `onNewDesign(name, w, h)`.
- `editor-web/src/main.ts::SIZES` + `showSize()` — 10 presets em chips + campos L/A (16..8000) → `editor.resize(W, H, scale)`.
- `core/ai-api/.../AdCreative.kt::AdAspectRatio` — enum de 4 proporções; usado por `OutpaintBuilder.buildRaster/build`
  (só `widthRatio/heightRatio`), `LocalAdFormatExpander` (`label`), `IawrapperAdFormatExpander.prepare`,
  `ProductFlowViewModel` (`selectedRatio`, `applyAdOutpaint`: `label`, `platformTarget`), `ProductFlowScreen` (chips de
  `AdAspectRatio.entries`), testes `AdCreativeImagingTest` e `IawrapperEndToEndInstrumentedTest` (`RATIO_9_16`, `RATIO_16_9`).
- Mockup (`feature/mockup`): a proporção vem do slot do mockup, não é escolha do usuário — fora do escopo.
**Decisões:**
1. Novo módulo `:core:ui` (Compose): `MediaFormat` + catálogo `MediaFormats` + `FormatPicker` (botão com o formato atual →
   folha com grade de cartões desenhados em `Canvas`, agrupados, + aba "Personalizado" com L/A e teto `maxSide` por tela).
   `app` e `feature:product` passam a depender dele.
2. Editor web: o mesmo catálogo em `editor-web/src/formats.ts` (mesmos ids e tamanhos) e o desenho em SVG; o Kotlin não
   lê o TS em runtime, então um teste JVM (`MediaFormatsTest`) lê `formats.ts` e confere ids/tamanhos — uma divergência quebra o teste.
3. `AdAspectRatio` vira `data class` com os 4 de hoje no `companion` (os testes e chamadores compilam sem mudar);
   o ViewModel converte o `MediaFormat` escolhido. Depois da expansão, o resultado é redimensionado para o tamanho exato do formato.
4. Gerar imagem: se `w×h` ≤ 512×768 px gera no tamanho pedido (os 3 de hoje não mudam); acima disso gera na mesma
   proporção dentro desse orçamento (lado maior ≤ 1024, múltiplo de 8) e redimensiona para o tamanho exato. Função pura
   `generationSize(w, h)` com teste. Teto do personalizado ali: 2560 px.
5. "Capa de página do Instagram" não existe (o Instagram não tem capa). Dono (2026-10-22): sem substituto; capa só a do
   Facebook. O "Perfil Instagram" que chegou a entrar foi retirado.
**Tamanhos (px):** Post Instagram 1080×1350 · Reels Instagram 1080×1920 · Post Facebook
1080×1080 · Capa Facebook 1640×624 · Reels Facebook 1080×1920 · Shorts YouTube 1080×1920 · Thumbnail YouTube 1280×720 ·
Capa do canal YouTube 2560×1440 · Vídeo TikTok 1080×1920 · Anúncio TikTok 1080×1920 · básicos (Quadrado 1080², Retrato
2:3 1080×1620, Paisagem 3:2 1620×1080, Banner 16:9 1920×1080, Story 9:16 1080×1920) · impressão (Logo 1000², Cartão
1050×600, A4 1240×1754, A3 1754×2480) · rápidos da IA (os 3 de 512, só em Gerar imagem).
**Tasks (arquivo → prova):**
1. `:core:ui` `MediaFormats.kt`, `FormatPicker.kt` → `MediaFormatsTest` (ids únicos, tamanhos > 0, paridade com `formats.ts`).
2. `ImageGenScreen.kt`: `FormatPicker` + `generationSize` → teste em `ImageGenConfigTest`.
3. `HomeScreen.kt`: `AlertDialog` → `FormatPicker` em modo folha.
4. `AdCreative.kt` + `ProductFlowViewModel/Screen`: `FormatPicker` → `AdCreativeImagingTest` continua verde.
5. `editor-web/src/formats.ts` + `showSize()` → `test/formats.test.ts`; `npm run build` regenera `editor/src/main/assets/editor`.

## 47. Sessão 37 (2026-10-22): [BUG] miniaturas do Mockup aparecem cinza (selo "Online")
**Sintoma:** na grade do Mockup, todos os itens remotos (Hugging Face) mostram um quadrado cinza no lugar da miniatura.
**Símbolos abertos:**
- `feature/mockup/.../MockupScreen.kt::TemplateGrid` — `remember(e.id) { library.thumb(e).asImageBitmap() }`: roda
  **na composição, na main thread**.
- `feature/mockup/.../MockupLibrary.kt::thumb` — cache em disco → assets → `downloadBytes` (HttpURLConnection) dentro de
  `runCatching`; em erro devolve `createFallbackBitmap()` (160×160 LTGRAY = o quadrado cinza da tela). O erro é engolido.
- Na main thread o Android lança `NetworkOnMainThreadException` → `runCatching` engole → cinza; e o `remember(e.id)` guarda
  o cinza até um novo `syncVersion`. Nenhum log porque a exceção é engolida.
**Prova de que o servidor está ok:** `curl -sIL .../resolve/main/mockups/menucard1.webp` → 302 → 200 `image/webp`
167180 bytes; `file` → WebP 800x533. `index.json` remoto: `thumb = "mockups/<nome>.webp"`, `remoteBaseUrl` com `/` final
(o `resolveRemoteUrl` faz `trimEnd('/')`, ok).
**Hipótese descartada:** URL/CSP/redirect do HF — o `curl` acima baixa a imagem; `instanceFollowRedirects = true`
(mesmo host→CDN https, segue).
**O que fazer:**
1. `MockupLibrary.loadThumb(e)` suspend em `Dispatchers.IO`.
2. `TemplateGrid`: `produceState<ImageBitmap?>(null, e.id) { value = library.loadThumb(e).asImageBitmap() }`; enquanto
   null, mostra o fundo do card (sem bloquear a UI).
3. Prova: build + abrir o Mockup no moto (`ZY32LMNN9B`) e ver as miniaturas.
**Feito e testado (2026-10-22):**
- Tasks 1–5 implementadas como descrito. Novos: `core/ui` (`MediaFormats.kt`, `FormatPicker.kt` com `FormatPicker`,
  `FormatPickerSheet`, `FormatThumbnail`, `parseCustomSize`), `editor-web/src/formats.ts` (`formatSvg`, `findFormat`),
  `editor-web/test/formats.test.ts`. `AdAspectRatio` agora é `data class`; o `UiState.selectedRatio` virou `adFormat: MediaFormat`.
- Testes: `MediaFormatsTest` 4/4 (inclui a paridade com `formats.ts`), `ImageGenConfigTest` 5/5 (novo: `generation size …`),
  `AdCreativeImagingTest` 3/3, vitest 46/46, `tsc --noEmit` limpo, `:app:compileDebugAndroidTestKotlin` ok.
- `npm run build` regenerou `editor/src/main/assets/editor` (index-B-gjrdto.css, index-JIISOCpS.js); APK debug instalado no moto.
- **Falta:** conferir no moto (estava bloqueado na hora): Gerar imagem → "Trocar" → folha com os desenhos; gerar um
  "Reels Instagram" e ver o resultado 1080×1920; Home → Novo design; editor → Tamanho; Foto de produto → Formato do anúncio.
- Sem commit.
**Feito e testado (2026-10-22):** `loadThumb` + `produceState` implementados; `:app:assembleDebug` ok; instalado no moto
(`ZY32LMNN9B`): Mockup → miniaturas reais (Menucard1, Photoframe, T Shirt1, Photoframe1, Perfume, Milkpack1, …).
Observação: no índice remoto `thumb == file` (mesmo `.webp`), então baixar a miniatura já faz `isDownloaded` = true e o
selo "Online" some depois do primeiro carregamento — comportamento correto (o modelo fica offline).
**Pedido 2 do dono (2026-10-22): formatos pequenos, posts do LinkedIn e uma foto de perfil para todas as redes.**
- Novos grupos/entradas (Kotlin e TS): **Foto de perfil** 800×800 (círculo; 800 é o recomendado pelo YouTube, o maior entre
  Instagram 320, Facebook ≥320, X 400, LinkedIn 400, TikTok 200; as redes reduzem); **LinkedIn**: post 1200×627, quadrado
  1200×1200, vertical 1080×1350, capa do perfil 1584×396 (4:1, entra na expansão de anúncio); **Pequenos**: ícone 256², quadrado 500², retrato 400×600, paisagem 600×400, foto 4:3 640×480,
  vertical 360×640, widescreen 640×360, anúncio de site 300×250, banner de site 728×90.
- Problemas que os pequenos trazem, e a decisão:
  1. Gerar imagem em 256 px ou 728×90 exato daria imagem ruim (o modelo trabalha perto de 512). `generationSize` passa a usar
     o tamanho exato só quando o menor lado ≥ 512, a área ≤ 512×768 e o maior lado ≤ 1024 (os 3 rápidos continuam iguais).
     Fora disso: orçamento de área, proporção limitada a 4:1. O resultado vai para o tamanho final com **corte central +
     escala** (`feature/mockup/Crop.kt::centerCrop`, que o `app` já usa), não esticando — com o limite de 4:1, esticar distorceria.
  2. Expansão de anúncio (outpaint) em 728×90 (8:1) faria um canvas de ~8000×1024 a partir de uma foto de 1024 px. `forAds`
     fica só com proporção entre 1:4 e 4:1, e o personalizado ali ganha o mesmo limite (`parseCustomSize(maxAspect)`).
- Prova: `MediaFormatsTest` (paridade, `forAds` sem proporção > 4, `maxAspect`), `ImageGenConfigTest` (pequenos geram no
  orçamento, 728×90 → 4:1, rápidos inalterados), vitest.

## 48. Sessão 38 (2026-10-22): Levantamento de segurança do app e do iawrapper (hub multi-app), sem código
Pedidos do dono, nesta ordem:
1. "Hoje o app está totalmente inseguro; o que fazer em autenticação e segurança para publicar?"
2. Requisitos novos:
   - cada usuário cria a própria conta no iawrapper (a conta padrão é só para testes);
   - login Google + e-mail/senha;
   - nenhum crédito grátis;
   - login na primeira abertura e sessão guardada;
   - RevenueCat é feature futura, servidor↔servidor com o iawrapper (a rota atual é herança do app legado).
3. "Levante todos os possíveis problemas de segurança do app e do iawrapper, lembrando que o iawrapper será um hub
   para vários produtos de IA em vários apps."

Resultado:
- Só análise e planejamento, sem código. O registro completo está em `docs/backlog/README.md`, **Épico 11**:
  17 frentes, achados com gravidade e marcação V/A, provas, hipóteses descartadas, fases e verificação. O Épico 10
  (token por instalação) foi **substituído** pelas contas individuais.
- **Exposto agora em produção (Fase 0, ações do dono):**
  1. SEC-02: `admin@test.com` é admin no Railway, com senha de lista de senhas comuns. A senha está literal em
     `create_admin.py`, no `local.properties` e 3× no `IawrapperEndToEndInstrumentedTest.kt` (sem commit; não
     commitar assim).
  2. SEC-03: webhook da RevenueCat sem autenticação (probe com token inválido → 400). Correção de hoje: tirar a rota.
  3. SEC-04: o `SECRET_KEY`, que assina os JWT, passou no chat (§44). Rotacionar junto com as chaves dos provedores.
  4. Confirmar se a produção tem `DATABASE_URL` e se o worker Trellis está exposto.
- **Crítico no código (Fase 1):** SEC-15.1. O `workflow_json` do usuário substitui o da feature
  (`vast_serverless_provider.py:86`), e nenhum schema tem `additionalProperties:false`. Com crédito, qualquer usuário
  roda um grafo ComfyUI arbitrário na GPU paga. Hoje a cadeia está aberta: cadastro livre + webhook.
- Para as contas individuais:
  - `auth/refresh/` não funciona com o `core.User` (500);
  - o `token_blacklist` quebraria o login;
  - o `is_active` é ignorado;
  - o limite de login é burlável pelo `X-Forwarded-For` (DRF 3.16.1).
- Nesta sessão a senha do admin apareceu numa saída de ferramenta (um `sed` de máscara falhou). Mais um motivo para
  trocá-la.
- **Próximo passo:**
  - dono: Fase 0 no Railway;
  - código: numa sessão nova no backend, ler o Épico 11 e começar pela Fase 1 (SEC-15.1–3, SEC-14.3, SEC-15.5,
    SEC-07.2).
