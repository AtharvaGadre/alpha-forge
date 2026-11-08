# MOBILE_ARCHITECTURE.md — Native iOS & Android Architecture (Flutter + Dart + Swift + Kotlin)

## 1. Executive Overview
AlphaForge Atmosphere includes a genuine native mobile application in `apps/mobile/` built with **Flutter + Dart**, supplemented by native **Swift** (`ios/Runner/AppDelegate.swift`) and **Kotlin** (`android/app/src/main/kotlin/com/alphaforge/atmosphere/MainActivity.kt`) platform channels for low-latency ARGON voice audio routing.

No React Native, Capacitor, Cordova, or WebView wrapper is used for the mobile application shell.

## 2. Directory Structure (`apps/mobile/`)
- `pubspec.yaml` — Flutter SDK (`>=3.4.0 <4.0.0`), Material 3 dark theme, HTTP/WebSocket clients, and local preferences.
- `lib/main.dart` — Native mobile application entry point.
- `lib/app/atmosphere_app.dart` — Main mobile-first shell featuring:
  - Full-screen interactive 3D Earth (`NativeGlobeView`) with multi-touch pinch-to-zoom, pan, and synchronized weather streamlines.
  - Top location selector & **Demo Access Preset Selector** (`Guest Explorer`, `Commodity Analyst`, `Weather Researcher`, `Global Macro Analyst`).
  - Draggable bottom sheet (`TradeIdeasBottomSheet`) showing **Predicted Weather Effects on Financial Markets**, **Prediction Market Trade Ideas**, **General Trade Ideas from the News**, and the **Bottom AI Executive Summary**.
  - Floating **ARGON Voice Assistant Orb** (`ArgonOrbSheet`).
- `lib/core/models/atmosphere_models.dart` — Immutable Dart data structures for locations, weather-to-market trade ideas, news trade ideas, and AI summaries.
- `lib/core/api/atmosphere_api_client.dart` — Shared backend REST client connecting to `/api/v1/trade-ideas`, `/api/v1/news-trade-ideas`, `/api/v1/ai-summary`, and `/api/v1/argon/query` with deterministic offline resilience.
- `lib/core/audio/argon_native_audio_bridge.dart` — `MethodChannel('com.alphaforge.atmosphere/audio')` bridge to iOS `AVAudioSession` and Android `AudioManager`.
- `lib/features/reports/mobile_report_screen.dart` — Native 28-section collapsible scientific report reader.
- `ios/Runner/AppDelegate.swift` & `ios/Runner/Info.plist` — Native iOS `AVAudioSession` `.playAndRecord` voice chat configuration and `NSMicrophoneUsageDescription`.
- `android/app/src/main/kotlin/com/alphaforge/atmosphere/MainActivity.kt` & `AndroidManifest.xml` — Native Android `AudioManager.MODE_IN_COMMUNICATION` and `RECORD_AUDIO` runtime permission handler.
