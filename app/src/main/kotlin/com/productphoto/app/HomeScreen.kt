package com.productphoto.app

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.snapping.rememberSnapFlingBehavior
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.GridItemSpan
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AutoAwesome
import androidx.compose.material.icons.filled.Folder
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.Palette
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material.icons.filled.Star
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedCard
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
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.graphics.luminance
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.TextRange
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.TextFieldValue
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.productphoto.data.BrandKit
import com.productphoto.data.DraftInfo
import com.productphoto.data.DraftRepository
import com.productphoto.data.MAX_DRAFT_NAME
import com.productphoto.ui.FormatPickerSheet
import com.productphoto.ui.MediaFormats
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.text.DateFormat
import java.util.Date

enum class HomeTab(val label: String, val icon: ImageVector) {
    STUDIO("Início", Icons.Default.Home),
    TEMPLATES("Templates", Icons.Default.AutoAwesome),
    PROJECTS("Projetos", Icons.Default.Folder),
    BRAND("Marca", Icons.Default.Star),
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun HomeScreen(
    graph: AppGraph,
    onProductPhoto: () -> Unit,
    onBgRemover: () -> Unit,
    onUpscaler: () -> Unit,
    onNewDesign: (name: String, w: Int, h: Int) -> Unit,
    onTemplates: () -> Unit,
    onDrafts: () -> Unit,
    onBrandKit: () -> Unit,
    onModels: () -> Unit,
    onTextAi: () -> Unit,
    onImageGen: () -> Unit,
    onMockup: () -> Unit,
    onSettings: () -> Unit,
) {
    var choosingSize by remember { mutableStateOf(false) }
    var choosingTheme by remember { mutableStateOf(false) }
    var currentTab by rememberSaveable { mutableStateOf(HomeTab.STUDIO) }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        Text("Pocket Studio", style = MaterialTheme.typography.titleLarge.copy(fontWeight = FontWeight.Bold))
                    }
                },
                actions = {
                    IconButton(onClick = { choosingTheme = true }) {
                        Icon(Icons.Default.Palette, contentDescription = "Paleta de Cores")
                    }
                    IconButton(onClick = onSettings) {
                        Icon(Icons.Default.Settings, contentDescription = "Ajustes & IA")
                    }
                },
            )
        },
        bottomBar = {
            NavigationBar(
                containerColor = MaterialTheme.colorScheme.surface,
                contentColor = MaterialTheme.colorScheme.onSurface,
            ) {
                HomeTab.entries.forEach { tab ->
                    NavigationBarItem(
                        selected = currentTab == tab,
                        onClick = { currentTab = tab },
                        icon = { Icon(tab.icon, contentDescription = tab.label) },
                        label = { Text(tab.label) },
                    )
                }
            }
        },
    ) { pad ->
        Box(Modifier.padding(pad).fillMaxSize()) {
            when (currentTab) {
                HomeTab.STUDIO -> StudioTab(
                    graph = graph,
                    onProductPhoto = onProductPhoto,
                    onBgRemover = onBgRemover,
                    onUpscaler = onUpscaler,
                    onNewDesignClick = { choosingSize = true },
                    onImageGen = onImageGen,
                    onMockup = onMockup,
                    onOpenDraft = { id -> onNewDesign("draft", 0, 0) /* Navigator handles drafts */ },
                    onDraftsClick = { currentTab = HomeTab.PROJECTS },
                    onTemplatesClick = { currentTab = HomeTab.TEMPLATES },
                )
                HomeTab.TEMPLATES -> TemplatesTab(onOpenTemplatesGallery = onTemplates)
                HomeTab.PROJECTS -> ProjectsTab(
                    repo = graph.drafts,
                    onOpen = { id -> onDrafts() },
                )
                HomeTab.BRAND -> BrandTab(
                    graph = graph,
                    onOpenBrandKit = onBrandKit,
                )
            }
        }
    }

    if (choosingSize) {
        FormatPickerSheet(MediaFormats.forDesign, selected = null, onDismiss = { choosingSize = false }) { f ->
            choosingSize = false
            onNewDesign(f.label, f.width, f.height)
        }
    }

    if (choosingTheme) {
        ModalBottomSheet(onDismissRequest = { choosingTheme = false }) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .verticalScroll(rememberScrollState())
                    .padding(horizontal = 16.dp)
                    .padding(bottom = 28.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                Text(
                    "Estilo & Paleta do Estúdio",
                    style = MaterialTheme.typography.titleLarge.copy(fontWeight = FontWeight.Bold),
                )
                Text(
                    "Paletas calibradas com verificação de contraste WCAG para manter a fidelidade visual das fotos.",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                ThemePaletteSelector(
                    current = graph.themeStyle.value,
                    onSelect = { graph.setThemeStyle(it) },
                )
            }
        }
    }
}

