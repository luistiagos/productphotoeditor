package com.productphoto.feature.product

import android.graphics.Bitmap
import android.graphics.PointF
import android.net.Uri
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.productphoto.ai.api.AiError
import com.productphoto.ai.api.BackgroundRemover
import com.productphoto.ai.api.CompositeOptions
import com.productphoto.ai.api.Mask
import com.productphoto.ai.api.Placement
import com.productphoto.ai.api.ProductSceneComposer
import com.productphoto.ai.api.Requirement
import com.productphoto.ai.api.RgbaImage
import com.productphoto.ai.api.Scene
import com.productphoto.ai.api.ServedBy
import com.productphoto.imaging.Roi
import com.productphoto.imaging.cutout
import com.productphoto.imaging.toPlane
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import kotlin.math.abs
import kotlin.math.min

/** BiRefNet saiu: não cabe em 8 GB (ARQUITETURA §24.5). */
enum class RemoverMode(val label: String) { AUTO("Automático"), MLKIT("ML Kit"), U2NETP("u2netp") }
enum class ExportFormat(val mime: String, val ext: String) { PNG("image/png", "png"), JPG("image/jpeg", "jpg") }

/** O que o fluxo precisa do resto do app. Implementado no :app (só conhece :core:ai-api). */
interface ProductFlowDeps {
    val remover: BackgroundRemover
    val removerServedBy: StateFlow<ServedBy?>
    val composer: ProductSceneComposer
    val scenes: SceneLibrary
    suspend fun decode(uri: Uri): Bitmap
    /** Arquivo novo para a câmera gravar (via FileProvider). */
    fun newCaptureUri(): Uri
    suspend fun export(bitmap: Bitmap, format: ExportFormat): String
    suspend fun removerMode(): RemoverMode
    suspend fun setRemoverMode(mode: RemoverMode)
    /** Leva o resultado para o editor (fase 4); sem editor, não faz nada. */
    suspend fun openInEditor(bitmap: Bitmap) {}
}

enum class Step { CATEGORY, MASK, SCENE, POSITION, RESULT }

data class UiState(
    val step: Step = Step.CATEGORY,
    val category: ProductCategory = ProductCategory.ALL,
    val removerMode: RemoverMode = RemoverMode.AUTO,
    val busy: String? = null,
    val message: String? = null,
    val servedBy: ServedBy? = null,
    val removeMillis: Long? = null,
    val maskVersion: Int = 0,
    val scenesVersion: Int = 0,
    val scene: SceneEntry? = null,
    val placement: Placement? = null,
    val options: CompositeOptions = CompositeOptions(),
    val result: Bitmap? = null,
    val composeMillis: Long? = null,
)

class ProductFlowViewModel(val deps: ProductFlowDeps) : ViewModel() {
    private val _state = MutableStateFlow(UiState())
    val state: StateFlow<UiState> = _state.asStateFlow()

    // edição de máscara (fora do UiState: arrays grandes e mutáveis)
    var source: Bitmap? = null; private set
    private var srcPixels = IntArray(0)
    private var alpha = ByteArray(0)
    var preview: Bitmap? = null; private set

    // produto recortado pela caixa da máscara, usado no posicionamento e na composição
    private var cropSource: Bitmap? = null
    private var cropMask: Mask? = null
    var cutoutPreview: Bitmap? = null; private set
    var sceneBitmap: Bitmap? = null; private set
    private var rawCenter = PointF()
    private var composeJob: Job? = null

    init {
        viewModelScope.launch { _state.update { it.copy(removerMode = deps.removerMode()) } }
        viewModelScope.launch(Dispatchers.IO) {
            val res = deps.scenes.syncRemoteStyles()
            if (res.isSuccess && (res.getOrNull() ?: 0) > 0) {
                _state.update { it.copy(scenesVersion = it.scenesVersion + 1) }
            }
        }
    }

    fun setCategory(c: ProductCategory) = _state.update { it.copy(category = c) }

    fun setRemoverMode(m: RemoverMode) {
        _state.update { it.copy(removerMode = m) }
        viewModelScope.launch { deps.setRemoverMode(m) }
    }

    fun dismissMessage() = _state.update { it.copy(message = null) }

    fun showMessage(text: String) = _state.update { it.copy(message = text) }

    fun back(): Boolean {
        val prev = when (_state.value.step) {
            Step.CATEGORY -> return false
            Step.MASK -> Step.CATEGORY
            Step.SCENE -> Step.MASK
            Step.POSITION -> Step.SCENE
            Step.RESULT -> Step.POSITION
        }
        composeJob?.cancel()
        _state.update { it.copy(step = prev, busy = null) }
        return true
    }

