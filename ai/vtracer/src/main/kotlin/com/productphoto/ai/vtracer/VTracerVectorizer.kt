package com.productphoto.ai.vtracer

import com.productphoto.ai.api.AiError
import com.productphoto.ai.api.Capability
import com.productphoto.ai.api.ColorMode
import com.productphoto.ai.api.ProviderContext
import com.productphoto.ai.api.ProviderFactory
import com.productphoto.ai.api.Requirement
import com.productphoto.ai.api.RgbaImage
import com.productphoto.ai.api.VectorizeOptions
import com.productphoto.ai.api.Vectorizer
import com.productphoto.imaging.toRaster
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.JsonObject

internal object VTracerNative {
    init {
        System.loadLibrary("vtracer_jni")
    }

    /** rgba: 4 bytes por pixel, linha a linha. colorMode: 0 = cor, 1 = binário. Lança em erro. */
    @JvmStatic
    external fun convert(
        rgba: ByteArray, width: Int, height: Int,
        colorMode: Int, colorPrecision: Int, layerDifference: Int, filterSpeckle: Int,
    ): String
}

/** VTracer (Rust, MIT/Apache-2.0) via JNI. Pixels com alfa 0 ficam de fora do SVG. */
class VTracerVectorizer : Vectorizer {
    override suspend fun toSvg(image: RgbaImage, options: VectorizeOptions): String = withContext(Dispatchers.Default) {
        val r = image.bitmap.toRaster()
        val rgba = ByteArray(r.argb.size * 4)
        for (i in r.argb.indices) {
            val c = r.argb[i]
            rgba[4 * i] = (c shr 16).toByte()
            rgba[4 * i + 1] = (c shr 8).toByte()
            rgba[4 * i + 2] = c.toByte()
            rgba[4 * i + 3] = (c ushr 24).toByte()
        }
        try {
            VTracerNative.convert(
                rgba, r.width, r.height,
                if (options.colorMode == ColorMode.BINARY) 1 else 0,
                options.colorPrecision, options.layerDifference, options.filterSpeckle,
            )
        } catch (e: IllegalStateException) {
            throw AiError.InvalidOutput("vtracer: ${e.message}")
        } catch (e: IllegalArgumentException) {
            throw AiError.InvalidOutput("vtracer: ${e.message}")
        }
    }
}

class VTracerFactory : ProviderFactory<Vectorizer> {
    override val id = "vtracer"
    override val capability = Capability.VECTORIZER
    override val displayName = "VTracer"
    override val isLocal = true
    override fun requirements(settings: JsonObject) = emptyList<Requirement>()
    override fun create(settings: JsonObject, ctx: ProviderContext): Vectorizer = VTracerVectorizer()
}
