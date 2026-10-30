package com.productphoto.app

import com.productphoto.ai.api.AiError
import com.productphoto.ai.api.Capability
import com.productphoto.ai.api.Requirement
import com.productphoto.ai.remotehttp.image.IawrapperImageFactory
import com.productphoto.secrets.SecretStore
import kotlinx.serialization.json.JsonPrimitive
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class ImageGenConfigTest {
    @Test
    fun `generation size keeps the quick formats and fits big ones in the budget`() {
        assertEquals(512 to 512, generationSize(512, 512))
        assertEquals(512 to 768, generationSize(512, 768))
        assertEquals(768 to 512, generationSize(768, 512))
        for ((w, h) in listOf(1080 to 1920, 1640 to 624, 2560 to 1440, 1080 to 1350, 1000 to 2480)) {
            val (gw, gh) = generationSize(w, h)
            assertTrue("$w×$h → $gw×$gh", gw.toLong() * gh <= GEN_MAX_PIXELS && maxOf(gw, gh) <= GEN_MAX_SIDE)
            assertTrue(gw % 8 == 0 && gh % 8 == 0)
            assertEquals("$w×$h → $gw×$gh", w.toDouble() / h, gw.toDouble() / gh, 0.08 * w / h)
        }
    }

    @Test
    fun `small formats are generated in the budget and thin ones at 4 to 1`() {
        for ((w, h) in listOf(256 to 256, 500 to 500, 300 to 250, 360 to 640, 640 to 480)) {
            val (gw, gh) = generationSize(w, h)
            assertTrue("$w×$h → $gw×$gh", gw >= w && gh >= h)            // só reduz depois, nunca amplia
            assertTrue(gw.toLong() * gh <= GEN_MAX_PIXELS && gw % 8 == 0 && gh % 8 == 0)
        }
        assertEquals(1024 to 256, generationSize(728, 90))
        assertEquals(256 to 1024, generationSize(90, 728))
        assertEquals(1024 to 256, generationSize(1584, 396)) // capa do LinkedIn: 4:1 exato
    }

    @Test
    fun `default config has the image chain off`() {
        assertTrue(Capability.IMAGE_GENERATOR in AppGraph.DEFAULT_CONFIG.capabilities)
        assertTrue(AppGraph.DEFAULT_CONFIG.chainFor(Capability.IMAGE_GENERATOR).isEmpty())
    }

    @Test
    fun `cloud chain is a fixed iawrapper entry`() {
        val entry = cloudImageChain(" https://ia.example ", "product-photo-vast", hasCredential = true).single()
        assertEquals(IawrapperImageFactory.ID, entry.provider)
        assertEquals("https://ia.example", (entry.settings[IawrapperImageFactory.BASE_URL] as JsonPrimitive).content)
        assertEquals("product-photo-vast", (entry.settings[IawrapperImageFactory.FEATURE_SLUG] as JsonPrimitive).content)
        assertEquals(IMAGE_IAWRAPPER_SECRET, (entry.settings[IawrapperImageFactory.AUTH_SECRET] as JsonPrimitive).content)
        assertEquals("product-photo", (entry.settings[IawrapperImageFactory.APP_ID] as JsonPrimitive).content)
        assertEquals("product-photo", IawrapperImageFactory.options(entry.settings).appId)
        // igualdade estável: a tela só regrava (e invalida a cadeia) quando algo mudou
        assertEquals(cloudImageChain("https://ia.example", "product-photo-vast", true), listOf(entry))

        val anonymous = cloudImageChain("https://ia.example", "product-photo-vast", hasCredential = false).single()
        assertNull(anonymous.settings[IawrapperImageFactory.AUTH_SECRET])
    }

    @Test
    fun `built-in secret wins over the stored one and empty falls back`() {
        val stored = MemorySecrets().apply { put(IMAGE_IAWRAPPER_SECRET, "old:typed"); put("other", "x") }
        val s = BuiltInSecretStore(stored, mapOf(IMAGE_IAWRAPPER_SECRET to "svc@app:pw"))
        assertEquals("svc@app:pw", s.get(IMAGE_IAWRAPPER_SECRET))
        assertEquals("x", s.get("other"))
        assertEquals(setOf(IMAGE_IAWRAPPER_SECRET, "other"), s.names())

        val empty = BuiltInSecretStore(stored, mapOf(IMAGE_IAWRAPPER_SECRET to " "))
        assertEquals("old:typed", empty.get(IMAGE_IAWRAPPER_SECRET))
        empty.remove(IMAGE_IAWRAPPER_SECRET)
        assertNull(empty.get(IMAGE_IAWRAPPER_SECRET))
    }

    @Test
    fun `errors are plain language`() {
        assertTrue(describeImageError(AiError.Unavailable(listOf(Requirement.Network))).startsWith("Sem internet"))
        assertTrue(describeImageError(AiError.Unavailable(emptyList())).contains("não está disponível"))
        assertTrue(describeImageError(AiError.Remote(402, null)).contains("sem créditos"))
        assertTrue(describeImageError(AiError.Remote(429, null)).contains("Aguarde alguns minutos"))
        val generic = describeImageError(AiError.Remote(500, "vast worker crashed"))
        assertFalse(generic.contains("HTTP") || generic.contains("vast"))
    }

    private class MemorySecrets : SecretStore {
        private val m = mutableMapOf<String, String>()
        override fun get(name: String) = m[name]
        override fun put(name: String, value: String) { m[name] = value }
        override fun remove(name: String) { m.remove(name) }
        override fun names() = m.keys.toSet()
    }
}
