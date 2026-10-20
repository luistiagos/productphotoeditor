package com.productphoto.ai.api

import kotlinx.coroutines.test.runTest
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Assert.fail
import org.junit.Test

class StructuredTextTest {
    private val schema = """
        {"type":"object","required":["variants"],"properties":{
          "variants":{"type":"array","minItems":2,"maxItems":3,"items":{"type":"string","minLength":1}},
          "tone":{"type":"string","enum":["formal","fun"]}}}
    """.trimIndent()

    /** Devolve as respostas na ordem e guarda os pedidos. */
    private class Scripted(vararg answers: String) : TextGenerator {
        private val queue = ArrayDeque(answers.toList())
        val requests = mutableListOf<TextRequest>()
        override suspend fun generate(req: TextRequest): String { requests += req; return queue.removeFirst() }
    }

    private fun req() = TextRequest(system = "You rewrite text.", prompt = "Rewrite: oi", jsonSchema = schema)

    @Test
    fun `extracts JSON from fences, think blocks and surrounding text`() {
        val raw = "<think>hmm {not this}</think>Claro! ```json\n{\"a\": [1, 2]}\n``` espero que ajude"
        assertEquals(Json.parseToJsonElement("""{"a":[1,2]}"""), StructuredText.extractJson(raw))
        assertEquals(Json.parseToJsonElement("""["x"]"""), StructuredText.extractJson("Here: [\"x\"] done"))
    }

    @Test
    fun `no JSON in the answer is an IllegalArgumentException`() {
        try {
            StructuredText.extractJson("só texto")
            fail()
        } catch (_: IllegalArgumentException) {
        }
    }

    @Test
    fun `validate reports missing fields, wrong types, enum and array limits`() {
        val s = Json.parseToJsonElement(schema) as JsonObject
        assertTrue(StructuredText.validate(Json.parseToJsonElement("""{"variants":["a","b"]}"""), s).isEmpty())
        val errors = StructuredText.validate(Json.parseToJsonElement("""{"variants":["a", 3, " "],"tone":"sad"}"""), s)
        assertTrue(errors.toString(), errors.any { "\$.tone" in it && "one of" in it })
        assertTrue(errors.toString(), errors.any { "\$.variants[1] must be a string" in it })
        assertTrue(errors.toString(), errors.any { "\$.variants[2] is too short" in it })
        assertTrue(StructuredText.validate(Json.parseToJsonElement("""{"x":1}"""), s).single().contains("variants is missing"))
        assertTrue(StructuredText.validate(Json.parseToJsonElement("""{"variants":["a"]}"""), s).single().contains("at least 2"))
        assertTrue(StructuredText.validate(Json.parseToJsonElement("""[1]"""), s).single().contains("must be an object"))
        val ints = Json.parseToJsonElement("""{"type":"integer"}""") as JsonObject
        assertTrue(StructuredText.validate(Json.parseToJsonElement("3"), ints).isEmpty())
        assertEquals(1, StructuredText.validate(Json.parseToJsonElement("\"3\""), ints).size)
    }

    @Test
    fun `valid first answer returns without retry and the system carries the schema`() = runTest {
        val gen = Scripted("""{"variants":["Olá","Oi!"]}""")
        val out = StructuredText.generate(gen, req())
        assertEquals(listOf("Olá", "Oi!"), out.jsonObject["variants"]!!.jsonArray.map { it.jsonPrimitive.content })
        assertEquals(1, gen.requests.size)
        val system = gen.requests[0].system!!
        assertTrue(system.startsWith("You rewrite text."))
        assertTrue(system, system.endsWith("""{"variants":["...","..."],"tone":"formal"}"""))
        assertTrue("o schema cru não vai no prompt (§18.7)", !system.contains("minItems"))
    }

    @Test
    fun `skeleton follows types, enum and array sizes`() {
        fun sk(s: String) = StructuredText.skeleton(Json.parseToJsonElement(s) as JsonObject).toString()
        assertEquals("""["...","...","..."]""", sk("""{"type":"array","minItems":3,"items":{"type":"string"}}"""))
        assertEquals("""[0]""", sk("""{"type":"array","maxItems":1,"items":{"type":"integer"}}"""))
        assertEquals("""{"ok":true,"n":0,"kind":"a"}""",
            sk("""{"type":"object","properties":{"ok":{"type":"boolean"},"n":{"type":"number"},"kind":{"enum":["a","b"]}}}"""))
    }

    @Test
    fun `invalid first answer retries once with the error attached`() = runTest {
        val gen = Scripted("""{"variants":["só uma"]}""", """{"variants":["a","b"]}""")
        StructuredText.generate(gen, req())
        assertEquals(2, gen.requests.size)
        assertTrue(gen.requests[1].prompt.startsWith("Rewrite: oi"))
        assertTrue(gen.requests[1].prompt.contains("needs at least 2 items"))
    }

    @Test
    fun `second invalid answer is InvalidOutput`() = runTest {
        val gen = Scripted("nada", "ainda nada")
        try {
            StructuredText.generate(gen, req())
            fail()
        } catch (e: AiError.InvalidOutput) {
            assertTrue(e.message!!.contains("no JSON"))
        }
        assertEquals(2, gen.requests.size)
    }
}
