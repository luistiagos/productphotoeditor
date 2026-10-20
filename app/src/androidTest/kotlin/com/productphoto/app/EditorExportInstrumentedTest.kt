package com.productphoto.app

import android.content.Context
import android.provider.MediaStore
import android.webkit.WebView
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import com.productphoto.data.BrandColors
import com.productphoto.data.BrandKit
import com.productphoto.data.CompanyProfile
import com.productphoto.data.FileBrandKitRepository
import com.productphoto.data.FileDraftRepository
import com.productphoto.editor.EditorAssets
import com.productphoto.editor.EditorExports
import com.productphoto.editor.EditorProtocol
import com.productphoto.editor.EditorSession
import com.productphoto.editor.EditorStart
import com.productphoto.editor.ExportFormat
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.delay
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.withContext
import kotlinx.coroutines.withTimeout
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.put
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import java.io.File

/** Editor com o conteúdo real do APK: template + brand kit → exportar PNG e SVG (ARQUITETURA §10, fase 4). */
@RunWith(AndroidJUnit4::class)
class EditorExportInstrumentedTest {
    private val context: Context = InstrumentationRegistry.getInstrumentation().targetContext
    private val graph = (context.applicationContext as ProductPhotoApp).graph
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main)
    private val dir = File(context.cacheDir, "export-test-${System.nanoTime()}").apply { mkdirs() }
    private lateinit var webView: WebView

    @After
    fun tearDown() = runBlocking(Dispatchers.Main) {
        if (::webView.isInitialized) webView.destroy()
        scope.cancel()
        dir.deleteRecursively()
        Unit
    }

    private suspend fun js(expr: String): String = withContext(Dispatchers.Main) {
        val d = CompletableDeferred<String>()
        webView.evaluateJavascript(expr) { d.complete(it) }
        d.await()
    }

    @Test
    fun templateWithBrandKitExportsPngAndSvg() = runBlocking {
        val kits = FileBrandKitRepository(File(dir, "brandkit.json"))
        kits.save(BrandKit(profile = CompanyProfile(company = "Doces da Ana", phone = "(11) 90000-0000"),
            colors = BrandColors(primary = "#D81B60")))
        val session = EditorSession(context, scope, graph.editorAssets, graph.editorAi, FileDraftRepository(File(dir, "drafts")),
            kits, EditorStart.Template("promo-quadrado"))
        withContext(Dispatchers.Main) {
            webView = WebView(context)
            session.attach(webView)
        }
        withTimeout(30_000) { while (js("document.body.dataset.ready === 'true'") != "true") delay(100) }

        // template aplicado com o brand kit: variável preenchida e cor do papel "primary"
        val doc = session.bridge.request("getDocument")!!.jsonObject
        val objs = doc["fabric"]!!.jsonObject["objects"]!!.jsonArray.map { it.jsonObject }
        assertTrue(objs.any { it["text"]?.jsonPrimitive?.content == "Doces da Ana" })
        assertEquals("#D81B60", objs.first { it["brandColor"]?.jsonPrimitive?.content == "primary" }["fill"]!!.jsonPrimitive.content)

        // as fontes servidas como text/plain pelo WebViewAssetLoader carregam mesmo assim (§15.1)
        assertEquals("true", js("document.fonts.check('40px \"Bebas Neue\"') && document.fonts.check('40px Anton')"))
        assertEquals("\"loaded\"", js("[...document.fonts].find(f => f.family.replace(/\"/g,'') === 'Bebas Neue').status"))

        val png = session.bridge.request("exportImage", buildJsonObject { put("format", "png"); put("scale", 1) })!!
            .jsonObject["data"]!!.jsonPrimitive.content
        val pngBytes = EditorAssets.dataUrlBytes(png)
        val bmp = EditorAssets.decodeBytes(pngBytes)
        assertEquals(1080 to 1080, bmp.width to bmp.height)

        val svg = session.bridge.request("exportImage", buildJsonObject { put("format", "svg") })!!
            .jsonObject["data"]!!.jsonPrimitive.content
        assertTrue("fonte embutida", svg.contains("@font-face") && svg.contains("data:font/ttf;base64,"))
        assertTrue(!svg.contains("appassets.androidplatform.net"))
        val parser = android.util.Xml.newPullParser().apply { setInput(svg.reader()) }
        var elements = 0
        while (parser.next() != org.xmlpull.v1.XmlPullParser.END_DOCUMENT) if (parser.eventType == org.xmlpull.v1.XmlPullParser.START_TAG) elements++
        assertTrue(elements > 5)

        // caminho real de "Salvar na galeria": PNG em Pictures/, SVG em Download/
        val name = "teste_fase4_${System.currentTimeMillis()}"
        val pngAt = EditorExports.save(context, ExportFormat.PNG, name, pngBytes)
        val svgAt = EditorExports.save(context, ExportFormat.SVG, name, svg.encodeToByteArray())
        assertEquals("Pictures/ProductPhoto/$name.png", pngAt)
        assertEquals("Download/ProductPhoto/$name.svg", svgAt)
        for ((uri, file) in listOf(MediaStore.Images.Media.EXTERNAL_CONTENT_URI to "$name.png", MediaStore.Downloads.EXTERNAL_CONTENT_URI to "$name.svg")) {
            context.contentResolver.query(uri, arrayOf(MediaStore.MediaColumns.SIZE), "${MediaStore.MediaColumns.DISPLAY_NAME} = ?", arrayOf(file), null)!!.use {
                assertTrue("$file no MediaStore", it.moveToFirst() && it.getLong(0) > 0)
            }
        }
        android.util.Log.i("EditorExportTest", "png=${pngBytes.size} B svg=${svg.length} chars; protocolo v${EditorProtocol.VERSION}")
        Unit
    }
}
