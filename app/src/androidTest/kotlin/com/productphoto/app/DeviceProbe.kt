package com.productphoto.app

import ai.onnxruntime.OnnxJavaType
import ai.onnxruntime.OnnxTensor
import ai.onnxruntime.OrtEnvironment
import ai.onnxruntime.OrtLoggingLevel
import ai.onnxruntime.OrtSession
import ai.onnxruntime.providers.NNAPIFlags
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import ai.onnxruntime.TensorInfo
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.Rect
import android.os.SystemClock
import android.util.Half
import android.util.Log
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import com.productphoto.ai.api.Mask
import com.productphoto.ai.api.RgbaImage
import com.productphoto.ai.api.StructuredText
import com.productphoto.ai.api.TextRequest
import com.productphoto.ai.litertlm.LiteRtLmFactory
import com.productphoto.ai.litertlm.LiteRtLmTextGenerator
import com.productphoto.ai.onnx.MiGanInpainter
import com.productphoto.ai.onnx.OnnxBackgroundRemover
import com.productphoto.ai.onnx.RealEsrganUpscaler
import com.productphoto.editor.TextPrompts
import com.productphoto.imaging.Raster
import com.productphoto.imaging.cutout
import com.productphoto.imaging.resizePlane
import com.productphoto.imaging.toMask
import com.productphoto.imaging.toRaster
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Assume.assumeTrue
import org.junit.Test
import org.junit.runner.RunWith
import java.io.File
import java.nio.ByteBuffer
import java.nio.ByteOrder
import java.nio.FloatBuffer
import java.nio.IntBuffer
import java.nio.LongBuffer
import java.util.EnumSet
import kotlin.math.roundToInt

/**
 * Medições de tempo e pico de RSS num aparelho de verdade (ARQUITETURA §21). Rodar um método por `am instrument`
 * (processo novo, VmHWM só daquela medição); resultado no logcat com a tag DeviceProbe. Pula sem o modelo.
 * `llm` lê os argumentos `-e model <id>` (padrão qwen3-0.6b-int4) e `-e gpu true|false`.
 */
@RunWith(AndroidJUnit4::class)
class DeviceProbe {
    private val instr = InstrumentationRegistry.getInstrumentation()
    private val context = instr.targetContext

    @Test
    fun migan12mp() = runBlocking<Unit> {
        val file = AppGraph(context).models.ensureReady(MiGanInpainter.MODEL_ID)
        assumeTrue(file != null)
        val w = 4000
        val h = 3000
        val pixels = IntArray(w * h) { i -> Color.rgb(90 + (i % w) / 64, 110 + (i / w) / 64, 160) }
        val bmp = Bitmap.createBitmap(pixels, w, h, Bitmap.Config.ARGB_8888)
        val alpha = ByteArray(w * h)
        for (y in 1200 until 1800) for (x in 1700 until 2300) alpha[y * w + x] = 0xFF.toByte()
        Log.i(TAG, "migan antes: ${memory()}")
        val inpainter = MiGanInpainter(file!!)
        repeat(2) { round ->
            val t0 = System.currentTimeMillis()
            val out = inpainter.inpaint(RgbaImage(bmp), Mask(w, h, alpha))
            Log.i(TAG, "migan ${w}x$h rodada $round: ${System.currentTimeMillis() - t0} ms; ${memory()}")
            assertEquals(w, out.width)
        }
    }

    @Test
    fun llm() = runBlocking<Unit> {
        val args = InstrumentationRegistry.getArguments()
        val modelId = args.getString("model") ?: "qwen3-0.6b-int4"
        val gpu = args.getString("gpu") == "true"
        val file = AppGraph(context).models.ensureReady(modelId)
        assumeTrue("baixe $modelId em Modelos de IA antes", file != null)
        val gen = LiteRtLmTextGenerator(modelId, file!!, LiteRtLmFactory.cacheDirFor(context.cacheDir, modelId), gpu = gpu)
        try {
            val t0 = System.currentTimeMillis()
            val plain = gen.generate(TextRequest(system = null, prompt = "Escreva um slogan curto para uma padaria artesanal.", maxTokens = 64))
            Log.i(TAG, "$modelId gpu=$gpu 1ª resposta (inclui carregar): ${System.currentTimeMillis() - t0} ms: $plain")
            val t1 = System.currentTimeMillis()
            val again = gen.generate(TextRequest(system = null, prompt = "Escreva um slogan curto para uma floricultura.", maxTokens = 64))
            Log.i(TAG, "$modelId gpu=$gpu 2ª resposta (motor carregado): ${System.currentTimeMillis() - t1} ms, ${again.length} chars: $again")
            val t2 = System.currentTimeMillis()
            val json = StructuredText.generate(gen, TextPrompts.rewrite("Promoção de pão francês hoje", "persuasive", 3))
            Log.i(TAG, "$modelId gpu=$gpu rewrite JSON: ${System.currentTimeMillis() - t2} ms: $json")
            Log.i(TAG, "$modelId gpu=$gpu memória: ${memory()}")
        } finally {
            gen.close()
        }
    }

