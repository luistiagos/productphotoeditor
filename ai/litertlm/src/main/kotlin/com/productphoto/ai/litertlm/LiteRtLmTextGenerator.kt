package com.productphoto.ai.litertlm

import com.google.ai.edge.litertlm.Backend
import com.google.ai.edge.litertlm.Content
import com.google.ai.edge.litertlm.Contents
import com.google.ai.edge.litertlm.Conversation
import com.google.ai.edge.litertlm.ConversationConfig
import com.google.ai.edge.litertlm.Engine
import com.google.ai.edge.litertlm.EngineConfig
import com.google.ai.edge.litertlm.Message
import com.google.ai.edge.litertlm.ResponseFormat
import com.google.ai.edge.litertlm.SamplerConfig
import com.google.ai.edge.litertlm.ThinkingConfig
import com.productphoto.ai.api.AiError
import com.productphoto.ai.api.Capability
import com.productphoto.ai.api.ProviderContext
import com.productphoto.ai.api.ProviderFactory
import com.productphoto.ai.api.Requirement
import com.productphoto.ai.api.SettingField
import com.productphoto.ai.api.StructuredText
import com.productphoto.ai.api.TextGenerator
import com.productphoto.ai.api.TextRequest
import com.productphoto.ai.api.service
import com.productphoto.models.ModelManager
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.awaitCancellation
import kotlinx.coroutines.cancel
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.runInterruptible
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.contentOrNull
import java.io.File
import java.util.concurrent.atomic.AtomicBoolean
import kotlin.random.Random

/**
 * LLM local por LiteRT-LM (§18.2/§18.5). O motor carrega o `.litertlm` na 1ª chamada e é fechado
 * depois de [idleMs] sem uso, porque segura 1–3 GB. Uma conversa nova por pedido, uma por vez.
 */
class LiteRtLmTextGenerator(
    private val modelId: String,
    private val modelFile: File,
    private val cacheDir: File,
    private val gpu: Boolean = false,
    private val idleMs: Long = 120_000,
    /** Decodificação restrita (`ResponseFormat.json`) quando há jsonSchema; medida na §18.7. */
    private val constrainedJson: Boolean = false,
) : TextGenerator, AutoCloseable {
    private val mutex = Mutex()
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private var engine: Engine? = null
    private var idle: Job? = null

    override suspend fun generate(req: TextRequest): String = mutex.withLock {
        idle?.cancel()
        try {
            val eng = engine ?: runInterruptible(Dispatchers.IO) { createEngine() }.also { engine = it }
            send(eng, req)
        } finally {
            idle = scope.launch {
                delay(idleMs)
                mutex.withLock { releaseEngine() }
            }
        }
    }

    private suspend fun send(eng: Engine, req: TextRequest): String {
        val format = req.jsonSchema?.takeIf { constrainedJson }?.let { ResponseFormat.json(it) }
        // a conversa aloca sessão e KV cache no nativo: falha aqui é recurso, não saída ruim (§28 A)
        val conv = nativeSetup { eng.createConversation(conversationConfig(req, format != null)) }
        try {
            val msg = sendCancellable(conv, req.prompt, format)
            return cleanOutput(msg).ifEmpty { throw AiError.InvalidOutput("LiteRT-LM: resposta vazia") }
        } finally {
            conv.close()
        }
    }

    /** sendMessage é bloqueante: o cancelamento da coroutine vira `cancelProcess()` no nativo. */
    private suspend fun sendCancellable(conv: Conversation, prompt: String, format: ResponseFormat?): Message = coroutineScope {
        val finished = AtomicBoolean(false)
        val watcher = launch {
            try {
                awaitCancellation()
            } finally {
                if (!finished.get()) runCatching { conv.cancelProcess() }
            }
        }
        try {
            runInterruptible(Dispatchers.IO) {
                conv.sendMessage(prompt, THINKING_OFF_CONTEXT, null, null, null, null, ThinkingConfig(false), format)
            }
        } catch (e: CancellationException) {
            throw e
        } catch (e: RuntimeException) {
            throw AiError.InvalidOutput("LiteRT-LM: ${e.message}")
        } finally {
            finished.set(true)
            watcher.cancel()
        }
    }

    private fun conversationConfig(req: TextRequest, constrained: Boolean) = ConversationConfig(
        systemInstruction = req.system?.let { Contents.of(it) },
        samplerConfig = SamplerConfig(topK = 40, topP = 0.95, temperature = req.temperature.toDouble(), seed = Random.nextInt(1, Int.MAX_VALUE)),
        extraContext = THINKING_OFF_CONTEXT,
        maxOutputToken = req.maxTokens,
        thinkingConfig = ThinkingConfig(false),
        enableResponseFormat = constrained,
    )

    private fun createEngine(): Engine {
        cacheDir.mkdirs()
        val config = EngineConfig(
            modelPath = modelFile.absolutePath,
            backend = if (gpu) Backend.GPU() else Backend.CPU(),
            maxNumTokens = MAX_TOKENS,
            cacheDir = cacheDir.absolutePath,
        )
        val e = nativeSetup { Engine(config) }
        try {
            nativeSetup { e.initialize() }
        } catch (t: Throwable) {
            runCatching { e.close() }
            throw t
        }
        return e
    }

    /**
     * Falha do nativo ao montar motor ou conversa (backend/OpenCL, memória, lib ausente ou de outra ABI) vira
     * `Unavailable`, para a cadeia cair no próximo provedor (§21.4 item 2, §28 A).
     */
    private inline fun <T> nativeSetup(block: () -> T): T = try {
        block()
    } catch (t: Throwable) {
        if (t is RuntimeException || t is OutOfMemoryError || t is LinkageError) {
            throw AiError.Unavailable(listOf(Requirement.Model(modelId)), t)
        }
        throw t
    }

    private fun releaseEngine() {
        engine?.let { runCatching { it.close() } }
        engine = null
    }

    override fun close() {
        // espera uma geração em andamento terminar antes de liberar o nativo
        CoroutineScope(Dispatchers.IO).launch { mutex.withLock { releaseEngine() } }
        scope.cancel()
    }

    companion object {
        /** Contexto máximo (entrada + saída); menor = menos KV cache na RAM. */
        const val MAX_TOKENS = 2048
        /** Variável do template do Qwen3 (§18.2); os outros modelos a ignoram. */
        private val THINKING_OFF_CONTEXT = mapOf<String, Any>("enable_thinking" to false)

        /** Só o texto da resposta (o raciocínio vai em `channels`), sem `<think>` residual. */
        fun cleanOutput(msg: Message): String =
            StructuredText.stripThinking(msg.contents.contents.filterIsInstance<Content.Text>().joinToString("") { it.text })
    }
}

