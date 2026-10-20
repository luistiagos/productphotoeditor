package com.productphoto.feature.mockup

import android.content.res.AssetManager
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.PointF
import com.productphoto.ai.api.MockupSlot
import com.productphoto.ai.api.MockupTemplate
import com.productphoto.ai.api.RgbaImage
import com.productphoto.imaging.isConvexQuad
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import java.io.File
import java.net.HttpURLConnection
import java.net.URL

@Serializable
data class MockupIndex(val version: Int = 1, val mockups: List<MockupEntry> = emptyList())

/** quad: 4 cantos [x, y] em px da base, na ordem TL, TR, BR, BL (§20.4 item 10). */
@Serializable
data class SlotJson(val quad: List<List<Float>>, val aspect: Float)

@Serializable
data class MockupEntry(
    val id: String,
    val name: String,
    val category: String,
    val file: String,
    val thumb: String,
    val width: Int,
    val height: Int,
    val slots: List<SlotJson>,
    val shading: Float = 1f,
    val displacement: Float = 0f,
    val isRemote: Boolean = false,
    val remoteBaseUrl: String? = null,
)

/** Formato do catálogo legado Videorey (https://fa.videorey.in/aiproduct/mockup.json) */
@Serializable
private data class VideoreyRawEntry(
    val count: Int = 1,
    val name: String,
    val preview: String = "",
    val inputRatio: List<String> = emptyList(),
)

private val json = Json { ignoreUnknownKeys = true }

fun parseMockupIndex(text: String): MockupIndex = json.decodeFromString(MockupIndex.serializer(), text)

/** Converte o catálogo legado da Videorey para entradas compatíveis com o motor do app */
fun parseVideoreyMockups(text: String, baseUrl: String = "https://fa.videorey.in/aiproduct/mockup"): List<MockupEntry> {
    val items = json.decodeFromString<List<VideoreyRawEntry>>(text)
    return items.map { item ->
        val previewUrl = item.preview.replace("https:fa", "https://fa")
        val filename = if (previewUrl.contains("/")) previewUrl.substringAfterLast("/") else "${item.name}.webp"
        val ratios = if (item.inputRatio.isNotEmpty()) item.inputRatio else listOf("1:1")
        val slots = ratios.map { r ->
            val (rw, rh) = if (r.contains(":")) {
                val p = r.split(":")
                (p.getOrNull(0)?.trim()?.toFloatOrNull() ?: 1f) to (p.getOrNull(1)?.trim()?.toFloatOrNull() ?: 1f)
            } else 1f to 1f
            val aspect = if (rh > 0f) rw / rh else 1f
            // Gera quad retangular centrado padrão dentro da área 1000x1000
            val sw = if (aspect < 1f) 600f * aspect else 600f
            val sh = if (aspect < 1f) 600f else 600f / aspect
            val cx = 500f
            val cy = 500f
            val x1 = cx - sw / 2f
            val y1 = cy - sh / 2f
            val x2 = cx + sw / 2f
            val y2 = cy + sh / 2f
            SlotJson(
                quad = listOf(
                    listOf(x1, y1),
                    listOf(x2, y1),
                    listOf(x2, y2),
                    listOf(x1, y2)
                ),
                aspect = aspect
            )
        }
        val formattedName = item.name.replaceFirstChar { if (it.isLowerCase()) it.titlecase() else it.toString() }
        MockupEntry(
            id = "videorey_${item.name}",
            name = formattedName,
            category = "videorey",
            file = filename,
            thumb = filename,
            width = 1000,
            height = 1000,
            slots = slots,
            isRemote = true,
            remoteBaseUrl = baseUrl
        )
    }
}

/** Tenta interpretar como MockupIndex padrão ou como lista legada Videorey */
fun parseAnyMockupCatalog(text: String, baseUrl: String = "https://huggingface.co/datasets/luisluis123/mockups/resolve/main"): List<MockupEntry> {
    val trimmed = text.trim()
    return if (trimmed.startsWith("[")) {
        parseVideoreyMockups(trimmed, baseUrl)
    } else {
        parseMockupIndex(trimmed).mockups.map { it.copy(isRemote = true, remoteBaseUrl = it.remoteBaseUrl ?: baseUrl) }
    }
}

