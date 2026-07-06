import { useEffect, useCallback } from "react";
import { NativeModules, NativeEventEmitter, Platform } from "react-native";

const { NivaraService } = NativeModules;

export function useNativeBackgroundService(
  enabled: boolean,
  onSOSTriggered: (source: string) => void,
  triggerPhrases?: string[]
) {
  const start = useCallback(async () => {
    if (Platform.OS !== "android" || !NivaraService) return;
    try { await NivaraService.startService(); } catch (e) {}
  }, []);

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
}

export async function openAccessibilitySettings() {
  if (Platform.OS !== "android" || !NivaraService) return;
  try { await NivaraService.openAccessibilitySettings(); } catch (e) {}
}

export async function isAccessibilityEnabled(): Promise<boolean> {
  if (Platform.OS !== "android" || !NivaraService) return false;
  try { return await NivaraService.isAccessibilityEnabled(); } catch (e) { return false; }
}
