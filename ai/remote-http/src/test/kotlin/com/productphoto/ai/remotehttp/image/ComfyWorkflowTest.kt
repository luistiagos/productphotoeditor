package com.productphoto.ai.remotehttp.image

import com.productphoto.ai.api.AiError
import com.productphoto.ai.api.Control
import com.productphoto.ai.api.ImageFeature
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.int
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.long
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Assert.fail
import org.junit.Test

class ComfyWorkflowTest {
    private val opts = ComfyOptions(checkpoint = "sd15.safetensors", cannyControlNet = "canny.pth")
    private val png = byteArrayOf(1)

    private fun job(init: Boolean = false, mask: Boolean = false, control: Control.Kind? = null, strength: Float? = null) =
        ImageJob("a red mug", "text", 512, 768, steps = null, seed = null, cfg = 5f, count = 3,
            init = png.takeIf { init }, strength = strength, mask = png.takeIf { mask },
            control = control?.let { ControlJob(it, png, .7f) })

    private fun JsonObject.node(id: String) = this[id]!!.jsonObject
    private fun JsonObject.type(id: String) = node(id)["class_type"]!!.jsonPrimitive.content
    private fun JsonObject.input(id: String, key: String) = node(id)["inputs"]!!.jsonObject[key]!!
    private fun JsonObject.linkOf(id: String, key: String) = (input(id, key) as JsonArray).let { it[0].jsonPrimitive.content to it[1].jsonPrimitive.int }

    @Test
    fun `txt2img graph`() {
        val g = ComfyWorkflow.builtIn(job(), UploadedImages(), opts, seed = 77, batch = 3)
        assertEquals("CheckpointLoaderSimple", g.type("1"))
        assertEquals("sd15.safetensors", g.input("1", "ckpt_name").jsonPrimitive.content)
        assertEquals("a red mug", g.input("2", "text").jsonPrimitive.content)
        assertEquals("1" to 1, g.linkOf("2", "clip"))
        assertEquals("text", g.input("3", "text").jsonPrimitive.content)
        assertEquals("EmptyLatentImage", g.type("4"))
        assertEquals(3, g.input("4", "batch_size").jsonPrimitive.int)
        assertEquals(768, g.input("4", "height").jsonPrimitive.int)
        assertEquals("KSampler", g.type("5"))
        assertEquals("4" to 0, g.linkOf("5", "latent_image"))
        assertEquals("2" to 0, g.linkOf("5", "positive"))
        assertEquals("3" to 0, g.linkOf("5", "negative"))
        assertEquals(77L, g.input("5", "seed").jsonPrimitive.long)
        assertEquals(18, g.input("5", "steps").jsonPrimitive.int)
        assertEquals(5f, g.input("5", "cfg").jsonPrimitive.content.toFloat())
        assertEquals("euler_ancestral", g.input("5", "sampler_name").jsonPrimitive.content)
        assertEquals(1f, g.input("5", "denoise").jsonPrimitive.content.toFloat())
        assertEquals("5" to 0, g.linkOf("6", "samples"))
        assertEquals("SaveImage", g.type("7"))
        assertEquals("6" to 0, g.linkOf("7", "images"))
        assertNull(g["10"])
    }

    @Test
    fun `img2img and inpaint graphs`() {
        val img = ComfyWorkflow.builtIn(job(init = true, strength = .55f), UploadedImages(init = "pp-a.png"), opts, 1, 1)
        assertNull(img["4"])
        assertEquals("pp-a.png", img.input("10", "image").jsonPrimitive.content)
        assertEquals("10" to 0, img.linkOf("11", "pixels"))
        assertEquals("1" to 2, img.linkOf("11", "vae"))
        assertEquals("11" to 0, img.linkOf("5", "latent_image"))
        assertEquals(.55f, img.input("5", "denoise").jsonPrimitive.content.toFloat())

        val inp = ComfyWorkflow.builtIn(job(init = true, mask = true), UploadedImages("pp-a.png", "pp-m.png"), opts, 1, 1)
        assertEquals("LoadImageMask", inp.type("12"))
        assertEquals("pp-m.png", inp.input("12", "image").jsonPrimitive.content)
        assertEquals("red", inp.input("12", "channel").jsonPrimitive.content)
        assertEquals("SetLatentNoiseMask", inp.type("13"))
        assertEquals("11" to 0, inp.linkOf("13", "samples"))
        assertEquals("12" to 0, inp.linkOf("13", "mask"))
        assertEquals("13" to 0, inp.linkOf("5", "latent_image"))
        assertEquals(.75f, inp.input("5", "denoise").jsonPrimitive.content.toFloat())
    }

