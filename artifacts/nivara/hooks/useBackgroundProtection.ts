import * as BackgroundFetch from "expo-background-fetch";
import * as Location from "expo-location";
import * as Notifications from "expo-notifications";
import * as TaskManager from "expo-task-manager";
import { useEffect } from "react";
import { Platform } from "react-native";
import {
  BACKGROUND_PROTECTION_TASK,
  LOCATION_TASK_NAME,
} from "@/tasks/backgroundProtection";

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

async function startLocationForegroundService() {
  const { status: fgStatus } =
    await Location.requestForegroundPermissionsAsync();
  if (fgStatus !== "granted") return false;

  const { status: bgStatus } =
    await Location.requestBackgroundPermissionsAsync();
  if (bgStatus !== "granted") return false;

  const already = await Location.hasStartedLocationUpdatesAsync(
    LOCATION_TASK_NAME
  );
  if (already) return true;

  await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
    accuracy: Location.Accuracy.Lowest,
    timeInterval: 15000,
    distanceInterval: 0,
    pausesUpdatesAutomatically: false,
    foregroundService: {
      notificationTitle: "🛡️ NIVARA is protecting you",
      notificationBody: 'Shake 3× or say "bachao" to trigger SOS',
      notificationColor: "#E91E8C",
    },
    showsBackgroundLocationIndicator: false,
  });

  return true;
}

async function stopLocationForegroundService() {
  try {
    const running = await Location.hasStartedLocationUpdatesAsync(
      LOCATION_TASK_NAME
    );
    if (running) {
      await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
    }
  } catch {}
}

async function startHeartbeatTask() {
  try {
    const isReg = await TaskManager.isTaskRegisteredAsync(
      BACKGROUND_PROTECTION_TASK
    );
    if (!isReg) {
      await BackgroundFetch.registerTaskAsync(BACKGROUND_PROTECTION_TASK, {
        minimumInterval: 60,
        stopOnTerminate: false,
        startOnBoot: true,
      });
    }
  } catch {}
}

async function stopHeartbeatTask() {
  try {
    const isReg = await TaskManager.isTaskRegisteredAsync(
      BACKGROUND_PROTECTION_TASK
    );
    if (isReg) {
      await BackgroundFetch.unregisterTaskAsync(BACKGROUND_PROTECTION_TASK);
    }
  } catch {}
}

export function useBackgroundProtection(enabled: boolean) {
  useEffect(() => {
    if (Platform.OS === "web") return;

    if (enabled) {
      const enable = async () => {
        await requestNotificationPermissions();
        await setupNotificationChannel();
        const started = await startLocationForegroundService();
        if (!started) {
          await startHeartbeatTask();
        }
      };
      enable();
    } else {
      stopLocationForegroundService();
      stopHeartbeatTask();
    }
  }, [enabled]);
}
