package com.productphoto.imaging

import android.graphics.BitmapFactory
import java.io.ByteArrayOutputStream
import java.io.IOException
import java.io.InputStream
import java.net.HttpURLConnection
import java.net.URL

/**
 * Download do catálogo remoto (mockups e estilos), com as travas do SEC-11: só https, host na allowlist
 * conferido a cada redirect (seguido à mão), teto de bytes e de pixels. Em erro, lança [IOException].
 */
object RemoteFetch {
    /** Host igual ou subdomínio. O HF redireciona os binários para `us.aws.cdn.hf.co` (conferido em 2026-10-30). */
    val ALLOWED_HOSTS = listOf("huggingface.co", "hf.co", "fa.videorey.in")
    const val MAX_JSON_BYTES = 2 * 1024 * 1024
    const val MAX_IMAGE_BYTES = 15 * 1024 * 1024
    const val MAX_IMAGE_PIXELS = 16_000_000L
    private const val MAX_REDIRECTS = 5

    /** Motivo da recusa, ou null se a URL pode ser baixada. */
    fun rejectReason(url: String): String? {
        val u = runCatching { URL(url) }.getOrNull() ?: return "URL inválida"
        if (!u.protocol.equals("https", ignoreCase = true)) return "só https"
        if (u.userInfo != null) return "URL com usuário"
        val host = u.host.lowercase().trimEnd('.')
        if (ALLOWED_HOSTS.none { host == it || host.endsWith(".$it") }) return "host fora da allowlist: $host"
        return null
    }

    /** Destino de um redirect: `Location` relativo é resolvido contra a URL atual (o HF manda `/api/resolve-cache/...`). */
    fun resolveRedirect(current: String, location: String): String = URL(URL(current), location).toString()

    /** Lê até [maxBytes] e aborta a leitura no primeiro byte além disso. */
    fun readLimited(input: InputStream, maxBytes: Int): ByteArray {
        val out = ByteArrayOutputStream()
        val buf = ByteArray(16 * 1024)
        while (true) {
            val n = input.read(buf)
            if (n < 0) return out.toByteArray()
            if (out.size() + n > maxBytes) throw IOException("resposta acima de $maxBytes bytes")
            out.write(buf, 0, n)
        }
    }

    fun checkPixels(width: Int, height: Int) {
        val px = width.coerceAtLeast(0).toLong() * height.coerceAtLeast(0)
        if (px > MAX_IMAGE_PIXELS) throw IOException("imagem ${width}x$height acima de $MAX_IMAGE_PIXELS px")
    }

    fun download(url: String, maxBytes: Int): ByteArray {
        var current = url
        repeat(MAX_REDIRECTS + 1) {
            rejectReason(current)?.let { throw IOException("$it ($current)") }
            val conn = URL(current).openConnection() as HttpURLConnection
            conn.connectTimeout = 12000
            conn.readTimeout = 15000
            conn.instanceFollowRedirects = false
            try {
                val code = conn.responseCode
                if (code in 300..399) {
                    val location = conn.getHeaderField("Location") ?: throw IOException("HTTP $code sem Location ($current)")
                    current = resolveRedirect(current, location)
                    return@repeat
                }
                if (code !in 200..299) throw IOException("HTTP $code ($current)")
                if (conn.contentLengthLong > maxBytes) throw IOException("resposta de ${conn.contentLengthLong} bytes acima de $maxBytes")
                return conn.inputStream.use { readLimited(it, maxBytes) }
            } finally {
                conn.disconnect()
            }
        }
        throw IOException("redirects demais ($url)")
    }

    fun downloadString(url: String): String = download(url, MAX_JSON_BYTES).decodeToString()

    /** Imagem com teto de bytes e de pixels (lê só o cabeçalho antes de alguém decodificar o bitmap inteiro). */
    fun downloadImage(url: String): ByteArray {
        val bytes = download(url, MAX_IMAGE_BYTES)
        val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
        BitmapFactory.decodeByteArray(bytes, 0, bytes.size, bounds)
        checkPixels(bounds.outWidth, bounds.outHeight)
        return bytes
    }
}
