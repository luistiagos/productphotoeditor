package com.productphoto.imaging

import com.productphoto.ai.api.AiError
import com.productphoto.ai.api.MockupRenderer
import com.productphoto.ai.api.MockupTemplate
import com.productphoto.ai.api.RgbaImage
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlin.math.ceil
import kotlin.math.floor
import kotlin.math.max
import kotlin.math.min

/** Espaço de um template em px da base: quad TL,TR,BR,BL e máscara opcional (0..1, tamanho da base). */
class SlotPx(val quad: FloatArray, val mask: FloatArray? = null) {
    init {
        require(quad.size == 8)
    }
}

/**
 * Mockup de superfície plana (§20.4 item 9): cada design vai para o seu quad por homografia (mapeamento inverso e
 * amostragem bilinear), com antialias nas bordas (cobertura por 4×4 subamostras só nos pixels cortados pela borda).
 * Sombreamento = luminância da base na área do espaço ÷ o percentil 90 dela (base branca → 1); [shading] dosa o efeito.
 * Deslocamento = passa-alta dessa luminância desviando a amostra do design ([displacement] px por unidade; 0 = liso).
 */
object PerspectiveMockup {
    fun render(base: Raster, designs: List<Raster>, slots: List<SlotPx>, shading: Float = 1f, displacement: Float = 0f): Raster {
        if (designs.size != slots.size) throw AiError.Unsupported("mockup: ${designs.size} imagens para ${slots.size} espaços")
        val out = base.copy()
        designs.zip(slots).forEach { (d, s) -> drawSlot(base, out, d, s, shading, displacement) }
        return out
    }

    private fun drawSlot(base: Raster, out: Raster, design: Raster, slot: SlotPx, shading: Float, displacement: Float) {
        val q = slot.quad
        val w = base.width
        val inv = Homography.rectToQuad(design.width.toFloat(), design.height.toFloat(), q).inverse()
        val x0 = max(0, floor(minOf(q[0], q[2], q[4], q[6])).toInt())
        val y0 = max(0, floor(minOf(q[1], q[3], q[5], q[7])).toInt())
        val x1 = min(w, ceil(maxOf(q[0], q[2], q[4], q[6])).toInt())
        val y1 = min(base.height, ceil(maxOf(q[1], q[3], q[5], q[7])).toInt())
        if (x1 <= x0 || y1 <= y0) return
        val bw = x1 - x0
        val bh = y1 - y0
        val orient = orientation(q)

        // cobertura do quad (× máscara) e luminância da base na caixa
        val cover = FloatArray(bw * bh)
        val lum = FloatArray(bw * bh)
        for (y in y0 until y1) for (x in x0 until x1) {
            val i = (y - y0) * bw + (x - x0)
            var c = coverage(q, orient, x, y)
            slot.mask?.let { c *= it[y * w + x] }
            cover[i] = c
            val p = base.argb[y * w + x]
            lum[i] = (.299f * r8(p) + .587f * g8(p) + .114f * b8(p)) / 255f
        }
        val ref = percentile90(lum, cover)
        val hp = if (displacement != 0f) highPass(lum, bw, bh) else null

        for (y in y0 until y1) for (x in x0 until x1) {
            val i = (y - y0) * bw + (x - x0)
            val c = cover[i]
            if (c <= 0f) continue
            var px = x + .5
            var py = y + .5
            if (hp != null) {
                px += displacement * hp[i]
                py += displacement * hp[i]
            }
            val u = inv.mapX(px, py)
            val v = inv.mapY(px, py)
            val s = sample(design, u, v)
            val shade = 1f - shading * (1f - (if (ref > 0f) lum[i] / ref else 1f).coerceIn(0f, 1f))
            val a = c * (a8(s) / 255f)
            val o = out.argb[y * w + x]
            out.argb[y * w + x] = argb(
                a8(o),
                clamp8(r8(o) * (1 - a) + r8(s) * shade * a),
                clamp8(g8(o) * (1 - a) + g8(s) * shade * a),
                clamp8(b8(o) * (1 - a) + b8(s) * shade * a),
            )
        }
    }

    private fun orientation(q: FloatArray): Float {
        var area = 0f
        for (k in 0 until 4) {
            val n = (k + 1) % 4
            area += q[2 * k] * q[2 * n + 1] - q[2 * n] * q[2 * k + 1]
        }
        return if (area >= 0) 1f else -1f
    }

    /** Ponto dentro do quad convexo (lado certo das 4 arestas, conforme a orientação). */
    private fun inside(q: FloatArray, orient: Float, x: Float, y: Float): Boolean {
        for (k in 0 until 4) {
            val n = (k + 1) % 4
            val cross = (q[2 * n] - q[2 * k]) * (y - q[2 * k + 1]) - (q[2 * n + 1] - q[2 * k + 1]) * (x - q[2 * k])
            if (cross * orient < 0f) return false
        }
        return true
    }

