package com.productphoto.ai.litertlm

import com.google.ai.edge.litertlm.Message
import com.productphoto.ai.api.AiError
import com.productphoto.ai.api.Requirement
import com.productphoto.ai.api.TextRequest
import kotlinx.coroutines.runBlocking
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertThrows
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File
import java.nio.file.Files

class LiteRtLmTest {
    @Test
    fun `cleanOutput keeps only the answer text`() {
        assertEquals("Oferta da semana", LiteRtLmTextGenerator.cleanOutput(Message.model("<think>vou pensar</think>\nOferta da semana ")))
        assertEquals("", LiteRtLmTextGenerator.cleanOutput(Message.model("<think>sem fim")))
    }

    /** Na JVM do PC a lib nativa do Android não carrega: a falha ao criar o motor tem de cair na cadeia (§28 A). */
    @Test
    fun `native failure creating the engine is Unavailable`() = runBlocking {
        val dir = Files.createTempDirectory("litertlm").toFile()
        val gen = LiteRtLmTextGenerator("qwen3-0.6b-int4", File(dir, "model.litertlm").apply { writeText("x") }, File(dir, "cache"))
        try {
            val e = assertThrows(AiError.Unavailable::class.java) {
                runBlocking { gen.generate(TextRequest(system = null, prompt = "oi", maxTokens = 8)) }
            }
            assertEquals(listOf(Requirement.Model("qwen3-0.6b-int4")), e.missing)
        } finally {
            gen.close()
            dir.deleteRecursively()
        }
    }

    @Test
    fun `cache dir is per model and old loose cache files are dropped`() {
        val app = Files.createTempDirectory("cache").toFile()
        try {
            val root = File(app, "litertlm").apply { mkdirs() }
            val loose = File(root, "gemma-4-E2B-it.litertlm.xnnpack_cache").apply { writeText("velho") }
            val other = File(root, "qwen3-0.6b-int4").apply { mkdirs() }
            File(other, "cache.bin").writeText("do outro")
            val dir = LiteRtLmFactory.prepareCacheDir(app, "gemma-4-e2b-it")
            assertEquals(File(root, "gemma-4-e2b-it"), dir)
            assertEquals(LiteRtLmFactory.cacheDirFor(app, "gemma-4-e2b-it"), dir)
            assertFalse(loose.exists())
            assertTrue(File(other, "cache.bin").exists())
        } finally {
            app.deleteRecursively()
        }
    }

    @Test
    fun `factory requires the model and its RAM from the catalog`() {
        val f = LiteRtLmFactory { if (it == "qwen3-0.6b-int4") 3072 else 0 }
        assertEquals(
            listOf(Requirement.Model("qwen3-0.6b-int4"), Requirement.MinRamMb(3072)),
            f.requirements(JsonObject(mapOf(LiteRtLmFactory.MODEL_ID to JsonPrimitive("qwen3-0.6b-int4")))),
        )
        assertEquals(listOf(Requirement.Model(LiteRtLmFactory.DEFAULT_MODEL)), f.requirements(JsonObject(emptyMap())))
    }
}
