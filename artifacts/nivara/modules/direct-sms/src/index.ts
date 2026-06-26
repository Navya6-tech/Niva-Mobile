import { NativeModules, Platform } from "react-native";

export function sendSMS(phoneNumbers: string[], message: string): void {
  if (Platform.OS !== "android") return;
  const mod = NativeModules.DirectSms as
    | { sendSMS: (phones: string[], msg: string) => void }
    | undefined;
  if (!mod) throw new Error("Native module DirectSms not found");
  mod.sendSMS(phoneNumbers, message);
}
