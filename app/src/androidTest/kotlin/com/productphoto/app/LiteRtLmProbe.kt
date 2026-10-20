package com.productphoto.app

import android.util.Log
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import com.productphoto.ai.api.StructuredText
import com.productphoto.ai.litertlm.LiteRtLmFactory
import com.productphoto.ai.litertlm.LiteRtLmTextGenerator
import com.productphoto.editor.TextPrompts
import kotlinx.coroutines.runBlocking
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import org.junit.Assume.assumeTrue
import org.junit.Test
import org.junit.runner.RunWith

/**
 * Sonda (sessão 11, §18.7): decodificação restrita do LiteRT-LM ligada × desligada com a instrução em forma de
 * exemplo do StructuredText. Conta respostas válidas pelo schema (não só parseáveis). Rodar à mão; pula sem o modelo.
 */
@RunWith(AndroidJUnit4::class)
class LiteRtLmProbe {
    @Test
    fun probe() = runBlocking<Unit> {
        val context = InstrumentationRegistry.getInstrumentation().targetContext
        val file = AppGraph(context).models.ensureReady("qwen3-0.6b-int4")
        assumeTrue(file != null)
        val cases = listOf(
            "rewrite" to TextPrompts.rewrite("Promoção de pão francês hoje", "persuasive", 3),
            "copy" to TextPrompts.copy("padaria artesanal, pão de fermentação natural, promoção de sexta"),
        )
        for (constrained in listOf(true, false)) {
            val gen = LiteRtLmTextGenerator("qwen3-0.6b-int4", file!!, LiteRtLmFactory.cacheDirFor(context.cacheDir, "qwen3-0.6b-int4"), constrainedJson = constrained)
            for ((name, req) in cases) {
                val schema = Json.parseToJsonElement(req.jsonSchema!!) as JsonObject
                var valid = 0
                repeat(6) { i ->
                    val raw = runCatching { gen.generate(StructuredText.withJsonInstruction(req)) }
                        .getOrElse { "ERRO ${it.javaClass.simpleName}: ${it.message}" }
                    val errors = runCatching { StructuredText.validate(StructuredText.extractJson(raw), schema) }
                        .getOrElse { listOf(it.message ?: "?") }
                    if (errors.isEmpty()) valid++
                    Log.i(TAG, "constrained=$constrained $name #$i ok=${errors.isEmpty()} ${errors.take(2)}: ${raw.replace('\n', ' ')}")
                }
                Log.i(TAG, "RESUMO constrained=$constrained $name: $valid/6 válidas")
            }
            gen.close()
        }
    }

    private companion object {
        const val TAG = "LiteRtLmProbe"
    }
}
