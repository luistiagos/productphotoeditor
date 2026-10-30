package com.productphoto.imaging

import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.fail
import org.junit.Test
import java.io.ByteArrayInputStream
import java.io.IOException

/** SEC-11: allowlist https, redirect conferido e tetos de bytes/pixels, sem rede. */
class RemoteFetchTest {

    @Test
    fun `only https on allowlisted hosts is accepted`() {
        for (ok in listOf(
            "https://huggingface.co/datasets/luisluis123/mockups/resolve/main/index.json",
            "https://us.aws.cdn.hf.co/xet-bridge-us/abc?X=1",
            "https://cdn-lfs-us-1.hf.co/repos/x",
            "https://fa.videorey.in/aiproduct/mockup/menucard1.webp",
            "HTTPS://HuggingFace.co/x",
        )) assertNull(ok, RemoteFetch.rejectReason(ok))
        for (bad in listOf(
            "http://huggingface.co/datasets/x.json",          // sem TLS
            "https://evil.example/x.webp",                    // host fora
            "https://huggingface.co.evil.example/x.webp",     // sufixo enganoso
            "https://evilhf.co/x.webp",                       // não é subdomínio
            "https://user:pw@huggingface.co/x",
            "file:///data/data/x",
            "nada",
        )) assertNotNull(bad, RemoteFetch.rejectReason(bad))
    }

    @Test
    fun `redirects are resolved against the current url and rechecked`() {
        val start = "https://huggingface.co/datasets/luisluis123/mockups/resolve/main/index.json"
        val rel = RemoteFetch.resolveRedirect(start, "/api/resolve-cache/datasets/luisluis123/mockups/abc/index.json?e=1")
        assertEquals("https://huggingface.co/api/resolve-cache/datasets/luisluis123/mockups/abc/index.json?e=1", rel)
        assertNull(RemoteFetch.rejectReason(rel))
        assertNotNull(RemoteFetch.rejectReason(RemoteFetch.resolveRedirect(start, "http://huggingface.co/x")))
        assertNotNull(RemoteFetch.rejectReason(RemoteFetch.resolveRedirect(start, "https://evil.example/x")))
    }

    @Test
    fun `reading stops past the byte limit`() {
        val n = 40_000
        val exact = ByteArray(n) { it.toByte() }
        assertArrayEquals(exact, RemoteFetch.readLimited(ByteArrayInputStream(exact), n))
        try {
            RemoteFetch.readLimited(ByteArrayInputStream(ByteArray(n + 1)), n)
            fail("N+1 bytes deveriam ser recusados")
        } catch (_: IOException) {
        }
    }

    @Test
    fun `images above the pixel limit are refused`() {
        RemoteFetch.checkPixels(4000, 4000)
        RemoteFetch.checkPixels(-1, -1) // cabeçalho ilegível: quem decodifica depois devolve null
        try {
            RemoteFetch.checkPixels(4001, 4000)
            fail("16,004 MP deveria ser recusado")
        } catch (_: IOException) {
        }
    }
}
