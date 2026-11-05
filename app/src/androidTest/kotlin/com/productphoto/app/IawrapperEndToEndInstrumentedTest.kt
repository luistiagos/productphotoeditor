package com.productphoto.app

import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import com.productphoto.ai.api.AdAspectRatio
import com.productphoto.ai.api.ImageRequest
import com.productphoto.ai.api.LightDirection
import com.productphoto.ai.api.OutpaintRequest
import com.productphoto.ai.api.RelightRequest
import com.productphoto.ai.api.RgbaImage
import com.productphoto.ai.remotehttp.image.IawrapperBackend
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import java.io.File
import java.io.FileOutputStream

/**
 * Teste End-to-End real de geração de imagem remota via iawrapper.
 * Executa dentro do runtime Android (emulador ou aparelho físico), conecta à API do iawrapper
 * via http://10.0.2.2:8000 (ou IP do host), executa o fluxo completo de autenticação JWT,
 * criação de task, despacho para a GPU Vast.ai (RTX 5090), download da imagem gerada e
 * conversão para Bitmap no Android.
 */
@RunWith(AndroidJUnit4::class)
class IawrapperEndToEndInstrumentedTest {
    private val context = InstrumentationRegistry.getInstrumentation().targetContext

    @Test
    fun generateProductPhotoRemotelyViaIawrapper() = runBlocking {
        val graph = AppGraph(context)

        // 1. Resolve endereço do servidor e autentica previamente (simula sessão ativa do usuário)
        val baseUrl = resolveBaseUrl()
        println("[E2E SETUP] Conectando ao iawrapper em: $baseUrl")
        val jwtToken = obtainJwtToken(baseUrl, "admin@test.com", "admin123")
        graph.secrets.put(IMAGE_IAWRAPPER_SECRET, jwtToken)

        // 2. Configura a cadeia de imagem para usar o iawrapper
        graph.saveImageChain(cloudImageChain(baseUrl, "product-photo-vast", hasCredential = true))

        // 3. Monta o pedido de geração de imagem comercial de produto
        val prompt = "a luxury perfume bottle made of frosted glass with gold cap, studio lighting, product photography, 8k"
        val req = ImageRequest(
            prompt = prompt,
            negativePrompt = "blurry, ugly, distorted, low quality",
            width = 512,
            height = 512,
            count = 1,
        )

        // 4. Executa a geração de ponta a ponta
        val stages = mutableListOf<String>()
        val startNs = System.nanoTime()
        val results = graph.imageGenerator.generate(req) { p ->
            println("[E2E PROGRESS] ${p.fraction?.let { "($it) " } ?: ""}${p.stage}")
            stages.add(p.stage)
        }
        val elapsedMs = (System.nanoTime() - startNs) / 1_000_000
        println("[E2E BENCHMARK] Tempo total de ponta a ponta: ${elapsedMs} ms (${elapsedMs / 1000.0}s)")

        // 5. Validações da imagem gerada
        assertEquals("Deve retornar 1 imagem", 1, results.size)
        val out = results.single().bitmap
        assertNotNull("Bitmap gerado não pode ser nulo", out)
        assertEquals(512, out.width)
        assertEquals(512, out.height)
        assertEquals("http.iawrapper", graph.imageGenerator.chain.lastServedBy.value?.providerId)

        // 6. Grava imagem PNG gerada no cache do app
        val debugFile = File(context.cacheDir, "e2e_iawrapper_generated.png")
        FileOutputStream(debugFile).use { fos ->
            out.compress(android.graphics.Bitmap.CompressFormat.PNG, 100, fos)
        }
        assertTrue("Arquivo PNG deve existir e ter tamanho válido", debugFile.exists() && debugFile.length() > 0)
        println("[E2E SUCCESS] Imagem gerada com sucesso! Arquivo: ${debugFile.absolutePath} (${debugFile.length()} bytes)")
    }

    @Test
    fun testRelightingAds01OnDevice() = runBlocking {
        val graph = AppGraph(context)
        val baseUrl = resolveBaseUrl()
        val jwtToken = obtainJwtToken(baseUrl, "admin@test.com", "admin123")
        graph.secrets.put(IMAGE_IAWRAPPER_SECRET, jwtToken)

        // 1. Cria imagem base de produto (512x512)
        val bitmap = Bitmap.createBitmap(512, 512, Bitmap.Config.ARGB_8888)
        val canvas = Canvas(bitmap)
        val paint = Paint()
        paint.color = Color.rgb(220, 220, 220)
        canvas.drawRect(0f, 0f, 512f, 512f, paint)
        paint.color = Color.rgb(230, 80, 50)
        canvas.drawCircle(256f, 256f, 130f, paint)
        val inputImage = RgbaImage(bitmap)

        // 2. Executa harmonização e relighting (ADS-01)
        val t0 = System.currentTimeMillis()
        val outLeft = graph.relighter.relight(
            RelightRequest(
                image = inputImage,
                lightDir = LightDirection.LEFT,
                strength = 0.65f,
                prompt = "studio soft lighting, left key light",
            )
        )
        val durationLeftMs = System.currentTimeMillis() - t0
        println("[E2E ADS-01] Relight LEFT concluído em ${durationLeftMs}ms, dim: ${outLeft.width}x${outLeft.height}")

        // 3. Validações
        assertNotNull("Imagem de relighting não pode ser nula", outLeft.bitmap)
        assertEquals(512, outLeft.width)
        assertEquals(512, outLeft.height)

        val debugFile = File(context.cacheDir, "e2e_ads01_relighted_left.png")
        FileOutputStream(debugFile).use { fos ->
            outLeft.bitmap.compress(Bitmap.CompressFormat.PNG, 100, fos)
        }
        assertTrue("Arquivo PNG do ADS-01 deve ser gerado", debugFile.exists() && debugFile.length() > 0)
        println("[E2E ADS-01 SUCCESS] Salvo em: ${debugFile.absolutePath} (${debugFile.length()} bytes)")
    }

