package com.productphoto.feature.product

import android.content.ActivityNotFoundException
import android.graphics.Bitmap
import android.net.Uri
import androidx.activity.compose.BackHandler
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.PickVisualMediaRequest
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.awaitEachGesture
import androidx.compose.foundation.gestures.awaitFirstDown
import androidx.compose.foundation.gestures.calculateCentroid
import androidx.compose.foundation.gestures.calculatePan
import androidx.compose.foundation.gestures.calculateZoom
import androidx.compose.foundation.gestures.detectTransformGestures
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.Button
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Slider
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.produceState
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.clipToBounds
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.FilterQuality
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.withTransform
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.IntSize
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.productphoto.ai.api.CompositeOptions
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlin.math.min
import kotlin.math.roundToInt

private fun DrawScope.drawBitmapFit(bmp: Bitmap, fit: Fit) = drawImage(
    bmp.asImageBitmap(),
    dstOffset = IntOffset(fit.left.roundToInt(), fit.top.roundToInt()),
    dstSize = IntSize((bmp.width * fit.scale).roundToInt(), (bmp.height * fit.scale).roundToInt()),
    filterQuality = FilterQuality.Medium,
)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ProductFlowScreen(vm: ProductFlowViewModel) {
    val state by vm.state.collectAsStateWithLifecycle()
    val snackbar = remember { SnackbarHostState() }
    LaunchedEffect(state.message) {
        state.message?.let { snackbar.showSnackbar(it); vm.dismissMessage() }
    }
    BackHandler(enabled = state.step != Step.CATEGORY) { vm.back() }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Text(
                        when (state.step) {
                            Step.CATEGORY -> "Foto de produto"
                            Step.MASK -> "Ajustar recorte"
                            Step.SCENE -> "Escolher cenário"
                            Step.POSITION -> "Posicionar"
                            Step.RESULT -> "Resultado"
                        },
                    )
                },
                navigationIcon = {
                    if (state.step != Step.CATEGORY) {
                        IconButton(onClick = { vm.back() }) { Icon(Icons.AutoMirrored.Filled.ArrowBack, "Voltar") }
                    }
                },
            )
        },
        snackbarHost = { SnackbarHost(snackbar) },
    ) { pad ->
        Column(Modifier.padding(pad).fillMaxSize()) {
            state.busy?.let {
                LinearProgressIndicator(Modifier.fillMaxWidth())
                Text(it, Modifier.padding(horizontal = 16.dp, vertical = 4.dp), style = MaterialTheme.typography.bodySmall)
            }
            when (state.step) {
                Step.CATEGORY -> CategoryStep(vm, state)
                Step.MASK -> MaskStep(vm, state)
                Step.SCENE -> SceneStep(vm, state)
                Step.POSITION -> PositionStep(vm, state)
                Step.RESULT -> ResultStep(vm, state)
            }
        }
    }
}

@Composable
private fun CategoryStep(vm: ProductFlowViewModel, state: UiState) {
    val picker = rememberLauncherForActivityResult(ActivityResultContracts.PickVisualMedia()) { uri ->
        uri?.let(vm::onImagePicked)
    }
    // a câmera grava no Uri que passamos; ele sobrevive à recriação da Activity enquanto a câmera está aberta
    var pendingCapture by rememberSaveable { mutableStateOf<Uri?>(null) }
    val camera = rememberLauncherForActivityResult(ActivityResultContracts.TakePicture()) { ok ->
        val uri = pendingCapture
        pendingCapture = null
        if (ok && uri != null) vm.onImagePicked(uri)
    }
    Column(Modifier.padding(16.dp).verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Text("Categoria do produto", style = MaterialTheme.typography.titleMedium)
        LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            items(ProductCategory.entries) { c ->
                FilterChip(selected = state.category == c, onClick = { vm.setCategory(c) }, label = { Text(c.label) })
            }
        }
        Text("Removedor de fundo", style = MaterialTheme.typography.titleMedium)
        LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            items(RemoverMode.entries) { m ->
                FilterChip(selected = state.removerMode == m, onClick = { vm.setRemoverMode(m) }, label = { Text(m.label) })
            }
        }
        Text(
            "Automático: ML Kit quando há Google Play services, senão u2netp (empacotado). Tudo roda no aparelho.",
            style = MaterialTheme.typography.bodySmall,
        )
        Spacer(Modifier.height(8.dp))
        Button(
            onClick = { picker.launch(PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly)) },
            enabled = state.busy == null,
            modifier = Modifier.fillMaxWidth(),
        ) { Text("Escolher foto do produto") }
        OutlinedButton(
            onClick = {
                val uri = vm.deps.newCaptureUri()
                pendingCapture = uri
                try {
                    camera.launch(uri)
                } catch (e: ActivityNotFoundException) {
                    pendingCapture = null
                    vm.showMessage("Nenhum app de câmera encontrado.")
                }
            },
            enabled = state.busy == null,
            modifier = Modifier.fillMaxWidth(),
        ) { Text("Tirar foto") }
    }
}

