package com.productphoto.editor

import com.productphoto.ai.api.StructuredText
import com.productphoto.ai.api.TextGenerator
import com.productphoto.ai.api.TextRequest
import kotlinx.coroutines.test.runTest
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Assert.fail
import org.junit.Test

class TextPromptsTest {
    @Test
    fun `rewrite embeds the text and style, fix asks for one low-temperature variant`() {
        val r = TextPrompts.rewrite("  Promoção de verão  ", "persuasive", 3)
        assertTrue(r.prompt.contains("Promoção de verão\n\"\"\""))
        assertTrue(r.prompt.contains(TextPrompts.STYLES["persuasive"]!!))
        assertTrue(r.prompt.contains("Give 3 alternative"))
        val fix = TextPrompts.rewrite("promocao", "fix", 3)
        assertTrue(fix.prompt.contains("Give 1 alternative"))
        assertEquals(0.1f, fix.temperature)
    }

    @Test
    fun `bad input is IllegalArgumentException (bridge maps to invalid)`() {
        for (call in listOf<() -> Unit>(
            { TextPrompts.rewrite("x", "shout", 3) },
            { TextPrompts.rewrite("   ", "rewrite", 3) },
            { TextPrompts.rewrite("a".repeat(TextPrompts.MAX_INPUT + 1), "rewrite", 3) },
            { TextPrompts.copy("") },
        )) {
            try { call(); fail() } catch (_: IllegalArgumentException) { }
        }
    }

    @Test
    fun `copy schema accepts a complete answer and rejects a missing cta`() = runTest {
        var answers = ArrayDeque(listOf("""{"title":"Pão quentinho","subtitle":"Todo dia às 7h"}""",
            """{"title":"Pão quentinho","subtitle":"Todo dia às 7h","cta":"Peça já"}"""))
        val gen = object : TextGenerator { override suspend fun generate(req: TextRequest) = answers.removeFirst() }
        val out = StructuredText.generate(gen, TextPrompts.copy("padaria artesanal")).jsonObject
        assertEquals("Peça já", out["cta"]!!.jsonPrimitive.content)
        assertTrue(answers.isEmpty())
    }
}
