package com.productphoto.editor

import com.productphoto.ai.api.AiError
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.CoroutineStart
import kotlinx.coroutines.Job
import kotlinx.coroutines.launch
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.double
import kotlinx.serialization.json.doubleOrNull
import kotlinx.serialization.json.int
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.put
import java.util.concurrent.atomic.AtomicInteger

/**
 * Protocolo da ponte (ARQUITETURA §15.2), espelho de editor-web/src/protocol.ts:
 * `{v, id, type, payload}`; resposta `{v, id, type:"result", ok, payload | error:{code,message}}`;
 * progresso `{v, id, type:"progress", payload:{fraction, stage}}`; desistência `{v, id, type:"cancel"}` com o id do
 * pedido, sem resposta — o pedido termina com `cancelled` (§26.2).
 */
object EditorProtocol {
    const val VERSION = 1
    val json = Json { ignoreUnknownKeys = true; explicitNulls = false }

    sealed interface Message { val id: String }
    data class Request(override val id: String, val type: String, val payload: JsonElement?) : Message
    data class Result(override val id: String, val ok: Boolean, val payload: JsonElement?, val error: BridgeException?) : Message
    data class ProgressMsg(override val id: String, val fraction: Double?, val stage: String) : Message
    /** Quem pediu desistiu do pedido `id`; não tem resposta (§26.2). */
    data class Cancel(override val id: String) : Message

    class ProtocolException(msg: String) : Exception(msg)

    fun parse(raw: String): Message {
        val o = try {
            json.parseToJsonElement(raw).jsonObject
        } catch (e: Exception) {
            throw ProtocolException("not a JSON object")
        }
        val v = (o["v"] as? JsonPrimitive)?.let { runCatching { it.int }.getOrNull() }
        if (v != VERSION) throw ProtocolException("unsupported version $v")
        val id = (o["id"] as? JsonPrimitive)?.takeIf { it.isString }?.content?.takeIf { it.isNotEmpty() }
            ?: throw ProtocolException("missing id")
        val type = (o["type"] as? JsonPrimitive)?.takeIf { it.isString }?.content?.takeIf { it.isNotEmpty() }
            ?: throw ProtocolException("missing type")
        val payload = o["payload"]?.takeUnless { it is JsonNull }
        return when (type) {
            "result" -> when ((o["ok"] as? JsonPrimitive)?.content) {
                "true" -> Result(id, true, payload, null)
                "false" -> {
                    val err = o["error"] as? JsonObject ?: throw ProtocolException("result without error")
                    val code = (err["code"] as? JsonPrimitive)?.content ?: throw ProtocolException("error without code")
                    val message = (err["message"] as? JsonPrimitive)?.content ?: ""
                    Result(id, false, null, BridgeException(ErrorCode.of(code), message))
                }
                else -> throw ProtocolException("result without ok")
            }
            "progress" -> {
                val p = payload as? JsonObject ?: throw ProtocolException("bad progress")
                val stage = (p["stage"] as? JsonPrimitive)?.content ?: throw ProtocolException("bad progress")
                val fraction = p["fraction"]?.takeUnless { it is JsonNull }?.jsonPrimitive?.doubleOrNull
                ProgressMsg(id, fraction, stage)
            }
            "cancel" -> Cancel(id)
            else -> Request(id, type, payload)
        }
    }

    fun request(id: String, type: String, payload: JsonElement?): String = buildJsonObject {
        put("v", VERSION); put("id", id); put("type", type); payload?.let { put("payload", it) }
    }.toString()

    fun ok(id: String, payload: JsonElement?): String = buildJsonObject {
        put("v", VERSION); put("id", id); put("type", "result"); put("ok", true); payload?.let { put("payload", it) }
    }.toString()

    fun fail(id: String, error: BridgeException): String = buildJsonObject {
        put("v", VERSION); put("id", id); put("type", "result"); put("ok", false)
        put("error", buildJsonObject { put("code", error.code.wire); put("message", error.message ?: "") })
    }.toString()

    fun progress(id: String, fraction: Double?, stage: String): String = buildJsonObject {
        put("v", VERSION); put("id", id); put("type", "progress")
        put("payload", buildJsonObject { put("fraction", fraction?.let(::JsonPrimitive) ?: JsonNull); put("stage", stage) })
    }.toString()

    fun cancel(id: String): String = buildJsonObject { put("v", VERSION); put("id", id); put("type", "cancel") }.toString()
}

enum class ErrorCode(val wire: String) {
    UNSUPPORTED("unsupported"), UNAVAILABLE("unavailable"), NETWORK("network"), REMOTE("remote"),
    INVALID("invalid"), CANCELLED("cancelled"), INTERNAL("internal");

    companion object {
        fun of(wire: String) = entries.firstOrNull { it.wire == wire } ?: INTERNAL
    }
}

