package com.productphoto.ai.remotehttp

import com.productphoto.ai.api.AiError
import com.productphoto.ai.api.Capability
import com.productphoto.ai.api.ProviderContext
import com.productphoto.ai.api.ProviderFactory
import com.productphoto.ai.api.Requirement
import com.productphoto.ai.api.SettingField
import com.productphoto.ai.api.StructuredText
import com.productphoto.ai.api.TextGenerator
import com.productphoto.ai.api.TextRequest
import com.productphoto.ai.api.service
import com.productphoto.secrets.SecretStore
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.async
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.ensureActive
import kotlinx.serialization.SerializationException
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.addJsonObject
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.put
import kotlinx.serialization.json.putJsonArray
import kotlinx.serialization.json.putJsonObject
import java.io.IOException
import java.net.HttpURLConnection
import java.net.URL

/**
 * Qualquer servidor com `POST /chat/completions` no formato da OpenAI (OpenAI, OpenRouter, Ollama,
 * LM Studio, llama.cpp server). jsonSchema → `response_format: json_object`; o schema já vai no
 * system pelo [StructuredText] (§18.5).
 */
class OpenAiCompatibleTextGenerator(
    baseUrl: String,
    private val model: String,
    private val apiKey: () -> String?,
    private val connectTimeoutMs: Int = 15_000,
    private val readTimeoutMs: Int = 120_000,
) : TextGenerator {
    private val endpoint = baseUrl.trim().trimEnd('/') + "/chat/completions"

    override suspend fun generate(req: TextRequest): String = coroutineScope {
        val body = requestBody(model, req).toString().toByteArray()
        val conn = try {
            URL(endpoint).openConnection() as HttpURLConnection
        } catch (e: IOException) {
            throw AiError.Network(e)
        }
        // Como no image/Http: um job preso na leitura não "completa", então invokeOnCompletion { disconnect }
        // só dispararia depois da resposta. A troca roda à parte e quem espera, ao ser cancelado, desconecta.
        val io = async(Dispatchers.IO) { exchange(conn, body) }
        try {
            io.await()
        } catch (e: CancellationException) {
            conn.disconnect()
            throw e
        }
    }

    private fun CoroutineScope.exchange(conn: HttpURLConnection, body: ByteArray): String = try {
        conn.requestMethod = "POST"
        conn.connectTimeout = connectTimeoutMs
        conn.readTimeout = readTimeoutMs
        conn.doOutput = true
        conn.setRequestProperty("Content-Type", "application/json")
        conn.setRequestProperty("Accept", "application/json")
        apiKey()?.takeIf { it.isNotBlank() }?.let { conn.setRequestProperty("Authorization", "Bearer $it") }
        conn.setFixedLengthStreamingMode(body.size)
        conn.outputStream.use { it.write(body) }
        val code = conn.responseCode
        if (code !in 200..299) {
            val err = runCatching { conn.errorStream?.use { it.readBytes().decodeToString() } }.getOrNull()
            throw AiError.Remote(code, err?.take(2000))
        }
        parseContent(conn.inputStream.use { it.readBytes().decodeToString() })
    } catch (e: IOException) {
        ensureActive()
        throw AiError.Network(e)
    } finally {
        conn.disconnect()
    }

    companion object {
        fun requestBody(model: String, req: TextRequest): JsonObject = buildJsonObject {
            put("model", model)
            putJsonArray("messages") {
                req.system?.let { s -> addJsonObject { put("role", "system"); put("content", s) } }
                addJsonObject { put("role", "user"); put("content", req.prompt) }
            }
            put("temperature", req.temperature)
            put("max_tokens", req.maxTokens)
            put("stream", false)
            if (req.jsonSchema != null) putJsonObject("response_format") { put("type", "json_object") }
        }

        /** `choices[0].message.content`, sem blocos de raciocínio. */
        fun parseContent(body: String): String {
            val root = try {
                Json.parseToJsonElement(body) as? JsonObject
            } catch (e: SerializationException) {
                null
            } ?: throw AiError.InvalidOutput("resposta do servidor não é JSON")
            val choice = (root["choices"] as? JsonArray)?.firstOrNull() as? JsonObject
            val content = ((choice?.get("message") as? JsonObject)?.get("content") as? JsonPrimitive)?.contentOrNull
                ?: throw AiError.InvalidOutput("resposta sem choices[0].message.content")
            return StructuredText.stripThinking(content)
        }
    }
}

class OpenAiCompatibleFactory : ProviderFactory<TextGenerator> {
    override val id = ID
    override val capability = Capability.TEXT_GENERATOR
    override val displayName = "Servidor compatível com OpenAI"
    override val isLocal = false
    override val settingsSchema = listOf(
        SettingField(BASE_URL, "URL base (até /v1)", SettingField.Kind.URL, "http://192.168.0.10:11434/v1"),
        SettingField(MODEL, "Modelo", SettingField.Kind.TEXT),
        SettingField(API_KEY_SECRET, "Nome da chave", SettingField.Kind.SECRET_NAME),
    )

    override fun requirements(settings: JsonObject): List<Requirement> =
        listOfNotNull(Requirement.Network, settings.str(API_KEY_SECRET)?.let { Requirement.Secret(it) })

    override fun create(settings: JsonObject, ctx: ProviderContext): TextGenerator {
        val url = settings.str(BASE_URL) ?: throw AiError.Unsupported("servidor de texto sem URL")
        val model = settings.str(MODEL) ?: throw AiError.Unsupported("servidor de texto sem modelo")
        val secretName = settings.str(API_KEY_SECRET)
        val secrets = ctx.service<SecretStore>()
        return OpenAiCompatibleTextGenerator(url, model, apiKey = { secretName?.let { secrets?.get(it) } })
    }

    companion object {
        const val ID = "http.openai-compatible"
        const val BASE_URL = "baseUrl"
        const val MODEL = "model"
        const val API_KEY_SECRET = "apiKeySecret"

        private fun JsonObject.str(key: String) = (this[key] as? JsonPrimitive)?.contentOrNull?.takeIf { it.isNotBlank() }
    }
}
