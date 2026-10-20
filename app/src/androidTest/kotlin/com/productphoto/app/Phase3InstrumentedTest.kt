package com.productphoto.app

import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.Typeface
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import com.productphoto.ai.api.Capability
import com.productphoto.ai.api.ChainEntry
import com.productphoto.ai.api.ProviderConfig
import com.productphoto.ai.api.RgbaImage
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import java.io.File

/** Prova da fase 3 pelas cadeias reais do app (ARQUITETURA §14.4, tasks 4 e 6). */
@RunWith(AndroidJUnit4::class)
class Phase3InstrumentedTest {
    private val context = InstrumentationRegistry.getInstrumentation().targetContext

    @Test
    fun removeTextThroughTheChains() = runBlocking {
        val graph = AppGraph(context)
        val w = 800
        val h = 500
        val bmp = Bitmap.createBitmap(w, h, Bitmap.Config.ARGB_8888)
        for (y in 0 until h) for (x in 0 until w) bmp.setPixel(x, y, Color.rgb(200 - y / 8, 180, 120 + x / 10))
        Canvas(bmp).drawText("SUMMER SALE", 120f, 260f, Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = Color.WHITE; textSize = 80f; typeface = Typeface.DEFAULT_BOLD
        })
        val image = RgbaImage(bmp)

        val blocks = graph.textRemover.detect(image)
        assertTrue("blocks: ${blocks.map { it.text }}", blocks.any { "SUMMER" in it.text.uppercase() })
        val mask = graph.textRemover.mask(image, blocks)
        assertTrue(mask.alpha.any { it.toInt() != 0 })

        val out = graph.textRemover.remove(image, blocks)
        assertEquals(w, out.width)
        assertEquals(h, out.height)
        assertEquals("onnx.migan", graph.inpainter.chain.lastServedBy.value?.providerId)
        assertEquals("mlkit.text-bundled", graph.textDetector.chain.lastServedBy.value?.providerId)
        val after = graph.textDetector.detect(out).joinToString(" ") { it.text }.uppercase()
        assertTrue("text still found after removal: $after", "SUMMER" !in after && "SALE" !in after)
    }

    @Test
    fun configSavedByOlderVersionGetsNewDefaultChains() = runBlocking {
        val file = File(context.cacheDir, "old_provider_config.json")
        val old = ProviderConfig().withChain(Capability.BACKGROUND_REMOVER, listOf(ChainEntry("onnx.u2netp")))
        file.writeText(old.toJson())

        val loaded = FileProviderConfigStore(file).load()

        assertEquals(listOf("onnx.u2netp"), loaded.chainFor(Capability.BACKGROUND_REMOVER).map { it.provider })
        assertEquals(listOf("onnx.migan"), loaded.chainFor(Capability.INPAINTER).map { it.provider })
        assertEquals(listOf("vtracer"), loaded.chainFor(Capability.VECTORIZER).map { it.provider })
    }
}
