package expo.modules.directsms

import android.os.Build
import android.telephony.SmsManager
import android.telephony.SubscriptionManager
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class DirectSmsModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("DirectSms")

    Function("sendSMS") { phoneNumbers: List<String>, message: String ->
      val context = appContext.reactContext ?: return@Function

      val smsManager: SmsManager = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP_MR1) {
        val subId = SubscriptionManager.getDefaultSmsSubscriptionId()
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
          if (subId != SubscriptionManager.INVALID_SUBSCRIPTION_ID) {
            context.getSystemService(SmsManager::class.java)
              .createForSubscriptionId(subId)
          } else {
            context.getSystemService(SmsManager::class.java)
          }
        } else {
          @Suppress("DEPRECATION")
          if (subId != SubscriptionManager.INVALID_SUBSCRIPTION_ID) {
            SmsManager.getSmsManagerForSubscriptionId(subId)
          } else {
            SmsManager.getDefault()
          }
        }
      } else {
        @Suppress("DEPRECATION")
        SmsManager.getDefault()
      }

      for (phone in phoneNumbers) {
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
}
