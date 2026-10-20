package com.productphoto.app

import android.app.ActivityManager
import android.content.Context
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import com.productphoto.ai.api.BackgroundRemover
import com.productphoto.ai.api.Capability
import com.productphoto.ai.api.CapabilityConfig
import com.productphoto.ai.api.ChainEntry
import com.productphoto.ai.api.ChainedBackgroundRemover
import com.productphoto.ai.api.ChainedImageGenerator
import com.productphoto.ai.api.ChainedInpainter
import com.productphoto.ai.api.ChainedTextDetector
import com.productphoto.ai.api.ChainedTranslator
import com.productphoto.ai.api.ChainedTextGenerator
import com.productphoto.ai.api.ChainedUpscaler
import com.productphoto.ai.api.ChainedVectorizer
import com.productphoto.ai.api.ImageGenerator
import com.productphoto.ai.api.TextGenerator
import com.productphoto.ai.litertlm.LiteRtLmFactory
import com.productphoto.ai.mlkit.GeminiNanoFactory
import com.productphoto.ai.remotehttp.OpenAiCompatibleFactory
import com.productphoto.ai.remotehttp.image.A1111ImageFactory
import com.productphoto.ai.remotehttp.image.ComfyUiImageFactory
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import com.productphoto.ai.api.FallbackChain
import com.productphoto.ai.api.Inpainter
import com.productphoto.ai.api.ProviderConfig
import com.productphoto.ai.api.ProviderConfigStore
import com.productphoto.ai.api.ProviderContext
import com.productphoto.ai.api.ProviderRegistry
import com.productphoto.ai.api.Requirement
import com.productphoto.ai.api.RequirementChecker
import com.productphoto.ai.api.TextDetector
import com.productphoto.ai.api.Translator
import com.productphoto.ai.api.Upscaler
import com.productphoto.ai.api.Vectorizer
import com.productphoto.ai.api.advertisedRamMb
import com.productphoto.ai.mlkit.MlKitSubjectFactory
import com.productphoto.ai.mlkit.MlKitTextFactory
import com.productphoto.ai.mlkit.MlKitTranslateFactory
import com.productphoto.ai.onnx.OnnxMiGanFactory
import com.productphoto.ai.onnx.OnnxRealEsrganFactory
import com.productphoto.ai.onnx.OnnxU2netpFactory
import com.productphoto.ai.vtracer.VTracerFactory
import com.productphoto.data.BrandKitRepository
import com.productphoto.data.DraftRepository
import com.productphoto.data.FileBrandKitRepository
import com.productphoto.data.FileDraftRepository
import com.productphoto.editor.EditorAi
import com.productphoto.editor.EditorAssets
import com.productphoto.imaging.LocalSceneComposer
import com.productphoto.imaging.TextRemover
import com.productphoto.models.LocalModelManager
import com.productphoto.models.ModelCatalog
import com.productphoto.models.ModelManager
import com.productphoto.models.ModelState
import com.productphoto.models.WorkDownloadScheduler
import com.productphoto.secrets.FileSecretStore
import com.productphoto.secrets.KeystoreAead
import com.productphoto.secrets.SecretStore
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.File
import kotlin.concurrent.thread

/** DI manual: o único lugar que conhece todos os módulos :ai:* (§1). */
class AppGraph(private val context: Context) {
    val registry = ProviderRegistry().apply {
        register(MlKitSubjectFactory())
        register(OnnxU2netpFactory())
        register(OnnxMiGanFactory())
        register(OnnxRealEsrganFactory())
        register(MlKitTextFactory())
        register(MlKitTranslateFactory())
        register(VTracerFactory())
        register(GeminiNanoFactory())
        register(LiteRtLmFactory { modelId -> models.catalog.find(modelId)?.minRamMb ?: 0 })
        register(OpenAiCompatibleFactory())
        register(A1111ImageFactory())
        register(ComfyUiImageFactory())
    }

    val models: ModelManager = LocalModelManager(
        catalog = context.assets.open("models/models.json").use { ModelCatalog.parse(it.readBytes().decodeToString()) },
        root = File(context.filesDir, "models"),
        openAsset = { context.assets.open(it) },
        scheduler = WorkDownloadScheduler(context),
    ).also { m -> thread(name = "prune-models") { m.pruneOrphans() } }

    val secrets: SecretStore = FileSecretStore(File(context.filesDir, "secrets.bin"), KeystoreAead())

    val configStore: ProviderConfigStore = FileProviderConfigStore(File(context.filesDir, "provider_config.json"))

    private val providerContext = object : ProviderContext {
        override val androidContext: Context = context
        override fun <T : Any> service(type: Class<T>): T? = when (type) {
            ModelManager::class.java -> type.cast(models)
            SecretStore::class.java -> type.cast(secrets)
            else -> null
        }
    }

