package com.productphoto.ai.api

enum class ImageFeature { TXT2IMG, IMG2IMG, INPAINT, CONTROL_CANNY, CONTROL_SCRIBBLE }

/** Imagem-guia para o ControlNet: contorno (canny) ou rabisco (scribble). weight 0..2. */
data class Control(val kind: Kind, val image: RgbaImage, val weight: Float = 1f) {
    enum class Kind { CANNY, SCRIBBLE }
}

/**
 * Pedido de geração (§3). width/height são arredondados para múltiplo de 8 pelo provedor ([snapTo8]);
 * em img2img a imagem inicial é redimensionada para width×height. inpaintMask 255 = área a gerar;
 * maskInvert gera o resto (ex. "só o fundo" com a máscara do produto). Nulos = padrão do provedor.
 */
data class ImageRequest(
    val prompt: String,
    val negativePrompt: String? = null,
    val width: Int = 512,
    val height: Int = 512,
    val steps: Int? = null,
    val seed: Long? = null,
    val cfgScale: Float? = null,
    val init: RgbaImage? = null,
    val strength: Float? = null,
    val inpaintMask: Mask? = null,
    val maskInvert: Boolean = false,
    val control: Control? = null,
    val count: Int = 1,
) {
    init {
        require(count >= 1) { "count $count < 1" }
        require(inpaintMask == null || init != null) { "inpaintMask sem init" }
    }

    /** O que um provedor precisa saber fazer para atender este pedido. */
    fun featuresNeeded(): Set<ImageFeature> = buildSet {
        add(
            when {
                init == null -> ImageFeature.TXT2IMG
                inpaintMask != null -> ImageFeature.INPAINT
                else -> ImageFeature.IMG2IMG
            },
        )
        when (control?.kind) {
            Control.Kind.CANNY -> add(ImageFeature.CONTROL_CANNY)
            Control.Kind.SCRIBBLE -> add(ImageFeature.CONTROL_SCRIBBLE)
            null -> {}
        }
    }
}

/** Múltiplo de 8 mais próximo (o latente do SD tem 1/8 da resolução), no mínimo 8. */
fun snapTo8(px: Int): Int = ((px + 4) / 8 * 8).coerceAtLeast(8)

interface ImageGenerator {
    val supports: Set<ImageFeature>
    suspend fun generate(req: ImageRequest, progress: ProgressSink? = null): List<RgbaImage>
}

/**
 * Não sabe de antemão qual provedor vai atender: anuncia tudo, e cada provedor lança
 * [AiError.Unsupported] antes de ir à rede se faltar a feature (§19.5).
 */
class ChainedImageGenerator(val chain: FallbackChain<ImageGenerator>) : ImageGenerator {
    override val supports: Set<ImageFeature> = ImageFeature.entries.toSet()

    override suspend fun generate(req: ImageRequest, progress: ProgressSink?): List<RgbaImage> =
        chain.run { it.generate(req, progress) }
}
