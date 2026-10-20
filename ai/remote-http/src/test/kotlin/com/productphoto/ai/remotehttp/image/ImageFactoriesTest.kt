package com.productphoto.ai.remotehttp.image

import com.productphoto.ai.api.AiError
import com.productphoto.ai.api.Control
import com.productphoto.ai.api.ImageFeature
import com.productphoto.ai.api.ImageRequest
import com.productphoto.ai.api.Mask
import com.productphoto.ai.api.ProviderContext
import com.productphoto.ai.api.Requirement
import com.productphoto.ai.api.RgbaImage
import com.productphoto.secrets.SecretStore
import kotlinx.coroutines.test.runTest
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.int
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.put
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertSame
import org.junit.Assert.assertTrue
import org.junit.Assert.fail
import org.junit.Test
import java.util.Base64

class ImageFactoriesTest {
    /** Codifica como texto "<tipo>:<w>x<h>[:alfa]" para o teste ver o que chegou ao backend. */
    private class FakeCodec(val decoded: RgbaImage?) : ImageCodec {
        override fun encode(image: RgbaImage, width: Int, height: Int) = "img:${width}x$height".toByteArray()
        override fun encodeMask(mask: Mask, width: Int, height: Int) =
            "mask:${width}x$height:${mask.alpha.joinToString(",") { (it.toInt() and 0xff).toString() }}".toByteArray()
        override fun decode(bytes: ByteArray) = decoded
    }

    private val image = stubImage()
    private val codec = FakeCodec(image)
    private val secrets = object : SecretStore {
        val map = mutableMapOf("img.a1111" to "ana:pw")
        override fun get(name: String) = map[name]
        override fun put(name: String, value: String) { map[name] = value }
        override fun remove(name: String) { map.remove(name) }
        override fun names() = map.keys
    }
    private val ctx = object : ProviderContext {
        override val androidContext get() = throw UnsupportedOperationException()
        @Suppress("UNCHECKED_CAST")
        override fun <T : Any> service(type: Class<T>): T? = if (type == SecretStore::class.java) secrets as T else null
    }

    private var handler: (FakeHttpServer.Request) -> FakeHttpServer.Reply = {
        FakeHttpServer.Reply(200, """{"images":["${Base64.getEncoder().encodeToString(byteArrayOf(1))}"]}""")
    }
    private val server = FakeHttpServer { handler(it) }

    @After
    fun stop() = server.close()

    private fun settings(vararg kv: Pair<String, String>): JsonObject = buildJsonObject { kv.forEach { (k, v) -> put(k, v) } }

    @Test
    fun `requirements are network plus the secret when named`() {
        val a = A1111ImageFactory(codec)
        assertEquals(listOf(Requirement.Network), a.requirements(settings()))
        assertEquals(
            listOf(Requirement.Network, Requirement.Secret("img.a1111")),
            a.requirements(settings(A1111ImageFactory.AUTH_SECRET to "img.a1111")),
        )
        assertEquals(
            listOf(Requirement.Network, Requirement.Secret("img.comfy")),
            ComfyUiImageFactory(codec).requirements(settings(ComfyUiImageFactory.API_KEY_SECRET to "img.comfy")),
        )
    }

    @Test
    fun `no base url is Unavailable so the default chain can stay on`() {
        for (f in listOf(A1111ImageFactory(codec), ComfyUiImageFactory(codec))) {
            try {
                f.create(settings(), ctx)
                fail()
            } catch (e: AiError.Unavailable) {
                assertTrue(e.isFallbackable)
                assertTrue(e.missing.isEmpty())
            }
        }
    }

    @Test
    fun `supports follow the settings`() {
        val all = ImageFeature.entries.toSet()
        assertEquals(all, A1111ImageFactory(codec).create(settings("baseUrl" to server.base), ctx).supports)
        assertEquals(
            all - ImageFeature.CONTROL_CANNY,
            A1111ImageFactory(codec).create(settings("baseUrl" to server.base, "cannyModel" to ""), ctx).supports,
        )
        val comfy = ComfyUiImageFactory(codec)
        assertEquals(
            setOf(ImageFeature.TXT2IMG, ImageFeature.IMG2IMG, ImageFeature.INPAINT, ImageFeature.CONTROL_SCRIBBLE),
            comfy.create(settings("baseUrl" to server.base, "checkpoint" to "sd15.safetensors", "scribbleControlNet" to "s.pth"), ctx).supports,
        )
        val flow = """{"1": {"class_type": "LoadImage", "inputs": {"image": "{{init_image}}"}}}"""
        assertEquals(
            setOf(ImageFeature.TXT2IMG, ImageFeature.IMG2IMG),
            comfy.create(settings("baseUrl" to server.base, "workflow" to flow), ctx).supports,
        )
    }