    /**
     * Real-ESRGAN x4v3 (§20.5 task 1): 20 tiles de 128² do shoe.jpg (grade 5×4), ms por tile só do `run` e VmHWM.
     * Args `-e variant float|w8a8` e `-e ep cpu|xnnpack`; o modelo juntado (`tools/merge_onnx.py`) vai para
     * `files/probe/` por `adb exec-in run-as <pkg> sh -c 'cat > files/probe/<arquivo>'` (pasta criada pelo shell na
     * área externa fica sem acesso para o app). Grava a entrada e a saída do tile 7 lá para comparar com o PC.
     */
    @Test
    fun esrgan() = runBlocking<Unit> {
        val args = InstrumentationRegistry.getArguments()
        val variant = args.getString("variant") ?: "float"
        val ep = args.getString("ep") ?: "cpu"
        val dir = File(context.filesDir, "probe")
        val file = File(dir, "realesr_general_x4v3_$variant.onnx")
        assumeTrue("adb push do modelo para $file antes", file.exists())
        val photo = instr.context.assets.open("shoe.jpg").use { BitmapFactory.decodeStream(it) }
        val t = 128
        val tiles = (0 until 4).flatMap { j ->
            (0 until 5).map { i ->
                IntArray(t * t).also { photo.getPixels(it, 0, t, (photo.width - t) * i / 4, (photo.height - t) * j / 3, t, t) }
            }
        }
        Log.i(TAG, "esrgan antes: ${memory()}")
        val env = OrtEnvironment.getEnvironment()
        val opts = OrtSession.SessionOptions().apply {
            setOptimizationLevel(OrtSession.SessionOptions.OptLevel.ALL_OPT)
            if (ep == "xnnpack") {
                // recomendação do ORT para o XNNPACK: o pool do EP faz o trabalho, o da sessão fica com 1 thread
                setIntraOpNumThreads(1)
                addConfigEntry("session.intra_op.allow_spinning", "0")
                addXnnpack(mapOf("intra_op_num_threads" to "4"))
            } else {
                setIntraOpNumThreads(4)
            }
        }
        val t0 = SystemClock.elapsedRealtime()
        env.createSession(file.absolutePath, opts).use { s ->
            Log.i(TAG, "esrgan $variant/$ep: sessão em ${SystemClock.elapsedRealtime() - t0} ms; " +
                "entradas ${s.inputInfo}; saídas ${s.outputInfo}")
            val quantized = variant == "w8a8"
            val ms = LongArray(tiles.size)
            tiles.forEachIndexed { k, px ->
                val chw = ByteArray(3 * t * t)
                for (p in 0 until t * t) {
                    chw[p] = (px[p] shr 16).toByte()
                    chw[t * t + p] = (px[p] shr 8).toByte()
                    chw[2 * t * t + p] = px[p].toByte()
                }
                val shape = longArrayOf(1, 3, t.toLong(), t.toLong())
                val input = if (quantized) {
                    OnnxTensor.createTensor(env, ByteBuffer.allocateDirect(chw.size).put(chw).apply { rewind() }, shape, OnnxJavaType.UINT8)
                } else {
                    val fb = ByteBuffer.allocateDirect(4 * chw.size).order(ByteOrder.nativeOrder()).asFloatBuffer()
                    for (b in chw) fb.put((b.toInt() and 0xFF) / 255f)
                    OnnxTensor.createTensor(env, fb.apply { rewind() }, shape)
                }
                val t1 = SystemClock.elapsedRealtime()
                val out = input.use {
                    s.run(mapOf("image" to it)).use { r ->
                        val o = r.get(0) as OnnxTensor
                        ByteArray(3 * 512 * 512).also { dst ->
                            if (quantized) {
                                val bb = o.byteBuffer
                                for (q in dst.indices) {
                                    val v = ((bb.get(q).toInt() and 0xFF) - OUT_ZP) * OUT_SCALE
                                    dst[q] = (v.coerceIn(0f, 1f) * 255f).roundToInt().toByte()
                                }
                            } else {
                                val fbOut = o.floatBuffer
                                for (q in dst.indices) dst[q] = (fbOut.get(q).coerceIn(0f, 1f) * 255f).roundToInt().toByte()
                            }
                        }
                    }
                }
                ms[k] = SystemClock.elapsedRealtime() - t1
                if (k == 7) {
                    File(dir, "in_tile7.bin").writeBytes(chw)
                    File(dir, "out_${variant}_$ep.bin").writeBytes(out)
                }
            }
            val rest = ms.drop(1).sorted()
            Log.i(TAG, "esrgan $variant/$ep: 1º tile ${ms[0]} ms; mediana sem o 1º ${rest[rest.size / 2]} ms " +
                "(min ${rest.first()}, max ${rest.last()}); todos ${ms.joinToString()}; ${memory()}")
        }
    }

