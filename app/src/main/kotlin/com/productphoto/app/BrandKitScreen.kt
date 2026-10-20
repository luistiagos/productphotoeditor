package com.productphoto.app

import android.graphics.Bitmap
import android.graphics.Typeface
import androidx.activity.compose.BackHandler
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.PickVisualMediaRequest
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.produceState
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.unit.dp
import com.productphoto.data.BrandColors
import com.productphoto.data.BrandKit
import com.productphoto.editor.EditorAssets
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

private val PALETTE = listOf("#212121", "#FFFFFF", "#E53935", "#D81B60", "#8E24AA", "#3949AB", "#1E88E5", "#00ACC1",
    "#43A047", "#7CB342", "#FDD835", "#FFB300", "#FB8C00", "#6D4C41", "#546E7A", "#FFF8E1")

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun BrandKitScreen(graph: AppGraph, onBack: () -> Unit) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val snackbar = remember { SnackbarHostState() }
    var kit by remember { mutableStateOf<BrandKit?>(null) }
    // o que está gravado: Voltar com kit != saved pergunta antes de descartar (ARQUITETURA §29)
    var saved by remember { mutableStateOf<BrandKit?>(null) }
    var confirmLeave by remember { mutableStateOf(false) }
    var logo by remember { mutableStateOf<Bitmap?>(null) }
    var fontRole by remember { mutableStateOf<String?>(null) }
    LaunchedEffect(Unit) {
        val k = graph.brandKits.load()
        kit = k
        saved = k
        logo = k.logoBlob?.let { graph.editorAssets.blobFile(it) }?.let { f ->
            withContext(Dispatchers.IO) { runCatching { EditorAssets.decodeBytes(f.readBytes(), 512) }.getOrNull() }
        }
    }
    val pickLogo = rememberLauncherForActivityResult(ActivityResultContracts.PickVisualMedia()) { uri ->
        if (uri != null) scope.launch {
            runCatching {
                val bytes = withContext(Dispatchers.IO) { context.contentResolver.openInputStream(uri)!!.use { it.readBytes() } }
                val bmp = withContext(Dispatchers.Default) { EditorAssets.decodeBytes(bytes, 1024) }
                val name = graph.editorAssets.putPng(bmp, "logo")
                kit = kit?.copy(logoBlob = name)
                logo = bmp
            }.onFailure { snackbar.showSnackbar("Imagem inválida: ${it.message}") }
        }
    }

    BackHandler(enabled = kit != saved) { confirmLeave = true }
    suspend fun save(k: BrandKit) {
        graph.brandKits.save(k)
        saved = k
    }

    Scaffold(topBar = { TopAppBar(title = { Text("Brand kit") }) }, snackbarHost = { SnackbarHost(snackbar) }) { pad ->
        val k = kit ?: return@Scaffold Box(Modifier.padding(pad).fillMaxSize())
        Column(Modifier.padding(pad).fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Text("Empresa", style = MaterialTheme.typography.titleMedium)
            val p = k.profile
            Field("Nome da empresa", p.company) { kit = k.copy(profile = p.copy(company = it)) }
            Field("Slogan", p.slogan) { kit = k.copy(profile = p.copy(slogan = it)) }
            Field("Telefone", p.phone) { kit = k.copy(profile = p.copy(phone = it)) }
            Field("E-mail", p.email) { kit = k.copy(profile = p.copy(email = it)) }
            Field("Site", p.website) { kit = k.copy(profile = p.copy(website = it)) }
            Field("Endereço", p.address) { kit = k.copy(profile = p.copy(address = it)) }

            Text("Cores", style = MaterialTheme.typography.titleMedium)
            val c = k.colors
            ColorRow("Principal", c.primary) { kit = k.copy(colors = c.copy(primary = it)) }
            ColorRow("Secundária", c.secondary) { kit = k.copy(colors = c.copy(secondary = it)) }
            ColorRow("Destaque", c.accent) { kit = k.copy(colors = c.copy(accent = it)) }
            ColorRow("Texto", c.text) { kit = k.copy(colors = c.copy(text = it)) }
            ColorRow("Fundo", c.background) { kit = k.copy(colors = c.copy(background = it)) }

            Text("Fontes", style = MaterialTheme.typography.titleMedium)
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedButton(onClick = { fontRole = "heading" }) { Text("Títulos: " + k.fonts.heading.ifEmpty { "—" }) }
                OutlinedButton(onClick = { fontRole = "body" }) { Text("Texto: " + k.fonts.body.ifEmpty { "—" }) }
            }

            Text("Logo", style = MaterialTheme.typography.titleMedium)
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                Box(Modifier.size(72.dp).border(1.dp, MaterialTheme.colorScheme.outline), contentAlignment = Alignment.Center) {
                    logo?.let { Image(it.asImageBitmap(), "logo", contentScale = ContentScale.Fit, modifier = Modifier.fillMaxSize()) }
                }
                OutlinedButton(onClick = { pickLogo.launch(PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly)) }) { Text("Escolher") }
                if (k.logoBlob != null) TextButton(onClick = { kit = k.copy(logoBlob = null); logo = null }) { Text("Remover") }
            }

            Button(onClick = {
                scope.launch { save(k); snackbar.showSnackbar("Brand kit salvo") }
            }, modifier = Modifier.fillMaxWidth()) { Text("Salvar") }
        }
        if (confirmLeave) {
            AlertDialog(
                onDismissRequest = { confirmLeave = false },
                title = { Text("Sair sem salvar?") },
                text = { Text("As alterações no brand kit ainda não foram salvas.") },
                confirmButton = {
                    TextButton(onClick = { confirmLeave = false; scope.launch { save(k); onBack() } }) { Text("Salvar") }
                },
                dismissButton = {
                    Row {
                        TextButton(onClick = { confirmLeave = false }) { Text("Continuar editando") }
                        TextButton(onClick = { confirmLeave = false; onBack() }) { Text("Descartar") }
                    }
                },
            )
        }
        fontRole?.let { role ->
            // cada nome na própria fonte; carregada fora da thread principal (o nome aparece antes na fonte do sistema)
            val faces by produceState(emptyMap<String, FontFamily>()) {
                value = withContext(Dispatchers.IO) {
                    graph.bundledFonts.mapNotNull { f ->
                        // peso 400, como no editor: as fontes variáveis (Montserrat, Raleway…) abrem em 100 por padrão
                        runCatching {
                            val face = Typeface.Builder(context.assets, f.assetPath).setFontVariationSettings("'wght' 400").build()
                            f.family to FontFamily(face)
                        }.getOrNull()
                    }.toMap()
                }
            }
            AlertDialog(
                onDismissRequest = { fontRole = null },
                title = { Text(if (role == "heading") "Fonte dos títulos" else "Fonte do texto") },
                text = {
                    Column(Modifier.verticalScroll(rememberScrollState())) {
                        (listOf("") + graph.bundledFonts.map { it.family }).forEach { fam ->
                            Text(fam.ifEmpty { "(padrão)" }, fontFamily = faces[fam], style = MaterialTheme.typography.titleMedium,
                                modifier = Modifier.fillMaxWidth().clickable {
                                    kit = k.copy(fonts = if (role == "heading") k.fonts.copy(heading = fam) else k.fonts.copy(body = fam))
                                    fontRole = null
                                }.padding(vertical = 10.dp))
                        }
                    }
                },
                confirmButton = { TextButton(onClick = { fontRole = null }) { Text("Fechar") } },
            )
        }
    }
}

