package com.productphoto.app

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.RadioButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import com.productphoto.ai.api.AiError
import com.productphoto.ai.api.Capability
import com.productphoto.ai.api.ChainEntry
import com.productphoto.ai.api.Requirement
import com.productphoto.ai.api.TextRequest
import com.productphoto.ai.mlkit.GeminiNanoTextGenerator
import com.productphoto.ai.remotehttp.OpenAiCompatibleFactory
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.contentOrNull

/** Onde o texto IA roda (ARQUITETURA §18.5). */
enum class TextAiMode(val label: String, val detail: String) {
    DEVICE("Só no aparelho", "Gemini Nano (aparelhos compatíveis) ou um modelo baixado em Modelos de IA. Nada sai do aparelho."),
    DEVICE_THEN_SERVER("Aparelho, depois servidor", "Usa o servidor só quando nada no aparelho estiver disponível."),
    SERVER("Só servidor", "Sempre o servidor configurado abaixo (Ollama, LM Studio, OpenAI, OpenRouter…)."),
}

const val TEXT_API_KEY_SECRET = "text.openai"

/** Modo e servidor a partir da cadeia salva. */
internal fun textAiStateOf(chain: List<ChainEntry>): Triple<TextAiMode, String, String> {
    val http = chain.firstOrNull { it.provider == OpenAiCompatibleFactory.ID }
    fun s(k: String) = (http?.settings?.get(k) as? JsonPrimitive)?.contentOrNull.orEmpty()
    val mode = when {
        http == null -> TextAiMode.DEVICE
        chain.size == 1 -> TextAiMode.SERVER
        else -> TextAiMode.DEVICE_THEN_SERVER
    }
    return Triple(mode, s(OpenAiCompatibleFactory.BASE_URL), s(OpenAiCompatibleFactory.MODEL))
}

internal fun textChainOf(mode: TextAiMode, baseUrl: String, model: String, hasKey: Boolean): List<ChainEntry> {
    val http = ChainEntry(OpenAiCompatibleFactory.ID, JsonObject(buildMap {
        put(OpenAiCompatibleFactory.BASE_URL, JsonPrimitive(baseUrl.trim()))
        put(OpenAiCompatibleFactory.MODEL, JsonPrimitive(model.trim()))
        if (hasKey) put(OpenAiCompatibleFactory.API_KEY_SECRET, JsonPrimitive(TEXT_API_KEY_SECRET))
    }))
    return when (mode) {
        TextAiMode.DEVICE -> AppGraph.ON_DEVICE_TEXT_CHAIN
        TextAiMode.DEVICE_THEN_SERVER -> AppGraph.ON_DEVICE_TEXT_CHAIN + http
        TextAiMode.SERVER -> listOf(http)
    }
}

private fun describeRequirement(r: Requirement): String = when (r) {
    is Requirement.Model -> "baixar o modelo ${r.modelId} em Modelos de IA"
    is Requirement.MinRamMb -> "aparelho com ${(r.mb + 1023) / 1024} GB de RAM"
    Requirement.PlayServices -> "Google Play services"
    Requirement.Network -> "conexão com a rede"
    is Requirement.Secret -> "chave de API"
    is Requirement.DeviceFeature -> if (r == GeminiNanoTextGenerator.AICORE) "Gemini Nano (AICore) neste aparelho" else r.name
}

