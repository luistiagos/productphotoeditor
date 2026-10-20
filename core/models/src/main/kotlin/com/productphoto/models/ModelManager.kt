package com.productphoto.models

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.flowOf
import kotlinx.coroutines.flow.flowOn
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.update
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import java.io.File
import java.io.InputStream
import java.security.MessageDigest

/** Entrada do catálogo `assets/models/models.json` (§5). */
@Serializable
data class ModelEntry(
    val id: String,
    val capability: String,
    val file: String,
    val sizeBytes: Long,
    val sha256: String,
    val license: String,
    val format: String,
    val minRamMb: Int = 0,
    /** Caminho em assets quando o modelo vem no APK; null = só por download. */
    val bundledAsset: String? = null,
    val urls: List<String> = emptyList(),
)

@Serializable
data class ModelCatalog(val version: Int = 1, val models: List<ModelEntry> = emptyList()) {
    fun find(id: String): ModelEntry? = models.firstOrNull { it.id == id }

    companion object {
        internal val json = Json { ignoreUnknownKeys = true }
        fun parse(text: String): ModelCatalog = json.decodeFromString(serializer(), text)
    }
}

sealed interface ModelState {
    data object NotDownloaded : ModelState
    data class Downloading(val fraction: Float) : ModelState
    data object Ready : ModelState
    data object Corrupt : ModelState
    /** Falha que não se resolve sozinha (sem espaço, HTTP 4xx, tentativas esgotadas). */
    data class Failed(val reason: String) : ModelState
}

/** Situação de um download agendado, vinda do agendador (WorkManager no app). */
sealed interface DownloadStatus {
    data class Active(val fraction: Float?) : DownloadStatus
    data class Failed(val reason: String, val corrupt: Boolean) : DownloadStatus
    data object Done : DownloadStatus
}

interface DownloadScheduler {
    fun enqueue(entry: ModelEntry, dir: File)
    fun cancel(modelId: String)
    /** null = nenhum trabalho conhecido (ou cancelado). */
    fun status(modelId: String): Flow<DownloadStatus?>
}

/** Modelos empacotados (cópia de assets + SHA-256) e baixáveis (por [DownloadScheduler], §16/§17). */
interface ModelManager {
    val catalog: ModelCatalog
    fun state(modelId: String): ModelState

    /** Arquivo pronto para o runtime; instala o empacotado se preciso. Null se não houver como obter. */
    fun ensureReady(modelId: String): File?

    /** Estado de cada modelo do catálogo, atualizado com o progresso dos downloads. */
    fun states(): Flow<Map<String, ModelState>>
    fun download(modelId: String)
    fun cancel(modelId: String)
    /** Cancela um download em andamento e apaga o modelo (e o `.part`). */
    fun delete(modelId: String)
    /** Bytes ocupados no disco pela pasta do modelo (inclui `.part`); 0 se não existe ou está fora do catálogo. */
    fun diskBytes(modelId: String): Long
}

class LocalModelManager(
    override val catalog: ModelCatalog,
    private val root: File,
    private val openAsset: (String) -> InputStream,
    private val scheduler: DownloadScheduler? = null,
) : ModelManager {
    private val lock = Any()
    private val changed = MutableStateFlow(0)

    private fun dir(entry: ModelEntry) = File(root, entry.id)
    private fun target(entry: ModelEntry) = entry.targetIn(dir(entry))
    private fun marker(entry: ModelEntry) = entry.markerIn(dir(entry))

    override fun state(modelId: String): ModelState {
        val entry = catalog.find(modelId) ?: return ModelState.NotDownloaded
        val file = target(entry)
        return when {
            !file.exists() -> ModelState.NotDownloaded
            marker(entry).exists() && file.length() == entry.sizeBytes -> ModelState.Ready
            else -> ModelState.Corrupt
        }
    }

    override fun ensureReady(modelId: String): File? = synchronized(lock) {
        val entry = catalog.find(modelId) ?: return null
        if (state(modelId) == ModelState.Ready) return target(entry)
        val asset = entry.bundledAsset ?: return null
        val dir = File(root, entry.id).apply { mkdirs() }
        dir.listFiles()?.forEach { it.delete() }
        val tmp = File(dir, entry.file + ".part")
        val digest = MessageDigest.getInstance("SHA-256")
        openAsset(asset).use { input ->
            tmp.outputStream().use { out ->
                val buf = ByteArray(64 * 1024)
                while (true) {
                    val n = input.read(buf)
                    if (n < 0) break
                    digest.update(buf, 0, n)
                    out.write(buf, 0, n)
                }
            }
        }
        val actual = digest.digest().toHex()
        if (!actual.equals(entry.sha256, ignoreCase = true)) {
            tmp.delete()
            throw IllegalStateException("sha256 mismatch for ${entry.id}: $actual")
        }
        val file = target(entry)
        check(tmp.renameTo(file)) { "could not move ${tmp.name}" }
        marker(entry).createNewFile()
        file
    }

    override fun states(): Flow<Map<String, ModelState>> {
        val each = catalog.models.map { e -> (scheduler?.status(e.id) ?: flowOf(null)).map { e to it } }
        val all = if (each.isEmpty()) flowOf(emptyList()) else combine(each) { it.toList() }
        return combine(all, changed) { list, _ -> list.associate { (e, st) -> e.id to resolve(e, st) } }
            .flowOn(Dispatchers.IO)
    }

    private fun resolve(entry: ModelEntry, status: DownloadStatus?): ModelState {
        val disk = state(entry.id)
        if (disk == ModelState.Ready) return disk
        return when (status) {
            is DownloadStatus.Active -> ModelState.Downloading(status.fraction ?: partFraction(entry))
            is DownloadStatus.Failed -> if (status.corrupt) ModelState.Corrupt else ModelState.Failed(status.reason)
            DownloadStatus.Done, null -> disk
        }
    }

    private fun partFraction(entry: ModelEntry): Float =
        (File(dir(entry), entry.file + ".part").length().toFloat() / entry.sizeBytes).coerceIn(0f, 1f)

    override fun download(modelId: String) {
        val entry = catalog.find(modelId) ?: error("modelo desconhecido: $modelId")
        require(entry.urls.isNotEmpty()) { "$modelId não tem URL" }
        val s = scheduler ?: error("sem agendador de download")
        s.enqueue(entry, dir(entry))
    }

    override fun cancel(modelId: String) {
        scheduler?.cancel(modelId)
        changed.update { it + 1 }
    }

    override fun delete(modelId: String) = synchronized(lock) {
        val entry = catalog.find(modelId) ?: return
        scheduler?.cancel(modelId)
        dir(entry).deleteRecursively()
        changed.update { it + 1 }
    }

    override fun diskBytes(modelId: String): Long {
        val entry = catalog.find(modelId) ?: return 0
        return dir(entry).walkTopDown().filter { it.isFile }.sumOf { it.length() }
    }

    /** Apaga diretórios de modelos que saíram do catálogo (ex. BiRefNet, ARQUITETURA §25): a UI não os lista. */
    fun pruneOrphans() = synchronized(lock) {
        val ids = catalog.models.mapTo(HashSet()) { it.id }
        root.listFiles()?.filter { it.isDirectory && it.name !in ids }?.forEach {
            scheduler?.cancel(it.name)
            it.deleteRecursively()
        }
        Unit
    }
}

internal fun ByteArray.toHex(): String = joinToString("") { "%02x".format(it) }