class BridgeException(val code: ErrorCode, message: String) : Exception(message) {
    companion object {
        /** Erros tipados da camada de IA (§3) → código da ponte. */
        fun from(e: Throwable): BridgeException = when (e) {
            is BridgeException -> e
            is AiError.Unavailable -> BridgeException(ErrorCode.UNAVAILABLE, e.message ?: "unavailable")
            is AiError.ModelNotDownloaded -> BridgeException(ErrorCode.UNAVAILABLE, "modelo ${e.modelId} não baixado")
            is AiError.Network -> BridgeException(ErrorCode.NETWORK, e.cause?.message ?: "network")
            is AiError.Remote -> BridgeException(ErrorCode.REMOTE, "HTTP ${e.code}")
            is AiError.InvalidOutput -> BridgeException(ErrorCode.INVALID, e.message ?: "invalid")
            is AiError.Unsupported -> BridgeException(ErrorCode.UNSUPPORTED, e.message ?: "unsupported")
            is IllegalArgumentException -> BridgeException(ErrorCode.INVALID, e.message ?: "invalid")
            else -> BridgeException(ErrorCode.INTERNAL, e.message ?: e.javaClass.simpleName)
        }
    }
}

typealias ProgressFn = (fraction: Double?, stage: String) -> Unit
typealias BridgeHandler = suspend (payload: JsonElement?, progress: ProgressFn) -> JsonElement?

/**
 * Núcleo da ponte, independente do WebView: `send` entrega uma mensagem ao JS; `receive` é
 * chamado com cada mensagem do JS. Os handlers rodam em `scope` (a tela do editor).
 */
class EditorBridge(private val scope: CoroutineScope, private val send: (String) -> Unit) {
    private val seq = AtomicInteger()
    private val handlers = HashMap<String, BridgeHandler>()
    private val pending = HashMap<String, Pair<CompletableDeferred<JsonElement?>, ProgressFn?>>()
    /** Pedidos do JS em execução, para o `cancel`. */
    private val running = HashMap<String, Job>()
    var onProtocolError: (String) -> Unit = {}

    fun handle(type: String, handler: BridgeHandler) {
        handlers[type] = handler
    }

    /** Pede algo ao JS; lança BridgeException se o JS responder erro. */
    suspend fun request(type: String, payload: JsonElement? = null, onProgress: ProgressFn? = null): JsonElement? {
        val id = "kt-${seq.incrementAndGet()}"
        val deferred = CompletableDeferred<JsonElement?>()
        synchronized(pending) { pending[id] = deferred to onProgress }
        try {
            send(EditorProtocol.request(id, type, payload))
            return deferred.await()
        } finally {
            synchronized(pending) { pending.remove(id) }
        }
    }

    fun receive(raw: String) {
        val msg = try {
            EditorProtocol.parse(raw)
        } catch (e: EditorProtocol.ProtocolException) {
            onProtocolError(e.message ?: "protocol")
            return
        }
        when (msg) {
            is EditorProtocol.Result -> {
                val p = synchronized(pending) { pending.remove(msg.id) } ?: return
                if (msg.ok) p.first.complete(msg.payload) else p.first.completeExceptionally(msg.error!!)
            }
            is EditorProtocol.ProgressMsg -> synchronized(pending) { pending[msg.id] }?.second?.invoke(msg.fraction, msg.stage)
            is EditorProtocol.Request -> dispatch(msg)
            is EditorProtocol.Cancel -> synchronized(running) { running[msg.id] }?.cancel()
        }
    }

    private fun dispatch(req: EditorProtocol.Request) {
        val handler = handlers[req.type]
        if (handler == null) {
            send(EditorProtocol.fail(req.id, BridgeException(ErrorCode.UNSUPPORTED, "no handler for ${req.type}")))
            return
        }
        // LAZY: o job entra em `running` antes de começar; invokeOnCompletion tira o registro mesmo se nunca rodar
        val job = scope.launch(start = CoroutineStart.LAZY) {
            val reply = try {
                EditorProtocol.ok(req.id, handler(req.payload) { f, s -> send(EditorProtocol.progress(req.id, f, s)) })
            } catch (e: CancellationException) {
                send(EditorProtocol.fail(req.id, BridgeException(ErrorCode.CANCELLED, "cancelled")))
                throw e
            } catch (e: Throwable) {
                EditorProtocol.fail(req.id, BridgeException.from(e))
            }
            send(reply)
        }
        synchronized(running) { running[req.id] = job }
        job.invokeOnCompletion { synchronized(running) { running.remove(req.id) } }
        job.start()
    }
}

// ---- leitura dos payloads ----

fun JsonElement?.obj(): JsonObject = this as? JsonObject ?: throw BridgeException(ErrorCode.INVALID, "payload is not an object")

fun JsonObject.str(key: String): String =
    (this[key] as? JsonPrimitive)?.takeIf { it.isString }?.content ?: throw BridgeException(ErrorCode.INVALID, "missing $key")

fun JsonObject.strOrNull(key: String): String? = (this[key] as? JsonPrimitive)?.takeIf { it.isString }?.content

fun JsonObject.num(key: String): Double =
    (this[key] as? JsonPrimitive)?.let { runCatching { it.double }.getOrNull() } ?: throw BridgeException(ErrorCode.INVALID, "missing $key")
