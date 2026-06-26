const path = require("path");
const fs = require("fs");

// Resolve @expo/config-plugins from the project root (where pnpm installed it),
// not from this plugin file's directory — pnpm doesn't hoist packages globally.
const projectRoot = path.resolve(__dirname, "..");
const { withDangerousMod } = require(
  require.resolve("@expo/config-plugins", { paths: [projectRoot] })
);

const DIRECT_SMS_MODULE_KT = `package com.nivara.safety

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
`;

const DIRECT_SMS_PACKAGE_KT = `package com.nivara.safety

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager

class DirectSmsPackage : ReactPackage {
  override fun createNativeModules(reactContext: ReactApplicationContext): List<NativeModule> =
    listOf(DirectSmsModule(reactContext))

  override fun createViewManagers(reactContext: ReactApplicationContext): List<ViewManager<*, *>> =
    emptyList()
}
`;

module.exports = function withDirectSms(config) {
  return withDangerousMod(config, [
    "android",
    (config) => {
      const platformRoot = config.modRequest.platformProjectRoot;
      const javaDir = path.join(
        platformRoot,
        "app/src/main/java/com/nivara/safety"
      );
      fs.mkdirSync(javaDir, { recursive: true });

      fs.writeFileSync(path.join(javaDir, "DirectSmsModule.kt"), DIRECT_SMS_MODULE_KT);
      fs.writeFileSync(path.join(javaDir, "DirectSmsPackage.kt"), DIRECT_SMS_PACKAGE_KT);

      // Patch MainApplication.kt to register the package
      const mainAppPath = path.join(javaDir, "MainApplication.kt");
      if (fs.existsSync(mainAppPath)) {
        let src = fs.readFileSync(mainAppPath, "utf8");
        if (!src.includes("DirectSmsPackage")) {
          src = src.replace(
            /(\bPackageList\(this\)\.packages\.apply\s*\{)([\s\S]*?)(\})/,
            (_, open, body, close) =>
              `${open}${body}      add(DirectSmsPackage())\n    ${close}`
          );
          fs.writeFileSync(mainAppPath, src);
        }
      }

      return config;
    },
  ]);
};
