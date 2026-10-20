package com.productphoto.imaging

import kotlin.math.roundToInt
import kotlin.math.sqrt

/**
 * Blur aproximadamente gaussiano (3 passes de box blur) sobre um plano float, restrito à [roi].
 * Fora da roi o plano não muda; dentro, as bordas da roi são tratadas por repetição.
 */
fun gaussianBlur(src: FloatArray, w: Int, h: Int, sigma: Float, roi: Roi = Roi(0, 0, w, h)): FloatArray {
    val out = src.copyOf()
    if (sigma < 0.5f || roi.isEmpty) return out
    val tmp = FloatArray(src.size)
    for (r in boxRadii(sigma)) {
        boxH(out, tmp, w, roi, r)
        boxV(tmp, out, w, roi, r)
    }
    return out
}

/** Raios de 3 box blurs que aproximam um gaussiano de desvio sigma (Kovesi). */
internal fun boxRadii(sigma: Float): IntArray {
    val n = 3
    val wIdeal = sqrt(12f * sigma * sigma / n + 1)
    var wl = wIdeal.toInt()
    if (wl % 2 == 0) wl--
    val wu = wl + 2
    val m = ((12 * sigma * sigma - n * wl * wl - 4 * n * wl - 3 * n) / (-4 * wl - 4)).roundToInt()
    return IntArray(n) { i -> ((if (i < m) wl else wu) - 1) / 2 }.map { it.coerceAtLeast(0) }.toIntArray()
}

private fun boxH(src: FloatArray, dst: FloatArray, w: Int, roi: Roi, r: Int) {
    val last = roi.width - 1
    val norm = 1f / (2 * r + 1)
    for (y in roi.y0 until roi.y1) {
        val base = y * w + roi.x0
        var acc = 0f
        for (i in -r..r) acc += src[base + (if (i < 0) 0 else if (i > last) last else i)]
        for (i in 0..last) {
            dst[base + i] = acc * norm
            val add = i + r + 1
            val sub = i - r
            acc += src[base + (if (add > last) last else add)] - src[base + (if (sub < 0) 0 else sub)]
        }
    }
}

/** Passe vertical percorrendo linha a linha (acumulador por coluna), para não saltar na memória. */
private fun boxV(src: FloatArray, dst: FloatArray, w: Int, roi: Roi, r: Int) {
    val last = roi.height - 1
    val span = roi.width
    val norm = 1f / (2 * r + 1)
    val acc = FloatArray(span)
    for (i in -r..r) {
        val row = (roi.y0 + (if (i < 0) 0 else if (i > last) last else i)) * w + roi.x0
        for (x in 0 until span) acc[x] += src[row + x]
    }
    for (i in 0..last) {
        val out = (roi.y0 + i) * w + roi.x0
        val add = (roi.y0 + (if (i + r + 1 > last) last else i + r + 1)) * w + roi.x0
        val sub = (roi.y0 + (if (i - r < 0) 0 else i - r)) * w + roi.x0
        for (x in 0 until span) {
            dst[out + x] = acc[x] * norm
            acc[x] += src[add + x] - src[sub + x]
        }
    }
}

/** Amostragem bilinear de um plano float com borda zero. */
internal fun sampleBilinear(p: FloatArray, w: Int, h: Int, x: Float, y: Float): Float {
    val fx = x - 0.5f
    val fy = y - 0.5f
    val x0 = kotlin.math.floor(fx).toInt()
    val y0 = kotlin.math.floor(fy).toInt()
    val tx = fx - x0
    val ty = fy - y0
    fun v(xx: Int, yy: Int) = if (xx < 0 || yy < 0 || xx >= w || yy >= h) 0f else p[yy * w + xx]
    val top = v(x0, y0) * (1 - tx) + v(x0 + 1, y0) * tx
    val bot = v(x0, y0 + 1) * (1 - tx) + v(x0 + 1, y0 + 1) * tx
    return top * (1 - ty) + bot * ty
}

/** Redimensiona um plano float (bilinear, alinhado pelos centros de pixel). */
fun resizePlane(src: FloatArray, sw: Int, sh: Int, dw: Int, dh: Int): FloatArray {
    val out = FloatArray(dw * dh)
    val sx = sw.toFloat() / dw
    val sy = sh.toFloat() / dh
    for (y in 0 until dh) {
        val yy = ((y + 0.5f) * sy).coerceIn(0.5f, sh - 0.5f)
        for (x in 0 until dw) {
            val xx = ((x + 0.5f) * sx).coerceIn(0.5f, sw - 0.5f)
            out[y * dw + x] = sampleBilinear(src, sw, sh, xx, yy)
        }
    }
    return out
}