private data class FeaturedToolItem(
    val eyebrow: String,
    val badge: String,
    val title: String,
    val description: String,
    val imageAsset: String,
    val primaryLabel: String,
    val onPrimary: () -> Unit,
    val secondaryLabel: String? = null,
    val onSecondary: (() -> Unit)? = null,
)

@Composable
private fun StudioTab(
    graph: AppGraph,
    onProductPhoto: () -> Unit,
    onBgRemover: () -> Unit,
    onUpscaler: () -> Unit,
    onNewDesignClick: () -> Unit,
    onImageGen: () -> Unit,
    onMockup: () -> Unit,
    onOpenDraft: (String) -> Unit,
    onDraftsClick: () -> Unit,
    onTemplatesClick: () -> Unit,
) {
    var recentDrafts by remember { mutableStateOf<List<DraftInfo>>(emptyList()) }
    LaunchedEffect(Unit) {
        recentDrafts = graph.drafts.list().take(4)
    }

    val featuredTools = listOf(
        FeaturedToolItem(
            eyebrow = "DESTAQUE DO ESTÚDIO",
            badge = "100% Offline",
            title = "Foto de Produto com IA",
            description = "Recorte automático em alta precisão e composição profissional com sombra de contato e luz real.",
            imageAsset = "showcase/tmpl_product.jpg",
            primaryLabel = "Foto de produto",
            onPrimary = onProductPhoto,
            secondaryLabel = "Novo design",
            onSecondary = onNewDesignClick,
        ),
        FeaturedToolItem(
            eyebrow = "RECORTE INSTANTÂNEO",
            badge = "100% Offline",
            title = "Remover Fundo IA",
            description = "Isole produtos e pessoas em segundos com recorte transparente HD pronto para anúncios.",
            imageAsset = "showcase/ad_skincare.jpg",
            primaryLabel = "Remover fundo",
            onPrimary = onBgRemover,
            secondaryLabel = "Compor foto",
            onSecondary = onProductPhoto,
        ),
        FeaturedToolItem(
            eyebrow = "SUPER RESOLUÇÃO",
            badge = "2× e 4× HD",
            title = "Upscaler Real-ESRGAN",
            description = "Amplie fotos pequenas ou de baixa nitidez sem perder texturas de embalagem e detalhes.",
            imageAsset = "showcase/ad_perfume.jpg",
            primaryLabel = "Melhorar resolução",
            onPrimary = onUpscaler,
        ),
    )
    val carouselState = rememberLazyListState()

    Column(
        Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        // Seção: Ferramentas em Destaque (Carrossel horizontal com 3 ferramentas principais)
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text("Ferramentas em Destaque", style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.Bold))
            Text("Arraste →", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.primary)
        }

        LazyRow(
            state = carouselState,
            flingBehavior = rememberSnapFlingBehavior(lazyListState = carouselState),
            horizontalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            items(featuredTools) { item ->
                FeaturedHeroCard(item = item, modifier = Modifier.width(308.dp))
            }
        }

        // Seção: Ferramentas Criativas
        Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Text("Ferramentas Rápidas", style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.Bold))
            Text("Acesso direto aos recursos profissionais de criação visual", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }

        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            ToolActionCard(
                title = "Foto de Produto IA",
                subtitle = "Recorte + cenário + luz real",
                imageAsset = "showcase/tmpl_product.jpg",
                badge = "IA",
                modifier = Modifier.weight(1f),
                onClick = onProductPhoto,
            )
            ToolActionCard(
                title = "Remover Fundo",
                subtitle = "PNG transparente em 1 toque",
                imageAsset = "showcase/ad_skincare.jpg",
                badge = "RECORTE",
                modifier = Modifier.weight(1f),
                onClick = onBgRemover,
            )
        }

        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            ToolActionCard(
                title = "Upscaler HD",
                subtitle = "Amplie 2× ou 4× sem perder nitidez",
                imageAsset = "showcase/ad_perfume.jpg",
                badge = "2×/4×",
                modifier = Modifier.weight(1f),
                onClick = onUpscaler,
            )
            ToolActionCard(
                title = "Novo design",
                subtitle = "Página em branco para anúncios e posts",
                imageAsset = "showcase/tool_new_design.jpg",
                badge = "CRIAR",
                modifier = Modifier.weight(1f),
                onClick = onNewDesignClick,
            )
        }

        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            ToolActionCard(
                title = "Gerar imagem",
                subtitle = "Criação criativa na nuvem via IA",
                imageAsset = "showcase/tool_image_gen.jpg",
                badge = "IA",
                modifier = Modifier.weight(1f),
                onClick = onImageGen,
            )
            ToolActionCard(
                title = "Mockup 3D",
                subtitle = "Exiba em canecas, embalagens e telas",
                imageAsset = "showcase/tool_mockup.jpg",
                badge = "3D",
                modifier = Modifier.weight(1f),
                onClick = onMockup,
            )
        }

        WideToolActionCard(
            title = "Templates Prontos",
            subtitle = "Mais de 120 modelos editáveis com as cores e logo da sua marca",
            imageAsset = "showcase/tool_templates.jpg",
            badge = "PRO",
            onClick = onTemplatesClick,
        )

        // Seção: Projetos Recentes
        if (recentDrafts.isNotEmpty()) {
            Row(
                Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text("Projetos Recentes", style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.SemiBold))
                TextButton(onClick = onDraftsClick) { Text("Ver todos") }
            }

            LazyRow(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                items(recentDrafts, key = { it.id }) { draft ->
                    RecentDraftMiniCard(draft, onDraftsClick)
                }
            }
        }
    }
}