private fun DrawScope.checkerboard(fit: Fit, w: Int, h: Int) {
    val cell = 12.dp.toPx()
    val left = fit.left
    val top = fit.top
    val right = left + w * fit.scale
    val bottom = top + h * fit.scale
    drawRect(Color(0xFFEEEEEE), Offset(left, top), Size(right - left, bottom - top))
    var y = top
    var row = 0
    while (y < bottom) {
        var x = left + if (row % 2 == 0) 0f else cell
        while (x < right) {
            drawRect(Color(0xFFCCCCCC), Offset(x, y), Size(min(cell, right - x), min(cell, bottom - y)))
            x += cell * 2
        }
        y += cell
        row++
    }
}

@Composable
private fun MaskStep(vm: ProductFlowViewModel, state: UiState) {
    val preview = vm.preview ?: return
    var restore by remember { mutableStateOf(false) }
    var brushDp by remember { mutableFloatStateOf(24f) }
    var fit by remember { mutableStateOf(Fit(1f, 0f, 0f)) }
    var viewport by remember { mutableStateOf(MaskViewport()) }
    var lastTapAt by remember { mutableLongStateOf(0L) }

    Column(Modifier.fillMaxSize()) {
        Canvas(
            Modifier.weight(1f).fillMaxWidth().clipToBounds().background(Color(0xFF303030))
                .pointerInput(restore, brushDp) {
                    fun paintAt(p: Offset) {
                        val f = fit
                        val v = viewport
                        vm.paint(v.toImageX(p.x, f), v.toImageY(p.y, f), v.brushRadius(brushDp.dp.toPx(), f), restore)
                    }
                    // 1 dedo pinta depois do touch slop (toque parado não pinta, como antes); 2 dedos: pan/zoom
                    // até soltar tudo; toque duplo sem arrastar volta a 1× (ARQUITETURA §17.2).
                    awaitEachGesture {
                        val down = awaitFirstDown(requireUnconsumed = false)
                        var painting = false
                        var transforming = false
                        var upAt = down.uptimeMillis
                        do {
                            val event = awaitPointerEvent()
                            if (event.changes.count { it.pressed } >= 2) transforming = true
                            if (transforming) {
                                val c = event.calculateCentroid(useCurrent = true)
                                if (c != Offset.Unspecified) {
                                    val pan = event.calculatePan()
                                    viewport = viewport.transform(
                                        c.x, c.y, pan.x, pan.y, event.calculateZoom(), size.width.toFloat(), size.height.toFloat(),
                                    )
                                }
                                event.changes.forEach { it.consume() }
                            } else {
                                val ch = event.changes.firstOrNull { it.id == down.id } ?: break
                                if (!painting && (ch.position - down.position).getDistance() > viewConfiguration.touchSlop) {
                                    painting = true
                                    paintAt(down.position)
                                }
                                if (painting && ch.pressed) {
                                    paintAt(ch.position)
                                    ch.consume()
                                }
                                upAt = ch.uptimeMillis
                            }
                        } while (event.changes.any { it.pressed })
                        if (!painting && !transforming) {
                            if (down.uptimeMillis - lastTapAt < viewConfiguration.doubleTapTimeoutMillis) {
                                viewport = MaskViewport()
                                lastTapAt = 0L
                            } else if (upAt - down.uptimeMillis < viewConfiguration.longPressTimeoutMillis) {
                                lastTapAt = upAt
                            }
                        }
                    }
                },
        ) {
            fit = Fit.of(size.width, size.height, preview.width, preview.height)
            @Suppress("UNUSED_EXPRESSION") state.maskVersion // redesenha a cada pincelada
            val v = viewport
            withTransform({
                translate(v.offsetX, v.offsetY)
                scale(v.zoom, v.zoom, Offset.Zero)
            }) {
                checkerboard(fit, preview.width, preview.height)
                drawBitmapFit(preview, fit)
            }
        }
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            state.servedBy?.let {
                Text(
                    "Recorte: ${it.displayName}${if (it.isLocal) " · no aparelho" else ""}" +
                        (state.removeMillis?.let { ms -> " · $ms ms" } ?: ""),
                    style = MaterialTheme.typography.bodySmall,
                )
            }
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                FilterChip(selected = !restore, onClick = { restore = false }, label = { Text("Apagar") })
                FilterChip(selected = restore, onClick = { restore = true }, label = { Text("Restaurar") })
                Text("Pincel", Modifier.padding(start = 8.dp))
                Slider(brushDp, { brushDp = it }, valueRange = 6f..80f, modifier = Modifier.weight(1f))
            }
            Text(
                "Um dedo pinta; dois dedos aproximam e movem; toque duplo volta ao tamanho inteiro" +
                    if (viewport.zoom > 1.01f) " · ${(viewport.zoom * 10).roundToInt() / 10f}×" else "",
                style = MaterialTheme.typography.bodySmall,
            )
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedButton(onClick = { vm.rerunRemover() }, enabled = state.busy == null) { Text("Refazer recorte") }
                Button(onClick = { vm.confirmMask() }, enabled = state.busy == null, modifier = Modifier.weight(1f)) { Text("Avançar") }
            }
        }
    }
}

