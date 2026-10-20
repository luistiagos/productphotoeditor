package com.productphoto.imaging

import com.productphoto.ai.api.AiError
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Assert.fail
import org.junit.Test
import kotlin.random.Random

/** §20.5 task 3: tiles sem costura, ×2 = média do ×4, tamanhos quebrados, sem halo, limite de 1 MP de entrada. */
class TilesTest {

    /** "Modelo" ×4 sobre CHW w×h: média (2r+1)² com borda replicada, depois vizinho mais próximo ×4 (+ rampa opcional). */
    private fun fake(input: FloatArray, w: Int, h: Int, radius: Int, ramp: Boolean = false): FloatArray {
        val ow = 4 * w
        val oh = 4 * h
        val out = FloatArray(3 * ow * oh)
        for (c in 0 until 3) {
            val base = c * w * h
            for (y in 0 until h) for (x in 0 until w) {
                var s = 0f
                for (dy in -radius..radius) for (dx in -radius..radius) {
                    s += input[base + (y + dy).coerceIn(0, h - 1) * w + (x + dx).coerceIn(0, w - 1)]
                }
                val v = s / ((2 * radius + 1) * (2 * radius + 1))
                for (yy in 0 until 4) for (xx in 0 until 4) {
                    out[c * ow * oh + (4 * y + yy) * ow + 4 * x + xx] = if (ramp) v * (.8f + .05f * (xx + yy)) else v
                }
            }
        }
        return out
    }

    private fun random(w: Int, h: Int, seed: Int = 1): Raster {
        val rnd = Random(seed)
        return Raster(w, h, IntArray(w * h) { argb(0xFF, rnd.nextInt(256), rnd.nextInt(256), rnd.nextInt(256)) })
    }

    /** Passada única do mesmo "modelo" sobre a imagem inteira (referência sem tiles). */
    private fun singlePass(src: Raster, radius: Int): IntArray {
        val w = src.width
        val h = src.height
        val chw = FloatArray(3 * w * h)
        for (i in 0 until w * h) {
            chw[i] = r8(src.argb[i]) / 255f
            chw[w * h + i] = g8(src.argb[i]) / 255f
            chw[2 * w * h + i] = b8(src.argb[i]) / 255f
        }
        val o = fake(chw, w, h, radius)
        val n = 16 * w * h
        return IntArray(n) { argb(0xFF, clamp8(o[it] * 255f), clamp8(o[n + it] * 255f), clamp8(o[2 * n + it] * 255f)) }
    }

    private suspend fun tiled(src: Raster, factor: Int, radius: Int, ramp: Boolean = false, overlap: Int = 8) =
        upscaleTiled(src, factor, overlap = overlap) { fake(it, 128, 128, radius, ramp) }

    @Test
    fun `nearest x4 in tiles equals a single pass pixel by pixel`() = runTest {
        val src = random(300, 260)
        assertArrayEquals(singlePass(src, 0), tiled(src, 4, 0).argb)
    }

    @Test
    fun `receptive field within the overlap leaves no seam`() = runTest {
        val src = random(250, 240, seed = 2)
        // média 3×3 (raio 1) e 17×17 (raio 8 = sobreposição): iguais à passada única em toda a imagem
        assertArrayEquals(singlePass(src, 1), tiled(src, 4, 1).argb)
        assertArrayEquals(singlePass(src, 8), tiled(src, 4, 8).argb)
    }

    @Test
    fun `receptive field larger than the overlap shows a seam`() = runTest {
        // controle: prova que o teste acima pegaria costura (raio 9 > sobreposição 8)
        val src = random(250, 240, seed = 3)
        assertTrue(!singlePass(src, 9).contentEquals(tiled(src, 4, 9).argb))
    }

    @Test
    fun `x2 is the 2x2 mean of x4`() = runTest {
        val src = random(150, 130, seed = 4)
        val x4 = tiled(src, 4, 1, ramp = true)
        val x2 = tiled(src, 2, 1, ramp = true)
        assertEquals(300, x2.width)
        assertEquals(260, x2.height)
        var worst = 0
        for (y in 0 until 260) for (x in 0 until 300) {
            val q = 2 * y * 600 + 2 * x
            val quad = intArrayOf(x4.argb[q], x4.argb[q + 1], x4.argb[q + 600], x4.argb[q + 601])
            for (ch in listOf(::r8, ::g8, ::b8)) {
                val mean = quad.sumOf { ch(it) } / 4f
                worst = maxOf(worst, kotlin.math.abs(ch(x2.argb[y * 300 + x]) - mean).let { kotlin.math.ceil(it).toInt() })
            }
        }
        assertTrue("diferença máxima $worst", worst <= 1) // arredondamento do ×4 antes da média
    }

