package com.productphoto.ai.vtracer

import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.util.Xml
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.productphoto.ai.api.ColorMode
import com.productphoto.ai.api.RgbaImage
import com.productphoto.ai.api.VectorizeOptions
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.xmlpull.v1.XmlPullParser
import java.io.StringReader

/** Prova da fase 3 (SVG): imagem fixa → SVG que o XmlPullParser aceita, com paths e o tamanho certo. */
@RunWith(AndroidJUnit4::class)
class VectorizerInstrumentedTest {

    private fun logo(): Bitmap = Bitmap.createBitmap(300, 200, Bitmap.Config.ARGB_8888).apply {
        eraseColor(Color.WHITE)
        val c = Canvas(this)
        c.drawCircle(90f, 100f, 60f, Paint(Paint.ANTI_ALIAS_FLAG).apply { color = Color.rgb(220, 40, 40) })
        c.drawRect(170f, 50f, 270f, 150f, Paint().apply { color = Color.rgb(30, 60, 200) })
    }

    private data class Svg(val width: String?, val height: String?, val paths: List<Map<String, String>>)

    private fun parse(svg: String): Svg {
        val p = Xml.newPullParser().apply { setInput(StringReader(svg)) }
        var w: String? = null
        var h: String? = null
        val paths = mutableListOf<Map<String, String>>()
        while (p.next() != XmlPullParser.END_DOCUMENT) {
            if (p.eventType != XmlPullParser.START_TAG) continue
            val attrs = (0 until p.attributeCount).associate { p.getAttributeName(it) to p.getAttributeValue(it) }
            when (p.name) {
                "svg" -> { w = attrs["width"]; h = attrs["height"] }
                "path" -> paths += attrs
            }
        }
        return Svg(w, h, paths)
    }

    @Test
    fun colorImageBecomesValidSvg() = runBlocking {
        val svg = VTracerVectorizer().toSvg(RgbaImage(logo()))
        val doc = parse(svg)
        assertEquals("300", doc.width)
        assertEquals("200", doc.height)
        assertTrue("paths: ${doc.paths.size}", doc.paths.size >= 3)
        assertTrue(doc.paths.all { !it["d"].isNullOrBlank() })
        val fills = doc.paths.mapNotNull { it["fill"]?.lowercase() }
        assertTrue("fills: $fills", fills.any { it.startsWith("#dc") || it.startsWith("#db") || it.startsWith("#dd") })
    }

    @Test
    fun binaryMode() = runBlocking {
        val bmp = Bitmap.createBitmap(120, 120, Bitmap.Config.ARGB_8888).apply { eraseColor(Color.WHITE) }
        Canvas(bmp).drawRect(30f, 30f, 90f, 90f, Paint().apply { color = Color.BLACK })
        val doc = parse(VTracerVectorizer().toSvg(RgbaImage(bmp), VectorizeOptions(colorMode = ColorMode.BINARY)))
        assertEquals("120", doc.width)
        assertEquals(1, doc.paths.size)
    }

    @Test
    fun transparentBackgroundIsLeftOut() = runBlocking {
        val bmp = Bitmap.createBitmap(120, 120, Bitmap.Config.ARGB_8888) // tudo transparente
        Canvas(bmp).drawRect(30f, 30f, 90f, 90f, Paint().apply { color = Color.rgb(0, 160, 0) })
        val doc = parse(VTracerVectorizer().toSvg(RgbaImage(bmp)))
        val fills = doc.paths.mapNotNull { it["fill"]?.lowercase() }
        assertEquals("fills: $fills", listOf("#00a000"), fills)
    }
}
