package com.productphoto.models

import kotlinx.coroutines.runBlocking
import org.junit.After
import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Assert.fail
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder
import java.io.File
import java.net.InetAddress
import java.net.ServerSocket
import java.net.Socket
import java.security.MessageDigest
import java.util.Collections
import kotlin.concurrent.thread

private const val CRLF = "\r\n"

/** Servidor local (ServerSocket) que imita o GitHub: `/start` → 302 → `/file`, com suporte a `Range` (ARQUITETURA §16.1). */
class ModelDownloaderTest {
    @get:Rule val tmp = TemporaryFolder()

    private val bytes = ByteArray(300_000) { (it * 7 % 253).toByte() }
    private val sha = MessageDigest.getInstance("SHA-256").digest(bytes).toHex()
    private lateinit var server: ServerSocket
    /** Cabeçalho Range de cada GET em /file (null = sem Range). */
    private val ranges = Collections.synchronizedList(mutableListOf<String?>())
    @Volatile private var honorRange = true
    private val port get() = server.localPort

    @Before
    fun start() {
        server = ServerSocket(0, 50, InetAddress.getLoopbackAddress())
        thread(isDaemon = true) {
            while (!server.isClosed) {
                val socket = try { server.accept() } catch (_: Exception) { break }
                socket.use { serve(it) }
            }
        }
    }

    /** HTTP/1.1 mínimo, uma requisição por conexão. */
    private fun serve(socket: Socket) {
        val reader = socket.getInputStream().bufferedReader(Charsets.ISO_8859_1)
        val path = reader.readLine()?.split(" ")?.getOrNull(1) ?: return
        val headers = generateSequence { reader.readLine()?.takeIf { it.isNotEmpty() } }
            .associate { it.substringBefore(":").trim().lowercase() to it.substringAfter(":").trim() }
        val out = socket.getOutputStream()
        fun head(status: String, vararg h: String) =
            out.write((listOf("HTTP/1.1 $status", "Connection: close") + h + "" + "").joinToString(CRLF).toByteArray())
        when (path) {
            "/start" -> head("302 Found", "Location: /file", "Content-Length: 0")
            "/file" -> {
                val range = headers["range"]
                ranges += range
                val from = range?.takeIf { honorRange }?.removePrefix("bytes=")?.removeSuffix("-")?.toInt() ?: 0
                if (from > 0) {
                    head("206 Partial Content", "Content-Range: bytes $from-${bytes.size - 1}/${bytes.size}",
                        "Content-Length: ${bytes.size - from}")
                } else {
                    head("200 OK", "Content-Length: ${bytes.size}")
                }
                out.write(bytes, from, bytes.size - from)
            }
            else -> head("404 Not Found", "Content-Length: 0")
        }
        out.flush()
    }

    @After
    fun stop() = server.close()

    private fun entry(sha256: String = sha) = ModelEntry(
        "m", "BACKGROUND_REMOVER", "m.onnx", bytes.size.toLong(), sha256, "MIT", "onnx",
        urls = listOf("http://127.0.0.1:$port/start"),
    )

    private val dir get() = File(tmp.root, "m")
    private val part get() = File(dir, "m.onnx.part")

    @Test
    fun `full download follows redirect verifies and marks ready`() = runBlocking {
        val progress = mutableListOf<Long>()
        val file = ModelDownloader().download(entry(), dir) { done, _ -> progress += done }
        assertArrayEquals(bytes, file.readBytes())
        assertTrue(File(dir, ".verified-$sha").exists())
        assertFalse(part.exists())
        assertEquals(listOf<String?>(null), ranges)
        assertEquals(bytes.size.toLong(), progress.last())
        assertEquals(ModelState.Ready, LocalModelManager(ModelCatalog(models = listOf(entry())), tmp.root, { error("no asset") }).state("m"))
    }

    @Test
    fun `resumes from part with Range on every hop`() = runBlocking {
        dir.mkdirs()
        part.writeBytes(bytes.copyOf(120_000))
        val file = ModelDownloader().download(entry(), dir)
        assertArrayEquals(bytes, file.readBytes())
        assertEquals(listOf<String?>("bytes=120000-"), ranges)
    }

    @Test
    fun `server ignoring Range restarts from zero`() = runBlocking {
        honorRange = false
        dir.mkdirs()
        part.writeBytes(bytes.copyOf(50_000))
        assertArrayEquals(bytes, ModelDownloader().download(entry(), dir).readBytes())
    }

    @Test
    fun `garbage in part fails hash then downloads again from zero`() = runBlocking {
        dir.mkdirs()
        part.writeBytes(bytes.copyOf(200_000).also { for (i in 150_000 until 200_000) it[i] = 0 })
        val file = ModelDownloader().download(entry(), dir)
        assertArrayEquals(bytes, file.readBytes())
        assertEquals(listOf("bytes=200000-", null), ranges)
    }

    @Test
    fun `second hash failure is Corrupt and leaves nothing behind`() = runBlocking {
        try {
            ModelDownloader().download(entry(sha256 = "00".repeat(32)), dir)
            fail()
        } catch (e: DownloadFailure.Corrupt) {
            assertEquals(sha, e.actual)
        }
        assertEquals(2, ranges.size)
        assertFalse(part.exists())
        assertFalse(File(dir, "m.onnx").exists())
    }

    @Test
    fun `not enough space fails before any request`() = runBlocking {
        try {
            ModelDownloader(freeBytes = { 100_000 }).download(entry(), dir)
            fail()
        } catch (e: DownloadFailure.NoSpace) {
            assertEquals((bytes.size * 1.2).toLong(), e.needed)
        }
        assertTrue(ranges.isEmpty())
    }

    @Test
    fun `http 404 is a permanent failure`() = runBlocking {
        val e = entry().copy(urls = listOf("http://127.0.0.1:$port/missing"))
        try {
            ModelDownloader().download(e, dir)
            fail()
        } catch (f: DownloadFailure.Http) {
            assertEquals(404, f.code)
        }
        assertNull(dir.listFiles()?.firstOrNull { it.name == "m.onnx" })
    }
}
