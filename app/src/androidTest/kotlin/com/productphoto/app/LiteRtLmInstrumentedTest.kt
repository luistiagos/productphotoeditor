package com.productphoto.app

import android.util.Log
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import com.productphoto.ai.api.StructuredText
import com.productphoto.ai.api.TextRequest
import com.productphoto.ai.litertlm.LiteRtLmFactory
import com.productphoto.editor.TextPrompts
import kotlinx.coroutines.runBlocking
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Assume.assumeTrue
import org.junit.Test
import org.junit.runner.RunWith
import java.io.File

/**
 * Texto IA pela cadeia padrão com o LLM local de verdade (ARQUITETURA §18.6 task 5). Precisa do Qwen3-0.6B baixado em
 * Modelos de IA (pula se não estiver). No emulador não há AICore: o Nano cai, o Gemma é pulado (não baixado) e o
 * LiteRT-LM com Qwen atende. Mede tempo e pico de RSS (VmHWM) do processo.
 */
@RunWith(AndroidJUnit4::class)
class LiteRtLmInstrumentedTest {
    private val context = InstrumentationRegistry.getInstrumentation().targetContext

    @Test
    fun chainAnswersWithLocalModelAndValidJson() = runBlocking<Unit> {
        val graph = AppGraph(context)
        assumeTrue("baixe o Qwen3-0.6B em Modelos de IA antes", graph.models.ensureReady("qwen3-0.6b-int4") != null)
        graph.saveTextChain(AppGraph.ON_DEVICE_TEXT_CHAIN)
        val gen = graph.textGenerator
        try {
            val t0 = System.currentTimeMillis()
            val plain = gen.generate(TextRequest(system = null, prompt = "Escreva um slogan curto para uma padaria artesanal.", maxTokens = 64))
            val firstMs = System.currentTimeMillis() - t0
            Log.i(TAG, "plain (${firstMs} ms, inclui carregar o motor): $plain")
            assertTrue("resposta vazia", plain.isNotBlank())
            assertTrue("sobrou raciocínio: $plain", "<think>" !in plain)
            assertEquals(LiteRtLmFactory.ID, gen.chain.lastServedBy.value?.providerId)

            val req = TextPrompts.rewrite("Promoção de pão francês hoje", "persuasive", 3)
            val tr = System.currentTimeMillis()
            val raw = gen.generate(StructuredText.withJsonInstruction(req))
            Log.i(TAG, "raw JSON (${System.currentTimeMillis() - tr} ms): $raw")

            val t1 = System.currentTimeMillis()
            val json = StructuredText.generate(gen, req)
            val jsonMs = System.currentTimeMillis() - t1
            val variants = json.jsonObject["variants"]!!.jsonArray.map { it.jsonPrimitive.content }
            Log.i(TAG, "rewrite (${jsonMs} ms): $variants")
            assertTrue(variants.isNotEmpty())
            Log.i(TAG, "memória: ${memory()}")
        } finally {
            gen.chain.invalidate() // fecha o motor
        }
    }

    private fun memory(): String = File("/proc/self/status").readLines()
        .filter { it.startsWith("VmHWM") || it.startsWith("VmRSS") || it.startsWith("VmSwap") }
        .joinToString(", ") { it.replace(Regex("\\s+"), " ") }

    private companion object {
        const val TAG = "LiteRtLmTest"
    }
}
