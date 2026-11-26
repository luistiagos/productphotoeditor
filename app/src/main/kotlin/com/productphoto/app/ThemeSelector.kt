package com.productphoto.app

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Check
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.productphoto.ui.StudioThemeStyle

/**
 * Seletor visual de paletas do estúdio com prévia real de hierarquia, botões e contraste WCAG.
 * Compartilhado entre a tela de Ajustes e o atalho rápido da Home.
 */
@Composable
fun ThemePaletteSelector(
    current: StudioThemeStyle,
    onSelect: (StudioThemeStyle) -> Unit,
    modifier: Modifier = Modifier,
) {
    Column(modifier = modifier, verticalArrangement = Arrangement.spacedBy(10.dp)) {
        StudioThemeStyle.entries.forEach { style ->
            val selected = style == current
            val borderColor = if (selected) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.outlineVariant
            val borderWidth = if (selected) 2.dp else 1.dp

            Card(
                modifier = Modifier
                    .fillMaxWidth()
                    .border(borderWidth, borderColor, RoundedCornerShape(16.dp))
                    .clickable { onSelect(style) },
                shape = RoundedCornerShape(16.dp),
                colors = CardDefaults.cardColors(
                    containerColor = if (selected) MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.25f)
                    else MaterialTheme.colorScheme.surfaceVariant,
                ),
            ) {
                Row(
                    modifier = Modifier.padding(12.dp),
                    horizontalArrangement = Arrangement.spacedBy(14.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    // Mini prévia fiel da paleta (fundo, card, botão primário, destaque IA)
                    MiniThemePreview(style = style)

                    Column(
                        modifier = Modifier.weight(1f),
                        verticalArrangement = Arrangement.spacedBy(4.dp),
                    ) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(6.dp),
                        ) {
                            Text(
                                style.title,
                                style = MaterialTheme.typography.titleSmall.copy(fontWeight = FontWeight.Bold),
                                maxLines = 1,
                                overflow = TextOverflow.Ellipsis,
                            )
                            Box(
                                modifier = Modifier
                                    .background(
                                        style.scheme.primaryContainer,
                                        RoundedCornerShape(6.dp),
                                    )
                                    .padding(horizontal = 6.dp, vertical = 2.dp),
                            ) {
                                Text(
                                    style.badge,
                                    style = MaterialTheme.typography.labelSmall.copy(fontSize = 9.sp, fontWeight = FontWeight.Bold),
                                    color = style.scheme.onPrimaryContainer,
                                )
                            }
                        }
                        Text(
                            style.subtitle,
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            maxLines = 2,
                        )
                    }

                    if (selected) {
                        Box(
                            modifier = Modifier
                                .size(26.dp)
                                .clip(CircleShape)
                                .background(MaterialTheme.colorScheme.primary),
                            contentAlignment = Alignment.Center,
                        ) {
                            Icon(
                                Icons.Default.Check,
                                contentDescription = "Selecionado",
                                tint = MaterialTheme.colorScheme.onPrimary,
                                modifier = Modifier.size(16.dp),
                            )
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun MiniThemePreview(style: StudioThemeStyle) {
    val s = style.scheme
    Box(
        modifier = Modifier
            .width(84.dp)
            .height(64.dp)
            .clip(RoundedCornerShape(12.dp))
            .background(s.background)
            .border(1.dp, s.outline, RoundedCornerShape(12.dp))
            .padding(6.dp),
    ) {
        Column(verticalArrangement = Arrangement.spacedBy(5.dp)) {
            // Barra superior simulada
            Row(
                Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Box(Modifier.width(26.dp).height(5.dp).clip(RoundedCornerShape(3.dp)).background(s.onBackground))
                Box(Modifier.size(8.dp).clip(CircleShape).background(s.secondary))
            }
            // Card elevado simulado
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .weight(1f)
                    .clip(RoundedCornerShape(7.dp))
                    .background(s.surfaceVariant)
                    .padding(5.dp),
            ) {
                Column(verticalArrangement = Arrangement.SpaceBetween, modifier = Modifier.fillMaxWidth()) {
                    Box(Modifier.width(38.dp).height(4.dp).clip(RoundedCornerShape(2.dp)).background(s.onSurfaceVariant))
                    Spacer(Modifier.height(4.dp))
                    Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                        Box(Modifier.weight(1f).height(10.dp).clip(RoundedCornerShape(4.dp)).background(s.primary))
                        Box(Modifier.width(14.dp).height(10.dp).clip(RoundedCornerShape(4.dp)).background(s.secondaryContainer))
                    }
                }
            }
        }
    }
}
