# IOS_BUILD.md — Native iOS Build & Verification Guide

## 1. Prerequisites
- macOS with Xcode 16+ and CocoaPods
- Flutter SDK `>= 3.24.0` (Dart `>= 3.4.0`)

## 2. Simulator & Unsigned Build Commands
From a macOS host or GitHub Actions `macos-latest` runner:

```bash
cd apps/mobile
flutter pub get
flutter analyze
flutter test
flutter build ios --simulator --no-codesign
```

## 3. Signed App Store / TestFlight Build
When Apple Developer signing credentials (`APPLE_TEAM_ID`, provisioning profile, and distribution certificate) are configured:

```bash
cd apps/mobile
flutter build ipa --release
```

## 4. Native iOS Audio & Permissions
- `apps/mobile/ios/Runner/Info.plist` includes `NSMicrophoneUsageDescription` explaining microphone usage for ARGON voice queries.
- `apps/mobile/ios/Runner/AppDelegate.swift` configures `AVAudioSession.sharedInstance()` with `.playAndRecord` and `.voiceChat` options (`.defaultToSpeaker`, `.allowBluetooth`, `.allowBluetoothA2DP`).
