package com.productphoto.ai.api

import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject

/**
 * Configuração das cadeias (§4.3). Segredos nunca entram aqui: só o nome (ex. "apiKeySecret"),
 * resolvido no SecretStore.
 */
@Serializable
data class ProviderConfig(
    val version: Int = 1,
    val capabilities: Map<Capability, CapabilityConfig> = emptyMap(),
) {
    fun chainFor(capability: Capability): List<ChainEntry> = capabilities[capability]?.chain.orEmpty()

    fun withChain(capability: Capability, chain: List<ChainEntry>): ProviderConfig =
        copy(capabilities = capabilities + (capability to CapabilityConfig(chain)))

    fun toJson(): String = json.encodeToString(serializer(), this)

    companion object {
        private val json = Json { prettyPrint = true; ignoreUnknownKeys = true }

        fun fromJson(text: String): ProviderConfig = json.decodeFromString(serializer(), text)
    }
}

@Serializable
data class CapabilityConfig(val chain: List<ChainEntry> = emptyList())

@Serializable
data class ChainEntry(val provider: String, val settings: JsonObject = JsonObject(emptyMap()))

interface ProviderConfigStore {
    suspend fun load(): ProviderConfig
    suspend fun save(config: ProviderConfig)
}
