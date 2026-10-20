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
