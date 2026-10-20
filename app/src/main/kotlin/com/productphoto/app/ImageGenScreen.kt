package com.productphoto.app

import android.graphics.Bitmap
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.PickVisualMediaRequest
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.Image
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.Checkbox
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.RadioButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Slider
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
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import com.productphoto.ai.api.AiError
import com.productphoto.ai.api.Capability
import com.productphoto.ai.api.ChainEntry
import com.productphoto.ai.api.Control
import com.productphoto.ai.api.ImageRequest
import com.productphoto.ai.api.Progress
import com.productphoto.ai.api.RgbaImage
import com.productphoto.imaging.UPSCALE_MAX_INPUT_PIXELS
import com.productphoto.ai.remotehttp.image.A1111ImageFactory
import com.productphoto.ai.remotehttp.image.ComfyUiImageFactory
import com.productphoto.editor.EditorAssets
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.contentOrNull

/** Servidor de geração de imagem (ARQUITETURA §19.5). */
enum class ImageServer(val label: String, val providerId: String?) {
    A1111("AUTOMATIC1111 / Forge", A1111ImageFactory.ID),
    COMFYUI("ComfyUI", ComfyUiImageFactory.ID),
    OFF("Desligado", null),
}

const val IMAGE_A1111_SECRET = "image.a1111"
const val IMAGE_COMFY_SECRET = "image.comfyui"

data class ImageGenSettings(val server: ImageServer, val baseUrl: String, val checkpoint: String)

private fun ChainEntry.str(key: String) = (settings[key] as? JsonPrimitive)?.contentOrNull.orEmpty()

/** Servidor, URL e checkpoint a partir da cadeia salva (o primeiro provedor de imagem conhecido). */
internal fun imageGenStateOf(chain: List<ChainEntry>): ImageGenSettings {
    val entry = chain.firstOrNull { e -> ImageServer.entries.any { it.providerId == e.provider } }
        ?: return ImageGenSettings(ImageServer.OFF, "", "")
    val server = ImageServer.entries.first { it.providerId == entry.provider }
    return ImageGenSettings(server, entry.str("baseUrl"), entry.str(ComfyUiImageFactory.CHECKPOINT))
}

/**
 * Cadeia de um provedor só. Mantém as demais settings da entrada anterior do mesmo provedor
 * (modelos de ControlNet, fluxo próprio etc., editáveis no arquivo de config).
 */
internal fun imageChainOf(s: ImageGenSettings, hasSecret: Boolean, previous: List<ChainEntry>): List<ChainEntry> {
    val id = s.server.providerId ?: return emptyList()
    val kept = previous.firstOrNull { it.provider == id }?.settings.orEmpty()
    val settings = buildMap {
        putAll(kept)
        put("baseUrl", JsonPrimitive(s.baseUrl.trim()))
        when (s.server) {
            ImageServer.A1111 -> if (hasSecret) put(A1111ImageFactory.AUTH_SECRET, JsonPrimitive(IMAGE_A1111_SECRET))
                else remove(A1111ImageFactory.AUTH_SECRET)
            ImageServer.COMFYUI -> {
                put(ComfyUiImageFactory.CHECKPOINT, JsonPrimitive(s.checkpoint.trim()))
                if (hasSecret) put(ComfyUiImageFactory.API_KEY_SECRET, JsonPrimitive(IMAGE_COMFY_SECRET))
                else remove(ComfyUiImageFactory.API_KEY_SECRET)
            }
            ImageServer.OFF -> {}
        }
    }
    return listOf(ChainEntry(id, JsonObject(settings)))
}

internal fun secretNameFor(server: ImageServer) = when (server) {
    ImageServer.A1111 -> IMAGE_A1111_SECRET
    ImageServer.COMFYUI -> IMAGE_COMFY_SECRET
    ImageServer.OFF -> null
}

