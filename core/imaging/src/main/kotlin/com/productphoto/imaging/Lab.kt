package com.productphoto.imaging

import kotlin.math.cbrt
import kotlin.math.pow

/** sRGB (0..255) ↔ CIE Lab (D65). */
internal object Lab {
    private val toLinear = FloatArray(256) { i ->
        val c = i / 255f
        if (c <= 0.04045f) c / 12.92f else ((c + 0.055f) / 1.055f).pow(2.4f)
    }

    private const val XN = 0.95047f
    private const val ZN = 1.08883f

    private fun f(t: Float) = if (t > 0.008856f) cbrt(t) else 7.787f * t + 16f / 116f
    private fun fInv(t: Float) = if (t > 0.206893f) t * t * t else (t - 16f / 116f) / 7.787f
    private fun toSrgb(c: Float): Float {
        val v = if (c <= 0.0031308f) 12.92f * c else 1.055f * c.coerceAtLeast(0f).pow(1f / 2.4f) - 0.055f
        return v * 255f
    }

    /** out[0..2] = L, a, b */
    fun fromRgb(r: Int, g: Int, b: Int, out: FloatArray) {
        val rl = toLinear[r]; val gl = toLinear[g]; val bl = toLinear[b]
        val x = (0.4124f * rl + 0.3576f * gl + 0.1805f * bl) / XN
        val y = 0.2126f * rl + 0.7152f * gl + 0.0722f * bl
        val z = (0.0193f * rl + 0.1192f * gl + 0.9505f * bl) / ZN
        val fx = f(x); val fy = f(y); val fz = f(z)
        out[0] = 116f * fy - 16f
        out[1] = 500f * (fx - fy)
        out[2] = 200f * (fy - fz)
    }

    /** out[0..2] = r, g, b em 0..255 (float, sem clamp) */
    fun toRgb(l: Float, a: Float, b: Float, out: FloatArray) {
        val fy = (l + 16f) / 116f
        val x = fInv(fy + a / 500f) * XN
        val y = fInv(fy)
        val z = fInv(fy - b / 200f) * ZN
        val rl = 3.2406f * x - 1.5372f * y - 0.4986f * z
        val gl = -0.9689f * x + 1.8758f * y + 0.0415f * z
        val bl = 0.0557f * x - 0.2040f * y + 1.0570f * z
        out[0] = toSrgb(rl); out[1] = toSrgb(gl); out[2] = toSrgb(bl)
    }
}