    fun restart() {
        composeJob?.cancel()
        _state.update { UiState(category = it.category, removerMode = it.removerMode) }
    }

    /** Foto escolhida → remover fundo. */
    fun onImagePicked(uri: Uri) = viewModelScope.launch {
        _state.update { it.copy(busy = "Abrindo foto…") }
        try {
            val bmp = deps.decode(uri)
            source = bmp
            srcPixels = IntArray(bmp.width * bmp.height).also { bmp.getPixels(it, 0, bmp.width, 0, 0, bmp.width, bmp.height) }
            runRemover()
        } catch (e: CancellationException) {
            throw e
        } catch (e: Exception) {
            _state.update { it.copy(busy = null, message = "Não foi possível abrir a foto: ${e.message}") }
        }
    }

    fun rerunRemover() = viewModelScope.launch { if (source != null) runRemover() }

    private suspend fun runRemover() {
        val src = source ?: return
        _state.update { it.copy(busy = "Removendo fundo…") }
        try {
            val t0 = System.currentTimeMillis()
            val mask = deps.remover.removeBackground(RgbaImage(src))
            val dt = System.currentTimeMillis() - t0
            alpha = mask.toPlane(src.width, src.height).let { p -> ByteArray(p.size) { (p[it] * 255f + .5f).toInt().toByte() } }
            preview = withContext(Dispatchers.Default) { cutout(src, Mask(src.width, src.height, alpha)) }
                .let { if (it.isMutable) it else it.copy(Bitmap.Config.ARGB_8888, true) }
            _state.update {
                it.copy(step = Step.MASK, busy = null, servedBy = deps.removerServedBy.value, removeMillis = dt,
                    maskVersion = it.maskVersion + 1)
            }
        } catch (e: CancellationException) {
            throw e
        } catch (e: AiError.Unavailable) {
            val ram = e.missing.filterIsInstance<Requirement.MinRamMb>().firstOrNull()
            val text = if (e.missing.any { it is Requirement.Model }) {
                "Modelo de recorte não baixado: baixe em Modelos de IA, na tela inicial."
            } else if (ram != null) {
                "Este aparelho tem pouca memória para esse recorte (pede ${ram.mb / 1024} GB de RAM). Use Automático."
            } else {
                "Nenhum removedor de fundo disponível (${e.missing.joinToString()})"
            }
            _state.update { it.copy(busy = null, message = text) }
        } catch (e: Exception) {
            _state.update { it.copy(busy = null, message = "Falha ao remover o fundo: ${e.message}") }
        }
    }

    /** Pincel do editor de máscara, em pixels da foto. restore=true pinta de volta o produto. */
    fun paint(cx: Float, cy: Float, radius: Float, restore: Boolean) {
        val src = source ?: return
        val pv = preview ?: return
        val w = src.width
        val h = src.height
        val x0 = (cx - radius - 1).toInt().coerceAtLeast(0)
        val y0 = (cy - radius - 1).toInt().coerceAtLeast(0)
        val x1 = (cx + radius + 1).toInt().coerceAtMost(w - 1)
        val y1 = (cy + radius + 1).toInt().coerceAtMost(h - 1)
        if (x1 < x0 || y1 < y0) return
        val rw = x1 - x0 + 1
        val dirty = IntArray(rw * (y1 - y0 + 1))
        for (y in y0..y1) for (x in x0..x1) {
            val i = y * w + x
            val d = kotlin.math.hypot(x + .5f - cx, y + .5f - cy)
            val cover = (radius + .5f - d).coerceIn(0f, 1f) // borda de 1 px
            var a = alpha[i].toInt() and 0xFF
            a = if (restore) maxOf(a, (cover * 255).toInt()) else min(a, ((1 - cover) * 255).toInt())
            alpha[i] = a.toByte()
            dirty[(y - y0) * rw + (x - x0)] = (a shl 24) or (srcPixels[i] and 0xFFFFFF)
        }
        pv.setPixels(dirty, 0, rw, x0, y0, rw, y1 - y0 + 1)
        _state.update { it.copy(maskVersion = it.maskVersion + 1) }
    }

