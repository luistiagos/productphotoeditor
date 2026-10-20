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
    val audioUrl: String? = null,
) {
    val actualCommand: String get() = command.ifEmpty { ffmpegCommand }
}

/**
 * Renderizador de vídeos nativo que executa os comandos do FFmpegKit
 * a partir das camadas e animações enviadas pelo editor web.
 */
class VideoRenderer(private val context: Context) {
    companion object {
        private const val TAG = "VideoRenderer"
        private val json = Json { ignoreUnknownKeys = true; explicitNulls = false }
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

        val workDir = File(
            context.cacheDir,
            "video_render_${System.currentTimeMillis()}_${UUID.randomUUID().toString().take(6)}"
        ).apply { mkdirs() }

        try {
            progress?.invoke(0.05, "Preparando camadas...")

            // 1. Grava os frames/camadas PNG no disco temporário
            for ((filename, dataUrl) in bundle.files) {
                val file = File(workDir, filename)
                val bytes = EditorAssets.dataUrlBytes(dataUrl)
                file.writeBytes(bytes)
            }

            // 2. Grava o áudio se fornecido em dataUrl
            var audioFile: File? = null
            if (!bundle.audioUrl.isNullOrEmpty() && bundle.audioUrl.startsWith("data:")) {
                val audioBytes = EditorAssets.dataUrlBytes(bundle.audioUrl)
                audioFile = File(workDir, "audio.mp3").apply { writeBytes(audioBytes) }
            }

            val outputFile = File(workDir, "output.mp4")
            if (outputFile.exists()) {
                outputFile.delete()
            }

            // 3. Monta o comando do FFmpeg substituindo os nomes relativos pelos caminhos absolutos
            var cmd = bundle.actualCommand.trim()
            if (cmd.startsWith("ffmpeg ")) {
                cmd = cmd.removePrefix("ffmpeg").trim()
            }

            // Substitui entradas de imagens
            for (filename in bundle.files.keys) {
                val abs = File(workDir, filename).absolutePath
                cmd = cmd.replace("-i $filename", "-i \"$abs\"")
                cmd = cmd.replace("-i \"$filename\"", "-i \"$abs\"")
                cmd = cmd.replace("-i '$filename'", "-i \"$abs\"")
            }

            // Substitui áudio se houver
            if (audioFile != null) {
                val audioAbs = audioFile.absolutePath
                cmd = cmd.replace("-i audio.mp3", "-i \"$audioAbs\"")
                cmd = cmd.replace("-i \"audio.mp3\"", "-i \"$audioAbs\"")
                cmd = cmd.replace("-i 'audio.mp3'", "-i \"$audioAbs\"")
                cmd = cmd.replace("-i \"assets/audio.mp3\"", "-i \"$audioAbs\"")
            }

            // Substitui o output
            cmd = cmd.replace("\"output.mp4\"", "\"${outputFile.absolutePath}\"")
            cmd = cmd.replace("'output.mp4'", "\"${outputFile.absolutePath}\"")
            if (!cmd.contains(outputFile.absolutePath)) {
                cmd = cmd.replace("output.mp4", "\"${outputFile.absolutePath}\"")
            }

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
