package com.productphoto.app

import android.app.Activity
import android.content.Context
import android.content.ContextWrapper
import android.graphics.Bitmap
import android.graphics.ImageDecoder
import android.net.Uri
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.PickVisualMediaRequest
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.core.content.FileProvider
import com.productphoto.ai.api.AiError
import com.productphoto.ai.api.Progress
import com.productphoto.ai.api.RgbaImage
import com.productphoto.editor.EditorExports
import com.productphoto.editor.ExportFormat
import com.productphoto.imaging.UPSCALE_MAX_INPUT_PIXELS
import com.productphoto.imaging.cutout
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.io.ByteArrayOutputStream
import java.io.File
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import kotlin.math.min
import kotlin.math.sqrt

private const val QUICK_TOOL_MAX_SIDE = 2048

/** Decodifica imagem escolhida em ARGB_8888 de software respeitando um teto de lado. */
private suspend fun decodeSoftwareBitmap(context: Context, uri: Uri, maxSide: Int = QUICK_TOOL_MAX_SIDE): Bitmap =
    withContext(Dispatchers.IO) {
        val source = ImageDecoder.createSource(context.contentResolver, uri)
        val bmp = ImageDecoder.decodeBitmap(source) { decoder, info, _ ->
            decoder.allocator = ImageDecoder.ALLOCATOR_SOFTWARE
            decoder.isMutableRequired = false
            val side = maxOf(info.size.width, info.size.height)
            if (side > maxSide) {
                val scale = maxSide.toFloat() / side
                decoder.setTargetSize((info.size.width * scale).toInt(), (info.size.height * scale).toInt())
            }
        }
        if (bmp.config == Bitmap.Config.ARGB_8888) bmp else bmp.copy(Bitmap.Config.ARGB_8888, false)
    }

/** Garante entrada <= 1 MP (limite do Real-ESRGAN no aparelho) mantendo a proporção. */
private fun fitWithinMaxPixels(bmp: Bitmap, maxPixels: Long = UPSCALE_MAX_INPUT_PIXELS): Bitmap {
    val total = bmp.width.toLong() * bmp.height
    if (total <= maxPixels) return bmp
    val scale = sqrt(maxPixels.toDouble() / total.toDouble())
    val w = (bmp.width * scale).toInt().coerceAtLeast(1)
    val h = (bmp.height * scale).toInt().coerceAtLeast(1)
    return Bitmap.createScaledBitmap(bmp, w, h, true)
}

private fun newTempCaptureUri(context: Context): Uri {
    val dir = File(context.cacheDir, "capture").apply { mkdirs() }
    dir.listFiles()?.forEach { it.delete() }
    val file = File(dir, "quick_" + System.currentTimeMillis() + ".jpg")
    return FileProvider.getUriForFile(context, "${context.packageName}.editor.files", file)
}

private suspend fun bitmapToPng(bitmap: Bitmap): ByteArray = withContext(Dispatchers.Default) {
    ByteArrayOutputStream().use { out ->
        check(bitmap.compress(Bitmap.CompressFormat.PNG, 100, out)) { "Falha ao codificar PNG" }
        out.toByteArray()
    }
}

private fun timestampName(prefix: String): String =
    prefix + "_" + SimpleDateFormat("yyyyMMdd_HHmmss", Locale.US).format(Date())

@Composable
private fun CheckerboardPreview(
    bitmap: Bitmap,
    contentDescription: String,
    modifier: Modifier = Modifier,
) {
    val lightCell = MaterialTheme.colorScheme.surfaceContainerHigh
    val darkCell = MaterialTheme.colorScheme.surfaceContainerHighest
    Box(
        modifier = modifier
            .fillMaxWidth()
            .aspectRatio((bitmap.width.toFloat() / bitmap.height.coerceAtLeast(1)).coerceIn(0.6f, 1.8f))
            .clip(RoundedCornerShape(16.dp)),
        contentAlignment = Alignment.Center,
    ) {
        Canvas(Modifier.fillMaxSize()) {
            val cell = 24f
            var y = 0f
            var row = 0
            while (y < size.height) {
                var x = 0f
                var col = row % 2
                while (x < size.width) {
                    drawRect(
                        color = if (col % 2 == 0) lightCell else darkCell,
                        topLeft = Offset(x, y),
                        size = Size(min(cell, size.width - x), min(cell, size.height - y)),
                    )
                    x += cell
                    col++
                }
                y += cell
                row++
            }
        }
        Image(
            bitmap = bitmap.asImageBitmap(),
            contentDescription = contentDescription,
            modifier = Modifier.fillMaxSize(),
            contentScale = ContentScale.Fit,
        )
    }
}

