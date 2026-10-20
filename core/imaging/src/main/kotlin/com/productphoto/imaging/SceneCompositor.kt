package com.productphoto.imaging

import kotlin.math.abs
import kotlin.math.ceil
import kotlin.math.cos
import kotlin.math.floor
import kotlin.math.max
import kotlin.math.min
import kotlin.math.sin
import kotlin.math.tan

/** Luz/chão do cenário em pixels do cenário (ver SceneMeta). */
data class LightParams(
    val lightDirDeg: Float,
    val elevationDeg: Float,
    val softness: Float,
    val colorTempK: Int,
)

/** Centro do recorte do produto em pixels do cenário; scale sobre os pixels do produto. */
data class PlacementPx(val cx: Float, val cy: Float, val scale: Float, val rotationDeg: Float)

data class CompositeParams(
    val contactShadow: Float,
    val castShadow: Float,
    val harmonize: Float,
    val lightWrap: Float,
)

/**
 * Composição determinística produto + cenário (ARQUITETURA §9, LocalSceneComposer):
 * sombra de contato, sombra projetada com blur variável, harmonização em Lab, light wrap e
 * borda suavizada. Kotlin puro: todo o trabalho acontece numa janela local em volta do produto e
 * da sombra, o resto do cenário é copiado sem alteração.
 */
object SceneCompositor {