    @Test
    fun testOutpaintingAds02OnDevice() = runBlocking {
        val graph = AppGraph(context)
        val baseUrl = resolveBaseUrl()
        val jwtToken = obtainJwtToken(baseUrl, "admin@test.com", "admin123")
        graph.secrets.put(IMAGE_IAWRAPPER_SECRET, jwtToken)

        // 1. Cria imagem quadrada de anúncio 1:1 (512x512)
        val bitmap = Bitmap.createBitmap(512, 512, Bitmap.Config.ARGB_8888)
        val canvas = Canvas(bitmap)
        val paint = Paint()
        paint.color = Color.rgb(240, 240, 240)
        canvas.drawRect(0f, 0f, 512f, 512f, paint)
        paint.color = Color.rgb(40, 120, 220)
        canvas.drawRect(156f, 156f, 356f, 356f, paint)
        val inputImage = RgbaImage(bitmap)

        // 2. Executa expansão de formato para 9:16 (ADS-02)
        val t0 = System.currentTimeMillis()
        val outExpanded = graph.adFormatExpander.expand(
            OutpaintRequest(
                source = inputImage,
                targetRatio = AdAspectRatio.RATIO_9_16,
                featherPx = 16,
                prompt = "clean commercial advertising background, extended top and bottom",
            )
        )
        val durationMs = System.currentTimeMillis() - t0
        println("[E2E ADS-02] Outpaint 9:16 concluído em ${durationMs}ms, dim: ${outExpanded.width}x${outExpanded.height}")

        // 3. Validações
        assertNotNull("Imagem expandida não pode ser nula", outExpanded.bitmap)
        assertEquals(512, outExpanded.width)
        // 512 * 16 / 9 = 910.22 -> múltiplo de 8 = 912
        assertEquals(912, outExpanded.height)

        val debugFile = File(context.cacheDir, "e2e_ads02_outpainted_9_16.png")
        FileOutputStream(debugFile).use { fos ->
            outExpanded.bitmap.compress(Bitmap.CompressFormat.PNG, 100, fos)
        }
        assertTrue("Arquivo PNG do ADS-02 deve ser gerado", debugFile.exists() && debugFile.length() > 0)
        println("[E2E ADS-02 SUCCESS] Salvo em: ${debugFile.absolutePath} (${debugFile.length()} bytes)")
    }

    private fun resolveBaseUrl(): String {
        for (candidate in listOf("https://iawrappernew-production.up.railway.app", "http://127.0.0.1:8000", "http://10.0.2.2:8000")) {
            try {
                val conn = java.net.URL("$candidate/api/features/").openConnection() as java.net.HttpURLConnection
                conn.connectTimeout = 3000
                conn.readTimeout = 3000
                val code = conn.responseCode
                conn.disconnect()
                if (code in 200..499) return candidate
            } catch (_: Exception) {
            }
        }
        return "https://iawrappernew-production.up.railway.app"
    }

    private fun obtainJwtToken(baseUrl: String, email: String, pass: String): String {
        return try {
            val conn = java.net.URL("$baseUrl/api/auth/login/").openConnection() as java.net.HttpURLConnection
            conn.requestMethod = "POST"
            conn.connectTimeout = 5000
            conn.readTimeout = 5000
            conn.doOutput = true
            conn.setRequestProperty("Content-Type", "application/json")
            // SEC-13.2: sem o app o iawrapper recusa o login com 400
            conn.setRequestProperty(IawrapperBackend.APP_HEADER, BuildConfig.IAWRAPPER_APP_ID)
            val json = """{"email":"$email","password":"$pass"}"""
            conn.outputStream.use { it.write(json.toByteArray()) }
            val body = conn.inputStream.use { it.readBytes().decodeToString() }
            val accessKey = "\"access\":\""
            val idx = body.indexOf(accessKey)
            if (idx >= 0) {
                val end = body.indexOf("\"", idx + accessKey.length)
                body.substring(idx + accessKey.length, end)
            } else {
                "$email:$pass"
            }
        } catch (_: Exception) {
            "$email:$pass"
        }
    }
}

