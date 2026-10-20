package com.productphoto.ai.mlkit

import android.graphics.Rect
import android.graphics.RectF
import com.google.mlkit.common.MlKitException
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.text.TextRecognition
import com.google.mlkit.vision.text.TextRecognizer
import com.google.mlkit.vision.text.latin.TextRecognizerOptions
import com.productphoto.ai.api.AiError
import com.productphoto.ai.api.Capability
import com.productphoto.ai.api.ProviderContext
import com.productphoto.ai.api.ProviderFactory
import com.productphoto.ai.api.Requirement
import com.productphoto.ai.api.RgbaImage
import com.productphoto.ai.api.TextBlock
import com.productphoto.ai.api.TextDetector
import kotlinx.coroutines.tasks.await
import kotlinx.serialization.json.JsonObject

/**
 * ML Kit Text Recognition v2, script latino, **empacotado** (modelo e .so no APK, sem GMS; §14.1).
 */
class MlKitTextDetector : TextDetector {
    private val recognizer: TextRecognizer = TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS)

    override suspend fun detect(image: RgbaImage): List<TextBlock> {
        val text = try {
            recognizer.process(InputImage.fromBitmap(image.bitmap, 0)).await()
        } catch (e: MlKitException) {
            if (e.errorCode == MlKitException.UNAVAILABLE) throw AiError.Unavailable(emptyList(), e)
            throw AiError.InvalidOutput("mlkit text: ${e.message}")
        }
        return text.textBlocks.mapNotNull { block ->
            val box = block.boundingBox ?: return@mapNotNull null
            TextBlock(block.text, box.toRectF(), block.lines.mapNotNull { it.boundingBox?.toRectF() })
        }
    }

    private fun Rect.toRectF() = RectF(left.toFloat(), top.toFloat(), right.toFloat(), bottom.toFloat())
}

class MlKitTextFactory : ProviderFactory<TextDetector> {
    override val id = "mlkit.text-bundled"
    override val capability = Capability.TEXT_DETECTOR
    override val displayName = "ML Kit Text Recognition (latino)"
    override val isLocal = true
    override fun requirements(settings: JsonObject) = emptyList<Requirement>()
    override fun create(settings: JsonObject, ctx: ProviderContext): TextDetector = MlKitTextDetector()
}
