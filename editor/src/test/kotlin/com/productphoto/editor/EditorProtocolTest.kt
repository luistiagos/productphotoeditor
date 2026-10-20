package com.productphoto.editor

import com.productphoto.ai.api.AiError
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitCancellation
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.TestScope
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.runTest
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.put
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Assert.fail
import org.junit.Test

class EditorProtocolTest {

    @Test
    fun `parses what editor-web sends`() {
        // mesmas strings que editor-web/src/protocol.ts gera (JSON.stringify)
        val req = EditorProtocol.parse("""{"v":1,"id":"js-1","type":"ai.removeBg","payload":{"src":"u"}}""")
        assertEquals(EditorProtocol.Request("js-1", "ai.removeBg", buildJsonObject { put("src", "u") }), req)
        val ok = EditorProtocol.parse("""{"v":1,"id":"kt-1","type":"result","ok":true,"payload":{"objects":3}}""") as EditorProtocol.Result
        assertTrue(ok.ok)
        val err = EditorProtocol.parse("""{"v":1,"id":"kt-2","type":"result","ok":false,"error":{"code":"network","message":"x"}}""") as EditorProtocol.Result
        assertEquals(ErrorCode.NETWORK, err.error!!.code)
        val pr = EditorProtocol.parse("""{"v":1,"id":"kt-3","type":"progress","payload":{"fraction":null,"stage":"s"}}""")
        assertEquals(EditorProtocol.ProgressMsg("kt-3", null, "s"), pr)
        assertEquals(EditorProtocol.Cancel("js-4"), EditorProtocol.parse("""{"v":1,"id":"js-4","type":"cancel"}"""))
        assertEquals(EditorProtocol.Cancel("js-4"), EditorProtocol.parse(EditorProtocol.cancel("js-4")))
    }

    @Test
    fun `cancel stops the running handler and the request ends cancelled`() = runTest {
        val scope = TestScope(StandardTestDispatcher(testScheduler))
        val sent = mutableListOf<String>()
        val kt = EditorBridge(scope) { sent += it }
        var stopped = false
        kt.handle("ai.upscale") { _, _ ->
            try {
                awaitCancellation()
            } finally {
                stopped = true
            }
        }
        kt.receive(EditorProtocol.request("js-1", "ai.upscale", null))
        advanceUntilIdle()
        assertTrue(sent.isEmpty())

        kt.receive(EditorProtocol.cancel("js-1"))
        advanceUntilIdle()
        assertTrue(stopped)
        val r = EditorProtocol.parse(sent.single()) as EditorProtocol.Result
        assertEquals("js-1", r.id)
        assertEquals(ErrorCode.CANCELLED, r.error!!.code)

        // pedido já terminado ou desconhecido: nada a responder
        kt.receive(EditorProtocol.cancel("js-1"))
        kt.receive(EditorProtocol.cancel("js-404"))
        advanceUntilIdle()
        assertEquals(1, sent.size)
    }

    @Test
    fun `rejects malformed messages`() {
        for (raw in listOf("x", "[]", """{"v":2,"id":"a","type":"t"}""", """{"v":1,"type":"t"}""", """{"v":1,"id":"a"}""",
            """{"v":1,"id":"a","type":"result"}""", """{"v":1,"id":"a","type":"result","ok":false}""",
            """{"v":1,"id":"a","type":"progress","payload":{}}""")) {
            try {
                EditorProtocol.parse(raw)
                fail("accepted $raw")
            } catch (e: EditorProtocol.ProtocolException) {
                // esperado
            }
        }
    }

    @Test
    fun `encoded messages round-trip`() {
        val e = BridgeException(ErrorCode.UNAVAILABLE, "sem provedor")
        val back = EditorProtocol.parse(EditorProtocol.fail("a", e)) as EditorProtocol.Result
        assertEquals(ErrorCode.UNAVAILABLE, back.error!!.code)
        assertEquals("sem provedor", back.error!!.message)
        val p = EditorProtocol.parse(EditorProtocol.progress("a", 0.5, "x")) as EditorProtocol.ProgressMsg
        assertEquals(0.5, p.fraction!!, 1e-9)
    }

    @Test
    fun `AiError maps to bridge codes`() {
        assertEquals(ErrorCode.UNAVAILABLE, BridgeException.from(AiError.Unavailable(emptyList())).code)
        assertEquals(ErrorCode.NETWORK, BridgeException.from(AiError.Network(RuntimeException())).code)
        assertEquals(ErrorCode.REMOTE, BridgeException.from(AiError.Remote(500, null)).code)
        assertEquals(ErrorCode.INVALID, BridgeException.from(AiError.InvalidOutput("x")).code)
        assertEquals(ErrorCode.UNSUPPORTED, BridgeException.from(AiError.Unsupported("x")).code)
        assertEquals(ErrorCode.INTERNAL, BridgeException.from(IllegalStateException("x")).code)
    }

