package com.productphoto.ai.onnx

import com.productphoto.ai.api.Mask
import com.productphoto.imaging.Raster

/**
 * Entradas/saída do pipeline ONNX do MI-GAN (ARQUITETURA §14.1): `image` uint8 [1,3,H,W] RGB,
 * `mask` uint8 [1,1,H,W] binária com 255 = conhecido e 0 = buraco; `result` uint8 [1,3,H,W].
 * O grafo recorta, redimensiona, mistura e cola sozinho.
 */
object MiGan {
    const val INPUT_IMAGE = "image"
    const val INPUT_MASK = "mask"

    /** RGB em CHW, 1 byte por canal. */
    fun imageToChw(img: Raster): ByteArray {
        val n = img.width * img.height
        val out = ByteArray(3 * n)
        for (i in 0 until n) {
            val c = img.argb[i]
            out[i] = (c shr 16).toByte()
            out[n + i] = (c shr 8).toByte()
            out[2 * n + i] = c.toByte()
        }
        return out
    }

    /**
     * Nossa máscara (255 = preencher) → máscara do MI-GAN (255 = conhecido, 0 = buraco), binarizada
     * no meio da escala. Devolve null se não há buraco (o grafo não tem o que fazer).
     */
    fun knownMask(mask: Mask): ByteArray? {
        var holes = 0
        val out = ByteArray(mask.alpha.size) {
            if ((mask.alpha[it].toInt() and 0xFF) >= 128) { holes++; 0 } else 0xFF.toByte()
        }
        return if (holes == 0) null else out
    }

    /** CHW RGB de volta para ARGB, mantendo o alfa da imagem original. */
    fun chwToRaster(chw: ByteArray, original: Raster): Raster {
        val n = original.width * original.height
        require(chw.size == 3 * n) { "unexpected output size ${chw.size} != ${3 * n}" }
        val out = IntArray(n) {
            val a = original.argb[it] ushr 24
            (a shl 24) or ((chw[it].toInt() and 0xFF) shl 16) or
                ((chw[n + it].toInt() and 0xFF) shl 8) or (chw[2 * n + it].toInt() and 0xFF)
        }
        return Raster(original.width, original.height, out)
    }
}
