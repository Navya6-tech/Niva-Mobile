package com.nivara.safety
import android.content.*; import android.os.Build
import com.facebook.react.bridge.*
import com.facebook.react.modules.core.DeviceEventManagerModule
class NivaraServiceModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {
    override fun getName() = "NivaraService"
    private var sosReceiver: BroadcastReceiver? = null
    companion object { 
        var pendingSOS = false
        var emergencyPhones: List<String> = emptyList()
        var lastKnownLocation: android.location.Location? = null
    }
    @ReactMethod fun startService(promise: Promise) {
        try {
            val i = Intent(reactApplicationContext, NivaraBackgroundService::class.java).apply { action = NivaraBackgroundService.ACTION_START }
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) reactApplicationContext.startForegroundService(i) else reactApplicationContext.startService(i)
            promise.resolve(true)
        } catch (e: Exception) { promise.reject("ERROR", e.message ?: "Unknown error") }
    }
    @ReactMethod fun stopService(promise: Promise) {
        try {
            reactApplicationContext.startService(Intent(reactApplicationContext, NivaraBackgroundService::class.java).apply { action = NivaraBackgroundService.ACTION_STOP })
            promise.resolve(true)
        } catch (e: Exception) { promise.reject("ERROR", e.message ?: "Unknown error") }
    }
    @ReactMethod fun addListener(eventName: String) {
        if (eventName == "SOSTriggered" && sosReceiver == null) {
            sosReceiver = object : BroadcastReceiver() {
                override fun onReceive(context: Context, intent: Intent) {
                    val source = intent.getStringExtra(NivaraBackgroundService.EXTRA_SOURCE) ?: "unknown"
                    val params = Arguments.createMap().apply { putString("source", source) }
                    reactApplicationContext.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java).emit("SOSTriggered", params)
                }
            }
            val filter = IntentFilter(NivaraBackgroundService.ACTION_SOS)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) reactApplicationContext.registerReceiver(sosReceiver, filter, Context.RECEIVER_NOT_EXPORTED)
            else reactApplicationContext.registerReceiver(sosReceiver, filter)
        }
    }
    @ReactMethod fun releaseAudioSession(promise: Promise) {
        try {
            val audioManager = reactApplicationContext.getSystemService(android.media.AudioManager::class.java)
            if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
                val focusRequest = android.media.AudioFocusRequest.Builder(android.media.AudioManager.AUDIOFOCUS_GAIN)
                    .build()
                audioManager?.requestAudioFocus(focusRequest)
                audioManager?.abandonAudioFocusRequest(focusRequest)
            }
            promise.resolve(true)
        } catch (e: Exception) { promise.resolve(false) }
    }
    @ReactMethod fun updateEmergencyData(phones: com.facebook.react.bridge.ReadableArray, lat: Double, lng: Double) {
        val phoneList = mutableListOf<String>()
        for (i in 0 until phones.size()) { phones.getString(i)?.let { phoneList.add(it) } }
        emergencyPhones = phoneList
        // Persist to SharedPreferences
        reactApplicationContext.getSharedPreferences("nivara_prefs", android.content.Context.MODE_PRIVATE)
            .edit().putString("phones", phoneList.joinToString(",")).apply()
        if (lat != 0.0 && lng != 0.0) {
            val loc = android.location.Location("manual")
            loc.latitude = lat
            loc.longitude = lng
            lastKnownLocation = loc
        }
    }
    @ReactMethod fun triggerSOSFromJS(promise: Promise) {
        try {
            NivaraBackgroundService.instance?.resetLastSosTrigger()
            if (NivaraBackgroundService.instance != null) {
                NivaraBackgroundService.instance?.triggerSOSPublic("voice_js")
                android.util.Log.d("NIVARA", "triggerSOSFromJS: called instance")
            } else {
                // Instance null - start service and trigger via broadcast
                android.util.Log.d("NIVARA", "triggerSOSFromJS: instance null, starting service")
                val i = android.content.Intent(reactApplicationContext, NivaraBackgroundService::class.java).apply {
                    action = NivaraBackgroundService.ACTION_START
                }
                if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
                    reactApplicationContext.startForegroundService(i)
                } else {
                    reactApplicationContext.startService(i)
                }
                // Delay trigger to allow service to start
                android.os.Handler(android.os.Looper.getMainLooper()).postDelayed({
                    NivaraBackgroundService.instance?.resetLastSosTrigger()
                    NivaraBackgroundService.instance?.triggerSOSPublic("voice_js")
                }, 1000)
            }
            promise.resolve(true)
        } catch (e: Exception) { 
            android.util.Log.e("NIVARA", "triggerSOSFromJS error: ${e.message}")
            promise.resolve(false) 
        }
    }
    @ReactMethod fun setAudioRecordingEnabled(enabled: Boolean) { 
        NivaraBackgroundService.audioRecordingEnabled = enabled
        reactApplicationContext.getSharedPreferences("nivara_prefs", android.content.Context.MODE_PRIVATE)
            .edit().putBoolean("audioRecording", enabled).apply()
    }
    @ReactMethod fun setShakeTriggerEnabled(enabled: Boolean) {
        NivaraBackgroundService.shakeTriggerEnabled = enabled
        reactApplicationContext.getSharedPreferences("nivara_prefs", android.content.Context.MODE_PRIVATE)
            .edit().putBoolean("shakeTrigger", enabled).apply()
        android.util.Log.d("NIVARA", "setShakeTriggerEnabled: $enabled")
    }
    @ReactMethod fun setVoiceTriggerEnabled(enabled: Boolean) { 
        NivaraBackgroundService.voiceTriggerEnabled = enabled
        android.util.Log.d("NIVARA", "setVoiceTriggerEnabled: $enabled, current=${NivaraBackgroundService.voiceTriggerEnabled}")
    }
    @ReactMethod fun cancelSosAlert() {
        try {
            reactApplicationContext.getSystemService(android.app.NotificationManager::class.java)?.cancel(998)
            android.util.Log.d("NIVARA", "cancelSosAlert: dismissed SOS alert notification")
        } catch (e: Exception) {
            android.util.Log.e("NIVARA", "cancelSosAlert error: ${e.message}")
        }
    }
    @ReactMethod fun prepareAudioForPlayback() {
        try {
            val am = reactApplicationContext.getSystemService(android.media.AudioManager::class.java)
            am?.mode = android.media.AudioManager.MODE_NORMAL
            am?.isSpeakerphoneOn = true
            android.util.Log.d("NIVARA", "prepareAudioForPlayback: forced speaker mode for playback")
        } catch (e: Exception) {
            android.util.Log.e("NIVARA", "prepareAudioForPlayback error: ${e.message}")
        }
    }
    @ReactMethod fun setAppForeground(isForeground: Boolean) { 
        NivaraBackgroundService.isAppInForeground = isForeground
        android.util.Log.d("NIVARA", "setAppForeground: $isForeground, isAppInForeground=${NivaraBackgroundService.isAppInForeground}")
    }
    @ReactMethod fun getAndClearPendingSOS(promise: Promise) { promise.resolve(pendingSOS); pendingSOS = false }

    @ReactMethod fun stopBackgroundRecording(promise: Promise) {
        android.util.Log.d("NIVARA", "stopBackgroundRecording CALLED FROM JS")
        try {
            val filePath = NivaraBackgroundService.stopRecordingSafe()
            android.util.Log.d("NIVARA", "stopBackgroundRecording: filePath=$filePath")
            promise.resolve(filePath)
        } catch (e: Exception) {
            android.util.Log.e("NIVARA", "stopBackgroundRecording exception: ${e.message}")
            promise.resolve(NivaraBackgroundService.recordingFilePath)
        }
    }
    @ReactMethod fun isBackgroundRecording(promise: Promise) { promise.resolve(NivaraBackgroundService.isRecording) }
    @ReactMethod fun getRecordingPath(promise: Promise) { promise.resolve(NivaraBackgroundService.recordingFilePath) }
    @ReactMethod fun removeListeners(count: Int) { try { sosReceiver?.let { reactApplicationContext.unregisterReceiver(it) } } catch (e: Exception) {}; sosReceiver = null }
    @ReactMethod fun updatePhrases(phrases: com.facebook.react.bridge.ReadableArray, promise: Promise) {
        try {
            val list = ArrayList<String>()
            for (i in 0 until phrases.size()) { list.add(phrases.getString(i) ?: "") }
            val intent = Intent(reactApplicationContext, NivaraBackgroundService::class.java).apply {
                action = NivaraBackgroundService.ACTION_UPDATE_PHRASES
                putStringArrayListExtra(NivaraBackgroundService.EXTRA_PHRASES, list)
            }
            reactApplicationContext.startService(intent)
            promise.resolve(true)
        } catch (e: Exception) { promise.reject("ERROR", e.message ?: "Unknown error") }
    }
}