internal fun describeImageError(e: Throwable, server: ImageServer): String = when {
    e is AiError.Unavailable && e.missing.isEmpty() ->
        if (server == ImageServer.OFF) "Geração de imagem desligada: escolha um servidor" else "Informe o endereço do servidor e salve"
    e is AiError.Remote && e.code == 404 && server == ImageServer.A1111 ->
        "O servidor respondeu HTTP 404: inicie o AUTOMATIC1111/Forge com --api"
    e is AiError.Remote && e.code == 401 -> "O servidor recusou a credencial (HTTP 401)"
    e is AiError.Unsupported -> e.message ?: "Não suportado por este servidor"
    else -> describeTextError(e)
}

enum class ImageFormat(val label: String, val width: Int, val height: Int) {
    SQUARE("Quadrado", 512, 512), PORTRAIT("Retrato", 512, 768), LANDSCAPE("Paisagem", 768, 512),
}

/**
 * O pedido é escrito em português: se a detecção de idioma falhar (texto curto, sem acentos —
 * "poster de cafe artesanal" no teste manual da §19.7), tenta de novo partindo do português.
 */
private suspend fun translateToEnglish(graph: AppGraph, text: String): String = try {
    graph.translator.translate(text, null, "en")
} catch (e: CancellationException) {
    throw e
} catch (e: Exception) {
    graph.translator.translate(text, "pt", "en")
}

/** Sobrevive à ida ao editor e à volta (a tela é recriada; os resultados não deveriam sumir). */
private object ImageGenMemory {
    var prompt by mutableStateOf("")
    var negative by mutableStateOf("")
    val results = mutableStateListOf<Bitmap>()
}

