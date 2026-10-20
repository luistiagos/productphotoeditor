package com.productphoto.data

import java.io.File

/** Grava por arquivo temporário + rename, para nunca deixar um JSON pela metade. */
internal fun File.writeAtomically(bytes: ByteArray) {
    parentFile?.mkdirs()
    val tmp = File(parentFile, "$name.tmp")
    tmp.writeBytes(bytes)
    if (!tmp.renameTo(this)) {
        delete()
        check(tmp.renameTo(this)) { "rename failed: $this" }
    }
}

/** Ids que chegam do editor web viram nome de arquivo: só [a-z0-9-], sem caminho. */
private val ID_RE = Regex("^[a-z0-9][a-z0-9-]{0,63}$")

fun isValidId(id: String): Boolean = ID_RE.matches(id)

internal fun requireValidId(id: String): String {
    require(isValidId(id)) { "invalid id" }
    return id
}