    /** [mask] tem o tamanho de [product], valores 0..1. */
    fun compose(
        product: Raster,
        mask: FloatArray,
        scene: Raster,
        light: LightParams,
        placement: PlacementPx,
        opts: CompositeParams,
    ): Raster {
        require(mask.size == product.width * product.height) { "mask size mismatch" }
        val out = scene.copy()
        val crop = Roi.of(mask, product.width, product.height, 0.02f)
        if (crop.isEmpty || placement.scale <= 0f) return out

        // 1. recorte premultiplicado do produto (reduzido por área se a escala for pequena)
        var layer = Layer.fromProduct(product, mask, crop)
        var scale = placement.scale
        val k = floor(1f / scale).toInt()
        if (k >= 2) {
            layer = layer.downsample(k)
            scale *= k
        }
        layer.defringe()

        // 2. janela de trabalho: caixa transformada do produto + espaço para a sombra mais longa
        val theta = Math.toRadians(placement.rotationDeg.toDouble())
        val cosT = cos(theta).toFloat()
        val sinT = sin(theta).toFloat()
        val hw = layer.w / 2f
        val hh = layer.h / 2f
        var minX = Float.MAX_VALUE; var minY = Float.MAX_VALUE; var maxX = -Float.MAX_VALUE; var maxY = -Float.MAX_VALUE
        for ((u, v) in listOf(-hw to -hh, hw to -hh, -hw to hh, hw to hh)) {
            val x = placement.cx + (u * cosT - v * sinT) * scale
            val y = placement.cy + (u * sinT + v * cosT) * scale
            minX = min(minX, x); maxX = max(maxX, x); minY = min(minY, y); maxY = max(maxY, y)
        }
        val boxW = maxX - minX
        val boxH = maxY - minY
        val shadow = ShadowGeometry.of(light)
        val reach = max(boxW, boxH) * 0.12f * (0.5f + light.softness) * 3f + 4f
        val win = Roi(
            floor(minX + min(0f, shadow.dx * boxH) - reach).toInt(),
            floor(minY + min(0f, shadow.dy * boxH) - reach).toInt(),
            ceil(maxX + max(0f, shadow.dx * boxH) + reach).toInt(),
            ceil(maxY + max(0f, shadow.dy * boxH) + reach).toInt(),
        ).let { Roi(max(0, it.x0), max(0, it.y0), min(scene.width, it.x1), min(scene.height, it.y1)) }
        if (win.isEmpty) return out

        val w = win.width
        val h = win.height
        val n = w * h

        // 3. produto amostrado no espaço do cenário (coordenadas locais da janela)
        val la = FloatArray(n); val lr = FloatArray(n); val lg = FloatArray(n); val lb = FloatArray(n)
        val inv = 1f / scale
        for (y in 0 until h) {
            val py = win.y0 + y + 0.5f - placement.cy
            for (x in 0 until w) {
                val px = win.x0 + x + 0.5f - placement.cx
                val u = (px * cosT + py * sinT) * inv + hw
                val v = (-px * sinT + py * cosT) * inv + hh
                if (u < -1 || v < -1 || u > layer.w + 1 || v > layer.h + 1) continue
                val i = y * w + x
                la[i] = sampleBilinear(layer.a, layer.w, layer.h, u, v)
                if (la[i] > 0f) {
                    lr[i] = sampleBilinear(layer.r, layer.w, layer.h, u, v)
                    lg[i] = sampleBilinear(layer.g, layer.w, layer.h, u, v)
                    lb[i] = sampleBilinear(layer.b, layer.w, layer.h, u, v)
                }
            }
        }
        val obj = Roi.of(la, w, h, 0.02f)
        if (obj.isEmpty) return out

        // linha de base: última linha com cobertura forte
        var baseRow = obj.y1 - 1
        run {
            for (y in obj.y1 - 1 downTo obj.y0) {
                for (x in obj.x0 until obj.x1) if (la[y * w + x] > 0.5f) { baseRow = y; return@run }
            }
        }
        val baseY = baseRow + 1f
        val objW = obj.width.toFloat()
        val objH = max(1f, baseY - obj.y0)
        val full = Roi(0, 0, w, h)

        // planos do cenário original na janela
        val sr = FloatArray(n); val sg = FloatArray(n); val sb = FloatArray(n)
        for (y in 0 until h) for (x in 0 until w) {
            val c = scene.argb[(win.y0 + y) * scene.width + win.x0 + x]
            val i = y * w + x
            sr[i] = r8(c).toFloat(); sg[i] = g8(c).toFloat(); sb[i] = b8(c).toFloat()
        }

        // Linha de chão por coluna: o contorno inferior do produto. Num objeto em 3/4 (sapato) salto e
        // ponta tocam o chão em alturas diferentes da imagem; com uma base única a sombra do salto
        // sai descolada e o produto parece flutuar. Colunas cujo contorno fica muito acima da base
        // (alça de caneca, parte suspensa) não tocam o chão: herdam o chão da coluna válida vizinha.
        val ground = FloatArray(w) { baseY }
        val touches = BooleanArray(w)
        run {
            val lift = 0.3f * objH
            for (x in obj.x0 until obj.x1) {
                for (y in baseRow downTo obj.y0) if (la[y * w + x] > 0.5f) {
                    if (baseRow - y <= lift) { ground[x] = y + 1f; touches[x] = true }
                    break
                }
            }
            var last = -1
            for (x in obj.x0 until obj.x1) {
                if (touches[x]) {
                    if (last < 0) for (i in obj.x0 until x) ground[i] = ground[x]
                    else for (i in last + 1 until x) ground[i] = ground[last] + (ground[x] - ground[last]) * (i - last) / (x - last)
                    last = x
                }
            }
            if (last >= 0) for (i in last + 1 until obj.x1) ground[i] = ground[last]
            // suaviza o serrilhado do contorno (ex.: cravos da sola)
            val r = max(1, (0.01f * objW).toInt())
            val smooth = FloatArray(w) { x ->
                if (x < obj.x0 || x >= obj.x1) ground[x] else {
                    var sum = 0f; var cnt = 0
                    for (i in max(obj.x0, x - r)..min(obj.x1 - 1, x + r)) { sum += ground[i]; cnt++ }
                    sum / cnt
                }
            }
            smooth.copyInto(ground)
        }

        // 4. sombra de contato: faixa fina sob o contorno inferior, desfocada
        val contact = FloatArray(n)
        if (opts.contactShadow > 0f) {
            val up = max(1f, 0.02f * objH)
            val down = max(2f, 0.04f * objH)
            for (x in obj.x0 until obj.x1) {
                if (!touches[x]) continue
                val edge = ground[x]
                val y0 = max(0, floor(edge - up).toInt())
                val y1 = min(h - 1, ceil(edge + down).toInt())
                for (y in y0..y1) {
                    val d = y + 0.5f - edge
                    val p = if (d < 0) 1f + d / up else 1f - d / down
                    if (p > 0f) contact[y * w + x] = max(contact[y * w + x], p)
                }
            }
            val sigma = max(1.5f, 0.02f * objW * (0.5f + light.softness))
            val blurred = gaussianBlur(contact, w, h, sigma, full)
            for (i in 0 until n) contact[i] = min(1f, blurred[i] * 1.5f)
        }

        // 5. sombra projetada: cada ponto do produto, à altura hgt acima do chão da sua coluna, cai em
        //    (x + dx·hgt, chão + dy·hgt). Projeção direta (splat) + blur que cresce com a distância.
        val cast = FloatArray(n)
        if (opts.castShadow > 0f) {
            val sil = FloatArray(n)
            val dist = FloatArray(n) // altura normalizada (0 = junto ao chão) de quem projetou o pixel
            for (y in obj.y0 until obj.y1) for (x in obj.x0 until obj.x1) {
                val al = la[y * w + x]
                if (al <= 0.02f) continue
                val hgt = ground[x] - (y + 0.5f)
                if (hgt < 0f) continue
                val tx = (x + shadow.dx * hgt).toInt()
                val ty = floor(ground[x] + shadow.dy * hgt).toInt()
                if (tx < 0 || ty < 0 || tx >= w || ty >= h) continue
                val i = ty * w + tx
                if (al > sil[i]) { sil[i] = al; dist[i] = (hgt / objH).coerceIn(0f, 1f) }
            }
            val base = objW * (0.5f + light.softness)
            val sigmas = floatArrayOf(0.008f, 0.03f, 0.06f, 0.11f).map { max(1.5f, base * it) }
            val levels = sigmas.map { gaussianBlur(sil, w, h, it, full) }
            // campo de distância suave (média ponderada pela silhueta), para escolher o nível de blur
            val wd = gaussianBlur(FloatArray(n) { sil[it] * dist[it] }, w, h, sigmas[2], full)
            val ws = levels[2]
            for (i in 0 until n) {
                val tn = if (ws[i] > 1e-4f) (wd[i] / ws[i]).coerceIn(0f, 1f) else 1f
                val t = tn * 3f
                val lo = min(2, t.toInt())
                val f = t - lo
                val v = levels[lo][i] * (1 - f) + levels[lo + 1][i] * f
                cast[i] = v * (1f - 0.55f * tn)
            }
        }

        // aplica as sombras (multiplicação sobre o cenário)
        for (i in 0 until n) {
            val s = 1f - (1f - opts.contactShadow * contact[i]) * (1f - opts.castShadow * cast[i])
            if (s <= 0f) continue
            val m = 1f - 0.85f * s.coerceIn(0f, 1f)
            val x = i % w
            val y = i / w
            val idx = (win.y0 + y) * scene.width + win.x0 + x
            val c = out.argb[idx]
            out.argb[idx] = argb(a8(c), clamp8(r8(c) * m), clamp8(g8(c) * m), clamp8(b8(c) * m))
        }

        // cor do produto, não premultiplicada
        val cr = FloatArray(n); val cg = FloatArray(n); val cb = FloatArray(n)
        for (i in 0 until n) if (la[i] > 0.003f) {
            cr[i] = lr[i] / la[i]; cg[i] = lg[i] / la[i]; cb[i] = lb[i] / la[i]
        }

        // 6. harmonização de cor em Lab
        if (opts.harmonize > 0f) harmonize(la, cr, cg, cb, sr, sg, sb, w, h, obj, light.colorTempK, opts.harmonize)

        // 7. light wrap: bordas recebem o cenário desfocado
        if (opts.lightWrap > 0f) {
            val sigma = max(2f, 0.015f * max(objW, objH))
            val roi = obj.expand((sigma * 3).toInt() + 1, w, h)
            val br = gaussianBlur(sr, w, h, sigma, roi)
            val bg = gaussianBlur(sg, w, h, sigma, roi)
            val bb = gaussianBlur(sb, w, h, sigma, roi)
            val laBlur = gaussianBlur(la, w, h, sigma, roi)
            for (y in obj.y0 until obj.y1) for (x in obj.x0 until obj.x1) {
                val i = y * w + x
                if (la[i] <= 0.003f) continue
                val wrap = ((1f - laBlur[i]) * 2f).coerceIn(0f, 1f) * opts.lightWrap * 0.7f
                cr[i] += (br[i] - cr[i]) * wrap
                cg[i] += (bg[i] - cg[i]) * wrap
                cb[i] += (bb[i] - cb[i]) * wrap
            }
        }

        // 8. borda suavizada e composição final
        val alpha = gaussianBlur(la, w, h, 0.7f, obj.expand(3, w, h))
        for (y in 0 until h) for (x in 0 until w) {
            val i = y * w + x
            val a = if (la[i] > 0.003f) alpha[i].coerceIn(0f, 1f) else 0f
            if (a <= 0f) continue
            val idx = (win.y0 + y) * scene.width + win.x0 + x
            val c = out.argb[idx]
            out.argb[idx] = argb(
                a8(c),
                clamp8(r8(c) * (1 - a) + cr[i] * a),
                clamp8(g8(c) * (1 - a) + cg[i] * a),
                clamp8(b8(c) * (1 - a) + cb[i] * a),
            )
        }
        return out
    }

