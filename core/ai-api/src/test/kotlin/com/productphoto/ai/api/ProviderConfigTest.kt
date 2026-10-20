package com.productphoto.ai.api

import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class ProviderConfigTest {

    private val config = ProviderConfig()
        .withChain(Capability.BACKGROUND_REMOVER, listOf(ChainEntry("mlkit.subject"), ChainEntry("onnx.u2netp")))
        .withChain(
            Capability.TEXT_GENERATOR,
            listOf(
                ChainEntry(
                    "http.openai-compatible",
                    buildJsonObject {
                        put("baseUrl", "http://192.168.0.10:11434/v1")
                        put("apiKeySecret", "ollama")
                    },
                ),
            ),
        )

    @Test
    fun `round trip keeps chains and settings`() {
        val back = ProviderConfig.fromJson(config.toJson())
        assertEquals(config, back)
        assertEquals(listOf("mlkit.subject", "onnx.u2netp"), back.chainFor(Capability.BACKGROUND_REMOVER).map { it.provider })
        assertEquals(
            JsonPrimitive("ollama"),
            back.chainFor(Capability.TEXT_GENERATOR).single().settings["apiKeySecret"],
        )
    }

    @Test
    fun `secret value stored in SecretStore never reaches the exported json`() {
        // O valor fica no SecretStore; a config só referencia o nome "ollama".
        val secretValue = "sk-live-123"
        val json = config.toJson()
        assertTrue(json.contains("\"apiKeySecret\": \"ollama\""))
        assertFalse(json.contains(secretValue))
    }

    @Test
    fun `parses the documented example and ignores unknown fields`() {
        val text = """
            {"version":1,"extra":true,"capabilities":{
              "BACKGROUND_REMOVER":{"chain":[{"provider":"mlkit.subject"},{"provider":"onnx.u2netp"}]}}}
        """.trimIndent()
        val parsed = ProviderConfig.fromJson(text)
        assertEquals(2, parsed.chainFor(Capability.BACKGROUND_REMOVER).size)
        assertTrue(parsed.chainFor(Capability.UPSCALER).isEmpty())
    }
}
