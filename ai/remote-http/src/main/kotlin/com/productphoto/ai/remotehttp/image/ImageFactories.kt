package com.productphoto.ai.remotehttp.image

import com.productphoto.ai.api.AiError
import com.productphoto.ai.api.Capability
import com.productphoto.ai.api.ImageFeature
import com.productphoto.ai.api.ImageGenerator
import com.productphoto.ai.api.ProviderContext
import com.productphoto.ai.api.ProviderFactory
import com.productphoto.ai.api.Requirement
import com.productphoto.ai.api.SettingField
import com.productphoto.ai.api.service
import com.productphoto.secrets.SecretStore
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.contentOrNull

/** Chave ausente → padrão; presente e vazia → null ("sem", ex. sem ControlNet). */
private fun JsonObject.opt(key: String, default: String?): String? {
    val v = this[key] as? JsonPrimitive ?: return default
    return v.contentOrNull?.takeIf { it.isNotBlank() }
}

private fun JsonObject.str(key: String) = opt(key, null)

/**
 * Sem URL não há servidor que sirva a todos (§19.5): a cadeia padrão vem ligada sem baseUrl e o
 * create lança Unavailable (a cadeia segue/termina como "indisponível"), não Unsupported.
 */
private fun JsonObject.baseUrl(key: String) = str(key) ?: throw AiError.Unavailable(emptyList())

class A1111ImageFactory(private val codec: ImageCodec = AndroidImageCodec) : ProviderFactory<ImageGenerator> {
    override val id = ID
    override val capability = Capability.IMAGE_GENERATOR
    override val displayName = "AUTOMATIC1111 / Forge"
    override val isLocal = false
    override val settingsSchema = listOf(
        SettingField(BASE_URL, "Endereço do servidor (iniciado com --api)", SettingField.Kind.URL, "http://192.168.0.10:7860"),
        SettingField(AUTH_SECRET, "Credencial --api-auth (usuário:senha)", SettingField.Kind.SECRET_NAME),
        SettingField(SAMPLER, "Sampler", SettingField.Kind.TEXT, DEFAULTS.sampler),
        SettingField(STEPS, "Passos", SettingField.Kind.NUMBER, DEFAULTS.steps.toString()),
        SettingField(CFG_SCALE, "CFG", SettingField.Kind.NUMBER, DEFAULTS.cfgScale.toString()),
        SettingField(CANNY_MODEL, "ControlNet de contorno", SettingField.Kind.TEXT, DEFAULTS.cannyModel),
        SettingField(SCRIBBLE_MODEL, "ControlNet de rabisco", SettingField.Kind.TEXT, DEFAULTS.scribbleModel),
        SettingField(CANNY_MODULE, "Pré-processador de contorno", SettingField.Kind.TEXT, DEFAULTS.cannyModule),
        SettingField(SCRIBBLE_MODULE, "Pré-processador de rabisco", SettingField.Kind.TEXT, DEFAULTS.scribbleModule),
    )

    override fun requirements(settings: JsonObject): List<Requirement> =
        listOfNotNull(Requirement.Network, settings.str(AUTH_SECRET)?.let { Requirement.Secret(it) })

    override fun create(settings: JsonObject, ctx: ProviderContext): ImageGenerator {
        val url = settings.baseUrl(BASE_URL)
        val options = options(settings)
        val secretName = settings.str(AUTH_SECRET)
        val secrets = ctx.service<SecretStore>()
        val backend = A1111Backend(url, auth = { secretName?.let { secrets?.get(it) } }, options = options)
        return RemoteImageGenerator(backend, supports(options), codec)
    }

    companion object {
        const val ID = "http.a1111"
        const val BASE_URL = "baseUrl"
        const val AUTH_SECRET = "authSecret"
        const val SAMPLER = "sampler"
        const val STEPS = "steps"
        const val CFG_SCALE = "cfgScale"
        const val CANNY_MODEL = "cannyModel"
        const val SCRIBBLE_MODEL = "scribbleModel"
        const val CANNY_MODULE = "cannyModule"
        const val SCRIBBLE_MODULE = "scribbleModule"
        private val DEFAULTS = A1111Options()

        fun options(s: JsonObject) = A1111Options(
            sampler = s.opt(SAMPLER, DEFAULTS.sampler) ?: DEFAULTS.sampler,
            steps = s.str(STEPS)?.toIntOrNull() ?: DEFAULTS.steps,
            cfgScale = s.str(CFG_SCALE)?.toFloatOrNull() ?: DEFAULTS.cfgScale,
            cannyModel = s.opt(CANNY_MODEL, DEFAULTS.cannyModel),
            scribbleModel = s.opt(SCRIBBLE_MODEL, DEFAULTS.scribbleModel),
            cannyModule = s.opt(CANNY_MODULE, DEFAULTS.cannyModule) ?: DEFAULTS.cannyModule,
            scribbleModule = s.opt(SCRIBBLE_MODULE, DEFAULTS.scribbleModule) ?: DEFAULTS.scribbleModule,
        )

        fun supports(o: A1111Options): Set<ImageFeature> = buildSet {
            add(ImageFeature.TXT2IMG); add(ImageFeature.IMG2IMG); add(ImageFeature.INPAINT)
            if (!o.cannyModel.isNullOrBlank()) add(ImageFeature.CONTROL_CANNY)
            if (!o.scribbleModel.isNullOrBlank()) add(ImageFeature.CONTROL_SCRIBBLE)
        }
    }
}

