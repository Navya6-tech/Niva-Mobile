package com.nivara.safety

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.os.Build
import com.facebook.react.bridge.*
import com.facebook.react.modules.core.DeviceEventManagerModule

class NivaraServiceModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName() = "NivaraService"

    private var sosReceiver: BroadcastReceiver? = null

    @ReactMethod
    fun startService(promise: Promise) {
        try {
            val intent = Intent(reactApplicationContext, NivaraBackgroundService::class.java).apply {
                action = NivaraBackgroundService.ACTION_START
            }
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                reactApplicationContext.startForegroundService(intent)
            } else {
                reactApplicationContext.startService(intent)
            }
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("ERROR", e.message)
        }
    }

    @ReactMethod
    fun stopService(promise: Promise) {
        try {
            val intent = Intent(reactApplicationContext, NivaraBackgroundService::class.java).apply {
                action = NivaraBackgroundService.ACTION_STOP
            }
            reactApplicationContext.startService(intent)
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("ERROR", e.message)
        }
    }

    @ReactMethod
    fun addListener(eventName: String) {
        if (eventName == "SOSTriggered" && sosReceiver == null) {
            sosReceiver = object : BroadcastReceiver() {
                override fun onReceive(context: Context, intent: Intent) {
                    val source = intent.getStringExtra(NivaraBackgroundService.EXTRA_SOURCE) ?: "unknown"
                    val params = Arguments.createMap().apply { putString("source", source) }
                    reactApplicationContext
                        .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                        .emit("SOSTriggered", params)
                }
            }
            val filter = IntentFilter(NivaraBackgroundService.ACTION_SOS)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                reactApplicationContext.registerReceiver(sosReceiver, filter, Context.RECEIVER_NOT_EXPORTED)
            } else {
                reactApplicationContext.registerReceiver(sosReceiver, filter)
            }
        }
    }

    @ReactMethod
    fun removeListeners(count: Int) {
        sosReceiver?.let {
            try { reactApplicationContext.unregisterReceiver(it) } catch (e: Exception) {}
            sosReceiver = null
        }
    }
}
