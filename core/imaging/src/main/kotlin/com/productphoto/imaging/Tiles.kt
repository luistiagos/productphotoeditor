package com.productphoto.imaging

import com.productphoto.ai.api.AiError
import kotlinx.coroutines.currentCoroutineContext
import kotlinx.coroutines.ensureActive
import kotlin.math.floor

/**
 * Entrada máxima do upscale: 1 MP = 1024² (saída ≤ 4 MP em ×2, ≤ 16 MP em ×4). O tempo cresce com a entrada: com a
 * sobreposição 24 do Real-ESRGAN, 1024² são 169 tiles ≈ 93 s no moto g86 (§20.6).
 */
const val UPSCALE_MAX_INPUT_PIXELS = 1024L * 1024L

/** Escala do modelo (Real-ESRGAN x4v3) e quanto o RGB sangra para dentro do transparente antes de rodar. */
const val MODEL_SCALE = 4
const val UPSCALE_BLEED = 8

/**
 * Ampliação ×2/×4 por um modelo ×4 de entrada fixa tile² (§20.4 itens 3–6). [run] recebe RGB em CHW 0..1 com 3·tile²
 * valores e devolve CHW 0..1 com 3·(4·tile)². Cada tile lê [overlap] px a mais de cada lado (bordas da imagem por
 * replicação, então o tile tem sempre tile²) e só o miolo vai para a saída. ×2 = média 2×2 da saída ×4 de cada tile.
 * Antes de rodar, o RGB sangra [UPSCALE_BLEED] px para dentro do transparente (senão vira halo escuro); o alfa é ampliado
 * por interpolação bilinear. [progress] recebe (tiles feitos, total); o cancelamento é conferido entre tiles.
 */
suspend fun upscaleTiled(
    src: Raster,
    factor: Int,
    tile: Int = 128,
    overlap: Int = 8,
    progress: ((Int, Int) -> Unit)? = null,
    run: suspend (FloatArray) -> FloatArray,
): Raster {
    if (factor != 2 && factor != 4) throw AiError.Unsupported("upscale: fator $factor (só 2 ou 4)")
    val w = src.width
    val h = src.height
    if (w.toLong() * h > UPSCALE_MAX_INPUT_PIXELS) {
        throw AiError.Unsupported("upscale: imagem de ${w}×$h passa de 1 MP (máximo 1024×1024)")
    }
    val core = tile - 2 * overlap
    require(core > 0) { "tile $tile pequeno demais para overlap $overlap" }
    val ow = w * factor
    val oh = h * factor
    val rgb = bleed(src, UPSCALE_BLEED)
    val out = IntArray(ow * oh)
    val nx = (w + core - 1) / core
    val ny = (h + core - 1) / core
    val plane = tile * tile
    val mt = tile * MODEL_SCALE
    val mp = mt * mt
    val input = FloatArray(3 * plane)
    var done = 0
    for (ty in 0 until ny) for (tx in 0 until nx) {
        currentCoroutineContext().ensureActive()
        val cx0 = tx * core
        val cy0 = ty * core
        for (y in 0 until tile) {
            val row = (cy0 - overlap + y).coerceIn(0, h - 1) * w
            for (x in 0 until tile) {
                val c = rgb[row + (cx0 - overlap + x).coerceIn(0, w - 1)]
                val p = y * tile + x
                input[p] = r8(c) / 255f
                input[plane + p] = g8(c) / 255f
                input[2 * plane + p] = b8(c) / 255f
            }
        }
        val y4 = run(input)
        if (y4.size != 3 * mp) throw AiError.InvalidOutput("upscale: saída do modelo com ${y4.size} valores, esperado ${3 * mp}")
        val cw = minOf(core, w - cx0) * factor
        val ch = minOf(core, h - cy0) * factor
        val off = overlap * factor
        for (y in 0 until ch) {
            val orow = (cy0 * factor + y) * ow + cx0 * factor
            val sy = off + y
            for (x in 0 until cw) {
                val sx = off + x
                out[orow + x] = if (factor == MODEL_SCALE) {
                    val q = sy * mt + sx
                    argb(0xFF, clamp8(y4[q] * 255f), clamp8(y4[mp + q] * 255f), clamp8(y4[2 * mp + q] * 255f))
                } else {
                    // ×2: média 2×2 do ×4 (sy/sx estão na escala ×2)
                    val q = 2 * sy * mt + 2 * sx
                    argb(0xFF, clamp8(mean4(y4, q, mt) * 255f), clamp8(mean4(y4, mp + q, mt) * 255f), clamp8(mean4(y4, 2 * mp + q, mt) * 255f))
                }
            }
        }
        progress?.invoke(++done, nx * ny)
    }
    if (src.argb.any { a8(it) != 0xFF }) scaleAlphaInto(src, out, ow, oh)
    return Raster(ow, oh, out)
}

