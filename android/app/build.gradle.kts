import java.net.URI

plugins {
    id("com.android.application")
}

fun readLocalProperty(key: String): String? {
    val localFile = rootProject.file("local.properties")
    if (!localFile.exists()) return null
    return localFile.readLines()
        .map { it.trim() }
        .firstOrNull { it.startsWith("$key=") && !it.startsWith("#") }
        ?.substringAfter("=", "")
        ?.trim()
        ?.takeIf { it.isNotEmpty() }
}

fun hostFromUrl(raw: String): String {
    return runCatching { URI(raw).host }
        .getOrNull()
        ?.takeIf { it.isNotBlank() }
        ?: "localhost"
}

val keystorePropertiesFile = rootProject.file("keystore.properties")
val keystoreProperties = mutableMapOf<String, String>()
if (keystorePropertiesFile.exists()) {
    keystorePropertiesFile.readLines()
        .map { it.trim() }
        .filter { it.isNotEmpty() && !it.startsWith("#") && it.contains("=") }
        .forEach { line ->
            val idx = line.indexOf('=')
            keystoreProperties[line.substring(0, idx).trim()] = line.substring(idx + 1).trim()
        }
}

android {
    namespace = "pl.gymbrat.app"
    compileSdk = 35

    defaultConfig {
        applicationId = "pl.gymbrat.app"
        minSdk = 26
        targetSdk = 35
        versionCode = 7
        versionName = "0.1.6"

        ndk {
            abiFilters += listOf("armeabi-v7a", "arm64-v8a")
        }

        val apiBase = readLocalProperty("api.base.url")
            ?: (project.findProperty("API_BASE_URL") as String?)
            ?: "https://gym-brat.vercel.app/"
        buildConfigField("String", "API_BASE_URL", "\"$apiBase\"")
        manifestPlaceholders["appLinkHost"] = hostFromUrl(apiBase)
    }

    signingConfigs {
        create("release") {
            val storePath = keystoreProperties["storeFile"]
            if (storePath != null) {
                storeFile = rootProject.file(storePath)
                storePassword = keystoreProperties["storePassword"]
                keyAlias = keystoreProperties["keyAlias"]
                keyPassword = keystoreProperties["keyPassword"]
                val type = keystoreProperties["storeType"]
                if (!type.isNullOrBlank()) {
                    storeType = type
                }
                enableV1Signing = true
                enableV2Signing = true
                enableV3Signing = false
            }
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            val releaseSigning = signingConfigs.getByName("release")
            // Bez keystore.properties podpisuj debugiem — APK da się zainstalować z GitHub Actions.
            signingConfig = if (releaseSigning.storeFile != null) {
                releaseSigning
            } else {
                signingConfigs.getByName("debug")
            }
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
        }
        debug {
            val releaseSigning = signingConfigs.getByName("release")
            if (releaseSigning.storeFile != null) {
                signingConfig = releaseSigning
            }
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    buildFeatures {
        buildConfig = true
    }

    lint {
        disable += "ExpiredTargetSdkVersion"
        checkReleaseBuilds = true
        abortOnError = true
    }
}

dependencies {
    implementation("androidx.appcompat:appcompat:1.7.0")
    implementation("androidx.activity:activity:1.9.3")
    implementation("androidx.core:core:1.15.0")
    implementation("androidx.webkit:webkit:1.12.1")
    implementation("com.squareup.okhttp3:okhttp:4.12.0")
    implementation("com.google.android.material:material:1.12.0")
}
