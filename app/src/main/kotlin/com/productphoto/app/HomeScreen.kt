package com.productphoto.app

import android.graphics.BitmapFactory
import androidx.compose.foundation.Image
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Card
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
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
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.TextRange
import androidx.compose.ui.text.input.TextFieldValue
import androidx.compose.ui.unit.dp
import com.productphoto.data.DraftInfo
import com.productphoto.data.DraftRepository
import com.productphoto.data.MAX_DRAFT_NAME
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.text.DateFormat
import java.util.Date

/** Tamanhos para "Novo design" (os mesmos presets do painel Tamanho do editor). */
private val NEW_SIZES = listOf(
    Triple("Post quadrado", 1080, 1080), Triple("Post retrato 4:5", 1080, 1350), Triple("Story / Reels", 1080, 1920),
    Triple("Banner 16:9", 1920, 1080), Triple("Logo", 1000, 1000), Triple("Cartão de visita", 1050, 600),
    Triple("Folheto A4", 1240, 1754),
)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun HomeScreen(
    onProductPhoto: () -> Unit,
    onNewDesign: (name: String, w: Int, h: Int) -> Unit,
    onTemplates: () -> Unit,
    onDrafts: () -> Unit,
    onBrandKit: () -> Unit,
    onModels: () -> Unit,
    onTextAi: () -> Unit,
    onImageGen: () -> Unit,
    onMockup: () -> Unit,
) {
    var choosingSize by remember { mutableStateOf(false) }
    Scaffold(topBar = { TopAppBar(title = { Text("Foto de Produto") }) }) { pad ->
        Column(
            Modifier.padding(pad).fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            HomeCard("Foto de produto", "Recorte o produto e componha num cenário com sombra e luz", onProductPhoto)
            HomeCard("Novo design", "Pôster, post, logo ou cartão a partir de uma página em branco") { choosingSize = true }
            HomeCard("Templates", "Comece de um template pronto, já com as cores da sua marca", onTemplates)
            HomeCard("Rascunhos", "Continue de onde parou", onDrafts)
            HomeCard("Brand kit", "Cores, fontes, logo e dados da empresa", onBrandKit)
            HomeCard("Mockup", "Veja o seu design num pôster, cartão, caixa ou tela de celular", onMockup)
            HomeCard("Gerar imagem", "Pôster ou logo por texto num servidor Stable Diffusion seu (A1111 ou ComfyUI)", onImageGen)
            HomeCard("Texto com IA", "Onde rodam o \"Reescrever\" e o \"Gerar textos\": no aparelho ou num servidor seu", onTextAi)
            HomeCard("Modelos de IA", "Baixe modelos opcionais: Gemma ou Qwen para texto", onModels)
        }
    }
    if (choosingSize) {
        AlertDialog(
            onDismissRequest = { choosingSize = false },
            title = { Text("Tamanho") },
            text = {
                Column {
                    NEW_SIZES.forEach { (name, w, h) ->
                        Text("$name · $w×$h", Modifier.fillMaxWidth().clickable { choosingSize = false; onNewDesign(name, w, h) }.padding(vertical = 12.dp))
                    }
                }
            },
            confirmButton = { TextButton(onClick = { choosingSize = false }) { Text("Cancelar") } },
        )
    }
}

@Composable
private fun HomeCard(title: String, subtitle: String, onClick: () -> Unit) {
    Card(Modifier.fillMaxWidth().clickable(onClick = onClick)) {
        Column(Modifier.padding(16.dp)) {
            Text(title, style = MaterialTheme.typography.titleMedium)
            Text(subtitle, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun DraftsScreen(repo: DraftRepository, onOpen: (String) -> Unit) {
    var drafts by remember { mutableStateOf<List<DraftInfo>?>(null) }
    var deleting by remember { mutableStateOf<DraftInfo?>(null) }
    var renaming by remember { mutableStateOf<DraftInfo?>(null) }
    val scope = rememberCoroutineScope()
    LaunchedEffect(Unit) { drafts = repo.list() }
    Scaffold(topBar = { TopAppBar(title = { Text("Rascunhos") }) }) { pad ->
        val list = drafts
        when {
            list == null -> Box(Modifier.padding(pad).fillMaxSize())
            list.isEmpty() -> Box(Modifier.padding(pad).fillMaxSize(), contentAlignment = Alignment.Center) { Text("Nenhum rascunho ainda") }
            else -> LazyColumn(Modifier.padding(pad).fillMaxSize()) {
                items(list, key = { it.id }) { d ->
                    Row(
                        Modifier.fillMaxWidth().clickable { onOpen(d.id) }.padding(horizontal = 16.dp, vertical = 10.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        DraftThumb(d)
                        Spacer(Modifier.width(12.dp))
                        Column(Modifier.weight(1f)) {
                            Text(d.name, style = MaterialTheme.typography.titleSmall)
                            Text("${d.width}×${d.height} · " + DateFormat.getDateTimeInstance(DateFormat.SHORT, DateFormat.SHORT).format(Date(d.updatedAt)),
                                style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                        }
                        TextButton(onClick = { renaming = d }) { Text("Renomear") }
                        TextButton(onClick = { deleting = d }) { Text("Excluir") }
                    }
                }
            }
        }
    }
    deleting?.let { d ->
        AlertDialog(
            onDismissRequest = { deleting = null },
            title = { Text("Excluir rascunho?") },
            text = { Text(d.name) },
            confirmButton = { TextButton(onClick = { scope.launch { repo.delete(d.id); drafts = repo.list(); deleting = null } }) { Text("Excluir") } },
            dismissButton = { TextButton(onClick = { deleting = null }) { Text("Cancelar") } },
        )
    }
    renaming?.let { d ->
        // nome inteiro selecionado, como no editor: digitar já substitui
        var field by remember(d.id) { mutableStateOf(TextFieldValue(d.name, TextRange(0, d.name.length))) }
        val focus = remember { FocusRequester() }
        LaunchedEffect(d.id) { runCatching { focus.requestFocus() } }
        val save = {
            scope.launch {
                runCatching { repo.rename(d.id, field.text) } // falha (rascunho sumiu): a lista recarregada mostra o real
                drafts = repo.list()
                renaming = null
            }
        }
        AlertDialog(
            onDismissRequest = { renaming = null },
            title = { Text("Nome do design") },
            text = {
                OutlinedTextField(field, { field = it.copy(text = it.text.take(MAX_DRAFT_NAME)) }, Modifier.fillMaxWidth().focusRequester(focus),
                    singleLine = true)
            },
            confirmButton = { TextButton(onClick = { save() }, enabled = field.text.isNotBlank()) { Text("Salvar") } },
            dismissButton = { TextButton(onClick = { renaming = null }) { Text("Cancelar") } },
        )
    }
}

@Composable
private fun DraftThumb(d: DraftInfo) {
    var bmp by remember(d.id, d.updatedAt) { mutableStateOf<android.graphics.Bitmap?>(null) }
    LaunchedEffect(d.id, d.updatedAt) {
        bmp = d.thumbnail?.let { f -> withContext(Dispatchers.IO) { BitmapFactory.decodeFile(f.absolutePath) } }
    }
    Box(Modifier.size(64.dp), contentAlignment = Alignment.Center) {
        bmp?.let { Image(it.asImageBitmap(), null, contentScale = ContentScale.Fit, modifier = Modifier.fillMaxSize()) }
    }
}
