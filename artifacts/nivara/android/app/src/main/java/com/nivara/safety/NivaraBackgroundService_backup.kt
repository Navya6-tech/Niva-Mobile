package com.nivara.safety

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
import android.media.AudioFormat
import android.media.AudioRecord
import android.media.MediaRecorder
import android.os.Build
import android.os.IBinder
import android.os.PowerManager
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

        // Shake config
        private const val SHAKE_THRESHOLD = 12.0f
        private const val SHAKE_COUNT_NEEDED = 3
        private const val SHAKE_WINDOW_MS = 2000L
        private const val SHAKE_COOLDOWN_MS = 100L

        // Voice config
        private const val SAMPLE_RATE = 44100
        private const val LOUD_THRESHOLD = 8000  // amplitude out of 32768
        private const val SUSTAINED_MS = 1500L
    }

    // Shake
    private lateinit var sensorManager: SensorManager
    private var accelerometer: Sensor? = null
    private var shakeCount = 0
    private var shakeWindowStart = 0L
    private var lastShakeTime = 0L
    private var lastX = 0f; private var lastY = 0f; private var lastZ = 0f
    private var firstReading = true

    // Voice
    private var audioRecord: AudioRecord? = null
    private var voiceThread: Thread? = null
    private var voiceActive = false
    private var loudStart = 0L

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
            else -> startProtection()
        }
        return START_STICKY
    }

    private fun startProtection() {
        createNotificationChannel()
        startForeground(NOTIF_ID, buildNotification())

        // Wake lock — keeps CPU alive with screen off
        val pm = getSystemService(Context.POWER_SERVICE) as PowerManager
        wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "nivara:protection")
        wakeLock?.acquire()

        // Shake detection
        accelerometer?.let {
            sensorManager.registerListener(this, it, SensorManager.SENSOR_DELAY_GAME)
        }

        // Voice detection
        startVoiceDetection()
    }

    // ── Shake detection ───────────────────────────────────────────
    override fun onSensorChanged(event: SensorEvent) {
        if (event.sensor.type != Sensor.TYPE_ACCELEROMETER) return
        val x = event.values[0]; val y = event.values[1]; val z = event.values[2]

        if (firstReading) { lastX = x; lastY = y; lastZ = z; firstReading = false; return }

        val dx = x - lastX; val dy = y - lastY; val dz = z - lastZ
        val delta = sqrt((dx * dx + dy * dy + dz * dz).toDouble()).toFloat()
        lastX = x; lastY = y; lastZ = z

        val now = System.currentTimeMillis()
        if (delta > SHAKE_THRESHOLD && now - lastShakeTime > SHAKE_COOLDOWN_MS) {
            lastShakeTime = now
            if (now - shakeWindowStart > SHAKE_WINDOW_MS) {
                shakeWindowStart = now
                shakeCount = 0
            }
            shakeCount++
            if (shakeCount >= SHAKE_COUNT_NEEDED) {
                shakeCount = 0
                shakeWindowStart = 0
                triggerSOS("shake")
            }
        }
    }

    override fun onAccuracyChanged(sensor: Sensor?, accuracy: Int) {}

    // ── Voice detection ───────────────────────────────────────────
    private fun startVoiceDetection() {
        val bufferSize = AudioRecord.getMinBufferSize(
            SAMPLE_RATE,
            AudioFormat.CHANNEL_IN_MONO,
            AudioFormat.ENCODING_PCM_16BIT
        )
        try {
            audioRecord = AudioRecord(
                MediaRecorder.AudioSource.MIC,
                SAMPLE_RATE,
                AudioFormat.CHANNEL_IN_MONO,
                AudioFormat.ENCODING_PCM_16BIT,
                bufferSize * 4
            )
            audioRecord?.startRecording()
            voiceActive = true

            voiceThread = Thread {
                val buffer = ShortArray(bufferSize)
                loudStart = 0L
                while (voiceActive) {
                    val read = audioRecord?.read(buffer, 0, buffer.size) ?: 0
                    if (read > 0) {
                        var maxAmplitude = 0
                        for (i in 0 until read) {
                            val v = abs(buffer[i].toInt())
                            if (v > maxAmplitude) maxAmplitude = v
                        }
                        val now = System.currentTimeMillis()
                        if (maxAmplitude > LOUD_THRESHOLD) {
                            if (loudStart == 0L) loudStart = now
                            else if (now - loudStart >= SUSTAINED_MS) {
                                loudStart = 0L
                                triggerSOS("voice")
                            }
                        } else {
                            loudStart = 0L
                        }
                    }
                }
            }
            voiceThread?.start()
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    private fun stopVoiceDetection() {
        voiceActive = false
        try { audioRecord?.stop(); audioRecord?.release() } catch (e: Exception) {}
        audioRecord = null
        voiceThread?.interrupt()
        voiceThread = null
    }

    // ── SOS trigger ───────────────────────────────────────────────
    private var lastSosTrigger = 0L
    private fun triggerSOS(source: String) {
        val now = System.currentTimeMillis()
        if (now - lastSosTrigger < 5000) return  // debounce 5s
        lastSosTrigger = now

        // Broadcast to React Native
        val intent = Intent(ACTION_SOS).apply {
            putExtra(EXTRA_SOURCE, source)
            setPackage(packageName)
        }
        sendBroadcast(intent)

        // Also launch app to foreground
        val launchIntent = packageManager.getLaunchIntentForPackage(packageName)?.apply {
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP)
            putExtra("sos_source", source)
        }
        if (launchIntent != null) startActivity(launchIntent)
    }

    // ── Notification ──────────────────────────────────────────────
    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "Background Protection",
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "NIVARA shake and voice detection"
                setShowBadge(false)
                enableVibration(false)
                setSound(null, null)
            }
            val nm = getSystemService(NotificationManager::class.java)
            nm.createNotificationChannel(channel)
        }
    }

    private fun buildNotification(): Notification {
        val launchIntent = packageManager.getLaunchIntentForPackage(packageName)
        val pi = PendingIntent.getActivity(
            this, 0, launchIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("🛡 NIVARA is protecting you")
            .setContentText("Shake 3× or shout loudly to trigger SOS")
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentIntent(pi)
            .setOngoing(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setSilent(true)
            .build()
    }

    override fun onDestroy() {
        sensorManager.unregisterListener(this)
        stopVoiceDetection()
        wakeLock?.release()
        super.onDestroy()
    }

    override fun onBind(intent: Intent?): IBinder? = null
}