/** Resolve URL remota completa garantindo protocolo HTTPS e conversão para /resolve/ no Hugging Face */
fun resolveRemoteUrl(path: String, baseUrl: String?): String {
    val fixed = path.replace("https:fa", "https://fa")
    val rawUrl = if (fixed.startsWith("http://") || fixed.startsWith("https://")) {
        fixed
    } else {
        val base = (baseUrl ?: "https://huggingface.co/datasets/luisluis123/mockups/resolve/main").trimEnd('/')
        "$base/${fixed.trimStart('/')}"
    }
    // Arquivos binários no Git LFS do Hugging Face precisam de /resolve/ em vez de /raw/
    return if (rawUrl.contains("huggingface.co/") && rawUrl.contains("/raw/")) {
        rawUrl.replace("/raw/", "/resolve/")
    } else {
        rawUrl
    }
}


/** quad em `FloatArray(8)` (x, y alternados). */
fun SlotJson.flat(): FloatArray = FloatArray(8) { quad[it / 2][it % 2] }

/** Problemas de um template (vazio = ok): quad com 4 cantos, dentro da base, convexo, proporção > 0. */
fun MockupEntry.problems(): List<String> = buildList {
    if (slots.isEmpty()) add("$id: sem espaços")
    slots.forEachIndexed { i, s ->
        if (s.quad.size != 4 || s.quad.any { it.size != 2 }) { add("$id[$i]: quad precisa de 4 cantos [x, y]"); return@forEachIndexed }
        if (s.quad.any { (x, y) -> x < 0 || y < 0 || x > width || y > height }) add("$id[$i]: quad fora da base ${width}x$height")
        if (!isConvexQuad(s.flat())) add("$id[$i]: quad não convexo")
        if (s.aspect <= 0f) add("$id[$i]: proporção ${s.aspect}")
    }
}

/**
 * Biblioteca Híbrida de Mockups:
 * 1. Base local empacotada no APK (assets/content/mockups/index.json) disponível offline em 0ms.
 * 2. Cache interno persistente em disco (localDir / filesDir/content/mockups).
 * 3. Sincronização sob demanda com servidor remoto / CDN (Videorey ou bucket customizado).
 */
