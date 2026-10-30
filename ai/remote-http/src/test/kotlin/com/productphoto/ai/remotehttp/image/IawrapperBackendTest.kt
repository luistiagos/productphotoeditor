package com.productphoto.ai.remotehttp.image

import com.productphoto.ai.api.AiError
import com.productphoto.ai.api.Progress
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.test.runTest
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.int
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import org.junit.After
import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Assert.fail
import org.junit.Test
import java.util.Collections
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit

class IawrapperBackendTest {
    private val samplePng = byteArrayOf(10, 20, 30, 40)
    private var handler: (FakeHttpServer.Request) -> FakeHttpServer.Reply = { FakeHttpServer.Reply(500, "{}") }
    private val server = FakeHttpServer { handler(it) }

    @After
    fun stop() = server.close()

    private fun backend(auth: String? = null, options: IawrapperOptions = IawrapperOptions(pollMs = 20)) =
        IawrapperBackend(server.base + "/", auth = { auth }, options = options)

    private fun job(count: Int = 1, seed: Long? = null) = ImageJob(
        prompt = "luxury perfume bottle",
        negative = "blurry",
        width = 512,
        height = 512,
        steps = 20,
        seed = seed,
        cfg = null,
        count = count,
    )

    private fun body(req: FakeHttpServer.Request): JsonObject =
        Json.parseToJsonElement(req.text).jsonObject

    @Test
    fun `txt2img with email password login performs auth and returns downloaded image`() = runTest {
        handler = { req ->
            when (req.path) {
                "/api/auth/login/" -> {
                    val b = body(req)
                    assertEquals("user@test.com", b["email"]?.jsonPrimitive?.content)
                    assertEquals("pass123", b["password"]?.jsonPrimitive?.content)
                    FakeHttpServer.Reply(200, """{"access":"jwt-token-123","refresh":"ref"}""")
                }
                "/api/tasks/" -> {
                    assertEquals("Bearer jwt-token-123", req.headers["authorization"])
                    val b = body(req)
                    assertEquals("product-photo-vast", b["feature_slug"]?.jsonPrimitive?.content)
                    assertEquals("luxury perfume bottle", b["prompt"]?.jsonPrimitive?.content)
                    assertEquals(512, b["width"]?.jsonPrimitive?.int)
                    assertEquals(20, b["steps"]?.jsonPrimitive?.int)
                    FakeHttpServer.Reply(
                        201,
                        """{
                            "id": 42,
                            "status": "success",
                            "outputs": [{"kind": "image", "external_url": "${server.base}/cdn/img.png"}]
                        }"""
                    )
                }
                "/cdn/img.png" -> {
                    // external download must not leak auth header
                    assertTrue(!req.headers.containsKey("authorization"))
                    FakeHttpServer.Reply(200, samplePng, contentType = "image/png")
                }
                else -> FakeHttpServer.Reply(404, "{}")
            }
        }

        val out = backend("user@test.com:pass123").run(job(), null)
        assertEquals(1, out.size)
        assertArrayEquals(samplePng, out[0])
    }

    @Test
    fun `login sends the X-App-Id of the options and no header without one`() = runTest {
        val appIds = Collections.synchronizedList(mutableListOf<String?>())
        handler = { req ->
            when (req.path) {
                "/api/auth/login/" -> {
                    appIds += req.headers["x-app-id"]
                    FakeHttpServer.Reply(200, """{"access":"jwt","refresh":"ref"}""")
                }
                "/api/tasks/" -> FakeHttpServer.Reply(201, """{"id": 47, "status": "failed", "error_message": "x"}""")
                else -> FakeHttpServer.Reply(404, "{}")
            }
        }

        for (appId in listOf("product-photo", null)) {
            try {
                backend("user@test.com:pass123", IawrapperOptions(pollMs = 20, appId = appId)).run(job(), null)
                fail("Esperava erro Remote")
            } catch (_: AiError.Remote) {
            }
        }
        assertEquals(listOf("product-photo", null), appIds)
    }

    @Test
    fun `txt2img with raw JWT token skips login and returns downloaded image`() = runTest {
        handler = { req ->
            when (req.path) {
                "/api/tasks/" -> {
                    assertEquals("Bearer raw-token-abc", req.headers["authorization"])
                    FakeHttpServer.Reply(
                        201,
                        """{
                            "id": 43,
                            "status": "success",
                            "outputs": [{"kind": "image", "external_url": "${server.base}/cdn/img2.png"}]
                        }"""
                    )
                }
                "/cdn/img2.png" -> FakeHttpServer.Reply(200, samplePng, contentType = "image/png")
                else -> FakeHttpServer.Reply(404, "{}")
            }
        }

        val out = backend("raw-token-abc").run(job(), null)
        assertEquals(1, out.size)
        assertArrayEquals(samplePng, out[0])
    }

