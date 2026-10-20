package com.productphoto.editor

import android.annotation.SuppressLint
import android.content.Context
import android.net.Uri
import android.os.Handler
import android.os.Looper
import android.provider.OpenableColumns
import android.util.Log
import android.webkit.RenderProcessGoneDetail
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.webkit.JavaScriptReplyProxy
import androidx.webkit.WebMessageCompat
import androidx.webkit.WebViewCompat
import androidx.webkit.WebViewFeature
import com.productphoto.data.BrandKit
import com.productphoto.data.BrandKitRepository
import com.productphoto.data.DraftRepository
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.buildJsonArray
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import java.io.File

/** O que abrir quando a página do editor diz `hello`. */
sealed interface EditorStart {
    data class New(val name: String, val width: Int, val height: Int) : EditorStart
    data class Draft(val id: String) : EditorStart
    data class Template(val id: String) : EditorStart
    /** Página em branco com a galeria de modelos aberta. */
    data object Gallery : EditorStart
    /** Imagem já gravada no BlobStore (ex.: resultado da foto de produto). */
    data class Image(val blobName: String, val name: String) : EditorStart
}

/** Ações que precisam da Activity (seletores do sistema, compartilhar, imprimir). */
interface EditorHost {
    suspend fun pickImage(): Uri?
    suspend fun pickFont(): Uri?
    suspend fun export(format: ExportFormat, action: ExportAction, name: String, bytes: ByteArray): String?
    suspend fun exportVideo(action: ExportAction, name: String, videoFile: File): String? = null
}

enum class ExportFormat(val ext: String, val mime: String) {
    PNG("png", "image/png"), JPG("jpg", "image/jpeg"), SVG("svg", "image/svg+xml"), MP4("mp4", "video/mp4");

    companion object {
        fun of(s: String) = entries.firstOrNull { it.ext == s } ?: throw BridgeException(ErrorCode.INVALID, "format $s")
    }
}

/** MOCKUP: o host abre o fluxo de mockup com o PNG no espaço 1 (§20.4 item 11). */
enum class ExportAction { SAVE, SHARE, PRINT, MOCKUP }

/**
 * Uma tela de editor: registra os handlers da ponte e liga o WebView. Os handlers rodam em
 * `scope` (Main); trabalho pesado troca de dispatcher dentro de cada um.
 */