    /** Fim da edição da máscara → recorta pela caixa do produto e vai para os cenários. */
    fun confirmMask() {
        val src = source ?: return
        val plane = Mask(src.width, src.height, alpha).toPlane()
        val roi = Roi.of(plane, src.width, src.height, 0.02f)
        if (roi.isEmpty) {
            _state.update { it.copy(message = "A máscara está vazia: restaure o produto com o pincel.") }
            return
        }
        val crop = Bitmap.createBitmap(src, roi.x0, roi.y0, roi.width, roi.height)
        val cropAlpha = ByteArray(roi.width * roi.height)
        for (y in 0 until roi.height) System.arraycopy(alpha, (roi.y0 + y) * src.width + roi.x0, cropAlpha, y * roi.width, roi.width)
        cropSource = crop
        cropMask = Mask(roi.width, roi.height, cropAlpha)
        cutoutPreview = cutout(crop, cropMask!!)
        _state.update { it.copy(step = Step.SCENE) }
    }

    fun selectScene(entry: SceneEntry) = viewModelScope.launch {
        _state.update { it.copy(busy = "Carregando cenário…") }
        val bmp = withContext(Dispatchers.IO) { deps.scenes.image(entry) }
        sceneBitmap = bmp
        val crop = cropSource!!
        val meta = entry.meta.toMeta()
        // tamanho inicial: o produto ocupa ~40% da altura ou ~45% da largura, com a base no chão
        val scale = min(0.40f * bmp.height / crop.height, 0.45f * bmp.width / crop.width)
        val cx = (meta.placement.left + meta.placement.right) / 2f * bmp.width
        val cy = meta.floorY * bmp.height - crop.height * scale / 2f
        rawCenter = PointF(cx, cy)
        _state.update { it.copy(step = Step.POSITION, busy = null, scene = entry, placement = Placement(PointF(cx, cy), scale, 0f)) }
    }

    /** Gesto de posicionamento em pixels do cenário. */
    fun transform(panX: Float, panY: Float, zoom: Float, rotationDeg: Float) {
        val p = _state.value.placement ?: return
        val scene = _state.value.scene ?: return
        val bmp = sceneBitmap ?: return
        val crop = cropSource ?: return
        rawCenter = PointF(rawCenter.x + panX, rawCenter.y + panY)
        val scale = (p.scale * zoom).coerceIn(0.02f, 8f)
        val rot = p.rotationDeg + rotationDeg
        // ímã na linha do chão: a base do produto gruda no floorY se estiver a menos de 2,5% da altura
        val floor = scene.meta.floorY * bmp.height
        val bottom = rawCenter.y + crop.height * scale / 2f
        val cy = if (abs(bottom - floor) < 0.025f * bmp.height) floor - crop.height * scale / 2f else rawCenter.y
        _state.update { it.copy(placement = Placement(PointF(rawCenter.x, cy), scale, rot)) }
    }

    fun compose() {
        _state.update { it.copy(step = Step.RESULT) }
        recompose()
    }

    fun setOptions(o: CompositeOptions) = _state.update { it.copy(options = o) }

    fun recompose() {
        val s = _state.value
        val entry = s.scene ?: return
        val placement = s.placement ?: return
        val crop = cropSource ?: return
        val mask = cropMask ?: return
        val scene = sceneBitmap ?: return
        composeJob?.cancel()
        composeJob = viewModelScope.launch {
            _state.update { it.copy(busy = "Compondo…") }
            try {
                val t0 = System.currentTimeMillis()
                val out = deps.composer.compose(
                    RgbaImage(crop), mask, Scene(entry.id, RgbaImage(scene), entry.meta.toMeta()), placement, s.options,
                )
                _state.update { it.copy(busy = null, result = out.bitmap, composeMillis = System.currentTimeMillis() - t0) }
            } catch (e: CancellationException) {
                throw e
            } catch (e: Exception) {
                _state.update { it.copy(busy = null, message = "Falha na composição: ${e.message}") }
            }
        }
    }

    fun openInEditor() = viewModelScope.launch {
        val bmp = _state.value.result ?: return@launch
        try {
            deps.openInEditor(bmp)
        } catch (e: CancellationException) {
            throw e
        } catch (e: Exception) {
            _state.update { it.copy(message = "Falha ao abrir no editor: ${e.message}") }
        }
    }

    fun export(format: ExportFormat) = viewModelScope.launch {
        val bmp = _state.value.result ?: return@launch
        _state.update { it.copy(busy = "Exportando…") }
        try {
            val where = deps.export(bmp, format)
            _state.update { it.copy(busy = null, message = "Salvo em $where") }
        } catch (e: CancellationException) {
            throw e
        } catch (e: Exception) {
            _state.update { it.copy(busy = null, message = "Falha ao exportar: ${e.message}") }
        }
    }
}
