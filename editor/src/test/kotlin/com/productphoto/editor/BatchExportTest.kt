package com.productphoto.editor

import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Assert.fail
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder
import java.util.zip.ZipInputStream

class BatchExportTest {
    @get:Rule val tmp = TemporaryFolder()

    private fun code(block: () -> Unit): ErrorCode? = try {
        block(); null
    } catch (e: BridgeException) {
        e.code
    }

    @Test
    fun `nomes do lote _01 a _05, e 3 digitos com 100 ou mais`() {
        assertEquals(listOf("Nome_01", "Nome_02", "Nome_03", "Nome_04", "Nome_05"), BatchExport.batchNames("Nome", 5))
        assertEquals("Nome_05.png", BatchExport.batchNames("Nome", 5, "png").last())
        val many = BatchExport.batchNames("x", 100)
        assertEquals("x_001", many.first())
        assertEquals("x_100", many.last())
    }

    @Test
    fun `staging guarda as paginas do meio e devolve todas na ultima`() {
        val root = tmp.newFolder("batch")
        for (i in 0 until 4) assertNull(BatchExport.stage(root, BatchExport.spec("b1", i, 5), "png", byteArrayOf(i.toByte())))
        val files = BatchExport.stage(root, BatchExport.spec("b1", 4, 5), "png", byteArrayOf(4))!!
        assertEquals(5, files.size)
        files.forEachIndexed { i, f -> assertArrayEquals(byteArrayOf(i.toByte()), f.readBytes()) }
        assertEquals(listOf("0.png", "1.png", "2.png", "3.png", "4.png"), files.map { it.name })
    }

    @Test
    fun `lote com id novo apaga o velho, interrompido`() {
        val root = tmp.newFolder("batch")
        BatchExport.stage(root, BatchExport.spec("velho", 0, 3), "png", byteArrayOf(1))
        assertTrue(root.resolve("velho").isDirectory)
        BatchExport.stage(root, BatchExport.spec("novo", 0, 2), "png", byteArrayOf(2))
        assertFalse(root.resolve("velho").exists())
        assertTrue(root.resolve("novo/0.png").isFile)
    }

    @Test
    fun `pagina faltando no fim = INVALID e o lote some`() {
        val root = tmp.newFolder("batch")
        BatchExport.stage(root, BatchExport.spec("b", 0, 3), "png", byteArrayOf(0))
        assertEquals(ErrorCode.INVALID, code { BatchExport.stage(root, BatchExport.spec("b", 2, 3), "png", byteArrayOf(2)) })
        assertFalse(root.resolve("b").exists())
    }

    @Test
    fun `escala guardada junto da pagina do PDF`() {
        val root = tmp.newFolder("batch")
        val files = BatchExport.stage(root, BatchExport.spec("p", 0, 1), "png", byteArrayOf(9), scale = 2.0)!!
        assertEquals(2.0, BatchExport.stagedScale(files[0]), 1e-9)
        val other = BatchExport.stage(root, BatchExport.spec("q", 0, 1), "png", byteArrayOf(9))!!
        assertEquals(1.0, BatchExport.stagedScale(other[0]), 1e-9)
    }

    @Test
    fun `pedido invalido recusado`() {
        assertEquals(ErrorCode.INVALID, code { BatchExport.spec("b", 0, 0) })
        assertEquals(ErrorCode.INVALID, code { BatchExport.spec("b", 3, 3) })
        assertEquals(ErrorCode.INVALID, code { BatchExport.spec("b", -1, 3) })
        assertEquals(ErrorCode.INVALID, code { BatchExport.spec("../x", 0, 1) })
        assertEquals(ErrorCode.INVALID, code { BatchExport.spec("b", 0, BatchExport.MAX_COUNT + 1) })
        assertTrue(BatchExport.single().isLast)
    }

    @Test
    fun `destino por formato e acao`() {
        assertEquals(BatchOutput.GALLERY_IMAGES, BatchExport.outputOf(ExportFormat.PNG, ExportAction.SAVE))
        assertEquals(BatchOutput.GALLERY_IMAGES, BatchExport.outputOf(ExportFormat.WEBP, ExportAction.SAVE))
        assertEquals(BatchOutput.GALLERY_IMAGES, BatchExport.outputOf(ExportFormat.JPG, ExportAction.SAVE))
        assertEquals(BatchOutput.ZIP, BatchExport.outputOf(ExportFormat.PNG, ExportAction.SHARE))
        assertEquals(BatchOutput.ZIP, BatchExport.outputOf(ExportFormat.SVG, ExportAction.SAVE))
        assertEquals(BatchOutput.ZIP, BatchExport.outputOf(ExportFormat.SVG, ExportAction.SHARE))
        assertEquals(BatchOutput.PDF, BatchExport.outputOf(ExportFormat.PDF, ExportAction.SAVE))
        assertEquals(BatchOutput.PDF, BatchExport.outputOf(ExportFormat.PDF, ExportAction.SHARE))
        assertEquals(ErrorCode.UNSUPPORTED, code { BatchExport.outputOf(ExportFormat.PDF, ExportAction.PRINT) })
        assertEquals(ErrorCode.UNSUPPORTED, code { BatchExport.outputOf(ExportFormat.PNG, ExportAction.MOCKUP) })
        assertEquals(ErrorCode.UNSUPPORTED, code { BatchExport.outputOf(ExportFormat.MP4, ExportAction.SAVE) })
        assertEquals(ErrorCode.UNSUPPORTED, code { BatchExport.outputOf(ExportFormat.GIF, ExportAction.SHARE) })
        assertEquals(ErrorCode.INVALID, code { BatchExport.outputOf(ExportFormat.ZIP, ExportAction.SAVE) })
        assertEquals("png", BatchExport.stagedExt(ExportFormat.PDF))
        assertEquals("webp", BatchExport.stagedExt(ExportFormat.WEBP))
    }

