package com.productphoto.feature.product

import kotlin.math.min

/** Encaixe "fit" de uma imagem iw×ih num canvas cw×ch. */
internal data class Fit(val scale: Float, val left: Float, val top: Float) {
    companion object {
        fun of(cw: Float, ch: Float, iw: Int, ih: Int): Fit {
            val s = min(cw / iw, ch / ih)
            return Fit(s, (cw - iw * s) / 2f, (ch - ih * s) / 2f)
        }
    }
}

/**
 * Zoom e pan do editor de máscara por cima do [Fit] (ARQUITETURA §16.4 task 2, §17.2).
 * tela = offset + zoom · p, com p = ponto no canvas sem zoom (fit.left + fit.scale · imagem).
 */
internal data class MaskViewport(val zoom: Float = 1f, val offsetX: Float = 0f, val offsetY: Float = 0f) {
    fun toImageX(sx: Float, fit: Fit) = ((sx - offsetX) / zoom - fit.left) / fit.scale
    fun toImageY(sy: Float, fit: Fit) = ((sy - offsetY) / zoom - fit.top) / fit.scale

    /** Raio do pincel em pixels da imagem: o pincel tem tamanho fixo na tela, então afina com o zoom. */
    fun brushRadius(brushPx: Float, fit: Fit) = brushPx / (fit.scale * zoom)

    /**
     * Um passo de pinça: o ponto que estava sob o centróide anterior (`centroid − pan`) vai para o centróide
     * atual, com o zoom multiplicado por [zoomChange] e limitado a [MIN_ZOOM]..[MAX_ZOOM].
     */
    fun transform(
        centroidX: Float, centroidY: Float, panX: Float, panY: Float, zoomChange: Float, width: Float, height: Float,
    ): MaskViewport {
        val z = (zoom * zoomChange).coerceIn(MIN_ZOOM, MAX_ZOOM)
        val px = (centroidX - panX - offsetX) / zoom
        val py = (centroidY - panY - offsetY) / zoom
        return MaskViewport(z, centroidX - z * px, centroidY - z * py).clamped(width, height)
    }

    /** Com zoom ≥ 1 o conteúdo sempre cobre o canvas: offset em [tamanho · (1 − zoom), 0]. */
    fun clamped(width: Float, height: Float) = copy(
        offsetX = offsetX.coerceIn(width * (1 - zoom), 0f),
        offsetY = offsetY.coerceIn(height * (1 - zoom), 0f),
    )

    companion object {
        const val MIN_ZOOM = 1f
        const val MAX_ZOOM = 8f
    }
}