    /**
     * Upscale pelo provedor (§20.5 task 4): 512² (miolo quadrado do shoe.jpg reduzido) em ×`-e factor` (2 ou 4).
     * Loga tempo e VmHWM; grava entrada e saída em `files/probe/` (PNG) para `docs/fase7_amostras/`.
     */
    @Test
    fun upscale() = runBlocking<Unit> {
        val factor = InstrumentationRegistry.getArguments().getString("factor")?.toInt() ?: 2
        val file = AppGraph(context).models.ensureReady(RealEsrganUpscaler.MODEL_ID)!!
        val src = shoe512()
        val dir = File(context.filesDir, "probe").apply { mkdirs() }
        File(dir, "upscale_in_512.png").outputStream().use { src.compress(Bitmap.CompressFormat.PNG, 100, it) }
        Log.i(TAG, "upscale antes: ${memory()}")
        val t0 = SystemClock.elapsedRealtime()
        var tiles = 0
        val out = RealEsrganUpscaler(file).upscale(RgbaImage(src), factor) { tiles++ }
        val ms = SystemClock.elapsedRealtime() - t0
        Log.i(TAG, "upscale ×$factor 512² → ${out.width}x${out.height}: $ms ms, $tiles tiles; ${memory()}")
        assertEquals(512 * factor, out.width)
        File(dir, "upscale_x$factor.png").outputStream().use { out.bitmap.compress(Bitmap.CompressFormat.PNG, 100, it) }
    }

