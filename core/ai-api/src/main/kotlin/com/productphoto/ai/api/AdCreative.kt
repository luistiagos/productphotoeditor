package com.productphoto.ai.api

import android.graphics.RectF

/**
 * Direção da iluminação para relighting e harmonização do produto no cenário.
 */
enum class LightDirection(val label: String, val promptModifier: String) {
    AMBIENT("Ambiente Suave", "soft diffused ambient studio lighting, even illumination"),
    LEFT("Luz da Esquerda", "dramatic cinematic key light from the left, soft fill light from the right"),
    RIGHT("Luz da Direita", "dramatic cinematic key light from the right, soft fill light from the left"),
    TOP("Luz Superior", "overhead studio spot lighting from above, subtle bottom reflections"),
    BACKLIGHT("Contraluz / Rim Light", "bright rim lighting on product edges, strong silhouette accent, backlit"),
}

/**
 * Pedido de relighting / harmonização de iluminação para imagem composta de produto.
 */
data class RelightRequest(
    val image: RgbaImage,
    val lightDir: LightDirection = LightDirection.AMBIENT,
    val prompt: String? = null,
    val strength: Float = 0.35f,
)

/**
 * Capability para harmonização e relighting de foto de produto.
 */
interface ProductRelighter {
    suspend fun relight(req: RelightRequest, progress: ProgressSink? = null): RgbaImage
}

/**
 * Proporção do criativo. Qualquer par serve (a tela passa o formato escolhido no seletor, §46 do HANDOFF);
 * as constantes são as proporções de sempre.
 */
data class AdAspectRatio(
    val label: String,
    val widthRatio: Int,
    val heightRatio: Int,
    val platformTarget: String,
) {
    init {
        require(widthRatio > 0 && heightRatio > 0) { "proporção $widthRatio:$heightRatio" }
    }

    companion object {
        val RATIO_1_1 = AdAspectRatio("1:1 Quadrado", 1, 1, "Feed Instagram / Facebook")
        val RATIO_9_16 = AdAspectRatio("9:16 Vertical", 9, 16, "Stories / Reels / TikTok")
        val RATIO_16_9 = AdAspectRatio("16:9 Horizontal", 16, 9, "Banners / YouTube / Display")
        val RATIO_4_5 = AdAspectRatio("4:5 Retrato", 4, 5, "Feed Vertical Instagram")
    }
}

/**
 * Estrutura preparada para Outpainting (expansão de imagem).
 * Contém a imagem com canvas estendido, a máscara indicando onde a IA deve gerar
 * e as coordenadas da Safe Zone (zona central original preservada).
 */
data class OutpaintPreparation(
    val expandedImage: RgbaImage,
    val inpaintMask: Mask,
    val safeZone: RectF,
    val targetWidth: Int,
    val targetHeight: Int,
)

/**
 * Pedido de expansão de formato para anúncios com outpainting.
 */
data class OutpaintRequest(
    val source: RgbaImage,
    val targetRatio: AdAspectRatio,
    val prompt: String? = null,
    val featherPx: Int = 16,
)

/**
 * Capability para expansão de imagem para formatos de anúncios.
 */
interface AdFormatExpander {
    /**
     * Prepara a geometria do canvas expandido, área segura e máscara de inpaint.
     */
    fun prepare(source: RgbaImage, targetRatio: AdAspectRatio, featherPx: Int = 16): OutpaintPreparation

    /**
     * Executa a expansão generativa completa para o formato de anúncio pedido.
     */
    suspend fun expand(req: OutpaintRequest, progress: ProgressSink? = null): RgbaImage
}
