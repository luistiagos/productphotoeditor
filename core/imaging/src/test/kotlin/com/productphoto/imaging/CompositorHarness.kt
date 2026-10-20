package com.productphoto.imaging

import org.junit.Assume.assumeTrue
import org.junit.Test
import java.io.DataInputStream
import java.io.DataOutputStream
import java.io.File

/**
 * Ferramenta de ajuste visual, não é teste de regressão: roda o SceneCompositor real no desktop.
 * Só executa com -PharnessDir=<pasta>, que deve conter jobs.txt com uma linha por caso:
 *   saida.raw;produto.raw;cenario.raw;floorY;lightDir;elev;soft;tempK;alturaRel
 * (.raw = int largura, int altura, ARGB big-endian; produto com a máscara no alfa; alturaRel = altura
 * do produto como fração do cenário). tools/harness.py converte PNG ↔ raw e monta os casos.
 */
class CompositorHarness {
    @Test
    fun run() {
        val dir = System.getProperty("harness.dir")
        assumeTrue(dir != null)
        File(dir, "jobs.txt").readLines().filter { it.isNotBlank() && !it.startsWith("#") }.forEach { line ->
            val p = line.split(';')
            val pr = read(File(dir, p[1]))
            val mask = FloatArray(pr.argb.size) { (pr.argb[it] ushr 24) / 255f }
            val sr = read(File(dir, p[2]))
            val crop = Roi.of(mask, pr.width, pr.height, 0.02f)
            val scale = p[8].toFloat() * sr.height / crop.height
            val cy = p[3].toFloat() * sr.height - crop.height * scale / 2f
            val t0 = System.nanoTime()
            val out = SceneCompositor.compose(
                pr, mask, sr,
                LightParams(p[4].toFloat(), p[5].toFloat(), p[6].toFloat(), p[7].toInt()),
                PlacementPx(sr.width / 2f, cy, scale, 0f),
                CompositeParams(.6f, .4f, .5f, .3f),
            )
            println("${p[0]}: ${(System.nanoTime() - t0) / 1_000_000} ms")
            DataOutputStream(File(dir, p[0]).outputStream().buffered()).use { o ->
                o.writeInt(out.width); o.writeInt(out.height); out.argb.forEach(o::writeInt)
            }
        }
    }

    private fun read(f: File): Raster = DataInputStream(f.inputStream().buffered()).use { i ->
        val w = i.readInt(); val h = i.readInt()
        Raster(w, h, IntArray(w * h) { i.readInt() })
    }
}
