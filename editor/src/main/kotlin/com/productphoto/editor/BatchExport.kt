package com.productphoto.editor

import java.io.File
import java.util.zip.ZipEntry
import java.util.zip.ZipOutputStream
import kotlin.math.roundToInt

/**
 * Exportação em lote e PDF de impressão (TASK-10), sem Android: nomes, staging das páginas no cache, ZIP e geometria das
 * marcas de corte. O desenho no `PdfDocument` (EditorExports) usa o [PrintLayout] daqui.
 */

/** Um pedido do lote: a página `index` de `count`, todas com o mesmo `id` (uma por mensagem, em ordem). */
data class BatchSpec(val id: String, val index: Int, val count: Int) {
    val isLast: Boolean get() = index == count - 1
}

/** Opções do PDF: marcas de corte, sangria (px do documento, já renderizada na imagem) e px da imagem por px do documento. */
data class PrintOptions(val cropMarks: Boolean = false, val bleedPx: Double = 0.0, val scale: Double = 1.0)

/** O que o fim do lote produz. */
enum class BatchOutput {
    /** PNG/JPG/WebP salvos: um arquivo por página em Pictures/ProductPhoto. */
    GALLERY_IMAGES,
    /** Compartilhar imagens/SVG, ou salvar SVG: um `.zip` com uma entrada por página. */
    ZIP,
    /** Um `.pdf` com uma página por página do projeto. */
    PDF,
}

object BatchExport {
    /** Teto de páginas por lote (o editor limita o projeto a 30; folga para o futuro, nunca ilimitado). */
    const val MAX_COUNT = 100
    private val ID = Regex("[A-Za-z0-9_-]{1,64}")

    /** Valida o pedido que veio do JS. */
    fun spec(id: String, index: Int, count: Int): BatchSpec {
        if (!ID.matches(id)) throw BridgeException(ErrorCode.INVALID, "batch.id")
        if (count !in 1..MAX_COUNT) throw BridgeException(ErrorCode.INVALID, "batch.count $count")
        if (index !in 0 until count) throw BridgeException(ErrorCode.INVALID, "batch.index $index")
        return BatchSpec(id, index, count)
    }

    /** PDF de uma página só (sem `batch` no pedido): o mesmo caminho, com `count` 1. */
    fun single(): BatchSpec = BatchSpec("single-${System.nanoTime()}", 0, 1)

    /** Destino do lote por formato e ação. Vídeo, imprimir e mockup não têm lote; `zip` não é formato de entrada. */
    fun outputOf(format: ExportFormat, action: ExportAction): BatchOutput {
        if (format == ExportFormat.MP4 || format == ExportFormat.GIF) throw BridgeException(ErrorCode.UNSUPPORTED, "vídeo não tem exportação em lote")
        if (format == ExportFormat.ZIP) throw BridgeException(ErrorCode.INVALID, "format zip")
        if (action == ExportAction.PRINT || action == ExportAction.MOCKUP) {
            throw BridgeException(ErrorCode.UNSUPPORTED, if (format == ExportFormat.PDF) "o PDF é para salvar ou compartilhar" else "lote só salva ou compartilha")
        }
        return when {
            format == ExportFormat.PDF -> BatchOutput.PDF
            action == ExportAction.SAVE && format in GALLERY_FORMATS -> BatchOutput.GALLERY_IMAGES
            else -> BatchOutput.ZIP
        }
    }
    private val GALLERY_FORMATS = setOf(ExportFormat.PNG, ExportFormat.JPG, ExportFormat.WEBP)

    /** Extensão de cada página guardada: no PDF a página chega como PNG. */
    fun stagedExt(format: ExportFormat): String = if (format == ExportFormat.PDF) "png" else format.ext

    /**
     * Guarda a página em `root/<id>/<index>.<ext>` (e a escala em `<index>.scale`, se dada). Um `id` novo apaga os lotes
     * velhos (um lote interrompido não acumula). Na última página devolve os `count` arquivos em ordem; antes, null. Faltou
     * página = lote apagado e `INVALID`. Quem recebe a lista apaga a pasta (`parentFile`) quando terminar.
     */
    fun stage(root: File, spec: BatchSpec, ext: String, bytes: ByteArray, scale: Double? = null): List<File>? {
        val dir = File(root, spec.id)
        if (!dir.isDirectory) {
            root.listFiles()?.forEach { if (it.name != spec.id) it.deleteRecursively() }
            if (!dir.mkdirs() && !dir.isDirectory) throw BridgeException(ErrorCode.INTERNAL, "cache do lote")
        }
        File(dir, "${spec.index}.$ext").writeBytes(bytes)
        if (scale != null) File(dir, "${spec.index}.scale").writeText(scale.toString())
        if (!spec.isLast) return null
        val files = (0 until spec.count).map { File(dir, "$it.$ext") }
        val missing = files.count { !it.isFile }
        if (missing > 0) {
            dir.deleteRecursively()
            throw BridgeException(ErrorCode.INVALID, "lote incompleto: faltam $missing de ${spec.count} páginas")
        }
        return files
    }

