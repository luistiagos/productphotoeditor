package com.productphoto.app

import android.graphics.Bitmap
import androidx.compose.runtime.mutableStateListOf
import com.productphoto.editor.EditorStart

sealed interface Screen {
    data object Home : Screen
    data object Product : Screen
    data object Drafts : Screen
    data object BrandKit : Screen
    data object Models : Screen
    data object TextAi : Screen
    data object ImageGen : Screen
    /** [initial]: design vindo do editor ("Ver em mockup"), vai no espaço 1. */
    data class Mockup(val initial: Bitmap? = null, val key: Long = System.nanoTime()) : Screen
    /** `key` distingue duas aberturas seguidas do editor (cada uma é uma sessão nova). */
    data class Editor(val start: EditorStart, val key: Long = System.nanoTime()) : Screen
}

/** Pilha de telas do app (no Application: sobrevive à recriação da Activity). */
class Navigator {
    val stack = mutableStateListOf<Screen>(Screen.Home)
    val current: Screen get() = stack.last()

    fun push(s: Screen) { stack.add(s) }

    fun pop(): Boolean {
        if (stack.size <= 1) return false
        stack.removeAt(stack.lastIndex)
        return true
    }

    /** Troca a tela atual (ex.: editor de rascunho recém-criado volta para a lista). */
    fun replace(s: Screen) {
        stack[stack.lastIndex] = s
    }
}
