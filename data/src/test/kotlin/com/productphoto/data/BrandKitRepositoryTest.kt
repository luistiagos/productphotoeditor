package com.productphoto.data

import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder
import java.io.File

class BrandKitRepositoryTest {
    @get:Rule val tmp = TemporaryFolder()

    @Test
    fun `round-trip and defaults`() = runTest {
        val repo = FileBrandKitRepository(File(tmp.root, "brandkit.json"))
        assertEquals(BrandKit(), repo.load())
        val kit = BrandKit(
            profile = CompanyProfile(company = "Doces da Ana", phone = "(11) 99999-0000"),
            colors = BrandColors(primary = "#D81B60", text = "#222222", accent = "vermelho"),
            fonts = BrandFonts(heading = "Pacifico"),
            logoBlob = "logo-1.png",
        )
        repo.save(kit)
        assertEquals(kit, repo.load())
    }

    @Test
    fun `roles drop blank fields and invalid colors`() {
        val kit = BrandKit(
            profile = CompanyProfile(company = "X", slogan = "  "),
            colors = BrandColors(primary = "#D81B60", accent = "vermelho"),
            fonts = BrandFonts(body = "Lato"),
        )
        assertEquals(mapOf("company" to "X"), kit.profile.asVariables())
        assertEquals(mapOf("primary" to "#D81B60"), kit.colors.asRoles())
        assertEquals(mapOf("body" to "Lato"), kit.fonts.asRoles())
    }

    @Test
    fun `corrupt file falls back to an empty kit`() = runTest {
        val f = File(tmp.root, "brandkit.json").apply { writeText("{oops") }
        assertEquals(BrandKit(), FileBrandKitRepository(f).load())
    }
}
