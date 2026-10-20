package com.productphoto.ai.mlkit

import androidx.test.ext.junit.runners.AndroidJUnit4
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith

/**
 * Prova da fase 3 (tradução). Precisa de rede na primeira execução: baixa o modelo pt↔en (~30 MB).
 */
@RunWith(AndroidJUnit4::class)
class TranslatorInstrumentedTest {
    private val translator = MlKitTranslator()

    @Test
    fun translatesPortugueseToEnglish() = runBlocking {
        val out = translator.translate("uma garrafa de vidro sobre uma mesa de madeira", "pt", "en").lowercase()
        assertTrue(out, "bottle" in out && "table" in out)
    }

    @Test
    fun detectsSourceLanguageWhenNull() = runBlocking {
        val out = translator.translate("um sapato vermelho na praia ao pôr do sol", null, "en").lowercase()
        assertTrue(out, "shoe" in out && "beach" in out)
    }

    @Test
    fun sameLanguageReturnsInput() = runBlocking {
        assertEquals("hello", translator.translate("hello", "en", "en"))
    }
}
