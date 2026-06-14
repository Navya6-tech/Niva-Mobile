import { useEffect, useRef } from "react";
import { Platform } from "react-native";

const SHAKE_COUNT_REQUIRED = 3;
const SHAKE_WINDOW_MS = 2000;
const UPDATE_INTERVAL_MS = 50;

const THRESHOLDS: Record<"low" | "medium" | "high", number> = {
  low: 2.0,
  medium: 1.5,
  high: 1.1,
};

type AccelData = { x: number; y: number; z: number };

interface AccelerometerModule {
  isAvailableAsync: () => Promise<boolean>;
  setUpdateInterval: (ms: number) => void;
  addListener: (cb: (data: AccelData) => void) => { remove: () => void };
}

let Accel: AccelerometerModule | null = null;
if (Platform.OS !== "web") {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    Accel = (require("expo-sensors") as { Accelerometer: AccelerometerModule }).Accelerometer;
  } catch {
    Accel = null;
  }
}

export function useShakeDetector(
  onShake: () => void,
  sensitivity: "low" | "medium" | "high" = "medium",
  enabled: boolean = true,
  onShakeCount?: (count: number) => void
) {
  const shakeCountRef = useRef(0);
  const shakeWindowStartRef = useRef(0);
  const lastAccelRef = useRef<AccelData>({ x: 0, y: 0, z: 0 });
  const lastShakeTimeRef = useRef(0);

  useEffect(() => {
    if (!enabled || Platform.OS === "web" || !Accel) return;

    let subscription: { remove: () => void } | null = null;
    let active = true;

    const setup = async () => {
      try {
        const available = await Accel!.isAvailableAsync();
        if (!available || !active) return;

        Accel!.setUpdateInterval(UPDATE_INTERVAL_MS);
        subscription = Accel!.addListener((data: AccelData) => {
          if (!active) return;
          const last = lastAccelRef.current;
          const dx = data.x - last.x;
          const dy = data.y - last.y;
          const dz = data.z - last.z;
          const delta = Math.sqrt(dx * dx + dy * dy + dz * dz);
          lastAccelRef.current = data;

          const threshold = THRESHOLDS[sensitivity];
          const now = Date.now();

          if (delta > threshold && now - lastShakeTimeRef.current > 100) {
            lastShakeTimeRef.current = now;

            if (now - shakeWindowStartRef.current > SHAKE_WINDOW_MS) {
              shakeWindowStartRef.current = now;
              shakeCountRef.current = 0;
            }

            shakeCountRef.current += 1;
            const count = shakeCountRef.current;

            if (count < SHAKE_COUNT_REQUIRED) {
              onShakeCount?.(count);
              try {
                // eslint-disable-next-line @typescript-eslint/no-var-requires
                const Haptics = require("expo-haptics");
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              } catch {}
            }

            if (count >= SHAKE_COUNT_REQUIRED) {
              shakeCountRef.current = 0;
              shakeWindowStartRef.current = 0;
              try {
                // eslint-disable-next-line @typescript-eslint/no-var-requires
                const Haptics = require("expo-haptics");
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
              } catch {}
              onShake();
            }
          }
        });
      } catch {
        // silently fail — shake detection is not available
      }
    };

    setup();

    return () => {
      active = false;
      subscription?.remove();
    };
  }, [enabled, sensitivity, onShake, onShakeCount]);
}
