package com.productphoto.imaging

import kotlin.math.abs
import kotlin.math.max

/**
 * Homografia 3×3 com m[8] = 1: `x' = (m0·x + m1·y + m2) / (m6·x + m7·y + 1)`, `y' = (m3·x + m4·y + m5) / (…)`
 * (ARQUITETURA §20.4 item 9). Quads são `FloatArray(8)` = x,y dos cantos TL, TR, BR, BL.
 */
class Homography(private val m: DoubleArray) {
    init {
        require(m.size == 9)
    }

    fun mapX(x: Double, y: Double): Double = (m[0] * x + m[1] * y + m[2]) / (m[6] * x + m[7] * y + m[8])
    fun mapY(x: Double, y: Double): Double = (m[3] * x + m[4] * y + m[5]) / (m[6] * x + m[7] * y + m[8])

    /** Inversa pela adjunta; normalizada para m[8] = 1 quando possível. */
    fun inverse(): Homography {
        val (a, b, c, d, e) = listOf(m[0], m[1], m[2], m[3], m[4])
        val (f, g, h, i) = listOf(m[5], m[6], m[7], m[8])
        val inv = doubleArrayOf(
            e * i - f * h, c * h - b * i, b * f - c * e,
            f * g - d * i, a * i - c * g, c * d - a * f,
            d * h - e * g, b * g - a * h, a * e - b * d,
        )
        val det = a * inv[0] + b * inv[3] + c * inv[6]
        require(abs(det) > 1e-12) { "homografia singular" }
        val s = if (abs(inv[8]) > 1e-12) inv[8] else 1.0
        return Homography(DoubleArray(9) { inv[it] / s })
    }

    companion object {
        /** Retângulo 0..w × 0..h → quad. */
        fun rectToQuad(w: Float, h: Float, quad: FloatArray): Homography =
            fromQuads(floatArrayOf(0f, 0f, w, 0f, w, h, 0f, h), quad)

        /**
         * DLT de 4 correspondências (sistema 8×8, eliminação com pivô parcial). Quad de destino com 3 cantos colineares
         * (ou cantos repetidos) → [IllegalArgumentException].
         */
        fun fromQuads(src: FloatArray, dst: FloatArray): Homography {
            require(src.size == 8 && dst.size == 8) { "quad precisa de 4 cantos (8 valores)" }
            requireNonDegenerate(src, "origem")
            requireNonDegenerate(dst, "destino")
            val a = Array(8) { DoubleArray(9) }
            for (k in 0 until 4) {
                val x = src[2 * k].toDouble(); val y = src[2 * k + 1].toDouble()
                val u = dst[2 * k].toDouble(); val v = dst[2 * k + 1].toDouble()
                a[2 * k] = doubleArrayOf(x, y, 1.0, 0.0, 0.0, 0.0, -u * x, -u * y, u)
                a[2 * k + 1] = doubleArrayOf(0.0, 0.0, 0.0, x, y, 1.0, -v * x, -v * y, v)
            }
            for (col in 0 until 8) {
                val piv = (col until 8).maxBy { abs(a[it][col]) }
                require(abs(a[piv][col]) > 1e-12) { "quad degenerado" }
                val t = a[col]; a[col] = a[piv]; a[piv] = t
                for (r in 0 until 8) {
                    if (r == col) continue
                    val k = a[r][col] / a[col][col]
                    if (k != 0.0) for (c in col..8) a[r][c] -= k * a[col][c]
                }
            }
            return Homography(DoubleArray(9) { if (it == 8) 1.0 else a[it][8] / a[it][it] })
        }

        /** Nenhum trio de cantos colinear (área do triângulo pequena demais para a escala do quad). */
        private fun requireNonDegenerate(q: FloatArray, which: String) {
            var scale = 0.0
            for (k in 0 until 4) scale = max(scale, max(abs(q[2 * k].toDouble()), abs(q[2 * k + 1].toDouble())))
            val eps = 1e-6 * max(scale * scale, 1.0)
            for (skip in 0 until 4) {
                val idx = (0 until 4).filter { it != skip }
                val (p, r, s) = idx
                val cross = (q[2 * r] - q[2 * p]).toDouble() * (q[2 * s + 1] - q[2 * p + 1]) -
                    (q[2 * r + 1] - q[2 * p + 1]).toDouble() * (q[2 * s] - q[2 * p])
                require(abs(cross) > eps) { "quad de $which degenerado: 3 cantos colineares" }
            }
        }
    }
}

/** Quad convexo (cantos na ordem, sem cruzar): todos os produtos vetoriais das arestas com o mesmo sinal. */
fun isConvexQuad(q: FloatArray): Boolean {
    var sign = 0
    for (k in 0 until 4) {
        val a = k; val b = (k + 1) % 4; val c = (k + 2) % 4
        val cross = (q[2 * b] - q[2 * a]) * (q[2 * c + 1] - q[2 * b + 1]) - (q[2 * b + 1] - q[2 * a + 1]) * (q[2 * c] - q[2 * b])
        val s = if (cross > 0) 1 else if (cross < 0) -1 else 0
        if (s == 0) return false
        if (sign == 0) sign = s else if (s != sign) return false
    }
    return true
}
