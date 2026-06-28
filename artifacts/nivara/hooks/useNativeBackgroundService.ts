import { useEffect, useCallback } from "react";
import { NativeModules, NativeEventEmitter, Platform } from "react-native";

const { NivaraService } = NativeModules;

export function useNativeBackgroundService(
  enabled: boolean,
  onSOSTriggered: (source: string) => void
) {
  const start = useCallback(async () => {
    if (Platform.OS !== "android" || !NivaraService) return;
    try {
      await NivaraService.startService();
    } catch (e) {
      console.error("Service start error:", e);
    }
  }, []);

  const stop = useCallback(async () => {
    if (Platform.OS !== "android" || !NivaraService) return;
    try {
      await NivaraService.stopService();
    } catch (e) {}
  }, []);

  useEffect(() => {
    if (Platform.OS !== "android" || !NivaraService) return;
    const emitter = new NativeEventEmitter(NivaraService);
    const sub = emitter.addListener("SOSTriggered", (data: { source: string }) => {
      onSOSTriggered(data.source);
    });
    if (enabled) {
      start();
    } else {
      stop();
    }
    return () => {
      sub.remove();
    };
  }, [enabled, start, stop, onSOSTriggered]);
}
