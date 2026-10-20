package com.productphoto.data

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.int
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import java.io.File
import java.util.UUID

data class DraftInfo(
    val id: String,
    val name: String,
    val width: Int,
    val height: Int,
    val updatedAt: Long,
    /** Miniatura (JPEG) ou null se ainda não houver. */
    val thumbnail: File?,
)

/** Tamanho máximo do nome de um rascunho (ARQUITETURA §30). */
const val MAX_DRAFT_NAME = 60

/** Rascunhos = documento do editor (JSON `pp-editor`) + miniatura (ARQUITETURA §9 e §15.2). */
interface DraftRepository {
    suspend fun list(): List<DraftInfo>
    suspend fun load(id: String): String?
    /** id nulo cria um rascunho novo; devolve o id. */
    suspend fun save(id: String?, document: String, thumbnail: ByteArray?): String
    suspend fun delete(id: String)
    /** Troca o `"name"` do documento (aparado, até [MAX_DRAFT_NAME]); mantém a miniatura e sobe na lista. */
    suspend fun rename(id: String, name: String)
}

class FileDraftRepository(
    private val dir: File,
    private val clock: () -> Long = System::currentTimeMillis,
    private val newId: () -> String = { UUID.randomUUID().toString() },
) : DraftRepository {

    private fun doc(id: String) = File(dir, "${requireValidId(id)}.json")
    private fun thumb(id: String) = File(dir, "${requireValidId(id)}.jpg")

    override suspend fun list(): List<DraftInfo> = withContext(Dispatchers.IO) {
        val files = dir.listFiles { f -> f.isFile && f.name.endsWith(".json") }.orEmpty()
        files.mapNotNull { f ->
            val id = f.name.removeSuffix(".json")
            if (!isValidId(id)) return@mapNotNull null
            val head = runCatching { header(f.readText()) }.getOrNull() ?: return@mapNotNull null
            val t = thumb(id)
            DraftInfo(id, head.name, head.width, head.height, f.lastModified(), t.takeIf { it.exists() })
        }.sortedByDescending { it.updatedAt }
    }

    override suspend fun load(id: String): String? = withContext(Dispatchers.IO) {
        if (!isValidId(id)) return@withContext null
        doc(id).takeIf { it.exists() }?.readText()
    }

    override suspend fun save(id: String?, document: String, thumbnail: ByteArray?): String = withContext(Dispatchers.IO) {
        header(document) // valida antes de gravar: lança em JSON que não é documento do editor
        val draftId = id?.let(::requireValidId) ?: newId()
        if (thumbnail != null) thumb(draftId).writeAtomically(thumbnail)
        val f = doc(draftId)
        f.writeAtomically(document.encodeToByteArray())
        f.setLastModified(clock())
        draftId
    }

    override suspend fun delete(id: String) = withContext(Dispatchers.IO) {
        doc(id).delete()
        thumb(id).delete()
        Unit
    }

    override suspend fun rename(id: String, name: String) = withContext(Dispatchers.IO) {
        val clean = name.trim().take(MAX_DRAFT_NAME)
        require(clean.isNotEmpty()) { "empty name" }
        val f = doc(id)
        require(f.exists()) { "draft not found" }
        val o = json.parseToJsonElement(f.readText()).jsonObject
        save(id, JsonObject(o + ("name" to JsonPrimitive(clean))).toString(), null)
        Unit
    }

    private data class Header(val name: String, val width: Int, val height: Int)

    private fun header(document: String): Header {
        val o: JsonObject = json.parseToJsonElement(document).jsonObject
        require(o["format"]?.jsonPrimitive?.content == "pp-editor") { "not an editor document" }
        val w = o["width"]!!.jsonPrimitive.int
        val h = o["height"]!!.jsonPrimitive.int
        require(w in 1..8000 && h in 1..8000) { "invalid size" }
        return Header(o["name"]?.jsonPrimitive?.content ?: "Sem nome", w, h)
    }

    private companion object {
        val json = Json { ignoreUnknownKeys = true }
    }
}
