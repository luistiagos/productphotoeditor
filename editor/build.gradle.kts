plugins {
    alias(libs.plugins.android.library)
    alias(libs.plugins.kotlin.android)
    alias(libs.plugins.kotlin.compose)
    alias(libs.plugins.kotlin.serialization)
}

android {
    namespace = "com.productphoto.editor"
    compileSdk = 35
    defaultConfig {
        minSdk = 28
        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    buildFeatures { compose = true }
    testOptions { unitTests.isReturnDefaultValues = true }
}

// O editor web é gerado por `npm run build` em editor-web/ (ARQUITETURA §7) e versionado em
// src/main/assets/editor/; esta tarefa só confere que o build existe.
val checkEditorWeb by tasks.registering {
    val index = file("src/main/assets/editor/index.html")
    doLast { check(index.exists()) { "Rode `npm run build` em editor-web/ (falta $index)" } }
}
tasks.named("preBuild") { dependsOn(checkEditorWeb) }

dependencies {
    implementation(project(":core:ai-api"))
    implementation(project(":core:imaging"))
    implementation(project(":data"))
    implementation(libs.androidx.core.ktx)
    implementation(libs.androidx.webkit)
    implementation(libs.androidx.print)
    implementation(libs.ffmpeg.kit.full)
    implementation(platform(libs.compose.bom))
    implementation(libs.compose.ui)
    implementation(libs.compose.material3)
    implementation(libs.androidx.activity.compose)
    implementation(libs.kotlinx.coroutines.android)
    testImplementation(libs.junit)
    testImplementation(libs.kotlinx.coroutines.test)
    androidTestImplementation(libs.androidx.test.runner)
    androidTestImplementation(libs.androidx.test.ext.junit)
    androidTestImplementation(libs.kotlinx.coroutines.test)
}

kotlin { compilerOptions { jvmTarget.set(org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_17) } }
