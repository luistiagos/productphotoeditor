package com.productphoto.ai.onnx

import com.productphoto.ai.api.AiError
import java.nio.ByteBuffer
import java.nio.ByteOrder
import java.nio.FloatBuffer

/**
 * Real-ESRGAN general-x4v3, variante float do pacote da Qualcomm (ARQUITETURA §20.6): `image` f32 [1,3,128,128] RGB 0..1
 * → `upscaled_image` f32 [1,3,512,512] 0..1. Os tiles, a sangria e o clamp ficam em `upscaleTiled` (:core:imaging).
 */
internal object RealEsrgan {
    const val INPUT = "image"
    const val TILE = 128
    /** 24 px: com 8, 16 e 20 a emenda difere da passada com 32/40 em até 22, 13 e 6/255; com 24, ≤ 1/255 (§20.6). */
    const val OVERLAP = 24
    val INPUT_SHAPE = longArrayOf(1, 3, TILE.toLong(), TILE.toLong())
    const val OUTPUT_SIZE = 3 * (4 * TILE) * (4 * TILE)

    fun input(chw: FloatArray): FloatBuffer {
        require(chw.size == 3 * TILE * TILE) { "tile com ${chw.size} valores" }
        return ByteBuffer.allocateDirect(4 * chw.size).order(ByteOrder.nativeOrder()).asFloatBuffer().put(chw).apply { rewind() }
    }

    /** Copia a saída do modelo; fora de 0..1 (e NaN) o clamp do `upscaleTiled` resolve. */
    fun output(buf: FloatBuffer): FloatArray {
        if (buf.remaining() != OUTPUT_SIZE) throw AiError.InvalidOutput("realesrgan: saída com ${buf.remaining()} valores, esperado $OUTPUT_SIZE")
        return FloatArray(OUTPUT_SIZE).also { buf.get(it) }
    }
}
