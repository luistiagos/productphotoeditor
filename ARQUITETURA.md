# Arquitetura — app "foto de produto / pôster / logo" com IA local e plugável

Criado em 2026-10-13 (sessão 4). Insumos:
- `HANDOFF_APP_OFFLINE.md` (nesta pasta desde a sessão 19; antes em `product_photo_apk`): pedido do dono (§1), inventário
  (§3), pilha local (§4), **versões/licenças confirmadas (§4.1)**, requisito de troca de provedor
  (§5) e **decisões do dono (§6.1)**.
- `C:\projects\sandbox\product_photo_apk\REA_ANALISE.md`, "Sessão 3": especificação funcional da
  camada de IA do original.

**Caminhos:** um caminho relativo neste documento (`docs/…`, `app/…`, `ai/…`) é relativo a
`C:\projects\sandbox\product_photo_offline\`. Tudo o que é do app (este doc, o HANDOFF, `docs/`) fica nesta pasta; o
`product_photo_apk` guarda só a engenharia reversa do APK original (decisão do dono, 2026-10-16). Ao indicar um arquivo
ao dono, usar o caminho absoluto.

**Restrição legal:** o código é escrito do zero. O original serve só como especificação de
comportamento; nenhum código, prompt, template, fonte ou asset dele é copiado.

## 0. Decisões que moldam este documento
| Tema | Decisão |
|---|---|
| Linguagem / UI nativa | Kotlin + Jetpack Compose (telas, fluxos, ajustes) |
| Editor de canvas | **WebView com editor próprio em Fabric.js 7.x (MIT)**, servido dos assets do APK |
| Distribuição | sideload (APK assinado), sem Play Billing, AdMob ou créditos |
| minSdk / GMS | **minSdk 28**; GMS **opcional**. Com GMS: ML Kit/Gemini Nano. Sem GMS: modelos empacotados |
| Vídeo/áudio | **fora do MVP** (o original exportava vídeo por FFmpeg; o áudio era um stub vazio) |
| Conteúdo | **tudo empacotado** no APK: templates, fontes OFL, stickers e cenários |
| Modelos grandes (LLM, SD) | download opcional pelo gerenciador de modelos; são capability, não conteúdo |

## 1. Visão geral

```
┌────────────────────────────── :app (Compose) ──────────────────────────────┐
│ Home · Fluxo Foto de Produto · Gerar · Ajustes(Provedores, Modelos) · Help │
└──────┬───────────────────────┬──────────────────────────┬──────────────────┘
       │                       │                          │
   :feature:*              :editor                    :data
 (product, generate,   (WebView + ponte Kotlin↔JS,  (Room: projetos/rascunhos,
  mockup, brandkit)     assets web Fabric.js)        brand kit; DataStore; conteúdo)
       │                       │                          │
       └──────────┬────────────┘                          │
                  ▼                                       │
          :core:ai-api  ◄── interfaces por capability, tipos próprios, ProviderRegistry
                  ▲
   ┌──────────────┼──────────────┬───────────────┬────────────────┬──────────────┐
:ai:mlkit     :ai:onnx       :ai:litertlm    :ai:remote-http   :ai:ondevice-sd  :ai:vtracer
(GMS / bundled) (ORT 1.31)    (Gemma)       (OpenAI-compat,   (opcional,       (Rust JNI)
                                             A1111, ComfyUI,   MNN/ORT)
                                             HTTP genérico)
                  ▲
          :core:models (ModelManager: download, hash, espaço, remoção)
          :core:secrets (chaves do usuário via Keystore)
          :core:imaging (Bitmap/máscara utilitários, composição, sombras — puro Kotlin)
```

Regra de dependência: `:feature:*` e `:editor` dependem **só** de `:core:ai-api`. Os módulos
`:ai:*` implementam as interfaces e se registram. O `:app` monta o registro (DI manual ou Hilt)
e é o único que conhece todos os `:ai:*`.

## 2. Módulos Gradle
| Módulo | Conteúdo | Depende de |
|---|---|---|
| `:app` | Activity única, navegação Compose, DI, montagem do `ProviderRegistry` | todos |
| `:core:ai-api` | interfaces, tipos de I/O, `ProviderDescriptor`, `Requirement`, `ProviderRegistry`, `FallbackChain`, erros | kotlinx-coroutines, kotlinx-serialization |
| `:core:imaging` | máscara, recorte, sombras, harmonização de cor, perspectiva (mockup) — Kotlin puro + `android.graphics` | — |
| `:core:models` | `ModelManager`, catálogo de modelos (JSON), verificação SHA-256, espaço livre | OkHttp |
| `:core:secrets` | `SecretStore` (AES-GCM com chave do Android Keystore, arquivo próprio) | — |
| `:ai:mlkit` | `MlKitBackgroundRemover` (GMS), `MlKitTextDetector` (empacotado), `MlKitTranslator`, `GeminiNanoTextGenerator` | ML Kit |
| `:ai:onnx` | `OnnxBackgroundRemover` (u2netp/BiRefNet), `MiGanInpainter`, `RealEsrganUpscaler` | onnxruntime-android 1.31.0 |
| `:ai:litertlm` | `LiteRtLmTextGenerator` (Gemma 4 E2B / Gemma 3 1B `.litertlm`) | litertlm-android |
| `:ai:remote-http` | `OpenAiCompatibleTextGenerator`, `GeminiApiTextGenerator`, `Automatic1111ImageGenerator`, `ComfyUiImageGenerator`, `HttpBackgroundRemover`/`HttpInpainter`/… genéricos | OkHttp, serialization |
| `:ai:ondevice-sd` | `OnDeviceSdImageGenerator` (SD1.5/BK-SDM + LCM + TAESD) — **última fase** | ORT ou MNN |
| `:ai:vtracer` | `VTracerVectorizer` (Rust via cargo-ndk + JNI) | NDK |
| `:editor` | `EditorWebView`, ponte, `assets/editor/` (build web) | `:core:ai-api`, `:data`, androidx.webkit |
| `:editor-web` (fora do Gradle) | projeto TypeScript + Vite + Fabric.js; o build gera `:editor/src/main/assets/editor/` | — |
| `:data` | Room (projetos, rascunhos, brand kit), DataStore (ajustes, config de provedores), `ContentRepository` (templates/fontes/stickers/cenários dos assets) | — |
| `:feature:product` | fluxo Foto de Produto | `:core:ai-api`, `:core:imaging`, `:data` |
| `:feature:generate` | pôster/logo por prompt, texto IA | idem |
| `:feature:mockup` | mockup | idem |
| `:feature:brandkit`, `:feature:settings` | brand kit; ajustes, provedores, modelos | idem |

## 3. Contratos de `:core:ai-api`
Princípios: `suspend`, cancelável (respeita o `Job`), progresso por callback opcional, **nenhum
tipo de provedor nos parâmetros ou no retorno**, e erros tipados.

```kotlin
// Tipos próprios do app
class RgbaImage(val bitmap: Bitmap)                  // ARGB_8888, sem premultiplicar na API
class Mask(val width: Int, val height: Int, val alpha: ByteArray)  // 0..255, 255 = objeto/área
data class Progress(val fraction: Float?, val stage: String)
typealias ProgressSink = (Progress) -> Unit

sealed class AiError(msg: String, cause: Throwable? = null) : Exception(msg, cause) {
    class Unavailable(val missing: List<Requirement>) : AiError("provider unavailable")
    class ModelNotDownloaded(val modelId: String) : AiError("model $modelId missing")
    class Network(cause: Throwable) : AiError("network", cause)
    class Remote(val code: Int, val body: String?) : AiError("remote $code")
    class InvalidOutput(detail: String) : AiError(detail)
    class Unsupported(detail: String) : AiError(detail)  // opção pedida não suportada
}

interface BackgroundRemover {
    suspend fun removeBackground(image: RgbaImage, progress: ProgressSink? = null): Mask
}
interface Inpainter {
    /** mask 255 = área a preencher. Saída do mesmo tamanho que image. */
    suspend fun inpaint(image: RgbaImage, mask: Mask, progress: ProgressSink? = null): RgbaImage
}
data class TextBlock(val text: String, val box: RectF, val lines: List<RectF>)
interface TextDetector { suspend fun detect(image: RgbaImage): List<TextBlock> }
interface Translator {
    suspend fun translate(text: String, from: String?, to: String): String  // from null = detectar
}
// sessão 6: maxColors não existe no VTracer → parâmetros reais dele (§14.3)
data class VectorizeOptions(val colorMode: ColorMode = ColorMode.COLOR, val colorPrecision: Int = 6,
                            val layerDifference: Int = 16, val filterSpeckle: Int = 4)
interface Vectorizer { suspend fun toSvg(image: RgbaImage, options: VectorizeOptions = VectorizeOptions()): String }
interface Upscaler { suspend fun upscale(image: RgbaImage, factor: Int, progress: ProgressSink? = null): RgbaImage }

data class TextRequest(val system: String?, val prompt: String,
                       val jsonSchema: String? = null,   // pedir JSON estruturado
                       val maxTokens: Int = 512, val temperature: Float = 0.7f)
interface TextGenerator {
    suspend fun generate(req: TextRequest): String
    fun stream(req: TextRequest): Flow<String>            // default: emite generate() inteiro
}

data class ImageRequest(
    val prompt: String, val negativePrompt: String? = null,
    val width: Int = 512, val height: Int = 512, val steps: Int? = null, val seed: Long? = null,
    val init: RgbaImage? = null, val strength: Float? = null,      // img2img
    val inpaintMask: Mask? = null, val maskInvert: Boolean = false, // "só fundo" = máscara do produto invertida
    val control: Control? = null,                                   // canny / scribble
    val count: Int = 1,
)
data class Control(val kind: Kind, val image: RgbaImage, val weight: Float = 1f) { enum class Kind { CANNY, SCRIBBLE } }
interface ImageGenerator {
    val supports: Set<ImageFeature>   // TXT2IMG, IMG2IMG, INPAINT, CONTROL_CANNY, CONTROL_SCRIBBLE
    suspend fun generate(req: ImageRequest, progress: ProgressSink? = null): List<RgbaImage>
}

// Foto de produto: composição determinística, sem modelo generativo
data class Scene(val id: String, val image: RgbaImage, val meta: SceneMeta)
data class SceneMeta(val floorY: Float, val lightDirDeg: Float, val lightElevationDeg: Float,
                     val shadowSoftness: Float, val colorTempK: Int, val placement: RectF)
data class Placement(val center: PointF, val scale: Float, val rotationDeg: Float)
data class CompositeOptions(val contactShadow: Float = .6f, val castShadow: Float = .4f,
                            val harmonize: Float = .5f, val lightWrap: Float = .3f)
interface ProductSceneComposer {
    suspend fun compose(product: RgbaImage, productMask: Mask, scene: Scene,
                        placement: Placement, options: CompositeOptions): RgbaImage
}

// fase 7 (§20.4 item 8, feito na §20.8): N espaços; sombreamento/relevo tirados da própria base, dosados por forças
data class MockupSlot(val quad: List<PointF>, val aspect: Float, val mask: Mask? = null)   // quad TL, TR, BR, BL
data class MockupTemplate(val id: String, val base: RgbaImage, val slots: List<MockupSlot>,
                          val shading: Float = 1f, val displacement: Float = 0f)
interface MockupRenderer { suspend fun render(designs: List<RgbaImage>, template: MockupTemplate): RgbaImage }
```

`ProductSceneComposer` e `MockupRenderer` têm implementação local padrão em `:core:imaging`
(`LocalSceneComposer`, `PerspectiveMockupRenderer`). O modo "IA generativa" de cada um é uma
implementação alternativa que delega para `ImageGenerator` (img2img/inpaint com `maskInvert`,
como o original fazia com `inpainting_mask_invert`).

## 4. Registro, configuração e fallback

### 4.1 Descritor de provedor
```kotlin
enum class Capability { BACKGROUND_REMOVER, INPAINTER, TEXT_DETECTOR, TRANSLATOR, VECTORIZER,
    UPSCALER, TEXT_GENERATOR, IMAGE_GENERATOR, SCENE_COMPOSER, MOCKUP_RENDERER }

sealed interface Requirement {
    data object PlayServices : Requirement
    data class MinRamMb(val mb: Int) : Requirement
    data class Model(val modelId: String) : Requirement      // precisa estar baixado
    data object Network : Requirement
    data class Secret(val key: String) : Requirement         // chave do usuário configurada
    data class DeviceFeature(val name: String) : Requirement // ex. "aicore", "npu-qnn"
}

interface ProviderFactory<T : Any> {
    val id: String                        // "mlkit.subject", "onnx.u2netp", "http.openai-compatible"
    val capability: Capability
    val displayName: String
    val isLocal: Boolean
    val settingsSchema: List<SettingField> // gera a tela "avançado" (url, header, modelo, parâmetros)
    fun requirements(settings: JsonObject): List<Requirement>
    fun create(settings: JsonObject, ctx: ProviderContext): T  // ProviderContext: Context, SecretStore, ModelManager, OkHttp
}
```

### 4.2 Registro
`ProviderRegistry` guarda `Map<Capability, List<ProviderFactory<*>>>`. Cada módulo `:ai:*`
expõe `fun register(registry: ProviderRegistry)`, chamado pelo `:app`. Para adicionar um
provedor novo, basta implementar a interface e um `ProviderFactory` e registrar uma vez.

### 4.3 Configuração (DataStore, JSON; editável na tela Ajustes → Provedores e importável/exportável)
```json
{
  "version": 1,
  "capabilities": {
    "TEXT_GENERATOR": {
      "chain": [
        {"provider": "mlkit.gemini-nano"},
        {"provider": "litertlm", "settings": {"modelId": "gemma-4-e2b-it-int4"}},
        {"provider": "http.openai-compatible",
         "settings": {"baseUrl": "http://192.168.0.10:11434/v1", "model": "qwen3:8b",
                      "apiKeySecret": "ollama"}}
      ]
    },
    "BACKGROUND_REMOVER": {"chain": [{"provider": "mlkit.subject"}, {"provider": "onnx.u2netp"}]},
    "IMAGE_GENERATOR": {"chain": [{"provider": "http.a1111",
        "settings": {"baseUrl": "http://pc.local:7860", "queue": "agent-scheduler"}}]}
  }
}
```
- Segredos **nunca** entram nesse JSON: só o nome (`apiKeySecret`), resolvido no `SecretStore`.
- Exportar a config omite segredos.

### 4.4 Resolução e fallback
`AiServices.get<T>(capability)` devolve um **proxy** que, a cada chamada:
1. percorre a `chain` e pula provedores com `requirements` não atendidos (resultado em cache,
   invalidado quando muda rede, modelo baixado ou segredo);
2. chama o primeiro disponível; se ele lançar `AiError.Unavailable`, `ModelNotDownloaded` ou
   `Network`, tenta o próximo; `Remote`/`InvalidOutput` sobem para a UI, que oferece "tentar
   com outro provedor";
3. registra qual provedor atendeu (para a UI mostrar "feito no aparelho" / "feito em X").

Cadeias padrão (primeiro uso):
| Capability | Cadeia padrão |
|---|---|
| BackgroundRemover | `mlkit.subject` → `onnx.u2netp` (empacotado) |
| Inpainter | `onnx.migan` (empacotado) |
| TextDetector | `mlkit.text-bundled` |
| Translator | `mlkit.translate` (precisa baixar o idioma 1x) → desligado |
| Vectorizer | `vtracer` |
| Upscaler | `onnx.realesrgan-x4v3` (empacotado, 4,99 MB, float + XNNPACK; §20.6) |
| TextGenerator | `mlkit.gemini-nano` → `litertlm` (se o modelo estiver baixado) → desligado |
| ImageGenerator | **ligado** (decisão do dono, sessão 12, §19.5): `http.a1111` sem URL até o usuário informar o servidor; ComfyUI ou on-device por escolha |
| SceneComposer | `local.composer` |
| MockupRenderer | sem cadeia: `PerspectiveMockupRenderer` direto no `AppGraph` (como o `LocalSceneComposer`, §20.4 item 9) |

## 5. Gerenciador de modelos (`:core:models`)
- Catálogo `models.json` empacotado (id, capability, url(s), tamanho, sha256, licença, RAM
  mínima, formato). Lista editável: o usuário pode apontar uma URL própria (espelho).
- Download com WorkManager (retomável por `Range`), verificação SHA-256 antes de mover para
  `filesDir/models/<id>/`, checagem de espaço livre (tamanho × 1,2) antes de começar.
- Estados: `NotDownloaded`, `Downloading(p)`, `Ready`, `Corrupt`. A remoção libera espaço e
  invalida o cache de requisitos.
- Modelos **empacotados** (u2netp, MI-GAN, Real-ESRGAN pequeno) ficam em `assets/models/` e
  são copiados para o disco no primeiro uso (o ORT precisa de caminho/bytes).

## 6. Segredos (`:core:secrets`)
Chave AES-256-GCM gerada no Android Keystore (`setUserAuthenticationRequired(false)`), com
segredos guardados num arquivo cifrado próprio. Isso evita `EncryptedSharedPreferences`, que
está descontinuado em androidx.security (confirmar o status na implementação). Nenhuma chave
vai no APK nem no backup (`android:allowBackup` desligado para esse arquivo).

## 7. Editor (WebView + Fabric.js)
- Projeto web próprio `editor-web/` (TypeScript, Vite, `fabric@7.4.0`). O build gera arquivos
  estáticos em `:editor/src/main/assets/editor/`, servidos por `WebViewAssetLoader`
  (origem `https://appassets.androidplatform.net`), **sem rede**.
- **Ponte**: mensagens JSON versionadas `{id, type, payload}` nos dois sentidos, por
  `WebViewCompat.addWebMessageListener` (restrito à origem do asset loader), em vez de dezenas de
  métodos `@JavascriptInterface` como no original. O lado Kotlin é um `EditorBridge` com handlers
  tipados. Imagens trafegam como URL do asset loader (`/blob/<id>`), não como base64 grande.
- Mensagens (JS → Kotlin): `ai.removeBg`, `ai.inpaint`, `ai.removeText`, `ai.vectorize`,
  `ai.rewriteText`, `ai.upscale`, `pickImage`, `pickFont`, `saveDraft`, `export`, `getBrandKit`.
  (Kotlin → JS): `loadProject`, `loadTemplate`, `insertImage`, `applyBrandKit`, `result/<id>`,
  `progress/<id>`.
- Recursos do editor (paridade com o §3.2 do handoff): texto (fontes, efeitos: contorno,
  sombra, curva), imagens, formas, camadas, filtros (filtros WebGL do Fabric), texturas,
  molduras, stickers, fundos, crop, undo/redo, redimensionar o canvas, salvar/abrir JSON do
  Fabric, exportar PNG/JPG (escala → qualidade) e SVG, imprimir (`PrintManager` no Kotlin) e
  compartilhar (`FileProvider`).
- Fontes: as OFL empacotadas são registradas via `FontFace` a partir do asset loader. Fonte do
  usuário: o Kotlin copia o arquivo para `filesDir/fonts/` e a expõe pelo asset loader.

## 8. Conteúdo empacotado (decisão: tudo no APK)
- `assets/content/` com `index.json` por tipo: `templates/` (JSON do Fabric próprio +
  miniaturas WebP), `fonts/` (OFL, com `OFL.txt` de cada família), `stickers/` (SVG/WebP de
  fontes CC0, ou feitos por nós), `scenes/` (WebP + `SceneMeta` em JSON), `mockups/`.
- `ContentRepository` lê só do APK. Não há servidor de templates. Uma "importação de pacote" (.zip
  com o mesmo `index.json`) fica prevista na interface para o futuro, mas não entra no MVP.
- **Orçamento de tamanho** (medir na fase 4): cenários ~60 × 300 KB ≈ 18 MB; fontes ~40 famílias
  ≈ 15 MB; templates ~100 ≈ 20 MB; modelos empacotados (u2netp ~5 MB, MI-GAN ~30–80 MB conforme
  a variante, **Real-ESRGAN x4v3 float 4,99 MB** medido na §20.6); bibliotecas nativas arm64 (ORT, VTracer) ≈ 25 MB. Total
  estimado de **150–200 MB**, aceitável por sideload. Só arm64-v8a, para não multiplicar `.so`.
- Os cenários são gerados no PC (SDXL/Flux local). Registrar o prompt, o modelo e a licença do
  modelo usado para cada cenário em `scenes/SOURCES.md`.

## 9. Fluxos por funcionalidade
**Foto de produto** (equivale a `ProductCategory → ImageSelect → RemoveBg → Position → Prompt → Output`):
1. Categoria (filtra os cenários pela tag) → 2. escolher foto (galeria/câmera) → 3.
   `BackgroundRemover` → editor de máscara (pincel apagar/restaurar) → 4. escolher cenário da
   biblioteca → 5. posicionar/escalar/girar sobre o cenário (snap no `floorY`) → 6.
   `ProductSceneComposer.compose` (ver abaixo) com sliders de sombra/harmonização → 7. exportar
   PNG/JPG ou "abrir no editor".
   O modo "IA generativa" (opcional) envia produto+máscara para `ImageGenerator` com
   `inpaintMask=productMask, maskInvert=true` e prompt, ou seja, gera só o fundo.

`LocalSceneComposer`, em ordem:
- **sombra de contato:** a faixa inferior da máscara é achatada verticalmente (escala Y ~0,08)
  na base do objeto, com blur gaussiano largo e opacidade `contactShadow`;
- **sombra projetada:** a máscara inteira recebe cisalhamento/rotação conforme `lightDirDeg`
  e `lightElevationDeg`, ancorada na linha de base, com blur que cresce com a distância da
  base (blur variável em 3–4 faixas) e opacidade `castShadow`, multiplicada sobre o cenário;
- **harmonização de cor:** em Lab, média/desvio de L, a e b do produto se aproximam dos do
  cenário na região do `placement`, com peso `harmonize`, mais um ajuste de temperatura de cor;
- **light wrap:** as bordas da máscara (erosão/dilatação) recebem uma mistura do cenário
  desfocado, com peso `lightWrap`;
- composição final premultiplicada, com a borda da máscara suavizada (feather de 1–2 px).

| Funcionalidade | Fluxo |
|---|---|
| Remover fundo | editor → `ai.removeBg` → `BackgroundRemover` → a máscara aplicada vira um objeto novo |
| Remover objeto | editor: pincel no canvas → máscara → `ai.inpaint` → `Inpainter` → substitui a imagem |
| Remover texto | `TextDetector` → caixas (o usuário confirma/desmarca) → máscara dilatada → `Inpainter` |
| Imagem → SVG | `Vectorizer` → SVG inserido como grupo de objetos Fabric (`loadSVGFromString`) |
| Traduzir prompt | `Translator` (antes de `ImageGenerator`, para prompts em PT em modelos treinados em EN) |
| Texto IA / reescrever | `TextGenerator` com `jsonSchema` (título/descrição/listas para pôster; variações para rewrite) e validação do JSON, com 1 retry |
| Gerar pôster/logo | `ImageGenerator` txt2img (+ `Control` canny/scribble a partir de um esboço/ícone) → resultado vai ao editor |
| Mockup | `MockupRenderer` local: homografia do design para o `quad` do template + mapa de deslocamento + multiplicação do sombreamento |
| Upscale | `Upscaler` em tiles de 128² com **sobreposição de 24 px** (§20.7), entrada ≤ 1 MP |
| Brand kit | Room: cores, fontes, logo, perfil da empresa → `applyBrandKit` no editor e variáveis nos templates (`{{company}}`, `{{phone}}`) |
| Rascunhos | JSON do Fabric + miniatura, autosave com debounce |

## 10. Ordem de implementação e o teste que prova cada fase
| # | Fase | Prova |
|---|---|---|
| 1 | `:core:ai-api`, `ProviderRegistry`, config/fallback, `:core:secrets`, `:core:models` (esqueleto) | testes JVM: resolução de cadeia com fakes (requisito faltando → pula; `Network` → próximo; `Remote` → sobe); round-trip de config sem segredos |
| 2 | **Protótipo foto de produto**: `:ai:mlkit` (subject) + `:ai:onnx` (u2netp) + `LocalSceneComposer` + telas do fluxo + 3–5 cenários de teste | `assembleDebug` verde; `adb install`; **3 fotos reais exportadas** para o dono avaliar; teste instrumentado do composer (máscara sintética → sombra abaixo da base) |
| 3 | Inpaint (MI-GAN), remover texto, SVG (VTracer JNI), tradução | um teste instrumentado por capability com imagem fixa (saída do mesmo tamanho, SVG válido, máscara não vazia) |
| 4 | Editor web + ponte + templates + brand kit + rascunhos + exportação | testes do `editor-web` (vitest) para serialização/brand kit; teste instrumentado da ponte (mensagem → resposta); exportar PNG/SVG pelo app |
| 5 ✅ (§18.7) | Texto com IA (Nano → LiteRT-LM → OpenAI-compatível) | teste com o provedor HTTP contra servidor fake (MockWebServer); validação do JSON; teste manual em aparelho com Nano |
| 6 ✅ remota (§19.7) | Geração de imagem remota (A1111, ComfyUI) — opcional, offline primeiro (HANDOFF §18) | servidor falso `ServerSocket` para A1111/ComfyUI |
| 7 | Mockup e upscale | teste de homografia (cantos mapeados com erro < 1 px); upscale em tiles sem costura visível |
| 8 (por último, decisão do dono em 2026-10-15) | Geração de imagem **no aparelho** (`:ai:ondevice-sd`) e troca da cadeia padrão de imagem para ela | 512² gerado no moto g86 (Dimensity 7300, 8 GB: pior caso aceitável) com tempo e RSS medidos |

## 11. O que reaproveitar da análise (como especificação, nunca como código)
- **Fluxo e telas** da foto de produto e da geração: nomes dos fragments na Sessão 3 do
  `REA_ANALISE.md` e os layouts em `reconstructed/android/src/main/res/layout/`, só como
  referência de UX.
- **Parâmetros de geração** que funcionavam: SD1.5 com ControlNet canny/scribble, "Euler a",
  ~18 passos, `inpainting_mask_invert` para gerar só o fundo, upscale após a geração. Viram os
  defaults de `Automatic1111ImageGenerator` e do modo generativo do composer.
- **Formato do texto IA**: chat-completions com `response_format: json_object`. O
  `OpenAiCompatibleTextGenerator` usa o mesmo formato, o que permite qualquer servidor compatível.
- **Lista de capabilities**: a tabela da Sessão 3 é o inventário que a §3 cobre um a um.
- **Rótulos de imagem (ML Kit Image Labeling)**: o uso no original não foi localizado. Fica fora,
  e entra se surgir uma necessidade (por exemplo, sugerir a categoria do produto).

## 12. Riscos e pontos que a implementação deve confirmar
1. **Tradução x "tudo empacotado"**: os modelos do ML Kit Translate são baixados em runtime (~30 MB
   por idioma) e não dá para empacotá-los. Padrão adotado: baixar 1x quando a tradução for
   usada. A tradução só importa para `ImageGenerator`, que já é opcional. Alternativa: um modelo
   de MT ONNX empacotado (avaliar a licença antes).
2. **Subject Segmentation depende de GMS** e está em beta desde 2023. Sem GMS, a qualidade do
   u2netp em produto precisa ser medida na fase 2. Se não bastar, usar BiRefNet-lite (MIT), que
   é maior.
3. **Gemma 4 E2B (~1,5 GB)** pede ≥ 6 GB de RAM; para aparelhos fracos, a opção é Gemma 3 1B
   (licença Gemma Terms, com AUP). A escolha é por catálogo, não por código.
4. **SD on-device**: o local-dream é CC BY-NC e não pode ser reaproveitado. É preciso
   implementar sobre ORT/MNN do zero, o que deixa esse item por último e com alto risco.
5. **MI-GAN**: o código é MIT, mas os pesos foram treinados no Places2 (termos do dataset).
   Registrar e reavaliar se o app for comercializado.
6. **APIs das bibliotecas** (ML Kit, LiteRT-LM, ORT, androidx.webkit, Keystore) não foram abertas
   nesta sessão. Cada uma deve ser conferida na doc ou no fonte antes de escrever o código (regra
   do dono). **Sessão 5:** ML Kit Subject Segmentation, ORT 1.31, u2netp, ModuleInstall e Keystore
   foram conferidos (ver §13.1). **Sessão 7:** androidx.webkit 1.17.1 e fabric 7.4.0 conferidos (§15.1).
   **Sessão 11:** LiteRT-LM 0.18.0 e ML Kit GenAI Prompt 1.0.0-beta4 conferidos (§18.2).

## 13. Execução das fases 1–2 (sessão 5, 2026-10-13)

### 13.1 APIs conferidas (AAR baixado + `javap`, ou fonte de referência)
- **ML Kit Subject Segmentation**: `com.google.android.gms:play-services-mlkit-subject-segmentation:16.0.0-beta1`
  (é a única versão no `group-index.xml` do Google Maven; minSdk do AAR = 24). `javap`:
  `SubjectSegmentation.getClient(SubjectSegmenterOptions)`; `SubjectSegmenterOptions.Builder()
  .enableForegroundConfidenceMask().build()`; `SubjectSegmenter.process(InputImage)` →
  `Task<SubjectSegmentationResult>`; `getForegroundConfidenceMask(): FloatBuffer`; o segmenter
  implementa `OptionalModuleApi` e tem `close()`. A doc oficial diz que o modelo é **baixado pelo
  Google Play services** — automático só para instalação pela Play Store (meta-data
  `com.google.mlkit.vision.DEPENDENCIES=subject_segment`); em **sideload** é preciso pedir via
  `ModuleInstallClient`. O tamanho do `FloatBuffer` não está na assinatura: o código confere
  `capacity == w*h` e lança `AiError.InvalidOutput` se não bater.
- **ModuleInstall** (`play-services-base` 18.4/18.5, `javap`): `ModuleInstall.getClient(Context)`;
  `areModulesAvailable(vararg OptionalModuleApi): Task<ModuleAvailabilityResponse>`
  (`.areModulesAvailable()`); `installModules(ModuleInstallRequest.Builder().addApi(api).build())`.
  `GoogleApiAvailability.getInstance().isGooglePlayServicesAvailable(ctx)`.
  Decisão: módulo ausente → pede instalação em segundo plano e lança `AiError.Unavailable`, o que
  faz a cadeia cair para `onnx.u2netp` nessa chamada.
- **ONNX Runtime Android** `com.microsoft.onnxruntime:onnxruntime-android:1.31.0` (latest no Maven
  Central; AAR de 55 MB, `libonnxruntime.so` arm64 = 34 MB). `javap`: `OrtEnvironment.getEnvironment()`;
  `createSession(ByteArray, OrtSession.SessionOptions)`; `OnnxTensor.createTensor(env, FloatBuffer,
  LongArray)`; `OrtSession.run(Map<String, OnnxTensorLike>): OrtSession.Result` (AutoCloseable,
  `get(Int)`); `OnnxTensor.getFloatBuffer()`; `SessionOptions.setIntraOpNumThreads`/`setOptimizationLevel`.
- **u2netp.onnx** (rembg release v0.0.0, 4 574 861 bytes, md5 `8e83ca70e441ab06c318d82300c84806` =
  o fixado no `rembg/sessions/u2netp.py`; sha256 `309c8469…c76f4ddd8`). Lido do protobuf (parser
  próprio, `onnx_io.py` no scratchpad): opset 11; entrada `input.1` float `[1,3,320,320]`; 7 saídas,
  a primeira `1959` `[1,1,320,320]` já passada por Sigmoid. Pré/pós-processamento do
  `rembg/sessions/base.py::normalize` + `u2netp.py::predict`: RGB redimensionado para 320×320,
  dividido pelo **máximo do array inteiro**, depois `(x-mean)/std` com mean (0.485,0.456,0.406)
  e std (0.229,0.224,0.225), CHW; saída `[0][:,0]` normalizada por min-max e redimensionada ao
  tamanho original. Licença do U²-Net: Apache-2.0.
- **Keystore** (`android.jar` 35, `javap`): `KeyGenParameterSpec.Builder(alias, purposes)`,
  `setBlockModes`, `setEncryptionPaddings`, `setKeySize`. Uso: AES/GCM/NoPadding, IV gerado pelo
  Keystore (`cipher.iv`), tag de 128 bits.

### 13.2 Ambiente (comandos que provaram algo)
- `emulator -list-avds`: só `lemu_api21_1gb`, `lemu_api25_2gb`, `lemu_tv_api25` — **todos abaixo
  do minSdk 28** e x86/x86_64. Baixada a imagem `system-images;android-34;google_apis_playstore;x86_64`
  para um AVD novo (`pp_api34`).
- Consequência: o build **debug** inclui também `x86_64` (para o emulador rodar o ORT); o
  **release** continua só `arm64-v8a`, como decidido.
- Python local é 3.14; `pip install onnxruntime` falhou (sem wheel/recursão) — por isso o parser
  próprio de protobuf para ler a I/O do modelo.
- Versões escolhidas pelo que já está no cache do Gradle: AGP 8.7.3, Gradle 8.10.2, Kotlin 2.0.21
  (+ plugin compose/serialization 2.0.21), compileSdk/targetSdk 35.

### 13.3 Hipóteses descartadas
- *"O módulo do ML Kit vem com a instalação"*: só pela Play Store. Em sideload, `ModuleInstallClient`.
- *"Proxy genérico `AiServices.get<T>()` por reflexão"*: `java.lang.reflect.Proxy` não lida bem com
  `suspend`. Em vez disso, `FallbackChain<T>.run { provider -> … }` e um wrapper fino por
  capability (`ChainedBackgroundRemover`). Mesmo comportamento da §4.4.
- *"`:core:ai-api` como módulo JVM puro"*: os contratos usam `Bitmap`/`RectF`/`PointF`. Fica como
  biblioteca Android; os testes JVM da cadeia usam fakes, que não instanciam essas classes.
- *"Composer escrito sobre `Bitmap`/`Canvas`"*: dificulta o teste. O `LocalSceneComposer` trabalha
  sobre `IntArray`/`FloatArray` (Kotlin puro, testável na JVM) e só converte nas bordas.
- *Config em DataStore*: no protótipo, arquivo JSON em `filesDir` atrás de uma interface
  `ProviderConfigStore`; trocar por DataStore não muda os chamadores.

### 13.4 Tasks (arquivo/símbolo → teste que prova)
1. Projeto Gradle `product_photo_offline/` com `:app`, `:core:ai-api`, `:core:imaging`,
   `:core:secrets`, `:core:models`, `:ai:mlkit`, `:ai:onnx`, `:feature:product`.
2. `:core:ai-api`: contratos da §3 usados no protótipo, `Requirement`, `ProviderFactory`,
   `ProviderRegistry`, `ProviderConfig` (+ JSON), `FallbackChain`, `ChainedBackgroundRemover`.
   → `FallbackChainTest` (requisito faltando → pula; `Network` → próximo; `Remote` → sobe;
   cancelamento propaga; registra quem atendeu) e `ProviderConfigTest` (round-trip; segredo nunca
   serializado, só o nome).
3. `:core:secrets`: `SecretStore` com formato de arquivo testável (`Aead` injetável) +
   `KeystoreAead`. → `FileSecretStoreTest` com AEAD de software.
4. `:core:models`: `ModelManager` (esqueleto), catálogo JSON, `BundledModelInstaller` (copia de
   `assets/models/`, confere SHA-256). → `ModelCatalogTest`, `Sha256Test`.
5. `:ai:onnx`: `U2netpPreprocessor` (puro) + `OnnxBackgroundRemover` + factory `onnx.u2netp`.
   → `U2netpPreprocessorTest` (normalização igual à do rembg em pixels conhecidos).
6. `:ai:mlkit`: `MlKitBackgroundRemover` + factory `mlkit.subject` (requisito `PlayServices`).
7. `:core:imaging`: `LocalSceneComposer` (§9) + utilitários (blur, resample, Lab).
   → JVM `LocalSceneComposerTest` e **instrumentado** `ComposerInstrumentedTest`
   (máscara sintética → pixels abaixo da base escurecem, acima não).
8. `:feature:product` + `:app`: fluxo categoria → foto → remover fundo/editar máscara → cenário →
   posicionar (snap no `floorY`) → compor com sliders → exportar PNG/JPG para `Pictures/`.
9. 5 cenários de teste gerados por script (`tools/gen_scenes.py`, procedural, sem modelo) →
   `assets/content/scenes/` + `SOURCES.md`.
10. Prova da fase: `assembleDebug` verde, `adb install`, 3 fotos exportadas.

### 13.5 Resultado (fases 1 e 2 concluídas em 2026-10-13)
**Provas**
- `./gradlew assembleDebug testDebugUnitTest`: verde. 35 testes JVM: `FallbackChainTest` 11,
  `ProviderConfigTest` 3, `FileSecretStoreTest` 3, `LocalModelManagerTest` 5, `SceneCompositorTest` 9,
  `U2netpTest` 4 (o `CompositorHarness` fica "skipped" sem `-PharnessDir`).
- `./gradlew :core:imaging:connectedDebugAndroidTest` (emulator-5554, API 34): `ComposerInstrumentedTest` 1/1.
  Rodado de novo depois da troca para chão por coluna: 1/1.
- `adb install` + fluxo completo pela interface, 7 exportações (PNG e JPG, 1440×1440). Amostras e
  créditos das fotos em `docs/fase2_amostras/`.
- Cadeia real observada no modo Automático: 1ª chamada → módulo ML Kit ausente → `installModules` →
  atendido por `onnx.u2netp`; logcat do GMS mostra `mlkit.segmentation.subject` instalado; chamadas
  seguintes → atendidas por `mlkit.subject`.

**O que a implementação desmentiu ou acrescentou à análise**
- *Linha de base única para as sombras* (texto da §9): não serve para objeto em 3/4. No sapato o salto
  fica ~50 px acima da ponta, a sombra saía descolada e o produto "flutuava" (medido: razão
  saída/cenário 0,9–1,0 logo abaixo do salto e 0,72 só 40 px mais abaixo). Trocado por **linha de chão
  por coluna** (contorno inferior; colunas a mais de 30% da altura acima da base herdam o chão vizinho),
  usada na sombra de contato e na projetada (projeção direta + blur por distância).
- *Máscara do u2netp usada crua*: 320 px ampliados dão borda macia e halo do fundo antigo. Acrescentado
  `U2netp.refine` (smoothstep 0,3→0,8) e, no composer, `Layer.defringe` (cor da borda vinda do interior).
- *`floorY` = horizonte do cenário*: errado; é a linha de apoio no meio do tampo (`gen_scenes.py`).
- *Luz lateral pura* esconde a sombra atrás do objeto; os cenários de teste usam luz vinda de trás
  (110°–140°, 45°), que joga a sombra para a frente.
- `sin(2π)` ≈ 1e-16 fazia a sombra de luz lateral cair para a frente: desempate por limiar, não `== 0`.
- Testes unitários Android não têm `java.awt`/`ImageIO`: o harness usa um `.raw` próprio.

**Medidas (emulador x86_64, build debug — não representam aparelho arm64)**
- Composição no desktop (harness, JVM): 0,3–1,4 s por cenário. No emulador: 2,7 s isolado; 4–20 s
  quando o `uiautomator dump` do script de teste roda junto. Recorte: u2netp 3,8–5 s isolado, ML Kit ~7 s.
- APK debug: 109 MB (duas ABIs do ORT). Release só arm64 ainda não medido.

**Pendências / desvios conscientes**
- Não testado em aparelho físico arm64 (havia um conectado, `RX8R90G1D6E`; não foi usado sem pedir).
- Câmera no passo "escolher foto" (só galeria); "abrir no editor" (fase 4); zoom no editor de máscara.
- Cenários são placeholders procedurais; `SceneLibrary` está em `:feature:product` (vai para `:data`).
- Config em arquivo JSON (não DataStore); `SCENE_COMPOSER` usa `LocalSceneComposer` direto, sem cadeia.
- `:core:models` sem download (só empacotados); `:core:secrets` só testado com AEAD de software
  (o `KeystoreAead` ainda não rodou em aparelho — nenhum provedor usa segredo até a fase 5).
- Alça de caneca: a sombra projetada trata a alça como parte do corpo (aceitável; revisar se incomodar).

**Ferramentas de ajuste**: `tools/gen_scenes.py` (cenários), `tools/harness.py` + `CompositorHarness`
(roda o composer real no desktop em ~10 s, sem emulador).


## 14. Execução da fase 3 (sessão 6, 2026-10-14)
Escopo (§10, fase 3): inpaint (MI-GAN), remover texto, imagem → SVG (VTracer via JNI), tradução.
Prova: um teste instrumentado por capability com imagem fixa.

### 14.1 APIs conferidas (fonte do crate, protobuf do modelo, ou AAR + `javap`)
- **MI-GAN** `migan_pipeline_v2.onnx` (HF `andraniksargsyan/migan`, 28 079 181 bytes, sha256
  `6f1f3530a1a2324b19752018ce756088b07973cda8d7d890034ace5c8a48c40b`, LICENSE MIT 2024 PAIR).
  Lido com o parser próprio (`onnx_io.py`): opset 17; entradas `image` uint8 `[N,3,H,W]` e `mask`
  uint8 `[N,1,H,W]`; saída `result` uint8 `[N,3,H,W]` (H/W dinâmicos). Semântica, pelo
  `scripts/create_onnx_pipeline.py::MIGAN_Pipeline.forward` e o README: imagem RGB; **máscara 255 =
  região conhecida, 0 = buraco** (o inverso do nosso `Mask`); deve ser binária. O próprio grafo
  recorta em volta do buraco (mín. 512 px + 128 px de margem), redimensiona para 512, roda, volta ao
  tamanho, mistura com borda dilatada+blur e cola no lugar. Pesos treinados no Places2 (§12.5).
- **ORT 1.31** (`javap` no AAR do cache): `OnnxTensor.createTensor(OrtEnvironment, ByteBuffer, long[],
  OnnxJavaType)`, `OnnxJavaType.UINT8`, `OnnxTensor.getByteBuffer()`.
- **ML Kit Text Recognition** `com.google.mlkit:text-recognition:16.0.1` (empacotado: modelos em
  `assets/mlkit-google-ocr-models/` + `libmlkit_google_ocr_pipeline.so` 11 MB arm64, via
  `text-recognition-bundled-common:17.0.0`; o `play-services-mlkit-text-recognition` que vem junto é
  um stub de 80 KB). `TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS)`
  (`...vision.text.latin.TextRecognizerOptions`); `TextRecognizer.process(InputImage):
  Task<Text>`, `close()`; `Text.getTextBlocks()`; `TextBlock.getText()/getLines()`;
  `Text.TextBase.getBoundingBox(): Rect` (pode ser nulo).
- **ML Kit Translate** `com.google.mlkit:translate:17.0.3` (`libtranslate_jni.so` 16 MB arm64; modelo
  de idioma baixado em runtime). `Translation.getClient(TranslatorOptions)`;
  `TranslatorOptions.Builder().setSourceLanguage(String).setTargetLanguage(String).build()`;
  `TranslateLanguage.fromLanguageTag(String): String?`; `Translator.downloadModelIfNeeded(
  DownloadConditions): Task<Void>`, `translate(String): Task<String>`, `close()`;
  `DownloadConditions.Builder().build()` (sem exigir Wi-Fi/carga).
- **ML Kit Language ID** `com.google.mlkit:language-id:17.0.6` (empacotado: `tflite_langid` +
  `liblanguage_id_l2c_jni.so` 1 MB). `LanguageIdentification.getClient().identifyLanguage(String):
  Task<String>` (`"und"` quando não identifica).
- **vtracer 0.6.5** (crates.io, MIT OR Apache-2.0; fonte em `src/`): `vtracer::convert(ColorImage,
  Config) -> Result<SvgFile, String>`; `SvgFile: Display` gera o XML completo
  (`<?xml…><svg … width height>…<path …/></svg>`). `Config` pública: `color_mode: ColorMode{Color,Binary}`,
  `hierarchical: {Stacked,Cutout}`, `filter_speckle`, `color_precision` (bits 1–8),
  `layer_difference`, `mode: PathSimplifyMode`, `corner_threshold`, `length_threshold`,
  `max_iterations`, `splice_threshold`, `path_precision`; `Config::default()` = color, stacked,
  speckle 4, precision 6, layer 16, spline. Pixels com alfa 0 viram "cor-chave" e são descartados
  (`should_key_image`). Binário: `r < 128` = preto.
  `visioncortex 0.8.8::ColorImage { pixels: Vec<u8> (RGBA, linha a linha), width, height }`.
- **jni 0.21.1** (MIT/Apache): `JNIEnv::convert_byte_array(&JByteArray) -> Result<Vec<u8>>`,
  `new_string(..) -> Result<JString>`, `JString::into_raw() -> jstring`, `throw_new(class, msg)`.

### 14.2 Ambiente (comandos que provaram algo)
- Rust instalado isolado: `rustup-init.exe -y --no-modify-path --profile minimal --default-host
  x86_64-pc-windows-gnu` com `RUSTUP_HOME=D:\DevCaches\rust\rustup`, `CARGO_HOME=D:\DevCaches\rust\cargo`
  → rustc 1.99.0; alvos `aarch64-linux-android`, `x86_64-linux-android`. PATH do sistema intocado.
- `cargo install cargo-ndk` (4.1.2) **falhou** ao compilar. Não é necessário: o Gradle chama o `cargo`
  direto com `CARGO_TARGET_<ALVO>_LINKER` = `<ndk>/…/<alvo>28-clang.cmd` (é o que o cargo-ndk faz).
- `./gradlew :ai:mlkit:dependencies` resolve só POM; os AARs só descem com `compileDebugKotlin`.

### 14.3 Hipóteses descartadas
- *"`VectorizeOptions.maxColors`"* (§3): o vtracer não limita número de cores. O contrato passa a
  expor os parâmetros reais: `colorMode`, `colorPrecision` (bits), `layerDifference`, `filterSpeckle`.
- *"Text Recognition empacotado precisa de GMS"*: não; o stub GMS vem como dependência, mas o modelo
  e o `.so` estão no AAR empacotado. Sem requisito `PlayServices`.
- *"Tradução 100% offline"*: o `.so` vem no APK, o modelo de idioma não (§12.1). Requisito dinâmico:
  se o modelo não está baixado e não há rede → `AiError.Network` (cadeia segue).
- *"Config salva no aparelho continua valendo"*: `AppProductDeps` grava `provider_config.json` ao trocar
  o modo de recorte; um arquivo salvo na fase 2 não tem as cadeias novas e o `FallbackChain` daria
  `Unavailable`. `FileProviderConfigStore.load` passa a completar capabilities ausentes com o padrão.
- *"Remover texto como provedor"*: é composição (TextDetector → máscara → Inpainter), não capability.
  Fica como `TextRemover` em `:core:imaging`, com a máscara gerada sobre `Roi` (testável na JVM, sem
  `RectF`, cujos campos ficam 0 nos testes unitários com `returnDefaultValues`).

### 14.4 Tasks (arquivo/símbolo → teste que prova)
1. `:core:ai-api` `Types.kt`: `Inpainter`, `TextBlock`, `TextDetector`, `Translator`, `ColorMode`,
   `VectorizeOptions`, `Vectorizer`; `FallbackChain.kt`: `ChainedInpainter`, `ChainedTextDetector`,
   `ChainedTranslator`, `ChainedVectorizer`. → compila; `FallbackChainTest` continua verde.
2. `:ai:onnx` `MiGan.kt` (pré/pós puro: RGBA → NCHW uint8, máscara invertida e binarizada) +
   `MiGanInpainter` + factory `onnx.migan`; modelo em `assets/models/` + `models.json`.
   → `MiGanTest` (JVM: inversão/binarização, layout NCHW) e **instrumentado** `MiGanInstrumentedTest`
   (saída do mesmo tamanho; fora do buraco igual; dentro do buraco a cor do quadrado some).
3. `:ai:mlkit` `MlKitTextDetector` (`mlkit.text-bundled`) e `MlKitTranslator` (`mlkit.translate`, idioma
   detectado pelo Language ID quando `from == null`). → **instrumentados** `TextDetectorInstrumentedTest`
   (texto desenhado → bloco com o texto e caixa dentro da área) e `TranslatorInstrumentedTest`
   (pt → en; detecção automática), este com rede no emulador.
4. `:core:imaging` `TextMasks.fromBoxes` + `TextRemover`. → `TextMasksTest` (JVM: dilatação, recorte
   na borda) e, no `:app`, **instrumentado** `RemoveTextInstrumentedTest` pelas cadeias reais
   (máscara não vazia; texto some: OCR depois não acha o texto).
5. `:ai:vtracer`: crate `rust/` (`vtracer` 0.6.5 + `jni` 0.21.1, `cdylib`), tarefa Gradle `cargoBuild`
   por ABI (debug: arm64 + x86_64; release: arm64) → `jniLibs`; `VTracerVectorizer` + factory `vtracer`.
   → **instrumentado** `VectorizerInstrumentedTest` (SVG válido pelo `XmlPullParser`, com `<path>`,
   width/height iguais à imagem; binário e colorido).
6. `:app`: registrar as factories, cadeias padrão da §4.4, `FileProviderConfigStore.load` com merge.
   → `assembleDebug testDebugUnitTest` verde; `connectedDebugAndroidTest` dos módulos no emulator-5554.
Sem UI nova nesta fase: os fluxos de remover objeto/texto e SVG passam pelo editor (fase 4).

### 14.5 Resultado (fase 3 concluída em 2026-10-14)
**Provas**
- `./gradlew assembleDebug testDebugUnitTest`: verde. 38 testes JVM (fase 2: 35 → +`MiGanTest` 3, +`TextMasksTest` 3;
  o `CompositorHarness` continua "skipped").
- Instrumentados no emulator-5554 (API 34, x86_64), todos verdes:
  - `:ai:onnx` `MiGanInstrumentedTest` 2/2: quadrado vermelho preenchido com o fundo, fora do buraco
    idêntico, máscara vazia devolve a imagem (15 s com cópia do modelo e criação da sessão).
  - `:ai:mlkit` `TextDetectorInstrumentedTest` 2/2 (0,7 s) e `TranslatorInstrumentedTest` 3/3
    (pt→en; idioma detectado; mesmo idioma). O primeiro leva 25 s: download do modelo pt↔en.
  - `:ai:vtracer` `VectorizerInstrumentedTest` 3/3: SVG aceito pelo `XmlPullParser`, width/height da
    imagem, cores, modo binário com 1 path, fundo transparente fora do SVG.
  - `:app` `Phase3InstrumentedTest` 2/2: remover texto pelas cadeias reais (atendido por `onnx.migan` e
    `mlkit.text-bundled`; depois do inpaint o OCR não acha mais o texto; 8 s) e merge da config antiga.
- `adb install` + abrir o app: sem crash (`am start` ok).

**O que a implementação desmentiu ou acrescentou**
- `cargo-ndk` não compilou; o Gradle chama o `cargo` com o `clang.cmd` do NDK como linker e funciona
  (Rust 1.99 aceita `.cmd` como linker no Windows). `androidComponents.sdkComponents.ndkDirectory` não
  tem valor nesse ponto; `android.ndkDirectory` + `ndkVersion = "27.0.12077973"` explícito resolve.
- Build do Rust: ~2,5 min por ABI na primeira vez; depois a tarefa fica UP-TO-DATE (entradas: `rust/src`,
  `Cargo.toml`, `Cargo.lock`). `libvtracer_jni.so`: 408 KB arm64, 461 KB x86_64. Ligado com páginas de 16 KB.
- No modo binário do vtracer, pixel transparente (0,0,0,0) conta como preto (`r < 128`): para logo com
  fundo transparente, usar o modo cor (o fundo transparente é descartado). Teste cobre os dois.
- Máscara do "remover texto" usa as caixas das **linhas** (a do bloco apagaria o fundo entre linhas),
  dilatadas 20% da altura (mín. 3 px).

**Medidas de tamanho**
- APK debug (arm64 + x86_64): 191 MB. **Release só arm64: 116 MB** (`assembleRelease`).
- Por item (arm64): ORT 32,6 MB; MI-GAN 26,8 MB; tradução `.so` 15,6 MB; OCR `.so` 10,6 MB + ~1,5 MB de
  modelos; u2netp 4,4 MB; language-id 1 MB; vtracer 0,4 MB. Os modelos de idioma da tradução (~30 MB por
  par) ficam fora do APK, baixados no primeiro uso.

**Pendências / desvios conscientes**
- Sem UI para estas capabilities: remover objeto/texto e SVG entram pelo editor (fase 4); tradução, pela
  geração de imagem (fase 6). Hoje só há os objetos no `AppGraph` (`inpainter`, `textDetector`,
  `translator`, `vectorizer`, `textRemover`).
- MI-GAN sem limite de resolução: o grafo recebe a imagem inteira (uint8, 3 B/pixel) e recorta sozinho;
  numa foto de 12 MP são ~36 MB de entrada + saída. Medir RAM/tempo em aparelho arm64 (ainda não testado).
- Tradução: sem tela para gerir/apagar modelos de idioma baixados; `Translator` do ML Kit não é fechado
  (um cliente por par, vive com o app).
- Continua sem teste em aparelho físico arm64 (`RX8R90G1D6E` conectado, não usado sem pedir).
- MI-GAN: pesos Places2 (§12.5), registrado no `models.json`.
- Toolchain Rust do build: `local.properties` `rust.home=D:/DevCaches/rust` (fora do git); outra máquina
  precisa de rustup + alvos `aarch64-linux-android x86_64-linux-android`.

## 15. Execução da fase 4 (sessão 7, 2026-10-14)
Escopo (§10, fase 4): editor web Fabric.js + ponte + templates + brand kit + rascunhos + exportação.
Prova: vitest do `editor-web` (serialização, brand kit); teste instrumentado da ponte (mensagem → resposta);
exportar PNG/SVG pelo app.

### 15.1 APIs conferidas (AAR + `javap` + `-sources.jar`; pacote npm + fonte TS)
- **androidx.webkit 1.17.1** (última estável no `group-index.xml`; `aar-metadata`: minCompileSdk 33,
  minSdk 24; deps: core 1.1.0, annotation 1.8.1, annotation-experimental 1.3.0, jspecify).
  - `WebViewAssetLoader.Builder().setDomain(String).setHttpAllowed(Boolean).addPathHandler(String, PathHandler).build()`;
    `DEFAULT_DOMAIN = "appassets.androidplatform.net"`; `shouldInterceptRequest(Uri): WebResourceResponse?`
    (`@WorkerThread`; o 1º handler cujo prefixo casa e devolve não-nulo atende; o sufixo é o path sem o prefixo).
  - `AssetsPathHandler(Context)`: asset ausente → `WebResourceResponse(null,null,null)` **não-nulo** (corpo vazio;
    não passa para o próximo handler). `InternalStoragePathHandler(Context, File)`: só abaixo de `cacheDir`/`dataDir`,
    proíbe `app_webview/ databases/ lib/ shared_prefs/ code_cache/`; o caminho canônico precisa ser filho do diretório.
  - MIME por `URLConnection.guessContentTypeFromName` e depois tabela própria: js/mjs `text/javascript`, json,
    css, html, svg, webp, png, woff `application/font-woff`; **ttf/otf/woff2 não estão na tabela** → `text/plain`
    (o Chromium não exige MIME de fonte; confirmar no teste instrumentado). A resposta tem `Cache-Control`, sem CORS.
  - `WebViewCompat.addWebMessageListener(WebView, jsObjectName, Set<String> originRules, WebMessageListener)`
    (`@UiThread`; exige `WebViewFeature.isFeatureSupported(WEB_MESSAGE_LISTENER)`; injeta o objeto global em
    toda navegação **posterior** à chamada, disponível já no início do carregamento). Regra de origem
    `https://appassets.androidplatform.net`. JS: `obj.postMessage(String|ArrayBuffer)`, `obj.onmessage = e => e.data`
    ou `obj.addEventListener("message", …)`. O Kotlin só responde depois que o JS falou primeiro
    (`JavaScriptReplyProxy.postMessage(String)`, 1 proxy por frame, `@UiThread`; `postMessage(ByteArray)` exige
    `WEB_MESSAGE_ARRAY_BUFFER`). `WebMessageListener.onPostMessage(view, WebMessageCompat, sourceOrigin, isMainFrame, replyProxy)`
    é `@UiThread`; `WebMessageCompat.getType()/getData()/getArrayBuffer()`.
- **fabric 7.4.0** (MIT; `exports["."]` = `dist/index.min.mjs`; `canvas`/`jsdom` só opcionais, para `fabric/node`).
  - `StaticCanvas.toObject(propertiesToInclude?)`; `toJSON()` = `toObject()`; `loadFromJSON(json, reviver?, {signal})`
    → `Promise<this>` (limpa e adiciona; não renderiza: chamar `requestRenderAll`). Propriedades próprias:
    `FabricObject.customProperties: string[]` (estático) entra em todo `toObject`.
  - `toDataURL({multiplier, format: png|jpeg|webp, quality})`, `toBlob(idem) → Promise<Blob|null>`,
    `toCanvasElement(multiplier, {left,top,width,height,filter})`; `toSVG(options, reviver)`.
  - SVG: a imagem sai como `xlink:href = getSrc(true)` → **URL absoluta** do `<img>` (sem filtro) ou dataURL (com
    filtro); fontes só entram via `config.addFonts({família: url})` (`@font-face src:url(...)`). Para um SVG portátil,
    trocar as URLs por dataURL.
  - `FabricImage.fromURL(url, {crossOrigin, signal}, props)`, `image.setSrc(url)`; `loadSVGFromString(str)` →
    `{objects, options}`; `util.groupSVGElements(objects, options)` (1 objeto → ele mesmo).
  - Filtros (`filters.*`): Brightness, Contrast, Saturation, Vibrance, Blur, Grayscale, Invert, Noise, Pixelate,
    HueRotation, Gamma, ColorMatrix (Sepia/Vintage/... em `ColorMatrixFilters`), BlendColor, RemoveColor;
    `image.filters = [...]; image.applyFilters()`.
  - Texto: `FabricText/IText/Textbox`; texto em curva = propriedade `path` (um `Path`) + `pathSide`/`pathAlign`.
    `Shadow`, `Gradient`, `Pattern`; pincéis `PencilBrush` etc. com `canvas.isDrawingMode`/`freeDrawingBrush`.
  - Camadas: `bringObjectToFront/sendObjectToBack/bringObjectForward/sendObjectBackwards` (Collection).
  - Crop: `fabric/extensions` → `enterCropMode`/`createImageCroppingControls` (exemplo; mantemos estado próprio).
- **Ferramentas** (publicadas há > 2 semanas): vite 8.3.1, vitest 5.0.2 (peer vite ^6–^8; node ^22.12/^24),
  typescript 6.0.3. Node local 24.19.0, npm 11.17.0.
- **androidx.print 1.0.0** (já no cache do Gradle): `PrintHelper(ctx).printBitmap(jobName, Bitmap)`.

### 15.2 Decisões da fase
- **Protocolo**: envelope JSON `{v:1, id, type, payload}`; resposta `{v:1, id, type:"result", ok, payload|error}`;
  progresso `{v:1, id, type:"progress", payload:{fraction, stage}}`; mensagens iniciadas pelo Kotlin (`loadProject`,
  `insertImage`, `applyBrandKit`) vão pelo último `replyProxy` (o JS manda `hello` ao carregar).
- **Imagens Kotlin → JS** por URL `https://appassets.androidplatform.net/blob/<id>.png` (arquivos em
  `filesDir/editor/blobs`, `InternalStoragePathHandler`). **JS → Kotlin** (máscara, exportação, miniatura):
  dataURL base64 no JSON — o WebView não entrega corpo de POST ao `shouldInterceptRequest`, e ArrayBuffer exigiria
  um segundo quadro fora do envelope. Medir o custo na exportação grande.
- O JS manda a **URL** da imagem para as ações de IA; o Kotlin resolve `/blob/<id>` ou `/assets/...` sem
  receber pixels.
- **Room → arquivos JSON** (`:data`): rascunhos (`filesDir/drafts/<id>.json` + miniatura) e brand kit
  (`brandkit.json`) atrás de interfaces, como a config de provedores (§13.3). Sem KSP/Room no build.
- **Templates/stickers/fundos feitos por nós** (JSON do Fabric e SVG escritos à mão); **miniaturas renderizadas
  no próprio editor** (StaticCanvas), não empacotadas. Fontes: famílias OFL do repositório google/fonts, com o
  `OFL.txt` de cada uma.
- Brand kit no template: propriedades próprias `brandColor` (`primary|secondary|accent|text|background`, aplicada
  em `fill`), `brandStroke` (idem, em `stroke`), `brandFont` (`heading|body`), `brandLogo` (imagem trocada pelo
  logo) e variáveis `{{company}}`, `{{phone}}`, `{{email}}`, `{{website}}`, `{{address}}`, `{{slogan}}` no texto.
- `ai.rewriteText`/`ai.upscale` ficam no protocolo e respondem erro `unsupported` até as fases 5/7.

### 15.3 Hipóteses descartadas
- *Testar o editor com Fabric no Node*: `fabric/node` precisa de `canvas` (nativo) + `jsdom`. A lógica testável
  (protocolo, documento/versão, brand kit, histórico, SVG portátil) fica em módulos sem Fabric, sobre o JSON;
  o comportamento do canvas é provado pelo teste instrumentado no WebView real.
- *`fetch` POST interceptado para subir imagens*: `shouldInterceptRequest` não expõe o corpo.
- *Miniaturas de template empacotadas*: renderizar no PC exigiria Fabric + canvas nativo; o editor já renderiza.

### 15.4 Tasks (arquivo/símbolo → teste que prova)
1. `editor-web/` (TS + Vite + fabric 7.4.0): `protocol.ts` (envelopes, validação), `document.ts`
   (formato `pp-editor` v1, migração), `brandkit.ts` (aplicar kit no JSON), `history.ts` (undo/redo),
   `svgExport.ts` (inline de imagens/fontes), `bridge.ts` (transporte `AppBridge`), `editor.ts` + `ui.ts`
   (canvas e painéis). → `vitest`: protocolo, documento, brand kit, histórico, SVG portátil. Build →
   `:editor/src/main/assets/editor/`.
2. `:data`: `DraftRepository`/`FileDraftRepository`, `BrandKit` + `FileBrandKitRepository`, `BlobStore`.
   → JVM `FileDraftRepositoryTest`, `BrandKitRepositoryTest` (round-trip).
3. `:editor`: `EditorAssetLoader` (assets + blobs + fontes do usuário), `EditorBridge` (envelopes, handlers
   tipados, progresso, erro), `EditorWebView` (Compose `AndroidView`), handlers de IA sobre `:core:ai-api`.
   → JVM `EditorProtocolTest`; **instrumentado** `EditorBridgeInstrumentedTest` (página real dos assets:
   `hello` → `loadProject` → JS responde; `ai.*` com fakes → resultado; erro tipado).
4. `assets/content/`: templates, stickers, fundos, fontes OFL + `index.json` + `SOURCES.md`.
5. `:app`: Home (Foto de produto, Novo design, Templates, Rascunhos, Brand kit), tela do editor, "abrir no
   editor" no resultado da foto de produto, exportar (galeria/compartilhar/imprimir).
   → `assembleDebug testDebugUnitTest` verde; exportar PNG e SVG pelo app no emulador (arquivos conferidos).


### 15.5 Resultado (fase 4 concluída em 2026-10-14)
**Provas**
- `editor-web`: `npx tsc --noEmit` limpo; `npx vitest run` **18/18** (protocolo + ponte em memória 6, documento 4,
  brand kit 5, histórico 2, SVG portátil 1); `npx vite build` → 337 KB de JS + 5 KB de CSS
  em `editor/src/main/assets/editor/`.
- `./gradlew assembleDebug testDebugUnitTest`: verde, **55 testes JVM** (fase 3 + `FileDraftRepositoryTest` 3,
  `BrandKitRepositoryTest` 3, `EditorProtocolTest` 7; o `CompositorHarness` continua "skipped").
- Instrumentados no AVD `pp_api34` (API 34, x86_64), verdes:
  - `:editor` `EditorBridgeInstrumentedTest` **4/4** — WebView real + `addWebMessageListener` + página dos assets, IA falsa:
    Kotlin pede → JS responde (`loadProject`, `getDocument` com propriedade própria preservada, erro `unsupported`);
    JS pede → Kotlin responde (fluxo "Remover fundo" da interface troca a imagem por `/blob/ai-…` com alfa certo; erro
    tipado `unavailable` da cadeia e `invalid` para máscara que não decodifica; `ai.vectorize`); exportação PNG 2× exata
    (800×600, pixel do retângulo vermelho) e SVG sem URL do asset loader; `flush` grava rascunho + miniatura; `export`
    chega ao host com os bytes.
  - `:app` `EditorExportInstrumentedTest` **1/1** — conteúdo real: template `promo-quadrado` + brand kit (variável e cor
    `primary` aplicadas), fontes servidas como `text/plain` carregam (`document.fonts.check` e `status == loaded`), PNG
    1080×1080, SVG com `@font-face` em `data:font/ttf` e XML válido, gravação real em `Pictures/ProductPhoto/` (PNG) e
    `Download/ProductPhoto/` (SVG) conferida no MediaStore. `Phase3InstrumentedTest` 2/2 continua verde.
- Pela interface no emulador: Home → Modelos (miniaturas renderizadas no editor, com as fontes) → "Promoção" → seleção
  de texto com painel → Exportar → "Salvar na galeria" gravou `Pictures/ProductPhoto/Promoção_20261014_172936.png`
  (108 KB, 1080×1080, conferido visualmente).
- APK **release (só arm64): 124,3 MB** (fase 3: 116 MB; editor + fontes + templates = 4,7 MB). Debug: 204 MB.

**O que a implementação desmentiu ou acrescentou**
- **WebView no Compose com altura 0**: o `AndroidView` cria a view com `LayoutParams` WRAP_CONTENT e o WebView passa a usar
  a altura do conteúdo como viewport → `body` com 0 px (medido: viewport 411×841, body 0). Os testes não pegaram (WebView
  fora de janela). Correção: `layoutParams = MATCH_PARENT` no `factory` do `EditorScreen`.
- **Exportação com o zoom da tela**: `multiplier = escala/zoom` herdava o arredondamento do tamanho do elemento (800×608 em
  vez de 800×600). Agora a página é renderizada com viewport identidade e `multiplier = escala` (`Editor.renderPage`).
- **Rascunho no `flush`**: a última edição ainda estava no debounce de 250 ms do histórico; `flush` força o instantâneo
  (`Editor.flushPending`).
- **`fabric/extensions`** importa `westures` (dependência não declarada): alias para um stub vazio no Vite (a integração de
  gestos não é usada; só os controles de recorte).
- Fabric 7: origem padrão dos objetos é o **centro**; `obj.type` em instância é minúsculo (`'image'`), no JSON é a classe
  (`'Image'`). Os templates (`tools/gen_content.py`) usam `left/top` como centro.
- **MIME das fontes**: confirmado que `text/plain` do asset loader não impede o `FontFace` do Chromium; no SVG o
  `browserFetcher` reetiqueta como `font/ttf`.
- `evaluateJavascript` devolve o valor já codificado em JSON (string do `JSON.stringify` vem entre aspas): dois parses no teste.
- Depuração: `WebView.setWebContentsDebuggingEnabled(true)` só em build depurável; o socket de DevTools não apareceu no
  emulador (não investigado; o log temporário de layout pelo console resolveu).

**Pendências / desvios conscientes**
- **Não verificado pela interface** (só por código e/ou teste): seletor de imagem e de fonte do sistema, compartilhar e
  imprimir, recorte, pincel de "remover objeto", filtros, texto em curva, Camadas, tela de Rascunhos, tela de Brand kit,
  "Abrir no editor" a partir da foto de produto. O emulador foi encerrado fora da sessão no meio dessa verificação.
- Rascunhos e brand kit em arquivos JSON (`:data`), não Room (§15.2); `SceneLibrary` continua em `:feature:product`.
- Ações de IA sem UI de seleção de provedor no editor; `ai.rewriteText`/`ai.upscale` respondem `unsupported` (fases 5/7).
- Sem pinça/zoom na página (só "caber na tela"); objetos fora da página ficam cortados na tela.
- Miniaturas de template são renderizadas a cada abertura da galeria (8 templates: rápido no emulador; medir com 100).
- Exportação grande trafega como dataURL base64 (SVG do template: 1,7 MB, quase tudo fontes embutidas); medir em aparelho
  com 3× de um A3.
- O teste `EditorExportInstrumentedTest` deixa `teste_fase4_*.png/.svg` na galeria do emulador.
- Cache do Gradle corrompido após o encerramento abrupto: apagar `~/.gradle/caches/8.10.2/transforms/<hash>` resolve.
- Continua sem teste em aparelho físico arm64.

**Para a §16 (sessão 8), que esperava esta seção fechar:** já existe **um** `FileProvider`, declarado no manifesto do
`:editor` (`authorities="${applicationId}.editor.files"`, `res/xml/editor_file_paths.xml` com `cache-path exports/`).
A câmera deve acrescentar o caminho dela nesse mesmo XML (ou mover provider + XML para o `:app` e ajustar
`EditorExports.share`), sem um segundo `<provider>`. "Abrir no editor" já está em `ProductFlowScreen.ResultStep` +
`ProductFlowDeps.openInEditor` (implementado em `AppProductDeps` com o `Navigator`); `AppGraph` ganhou o bloco do editor.

## 16. Câmera, zoom no editor de máscara e download de modelos (análise na sessão 8, 2026-10-14)
Pedido do dono depois da fase 2: câmera, "abrir no editor", zoom no editor de máscara e download de modelos.
**"Abrir no editor" saiu deste escopo**: é a task 5 da §15 (sessão 7, em andamento), com o editor próprio
completo. O dono escolheu "editor próprio mínimo" sem saber que a fase 4 já estava em execução; esta seção
não toca em editor. Modelo baixável escolhido pelo dono: **BiRefNet-lite**.

**Coordenação com a sessão 7**: as duas mexem em `ProductFlowScreen.kt`, `AppGraph.kt` e `AndroidManifest.xml`
(a §15 prevê compartilhar, que usa `FileProvider`). Implementar esta seção **depois** que a fase 4 fechar
(§15.5), reaproveitando o `FileProvider` dela se existir (um só `<provider>`, um só `file_paths.xml`).

### 16.1 APIs e fatos conferidos
- **Câmera**: `ActivityResultContracts.TakePicture` (activity 1.9.3, `javap`) é `ActivityResultContract<Uri, Boolean>`;
  a câmera grava no `Uri` que passamos. `FileProvider.getUriForFile(Context, String, File)` (core 1.15.0).
  O manifest mesclado do debug (`app/build/intermediates/merged_manifest/debug/...`) **não tem `CAMERA`**:
  com a permissão ausente, `ACTION_IMAGE_CAPTURE` não exige concessão. Se alguma lib passar a declarar
  `CAMERA`, o intent lança `SecurityException`: conferir o manifest mesclado depois de cada dependência nova.
- **Zoom**: foundation 1.8.2 (`javap`) tem `awaitEachGesture`, `calculateZoom`, `calculatePan`,
  `calculateCentroid(PointerEvent, Boolean)` e `detectTransformGestures`.
- **BiRefNet-lite**: `rembg/sessions/birefnet_general_lite.py` (main) aponta para
  `https://github.com/danielgatis/rembg/releases/download/v0.0.0/BiRefNet-general-bb_swin_v1_tiny-epoch_232.onnx`,
  md5 fixado `4fab47adc4ff364be1713e97b7e66334` (desde 2024-08-26, mesma data do upload do asset).
  Arquivo: **224 005 088 bytes**, sha256 `5600024376f572a557870a5eb0afb1e5961636bef4e1e22132025467d0f03333`,
  produtor pytorch 2.0.1, opset 17. I/O lida do protobuf: `input_image` float [1,3,1024,1024] → `output_image`
  [1,1,1024,1024]. Pré/pós (`birefnet_general.py::predict` + `base.py::normalize`): 1024×1024, divisão pelo
  máximo global, mean (0.485,0.456,0.406) / std (0.229,0.224,0.225), CHW; a saída vem **sem sigmoid** (o rembg
  aplica `sigmoid`), depois min-max e resize. Licença: MIT (BiRefNet).
- **O servidor aceita Range**: `curl -r 0-99` → 302 → `206 Partial Content`, `Content-Range: bytes 0-99/224005088`,
  `Accept-Ranges: bytes`. Download retomável é viável (o redirect vai para outro host: segui-lo a cada retomada).
- **WorkManager** `androidx.work:work-runtime:2.10.5` (minCompileSdk 35 = nosso compileSdk; a 2.11.x exige
  AGP ≥ 8.6, também serviria, mas a 2.10.5 basta). `javap`: `CoroutineWorker(Context, WorkerParameters)`,
  `doWork()`, `setProgress(Data)`; `WorkManager.getInstance(Context)`,
  `enqueueUniqueWork(String, ExistingWorkPolicy, OneTimeWorkRequest)`, `cancelUniqueWork`,
  `getWorkInfosForUniqueWorkFlow(String): Flow<List<WorkInfo>>`; `WorkInfo.getState/getProgress/getOutputData`;
  estados `ENQUEUED RUNNING SUCCEEDED FAILED BLOCKED CANCELLED`. As APIs Kotlin já estão no `work-runtime`
  (`CoroutineWorker` e o `Flow` aparecem no `javap` dele); não adicionar `work-runtime-ktx`.

### 16.2 Comandos que provaram algo
- O download interrompido pelo fim da sessão deixou um arquivo com o **tamanho certo e bytes errados**
  (md5 `c5cd39…`): trechos de 1 MB comparados por `Range` batem até ~112 MB e divergem a partir de 180 MB.
  Rebaixado, o md5 bateu com o do rembg. **Conclusão para o código: o tamanho não prova nada; o SHA-256 é
  obrigatório e o `.part` só vira o arquivo final depois de conferido** (o `LocalModelManager` já faz isso para
  o modelo empacotado).

### 16.3 Hipóteses descartadas / riscos
- *Retomar sempre do tamanho do `.part`*: o caso acima mostra que o `.part` pode ter lixo no fim se o processo
  morrer no meio de uma escrita. Retomar do tamanho continua sendo o padrão (é rápido); se o SHA-256 final
  falhar, **apagar e baixar do zero uma vez**, e só então falhar com `Corrupt`.
- *`Requirement.MinRamMb` com `Runtime.maxMemory()`* (`AppGraph.checker`): isso mede o heap Java, não a RAM do
  aparelho, e o ORT aloca fora do heap. Trocar por `ActivityManager.MemoryInfo.totalMem`. O BiRefNet-lite fp32
  a 1024² deve pedir ~1–1,5 GB de pico (medir); no catálogo, `minRamMb` 4096 até medir.
- *Foreground service no download*: exigiria `FOREGROUND_SERVICE_DATA_SYNC` + notificação (API 34), então fica
  fora. Sem foreground o WorkManager pode parar o trabalho (limite de ~10 min), e a retomada por `Range` cobre
  isso (`Result.retry()` com backoff).
- *Ler o modelo inteiro em memória* (`createSession(ByteArray)`): seriam 224 MB no heap. Usar
  `createSession(path)`, como o u2netp já faz.
- *Rotação EXIF da foto da câmera*: o `decode` usa `ImageDecoder`, que deve aplicar a orientação EXIF, mas isso
  **não foi conferido**; o teste da task 1 prova (uma foto em retrato precisa chegar em pé).

### 16.4 Tasks (arquivo/símbolo → teste que prova)
1. **Câmera**: em `feature/product/.../ProductFlowScreen.kt::CategoryStep`, botão "Tirar foto" com
   `rememberLauncherForActivityResult(TakePicture())`. `ProductFlowDeps` ganha `fun newCaptureUri(): Uri`
   (implementado em `AppProductDeps`: arquivo em `cacheDir/capture/`, `FileProvider` com authority
   `<applicationId>.files`). Sucesso → `vm.onImagePicked(uri)` (o mesmo caminho da galeria). Manifest:
   `<provider androidx.core.content.FileProvider>` + `res/xml/file_paths.xml` (`cache-path capture/`),
   **unificado com o da §15** se já existir. → manual no emulador (câmera virtual): a foto chega ao recorte, em pé.
2. **Zoom no editor de máscara**: em `ProductFlowScreen.kt::MaskStep`, estado `zoom`/`offset` sobre o `Fit`;
   com `awaitEachGesture`, 1 dedo pinta (como hoje) e 2 dedos fazem pan/zoom (`calculateZoom`, `calculatePan`,
   `calculateCentroid`), zoom de 1× a 8×, duplo toque volta a 1×. A conversão tela→imagem e o raio do pincel
   (`brushDp / (fit.scale*zoom)`) passam a usar o zoom. A matemática vai para `MaskViewport` (puro).
   → JVM `MaskViewportTest` (tela→imagem com zoom/pan; zoom ancorado no centróide mantém o ponto sob os dedos;
   limites); manual: pinçar e pintar um detalhe.
3. **Download de modelos**: em `core/models/.../ModelManager.kt`, `ModelDownloader` (puro: HTTP com `Range`,
   SHA-256 em streaming, `.part` → final, regra de 16.3) e `ModelManager.download(id)`/`cancel(id)`/
   `states(): Flow`. `ModelDownloadWorker : CoroutineWorker` (em `:app`, ou em `:core:models` com a dependência
   `work-runtime:2.10.5`), unique work `model-<id>`, progresso por `setProgress`, `Result.retry()` em erro de
   rede, `ModelState.Corrupt` com hash errado depois da 2ª tentativa; checa espaço livre (tamanho × 1,2, §5).
   → JVM `ModelDownloaderTest` com servidor local (`com.sun.net.httpserver.HttpServer` do JDK, sem dependência
   nova): download completo; retomada a partir do `.part` (o servidor confere o `Range`); hash errado → apaga e
   refaz; 2ª falha → `Corrupt`; sem espaço → erro antes de baixar.
4. **BiRefNet-lite como provedor**: `ai/onnx/.../BiRefNet.kt` (pré/pós puro: 1024, sigmoid, min-max) +
   `OnnxBiRefNetRemover` + `OnnxBiRefNetFactory` com id `onnx.birefnet-lite`, requisitos `Model("birefnet-lite")`
   e `MinRamMb(4096)`. No catálogo `app/src/main/assets/models/models.json`, entrada sem `bundledAsset`, com a URL
   e o sha256 de 16.1. `AppGraph.checker` passa a usar `totalMem` (16.3). `RemoverMode` ganha
   "BiRefNet (baixado)", que não entra no Automático até medir tempo/RAM em arm64.
   → JVM `BiRefNetTest` (normalização, sigmoid, min-max); instrumentado com o modelo baixado no emulador:
   máscara não vazia e comparação visual com o u2netp na foto do sapato, registrada em `docs/`.
5. **Tela "Modelos"**: lista do catálogo com estado (`NotDownloaded`/`Downloading p`/`Ready`/`Corrupt`),
   tamanho, licença e ações baixar/cancelar/remover. Fica nos Ajustes da Home da §15 (task 5); se a Home ainda
   não existir, chip "Modelos" no `CategoryStep`. → manual no emulador: baixar o BiRefNet-lite, matar o app no
   meio, reabrir → retoma (log com `Range: bytes=N-`) e termina `Ready`; recorte com BiRefNet no fluxo.

## 17. Execução da §16 (sessão 9, 2026-10-14)
Tasks 1–5 da §16.4. A análise da §16 continua valendo; aqui ficam o que foi aberto nesta sessão, as decisões
de implementação e as provas.

### 17.1 Símbolos abertos e o que se descobriu
- `ProductFlowScreen.kt::CategoryStep` — só `PickVisualMedia` → `vm.onImagePicked(uri)`. `::MaskStep` — `Fit`
  privado no arquivo; `detectDragGestures(onDragStart = paintAt)` (toque sem arrastar **não** pinta hoje);
  `paintAt` converte com `fit` e raio `brushDp.dp.toPx() / fit.scale`.
- `ProductFlowViewModel.kt` — `ProductFlowDeps` só é implementado por `AppProductDeps` (grep); `RemoverMode`
  tem AUTO/MLKIT/U2NETP; erros do recorte viram `message` (`AiError.Unavailable` → lista de requisitos crua).
- `AppProductDeps::removerMode/setRemoverMode` — mapeia a cadeia salva ↔ modo (lista exata).
- `AppGraph::checker` — `Requirement.Model` atendido se `Ready` **ou** se há `bundledAsset` (o BiRefNet, sem
  asset, só passa quando baixado); `MinRamMb` usa `Runtime.maxMemory()` (corrigir, §16.3).
- `FallbackChain::run` — guarda a instância por entrada até `invalidate()`; requisito não atendido = pula.
- `ModelManager.kt::LocalModelManager` — arquivo final `root/<id>/<file>` + marcador `.verified-<sha>`;
  `state` = Ready só com marcador e tamanho certo; `ensureReady` sem `bundledAsset` devolve null se não Ready.
- `OnnxBackgroundRemover` — `createSession(path)`, `Bitmap.createScaledBitmap` para o tamanho do modelo,
  `result.get(0)`; erro do ORT → `AiError.Unavailable`.
- `U2netp.preprocess` — a mesma normalização que o BiRefNet usa (§16.1): reaproveitar com tamanho parametrizado.
- `:editor` `AndroidManifest.xml` — o único `FileProvider`, authority `${applicationId}.editor.files`,
  XML `editor_file_paths.xml` (`cache-path exports/`); `EditorExports.share` usa `"${packageName}.editor.files"`.
- `HomeScreen` — cartões, **sem** tela de Ajustes; `Navigator.Screen` é sealed, `MainActivity::AppNavigation` faz o `when`.
- `:core:ai-api` exporta `coroutines-core` e `serialization-json` como `api` (o `:core:models` já os tem).
- AVD `pp_api34`: `hw.ramSize=2G`, `hw.camera.back=emulated`. SDK em `D:/DevCaches/Android/Sdk`.
- Cache do Gradle tem `work-runtime` só 2.9.0; a 2.10.5 será baixada.
- Cópia do modelo: scratchpad da sessão 8, `dl_birefnet/birefnet_lite_2.onnx` (224 005 088 bytes) ainda existe.

### 17.2 Decisões de implementação
- **FileProvider**: um só. Acrescentar `cache-path capture/` ao `editor_file_paths.xml` e usar a authority que
  já existe (`<packageName>.editor.files`), em vez de `<applicationId>.files` da §16.4 (evita mexer no
  `EditorExports`). O nome "editor" na authority fica como está.
- **Câmera**: `ProductFlowDeps.newCaptureUri()` (arquivo novo em `cacheDir/capture/`, apaga os antigos);
  o `Uri` pendente fica em `rememberSaveable`; sem app de câmera (`ActivityNotFoundException`) → mensagem.
- **Máscara**: `Fit` sai do arquivo da tela para `MaskViewport.kt` (internal), junto com `MaskViewport(zoom,
  offsetX, offsetY)`: tela = offset + zoom·(fit.left + fit.scale·img); zoom ancorado no centróide; offset
  limitado a `[tam·(1−zoom), 0]` (a página sempre cobre o canvas com zoom ≥ 1). Gesto: até passar o
  `touchSlop` com 1 dedo nada é pintado (como hoje); passou → pinta desde o ponto inicial; 2º dedo → só
  pan/zoom até soltar tudo; toque duplo sem arrastar → zoom 1×.
- **Download** (`:core:models`): `ModelDownloader` puro (`HttpURLConnection`, **redirect seguido à mão** para
  reenviar o `Range` a cada salto, sem depender do comportamento do redirect automático); `.part` retomado
  pelo tamanho (o digest é semeado relendo o `.part`); 200 em vez de 206 → recomeça do zero; hash errado →
  apaga e baixa do zero **uma** vez → 2ª falha `DownloadFailure.Corrupt`; espaço livre < (tamanho − já baixado)
  × 1,2 → `DownloadFailure.NoSpace` antes de qualquer byte; HTTP 4xx → `DownloadFailure.Http` (permanente);
  outros `IOException` → transitórios. Cancelamento por coroutine mantém o `.part`.
- `ModelDownloadWorker` (`CoroutineWorker`, em `:core:models` com `work-runtime:2.10.5`): recebe a
  `ModelEntry` em JSON e o diretório no `inputData` (não depende do `AppGraph`); `setProgress` a cada ~1%;
  transitório → `Result.retry()` (até 8 tentativas), permanente → `Result.failure` com o motivo.
  Restrição `NetworkType.CONNECTED`; unique work `model-<id>`, `ExistingWorkPolicy.KEEP`.
- `ModelManager` ganha `states(): Flow<Map<String, ModelState>>`, `download`, `cancel`, `delete`; o agendador
  entra por uma interface `DownloadScheduler` (o `LocalModelManager` continua testável sem Android).
  `ModelState` ganha `Failed(reason)` (sem espaço, HTTP). Estado: disco `Ready` vence; senão o do trabalho
  (ENQUEUED/RUNNING → `Downloading`, fração do progresso ou do `.part`; FAILED → `Corrupt`/`Failed`).
- **BiRefNet**: `BiRefNet.kt` (pré = normalização do u2netp a 1024; pós = sigmoid → min-max → resize, sem o
  `refine` do u2netp) e `OnnxBiRefNetRemover`/`OnnxBiRefNetFactory` (`onnx.birefnet-lite`).
  `RemoverMode.BIREFNET` = cadeia só com ele; fora do Automático. O teste instrumentado chama o removedor
  direto (o AVD tem 2 GB: `MinRamMb(4096)` o tiraria da cadeia).
- **Tela Modelos**: cartão "Modelos de IA" na Home (não há Ajustes) → `Screen.Models`. Remover apaga o
  diretório e invalida a cadeia de recorte.

### 17.3 Hipóteses descartadas
- *Segundo `<provider>` no `:app`*: dois providers com o mesmo nome de classe colidem no merge; descartado (§15.5).
- *Worker que pega o `ModelManager` do `Application`*: acoplaria `:core:models` ao `:app`; a entrada vai no `inputData`.
- *`HttpURLConnection` com redirect automático*: o do Android (okhttp interno) e o do JDK tratam cabeçalhos no
  redirect de jeitos próprios; seguir à mão torna o `Range` explícito e o teste local prova o salto.

### 17.4 Tasks (arquivo/símbolo → teste)
1. Câmera — `CategoryStep`, `ProductFlowDeps.newCaptureUri`, `AppProductDeps`, `editor_file_paths.xml` → manual.
2. Zoom — `MaskViewport.kt`, `MaskStep` → JVM `MaskViewportTest` + manual.
3. Download — `ModelDownloader.kt`, `ModelDownloadWorker.kt`, `ModelManager.kt` → JVM `ModelDownloaderTest`.
4. BiRefNet — `BiRefNet.kt`, `OnnxBiRefNetRemover.kt`, `models.json`, `AppGraph`, `RemoverMode` → JVM
   `BiRefNetTest` + instrumentado `BiRefNetInstrumentedTest` (`:app`).
5. Tela — `ModelsScreen.kt`, `HomeScreen`, `Navigator`, `MainActivity` → manual (baixar, matar, retomar).

### 17.5 Resultado (sessão 9, 2026-10-14)
**Provas**
- `./gradlew assembleDebug testDebugUnitTest`: verde, **71 testes JVM** (eram 55): `ModelDownloaderTest` 7 (completo com
  redirect 302, retomada com `Range` reenviado no salto, servidor que ignora `Range` → do zero, lixo no `.part` → hash
  errado → refaz do zero, 2ª falha → `Corrupt` sem sobras, sem espaço → falha antes de qualquer GET, 404 permanente),
  `LocalModelManagerTest` +1 (`states()` com agendador falso: Downloading pela fração do `.part` e do progresso,
  Corrupt, Failed, Ready vence, delete cancela e apaga), `BiRefNetTest` 4, `MaskViewportTest` 4. `CompositorHarness` segue "skipped".
- Instrumentados no emulator-5554 (`pp_api34`), verdes: `:app` `CaptureDecodeInstrumentedTest` 1/1 (Uri
  `content://<pkg>.editor.files/capture/…` aceita escrita; JPEG 200×100 com EXIF orientação 6 decodifica 100×200 com a
  faixa da esquerda no topo → **o `ImageDecoder` aplica o EXIF**), `Phase3InstrumentedTest` 2/2,
  `EditorExportInstrumentedTest` 1/1; `:editor` `EditorBridgeInstrumentedTest` 4/4.
- Manifesto mesclado: **sem `CAMERA`**, um único `FileProvider` (`…editor.files`); `INTERNET` agora declarado no `:app`.
- Pela interface no emulador:
  - Modelos de IA → Baixar: progresso 23% na tela; `am force-stop` com o `.part` em 113 033 216 bytes; ao reabrir,
    WorkManager retomou sozinho (tentativa 2) e o log mostra `Range: bytes=113033216-` em **github.com e em
    release-assets.githubusercontent.com**; terminou "pronto", 224 005 088 bytes, `sha256sum` no aparelho =
    `5600024376…f03333`, marcador gravado, tela em "Pronto no aparelho".
  - Foto de produto → Tirar foto → câmera virtual (retrato) → ✓ → recorte com u2netp, foto em pé. O app de câmera do
    emulador grava pixels já girados (EXIF 1); a rotação EXIF foi provada pelo teste acima.
  - Máscara: pintura com 1 dedo (`input swipe`) cai exatamente sob o arrasto com o gesto novo.
  - BiRefNet escolhido no emulador de 4 GB → snackbar "pouca memória (pede 8 GB de RAM)", sem crash.

**O que a implementação desmentiu ou acrescentou**
- **RAM do BiRefNet-lite (fp32, 1024², ORT 1.31, x86_64)**: o `BiRefNetInstrumentedTest` foi morto pelo LMK com o AVD
  de 2 GB (RSS 1,62 GB + 421 MB swap) e reiniciado com `-memory 4096` (RSS **3,29 GB** + 200 MB swap; sem arena de CPU e
  sem memory pattern: 3,11 GB). A estimativa de 1–1,5 GB da §16.3 estava errada. `MinRamMb` subiu para **8192**
  (provisório até medir em arm64); arena e memory pattern ficaram desligados (−170 MB). **Não há ainda máscara do
  BiRefNet nem a comparação com o u2netp** em `docs/`: o teste grava `files/compare/shoe_u2netp_vs_birefnet.png` quando
  rodar num aparelho com memória. Para reduzir de verdade: export fp16, entrada 768/512 (o ONNX é fixo em 1024: exigiria
  reexportar) ou outro modelo — decisão do dono.
- `com.sun.net.httpserver` não está no `android.jar` e o compilador de teste do Android não enxerga o módulo
  `jdk.httpserver` (import resolve, membros não): o servidor de teste é um `ServerSocket` mínimo.
- Injetar pinça no emulador não funcionou: `sendevent` exige root (imagem google_play: `adbd cannot run as root`) e
  `adb emu event send` não chegou ao app. A pinça/pan/toque duplo estão provados só pelo `MaskViewportTest`.
- `connectedDebugAndroidTest` do `:app` desinstala o app no fim (apagaria o modelo baixado): os testes do `:app` desta
  sessão rodaram com `installDebug installDebugAndroidTest` + `adb shell am instrument -w -e class …`.
- Com outro aparelho na rede adb, o Gradle instala em todos: usar sempre `ANDROID_SERIAL`.

**Pendências**
- Pinça, pan e toque duplo no editor de máscara **pela mão** (emulador com mouse+Ctrl ou aparelho).
- BiRefNet: rodar `BiRefNetInstrumentedTest` num aparelho com ≥ 8 GB (`am instrument`, sem desinstalar), medir tempo/RSS,
  puxar a comparação para `docs/` e recalibrar `MinRamMb`; recorte com BiRefNet no fluxo.
- ~~Na Home, "Modelos" (templates) e "Modelos de IA" lado a lado~~ — **feito na sessão 10**: o cartão e a aba do editor web viraram "Templates" (HANDOFF §14).
- O emulador desta sessão foi reiniciado com `-memory 4096 -no-snapshot-save` (o `config.ini` continua com 2G).

## 18. Fase 5 — texto com IA (análise na sessão 11, 2026-10-14)
Escopo (§10, fase 5): `TextGenerator` com a cadeia `mlkit.gemini-nano` → `litertlm` → (opcional) `http.openai-compatible`;
`jsonSchema` + validação + 1 retry (§9); `ai.rewriteText` no editor. Prova: provedor HTTP contra servidor falso;
validação do JSON; teste manual em aparelho com Nano (o emulador não tem AICore).

### 18.1 Símbolos abertos e o que se descobriu
- `core/ai-api/.../Provider.kt` — `Capability.TEXT_GENERATOR` existe; **não há** `TextGenerator`/`TextRequest` no código
  (só no texto da §3). `ProviderContext.service(Class)` é o único canal para `ModelManager`/`SecretStore`.
- `FallbackChain::run` — `block(instance(entry, factory))` fica **dentro** do `try`: `AiError` lançado no `create()` da
  factory (ex. `ModelNotDownloaded`) também cai para o próximo. `invalidate()` só limpa o mapa (não fecha instâncias).
  Requisito não atendido → pula e acumula em `missing`.
- `AiError` — `isFallbackable` = Unavailable/ModelNotDownloaded/Network; `Remote`/`InvalidOutput` sobem.
- `AppGraph::checker` — `DeviceFeature` sempre `false`; `Secret` = `secrets.get(key) != null`; `Network` = rede com
  `NET_CAPABILITY_INTERNET`. `providerContext` entrega `ModelManager` e `SecretStore`. `DEFAULT_CONFIG` não tem
  `TEXT_GENERATOR`; `FileProviderConfigStore.load` completa capabilities ausentes com o padrão (config antiga ganha a cadeia nova).
- `SecretStore` (`FileSecretStore` + `KeystoreAead`) — `get/put/remove/names`; nunca rodou em aparelho (§13.5).
- `ModelManager` — `ensureReady(id): File?` (null se não baixado e sem asset); catálogo `models.json` com
  `id/capability/file/sizeBytes/sha256/license/format/minRamMb/urls`. `ModelsScreen` lista o catálogo inteiro (genérico).
- `OnnxBiRefNetFactory::create` — padrão a copiar: `ctx.service<ModelManager>()`, `ensureReady` ou `ModelNotDownloaded`.
- `editor/.../EditorHandlers.kt:108` — `ai.rewriteText` responde `UNSUPPORTED`. `EditorAi` recebe as capabilities no
  construtor; `servedBy(capability)` mapeia string → cadeia. `BridgeException.from` já traduz todos os `AiError`.
- `editor-web/src/main.ts` — **nenhum** chamador de `ai.rewriteText`; `textProps(t)` monta o painel do texto; `run(label, fn)`
  mostra progresso/erro; `editor.set(props)` altera o objeto ativo e faz `commit`; `editor.addText(kind, font)` devolve o objeto.
- `ModelDownloaderTest` — servidor `ServerSocket` mínimo (uma requisição por conexão): base para o teste do HTTP.
- `app/src/main/AndroidManifest.xml` — sem `networkSecurityConfig`/`usesCleartextTraffic`: com targetSdk 35, **HTTP em
  claro é bloqueado** (Ollama/LM Studio na rede local usam `http://`).

### 18.2 APIs conferidas (AAR do Google Maven + `javap`; não há `-sources.jar` publicado)
- **LiteRT-LM** `com.google.ai.edge.litertlm:litertlm-android:0.18.0` (última no `group-index.xml`). AAR 20,9 MB; `.so`
  arm64 22,2 MB e **x86_64 26,4 MB** (roda no emulador). minSdk 24. Deps: gson 2.14.0, **kotlin-reflect 2.4.0**,
  coroutines-android 1.11.0. Metadado Kotlin **2.4**.
  - `Engine(EngineConfig)`: `initialize()` (bloqueante, carrega o modelo), `isInitialized()`, `createConversation(ConversationConfig)`,
    `close()` (AutoCloseable). `Engine.Companion.setNativeMinLogSeverity(LogSeverity)`.
  - `EngineConfig(modelPath, backend, visionBackend, audioBackend, maxNumTokens: Int?, maxNumImages: Int?, cacheDir: String?,
    activationDataType)`; `Backend.CPU(threadCount: Int?, …)`, `Backend.GPU()`, `Backend.NPU`, `GOOGLE_TENSOR`.
  - `ConversationConfig(systemInstruction: Contents?, initialMessages, tools, samplerConfig: SamplerConfig?, automaticToolCalling,
    channels, extraContext: Map<String,Any>, loraConfig, prefillPrefaceOnInit, maxOutputToken: Int?, thinkingConfig: ThinkingConfig?,
    enableResponseFormat: Boolean, enableSpeculativeDecoding, chatTemplate)` (ordem pelos getters; todos com default).
  - `SamplerConfig(topK: Int, topP: Double, temperature: Double, seed: Int)`; `ThinkingConfig(enableThinking, budget)`.
  - `Conversation.sendMessage(String, extraContext, …, responseFormat: ResponseFormat?)`: **síncrono**, devolve `Message`
    (`contents.contents` → `Content.Text.text`; o raciocínio vai para `channels`). `sendMessageAsync(String): Flow<Message>`,
    `cancelProcess()`, `close()`. Bytecode: `responseFormat != null` sem `enableResponseFormat=true` →
    `IllegalArgumentException("response_format cannot be used unless enableResponseFormat=True …")`.
  - `ResponseFormat.json(schema: String)` / `regex(String)` — decodificação restrita no nativo. Erros nativos:
    `LiteRtLmJniException : RuntimeException`.
  - `Contents.of(String)`, `Message.user/system/model(String)`.
- **ML Kit GenAI Prompt** `com.google.mlkit:genai-prompt:1.0.0-beta4` (+ `genai-common:1.0.0-beta4`, `genai-schema:1.0.0-alpha1`).
  minSdk 26; manifesto pede `com.google.android.apps.aicore.service.BIND_SERVICE`. Metadado Kotlin **2.3** (stdlib 2.3.21).
  - `Generation.getClient(): GenerativeModel`; `GenerativeModel`: `suspend checkStatus(): Int` (`FeatureStatus`
    UNAVAILABLE/DOWNLOADABLE/DOWNLOADING/AVAILABLE), `download(): Flow<DownloadStatus>`, `suspend warmup()`,
    `suspend generateContent(GenerateContentRequest): GenerateContentResponse`, `generateContentStream(req): Flow<…>`,
    `isSystemPromptAvailable()`, `close()`.
  - `generateContentRequest(SystemInstruction, TextPart) { temperature; topK; maxOutputTokens; candidateCount }`;
    validações no `build()` (bytecode): **temperature ∈ [0,1]**, **maxOutputTokens ∈ [1,4096]**, candidateCount ∈ [1,8].
  - `GenerateContentResponse.candidates[0].text`. Erros: `GenAiException(errorCode)` com `NOT_AVAILABLE`, `BUSY`,
    `AICORE_INCOMPATIBLE`, `NEEDS_SYSTEM_UPDATE`, `PER_APP_BATTERY_USE_QUOTA_EXCEEDED`, `BACKGROUND_USE_BLOCKED`,
    `REQUEST_TOO_LARGE`, `RESPONSE_GENERATION_ERROR`, `NOT_SUPPORTED`, …
- **Modelos `.litertlm`** (API do Hugging Face, `?blobs=true`; download anônimo com 302 → CDN e **206 com `Range`**):

  | id no catálogo | arquivo (repo/arquivo) | bytes | sha256 | licença |
  |---|---|---|---|---|
  | `gemma-4-e2b-it` | `litert-community/gemma-4-E2B-it-litert-lm` / `gemma-4-E2B-it.litertlm` | 2 588 147 712 | `181938105e0eefd105961417e8da75903eacda102c4fce9ce90f50b97139a63c` | Apache-2.0 |
  | `qwen3-0.6b-int4` | `litert-community/Qwen3-0.6B` / `Qwen3-0.6B_dynamic_wi4b32_afp32.litertlm` | 344 671 744 | `03e7da1eb1108b50dffaa9bb52cc7bcbad2eb0c66ca990267f480c1e545d2856` | Apache-2.0 |

  Gemma 4 E2B: o README cita **1,6–1,7 GB de RAM em CPU** (S26 Ultra, contexto 2048); arquivo de 2,6 GB (mmap dos embeddings).
  Qwen3-0.6B: thinking **ligado** por padrão no template (desligar com `enable_thinking=false`); o README mostra pico de
  ~2,9 GB em CPU para a variante int4 mista com contexto 2048 — medir a nossa.

### 18.3 Comandos que provaram algo
- `curl …/litertlm/group-index.xml` → `litertlm-android` até **0.18.0**; `curl …/mlkit/group-index.xml` → `genai-prompt` até **1.0.0-beta4**.
- `javap -v … Engine` → `kotlin/Metadata mv = [2, 4]`; `GenerativeModel` → `[2, 3]`. O compilador 2.0.21 do projeto lê
  só até 2.1 → **é preciso subir o Kotlin**. `~/.gradle/caches/.../kotlin-gradle-plugin/2.4.0` já existe no cache.
- `curl -r 0-99` nas URLs do HF → `302` → `206 Partial Content`, `content-range: bytes 0-99/344671744` (e `/2588147712`).
- `huggingface.co/api/models/litert-community/Gemma3-1B-IT` → `gated: auto`, licença `gemma` → exige login no HF.

### 18.4 Hipóteses descartadas
- *Gemma 3 1B como opção leve* (§4.1/§12.3): o repositório é **gated** (o download exige conta HF com os termos aceitos);
  não serve ao `ModelDownloader` anônimo. A opção leve passa a ser **Qwen3-0.6B int4** (Apache-2.0, 345 MB, sem gate).
- *Gemma 4 E2B ~1,5 GB* (§4.1): o arquivo CPU tem **2,6 GB** (a variante `-gpu`, de 2,0 GB, só serve ao backend GPU).
- *Manter Kotlin 2.0.21 com `-Xskip-metadata-version-check`*: mascara uma incompatibilidade real de stdlib (o Gradle já resolveria
  `kotlin-stdlib` 2.4.0 pelo `kotlin-reflect` do LiteRT-LM). Subir para **Kotlin 2.4.0** (compose/serialization 2.4.0). Risco:
  KGP ≥ 2.2 transforma `kotlinOptions {}` em erro → migrar para `kotlin { compilerOptions { jvmTarget } }` em todos os módulos.
- *MockWebServer* (§10): dependência nova só para testes; o `ServerSocket` mínimo do `ModelDownloaderTest` já resolve (§17.5).
- *OkHttp*: o `ModelDownloader` já usa `HttpURLConnection`; o provedor HTTP segue o mesmo caminho, sem dependência nova.
- *Saída estruturada nativa como única garantia*: o Nano tem `GenerateTypedContentRequest` (genai-schema alpha) e o LiteRT-LM
  tem `ResponseFormat.json`, mas o comportamento varia por modelo. A garantia é o **validador próprio + 1 retry** (§9), comum aos
  três provedores; `ResponseFormat.json` do LiteRT-LM é só um reforço, desligado se lançar.
- *`DeviceFeature("aicore")` como requisito do Nano*: o checker devolve `false` para qualquer `DeviceFeature`. O Nano declara só
  `PlayServices` e decide em tempo de chamada (`checkStatus`), o mesmo padrão do `mlkit.subject` (§13.1).

### 18.5 Decisões
- `:core:ai-api`: `TextRequest`/`TextGenerator` da §3 (com `stream` default = `generate` inteiro), `ChainedTextGenerator`,
  e `StructuredText` (puro): extrai o JSON da resposta (cercas ``` e texto em volta), valida contra o subconjunto de JSON Schema
  que usamos (`type` object/array/string/number/integer/boolean, `properties`, `required`, `items`, `minItems`/`maxItems`,
  `enum`) e faz **1 retry** com o erro anexado ao prompt; a 2ª falha → `AiError.InvalidOutput`.
  `FallbackChain.invalidate()` passa a fechar instâncias `AutoCloseable` (o motor do LiteRT-LM segura ~1–3 GB).
- `:ai:mlkit` → `GeminiNanoTextGenerator` + factory `mlkit.gemini-nano` (requisito `PlayServices`). `checkStatus`:
  AVAILABLE → gera; DOWNLOADABLE → dispara `download()` em segundo plano e lança `Unavailable`; DOWNLOADING/UNAVAILABLE →
  `Unavailable`. `GenAiException` de disponibilidade/cota/ocupado → `Unavailable` (cai para o próximo); `REQUEST_TOO_LARGE` →
  ~~`Unsupported`~~ **`Unavailable`** (o próximo provedor pode ter contexto maior; corrigido na implementação); demais →
  `InvalidOutput`. temperature limitada a [0,1] e maxOutputTokens a [1,4096].
- Módulo novo `:ai:litertlm` → `LiteRtLmTextGenerator` + factory `litertlm` (settings `modelId`, `backend` cpu|gpu).
  Requisitos `Model(modelId)` + `MinRamMb(minRamMb do catálogo)`. Motor criado na 1ª chamada (`Dispatchers.IO`), `maxNumTokens`
  2048, `cacheDir` = `cacheDir/litertlm`; uma conversa por pedido (`Mutex`), fechada no fim; thinking desligado
  (`ThinkingConfig(false)` + `extraContext enable_thinking=false`) e `<think>…</think>` removido da saída por garantia;
  o motor é **fechado após 2 min ocioso**. Cancelamento da coroutine → `cancelProcess()`.
- Módulo novo `:ai:remote-http` → `OpenAiCompatibleTextGenerator` + factory `http.openai-compatible` (settings `baseUrl`,
  `model`, `apiKeySecret` opcional). `POST {baseUrl}/chat/completions` com `messages` (system+user), `temperature`,
  `max_tokens` e, havendo `jsonSchema`, `response_format: {"type":"json_object"}` + o schema no system. Requisitos `Network`
  (+ `Secret` se houver `apiKeySecret`). Timeout de conexão 15 s, de leitura 120 s. Erros: `IOException` → `Network`; HTTP ≠ 2xx →
  `Remote(code, corpo truncado)`; JSON sem `choices[0].message.content` → `InvalidOutput`.
- **HTTP em claro** liberado por `network_security_config.xml` (`base-config cleartextTrafficPermitted="true"`): os servidores
  locais (Ollama, LM Studio, llama.cpp) são configurados pelo usuário e usam `http://`. A tela avisa quando há chave com `http://`.
- Catálogo: `gemma-4-e2b-it` (minRamMb 6144) e `qwen3-0.6b-int4` (minRamMb 3072), formato `litertlm`, sem `bundledAsset`.
  Cadeia padrão: `mlkit.gemini-nano` → `litertlm{gemma-4-e2b-it}` → `litertlm{qwen3-0.6b-int4}`. O HTTP só entra se o usuário ativar.
- Editor: `ai.rewriteText` payload `{text, style, count?}` (`style`: `rewrite|shorter|persuasive|formal|fun|fix`) →
  `{variants: string[], servedBy?}`; `ai.generateCopy` `{brief}` → `{title, subtitle, cta, servedBy?}` (texto IA de pôster, §9).
  Ambos usam `StructuredText` com schema. Na web: botão "✨ Reescrever" no painel de texto (folha com estilos → variantes
  clicáveis que trocam o texto) e "✨ Gerar textos" na aba Texto (insere título/subtítulo/chamada). Prompts escritos do zero.
- `:app`: tela "Texto com IA" (cartão na Home): modo "Só no aparelho" / "Aparelho + servidor" / "Só servidor"; campos
  URL, modelo e chave (vai para o `SecretStore` com o nome `text.openai`); "Testar" mostra a resposta e quem atendeu.

### 18.6 Tasks (arquivo/símbolo → teste que prova)
1. Kotlin 2.4.0 (+ `compilerOptions` em todos os módulos) → `./gradlew assembleDebug testDebugUnitTest` continua verde (71).
2. `:core:ai-api`: `TextGenerator.kt` (`TextRequest`, `TextGenerator`, `ChainedTextGenerator`), `StructuredText.kt`;
   `FallbackChain.invalidate` fecha `AutoCloseable` → JVM `StructuredTextTest` (extração com cercas/ruído, schema ok, campo
   faltando/tipo errado → retry com o erro anexado, 2ª falha → `InvalidOutput`, `enum`, limites de array) + caso novo no `FallbackChainTest`.
3. `:ai:remote-http`: `OpenAiCompatibleTextGenerator` → JVM `OpenAiCompatibleTest` com `ServerSocket` (corpo enviado: modelo,
   mensagens, `response_format`, `Authorization`; 200 → texto; 500 → `Remote`; conexão recusada → `Network`; JSON sem choices →
   `InvalidOutput`; ponta a ponta com `StructuredText`: 1ª resposta inválida, 2ª válida).
4. `:ai:mlkit`: `GeminiNanoTextGenerator` + mapeamento de erro puro (`nanoError(code)`) → JVM do mapeamento; manual em aparelho com AICore.
5. `:ai:litertlm`: `LiteRtLmTextGenerator` + `cleanOutput` puro → JVM (`<think>` removido); **instrumentado** `LiteRtLmInstrumentedTest`
   (`:app`, com o Qwen3-0.6B baixado no emulador): resposta não vazia, JSON válido via `StructuredText`, RSS e tempo medidos.
6. `:editor`: `ai.rewriteText`/`ai.generateCopy` + `EditorAi.textGenerator` → `EditorBridgeInstrumentedTest` (IA falsa → variantes);
   `editor-web`: `aiText.ts` (montagem do pedido e validação das variantes) → vitest; build dos assets.
7. `:app`: registro das factories, cadeia padrão, catálogo, `network_security_config`, tela "Texto com IA" → manual no emulador
   (servidor falso em `10.0.2.2` e Qwen3 local) e reescrever um texto no editor.

### 18.7 Resultado (fase 5 concluída em 2026-10-14, sessão 11)
**Provas**
- `./gradlew assembleDebug testDebugUnitTest`: verde, **91 testes JVM** (eram 71; 1 skipped, o `CompositorHarness`):
  `StructuredTextTest` 7, `FallbackChainTest` 11 (invalidate fecha `AutoCloseable`), `OpenAiCompatibleTest` 6 (servidor
  `ServerSocket`: corpo/Bearer, sem chave, 429 com corpo e 401, conexão recusada → `Network`, sem choices → `InvalidOutput`,
  ponta a ponta com retry), `GeminiNanoErrorTest` 2, `LiteRtLmTest` 2, `TextPromptsTest` 3. `assembleRelease` verde.
- `editor-web`: `tsc` limpo, vitest **21/21** (+3 `aiText.test.ts`), assets regerados.
- Instrumentados no emulator-5554 (`pp_api34`, 4 GB, x86_64), verdes: `:editor` `EditorBridgeInstrumentedTest` **5/5** (novo
  `rewriteTextFromTheTextPanel`: 1ª resposta sem JSON → retry → 1ª variante troca o texto; repetição removida; estilo inválido →
  `invalid` sem chamar o provedor); `:app` `LiteRtLmInstrumentedTest` 1/1, `Phase3InstrumentedTest` 2/2,
  `EditorExportInstrumentedTest` 1/1, `CaptureDecodeInstrumentedTest` 1/1 (regressão depois do Kotlin 2.4.0).
- **LiteRT-LM real** (Qwen3-0.6B int4, CPU, x86_64): cadeia padrão → Nano cai (sem AICore) → Gemma pulado (não baixado) → Qwen
  atende. 1ª resposta 8,6–13,6 s **incluindo carregar o motor**; pedido JSON ~9,8 s; **pico de RSS 1,27 GB** (VmHWM do processo
  de teste). `minRamMb` 3072 do Qwen fica.
- Pela interface no emulador: tela "Texto com IA" → "Só no aparelho" → "Salvar e testar" respondeu ("— LLM no aparelho
  (LiteRT-LM), 11,7 s"); "Só servidor" com `http://10.0.2.2:8765/v1` (servidor falso no host) + chave → o servidor recebeu
  `Authorization: Bearer sk-test-123` (**primeira execução real do `KeystoreAead`/`SecretStore` em aparelho**) por http em claro,
  aviso de http exibido; editor → Texto → "✨ Gerar textos com IA" inseriu título/subtítulo/chamada; "✨ Reescrever" →
  "Mais persuasivo" listou 3 variantes e a escolhida trocou o texto. Erro de schema aparece como "Resultado inválido: …".
- Manifesto mesclado: sem `CAMERA`, um `FileProvider`; nova permissão `…aicore.service.BIND_SERVICE` (do genai-prompt).
- APK release (só arm64): **154,2 MB** (fase 4: 124,3 MB; +22 MB do `liblitertlm_jni.so`, + kotlin-reflect/gson/genai). Debug: 262 MB.

**O que a implementação desmentiu ou acrescentou**
- **Schema cru no prompt**: o Qwen3-0.6B devolvia o próprio schema (`{"type":"object",…}`) em ~metade das respostas. O
  `StructuredText.withJsonInstruction` passou a mandar um **exemplo da forma** gerado do schema (`skeleton`:
  `{"variants":["...","..."]}`). Sonda `LiteRtLmProbe` (6 tentativas por caso, temp 0,8): **24/24 válidas pelo schema**.
- **`ResponseFormat.json` do LiteRT-LM**: com o prompt antigo deu JSON inválido em 3/4 e válido em 4/4 em outra rodada (ruído);
  com o exemplo de forma, 12/12 com e 12/12 sem. Sem ganho medido → fica **desligado** (`constrainedJson = false`), e não
  "reforço ligado" como a §18.5 dizia.
- **`skeleton` sem `maxItems`** limitava o array a 2 mesmo com `minItems` 3 (pego pelo teste JVM).
- **Inserir textos gerados em alturas fixas** (25/45/75%) sobrepunha quando o texto quebra em linhas: agora empilha pela altura real
  e centraliza o bloco.
- **Download do Hugging Face no emulador falhou por TLS** (`Trust anchor for certification path not found`): o Kaspersky do PC
  intercepta `huggingface.co`/`hf.co` (`openssl s_client` mostra o emissor "Kaspersky Anti-Virus Personal Root"); o GitHub não é
  interceptado (por isso o BiRefNet baixou na sessão 9). **Não é bug do app.** Para o teste, o `.litertlm` foi baixado no host
  (sha256 conferido), enviado por `adb push` e instalado com o marcador `.verified-<sha>` do `LocalModelManager`.
  **O download de um modelo do HF pelo app continua sem prova ponta a ponta** (fazer em rede sem interceptação ou no aparelho).
- Qualidade do Qwen3-0.6B em português é fraca (repete o original, erros de grafia): serve de opção leve; a web descarta variantes
  iguais ao original. O Gemma 4 E2B (pede 6 GB) não coube no emulador de 4 GB.
- JDK: `HttpURLConnection` em modo streaming descarta o corpo de um 401 (`HttpRetryException` interno); o teste confere só o código.

**Pendências**
- **Gemini Nano em aparelho com AICore** (teste manual da §10) — nenhum disponível nesta sessão.
- **Gemma 4 E2B** num aparelho com ≥ 6 GB: tempo, RSS e qualidade; recalibrar `minRamMb`.
- Download do HF pelo app sem o Kaspersky no caminho (ou no aparelho físico).
- Servidor real (Ollama/LM Studio) — só o falso foi usado. `LiteRtLmProbe` fica no `androidTest` como sonda manual.
- Texto reescrito mais longo cresce a partir do centro e pode encostar no vizinho (o usuário reposiciona).
- O emulador ficou com a cadeia de texto em "Só servidor" apontando para `10.0.2.2:8765` (servidor falso já parado) e uma chave
  `text.openai` salva: voltar para "Só no aparelho" antes de testar outra coisa.

## 19. Fase 6 (parte remota) — geração de imagem por A1111 e ComfyUI (análise na sessão 12, 2026-10-14)
Escopo (§10, fase 6, metade remota): `ImageGenerator` da §3 com dois provedores HTTP — `http.a1111` (AUTOMATIC1111 WebUI e
derivados com a mesma API, ex. Forge) e `http.comfyui` — + tela para configurar e gerar pôster/logo por prompt, com o resultado
indo ao editor. Prova: servidor falso (`ServerSocket`) para os dois. **On-device (`:ai:ondevice-sd`) fica fora** desta etapa.

### 19.1 Símbolos abertos e o que se descobriu
- `core/ai-api/.../Types.kt` — `RgbaImage(bitmap)` e `Mask(width, height, alpha)`; **não há** `ImageRequest`/`ImageGenerator`/
  `ImageFeature`/`Control` no código (só na §3). `Capability.IMAGE_GENERATOR` já existe em `Provider.kt`.
- `FallbackChain::run` (§18.1) — sem mudança; `ChainedXxx` são classes de 1 linha no fim de `FallbackChain.kt` (`ChainedTextGenerator`
  está em `TextGenerator.kt`). Cadeia vazia → `AiError.Unavailable(emptyList())`.
- `ai/remote-http/.../OpenAiCompatibleTextGenerator.kt` — padrão a seguir: `HttpURLConnection` em `Dispatchers.IO`,
  `invokeOnCompletion { conn.disconnect() }` para cancelar, `IOException` → `Network` (após `ensureActive`), HTTP ≠ 2xx →
  `Remote(code, corpo[:2000])`, JSON ruim → `InvalidOutput`. Factory lê settings com `JsonObject.str` (privado, no companion) e o
  segredo por `ctx.service<SecretStore>()`. Módulo depende só de `:core:ai-api` e `:core:secrets`; o `register` é feito no `AppGraph`.
- `OpenAiCompatibleTest` — servidor `ServerSocket` (1 requisição por conexão, `Connection: close`, respostas numa fila) — base dos testes.
- `AppGraph` — `registry.register(...)`, `chain(capability, type)`, `DEFAULT_CONFIG` sem `IMAGE_GENERATOR` (= desligado, como a
  §4.4 manda); `saveTextChain` é o modelo para `saveImageChain`; `editorAi.servedBy` mapeia nome de capability → cadeia.
  `FileProviderConfigStore.load` completa capabilities ausentes com o padrão.
- `TextAiScreen.kt` — modelo da tela nova (modo/URL/chave no `SecretStore`, "Salvar e testar", `describeTextError`,
  aviso de chave em `http://`). `Navigator.Screen` + `MainActivity.AppNavigation` (`when (screen)`) + `HomeScreen(onXxx)` + `HomeCard`.
- `AppProductDeps.openInEditor(bitmap)` — `graph.editorAssets.putPng(bitmap, "img")` → `navigator.push(Screen.Editor(EditorStart.Image(name, título)))`:
  é o caminho do resultado para o editor.
- Nenhum teste JVM cria `Bitmap` (o `android.jar` de teste devolve `null`/0 com `isReturnDefaultValues`). **Consequência:** a parte
  HTTP/JSON tem de trabalhar com `ByteArray` (PNG já codificado) e a conversão `Bitmap ↔ PNG` fica numa camada fina separada.
- `network_security_config.xml` (fase 5) já libera `http://` — A1111 (`:7860`) e ComfyUI (`:8188`) na rede local funcionam.
- Original (`REA_ANALISE.md` l.182–183): `POST {base}agent-scheduler/v1/queue/txt2img|img2img`, `sampler_name="Euler a"`, `steps` 18,
  ControlNet SD1.5 `control_v11p_sd15_canny [d14c016b]` (módulo `canny`) / `control_v11p_sd15_scribble [d4ba51ff]` (módulo
  `t2ia_sketch_pidi`), `cfg_scale`, `inpainting_mask_invert`; checkpoint não definido (padrão do servidor).

### 19.2 APIs conferidas (fonte no GitHub, baixada em 2026-10-14)
**AUTOMATIC1111** (`modules/api/api.py`, `models.py`, `processing.py`; último commit do master 2024-07-27, v1.10.x). Precisa do
servidor iniciado com `--api` (sem ele `/sdapi/*` dá 404). Com `--api-auth user:senha` todas as rotas exigem **HTTP Basic**.
- `POST /sdapi/v1/txt2img` e `/sdapi/v1/img2img` — síncronos (a resposta só volta no fim). Campos usados: `prompt`, `negative_prompt`,
  `seed` (-1 = aleatório), `sampler_name`, `steps` (padrão 50), `cfg_scale` (7), `width`/`height` (512), `batch_size`, `n_iter`,
  `alwayson_scripts`, `send_images` (true), `save_images`. img2img: `init_images: [base64]`, `denoising_strength` (0,75), `mask` (base64),
  `mask_blur`, `inpainting_fill` (0 fill, 1 original, 2 ruído latente, 3 nada), `inpaint_full_res`, `inpainting_mask_invert` (0/1),
  `resize_mode`.
- Imagem de entrada: base64 puro ou `data:image/...;base64,` (`decode_base64_to_image`). Saída: `{images: [base64], parameters, info}`;
  o formato é o `samples_format` do servidor (**PNG, JPEG ou WEBP**) — o `BitmapFactory` lê os três.
- Máscara: `create_binary_mask` — se for RGBA com alfa não-opaco usa o **alfa**; senão converte para L. **Branco = área a gerar**;
  `inpainting_mask_invert=1` inverte no servidor. Mandar a máscara **opaca em tons de cinza**.
- Erros: JSON `{error, detail, body, errors}` com o status da exceção (422 validação/script inexistente, 400 sampler inválido, 500).
- `GET /sdapi/v1/progress?skip_current_image=true` → `{progress 0..1, eta_relative, state{job_count,…}, textinfo}`; **não** passa pelo
  `queue_lock`, dá para consultar durante a geração. `POST /sdapi/v1/interrupt` → `{}` (interrompe o job corrente, global).
- **ControlNet** (extensão `sd-webui-controlnet`, `internal_controlnet/args.py`): `alwayson_scripts: {"controlnet": {"args": [unit]}}`;
  unit = `enabled`, `module`, `model`, `weight` (0..2), `image` (base64; `input_image` é alias **depreciado** e mandar os dois dá
  erro de conflito), `resize_mode` ("Crop and Resize"…), `control_mode` ("Balanced"), `pixel_perfect`, `save_detected_map`
  (true por padrão: **o mapa detectado volta junto em `images`** → mandar `false` e, por garantia, ficar só com as `count` primeiras).
  Extensão ausente → 422 `always on script controlnet not found`.

**ComfyUI** (`server.py`, `execution.py`, `nodes.py`, `comfy_extras/nodes_canny.py`; master de 2026-10).
- `POST /prompt` `{prompt: <grafo em formato API>, client_id?}` → `{prompt_id, number, node_errors}`; grafo inválido → **400**
  `{error:{type,message,details}, node_errors}` (ex. checkpoint inexistente cai aqui, na validação).
- `GET /history/{prompt_id}` → `{}` enquanto não terminou; depois `{<id>: {prompt, outputs: {<node>: {images: [{filename, subfolder,
  type}]}}, status: {status_str: "success"|"error", completed, messages: [[evento, dados], …]}}}`. Erro: mensagem
  `execution_error` com `exception_message`/`node_type`; interrupção: `execution_interrupted`.
- `GET /view?filename=&subfolder=&type=output` → bytes da imagem (`SaveImage` grava PNG em `output`; `PreviewImage` usa `temp`).
- `POST /upload/image` multipart: `image` (arquivo), `overwrite` ("true"), `type` ("input"), `subfolder` → `{name, subfolder, type}`;
  o `name` é o que vai no `LoadImage.image`.
- `GET /queue` → `{queue_running: [[number, prompt_id, …]], queue_pending: […]}` (dá "na fila"/"gerando").
- Cancelar: `POST /queue {"delete": [id]}` (se ainda pendente) e `POST /interrupt {"prompt_id": id}` (versões novas interrompem só
  esse; antigas ignoram o corpo e interrompem o corrente).
- Progresso por passo só existe no **websocket** `/ws?clientId=` (eventos `progress`/`executing`).
- Nós do grafo embutido (entradas exatas): `CheckpointLoaderSimple{ckpt_name}` → MODEL/CLIP/VAE; `CLIPTextEncode{text, clip}`;
  `EmptyLatentImage{width, height, batch_size}` (passo 8); `KSampler{model, seed (0..2^64-1), steps, cfg, sampler_name, scheduler,
  positive, negative, latent_image, denoise}`; `VAEDecode{samples, vae}`; `SaveImage{images, filename_prefix}`; `LoadImage{image}` →
  IMAGE/MASK; `LoadImageMask{image, channel: alpha|red|green|blue}` (canal de cor = máscara direta; `alpha` é invertido);
  `VAEEncode{pixels, vae}`; `SetLatentNoiseMask{samples, mask}`; `ControlNetLoader{control_net_name}`;
  `ControlNetApplyAdvanced{positive, negative, control_net, image, strength, start_percent, end_percent, vae?}`;
  `Canny{image, low_threshold 0.01..0.99, high_threshold}` (núcleo, `comfy_extras`).

### 19.3 Comandos que provaram algo
- `curl https://api.github.com/repos/AUTOMATIC1111/stable-diffusion-webui/commits/master` → `"date": "2024-07-27T12:49:39Z"`
  (API estável desde então; Forge mantém as mesmas rotas `/sdapi/v1`).
- `grep -n "add_api_route" modules/api/api.py` → `txt2img`, `img2img`, `progress`, `interrupt`, `sd-models`, `samplers` (l.211–242).
- `grep -n "@routes" server.py` (ComfyUI) → `/prompt` (POST l.1161), `/history/{prompt_id}`, `/view`, `/upload/image`, `/queue`,
  `/interrupt`, `/ws`.
- `sed -n 1824,1870p nodes.py` → `LoadImageMask`: canal `R/G/B` devolve o canal direto; `A` devolve `1 - alfa`.

### 19.4 Hipóteses descartadas
- *Fila do agent-scheduler, como o original*: é extensão de terceiros e muda o protocolo (enfileira e devolve um id). A API direta
  (`/sdapi/v1/*`) existe em qualquer A1111/Forge com `--api`. O `"queue": "agent-scheduler"` do exemplo da §4.3 sai.
- *Websocket do ComfyUI para progresso*: o Android não tem cliente WS na plataforma e a §18.4 decidiu não trazer OkHttp. Progresso
  por **polling** de `/history/{id}` + `/queue` a cada 1 s ("na fila", "gerando", sem fração). Se a fração fizer falta, reavaliar.
- *Testar o `ImageGenerator` inteiro em JVM*: não há `Bitmap` em teste JVM (§19.1). Os clientes HTTP trabalham com PNG em
  `ByteArray`; o codec `Bitmap ↔ PNG` (Android) é provado pela interface no emulador.
- *`VAEEncodeForInpaint` no grafo de inpaint do ComfyUI*: pede checkpoint de inpainting e denoise 1,0. `VAEEncode` +
  `SetLatentNoiseMask` funciona com qualquer checkpoint e respeita `strength`.
- *Inverter a máscara no servidor nos dois*: só o A1111 tem `inpainting_mask_invert`. No ComfyUI a inversão é feita no app antes do
  upload (mesmo resultado, sem nó extra).
- *Só o grafo embutido no ComfyUI*: quem usa ComfyUI costuma ter um fluxo próprio (SDXL, Flux, LoRA). Aceitar também um **fluxo do
  usuário** (formato API) com marcadores; o embutido serve SD1.5/SDXL de arquivo único.

### 19.5 Decisões
- `:core:ai-api` → `ImageGenerator.kt`: `ImageRequest` (como a §3, + `cfgScale: Float? = null`), `Control(kind CANNY|SCRIBBLE, image,
  weight)`, `enum ImageFeature { TXT2IMG, IMG2IMG, INPAINT, CONTROL_CANNY, CONTROL_SCRIBBLE }`, `interface ImageGenerator { val supports;
  suspend fun generate(req, progress): List<RgbaImage> }`, `ChainedImageGenerator` (a proxy não sabe de antemão quem vai atender: seu
  `supports` é o conjunto inteiro, e cada provedor lança `Unsupported` antes de chamar a rede se faltar a feature). Função pura
  `ImageRequest.featuresNeeded()` e `snapTo8(px)`.
- `:ai:remote-http`, pacote `image`:
  - `ImageJob` (pedido "de fio": prompt, negativo, w/h já múltiplos de 8, steps, seed, cfg, count, `init: ByteArray?` PNG,
    `strength`, `mask: ByteArray?` PNG opaco branco = área, `maskInvert`, `control: (kind, png, weight)?`) e
    `interface ImageBackend { suspend fun run(job, progress): List<ByteArray> }`.
  - `A1111Backend(baseUrl, auth: () -> String?, options)` → txt2img sem `init`; img2img com `init` (+ `mask`, `inpainting_mask_invert`,
    `inpainting_fill=1`, `mask_blur=4`); `n_iter=1`, `batch_size=count`; ControlNet se `control` (modelo e módulo por kind vindos das
    settings; vazio → `Unsupported`). Progresso: coroutine paralela consultando `/progress` a cada 1 s. Cancelar → `POST /interrupt`
    + `disconnect`. Saída: `images.take(count)` decodificadas de base64.
  - `ComfyBackend(baseUrl, auth, options)` → upload das imagens (`/upload/image`, nomes `pp-<uuid>.png`, `overwrite=true`), monta o
    grafo (embutido ou do usuário), `POST /prompt`, polling até `history` com `status`; `status_str=error` → `Remote(500, mensagem do
    execution_error)`; 400 do `/prompt` → `Remote(400, error.message + node_errors)`; baixa as imagens de `/view` (só `type=output`; se
    não houver, as `temp`). Cancelar → `/queue delete` + `/interrupt`. Seed nulo → aleatório em [0, 2^48).
  - Grafo do usuário: JSON formato API colado nas settings; valores string **iguais** a `{{prompt}}`, `{{negative}}`, `{{seed}}`,
    `{{steps}}`, `{{cfg}}`, `{{width}}`, `{{height}}`, `{{count}}`, `{{denoise}}`, `{{init_image}}`, `{{mask_image}}`,
    `{{control_image}}` são trocados (números viram número). `supports` = TXT2IMG + o que tiver marcador de imagem.
  - `RemoteImageGenerator(backend, supports, codec)`: valida `featuresNeeded() ⊆ supports` (senão `Unsupported`), codifica com o
    `ImageCodec` (Android: `Bitmap.compress PNG`; máscara → bitmap cinza opaco), chama o backend, decodifica (`BitmapFactory`;
    falha → `InvalidOutput`).
  - Factories `http.a1111` (settings `baseUrl`, `authSecret` "usuário:senha" no `SecretStore`, `sampler` "Euler a", `steps` 18,
    `cfgScale` 7, `cannyModel` `control_v11p_sd15_canny [d14c016b]`, `scribbleModel` `control_v11p_sd15_scribble [d4ba51ff]`,
    `cannyModule` `canny`, `scribbleModule` `t2ia_sketch_pidi`) e `http.comfyui` (`baseUrl`, `apiKeySecret` opcional → Bearer, para
    proxy; `checkpoint` obrigatório no grafo embutido, `sampler` `euler_ancestral`, `scheduler` `normal`, `steps` 18, `cfgScale` 7,
    `cannyControlNet`/`scribbleControlNet` (nome do arquivo; vazio = sem suporte), `workflow` opcional). Requisitos: `Network`
    (+ `Secret`). Timeouts: conexão 15 s, leitura **10 min** (A1111 é síncrono).
- `:app`: registrar as duas factories; **`IMAGE_GENERATOR` ligado por padrão** (pedido do dono na sessão 12; a §4.4 dizia
  desligado): `DEFAULT_CONFIG` ganha a cadeia `[http.a1111]` sem `baseUrl`. Como não há endereço de servidor que sirva a todos, a
  factory sem URL lança `AiError.Unavailable(emptyList())` no `create` (não `Unsupported`), e a tela "Gerar imagem" mostra
  "Informe o endereço do servidor" e abre já com o A1111 escolhido e o campo de URL em foco. Configs salvas antes ganham a cadeia
  pelo `FileProviderConfigStore.load` (completa capabilities ausentes). `AppGraph.imageGenerator` +
  `saveImageChain`. Tela nova **"Gerar imagem"** (cartão na Home): servidor (A1111 / ComfyUI / Desligado), URL, credencial, modelo do
  ComfyUI, "Salvar"; abaixo, gerar: prompt, negativo, formato (quadrado 512², retrato 512×768, paisagem 768×512), quantidade 1–4,
  "traduzir para inglês" (usa o `Translator` da cadeia; falha → segue com o original e avisa), referência opcional (imagem da
  galeria + contorno/rabisco + peso) → grade de resultados → toque abre no editor (`EditorStart.Image`).
- Fora desta etapa (registrado como próximo passo): modo "IA generativa" da foto de produto (inpaint com `maskInvert`), upscale
  depois da geração (fase 7) e on-device.

### 19.6 Tasks (arquivo/símbolo → teste que prova)
1. `core/ai-api/.../ImageGenerator.kt` → JVM `ImageRequestTest` (`featuresNeeded` para txt2img/img2img/inpaint/control; `snapTo8`).
2. `ai/remote-http/.../image/ImageJob.kt`, `A1111Backend.kt` → JVM `A1111BackendTest` (servidor `ServerSocket`): txt2img (rota,
   corpo: sampler/steps/seed -1/batch_size, Basic auth); img2img+inpaint (`init_images`, `mask`, `inpainting_mask_invert` 1,
   `denoising_strength`); ControlNet (`alwayson_scripts.controlnet.args[0]` com `image`, `model`, `module`, `save_detected_map` false)
   e corte em `count`; 422 → `Remote` com o corpo; conexão recusada → `Network`; resposta sem `images` → `InvalidOutput`; progresso
   lido de `/progress`; cancelar → `/interrupt` chamado.
3. `ComfyBackend.kt` + `ComfyWorkflow.kt` (grafo puro) → JVM `ComfyWorkflowTest` (txt2img/img2img/inpaint/control: ligações e
   valores; marcadores do grafo do usuário, número vira número) e `ComfyBackendTest` (upload multipart → nome usado no `LoadImage`;
   `/prompt` → polling de `/history` vazio → pronto → `/view` com filename/subfolder/type; `status_str=error` → `Remote` com a
   mensagem; 400 com `node_errors` → `Remote`; cancelar → `/queue delete` + `/interrupt`).
4. `RemoteImageGenerator.kt` + `ImageCodec` + factories → JVM `ImageFactoriesTest` (requisitos, `supports` por settings,
   `Unavailable` sem URL — cadeia padrão ligada —, `Unsupported` sem checkpoint/modelo de ControlNet; `DEFAULT_CONFIG` tem `IMAGE_GENERATOR`).
5. `:app`: registro, `imageGenerator`, `saveImageChain`, `ImageGenScreen.kt`, `Screen.ImageGen`, cartão na Home →
   `assembleDebug testDebugUnitTest` verde; manual no emulador com um servidor falso no host (`10.0.2.2`) imitando A1111 e ComfyUI
   (devolvem um PNG gerado): gerar → grade → abrir no editor.

### 19.7 Resultado (fase 6 remota concluída em 2026-10-14, sessão 13)
**Provas**
- `./gradlew assembleDebug testDebugUnitTest`: verde, **126 testes JVM** (eram 91; 1 skipped, o `CompositorHarness`):
  `ImageRequestTest` 3 (`featuresNeeded` dos 4 tipos de pedido + controle; `snapTo8`; máscara sem init/count 0 recusados),
  `A1111BackendTest` 9, `ComfyWorkflowTest` 6, `ComfyBackendTest` 6, `ImageFactoriesTest` 8 e o **primeiro teste JVM do `:app`**,
  `ImageGenConfigTest` 3 (`DEFAULT_CONFIG` tem `IMAGE_GENERATOR = [http.a1111]` sem URL; estado ↔ cadeia; mensagens de erro).
  `OpenAiCompatibleTest` segue 6/6.
- Pela interface no emulador (`pp_api34`), com um servidor falso no host (`fake_sd.py`, Python + PIL, `127.0.0.1:7860` imitando o
  A1111 e `:8188` o ComfyUI, PNGs gerados) acessado por `http://10.0.2.2`:
  - 1º uso: a tela "Gerar imagem" abriu com **A1111 escolhido, campo de URL em foco e "Informe o endereço do servidor"** (§19.5).
  - A1111: URL + `ana:s3cr3t` → o servidor recebeu `Authorization: Basic YW5hOnMzY3IzdA==`, `sampler_name "Euler a"`, `steps 18`,
    `seed -1`, `batch_size 2`, `n_iter 1`; 2 imagens na grade em 5,3 s; aviso de credencial em `http://` exibido; toque na
    imagem → editor abriu com ela ("Imagem gerada"); voltar → a grade continua (`ImageGenMemory`).
  - ComfyUI: URL `:8188` + checkpoint `sd15.safetensors`, retrato 512×768 → `/prompt` com o grafo embutido (`CheckpointLoaderSimple`,
    2× `CLIPTextEncode`, `EmptyLatentImage`, `KSampler`, `VAEDecode`, `SaveImage`, seed aleatório < 2^48), polling até `/history`
    pronto, `/view` da imagem; 6,9 s.
  - Tradução: "poster de cafe artesanal" chegou ao A1111 como `handmade cafe poster` (ver abaixo).
- **Não provado em tela**: referência por ControlNet (escolher imagem da galeria) e "Cancelar" — cobertos só pelos testes JVM
  (`controlnet unit…`, `cancel calls interrupt`, `cancel removes from the queue…`). A barra com fração do `/progress` do A1111 também
  não foi conferida visualmente (o teste JVM prova a leitura).

**Arquivos**: `core/ai-api/.../ImageGenerator.kt`; `ai/remote-http/.../image/` `ImageJob.kt`, `Http.kt`, `A1111Backend.kt`,
`ComfyWorkflow.kt`, `ComfyBackend.kt`, `RemoteImageGenerator.kt` (+ `ImageCodec`/`AndroidImageCodec`), `ImageFactories.kt`
(`A1111ImageFactory`, `ComfyUiImageFactory`); `app/` `ImageGenScreen.kt`, `AppGraph` (registro, `imageGenerator`, `saveImageChain`,
`DEFAULT_CONFIG`), `Navigator` (`Screen.ImageGen`), `MainActivity`, `HomeScreen` (cartão "Gerar imagem"), `build.gradle.kts`
(`testImplementation(junit)`). Testes em `ai/remote-http/src/test/.../image/` (com `FakeHttpServer.kt`) e `app/src/test/`.

**O que a implementação desmentiu ou acrescentou**
- **Cancelar não derrubava a conexão.** O padrão `coroutineContext[Job]?.invokeOnCompletion { conn.disconnect() }` (§19.1) só
  dispara quando o job *termina*, e um job preso na leitura bloqueante não termina até a resposta chegar. Pego pelo teste
  `cancel calls interrupt` (o `/interrupt` nunca chegava). No `Http` novo a troca bloqueante roda num `async(Dispatchers.IO)` e quem
  espera, ao ser cancelado, chama `disconnect()`. **O `OpenAiCompatibleTextGenerator` tem o mesmo defeito** (fora do escopo: ver pendências).
- **Inversão de máscara**: `ImageBackend.invertsMask` (A1111 true → `inpainting_mask_invert`; ComfyUI false → o
  `RemoteImageGenerator` inverte o alfa em Kotlin antes de codificar; o backend recebe `maskInvert=false`). Provado nos dois caminhos
  em `ImageFactoriesTest`.
- **Tamanho**: o codec redimensiona init/máscara/controle para o w×h (múltiplo de 8) do pedido, então o grafo do ComfyUI não precisa
  de nó de escala (nenhum foi conferido no fonte). Proporção diferente é distorcida — quem chama escolhe w×h.
- **ComfyUI img2img/inpaint com `count` > 1**: `VAEEncode` dá um latente só; o backend faz **uma execução por imagem** (seed, seed+1…).
  txt2img usa `batch_size`.
- **Fluxo do usuário**: `supports` = TXT2IMG sempre + o que tiver marcador de imagem (como a §19.5); um marcador de imagem sem a
  imagem no pedido vira `Unsupported` no preenchimento. JSON que não está no formato API (`{"nodes":…}` do editor) → `Unsupported`.
- **Canny no ComfyUI**: limiares fixos 0,4/0,8. **Rabisco vai direto** ao ControlNet, sem pré-processador (o A1111 usa
  `t2ia_sketch_pidi`); um rabisco preto no branco pode precisar de inversão para o ControlNet de scribble — não testado com servidor real.
- **Tradução**: o ML Kit não detectou o idioma de "poster de cafe artesanal" (`could not detect the language`; texto curto sem
  acento). Como o app é em português, `translateToEnglish` tenta de novo com `from = "pt"`. A 1ª tradução no emulador baixou o
  modelo pt→en (~35 s em "Traduzindo o pedido").
- **Resultados** ficam num `object ImageGenMemory` (estado do processo) para sobreviver à ida ao editor; reinstalar/encerrar o
  processo limpa.
- Testes JVM: `Bitmap` vem de `sun.misc.Unsafe.allocateInstance` (stub nunca lido) e o codec é falso; o servidor falso atende cada
  conexão numa thread (o A1111 consulta `/progress` e chama `/interrupt` com o `txt2img` pendurado).
- Teste manual: os chips de formato quebravam ("Paisagem 768×512" em 4 linhas) → `FlowRow`; o aviso "Informe o endereço" ficava depois
  de salvar → `save()` limpa a mensagem.
- Numa rodada do teste manual a geração parou depois de "Traduzindo" sem mensagem nem requisição, e não se repetiu. Hipótese (não
  confirmada): a automação por adb saiu e voltou à tela durante a geração (sair cancela o job, como no "Texto com IA", e o
  `remember` zera o status).

**Pendências**
- **Servidor real** (A1111/Forge com `--api`, ComfyUI) — só o falso foi usado. Conferir com ele: ControlNet canny/scribble (nomes dos
  modelos padrão, inversão do rabisco), `--api-auth`, imagem JPEG/WEBP de `samples_format`, fluxo próprio do ComfyUI (SDXL/Flux).
- ControlNet e Cancelar pela interface; fração de progresso do A1111 na barra.
- A tela não expõe os campos de ControlNet (A1111 tem padrões SD1.5; **no ComfyUI fica sem suporte** até preencher
  `cannyControlNet`/`scribbleControlNet` no `provider_config.json`) nem o fluxo próprio — só pelo arquivo de config.
- Trocar de servidor mantém o texto da URL do anterior (a cadeia guarda um provedor só).
- **Corrigir o cancelamento do `OpenAiCompatibleTextGenerator`** com o mesmo padrão do `Http` (registro próprio; não feito aqui).
- Modo "IA generativa" da foto de produto (inpaint com `maskInvert`), upscale depois da geração (fase 7) e on-device (`:ai:ondevice-sd`).
- O emulador `pp_api34` ficou com a cadeia de imagem em A1111 `http://10.0.2.2:7860` e a credencial `image.a1111` salva
  (servidor falso já parado). Há também um aparelho físico (moto g86 5G) conectado por adb sem fio; não foi usado.

## 20. Fase 7 — mockup e upscale (análise na sessão 15, 2026-10-15)
Etapa analítica; nada de código foi escrito. Decisões do dono desta sessão na §20.4. A implementação começa pela task 1
(medição no moto), que decide a variante do modelo.

### 20.1 Símbolos abertos e o que se descobriu
- `core/ai-api/.../Types.kt` — **`Upscaler`, `MockupTemplate` e `MockupRenderer` não existem no código** (só na §3 deste
  doc). `Provider.kt::Capability` já tem `UPSCALER` e `MOCKUP_RENDERER`.
- `app/.../AppGraph.kt` — cadeias por `chain(cap, Type::class.java)` + `Chained*` (`FallbackChain`); `composer =
  LocalSceneComposer()` é **direto, sem cadeia** (precedente para o mockup local). `DEFAULT_CONFIG` não tem `UPSCALER`.
  `editorAi.servedBy` mapeia `"BACKGROUND_REMOVER"|"INPAINTER"|"TEXT_GENERATOR"` → cadeia (falta `"UPSCALER"`).
  `checker`: `Requirement.Model` atendido se `Ready` **ou** se o catálogo tem `bundledAsset`.
- `ai/onnx/.../MiGanInpainter.kt` + `OnnxMiGanFactory` — padrão do provedor ONNX empacotado: sessão preguiçosa por caminho
  (`OrtException` → `AiError.Unavailable([Model(id)])`), `Mutex`, `Dispatchers.Default`, `ensureActive()` antes/depois do
  `run`, saída que não é tensor → `InvalidOutput`; factory com `requirements = [Model(id)]` e `create` via
  `ModelManager.ensureReady(id) ?: throw ModelNotDownloaded`.
- `app/src/main/assets/models/models.json` — **um arquivo por modelo** (`file`, `sizeBytes`, `sha256`, `bundledAsset`).
- `editor/.../EditorHandlers.kt::registerAi` — `ai.upscale` responde `UNSUPPORTED` ("upscale chega na fase 7"). Padrão:
  `assets.decode(src, maxSide)` (padrão `EditorAssets.MAX_SIDE = 4096`, **reduz em silêncio** o que passar) → provedor →
  `blobResult(bmp, capability)` = `{url, width, height, servedBy}`.
- `editor-web/src/main.ts` (~l.310) — botões da imagem selecionada (`✨ Remover fundo/objeto/texto`, `✨ Vetorizar`); o
  resultado entra por `editor.replaceImage(img, url)` (`editor.ts:463`): `img.setSrc(url)` mantendo os filtros.
- **Fabric 7 (`node_modules/fabric/src/shapes/Image.ts`)**: `setSrc` → `setElement` → `_setWidthHeight()` põe
  `width/height` = tamanho natural do elemento novo; `scaleX/Y` e `cropX/Y` ficam como estavam. Consequências:
  (a) um resultado 2× apareceria com o **dobro do tamanho** no canvas → o upscale precisa de `scaleX/Y ÷ f`,
  `cropX/Y × f` e `width/height = antigos × f`; (b) **suspeita de defeito existente**: numa imagem **recortada** (crop do
  Fabric), as ações de mesmo tamanho (remover fundo/objeto/texto) também resetam `width/height` → o recorte se desfaz.
  Não verificado na tela (registro próprio, §21.5).
- `editor/.../EditorSession.kt::export` — `action` = `save|share|print` → `host.export(format, action, name, bytes)`;
  ponto de entrada para "Ver em mockup" (ação nova `mockup`).
- `feature/product/.../SceneLibrary.kt` — padrão de conteúdo empacotado: `assets/content/<dir>/index.json` com
  `kotlinx.serialization` (`ignoreUnknownKeys`), `thumb()`/`image()` por `AssetManager`. Os cenários atuais são
  procedurais (`tools/gen_scenes.py`).
- `feature/product/.../MaskViewport.kt` — `Fit.of(cw, ch, iw, ih)` + `MaskViewport(zoom, offsetX, offsetY)` com
  `transform(...)`/`clamped(...)`, zoom 1–8×, testado (`MaskViewportTest`): base para o "Ajustar" do mockup.
- `app/.../ImageGenScreen.kt` — resultados em `ImageGenMemory.results`; `ResultsGrid(results) { onOpenInEditor(bmp) }`.
- `app/.../HomeScreen.kt` — lista de `HomeCard(título, subtítulo, onClick)`: entrada do "Mockup".
- **Original (só especificação)**: upscale = A1111 `extra_single_image` com `upscaler_1 = "R-ESRGAN 4x+"` e
  `upscaling_resize = 2`, aplicado ao resultado da foto de produto (`ProductPromptOutputFragment.prepareUpscaleApiRequest`).
  Mockup = `MockupTemplate{name, preview, count, inputRatio[]}`: **N espaços**, cada um com proporção; o usuário escolhe
  uma imagem por espaço (SVG recusado), recorta no `CropDialog` com a proporção do espaço, e o servidor
  `create-mockup-async` recebe `{image: [{image, width, height}], bgColor: "", map: <nome do template>}` (job assíncrono;
  modelo invisível). `MockupSelectImageFragment`, `MockupOutputFragment.prepareApiRequest`.

### 20.2 Artefatos e APIs conferidos
- **`qualcomm/Real-ESRGAN-General-x4v3`** (HF, `license: bsd-3-clause`; o `LICENSE` aponta para o BSD-3 do
  xinntao/Real-ESRGAN). Release **v0.64.0** (`release_assets.json`; zips no S3, `Last-Modified 2026-10-06`), baixados para
  o scratchpad da sessão 15 (`dl_esrgan/`):
  | Variante | zip | `.onnx` (sha256) | `.data` (sha256) |
  |---|---|---|---|
  | float | 4 540 895 B | 161 087 B `09e6b675…58e7` | 4 836 096 B `512d0ec9…f37f` |
  | w8a8 | 1 691 102 B | 111 439 B `8fd7f588…50cc` | 4 836 096 B `f182ee51…0e0d` |
  URLs: `https://qaihub-public-assets.s3.us-west-2.amazonaws.com/qai-hub-models/models/real_esrgan_general_x4v3/releases/v0.64.0/real_esrgan_general_x4v3-onnx-{float,w8a8}.zip`.
  **Pesos em dados externos** (`.data` ao lado do `.onnx`).
- I/O (`metadata.json` do pacote; nomes `image`/`upscaled_image` conferidos nos bytes): float `image` f32 **[1,3,128,128]**
  RGB 0..1 → `upscaled_image` f32 **[1,3,512,512]** 0..1. w8a8: entrada **uint8** (scale 1/255, zp 0), saída **uint8**
  (scale 0,0049723, zp 25 → faixa −0,12..1,14: **clamp** obrigatório).
- Operadores (contagem de nomes nos bytes): Conv ×34, PRelu, DepthToSpace, Resize (+ Add e Q/DQ no w8a8); **só domínio
  padrão**, nada `com.qualcomm`. Gerado para ORT 1.27.1 (o projeto usa 1.31.0).
- Modelo: SRVGGNetCompact, **1,21 M parâmetros**. Os tempos do README são só de NPU Snapdragon (2,7–10 ms por tile float);
  nada para CPU MediaTek. **Estimativa minha, não medida**: ~1,2 M MAC por pixel de entrada → ~20 GMAC por tile de 128²;
  em 4× A78 fp32, algo como 0,5–1,5 s por tile → 512² (25 tiles) em 15–40 s; 1024² (100 tiles) em 1–2,5 min.
- `.pth` oficial: `github.com/xinntao/Real-ESRGAN/releases/download/v0.2.5.0/realesr-general-x4v3.pth` (4 885 111 B), só
  se for preciso reexportar com entrada dinâmica (exige torch no PC).
- **ORT 1.31.0 Java** (`javap` no `classes.jar` do AAR do cache do Gradle): `OrtSession.SessionOptions.addXnnpack(Map<String,String>)`,
  `addNnapi()`, `addNnapi(EnumSet<NNAPIFlags>)`, `addConfigEntry(String,String)`. O AAR traz `jni/arm64-v8a/libonnxruntime.so`.

### 20.3 Hipóteses descartadas
- **RealESRGAN_x4plus** (o "R-ESRGAN 4x+" do original; RRDB, 16,7 M parâmetros, ~64 MB): ~14× o x4v3 por pixel → minutos
  por imagem na CPU do moto. Fica como possível provedor **remoto** (A1111 `extra_single_image`) pela cadeia, fora da fase 7.
- **Imagem inteira numa só passada**: a entrada é fixa em 128²; mesmo dinâmica, cada tensor de 64 canais a 1024² tem
  256 MB → tiles são obrigatórios.
- **×2 = rodar ×4 na imagem toda e reduzir no fim**: o intermediário 4× de uma 2048² teria 8192² (256 MB ARGB). Reduzir
  **cada tile** de 512² para 256² antes de gravar na saída.
- **Empacotar `.onnx` + `.data` como estão**: o catálogo e o `LocalModelManager` lidam com um arquivo por modelo. Mais
  simples **juntar no PC** num `.onnx` único (`onnx.load` com dados externos → `onnx.save` sem dados externos; `pip install
  onnx` no PC) e registrar o sha256 do arquivo juntado. Estender o `ModelManager` para vários arquivos: descartado.
- **fp16**: no CPU do ORT a maioria dos kernels é fp32 (casts), sem ganho esperado. A medição compara float × w8a8 × XNNPACK.
- **Mockup generativo** (como o servidor do original): não é offline. O contrato mantém a porta (§3, "modo IA generativa").
- **Uma homografia para todo template**: não cobre superfícies curvas (caneca, garrafa, camiseta dobrada). Na fase 7, só
  planas (decisão do dono); curvas depois, com malha ou mapa UV (registro próprio).
- **Mapas de sombreamento/deslocamento como arquivos por template**: para superfície plana, a área em branco da própria foto
  base já tem a luz. Sombreamento = luminância da área do espaço normalizada pelo percentil 90 dela; deslocamento = passa-alta
  dessa luminância. Os campos `RgbaImage?` da §3 viram **forças** (`Float`); um template que precise de mapa próprio volta a
  ter o campo quando existir.
- **Reduzir em silêncio a imagem grande antes do upscale** (o `decode` atual faz isso até 4096): ampliar uma imagem que acabou
  de ser reduzida não faz sentido. Acima do limite → erro com mensagem.

### 20.4 Decisões
Do dono (sessão 15): upscale no **editor** e no resultado de **Gerar imagem** (não na foto de produto); mockup só com
**superfícies planas**; templates **procedurais de teste** na fase 7 (os definitivos num trabalho só de conteúdo);
encaixe por **corte central + "Ajustar"** (recorte com proporção travada).

**Upscale**
1. Modelo **realesr-general-x4v3** (pacote da Qualcomm, BSD-3), **empacotado** (~5 MB; o orçamento da §8 previa 17 MB),
   juntado num `.onnx` único. **Variante (float ou w8a8) e EP (CPU padrão ou XNNPACK) definidas pela task 1.**
2. Provedor `onnx.realesrgan-x4v3`, `Capability.UPSCALER`, cadeia padrão `[onnx.realesrgan-x4v3]`. Um upscaler remoto
   (A1111) pode entrar depois na mesma cadeia.
3. Contrato: `interface Upscaler { suspend fun upscale(image: RgbaImage, factor: Int, progress: ProgressSink? = null): RgbaImage }`;
   `factor` ∈ {2, 4} (outro → `AiError.Unsupported`). O modelo é ×4; ×2 = cada tile de 512² reduzido para 256² (média 2×2).
4. Tiles em Kotlin puro (`:core:imaging`, testável na JVM): entrada 128², **sobreposição de 8 px** de cada lado (miolo de
   112²); bordas da imagem por replicação (o tile tem sempre 128²); só o miolo de cada tile vai para a saída. Progresso =
   tiles feitos/total; `ensureActive()` entre tiles. **Atenção**: o x4v3 tem 33 convoluções 3×3 em sequência → campo
   receptivo teórico de ~33 px de entrada, maior que 8 px. A costura não é exata por construção; o efetivo é bem menor na
   prática, mas isso **se prova com o modelo real** (task 4: tiles com sobreposição 8 × 24 na mesma imagem). Se a diferença
   passar do limite, subir a sobreposição (custo: 8 → 16 px = miolo 96², +36% de tiles).
   **Corrigido pela medição (§20.6): sobreposição 24** (8, 16 e 20 reprovaram; miolo 80², ~1,96× os tiles de 8).
5. Limites: saída ≤ **16 MP** → entrada ≤ 1 MP em ×4 e ≤ 4 MP em ×2; acima → `Unsupported` com mensagem. O limite pode
   baixar pelo tempo medido na task 1 (ex.: ≤ 1024² em ×2 se 100 tiles passarem de ~1 min). Memória: entrada + `IntArray` de
   saída (64 MB a 16 MP) + `Bitmap` (64 MB). **Corrigido (§20.6): entrada ≤ 1 MP (1024²) nos dois fatores** — com
   sobreposição 24, 1024² = 169 tiles ≈ 93 s.
6. Alfa: o modelo só faz RGB. O alfa é ampliado por interpolação bilinear; antes de rodar, o RGB **sangra** 8 px para dentro
   da área transparente (senão o preto sob alfa 0 vira halo escuro nas bordas de recortes e logos).
7. Editor: botão **"✨ Melhorar resolução"** (escolha 2×/4×) → `ai.upscale {src, factor}` → `editor.replaceImageScaled(img,
   url, f)` (escala ÷ f, crop × f, mesmo tamanho na tela). Gerar imagem: botão **"Ampliar 2×"** em cada resultado,
   substituindo-o na grade.

**Mockup**
8. Contrato (substitui o da §3):
   ```kotlin
   /** quad: 4 cantos em px da base, na ordem TL, TR, BR, BL. aspect = largura/altura do design esperado. */
   data class MockupSlot(val quad: List<PointF>, val aspect: Float, val mask: Mask? = null)  // mask null = o quad inteiro
   data class MockupTemplate(val id: String, val base: RgbaImage, val slots: List<MockupSlot>,
                             val shading: Float = 1f, val displacement: Float = 0f)
   interface MockupRenderer { suspend fun render(designs: List<RgbaImage>, template: MockupTemplate): RgbaImage }
   ```
   `designs.size != slots.size` → `Unsupported`.
9. `PerspectiveMockupRenderer` (`:core:imaging`, puro sobre `Raster`): homografia do retângulo do design para o `quad` (DLT
   de 4 pontos, sistema 8×8); para cada pixel da caixa do quad, mapeamento **inverso** e amostragem bilinear; borda do quad
   com antialias (cobertura por 4×4 subamostras nos pixels da borda); multiplicação pelo sombreamento (`shading`) e
   deslocamento opcional (`displacement`, padrão 0 para papel liso). Local e direto, como o `LocalSceneComposer` (sem
   cadeia; `MOCKUP_RENDERER` fica sem uso até existir um modo generativo).
10. Conteúdo: `assets/content/mockups/index.json` = `{id, name, category, file, thumb, slots: [{quad: [x,y]×4, aspect,
    mask?}], shading, displacement}`; templates de teste gerados por `tools/gen_mockups.py` (pôster na parede, cartão
    inclinado sobre mesa, frente de caixa, tela de celular): base com a área do espaço em branco e luz procedural, quad
    exato no JSON. Registrar em `content/SOURCES.md`.
11. Fluxo `:feature:mockup` (módulo previsto na §2): Home → card **"Mockup"** → grade de templates → para cada espaço, uma
    imagem (seletor do sistema; ou o design atual, quando aberto pelo editor) com **corte central** na proporção do espaço e
    botão **"Ajustar"** (tela de recorte com proporção travada, pinça/arrasto sobre `Fit`/`MaskViewport`) → render →
    prévia → Salvar / Compartilhar (`EditorExports.save/share`) / Abrir no editor. Do editor: ação de exportar
    **"Ver em mockup"** (`export` com `action: "mockup"` → `ExportAction.MOCKUP` → o host abre o fluxo com o PNG no espaço 1).
12. Saída na resolução da base (templates de 1440–2048 px).

### 20.5 Tasks (arquivo/símbolo → teste que prova)
1. **Medir antes de escolher** — juntar float e w8a8 num `.onnx` único no PC (`tools/merge_onnx.py`, sha256 registrado);
   `DeviceProbe#esrgan` (args `variant=float|w8a8`, `ep=cpu|xnnpack`): 20 tiles de 128² com entrada real (crop de foto),
   ms por tile (mediana, sem o 1º) e VmHWM, um `am instrument` por combinação, no moto (USB `ZY32LMNN9B`). Gravar a tabela
   na §20.6 e escolher: a combinação mais rápida cuja saída difira da float em ≤ 2/255 de média (w8a8) — ou float se o w8a8
   piorar visivelmente. Confirmar também os nomes de I/O pela sessão (`session.inputNames/outputNames`).
2. `core/ai-api/.../Types.kt`: `Upscaler`, `MockupSlot`, `MockupTemplate`, `MockupRenderer` (§20.4 itens 3 e 8);
   `FallbackChain.kt`: `ChainedUpscaler` (padrão do `ChainedInpainter`) → JVM: teste de cadeia (provedor sem modelo cai
   para o próximo), no estilo do `FallbackChainTest`.
3. `core/imaging/.../Tiles.kt` (novo): `upscaleTiled(src: Raster, factor, tile = 128, overlap = 8, run: (FloatArray) -> FloatArray)`
   + sangria de cor + alfa bilinear → JVM: (a) com um "modelo" falso de vizinho mais próximo ×4, a saída em tiles é **igual
   pixel a pixel** à de uma passada única (prova "sem costura"); (b) com um falso cujo campo receptivo é 3×3 (média local), a
   saída em tiles é igual à passada única no miolo (prova que 8 px de sobreposição bastam para campo ≤ 8); (c) ×2 = média
   2×2 do ×4; (d) tamanhos que não são múltiplos de 112 (1×1, 113×7, 300×129); (e) halo: círculo opaco sobre transparente →
   pixels da borda com alfa > 0 sem escurecer (luminância ≥ 90% da do círculo); (f) limite de 16 MP → `Unsupported`.
4. `ai/onnx/.../RealEsrgan.kt` (pré/pós puro: ARGB → CHW 0..1, saída → clamp; e a (de)quantização se for w8a8) +
   `OnnxRealEsrganUpscaler` + `OnnxRealEsrganFactory` (padrão do MI-GAN), entrada no `models.json` com `bundledAsset`,
   registro e `DEFAULT_CONFIG[UPSCALER]` no `AppGraph`, `"UPSCALER"` no `servedBy` → JVM: `RealEsrganTest` (pré/pós,
   clamp); `ImageGenConfigTest`/teste de config: cadeia padrão do upscaler; instrumentado: 512² real em ×2 e ×4 no moto
   (tempo, VmHWM, PNG em `docs/fase7_amostras/`) e **prova de costura com o modelo real**: a mesma foto com sobreposição 8 e
   24 → diferença máxima ≤ 3/255 e média ≤ 0,5/255 (senão subir a sobreposição; item 4 da §20.4).
5. Editor: `EditorHandlers` `ai.upscale {src, factor}` (decode **sem** redução: acima do limite → `INVALID` com mensagem);
   `editor-web`: botão "✨ Melhorar resolução" + `replaceImageScaled` → vitest: depois do `replaceImageScaled(img, url, 2)`,
   `getScaledWidth/Height` e `cropX/Y × 2` conferem; `protocol.test.ts` deixa de esperar `unsupported` para `ai.upscale`.
6. `ImageGenScreen`: "Ampliar 2×" por resultado (substitui na grade; progresso; erro em snackbar) → manual no moto.
7. `core/imaging/.../Homography.kt` (novo): DLT 4 pontos + inversa → JVM: os 4 cantos do retângulo caem no quad com erro
   **< 1 px** (critério da §10) em quads convexos variados; ponto central de um quad paralelogramo = centro geométrico;
   quad degenerado (3 pontos colineares) → erro claro.
8. `core/imaging/.../PerspectiveMockupRenderer.kt` → JVM sobre `Raster`: design de cor sólida num quad dentro da base de
   cor sólida → pixels no miolo do quad = cor do design × sombreamento (1 na base branca), fora = base intacta; borda com
   cobertura parcial (valores intermediários); xadrez → linhas retas continuam retas (amostras colineares); `shading` com
   base em degradê escurece na mesma proporção; `designs.size != slots.size` → `Unsupported`.
9. `tools/gen_mockups.py` + `assets/content/mockups/` (index + 4 templates + thumbs) + `MockupLibrary` (padrão do
   `SceneLibrary`) → JVM: parse do index; todo quad dentro da base, convexo, e `aspect` > 0.
10. `:feature:mockup` (módulo novo em `settings.gradle.kts`, card na Home, ação `mockup` no `EditorSession.export` →
    `ExportAction.MOCKUP`), corte central (`centerCrop(bmp, aspect)`, JVM: proporção de saída = `aspect` ± 1 px) e tela
    "Ajustar" sobre `Fit`/`MaskViewport` → manual no moto: Home → Mockup → template → foto → Ajustar → render → Salvar;
    editor → Exportar → Ver em mockup.
11. Atualizar a §3 (contratos), a §4.4 (cadeia do upscaler) e a §8 (tamanho real do modelo) com o que foi feito.

### 20.6 Task 1 — medição do Real-ESRGAN no moto g86 (sessão 16, 2026-10-15)
**Decisão: variante `float`, EP XNNPACK** (sessão com `setIntraOpNumThreads(1)`, `session.intra_op.allow_spinning=0`,
`addXnnpack(mapOf("intra_op_num_threads" to "4"))`). O w8a8 é 2,2× mais rápido, mas reprova o critério (≤ 2/255) e piora
2 dB contra a referência.

**Arquivos juntados** (`tools/merge_onnx.py`: `onnx.load` com dados externos → `onnx.save` sem; confere com o ORT do PC
que entrada e saída dão o mesmo resultado → diferença máxima **0,0** nos dois):
| Variante | `.onnx` juntado | sha256 | tipos de I/O |
|---|---|---|---|
| float | 4 994 683 B | `c6f13f8866203bc2aae3977eae6bce546b861e9e14e39682c03b17c9d6698c48` | f32 → f32 |
| w8a8 | 4 945 035 B | `8d2513769842a47222dd0a5fa4601f62336e195eac2a558b01dfdbe5607d0a45` | u8 → u8 |
Os zips v0.64.0 baixados de novo conferem com os sha256 da §20.2. Operadores: float = Conv 34, PRelu 33, DepthToSpace,
Resize, Add (opset 21, IR 10); w8a8 = os mesmos + DequantizeLinear 171 / QuantizeLinear 137, pesos UINT8.
Nomes pela sessão no moto (`inputInfo`/`outputInfo`): **`image` [1,3,128,128] → `upscaled_image` [1,3,512,512]**, FLOAT
no float e UINT8 no w8a8 (confirma a §20.2). Sessão criada em 47–90 ms.

**Medição** (`DeviceProbe#esrgan`, moto g86 USB `ZY32LMNN9B`, um `am instrument` por linha; 20 tiles de 128² do
`shoe.jpg` numa grade 5×4; tempo só do `run` + cópia da saída; mediana sem o 1º; VmHWM do processo, que parte de ~205 MB):
| Variante / EP | 1º tile | mediana | min–max | VmHWM |
|---|---|---|---|---|
| float / CPU (4 threads) | 780 ms | 784 ms | 693–1081 | 305 MB |
| **float / XNNPACK** | 667 ms | **554 ms** | 506–711 | 351 MB |
| w8a8 / CPU | 380 ms | **247 ms** | 226–318 | 289 MB |
| w8a8 / XNNPACK | 643 ms | 553 ms | 505–648 | 287 MB |
Memória não é problema (+100–150 MB). O w8a8 no XNNPACK não ganha nada sobre o float (o EP não usa o caminho inteiro).

**Qualidade** (`esrgan_pc.py`/`esrgan_check.py` no scratchpad; o probe grava a entrada e a saída do tile 7 em
`files/probe/`):
- Moto × PC na mesma entrada: float/CPU e float/XNNPACK **iguais ao PC** (máx. 1/255); w8a8 do moto difere do w8a8 do PC
  em 3,4/255 de média (kernels inteiros de ARM × x86).
- **w8a8 × float**: PC, 20 tiles: média **6,2/255**, p99 33, máx. 185; moto, tile 7: média **3,8/255**, máx. 44. Reprova
  o ≤ 2/255. Visualmente (tile 7, lado a lado) o w8a8 perde contraste nos realces.
- Com referência (original 1920×1440 → reduzido 4× bicúbico → 12 tiles → PSNR contra o original): **float 28,23 dB**,
  **w8a8 26,17 dB**, bicúbico 28,89 dB. O PSNR favorece o bicúbico (liso) contra um modelo GAN — não é a métrica do
  Real-ESRGAN —, mas a queda de 2 dB do w8a8 em relação ao float confirma que ele piora.

**Consequências para as tasks seguintes**
- Task 4: empacotar o **float** juntado como `models/realesr_general_x4v3.onnx` (4 994 683 B, sha256 acima); entrada
  `FloatBuffer` CHW 0..1, saída `floatBuffer` com clamp 0..1 (sem (de)quantização). Sessão com as opções do XNNPACK acima;
  se o `addXnnpack` lançar `OrtException` (aparelho/ABI sem o EP), cair para CPU com 4 threads em vez de falhar.
- **Tempo estimado** (554 ms/tile, miolo 112² com sobreposição 8): entrada 512² = 25 tiles ≈ **14 s**; 1024² (1 MP em ×4,
  ou ×2 de 1024²) = 100 tiles ≈ **55 s**; 2048² em ×2 (4 MP → 16 MP) = 361 tiles ≈ **3,3 min**. Pela regra do item 5 da
  §20.4 (baixar se 100 tiles passarem de ~1 min), **o limite de 16 MP de saída fica**; o progresso por tile e o cancelamento
  entre tiles são obrigatórios. Se a costura pedir sobreposição 16 (task 4), os tempos sobem ~36%.

**Comandos que provaram algo**
- `python tools/merge_onnx.py <dl>/float/.../real_esrgan_general_x4v3.onnx <scratch>/merged/realesr_general_x4v3_float.onnx`
  (idem w8a8) → tamanhos/sha256 da tabela e "diferença máxima … 0.0".
- Modelo no aparelho: `adb -s ZY32LMNN9B exec-in run-as com.productphoto.offline sh -c 'cat > files/probe/realesr_general_x4v3_float.onnx' < <arquivo>`
  e `run-as … sha256sum files/probe/*` (confere com a tabela).
- `ANDROID_SERIAL=ZY32LMNN9B ./gradlew :app:installDebug :app:installDebugAndroidTest`, depois
  `adb shell am instrument -w -e class 'com.productphoto.app.DeviceProbe#esrgan' -e variant float -e ep xnnpack com.productphoto.offline.test/androidx.test.runner.AndroidJUnitRunner`
  e `adb logcat -d -s DeviceProbe:I`.

**Hipóteses descartadas / tropeços**
- `pip install onnx` no Python 3.14 do PC: `RecursionError` no `SSLContext.verify_mode` **do próprio pip** (não do pacote).
  Contorno: wheels baixadas com curl pela API JSON do PyPI (`onnx-1.23.2-cp312-abi3-win_amd64.whl`, sha256 `9b382ba8…02de`;
  `ml_dtypes-0.6.0-cp314-cp314-win_amd64.whl`, `d574c2b2…3977`) e `pip install --no-deps --no-index`.
- Modelo em `/sdcard/Android/data/<pkg>/files/probe` por `adb push`: a pasta criada pelo shell fica com dono `shell` e o app
  não a lê (`Permission denied` no `run-as`) → `files/` interno via `run-as` (pasta do shell apagada).
- `./gradlew installDebugAndroidTest` (sem `:app:`) instala o teste de todos os módulos e falha no `:data`
  (`INSTALL_FAILED_VERIFICATION_FAILURE`, Play Protect) → usar sempre `:app:installDebugAndroidTest`.
- `ORT` é `implementation` em `:ai:onnx` → o androidTest do app não via `ai.onnxruntime`: adicionado
  `androidTestImplementation(libs.onnxruntime.android)` em `app/build.gradle.kts`.
- **w8a8**: descartado pela qualidade (acima). **fp16**: não medido (§20.3).
- Não medido: 8 threads (o moto tem 8 núcleos; mantido 4, como no MI-GAN).

### 20.7 Tasks 2–4 — resultado (sessão 16, 2026-10-15)
**Task 2 (feita)** — `Types.kt`: `Upscaler`, `MockupSlot` (com `PointF`, como decidido), `MockupTemplate`, `MockupRenderer`;
`FallbackChain.kt`: `ChainedUpscaler`. Teste `ChainedUpscalerTest` (2): provedor sem modelo cai para o próximo (fator e
progresso repassados, `lastServedBy` = o segundo) e requisito não atendido pula o provedor. `stubImage()` do
`ImageRequestTest` passou de `private` a `internal` para ser reaproveitado. **Atenção para a task 8**: com
`isReturnDefaultValues`, `PointF(x, y)` nos testes JVM vira (0, 0) em silêncio → o renderer puro em `:core:imaging` recebe
os cantos como `FloatArray`/tipo próprio (padrão `PlacementPx` do `SceneCompositor`) e só o adaptador lê `PointF`.

**Task 3 (feita)** — `core/imaging/.../Tiles.kt::upscaleTiled(src, factor, tile = 128, overlap = 8, progress, run)` +
`bleed` (8 anéis, média dos vizinhos 8-conexos já coloridos) + alfa bilinear (só se a imagem tiver alfa < 255).
`UPSCALE_MAX_INPUT_PIXELS = 1024²` (acima → `Unsupported` com mensagem); fator ≠ 2/4 → `Unsupported`; saída do modelo
com tamanho errado → `InvalidOutput`; `ensureActive()` antes de cada tile. `TilesTest` (9): vizinho mais próximo em tiles
= passada única pixel a pixel; média 3×3 e 17×17 (raio 1 e 8 = sobreposição) sem costura; **controle**: raio 9 mostra a
costura (prova que o teste pega o defeito); ×2 = média 2×2 do ×4 (±1 de arredondamento); 1×1, 113×7, 300×129 com contagem
de tiles no progresso; halo (círculo opaco sobre transparente, luminância ≥ 90% e borda parcial; controle sem sangria
escurece); > 1 MP e fator 3 → `Unsupported`; saída errada → `InvalidOutput`.

**Task 4 (feita)** — `ai/onnx/.../RealEsrgan.kt` (`input`/`output` + constantes; `OVERLAP = 24`),
`RealEsrganUpscaler(modelFile, overlap)` (`Mutex`, `Dispatchers.Default`; sessão XNNPACK e, se lançar `OrtException`,
CPU com 4 threads; `OrtException` na CPU → `Unavailable([Model])`) + `OnnxRealEsrganFactory` (`onnx.realesrgan-x4v3`,
"Real-ESRGAN"). Modelo em **`ai/onnx/src/main/assets/models/realesr_general_x4v3.onnx`** (os empacotados ficam nos assets
do `:ai:onnx`, não do `:app`); entrada `realesr-general-x4v3` no `models.json` com `bundledAsset` e sem `urls`. `AppGraph`:
registro, `val upscaler = ChainedUpscaler(...)`, `DEFAULT_CONFIG[UPSCALER] = [onnx.realesrgan-x4v3]`, `"UPSCALER"` no
`servedBy`. JVM: `RealEsrganTest` (3: buffer direto, tamanho errado → `InvalidOutput`, >1/<0/NaN → 255/0/0) e
`UpscalerConfigTest` (2: cadeia padrão; entrada do catálogo = tamanho e sha256 do arquivo empacotado).

Instrumentado no moto (`DeviceProbe#upscale -e factor 2|4`; 512² = miolo do `shoe.jpg` reduzido):
| Sobreposição | ×2 512² → 1024² | ×4 512² → 2048² | tiles | VmHWM (antes ~214 MB) |
|---|---|---|---|---|
| 8 (descartada) | 13,3 s | 14,1 s | 25 | 360 / 348 MB |
| **24** | **26,7 s** | **26,9 s** | 49 | 350 / 341 MB |
PNGs (sobreposição 24) em `docs/fase7_amostras/` (`upscale_in_512.png`, `upscale_x2.png`, `upscale_x4.png`); recorte
conferido: bordas mais nítidas, ruído limpo (o general-x4v3 alisa textura fina), sem emenda visível.

**Prova de costura com o modelo real** (`RealEsrganSeamInstrumentedTest`, ×4 de 512², args `-e a`/`-e b`; critério máx.
≤ 3/255 e média ≤ 0,5/255): 8×24 → máx. **22**, média 0,070 (**reprovou** o 8 da §20.4); contra 32: 8 → 22 / 0,070;
16 → 13 / 0,024; 20 → 6 / 0,0065; **24 → 1 / 0,0017**; 24×40 → 1 / 0,0017 (convergiu). A média sempre baixa mostra que
são poucos pixels na emenda, mas 22/255 é visível em degradê. **Decisão: sobreposição 24**; o teste passou a comparar a de
produção (24) com 40 e passa.

**Tempo × limite**: com 24 o miolo é 80² → 1024² = 169 tiles ≈ **93 s** (> 1 min). Pela regra do item 5 da §20.4 o limite
baixou para **entrada ≤ 1 MP** (1024²) nos dois fatores (antes: saída ≤ 16 MP, ou seja, ×2 aceitava até 4 MP ≈ 6 min).
A tela (tasks 5–6) precisa de progresso por tile e cancelamento.

`./gradlew assembleDebug testDebugUnitTest`: verde, **143 testes JVM** (1 skipped; eram 127 + 16 novos). Um trace do daemon
do Kotlin apareceu numa rodada e não se repetiu (saída 0 nas duas).

**Próximo passo**: task 5 (editor: `ai.upscale` em `EditorHandlers`, botão e `replaceImageScaled` no `editor-web`).
Mensagem de limite já vem do `Unsupported` ("imagem de W×H passa de 1 MP"); o `decode` do editor precisa **não** reduzir
em silêncio (§20.3) — ler `EditorAssets.decode` antes.

### 20.8 Tasks 5–10 — resultado (sessão 16, 2026-10-15)
**Task 5 (editor)** — `EditorHandlers` `ai.upscale {src, factor}`: fator ≠ 2/4 → `INVALID`; `EditorAi.upscaler` null →
`UNSUPPORTED`; tamanho lido **sem decodificar** (`imageBounds`, `BitmapFactory.inJustDecodeBounds`) e > 1 MP → `INVALID`
"a imagem tem W×H; dá para melhorar até 1 MP"; decode com `maxSide = Int.MAX_VALUE` (sem a redução silenciosa); progresso
por tile; `blobResult(…, "UPSCALER")`. `AppGraph` passa `upscaler`. `editor-web`: botão **"✨ Melhorar resolução"** → folha
2× / 4×. **Decisão de implementação**: em vez de um `replaceImageScaled(img, url, f)` separado, o **`replaceImage`** passou a
deduzir o fator pela razão entre os tamanhos naturais (`getOriginalSize()` antes/depois do `setSrc`) e aplicar
`rescaledGeometry` (`src/imageGeometry.ts`: width/height e crop × f, escala ÷ f). Isso cobre o upscale **e corrige a
suspeita da §21.5** (recorte desfeito por removeBg/inpaint/removeText numa imagem recortada: fator 1 devolve a geometria
antiga). Não verificado na tela com uma imagem recortada. vitest `imageGeometry.test.ts` (3: ×2, ×4 com tamanho na tela
igual e crop × f; fator 1 = identidade); `protocol.test.ts` usa `ai.nothing` para o "sem handler". **Pendência**: a ponte
não tem cancelamento — um upscale de ~90 s no editor não se cancela (só sai do editor). → **Feito na §26** (falta o teste no moto).

**Task 6 (Gerar imagem)** — "Ampliar 2×" em cada resultado (se ≤ 1 MP), com o tamanho ao lado; usa o `running`/`stage` da
tela (barra por tile e "Cancelar", que cancela entre tiles); substitui o resultado na grade; erro de IA no texto de status
(a tela não usa snackbar). Clique na imagem continua abrindo no editor. **Não testável no moto agora**: a grade só aparece
com servidor configurado (cadeia de imagem desligada por padrão, §21).

**Task 7** — `core/imaging/.../Homography.kt`: DLT 8×8 com pivô parcial, `inverse()` pela adjunta, `rectToQuad`;
3 cantos colineares/repetidos → `IllegalArgumentException("… colineares")`; `isConvexQuad`. Quads como `FloatArray(8)`.
`HomographyTest` (5): cantos < 1 px em 4 quads (inclusive trapézio forte), ida e volta 1e-6, centro do paralelogramo,
degenerados, convexidade (laço e côncavo reprovam).

**Task 8** — `PerspectiveMockup.render(base, designs, slots: List<SlotPx>, shading, displacement)` puro sobre `Raster` +
adaptador `PerspectiveMockupRenderer : MockupRenderer` (converte `PointF`/`Mask`). Mapeamento inverso + bilinear; cobertura
por 4×4 subamostras só nos pixels cuja borda cruza (cantos discordam ou vértice dentro); design com alfa compõe por cima;
sombreamento = lum/p90 (pixels com cobertura ≥ 0,5), `1 − shading·(1 − s)`; deslocamento = passa-alta 9×9 da luminância
(desligado com 0). `PerspectiveMockupTest` (5): miolo = cor do design, fora intacto, borda parcial; fronteira de um design
meio preto/meio branco vira reta (desvio < 1 px); degradê escurece em lum/p90 (±2) e `shading = 0` não mexe; máscara;
contagem errada → `Unsupported`.

**Task 9** — `tools/gen_mockups.py` (semente 11) → `app/src/main/assets/content/mockups/`: `poster_wall` 1600², `card_table`
1800×1350, `box_front` 1600² (frente; lateral e topo sombreados), `phone_screen` 1440×1920; thumbs 320 px; `index.json`
`{version, mockups: [{id, name, category, file, thumb, width, height, slots: [{quad: [[x,y]×4], aspect}], shading,
displacement}]}` (largura/altura no índice para validar sem abrir a imagem); `SOURCES.md` próprio da pasta.
`:feature:mockup/MockupLibrary.kt` (`parseMockupIndex`, `MockupEntry.problems()`, `MockupLibrary.template()`).

**Task 10** — módulo **`:feature:mockup`** (settings + dependência do `:app`): `Crop.kt` (`centerCrop`, `CropState` com
zoom 1–8 e centro em px da imagem; `gesture()` limita o recorte à imagem — o `MaskViewport` do `:feature:product` não foi
reaproveitado para não criar dependência entre features; a conta é outra: moldura fixa e imagem atrás);
`MockupScreen(deps: MockupDeps, initial)` (grade → espaços com "Escolher imagem"/"Trocar"/"Ajustar" → render automático a
cada mudança → Salvar / Compartilhar / Abrir no editor; "Ajustar" com pinça/arrasto e "Centralizar"). App: card **Mockup**
na Home, `Screen.Mockup(initial)`, `AppGraph.mockupRenderer`/`mockupLibrary`; editor: `ExportAction.MOCKUP`
(`export` com `action: "mockup"`, SVG recusado), botão **"Ver em mockup"** na folha Exportar (PNG 1×) →
`EditorScreen(onMockup)` → `Screen.Mockup(bitmap)`. JVM `MockupTest` (4): índice empacotado válido (4 templates, arquivos
existem), problemas detectados (fora, proporção, laço, vazio), corte central com a proporção ± 1 px, centrado e máximo;
"Ajustar" parte do corte central, zoom 2 = metade, arrasto para no limite, zoom preso em 1–8.

**Teste manual no moto g86 (USB, 2026-10-15 19:20–19:31, tela em paisagem 2712×1220)**
- Home → **Mockup**: grade com os 4 templates (miniaturas certas).
- Editor (template "Promoção" 1080²) → Exportar → **Ver em mockup** → "Pôster na parede": o design entra no espaço 1
  sozinho, render com perspectiva, sombra e luz da parede, borda suave. Corte central do quadrado na proporção 0,707 (o
  selo "-30%" fica no limite — esperado). **Ajustar**: moldura fixa com o fora escurecido; arrasto move a imagem e para no
  limite; "Concluir" refaz o mockup (selo inteiro). **Salvar** → `Pictures/ProductPhoto/mockup.png` 1600² (cópia em
  `docs/fase7_amostras/mockup_poster_editor.png`; os arquivos de teste foram apagados do aparelho). Pinça não testada (adb).
- Mockup → **Abrir no editor** (1600²) → ✨ Melhorar resolução 2× → recusa com a mensagem do limite ("a imagem tem
  1600×1600; dá para melhorar até 1 MP"). **Corrigido**: o editor prefixava "Resultado inválido:" a todo `invalid`; o rótulo
  virou "Não foi possível" (serve para entrada recusada e saída ruim).
- Imagem 512² (amostra própria, posta na galeria e escolhida pelo seletor só por texto) → ✨ Melhorar resolução 2× →
  progresso "ampliando N%" → **~30 s** → a imagem fica **no mesmo lugar e tamanho na tela**, mais nítida.
- **Não verificado**: upscale numa imagem **recortada** (as alças de recorte do Fabric não respondem ao `input swipe` do
  adb); a geometria está provada no vitest. "Ampliar 2×" do Gerar imagem (precisa de servidor). Compartilhar.
- **Corrigido**: a tela "Ajustar" não tinha `Scaffold` (barra de baixo clara sobre o tema escuro, texto sob a barra de
  navegação lateral) → agora com `Scaffold` + `TopAppBar("Ajustar")`; reinstalado e conferido na tela (tema escuro, título, barra inferior legível).

## 21. Sessão 14 (2026-10-15): cancelamento do texto remoto, cadeia de imagem desligada, medições no moto g86

**Decisões do dono na abertura**: ordem da §19 do HANDOFF confirmada (1 cancelamento → 2 cadeia padrão → 3 moto g86 → 4 fase 7 →
5 fase 8). **Cadeia padrão de imagem: desligada** até existir o modelo no aparelho (fase 8); servidor só se o usuário configurar.

### 21.1 Símbolos abertos e o que se descobriu
- `ai/remote-http/.../OpenAiCompatibleTextGenerator.kt::generate` — `withContext(IO)`; registra
  `coroutineContext[Job]?.invokeOnCompletion { conn.disconnect() }` e faz a troca bloqueante no mesmo job. Em erro: `IOException` →
  `ensureActive()` e `AiError.Network`; `finally` dá `dispose` + `disconnect`. **Defeito** (já descrito na §19.7): o handler só
  dispara quando o job *termina*, e o job preso em `conn.responseCode`/leitura não termina até o servidor responder (ou até o
  `readTimeout` de 120 s) → "cancelar" não derruba a conexão.
- `ai/remote-http/.../image/Http.kt::call` — padrão correto: `coroutineScope { async(IO) { exchange } }`; quem espera
  (`await`) recebe `CancellationException` e chama `disconnect()`, o que solta a leitura bloqueante (IOException → `ensureActive`
  relança o cancelamento). Provado pelo `A1111BackendTest.cancel calls interrupt`.
- `OpenAiCompatibleTest` — servidor `ServerSocket` de uma thread que responde na hora; sem como segurar a resposta.
- `app/.../AppGraph.kt::DEFAULT_CONFIG` — `IMAGE_GENERATOR = [http.a1111]` sem URL (§19.5). `FileProviderConfigStore.load` faz
  `DEFAULT.capabilities + saved.capabilities`: uma config **já salva** guarda a cadeia que tinha (o emulador continua com A1111);
  só instalações novas ou arquivos sem a chave `IMAGE_GENERATOR` pegam o padrão novo.
- `app/.../ImageGenScreen.kt` — `imageGenStateOf(emptyList())` → `ImageServer.OFF`; com OFF, `needsServer = false` esconde URL,
  credencial e a parte de gerar; o `LaunchedEffect(loaded)` só pede URL se `server != OFF`. Ou seja: cadeia vazia já mostra
  "Desligado" sem mudar a tela. `ProviderConfig.withChain(cap, emptyList())` grava a chave com cadeia vazia.

### 21.2 Hipóteses descartadas
- Manter `invokeOnCompletion` e só baixar o `readTimeout`: não cancela, só limita a espera; e o LLM remoto pode levar >30 s legítimos.
- Reaproveitar a classe `Http` do pacote `image` no texto: é `internal` no mesmo módulo e serviria, mas o tratamento do corpo
  (`parseContent`, mensagens) é próprio; copiar as ~10 linhas do padrão é mais simples que adaptar. (Decisão: mesmo padrão, código local.)

### 21.3 Tasks (arquivo/símbolo → teste que prova)
1. `OpenAiCompatibleTextGenerator.generate` → `coroutineScope { async(IO) { exchange } }` + `disconnect` no `CancellationException`.
   Teste novo em `OpenAiCompatibleTest`: servidor segura a resposta (latch, até 10 s); cancelar → `generate` termina **antes** do
   servidor responder (`answered == false`). Os 6 testes antigos continuam verdes.
2. `AppGraph.DEFAULT_CONFIG` → `IMAGE_GENERATOR` com cadeia vazia; `ImageGenConfigTest` passa a esperar cadeia vazia e
   `ImageServer.OFF`. `assembleDebug testDebugUnitTest` verde.
3. Medições no moto g86 (resultados na §21.4).
   Como medir: `DeviceProbe` (novo, `app/src/androidTest`), um método por medição, cada um num `am instrument` próprio (processo
   novo → o VmHWM de `/proc/self/status` é só daquela medição): `migan12mp` (`MiGanInpainter` direto, 4000×3000 sintético com
   máscara de 600×600; o editor manda até 4096 px de lado — `EditorAssets.MAX_SIDE` — ao inpainter, e o modelo `pipeline_v2`
   recebe a imagem inteira) e `llm` (`LiteRtLmTextGenerator` direto, args `model` e `gpu`, carga + resposta curta + JSON do
   `TextPrompts.rewrite`). `BiRefNetInstrumentedTest` passa a logar o VmHWM. Downloads pela tela Modelos de IA no próprio moto.

### 21.4 Resultado
**Item 1 — cancelamento do `OpenAiCompatibleTextGenerator`** (feito): `generate` = `coroutineScope { async(IO) { exchange } }` +
`disconnect()` no `CancellationException` (mesmo padrão do `image/Http`). Teste novo `OpenAiCompatibleTest.cancel drops the
connection before the server answers` (servidor segura a resposta num latch de até 10 s; `answered` precisa continuar `false`
depois do `join`). **Prova de que o teste pega o defeito**: rodado contra a lógica antiga (`invokeOnCompletion`), falhou com
"generate esperou a resposta do servidor"; com a correção, passa.

**Item 2 — cadeia de imagem desligada** (feito): `DEFAULT_CONFIG` com `IMAGE_GENERATOR = []` (chave presente, cadeia vazia);
`ImageGenScreen` começa em `ImageServer.OFF` (não pisca os campos do A1111 antes de carregar). `ImageGenConfigTest.default config
has the image chain off`. Configs já salvas mantêm a cadeia que tinham (`FileProviderConfigStore.load`).
`./gradlew assembleDebug testDebugUnitTest`: verde, **127 testes JVM** (1 skipped).

**Item 3 — moto g86 5G** (`192.168.18.112:39773`, Android 16, 8 GB; app instalado com `installDebug installDebugAndroidTest`):
- **Gemini Nano**: `pm list packages -a` sem `aicore` → **sem AICore**; o `mlkit.gemini-nano` cai na cadeia, como no emulador.
- **MI-GAN 12 MP** (`DeviceProbe#migan12mp`, 4000×3000, buraco de 600×600, CPU 4 threads): rodada 0 (com a carga da sessão)
  **2,84 s**, rodada 1 **2,24 s**. VmHWM: 289 MB antes (bitmap + `IntArray` de 48 MB cada) → **0,99 GB** depois da 1ª →
  **1,43 GB** depois da 2ª (o pico cresce: buffers diretos/bitmaps da 1ª ainda não coletados). Swap ~23 MB. Cabe com folga em
  8 GB; num aparelho de 4 GB um 12 MP é arriscado — o MI-GAN não tem `MinRamMb` (empacotado); ver pendências.
- **Download do Hugging Face pelo app** (tela Modelos de IA, Wi-Fi do moto, sem o Kaspersky do PC): BiRefNet-lite (214 MB)
  **pronto em < 20 s** (download + SHA-256); **Qwen3-0.6B** (345 MB) pronto em ~1 min e **Gemma 4 E2B** (2,59 GB) em ~6 min
  (03:28:39 → 03:34:47, ~7 MB/s), os dois em paralelo; tamanhos finais iguais aos do catálogo, `.part` renomeado. Downloads
  pelo WorkManager continuaram com a tela do app aberta e o aparelho na tomada.
- **Interrompido**: depois dos downloads o adb sem fio caiu (`offline`; às 11:42 `connect` recusado na mesma porta — depuração
  sem fio desligada no aparelho). Ficou ligado `svc power stayon true`: **restaurar `settings put global
  stay_on_while_plugged_in 15`** (valor original) ao reconectar.
- Reconectado por **USB** (serial `ZY32LMNN9B`; o adb sem fio não voltou na mesma porta). Os 4 modelos com marcador `.verified-<sha>`.
- **BiRefNet-lite (fp32, 1024², ORT, CPU) NÃO CABE no moto de 8 GB**: `BiRefNetInstrumentedTest` → "Process crashed"; o
  lowmemorykiller matou o app com **RSS 4,20 GB + 884 MB de swap (~5,1 GB)**, depois de já ter matado ~12 outros processos
  (`kswapd is busy and watermark low`). Em x86_64 tinha dado 3,29 GB; em arm64 é maior. ~~O `MinRamMb(8192)` deixa passar este
  aparelho~~ — **corrigido na sessão 15**: o checker **bloqueia** (§21.5); o crash foi só no teste, que chama o removedor sem
  passar pela cadeia. De qualquer forma 8 GB não bastam. Sem máscara nem
  comparação em `docs/`. **Decisão do dono** (registro próprio, não feito aqui): export fp16, entrada 768/512 (reexportar o ONNX),
  outro modelo, ou tirar o BiRefNet do catálogo; até lá, subir `minRamMb` para 12288 evita o crash.
- **LLM local — `DeviceProbe#llm`** (processo novo por medição; 1ª = carga do motor + resposta; 2ª = motor carregado; JSON =
  `StructuredText.generate(TextPrompts.rewrite(…, 3))`):

  | Modelo | Backend | 1ª (com carga) | 2ª | rewrite JSON | VmHWM |
  |---|---|---|---|---|---|
  | Qwen3-0.6B int4 | CPU | 9,1 s | 5,5 s | 19,7 s | 1,32 GB |
  | Qwen3-0.6B int4 | GPU | 11,0 s | **1,8 s** | **4,2 s** | 1,42 GB |
  | Gemma 4 E2B | CPU | 17,7 s | 7,9 s | **6,2 s** | 1,63 GB |
  | Gemma 4 E2B | GPU | 56,4 s (1º uso) / 13,1 s | 10,9 / 9,0 s | 7,9 / 5,3 s | 2,13 / 2,02 GB |

  Qualidade: o **Gemma** dá slogans corretos em português e as 3 variantes do JSON boas; o **Qwen** erra o português ("Sinalha da
  arte", "descobertas impressivas") e uma variante repete a entrada. O Gemma responde em lista longa a "slogan curto" (o prompt da
  tela pede formato próprio; aqui é o pedido cru). JSON válido de primeira nos 4 casos. RAM: Gemma bem abaixo dos 6 GB do
  `minRamMb` (pico 2,1 GB; o arquivo é mapeado) — `6144` pode baixar, mas a medição é com o aparelho livre; mantido.
  **Cache do LiteRT-LM: `cache/litertlm` = 3,0 GB** depois dos dois modelos em CPU e GPU (cacheDir: o sistema pode apagar).
- **GPU do LiteRT-LM precisava de manifest**: sem declarar, `Backend.GPU()` falha com "Can not find OpenCL library on this device"
  embora o moto tenha `/vendor/lib64/libOpenCL.so` listado em `/vendor/etc/public.libraries.txt` (desde o Android 12 a lib do
  fabricante só é visível se o app declarar). **Corrigido**: `<uses-native-library android:name="libOpenCL.so"
  android:required="false"/>` em `app/src/main/AndroidManifest.xml`. Ainda: a falha de backend vira `AiError.InvalidOutput`
  (`LiteRtLmTextGenerator.generate`, `catch RuntimeException`) e não `Unavailable` → a cadeia não cai para o próximo provedor
  (registro próprio). Escolha CPU × GPU: Gemma em CPU é tão rápido quanto GPU e carrega mais rápido; Qwen ganha muito na GPU.
  O padrão hoje é `cpu` (setting `backend` da factory): mantido.
- **Passada pela interface no moto** (USB, app em `installDebug`; itens da lista "não verificado" da §15):
  - **Rascunhos**: lista os 3 rascunhos (feitos à mão no aparelho às 04:04–04:05); abrir "Promoção" → editor com o documento
    intacto. **Camadas**: painel lista as 7 camadas com olho.
  - **Foto de produto → escolher foto** (seletor do sistema, Android 16 com Google Fotos) → recorte **u2netp em 1.763 ms**, limpo
    → cenário "wood table" → **compor em 1.361 ms** → **"Abrir no editor"** abre a composição. No editor: selecionar a imagem mostra
    Duplicar/Excluir/Frente/…/Filtros/Recortar/Usar como fundo/✨Remover fundo/✨Remover objeto/✨Remover texto; **"Remover objeto"**
    → pincel → Aplicar → o MI-GAN preencheu a área pintada com chão/parede (o tênis não sumiu inteiro porque o pincel não cobriu o
    topo — máscara minha).
  - Observado: com o brand kit vazio, o template mostra `{{company}}`/`{{phone}}`/`{{website}}` literais. É o comportamento
    testado (`brandkit.test.ts`: kit vazio devolve o documento igual), mas na tela parece defeito → decisão de UX (registro próprio).
  - Observado: a 1ª ida ao seletor voltou sem foto; não se repetiu (provável: o item escolhido era um screenshot meu em
    `/sdcard`). O seletor do Android 16 mostrou modo de seleção com "Concluir" mesmo com `PickVisualMedia` simples.
  - A tela inicia em tema escuro (segue o sistema) apesar do `Theme.Material.Light` do manifest — só registro.
  - **Não feito pela interface**: seletor de fonte, compartilhar/imprimir, Recortar, Filtros, texto em curva, tela de Brand kit,
    pinça/pan/toque duplo na máscara (precisa de dedos), BiRefNet no fluxo (derruba o app, ver acima).
- Estado deixado no moto: app + APK de teste instalados, os 4 modelos baixados (`cache/litertlm` 3,0 GB), `stay_on_while_plugged_in`
  restaurado para 15, foto de teste removida. adb sem fio fora; USB funcionando.

**Pendências novas (registros próprios, não feitos nesta sessão)**
1. **BiRefNet não cabe em 8 GB** (~5,1 GB): decidir fp16 / entrada menor / outro modelo / tirar do catálogo; no mínimo
   `minRamMb` ≥ 12288 e conferir o arredondamento do checker com MemTotal 7,5 GB.
2. `LiteRtLmTextGenerator`: falha de backend (GPU sem OpenCL etc.) vira `InvalidOutput` → deveria ser `Unavailable` para a cadeia cair.
3. `cache/litertlm` de 3 GB: avaliar onde fica (cacheDir pode ser limpo pelo sistema → recompilação de 56 s na GPU) e se aparece
   no "espaço usado" da tela Modelos de IA.
4. Brand kit vazio deixa marcadores `{{…}}` visíveis no template.
5. Home: o cartão "Gerar imagem" ainda diz "num servidor Stable Diffusion seu" — coerente com a cadeia desligada, mas revisar o texto
   quando a fase 8 chegar.
6. Itens da interface não percorridos (lista acima).

**Arquivos desta sessão**: `ai/remote-http/.../OpenAiCompatibleTextGenerator.kt`, `.../test/.../OpenAiCompatibleTest.kt`,
`app/.../AppGraph.kt` (`DEFAULT_CONFIG`), `app/.../ImageGenScreen.kt` (estado inicial OFF), `app/src/test/.../ImageGenConfigTest.kt`,
`app/src/main/AndroidManifest.xml` (`uses-native-library libOpenCL.so`), `app/src/androidTest/.../DeviceProbe.kt` (novo),
`app/src/androidTest/.../BiRefNetInstrumentedTest.kt` (loga VmHWM).

### 21.5 Sessão 15 (2026-10-15): decisões do dono sobre as pendências e correção do checker
**Fato novo** (`adb -s ZY32LMNN9B shell head -1 /proc/meminfo` → `MemTotal: 7570904 kB` = **7.393 MB**): o checker compara
`ActivityManager.MemoryInfo.totalMem / 1 MiB` (`AppGraph.totalRamMb`), ou seja, o MemTotal, com o `MinRamMb`. 7.393 < 8.192
→ **o BiRefNet já fica bloqueado no moto pela cadeia** (snackbar "pouca memória"). Não há crash no fluxo; o crash da §21.4
foi do teste, que chama o removedor direto. Consequências gerais: um aparelho "de 8 GB" informa ~7,2–7,5 GB, então
`minRamMb = 8192` só libera aparelhos de 12 GB, e o **Gemma (`6144`) bloqueia os aparelhos de 6 GB** (MemTotal ~5,5 GB).
Além disso, a mensagem diz "pede 8 GB de RAM" num aparelho vendido como de 8 GB.

**Decisões do dono**
1. **BiRefNet: medir alternativas antes de escolher** (registro próprio, ainda não feito). Sonda curta no moto (padrão do
   `DeviceProbe`, processo novo por medição, VmHWM e tempo) com dois modelos já hospedados:
   - BiRefNet-lite **fp16**: `onnx-community/BiRefNet_lite-ONNX`, `onnx/model_fp16.onnx` (114 538 221 B, sha256
     `d39b897ceb16ae654c1731f3dba0cf9b368d9cae74b5a57459b455cc8bfec402`, MIT, repo sha `de15b22b…`). O `onnx/model.onnx`
     desse repo é **o mesmo arquivo** que já usamos (sha256 `56000243…3333`) → entrada fixa em 1024². Expectativa: no CPU do
     ORT o fp16 talvez não reduza as ativações (medir).
   - **ISNet-general-use** (release `v0.0.0` do rembg, Apache-2.0): conferir URL, tamanho, sha e I/O antes de medir.
   Fica o que couber em **~2 GB de pico** com recorte melhor que o u2netp (comparação lado a lado em `docs/`). Se nenhum
   couber, o BiRefNet sai do catálogo. **Até lá: `minRamMb` 12288** no catálogo e no `OnnxBiRefNetRemover.MIN_RAM_MB`.
2. **Brand kit vazio: texto de exemplo** (registro próprio). Com o kit vazio, `{{company}}`/`{{phone}}`/`{{website}}`/… viram
   um texto de exemplo editável ("Sua empresa", "(00) 0000-0000", "www.suaempresa.com.br") em vez de ficarem literais.
   Tocar `editor-web/src/brandkit.ts` (+ `brandkit.test.ts`, que hoje espera "kit vazio devolve o documento igual").

**Pendências novas (registros próprios)**
- `MinRamMb` contra o MemTotal: definir uma margem (ex.: comparar com `mb × 0,9`, ou catalogar pelo "RAM anunciada" e
  arredondar o MemTotal para cima até o próximo GB par) e corrigir a mensagem; rever o `6144` do Gemma (pico medido 2,1 GB).
- Suspeita de defeito: ações de IA de mesmo tamanho numa imagem **recortada** no editor desfazem o recorte (`setSrc` reseta
  `width/height`; §20.1). Verificar na tela e, se confirmado, corrigir junto com o `replaceImageScaled` da fase 7.
- Mockup em superfícies curvas (malha ou mapa UV) e fotos base definitivas dos templates (§20.4).

## 22. Sessão 17 (2026-10-15): `MinRamMb` passa a ser a RAM anunciada

### 22.1 Símbolos abertos e o que se descobriu
- `AppGraph::checker` — `is Requirement.MinRamMb -> totalRamMb() >= req.mb`; `AppGraph::totalRamMb` =
  `ActivityManager.MemoryInfo.totalMem / 1 MiB` (= MemTotal; 0 se não houver `ActivityManager`). Único uso de `totalMem`.
- `Requirement.MinRamMb(mb: Int)` (`core/ai-api/.../Provider.kt`) — sem doc sobre a unidade.
- Quem declara: `OnnxBiRefNetRemover.MIN_RAM_MB = 8192` (`OnnxBiRefNetFactory.requirements`); `LiteRtLmFactory` lê o
  `minRamMb` do catálogo (`models.json`: birefnet-lite 8192, gemma-4-e2b-it 6144, qwen3-0.6b-int4 3072).
- Mensagens: `ProductFlowViewModel` "pede ${mb/1024} GB de RAM"; `TextAiScreen.describeRequirement` "aparelho com
  ${(mb+1023)/1024} GB de RAM"; `ModelsScreen` "pede ${mb/1024} GB de RAM". Todas leem o número como **RAM anunciada**.

### 22.2 Comandos que provaram algo
- `adb -s ZY32LMNN9B shell head -1 /proc/meminfo` → `MemTotal: 7570904 kB` (7.393 MB num aparelho vendido com 8 GB).
- `getprop | grep -iE 'mem|ram'` no moto: nenhuma propriedade com a RAM anunciada.
- `platforms/android-35/data/api-versions.xml:5799` → `MemoryInfo.advertisedMem since="34"`.

### 22.3 Hipóteses descartadas
- *Usar `MemoryInfo.advertisedMem`*: só na API 34+ (minSdk 28) e o valor depende do fabricante (não conferido no moto);
  precisaria do arredondamento como reserva de qualquer jeito — fica só o arredondamento, uma regra para todos.
- *Comparar com `mb × 0,9`*: 8 GB → 7.373 MB passa o moto (7.393) por 20 MB; aparelhos com mais reserva de kernel/modem
  ficam de fora. Margem fixa não acompanha o tamanho.

### 22.4 Decisão e tasks
`minRamMb` = **RAM anunciada** em MB. O checker converte o MemTotal com `advertisedRamMb(totalMb)`: o menor tamanho
comercial (1; 1,5; 2; 3; 4; 6; 8; 10; 12; 16; 18; 20; 24; 32 GB, depois múltiplos de 8 GB) ≥ MemTotal. Arredondar para
cima é seguro porque o MemTotal é sempre menor que a RAM física.
1. `core/ai-api/.../Provider.kt`: `advertisedRamMb(memTotalMb: Long): Long` + doc no `MinRamMb`. Teste JVM
   `RamTest`: 7.393 → 8192; 5.500 → 6144; 3.600 → 4096; 11.200 → 12288; 1.900 → 2048; 40.000 → 40960; 0 → 0.
2. `AppGraph::checker` usa `advertisedRamMb(totalRamMb()) >= req.mb`.
3. BiRefNet `minRamMb` **12288** (decisão §21.5 item 1) no `models.json` e no `OnnxBiRefNetRemover.MIN_RAM_MB` — sem isso,
   com a regra nova o moto (8 GB) liberaria o BiRefNet, que morre no LMK a ~5,1 GB (§21.4). Gemma 6144 fica (pico 2,1 GB):
   agora libera aparelhos de 6 GB, que era o objetivo. Qwen 3072 fica.
4. Prova: `testDebugUnitTest` verde; no moto, BiRefNet continua recusado com "pede 12 GB de RAM".

### 22.5 Resultado
Tasks 1–3 feitas como na §22.4 (`advertisedRamMb` + `RETAIL_RAM_MB` em `Provider.kt`; checker no `AppGraph`; BiRefNet
12288 no catálogo e no `MIN_RAM_MB`). `assembleDebug testDebugUnitTest` verde, **159 testes JVM** (+2 do `RamTest`).
No moto (USB): tela Modelos de IA mostra "birefnet-lite · 214 MB · pede 12 GB de RAM" (modelo baixado, "Pronto no
aparelho") e "gemma-4-e2b-it · … · pede 6 GB de RAM". **Não verificado na tela**: a recusa no fluxo Foto de produto
(precisa escolher uma foto pelo seletor, que mostra a galeria pessoal do dono); a lógica é 8192 (moto arredondado) <
12288. As mensagens existentes ("pede N GB") já liam o número como RAM anunciada e ficaram certas sem mudança.

## 23. Sessão 18 (2026-10-16): brand kit vazio com texto de exemplo (§21.5 item 2)
Escolha da sessão entre as três pendências da §23 do HANDOFF: esta primeiro (escopo fechado pelo dono, prova em vitest);
BiRefNet fp16/ISNet fica para sessão própria (download + sondas no moto); cancelamento na ponte depois.

### 23.1 Símbolos abertos e o que se descobriu
- `editor-web/src/brandkit.ts::fillVariables(text, profile)` — troca `{{var}}` pelo valor do perfil; vazio/desconhecido
  fica literal. Única chamada: `applyBrandKit`.
- `brandkit.ts::applyBrandKit(doc, kit, {variables})` — cópia (`structuredClone`); com `variables` (padrão true) preenche
  o texto de objetos `TEXT_TYPES` e zera `styles` se o texto mudou. Chamadores (`main.ts`): `openTemplate` (variables
  true), miniaturas da galeria de templates (`:438`, true), `applyKit(false)` ao receber `applyBrandKit` da ponte (`:59`)
  e no botão "Aplicar cores e fontes" (`:548`), `applyKit(true)` no botão **"Preencher dados da empresa ({{…}})"** (`:549`).
- `document.ts::CUSTOM_PROPERTIES` — lista registrada em `FabricObject.customProperties` (`editor.ts:31`); só o que está
  nela sobrevive ao `canvas.toObject()` (`editor.ts:112`).
- Templates empacotados (`grep -rhoE "\{\{ *[a-z]+ *\}\}" app/src/main/assets/content | sort | uniq -c`): company 8,
  phone 3, website 3, address 2, email 2, slogan 2 — todas as 6 `VARIABLES` aparecem.
- `test/brandkit.test.ts` (não `src/`): "an empty kit changes nothing" e o `fillVariables` que espera `{{website}}` literal
  com `website: ''` — os dois mudam com a decisão.

### 23.2 Hipóteses descartadas
- *Exemplo só quando o perfil inteiro está vazio*: kit com empresa e sem telefone deixaria `{{phone}}` literal no design,
  o mesmo defeito. Fica **por variável**: valor vazio → exemplo. Variável desconhecida continua literal.
- *Trocar só no texto, sem guardar o original*: depois de abrir o template com o kit vazio, o `{{company}}` some e o botão
  "Preencher dados da empresa" não acha mais nada quando o dono preencher o kit. Por isso o objeto guarda o texto
  original.

### 23.3 Decisão e tasks
Exemplos: company "Sua empresa", slogan "Seu slogan aqui", phone "(00) 0000-0000", email "contato@suaempresa.com.br",
website "www.suaempresa.com.br", address "Rua Exemplo, 123 - Cidade".
Ao preencher, se o texto ainda tinha alguma variável vazia, o objeto ganha `brandSample` = texto original com `{{…}}`.
Num preenchimento seguinte, se `brandSample` existe **e** o texto atual é exatamente o que ele gera com exemplos (o
usuário não editou), a fonte volta a ser `brandSample`; se o usuário editou, o texto atual vale e `brandSample` sai.
1. `brandkit.ts`: `SAMPLE_PROFILE`; `fillVariables` usa o exemplo para variável vazia; `applyBrandKit` com `brandSample`.
2. `document.ts::CUSTOM_PROPERTIES` += `brandSample`.
3. `test/brandkit.test.ts`: kit vazio → exemplos e `brandSample`; preenchido depois → valores reais e `brandSample` sai;
   texto editado não é sobrescrito; `variables: false` não mexe no texto; kit vazio e objeto sem variável não muda.
4. Prova: `npm test` + `npm run build` (editor-web), `assembleDebug`; no moto, abrir um template com o kit vazio.

### 23.4 Resultado
Tasks 1–3 feitas como na §23.3, com um ajuste: `brandSample` guarda `{source, text}` (o original e o texto gerado), não
só o original — com kit parcial (empresa preenchida, site vazio) o texto não é "tudo exemplo", então comparar com
`fill(source, {})` não reconheceria o texto intacto. `editor-web`: vitest **27 verdes** (brandkit 8, +4), `tsc --noEmit`
limpo, `npm run build` gerou o bundle em `editor/src/main/assets/editor/`. `assembleDebug testDebugUnitTest` verde.
No moto (sem brand kit gravado): galeria de templates com "Sua empresa / (00) 0000-0000 · www.suaempresa.com.br" nas
miniaturas; template "Promoção" aberto no editor com os mesmos textos. **Não verificado na tela**: preencher o kit depois
e usar "Preencher dados da empresa" (coberto pelo vitest; exigiria gravar um kit no aparelho).

## 24. Sessão 19 (2026-10-16): BiRefNet-lite fp16 × ISNet-general-use no moto (§21.5 item 1)

### 24.1 Símbolos abertos e o que se descobriu
- `ai/onnx/.../OnnxBiRefNetRemover.kt` — sessão aberta pelo caminho, `intraOp = min(cpus, 4)`, `ALL_OPT`, **sem arena e sem
  plano de memória**; entrada `input_image` [1,3,1024,1024] fp32 por `FloatBuffer.wrap`; saída 0 lida com `floatBuffer`
  (num tensor fp16 isso não serve). Em erro de sessão: `OrtException` → `AiError.Unavailable`. `MIN_RAM_MB = 12288`.
- `ai/onnx/.../BiRefNet.kt` — `preprocess` = `imagenetChw(img, 1024)` (rembg `base.normalize`: divide pelo máximo do array,
  mean/std ImageNet); `postprocess` = sigmoid → min-max → `resizePlane`. `imagenetChw` é `internal` (não visível do `:app`).
- `ai/onnx/.../U2netp.kt` — `postprocess` fixo em 320; `refine` (smoothstep 0,3→0,8) só no u2netp.
- `app/src/androidTest/.../DeviceProbe.kt` — padrão: um método por `am instrument`, `memory()` = VmHWM/VmRSS/VmSwap de
  `/proc/self/status`; `esrgan` lê o modelo de `files/probe/` (enviado por `run-as … cat >`).
- `BiRefNetInstrumentedTest` — folha original | u2netp | BiRefNet sobre xadrez (`cutout` de `core/imaging`).
- `core/imaging`: `Bitmap.toRaster()`, `FloatArray.toMask(w,h)`, `cutout(bitmap, mask)`, `resizePlane` — todos públicos.
- ORT 1.31 (`javap` no `classes.jar` do AAR): `OnnxTensor.createTensor(env, ShortBuffer, shape, OnnxJavaType.FLOAT16)`,
  `getShortBuffer()`, `TensorInfo.type`. Conversão fp16 ↔ fp32 por `android.util.Half` (API 26; minSdk 28).

### 24.2 Artefatos conferidos (baixados no PC em 2026-10-16)
| Modelo | Origem | Bytes | Hash | Licença |
|---|---|---|---|---|
| BiRefNet-lite fp16 | `huggingface.co/onnx-community/BiRefNet_lite-ONNX/resolve/main/onnx/model_fp16.onnx` | 114 538 221 | sha256 `d39b897c…ec402` (= §21.5) | MIT |
| ISNet-general-use | `github.com/danielgatis/rembg/releases/download/v0.0.0/isnet-general-use.onnx` | 178 648 008 | md5 `fc16ebd8b0c10d971d3513d564d01e29` (= o fixado no rembg), sha256 `60920e99c45464f2ba57bee2ad08c919a52bbf852739e96947fbb4358c0d964a` | Apache-2.0 |

ISNet no rembg (`sessions/dis_general_use.py`, main): `normalize(img, mean (0.5,0.5,0.5), std (1,1,1), 1024²)` — mesma
divisão pelo máximo do `base.normalize` —; `pred = outs[0][:,0]` (já em probabilidade, sem sigmoid), min-max, resize.

### 24.3 Hipóteses descartadas / riscos
- *Ler o I/O no PC com `onnx`*: o Python 3.14 do PC não tem `onnx` nem `onnxruntime` (o `pip` falha por TLS, §20.6). A
  sonda loga `inputInfo`/`outputInfo` da sessão no aparelho e escolhe fp32/fp16 pelo `TensorInfo.type`.
- *fp16 reduz o pico*: o CPU EP do ORT insere `Cast` para fp32 nos nós sem kernel fp16 (InsertCastTransformer); se a maior
  parte do grafo cair nisso, as ativações continuam fp32 e o pico pouco muda. Só a medição responde.

### 24.4 Tasks (arquivo/símbolo → teste que prova)
1. `DeviceProbe#remover` (androidTest): `-e model birefnet16|isnet|u2netp`; modelo de `files/probe/`
   (`birefnet_lite_fp16.onnx`, `isnet-general-use.onnx`; u2netp pelo `ModelManager`); fotos `shoe/mug/jar.jpg` de
   `docs/fase2_amostras/entrada` também em `files/probe/`. Mesmas opções de sessão do `OnnxBiRefNetRemover`. Loga tempo de
   sessão, ms por foto e `memory()` antes/depois; grava `mask_<model>_<foto>.png`. Processo novo por modelo.
2. `DeviceProbe#removerSheet`: folha original | u2netp | BiRefNet fp16 | ISNet por foto → `docs/removedor_amostras/`.
3. Critério (§21.5): pico ≤ ~2 GB **e** recorte melhor que o u2netp nas folhas. Resultado e escolha na §24.5; a troca do
   modelo no catálogo/provedor é a task seguinte (registro próprio, depois da escolha).

### 24.5 Resultado e escolha
Medido no moto g86 (USB `ZY32LMNN9B`, 8 GB, MemTotal 7,39 GB), `DeviceProbe#remover`, um `am instrument` por modelo,
mesmas opções de sessão do `OnnxBiRefNetRemover` (CPU, 4 threads, sem arena):

| Modelo | Sessão | `run` 1024² | Total/foto (2–11 MP) | VmHWM | Resultado |
|---|---|---|---|---|---|
| BiRefNet-lite **fp16** | 7,1 s, 0,42 GB | — | — | — | **morto no LMK**: RSS 3,71 GB + swap 1,28 GB (~5,0 GB) |
| BiRefNet-lite fp32 (§21.4) | — | — | — | — | morto no LMK a ~5,1 GB |
| **ISNet-general-use** | 0,57 s | 4,6–5,6 s | 5,1–7,0 s | **0,84–1,0 GB** | cabe |
| u2netp (referência) | — | — | 1,3–3,3 s | 0,46–0,79 GB | cabe |

- **fp16 não ajuda**: o I/O do `model_fp16.onnx` é fp32 (`input_image` FLOAT → `output_image` FLOAT) e o pico é o mesmo do
  fp32 — o CPU EP faz as ativações em fp32 (hipótese da §24.3 confirmada pela medição, não pelo grafo).
- ISNet: saída `output_image` [1,1,1024,1024] + 5 saídas laterais do mesmo tamanho (o `run` calcula todas).
- **Qualidade** (`docs/removedor_amostras/`): `sheet_<foto>.png` = original | u2netp | ISNet; `zoom_<foto>.png` = 1:1
  u2netp | ISNet. Fotos de estúdio (shoe/mug/jar, fundo liso): **IoU 0,993 / 0,980 / 0,993** entre as máscaras, borda
  incerta 1,4–3,9 % nos dois; o ISNet limpa melhor a base da caneca e a laçada do cadarço — ganho pequeno.
  Foto difícil (`phones`, fones em madeira escura, CC0 Commons "Headphones on wood in black and white (Unsplash)", 3840 px):
  **os dois falham**; u2netp pega conchas + sombra e perde o arco; ISNet sai com alfa parcial em tudo (objeto "fantasma"),
  pior para foto de produto. `palm` (CC0 "Large majesty palm houseplant outdoors") é cena, não produto: os dois falham,
  não conta como critério.
- **Escolha (regra da §21.5)**: nenhum candidato é "≤ ~2 GB **e** melhor que o u2netp". O BiRefNet (fp32 e fp16) não cabe;
  o ISNet cabe mas não é claramente melhor e custa 178 MB de download e 2–4× o tempo. → **BiRefNet sai do catálogo; o
  ISNet não entra.** O removedor fica `mlkit.subject → onnx.u2netp` (Automático, como hoje).
- Não comparado: o ML Kit Subject Segmentation (1º da cadeia) contra estes dois nas mesmas fotos — se a busca por um
  removedor de qualidade voltar, o alvo a bater é ele, não o u2netp.

**Próxima task (registro próprio, não feita)**: tirar o `onnx.birefnet-lite` — `models.json` (entrada `birefnet-lite`),
`OnnxBiRefNetRemover.kt`/`BiRefNet.kt` + `BiRefNetTest`, registro da factory no `AppGraph`, `RemoverMode.BIREFNET` e o
chip/opção em `ProductFlowScreen`/`ProductFlowViewModel`, `BiRefNetInstrumentedTest`, testes que citam o id
(`FallbackChainTest`, `ProviderConfigTest`, `LocalModelManagerTest` — conferir se usam o id só como exemplo) e o modelo já
baixado nos aparelhos (o `LocalModelManager` precisa apagar o arquivo órfão ou a tela Modelos de IA deixa de listá-lo?
conferir). Prova: `assembleDebug testDebugUnitTest` verde; no moto, a tela Modelos de IA sem o BiRefNet e o recorte
Automático funcionando.

**Estado deixado no moto**: `files/probe/` com `birefnet_lite_fp16.onnx` (115 MB), `isnet-general-use.onnx` (179 MB),
5 fotos, máscaras e folhas — apagar com `adb shell run-as com.productphoto.offline rm -r files/probe/*.onnx` quando não
precisar mais. Buffer do logcat aumentado para 16 MB (`logcat -G 16M`; o padrão do aparelho podava as primeiras linhas da
sonda durante o spam do LMK). Arquivos desta sessão: `app/src/androidTest/.../DeviceProbe.kt` (`remover`,
`removerSheet`, `removerZoom`, `-e photos`), `docs/removedor_amostras/` (5 folhas + 3 zooms).

## 25. Sessão 20 (2026-10-16): tirar o BiRefNet do app (§24.5 "Próxima task")

### 25.1 Símbolos abertos e o que se descobriu
- `grep -rni birefnet` (kt/kts/json, sem `build/`): 11 arquivos. Os testes `FallbackChainTest`, `ProviderConfigTest`,
  `LocalModelManagerTest` **não** citam o id (zero ocorrências) — nada a mudar neles.
- `AppGraph.registry` registra `OnnxBiRefNetFactory()`; `HomeScreen` cita "BiRefNet para recortes finos" no card Modelos.
- `AppProductDeps.removerMode()/setRemoverMode()` mapeiam `RemoverMode.BIREFNET` ↔ cadeia `[onnx.birefnet-lite]`;
  `RemoverMode` (`ProductFlowViewModel.kt:34`) e o texto de ajuda em `ProductFlowScreen.kt:172`. Os chips iteram
  `RemoverMode.entries` — tirar a entrada tira o chip.
- `FallbackChain.run`: provedor não registrado → `continue`; cadeia só com ele termina em `AiError.Unavailable(emptyList())`.
  **Risco**: quem salvou o modo BiRefNet fica com `[onnx.birefnet-lite]` no `provider_config.json`; a UI mostraria
  "Automático" (ramo `else` do `removerMode()`) mas todo recorte falharia. `FileProviderConfigStore.load` só completa
  capabilities ausentes com o padrão; não limpa ids.
- `LocalModelManager`: `states()` e a tela `ModelsScreen` iteram só `catalog.models`; `delete(id)` faz `catalog.find` →
  return. **Risco**: o `files/models/birefnet-lite/` (224 MB) já baixado fica órfão, invisível e sem como apagar pela UI.
  `root = filesDir/models` é usado só pelo `LocalModelManager` (um `dir` por `entry.id`). `WorkDownloadScheduler.cancel(id)`
  = `cancelUniqueWork(name(id))` — serve para cancelar um download do BiRefNet em andamento.
- `DeviceProbe#remover` usa `BiRefNet.SIZE/preprocess/postprocess` (ramo `birefnet16`); ISNet usa só `BiRefNet.SIZE`.
- `imagenetChw` mora em `U2netp.kt` (fica); `BiRefNet.sigmoid` só usado pelo próprio `BiRefNet`.

### 25.2 Hipóteses descartadas
- *Manter `BiRefNet.kt` só para a sonda*: código morto no `:ai:onnx` para uma medição já registrada (§24.5). A sonda fica
  só com `isnet|u2netp` e um `SIZE` local; o ramo `birefnet16` sai (o resultado está na tabela da §24.5).
- *Deixar o arquivo órfão*: 224 MB perdidos sem UI para apagar. Limpeza genérica (diretórios fora do catálogo) cobre
  também futuras retiradas.

### 25.3 Tasks (arquivo/símbolo → teste que prova)
1. Apagar `OnnxBiRefNetRemover.kt`, `BiRefNet.kt`, `BiRefNetTest.kt`, `BiRefNetInstrumentedTest.kt`; entrada
   `birefnet-lite` do `models.json`; `register(OnnxBiRefNetFactory())` + import no `AppGraph`.
2. `RemoverMode.BIREFNET` + mapeamentos no `AppProductDeps`; texto do `ProductFlowScreen`; card do `HomeScreen`.
3. `FileProviderConfigStore.load`: tirar ids de `AppGraph.RETIRED_PROVIDERS` (`onnx.birefnet-lite`) das cadeias; cadeia
   que fica vazia por isso volta ao padrão. Teste JVM `app/src/test/.../ProviderConfigMigrationTest`.
4. `LocalModelManager.pruneOrphans()`: apaga diretórios de `root` sem entrada no catálogo (cancela o download pelo
   nome). Chamado no `AppGraph` em background. Teste em `LocalModelManagerTest`.
5. `DeviceProbe`: sem o ramo `birefnet16`.
Prova: `assembleDebug testDebugUnitTest` verde; no moto, tela Modelos de IA sem o BiRefNet, recorte Automático ok,
`files/models/birefnet-lite` apagado.

### 25.4 Resultado
- Feito como a §25.3 (tasks 1–5). Um ajuste em relação ao plano: o `pruneOrphans()` é chamado num `thread` logo após
  criar o `LocalModelManager` no `AppGraph` (não há escopo de corrotina no grafo).
- `gradlew assembleDebug testDebugUnitTest compileDebugAndroidTestKotlin`: **exit 0** (~11 min, com o build Rust do
  vtracer). `ProviderConfigMigrationTest` 3/3, `LocalModelManagerTest` 7/7 (inclui o `pruneOrphans`).
- No moto (`ZY32LMNN9B`, APK instalado com `install -r`): ao abrir o app, `files/models/birefnet-lite/` (224 MB,
  baixado em 2026-10-15) **foi apagado**. Tela Modelos de IA lista u2netp, migan, realesr, gemma e qwen, sem o BiRefNet.
  O card da Home diz "Gemma ou Qwen para texto"; a tela Foto de produto tem três chips (Automático / ML Kit / u2netp).
- A migração da cadeia **não foi testada no aparelho**: a cadeia salva no moto era `[onnx.u2netp]`, não BiRefNet. Ela foi
  testada só no JVM.
- **Não verificado**: o recorte Automático de ponta a ponta. O chip passou para Automático (`provider_config.json` =
  `[mlkit.subject, onnx.u2netp]`) e o seletor de foto abriu, mas o moto **caiu do USB** (`adb devices` vazio) antes de
  escolher a foto. **O modo do removedor no moto ficou em Automático**; antes estava u2netp.

## 26. Sessão 21 (2026-10-16): cancelamento na ponte do editor (§20.8 "Pendência")

O recorte Automático (§25.4) segue **não verificado**: `adb devices` vazio no início da sessão, também depois de
`adb kill-server`/`start-server`. O moto não estava no USB.

### 26.1 Símbolos abertos e o que se descobriu
- `EditorBridge.dispatch` (`editor/.../EditorBridge.kt`): `scope.launch { … }` sem guardar o `Job`. Um
  `CancellationException` no handler **já** envia `fail(id, CANCELLED)` e repropaga. Hoje só cancela quando o escopo da
  tela morre (`rememberCoroutineScope` no `EditorScreen`). `receive` roda na main thread (listener do
  `addWebMessageListener`, `EditorSession.kt:129`); `send` faz `main.post`.
- `EditorProtocol.parse`: todo `type` diferente de `result`/`progress` vira `Request` e vai a `dispatch`, que responde
  `unsupported "no handler for …"` quando não há handler. Uma mensagem de cancelamento precisa de um ramo próprio,
  senão gera uma resposta com o id do pedido original.
- O trabalho de verdade **já para quando cancelado**: `upscaleTiled` (`core/imaging/.../Tiles.kt:53`) chama
  `ensureActive()` antes de cada tile; `RealEsrganUpscaler.upscale` = `withContext(Default) { mutex.withLock { upscaleTiled } }`.
  `OnnxBackgroundRemover`/`MiGanInpainter` têm `ensureActive()` entre etapas; LiteRT-LM usa `runInterruptible`; texto
  remoto `ensureActive()`. O vtracer (`ai.vectorize`) não é interrompível no meio; o cancelamento só descarta o resultado.
- `editor-web/src/bridge.ts` `Bridge.request(type, payload, onProgress)`: guarda `pending[id]`, não expõe o id, não tem
  como cancelar. `receive`: um `result` sem pending é ignorado (`if (!p) return`). Isso serve para o resultado tardio de
  um pedido já cancelado.
- `main.ts` `run(label, fn)`: `setBusy(label)` → `await fn(progress)` → erro vira `toast(describe(e))` → `setBusy(null)`.
  `describe` de `cancelled` dá "Cancelado: cancelled". `dom.ts` `setBusy` só alterna `#busy.show` e escreve `.msg`;
  `#busy` (`index.html:16`) = spinner + msg, sem botão. Quem chama `run` com progresso: removeBg, inpaint, removeText,
  vectorize, upscale, rewriteText, generateCopy (as outras chamadas são `pickImage`/`pickFont`/`getBrandKit`/`detectText`).
- Build web: `vite build` grava em `editor/src/main/assets/editor` (`emptyOutDir`), então o APK precisa de `npm run build` antes.
- Testes: `EditorProtocolTest` (JVM) já tem duas `EditorBridge` ligadas em `TestScope`; `editor-web/test/protocol.test.ts`
  tem o `pair()` em memória.

### 26.2 Decisões / hipóteses descartadas
- *Pedido `cancel` comum (com id novo e `result` próprio)*: são duas respostas para controlar e cancelar o que já
  terminou não tem resultado útil. **Escolhido**: mensagem `{v, id: <id do pedido>, type: "cancel"}` **sem resposta**.
  Quem executa cancela o job; o pedido original recebe o `result` `cancelled` normal (ou o resultado, se já tinha terminado).
- *Esperar o `cancelled` do Kotlin para liberar a tela*: o tile em curso pode levar segundos e o vtracer não para.
  **Escolhido**: o JS rejeita o pedido localmente na hora (`BridgeRequestError('cancelled')`) e apaga o pending; o resultado
  tardio cai no `if (!p) return`.
- *Cancelamento iniciado pelo Kotlin (pedidos `kt-*` ao JS)*: os handlers do JS são curtos (`hello`, `loadProject`…).
  Fora do escopo. O JS só **ignora** um `cancel` recebido, sem responder.

### 26.3 Tasks (arquivo/símbolo → teste que prova)
1. `EditorProtocol`: `data class Cancel(id)`, `parse` reconhece `type == "cancel"`, `cancel(id)` codifica.
   `EditorBridge`: `running: HashMap<String, Job>` preenchido em `dispatch`, removido no fim do job; `receive(Cancel)` →
   `running[id]?.cancel()`. **Teste** `EditorProtocolTest`: handler que suspende (`awaitCancellation`) → `cancel` → o
   pedido termina com `CANCELLED`; `cancel` de id desconhecido não envia nada.
2. `protocol.ts`: `cancel(id)`; `parseEnvelope` aceita `type: "cancel"` (cai no ramo genérico; o tipo `CancelEnvelope`
   fica explícito). `bridge.ts`: `request(type, payload, onProgress, signal?: AbortSignal)`; abort → `post(cancel(id))`,
   apaga o pending, rejeita `cancelled`; signal já abortado → rejeita sem enviar; `receive` ignora `cancel`.
   **Teste** vitest: handler que nunca resolve + abort → rejeita `cancelled` e o lado nativo recebeu `cancel` com o id;
   o resultado tardio é ignorado.
3. `main.ts` `run(label, fn, { cancellable })`: `AbortController` passado ao `fn`; `#busy` ganha o botão "Cancelar"
   (`dom.ts` `setBusy(msg, onCancel?)`); cancelado pelo usuário → toast "Cancelado". Ligar nas 7 ações com progresso.
   **Prova**: `npm run build && npm test`; no moto, ✨ Melhorar resolução 4× numa 512² → Cancelar → tela livre na hora,
   logcat sem trabalho depois do tile em curso.

### 26.4 Resultado
- Feito como a §26.3. Ajustes: (a) `dispatch` cria o job com `CoroutineStart.LAZY`, registra em `running` e tira o
  registro em `invokeOnCompletion` (roda mesmo se o job for cancelado antes de começar); (b) o `offlineTransport` também
  ignora `cancel`; (c) depois de um abort pelo usuário, o `run` mostra só "Cancelado" (não o `describe`).
- `#busy` ganhou `<button class="cancel" hidden>`; `setBusy(msg, onCancel?)` mostra o botão só com `onCancel`. As 7 ações
  com progresso passam `(p, sig) => bridge.request(…, p, sig), true`.
- JVM `EditorProtocolTest` 8/8 (novo: `cancel stops the running handler…`; `parses…` cobre o `Cancel`). vitest 29/29
  (novos: abort manda `cancel` com o id e rejeita na hora, resultado tardio ignorado, sinal já abortado não envia; abort
  depois do resultado não muda nada; `cancel` recebido não tem resposta). `npm run build` (tsc + vite) ok.
  `gradlew assembleDebug :editor:testDebugUnitTest`: **exit 0**.
- **No moto** (`ZY32LMNN9B`, reconectado no meio da sessão, APK instalado com `install -r`, 2026-10-16 11:50–11:56):
  - **Recorte Automático (fecha a §25.4)**: Foto de produto, chip Automático, foto `fase2_amostras/entrada/mug.jpg`
    (1920×1080, posta na galeria como `pp_teste_caneca.jpg` e escolhida pela descrição) → "Recorte: ML Kit Subject
    Segmentation · no aparelho · 1490 ms". Caneca inteira, com a alça, e fundo transparente. O u2netp (2º da cadeia)
    não foi exercitado.
  - **Cancelar**: Novo design 1080² → `fase7_amostras/upscale_in_512.png` → ✨ Melhorar resolução 4× → "ampliando 39%"
    com o botão Cancelar visível (app a 325% de CPU) → Cancelar → overlay sumiu na hora, toast "Cancelado" e imagem
    intacta. O `TIME+` do processo ficou parado em 1:33.49 em 4 amostras de `top` (≈0% CPU), ou seja, o trabalho parou.
  - Logo depois, 2× completo (~18 s) → "Resolução 2× (1024×1024) (Real-ESRGAN)": o mutex do upscaler foi liberado
    pelo cancelamento.
  - Limpeza: 4 `.onnx` de `files/probe/` apagados (~303 MB; as máscaras e as folhas da §24 ficaram) e as 2 imagens
    de teste apagadas de `Pictures/`.

## 27. Fase 8 — geração de imagem no aparelho (análise na sessão 22, 2026-10-16)
Escopo (§10, fase 8): `ImageGenerator` local em `:ai:ondevice-sd` e troca da cadeia padrão de imagem para ele. Prova da
fase: um 512² gerado no moto g86 (Dimensity 7300, Mali-G615 MC2, 8 GB) com tempo e RSS medidos. Roteiro: HANDOFF §18.
**Estado: sonda feita (§27.7). Só o WebGPU serve; o LCM-DS7 fp16 roda, mas com pico de 5,2 GB não passa no critério.
Falta a decisão do dono sobre o caminho (§27.7, "Task 5") antes do código do provedor.**

### 27.1 Símbolos abertos e o que se descobriu
- `core/ai-api/.../ImageGenerator.kt`: `ImageRequest(prompt, negativePrompt, width/height = 512, steps?, seed?, cfgScale?,
  init, strength, inpaintMask, maskInvert, control, count)`, `featuresNeeded()`, `snapTo8`, `ImageGenerator.supports`.
  `ChainedImageGenerator` anuncia todas as features; cada provedor lança `Unsupported` antes de trabalhar (§19.5). O
  provedor local declara `supports = {TXT2IMG}` (+ `IMG2IMG` se entrar o `vae_encoder`) e recusa `control`/`inpaintMask`.
- `core/ai-api/.../Provider.kt`: `Requirement.Model(modelId)` é um id por requisito; `MinRamMb` = RAM anunciada (§22);
  `DeviceFeature` → o checker do `AppGraph` devolve sempre `false` (`AppGraph.kt:115`).
- `core/models/.../ModelManager.kt`: `ModelEntry` = **um arquivo** (`file`, `sizeBytes`, `sha256`, `urls`); `targetIn` =
  `File(dir, file)`, marcador `.verified-<sha256>`, `dir` = `filesDir/models/<id>/`; `ensureReady(id): File?`;
  `pruneOrphans` apaga diretórios fora do catálogo. Um pipeline SD (text encoder + UNet + VAE + `vocab.json`/`merges.txt`)
  **não cabe numa entrada**. Opções: (a) uma entrada por componente e o provedor exige N `Requirement.Model` (zero mudança
  no gerenciador; a tela Modelos de IA lista 4–5 itens); (b) `files: List<…>` na entrada (muda downloader, worker,
  estado); (c) zip extraído depois de verificado. A menor é (a); decidir na implementação.
- `app/.../AppGraph.kt`: `imageGenerator = ChainedImageGenerator(chain(IMAGE_GENERATOR))`, `saveImageChain`;
  `deleteModel` só invalida removedor e texto (com o SD, precisa invalidar a cadeia de imagem, a sessão ORT segura os
  arquivos). `DEFAULT_CONFIG`: `IMAGE_GENERATOR = []`.
- `FileProviderConfigStore.load`/`save` (`AppGraph.kt:226`): `load` = padrão + o que está salvo; `save` grava o mapa
  **inteiro**. Toda instalação que já salvou qualquer cadeia tem `IMAGE_GENERATOR: []` explícito (o moto tem: o modo do
  removedor foi salvo). **Trocar o `DEFAULT_CONFIG` não alcança essas instalações**, e um `[]` salvo não se distingue de
  "o usuário escolheu Desligado". A troca da cadeia padrão precisa de migração com marca (ex. `ProviderConfig.version`
  1 → 2; no `load`, `version < 2` com `IMAGE_GENERATOR == []` vira o padrão novo).
- `app/.../ImageGenScreen.kt`: `enum ImageServer(label, providerId)` = A1111/COMFYUI/OFF; `imageGenStateOf`,
  `imageChainOf` (cadeia de **um** provedor), `secretNameFor`, `describeImageError` (os `when` exaustivos obrigam um ramo
  para o modo novo); `ImageFormat` 512², 512×768, 768×512; quantidade 1–4; tradução pt→en antes (o SD só entende
  inglês); referência por ControlNet; `ImageGenMemory`; upscale Real-ESRGAN na grade. O job roda no
  `rememberCoroutineScope`, então **sair da tela cancela** (aceitável a 5 s num servidor, ruim a dezenas de segundos no
  aparelho: decidir).
- `ai/onnx/.../RealEsrganUpscaler.kt`: padrão de sessão (XNNPACK com `intra_op_num_threads`, `allow_spinning=0`, queda
  para CPU em `OrtException`); `androidResources.noCompress += "onnx"`. ORT é `implementation` no `:ai:onnx`.
- `app/src/androidTest/.../DeviceProbe.kt`: um método por `am instrument`, `memory()` = VmHWM/VmRSS/VmSwap, modelos em
  `files/probe/` (enviados por `run-as … sh -c 'cat > …'`, §20.6).

### 27.2 Fatos conferidos (ORT, aparelho, PC, artefatos)
- **ORT 1.31 já traz GPU e NPU no AAR** (`~/.gradle/caches/.../onnxruntime-android-1.31.0.aar`,
  `jni/arm64-v8a/libonnxruntime.so` 34 MB). Contagem de strings no `.so`: `WebGpuExecutionProvider` 27×, `dawn` 741×,
  `libvulkan.so`, fontes `onnxruntime/contrib_ops/webgpu/…` → **EP WebGPU compilado, com Dawn sobre Vulkan**;
  `NnapiExecutionProvider` 18×; `XnnpackExecutionProvider` 8×; `QNNExecutionProvider` 1× (só o nome). API Java (`javap`
  no `classes.jar`): `SessionOptions.addWebGPU(Map<String,String>)`, `addNnapi(EnumSet<NNAPIFlags>)` (`USE_FP16`,
  `USE_NCHW`, `CPU_DISABLED`, `CPU_ONLY`), `addXnnpack(Map)`, `setSymbolicDimensionValue(String, long)` (fixa dimensão
  livre; o NNAPI pede formas estáticas), `setMemoryPatternOptimization`, `setCPUArenaAllocator`;
  `OrtEnvironment.getAvailableProviders()`, `getEpDevices()`; `OrtProvider.WEBGPU`. **Não conferido:** se o
  `getAvailableProviders()` lista WEBGPU no moto e se o Dawn acha o Vulkan do Mali (primeira linha da sonda).
- **Moto** (`adb -s ZY32LMNN9B shell …`): `getprop ro.hardware.vulkan` = `mali` (`/vendor/lib64/hw/vulkan.mali.so`);
  `dumpsys gpu` → `vulkanVersion = 4206592` = **Vulkan 1.3.0**; `service list` → NNAPI
  `android.hardware.neuralnetworks.IDevice/mtk-mdla_shim` e `…/mtk-neuron_shim` (drivers MediaTek do APU), ou seja, o EP
  NNAPI pode chegar ao NPU. `ro.board.platform` = `mt6878`. `MemAvailable` 2,53 GB nesta sessão (MemTotal 7,39 GB).
- **PC**: Python 3.14 com `onnx 1.23.2`, `onnxruntime 1.29.0` (CPU), `numpy 2.5.2`, `PIL 12.3` — a §24.3 dizia que não
  havia; hoje há. Os pacotes estão no site do usuário: rodar com `python -P -E` (`-I` os esconde). Sem torch.
  `onnxruntime.transformers.float16.convert_float_to_float16(model, keep_io_types=…, op_block_list=…, …)` existe.
  NDK 27–29 e CMake 3.31.6 em `D:/DevCaches/Android/Sdk` (para um motor C++, se precisar).
- **Exportações ONNX no Hugging Face** (API `…/api/models/<repo>?blobs=true`, 2026-10-16; sha = commit do repo):

  | Repo (commit) | Conteúdo | Arquivos (bytes) | Licença declarada |
  |---|---|---|---|
  | `TheyCallMeHex/LCM-Dreamshaper-V7-ONNX` (`4029a217f9`) | LCM Dreamshaper v7, fp32 | unet `model.onnx` 1 948 508 + `model.onnx_data` 3 438 411 520; text_encoder 492 588 002; vae_decoder 198 078 038; vae_encoder 136 760 154; `tokenizer/vocab.json`, `merges.txt` | MIT |
  | `softwareweaver/LCM_Dreamshaper_v7_Olive_Onnx` (`25bf953af1`) | o mesmo em fp16 (Olive, otimizado para DirectML) | unet 1 719 658 983 (pesos embutidos); text_encoder 246 480 937; vae_decoder 99 039 201 | MIT |
  | `danyalmalik/tiny-sd-ONNX-WebGPU` (`bcb34e52bb`, 2026-10-15) | segmind/tiny-sd fp16, **sem LCM** | unet 647 336 426; text_encoder 246 323 042; vae_decoder 198 078 716 | OpenRAIL-M |
  | `danyalmalik/bk-sdm-small-2m-ONNX-WebGPU` (`96a7f8a4d3`) | BK-SDM-Small fp16, sem LCM | unet 965 284 722 | OpenRAIL-M |
  | `akameswa/lcm-tiny-sd-onnx-fp16` (`3b423c4e1d`) | tiny-sd com LCM, fp16 | unet 354 685 + 646 809 600; text_encoder 246 537 314; vae_decoder 157 826 + 98 965 248 | **nenhuma** (sem README) |
  | `nmkd/stable-diffusion-1.5-onnx-fp16` (`38dacf2c14`) | SD1.5 fp16 | unet 1 217 704 + 1 718 976 000; text_encoder 246 476 214; vae_decoder 99 094 195 | OpenRAIL-M |
  | `onnx-community/stable-diffusion-v1-5-ONNX` | SD1.5 fp32 | unet 3 438 083 840 (+ safety_checker 1,2 GB) | OpenRAIL-M |

- **Grafos inspecionados** (só o `model.onnx`, sem pesos; `scratchpad/graphinfo.py`, `onnx.load(load_external_data=False)`):
  - LCM-DS7 do Hex: opset 14; entradas `sample` f32 [b,4,h,w], `timestep` **int64** [steps], `encoder_hidden_states`
    f32 [b,seq,768] e **`timestep_cond` f32 [b,256]** (o embedding do guidance do LCM: sem CFG, batch 1 por passo);
    saída `out_sample`. Só operadores padrão (MatMul 225, Conv 98, InstanceNormalization 61, Softmax 32, Gemm 24,
    Erf 16, Resize 3…), nenhum `com.microsoft` → roda em qualquer EP. Pesos FLOAT (687 initializers).
  - lcm-tiny-sd do akameswa: opset 17; I/O f32, pesos FLOAT16, `timestep` **float**, sem `timestep_cond`; operadores
    fundidos `com.microsoft:` Attention 9, MultiHeadAttention 9, SkipLayerNormalization 18, Gelu 9 (dependem de kernel no EP).
- **Outros motores e licenças de modelo** (pesquisa por subagente, **ponteiro, não conferido por mim**):
  stable-diffusion.cpp é MIT (release `master-968`, 2026-10-15), mas o OpenCL oficial atende só Adreno e o Vulkan não
  tem guia para Android. MNN 3.6.1 tem `transformers/diffusion` (SD1.5 em CPU/OpenCL) e o modelo
  `taobao-mnn/stable-diffusion-v1-5-mnn-opencl` (unet 863 MB); exige build próprio com `MNN_BUILD_LLM`. A doc do
  MediaPipe Image Generator não abriu (status incerto). Referência: o Off Grid (MNN, CPU) leva ~15 s por 512² com 20
  passos num Snapdragon 8 Gen 3.
  Licenças: SD1.5, BK-SDM e tiny-sd = CreativeML OpenRAIL-M; LCM-LoRA sdv1-5 = openrail++; LCM_Dreamshaper_v7 = MIT;
  TCD-SD15-LoRA = MIT; TAESD = MIT (decoder 4,9 MB, sem ONNX achado ainda); sd-turbo = Stability AI Community
  License (receita < US$ 1 mi, registro, "Powered by Stability AI").
- Custo (de memória, **conferir antes de citar**: BK-SDM, arXiv 2305.15798): UNet do SD1.4/1.5 ≈ 339 GMACs por
  avaliação a 512²; BK-SDM-Tiny ≈ 205 G. Um UNet "pequeno" corta ~40 % da conta, não 60 % como os parâmetros.

### 27.3 Hipóteses descartadas
- *Motor novo (MNN, stable-diffusion.cpp, MediaPipe) como primeira opção*: o ORT 1.31 do app já tem CPU, XNNPACK,
  WebGPU (Vulkan) e NNAPI (APU MediaTek). Outro motor custa build C++/JNI, MBs no APK e outro formato de modelo. Fica
  como plano B **se a sonda mostrar que nenhum EP do ORT serve** no moto. O OpenCL do sd.cpp não atende Mali; o SD do
  MNN pede build próprio.
- *SD1.5 sem destilação* (20+ passos com CFG = 40+ avaliações do UNet): mesmo a poucos segundos por avaliação dá
  minutos. Só modelos de poucos passos (LCM/TCD, 4–8 passos, sem CFG).
- *UNet fp32 (3,44 GB) no CPU*: o pico passaria de 4 GB. O BiRefNet morreu no LMK a ~5 GB (§21.4/§24.5) e o
  `MemAvailable` medido é 2,5 GB. Precisa de pesos fp16 (WebGPU/NNAPI) ou int8 no CPU.
- *fp16 no CPU EP*: a §24.5 mostrou que o CPU EP faz as ativações em fp32 (casts) e o pico não cai. No CPU, só int8
  (ou um UNet pequeno em fp32) reduz memória. O fp16 é para WebGPU/NNAPI.
- *`akameswa/lcm-tiny-sd-onnx-fp16` no catálogo*: sem licença declarada. Não entra, nem como sonda.
- *sd-turbo*: licença com teto de receita. Fora.
- *Usar o fp16 do Olive (softwareweaver) direto*: arquivo único de 1,7 GB com pesos embutidos, então não dá para ver o
  grafo sem baixar tudo, e o Olive para DirectML costuma fundir em ops `com.microsoft` (GroupNorm, MHA) sem kernel em
  todo EP. Converter o fp32 do Hex no PC (`convert_float_to_float16`, `keep_io_types=True`, sem otimizador de fusão)
  mantém só ops padrão, é reprodutível e dá o hash nosso.

### 27.4 Decisões (provisórias até a sonda)
1. **Motor: ONNX Runtime 1.31**, o que já está no app. Ordem de EP a medir: WebGPU → NNAPI (`USE_FP16`) → XNNPACK/CPU.
2. **Modelo-base para a sonda: LCM Dreamshaper v7** (MIT declarado; 4 passos sem CFG; ops padrão). Para comparar o
   custo de um UNet pequeno: **tiny-sd fp16** (OpenRAIL-M; sem LCM, só a velocidade por avaliação conta).
3. **Risco de licença a registrar**: o LCM_Dreamshaper_v7 se declara MIT, mas foi destilado do Dreamshaper v7 (base
   SD1.5, OpenRAIL-M). Para uso comercial, tratar como OpenRAIL-M (repassar as restrições de uso; sem filtro NSFW
   obrigatório na licença). Mencionar ao dono.
4. Decodificador: medir o `vae_decoder` fp16; o TAESD (MIT, 4,9 MB) entra só se o VAE pesar no tempo total (falta ONNX).
5. Critério (proposta, **confirmar com o dono**): pico ≤ ~2 GB (como na §21.5) e 512² completo (texto + 4 passos +
   decode) em ≤ ~60 s no moto, o "pior caso aceitável" da §18. Sem isso, o moto fica no servidor e o `MinRamMb` sobe.

### 27.5 Tasks (arquivo/símbolo → teste que prova)
**Sonda (próxima sessão; nada no app ainda):**
1. PC: baixar do Hex (commit `4029a217f9`) `unet/model.onnx` + `model.onnx_data`, `text_encoder`, `vae_decoder`,
   `tokenizer/*` para uma pasta própria de downloads; `tools/sd_fp16.py` (novo) converte com
   `convert_float_to_float16(keep_io_types=True)` e grava com dados externos; anotar tamanhos e sha256 aqui. Paridade no
   ORT do PC: fp32 × fp16 com entrada fixa (seed), diferença do `out_sample`. Baixar o `unet/model.onnx` do tiny-sd
   (`danyalmalik`, `bcb34e52bb`).
2. Moto: `files/probe/` ← unet fp16 do LCM-DS7 (~1,7 GB), unet do tiny-sd (647 MB) e as entradas fixas (latente 1×4×64×64,
   `encoder_hidden_states` 1×77×768 e `timestep_cond` do PC, em `.bin` f32). `DeviceProbe#sdUnet -e model lcmds7|tinysd
   -e ep cpu|xnnpack|webgpu|nnapi`: loga `getAvailableProviders()`, tempo de sessão, VmHWM antes/depois, 1 rodada de
   aquecimento + 4 medidas (mediana), grava o `out_sample` para comparar com o PC. Formas fixas com
   `setSymbolicDimensionValue` (nomes do grafo: `batch_size`, `num_channels`, `height`, `width`, `sequence_length`,
   `steps`). Um `am instrument` por linha (processo novo).
3. `DeviceProbe#sdDecode`: `vae_decoder` e `text_encoder` fp16 no EP vencedor (tempo, VmHWM).
4. Paridade moto × PC do `out_sample` (máx/média do erro absoluto): kernel de GPU/NPU errado aparece aqui, não no tempo.
5. Gravar a tabela na §27.6 e escolher (modelo, EP, passos, `MinRamMb`) pelo critério da §27.4 item 5.

**Implementação (depois da sonda; esboço para ajustar com o resultado):**
6. Módulo `:ai:ondevice-sd` (`settings.gradle.kts`, `build.gradle.kts` como o `:ai:onnx`).
   `ClipTokenizer` (BPE com `vocab.json`/`merges.txt`, 77 tokens, BOS 49406/EOS 49407 — **conferir os ids no
   `vocab.json`**): teste JVM com ids gerados no PC. `LcmScheduler` (timesteps de 4 passos sobre 1000 de treino com
   `original_inference_steps` 50, `c_skip`/`c_out`; **conferir as fórmulas no `scheduling_lcm.py` do diffusers**) e o
   embedding de guidance (`timestep_cond`, 256): teste JVM contra valores do PC.
7. `OnDeviceSdImageGenerator` + factory `ondevice.sd` (requisitos: os `Model` dos componentes + `MinRamMb`), entradas no
   `models.json`, registro no `AppGraph`, `deleteModel` invalidando a cadeia de imagem.
8. Cadeia padrão: `DEFAULT_CONFIG` `IMAGE_GENERATOR = [ondevice.sd]` + migração (`ProviderConfig.version` 2, §27.1) +
   teste em `ProviderConfigMigrationTest`/`ImageGenConfigTest`; `ImageServer.ON_DEVICE` ("No aparelho") na tela;
   texto do cartão da Home (§21.4 pendência 5).
9. Prova da fase: `assembleDebug testDebugUnitTest` verde; no moto, 512² gerado pela tela, com tempo e VmHWM.

**Decisões do dono antes da implementação**: critério de tempo/memória (§27.4 item 5); se quem salvou "Desligado" antes
da fase 8 passa para o local na migração; geração que sobrevive a sair da tela (serviço) ou cancela como hoje.

### 27.6 Sonda: preparação feita na sessão 23 (2026-10-16); a medição rodou na sessão 24 (§27.7)
A sessão parou a pedido do dono antes dos downloads. Não há código novo, nada foi baixado além da listagem e nada mudou no
moto. **A tabela de resultado da sonda ainda falta** e vai no fim desta seção.

**Artefatos conferidos** (API `huggingface.co/api/models/<repo>?blobs=true`; sha256 do LFS; download por
`https://huggingface.co/<repo>/resolve/<commit>/<arquivo>`):

| Repo @ commit | Arquivo | Bytes | sha256 |
|---|---|---|---|
| `TheyCallMeHex/LCM-Dreamshaper-V7-ONNX` @ `4029a217f9cdc0437f395738d3ab686bb910ceea` (2023-12-21) | `unet/model.onnx` | 1 948 508 | `f3e9a08a3e5b943046bf90a513c492cf4c6e31e26229062af8eb4ad2ddf172b5` |
| | `unet/model.onnx_data` | 3 438 411 520 | `ef99ccc336de0e79f247fcb3d1398b3f3d1a02796916b88a351d7a83f570a31a` |
| | `text_encoder/model.onnx` | 492 588 002 | `fefe95eab6542e5fb7642b3f592489176836cc3fd49196b924a63760602c8c4a` |
| | `vae_decoder/model.onnx` | 198 078 038 | `ec5298d7bfa592d492d36b42d17f794fcdb9175e2aac366956d40f3f38d13ca1` |
| | `tokenizer/model.onnx` | 1 683 168 | `52af50d264d702c351484aabf62c64abe61f59d6a6d2c508a3e797e23dc1e008` |
| `danyalmalik/tiny-sd-ONNX-WebGPU` @ `bcb34e52bbb548d5d4bbb3b210c9fa1cd248a9ed` (2026-10-15) | `unet/model.onnx` | 647 336 426 | `6bc30ad741a7de7c19f5ee4fa3c7298dfd6fa7308c16d144b5e321fe7810760f` |
| | `text_encoder/model.onnx` | 246 323 042 | `a69bb1de280181343ad0920b41cf289e52ac70dbd6083f0ed0d6371fb9d2f29c` |
| | `vae_decoder/model.onnx` | 198 078 716 | `9883e574be18d9d616881e921eed5d5d22d0f8157b2872356f9536783dc8d86f` |

Arquivos pequenos (git, sem LFS) do Hex a baixar junto: `scheduler/scheduler_config.json` (539 B), `model_index.json`
(622), `unet/config.json` (1 829), `tokenizer/vocab.json` (1 059 962, blob `469be27c5c01…`), `tokenizer/merges.txt`
(524 619, blob `76e821f1b6f0…`), `tokenizer_config.json` (739), `special_tokens_map.json` (585). O tiny-sd tem
`vocab.json`/`merges.txt` **com os mesmos blobs** (mesmo arquivo), `LICENSE.md` (14 385) e `scheduler_config.json` (691).
Volume da task 1: ≈ 4,13 GB do Hex (unet + text encoder + VAE) + 0,65 GB do UNet do tiny-sd.
O Hex traz um `tokenizer/model.onnx` (1,7 MB) que não abri. Deve ser um tokenizer do onnxruntime-extensions (custom op),
que o ORT do app não tem; o plano do `ClipTokenizer` em Kotlin continua.

**Estado conferido nesta sessão**
- Moto (`adb -s ZY32LMNN9B shell cat /proc/meminfo; df -h /data; getprop`): Android 16 (SDK 36), MemTotal 7 570 904 kB,
  **MemAvailable 2 062 332 kB** (era 2,53 GB na §27.2; a folga varia com o que está aberto), `/data` com 128 GB livres.
- PC: 32 GB de RAM (5,75 GB livres no momento), C: com 1 020 GB livres; `python -P -E` → Python 3.14.7, onnx 1.23.2,
  onnxruntime 1.29.0, numpy 2.5.2.
- `DeviceProbe.kt`: `memory()` lê só VmHWM/VmRSS/VmSwap do processo. O `remover` já tem o padrão de entrada/saída fp16
  (`android.util.Half`, `OnnxJavaType.FLOAT16`) e o `esrgan` o das opções do XNNPACK. `app/build.gradle.kts` já tem
  `androidTestImplementation(libs.onnxruntime.android)` e `noCompress += "onnx"`: a sonda abre sessões ORT direto, sem
  mudar o build.

**Ajustes ao plano (propostas não conferidas: abrir antes de escrever o código)**
1. **Memória da GPU**: no Mali, o que o WebGPU/Vulkan aloca pode não aparecer em VmRSS, mas o LMK olha a memória do
   sistema. O `memory()` da sonda deve logar também o `MemAvailable` (`/proc/meminfo`) antes e depois. Tentar ler
   `adb shell dumpsys gpu --gpumem` do PC durante a rodada; não sei se existe no moto.
2. **LCM-DS7 fp16 em cpu/xnnpack**: o ORT provavelmente converte os pesos para fp32 nos casts dobrados em constante
   (~3,4 GB), e o LMK mata o processo (o mesmo efeito da §24.5). Nesses EPs, rodar só o tiny-sd; o LCM-DS7 vai em
   webgpu/nnapi.
3. **NNAPI**: suspeito que o EP NNAPI do ORT não aceite tensor fp16 e não tenha InstanceNormalization/Erf. Nesse caso o
   grafo se parte em muitos pedaços e o resto cai na CPU. Logar a contagem de nós por EP com o logger do ambiente em INFO
   (`OrtEnvironment.getEnvironment(<nível>, …)` no começo do processo; tag `onnxruntime` no logcat). Conferir a
   assinatura no `javap` antes.
4. **WebGPU**: não conferi as chaves aceitas pelo `addWebGPU`. Procurar `ep.webgpuexecutionprovider.` nas strings do
   `libonnxruntime.so` do AAR antes de passar opções. O fp16 depende do recurso `shader-f16` do Dawn no Mali; se faltar,
   os nós fp16 caem na CPU, e o log de nós mostra isso.
5. **Arquivo único × dados externos**: o UNet fp16 (~1,72 GB) cabe num `.onnx` único (abaixo do limite de 2 GiB do
   protobuf), o que casa com o `ModelEntry` de um arquivo (§27.1, opção (a)). Mas o ORT pode segurar o proto e os tensores
   ao mesmo tempo (pico ~2×), enquanto os dados externos talvez sejam mapeados em memória. Gravar primeiro o arquivo único,
   que é o que iria no catálogo, e gerar a versão com dados externos só se o pico da sessão matar o processo.
6. **Hospedagem (decisão do dono depois da sonda)**: o fp16 que convertermos não fica em nenhuma URL, e o `ModelManager`
   baixa das `urls` do catálogo. Opções: o dono hospeda a conversão (repo HF ou release no GitHub dele), ou usamos um fp16
   já hospedado (o Olive do softwareweaver, se rodar no EP; o tiny-sd do danyalmalik).
7. **Referência no PC** (`tools/sd_ref.py`, novo, junto da task 1): tokenizer BPE em Python a partir de
   `vocab.json`/`merges.txt`, text encoder, embedding de guidance, 4 passos do LCM e VAE, gerando um 512² no PC em fp32 e
   em fp16. Com isso:
   - a sonda recebe um `encoder_hidden_states` de prompt real, com a faixa de ativação onde o fp16 estoura (em vez de ruído);
   - fica provado que a conversão não dá NaN nem imagem preta;
   - dá para julgar a qualidade para foto de produto;
   - saem os valores de referência dos testes JVM da task 6.

   Limite: os ids vêm da nossa implementação, sem `transformers` no PC, então não são uma referência independente.
8. **Fórmulas do LCM a conferir no diffusers** (GitHub, tag fixa) antes do `sd_ref.py`. De memória, há duas versões do
   `LCMScheduler.set_timesteps`, que dão timesteps diferentes para 4 passos: a antiga (`[::-skipping_step][:n]` → 999, 759,
   519, 279) e a nova (índices por `linspace` → 999, 759, 499, 259). Também de memória: `w = guidance_scale − 1` no
   `get_guidance_scale_embedding`. Conferir os dois e os parâmetros do `scheduler/scheduler_config.json` do Hex.
9. **`convert_float_to_float16` com o UNet de 3,4 GB**: o `infer_shapes` do onnx falha acima de 2 GB. Conferir na fonte
   (`inspect.getsource`) se há o parâmetro `disable_shape_infer` e usá-lo.

**Ordem proposta das rodadas no moto**:
1. `getAvailableProviders()` e uma sessão WebGPU com o UNet do tiny-sd. Responde se o Dawn acha o Mali.
2. tiny-sd em webgpu, nnapi, xnnpack e cpu.
3. LCM-DS7 nos EPs que funcionaram no tiny-sd.
4. `sdDecode` no EP vencedor.
5. Paridade com o PC.

**Próximo passo exato**: task 1 da §27.5 com os ajustes 5, 7, 8 e 9. Baixar em pastas novas no scratchpad da sessão,
uma por repo (scripts em `tools/`, nunca na pasta do download), conferir o sha256 da tabela e só então escrever
`tools/sd_fp16.py`. A listagem bruta desta sessão está em
`C:\Users\luist\AppData\Local\Temp\claude\c--projects-sandbox-product-photo-apk\766bf1b4-84d2-49fb-86c1-cc6b7d6726c8\scratchpad\meta\`
(`hex.json`, `tiny.json`).

### 27.7 Sonda: execução (sessão 24, 2026-10-17)
Downloads em `C:\Users\luist\AppData\Local\Temp\claude\c--projects-sandbox-product-photo-apk\f2729403-9e19-4890-b878-5197b09d7eb7\scratchpad\dl\`
(`hex/`, `tiny/`, `diffusers/`); scripts da sessão em `…\scratchpad\scripts\`.

**Análise (antes do código)**
- **sha256**: os 5 arquivos LFS da tabela da §27.6 batem (`sha256sum`); `vocab.json`/`merges.txt` batem com os blobs
  (`git hash-object` → `469be27c5c01…`, `76e821f1b6f0…`). Também baixados: `scheduler_config.json`, `unet/config.json`,
  `vae_decoder/config.json`, `text_encoder/config.json`, `tokenizer_config.json`, `special_tokens_map.json`; do tiny-sd
  `LICENSE.md`, `README.md`, `scheduler_config.json`.
- **Grafos** (`scripts/graphinfo.py`, sem pesos):
  - tiny-sd UNet: opset 17; `sample` f32 [batch,4,height,width], `timestep` **f32** [batch], `encoder_hidden_states` f32
    [batch,77,768] → `out_sample` f32; pesos FLOAT16 (358), casts internos; só ops padrão (InstanceNormalization 28,
    LayerNormalization 27, Erf 9, Resize 2…). Nomes simbólicos: `batch`, `height`, `width` (não os da §27.5).
  - Hex text encoder: opset 14; `input_ids` **INT32** [batch_size, sequence_length] → `last_hidden_state` f32
    [·,·,768], `pooler_output`; LayerNorm decomposta (ReduceMean/Pow/Sqrt), `Range` 2 (na lista de bloqueio do fp16).
  - Hex VAE decoder: opset 14; `latent_sample` f32 [batch_size,num_channels_latent,height_latent,width_latent] →
    `sample` f32; InstanceNormalization 30, Resize 3. `vae_decoder/config.json`: `scaling_factor` 0.18215.
- **Tokenizer** (`tokenizer_config.json`, `vocab.json`): 49 408 entradas, BOS `<|startoftext|>` = 49406, EOS
  `<|endoftext|>` = 49407, **pad = EOS** (49407), `do_lower_case`, `model_max_length` 77. `a</w>` = 320, `photo</w>` = 1125.
- **Ajuste 8 — LCM no diffusers** (`src/diffusers/schedulers/scheduling_lcm.py` e
  `pipelines/latent_consistency_models/pipeline_latent_consistency_text2img.py`, tags `v0.22.0` e `v0.30.0`):
  - `set_timesteps`: `k = 1000 // original_steps(50) = 20`, `lcm_origin = [1..50]·k − 1` = 19…999. **v0.30**: inverte e
    escolhe `floor(linspace(0, 50, n, endpoint=False))` → 4 passos = **999, 759, 499, 259**. **v0.22** (a do
    `_diffusers_version` do Hex): `[::-skipping_step][:n]` com `skipping_step = 50 // 4 = 12` → 999, 759, 519, 279.
    Uso a v0.30 (a atual); a diferença é pequena e fica registrada.
  - `step`: `x0 = (x − √(1−ᾱ_t)·ε)/√ᾱ_t` (epsilon); `c_skip = 0.25/((10t)² + 0.25)`, `c_out = 10t/√((10t)² + 0.25)`
    (`timestep_scaling` padrão 10, ausente do config do Hex); `denoised = c_out·x0 + c_skip·x`; entre passos
    `x_prev = √ᾱ_prev·denoised + √(1−ᾱ_prev)·z`, z ~ N(0,1); no último passo `x_prev = denoised`. `ᾱ` de `scaled_linear`
    (`linspace(√0.00085, √0.012, 1000)²`, cumprod); `set_alpha_to_one` → `ᾱ_final = 1`. `init_noise_sigma` = 1.
  - Guidance: `w = guidance_scale − 1` (padrão do pipeline 8.5 → 7.5); `get_guidance_scale_embedding(w, 256)`:
    `w·1000`, `emb = exp(−arange(128)·ln(10000)/127)`, `[sin(w·emb), cos(w·emb)]` (sin primeiro).
  - Decodificação: `vae.decode(denoised / 0.18215)`, imagem em [−1,1].
  - `unet/config.json`: `sample_size` **96** (o Dreamshaper v7 LCM foi treinado em 768²; 512² roda, qualidade a ver).
- **Ajuste 9 — `convert_float_to_float16`** (`inspect.getsource`, onnxruntime 1.29): com caminho `str` ele mesmo chama
  `infer_shapes_path` (serve para > 2 GB), mas num `tempfile.NamedTemporaryFile` aberto, que no Windows não pode ser
  reaberto. Por isso o script roda `onnx.shape_inference.infer_shapes_path` num arquivo próprio e passa o `ModelProto`
  com `disable_shape_infer=True`. `DEFAULT_OP_BLOCK_LIST` não tem nenhum op do UNet (tem `Range`, `Min`, `Max`, `Upsample`…);
  `ALWAYS_FLOAT_INPUTS` mantém o `scales` do `Resize` em fp32. `force_fp16_initializers=False` (padrão) deixa em fp32 só
  os pesos que alimentam nós bloqueados.

**Tasks desta sessão (arquivo → o que prova)**
1. `tools/sd_fp16.py <entrada.onnx> <saida.onnx>`: fp16 com `keep_io_types=True`, arquivo único (ajuste 5), sha256;
   aplicado ao UNet, text encoder e VAE do Hex.
2. `tools/sd_ref.py`: tokenizer BPE + text encoder + LCM 4 passos + VAE no ORT do PC, fp32 e fp16 com a mesma seed;
   grava PNGs e as entradas fixas da sonda (`.bin` f32) e o `out_sample` de referência do 1º passo. Prova: sem NaN, imagem
   coerente, erro fp32×fp16.
3. `DeviceProbe#sdUnet` / `#sdDecode` (+ `MemAvailable` em `memory()`, ajuste 1) e as rodadas da ordem da §27.6.

**Resultado da task 1 no PC (feito)**
- `tools/sd_fp16.py` (novo): `infer_shapes_path` próprio + `convert_float_to_float16(keep_io_types=True,
  disable_shape_infer=True)` + **ordenação topológica** (o conversor anexa no fim da lista os `Cast` das entradas e dos
  `scales` do `Resize`, e o `onnx.checker` recusa: "Nodes in a graph must be topologically sorted") + `.onnx` único.
  Saídas (em `…\scratchpad\fp16\`; `check_model` ok; I/O em fp32, `timestep` int64):

  | Arquivo | Bytes | sha256 |
  |---|---|---|
  | `lcmds7_unet.onnx` | 1 721 767 043 | `cce224e14f6800a3ef62cb3167ab5a37870653387dbcad5675b7361b7af03528` |
  | `lcmds7_text_encoder.onnx` | 246 604 419 | `552dc3ddb83ec6cd3c6a96669d3d0678cd06788c7ff44455509c69c1c0bde1e6` |
  | `lcmds7_vae_decoder.onnx` | 99 139 835 | `30352b600cadd7fec224eb2ab138e8c2733ae6e0817613530c13dc4372cca307` |

  O fp16 sai com 1,72 GB num arquivo só, abaixo de 2 GiB (ajuste 5), e a conversão do UNet rodou com ~6 GB livres no PC.
- `tools/sd_ref.py` (novo): tokenizer BPE em Python (`"a photo of a cat"` → 49406 320 1125 539 320 2368 49407, os ids
  conhecidos do CLIP), text encoder, guidance 8.5 (w = 7.5), timesteps 999/759/499/259, VAE. Prompt "professional
  product photo of a white ceramic coffee mug on a wooden table, soft studio lighting, high detail", seed 42 →
  `…\scratchpad\ref\ref_fp32.png` e `ref_fp16.png`: **xícara branca coerente sobre madeira, luz de estúdio,
  fp16 indistinguível do fp32 a olho**. Paridade (log em `…\scratchpad\logs\sd_ref.log`):
  - `ehs` fp32×fp16: máx 0,0067, média 0,00045 (faixa fp32 −28,1..33: nada perto do limite do fp16);
  - `out_sample` do 1º passo, mesmas entradas: máx 0,0026, média 0,00019 (faixa ±3,96);
  - imagem final: máx 42/255 num pixel, média 0,25/255; sem NaN em nenhum estágio.
  - Tempos do PC **não valem**: a máquina paginava (fp32 UNet ~10 s/passo, fp16 no CPU EP 51–77 s/passo por causa dos
    casts, como na §24.5).
- Entradas fixas da sonda (`…\scratchpad\ref\`): `latent.bin` (seed 42, sha256 `620314f8…7a90`), `ehs.bin` (prompt
  acima no text encoder fp32, `46124480…6c27`), `tcond.bin`, `ids.txt`, referências `out_lcmds7_fp32.bin`,
  `out_lcmds7_fp16.bin`, `out_tinysd.bin` (UNet do tiny-sd com as mesmas entradas, t = 999.0, sem NaN) e `vae_ref.bin`
  (VAE fp16 em `latent.bin`/0,18215, faixa −1,84..1,74).
- `DeviceProbe.kt`: `sdUnet`, `sdDecode`, `sdOptions` (cpu / xnnpack / webgpu com mapa vazio / nnapi com `USE_FP16` /
  `nnapi32` sem flags; `-e verbose true` põe a sessão em VERBOSE), `memory()` com `MemAvailable`. API conferida no
  `javap` do `classes.jar` 1.31: `getEnvironment(OrtLoggingLevel, String)`, `setSessionLogLevel`, `addWebGPU(Map)`,
  `addNnapi()`/`addNnapi(EnumSet<NNAPIFlags>)`, `createTensor(env, Int/Long/FloatBuffer, long[])`. Chaves do WebGPU EP
  nas strings do `.so`: `ep.webgpuexecutionprovider.{deviceId, powerPreference, preferredLayout, enableGraphCapture,
  enableInt64, forceCpuNodeNames, validationMode, …}` (não usadas: padrão). Mensagens a filtrar no logcat:
  "Node(s) placed on [", "All nodes placed on [", "number of nodes supported by NNAPI", "number of partitions supported by NNAPI".
  `:app:assembleDebugAndroidTest` compila (APK de 11:38); o `installDebug` falhou só por falta do aparelho.

**Bloqueio (11:40)**: o moto `ZY32LMNN9B` apareceu no `adb devices` uma vez (~10:40) e caiu; depois de `adb kill-server`
o adb vem vazio e o Windows não lista aparelho Android/MTP. O envio (`scripts/push.sh`) falhou inteiro ("device not
found"): **nada novo está no moto**.

**Próximo passo exato (tasks 2–5, com o moto no USB)**:
1. `ANDROID_SERIAL=ZY32LMNN9B ./gradlew :app:installDebug :app:installDebugAndroidTest`.
2. `sh …\scratchpad\scripts\push.sh …\scratchpad` (envia entradas, referências, `tinysd_unet.onnx` e os três fp16 do
   LCM-DS7 por `run-as … cat >`, ~2,7 GB, e imprime o sha256 no aparelho: conferir com as tabelas acima e da §27.6).
3. Rodadas, uma por `am instrument` (`adb shell am instrument -w -e class 'com.productphoto.app.DeviceProbe#sdUnet'
   -e model tinysd -e ep webgpu com.productphoto.offline.test/androidx.test.runner.AndroidJUnitRunner`), na ordem da
   §27.6: tiny-sd webgpu (+ `-e verbose true` numa rodada à parte, `adb logcat -d -s onnxruntime` filtrando "placed on" /
   "supported by NNAPI"), nnapi, nnapi32, xnnpack, cpu; LCM-DS7 nos EPs que funcionarem (não em cpu/xnnpack, ajuste 2);
   `#sdDecode -e ep <vencedor>`. Resultado: `adb logcat -d -s DeviceProbe:I`; antes de cada rodada,
   `adb logcat -c`. Observar `MemAvailable` e se o processo morre no LMK (`adb logcat -d | grep -i lowmemorykiller`).
4. Tabela (EP × modelo: sessão, aquecimento, mediana, VmHWM, MemAvailable mín., erro × PC) aqui e a escolha pelo
   critério da §27.4 item 5.

**Execução no moto (22:30–22:40, mesmo dia; moto voltou ao USB)**
- Install ok. Envio: o USB/adb caiu duas vezes durante a cópia (uma vez o servidor do adb morreu), e um arquivo deu
  `cat` sem erro mas **sha256 errado**. `scripts/push.sh` virou retomável: confere o sha256 no aparelho, pula o que já
  bate e reenvia após `wait-for-device`. Todos os arquivos estão em `files/probe/` com os sha256 das tabelas.
- `getAvailableProviders()` = **[CPU, NNAPI, XNNPACK, WEBGPU]**.

  | Modelo / EP | Sessão | 1ª rodada | Mediana 4 | VmHWM | MemAvailable mín. | Erro × PC (máx / média) | Nós |
  |---|---|---|---|---|---|---|---|
  | tiny-sd / webgpu | 3,9 s | 6,1 s | **5,3 s** | 1,99 GB | 1,31 GB | 0,057 / 0,0047 | 972 todos no WebGPU |
  | tiny-sd / nnapi (USE_FP16) | 6,4 s | 17,1 s | — | 2,86 GB | 0,53 GB | — | NNAPI aceita 24 de 940 nós (2 partições); 1211 na CPU; **LMK** (3,25 GB RSS + 1,5 GB swap) |
  | tiny-sd / nnapi32 | 6,0 s | 17,8 s | — | 2,71 GB | 1,44 GB | — | igual; **LMK** |
  | tiny-sd / xnnpack | 4,6 s | 9,6 s | 9,3 s | 3,09 GB | 1,06 GB | **0,96 / 0,17** (errado) | — |
  | tiny-sd / cpu | 4,9 s | 14,8 s | — | 2,91 GB | 1,25 GB | — | **LMK** |
  | LCM-DS7 fp16 / webgpu | 17,4 s | 11,6 s | **9,4 s** | **5,20 GB** | **0,32 GB** | 0,058 / 0,0045 | 1782 WebGPU, 3 CPU |

  (erro do tiny-sd contra o `out_tinysd.bin` do PC; do LCM-DS7 contra `out_lcmds7_fp16.bin`; faixa da saída ±4.)
- Leitura: **WebGPU é o único EP que serve** (NNAPI do ORT não cobre o UNet: ajuste 3 confirmado; CPU/XNNPACK morrem
  ou erram, ajuste 2 confirmado também no tiny-sd). O LCM-DS7 cabe no tempo (4 × 9,4 s ≈ 38 s de UNet), **mas não na
  memória**: RSS estável de 4,3 GB para 1,72 GB de pesos. No tiny-sd, 1,93 GB de RSS para 0,65 GB de pesos. A razão é
  de ~2,5× os pesos nos dois, o que sugere os pesos duas vezes no processo (proto/initializers na CPU + buffers da GPU,
  que no Mali são RAM do processo) + ativações. Hipótese a testar (ajuste 5): pesos em dados externos, que o ORT pode
  mapear (`mmap`) em vez de copiar.

**De onde vem a memória (tiny-sd / webgpu, `memory()` com `RssAnon`/`RssFile`)**
- `tools/onnx_external.py` (novo): pesos em `<arquivo>.data` com offsets alinhados a 64 KiB (o `onnx.save_model` não
  alinha; o ORT só mapeia offset alinhado). Saída igual ao arquivo único no PC (diferença 0,0). No moto (`tinysdx`):
  VmHWM 1,91 GB, igual ao arquivo único → **hipótese do proto duplicado descartada**.
- `RssAnon` fica em **~78 MB**; o resto é **`RssFile`**: 1,1–1,2 GB logo após a sessão (0,65 GB de pesos) e 1,84 GB
  depois da 1ª rodada. É memória da GPU que o driver do Mali mapeia por arquivo de dispositivo, não heap da CPU.
- Nada disso reduz a memória da sessão (todas as linhas: sessão ~1,1–1,2 GB de `RssFile`, mediana ~5,3 s, mesmo erro):
  `storageBufferCacheMode` `bucket`/`disabled`; os quatro `*BufferCacheMode=disabled`; `-e opt basic`; `-e opt none` (as
  ativações sobem a 2,84 GB). `preferredLayout=NCHW` deixa a memória igual e fica **8× mais lento** (42 s). As chaves do
  `addWebGPU` vão **sem prefixo** e os valores são minúsculos (`Bucket` dá "Invalid buffer cache mode"). O custo de
  ~1,7–1,8× os pesos na GPU é estrutural no WebGPU/Dawn do Mali, nesta versão.

**Task 3 — text encoder e VAE fp16 do LCM-DS7 em webgpu (`sdDecode`, as duas sessões abertas)**

| Medida | Sessões | Text encoder | VAE | VmHWM | MemAvailable mín. | Erro × PC |
|---|---|---|---|---|---|---|
| VAE 512² (latente 64²) | 1,9 s | 0,50 s | **26,0 s** | **4,02 GB** | **0,41 GB** | text encoder × fp32: máx 0,20, média 0,011 (faixa ±30); VAE × fp16 do PC: máx 0,060, média 0,0066 |
| VAE em bloco de 256² (latente 32², `-e lat 32`) | 2,0 s | 0,23 s | 6,5 s por bloco | 1,35 GB | 2,14 GB | — |

O VAE inteiro é o maior consumidor de memória (as ativações a 512² com 128–512 canais). Em blocos, a memória cai a um
terço; o tempo não cai (4 blocos sem sobreposição ≈ 26 s, com sobreposição mais).

**Task 4 — paridade moto × PC** (já nas tabelas): UNet do LCM-DS7 máx 0,058 / média 0,0045 para saída ±4, sem NaN; do
tiny-sd 0,057 / 0,0047. O erro é ~20× o do fp16 no CPU do PC (0,0026), o que é esperado de cálculo fp16 na GPU, e não
mostra kernel errado. O XNNPACK (média 0,17) é o único errado. **Falta** ver a imagem gerada no moto: só a saída de 1
passo foi comparada.

**Task 5 — escolha pelo critério da §27.4 item 5 (≤ ~2 GB de pico, ≤ ~60 s por 512²)**
- Motor/EP: **ORT 1.31 + WebGPU** (único EP que serve). Modelo: **LCM-DS7 fp16**, 4 passos. Sessões em sequência
  (UNet, fecha, VAE), nunca juntas.
- Conta para um 512² no moto, com sessões em sequência: sessão do UNet 17 s + text encoder 0,5 s + 4 × 9,4 s + VAE
  26 s (inteiro ou em blocos) ≈ **80 s na 1ª geração e ~65 s com as sessões já abertas**. Pico: **5,2 GB** (VmHWM na
  criação da sessão do UNet; RSS estável 4,3 GB; o LMK matou apps de fundo e o `MemAvailable` chegou a 0,32 GB).
- **Não passa no critério**: o tempo fica perto do limite, mas a memória fica 2,5× acima. No moto de 8 GB a geração
  roda, no limite e matando o que está em segundo plano. Num aparelho de 6 GB ela não roda.
- O que mudaria a conta (decisão do dono, ver HANDOFF §30):
  1. **TAESD** (MIT, 4,9 MB; falta ONNX: exportar exige torch, que o PC não tem) no lugar do VAE: tira ~26 s e a parte de
     memória do VAE. É o ganho mais barato.
  2. **UNet menor com LCM** (tiny-sd/BK-SDM com LCM-LoRA fundido, ~0,65 GB): ~5,3 s por avaliação e pico de ~2 GB
     medidos no tiny-sd. Mas não há exportação ONNX com licença (o `akameswa` não tem licença), e fundir a LoRA também
     exige torch. A qualidade fica a julgar.
  3. Aceitar o LCM-DS7 como está, com `MinRamMb` = 8192 (provavelmente 12288 para ter folga), e a cadeia padrão no
     aparelho só acima disso.
  Sem uma dessas mudanças, o moto continua no servidor (§27.4 item 5).

## 28. Sessão 24, 2ª parte (2026-10-18): pendências fora da fase 8
**Decisão do dono (2026-10-18)**: a fase 8 fica **por último**; antes, as outras pendências.

**Pendências conferidas** (fontes: §19.7, §20.8, §21.4 "Pendências novas", §21.5, HANDOFF §26–§30):
- Já resolvidas em sessões seguintes: BiRefNet (§24–§25), brand kit vazio (§23), `MinRamMb` × MemTotal (§22),
  cancelamento do `OpenAiCompatibleTextGenerator` (§21), cancelamento na ponte do editor (§26), recorte Automático (§26.4).
- Abertas, por ordem de ataque:
  - **A.** §21.4 item 2: falha nativa do LiteRT-LM que não cai na cadeia (ver abaixo).
  - **B.** §21.4 item 3: `cache/litertlm` de 3 GB no `cacheDir`. O sistema pode apagar e a GPU recompila em 56 s. Falta
    saber se aparece no "espaço usado".
  - **C.** §21.5/§20.7: o recorte desfeito por ação de IA numa imagem recortada foi corrigido no `imageGeometry`, mas
    **não foi visto na tela**.
  - **D.** §21.4 item 6: itens da interface não percorridos (seletor de fonte, compartilhar/imprimir, Recortar, Filtros,
    texto em curva, tela de Brand kit; pinça precisa de dedos).
  - **E.** Apagar `C:\projects\sandbox\product_photo_apk\HANDOFF_APP_OFFLINE.md` (cópia solta da §26).
  - Ficam com o dono ou dependem de servidor (memória: não liderar com servidor): avaliação das amostras da fase 2;
    servidor real A1111/ComfyUI (§19.7); mockup em superfície curva (§21.5); texto do cartão da Home (vai com a fase 8).

**A — símbolos abertos**
- `ai/litertlm/.../LiteRtLmTextGenerator.kt`:
  - `createEngine`: `Engine(config)` fica **fora** do `try`; o `initialize()` em erro fecha o motor e converte
    `OutOfMemoryError`/`RuntimeException` em `AiError.Unavailable(Model(id))`; qualquer outro `Throwable` (ex.
    `UnsatisfiedLinkError`, que é `LinkageError`) **sobe cru** e derruba a chamada fora do `AiError`.
  - `send`: `createConversation` com `RuntimeException` → `InvalidOutput`; `sendCancellable`: `RuntimeException` →
    `InvalidOutput`; resposta vazia → `InvalidOutput`.
- `core/ai-api/.../AiError.kt`: `isFallbackable` = `Unavailable`/`ModelNotDownloaded`/`Network`.
  `FallbackChain.run`: erro não fallbackable sobe para a UI; `Unavailable` acumula o `missing`.
- LiteRT-LM 0.18.0 (`javap -c` do `classes.jar`): `Engine.initialize()` chama `LiteRtLmJni.nativeCreateEngine(…)` com o
  backend. `Engine.createConversation()` chama `nativeCreateConversation(enginePtr, …)`, que também aloca no nativo (sessão,
  KV cache).
- Conclusão: o caso da §21.4 (OpenCL ausente → `Backend.GPU()` falha) acontece no `nativeCreateEngine` e **já cai** na
  cadeia pela linha do `initialize`. O texto da §21.4, que culpava o `catch` do `generate`, descrevia um código que não
  existe mais. Continuam furados: (1) falha nativa na criação da conversa sai como `InvalidOutput`, embora seja recurso
  (memória/GPU), não saída ruim; (2) `LinkageError` (lib nativa ausente ou de outra ABI) e falha no construtor do `Engine`
  sobem crus.
- Task A: criação do motor e da conversa com o mesmo tratamento (`RuntimeException`, `OutOfMemoryError`, `LinkageError` →
  `Unavailable`). Erro **durante** a geração continua `InvalidOutput`. Prova: teste JVM em `LiteRtLmTest`: na JVM do PC a
  lib nativa Android não carrega, então `generate` tem de lançar `AiError.Unavailable` com `Model(id)`, e não um `Error`.
- **Resultado A**: o teste falhou antes da correção ("expected Unavailable but was `java.lang.UnsatisfiedLinkError`") e
  passou depois. `nativeSetup { }` envolve `Engine(config)`, `initialize()` e `createConversation()`. `LiteRtLmTest` 3/3.

**B — símbolos abertos**
- `LiteRtLmFactory.create` (`LiteRtLmTextGenerator.kt`): cache em `File(ctx.androidContext.cacheDir, "litertlm")`,
  **uma pasta para todos os modelos**. `DeviceProbe.llm` e `LiteRtLmProbe` usam a mesma.
- `AppGraph.deleteModel`: `models.delete(id)` + `invalidate` das cadeias de recorte e texto; **não toca no cache**.
- `ModelsScreen`: o diálogo diz "Libera <sizeBytes>"; a tela não mostra "espaço usado" em lugar nenhum, só o tamanho do
  catálogo por modelo.
- Consequência: remover o Gemma (ou o Qwen) deixa o cache compilado dele (parte dos 3 GB da §21.4) até o sistema limpar o
  `cacheDir`. Os nomes dos arquivos no cache não foram vistos (o moto caiu do USB): a correção não depende deles.
- Decisão: **o cache fica no `cacheDir`**. É regenerável (56 s de recompilação na GPU), e o sistema poder recuperá-lo sob
  falta de espaço é o certo; levar 3 GB para `files/` o tornaria impossível de liberar fora do app.
- Task B: `LiteRtLmFactory.prepareCacheDir(appCacheDir, modelId)` devolve `cache/litertlm/<modelId>/` e apaga os arquivos
  soltos em `cache/litertlm/` (layout antigo, compartilhado). `create` usa essa pasta; `deleteModel` apaga
  `cacheDirFor(id)` depois do `invalidate` (motor fechado; apagar arquivo aberto é seguro no Linux). As sondas passam a
  usar `cacheDirFor`. Prova: teste JVM com pasta temporária: arquivo solto some, a pasta de outro modelo fica, e o
  caminho devolvido é o do modelo.
- **Resultado B**: feito como planejado (`LiteRtLmFactory.cacheDirFor`/`prepareCacheDir`, `AppGraph.deleteModel`,
  `DeviceProbe.llm`, `LiteRtLmProbe`). `:ai:litertlm:testDebugUnitTest` 4/4, `:app:testDebugUnitTest`, `:app:assembleDebug`
  e `:app:assembleDebugAndroidTest` verdes. **Não visto no moto** (fora do USB): na próxima conexão, conferir que o 1º uso
  do Gemma cria `cache/litertlm/gemma-4-e2b-it/` e que "Remover" na tela Modelos apaga essa pasta
  (`run-as com.productphoto.offline du -sh cache/litertlm/*`). O "espaço usado" na tela continua de fora (não pedido).
- **B conferido no moto (2026-10-18 01:33)**: `LiteRtLmInstrumentedTest` OK. O Gemma atendeu a cadeia; antes, havia
  3,0 GB soltos em `cache/litertlm/` (`<arquivo>.litertlm_<n>_<n>.xnnpack_cache`, `_mldrift_program_cache.bin`,
  `_mldrift_weight_cache.bin`, de Gemma e Qwen). Depois: só `cache/litertlm/gemma-4-e2b-it/` (753 MB, o xnnpack_cache).
  `provider_config.json` igual ao backup. O "Remover" pela tela **não foi testado**, porque apagaria um modelo do dono.

**D — passada pela interface no moto (2026-10-18, adb + capturas do app; nada da galeria)**
- Brand kit: os campos abrem, a amostra de cor acompanha o hex (`#E53935` → vermelho), o seletor de fonte lista as 13
  famílias e atualiza o rótulo ("Títulos: Lobster"). **Voltar descarta as edições sem perguntar**: o kit continuou vazio
  (bom para o teste), mas o usuário perde o que digitou (UX, registro). O seletor mostra os nomes na fonte do sistema, sem
  prévia da própria fonte (UX).
  Notas de automação: o `input text` do adb não decodifica `%23` (usar `keyevent KEYCODE_POUND`); `uiautomator dump`
  no Git Bash precisa de `MSYS_NO_PATHCONV=1`.
- Templates → "Promoção": abre com o texto de exemplo do brand kit vazio (§23). No editor, a fonte do texto (`<select>`
  nativo) troca na hora (Pacifico) e ativa o desfazer.
- **Defeito 1, rótulo**: na barra de texto, o seletor de cor e o slider de espessura se chamam ambos "Contorno"
  (`editor-web/src/main.ts:211-212`); nas formas, o slider se chama "Espessura" (`main.ts:186`).
- **Defeito 2, curva**: com Curva 87, o arco é desenhado bem **acima** da caixa de seleção, sobre o círculo do
  template, enquanto as alças ficam onde estava o texto reto. Causa, pela fonte (`editor.ts::setCurve`; Fabric 7.4.0
  `Text.ts`/`Textbox.ts`):
  - `setCurve` mede o arco por `t.width`, que num `Textbox` é a largura da **caixa** (~710 px na tela), não a do texto
    (~260 px com Pacifico).
  - O Fabric centraliza o texto no caminho (`pathAlign: 'center'`) e põe cada letra em `ponto − path.pathOffset`
    (`_setGraphemeOnPath`), onde `pathOffset` é o centro da caixa do arco. O texto cobre só o meio do arco, que fica
    `flecha/2` acima do centro do objeto. Com 87, a flecha é ~0,29 × a largura.
  - `Textbox.initDimensions` ignora o `path` (o `Text` usaria `path.width/height`) e mantém a altura do texto reto:
    a caixa não cobre o arco.
  - Task: `src/curve.ts::curveArc(textWidth, amount)` (puro), com o arco medido pela largura do texto
    (`t.calcTextWidth()`), e no `setCurve` a altura da caixa = flecha + altura da linha, mantendo o centro. Prova:
    vitest `test/curve.test.ts` (comprimento do arco = largura do texto; flecha; sinal; 0 = sem caminho) + rever no moto.
- Recortar: as alças não respondem ao `input swipe` (§20.8); fica para teste com o dedo (item C).
- **Resultado D (código)**: `src/curve.ts` (novo) + `editor.ts::setCurve` (arco por `calcTextWidth()`, altura =
  flecha + `getHeightOfLine(0)`, centro mantido por `setPositionByOrigin`) + rótulo "Espessura" em `main.ts`.
  `tsc --noEmit` limpo, vitest 33/33 (4 novos em `test/curve.test.ts`), `npm run build` regerou
  `editor/src/main/assets/editor/`, `:app:assembleDebug` ok. **Falta ver no moto** (caiu do USB antes do install):
  Promoção → "Sua empresa" → Pacifico → Curva 87 deve dar o arco dentro das alças. Limite conhecido, sem mudança: o arco
  é calculado no momento do slider; mudar fonte/tamanho/texto depois não o recalcula.
- Não percorridos ainda: Filtros (precisa de imagem no documento), Exportar → compartilhar/imprimir, texto curvo para
  baixo.

**D, 2ª passada (2026-10-18 22:00–22:15, com trava de foco no `ui.sh`)**
- **Curva corrigida vista no moto**: Curva 87 → o arco usa o texto inteiro, centrado onde estava o texto; a caixa de
  seleção cobre o arco. Rótulo "Espessura" ok.
- Exportar: **Imprimir** abre `com.android.printspooler/.ui.PrintActivity` (cancelado com Voltar); **Compartilhar** abre
  `com.android.intentresolver/.ChooserActivityLauncher` (fechado sem escolher; sem captura, mostra contatos). Depois de
  imprimir, a folha Exportar fecha. UX: o slider "Qualidade JPG" aparece com o formato PNG.
- Filtros: o fundo de imagem (cenário) é travado de propósito (`editor.ts::replaceBackgroundLayer`, `selectable: false`),
  então não abre o painel de imagem. Toda imagem comum vem da galeria/câmera/logo, que abrem a galeria pessoal do dono:
  fica para ele.
- **Defeito 3, rascunho vazio**: a lista Rascunhos tinha 3 "Sem nome" 1080×1080 vazios criados hoje (01:48, 21:45,
  21:58), um a cada abertura de Templates pela Home. Causa: `Editor.load` sempre chama `onChange()` (`editor.ts:104`);
  `main.ts` (`editor.onChange`) põe `dirty = true` e agenda `saveDraft` em 4 s. No `start()`, abrir um rascunho
  (`open.kind === 'draft'`) ou uma página em branco (`newDocument`: `gallery`, `new`, template não achado, sem payload)
  fica `dirty`: grava um rascunho vazio ou regrava o aberto sem mudança. O `loadProject` (`main.ts:46-48`) já zera o
  `dirty` depois do `load`; o caminho de template marca `dirty` de propósito (`openTemplate`) e o de imagem faz `commit`.
  Task: no `start()`, zerar `dirty` e o timer depois do rascunho e de cada `newDocument` sem conteúdo. Prova: no moto,
  Home → Templates → esperar 6 s → fechar → a lista Rascunhos não ganha "Sem nome" (o `main.ts` depende de DOM e da
  ponte; não há vitest para ele).
- **Resultado defeito 3**: `untouched()` no `start()` de `main.ts` (rascunho, `new`, `gallery`, template não achado e sem
  payload). `tsc` limpo, vitest 33/33, bundle regerado, instalado no moto. Prova no moto (22:25): Templates aberto por
  7 s → nenhum "Sem nome" novo; dois rascunhos abertos e fechados (o de 22:07 por 7 s, o de 01:55) mantiveram o horário
  e a ordem da lista.
- Ficaram no moto 6 rascunhos de teste de hoje (3 "Promoção", 3 "Sem nome"), mais os de sessões anteriores: apagar só
  com o OK do dono.
- **Sobra do D com o dono**: Filtros e o item C (recorte numa imagem recortada) precisam de imagem da galeria e de
  arrastar as alças; o restante do D está feito.

**D/C com o dono (22:36–23:00; foto do dono, um adaptador USB-C, posta por ele no editor)**
- Filtros: a folha abre; Sépia e Brilho aplicam na hora. "Nenhum" zera só o preset e mantém os ajustes, o que é
  proposital (`main.ts::showFilters`, preset e `Adjustments` independentes). UX: nenhum preset aparece marcado; não há
  "zerar ajustes"; os sliders não ficam alinhados entre si.
- **Item C conferido**: o dono recortou à mão; "✨ Remover fundo" na imagem recortada → a caixa na tela ficou idêntica
  ((347,737)–(570,890) antes e depois), e o fundo saiu. A correção do `imageGeometry` (§20.7) funciona.
- **Defeito 4, recorte preso**: depois do recorte, a imagem mostrava as alças de recorte ao ser selecionada, e
  "Recortar" não fazia nada. Causa (`editor.ts::startCrop/endCrop`; `main.ts::imageProps`): o Concluir só existe no
  painel; tocar fora da imagem limpa a seleção, o `renderProps(undefined)` apaga o painel e o `cropState` fica preso
  (os controles de recorte não voltam, e `startCrop` recusa com `cropState` preenchido). Task: no `selection:cleared` e no
  `selection:updated` para outro objeto, chamar `endCrop()` antes do `onSelection`. Prova: no moto, Recortar → tocar
  fora → selecionar de novo → alças normais e "Recortar" volta a abrir o modo.
- **Resultado defeito 4 (código)**: `Editor.leaveCrop()` (privado) chamado no `selection:cleared` e no
  `selection:updated`; `tsc` limpo, vitest 33/33, bundle regerado, instalado no moto. Depois do reinstall, o rascunho
  "Sem nome" de 22:54 reabre com as alças normais. **Prova no moto pendente**: o dono pegou o celular (WhatsApp em
  primeiro plano) e a trava de foco do `ui.sh` parou o teste antes do toque fora.
- **Observação do dono (23:05)**: depois do "Remover fundo", o adaptador (prateado) ficou indistinguível da página
  branca, "parte do produto desaparece". Duas hipóteses, **não conferidas**:
  1. o Brilho 0,52 do teste de Filtros continua aplicado (`replaceImage` guarda os `filters`, `editor.ts:468`) e
     lava o produto claro. Nas capturas `i5`/`i6`, a imagem já estava quase branca antes do recorte;
  2. a máscara do ML Kit comeu áreas claras do produto.
  Teste: Filtros → Brilho 0 (se o produto voltar inteiro, é a 1); depois Fundo → cor escura (buracos = máscara, a 2).
  UX, nos dois casos: recorte claro sobre página branca some; avaliar xadrez/contorno na seleção, como a tela de Foto de
  produto já mostra o xadrez.

## 29. Sessão 25 (2026-10-18/19): UX do HANDOFF §32 task 3
**Decisões do dono (sessão 25)**: corrigir as quatro UX (Brand kit, Exportar, Filtros, Curva); **não apagar** nenhum
rascunho de teste (task 4 encerrada sem ação). No início da sessão, o moto não estava no USB (o adb só via os emuladores
`emulator-5554` ATV e `emulator-5556` gphone): as tasks 1 e 2 (prova do defeito 4 e o produto que some no branco) ficam
para quando ele voltar.

**Símbolos abertos**
- `app/.../BrandKitScreen.kt::BrandKitScreen`: `kit` é estado local carregado por `graph.brandKits.load()`; só o botão
  "Salvar" chama `brandKits.save(k)`. A tela não tem `BackHandler`: o do `MainActivity.kt::AppNavigation`
  (`BackHandler(enabled = nav.stack.size > 1) { nav.pop() }`) tira a tela e descarta o `kit`. Um `BackHandler`
  composto depois (dentro da tela) tem prioridade no dispatcher. `BrandKit` é `data class` (comparação por `==` serve
  para saber se mudou). Seletor de fonte: `AlertDialog` com `Text(fam)` na fonte do sistema.
- `AppGraph.bundledFontFamilies`: lê só `family` de `assets/content/index.json`; cada item tem também
  `file` (ex. `fonts/Montserrat/Montserrat.ttf`, relativo a `content/`). Único usuário: o `BrandKitScreen`.
- `editor-web/src/main.ts::showExport`: o slider "Qualidade JPG" fica sempre na folha; `format` começa em `png`.
- `main.ts::showFilters`: chips de preset sem estado visual (`button(label, …)`); `adj` é lido de `img.filters`
  (`Editor.applyFilters` só põe na lista os ajustes ≠ 0, então reler depois de zerar dá 0). A classe `primary`
  (`styles.css:41`) já existe para destacar um botão.
- `editor.ts::setCurve`: mede o arco com `calcTextWidth()` e põe a altura = flecha + `getHeightOfLine(0)`. Fabric 7.4
  `Text.set` roda `initDimensions()` para toda chave de `textLayoutProperties` (fontes, `text`, `charSpacing`,
  `lineHeight`, `textAlign`, `styles`, `path*`; no `Textbox` também `width`); `ITextBehavior.updateFromTextArea` também.
  Resultado: depois de mudar fonte/tamanho/texto, a altura volta à do texto reto e o arco fica com o comprimento antigo.
  O mesmo vale para `loadFromJSON` (`Editor.load`, `Editor.restore` do desfazer; o `applyBrandKit` troca a fonte no JSON
  e recarrega): a curva salva (`curve` está em `CUSTOM_PROPERTIES`) volta com o arco antigo e a caixa do texto reto.
- `main.ts::setText` (reescrita por IA) faz `t.set({ text })` direto, sem passar por `Editor.set`.

**Tasks**
1. Brand kit: `BackHandler(enabled = kit != saved)` na tela, com diálogo Salvar / Descartar / Continuar editando;
   `saved` atualizado no Salvar. `onBack` vem do `AppNavigation` (`nav.pop()`). Seletor: cada nome na própria fonte
   (`Typeface.createFromAsset` → `FontFamily(typeface)`), com `AppGraph.bundledFonts` (família + caminho do asset) no
   lugar de `bundledFontFamilies`. Prova: `assembleDebug` + no moto (editar → Voltar → diálogo; seletor com prévia).
2. Exportar: o slider só aparece com JPG (troca de formato mostra/esconde). Prova: no moto.
3. Filtros: o preset ativo com `primary`; botão "Zerar ajustes" (zera `adj`, aplica, reabre a folha com os sliders em 0).
   Prova: no moto.
4. Curva: `Editor.refitCurve(t)` (público, sem commit) refaz o arco com a largura atual e a altura; chamado no
   `Editor.set` quando uma chave de layout muda num `Textbox` com `curve` ≠ 0, no `text:changed`, no `object:modified`
   (largura da caixa), depois de cada `loadFromJSON` (`load`, `restore`) e no `main.ts::setText`. `setCurve` passa a usar
   o mesmo código. Prova: `tsc`, vitest (o `curveArc` já tem teste; o refit depende do canvas, sem jsdom com canvas aqui)
   e no moto: Curva 87 → trocar fonte e tamanho → o arco acompanha e fica dentro das alças.

**Resultado (código, 2026-10-18 23:15)**
- Curva: `Editor.refitCurve(t)` + `curveText` (privado, o corpo antigo do `setCurve`, sem commit) + `refitCurves()`
  depois do `loadFromJSON` em `load` e `restore`; `Editor.set` refaz quando alguma chave está em
  `Textbox.textLayoutProperties`; `object:modified` e `text:changed` chamam `refitCurve(target)`; `main.ts::setText`
  também. Conferido no Fabric: `calcTextWidth` soma as larguras dos glifos (`_measureLine`), sem depender do caminho,
  então refazer sobre um texto já curvo dá o mesmo arco.
- Exportar: `qualityRow.hidden` segue o formato. `styles.css` ganhou `[hidden] { display: none !important; }`, porque
  `label.slider { display: flex }` vencia o atributo.
- Filtros: chips com `primary` no preset ativo; "Zerar ajustes" zera, aplica e reabre a folha (`showFilters(img)`).
- Brand kit: `BrandKitScreen(graph, onBack)` com `saved` + `BackHandler(enabled = kit != saved)` → diálogo "Sair sem
  salvar?" (Salvar / Continuar editando / Descartar). Seletor de fonte com `FontFamily(Typeface.createFromAsset(...))`
  carregado por `produceState` no IO. `AppGraph.bundledFontFamilies` → `bundledFonts: List<BundledFont>`.
- `tsc` limpo, vitest 33/33, `npm run build` regerou o bundle, `:app:testDebugUnitTest` e `:app:assembleDebug` verdes.
  **Falta ver no moto** (fora do USB). O emulador `emulator-5556` estava com outro app (`come.nanodata.armsx2`) e não
  tem o nosso: não foi usado.

**Defeito 5, achado no moto (2026-10-19 16:07): a seleção some 4 s depois de cada mudança**
- Visto: Filtros → Sépia → "Zerar ajustes": a imagem perdeu as alças e o painel dela sumiu. O "Zerar" não é a causa.
- Causa: `main.ts` (`editor.onChange`) agenda o `saveDraft` 4 s depois de cada mudança; o `saveDraft` chama
  `editor.thumbnail()` → `Editor.renderPage`, que começa com `canvas.discardActiveObject()`. O descarte dispara
  `selection:cleared` → `leaveCrop()` (sai do modo de recorte) + `onSelection(undefined)` (o painel some). Então, em
  qualquer edição, a seleção cai 4 s depois, e **o modo de recorte também é encerrado** se uma alça foi arrastada.
- O descarte não é preciso para o raster: o Fabric 7 `toCanvasElement` liga `skipControlsDrawing` (sem alças), e
  objetos numa `ActiveSelection` são desenhados com a matriz do grupo, igual à tela.
- Task: tirar o `discardActiveObject()` do `renderPage` e deixá-lo só no `exportRaster` (exportar é ação do usuário e
  fecha a folha). Prova: no moto, mudar um filtro e esperar 6 s → a imagem continua selecionada.
- **Resultado defeito 5**: feito como planejado; vitest 33/33, bundle regerado, instalado. No moto (16:12): Filtros →
  Sépia → 7 s → a imagem continua selecionada e o painel dela fica.

**Visto no moto (2026-10-19 16:04–16:20; adb sem fio `192.168.18.112:43717`, mesmo serial `ZY32LMNN9B`)**
- O app chama-se **"Foto de Produto"** na gaveta (o dono procurou "Product Photo"). Com o app fechado (ex. depois do
  `installDebug`), o launcher da Motorola fica no `CustomizationPanelLauncher`: abrir o app com
  `monkey -p com.productphoto.offline -c android.intent.category.LAUNCHER 1` e conferir o foco.
- O rascunho "Sem nome" de 22:54 (adaptador) **não existe mais**: no lugar, um "Sem nome" (controle de videogame sobre um
  retângulo azul, com Brilho −0,08 / Contraste 0,14 / Saturação 0,44) gravado às 01:04 de 19/10, mais um "Mockup"
  01:05 e um "Promoção" 14:37, criados pelo dono. Os testes usaram o "Sem nome" com o OK do dono, e tudo foi desfeito
  (Sépia por ↶; o título de teste excluído).
- **Defeito 4 provado**: Recortar → tocar fora → seleção limpa → selecionar de novo → alças normais → "Recortar" abre o
  modo de novo. O desfazer ficou cinza (nada mudou).
- Exportar: PNG sem o slider; JPG mostra "Qualidade JPG 0.92".
- Filtros: "Nenhum" marcado na abertura; Sépia passa a marcada; "Zerar ajustes" põe os 4 sliders em 0 e mantém o Sépia.
- Curva: título → Curva 89 → Tamanho 156→46→110 → fonte Montserrat→Pacifico: o arco se refaz a cada mudança, sobre o
  texto inteiro, e a caixa cobre o arco.
- Brand kit: digitar no Slogan → Voltar → "Sair sem salvar?"; "Continuar editando" mantém o texto; "Descartar" sai e o
  kit continua vazio; Voltar sem alterações sai direto. Seletor com prévia; as fontes variáveis abriam no peso 100
  (Montserrat e Raleway quase invisíveis): `Typeface.Builder(...).setFontVariationSettings("'wght' 400")`, revisto no moto.
- **Task 2 do HANDOFF §32 (produto que some no branco) não rodou**: a foto do adaptador não está mais em rascunho nenhum,
  e trazê-la de volta exige a galeria do dono.

## 30. Renomear rascunho (pedido do dono, 2026-10-19; análise na sessão 25, implementação na próxima)
**Pedido**: trocar o "Sem nome" por um nome e salvar. Hoje **não existe** renomear em lugar nenhum. O nome nasce na
criação (tamanho do "Novo design" em `HomeScreen.kt:92`, nome do template, "Sem nome" para imagem/galeria) e nunca muda.

**Símbolos abertos**
- `editor-web/src/editor.ts`: `Editor.name` é um campo público (`name = 'Sem nome'`, l. 58); `load` faz
  `this.name = doc.name`; `toDocument()` grava `createDocument(this.name, …)`, então o nome vai no JSON (`"name"`) de
  cada snapshot e de cada rascunho. `restore` (desfazer) **não** relê o `doc.name`: desfazer não volta o nome.
- `main.ts::updateTopbar`: o título é `h('span', { class: 'title' }, editor.name)`, sem toque. "Salvar" chama
  `saveDraft()` + toast "Rascunho salvo". `saveDraft` **sai sem gravar se `!dirty`** (precisa pôr `dirty = true` antes).
  `editor.onChange` (no `main.ts`) põe `dirty`, refaz o topo e agenda o rascunho em 4 s. `showExport` usa `editor.name`
  no nome do arquivo (o nome novo passa a valer na exportação sem mudança). `openSheet`/`confirmSheet` em `dom.ts` são
  os modelos de folha; não há helper de campo de texto (fazer com `h('input', …)` dentro de `openSheet`).
- Ponte: `EditorSession.saveDraft` (`editor/.../EditorSession.kt:168`) grava `document.toString()` com
  `drafts.save(id, …, thumb)`; o nome não é parâmetro separado (o `name` do `SaveDraftPayload` é ignorado no Kotlin).
- `data/.../Drafts.kt::FileDraftRepository`: `list()` lê o nome do JSON (`header`, "Sem nome" se faltar);
  `save(id, document, thumbnail)` com `thumbnail = null` **mantém** a miniatura antiga e atualiza o `lastModified`
  (o rascunho renomeado sobe para o topo da lista). Não há `rename`. Testes em `data/src/test/.../FileDraftRepositoryTest.kt`.
- `app/.../HomeScreen.kt::DraftsScreen`: linha com miniatura, nome, tamanho·data e "Excluir" (diálogo de confirmação).

**Tasks**
1. Editor: tocar no título abre uma folha "Nome do design" com `<input>` preenchido (selecionado), "Cancelar" e "Salvar".
   Ao salvar: nome aparado; vazio → mantém o anterior; `editor.name = novo`; `dirty = true`; `updateTopbar()`;
   `await saveDraft()`; toast "Rascunho salvo". Não entra no desfazer (o `restore` já ignora o nome). CSS: o
   `#topbar .title` vira botão/realce de toque (manter elipse). Prova: `tsc`, vitest (sem teste novo: depende de DOM) e no
   moto: renomear → voltar → a lista mostra o nome novo; exportar usa o nome no arquivo.
2. Lista de Rascunhos: "Renomear" ao lado do "Excluir", com `AlertDialog` + `OutlinedTextField`. Precisa de
   `DraftRepository.rename(id, name)`: lê o JSON, troca `"name"` (kotlinx `JsonObject` + `put`), grava pelo mesmo caminho
   do `save` com `thumbnail = null` (mantém a miniatura). Prova: teste JVM em `FileDraftRepositoryTest` (o nome muda no
   `list()`, a miniatura e o resto do documento ficam iguais, id inexistente → erro) + no moto.
3. Decidir na implementação (registrar aqui): limite de tamanho do nome (sugestão: 60 caracteres).

**Decisões (sessão 26, antes de editar)**: limite **60** caracteres nos dois lados (`maxlength` no `<input>` + `slice`;
`MAX_DRAFT_NAME` em `Drafts.kt`, usado pelo campo da lista). `rename` apara e corta em 60; nome vazio → mantém (UI
desabilita "Salvar"; o repositório lança `IllegalArgumentException` se chegar vazio); id inexistente → `IllegalArgumentException`
(mesma família do id inválido). Conferido: `DraftRepository` só tem uma implementação (`FileDraftRepository`), sem fakes
nos testes; o `body` tem `user-select: none`, mas campo editável continua selecionável (o `textarea` da IA já usa).

**Feito (sessão 26)**:
- Task 1: `main.ts::updateTopbar` — o título virou `<button class="title">` que chama `showRename` (folha "Nome do
  design", `<input class="name">` com `maxlength` 60, selecionado; Enter ou "Salvar" grava; vazio ou igual → só fecha).
  Toast "Rascunho salvo" só se o `saveDraft` gravou (`!dirty`); se falhou, o próprio `saveDraft` já avisou.
  `styles.css`: `#topbar button.title` sem moldura, sublinhado pontilhado como dica; `input.name`.
- Task 2: `Drafts.kt` — `MAX_DRAFT_NAME = 60`, `DraftRepository.rename` (`JsonObject(o + ("name" to …))` → `save(id, …, null)`).
  `HomeScreen.kt::DraftsScreen` — "Renomear" antes do "Excluir"; `AlertDialog` "Nome do design" com `OutlinedTextField`
  (texto selecionado, foco automático, corta em 60, "Salvar" desabilitado se vazio).
- Provas: `tsc` limpo, vitest 33/33, bundle regerado; `FileDraftRepositoryTest` 5/5 (2 novos: nome muda e o resto do
  JSON fica igual, miniatura mantida, sobe na lista, corte em 60; id inexistente/inválido e nome vazio → IAE, nada
  gravado); `:app:testDebugUnitTest`, `:app:assembleDebug`, `:app:installDebug` (moto, 16:59) verdes.
- **Visto no moto (17:06–17:25)**: título com reticências + sublinhado; folha acima do teclado com o nome selecionado;
  "Teste renomear 26" → toast "Rascunho salvo" → a lista mostra o nome no topo, JSON no aparelho com o nome novo
  (`run-as … files/drafts`). Pela lista (o dono tocou): "Teste lista 26" → JSON regravado 17:10:27, `.jpg` intacto
  (17:08:25); reabrir mostra o nome novo no editor. Exportar → "Salvo em Pictures/ProductPhoto/Teste_lista_26_20261019_172442.png"
  (27 KB no disco); exportar não regrava o rascunho. **§30 fechada.**
- Hipótese descartada: a 1ª exportação "não gravou" (nada em `Pictures/ProductPhoto`) — coincidiu com o dono mexendo no
  celular (um "voltar" que não foi meu); repetida sem interferência, gravou. Não é defeito.
- Lição de teste: o guarda de foco não basta quando o dono também está no aparelho — conferir a **tela** (dump) antes de
  cada toque; um toque meu caiu na linha "Evento" da lista (só abriu; o arquivo não foi regravado).
- Fora do escopo (registro, não feito): o toast longo ("Salvo em Pictures/…png") passa da borda direita do balão
  (`#toast` sem `overflow-wrap: anywhere`). Ficou no aparelho o rascunho de teste "Teste lista 26" e o PNG exportado —
  apagar só com o OK do dono.

## 31. Pendências que não dependem do dono (análise na sessão 25, 2026-10-19; implementação depois da sessão 26)
**Atenção**: a sessão 26 está implementando a §30 (renomear) e mexe em `editor-web/src/main.ts` e `styles.css`
(`showRename`, `#topbar button.title`). As tasks 3 e 4 abaixo tocam os mesmos arquivos: começar só depois de a §30
estar fechada (ver o HANDOFF mais recente) e reabrir as funções antes de editar.

**Task 1. Ver o "Remover" pela tela Modelos** (nunca testado: §28 B).
- Símbolos: `ModelsScreen.kt` → diálogo "Remover <id>?" → `AppGraph.deleteModel(id)` (l. 169): `models.delete(id)`
  (`LocalModelManager.delete`: cancela o download e `deleteRecursively` em `files/models/<id>`), `invalidate` das cadeias
  de recorte e de texto, e apaga `cache/litertlm/<id>/`. Modelos empacotados (`bundledAsset`) mostram "Incluído no app"
  e não têm botão.
- No moto (2026-10-19 16:3x, `run-as … du -sh`): `files/models/gemma-4-e2b-it` 2,4 GB, `qwen3-0.6b-int4` 329 MB,
  `migan-512-places2` 27 MB, `realesr-general-x4v3` 4,7 MB, `u2netp` 4,3 MB; `cache/litertlm/gemma-4-e2b-it` 753 MB.
- Plano: testar com o **Qwen** (329 MB, o mais barato de baixar de novo; o Gemma tem 2,4 GB + 56 s de recompilação).
  Antes, avisar o dono numa linha (o modelo é dele) e conferir que a cadeia de texto não depende só do Qwen
  (`provider_config.json`). Prova: Remover → `files/models/qwen3-0.6b-int4` e `cache/litertlm/qwen3-0.6b-int4` somem;
  o cartão volta a "Baixar (329 MB)"; o "Texto com IA" cai no próximo da cadeia. Depois **baixar o Qwen de novo** pelo
  mesmo cartão e conferir "Pronto no aparelho".

**Task 2. "Espaço usado" na tela Modelos.**
- Hoje só aparece o tamanho de catálogo (`megabytes(e.sizeBytes)`), também no diálogo "Libera …", que para o Gemma
  diz 2,4 GB, mas libera 2,4 GB + 753 MB de cache.
- `LocalModelManager.root` e `dir(entry)` são privados (`File(filesDir, "models")/<id>`). Proposta: `ModelManager.
  diskBytes(modelId): Long` (soma recursiva de `dir(entry)`, 0 se não existe) com teste em `LocalModelManagerTest`; no
  `AppGraph`, `modelDiskBytes(id) = models.diskBytes(id) + tamanho de LiteRtLmFactory.cacheDirFor(cacheDir, id)`.
  Na tela: no estado `Ready`, "Ocupa X MB" (arquivo + cache); no diálogo, "Libera X MB" com o mesmo número; no topo da
  lista, "Modelos no aparelho: X GB". Calcular no IO (`produceState`), recalcular quando `states` mudar.
- Prova: teste JVM do `diskBytes` (pasta temporária com arquivos de tamanho conhecido; id fora do catálogo → 0) e, no moto,
  os números batem com o `du` acima (Gemma ≈ 3,1 GB).

**Task 3. Filtros: sliders alinhados.**
- `main.ts::showFilters` monta 4 `slider(...)` soltos; `dom.ts::slider` devolve `label.slider` com
  `<span>rótulo</span><input><span class=val>`; no CSS, `label.slider` é flex e o rótulo tem a largura do texto
  ("Brilho" × "Saturação"), então as trilhas começam em x diferentes (visto no moto, capturas da sessão 25).
- Proposta: envolver os 4 numa `div.sliders` e no CSS `.sliders label.slider > span:first-child { flex: 0 0 6.5em; }`.
  Só na folha de Filtros (as outras linhas rolam na horizontal e não precisam). Prova: no moto, as 4 trilhas começam na
  mesma coluna.

**Task 4. Exportar: "Resolução" escondida com SVG.**
- `main.ts::showExport`: o `select('Resolução', …)` aparece sempre; o SVG ignora `scale` (`editor.exportSvg()`).
  Mesmo padrão do `qualityRow` (§29): guardar o elemento, `hidden = format === 'svg'` no `onChange` do formato
  (começa visível, porque o padrão é PNG). Prova: no moto, PNG e JPG mostram a Resolução; SVG não.

Fecho: `tsc`, vitest, `npm run build`, `:core:models:test…`/`:app:testDebugUnitTest`, `:app:installDebug` e as provas
no moto, conferindo o foco a cada toque.

**Sessão 27 (2026-10-19), antes de editar**
- §30 fechada no moto: título do editor → "Teste renomear 26" (toast "Rascunho salvo"); a lista mostra o nome no
  topo; "Renomear" da lista → "Teste lista 26" (texto selecionado, digitar substitui, sobe para o topo). Exportar:
  `showExport` calcula `name` de `editor.name` ao abrir a folha (não salvei na galeria do dono; prova pelo código).
- Cuidado no moto (depois se viu que a sessão 26 tocava no moto ao mesmo tempo, HANDOFF §36): um toque caiu
  na linha "Evento" (abriu o rascunho do dono; voltei sem mexer, não foi regravado). Capturar e conferir a tela antes de
  cada toque, com espera ≥ 3 s depois de abrir diálogo. Com diálogo aberto o `mCurrentFocus` continua `MainActivity`.
- Símbolos abertos: `ModelManager` (interface, l. 67) só tem uma implementação (`LocalModelManager`; o teste usa a real
  com `FakeScheduler`). `dir(entry) = File(root, entry.id)`; modelos empacotados também ficam em `root/<id>` depois do
  `ensureReady` (u2netp 4,3 MB). `AppGraph.deleteModel` apaga `LiteRtLmFactory.cacheDirFor(context.cacheDir, id)`.
  `ModelsScreen` lê `graph.models.states()`; `megabytes()` arredonda MB. `ON_DEVICE_TEXT_CHAIN` = Nano → Gemma → Qwen
  (o Qwen é o último: removê-lo não muda quem responde se o Gemma estiver pronto).
  `dom.ts::select` devolve `label.select`; `[hidden]{display:none!important}` já existe no CSS. `dom.ts::slider`
  devolve `label.slider > span, input, span.val`.
- Plano: (2) `ModelManager.diskBytes(id)` (soma `walkTopDown` dos arquivos de `dir(entry)`; id fora do catálogo → 0) +
  teste; `AppGraph.modelDiskBytes(id)` = isso + cache LiteRT-LM; `ModelsScreen` com `produceState(states)` no IO:
  total no topo, "Ocupa X" no Ready e no empacotado, "Libera X" no diálogo. (3) `div.sliders` + CSS de largura fixa do
  rótulo. (4) guardar o `select('Resolução')` e `hidden = format === 'svg'`.

**Feito (sessão 27)**
- Task 1: no moto, "Remover" do Qwen → `files/models/qwen3-0.6b-int4` sumiu (não havia `cache/litertlm/qwen…`), cartão
  "Baixar (329 MB)"; baixado de novo pelo cartão → `.verified-03e7…` + 336 932 KiB, "Pronto no aparelho · ocupa 329 MB".
  A cadeia salva é Nano → Gemma → Qwen: com o Gemma pronto, o Qwen não responde nunca, então não há "queda" a observar.
- Task 2: `ModelManager.diskBytes` (`LocalModelManager`: `walkTopDown` dos arquivos de `dir(entry)`, 0 fora do
  catálogo); `AppGraph.modelDiskBytes` (+ cache LiteRT-LM); `ModelsScreen`: `produceState(states)` no IO, linha
  "Modelos no aparelho: X", "ocupa X" no Ready e no empacotado, "Libera X" no diálogo (`diskSize`: MB até 1 GB, depois
  "3,1 GB"). No moto: total 3,5 GB, Gemma 3,1 GB, u2netp 4 / migan 27 / realesr 5 MB — batem com o `du`.
- Task 3: `showFilters` com `div.sliders`; CSS `.sliders label.slider > span:first-child { flex: 0 0 6.5em; }`. No moto
  as 4 trilhas começam na mesma coluna.
- Task 4: `showExport` guarda `scaleRow` e faz `hidden = format === 'svg'`. No moto: PNG → Resolução; JPG → Resolução +
  Qualidade; SVG → só Formato.
- Provas: `tsc` limpo, vitest 33/33, bundle regerado; `LocalModelManagerTest` 8/8 (novo: `diskBytes sums every file…`);
  `:app:testDebugUnitTest`, `:app:assembleDebug` verdes; `adb install -r` no moto. Rascunhos usados para olhar (16:15
  "Sem nome", "Evento") não foram regravados (mtime conferido). Fica o rascunho de teste "Teste lista 26" (da §30).

**Sessão 27, extra (toast que transborda; achado da §30)**
- Correção do registro da §30: o "Renomear" pela lista ("Teste lista 26", 17:10) e o toque no "Evento" foram desta
  sessão 27, não do dono; as sessões 26 e 27 estavam no moto ao mesmo tempo.
- `dom.ts::toast` só põe `textContent` + `.show`. `styles.css #toast`: `position: fixed; left: 50%;
  transform: translateX(-50%)`, `max-width: calc(100% - 32px)`. Com `left: 50%` a largura automática do balão é
  limitada pelo espaço até a borda direita (metade da tela), e o caminho "Pictures/ProductPhoto/…png" não tem ponto de
  quebra, então passa da borda.
- Plano: `left: 16px; right: 16px; width: fit-content; margin: 0 auto` (centra sem `translateX`; o `transform` fica só
  com o `translateY` da animação) + `overflow-wrap: anywhere`. Prova: no moto, um toast longo quebra dentro do balão; um
  curto continua centrado e estreito.
- **Feito**: `styles.css #toast` como no plano; `#toast.show` só com `translateY(0)`. `tsc` limpo, vitest 33/33, bundle
  regerado, `:app:assembleDebug`, `adb install -r` no moto. Prova no moto (17:37, rascunho de teste aberto, toast
  disparado pelo DevTools do WebView, só DOM: `scratchpad/scripts/toast.mjs`): o texto "Salvo em Pictures/…_172442.png"
  quebra em 3 linhas dentro do balão (16–418 px numa tela de 433 px; `scrollWidth` = `clientWidth`); "Rascunho salvo"
  fica estreito e centrado (centro em 216,9 px; meio da tela 216,5 px). O rascunho não foi regravado.
