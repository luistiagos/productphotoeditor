package com.productphoto.ai.remotehttp

import com.productphoto.ai.api.AiError
import com.productphoto.ai.api.StructuredText
import com.productphoto.ai.api.TextRequest
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.buildJsonArray
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.put
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Assert.fail
import org.junit.Before
import org.junit.Test
import java.io.IOException
import java.net.InetAddress
import java.net.ServerSocket
import java.net.Socket
import java.util.Collections
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import kotlin.concurrent.thread

private const val CRLF = "\r\n"

/** Servidor falso de chat-completions (ServerSocket, como o ModelDownloaderTest; ARQUITETURA §17.5/§18.4). */
class OpenAiCompatibleTest {
    private class Received(val path: String, val headers: Map<String, String>, val body: String)

    private lateinit var server: ServerSocket
    private val received = Collections.synchronizedList(mutableListOf<Received>())
    /** Respostas na ordem: status + corpo. */
    private val replies = ArrayDeque<Pair<Int, String>>()
    /** Se presente, o servidor espera este latch (até 10 s) antes de responder. */
    @Volatile private var hold: CountDownLatch? = null
    @Volatile private var answered = false
    private val base get() = "http://127.0.0.1:${server.localPort}/v1/"

    @Before
    fun start() {
        server = ServerSocket(0, 50, InetAddress.getLoopbackAddress())
        thread(isDaemon = true) {
            while (!server.isClosed) {
                val socket = try { server.accept() } catch (_: Exception) { break }
                socket.use { serve(it) }
            }
        }
    }

    @After
    fun stop() = server.close()

    private fun serve(socket: Socket) {
        val input = socket.getInputStream()
        // lê o cabeçalho byte a byte (o corpo vem logo depois, com Content-Length)
        val head = StringBuilder()
        while (!head.endsWith("$CRLF$CRLF")) {
            val b = input.read()
            if (b < 0) return
            head.append(b.toChar())
        }
        val lines = head.split(CRLF).filter { it.isNotEmpty() }
        val path = lines[0].split(" ")[1]
        val headers = lines.drop(1).associate { it.substringBefore(":").trim().lowercase() to it.substringAfter(":").trim() }
        val length = headers["content-length"]?.toInt() ?: 0
        val body = ByteArray(length).also { var n = 0; while (n < length) n += input.read(it, n, length - n) }
        received += Received(path, headers, body.decodeToString())
        val (status, reply) = synchronized(replies) { replies.removeFirstOrNull() } ?: (500 to "{}")
        val bytes = reply.toByteArray()
        hold?.await(10, TimeUnit.SECONDS)
        answered = true
        try {
            socket.getOutputStream().apply {
                write(("HTTP/1.1 $status X${CRLF}Content-Type: application/json${CRLF}Content-Length: ${bytes.size}$CRLF" +
                    "Connection: close$CRLF$CRLF").toByteArray())
                write(bytes)
                flush()
            }
        } catch (_: IOException) {
            // o cliente já desconectou (teste de cancelamento)
        }
    }

    private fun chat(content: String) = buildJsonObject {
        put("id", "x")
        put("choices", buildJsonArray { add(buildJsonObject { put("index", 0); put("message", buildJsonObject { put("role", "assistant"); put("content", content) }) }) })
    }.toString()

    private fun gen(key: String? = null) = OpenAiCompatibleTextGenerator(base, "qwen3:8b", apiKey = { key })

    @Test
    fun `sends model, messages and bearer key and returns the content`() = runTest {
        replies += 200 to chat("<think>pensando</think>Olá, mundo")
        val out = gen("sk-test").generate(TextRequest(system = "Seja breve.", prompt = "Diga oi", maxTokens = 64, temperature = 0.2f))
        assertEquals("Olá, mundo", out)
        val r = received.single()
        assertEquals("/v1/chat/completions", r.path)
        assertEquals("Bearer sk-test", r.headers["authorization"])
        val body = Json.parseToJsonElement(r.body).jsonObject
        assertEquals("qwen3:8b", body["model"]!!.jsonPrimitive.content)
        assertEquals(64, body["max_tokens"]!!.jsonPrimitive.content.toInt())
        val msgs = body["messages"]!!.jsonArray.map { it.jsonObject }
        assertEquals(listOf("system", "user"), msgs.map { it["role"]!!.jsonPrimitive.content })
        assertEquals("Diga oi", msgs[1]["content"]!!.jsonPrimitive.content)
        assertNull(body["response_format"])
    }