@Composable
private fun Field(label: String, value: String, onChange: (String) -> Unit) {
    OutlinedTextField(value, onChange, label = { Text(label) }, singleLine = true, modifier = Modifier.fillMaxWidth())
}

@Composable
private fun ColorRow(label: String, value: String, onChange: (String) -> Unit) {
    var open by remember { mutableStateOf(false) }
    val valid = BrandColors.HEX.matches(value)
    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
        Box(
            Modifier.size(36.dp).background(if (valid) parse(value) else Color.Transparent, CircleShape)
                .border(1.dp, MaterialTheme.colorScheme.outline, CircleShape).clickable { open = true },
        )
        OutlinedTextField(value, { onChange(it.trim()) }, label = { Text(label) }, singleLine = true, isError = value.isNotEmpty() && !valid,
            placeholder = { Text("#RRGGBB") }, modifier = Modifier.weight(1f))
    }
    if (open) {
        AlertDialog(
            onDismissRequest = { open = false },
            title = { Text(label) },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    PALETTE.chunked(4).forEach { row ->
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            row.forEach { hex ->
                                Box(Modifier.size(44.dp).background(parse(hex), CircleShape).border(1.dp, MaterialTheme.colorScheme.outline, CircleShape)
                                    .clickable { onChange(hex); open = false })
                            }
                        }
                    }
                }
            },
            confirmButton = { TextButton(onClick = { onChange(""); open = false }) { Text("Sem cor") } },
        )
    }
}

private fun parse(hex: String) = Color(android.graphics.Color.parseColor(hex))
