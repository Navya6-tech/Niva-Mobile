import * as Location from "expo-location";
import * as Notifications from "expo-notifications";
import { Platform, PermissionsAndroid } from "react-native";

export async function requestAllPermissions() {
  if (Platform.OS === "web") return;

  try {
    await Notifications.requestPermissionsAsync();
  } catch {}

  try {
    const { Audio } = require("expo-av") as typeof import("expo-av");
    await Audio.requestPermissionsAsync();
  } catch {}

  try {
    const { status: fgStatus } =
      await Location.requestForegroundPermissionsAsync();
    if (fgStatus === "granted") {
      await Location.requestBackgroundPermissionsAsync();
    }
  } catch {}

  if (Platform.OS === "android") {
    try {
      await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.SEND_SMS,
        {
          title: "Send SMS Permission",
          message:
            "NIVARA needs permission to send emergency SMS messages automatically when SOS is triggered.",
          buttonPositive: "Allow",
          buttonNegative: "Deny",
        }
      );
    } catch {}
  }
}
