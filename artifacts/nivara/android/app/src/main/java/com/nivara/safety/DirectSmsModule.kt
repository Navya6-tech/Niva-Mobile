package com.nivara.safety

import android.os.Build
import android.telephony.SmsManager
import android.telephony.SubscriptionManager
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableArray

class DirectSmsModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

  override fun getName() = "DirectSms"

  @ReactMethod
  fun sendSMS(phoneNumbers: ReadableArray, message: String) {
    @Suppress("DEPRECATION")
    val smsManager: SmsManager =
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP_MR1) {
        val subId = SubscriptionManager.getDefaultSmsSubscriptionId()
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
          val mgr = reactApplicationContext.getSystemService(SmsManager::class.java)
          if (subId != SubscriptionManager.INVALID_SUBSCRIPTION_ID)
            mgr.createForSubscriptionId(subId)
          else mgr
        } else {
          if (subId != SubscriptionManager.INVALID_SUBSCRIPTION_ID)
            SmsManager.getSmsManagerForSubscriptionId(subId)
          else SmsManager.getDefault()
        }
      } else {
        SmsManager.getDefault()
      }

    for (i in 0 until phoneNumbers.size()) {
      val phone = phoneNumbers.getString(i) ?: continue
      try {
        if (message.length > 160) {
          val parts = smsManager.divideMessage(message)
          smsManager.sendMultipartTextMessage(phone, null, parts, null, null)
        } else {
          smsManager.sendTextMessage(phone, null, message, null, null)
        }
      } catch (_: Exception) {}
    }
  }
}