@Composable
private fun FeaturedHeroCard(
    item: FeaturedToolItem,
    modifier: Modifier = Modifier,
) {
    val heroImg = rememberAssetBitmap(item.imageAsset)
    Card(
        modifier = modifier.height(234.dp),
        shape = RoundedCornerShape(20.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant),
    ) {
        Column(
            modifier = Modifier.fillMaxSize().padding(16.dp),
            verticalArrangement = Arrangement.SpaceBetween,
        ) {
            Row(
                Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(
                    item.eyebrow,
                    style = MaterialTheme.typography.labelMedium.copy(fontWeight = FontWeight.Bold),
                    color = MaterialTheme.colorScheme.secondary,
                )
                Box(
                    modifier = Modifier
                        .background(MaterialTheme.colorScheme.secondary.copy(alpha = 0.2f), RoundedCornerShape(12.dp))
                        .padding(horizontal = 8.dp, vertical = 2.dp),
                ) {
                    Text(item.badge, style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.secondary)
                }
            }

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(12.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    Text(
                        item.title,
                        style = MaterialTheme.typography.titleLarge.copy(fontWeight = FontWeight.Bold),
                        maxLines = 2,
                        overflow = TextOverflow.Ellipsis,
                    )
                    Text(
                        item.description,
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        maxLines = 3,
                        overflow = TextOverflow.Ellipsis,
                    )
                }
                Box(
                    modifier = Modifier
                        .size(84.dp)
                        .clip(RoundedCornerShape(14.dp))
                        .background(MaterialTheme.colorScheme.surfaceContainerHigh),
                ) {
                    if (heroImg != null) {
                        Image(
                            heroImg.asImageBitmap(),
                            contentDescription = item.title,
                            modifier = Modifier.fillMaxSize(),
                            contentScale = ContentScale.Crop,
                        )
                    }
                }
            }

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                Button(
                    onClick = item.onPrimary,
                    modifier = Modifier.weight(1.25f).height(44.dp),
                    shape = RoundedCornerShape(22.dp),
                    colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.primary),
                    contentPadding = PaddingValues(horizontal = 12.dp),
                ) {
                    Text(item.primaryLabel, fontWeight = FontWeight.SemiBold, maxLines = 1, overflow = TextOverflow.Ellipsis)
                }
                if (item.secondaryLabel != null && item.onSecondary != null) {
                    OutlinedButton(
                        onClick = item.onSecondary,
                        modifier = Modifier.weight(1f).height(44.dp),
                        shape = RoundedCornerShape(22.dp),
                        contentPadding = PaddingValues(horizontal = 10.dp),
                    ) {
                        Text(item.secondaryLabel, maxLines = 1, overflow = TextOverflow.Ellipsis)
                    }
                }
            }
        }
    }
}

@Composable
private fun WideToolActionCard(
    title: String,
    subtitle: String,
    imageAsset: String,
    badge: String,
    onClick: () -> Unit,
) {
    val bitmap = rememberAssetBitmap(imageAsset)
    Card(
        modifier = Modifier.fillMaxWidth().clickable(onClick = onClick),
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant),
    ) {
        Row(
            modifier = Modifier.padding(12.dp),
            horizontalArrangement = Arrangement.spacedBy(12.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Box(
                modifier = Modifier
                    .size(72.dp)
                    .clip(RoundedCornerShape(12.dp))
                    .background(MaterialTheme.colorScheme.surfaceContainerHigh),
            ) {
                if (bitmap != null) {
                    Image(
                        bitmap.asImageBitmap(),
                        contentDescription = title,
                        modifier = Modifier.fillMaxSize(),
                        contentScale = ContentScale.Crop,
                    )
                }
            }
            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(3.dp)) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(6.dp),
                ) {
                    Text(title, style = MaterialTheme.typography.titleSmall.copy(fontWeight = FontWeight.Bold))
                    Box(
                        Modifier
                            .background(MaterialTheme.colorScheme.primaryContainer, RoundedCornerShape(6.dp))
                            .padding(horizontal = 6.dp, vertical = 2.dp),
                    ) {
                        Text(
                            badge,
                            style = MaterialTheme.typography.labelSmall.copy(fontWeight = FontWeight.Bold, fontSize = 9.sp),
                            color = MaterialTheme.colorScheme.onPrimaryContainer,
                        )
                    }
                }
                Text(
                    subtitle,
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    maxLines = 2,
                )
            }
        }
    }
}

