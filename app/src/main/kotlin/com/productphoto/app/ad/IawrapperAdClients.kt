package com.productphoto.app.ad

import com.productphoto.ai.api.AdAspectRatio
import com.productphoto.ai.api.AdFormatExpander
import com.productphoto.ai.api.Inpainter
import com.productphoto.ai.api.OutpaintPreparation
import com.productphoto.ai.api.OutpaintRequest
import com.productphoto.ai.api.ProductRelighter
import com.productphoto.ai.api.ProgressSink
import com.productphoto.ai.api.RelightRequest
import com.productphoto.ai.api.RgbaImage
import com.productphoto.ai.remotehttp.image.AndroidImageCodec
import com.productphoto.ai.remotehttp.image.IawrapperBackend
import com.productphoto.ai.remotehttp.image.ImageCodec
import com.productphoto.imaging.LocalAdFormatExpander
import com.productphoto.imaging.LocalRelighter
import com.productphoto.imaging.OutpaintBuilder
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

/**
 * Harmonizador e Relighter remoto integrado ao cluster iawrapper/Vast.ai,
 * com fallback automático e transparente para o [LocalRelighter] quando offline.
 */
class IawrapperRelighter(
    private val backendProvider: suspend () -> IawrapperBackend?,
    private val codec: ImageCodec = AndroidImageCodec,
    private val fallback: ProductRelighter = LocalRelighter(),
) : ProductRelighter {

    override suspend fun relight(req: RelightRequest, progress: ProgressSink?): RgbaImage {
        val backend = backendProvider()
        if (backend == null) {
            return fallback.relight(req, progress)
        }
        return try {
            val pngBytes = withContext(Dispatchers.Default) {
                codec.encode(req.image, req.image.width, req.image.height)
            }
            val enhancedPrompt = buildString {
                append(req.lightDir.promptModifier)
                if (!req.prompt.isNullOrBlank()) {
                    append(", ").append(req.prompt)
                }
            }
            val outBytes = backend.relight(
                imageBytes = pngBytes,
                lightDirection = req.lightDir.name,
                prompt = enhancedPrompt,
                strength = req.strength,
                progress = progress,
            )
            withContext(Dispatchers.Default) {
                codec.decode(outBytes) ?: fallback.relight(req, progress)
            }
        } catch (_: Exception) {
            fallback.relight(req, progress)
        }
    }
}

/**
 * Expansor de formatos de anúncio (Outpainting) remoto integrado ao iawrapper,
 * com fallback automático para o [LocalAdFormatExpander] quando offline.
 */
class IawrapperAdFormatExpander(
    private val backendProvider: suspend () -> IawrapperBackend?,
    private val codec: ImageCodec = AndroidImageCodec,
    private val fallback: AdFormatExpander = LocalAdFormatExpander(),
) : AdFormatExpander {

    override fun prepare(source: RgbaImage, targetRatio: AdAspectRatio, featherPx: Int): OutpaintPreparation {
        return OutpaintBuilder.build(source, targetRatio, featherPx)
    }

    override suspend fun expand(req: OutpaintRequest, progress: ProgressSink?): RgbaImage {
        val prep = prepare(req.source, req.targetRatio, req.featherPx)
        val backend = backendProvider()
        if (backend == null) {
            return fallback.expand(req, progress)
        }
        return try {
            val initBytes = withContext(Dispatchers.Default) {
                codec.encode(prep.expandedImage, prep.targetWidth, prep.targetHeight)
            }
            val maskBytes = withContext(Dispatchers.Default) {
                codec.encodeMask(prep.inpaintMask, prep.targetWidth, prep.targetHeight)
            }
            val outBytes = backend.outpaint(
                expandedImageBytes = initBytes,
                maskBytes = maskBytes,
                prompt = req.prompt,
                width = prep.targetWidth,
                height = prep.targetHeight,
                progress = progress,
            )
            withContext(Dispatchers.Default) {
                codec.decode(outBytes) ?: fallback.expand(req, progress)
            }
        } catch (_: Exception) {
            fallback.expand(req, progress)
        }
    }
}
