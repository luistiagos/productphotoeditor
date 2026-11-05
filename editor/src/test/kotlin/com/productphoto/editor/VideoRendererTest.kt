package com.productphoto.editor

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class VideoRendererTest {
    private val cmd = "ffmpeg -y -f lavfi -i color=c=black:s=1080x1080:d=5:r=30 -i bg.png -loop 1 -framerate 30 -t 5 -i layer_1.png " +
        "-i layer_10.png -stream_loop -1 -ss 0.00 -t 5 -i \"audio.wav\" -filter_complex \"[1:v] format=rgba [p1]\" " +
        "-c:v libx264 -pix_fmt yuv420p -r 30 -t 5 \"output.mp4\""

    @Test fun `troca entradas, audio e saida por caminhos absolutos`() {
        val out = VideoRenderer.resolveCommand(
            cmd,
            mapOf("bg.png" to "/w/bg.png", "layer_1.png" to "/w/layer_1.png", "layer_10.png" to "/w/layer_10.png", "audio.wav" to "/w/audio.wav"),
            "output.mp4" to "/w/output.mp4",
        )
        assertFalse(out.startsWith("ffmpeg"))
        assertTrue(out.contains("-i \"/w/bg.png\""))
        // layer_1 não pode casar dentro de layer_10
        assertTrue(out.contains("-i \"/w/layer_1.png\" -i \"/w/layer_10.png\""))
        assertTrue(out.contains("-i \"/w/audio.wav\""))
        assertTrue(out.endsWith("\"/w/output.mp4\""))
        assertTrue(out.contains("-c:v h264_mediacodec"))
    }

    @Test fun `gif sem encoder de video`() {
        val out = VideoRenderer.resolveCommand("ffmpeg -y -i bg.png -map \"[gif]\" -loop 0 -t 5 \"output.gif\"",
            mapOf("bg.png" to "/w/bg.png"), "output.gif" to "/w/output.gif")
        assertEquals("-y -i \"/w/bg.png\" -map \"[gif]\" -loop 0 -t 5 \"/w/output.gif\"", out)
    }

    @Test fun `extensao do audio pelo nome ou pelo mime`() {
        assertEquals("m4a", EditorSession.audioExtension("Musica.M4A", "audio/mp4"))
        assertEquals("mp3", EditorSession.audioExtension("sem_extensao", "audio/mpeg"))
        assertEquals("ogg", EditorSession.audioExtension(null, "audio/ogg"))
        assertEquals("wav", EditorSession.audioExtension("x.wav", null))
        assertEquals("mp3", EditorSession.audioExtension("x.exe", null))
    }
}
