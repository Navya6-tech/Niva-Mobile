package com.nivara.safety

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
        var isAppInForeground = false
        var recordingFilePath: String? = null
        var isRecording = false
        var isSosRecording = false
        var staticMediaRecorder: MediaRecorder? = null
        var staticAudioFocusRequest: Any? = null
        fun stopRecordingSafe(): String? {
            val wasRecording = isRecording
            val result = try {
                staticMediaRecorder?.stop()
                staticMediaRecorder?.release()
                staticMediaRecorder = null
                isRecording = false
                recordingFilePath
            } catch (e: Exception) {
                android.util.Log.e("NIVARA", "stopRecordingSafe error: ${e.message}")
                staticMediaRecorder?.release()
                staticMediaRecorder = null
                isRecording = false
                null
            }
            // Only return the path if we were actually recording AND the file has real content
            if (!wasRecording || result == null) {
                android.util.Log.e("NIVARA", "stopRecordingSafe: no valid recording was in progress")
                return null
            }
            val f = java.io.File(result)
            if (!f.exists() || f.length() < 1000) {
                android.util.Log.e("NIVARA", "stopRecordingSafe: file invalid or too small, size=${if (f.exists()) f.length() else -1}")
                return null
            }
            // Release audio focus and reset audio mode so playback works normally afterward
            try {
                val ctx = instance?.applicationContext
                val am = ctx?.getSystemService(android.media.AudioManager::class.java)
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && staticAudioFocusRequest is android.media.AudioFocusRequest) {
                    am?.abandonAudioFocusRequest(staticAudioFocusRequest as android.media.AudioFocusRequest)
                }
                staticAudioFocusRequest = null
                am?.mode = android.media.AudioManager.MODE_NORMAL
                am?.isSpeakerphoneOn = false
            } catch (e: Exception) {
                android.util.Log.e("NIVARA", "audio focus release error: ${e.message}")
            }
            android.util.Log.d("NIVARA", "stopRecordingSafe: finalized recording, path=$result, size=${f.length()}")
            return result
        }
        var audioRecordingEnabled = false
        var voiceTriggerEnabled = false
        var shakeTriggerEnabled = true
        var instance: NivaraBackgroundService? = null
        fun stopRecordingStatic(): String? {
            return instance?.stopBackgroundRecording()
        }
        private const val SHAKE_WINDOW_MS = 2000L
        private const val SHAKE_COOLDOWN_MS = 100L
    }

    // Shake
    private lateinit var sensorManager: SensorManager
    private var accelerometer: Sensor? = null
    private var shakeCount = 0; private var shakeWindowStart = 0L; private var lastShakeTime = 0L
    private var mediaRecorder: MediaRecorder? = null
    private var lastX = 0f; private var lastY = 0f; private var lastZ = 0f; private var firstReading = true

    // Speech recognition
    private var speechRecognizer: SpeechRecognizer? = null
    private var triggerPhrases = mutableListOf("help me", "stop", "bachao")
    private var isListening = false
    private val restartHandler = Handler(Looper.getMainLooper())
    private val recordingHandler = Handler(Looper.getMainLooper())
    private val restartRunnable = Runnable { startSpeechRecognition() }
    private val notifWatchdogHandler = Handler(Looper.getMainLooper())
    private val notifWatchdogRunnable: Runnable = object : Runnable {
        override fun run() {
            try {
                val nm = getSystemService(NotificationManager::class.java)
                val stillPosted = nm?.activeNotifications?.any { it.id == NOTIF_ID } ?: false
                if (!stillPosted) {
                    android.util.Log.d("NIVARA", "Protection notification missing - reposting")
                    startForeground(NOTIF_ID, buildNotification())
                }
            } catch (e: Exception) {
                android.util.Log.e("NIVARA", "notifWatchdog error: ${e.message}")
            }
            notifWatchdogHandler.postDelayed(this, 5000)
        }
    }

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
        instance = this
        // Load persisted settings from SharedPreferences
        val prefs = getSharedPreferences("nivara_prefs", android.content.Context.MODE_PRIVATE)
        createNotificationChannel()
        // Android REQUIRES startForeground() to be called promptly whenever the service is
        // started via startForegroundService() - skipping it crashes the whole app with
        // ForegroundServiceDidNotStartInTimeException. So this always runs first, then we
        // stop immediately right after if onboarding isn't actually done yet, instead of
        // skipping the call entirely.
        try {
            if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.Q) {
                val hasMic = androidx.core.content.ContextCompat.checkSelfPermission(this, android.Manifest.permission.RECORD_AUDIO) == android.content.pm.PackageManager.PERMISSION_GRANTED
                val hasLocation = androidx.core.content.ContextCompat.checkSelfPermission(this, android.Manifest.permission.ACCESS_FINE_LOCATION) == android.content.pm.PackageManager.PERMISSION_GRANTED
                var type = 0
                if (hasMic) type = type or android.content.pm.ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE
                if (hasLocation) type = type or android.content.pm.ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION
                if (type == 0) type = android.content.pm.ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION
                startForeground(NOTIF_ID, buildNotification(), type)
            } else {
                startForeground(NOTIF_ID, buildNotification())
            }
        } catch (e: Exception) {
            android.util.Log.e("NIVARA", "startForeground FAILED: ${e.message}")
        }
        // Never keep running (or leave the notification up) while the user is still going
        // through onboarding - this protects against the OS auto-restarting this service
        // (e.g. via our AlarmManager restart safety net) before permissions are granted.
        if (!prefs.getBoolean("onboardingComplete", false)) {
            android.util.Log.d("NIVARA", "startProtection - onboarding not complete, stopping immediately")
            try { stopForeground(STOP_FOREGROUND_REMOVE) } catch (e: Exception) {}
            stopSelf()
            return
        }
        audioRecordingEnabled = prefs.getBoolean("audioRecording", false)
        shakeTriggerEnabled = prefs.getBoolean("shakeTrigger", true)
        val phonesStr = prefs.getString("phones", "")
        if (!phonesStr.isNullOrEmpty()) {
            NivaraServiceModule.emergencyPhones = phonesStr.split(",").filter { it.isNotEmpty() }
        }
        android.util.Log.d("NIVARA", "Service started - audioRecording=$audioRecordingEnabled, phones=${NivaraServiceModule.emergencyPhones.size}")
        notifWatchdogHandler.removeCallbacks(notifWatchdogRunnable)
        notifWatchdogHandler.postDelayed(notifWatchdogRunnable, 5000)
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
            if (shakeCount >= SHAKE_COUNT_NEEDED) { shakeCount = 0; shakeWindowStart = 0; if (shakeTriggerEnabled) triggerSOS("shake") }
        }
    }
    override fun onAccuracyChanged(sensor: Sensor?, accuracy: Int) {}

    // ── Speech Recognition ────────────────────────────────────────
    private fun startSpeechRecognition() {
        if (!voiceTriggerEnabled) return
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
        if (!isSosRecording) restartHandler.postDelayed(restartRunnable, 300)
    }

    override fun onPartialResults(partialResults: Bundle?) {
        val matches = partialResults?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)
        matches?.forEach { checkTranscript(it) }
    }

    override fun onError(error: Int) {
        isListening = false
        val delay = if (error == SpeechRecognizer.ERROR_NO_MATCH || error == SpeechRecognizer.ERROR_SPEECH_TIMEOUT) 300L else 1500L
        if (!isSosRecording) restartHandler.postDelayed(restartRunnable, delay)
    }

    override fun onEndOfSpeech() { isListening = false }
    override fun onBeginningOfSpeech() {}
    override fun onRmsChanged(rmsdB: Float) {}
    override fun onBufferReceived(buffer: ByteArray?) {}
    override fun onReadyForSpeech(params: Bundle?) {}
    override fun onEvent(eventType: Int, params: Bundle?) {}

    // ── SOS trigger ───────────────────────────────────────────────
    private var lastSosTrigger = 0L
    private fun startBackgroundRecording() {
        android.util.Log.d("NIVARA", "startBackgroundRecording called, isSosRecording=$isSosRecording")
        // Stop speech recognition on main thread to release mic
        android.os.Handler(android.os.Looper.getMainLooper()).post {
            restartHandler.removeCallbacks(restartRunnable)
            speechRecognizer?.stopListening()
            isListening = false
        }
        Thread {
            android.util.Log.d("NIVARA", "Recording thread started")
            Thread.sleep(2000) // Wait for mic to release
            try {
                val dir = getExternalFilesDir(null) ?: filesDir
                val file = java.io.File(dir, "sos_recording_${System.currentTimeMillis()}.m4a")
                val audioManager = getSystemService(android.media.AudioManager::class.java)
                // No audio focus request needed - speech recognizer already released the mic above
                mediaRecorder = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                    MediaRecorder(this)
                } else {
                    @Suppress("DEPRECATION")
                    MediaRecorder()
                }
                staticMediaRecorder = mediaRecorder
                mediaRecorder?.apply {
                    setAudioSource(MediaRecorder.AudioSource.VOICE_RECOGNITION)
                    setOutputFormat(MediaRecorder.OutputFormat.MPEG_4)
                    setAudioEncoder(MediaRecorder.AudioEncoder.AAC)
                    setAudioSamplingRate(44100)
                    setAudioEncodingBitRate(128000)
                    setOutputFile(file.absolutePath)
                    prepare()
                    start()
                }
                recordingFilePath = file.absolutePath
                isRecording = true
                android.util.Log.d("NIVARA", "Background recording started: ${file.absolutePath}")
            } catch (e: Exception) {
                android.util.Log.e("NIVARA", "Background recording FAILED: ${e.message}")
                mediaRecorder = null
                isRecording = false
            }
        }.start()
    }
    fun stopBackgroundRecording(): String? {
        isSosRecording = false
        val path = try {
            mediaRecorder?.stop()
            mediaRecorder?.release()
            mediaRecorder = null
            isRecording = false
            recordingFilePath
        } catch (e: Exception) {
            mediaRecorder?.release()
            mediaRecorder = null
            isRecording = false
            null
        }
        // Restart speech recognition after recording stops
        if (voiceTriggerEnabled) {
            android.os.Handler(android.os.Looper.getMainLooper()).postDelayed({
                startSpeechRecognition()
            }, 500)
        }
        return path
    }
    private fun sendEmergencySMS(phones: List<String>, message: String) {
        try {
            val subId = android.telephony.SubscriptionManager.getDefaultSmsSubscriptionId()
            android.util.Log.d("NIVARA", "SMS using subId=$subId")
            val smsManager = if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.S) {
                if (subId != android.telephony.SubscriptionManager.INVALID_SUBSCRIPTION_ID) {
                    applicationContext.getSystemService(android.telephony.SmsManager::class.java)
                        ?.createForSubscriptionId(subId)
                        ?: applicationContext.getSystemService(android.telephony.SmsManager::class.java)
                } else {
                    applicationContext.getSystemService(android.telephony.SmsManager::class.java)
                }
            } else {
                @Suppress("DEPRECATION")
                if (subId != android.telephony.SubscriptionManager.INVALID_SUBSCRIPTION_ID) {
                    android.telephony.SmsManager.getSmsManagerForSubscriptionId(subId)
                } else {
                    android.telephony.SmsManager.getDefault()
                }
            }
            for (phone in phones) {
                try {
                    if (message.length > 160) {
                        val parts = smsManager.divideMessage(message)
                        smsManager.sendMultipartTextMessage(phone, null, parts, null, null)
                    } else {
                        smsManager.sendTextMessage(phone, null, message, null, null)
                    }
                    android.util.Log.d("NIVARA", "SMS sent to $phone")
                } catch (e: Exception) {
                    android.util.Log.e("NIVARA", "SMS failed to $phone: ${e.message}")
                }
            }
        } catch (e: Exception) {
            android.util.Log.e("NIVARA", "SMS error: ${e.message}")
        }
    }
    fun triggerSOSPublic(source: String) { triggerSOS(source) }
    fun resetLastSosTrigger() { lastSosTrigger = 0L }
    private fun triggerSOS(source: String) {
        android.util.Log.d("NIVARA", "triggerSOS ENTRY source=$source lastTrigger=$lastSosTrigger")
        val now = System.currentTimeMillis()
        if (now - lastSosTrigger < 5000) { android.util.Log.d("NIVARA", "triggerSOS BLOCKED by cooldown"); return }
        lastSosTrigger = now
        sendBroadcast(Intent(ACTION_SOS).apply { putExtra(EXTRA_SOURCE, source); setPackage(packageName) })
        android.util.Log.d("NIVARA", "triggerSOS called, source=$source, audioRecording=$audioRecordingEnabled, voiceTrigger=$voiceTriggerEnabled, phones=${NivaraServiceModule.emergencyPhones.size}")
        isSosRecording = true
        NivaraServiceModule.pendingSOS = true
        if (audioRecordingEnabled) startBackgroundRecording()
        // SMS is now handled by JS via the SOSTriggered broadcast listener (more reliable, avoids duplicate/conflicting sends)
        val launchIntent = packageManager.getLaunchIntentForPackage(packageName)?.apply {
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP)
            putExtra("sos_triggered", true)
        }
        // Android 14+ requires full-screen intent notification to launch from background.
        // Only needed when the app is NOT already visible - if it is in foreground, the SOS screen
        // will already open via the broadcast listener, so skip the alert popup entirely.
        if (!isAppInForeground) {
            try {
                val sosChannelId = "nivara_sos_alert"
                if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
                    val sosChannel = android.app.NotificationChannel(sosChannelId, "SOS Alert", android.app.NotificationManager.IMPORTANCE_HIGH)
                    sosChannel.description = "Emergency SOS alerts"
                    getSystemService(android.app.NotificationManager::class.java).createNotificationChannel(sosChannel)
                }
                val pendingIntent = PendingIntent.getActivity(this, 2, launchIntent ?: Intent(), PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
                val sosAlert = NotificationCompat.Builder(this, sosChannelId)
                    .setSmallIcon(android.R.drawable.ic_dialog_alert)
                    .setContentTitle("🚨 SOS Activated")
                    .setContentText("Emergency triggered")
                    .setPriority(NotificationCompat.PRIORITY_MAX)
                    .setCategory(NotificationCompat.CATEGORY_ALARM)
                    .setFullScreenIntent(pendingIntent, true)
                    .setAutoCancel(true)
                    .setOnlyAlertOnce(false)
                    .build()
                getSystemService(android.app.NotificationManager::class.java).notify(998, sosAlert)
                android.util.Log.d("NIVARA", "SOS alert notification posted successfully")
            } catch (e: Exception) {
                android.util.Log.e("NIVARA", "SOS alert notification FAILED: ${e.message}")
            }
        } else {
            android.util.Log.d("NIVARA", "SOS alert notification skipped - app is in foreground")
        }
        try {
            startActivity(launchIntent)
            android.util.Log.d("NIVARA", "startActivity called for SOS launch")
        } catch (e: Exception) {
            android.util.Log.e("NIVARA", "startActivity FAILED: ${e.message}")
        }
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
        .setOngoing(true).setPriority(NotificationCompat.PRIORITY_LOW).setSilent(true).setCategory(NotificationCompat.CATEGORY_SERVICE).setAutoCancel(false).build()

    override fun onTaskRemoved(rootIntent: Intent?) {
        val restartIntent = android.content.Intent(applicationContext, NivaraBackgroundService::class.java).apply {
            action = ACTION_START
        }
        val pendingIntent = android.app.PendingIntent.getService(applicationContext, 1, restartIntent,
            android.app.PendingIntent.FLAG_ONE_SHOT or android.app.PendingIntent.FLAG_IMMUTABLE)
        val alarmManager = getSystemService(android.app.AlarmManager::class.java)
        alarmManager?.set(android.app.AlarmManager.ELAPSED_REALTIME_WAKEUP,
            android.os.SystemClock.elapsedRealtime() + 1000, pendingIntent)
        super.onTaskRemoved(rootIntent)
    }
    override fun onDestroy() {
        // Finalize any in-progress recording so the file isn't corrupted
        if (isRecording) {
            stopRecordingSafe()
        }
        sensorManager.unregisterListener(this)
        restartHandler.removeCallbacks(restartRunnable)
        notifWatchdogHandler.removeCallbacks(notifWatchdogRunnable)
        speechRecognizer?.destroy()
        speechRecognizer = null
        wakeLock?.release()
        instance = null
        // Restart service when destroyed
        if (isSosRecording) {
            android.util.Log.d("NIVARA", "Service destroyed during SOS - restarting")
        }
        val restartIntent = android.content.Intent(applicationContext, NivaraBackgroundService::class.java).apply {
            action = ACTION_START
        }
        val pendingIntent = android.app.PendingIntent.getService(applicationContext, 1, restartIntent, 
            android.app.PendingIntent.FLAG_ONE_SHOT or android.app.PendingIntent.FLAG_IMMUTABLE)
        val alarmManager = getSystemService(android.app.AlarmManager::class.java)
        alarmManager?.set(android.app.AlarmManager.ELAPSED_REALTIME_WAKEUP,
            android.os.SystemClock.elapsedRealtime() + 1000, pendingIntent)
        super.onDestroy()
    }
    override fun onBind(intent: Intent?): IBinder? = null
}