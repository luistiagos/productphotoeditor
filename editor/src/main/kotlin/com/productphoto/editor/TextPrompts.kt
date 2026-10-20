package com.productphoto.editor

import com.productphoto.ai.api.TextRequest

/**
 * Pedidos de texto IA do editor (§9, §18.5): reescrever um texto do canvas e gerar título/subtítulo/
 * chamada de pôster. Escritos do zero; o JSON é validado pelo StructuredText.
 */
object TextPrompts {
    const val MAX_INPUT = 2000

    private const val COPYWRITER = "You are a copywriter for small-business marketing images (posters, social media posts, " +
        "product photos). Keep the language of the user's text (Brazilian Portuguese if unclear). " +
        "Texts must be short enough to fit on an image. Do not add hashtags, emojis or quotes unless the original has them."

    /** style → instrução. A ordem é a do menu no editor web. */
    val STYLES = linkedMapOf(
        "rewrite" to "Rewrite it with different words, keeping the meaning and roughly the same length.",
        "shorter" to "Make it noticeably shorter and punchier.",
        "persuasive" to "Make it more persuasive, ending with a clear call to action.",
        "formal" to "Make it more formal and professional.",
        "fun" to "Make it more casual, friendly and fun.",
        "fix" to "Only fix spelling, grammar and punctuation; change nothing else.",
    )

    fun rewrite(text: String, style: String, count: Int): TextRequest {
        val instruction = STYLES[style] ?: throw IllegalArgumentException("estilo desconhecido: $style")
        require(text.isNotBlank()) { "texto vazio" }
        require(text.length <= MAX_INPUT) { "texto longo demais (máx. $MAX_INPUT caracteres)" }
        val n = if (style == "fix") 1 else count.coerceIn(1, 5)
        return TextRequest(
            system = COPYWRITER,
            prompt = "$instruction\nGive $n alternative version(s) in \"variants\".\n\nOriginal text:\n\"\"\"\n${text.trim()}\n\"\"\"",
            jsonSchema = variantsSchema(),
            maxTokens = 512,
            temperature = if (style == "fix") 0.1f else 0.8f,
        )
    }

    fun copy(brief: String): TextRequest {
        require(brief.isNotBlank()) { "descreva o produto ou a promoção" }
        require(brief.length <= MAX_INPUT) { "descrição longa demais (máx. $MAX_INPUT caracteres)" }
        return TextRequest(
            system = COPYWRITER,
            prompt = "Write the texts of a poster for this brief. \"title\": at most 6 words; \"subtitle\": at most 16 words; " +
                "\"cta\": a call to action of at most 4 words.\n\nBrief:\n\"\"\"\n${brief.trim()}\n\"\"\"",
            jsonSchema = COPY_SCHEMA,
            maxTokens = 256,
            temperature = 0.8f,
        )
    }

    private fun variantsSchema() =
        """{"type":"object","required":["variants"],"properties":{"variants":{"type":"array","minItems":1,""" +
            """"items":{"type":"string","minLength":1}}}}"""

    const val COPY_SCHEMA =
        """{"type":"object","required":["title","subtitle","cta"],"properties":{"title":{"type":"string","minLength":1},""" +
            """"subtitle":{"type":"string","minLength":1},"cta":{"type":"string","minLength":1}}}"""
}
