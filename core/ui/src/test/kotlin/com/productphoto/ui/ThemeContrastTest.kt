package com.productphoto.ui

import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.luminance
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import kotlin.math.max
import kotlin.math.min

class ThemeContrastTest {
    private fun contrast(a: Color, b: Color): Float {
        val la = a.luminance()
        val lb = b.luminance()
        return (max(la, lb) + 0.05f) / (min(la, lb) + 0.05f)
    }

    @Test
    fun allStudioThemesPassWcagContrast() {
        val ids = StudioThemeStyle.entries.map { it.id }.toSet()
        assertEquals("Theme IDs must be unique", StudioThemeStyle.entries.size, ids.size)

        StudioThemeStyle.entries.forEach { style ->
            val s = style.scheme
            assertTrue("${style.id}: onBackground/background >= 7.0", contrast(s.onBackground, s.background) >= 7.0f)
            assertTrue("${style.id}: onSurface/surface >= 7.0", contrast(s.onSurface, s.surface) >= 7.0f)
            assertTrue("${style.id}: onSurfaceVariant/surfaceVariant >= 4.5", contrast(s.onSurfaceVariant, s.surfaceVariant) >= 4.5f)
            assertTrue("${style.id}: onPrimary/primary >= 4.5", contrast(s.onPrimary, s.primary) >= 4.5f)
            assertTrue("${style.id}: onSecondary/secondary >= 4.5", contrast(s.onSecondary, s.secondary) >= 4.5f)
            assertTrue("${style.id}: onPrimaryContainer/primaryContainer >= 7.0", contrast(s.onPrimaryContainer, s.primaryContainer) >= 7.0f)
            assertTrue("${style.id}: onSecondaryContainer/secondaryContainer >= 4.5", contrast(s.onSecondaryContainer, s.secondaryContainer) >= 4.5f)
            assertTrue("${style.id}: onError/error >= 4.5", contrast(s.onError, s.error) >= 4.5f)
        }
    }

    @Test
    fun fromIdFallsBackToVioletStudio() {
        assertEquals(StudioThemeStyle.VIOLET_STUDIO, StudioThemeStyle.fromId(null))
        assertEquals(StudioThemeStyle.VIOLET_STUDIO, StudioThemeStyle.fromId("unknown"))
        assertEquals(StudioThemeStyle.NOIR_GOLD, StudioThemeStyle.fromId("noir_gold"))
    }
}
