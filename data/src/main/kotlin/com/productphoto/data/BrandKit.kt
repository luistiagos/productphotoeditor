package com.productphoto.data

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import java.io.File

/** Dados da empresa; cada campo é uma variável {{nome}} nos templates (ARQUITETURA §15.2). */
@Serializable
data class CompanyProfile(
    val company: String = "",
    val slogan: String = "",
    val phone: String = "",
    val email: String = "",
    val website: String = "",
    val address: String = "",
) {
    fun asVariables(): Map<String, String> = mapOf(
        "company" to company, "slogan" to slogan, "phone" to phone,
        "email" to email, "website" to website, "address" to address,
    ).filterValues { it.isNotBlank() }
}

/** Cores por papel, em #rrggbb; vazio = papel não definido. */
@Serializable
data class BrandColors(
    val primary: String = "",
    val secondary: String = "",
    val accent: String = "",
    val text: String = "",
    val background: String = "",
) {
    fun asRoles(): Map<String, String> = mapOf(
        "primary" to primary, "secondary" to secondary, "accent" to accent, "text" to text, "background" to background,
    ).filterValues { HEX.matches(it) }

    companion object {
        val HEX = Regex("^#[0-9a-fA-F]{6}$")
    }
}

@Serializable
data class BrandFonts(val heading: String = "", val body: String = "") {
    fun asRoles(): Map<String, String> = mapOf("heading" to heading, "body" to body).filterValues { it.isNotBlank() }
}

@Serializable
data class BrandKit(
    val version: Int = 1,
    val profile: CompanyProfile = CompanyProfile(),
    val colors: BrandColors = BrandColors(),
    val fonts: BrandFonts = BrandFonts(),
    /** Nome do arquivo do logo no BlobStore do editor (ex. "logo-1a2b.png"), ou null. */
    val logoBlob: String? = null,
)

interface BrandKitRepository {
    suspend fun load(): BrandKit
    suspend fun save(kit: BrandKit)
}

class FileBrandKitRepository(private val file: File) : BrandKitRepository {
    override suspend fun load(): BrandKit = withContext(Dispatchers.IO) {
        if (!file.exists()) BrandKit()
        else runCatching { json.decodeFromString(BrandKit.serializer(), file.readText()) }.getOrDefault(BrandKit())
    }

    override suspend fun save(kit: BrandKit) = withContext(Dispatchers.IO) {
        file.writeAtomically(json.encodeToString(BrandKit.serializer(), kit).encodeToByteArray())
    }

    private companion object {
        val json = Json { prettyPrint = true; ignoreUnknownKeys = true; encodeDefaults = true }
    }
}
