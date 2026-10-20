package com.productphoto.feature.mockup

import android.content.res.AssetManager
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.PointF
import com.productphoto.ai.api.MockupSlot
import com.productphoto.ai.api.MockupTemplate
import com.productphoto.ai.api.RgbaImage
import com.productphoto.imaging.isConvexQuad
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json

@Serializable
data class MockupIndex(val version: Int = 1, val mockups: List<MockupEntry> = emptyList())

/** quad: 4 cantos [x, y] em px da base, na ordem TL, TR, BR, BL (§20.4 item 10). */
@Serializable
data class SlotJson(val quad: List<List<Float>>, val aspect: Float)

@Serializable
data class MockupEntry(
    val id: String,
    val name: String,
    val category: String,
    val file: String,
    val thumb: String,
    val width: Int,
    val height: Int,
    val slots: List<SlotJson>,
    val shading: Float = 1f,
    val displacement: Float = 0f,
)

private val json = Json { ignoreUnknownKeys = true }

fun parseMockupIndex(text: String): MockupIndex = json.decodeFromString(MockupIndex.serializer(), text)

/** quad em `FloatArray(8)` (x, y alternados). */
fun SlotJson.flat(): FloatArray = FloatArray(8) { quad[it / 2][it % 2] }

/** Problemas de um template (vazio = ok): quad com 4 cantos, dentro da base, convexo, proporção > 0. */
fun MockupEntry.problems(): List<String> = buildList {
    if (slots.isEmpty()) add("$id: sem espaços")
    slots.forEachIndexed { i, s ->
        if (s.quad.size != 4 || s.quad.any { it.size != 2 }) { add("$id[$i]: quad precisa de 4 cantos [x, y]"); return@forEachIndexed }
        if (s.quad.any { (x, y) -> x < 0 || y < 0 || x > width || y > height }) add("$id[$i]: quad fora da base ${width}x$height")
        if (!isConvexQuad(s.flat())) add("$id[$i]: quad não convexo")
        if (s.aspect <= 0f) add("$id[$i]: proporção ${s.aspect}")
    }
}

/** Templates empacotados em assets/content/mockups (padrão do SceneLibrary). */
class MockupLibrary(private val assets: AssetManager) {
    val all: List<MockupEntry> by lazy {
        assets.open("$DIR/index.json").use { parseMockupIndex(it.readBytes().decodeToString()) }.mockups
    }

    fun thumb(e: MockupEntry): Bitmap = assets.open("$DIR/${e.thumb}").use { BitmapFactory.decodeStream(it) }

    fun template(e: MockupEntry): MockupTemplate {
        val base = assets.open("$DIR/${e.file}").use {
            BitmapFactory.decodeStream(it, null, BitmapFactory.Options().apply { inPreferredConfig = Bitmap.Config.ARGB_8888 })!!
        }
        return MockupTemplate(
            e.id, RgbaImage(base),
            e.slots.map { s -> MockupSlot(s.quad.map { (x, y) -> PointF(x, y) }, s.aspect) },
            e.shading, e.displacement,
        )
    }

    private companion object {
        const val DIR = "content/mockups"
    }
}
