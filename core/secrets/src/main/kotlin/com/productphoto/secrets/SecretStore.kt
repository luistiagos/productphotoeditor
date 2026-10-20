package com.productphoto.secrets

import java.io.ByteArrayInputStream
import java.io.ByteArrayOutputStream
import java.io.DataInputStream
import java.io.DataOutputStream
import java.io.File

/** Chaves do usuário (API keys etc.). A config de provedores só guarda o nome. */
interface SecretStore {
    fun get(name: String): String?
    fun put(name: String, value: String)
    fun remove(name: String)
    fun names(): Set<String>
}

/** Cifra autenticada. Produção: [KeystoreAead]; testes: uma AEAD de software. */
interface Aead {
    fun encrypt(plain: ByteArray): ByteArray
    fun decrypt(sealed: ByteArray): ByteArray
}

/**
 * Todos os segredos num único arquivo cifrado: Aead(mapa serializado).
 * Formato do texto claro: versão(int) n(int) e n pares (utf name, utf value).
 */
class FileSecretStore(private val file: File, private val aead: Aead) : SecretStore {
    private val lock = Any()

    override fun get(name: String): String? = synchronized(lock) { read()[name] }

    override fun put(name: String, value: String) = synchronized(lock) { write(read() + (name to value)) }

    override fun remove(name: String) = synchronized(lock) { write(read() - name) }

    override fun names(): Set<String> = synchronized(lock) { read().keys }

    private fun read(): Map<String, String> {
        if (!file.exists()) return emptyMap()
        val input = DataInputStream(ByteArrayInputStream(aead.decrypt(file.readBytes())))
        check(input.readInt() == VERSION) { "unknown secrets file version" }
        return buildMap { repeat(input.readInt()) { put(input.readUTF(), input.readUTF()) } }
    }

    private fun write(map: Map<String, String>) {
        val bytes = ByteArrayOutputStream()
        DataOutputStream(bytes).use { out ->
            out.writeInt(VERSION)
            out.writeInt(map.size)
            map.forEach { (k, v) -> out.writeUTF(k); out.writeUTF(v) }
        }
        val tmp = File(file.parentFile, file.name + ".tmp")
        tmp.writeBytes(aead.encrypt(bytes.toByteArray()))
        if (!tmp.renameTo(file)) {
            file.delete()
            check(tmp.renameTo(file)) { "could not replace ${file.name}" }
        }
    }

    private companion object {
        const val VERSION = 1
    }
}
