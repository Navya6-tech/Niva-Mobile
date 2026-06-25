import { useEffect, useRef, useCallback } from "react";
import { AppState, Platform } from "react-native";

const LOUD_THRESHOLD_DB = -20;
const SUSTAINED_MS = 600;
const CHECK_INTERVAL_MS = 100;
const SEGMENT_DURATION_MS = 4000;

export function useVoiceTrigger(active: boolean, onTriggered: () => void) {
  const activeRef = useRef(active);
  const onTriggeredRef = useRef(onTriggered);
  const recordingRef = useRef<InstanceType<typeof import("expo-av").Audio.Recording> | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const restartTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loudStartRef = useRef<number | null>(null);
  const triggeredRef = useRef(false);

  activeRef.current = active;
  onTriggeredRef.current = onTriggered;

  const cleanup = useCallback(async () => {
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
    if (restartTimerRef.current) { clearTimeout(restartTimerRef.current); restartTimerRef.current = null; }
    if (recordingRef.current) {
      try { await recordingRef.current.stopAndUnloadAsync(); } catch {}
      recordingRef.current = null;
    }
    loudStartRef.current = null;
    triggeredRef.current = false;
  }, []);

  const startSegment = useCallback(async () => {
    if (!activeRef.current || Platform.OS === "web") return;
    try {
      const { Audio } = require("expo-av") as typeof import("expo-av");

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        staysActiveInBackground: true,
      });

      const { recording } = await Audio.Recording.createAsync(
        { ...Audio.RecordingOptionsPresets.HIGH_QUALITY, isMeteringEnabled: true },
        undefined,
        CHECK_INTERVAL_MS
      );

      recordingRef.current = recording;
      loudStartRef.current = null;

      intervalRef.current = setInterval(() => {
        if (!activeRef.current) return;
        recording.getStatusAsync().then((s) => {
          if (!s.isRecording) return;
          const db = (s as { metering?: number }).metering ?? -160;
          const now = Date.now();
          if (db >= LOUD_THRESHOLD_DB) {
            if (loudStartRef.current === null) {
              loudStartRef.current = now;
            } else if (now - loudStartRef.current >= SUSTAINED_MS && !triggeredRef.current) {
              triggeredRef.current = true;
              onTriggeredRef.current();
            }
          } else {
            loudStartRef.current = null;
          }
        }).catch(() => {});
      }, CHECK_INTERVAL_MS);

      restartTimerRef.current = setTimeout(async () => {
        if (!activeRef.current) return;
        if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
        try { await recording.stopAndUnloadAsync(); } catch {}
        recordingRef.current = null;
        triggeredRef.current = false;
        startSegment();
      }, SEGMENT_DURATION_MS);
    } catch {
      if (activeRef.current) {
        restartTimerRef.current = setTimeout(() => startSegment(), 1500);
      }
    }
  }, []);

  useEffect(() => {
    if (Platform.OS === "web") return;

    const sub = AppState.addEventListener("change", (state) => {
      if (!activeRef.current) return;
      if (state === "active") {
        startSegment();
      }
    });

    if (active) {
      triggeredRef.current = false;
      startSegment();
    } else {
      cleanup();
    }

    return () => {
      sub.remove();
      cleanup();
    };
  }, [active, startSegment, cleanup]);
}
