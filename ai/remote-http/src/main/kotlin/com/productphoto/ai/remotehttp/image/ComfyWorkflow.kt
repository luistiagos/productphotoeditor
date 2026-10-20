package com.productphoto.ai.remotehttp.image

import com.productphoto.ai.api.AiError
import com.productphoto.ai.api.Control
import com.productphoto.ai.api.ImageFeature
import kotlinx.serialization.SerializationException
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.add
import kotlinx.serialization.json.buildJsonArray
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import kotlinx.serialization.json.putJsonObject

data class ComfyOptions(
    /** Arquivo do checkpoint (ex. "sd_v1-5.safetensors"); obrigatório no grafo embutido. */
    val checkpoint: String? = null,
    val sampler: String = "euler_ancestral",
    val scheduler: String = "normal",
    val steps: Int = 18,
    val cfgScale: Float = 7f,
    /** Arquivo do ControlNet por tipo; null = sem suporte. */
    val cannyControlNet: String? = null,
    val scribbleControlNet: String? = null,
)

/** Nomes devolvidos pelo /upload/image, prontos para o LoadImage. */
data class UploadedImages(val init: String? = null, val mask: String? = null, val control: String? = null)

/** Grafos no formato API do ComfyUI (§19.2): embutido (SD1.5/SDXL de arquivo único) ou do usuário com marcadores. */
object ComfyWorkflow {
    const val CANNY_LOW = 0.4
    const val CANNY_HIGH = 0.8

    fun builtInSupports(o: ComfyOptions): Set<ImageFeature> = buildSet {
        add(ImageFeature.TXT2IMG); add(ImageFeature.IMG2IMG); add(ImageFeature.INPAINT)
        if (!o.cannyControlNet.isNullOrBlank()) add(ImageFeature.CONTROL_CANNY)
        if (!o.scribbleControlNet.isNullOrBlank()) add(ImageFeature.CONTROL_SCRIBBLE)
    }

    fun denoise(job: ImageJob): Float = if (job.init == null) 1f else job.strength ?: 0.75f

    /**
     * txt2img: EmptyLatentImage com batch; img2img: LoadImage → VAEEncode (batch 1; o backend repete);
     * inpaint: + LoadImageMask(canal red do PNG cinza) → SetLatentNoiseMask; controle: ControlNetApplyAdvanced
     * (canny passa pelo nó Canny; rabisco vai direto).
     */
    fun builtIn(job: ImageJob, names: UploadedImages, o: ComfyOptions, seed: Long, batch: Int): JsonObject {
        val ckpt = o.checkpoint?.takeIf { it.isNotBlank() } ?: throw AiError.Unsupported("ComfyUI sem checkpoint configurado")
        var positive = link("2", 0)
        var negative = link("3", 0)
        return buildJsonObject {
            node("1", "CheckpointLoaderSimple") { put("ckpt_name", ckpt) }
            node("2", "CLIPTextEncode") { put("text", job.prompt); put("clip", link("1", 1)) }
            node("3", "CLIPTextEncode") { put("text", job.negative.orEmpty()); put("clip", link("1", 1)) }
            val latent = if (job.init == null) {
                node("4", "EmptyLatentImage") { put("width", job.width); put("height", job.height); put("batch_size", batch) }
                link("4", 0)
            } else {
                node("10", "LoadImage") { put("image", names.init ?: error("init sem upload")) }
                node("11", "VAEEncode") { put("pixels", link("10", 0)); put("vae", link("1", 2)) }
                if (job.mask != null) {
                    node("12", "LoadImageMask") { put("image", names.mask ?: error("máscara sem upload")); put("channel", "red") }
                    node("13", "SetLatentNoiseMask") { put("samples", link("11", 0)); put("mask", link("12", 0)) }
                    link("13", 0)
                } else {
                    link("11", 0)
                }
            }
            job.control?.let { c ->
                val net = when (c.kind) {
                    Control.Kind.CANNY -> o.cannyControlNet
                    Control.Kind.SCRIBBLE -> o.scribbleControlNet
                }?.takeIf { it.isNotBlank() } ?: throw AiError.Unsupported("sem ControlNet para ${c.kind.name.lowercase()}")
                node("20", "LoadImage") { put("image", names.control ?: error("controle sem upload")) }
                val hint = if (c.kind == Control.Kind.CANNY) {
                    node("21", "Canny") { put("image", link("20", 0)); put("low_threshold", CANNY_LOW); put("high_threshold", CANNY_HIGH) }
                    link("21", 0)
                } else {
                    link("20", 0)
                }
                node("22", "ControlNetLoader") { put("control_net_name", net) }
                node("23", "ControlNetApplyAdvanced") {
                    put("positive", positive); put("negative", negative); put("control_net", link("22", 0))
                    put("image", hint); put("strength", c.weight); put("start_percent", 0.0); put("end_percent", 1.0)
                }
                positive = link("23", 0)
                negative = link("23", 1)
            }
            node("5", "KSampler") {
                put("model", link("1", 0)); put("seed", seed); put("steps", job.steps ?: o.steps); put("cfg", job.cfg ?: o.cfgScale)
                put("sampler_name", o.sampler); put("scheduler", o.scheduler)
                put("positive", positive); put("negative", negative); put("latent_image", latent); put("denoise", denoise(job))
            }
            node("6", "VAEDecode") { put("samples", link("5", 0)); put("vae", link("1", 2)) }
            node("7", "SaveImage") { put("images", link("6", 0)); put("filename_prefix", "productphoto") }
        }
    }

