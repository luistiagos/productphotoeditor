package com.productphoto.ai.api

import kotlinx.serialization.json.JsonObject

enum class Capability {
    BACKGROUND_REMOVER, INPAINTER, TEXT_DETECTOR, TRANSLATOR, VECTORIZER,
    UPSCALER, TEXT_GENERATOR, IMAGE_GENERATOR, SCENE_COMPOSER, MOCKUP_RENDERER,
}

sealed interface Requirement {
    data object PlayServices : Requirement
    /** RAM anunciada do aparelho ("8 GB" = 8192), não o MemTotal: o checker converte com [advertisedRamMb] (§22). */
    data class MinRamMb(val mb: Int) : Requirement
    data class Model(val modelId: String) : Requirement      // precisa estar baixado
    data object Network : Requirement
    data class Secret(val key: String) : Requirement         // chave do usuário configurada
    data class DeviceFeature(val name: String) : Requirement // ex. "aicore", "npu-qnn"
}

// 1; 1,5; 2; 3; 4; 6; 8; 10; 12; 16; 18; 20; 24; 32 GB
private val RETAIL_RAM_MB = longArrayOf(1024, 1536, 2048, 3072, 4096, 6144, 8192, 10240, 12288, 16384, 18432, 20480, 24576, 32768)

/**
 * Menor tamanho comercial de RAM ≥ [memTotalMb]. O MemTotal fica abaixo da RAM física (kernel, modem, GPU: um aparelho
 * de 8 GB informa ~7,4 GB), então arredondar para cima recupera o número da caixa. Acima de 32 GB, múltiplos de 8 GB.
 */
fun advertisedRamMb(memTotalMb: Long): Long {
    if (memTotalMb <= 0) return 0
    RETAIL_RAM_MB.firstOrNull { it >= memTotalMb }?.let { return it }
    return (memTotalMb + 8191) / 8192 * 8192
}

/** Responde se um requisito está atendido no aparelho agora. */
fun interface RequirementChecker {
    suspend fun isMet(requirement: Requirement): Boolean
}

data class SettingField(
    val key: String,
    val label: String,
    val kind: Kind = Kind.TEXT,
    val default: String? = null,
) {
    enum class Kind { TEXT, URL, NUMBER, SECRET_NAME, BOOLEAN }
}

/** Serviços que um provedor pode precisar para ser criado (SecretStore, ModelManager, OkHttp...). */
interface ProviderContext {
    val androidContext: android.content.Context
    fun <T : Any> service(type: Class<T>): T?
}

inline fun <reified T : Any> ProviderContext.service(): T? = service(T::class.java)

interface ProviderFactory<T : Any> {
    val id: String
    val capability: Capability
    val displayName: String
    val isLocal: Boolean
    val settingsSchema: List<SettingField> get() = emptyList()
    fun requirements(settings: JsonObject): List<Requirement>
    fun create(settings: JsonObject, ctx: ProviderContext): T
}
