import * as BackgroundFetch from "expo-background-fetch";
import * as Notifications from "expo-notifications";
import * as TaskManager from "expo-task-manager";
import { useEffect } from "react";
import { Platform } from "react-native";
import { BACKGROUND_PROTECTION_TASK } from "@/tasks/backgroundProtection";

const NOTIFICATION_ID = "nivara-protection";
const CHANNEL_ID = "nivara-protection-channel";

export async function setupNotificationChannel() {
  if (Platform.OS !== "android") return;
  await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
    name: "Background Protection",
    importance: Notifications.AndroidImportance.LOW,
    showBadge: false,
    sound: null,
    enableVibrate: false,
  });
}

export async function requestNotificationPermissions() {
  if (Platform.OS === "web") return;
  await Notifications.requestPermissionsAsync({ android: {}, ios: {} });
}

export async function showProtectionNotification() {
  if (Platform.OS === "web") return;
  try {
    await Notifications.dismissNotificationAsync(NOTIFICATION_ID);
  } catch {}
  await Notifications.scheduleNotificationAsync({
    identifier: NOTIFICATION_ID,
    content: {
      title: "🛡️ NIVARA is protecting you",
      body: 'Shake 3× or say "bachao" to trigger SOS',
      sticky: true,
      data: { type: "protection" },
      ...(Platform.OS === "android"
        ? {
            android: {
              channelId: CHANNEL_ID,
              ongoing: true,
              sticky: true,
              smallIcon: "notification_icon",
              color: "#E91E8C",
              priority: Notifications.AndroidNotificationPriority.LOW,
            },
          }
        : {}),
    },
    trigger: null,
  });
}

export async function hideProtectionNotification() {
  if (Platform.OS === "web") return;
  try {
    await Notifications.dismissNotificationAsync(NOTIFICATION_ID);
  } catch {}
}

export async function startBackgroundTask() {
  if (Platform.OS === "web") return;
  try {
    const isRegistered = await TaskManager.isTaskRegisteredAsync(
      BACKGROUND_PROTECTION_TASK
    );
    if (!isRegistered) {
      await BackgroundFetch.registerTaskAsync(BACKGROUND_PROTECTION_TASK, {
        minimumInterval: 60,
        stopOnTerminate: false,
        startOnBoot: true,
      });
    }
  } catch {}
}

export async function stopBackgroundTask() {
  if (Platform.OS === "web") return;
  try {
    const isRegistered = await TaskManager.isTaskRegisteredAsync(
      BACKGROUND_PROTECTION_TASK
    );
    if (isRegistered) {
      await BackgroundFetch.unregisterTaskAsync(BACKGROUND_PROTECTION_TASK);
    }
  } catch {}
}

export function useBackgroundProtection(enabled: boolean) {
  useEffect(() => {
    if (Platform.OS === "web") return;

    if (enabled) {
      requestNotificationPermissions().then(async () => {
        await setupNotificationChannel();
        await showProtectionNotification();
        await startBackgroundTask();
      });
    } else {
      hideProtectionNotification();
      stopBackgroundTask();
    }
  }, [enabled]);
}
