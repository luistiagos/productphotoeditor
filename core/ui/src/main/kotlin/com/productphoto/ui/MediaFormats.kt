package com.productphoto.ui

/** Rede ou família do formato: decide a cor e o selo do desenho. */
enum class FormatPlatform(val label: String, val argb: Long) {
    INSTAGRAM("Instagram", 0xFFD62976),
    FACEBOOK("Facebook", 0xFF1877F2),
    YOUTUBE("YouTube", 0xFFFF0000),
    TIKTOK("TikTok", 0xFF111111),
    LINKEDIN("LinkedIn", 0xFF0A66C2),
    GENERIC("Geral", 0xFF6B7280),
    PRINT("Impressão", 0xFF3B6FD8),
}

/** O que o desenho mostra dentro do retângulo: o suficiente para reconhecer o formato num relance. */
enum class FormatLook {
    /** Retângulo liso com um ícone de foto. */
    PLAIN,
    /** Post de feed: foto com coração/comentário embaixo. */
    FEED,
    /** Vídeo vertical: ícones na lateral direita e legenda embaixo. */
    VERTICAL_VIDEO,
    /** Miniatura de vídeo: botão de play e duração no canto. */
    THUMBNAIL,
    /** Capa com a foto de perfil sobreposta no canto inferior esquerdo. */
    COVER,
    /** Capa de canal: só a faixa central aparece em todos os aparelhos. */
    CHANNEL_BANNER,
    /** Foto de perfil: recorte circular, com a silhueta de uma pessoa. */
    PROFILE,
    /** Folha impressa: dobra no canto e linhas de texto. */
    PAGE,
}

/** Grupo do seletor; a ordem do enum é a ordem das seções. */
enum class FormatGroup(val label: String) {
    QUICK("Rápidos"),
    PROFILE("Foto de perfil"),
    INSTAGRAM("Instagram"),
    FACEBOOK("Facebook"),
    LINKEDIN("LinkedIn"),
    YOUTUBE("YouTube"),
    TIKTOK("TikTok"),
    BASIC("Básicos"),
    SMALL("Pequenos"),
    PRINT("Impressão e marca"),
}

/**
 * Formato de imagem (§46 do HANDOFF). [id] é estável: o editor web tem o mesmo catálogo em `editor-web/src/formats.ts`
 * e o `MediaFormatsTest` confere que os dois batem. [CUSTOM_ID] marca o tamanho digitado pelo usuário.
 */
data class MediaFormat(
    val id: String,
    val label: String,
    val width: Int,
    val height: Int,
    val group: FormatGroup,
    val platform: FormatPlatform,
    val look: FormatLook,
    /** Onde se usa, em uma linha (ex. "Feed, 4:5"). */
    val hint: String = "",
) {
    val aspect: Float get() = width.toFloat() / height
    val isCustom: Boolean get() = id == CUSTOM_ID
    val sizeLabel: String get() = "$width×$height"

    companion object {
        const val CUSTOM_ID = "custom"
        fun custom(width: Int, height: Int) =
            MediaFormat(CUSTOM_ID, "Personalizado", width, height, FormatGroup.BASIC, FormatPlatform.GENERIC, FormatLook.PLAIN)
    }
}

object MediaFormats {
    private fun f(id: String, label: String, w: Int, h: Int, g: FormatGroup, p: FormatPlatform, look: FormatLook, hint: String) =
        MediaFormat(id, label, w, h, g, p, look, hint)