    private val checker = RequirementChecker { req ->
        when (req) {
            Requirement.PlayServices -> MlKitSubjectFactory.isPlayServicesAvailable(context)
            is Requirement.Model -> models.state(req.modelId) == ModelState.Ready ||
                models.catalog.find(req.modelId)?.bundledAsset != null
            Requirement.Network -> isOnline()
            is Requirement.Secret -> secrets.get(req.key) != null
            // RAM do aparelho, não o heap Java: o ORT aloca fora dele (§16.3); MemTotal → RAM anunciada (§22)
            is Requirement.MinRamMb -> advertisedRamMb(totalRamMb()) >= req.mb
            is Requirement.DeviceFeature -> false
        }
    }

    private fun <T : Any> chain(capability: Capability, type: Class<T>) = FallbackChain(
        capability, type, registry, config = { configStore.load() }, checker = checker, ctx = providerContext,
    )

    val backgroundRemoverChain = chain(Capability.BACKGROUND_REMOVER, BackgroundRemover::class.java)
    val backgroundRemover = ChainedBackgroundRemover(backgroundRemoverChain)
    val inpainter = ChainedInpainter(chain(Capability.INPAINTER, Inpainter::class.java))
    val textDetector = ChainedTextDetector(chain(Capability.TEXT_DETECTOR, TextDetector::class.java))
    val translator = ChainedTranslator(chain(Capability.TRANSLATOR, Translator::class.java))
    val vectorizer = ChainedVectorizer(chain(Capability.VECTORIZER, Vectorizer::class.java))
    val textGenerator = ChainedTextGenerator(chain(Capability.TEXT_GENERATOR, TextGenerator::class.java))
    val imageGenerator = ChainedImageGenerator(chain(Capability.IMAGE_GENERATOR, ImageGenerator::class.java))
    val upscaler = ChainedUpscaler(chain(Capability.UPSCALER, Upscaler::class.java))
    val textRemover = TextRemover(textDetector, inpainter)
    val composer = LocalSceneComposer()
    // mockup local e direto, sem cadeia (§20.4 item 9)
    val mockupRenderer = com.productphoto.imaging.PerspectiveMockupRenderer()
    val mockupLibrary by lazy {
        com.productphoto.feature.mockup.MockupLibrary(
            assets = context.assets,
            localDir = File(context.filesDir, "content/mockups")
        )
    }


    // ---- editor (fase 4) ----
    val editorAssets by lazy { EditorAssets(context) }
    val drafts: DraftRepository = FileDraftRepository(File(context.filesDir, "drafts"))
    val brandKits: BrandKitRepository = FileBrandKitRepository(File(context.filesDir, "brandkit.json"))
    val editorAi by lazy {
        EditorAi(backgroundRemover, inpainter, textDetector, vectorizer, servedBy = { capability ->
            when (capability) {
                "BACKGROUND_REMOVER" -> backgroundRemover.chain
                "INPAINTER" -> inpainter.chain
                "TEXT_GENERATOR" -> textGenerator.chain
                "UPSCALER" -> upscaler.chain
                else -> null
            }?.lastServedBy?.value?.displayName
        }, textGenerator = textGenerator, upscaler = upscaler)
    }

    /** Fontes empacotadas (content/index.json), para o brand kit: família e caminho do arquivo nos assets. */
    val bundledFonts: List<BundledFont> by lazy {
        runCatching {
            val root = kotlinx.serialization.json.Json.parseToJsonElement(
                context.assets.open("content/index.json").use { it.readBytes().decodeToString() },
            ) as kotlinx.serialization.json.JsonObject
            (root["fonts"] as kotlinx.serialization.json.JsonArray).map {
                val o = it as kotlinx.serialization.json.JsonObject
                fun field(k: String) = (o[k] as kotlinx.serialization.json.JsonPrimitive).content
                BundledFont(field("family"), "content/" + field("file"))
            }
        }.getOrDefault(emptyList())
    }

    /** Apaga um modelo baixado (e o cache compilado do LiteRT-LM dele) e descarta instâncias que ainda apontam para ele. */
    fun deleteModel(modelId: String) {
        models.delete(modelId)
        backgroundRemoverChain.invalidate()
        textGenerator.chain.invalidate() // fecha o motor do LiteRT-LM que mapeia o arquivo
        LiteRtLmFactory.cacheDirFor(context.cacheDir, modelId).deleteRecursively()
    }

    /** O que [deleteModel] libera: a pasta do modelo e o cache compilado do LiteRT-LM. Lê o disco (chamar no IO). */
    fun modelDiskBytes(modelId: String): Long =
        models.diskBytes(modelId) +
            LiteRtLmFactory.cacheDirFor(context.cacheDir, modelId).walkTopDown().filter { it.isFile }.sumOf { it.length() }

