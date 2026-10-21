package com.productphoto.app

import android.content.ContentValues
import android.content.Context
import android.graphics.Bitmap
import android.graphics.ImageDecoder
import android.net.Uri
import android.os.Build
import android.os.Environment
import android.provider.MediaStore
import androidx.core.content.FileProvider
import com.productphoto.ai.api.Capability
import com.productphoto.ai.api.ChainEntry
import com.productphoto.editor.EditorStart
import com.productphoto.feature.product.ExportFormat
import com.productphoto.feature.product.ProductFlowDeps
import com.productphoto.feature.product.RemoverMode
import com.productphoto.feature.product.SceneLibrary
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.File
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

class AppProductDeps(
    private val context: Context,
    private val graph: AppGraph,
    private val navigator: Navigator,
) : ProductFlowDeps {
    override val remover = graph.backgroundRemover
    override val removerServedBy = graph.backgroundRemoverChain.lastServedBy
    override val composer = graph.composer
    override val scenes = SceneLibrary(context.assets, File(context.filesDir, "content/scenes"))

    override suspend fun decode(uri: Uri): Bitmap = withContext(Dispatchers.IO) {
        val source = ImageDecoder.createSource(context.contentResolver, uri)
        val bmp = ImageDecoder.decodeBitmap(source) { decoder, info, _ ->
            decoder.allocator = ImageDecoder.ALLOCATOR_SOFTWARE
            decoder.isMutableRequired = false
            val maxSide = maxOf(info.size.width, info.size.height)
            if (maxSide > MAX_SIDE) {
                val s = MAX_SIDE.toFloat() / maxSide
                decoder.setTargetSize((info.size.width * s).toInt(), (info.size.height * s).toInt())
            }
        }
        if (bmp.config == Bitmap.Config.ARGB_8888) bmp else bmp.copy(Bitmap.Config.ARGB_8888, false)
    }

    /** Foto da câmera em cacheDir/capture/ (caminho no editor_file_paths.xml, provider único do :editor; §17.2). */
    override fun newCaptureUri(): Uri {
        val dir = File(context.cacheDir, "capture").apply { mkdirs() }
        dir.listFiles()?.forEach { it.delete() }
        val file = File(dir, "foto_" + System.currentTimeMillis() + ".jpg")
        return FileProvider.getUriForFile(context, "${context.packageName}.editor.files", file)
    }

    override suspend fun export(bitmap: Bitmap, format: ExportFormat): String = withContext(Dispatchers.IO) {
        val name = "produto_" + SimpleDateFormat("yyyyMMdd_HHmmss", Locale.US).format(Date()) + "." + format.ext
        val compress = if (format == ExportFormat.PNG) Bitmap.CompressFormat.PNG else Bitmap.CompressFormat.JPEG
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            val values = ContentValues().apply {
                put(MediaStore.Images.Media.DISPLAY_NAME, name)
                put(MediaStore.Images.Media.MIME_TYPE, format.mime)
                put(MediaStore.Images.Media.RELATIVE_PATH, "${Environment.DIRECTORY_PICTURES}/$ALBUM")
                put(MediaStore.Images.Media.IS_PENDING, 1)
            }
            val resolver = context.contentResolver
            val uri = resolver.insert(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, values) ?: error("MediaStore insert failed")
            try {
                resolver.openOutputStream(uri)!!.use { check(bitmap.compress(compress, 95, it)) { "compress failed" } }
                values.clear()
                values.put(MediaStore.Images.Media.IS_PENDING, 0)
                resolver.update(uri, values, null, null)
            } catch (e: Exception) {
                resolver.delete(uri, null, null)
                throw e
            }
        } else {
            @Suppress("DEPRECATION")
            val dir = File(Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_PICTURES), ALBUM).apply { mkdirs() }
            val file = File(dir, name)
            file.outputStream().use { check(bitmap.compress(compress, 95, it)) { "compress failed" } }
            android.media.MediaScannerConnection.scanFile(context, arrayOf(file.absolutePath), arrayOf(format.mime), null)
        }
        "Pictures/$ALBUM/$name"
    }

    override suspend fun openInEditor(bitmap: Bitmap) {
        val name = graph.editorAssets.putPng(bitmap, "img")
        withContext(Dispatchers.Main) { navigator.push(Screen.Editor(EditorStart.Image(name, "Foto de produto"))) }
    }

    override suspend fun removerMode(): RemoverMode {
        val chain = graph.configStore.load().chainFor(Capability.BACKGROUND_REMOVER).map { it.provider }
        return when (chain) {
            listOf(MLKIT) -> RemoverMode.MLKIT
            listOf(U2NETP) -> RemoverMode.U2NETP
            else -> RemoverMode.AUTO
        }
    }

    override suspend fun setRemoverMode(mode: RemoverMode) {
        val chain = when (mode) {
            RemoverMode.AUTO -> listOf(MLKIT, U2NETP)
            RemoverMode.MLKIT -> listOf(MLKIT)
            RemoverMode.U2NETP -> listOf(U2NETP)
        }.map { ChainEntry(it) }
        graph.configStore.save(graph.configStore.load().withChain(Capability.BACKGROUND_REMOVER, chain))
    }

    private companion object {
        const val MAX_SIDE = 2048
        const val ALBUM = "ProductPhoto"
        const val MLKIT = "mlkit.subject"
        const val U2NETP = "onnx.u2netp"
    }
}
