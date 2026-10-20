package com.productphoto.secrets

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder
import java.security.SecureRandom
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.spec.GCMParameterSpec

class FileSecretStoreTest {
    @get:Rule val tmp = TemporaryFolder()

    /** Mesmo formato da KeystoreAead, com chave de software. */
    private class SoftwareAead : Aead {
        private val key = KeyGenerator.getInstance("AES").apply { init(256) }.generateKey()
        override fun encrypt(plain: ByteArray): ByteArray {
            val iv = ByteArray(12).also { SecureRandom().nextBytes(it) }
            val c = Cipher.getInstance("AES/GCM/NoPadding").apply { init(Cipher.ENCRYPT_MODE, key, GCMParameterSpec(128, iv)) }
            return byteArrayOf(iv.size.toByte()) + iv + c.doFinal(plain)
        }
        override fun decrypt(sealed: ByteArray): ByteArray {
            val n = sealed[0].toInt()
            val c = Cipher.getInstance("AES/GCM/NoPadding")
                .apply { init(Cipher.DECRYPT_MODE, key, GCMParameterSpec(128, sealed.copyOfRange(1, 1 + n))) }
            return c.doFinal(sealed, 1 + n, sealed.size - 1 - n)
        }
    }

    @Test
    fun `put get remove survive a new instance`() {
        val aead = SoftwareAead()
        val file = tmp.newFile("secrets.bin").also { it.delete() }
        FileSecretStore(file, aead).apply {
            put("ollama", "sk-123")
            put("gemini", "AIza-xyz")
            remove("gemini")
        }
        val reopened = FileSecretStore(file, aead)
        assertEquals("sk-123", reopened.get("ollama"))
        assertNull(reopened.get("gemini"))
        assertEquals(setOf("ollama"), reopened.names())
    }

    @Test
    fun `file on disk does not contain the plaintext`() {
        val file = tmp.newFile("s.bin").also { it.delete() }
        FileSecretStore(file, SoftwareAead()).put("k", "very-secret-value")
        assertFalse(String(file.readBytes(), Charsets.ISO_8859_1).contains("very-secret-value"))
    }

    @Test
    fun `empty store when file is missing`() {
        val store = FileSecretStore(tmp.root.resolve("none.bin"), SoftwareAead())
        assertEquals(emptySet<String>(), store.names())
    }
}