    @Test
    fun `canny control is wired between the prompts and the sampler`() {
        val g = ComfyWorkflow.builtIn(job(control = Control.Kind.CANNY), UploadedImages(control = "pp-c.png"), opts, 1, 1)
        assertEquals("pp-c.png", g.input("20", "image").jsonPrimitive.content)
        assertEquals("Canny", g.type("21"))
        assertEquals("canny.pth", g.input("22", "control_net_name").jsonPrimitive.content)
        assertEquals("ControlNetApplyAdvanced", g.type("23"))
        assertEquals("2" to 0, g.linkOf("23", "positive"))
        assertEquals("3" to 0, g.linkOf("23", "negative"))
        assertEquals("21" to 0, g.linkOf("23", "image"))
        assertEquals(.7f, g.input("23", "strength").jsonPrimitive.content.toFloat())
        assertEquals("23" to 0, g.linkOf("5", "positive"))
        assertEquals("23" to 1, g.linkOf("5", "negative"))
    }

    @Test
    fun `missing checkpoint or controlnet is Unsupported`() {
        val cases = listOf(
            { ComfyWorkflow.builtIn(job(), UploadedImages(), opts.copy(checkpoint = null), 1, 1) },
            { ComfyWorkflow.builtIn(job(control = Control.Kind.SCRIBBLE), UploadedImages(control = "c"), opts, 1, 1) },
        )
        for (c in cases) {
            try {
                c()
                fail()
            } catch (_: AiError.Unsupported) {
            }
        }
        assertEquals(
            setOf(ImageFeature.TXT2IMG, ImageFeature.IMG2IMG, ImageFeature.INPAINT, ImageFeature.CONTROL_CANNY),
            ComfyWorkflow.builtInSupports(opts),
        )
    }

    private val userFlow = """
        {"3": {"class_type": "KSampler", "inputs": {"seed": "{{seed}}", "steps": "{{steps}}", "cfg": "{{cfg}}",
               "denoise": "{{denoise}}", "sampler_name": "euler", "model": ["4", 0], "positive": ["6", 0]}},
         "5": {"class_type": "EmptySD3LatentImage", "inputs": {"width": "{{width}}", "height": "{{height}}", "batch_size": "{{count}}"}},
         "6": {"class_type": "CLIPTextEncode", "inputs": {"text": "{{prompt}}", "clip": ["4", 1]}},
         "7": {"class_type": "CLIPTextEncode", "inputs": {"text": "{{negative}} extra", "clip": ["4", 1]}},
         "9": {"class_type": "LoadImage", "inputs": {"image": "{{control_image}}"}}}
    """.trimIndent()

    @Test
    fun `user workflow markers are replaced and numbers become numbers`() {
        val graph = ComfyWorkflow.parseUser(userFlow)
        assertEquals(
            setOf(ImageFeature.TXT2IMG, ImageFeature.CONTROL_CANNY, ImageFeature.CONTROL_SCRIBBLE),
            ComfyWorkflow.userSupports(graph),
        )
        val g = ComfyWorkflow.fillUser(graph, job(control = Control.Kind.SCRIBBLE), UploadedImages(control = "pp-c.png"), opts, seed = 123)
        val seed = g.input("3", "seed").jsonPrimitive
        assertFalse(seed.isString)
        assertEquals(123L, seed.long)
        assertEquals(18, g.input("3", "steps").jsonPrimitive.int)
        assertFalse(g.input("5", "batch_size").jsonPrimitive.isString)
        assertEquals(3, g.input("5", "batch_size").jsonPrimitive.int)
        assertEquals(512, g.input("5", "width").jsonPrimitive.int)
        assertEquals(1f, g.input("3", "denoise").jsonPrimitive.content.toFloat())
        assertEquals("a red mug", g.input("6", "text").jsonPrimitive.content)
        assertEquals("{{negative}} extra", g.input("7", "text").jsonPrimitive.content) // só valores iguais ao marcador
        assertEquals("pp-c.png", g.input("9", "image").jsonPrimitive.content)
        assertEquals(listOf("4", "0"), g.input("3", "model").jsonArray.map { it.jsonPrimitive.content })
    }

    @Test
    fun `user workflow image marker without image, and non-API JSON, are Unsupported`() {
        val graph = ComfyWorkflow.parseUser(userFlow)
        val cases = listOf(
            { ComfyWorkflow.fillUser(graph, job(), UploadedImages(), opts, 1) },
            { ComfyWorkflow.parseUser("""{"nodes": [], "links": []}""") },
            { ComfyWorkflow.parseUser("não é json") },
        )
        for (c in cases) {
            try {
                c()
                fail()
            } catch (e: AiError.Unsupported) {
                assertTrue(e.message!!.isNotBlank())
            }
        }
    }
}
