package com.productphoto.models

import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Assert.fail
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder
import java.io.File
import java.security.MessageDigest

class LocalModelManagerTest {
    @get:Rule val tmp = TemporaryFolder()

    private val bytes = ByteArray(200_000) { (it % 251).toByte() }
    private val sha = MessageDigest.getInstance("SHA-256").digest(bytes).toHex()

    private fun entry(sha256: String = sha, asset: String? = "models/m.onnx") =
        ModelEntry("m", "BACKGROUND_REMOVER", "m.onnx", bytes.size.toLong(), sha256, "Apache-2.0", "onnx", bundledAsset = asset)

    private fun manager(e: ModelEntry) = LocalModelManager(ModelCatalog(models = listOf(e)), tmp.root, openAsset = {
        assertEquals("models/m.onnx", it)
        bytes.inputStream()
    })

    @Test
    fun `bundled model is copied verified and then ready`() {
        val m = manager(entry())
        assertEquals(ModelState.NotDownloaded, m.state("m"))
        val file = m.ensureReady("m")!!
        assertTrue(file.readBytes().contentEquals(bytes))
        assertEquals(ModelState.Ready, m.state("m"))
    }

    @Test
    fun `hash mismatch throws and leaves nothing ready`() {
        val m = manager(entry(sha256 = "00".repeat(32)))
        try {
            m.ensureReady("m")
            fail()
        } catch (_: IllegalStateException) {
        }
        assertEquals(ModelState.NotDownloaded, m.state("m"))
    }

    @Test
    fun `download-only model without file returns null`() {
        assertNull(manager(entry(asset = null)).ensureReady("m"))
        assertNull(manager(entry()).ensureReady("unknown"))
    }

    @Test
    fun `truncated file is corrupt and gets reinstalled`() {
        val m = manager(entry())
        val file = m.ensureReady("m")!!
        file.writeBytes(bytes.copyOf(10))
        assertEquals(ModelState.Corrupt, m.state("m"))
        assertTrue(m.ensureReady("m")!!.readBytes().contentEquals(bytes))
    }

    @Test
    fun `diskBytes sums every file under the model directory`() {
        val m = manager(entry())
        assertEquals(0L, m.diskBytes("m"))
        m.ensureReady("m")
        File(tmp.root, "m/sub").mkdirs()
        File(tmp.root, "m/sub/extra.bin").writeBytes(ByteArray(1234))
        // o marcador é vazio: só o modelo e o extra contam
        assertEquals(bytes.size + 1234L, m.diskBytes("m"))
        File(tmp.root, "other").mkdirs()
        File(tmp.root, "other/x.bin").writeBytes(ByteArray(10))
        assertEquals(0L, m.diskBytes("other"))
        m.delete("m")
        assertEquals(0L, m.diskBytes("m"))
    }

    @Test
    fun `catalog parses`() {
        val c = ModelCatalog.parse(
            """{"version":1,"models":[{"id":"u2netp","capability":"BACKGROUND_REMOVER","file":"u2netp.onnx",
               "sizeBytes":4574861,"sha256":"ab","license":"Apache-2.0","format":"onnx","bundledAsset":"models/u2netp.onnx"}]}""",
        )
        assertEquals("models/u2netp.onnx", c.find("u2netp")?.bundledAsset)
    }

    @Test
    fun `pruneOrphans deletes directories of models no longer in the catalog`() {
        val sched = FakeScheduler()
        val m = LocalModelManager(ModelCatalog(models = listOf(entry())), tmp.root, { bytes.inputStream() }, sched)
        val kept = m.ensureReady("m")!!
        val orphan = File(tmp.root, "birefnet-lite").apply { mkdirs() }
        File(orphan, "birefnet_general_lite.onnx").writeBytes(ByteArray(10))

        m.pruneOrphans()

        assertFalse(orphan.exists())
        assertEquals(listOf("birefnet-lite"), sched.cancelled)
        assertTrue(kept.exists())
        assertEquals(ModelState.Ready, m.state("m"))
    }

    private class FakeScheduler : DownloadScheduler {
        val status = MutableStateFlow<DownloadStatus?>(null)
        val enqueued = mutableListOf<String>()
        val cancelled = mutableListOf<String>()
        override fun enqueue(entry: ModelEntry, dir: File) { enqueued += entry.id }
        override fun cancel(modelId: String) { cancelled += modelId }
        override fun status(modelId: String) = status
    }

    @Test
    fun `states combine download status with what is on disk`() = runBlocking {
        val sched = FakeScheduler()
        val e = entry(asset = null).copy(urls = listOf("https://x/m.onnx"))
        val m = LocalModelManager(ModelCatalog(models = listOf(e)), tmp.root, { error("no asset") }, sched)
        assertEquals(ModelState.NotDownloaded, m.states().first()["m"])

        m.download("m")
        assertEquals(listOf("m"), sched.enqueued)
        File(tmp.root, "m").mkdirs()
        File(tmp.root, "m/m.onnx.part").writeBytes(ByteArray(50_000))
        sched.status.value = DownloadStatus.Active(null)
        assertEquals(ModelState.Downloading(0.25f), m.states().first()["m"])   // fração do .part
        sched.status.value = DownloadStatus.Active(0.5f)
        assertEquals(ModelState.Downloading(0.5f), m.states().first()["m"])
        sched.status.value = DownloadStatus.Failed("hash", corrupt = true)
        assertEquals(ModelState.Corrupt, m.states().first()["m"])
        sched.status.value = DownloadStatus.Failed("sem espaço", corrupt = false)
        assertEquals(ModelState.Failed("sem espaço"), m.states().first()["m"])

        File(tmp.root, "m/m.onnx").writeBytes(bytes)
        File(tmp.root, "m/.verified-$sha").createNewFile()
        sched.status.value = DownloadStatus.Done
        assertEquals(ModelState.Ready, m.states().first()["m"])
        assertEquals("m.onnx", m.ensureReady("m")?.name)

        m.delete("m")
        assertEquals(listOf("m"), sched.cancelled)
        assertFalse(File(tmp.root, "m").exists())
        assertEquals(ModelState.NotDownloaded, m.states().first()["m"])
    }
}