    @Test
    fun `zip relido tem as 5 entradas com os bytes certos`() {
        val files = (1..5).map { i -> tmp.newFile("$i.png").apply { writeBytes(ByteArray(10 * i) { i.toByte() }) } }
        val out = tmp.root.resolve("lote.zip")
        BatchExport.zip(BatchExport.batchNames("Nome", 5, "png").zip(files), out)
        val seen = mutableMapOf<String, ByteArray>()
        ZipInputStream(out.inputStream()).use { z ->
            while (true) {
                val e = z.nextEntry ?: break
                seen[e.name] = z.readBytes()
            }
        }
        assertEquals(listOf("Nome_01.png", "Nome_02.png", "Nome_03.png", "Nome_04.png", "Nome_05.png"), seen.keys.toList())
        files.forEachIndexed { i, f -> assertArrayEquals(f.readBytes(), seen["Nome_0${i + 1}.png"]) }
    }

    @Test
    fun `layout sem marcas = pagina do tamanho da imagem, 1 px = 1 pt`() {
        val l = PrintLayout.of(1080, 1350, 1.0, 0.0, false)
        assertEquals(1080, l.pageWidth)
        assertEquals(1350, l.pageHeight)
        assertEquals(Box(0f, 0f, 1080f, 1350f), l.image)
        assertEquals(l.image, l.trim)
        assertTrue(l.marks.isEmpty())
        // 2× de resolução: a página em pt é a mesma
        assertEquals(1080, PrintLayout.of(2160, 2700, 2.0, 0.0, false).pageWidth)
    }

    @Test
    fun `com marcas = 72 pt a mais por eixo e 8 linhas fora da arte, dentro da pagina`() {
        for (bleed in listOf(0.0, 36.0)) {
            // imagem com a sangria renderizada: (1080 + 2·b) px a 2×
            val px = ((1080 + 2 * bleed) * 2).toInt()
            val l = PrintLayout.of(px, px, 2.0, bleed, true)
            val side = (1080 + 2 * bleed + 72).toInt()
            assertEquals(side, l.pageWidth)
            assertEquals(side, l.pageHeight)
            assertEquals(Box(36f + bleed.toFloat(), 36f + bleed.toFloat(), 36f + bleed.toFloat() + 1080f, 36f + bleed.toFloat() + 1080f), l.trim)
            assertEquals(8, l.marks.size)
            for (m in l.marks) {
                val len = kotlin.math.hypot((m.x2 - m.x1).toDouble(), (m.y2 - m.y1).toDouble())
                assertEquals(PrintLayout.MARK_LEN.toDouble(), len, 1e-3)
                for ((x, y) in listOf(m.x1 to m.y1, m.x2 to m.y2, (m.x1 + m.x2) / 2 to (m.y1 + m.y2) / 2)) {
                    assertFalse("marca $m invade a arte", l.image.containsStrict(x, y))
                    assertTrue("marca $m fora da página", x in 0f..l.pageWidth.toFloat() && y in 0f..l.pageHeight.toFloat())
                }
                // cada marca fica na linha de corte (horizontal na altura do corte, vertical na coluna)
                val onTrim = (m.y1 == m.y2 && (m.y1 == l.trim.top || m.y1 == l.trim.bottom)) ||
                    (m.x1 == m.x2 && (m.x1 == l.trim.left || m.x1 == l.trim.right))
                assertTrue("marca $m fora da linha de corte", onTrim)
                // começa a 6 pt da arte
                val gap = if (m.y1 == m.y2) minOf(kotlin.math.abs(minOf(m.x1, m.x2) - l.image.right), kotlin.math.abs(l.image.left - maxOf(m.x1, m.x2)))
                else minOf(kotlin.math.abs(minOf(m.y1, m.y2) - l.image.bottom), kotlin.math.abs(l.image.top - maxOf(m.y1, m.y2)))
                assertEquals(PrintLayout.MARK_GAP, gap, 1e-3f)
            }
        }
    }

    @Test
    fun `layout recusa imagem vazia`() {
        try {
            PrintLayout.of(0, 10, 1.0, 0.0, true)
            fail("esperava IllegalArgumentException")
        } catch (_: IllegalArgumentException) {
        }
    }
}
