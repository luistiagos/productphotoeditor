package com.productphoto.feature.mockup

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File
import kotlin.math.abs

class MockupTest {
    @Test
    fun `bundled index parses and every template is valid`() {
        // o teste roda com o diretório do módulo como pasta atual
        val index = parseMockupIndex(File("../../app/src/main/assets/content/mockups/index.json").readText())
        assertEquals(4, index.mockups.size)
        for (e in index.mockups) {
            assertEquals(emptyList<String>(), e.problems())
            assertTrue(File("../../app/src/main/assets/content/mockups/${e.file}").isFile)
            assertTrue(File("../../app/src/main/assets/content/mockups/${e.thumb}").isFile)
        }
    }

    @Test
    fun `invalid templates are reported`() {
        val ok = SlotJson(listOf(listOf(10f, 10f), listOf(90f, 10f), listOf(90f, 90f), listOf(10f, 90f)), 1f)
        val e = MockupEntry("t", "T", "print", "t.webp", "t_thumb.webp", 100, 100, listOf(ok))
        assertEquals(emptyList<String>(), e.problems())
        assertEquals(1, e.copy(width = 50).problems().size)                                       // fora da base
        assertEquals(1, e.copy(slots = listOf(ok.copy(aspect = 0f))).problems().size)               // proporção
        val bowtie = ok.copy(quad = listOf(listOf(10f, 10f), listOf(90f, 90f), listOf(90f, 10f), listOf(10f, 90f)))
        assertEquals(1, e.copy(slots = listOf(bowtie)).problems().size)                             // não convexo
        assertEquals(1, e.copy(slots = emptyList()).problems().size)
    }

    @Test
    fun `center crop has the slot aspect within 1 px`() {
        for ((w, h) in listOf(4000 to 3000, 1080 to 1920, 513 to 511, 7 to 1000)) {
            for (aspect in listOf(.4615f, .707f, 1f, 1.8f)) {
                val r = centerCrop(w, h, aspect)
                assertTrue(r.x >= 0 && r.y >= 0 && r.x + r.width <= w && r.y + r.height <= h)
                assertTrue("$w×$h $aspect → $r", abs(r.width - r.height * aspect) <= 1f || abs(r.height - r.width / aspect) <= 1f)
                assertTrue(r.width == w || r.height == h) // o maior possível
                // centrado
                assertTrue(abs((r.x + r.width / 2f) - w / 2f) <= 1f && abs((r.y + r.height / 2f) - h / 2f) <= 1f)
            }
        }
    }

    @Test
    fun `adjust starts at the center crop, zooms and stays inside`() {
        val (w, h, aspect) = Triple(4000, 3000, 1f)
        val s0 = CropState.initial(w, h)
        assertEquals(centerCrop(w, h, aspect), s0.rect(w, h, aspect))
        val zoomed = s0.gesture(0f, 0f, 2f, 0.25f, w, h, aspect)
        assertEquals(1500, zoomed.rect(w, h, aspect).width)
        // arrastar muito para a direita leva o recorte até a borda esquerda e não além
        val far = zoomed.gesture(100000f, 0f, 1f, 0.5f, w, h, aspect)
        val r = far.rect(w, h, aspect)
        assertEquals(0, r.x)
        assertEquals(1500, r.width)
        // zoom fica entre 1 e 8
        assertEquals(1f, s0.gesture(0f, 0f, .1f, 1f, w, h, aspect).zoom)
        assertEquals(CropState.MAX_ZOOM, s0.gesture(0f, 0f, 100f, 1f, w, h, aspect).zoom)
    }
}
