package com.productphoto.ai.onnx

import ai.onnxruntime.OnnxTensor
import ai.onnxruntime.OrtEnvironment
import ai.onnxruntime.OrtException
import ai.onnxruntime.OrtSession
import com.productphoto.ai.api.AiError
import com.productphoto.ai.api.Capability
import com.productphoto.ai.api.Progress
import com.productphoto.ai.api.ProgressSink
import com.productphoto.ai.api.ProviderContext
import com.productphoto.ai.api.ProviderFactory
import com.productphoto.ai.api.Requirement
import com.productphoto.ai.api.RgbaImage
import com.productphoto.ai.api.Upscaler
import com.productphoto.ai.api.service
import com.productphoto.imaging.toBitmap
import com.productphoto.imaging.toRaster
import com.productphoto.imaging.upscaleTiled
import com.productphoto.models.ModelManager
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.JsonObject
import java.io.File

/** ×2/×4 com o Real-ESRGAN x4v3 em tiles; [overlap] só muda na prova de costura (§20.5 task 4). */
class RealEsrganUpscaler(private val modelFile: File, private val overlap: Int = RealEsrgan.OVERLAP) : Upscaler {
    private val env = OrtEnvironment.getEnvironment()
    private val mutex = Mutex()
    private var session: OrtSession? = null

    /** XNNPACK foi o mais rápido no moto g86 (§20.6); sem o EP, CPU com 4 threads. */
    private fun session(): OrtSession = session ?: try {
        try {
            env.createSession(modelFile.absolutePath, options(xnnpack = true))
        } catch (e: OrtException) {
            env.createSession(modelFile.absolutePath, options(xnnpack = false))
        }.also { session = it }
    } catch (e: OrtException) {
        throw AiError.Unavailable(listOf(Requirement.Model(MODEL_ID)), e)
    }

    private fun options(xnnpack: Boolean) = OrtSession.SessionOptions().apply {
        setOptimizationLevel(OrtSession.SessionOptions.OptLevel.ALL_OPT)
        val threads = Runtime.getRuntime().availableProcessors().coerceIn(1, 4)
        if (xnnpack) {
            // recomendação do ORT para o XNNPACK: o pool do EP faz o trabalho, o da sessão fica com 1 thread
            setIntraOpNumThreads(1)
            addConfigEntry("session.intra_op.allow_spinning", "0")
            addXnnpack(mapOf("intra_op_num_threads" to threads.toString()))
        } else {
            setIntraOpNumThreads(threads)
        }
    }

    override suspend fun upscale(image: RgbaImage, factor: Int, progress: ProgressSink?): RgbaImage =
        withContext(Dispatchers.Default) {
            mutex.withLock {
                val out = upscaleTiled(
                    image.bitmap.toRaster(), factor, RealEsrgan.TILE, overlap,
                    progress = { done, total -> progress?.invoke(Progress(done.toFloat() / total, "realesrgan")) },
                ) { chw ->
                    val s = session()
                    OnnxTensor.createTensor(env, RealEsrgan.input(chw), RealEsrgan.INPUT_SHAPE).use { t ->
                        s.run(mapOf(RealEsrgan.INPUT to t)).use { result ->
                            val o = result.get(0) as? OnnxTensor ?: throw AiError.InvalidOutput("realesrgan: output 0 is not a tensor")
                            RealEsrgan.output(o.floatBuffer)
                        }
                    }
                }
                RgbaImage(out.toBitmap())
            }
        }

    companion object {
        const val MODEL_ID = "realesr-general-x4v3"
    }
}

class OnnxRealEsrganFactory : ProviderFactory<Upscaler> {
    override val id = ID
    override val capability = Capability.UPSCALER
    override val displayName = "Real-ESRGAN"
    override val isLocal = true
    override fun requirements(settings: JsonObject) = listOf(Requirement.Model(RealEsrganUpscaler.MODEL_ID))
    override fun create(settings: JsonObject, ctx: ProviderContext): Upscaler {
        val models = ctx.service<ModelManager>() ?: error("ModelManager not provided")
        val file = models.ensureReady(RealEsrganUpscaler.MODEL_ID)
            ?: throw AiError.ModelNotDownloaded(RealEsrganUpscaler.MODEL_ID)
        return RealEsrganUpscaler(file)
    }

    companion object {
        const val ID = "onnx.realesrgan-x4v3"
    }
}
