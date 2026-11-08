package com.alphaforge.atmosphere

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.media.AudioManager
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel

class MainActivity : FlutterActivity() {
    private val audioChannelName = "com.alphaforge.atmosphere/audio"
    private val micPermissionRequestCode = 4001

    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)

        MethodChannel(
            flutterEngine.dartExecutor.binaryMessenger,
            audioChannelName
        ).setMethodCallHandler { call, result ->
            when (call.method) {
                "requestMicrophonePermission" -> {
                    val granted = ContextCompat.checkSelfPermission(
                        this,
                        Manifest.permission.RECORD_AUDIO
                    ) == PackageManager.PERMISSION_GRANTED
                    if (!granted) {
                        ActivityCompat.requestPermissions(
                            this,
                            arrayOf(Manifest.permission.RECORD_AUDIO),
                            micPermissionRequestCode
                        )
                    }
                    result.success(granted)
                }
                "configureVoiceSession", "startListening" -> {
                    val audioManager = getSystemService(Context.AUDIO_SERVICE) as AudioManager
                    audioManager.mode = AudioManager.MODE_IN_COMMUNICATION
                    audioManager.isSpeakerphoneOn = true
                    result.success(null)
                }
                "stopSpeakingImmediate" -> {
                    val audioManager = getSystemService(Context.AUDIO_SERVICE) as AudioManager
                    audioManager.mode = AudioManager.MODE_NORMAL
                    result.success(null)
                }
                else -> result.notImplemented()
            }
        }
    }
}
