package com.productphoto.ai.remotehttp.image

import com.productphoto.ai.api.AiError
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.async
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.ensureActive
import kotlinx.serialization.SerializationException
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import java.io.IOException
import java.net.HttpURLConnection
import java.net.URL
import java.util.Base64

/**
 * HTTP dos backends de imagem, no padrão do OpenAiCompatibleTextGenerator: cancelar a coroutine
 * derruba a conexão; IOException → [AiError.Network]; status ≠ 2xx → [AiError.Remote] com o corpo.
 */
internal class Http(
    baseUrl: String,
    private val authHeader: () -> String?,
    private val connectTimeoutMs: Int = 15_000,
    private val readTimeoutMs: Int = 600_000,
) {
    val base = baseUrl.trim().trimEnd('/')

    suspend fun call(
        method: String,
        path: String,
        body: ByteArray? = null,
        contentType: String = JSON,
        readTimeoutMs: Int = this.readTimeoutMs,
    ): ByteArray = coroutineScope {
        val conn = try {
            URL(base + path).openConnection() as HttpURLConnection
        } catch (e: IOException) {
            throw AiError.Network(e)
        }
        // A troca bloqueante roda à parte: um job preso na leitura não "completa", então
        // invokeOnCompletion { disconnect } só dispararia depois da resposta. Quem espera desconecta.
        val io = async(Dispatchers.IO) { exchange(conn, method, body, contentType, readTimeoutMs) }
        try {
            io.await()
        } catch (e: CancellationException) {
            conn.disconnect()
            throw e
        }
    }

    private fun CoroutineScope.exchange(
        conn: HttpURLConnection, method: String, body: ByteArray?, contentType: String, readTimeoutMs: Int,
    ): ByteArray = try {
        conn.requestMethod = method
        conn.connectTimeout = connectTimeoutMs
        conn.readTimeout = readTimeoutMs
        authHeader()?.let { conn.setRequestProperty("Authorization", it) }
        if (body != null) {
            conn.doOutput = true
            conn.setRequestProperty("Content-Type", contentType)
            conn.setFixedLengthStreamingMode(body.size)
            conn.outputStream.use { it.write(body) }
        }
        val code = conn.responseCode
        if (code !in 200..299) {
            val err = runCatching { conn.errorStream?.use { it.readBytes().decodeToString() } }.getOrNull()
            throw AiError.Remote(code, err?.take(2000))
        }
        conn.inputStream.use { it.readBytes() }
    } catch (e: IOException) {
        ensureActive()
        throw AiError.Network(e)
    } finally {
        conn.disconnect()
    }

    suspend fun json(method: String, path: String, body: JsonElement? = null, readTimeoutMs: Int = this.readTimeoutMs): JsonObject =
        parseObject(call(method, path, body?.toString()?.toByteArray(), readTimeoutMs = readTimeoutMs).decodeToString())

    companion object {
        const val JSON = "application/json"

        fun parseObject(text: String): JsonObject = try {
            Json.parseToJsonElement(text) as? JsonObject
        } catch (e: SerializationException) {
            null
        } ?: throw AiError.InvalidOutput("resposta do servidor não é um objeto JSON")

        /** "usuário:senha" → cabeçalho HTTP Basic. */
        fun basic(userPass: String?): String? =
            userPass?.takeIf { it.isNotBlank() }?.let { "Basic " + Base64.getEncoder().encodeToString(it.toByteArray()) }

        fun bearer(key: String?): String? = key?.takeIf { it.isNotBlank() }?.let { "Bearer $it" }
    }
}
