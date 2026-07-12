import { useEffect, useCallback } from "react";
import { NativeModules, NativeEventEmitter, Platform } from "react-native";

const { NivaraService } = NativeModules;
console.log("NIVARA NivaraService module:", NivaraService ? "FOUND" : "NOT FOUND");

export function useNativeBackgroundService(
  enabled: boolean,
  onSOSTriggered: (source: string) => void,
  triggerPhrases?: string[],
  emergencyPhones?: string[],
  audioRecordingEnabled?: boolean,
  voiceTriggerEnabled?: boolean
) {
  const start = useCallback(async () => {
    if (Platform.OS !== "android" || !NivaraService) return;
    try { await NivaraService.startService(); } catch (e) {}
    if (emergencyPhones && emergencyPhones.length > 0) {
      try { await NivaraService.updateEmergencyData(emergencyPhones, 0, 0); } catch (e) {}
    }
    try { await NivaraService.setAudioRecordingEnabled(audioRecordingEnabled ?? false); } catch (e) {}
    try { await NivaraService.setVoiceTriggerEnabled(voiceTriggerEnabled ?? false); } catch (e) {}
  }, [emergencyPhones, audioRecordingEnabled, voiceTriggerEnabled]);

  const stop = useCallback(async () => {
    if (Platform.OS !== "android" || !NivaraService) return;
    try { await NivaraService.stopService(); } catch (e) {}
  }, []);

  const updatePhrases = useCallback(async (phrases: string[]) => {
    if (Platform.OS !== "android" || !NivaraService) return;
    try { await NivaraService.updatePhrases(phrases); } catch (e) {}
  }, []);

  useEffect(() => {
    if (Platform.OS !== "android" || !NivaraService) return;
    const emitter = new NativeEventEmitter(NivaraService);
    const sub = emitter.addListener("SOSTriggered", (data: { source: string }) => {
      onSOSTriggered(data.source);
    });
    if (enabled) { start(); } else { stop(); }
    return () => { sub.remove(); };
  }, [enabled, start, stop, onSOSTriggered]);

  useEffect(() => {
    if (Platform.OS !== "android" || !NivaraService || !enabled || !triggerPhrases) return;
    updatePhrases(triggerPhrases);
  }, [triggerPhrases, enabled, updatePhrases]);
  useEffect(() => {
    if (Platform.OS !== "android" || !NivaraService || !enabled || !emergencyPhones || emergencyPhones.length === 0) return;
    // Get location and sync with contacts
    (async () => {
      try {
        const Location = await import("expo-location");
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        NivaraService.updateEmergencyData(emergencyPhones, loc.coords.latitude, loc.coords.longitude);
      } catch {
        try { NivaraService.updateEmergencyData(emergencyPhones, 0, 0); } catch (e) {}
      }
    })();
  }, [emergencyPhones, enabled]);
  useEffect(() => {
    if (Platform.OS !== "android" || !NivaraService || !enabled) return;
    try { NivaraService.setAudioRecordingEnabled(audioRecordingEnabled ?? false); } catch (e) {}
  }, [audioRecordingEnabled, enabled]);
  useEffect(() => {
    if (Platform.OS !== "android" || !NivaraService || !enabled) return;
    try { NivaraService.setVoiceTriggerEnabled(voiceTriggerEnabled ?? false); } catch (e) {}
  }, [voiceTriggerEnabled, enabled]);
}

export async function openAccessibilitySettings() {
  if (Platform.OS !== "android" || !NivaraService) return;
  try { await NivaraService.openAccessibilitySettings(); } catch (e) {}
}

export async function isAccessibilityEnabled(): Promise<boolean> {
  if (Platform.OS !== "android" || !NivaraService) return false;
  try { return await NivaraService.isAccessibilityEnabled(); } catch (e) { return false; }
}
