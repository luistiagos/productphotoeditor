package com.productphoto.feature.mockup

import kotlin.math.roundToInt

/** Retângulo inteiro em px da imagem. */
data class CropRect(val x: Int, val y: Int, val width: Int, val height: Int)

/** Maior retângulo centrado com largura/altura = [aspect] (§20.4 item 11, "corte central"). */
fun centerCrop(w: Int, h: Int, aspect: Float): CropRect {
    require(w > 0 && h > 0 && aspect > 0f)
    return if (w.toFloat() / h > aspect) {
        val cw = (h * aspect).roundToInt().coerceIn(1, w)
        CropRect((w - cw) / 2, 0, cw, h)
    } else {
        val ch = (w / aspect).roundToInt().coerceIn(1, h)
        CropRect(0, (h - ch) / 2, w, ch)
    }
}

/**
 * Estado do "Ajustar" (recorte com proporção travada): [zoom] 1..8 sobre o corte central e o centro do recorte em px da
 * imagem. Pinça/arrasto mexem na imagem atrás de uma moldura fixa; o recorte nunca sai da imagem.
 */
data class CropState(val zoom: Float, val cx: Float, val cy: Float) {
    fun rect(w: Int, h: Int, aspect: Float): CropRect {
        val base = centerCrop(w, h, aspect)
        val cw = (base.width / zoom).coerceAtLeast(1f)
        val ch = (base.height / zoom).coerceAtLeast(1f)
        val x = (cx - cw / 2).coerceIn(0f, w - cw)
        val y = (cy - ch / 2).coerceIn(0f, h - ch)
        return CropRect(x.roundToInt().coerceIn(0, w - 1), y.roundToInt().coerceIn(0, h - 1),
            cw.roundToInt().coerceIn(1, w), ch.roundToInt().coerceIn(1, h))
    }

    /**
     * Arrasto de [panX]/[panY] px de tela (a imagem segue o dedo, então o recorte anda ao contrário) e pinça [zoomBy];
     * [pxPerImagePx] = px de tela por px da imagem no zoom atual. O centro volta para dentro dos limites.
     */
    fun gesture(panX: Float, panY: Float, zoomBy: Float, pxPerImagePx: Float, w: Int, h: Int, aspect: Float): CropState {
        val z = (zoom * zoomBy).coerceIn(1f, MAX_ZOOM)
        val moved = copy(zoom = z, cx = cx - panX / pxPerImagePx, cy = cy - panY / pxPerImagePx)
        val r = moved.rect(w, h, aspect)
        return moved.copy(cx = r.x + r.width / 2f, cy = r.y + r.height / 2f)
    }

    companion object {
        const val MAX_ZOOM = 8f
        fun initial(w: Int, h: Int) = CropState(1f, w / 2f, h / 2f)
    }
}
