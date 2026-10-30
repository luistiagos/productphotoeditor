package com.productphoto.app

import android.graphics.Bitmap
import androidx.compose.foundation.Image
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.unit.dp
import com.productphoto.ai.api.AiError
import com.productphoto.ai.api.Capability
import com.productphoto.ai.api.ChainEntry
import com.productphoto.ai.api.ImageRequest
import com.productphoto.ai.api.Progress
import com.productphoto.ai.api.Requirement
import com.productphoto.ai.api.RgbaImage
import com.productphoto.ai.api.snapTo8
import com.productphoto.imaging.UPSCALE_MAX_INPUT_PIXELS
import com.productphoto.ai.remotehttp.image.IawrapperImageFactory
import com.productphoto.feature.mockup.centerCrop
import com.productphoto.ui.FormatPicker
import com.productphoto.ui.MediaFormats
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlin.math.sqrt

const val IMAGE_IAWRAPPER_SECRET = "image.iawrapper"

/**
 * Servidor de imagem do app (§19.5): iawrapper com endereço, feature e credencial vindos do build — o usuário
 * final não configura nada. A credencial em si chega pelo `BuiltInSecretStore` do [AppGraph].
 */
internal fun cloudImageChain(
    baseUrl: String = BuildConfig.IAWRAPPER_URL,
    featureSlug: String = BuildConfig.IAWRAPPER_FEATURE,
    hasCredential: Boolean = BuildConfig.IAWRAPPER_CREDENTIAL.isNotBlank(),
    appId: String = BuildConfig.IAWRAPPER_APP_ID,
): List<ChainEntry> = listOf(
    ChainEntry(
        IawrapperImageFactory.ID,
        JsonObject(buildMap {
            put(IawrapperImageFactory.BASE_URL, JsonPrimitive(baseUrl.trim()))
            put(IawrapperImageFactory.FEATURE_SLUG, JsonPrimitive(featureSlug.trim()))
            put(IawrapperImageFactory.APP_ID, JsonPrimitive(appId.trim()))
            if (hasCredential) put(IawrapperImageFactory.AUTH_SECRET, JsonPrimitive(IMAGE_IAWRAPPER_SECRET))
        }),
    ),
)

/** Mensagens para o usuário leigo: sem HTTP, provedor nem credencial. */
internal fun describeImageError(e: Throwable): String = when {
    e is AiError.Unavailable && Requirement.Network in e.missing -> "Sem internet. Conecte-se para gerar imagens."
    e is AiError.Unavailable -> "A geração de imagem não está disponível nesta versão do app."
    e is AiError.Network -> "Não foi possível falar com o serviço de imagens. Verifique a internet e tente de novo."
    e is AiError.Remote && e.code == 401 -> "O serviço de imagens recusou o acesso. Atualize o app ou tente mais tarde."
    e is AiError.Remote && e.code == 402 -> "O serviço de imagens está sem créditos no momento. Tente mais tarde."
    e is AiError.Remote && e.code == 429 -> "Muitas tentativas seguidas no serviço de imagens. Aguarde alguns minutos e tente de novo."
    else -> "Não foi possível gerar a imagem. Tente de novo em instantes."
}

/** Orçamento do servidor: o maior dos formatos rápidos (512×768). */
internal const val GEN_MAX_PIXELS = 512 * 768
internal const val GEN_MAX_SIDE = 1024
/** Abaixo disso o modelo perde qualidade: um formato pequeno é gerado no orçamento e reduzido. */
internal const val GEN_MIN_SIDE = 512
/** Proporção máxima pedida ao servidor; um formato mais fino (banner 728×90) sai do corte central. */
internal const val GEN_MAX_ASPECT = 4.0
/** Teto do tamanho personalizado em "Gerar imagem" (a capa do canal do YouTube, 2560×1440, cabe). */
internal const val IMAGE_GEN_MAX_SIDE = 2560

/**
 * Tamanho pedido ao servidor para entregar [w]×[h] (§46 do HANDOFF). Vai como está quando o menor lado ≥ [GEN_MIN_SIDE],
 * a área ≤ [GEN_MAX_PIXELS] e o maior lado ≤ [GEN_MAX_SIDE] (os formatos rápidos). Fora disso: a proporção (limitada a
 * [GEN_MAX_ASPECT]) com a área do orçamento, lado maior ≤ [GEN_MAX_SIDE], múltiplos de 8; [fitToFormat] faz o resto.
 */
