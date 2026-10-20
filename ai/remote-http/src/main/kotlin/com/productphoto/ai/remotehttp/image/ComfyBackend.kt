package com.productphoto.ai.remotehttp.image

import com.productphoto.ai.api.AiError
import com.productphoto.ai.api.Progress
import com.productphoto.ai.api.ProgressSink
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.NonCancellable
import kotlinx.coroutines.delay
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.add
import kotlinx.serialization.json.booleanOrNull
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.put
import kotlinx.serialization.json.putJsonArray
import java.io.ByteArrayOutputStream
import java.net.SocketTimeoutException
import java.net.URLEncoder
import java.util.UUID
import kotlin.random.Random

/**
 * ComfyUI (§19.2): sobe as imagens em /upload/image, enfileira o grafo em /prompt e acompanha por
 * polling de /history/{id} (+ /queue para o estágio; o progresso por passo só existe no websocket,
 * descartado na §19.4). Cancelar tira da fila e interrompe. apiKey: Bearer para quem põe um proxy na frente.
 * workflow != null: fluxo do usuário com marcadores ([ComfyWorkflow.fillUser]); senão, o embutido.
 */
class ComfyBackend(
    baseUrl: String,
    apiKey: () -> String?,
    private val options: ComfyOptions,
    private val workflow: JsonObject? = null,
    private val pollMs: Long = 1_000,
    private val maxWaitMs: Long = 600_000,
    private val random: Random = Random.Default,
) : ImageBackend {
    private val http = Http(baseUrl, authHeader = { Http.bearer(apiKey()) })
    private val clientId = UUID.randomUUID().toString()

    override val invertsMask = false

    override suspend fun run(job: ImageJob, progress: ProgressSink?): List<ByteArray> {
        require(!job.maskInvert) { "ComfyUI não inverte a máscara: inverter antes" }
        val seed = job.seed ?: random.nextLong(0, 1L shl 48)
        // sem checkpoint/ControlNet → Unsupported antes de subir imagens
        if (workflow == null) ComfyWorkflow.builtIn(job, UploadedImages("-", "-", "-"), options, seed, 1)
        progress?.invoke(Progress(null, "Enviando imagens"))
        val names = UploadedImages(
            init = job.init?.let { upload(it) },
            mask = job.mask?.let { upload(it) },
            control = job.control?.let { upload(it.png) },
        )
        val out = when {
            workflow != null -> execute(ComfyWorkflow.fillUser(workflow, job, names, options, seed), progress)
            job.init == null -> execute(ComfyWorkflow.builtIn(job, names, options, seed, batch = job.count), progress)
            // VAEEncode gera um latente só: uma execução por imagem
            else -> (0 until job.count).flatMap { i -> execute(ComfyWorkflow.builtIn(job, names, options, seed + i, batch = 1), progress) }
        }
        return out.take(job.count)
    }

    /** multipart: image + overwrite + type=input → nome para o LoadImage. */
    private suspend fun upload(png: ByteArray): String {
        val boundary = "----pp" + UUID.randomUUID().toString().replace("-", "")
        val body = ByteArrayOutputStream().apply {
            fun text(s: String) = write(s.toByteArray())
            text("--$boundary\r\nContent-Disposition: form-data; name=\"image\"; filename=\"pp-${UUID.randomUUID()}.png\"\r\n")
            text("Content-Type: image/png\r\n\r\n")
            write(png)
            text("\r\n")
            for ((k, v) in listOf("overwrite" to "true", "type" to "input")) {
                text("--$boundary\r\nContent-Disposition: form-data; name=\"$k\"\r\n\r\n$v\r\n")
            }
            text("--$boundary--\r\n")
        }.toByteArray()
        val reply = Http.parseObject(
            http.call("POST", "/upload/image", body, "multipart/form-data; boundary=$boundary", readTimeoutMs = 60_000).decodeToString(),
        )
        val name = reply.str("name") ?: throw AiError.InvalidOutput("upload do ComfyUI sem name")
        val sub = reply.str("subfolder")
        return if (sub.isNullOrBlank()) name else "$sub/$name"
    }

    private suspend fun execute(graph: JsonObject, progress: ProgressSink?): List<ByteArray> {
        val queued = try {
            http.json("POST", "/prompt", buildJsonObject { put("prompt", graph); put("client_id", clientId) }, readTimeoutMs = 60_000)
        } catch (e: AiError.Remote) {
            if (e.code == 400) throw AiError.Remote(400, describeRejection(e.body))
            throw e
        }
        val id = queued.str("prompt_id") ?: throw AiError.InvalidOutput("ComfyUI não devolveu prompt_id")
        try {
            val start = System.currentTimeMillis()
            while (true) {
                val entry = http.json("GET", "/history/$id", readTimeoutMs = 30_000)[id] as? JsonObject
                if (entry != null && isFinished(entry)) return download(entry)
                progress?.let { it(Progress(null, stage(id))) }
                if (System.currentTimeMillis() - start > maxWaitMs) {
                    throw AiError.Network(SocketTimeoutException("ComfyUI não terminou em ${maxWaitMs / 1000} s"))
                }
                delay(pollMs)
            }
        } catch (e: CancellationException) {
            withContext(NonCancellable) {
                runCatching {
                    http.json("POST", "/queue", buildJsonObject { putJsonArray("delete") { add(id) } }, readTimeoutMs = 5_000)
                }
                runCatching { http.json("POST", "/interrupt", buildJsonObject { put("prompt_id", id) }, readTimeoutMs = 5_000) }
            }
            throw e
        }
    }

    private suspend fun stage(id: String): String {
        val q = runCatching { http.json("GET", "/queue", readTimeoutMs = 10_000) }.getOrNull() ?: return "Aguardando o servidor"
        fun ids(key: String) = (q[key] as? JsonArray).orEmpty().mapNotNull { ((it as? JsonArray)?.getOrNull(1) as? JsonPrimitive)?.contentOrNull }
        if (id in ids("queue_running")) return "Gerando no servidor"
        val pos = ids("queue_pending").indexOf(id)
        return if (pos >= 0) "Na fila (posição ${pos + 1})" else "Aguardando o servidor"
    }

    /** status ausente (versões antigas) → terminou se há outputs. Erro de execução → Remote(500, mensagem). */
    private fun isFinished(entry: JsonObject): Boolean {
        val status = entry["status"] as? JsonObject
            ?: return (entry["outputs"] as? JsonObject)?.isNotEmpty() == true
        if (status.str("status_str") == "error") {
            val messages = (status["messages"] as? JsonArray).orEmpty().mapNotNull { it as? JsonArray }
            val err = messages.firstOrNull { (it.getOrNull(0) as? JsonPrimitive)?.contentOrNull == "execution_error" }
                ?.getOrNull(1) as? JsonObject
            val text = when {
                err != null -> listOfNotNull(err.str("node_type"), err.str("exception_message")).joinToString(": ")
                messages.any { (it.getOrNull(0) as? JsonPrimitive)?.contentOrNull == "execution_interrupted" } -> "geração interrompida no servidor"
                else -> "erro na execução do fluxo"
            }
            throw AiError.Remote(500, text.take(2000))
        }
        return status.str("status_str") == "success" || (status["completed"] as? JsonPrimitive)?.booleanOrNull == true
    }

    /** Imagens `output` (SaveImage); se o fluxo só tiver PreviewImage, as `temp`. */
    private suspend fun download(entry: JsonObject): List<ByteArray> {
        val files = (entry["outputs"] as? JsonObject).orEmpty().values
            .flatMap { ((it as? JsonObject)?.get("images") as? JsonArray).orEmpty() }
            .mapNotNull { it as? JsonObject }
        val chosen = files.filter { it.str("type") == "output" }.ifEmpty { files.filter { it.str("type") == "temp" } }
        if (chosen.isEmpty()) throw AiError.InvalidOutput("o fluxo do ComfyUI não gerou imagens")
        return chosen.map { f ->
            val q = listOf("filename", "subfolder", "type").joinToString("&") { k -> "$k=" + URLEncoder.encode(f.str(k).orEmpty(), "UTF-8") }
            http.call("GET", "/view?$q", readTimeoutMs = 60_000)
        }
    }

    companion object {
        private fun JsonObject.str(key: String) = (this[key] as? JsonPrimitive)?.contentOrNull

        /** 400 do /prompt: `error.message` + o primeiro erro de cada nó. */
        fun describeRejection(body: String?): String {
            val root = body?.let { runCatching { Http.parseObject(it) }.getOrNull() } ?: return body.orEmpty().take(2000)
            val message = (root["error"] as? JsonObject)?.str("message") ?: "fluxo recusado"
            val nodes = (root["node_errors"] as? JsonObject).orEmpty().map { (id, v) ->
                val node = v as? JsonObject
                val first = ((node?.get("errors") as? JsonArray)?.firstOrNull() as? JsonObject)
                val detail = listOfNotNull(first?.str("message"), first?.str("details")?.takeIf { it.isNotBlank() }).joinToString(" — ")
                "${node?.str("class_type") ?: id}: $detail"
            }
            return (listOf(message) + nodes).joinToString("; ").take(2000)
        }
    }
}
