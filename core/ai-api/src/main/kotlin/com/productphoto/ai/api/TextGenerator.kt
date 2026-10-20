package com.productphoto.ai.api

import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.flow

/**
 * Pedido de texto (§3). jsonSchema != null pede JSON estruturado; a validação e o retry ficam em
 * [StructuredText], comum a todos os provedores (§18.5).
 */
data class TextRequest(
    val system: String?,
    val prompt: String,
    val jsonSchema: String? = null,
    val maxTokens: Int = 512,
    val temperature: Float = 0.7f,
)

interface TextGenerator {
    suspend fun generate(req: TextRequest): String

    /** Padrão: emite a resposta inteira de uma vez. */
    fun stream(req: TextRequest): Flow<String> = flow { emit(generate(req)) }
}

class ChainedTextGenerator(val chain: FallbackChain<TextGenerator>) : TextGenerator {
    override suspend fun generate(req: TextRequest): String = chain.run { it.generate(req) }
}