    @Test
    fun `request, progress and typed errors between two bridges`() = runTest {
        val scope = TestScope(StandardTestDispatcher(testScheduler))
        lateinit var kt: EditorBridge
        lateinit var js: EditorBridge
        kt = EditorBridge(scope) { m -> scope.async { js.receive(m) } }
        js = EditorBridge(scope) { m -> scope.async { kt.receive(m) } }
        kt.handle("ai.vectorize") { p, progress ->
            progress(0.5, "traçando")
            buildJsonObject { put("svg", "<svg>" + p.obj().str("src") + "</svg>") }
        }
        kt.handle("ai.inpaint") { _, _ -> throw AiError.Unavailable(emptyList()) }

        val seen = mutableListOf<Pair<Double?, String>>()
        val r = scope.async { js.request("ai.vectorize", buildJsonObject { put("src", "u") }) { f, s -> seen += f to s } }
        val e = scope.async { runCatching { js.request("ai.inpaint") }.exceptionOrNull() }
        val missing = scope.async { runCatching { js.request("ai.nope") }.exceptionOrNull() }
        advanceUntilIdle()
        assertEquals(JsonPrimitive("<svg>u</svg>"), r.await()!!.jsonObject["svg"])
        assertEquals(listOf<Pair<Double?, String>>(0.5 to "traçando"), seen)
        assertEquals(ErrorCode.UNAVAILABLE, (e.await() as BridgeException).code)
        assertEquals(ErrorCode.UNSUPPORTED, (missing.await() as BridgeException).code)
        assertEquals("u", r.await()!!.jsonObject["svg"]!!.jsonPrimitive.content.removePrefix("<svg>").removeSuffix("</svg>"))
    }

    @Test
    fun `mask from alpha resizes nearest and thresholds at alpha above zero`() {
        val px = intArrayOf(0x00FFFFFF, 0x01000000, 0, 0xFF000000.toInt()) // 2x2
        val m = maskFromArgb(px, 2, 2, 4, 4)
        val row0 = (0 until 4).map { m.alpha[it].toInt() and 0xFF }
        val row3 = (12 until 16).map { m.alpha[it].toInt() and 0xFF }
        assertEquals(listOf(0, 0, 255, 255), row0)
        assertEquals(listOf(0, 0, 255, 255), row3)
    }

    @Test
    fun `font signature and names`() {
        assertEquals("ttf", EditorSession.fontExtension(byteArrayOf(0, 1, 0, 0, 9)))
        assertEquals("otf", EditorSession.fontExtension("OTTOxx".toByteArray()))
        assertEquals("woff2", EditorSession.fontExtension("wOF2xx".toByteArray()))
        assertEquals(null, EditorSession.fontExtension("<svg".toByteArray()))
        assertEquals("Minha_Fonte_Bold", EditorSession.fontFamilyFromFileName("Minha Fonte (Bold).ttf"))
        assertEquals("Fonte", EditorSession.fontFamilyFromFileName("../.ttf"))
    }

    @Test
    fun `export format supports mp4 and video bundle deserialization`() {
        assertEquals(ExportFormat.MP4, ExportFormat.of("mp4"))
        assertEquals("video/mp4", ExportFormat.MP4.mime)

        val jsonStr = """
            {
                "name": "meu_produto",
                "width": 1080,
                "height": 1080,
                "duration": 5.0,
                "fps": 30,
                "ffmpegCommand": "ffmpeg -i l0.png output.mp4",
                "files": {
                    "l0.png": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
                }
            }
        """.trimIndent()

        val json = kotlinx.serialization.json.Json { ignoreUnknownKeys = true }
        val bundle = json.decodeFromString<VideoBundle>(jsonStr)
        assertEquals("meu_produto", bundle.name)
        assertEquals(1080, bundle.width)
        assertEquals(1080, bundle.height)
        assertEquals(5.0, bundle.duration, 1e-6)
        assertEquals(30, bundle.fps)
        assertEquals("ffmpeg -i l0.png output.mp4", bundle.ffmpegCommand)
        assertEquals(1, bundle.files.size)
        assertTrue(bundle.files.containsKey("l0.png"))
    }
}
