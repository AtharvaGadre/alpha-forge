import UIKit
import Flutter
import AVFoundation

@main
@objc class AppDelegate: FlutterAppDelegate {
  private let audioChannelName = "com.alphaforge.atmosphere/audio"

  override func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?
  ) -> Bool {
    if let controller = window?.rootViewController as? FlutterViewController {
      let audioChannel = FlutterMethodChannel(
        name: audioChannelName,
        binaryMessenger: controller.binaryMessenger
      )

      audioChannel.setMethodCallHandler { [weak self] (call: FlutterMethodCall, result: @escaping FlutterResult) in
        switch call.method {
        case "requestMicrophonePermission":
          AVAudioSession.sharedInstance().requestRecordPermission { granted in
            DispatchQueue.main.async {
              result(granted)
            }
          }
        case "configureVoiceSession":
          self?.configureAVAudioSession(result: result)
        case "startListening":
          self?.configureAVAudioSession(result: result)
        case "stopSpeakingImmediate":
          do {
            try AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
            result(nil)
          } catch {
            result(nil)
          }
        default:
          result(FlutterMethodNotImplemented)
        }
      }
    }

    GeneratedPluginRegistrant.register(with: self)
    return super.application(application, didFinishLaunchingWithOptions: launchOptions)
  }

  private func configureAVAudioSession(result: @escaping FlutterResult) {
    let session = AVAudioSession.sharedInstance()
    do {
      try session.setCategory(
        .playAndRecord,
        mode: .voiceChat,
        options: [.defaultToSpeaker, .allowBluetooth, .allowBluetoothA2DP]
      )
      try session.setActive(true)
      result(nil)
    } catch {
      result(FlutterError(code: "AUDIO_SESSION_ERR", message: error.localizedDescription, details: nil))
    }
  }
}
