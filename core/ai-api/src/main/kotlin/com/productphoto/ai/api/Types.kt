package com.productphoto.ai.api

import android.graphics.Bitmap
import android.graphics.PointF
import android.graphics.RectF

/** ARGB_8888, sem premultiplicar na API. */
class RgbaImage(val bitmap: Bitmap) {
    val width: Int get() = bitmap.width
    val height: Int get() = bitmap.height
}

/** 0..255, 255 = objeto/área. */
class Mask(val width: Int, val height: Int, val alpha: ByteArray) {
    init {
        require(alpha.size == width * height) { "alpha size ${alpha.size} != ${width}x$height" }
    }
}

data class Progress(val fraction: Float?, val stage: String)
typealias ProgressSink = (Progress) -> Unit

interface BackgroundRemover {
    suspend fun removeBackground(image: RgbaImage, progress: ProgressSink? = null): Mask
}

interface Inpainter {
    /** mask 255 = área a preencher. Saída do mesmo tamanho que image. */
    suspend fun inpaint(image: RgbaImage, mask: Mask, progress: ProgressSink? = null): RgbaImage
}

/** Caixas em pixels da imagem analisada. */
data class TextBlock(val text: String, val box: RectF, val lines: List<RectF>)

interface TextDetector {
    suspend fun detect(image: RgbaImage): List<TextBlock>
}

interface Translator {
    /** Idiomas em tag BCP-47 ("pt", "en"); from null = detectar. */
    suspend fun translate(text: String, from: String?, to: String): String
}

enum class ColorMode { COLOR, BINARY }

/**
 * Parâmetros do traçado (os do VTracer, ARQUITETURA §14.3). colorPrecision: bits por canal (1..8);
 * layerDifference: diferença de cor entre camadas; filterSpeckle: descarta manchas menores que N×N px.
 */
data class VectorizeOptions(
    val colorMode: ColorMode = ColorMode.COLOR,
    val colorPrecision: Int = 6,
    val layerDifference: Int = 16,
    val filterSpeckle: Int = 4,
)

interface Vectorizer {
    /** Documento SVG completo, com width/height iguais aos da imagem. */
    suspend fun toSvg(image: RgbaImage, options: VectorizeOptions = VectorizeOptions()): String
}

interface Upscaler {
    /** factor ∈ {2, 4} (outro → [AiError.Unsupported]); saída = entrada × factor, com o alfa preservado. */
    suspend fun upscale(image: RgbaImage, factor: Int, progress: ProgressSink? = null): RgbaImage
}

// Mockup (§20.4 item 8): só superfícies planas na fase 7
/** quad: 4 cantos em px da base, na ordem TL, TR, BR, BL. aspect = largura/altura do design esperado. mask null = o quad inteiro. */
data class MockupSlot(val quad: List<PointF>, val aspect: Float, val mask: Mask? = null)

/** shading: força do sombreamento tirado da própria base (0..1); displacement: força do relevo (0 = papel liso). */
data class MockupTemplate(
    val id: String,
    val base: RgbaImage,
    val slots: List<MockupSlot>,
    val shading: Float = 1f,
    val displacement: Float = 0f,
)

interface MockupRenderer {
    /** Um design por espaço, na ordem de [MockupTemplate.slots]; `designs.size != slots.size` → [AiError.Unsupported]. */
    suspend fun render(designs: List<RgbaImage>, template: MockupTemplate): RgbaImage
}

// Foto de produto: composição determinística, sem modelo generativo
data class Scene(val id: String, val image: RgbaImage, val meta: SceneMeta)

/**
 * floorY e placement em fração da altura/largura do cenário (0..1).
 * lightDirDeg: de onde vem a luz no plano da imagem (0 = da direita, 90 = do fundo, 180 = da esquerda,
 * 270 = da frente/câmera). A sombra projetada cai no sentido oposto.
 */
data class SceneMeta(
    val floorY: Float,
    val lightDirDeg: Float,
    val lightElevationDeg: Float,
    val shadowSoftness: Float,
    val colorTempK: Int,
    val placement: RectF,
)

/** center em pixels do cenário (ponto onde fica o centro do recorte do produto); scale sobre os pixels do produto. */
data class Placement(val center: PointF, val scale: Float, val rotationDeg: Float)

data class CompositeOptions(
    val contactShadow: Float = .6f,
    val castShadow: Float = .4f,
    val harmonize: Float = .5f,
    val lightWrap: Float = .3f,
)

interface ProductSceneComposer {
    suspend fun compose(
        product: RgbaImage,
        productMask: Mask,
        scene: Scene,
        placement: Placement,
        options: CompositeOptions,
    ): RgbaImage
}
