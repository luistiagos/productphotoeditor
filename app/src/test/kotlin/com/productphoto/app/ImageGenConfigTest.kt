package com.productphoto.app

import com.productphoto.ai.api.AiError
import com.productphoto.ai.api.Capability
import com.productphoto.ai.api.ChainEntry
import com.productphoto.ai.remotehttp.image.A1111ImageFactory
import com.productphoto.ai.remotehttp.image.ComfyUiImageFactory
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class ImageGenConfigTest {
    @Test
    fun `default config has the image chain off`() {
        assertTrue(Capability.IMAGE_GENERATOR in AppGraph.DEFAULT_CONFIG.capabilities)
        val chain = AppGraph.DEFAULT_CONFIG.chainFor(Capability.IMAGE_GENERATOR)
        assertTrue(chain.isEmpty())
        assertEquals(ImageGenSettings(ImageServer.OFF, "", ""), imageGenStateOf(chain))
    }

    @Test
    fun `chain round trip keeps the other settings of the same provider`() {
        val previous = listOf(
            ChainEntry(ComfyUiImageFactory.ID, JsonObject(mapOf(
                "baseUrl" to JsonPrimitive("http://old:8188"),
                ComfyUiImageFactory.CANNY_CONTROLNET to JsonPrimitive("canny.pth"),
                ComfyUiImageFactory.API_KEY_SECRET to JsonPrimitive(IMAGE_COMFY_SECRET),
            ))),
        )
        val chain = imageChainOf(ImageGenSettings(ImageServer.COMFYUI, " http://10.0.2.2:8188 ", "sd15.safetensors"), hasSecret = false, previous)
        val s = chain.single().settings
        assertEquals("http://10.0.2.2:8188", (s["baseUrl"] as JsonPrimitive).content)
        assertEquals("sd15.safetensors", (s[ComfyUiImageFactory.CHECKPOINT] as JsonPrimitive).content)
        assertEquals("canny.pth", (s[ComfyUiImageFactory.CANNY_CONTROLNET] as JsonPrimitive).content)
        assertNull(s[ComfyUiImageFactory.API_KEY_SECRET])
        assertEquals(ImageGenSettings(ImageServer.COMFYUI, "http://10.0.2.2:8188", "sd15.safetensors"), imageGenStateOf(chain))

        val a1111 = imageChainOf(ImageGenSettings(ImageServer.A1111, "http://h:7860", ""), hasSecret = true, previous).single()
        assertEquals(A1111ImageFactory.ID, a1111.provider)
        assertEquals(IMAGE_A1111_SECRET, (a1111.settings[A1111ImageFactory.AUTH_SECRET] as JsonPrimitive).content)
        assertTrue(imageChainOf(ImageGenSettings(ImageServer.OFF, "", ""), false, previous).isEmpty())
        assertEquals(ImageServer.OFF, imageGenStateOf(emptyList()).server)
    }

    @Test
    fun `unavailable without url asks for the address`() {
        assertEquals("Informe o endereço do servidor e salve", describeImageError(AiError.Unavailable(emptyList()), ImageServer.A1111))
        assertTrue(describeImageError(AiError.Remote(404, null), ImageServer.A1111).contains("--api"))
    }
}
