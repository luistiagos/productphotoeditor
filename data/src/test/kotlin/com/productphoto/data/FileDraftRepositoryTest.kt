package com.productphoto.data

import kotlinx.coroutines.test.runTest
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Assert.fail
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder

class FileDraftRepositoryTest {
    @get:Rule val tmp = TemporaryFolder()

    private fun doc(name: String, w: Int = 1080, h: Int = 1350) =
        """{"format":"pp-editor","version":1,"name":"$name","width":$w,"height":$h,"fabric":{"objects":[]}}"""

    @Test
    fun `save, list newest first, load and delete`() = runTest {
        var now = 1_000_000L
        var n = 0
        val repo = FileDraftRepository(tmp.root, clock = { now }, newId = { "id-${++n}" })
        val a = repo.save(null, doc("A"), byteArrayOf(1, 2, 3))
        now += 5_000
        val b = repo.save(null, doc("B", 800, 600), null)
        assertEquals(listOf("id-1", "id-2"), listOf(a, b))

        val list = repo.list()
        assertEquals(listOf("B", "A"), list.map { it.name })
        assertEquals(800 to 600, list[0].width to list[0].height)
        assertNull(list[0].thumbnail)
        assertArrayEquals(byteArrayOf(1, 2, 3), list[1].thumbnail!!.readBytes())

        now += 5_000
        repo.save(a, doc("A2"), null) // atualiza o mesmo id, mantém a miniatura antiga
        assertEquals(listOf("A2", "B"), repo.list().map { it.name })
        assertTrue(repo.load(a)!!.contains("\"A2\""))

        repo.delete(a)
        assertNull(repo.load(a))
        assertEquals(listOf("B"), repo.list().map { it.name })
    }

    @Test
    fun `rename changes only the name, keeps the thumbnail and moves the draft to the top`() = runTest {
        var now = 1_000_000L
        var n = 0
        val repo = FileDraftRepository(tmp.root, clock = { now }, newId = { "id-${++n}" })
        val original = """{"format":"pp-editor","version":1,"name":"Sem nome","width":1080,"height":1350,""" +
            """"fabric":{"objects":[{"type":"Textbox","text":"Oi","left":12.5}],"background":"#ffffff"}}"""
        val a = repo.save(null, original, byteArrayOf(7, 8, 9))
        now += 5_000
        repo.save(null, doc("B"), null)
        now += 5_000

        repo.rename(a, "  Promoção de sexta  ")

        val list = repo.list()
        assertEquals(listOf("Promoção de sexta", "B"), list.map { it.name })
        assertEquals(now, list[0].updatedAt)
        assertArrayEquals(byteArrayOf(7, 8, 9), list[0].thumbnail!!.readBytes())
        val before = Json.parseToJsonElement(original).jsonObject
        val after = Json.parseToJsonElement(repo.load(a)!!).jsonObject
        assertEquals("Promoção de sexta", after["name"]!!.jsonPrimitive.content)
        assertEquals(before - "name", after - "name")

        repo.rename(a, "x".repeat(80))
        assertEquals("x".repeat(MAX_DRAFT_NAME), repo.list()[0].name)
    }

    @Test
    fun `rename rejects a missing draft and an empty name`() = runTest {
        val repo = FileDraftRepository(tmp.root, newId = { "id-1" })
        val a = repo.save(null, doc("A"), null)
        for ((id, name) in listOf("nao-existe" to "X", a to "   ", "../x" to "X")) {
            try {
                repo.rename(id, name)
                fail("accepted $id / '$name'")
            } catch (e: IllegalArgumentException) {
                // esperado
            }
        }
        assertEquals(listOf("A"), repo.list().map { it.name })
        assertEquals(listOf("id-1.json"), tmp.root.list()!!.sorted())
    }

    @Test
    fun `ids from the web side cannot escape the directory`() = runTest {
        val repo = FileDraftRepository(tmp.root)
        for (bad in listOf("../x", "a/b", "A", "", "x".repeat(65), "..")) {
            try {
                repo.save(bad, doc("X"), null)
                fail("accepted $bad")
            } catch (e: IllegalArgumentException) {
                // esperado
            }
            assertNull(repo.load(bad))
        }
    }

    @Test
    fun `rejects JSON that is not an editor document`() = runTest {
        val repo = FileDraftRepository(tmp.root)
        for (bad in listOf("""{"objects":[]}""", """{"format":"pp-editor","width":0,"height":5}""", "nope")) {
            try {
                repo.save(null, bad, null)
                fail("accepted $bad")
            } catch (e: Exception) {
                // esperado
            }
        }
        assertEquals(0, repo.list().size)
    }
}
