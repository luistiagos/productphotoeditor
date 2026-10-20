package com.productphoto.app

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.AlertDialog
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
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.produceState
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.productphoto.models.ModelEntry
import com.productphoto.models.ModelState
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.util.Locale
import kotlin.math.roundToInt

private fun capabilityLabel(c: String) = when (c) {
    "BACKGROUND_REMOVER" -> "Recorte de fundo"
    "INPAINTER" -> "Remoção de objetos e texto"
    "TEXT_GENERATOR" -> "Texto com IA"
    else -> c
}

private fun megabytes(bytes: Long) = "${(bytes / (1024.0 * 1024.0)).roundToInt()} MB"

/** Espaço em disco: MB até 1 GB, depois GB com uma casa ("3,1 GB"). */
private fun diskSize(bytes: Long): String {
    val gb = bytes / (1024.0 * 1024.0 * 1024.0)
    return if (gb < 1) megabytes(bytes) else String.format(Locale("pt", "BR"), "%.1f GB", gb)
}

/** Catálogo de modelos com estado e ações baixar/cancelar/remover (ARQUITETURA §16.4 task 5). */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ModelsScreen(graph: AppGraph) {
    val states by remember { graph.models.states() }.collectAsState(initial = emptyMap())
    var deleting by remember { mutableStateOf<ModelEntry?>(null) }
    // espaço real (arquivo + cache do LiteRT-LM), relido quando um estado muda (baixou, removeu, progresso)
    val disk by produceState(emptyMap<String, Long>(), states) {
        value = withContext(Dispatchers.IO) { graph.models.catalog.models.associate { it.id to graph.modelDiskBytes(it.id) } }
    }
    Scaffold(topBar = { TopAppBar(title = { Text("Modelos de IA") }) }) { pad ->
        LazyColumn(
            Modifier.padding(pad).fillMaxSize(),
            contentPadding = PaddingValues(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            item(key = "total") {
                Text("Modelos no aparelho: ${diskSize(disk.values.sum())}", style = MaterialTheme.typography.titleSmall)
            }
            items(graph.models.catalog.models, key = { it.id }) { e ->
                ModelCard(
                    e, states[e.id], disk[e.id] ?: 0,
                    onDownload = { graph.models.download(e.id) },
                    onCancel = { graph.models.cancel(e.id) },
                    onDelete = { deleting = e },
                )
            }
        }
    }
    deleting?.let { e ->
        AlertDialog(
            onDismissRequest = { deleting = null },
            title = { Text("Remover ${e.id}?") },
            text = { Text("Libera ${diskSize(disk[e.id] ?: e.sizeBytes)}. Dá para baixar de novo depois.") },
            confirmButton = { TextButton(onClick = { graph.deleteModel(e.id); deleting = null }) { Text("Remover") } },
            dismissButton = { TextButton(onClick = { deleting = null }) { Text("Cancelar") } },
        )
    }
}

@Composable
private fun ModelCard(
    e: ModelEntry,
    state: ModelState?,
    diskBytes: Long,
    onDownload: () -> Unit,
    onCancel: () -> Unit,
    onDelete: () -> Unit,
) {
    Card(Modifier.fillMaxWidth()) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Text(e.id, style = MaterialTheme.typography.titleMedium)
            val ram = if (e.minRamMb > 0) " · pede ${e.minRamMb / 1024} GB de RAM" else ""
            Text("${capabilityLabel(e.capability)} · ${megabytes(e.sizeBytes)}$ram", style = MaterialTheme.typography.bodyMedium)
            Text(e.license, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
            if (e.bundledAsset != null) {
                val used = if (diskBytes > 0) " · ocupa ${diskSize(diskBytes)}" else ""
                Text("Incluído no app$used", style = MaterialTheme.typography.labelLarge)
                return@Column
            }
            when (state) {
                is ModelState.Downloading -> {
                    LinearProgressIndicator(progress = { state.fraction }, modifier = Modifier.fillMaxWidth())
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text(
                            "Baixando… ${(state.fraction * 100).roundToInt()}%",
                            Modifier.weight(1f), style = MaterialTheme.typography.bodySmall,
                        )
                        OutlinedButton(onClick = onCancel) { Text("Cancelar") }
                    }
                }
                ModelState.Ready -> Row(verticalAlignment = Alignment.CenterVertically) {
                    Text("Pronto no aparelho · ocupa ${diskSize(diskBytes)}", Modifier.weight(1f), style = MaterialTheme.typography.labelLarge)
                    OutlinedButton(onClick = onDelete) { Text("Remover") }
                }
                ModelState.Corrupt -> Column {
                    Text("O arquivo baixado veio corrompido duas vezes.", color = MaterialTheme.colorScheme.error)
                    Button(onClick = onDownload) { Text("Baixar de novo") }
                }
                is ModelState.Failed -> Column {
                    Text("Falhou: ${state.reason}", color = MaterialTheme.colorScheme.error)
                    Button(onClick = onDownload) { Text("Tentar de novo") }
                }
                ModelState.NotDownloaded, null -> Button(onClick = onDownload) { Text("Baixar (${megabytes(e.sizeBytes)})") }
            }
        }
    }
}
