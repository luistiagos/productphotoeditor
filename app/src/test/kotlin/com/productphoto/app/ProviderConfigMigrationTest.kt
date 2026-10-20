package com.productphoto.app

import com.productphoto.ai.api.Capability
import com.productphoto.ai.api.ChainEntry
import com.productphoto.ai.api.ProviderConfig
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder

class ProviderConfigMigrationTest {
    @get:Rule val tmp = TemporaryFolder()

    private fun load(config: ProviderConfig): ProviderConfig = runBlocking {
        val file = tmp.newFile("provider_config.json").apply { writeText(config.toJson()) }
        FileProviderConfigStore(file).load()
    }

    @Test
    fun `saved birefnet-only chain falls back to the default remover chain`() {
        val loaded = load(ProviderConfig().withChain(Capability.BACKGROUND_REMOVER, listOf(ChainEntry("onnx.birefnet-lite"))))
        assertEquals(listOf("mlkit.subject", "onnx.u2netp"), loaded.chainFor(Capability.BACKGROUND_REMOVER).map { it.provider })
    }

    @Test
    fun `retired provider is dropped from a mixed chain`() {
        val chain = listOf(ChainEntry("onnx.u2netp"), ChainEntry("onnx.birefnet-lite"))
        val loaded = load(ProviderConfig().withChain(Capability.BACKGROUND_REMOVER, chain))
        assertEquals(listOf("onnx.u2netp"), loaded.chainFor(Capability.BACKGROUND_REMOVER).map { it.provider })
    }

    @Test
    fun `chain saved empty on purpose stays empty`() {
        val loaded = load(ProviderConfig().withChain(Capability.IMAGE_GENERATOR, emptyList()))
        assertEquals(emptyList<String>(), loaded.chainFor(Capability.IMAGE_GENERATOR).map { it.provider })
    }
}
