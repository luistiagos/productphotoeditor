package com.productphoto.feature.mockup

import android.graphics.Bitmap
import android.graphics.ImageDecoder
import android.net.Uri
import androidx.activity.compose.BackHandler
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.PickVisualMediaRequest
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectTransformGestures
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.runtime.snapshots.SnapshotStateList
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.layout.onSizeChanged
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.IntSize
import androidx.compose.ui.unit.dp
import com.productphoto.ai.api.MockupRenderer
import com.productphoto.ai.api.MockupTemplate
import com.productphoto.ai.api.RgbaImage
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import kotlin.math.max
import kotlin.math.min
import kotlin.math.roundToInt

/** O que a tela precisa do app (sem depender do :editor). */
class MockupDeps(
    val library: MockupLibrary,
    val renderer: MockupRenderer,
    /** Grava o PNG na galeria; devolve onde ficou. */
    val save: suspend (Bitmap) -> String?,
    val share: suspend (Bitmap) -> Unit,
    val openInEditor: suspend (Bitmap) -> Unit,
)

private const val MAX_DESIGN_SIDE = 2048

/** Mockup de superfícies planas (§20.4 item 11). [initial] (design vindo do editor) entra no espaço 1. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun MockupScreen(deps: MockupDeps, initial: Bitmap? = null) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    var entry by remember { mutableStateOf<MockupEntry?>(null) }
    var template by remember { mutableStateOf<MockupTemplate?>(null) }
    val designs = remember { mutableStateListOf<Bitmap?>() }
    val crops = remember { mutableStateListOf<CropState?>() }
    var adjusting by remember { mutableStateOf<Int?>(null) }
    var pickingSlot by remember { mutableStateOf(0) }
    var result by remember { mutableStateOf<Bitmap?>(null) }
    var busy by remember { mutableStateOf(false) }
    var isSyncing by remember { mutableStateOf(false) }
    var message by remember { mutableStateOf<String?>(null) }

    val pick = rememberLauncherForActivityResult(ActivityResultContracts.PickVisualMedia()) { uri: Uri? ->
        if (uri != null) scope.launch {
            runCatching { withContext(Dispatchers.IO) { decode(context, uri) } }
                .onSuccess { bmp -> designs[pickingSlot] = bmp; crops[pickingSlot] = CropState.initial(bmp.width, bmp.height) }
                .onFailure { message = "Imagem inválida: ${it.message}" }
        }
    }

    BackHandler(enabled = entry != null) {
        if (adjusting != null) adjusting = null else { entry = null; template = null; result = null }
    }

    // carrega o template escolhido e prepara os espaços
    LaunchedEffect(entry) {
        val e = entry ?: return@LaunchedEffect
        busy = true
        if (!deps.library.isDownloaded(e)) {
            message = "Baixando modelo do servidor..."
        }
        try {
            template = withContext(Dispatchers.IO) { deps.library.loadTemplate(e) }
            message = null
        } catch (ex: Exception) {
            message = "Erro ao carregar modelo: ${ex.message}"
            entry = null
            return@LaunchedEffect
        } finally {
            busy = false
        }
        designs.clear(); crops.clear()
        repeat(e.slots.size) { designs.add(null); crops.add(null) }
        if (initial != null) { designs[0] = initial; crops[0] = CropState.initial(initial.width, initial.height) }
    }

    // renderiza de novo sempre que um espaço muda
    val ready = template != null && designs.isNotEmpty() && designs.all { it != null }
    LaunchedEffect(template, designs.toList(), crops.toList()) {
        val t = template ?: return@LaunchedEffect
        val e = entry ?: return@LaunchedEffect
        if (designs.isEmpty() || designs.any { it == null }) { result = null; return@LaunchedEffect }
        busy = true
        try {
            val cut = designs.mapIndexed { i, d -> cropped(d!!, crops[i]!!, e.slots[i].aspect) }
            result = deps.renderer.render(cut.map { RgbaImage(it) }, t).bitmap
        } catch (c: CancellationException) {
            throw c
        } catch (ex: Exception) {
            message = "Não deu para montar o mockup: ${ex.message}"
        } finally {
            busy = false
        }
    }

    val adjustingSlot = adjusting
    val e = entry
    if (e != null && adjustingSlot != null && designs.getOrNull(adjustingSlot) != null) {
        AdjustScreen(designs[adjustingSlot]!!, crops[adjustingSlot]!!, e.slots[adjustingSlot].aspect) { done ->
            if (done != null) crops[adjustingSlot] = done
            adjusting = null
        }
        return
    }

    Scaffold(topBar = { TopAppBar(title = { Text(e?.name ?: "Mockup") }) }) { pad ->
        Column(
            Modifier.padding(pad).fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            if (e == null) {
                Row(
                    Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text("Escolha onde o seu design vai aparecer.", style = MaterialTheme.typography.bodyMedium)
                    TextButton(
                        enabled = !busy && !isSyncing,
                        onClick = {
                            scope.launch {
                                isSyncing = true
                                message = "Buscando modelos do servidor..."
                                deps.library.syncRemoteCatalog()
                                    .onSuccess { count ->
                                        message = "$count modelos sincronizados do catálogo online!"
                                    }
                                    .onFailure { err ->
                                        message = "Não foi possível sincronizar catálogo: ${err.message}"
                                    }
                                isSyncing = false
                            }
                        }
                    ) {
                        Text(if (isSyncing) "Sincronizando..." else "Buscar online")
                    }
                }
                if (isSyncing) LinearProgressIndicator(Modifier.fillMaxWidth())
                TemplateGrid(deps.library) { entry = it; message = null }
            } else {
                SlotList(e, designs, crops,
                    onPick = { i -> pickingSlot = i; pick.launch(PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly)) },
                    onAdjust = { i -> adjusting = i })
                if (busy) LinearProgressIndicator(Modifier.fillMaxWidth())
                result?.let { r ->
                    Image(r.asImageBitmap(), "mockup", Modifier.fillMaxWidth().aspectRatio(r.width.toFloat() / r.height), contentScale = ContentScale.Fit)
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        Button(enabled = !busy, onClick = { scope.launch { message = deps.save(r)?.let { "Salvo em $it" } ?: "Salvo" } }) { Text("Salvar") }
                        OutlinedButton(enabled = !busy, onClick = { scope.launch { deps.share(r) } }) { Text("Compartilhar") }
                        OutlinedButton(enabled = !busy, onClick = { scope.launch { deps.openInEditor(r) } }) { Text("Abrir no editor") }
                    }
                }
                if (!ready && !busy) Text("Escolha uma imagem para cada espaço.", style = MaterialTheme.typography.bodySmall)
            }
            message?.let { Text(it, style = MaterialTheme.typography.bodySmall) }
        }
    }
}

@Composable
private fun TemplateGrid(library: MockupLibrary, onChoose: (MockupEntry) -> Unit) {
    library.all.chunked(2).forEach { row ->
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            row.forEach { e ->
                val thumb = remember(e.id) { library.thumb(e).asImageBitmap() }
                Card(Modifier.weight(1f).clickable { onChoose(e) }) {
                    Box {
                        Image(thumb, e.name, Modifier.fillMaxWidth().aspectRatio(1f), contentScale = ContentScale.Fit)
                        if (!library.isDownloaded(e)) {
                            Text(
                                "Online",
                                Modifier
                                    .align(Alignment.TopEnd)
                                    .padding(6.dp)
                                    .background(
                                        MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.9f),
                                        shape = MaterialTheme.shapes.extraSmall
                                    )
                                    .padding(horizontal = 6.dp, vertical = 2.dp),
                                style = MaterialTheme.typography.labelSmall,
                                color = MaterialTheme.colorScheme.onPrimaryContainer
                            )
                        }
                    }
                    Text(e.name, Modifier.padding(8.dp), style = MaterialTheme.typography.titleSmall)
                }
            }
            if (row.size == 1) Spacer(Modifier.weight(1f))
        }
    }
}


@Composable
private fun SlotList(
    e: MockupEntry,
    designs: SnapshotStateList<Bitmap?>,
    crops: SnapshotStateList<CropState?>,
    onPick: (Int) -> Unit,
    onAdjust: (Int) -> Unit,
) {
    e.slots.indices.forEach { i ->
        val d = designs.getOrNull(i)
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Text(if (e.slots.size > 1) "Espaço ${i + 1}" else "Imagem", Modifier.weight(1f))
            val c = crops.getOrNull(i)
            if (d != null && c != null) {
                val preview = remember(d, c) { cropped(d, c, e.slots[i].aspect, 160).asImageBitmap() }
                Image(preview, "imagem do espaço", Modifier.size(56.dp), contentScale = ContentScale.Fit)
            }
            OutlinedButton(onClick = { onPick(i) }) { Text(if (d == null) "Escolher imagem" else "Trocar") }
            if (d != null) TextButton(onClick = { onAdjust(i) }) { Text("Ajustar") }
        }
    }
}

/** Recorte com proporção travada: a imagem anda atrás de uma moldura fixa (pinça e arrasto). */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun AdjustScreen(image: Bitmap, start: CropState, aspect: Float, onDone: (CropState?) -> Unit) {
    var state by remember { mutableStateOf(start) }
    var canvas by remember { mutableStateOf(IntSize.Zero) }
    val bmp = remember(image) { image.asImageBitmap() }
    BackHandler { onDone(null) }
    fun frame(): Pair<Offset, Size> {
        val pad = 32f
        val w = canvas.width - 2 * pad
        val h = canvas.height - 2 * pad
        val fw = min(w, h * aspect)
        val fh = fw / aspect
        return Offset((canvas.width - fw) / 2, (canvas.height - fh) / 2) to Size(fw, fh)
    }
    Scaffold(topBar = { TopAppBar(title = { Text("Ajustar") }) }) { pad ->
    Column(Modifier.padding(pad).fillMaxSize()) {
        Box(
            Modifier.weight(1f).fillMaxWidth().onSizeChanged { canvas = it }.pointerInput(image, aspect) {
                detectTransformGestures { _, pan, zoom, _ ->
                    val r = state.rect(image.width, image.height, aspect)
                    val k = frame().second.width / r.width
                    state = state.gesture(pan.x, pan.y, zoom, k, image.width, image.height, aspect)
                }
            },
        ) {
            Canvas(Modifier.fillMaxSize()) {
                if (canvas == IntSize.Zero) return@Canvas
                val (fo, fs) = frame()
                val r = state.rect(image.width, image.height, aspect)
                val k = fs.width / r.width
                drawImage(
                    bmp, srcOffset = IntOffset.Zero, srcSize = IntSize(image.width, image.height),
                    dstOffset = IntOffset((fo.x - r.x * k).roundToInt(), (fo.y - r.y * k).roundToInt()),
                    dstSize = IntSize(max(1, (image.width * k).roundToInt()), max(1, (image.height * k).roundToInt())),
                )
                val dim = Color.Black.copy(alpha = .6f)
                drawRect(dim, Offset.Zero, Size(size.width, fo.y))
                drawRect(dim, Offset(0f, fo.y + fs.height), Size(size.width, size.height - fo.y - fs.height))
                drawRect(dim, Offset(0f, fo.y), Size(fo.x, fs.height))
                drawRect(dim, Offset(fo.x + fs.width, fo.y), Size(size.width - fo.x - fs.width, fs.height))
                drawRect(Color.White, fo, fs, style = Stroke(2f))
            }
        }
        Row(Modifier.fillMaxWidth().padding(16.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Text("Pinça para zoom, arraste para mover", Modifier.weight(1f).align(Alignment.CenterVertically), style = MaterialTheme.typography.bodySmall)
            TextButton(onClick = { state = CropState.initial(image.width, image.height) }) { Text("Centralizar") }
            Button(onClick = { onDone(state) }) { Text("Concluir") }
        }
    }
    }
}

/** Recorte do estado (proporção do espaço), reduzido para no máximo [maxSide] de lado. */
private fun cropped(src: Bitmap, s: CropState, aspect: Float, maxSide: Int = MAX_DESIGN_SIDE): Bitmap {
    val r = s.rect(src.width, src.height, aspect)
    val cut = Bitmap.createBitmap(src, r.x, r.y, min(r.width, src.width - r.x), min(r.height, src.height - r.y))
    val scale = maxSide.toFloat() / max(cut.width, cut.height)
    return if (scale >= 1f) cut
    else Bitmap.createScaledBitmap(cut, max(1, (cut.width * scale).roundToInt()), max(1, (cut.height * scale).roundToInt()), true)
}

private fun decode(context: android.content.Context, uri: Uri): Bitmap {
    val bmp = ImageDecoder.decodeBitmap(ImageDecoder.createSource(context.contentResolver, uri)) { d, info, _ ->
        d.allocator = ImageDecoder.ALLOCATOR_SOFTWARE
        val side = max(info.size.width, info.size.height)
        if (side > MAX_DESIGN_SIDE * 2) {
            val k = MAX_DESIGN_SIDE * 2f / side
            d.setTargetSize(max(1, (info.size.width * k).toInt()), max(1, (info.size.height * k).toInt()))
        }
    }
    return if (bmp.config == Bitmap.Config.ARGB_8888) bmp else bmp.copy(Bitmap.Config.ARGB_8888, false)
}
