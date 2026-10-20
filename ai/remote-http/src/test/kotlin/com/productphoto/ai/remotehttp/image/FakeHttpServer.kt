package com.productphoto.ai.remotehttp.image

import android.graphics.Bitmap
import com.productphoto.ai.api.RgbaImage
import java.io.Closeable
import java.net.InetAddress
import java.net.ServerSocket
import java.net.Socket
import java.util.Collections
import kotlin.concurrent.thread

private const val CRLF = "\r\n"

/**
 * Servidor HTTP falso para os backends de imagem. Diferente do de OpenAiCompatibleTest, atende cada
 * conexão numa thread: o A1111 consulta /progress e chama /interrupt enquanto o txt2img está pendurado.
 */
class FakeHttpServer(private val handler: (Request) -> Reply) : Closeable {
    class Request(val method: String, val path: String, val headers: Map<String, String>, val body: ByteArray) {
        val text get() = body.decodeToString()
    }

    class Reply(val status: Int, val body: ByteArray, val contentType: String = "application/json") {
        constructor(status: Int, json: String) : this(status, json.toByteArray())
    }

    private val server = ServerSocket(0, 50, InetAddress.getLoopbackAddress())
    val received: MutableList<Request> = Collections.synchronizedList(mutableListOf())
    val base get() = "http://127.0.0.1:${server.localPort}"

    init {
        thread(isDaemon = true) {
            while (!server.isClosed) {
                val socket = try { server.accept() } catch (_: Exception) { break }
                thread(isDaemon = true) { runCatching { socket.use { serve(it) } } }
            }
        }
    }

    override fun close() = server.close()

    fun paths(): List<String> = synchronized(received) { received.map { it.path } }

    /** Espera (tempo real) até a condição valer; falha depois de timeoutMs. */
    fun awaitUntil(timeoutMs: Long = 5_000, cond: () -> Boolean) {
        val end = System.currentTimeMillis() + timeoutMs
        while (!cond()) {
            check(System.currentTimeMillis() < end) { "timeout; recebidos: ${paths()}" }
            Thread.sleep(10)
        }
    }

    private fun serve(socket: Socket) {
        val input = socket.getInputStream()
        val head = StringBuilder()
        while (!head.endsWith("$CRLF$CRLF")) {
            val b = input.read()
            if (b < 0) return
            head.append(b.toChar())
        }
        val lines = head.split(CRLF).filter { it.isNotEmpty() }
        val (method, path) = lines[0].split(" ").let { it[0] to it[1] }
        val headers = lines.drop(1).associate { it.substringBefore(":").trim().lowercase() to it.substringAfter(":").trim() }
        val length = headers["content-length"]?.toInt() ?: 0
        val body = ByteArray(length).also { var n = 0; while (n < length) n += input.read(it, n, length - n) }
        val req = Request(method, path, headers, body)
        received += req
        val reply = handler(req)
        socket.getOutputStream().apply {
            write(("HTTP/1.1 ${reply.status} X${CRLF}Content-Type: ${reply.contentType}${CRLF}" +
                "Content-Length: ${reply.body.size}${CRLF}Connection: close$CRLF$CRLF").toByteArray())
            write(reply.body)
            flush()
        }
    }
}

/** RgbaImage cujo Bitmap nunca é lido (o android.jar de teste não cria Bitmap, §19.1). */
fun stubImage(): RgbaImage {
    val unsafe = Class.forName("sun.misc.Unsafe").getDeclaredField("theUnsafe").apply { isAccessible = true }.get(null)
    val bitmap = unsafe.javaClass.getMethod("allocateInstance", Class::class.java).invoke(unsafe, Bitmap::class.java) as Bitmap
    return RgbaImage(bitmap)
}

/** Porta onde ninguém escuta. */
fun deadPort(): Int = ServerSocket(0, 1, InetAddress.getLoopbackAddress()).run { val p = localPort; close(); p }
