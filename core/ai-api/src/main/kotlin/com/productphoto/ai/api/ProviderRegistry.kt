package com.productphoto.ai.api

class ProviderRegistry {
    private val factories = LinkedHashMap<String, ProviderFactory<*>>()

    fun register(factory: ProviderFactory<*>) {
        require(factory.id !in factories) { "provider ${factory.id} already registered" }
        factories[factory.id] = factory
    }

    fun find(id: String): ProviderFactory<*>? = factories[id]

    fun byCapability(capability: Capability): List<ProviderFactory<*>> =
        factories.values.filter { it.capability == capability }
}
