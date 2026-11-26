package com.productphoto.ui

import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.ColorScheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Shapes
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp

// 1. Estúdio Violeta (Dark Padrão de Produção)
val StudioCanvasBgDark = Color(0xFF0F1117)
val StudioSurfaceDark = Color(0xFF161922)
val StudioSurfaceElevatedDark = Color(0xFF1E222E)
val StudioSurfaceSheetDark = Color(0xFF252A38)
val StudioBorderDark = Color(0xFF2E3446)
val StudioTextPrimaryDark = Color(0xFFF3F5F9)
val StudioTextSecondaryDark = Color(0xFF9CA3B8)
val StudioAccentPrimary = Color(0xFF6C5CE7)
val StudioAccentAi = Color(0xFF00D2B8)
val StudioAccentPro = Color(0xFFF59E0B)
val StudioDanger = Color(0xFFEF4444)

// 6. Galeria Clara (Daylight Editorial)
val StudioCanvasBgLight = Color(0xFFF2F4F8)
val StudioSurfaceLight = Color(0xFFFFFFFF)
val StudioSurfaceElevatedLight = Color(0xFFE7EBF3)
val StudioSurfaceSheetLight = Color(0xFFFFFFFF)
val StudioBorderLight = Color(0xFFD0D7E5)
val StudioTextPrimaryLight = Color(0xFF11141D)
val StudioTextSecondaryLight = Color(0xFF525B70)
val StudioAccentPrimaryLight = Color(0xFF4F46E5)
val StudioAccentAiLight = Color(0xFF0F766E)

val StudioDarkColorScheme = darkColorScheme(
    primary = StudioAccentPrimary,
    onPrimary = Color.White,
    primaryContainer = Color(0xFF2D275A),
    onPrimaryContainer = Color(0xFFD4CEFF),
    secondary = StudioAccentAi,
    onSecondary = Color(0xFF0F1117),
    secondaryContainer = Color(0xFF003830),
    onSecondaryContainer = Color(0xFF73F5E3),
    tertiary = StudioAccentPro,
    onTertiary = Color.Black,
    tertiaryContainer = Color(0xFF4A3400),
    onTertiaryContainer = Color(0xFFFFDFA0),
    background = StudioCanvasBgDark,
    onBackground = StudioTextPrimaryDark,
    surface = StudioSurfaceDark,
    onSurface = StudioTextPrimaryDark,
    surfaceVariant = StudioSurfaceElevatedDark,
    onSurfaceVariant = StudioTextSecondaryDark,
    surfaceContainer = StudioSurfaceElevatedDark,
    surfaceContainerHigh = StudioSurfaceSheetDark,
    surfaceContainerHighest = Color(0xFF2E3444),
    outline = StudioBorderDark,
    outlineVariant = Color(0xFF232734),
    error = Color(0xFFF87171),
    onError = Color(0xFF280505),
)

// 2. Grafite Neutro (Calibrado OLED - zero desvio cromático para edição fiel)
val StudioGraphiteColorScheme = darkColorScheme(
    primary = Color(0xFF60A5FA),
    onPrimary = Color(0xFF061529),
    primaryContainer = Color(0xFF172E54),
    onPrimaryContainer = Color(0xFFDBEAFE),
    secondary = Color(0xFF34D399),
    onSecondary = Color(0xFF052015),
    secondaryContainer = Color(0xFF0C3B2A),
    onSecondaryContainer = Color(0xFFA7F3D0),
    tertiary = Color(0xFFFBBF24),
    onTertiary = Color(0xFF1E1402),
    tertiaryContainer = Color(0xFF422C05),
    onTertiaryContainer = Color(0xFFFEF3C7),
    background = Color(0xFF09090B),
    onBackground = Color(0xFFF4F4F5),
    surface = Color(0xFF121215),
    onSurface = Color(0xFFF4F4F5),
    surfaceVariant = Color(0xFF1C1C21),
    onSurfaceVariant = Color(0xFFA1A1AA),
    surfaceContainer = Color(0xFF1C1C21),
    surfaceContainerHigh = Color(0xFF24242B),
    surfaceContainerHighest = Color(0xFF2E2E36),
    outline = Color(0xFF32323B),
    outlineVariant = Color(0xFF23232A),
    error = Color(0xFFF87171),
    onError = Color(0xFF280505),
)

