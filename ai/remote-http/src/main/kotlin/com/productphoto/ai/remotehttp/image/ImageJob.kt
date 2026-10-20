package com.productphoto.ai.remotehttp.image

import com.productphoto.ai.api.Control
import com.productphoto.ai.api.ProgressSink

/**
 * Pedido "de fio" (§19.5): imagens já em PNG, tamanho já múltiplo de 8 e igual ao das imagens.
 * mask: PNG opaco em tons de cinza, branco = área a gerar. Nulos = padrão do backend.
 */
class ImageJob(
    val prompt: String,
    val negative: String?,
    val width: Int,
    val height: Int,
    val steps: Int?,
    val seed: Long?,
    val cfg: Float?,
    val count: Int,
    val init: ByteArray? = null,
    val strength: Float? = null,
    val mask: ByteArray? = null,
    val maskInvert: Boolean = false,
    val control: ControlJob? = null,
)

class ControlJob(val kind: Control.Kind, val png: ByteArray, val weight: Float)

interface ImageBackend {
    /** Se false, quem chama inverte a máscara antes ([ImageJob.maskInvert] chega sempre false). */
    val invertsMask: Boolean

    /** Bytes de cada imagem gerada (PNG, JPEG ou WEBP, conforme o servidor), no máximo job.count. */
    suspend fun run(job: ImageJob, progress: ProgressSink?): List<ByteArray>
}