    @Test
    fun `async task polling pending then running then success reports progress`() = runTest {
        var pollCount = 0
        handler = { req ->
            when {
                req.path == "/api/tasks/" -> {
                    FakeHttpServer.Reply(201, """{"id": 44, "status": "pending"}""")
                }
                req.path == "/api/tasks/44/" -> {
                    pollCount++
                    if (pollCount == 1) {
                        FakeHttpServer.Reply(200, """{"id": 44, "status": "running"}""")
                    } else {
                        FakeHttpServer.Reply(
                            200,
                            """{
                                "id": 44,
                                "status": "success",
                                "outputs": [{"kind": "image", "external_url": "${server.base}/cdn/img3.png"}]
                            }"""
                        )
                    }
                }
                req.path == "/cdn/img3.png" -> FakeHttpServer.Reply(200, samplePng, contentType = "image/png")
                else -> FakeHttpServer.Reply(404, "{}")
            }
        }

        val stages = Collections.synchronizedList(mutableListOf<String?>())
        val out = backend("token").run(job()) { p -> stages += p.stage }
        assertEquals(1, out.size)
        assertArrayEquals(samplePng, out[0])
        assertTrue("Deve haver pelo menos 2 checagens de status", pollCount >= 2)
        assertTrue(stages.any { it?.contains("Gerando no servidor") == true })
    }

    @Test
    fun `task failure returns Remote error with error_message`() = runTest {
        handler = { req ->
            when (req.path) {
                "/api/tasks/" -> FakeHttpServer.Reply(
                    201,
                    """{"id": 45, "status": "failed", "error_message": "Vast.ai sem capacidade"}"""
                )
                else -> FakeHttpServer.Reply(404, "{}")
            }
        }

        try {
            backend("token").run(job(), null)
            fail("Esperava erro Remote")
        } catch (e: AiError.Remote) {
            assertEquals(500, e.code)
            assertTrue(e.body?.contains("Vast.ai sem capacidade") == true)
        }
    }

    @Test
    fun `sync POST held by the server gives up at maxWaitMs instead of the 10 min read timeout`() = runTest {
        handler = { req ->
            if (req.path == "/api/tasks/") Thread.sleep(3_000)
            FakeHttpServer.Reply(201, """{"id": 46, "status": "processing"}""")
        }

        val started = System.nanoTime()
        try {
            backend("token", IawrapperOptions(pollMs = 20, maxWaitMs = 300)).run(job(), null)
            fail("Esperava erro Network")
        } catch (e: AiError.Network) {
            val elapsedMs = (System.nanoTime() - started) / 1_000_000
            assertTrue("desistiu em ${elapsedMs}ms", elapsedMs < 2_000)
        }
    }

    @Test
    fun `cancellation during polling triggers cancel endpoint on server`() = runTest {
        val polled = CountDownLatch(1)
        handler = { req ->
            when (req.path) {
                "/api/tasks/" -> FakeHttpServer.Reply(201, """{"id": 99, "status": "running"}""")
                "/api/tasks/99/" -> {
                    polled.countDown()
                    FakeHttpServer.Reply(200, """{"id": 99, "status": "running"}""")
                }
                "/api/tasks/99/cancel/" -> {
                    assertEquals("POST", req.method)
                    FakeHttpServer.Reply(200, """{"id": 99, "status": "cancelled"}""")
                }
                else -> FakeHttpServer.Reply(404, "{}")
            }
        }

        val b = backend("token")
        val jobCoro = launch(Dispatchers.IO) {
            b.run(job(), null)
        }

        assertTrue("Deveria iniciar o polling", polled.await(5, TimeUnit.SECONDS))
        delay(50)
        jobCoro.cancel()

        server.awaitUntil { server.paths().contains("/api/tasks/99/cancel/") }
        assertTrue("Endpoint de cancelamento deve ter sido chamado", server.paths().contains("/api/tasks/99/cancel/"))
    }

    @Test
    fun `default options dispatch async without sync and poll slowly`() = runTest {
        handler = { req ->
            when (req.path) {
                "/api/tasks/" -> {
                    assertTrue("sync não deve ir no corpo", !body(req).containsKey("sync"))
                    FakeHttpServer.Reply(201, """{"id": 101, "status": "failed", "error_message": "x"}""")
                }
                else -> FakeHttpServer.Reply(404, "{}")
            }
        }

        assertEquals(1_500L, IawrapperOptions().pollMs)
        try {
            backend("token", options = IawrapperOptions()).run(job(), null)
            fail("Esperava erro Remote")
        } catch (e: AiError.Remote) {
            assertEquals(500, e.code)
        }
    }

    @Test
    fun `sync zero-hop base64 returns image directly without polling or external download`() = runTest {
        val sampleB64 = java.util.Base64.getEncoder().encodeToString(samplePng)
        handler = { req ->
            when (req.path) {
                "/api/tasks/" -> {
                    val b = body(req)
                    assertEquals("true", b["sync"]?.jsonPrimitive?.content)
                    FakeHttpServer.Reply(
                        201,
                        """{
                            "id": 100,
                            "status": "success",
                            "outputs": [{"kind": "image", "b64_data": "$sampleB64"}]
                        }"""
                    )
                }
                else -> FakeHttpServer.Reply(404, "{}")
            }
        }

        val out = backend("token", options = IawrapperOptions(sync = true)).run(job(), null)
        assertEquals(1, out.size)
        assertArrayEquals(samplePng, out[0])
        assertEquals(listOf("/api/tasks/"), server.paths())
    }
}
