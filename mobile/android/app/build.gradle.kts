import java.util.Properties

plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("dev.flutter.flutter-gradle-plugin")
}

val signingFile = rootProject.file("key.properties")
val uploadSigning = Properties()
if (signingFile.exists()) {
    signingFile.inputStream().use { uploadSigning.load(it) }
    for (property in listOf("storeFile", "storePassword", "keyAlias", "keyPassword")) {
        require(!uploadSigning.getProperty(property).isNullOrBlank()) { "Missing $property in android/key.properties" }
    }
    require(file(uploadSigning.getProperty("storeFile")).exists()) {
        "Upload keystore configured in android/key.properties was not found"
    }
} else if (gradle.startParameter.taskNames.any { it.contains("release", ignoreCase = true) }) {
    throw GradleException("Release signing requires an NTE upload key configured in android/key.properties.")
}

android {
    namespace = "com.ntenaadu.app"
    compileSdk = 36

    defaultConfig {
        applicationId = "com.ntenaadu.app"
        minSdk = 23
        targetSdk = 36
        versionCode = flutter.versionCode
        versionName = flutter.versionName
    }

    flavorDimensions += "environment"
    productFlavors {
        create("staging") {
            dimension = "environment"
            applicationIdSuffix = ".staging"
            manifestPlaceholders["appLabel"] = "NTE Naadu Staging"
        }
        create("production") {
            dimension = "environment"
            manifestPlaceholders["appLabel"] = "NTE Naadu"
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions { jvmTarget = JavaVersion.VERSION_17.toString() }

    signingConfigs {
        if (signingFile.exists()) {
            create("release") {
                keyAlias = uploadSigning.getProperty("keyAlias")
                keyPassword = uploadSigning.getProperty("keyPassword")
                storeFile = file(uploadSigning.getProperty("storeFile"))
                storePassword = uploadSigning.getProperty("storePassword")
            }
        }
    }
    buildTypes {
        release {
            if (signingFile.exists()) signingConfig = signingConfigs.getByName("release")
        }
    }
}

flutter { source = "../.." }
