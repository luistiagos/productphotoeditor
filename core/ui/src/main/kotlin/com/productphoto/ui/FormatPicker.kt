package com.productphoto.ui

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.GridItemSpan
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.Button
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedCard
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.compositeOver
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.drawText
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.rememberTextMeasurer
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import kotlin.math.min

/** Mesmo formato? O personalizado compara pelo tamanho, os do catálogo pelo id. */
private fun MediaFormat.sameAs(o: MediaFormat?) = o != null && id == o.id && (!isCustom || (width == o.width && height == o.height))

/**
 * Campo de formato: mostra o escolhido (desenho, nome, tamanho) e abre a folha [FormatPickerSheet] ao tocar.
 * [maxSide] e [maxAspect] limitam o personalizado (cada tela tem o seu teto; null = proporção livre).
 */
@Composable
fun FormatPicker(
    selected: MediaFormat,
    formats: List<MediaFormat>,
    onSelect: (MediaFormat) -> Unit,
    modifier: Modifier = Modifier,
    maxSide: Int = 8000,
    maxAspect: Float? = null,
    enabled: Boolean = true,
) {
    var open by remember { mutableStateOf(false) }
    OutlinedCard(modifier.fillMaxWidth().clickable(enabled = enabled) { open = true }) {
        Row(Modifier.padding(10.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            FormatThumbnail(selected, Modifier.size(52.dp))
            Column(Modifier.weight(1f)) {
                Text("Formato", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                Text(selected.label, style = MaterialTheme.typography.titleSmall)
                Text(
                    listOf(selected.sizeLabel, selected.hint).filter { it.isNotEmpty() }.joinToString(" · "),
                    style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
            Text("Trocar", style = MaterialTheme.typography.labelLarge, color = MaterialTheme.colorScheme.primary)
        }
    }
    if (open) FormatPickerSheet(formats, selected, maxSide, maxAspect, onDismiss = { open = false }) { open = false; onSelect(it) }
}

/** Folha com os formatos agrupados em grade de cartões desenhados + o tamanho personalizado no fim. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun FormatPickerSheet(
    formats: List<MediaFormat>,
    selected: MediaFormat?,
    maxSide: Int = 8000,
    maxAspect: Float? = null,
    onDismiss: () -> Unit,
    onSelect: (MediaFormat) -> Unit,
) {
    val sheet = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    val groups = remember(formats) { formats.groupBy { it.group }.toSortedMap() }
    ModalBottomSheet(onDismissRequest = onDismiss, sheetState = sheet) {
        LazyVerticalGrid(
            GridCells.Adaptive(104.dp),
            Modifier.fillMaxWidth().padding(horizontal = 12.dp),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            item(span = { GridItemSpan(maxLineSpan) }) { Text("Escolha o formato", style = MaterialTheme.typography.titleMedium) }
            groups.forEach { (group, list) ->
                item(span = { GridItemSpan(maxLineSpan) }) {
                    Text(group.label, Modifier.padding(top = 8.dp), style = MaterialTheme.typography.labelLarge,
                        color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
                items(list, key = { it.id }) { f -> FormatTile(f, f.sameAs(selected)) { onSelect(f) } }
            }
            item(span = { GridItemSpan(maxLineSpan) }) {
                CustomSize(selected, maxSide, maxAspect, onSelect)
            }
        }
    }
}

@Composable
private fun FormatTile(f: MediaFormat, selected: Boolean, onClick: () -> Unit) {
    val border = if (selected) BorderStroke(2.dp, MaterialTheme.colorScheme.primary) else BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant)
    OutlinedCard(onClick = onClick, border = border) {
        Column(Modifier.padding(8.dp), horizontalAlignment = Alignment.CenterHorizontally) {
            FormatThumbnail(f, Modifier.fillMaxWidth().height(84.dp))
            Text(f.label, style = MaterialTheme.typography.labelMedium, maxLines = 2, overflow = TextOverflow.Ellipsis,
                textAlign = TextAlign.Center, modifier = Modifier.padding(top = 6.dp))
            Text(f.sizeLabel, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
    }
}

/** Valida o tamanho digitado: inteiros entre 16 e [maxSide] e, se dado, lado maior ≤ [maxAspect] × o menor. Null = inválido. */
fun parseCustomSize(w: String, h: String, maxSide: Int, maxAspect: Float? = null): Pair<Int, Int>? {
    val W = w.trim().toIntOrNull() ?: return null
    val H = h.trim().toIntOrNull() ?: return null
    if (W !in 16..maxSide || H !in 16..maxSide) return null
    if (maxAspect != null && maxOf(W, H) > maxAspect * minOf(W, H)) return null
    return W to H
}

@Composable
private fun CustomSize(start: MediaFormat?, maxSide: Int, maxAspect: Float?, onSelect: (MediaFormat) -> Unit) {
    var w by remember { mutableStateOf((start?.width ?: 1080).coerceAtMost(maxSide).toString()) }
    var h by remember { mutableStateOf((start?.height ?: 1080).coerceAtMost(maxSide).toString()) }
    val size = parseCustomSize(w, h, maxSide, maxAspect)
    Column(Modifier.padding(top = 8.dp, bottom = 24.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Text("Personalizado", style = MaterialTheme.typography.labelLarge, color = MaterialTheme.colorScheme.onSurfaceVariant)
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
            Box(Modifier.size(64.dp)) { if (size != null) FormatThumbnail(MediaFormat.custom(size.first, size.second), Modifier.fillMaxSize()) }
            val num = KeyboardOptions(keyboardType = KeyboardType.Number)
            OutlinedTextField(w, { w = it.filter(Char::isDigit).take(5) }, Modifier.weight(1f), label = { Text("Largura") }, singleLine = true, keyboardOptions = num)
            OutlinedTextField(h, { h = it.filter(Char::isDigit).take(5) }, Modifier.weight(1f), label = { Text("Altura") }, singleLine = true, keyboardOptions = num)
        }
        val rule = "Use de 16 a $maxSide px em cada lado" + (maxAspect?.let { ", com um lado até ${it.toInt()}× o outro" } ?: "") + "."
        if (size == null) Text(rule, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.error)
        Button(enabled = size != null, onClick = { size?.let { (W, H) -> onSelect(MediaFormat.custom(W, H)) } }, modifier = Modifier.fillMaxWidth()) {
            Text(if (size != null) "Usar ${size.first}×${size.second}" else "Usar")
        }
    }
}

private val BADGE = mapOf(FormatPlatform.INSTAGRAM to "IG", FormatPlatform.FACEBOOK to "f", FormatPlatform.YOUTUBE to "▶", FormatPlatform.TIKTOK to "♪",
    FormatPlatform.LINKEDIN to "in")

/**
 * Desenho do formato: um retângulo na proporção exata, centrado em [modifier], com o "jeito" da rede por cima
 * ([FormatLook]) — o usuário reconhece o Reels pelos ícones na lateral, a thumbnail pelo play, a capa pelo perfil.
 */
@Composable
fun FormatThumbnail(f: MediaFormat, modifier: Modifier = Modifier) {
    val measurer = rememberTextMeasurer()
    val brand = Color(f.platform.argb)
    val surface = MaterialTheme.colorScheme.surfaceVariant
    val ink = MaterialTheme.colorScheme.onSurfaceVariant
    Canvas(modifier) {
        val pad = 2.dp.toPx()
        val availW = size.width - 2 * pad
        val availH = size.height - 2 * pad
        val w = min(availW, availH * f.aspect)
        val h = w / f.aspect
        val r = Rect(Offset((size.width - w) / 2, (size.height - h) / 2), Size(w, h))
        val corner = CornerRadius(min(w, h) * 0.06f)
        val u = min(w, h) // unidade para ícones, para não sumirem nos formatos finos
        val bg = if (f.look == FormatLook.PAGE) Color.White else brand.copy(alpha = 0.16f).compositeOver(surface)
        drawRoundRect(bg, r.topLeft, r.size, corner)
        when (f.look) {
            FormatLook.PLAIN -> picture(r.center, u * 0.5f, ink.copy(alpha = 0.55f))
            FormatLook.FEED -> {
                picture(Offset(r.center.x, r.top + h * 0.42f), u * 0.45f, ink.copy(alpha = 0.55f))
                val bar = h * 0.16f
                drawRect(surface, Offset(r.left, r.bottom - bar), Size(w, bar))
                for (i in 0..2) drawCircle(ink.copy(alpha = 0.7f), bar * 0.22f, Offset(r.left + bar * (0.6f + i * 0.75f), r.bottom - bar / 2))
            }
            FormatLook.VERTICAL_VIDEO -> {
                picture(Offset(r.center.x, r.top + h * 0.38f), u * 0.5f, ink.copy(alpha = 0.45f))
                val d = w * 0.075f
                for (i in 0..3) drawCircle(Color.White.copy(alpha = 0.9f), d, Offset(r.right - d * 2f, r.top + h * (0.48f + i * 0.1f)))
                drawRoundRect(ink.copy(alpha = 0.6f), Offset(r.left + w * 0.08f, r.top + h * 0.84f), Size(w * 0.6f, h * 0.025f), CornerRadius(h * 0.0125f))
                drawRoundRect(ink.copy(alpha = 0.4f), Offset(r.left + w * 0.08f, r.top + h * 0.9f), Size(w * 0.4f, h * 0.025f), CornerRadius(h * 0.0125f))
            }
            FormatLook.THUMBNAIL -> {
                val bw = u * 0.42f
                val bh = bw * 0.7f
                drawRoundRect(brand, Offset(r.center.x - bw / 2, r.center.y - bh / 2), Size(bw, bh), CornerRadius(bh * 0.25f))
                val t = bh * 0.28f
                drawPath(Path().apply {
                    moveTo(r.center.x - t * 0.7f, r.center.y - t); lineTo(r.center.x + t, r.center.y); lineTo(r.center.x - t * 0.7f, r.center.y + t); close()
                }, Color.White)
                drawRoundRect(Color.Black.copy(alpha = 0.75f), Offset(r.right - w * 0.2f, r.bottom - h * 0.17f), Size(w * 0.15f, h * 0.11f), CornerRadius(2f))
            }
            FormatLook.COVER -> {
                picture(Offset(r.left + w * 0.6f, r.center.y), u * 0.5f, ink.copy(alpha = 0.45f))
                val rad = h * 0.3f
                val c = Offset(r.left + w * 0.06f + rad, r.bottom - rad * 0.8f)
                drawCircle(Color.White, rad, c)
                drawCircle(brand, rad * 0.8f, c)
            }
            FormatLook.CHANNEL_BANNER -> {
                // faixa segura do YouTube: 1546×423 de 2560×1440
                val sw = w * 1546f / 2560f
                val sh = h * 423f / 1440f
                val tl = Offset(r.center.x - sw / 2, r.center.y - sh / 2)
                drawRect(surface, tl, Size(sw, sh))
                drawRect(brand, tl, Size(sw, sh), style = Stroke(1.5f, pathEffect = PathEffect.dashPathEffect(floatArrayOf(6f, 4f))))
                drawRoundRect(ink.copy(alpha = 0.6f), Offset(r.center.x - sw * 0.3f, r.center.y - sh * 0.1f), Size(sw * 0.6f, sh * 0.2f), CornerRadius(sh * 0.1f))
            }
            FormatLook.PROFILE -> {
                val rad = u * 0.46f
                drawCircle(surface, rad, r.center)
                drawCircle(brand, rad, r.center, style = Stroke(2f))
                drawCircle(ink.copy(alpha = 0.6f), rad * 0.32f, Offset(r.center.x, r.center.y - rad * 0.22f))
                drawArc(ink.copy(alpha = 0.6f), 180f, 180f, true, Offset(r.center.x - rad * 0.6f, r.center.y + rad * 0.2f), Size(rad * 1.2f, rad * 1.1f))
            }
            FormatLook.PAGE -> {
                val fold = u * 0.22f
                drawPath(Path().apply { moveTo(r.right - fold, r.top); lineTo(r.right, r.top + fold); lineTo(r.right - fold, r.top + fold); close() }, Color(0xFFD9DDE5))
                for (i in 0..3) {
                    val lw = if (i == 0) w * 0.5f else w * (0.7f - i * 0.08f)
                    drawRect(Color(0xFFB8BEC9), Offset(r.left + w * 0.12f, r.top + h * (0.3f + i * 0.13f)), Size(lw, u * 0.05f))
                }
            }
        }
        drawRoundRect(brand.copy(alpha = 0.6f), r.topLeft, r.size, corner, style = Stroke(1.5f))
        BADGE[f.platform]?.let { txt ->
            val b = (u * 0.24f).coerceIn(10.dp.toPx(), 18.dp.toPx())
            val tl = Offset(r.left + 3.dp.toPx(), r.top + 3.dp.toPx())
            drawRoundRect(brand, tl, Size(b, b), CornerRadius(b * 0.25f))
            val style = TextStyle(color = Color.White, fontSize = (b * 0.55f).toSp(), fontWeight = FontWeight.Bold)
            val layout = measurer.measure(txt, style)
            drawText(layout, topLeft = Offset(tl.x + (b - layout.size.width) / 2, tl.y + (b - layout.size.height) / 2))
        }
    }
}

/** Ícone de "foto" (sol + montanha) centrado em [c], largura [s]. */
private fun DrawScope.picture(c: Offset, s: Float, color: Color) {
    drawCircle(color, s * 0.1f, Offset(c.x + s * 0.22f, c.y - s * 0.2f))
    drawPath(Path().apply {
        moveTo(c.x - s / 2, c.y + s * 0.3f); lineTo(c.x - s * 0.12f, c.y - s * 0.12f); lineTo(c.x + s * 0.1f, c.y + s * 0.1f)
        lineTo(c.x + s * 0.25f, c.y - s * 0.02f); lineTo(c.x + s / 2, c.y + s * 0.3f); close()
    }, color)
}