    /**
     * Removedor de qualidade (§24.4 task 1): `-e model isnet|u2netp`. Modelo e fotos (`shoe/mug/jar.jpg`) em
     * `files/probe/` (u2netp pelo `ModelManager`); sessão CPU, 4 threads, sem arena. Loga sessão, ms e VmHWM por foto;
     * grava `mask_<model>_<foto>.png` para o `removerSheet`. O ramo `birefnet16` saiu com o BiRefNet (§24.5, §25).
     */
    @Test
    fun remover() = runBlocking<Unit> {
        val model = InstrumentationRegistry.getArguments().getString("model") ?: "isnet"
        val dir = File(context.filesDir, "probe")
        val photos = photoNames().map { File(dir, "$it.jpg") }
        assumeTrue("adb push das fotos para $dir antes", photos.all { it.exists() })
        Log.i(TAG, "remover $model antes: ${memory()}")
        if (model == "u2netp") {
            val remover = OnnxBackgroundRemover(AppGraph(context).models.ensureReady(OnnxBackgroundRemover.MODEL_ID)!!)
            for (p in photos) {
                val bmp = decodeArgb(p)
                val t0 = SystemClock.elapsedRealtime()
                val mask = remover.removeBackground(RgbaImage(bmp))
                Log.i(TAG, "remover u2netp ${p.name} ${bmp.width}x${bmp.height}: ${SystemClock.elapsedRealtime() - t0} ms; ${memory()}")
                saveMask(mask, File(dir, "mask_u2netp_${p.nameWithoutExtension}.png"))
            }
            return@runBlocking
        }
        val file = File(dir, "isnet-general-use.onnx")
        assumeTrue("adb push do modelo para $file antes", file.exists())
        val env = OrtEnvironment.getEnvironment()
        val opts = OrtSession.SessionOptions().apply {
            setIntraOpNumThreads(Runtime.getRuntime().availableProcessors().coerceIn(1, 4))
            setOptimizationLevel(OrtSession.SessionOptions.OptLevel.ALL_OPT)
            setCPUArenaAllocator(false)
            setMemoryPatternOptimization(false)
        }
        val t0 = SystemClock.elapsedRealtime()
        env.createSession(file.absolutePath, opts).use { s ->
            val inName = s.inputNames.first()
            val inType = (s.inputInfo.getValue(inName).info as TensorInfo).type
            Log.i(TAG, "remover $model: sessão em ${SystemClock.elapsedRealtime() - t0} ms; entradas ${s.inputInfo}; " +
                "saídas ${s.outputInfo}; ${memory()}")
            val n = ISNET_SIZE * ISNET_SIZE
            for (p in photos) {
                val bmp = decodeArgb(p)
                val t1 = SystemClock.elapsedRealtime()
                val small = Bitmap.createScaledBitmap(bmp, ISNET_SIZE, ISNET_SIZE, true).toRaster()
                // ISNet: mean 0,5 / std 1 (rembg dis_general_use), §24.2
                val chw = isnetChw(small)
                val shape = longArrayOf(1, 3, ISNET_SIZE.toLong(), ISNET_SIZE.toLong())
                val input = if (inType == OnnxJavaType.FLOAT16) {
                    val sb = ByteBuffer.allocateDirect(2 * chw.size).order(ByteOrder.nativeOrder()).asShortBuffer()
                    for (v in chw) sb.put(Half.toHalf(v))
                    OnnxTensor.createTensor(env, sb.apply { rewind() }, shape, OnnxJavaType.FLOAT16)
                } else {
                    OnnxTensor.createTensor(env, FloatBuffer.wrap(chw), shape)
                }
                val t2 = SystemClock.elapsedRealtime()
                val pred = input.use {
                    s.run(mapOf(inName to it)).use { r ->
                        val o = r.get(0) as OnnxTensor
                        if (o.info.type == OnnxJavaType.FLOAT16) {
                            val sb = o.shortBuffer
                            FloatArray(n) { Half.toFloat(sb.get(it)) }
                        } else {
                            val fb = o.floatBuffer
                            FloatArray(n).also { fb.get(it) }
                        }
                    }
                }
                val runMs = SystemClock.elapsedRealtime() - t2
                val plane = resizePlane(minMax(pred), ISNET_SIZE, ISNET_SIZE, bmp.width, bmp.height)
                val mask = plane.toMask(bmp.width, bmp.height)
                Log.i(TAG, "remover $model ${p.name} ${bmp.width}x${bmp.height}: run $runMs ms, total " +
                    "${SystemClock.elapsedRealtime() - t1} ms; ${memory()}")
                saveMask(mask, File(dir, "mask_${model}_${p.nameWithoutExtension}.png"))
            }
        }
    }

    /**
     * Folha original | u2netp | ISNet por foto (§24.4 task 2), a partir das máscaras do `remover`;
     * modelo sem máscara (morto no LMK) fica de fora.
     */
    @Test
    fun removerSheet() {
        val dir = File(context.filesDir, "probe")
        for (name in photoNames()) {
            val masks = listOf("u2netp", "isnet").map { File(dir, "mask_${it}_$name.png") }.filter { it.exists() }
            assumeTrue("rode o remover antes", masks.size >= 2)
            val models = masks
            val full = decodeArgb(File(dir, "$name.jpg"))
            val h = minOf(768, full.height)
            val w = full.width * h / full.height
            val src = Bitmap.createScaledBitmap(full, w, h, true)
            val out = Bitmap.createBitmap(w * (models.size + 1), h, Bitmap.Config.ARGB_8888)
            val c = Canvas(out)
            c.drawBitmap(src, 0f, 0f, null)
            val light = Paint().apply { color = Color.rgb(238, 238, 238) }
            val dark = Paint().apply { color = Color.rgb(204, 204, 204) }
            masks.forEachIndexed { i, f ->
                val x0 = w * (i + 1)
                val cell = 24
                for (y in 0 until h step cell) for (x in 0 until w step cell) {
                    c.drawRect(Rect(x0 + x, y, x0 + minOf(x + cell, w), minOf(y + cell, h)), if ((x / cell + y / cell) % 2 == 0) light else dark)
                }
                val m = Bitmap.createScaledBitmap(decodeArgb(f), w, h, true)
                val px = IntArray(w * h).also { m.getPixels(it, 0, w, 0, 0, w, h) }
                c.drawBitmap(cutout(src, Mask(w, h, ByteArray(w * h) { (px[it] and 0xFF).toByte() })), x0.toFloat(), 0f, null)
            }
            File(dir, "sheet_$name.png").outputStream().use { out.compress(Bitmap.CompressFormat.PNG, 100, it) }
            Log.i(TAG, "removerSheet $name: ${out.width}x${out.height}")
        }
    }

