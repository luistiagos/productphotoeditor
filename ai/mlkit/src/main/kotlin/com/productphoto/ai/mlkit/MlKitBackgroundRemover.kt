package com.productphoto.ai.mlkit

import android.content.Context
import com.google.android.gms.common.ConnectionResult
import com.google.android.gms.common.GoogleApiAvailability
import com.google.android.gms.common.moduleinstall.ModuleInstall
import com.google.android.gms.common.moduleinstall.ModuleInstallRequest
import com.google.mlkit.common.MlKitException
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.segmentation.subject.SubjectSegmentation
import com.google.mlkit.vision.segmentation.subject.SubjectSegmenter
import com.google.mlkit.vision.segmentation.subject.SubjectSegmenterOptions
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
import kotlinx.coroutines.tasks.await
import kotlinx.serialization.json.JsonObject

/**
 * ML Kit Subject Segmentation (beta, depende do Google Play services). O modelo é um módulo
 * opcional do GMS: em sideload ele não vem com a instalação, então pedimos via ModuleInstallClient
 * e, enquanto não chega, lançamos Unavailable para a cadeia cair no próximo provedor (§13.1).
 */
class MlKitBackgroundRemover(private val context: Context) : BackgroundRemover {
    private val segmenter: SubjectSegmenter = SubjectSegmentation.getClient(
        SubjectSegmenterOptions.Builder().enableForegroundConfidenceMask().build(),
    )
    @Volatile private var moduleReady = false
    @Volatile private var installRequested = false

    private suspend fun ensureModule() {
        if (moduleReady) return
        val client = ModuleInstall.getClient(context)
        val available = try {
            client.areModulesAvailable(segmenter).await().areModulesAvailable()
        } catch (e: Exception) {
            throw AiError.Unavailable(listOf(MODULE), e)
        }
        if (available) {
            moduleReady = true
            return
        }
        if (!installRequested) {
            installRequested = true
            // Pedido em segundo plano; a próxima chamada encontra o módulo pronto.
            client.installModules(ModuleInstallRequest.Builder().addApi(segmenter).build())
                .addOnFailureListener { installRequested = false }
        }
        throw AiError.Unavailable(listOf(MODULE))
    }

    override suspend fun removeBackground(image: RgbaImage, progress: ProgressSink?): Mask {
        ensureModule()
        progress?.invoke(Progress(null, "mlkit"))
        val result = try {
            segmenter.process(InputImage.fromBitmap(image.bitmap, 0)).await()
        } catch (e: MlKitException) {
            if (e.errorCode == MlKitException.UNAVAILABLE) {
                moduleReady = false
                throw AiError.Unavailable(listOf(MODULE), e)
            }
            throw AiError.InvalidOutput("mlkit: ${e.message}")
        }
        val conf = result.foregroundConfidenceMask ?: throw AiError.InvalidOutput("mlkit: no confidence mask")
        val n = image.width * image.height
        if (conf.capacity() != n) throw AiError.InvalidOutput("mlkit: mask ${conf.capacity()} != $n")
        conf.rewind()
        val alpha = ByteArray(n) { ((conf.get().coerceIn(0f, 1f) * 255f) + 0.5f).toInt().toByte() }
        return Mask(image.width, image.height, alpha)
    }

    companion object {
        val MODULE = Requirement.DeviceFeature("mlkit-subject-segmentation-module")
    }
}

class MlKitSubjectFactory : ProviderFactory<BackgroundRemover> {
    override val id = "mlkit.subject"
    override val capability = Capability.BACKGROUND_REMOVER
    override val displayName = "ML Kit Subject Segmentation"
    override val isLocal = true
    override fun requirements(settings: JsonObject) = listOf(Requirement.PlayServices)
    override fun create(settings: JsonObject, ctx: ProviderContext): BackgroundRemover =
        MlKitBackgroundRemover(ctx.androidContext.applicationContext)

    companion object {
        fun isPlayServicesAvailable(context: Context): Boolean =
            GoogleApiAvailability.getInstance().isGooglePlayServicesAvailable(context) == ConnectionResult.SUCCESS
    }
}
