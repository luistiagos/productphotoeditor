package com.productphoto.ai.mlkit

import com.google.mlkit.common.model.DownloadConditions
import com.google.mlkit.nl.languageid.LanguageIdentification
import com.google.mlkit.nl.translate.TranslateLanguage
import com.google.mlkit.nl.translate.Translation
import com.google.mlkit.nl.translate.Translator as MlTranslator
import com.google.mlkit.nl.translate.TranslatorOptions
import com.productphoto.ai.api.AiError
import com.productphoto.ai.api.Capability
import com.productphoto.ai.api.ProviderContext
import com.productphoto.ai.api.ProviderFactory
import com.productphoto.ai.api.Requirement
import com.productphoto.ai.api.Translator
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.tasks.await
import kotlinx.serialization.json.JsonObject

/**
 * ML Kit Translate. O motor vem no APK, mas o modelo de cada idioma (~30 MB) é baixado na primeira
 * tradução daquele par (§12.1). Sem rede e sem modelo → AiError.Network, e a cadeia segue.
 * from == null → ML Kit Language ID (empacotado).
 */
class MlKitTranslator : Translator {
    private val languageId = LanguageIdentification.getClient()
    private val clients = HashMap<Pair<String, String>, MlTranslator>()
    private val ready = HashSet<Pair<String, String>>()

    override suspend fun translate(text: String, from: String?, to: String): String {
        if (text.isBlank()) return text
        val target = language(to)
        val source = if (from != null) language(from) else detect(text)
        if (source == target) return text
        val pair = source to target
        val client = synchronized(clients) {
            clients.getOrPut(pair) {
                Translation.getClient(TranslatorOptions.Builder().setSourceLanguage(source).setTargetLanguage(target).build())
            }
        }
        if (synchronized(clients) { pair !in ready }) {
            try {
                client.downloadModelIfNeeded(DownloadConditions.Builder().build()).await()
            } catch (e: CancellationException) {
                throw e
            } catch (e: Exception) {
                throw AiError.Network(e)
            }
            synchronized(clients) { ready += pair }
        }
        return try {
            client.translate(text).await()
        } catch (e: CancellationException) {
            throw e
        } catch (e: Exception) {
            throw AiError.InvalidOutput("mlkit translate: ${e.message}")
        }
    }

    private fun language(tag: String): String =
        TranslateLanguage.fromLanguageTag(tag) ?: throw AiError.Unsupported("language not supported: $tag")

    private suspend fun detect(text: String): String {
        val tag = try {
            languageId.identifyLanguage(text).await()
        } catch (e: CancellationException) {
            throw e
        } catch (e: Exception) {
            throw AiError.InvalidOutput("mlkit language id: ${e.message}")
        }
        if (tag == UNDETERMINED) throw AiError.Unsupported("could not detect the language")
        return language(tag)
    }

    companion object {
        private const val UNDETERMINED = "und"
    }
}

class MlKitTranslateFactory : ProviderFactory<Translator> {
    override val id = "mlkit.translate"
    override val capability = Capability.TRANSLATOR
    override val displayName = "ML Kit Translate"
    override val isLocal = true
    override fun requirements(settings: JsonObject) = emptyList<Requirement>()
    override fun create(settings: JsonObject, ctx: ProviderContext): Translator = MlKitTranslator()
}
