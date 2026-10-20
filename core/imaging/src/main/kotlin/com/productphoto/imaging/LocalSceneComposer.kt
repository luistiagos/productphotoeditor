package com.productphoto.imaging

import android.graphics.Bitmap
import com.productphoto.ai.api.CompositeOptions
import com.productphoto.ai.api.Mask
import com.productphoto.ai.api.Placement
import com.productphoto.ai.api.ProductSceneComposer
import com.productphoto.ai.api.RgbaImage
import com.productphoto.ai.api.Scene
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

/** Implementação local padrão de [ProductSceneComposer] (provedor "local.composer"). */
class LocalSceneComposer : ProductSceneComposer {
    override suspend fun compose(
        product: RgbaImage,
        productMask: Mask,
        scene: Scene,
        placement: Placement,
        options: CompositeOptions,
    ): RgbaImage = withContext(Dispatchers.Default) {
        val productRaster = product.bitmap.toRaster()
        val mask = productMask.toPlane(product.width, product.height)
        val result = SceneCompositor.compose(
            productRaster,
            mask,
            scene.image.bitmap.toRaster(),
            LightParams(scene.meta.lightDirDeg, scene.meta.lightElevationDeg, scene.meta.shadowSoftness, scene.meta.colorTempK),
            PlacementPx(placement.center.x, placement.center.y, placement.scale, placement.rotationDeg),
            CompositeParams(options.contactShadow, options.castShadow, options.harmonize, options.lightWrap),
        )
        RgbaImage(result.toBitmap())
    }
}

fun Bitmap.toRaster(): Raster {
    val src = if (config == Bitmap.Config.ARGB_8888) this else copy(Bitmap.Config.ARGB_8888, false)
    val px = IntArray(width * height)
    src.getPixels(px, 0, width, 0, 0, width, height) // getPixels devolve ARGB não premultiplicado
    return Raster(width, height, px)
}

fun Raster.toBitmap(): Bitmap =
    Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888).apply { setPixels(argb, 0, width, 0, 0, width, height) }

/** Máscara 0..255 → plano 0..1 no tamanho pedido (redimensiona se preciso). */
fun Mask.toPlane(w: Int = width, h: Int = height): FloatArray {
    val plane = FloatArray(width * height) { (alpha[it].toInt() and 0xFF) / 255f }
    return if (w == width && h == height) plane else resizePlane(plane, width, height, w, h)
}

fun FloatArray.toMask(w: Int, h: Int): Mask =
    Mask(w, h, ByteArray(w * h) { ((this[it].coerceIn(0f, 1f) * 255f) + 0.5f).toInt().toByte() })

/** Produto com a máscara aplicada no canal alfa (para pré-visualização e exportação do recorte). */
fun cutout(image: Bitmap, mask: Mask): Bitmap {
    val r = image.toRaster()
    val plane = mask.toPlane(r.width, r.height)
    for (i in r.argb.indices) {
        val a = (plane[i] * 255f + 0.5f).toInt().coerceIn(0, 255)
        r.argb[i] = (a shl 24) or (r.argb[i] and 0xFFFFFF)
    }
    return r.toBitmap()
}
