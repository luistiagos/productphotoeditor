package com.productphoto.ai.api

import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlin.coroutines.cancellation.CancellationException

data class ServedBy(val providerId: String, val displayName: String, val isLocal: Boolean)

/**
 * Resolve a cadeia configurada de uma capability e chama o primeiro provedor disponível (§4.4).
 * Pula provedores com requisitos não atendidos; em erro "fallbackable" tenta o próximo; os demais
 * erros sobem para a UI. Instâncias ficam em cache por entrada da cadeia até [invalidate].
 */
class FallbackChain<T : Any>(
    private val capability: Capability,
    private val type: Class<T>,
    private val registry: ProviderRegistry,
    private val config: suspend () -> ProviderConfig,
    private val checker: RequirementChecker,
    private val ctx: ProviderContext,
) {
    private val instances = HashMap<ChainEntry, T>()
    private val _lastServedBy = MutableStateFlow<ServedBy?>(null)
    val lastServedBy: StateFlow<ServedBy?> = _lastServedBy.asStateFlow()

    /** Descarta as instâncias; as `AutoCloseable` (ex. motor do LiteRT-LM, §18.5) são fechadas. */
    fun invalidate() {
        val old = synchronized(instances) { instances.values.toList().also { instances.clear() } }
        old.forEach { (it as? AutoCloseable)?.let { c -> runCatching { c.close() } } }
    }

    suspend fun <R> run(block: suspend (T) -> R): R {
        val missing = mutableListOf<Requirement>()
        var lastError: AiError? = null
        for (entry in config().chainFor(capability)) {
            val factory = registry.find(entry.provider) ?: continue
            if (factory.capability != capability) continue
            val unmet = factory.requirements(entry.settings).filterNot { checker.isMet(it) }
            if (unmet.isNotEmpty()) {
                missing += unmet
                continue
            }
            try {
                val result = block(instance(entry, factory))
                _lastServedBy.value = ServedBy(factory.id, factory.displayName, factory.isLocal)
                return result
            } catch (e: CancellationException) {
                throw e
            } catch (e: AiError) {
                if (!e.isFallbackable) throw e
                if (e is AiError.Unavailable) missing += e.missing
                lastError = e
            }
        }
        // Nenhum atendeu: devolve o último erro de rede/modelo, ou Unavailable com tudo o que faltou.
        val last = lastError
        if (last != null && last !is AiError.Unavailable) throw last
        throw AiError.Unavailable(missing.distinct(), last)
    }

    private fun instance(entry: ChainEntry, factory: ProviderFactory<*>): T = synchronized(instances) {
        instances.getOrPut(entry) { type.cast(factory.create(entry.settings, ctx))!! }
    }
}

class ChainedBackgroundRemover(val chain: FallbackChain<BackgroundRemover>) : BackgroundRemover {
    override suspend fun removeBackground(image: RgbaImage, progress: ProgressSink?): Mask =
        chain.run { it.removeBackground(image, progress) }
}

class ChainedInpainter(val chain: FallbackChain<Inpainter>) : Inpainter {
    override suspend fun inpaint(image: RgbaImage, mask: Mask, progress: ProgressSink?): RgbaImage =
        chain.run { it.inpaint(image, mask, progress) }
}

class ChainedUpscaler(val chain: FallbackChain<Upscaler>) : Upscaler {
    override suspend fun upscale(image: RgbaImage, factor: Int, progress: ProgressSink?): RgbaImage =
        chain.run { it.upscale(image, factor, progress) }
}

class ChainedTextDetector(val chain: FallbackChain<TextDetector>) : TextDetector {
    override suspend fun detect(image: RgbaImage): List<TextBlock> = chain.run { it.detect(image) }
}

class ChainedTranslator(val chain: FallbackChain<Translator>) : Translator {
    override suspend fun translate(text: String, from: String?, to: String): String =
        chain.run { it.translate(text, from, to) }
}

class ChainedVectorizer(val chain: FallbackChain<Vectorizer>) : Vectorizer {
    override suspend fun toSvg(image: RgbaImage, options: VectorizeOptions): String =
        chain.run { it.toSvg(image, options) }
}
