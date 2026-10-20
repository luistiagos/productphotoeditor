package com.productphoto.imaging

import android.graphics.RectF
import com.productphoto.ai.api.Inpainter
import com.productphoto.ai.api.Mask
import com.productphoto.ai.api.ProgressSink
import com.productphoto.ai.api.RgbaImage
import com.productphoto.ai.api.TextBlock
import com.productphoto.ai.api.TextDetector
import kotlin.math.ceil
import kotlin.math.floor
import kotlin.math.roundToInt

object TextMasks {
    /**
     * Máscara (255 = preencher) com cada caixa dilatada por uma margem proporcional à sua altura
     * (antialias e sombra do texto ficam fora da caixa do OCR), recortada nas bordas da imagem.
     */
    fun fromBoxes(boxes: List<Roi>, width: Int, height: Int, marginFraction: Float = 0.2f, minMargin: Int = 3): Mask {
        val alpha = ByteArray(width * height)
        for (box in boxes) {
            if (box.isEmpty) continue
            val m = maxOf(minMargin, (box.height * marginFraction).roundToInt())
            val r = box.expand(m, width, height)
            for (y in r.y0 until r.y1) alpha.fill(0xFF.toByte(), y * width + r.x0, y * width + r.x1)
        }
        return Mask(width, height, alpha)
    }
}

/**
 * "Remover texto" (§9): TextDetector → o usuário confirma as caixas → máscara dilatada → Inpainter.
 * Composição de capabilities, não um provedor (§14.3).
 */
class TextRemover(private val detector: TextDetector, private val inpainter: Inpainter) {

    suspend fun detect(image: RgbaImage): List<TextBlock> = detector.detect(image)

    /** Máscara das linhas dos blocos escolhidos (a caixa do bloco inteiro apagaria o fundo entre linhas). */
    fun mask(image: RgbaImage, blocks: List<TextBlock>): Mask =
        TextMasks.fromBoxes(blocks.flatMap { b -> b.lines.ifEmpty { listOf(b.box) } }.map { it.toRoi() }, image.width, image.height)

    suspend fun remove(image: RgbaImage, blocks: List<TextBlock>, progress: ProgressSink? = null): RgbaImage =
        if (blocks.isEmpty()) image else inpainter.inpaint(image, mask(image, blocks), progress)

    private fun RectF.toRoi() = Roi(floor(left).toInt(), floor(top).toInt(), ceil(right).toInt(), ceil(bottom).toInt())
}