    /**
     * Zoom 1:1 nas bordas difíceis (alça, cadarço, tampa): u2netp | ISNet sobre xadrez, `zoom_<foto>.png`; loga IoU
     * entre as máscaras (alfa ≥ 128) e a fração de borda incerta (alfa 26..229 sobre a área do objeto).
     */
    @Test
    fun removerZoom() {
        val dir = File(context.filesDir, "probe")
        val crops = mapOf("shoe" to Rect(600, 150, 1300, 600), "mug" to Rect(1000, 330, 1700, 780), "jar" to Rect(380, 460, 1120, 760))
        for ((name, r) in crops) {
            val src = decodeArgb(File(dir, "$name.jpg"))
            val masks = listOf("u2netp", "isnet").map { m ->
                val b = decodeArgb(File(dir, "mask_${m}_$name.png"))
                val px = IntArray(b.width * b.height).also { b.getPixels(it, 0, b.width, 0, 0, b.width, b.height) }
                Mask(b.width, b.height, ByteArray(px.size) { (px[it] and 0xFF).toByte() })
            }
            val stats = masks.map { m ->
                val a = m.alpha.map { it.toInt() and 0xFF }
                val fg = a.count { it >= 128 }
                "fg $fg, incerta ${"%.3f".format(a.count { it in 26..229 }.toFloat() / fg)}"
            }
            val inter = masks[0].alpha.indices.count { (masks[0].alpha[it].toInt() and 0xFF) >= 128 && (masks[1].alpha[it].toInt() and 0xFF) >= 128 }
            val union = masks[0].alpha.indices.count { (masks[0].alpha[it].toInt() and 0xFF) >= 128 || (masks[1].alpha[it].toInt() and 0xFF) >= 128 }
            Log.i(TAG, "removerZoom $name: u2netp ${stats[0]}; isnet ${stats[1]}; IoU ${"%.3f".format(inter.toFloat() / union)}")
            val w = r.width()
            val h = r.height()
            val out = Bitmap.createBitmap(w * 2 + 8, h, Bitmap.Config.ARGB_8888)
            val c = Canvas(out)
            c.drawColor(Color.RED)
            val light = Paint().apply { color = Color.rgb(238, 238, 238) }
            val dark = Paint().apply { color = Color.rgb(160, 160, 160) }
            masks.forEachIndexed { i, m ->
                val x0 = i * (w + 8)
                for (y in 0 until h step 16) for (x in 0 until w step 16) {
                    c.drawRect(Rect(x0 + x, y, x0 + minOf(x + 16, w), minOf(y + 16, h)), if ((x / 16 + y / 16) % 2 == 0) light else dark)
                }
                c.drawBitmap(cutout(src, m), r, Rect(x0, 0, x0 + w, h), null)
            }
            File(dir, "zoom_$name.png").outputStream().use { out.compress(Bitmap.CompressFormat.PNG, 100, it) }
        }
    }