@Composable
private fun ToolActionCard(
    title: String,
    subtitle: String,
    imageAsset: String,
    modifier: Modifier = Modifier,
    badge: String? = null,
    onClick: () -> Unit,
) {
    val bitmap = rememberAssetBitmap(imageAsset)
    Card(
        modifier = modifier.clickable(onClick = onClick),
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant),
    ) {
        Column {
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(90.dp)
                    .clip(RoundedCornerShape(topStart = 16.dp, topEnd = 16.dp))
                    .background(MaterialTheme.colorScheme.surfaceContainerHigh),
            ) {
                if (bitmap != null) {
                    Image(
                        bitmap.asImageBitmap(),
                        contentDescription = title,
                        modifier = Modifier.fillMaxSize(),
                        contentScale = ContentScale.Crop,
                    )
                }
                if (badge != null) {
                    Box(
                        Modifier
                            .padding(8.dp)
                            .align(Alignment.TopEnd)
                            .background(MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.92f), RoundedCornerShape(6.dp))
                            .padding(horizontal = 6.dp, vertical = 2.dp),
                    ) {
                        Text(
                            badge,
                            style = MaterialTheme.typography.labelSmall.copy(fontWeight = FontWeight.Bold, fontSize = 9.sp),
                            color = MaterialTheme.colorScheme.onPrimaryContainer,
                        )
                    }
                }
            }
            Column(
                modifier = Modifier.padding(10.dp),
                verticalArrangement = Arrangement.spacedBy(2.dp),
            ) {
                Text(
                    title,
                    style = MaterialTheme.typography.titleSmall.copy(fontWeight = FontWeight.Bold),
                    maxLines = 1,
                )
                Text(
                    subtitle,
                    style = MaterialTheme.typography.bodySmall.copy(fontSize = 11.sp),
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    maxLines = 2,
                )
            }
        }
    }
}

