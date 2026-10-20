package com.productphoto.ai.remotehttp.image

import com.productphoto.ai.api.AiError
import com.productphoto.ai.api.Control
import com.productphoto.ai.api.Progress
import com.productphoto.ai.api.ProgressSink
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.NonCancellable
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.add
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.floatOrNull
import kotlinx.serialization.json.put
import kotlinx.serialization.json.putJsonArray
import kotlinx.serialization.json.putJsonObject
import java.util.Base64

data class A1111Options(
    val sampler: String = "Euler a",
    val steps: Int = 18,
    val cfgScale: Float = 7f,
    /** Modelo e pré-processador do ControlNet por tipo; modelo null = sem suporte. */
    val cannyModel: String? = "control_v11p_sd15_canny [d14c016b]",
    val scribbleModel: String? = "control_v11p_sd15_scribble [d4ba51ff]",
    val cannyModule: String = "canny",
    val scribbleModule: String = "t2ia_sketch_pidi",
)

/**
 * AUTOMATIC1111 / Forge com `--api` (§19.2): `POST /sdapi/v1/txt2img|img2img` síncronos; progresso
 * lido de `/sdapi/v1/progress` em paralelo; cancelar chama `/sdapi/v1/interrupt`.
 * auth: "usuário:senha" do `--api-auth` (HTTP Basic) ou null.
 */
class A1111Backend(
    baseUrl: String,
    auth: () -> String?,
    private val options: A1111Options = A1111Options(),
    private val pollMs: Long = 1_000,
) : ImageBackend {
    private val http = Http(baseUrl, authHeader = { Http.basic(auth()) })

    override val invertsMask = true

    override suspend fun run(job: ImageJob, progress: ProgressSink?): List<ByteArray> {
        val body = requestBody(job, options) // Unsupported antes de ir à rede
        val path = if (job.init == null) "/sdapi/v1/txt2img" else "/sdapi/v1/img2img"
        val reply = try {
            withContext(Dispatchers.IO) {
                val poller = progress?.let { sink -> launch { pollProgress(sink) } }
                try {
                    http.json("POST", path, body)
                } finally {
                    poller?.cancel()
                }
            }
        } catch (e: CancellationException) {
            // o servidor continuaria gerando sozinho: interrompe (é global, mas só há um job por vez)
            withContext(NonCancellable) { runCatching { http.call("POST", "/sdapi/v1/interrupt", "{}".toByteArray(), readTimeoutMs = 5_000) } }
            throw e
        }
        return parseImages(reply, job.count)
    }

    private suspend fun pollProgress(sink: ProgressSink) {
        while (true) {
            delay(pollMs)
            val p = try {
                http.json("GET", "/sdapi/v1/progress?skip_current_image=true", readTimeoutMs = 10_000)
            } catch (e: AiError) {
                continue // progresso é só informativo
            }
            val fraction = (p["progress"] as? JsonPrimitive)?.floatOrNull?.coerceIn(0f, 1f)
            sink(Progress(fraction, "Gerando no servidor"))
        }
    }

    companion object {
        fun requestBody(job: ImageJob, o: A1111Options): JsonObject {
            val control = job.control?.let { c ->
                val (model, module) = when (c.kind) {
                    Control.Kind.CANNY -> o.cannyModel to o.cannyModule
                    Control.Kind.SCRIBBLE -> o.scribbleModel to o.scribbleModule
                }
                if (model.isNullOrBlank()) throw AiError.Unsupported("sem modelo de ControlNet para ${c.kind.name.lowercase()}")
                buildJsonObject {
                    put("enabled", true)
                    put("module", module)
                    put("model", model)
                    put("weight", c.weight)
                    put("image", b64(c.png))
                    put("resize_mode", "Crop and Resize")
                    put("control_mode", "Balanced")
                    put("pixel_perfect", true)
                    put("save_detected_map", false)
                }
            }
            return buildJsonObject {
                put("prompt", job.prompt)
                put("negative_prompt", job.negative.orEmpty())
                put("seed", job.seed ?: -1L)
                put("sampler_name", o.sampler)
                put("steps", job.steps ?: o.steps)
                put("cfg_scale", job.cfg ?: o.cfgScale)
                put("width", job.width)
                put("height", job.height)
                put("batch_size", job.count)
                put("n_iter", 1)
                put("send_images", true)
                put("save_images", false)
                job.init?.let { init ->
                    putJsonArray("init_images") { add(b64(init)) }
                    put("denoising_strength", job.strength ?: 0.75f)
                    put("resize_mode", 0)
                }
                job.mask?.let { mask ->
                    put("mask", b64(mask))
                    put("mask_blur", 4)
                    put("inpainting_fill", 1)
                    put("inpaint_full_res", false)
                    put("inpainting_mask_invert", if (job.maskInvert) 1 else 0)
                }
                if (control != null) {
                    putJsonObject("alwayson_scripts") {
                        putJsonObject("controlnet") { putJsonArray("args") { add(control) } }
                    }
                }
            }
        }

        /** `images` em base64; com ControlNet o mapa detectado pode vir no fim, por isso o corte em count. */
        fun parseImages(reply: JsonObject, count: Int): List<ByteArray> {
            val images = (reply["images"] as? JsonArray)?.mapNotNull { (it as? JsonPrimitive)?.contentOrNull }
            if (images.isNullOrEmpty()) throw AiError.InvalidOutput("resposta do A1111 sem images")
            return images.take(count).map {
                try {
                    Base64.getDecoder().decode(it.substringAfter("base64,"))
                } catch (e: IllegalArgumentException) {
                    throw AiError.InvalidOutput("imagem do A1111 não é base64")
                }
            }
        }

        private fun b64(bytes: ByteArray) = Base64.getEncoder().encodeToString(bytes)
    }
}
