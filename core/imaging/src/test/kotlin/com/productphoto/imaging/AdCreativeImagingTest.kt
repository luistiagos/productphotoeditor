package com.productphoto.imaging

import com.productphoto.ai.api.AdAspectRatio
import com.productphoto.ai.api.LightDirection
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class AdCreativeImagingTest {

    private fun testRaster(w: Int, h: Int, color: Int = argb(255, 128, 128, 128)): Raster {
        return Raster(w, h, IntArray(w * h) { color })
    }

    @Test
    fun `OutpaintBuilder expands 1-1 to 9-16 vertical format correctly`() {
        val src = testRaster(512, 512)
        val prep = OutpaintBuilder.buildRaster(src, AdAspectRatio.RATIO_9_16, featherPx = 16)

        assertEquals(512, prep.targetWidth)
        assertTrue("Height must be multiple of 8", prep.targetHeight % 8 == 0)
        assertTrue("Height must expand to ~912 px (got ${prep.targetHeight})", prep.targetHeight >= 910)

        // Dimensões da máscara
        assertEquals(prep.targetWidth, prep.inpaintMask.width)
        assertEquals(prep.targetHeight, prep.inpaintMask.height)

        // Centro deve ter máscara 0 (área segura preservada)
        val centerX = prep.targetWidth / 2
        val centerY = prep.targetHeight / 2
        val centerAlpha = prep.inpaintMask.alpha[centerY * prep.targetWidth + centerX].toInt() and 0xFF
        assertEquals(0, centerAlpha)

        // Topo deve ter máscara 255 (área gerada por inpainting)
        val topAlpha = prep.inpaintMask.alpha[5 * prep.targetWidth + centerX].toInt() and 0xFF
        assertEquals(255, topAlpha)

        // Base deve ter máscara 255
        val bottomY = prep.targetHeight - 5
        val bottomAlpha = prep.inpaintMask.alpha[bottomY * prep.targetWidth + centerX].toInt() and 0xFF
        assertEquals(255, bottomAlpha)
    }

    @Test
    fun `OutpaintBuilder expands 1-1 to 16-9 horizontal banner correctly`() {
        val src = testRaster(512, 512)
        val prep = OutpaintBuilder.buildRaster(src, AdAspectRatio.RATIO_16_9, featherPx = 16)

        assertEquals(512, prep.targetHeight)
        assertTrue("Width must be multiple of 8", prep.targetWidth % 8 == 0)
        assertTrue("Width must expand to ~912 px (got ${prep.targetWidth})", prep.targetWidth >= 910)

        val centerY = prep.targetHeight / 2
        val leftAlpha = prep.inpaintMask.alpha[centerY * prep.targetWidth + 5].toInt() and 0xFF
        assertEquals(255, leftAlpha)

        val centerX = prep.targetWidth / 2
        val centerAlpha = prep.inpaintMask.alpha[centerY * prep.targetWidth + centerX].toInt() and 0xFF
        assertEquals(0, centerAlpha)
    }

    @Test
    fun `LocalRelighter adjusts directional lighting`() {
        val src = testRaster(100, 100, argb(255, 128, 128, 128))
        val relighter = LocalRelighter()

        val leftResult = relighter.relightRaster(src, LightDirection.LEFT, strength = 0.5f)
        val leftR = r8(leftResult.argb[50 * 100 + 10])
        val rightR = r8(leftResult.argb[50 * 100 + 90])
        assertTrue("Left side should be brighter than right side for LightDirection.LEFT", leftR > rightR)

        val rightResult = relighter.relightRaster(src, LightDirection.RIGHT, strength = 0.5f)
        val rightSideR = r8(rightResult.argb[50 * 100 + 90])
        val leftSideR = r8(rightResult.argb[50 * 100 + 10])
        assertTrue("Right side should be brighter than left side for LightDirection.RIGHT", rightSideR > leftSideR)
    }
}