/**
 * `litertlm` com settings `modelId` (catálogo) e `backend` (cpu|gpu). minRamMb vem do catálogo,
 * que a factory não enxerga por si: o :app passa a consulta.
 */
class LiteRtLmFactory(private val minRamMb: (String) -> Int) : ProviderFactory<TextGenerator> {
    override val id = ID
    override val capability = Capability.TEXT_GENERATOR
    override val displayName = "LLM no aparelho (LiteRT-LM)"
    override val isLocal = true
    override val settingsSchema = listOf(
        SettingField(MODEL_ID, "Modelo (catálogo)", SettingField.Kind.TEXT, DEFAULT_MODEL),
        SettingField(BACKEND, "Backend (cpu|gpu)", SettingField.Kind.TEXT, "cpu"),
    )

    override fun requirements(settings: JsonObject): List<Requirement> {
        val model = modelId(settings)
        return listOfNotNull(Requirement.Model(model), minRamMb(model).takeIf { it > 0 }?.let { Requirement.MinRamMb(it) })
    }

    override fun create(settings: JsonObject, ctx: ProviderContext): TextGenerator {
        val model = modelId(settings)
        val models = ctx.service<ModelManager>() ?: error("ModelManager not provided")
        val file = models.ensureReady(model) ?: throw AiError.ModelNotDownloaded(model)
        val gpu = (settings[BACKEND] as? JsonPrimitive)?.contentOrNull == "gpu"
        return LiteRtLmTextGenerator(model, file, prepareCacheDir(ctx.androidContext.cacheDir, model), gpu)
    }

    private fun modelId(settings: JsonObject) =
        (settings[MODEL_ID] as? JsonPrimitive)?.contentOrNull?.takeIf { it.isNotBlank() } ?: DEFAULT_MODEL

    companion object {
        const val ID = "litertlm"
        const val MODEL_ID = "modelId"
        const val BACKEND = "backend"
        const val DEFAULT_MODEL = "gemma-4-e2b-it"

        /**
         * Cache compilado do LiteRT-LM de um modelo (até ~1,5 GB; §21.4): no cacheDir, que o sistema pode limpar, numa
         * pasta por modelo para sair junto com ele (§28 B).
         */
        fun cacheDirFor(appCacheDir: File, modelId: String) = File(File(appCacheDir, "litertlm"), modelId)

        /** [cacheDirFor], apagando antes os arquivos soltos do layout antigo (uma pasta para todos os modelos). */
        fun prepareCacheDir(appCacheDir: File, modelId: String): File {
            File(appCacheDir, "litertlm").listFiles()?.filter { it.isFile }?.forEach { it.delete() }
            return cacheDirFor(appCacheDir, modelId)
        }
    }
}