    private fun harmonize(
        la: FloatArray, cr: FloatArray, cg: FloatArray, cb: FloatArray,
        sr: FloatArray, sg: FloatArray, sb: FloatArray,
        w: Int, h: Int, obj: Roi, colorTempK: Int, weight: Float,
    ) {
        val lab = FloatArray(3)
        // estatísticas do cenário em volta do produto (fora da silhueta)
        val around = obj.expand((max(obj.width, obj.height) * 0.5f).toInt(), w, h)
        val sStats = LabStats()
        for (y in around.y0 until around.y1 step 2) for (x in around.x0 until around.x1 step 2) {
            val i = y * w + x
            if (la[i] > 0.05f) continue
            Lab.fromRgb(sr[i].toInt(), sg[i].toInt(), sb[i].toInt(), lab)
            sStats.add(lab, 1f)
        }
        val pStats = LabStats()
        for (y in obj.y0 until obj.y1) for (x in obj.x0 until obj.x1) {
            val i = y * w + x
            if (la[i] <= 0.05f) continue
            Lab.fromRgb(clamp8(cr[i]), clamp8(cg[i]), clamp8(cb[i]), lab)
            pStats.add(lab, la[i])
        }
        if (sStats.weight <= 0f || pStats.weight <= 0f) return

        val kL = 1f + ((sStats.stdL / max(1f, pStats.stdL)).coerceIn(0.8f, 1.25f) - 1f) * weight * 0.3f
        val shiftL = ((sStats.meanL - pStats.meanL) * weight * 0.25f).coerceIn(-12f, 12f)
        // tom do cenário (desvio do neutro) + temperatura de cor declarada no SceneMeta
        val warm = (6500 - colorTempK) / 1000f
        val shiftA = (sStats.meanA * weight * 0.25f + warm * weight * 0.6f).coerceIn(-6f, 6f)
        val shiftB = (sStats.meanB * weight * 0.25f + warm * weight * 2.2f).coerceIn(-8f, 8f)
        val rgb = FloatArray(3)
        for (y in obj.y0 until obj.y1) for (x in obj.x0 until obj.x1) {
            val i = y * w + x
            if (la[i] <= 0.003f) continue
            Lab.fromRgb(clamp8(cr[i]), clamp8(cg[i]), clamp8(cb[i]), lab)
            val l = (lab[0] - pStats.meanL) * kL + pStats.meanL + shiftL
            Lab.toRgb(l.coerceIn(0f, 100f), lab[1] + shiftA, lab[2] + shiftB, rgb)
            cr[i] = rgb[0]; cg[i] = rgb[1]; cb[i] = rgb[2]
        }
    }

