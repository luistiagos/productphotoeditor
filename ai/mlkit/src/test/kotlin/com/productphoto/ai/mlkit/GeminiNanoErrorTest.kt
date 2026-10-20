package com.productphoto.ai.mlkit

import com.google.mlkit.genai.common.GenAiException
import com.productphoto.ai.api.AiError
import org.junit.Assert.assertTrue
import org.junit.Test

class GeminiNanoErrorTest {
    private val cause = RuntimeException("x")

    @Test
    fun `availability, quota and size errors fall through to the next provider`() {
        for (code in listOf(
            GenAiException.ErrorCode.NOT_AVAILABLE, GenAiException.ErrorCode.BUSY,
            GenAiException.ErrorCode.AICORE_INCOMPATIBLE, GenAiException.ErrorCode.NEEDS_SYSTEM_UPDATE,
            GenAiException.ErrorCode.PER_APP_BATTERY_USE_QUOTA_EXCEEDED, GenAiException.ErrorCode.BACKGROUND_USE_BLOCKED,
            GenAiException.ErrorCode.NOT_ENOUGH_DISK_SPACE, GenAiException.ErrorCode.NOT_SUPPORTED,
            GenAiException.ErrorCode.REQUEST_TOO_LARGE,
        )) {
            val e = GeminiNanoTextGenerator.nanoError(code, cause)
            assertTrue("code $code", e is AiError.Unavailable && e.isFallbackable)
        }
    }

    @Test
    fun `generation errors surface as InvalidOutput`() {
        for (code in listOf(GenAiException.ErrorCode.RESPONSE_GENERATION_ERROR, GenAiException.ErrorCode.UNKNOWN)) {
            val e = GeminiNanoTextGenerator.nanoError(code, cause)
            assertTrue("code $code", e is AiError.InvalidOutput && !e.isFallbackable)
        }
    }
}
