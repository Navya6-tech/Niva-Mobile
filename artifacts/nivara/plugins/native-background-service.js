
const { withAndroidManifest, withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const BACKGROUND_SERVICE = `package com.nivara.safety

import android.app.*
import android.content.*
import android.hardware.*
import android.media.*
import android.os.*
import androidx.core.app.NotificationCompat
import kotlin.math.abs
import kotlin.math.sqrt

class NivaraBackgroundService : Service(), SensorEventListener {
    companion object {
        const val CHANNEL_ID = "nivara-protection-channel"
        const val NOTIF_ID = 1001
        const val ACTION_START = "START_PROTECTION"
        const val ACTION_STOP = "STOP_PROTECTION"
        const val ACTION_SOS = "com.nivara.safety.SOS_TRIGGERED"
        const val EXTRA_SOURCE = "source"
        private const val SHAKE_THRESHOLD = 12.0f
        private const val SHAKE_COUNT_NEEDED = 3
        private const val SHAKE_WINDOW_MS = 2000L
        private const val SHAKE_COOLDOWN_MS = 100L
        private const val SAMPLE_RATE = 44100
        private const val LOUD_THRESHOLD = 8000
        private const val SUSTAINED_MS = 1500L
    }
    private lateinit var sensorManager: SensorManager
    private var accelerometer: Sensor? = null
    private var shakeCount = 0; private var shakeWindowStart = 0L; private var lastShakeTime = 0L
    private var lastX = 0f; private var lastY = 0f; private var lastZ = 0f; private var firstReading = true
    private var audioRecord: AudioRecord? = null; private var voiceThread: Thread? = null
    private var voiceActive = false; private var loudStart = 0L
    private var wakeLock: PowerManager.WakeLock? = null

    override fun onCreate() {
        super.onCreate()
        sensorManager = getSystemService(Context.SENSOR_SERVICE) as SensorManager
        accelerometer = sensorManager.getDefaultSensor(Sensor.TYPE_ACCELEROMETER)
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (intent?.action == ACTION_STOP) { stopSelf(); return START_NOT_STICKY }
        startProtection(); return START_STICKY
    }

    private fun startProtection() {
        createNotificationChannel(); startForeground(NOTIF_ID, buildNotification())
        val pm = getSystemService(Context.POWER_SERVICE) as PowerManager
        wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "nivara:protection"); wakeLock?.acquire()
        accelerometer?.let { sensorManager.registerListener(this, it, SensorManager.SENSOR_DELAY_GAME) }
        startVoiceDetection()
    }

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

    private fun startVoiceDetection() {
        val bufSize = AudioRecord.getMinBufferSize(SAMPLE_RATE, AudioFormat.CHANNEL_IN_MONO, AudioFormat.ENCODING_PCM_16BIT)
        try {
            audioRecord = AudioRecord(MediaRecorder.AudioSource.MIC, SAMPLE_RATE, AudioFormat.CHANNEL_IN_MONO, AudioFormat.ENCODING_PCM_16BIT, bufSize * 4)
            audioRecord?.startRecording(); voiceActive = true
            voiceThread = Thread {
                val buf = ShortArray(bufSize); loudStart = 0L
                while (voiceActive) {
                    val read = audioRecord?.read(buf, 0, buf.size) ?: 0
                    if (read > 0) {
                        var max = 0
                        for (i in 0 until read) { val v = abs(buf[i].toInt()); if (v > max) max = v }
                        val now = System.currentTimeMillis()
                        if (max > LOUD_THRESHOLD) {
                            if (loudStart == 0L) loudStart = now
                            else if (now - loudStart >= SUSTAINED_MS) { loudStart = 0L; triggerSOS("voice") }
                        } else loudStart = 0L
                    }
                }
            }; voiceThread?.start()
        } catch (e: Exception) { e.printStackTrace() }
    }

    private fun stopVoiceDetection() {
        voiceActive = false
        try { audioRecord?.stop(); audioRecord?.release() } catch (e: Exception) {}
        audioRecord = null; voiceThread?.interrupt(); voiceThread = null
    }

    private var lastSosTrigger = 0L
    private fun triggerSOS(source: String) {
        val now = System.currentTimeMillis()
        if (now - lastSosTrigger < 5000) return; lastSosTrigger = now
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
        .setContentText("Shake 3x or shout to trigger SOS")
        .setSmallIcon(R.mipmap.ic_launcher)
        .setContentIntent(PendingIntent.getActivity(this, 0, packageManager.getLaunchIntentForPackage(packageName), PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE))
        .setOngoing(true).setPriority(NotificationCompat.PRIORITY_LOW).setSilent(true).build()

    override fun onDestroy() { sensorManager.unregisterListener(this); stopVoiceDetection(); wakeLock?.release(); super.onDestroy() }
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
        } catch (e: Exception) { promise.reject("ERROR", e.message) }
    }
    @ReactMethod fun stopService(promise: Promise) {
        try {
            reactApplicationContext.startService(Intent(reactApplicationContext, NivaraBackgroundService::class.java).apply { action = NivaraBackgroundService.ACTION_STOP })
            promise.resolve(true)
        } catch (e: Exception) { promise.reject("ERROR", e.message) }
    }
    @ReactMethod fun addListener(eventName: String) {
        if (eventName == "SOSTriggered" && sosReceiver == null) {
            sosReceiver = object : BroadcastReceiver() {
                override fun onReceive(context: Context, intent: Intent) {
                    val params = Arguments.createMap().apply { putString("source", intent.getStringExtra(NivaraBackgroundService.EXTRA_SOURCE) ?: "unknown") }
                    reactApplicationContext.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java).emit("SOSTriggered", params)
                }
            }
            val filter = IntentFilter(NivaraBackgroundService.ACTION_SOS)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) reactApplicationContext.registerReceiver(sosReceiver, filter, Context.RECEIVER_NOT_EXPORTED)
            else reactApplicationContext.registerReceiver(sosReceiver, filter)
        }
    }
    @ReactMethod fun removeListeners(count: Int) { try { sosReceiver?.let { reactApplicationContext.unregisterReceiver(it) } } catch (e: Exception) {}; sosReceiver = null }
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
    fs.writeFileSync(path.join(javaDir, 'NivaraBackgroundService.kt'), BACKGROUND_SERVICE);
    fs.writeFileSync(path.join(javaDir, 'BootReceiver.kt'), BOOT_RECEIVER);
    fs.writeFileSync(path.join(javaDir, 'NivaraServiceModule.kt'), SERVICE_MODULE);
    fs.writeFileSync(path.join(javaDir, 'NivaraServicePackage.kt'), SERVICE_PACKAGE);
    const mainAppPath = path.join(javaDir, 'MainApplication.kt');
    if (fs.existsSync(mainAppPath)) {
      let content = fs.readFileSync(mainAppPath, 'utf8');
      if (!content.includes('NivaraServicePackage')) {
        content = content.replace('add(DirectSmsPackage())', 'add(DirectSmsPackage())\n              add(NivaraServicePackage())');
        fs.writeFileSync(mainAppPath, content);
      }
    }
    return config;
  }]);

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