@OptIn(ExperimentalMaterial3Api::class, ExperimentalLayoutApi::class)
@Composable
fun ImageGenScreen(graph: AppGraph, onOpenInEditor: suspend (Bitmap) -> Unit) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    var loaded by remember { mutableStateOf(false) }
    var server by remember { mutableStateOf(ImageServer.OFF) }
    var baseUrl by remember { mutableStateOf("") }
    var checkpoint by remember { mutableStateOf("") }
    var secret by remember { mutableStateOf("") }
    var hasSecret by remember { mutableStateOf(false) }
    var message by remember { mutableStateOf<String?>(null) }
    val urlFocus = remember { FocusRequester() }

    var format by remember { mutableStateOf(ImageFormat.SQUARE) }
    var count by remember { mutableStateOf(1) }
    var translate by remember { mutableStateOf(true) }
    var reference by remember { mutableStateOf<Bitmap?>(null) }
    var refKind by remember { mutableStateOf(Control.Kind.SCRIBBLE) }
    var refWeight by remember { mutableStateOf(1f) }
    var running by remember { mutableStateOf<Job?>(null) }
    var stage by remember { mutableStateOf<Progress?>(null) }
    var status by remember { mutableStateOf<String?>(null) }

    suspend fun loadSecretFlag(s: ImageServer) {
        hasSecret = secretNameFor(s)?.let { name ->
            withContext(Dispatchers.IO) { runCatching { graph.secrets.get(name) != null }.getOrDefault(false) }
        } ?: false
    }

    LaunchedEffect(Unit) {
        val st = imageGenStateOf(graph.configStore.load().chainFor(Capability.IMAGE_GENERATOR))
        server = st.server; baseUrl = st.baseUrl; checkpoint = st.checkpoint
        loadSecretFlag(server)
        loaded = true
    }
    // depois da composição com o campo de URL (o FocusRequester só vale com o campo na tela)
    LaunchedEffect(loaded) {
        if (loaded && server != ImageServer.OFF && baseUrl.isBlank()) {
            message = "Informe o endereço do servidor"
            runCatching { urlFocus.requestFocus() }
        }
    }

    val needsServer = server != ImageServer.OFF
    val urlOk = baseUrl.trim().let { it.startsWith("http://") || it.startsWith("https://") }
    val canSave = loaded && (!needsServer || (urlOk && (server != ImageServer.COMFYUI || checkpoint.isNotBlank())))

    suspend fun save() {
        val name = secretNameFor(server)
        if (name != null && secret.isNotBlank()) {
            withContext(Dispatchers.IO) { graph.secrets.put(name, secret.trim()) }
            hasSecret = true; secret = ""
        }
        val previous = graph.configStore.load().chainFor(Capability.IMAGE_GENERATOR)
        graph.saveImageChain(imageChainOf(ImageGenSettings(server, baseUrl, checkpoint), hasSecret, previous))
        message = null
    }

    val pickReference = rememberLauncherForActivityResult(ActivityResultContracts.PickVisualMedia()) { uri ->
        if (uri != null) scope.launch {
            runCatching {
                val bytes = withContext(Dispatchers.IO) { context.contentResolver.openInputStream(uri)!!.use { it.readBytes() } }
                reference = withContext(Dispatchers.Default) { EditorAssets.decodeBytes(bytes, 1024) }
            }.onFailure { status = "Imagem inválida: ${it.message}" }
        }
    }

    fun generate() {
        status = null
        running = scope.launch {
            val t0 = System.currentTimeMillis()
            try {
                save()
                var prompt = ImageGenMemory.prompt.trim()
                var negative = ImageGenMemory.negative.trim()
                var notice: String? = null
                if (translate) {
                    stage = Progress(null, "Traduzindo o pedido")
                    try {
                        prompt = translateToEnglish(graph, prompt)
                        if (negative.isNotEmpty()) negative = translateToEnglish(graph, negative)
                    } catch (e: CancellationException) {
                        throw e
                    } catch (e: Exception) {
                        notice = "Tradução indisponível (${describeTextError(e)}); usei o texto original. "
                    }
                }
                stage = Progress(null, "Enviando")
                val req = ImageRequest(
                    prompt = prompt,
                    negativePrompt = negative.ifEmpty { null },
                    width = format.width,
                    height = format.height,
                    control = reference?.let { Control(refKind, RgbaImage(it), refWeight) },
                    count = count,
                )
                val out = graph.imageGenerator.generate(req) { p -> scope.launch(Dispatchers.Main) { stage = p } }
                ImageGenMemory.results.addAll(0, out.map { it.bitmap })
                val who = graph.imageGenerator.chain.lastServedBy.value?.displayName ?: "?"
                status = (notice ?: "") + "${out.size} imagem(ns) — $who, ${(System.currentTimeMillis() - t0) / 100 / 10.0} s. Toque para abrir no editor."
            } catch (e: CancellationException) {
                status = "Cancelado"
            } catch (e: Exception) {
                status = describeImageError(e, server)
            } finally {
                running = null
                stage = null
            }
        }
    }

    /** Real-ESRGAN no aparelho (§20.4 item 7): substitui o resultado na grade; "Cancelar" interrompe entre tiles. */
    fun upscale(bmp: Bitmap) {
        status = null
        running = scope.launch {
            val t0 = System.currentTimeMillis()
            try {
                stage = Progress(null, "Ampliando 2×")
                val out = graph.upscaler.upscale(RgbaImage(bmp), 2) { p ->
                    scope.launch(Dispatchers.Main) { stage = Progress(p.fraction, "Ampliando 2×") }
                }.bitmap
                val i = ImageGenMemory.results.indexOf(bmp)
                if (i >= 0) ImageGenMemory.results[i] = out else ImageGenMemory.results.add(0, out)
                val who = graph.upscaler.chain.lastServedBy.value?.displayName ?: "?"
                status = "Ampliada para ${out.width}×${out.height} — $who, ${(System.currentTimeMillis() - t0) / 100 / 10.0} s."
            } catch (e: CancellationException) {
                status = "Cancelado"
            } catch (e: AiError) {
                status = "Não deu para ampliar: ${e.message}"
            } finally {
                running = null
                stage = null
            }
        }
    }

    Scaffold(topBar = { TopAppBar(title = { Text("Gerar imagem") }) }) { pad ->
        Column(
            Modifier.padding(pad).fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Text(
                "Pôster ou logo por texto, num servidor Stable Diffusion seu (AUTOMATIC1111/Forge com --api, ou ComfyUI). " +
                    "O resultado abre no editor.",
                style = MaterialTheme.typography.bodyMedium,
            )
            Card(Modifier.fillMaxWidth()) {
                Column(Modifier.padding(8.dp)) {
                    ImageServer.entries.forEach { s ->
                        Row(
                            Modifier.fillMaxWidth().selectable(selected = server == s, onClick = {
                                server = s
                                scope.launch { loadSecretFlag(s) }
                            }).padding(8.dp),
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            RadioButton(selected = server == s, onClick = null)
                            Text(s.label, Modifier.padding(start = 8.dp), style = MaterialTheme.typography.titleSmall)
                        }
                    }
                }
            }
            if (needsServer) {
                OutlinedTextField(
                    baseUrl, { baseUrl = it }, Modifier.fillMaxWidth().focusRequester(urlFocus), singleLine = true,
                    label = { Text("Endereço do servidor") },
                    placeholder = { Text(if (server == ImageServer.A1111) "http://192.168.0.10:7860" else "http://192.168.0.10:8188") },
                    isError = baseUrl.isNotBlank() && !urlOk,
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Uri),
                )
                if (server == ImageServer.COMFYUI) {
                    OutlinedTextField(checkpoint, { checkpoint = it }, Modifier.fillMaxWidth(), singleLine = true,
                        label = { Text("Checkpoint (arquivo do modelo)") }, placeholder = { Text("v1-5-pruned-emaonly.safetensors") })
                }
                val secretLabel = if (server == ImageServer.A1111) "Usuário:senha do --api-auth" else "Chave (proxy com Bearer)"
                OutlinedTextField(
                    secret, { secret = it }, Modifier.fillMaxWidth(), singleLine = true,
                    label = { Text(if (hasSecret) "$secretLabel (salva; digite para trocar)" else "$secretLabel (opcional)") },
                    visualTransformation = PasswordVisualTransformation(),
                )
                if (hasSecret) {
                    TextButton(onClick = {
                        scope.launch {
                            secretNameFor(server)?.let { n -> withContext(Dispatchers.IO) { runCatching { graph.secrets.remove(n) } } }
                            hasSecret = false
                            save()
                            message = "Credencial removida"
                        }
                    }) { Text("Remover credencial salva") }
                }
                if ((hasSecret || secret.isNotBlank()) && baseUrl.trim().startsWith("http://")) {
                    Text(
                        "Atenção: com http:// a credencial trafega sem criptografia. Use só na sua rede local.",
                        color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall,
                    )
                }
            }
            Button(enabled = canSave && running == null, onClick = {
                scope.launch {
                    message = try {
                        save(); "Salvo"
                    } catch (e: CancellationException) {
                        throw e
                    } catch (e: Exception) {
                        "Não foi possível salvar: ${e.message}"
                    }
                }
            }) { Text("Salvar") }
            message?.let { Text(it, style = MaterialTheme.typography.bodySmall) }

            if (needsServer) {
                Text("Gerar", style = MaterialTheme.typography.titleMedium)
                OutlinedTextField(ImageGenMemory.prompt, { ImageGenMemory.prompt = it }, Modifier.fillMaxWidth(),
                    label = { Text("O que gerar") }, placeholder = { Text("pôster de café artesanal, estilo aquarela") })
                OutlinedTextField(ImageGenMemory.negative, { ImageGenMemory.negative = it }, Modifier.fillMaxWidth(),
                    label = { Text("Evitar (opcional)") }, placeholder = { Text("texto, marca d'água, borrado") })
                FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    ImageFormat.entries.forEach { f ->
                        FilterChip(selected = format == f, onClick = { format = f }, label = { Text("${f.label} ${f.width}×${f.height}") })
                    }
                }
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text("Quantidade")
                    (1..4).forEach { n -> FilterChip(selected = count == n, onClick = { count = n }, label = { Text("$n") }) }
                }
                Row(Modifier.clickable { translate = !translate }, verticalAlignment = Alignment.CenterVertically) {
                    Checkbox(translate, { translate = it })
                    Text("Traduzir o pedido para inglês (os modelos entendem melhor)")
                }
                Card(Modifier.fillMaxWidth()) {
                    Column(Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        Text("Referência (opcional)", style = MaterialTheme.typography.titleSmall)
                        Text("Um esboço ou ícone que guia a composição (ControlNet).", style = MaterialTheme.typography.bodySmall)
                        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            reference?.let { Image(it.asImageBitmap(), "referência", Modifier.size(64.dp), contentScale = ContentScale.Fit) }
                            OutlinedButton(onClick = { pickReference.launch(PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly)) }) {
                                Text(if (reference == null) "Escolher imagem" else "Trocar")
                            }
                            if (reference != null) TextButton(onClick = { reference = null }) { Text("Remover") }
                        }
                        if (reference != null) {
                            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                FilterChip(selected = refKind == Control.Kind.SCRIBBLE, onClick = { refKind = Control.Kind.SCRIBBLE }, label = { Text("Rabisco") })
                                FilterChip(selected = refKind == Control.Kind.CANNY, onClick = { refKind = Control.Kind.CANNY }, label = { Text("Contorno") })
                            }
                            Text("Peso ${"%.1f".format(refWeight)}", style = MaterialTheme.typography.bodySmall)
                            Slider(refWeight, { refWeight = it }, valueRange = 0f..2f)
                        }
                    }
                }
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Button(enabled = canSave && running == null && ImageGenMemory.prompt.isNotBlank(), onClick = { generate() }) {
                        Text("Gerar")
                    }
                    if (running != null) OutlinedButton(onClick = { running?.cancel() }) { Text("Cancelar") }
                }
                stage?.let { p ->
                    Text(p.stage, style = MaterialTheme.typography.bodySmall)
                    val f = p.fraction
                    if (f != null && f > 0f) LinearProgressIndicator(progress = { f }, modifier = Modifier.fillMaxWidth())
                    else LinearProgressIndicator(Modifier.fillMaxWidth())
                }
                status?.let { Text(it, style = MaterialTheme.typography.bodyMedium) }
                ResultsGrid(ImageGenMemory.results, canUpscale = running == null, onUpscale = ::upscale) { bmp -> scope.launch { onOpenInEditor(bmp) } }
                if (ImageGenMemory.results.isNotEmpty()) TextButton(onClick = { ImageGenMemory.results.clear() }) { Text("Limpar resultados") }
            }
        }
    }
}

