package com.productphoto.app

import android.Manifest
import android.app.Application
import android.app.Activity
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.compose.BackHandler
import androidx.compose.runtime.Composable
import androidx.compose.runtime.SideEffect
import androidx.compose.runtime.key
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalView
import androidx.core.view.WindowCompat
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
import com.productphoto.ui.ProductPhotoTheme

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
            val style = app.graph.themeStyle.value
            val view = LocalView.current
            if (!view.isInEditMode) {
                SideEffect {
                    val window = (view.context as Activity).window
                    window.statusBarColor = style.scheme.surface.toArgb()
                    window.navigationBarColor = style.scheme.surface.toArgb()
                    WindowCompat.getInsetsController(window, view).apply {
                        isAppearanceLightStatusBars = !style.isDark
                        isAppearanceLightNavigationBars = !style.isDark
                    }
                }
            }
            ProductPhotoTheme(style = style) {
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
            graph = graph,
            onProductPhoto = { nav.push(Screen.Product) },
            onBgRemover = { nav.push(Screen.BgRemover) },
            onUpscaler = { nav.push(Screen.Upscaler) },
            onNewDesign = { name, w, h -> nav.push(Screen.Editor(EditorStart.New(name, w, h))) },
            onTemplates = { nav.push(Screen.Editor(EditorStart.Gallery)) },
            onDrafts = { nav.push(Screen.Drafts) },
            onBrandKit = { nav.push(Screen.BrandKit) },
            onModels = { nav.push(Screen.Models) },
            onTextAi = { nav.push(Screen.TextAi) },
            onImageGen = { nav.push(Screen.ImageGen) },
            onMockup = { nav.push(Screen.Mockup()) },
            onSettings = { nav.push(Screen.Settings) },
        )
        Screen.BgRemover -> QuickBgRemoverScreen(
            graph = graph,
            onOpenInEditor = { bmp ->
                val name = graph.editorAssets.putPng(bmp, "cutout")
                nav.push(Screen.Editor(EditorStart.Image(name, "Fundo removido")))
            },
            onBack = { nav.pop() },
        )
        Screen.Upscaler -> QuickUpscalerScreen(
            graph = graph,
            onOpenInEditor = { bmp ->
                val name = graph.editorAssets.putPng(bmp, "upscale")
                nav.push(Screen.Editor(EditorStart.Image(name, "Imagem HD")))
            },
            onBack = { nav.pop() },
        )
        Screen.Settings -> SettingsScreen(
            graph = graph,
            onTextAi = { nav.push(Screen.TextAi) },
            onModels = { nav.push(Screen.Models) },
            onBack = { nav.pop() },
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
