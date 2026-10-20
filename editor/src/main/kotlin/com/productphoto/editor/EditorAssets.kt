package com.productphoto.editor

import android.content.Context
import android.graphics.Bitmap
import android.graphics.ImageDecoder
import android.net.Uri
import androidx.webkit.WebViewAssetLoader
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.File
import java.nio.ByteBuffer
import java.util.UUID

/**
 * URLs que o editor web enxerga (ARQUITETURA §15.2), todas na origem do asset loader:
 * `/assets/…` = assets do APK, `/blob/<nome>` = imagens geradas no app, `/userfonts/<nome>` =
 * fontes do usuário.
 */
class EditorAssets(private val context: Context) {
    val blobDir = File(context.filesDir, "editor/blobs").apply { mkdirs() }
    val fontDir = File(context.filesDir, "editor/fonts").apply { mkdirs() }

    val loader: WebViewAssetLoader = WebViewAssetLoader.Builder()
        .setDomain(WebViewAssetLoader.DEFAULT_DOMAIN)
        .addPathHandler("/assets/", WebViewAssetLoader.AssetsPathHandler(context))
        .addPathHandler("/blob/", WebViewAssetLoader.InternalStoragePathHandler(context, blobDir))
        .addPathHandler("/userfonts/", WebViewAssetLoader.InternalStoragePathHandler(context, fontDir))
        .build()

    fun blobUrl(name: String) = "$ORIGIN/blob/$name"
    fun fontUrl(name: String) = "$ORIGIN/userfonts/$name"

    /** Grava um bitmap como PNG novo e devolve o nome (os blobs nunca são reescritos: a URL não fica em cache velho). */
    suspend fun putPng(bitmap: Bitmap, prefix: String = "img"): String = withContext(Dispatchers.IO) {
        val name = "$prefix-${UUID.randomUUID()}.png"
        File(blobDir, name).outputStream().use { check(bitmap.compress(Bitmap.CompressFormat.PNG, 100, it)) { "PNG encode failed" } }
        name
    }

    suspend fun putBytes(bytes: ByteArray, ext: String, prefix: String = "file"): String = withContext(Dispatchers.IO) {
        require(EXT.matches(ext)) { "bad extension" }
        val name = "$prefix-${UUID.randomUUID()}.$ext"
        File(blobDir, name).writeBytes(bytes)
        name
    }

    fun blobFile(name: String): File? = name.takeIf { NAME.matches(it) }?.let { File(blobDir, it) }?.takeIf { it.exists() }

    /** Bytes de uma URL do editor (blob ou asset do APK); null se a URL não for nossa. */
    suspend fun read(url: String): ByteArray? = withContext(Dispatchers.IO) {
        when (val src = resolve(url)) {
            is Source.Blob -> src.file.readBytes()
            is Source.Asset -> context.assets.open(src.path).use { it.readBytes() }
            null -> null
        }
    }

    /** Decodifica a imagem de uma URL do editor em ARGB_8888 (lado maior até maxSide). */
    suspend fun decode(url: String, maxSide: Int = MAX_SIDE): Bitmap = withContext(Dispatchers.IO) {
        val bytes = read(url) ?: throw BridgeException(ErrorCode.INVALID, "imagem fora do editor: $url")
        decodeBytes(bytes, maxSide)
    }

    sealed interface Source {
        data class Blob(val file: File) : Source
        data class Asset(val path: String) : Source
    }

    fun resolve(url: String): Source? {
        val uri = runCatching { Uri.parse(url) }.getOrNull() ?: return null
        if (uri.scheme != "https" || uri.host != WebViewAssetLoader.DEFAULT_DOMAIN) return null
        val path = uri.path ?: return null
        if (path.split('/').any { it == ".." }) return null
        return when {
            path.startsWith("/blob/") -> blobFile(path.removePrefix("/blob/"))?.let(Source::Blob)
            path.startsWith("/assets/") -> Source.Asset(path.removePrefix("/assets/"))
            else -> null
        }
    }

    companion object {
        const val ORIGIN = "https://${WebViewAssetLoader.DEFAULT_DOMAIN}"
        const val EDITOR_URL = "$ORIGIN/assets/editor/index.html"
        const val MAX_SIDE = 4096
        private val NAME = Regex("^[a-z]+-[0-9a-f-]{36}\\.[a-z0-9]{2,5}$|^[a-zA-Z0-9_-]{1,80}\\.(ttf|otf|woff|woff2)$")
        private val EXT = Regex("^[a-z0-9]{2,5}$")

        fun decodeBytes(bytes: ByteArray, maxSide: Int = MAX_SIDE): Bitmap {
            val bmp = ImageDecoder.decodeBitmap(ImageDecoder.createSource(ByteBuffer.wrap(bytes))) { decoder, info, _ ->
                decoder.allocator = ImageDecoder.ALLOCATOR_SOFTWARE
                decoder.isMutableRequired = false
                val side = maxOf(info.size.width, info.size.height)
                if (side > maxSide) {
                    val s = maxSide.toFloat() / side
                    decoder.setTargetSize((info.size.width * s).toInt().coerceAtLeast(1), (info.size.height * s).toInt().coerceAtLeast(1))
                }
            }
            return if (bmp.config == Bitmap.Config.ARGB_8888) bmp else bmp.copy(Bitmap.Config.ARGB_8888, false)
        }

        /** "data:image/png;base64,…" → bytes. */
        fun dataUrlBytes(dataUrl: String): ByteArray {
            val comma = dataUrl.indexOf(',')
            if (!dataUrl.startsWith("data:") || comma < 0 || !dataUrl.substring(0, comma).endsWith(";base64")) {
                throw BridgeException(ErrorCode.INVALID, "not a base64 data URL")
            }
            return android.util.Base64.decode(dataUrl.substring(comma + 1), android.util.Base64.DEFAULT)
        }
    }
}