    // ---- fluxo do usuário ----

    const val PROMPT = "{{prompt}}"
    const val NEGATIVE = "{{negative}}"
    const val SEED = "{{seed}}"
    const val STEPS = "{{steps}}"
    const val CFG = "{{cfg}}"
    const val WIDTH = "{{width}}"
    const val HEIGHT = "{{height}}"
    const val COUNT = "{{count}}"
    const val DENOISE = "{{denoise}}"
    const val INIT_IMAGE = "{{init_image}}"
    const val MASK_IMAGE = "{{mask_image}}"
    const val CONTROL_IMAGE = "{{control_image}}"

    /** Fluxo exportado com "Export (API)": objeto id → {class_type, inputs}. */
    fun parseUser(text: String): JsonObject {
        val root = try {
            Json.parseToJsonElement(text) as? JsonObject
        } catch (e: SerializationException) {
            null
        }
        if (root == null || root.isEmpty() || root.values.any { (it as? JsonObject)?.get("class_type") == null }) {
            throw AiError.Unsupported("fluxo do ComfyUI inválido: use o formato API (Export (API))")
        }
        return root
    }

    /** TXT2IMG sempre; as demais conforme os marcadores de imagem presentes. */
    fun userSupports(graph: JsonObject): Set<ImageFeature> {
        val markers = strings(graph)
        return buildSet {
            add(ImageFeature.TXT2IMG)
            if (INIT_IMAGE in markers) add(ImageFeature.IMG2IMG)
            if (INIT_IMAGE in markers && MASK_IMAGE in markers) add(ImageFeature.INPAINT)
            if (CONTROL_IMAGE in markers) { add(ImageFeature.CONTROL_CANNY); add(ImageFeature.CONTROL_SCRIBBLE) }
        }
    }

    /** Troca os valores string iguais a um marcador; números viram número. Marcador de imagem sem imagem → Unsupported. */
    fun fillUser(graph: JsonObject, job: ImageJob, names: UploadedImages, o: ComfyOptions, seed: Long): JsonObject {
        val values: Map<String, JsonPrimitive?> = mapOf(
            PROMPT to JsonPrimitive(job.prompt),
            NEGATIVE to JsonPrimitive(job.negative.orEmpty()),
            SEED to JsonPrimitive(seed),
            STEPS to JsonPrimitive(job.steps ?: o.steps),
            CFG to JsonPrimitive(job.cfg ?: o.cfgScale),
            WIDTH to JsonPrimitive(job.width),
            HEIGHT to JsonPrimitive(job.height),
            COUNT to JsonPrimitive(job.count),
            DENOISE to JsonPrimitive(denoise(job)),
            INIT_IMAGE to names.init?.let(::JsonPrimitive),
            MASK_IMAGE to names.mask?.let(::JsonPrimitive),
            CONTROL_IMAGE to names.control?.let(::JsonPrimitive),
        )
        fun fill(e: JsonElement): JsonElement = when (e) {
            is JsonObject -> JsonObject(e.mapValues { fill(it.value) })
            is JsonArray -> JsonArray(e.map(::fill))
            is JsonPrimitive -> if (e.isString && e.content in values) {
                values[e.content] ?: throw AiError.Unsupported("o fluxo do ComfyUI pede ${e.content}, e o pedido não tem essa imagem")
            } else {
                e
            }
            else -> e
        }
        return fill(graph) as JsonObject
    }

    private fun strings(e: JsonElement): Set<String> = when (e) {
        is JsonObject -> e.values.flatMapTo(HashSet(), ::strings)
        is JsonArray -> e.flatMapTo(HashSet(), ::strings)
        is JsonPrimitive -> if (e.isString) setOf(e.content) else emptySet()
        else -> emptySet()
    }

    private fun link(node: String, output: Int) = buildJsonArray { add(node); add(output) }

    private fun kotlinx.serialization.json.JsonObjectBuilder.node(
        id: String, type: String, inputs: kotlinx.serialization.json.JsonObjectBuilder.() -> Unit,
    ) = putJsonObject(id) { put("class_type", type); putJsonObject("inputs", inputs) }
}
