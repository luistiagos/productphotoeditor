package com.productphoto.ai.remotehttp.image

import com.productphoto.ai.api.AiError
import com.productphoto.ai.api.Control
import com.productphoto.ai.api.Progress
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.test.runTest
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.int
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.long
import org.junit.After
import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Assert.fail
import org.junit.Test
import java.util.Base64
import java.util.Collections
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit

class A1111BackendTest {
    private val png1 = byteArrayOf(1, 2, 3)
    private val png2 = byteArrayOf(4, 5, 6)
    private val b64 = { b: ByteArray -> Base64.getEncoder().encodeToString(b) }
    private fun images(vararg imgs: ByteArray) = """{"images":[${imgs.joinToString { "\"${b64(it)}\"" }}],"parameters":{},"info":"{}"}"""

    private var handler: (FakeHttpServer.Request) -> FakeHttpServer.Reply = { FakeHttpServer.Reply(500, "{}") }
    private val server = FakeHttpServer { handler(it) }

    @After
    fun stop() = server.close()

    private fun backend(auth: String? = null, options: A1111Options = A1111Options()) =
        A1111Backend(server.base + "/", auth = { auth }, options = options, pollMs = 30)

    private fun job(
        count: Int = 1, init: ByteArray? = null, mask: ByteArray? = null, maskInvert: Boolean = false,
        control: ControlJob? = null, seed: Long? = null,
    ) = ImageJob("cat poster", "blurry", 512, 768, steps = null, seed = seed, cfg = null, count = count,
        init = init, strength = if (init != null) .6f else null, mask = mask, maskInvert = maskInvert, control = control)

    private fun body(path: String): JsonObject =
        Json.parseToJsonElement(server.received.single { it.path == path }.text).jsonObject

    @Test
    fun `txt2img sends the defaults and Basic auth and returns the images`() = runTest {
        handler = { FakeHttpServer.Reply(200, images(png1, png2)) }
        val out = backend("ana:s3cr3t").run(job(count = 2), null)
        assertEquals(2, out.size)
        assertArrayEquals(png1, out[0])
        assertArrayEquals(png2, out[1])
        val req = server.received.single()
        assertEquals("POST", req.method)
        assertEquals("/sdapi/v1/txt2img", req.path)
        assertEquals("Basic " + b64("ana:s3cr3t".toByteArray()), req.headers["authorization"])
        val b = body("/sdapi/v1/txt2img")
        assertEquals("cat poster", b["prompt"]!!.jsonPrimitive.content)
        assertEquals("blurry", b["negative_prompt"]!!.jsonPrimitive.content)
        assertEquals("Euler a", b["sampler_name"]!!.jsonPrimitive.content)
        assertEquals(18, b["steps"]!!.jsonPrimitive.int)
        assertEquals(-1L, b["seed"]!!.jsonPrimitive.long)
        assertEquals(2, b["batch_size"]!!.jsonPrimitive.int)
        assertEquals(1, b["n_iter"]!!.jsonPrimitive.int)
        assertEquals(768, b["height"]!!.jsonPrimitive.int)
        assertNull(b["init_images"])
        assertNull(b["alwayson_scripts"])
    }

    @Test
    fun `img2img with inverted mask goes to img2img`() = runTest {
        handler = { FakeHttpServer.Reply(200, images(png1)) }
        val init = byteArrayOf(9, 9)
        val mask = byteArrayOf(7)
        backend().run(job(init = init, mask = mask, maskInvert = true, seed = 42), null)
        assertNull(server.received.single().headers["authorization"])
        val b = body("/sdapi/v1/img2img")
        assertEquals(b64(init), b["init_images"]!!.jsonArray.single().jsonPrimitive.content)
        assertEquals(b64(mask), b["mask"]!!.jsonPrimitive.content)
        assertEquals(1, b["inpainting_mask_invert"]!!.jsonPrimitive.int)
        assertEquals(1, b["inpainting_fill"]!!.jsonPrimitive.int)
        assertEquals(.6f, b["denoising_strength"]!!.jsonPrimitive.content.toFloat())
        assertEquals(42L, b["seed"]!!.jsonPrimitive.long)
    }

