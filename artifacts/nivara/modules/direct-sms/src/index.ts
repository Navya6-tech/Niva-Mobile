import { Platform } from "react-native";

export function sendSMS(phoneNumbers: string[], message: string): void {
  if (Platform.OS !== "android") return;
  // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any
  const { requireNativeModule } = require("expo-modules-core") as any;
  const mod = requireNativeModule("DirectSms") as { sendSMS: (phones: string[], msg: string) => void };
  mod.sendSMS(phoneNumbers, message);
}
