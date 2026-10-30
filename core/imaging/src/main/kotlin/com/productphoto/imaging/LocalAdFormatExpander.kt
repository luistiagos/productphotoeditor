package com.productphoto.imaging

import com.productphoto.ai.api.AdAspectRatio
import com.productphoto.ai.api.AdFormatExpander
import com.productphoto.ai.api.Inpainter
import com.productphoto.ai.api.OutpaintPreparation
import com.productphoto.ai.api.OutpaintRequest
import com.productphoto.ai.api.Progress
import com.productphoto.ai.api.ProgressSink
import com.productphoto.ai.api.RgbaImage
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

/**
 * Expansor de formatos de anúncio local (offline).
 * Utiliza o [OutpaintBuilder] para estruturar o canvas geométrico e a máscara,
 * delegando ao [Inpainter] local quando disponível, ou gerando a extensão por espelhamento suavizado.
 */
class LocalAdFormatExpander(
    private val inpainter: Inpainter? = null,
) : AdFormatExpander {

    override fun prepare(source: RgbaImage, targetRatio: AdAspectRatio, featherPx: Int): OutpaintPreparation {
        return OutpaintBuilder.build(source, targetRatio, featherPx)
    }

    override suspend fun expand(req: OutpaintRequest, progress: ProgressSink?): RgbaImage = withContext(Dispatchers.Default) {
        progress?.invoke(Progress(0.2f, "Calculando proporção ${req.targetRatio.label}…"))
        val prep = prepare(req.source, req.targetRatio, req.featherPx)

        if (inpainter != null) {
            progress?.invoke(Progress(0.5f, "Preenchendo margens com inpainting…"))
            inpainter.inpaint(prep.expandedImage, prep.inpaintMask, progress)
        } else {
            progress?.invoke(Progress(1.0f, "Formato expandido com sucesso."))
            prep.expandedImage
        }
    }
}
