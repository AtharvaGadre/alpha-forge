# ANDROID_BUILD.md — Native Android Build & Verification Guide

## 1. Prerequisites
- Flutter SDK `>= 3.24.0` (Dart `>= 3.4.0`)
- Android Studio / Android SDK Platform 34+
- JDK 17

## 2. Build Commands
From the repository root:

```bash
cd apps/mobile
flutter pub get
flutter analyze
flutter test
flutter build apk --debug
```

For a release Android App Bundle (`.aab`) when Android keystore signing credentials (`ANDROID_KEYSTORE_BASE64`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`, `ANDROID_STORE_PASSWORD`) are configured:

```bash
cd apps/mobile
flutter build appbundle --release
```

## 3. Native Android Audio & Permissions
- `apps/mobile/android/app/src/main/AndroidManifest.xml` declares `INTERNET`, `RECORD_AUDIO`, and `MODIFY_AUDIO_SETTINGS`.
- `apps/mobile/android/app/src/main/kotlin/com/alphaforge/atmosphere/MainActivity.kt` implements `com.alphaforge.atmosphere/audio` to request runtime microphone permissions and switch `AudioManager` into `MODE_IN_COMMUNICATION` for low-latency ARGON voice streaming.
