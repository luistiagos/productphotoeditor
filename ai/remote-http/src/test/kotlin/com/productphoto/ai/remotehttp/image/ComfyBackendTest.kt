package com.productphoto.ai.remotehttp.image

import com.productphoto.ai.api.AiError
import com.productphoto.ai.api.Progress
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.test.runTest
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.long
import org.junit.After
import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Assert.fail
import org.junit.Test
import java.util.Collections
import java.util.concurrent.atomic.AtomicInteger

class ComfyBackendTest {
    private val png = byteArrayOf(-119, 80, 78, 71, 1)
    private val opts = ComfyOptions(checkpoint = "sd15.safetensors")

    /** Quantos /history vazios antes do pronto, e o que o pronto contém. */
    private var emptyPolls = 2
    private var finished = """
        {"prompt": [], "outputs": {
            "9": {"images": [{"filename": "prev_0001.png", "subfolder": "", "type": "temp"}]},
            "7": {"images": [{"filename": "productphoto_00001_.png", "subfolder": "a b", "type": "output"}]}},
         "status": {"status_str": "success", "completed": true, "messages": []}}
    """.trimIndent()
    private var promptReply = 200 to """{"prompt_id": "p-1", "number": 1, "node_errors": {}}"""
    private val historyCalls = AtomicInteger()
    private val prompts = Collections.synchronizedList(mutableListOf<JsonObject>())

    private val server = FakeHttpServer { r ->
        val path = r.path
        when {
            path == "/upload/image" -> {
                val file = Regex("filename=\"([^\"]+)\"").find(r.text)!!.groupValues[1]
                FakeHttpServer.Reply(200, """{"name": "$file", "subfolder": "", "type": "input"}""")
            }
            path == "/prompt" -> {
                prompts += Json.parseToJsonElement(r.text).jsonObject
                FakeHttpServer.Reply(promptReply.first, promptReply.second)
            }
            path.startsWith("/history/") -> {
                val id = path.removePrefix("/history/")
                if (historyCalls.incrementAndGet() <= emptyPolls) FakeHttpServer.Reply(200, "{}")
                else FakeHttpServer.Reply(200, """{"$id": $finished}""")
            }
            path == "/queue" && r.method == "GET" ->
                FakeHttpServer.Reply(200, """{"queue_running": [[1, "p-1", {}, {}, []]], "queue_pending": []}""")
            path == "/queue" || path == "/interrupt" -> FakeHttpServer.Reply(200, "{}")
            path.startsWith("/view?") -> FakeHttpServer.Reply(200, png, "image/png")
            else -> FakeHttpServer.Reply(404, "{}")
        }
    }

    @After
    fun stop() = server.close()

    private fun backend(key: String? = null, workflow: JsonObject? = null, o: ComfyOptions = opts) =
        ComfyBackend(server.base, apiKey = { key }, options = o, workflow = workflow, pollMs = 10)

    private fun job(count: Int = 1, init: ByteArray? = null, mask: ByteArray? = null, seed: Long? = 5) =
        ImageJob("mug", null, 512, 512, null, seed, null, count, init = init, mask = mask)

    private fun JsonObject.input(id: String, key: String) = this["prompt"]!!.jsonObject[id]!!.jsonObject["inputs"]!!.jsonObject[key]!!

    @Test
    fun `txt2img polls history until done and downloads the output images`() = runTest {
        val seen = Collections.synchronizedList(mutableListOf<Progress>())
        val out = backend(key = "proxy-key").run(job(count = 1), { seen += it })
        assertEquals(1, out.size)
        assertArrayEquals(png, out[0])
        assertEquals(3, historyCalls.get())
        val view = server.received.single { it.path.startsWith("/view?") }
        assertEquals("/view?filename=productphoto_00001_.png&subfolder=a+b&type=output", view.path)
        assertTrue(server.received.all { it.headers["authorization"] == "Bearer proxy-key" })
        assertEquals(5L, prompts.single().input("5", "seed").jsonPrimitive.long)
        assertTrue(prompts.single()["client_id"]!!.jsonPrimitive.content.isNotBlank())
        assertTrue(seen.any { it.stage == "Gerando no servidor" })
    }

