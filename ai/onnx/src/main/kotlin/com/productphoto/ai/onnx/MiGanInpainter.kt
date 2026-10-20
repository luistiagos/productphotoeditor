package com.productphoto.ai.onnx

import ai.onnxruntime.OnnxJavaType
import ai.onnxruntime.OnnxTensor
import ai.onnxruntime.OrtEnvironment
import ai.onnxruntime.OrtException
import ai.onnxruntime.OrtSession
import com.productphoto.ai.api.AiError
import com.productphoto.ai.api.Capability
import com.productphoto.ai.api.Inpainter
import com.productphoto.ai.api.Mask
import com.productphoto.ai.api.Progress
import com.productphoto.ai.api.ProgressSink
import com.productphoto.ai.api.ProviderContext
import com.productphoto.ai.api.ProviderFactory
import com.productphoto.ai.api.Requirement
import com.productphoto.ai.api.RgbaImage
import com.productphoto.ai.api.service
import com.productphoto.imaging.toBitmap
import com.productphoto.imaging.toRaster
import com.productphoto.models.ModelManager
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ensureActive
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.JsonObject
import java.io.File
import java.nio.ByteBuffer
import java.nio.ByteOrder

class MiGanInpainter(private val modelFile: File) : Inpainter {
    private val env = OrtEnvironment.getEnvironment()
    private val mutex = Mutex()
    private var session: OrtSession? = null

    private fun session(): OrtSession = session ?: try {
        val opts = OrtSession.SessionOptions().apply {
            setIntraOpNumThreads(Runtime.getRuntime().availableProcessors().coerceIn(1, 4))
            setOptimizationLevel(OrtSession.SessionOptions.OptLevel.ALL_OPT)
        }
        env.createSession(modelFile.absolutePath, opts).also { session = it }
    } catch (e: OrtException) {
        throw AiError.Unavailable(listOf(Requirement.Model(MODEL_ID)), e)
    }

    override suspend fun inpaint(image: RgbaImage, mask: Mask, progress: ProgressSink?): RgbaImage =
        withContext(Dispatchers.Default) {
            mutex.withLock {
                val w = image.width
                val h = image.height
                if (mask.width != w || mask.height != h) {
                    throw AiError.Unsupported("mask ${mask.width}x${mask.height} != image ${w}x$h")
                }
                val src = image.bitmap.toRaster()
                val known = MiGan.knownMask(mask) ?: return@withLock RgbaImage(src.toBitmap())
                progress?.invoke(Progress(null, "migan"))
                val shape = longArrayOf(1, 3, h.toLong(), w.toLong())
                val imgBuf = direct(MiGan.imageToChw(src))
                val maskBuf = direct(known)
                ensureActive()
                val s = session()
                val chw = OnnxTensor.createTensor(env, imgBuf, shape, OnnxJavaType.UINT8).use { ti ->
                    OnnxTensor.createTensor(env, maskBuf, longArrayOf(1, 1, h.toLong(), w.toLong()), OnnxJavaType.UINT8).use { tm ->
                        s.run(mapOf(MiGan.INPUT_IMAGE to ti, MiGan.INPUT_MASK to tm)).use { result ->
                            val out = result.get(0) as? OnnxTensor ?: throw AiError.InvalidOutput("migan: output 0 is not a tensor")
                            val buf = out.byteBuffer
                            ByteArray(buf.remaining()).also { buf.get(it) }
                        }
                    }
                }
                ensureActive()
                if (chw.size != 3 * w * h) throw AiError.InvalidOutput("migan: output ${chw.size} != ${3 * w * h}")
                RgbaImage(MiGan.chwToRaster(chw, src).toBitmap())
            }
        }

    private fun direct(bytes: ByteArray): ByteBuffer =
        ByteBuffer.allocateDirect(bytes.size).order(ByteOrder.nativeOrder()).put(bytes).apply { rewind() }

    companion object {
        const val MODEL_ID = "migan-512-places2"
    }
}

class OnnxMiGanFactory : ProviderFactory<Inpainter> {
    override val id = "onnx.migan"
    override val capability = Capability.INPAINTER
    override val displayName = "MI-GAN"
    override val isLocal = true
    override fun requirements(settings: JsonObject) = listOf(Requirement.Model(MiGanInpainter.MODEL_ID))
    override fun create(settings: JsonObject, ctx: ProviderContext): Inpainter {
        val models = ctx.service<ModelManager>() ?: error("ModelManager not provided")
        val file = models.ensureReady(MiGanInpainter.MODEL_ID)
            ?: throw AiError.ModelNotDownloaded(MiGanInpainter.MODEL_ID)
        return MiGanInpainter(file)
    }
}