    @Test
    fun `no key means no Authorization header`() = runTest {
        replies += 200 to chat("ok")
        gen(null).generate(TextRequest(system = null, prompt = "x"))
        assertNull(received.single().headers["authorization"])
        assertEquals(1, Json.parseToJsonElement(received.single().body).jsonObject["messages"]!!.jsonArray.size)
    }

    @Test
    fun `http error is Remote with the body`() = runTest {
        replies += 429 to """{"error":"slow down"}"""
        // 401: o HttpURLConnection do JDK em modo streaming descarta o corpo (HttpRetryException interno); só o código conta
        replies += 401 to """{"error":"bad key"}"""
        for ((code, text) in listOf(429 to "slow down", 401 to null)) {
            try {
                gen("k").generate(TextRequest(system = null, prompt = "x"))
                fail()
            } catch (e: AiError.Remote) {
                assertEquals(code, e.code)
                text?.let { assertTrue(e.body!!.contains(it)) }
                assertTrue(!e.isFallbackable)
            }
        }
    }

    @Test
    fun `connection refused is Network`() = runTest {
        val dead = ServerSocket(0, 1, InetAddress.getLoopbackAddress()).run { val p = localPort; close(); p }
        try {
            OpenAiCompatibleTextGenerator("http://127.0.0.1:$dead/v1", "m", apiKey = { null })
                .generate(TextRequest(system = null, prompt = "x"))
            fail()
        } catch (e: AiError.Network) {
            assertTrue(e.isFallbackable)
        }
    }

    @Test
    fun `cancel drops the connection before the server answers`() = runTest {
        val release = CountDownLatch(1)
        hold = release
        replies += 200 to chat("tarde demais")
        try {
            val running = launch(Dispatchers.IO) { gen().generate(TextRequest(system = null, prompt = "x")) }
            withContext(Dispatchers.IO) {
                val deadline = System.currentTimeMillis() + 5_000
                while (received.isEmpty() && System.currentTimeMillis() < deadline) Thread.sleep(10)
            }
            assertEquals(1, received.size)
            running.cancel()
            running.join()
            assertTrue(running.isCancelled)
            // antes da correção, generate só saía depois de o servidor responder (aqui, 10 s depois)
            assertFalse("generate esperou a resposta do servidor", answered)
        } finally {
            release.countDown()
        }
    }

    @Test
    fun `body without choices is InvalidOutput`() = runTest {
        replies += 200 to """{"object":"error"}"""
        try {
            gen().generate(TextRequest(system = null, prompt = "x"))
            fail()
        } catch (_: AiError.InvalidOutput) {
        }
    }

    @Test
    fun `structured request asks for json_object and retries once on invalid JSON`() = runTest {
        val schema = """{"type":"object","required":["variants"],"properties":{"variants":{"type":"array","minItems":2,"items":{"type":"string"}}}}"""
        replies += 200 to chat("""Aqui está: {"variants": ["só uma"]}""")
        replies += 200 to chat("```json\n{\"variants\": [\"Promoção imperdível\", \"Só hoje\"]}\n```")
        val out = StructuredText.generate(gen(), TextRequest(system = "Reescreva.", prompt = "promoção", jsonSchema = schema))
        assertEquals(listOf("Promoção imperdível", "Só hoje"), out.jsonObject["variants"]!!.jsonArray.map { it.jsonPrimitive.content })
        assertEquals(2, received.size)
        val first = Json.parseToJsonElement(received[0].body) as JsonObject
        assertEquals("json_object", first["response_format"]!!.jsonObject["type"]!!.jsonPrimitive.content)
        assertTrue(first["messages"]!!.jsonArray[0].jsonObject["content"]!!.jsonPrimitive.content.contains("""{"variants":["...","..."]}"""))
        val retryPrompt = Json.parseToJsonElement(received[1].body).jsonObject["messages"]!!.jsonArray[1].jsonObject["content"]!!.jsonPrimitive.content
        assertTrue(retryPrompt, retryPrompt.contains("needs at least 2 items"))
    }
}
