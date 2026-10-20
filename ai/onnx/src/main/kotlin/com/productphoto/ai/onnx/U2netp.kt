package com.productphoto.ai.onnx

import com.productphoto.imaging.Raster
import com.productphoto.imaging.resizePlane

/**
 * Pré/pós-processamento do u2netp igual ao do rembg (ARQUITETURA §13.1):
 * RGB 320×320 dividido pelo máximo do array inteiro, (x-mean)/std, CHW; saída min-max.
 */
object U2netp {
    const val SIZE = 320
    const val INPUT = "input.1"

    /** [img] já redimensionada para 320×320. Devolve tensor [1,3,320,320] achatado (CHW). */
    fun preprocess(img: Raster): FloatArray = imagenetChw(img, SIZE)

    /** Saída [1,1,320,320] → plano 0..1 normalizado por min-max, no tamanho original. */
    fun postprocess(pred: FloatArray, width: Int, height: Int): FloatArray {
        require(pred.size == SIZE * SIZE) { "unexpected output size ${pred.size}" }
        var mi = Float.MAX_VALUE
        var ma = -Float.MAX_VALUE
        for (v in pred) { if (v < mi) mi = v; if (v > ma) ma = v }
        val range = ma - mi
        val norm = FloatArray(pred.size) { if (range > 1e-6f) (pred[it] - mi) / range else 0f }
        return resizePlane(norm, SIZE, SIZE, width, height)
    }

    /**
     * Endurece a borda: a saída de 320 px ampliada é macia e deixa o fundo antigo vazar como halo.
     * smoothstep(0,3 → 0,8) zera a franja fraca e mantém a transição suave no contorno.
     */
    fun refine(plane: FloatArray): FloatArray = FloatArray(plane.size) {
        val t = ((plane[it] - 0.3f) / 0.5f).coerceIn(0f, 1f)
        t * t * (3f - 2f * t)
    }
}

private val MEAN = floatArrayOf(0.485f, 0.456f, 0.406f)
private val STD = floatArrayOf(0.229f, 0.224f, 0.225f)

/** Normalização do rembg (`base.py::normalize`): divide pelo máximo do array inteiro, (x-mean)/std, CHW. */
internal fun imagenetChw(img: Raster, size: Int): FloatArray {
    require(img.width == size && img.height == size)
    val n = size * size
    var max = 0
    for (c in img.argb) max = maxOf(max, (c shr 16) and 0xFF, (c shr 8) and 0xFF, c and 0xFF)
    val div = maxOf(max.toFloat(), 1e-6f)
    val out = FloatArray(3 * n)
    for (i in 0 until n) {
        val c = img.argb[i]
        out[i] = (((c shr 16) and 0xFF) / div - MEAN[0]) / STD[0]
        out[n + i] = (((c shr 8) and 0xFF) / div - MEAN[1]) / STD[1]
        out[2 * n + i] = ((c and 0xFF) / div - MEAN[2]) / STD[2]
    }
    return out
}