    /**
     * UNet do SD (§27.5 task 2): `-e model lcmds7|tinysd`, `-e ep cpu|xnnpack|webgpu|nnapi|nnapi32`, `-e verbose true`
     * (alocação dos nós no logcat `onnxruntime`: "Node(s) placed on", "supported by NNAPI"; rodar à parte, o log pesa no
     * tempo). Modelo (`lcmds7_unet.onnx` do tools/sd_fp16.py, `tinysd_unet.onnx`) e entradas fixas do tools/sd_ref.py
     * (`latent.bin`, `ehs.bin`, `tcond.bin`, f32 LE) em `files/probe/`; formas fixas 1×4×64×64, t = 999. Loga EPs
     * disponíveis, sessão, 1 aquecimento + 4 medidas, memória; grava `out_<model>_<ep>.bin` e compara com a saída do PC.
     */
    @Test
    fun sdUnet() = runBlocking<Unit> {
        val args = InstrumentationRegistry.getArguments()
        val model = args.getString("model") ?: "tinysd"
        val ep = args.getString("ep") ?: "cpu"
        // `lcmds7x`/`tinysdx`: mesmos pesos em dados externos (`<arquivo>.data` ao lado), §27.7
        val lcm = model.startsWith("lcmds7")
        val dir = File(context.filesDir, "probe")
        val file = File(dir, "${model}_unet.onnx")
        assumeTrue("adb push do modelo para $file antes", file.exists())
        Log.i(TAG, "sdUnet $model/$ep: EPs ${OrtEnvironment.getAvailableProviders()}; antes ${memory()}")
        val env = OrtEnvironment.getEnvironment()
        val opts = sdOptions(ep, args.getString("verbose") == "true").apply {
            val dims = if (lcm) {
                mapOf("batch_size" to 1L, "num_channels" to 4L, "height" to 64L, "width" to 64L, "sequence_length" to 77L, "steps" to 1L)
            } else {
                mapOf("batch" to 1L, "height" to 64L, "width" to 64L)
            }
            dims.forEach { (k, v) -> setSymbolicDimensionValue(k, v) }
        }
        val t0 = SystemClock.elapsedRealtime()
        env.createSession(file.absolutePath, opts).use { s ->
            Log.i(TAG, "sdUnet $model/$ep: sessão em ${SystemClock.elapsedRealtime() - t0} ms; ${memory()}")
            val feeds = buildMap {
                put("sample", OnnxTensor.createTensor(env, FloatBuffer.wrap(readF32(File(dir, "latent.bin"))), longArrayOf(1, 4, 64, 64)))
                put("encoder_hidden_states", OnnxTensor.createTensor(env, FloatBuffer.wrap(readF32(File(dir, "ehs.bin"))), longArrayOf(1, 77, 768)))
                if (lcm) {
                    put("timestep", OnnxTensor.createTensor(env, LongBuffer.wrap(longArrayOf(999)), longArrayOf(1)))
                    put("timestep_cond", OnnxTensor.createTensor(env, FloatBuffer.wrap(readF32(File(dir, "tcond.bin"))), longArrayOf(1, 256)))
                } else {
                    put("timestep", OnnxTensor.createTensor(env, FloatBuffer.wrap(floatArrayOf(999f)), longArrayOf(1)))
                }
            }
            val ms = mutableListOf<Long>()
            var out = FloatArray(0)
            repeat(5) { k ->
                val t1 = SystemClock.elapsedRealtime()
                out = s.run(feeds).use { outFloats(it) }
                ms += SystemClock.elapsedRealtime() - t1
                Log.i(TAG, "sdUnet $model/$ep rodada $k: ${ms.last()} ms; ${memory()}")
            }
            feeds.values.forEach { it.close() }
            writeF32(File(dir, "out_${model}_$ep.bin"), out)
            val ref = File(dir, if (lcm) "out_lcmds7_fp16.bin" else "out_tinysd.bin")
            val err = if (ref.exists()) absError(out, readF32(ref)) else "sem referência"
            Log.i(TAG, "sdUnet $model/$ep: aquecimento ${ms[0]} ms; mediana ${median(ms.drop(1))} ms (${ms.drop(1).joinToString()}); " +
                "erro × PC: $err; ${memory()}")
        }
    }

