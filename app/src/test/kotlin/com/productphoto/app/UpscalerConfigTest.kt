package com.productphoto.app

import com.productphoto.ai.api.Capability
import com.productphoto.ai.onnx.OnnxRealEsrganFactory
import com.productphoto.ai.onnx.RealEsrganUpscaler
import com.productphoto.models.ModelCatalog
import org.junit.Assert.assertEquals
import org.junit.Test
import java.io.File
import java.security.MessageDigest

class UpscalerConfigTest {
    @Test
    fun `default upscaler chain is the bundled real-esrgan`() {
        assertEquals(listOf(OnnxRealEsrganFactory.ID), AppGraph.DEFAULT_CONFIG.chainFor(Capability.UPSCALER).map { it.provider })
    }

    @Test
    fun `catalog entry matches the bundled model file`() {
        // o teste roda com o diretório do módulo :app como pasta atual
        val catalog = ModelCatalog.parse(File("src/main/assets/models/models.json").readText())
        val entry = catalog.find(RealEsrganUpscaler.MODEL_ID)!!
        assertEquals("UPSCALER", entry.capability)
        val file = File("../ai/onnx/src/main/assets/${entry.bundledAsset}")
        assertEquals(entry.sizeBytes, file.length())
        val sha = MessageDigest.getInstance("SHA-256").digest(file.readBytes()).joinToString("") { "%02x".format(it) }
        assertEquals(entry.sha256, sha)
    }
}