internal fun describeTextError(e: Throwable): String = when (e) {
    is AiError.Unavailable -> "Nenhum provedor disponível. Falta: " +
        e.missing.distinct().joinToString("; ") { describeRequirement(it) }.ifEmpty { "configurar um provedor" }
    is AiError.Network -> "Sem conexão com o servidor: ${e.cause?.message ?: ""}"
    is AiError.Remote -> "O servidor respondeu HTTP ${e.code}" + (e.body?.take(200)?.let { ": $it" } ?: "")
    is AiError.ModelNotDownloaded -> "Modelo ${e.modelId} não baixado"
    else -> e.message ?: e.javaClass.simpleName
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun TextAiScreen(graph: AppGraph, onModels: () -> Unit) {
    val scope = rememberCoroutineScope()
    var loaded by remember { mutableStateOf(false) }
    var mode by remember { mutableStateOf(TextAiMode.DEVICE) }
    var baseUrl by remember { mutableStateOf("") }
    var model by remember { mutableStateOf("") }
    var key by remember { mutableStateOf("") }
    var hasKey by remember { mutableStateOf(false) }
    var message by remember { mutableStateOf<String?>(null) }
    var prompt by remember { mutableStateOf("Escreva um slogan curto para uma padaria artesanal.") }
    var answer by remember { mutableStateOf<String?>(null) }
    var running by remember { mutableStateOf<Job?>(null) }

    LaunchedEffect(Unit) {
        val (m, url, mdl) = textAiStateOf(graph.configStore.load().chainFor(Capability.TEXT_GENERATOR))
        mode = m; baseUrl = url; model = mdl
        hasKey = withContext(Dispatchers.IO) { runCatching { graph.secrets.get(TEXT_API_KEY_SECRET) != null }.getOrDefault(false) }
        loaded = true
    }

    val needsServer = mode != TextAiMode.DEVICE
    val urlOk = baseUrl.trim().let { it.startsWith("http://") || it.startsWith("https://") }
    val canSave = loaded && (!needsServer || (urlOk && model.isNotBlank()))

    fun save(then: () -> Unit = {}) = scope.launch {
        try {
            withContext(Dispatchers.IO) {
                if (key.isNotBlank()) graph.secrets.put(TEXT_API_KEY_SECRET, key.trim())
            }
            if (key.isNotBlank()) { hasKey = true; key = "" }
            graph.saveTextChain(textChainOf(mode, baseUrl, model, hasKey))
            message = "Salvo"
            then()
        } catch (e: CancellationException) {
            throw e
        } catch (e: Exception) {
            message = "Não foi possível salvar: ${e.message}"
        }
    }

    Scaffold(topBar = { TopAppBar(title = { Text("Texto com IA") }) }) { pad ->
        Column(
            Modifier.padding(pad).fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Text("Usado em \"Reescrever\" e \"Gerar textos\" no editor.", style = MaterialTheme.typography.bodyMedium)
            Card(Modifier.fillMaxWidth()) {
                Column(Modifier.padding(8.dp)) {
                    TextAiMode.entries.forEach { m ->
                        Row(
                            Modifier.fillMaxWidth().selectable(selected = mode == m, onClick = { mode = m }).padding(8.dp),
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            RadioButton(selected = mode == m, onClick = { mode = m })
                            Column(Modifier.padding(start = 8.dp)) {
                                Text(m.label, style = MaterialTheme.typography.titleSmall)
                                Text(m.detail, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                            }
                        }
                    }
                }
            }
            if (mode != TextAiMode.SERVER) {
                OutlinedButton(onClick = onModels) { Text("Baixar um modelo de texto (Modelos de IA)") }
            }
            if (needsServer) {
                OutlinedTextField(
                    baseUrl, { baseUrl = it }, Modifier.fillMaxWidth(), singleLine = true,
                    label = { Text("URL base (até /v1)") }, placeholder = { Text("http://192.168.0.10:11434/v1") },
                    isError = baseUrl.isNotBlank() && !urlOk,
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Uri),
                )
                OutlinedTextField(model, { model = it }, Modifier.fillMaxWidth(), singleLine = true,
                    label = { Text("Modelo") }, placeholder = { Text("qwen3:8b") })
                OutlinedTextField(
                    key, { key = it }, Modifier.fillMaxWidth(), singleLine = true,
                    label = { Text(if (hasKey) "Chave de API (salva; digite para trocar)" else "Chave de API (opcional)") },
                    visualTransformation = PasswordVisualTransformation(),
                )
                if (hasKey) {
                    TextButton(onClick = {
                        scope.launch {
                            withContext(Dispatchers.IO) { runCatching { graph.secrets.remove(TEXT_API_KEY_SECRET) } }
                            hasKey = false
                            graph.saveTextChain(textChainOf(mode, baseUrl, model, false))
                            message = "Chave removida"
                        }
                    }) { Text("Remover chave salva") }
                }
                if ((hasKey || key.isNotBlank()) && baseUrl.trim().startsWith("http://")) {
                    Text(
                        "Atenção: com http:// a chave trafega sem criptografia. Use só na sua rede local.",
                        color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall,
                    )
                }
            }
            Button(onClick = { save() }, enabled = canSave) { Text("Salvar") }

            Text("Testar", style = MaterialTheme.typography.titleMedium)
            OutlinedTextField(prompt, { prompt = it }, Modifier.fillMaxWidth(), label = { Text("Pedido") })
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Button(enabled = canSave && running == null && prompt.isNotBlank(), onClick = {
                    save {
                        answer = null
                        running = scope.launch {
                            val t0 = System.currentTimeMillis()
                            answer = try {
                                val out = graph.textGenerator.generate(TextRequest(system = null, prompt = prompt, maxTokens = 200))
                                val who = graph.textGenerator.chain.lastServedBy.value?.displayName ?: "?"
                                "$out\n\n— $who, ${(System.currentTimeMillis() - t0) / 100 / 10.0} s"
                            } catch (e: CancellationException) {
                                "Cancelado"
                            } catch (e: Exception) {
                                describeTextError(e)
                            } finally {
                                running = null
                            }
                        }
                    }
                }) { Text("Salvar e testar") }
                if (running != null) OutlinedButton(onClick = { running?.cancel() }) { Text("Cancelar") }
            }
            if (running != null) LinearProgressIndicator(Modifier.fillMaxWidth())
            answer?.let { Card(Modifier.fillMaxWidth()) { Text(it, Modifier.padding(12.dp)) } }
            message?.let { Text(it, style = MaterialTheme.typography.bodySmall) }
        }
    }
}