@Composable
private fun SceneStep(vm: ProductFlowViewModel, state: UiState) {
    val scenes = remember(state.category) { vm.deps.scenes.byCategory(state.category) }
    LazyVerticalGrid(
        columns = GridCells.Adaptive(150.dp),
        contentPadding = PaddingValues(12.dp),
        horizontalArrangement = Arrangement.spacedBy(12.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        items(scenes, key = { it.id }) { e ->
            val thumb by produceState<Bitmap?>(null, e.id) { value = withContext(Dispatchers.IO) { vm.deps.scenes.thumb(e) } }
            Column(Modifier.clickable(enabled = state.busy == null) { vm.selectScene(e) }) {
                thumb?.let {
                    Image(
                        it.asImageBitmap(), e.id, contentScale = ContentScale.Crop,
                        modifier = Modifier.fillMaxWidth().aspectRatio(1f).clip(RoundedCornerShape(8.dp)),
                    )
                } ?: Box(Modifier.fillMaxWidth().aspectRatio(1f).background(Color.LightGray))
                Text(e.id.replace('_', ' '), style = MaterialTheme.typography.bodySmall)
            }
        }
    }
}

@Composable
private fun PositionStep(vm: ProductFlowViewModel, state: UiState) {
    val scene = vm.sceneBitmap ?: return
    val product = vm.cutoutPreview ?: return
    val placement = state.placement ?: return
    val floorY = state.scene?.meta?.floorY ?: return
    var fit by remember { mutableStateOf(Fit(1f, 0f, 0f)) }

    Column(Modifier.fillMaxSize()) {
        Canvas(
            Modifier.weight(1f).fillMaxWidth().background(Color(0xFF202020))
                .pointerInput(Unit) {
                    detectTransformGestures { _, pan, zoom, rotation ->
                        vm.transform(pan.x / fit.scale, pan.y / fit.scale, zoom, rotation)
                    }
                },
        ) {
            fit = Fit.of(size.width, size.height, scene.width, scene.height)
            drawBitmapFit(scene, fit)
            val fy = fit.top + floorY * scene.height * fit.scale
            drawLine(
                Color(0xAAFFFFFF), Offset(fit.left, fy), Offset(fit.left + scene.width * fit.scale, fy), 2f,
                pathEffect = PathEffect.dashPathEffect(floatArrayOf(16f, 12f)),
            )
            val c = Offset(fit.left + placement.center.x * fit.scale, fit.top + placement.center.y * fit.scale)
            val w = product.width * placement.scale * fit.scale
            val h = product.height * placement.scale * fit.scale
            withTransform({ rotate(placement.rotationDeg, c) }) {
                drawImage(
                    product.asImageBitmap(),
                    dstOffset = IntOffset((c.x - w / 2).roundToInt(), (c.y - h / 2).roundToInt()),
                    dstSize = IntSize(w.roundToInt().coerceAtLeast(1), h.roundToInt().coerceAtLeast(1)),
                    filterQuality = FilterQuality.Medium,
                )
            }
        }
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text(
                "Arraste para mover, pinça para escalar e girar. A base gruda na linha do chão.",
                style = MaterialTheme.typography.bodySmall,
            )
            Button(onClick = { vm.compose() }, modifier = Modifier.fillMaxWidth()) { Text("Compor") }
        }
    }
}

