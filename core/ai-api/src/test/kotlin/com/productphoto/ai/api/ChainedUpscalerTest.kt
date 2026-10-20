package com.productphoto.ai.api

import kotlinx.coroutines.test.runTest
import kotlinx.serialization.json.JsonObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertSame
import org.junit.Test

class ChainedUpscalerTest {
    private class FakeUpscaler(val error: AiError?, val result: RgbaImage) : Upscaler {
        val factors = mutableListOf<Int>()
        override suspend fun upscale(image: RgbaImage, factor: Int, progress: ProgressSink?): RgbaImage {
            factors += factor
            progress?.invoke(Progress(1f, "fake"))
            error?.let { throw it }
            return result
        }
    }

    private class Factory(override val id: String, val upscaler: FakeUpscaler, val reqs: List<Requirement> = emptyList()) :
        ProviderFactory<Upscaler> {
        override val capability = Capability.UPSCALER
        override val displayName = id
        override val isLocal = true
        override fun requirements(settings: JsonObject) = reqs
        override fun create(settings: JsonObject, ctx: ProviderContext): Upscaler = upscaler
    }

    private val ctx = object : ProviderContext {
        override val androidContext get() = throw UnsupportedOperationException()
        override fun <T : Any> service(type: Class<T>): T? = null
    }

    private fun upscaler(vararg factories: Factory, met: (Requirement) -> Boolean = { true }): ChainedUpscaler {
        val registry = ProviderRegistry().apply { factories.forEach(::register) }
        val config = ProviderConfig().withChain(Capability.UPSCALER, factories.map { ChainEntry(it.id) })
        return ChainedUpscaler(FallbackChain(Capability.UPSCALER, Upscaler::class.java, registry, { config }, { met(it) }, ctx))
    }

    @Test
    fun `provider without model falls through to the next one`() = runTest {
        val out = stubImage()
        val local = Factory("local", FakeUpscaler(AiError.ModelNotDownloaded("realesrgan"), stubImage()))
        val remote = Factory("remote", FakeUpscaler(null, out))
        val chained = upscaler(local, remote)
        val progress = mutableListOf<Progress>()

        assertSame(out, chained.upscale(stubImage(), 2) { progress += it })
        assertEquals(listOf(2), local.upscaler.factors)
        assertEquals(listOf(2), remote.upscaler.factors)
        assertEquals(2, progress.size)
        assertEquals("remote", chained.chain.lastServedBy.value?.providerId)
    }

    @Test
    fun `unmet requirement skips the provider`() = runTest {
        val out = stubImage()
        val local = Factory("local", FakeUpscaler(null, stubImage()), reqs = listOf(Requirement.Model("realesrgan")))
        val remote = Factory("remote", FakeUpscaler(null, out))

        assertSame(out, upscaler(local, remote) { it !is Requirement.Model }.upscale(stubImage(), 4))
        assertEquals(emptyList<Int>(), local.upscaler.factors)
    }
}
