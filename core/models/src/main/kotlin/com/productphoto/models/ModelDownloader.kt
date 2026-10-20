package com.productphoto.models

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ensureActive
import kotlinx.coroutines.withContext
import kotlin.coroutines.coroutineContext
import java.io.File
import java.io.FileOutputStream
import java.io.IOException
import java.net.HttpURLConnection
import java.net.URL
import java.security.MessageDigest

/** Falhas que não melhoram com nova tentativa. Qualquer outro `IOException` é transitório (rede). */
sealed class DownloadFailure(msg: String) : Exception(msg) {
    class NoSpace(val needed: Long, val free: Long) :
        DownloadFailure("sem espaço: faltam ${(needed - free) / MB} MB")
    class Corrupt(val actual: String) : DownloadFailure("arquivo baixado não confere (sha256 $actual)")
    class Http(val code: Int) : DownloadFailure("o servidor respondeu HTTP $code")
}

/**
 * Baixa um modelo do catálogo para `dir` (ARQUITETURA §16.3, §17.2): retoma o `.part` por `Range`,
 * confere o SHA-256 em streaming e só então move para o nome final e grava o marcador. Hash errado →
 * apaga e baixa do zero uma vez; na 2ª vez, [DownloadFailure.Corrupt]. Redirects são seguidos à mão para
 * reenviar o `Range` a cada salto. Cancelar a coroutine mantém o `.part` para a próxima retomada.
 */
class ModelDownloader(
    private val freeBytes: (File) -> Long = { it.usableSpace },
    private val log: (String) -> Unit = {},
    private val connectTimeoutMs: Int = 15_000,
    private val readTimeoutMs: Int = 30_000,
) {
    suspend fun download(
        entry: ModelEntry,
        dir: File,
        onProgress: suspend (done: Long, total: Long) -> Unit = { _, _ -> },
    ): File = withContext(Dispatchers.IO) {
        require(entry.urls.isNotEmpty()) { "${entry.id}: catálogo sem URL" }
        dir.mkdirs()
        val target = entry.targetIn(dir)
        if (entry.markerIn(dir).exists() && target.length() == entry.sizeBytes) return@withContext target
        val part = File(dir, entry.file + ".part")
        dir.listFiles()?.forEach { if (it != part) it.delete() }

        var actual = fetch(entry, part, onProgress)
        if (!actual.equals(entry.sha256, ignoreCase = true)) {
            log("${entry.id}: sha256 $actual não confere; baixando do zero")
            part.delete()
            actual = fetch(entry, part, onProgress)
            if (!actual.equals(entry.sha256, ignoreCase = true)) {
                part.delete()
                throw DownloadFailure.Corrupt(actual)
            }
        }
        check(part.renameTo(target)) { "não foi possível mover ${part.name}" }
        entry.markerIn(dir).createNewFile()
        target
    }

    /** Completa o `.part` (retomando do tamanho dele) e devolve o SHA-256 do arquivo inteiro. */
    private suspend fun fetch(entry: ModelEntry, part: File, onProgress: suspend (Long, Long) -> Unit): String {
        var have = if (part.length() > entry.sizeBytes) { part.delete(); 0L } else part.length()
        val needed = ((entry.sizeBytes - have) * SPACE_FACTOR).toLong()
        val free = freeBytes(part.parentFile!!)
        if (free < needed) throw DownloadFailure.NoSpace(needed, free)

        val digest = MessageDigest.getInstance("SHA-256")
        if (have == entry.sizeBytes) return digest.apply { feed(part) }.digest().toHex()
        val conn = open(entry.urls, have)
        try {
            when (val code = conn.responseCode) {
                HttpURLConnection.HTTP_PARTIAL -> {
                    val start = conn.getHeaderField("Content-Range")?.let { RANGE_START.find(it)?.groupValues?.get(1)?.toLongOrNull() }
                    if (start != have) throw IOException("Content-Range inesperado: ${conn.getHeaderField("Content-Range")}")
                }
                HttpURLConnection.HTTP_OK -> if (have > 0) {
                    log("${entry.id}: servidor ignorou o Range; recomeçando do zero")
                    have = 0
                }
                in 400..499 -> throw DownloadFailure.Http(code)
                else -> throw IOException("HTTP $code")
            }
            if (have > 0) digest.feed(part) else part.delete()
            val step = maxOf(entry.sizeBytes / 100, 1)
            var done = have
            var nextReport = done + step
            onProgress(done, entry.sizeBytes)
            conn.inputStream.use { input ->
                FileOutputStream(part, have > 0).use { out ->
                    val buf = ByteArray(BUF)
                    while (true) {
                        coroutineContext.ensureActive()
                        val n = input.read(buf)
                        if (n < 0) break
                        out.write(buf, 0, n)
                        digest.update(buf, 0, n)
                        done += n
                        if (done >= nextReport) {
                            onProgress(done, entry.sizeBytes)
                            nextReport = done + step
                        }
                    }
                }
            }
            if (done != entry.sizeBytes) throw IOException("download incompleto: $done de ${entry.sizeBytes} bytes")
            onProgress(done, entry.sizeBytes)
            return digest.digest().toHex()
        } finally {
            conn.disconnect()
        }
    }

    /** Abre a primeira URL que responder, seguindo redirects à mão (o `Range` vai em todos os saltos). */
    private fun open(urls: List<String>, from: Long): HttpURLConnection {
        var last: IOException? = null
        for (url in urls) {
            try {
                return openFollowing(URL(url), from)
            } catch (e: IOException) {
                last = e
            }
        }
        throw last ?: IOException("sem URL")
    }

    private fun openFollowing(start: URL, from: Long): HttpURLConnection {
        var url = start
        repeat(MAX_REDIRECTS) {
            val c = (url.openConnection() as HttpURLConnection).apply {
                instanceFollowRedirects = false
                connectTimeout = connectTimeoutMs
                readTimeout = readTimeoutMs
                setRequestProperty("Accept-Encoding", "identity")
                if (from > 0) setRequestProperty("Range", "bytes=$from-")
            }
            if (from > 0) log("GET ${url.host}${url.path} Range: bytes=$from-")
            val code = c.responseCode
            if (code in 300..399 && code != HttpURLConnection.HTTP_NOT_MODIFIED) {
                val location = c.getHeaderField("Location") ?: throw IOException("redirect $code sem Location")
                c.disconnect()
                url = URL(url, location)
                return@repeat
            }
            return c
        }
        throw IOException("redirects demais")
    }

    /** Semeia o digest com o que já está no `.part` (a retomada continua dali). */
    private fun MessageDigest.feed(file: File) = file.inputStream().use { input ->
        val buf = ByteArray(BUF)
        while (true) {
            val n = input.read(buf)
            if (n < 0) break
            update(buf, 0, n)
        }
    }

    private companion object {
        const val BUF = 64 * 1024
        const val MAX_REDIRECTS = 5
        const val SPACE_FACTOR = 1.2
        val RANGE_START = Regex("""bytes (\d+)-""")
    }
}

internal const val MB = 1024L * 1024L

/** Mesmos nomes que o [LocalModelManager] usa: `<dir>/<file>` e o marcador de conferido. */
internal fun ModelEntry.targetIn(dir: File) = File(dir, file)
internal fun ModelEntry.markerIn(dir: File) = File(dir, ".verified-$sha256")