@Composable
private fun ResultStep(vm: ProductFlowViewModel, state: UiState) {
    Column(Modifier.fillMaxSize()) {
        Box(Modifier.weight(1f).fillMaxWidth().background(Color(0xFF202020)), contentAlignment = Alignment.Center) {
            state.result?.let { Image(it.asImageBitmap(), "resultado", contentScale = ContentScale.Fit, modifier = Modifier.fillMaxSize()) }
        }
        Column(Modifier.padding(horizontal = 16.dp, vertical = 8.dp).verticalScroll(rememberScrollState())) {
            state.composeMillis?.let { Text("Composição: $it ms", style = MaterialTheme.typography.bodySmall) }
            val o = state.options
            OptionSlider("Sombra de contato", o.contactShadow, { vm.setOptions(o.copy(contactShadow = it)) }, vm::recompose)
            OptionSlider("Sombra projetada", o.castShadow, { vm.setOptions(o.copy(castShadow = it)) }, vm::recompose)
            OptionSlider("Harmonização de cor", o.harmonize, { vm.setOptions(o.copy(harmonize = it)) }, vm::recompose)
            OptionSlider("Luz de borda", o.lightWrap, { vm.setOptions(o.copy(lightWrap = it)) }, vm::recompose)
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedButton(onClick = { vm.setOptions(CompositeOptions()); vm.recompose() }) { Text("Padrão") }
                Button(onClick = { vm.export(ExportFormat.PNG) }, enabled = state.busy == null && state.result != null) { Text("PNG") }
                Button(onClick = { vm.export(ExportFormat.JPG) }, enabled = state.busy == null && state.result != null) { Text("JPG") }
                OutlinedButton(onClick = { vm.restart() }) { Text("Nova") }
            }
            Button(onClick = { vm.openInEditor() }, enabled = state.busy == null && state.result != null) { Text("Abrir no editor") }
        }
    }
}

@Composable
private fun OptionSlider(label: String, value: Float, onChange: (Float) -> Unit, onDone: () -> Unit) {
    Row(verticalAlignment = Alignment.CenterVertically) {
        Text(label, Modifier.width(150.dp), style = MaterialTheme.typography.bodyMedium)
        Slider(value, onChange, onValueChangeFinished = onDone, modifier = Modifier.weight(1f))
    }
}
