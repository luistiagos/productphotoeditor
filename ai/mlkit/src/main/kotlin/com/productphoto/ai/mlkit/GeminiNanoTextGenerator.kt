package com.productphoto.ai.mlkit

import com.google.mlkit.genai.common.FeatureStatus
import com.google.mlkit.genai.common.GenAiException
import com.google.mlkit.genai.prompt.Generation
import com.google.mlkit.genai.prompt.GenerativeModel
import com.google.mlkit.genai.prompt.SystemInstruction
import com.google.mlkit.genai.prompt.TextPart
import com.google.mlkit.genai.prompt.generateContentRequest
import com.productphoto.ai.api.AiError
import com.productphoto.ai.api.Capability
import com.productphoto.ai.api.ProviderContext
import com.productphoto.ai.api.ProviderFactory
import com.productphoto.ai.api.Requirement
import com.productphoto.ai.api.StructuredText
import com.productphoto.ai.api.TextGenerator
import com.productphoto.ai.api.TextRequest
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.flow.collect
import kotlinx.coroutines.launch
import kotlinx.serialization.json.JsonObject

/**
 * Gemini Nano pelo ML Kit GenAI Prompt (AICore). Só alguns aparelhos têm (§4.1). Indisponível,
 * baixando, ocupado ou sem cota → AiError.Unavailable, e a cadeia segue para o LiteRT-LM (§18.5).
 */
class GeminiNanoTextGenerator : TextGenerator, AutoCloseable {
    private val model: GenerativeModel by lazy { Generation.getClient() }
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private var download: Job? = null
    private var systemPrompt: Boolean? = null

    override suspend fun generate(req: TextRequest): String {
        when (val status = call { model.checkStatus() }) {
            FeatureStatus.AVAILABLE -> Unit
            FeatureStatus.DOWNLOADABLE -> {
                startDownload()
                throw unavailable("Gemini Nano: modelo sendo baixado pelo AICore")
            }
            FeatureStatus.DOWNLOADING -> throw unavailable("Gemini Nano: modelo sendo baixado pelo AICore")
            else -> throw unavailable("Gemini Nano indisponível neste aparelho (status $status)")
        }
        val useSystem = req.system != null && (systemPrompt ?: call { model.isSystemPromptAvailable() }.also { systemPrompt = it })
        val prompt = if (req.system != null && !useSystem) "${req.system}\n\n${req.prompt}" else req.prompt
        val configure: com.google.mlkit.genai.prompt.GenerateContentRequest.Builder.() -> Unit = {
            temperature = req.temperature.coerceIn(0f, 1f)
            maxOutputTokens = req.maxTokens.coerceIn(1, 4096)
        }
        val request = if (useSystem) {
            generateContentRequest(SystemInstruction(req.system!!), TextPart(prompt), configure)
        } else {
            generateContentRequest(TextPart(prompt), configure)
        }
        val response = call { model.generateContent(request) }
        val text = response.candidates.firstOrNull()?.text
            ?: throw AiError.InvalidOutput("Gemini Nano: resposta sem candidato")
        return StructuredText.stripThinking(text)
    }

    @Synchronized
    private fun startDownload() {
        if (download?.isActive == true) return
        download = scope.launch { model.download().catch { }.collect() }
    }

    override fun close() {
        scope.cancel()
        runCatching { model.close() }
    }

    private suspend fun <T> call(block: suspend () -> T): T = try {
        block()
    } catch (e: CancellationException) {
        throw e
    } catch (e: AiError) {
        throw e
    } catch (e: GenAiException) {
        throw nanoError(e.errorCode, e)
    } catch (e: Exception) {
        // AICore ausente costuma aparecer como exceção genérica do binder/serviço
        throw AiError.Unavailable(listOf(AICORE), e)
    }

    private fun unavailable(detail: String) = AiError.Unavailable(listOf(AICORE), IllegalStateException(detail))

    companion object {
        val AICORE = Requirement.DeviceFeature("aicore")

        /**
         * Código do GenAiException → erro da cadeia. Disponibilidade, cota, ocupado e pedido grande demais
         * caem para o próximo provedor (que pode ter contexto maior); o resto sobe para a UI.
         */
        fun nanoError(code: Int, cause: Throwable): AiError = when (code) {
            GenAiException.ErrorCode.NOT_AVAILABLE,
            GenAiException.ErrorCode.BUSY,
            GenAiException.ErrorCode.AICORE_INCOMPATIBLE,
            GenAiException.ErrorCode.NEEDS_SYSTEM_UPDATE,
            GenAiException.ErrorCode.PER_APP_BATTERY_USE_QUOTA_EXCEEDED,
            GenAiException.ErrorCode.BACKGROUND_USE_BLOCKED,
            GenAiException.ErrorCode.NOT_ENOUGH_DISK_SPACE,
            GenAiException.ErrorCode.NOT_SUPPORTED,
            GenAiException.ErrorCode.REQUEST_TOO_LARGE,
            -> AiError.Unavailable(listOf(AICORE), cause)
            else -> AiError.InvalidOutput("Gemini Nano: ${cause.message ?: "erro $code"}")
        }
    }
}

class GeminiNanoFactory : ProviderFactory<TextGenerator> {
    override val id = "mlkit.gemini-nano"
    override val capability = Capability.TEXT_GENERATOR
    override val displayName = "Gemini Nano (no aparelho)"
    override val isLocal = true
    override fun requirements(settings: JsonObject) = listOf<Requirement>(Requirement.PlayServices)
    override fun create(settings: JsonObject, ctx: ProviderContext): TextGenerator = GeminiNanoTextGenerator()
}
