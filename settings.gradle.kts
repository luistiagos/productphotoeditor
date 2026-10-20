pluginManagement {
    repositories {
        google()
        mavenCentral()
        gradlePluginPortal()
    }
}
dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
    repositories {
        google()
        mavenCentral()
    }
}
rootProject.name = "ProductPhotoOffline"
include(
    ":app",
    ":core:ai-api",
    ":core:imaging",
    ":core:secrets",
    ":core:models",
    ":ai:mlkit",
    ":ai:onnx",
    ":ai:vtracer",
    ":ai:remote-http",
    ":ai:litertlm",
    ":feature:product",
    ":feature:mockup",
    ":data",
    ":editor",
)
