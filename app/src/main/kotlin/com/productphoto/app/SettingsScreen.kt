package com.productphoto.app

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.Card
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
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
import androidx.compose.ui.unit.dp
import com.productphoto.ai.api.Capability
import com.productphoto.ai.api.ChainEntry
import com.productphoto.feature.product.RemoverMode
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SettingsScreen(
    graph: AppGraph,
    onTextAi: () -> Unit,
    onModels: () -> Unit,
    onBack: () -> Unit,
) {
    val scope = rememberCoroutineScope()
    var removerMode by remember { mutableStateOf(RemoverMode.AUTO) }

    LaunchedEffect(Unit) {
        val mode = withContext(Dispatchers.IO) {
            val chain = graph.configStore.load().chainFor(Capability.BACKGROUND_REMOVER).map { it.provider }
            when (chain) {
                listOf("mlkit.subject") -> RemoverMode.MLKIT
                listOf("onnx.u2netp") -> RemoverMode.U2NETP
                else -> RemoverMode.AUTO
            }
        }
        removerMode = mode
    }

    fun updateRemoverMode(mode: RemoverMode) {
        removerMode = mode
        scope.launch(Dispatchers.IO) {
            val chain = when (mode) {
                RemoverMode.AUTO -> listOf("mlkit.subject", "onnx.u2netp")
                RemoverMode.MLKIT -> listOf("mlkit.subject")
                RemoverMode.U2NETP -> listOf("onnx.u2netp")
            }.map { ChainEntry(it) }
            graph.configStore.save(graph.configStore.load().withChain(Capability.BACKGROUND_REMOVER, chain))
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Ajustes & IA") },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Voltar")
                    }
                },
            )
        },
    ) { pad ->
        Column(
            Modifier
                .padding(pad)
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp),
        ) {
            Text("Aparência & Paleta de Cores", style = MaterialTheme.typography.titleMedium)
            ThemePaletteSelector(
                current = graph.themeStyle.value,
                onSelect = { graph.setThemeStyle(it) },
            )

            Text("Inteligência Artificial & Modelos", style = MaterialTheme.typography.titleMedium)

            SettingsNavCard(
                title = "Texto com IA",
                subtitle = "Configure o provedor (Gemini Nano, modelos LiteRT locais ou servidor OpenAI/Ollama)",
                onClick = onTextAi,
            )

            SettingsNavCard(
                title = "Modelos no Aparelho",
                subtitle = "Gerencie o download e armazenamento de modelos locais (Gemma, Qwen)",
                onClick = onModels,
            )

            Text("Processamento de Imagem", style = MaterialTheme.typography.titleMedium)
            Card(Modifier.fillMaxWidth()) {
                Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text("Motor de Recorte Padrão", style = MaterialTheme.typography.titleSmall)
                    Text(
                        "Automático: usa ML Kit se Google Play Services estiver presente, com fallback para u2netp local.",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        RemoverMode.entries.forEach { mode ->
                            FilterChip(
                                selected = removerMode == mode,
                                onClick = { updateRemoverMode(mode) },
                                label = { Text(mode.label) },
                            )
                        }
                    }
                }
            }

            Text("Nuvem & Servidor", style = MaterialTheme.typography.titleMedium)
            Card(Modifier.fillMaxWidth()) {
                Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    Text("Serviço de Geração de Imagem", style = MaterialTheme.typography.titleSmall)
                    Text("Endereço: ${BuildConfig.IAWRAPPER_URL}", style = MaterialTheme.typography.bodySmall)
                    Text("Feature: ${BuildConfig.IAWRAPPER_FEATURE}", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
            }

            Text("Sobre", style = MaterialTheme.typography.titleMedium)
            Card(Modifier.fillMaxWidth()) {
                Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    Text("Pocket Studio", style = MaterialTheme.typography.titleSmall)
                    Text("Versão 0.4.0 (Offline First)", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    Text("Estúdio fotográfico comercial com IA local e remota.", style = MaterialTheme.typography.bodySmall)
                }
            }
        }
    }
}

@Composable
private fun SettingsNavCard(title: String, subtitle: String, onClick: () -> Unit) {
    Card(Modifier.fillMaxWidth().clickable(onClick = onClick)) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Text(title, style = MaterialTheme.typography.titleSmall)
            Text(subtitle, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
    }
}
