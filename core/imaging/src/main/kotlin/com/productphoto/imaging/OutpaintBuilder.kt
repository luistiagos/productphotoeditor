package com.productphoto.imaging

import android.graphics.RectF
import com.productphoto.ai.api.AdAspectRatio
import com.productphoto.ai.api.Mask
import com.productphoto.ai.api.OutpaintPreparation
import com.productphoto.ai.api.RgbaImage
import com.productphoto.ai.api.snapTo8
import kotlin.math.max
import kotlin.math.min

data class OutpaintRasterPreparation(
    val expandedRaster: Raster,
    val inpaintMask: Mask,
    val safeZone: RectF,
    val targetWidth: Int,
    val targetHeight: Int,
)

object OutpaintBuilder {

    /**
     * Prepara a geometria do canvas expandido, a máscara de inpaint e a Safe Zone em memória (Raster).
     * Adequado para execução sem dependência de runtime Android em testes de unidade.
     */
    fun buildRaster(srcRaster: Raster, targetRatio: AdAspectRatio, featherPx: Int = 16): OutpaintRasterPreparation {
        val srcW = srcRaster.width
        val srcH = srcRaster.height

        val srcAspect = srcW.toFloat() / srcH.toFloat()
        val targetAspect = targetRatio.widthRatio.toFloat() / targetRatio.heightRatio.toFloat()

        val (targetW, targetH) = if (targetAspect >= srcAspect) {
            val h = snapTo8(srcH)
            val w = snapTo8(((h.toFloat() * targetRatio.widthRatio) / targetRatio.heightRatio).toInt())
            max(w, snapTo8(srcW)) to h
        } else {
            val w = snapTo8(srcW)
            val h = snapTo8(((w.toFloat() * targetRatio.heightRatio) / targetRatio.widthRatio).toInt())
            w to max(h, snapTo8(srcH))
        }

        val offsetX = ((targetW - srcW) / 2).coerceAtLeast(0)
        val offsetY = ((targetH - srcH) / 2).coerceAtLeast(0)

        val safeZone = RectF(
            offsetX.toFloat(),
            offsetY.toFloat(),
            (offsetX + srcW).toFloat(),
            (offsetY + srcH).toFloat(),
        )

        val outRaster = Raster(targetW, targetH)
        val maskAlpha = ByteArray(targetW * targetH)
        val feather = featherPx.coerceAtLeast(0)

        for (y in 0 until targetH) {
            val clampedY = (y - offsetY).coerceIn(0, srcH - 1)
            for (x in 0 until targetW) {
                val clampedX = (x - offsetX).coerceIn(0, srcW - 1)
                val outIdx = y * targetW + x

                outRaster.argb[outIdx] = srcRaster.argb[clampedY * srcW + clampedX]

                val isInsideX = x in offsetX until (offsetX + srcW)
                val isInsideY = y in offsetY until (offsetY + srcH)

                if (isInsideX && isInsideY) {
                    if (feather > 0) {
                        val distToEdgeX = min(x - offsetX, (offsetX + srcW - 1) - x)
                        val distToEdgeY = min(y - offsetY, (offsetY + srcH - 1) - y)
                        val distToEdge = min(distToEdgeX, distToEdgeY)

                        if (distToEdge < feather) {
                            val f = (1f - (distToEdge.toFloat() / feather)).coerceIn(0f, 1f)
                            maskAlpha[outIdx] = (f * 255f).toInt().toByte()
                        } else {
                            maskAlpha[outIdx] = 0
                        }
                    } else {
                        maskAlpha[outIdx] = 0
                    }
                } else {
                    maskAlpha[outIdx] = 255.toByte()
                }
            }
        }

        val mask = Mask(targetW, targetH, maskAlpha)
        return OutpaintRasterPreparation(outRaster, mask, safeZone, targetW, targetH)
    }

    /**
     * Versão de alto nível que consome e produz [RgbaImage].
     */
    fun build(source: RgbaImage, targetRatio: AdAspectRatio, featherPx: Int = 16): OutpaintPreparation {
        val prep = buildRaster(source.bitmap.toRaster(), targetRatio, featherPx)
        return OutpaintPreparation(
            expandedImage = RgbaImage(prep.expandedRaster.toBitmap()),
            inpaintMask = prep.inpaintMask,
            safeZone = prep.safeZone,
            targetWidth = prep.targetWidth,
            targetHeight = prep.targetHeight,
        )
    }
}