    /** Fração do pixel (x, y) dentro do quad: 0/1 se os 4 cantos concordam e nenhum vértice cai no pixel, senão 4×4 amostras. */
    private fun coverage(q: FloatArray, orient: Float, x: Int, y: Int): Float {
        val fx = x.toFloat()
        val fy = y.toFloat()
        val c0 = inside(q, orient, fx, fy)
        val uniform = c0 == inside(q, orient, fx + 1, fy) && c0 == inside(q, orient, fx, fy + 1) &&
            c0 == inside(q, orient, fx + 1, fy + 1) &&
            (0 until 4).none { q[2 * it] > fx && q[2 * it] < fx + 1 && q[2 * it + 1] > fy && q[2 * it + 1] < fy + 1 }
        if (uniform) return if (c0) 1f else 0f
        var n = 0
        for (sy in 0 until 4) for (sx in 0 until 4) if (inside(q, orient, fx + (sx + .5f) / 4, fy + (sy + .5f) / 4)) n++
        return n / 16f
    }

    /** Bilinear em coordenadas contínuas do design (centros de pixel em +0,5), borda replicada. */
    private fun sample(d: Raster, u: Double, v: Double): Int {
        val fx = (u - .5).coerceIn(0.0, (d.width - 1).toDouble())
        val fy = (v - .5).coerceIn(0.0, (d.height - 1).toDouble())
        val xa = fx.toInt(); val ya = fy.toInt()
        val xb = min(xa + 1, d.width - 1); val yb = min(ya + 1, d.height - 1)
        val ax = (fx - xa).toFloat(); val ay = (fy - ya).toFloat()
        val p00 = d.argb[ya * d.width + xa]; val p10 = d.argb[ya * d.width + xb]
        val p01 = d.argb[yb * d.width + xa]; val p11 = d.argb[yb * d.width + xb]
        fun ch(f: (Int) -> Int): Int {
            val top = f(p00) * (1 - ax) + f(p10) * ax
            val bottom = f(p01) * (1 - ax) + f(p11) * ax
            return clamp8(top * (1 - ay) + bottom * ay)
        }
        return argb(ch(::a8), ch(::r8), ch(::g8), ch(::b8))
    }

    /** Percentil 90 da luminância nos pixels cobertos (≥ 50%); 1 se não houver nenhum. */
    private fun percentile90(lum: FloatArray, cover: FloatArray): Float {
        val vals = lum.filterIndexed { i, _ -> cover[i] >= .5f }.sorted()
        return if (vals.isEmpty()) 1f else vals[((vals.size - 1) * .9f).toInt()]
    }

    /** Luminância menos a média de uma janela 9×9 (relevo fino do papel/tecido). */
    private fun highPass(lum: FloatArray, w: Int, h: Int): FloatArray {
        val r = 4
        val blur = boxBlur(lum, w, h, r)
        return FloatArray(lum.size) { lum[it] - blur[it] }
    }

    private fun boxBlur(p: FloatArray, w: Int, h: Int, r: Int): FloatArray {
        val tmp = FloatArray(p.size)
        for (y in 0 until h) for (x in 0 until w) {
            var s = 0f
            for (k in -r..r) s += p[y * w + (x + k).coerceIn(0, w - 1)]
            tmp[y * w + x] = s / (2 * r + 1)
        }
        val out = FloatArray(p.size)
        for (y in 0 until h) for (x in 0 until w) {
            var s = 0f
            for (k in -r..r) s += tmp[(y + k).coerceIn(0, h - 1) * w + x]
            out[y * w + x] = s / (2 * r + 1)
        }
        return out
    }
}

/** Adaptador do contrato (§20.4 item 8): local e direto, como o [LocalSceneComposer]. */
class PerspectiveMockupRenderer : MockupRenderer {
    override suspend fun render(designs: List<RgbaImage>, template: MockupTemplate): RgbaImage = withContext(Dispatchers.Default) {
        if (designs.size != template.slots.size) {
            throw AiError.Unsupported("mockup: ${designs.size} imagens para ${template.slots.size} espaços")
        }
        val base = template.base.bitmap.toRaster()
        val slots = template.slots.map { s ->
            require(s.quad.size == 4) { "quad precisa de 4 cantos" }
            SlotPx(FloatArray(8) { i -> if (i % 2 == 0) s.quad[i / 2].x else s.quad[i / 2].y }, s.mask?.toPlane(base.width, base.height))
        }
        RgbaImage(PerspectiveMockup.render(base, designs.map { it.bitmap.toRaster() }, slots, template.shading, template.displacement).toBitmap())
    }
}