@Composable
private fun RecentDraftMiniCard(draft: DraftInfo, onClick: () -> Unit) {
    var bmp by remember(draft.id, draft.updatedAt) { mutableStateOf<android.graphics.Bitmap?>(null) }
    LaunchedEffect(draft.id, draft.updatedAt) {
        bmp = draft.thumbnail?.let { f -> withContext(Dispatchers.IO) { BitmapFactory.decodeFile(f.absolutePath) } }
    }

    OutlinedCard(
        modifier = Modifier.width(130.dp).clickable(onClick = onClick),
        shape = RoundedCornerShape(14.dp),
    ) {
        Column {
            Box(
                Modifier
                    .fillMaxWidth()
                    .height(90.dp)
                    .background(MaterialTheme.colorScheme.surfaceContainerHigh),
                contentAlignment = Alignment.Center,
            ) {
                bmp?.let {
                    Image(it.asImageBitmap(), contentDescription = draft.name, contentScale = ContentScale.Fit, modifier = Modifier.fillMaxSize())
                } ?: Text("Design", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
            Column(Modifier.padding(8.dp)) {
                Text(draft.name, style = MaterialTheme.typography.labelMedium.copy(fontWeight = FontWeight.SemiBold), maxLines = 1)
                Text("${draft.width}×${draft.height}", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
        }
    }
}

private data class TemplateCategoryItem(
    val title: String,
    val subtitle: String,
    val imageAsset: String,
)

private data class AdShowcaseItem(
    val title: String,
    val category: String,
    val badge: String,
    val imageAsset: String,
    val description: String,
)

private data class CapabilityItem(
    val title: String,
    val description: String,
    val tag: String,
    val imageAsset: String,
)

@Composable
private fun rememberAssetBitmap(path: String): Bitmap? {
    val context = androidx.compose.ui.platform.LocalContext.current
    var bitmap by remember(path) { mutableStateOf<Bitmap?>(null) }
    LaunchedEffect(path) {
        bitmap = withContext(Dispatchers.IO) {
            runCatching {
                context.assets.open(path).use { BitmapFactory.decodeStream(it) }
            }.getOrNull()
        }
    }
    return bitmap
}

@Composable
private fun TemplatesTab(onOpenTemplatesGallery: () -> Unit) {
    val categories = listOf(
        TemplateCategoryItem(
            title = "Fotos de Produto",
            subtitle = "Modelos focados em conversão para e-commerce",
            imageAsset = "showcase/tmpl_product.jpg",
        ),
        TemplateCategoryItem(
            title = "Pôsteres & Promoções",
            subtitle = "Formatos de impacto com selos e chamadas",
            imageAsset = "showcase/tmpl_promo.jpg",
        ),
        TemplateCategoryItem(
            title = "Stories & Reels",
            subtitle = "Formatos verticais 9:16 prontos para redes",
            imageAsset = "showcase/tmpl_story.jpg",
        ),
        TemplateCategoryItem(
            title = "Cartões & Papelaria",
            subtitle = "Identidade comercial e cartões de visita",
            imageAsset = "showcase/tmpl_branding.jpg",
        ),
    )

    Column(
        Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        Text("Templates Comerciais", style = MaterialTheme.typography.headlineSmall.copy(fontWeight = FontWeight.Bold))
        Text(
            "Mais de 120 templates profissionais prontos, já adaptados com as cores e fontes da sua marca.",
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )

        Button(
            onClick = onOpenTemplatesGallery,
            modifier = Modifier.fillMaxWidth().height(48.dp),
            shape = RoundedCornerShape(24.dp),
        ) {
            Text("Abrir Galeria Completa no Editor", fontWeight = FontWeight.SemiBold)
        }

        Text("Categorias Principais", style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.SemiBold))

        categories.forEach { cat ->
            val img = rememberAssetBitmap(cat.imageAsset)
            Card(
                modifier = Modifier.fillMaxWidth().clickable(onClick = onOpenTemplatesGallery),
                shape = RoundedCornerShape(16.dp),
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant),
            ) {
                Row(
                    modifier = Modifier.padding(12.dp),
                    horizontalArrangement = Arrangement.spacedBy(14.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Box(
                        modifier = Modifier
                            .size(105.dp)
                            .clip(RoundedCornerShape(12.dp))
                            .background(MaterialTheme.colorScheme.surfaceContainerHigh),
                        contentAlignment = Alignment.Center,
                    ) {
                        if (img != null) {
                            Image(
                                img.asImageBitmap(),
                                contentDescription = cat.title,
                                modifier = Modifier.fillMaxSize(),
                                contentScale = ContentScale.Crop,
                            )
                        } else {
                            Box(Modifier.fillMaxSize().background(MaterialTheme.colorScheme.surfaceContainerHighest))
                        }
                    }

                    Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                        Text(cat.title, style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.Bold))
                        Text(cat.subtitle, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                        Spacer(Modifier.height(4.dp))
                        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                            Text("Explorar modelos", style = MaterialTheme.typography.labelMedium.copy(fontWeight = FontWeight.SemiBold), color = MaterialTheme.colorScheme.primary)
                            Text("→", style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.primary)
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun ProjectsTab(
    repo: DraftRepository,
    onOpen: (String) -> Unit,
) {
    var drafts by remember { mutableStateOf<List<DraftInfo>?>(null) }
    var deleting by remember { mutableStateOf<DraftInfo?>(null) }
    var renaming by remember { mutableStateOf<DraftInfo?>(null) }
    val scope = rememberCoroutineScope()

    LaunchedEffect(Unit) { drafts = repo.list() }

    val list = drafts
    when {
        list == null -> Box(Modifier.fillMaxSize())
        list.isEmpty() -> Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
            Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text("Nenhum projeto ainda", style = MaterialTheme.typography.titleMedium)
                Text("Crie uma foto de produto ou novo design para começar.", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
        }
        else -> {
            LazyVerticalGrid(
                columns = GridCells.Adaptive(150.dp),
                modifier = Modifier.fillMaxSize().padding(horizontal = 12.dp),
                contentPadding = PaddingValues(vertical = 12.dp),
                horizontalArrangement = Arrangement.spacedBy(10.dp),
                verticalArrangement = Arrangement.spacedBy(10.dp),
            ) {
                item(span = { GridItemSpan(maxLineSpan) }) {
                    Text("Meus Projetos (${list.size})", style = MaterialTheme.typography.titleLarge.copy(fontWeight = FontWeight.Bold), modifier = Modifier.padding(bottom = 6.dp))
                }
                items(list, key = { it.id }) { d ->
                    ProjectGridCard(
                        draft = d,
                        onClick = { onOpen(d.id) },
                        onRename = { renaming = d },
                        onDelete = { deleting = d },
                    )
                }
            }
        }
    }

    deleting?.let { d ->
        AlertDialog(
            onDismissRequest = { deleting = null },
            title = { Text("Excluir projeto?") },
            text = { Text("Deseja realmente apagar \"${d.name}\"?") },
            confirmButton = {
                TextButton(onClick = { scope.launch { repo.delete(d.id); drafts = repo.list(); deleting = null } }) { Text("Excluir", color = MaterialTheme.colorScheme.error) }
            },
            dismissButton = { TextButton(onClick = { deleting = null }) { Text("Cancelar") } },
        )
    }

    renaming?.let { d ->
        var field by remember(d.id) { mutableStateOf(TextFieldValue(d.name, TextRange(0, d.name.length))) }
        val focus = remember { FocusRequester() }
        LaunchedEffect(d.id) { runCatching { focus.requestFocus() } }
        val save = {
            scope.launch {
                runCatching { repo.rename(d.id, field.text) }
                drafts = repo.list()
                renaming = null
            }
        }
        AlertDialog(
            onDismissRequest = { renaming = null },
            title = { Text("Renomear projeto") },
            text = {
                OutlinedTextField(
                    field, { field = it.copy(text = it.text.take(MAX_DRAFT_NAME)) },
                    Modifier.fillMaxWidth().focusRequester(focus),
                    singleLine = true,
                )
            },
            confirmButton = { TextButton(onClick = { save() }, enabled = field.text.isNotBlank()) { Text("Salvar") } },
            dismissButton = { TextButton(onClick = { renaming = null }) { Text("Cancelar") } },
        )
    }
}

@Composable
private fun ProjectGridCard(
    draft: DraftInfo,
    onClick: () -> Unit,
    onRename: () -> Unit,
    onDelete: () -> Unit,
) {
    var bmp by remember(draft.id, draft.updatedAt) { mutableStateOf<android.graphics.Bitmap?>(null) }
    LaunchedEffect(draft.id, draft.updatedAt) {
        bmp = draft.thumbnail?.let { f -> withContext(Dispatchers.IO) { BitmapFactory.decodeFile(f.absolutePath) } }
    }

    Card(
        modifier = Modifier.fillMaxWidth().clickable(onClick = onClick),
        shape = RoundedCornerShape(16.dp),
    ) {
        Column {
            Box(
                Modifier
                    .fillMaxWidth()
                    .aspectRatio(1f)
                    .background(MaterialTheme.colorScheme.surfaceContainerHigh),
                contentAlignment = Alignment.Center,
            ) {
                bmp?.let {
                    Image(it.asImageBitmap(), contentDescription = draft.name, contentScale = ContentScale.Fit, modifier = Modifier.fillMaxSize().padding(8.dp))
                } ?: Text("Sem prévia", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
            Column(Modifier.padding(10.dp), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                Text(draft.name, style = MaterialTheme.typography.titleSmall.copy(fontWeight = FontWeight.SemiBold), maxLines = 1)
                Text("${draft.width}×${draft.height} px", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.End) {
                    TextButton(onClick = onRename, contentPadding = PaddingValues(horizontal = 4.dp, vertical = 0.dp)) { Text("Renomear", style = MaterialTheme.typography.labelSmall) }
                    TextButton(onClick = onDelete, contentPadding = PaddingValues(horizontal = 4.dp, vertical = 0.dp)) { Text("Excluir", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.error) }
                }
            }
        }
    }
}

@Composable
private fun BrandTab(
    graph: AppGraph,
    onOpenBrandKit: () -> Unit,
) {
    var kit by remember { mutableStateOf<BrandKit?>(null) }
    var logo by remember { mutableStateOf<Bitmap?>(null) }

    LaunchedEffect(Unit) {
        val k = graph.brandKits.load()
        kit = k
        val blob = k.logoBlob
        if (blob != null) {
            val bytes = graph.editorAssets.read(blob)
            if (bytes != null) {
                logo = withContext(Dispatchers.IO) {
                    BitmapFactory.decodeByteArray(bytes, 0, bytes.size)
                }
            }
        }
    }

    val currentKit = kit ?: BrandKit()
    val companyName = currentKit.profile.company.ifBlank { "Minha Marca" }
    val slogan = currentKit.profile.slogan.ifBlank { "Qualidade e Estilo para seu Negócio" }
    val defaultPrimary = MaterialTheme.colorScheme.primary
    val defaultSecondary = MaterialTheme.colorScheme.secondary
    val defaultBg = MaterialTheme.colorScheme.surfaceVariant
    val primaryColor = currentKit.colors.primary.takeIf { it.isNotBlank() }?.let {
        runCatching { Color(android.graphics.Color.parseColor(it)) }.getOrNull()
    } ?: defaultPrimary
    val secondaryColor = currentKit.colors.secondary.takeIf { it.isNotBlank() }?.let {
        runCatching { Color(android.graphics.Color.parseColor(it)) }.getOrNull()
    } ?: defaultSecondary
    val bgColor = currentKit.colors.background.takeIf { it.isNotBlank() }?.let {
        runCatching { Color(android.graphics.Color.parseColor(it)) }.getOrNull()
    } ?: defaultBg
    val cardInk = if (bgColor.luminance() > 0.45f) Color(0xFF11141D) else Color(0xFFF3F5F9)
    val onPrimaryInk = if (primaryColor.luminance() > 0.45f) Color(0xFF11141D) else Color.White

    Column(
        Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Text("Identidade da Marca", style = MaterialTheme.typography.headlineSmall.copy(fontWeight = FontWeight.Bold))
            Text("Seus dados, cores e logo aplicados automaticamente em todos os designs.", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }

        // Cartão de Prévia da Marca (Live Visual Identity Card)
        Card(
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(20.dp),
            colors = CardDefaults.cardColors(containerColor = bgColor),
        ) {
            Column(Modifier.padding(20.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                Row(
                    Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Row(
                        modifier = Modifier.weight(1f),
                        horizontalArrangement = Arrangement.spacedBy(12.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        if (logo != null) {
                            Image(
                                logo!!.asImageBitmap(),
                                contentDescription = "Logo da Marca",
                                modifier = Modifier
                                    .size(54.dp)
                                    .clip(RoundedCornerShape(12.dp))
                                    .background(cardInk.copy(alpha = 0.08f)),
                                contentScale = ContentScale.Fit,
                            )
                        } else {
                            Box(
                                modifier = Modifier
                                    .size(54.dp)
                                    .background(primaryColor, RoundedCornerShape(12.dp)),
                                contentAlignment = Alignment.Center,
                            ) {
                                Text(
                                    companyName.take(1).uppercase(),
                                    style = MaterialTheme.typography.headlineMedium.copy(fontWeight = FontWeight.Bold),
                                    color = onPrimaryInk,
                                )
                            }
                        }
                        Column {
                            Text(
                                companyName,
                                style = MaterialTheme.typography.titleLarge.copy(fontWeight = FontWeight.Bold),
                                color = primaryColor,
                            )
                            Text(
                                slogan,
                                style = MaterialTheme.typography.bodyMedium,
                                color = cardInk.copy(alpha = 0.85f),
                            )
                        }
                    }
                    Box(
                        modifier = Modifier
                            .background(secondaryColor.copy(alpha = 0.2f), RoundedCornerShape(8.dp))
                            .padding(horizontal = 8.dp, vertical = 4.dp),
                    ) {
                        Text("Ativo", style = MaterialTheme.typography.labelSmall, color = secondaryColor, fontWeight = FontWeight.Bold)
                    }
                }

                if (currentKit.profile.phone.isNotBlank() || currentKit.profile.website.isNotBlank()) {
                    Row(
                        modifier = Modifier.fillMaxWidth().padding(top = 4.dp),
                        horizontalArrangement = Arrangement.spacedBy(16.dp),
                    ) {
                        if (currentKit.profile.phone.isNotBlank()) {
                            Text(currentKit.profile.phone, style = MaterialTheme.typography.bodySmall, color = secondaryColor)
                        }
                        if (currentKit.profile.website.isNotBlank()) {
                            Text(currentKit.profile.website, style = MaterialTheme.typography.bodySmall, color = cardInk.copy(alpha = 0.72f))
                        }
                    }
                }
            }
        }

        // Seção: Exemplo de Aplicação em Anúncio (Carrossel Horizontal)
        Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Text("Exemplo de Aplicação em Anúncio", style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.Bold))
            Text("Formatos de alta conversão gerados instantaneamente com sua marca", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }

        val adExamples = listOf(
            AdShowcaseItem(
                title = "Noir Luxe Parfum",
                category = "Perfumaria & Luxo",
                badge = "DESTAQUE",
                imageAsset = "showcase/ad_perfume.jpg",
                description = "Composição dark studio com iluminação de reflexo dourado.",
            ),
            AdShowcaseItem(
                title = "Aero Speed Streetwear",
                category = "Moda & Calçados",
                badge = "OFERTA",
                imageAsset = "showcase/ad_sneaker.jpg",
                description = "Estilo neon vibrante com foco em e-commerce dinâmico.",
            ),
            AdShowcaseItem(
                title = "Café das Serras Gourmet",
                category = "Alimentos & Bebidas",
                badge = "PREMIUM",
                imageAsset = "showcase/ad_coffee.jpg",
                description = "Cenário rústico aconchegante com grãos selecionados.",
            ),
            AdShowcaseItem(
                title = "Pure Botanicals Sérum",
                category = "Cosméticos & Beleza",
                badge = "BELEZA",
                imageAsset = "showcase/ad_skincare.jpg",
                description = "Clean aesthetic botânico com reflexo suave sobre a água.",
            ),
        )

        LazyRow(
            horizontalArrangement = Arrangement.spacedBy(14.dp),
        ) {
            items(adExamples) { item ->
                AdShowcaseCard(item = item)
            }
        }

        // Seção: O que é possível fazer com o app
        Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Text("O que você pode fazer com o app", style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.Bold))
            Text("Recursos avançados de estúdio e design sem precisar de computador", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }

        val capabilities = listOf(
            CapabilityItem(
                title = "Fotos de Catálogo com IA",
                description = "Remoção instantânea de fundo em 1 clique, recorte fino de bordas e iluminação de estúdio comercial adaptada.",
                tag = "IA LOCAL",
                imageAsset = "showcase/tmpl_product.jpg",
            ),
            CapabilityItem(
                title = "Mockups 3D de Alta Fidelidade",
                description = "Embalagens, frascos, canecas, caixas e roupas com mapeamento realista de textura e perspectiva correta.",
                tag = "RENDER 3D",
                imageAsset = "showcase/tool_mockup.jpg",
            ),
            CapabilityItem(
                title = "Criativos Comerciais em Lote",
                description = "Gere variações para feed, stories e banners de marketplaces sem precisar recriar cada peça do zero.",
                tag = "ESCALA",
                imageAsset = "showcase/tool_templates.jpg",
            ),
            CapabilityItem(
                title = "100% Offline & Privacidade Total",
                description = "Todo processamento ocorre diretamente no seu aparelho. Seus produtos e clientes nunca vão para a nuvem.",
                tag = "PRIVADO",
                imageAsset = "showcase/tool_new_design.jpg",
            ),
        )

        capabilities.forEach { cap ->
            val img = rememberAssetBitmap(cap.imageAsset)
            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(16.dp),
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant),
            ) {
                Row(
                    modifier = Modifier.padding(12.dp),
                    horizontalArrangement = Arrangement.spacedBy(14.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Box(
                        modifier = Modifier
                            .size(105.dp)
                            .clip(RoundedCornerShape(12.dp))
                            .background(MaterialTheme.colorScheme.surfaceContainerHigh),
                        contentAlignment = Alignment.Center,
                    ) {
                        if (img != null) {
                            Image(
                                img.asImageBitmap(),
                                contentDescription = cap.title,
                                modifier = Modifier.fillMaxSize(),
                                contentScale = ContentScale.Crop,
                            )
                        } else {
                            Box(Modifier.fillMaxSize().background(MaterialTheme.colorScheme.surfaceContainerHighest))
                        }
                    }

                    Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                        Box(
                            modifier = Modifier
                                .background(MaterialTheme.colorScheme.primary.copy(alpha = 0.15f), RoundedCornerShape(6.dp))
                                .padding(horizontal = 6.dp, vertical = 2.dp),
                        ) {
                            Text(
                                cap.tag,
                                style = MaterialTheme.typography.labelSmall.copy(fontWeight = FontWeight.Bold, fontSize = 9.sp),
                                color = MaterialTheme.colorScheme.primary,
                            )
                        }
                        Text(cap.title, style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.Bold))
                        Text(cap.description, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                }
            }
        }

        Button(
            onClick = onOpenBrandKit,
            modifier = Modifier.fillMaxWidth().height(48.dp),
            shape = RoundedCornerShape(24.dp),
        ) {
            Text("Personalizar Brand Kit", fontWeight = FontWeight.SemiBold)
        }
    }
}

@Composable
private fun AdShowcaseCard(item: AdShowcaseItem) {
    val bitmap = rememberAssetBitmap(item.imageAsset)
    Card(
        modifier = Modifier.width(260.dp),
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant),
    ) {
        Column {
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(160.dp)
                    .background(MaterialTheme.colorScheme.surfaceContainerHigh),
            ) {
                if (bitmap != null) {
                    Image(
                        bitmap.asImageBitmap(),
                        contentDescription = item.title,
                        modifier = Modifier.fillMaxSize(),
                        contentScale = ContentScale.Crop,
                    )
                } else {
                    Box(Modifier.fillMaxSize().background(MaterialTheme.colorScheme.surfaceContainerHighest))
                }
                Box(
                    modifier = Modifier
                        .padding(10.dp)
                        .background(MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.92f), RoundedCornerShape(8.dp))
                        .padding(horizontal = 8.dp, vertical = 3.dp)
                        .align(Alignment.TopEnd),
                ) {
                    Text(
                        item.badge,
                        style = MaterialTheme.typography.labelSmall.copy(fontWeight = FontWeight.Bold, fontSize = 10.sp),
                        color = MaterialTheme.colorScheme.onPrimaryContainer,
                    )
                }
            }
            Column(
                modifier = Modifier.padding(12.dp),
                verticalArrangement = Arrangement.spacedBy(4.dp),
            ) {
                Text(
                    item.category.uppercase(),
                    style = MaterialTheme.typography.labelSmall.copy(fontSize = 10.sp, fontWeight = FontWeight.SemiBold),
                    color = MaterialTheme.colorScheme.primary,
                )
                Text(
                    item.title,
                    style = MaterialTheme.typography.titleSmall.copy(fontWeight = FontWeight.Bold),
                    maxLines = 1,
                )
                Text(
                    item.description,
                    style = MaterialTheme.typography.bodySmall.copy(fontSize = 11.sp),
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    maxLines = 2,
                )
            }
        }
    }
}

@Composable
fun DraftsScreen(repo: DraftRepository, onOpen: (String) -> Unit) {
    ProjectsTab(repo = repo, onOpen = onOpen)
}
