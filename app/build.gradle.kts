plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.android)
    alias(libs.plugins.kotlin.compose)
}

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
    buildFeatures { compose = true }
    androidResources { noCompress += listOf("onnx") }
}

dependencies {
    implementation(project(":core:ai-api"))
    implementation(project(":core:imaging"))
    implementation(project(":core:secrets"))
    implementation(project(":core:models"))
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