    @Test
    fun `controlnet unit is sent and the detected map is cut off`() = runTest {
        handler = { FakeHttpServer.Reply(200, images(png1, png2)) } // png2 = mapa detectado
        val sketch = byteArrayOf(5)
        val out = backend().run(job(control = ControlJob(Control.Kind.SCRIBBLE, sketch, 1.2f)), null)
        assertEquals(1, out.size)
        assertArrayEquals(png1, out[0])
        val unit = body("/sdapi/v1/txt2img")["alwayson_scripts"]!!.jsonObject["controlnet"]!!.jsonObject["args"]!!
            .jsonArray.single().jsonObject
        assertEquals(b64(sketch), unit["image"]!!.jsonPrimitive.content)
        assertNull(unit["input_image"]) // alias depreciado: mandar os dois dá erro de conflito
        assertEquals("control_v11p_sd15_scribble [d4ba51ff]", unit["model"]!!.jsonPrimitive.content)
        assertEquals("t2ia_sketch_pidi", unit["module"]!!.jsonPrimitive.content)
        assertEquals("false", unit["save_detected_map"]!!.jsonPrimitive.content)
        assertEquals(1.2f, unit["weight"]!!.jsonPrimitive.content.toFloat())
    }

    @Test
    fun `control without a model is Unsupported before any request`() = runTest {
        try {
            backend(options = A1111Options(cannyModel = null)).run(job(control = ControlJob(Control.Kind.CANNY, png1, 1f)), null)
            fail()
        } catch (_: AiError.Unsupported) {
        }
        assertTrue(server.received.isEmpty())
    }

    @Test
    fun `422 is Remote with the body`() = runTest {
        handler = { FakeHttpServer.Reply(422, """{"error":"RuntimeError","detail":"always on script controlnet not found"}""") }
        try {
            backend().run(job(), null)
            fail()
        } catch (e: AiError.Remote) {
            assertEquals(422, e.code)
            assertTrue(e.body!!.contains("controlnet not found"))
            assertTrue(!e.isFallbackable)
        }
    }

    @Test
    fun `connection refused is Network`() = runTest {
        try {
            A1111Backend("http://127.0.0.1:${deadPort()}", auth = { null }).run(job(), null)
            fail()
        } catch (e: AiError.Network) {
            assertTrue(e.isFallbackable)
        }
    }

    @Test
    fun `reply without images is InvalidOutput`() = runTest {
        handler = { FakeHttpServer.Reply(200, """{"images":[],"info":"{}"}""") }
        try {
            backend().run(job(), null)
            fail()
        } catch (_: AiError.InvalidOutput) {
        }
    }

    @Test
    fun `progress is read from the progress route while generating`() = runTest {
        val polled = CountDownLatch(2)
        handler = { r ->
            when {
                r.path.startsWith("/sdapi/v1/progress") -> {
                    polled.countDown()
                    FakeHttpServer.Reply(200, """{"progress":0.25,"eta_relative":3.0,"state":{"job_count":1},"textinfo":null}""")
                }
                else -> {
                    polled.await(5, TimeUnit.SECONDS)
                    FakeHttpServer.Reply(200, images(png1))
                }
            }
        }
        val seen = Collections.synchronizedList(mutableListOf<Progress>())
        backend().run(job(), { seen += it })
        assertTrue(server.paths().contains("/sdapi/v1/progress?skip_current_image=true"))
        assertTrue(seen.isNotEmpty())
        assertEquals(.25f, seen.first().fraction)
    }

    @Test
    fun `cancel calls interrupt`() = runTest {
        val release = CountDownLatch(1)
        handler = { r ->
            if (r.path == "/sdapi/v1/txt2img") release.await(5, TimeUnit.SECONDS)
            FakeHttpServer.Reply(200, if (r.path == "/sdapi/v1/interrupt") "{}" else images(png1))
        }
        val running = launch(Dispatchers.IO) { backend().run(job(), null) }
        server.awaitUntil { "/sdapi/v1/txt2img" in server.paths() }
        running.cancel()
        server.awaitUntil { "/sdapi/v1/interrupt" in server.paths() }
        release.countDown()
        running.join()
        assertTrue(running.isCancelled)
    }
}
