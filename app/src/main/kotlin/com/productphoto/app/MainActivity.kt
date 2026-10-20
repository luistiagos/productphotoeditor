package com.productphoto.app

import android.Manifest
import android.app.Application
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.compose.BackHandler
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.key
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.lifecycle.viewmodel.initializer
import androidx.lifecycle.viewmodel.viewModelFactory
import com.productphoto.editor.EditorScreen
import com.productphoto.editor.EditorSession
import com.productphoto.editor.EditorStart
import com.productphoto.feature.mockup.MockupDeps
import com.productphoto.feature.mockup.MockupScreen
import com.productphoto.feature.product.ProductFlowScreen
import com.productphoto.feature.product.ProductFlowViewModel
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.dynamicDarkColorScheme
import androidx.compose.material3.dynamicLightColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.ui.platform.LocalContext

class ProductPhotoApp : Application() {
    val graph by lazy { AppGraph(this) }
    val navigator = Navigator()
}

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        if (Build.VERSION.SDK_INT == Build.VERSION_CODES.P &&
            checkSelfPermission(Manifest.permission.WRITE_EXTERNAL_STORAGE) != PackageManager.PERMISSION_GRANTED
        ) {
            requestPermissions(arrayOf(Manifest.permission.WRITE_EXTERNAL_STORAGE), 1)
        }
        val app = application as ProductPhotoApp
        setContent {
            val dark = isSystemInDarkTheme()
            val ctx = LocalContext.current
            val colors = when {
                Build.VERSION.SDK_INT >= Build.VERSION_CODES.S -> if (dark) dynamicDarkColorScheme(ctx) else dynamicLightColorScheme(ctx)
                dark -> darkColorScheme()
                else -> lightColorScheme()
            }
            MaterialTheme(colorScheme = colors) {
                AppNavigation(app)
            }
        }
    }
}

@Composable
private fun AppNavigation(app: ProductPhotoApp) {
    val nav = app.navigator
    val graph = app.graph
    BackHandler(enabled = nav.stack.size > 1) { nav.pop() }
    when (val screen = nav.current) {
        Screen.Home -> HomeScreen(
            onProductPhoto = { nav.push(Screen.Product) },
            onNewDesign = { name, w, h -> nav.push(Screen.Editor(EditorStart.New(name, w, h))) },
            onTemplates = { nav.push(Screen.Editor(EditorStart.Gallery)) },
            onDrafts = { nav.push(Screen.Drafts) },
            onBrandKit = { nav.push(Screen.BrandKit) },
            onModels = { nav.push(Screen.Models) },
            onTextAi = { nav.push(Screen.TextAi) },
            onImageGen = { nav.push(Screen.ImageGen) },
            onMockup = { nav.push(Screen.Mockup()) },
        )
        Screen.Product -> {
            val vm: ProductFlowViewModel = viewModel(
                factory = viewModelFactory { initializer { ProductFlowViewModel(AppProductDeps(app, graph, nav)) } },
            )
            ProductFlowScreen(vm)
        }
        Screen.Drafts -> DraftsScreen(graph.drafts) { id -> nav.push(Screen.Editor(EditorStart.Draft(id))) }
        Screen.BrandKit -> BrandKitScreen(graph, onBack = { nav.pop() })
        Screen.Models -> ModelsScreen(graph)
        Screen.TextAi -> TextAiScreen(graph, onModels = { nav.push(Screen.Models) })
        Screen.ImageGen -> ImageGenScreen(graph) { bmp ->
            val name = graph.editorAssets.putPng(bmp, "img")
            nav.push(Screen.Editor(EditorStart.Image(name, "Imagem gerada")))
        }
        is Screen.Editor -> key(screen.key) {
            val context = LocalContext.current
            val scope = rememberCoroutineScope()
            val session = remember {
                EditorSession(context, scope, graph.editorAssets, graph.editorAi, graph.drafts, graph.brandKits, screen.start)
            }
            EditorScreen(session, onMockup = { bytes ->
                android.graphics.BitmapFactory.decodeByteArray(bytes, 0, bytes.size)?.let { nav.push(Screen.Mockup(it)) }
            }) { nav.pop() }
        }
        is Screen.Mockup -> key(screen.key) {
            val activity = LocalContext.current as android.app.Activity
            val deps = remember {
                fun png(b: android.graphics.Bitmap) = java.io.ByteArrayOutputStream().also {
                    b.compress(android.graphics.Bitmap.CompressFormat.PNG, 100, it)
                }.toByteArray()
                MockupDeps(
                    graph.mockupLibrary, graph.mockupRenderer,
                    save = { b -> com.productphoto.editor.EditorExports.save(activity, com.productphoto.editor.ExportFormat.PNG, "mockup", png(b)) },
                    share = { b -> com.productphoto.editor.EditorExports.share(activity, com.productphoto.editor.ExportFormat.PNG, "mockup", png(b)) },
                    openInEditor = { b ->
                        val name = graph.editorAssets.putPng(b, "img")
                        nav.push(Screen.Editor(EditorStart.Image(name, "Mockup")))
                    },
                )
            }
            MockupScreen(deps, screen.initial)
        }
    }
}