    /** A escala guardada junto da página (`<index>.scale`); sem ela, 1. */
    fun stagedScale(page: File): Double =
        File(page.parentFile, page.nameWithoutExtension + ".scale").takeIf { it.isFile }?.readText()?.trim()?.toDoubleOrNull()
            ?.takeIf { it > 0 } ?: 1.0

    /** `Nome_01`, `Nome_02`… (3 dígitos a partir de 100 páginas); com `ext`, `Nome_01.png`. */
    fun batchNames(base: String, count: Int, ext: String? = null): List<String> {
        val digits = maxOf(2, count.toString().length)
        return (1..count).map { i -> "${base}_${i.toString().padStart(digits, '0')}" + (ext?.let { ".$it" } ?: "") }
    }

    /** ZIP com uma entrada por arquivo, na ordem dada (nome da entrada → arquivo). */
    fun zip(entries: List<Pair<String, File>>, out: File) {
        ZipOutputStream(out.outputStream().buffered()).use { z ->
            for ((name, file) in entries) {
                z.putNextEntry(ZipEntry(name))
                file.inputStream().use { it.copyTo(z) }
                z.closeEntry()
            }
        }
    }
}

/** Retângulo em pt (origem no canto superior esquerdo, como o Canvas do `PdfDocument`). */
data class Box(val left: Float, val top: Float, val right: Float, val bottom: Float) {
    val width: Float get() = right - left
    val height: Float get() = bottom - top
    /** Ponto estritamente dentro (a borda não conta). */
    fun containsStrict(x: Float, y: Float): Boolean = x > left && x < right && y > top && y < bottom
}

data class Line(val x1: Float, val y1: Float, val x2: Float, val y2: Float)

/**
 * Geometria de uma página do PDF de impressão. 1 px do documento = 1 pt (a gráfica escala para o tamanho físico); a imagem
 * (com a sangria) ocupa `image`, o corte é `trim` (a imagem menos a sangria). Com marcas: margem de 36 pt em volta e 8
 * linhas (2 por canto, 18 pt) alinhadas às bordas do corte, começando 6 pt FORA da arte (da imagem com a sangria).
 */
data class PrintLayout(val pageWidth: Int, val pageHeight: Int, val image: Box, val trim: Box, val marks: List<Line>) {
    companion object {
        const val MARGIN = 36f
        const val MARK_LEN = 18f
        const val MARK_GAP = 6f

        fun of(imageWidthPx: Int, imageHeightPx: Int, scale: Double, bleedPx: Double, cropMarks: Boolean): PrintLayout {
            require(imageWidthPx > 0 && imageHeightPx > 0) { "imagem vazia" }
            val s = if (scale > 0) scale else 1.0
            val w = (imageWidthPx / s).toFloat()
            val h = (imageHeightPx / s).toFloat()
            val bleed = bleedPx.coerceIn(0.0, minOf(w, h) / 4.0).toFloat()
            val m = if (cropMarks) MARGIN else 0f
            val image = Box(m, m, m + w, m + h)
            val trim = Box(image.left + bleed, image.top + bleed, image.right - bleed, image.bottom - bleed)
            val marks = if (!cropMarks) emptyList() else {
                val near = MARK_GAP
                val far = MARK_GAP + MARK_LEN
                listOf(
                    // superior esquerdo: horizontal na altura do corte, vertical na coluna do corte
                    Line(image.left - far, trim.top, image.left - near, trim.top),
                    Line(trim.left, image.top - far, trim.left, image.top - near),
                    // superior direito
                    Line(image.right + near, trim.top, image.right + far, trim.top),
                    Line(trim.right, image.top - far, trim.right, image.top - near),
                    // inferior esquerdo
                    Line(image.left - far, trim.bottom, image.left - near, trim.bottom),
                    Line(trim.left, image.bottom + near, trim.left, image.bottom + far),
                    // inferior direito
                    Line(image.right + near, trim.bottom, image.right + far, trim.bottom),
                    Line(trim.right, image.bottom + near, trim.right, image.bottom + far),
                )
            }
            return PrintLayout((w + 2 * m).roundToInt(), (h + 2 * m).roundToInt(), image, trim, marks)
        }
    }
}
