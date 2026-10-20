package com.productphoto.ai.mlkit

import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.Typeface
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.productphoto.ai.api.RgbaImage
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith

/** Prova da fase 3 (texto): texto desenhado numa imagem fixa → bloco com o texto, caixa no lugar certo. */
@RunWith(AndroidJUnit4::class)
class TextDetectorInstrumentedTest {

    @Test
    fun detectsDrawnText() = runBlocking {
        val bmp = Bitmap.createBitmap(800, 400, Bitmap.Config.ARGB_8888).apply { eraseColor(Color.WHITE) }
        val paint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = Color.BLACK; textSize = 72f; typeface = Typeface.DEFAULT_BOLD
        }
        Canvas(bmp).drawText("SUMMER SALE 50", 80f, 220f, paint)

        val blocks = MlKitTextDetector().detect(RgbaImage(bmp))

        val all = blocks.joinToString(" ") { it.text }.uppercase()
        assertTrue("text found: $all", "SUMMER" in all && "SALE" in all)
        val box = blocks.first { "SUMMER" in it.text.uppercase() }.box
        assertTrue("box $box", box.left in 40f..140f && box.top in 120f..200f && box.bottom in 200f..260f)
        assertTrue(blocks.all { it.lines.isNotEmpty() })
    }

    @Test
    fun blankImageHasNoText() = runBlocking {
        val bmp = Bitmap.createBitmap(320, 240, Bitmap.Config.ARGB_8888).apply { eraseColor(Color.LTGRAY) }
        assertTrue(MlKitTextDetector().detect(RgbaImage(bmp)).isEmpty())
    }
}
