package com.productphoto.editor

import android.content.Context
import android.graphics.Bitmap
import android.graphics.Color
import android.net.Uri
import android.webkit.WebView
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import com.productphoto.ai.api.AiError
import com.productphoto.ai.api.BackgroundRemover
import com.productphoto.ai.api.Inpainter
import com.productphoto.ai.api.Mask
import com.productphoto.ai.api.ProgressSink
import com.productphoto.ai.api.RgbaImage
import com.productphoto.ai.api.TextBlock
import com.productphoto.ai.api.TextDetector
import com.productphoto.ai.api.TextGenerator
import com.productphoto.ai.api.TextRequest
import com.productphoto.ai.api.VectorizeOptions
import com.productphoto.ai.api.Vectorizer
import com.productphoto.data.FileBrandKitRepository
import com.productphoto.data.FileDraftRepository
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.delay
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.withContext
import kotlinx.coroutines.withTimeout
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.int
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.put
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import java.io.File

/**
 * Ponte real (WebView + página dos assets + addWebMessageListener) com provedores falsos:
 * mensagem → resposta nos dois sentidos, erro tipado, exportação e rascunho (ARQUITETURA §15.4).
 */
@RunWith(AndroidJUnit4::class)
class EditorBridgeInstrumentedTest {
    private val context: Context = InstrumentationRegistry.getInstrumentation().targetContext
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main)
    private lateinit var webView: WebView
    private lateinit var session: EditorSession
    private lateinit var dir: File
    private val removeBgCalls = mutableListOf<Pair<Int, Int>>()

    private val fakeRemover = object : BackgroundRemover {
        override suspend fun removeBackground(image: RgbaImage, progress: ProgressSink?): Mask {
            removeBgCalls += image.width to image.height
            // metade esquerda = objeto
            val a = ByteArray(image.width * image.height) { i -> if (i % image.width < image.width / 2) -1 else 0 }
            return Mask(image.width, image.height, a)
        }
    }
    private val failingInpainter = object : Inpainter {
        override suspend fun inpaint(image: RgbaImage, mask: Mask, progress: ProgressSink?): RgbaImage =
            throw AiError.Unavailable(emptyList())
    }
    private val noText = object : TextDetector { override suspend fun detect(image: RgbaImage): List<TextBlock> = emptyList() }
    private val fakeVectorizer = object : Vectorizer {
        override suspend fun toSvg(image: RgbaImage, options: VectorizeOptions) =
            """<svg xmlns="http://www.w3.org/2000/svg" width="${image.width}" height="${image.height}"><rect width="10" height="10" fill="#f00"/></svg>"""
    }
    private val exported = mutableListOf<Pair<ExportFormat, ByteArray>>()
    private val textRequests = mutableListOf<TextRequest>()
    /** 1ª resposta fora do schema (força o retry), depois variantes com repetição. */
    private val fakeText = object : TextGenerator {
        override suspend fun generate(req: TextRequest): String {
            textRequests += req
            return if (textRequests.size == 1) "não sei" else """```json
                {"variants": ["Oferta imperdível", "Só hoje!", "Oferta imperdível"]}
                ```"""
        }
    }

    @Before
    fun setUp() = runBlocking(Dispatchers.Main) {
        dir = File(context.cacheDir, "bridge-test-${System.nanoTime()}").apply { mkdirs() }
        session = EditorSession(
            context, scope, EditorAssets(context),
            EditorAi(fakeRemover, failingInpainter, noText, fakeVectorizer, servedBy = { "fake" }, textGenerator = fakeText),
            FileDraftRepository(File(dir, "drafts")), FileBrandKitRepository(File(dir, "brandkit.json")),
            EditorStart.New("Teste", 400, 300),
            host = object : EditorHost {
                override suspend fun pickImage(): Uri? = null
                override suspend fun pickFont(): Uri? = null
                override suspend fun export(format: ExportFormat, action: ExportAction, name: String, bytes: ByteArray): String {
                    exported += format to bytes
                    return "test/$name"
                }
            },
        )
        webView = WebView(context)
        session.attach(webView)
        waitJs("document.body.dataset.ready === 'true'", 30_000)
    }

    @After
    fun tearDown() = runBlocking(Dispatchers.Main) {
        webView.destroy()
        scope.cancel()
        dir.deleteRecursively()
        Unit
    }

    private suspend fun js(expr: String): String = withContext(Dispatchers.Main) {
        val d = CompletableDeferred<String>()
        webView.evaluateJavascript(expr) { d.complete(it) }
        d.await()
    }

    private suspend fun waitJs(cond: String, timeoutMs: Long = 15_000) = withTimeout(timeoutMs) {
        while (js("Boolean($cond)") != "true") delay(100)
    }

    private fun doc(objects: String) =
        EditorProtocol.json.parseToJsonElement(
            """{"format":"pp-editor","version":1,"name":"Doc","width":400,"height":300,"fabric":{"background":"#ffffff","objects":[$objects]}}""",
        )

    private val twoObjects = """{"type":"Rect","left":100,"top":150,"width":200,"height":300,"fill":"#ff0000","brandColor":"primary"},""" +
        """{"type":"Textbox","left":300,"top":150,"width":160,"text":"Oi","fontSize":40,"fill":"#000000"}"""

    private fun maskDataUrl(w: Int, h: Int): String {
        val bmp = Bitmap.createBitmap(w, h, Bitmap.Config.ARGB_8888).apply { eraseColor(Color.TRANSPARENT); setPixel(w / 2, h / 2, Color.WHITE) }
        val out = java.io.ByteArrayOutputStream().also { bmp.compress(Bitmap.CompressFormat.PNG, 100, it) }
        return "data:image/png;base64," + android.util.Base64.encodeToString(out.toByteArray(), android.util.Base64.NO_WRAP)
    }

    @Test
    fun kotlinRequestsGetJsReplies() = runBlocking {
        val loaded = withTimeout(10_000) { session.bridge.request("loadProject", buildJsonObject { put("document", doc(twoObjects)) }) }!!.jsonObject
        assertEquals(2, loaded["objects"]!!.jsonPrimitive.int)
        assertEquals(400, loaded["width"]!!.jsonPrimitive.int)

        val back = session.bridge.request("getDocument")!!.jsonObject
        assertEquals("pp-editor", back["format"]!!.jsonPrimitive.content)
        val objs = back["fabric"]!!.jsonObject["objects"]!!.jsonArray
        assertEquals(listOf("Rect", "Textbox"), objs.map { it.jsonObject["type"]!!.jsonPrimitive.content })
        assertEquals("primary", objs[0].jsonObject["brandColor"]!!.jsonPrimitive.content) // propriedade própria sobrevive

        // pedido sem handler no JS → erro tipado
        val err = runCatching { session.bridge.request("nope") }.exceptionOrNull()
        assertEquals(ErrorCode.UNSUPPORTED, (err as BridgeException).code)
    }

    @Test
    fun exportsPngAndPortableSvg() = runBlocking {
        session.bridge.request("loadProject", buildJsonObject { put("document", doc(twoObjects)) })
        val png = session.bridge.request("exportImage", buildJsonObject { put("format", "png"); put("scale", 2) })!!
            .jsonObject["data"]!!.jsonPrimitive.content
        val bmp = EditorAssets.decodeBytes(EditorAssets.dataUrlBytes(png))
        assertEquals(800 to 600, bmp.width to bmp.height)
        assertEquals(Color.RED, bmp.getPixel(200, 300)) // centro do retângulo (100,150) × 2
        assertEquals(Color.WHITE, bmp.getPixel(780, 20)) // fundo

        val photo = Bitmap.createBitmap(64, 48, Bitmap.Config.ARGB_8888).apply { eraseColor(Color.BLUE) }
        val url = session.assets.blobUrl(session.assets.putPng(photo))
        session.bridge.request("insertImage", buildJsonObject { put("url", url) })
        val svg = session.bridge.request("exportImage", buildJsonObject { put("format", "svg") })!!.jsonObject["data"]!!.jsonPrimitive.content
        assertTrue(svg.startsWith("<?xml") || svg.contains("<svg"))
        assertTrue(svg.contains("viewBox=\"0 0 400 300\""))
        assertFalse("imagem não embutida", svg.contains("appassets.androidplatform.net"))
        assertTrue(svg.contains("data:image/png;base64,"))
    }

    @Test
    fun jsRequestsReachKotlinAndResultsComeBack() = runBlocking {
        val photo = Bitmap.createBitmap(120, 80, Bitmap.Config.ARGB_8888).apply { eraseColor(Color.GREEN) }
        val url = session.assets.blobUrl(session.assets.putPng(photo))
        session.bridge.request("insertImage", buildJsonObject { put("url", url) })

        // fluxo da interface: botão "Remover fundo" → ai.removeBg → setSrc com a URL nova
        js("ppEditor.removeBgOfFirstImage()")
        waitJs("ppEditor.editor.canvas.getObjects().some(o => o.type === 'image' && o.getSrc().includes('/blob/ai-'))")
        assertEquals(listOf(120 to 80), removeBgCalls)
        val doc = session.bridge.request("getDocument")!!.jsonObject
        val img = doc["fabric"]!!.jsonObject["objects"]!!.jsonArray.map { it.jsonObject }.first { it["type"]!!.jsonPrimitive.content == "Image" }
        val newName = Uri.parse(img["src"]!!.jsonPrimitive.content).lastPathSegment!!
        val out = EditorAssets.decodeBytes(session.assets.blobFile(newName)!!.readBytes())
        assertEquals(Color.GREEN, out.getPixel(10, 40)) // metade esquerda = objeto
        assertEquals(0, Color.alpha(out.getPixel(110, 40))) // metade direita = fundo removido

        // erro tipado da IA chega ao JS com o código
        js("ppEditor.call('ai.inpaint', {src: '$url', mask: '${maskDataUrl(120, 80)}'})")
        waitJs("ppEditor.last !== null")
        assertEquals("\"unavailable\"", js("ppEditor.last.code"))
        // máscara que não decodifica → invalid (não chega ao provedor)
        js("ppEditor.call('ai.inpaint', {src: '$url', mask: 'data:image/png;base64,iVBORw0KGgo='})")
        waitJs("ppEditor.last !== null")
        assertEquals("\"invalid\"", js("ppEditor.last.code"))

        // vetorizar devolve o SVG do provedor
        js("ppEditor.call('ai.vectorize', {src: '$url', colorMode: 'color'})")
        waitJs("ppEditor.last !== null")
        assertTrue(js("ppEditor.last.payload.svg").contains("width=\\\"120\\\""))
    }

    @Test
    fun rewriteTextFromTheTextPanel() = runBlocking {
        session.bridge.request("loadProject", buildJsonObject { put("document", doc(twoObjects)) })
        // fluxo da interface: seleciona o texto → "✨ Reescrever" → estilo → 1ª variante substitui o texto
        js("ppEditor.rewriteFirstText('persuasive')")
        waitJs("ppEditor.editor.canvas.getObjects().some(o => o.text === 'Oferta imperdível')")
        assertEquals(2, textRequests.size) // 1 retry depois da resposta sem JSON
        assertTrue(textRequests[0].prompt.contains("\"\"\"\nOi\n\"\"\""))
        assertTrue(textRequests[1].prompt.contains("rejected"))
        // evaluateJavascript já devolve o valor em JSON (§15.5): o array vem direto, repetição removida
        assertEquals("[\"Oferta imperdível\",\"Só hoje!\"]", js("ppEditor.lastVariants"))

        // estilo desconhecido → invalid, sem chegar ao provedor
        js("ppEditor.call('ai.rewriteText', {text: 'x', style: 'shout'})")
        waitJs("ppEditor.last !== null")
        assertEquals("\"invalid\"", js("ppEditor.last.code"))
        assertEquals(2, textRequests.size)
    }

    @Test
    fun flushSavesDraftAndExportGoesToHost() = runBlocking {
        session.bridge.request("loadProject", buildJsonObject { put("document", doc(twoObjects)) })
        js("ppEditor.editor.addShape('circle', '#00ff00')")
        val flushed = withTimeout(10_000) { session.bridge.request("flush") }!!.jsonObject
        val id = flushed["draftId"]!!.jsonPrimitive.content
        assertEquals(id, session.draftId)
        val saved = FileDraftRepository(File(dir, "drafts")).load(id)
        assertNotNull(saved)
        assertTrue(saved!!.contains("\"Circle\""))
        assertTrue(File(dir, "drafts/$id.jpg").length() > 0) // miniatura

        js("ppEditor.editor.exportRaster('png', 1, 1).then(d => ppEditor.call('export', {format: 'png', action: 'save', name: 'x', data: d}))")
        waitJs("ppEditor.last !== null")
        assertEquals("true", js("ppEditor.last.ok"))
        assertEquals(ExportFormat.PNG, exported.single().first)
        assertEquals(400, EditorAssets.decodeBytes(exported.single().second).width)
        // evaluateJavascript devolve o valor codificado em JSON: a string do stringify vem entre aspas
        val raw = EditorProtocol.json.parseToJsonElement(js("JSON.stringify(ppEditor.last.payload)")).jsonPrimitive.content
        val loc = EditorProtocol.json.parseToJsonElement(raw) as JsonObject
        assertTrue(loc["location"]!!.jsonPrimitive.content.startsWith("test/x_"))
    }
}