    /**
     * Text encoder e VAE decoder fp16 do LCM-DS7 (§27.5 task 3) em `-e ep`: os ids de `ids.txt` (2ª linha) → `ehs`,
     * comparado com `ehs.bin` (fp32 do PC); `latent.bin`/0,18215 → imagem, comparada com `vae_ref.bin` (fp16 do PC).
     * 1 aquecimento + 2 medidas de cada; as duas sessões abertas juntas, como no provedor.
     */
    @Test
    fun sdDecode() = runBlocking<Unit> {
        val ep = InstrumentationRegistry.getArguments().getString("ep") ?: "cpu"
        val dir = File(context.filesDir, "probe")
        val te = File(dir, "lcmds7_text_encoder.onnx")
        val vae = File(dir, "lcmds7_vae_decoder.onnx")
        assumeTrue("adb push dos modelos para $dir antes", te.exists() && vae.exists())
        Log.i(TAG, "sdDecode $ep: antes ${memory()}")
        val env = OrtEnvironment.getEnvironment()
        val t0 = SystemClock.elapsedRealtime()
        env.createSession(te.absolutePath, sdOptions(ep, false)).use { st ->
            env.createSession(vae.absolutePath, sdOptions(ep, false)).use { sv ->
                Log.i(TAG, "sdDecode $ep: sessões em ${SystemClock.elapsedRealtime() - t0} ms; ${memory()}")
                val ids = File(dir, "ids.txt").readLines()[1].trim().split(" ").map { it.toInt() }.toIntArray()
                // `-e lat 32`: só o canto 32×32 do latente (um tile de 256², para o VAE em blocos); sem referência do PC
                val lat = InstrumentationRegistry.getArguments().getString("lat")?.toInt() ?: 64
                val full = readF32(File(dir, "latent.bin"))
                val latent = FloatArray(4 * lat * lat) { i ->
                    val c = i / (lat * lat)
                    val y = i / lat % lat
                    full[c * 4096 + y * 64 + i % lat] / 0.18215f
                }
                var ehs = FloatArray(0)
                var img = FloatArray(0)
                val teMs = mutableListOf<Long>()
                val vaeMs = mutableListOf<Long>()
                repeat(3) {
                    var t1 = SystemClock.elapsedRealtime()
                    ehs = OnnxTensor.createTensor(env, IntBuffer.wrap(ids), longArrayOf(1, 77)).use { x ->
                        st.run(mapOf("input_ids" to x)).use { outFloats(it) }
                    }
                    teMs += SystemClock.elapsedRealtime() - t1
                    t1 = SystemClock.elapsedRealtime()
                    img = OnnxTensor.createTensor(env, FloatBuffer.wrap(latent), longArrayOf(1, 4, lat.toLong(), lat.toLong())).use { x ->
                        sv.run(mapOf("latent_sample" to x)).use { outFloats(it) }
                    }
                    vaeMs += SystemClock.elapsedRealtime() - t1
                    Log.i(TAG, "sdDecode $ep rodada $it: text encoder ${teMs.last()} ms, VAE ${vaeMs.last()} ms; ${memory()}")
                }
                val vaeRef = File(dir, if (lat == 64) "vae_ref.bin" else "sem_ref")
                Log.i(TAG, "sdDecode $ep: text encoder ${teMs.joinToString()} ms, erro × PC fp32: ${absError(ehs, readF32(File(dir, "ehs.bin")))}; " +
                    "VAE ${vaeMs.joinToString()} ms, erro × PC: ${if (vaeRef.exists()) absError(img, readF32(vaeRef)) else "sem referência"}; ${memory()}")
            }
        }
    }

    private companion object {
        const val TAG = "DeviceProbe"
        // quantização da saída do w8a8 (metadata.json do pacote da Qualcomm, §20.2)
        const val OUT_SCALE = 0.004972266033291817f
        const val OUT_ZP = 25
        const val ISNET_SIZE = 1024
    }
}

/** Miolo quadrado do shoe.jpg (assets do androidTest) reduzido para 512²: uma imagem "pequena" real. */
internal fun shoe512(): Bitmap {
    val photo = InstrumentationRegistry.getInstrumentation().context.assets.open("shoe.jpg").use { BitmapFactory.decodeStream(it) }
    val side = minOf(photo.width, photo.height)
    val square = Bitmap.createBitmap(photo, (photo.width - side) / 2, (photo.height - side) / 2, side, side)
    return Bitmap.createScaledBitmap(square, 512, 512, true)
}

private fun decodeArgb(f: File): Bitmap = BitmapFactory.decodeFile(f.absolutePath)
    .let { if (it.config == Bitmap.Config.ARGB_8888) it else it.copy(Bitmap.Config.ARGB_8888, false) }

/** Máscara em PNG cinza (R=G=B=alfa). */
private fun saveMask(m: Mask, f: File) {
    val px = IntArray(m.width * m.height) { val a = m.alpha[it].toInt() and 0xFF; Color.rgb(a, a, a) }
    f.outputStream().use { Bitmap.createBitmap(px, m.width, m.height, Bitmap.Config.ARGB_8888).compress(Bitmap.CompressFormat.PNG, 100, it) }
}

/** Normalização do ISNet no rembg: divide pelo máximo, mean 0,5, std 1, CHW (§24.2). */
private fun isnetChw(img: Raster): FloatArray {
    val n = img.width * img.height
    var max = 0
    for (c in img.argb) max = maxOf(max, (c shr 16) and 0xFF, (c shr 8) and 0xFF, c and 0xFF)
    val div = maxOf(max.toFloat(), 1e-6f)
    val out = FloatArray(3 * n)
    for (i in 0 until n) {
        val c = img.argb[i]
        out[i] = ((c shr 16) and 0xFF) / div - 0.5f
        out[n + i] = ((c shr 8) and 0xFF) / div - 0.5f
        out[2 * n + i] = (c and 0xFF) / div - 0.5f
    }
    return out
}

private fun minMax(p: FloatArray): FloatArray {
    var mi = Float.MAX_VALUE
    var ma = -Float.MAX_VALUE
    for (v in p) { if (v < mi) mi = v; if (v > ma) ma = v }
    val range = ma - mi
    return FloatArray(p.size) { if (range > 1e-6f) (p[it] - mi) / range else 0f }
}