    /** Grava a cadeia de texto escolhida na tela "Texto com IA" e descarta as instâncias antigas. */
    suspend fun saveTextChain(chain: List<ChainEntry>) {
        configStore.save(configStore.load().withChain(Capability.TEXT_GENERATOR, chain))
        textGenerator.chain.invalidate()
    }

    /** Grava a cadeia de imagem escolhida na tela "Gerar imagem" e descarta as instâncias antigas. */
    suspend fun saveImageChain(chain: List<ChainEntry>) {
        configStore.save(configStore.load().withChain(Capability.IMAGE_GENERATOR, chain))
        imageGenerator.chain.invalidate()
    }

    private fun totalRamMb(): Long {
        val am = context.getSystemService(ActivityManager::class.java) ?: return 0
        return ActivityManager.MemoryInfo().also { am.getMemoryInfo(it) }.totalMem / (1024 * 1024)
    }

    private fun isOnline(): Boolean {
        val cm = context.getSystemService(ConnectivityManager::class.java) ?: return false
        val caps = cm.getNetworkCapabilities(cm.activeNetwork) ?: return false
        return caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
    }

    companion object {
        private fun litertlm(modelId: String) =
            ChainEntry(LiteRtLmFactory.ID, JsonObject(mapOf(LiteRtLmFactory.MODEL_ID to JsonPrimitive(modelId))))

        /** Nano → Gemma 4 E2B → Qwen3-0.6B; cada LiteRT-LM só entra se o modelo estiver baixado (§18.5). */
        val ON_DEVICE_TEXT_CHAIN = listOf(
            ChainEntry("mlkit.gemini-nano"),
            litertlm("gemma-4-e2b-it"),
            litertlm("qwen3-0.6b-int4"),
        )

        /**
         * Cadeias padrão do primeiro uso (§4.4). Imagem vem desligada (§21, offline primeiro): servidor só se o
         * usuário escolher na tela "Gerar imagem", até existir o modelo no aparelho (fase 8).
         */
        /** Provedores que saíram do app; o `FileProviderConfigStore` os tira das cadeias salvas (§25). */
        val RETIRED_PROVIDERS = setOf("onnx.birefnet-lite")

        val DEFAULT_CONFIG = ProviderConfig()
            .withChain(Capability.BACKGROUND_REMOVER, listOf(ChainEntry("mlkit.subject"), ChainEntry("onnx.u2netp")))
            .withChain(Capability.INPAINTER, listOf(ChainEntry("onnx.migan")))
            .withChain(Capability.TEXT_DETECTOR, listOf(ChainEntry("mlkit.text-bundled")))
            .withChain(Capability.TRANSLATOR, listOf(ChainEntry("mlkit.translate")))
            .withChain(Capability.VECTORIZER, listOf(ChainEntry("vtracer")))
            .withChain(Capability.TEXT_GENERATOR, ON_DEVICE_TEXT_CHAIN)
            .withChain(Capability.IMAGE_GENERATOR, emptyList())
            .withChain(Capability.UPSCALER, listOf(ChainEntry(OnnxRealEsrganFactory.ID)))
    }
}

class FileProviderConfigStore(private val file: File) : ProviderConfigStore {
    /**
     * Capabilities ausentes no arquivo (salvo por uma versão anterior) ficam com a cadeia padrão. Provedores retirados
     * saem da cadeia; a que ficar vazia só por isso volta ao padrão (ex. modo BiRefNet salvo → Automático, §25).
     */
    override suspend fun load(): ProviderConfig = withContext(Dispatchers.IO) {
        val saved = (if (file.exists()) runCatching { ProviderConfig.fromJson(file.readText()) }.getOrNull() else null)
            ?: return@withContext AppGraph.DEFAULT_CONFIG
        val kept = saved.capabilities.mapNotNull { (cap, cfg) ->
            val chain = cfg.chain.filterNot { it.provider in AppGraph.RETIRED_PROVIDERS }
            if (chain.isEmpty() && cfg.chain.isNotEmpty()) null else cap to CapabilityConfig(chain)
        }.toMap()
        saved.copy(capabilities = AppGraph.DEFAULT_CONFIG.capabilities + kept)
    }

    override suspend fun save(config: ProviderConfig) = withContext(Dispatchers.IO) {
        val tmp = File(file.parentFile, file.name + ".tmp")
        tmp.writeText(config.toJson())
        if (!tmp.renameTo(file)) { file.delete(); tmp.renameTo(file) }
        Unit
    }
}

/** Fonte empacotada: [assetPath] é relativo à raiz dos assets (ex. "content/fonts/Inter/Inter.ttf"). */
data class BundledFont(val family: String, val assetPath: String)