class MockupLibrary(
    private val assets: AssetManager,
    private val localDir: File? = null,
    val defaultRemoteUrl: String = DEFAULT_REMOTE_URL,
) {
    private val _remoteMockups = mutableListOf<MockupEntry>()

    init {
        loadCachedRemoteIndex()
    }

    private fun loadCachedRemoteIndex() {
        val dir = localDir ?: return
        val cacheFile = File(dir, "remote_index.json")
        if (cacheFile.exists()) {
            runCatching {
                val index = parseMockupIndex(cacheFile.readText())
                _remoteMockups.clear()
                _remoteMockups.addAll(index.mockups)
            }
        }
    }

    /** Mockups embutidos no APK */
    val bundled: List<MockupEntry> by lazy {
        runCatching {
            assets.open("$DIR/index.json").use { parseMockupIndex(it.readBytes().decodeToString()) }.mockups
        }.getOrDefault(emptyList())
    }

    /** Mockups combinados (embutidos + remotos sincronizados) */
    val all: List<MockupEntry>
        get() {
            val b = bundled
            val bIds = b.map { it.id }.toSet()
            val r = _remoteMockups.filter { it.id !in bIds }
            return b + r
        }

    /** Indica se o arquivo de alta resolução do mockup já está disponível offline */
    fun isDownloaded(e: MockupEntry): Boolean {
        if (!e.isRemote) return true
        val dir = localDir ?: return false
        return File(dir, e.file).exists()
    }

    fun thumb(e: MockupEntry): Bitmap {
        val dir = localDir
        // 1. Verifica no cache local
        if (dir != null) {
            val f = File(dir, e.thumb)
            if (f.exists()) {
                BitmapFactory.decodeFile(f.absolutePath)?.let { return it }
            }
        }
        // 2. Verifica nos assets do APK
        if (!e.isRemote) {
            runCatching {
                assets.open("$DIR/${e.thumb}").use { return BitmapFactory.decodeStream(it) }
            }
        }
        // 3. Download remoto da miniatura
        if (e.isRemote && dir != null) {
            val url = resolveRemoteUrl(e.thumb, e.remoteBaseUrl)
            runCatching {
                val bytes = downloadBytes(url)
                val f = File(dir, e.thumb)
                f.parentFile?.mkdirs()
                f.writeBytes(bytes)
                BitmapFactory.decodeByteArray(bytes, 0, bytes.size)?.let { return it }
            }
        }
        return createFallbackBitmap()
    }

    fun template(e: MockupEntry): MockupTemplate {
        val dir = localDir
        var baseBitmap: Bitmap? = null

        // 1. Arquivo local em cache
        if (dir != null) {
            val f = File(dir, e.file)
            if (f.exists()) {
                baseBitmap = BitmapFactory.decodeFile(
                    f.absolutePath,
                    BitmapFactory.Options().apply { inPreferredConfig = Bitmap.Config.ARGB_8888 }
                )
            }
        }

        // 2. Arquivo empacotado no APK
        if (baseBitmap == null && !e.isRemote) {
            baseBitmap = assets.open("$DIR/${e.file}").use {
                BitmapFactory.decodeStream(it, null, BitmapFactory.Options().apply { inPreferredConfig = Bitmap.Config.ARGB_8888 })
            }
        }

        // 3. Download do arquivo base se ainda não tiver em cache
        if (baseBitmap == null && e.isRemote) {
            val url = resolveRemoteUrl(e.file, e.remoteBaseUrl)
            val bytes = downloadBytes(url)
            if (dir != null) {
                val f = File(dir, e.file)
                f.parentFile?.mkdirs()
                f.writeBytes(bytes)
            }
            baseBitmap = BitmapFactory.decodeByteArray(
                bytes, 0, bytes.size,
                BitmapFactory.Options().apply { inPreferredConfig = Bitmap.Config.ARGB_8888 }
            )
        }

        val base = baseBitmap ?: error("Não foi possível carregar imagem do mockup ${e.id}")
        return MockupTemplate(
            e.id, RgbaImage(base),
            e.slots.map { s -> MockupSlot(s.quad.map { (x, y) -> PointF(x, y) }, s.aspect) },
            e.shading, e.displacement,
        )
    }

    suspend fun loadTemplate(e: MockupEntry): MockupTemplate = withContext(Dispatchers.IO) {
        template(e)
    }

    /**
     * Sincroniza catálogo remoto com o servidor e grava cache local.
     * Retorna a quantidade total de itens remotos obtidos.
     */
    suspend fun syncRemoteCatalog(url: String = defaultRemoteUrl): Result<Int> = withContext(Dispatchers.IO) {
        runCatching {
            val raw = downloadString(url)
            val base = if (url.contains("/")) url.substringBeforeLast("/") else url
            val entries = parseAnyMockupCatalog(raw, base)
            _remoteMockups.clear()
            _remoteMockups.addAll(entries)
            localDir?.let { dir ->
                dir.mkdirs()
                val jsonText = json.encodeToString(MockupIndex.serializer(), MockupIndex(version = 2, mockups = _remoteMockups))
                File(dir, "remote_index.json").writeText(jsonText)
            }
            entries.size
        }
    }

    private companion object {
        const val DIR = "content/mockups"
        const val DEFAULT_REMOTE_URL = "https://huggingface.co/datasets/luisluis123/mockups/resolve/main/index.json"

        fun downloadBytes(urlStr: String): ByteArray {
            val conn = URL(urlStr).openConnection() as HttpURLConnection
            conn.connectTimeout = 12000
            conn.readTimeout = 15000
            conn.instanceFollowRedirects = true
            return conn.inputStream.use { it.readBytes() }
        }

        fun downloadString(urlStr: String): String = downloadBytes(urlStr).decodeToString()

        fun createFallbackBitmap(): Bitmap {
            val bmp = Bitmap.createBitmap(160, 160, Bitmap.Config.ARGB_8888)
            val canvas = android.graphics.Canvas(bmp)
            val p = android.graphics.Paint().apply {
                color = android.graphics.Color.LTGRAY
            }
            canvas.drawRect(0f, 0f, 160f, 160f, p)
            return bmp
        }
    }
}

