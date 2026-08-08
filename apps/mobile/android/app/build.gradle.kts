import java.util.Properties
import java.io.File

plugins {
    id("com.android.application")
    id("kotlin-android")
    id("dev.flutter.flutter-gradle-plugin")
}

// Load release keystore from android/key.properties if present.
// Falls back to debug signing only for debug builds; release builds
// without a configured keystore will fail (intentional — never ship
// a release APK signed with the debug key).
val keystoreProperties = Properties()
val keystoreFile = rootProject.file("key.properties")
if (keystoreFile.exists()) {
    keystoreProperties.load(keystoreFile.inputStream())
}

android {
    namespace = "com.nkuku.nkuku_mobile"
    compileSdk = 37  // flutter_secure_storage requires SDK 37+
    ndkVersion = flutter.ndkVersion

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
        isCoreLibraryDesugaringEnabled = true
    }

    kotlinOptions {
        jvmTarget = JavaVersion.VERSION_17.toString()
    }

    defaultConfig {
        applicationId = "com.nkuku.nkuku_mobile"
        minSdk = flutter.minSdkVersion
        targetSdk = flutter.targetSdkVersion
        versionCode = flutter.versionCode
        versionName = flutter.versionName

        // APP_API_BASE_URL — passed via --dart-define at build time.
        // The Dart default (api_service.dart) is the production URL, so
        // release builds work out of the box. Override for dev:
        //   flutter build apk --dart-define=APP_API_BASE_URL=http://10.0.2.2:30001
    }

    signingConfigs {
        create("release") {
            if (keystoreFile.exists()) {
                keyAlias = keystoreProperties["keyAlias"] as String
                keyPassword = keystoreProperties["keyPassword"] as String
                storeFile = file(keystoreProperties["storeFile"] as String)
                storePassword = keystoreProperties["storePassword"] as String
            }
        }
    }

    buildTypes {
        release {
            // Use the release keystore if configured; otherwise fail with a
            // clear error instead of silently falling back to the debug key.
            if (keystoreFile.exists()) {
                signingConfig = signingConfigs.getByName("release")
            } else {
                throw GradleException(
                    "Release build requires android/key.properties — see " +
                    "android/key.properties.example for instructions. " +
                    "Do NOT ship a release APK signed with the debug key."
                )
            }
        }
    }
}

flutter {
    source = "../.."
}

dependencies {
    coreLibraryDesugaring("com.android.tools:desugar_jdk_libs:2.0.4")
}
