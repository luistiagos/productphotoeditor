package com.productphoto.editor

import android.content.Context
import android.util.Log
import com.arthenica.ffmpegkit.FFmpegKit
import com.arthenica.ffmpegkit.ReturnCode
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import java.io.File
import java.util.UUID

@Serializable
data class VideoBundle(
    val name: String = "video",
    val width: Int = 1080,
    val height: Int = 1080,
    val duration: Double = 5.0,
    val fps: Int = 30,
    val command: String = "",
    val ffmpegCommand: String = "",
    val files: Map<String, String> = emptyMap(),
    /** URL do editor (`/blob/…`, `/assets/…`) ou dataURL. */
    val audioUrl: String? = null,
    /** Nome do áudio no comando (ex.: `audio.m4a`). */
    val audioFile: String = "audio.mp3",
    /** `output.mp4` ou `output.gif`. */
    val output: String = "output.mp4",
) {
    val actualCommand: String get() = command.ifEmpty { ffmpegCommand }
}

/**
 * Renderizador de vídeos nativo que executa os comandos do FFmpegKit a partir das camadas e animações enviadas pelo
 * editor web (MP4 ou GIF). Os nomes relativos do comando (camadas, áudio, saída) viram caminhos no cacheDir.
 */
class VideoRenderer(private val context: Context, private val assets: EditorAssets? = null) {
    companion object {
        private const val TAG = "VideoRenderer"
        private val json = Json { ignoreUnknownKeys = true; explicitNulls = false }
        private val SAFE_NAME = Regex("^[A-Za-z0-9_-]{1,64}\\.[a-z0-9]{2,5}$")

        /** Troca `-i nome` (com ou sem aspas) e o `"saida"` final pelos caminhos absolutos. */
        fun resolveCommand(command: String, inputs: Map<String, String>, output: Pair<String, String>): String {
            var cmd = command.trim().removePrefix("ffmpeg").trim()
            // No Android com FFmpegKit full, o encoder libx264 (GPL) é substituído por h264_mediacodec (hardware nativo)
            cmd = cmd.replace("-c:v libx264", "-c:v h264_mediacodec")
            for ((name, abs) in inputs) {
                cmd = cmd.replace("-i \"$name\"", "-i \"$abs\"")
                cmd = cmd.replace("-i '$name'", "-i \"$abs\"")
                cmd = cmd.replace(Regex("-i ${Regex.escape(name)}(?=\\s|$)"), Regex.escapeReplacement("-i \"$abs\""))
            }
            val (outName, outAbs) = output
            cmd = cmd.replace("\"$outName\"", "\"$outAbs\"").replace("'$outName'", "\"$outAbs\"")
            if (!cmd.contains(outAbs)) cmd = cmd.replace(Regex("(?<=\\s)${Regex.escape(outName)}$"), Regex.escapeReplacement("\"$outAbs\""))
            return cmd
        }
    }

    suspend fun render(
        rawBundleJson: String,
        progress: ProgressFn? = null
    ): File = withContext(Dispatchers.IO) {
        val bundle = try {
            json.decodeFromString<VideoBundle>(rawBundleJson)
        } catch (e: Exception) {
            Log.e(TAG, "Erro ao deserializar VideoBundle: ${e.message}", e)
            throw BridgeException(ErrorCode.INVALID, "JSON do pacote de vídeo inválido: ${e.message}")
        }
        for (n in bundle.files.keys + bundle.audioFile + bundle.output) {
            if (!SAFE_NAME.matches(n)) throw BridgeException(ErrorCode.INVALID, "nome de arquivo inválido: $n")
        }

        val workDir = File(
            context.cacheDir,
            "video_render_${System.currentTimeMillis()}_${UUID.randomUUID().toString().take(6)}"
        ).apply { mkdirs() }

        try {
            progress?.invoke(0.05, "Preparando camadas...")

            // 1. Grava as camadas PNG no disco temporário
            val inputs = LinkedHashMap<String, String>()
            for ((filename, dataUrl) in bundle.files) {
                val file = File(workDir, filename)
                file.writeBytes(EditorAssets.dataUrlBytes(dataUrl))
                inputs[filename] = file.absolutePath
            }

            // 2. Áudio: URL do editor (blob do seletor ou trilha empacotada nos assets) ou dataURL
            val audioUrl = bundle.audioUrl
            if (!audioUrl.isNullOrEmpty()) {
                val bytes = if (audioUrl.startsWith("data:")) EditorAssets.dataUrlBytes(audioUrl)
                else assets?.read(audioUrl) ?: throw BridgeException(ErrorCode.INVALID, "áudio fora do editor: $audioUrl")
                val audioFile = File(workDir, bundle.audioFile).apply { writeBytes(bytes) }
                inputs[bundle.audioFile] = audioFile.absolutePath
            }

            val outputFile = File(workDir, bundle.output)
            if (outputFile.exists()) outputFile.delete()

            // 3. Comando com caminhos absolutos
            val cmd = resolveCommand(bundle.actualCommand, inputs, bundle.output to outputFile.absolutePath)

            Log.i(TAG, "Iniciando renderização FFmpeg ($outputFile): $cmd")
            progress?.invoke(0.15, "Codificando vídeo com FFmpeg...")
            val session = FFmpegKit.execute(cmd)
            val returnCode = session.returnCode
            Log.i(TAG, "FFmpeg finalizado com código: $returnCode")

            if (ReturnCode.isSuccess(returnCode)) {
                if (!outputFile.exists() || outputFile.length() == 0L) {
                    throw BridgeException(ErrorCode.INTERNAL, "Vídeo gerado não foi encontrado ou está vazio")
                }
                progress?.invoke(0.95, "Finalizando vídeo...")
                outputFile
            } else if (ReturnCode.isCancel(returnCode)) {
                throw BridgeException(ErrorCode.CANCELLED, "Renderização cancelada")
            } else {
                val logs = session.allLogsAsString
                val failStack = session.failStackTrace
                Log.e(TAG, "Falha na execução FFmpeg:\n$logs\n$failStack")
                throw BridgeException(ErrorCode.INTERNAL, "Erro ao processar vídeo pelo FFmpeg: código $returnCode")
            }
        } catch (e: Exception) {
            workDir.deleteRecursively()
            throw e
        }
    }
}
