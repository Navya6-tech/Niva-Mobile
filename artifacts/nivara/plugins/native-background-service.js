
const { withAndroidManifest, withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const BACKGROUND_SERVICE = `package com.nivara.safety

import android.app.*
import android.content.*
import android.hardware.*
import android.media.*
import android.os.*
import android.speech.*
import androidx.core.app.NotificationCompat
import kotlin.math.abs
import kotlin.math.sqrt

class NivaraBackgroundService : Service(), SensorEventListener, RecognitionListener {
    companion object {
        const val CHANNEL_ID = "nivara-protection-channel"
        const val NOTIF_ID = 1001
        const val ACTION_START = "START_PROTECTION"
        const val ACTION_STOP = "STOP_PROTECTION"
        const val ACTION_SOS = "com.nivara.safety.SOS_TRIGGERED"
        const val EXTRA_SOURCE = "source"
        const val ACTION_UPDATE_PHRASES = "UPDATE_PHRASES"
        const val EXTRA_PHRASES = "phrases"
        private const val SHAKE_THRESHOLD = 12.0f
        private const val SHAKE_COUNT_NEEDED = 3
        private const val SHAKE_WINDOW_MS = 2000L
        private const val SHAKE_COOLDOWN_MS = 100L
    }

    // Shake
    private lateinit var sensorManager: SensorManager
    private var accelerometer: Sensor? = null
    private var shakeCount = 0; private var shakeWindowStart = 0L; private var lastShakeTime = 0L
    private var lastX = 0f; private var lastY = 0f; private var lastZ = 0f; private var firstReading = true

    // Speech recognition
    private var speechRecognizer: SpeechRecognizer? = null
    private var triggerPhrases = mutableListOf("help me", "stop", "bachao")
    private var isListening = false
    private val restartHandler = Handler(Looper.getMainLooper())
    private val restartRunnable = Runnable { startSpeechRecognition() }

    // Wake lock
    private var wakeLock: PowerManager.WakeLock? = null

    override fun onCreate() {
        super.onCreate()
        sensorManager = getSystemService(Context.SENSOR_SERVICE) as SensorManager
        accelerometer = sensorManager.getDefaultSensor(Sensor.TYPE_ACCELEROMETER)
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_STOP -> { stopSelf(); return START_NOT_STICKY }
            ACTION_UPDATE_PHRASES -> {
                val phrases = intent.getStringArrayListExtra(EXTRA_PHRASES)
                if (phrases != null) { triggerPhrases = phrases }
            }
            else -> startProtection()
        }
        return START_STICKY
    }

    private fun startProtection() {
        createNotificationChannel()
        startForeground(NOTIF_ID, buildNotification())
        val pm = getSystemService(Context.POWER_SERVICE) as PowerManager
        wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "nivara:protection")
        wakeLock?.acquire()
        accelerometer?.let { sensorManager.registerListener(this, it, SensorManager.SENSOR_DELAY_GAME) }
        startSpeechRecognition()
    }

    // ── Shake ─────────────────────────────────────────────────────
    override fun onSensorChanged(event: SensorEvent) {
        if (event.sensor.type != Sensor.TYPE_ACCELEROMETER) return
        val x = event.values[0]; val y = event.values[1]; val z = event.values[2]
        if (firstReading) { lastX = x; lastY = y; lastZ = z; firstReading = false; return }
        val delta = sqrt(((x-lastX)*(x-lastX) + (y-lastY)*(y-lastY) + (z-lastZ)*(z-lastZ)).toDouble()).toFloat()
        lastX = x; lastY = y; lastZ = z
        val now = System.currentTimeMillis()
        if (delta > SHAKE_THRESHOLD && now - lastShakeTime > SHAKE_COOLDOWN_MS) {
            lastShakeTime = now
            if (now - shakeWindowStart > SHAKE_WINDOW_MS) { shakeWindowStart = now; shakeCount = 0 }
            shakeCount++
            if (shakeCount >= SHAKE_COUNT_NEEDED) { shakeCount = 0; shakeWindowStart = 0; triggerSOS("shake") }
        }
    }
    override fun onAccuracyChanged(sensor: Sensor?, accuracy: Int) {}

    // ── Speech Recognition ────────────────────────────────────────
    private fun startSpeechRecognition() {
        if (!SpeechRecognizer.isRecognitionAvailable(this)) return
        restartHandler.removeCallbacks(restartRunnable)
        
        // Destroy old instance
        speechRecognizer?.destroy()
        speechRecognizer = null
        isListening = false

        Handler(Looper.getMainLooper()).post {
            speechRecognizer = SpeechRecognizer.createSpeechRecognizer(this)
            speechRecognizer?.setRecognitionListener(this)
            
            val intent = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
                putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
                putExtra(RecognizerIntent.EXTRA_LANGUAGE, "hi-IN")
                putExtra(RecognizerIntent.EXTRA_LANGUAGE_PREFERENCE, "hi-IN")
                putExtra(RecognizerIntent.EXTRA_ONLY_RETURN_LANGUAGE_PREFERENCE, false)
                putExtra(RecognizerIntent.EXTRA_CALLING_PACKAGE, packageName)
                putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true)
                putExtra(RecognizerIntent.EXTRA_SPEECH_INPUT_MINIMUM_LENGTH_MILLIS, 1000L)
                putExtra(RecognizerIntent.EXTRA_SPEECH_INPUT_COMPLETE_SILENCE_LENGTH_MILLIS, 2000L)
                putExtra(RecognizerIntent.EXTRA_SPEECH_INPUT_POSSIBLY_COMPLETE_SILENCE_LENGTH_MILLIS, 1500L)
                putExtra("android.speech.extra.EXTRA_ADDITIONAL_LANGUAGES", arrayOf("en-IN", "en-US"))
            }
            speechRecognizer?.startListening(intent)
            isListening = true
        }
    }

    private fun checkTranscript(text: String) {
        val t = text.lowercase().trim()
        val matched = triggerPhrases.any { phrase -> t.contains(phrase.lowercase().trim()) }
        if (matched) triggerSOS("voice")
    }

    // RecognitionListener callbacks
    override fun onResults(results: Bundle?) {
        val matches = results?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)
        matches?.forEach { checkTranscript(it) }
        isListening = false
        restartHandler.postDelayed(restartRunnable, 300)
    }

    override fun onPartialResults(partialResults: Bundle?) {
        val matches = partialResults?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)
        matches?.forEach { checkTranscript(it) }
    }

    override fun onError(error: Int) {
        isListening = false
        val delay = if (error == SpeechRecognizer.ERROR_NO_MATCH || error == SpeechRecognizer.ERROR_SPEECH_TIMEOUT) 300L else 1500L
        restartHandler.postDelayed(restartRunnable, delay)
    }

    override fun onEndOfSpeech() { isListening = false }
    override fun onBeginningOfSpeech() {}
    override fun onRmsChanged(rmsdB: Float) {}
    override fun onBufferReceived(buffer: ByteArray?) {}
    override fun onReadyForSpeech(params: Bundle?) {}
    override fun onEvent(eventType: Int, params: Bundle?) {}

    // ── SOS trigger ───────────────────────────────────────────────
    private var lastSosTrigger = 0L
    private fun triggerSOS(source: String) {
        val now = System.currentTimeMillis()
        if (now - lastSosTrigger < 5000) return
        lastSosTrigger = now
        sendBroadcast(Intent(ACTION_SOS).apply { putExtra(EXTRA_SOURCE, source); setPackage(packageName) })
        packageManager.getLaunchIntentForPackage(packageName)?.apply {
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP)
            putExtra("sos_source", source)
        }?.let { startActivity(it) }
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val ch = NotificationChannel(CHANNEL_ID, "Background Protection", NotificationManager.IMPORTANCE_LOW)
            ch.setShowBadge(false); ch.enableVibration(false); ch.setSound(null, null)
            getSystemService(NotificationManager::class.java).createNotificationChannel(ch)
        }
    }

    private fun buildNotification() = NotificationCompat.Builder(this, CHANNEL_ID)
        .setContentTitle("NIVARA is protecting you")
        .setContentText("Shake 3x or say your trigger phrase to activate SOS")
        .setSmallIcon(R.mipmap.ic_launcher)
        .setContentIntent(PendingIntent.getActivity(this, 0, packageManager.getLaunchIntentForPackage(packageName), PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE))
        .setOngoing(true).setPriority(NotificationCompat.PRIORITY_LOW).setSilent(true).build()

    override fun onDestroy() {
        sensorManager.unregisterListener(this)
        restartHandler.removeCallbacks(restartRunnable)
        speechRecognizer?.destroy()
        speechRecognizer = null
        wakeLock?.release()
        super.onDestroy()
    }
    override fun onBind(intent: Intent?): IBinder? = null
}`;

const BOOT_RECEIVER = `package com.nivara.safety
import android.content.*; import android.os.Build
class BootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action == Intent.ACTION_BOOT_COMPLETED || intent.action == "android.intent.action.QUICKBOOT_POWERON") {
            val i = Intent(context, NivaraBackgroundService::class.java).apply { action = NivaraBackgroundService.ACTION_START }
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) context.startForegroundService(i) else context.startService(i)
        }
    }
}`;

const SERVICE_MODULE = `package com.nivara.safety
import android.content.*; import android.os.Build
import com.facebook.react.bridge.*
import com.facebook.react.modules.core.DeviceEventManagerModule
class NivaraServiceModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {
    override fun getName() = "NivaraService"
    private var sosReceiver: BroadcastReceiver? = null
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
}`;

const SERVICE_PACKAGE = `package com.nivara.safety
import com.facebook.react.ReactPackage; import com.facebook.react.bridge.*; import com.facebook.react.uimanager.ViewManager
class NivaraServicePackage : ReactPackage {
    override fun createNativeModules(ctx: ReactApplicationContext): List<NativeModule> = listOf(NivaraServiceModule(ctx))
    override fun createViewManagers(ctx: ReactApplicationContext): List<ViewManager<*, *>> = emptyList()
}`;

function withNativeBackgroundService(config) {
  config = withDangerousMod(config, ['android', async (config) => {
    const javaDir = path.join(config.modRequest.platformProjectRoot, 'app/src/main/java/com/nivara/safety');
    fs.mkdirSync(javaDir, { recursive: true });
    fs.mkdirSync(javaDir, { recursive: true });
    fs.writeFileSync(path.join(javaDir, 'NivaraBackgroundService.kt'), BACKGROUND_SERVICE);
    fs.writeFileSync(path.join(javaDir, 'BootReceiver.kt'), BOOT_RECEIVER);
    fs.writeFileSync(path.join(javaDir, 'NivaraServiceModule.kt'), SERVICE_MODULE);
    fs.writeFileSync(path.join(javaDir, 'NivaraServicePackage.kt'), SERVICE_PACKAGE);
    // MainApplication.kt is patched separately via withMainApplication
    return config;
  }]);

  config = withMainApplication(config, (config) => {
    const content = config.modResults.contents;
    if (!content.includes('NivaraServicePackage')) {
      config.modResults.contents = content
        .replace(
          'add(DirectSmsPackage())',
          'add(DirectSmsPackage())\n              add(NivaraServicePackage())'
        );
    }
    return config;
  });
  config = withAndroidManifest(config, (config) => {
    const app = config.modResults.manifest.application[0];
    if (!app.service) app.service = [];
    if (!app.service.some(s => s.$['android:name'] === '.NivaraBackgroundService')) {
      app.service.push({ $: { 'android:name': '.NivaraBackgroundService', 'android:enabled': 'true', 'android:exported': 'false', 'android:foregroundServiceType': 'microphone|location', 'android:stopWithTask': 'false' } });
    }
    if (!app.receiver) app.receiver = [];
    if (!app.receiver.some(r => r.$['android:name'] === '.BootReceiver')) {
      app.receiver.push({ $: { 'android:name': '.BootReceiver', 'android:enabled': 'true', 'android:exported': 'true' }, 'intent-filter': [{ action: [{ $: { 'android:name': 'android.intent.action.BOOT_COMPLETED' } }, { $: { 'android:name': 'android.intent.action.QUICKBOOT_POWERON' } }] }] });
    }
    return config;
  });

  return config;
}

module.exports = withNativeBackgroundService;
