package com.productphoto.imaging

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class SceneCompositorTest {
    private val gray = argb(255, 160, 160, 160)

    private fun scene() = Raster(400, 400, IntArray(400 * 400) { gray })

    /** Produto 100×160 com um retângulo vermelho de 60×120 no meio (máscara sintética). */
    private fun product(): Pair<Raster, FloatArray> {
        val w = 100; val h = 160
        val px = IntArray(w * h) { argb(255, 30, 200, 30) } // fundo verde que a máscara deve esconder
        val mask = FloatArray(w * h)
        for (y in 20 until 140) for (x in 20 until 80) {
            px[y * w + x] = argb(255, 220, 30, 30)
            mask[y * w + x] = 1f
        }
        return Raster(w, h, px) to mask
    }

    private fun lum(c: Int) = (r8(c) + g8(c) + b8(c)) / 3f

    // produto centrado em (200, 240): retângulo vai de y=180 a y=300 (base em 300), x de 170 a 230
    private val place = PlacementPx(200f, 240f, 1f, 0f)
    private val opts = CompositeParams(contactShadow = .8f, castShadow = .6f, harmonize = 0f, lightWrap = 0f)

    @Test
    fun `contact shadow darkens just below the base and leaves far pixels untouched`() {
        val (p, m) = product()
        val frontLight = LightParams(lightDirDeg = 270f, elevationDeg = 50f, softness = .3f, colorTempK = 6500)
        val out = SceneCompositor.compose(p, m, scene(), frontLight, place, opts)

        val below = out.argb[302 * 400 + 200]
        assertTrue("below base should be darker: ${lum(below)}", lum(below) < 150f)
        assertEquals(gray, out.argb[20 * 400 + 20])
        assertEquals(gray, out.argb[390 * 400 + 390])
    }

    @Test
    fun `mask hides the product background and keeps the product color`() {
        val (p, m) = product()
        val out = SceneCompositor.compose(p, m, scene(), LightParams(270f, 50f, .3f, 6500), place, opts)
        val center = out.argb[240 * 400 + 200]
        assertTrue(r8(center) > 200 && g8(center) < 60)
        // onde o produto tinha fundo verde (fora da máscara) não pode aparecer verde
        val outsideMask = out.argb[175 * 400 + 160]
        assertTrue(g8(outsideMask) <= 160 && g8(outsideMask) - r8(outsideMask) < 10)
    }

    @Test
    fun `light from the left casts the shadow to the right`() {
        val (p, m) = product()
        val leftLight = LightParams(lightDirDeg = 180f, elevationDeg = 35f, softness = .2f, colorTempK = 6500)
        val out = SceneCompositor.compose(p, m, scene(), leftLight, place, opts.copy(contactShadow = 0f))
        val right = lum(out.argb[296 * 400 + 260])
        val left = lum(out.argb[296 * 400 + 140])
        assertTrue("right $right should be darker than left $left", right < left - 10)
    }

    @Test
    fun `light from the back casts the shadow toward the camera`() {
        val (p, m) = product()
        val backLight = LightParams(lightDirDeg = 90f, elevationDeg = 40f, softness = .2f, colorTempK = 6500)
        val out = SceneCompositor.compose(p, m, scene(), backLight, place, opts.copy(contactShadow = 0f))
        assertTrue(lum(out.argb[330 * 400 + 200]) < 150f)
    }

    @Test
    fun `zero options leave only the product pasted`() {
        val (p, m) = product()
        val out = SceneCompositor.compose(p, m, scene(), LightParams(270f, 50f, .3f, 6500), place, CompositeParams(0f, 0f, 0f, 0f))
        assertEquals(gray, out.argb[305 * 400 + 200])
    }

    @Test
    fun `warm scene shifts product toward warm when harmonizing`() {
        val (p, m) = product()
        val base = SceneCompositor.compose(p, m, scene(), LightParams(270f, 50f, .3f, 6500), place, opts)
        val warm = SceneCompositor.compose(p, m, scene(), LightParams(270f, 50f, .3f, 3500), place, opts.copy(harmonize = 1f))
        val i = 240 * 400 + 200
        assertTrue(b8(warm.argb[i]) < b8(base.argb[i]) || r8(warm.argb[i]) > r8(base.argb[i]))
    }

    @Test
    fun `empty mask returns the scene unchanged`() {
        val (p, _) = product()
        val out = SceneCompositor.compose(p, FloatArray(p.width * p.height), scene(), LightParams(0f, 45f, .5f, 6500), place, opts)
        assertTrue(out.argb.all { it == gray })
    }

    @Test
    fun `small scale and rotation stay inside bounds`() {
        val (p, m) = product()
        val out = SceneCompositor.compose(p, m, scene(), LightParams(30f, 20f, .8f, 5000), PlacementPx(390f, 395f, 0.3f, 33f), opts)
        assertEquals(400 * 400, out.argb.size)
    }

    @Test
    fun `blur keeps mass and stays inside roi`() {
        val w = 50; val h = 50
        val p = FloatArray(w * h).also { it[25 * w + 25] = 100f }
        val b = gaussianBlur(p, w, h, 3f)
        assertEquals(100f, b.sum(), 0.5f)
        val roi = Roi(10, 10, 20, 20)
        val c = gaussianBlur(p, w, h, 3f, roi)
        assertEquals(100f, c[25 * w + 25], 0f) // fora da roi não muda
    }
}