internal fun generationSize(w: Int, h: Int): Pair<Int, Int> {
    if (minOf(w, h) >= GEN_MIN_SIDE && w.toLong() * h <= GEN_MAX_PIXELS && maxOf(w, h) <= GEN_MAX_SIDE) {
        return snapTo8(w) to snapTo8(h)
    }
    val a = (w.toDouble() / h).coerceIn(1 / GEN_MAX_ASPECT, GEN_MAX_ASPECT)
    var gh = sqrt(GEN_MAX_PIXELS / a)
    var gw = gh * a
    // o lado maior vai direto para o teto (multiplicar por um fator daria 1023,99… e viraria 1016)
    if (gw > GEN_MAX_SIDE) { gw = GEN_MAX_SIDE.toDouble(); gh = gw / a }
    if (gh > GEN_MAX_SIDE) { gh = GEN_MAX_SIDE.toDouble(); gw = gh * a }
    // arredonda para baixo, para não estourar o orçamento
    fun down8(v: Double) = ((v / 8).toInt() * 8).coerceAtLeast(8)
    return down8(gw) to down8(gh)
}

/** Leva a imagem gerada ao tamanho exato do formato: corte central na proporção e escala, sem esticar. */
internal fun fitToFormat(b: Bitmap, w: Int, h: Int): Bitmap {
    if (b.width == w && b.height == h) return b
    val c = centerCrop(b.width, b.height, w.toFloat() / h)
    val cut = if (c.width == b.width && c.height == b.height) b else Bitmap.createBitmap(b, c.x, c.y, c.width, c.height)
    return Bitmap.createScaledBitmap(cut, w, h, true)
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
    var format by mutableStateOf(MediaFormats.all.first())
    val results = mutableStateListOf<Bitmap>()
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ImageGenScreen(graph: AppGraph, onOpenInEditor: suspend (Bitmap) -> Unit) {
    val scope = rememberCoroutineScope()
    var running by remember { mutableStateOf<Job?>(null) }
    var stage by remember { mutableStateOf<Progress?>(null) }
    var status by remember { mutableStateOf<String?>(null) }

    /** Grava a cadeia fixa só se mudou: invalidar a cada geração descartaria o login em cache do iawrapper. */
    suspend fun useCloudServer() {
        val chain = cloudImageChain()
        if (graph.configStore.load().chainFor(Capability.IMAGE_GENERATOR) != chain) graph.saveImageChain(chain)
    }

    fun generate() {
        status = null
        running = scope.launch {
            val t0 = System.currentTimeMillis()
            try {
                useCloudServer()
                var prompt = ImageGenMemory.prompt.trim()
                var negative = ImageGenMemory.negative.trim()
                // os modelos entendem melhor inglês; sem tradutor, vai o texto original
                stage = Progress(null, "Preparando o pedido")
                try {
                    prompt = translateToEnglish(graph, prompt)
                    if (negative.isNotEmpty()) negative = translateToEnglish(graph, negative)
                } catch (e: CancellationException) {
                    throw e
                } catch (_: Exception) {
                }
                stage = Progress(null, "Criando a imagem")
                val format = ImageGenMemory.format
                val (gw, gh) = generationSize(format.width, format.height)
                val req = ImageRequest(
                    prompt = prompt,
                    negativePrompt = negative.ifEmpty { null },
                    width = gw,
                    height = gh,
                )
                // as etapas do servidor ("pending", "Baixando resultado") não dizem nada ao usuário: só a fração
                val out = graph.imageGenerator.generate(req) { p ->
                    scope.launch(Dispatchers.Main) { stage = Progress(p.fraction, "Criando a imagem") }
                }
                val sized = withContext(Dispatchers.Default) { out.map { fitToFormat(it.bitmap, format.width, format.height) } }
                ImageGenMemory.results.addAll(0, sized)
                status = "Pronta em ${(System.currentTimeMillis() - t0) / 100 / 10.0} s. Toque na imagem para abrir no editor."
            } catch (e: CancellationException) {
                status = "Cancelado"
            } catch (e: Exception) {
                status = describeImageError(e)
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
                status = "Ampliada para ${out.width}×${out.height} em ${(System.currentTimeMillis() - t0) / 100 / 10.0} s."
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
                "Descreva o que você quer: pôster, logo ou foto de produto. A imagem é criada na nuvem (precisa de " +
                    "internet) e abre no editor.",
                style = MaterialTheme.typography.bodyMedium,
            )
            OutlinedTextField(ImageGenMemory.prompt, { ImageGenMemory.prompt = it }, Modifier.fillMaxWidth(),
                label = { Text("O que gerar") }, placeholder = { Text("pôster de café artesanal, estilo aquarela") })
            OutlinedTextField(ImageGenMemory.negative, { ImageGenMemory.negative = it }, Modifier.fillMaxWidth(),
                label = { Text("Evitar (opcional)") }, placeholder = { Text("texto, marca d'água, borrado") })
            FormatPicker(
                ImageGenMemory.format, MediaFormats.forImageGeneration, { ImageGenMemory.format = it },
                maxSide = IMAGE_GEN_MAX_SIDE, enabled = running == null,
            )
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Button(enabled = running == null && ImageGenMemory.prompt.isNotBlank(), onClick = { generate() }) {
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
