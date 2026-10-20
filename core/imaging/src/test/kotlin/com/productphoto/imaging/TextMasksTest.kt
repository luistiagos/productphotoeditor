package com.productphoto.imaging

import org.junit.Assert.assertEquals
import org.junit.Test

class TextMasksTest {
    private fun at(m: com.productphoto.ai.api.Mask, x: Int, y: Int) = m.alpha[y * m.width + x].toInt() and 0xFF

    @Test
    fun `box is dilated by a margin proportional to its height`() {
        // altura 20 → margem 4
        val m = TextMasks.fromBoxes(listOf(Roi(40, 40, 60, 60)), 100, 100)
        assertEquals(255, at(m, 50, 50))
        assertEquals(255, at(m, 36, 36))
        assertEquals(0, at(m, 35, 50))
        assertEquals(255, at(m, 63, 63))
        assertEquals(0, at(m, 64, 50))
    }

    @Test
    fun `small boxes use the minimum margin and edges are clipped`() {
        val m = TextMasks.fromBoxes(listOf(Roi(0, 0, 5, 5)), 10, 10)
        assertEquals(255, at(m, 0, 0))
        assertEquals(255, at(m, 7, 7))
        assertEquals(0, at(m, 8, 0))
    }

    @Test
    fun `no boxes gives an empty mask`() {
        val m = TextMasks.fromBoxes(emptyList(), 8, 8)
        assertEquals(0, m.alpha.count { it.toInt() != 0 })
    }
}
