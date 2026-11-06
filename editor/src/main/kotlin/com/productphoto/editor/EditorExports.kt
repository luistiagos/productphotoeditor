package com.productphoto.editor

import android.app.Activity
import android.content.ContentValues
import android.content.Context
import android.content.Intent
import android.graphics.BitmapFactory
import android.graphics.Color
import android.graphics.Paint
import android.graphics.RectF
import android.graphics.pdf.PdfDocument
import android.media.MediaScannerConnection
import android.os.Build
import android.os.Environment
import android.provider.MediaStore
import androidx.core.content.FileProvider
import androidx.print.PrintHelper
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.File
import java.io.OutputStream

/** Destinos da exportação do editor (§7): galeria/Downloads, compartilhar e imprimir. */
object EditorExports {
    private const val ALBUM = "ProductPhoto"

    /** PNG/JPG/WebP/GIF em Pictures/ProductPhoto; MP4 em Movies/ProductPhoto; SVG, PDF e ZIP em Download/ProductPhoto. */
    suspend fun save(context: Context, format: ExportFormat, name: String, bytes: ByteArray): String =
        store(context, format, "$name.${format.ext}") { it.write(bytes) }

    /** Um arquivo já montado (PDF/ZIP do lote) para a pasta pública do formato, por stream (não carrega na memória). */
    suspend fun saveFile(context: Context, format: ExportFormat, file: File): String =
        store(context, format, file.name) { out -> file.inputStream().use { it.copyTo(out) } }

