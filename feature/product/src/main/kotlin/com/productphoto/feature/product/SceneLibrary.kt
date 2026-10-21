package com.productphoto.feature.product

import android.content.res.AssetManager
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.RectF
import com.productphoto.ai.api.SceneMeta
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.File
import java.net.HttpURLConnection
import java.net.URL

@Serializable
data class SceneIndex(val version: Int = 1, val scenes: List<SceneEntry> = emptyList())

@Serializable
data class SceneEntry(
    val id: String,
    val file: String,
    val thumb: String,
    val tags: List<String>,
    val meta: SceneMetaJson,
    val isRemote: Boolean = false,
    val remoteUrl: String? = null,
)

@Serializable
data class StylePreset(
    val style: String,
    val prompts: String = "",
    val image: String = "",
    val url: String = "",
)

@Serializable
data class SceneMetaJson(
    val floorY: Float = 0.75f,
    val lightDirDeg: Float = 120f,
    val lightElevationDeg: Float = 55f,
    val shadowSoftness: Float = 0.5f,
    val colorTempK: Int = 5500,
    val placement: List<Float> = listOf(0.25f, 0.35f, 0.75f, 0.75f),
) {
    fun toMeta() = SceneMeta(floorY, lightDirDeg, lightElevationDeg, shadowSoftness, colorTempK,
        RectF(placement[0], placement[1], placement[2], placement[3]))
}

enum class ProductCategory(val tag: String, val label: String) {
    ALL("all", "Todos"),
    COSMETICS("cosmetics", "Cosméticos"),
    FOOD("food", "Alimentos"),
    ELECTRONICS("electronics", "Eletrônicos"),
    FASHION("fashion", "Moda"),
    HOME("home", "Casa"),
    STYLES("styles", "Estilos IA"),
}

/** Cenários empacotados em assets/content/scenes (§8) e estilos remotos do Hugging Face. */
class SceneLibrary(
    private val assets: AssetManager,
    private val localDir: File? = null,
) {
    private val json = Json { ignoreUnknownKeys = true }

    private val bundledScenes: List<SceneEntry> by lazy {
        runCatching {
            assets.open("$DIR/index.json").use { json.decodeFromString(SceneIndex.serializer(), it.readBytes().decodeToString()) }.scenes
        }.getOrDefault(emptyList())
    }

    private val _remoteScenes = mutableListOf<SceneEntry>()

    init {
        // Carrega cache local de estilos se existir
        localDir?.let { dir ->
            val cacheFile = File(dir, "remote_styles.json")
            if (cacheFile.exists() && cacheFile.length() > 0) {
                runCatching {
                    val entries = parseStylesJson(cacheFile.readText())
                    _remoteScenes.clear()
                    _remoteScenes.addAll(entries)
                }
            }
        }
    }

    val all: List<SceneEntry>
        get() = bundledScenes + _remoteScenes

    fun byCategory(c: ProductCategory): List<SceneEntry> {
        val list = all
        return if (c == ProductCategory.ALL) list else list.filter { c.tag in it.tags }
    }

    suspend fun syncRemoteStyles(urlStr: String = DEFAULT_REMOTE_STYLES_URL): Result<Int> = withContext(Dispatchers.IO) {
        runCatching {
            val text = downloadString(urlStr)
            val entries = parseStylesJson(text)
            if (entries.isNotEmpty()) {
                _remoteScenes.clear()
                _remoteScenes.addAll(entries)
                localDir?.let { dir ->
                    dir.mkdirs()
                    File(dir, "remote_styles.json").writeText(text)
                }
            }
            entries.size
        }
    }

    private fun parseStylesJson(text: String): List<SceneEntry> {
        return runCatching {
            val presets = json.decodeFromString<List<StylePreset>>(text)
            presets.mapIndexed { idx, p ->
                val id = "style_${p.style.lowercase().replace(" ", "_").replace(Regex("[^a-z0-9_]"), "")}_$idx"
                val rawUrl = if (p.url.isNotBlank()) p.url else "$DEFAULT_BASE_URL/${p.image}"
                val resolvedUrl = rawUrl.replace("/raw/", "/resolve/")
                SceneEntry(
                    id = id,
                    file = p.image,
                    thumb = p.image,
                    tags = listOf("all", "styles", "cosmetics", "fashion"),
                    meta = SceneMetaJson(
                        floorY = 0.75f,
                        lightDirDeg = 120f,
                        lightElevationDeg = 55f,
                        shadowSoftness = 0.5f,
                        colorTempK = 5500,
                        placement = listOf(0.2f, 0.25f, 0.8f, 0.75f)
                    ),
                    isRemote = true,
                    remoteUrl = resolvedUrl
                )
            }
        }.getOrDefault(emptyList())
    }

    fun thumb(e: SceneEntry): Bitmap {
        return if (e.isRemote) {
            getOrDownloadRemoteBitmap(e)
        } else {
            assets.open("$DIR/${e.thumb}").use { BitmapFactory.decodeStream(it) }
        }
    }

    fun image(e: SceneEntry): Bitmap {
        return if (e.isRemote) {
            getOrDownloadRemoteBitmap(e)
        } else {
            assets.open("$DIR/${e.file}").use {
                BitmapFactory.decodeStream(it, null, BitmapFactory.Options().apply { inPreferredConfig = Bitmap.Config.ARGB_8888 })!!
            }
        }
    }

    private fun getOrDownloadRemoteBitmap(e: SceneEntry): Bitmap {
        val targetFile = localDir?.let { File(it, "${e.id}.webp") }
        if (targetFile != null && targetFile.exists() && targetFile.length() > 500) {
            BitmapFactory.decodeFile(targetFile.absolutePath)?.let { return it }
        }
        val url = e.remoteUrl
        if (!url.isNullOrBlank()) {
            runCatching {
                val bytes = downloadBytes(url)
                if (bytes.size > 500) {
                    targetFile?.let { f ->
                        f.parentFile?.mkdirs()
                        f.writeBytes(bytes)
                    }
                    BitmapFactory.decodeByteArray(bytes, 0, bytes.size)?.let { return it }
                }
            }
        }
        return createFallbackBitmap()
    }

    private companion object {
        const val DIR = "content/scenes"
        const val DEFAULT_REMOTE_STYLES_URL = "https://huggingface.co/datasets/luisluis123/mockups/resolve/main/styles.json"
        const val DEFAULT_BASE_URL = "https://huggingface.co/datasets/luisluis123/mockups/resolve/main"

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
            val p = android.graphics.Paint().apply { color = android.graphics.Color.LTGRAY }
            canvas.drawRect(0f, 0f, 160f, 160f, p)
            return bmp
        }
    }
}