private fun mean4(p: FloatArray, q: Int, stride: Int) = (p[q] + p[q + 1] + p[q + stride] + p[q + stride + 1]) * .25f

/** Alfa de [src] ampliado por bilinear (centros de pixel) para ow×oh, gravado no byte alto de [out]. */
private fun scaleAlphaInto(src: Raster, out: IntArray, ow: Int, oh: Int) {
    val w = src.width
    val h = src.height
    val xa = IntArray(ow)
    val xb = IntArray(ow)
    val ax = FloatArray(ow)
    for (x in 0 until ow) {
        val fx = (x + .5f) * w / ow - .5f
        val xf = floor(fx).toInt()
        ax[x] = fx - xf
        xa[x] = xf.coerceIn(0, w - 1)
        xb[x] = (xf + 1).coerceIn(0, w - 1)
    }
    for (y in 0 until oh) {
        val fy = (y + .5f) * h / oh - .5f
        val yf = floor(fy).toInt()
        val ay = fy - yf
        val ra = yf.coerceIn(0, h - 1) * w
        val rb = (yf + 1).coerceIn(0, h - 1) * w
        for (x in 0 until ow) {
            val top = a8(src.argb[ra + xa[x]]) * (1 - ax[x]) + a8(src.argb[ra + xb[x]]) * ax[x]
            val bottom = a8(src.argb[rb + xa[x]]) * (1 - ax[x]) + a8(src.argb[rb + xb[x]]) * ax[x]
            val i = y * ow + x
            out[i] = (out[i] and 0xFFFFFF) or (clamp8(top * (1 - ay) + bottom * ay) shl 24)
        }
    }
}

/**
 * Cópia de [src] em que os pixels de alfa 0 recebem a média de cor dos vizinhos (8-conexos) já coloridos, um anel por
 * passada, até [passes] anéis para dentro do transparente. O alfa não muda. Imagem sem alfa 0 volta como está.
 */
internal fun bleed(src: Raster, passes: Int): IntArray {
    val w = src.width
    val h = src.height
    val px = src.argb.copyOf()
    val known = BooleanArray(w * h) { a8(px[it]) > 0 }
    if (known.all { it }) return px
    val idx = IntArray(w * h)
    val col = IntArray(w * h)
    repeat(passes) {
        var n = 0
        for (y in 0 until h) for (x in 0 until w) {
            val i = y * w + x
            if (known[i]) continue
            var r = 0; var g = 0; var b = 0; var k = 0
            for (dy in -1..1) {
                val yy = y + dy
                if (yy < 0 || yy >= h) continue
                for (dx in -1..1) {
                    val xx = x + dx
                    if (xx < 0 || xx >= w) continue
                    val j = yy * w + xx
                    if (!known[j]) continue
                    r += r8(px[j]); g += g8(px[j]); b += b8(px[j]); k++
                }
            }
            if (k > 0) {
                idx[n] = i
                col[n] = argb(0, (r + k / 2) / k, (g + k / 2) / k, (b + k / 2) / k)
                n++
            }
        }
        if (n == 0) return px
        for (m in 0 until n) {
            px[idx[m]] = col[m]
            known[idx[m]] = true
        }
    }
    return px
}
