import java.util.Properties

plugins {
    alias(libs.plugins.android.library)
    alias(libs.plugins.kotlin.android)
}

android {
    namespace = "com.productphoto.ai.vtracer"
    compileSdk = 35
    ndkVersion = "27.0.12077973" // o padrão do AGP 8.7; necessário para o linker do cargo
    defaultConfig {
        minSdk = 28
        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    sourceSets["main"].jniLibs.srcDir(layout.buildDirectory.dir("rustJniLibs"))
}

dependencies {
    implementation(project(":core:ai-api"))
    implementation(project(":core:imaging"))
    implementation(libs.kotlinx.coroutines.core)
    androidTestImplementation(libs.androidx.test.runner)
    androidTestImplementation(libs.androidx.test.ext.junit)
}

// --- Rust (vtracer) → libvtracer_jni.so por ABI -------------------------------------------------
// Chama o cargo direto com o clang do NDK como linker (o que o cargo-ndk faria; ARQUITETURA §14.2).
// Toolchain: local.properties `rust.home` (contém rustup/ e cargo/) ou RUSTUP_HOME/CARGO_HOME.
val rustAbis = mapOf("arm64-v8a" to "aarch64-linux-android", "x86_64" to "x86_64-linux-android")
val rustApi = 28
val localProps = Properties().apply {
    rootProject.file("local.properties").takeIf { it.exists() }?.inputStream()?.use { load(it) }
}
val rustHome: String? = localProps.getProperty("rust.home")
val cargoHome: String? = rustHome?.let { "$it/cargo" } ?: System.getenv("CARGO_HOME")
val rustupHome: String? = rustHome?.let { "$it/rustup" } ?: System.getenv("RUSTUP_HOME")
val osName: String = System.getProperty("os.name")
val isWindows = osName.startsWith("Windows")
val cargoExe = cargoHome?.let { "$it/bin/cargo" + if (isWindows) ".exe" else "" } ?: "cargo"
val rustDir = file("rust")
val rustTargetDir = layout.buildDirectory.dir("rust-target")

val cargoTasks = rustAbis.map { (abi, triple) ->
    tasks.register<Exec>("cargoBuild-$abi") {
        inputs.dir(rustDir.resolve("src"))
        inputs.files(rustDir.resolve("Cargo.toml"), rustDir.resolve("Cargo.lock"))
        outputs.file(rustTargetDir.map { it.file("$triple/release/libvtracer_jni.so") })
        workingDir = rustDir
        commandLine(cargoExe, "build", "--release", "--locked", "--target", triple)
        doFirst {
            val host = when {
                isWindows -> "windows-x86_64"
                osName.startsWith("Mac") -> "darwin-x86_64"
                else -> "linux-x86_64"
            }
            val bin = android.ndkDirectory.resolve("toolchains/llvm/prebuilt/$host/bin")
            val linker = bin.resolve("$triple$rustApi-clang" + if (isWindows) ".cmd" else "")
            check(linker.exists()) { "NDK linker not found: $linker" }
            val key = triple.uppercase().replace('-', '_')
            cargoHome?.let { environment("CARGO_HOME", it) }
            rustupHome?.let { environment("RUSTUP_HOME", it) }
            environment("CARGO_TARGET_DIR", rustTargetDir.get().asFile.absolutePath)
            environment("CARGO_TARGET_${key}_LINKER", linker.absolutePath)
            // páginas de 16 KB (Android 15+)
            environment("CARGO_TARGET_${key}_RUSTFLAGS", "-C link-arg=-Wl,-z,max-page-size=16384")
        }
    }
}

val copyRustLibs = tasks.register<Sync>("copyRustLibs") {
    dependsOn(cargoTasks)
    into(layout.buildDirectory.dir("rustJniLibs"))
    rustAbis.forEach { (abi, triple) ->
        from(rustTargetDir.map { it.file("$triple/release/libvtracer_jni.so") }) { into(abi) }
    }
}

tasks.named("preBuild") { dependsOn(copyRustLibs) }

kotlin { compilerOptions { jvmTarget.set(org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_17) } }
