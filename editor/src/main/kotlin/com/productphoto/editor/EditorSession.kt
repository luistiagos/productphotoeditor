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
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.booleanOrNull
import kotlinx.serialization.json.buildJsonArray
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.doubleOrNull
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
    /** Seletor de arquivo de áudio (qualquer MIME audio); null = cancelado. */
    suspend fun pickAudio(): Uri? = null
    suspend fun export(format: ExportFormat, action: ExportAction, name: String, bytes: ByteArray): String?
    suspend fun exportVideo(action: ExportAction, name: String, videoFile: File): String? = null
    /**
     * Arquivo já montado em `cacheDir/exports` (PDF ou ZIP do lote, TASK-10): SAVE grava em Download/ProductPhoto e devolve o
     * caminho; SHARE abre o compartilhar. Sem implementação, o pedido falha com `unsupported`.
     */
    suspend fun exportFile(format: ExportFormat, action: ExportAction, file: File): String? =
        throw BridgeException(ErrorCode.UNSUPPORTED, "exportar ${format.ext} não suportado aqui")
}

/** `ZIP` é só saída do lote (o JS nunca manda `format: 'zip'`). */
enum class ExportFormat(val ext: String, val mime: String) {
    PNG("png", "image/png"), JPG("jpg", "image/jpeg"), WEBP("webp", "image/webp"), SVG("svg", "image/svg+xml"),
    PDF("pdf", "application/pdf"), MP4("mp4", "video/mp4"), GIF("gif", "image/gif"), ZIP("zip", "application/zip");

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
        handle("pickAudio") { _, _ -> pickAudio() }
        handle("export") { p, progress -> export(p.obj(), progress) }
        // TASK-18: o PNG do 🖌️ Retocar recorte vira blob (as ações de IA recusam `data:`)
        handle("putImage") { p, _ ->
            val bytes = withContext(Dispatchers.Default) { EditorAssets.pngFromDataUrl(p.obj().str("data")) }
            buildJsonObject { put("url", assets.blobUrl(assets.putBytes(bytes, "png", "edit"))) }
        }
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
        // [[editor-galeria-svg-pickimage]] o seletor (image/*) lista SVG, que o ImageDecoder não abre:
        // a DecodeException (IOException) vira erro `invalid` com mensagem clara, não o texto cru do decoder.
        val bmp = try {
            withContext(Dispatchers.Default) { EditorAssets.decodeBytes(bytes, PICK_MAX_SIDE) }
        } catch (e: java.io.IOException) {
            val mime = runCatching { context.contentResolver.getType(uri) }.getOrNull()
            throw BridgeException(
                ErrorCode.INVALID,
                if (isSvg(bytes, mime)) "SVG não abre como foto. Use Adesivos, ou exporte o design em PNG/JPG"
                else "formato de imagem não suportado",
            )
        }
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

    /** Copia o áudio escolhido para o BlobStore (`audio-<uuid>.<ext>`); o editor toca e o export lê pela URL do blob. */
    private suspend fun pickAudio(): JsonElement {
        val h = host ?: throw BridgeException(ErrorCode.UNSUPPORTED, "sem seletor de arquivo")
        val uri = h.pickAudio() ?: throw BridgeException(ErrorCode.CANCELLED, "nenhum áudio escolhido")
        return withContext(Dispatchers.IO) {
            val resolver = context.contentResolver
            val display = resolver.query(uri, arrayOf(OpenableColumns.DISPLAY_NAME, OpenableColumns.SIZE), null, null, null)?.use { c ->
                if (c.moveToFirst()) {
                    if (!c.isNull(1) && c.getLong(1) > MAX_AUDIO_BYTES) throw BridgeException(ErrorCode.INVALID, "áudio maior que 40 MB")
                    c.getString(0)
                } else null
            } ?: "Áudio"
            val bytes = resolver.openInputStream(uri)!!.use { input ->
                val buf = java.io.ByteArrayOutputStream()
                val chunk = ByteArray(64 * 1024)
                while (true) {
                    val n = input.read(chunk)
                    if (n < 0) break
                    buf.write(chunk, 0, n)
                    if (buf.size() > MAX_AUDIO_BYTES) throw BridgeException(ErrorCode.INVALID, "áudio maior que 40 MB")
                }
                buf.toByteArray()
            }
            val ext = audioExtension(display, resolver.getType(uri))
            val name = assets.putBytes(bytes, ext, "audio")
            buildJsonObject { put("url", assets.blobUrl(name)); put("name", display.substringBeforeLast('.')) }
        }
    }

