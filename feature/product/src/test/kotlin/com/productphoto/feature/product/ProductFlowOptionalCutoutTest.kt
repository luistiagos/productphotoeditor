package com.productphoto.feature.product

import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class ProductFlowOptionalCutoutTest {
    @Test
    fun `default UiState enables background removal without skipped mask`() {
        val state = UiState()
        assertTrue(state.removeBackground)
        assertFalse(state.maskSkipped)
    }

    @Test
    fun `originalAlphaFromArgb preserves opaque and transparent PNG channels`() {
        val pixels = intArrayOf(
            0x00112233, // transparente
            0x80445566.toInt(), // semitransparente
            0xFF778899.toInt(), // opaco
        )
        val alpha = originalAlphaFromArgb(pixels)
        assertArrayEquals(byteArrayOf(0x00, 0x80.toByte(), 0xFF.toByte()), alpha)
    }

    @Test
    fun `previousStep skips mask when maskSkipped is true`() {
        assertEquals(Step.CATEGORY, previousStep(Step.SCENE, maskSkipped = true, hasScene = false))
        assertEquals(Step.MASK, previousStep(Step.SCENE, maskSkipped = false, hasScene = false))
    }

    @Test
    fun `previousStep skips position when result has no scene`() {
        assertEquals(Step.SCENE, previousStep(Step.RESULT, maskSkipped = true, hasScene = false))
        assertEquals(Step.POSITION, previousStep(Step.RESULT, maskSkipped = false, hasScene = true))
        assertNull(previousStep(Step.CATEGORY, maskSkipped = false, hasScene = false))
    }
}
