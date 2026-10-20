package com.productphoto.ai.api

import kotlinx.serialization.SerializationException
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.booleanOrNull
import kotlinx.serialization.json.doubleOrNull
import kotlinx.serialization.json.intOrNull
import kotlinx.serialization.json.jsonPrimitive

/**
 * Texto IA com JSON estruturado (§9, §18.5): instrui o modelo com o schema, extrai o JSON da
 * resposta, valida e tenta **uma** vez de novo com o erro anexado. Igual para todos os provedores.
 *
 * Subconjunto de JSON Schema aceito: type (object, array, string, number, integer, boolean),
 * properties, required, items, minItems, maxItems, minLength, enum.
 */
object StructuredText {
    suspend fun generate(gen: TextGenerator, req: TextRequest): JsonElement {
        val schemaText = requireNotNull(req.jsonSchema) { "jsonSchema is required" }
        val schema = Json.parseToJsonElement(schemaText) as? JsonObject
            ?: throw IllegalArgumentException("jsonSchema must be an object")
        val first = withJsonInstruction(req)
        var problem = ""
        for (attempt in 0..1) {
            val request = if (attempt == 0) first else first.copy(prompt = first.prompt + retryNote(problem))
            val raw = gen.generate(request)
            val parsed = try {
                extractJson(raw)
            } catch (e: IllegalArgumentException) {
                problem = e.message ?: "invalid JSON"
                continue
            }
            val errors = validate(parsed, schema)
            if (errors.isEmpty()) return parsed
            problem = errors.take(5).joinToString("; ")
        }
        throw AiError.InvalidOutput("JSON inválido após 1 nova tentativa: $problem")
    }

    /**
     * Acrescenta ao system a exigência de JSON com um **exemplo da forma** gerado do schema. O schema cru não vai
     * no texto: modelos pequenos (Qwen3-0.6B) o devolviam como resposta (§18.7).
     */
    fun withJsonInstruction(req: TextRequest): TextRequest {
        val schema = Json.parseToJsonElement(requireNotNull(req.jsonSchema)) as JsonObject
        val note = "Reply with only one JSON value, no markdown and no explanations, in exactly this shape " +
            "(replace each \"...\" with your text):\n${skeleton(schema)}"
        return req.copy(system = listOfNotNull(req.system, note).joinToString("\n\n"))
    }

    /** Exemplo mínimo que satisfaz a forma do schema: strings viram "...", arrays têm max(minItems, 2) itens. */
    fun skeleton(schema: JsonObject): JsonElement {
        (schema["enum"] as? JsonArray)?.firstOrNull()?.let { return it }
        return when ((schema["type"] as? JsonPrimitive)?.content) {
            "object" -> JsonObject(((schema["properties"] as? JsonObject) ?: JsonObject(emptyMap()))
                .mapValues { (_, sub) -> skeleton(sub as? JsonObject ?: JsonObject(emptyMap())) })
            "array" -> {
                val item = (schema["items"] as? JsonObject)?.let { skeleton(it) } ?: JsonPrimitive("...")
                JsonArray(List(maxOf(schema.int("minItems") ?: 0, 2).coerceAtMost(schema.int("maxItems") ?: Int.MAX_VALUE)) { item })
            }
            "number", "integer" -> JsonPrimitive(0)
            "boolean" -> JsonPrimitive(true)
            else -> JsonPrimitive("...")
        }
    }

    private fun retryNote(problem: String) =
        "\n\nYour previous answer was rejected: $problem. Reply again with only the corrected JSON."

    /** Tira raciocínio, cercas de markdown e texto em volta; lança IllegalArgumentException se não houver JSON. */
    fun extractJson(raw: String): JsonElement {
        var text = stripThinking(raw)
        FENCE.find(text)?.let { text = it.groupValues[1].trim() }
        val start = text.indexOfFirst { it == '{' || it == '[' }
        require(start >= 0) { "the answer has no JSON" }
        val close = if (text[start] == '{') '}' else ']'
        val end = text.lastIndexOf(close)
        require(end > start) { "the JSON is not closed" }
        return try {
            Json.parseToJsonElement(text.substring(start, end + 1))
        } catch (e: SerializationException) {
            throw IllegalArgumentException("the answer is not valid JSON")
        }
    }

    /** Remove blocos `<think>…</think>` (modelos com raciocínio, ex. Qwen3) e um `<think>` sem fechamento. */
    fun stripThinking(raw: String): String =
        THINK.replace(raw, "").let { if ("<think>" in it) it.substringBefore("<think>") else it }.trim()

    /** Lista de erros (vazia = válido). */
    fun validate(value: JsonElement, schema: JsonObject, path: String = "$"): List<String> {
        val errors = mutableListOf<String>()
        (schema["enum"] as? JsonArray)?.let { options ->
            if (value !in options) errors += "$path must be one of $options"
        }
        when (val type = (schema["type"] as? JsonPrimitive)?.content) {
            null -> Unit
            "object" -> {
                if (value !is JsonObject) return errors + "$path must be an object"
                (schema["required"] as? JsonArray)?.forEach { key ->
                    val k = key.jsonPrimitive.content
                    if (value[k] == null || value[k] is JsonNull) errors += "$path.$k is missing"
                }
                (schema["properties"] as? JsonObject)?.forEach { (k, sub) ->
                    val v = value[k]
                    if (v != null && v !is JsonNull && sub is JsonObject) errors += validate(v, sub, "$path.$k")
                }
            }
            "array" -> {
                if (value !is JsonArray) return errors + "$path must be an array"
                schema.int("minItems")?.let { if (value.size < it) errors += "$path needs at least $it items" }
                schema.int("maxItems")?.let { if (value.size > it) errors += "$path allows at most $it items" }
                (schema["items"] as? JsonObject)?.let { items ->
                    value.forEachIndexed { i, v -> errors += validate(v, items, "$path[$i]") }
                }
            }
            "string" -> {
                if (value !is JsonPrimitive || !value.isString) return errors + "$path must be a string"
                schema.int("minLength")?.let { if (value.content.trim().length < it) errors += "$path is too short" }
            }
            "number" -> if (value !is JsonPrimitive || value.isString || value.doubleOrNull == null) errors += "$path must be a number"
            "integer" -> if (value !is JsonPrimitive || value.isString || value.content.toLongOrNull() == null) errors += "$path must be an integer"
            "boolean" -> if (value !is JsonPrimitive || value.isString || value.booleanOrNull == null) errors += "$path must be a boolean"
            else -> errors += "$path: unsupported schema type $type"
        }
        return errors
    }

    private fun JsonObject.int(key: String): Int? = (this[key] as? JsonPrimitive)?.intOrNull

    private val THINK = Regex("<think>.*?</think>", RegexOption.DOT_MATCHES_ALL)
    private val FENCE = Regex("```(?:json)?\\s*(.*?)```", RegexOption.DOT_MATCHES_ALL)
}
