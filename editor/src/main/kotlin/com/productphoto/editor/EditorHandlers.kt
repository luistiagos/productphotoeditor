package com.productphoto.editor

import android.graphics.RectF
import com.productphoto.ai.api.BackgroundRemover
import com.productphoto.ai.api.ColorMode
import com.productphoto.ai.api.Inpainter
import com.productphoto.ai.api.Mask
import com.productphoto.ai.api.RgbaImage
import com.productphoto.ai.api.TextBlock
import com.productphoto.ai.api.StructuredText
import com.productphoto.ai.api.TextDetector
import com.productphoto.ai.api.TextGenerator
import com.productphoto.ai.api.Upscaler
import com.productphoto.ai.api.VectorizeOptions
import com.productphoto.ai.api.Vectorizer
import com.productphoto.imaging.TextRemover
import com.productphoto.imaging.UPSCALE_MAX_INPUT_PIXELS
import com.productphoto.imaging.cutout
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonArray
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.double
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.put

/** Capabilities que o editor usa; todas vêm de :core:ai-api (cadeias montadas no :app). */
class EditorAi(
    val backgroundRemover: BackgroundRemover,
    val inpainter: Inpainter,
    val textDetector: TextDetector,
    val vectorizer: Vectorizer,
    /** Quem atendeu a última chamada da capability ("feito no aparelho por X"), se houver. */
    val servedBy: (String) -> String? = { null },
    /** null = texto IA desligado (o editor responde `unsupported`). */
    val textGenerator: TextGenerator? = null,
    /** null = upscale desligado (o editor responde `unsupported`). */
    val upscaler: Upscaler? = null,
) {
    val textRemover = TextRemover(textDetector, inpainter)
}

/** Registra os handlers `ai.*` (§7, §15.2). Recebem a URL da imagem e devolvem uma URL nova. */
fun EditorBridge.registerAi(ai: EditorAi, assets: EditorAssets) {
    suspend fun blobResult(bmp: android.graphics.Bitmap, capability: String): JsonElement {
        val name = assets.putPng(bmp, "ai")
        return buildJsonObject {
            put("url", assets.blobUrl(name)); put("width", bmp.width); put("height", bmp.height)
            ai.servedBy(capability)?.let { put("servedBy", it) }
        }
    }

    handle("ai.removeBg") { payload, progress ->
        val src = assets.decode(payload.obj().str("src"))
        progress(null, "recortando")
        val mask = ai.backgroundRemover.removeBackground(RgbaImage(src)) { p -> progress(p.fraction?.toDouble(), p.stage) }
        val out = withContext(Dispatchers.Default) { cutout(src, mask) }
        blobResult(out, "BACKGROUND_REMOVER")
    }

    handle("ai.inpaint") { payload, progress ->
        val p = payload.obj()
        val src = assets.decode(p.str("src"))
        val mask = withContext(Dispatchers.Default) {
            val bmp = try {
                EditorAssets.decodeBytes(EditorAssets.dataUrlBytes(p.str("mask")))
            } catch (e: java.io.IOException) {
                throw BridgeException(ErrorCode.INVALID, "máscara não é uma imagem válida")
            }
            maskFromAlpha(bmp, src.width, src.height)
        }
        progress(null, "preenchendo")
        val out = ai.inpainter.inpaint(RgbaImage(src), mask) { pr -> progress(pr.fraction?.toDouble(), pr.stage) }
        blobResult(out.bitmap, "INPAINTER")
    }

    handle("ai.detectText") { payload, _ ->
        val src = assets.decode(payload.obj().str("src"))
        val blocks = ai.textRemover.detect(RgbaImage(src))
        buildJsonObject {
            put("width", src.width); put("height", src.height)
            put("blocks", buildJsonArray { blocks.forEach { add(it.toJson()) } })
        }
    }

    handle("ai.removeText") { payload, progress ->
        val p = payload.obj()
        val src = assets.decode(p.str("src"))
        val blocks = (p["blocks"] as? JsonArray ?: throw BridgeException(ErrorCode.INVALID, "missing blocks")).map { blockFromJson(it) }
        progress(null, "removendo")
        val out = ai.textRemover.remove(RgbaImage(src), blocks) { pr -> progress(pr.fraction?.toDouble(), pr.stage) }
        blobResult(out.bitmap, "INPAINTER")
    }

    handle("ai.vectorize") { payload, progress ->
        val p = payload.obj()
        val src = assets.decode(p.str("src"), maxSide = 2048)
        val d = VectorizeOptions()
        val options = VectorizeOptions(
            colorMode = if (p.strOrNull("colorMode") == "binary") ColorMode.BINARY else ColorMode.COLOR,
            colorPrecision = (p["colorPrecision"] as? JsonPrimitive)?.content?.toIntOrNull() ?: d.colorPrecision,
            layerDifference = (p["layerDifference"] as? JsonPrimitive)?.content?.toIntOrNull() ?: d.layerDifference,
            filterSpeckle = (p["filterSpeckle"] as? JsonPrimitive)?.content?.toIntOrNull() ?: d.filterSpeckle,
        )
        progress(null, "traçando")
        val svg = ai.vectorizer.toSvg(RgbaImage(src), options)
        buildJsonObject { put("svg", svg) }
    }

    // texto IA (fase 5, §18.5): JSON validado + 1 retry pelo StructuredText
    fun text(): TextGenerator = ai.textGenerator ?: throw BridgeException(ErrorCode.UNSUPPORTED, "texto com IA desligado")

    handle("ai.rewriteText") { payload, progress ->
        val p = payload.obj()
        val count = (p["count"] as? JsonPrimitive)?.content?.toIntOrNull() ?: 3
        val req = TextPrompts.rewrite(p.str("text"), p.strOrNull("style") ?: "rewrite", count)
        progress(null, "escrevendo")
        val out = StructuredText.generate(text(), req).jsonObject
        val variants = out["variants"]!!.jsonArray.map { it.jsonPrimitive.content.trim() }
            .filter { it.isNotEmpty() }.distinct().take(count.coerceIn(1, 5))
        buildJsonObject {
            put("variants", buildJsonArray { variants.forEach { add(JsonPrimitive(it)) } })
            ai.servedBy("TEXT_GENERATOR")?.let { put("servedBy", it) }
        }
    }

    handle("ai.generateCopy") { payload, progress ->
        val req = TextPrompts.copy(payload.obj().str("brief"))
        progress(null, "escrevendo")
        val out = StructuredText.generate(text(), req).jsonObject
        buildJsonObject {
            for (k in listOf("title", "subtitle", "cta")) put(k, out[k]!!.jsonPrimitive.content.trim())
            ai.servedBy("TEXT_GENERATOR")?.let { put("servedBy", it) }
        }
    }

    // fase 7 (§20.4 item 7): sem a redução silenciosa do decode — ampliar o que acabou de ser reduzido não faz sentido
    handle("ai.upscale") { payload, progress ->
        val p = payload.obj()
        val factor = (p["factor"] as? JsonPrimitive)?.content?.toIntOrNull() ?: 2
        if (factor != 2 && factor != 4) throw BridgeException(ErrorCode.INVALID, "fator $factor (só 2 ou 4)")
        val upscaler = ai.upscaler ?: throw BridgeException(ErrorCode.UNSUPPORTED, "upscale desligado")
        val url = p.str("src")
        val bytes = assets.read(url) ?: throw BridgeException(ErrorCode.INVALID, "imagem fora do editor: $url")
        val (w, h) = imageBounds(bytes)
        if (w.toLong() * h > UPSCALE_MAX_INPUT_PIXELS) {
            throw BridgeException(ErrorCode.INVALID, "a imagem tem ${w}×$h; dá para melhorar até 1 MP (ex.: 1024×1024)")
        }
        val src = withContext(Dispatchers.Default) { EditorAssets.decodeBytes(bytes, maxSide = Int.MAX_VALUE) }
        progress(0.0, "ampliando")
        val out = upscaler.upscale(RgbaImage(src), factor) { pr -> progress(pr.fraction?.toDouble(), "ampliando") }
        blobResult(out.bitmap, "UPSCALER")
    }
}

