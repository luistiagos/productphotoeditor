package com.productphoto.feature.product

import org.junit.Assert.assertEquals
import org.junit.Test

class MaskViewportTest {
    // canvas 1000×800, imagem 2000×1000 → escala 0,5, faixa vertical de 300 px centrada (top = 150)
    private val w = 1000f
    private val h = 800f
    private val fit = Fit.of(w, h, 2000, 1000)

    private fun MaskViewport.image(sx: Float, sy: Float) = toImageX(sx, fit) to toImageY(sy, fit)

    @Test
    fun `without zoom it is the plain fit conversion`() {
        assertEquals(Fit(0.5f, 0f, 150f), fit)
        val (x, y) = MaskViewport().image(500f, 400f)
        assertEquals(1000f, x, 1e-3f)
        assertEquals(500f, y, 1e-3f)
        assertEquals(48f, MaskViewport().brushRadius(24f, fit), 1e-4f)
    }

    @Test
    fun `pinch keeps the point under the fingers`() {
        val before = MaskViewport().image(300f, 350f)
        val vp = MaskViewport().transform(300f, 350f, 0f, 0f, 2f, w, h)
        assertEquals(2f, vp.zoom, 0f)
        val after = vp.image(300f, 350f)
        assertEquals(before.first, after.first, 1e-3f)
        assertEquals(before.second, after.second, 1e-3f)
        assertEquals(24f, vp.brushRadius(24f, fit), 1e-4f)   // pincel afina com o zoom
    }

    @Test
    fun `pan with zoom moves the point from the old centroid to the new one`() {
        val vp0 = MaskViewport().transform(500f, 400f, 0f, 0f, 3f, w, h)
        val before = vp0.image(450f, 380f)
        // dedos saem de (450,380) e chegam a (470,410) abrindo a pinça 1,5×
        val vp1 = vp0.transform(470f, 410f, 20f, 30f, 1.5f, w, h)
        val after = vp1.image(470f, 410f)
        assertEquals(4.5f, vp1.zoom, 1e-5f)
        assertEquals(before.first, after.first, 1e-2f)
        assertEquals(before.second, after.second, 1e-2f)
    }

    @Test
    fun `zoom is limited to 1x-8x and offset keeps the canvas covered`() {
        val big = MaskViewport().transform(500f, 400f, 0f, 0f, 100f, w, h)
        assertEquals(8f, big.zoom, 0f)
        val back = big.transform(500f, 400f, 0f, 0f, 0.001f, w, h)
        assertEquals(MaskViewport(1f, 0f, 0f), back)
        // arrastar demais para a direita/baixo para no canto superior esquerdo da página ampliada
        val vp = MaskViewport().transform(0f, 0f, 0f, 0f, 2f, w, h).transform(900f, 700f, 900f, 700f, 1f, w, h)
        assertEquals(0f, vp.offsetX, 0f)
        assertEquals(0f, vp.offsetY, 0f)
        val far = vp.transform(0f, 0f, -5000f, -5000f, 1f, w, h)
        assertEquals(-w, far.offsetX, 1e-3f)       // tamanho · (1 − 2)
        assertEquals(-h, far.offsetY, 1e-3f)
    }
}
