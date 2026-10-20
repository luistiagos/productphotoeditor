package com.productphoto.ai.api

import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.test.runTest
import kotlinx.serialization.json.JsonObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Assert.fail
import org.junit.Test

class FallbackChainTest {

    /** Fake: devolve o próprio id ou lança o erro configurado. */
    private class Fake(val id: String, val error: Throwable?) : AutoCloseable {
        var calls = 0
        var closed = 0
        override fun close() { closed++ }
        fun call(): String {
            calls++
            error?.let { throw it }
            return id
        }
    }

    private class FakeFactory(
        override val id: String,
        private val reqs: List<Requirement> = emptyList(),
        error: Throwable? = null,
        override val capability: Capability = Capability.TEXT_GENERATOR,
    ) : ProviderFactory<Fake> {
        val fake = Fake(id, error)
        var created = 0
        override val displayName = id
        override val isLocal = true
        override fun requirements(settings: JsonObject) = reqs
        override fun create(settings: JsonObject, ctx: ProviderContext): Fake { created++; return fake }
    }

    private val ctx = object : ProviderContext {
        override val androidContext get() = throw UnsupportedOperationException()
        override fun <T : Any> service(type: Class<T>): T? = null
    }

    private fun chain(vararg factories: FakeFactory, met: (Requirement) -> Boolean = { true }): FallbackChain<Fake> {
        val registry = ProviderRegistry().apply { factories.forEach(::register) }
        val config = ProviderConfig().withChain(Capability.TEXT_GENERATOR, factories.map { ChainEntry(it.id) })
        return FallbackChain(Capability.TEXT_GENERATOR, Fake::class.java, registry, { config }, { met(it) }, ctx)
    }

    @Test
    fun `missing requirement skips provider without creating it`() = runTest {
        val a = FakeFactory("a", reqs = listOf(Requirement.PlayServices))
        val b = FakeFactory("b")
        val c = chain(a, b) { it != Requirement.PlayServices }

        assertEquals("b", c.run { it.call() })
        assertEquals(0, a.created)
        assertEquals("b", c.lastServedBy.value?.providerId)
    }

    @Test
    fun `network error falls through to next provider`() = runTest {
        val a = FakeFactory("a", error = AiError.Network(RuntimeException("down")))
        val b = FakeFactory("b")

        assertEquals("b", chain(a, b).run { it.call() })
        assertEquals(1, a.fake.calls)
    }

    @Test
    fun `unavailable and model missing fall through`() = runTest {
        val a = FakeFactory("a", error = AiError.Unavailable(listOf(Requirement.DeviceFeature("x"))))
        val b = FakeFactory("b", error = AiError.ModelNotDownloaded("m"))
        val c = FakeFactory("c")

        assertEquals("c", chain(a, b, c).run { it.call() })
    }

    @Test
    fun `remote error surfaces and does not try next`() = runTest {
        val a = FakeFactory("a", error = AiError.Remote(500, "boom"))
        val b = FakeFactory("b")
        try {
            chain(a, b).run { it.call() }
            fail("expected Remote")
        } catch (e: AiError.Remote) {
            assertEquals(500, e.code)
        }
        assertEquals(0, b.fake.calls)
    }

    @Test
    fun `invalid output surfaces`() = runTest {
        val a = FakeFactory("a", error = AiError.InvalidOutput("bad"))
        val b = FakeFactory("b")
        try {
            chain(a, b).run { it.call() }
            fail("expected InvalidOutput")
        } catch (_: AiError.InvalidOutput) {
        }
        assertEquals(0, b.fake.calls)
    }

    @Test
    fun `cancellation propagates and does not try next`() = runTest {
        val a = FakeFactory("a", error = CancellationException("cancel"))
        val b = FakeFactory("b")
        try {
            chain(a, b).run { it.call() }
            fail("expected cancellation")
        } catch (_: CancellationException) {
        }
        assertEquals(0, b.fake.calls)
    }

    @Test
    fun `all unavailable reports every missing requirement`() = runTest {
        val a = FakeFactory("a", reqs = listOf(Requirement.PlayServices))
        val b = FakeFactory("b", error = AiError.Unavailable(listOf(Requirement.Model("u2netp"))))
        try {
            chain(a, b) { it != Requirement.PlayServices }.run { it.call() }
            fail("expected Unavailable")
        } catch (e: AiError.Unavailable) {
            assertEquals(listOf(Requirement.PlayServices, Requirement.Model("u2netp")), e.missing)
        }
    }

    @Test
    fun `last network error is thrown when nothing serves`() = runTest {
        val a = FakeFactory("a", error = AiError.Network(RuntimeException()))
        try {
            chain(a).run { it.call() }
            fail("expected Network")
        } catch (_: AiError.Network) {
        }
    }

    @Test
    fun `unknown and wrong-capability providers are skipped`() = runTest {
        val wrong = FakeFactory("w", capability = Capability.UPSCALER)
        val ok = FakeFactory("ok")
        val registry = ProviderRegistry().apply { register(wrong); register(ok) }
        val config = ProviderConfig().withChain(
            Capability.TEXT_GENERATOR,
            listOf(ChainEntry("ghost"), ChainEntry("w"), ChainEntry("ok")),
        )
        val c = FallbackChain(Capability.TEXT_GENERATOR, Fake::class.java, registry, { config }, { true }, ctx)

        assertEquals("ok", c.run { it.call() })
        assertEquals(0, wrong.created)
    }

    @Test
    fun `instances are cached until invalidate`() = runTest {
        val a = FakeFactory("a")
        val c = chain(a)
        c.run { it.call() }
        c.run { it.call() }
        assertEquals(1, a.created)
        c.invalidate()
        assertEquals(1, a.fake.closed)
        c.run { it.call() }
        assertEquals(2, a.created)
    }

    @Test
    fun `empty chain is unavailable`() = runTest {
        val c = chain()
        try {
            c.run { it.call() }
            fail()
        } catch (e: AiError.Unavailable) {
            assertTrue(e.missing.isEmpty())
        }
    }
}
