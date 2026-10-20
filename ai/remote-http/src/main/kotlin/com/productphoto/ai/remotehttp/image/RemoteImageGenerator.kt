package com.productphoto.ai.remotehttp.image

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import com.productphoto.ai.api.AiError
import com.productphoto.ai.api.ImageFeature
import com.productphoto.ai.api.ImageGenerator
import com.productphoto.ai.api.ImageRequest
import com.productphoto.ai.api.Mask
import com.productphoto.ai.api.ProgressSink
import com.productphoto.ai.api.RgbaImage
import com.productphoto.ai.api.snapTo8
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.ByteArrayOutputStream

/** Bitmap ↔ bytes. Separado para que o resto do caminho rode em teste JVM, sem Bitmap (§19.1). */
interface ImageCodec {
    /** PNG redimensionado para width×height. */
    fun encode(image: RgbaImage, width: Int, height: Int): ByteArray

    /** PNG opaco em tons de cinza (alfa 255 → branco), redimensionado. */
    fun encodeMask(mask: Mask, width: Int, height: Int): ByteArray

    /** null = bytes ilegíveis. */
    fun decode(bytes: ByteArray): RgbaImage?
}

object AndroidImageCodec : ImageCodec {
    override fun encode(image: RgbaImage, width: Int, height: Int): ByteArray = png(image.bitmap, width, height)

    override fun encodeMask(mask: Mask, width: Int, height: Int): ByteArray {
        val pixels = IntArray(mask.alpha.size) {
            val g = mask.alpha[it].toInt() and 0xff
            (0xff shl 24) or (g shl 16) or (g shl 8) or g
        }
        val gray = Bitmap.createBitmap(pixels, mask.width, mask.height, Bitmap.Config.ARGB_8888)
        return png(gray, width, height).also { gray.recycle() }
    }

    override fun decode(bytes: ByteArray): RgbaImage? {
        val bmp = BitmapFactory.decodeByteArray(bytes, 0, bytes.size) ?: return null
        if (bmp.config == Bitmap.Config.ARGB_8888) return RgbaImage(bmp)
        return RgbaImage(bmp.copy(Bitmap.Config.ARGB_8888, false).also { bmp.recycle() })
    }

    private fun png(src: Bitmap, width: Int, height: Int): ByteArray {
        val scaled = if (src.width == width && src.height == height) src else Bitmap.createScaledBitmap(src, width, height, true)
        return ByteArrayOutputStream().also { scaled.compress(Bitmap.CompressFormat.PNG, 100, it) }.toByteArray()
            .also { if (scaled !== src) scaled.recycle() }
    }
}

/**
 * [ImageGenerator] sobre um [ImageBackend] HTTP (§19.5): confere as features antes da rede, ajusta o
 * tamanho a múltiplo de 8, codifica as imagens e decodifica o resultado.
 */
class RemoteImageGenerator(
    private val backend: ImageBackend,
    override val supports: Set<ImageFeature>,
    private val codec: ImageCodec = AndroidImageCodec,
) : ImageGenerator {
    override suspend fun generate(req: ImageRequest, progress: ProgressSink?): List<RgbaImage> {
        val missing = req.featuresNeeded() - supports
        if (missing.isNotEmpty()) throw AiError.Unsupported("este servidor não faz: " + missing.joinToString { label(it) })
        val w = snapTo8(req.width)
        val h = snapTo8(req.height)
        val job = withContext(Dispatchers.Default) {
            val invertHere = req.maskInvert && !backend.invertsMask
            ImageJob(
                prompt = req.prompt, negative = req.negativePrompt, width = w, height = h,
                steps = req.steps, seed = req.seed, cfg = req.cfgScale, count = req.count,
                init = req.init?.let { codec.encode(it, w, h) },
                strength = req.strength,
                mask = req.inpaintMask?.let { codec.encodeMask(if (invertHere) it.inverted() else it, w, h) },
                maskInvert = req.maskInvert && backend.invertsMask,
                control = req.control?.let { ControlJob(it.kind, codec.encode(it.image, w, h), it.weight) },
            )
        }
        val out = backend.run(job, progress)
        return withContext(Dispatchers.Default) {
            out.map { codec.decode(it) ?: throw AiError.InvalidOutput("o servidor devolveu uma imagem ilegível") }
        }
    }

    companion object {
        fun label(f: ImageFeature) = when (f) {
            ImageFeature.TXT2IMG -> "gerar por texto"
            ImageFeature.IMG2IMG -> "variação de imagem"
            ImageFeature.INPAINT -> "preencher área com máscara"
            ImageFeature.CONTROL_CANNY -> "referência por contorno"
            ImageFeature.CONTROL_SCRIBBLE -> "referência por rabisco"
        }

        fun Mask.inverted() = Mask(width, height, ByteArray(alpha.size) { (255 - (alpha[it].toInt() and 0xff)).toByte() })
    }
}