    private class LabStats {
        var weight = 0f
        private var sL = 0.0; private var sA = 0.0; private var sB = 0.0; private var sLL = 0.0
        fun add(lab: FloatArray, wt: Float) {
            weight += wt
            sL += lab[0] * wt; sA += lab[1] * wt; sB += lab[2] * wt; sLL += lab[0] * lab[0] * wt
        }
        val meanL get() = (sL / weight).toFloat()
        val meanA get() = (sA / weight).toFloat()
        val meanB get() = (sB / weight).toFloat()
        val stdL get() = kotlin.math.sqrt(max(0.0, sLL / weight - (sL / weight) * (sL / weight))).toFloat()
    }

    /** Recorte do produto em planos premultiplicados. */
    private class Layer(val w: Int, val h: Int, val r: FloatArray, val g: FloatArray, val b: FloatArray, val a: FloatArray) {
        fun downsample(k: Int): Layer {
            val nw = max(1, w / k)
            val nh = max(1, h / k)
            fun reduce(p: FloatArray) = FloatArray(nw * nh) { j ->
                val x0 = (j % nw) * k
                val y0 = (j / nw) * k
                var s = 0f
                for (yy in y0 until min(h, y0 + k)) for (xx in x0 until min(w, x0 + k)) s += p[yy * w + xx]
                s / (k * k)
            }
            return Layer(nw, nh, reduce(r), reduce(g), reduce(b), reduce(a))
        }

