package com.nivara.safety

import android.accessibilityservice.AccessibilityService
import android.accessibilityservice.AccessibilityServiceInfo
import android.content.Intent
import android.media.AudioFormat
import android.media.AudioRecord
import android.media.MediaRecorder
import android.os.Build
import android.view.accessibility.AccessibilityEvent
import kotlin.math.abs

class NivaraAccessibilityService : AccessibilityService() {

    private var audioRecord: AudioRecord? = null
    private var listeningThread: Thread? = null
    private var isListening = false
    private var triggerPhrases = listOf("help me", "stop", "bachao")
    private var loudStart = 0L
    private val LOUD_THRESHOLD = 8000
    private val SUSTAINED_MS = 1500L
    private val SAMPLE_RATE = 44100
    private var lastTrigger = 0L

    companion object {
        var instance: NivaraAccessibilityService? = null
        var isServiceEnabled = false

        fun updatePhrases(phrases: List<String>) {
            instance?.triggerPhrases = phrases
        }
    }

    override fun onServiceConnected() {
        super.onServiceConnected()
        instance = this
        isServiceEnabled = true
        val info = AccessibilityServiceInfo().apply {
            eventTypes = AccessibilityEvent.TYPES_ALL_MASK
            feedbackType = AccessibilityServiceInfo.FEEDBACK_GENERIC
            flags = AccessibilityServiceInfo.FLAG_REQUEST_FILTER_KEY_EVENTS
            notificationTimeout = 100
        }
        serviceInfo = info
        startAudioListening()
    }

    private fun startAudioListening() {
        val bufSize = AudioRecord.getMinBufferSize(
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
                bufSize * 4
            )
            audioRecord?.startRecording()
            isListening = true
            listeningThread = Thread {
                val buffer = ShortArray(bufSize)
                loudStart = 0L
                while (isListening) {
                    val read = audioRecord?.read(buffer, 0, buffer.size) ?: 0
                    if (read > 0) {
                        var max = 0
                        for (i in 0 until read) {
                            val v = abs(buffer[i].toInt())
                            if (v > max) max = v
                        }
                        val now = System.currentTimeMillis()
                        if (max > LOUD_THRESHOLD) {
                            if (loudStart == 0L) loudStart = now
                            else if (now - loudStart >= SUSTAINED_MS) {
                                loudStart = 0L
                                triggerSOS()
                            }
                        } else {
                            loudStart = 0L
                        }
                    }
                }
            }
            listeningThread?.start()
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    private fun triggerSOS() {
        val now = System.currentTimeMillis()
        if (now - lastTrigger < 5000) return
        lastTrigger = now
        val intent = Intent(this, NivaraBackgroundService::class.java).apply {
            action = NivaraBackgroundService.ACTION_SOS
        }
        val broadcastIntent = Intent(NivaraBackgroundService.ACTION_SOS).apply {
            putExtra(NivaraBackgroundService.EXTRA_SOURCE, "voice")
            setPackage(packageName)
        }
        sendBroadcast(broadcastIntent)
        packageManager.getLaunchIntentForPackage(packageName)?.apply {
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP)
            putExtra("sos_source", "voice")
        }?.let { startActivity(it) }
    }

    override fun onAccessibilityEvent(event: AccessibilityEvent?) {}
    override fun onInterrupt() {}

    override fun onDestroy() {
        instance = null
        isServiceEnabled = false
        isListening = false
        try { audioRecord?.stop(); audioRecord?.release() } catch (e: Exception) {}
        audioRecord = null
        listeningThread?.interrupt()
        listeningThread = null
        super.onDestroy()
    }
}
