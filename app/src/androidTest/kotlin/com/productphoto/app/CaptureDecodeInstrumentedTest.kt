package com.productphoto.app

import android.graphics.Bitmap
import android.graphics.Color
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import java.io.ByteArrayOutputStream

/**
 * Câmera (ARQUITETURA §16.4 task 1): o Uri do FileProvider aceita escrita (é o que o app de câmera faz) e o
 * `decode` aplica a orientação EXIF. A câmera do emulador grava pixels já em pé (EXIF 1), então a rotação é
 * provada aqui com um JPEG paisagem marcado como "girar 90°" (orientação 6).
 */
@RunWith(AndroidJUnit4::class)
class CaptureDecodeInstrumentedTest {
    private val context = InstrumentationRegistry.getInstrumentation().targetContext

    @Test
    fun captureUriIsWritableAndExifRotationIsApplied() = runBlocking<Unit> {
        val deps = AppProductDeps(context, AppGraph(context), Navigator())
        val uri = deps.newCaptureUri()
        assertEquals("content", uri.scheme)
        assertEquals("${context.packageName}.editor.files", uri.authority)

        val bmp = Bitmap.createBitmap(200, 100, Bitmap.Config.ARGB_8888).apply {
            eraseColor(Color.BLUE)
            for (y in 0 until 100) for (x in 0 until 20) setPixel(x, y, Color.RED)   // faixa vermelha à esquerda
        }
        val jpeg = ByteArrayOutputStream().also { bmp.compress(Bitmap.CompressFormat.JPEG, 95, it) }.toByteArray()
        context.contentResolver.openOutputStream(uri)!!.use { it.write(withExifOrientation(jpeg, 6)) }

        val decoded = deps.decode(uri)
        assertEquals(100, decoded.width)
        assertEquals(200, decoded.height)
        // orientação 6 = girar 90° no sentido horário: a faixa da esquerda vai para o topo
        val top = decoded.getPixel(50, 5)
        assertTrue("topo deveria ser vermelho: ${Integer.toHexString(top)}", Color.red(top) > 200 && Color.blue(top) < 80)
    }

    /** Insere um APP1 Exif mínimo (big-endian, só a tag 0x0112) logo depois do SOI. */
    private fun withExifOrientation(jpeg: ByteArray, orientation: Int): ByteArray {
        val tiff = byteArrayOf(
            'M'.code.toByte(), 'M'.code.toByte(), 0, 42, 0, 0, 0, 8,   // cabeçalho, IFD0 em 8
            0, 1,                                                       // 1 entrada
            0x01, 0x12, 0, 3, 0, 0, 0, 1, 0, orientation.toByte(), 0, 0, // Orientation, SHORT, 1 valor
            0, 0, 0, 0,                                                 // sem próximo IFD
        )
        val payload = "Exif".toByteArray() + byteArrayOf(0, 0) + tiff
        val len = payload.size + 2
        val app1 = byteArrayOf(0xFF.toByte(), 0xE1.toByte(), (len shr 8).toByte(), len.toByte()) + payload
        return jpeg.copyOfRange(0, 2) + app1 + jpeg.copyOfRange(2, jpeg.size)
    }
}
