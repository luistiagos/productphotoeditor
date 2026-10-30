package com.productphoto.ui

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File

class MediaFormatsTest {
    @Test
    fun `ids are unique and sizes positive`() {
        assertEquals(MediaFormats.all.size, MediaFormats.all.map { it.id }.toSet().size)
        assertTrue(MediaFormats.all.all { it.width > 0 && it.height > 0 })
        assertFalse(MediaFormats.all.any { it.isCustom })
    }

    @Test
    fun `screen lists keep what each screen needs`() {
        assertEquals("quick_square", MediaFormats.forImageGeneration.first().id) // padrão do Gerar imagem
        assertFalse(MediaFormats.forDesign.any { it.group == FormatGroup.QUICK })
        assertFalse(MediaFormats.forAds.any { it.group in setOf(FormatGroup.PRINT, FormatGroup.QUICK, FormatGroup.PROFILE) })
        // a expansão de anúncio não recebe proporção além de 4:1 (728×90 fica de fora; 300×250 entra)
        assertTrue(MediaFormats.forAds.all { maxOf(it.width, it.height) <= MediaFormats.ADS_MAX_ASPECT * minOf(it.width, it.height) })
        assertFalse(MediaFormats.forAds.any { it.id == "web_leaderboard" })
        assertTrue(MediaFormats.forAds.any { it.id == "web_rectangle" })
        assertTrue(MediaFormats.forDesign.any { it.id == "web_leaderboard" })
    }

    @Test
    fun `custom size is validated against the screen ceiling`() {
        assertEquals(1080 to 1920, parseCustomSize(" 1080", "1920 ", 8000))
        assertNull(parseCustomSize("15", "100", 8000))
        assertNull(parseCustomSize("3000", "100", 2560))
        assertNull(parseCustomSize("", "100", 8000))
        assertEquals(400 to 100, parseCustomSize("400", "100", 8000, maxAspect = 4f))
        assertNull(parseCustomSize("401", "100", 8000, maxAspect = 4f))
        assertTrue(MediaFormat.custom(10, 20).isCustom)
    }

    /** O editor web tem o mesmo catálogo (editor-web/src/formats.ts): id, nome e tamanho têm de bater. */
    @Test
    fun `web editor catalog matches`() {
        val ts = generateSequence(File("").absoluteFile) { it.parentFile }
            .map { File(it, "editor-web/src/formats.ts") }.first { it.exists() }.readText()
        val row = Regex("""\['([a-z0-9_]+)', '([^']*)', (\d+), (\d+), '([a-z]+)'""")
        val web = row.findAll(ts).map { m -> listOf(m.groupValues[1], m.groupValues[2], m.groupValues[3], m.groupValues[4], m.groupValues[5]) }.toList()
        val kt = MediaFormats.all.map { listOf(it.id, it.label, "${it.width}", "${it.height}", it.group.name.lowercase()) }
        assertEquals(kt, web)
    }
}
