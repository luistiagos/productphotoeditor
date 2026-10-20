package com.productphoto.editor

import android.app.Activity
import android.content.ContentValues
import android.content.Context
import android.content.Intent
import android.graphics.BitmapFactory
import android.media.MediaScannerConnection
import android.os.Build
import android.os.Environment
import android.provider.MediaStore
import androidx.core.content.FileProvider
import androidx.print.PrintHelper
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.File

/** Destinos da exportação do editor (§7): galeria/Downloads, compartilhar e imprimir. */
object EditorExports {
    private const val ALBUM = "ProductPhoto"

    /** PNG/JPG em Pictures/ProductPhoto; SVG em Download/ProductPhoto (MediaStore.Images não aceita SVG). */
    suspend fun save(context: Context, format: ExportFormat, name: String, bytes: ByteArray): String = withContext(Dispatchers.IO) {
        val file = "$name.${format.ext}"
        val isImage = format != ExportFormat.SVG
        val dir = if (isImage) Environment.DIRECTORY_PICTURES else Environment.DIRECTORY_DOWNLOADS
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            val collection = if (isImage) MediaStore.Images.Media.EXTERNAL_CONTENT_URI else MediaStore.Downloads.EXTERNAL_CONTENT_URI
            val values = ContentValues().apply {
                put(MediaStore.MediaColumns.DISPLAY_NAME, file)
                put(MediaStore.MediaColumns.MIME_TYPE, format.mime)
                put(MediaStore.MediaColumns.RELATIVE_PATH, "$dir/$ALBUM")
                put(MediaStore.MediaColumns.IS_PENDING, 1)
            }
            val resolver = context.contentResolver
            val uri = resolver.insert(collection, values) ?: error("MediaStore insert failed")
            try {
                resolver.openOutputStream(uri)!!.use { it.write(bytes) }
                values.clear()
                values.put(MediaStore.MediaColumns.IS_PENDING, 0)
                resolver.update(uri, values, null, null)
            } catch (e: Exception) {
                resolver.delete(uri, null, null)
                throw e
            }
        } else {
            @Suppress("DEPRECATION")
            val out = File(Environment.getExternalStoragePublicDirectory(dir), ALBUM).apply { mkdirs() }
            val f = File(out, file)
            f.writeBytes(bytes)
            MediaScannerConnection.scanFile(context, arrayOf(f.absolutePath), arrayOf(format.mime), null)
        }
        "${if (isImage) "Pictures" else "Download"}/$ALBUM/$file"
    }

    suspend fun share(activity: Activity, format: ExportFormat, name: String, bytes: ByteArray) {
        val file = withContext(Dispatchers.IO) {
            val dir = File(activity.cacheDir, "exports").apply { mkdirs() }
            dir.listFiles()?.forEach { it.delete() } // só a exportação mais recente fica no cache
            File(dir, "$name.${format.ext}").apply { writeBytes(bytes) }
        }
        val uri = FileProvider.getUriForFile(activity, "${activity.packageName}.editor.files", file)
        val send = Intent(Intent.ACTION_SEND).apply {
            type = format.mime
            putExtra(Intent.EXTRA_STREAM, uri)
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
        }
        activity.startActivity(Intent.createChooser(send, null))
    }

    suspend fun print(activity: Activity, name: String, bytes: ByteArray) {
        val bmp = withContext(Dispatchers.Default) { BitmapFactory.decodeByteArray(bytes, 0, bytes.size) }
            ?: throw BridgeException(ErrorCode.INVALID, "imagem inválida")
        PrintHelper(activity).apply { scaleMode = PrintHelper.SCALE_MODE_FIT }.printBitmap(name, bmp)
    }
}
