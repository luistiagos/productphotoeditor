package com.productphoto.editor

import android.app.Activity
import android.content.Context
import android.content.ContextWrapper
import android.net.Uri
import android.view.ViewGroup
import android.webkit.WebView
import androidx.activity.compose.BackHandler
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.PickVisualMediaRequest
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.safeDrawingPadding
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.viewinterop.AndroidView
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import kotlinx.coroutines.withTimeoutOrNull

private class Waiter { var deferred: CompletableDeferred<Uri?>? = null }

/**
 * Tela do editor: WebView com a página dos assets + seletores do sistema. Voltar pede ao JS que
 * salve o rascunho (`flush`, até 3 s) e então chama onClose.
 */
@Composable
fun EditorScreen(session: EditorSession, onMockup: (ByteArray) -> Unit = {}, onClose: (draftId: String?) -> Unit) {
    val context = LocalContext.current
    val activity = remember(context) { context.findActivity() }
    val scope = rememberCoroutineScope()
    val imageWaiter = remember { Waiter() }
    val fontWaiter = remember { Waiter() }
    val pickImage = rememberLauncherForActivityResult(ActivityResultContracts.PickVisualMedia()) { uri ->
        imageWaiter.deferred?.complete(uri)
    }
    val pickFont = rememberLauncherForActivityResult(ActivityResultContracts.OpenDocument()) { uri ->
        fontWaiter.deferred?.complete(uri)
    }

    DisposableEffect(session, activity) {
        session.host = object : EditorHost {
            override suspend fun pickImage(): Uri? {
                val d = CompletableDeferred<Uri?>().also { imageWaiter.deferred = it }
                pickImage.launch(PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly))
                return d.await()
            }

            override suspend fun pickFont(): Uri? {
                val d = CompletableDeferred<Uri?>().also { fontWaiter.deferred = it }
                pickFont.launch(arrayOf("font/ttf", "font/otf", "font/woff", "font/woff2", "application/x-font-ttf",
                    "application/x-font-otf", "application/font-sfnt", "application/octet-stream"))
                return d.await()
            }

            override suspend fun export(format: ExportFormat, action: ExportAction, name: String, bytes: ByteArray): String? =
                when (action) {
                    ExportAction.SAVE -> EditorExports.save(activity, format, name, bytes)
                    ExportAction.SHARE -> { EditorExports.share(activity, format, name, bytes); null }
                    ExportAction.PRINT -> { EditorExports.print(activity, name, bytes); null }
                    ExportAction.MOCKUP -> { withContext(Dispatchers.Main) { onMockup(bytes) }; null }
                }
        }
        onDispose { session.host = null }
    }

    BackHandler {
        scope.launch {
            withTimeoutOrNull(3000) { runCatching { session.bridge.request("flush") } }
            onClose(session.draftId)
        }
    }

    AndroidView(
        factory = { ctx ->
            WebView(ctx).apply {
                // com WRAP_CONTENT (padrão do AndroidView) o WebView usa a altura do conteúdo como
                // viewport e `height: 100%` vira 0 (visto no emulador: body com 0 px de altura)
                layoutParams = ViewGroup.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT)
                session.attach(this)
            }
        },
        modifier = Modifier.fillMaxSize().safeDrawingPadding().imePadding(),
        onRelease = { it.destroy() },
    )
}

private fun Context.findActivity(): Activity {
    var c: Context = this
    while (c is ContextWrapper) {
        if (c is Activity) return c
        c = c.baseContext
    }
    error("EditorScreen precisa de uma Activity")
}
