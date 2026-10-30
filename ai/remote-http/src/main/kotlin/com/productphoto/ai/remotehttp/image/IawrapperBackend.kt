package com.productphoto.ai.remotehttp.image

import com.productphoto.ai.api.AiError
import com.productphoto.ai.api.Progress
import com.productphoto.ai.api.ProgressSink
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.NonCancellable
import kotlinx.coroutines.delay
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.intOrNull
import kotlinx.serialization.json.put
import java.net.SocketTimeoutException

data class IawrapperOptions(
    val featureSlug: String = "product-photo-vast",
    val steps: Int = 8,
    // O iawrapper sÃ³ roda sync para admin (SEC-15.5): o app gera assÃ­ncrono e consulta a task. A 1,5 s o polling
    // fica em ~40 GET/min por geraÃ§Ã£o, longe do limite de 300/min por usuÃ¡rio.
    val sync: Boolean = false,
    val pollMs: Long = 1_500,
    val maxWaitMs: Long = 300_000,
    // Cadastro por app (SEC-13.2): o login vai com X-App-Id e o servidor grava o app no token. Nulo = sem header,
    // e o iawrapper recusa o login com 400.
    val appId: String? = null,
)

/**
 * Backend de geraÃ§Ã£o de imagem remoto integrado ao iawrapper.
 *
 * Suporta autenticaÃ§Ã£o por email:senha (obtÃ©m JWT via /api/auth/login/) ou Bearer token direto.
 * Despacha tasks em POST /api/tasks/, monitora execuÃ§Ã£o assÃ­ncrona com cancelamento e
 * realiza download das imagens geradas (R2 / Cloudinary / CDN) ou decodificaÃ§Ã£o direta de Base64 (Zero-Hop).
 */