// 3. Noir Dourado (Luxo & Editorial - ideal para joias, perfumes e cosméticos)
val StudioNoirGoldColorScheme = darkColorScheme(
    primary = Color(0xFFE0B243),
    onPrimary = Color(0xFF141108),
    primaryContainer = Color(0xFF3D2F10),
    onPrimaryContainer = Color(0xFFFDE68A),
    secondary = Color(0xFF4DD0B1),
    onSecondary = Color(0xFF071F19),
    secondaryContainer = Color(0xFF10382F),
    onSecondaryContainer = Color(0xFFA7F3E2),
    tertiary = Color(0xFFF59E0B),
    onTertiary = Color(0xFF1C1102),
    tertiaryContainer = Color(0xFF452A04),
    onTertiaryContainer = Color(0xFFFFDFA0),
    background = Color(0xFF0D0C0A),
    onBackground = Color(0xFFF7F3EA),
    surface = Color(0xFF161411),
    onSurface = Color(0xFFF7F3EA),
    surfaceVariant = Color(0xFF211D17),
    onSurfaceVariant = Color(0xFFB2A898),
    surfaceContainer = Color(0xFF211D17),
    surfaceContainerHigh = Color(0xFF2B261E),
    surfaceContainerHighest = Color(0xFF363026),
    outline = Color(0xFF3D3529),
    outlineVariant = Color(0xFF29241C),
    error = Color(0xFFF87171),
    onError = Color(0xFF280505),
)

// 4. Oceano Noturno (Cyber & Tech - alta clareza para eletrônicos e streetwear)
val StudioOceanColorScheme = darkColorScheme(
    primary = Color(0xFF22D3EE),
    onPrimary = Color(0xFF051A24),
    primaryContainer = Color(0xFF0C3B4E),
    onPrimaryContainer = Color(0xFFCFFAFE),
    secondary = Color(0xFF818CF8),
    onSecondary = Color(0xFF0B0F2E),
    secondaryContainer = Color(0xFF20275E),
    onSecondaryContainer = Color(0xFFE0E7FF),
    tertiary = Color(0xFFFBBF24),
    onTertiary = Color(0xFF1F1502),
    tertiaryContainer = Color(0xFF422C04),
    onTertiaryContainer = Color(0xFFFEF3C7),
    background = Color(0xFF071018),
    onBackground = Color(0xFFEDF6FC),
    surface = Color(0xFF0D1A26),
    onSurface = Color(0xFFEDF6FC),
    surfaceVariant = Color(0xFF142536),
    onSurfaceVariant = Color(0xFF8FAEC7),
    surfaceContainer = Color(0xFF142536),
    surfaceContainerHigh = Color(0xFF1B3045),
    surfaceContainerHighest = Color(0xFF223B54),
    outline = Color(0xFF26425E),
    outlineVariant = Color(0xFF192D40),
    error = Color(0xFFF87171),
    onError = Color(0xFF280505),
)

// 5. Carmim Editorial (Estúdio Criativo Warm - moda, gastronomia e agência)
val StudioCrimsonColorScheme = darkColorScheme(
    primary = Color(0xFFFB7185),
    onPrimary = Color(0xFF29050F),
    primaryContainer = Color(0xFF4F1426),
    onPrimaryContainer = Color(0xFFFFE4E6),
    secondary = Color(0xFFFBBF24),
    onSecondary = Color(0xFF241703),
    secondaryContainer = Color(0xFF452E06),
    onSecondaryContainer = Color(0xFFFEF3C7),
    tertiary = Color(0xFF34D399),
    onTertiary = Color(0xFF052015),
    tertiaryContainer = Color(0xFF0B3B2A),
    onTertiaryContainer = Color(0xFFA7F3D0),
    background = Color(0xFF110C0F),
    onBackground = Color(0xFFFAF2F5),
    surface = Color(0xFF1A1317),
    onSurface = Color(0xFFFAF2F5),
    surfaceVariant = Color(0xFF261C22),
    onSurfaceVariant = Color(0xFFB89FA9),
    surfaceContainer = Color(0xFF261C22),
    surfaceContainerHigh = Color(0xFF31242C),
    surfaceContainerHighest = Color(0xFF3D2C36),
    outline = Color(0xFF45323D),
    outlineVariant = Color(0xFF2D2128),
    error = Color(0xFFF87171),
    onError = Color(0xFF280505),
)

