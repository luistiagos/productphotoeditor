package com.productphoto.imaging

import android.graphics.Bitmap
import android.graphics.Color
import android.graphics.PointF
import android.graphics.RectF
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.productphoto.ai.api.CompositeOptions
import com.productphoto.ai.api.Mask
import com.productphoto.ai.api.Placement
import com.productphoto.ai.api.RgbaImage
import com.productphoto.ai.api.Scene
import com.productphoto.ai.api.SceneMeta
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith

/** Máscara sintética → sombra abaixo da base, nada acima do produto (prova da fase 2). */
@RunWith(AndroidJUnit4::class)
class ComposerInstrumentedTest {

    @Test
    fun syntheticMaskCastsShadowBelowBase() = runBlocking {
        val sceneBmp = Bitmap.createBitmap(600, 600, Bitmap.Config.ARGB_8888).apply { eraseColor(Color.rgb(200, 200, 200)) }
        val productBmp = Bitmap.createBitmap(200, 300, Bitmap.Config.ARGB_8888).apply { eraseColor(Color.rgb(20, 60, 220)) }
        val alpha = ByteArray(200 * 300)
        for (y in 50 until 250) for (x in 50 until 150) alpha[y * 200 + x] = 0xFF.toByte()
        val meta = SceneMeta(floorY = .7f, lightDirDeg = 270f, lightElevationDeg = 50f, shadowSoftness = .4f,
            colorTempK = 6500, placement = RectF(.3f, .3f, .7f, .7f))

        // centro do recorte (100×200) em (300, 320) → base em y = 420
        val out = LocalSceneComposer().compose(
            RgbaImage(productBmp), Mask(200, 300, alpha), Scene("t", RgbaImage(sceneBmp), meta),
            Placement(PointF(300f, 320f), 1f, 0f), CompositeOptions(),
        ).bitmap

        assertEquals(600, out.width)
        fun lum(x: Int, y: Int) = out.getPixel(x, y).let { (Color.red(it) + Color.green(it) + Color.blue(it)) / 3 }
        assertTrue("abaixo da base deve escurecer: ${lum(300, 423)}", lum(300, 423) < 185)
        assertEquals("acima do produto não muda", 200, lum(300, 150))
        assertTrue("produto visível", Color.blue(out.getPixel(300, 320)) > 180)
    }
}
