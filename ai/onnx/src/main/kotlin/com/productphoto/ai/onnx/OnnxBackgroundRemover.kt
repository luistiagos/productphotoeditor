package com.productphoto.ai.onnx

import ai.onnxruntime.OnnxTensor
import ai.onnxruntime.OrtEnvironment
import ai.onnxruntime.OrtException
import ai.onnxruntime.OrtSession
import android.graphics.Bitmap
import com.productphoto.ai.api.AiError
import com.productphoto.ai.api.BackgroundRemover
import com.productphoto.ai.api.Capability
import com.productphoto.ai.api.Mask
import com.productphoto.ai.api.Progress
import com.productphoto.ai.api.ProgressSink
import com.productphoto.ai.api.ProviderContext
import com.productphoto.ai.api.ProviderFactory
import com.productphoto.ai.api.Requirement
import com.productphoto.ai.api.RgbaImage
import com.productphoto.ai.api.service
import com.productphoto.imaging.toMask
import com.productphoto.imaging.toRaster
import com.productphoto.models.ModelManager
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ensureActive
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.JsonObject
import java.io.File
import java.nio.FloatBuffer

class OnnxBackgroundRemover(private val modelFile: File) : BackgroundRemover {
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

    override suspend fun removeBackground(image: RgbaImage, progress: ProgressSink?): Mask =
        withContext(Dispatchers.Default) {
            mutex.withLock {
                progress?.invoke(Progress(null, "u2netp"))
                val small = Bitmap.createScaledBitmap(image.bitmap, U2netp.SIZE, U2netp.SIZE, true)
                val input = U2netp.preprocess(small.toRaster())
                if (small !== image.bitmap) small.recycle()
                ensureActive()
                val s = session()
                val pred = OnnxTensor.createTensor(env, FloatBuffer.wrap(input), longArrayOf(1, 3, 320, 320)).use { t ->
                    s.run(mapOf(U2netp.INPUT to t)).use { result ->
                        val out = result.get(0) as? OnnxTensor ?: throw AiError.InvalidOutput("u2netp: output 0 is not a tensor")
                        val buf = out.floatBuffer
                        FloatArray(buf.remaining()).also { buf.get(it) }
                    }
                }
                ensureActive()
                U2netp.refine(U2netp.postprocess(pred, image.width, image.height)).toMask(image.width, image.height)
            }
        }

    companion object {
        const val MODEL_ID = "u2netp"
    }
}

class OnnxU2netpFactory : ProviderFactory<BackgroundRemover> {
    override val id = "onnx.u2netp"
    override val capability = Capability.BACKGROUND_REMOVER
    override val displayName = "U²-Net p"
    override val isLocal = true
    override fun requirements(settings: JsonObject) = listOf(Requirement.Model(OnnxBackgroundRemover.MODEL_ID))
    override fun create(settings: JsonObject, ctx: ProviderContext): BackgroundRemover {
        val models = ctx.service<ModelManager>() ?: error("ModelManager not provided")
        val file = models.ensureReady(OnnxBackgroundRemover.MODEL_ID)
            ?: throw AiError.ModelNotDownloaded(OnnxBackgroundRemover.MODEL_ID)
        return OnnxBackgroundRemover(file)
    }
}