class EditorSession(
    private val context: Context,
    scope: CoroutineScope,
    val assets: EditorAssets,
    private val ai: EditorAi,
    private val drafts: DraftRepository,
    private val brandKits: BrandKitRepository,
    private val start: EditorStart,
    var host: EditorHost? = null,
) {
    private val main = Handler(Looper.getMainLooper())
    private var proxy: JavaScriptReplyProxy? = null
    private val queued = ArrayList<String>()

    /** Id do rascunho atual (o JS informa a cada saveDraft). */
    @Volatile var draftId: String? = (start as? EditorStart.Draft)?.id
        private set

    val bridge = EditorBridge(scope) { msg -> main.post { deliver(msg) } }.apply {
        onProtocolError = { Log.w(TAG, "discarded message: $it") }
        registerAi(ai, assets)
        handle("hello") { _, _ -> hello() }
        handle("getBrandKit") { _, _ -> brandKitJson(brandKits.load()) }
        handle("saveDraft") { p, _ -> saveDraft(p.obj()) }
        handle("pickImage") { _, _ -> pickImage() }
        handle("pickFont") { _, _ -> pickFont() }
        handle("export") { p, progress -> export(p.obj(), progress) }
    }

    private fun deliver(msg: String) {
        val p = proxy
        if (p == null) queued += msg else p.postMessage(msg)
    }

    // ---------- WebView ----------

    @SuppressLint("SetJavaScriptEnabled")
    fun attach(webView: WebView) {
        check(WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER)) { "WebView sem WEB_MESSAGE_LISTENER" }
        // DevTools remoto (chrome://inspect) só em build depurável
        if (context.applicationInfo.flags and android.content.pm.ApplicationInfo.FLAG_DEBUGGABLE != 0) {
            WebView.setWebContentsDebuggingEnabled(true)
        }
        webView.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            allowFileAccess = false
            allowContentAccess = false
            mediaPlaybackRequiresUserGesture = true
        }
        webView.webViewClient = object : WebViewClient() {
            override fun shouldInterceptRequest(view: WebView, request: WebResourceRequest): WebResourceResponse? =
                assets.loader.shouldInterceptRequest(request.url)

            // o editor é uma página só: nenhuma navegação sai dela
            override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest) = true

            override fun onRenderProcessGone(view: WebView, detail: RenderProcessGoneDetail): Boolean {
                Log.e(TAG, "renderer gone (crash=${detail.didCrash()})")
                proxy = null
                view.loadUrl(EditorAssets.EDITOR_URL)
                return true
            }
        }
        WebViewCompat.addWebMessageListener(webView, JS_OBJECT, setOf(EditorAssets.ORIGIN)) { _, message: WebMessageCompat, origin, isMainFrame, replyProxy ->
            if (!isMainFrame || origin.toString() != EditorAssets.ORIGIN || message.type != WebMessageCompat.TYPE_STRING) return@addWebMessageListener
            if (proxy !== replyProxy) {
                proxy = replyProxy
                queued.forEach(replyProxy::postMessage)
                queued.clear()
            }
            message.data?.let(bridge::receive)
        }
        webView.loadUrl(EditorAssets.EDITOR_URL)
    }

    // ---------- handlers ----------

    private suspend fun hello(): JsonElement {
        val open: JsonObject = when (start) {
            is EditorStart.New -> buildJsonObject { put("kind", "new"); put("name", start.name); put("width", start.width); put("height", start.height) }
            is EditorStart.Template -> buildJsonObject { put("kind", "template"); put("id", start.id) }
            EditorStart.Gallery -> buildJsonObject { put("kind", "gallery") }
            is EditorStart.Image -> buildJsonObject { put("kind", "image"); put("url", assets.blobUrl(start.blobName)); put("name", start.name) }
            is EditorStart.Draft -> {
                val doc = drafts.load(start.id) ?: throw BridgeException(ErrorCode.INVALID, "rascunho ${start.id} não existe")
                buildJsonObject { put("kind", "draft"); put("id", start.id); put("document", EditorProtocol.json.parseToJsonElement(doc)) }
            }
        }
        return buildJsonObject {
            put("open", open)
            put("brandKit", brandKitJson(brandKits.load()))
            put("userFonts", buildJsonArray { userFonts().forEach { add(it) } })
        }
    }

    fun brandKitJson(kit: BrandKit): JsonElement = buildJsonObject {
        put("profile", buildJsonObject { kit.profile.asVariables().forEach { (k, v) -> put(k, v) } })
        put("colors", buildJsonObject { kit.colors.asRoles().forEach { (k, v) -> put(k, v) } })
        put("fonts", buildJsonObject { kit.fonts.asRoles().forEach { (k, v) -> put(k, v) } })
        kit.logoBlob?.takeIf { assets.blobFile(it) != null }?.let { put("logoUrl", assets.blobUrl(it)) }
    }

    private suspend fun saveDraft(p: JsonObject): JsonElement {
        val document = p["document"] as? JsonObject ?: throw BridgeException(ErrorCode.INVALID, "missing document")
        val thumb = p.strOrNull("thumbnail")?.let { runCatching { EditorAssets.dataUrlBytes(it) }.getOrNull() }
        val id = drafts.save(p.strOrNull("id"), document.toString(), thumb)
        draftId = id
        return buildJsonObject { put("id", id) }
    }

    private suspend fun pickImage(): JsonElement {
        val h = host ?: throw BridgeException(ErrorCode.UNSUPPORTED, "sem seletor de imagem")
        val uri = h.pickImage() ?: throw BridgeException(ErrorCode.CANCELLED, "nenhuma imagem escolhida")
        val bytes = withContext(Dispatchers.IO) { context.contentResolver.openInputStream(uri)!!.use { it.readBytes() } }
        val bmp = withContext(Dispatchers.Default) { EditorAssets.decodeBytes(bytes, PICK_MAX_SIDE) }
        val name = assets.putPng(bmp, "img")
        return buildJsonObject { put("url", assets.blobUrl(name)); put("width", bmp.width); put("height", bmp.height) }
    }

    private suspend fun pickFont(): JsonElement {
        val h = host ?: throw BridgeException(ErrorCode.UNSUPPORTED, "sem seletor de arquivo")
        val uri = h.pickFont() ?: throw BridgeException(ErrorCode.CANCELLED, "nenhuma fonte escolhida")
        return withContext(Dispatchers.IO) {
            val display = context.contentResolver.query(uri, arrayOf(OpenableColumns.DISPLAY_NAME), null, null, null)?.use { c ->
                if (c.moveToFirst()) c.getString(0) else null
            } ?: "Fonte"
            val bytes = context.contentResolver.openInputStream(uri)!!.use { it.readBytes() }
            val ext = fontExtension(bytes) ?: throw BridgeException(ErrorCode.INVALID, "não é uma fonte TTF/OTF/WOFF")
            val family = fontFamilyFromFileName(display)
            File(assets.fontDir, "$family.$ext").writeBytes(bytes)
            buildJsonObject { put("family", family.replace('_', ' ')); put("url", assets.fontUrl("$family.$ext")) }
        }
    }

    private fun userFonts(): List<JsonElement> = assets.fontDir.listFiles().orEmpty().filter { it.isFile }.sortedBy { it.name }.map {
        buildJsonObject { put("family", it.nameWithoutExtension.replace('_', ' ')); put("url", assets.fontUrl(it.name)) }
    }

    private suspend fun export(p: JsonObject, progress: ProgressFn): JsonElement {
        val h = host ?: throw BridgeException(ErrorCode.UNSUPPORTED, "sem exportação")
        val format = ExportFormat.of(p.str("format"))
        val action = when (p.str("action")) {
            "save" -> ExportAction.SAVE; "share" -> ExportAction.SHARE; "print" -> ExportAction.PRINT
            "mockup" -> ExportAction.MOCKUP
            else -> throw BridgeException(ErrorCode.INVALID, "action")
        }

        if (format == ExportFormat.MP4) {
            if (action == ExportAction.PRINT) throw BridgeException(ErrorCode.UNSUPPORTED, "não é possível imprimir vídeo")
            if (action == ExportAction.MOCKUP) throw BridgeException(ErrorCode.UNSUPPORTED, "mockup não suporta vídeo")
            val rawData = p.str("data")
            val videoRenderer = VideoRenderer(context)
            val videoFile = videoRenderer.render(rawData, progress)
            try {
                val name = exportName(p.strOrNull("name"))
                val location = h.exportVideo(action, name, videoFile) ?: run {
                    val bytes = withContext(Dispatchers.IO) { videoFile.readBytes() }
                    h.export(format, action, name, bytes)
                }
                return buildJsonObject { location?.let { put("location", it) } }
            } finally {
                videoFile.parentFile?.deleteRecursively()
            }
        }

        if (action == ExportAction.PRINT && format == ExportFormat.SVG) throw BridgeException(ErrorCode.UNSUPPORTED, "imprimir só PNG ou JPG")
        if (action == ExportAction.MOCKUP && format == ExportFormat.SVG) throw BridgeException(ErrorCode.UNSUPPORTED, "mockup só PNG ou JPG")
        val data = p.str("data")
        val bytes = withContext(Dispatchers.Default) {
            if (format == ExportFormat.SVG) data.encodeToByteArray() else EditorAssets.dataUrlBytes(data)
        }
        val location = h.export(format, action, exportName(p.strOrNull("name")), bytes)
        return buildJsonObject { location?.let { put("location", it) } }
    }

    companion object {
        const val TAG = "EditorSession"
        const val JS_OBJECT = "AppBridge"
        const val PICK_MAX_SIDE = 2048

        /** Assinatura dos formatos de fonte que o Chromium aceita. */
        fun fontExtension(b: ByteArray): String? {
            if (b.size < 4) return null
            val sig = String(b, 0, 4, Charsets.ISO_8859_1)
            return when {
                b[0] == 0.toByte() && b[1] == 1.toByte() && b[2] == 0.toByte() && b[3] == 0.toByte() -> "ttf"
                sig == "true" -> "ttf"
                sig == "OTTO" -> "otf"
                sig == "wOFF" -> "woff"
                sig == "wOF2" -> "woff2"
                else -> null
            }
        }

        fun fontFamilyFromFileName(display: String): String =
            display.substringBeforeLast('.').replace(Regex("[^A-Za-z0-9_-]+"), "_").trim('_').take(60).ifEmpty { "Fonte" }

        fun exportName(raw: String?): String {
            val base = raw.orEmpty().replace(Regex("[^\\p{L}\\p{N}_-]+"), "_").trim('_').take(40).ifEmpty { "design" }
            return base + "_" + java.text.SimpleDateFormat("yyyyMMdd_HHmmss", java.util.Locale.US).format(java.util.Date())
        }
    }
}
