package com.productphoto.ai.onnx

import com.productphoto.imaging.Raster
import org.junit.Assert.assertEquals
import org.junit.Test

class U2netpTest {
    private val n = 320 * 320

    @Test
    fun `normalization matches rembg (divide by global max, imagenet mean std, CHW)`() {
        val px = IntArray(n) { 0xFF000000.toInt() }  // preto
        px[0] = 0xFFC86432.toInt()                    // (200,100,50): máximo global = 200
        val t = U2netp.preprocess(Raster(320, 320, px))

        assertEquals(3 * n, t.size)
        assertEquals((200f / 200f - 0.485f) / 0.229f, t[0], 1e-5f)
        assertEquals((100f / 200f - 0.456f) / 0.224f, t[n], 1e-5f)
        assertEquals((50f / 200f - 0.406f) / 0.225f, t[2 * n], 1e-5f)
        assertEquals((0f - 0.485f) / 0.229f, t[1], 1e-5f)
    }

    @Test
    fun `postprocess is min-max normalized and resized`() {
        val pred = FloatArray(n) { 0.2f }.also { for (i in 0 until n / 2) it[i] = 0.6f }
        val m = U2netp.postprocess(pred, 640, 480)
        assertEquals(640 * 480, m.size)
        assertEquals(1f, m[0], 1e-5f)            // topo = máximo
        assertEquals(0f, m[m.size - 1], 1e-5f)   // base = mínimo
    }

    @Test
    fun `flat prediction gives empty mask instead of NaN`() {
        val m = U2netp.postprocess(FloatArray(n) { 0.5f }, 10, 10)
        assertEquals(0f, m.max(), 0f)
    }

    @Test
    fun `refine drops weak fringe and keeps solid interior`() {
        val r = U2netp.refine(floatArrayOf(0f, 0.25f, 0.55f, 0.85f, 1f))
        assertEquals(0f, r[0], 0f)
        assertEquals(0f, r[1], 0f)
        assertEquals(0.5f, r[2], 1e-4f)
        assertEquals(1f, r[3], 0f)
        assertEquals(1f, r[4], 0f)
    }
}
