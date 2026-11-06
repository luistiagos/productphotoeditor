package com.productphoto.editor

import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertEquals
import org.junit.Assert.fail
import org.junit.Test

/** `putImage` (TASK-18): o data URL do 🖌️ Retocar recorte vira os bytes do PNG que o `putBytes` grava como blob. */
class EditorAssetsTest {

    /** PNG 1×1 transparente (o mesmo que um `canvas.toDataURL('image/png')` produz, em menor). */
    private val png1x1 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=="

    @Test
    fun `png data url gives the png bytes untouched`() {
        val bytes = EditorAssets.pngFromDataUrl("data:image/png;base64,$png1x1")
        assertArrayEquals(java.util.Base64.getDecoder().decode(png1x1), bytes)
        assertArrayEquals(byteArrayOf(0x89.toByte(), 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A), bytes.copyOf(8))
    }

    @Test
    fun `anything else is refused as invalid`() {
        val notPng = java.util.Base64.getEncoder().encodeToString("GIF89a-not-a-png".toByteArray())
        for (bad in listOf(
            "data:image/jpeg;base64,$png1x1", // outro tipo
            "data:image/png,$png1x1", // sem ;base64
            "data:image/png;base64,@@@não-é-base64@@@", // base64 inválido
            "data:image/png;base64,$notPng", // bytes sem a assinatura PNG
            "data:image/png;base64,", // vazio
            "https://appassets.androidplatform.net/blob/edit-x.png", // URL, não data URL
        )) {
            try {
                EditorAssets.pngFromDataUrl(bad)
                fail("aceitou $bad")
            } catch (e: BridgeException) {
                assertEquals(bad, ErrorCode.INVALID, e.code)
            }
        }
    }
}
