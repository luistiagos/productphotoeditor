import java.util.Properties

plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.android)
    alias(libs.plugins.kotlin.compose)
}

// Servidor de imagem do app: o usuário final não configura nada. A credencial fica fora do git
// (local.properties `iawrapper.credential=email:senha` ou JWT; ou -Piawrapper.credential / env IAWRAPPER_CREDENTIAL).
// O que é passado no build vence o arquivo: -P, depois env, depois local.properties.
val localProps = Properties().apply {
    rootProject.file("local.properties").takeIf { it.exists() }?.reader()?.use { load(it) }
}
fun iawrapper(key: String, default: String): String =
    providers.gradleProperty("iawrapper.$key").orNull
        ?: System.getenv("IAWRAPPER_" + key.uppercase())
        ?: localProps.getProperty("iawrapper.$key")
        ?: default
fun String.quoted() = "\"" + replace("\\", "\\\\").replace("\"", "\\\"") + "\""
val iawrapperUrl = iawrapper("url", "https://iawrappernew-production.up.railway.app")
val iawrapperCredential = iawrapper("credential", "")

android {
    namespace = "com.productphoto.app"
    compileSdk = 35
    defaultConfig {
        applicationId = "com.productphoto.offline"
        minSdk = 28
        targetSdk = 35
        versionCode = 4
        versionName = "0.4.0"
        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
        buildConfigField("String", "IAWRAPPER_URL", iawrapperUrl.quoted())
        buildConfigField("String", "IAWRAPPER_FEATURE", iawrapper("feature", "product-photo-vast").quoted())
        buildConfigField("String", "IAWRAPPER_CREDENTIAL", iawrapperCredential.quoted())
        // Cadastro por app no iawrapper (SEC-13.2): vai no X-App-Id do login
        buildConfigField("String", "IAWRAPPER_APP_ID", iawrapper("app_id", "product-photo").quoted())
    }
    buildTypes {
        debug {
            // x86_64 só no debug, para o emulador rodar o ORT (ARQUITETURA §13.2)
            ndk { abiFilters += listOf("arm64-v8a", "x86_64") }
        }
        release {
            ndk { abiFilters += listOf("arm64-v8a") }
            isMinifyEnabled = false
            signingConfig = signingConfigs.getByName("debug") // provisório até haver keystore de release
        }
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    buildFeatures { compose = true; buildConfig = true }
    androidResources { noCompress += listOf("onnx") }
}

// SEC-08: build release não sai com a credencial de teste no BuildConfig nem com o iawrapper em http://.
// O círculo de teste passa com escape explícito: -Pallow.test.credential=true
androidComponents {
    onVariants(selector().withBuildType("release")) { variant ->
        val problems = buildList {
            if (iawrapperCredential.isNotBlank()) add("IAWRAPPER_CREDENTIAL preenchido (iawrapper.credential)")
            if (iawrapperUrl.trim().startsWith("http://", ignoreCase = true)) add("IAWRAPPER_URL em http:// (iawrapper.url)")
        }
        val allowed = providers.gradleProperty("allow.test.credential").orNull == "true"
        val name = variant.name
        val cap = name.replaceFirstChar { it.uppercase() }
        val check = tasks.register("check${cap}IawrapperConfig") {
            doLast {
                if (problems.isNotEmpty() && !allowed) throw GradleException(
                    "Build $name bloqueado (SEC-08): " + problems.joinToString("; ") +
                        ". Limpe com -Piawrapper.credential= / -Piawrapper.url=https://..., " +
                        "ou, só para o círculo de teste, passe -Pallow.test.credential=true."
                )
                if (problems.isNotEmpty()) logger.warn("SEC-08 liberado por -Pallow.test.credential=true: " + problems.joinToString("; "))
            }
        }
        tasks.matching { it.name == "pre${cap}Build" }.configureEach { dependsOn(check) }
    }
}

dependencies {
    implementation(project(":core:ai-api"))
    implementation(project(":core:imaging"))
    implementation(project(":core:secrets"))
    implementation(project(":core:models"))
    implementation(project(":core:ui"))
    implementation(project(":ai:mlkit"))
    implementation(project(":ai:onnx"))
    implementation(project(":ai:vtracer"))
    implementation(project(":ai:remote-http"))
    implementation(project(":ai:litertlm"))
    implementation(project(":feature:product"))
    implementation(project(":feature:mockup"))
    implementation(project(":data"))
    implementation(project(":editor"))
    implementation(libs.androidx.core.ktx)
    implementation(platform(libs.compose.bom))
    implementation(libs.compose.ui)
    implementation(libs.compose.material3)
    implementation(libs.androidx.activity.compose)
    implementation(libs.androidx.lifecycle.viewmodel.compose)
    implementation(libs.kotlinx.coroutines.android)
    testImplementation(libs.junit)
    androidTestImplementation(libs.androidx.test.runner)
    androidTestImplementation(libs.androidx.test.ext.junit)
    androidTestImplementation(libs.kotlinx.coroutines.test)
    androidTestImplementation(libs.onnxruntime.android) // DeviceProbe#esrgan abre a sessão direto (§20.5 task 1)
}

kotlin { compilerOptions { jvmTarget.set(org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_17) } }