/** Fotos do `remover`: `-e photos a,b` (padrão shoe,mug,jar), cada uma `files/probe/<nome>.jpg`. */
private fun photoNames(): List<String> =
    (InstrumentationRegistry.getArguments().getString("photos") ?: "shoe,mug,jar").split(",")

/**
 * VmHWM (pico), VmRSS e VmSwap do processo e MemAvailable do sistema: o que o WebGPU/Vulkan aloca no Mali pode não
 * aparecer em VmRSS, mas o LMK olha a memória do sistema (§27.6 ajuste 1).
 */
internal fun memory(): String = (File("/proc/self/status").readLines()
    .filter { it.startsWith("VmHWM") || it.startsWith("VmRSS") || it.startsWith("Rss") || it.startsWith("VmSwap") } +
    File("/proc/meminfo").readLines().filter { it.startsWith("MemAvailable") })
    .joinToString(", ") { it.replace(Regex("\\s+"), " ") }

/**
 * Opções de sessão da sonda do SD por EP (§27.7): `nnapi` com USE_FP16, `nnapi32` sem flags; `verbose` loga a alocação
 * dos nós; `-e webgpu chave=valor,…` vai para o `addWebGPU` (ex. `storageBufferCacheMode=Disabled`).
 */
private fun sdOptions(ep: String, verbose: Boolean) = OrtSession.SessionOptions().apply {
    // `-e opt all|extended|basic|none` (padrão all): o otimizador pode recriar initializers (transposição, casts dobrados)
    setOptimizationLevel(
        when (InstrumentationRegistry.getArguments().getString("opt")) {
            "none" -> OrtSession.SessionOptions.OptLevel.NO_OPT
            "basic" -> OrtSession.SessionOptions.OptLevel.BASIC_OPT
            "extended" -> OrtSession.SessionOptions.OptLevel.EXTENDED_OPT
            else -> OrtSession.SessionOptions.OptLevel.ALL_OPT
        },
    )
    if (verbose) setSessionLogLevel(OrtLoggingLevel.ORT_LOGGING_LEVEL_VERBOSE)
    when (ep) {
        "xnnpack" -> {
            setIntraOpNumThreads(1)
            addConfigEntry("session.intra_op.allow_spinning", "0")
            addXnnpack(mapOf("intra_op_num_threads" to "4"))
        }
        "webgpu" -> {
            setIntraOpNumThreads(4)
            val kv = InstrumentationRegistry.getArguments().getString("webgpu").orEmpty()
            addWebGPU(kv.split(",").filter { "=" in it }.associate { it.substringBefore("=") to it.substringAfter("=") })
        }
        "nnapi" -> { setIntraOpNumThreads(4); addNnapi(EnumSet.of(NNAPIFlags.USE_FP16)) }
        "nnapi32" -> { setIntraOpNumThreads(4); addNnapi() }
        else -> setIntraOpNumThreads(4)
    }
}

private fun readF32(f: File): FloatArray {
    val bb = ByteBuffer.wrap(f.readBytes()).order(ByteOrder.LITTLE_ENDIAN).asFloatBuffer()
    return FloatArray(bb.remaining()).also { bb.get(it) }
}

private fun writeF32(f: File, v: FloatArray) {
    val bb = ByteBuffer.allocate(4 * v.size).order(ByteOrder.LITTLE_ENDIAN)
    bb.asFloatBuffer().put(v)
    f.writeBytes(bb.array())
}

private fun outFloats(r: OrtSession.Result, i: Int = 0): FloatArray {
    val fb = (r.get(i) as OnnxTensor).floatBuffer
    return FloatArray(fb.remaining()).also { fb.get(it) }
}

/** Erro absoluto máximo e médio contra a referência do PC, e se há NaN. */
private fun absError(a: FloatArray, ref: FloatArray): String {
    if (a.size != ref.size) return "tamanhos diferentes ${a.size} × ${ref.size}"
    var max = 0.0
    var sum = 0.0
    for (i in a.indices) { val d = kotlin.math.abs(a[i].toDouble() - ref[i]); if (d > max) max = d; sum += d }
    return "máx ${"%.4g".format(max)}, média ${"%.4g".format(sum / a.size)}, NaN ${a.any { it.isNaN() }}"
}

/** Mediana de uma lista de tempos (média dos dois do meio quando par). */
private fun median(ms: List<Long>): Long = ms.sorted().let { if (it.size % 2 == 1) it[it.size / 2] else (it[it.size / 2 - 1] + it[it.size / 2]) / 2 }
