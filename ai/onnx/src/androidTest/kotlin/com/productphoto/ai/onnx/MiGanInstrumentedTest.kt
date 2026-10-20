package com.productphoto.ai.onnx

import android.graphics.Bitmap
import android.graphics.Color
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import com.productphoto.ai.api.Mask
import com.productphoto.ai.api.RgbaImage
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import java.io.File

/** Prova da fase 3 (inpaint): imagem fixa → mesma dimensão, fora do buraco intacto, o quadrado some. */
@RunWith(AndroidJUnit4::class)
class MiGanInstrumentedTest {

    private fun modelFile(): File {
        val ctx = InstrumentationRegistry.getInstrumentation().targetContext
        val f = File(ctx.cacheDir, "migan_test.onnx")
        if (!f.exists()) ctx.assets.open("models/migan_pipeline_v2.onnx").use { i -> f.outputStream().use { i.copyTo(it) } }
        return f
    }

    @Test
    fun redSquareIsFilledWithSurroundings() = runBlocking {
        val w = 640
        val h = 480
        // Fundo em gradiente suave cinza-azulado, quadrado vermelho no meio.
        val bmp = Bitmap.createBitmap(w, h, Bitmap.Config.ARGB_8888)
        for (y in 0 until h) for (x in 0 until w) bmp.setPixel(x, y, Color.rgb(90 + x / 16, 110 + y / 16, 160))
        val alpha = ByteArray(w * h)
        for (y in 200 until 280) for (x in 280 until 360) {
            bmp.setPixel(x, y, Color.RED)
        }
        for (y in 195 until 285) for (x in 275 until 365) alpha[y * w + x] = 0xFF.toByte()

        val out = MiGanInpainter(modelFile()).inpaint(RgbaImage(bmp), Mask(w, h, alpha)).bitmap

        assertEquals(w, out.width)
        assertEquals(h, out.height)
        assertEquals(bmp.getPixel(10, 10), out.getPixel(10, 10))
        assertEquals(bmp.getPixel(600, 450), out.getPixel(600, 450))
        var redLeft = 0
        for (y in 200 until 280) for (x in 280 until 360) {
            val c = out.getPixel(x, y)
            if (Color.red(c) > 180 && Color.green(c) < 80 && Color.blue(c) < 80) redLeft++
        }
        assertTrue("red pixels left inside hole: $redLeft", redLeft < 80 * 80 / 50)
        val center = out.getPixel(320, 240)
        assertTrue("center should look like the background: ${Integer.toHexString(center)}", Color.blue(center) > Color.red(center))
    }

    @Test
    fun emptyMaskReturnsSameImage() = runBlocking {
        val bmp = Bitmap.createBitmap(64, 64, Bitmap.Config.ARGB_8888).apply { eraseColor(Color.GREEN) }
        val out = MiGanInpainter(modelFile()).inpaint(RgbaImage(bmp), Mask(64, 64, ByteArray(64 * 64))).bitmap
        assertEquals(Color.GREEN, out.getPixel(32, 32))
    }
}
