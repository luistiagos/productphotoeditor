package com.productphoto.imaging

import com.productphoto.ai.api.AiError
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Assert.fail
import org.junit.Test
import kotlin.math.abs

/** §20.5 task 8: cor no miolo, base intacta fora, borda parcial, linhas retas, sombreamento proporcional, contagem. */
class PerspectiveMockupTest {
    private fun solid(w: Int, h: Int, c: Int) = Raster(w, h, IntArray(w * h) { c })
    private val white = argb(0xFF, 255, 255, 255)
    private val red = argb(0xFF, 200, 40, 30)
    private val quad = floatArrayOf(60f, 40f, 250f, 70f, 230f, 210f, 50f, 180f)

    @Test
    fun `solid design fills the quad interior and leaves the outside intact`() {
        val base = solid(300, 260, white)
        val out = PerspectiveMockup.render(base, listOf(solid(40, 30, red)), listOf(SlotPx(quad)))
        assertEquals(red, out.argb[120 * 300 + 150])   // miolo
        assertEquals(white, out.argb[5 * 300 + 5])      // fora
        assertEquals(white, out.argb[250 * 300 + 290])
        // borda: algum pixel com valor intermediário entre branco e vermelho
        val partial = out.argb.count { g8(it) in 50..240 && r8(it) > 200 }
        assertTrue("sem antialias na borda", partial > 20)
    }

    @Test
    fun `straight lines stay straight`() {
        // design dividido ao meio (preto | branco): a fronteira u = W/2 tem de virar uma reta na base
        val dw = 100
        val design = Raster(dw, 80, IntArray(dw * 80) { if (it % dw < dw / 2) argb(0xFF, 0, 0, 0) else white })
        val base = solid(300, 260, argb(0xFF, 128, 128, 128))
        val out = PerspectiveMockup.render(base, listOf(design), listOf(SlotPx(quad)))
        val pts = (80..170 step 10).map { y ->
            // primeira transição preto → branco na linha, por interpolação do valor 127,5
            var xEdge = Double.NaN
            for (x in 70 until 240) {
                val a = r8(out.argb[y * 300 + x]); val b = r8(out.argb[y * 300 + x + 1])
                if (a < 128 && b >= 128) { xEdge = x + (127.5 - a) / (b - a); break }
            }
            xEdge to y.toDouble()
        }
        assertTrue(pts.none { it.first.isNaN() })
        val (xa, ya) = pts.first(); val (xb, yb) = pts.last()
        for ((x, y) in pts) {
            val dist = abs((xb - xa) * (ya - y) - (xa - x) * (yb - ya)) / Math.hypot(xb - xa, yb - ya)
            assertTrue("ponto ($x, $y) a $dist px da reta", dist < 1.0)
        }
    }

    @Test
    fun `shading darkens in proportion to the base gradient`() {
        // base: degradê horizontal de 255 a 128 dentro do quad retangular; design branco
        val w = 200
        val base = Raster(w, 100, IntArray(w * 100) { val v = 255 - (it % w) * 127 / (w - 1); argb(0xFF, v, v, v) })
        val rect = floatArrayOf(0f, 0f, 200f, 0f, 200f, 100f, 0f, 100f)
        val full = PerspectiveMockup.render(base, listOf(solid(10, 10, white)), listOf(SlotPx(rect)), shading = 1f)
        val p90 = (0 until w).map { 255 - it * 127 / (w - 1) }.sorted()[((w - 1) * .9).toInt()]
        for (x in listOf(30, 100, 190)) {
            val v = 255 - x * 127 / (w - 1)
            val expected = 255 * minOf(1.0, v / p90.toDouble())
            assertEquals("x=$x", expected, r8(full.argb[50 * w + x]).toDouble(), 2.0)
        }
        // shading 0: sem efeito
        val none = PerspectiveMockup.render(base, listOf(solid(10, 10, white)), listOf(SlotPx(rect)), shading = 0f)
        assertEquals(255, r8(none.argb[50 * w + 190]))
    }

    @Test
    fun `mask limits the slot`() {
        val base = solid(300, 260, white)
        val mask = FloatArray(300 * 260) { if (it % 300 < 150) 1f else 0f }
        val out = PerspectiveMockup.render(base, listOf(solid(40, 30, red)), listOf(SlotPx(quad, mask)))
        assertEquals(red, out.argb[120 * 300 + 100])
        assertEquals(white, out.argb[120 * 300 + 200])
    }

    @Test
    fun `designs count must match slots`() {
        try {
            PerspectiveMockup.render(solid(10, 10, white), emptyList(), listOf(SlotPx(quad)))
            fail()
        } catch (_: AiError.Unsupported) {
        }
    }
}
