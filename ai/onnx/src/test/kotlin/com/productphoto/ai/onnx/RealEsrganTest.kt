package com.productphoto.ai.onnx

import com.productphoto.ai.api.AiError
import com.productphoto.imaging.Raster
import com.productphoto.imaging.upscaleTiled
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.fail
import org.junit.Test
import java.nio.FloatBuffer

class RealEsrganTest {

    @Test
    fun `input is a direct native buffer with the tile values`() {
        val chw = FloatArray(3 * 128 * 128) { it / 49152f }
        val buf = RealEsrgan.input(chw)
        assertEquals(true, buf.isDirect)
        assertEquals(chw.size, buf.remaining())
        assertEquals(chw[12345], buf.get(12345))
        try {
            RealEsrgan.input(FloatArray(10))
            fail()
        } catch (_: IllegalArgumentException) {
        }
    }

    @Test
    fun `output of the wrong size is invalid output`() {
        try {
            RealEsrgan.output(FloatBuffer.allocate(3 * 256 * 256))
            fail()
        } catch (_: AiError.InvalidOutput) {
        }
    }

    @Test
    fun `out of range and NaN are clamped`() = runTest {
        // R acima de 1, G abaixo de 0, B NaN, como pode sair de um modelo GAN
        val n = 512 * 512
        val raw = FloatArray(RealEsrgan.OUTPUT_SIZE) { i -> when (i / n) { 0 -> 1.3f; 1 -> -0.2f; else -> Float.NaN } }
        val out = upscaleTiled(Raster(10, 10, IntArray(100) { 0xFF808080.toInt() }), 4, RealEsrgan.TILE, RealEsrgan.OVERLAP) {
            RealEsrgan.output(FloatBuffer.wrap(raw))
        }
        assertEquals(0xFFFF0000.toInt(), out.argb.distinct().single())
    }
}