/** Largura × altura sem decodificar os pixels. */
internal fun imageBounds(bytes: ByteArray): Pair<Int, Int> {
    val o = android.graphics.BitmapFactory.Options().apply { inJustDecodeBounds = true }
    android.graphics.BitmapFactory.decodeByteArray(bytes, 0, bytes.size, o)
    if (o.outWidth <= 0 || o.outHeight <= 0) throw BridgeException(ErrorCode.INVALID, "não é uma imagem válida")
    return o.outWidth to o.outHeight
}

/** Alfa > 0 = área a preencher; redimensiona (vizinho mais próximo) se o tamanho não bater. */
internal fun maskFromAlpha(bmp: android.graphics.Bitmap, w: Int, h: Int): Mask {
    val px = IntArray(bmp.width * bmp.height)
    bmp.getPixels(px, 0, bmp.width, 0, 0, bmp.width, bmp.height)
    return maskFromArgb(px, bmp.width, bmp.height, w, h)
}

internal fun maskFromArgb(px: IntArray, sw: Int, sh: Int, w: Int, h: Int): Mask {
    val alpha = ByteArray(w * h)
    for (y in 0 until h) {
        val sy = (y * sh / h).coerceAtMost(sh - 1)
        for (x in 0 until w) {
            val sx = (x * sw / w).coerceAtMost(sw - 1)
            if ((px[sy * sw + sx] ushr 24) > 0) alpha[y * w + x] = 0xFF.toByte()
        }
    }
    return Mask(w, h, alpha)
}

private fun RectF.toJson() = buildJsonArray { add(JsonPrimitive(left)); add(JsonPrimitive(top)); add(JsonPrimitive(right)); add(JsonPrimitive(bottom)) }

private fun TextBlock.toJson() = buildJsonObject {
    put("text", text)
    put("box", box.toJson())
    put("lines", buildJsonArray { lines.forEach { add(it.toJson()) } })
}

private fun rect(e: JsonElement?): RectF {
    val a = (e as? JsonArray)?.takeIf { it.size == 4 } ?: throw BridgeException(ErrorCode.INVALID, "bad box")
    val v = a.map { it.jsonPrimitive.double.toFloat() }
    return RectF(v[0], v[1], v[2], v[3])
}

private fun blockFromJson(e: JsonElement): TextBlock {
    val o = e as? JsonObject ?: throw BridgeException(ErrorCode.INVALID, "bad block")
    return TextBlock(o.strOrNull("text") ?: "", rect(o["box"]), (o["lines"] as? JsonArray)?.jsonArray?.map(::rect).orEmpty())
}
