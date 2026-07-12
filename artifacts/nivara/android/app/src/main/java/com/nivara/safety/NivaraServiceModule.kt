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
        if (lat != 0.0 && lng != 0.0) {
            val loc = android.location.Location("manual")
            loc.latitude = lat
            loc.longitude = lng
            lastKnownLocation = loc
        }
    }
    @ReactMethod fun setAudioRecordingEnabled(enabled: Boolean) { NivaraBackgroundService.audioRecordingEnabled = enabled }
    @ReactMethod fun setVoiceTriggerEnabled(enabled: Boolean) { 
        NivaraBackgroundService.voiceTriggerEnabled = enabled
        android.util.Log.d("NIVARA", "voiceTriggerEnabled: $enabled")
    }
    @ReactMethod fun setAppForeground(isForeground: Boolean) { 
        NivaraBackgroundService.isAppInForeground = isForeground
        android.util.Log.d("NIVARA", "setAppForeground: $isForeground, isAppInForeground=${NivaraBackgroundService.isAppInForeground}")
    }
    @ReactMethod fun getAndClearPendingSOS(promise: Promise) { promise.resolve(pendingSOS); pendingSOS = false }

    @ReactMethod fun stopBackgroundRecording(promise: Promise) {
        try {
            val filePath = NivaraBackgroundService.stopRecordingStatic() ?: NivaraBackgroundService.recordingFilePath
            promise.resolve(filePath)
        } catch (e: Exception) {
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