private tailrec fun Context.findActivity(): Activity? = when (this) {
    is Activity -> this
    is ContextWrapper -> baseContext.findActivity()
    else -> null
}

@Composable
private fun QuickToolExportBar(
    bitmap: Bitmap,
    namePrefix: String,
    busy: Boolean,
    onStatus: (String) -> Unit,
    onOpenEditor: suspend (Bitmap) -> Unit,
) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val activity = remember(context) { context.findActivity() }
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Button(
                onClick = {
                    scope.launch {
                        val bytes = bitmapToPng(bitmap)
                        val path = EditorExports.save(context, ExportFormat.PNG, timestampName(namePrefix), bytes)
                        onStatus("Salvo em $path")
                    }
                },
                enabled = !busy,
                modifier = Modifier.weight(1f),
            ) {
                Text("Salvar PNG")
            }
            OutlinedButton(
                onClick = {
                    val host = activity ?: return@OutlinedButton
                    scope.launch {
                        val bytes = bitmapToPng(bitmap)
                        EditorExports.share(host, ExportFormat.PNG, timestampName(namePrefix), bytes)
                    }
                },
                enabled = !busy && activity != null,
                modifier = Modifier.weight(1f),
            ) {
                Text("Compartilhar")
            }
        }
        OutlinedButton(
            onClick = { scope.launch { onOpenEditor(bitmap) } },
            enabled = !busy,
            modifier = Modifier.fillMaxWidth(),
        ) {
            Text("Abrir no Editor")
        }
    }
}