val StudioLightColorScheme = lightColorScheme(
    primary = StudioAccentPrimaryLight,
    onPrimary = Color.White,
    primaryContainer = Color(0xFFE0E7FF),
    onPrimaryContainer = Color(0xFF1E1B4B),
    secondary = StudioAccentAiLight,
    onSecondary = Color.White,
    secondaryContainer = Color(0xFFCCFBF1),
    onSecondaryContainer = Color(0xFF042F2E),
    tertiary = Color(0xFFB45309),
    onTertiary = Color.White,
    tertiaryContainer = Color(0xFFFEF3C7),
    onTertiaryContainer = Color(0xFF451A03),
    background = StudioCanvasBgLight,
    onBackground = StudioTextPrimaryLight,
    surface = StudioSurfaceLight,
    onSurface = StudioTextPrimaryLight,
    surfaceVariant = StudioSurfaceElevatedLight,
    onSurfaceVariant = StudioTextSecondaryLight,
    surfaceContainer = StudioSurfaceElevatedLight,
    surfaceContainerHigh = Color(0xFFDDE3EE),
    surfaceContainerHighest = Color(0xFFD1D8E6),
    outline = StudioBorderLight,
    outlineVariant = Color(0xFFE2E6EF),
    error = Color(0xFFDC2626),
    onError = Color.White,
)

enum class StudioThemeStyle(
    val id: String,
    val title: String,
    val subtitle: String,
    val badge: String,
    val isDark: Boolean,
    val scheme: ColorScheme,
) {
    VIOLET_STUDIO(
        id = "violet_studio",
        title = "Estúdio Violeta",
        subtitle = "Dark padrão • IA criativa e contraste equilibrado",
        badge = "PADRÃO",
        isDark = true,
        scheme = StudioDarkColorScheme,
    ),
    GRAPHITE_PRO(
        id = "graphite_pro",
        title = "Grafite Neutro OLED",
        subtitle = "Cinzas puros sem viés cromático para fidelidade de cor",
        badge = "CALIBRADO",
        isDark = true,
        scheme = StudioGraphiteColorScheme,
    ),
    NOIR_GOLD(
        id = "noir_gold",
        title = "Noir Dourado",
        subtitle = "Carvão quente com ouro champagne para marcas de luxo",
        badge = "LUXO AAA",
        isDark = true,
        scheme = StudioNoirGoldColorScheme,
    ),
    DEEP_OCEAN(
        id = "deep_ocean",
        title = "Oceano Noturno",
        subtitle = "Azul abissal com ciano elétrico de alta legibilidade",
        badge = "TECH",
        isDark = true,
        scheme = StudioOceanColorScheme,
    ),
    CRIMSON_STUDIO(
        id = "crimson_studio",
        title = "Carmim Editorial",
        subtitle = "Grafite vinho com rosa-coral luminoso e âmbar",
        badge = "EDITORIAL",
        isDark = true,
        scheme = StudioCrimsonColorScheme,
    ),
    DAYLIGHT_GALLERY(
        id = "daylight_gallery",
        title = "Galeria Clara",
        subtitle = "Modo claro nítido para ambientes externos iluminados",
        badge = "CLARO",
        isDark = false,
        scheme = StudioLightColorScheme,
    );

    companion object {
        fun fromId(id: String?): StudioThemeStyle =
            entries.find { it.id == id } ?: VIOLET_STUDIO
    }
}

val StudioShapes = Shapes(
    extraSmall = RoundedCornerShape(6.dp),
    small = RoundedCornerShape(10.dp),
    medium = RoundedCornerShape(14.dp),
    large = RoundedCornerShape(20.dp),
    extraLarge = RoundedCornerShape(28.dp),
)

@Composable
fun ProductPhotoTheme(
    style: StudioThemeStyle = StudioThemeStyle.VIOLET_STUDIO,
    content: @Composable () -> Unit,
) {
    MaterialTheme(
        colorScheme = style.scheme,
        shapes = StudioShapes,
        content = content,
    )
}

@Composable
fun ProductPhotoTheme(
    darkTheme: Boolean,
    content: @Composable () -> Unit,
) = ProductPhotoTheme(
    style = if (darkTheme) StudioThemeStyle.VIOLET_STUDIO else StudioThemeStyle.DAYLIGHT_GALLERY,
    content = content,
)