    private suspend fun export(p: JsonObject, progress: ProgressFn): JsonElement {
        val h = host ?: throw BridgeException(ErrorCode.UNSUPPORTED, "sem exportação")
        val format = ExportFormat.of(p.str("format"))
        val action = when (p.str("action")) {
            "save" -> ExportAction.SAVE; "share" -> ExportAction.SHARE; "print" -> ExportAction.PRINT
            "mockup" -> ExportAction.MOCKUP
            else -> throw BridgeException(ErrorCode.INVALID, "action")
        }
        if (format == ExportFormat.ZIP) throw BridgeException(ErrorCode.INVALID, "format zip")
        val batch = p["batch"] as? JsonObject
        if (batch != null || format == ExportFormat.PDF) return exportBatch(h, format, action, p, batch)

        if (format == ExportFormat.MP4 || format == ExportFormat.GIF) {
            if (action == ExportAction.PRINT) throw BridgeException(ErrorCode.UNSUPPORTED, "não é possível imprimir vídeo")
            if (action == ExportAction.MOCKUP) throw BridgeException(ErrorCode.UNSUPPORTED, "mockup não suporta vídeo")
            val rawData = p.str("data")
            Log.i(TAG, "Iniciando export de ${format.ext}, tamanho data=${rawData.length}")
            val videoRenderer = VideoRenderer(context, assets)
            val videoFile = try {
                videoRenderer.render(rawData, progress)
            } catch (e: Throwable) {
                Log.e(TAG, "Falha em videoRenderer.render: ${e.message}", e)
                throw e
            }
            try {
                val name = exportName(p.strOrNull("name"))
                // GIF é imagem: vai para Pictures pelo caminho dos bytes (galeria e compartilhar)
                val location = (if (format == ExportFormat.MP4) h.exportVideo(action, name, videoFile) else null) ?: run {
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

    /**
     * Lote (TASK-10): cada pedido traz uma página; as do meio ficam em `cacheDir/batch/<id>/` e respondem `{staged}`. Na
     * última: N imagens na galeria (pelo `host.export` de sempre, `<nome>_01`…), um `.zip` ou um `.pdf` (`host.exportFile`);
     * a pasta do lote é apagada no `finally`, com sucesso ou erro. PDF sem `batch` = lote de uma página.
     */
    private suspend fun exportBatch(h: EditorHost, format: ExportFormat, action: ExportAction, p: JsonObject, batch: JsonObject?): JsonElement {
        val output = BatchExport.outputOf(format, action)
        val spec = if (batch == null) BatchExport.single() else BatchExport.spec(batch.str("id"), batch.num("index").toInt(), batch.num("count").toInt())
        val print = (p["printOptions"] as? JsonObject).let { o ->
            PrintOptions(
                cropMarks = (o?.get("cropMarks") as? JsonPrimitive)?.booleanOrNull ?: false,
                bleedPx = (o?.get("bleedPx") as? JsonPrimitive)?.doubleOrNull?.coerceIn(0.0, 500.0) ?: 0.0,
                scale = (o?.get("scale") as? JsonPrimitive)?.doubleOrNull?.takeIf { it > 0 } ?: 1.0,
            )
        }
        val data = p.str("data")
        val bytes = withContext(Dispatchers.Default) {
            if (format == ExportFormat.SVG) data.encodeToByteArray() else EditorAssets.dataUrlBytes(data)
        }
        val root = File(context.cacheDir, "batch")
        val files = withContext(Dispatchers.IO) {
            BatchExport.stage(root, spec, BatchExport.stagedExt(format), bytes, if (format == ExportFormat.PDF) print.scale else null)
        } ?: return buildJsonObject { put("staged", spec.index) }
        try {
            val name = exportName(p.strOrNull("name"))
            val location = when (output) {
                BatchOutput.GALLERY_IMAGES -> {
                    var last: String? = null
                    BatchExport.batchNames(name, files.size).forEachIndexed { i, n ->
                        last = h.export(format, ExportAction.SAVE, n, withContext(Dispatchers.IO) { files[i].readBytes() })
                    }
                    if (files.size > 1) "Pictures/ProductPhoto (${files.size} arquivos)" else last
                }
                BatchOutput.ZIP -> {
                    val out = EditorExports.freshExportFile(context, "$name.zip")
                    withContext(Dispatchers.IO) { BatchExport.zip(BatchExport.batchNames(name, files.size, format.ext).zip(files), out) }
                    h.exportFile(ExportFormat.ZIP, action, out)
                }
                BatchOutput.PDF -> {
                    val out = EditorExports.freshExportFile(context, "$name.pdf")
                    withContext(Dispatchers.Default) { EditorExports.writePdf(files.map { it to BatchExport.stagedScale(it) }, print, out) }
                    h.exportFile(ExportFormat.PDF, action, out)
                }
            }
            return buildJsonObject {
                location?.let { put("location", it) }
                put("count", files.size)
            }
        } finally {
            withContext(Dispatchers.IO) { files.first().parentFile?.deleteRecursively() }
        }
    }

    companion object {
        const val TAG = "EditorSession"
        const val JS_OBJECT = "AppBridge"
        const val PICK_MAX_SIDE = 2048
        const val MAX_AUDIO_BYTES = 40L * 1024 * 1024

        /** Extensão do áudio pelo nome do arquivo ou, sem ela, pelo MIME (o FFmpeg e o Chromium detectam pelo conteúdo). */
        fun audioExtension(displayName: String?, mime: String?): String {
            val byName = displayName?.substringAfterLast('.', "")?.lowercase()
            if (byName != null && byName in AUDIO_EXTS) return byName
            return when (mime?.lowercase()) {
                "audio/mpeg", "audio/mp3" -> "mp3"
                "audio/mp4", "audio/m4a", "audio/x-m4a", "audio/aac", "audio/mp4a-latm" -> "m4a"
                "audio/ogg", "application/ogg" -> "ogg"
                "audio/opus" -> "opus"
                "audio/wav", "audio/x-wav", "audio/wave" -> "wav"
                "audio/flac", "audio/x-flac" -> "flac"
                "audio/webm" -> "webm"
                "audio/3gpp" -> "3gp"
                "audio/amr" -> "amr"
                else -> "mp3"
            }
        }
        private val AUDIO_EXTS = setOf("mp3", "m4a", "aac", "ogg", "oga", "opus", "wav", "flac", "webm", "3gp", "amr", "mp4")

        /** SVG pelo MIME ou pelo início do arquivo (depois de BOM UTF-8; cobre `<?xml …?><svg` e `<!DOCTYPE svg`). */
        fun isSvg(bytes: ByteArray, mime: String?): Boolean {
            if (mime?.substringBefore(';')?.trim()?.lowercase() == "image/svg+xml") return true
            var start = 0
            if (bytes.size >= 3 && bytes[0] == 0xEF.toByte() && bytes[1] == 0xBB.toByte() && bytes[2] == 0xBF.toByte()) start = 3
            val head = String(bytes, start, minOf(bytes.size - start, 1024).coerceAtLeast(0), Charsets.UTF_8).trimStart().lowercase()
            return head.startsWith("<") && head.contains("<svg")
        }

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
