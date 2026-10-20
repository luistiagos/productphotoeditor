package com.productphoto.app

import android.util.Log
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import com.productphoto.ai.api.RgbaImage
import com.productphoto.ai.onnx.RealEsrganUpscaler
import com.productphoto.imaging.toRaster
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import kotlin.math.abs

/**
 * Prova de costura com o modelo real (§20.4 item 4, §20.5 task 4): o campo receptivo teórico do x4v3 (~33 px) passa da
 * sobreposição de 8 px. A sobreposição de produção (24, §20.6) precisa ficar a ≤ 3/255 (máx.) e ≤ 0,5/255 (média) da de 40.
 */
@RunWith(AndroidJUnit4::class)
class RealEsrganSeamInstrumentedTest {
    @Test
    fun productionOverlapMatchesALargerOne() = runBlocking<Unit> {
        val context = InstrumentationRegistry.getInstrumentation().targetContext
        val file = AppGraph(context).models.ensureReady(RealEsrganUpscaler.MODEL_ID)!!
        val src = RgbaImage(shoe512())
        // -e a / -e b trocam as sobreposições comparadas (medição da §20.6)
        val args = InstrumentationRegistry.getArguments()
        val oa = args.getString("a")?.toInt() ?: 24
        val ob = args.getString("b")?.toInt() ?: 40
        val a = RealEsrganUpscaler(file, overlap = oa).upscale(src, 4).bitmap.toRaster().argb
        val b = RealEsrganUpscaler(file, overlap = ob).upscale(src, 4).bitmap.toRaster().argb
        var max = 0
        var sum = 0L
        for (i in a.indices) for (shift in intArrayOf(16, 8, 0)) {
            val d = abs(((a[i] shr shift) and 0xFF) - ((b[i] shr shift) and 0xFF))
            if (d > max) max = d
            sum += d
        }
        val mean = sum.toDouble() / (3L * a.size)
        Log.i("DeviceProbe", "costura $oa×$ob: máx $max/255, média ${"%.4f".format(mean)}/255")
        assertTrue("máx $max > 3", max <= 3)
        assertTrue("média $mean > 0.5", mean <= 0.5)
    }
}
