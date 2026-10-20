plugins {
    alias(libs.plugins.android.library)
    alias(libs.plugins.kotlin.android)
}

android {
    namespace = "com.productphoto.imaging"
    compileSdk = 35
    defaultConfig {
        minSdk = 28
        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    testOptions {
        unitTests {
            isReturnDefaultValues = true
            // -PharnessDir=<pasta> liga o CompositorHarness (ajuste visual no desktop)
            all { t -> (project.findProperty("harnessDir") as String?)?.let { t.systemProperty("harness.dir", it) } }
        }
    }
}

dependencies {
    implementation(project(":core:ai-api"))
    androidTestImplementation(libs.androidx.test.runner)
    androidTestImplementation(libs.androidx.test.ext.junit)
    testImplementation(libs.junit)
    testImplementation(libs.kotlinx.coroutines.test)
}

kotlin { compilerOptions { jvmTarget.set(org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_17) } }