    @Test
    fun `sizes that are not multiples of the tile core`() = runTest {
        for ((w, h) in listOf(1 to 1, 113 to 7, 300 to 129)) {
            val src = random(w, h, seed = w + h)
            var last = 0 to 0
            val out = upscaleTiled(src, 4, progress = { d, t -> last = d to t }) { fake(it, 128, 128, 1) }
            assertEquals(4 * w, out.width)
            assertEquals(4 * h, out.height)
            assertArrayEquals("${w}x$h", singlePass(src, 1), out.argb)
            val tiles = ((w + 111) / 112) * ((h + 111) / 112)
            assertEquals(tiles to tiles, last)
        }
    }

    @Test
    fun `transparent surroundings do not darken the edge`() = runTest {
        val w = 64
        val color = argb(0xFF, 200, 150, 100)
        val src = Raster(w, w, IntArray(w * w) { i ->
            val dx = i % w - 31.5f
            val dy = i / w - 31.5f
            if (dx * dx + dy * dy <= 20f * 20f) color else 0
        })
        val out = upscaleTiled(src, 4) { fake(it, 128, 128, 1) }
        fun lum(c: Int) = .299f * r8(c) + .587f * g8(c) + .114f * b8(c)
        var edge = 0
        for (c in out.argb) {
            if (a8(c) == 0) continue
            if (a8(c) < 0xFF) edge++
            assertTrue("pixel ${Integer.toHexString(c)} escureceu", lum(c) >= .9f * lum(color))
        }
        assertTrue("o alfa bilinear deveria criar borda parcial", edge > 0)
        // sem sangria a mesma borda escurece (controle)
        val dark = upscaleTiledWithoutBleed(src)
        assertTrue(dark.any { a8(it) > 0 && lum(it) < .9f * lum(color) })
    }

    /** Controle do teste de halo: a mesma conta sem a sangria (pixels transparentes pretos entram na média). */
    private fun upscaleTiledWithoutBleed(src: Raster): IntArray {
        val w = src.width
        val chw = FloatArray(3 * w * w)
        for (i in 0 until w * w) {
            chw[i] = r8(src.argb[i]) / 255f; chw[w * w + i] = g8(src.argb[i]) / 255f; chw[2 * w * w + i] = b8(src.argb[i]) / 255f
        }
        val o = fake(chw, w, w, 1)
        val n = 16 * w * w
        val ow = 4 * w
        return IntArray(n) {
            val a = a8(src.argb[(it / ow / 4) * w + (it % ow) / 4])
            argb(a, clamp8(o[it] * 255f), clamp8(o[n + it] * 255f), clamp8(o[2 * n + it] * 255f))
        }
    }

    @Test
    fun `input above 1 MP is unsupported`() = runTest {
        upscaleTiled(Raster(1024, 1024), 4) { fake(it, 128, 128, 0) }.let { assertEquals(4096 * 4096, it.argb.size) }
        for ((src, f) in listOf(Raster(1025, 1024) to 4, Raster(1024, 1025) to 2)) {
            try {
                upscaleTiled(src, f) { fail("não deveria rodar o modelo"); it }
                fail("esperado Unsupported para ${src.width}x${src.height} ×$f")
            } catch (_: AiError.Unsupported) {
            }
        }
    }

    @Test
    fun `factor other than 2 or 4 is unsupported`() = runTest {
        try {
            upscaleTiled(Raster(4, 4), 3) { it }
            fail()
        } catch (_: AiError.Unsupported) {
        }
    }

    @Test
    fun `wrong model output size is invalid output`() = runTest {
        try {
            upscaleTiled(Raster(4, 4), 4) { FloatArray(3) }
            fail()
        } catch (_: AiError.InvalidOutput) {
        }
    }
}
