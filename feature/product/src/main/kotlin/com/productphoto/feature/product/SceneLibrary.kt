package com.productphoto.feature.product

import android.content.res.AssetManager
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.RectF
import com.productphoto.ai.api.SceneMeta
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json

@Serializable
data class SceneIndex(val version: Int = 1, val scenes: List<SceneEntry> = emptyList())

@Serializable
data class SceneEntry(val id: String, val file: String, val thumb: String, val tags: List<String>, val meta: SceneMetaJson)

@Serializable
data class SceneMetaJson(
    val floorY: Float,
    val lightDirDeg: Float,
    val lightElevationDeg: Float,
    val shadowSoftness: Float,
    val colorTempK: Int,
    val placement: List<Float>,
) {
    fun toMeta() = SceneMeta(floorY, lightDirDeg, lightElevationDeg, shadowSoftness, colorTempK,
        RectF(placement[0], placement[1], placement[2], placement[3]))
}

enum class ProductCategory(val tag: String, val label: String) {
    ALL("all", "Todos"),
    COSMETICS("cosmetics", "Cosméticos"),
    FOOD("food", "Alimentos"),
    ELECTRONICS("electronics", "Eletrônicos"),
    FASHION("fashion", "Moda"),
    HOME("home", "Casa"),
}

/** Cenários empacotados em assets/content/scenes (§8). No MVP isto vai para :data/ContentRepository. */
class SceneLibrary(private val assets: AssetManager) {
    private val json = Json { ignoreUnknownKeys = true }

    val all: List<SceneEntry> by lazy {
        assets.open("$DIR/index.json").use { json.decodeFromString(SceneIndex.serializer(), it.readBytes().decodeToString()) }.scenes
    }

    fun byCategory(c: ProductCategory) = all.filter { c.tag in it.tags }

    fun thumb(e: SceneEntry): Bitmap = assets.open("$DIR/${e.thumb}").use { BitmapFactory.decodeStream(it) }

    fun image(e: SceneEntry): Bitmap = assets.open("$DIR/${e.file}").use {
        BitmapFactory.decodeStream(it, null, BitmapFactory.Options().apply { inPreferredConfig = Bitmap.Config.ARGB_8888 })!!
    }

    private companion object {
        const val DIR = "content/scenes"
    }
}