class IawrapperBackend(
    baseUrl: String,
    private val auth: () -> String?,
    private val options: IawrapperOptions = IawrapperOptions(),
) : ImageBackend {

    @Volatile
    private var cachedToken: String? = null

    private val http = Http(baseUrl, authHeader = { resolveAuthHeader() })

    override val invertsMask: Boolean = false

    override suspend fun run(job: ImageJob, progress: ProgressSink?): List<ByteArray> {
        val count = job.count.coerceAtLeast(1)
        val results = mutableListOf<ByteArray>()

        for (i in 0 until count) {
            val progressPrefix = if (count > 1) "Imagem ${i + 1}/$count: " else ""
            progress?.invoke(Progress(i.toFloat() / count, "${progressPrefix}Enviando pedido ao iawrapper"))

            val body = buildJsonObject {
                put("feature_slug", options.featureSlug)
                put("prompt", job.prompt)
                put("negative_prompt", job.negative ?: "blurry, ugly, distorted, low quality")
                put("width", job.width)
                put("height", job.height)
                put("steps", job.steps ?: options.steps)
                if (options.sync) {
                    put("sync", true)
                }
                job.seed?.let { put("seed", it + i) }
                job.init?.let {
                    put("init_image", java.util.Base64.getEncoder().encodeToString(it))
                }
                job.mask?.let {
                    put("mask_image", java.util.Base64.getEncoder().encodeToString(it))
                }
                job.strength?.let {
                    put("strength", it)
                }
            }

            val bytes = dispatchAndAwait(body, progressPrefix, progress)
            results.add(bytes)
        }

        return results
    }

    suspend fun relight(
        imageBytes: ByteArray,
        lightDirection: String,
        prompt: String?,
        strength: Float = 0.35f,
        progress: ProgressSink? = null,
    ): ByteArray {
        val body = buildJsonObject {
            put("feature_slug", "product-relight")
            put("prompt", prompt ?: "commercial product photography, studio illumination, realistic lighting")
            put("light_direction", lightDirection)
            put("strength", strength)
            put("init_image", java.util.Base64.getEncoder().encodeToString(imageBytes))
            put("steps", options.steps)
            if (options.sync) put("sync", true)
        }
        return dispatchAndAwait(body, "Harmonizando luz: ", progress)
    }

    suspend fun outpaint(
        expandedImageBytes: ByteArray,
        maskBytes: ByteArray,
        prompt: String?,
        width: Int,
        height: Int,
        progress: ProgressSink? = null,
    ): ByteArray {
        val body = buildJsonObject {
            put("feature_slug", "product-outpaint")
            put("prompt", prompt ?: "seamless continuous background, matching ambient environment, highly detailed")
            put("negative_prompt", "blurry, seams, edges, distortion, low quality")
            put("width", width)
            put("height", height)
            put("init_image", java.util.Base64.getEncoder().encodeToString(expandedImageBytes))
            put("mask_image", java.util.Base64.getEncoder().encodeToString(maskBytes))
            put("steps", options.steps)
            if (options.sync) put("sync", true)
        }
        return dispatchAndAwait(body, "Expandindo formato: ", progress)
    }

    suspend fun dispatchAndAwait(
        body: JsonObject,
        progressPrefix: String = "",
        progress: ProgressSink? = null,
    ): ByteArray {
        var taskId: Int? = null
        // Com sync o servidor sÃ³ responde ao terminar: o POST tambÃ©m respeita o maxWaitMs, nÃ£o os 10 min do Http.
        val postTimeoutMs = options.maxWaitMs.toInt()
        try {
            val initialResp = try {
                http.json("POST", "/api/tasks/", body, readTimeoutMs = postTimeoutMs)
            } catch (e: AiError.Remote) {
                if (e.code == 401 && cachedToken != null) {
                    cachedToken = null
                    http.json("POST", "/api/tasks/", body, readTimeoutMs = postTimeoutMs)
                } else {
                    throw e
                }
            }

            taskId = (initialResp["id"] as? JsonPrimitive)?.intOrNull
                ?: (initialResp["id"] as? JsonPrimitive)?.contentOrNull?.toIntOrNull()

            var taskData = initialResp
            var currentStatus = (taskData["status"] as? JsonPrimitive)?.contentOrNull ?: "pending"

            val startTime = System.currentTimeMillis()
            while (currentStatus != "success" && currentStatus != "failed" && currentStatus != "cancelled") {
                if (System.currentTimeMillis() - startTime > options.maxWaitMs) {
                    throw AiError.Network(SocketTimeoutException("iawrapper nÃ£o concluiu em ${options.maxWaitMs / 1000}s"))
                }
                delay(options.pollMs)
                progress?.invoke(Progress(null, "${progressPrefix}Gerando no servidor ($currentStatus)..."))

                if (taskId != null) {
                    taskData = http.json("GET", "/api/tasks/$taskId/")
                    currentStatus = (taskData["status"] as? JsonPrimitive)?.contentOrNull ?: "unknown"
                }
            }

            if (currentStatus == "failed") {
                val err = (taskData["error_message"] as? JsonPrimitive)?.contentOrNull
                    ?: "Falha na geraÃ§Ã£o da imagem pelo iawrapper"
                throw AiError.Remote(500, err)
            }

            if (currentStatus == "cancelled") {
                throw CancellationException("Task cancelada no iawrapper")
            }

            val outputs = (taskData["outputs"] as? JsonArray).orEmpty()
            val firstOut = outputs.firstOrNull() as? JsonObject
                ?: throw AiError.InvalidOutput("iawrapper nÃ£o retornou saÃ­das vÃ¡lidas")

            val b64 = (firstOut["b64_data"] as? JsonPrimitive)?.contentOrNull
                ?: ((firstOut["payload_json"] as? JsonObject)?.get("b64_data") as? JsonPrimitive)?.contentOrNull

            if (!b64.isNullOrBlank()) {
                progress?.invoke(Progress(null, "${progressPrefix}Decodificando resultado em memÃ³ria..."))
                return java.util.Base64.getDecoder().decode(b64.trim())
            } else {
                val imageUrl = (firstOut["external_url"] as? JsonPrimitive)?.contentOrNull
                    ?: throw AiError.InvalidOutput("iawrapper nÃ£o retornou URL do arquivo gerado")

                progress?.invoke(Progress(null, "${progressPrefix}Baixando resultado..."))
                return http.call("GET", imageUrl, readTimeoutMs = 60_000)
            }

        } catch (e: CancellationException) {
            taskId?.let { id ->
                withContext(NonCancellable) {
                    runCatching {
                        http.call("POST", "/api/tasks/$id/cancel/", "{}".toByteArray(), readTimeoutMs = 5_000)
                    }
                }
            }
            throw e
        }
    }

    private fun resolveAuthHeader(): String? {
        val secret = auth()?.trim() ?: return null
        if (secret.isBlank()) return null

        if (!secret.contains(":")) {
            return Http.bearer(secret)
        }

        cachedToken?.let { return Http.bearer(it) }

        // Login sÃ­ncrono com credenciais email:senha
        return runCatching {
            val parts = secret.split(":", limit = 2)
            val loginPayload = buildJsonObject {
                put("email", parts[0].trim())
                put("password", parts[1].trim())
            }
            val conn = java.net.URL(http.base + "/api/auth/login/").openConnection() as java.net.HttpURLConnection
            conn.requestMethod = "POST"
            conn.connectTimeout = 10_000
            conn.readTimeout = 15_000
            conn.doOutput = true
            conn.setRequestProperty("Content-Type", Http.JSON)
            options.appId?.takeIf { it.isNotBlank() }?.let { conn.setRequestProperty(APP_HEADER, it.trim()) }
            val bytes = loginPayload.toString().toByteArray()
            conn.setFixedLengthStreamingMode(bytes.size)
            conn.outputStream.use { it.write(bytes) }

            if (conn.responseCode !in 200..299) {
                val errBody = conn.errorStream?.use { it.readBytes().decodeToString() }
                throw AiError.Remote(conn.responseCode, errBody?.take(1000) ?: "Falha no login do iawrapper")
            }

            val respText = conn.inputStream.use { it.readBytes().decodeToString() }
            val obj = Http.parseObject(respText)
            val access = (obj["access"] as? JsonPrimitive)?.contentOrNull
                ?: throw AiError.InvalidOutput("iawrapper nÃ£o devolveu token access no login")
            cachedToken = access
            Http.bearer(access)
        }.getOrThrow()
    }

    companion object {
        const val APP_HEADER = "X-App-Id"
    }
}
