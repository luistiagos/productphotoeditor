package com.productphoto.imaging

import com.productphoto.ai.api.LightDirection
import com.productphoto.ai.api.ProductRelighter
import com.productphoto.ai.api.Progress
import com.productphoto.ai.api.ProgressSink
import com.productphoto.ai.api.RelightRequest
import com.productphoto.ai.api.RgbaImage
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlin.math.hypot
import kotlin.math.min

/**
 * Harmonizador e Relighter local determinístico (offline).
 * Executa realces direcionais de iluminação (rim light, key light e ambient balance)
 * sobre a imagem composta sem depender de backend de rede.
 */
class LocalRelighter : ProductRelighter {

    fun relightRaster(raster: Raster, dir: LightDirection, strength: Float): Raster {
        val w = raster.width
        val h = raster.height
        val out = raster.copy()
        val str = strength.coerceIn(0.05f, 1.0f)

        for (y in 0 until h) {
            val ny = y.toFloat() / h.toFloat()
            for (x in 0 until w) {
                val nx = x.toFloat() / w.toFloat()
                val idx = y * w + x
                val c = raster.argb[idx]
                val a = a8(c)
                if (a == 0) continue

                val r = r8(c)
                val g = g8(c)
                val b = b8(c)

                val lightFactor = when (dir) {
                    LightDirection.LEFT -> (1.0f - nx) * 0.8f + 0.2f
                    LightDirection.RIGHT -> nx * 0.8f + 0.2f
                    LightDirection.TOP -> (1.0f - ny) * 0.8f + 0.2f
                    LightDirection.BACKLIGHT -> {
                        val distFromEdgeX = min(nx, 1.0f - nx)
                        val distFromEdgeY = min(ny, 1.0f - ny)
                        val edgeDist = min(distFromEdgeX, distFromEdgeY)
                        if (edgeDist < 0.15f) (1.0f - (edgeDist / 0.15f)) * 0.9f + 0.2f else 0.2f
                    }
                    LightDirection.AMBIENT -> {
                        val dx = nx - 0.5f
                        val dy = ny - 0.5f
                        val distCenter = hypot(dx, dy)
                        (1.0f - distCenter * 0.5f).coerceIn(0.4f, 1.0f)
                    }
                }

                val boost = (lightFactor - 0.5f) * str * 60f

                val newR = (r + boost).toInt().coerceIn(0, 255)
                val newG = (g + boost).toInt().coerceIn(0, 255)
                val newB = (b + boost).toInt().coerceIn(0, 255)

                out.argb[idx] = argb(a, newR, newG, newB)
            }
        }
        return out
    }

    override suspend fun relight(req: RelightRequest, progress: ProgressSink?): RgbaImage = withContext(Dispatchers.Default) {
        progress?.invoke(Progress(0.2f, "Analisando iluminação local…"))
        val srcBmp = req.image.bitmap
        val raster = srcBmp.toRaster()
        progress?.invoke(Progress(0.5f, "Aplicando harmonização ${req.lightDir.label}…"))
        val outRaster = relightRaster(raster, req.lightDir, req.strength)
        progress?.invoke(Progress(1.0f, "Harmonização concluída."))
        RgbaImage(outRaster.toBitmap())
    }
}