    val all: List<MediaFormat> = listOf(
        // os 3 de sempre do "Gerar imagem": tamanho nativo do modelo, o mais rápido
        f("quick_square", "Quadrado", 512, 512, FormatGroup.QUICK, FormatPlatform.GENERIC, FormatLook.PLAIN, "Rápido, 1:1"),
        f("quick_portrait", "Retrato", 512, 768, FormatGroup.QUICK, FormatPlatform.GENERIC, FormatLook.PLAIN, "Rápido, 2:3"),
        f("quick_landscape", "Paisagem", 768, 512, FormatGroup.QUICK, FormatPlatform.GENERIC, FormatLook.PLAIN, "Rápido, 3:2"),

        // uma só para todas as redes: 800 px é o recomendado pelo YouTube, o maior entre elas; as outras reduzem
        f("profile", "Foto de perfil", 800, 800, FormatGroup.PROFILE, FormatPlatform.GENERIC, FormatLook.PROFILE,
            "Instagram, Facebook, X, LinkedIn, TikTok e YouTube; aparece em círculo"),

        f("ig_post", "Post Instagram", 1080, 1350, FormatGroup.INSTAGRAM, FormatPlatform.INSTAGRAM, FormatLook.FEED, "Feed, 4:5"),
        f("ig_reels", "Reels Instagram", 1080, 1920, FormatGroup.INSTAGRAM, FormatPlatform.INSTAGRAM, FormatLook.VERTICAL_VIDEO, "Reels e Stories, 9:16"),

        f("fb_post", "Post Facebook", 1080, 1080, FormatGroup.FACEBOOK, FormatPlatform.FACEBOOK, FormatLook.FEED, "Feed, 1:1"),
        f("fb_cover", "Capa Facebook", 1640, 624, FormatGroup.FACEBOOK, FormatPlatform.FACEBOOK, FormatLook.COVER, "Capa da página"),
        f("fb_reels", "Reels Facebook", 1080, 1920, FormatGroup.FACEBOOK, FormatPlatform.FACEBOOK, FormatLook.VERTICAL_VIDEO, "Reels e Stories, 9:16"),

        f("li_post", "Post LinkedIn", 1200, 627, FormatGroup.LINKEDIN, FormatPlatform.LINKEDIN, FormatLook.FEED, "Feed, horizontal"),
        f("li_square", "Post LinkedIn quadrado", 1200, 1200, FormatGroup.LINKEDIN, FormatPlatform.LINKEDIN, FormatLook.FEED, "Feed, 1:1"),
        f("li_portrait", "Post LinkedIn vertical", 1080, 1350, FormatGroup.LINKEDIN, FormatPlatform.LINKEDIN, FormatLook.FEED, "Feed, 4:5"),
        f("li_cover", "Capa LinkedIn", 1584, 396, FormatGroup.LINKEDIN, FormatPlatform.LINKEDIN, FormatLook.COVER, "Capa do perfil"),

        f("yt_shorts", "Shorts YouTube", 1080, 1920, FormatGroup.YOUTUBE, FormatPlatform.YOUTUBE, FormatLook.VERTICAL_VIDEO, "Vídeo curto, 9:16"),
        f("yt_thumb", "Thumbnail YouTube", 1280, 720, FormatGroup.YOUTUBE, FormatPlatform.YOUTUBE, FormatLook.THUMBNAIL, "Miniatura do vídeo, 16:9"),
        f("yt_banner", "Capa do canal YouTube", 2560, 1440, FormatGroup.YOUTUBE, FormatPlatform.YOUTUBE, FormatLook.CHANNEL_BANNER, "Texto e logo só na faixa central"),

        f("tt_video", "Vídeo TikTok", 1080, 1920, FormatGroup.TIKTOK, FormatPlatform.TIKTOK, FormatLook.VERTICAL_VIDEO, "Vídeo do feed, 9:16"),
        f("tt_ad", "Anúncio TikTok", 1080, 1920, FormatGroup.TIKTOK, FormatPlatform.TIKTOK, FormatLook.VERTICAL_VIDEO, "Anúncio no feed, 9:16"),

        f("square", "Quadrado", 1080, 1080, FormatGroup.BASIC, FormatPlatform.GENERIC, FormatLook.PLAIN, "1:1"),
        f("portrait", "Retrato", 1080, 1620, FormatGroup.BASIC, FormatPlatform.GENERIC, FormatLook.PLAIN, "2:3"),
        f("landscape", "Paisagem", 1620, 1080, FormatGroup.BASIC, FormatPlatform.GENERIC, FormatLook.PLAIN, "3:2"),
        f("story", "Story", 1080, 1920, FormatGroup.BASIC, FormatPlatform.GENERIC, FormatLook.PLAIN, "9:16"),
        f("banner", "Banner", 1920, 1080, FormatGroup.BASIC, FormatPlatform.GENERIC, FormatLook.PLAIN, "16:9"),

        f("small_icon", "Ícone", 256, 256, FormatGroup.SMALL, FormatPlatform.GENERIC, FormatLook.PLAIN, "1:1"),
        f("small_square", "Quadrado pequeno", 500, 500, FormatGroup.SMALL, FormatPlatform.GENERIC, FormatLook.PLAIN, "1:1"),
        f("small_portrait", "Retrato pequeno", 400, 600, FormatGroup.SMALL, FormatPlatform.GENERIC, FormatLook.PLAIN, "2:3"),
        f("small_landscape", "Paisagem pequena", 600, 400, FormatGroup.SMALL, FormatPlatform.GENERIC, FormatLook.PLAIN, "3:2"),
        f("small_photo", "Foto 4:3", 640, 480, FormatGroup.SMALL, FormatPlatform.GENERIC, FormatLook.PLAIN, "4:3"),
        f("small_vertical", "Vertical pequeno", 360, 640, FormatGroup.SMALL, FormatPlatform.GENERIC, FormatLook.PLAIN, "9:16"),
        f("small_wide", "Widescreen pequeno", 640, 360, FormatGroup.SMALL, FormatPlatform.GENERIC, FormatLook.PLAIN, "16:9"),
        f("web_rectangle", "Anúncio de site", 300, 250, FormatGroup.SMALL, FormatPlatform.GENERIC, FormatLook.PLAIN, "Retângulo médio de anúncio"),
        f("web_leaderboard", "Banner de site", 728, 90, FormatGroup.SMALL, FormatPlatform.GENERIC, FormatLook.PLAIN, "Faixa de anúncio no topo da página"),

        f("logo", "Logo", 1000, 1000, FormatGroup.PRINT, FormatPlatform.PRINT, FormatLook.PLAIN, "1:1"),
        f("business_card", "Cartão de visita", 1050, 600, FormatGroup.PRINT, FormatPlatform.PRINT, FormatLook.PAGE, "8,9 × 5,1 cm"),
        f("a4", "Folheto A4", 1240, 1754, FormatGroup.PRINT, FormatPlatform.PRINT, FormatLook.PAGE, "150 dpi"),
        f("a3", "Pôster A3", 1754, 2480, FormatGroup.PRINT, FormatPlatform.PRINT, FormatLook.PAGE, "150 dpi"),
    )

    fun byId(id: String): MediaFormat? = all.firstOrNull { it.id == id }

    /** Gerar imagem: tudo, com os rápidos primeiro. */
    val forImageGeneration: List<MediaFormat> = all.filter { it.group != FormatGroup.PRINT }

    /** Design em branco e o painel Tamanho do editor: sem os rápidos de 512 px. */
    val forDesign: List<MediaFormat> = all.filter { it.group != FormatGroup.QUICK }

    /** Proporção máxima da expansão de anúncio: além de 4:1 o canvas expandido fica grande demais (728×90 daria ~8000 px). */
    const val ADS_MAX_ASPECT = 4f

    /** Expansão de anúncio: só a proporção conta; sem rápidos, impressão, perfil e proporções além de [ADS_MAX_ASPECT]. */
    val forAds: List<MediaFormat> = all.filter {
        it.group !in setOf(FormatGroup.QUICK, FormatGroup.PRINT, FormatGroup.PROFILE) &&
            it.aspect in (1f / ADS_MAX_ASPECT)..ADS_MAX_ASPECT
    }
}
