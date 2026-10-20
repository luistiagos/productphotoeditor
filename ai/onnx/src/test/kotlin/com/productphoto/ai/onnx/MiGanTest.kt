package com.productphoto.ai.onnx

import com.productphoto.ai.api.Mask
import com.productphoto.imaging.Raster
import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class MiGanTest {

    @Test
    fun `mask is inverted and binarized (255 fill becomes 0 hole)`() {
        val known = MiGan.knownMask(Mask(4, 1, byteArrayOf(0, 127, 128.toByte(), 0xFF.toByte())))!!
        assertArrayEquals(byteArrayOf(0xFF.toByte(), 0xFF.toByte(), 0, 0), known)
    }

    @Test
    fun `mask without holes yields null`() {
        assertNull(MiGan.knownMask(Mask(2, 2, ByteArray(4) { 100 })))
    }

    @Test
    fun `image goes to CHW and back keeping the original alpha`() {
        val src = Raster(2, 1, intArrayOf(0x80102030.toInt(), 0xFFA0B0C0.toInt()))
        val chw = MiGan.imageToChw(src)
        assertArrayEquals(byteArrayOf(0x10, 0xA0.toByte(), 0x20, 0xB0.toByte(), 0x30, 0xC0.toByte()), chw)
        val back = MiGan.chwToRaster(chw, src)
        assertEquals(0x80102030.toInt(), back.argb[0])
        assertEquals(0xFFA0B0C0.toInt(), back.argb[1])
    }
}
