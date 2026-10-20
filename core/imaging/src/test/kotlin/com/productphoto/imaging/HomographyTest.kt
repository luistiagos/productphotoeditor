package com.productphoto.imaging

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Assert.fail
import org.junit.Test

/** §20.5 task 7: cantos do retângulo caem no quad com erro < 1 px; centro do paralelogramo; quad degenerado. */
class HomographyTest {
    private val quads = listOf(
        floatArrayOf(100f, 80f, 900f, 120f, 860f, 700f, 140f, 640f),     // pôster levemente em perspectiva
        floatArrayOf(300f, 200f, 700f, 260f, 650f, 600f, 250f, 520f),    // cartão inclinado
        floatArrayOf(0f, 0f, 2048f, 0f, 2048f, 1440f, 0f, 1440f),        // a base inteira
        floatArrayOf(500f, 100f, 520f, 105f, 900f, 1300f, 120f, 1290f),  // trapézio forte (tela vista de baixo)
    )

    @Test
    fun `rectangle corners land on the quad`() {
        for (q in quads) {
            val h = Homography.rectToQuad(1200f, 800f, q)
            val rect = floatArrayOf(0f, 0f, 1200f, 0f, 1200f, 800f, 0f, 800f)
            for (k in 0 until 4) {
                val x = h.mapX(rect[2 * k].toDouble(), rect[2 * k + 1].toDouble())
                val y = h.mapY(rect[2 * k].toDouble(), rect[2 * k + 1].toDouble())
                assertEquals(q[2 * k].toDouble(), x, 1.0)
                assertEquals(q[2 * k + 1].toDouble(), y, 1.0)
            }
        }
    }

    @Test
    fun `inverse maps back`() {
        for (q in quads) {
            val h = Homography.rectToQuad(300f, 400f, q)
            val inv = h.inverse()
            for ((x, y) in listOf(0.0 to 0.0, 150.0 to 200.0, 299.0 to 13.0, 7.0 to 390.0)) {
                val u = h.mapX(x, y); val v = h.mapY(x, y)
                assertEquals(x, inv.mapX(u, v), 1e-6)
                assertEquals(y, inv.mapY(u, v), 1e-6)
            }
        }
    }

    @Test
    fun `parallelogram center is the geometric center`() {
        val p = floatArrayOf(100f, 100f, 500f, 150f, 600f, 450f, 200f, 400f)
        val h = Homography.rectToQuad(10f, 10f, p)
        assertEquals((100 + 500 + 600 + 200) / 4.0, h.mapX(5.0, 5.0), 1e-6)
        assertEquals((100 + 150 + 450 + 400) / 4.0, h.mapY(5.0, 5.0), 1e-6)
    }

    @Test
    fun `degenerate quad is rejected`() {
        for (q in listOf(
            floatArrayOf(0f, 0f, 100f, 0f, 200f, 0f, 0f, 100f),   // TL, TR, BR colineares
            floatArrayOf(0f, 0f, 100f, 0f, 100f, 0f, 0f, 100f),   // canto repetido
        )) {
            try {
                Homography.rectToQuad(10f, 10f, q)
                fail("esperado erro para ${q.toList()}")
            } catch (e: IllegalArgumentException) {
                assertTrue(e.message!!.contains("colineares"))
            }
        }
    }

    @Test
    fun `convexity check`() {
        quads.forEach { assertTrue(isConvexQuad(it)) }
        assertFalse(isConvexQuad(floatArrayOf(0f, 0f, 100f, 100f, 100f, 0f, 0f, 100f))) // laço (TR e BR trocados)
        assertFalse(isConvexQuad(floatArrayOf(0f, 0f, 100f, 0f, 30f, 30f, 0f, 100f)))   // côncavo
    }
}
