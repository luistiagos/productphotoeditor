package com.productphoto.imaging

/** Imagem ARGB não premultiplicada em memória (mesmo formato de Bitmap.getPixels). */
class Raster(val width: Int, val height: Int, val argb: IntArray = IntArray(width * height)) {
    init {
        require(argb.size == width * height)
    }

    fun copy() = Raster(width, height, argb.copyOf())
}

/** Retângulo inteiro semiaberto [x0, x1) × [y0, y1). */
data class Roi(val x0: Int, val y0: Int, val x1: Int, val y1: Int) {
    val isEmpty get() = x1 <= x0 || y1 <= y0
    val width get() = x1 - x0
    val height get() = y1 - y0

    fun expand(by: Int, w: Int, h: Int) =
        Roi((x0 - by).coerceAtLeast(0), (y0 - by).coerceAtLeast(0), (x1 + by).coerceAtMost(w), (y1 + by).coerceAtMost(h))

    fun union(o: Roi) = when {
        isEmpty -> o
        o.isEmpty -> this
        else -> Roi(minOf(x0, o.x0), minOf(y0, o.y0), maxOf(x1, o.x1), maxOf(y1, o.y1))
    }

    companion object {
        val EMPTY = Roi(0, 0, 0, 0)

        /** Caixa dos pixels com valor > threshold. */
        fun of(values: FloatArray, w: Int, h: Int, threshold: Float = 0.004f): Roi {
            var x0 = w; var y0 = h; var x1 = -1; var y1 = -1
            for (y in 0 until h) {
                val row = y * w
                for (x in 0 until w) {
                    if (values[row + x] > threshold) {
                        if (x < x0) x0 = x
                        if (x > x1) x1 = x
                        if (y < y0) y0 = y
                        y1 = y
                    }
                }
            }
            return if (x1 < 0) EMPTY else Roi(x0, y0, x1 + 1, y1 + 1)
        }
    }
}

internal fun a8(c: Int) = c ushr 24
internal fun r8(c: Int) = (c shr 16) and 0xFF
internal fun g8(c: Int) = (c shr 8) and 0xFF
internal fun b8(c: Int) = c and 0xFF
internal fun argb(a: Int, r: Int, g: Int, b: Int) = (a shl 24) or (r shl 16) or (g shl 8) or b
internal fun clamp8(v: Float) = (v + 0.5f).toInt().coerceIn(0, 255)