/** Ferramenta rápida: remoção de fundo 100% offline com exportação PNG transparente. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun QuickBgRemoverScreen(
    graph: AppGraph,
    onOpenInEditor: suspend (Bitmap) -> Unit,
    onBack: () -> Unit,
) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    var source by remember { mutableStateOf<Bitmap?>(null) }
    var result by remember { mutableStateOf<Bitmap?>(null) }
    var showOriginal by remember { mutableStateOf(false) }
    var running by remember { mutableStateOf<Job?>(null) }
    var stage by remember { mutableStateOf<Progress?>(null) }
    var status by remember { mutableStateOf<String?>(null) }
    var pendingCaptureUri by remember { mutableStateOf<Uri?>(null) }

    fun processBitmap(bmp: Bitmap) {
        running?.cancel()
        source = bmp
        result = null
        showOriginal = false
        status = null
        running = scope.launch {
            val t0 = System.currentTimeMillis()
            try {
                stage = Progress(null, "Recortando assunto com IA local...")
                val out = withContext(Dispatchers.Default) {
                    val mask = graph.backgroundRemover.removeBackground(RgbaImage(bmp)) { p ->
                        scope.launch(Dispatchers.Main) { stage = p }
                    }
                    cutout(bmp, mask)
                }
                result = out
                val sec = (System.currentTimeMillis() - t0) / 100 / 10.0
                status = "Fundo removido em ${sec}s (${out.width}×${out.height} px)."
            } catch (_: CancellationException) {
                status = "Recorte cancelado."
            } catch (e: Exception) {
                status = "Não foi possível remover o fundo: ${e.message ?: "tente outra foto"}"
            } finally {
                stage = null
                running = null
            }
        }
    }

    val pickPhoto = rememberLauncherForActivityResult(ActivityResultContracts.PickVisualMedia()) { uri ->
        if (uri != null) {
            scope.launch {
                val bmp = runCatching { decodeSoftwareBitmap(context, uri) }.getOrNull()
                if (bmp != null) processBitmap(bmp) else status = "Não foi possível abrir a imagem."
            }
        }
    }

    val takePhoto = rememberLauncherForActivityResult(ActivityResultContracts.TakePicture()) { ok ->
        val uri = pendingCaptureUri
        if (ok && uri != null) {
            scope.launch {
                val bmp = runCatching { decodeSoftwareBitmap(context, uri) }.getOrNull()
                if (bmp != null) processBitmap(bmp) else status = "Não foi possível abrir a foto capturada."
            }
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Remover Fundo IA") },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Voltar")
                    }
                },
            )
        },
    ) { pad ->
        Column(
            modifier = Modifier
                .padding(pad)
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(14.dp),
        ) {
            Card(
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant),
                shape = RoundedCornerShape(16.dp),
            ) {
                Column(Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text(
                        "Recorte instantâneo com fundo transparente",
                        style = MaterialTheme.typography.titleSmall.copy(fontWeight = FontWeight.Bold),
                    )
                    Text(
                        "Escolha uma foto da galeria ou tire na hora para gerar um PNG transparente direto no aparelho.",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        Button(
                            onClick = { pickPhoto.launch(PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly)) },
                            enabled = running == null,
                            modifier = Modifier.weight(1f),
                        ) {
                            Text(if (source == null) "Escolher foto" else "Trocar foto")
                        }
                        OutlinedButton(
                            onClick = {
                                val uri = newTempCaptureUri(context)
                                pendingCaptureUri = uri
                                takePhoto.launch(uri)
                            },
                            enabled = running == null,
                            modifier = Modifier.weight(1f),
                        ) {
                            Text("Câmera")
                        }
                    }
                }
            }

            stage?.let { p ->
                Text(p.stage.ifBlank { "Processando..." }, style = MaterialTheme.typography.bodySmall)
                val f = p.fraction
                if (f != null && f > 0f) LinearProgressIndicator(progress = { f }, modifier = Modifier.fillMaxWidth())
                else LinearProgressIndicator(modifier = Modifier.fillMaxWidth())
                TextButton(onClick = { running?.cancel() }) { Text("Cancelar") }
            }

            val displayBitmap = if (showOriginal) source else (result ?: source)
            if (displayBitmap != null) {
                CheckerboardPreview(
                    bitmap = displayBitmap,
                    contentDescription = if (showOriginal) "Foto original" else "Foto sem fundo",
                )
                if (result != null && source != null) {
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        FilterChip(
                            selected = !showOriginal,
                            onClick = { showOriginal = false },
                            label = { Text("Sem fundo") },
                        )
                        FilterChip(
                            selected = showOriginal,
                            onClick = { showOriginal = true },
                            label = { Text("Original") },
                        )
                    }
                }
            }

            status?.let {
                Text(it, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }

            val readyResult = result
            if (readyResult != null) {
                QuickToolExportBar(
                    bitmap = readyResult,
                    namePrefix = "recorte",
                    busy = running != null,
                    onStatus = { status = it },
                    onOpenEditor = onOpenInEditor,
                )
            }
        }
    }
}

/** Ferramenta rápida: ampliação de resolução (2× / 4×) via Real-ESRGAN offline no aparelho. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun QuickUpscalerScreen(
    graph: AppGraph,
    onOpenInEditor: suspend (Bitmap) -> Unit,
    onBack: () -> Unit,
) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    var source by remember { mutableStateOf<Bitmap?>(null) }
    var preparedInput by remember { mutableStateOf<Bitmap?>(null) }
    var result by remember { mutableStateOf<Bitmap?>(null) }
    var factor by remember { mutableIntStateOf(2) }
    var showOriginal by remember { mutableStateOf(false) }
    var running by remember { mutableStateOf<Job?>(null) }
    var stage by remember { mutableStateOf<Progress?>(null) }
    var status by remember { mutableStateOf<String?>(null) }

    val pickPhoto = rememberLauncherForActivityResult(ActivityResultContracts.PickVisualMedia()) { uri ->
        if (uri != null) {
            scope.launch {
                val bmp = runCatching { decodeSoftwareBitmap(context, uri, maxSide = 2048) }.getOrNull()
                if (bmp != null) {
                    val fitted = withContext(Dispatchers.Default) { fitWithinMaxPixels(bmp) }
                    source = bmp
                    preparedInput = fitted
                    result = null
                    showOriginal = false
                    status = if (fitted.width != bmp.width || fitted.height != bmp.height) {
                        "Entrada ajustada para ${fitted.width}×${fitted.height} px (limite 1 MP do modelo) → saída ${fitted.width * factor}×${fitted.height * factor} px."
                    } else {
                        "Imagem pronta (${fitted.width}×${fitted.height} px) → saída ${fitted.width * factor}×${fitted.height * factor} px."
                    }
                } else {
                    status = "Não foi possível abrir a imagem."
                }
            }
        }
    }

    fun runUpscale() {
        val input = preparedInput ?: return
        running?.cancel()
        result = null
        showOriginal = false
        status = null
        running = scope.launch {
            val t0 = System.currentTimeMillis()
            try {
                stage = Progress(0f, "Ampliando ${factor}× com Real-ESRGAN...")
                val out = graph.upscaler.upscale(RgbaImage(input), factor) { p ->
                    scope.launch(Dispatchers.Main) {
                        stage = Progress(p.fraction, "Ampliando ${factor}× (${p.stage})")
                    }
                }.bitmap
                result = out
                val sec = (System.currentTimeMillis() - t0) / 100 / 10.0
                status = "Ampliação ${factor}× concluída em ${sec}s (${out.width}×${out.height} px)."
            } catch (_: CancellationException) {
                status = "Ampliação cancelada."
            } catch (e: AiError) {
                status = "Não foi possível ampliar: ${e.message}"
            } catch (e: Exception) {
                status = "Erro ao ampliar: ${e.message ?: "tente outra imagem"}"
            } finally {
                stage = null
                running = null
            }
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Upscaler HD (Real-ESRGAN)") },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Voltar")
                    }
                },
            )
        },
    ) { pad ->
        Column(
            modifier = Modifier
                .padding(pad)
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(14.dp),
        ) {
            Card(
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant),
                shape = RoundedCornerShape(16.dp),
            ) {
                Column(Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    Text(
                        "Aumente a nitidez e resolução offline",
                        style = MaterialTheme.typography.titleSmall.copy(fontWeight = FontWeight.Bold),
                    )
                    Text(
                        "Ideal para recuperar fotos de catálogo ou imagens pequenas antes de imprimir ou anunciar.",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        listOf(2, 4).forEach { f ->
                            FilterChip(
                                selected = factor == f,
                                enabled = running == null,
                                onClick = {
                                    factor = f
                                    preparedInput?.let { inp ->
                                        status = "Entrada ${inp.width}×${inp.height} px → saída ${inp.width * f}×${inp.height * f} px."
                                    }
                                },
                                label = { Text(if (f == 2) "2× HD" else "4× Ultra HD") },
                            )
                        }
                    }
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        OutlinedButton(
                            onClick = { pickPhoto.launch(PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly)) },
                            enabled = running == null,
                            modifier = Modifier.weight(1f),
                        ) {
                            Text(if (preparedInput == null) "Escolher foto" else "Trocar foto")
                        }
                        Button(
                            onClick = { runUpscale() },
                            enabled = running == null && preparedInput != null,
                            modifier = Modifier.weight(1f),
                        ) {
                            Text("Ampliar ${factor}×")
                        }
                    }
                }
            }

            stage?.let { p ->
                Text(p.stage, style = MaterialTheme.typography.bodySmall)
                val f = p.fraction
                if (f != null && f > 0f) LinearProgressIndicator(progress = { f }, modifier = Modifier.fillMaxWidth())
                else LinearProgressIndicator(modifier = Modifier.fillMaxWidth())
                OutlinedButton(onClick = { running?.cancel() }) { Text("Cancelar ampliação") }
            }

            val preview = if (showOriginal) preparedInput else (result ?: preparedInput)
            if (preview != null) {
                CheckerboardPreview(
                    bitmap = preview,
                    contentDescription = if (showOriginal) "Original" else "Resultado ampliado",
                )
                if (result != null && preparedInput != null) {
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        FilterChip(
                            selected = !showOriginal,
                            onClick = { showOriginal = false },
                            label = { Text("Ampliada (${result!!.width}×${result!!.height})") },
                        )
                        FilterChip(
                            selected = showOriginal,
                            onClick = { showOriginal = true },
                            label = { Text("Original (${preparedInput!!.width}×${preparedInput!!.height})") },
                        )
                    }
                }
            }

            status?.let {
                Text(it, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }

            val ready = result
            if (ready != null) {
                QuickToolExportBar(
                    bitmap = ready,
                    namePrefix = "upscale_${factor}x",
                    busy = running != null,
                    onStatus = { status = it },
                    onOpenEditor = onOpenInEditor,
                )
            }
        }
    }
}