/** Grade de 2 colunas sem LazyGrid (a tela já rola). */
@Composable
private fun ResultsGrid(results: List<Bitmap>, canUpscale: Boolean, onUpscale: (Bitmap) -> Unit, onOpen: (Bitmap) -> Unit) {
    results.chunked(2).forEach { row ->
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            row.forEach { bmp ->
                Card(Modifier.weight(1f)) {
                    Image(
                        bmp.asImageBitmap(), "imagem gerada",
                        Modifier.fillMaxWidth().aspectRatio(bmp.width.toFloat() / bmp.height.coerceAtLeast(1)).clickable { onOpen(bmp) },
                        contentScale = ContentScale.Fit,
                    )
                    Row(Modifier.fillMaxWidth().padding(horizontal = 8.dp), verticalAlignment = Alignment.CenterVertically) {
                        Text("${bmp.width}×${bmp.height}", style = MaterialTheme.typography.bodySmall, modifier = Modifier.weight(1f))
                        if (bmp.width.toLong() * bmp.height <= UPSCALE_MAX_INPUT_PIXELS) {
                            TextButton(enabled = canUpscale, onClick = { onUpscale(bmp) }) { Text("Ampliar 2×") }
                        }
                    }
                }
            }
            if (row.size == 1) Spacer(Modifier.weight(1f))
        }
    }
}