class ComfyUiImageFactory(private val codec: ImageCodec = AndroidImageCodec) : ProviderFactory<ImageGenerator> {
    override val id = ID
    override val capability = Capability.IMAGE_GENERATOR
    override val displayName = "ComfyUI"
    override val isLocal = false
    override val settingsSchema = listOf(
        SettingField(BASE_URL, "Endereço do servidor", SettingField.Kind.URL, "http://192.168.0.10:8188"),
        SettingField(API_KEY_SECRET, "Chave (proxy com Bearer)", SettingField.Kind.SECRET_NAME),
        SettingField(CHECKPOINT, "Checkpoint (arquivo)", SettingField.Kind.TEXT),
        SettingField(SAMPLER, "Sampler", SettingField.Kind.TEXT, DEFAULTS.sampler),
        SettingField(SCHEDULER, "Scheduler", SettingField.Kind.TEXT, DEFAULTS.scheduler),
        SettingField(STEPS, "Passos", SettingField.Kind.NUMBER, DEFAULTS.steps.toString()),
        SettingField(CFG_SCALE, "CFG", SettingField.Kind.NUMBER, DEFAULTS.cfgScale.toString()),
        SettingField(CANNY_CONTROLNET, "ControlNet de contorno (arquivo)", SettingField.Kind.TEXT),
        SettingField(SCRIBBLE_CONTROLNET, "ControlNet de rabisco (arquivo)", SettingField.Kind.TEXT),
        SettingField(WORKFLOW, "Fluxo próprio (JSON formato API, com marcadores)", SettingField.Kind.TEXT),
    )

    override fun requirements(settings: JsonObject): List<Requirement> =
        listOfNotNull(Requirement.Network, settings.str(API_KEY_SECRET)?.let { Requirement.Secret(it) })

    override fun create(settings: JsonObject, ctx: ProviderContext): ImageGenerator {
        val url = settings.baseUrl(BASE_URL)
        val options = options(settings)
        val workflow = settings.str(WORKFLOW)?.let { ComfyWorkflow.parseUser(it) }
        if (workflow == null && options.checkpoint == null) throw AiError.Unsupported("ComfyUI: informe o checkpoint")
        val supports = workflow?.let { ComfyWorkflow.userSupports(it) } ?: ComfyWorkflow.builtInSupports(options)
        val secretName = settings.str(API_KEY_SECRET)
        val secrets = ctx.service<SecretStore>()
        val backend = ComfyBackend(url, apiKey = { secretName?.let { secrets?.get(it) } }, options = options, workflow = workflow)
        return RemoteImageGenerator(backend, supports, codec)
    }

    companion object {
        const val ID = "http.comfyui"
        const val BASE_URL = "baseUrl"
        const val API_KEY_SECRET = "apiKeySecret"
        const val CHECKPOINT = "checkpoint"
        const val SAMPLER = "sampler"
        const val SCHEDULER = "scheduler"
        const val STEPS = "steps"
        const val CFG_SCALE = "cfgScale"
        const val CANNY_CONTROLNET = "cannyControlNet"
        const val SCRIBBLE_CONTROLNET = "scribbleControlNet"
        const val WORKFLOW = "workflow"
        private val DEFAULTS = ComfyOptions()

        fun options(s: JsonObject) = ComfyOptions(
            checkpoint = s.str(CHECKPOINT),
            sampler = s.str(SAMPLER) ?: DEFAULTS.sampler,
            scheduler = s.str(SCHEDULER) ?: DEFAULTS.scheduler,
            steps = s.str(STEPS)?.toIntOrNull() ?: DEFAULTS.steps,
            cfgScale = s.str(CFG_SCALE)?.toFloatOrNull() ?: DEFAULTS.cfgScale,
            cannyControlNet = s.str(CANNY_CONTROLNET),
            scribbleControlNet = s.str(SCRIBBLE_CONTROLNET),
        )
    }
}