    @Test
    fun `uploaded names go into LoadImage and LoadImageMask, one run per img2img image`() = runTest {
        emptyPolls = 0
        val out = backend().run(job(count = 2, init = png, mask = png), null)
        assertEquals(2, out.size)
        val uploads = server.received.filter { it.path == "/upload/image" }
        assertEquals(2, uploads.size)
        val up = uploads.first().text
        assertTrue(up, up.contains("name=\"image\"; filename=\"pp-") && up.contains("Content-Type: image/png"))
        assertTrue(up.contains("name=\"overwrite\"\r\n\r\ntrue") && up.contains("name=\"type\"\r\n\r\ninput"))
        assertTrue(uploads.first().headers["content-type"]!!.startsWith("multipart/form-data; boundary="))
        val names = uploads.map { Regex("filename=\"([^\"]+)\"").find(it.text)!!.groupValues[1] }
        assertEquals(2, prompts.size)
        assertEquals(setOf(names[0]), prompts.map { it.input("10", "image").jsonPrimitive.content }.toSet())
        assertEquals(names[1], prompts[0].input("12", "image").jsonPrimitive.content)
        assertEquals(listOf(5L, 6L), prompts.map { it.input("5", "seed").jsonPrimitive.long })
    }

    @Test
    fun `execution error is Remote with the exception message`() = runTest {
        emptyPolls = 0
        finished = """{"outputs": {}, "status": {"status_str": "error", "completed": false, "messages": [
            ["execution_start", {}], ["execution_error", {"node_type": "KSampler", "exception_message": "CUDA out of memory"}]]}}"""
        try {
            backend().run(job(), null)
            fail()
        } catch (e: AiError.Remote) {
            assertEquals(500, e.code)
            assertEquals("KSampler: CUDA out of memory", e.body)
        }
    }

    @Test
    fun `rejected prompt is Remote 400 with the node errors`() = runTest {
        promptReply = 400 to """{"error": {"type": "prompt_outputs_failed_validation", "message": "Prompt outputs failed validation", "details": ""},
            "node_errors": {"1": {"errors": [{"type": "value_not_in_list", "message": "Value not in list",
            "details": "ckpt_name: 'sd15.safetensors' not in []"}], "class_type": "CheckpointLoaderSimple"}}}"""
        try {
            backend().run(job(), null)
            fail()
        } catch (e: AiError.Remote) {
            assertEquals(400, e.code)
            assertTrue(e.body, e.body!!.startsWith("Prompt outputs failed validation; CheckpointLoaderSimple: Value not in list"))
            assertTrue(e.body!!.contains("not in []"))
        }
        assertTrue(server.paths().none { it.startsWith("/history") })
    }

    @Test
    fun `no checkpoint is Unsupported before uploading`() = runTest {
        try {
            backend(o = opts.copy(checkpoint = null)).run(job(init = png), null)
            fail()
        } catch (_: AiError.Unsupported) {
        }
        assertTrue(server.received.isEmpty())
    }

    @Test
    fun `cancel removes from the queue and interrupts the prompt`() = runTest {
        emptyPolls = Int.MAX_VALUE
        val running = launch(Dispatchers.IO) { backend().run(job(), null) }
        server.awaitUntil { historyCalls.get() >= 2 }
        running.cancel()
        server.awaitUntil { "/interrupt" in server.paths() }
        running.join()
        val delete = server.received.single { it.path == "/queue" && it.method == "POST" }
        assertEquals("p-1", Json.parseToJsonElement(delete.text).jsonObject["delete"]!!.jsonArray.single().jsonPrimitive.content)
        val interrupt = server.received.single { it.path == "/interrupt" }
        assertEquals("p-1", Json.parseToJsonElement(interrupt.text).jsonObject["prompt_id"]!!.jsonPrimitive.content)
    }
}
