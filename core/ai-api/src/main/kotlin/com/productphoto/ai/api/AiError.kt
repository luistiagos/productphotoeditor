package com.productphoto.ai.api

sealed class AiError(msg: String, cause: Throwable? = null) : Exception(msg, cause) {
    class Unavailable(val missing: List<Requirement>, cause: Throwable? = null) :
        AiError("provider unavailable: $missing", cause)
    class ModelNotDownloaded(val modelId: String) : AiError("model $modelId missing")
    class Network(cause: Throwable) : AiError("network", cause)
    class Remote(val code: Int, val body: String?) : AiError("remote $code")
    class InvalidOutput(detail: String) : AiError(detail)
    class Unsupported(detail: String) : AiError(detail)

    /** Erros que fazem a cadeia tentar o próximo provedor (§4.4). */
    val isFallbackable: Boolean
        get() = this is Unavailable || this is ModelNotDownloaded || this is Network
}