    @Test
    fun `comfy without checkpoint or with a bad workflow is Unsupported`() {
        for (s in listOf(settings("baseUrl" to server.base), settings("baseUrl" to server.base, "workflow" to "[1,2]"))) {
            try {
                ComfyUiImageFactory(codec).create(s, ctx)
                fail()
            } catch (_: AiError.Unsupported) {
            }
        }
    }

    @Test
    fun `missing feature is Unsupported before the network`() = runTest {
        val gen = ComfyUiImageFactory(codec).create(settings("baseUrl" to server.base, "checkpoint" to "c"), ctx)
        try {
            gen.generate(ImageRequest("logo", control = Control(Control.Kind.CANNY, image)))
            fail()
        } catch (e: AiError.Unsupported) {
            assertTrue(e.message!!.contains("contorno"))
        }
        assertTrue(server.received.isEmpty())
    }

    @Test
    fun `a1111 end to end - secret as Basic, size snapped to 8, mask inverted on the server`() = runTest {
        val gen = A1111ImageFactory(codec).create(settings("baseUrl" to server.base, "authSecret" to "img.a1111", "steps" to "25"), ctx)
        val mask = Mask(2, 1, byteArrayOf(0, -1))
        val out = gen.generate(ImageRequest("bg", width = 515, height = 767, init = image, inpaintMask = mask, maskInvert = true))
        assertSame(image, out.single().let { it })
        val req = server.received.single()
        assertEquals("/sdapi/v1/img2img", req.path)
        assertEquals("Basic " + Base64.getEncoder().encodeToString("ana:pw".toByteArray()), req.headers["authorization"])
        val body = Json.parseToJsonElement(req.text).jsonObject
        assertEquals(512, body["width"]!!.jsonPrimitive.int)
        assertEquals(768, body["height"]!!.jsonPrimitive.int)
        assertEquals(25, body["steps"]!!.jsonPrimitive.int)
        assertEquals(1, body["inpainting_mask_invert"]!!.jsonPrimitive.int)
        val sentMask = Base64.getDecoder().decode(body["mask"]!!.jsonPrimitive.content).decodeToString()
        assertEquals("mask:512x768:0,255", sentMask)
    }

    @Test
    fun `comfy inverts the mask in the app before uploading`() = runTest {
        handler = { r ->
            when {
                r.path == "/upload/image" -> FakeHttpServer.Reply(200, """{"name": "u.png", "subfolder": "", "type": "input"}""")
                r.path == "/prompt" -> FakeHttpServer.Reply(200, """{"prompt_id": "p"}""")
                r.path.startsWith("/history/") -> FakeHttpServer.Reply(
                    200, """{"p": {"outputs": {"7": {"images": [{"filename": "o.png", "subfolder": "", "type": "output"}]}}, "status": {"status_str": "success", "completed": true}}}""",
                )
                else -> FakeHttpServer.Reply(200, byteArrayOf(1), "image/png")
            }
        }
        val gen = ComfyUiImageFactory(codec).create(settings("baseUrl" to server.base, "checkpoint" to "c"), ctx)
        gen.generate(ImageRequest("bg", init = image, inpaintMask = Mask(2, 1, byteArrayOf(0, -1)), maskInvert = true))
        val uploads = server.received.filter { it.path == "/upload/image" }.map { it.text }
        assertTrue(uploads.toString(), uploads.any { it.contains("mask:512x512:255,0") })
    }

    @Test
    fun `undecodable image is InvalidOutput`() = runTest {
        val gen = A1111ImageFactory(FakeCodec(decoded = null)).create(settings("baseUrl" to server.base), ctx)
        try {
            gen.generate(ImageRequest("x"))
            fail()
        } catch (_: AiError.InvalidOutput) {
        }
    }
}