        /**
         * Descontamina a borda: pixels semitransparentes carregam a cor do fundo antigo (halo).
         * A cor deles é trocada pela média das cores do interior vizinho (peso alfa^4).
         */
        fun defringe() {
            val n = w * h
            val sigma = max(1.5f, 0.004f * max(w, h))
            val wt = FloatArray(n) { val al = a[it]; al * al * al * al }
            fun spread(p: FloatArray) = gaussianBlur(FloatArray(n) { if (a[it] > 0f) p[it] / a[it] * wt[it] else 0f }, w, h, sigma)
            val br = spread(r); val bg = spread(g); val bb = spread(b)
            val bw = gaussianBlur(wt, w, h, sigma)
            for (i in 0 until n) {
                val al = a[i]
                if (al <= 0f || al >= 0.97f || bw[i] < 1e-3f) continue
                r[i] = br[i] / bw[i] * al; g[i] = bg[i] / bw[i] * al; b[i] = bb[i] / bw[i] * al
            }
        }

        companion object {
            fun fromProduct(p: Raster, mask: FloatArray, roi: Roi): Layer {
                val n = roi.width * roi.height
                val r = FloatArray(n); val g = FloatArray(n); val b = FloatArray(n); val a = FloatArray(n)
                for (y in 0 until roi.height) for (x in 0 until roi.width) {
                    val src = (roi.y0 + y) * p.width + roi.x0 + x
                    val al = mask[src].coerceIn(0f, 1f)
                    val c = p.argb[src]
                    val i = y * roi.width + x
                    a[i] = al; r[i] = r8(c) * al; g[i] = g8(c) * al; b[i] = b8(c) * al
                }
                return Layer(roi.width, roi.height, r, g, b, a)
            }
        }
    }
}

/**
 * Vetor da sombra por unidade de altura acima da base, no plano da imagem.
 * A sombra cai no sentido oposto à luz; o chão é encurtado pela perspectiva (fator 0,5 no eixo y).
 */
internal data class ShadowGeometry(val dx: Float, val dy: Float) {
    companion object {
        fun of(light: LightParams): ShadowGeometry {
            val phi = Math.toRadians((light.lightDirDeg + 180f).toDouble())
            val elev = Math.toRadians(light.elevationDeg.coerceIn(5f, 85f).toDouble())
            val len = (1.0 / tan(elev)).toFloat().coerceIn(0.15f, 2.5f)
            val dx = cos(phi).toFloat() * len
            var dy = -sin(phi).toFloat() * len * 0.5f
            // luz lateral: a sombra fica um pouco atrás (sin(2π) dá ~1e-16, por isso o limiar e não == 0)
            if (abs(dy) < 0.08f) dy = if (dy > 1e-3f) 0.08f else -0.08f
            return ShadowGeometry(dx, dy)
        }
    }
}