    private suspend fun store(context: Context, format: ExportFormat, file: String, write: (OutputStream) -> Unit): String = withContext(Dispatchers.IO) {
        val isVideo = format == ExportFormat.MP4
        val isImage = format == ExportFormat.PNG || format == ExportFormat.JPG || format == ExportFormat.WEBP || format == ExportFormat.GIF
        val dir = when {
            isVideo -> Environment.DIRECTORY_MOVIES
            isImage -> Environment.DIRECTORY_PICTURES
            else -> Environment.DIRECTORY_DOWNLOADS
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            val collection = when {
                isVideo -> MediaStore.Video.Media.EXTERNAL_CONTENT_URI
                isImage -> MediaStore.Images.Media.EXTERNAL_CONTENT_URI
                else -> MediaStore.Downloads.EXTERNAL_CONTENT_URI
            }
            val values = ContentValues().apply {
                put(MediaStore.MediaColumns.DISPLAY_NAME, file)
                put(MediaStore.MediaColumns.MIME_TYPE, format.mime)
                put(MediaStore.MediaColumns.RELATIVE_PATH, "$dir/$ALBUM")
                put(MediaStore.MediaColumns.IS_PENDING, 1)
            }
            val resolver = context.contentResolver
            val uri = resolver.insert(collection, values) ?: error("MediaStore insert failed")
            try {
                resolver.openOutputStream(uri)!!.use(write)
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
            f.outputStream().use(write)
            MediaScannerConnection.scanFile(context, arrayOf(f.absolutePath), arrayOf(format.mime), null)
        }
        "${if (isVideo) "Movies" else if (isImage) "Pictures" else "Download"}/$ALBUM/$file"
    }

    /** Salva um arquivo de vídeo gerado diretamente na pasta Movies/ProductPhoto via stream. */
    suspend fun saveVideo(context: Context, name: String, videoFile: File): String = withContext(Dispatchers.IO) {
        val file = "$name.mp4"
        val dir = Environment.DIRECTORY_MOVIES
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            val collection = MediaStore.Video.Media.EXTERNAL_CONTENT_URI
            val values = ContentValues().apply {
                put(MediaStore.MediaColumns.DISPLAY_NAME, file)
                put(MediaStore.MediaColumns.MIME_TYPE, ExportFormat.MP4.mime)
                put(MediaStore.MediaColumns.RELATIVE_PATH, "$dir/$ALBUM")
                put(MediaStore.MediaColumns.IS_PENDING, 1)
            }
            val resolver = context.contentResolver
            val uri = resolver.insert(collection, values) ?: error("MediaStore insert failed")
            try {
                resolver.openOutputStream(uri)!!.use { outStream ->
                    videoFile.inputStream().use { inStream ->
                        inStream.copyTo(outStream)
                    }
                }
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
            videoFile.copyTo(f, overwrite = true)
            MediaScannerConnection.scanFile(context, arrayOf(f.absolutePath), arrayOf(ExportFormat.MP4.mime), null)
        }
        "Movies/$ALBUM/$file"
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

    suspend fun shareVideo(activity: Activity, name: String, videoFile: File) {
        val file = withContext(Dispatchers.IO) {
            val dir = File(activity.cacheDir, "exports").apply { mkdirs() }
            dir.listFiles()?.forEach { it.delete() }
            val target = File(dir, "$name.mp4")
            videoFile.copyTo(target, overwrite = true)
            target
        }
        val uri = FileProvider.getUriForFile(activity, "${activity.packageName}.editor.files", file)
        val send = Intent(Intent.ACTION_SEND).apply {
            type = ExportFormat.MP4.mime
            putExtra(Intent.EXTRA_STREAM, uri)
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
        }
        activity.startActivity(Intent.createChooser(send, null))
    }

    /**
     * `cacheDir/exports/<fileName>` vazio para o lote montar o PDF/ZIP (a pasta é a do FileProvider, `editor_file_paths.xml`);
     * como no `share`, só a exportação mais recente fica no cache.
     */
    suspend fun freshExportFile(context: Context, fileName: String): File = withContext(Dispatchers.IO) {
        val dir = File(context.cacheDir, "exports").apply { mkdirs() }
        dir.listFiles()?.forEach { it.delete() }
        File(dir, fileName)
    }

    /** Compartilha um arquivo que já está em `cacheDir/exports` (PDF/ZIP do lote). */
    fun shareFile(activity: Activity, format: ExportFormat, file: File) {
        val uri = FileProvider.getUriForFile(activity, "${activity.packageName}.editor.files", file)
        val send = Intent(Intent.ACTION_SEND).apply {
            type = format.mime
            putExtra(Intent.EXTRA_STREAM, uri)
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
        }
        activity.startActivity(Intent.createChooser(send, null))
    }

    /**
     * PDF de impressão pelo `PdfDocument` da plataforma: uma página por imagem (PNG da página com a sangria), no tamanho e
     * com as marcas do [PrintLayout]. Cada imagem é decodificada só na hora e reciclada depois de `finishPage` (o lote não
     * segura N bitmaps). Em erro, o documento é fechado e o arquivo parcial apagado.
     */
    fun writePdf(pages: List<Pair<File, Double>>, options: PrintOptions, out: File) {
        val doc = PdfDocument()
        try {
            val mark = Paint().apply {
                color = Color.BLACK
                style = Paint.Style.STROKE
                strokeWidth = 0.5f
                isAntiAlias = true
            }
            val paint = Paint(Paint.FILTER_BITMAP_FLAG or Paint.ANTI_ALIAS_FLAG)
            pages.forEachIndexed { i, (file, scale) ->
                val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
                BitmapFactory.decodeFile(file.path, bounds)
                if (bounds.outWidth <= 0 || bounds.outHeight <= 0) throw BridgeException(ErrorCode.INVALID, "página ${i + 1} inválida")
                val layout = PrintLayout.of(bounds.outWidth, bounds.outHeight, scale, options.bleedPx, options.cropMarks)
                val bmp = BitmapFactory.decodeFile(file.path) ?: throw BridgeException(ErrorCode.INVALID, "página ${i + 1} inválida")
                try {
                    val page = doc.startPage(PdfDocument.PageInfo.Builder(layout.pageWidth, layout.pageHeight, i + 1).create())
                    val c = page.canvas
                    c.drawColor(Color.WHITE)
                    c.drawBitmap(bmp, null, RectF(layout.image.left, layout.image.top, layout.image.right, layout.image.bottom), paint)
                    for (l in layout.marks) c.drawLine(l.x1, l.y1, l.x2, l.y2, mark)
                    doc.finishPage(page)
                } finally {
                    bmp.recycle()
                }
            }
            out.outputStream().buffered().use { doc.writeTo(it) }
        } catch (e: Throwable) {
            out.delete()
            throw e
        } finally {
            doc.close()
        }
    }

    suspend fun print(activity: Activity, name: String, bytes: ByteArray) {
        val bmp = withContext(Dispatchers.Default) { BitmapFactory.decodeByteArray(bytes, 0, bytes.size) }
            ?: throw BridgeException(ErrorCode.INVALID, "imagem inválida")
        PrintHelper(activity).apply { scaleMode = PrintHelper.SCALE_MODE_FIT }.printBitmap(name, bmp)
    }
}
